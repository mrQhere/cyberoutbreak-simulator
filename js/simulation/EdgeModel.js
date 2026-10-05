/**
 * Network Edge Model for CyberOutbreak Simulator
 * Captures topology constraints: segmentation, firewall filtering, protocol reachability, and trust.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SimCore = root.SimCore || {};
    root.SimCore.EdgeModel = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SegmentationTypes = Object.freeze({
    NONE: 'NONE',
    VLAN: 'VLAN',
    FIREWALL: 'FIREWALL',
    AIR_GAP: 'AIR_GAP'
  });

  const EdgeStates = Object.freeze({
    ACTIVE: 'ACTIVE',
    BLOCKED: 'BLOCKED',
    SEGMENTED: 'SEGMENTED',
    DEGRADED: 'DEGRADED'
  });

  class EdgeModel {
    constructor(config = {}) {
      this.id = config.id || `edge-${config.sourceId}-${config.targetId}`;
      this.sourceId = config.sourceId;
      this.targetId = config.targetId;

      this.bandwidth = typeof config.bandwidth === 'number' ? config.bandwidth : 1000; // Mbps
      this.trustLevel = typeof config.trustLevel === 'number' ? config.trustLevel : 0.8; // 0.0 to 1.0
      this.latency = typeof config.latency === 'number' ? config.latency : 2; // ms
      this.segmentation = config.segmentation || SegmentationTypes.NONE;
      this.firewallStrength = typeof config.firewallStrength === 'number' ? config.firewallStrength : 0.0;
      this.monitoringLevel = typeof config.monitoringLevel === 'number' ? config.monitoringLevel : 0.5;
      this.reachable = config.reachable !== undefined ? config.reachable : true;
      this.protocolExposure = Array.isArray(config.protocolExposure) ? config.protocolExposure : ['*']; // allowed ports / protocols
      this.state = config.state || EdgeStates.ACTIVE;
      this.isBackbone = !!config.isBackbone;
      this.packetsTraversed = 0;
      this.blockedAttempts = 0;
    }

    canTraverse(protocol = null, port = null) {
      if (this.segmentation === SegmentationTypes.AIR_GAP) {
        return { allowed: false, reason: 'AIR_GAPPED' };
      }
      if (!this.reachable || this.state === EdgeStates.BLOCKED) {
        return { allowed: false, reason: 'EDGE_BLOCKED' };
      }
      if (this.state === EdgeStates.SEGMENTED && this.firewallStrength >= 0.9) {
        return { allowed: false, reason: 'ISOLATED_SEGMENT' };
      }

      if (protocol || port) {
        if (!this.protocolExposure.includes('*')) {
          const targetStr = `${protocol || '*'}/${port || '*'}`;
          const allowed = this.protocolExposure.some(rule => {
            if (rule === '*') return true;
            const [p, pt] = rule.split('/');
            const pMatch = p === '*' || !protocol || p.toLowerCase() === protocol.toLowerCase();
            const ptMatch = pt === '*' || !port || String(pt) === String(port);
            return pMatch && ptMatch;
          });
          if (!allowed) {
            return { allowed: false, reason: 'FIREWALL_PROTOCOL_FILTER' };
          }
        }
      }

      return { allowed: true, reason: 'REACHABLE' };
    }

    block() {
      this.state = EdgeStates.BLOCKED;
      this.reachable = false;
    }

    unblock() {
      this.state = EdgeStates.ACTIVE;
      this.reachable = true;
    }

    getState() {
      return {
        id: this.id,
        sourceId: this.sourceId,
        targetId: this.targetId,
        state: this.state,
        reachable: this.reachable,
        packetsTraversed: this.packetsTraversed,
        blockedAttempts: this.blockedAttempts
      };
    }

    setState(saved) {
      if (!saved) return;
      this.state = saved.state || this.state;
      this.reachable = saved.reachable !== undefined ? saved.reachable : this.reachable;
      this.packetsTraversed = saved.packetsTraversed || 0;
      this.blockedAttempts = saved.blockedAttempts || 0;
    }
  }

  EdgeModel.SegmentationTypes = SegmentationTypes;
  EdgeModel.EdgeStates = EdgeStates;
  return EdgeModel;
}));
