/**
 * SimulationEngine — Authoritative Core for CyberOutbreak Simulator
 * Pure computational engine with zero DOM, canvas, or audio dependencies.
 * Fully deterministic when seeded.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const RandomSource = require('./RandomSource');
    const EventQueue = require('./EventQueue');
    const NodeStateMachine = require('./NodeStateMachine');
    const NodeModel = require('./NodeModel');
    const EdgeModel = require('./EdgeModel');
    const NetworkModel = require('./NetworkModel');
    const ThreatModel = require('./ThreatModel');
    const TransmissionModel = require('./TransmissionModel');
    const DetectionModel = require('./DetectionModel');
    const DefenseModel = require('./DefenseModel');
    const AttackerModel = require('./AttackerModel');
    const MetricsEngine = require('./MetricsEngine');
    const ScenarioEngine = require('./ScenarioEngine');
    const FailureInjector = require('./FailureInjector');
    const BuiltInThreats = require('./BuiltInThreats');

    module.exports = factory({
      RandomSource, EventQueue, NodeStateMachine, NodeModel, EdgeModel,
      NetworkModel, ThreatModel, TransmissionModel, DetectionModel,
      DefenseModel, AttackerModel, MetricsEngine, ScenarioEngine, FailureInjector,
      BuiltInThreats
    });
  } else {
    root.SimCore = root.SimCore || {};
    root.SimCore.SimulationEngine = factory(root.SimCore);
  }
}(typeof self !== 'undefined' ? self : this, function (Modules) {
  'use strict';

  const {
    RandomSource, EventQueue, NodeStateMachine, NodeModel, EdgeModel,
    NetworkModel, ThreatModel, TransmissionModel, DetectionModel,
    DefenseModel, AttackerModel, MetricsEngine, ScenarioEngine, FailureInjector
  } = Modules;

  class SimulationEngine {
    constructor(config = {}) {
      this.seed = config.seed !== undefined ? config.seed : 12345;
      this.rng = new RandomSource(this.seed);

      this.currentTick = 0;
      this.isRunning = false;
      this.maxTicks = config.maxTicks || 100;

      // Sub-engines
      this.eventQueue = new EventQueue();
      this.network = new NetworkModel();
      this.transmissionModel = new TransmissionModel();
      this.detectionModel = new DetectionModel();
      this.defenseModel = new DefenseModel();
      this.attackerModel = new AttackerModel();
      this.metricsEngine = new MetricsEngine();
      this.scenarioEngine = new ScenarioEngine();
      this.failureInjector = new FailureInjector();

      this.activeThreat = null;
      this.activeScenario = null;
      this.patientZero = null;

      // Snapshots for Replay & Rollback
      this.tickSnapshots = [];
      this.allEmittedEvents = [];

      // Event listeners
      this._eventListeners = new Map();

      // Auto-load default scenario if specified
      if (config.autoInit !== false) {
        this.loadScenario(config.scenarioId || 'scenario-corporate-ransomware', this.seed);
      }
    }

    get activeMalware() { return this.activeThreat; }
    get history() { return this.metricsEngine ? this.metricsEngine.telemetryHistory : []; }
    get alertFeed() { return this.allEmittedEvents; }
    get jumpLogs() { return this.metricsEngine ? this.metricsEngine.transmissionLineage : []; }

    on(eventType, listener) {
      if (!this._eventListeners.has(eventType)) {
        this._eventListeners.set(eventType, []);
      }
      this._eventListeners.get(eventType).push(listener);
      return () => this.off(eventType, listener);
    }

    off(eventType, listener) {
      if (!this._eventListeners.has(eventType)) return;
      const list = this._eventListeners.get(eventType);
      const idx = list.indexOf(listener);
      if (idx !== -1) list.splice(idx, 1);
    }

    emit(event) {
      this.allEmittedEvents.push(event);

      // Notify specific event listeners
      if (this._eventListeners.has(event.type)) {
        this._eventListeners.get(event.type).forEach(cb => {
          try { cb(event); } catch (e) { /* listener safety */ }
        });
      }

      // Notify universal wildcard listeners
      if (this._eventListeners.has('*')) {
        this._eventListeners.get('*').forEach(cb => {
          try { cb(event); } catch (e) { /* listener safety */ }
        });
      }
    }

    reset() {
      const scenarioId = this.activeScenario ? this.activeScenario.id : 'scenario-corporate-ransomware';
      return this.loadScenario(scenarioId, this.seed);
    }

    resetSimulation() {
      return this.reset();
    }

    loadScenario(scenarioId, seed = null) {
      if (seed !== null) {
        this.seed = seed;
      }
      this.rng = new RandomSource(this.seed);
      this.currentTick = 0;
      this.isRunning = false;
      this.tickSnapshots = [];
      this.allEmittedEvents = [];

      this.eventQueue.clear();
      this.detectionModel.clear();
      this.metricsEngine.clear();
      this.failureInjector.resetFailures();

      const scenario = this.scenarioEngine.getScenarioById(scenarioId);
      this.activeScenario = scenario;

      // Generate deterministic network topology
      this.network.generateTopology(scenario.topology, scenario.deviceCount || 75, this.rng);

      // Resolve threat configuration
      let threatConfig = typeof scenario.threat === 'object' ? Object.assign({}, scenario.threat) : { id: scenario.threatId };
      if (Modules.BuiltInThreats) {
        const found = Modules.BuiltInThreats.find(t => t.id === (threatConfig.id || scenario.threatId));
        if (found) {
          threatConfig = Object.assign({}, found, threatConfig);
        }
      }
      this.activeThreat = new ThreatModel(threatConfig);

      // Set attacker policy
      if (scenario.attackerPolicy) {
        this.attackerModel.setPolicy(scenario.attackerPolicy);
      }

      // Explicit Patient Zero designation
      const pzResult = this.scenarioEngine.assignPatientZero(scenario, this.network, this.rng);
      this.patientZero = pzResult.info;

      // Infect patient zero immediately
      const pzNode = pzResult.node;
      pzNode.stateMachine.transitionTo(NodeStateMachine.States.INFECTED, {
        tick: 0,
        cause: pzResult.info.initialVector,
        sourceEvent: 'PATIENT_ZERO_INJECTION',
        force: true
      });
      pzNode.infectionProgress = 1.0;
      pzNode.infectionTick = 0;
      pzNode.infectedBy = 'EXTERNAL_ACTOR';
      pzNode.infectionVector = pzResult.info.initialVector;
      pzNode.compromiseType = this.activeThreat.id;
      pzNode.causalExplanation = {
        factors: [
          { name: 'Patient Zero Ingress', value: pzResult.info.initialVector, delta: 1.0, desc: pzResult.info.reason },
          { name: 'Unmitigated Ingress Path', value: 'External Boundary Breach', delta: 0.0, desc: 'Direct attack vector bypass' }
        ],
        finalProbability: 1.0,
        result: 'EXPLOITED',
        reason: pzResult.info.reason,
        source: 'EXTERNAL_ACTOR',
        target: pzNode.hostname
      };
      pzNode.addTelemetry({
        tick: 0,
        level: 'CRITICAL',
        message: `Patient Zero breached: ${pzResult.info.initialVector} (${pzResult.info.reason})`
      });

      const introEvent = {
        type: 'THREAT_INTRODUCED',
        tick: 0,
        targetNodeId: pzNode.id,
        result: 'PATIENT_ZERO_ESTABLISHED',
        reason: pzResult.info.reason,
        data: {
          patientZero: this.patientZero,
          threat: {
            id: this.activeThreat.id,
            name: this.activeThreat.name,
            cves: this.activeThreat.cves,
            vector: this.activeThreat.attackVector
          }
        }
      };

      this.eventQueue.enqueue(introEvent);
      this.emit(introEvent);

      // Record baseline telemetry at tick 0
      const initialTelemetry = this.metricsEngine.recordTickTelemetry(0, this.network, this.activeThreat, this.defenseModel);
      this.captureSnapshot(0, initialTelemetry);

      return {
        scenario: this.activeScenario,
        patientZero: this.patientZero,
        telemetry: initialTelemetry
      };
    }

    /**
     * Advance the simulation by exactly 1 authoritative tick
     */
    step() {
      this.currentTick++;
      const tick = this.currentTick;
      const rng = this.rng;
      const network = this.network;
      const threat = this.activeThreat;

      const tickEvents = [];

      // 1. Drain and execute scheduled events for this tick
      const scheduled = this.eventQueue.drainForTick(tick);
      scheduled.forEach(evt => {
        this.emit(evt);
        tickEvents.push(evt);
      });

      // 2. Attacker Turn Planning & Lateral Movement Attempts
      const attackPlans = this.attackerModel.planTurn(network, threat, rng);

      attackPlans.forEach(plan => {
        const source = plan.sourceNode;
        const target = plan.targetNode;

        source.transmissionAttemptsMade++;

        // Evaluate causal transmission probability
        const evalResult = this.transmissionModel.evaluateTransmission(source, target, network, threat, rng, { outbreakDay: tick });

        const eventType = evalResult.result === 'EXPLOITED'
          ? 'TRANSMISSION_ATTEMPT'
          : (evalResult.result === 'BLOCKED' ? 'TRANSMISSION_BLOCKED' : 'PROBE_ATTEMPT');

        const transEvent = {
          type: eventType,
          tick,
          sourceNodeId: source.id,
          targetNodeId: target.id,
          result: evalResult.result,
          reason: evalResult.reason,
          data: {
            finalProbability: evalResult.finalProbability,
            factors: evalResult.factors,
            attackAction: plan.action
          }
        };

        this.eventQueue.enqueue(transEvent);
        this.emit(transEvent);
        tickEvents.push(transEvent);

        target.lastTransmissionAttempt = evalResult;

        if (evalResult.result === 'EXPLOITED') {
          target.causalExplanation = evalResult;
          source.successfulTransmissionsMade++;
          source.secondaryInfectionsCount++;

          // Record transmission lineage in metrics engine
          this.metricsEngine.recordTransmission(source.id, target.id, tick, threat.id);

          // Transition target to EXPOSED (or INFECTED if incubation is 0)
          const incDuration = threat.getIncubationTicks(rng);

          if (target.state === NodeStateMachine.States.EXPOSED) {
            // Already exposed & incubating; accumulate exposure pressure
            target.ticksInExposed++;
            target.infectionProgress = Math.min(1.0, target.ticksInExposed / (target.incubationDuration || 2));
            target.addTelemetry({
              tick,
              level: 'WARNING',
              message: `Additional lateral exposure from ${source.ip}`
            });
          } else if (target.state === NodeStateMachine.States.SUSCEPTIBLE) {
            if (incDuration > 1) {
              target.stateMachine.transitionTo(NodeStateMachine.States.EXPOSED, {
                tick,
                cause: `${threat.name} delivered by ${source.hostname} via ${threat.attackVector}`,
                sourceEvent: transEvent.id
              });
              target.infectedBy = source.id;
              target.exposureTick = tick;
              target.incubationDuration = incDuration;
              target.infectionProgress = 1.0 / incDuration;
              target.ticksInExposed = 1;
              target.compromiseType = threat.id;

              const expEvent = {
                type: 'EXPOSURE_CREATED',
                tick,
                sourceNodeId: source.id,
                targetNodeId: target.id,
                result: 'EXPOSED',
                reason: `Incubation started (${incDuration} ticks duration)`
              };
              this.eventQueue.enqueue(expEvent);
              this.emit(expEvent);
              tickEvents.push(expEvent);
            } else {
              // Immediate infection
              target.stateMachine.transitionTo(NodeStateMachine.States.INFECTED, {
                tick,
                cause: `Instant infection from ${source.hostname}`,
                sourceEvent: transEvent.id
              });
              target.infectedBy = source.id;
              target.infectionTick = tick;
              target.infectionProgress = 1.0;
              target.compromiseType = threat.id;

              const infEvent = {
                type: 'INFECTION_CONFIRMED',
                tick,
                sourceNodeId: source.id,
                targetNodeId: target.id,
                result: 'INFECTED',
                reason: `Payload delivered and executed`
              };
              this.eventQueue.enqueue(infEvent);
              this.emit(infEvent);
              tickEvents.push(infEvent);
            }
          }

          target.addTelemetry({
            tick,
            level: 'CRITICAL',
            message: `Lateral breach from ${source.ip} delivered payload ${threat.name}`
          });
        } else {
          target.blockedTransmissionsReceived++;
          target.addTelemetry({
            tick,
            level: 'WARNING',
            message: `Probe from ${source.ip} blocked: ${evalResult.reason}`
          });
        }

        // 3. Detection Engine Telemetry Alerting
        const detection = this.detectionModel.evaluateEvent(transEvent, network, threat, rng, tick);
        if (detection) {
          const alertEvt = {
            type: 'DETECTION_CREATED',
            tick,
            targetNodeId: detection.nodeId,
            result: detection.alertType,
            reason: detection.indicator,
            data: detection
          };
          this.emit(alertEvt);
          tickEvents.push(alertEvt);
        }
      });

      // 4. Advance SEIR Incubation and Recovery Progression
      const seirChanges = this.transmissionModel.advanceSEIR(network, threat, rng, tick, this.eventQueue);
      seirChanges.forEach(sc => {
        this.emit(sc.event);
        tickEvents.push(sc.event);

        const detection = this.detectionModel.evaluateEvent(sc.event, network, threat, rng, tick);
        if (detection) {
          const alertEvt = {
            type: 'DETECTION_CREATED',
            tick,
            targetNodeId: detection.nodeId,
            result: detection.alertType,
            reason: detection.indicator,
            data: detection
          };
          this.emit(alertEvt);
          tickEvents.push(alertEvt);
        }
      });

      // 5. Authoritative Telemetry Capture
      const telemetry = this.metricsEngine.recordTickTelemetry(tick, network, threat, this.defenseModel);
      telemetry.eventsThisTick = tickEvents.length;

      // 6. Capture Snapshot for Replay
      this.captureSnapshot(tick, telemetry);

      // 7. Check Win / Loss Termination Conditions
      const winLoss = this.evaluateWinLoss(telemetry);
      if (winLoss.terminated) {
        const termEvt = {
          type: 'SCENARIO_COMPLETED',
          tick,
          result: winLoss.result,
          reason: winLoss.reason,
          data: { finalMetrics: telemetry }
        };
        this.emit(termEvt);
        this.isRunning = false;
      }

      const tickFinishedEvent = {
        type: 'TICK_COMPLETED',
        tick,
        telemetry,
        events: tickEvents
      };
      this.emit(tickFinishedEvent);

      return {
        tick,
        telemetry,
        events: tickEvents,
        terminated: winLoss.terminated
      };
    }

    evaluateWinLoss(telemetry) {
      if (!this.activeScenario) return { terminated: false };
      const win = this.activeScenario.winConditions;
      const loss = this.activeScenario.lossConditions;
      const infectedRatio = (telemetry.infected + telemetry.compromised) / (telemetry.total || 1);

      if (loss && loss.maxInfectedRatio && infectedRatio >= loss.maxInfectedRatio) {
        return { terminated: true, result: 'LOSS', reason: `Infected node ratio exceeded ${Math.round(loss.maxInfectedRatio * 100)}%` };
      }
      if (loss && loss.maxDamage && telemetry.damage >= loss.maxDamage) {
        return { terminated: true, result: 'LOSS', reason: `Total financial loss exceeded $${loss.maxDamage.toLocaleString()}` };
      }

      if (telemetry.infected === 0 && telemetry.exposed === 0 && this.currentTick > 1) {
        return { terminated: true, result: 'WIN', reason: 'Threat completely eradicated from all endpoints' };
      }
      if (win && win.containWithinTicks && this.currentTick >= win.containWithinTicks && infectedRatio <= (win.maxInfectedRatio || 0.3)) {
        return { terminated: true, result: 'WIN', reason: `Contained outbreak within ${win.containWithinTicks} ticks under containment target` };
      }
      if (this.currentTick >= this.maxTicks) {
        return { terminated: true, result: 'TIMEOUT', reason: `Simulation reached max duration (${this.maxTicks} ticks)` };
      }

      return { terminated: false };
    }

    captureSnapshot(tick, telemetry) {
      const snapshot = {
        tick,
        rngState: this.rng.getState(),
        networkState: this.network.getState(),
        metricsState: this.metricsEngine.getState(),
        detectionsState: this.detectionModel.getState(),
        defenseState: this.defenseModel.getState(),
        attackerState: this.attackerModel.getState(),
        telemetry: JSON.parse(JSON.stringify(telemetry))
      };
      this.tickSnapshots.push(snapshot);
      return snapshot;
    }

    restoreSnapshotAtTick(targetTick) {
      const snap = this.tickSnapshots.find(s => s.tick === targetTick);
      if (!snap) return false;

      this.currentTick = snap.tick;
      this.rng.setState(snap.rngState);
      this.network.setState(snap.networkState);
      this.metricsEngine.setState(snap.metricsState);
      this.detectionModel.setState(snap.detectionsState);
      this.defenseModel.setState(snap.defenseState);
      this.attackerModel.setState(snap.attackerState);

      const restoreEvt = {
        type: 'SNAPSHOT_RESTORED',
        tick: targetTick,
        telemetry: snap.telemetry
      };
      this.emit(restoreEvt);
      return true;
    }

    /**
     * Return authoritative telemetry representation for current simulation tick
     */
    getAuthoritativeTelemetry() {
      const history = this.metricsEngine ? this.metricsEngine.telemetryHistory : [];
      let latest = history.length > 0 ? history[history.length - 1] : null;
      if (!latest) {
        const nodes = this.network ? this.network.getAllNodes() : [];
        const total = nodes.length;
        latest = {
          tick: this.currentTick,
          total: total,
          susceptible: total,
          exposed: 0,
          infected: 0,
          compromised: 0,
          recovering: 0,
          recovered: 0,
          patched: 0,
          isolated: 0,
          decommissioned: 0,
          attackRate: 0,
          empiricalRt: null,
          damage: 0,
          byDevice: {},
          bySubnet: {}
        };
      }
      return Object.assign({}, latest, {
        Rt: latest.empiricalRt !== undefined ? latest.empiricalRt : (latest.Rt !== undefined ? latest.Rt : null),
        currentDay: this.currentTick,
        estimatedDamage: Math.round(latest.damage || 0)
      });
    }

    getStats() {
      return this.getAuthoritativeTelemetry();
    }

    /**
     * Replay whole run or slice
     */
    getReplayData() {
      return {
        scenario: this.activeScenario,
        threat: this.activeThreat,
        seed: this.seed,
        patientZero: this.patientZero,
        maxTicks: this.currentTick,
        snapshots: this.tickSnapshots,
        events: this.allEmittedEvents
      };
    }

    serialize() {
      return {
        version: '2.0.0',
        exportedAt: new Date().toISOString(),
        seed: this.seed,
        scenarioId: this.activeScenario ? this.activeScenario.id : 'scenario-corporate-ransomware',
        scenario: this.activeScenario,
        threatId: this.activeThreat ? this.activeThreat.id : null,
        threat: this.activeThreat,
        patientZero: this.patientZero,
        currentTick: this.currentTick,
        finalTick: this.currentTick,
        totalTicks: this.currentTick,
        telemetryHistory: this.metricsEngine.telemetryHistory,
        lineage: this.metricsEngine.lineage,
        snapshots: this.tickSnapshots,
        allEvents: this.allEmittedEvents
      };
    }

    deserialize(data) {
      return this.importRunJSON(data);
    }

    exportRunJSON() {
      return JSON.stringify({
        version: '2.0.0',
        exportedAt: new Date().toISOString(),
        seed: this.seed,
        scenario: this.activeScenario,
        threat: this.activeThreat,
        patientZero: this.patientZero,
        finalTick: this.currentTick,
        telemetryHistory: this.metricsEngine.telemetryHistory,
        lineage: this.metricsEngine.lineage,
        snapshots: this.tickSnapshots,
        allEvents: this.allEmittedEvents
      }, null, 2);
    }

    importRunJSON(jsonString) {
      const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      if (!data || !data.seed || !data.snapshots) {
        throw new Error('Invalid run export format');
      }

      this.loadScenario(data.scenario.id, data.seed);
      this.tickSnapshots = data.snapshots || [];
      if (data.lineage) {
        this.metricsEngine.lineage = data.lineage.slice();
      }
      if (data.telemetryHistory) {
        this.metricsEngine.telemetryHistory = data.telemetryHistory.slice();
      }
      this.restoreSnapshotAtTick(data.finalTick);
      return data;
    }
  }

  return SimulationEngine;
}));
