// CyberOutbreak — Live Threat Intelligence Feed Engine
// Fetches real CVE & KEV data via local Python proxy (/api/threats)

class ThreatFeedEngine {
  constructor() {
    this.STORAGE_KEY = 'cyberoutbreak_threat_db';
    this.LAST_FETCH_KEY = 'cyberoutbreak_last_fetch';
    this.FETCH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

    // We now use the local Flask proxy to bypass CORS and pull real data
    this.CISA_KEV_URL = '/api/threats/cisa-kev';
    this.NVD_API_URL  = '/api/threats/nvd';
    this.MB_API_URL   = '/api/threats/malwarebazaar';

    this.pendingEntries   = []; // fetched but not yet imported
    this.importedIds      = new Set();
    this.isFetching       = false;
    this.onNewThreats     = null; // callback(entries[])
    this.onStatusChange   = null; // callback(msg, type)

    this._loadImportedIds();
    this._scheduleAutoFetch();
  }

  // ──────────────────────────────────────────────
  //  Public API
  // ──────────────────────────────────────────────

  async fetchNow() {
    if (this.isFetching) return;
    this.isFetching = true;
    this._emit('Connecting to global threat intelligence feeds...', 'info');

    try {
      // Fetch CISA KEV, NVD, and MalwareBazaar in parallel
      const [kevEntries, nvdEntries, mbEntries] = await Promise.all([
        this._fetchCISAKEV().catch(e => {
          console.warn('CISA KEV fetch failed:', e);
          return [];
        }),
        this._fetchNVD().catch(e => {
          console.warn('NVD fetch failed:', e);
          return [];
        }),
        this._fetchMalwareBazaar().catch(e => {
          console.warn('MalwareBazaar fetch failed:', e);
          return [];
        })
      ]);

      const allEntries = [...kevEntries, ...nvdEntries, ...mbEntries];
      
      // De-duplicate by ID
      const uniqueEntries = allEntries.filter((e, i, arr) => arr.findIndex(x => x.id === e.id) === i);

      if (uniqueEntries.length > 0) {
        this.pendingEntries = uniqueEntries;
        localStorage.setItem(this.LAST_FETCH_KEY, Date.now().toString());
        const newCount = uniqueEntries.filter(e => !this.importedIds.has(e.id)).length;
        this._emit(`✓ ${uniqueEntries.length} threat entries fetched. ${newCount} new to import.`, 'success');
        if (this.onNewThreats) this.onNewThreats(uniqueEntries);
      } else {
        this._emit('Feed returned no new entries. Is the local proxy server running?', 'warn');
      }
    } catch (err) {
      console.error('[ThreatFeed] Fetch failed.', err);
      this._emit('Live feed unreachable. Check network or server logs.', 'error');
    } finally {
      this.isFetching = false;
    }
  }

  importEntry(entryId) {
    const entry = this.pendingEntries.find(e => e.id === entryId);
    if (!entry) return false;
    if (!this.importedIds.has(entryId)) {
      window.MalwareDatabase.unshift(entry);
      this.importedIds.add(entryId);
      this._saveImportedIds();
      this._emit(`Imported: ${entry.name}`, 'success');
      // Persist to local SQLite database
      this._persistToLocalDB([entry]);
      return true;
    }
    return false;
  }

  importAll() {
    let count = 0;
    const toSave = [];
    this.pendingEntries.forEach(e => {
      if (!this.importedIds.has(e.id)) {
        window.MalwareDatabase.unshift(e);
        this.importedIds.add(e.id);
        toSave.push(e);
        count++;
      }
    });
    if (toSave.length > 0) {
      this._saveImportedIds();
      this._persistToLocalDB(toSave);
    }
    this._emit(`Bulk import complete: ${count} threats added to database.`, 'success');
    return count;
  }

  /** Persist entries to local SQLite DB via Flask proxy */
  async _persistToLocalDB(entries) {
    try {
      const resp = await fetch('/api/db/malware/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entries)
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const result = await resp.json();
      console.log(`[ThreatFeed] Saved ${result.saved} entries to local DB.`);
    } catch (e) {
      // Non-fatal: DB save fails silently (server may not be running)
      console.warn('[ThreatFeed] Could not persist to local DB:', e.message);
    }
  }

  /** Load all entries from local SQLite DB on startup */
  async loadFromLocalDB() {
    try {
      const resp = await fetch('/api/db/malware');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const entries = data.entries || [];
      if (entries.length > 0) {
        let added = 0;
        entries.forEach(e => {
          if (!window.MalwareDatabase.some(m => m.id === e.id)) {
            window.MalwareDatabase.push(e);
            this.importedIds.add(e.id);
            added++;
          }
        });
        if (added > 0) {
          this._emit(`Loaded ${added} threats from your local database.`, 'success');
          if (this.onNewThreats) this.onNewThreats(window.MalwareDatabase);
        }
      }
    } catch (e) {
      console.warn('[ThreatFeed] Could not load from local DB:', e.message);
    }
  }

  getLastFetchTime() {
    const ts = localStorage.getItem(this.LAST_FETCH_KEY);
    if (!ts) return 'Never';
    const d = new Date(parseInt(ts));
    return d.toLocaleString();
  }

  getNextFetchMs() {
    const ts = localStorage.getItem(this.LAST_FETCH_KEY);
    if (!ts) return 0;
    const elapsed = Date.now() - parseInt(ts);
    return Math.max(0, this.FETCH_INTERVAL_MS - elapsed);
  }

  // ──────────────────────────────────────────────
  //  CISA KEV Fetcher
  // ──────────────────────────────────────────────

  async _fetchCISAKEV() {
    const resp = await fetch(this.CISA_KEV_URL, { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    const vulns = (data.vulnerabilities || []).slice(-100); // last 100 most-recently added
    const entries = [];

    for (const v of vulns) {
      const id = `kev-${v.cveID.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      const entry = this._mapKEVToMalware(v, id);
      if (entry) entries.push(entry);
    }
    return entries;
  }

  // ──────────────────────────────────────────────
  //  NVD CVE Fetcher (via proxy)
  // ──────────────────────────────────────────────

  async _fetchNVD() {
    const resp = await fetch(this.NVD_API_URL, { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    const vulns = (data.vulnerabilities || []).map(v => v.cve);
    const entries = [];

    for (const v of vulns) {
      if (!v) continue;
      const id = `nvd-${v.id.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      
      let desc = 'No description provided by NVD.';
      if (v.descriptions && v.descriptions.length > 0) {
        const engDesc = v.descriptions.find(d => d.lang === 'en');
        desc = engDesc ? engDesc.value : v.descriptions[0].value;
      }

      // Map to generic format so we can reuse mapping logic
      const mappedV = {
        cveID: v.id,
        vulnerabilityName: `NVD Critical: ${v.id}`,
        vendorProject: 'Various',
        product: 'Various',
        shortDescription: desc,
        dateAdded: v.published ? v.published.split('T')[0] : '2024-01-01'
      };

      const entry = this._mapKEVToMalware(mappedV, id);
      entry._source = 'NVD_API';
      entry.origin = 'National Vulnerability Database';
      
    return entries;
  }

  // ──────────────────────────────────────────────
  //  MalwareBazaar Fetcher (via proxy)
  // ──────────────────────────────────────────────

  async _fetchMalwareBazaar() {
    const resp = await fetch(this.MB_API_URL, { cache: 'no-cache' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    const samples = (data.data || []).slice(0, 50); // limit to 50
    const entries = [];

    for (const s of samples) {
      if (!s.sha256_hash) continue;
      const id = `mb-${s.sha256_hash.substring(0, 12)}`;
      
      const sigs = (s.signature || 'Unknown').split(',');
      const malwareFamily = sigs[0] || 'Unknown Family';
      const fileType = s.file_type_mime || 'Executable';

      const mappedV = {
        cveID: 'N/A',
        vulnerabilityName: `MB: ${malwareFamily} variant`,
        vendorProject: 'MalwareBazaar',
        product: fileType,
        shortDescription: `Recent malware sample matching signature: ${malwareFamily}. Tags: ${(s.tags || []).join(', ')}`,
        dateAdded: s.first_seen ? s.first_seen.split(' ')[0] : '2024-01-01'
      };

      const entry = this._mapKEVToMalware(mappedV, id);
      entry._source = 'SIMULATED'; // Or 'MB_API'
      entry.origin = 'MalwareBazaar Database';
      
      if (entry) entries.push(entry);
    }
    return entries;
  }

  // ──────────────────────────────────────────────
  //  Mapping Logic
  // ──────────────────────────────────────────────

  _mapKEVToMalware(v, id) {
    const name       = v.vulnerabilityName || v.cveID;
    const vendor     = v.vendorProject    || 'Unknown Vendor';
    const product    = v.product          || 'Unknown Product';
    const vector     = v.shortDescription ? v.shortDescription.slice(0, 90) : `${vendor} ${product} exploitation`;
    const dateAdded  = v.dateAdded        || '2024-01-01';
    const dueDate    = v.dueDate          || '';
    const year       = parseInt((v.dateAdded || '2024').split('-')[0]) || 2024;

    const desc = (v.shortDescription || '').toLowerCase();
    const isRCE         = desc.includes('remote code') || desc.includes('rce');
    const isPrivEsc     = desc.includes('privilege') || desc.includes('escalation');
    const isRansomware  = desc.includes('ransom') || desc.includes('encrypt');
    const isIoT         = desc.includes('iot') || desc.includes('router') || desc.includes('camera');
    const isMobile      = desc.includes('android') || desc.includes('ios') || desc.includes('mobile');
    const isInfra       = desc.includes('scada') || desc.includes('ics') || desc.includes('industrial');

    let category = 'supplychain';
    if (isRansomware)                   category = 'ransomware';
    else if (isIoT)                     category = 'botnet';
    else if (isMobile)                  category = 'spyware';
    else if (isInfra)                   category = 'scada';
    else if (isRCE || isPrivEsc)        category = 'worm';
    else                                category = 'trojan';

    const r0        = isRCE ? (3.5 + Math.random() * 3) : (1.5 + Math.random() * 2.5);
    const stealth   = isRCE ? Math.floor(5 + Math.random() * 5) : Math.floor(3 + Math.random() * 6);
    const lethality = isRansomware ? 9 : isInfra ? 8 : Math.floor(4 + Math.random() * 5);

    const affinities = {
      desktop : isIoT  ? 0.1 : 0.75,
      laptop  : isIoT  ? 0.1 : 0.75,
      server  : isRCE  ? 0.9 : 0.5,
      phone   : isMobile ? 0.95 : 0.1,
      iot     : isIoT  ? 0.95 : 0.2,
      router  : isIoT  ? 0.85 : 0.15,
      scada   : isInfra ? 0.9 : 0.1,
      medical : 0.2
    };

    return {
      id,
      name        : `${name} (${v.cveID})`,
      type        : this._categoryLabel(category),
      category,
      year,
      origin      : `${vendor} — Threat Feed`,
      severity    : isRCE ? 'CRITICAL' : lethality >= 7 ? 'HIGH' : 'MEDIUM',
      cve         : v.cveID,
      vector      : vector.slice(0, 100),
      r0          : parseFloat(r0.toFixed(1)),
      transmissionRate : parseFloat((r0 * 0.1).toFixed(2)),
      patchDifficulty  : isRCE ? 0.65 : 0.45,
      stealth,
      lethality,
      mutationRate : parseFloat((0.1 + Math.random() * 0.4).toFixed(2)),
      airgapHop    : isInfra ? 0.4 : 0.05,
      targetAffinities : affinities,
      realWorldImpact  : `Disclosed/Added on ${dateAdded}. Impacting ${vendor} ${product}.`,
      description  : v.shortDescription || `Vulnerability actively tracked in threat feeds.`,
      _source      : 'CISA_KEV',
      _dateAdded   : dateAdded,
      _dueDate     : dueDate,
      _isNew       : !this.importedIds.has(id)
    };
  }

  _categoryLabel(cat) {
    const labels = {
      ransomware  : 'Cryptographic Ransomware',
      botnet      : 'IoT Swarm Botnet',
      spyware     : 'Mobile Spyware',
      scada       : 'Industrial SCADA Exploit',
      worm        : 'Self-Propagating Worm',
      trojan      : 'Remote Access Trojan',
      supplychain : 'Supply Chain Compromise'
    };
    return labels[cat] || 'Unknown Malware';
  }

  // ──────────────────────────────────────────────
  //  Persistence & Scheduling
  // ──────────────────────────────────────────────

  _loadImportedIds() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const ids = JSON.parse(raw);
        this.importedIds = new Set(ids);
      }
    } catch (_) {
      this.importedIds = new Set();
    }
  }

  _saveImportedIds() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify([...this.importedIds]));
    } catch (_) {}
  }

  _scheduleAutoFetch() {
    const lastFetch = parseInt(localStorage.getItem(this.LAST_FETCH_KEY) || '0');
    const elapsed   = Date.now() - lastFetch;

    if (elapsed >= this.FETCH_INTERVAL_MS) {
      setTimeout(() => this.fetchNow(), 3000);
    } else {
      const remaining = this.FETCH_INTERVAL_MS - elapsed;
      setTimeout(() => {
        this.fetchNow();
        setInterval(() => this.fetchNow(), this.FETCH_INTERVAL_MS);
      }, remaining);
    }
  }

  _emit(msg, type = 'info') {
    if (this.onStatusChange) this.onStatusChange(msg, type);
  }
}

window.ThreatFeedEngine = ThreatFeedEngine;
