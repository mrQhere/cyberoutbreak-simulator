/**
 * Attacker Model for CyberOutbreak Simulator
 * Autonomous simulation agent governing threat traversal behavior and lateral movement policy.
 * SAFETY BOUNDARY: Pure abstract state machine agent. No real offensive code.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SimCore = root.SimCore || {};
    root.SimCore.AttackerModel = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const AttackerPolicies = Object.freeze({
    RANDOM: 'RANDOM_POLICY',
    GREEDY: 'GREEDY_POLICY',
    STEALTH: 'STEALTH_POLICY'
  });

  const AttackerActions = Object.freeze({
    DISCOVER: 'DISCOVER',
    PROBE: 'PROBE',
    ATTEMPT_TRANSMISSION: 'ATTEMPT_TRANSMISSION',
    ESTABLISH_COMPROMISE: 'ESTABLISH_COMPROMISE',
    LATERAL_MOVE: 'LATERAL_MOVE',
    TARGET_HIGH_VALUE_NODE: 'TARGET_HIGH_VALUE_NODE',
    EVADE_DETECTION: 'EVADE_DETECTION',
    CHANGE_VECTOR: 'CHANGE_VECTOR'
  });

  class AttackerModel {
    constructor(policy = AttackerPolicies.RANDOM) {
      this.policy = policy;
      this.knownTargets = new Set();
      this.actionLog = [];
    }

    setPolicy(policy) {
      if (Object.values(AttackerPolicies).includes(policy)) {
        this.policy = policy;
      }
    }

    /**
     * Choose attack attempts for this simulation tick
     * @returns {Array<{ sourceNode: NodeModel, targetNode: NodeModel, action: string }>}
     */
    planTurn(network, threat, rng) {
      const plans = [];
      const infectedNodes = network.getAllNodes().filter(n => n.state === 'INFECTED' || n.state === 'COMPROMISED');
      if (infectedNodes.length === 0) return plans;

      const susceptiblePool = network.getAllNodes().filter(n => n.state === 'SUSCEPTIBLE' || n.state === 'EXPOSED');
      if (susceptiblePool.length === 0) return plans;

      infectedNodes.forEach(source => {
        // Find reachable neighbors and subnet peers
        const neighbors = network.getNeighbors(source.id).map(nbr => nbr.node);
        const subnetNodes = network.getAllNodes().filter(n => n.subnet === source.subnet && n.id !== source.id);
        const candidates = [...new Set([...neighbors, ...subnetNodes])].filter(n => n.state === 'SUSCEPTIBLE' || n.state === 'EXPOSED');

        if (candidates.length === 0) {
          // If no local candidates, consider external routing to other subnets if reach permits
          if (rng.bernoulli(threat.networkReach * 0.4)) {
            const wanCandidates = susceptiblePool.filter(n => network.canReach(source.id, n.id).reachable);
            if (wanCandidates.length > 0) {
              candidates.push(rng.choice(wanCandidates));
            }
          }
        }

        if (candidates.length === 0) return;

        // Number of attempts per compromised node this tick
        const attemptsCount = Math.max(1, Math.min(4, Math.round(rng.uniform(1, threat.theoreticalR0 > 5 ? 3 : 2))));

        for (let a = 0; a < attemptsCount; a++) {
          let chosen = null;

          if (this.policy === AttackerPolicies.GREEDY) {
            // Prioritize highest criticality, business value, and lowest patchLevel
            const scored = candidates.map(c => ({
              node: c,
              score: (c.criticality * 2.0) + (1.0 - c.patchLevel) + (threat.targetAffinities[c.deviceType] || 0.5)
            }));
            scored.sort((x, y) => y.score - x.score);
            chosen = scored[0].node;
          } else if (this.policy === AttackerPolicies.STEALTH) {
            // Avoid EDR and high monitoring coverage nodes; target stealthy path
            const scored = candidates.map(c => ({
              node: c,
              score: (1.0 - c.monitoringCoverage) * 2.0 + (c.securityControls.edr ? 0 : 1.5)
            }));
            scored.sort((x, y) => y.score - x.score);
            chosen = scored[0].node;
          } else {
            // Random Policy
            chosen = rng.choice(candidates);
          }

          if (chosen) {
            plans.push({
              sourceNode: source,
              targetNode: chosen,
              action: chosen.criticality >= 4.0 ? AttackerActions.TARGET_HIGH_VALUE_NODE : AttackerActions.LATERAL_MOVE
            });
          }
        }
      });

      return plans;
    }

    getState() {
      return {
        policy: this.policy,
        actionLogCount: this.actionLog.length
      };
    }

    setState(saved) {
      if (saved) {
        this.policy = saved.policy || this.policy;
      }
    }
  }

  AttackerModel.Policies = AttackerPolicies;
  AttackerModel.Actions = AttackerActions;
  return AttackerModel;
}));
