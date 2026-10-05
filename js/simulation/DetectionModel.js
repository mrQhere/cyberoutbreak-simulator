/**
 * Detection Model for CyberOutbreak Simulator
 * Decouples actual ground-truth infection from defender visibility and telemetry alerts.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SimCore = root.SimCore || {};
    root.SimCore.DetectionModel = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const AlertTypes = Object.freeze({
    AUTH_ANOMALY: 'authentication_anomaly',
    PROCESS_ANOMALY: 'process_anomaly',
    NETWORK_ANOMALY: 'network_anomaly',
    DNS_ANOMALY: 'dns_anomaly',
    ENDPOINT_ALERT: 'endpoint_alert',
    IDS_ALERT: 'ids_alert',
    FIREWALL_ALERT: 'firewall_alert',
    EDR_ALERT: 'edr_alert',
    FILE_INTEGRITY: 'file_integrity_alert',
    SERVICE_ANOMALY: 'service_anomaly'
  });

  class DetectionModel {
    constructor() {
      this.detections = [];
      this.knownCompromisedNodes = new Set();
      this._detectionSeq = 0;
    }

    /**
     * Evaluate whether a simulation event produces an observable telemetry alert
     */
    evaluateEvent(event, network, threat, rng, tick) {
      if (!event) return null;

      const target = event.targetNodeId ? network.getNode(event.targetNodeId) : null;
      const source = event.sourceNodeId ? network.getNode(event.sourceNodeId) : null;
      if (!target && !source) return null;

      const node = target || source;

      // Calculate detection probability:
      // High threat stealth reduces detection; high monitoring coverage & EDR increases detection
      const stealthDamping = Math.max(0.1, (11 - threat.stealth) / 10);
      let detectorStrength = node.monitoringCoverage * 0.5;

      if (node.securityControls.edr) detectorStrength += node.securityControls.edrEffectiveness * 0.40;
      if (node.securityControls.ids) detectorStrength += 0.25;
      if (node.securityControls.firewall) detectorStrength += 0.15;

      const pDetection = Math.min(0.95, Math.max(0.05, detectorStrength * stealthDamping));
      const detected = rng ? rng.bernoulli(pDetection) : Math.random() < pDetection;

      if (!detected) return null;

      // Determine alert details based on event type
      let alertType = AlertTypes.NETWORK_ANOMALY;
      let severity = 'MEDIUM';
      let confidence = Number(pDetection.toFixed(2));
      let indicator = 'Generic anomaly';
      let detectorSource = 'SIEM';

      if (node.securityControls.edr) {
        alertType = AlertTypes.EDR_ALERT;
        detectorSource = 'EDR_AGENT';
        severity = threat.impactSeverity >= 8 ? 'CRITICAL' : 'HIGH';
        indicator = `Suspicious process execution injecting into lsass.exe / svchost.exe matching ${threat.name}`;
      } else if (event.type === 'TRANSMISSION_ATTEMPT' || event.type === 'TRANSMISSION_BLOCKED') {
        alertType = AlertTypes.FIREWALL_ALERT;
        detectorSource = 'NETWORK_FIREWALL';
        severity = 'MEDIUM';
        indicator = `Lateral SMB/RPC sweep from ${source ? source.ip : 'unknown'} to ${target ? target.ip : 'unknown'}`;
      } else if (event.type === 'INFECTION_CONFIRMED' || event.type === 'SYSTEM_COMPROMISED') {
        alertType = AlertTypes.PROCESS_ANOMALY;
        detectorSource = 'HOST_MONITOR';
        severity = 'CRITICAL';
        indicator = `High CPU & unauthorized cryptographic activity detected on ${node.hostname}`;
      }

      const alertRecord = {
        id: `det-${tick}-${++this._detectionSeq}`,
        tick,
        timestamp: tick,
        nodeId: node.id,
        nodeIp: node.ip,
        nodeHostname: node.hostname,
        alertType,
        severity,
        confidence,
        source: detectorSource,
        indicator,
        relatedEventId: event.id || null,
        relatedEventType: event.type
      };

      this.detections.unshift(alertRecord);
      if (this.detections.length > 500) this.detections.pop();

      if (event.type === 'INFECTION_CONFIRMED' || event.type === 'SYSTEM_COMPROMISED') {
        this.knownCompromisedNodes.add(node.id);
      }

      return alertRecord;
    }

    getDetectionsForNode(nodeId) {
      return this.detections.filter(d => d.nodeId === nodeId);
    }

    getAllDetections() {
      return this.detections.slice();
    }

    clear() {
      this.detections = [];
      this.knownCompromisedNodes.clear();
      this._detectionSeq = 0;
    }

    getState() {
      return {
        detections: this.detections.slice(0, 100),
        knownCompromisedNodes: Array.from(this.knownCompromisedNodes),
        seq: this._detectionSeq
      };
    }

    setState(saved) {
      if (!saved) return;
      this.detections = saved.detections || [];
      this.knownCompromisedNodes = new Set(saved.knownCompromisedNodes || []);
      this._detectionSeq = saved.seq || 0;
    }
  }

  DetectionModel.AlertTypes = AlertTypes;
  return DetectionModel;
}));
