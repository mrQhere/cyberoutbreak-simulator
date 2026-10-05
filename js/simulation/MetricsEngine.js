/**
 * Epidemiological Metrics & Multi-Component Damage Engine for CyberOutbreak Simulator
 * Tracks ground-truth transmission lineage trees and empirical Rt calculations.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SimCore = root.SimCore || {};
    root.SimCore.MetricsEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class MetricsEngine {
    constructor() {
      this.lineage = []; // Array of { sourceId, targetId, tick, threatId }
      this.secondaryInfectionsMap = new Map(); // sourceId -> Array<targetId>
      this.telemetryHistory = []; // Tick-by-tick snapshots
      this.peakInfected = 0;
      this.timeToPeak = null;
    }

    recordTransmission(sourceId, targetId, tick, threatId) {
      this.lineage.push({ sourceId, targetId, tick, threatId });

      if (!this.secondaryInfectionsMap.has(sourceId)) {
        this.secondaryInfectionsMap.set(sourceId, []);
      }
      this.secondaryInfectionsMap.get(sourceId).push(targetId);
    }

    getSecondaryInfections(nodeId) {
      return this.secondaryInfectionsMap.get(nodeId) || [];
    }

    getTransmissionTree() {
      // Build hierarchical tree
      const roots = [];
      const childrenMap = new Map();

      this.lineage.forEach(edge => {
        if (!childrenMap.has(edge.sourceId)) {
          childrenMap.set(edge.sourceId, []);
        }
        childrenMap.get(edge.sourceId).push(edge);
      });

      // Find nodes that were infected but never had an in-network parent
      const targets = new Set(this.lineage.map(l => l.targetId));
      this.lineage.forEach(l => {
        if (!targets.has(l.sourceId)) {
          if (!roots.includes(l.sourceId)) roots.push(l.sourceId);
        }
      });

      return {
        roots,
        lineage: this.lineage.slice(),
        childrenMap
      };
    }

    /**
     * Compute empirical effective reproduction number Rt using sliding window
     */
    calculateEmpiricalRt(currentTick, windowSize = 3) {
      if (this.lineage.length === 0 || currentTick <= 1) {
        return null; // Display as N/A
      }

      const windowStart = Math.max(1, currentTick - windowSize);
      const recentTransmissions = this.lineage.filter(l => l.tick >= windowStart && l.tick <= currentTick);

      // Sources that transmitted during this window
      const activeSources = new Set(recentTransmissions.map(l => l.sourceId));
      if (activeSources.size === 0) {
        return 0.0;
      }

      // Average secondary transmissions per active source in window
      const empiricalRt = recentTransmissions.length / activeSources.size;
      return Number(empiricalRt.toFixed(2));
    }

    /**
     * Calculate mean generation interval (ticks between source and target infection)
     */
    calculateGenerationInterval(network) {
      if (this.lineage.length === 0) return null;
      let totalInterval = 0;
      let count = 0;

      this.lineage.forEach(l => {
        const source = network.getNode(l.sourceId);
        const target = network.getNode(l.targetId);
        if (source && target && typeof source.infectionTick === 'number' && typeof target.infectionTick === 'number') {
          const delta = target.infectionTick - source.infectionTick;
          if (delta >= 0) {
            totalInterval += delta;
            count++;
          }
        }
      });

      return count > 0 ? Number((totalInterval / count).toFixed(1)) : null;
    }

    /**
     * Compute multi-component financial damage traceable to specific assets and downtime
     */
    calculateDamage(network, threat, defenseCost = 0) {
      let productivityLoss = 0;
      let downtimeLoss = 0;
      let dataLossCost = 0;
      let recoveryCost = 0;
      let regulatoryImpact = 0;

      const nodes = network.getAllNodes();

      nodes.forEach(node => {
        const downtime = node.totalDowntimeTicks;
        if (downtime > 0) {
          // Downtime cost = hourly rate * ticks * criticality
          downtimeLoss += node.hourlyDowntimeCost * downtime * (node.criticality / 2.0);
          productivityLoss += (node.businessValue * 0.05) * downtime;
        }

        if (node.state === 'COMPROMISED') {
          // Compromise severity damage
          const sevFactor = threat.impactSeverity / 10;
          dataLossCost += node.businessValue * threat.damageModel.dataLossRisk * sevFactor;
          regulatoryImpact += (threat.damageModel.regulatoryPenalty || 5000) * (node.criticality >= 4.0 ? 2.0 : 1.0);
        }

        if (node.state === 'RECOVERING' || node.state === 'RECOVERED') {
          recoveryCost += node.businessValue * 0.15;
        }
      });

      const totalDamage = Math.round(productivityLoss + downtimeLoss + dataLossCost + recoveryCost + regulatoryImpact + defenseCost);

      return {
        totalDamage,
        breakdown: {
          productivityLoss: Math.round(productivityLoss),
          downtimeLoss: Math.round(downtimeLoss),
          dataLossCost: Math.round(dataLossCost),
          recoveryCost: Math.round(recoveryCost),
          regulatoryImpact: Math.round(regulatoryImpact),
          incidentResponseCost: Math.round(defenseCost)
        }
      };
    }

    /**
     * Capture authoritative telemetry record for this tick
     */
    recordTickTelemetry(tick, network, threat, defenseModel) {
      const nodes = network.getAllNodes();
      const total = nodes.length;

      let susceptible = 0;
      let exposed = 0;
      let infected = 0;
      let compromised = 0;
      let recovering = 0;
      let recovered = 0;
      let patched = 0;
      let isolated = 0;
      let decommissioned = 0;

      const byDevice = {};
      const bySubnet = {};

      nodes.forEach(n => {
        const st = n.state;
        if (st === 'SUSCEPTIBLE') susceptible++;
        else if (st === 'EXPOSED') exposed++;
        else if (st === 'INFECTED') infected++;
        else if (st === 'COMPROMISED') compromised++;
        else if (st === 'RECOVERING') recovering++;
        else if (st === 'RECOVERED') recovered++;
        else if (st === 'PATCHED') patched++;
        else if (st === 'ISOLATED') isolated++;
        else if (st === 'DECOMMISSIONED') decommissioned++;

        // Breakdown by device type
        if (!byDevice[n.deviceType]) byDevice[n.deviceType] = { total: 0, infected: 0 };
        byDevice[n.deviceType].total++;
        if (st === 'INFECTED' || st === 'COMPROMISED' || st === 'EXPOSED') {
          byDevice[n.deviceType].infected++;
        }

        // Breakdown by subnet
        if (!bySubnet[n.subnet]) bySubnet[n.subnet] = { total: 0, infected: 0 };
        bySubnet[n.subnet].total++;
        if (st === 'INFECTED' || st === 'COMPROMISED') {
          bySubnet[n.subnet].infected++;
        }
      });

      const totalActiveInfected = infected + compromised;
      if (totalActiveInfected > this.peakInfected) {
        this.peakInfected = totalActiveInfected;
        this.timeToPeak = tick;
      }

      const empiricalRt = this.calculateEmpiricalRt(tick);
      const genInterval = this.calculateGenerationInterval(network);
      const defenseCost = defenseModel ? defenseModel.totalDefenseCost : 0;
      const damageCalc = this.calculateDamage(network, threat, defenseCost);

      const totalEverInfected = infected + compromised + recovering + recovered;
      const attackRate = total > 0 ? Number(((totalEverInfected / total) * 100).toFixed(1)) : 0;

      const telemetry = {
        tick,
        total,
        susceptible,
        exposed,
        infected,
        compromised,
        totalCompromised: infected + compromised,
        recovering,
        recovered,
        patched,
        isolated,
        decommissioned,
        attackRate,
        empiricalRt, // null if N/A
        theoreticalR0: threat.theoreticalR0,
        generationInterval: genInterval,
        peakInfected: this.peakInfected,
        timeToPeak: this.timeToPeak,
        damage: damageCalc.totalDamage,
        damageBreakdown: damageCalc.breakdown,
        byDevice,
        bySubnet
      };

      this.telemetryHistory.push(telemetry);
      return telemetry;
    }

    clear() {
      this.lineage = [];
      this.secondaryInfectionsMap.clear();
      this.telemetryHistory = [];
      this.peakInfected = 0;
      this.timeToPeak = null;
    }

    getState() {
      return {
        lineage: this.lineage.slice(),
        telemetryHistory: this.telemetryHistory.slice(),
        peakInfected: this.peakInfected,
        timeToPeak: this.timeToPeak
      };
    }

    setState(saved) {
      if (!saved) return;
      this.lineage = saved.lineage || [];
      this.telemetryHistory = saved.telemetryHistory || [];
      this.peakInfected = saved.peakInfected || 0;
      this.timeToPeak = saved.timeToPeak || null;

      this.secondaryInfectionsMap.clear();
      this.lineage.forEach(l => {
        if (!this.secondaryInfectionsMap.has(l.sourceId)) {
          this.secondaryInfectionsMap.set(l.sourceId, []);
        }
        this.secondaryInfectionsMap.get(l.sourceId).push(l.targetId);
      });
    }
  }

  return MetricsEngine;
}));
