/**
 * Threat Model for CyberOutbreak Simulator
 * Abstract simulation threat metadata object.
 * SAFETY BOUNDARY: Contains simulation parameters only. Never executes real exploits or malware.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SimCore = root.SimCore || {};
    root.SimCore.ThreatModel = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class ThreatModel {
    constructor(config = {}) {
      this.id = config.id || 'threat-generic';
      this.name = config.name || 'Generic Cyber Threat';
      this.category = config.category || 'worm';
      this.attackVector = config.attackVector || config.vector || 'Remote Network Exploitation';
      this.targetTypes = Array.isArray(config.targetTypes) ? config.targetTypes : [
        'workstation', 'laptop', 'server', 'database', 'domain_controller', 'iot', 'scada', 'medical', 'mobile'
      ];
      this.targetAffinities = Object.assign({
        workstation: 0.8,
        laptop: 0.8,
        server: 0.9,
        database: 0.7,
        domain_controller: 0.6,
        iot: 0.2,
        scada: 0.1,
        medical: 0.3,
        mobile: 0.1,
        router: 0.2
      }, config.targetAffinities || {});

      this.requiredServices = Array.isArray(config.requiredServices) ? config.requiredServices : [];
      this.vulnerabilityRequirements = Array.isArray(config.vulnerabilityRequirements) ? config.vulnerabilityRequirements : [];

      this.baseTransmission = typeof config.baseTransmission === 'number'
        ? config.baseTransmission
        : (typeof config.transmissionRate === 'number' ? config.transmissionRate : 0.6);

      this.theoreticalR0 = typeof config.r0 === 'number' ? config.r0 : 4.5;

      this.incubationDistribution = Object.assign({
        type: 'fixed', // 'fixed', 'uniform', 'normal'
        duration: 2,
        std: 0.5
      }, config.incubationDistribution || {});

      this.infectionDuration = typeof config.infectionDuration === 'number' ? config.infectionDuration : 10;
      this.recoveryDuration = typeof config.recoveryDuration === 'number' ? config.recoveryDuration : 4;

      this.stealth = typeof config.stealth === 'number' ? config.stealth : 5; // 1 to 10
      this.detectionDifficulty = Math.min(1.0, Math.max(0.1, this.stealth / 10));

      this.impactSeverity = typeof config.lethality === 'number' ? config.lethality : (typeof config.impactSeverity === 'number' ? config.impactSeverity : 7);
      this.lateralMovementCapability = typeof config.lateralMovementCapability === 'number' ? config.lateralMovementCapability : 0.75;
      this.networkReach = typeof config.networkReach === 'number' ? config.networkReach : 0.7;
      this.persistenceProbability = typeof config.persistenceProbability === 'number' ? config.persistenceProbability : 0.6;
      this.remediationDifficulty = typeof config.patchDifficulty === 'number' ? config.patchDifficulty : 0.4;

      this.damageModel = Object.assign({
        directLoss: config.category === 'ransomware' ? 15000 : config.category === 'scada' ? 40000 : 5000,
        hourlyDowntimeMultiplier: 1.5,
        ransomDemand: config.category === 'ransomware' ? 50000 : 0,
        dataLossRisk: config.category === 'ransomware' ? 0.8 : 0.2,
        regulatoryPenalty: config.category === 'ransomware' ? 25000 : 5000
      }, config.damageModel || {});

      this.mitreTechniques = Array.isArray(config.mitreTechniques) ? config.mitreTechniques : this._defaultMitre(this.category);
      this.cves = Array.isArray(config.cves) ? config.cves : (config.cve ? [config.cve] : []);
      this.confidence = typeof config.confidence === 'number' ? config.confidence : 0.95;
      this.source = config._source || config.source || 'BUILT_IN';
      this.description = config.description || 'Abstract simulated malware profile.';
      this.realWorldImpact = config.realWorldImpact || 'Historical simulation profile.';
    }

    _defaultMitre(cat) {
      switch (cat) {
        case 'ransomware': return ['T1486 (Data Encrypted for Impact)', 'T1490 (Inhibit System Recovery)', 'T1078 (Valid Accounts)'];
        case 'worm': return ['T1210 (Exploitation of Remote Services)', 'T1021 (Remote Services)', 'T1018 (Remote System Discovery)'];
        case 'botnet': return ['T1071 (Application Layer Protocol)', 'T1110 (Brute Force)', 'T1498 (Network Denial of Service)'];
        case 'spyware': return ['T1113 (Screen Capture)', 'T1005 (Data from Local System)', 'T1056 (Input Capture)'];
        case 'scada': return ['T0814 (Inhibit Response Function)', 'T0855 (Unauthorized Command Message)', 'T0831 (Manipulation of Control)'];
        case 'supplychain': return ['T1195 (Supply Chain Compromise)', 'T1574 (Hijack Execution Flow)', 'T1055 (Process Injection)'];
        case 'trojan': return ['T1547 (Boot or Logon Autostart)', 'T1059 (Command and Scripting Interpreter)', 'T1105 (Ingress Tool Transfer)'];
        default: return ['T1210 (Exploitation of Remote Services)'];
      }
    }

    getIncubationTicks(rng) {
      if (!rng) return this.incubationDistribution.duration || 2;
      const dist = this.incubationDistribution;
      switch (dist.type) {
        case 'uniform':
          return Math.max(1, Math.round(rng.uniform(dist.duration * 0.5, dist.duration * 1.5)));
        case 'normal':
          return Math.max(1, Math.round(rng.normal(dist.duration, dist.std || 0.5)));
        case 'fixed':
        default:
          return Math.max(1, dist.duration || 2);
      }
    }
  }

  return ThreatModel;
}));
