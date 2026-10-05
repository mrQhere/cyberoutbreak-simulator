/**
 * Failure Injection Engine for CyberOutbreak Simulator
 * Allows injecting adverse simulation conditions to test resilience and defensive response.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SimCore = root.SimCore || {};
    root.SimCore.FailureInjector = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class FailureInjector {
    constructor() {
      this.activeFailures = new Set();
    }

    injectNetworkOutage(network, subnetName = null) {
      this.activeFailures.add('NETWORK_OUTAGE');
      network.getAllEdges().forEach(e => {
        if (!subnetName || e.sourceId.includes(subnetName) || e.targetId.includes(subnetName)) {
          e.block();
        }
      });
      return 'Network outage injected: links blocked';
    }

    injectFirewallFailure(network) {
      this.activeFailures.add('FIREWALL_FAILURE');
      network.getAllEdges().forEach(e => {
        e.firewallStrength = 0.0;
        if (e.state === 'SEGMENTED') e.state = 'ACTIVE';
      });
      network.getAllNodes().forEach(n => {
        n.securityControls.firewall = false;
        n.securityControls.firewallStrength = 0.0;
      });
      return 'Firewall failure injected: perimeter filtering disabled';
    }

    injectEDRFailure(network) {
      this.activeFailures.add('EDR_FAILURE');
      network.getAllNodes().forEach(n => {
        n.securityControls.edr = false;
        n.securityControls.edrEffectiveness = 0.0;
      });
      return 'EDR agent failure injected: endpoint heuristic blocking offline';
    }

    injectRouterFailure(network, routerNodeId = null) {
      this.activeFailures.add('ROUTER_FAILURE');
      let target = null;
      if (routerNodeId) {
        target = network.getNode(routerNodeId);
      } else {
        target = network.getAllNodes().find(n => n.deviceType === 'router');
      }
      if (target) {
        target.stateMachine.transitionTo('DECOMMISSIONED', { cause: 'HARDWARE_ROUTER_CRASH' });
        target.addTelemetry({ level: 'CRITICAL', message: 'Core routing engine kernel panic; interface DOWN' });
        return `Router failure injected on ${target.hostname}`;
      }
      return 'No router found to fail';
    }

    injectHighTransmissionPressure(threat, multiplier = 2.0) {
      this.activeFailures.add('HIGH_TRANSMISSION_PRESSURE');
      threat.baseTransmission = Math.min(1.0, threat.baseTransmission * multiplier);
      threat.theoreticalR0 = Number((threat.theoreticalR0 * multiplier).toFixed(1));
      return `Transmission pressure amplified ${multiplier}x`;
    }

    injectLowMonitoringCoverage(network) {
      this.activeFailures.add('LOW_MONITORING_COVERAGE');
      network.getAllNodes().forEach(n => {
        n.monitoringCoverage = 0.10;
        n.securityControls.ids = false;
      });
      return 'Low monitoring coverage injected: SIEM ingestion blinded';
    }

    resetFailures() {
      this.activeFailures.clear();
    }
  }

  return FailureInjector;
}));
