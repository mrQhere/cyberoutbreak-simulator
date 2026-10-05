/**
 * Deterministic Pseudo-Random Number Generator (PRNG)
 * Uses Mulberry32 seeded via SplitMix32 for high quality and reproducible distributions.
 * No dependencies on Math.random().
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SimCore = root.SimCore || {};
    root.SimCore.RandomSource = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class RandomSource {
    constructor(seed = 12345) {
      this.initialSeed = typeof seed === 'number' ? seed : this._hashString(String(seed));
      this.seed = this.initialSeed;
      this.state = this._splitmix32(this.seed);
    }

    _hashString(str) {
      let hash = 0x811c9dc5;
      for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
      }
      return hash >>> 0;
    }

    _splitmix32(a) {
      a = a | 0;
      a = a + 0x9e3779b9 | 0;
      let t = a ^ a >>> 16;
      t = Math.imul(t, 0x21f0aaad);
      t = t ^ t >>> 15;
      t = Math.imul(t, 0x735a2d97);
      return (t ^ t >>> 15) >>> 0;
    }

    /**
     * Mulberry32 algorithm
     * @returns {number} Float in range [0, 1)
     */
    next() {
      let z = (this.state += 0x6D2B79F5) | 0;
      z = Math.imul(z ^ z >>> 15, z | 1);
      z ^= z + Math.imul(z ^ z >>> 7, z | 61);
      return ((z ^ z >>> 14) >>> 0) / 4294967296;
    }

    /**
     * Uniform float in range [min, max)
     */
    uniform(min = 0, max = 1) {
      return min + (max - min) * this.next();
    }

    /**
     * Uniform integer in range [min, max] inclusive
     */
    integer(min, max) {
      return Math.floor(this.uniform(min, max + 1));
    }

    /**
     * Bernoulli trial with probability p
     * @param {number} p Probability of true [0, 1]
     * @returns {boolean}
     */
    bernoulli(p) {
      if (p <= 0) return false;
      if (p >= 1) return true;
      return this.next() < p;
    }

    /**
     * Pick a random element from an array
     */
    choice(arr) {
      if (!arr || arr.length === 0) return null;
      const idx = Math.floor(this.next() * arr.length);
      return arr[idx];
    }

    /**
     * Pick a random element based on relative weights
     */
    choiceWeighted(arr, weights) {
      if (!arr || arr.length === 0) return null;
      let total = 0;
      for (let i = 0; i < weights.length; i++) {
        total += Math.max(0, weights[i] || 0);
      }
      if (total <= 0) return this.choice(arr);
      const threshold = this.uniform(0, total);
      let running = 0;
      for (let i = 0; i < arr.length; i++) {
        running += Math.max(0, weights[i] || 0);
        if (running >= threshold) return arr[i];
      }
      return arr[arr.length - 1];
    }

    /**
     * Box-Muller transform for normal distribution
     */
    normal(mean = 0, std = 1) {
      let u1 = this.next();
      let u2 = this.next();
      while (u1 <= 1e-15) u1 = this.next();
      const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      return mean + z0 * std;
    }

    /**
     * Exponential distribution with rate lambda
     */
    exponential(rate = 1) {
      let u = this.next();
      while (u <= 1e-15) u = this.next();
      return -Math.log(1 - u) / rate;
    }

    /**
     * In-place Fisher-Yates shuffle
     */
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        const temp = arr[i];
        arr[i] = arr[j];
        arr[j] = temp;
      }
      return arr;
    }

    getState() {
      return {
        initialSeed: this.initialSeed,
        state: this.state
      };
    }

    setState(saved) {
      if (saved && typeof saved.state === 'number') {
        this.initialSeed = saved.initialSeed;
        this.state = saved.state;
      }
    }

    reset() {
      this.state = this._splitmix32(this.initialSeed);
    }
  }

  return RandomSource;
}));
