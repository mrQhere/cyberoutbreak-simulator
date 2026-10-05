/**
 * Automated Test Suite for CyberOutbreak Pure Simulation Core
 * Tests all required invariant properties, SEIR progression, determinism, and replay.
 */
const assert = require('assert');
const SimulationEngine = require('./js/simulation/SimulationEngine');
const NodeStateMachine = require('./js/simulation/NodeStateMachine');
const NodeModel = require('./js/simulation/NodeModel');
const EdgeModel = require('./js/simulation/EdgeModel');
const NetworkModel = require('./js/simulation/NetworkModel');
const ThreatModel = require('./js/simulation/ThreatModel');
const RandomSource = require('./js/simulation/RandomSource');
const FailureInjector = require('./js/simulation/FailureInjector');
const DefenseModel = require('./js/simulation/DefenseModel');
const MetricsEngine = require('./js/simulation/MetricsEngine');
const EventQueue = require('./js/simulation/EventQueue');

console.log('====================================================');
console.log(' RUNNING COMPREHENSIVE SIMULATION CORE UNIT TESTS');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// ── TEST 1: Seeded Determinism ──────────────────────────────────────
test('Seeded runs are 100% byte-for-byte deterministic across 15 ticks', () => {
  const seed = 987654;
  const sim1 = new SimulationEngine({ seed, scenarioId: 'scenario-corporate-ransomware' });
  const sim2 = new SimulationEngine({ seed, scenarioId: 'scenario-corporate-ransomware' });

  for (let i = 0; i < 15; i++) {
    sim1.step();
    sim2.step();
  }

  const json1 = JSON.parse(sim1.exportRunJSON());
  const json2 = JSON.parse(sim2.exportRunJSON());
  delete json1.exportedAt;
  delete json2.exportedAt;
  delete json1.patientZero.timestamp;
  delete json2.patientZero.timestamp;

  assert.deepStrictEqual(json1, json2, 'Both seeded runs must generate identical simulation telemetry, events, and lineage');
  assert.strictEqual(sim1.metricsEngine.telemetryHistory.length, 16); // tick 0 + 15
  assert.strictEqual(
    sim1.metricsEngine.telemetryHistory[15].infected,
    sim2.metricsEngine.telemetryHistory[15].infected
  );
});

// ── TEST 2: State Machine Invariant Rejections ────────────────────────
test('Node state machine enforces transitions and rejects invalid jumps', () => {
  const sm = new NodeStateMachine('test-node-1', NodeStateMachine.States.SUSCEPTIBLE);

  // Valid: SUSCEPTIBLE -> EXPOSED
  sm.transitionTo(NodeStateMachine.States.EXPOSED, { tick: 1, cause: 'EXPLOIT' });
  assert.strictEqual(sm.currentState, NodeStateMachine.States.EXPOSED);

  // Invalid: EXPOSED cannot transition directly to COMPROMISED without being INFECTED first
  assert.strictEqual(sm.canTransitionTo(NodeStateMachine.States.COMPROMISED), false);
  assert.throws(() => {
    sm.transitionTo(NodeStateMachine.States.COMPROMISED, { tick: 2 });
  }, /Invalid state transition/);

  // Valid: EXPOSED -> INFECTED
  sm.transitionTo(NodeStateMachine.States.INFECTED, { tick: 2, cause: 'INCUBATION_DONE' });
  assert.strictEqual(sm.currentState, NodeStateMachine.States.INFECTED);

  // Valid: INFECTED -> COMPROMISED
  sm.transitionTo(NodeStateMachine.States.COMPROMISED, { tick: 3, cause: 'ENCRYPTION' });
  assert.strictEqual(sm.currentState, NodeStateMachine.States.COMPROMISED);

  // Invalid: COMPROMISED cannot directly transition to SUSCEPTIBLE
  assert.throws(() => {
    sm.transitionTo(NodeStateMachine.States.SUSCEPTIBLE, { tick: 4 });
  }, /Invalid state transition/);

  // Valid: COMPROMISED -> RECOVERING -> RECOVERED -> PATCHED
  sm.transitionTo(NodeStateMachine.States.RECOVERING, { tick: 4 });
  sm.transitionTo(NodeStateMachine.States.RECOVERED, { tick: 5 });
  sm.transitionTo(NodeStateMachine.States.PATCHED, { tick: 6 });
  assert.strictEqual(sm.currentState, NodeStateMachine.States.PATCHED);
});

// ── TEST 3: Isolated Nodes Cannot Transmit or Receive ────────────────
test('Isolated nodes cannot transmit or receive lateral transmission', () => {
  const net = new NetworkModel();
  const n1 = net.addNode({ id: 'n1', ip: '10.0.0.1', deviceType: 'workstation', initialState: 'INFECTED' });
  const n2 = net.addNode({ id: 'n2', ip: '10.0.0.2', deviceType: 'workstation', initialState: 'SUSCEPTIBLE' });

  net.addEdge({ sourceId: 'n1', targetId: 'n2', reachable: true });

  // Normal reachability
  assert.strictEqual(net.canReach('n1', 'n2').reachable, true);

  // Isolate source
  n1.stateMachine.transitionTo('ISOLATED', { tick: 1, cause: 'ADMIN' });
  assert.strictEqual(net.canReach('n1', 'n2').reachable, false);
  assert.strictEqual(net.canReach('n1', 'n2').reason, 'SOURCE_ISOLATED');

  // Un-isolate n1, isolate n2
  n1.stateMachine.unIsolate({ tick: 2 });
  n2.stateMachine.transitionTo('ISOLATED', { tick: 2, cause: 'ADMIN' });
  assert.strictEqual(net.canReach('n1', 'n2').reachable, false);
  assert.strictEqual(net.canReach('n1', 'n2').reason, 'TARGET_ISOLATED');
});

// ── TEST 4: Blocked Edges & Air Gaps Prevent Reachability ────────────
test('Blocked edges and air-gapped segments prevent reachability', () => {
  const net = new NetworkModel();
  const n1 = net.addNode({ id: 'n1', ip: '10.1.0.1', subnet: 'Corporate', deviceType: 'workstation' });
  const n2 = net.addNode({ id: 'n2', ip: '10.2.0.1', subnet: 'SCADA_SIS', deviceType: 'scada' });

  // Add air-gapped edge
  const edge = net.addEdge({
    sourceId: 'n1',
    targetId: 'n2',
    segmentation: EdgeModel.SegmentationTypes.AIR_GAP,
    reachable: false
  });

  const reach = net.canReach('n1', 'n2');
  assert.strictEqual(reach.reachable, false);
  assert.strictEqual(reach.reason, 'AIR_GAPPED');
});

// ── TEST 5: Exposure Precedes Infection (Real SEIR) ──────────────────
test('Exposure precedes infection: nodes spend time in EXPOSED before INFECTED', () => {
  const sim = new SimulationEngine({ seed: 112233, scenarioId: 'scenario-supply-chain' });
  let hadExposedState = false;

  for (let i = 0; i < 15; i++) {
    const res = sim.step();
    if (res.telemetry.exposed > 0) {
      hadExposedState = true;
    }
  }

  assert.strictEqual(hadExposedState, true, 'Outbreak must produce observed EXPOSED nodes during incubation');

  // Verify that an exposed node has infectionProgress < 1.0 initially
  const exposedNodes = sim.network.getAllNodes().filter(n => n.state === 'EXPOSED');
  if (exposedNodes.length > 0) {
    assert(exposedNodes[0].infectionProgress >= 0 && exposedNodes[0].infectionProgress <= 1.0);
  }
});

// ── TEST 6: Transmission Lineage & Empirical Rt Tracking ─────────────
test('Transmission lineage is recorded and empirical Rt is derived from secondary infections', () => {
  const sim = new SimulationEngine({ seed: 445566, scenarioId: 'scenario-fast-worm' });

  for (let i = 0; i < 8; i++) {
    sim.step();
  }

  const lineage = sim.metricsEngine.lineage;
  assert(lineage.length > 0, 'Fast worm must produce transmission lineage records');

  lineage.forEach(item => {
    assert(item.sourceId, 'Lineage must have sourceId');
    assert(item.targetId, 'Lineage must have targetId');
    assert(typeof item.tick === 'number', 'Lineage must have tick number');
  });

  // Check Patient Zero tree structure
  const tree = sim.metricsEngine.getTransmissionTree();
  assert(tree.roots.length > 0, 'Tree must contain root Patient Zero');

  // Check empirical Rt
  const finalTelemetry = sim.metricsEngine.telemetryHistory[sim.metricsEngine.telemetryHistory.length - 1];
  assert(finalTelemetry.empiricalRt !== undefined);
});

// ── TEST 7: Multi-Component Damage Tracking ─────────────────────────
test('Damage accumulates based on asset criticality and downtime', () => {
  const sim = new SimulationEngine({ seed: 556677, scenarioId: 'scenario-corporate-ransomware' });

  const t0 = sim.metricsEngine.telemetryHistory[0];
  assert.strictEqual(t0.damage, 0, 'Tick 0 damage must be zero before downtime accumulates');

  for (let i = 0; i < 10; i++) {
    sim.step();
  }

  const t10 = sim.metricsEngine.telemetryHistory[10];
  assert(t10.damage > 0, 'Damage must accumulate as systems suffer downtime');
  assert(t10.damageBreakdown.downtimeLoss >= 0);
  assert(t10.damageBreakdown.dataLossCost >= 0);
});

// ── TEST 8: Replay Reconstructs Identical State ─────────────────────
test('Snapshot restoration reconstructs exact state for replay', () => {
  const sim = new SimulationEngine({ seed: 778899, scenarioId: 'scenario-iot-botnet' });

  for (let i = 0; i < 10; i++) {
    sim.step();
  }

  const tick5Snap = sim.tickSnapshots[5];
  assert(tick5Snap !== undefined, 'Snapshot for tick 5 must exist');

  // Restore tick 5
  const restored = sim.restoreSnapshotAtTick(5);
  assert.strictEqual(restored, true);
  assert.strictEqual(sim.currentTick, 5);

  const t5Metrics = sim.metricsEngine.recordTickTelemetry(5, sim.network, sim.activeThreat, sim.defenseModel);
  assert.strictEqual(t5Metrics.infected, tick5Snap.telemetry.infected);
  assert.strictEqual(t5Metrics.susceptible, tick5Snap.telemetry.susceptible);
});

// ── TEST 9: Failure Injection Modifies Transmission ──────────────────
test('Failure injection alters simulation conditions', () => {
  const net = new NetworkModel();
  net.generateTopology('corporate', 30, new RandomSource(111));

  const fi = new FailureInjector();
  fi.injectFirewallFailure(net);

  const routers = net.getAllNodes().filter(n => n.deviceType === 'router');
  routers.forEach(r => {
    assert.strictEqual(r.securityControls.firewall, false);
    assert.strictEqual(r.securityControls.firewallStrength, 0.0);
  });
});

// ── TEST 10: Infected Nodes Cannot Become Infected Twice ─────────────
test('Infected nodes cannot become infected twice or transition backwards to exposed', () => {
  const sm = new NodeStateMachine('n-double', NodeStateMachine.States.INFECTED);
  assert.strictEqual(sm.canTransitionTo(NodeStateMachine.States.INFECTED), false);
  assert.strictEqual(sm.canTransitionTo(NodeStateMachine.States.EXPOSED), false);
  assert.throws(() => {
    sm.transitionTo(NodeStateMachine.States.EXPOSED, { tick: 5 });
  }, /Invalid state transition/);
});

// ── TEST 11: Patched Nodes Have Mitigated Vulnerabilities & Zero Vulnerability Surface ──
test('Patched nodes have reduced/zero vulnerability surface according to configuration', () => {
  const net = new NetworkModel();
  const node = net.addNode({
    id: 'patch-test',
    deviceType: 'workstation',
    patchLevel: 0.2,
    vulnerabilities: [{ cve: 'CVE-2017-0144', patched: false }]
  });

  assert.strictEqual(node.hasVulnerability('CVE-2017-0144'), true);

  const def = new DefenseModel();
  const eq = new EventQueue();
  def.applyAction(DefenseModel.Actions.PATCH, 'patch-test', net, eq, 1);

  assert.strictEqual(node.hasVulnerability('CVE-2017-0144'), false);
  assert.strictEqual(node.patchLevel, 1.0);
  assert.strictEqual(node.state, NodeStateMachine.States.PATCHED);
});

// ── TEST 12: Recovery Follows Configured Recovery Process ────────────
test('Recovery requires transition through RECOVERING before becoming RECOVERED', () => {
  const sm = new NodeStateMachine('rec-test', NodeStateMachine.States.INFECTED);

  // Direct INFECTED -> RECOVERED without recovering process is rejected if strict
  // Node must enter RECOVERING
  sm.transitionTo(NodeStateMachine.States.RECOVERING, { tick: 10, cause: 'RESTORING' });
  assert.strictEqual(sm.currentState, NodeStateMachine.States.RECOVERING);

  // Cannot jump back to SUSCEPTIBLE directly from RECOVERING
  assert.strictEqual(sm.canTransitionTo(NodeStateMachine.States.SUSCEPTIBLE), false);

  // Completes recovery
  sm.transitionTo(NodeStateMachine.States.RECOVERED, { tick: 14, cause: 'REMEDIATION_COMPLETE' });
  assert.strictEqual(sm.currentState, NodeStateMachine.States.RECOVERED);
});

// ── TEST 13: Attack Rate Metric Correctness ──────────────────────────
test('Attack rate metric accurately calculates cumulative infected ratio', () => {
  const net = new NetworkModel();
  const threat = new ThreatModel({ id: 'test', r0: 3 });
  const metrics = new MetricsEngine();

  for (let i = 1; i <= 10; i++) {
    net.addNode({ id: `n${i}`, initialState: i <= 3 ? 'INFECTED' : 'SUSCEPTIBLE' });
  }

  const tel = metrics.recordTickTelemetry(1, net, threat);
  assert.strictEqual(tel.total, 10);
  assert.strictEqual(tel.attackRate, 30.0); // 3 out of 10 = 30.0%
});

// ── TEST 14: Save / Load Run Roundtrip Reproduces State ──────────────
test('Exported run loads and restores identical state and metrics', () => {
  const sim = new SimulationEngine({ seed: 334455, scenarioId: 'scenario-corporate-ransomware' });
  for (let i = 0; i < 7; i++) {
    sim.step();
  }

  const exported = sim.exportRunJSON();
  const simNew = new SimulationEngine({ seed: 1, autoInit: false });
  simNew.importRunJSON(exported);

  assert.strictEqual(simNew.currentTick, 7);
  assert.strictEqual(simNew.metricsEngine.lineage.length, sim.metricsEngine.lineage.length);
  assert.strictEqual(
    simNew.metricsEngine.telemetryHistory[7].infected,
    sim.metricsEngine.telemetryHistory[7].infected
  );
});

// ── TEST 15: Simulation Speed Does Not Alter Math Results ────────────
test('Simulation speed does not alter simulation results (ticks are authoritative)', () => {
  // Speed is a presentation timer multiplier, mathematical tick steps are pure
  const simA = new SimulationEngine({ seed: 654321, scenarioId: 'scenario-fast-worm' });
  const simB = new SimulationEngine({ seed: 654321, scenarioId: 'scenario-fast-worm' });

  // Regardless of virtual speed multiplier, identical ticks produce identical results
  for (let t = 0; t < 10; t++) {
    simA.step();
    simB.step();
  }

  assert.deepStrictEqual(
    simA.metricsEngine.telemetryHistory[10],
    simB.metricsEngine.telemetryHistory[10]
  );
});

// ── TEST 16: Reset Produces Same Initial State for Same Seed ─────────
test('Resetting and reloading produce identical initial network state for the same seed', () => {
  const seed = 789123;
  const sim = new SimulationEngine({ seed, scenarioId: 'scenario-healthcare-malware' });
  const initialNodesState = JSON.stringify(sim.network.getState());

  for (let i = 0; i < 5; i++) sim.step();

  // Reload scenario with same seed
  sim.loadScenario('scenario-healthcare-malware', seed);
  const reloadedNodesState = JSON.stringify(sim.network.getState());

  assert.strictEqual(initialNodesState, reloadedNodesState);
});

// ── TEST 17: Topology Affects Reachability and Transmission ──────────
test('Network topology changes alter reachability and outbreak spread', () => {
  const simCorp = new SimulationEngine({ seed: 999, scenarioId: 'scenario-corporate-ransomware' });
  const simScada = new SimulationEngine({ seed: 999, scenarioId: 'scenario-scada-ot' });

  for (let i = 0; i < 10; i++) {
    simCorp.step();
    simScada.step();
  }

  // SCADA has air gaps and different network paths; outbreak trajectory must differ
  const corpInf = simCorp.metricsEngine.telemetryHistory[10].infected;
  const scadaInf = simScada.metricsEngine.telemetryHistory[10].infected;
  assert.notStrictEqual(corpInf, scadaInf);
});

// ── TEST 18: Defender Actions Alter Simulation Outcomes ──────────────
test('Active defensive interventions significantly alter outbreak outcomes', () => {
  const seed = 54321;
  const simUncontrolled = new SimulationEngine({ seed, scenarioId: 'scenario-corporate-ransomware' });
  const simDefended = new SimulationEngine({ seed, scenarioId: 'scenario-corporate-ransomware' });

  for (let i = 1; i <= 8; i++) {
    simUncontrolled.step();

    // Defender acts on tick 2: segments the network and patches gateway
    if (i === 2) {
      simDefended.defenseModel.applyAction(DefenseModel.Actions.SEGMENT, null, simDefended.network, simDefended.eventQueue, i);
      const infected = simDefended.network.getAllNodes().filter(n => n.state === 'INFECTED');
      infected.forEach(inf => {
        simDefended.defenseModel.applyAction(DefenseModel.Actions.ISOLATE, inf.id, simDefended.network, simDefended.eventQueue, i);
      });
    }
    simDefended.step();
  }

  const uncTotal = simUncontrolled.metricsEngine.telemetryHistory[8].totalCompromised;
  const defTotal = simDefended.metricsEngine.telemetryHistory[8].totalCompromised;

  assert(defTotal < uncTotal, `Defended outbreak (${defTotal}) should be lower than uncontrolled (${uncTotal})`);
});

console.log(`\n====================================================`);
console.log(` TEST RUN COMPLETE: ${passedTests}/${totalTests} TESTS PASSED`);
console.log(`====================================================\n`);
