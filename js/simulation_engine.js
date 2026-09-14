// CyberOutbreak Epidemiological Spread & Daily Update Engine

class SimulationEngine {
  constructor(networkEngine, malwareDatabase) {
    this.network = networkEngine;
    this.database = malwareDatabase;
    this.activeMalware = malwareDatabase[0]; // WannaCry default
    this.currentDay = 1;
    this.isRunning = false;
    this.speed = 1; // 1x, 2x, 5x, 10x
    this.tickInterval = null;
    this.baseTickMs = 1800; // ms per simulated day at 1x
    this.autoDailyUpdates = true;
    this.alertFeed = [];
    this.jumpLogs = [];
    this.history = []; // [{ day, s, e, i, r, r0, damage }]
    this.totalAccumulatedDamage = 0; // Persists across malware switches
    this.phaseLog = []; // Tracks each malware phase for PDF reporting

    this.onTick = null;
    this.onAlert = null;
    this.onJumpLog = null;
    // NOTE: initDefaultState() is called by the app orchestrator after construction
    //       to avoid double-initialization and duplicate Day-1 history entries.
  }

  initDefaultState() {
    this.currentDay = 1;
    this.history = [];
    this.alertFeed = [];
    this.jumpLogs = [];

    // Add Day 1 initial alert
    this.addAlert({
      day: 1,
      level: 'critical',
      title: `Outbreak Detected: ${this.activeMalware.name}`,
      text: `Patient zero identified. Vector: ${this.activeMalware.vector}. Baseline R0 estimated at ${this.activeMalware.r0}.`
    });

    this.recordHistory();
  }

  setMalware(malwareId) {
    const found = this.database.find(m => m.id === malwareId);
    if (found) {
      // Log this as a new phase — continue from current day
      this.phaseLog.push({
        malware: this.activeMalware.name,
        startDay: this.phaseLog.length === 0 ? 1 : this.phaseLog[this.phaseLog.length - 1].endDay,
        endDay: this.currentDay
      });
      this.activeMalware = found;
      // Do NOT reset day or damage — simulation continues, new virus is introduced
      this.addAlert({
        day: this.currentDay,
        level: 'warning',
        title: `New Threat Payload Activated: ${found.name}`,
        text: `Active threat switched to ${found.type}. Continuing from Day ${this.currentDay}. Existing infected nodes now carry the new payload. Accumulated damage preserved.`
      });
    }
  }

  // Plant patient zero in the network
  infectPatientZero(nodeId = null) {
    let target = null;
    if (nodeId) {
      target = this.network.nodes.find(n => n.id === nodeId);
    }

    if (!target) {
      // Find a device with high affinity for this malware
      const affinities = this.activeMalware.targetAffinities || {};
      const candidates = this.network.nodes.filter(n => (affinities[n.deviceType] || 0.1) >= 0.5);
      target = candidates.length > 0
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : this.network.nodes[Math.floor(Math.random() * this.network.nodes.length)];
    }

    if (target) {
      target.state = 'infected';
      target.infectionProgress = 1.0;
      target.compromiseType = this.activeMalware.id;
      target.payloadStatus = `Infected: ${this.activeMalware.name}`;
      target.logs.unshift(`[ALERT] Patient Zero breached via ${this.activeMalware.vector}`);

      this.network.spawnBurst(target.x, target.y, '#ef4444', 20);
      if (window.soundFX) window.soundFX.playInfection();

      this.logJump({
        timestamp: new Date().toLocaleTimeString(),
        srcIp: 'External / Internet',
        dstIp: target.ip,
        srcHost: 'APT29 / ShadowBrokers C2',
        dstHost: target.hostname,
        deviceType: target.deviceType,
        status: 'SUCCESS',
        cve: this.activeMalware.cve,
        details: `Initial compromise of ${target.deviceType} via ${this.activeMalware.vector}`
      });
    }
  }

  // Record historical metrics for epidemic curve graphs
  recordHistory() {
    const stats = this.getStats();
    // Calculate raw damage this tick and accumulate
    const damagePerNode = this.activeMalware.category === 'ransomware' ? 12000 :
                          this.activeMalware.category === 'scada' ? 35000 : 4500;
    const tickDamage = (stats.infected + stats.compromised) * damagePerNode;
    this.totalAccumulatedDamage = Math.max(this.totalAccumulatedDamage, tickDamage);

    this.history.push({
      day: this.currentDay,
      s: stats.susceptible,
      e: stats.exposed,
      i: stats.infected,
      r: stats.patched,
      r0: stats.currentR0,
      damage: this.totalAccumulatedDamage
    });
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    if (window.soundFX) window.soundFX.init();

    // Check if any infected node exists; if not, infect patient zero
    const infectedCount = this.network.nodes.filter(n => n.state === 'infected' || n.state === 'compromised').length;
    if (infectedCount === 0) {
      this.infectPatientZero();
    }

    this.scheduleNextTick();
  }

  pause() {
    this.isRunning = false;
    if (this.tickInterval) {
      clearTimeout(this.tickInterval);
      this.tickInterval = null;
    }
  }

  togglePlay() {
    if (this.isRunning) {
      this.pause();
    } else {
      this.start();
    }
    return this.isRunning;
  }

  setSpeed(speedMultiplier) {
    this.speed = speedMultiplier;
    if (this.isRunning) {
      this.pause();
      this.start();
    }
  }

  scheduleNextTick() {
    if (!this.isRunning) return;
    const interval = Math.max(250, this.baseTickMs / this.speed);
    this.tickInterval = setTimeout(() => {
      this.stepDay();
      if (this.isRunning) {
        this.scheduleNextTick();
      }
    }, interval);
  }

  // Advance simulation by 1 Day
  stepDay() {
    this.currentDay++;

    // Execute infection jump sequences
    this.simulateJumpSequences();

    // Execute automated daily patch rollouts / AV updates
    if (this.autoDailyUpdates) {
      this.simulateDailyUpdates();
    }

    // Check random variant mutations or security bulletins
    this.simulateDailyBulletins();

    // Record metrics
    this.recordHistory();

    if (this.onTick) this.onTick(this.getStats());
  }

  // Simulate viral propagation jumps
  simulateJumpSequences() {
    const infectedNodes = this.network.nodes.filter(n => n.state === 'infected');
    const malware = this.activeMalware;
    const affinities = malware.targetAffinities || {};

    let newInfectionsCount = 0;

    infectedNodes.forEach(source => {
      // Find possible targets: connected neighbors first, then subnet peers, then random WAN scan
      const neighbors = this.network.links
        .filter(l => l.source === source || l.target === source)
        .map(l => l.source === source ? l.target : l.source);

      // Potential targets can also be random nodes in the same subnet (subnet broadcast)
      const subnetPeers = this.network.nodes.filter(n => n.subnet === source.subnet && n !== source);

      const candidatePool = [...new Set([...neighbors, ...subnetPeers])];

      // Number of jump attempts per infected device this tick
      const attempts = Math.floor(1 + Math.random() * (malware.r0 > 4 ? 3 : 2));

      for (let a = 0; a < attempts; a++) {
        let target = candidatePool[Math.floor(Math.random() * candidatePool.length)];

        // Occasional WAN jump across subnets
        if (!target || Math.random() < 0.20) {
          const allSusceptible = this.network.nodes.filter(n => n.state === 'susceptible' || n.state === 'exposed');
          if (allSusceptible.length > 0) {
            target = allSusceptible[Math.floor(Math.random() * allSusceptible.length)];
          }
        }

        if (!target || target === source) continue;

        // Affinity modifier based on target device type
        const deviceAffinity = affinities[target.deviceType] !== undefined ? affinities[target.deviceType] : 0.5;

        // Skip if immune or already infected
        if (target.state === 'patched' || target.state === 'compromised' || target.state === 'infected') {
          continue;
        }

        // Check if blocked by active firewall shield or patch
        const isShielded = target.shieldActive && Math.random() < 0.70;

        if (isShielded) {
          // Shield blocked
          this.network.spawnJump(source, target, 'blocked', malware.name);
          this.logJump({
            timestamp: new Date().toLocaleTimeString(),
            srcIp: source.ip,
            dstIp: target.ip,
            srcHost: source.hostname,
            dstHost: target.hostname,
            deviceType: target.deviceType,
            status: 'BLOCKED',
            cve: malware.cve,
            details: `Firewall/EDR dropped lateral probe from ${source.ip}`
          });
        } else {
          // Successful jump exploit!
          const transmissionProb = malware.transmissionRate * deviceAffinity;
          if (Math.random() < transmissionProb) {
            this.network.spawnJump(source, target, 'exploit', malware.name);
            target.state = 'infected';
            target.infectionProgress = 1.0;
            target.compromiseType = malware.id;
            target.payloadStatus = `Compromised by ${malware.name}`;
            target.logs.unshift(`[EXPLOIT] Infiltrated by ${source.ip} via ${malware.cve}`);
            newInfectionsCount++;

            this.logJump({
              timestamp: new Date().toLocaleTimeString(),
              srcIp: source.ip,
              dstIp: target.ip,
              srcHost: source.hostname,
              dstHost: target.hostname,
              deviceType: target.deviceType,
              status: 'EXPLOITED',
              cve: malware.cve,
              details: `Lateral jump successful: ${malware.name} payload delivered`
            });
          } else {
            // Probed but not infected
            this.network.spawnJump(source, target, 'probe', malware.name);
          }
        }
      }

      // If ransomware, transition older infected to compromised/locked
      if (malware.category === 'ransomware' && Math.random() < 0.25) {
        source.state = 'compromised';
        source.payloadStatus = 'FILES ENCRYPTED (AES-256)';
        source.logs.unshift(`[RANSOM] MFT encrypted. Demanding Bitcoin ransom.`);
      }
    });
  }

  // Install daily updates: rollout antivirus definitions, OS patches, and remediation
  simulateDailyUpdates() {
    // When outbreak has persisted for a few days, vendor patches accelerate
    const patchPower = Math.min(0.85, 0.15 + (this.currentDay * 0.04));
    const infectedOrSusceptible = this.network.nodes.filter(n => n.state === 'infected' || n.state === 'susceptible');

    const patchCount = Math.floor(1 + Math.random() * (patchPower * 4));

    for (let i = 0; i < patchCount; i++) {
      if (infectedOrSusceptible.length === 0) break;
      const targetIdx = Math.floor(Math.random() * infectedOrSusceptible.length);
      const target = infectedOrSusceptible.splice(targetIdx, 1)[0];

      if (target && target.state !== 'patched') {
        const wasInfected = target.state === 'infected';
        target.state = 'patched';
        target.shieldActive = true;
        target.payloadStatus = 'Secure (Patched & Immunized)';
        target.logs.unshift(`[PATCH] KB-Update applied. CVE vulnerability mitigated.`);

        this.network.spawnBurst(target.x, target.y, '#06b6d4', 12);
        if (window.soundFX && Math.random() < 0.3) {
          window.soundFX.playPatched();
        }

        if (wasInfected) {
          this.logJump({
            timestamp: new Date().toLocaleTimeString(),
            srcIp: 'Patch Server / WSUS',
            dstIp: target.ip,
            srcHost: 'sec-update.vendor.org',
            dstHost: target.hostname,
            deviceType: target.deviceType,
            status: 'PATCHED',
            cve: 'DEF-SIGNATURE-ROLLOUT',
            details: `Remediated infection on ${target.hostname}. EDR signature applied.`
          });
        }
      }
    }
  }

  // Manual trigger: User clicks "Install Daily Updates" button
  installDailyUpdatesManually() {
    this.simulateDailyUpdates();
    this.addAlert({
      day: this.currentDay,
      level: 'success',
      title: 'Manual Daily Security Update Deployed',
      text: 'Global sysadmins pushed out-of-band hotfixes, zero-day signatures, and updated endpoint detection heuristics.'
    });
    if (window.soundFX) window.soundFX.playPatched();
    this.recordHistory();
    if (this.onTick) this.onTick(this.getStats());
  }

  simulateDailyBulletins() {
    // Periodic narrative threat bulletins
    if (this.currentDay === 3) {
      this.addAlert({
        day: 3,
        level: 'danger',
        title: 'High Velocity Propagation Alert',
        text: `Spread index spikes across corporate LAN. Exploit payloads actively targeting unpatched SMB and RDP endpoints.`
      });
    } else if (this.currentDay === 7) {
      this.addAlert({
        day: 7,
        level: 'warning',
        title: 'Polymorphic Variant Mutated',
        text: `Threat actors recompiled payload with randomized hash signatures. Antivirus evasion reported in Dev LAN.`
      });
    } else if (this.currentDay === 12) {
      this.addAlert({
        day: 12,
        level: 'info',
        title: 'Zero-Trust Network Segmentation Implemented',
        text: `Inter-subnet isolation rules enacted. Lateral hopping probability drastically reduced.`
      });
    } else if (this.currentDay % 5 === 0 && Math.random() < 0.6) {
      const msgs = [
        `Global threat telemetry reports ${this.activeMalware.name} actively probed 45,000 external IP blocks.`,
        `CISA releases technical analysis report outlining IOCs (Indicators of Compromise) for ${this.activeMalware.cve}.`,
        `Managed detection & response (MDR) teams blackhole C2 domain infrastructure.`,
        `Automated heuristic behavioral detection catches covert process injection.`
      ];
      this.addAlert({
        day: this.currentDay,
        level: 'info',
        title: `Threat Intel Update (Day ${this.currentDay})`,
        text: msgs[Math.floor(Math.random() * msgs.length)]
      });
    }
  }

  addAlert(alert) {
    this.alertFeed.unshift({
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      day: alert.day || this.currentDay,
      time: new Date().toLocaleTimeString(),
      level: alert.level || 'info', // info, warning, danger, critical, success
      title: alert.title,
      text: alert.text
    });

    if (this.alertFeed.length > 50) this.alertFeed.pop();
    if (this.onAlert) this.onAlert(this.alertFeed[0]);
  }

  logJump(log) {
    this.jumpLogs.unshift(log);
    if (this.jumpLogs.length > 100) this.jumpLogs.pop();
    if (this.onJumpLog) this.onJumpLog(log);
  }

  resetSimulation() {
    this.pause();
    this.currentDay = 1;
    this.totalAccumulatedDamage = 0;
    this.phaseLog = [];
    this.network.nodes.forEach(n => {
      n.state = 'susceptible';
      n.infectionProgress = 0;
      n.compromiseType = null;
      n.payloadStatus = 'Clean';
      n.shieldActive = Math.random() < 0.20;
    });
    this.network.jumpPackets = [];
    this.network.particles = [];
    this.initDefaultState();
    if (this.onTick) this.onTick(this.getStats());
  }

  // Deep Data Analysis & Statistics
  getStats() {
    const total = this.network.nodes.length;
    let susceptible = 0;
    let exposed = 0;
    let infected = 0;
    let compromised = 0;
    let patched = 0;

    const byDevice = {
      desktop: { total: 0, infected: 0 },
      laptop: { total: 0, infected: 0 },
      phone: { total: 0, infected: 0 },
      server: { total: 0, infected: 0 },
      iot: { total: 0, infected: 0 },
      router: { total: 0, infected: 0 },
      scada: { total: 0, infected: 0 },
      medical: { total: 0, infected: 0 }
    };

    const bySubnet = {};

    this.network.nodes.forEach(n => {
      if (n.state === 'susceptible') susceptible++;
      else if (n.state === 'exposed') exposed++;
      else if (n.state === 'infected') infected++;
      else if (n.state === 'compromised') compromised++;
      else if (n.state === 'patched') patched++;

      if (byDevice[n.deviceType]) {
        byDevice[n.deviceType].total++;
        if (n.state === 'infected' || n.state === 'compromised') {
          byDevice[n.deviceType].infected++;
        }
      }

      if (!bySubnet[n.subnet]) {
        bySubnet[n.subnet] = { total: 0, infected: 0 };
      }
      bySubnet[n.subnet].total++;
      if (n.state === 'infected' || n.state === 'compromised') {
        bySubnet[n.subnet].infected++;
      }
    });

    // Dynamic R0 calculation:
    // Base R0 scaled by (susceptible / total) and damped by (patched / total)
    const rawR0 = this.activeMalware.r0 * (susceptible / (total || 1)) * (1 - (patched / (total || 1)) * 0.8);
    const effectiveR0 = Math.max(0.1, Math.min(this.activeMalware.r0, Number(rawR0.toFixed(2))));

    // Estimated Financial Damage ($USD) — use accumulated total if higher
    const damagePerNode = this.activeMalware.category === 'ransomware' ? 12000 :
                          this.activeMalware.category === 'scada' ? 35000 : 4500;
    const currentDamage = (infected + compromised) * damagePerNode;
    const finalDamage = Math.max(this.totalAccumulatedDamage, currentDamage);

    return {
      total,
      susceptible,
      exposed,
      infected,
      compromised,
      totalCompromised: infected + compromised,
      patched,
      currentR0: effectiveR0,
      currentDay: this.currentDay,
      infectionRate: total > 0 ? (((infected + compromised) / total) * 100).toFixed(1) : 0,
      immunityRate: total > 0 ? ((patched / total) * 100).toFixed(1) : 0,
      estimatedDamage: finalDamage.toLocaleString('en-US'),
      estimatedDamageRaw: finalDamage,
      byDevice,
      bySubnet
    };
  }
}

window.SimulationEngine = SimulationEngine;
