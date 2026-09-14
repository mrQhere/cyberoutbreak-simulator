// CyberOutbreak Application Orchestrator & UI Controller
// Wires together: NetworkEngine, SimulationEngine, ChartsEngine,
//                 ThreatFeedEngine, ReportEngine

document.addEventListener('DOMContentLoaded', () => {
  // 1. Elements
  const canvasNetwork = document.getElementById('canvas-network');
  const canvasCurve   = document.getElementById('chart-curve');
  const canvasDonut   = document.getElementById('chart-donut');
  const canvasR0      = document.getElementById('chart-r0');
  const canvasDamage  = document.getElementById('chart-damages');

  if (!canvasNetwork) return;

  // 2. Initialize Engines
  const network    = new NetworkEngine(canvasNetwork);
  const simulation = new SimulationEngine(network, window.MalwareDatabase || []);
  const charts     = new ChartsEngine(canvasCurve, canvasDonut, canvasR0, canvasDamage);
  const threatFeed = new ThreatFeedEngine();
  const reporter   = new ReportEngine();

  // Generate initial corporate topology then run ONE initDefaultState
  network.generateTopology('corporate', 75);
  simulation.initDefaultState(); // Called exactly once here — constructor no longer calls it

  // Load all previously saved malware from the local SQLite database
  threatFeed.loadFromLocalDB();

  // Set DB count immediately from built-in database (before any async DB load)
  const _dbLabel = document.getElementById('threat-db-count-label');
  if (_dbLabel && window.MalwareDatabase) {
    _dbLabel.textContent = `Threat Database (${window.MalwareDatabase.length})`;
  }

  // 3. UI State Elements
  const btnPlay        = document.getElementById('btn-play');
  const btnStep        = document.getElementById('btn-step');
  const btnReset       = document.getElementById('btn-reset');
  const btnUpdateDaily = document.getElementById('btn-update-daily');
  const btnSound       = document.getElementById('btn-sound');
  const selMalware     = document.getElementById('select-malware');
  const selTopology    = document.getElementById('select-topology');
  const speedBtns      = document.querySelectorAll('.speed-btn');
  const checkAutoUpdate = document.getElementById('check-auto-update');

  // KPI Counters
  const elTotalDevices    = document.getElementById('kpi-total-devices');
  const elInfected        = document.getElementById('kpi-infected');
  const elInfectedPct     = document.getElementById('kpi-infected-pct');
  const elPatched         = document.getElementById('kpi-patched');
  const elPatchedPct      = document.getElementById('kpi-patched-pct');
  const elR0              = document.getElementById('kpi-r0');
  const elR0Status        = document.getElementById('kpi-r0-status');
  const elCurrentDay      = document.getElementById('kpi-current-day');
  const elDamage          = document.getElementById('kpi-damage');
  const elGlobalThreatBadge = document.getElementById('global-threat-badge');

  // Feeds
  const containerJumpLogs  = document.getElementById('jump-logs-container');
  const containerBulletins = document.getElementById('bulletins-container');

  // Device Inspector Drawer
  const drawerInspector  = document.getElementById('device-inspector');
  const btnCloseInspector = document.getElementById('btn-close-inspector');
  const inspHostname     = document.getElementById('insp-hostname');
  const inspIp           = document.getElementById('insp-ip');
  const inspType         = document.getElementById('insp-type');
  const inspOs           = document.getElementById('insp-os');
  const inspSubnet       = document.getElementById('insp-subnet');
  const inspStatus       = document.getElementById('insp-status');
  const inspPayload      = document.getElementById('insp-payload');
  const inspCves         = document.getElementById('insp-cves');
  const inspLogs         = document.getElementById('insp-logs');
  const btnInspPatch     = document.getElementById('btn-insp-patch');
  const btnInspInfect    = document.getElementById('btn-insp-infect');
  const btnInspIsolate   = document.getElementById('btn-insp-isolate');

  // Modals
  const modalDatabase    = document.getElementById('modal-database');
  const btnOpenDatabase  = document.getElementById('btn-open-database');
  const btnCloseDatabase = document.getElementById('btn-close-database');
  const dbCatalogList    = document.getElementById('db-catalog-list');
  const dbSearchInput    = document.getElementById('db-search-input');
  const dbCategoryFilters = document.querySelectorAll('.db-filter-btn');

  const modalCustomZeroDay = document.getElementById('modal-zeroday');
  const btnOpenZeroDay     = document.getElementById('btn-open-zeroday');
  const btnCloseZeroDay    = document.getElementById('btn-close-zeroday');
  const formZeroDay        = document.getElementById('form-zeroday');

  // Threat Feed Modal
  const modalThreatFeed   = document.getElementById('modal-threat-feed');
  const btnOpenThreatFeed = document.getElementById('btn-open-threat-feed');
  const btnCloseThreatFeed = document.getElementById('btn-close-threat-feed');
  const btnFetchNow       = document.getElementById('btn-fetch-now');
  const btnImportAll      = document.getElementById('btn-import-all');
  const feedEntriesGrid   = document.getElementById('feed-entries-grid');
  const feedStatusBar     = document.getElementById('feed-status-bar');
  const feedStatusText    = document.getElementById('feed-status-text');
  const feedSearch        = document.getElementById('feed-search');
  const feedCountTotal    = document.getElementById('feed-count-total');
  const feedCountNew      = document.getElementById('feed-count-new');
  const feedLastSync      = document.getElementById('feed-last-sync');
  const feedNextSync      = document.getElementById('feed-next-sync');
  const feedBadge         = document.getElementById('feed-badge');

  // Damages Chart Toggles
  const btnDmgDaily = document.getElementById('btn-dmg-daily');
  const btnDmgCum   = document.getElementById('btn-dmg-cum');

  if (btnDmgDaily && btnDmgCum) {
    btnDmgDaily.addEventListener('click', () => {
      btnDmgDaily.classList.add('active');
      btnDmgCum.classList.remove('active');
      charts.setDamageMode('daily');
      updateUI();
    });
    btnDmgCum.addEventListener('click', () => {
      btnDmgCum.classList.add('active');
      btnDmgDaily.classList.remove('active');
      charts.setDamageMode('cum');
      updateUI();
    });
  }

  // PDF Report
  const btnGenerateReport = document.getElementById('btn-generate-report');
  const btnExportLogs     = document.getElementById('btn-export-logs');
  const reportToast       = document.getElementById('report-toast');
  const reportToastText   = document.getElementById('report-toast-text');

  // 4. Populate Malware Selector
  function rebuildMalwareSelector(selectValue) {
    if (!selMalware || !window.MalwareDatabase) return;
    selMalware.innerHTML = '';
    window.MalwareDatabase.forEach(m => {
      const opt = document.createElement('option');
      const badge = m._source === 'CISA_KEV' ? '🛡 ' :
                    m._source === 'NVD_API'  ? '🔍 ' :
                    m.id && m.id.includes('edited') ? '✏️ ' :
                    m._source === 'USER'     ? '⚗️ ' : '';
      opt.value = m.id;
      opt.textContent = `${badge}${m.name.slice(0, 48)} [R0: ${m.r0}]`;
      selMalware.appendChild(opt);
    });
    if (selectValue) selMalware.value = selectValue;

    // Dynamically update the Threat Database header button
    const dbLabel = document.getElementById('threat-db-count-label');
    if (dbLabel) {
      dbLabel.textContent = `Threat Database (${window.MalwareDatabase.length})`;
    }
  }
  rebuildMalwareSelector();

  // 5. Update KPI Cards & Charts UI
  function updateUI(stats) {
    if (!stats) stats = simulation.getStats();

    if (elTotalDevices) elTotalDevices.textContent = stats.total;
    if (elInfected)     elInfected.textContent = stats.totalCompromised;
    if (elInfectedPct)  elInfectedPct.textContent = `${stats.infectionRate}%`;
    if (elPatched)      elPatched.textContent = stats.patched;
    if (elPatchedPct)   elPatchedPct.textContent = `${stats.immunityRate}%`;
    if (elR0)           elR0.textContent = stats.currentR0;
    if (elCurrentDay)   elCurrentDay.textContent = `DAY ${stats.currentDay}`;
    if (elDamage)       elDamage.textContent = `$${stats.estimatedDamage}`;

    // R0 status color
    if (elR0Status) {
      if (stats.currentR0 >= 1.5) {
        elR0Status.textContent = 'EXPONENTIAL SPREAD';
        elR0Status.className = 'kpi-sub danger';
      } else if (stats.currentR0 >= 1.0) {
        elR0Status.textContent = 'STEADY PROPAGATION';
        elR0Status.className = 'kpi-sub warning';
      } else {
        elR0Status.textContent = 'CONTAINED / DECLINING';
        elR0Status.className = 'kpi-sub success';
      }
    }

    // Global threat badge
    if (elGlobalThreatBadge) {
      if (stats.totalCompromised > stats.total * 0.45) {
        elGlobalThreatBadge.textContent = 'DEFCON 1: CRITICAL PANDEMIC';
        elGlobalThreatBadge.className = 'threat-badge critical';
      } else if (stats.totalCompromised > stats.total * 0.15) {
        elGlobalThreatBadge.textContent = 'DEFCON 2: ACTIVE OUTBREAK';
        elGlobalThreatBadge.className = 'threat-badge danger';
      } else if (stats.totalCompromised > 0) {
        elGlobalThreatBadge.textContent = 'DEFCON 3: ELEVATED THREAT';
        elGlobalThreatBadge.className = 'threat-badge warning';
      } else {
        elGlobalThreatBadge.textContent = 'DEFCON 5: NORMAL DEFENSE';
        elGlobalThreatBadge.className = 'threat-badge normal';
      }
    }

    // Update charts
    charts.renderAll(simulation.history, stats);

    // Refresh Inspector if a node is currently selected
    if (network.selectedNode) {
      populateInspector(network.selectedNode);
    }
  }

  // 6. Simulation Callbacks
  simulation.onTick = (stats) => {
    updateUI(stats);
  };

  simulation.onAlert = (alert) => {
    if (!containerBulletins) return;
    const item = document.createElement('div');
    item.className = `bulletin-item ${alert.level}`;
    item.innerHTML = `
      <div class="bulletin-header">
        <span class="bulletin-day">DAY ${alert.day}</span>
        <span class="bulletin-time">${alert.time}</span>
      </div>
      <div class="bulletin-title">${escapeHTML(alert.title)}</div>
      <div class="bulletin-text">${escapeHTML(alert.text)}</div>
    `;
    containerBulletins.prepend(item);
    while (containerBulletins.children.length > 25) {
      containerBulletins.removeChild(containerBulletins.lastChild);
    }
  };

  simulation.onJumpLog = (log) => {
    if (!containerJumpLogs) return;
    const item = document.createElement('div');
    item.className = `jump-log-line ${log.status.toLowerCase()}`;
    item.innerHTML = `
      <span class="log-time">${log.timestamp}</span>
      <span class="log-route">${escapeHTML(log.srcIp)} &rarr; ${escapeHTML(log.dstIp)}</span>
      <span class="log-tag tag-${log.status.toLowerCase()}">${log.status}</span>
      <span class="log-cve">${escapeHTML(log.cve)}</span>
      <span class="log-detail">${escapeHTML(log.details)}</span>
    `;
    containerJumpLogs.prepend(item);
    while (containerJumpLogs.children.length > 30) {
      containerJumpLogs.removeChild(containerJumpLogs.lastChild);
    }
  };

  // 7. Node Selected in Canvas Inspector
  network.onNodeSelected = (node) => {
    populateInspector(node);
    if (drawerInspector) drawerInspector.classList.add('open');
  };

  function populateInspector(node) {
    if (!node) return;
    if (inspHostname) inspHostname.textContent = node.hostname;
    if (inspIp)       inspIp.textContent = node.ip;
    if (inspType)     inspType.textContent = node.deviceType.toUpperCase();
    if (inspOs)       inspOs.textContent = node.os;
    if (inspSubnet)   inspSubnet.textContent = node.subnet;

    if (inspStatus) {
      inspStatus.textContent = node.state.toUpperCase();
      inspStatus.className = `status-badge ${node.state}`;
    }

    if (inspPayload) inspPayload.textContent = node.payloadStatus || 'Clean';

    if (inspCves) {
      inspCves.innerHTML = node.cves.map(c => `<span class="cve-pill">${escapeHTML(c)}</span>`).join('');
    }

    if (inspLogs) {
      inspLogs.innerHTML = node.logs.map(l => `<div class="insp-log-entry">${escapeHTML(l)}</div>`).join('');
    }

    if (btnInspIsolate) {
      btnInspIsolate.textContent = node.shieldActive ? 'Disable Firewall Shield' : 'Engage Zero-Trust Shield';
    }
  }

  // 8. Inspector Action Buttons
  if (btnCloseInspector) {
    btnCloseInspector.addEventListener('click', () => {
      drawerInspector.classList.remove('open');
      network.selectedNode = null;
    });
  }

  if (btnInspPatch) {
    btnInspPatch.addEventListener('click', () => {
      if (network.selectedNode) {
        network.selectedNode.state = 'patched';
        network.selectedNode.shieldActive = true;
        network.selectedNode.payloadStatus = 'Remediated & Patched';
        network.selectedNode.logs.unshift(`[MANUAL] Sysadmin pushed emergency hotfix.`);
        network.spawnBurst(network.selectedNode.x, network.selectedNode.y, '#06b6d4', 16);
        if (window.soundFX) window.soundFX.playPatched();
        populateInspector(network.selectedNode);
        updateUI();
      }
    });
  }

  if (btnInspInfect) {
    btnInspInfect.addEventListener('click', () => {
      if (network.selectedNode) {
        simulation.infectPatientZero(network.selectedNode.id);
        populateInspector(network.selectedNode);
        updateUI();
      }
    });
  }

  if (btnInspIsolate) {
    btnInspIsolate.addEventListener('click', () => {
      if (network.selectedNode) {
        network.selectedNode.shieldActive = !network.selectedNode.shieldActive;
        network.selectedNode.logs.unshift(`[FIREWALL] Shield status changed to: ${network.selectedNode.shieldActive ? 'ENGAGED' : 'DISENGAGED'}`);
        populateInspector(network.selectedNode);
        if (window.soundFX) window.soundFX.playClick();
      }
    });
  }

  // 9. Simulation Controls Event Listeners
  if (btnPlay) {
    btnPlay.addEventListener('click', () => {
      const isRunning = simulation.togglePlay();
      btnPlay.innerHTML = isRunning
        ? `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause Outbreak`
        : `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Launch Simulation`;
      btnPlay.classList.toggle('playing', isRunning);
    });
  }

  if (btnStep) {
    btnStep.addEventListener('click', () => {
      simulation.stepDay();
      if (window.soundFX) window.soundFX.playClick();
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      simulation.resetSimulation();
      if (btnPlay) {
        btnPlay.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Launch Simulation`;
        btnPlay.classList.remove('playing');
      }
      if (containerJumpLogs) containerJumpLogs.innerHTML = '';
      if (containerBulletins) containerBulletins.innerHTML = '';
      updateUI();
      if (window.soundFX) window.soundFX.playClick();
    });
  }

  if (btnUpdateDaily) {
    btnUpdateDaily.addEventListener('click', () => {
      simulation.installDailyUpdatesManually();
      btnUpdateDaily.classList.add('updating');
      setTimeout(() => btnUpdateDaily.classList.remove('updating'), 500);
    });
  }

  if (checkAutoUpdate) {
    checkAutoUpdate.addEventListener('change', (e) => {
      simulation.autoDailyUpdates = e.target.checked;
    });
  }

  // Speed controls
  speedBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      speedBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const spd = parseFloat(btn.dataset.speed || 1);
      simulation.setSpeed(spd);
      if (window.soundFX) window.soundFX.playClick();
    });
  });

  // Malware selector dropdown
  if (selMalware) {
    selMalware.addEventListener('change', (e) => {
      const confirmReset = confirm("Selecting a new threat will reset the current simulation to a clean state. Proceed?");
      if (!confirmReset) {
        // Revert selection to current malware
        if (simulation.activeMalware) {
          selMalware.value = simulation.activeMalware.id;
        }
        return;
      }
      simulation.setMalware(e.target.value);
      simulation.resetSimulation();
      if (btnPlay) {
        btnPlay.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Launch Simulation`;
        btnPlay.classList.remove('playing');
      }
      if (containerJumpLogs) containerJumpLogs.innerHTML = '';
      if (containerBulletins) containerBulletins.innerHTML = '';
      updateUI();
      if (window.soundFX) window.soundFX.playClick();
    });
  }

  // Topology selector dropdown
  if (selTopology) {
    selTopology.addEventListener('change', (e) => {
      network.generateTopology(e.target.value, 75);
      simulation.resetSimulation();
      updateUI();
      if (window.soundFX) window.soundFX.playClick();
    });
  }

  // Sound toggle
  if (btnSound) {
    btnSound.addEventListener('click', () => {
      if (window.soundFX) {
        window.soundFX.init();
        const isMuted = window.soundFX.toggleMute();
        btnSound.innerHTML = isMuted
          ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/></svg> Muted`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg> Audio ON`;
        btnSound.classList.toggle('muted', isMuted);
      }
    });
  }

  // 10. Threat Intelligence Database Modal
  function renderDatabaseCatalog(filterCategory = 'all', searchQuery = '') {
    if (!dbCatalogList || !window.MalwareDatabase) return;
    dbCatalogList.innerHTML = '';

    const q = searchQuery.toLowerCase().trim();
    const filtered = window.MalwareDatabase.filter(m => {
      const matchCat = filterCategory === 'all' || m.category === filterCategory;
      const matchSearch = !q || m.name.toLowerCase().includes(q) ||
                                m.type.toLowerCase().includes(q) ||
                                m.vector.toLowerCase().includes(q) ||
                                m.cve.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });

    filtered.forEach(m => {
      const card = document.createElement('div');
      card.className = `db-card ${m.category}`;
      const sourceTag = m._source === 'CISA_KEV' ? `<span class="db-source-tag kev">CISA KEV</span>` :
                        m._source === 'SIMULATED' ? `<span class="db-source-tag sim">SIMULATED</span>` : '';
      card.innerHTML = `
        <div class="db-card-header">
          <div class="db-title-row">
            <h4 class="db-name">${escapeHTML(m.name)}</h4>
            <span class="db-badge sev-${m.severity.toLowerCase()}">${m.severity}</span>
            ${sourceTag}
          </div>
          <div class="db-type-meta">${escapeHTML(m.type)} &bull; ${m.year} &bull; ${escapeHTML(m.origin)}</div>
        </div>
        <div class="db-stats-grid">
          <div class="db-stat-cell">
            <span class="stat-label">BASIC R0</span>
            <span class="stat-val red">${m.r0}</span>
          </div>
          <div class="db-stat-cell">
            <span class="stat-label">STEALTH</span>
            <span class="stat-val cyan">${m.stealth}/10</span>
          </div>
          <div class="db-stat-cell">
            <span class="stat-label">LETHALITY</span>
            <span class="stat-val purple">${m.lethality}/10</span>
          </div>
          <div class="db-stat-cell">
            <span class="stat-label">MUTATION</span>
            <span class="stat-val amber">${Math.round(m.mutationRate * 100)}%</span>
          </div>
        </div>
        <div class="db-detail-field">
          <strong>Primary Vector:</strong> ${escapeHTML(m.vector)}
        </div>
        <div class="db-detail-field">
          <strong>Vulnerability:</strong> <code>${escapeHTML(m.cve)}</code>
        </div>
        <div class="db-detail-field">
          <strong>MITRE ATT&amp;CK Mapping:</strong> <span class="mitre-tag">${getMitreMapping(m.category)}</span>
        </div>
        <p class="db-desc">${escapeHTML(m.description)}</p>
        <p class="db-impact"><strong>Real-world Impact:</strong> ${escapeHTML(m.realWorldImpact)}</p>
        <button class="btn-deploy-malware" data-id="${m.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:4px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          Deploy to Network
        </button>
        <button class="btn-edit-malware" data-id="${m.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:4px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit & Fork
        </button>
      `;

      const deployBtn = card.querySelector('.btn-deploy-malware');
      deployBtn.addEventListener('click', () => {
        simulation.setMalware(m.id);
        rebuildMalwareSelector(m.id);
        modalDatabase.classList.remove('open');
        updateUI();
        if (window.soundFX) window.soundFX.playEmergency();
      });

      const editBtn = card.querySelector('.btn-edit-malware');
      editBtn.addEventListener('click', () => {
        modalDatabase.classList.remove('open');
        modalCustomZeroDay.classList.add('open');
        
        // Populate the Zero Day form with this malware's stats
        document.getElementById('zd-name').value = m.name.includes('(Edited)') ? m.name : `${m.name} (Edited)`;
        document.getElementById('zd-category').value = m.category || 'worm';
        document.getElementById('zd-r0').value = m.r0;
        document.getElementById('zd-vector').value = m.vector;
        document.getElementById('zd-stealth').value = m.stealth;
        document.getElementById('zd-lethality').value = m.lethality;
        
        const aff = m.targetAffinities || {};
        document.getElementById('zd-aff-pc').checked = aff.desktop >= 0.5;
        document.getElementById('zd-aff-laptop').checked = aff.laptop >= 0.5;
        document.getElementById('zd-aff-phone').checked = aff.phone >= 0.5;
        document.getElementById('zd-aff-server').checked = aff.server >= 0.5;
        document.getElementById('zd-aff-iot').checked = aff.iot >= 0.5;
        document.getElementById('zd-aff-scada').checked = aff.scada >= 0.5;
        document.getElementById('zd-aff-medical').checked = aff.medical >= 0.5;
      });

      dbCatalogList.appendChild(card);
    });

    if (filtered.length === 0) {
      dbCatalogList.innerHTML = `<div style="color:var(--text-dim);text-align:center;padding:40px;font-family:var(--font-mono);font-size:0.8rem;">No threats match your search.</div>`;
    }
  }

  function getMitreMapping(category) {
    const mappings = {
      ransomware: 'TA0040 (Impact) - T1486 (Data Encrypted for Impact)',
      worm: 'TA0008 (Lateral Movement) - T1210 (Exploitation of Remote Services)',
      botnet: 'TA0011 (Command and Control) - T1071 (Application Layer Protocol)',
      spyware: 'TA0009 (Collection) - T1113 (Screen Capture)',
      scada: 'TA0103 (Impact - ICS) - T0814 (Inhibit Response Function)',
      supplychain: 'TA0001 (Initial Access) - T1195 (Supply Chain Compromise)',
      trojan: 'TA0003 (Persistence) - T1547 (Boot or Logon Autostart Execution)'
    };
    return mappings[category] || 'TA0040 (Impact)';
  }

  if (btnOpenDatabase && modalDatabase) {
    btnOpenDatabase.addEventListener('click', () => {
      renderDatabaseCatalog();
      modalDatabase.classList.add('open');
      if (window.soundFX) window.soundFX.playClick();
    });
  }

  if (btnCloseDatabase && modalDatabase) {
    btnCloseDatabase.addEventListener('click', () => {
      modalDatabase.classList.remove('open');
    });
  }

  dbCategoryFilters.forEach(btn => {
    btn.addEventListener('click', () => {
      dbCategoryFilters.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderDatabaseCatalog(btn.dataset.category, dbSearchInput ? dbSearchInput.value : '');
    });
  });

  if (dbSearchInput) {
    dbSearchInput.addEventListener('input', (e) => {
      const activeFilter = document.querySelector('.db-filter-btn.active');
      const cat = activeFilter ? activeFilter.dataset.category : 'all';
      renderDatabaseCatalog(cat, e.target.value);
    });
  }

  // 11. Custom Zero-Day Creator Modal
  if (btnOpenZeroDay && modalCustomZeroDay) {
    btnOpenZeroDay.addEventListener('click', () => {
      modalCustomZeroDay.classList.add('open');
      if (window.soundFX) window.soundFX.playClick();
    });
  }

  if (btnCloseZeroDay && modalCustomZeroDay) {
    btnCloseZeroDay.addEventListener('click', () => {
      modalCustomZeroDay.classList.remove('open');
    });
  }

  if (formZeroDay) {
    formZeroDay.addEventListener('submit', (e) => {
      e.preventDefault();
      const name      = document.getElementById('zd-name').value || 'Zero-Day Variant X';
      const category  = document.getElementById('zd-category').value || 'worm';
      const r0        = parseFloat(document.getElementById('zd-r0').value) || 4.5;
      const stealth   = parseInt(document.getElementById('zd-stealth').value) || 7;
      const lethality = parseInt(document.getElementById('zd-lethality').value) || 8;
      const vector    = document.getElementById('zd-vector').value || 'Unknown Zero-Day Exploit';

      const affinities = {
        desktop : document.getElementById('zd-aff-pc').checked ? 0.95 : 0.1,
        laptop  : document.getElementById('zd-aff-laptop').checked ? 0.95 : 0.1,
        phone   : document.getElementById('zd-aff-phone').checked ? 0.95 : 0.05,
        server  : document.getElementById('zd-aff-server').checked ? 0.95 : 0.1,
        iot     : document.getElementById('zd-aff-iot').checked ? 0.95 : 0.05,
        scada   : document.getElementById('zd-aff-scada').checked ? 0.95 : 0.0,
        medical : document.getElementById('zd-aff-medical').checked ? 0.90 : 0.05,
        router  : 0.5
      };

      const customStrain = {
        id          : `custom-${Date.now()}`,
        name,
        type        : `Custom Synthesized ${category.toUpperCase()}`,
        category,
        year        : new Date().getFullYear(),
        origin      : 'User Laboratory Synthesis',
        severity    : 'CRITICAL',
        cve         : `CVE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        vector,
        r0,
        transmissionRate : Math.min(0.95, r0 * 0.12),
        patchDifficulty  : 0.65,
        stealth,
        lethality,
        mutationRate : 0.40,
        airgapHop    : 0.10,
        targetAffinities : affinities,
        realWorldImpact  : 'Experimental laboratory payload synthesized for stress-testing network topology defenses.',
        description  : `Synthetic malware designed with R0 of ${r0} leveraging ${vector}.`
      };

      window.MalwareDatabase.unshift(customStrain);
      rebuildMalwareSelector(customStrain.id);
      simulation.setMalware(customStrain.id);
      modalCustomZeroDay.classList.remove('open');
      updateUI();
      if (window.soundFX) window.soundFX.playEmergency();
    });
  }

  // ──────────────────────────────────────────────
  //  12. Live Threat Feed Modal
  // ──────────────────────────────────────────────

  let feedCurrentEntries = [];

  function updateFeedMetaUI() {
    if (feedLastSync) feedLastSync.textContent = threatFeed.getLastFetchTime();
    const nextMs = threatFeed.getNextFetchMs();
    if (feedNextSync) {
      const hrs = Math.floor(nextMs / 3600000);
      const mins = Math.floor((nextMs % 3600000) / 60000);
      feedNextSync.textContent = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
    }
  }

  function setFeedStatus(msg, type = 'info') {
    if (!feedStatusBar || !feedStatusText) return;
    feedStatusBar.className = `feed-status-bar ${type}`;
    feedStatusText.textContent = msg;
    if (type === 'info' && msg.includes('Connecting')) {
      feedStatusBar.classList.add('loading');
    } else {
      feedStatusBar.classList.remove('loading');
    }
  }

  function renderFeedEntries(entries, searchQ = '') {
    if (!feedEntriesGrid) return;
    feedCurrentEntries = entries;

    const q = searchQ.toLowerCase().trim();
    const filtered = q ? entries.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.cve.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      (e.vector || '').toLowerCase().includes(q)
    ) : entries;

    const newCount = filtered.filter(e => !threatFeed.importedIds.has(e.id)).length;

    if (feedCountTotal) feedCountTotal.textContent = filtered.length;
    if (feedCountNew)   feedCountNew.textContent   = `${newCount} new`;
    if (btnImportAll)   btnImportAll.disabled = newCount === 0;

    // Update header badge
    const totalNew = entries.filter(e => !threatFeed.importedIds.has(e.id)).length;
    if (feedBadge) {
      feedBadge.textContent = totalNew;
      feedBadge.style.display = totalNew > 0 ? 'inline-flex' : 'none';
    }

    if (filtered.length === 0) {
      feedEntriesGrid.innerHTML = `<div class="feed-empty-state"><p>No entries match your filter.</p></div>`;
      return;
    }

    feedEntriesGrid.innerHTML = '';
    filtered.forEach(entry => {
      const isImported = threatFeed.importedIds.has(entry.id);
      const isNew = entry._isNew && !isImported;
      const sourceLabel = entry._source === 'CISA_KEV' ? 'CISA KEV' : entry._source === 'SIMULATED' ? 'SIMULATED INTEL' : 'LOCAL DB';
      const sourceClass = entry._source === 'CISA_KEV' ? 'kev' : entry._source === 'SIMULATED' ? 'sim' : '';

      const card = document.createElement('div');
      card.className = `feed-entry-card ${isNew ? 'is-new' : ''} ${isImported ? 'is-imported' : ''}`;

      const sevColor = entry.severity === 'CRITICAL' ? '#ef4444' : entry.severity === 'HIGH' ? '#f59e0b' : '#10b981';

      card.innerHTML = `
        <div class="feed-entry-header">
          <div class="feed-entry-title-row">
            ${isNew ? '<span class="feed-new-tag">NEW</span>' : ''}
            <span class="feed-entry-name">${escapeHTML(entry.name.slice(0, 55))}</span>
          </div>
          <div class="feed-entry-meta">
            <span class="feed-entry-source ${sourceClass}">${sourceLabel}</span>
            <span class="feed-entry-sev" style="color:${sevColor};">${entry.severity}</span>
            <span class="feed-entry-year">${entry.year}</span>
          </div>
        </div>
        <div class="feed-entry-cve">${escapeHTML(entry.cve)}</div>
        <div class="feed-entry-vector">${escapeHTML((entry.vector || '').slice(0, 80))}</div>
        <div class="feed-entry-stats">
          <span class="feed-stat">R0 <strong style="color:#f59e0b">${entry.r0}</strong></span>
          <span class="feed-stat">Stealth <strong style="color:#38bdf8">${entry.stealth}/10</strong></span>
          <span class="feed-stat">Lethality <strong style="color:#a855f7">${entry.lethality}/10</strong></span>
          <span class="feed-stat">Mutation <strong style="color:#f59e0b">${Math.round(entry.mutationRate * 100)}%</strong></span>
        </div>
        <p class="feed-entry-desc">${escapeHTML((entry.description || '').slice(0, 120))}...</p>
        ${entry._dateAdded ? `<div class="feed-entry-date">Added to KEV: ${entry._dateAdded}${entry._dueDate ? ` | Due: ${entry._dueDate}` : ''}</div>` : ''}
        <div class="feed-entry-actions">
          <button class="btn-feed-import ${isImported ? 'imported' : ''}" data-id="${entry.id}" ${isImported ? 'disabled' : ''}>
            ${isImported
              ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><polyline points="20 6 9 17 4 12"/></svg> Imported`
              : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Import to DB`
            }
          </button>
          <button class="btn-feed-deploy" data-id="${entry.id}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            Deploy Now
          </button>
        </div>
      `;

      // Import button
      const importBtn = card.querySelector('.btn-feed-import');
      if (importBtn && !isImported) {
        importBtn.addEventListener('click', () => {
          if (threatFeed.importEntry(entry.id)) {
            rebuildMalwareSelector();
            renderFeedEntries(feedCurrentEntries, feedSearch ? feedSearch.value : '');
            setFeedStatus(`✓ ${entry.name.slice(0, 40)} added to threat database.`, 'success');
          }
        });
      }

      // Deploy button — import + immediately set active
      const deployBtn = card.querySelector('.btn-feed-deploy');
      if (deployBtn) {
        deployBtn.addEventListener('click', () => {
          if (!threatFeed.importedIds.has(entry.id)) {
            threatFeed.importEntry(entry.id);
          }
          simulation.setMalware(entry.id);
          rebuildMalwareSelector(entry.id);
          modalThreatFeed.classList.remove('open');
          updateUI();
          setFeedStatus('', 'info');
          if (window.soundFX) window.soundFX.playEmergency();
        });
      }

      feedEntriesGrid.appendChild(card);
    });
  }

  // Threat feed callbacks
  threatFeed.onStatusChange = (msg, type) => {
    setFeedStatus(msg, type);
    if (type === 'success') {
      // Show badge on header button
      const newCount = threatFeed.pendingEntries.filter(e => !threatFeed.importedIds.has(e.id)).length;
      if (feedBadge && newCount > 0) {
        feedBadge.textContent = newCount;
        feedBadge.style.display = 'inline-flex';
      }
    }
    updateFeedMetaUI();
  };

  threatFeed.onNewThreats = (entries) => {
    renderFeedEntries(entries, feedSearch ? feedSearch.value : '');
    updateFeedMetaUI();
    if (btnFetchNow) {
      btnFetchNow.disabled = false;
      btnFetchNow.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> Fetch Latest Now`;
    }
  };

  if (btnOpenThreatFeed && modalThreatFeed) {
    btnOpenThreatFeed.addEventListener('click', () => {
      modalThreatFeed.classList.add('open');
      updateFeedMetaUI();
      if (feedCurrentEntries.length === 0 && threatFeed.pendingEntries.length > 0) {
        renderFeedEntries(threatFeed.pendingEntries);
      }
      if (window.soundFX) window.soundFX.playClick();
    });
  }

  if (btnCloseThreatFeed && modalThreatFeed) {
    btnCloseThreatFeed.addEventListener('click', () => {
      modalThreatFeed.classList.remove('open');
    });
  }

  if (btnFetchNow) {
    btnFetchNow.addEventListener('click', async () => {
      btnFetchNow.disabled = true;
      btnFetchNow.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;animation:spin 1s linear infinite"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> Fetching...`;
      await threatFeed.fetchNow();
    });
  }

  if (btnImportAll) {
    btnImportAll.addEventListener('click', () => {
      const count = threatFeed.importAll();
      rebuildMalwareSelector();
      renderFeedEntries(threatFeed.pendingEntries, feedSearch ? feedSearch.value : '');
      setFeedStatus(`✓ Bulk import complete: ${count} new threats added to your active database.`, 'success');
    });
  }

  if (feedSearch) {
    feedSearch.addEventListener('input', (e) => {
      if (threatFeed.pendingEntries.length > 0) {
        renderFeedEntries(threatFeed.pendingEntries, e.target.value);
      }
    });
  }

  // Close modals on overlay click
  [modalDatabase, modalCustomZeroDay, modalThreatFeed].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('open');
      });
    }
  });

  // ──────────────────────────────────────────────
  //  13. PDF Report Generation
  // ──────────────────────────────────────────────

  function showToast(msg, duration = 3000) {
    if (!reportToast || !reportToastText) return;
    reportToastText.textContent = msg;
    reportToast.style.display = 'flex';
    reportToast.classList.add('visible');
    setTimeout(() => {
      reportToast.classList.remove('visible');
      setTimeout(() => { reportToast.style.display = 'none'; }, 400);
    }, duration);
  }

  if (btnGenerateReport) {
    btnGenerateReport.addEventListener('click', () => {
      if (simulation.isRunning) {
        alert("Please pause or wait for the simulation to finish before downloading the report.");
        return;
      }
      showToast('Generating PDF report…', 5000);
      btnGenerateReport.disabled = true;

      // Defer to next tick so toast renders first
      setTimeout(() => {
        try {
          const stats = simulation.getStats();
          reporter.generate(simulation, network, stats);
          showToast(`✓ Report downloaded: ${simulation.activeMalware.name.slice(0, 30)}`, 3000);
        } catch (err) {
          console.error('PDF generation failed:', err);
          showToast('PDF generation failed. Check console.', 3000);
        } finally {
          btnGenerateReport.disabled = false;
        }
      }, 80);
    });
  }

  if (btnExportLogs) {
    btnExportLogs.addEventListener('click', () => {
      const exportData = {
        timestamp: new Date().toISOString(),
        malware: simulation.activeMalware,
        stats: simulation.getStats(),
        history: simulation.history,
        events: []
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cyberoutbreak-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      showToast('✓ Raw Telemetry Logs Exported (JSON)', 3000);
    });
  }

  // Helper escape
  function escapeHTML(str) {
    if (!str) return '';
    return str.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initial draw
  updateUI();
});
