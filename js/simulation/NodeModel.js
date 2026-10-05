/**
 * Device Model for CyberOutbreak Simulator
 * Represents an abstract networked computational asset with rich cybersecurity properties.
 * Pure model with zero DOM/canvas dependencies.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const NodeStateMachine = require('./NodeStateMachine');
    module.exports = factory(NodeStateMachine);
  } else {
    root.SimCore = root.SimCore || {};
    root.SimCore.NodeModel = factory(root.SimCore.NodeStateMachine);
  }
}(typeof self !== 'undefined' ? self : this, function (NodeStateMachine) {
  'use strict';

  const DeviceTypes = Object.freeze({
    WORKSTATION: 'workstation',
    LAPTOP: 'laptop',
    SERVER: 'server',
    DATABASE: 'database',
    DOMAIN_CONTROLLER: 'domain_controller',
    ROUTER: 'router',
    FIREWALL: 'firewall',
    IOT: 'iot',
    SCADA: 'scada',
    MEDICAL: 'medical',
    CLOUD_SERVICE: 'cloud_service',
    MOBILE: 'mobile'
  });

  class NodeModel {
    constructor(config = {}) {
      this.id = config.id || `node-${Math.floor(Math.random() * 100000)}`;
      this.hostname = config.hostname || `host-${this.id}`;
      this.ip = config.ip || '10.0.0.1';
      this.deviceType = config.deviceType || DeviceTypes.WORKSTATION;
      this.os = config.os || 'Linux Generic';
      this.osVersion = config.osVersion || '1.0';
      this.subnet = config.subnet || 'Default Subnet';
      this.vlanId = typeof config.vlanId === 'number' ? config.vlanId : 1;

      // Business & Mission Criticality
      this.criticality = typeof config.criticality === 'number' ? config.criticality : 1.0; // 1.0 (low) to 5.0 (critical)
      this.businessValue = typeof config.businessValue === 'number' ? config.businessValue : 5000; // Replacement/Impact cost base in USD
      this.hourlyDowntimeCost = typeof config.hourlyDowntimeCost === 'number' ? config.hourlyDowntimeCost : 250;

      // Services & Network Surface
      // Each service: { name: string, port: number, protocol: 'tcp'|'udp', version: string, active: boolean }
      this.services = Array.isArray(config.services) ? config.services : [];

      // Vulnerabilities (array of { cve: string, cvss: number, vector: string, requiredPort: number, patched: boolean })
      this.vulnerabilities = Array.isArray(config.vulnerabilities) ? config.vulnerabilities : [];

      this.patchLevel = typeof config.patchLevel === 'number' ? config.patchLevel : 0.5; // 0.0 (unpatched) to 1.0 (fully patched)

      // Defense Controls & Visibility
      this.securityControls = Object.assign({
        edr: false,
        edrEffectiveness: 0.85,
        firewall: true,
        firewallStrength: 0.70,
        mfa: false,
        ids: false,
        idsCoverage: 0.60,
        patchManager: false,
        isolated: false
      }, config.securityControls || {});

      this.trustLevel = typeof config.trustLevel === 'number' ? config.trustLevel : 0.5; // 0 (untrusted) to 1.0 (high trust)
      this.userExposure = typeof config.userExposure === 'number' ? config.userExposure : 0.5; // susceptibility to phishing/social engineering
      this.networkExposure = typeof config.networkExposure === 'number' ? config.networkExposure : 0.5; // external reachable surface
      this.monitoringCoverage = typeof config.monitoringCoverage === 'number' ? config.monitoringCoverage : 0.5; // telemetry fidelity

      // State Machine
      this.stateMachine = new NodeStateMachine(this.id, config.initialState || NodeStateMachine.States.SUSCEPTIBLE);

      // Epidemiological / SEIR State Tracking
      this.infectionProgress = 0.0; // 0.0 to 1.0 during EXPOSED
      this.incubationDuration = config.incubationDuration || 3; // ticks needed to become INFECTED
      this.infectionDuration = config.infectionDuration || 10; // ticks before recovery
      this.recoveryDuration = config.recoveryDuration || 5; // ticks in RECOVERING before RECOVERED

      this.ticksInExposed = 0;
      this.ticksInInfected = 0;
      this.ticksInCompromised = 0;
      this.ticksInRecovering = 0;
      this.totalDowntimeTicks = 0;

      // Transmission Lineage (Empirical tracking)
      this.infectedBy = null; // sourceNodeId
      this.infectionVector = null;
      this.infectionTick = null;
      this.exposureTick = null;
      this.secondaryInfectionsCount = 0;
      this.transmissionAttemptsMade = 0;
      this.successfulTransmissionsMade = 0;
      this.blockedTransmissionsReceived = 0;
      this.compromiseType = null; // Threat ID

      // Telemetry Logs & Causal Chains
      this.telemetryLogs = [];
      this.causalChain = [];

      // Presentation Coordinates (projected by UI)
      this.x = typeof config.x === 'number' ? config.x : 0;
      this.y = typeof config.y === 'number' ? config.y : 0;
      this.radius = typeof config.radius === 'number' ? config.radius : 15;
    }

    get state() {
      return this.stateMachine.currentState;
    }

    hasActiveService(serviceName, port = null) {
      return this.services.some(s => s.active && s.name.toLowerCase() === serviceName.toLowerCase() && (port === null || s.port === port));
    }

    hasVulnerability(cveId) {
      return this.vulnerabilities.some(v => !v.patched && v.cve.toUpperCase() === cveId.toUpperCase());
    }

    isServiceVulnerable(serviceName, vector = null) {
      return this.vulnerabilities.some(v => {
        if (v.patched) return false;
        if (vector && v.vector && !v.vector.toLowerCase().includes(vector.toLowerCase())) return false;
        return this.services.some(s => s.active && s.name.toLowerCase() === serviceName.toLowerCase());
      });
    }

    addTelemetry(entry) {
      const record = Object.assign({
        timestamp: Date.now(),
        tick: entry.tick || 0,
        level: entry.level || 'INFO',
        message: entry.message || ''
      }, entry);
      this.telemetryLogs.unshift(record);
      if (this.telemetryLogs.length > 50) {
        this.telemetryLogs.pop();
      }
      return record;
    }

    recordCausalStep(step) {
      this.causalChain.push({
        tick: step.tick || 0,
        factor: step.factor || 'UNKNOWN',
        detail: step.detail || '',
        impact: step.impact || 0
      });
    }

    getState() {
      return {
        id: this.id,
        state: this.state,
        infectionProgress: this.infectionProgress,
        ticksInExposed: this.ticksInExposed,
        ticksInInfected: this.ticksInInfected,
        ticksInCompromised: this.ticksInCompromised,
        ticksInRecovering: this.ticksInRecovering,
        totalDowntimeTicks: this.totalDowntimeTicks,
        infectedBy: this.infectedBy,
        infectionTick: this.infectionTick,
        exposureTick: this.exposureTick,
        secondaryInfectionsCount: this.secondaryInfectionsCount,
        compromiseType: this.compromiseType,
        patchLevel: this.patchLevel,
        securityControls: Object.assign({}, this.securityControls),
        smState: this.stateMachine.getState()
      };
    }

    setState(saved) {
      if (!saved) return;
      this.infectionProgress = saved.infectionProgress || 0;
      this.ticksInExposed = saved.ticksInExposed || 0;
      this.ticksInInfected = saved.ticksInInfected || 0;
      this.ticksInCompromised = saved.ticksInCompromised || 0;
      this.ticksInRecovering = saved.ticksInRecovering || 0;
      this.totalDowntimeTicks = saved.totalDowntimeTicks || 0;
      this.infectedBy = saved.infectedBy || null;
      this.infectionTick = saved.infectionTick || null;
      this.exposureTick = saved.exposureTick || null;
      this.secondaryInfectionsCount = saved.secondaryInfectionsCount || 0;
      this.compromiseType = saved.compromiseType || null;
      this.patchLevel = saved.patchLevel !== undefined ? saved.patchLevel : this.patchLevel;
      if (saved.securityControls) {
        this.securityControls = Object.assign({}, saved.securityControls);
      }
      if (saved.smState) {
        this.stateMachine.setState(saved.smState);
      }
    }
  }

  NodeModel.DeviceTypes = DeviceTypes;
  return NodeModel;
}));
