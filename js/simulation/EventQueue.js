/**
 * Deterministic Priority Event Queue for CyberOutbreak Simulator
 * Events are ordered strictly by:
 * 1. tick (ascending)
 * 2. priority (descending: higher priority executed first within same tick)
 * 3. sequenceId (ascending: deterministic insertion order break-tie)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SimCore = root.SimCore || {};
    root.SimCore.EventQueue = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class EventQueue {
    constructor() {
      this._queue = [];
      this._seq = 0;
      this._history = [];
      this.maxHistory = 5000;
    }

    /**
     * Enqueue a new simulation event
     * @param {Object} event
     * @param {string} event.type
     * @param {number} event.tick
     * @param {number} [event.priority=0] Higher value = runs earlier in same tick
     * @param {Object} [event.data={}]
     */
    enqueue(event) {
      if (!event || typeof event.type !== 'string') {
        throw new Error('Event must specify a string type');
      }

      const seq = ++this._seq;
      const tick = typeof event.tick === 'number' ? event.tick : 0;
      const priority = typeof event.priority === 'number' ? event.priority : 0;

      const fullEvent = {
        id: event.id || `evt-${tick}-${seq}`,
        seq,
        type: event.type,
        tick,
        priority,
        data: event.data || {},
        sourceNodeId: event.sourceNodeId || null,
        targetNodeId: event.targetNodeId || null,
        result: event.result || null,
        reason: event.reason || null
      };

      // Binary search insertion to keep queue sorted
      let low = 0;
      let high = this._queue.length;

      while (low < high) {
        const mid = (low + high) >>> 1;
        const item = this._queue[mid];

        // Comparison logic: tick ASC, priority DESC, seq ASC
        let cmp = item.tick - fullEvent.tick;
        if (cmp === 0) {
          cmp = fullEvent.priority - item.priority; // higher priority first
        }
        if (cmp === 0) {
          cmp = item.seq - fullEvent.seq;
        }

        if (cmp <= 0) {
          low = mid + 1;
        } else {
          high = mid;
        }
      }

      this._queue.splice(low, 0, fullEvent);
      return fullEvent;
    }

    dequeue() {
      if (this._queue.length === 0) return null;
      const evt = this._queue.shift();
      this._history.push(evt);
      if (this._history.length > this.maxHistory) {
        this._history.shift();
      }
      return evt;
    }

    peek() {
      return this._queue.length > 0 ? this._queue[0] : null;
    }

    isEmpty() {
      return this._queue.length === 0;
    }

    size() {
      return this._queue.length;
    }

    clear() {
      this._queue = [];
      this._history = [];
      this._seq = 0;
    }

    getHistory() {
      return this._history.slice();
    }

    drainForTick(currentTick) {
      const ready = [];
      while (this._queue.length > 0 && this._queue[0].tick <= currentTick) {
        ready.push(this.dequeue());
      }
      return ready;
    }

    getState() {
      return {
        queue: JSON.parse(JSON.stringify(this._queue)),
        seq: this._seq,
        historyCount: this._history.length
      };
    }

    setState(state) {
      if (state) {
        this._queue = state.queue ? JSON.parse(JSON.stringify(state.queue)) : [];
        this._seq = state.seq || 0;
      }
    }
  }

  return EventQueue;
}));
