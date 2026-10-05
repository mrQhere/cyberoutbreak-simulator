/**
 * Scenario Engine & Catalog for CyberOutbreak Simulator
 * Manages deterministic scenario presets, custom scenario creation, and explicit Patient Zero assignment.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const ThreatModel = require('./ThreatModel');
    module.exports = factory(ThreatModel);
  } else {
    root.SimCore = root.SimCore || {};
    root.SimCore.ScenarioEngine = factory(root.SimCore.ThreatModel);
  }
}(typeof self !== 'undefined' ? self : this, function (ThreatModel) {
  'use strict';

  const BuiltInScenarios = [
    {
      id: 'scenario-corporate-ransomware',
      name: 'Corporate Ransomware Outbreak',
      description: 'Active LockBit/WannaCry cryptoworm outbreak targeting enterprise active directory and unpatched file servers.',
      topology: 'corporate',
      deviceCount: 75,
      seed: 424242,
      threatId: 'wannacry',
      attackerPolicy: 'GREEDY_POLICY',
      duration: 30,
      patientZero: {
        selectionPolicy: 'AFFINITY_MATCH',
        preferredDeviceType: 'workstation',
        preferredSubnet: 'Executive Suite',
        initialVector: 'Phishing Email attachment with macro execution (T1566.001)',
        reason: 'Executive opened targeted invoice attachment bypassing legacy spam gateway'
      },
      winConditions: { maxInfectedRatio: 0.30, maxDamage: 250000, containWithinTicks: 15 },
      lossConditions: { maxInfectedRatio: 0.70, maxDamage: 800000 }
    },
    {
      id: 'scenario-iot-botnet',
      name: 'IoT Botnet Swarm Outbreak',
      description: 'Mirai-style Telnet brute-force swarm enslaving smart surveillance cameras and edge routers into a massive C2 botnet.',
      topology: 'iot_grid',
      deviceCount: 80,
      seed: 888111,
      threatId: 'mirai',
      attackerPolicy: 'RANDOM_POLICY',
      duration: 25,
      patientZero: {
        selectionPolicy: 'DEVICE_TYPE',
        preferredDeviceType: 'iot',
        preferredSubnet: 'Municipal Surveillance',
        initialVector: 'Telnet factory default credential brute force (T1110.001)',
        reason: 'Public IP camera exposed with default credentials admin/admin'
      },
      winConditions: { maxInfectedRatio: 0.25, maxDamage: 150000, containWithinTicks: 12 },
      lossConditions: { maxInfectedRatio: 0.65, maxDamage: 500000 }
    },
    {
      id: 'scenario-healthcare-malware',
      name: 'Hospital ICU & Healthcare Outbreak',
      description: 'Critical cyber outbreak compromising patient monitoring telemetry and pharmaceutical compounding workstations.',
      topology: 'healthcare',
      deviceCount: 70,
      seed: 555222,
      threatId: 'notpetya',
      attackerPolicy: 'GREEDY_POLICY',
      duration: 25,
      patientZero: {
        selectionPolicy: 'DEVICE_TYPE',
        preferredDeviceType: 'laptop',
        preferredSubnet: 'Doctors & Nursing Station',
        initialVector: 'Rogue USB thumb drive inserted into nursing station laptop (T1091)',
        reason: 'Clinical staff inserted untrusted USB drive containing patient diagnostics'
      },
      winConditions: { maxInfectedRatio: 0.15, maxDamage: 200000, containWithinTicks: 10 },
      lossConditions: { maxInfectedRatio: 0.40, maxDamage: 600000 }
    },
    {
      id: 'scenario-scada-ot',
      name: 'Industrial SCADA / ICS Physical Destruction',
      description: 'Stuxnet-class cyberweapon jumping air-gaps via technician maintenance laptops into uranium centrifuges and PLCs.',
      topology: 'scada_ot',
      deviceCount: 60,
      seed: 777333,
      threatId: 'stuxnet',
      attackerPolicy: 'STEALTH_POLICY',
      duration: 35,
      patientZero: {
        selectionPolicy: 'DEVICE_TYPE',
        preferredDeviceType: 'laptop',
        preferredSubnet: 'Operator HMI Workstations',
        initialVector: 'Contractor laptop maintenance bridge across air-gap (T0885)',
        reason: 'Vendor maintenance technician bridged offline network with infected diagnostic laptop'
      },
      winConditions: { maxInfectedRatio: 0.10, maxDamage: 300000, containWithinTicks: 15 },
      lossConditions: { maxInfectedRatio: 0.35, maxDamage: 1200000 }
    },
    {
      id: 'scenario-supply-chain',
      name: 'Supply Chain Backdoor Compromise',
      description: 'SUNBURST / XZ Utils covert build injection lying dormant before stealthily exfiltrating Active Directory credentials.',
      topology: 'corporate',
      deviceCount: 75,
      seed: 999444,
      threatId: 'solarwinds',
      attackerPolicy: 'STEALTH_POLICY',
      duration: 40,
      patientZero: {
        selectionPolicy: 'DEVICE_TYPE',
        preferredDeviceType: 'server',
        preferredSubnet: 'Core Data Center',
        initialVector: 'Digitally signed malicious IT management software update (T1195.002)',
        reason: 'Network monitoring server installed legitimate signed vendor update containing Trojan payload'
      },
      winConditions: { maxInfectedRatio: 0.20, maxDamage: 250000, containWithinTicks: 20 },
      lossConditions: { maxInfectedRatio: 0.50, maxDamage: 750000 }
    },
    {
      id: 'scenario-fast-worm',
      name: 'High-Velocity Self-Replicating Worm',
      description: 'Conficker / Morris worm utilizing remote RPC stack buffer overflows for exponential autonomous network saturation.',
      topology: 'global',
      deviceCount: 85,
      seed: 123456,
      threatId: 'conficker',
      attackerPolicy: 'RANDOM_POLICY',
      duration: 20,
      patientZero: {
        selectionPolicy: 'DEVICE_TYPE',
        preferredDeviceType: 'server',
        preferredSubnet: 'Europe Enterprise Mesh',
        initialVector: 'Unauthenticated MS08-067 RPC NetPathCanonicalize overflow (T1210)',
        reason: 'Public facing unpatched Windows Server service breached via autonomous scanner'
      },
      winConditions: { maxInfectedRatio: 0.35, maxDamage: 300000, containWithinTicks: 10 },
      lossConditions: { maxInfectedRatio: 0.75, maxDamage: 900000 }
    },
    {
      id: 'scenario-stealthy-apt',
      name: 'Stealthy Nation-State APT Intrusion',
      description: 'Pegasus / APT29 low-and-slow zero-click exploit evading SIEM detection while systematically targeting high-value assets.',
      topology: 'corporate',
      deviceCount: 75,
      seed: 314159,
      threatId: 'pegasus',
      attackerPolicy: 'STEALTH_POLICY',
      duration: 45,
      patientZero: {
        selectionPolicy: 'DEVICE_TYPE',
        preferredDeviceType: 'mobile',
        preferredSubnet: 'Executive Suite',
        initialVector: 'Zero-click CoreGraphics memory corruption iMessage (T1203)',
        reason: 'Chief Legal Officer iPhone breached silently via zero-click SMS'
      },
      winConditions: { maxInfectedRatio: 0.15, maxDamage: 200000, containWithinTicks: 25 },
      lossConditions: { maxInfectedRatio: 0.40, maxDamage: 600000 }
    }
  ];

  class ScenarioEngine {
    constructor() {
      this.customScenarios = [];
      this.activeScenario = BuiltInScenarios[0];
      this.patientZeroInfo = null;
    }

    getScenarios() {
      return [...BuiltInScenarios, ...this.customScenarios];
    }

    getScenarioById(id) {
      return this.getScenarios().find(s => s.id === id) || BuiltInScenarios[0];
    }

    saveCustomScenario(scenario) {
      if (!scenario.id) {
        scenario.id = `scenario-custom-${Date.now()}`;
      }
      this.customScenarios.push(scenario);
      return scenario;
    }

    /**
     * Resolve explicit patient zero for a given scenario & network
     */
    assignPatientZero(scenario, network, rng) {
      const pzDef = scenario.patientZero || {};
      let targetNode = null;

      // 1. Direct Node ID specified
      if (pzDef.nodeId) {
        targetNode = network.getNode(pzDef.nodeId);
      }

      // 2. Preferred subnet & device type
      if (!targetNode && pzDef.preferredSubnet) {
        const inSubnet = network.getAllNodes().filter(n => n.subnet === pzDef.preferredSubnet);
        if (pzDef.preferredDeviceType) {
          const matching = inSubnet.filter(n => n.deviceType === pzDef.preferredDeviceType);
          if (matching.length > 0) targetNode = rng ? rng.choice(matching) : matching[0];
        }
        if (!targetNode && inSubnet.length > 0) {
          targetNode = rng ? rng.choice(inSubnet) : inSubnet[0];
        }
      }

      // 3. Preferred device type
      if (!targetNode && pzDef.preferredDeviceType) {
        const matching = network.getAllNodes().filter(n => n.deviceType === pzDef.preferredDeviceType);
        if (matching.length > 0) targetNode = rng ? rng.choice(matching) : matching[0];
      }

      // 4. Fallback to any node
      if (!targetNode) {
        const all = network.getAllNodes();
        targetNode = rng ? rng.choice(all) : all[0];
      }

      this.patientZeroInfo = {
        nodeId: targetNode.id,
        hostname: targetNode.hostname,
        ip: targetNode.ip,
        deviceType: targetNode.deviceType,
        subnet: targetNode.subnet,
        initialVector: pzDef.initialVector || 'Initial Remote Access Vector',
        reason: pzDef.reason || 'Patient Zero entry point designated by scenario configuration',
        timestamp: 'Day 0, Tick 0 (Outbreak Index)',
        tick: 0
      };

      return {
        node: targetNode,
        info: this.patientZeroInfo
      };
    }
  }

  ScenarioEngine.BuiltInScenarios = BuiltInScenarios;
  return ScenarioEngine;
}));
