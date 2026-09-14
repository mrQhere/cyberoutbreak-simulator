// Canvas & SVG Analytics Engine for CyberOutbreak Graphs
// Light Theme / Professional Aesthetic

class ChartsEngine {
  constructor(canvasCurve, canvasDonut, canvasR0, canvasDamage) {
    this.canvasCurve = canvasCurve;
    this.canvasDonut = canvasDonut;
    this.canvasR0    = canvasR0;
    this.canvasDamage = canvasDamage;

    this.ctxCurve = canvasCurve ? canvasCurve.getContext('2d') : null;
    this.ctxDonut = canvasDonut ? canvasDonut.getContext('2d') : null;
    this.ctxR0    = canvasR0    ? canvasR0.getContext('2d') : null;
    this.ctxDamage = canvasDamage ? canvasDamage.getContext('2d') : null;

    // Default to cumulative
    this.damageMode = 'daily';

    this.initCanvasDpr();
    window.addEventListener('resize', () => {
      this.initCanvasDpr();
    });
  }

  initCanvasDpr() {
    [
      { c: this.canvasCurve,  ctxKey: 'ctxCurve'  },
      { c: this.canvasDonut,  ctxKey: 'ctxDonut'  },
      { c: this.canvasR0,     ctxKey: 'ctxR0'     },
      { c: this.canvasDamage, ctxKey: 'ctxDamage' }
    ].forEach(item => {
      if (!item.c) return;
      const rect = item.c.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = rect.width;
      const h = rect.height || 180;
      
      item.c.width = Math.round(w * dpr);
      item.c.height = Math.round(h * dpr);
      item.c.style.width = `${w}px`;
      item.c.style.height = `${h}px`;
      
      const freshCtx = item.c.getContext('2d');
      freshCtx.scale(dpr, dpr);
      this[item.ctxKey] = freshCtx;
    });
  }

  setDamageMode(mode) {
    this.damageMode = mode === 'cum' ? 'cum' : 'daily';
  }

  renderAll(history, stats) {
    this.renderEpidemicCurve(history);
    this.renderDeviceDonut(stats);
    this.renderR0Curve(history);
    this.renderDamagesChart(history);
  }

  // ──────────────────────────────────────────────
  // 1. Epidemic Curve (SEIR)
  // ──────────────────────────────────────────────
  renderEpidemicCurve(history) {
    const ctx = this.ctxCurve;
    const c = this.canvasCurve;
    if (!ctx || !c || history.length === 0) return;

    const w = c.width / (window.devicePixelRatio || 1);
    const h = c.height / (window.devicePixelRatio || 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    const padLeft = 35;
    const padBottom = 20;
    const padTop = 15;
    const padRight = 15;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;

    const maxVal = Math.max(10, ...history.map(d => Math.max(d.s || 0, d.e || 0, d.i || 0, d.r || 0)));
    const len = Math.max(10, history.length);
    const stepX = chartW / (len - 1);

    // Draw Grid & Y-Axis Labels
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.2)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#475569';
    ctx.font = '9px Inter';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    
    for (let i = 0; i <= 4; i++) {
      const y = padTop + (chartH / 4) * i;
      const val = Math.round(maxVal - (maxVal / 4) * i);
      ctx.moveTo(padLeft, y);
      ctx.lineTo(w - padRight, y);
      ctx.fillText(val.toString(), padLeft - 5, y);
    }
    ctx.stroke();

    // X-Axis Labels (Days)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const dayStep = Math.max(1, Math.floor(len / 5));
    for (let i = 0; i < len; i += dayStep) {
      const x = padLeft + i * stepX;
      ctx.fillText(`D${i+1}`, x, h - padBottom + 5);
    }

    const drawLine = (key, color) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      history.forEach((d, i) => {
        const x = padLeft + i * stepX;
        const y = padTop + chartH - (d[key] / maxVal) * chartH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Fill area under curve
      ctx.lineTo(padLeft + (history.length - 1) * stepX, padTop + chartH);
      ctx.lineTo(padLeft, padTop + chartH);
      ctx.fillStyle = color.replace(')', ', 0.1)').replace('rgb', 'rgba');
      ctx.fill();
    };

    // Draw Susceptible, Patched, Infected
    drawLine('s', 'rgb(16, 185, 129)');
    drawLine('r', 'rgb(2, 132, 199)');
    drawLine('i', 'rgb(239, 68, 68)');
  }

  // ──────────────────────────────────────────────
  // 2. Device Breakdown (Donut)
  // ──────────────────────────────────────────────
  renderDeviceDonut(stats) {
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

    const devs = ['desktop', 'laptop', 'server', 'phone', 'iot', 'router', 'scada', 'medical'];
    let totalInfected = 0;
    const slices = devs.map(d => {
      const inf = stats.byDevice[d] ? stats.byDevice[d].infected : 0;
      totalInfected += inf;
      return { label: d, val: inf };
    }).filter(s => s.val > 0);

    if (totalInfected === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.lineWidth = 12;
      ctx.stroke();
      ctx.fillStyle = '#64748b';
      ctx.font = '11px Inter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('0 INFECTIONS', cx, cy);
      return;
    }

    const colors = ['#ef4444', '#f59e0b', '#10b981', '#0284c7', '#a855f7', '#ec4899'];
    let startAngle = -Math.PI / 2;

    slices.forEach((s, i) => {
      const sliceAngle = (s.val / totalInfected) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
      ctx.strokeStyle = colors[i % colors.length];
      ctx.lineWidth = 14;
      ctx.stroke();
      startAngle += sliceAngle;
    });

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 16px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(totalInfected.toString(), cx, cy - 6);
    
    ctx.fillStyle = '#64748b';
    ctx.font = '9px Inter';
    ctx.fillText('INFECTED', cx, cy + 8);
  }

  // ──────────────────────────────────────────────
  // 3. R0 Reproduction Trend
  // ──────────────────────────────────────────────
  renderR0Curve(history) {
    const ctx = this.ctxR0;
    const c = this.canvasR0;
    if (!ctx || !c || history.length === 0) return;

    const w = c.width / (window.devicePixelRatio || 1);
    const h = c.height / (window.devicePixelRatio || 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    const padLeft = 25;
    const padBottom = 20;
    const padTop = 15;
    const padRight = 15;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;
    const len = Math.max(10, history.length);
    const stepX = chartW / (len - 1);
    const maxR0 = Math.max(2, ...history.map(d => d.r0));

    // Y-Axis Labels
    ctx.fillStyle = '#475569';
    ctx.font = '9px Inter';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('0', padLeft - 5, padTop + chartH);
    ctx.fillText(maxR0.toFixed(1), padLeft - 5, padTop);

    // Threshold line R0=1
    const y1 = padTop + chartH - (1 / maxR0) * chartH;
    ctx.beginPath();
    ctx.moveTo(padLeft, y1);
    ctx.lineTo(w - padRight, y1);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillText('1.0', padLeft - 5, y1);

    // Curve
    ctx.beginPath();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    history.forEach((d, i) => {
      const x = padLeft + i * stepX;
      const y = padTop + chartH - (d.r0 / maxR0) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // X-Axis Labels (Days)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const dayStep = Math.max(1, Math.floor(len / 5));
    for (let i = 0; i < len; i += dayStep) {
      const x = padLeft + i * stepX;
      ctx.fillText(`D${i+1}`, x, h - padBottom + 5);
    }
  }

  // ──────────────────────────────────────────────
  // 4. Financial Damages Bar Chart
  // ──────────────────────────────────────────────
  renderDamagesChart(history) {
    const ctx = this.ctxDamage;
    const c = this.canvasDamage;
    if (!ctx || !c || history.length === 0) return;

    const w = c.width / (window.devicePixelRatio || 1);
    const h = c.height / (window.devicePixelRatio || 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    const padLeft = 40;
    const padBottom = 20;
    const padTop = 15;
    const padRight = 15;
    const chartW = w - padLeft - padRight;
    const chartH = h - padTop - padBottom;
    const len = Math.max(10, history.length);
    
    // Calculate data points
    let data = [];
    if (this.damageMode === 'cum') {
      data = history.map(d => d.damage);
    } else {
      // Daily mode
      data = history.map((d, i) => {
        if (i === 0) return d.damage;
        return Math.max(0, d.damage - history[i-1].damage);
      });
    }

    const maxVal = Math.max(1000, ...data);
    const barW = Math.max(2, (chartW / len) - 2);

    // Draw grid & Y-Axis Labels
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.2)';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#475569';
    ctx.font = '9px Inter';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    
    const fmt = new Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" });
    
    for (let i = 0; i <= 3; i++) {
      const y = padTop + (chartH / 3) * i;
      const val = maxVal - (maxVal / 3) * i;
      ctx.moveTo(padLeft, y);
      ctx.lineTo(w - padRight, y);
      ctx.fillText('$' + fmt.format(val), padLeft - 5, y);
    }
    ctx.stroke();

    // Draw bars
    ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
    data.forEach((val, i) => {
      if (val <= 0) return;
      const x = padLeft + i * (chartW / (len - 1 || 1)) - (barW / 2);
      const barH = (val / maxVal) * chartH;
      const y = padTop + chartH - barH;
      
      // Slight rounding on top of bars
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, [2, 2, 0, 0]);
      ctx.fill();
    });

    // X-Axis Labels (Days)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const dayStep = Math.max(1, Math.floor(len / 5));
    for (let i = 0; i < len; i += dayStep) {
      const x = padLeft + i * (chartW / (len - 1 || 1));
      ctx.fillText(`D${i+1}`, x, h - padBottom + 5);
    }
  }
}

window.ChartsEngine = ChartsEngine;
