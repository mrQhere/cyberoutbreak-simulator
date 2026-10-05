/**
 * Analytics & Visualization Engine for CyberOutbreak Simulator
 * Pure projection of authoritative telemetry history from SimulationEngine.
 * Renders SEIR curves, empirical Rt trends, financial damages breakdown, and device donuts.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ChartsEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class ChartsEngine {
    constructor(canvasCurve, canvasDonut, canvasR0, canvasDamage) {
      this.canvasCurve = canvasCurve;
      this.canvasDonut = canvasDonut;
      this.canvasR0    = canvasR0;
      this.canvasDamage = canvasDamage;

      this.ctxCurve  = canvasCurve  ? canvasCurve.getContext('2d')  : null;
      this.ctxDonut  = canvasDonut  ? canvasDonut.getContext('2d')  : null;
      this.ctxR0     = canvasR0     ? canvasR0.getContext('2d')     : null;
      this.ctxDamage = canvasDamage ? canvasDamage.getContext('2d') : null;

      this.damageMode = 'daily'; // 'daily' or 'cum'

      this.initCanvasDpr();
      window.addEventListener('resize', () => { this.initCanvasDpr(); });
    }

    initCanvasDpr() {
      [
        { c: this.canvasCurve,  k: 'ctxCurve'  },
        { c: this.canvasDonut,  k: 'ctxDonut'  },
        { c: this.canvasR0,     k: 'ctxR0'     },
        { c: this.canvasDamage, k: 'ctxDamage' }
      ].forEach(item => {
        if (!item.c || !item.c.parentElement) return;
        const rect = item.c.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const w = rect.width;
        const h = rect.height || 180;

        item.c.width = Math.round(w * dpr);
        item.c.height = Math.round(h * dpr);
        item.c.style.width = `${w}px`;
        item.c.style.height = `${h}px`;

        const ctx = item.c.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
        this[item.k] = ctx;
      });
    }

    setDamageMode(mode) {
      this.damageMode = mode === 'cum' ? 'cum' : 'daily';
    }

    renderAll(history, currentTelemetry) {
      this.renderSEIRCurve(history);
      this.renderDeviceDonut(currentTelemetry);
      this.renderR0Curve(history);
      this.renderDamagesChart(history);
    }

    // ──────────────────────────────────────────────
    // 1. Authoritative SEIR Epidemic Curve
    // ──────────────────────────────────────────────
    renderSEIRCurve(history) {
      const ctx = this.ctxCurve;
      const c = this.canvasCurve;
      if (!ctx || !c || !history || history.length === 0) return;

      const w = c.width / (window.devicePixelRatio || 1);
      const h = c.height / (window.devicePixelRatio || 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);

      const padLeft = 35;
      const padBottom = 22;
      const padTop = 15;
      const padRight = 15;
      const chartW = w - padLeft - padRight;
      const chartH = h - padTop - padBottom;

      const totalNodes = history[0].total || 75;
      const maxVal = Math.max(10, totalNodes);
      const len = Math.max(5, history.length);
      const stepX = chartW / Math.max(1, len - 1);

      // Grid & Y-Axis Labels
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.15)';
      ctx.lineWidth = 1;
      ctx.fillStyle = '#64748b';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      for (let i = 0; i <= 4; i++) {
        const y = padTop + (chartH / 4) * i;
        const val = Math.round(maxVal - (maxVal / 4) * i);
        ctx.moveTo(padLeft, y);
        ctx.lineTo(w - padRight, y);
        ctx.fillText(String(val), padLeft - 6, y);
      }
      ctx.stroke();

      // X-Axis Labels (Ticks)
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const tickStep = Math.max(1, Math.floor(len / 5));
      for (let i = 0; i < len; i += tickStep) {
        const x = padLeft + i * stepX;
        ctx.fillText(`T${i}`, x, h - padBottom + 6);
      }

      const drawLine = (accessor, color, fill = false) => {
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.0;

        history.forEach((d, i) => {
          const val = accessor(d);
          const x = padLeft + i * stepX;
          const y = padTop + chartH - (val / maxVal) * chartH;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();

        if (fill) {
          ctx.lineTo(padLeft + (history.length - 1) * stepX, padTop + chartH);
          ctx.lineTo(padLeft, padTop + chartH);
          ctx.fillStyle = color.replace(')', ', 0.08)').replace('rgb', 'rgba');
          ctx.fill();
        }
      };

      // True SEIR Lines
      drawLine(d => d.susceptible, 'rgb(16, 185, 129)', true); // S = Green
      drawLine(d => d.exposed, 'rgb(245, 158, 11)', true);    // E = Amber
      drawLine(d => d.infected + (d.compromised || 0), 'rgb(239, 68, 68)', true); // I = Red
      drawLine(d => (d.recovered || 0) + (d.patched || 0), 'rgb(6, 182, 212)', true); // R/P = Cyan
    }

    // ──────────────────────────────────────────────
    // 2. Device Infection Donut
    // ──────────────────────────────────────────────
    renderDeviceDonut(telemetry) {
      const ctx = this.ctxDonut;
      const c = this.canvasDonut;
      if (!ctx || !c) return;

      const w = c.width / (window.devicePixelRatio || 1);
      const h = c.height / (window.devicePixelRatio || 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(cx, cy) - 15;

      const byDevice = (telemetry && telemetry.byDevice) ? telemetry.byDevice : {};
      const devKeys = Object.keys(byDevice);

      let totalInfected = 0;
      const slices = [];
      devKeys.forEach(k => {
        const inf = byDevice[k].infected || 0;
        if (inf > 0) {
          totalInfected += inf;
          slices.push({ label: k, count: inf });
        }
      });

      if (totalInfected === 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.lineWidth = 14;
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('0 COMPROMISED', cx, cy);
        return;
      }

      const colors = ['#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6', '#ec4899', '#3b82f6'];
      let startAngle = -Math.PI / 2;

      slices.forEach((s, idx) => {
        const sliceAngle = (s.count / totalInfected) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
        ctx.strokeStyle = colors[idx % colors.length];
        ctx.lineWidth = 14;
        ctx.stroke();
        startAngle += sliceAngle;
      });

      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 16px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(totalInfected), cx, cy - 6);

      ctx.fillStyle = '#64748b';
      ctx.font = '8.5px "JetBrains Mono", monospace';
      ctx.fillText('INFECTED', cx, cy + 9);
    }

    // ──────────────────────────────────────────────
    // 3. Empirical Reproduction Rate (Rt) Curve
    // ──────────────────────────────────────────────
    renderR0Curve(history) {
      const ctx = this.ctxR0;
      const c = this.canvasR0;
      if (!ctx || !c || !history || history.length === 0) return;

      const w = c.width / (window.devicePixelRatio || 1);
      const h = c.height / (window.devicePixelRatio || 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);

      const padLeft = 35;
      const padBottom = 22;
      const padTop = 15;
      const padRight = 15;
      const chartW = w - padLeft - padRight;
      const chartH = h - padTop - padBottom;
      const len = Math.max(5, history.length);
      const stepX = chartW / Math.max(1, len - 1);

      const maxRt = Math.max(3.0, ...history.map(d => typeof d.empiricalRt === 'number' ? d.empiricalRt : 0));

      // Grid
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.15)';
      ctx.lineWidth = 1;
      ctx.fillStyle = '#64748b';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      ctx.moveTo(padLeft, padTop); ctx.lineTo(w - padRight, padTop);
      ctx.fillText(maxRt.toFixed(1), padLeft - 6, padTop);

      ctx.moveTo(padLeft, padTop + chartH); ctx.lineTo(w - padRight, padTop + chartH);
      ctx.fillText('0.0', padLeft - 6, padTop + chartH);
      ctx.stroke();

      // Threshold Line: Rt = 1.0 (Critical Containment Threshold)
      const yThreshold = padTop + chartH - (1.0 / maxRt) * chartH;
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.moveTo(padLeft, yThreshold);
      ctx.lineTo(w - padRight, yThreshold);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillText('1.0', padLeft - 6, yThreshold);

      // Empirical Rt points & line
      ctx.beginPath();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.5;

      let started = false;
      history.forEach((d, i) => {
        if (typeof d.empiricalRt === 'number') {
          const x = padLeft + i * stepX;
          const y = padTop + chartH - (d.empiricalRt / maxRt) * chartH;
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      });
      ctx.stroke();

      // Points
      history.forEach((d, i) => {
        if (typeof d.empiricalRt === 'number') {
          const x = padLeft + i * stepX;
          const y = padTop + chartH - (d.empiricalRt / maxRt) * chartH;
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // X-Axis Labels
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const tickStep = Math.max(1, Math.floor(len / 5));
      for (let i = 0; i < len; i += tickStep) {
        const x = padLeft + i * stepX;
        ctx.fillText(`T${i}`, x, h - padBottom + 6);
      }
    }

    // ──────────────────────────────────────────────
    // 4. Financial Damages Breakdown
    // ──────────────────────────────────────────────
    renderDamagesChart(history) {
      const ctx = this.ctxDamage;
      const c = this.canvasDamage;
      if (!ctx || !c || !history || history.length === 0) return;

      const w = c.width / (window.devicePixelRatio || 1);
      const h = c.height / (window.devicePixelRatio || 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);

      const padLeft = 45;
      const padBottom = 22;
      const padTop = 15;
      const padRight = 15;
      const chartW = w - padLeft - padRight;
      const chartH = h - padTop - padBottom;
      const len = Math.max(5, history.length);

      let data = [];
      if (this.damageMode === 'cum') {
        data = history.map(d => d.damage || 0);
      } else {
        data = history.map((d, i) => {
          if (i === 0) return d.damage || 0;
          return Math.max(0, (d.damage || 0) - (history[i - 1].damage || 0));
        });
      }

      const maxVal = Math.max(1000, ...data);
      const barW = Math.max(3, (chartW / len) - 3);

      // Grid
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.15)';
      ctx.lineWidth = 1;
      ctx.fillStyle = '#64748b';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      const fmt = new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short' });
      for (let i = 0; i <= 3; i++) {
        const y = padTop + (chartH / 3) * i;
        const val = maxVal - (maxVal / 3) * i;
        ctx.moveTo(padLeft, y);
        ctx.lineTo(w - padRight, y);
        ctx.fillText('$' + fmt.format(val), padLeft - 6, y);
      }
      ctx.stroke();

      // Bars
      ctx.fillStyle = this.damageMode === 'cum' ? 'rgba(239, 68, 68, 0.85)' : 'rgba(245, 158, 11, 0.85)';
      data.forEach((val, i) => {
        if (val <= 0) return;
        const x = padLeft + i * (chartW / Math.max(1, len - 1)) - (barW / 2);
        const barH = (val / maxVal) * chartH;
        const y = padTop + chartH - barH;

        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barW, barH, [2, 2, 0, 0]);
        } else {
          ctx.rect(x, y, barW, barH);
        }
        ctx.fill();
      });

      // X-Axis Labels
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const tickStep = Math.max(1, Math.floor(len / 5));
      for (let i = 0; i < len; i += tickStep) {
        const x = padLeft + i * (chartW / Math.max(1, len - 1));
        ctx.fillText(`T${i}`, x, h - padBottom + 6);
      }
    }
  }

  return ChartsEngine;
}));
