/**
 * Defender Model for CyberOutbreak Simulator
 * Defines explicit defensive counter-measures with costs, durations, and side effects.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const NodeStateMachine = require('./NodeStateMachine');
    module.exports = factory(NodeStateMachine);
  } else {
    root.SimCore = root.SimCore || {};
    root.SimCore.DefenseModel = factory(root.SimCore.NodeStateMachine);
  }
}(typeof self !== 'undefined' ? self : this, function (NodeStateMachine) {
  'use strict';

  const DefenderActions = Object.freeze({
    INVESTIGATE: 'INVESTIGATE',
    ISOLATE: 'ISOLATE',
    PATCH: 'PATCH',
    BLOCK_EDGE: 'BLOCK_EDGE',
    RESET_CREDENTIALS: 'RESET_CREDENTIALS',
    RESTORE: 'RESTORE',
    INCREASE_MONITORING: 'INCREASE_MONITORING',
    SEGMENT: 'SEGMENT',
    DISABLE_SERVICE: 'DISABLE_SERVICE',
    DO_NOTHING: 'DO_NOTHING'
  });

  class DefenseModel {
    constructor() {
      this.actionHistory = [];
      this.activeDefensePolicies = [];
      this.totalDefenseCost = 0;
    }

    /**
     * Execute an explicit defensive action
     */
    applyAction(actionType, targetId, network, eventQueue, tick, options = {}) {
      if (typeof targetId === 'object' && targetId !== null) {
        options = targetId;
        tick = targetId.tick !== undefined ? targetId.tick : tick;
        targetId = targetId.targetId || targetId.targetNodeId;
      }

      const record = {
        action: actionType,
        targetId,
        tick: typeof tick === 'number' ? tick : 0,
        cost: 0,
        success: false,
        details: ''
      };

      switch (actionType) {
        case DefenderActions.ISOLATE: {
          const node = network.getNode(targetId);
          if (node) {
            record.cost = 300;
            node.securityControls.isolated = true;
            if (node.stateMachine.canTransitionTo(NodeStateMachine.States.ISOLATED)) {
              node.stateMachine.transitionTo(NodeStateMachine.States.ISOLATED, {
                tick,
                cause: 'DEFENDER_ISOLATION_ORDER',
                sourceEvent: 'OPERATOR'
              });
            }
            record.success = true;
            record.details = `Zero-Trust Isolation enforced on ${node.hostname} (${node.ip})`;
            node.addTelemetry({ tick, level: 'WARNING', message: 'Network adapter isolated from routing table' });

            eventQueue.enqueue({
              type: 'NODE_ISOLATED',
              tick,
              targetNodeId: node.id,
              result: 'ISOLATED',
              reason: 'Operator emergency containment'
            });
          }
          break;
        }

        case DefenderActions.RESTORE: {
          const node = network.getNode(targetId);
          if (node) {
            record.cost = 2500;
            if (node.stateMachine.canTransitionTo(NodeStateMachine.States.RECOVERING)) {
              node.stateMachine.transitionTo(NodeStateMachine.States.RECOVERING, {
                tick,
                cause: 'DEFENDER_RESTORE_INITIATED',
                sourceEvent: 'SYSADMIN'
              });
              node.ticksInRecovering = 0;
              record.success = true;
              record.details = `Clean snapshot restore initialized on ${node.hostname}`;
              node.addTelemetry({ tick, level: 'INFO', message: 'Restoring OS image from immutable backup' });

              eventQueue.enqueue({
                type: 'RESTORE_INITIATED',
                tick,
                targetNodeId: node.id,
                result: 'RECOVERING',
                reason: 'Disaster recovery workflow initiated'
              });
            } else if (node.state === NodeStateMachine.States.ISOLATED) {
              node.stateMachine.unIsolate({ tick, cause: 'RESTORING_FROM_ISOLATION' });
              node.stateMachine.transitionTo(NodeStateMachine.States.RECOVERING, { tick, cause: 'SYSADMIN_RESTORE' });
              record.success = true;
              record.details = `Restored from isolation to recovering state`;
            }
          }
          break;
        }

        case DefenderActions.PATCH: {
          const node = network.getNode(targetId);
          if (node) {
            record.cost = 750;
            node.patchLevel = 1.0;
            node.vulnerabilities.forEach(v => { v.patched = true; });
            node.securityControls.patchManager = true;

            // If susceptible, can transition to PATCHED directly
            if (node.stateMachine.canTransitionTo(NodeStateMachine.States.PATCHED)) {
              node.stateMachine.transitionTo(NodeStateMachine.States.PATCHED, {
                tick,
                cause: 'OUT_OF_BAND_SECURITY_HOTFIX',
                sourceEvent: 'PATCH_ENGINE'
              });
            }
            record.success = true;
            record.details = `Critical patch deployed. All known CVEs mitigated on ${node.hostname}`;
            node.addTelemetry({ tick, level: 'SUCCESS', message: 'Security hotfixes installed; CVEs mitigated' });

            eventQueue.enqueue({
              type: 'NODE_PATCHED',
              tick,
              targetNodeId: node.id,
              result: 'PATCHED',
              reason: 'Vulnerabilities mitigated'
            });
          }
          break;
        }

        case DefenderActions.INVESTIGATE: {
          const node = network.getNode(targetId);
          if (node) {
            record.cost = 500;
            node.monitoringCoverage = Math.min(1.0, node.monitoringCoverage + 0.35);
            node.addTelemetry({ tick, level: 'INFO', message: 'DFIR forensic triage initiated by SOC analyst' });
            record.success = true;
            record.details = `Forensic triage completed. Monitoring coverage boosted to ${Math.round(node.monitoringCoverage * 100)}%`;
          }
          break;
        }

        case DefenderActions.INCREASE_MONITORING: {
          network.getAllNodes().forEach(n => {
            if (options.subnet && n.subnet !== options.subnet) return;
            n.monitoringCoverage = Math.min(1.0, n.monitoringCoverage + 0.25);
            n.securityControls.ids = true;
          });
          record.cost = 1500;
          record.success = true;
          record.details = `SOC telemetry fidelity increased across monitored perimeter`;
          break;
        }

        case DefenderActions.SEGMENT: {
          const edges = network.getAllEdges();
          edges.forEach(e => {
            if (e.isBackbone) {
              e.firewallStrength = 0.95;
              e.state = 'SEGMENTED';
            }
          });
          record.cost = 2000;
          record.success = true;
          record.details = `Strict inter-subnet microsegmentation enforced on gateway routers`;
          break;
        }

        case DefenderActions.BLOCK_EDGE: {
          const edge = network.getEdge(targetId, options.otherNodeId);
          if (edge) {
            edge.block();
            record.cost = 200;
            record.success = true;
            record.details = `Traffic between ${edge.sourceId} and ${edge.targetId} blocked`;
          }
          break;
        }

        default:
          record.details = 'No action performed';
          break;
      }

      this.totalDefenseCost += record.cost;
      this.actionHistory.unshift(record);
      return record;
    }

    getState() {
      return {
        actionHistory: this.actionHistory.slice(0, 100),
        totalDefenseCost: this.totalDefenseCost
      };
    }

    setState(saved) {
      if (!saved) return;
      this.actionHistory = saved.actionHistory || [];
      this.totalDefenseCost = saved.totalDefenseCost || 0;
    }
  }

  DefenseModel.Actions = DefenderActions;
  return DefenseModel;
}));
