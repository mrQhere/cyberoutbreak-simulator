// CyberOutbreak Application Orchestrator & UI Controller
// Coordinates: SimulationEngine (pure core), NetworkEngine, ChartsEngine,
//              ThreatFeedEngine, ReportEngine, FailureInjector, and Replay System.

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // 1. Elements
  const canvasNetwork = document.getElementById('canvas-network');
  const canvasCurve   = document.getElementById('chart-curve');
  const canvasDonut   = document.getElementById('chart-donut');
  const canvasR0      = document.getElementById('chart-r0');
  const canvasDamage  = document.getElementById('chart-damages');

  if (!canvasNetwork) return;

  // 2. Initialize Pure Simulation Engine & Visualizers
  let currentSeed = 12345;
  let currentScenario = 'scenario-corporate-ransomware';

  const SimCore = window.SimCore || {};
  if (!SimCore.SimulationEngine) {
    console.error('SimCore.SimulationEngine not loaded! Check script tags.');
    return;
  }

  const simulation = new SimCore.SimulationEngine({
    seed: currentSeed,
    scenarioId: currentScenario,
    autoInit: true
  });
  window.simulation = simulation; // Exposed for testing & automated suites

  const network    = new NetworkEngine(canvasNetwork);
  window.network = network;
  network.bindNetworkModel(simulation.network);

  const charts     = new ChartsEngine(canvasCurve, canvasDonut, canvasR0, canvasDamage);
  const threatFeed = typeof ThreatFeedEngine !== 'undefined' ? new ThreatFeedEngine() : null;
  const reporter   = typeof ReportEngine !== 'undefined' ? new ReportEngine() : null;

  // 3. UI Controls
  const btnPlay             = document.getElementById('btn-play');
  const btnStep             = document.getElementById('btn-step');
  const btnReset            = document.getElementById('btn-reset');
  const btnUpdateDaily      = document.getElementById('btn-update-daily');
  const btnSound            = document.getElementById('btn-sound');
  const selScenario         = document.getElementById('select-scenario');
  const selMalware          = document.getElementById('select-malware');
  const selTopology         = document.getElementById('select-topology');
  const speedBtns           = document.querySelectorAll('.speed-btn');
  const checkAutoUpdate     = document.getElementById('check-auto-update');
  const inputSeed           = document.getElementById('input-seed');
  const btnRandomSeed       = document.getElementById('btn-random-seed');

  // Replay Elements
  const btnToggleReplay     = document.getElementById('btn-toggle-replay');
  const replayScrubberBox   = document.getElementById('replay-scrubber-box');
  const replaySlider        = document.getElementById('replay-slider');
  const replayTickVal       = document.getElementById('replay-tick-val');
  let isReplayMode          = false;

  // KPI Strip
  const elTotalDevices      = document.getElementById('kpi-total-devices');
  const elInfected          = document.getElementById('kpi-infected');
  const elInfectedPct       = document.getElementById('kpi-infected-pct');
  const elPatched           = document.getElementById('kpi-patched');
  const elPatchedPct        = document.getElementById('kpi-patched-pct');
  const elR0                = document.getElementById('kpi-r0');
  const elR0Status          = document.getElementById('kpi-r0-status');
  const elCurrentDay        = document.getElementById('kpi-current-day');
  const elDamage            = document.getElementById('kpi-damage');
  const elGlobalThreatBadge = document.getElementById('global-threat-badge');

  // Feeds & Banners
  const containerJumpLogs   = document.getElementById('jump-logs-container');
  const containerBulletins  = document.getElementById('bulletins-container');
  const pzNodeLabel         = document.getElementById('pz-node-label');
  const pzVectorLabel       = document.getElementById('pz-vector-label');
  const pzReasonLabel       = document.getElementById('pz-reason-label');
  const pzTickLabel         = document.getElementById('pz-tick-label');

  // Device Inspector Drawer
  const drawerInspector     = document.getElementById('device-inspector');
  const btnCloseInspector   = document.getElementById('btn-close-inspector');
  const inspHostname        = document.getElementById('insp-hostname');
  const inspIp              = document.getElementById('insp-ip');
  const inspType            = document.getElementById('insp-type');
  const inspOs              = document.getElementById('insp-os');
  const inspSubnet          = document.getElementById('insp-subnet');
  const inspStatus          = document.getElementById('insp-status');
  const inspCriticality     = document.getElementById('insp-criticality');
  const inspVal             = document.getElementById('insp-val');
  const inspDowntime        = document.getElementById('insp-downtime');
  const inspDowntimeTicks   = document.getElementById('insp-downtime-ticks');
  const inspCtrlEdr         = document.getElementById('insp-ctrl-edr');
  const inspCtrlFw          = document.getElementById('insp-ctrl-fw');
  const inspCtrlPatch       = document.getElementById('insp-ctrl-patch');
  const inspCtrlIsolated    = document.getElementById('insp-ctrl-isolated');
  const inspServices        = document.getElementById('insp-services');
  const inspCves            = document.getElementById('insp-cves');
  const inspCausalChain     = document.getElementById('insp-causal-chain');
  const inspLogs            = document.getElementById('insp-logs');

  // Inspector Action Buttons
  const btnInspInvestigate  = document.getElementById('btn-insp-investigate');
  const btnInspIsolate      = document.getElementById('btn-insp-isolate');
  const btnInspPatch        = document.getElementById('btn-insp-patch');
  const btnInspRestore      = document.getElementById('btn-insp-restore');

  // Modals
  const modalDatabase       = document.getElementById('modal-database');
  const btnOpenDatabase     = document.getElementById('btn-open-database');
  const btnCloseDatabase    = document.getElementById('btn-close-database');
  const dbCatalogList       = document.getElementById('db-catalog-list');
  const dbSearchInput       = document.getElementById('db-search-input');
  const dbCategoryFilters   = document.querySelectorAll('.db-filter-btn');

  const modalCustomZeroDay  = document.getElementById('modal-zeroday');
  const btnOpenZeroDay      = document.getElementById('btn-open-zeroday');
  const btnCloseZeroDay     = document.getElementById('btn-close-zeroday');
  const formZeroDay         = document.getElementById('form-zeroday');

  const modalThreatFeed     = document.getElementById('modal-threat-feed');
  const btnOpenThreatFeed   = document.getElementById('btn-open-threat-feed');
  const btnCloseThreatFeed  = document.getElementById('btn-close-threat-feed');
  const btnFetchNow         = document.getElementById('btn-fetch-now');
  const btnImportAll        = document.getElementById('btn-import-all');
  const feedEntriesGrid     = document.getElementById('feed-entries-grid');
  const feedStatusBar       = document.getElementById('feed-status-bar');
  const feedStatusText      = document.getElementById('feed-status-text');
  const feedSearch          = document.getElementById('feed-search');
  const feedCountTotal      = document.getElementById('feed-count-total');
  const feedCountNew        = document.getElementById('feed-count-new');
  const feedLastSync        = document.getElementById('feed-last-sync');
  const feedNextSync        = document.getElementById('feed-next-sync');
  const feedBadge           = document.getElementById('feed-badge');

  // Attack Graph Modal
  const modalAttackTree     = document.getElementById('modal-attack-tree');
  const btnOpenAttackTree   = document.getElementById('btn-open-attack-tree');
  const btnCloseAttackTree  = document.getElementById('btn-close-attack-tree');
  const attackTreeContainer = document.getElementById('attack-tree-container');
  const atInfectionCount    = document.getElementById('at-infection-count');
  const atGenerationDepth   = document.getElementById('at-generation-depth');
  const atSearchInput       = document.getElementById('at-search-input');
  const atFilterBtns        = document.querySelectorAll('.attack-tree-filters .db-filter-btn');

  // Failure Injection Modal
  const modalFailureInj     = document.getElementById('modal-failure-injection');
  const btnOpenFailureInj   = document.getElementById('btn-open-failure-injector');
  const btnCloseFailureInj  = document.getElementById('btn-close-failure-injection');
  const btnInjectFwDrop     = document.getElementById('btn-inject-fw-drop');
  const btnInjectEdrOutage  = document.getElementById('btn-inject-edr-outage');
  const btnInjectPressure   = document.getElementById('btn-inject-threat-pressure');
  const btnInjectRouterCrash = document.getElementById('btn-inject-router-crash');
  const btnResetFailures    = document.getElementById('btn-reset-failures');

  // Save / Load Modal
  const modalSaveLoad       = document.getElementById('modal-save-load');
  const btnOpenSaveLoad     = document.getElementById('btn-open-save-load');
  const btnCloseSaveLoad    = document.getElementById('btn-close-save-load');
  const btnSaveCurrentRun   = document.getElementById('btn-save-current-run');
  const btnExportRunJson    = document.getElementById('btn-export-run-json');
  const inputImportRun      = document.getElementById('input-import-run');
  const savedRunsList       = document.getElementById('saved-runs-list');

  // Report & Logs
  const btnGenerateReport   = document.getElementById('btn-generate-report');
  const btnExportLogs       = document.getElementById('btn-export-logs');
  const reportToast         = document.getElementById('report-toast');
  const reportToastText     = document.getElementById('report-toast-text');

  // Damages Toggle
  const btnDmgDaily         = document.getElementById('btn-dmg-daily');
  const btnDmgCum           = document.getElementById('btn-dmg-cum');

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

  // 4. Tick Presentation Loop (Deterministic & Speed-Independent)
  let isRunning = false;
  let speedMultiplier = 1;
  let tickTimer = null;
  const baseTickMs = 1200;

  function runAuthoritativeTick() {
    if (isReplayMode) return;
    simulation.step();
    updateUI();
  }

  function startSimulation() {
    if (isRunning) return;
    isRunning = true;
    if (btnPlay) {
      btnPlay.classList.add('playing');
      btnPlay.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause Outbreak`;
    }
    scheduleNextTick();
  }

  function pauseSimulation() {
    isRunning = false;
    if (btnPlay) {
      btnPlay.classList.remove('playing');
      btnPlay.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Launch Simulation`;
    }
    if (tickTimer) {
      clearTimeout(tickTimer);
      tickTimer = null;
    }
  }

  function scheduleNextTick() {
    if (!isRunning) return;
    const intervalMs = Math.max(15, Math.round(baseTickMs / speedMultiplier));
    tickTimer = setTimeout(() => {
      runAuthoritativeTick();
      scheduleNextTick();
    }, intervalMs);
  }

  // 5. Connect Real Simulation Events to Canvas & Logs
  simulation.on('TRANSMISSION_ATTEMPT', evt => {
    network.handleSimulationEvent(evt);
    addHopLog(evt);
  });

  simulation.on('TRANSMISSION_BLOCKED', evt => {
    network.handleSimulationEvent(evt);
    addHopLog(evt);
  });

  simulation.on('INFECTION_CONFIRMED', evt => {
    network.handleSimulationEvent(evt);
    addBulletin('critical', `Infection Confirmed: ${evt.targetNodeId}`, evt.reason);
  });

  simulation.on('SYSTEM_COMPROMISED', evt => {
    network.handleSimulationEvent(evt);
    addBulletin('critical', `Host Compromised: ${evt.targetNodeId}`, evt.reason);
  });

  simulation.on('NODE_PATCHED', evt => {
    network.handleSimulationEvent(evt);
    addBulletin('info', `Patch Applied: ${evt.targetNodeId}`, evt.reason);
  });

  simulation.on('NODE_ISOLATED', evt => {
    network.handleSimulationEvent(evt);
    addBulletin('warning', `Host Isolated: ${evt.targetNodeId}`, evt.reason);
  });

  simulation.on('NODE_RECOVERED', evt => {
    network.handleSimulationEvent(evt);
    addBulletin('info', `Host Recovered: ${evt.targetNodeId}`, evt.reason);
  });

  simulation.on('THREAT_INTRODUCED', evt => {
    updatePatientZeroBanner(evt.data ? evt.data.patientZero : simulation.patientZero);
  });

  simulation.on('SCENARIO_COMPLETED', evt => {
    addBulletin(evt.result === 'CONTAINED' ? 'info' : 'critical', 'Scenario Result', evt.reason);
  });

  // 6. UI Update and KPI Projection
  function updateUI() {
    const stats = simulation.getAuthoritativeTelemetry();
    const history = simulation.metricsEngine.telemetryHistory;

    // Monitored Endpoints
    if (elTotalDevices) elTotalDevices.textContent = stats.total;

    // Active Infected
    const activeInfected = stats.infected + stats.compromised;
    if (elInfected) elInfected.textContent = activeInfected;
    if (elInfectedPct) {
      const pct = stats.total > 0 ? ((activeInfected / stats.total) * 100).toFixed(1) : '0.0';
      elInfectedPct.textContent = `${pct}%`;
    }

    // Remediated / Patched
    const patchedAndRecovered = stats.patched + stats.recovered;
    if (elPatched) elPatched.textContent = patchedAndRecovered;
    if (elPatchedPct) {
      const pct = stats.total > 0 ? ((patchedAndRecovered / stats.total) * 100).toFixed(1) : '0.0';
      elPatchedPct.textContent = `${pct}%`;
    }

    // Empirical Rt
    if (elR0) {
      elR0.textContent = stats.Rt !== null ? stats.Rt.toFixed(2) : 'N/A';
    }
    if (elR0Status) {
      if (stats.Rt === null) {
        elR0Status.textContent = 'AWAITING TRANSMISSION LINEAGE';
        elR0Status.className = 'kpi-sub dim';
      } else if (stats.Rt > 1.2) {
        elR0Status.textContent = 'EXPONENTIAL SPREAD';
        elR0Status.className = 'kpi-sub danger';
      } else if (stats.Rt >= 1.0) {
        elR0Status.textContent = 'ACTIVE PROPAGATION';
        elR0Status.className = 'kpi-sub warning';
      } else {
        elR0Status.textContent = 'OUTBREAK CONTAINED (Rt < 1.0)';
        elR0Status.className = 'kpi-sub success';
      }
    }

    // Timeline
    if (elCurrentDay) elCurrentDay.textContent = `TICK ${stats.tick}`;

    // Est. Damage
    if (elDamage) elDamage.textContent = `$${Math.round(stats.damage).toLocaleString()}`;

    // Global Threat DEFCON
    if (elGlobalThreatBadge) {
      if (activeInfected > stats.total * 0.4) {
        elGlobalThreatBadge.textContent = 'DEFCON 1: CRITICAL PANDEMIC';
        elGlobalThreatBadge.className = 'threat-badge critical';
      } else if (activeInfected > stats.total * 0.15) {
        elGlobalThreatBadge.textContent = 'DEFCON 2: ACTIVE OUTBREAK';
        elGlobalThreatBadge.className = 'threat-badge danger';
      } else if (activeInfected > 0) {
        elGlobalThreatBadge.textContent = 'DEFCON 3: ELEVATED THREAT';
        elGlobalThreatBadge.className = 'threat-badge warning';
      } else {
        elGlobalThreatBadge.textContent = 'DEFCON 5: NORMAL DEFENSE';
        elGlobalThreatBadge.className = 'threat-badge normal';
      }
    }

    // Update Charts
    charts.renderAll(history, stats);

    // Update Device Inspector if a node is currently selected
    if (network.selectedNode) {
      populateInspector(network.selectedNode);
    }

    // Update Replay Slider Range
    if (replaySlider && !isReplayMode) {
      replaySlider.max = simulation.currentTick;
      replaySlider.value = simulation.currentTick;
      if (replayTickVal) replayTickVal.textContent = `Tick ${simulation.currentTick}`;
    }
  }

  function updatePatientZeroBanner(pz) {
    if (!pz) return;
    if (pzNodeLabel) pzNodeLabel.textContent = `HOST: ${pz.hostname || pz.nodeId}`;
    if (pzVectorLabel) pzVectorLabel.textContent = `VECTOR: ${pz.initialVector}`;
    if (pzReasonLabel) pzReasonLabel.textContent = `REASON: ${pz.reason || 'Patient Zero Breach'}`;
    if (pzTickLabel) pzTickLabel.textContent = `TICK ${pz.tick || 0}`;
  }

  function addHopLog(evt) {
    if (!containerJumpLogs) return;
    const line = document.createElement('div');
    const isSuccess = evt.result === 'EXPLOITED';
    line.className = `jump-log-line ${isSuccess ? 'exploited' : 'blocked'}`;

    const sourceNode = simulation.network.getNode(evt.sourceNodeId);
    const targetNode = simulation.network.getNode(evt.targetNodeId);
    const srcIp = sourceNode ? sourceNode.ip : evt.sourceNodeId;
    const dstIp = targetNode ? targetNode.ip : evt.targetNodeId;

    line.innerHTML = `
      <span class="log-time">T+${evt.tick}</span>
      <span class="log-route">${escapeHTML(srcIp)} &rarr; ${escapeHTML(dstIp)}</span>
      <span class="log-tag tag-${isSuccess ? 'exploited' : 'blocked'}">${escapeHTML(evt.result)}</span>
      <span class="log-detail">${escapeHTML(evt.reason || '')}</span>
    `;

    containerJumpLogs.prepend(line);
    while (containerJumpLogs.children.length > 40) {
      containerJumpLogs.removeChild(containerJumpLogs.lastChild);
    }
  }

  function addBulletin(level, title, text) {
    if (!containerBulletins) return;
    const item = document.createElement('div');
    item.className = `bulletin-item ${level}`;
    item.innerHTML = `
      <div class="bulletin-header">
        <span class="bulletin-day">TICK ${simulation.currentTick}</span>
        <span class="bulletin-time">${new Date().toLocaleTimeString()}</span>
      </div>
      <div class="bulletin-title">${escapeHTML(title)}</div>
      <div class="bulletin-text">${escapeHTML(text)}</div>
    `;
    containerBulletins.prepend(item);
    while (containerBulletins.children.length > 25) {
      containerBulletins.removeChild(containerBulletins.lastChild);
    }
  }

  // 7. Device Inspector & Causal Chain Analysis
  network.onNodeSelected = (node) => {
    populateInspector(node);
    if (drawerInspector) drawerInspector.classList.add('open');
  };

  function populateInspector(node) {
    if (!node) return;
    if (inspHostname) inspHostname.textContent = node.hostname;
    if (inspIp)       inspIp.textContent = `${node.ip} (VLAN ${node.vlanId})`;
    if (inspType)     inspType.textContent = (node.deviceType || '').toUpperCase();
    if (inspOs)       inspOs.textContent = `${node.os} ${node.osVersion || ''}`;
    if (inspSubnet)   inspSubnet.textContent = `Subnet: ${node.subnet}`;

    if (inspStatus) {
      inspStatus.textContent = (node.state || 'SUSCEPTIBLE').toUpperCase();
      inspStatus.className = `status-badge ${node.state}`;
    }

    if (inspCriticality)   inspCriticality.textContent = `${node.criticality.toFixed(1)} / 5.0`;
    if (inspVal)           inspVal.textContent = `$${node.businessValue.toLocaleString()}`;
    if (inspDowntime)      inspDowntime.textContent = `$${Math.round(node.totalDowntimeLoss || 0).toLocaleString()}`;
    if (inspDowntimeTicks) inspDowntimeTicks.textContent = `${node.totalDowntimeTicks || 0} ticks`;

    if (inspCtrlEdr)       inspCtrlEdr.textContent = node.securityControls.edr ? 'Active' : 'Inactive';
    if (inspCtrlFw)        inspCtrlFw.textContent = node.securityControls.firewall ? 'Active' : 'Inactive';
    if (inspCtrlPatch)     inspCtrlPatch.textContent = `${Math.round((node.patchLevel || 0.5) * 100)}%`;
    if (inspCtrlIsolated)  inspCtrlIsolated.textContent = node.securityControls.isolated ? 'YES (Isolated)' : 'No';

    // Services
    if (inspServices) {
      if (Array.isArray(node.services) && node.services.length > 0) {
        inspServices.innerHTML = node.services.map(s =>
          `<span class="svc-tag">${escapeHTML(s.name)}:${s.port}</span>`
        ).join('');
      } else {
        inspServices.innerHTML = `<span style="color:var(--text-dim);font-size:0.68rem;">No exposed listening ports</span>`;
      }
    }

    // CVEs
    if (inspCves) {
      const cves = node.cves || (node.vulnerabilities ? node.vulnerabilities.map(v => v.cve) : []);
      if (cves.length > 0) {
        inspCves.innerHTML = cves.map(c => `<span class="cve-pill">${escapeHTML(c)}</span>`).join('');
      } else {
        inspCves.innerHTML = `<span style="color:var(--accent-green);font-size:0.68rem;">Zero unpatched CVEs detected</span>`;
      }
    }

    // Causal Chain Analysis ("Why is this node infected?")
    renderCausalChain(node);

    // Event Logs
    if (inspLogs) {
      const logs = node.logs || node.telemetryLog || [];
      if (logs.length > 0) {
        inspLogs.innerHTML = logs.map(l => {
          const msg = typeof l === 'string' ? l : `[T+${l.tick}] [${l.level}] ${l.message}`;
          return `<div class="insp-log-entry">${escapeHTML(msg)}</div>`;
        }).join('');
      } else {
        inspLogs.innerHTML = `<div class="insp-log-entry">[SYS] System operational</div>`;
      }
    }
  }

  function renderCausalChain(node) {
    if (!inspCausalChain) return;
    if (!node) {
      inspCausalChain.innerHTML = `<div class="causal-empty">Click any node to inspect causal transmission factors.</div>`;
      return;
    }

    const explanation = node.causalExplanation || node.lastTransmissionAttempt || node.lastTransmissionEval;
    if (!explanation) {
      if (node.state === 'susceptible') {
        inspCausalChain.innerHTML = `<div style="color:var(--accent-green);font-size:0.75rem;padding:4px;">Susceptible &bull; No lateral infection attempts have reached this endpoint.</div>`;
      } else {
        inspCausalChain.innerHTML = `<div style="color:var(--text-dim);font-size:0.75rem;padding:4px;">Awaiting transmission event log...</div>`;
      }
      return;
    }

    let html = '';
    if (explanation.source) {
      html += `<div style="margin-bottom:6px;font-size:0.7rem;color:var(--text-dim);">SOURCE: <strong style="color:var(--text-main);">${escapeHTML(explanation.source)}</strong> &rarr; TARGET: <strong style="color:var(--text-main);">${escapeHTML(node.hostname)}</strong></div>`;
    }

    if (Array.isArray(explanation.factors)) {
      explanation.factors.forEach(f => {
        const isPos = f.delta >= 0;
        const sign = isPos ? '+' : '';
        const deltaStr = `${sign}${(f.delta).toFixed(2)}`;
        html += `
          <div class="causal-factor-item ${isPos ? 'factor-pos' : 'factor-neg'}">
            <div>
              <strong>${escapeHTML(f.name)}</strong>: <span style="color:var(--text-dim);">${escapeHTML(f.value || '')}</span>
              <div style="font-size:0.65rem;color:var(--text-dim);">${escapeHTML(f.desc || '')}</div>
            </div>
            <span class="factor-delta ${isPos ? 'pos' : 'neg'}">${deltaStr}</span>
          </div>
        `;
      });
    }

    const finalProbPct = Math.round((explanation.finalProbability !== undefined ? explanation.finalProbability : 0) * 100);
    const isExploited = explanation.result === 'EXPLOITED';
    const resBadge = isExploited
      ? `<span class="causal-result-badge exploited">EXPLOITED (${escapeHTML(explanation.reason || 'PAYLOAD_DELIVERED')})</span>`
      : `<span class="causal-result-badge blocked">BLOCKED (${escapeHTML(explanation.reason || 'DEFENSE_MITIGATED')})</span>`;

    html += `
      <div class="causal-summary-row">
        <span>Final Transmission Probability: ${finalProbPct}%</span>
        ${resBadge}
      </div>
    `;

    inspCausalChain.innerHTML = html;
  }

  // 8. Defensive Action Buttons
  if (btnCloseInspector) {
    btnCloseInspector.addEventListener('click', () => {
      drawerInspector.classList.remove('open');
      network.selectedNode = null;
    });
  }

  if (btnInspInvestigate) {
    btnInspInvestigate.addEventListener('click', () => {
      if (network.selectedNode) {
        simulation.defenseModel.applyAction('INVESTIGATE', network.selectedNode.id, simulation.network, simulation.eventQueue, simulation.currentTick);
        populateInspector(network.selectedNode);
        updateUI();
        if (window.soundFX) window.soundFX.playClick();
      }
    });
  }

  if (btnInspIsolate) {
    btnInspIsolate.addEventListener('click', () => {
      if (network.selectedNode) {
        simulation.defenseModel.applyAction('ISOLATE', network.selectedNode.id, simulation.network, simulation.eventQueue, simulation.currentTick);
        populateInspector(network.selectedNode);
        updateUI();
        if (window.soundFX) window.soundFX.playPatched();
      }
    });
  }

  if (btnInspPatch) {
    btnInspPatch.addEventListener('click', () => {
      if (network.selectedNode) {
        simulation.defenseModel.applyAction('PATCH', network.selectedNode.id, simulation.network, simulation.eventQueue, simulation.currentTick);
        populateInspector(network.selectedNode);
        updateUI();
        if (window.soundFX) window.soundFX.playPatched();
      }
    });
  }

  if (btnInspRestore) {
    btnInspRestore.addEventListener('click', () => {
      if (network.selectedNode) {
        simulation.defenseModel.applyAction('RESTORE', network.selectedNode.id, simulation.network, simulation.eventQueue, simulation.currentTick);
        populateInspector(network.selectedNode);
        updateUI();
        if (window.soundFX) window.soundFX.playPatched();
      }
    });
  }

  // 9. Simulation Controls (Play, Step, Reset, Speed, Scrubber)
  if (btnPlay) {
    btnPlay.addEventListener('click', () => {
      if (isRunning) {
        pauseSimulation();
      } else {
        startSimulation();
      }
    });
  }

  if (btnStep) {
    btnStep.addEventListener('click', () => {
      pauseSimulation();
      runAuthoritativeTick();
      if (window.soundFX) window.soundFX.playClick();
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      pauseSimulation();
      simulation.reset();
      network.bindNetworkModel(simulation.network);
      if (containerJumpLogs) containerJumpLogs.innerHTML = '';
      if (containerBulletins) containerBulletins.innerHTML = '';
      updatePatientZeroBanner(simulation.patientZero);
      updateUI();
      if (window.soundFX) window.soundFX.playClick();
    });
  }

  if (btnUpdateDaily) {
    btnUpdateDaily.addEventListener('click', () => {
      // Execute defensive fleetwide patch roll-out
      simulation.network.getAllNodes().forEach(n => {
        if (n.state === 'SUSCEPTIBLE' && n.patchLevel < 0.8) {
          simulation.defenseModel.applyAction('PATCH', {
            targetNodeId: n.id,
            tick: simulation.currentTick
          }, simulation.network, simulation.eventQueue);
        }
      });
      btnUpdateDaily.classList.add('updating');
      setTimeout(() => btnUpdateDaily.classList.remove('updating'), 400);
      updateUI();
    });
  }

  // Speed Buttons
  speedBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      speedBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      speedMultiplier = parseFloat(btn.dataset.speed || 1);
      if (isRunning) {
        // Reschedule timer with new interval
        if (tickTimer) clearTimeout(tickTimer);
        scheduleNextTick();
      }
      if (window.soundFX) window.soundFX.playClick();
    });
  });

  // Replay Mode & Scrubber
  if (btnToggleReplay) {
    btnToggleReplay.addEventListener('click', () => {
      isReplayMode = !isReplayMode;
      btnToggleReplay.classList.toggle('active', isReplayMode);
      if (replayScrubberBox) replayScrubberBox.style.display = isReplayMode ? 'flex' : 'none';

      if (isReplayMode) {
        pauseSimulation();
        if (replaySlider) {
          replaySlider.max = simulation.currentTick;
          replaySlider.value = simulation.currentTick;
          if (replayTickVal) replayTickVal.textContent = `Tick ${simulation.currentTick}`;
        }
      } else {
        // Return to latest snapshot
        simulation.restoreSnapshotAtTick(simulation.currentTick);
        network.bindNetworkModel(simulation.network);
        updateUI();
      }
    });
  }

  if (replaySlider) {
    replaySlider.addEventListener('input', (e) => {
      const scrubTick = parseInt(e.target.value, 10);
      if (replayTickVal) replayTickVal.textContent = `Tick ${scrubTick}`;
      simulation.restoreSnapshotAtTick(scrubTick);
      network.bindNetworkModel(simulation.network);
      updateUI();
    });
  }

  // Seed Input & Roll Random Seed
  if (inputSeed) {
    inputSeed.addEventListener('change', (e) => {
      const val = parseInt(e.target.value, 10);
      if (!isNaN(val) && val > 0) {
        currentSeed = val;
        pauseSimulation();
        simulation.loadScenario(currentScenario, currentSeed);
        network.bindNetworkModel(simulation.network);
        updatePatientZeroBanner(simulation.patientZero);
        updateUI();
      }
    });
  }

  if (btnRandomSeed) {
    btnRandomSeed.addEventListener('click', () => {
      currentSeed = Math.floor(Math.random() * 900000 + 10000);
      if (inputSeed) inputSeed.value = currentSeed;
      pauseSimulation();
      simulation.loadScenario(currentScenario, currentSeed);
      network.bindNetworkModel(simulation.network);
      updatePatientZeroBanner(simulation.patientZero);
      updateUI();
      if (window.soundFX) window.soundFX.playClick();
    });
  }

  // Scenario Selector
  if (selScenario) {
    selScenario.addEventListener('change', (e) => {
      currentScenario = e.target.value;
      pauseSimulation();
      simulation.loadScenario(currentScenario, currentSeed);
      network.bindNetworkModel(simulation.network);
      if (containerJumpLogs) containerJumpLogs.innerHTML = '';
      if (containerBulletins) containerBulletins.innerHTML = '';
      updatePatientZeroBanner(simulation.patientZero);
      rebuildMalwareSelector(simulation.activeThreat ? simulation.activeThreat.id : null);
      updateUI();
      if (window.soundFX) window.soundFX.playEmergency();
    });
  }

  // Topology Selector
  if (selTopology) {
    selTopology.addEventListener('change', (e) => {
      pauseSimulation();
      simulation.network.generateTopology(e.target.value, 75);
      simulation.reset();
      network.bindNetworkModel(simulation.network);
      updateUI();
      if (window.soundFX) window.soundFX.playClick();
    });
  }

  // Malware Profile Selector
  function rebuildMalwareSelector(selectedId) {
    if (!selMalware) return;
    selMalware.innerHTML = '';
    const threats = SimCore.BuiltInThreats ? SimCore.BuiltInThreats.listThreats() : (window.MalwareDatabase || []);
    threats.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${t.name} [R0: ${t.r0 || t.baseR0 || '4.0'}]`;
      selMalware.appendChild(opt);
    });
    if (selectedId) selMalware.value = selectedId;
  }
  rebuildMalwareSelector(simulation.activeThreat ? simulation.activeThreat.id : null);

  if (selMalware) {
    selMalware.addEventListener('change', (e) => {
      const threatObj = SimCore.BuiltInThreats ? SimCore.BuiltInThreats.getThreat(e.target.value) : null;
      if (threatObj) {
        simulation.activeThreat = threatObj;
        addBulletin('warning', 'Threat Payload Swapped', `Active simulated threat switched to ${threatObj.name}.`);
        updateUI();
      }
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

  // 10. Attack Graph & Lineage Modal
  if (btnOpenAttackTree && modalAttackTree) {
    btnOpenAttackTree.addEventListener('click', () => {
      modalAttackTree.classList.add('open');
      renderAttackTree();
      if (window.soundFX) window.soundFX.playClick();
    });
  }

  if (btnCloseAttackTree && modalAttackTree) {
    btnCloseAttackTree.addEventListener('click', () => {
      modalAttackTree.classList.remove('open');
    });
  }

  let attackTreeFilter = 'all';
  atFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      atFilterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      attackTreeFilter = btn.dataset.filter || 'all';
      renderAttackTree();
    });
  });

  if (atSearchInput) {
    atSearchInput.addEventListener('input', () => {
      renderAttackTree();
    });
  }

  function renderAttackTree() {
    if (!attackTreeContainer) return;
    const lineage = simulation.metricsEngine.transmissionLineage || [];
    const q = (atSearchInput ? atSearchInput.value : '').toLowerCase().trim();

    if (atInfectionCount) atInfectionCount.textContent = lineage.length;
    if (atGenerationDepth) atGenerationDepth.textContent = lineage.length > 0 ? Math.max(...lineage.map(l => l.generation || 1)) : 0;

    let filtered = lineage.filter(item => {
      const matchSearch = !q || item.sourceId.toLowerCase().includes(q) || item.targetId.toLowerCase().includes(q);
      if (!matchSearch) return false;
      if (attackTreeFilter === 'all') return true;
      if (attackTreeFilter === 'exploited') return true; // all recorded lineage entries are actual infections
      if (attackTreeFilter === 'critical') {
        const tgt = simulation.network.getNode(item.targetId);
        return tgt && tgt.criticality >= 3.0;
      }
      return true;
    });

    if (filtered.length === 0) {
      attackTreeContainer.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-dim);font-family:var(--font-mono);font-size:0.75rem;">No transmission hops match criteria.</div>`;
      return;
    }

    attackTreeContainer.innerHTML = filtered.map(item => {
      const srcNode = simulation.network.getNode(item.sourceId);
      const tgtNode = simulation.network.getNode(item.targetId);
      const srcLabel = srcNode ? `${srcNode.hostname} (${srcNode.ip})` : item.sourceId;
      const tgtLabel = tgtNode ? `${tgtNode.hostname} (${tgtNode.ip})` : item.targetId;
      const genIndent = '&nbsp;&bull;&nbsp;'.repeat(Math.min(5, item.generation || 1));

      return `
        <div class="lineage-tree-node">
          <div>
            <span class="lineage-depth-indent">${genIndent} [Gen ${item.generation || 1}]</span>
            <strong style="color:var(--accent-red);">${escapeHTML(srcLabel)}</strong>
            &rarr;
            <strong style="color:var(--accent-cyan);">${escapeHTML(tgtLabel)}</strong>
          </div>
          <div style="font-size:0.68rem;color:var(--text-dim);">
            TICK ${item.tick} &bull; ${escapeHTML(item.threatId)}
          </div>
        </div>
      `;
    }).join('');
  }

  // 11. Chaos & Failure Injection Modal
  if (btnOpenFailureInj && modalFailureInj) {
    btnOpenFailureInj.addEventListener('click', () => {
      modalFailureInj.classList.add('open');
      if (window.soundFX) window.soundFX.playClick();
    });
  }

  if (btnCloseFailureInj && modalFailureInj) {
    btnCloseFailureInj.addEventListener('click', () => {
      modalFailureInj.classList.remove('open');
    });
  }

  if (btnInjectFwDrop) {
    btnInjectFwDrop.addEventListener('click', () => {
      const res = simulation.failureInjector.injectFirewallFailure(simulation.network, 'ALL');
      addBulletin('warning', 'Failure Injected', `Firewall rules dropped on ${res.affectedEdgesCount} network edges.`);
      updateUI();
    });
  }

  if (btnInjectEdrOutage) {
    btnInjectEdrOutage.addEventListener('click', () => {
      const res = simulation.failureInjector.injectEDROutage(simulation.network, 12);
      addBulletin('warning', 'Failure Injected', `Cloud EDR connection severed for ${res.affectedNodesCount} endpoints.`);
      updateUI();
    });
  }

  if (btnInjectPressure) {
    btnInjectPressure.addEventListener('click', () => {
      simulation.failureInjector.injectTransmissionPressure(1.5);
      addBulletin('warning', 'Failure Injected', `Threat pressure escalated (+50% lateral scan virulence).`);
      updateUI();
    });
  }

  if (btnInjectRouterCrash) {
    btnInjectRouterCrash.addEventListener('click', () => {
      const routers = simulation.network.getAllNodes().filter(n => n.deviceType === 'router');
      if (routers.length > 0) {
        const targetRouter = routers[0];
        simulation.failureInjector.injectRouterCrash(targetRouter.id, simulation.network, 15);
        addBulletin('critical', 'Gateway Partition', `Core router ${targetRouter.hostname} crashed. Inter-VLAN traffic severed.`);
        updateUI();
      }
    });
  }

  if (btnResetFailures) {
    btnResetFailures.addEventListener('click', () => {
      simulation.failureInjector.resetAllFailures(simulation.network);
      addBulletin('info', 'Failures Cleared', 'All network failure injections cleared. Normal baseline restored.');
      updateUI();
    });
  }

  // 12. Save, Load & Export Simulation Runs
  if (btnOpenSaveLoad && modalSaveLoad) {
    btnOpenSaveLoad.addEventListener('click', () => {
      modalSaveLoad.classList.add('open');
      renderSavedRunsList();
      if (window.soundFX) window.soundFX.playClick();
    });
  }

  if (btnCloseSaveLoad && modalSaveLoad) {
    btnCloseSaveLoad.addEventListener('click', () => {
      modalSaveLoad.classList.remove('open');
    });
  }

  if (btnSaveCurrentRun) {
    btnSaveCurrentRun.addEventListener('click', async () => {
      const runData = simulation.serialize();
      try {
        const resp = await fetch('/api/runs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(runData)
        });
        if (resp.ok) {
          showToast('✓ Simulation Run Saved to Database', 3000);
        } else {
          // Fallback to localStorage
          saveToLocalStorage(runData);
        }
      } catch (err) {
        saveToLocalStorage(runData);
      }
      renderSavedRunsList();
    });
  }

  function saveToLocalStorage(runData) {
    const list = JSON.parse(localStorage.getItem('cyberoutbreak_saved_runs') || '[]');
    list.unshift({
      id: runData.runId || `run-${Date.now()}`,
      scenario: runData.scenarioId,
      tick: runData.currentTick,
      seed: runData.seed,
      data: runData,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem('cyberoutbreak_saved_runs', JSON.stringify(list.slice(0, 10)));
    showToast('✓ Saved Run to Local Storage', 3000);
  }

  if (btnExportRunJson) {
    btnExportRunJson.addEventListener('click', () => {
      const runData = simulation.serialize();
      const blob = new Blob([JSON.stringify(runData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cyberoutbreak_run_seed_${simulation.seed}_tick_${simulation.currentTick}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('✓ Simulation Run Exported (JSON)', 3000);
    });
  }

  if (inputImportRun) {
    inputImportRun.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const runData = JSON.parse(evt.target.result);
          simulation.deserialize(runData);
          network.bindNetworkModel(simulation.network);
          updatePatientZeroBanner(simulation.patientZero);
          updateUI();
          if (modalSaveLoad) modalSaveLoad.classList.remove('open');
          showToast('✓ Simulation Run Restored Successfully', 3000);
        } catch (err) {
          alert('Failed to parse imported JSON run file.');
        }
      };
      reader.readAsText(file);
    });
  }

  async function renderSavedRunsList() {
    if (!savedRunsList) return;
    let runs = [];
    try {
      const res = await fetch('/api/runs');
      if (res.ok) {
        const json = await res.json();
        runs = json.runs || [];
      }
    } catch (e) {
      runs = JSON.parse(localStorage.getItem('cyberoutbreak_saved_runs') || '[]');
    }

    if (runs.length === 0) {
      savedRunsList.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text-dim);font-size:0.75rem;">No saved runs found. Click "Save Current Run" to persist snapshot.</div>`;
      return;
    }

    savedRunsList.innerHTML = runs.map((r, i) => `
      <div class="saved-run-card">
        <div>
          <strong style="color:var(--accent-cyan);">${escapeHTML(r.scenario_id || r.scenario || 'Scenario')}</strong>
          <div style="font-size:0.68rem;color:var(--text-dim);">Seed: ${r.seed} &bull; Ticks: ${r.total_ticks || r.tick || 0} &bull; ${new Date(r.timestamp || r.created_at || Date.now()).toLocaleDateString()}</div>
        </div>
        <button class="btn-ctrl btn-load-run-item" data-idx="${i}" style="padding:4px 8px;font-size:0.7rem;">Load</button>
      </div>
    `).join('');

    savedRunsList.querySelectorAll('.btn-load-run-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const item = runs[idx];
        if (item && item.data) {
          simulation.deserialize(item.data);
          network.bindNetworkModel(simulation.network);
          updatePatientZeroBanner(simulation.patientZero);
          updateUI();
          if (modalSaveLoad) modalSaveLoad.classList.remove('open');
          showToast('✓ Loaded Run from Storage', 3000);
        }
      });
    });
  }

  // 13. Threat Intelligence Database Modal
  if (btnOpenDatabase && modalDatabase) {
    btnOpenDatabase.addEventListener('click', () => {
      modalDatabase.classList.add('open');
      renderDatabaseCatalog();
      if (window.soundFX) window.soundFX.playClick();
    });
  }

  if (btnCloseDatabase && modalDatabase) {
    btnCloseDatabase.addEventListener('click', () => {
      modalDatabase.classList.remove('open');
    });
  }

  function renderDatabaseCatalog(filterCategory = 'all', searchQuery = '') {
    if (!dbCatalogList) return;
    const threats = SimCore.BuiltInThreats ? SimCore.BuiltInThreats.listThreats() : (window.MalwareDatabase || []);
    const q = searchQuery.toLowerCase().trim();

    const filtered = threats.filter(m => {
      const matchCat = filterCategory === 'all' || m.category === filterCategory;
      const matchSearch = !q || m.name.toLowerCase().includes(q) || (m.cves && m.cves.join(' ').toLowerCase().includes(q));
      return matchCat && matchSearch;
    });

    dbCatalogList.innerHTML = filtered.map(m => `
      <div class="db-card ${m.category || 'worm'}">
        <div class="db-card-header">
          <div class="db-title-row">
            <h4 class="db-name">${escapeHTML(m.name)}</h4>
            <span class="db-badge sev-${(m.severity || 'CRITICAL').toLowerCase()}">${m.severity || 'CRITICAL'}</span>
          </div>
          <div class="db-type-meta">${escapeHTML(m.category || 'Malware')} &bull; R0: ${m.r0 || m.baseR0 || 4.5}</div>
        </div>
        <div class="db-detail-field"><strong>Vector:</strong> ${escapeHTML(m.attackVector || m.vector || 'Remote Exploit')}</div>
        <div class="db-detail-field"><strong>CVEs:</strong> <code>${escapeHTML(Array.isArray(m.cves) ? m.cves.join(', ') : m.cve || 'N/A')}</code></div>
        <p class="db-desc">${escapeHTML(m.description || '')}</p>
        <button class="btn-deploy-malware" data-id="${m.id}" style="margin-top:8px;">
          Deploy as Active Threat
        </button>
      </div>
    `).join('');

    dbCatalogList.querySelectorAll('.btn-deploy-malware').forEach(btn => {
      btn.addEventListener('click', () => {
        const tid = btn.dataset.id;
        const found = SimCore.BuiltInThreats.getThreat(tid);
        if (found) {
          simulation.activeThreat = found;
          rebuildMalwareSelector(found.id);
          addBulletin('warning', 'Threat Payload Swapped', `Active threat switched to ${found.name}.`);
          modalDatabase.classList.remove('open');
          updateUI();
          if (window.soundFX) window.soundFX.playEmergency();
        }
      });
    });
  }

  // 14. Modals click-outside to close
  [modalDatabase, modalCustomZeroDay, modalThreatFeed, modalAttackTree, modalFailureInj, modalSaveLoad].forEach(m => {
    if (m) {
      m.addEventListener('click', (e) => {
        if (e.target === m) m.classList.remove('open');
      });
    }
  });

  // 15. PDF Report Generation
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
      if (isRunning) {
        pauseSimulation();
      }
      showToast('Generating PDF Incident Report…', 4000);
      btnGenerateReport.disabled = true;

      setTimeout(() => {
        try {
          const stats = simulation.getAuthoritativeTelemetry();
          if (reporter) {
            reporter.generate(simulation, network, stats);
            showToast('✓ PDF Incident Report Downloaded', 3000);
          }
        } catch (err) {
          console.error('PDF generation error:', err);
          showToast('PDF report failed. Check console.', 3000);
        } finally {
          btnGenerateReport.disabled = false;
        }
      }, 100);
    });
  }

  if (btnExportLogs) {
    btnExportLogs.addEventListener('click', () => {
      const exportData = {
        timestamp: new Date().toISOString(),
        seed: simulation.seed,
        currentTick: simulation.currentTick,
        scenario: simulation.activeScenario,
        threat: simulation.activeThreat,
        telemetryHistory: simulation.metricsEngine.telemetryHistory,
        transmissionLineage: simulation.metricsEngine.transmissionLineage,
        events: simulation.allEmittedEvents
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cyberoutbreak-telemetry-seed-${simulation.seed}-tick-${simulation.currentTick}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('✓ Telemetry Logs Exported (JSON)', 3000);
    });
  }

  // 16. Helper Utilities
  function escapeHTML(str) {
    if (!str) return '';
    return str.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initial draw & attribution
  updatePatientZeroBanner(simulation.patientZero);
  updateUI();
});
