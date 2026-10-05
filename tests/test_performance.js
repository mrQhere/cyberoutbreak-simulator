/**
 * Performance Profiler & Benchmark for CyberOutbreak Simulation Core
 * Tests 100, 500, 1000, and 5000 node scales.
 */
const SimulationEngine = require('../js/simulation/SimulationEngine');
const NetworkModel = require('../js/simulation/NetworkModel');
const RandomSource = require('../js/simulation/RandomSource');
const ThreatModel = require('../js/simulation/ThreatModel');

console.log('====================================================');
console.log(' PERFORMANCE & SCALE BENCHMARK (Phase 31)');
console.log('====================================================\n');

const scales = [100, 500, 1000, 5000];

scales.forEach(count => {
  const startInit = Date.now();
  const sim = new SimulationEngine({ seed: 42, autoInit: false });
  sim.rng = new RandomSource(42);
  sim.network.generateTopology('corporate', count, sim.rng);

  sim.activeThreat = new ThreatModel({
    id: 'scale-test-threat',
    name: 'Scale Test Threat',
    baseTransmission: 0.6,
    r0: 5.0
  });

  const pzNode = sim.network.getAllNodes()[0];
  pzNode.stateMachine.transitionTo('INFECTED', { tick: 0, force: true });
  pzNode.infectionProgress = 1.0;
  pzNode.infectionTick = 0;
  sim.patientZero = { nodeId: pzNode.id, hostname: pzNode.hostname };

  sim.metricsEngine.recordTickTelemetry(0, sim.network, sim.activeThreat, sim.defenseModel);
  const initMs = Date.now() - startInit;

  // Run 10 ticks and measure time
  const startTicks = Date.now();
  for (let t = 1; t <= 10; t++) {
    sim.step();
  }
  const totalTickMs = Date.now() - startTicks;
  const avgMsPerTick = (totalTickMs / 10).toFixed(2);

  const finalTelemetry = sim.metricsEngine.telemetryHistory[sim.metricsEngine.telemetryHistory.length - 1];
  console.log(`Scale: ${count.toString().padStart(4)} nodes | Init: ${initMs.toString().padStart(4)}ms | 10 Ticks: ${totalTickMs.toString().padStart(4)}ms (${avgMsPerTick}ms/tick) | Infected: ${finalTelemetry.infected}, Exposed: ${finalTelemetry.exposed}`);

  if (count <= 1000) {
    if (avgMsPerTick > 150) {
      console.warn(`  [WARN] Tick execution exceeds 150ms at ${count} nodes`);
    }
  }
});

console.log('\n====================================================');
console.log(' BENCHMARK COMPLETED SUCCESSFULLY');
console.log('====================================================\n');
