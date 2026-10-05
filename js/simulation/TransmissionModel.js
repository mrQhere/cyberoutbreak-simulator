/**
 * Causal Transmission & SEIR Epidemiological Progression Engine
 * Implements inspectable multi-factor causal transmission probabilities and
 * strict SEIR state transitions (S -> E -> I -> R/P).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const NodeStateMachine = require('./NodeStateMachine');
    module.exports = factory(NodeStateMachine);
  } else {
    root.SimCore = root.SimCore || {};
    root.SimCore.TransmissionModel = factory(root.SimCore.NodeStateMachine);
  }
}(typeof self !== 'undefined' ? self : this, function (NodeStateMachine) {
  'use strict';

  const States = NodeStateMachine.States;

  class TransmissionModel {
    constructor() {
      this.activeTransmissions = [];
    }

    /**
     * Compute multi-factor causal transmission probability and return comprehensive explanation
     * Follows the additive factor model specified in Phase 3.
     */
    evaluateTransmission(sourceNode, targetNode, network, threat, rng, context = {}) {
      const explanation = {
        sourceNodeId: sourceNode.id,
        sourceHostname: sourceNode.hostname,
        targetNodeId: targetNode.id,
        targetHostname: targetNode.hostname,
        threatId: threat.id,
        threatName: threat.name,
        factors: [],
        finalProbability: 0,
        result: 'BLOCKED',
        reason: 'UNKNOWN'
      };

      // Invariant check: target must be susceptible or exposed
      if (targetNode.state !== States.SUSCEPTIBLE && targetNode.state !== States.EXPOSED) {
        explanation.result = 'BLOCKED';
        explanation.reason = `TARGET_${targetNode.state}`;
        return explanation;
      }

      // Check network path reachability
      const reachCheck = network.canReach(sourceNode.id, targetNode.id);
      if (!reachCheck.reachable) {
        explanation.result = 'BLOCKED';
        explanation.reason = reachCheck.reason;
        explanation.factors.push({ name: 'network reachability', value: reachCheck.reason, delta: -1.0, desc: reachCheck.reason });
        return explanation;
      }

      // 1. Base Transmission anchor (e.g. 0.35)
      const baseProb = Math.max(0.15, Math.min(0.60, (threat.baseTransmission || 0.6) * 0.6));
      let p = baseProb;
      explanation.factors.push({
        name: 'baseline transmission',
        value: `${Math.round(baseProb * 100)}%`,
        delta: Number(baseProb.toFixed(2)),
        desc: `Threat baseline virulence (${threat.name})`
      });

      // 2. Network Reachability / Subnet factor
      if (sourceNode.subnet === targetNode.subnet) {
        const delta = 0.20;
        p += delta;
        explanation.factors.push({ name: 'same subnet', value: 'Local LAN broadcast', delta: +0.20, desc: 'Same broadcast domain enables direct lateral scan' });
      } else {
        const delta = reachCheck.hops <= 1 ? -0.05 : -0.15;
        p += delta;
        explanation.factors.push({ name: 'inter-subnet routing', value: `${reachCheck.hops} hops`, delta, desc: `Routed path across subnet gateway` });
      }

      // 3. Exploit Compatibility & Vulnerable Service
      let hasVulnerableService = false;
      if (threat.cves && threat.cves.length > 0) {
        const matchesCve = threat.cves.some(c => targetNode.hasVulnerability(c));
        if (matchesCve) {
          hasVulnerableService = true;
          p += 0.25;
          explanation.factors.push({ name: 'compatible attack vector', value: threat.cves[0], delta: +0.25, desc: `Unpatched CVE matches exploit signature` });
        } else {
          p -= 0.10;
          explanation.factors.push({ name: 'cve signature mismatch', value: 'Zero direct CVE match', delta: -0.10, desc: `Target lacks explicit unpatched CVE` });
        }
      } else {
        p += 0.15;
        explanation.factors.push({ name: 'generic exploit compatibility', value: 'Heuristic probe', delta: +0.15, desc: `Compatible remote service protocol` });
      }

      // 4. Target Patch Level
      if (targetNode.patchLevel < 0.5) {
        const delta = +0.20;
        p += delta;
        explanation.factors.push({ name: 'target unpatched', value: `Patch: ${Math.round(targetNode.patchLevel * 100)}%`, delta: +0.20, desc: 'Outdated security patches' });
      } else if (targetNode.patchLevel >= 0.85) {
        const delta = -0.20;
        p += delta;
        explanation.factors.push({ name: 'target hardened', value: `Patch: ${Math.round(targetNode.patchLevel * 100)}%`, delta: -0.20, desc: 'Recent vendor security rollups applied' });
      }

      // 5. Device Affinity
      const affinity = threat.targetAffinities[targetNode.deviceType] !== undefined
        ? threat.targetAffinities[targetNode.deviceType]
        : 0.5;
      if (affinity >= 0.8) {
        p += 0.15;
        explanation.factors.push({ name: 'high device affinity', value: targetNode.deviceType, delta: +0.15, desc: `Threat optimized for ${targetNode.deviceType}` });
      } else if (affinity <= 0.2) {
        p -= 0.25;
        explanation.factors.push({ name: 'low device affinity', value: targetNode.deviceType, delta: -0.25, desc: `Threat has minimal affinity for ${targetNode.deviceType}` });
      }

      // 6. Defensive Controls (EDR, Firewall, MFA)
      if (targetNode.securityControls.edr) {
        const delta = -0.20;
        p += delta;
        explanation.factors.push({ name: 'EDR active', value: 'Behavioral detection', delta: -0.20, desc: 'Endpoint detection actively intercepts injection' });
      }
      if (targetNode.securityControls.firewall && targetNode.securityControls.firewallStrength >= 0.7) {
        const delta = -0.15;
        p += delta;
        explanation.factors.push({ name: 'firewall filtering', value: 'Host firewall', delta: -0.15, desc: 'Port inspection drops unauthorized incoming SYN' });
      }
      if (targetNode.securityControls.mfa) {
        const delta = -0.15;
        p += delta;
        explanation.factors.push({ name: 'MFA requirement', value: 'Two-Factor', delta: -0.15, desc: 'Credential replay blocked by MFA' });
      }

      // 7. Threat Pressure & Outbreak Momentum
      if (threat.theoreticalR0 >= 6.0) {
        p += 0.10;
        explanation.factors.push({ name: 'epidemic velocity', value: `R0: ${threat.theoreticalR0}`, delta: +0.10, desc: 'High basic reproduction rate pressure' });
      }

      // 8. Stochastic link jitter
      const jitter = rng ? rng.uniform(-0.05, 0.05) : 0.0;
      p += jitter;
      explanation.factors.push({ name: 'stochastic variance', value: 'Network jitter', delta: Number(jitter.toFixed(2)), desc: 'Stochastic link timing' });

      // Clamp final probability
      p = Math.max(0.02, Math.min(0.95, p));
      explanation.finalProbability = Number(p.toFixed(2));

      // Roll Bernoulli using PRNG
      const roll = rng ? rng.next() : Math.random();
      const success = roll < p;

      if (success) {
        explanation.result = 'EXPLOITED';
        explanation.reason = hasVulnerableService ? 'EXPLOIT_PAYLOAD_DELIVERED' : 'LATERAL_HOP_SUCCESSFUL';
      } else {
        if (targetNode.securityControls.edr && roll < (p + 0.25)) {
          explanation.result = 'BLOCKED';
          explanation.reason = 'EDR detection';
        } else if (targetNode.securityControls.firewall && roll < (p + 0.40)) {
          explanation.result = 'BLOCKED';
          explanation.reason = 'Firewall drop';
        } else {
          explanation.result = 'PROBED';
          explanation.reason = 'Insufficient privilege / probe failed';
        }
      }

      return explanation;
    }

    /**
     * Advance SEIR incubation and recovery states for all nodes in the network
     */
    advanceSEIR(network, threat, rng, tick, eventQueue) {
      const stateChanges = [];

      network.getAllNodes().forEach(node => {
        const state = node.state;

        // 1. Nodes in EXPOSED: advance incubation progress
        if (state === States.EXPOSED) {
          node.ticksInExposed++;
          const incDuration = Math.max(1, node.incubationDuration || threat.getIncubationTicks(rng));
          node.infectionProgress = Math.min(1.0, node.ticksInExposed / incDuration);

          if (node.infectionProgress >= 1.0) {
            // Incubation complete -> transition to INFECTED
            node.stateMachine.transitionTo(States.INFECTED, {
              tick,
              cause: 'INCUBATION_COMPLETE',
              sourceEvent: node.compromiseType
            });
            node.infectionTick = tick;
            node.infectionProgress = 1.0;
            node.ticksInInfected = 0;

            const evt = {
              type: 'INFECTION_CONFIRMED',
              tick,
              sourceNodeId: node.infectedBy,
              targetNodeId: node.id,
              result: 'INFECTED',
              reason: `Incubation of ${threat.name} completed after ${node.ticksInExposed} ticks`
            };
            eventQueue.enqueue(evt);
            stateChanges.push({ node, previousState: States.EXPOSED, newState: States.INFECTED, event: evt });
          }
        }

        // 2. Nodes in INFECTED: track duration & potentially lock into COMPROMISED (e.g. ransomware)
        else if (state === States.INFECTED) {
          node.ticksInInfected++;
          node.totalDowntimeTicks++;

          // Ransomware encryption completion
          if (threat.category === 'ransomware' && node.ticksInInfected >= 2 && node.stateMachine.canTransitionTo(States.COMPROMISED)) {
            if (rng && rng.bernoulli(0.35)) {
              node.stateMachine.transitionTo(States.COMPROMISED, {
                tick,
                cause: 'RANSOMWARE_ENCRYPTION_COMPLETE',
                sourceEvent: threat.id
              });
              node.ticksInCompromised = 0;
              const evt = {
                type: 'SYSTEM_COMPROMISED',
                tick,
                targetNodeId: node.id,
                result: 'COMPROMISED',
                reason: 'Data encrypted for ransom (T1486)'
              };
              eventQueue.enqueue(evt);
              stateChanges.push({ node, previousState: States.INFECTED, newState: States.COMPROMISED, event: evt });
            }
          }
        }

        // 3. Nodes in COMPROMISED: continue accumulating downtime
        else if (state === States.COMPROMISED) {
          node.ticksInCompromised++;
          node.totalDowntimeTicks++;
        }

        // 4. Nodes in RECOVERING: progress remediation back to RECOVERED or PATCHED
        else if (state === States.RECOVERING) {
          node.ticksInRecovering++;
          node.totalDowntimeTicks++;
          const recDuration = node.recoveryDuration || threat.recoveryDuration || 4;
          if (node.ticksInRecovering >= recDuration) {
            node.stateMachine.transitionTo(States.RECOVERED, {
              tick,
              cause: 'REMEDIATION_COMPLETE',
              sourceEvent: 'INCIDENT_RESPONSE'
            });
            node.infectionProgress = 0;
            node.compromiseType = null;
            const evt = {
              type: 'NODE_RECOVERED',
              tick,
              targetNodeId: node.id,
              result: 'RECOVERED',
              reason: 'System restored from clean backup & sanitized'
            };
            eventQueue.enqueue(evt);
            stateChanges.push({ node, previousState: States.RECOVERING, newState: States.RECOVERED, event: evt });
          }
        }
      });

      return stateChanges;
    }
  }

  return TransmissionModel;
}));
