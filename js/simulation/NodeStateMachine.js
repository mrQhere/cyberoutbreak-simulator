/**
 * Explicit Node State Machine for CyberOutbreak Simulator
 * Enforces valid epidemiological and security state transitions.
 * Rejects invalid transitions with clear diagnostic reasons.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SimCore = root.SimCore || {};
    root.SimCore.NodeStateMachine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const NodeStates = Object.freeze({
    SUSCEPTIBLE: 'SUSCEPTIBLE',
    EXPOSED: 'EXPOSED',
    INFECTED: 'INFECTED',
    COMPROMISED: 'COMPROMISED',
    RECOVERING: 'RECOVERING',
    RECOVERED: 'RECOVERED',
    PATCHED: 'PATCHED',
    ISOLATED: 'ISOLATED',
    DECOMMISSIONED: 'DECOMMISSIONED'
  });

  // Valid directed graph transitions
  const ValidTransitions = Object.freeze({
    [NodeStates.SUSCEPTIBLE]: new Set([
      NodeStates.EXPOSED,
      NodeStates.INFECTED,
      NodeStates.PATCHED,
      NodeStates.ISOLATED,
      NodeStates.DECOMMISSIONED
    ]),
    [NodeStates.EXPOSED]: new Set([
      NodeStates.INFECTED,
      NodeStates.RECOVERED,
      NodeStates.PATCHED,
      NodeStates.ISOLATED,
      NodeStates.DECOMMISSIONED
    ]),
    [NodeStates.INFECTED]: new Set([
      NodeStates.COMPROMISED,
      NodeStates.RECOVERING,
      NodeStates.ISOLATED,
      NodeStates.PATCHED,
      NodeStates.RECOVERED,
      NodeStates.DECOMMISSIONED
    ]),
    [NodeStates.COMPROMISED]: new Set([
      NodeStates.RECOVERING,
      NodeStates.ISOLATED,
      NodeStates.DECOMMISSIONED
    ]),
    [NodeStates.RECOVERING]: new Set([
      NodeStates.RECOVERED,
      NodeStates.PATCHED,
      NodeStates.ISOLATED,
      NodeStates.DECOMMISSIONED
    ]),
    [NodeStates.RECOVERED]: new Set([
      NodeStates.PATCHED,
      NodeStates.SUSCEPTIBLE, // if threat mutates or immunity expires
      NodeStates.ISOLATED,
      NodeStates.DECOMMISSIONED
    ]),
    [NodeStates.PATCHED]: new Set([
      NodeStates.SUSCEPTIBLE, // if vulnerability re-introduced or zero-day variant
      NodeStates.ISOLATED,
      NodeStates.DECOMMISSIONED
    ]),
    [NodeStates.ISOLATED]: new Set([
      NodeStates.SUSCEPTIBLE,
      NodeStates.EXPOSED,
      NodeStates.INFECTED,
      NodeStates.COMPROMISED,
      NodeStates.RECOVERING,
      NodeStates.RECOVERED,
      NodeStates.PATCHED,
      NodeStates.DECOMMISSIONED
    ]),
    [NodeStates.DECOMMISSIONED]: new Set([
      NodeStates.SUSCEPTIBLE // Re-commissioned
    ])
  });

  class NodeStateMachine {
    constructor(nodeId, initialState = NodeStates.SUSCEPTIBLE) {
      this.nodeId = nodeId;
      this.currentState = initialState;
      this.previousState = null;
      this.history = [];
      this.preIsolationState = null;
    }

    canTransitionTo(targetState) {
      if (this.currentState === targetState) return false;
      const allowed = ValidTransitions[this.currentState];
      return !!(allowed && allowed.has(targetState));
    }

    transitionTo(targetState, context = {}) {
      const { tick = 0, cause = 'UNKNOWN', sourceEvent = null, force = false } = context;

      if (!force && !this.canTransitionTo(targetState)) {
        const err = new Error(`Invalid state transition: Node ${this.nodeId} cannot transition from ${this.currentState} to ${targetState}`);
        err.nodeId = this.nodeId;
        err.currentState = this.currentState;
        err.targetState = targetState;
        err.context = context;
        throw err;
      }

      const prev = this.currentState;
      if (targetState === NodeStates.ISOLATED) {
        this.preIsolationState = prev;
      }

      this.previousState = prev;
      this.currentState = targetState;

      const record = {
        tick,
        nodeId: this.nodeId,
        previousState: prev,
        newState: targetState,
        cause,
        sourceEvent,
        timestamp: tick
      };

      this.history.push(record);
      return record;
    }

    unIsolate(context = {}) {
      if (this.currentState !== NodeStates.ISOLATED) return null;
      const resumeState = this.preIsolationState || NodeStates.SUSCEPTIBLE;
      return this.transitionTo(resumeState, {
        tick: context.tick || 0,
        cause: context.cause || 'UNISOLATED_BY_OPERATOR',
        sourceEvent: context.sourceEvent || null
      });
    }

    getState() {
      return {
        currentState: this.currentState,
        previousState: this.previousState,
        preIsolationState: this.preIsolationState,
        historyCount: this.history.length
      };
    }

    setState(saved) {
      if (saved) {
        this.currentState = saved.currentState;
        this.previousState = saved.previousState;
        this.preIsolationState = saved.preIsolationState;
      }
    }
  }

  NodeStateMachine.States = NodeStates;
  NodeStateMachine.ValidTransitions = ValidTransitions;

  return NodeStateMachine;
}));
