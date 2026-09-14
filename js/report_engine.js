// CyberOutbreak — Professional PDF Incident Report Generator (Light/White Theme)
// Uses jsPDF (CDN) for pure client-side PDF generation.
// Captures live canvas screenshots of all 4 charts and embeds them.

class ReportEngine {
  constructor() {
    this.PAGE_W = 210;  // A4 mm
    this.PAGE_H = 297;
    this.MARGIN = 16;
    this.COL_W  = this.PAGE_W - this.MARGIN * 2;

    // Light / Professional Color Palette (RGB arrays)
    this.C = {
      // Background tones
      bgWhite     : [255, 255, 255],
      bgLight     : [248, 250, 252],
      bgCard      : [241, 245, 249],
      bgCardAlt   : [226, 232, 240],
      // Accent colors
      red         : [220,  38,  38],
      redLight    : [254, 202, 202],
      amber       : [180, 110,   0],
      amberLight  : [254, 243, 199],
      green       : [  5, 150, 105],
      greenLight  : [209, 250, 229],
      blue        : [  2, 132, 199],
      blueLight   : [224, 242, 254],
      purple      : [ 88,  28, 135],
      purpleLight : [237, 233, 254],
      // Text
      textDark    : [ 15,  23,  42],  // nearly black
      textBody    : [ 51,  65,  85],  // slate-700
      textMuted   : [100, 116, 139],  // slate-500
      textLight   : [148, 163, 184],  // slate-400
      // Borders
      border      : [203, 213, 225],  // slate-300
      borderDark  : [148, 163, 184],  // slate-400
    };
  }

  // ──────────────────────────────────────────────
  //  Main Entry Point
  // ──────────────────────────────────────────────

  generate(simulation, network, stats) {
    if (typeof window.jspdf === 'undefined' && typeof jsPDF === 'undefined') {
      alert('PDF library not loaded yet. Please wait a moment and try again.');
      return;
    }

    const { jsPDF } = window.jspdf || window;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const malware = simulation.activeMalware;
    const history = simulation.history || [];
    const now = new Date();
    const reportId = `CBO-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Math.floor(Math.random()*9000+1000)}`;

    doc.setFont('helvetica');

    // Capture chart canvases as base64 images BEFORE generating pages
    const chartImages = this._captureCharts();

    // ── Page 1: Cover ──────────────────────────────
    this._drawCover(doc, malware, stats, now, reportId);

    // ── Page 2: Executive Summary + Epi Statistics
    doc.addPage();
    let y = this._drawPageHeader(doc, 'EXECUTIVE THREAT BRIEF', 2);
    y = this._drawExecSummary(doc, malware, stats, y);
    y = this._drawEpiStats(doc, stats, malware, y);

    // ── Page 3: Analytics Charts
    doc.addPage();
    y = this._drawPageHeader(doc, 'SIMULATION ANALYTICS & EPIDEMIC CHARTS', 3);
    y = this._drawChartsPage(doc, chartImages, history, y);

    // ── Page 4: Technical Profile + Device Table
    doc.addPage();
    y = this._drawPageHeader(doc, 'TECHNICAL PROFILE & IMPACT ANALYSIS', 4);
    y = this._drawTechProfile(doc, malware, y);
    y = this._drawDeviceTable(doc, stats, y);

    // ── Page 5: Simulation Timeline & Phase Log
    doc.addPage();
    y = this._drawPageHeader(doc, 'SIMULATION TIMELINE & ATTACK PHASES', 5);
    y = this._drawTimeline(doc, simulation, history, y);
    y = this._drawJumpLogSection(doc, simulation, y);

    // ── Page 6: Network Topology + Alerts
    doc.addPage();
    y = this._drawPageHeader(doc, 'NETWORK TOPOLOGY & THREAT INTELLIGENCE', 6);
    y = this._drawTopologySection(doc, network, stats, y);
    y = this._drawThreatFeedSection(doc, simulation, y);

    // ── Page 7: Recommendations + Appendix
    doc.addPage();
    y = this._drawPageHeader(doc, 'INCIDENT RESPONSE & RECOMMENDATIONS', 7);
    y = this._drawRecommendations(doc, malware, stats, y);
    y = this._drawAppendix(doc, malware, y);

    // Footer on all pages
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      this._drawPageFooter(doc, p, totalPages, reportId);
    }

    const filename = `CyberOutbreak_Report_${malware.name.replace(/[^a-z0-9]/gi, '_').slice(0,30)}_${now.toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  }

  // ──────────────────────────────────────────────
  //  Chart Image Capture
  // ──────────────────────────────────────────────

  _captureCharts() {
    const ids = ['chart-curve', 'chart-donut', 'chart-r0', 'chart-damages'];
    const images = {};
    ids.forEach(id => {
      const canvas = document.getElementById(id);
      if (canvas && canvas.width > 0 && canvas.height > 0) {
        try {
          images[id] = canvas.toDataURL('image/png');
        } catch(e) {
          images[id] = null;
        }
      } else {
        images[id] = null;
      }
    });
    return images;
  }

  // ──────────────────────────────────────────────
  //  Page 1 — Cover
  // ──────────────────────────────────────────────

  _drawCover(doc, malware, stats, now, reportId) {
    const { PAGE_W, PAGE_H, MARGIN } = this;

    // White background
    this._rect(doc, 0, 0, PAGE_W, PAGE_H, this.C.bgWhite, null);

    // Top blue accent bar
    this._rect(doc, 0, 0, PAGE_W, 8, this.C.blue, null);

    // Thin accent stripe
    this._rect(doc, 0, 8, PAGE_W, 1.5, this.C.red, null);

    // Header text
    doc.setFontSize(7);
    doc.setTextColor(...this.C.bgWhite);
    doc.setFont('helvetica', 'bold');
    doc.text('CYBEROUTBREAK // INCIDENT ANALYSIS REPORT — AUTHORIZED USE ONLY', PAGE_W / 2, 5.5, { align: 'center' });

    // Cover card
    this._roundRect(doc, MARGIN, 25, PAGE_W - MARGIN * 2, 200, 4, this.C.bgLight, this.C.border);

    // Top divider stripe inside card
    this._rect(doc, MARGIN, 25, PAGE_W - MARGIN * 2, 3, this.C.red, null);

    // Simulator brand
    doc.setFontSize(7.5);
    doc.setTextColor(...this.C.textMuted);
    doc.setFont('helvetica', 'normal');
    doc.text('CYBEROUTBREAK  ·  MALWARE EPIDEMIC & DEVICE JUMP SEQUENCE SIMULATOR', PAGE_W / 2, 38, { align: 'center' });

    // Title line
    doc.setFontSize(10);
    doc.setTextColor(...this.C.textBody);
    doc.setFont('helvetica', 'bold');
    doc.text('OUTBREAK INCIDENT ANALYSIS REPORT', PAGE_W / 2, 50, { align: 'center' });

    // Red separator
    doc.setDrawColor(...this.C.red);
    doc.setLineWidth(1);
    doc.line(MARGIN + 30, 54, PAGE_W - MARGIN - 30, 54);

    // Malware name large
    const nameLines = doc.splitTextToSize(malware.name.toUpperCase(), PAGE_W - MARGIN * 4);
    doc.setFontSize(20);
    doc.setTextColor(...this.C.red);
    doc.setFont('helvetica', 'bold');
    let nameY = 68;
    nameLines.forEach(line => {
      doc.text(line, PAGE_W / 2, nameY, { align: 'center' });
      nameY += 10;
    });

    // Malware type
    doc.setFontSize(9.5);
    doc.setTextColor(...this.C.blue);
    doc.setFont('helvetica', 'normal');
    doc.text(malware.type.toUpperCase(), PAGE_W / 2, nameY + 2, { align: 'center' });

    // Severity badge
    const sevBg   = malware.severity === 'CRITICAL' ? this.C.redLight    : malware.severity === 'HIGH' ? this.C.amberLight  : this.C.greenLight;
    const sevColor = malware.severity === 'CRITICAL' ? this.C.red         : malware.severity === 'HIGH' ? this.C.amber       : this.C.green;
    const badgeY   = nameY + 12;
    this._roundRect(doc, PAGE_W / 2 - 22, badgeY - 5, 44, 9, 2, sevBg, sevColor);
    doc.setFontSize(8.5);
    doc.setTextColor(...sevColor);
    doc.setFont('helvetica', 'bold');
    doc.text(`SEVERITY: ${malware.severity}`, PAGE_W / 2, badgeY + 1, { align: 'center' });

    // Meta info cards
    const metaY = badgeY + 18;
    const metaItems = [
      ['THREAT ACTOR ORIGIN',  malware.origin    || 'Unknown'],
      ['DISCOVERY YEAR',       String(malware.year || 'N/A')],
      ['CVE IDENTIFIER',       malware.cve        || 'N/A'],
      ['EXPLOIT VECTOR',       (malware.vector   || 'N/A').slice(0, 45)],
      ['BASE REPRODUCTION R0', `${malware.r0} — ${malware.r0 >= 4 ? 'PANDEMIC-LEVEL' : malware.r0 >= 2 ? 'OUTBREAK-LEVEL' : 'CONTAINED'}`],
      ['ACTIVE INFECTIONS',    `${stats.totalCompromised} / ${stats.total} (${stats.infectionRate}%)`],
    ];

    metaItems.forEach(([label, val], i) => {
      const col  = i % 2;
      const row  = Math.floor(i / 2);
      const mx   = MARGIN + col * (this.COL_W / 2 + 4);
      const my   = metaY + row * 20;
      const cellW = this.COL_W / 2 - 4;

      this._roundRect(doc, mx, my, cellW, 17, 2, this.C.bgCard, this.C.border);
      doc.setFontSize(6.5);
      doc.setTextColor(...this.C.textMuted);
      doc.setFont('helvetica', 'normal');
      doc.text(label, mx + 4, my + 5.5);
      doc.setFontSize(8.5);
      doc.setTextColor(...this.C.textDark);
      doc.setFont('helvetica', 'bold');
      doc.text(val.toString().slice(0, 40), mx + 4, my + 12.5);
    });

    // Divider
    const divY = metaY + 68;
    doc.setDrawColor(...this.C.border);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, divY, PAGE_W - MARGIN, divY);

    // Report metadata row
    const rmY = divY + 10;
    const rmItems = [
      ['REPORT ID',       reportId],
      ['GENERATED',       now.toLocaleString()],
      ['SIM DAY',         `Day ${stats.currentDay}`],
      ['EST. DAMAGE',     `$${stats.estimatedDamage} USD`]
    ];
    rmItems.forEach(([label, val], i) => {
      const x = MARGIN + i * (this.COL_W / 4);
      this._smallLabel(doc, label, x, rmY);
      doc.setFontSize(7.5);
      doc.setTextColor(...this.C.blue);
      doc.setFont('helvetica', 'bold');
      doc.text(val, x, rmY + 6);
    });

    // Bottom blue bar
    this._rect(doc, 0, PAGE_H - 8, PAGE_W, 8, this.C.blue, null);
    doc.setFontSize(6.5);
    doc.setTextColor(...this.C.bgWhite);
    doc.setFont('helvetica', 'normal');
    doc.text('CONFIDENTIAL — FOR AUTHORIZED INCIDENT RESPONSE USE ONLY', PAGE_W / 2, PAGE_H - 3.5, { align: 'center' });
  }

  // ──────────────────────────────────────────────
  //  Page Header (pages 2+)
  // ──────────────────────────────────────────────

  _drawPageHeader(doc, title, pageNum) {
    const { PAGE_W, MARGIN } = this;

    this._rect(doc, 0, 0, PAGE_W, 297, this.C.bgWhite, null);
    this._rect(doc, 0, 0, PAGE_W, 5, this.C.blue, null);
    this._rect(doc, 0, 5, PAGE_W, 1, this.C.red, null);

    doc.setFontSize(6.5);
    doc.setTextColor(...this.C.textMuted);
    doc.setFont('helvetica', 'normal');
    doc.text('CYBEROUTBREAK INCIDENT ANALYSIS REPORT // CONFIDENTIAL', MARGIN, 12);

    doc.setFontSize(13);
    doc.setTextColor(...this.C.textDark);
    doc.setFont('helvetica', 'bold');
    doc.text(title, MARGIN, 22);

    doc.setDrawColor(...this.C.borderDark);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, 25, PAGE_W - MARGIN, 25);

    return 33;
  }

  // ──────────────────────────────────────────────
  //  Executive Summary
  // ──────────────────────────────────────────────

  _drawExecSummary(doc, malware, stats, y) {
    y = this._sectionTitle(doc, 'Executive Summary', y);

    this._roundRect(doc, this.MARGIN, y, this.COL_W, 52, 3, this.C.bgLight, this.C.border);

    doc.setFontSize(7.5);
    doc.setTextColor(...this.C.textMuted);
    doc.setFont('helvetica', 'bold');
    doc.text('REAL-WORLD THREAT IMPACT:', this.MARGIN + 4, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...this.C.textBody);
    const impactLines = doc.splitTextToSize(malware.realWorldImpact || 'No data provided.', this.COL_W - 10);
    doc.text(impactLines.slice(0, 3), this.MARGIN + 4, y + 15);

    doc.setFontSize(7.5);
    doc.setTextColor(...this.C.textMuted);
    doc.setFont('helvetica', 'bold');
    doc.text('TECHNICAL DESCRIPTION:', this.MARGIN + 4, y + 35);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...this.C.textBody);
    const descLines = doc.splitTextToSize(malware.description || 'No description available.', this.COL_W - 10);
    doc.text(descLines.slice(0, 3), this.MARGIN + 4, y + 42);

    return y + 60;
  }

  // ──────────────────────────────────────────────
  //  Epi Statistics
  // ──────────────────────────────────────────────

  _drawEpiStats(doc, stats, malware, y) {
    y = this._sectionTitle(doc, '01 — Epidemiological Statistics', y);

    const kpis = [
      { label: 'MONITORED ENDPOINTS', val: stats.total,                              color: this.C.blue   },
      { label: 'TOTAL INFECTED',      val: `${stats.totalCompromised} (${stats.infectionRate}%)`, color: this.C.red    },
      { label: 'ACTIVE INFECTIONS',   val: stats.infected,                           color: this.C.red    },
      { label: 'COMPROMISED/LOCKED',  val: stats.compromised,                        color: this.C.purple },
      { label: 'PATCHED / IMMUNE',    val: `${stats.patched} (${stats.immunityRate}%)`,            color: this.C.green  },
      { label: 'EFFECTIVE R0',        val: stats.currentR0,                          color: this.C.amber  },
      { label: 'SIMULATION DAY',      val: `Day ${stats.currentDay}`,                color: this.C.blue   },
      { label: 'EST. FINANCIAL LOSS', val: `$${stats.estimatedDamage}`,              color: this.C.red    }
    ];

    const cellW = (this.COL_W - 9) / 4;
    const cellH = 24;

    kpis.forEach((kpi, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const kx  = this.MARGIN + col * (cellW + 3);
      const ky  = y + row * (cellH + 4);
      const bgColor = [
        this.C.blue,   this.C.red, this.C.red,   this.C.purple,
        this.C.green,  this.C.amber, this.C.blue, this.C.red
      ][i];
      // Card with left accent border
      this._roundRect(doc, kx, ky, cellW, cellH, 2, this.C.bgLight, this.C.border);
      this._rect(doc, kx, ky, 2.5, cellH, bgColor, null);

      doc.setFontSize(5.5);
      doc.setTextColor(...this.C.textMuted);
      doc.setFont('helvetica', 'normal');
      doc.text(kpi.label, kx + 5, ky + 7);
      doc.setFontSize(11);
      doc.setTextColor(...kpi.color);
      doc.setFont('helvetica', 'bold');
      doc.text(String(kpi.val), kx + 5, ky + 18);
    });

    // R0 interpretation bar
    const barY = y + 60;
    const r0pct = Math.min(1, stats.currentR0 / 10);
    const barColor = stats.currentR0 >= 1.5 ? this.C.red : stats.currentR0 >= 1.0 ? this.C.amber : this.C.green;
    this._roundRect(doc, this.MARGIN, barY, this.COL_W, 16, 2, this.C.bgLight, this.C.border);
    this._roundRect(doc, this.MARGIN + 2, barY + 5, (this.COL_W - 4) * r0pct, 7, 1, barColor, null);
    doc.setFontSize(7);
    doc.setTextColor(...this.C.textBody);
    doc.text(`R0 SPREAD INDEX: ${stats.currentR0} / 10.0 — ${stats.currentR0 >= 1.5 ? 'EXPONENTIAL PANDEMIC SPREAD' : stats.currentR0 >= 1.0 ? 'SUSTAINED PROPAGATION' : 'CONTAINED — BELOW THRESHOLD'}`, this.MARGIN + 4, barY + 11);

    return barY + 24;
  }

  // ──────────────────────────────────────────────
  //  Charts Page
  // ──────────────────────────────────────────────

  _drawChartsPage(doc, chartImages, history, y) {
    const halfW = (this.COL_W - 6) / 2;
    const chartH = 55;

    const chartDefs = [
      { id: 'chart-curve',   title: 'SEIR Epidemic Curve',          sub: 'Susceptible / Infected / Patched over time' },
      { id: 'chart-donut',   title: 'Device Infection Distribution', sub: 'Breakdown by device category'               },
      { id: 'chart-r0',      title: 'R0 Reproduction Trend',         sub: 'Effective R0 across simulation days'        },
      { id: 'chart-damages', title: 'Financial Damage Estimates',    sub: 'Daily or cumulative $USD impact'            },
    ];

    chartDefs.forEach((def, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const cx  = this.MARGIN + col * (halfW + 6);
      const cy  = y + row * (chartH + 22);

      // Card background
      this._roundRect(doc, cx, cy, halfW, chartH + 16, 3, this.C.bgLight, this.C.border);

      // Title
      doc.setFontSize(7.5);
      doc.setTextColor(...this.C.textDark);
      doc.setFont('helvetica', 'bold');
      doc.text(def.title, cx + 4, cy + 8);
      doc.setFontSize(6);
      doc.setTextColor(...this.C.textMuted);
      doc.setFont('helvetica', 'normal');
      doc.text(def.sub, cx + 4, cy + 13.5);

      // Embed image or draw fallback
      const img = chartImages[def.id];
      if (img) {
        try {
          doc.addImage(img, 'PNG', cx + 2, cy + 16, halfW - 4, chartH - 2);
        } catch (e) {
          this._drawFallbackChart(doc, cx + 2, cy + 16, halfW - 4, chartH - 2, history, def.id);
        }
      } else {
        this._drawFallbackChart(doc, cx + 2, cy + 16, halfW - 4, chartH - 2, history, def.id);
      }
    });

    return y + 2 * (chartH + 22) + 12;
  }

  // Inline SVG fallback chart drawn with jsPDF primitives
  _drawFallbackChart(doc, x, y, w, h, history, chartId) {
    // Draw a simple line from history data
    if (!history || history.length === 0) {
      doc.setFontSize(7);
      doc.setTextColor(...this.C.textMuted);
      doc.text('No data recorded yet.', x + w/2, y + h/2, { align: 'center' });
      return;
    }
    this._rect(doc, x, y, w, h, this.C.bgCard, null);
    const len = history.length;
    const stepX = w / Math.max(len - 1, 1);
    const key = chartId === 'chart-curve' ? 'i' : chartId === 'chart-r0' ? 'r0' : chartId === 'chart-damages' ? 'damage' : 'r';
    const maxVal = Math.max(1, ...history.map(d => d[key] || 0));
    const color  = chartId === 'chart-curve' ? this.C.red : chartId === 'chart-r0' ? this.C.amber : this.C.blue;
    doc.setDrawColor(...color);
    doc.setLineWidth(0.5);
    history.forEach((d, i) => {
      if (i === 0) return;
      const x1 = x + (i - 1) * stepX;
      const y1 = y + h - ((history[i-1][key] || 0) / maxVal) * h;
      const x2 = x + i * stepX;
      const y2 = y + h - ((d[key] || 0) / maxVal) * h;
      doc.line(x1, y1, x2, y2);
    });
  }

  // ──────────────────────────────────────────────
  //  Simulation Timeline
  // ──────────────────────────────────────────────

  _drawTimeline(doc, simulation, history, y) {
    y = this._sectionTitle(doc, '04 — Simulation Timeline', y);

    // Phase blocks (if any)
    const phases = [...(simulation.phaseLog || [])];
    // Add the current ongoing phase
    if (simulation.activeMalware) {
      phases.push({
        malware: simulation.activeMalware.name,
        startDay: phases.length === 0 ? 1 : phases[phases.length - 1].endDay,
        endDay: simulation.currentDay
      });
    }

    if (phases.length === 0) {
      doc.setFontSize(8);
      doc.setTextColor(...this.C.textMuted);
      doc.text('No simulation phases recorded yet. Launch a simulation first.', this.MARGIN, y + 6);
      return y + 20;
    }

    phases.forEach((phase, i) => {
      const py = y + i * 18;
      const isCurrent = i === phases.length - 1;
      const bg = isCurrent ? this.C.blueLight : this.C.bgCard;
      const border = isCurrent ? this.C.blue : this.C.border;

      this._roundRect(doc, this.MARGIN, py, this.COL_W, 15, 2, bg, border);
      // Phase number
      this._roundRect(doc, this.MARGIN + 2, py + 3, 9, 9, 1, isCurrent ? this.C.blue : this.C.bgCardAlt, border);
      doc.setFontSize(7);
      doc.setTextColor(...(isCurrent ? this.C.bgWhite : this.C.textBody));
      doc.setFont('helvetica', 'bold');
      doc.text(String(i + 1), this.MARGIN + 6.5, py + 9, { align: 'center' });

      // Phase name
      doc.setFontSize(8);
      doc.setTextColor(...this.C.textDark);
      doc.setFont('helvetica', 'bold');
      doc.text(`${phase.malware.slice(0, 55)}${isCurrent ? '  [ACTIVE]' : ''}`, this.MARGIN + 14, py + 7);

      // Day range
      doc.setFontSize(7);
      doc.setTextColor(...this.C.textMuted);
      doc.setFont('helvetica', 'normal');
      doc.text(`Day ${phase.startDay} → Day ${phase.endDay}  (${phase.endDay - phase.startDay} days)`, this.MARGIN + 14, py + 13);
    });

    const afterTimeline = y + phases.length * 18 + 6;

    // Key events from history
    y = afterTimeline;
    y = this._sectionTitle(doc, 'Key Simulation Events (Day Milestones)', y);

    const milestones = history.filter((_, idx) => idx === 0 || idx === Math.floor(history.length / 2) || idx === history.length - 1);
    const headers = ['DAY', 'SUSCEPTIBLE', 'INFECTED', 'PATCHED', 'R0', 'DAMAGE ($)'];
    const colW    = [15, 30, 30, 28, 20, 55];
    const rowH    = 9;

    // Header row
    this._roundRect(doc, this.MARGIN, y, this.COL_W, rowH, 1.5, this.C.bgCardAlt, this.C.border);
    let hx = this.MARGIN + 3;
    headers.forEach((h, i) => {
      doc.setFontSize(6.5);
      doc.setTextColor(...this.C.textMuted);
      doc.setFont('helvetica', 'bold');
      doc.text(h, hx, y + 6.5);
      hx += colW[i];
    });

    milestones.forEach((d, ri) => {
      const ry = y + rowH + ri * (rowH - 1);
      this._roundRect(doc, this.MARGIN, ry, this.COL_W, rowH - 1, 1, this.C.bgLight, this.C.border);
      const dmgFmt = new Intl.NumberFormat('en-US', { notation: 'compact' }).format(d.damage || 0);
      const vals = [d.day, d.s || 0, d.i || 0, d.r || 0, d.r0, '$' + dmgFmt];
      let dcx = this.MARGIN + 3;
      vals.forEach((v, vi) => {
        doc.setFontSize(7.5);
        doc.setTextColor(...this.C.textBody);
        doc.setFont('helvetica', vi === 0 ? 'bold' : 'normal');
        doc.text(String(v), dcx, ry + 6.5);
        dcx += colW[vi];
      });
    });

    return y + rowH + milestones.length * (rowH - 1) + 10;
  }

  // ──────────────────────────────────────────────
  //  Jump Log Section
  // ──────────────────────────────────────────────

  _drawJumpLogSection(doc, simulation, y) {
    if (y > 245) { doc.addPage(); y = this._drawPageHeader(doc, 'JUMP LOG CONTINUED', 99); }
    y = this._sectionTitle(doc, '05 — Device Jump Log (Last 10 Events)', y);

    const logs = (simulation.jumpLogs || []).slice(0, 10);
    if (logs.length === 0) {
      doc.setFontSize(7); doc.setTextColor(...this.C.textMuted);
      doc.text('No jump events recorded yet.', this.MARGIN, y + 6);
      return y + 16;
    }

    logs.forEach((log, i) => {
      const ly = y + i * 13;
      const statusColor = log.status === 'EXPLOITED' ? this.C.red : log.status === 'BLOCKED' ? this.C.green : log.status === 'PATCHED' ? this.C.blue : this.C.amber;
      const bg = log.status === 'EXPLOITED' ? this.C.redLight : this.C.bgLight;

      this._roundRect(doc, this.MARGIN, ly, this.COL_W, 11.5, 1.5, bg, this.C.border);

      // Status badge
      this._roundRect(doc, this.MARGIN + 2, ly + 2, 22, 7.5, 1, statusColor, null);
      doc.setFontSize(6);
      doc.setTextColor(...this.C.bgWhite);
      doc.setFont('helvetica', 'bold');
      doc.text(log.status, this.MARGIN + 13, ly + 6.5, { align: 'center' });

      // Route
      doc.setFontSize(7);
      doc.setTextColor(...this.C.textDark);
      doc.setFont('helvetica', 'normal');
      doc.text(`${log.srcIp} → ${log.dstIp}`, this.MARGIN + 27, ly + 5.5);

      // Details
      doc.setFontSize(6.5);
      doc.setTextColor(...this.C.textMuted);
      const dl = doc.splitTextToSize(log.details || '', this.COL_W - 28);
      doc.text(dl[0] || '', this.MARGIN + 27, ly + 9.5);
    });

    return y + logs.length * 13 + 6;
  }

  // ──────────────────────────────────────────────
  //  Technical Profile
  // ──────────────────────────────────────────────

  _drawTechProfile(doc, malware, y) {
    y = this._sectionTitle(doc, '02 — Malware Technical Specification', y);

    const attrs = [
      ['Transmission Rate',  `${Math.round((malware.transmissionRate || 0) * 100)}%`  ],
      ['Patch Difficulty',   `${Math.round((malware.patchDifficulty  || 0) * 100)}%`  ],
      ['Stealth Index',      `${malware.stealth    || 0} / 10`                         ],
      ['Lethality Index',    `${malware.lethality  || 0} / 10`                         ],
      ['Mutation Rate',      `${Math.round((malware.mutationRate     || 0) * 100)}%`  ],
      ['Air-Gap Hop Prob',   `${Math.round((malware.airgapHop        || 0) * 100)}%`  ],
      ['Base R0',            String(malware.r0 || 0)                                   ],
      ['CVE Reference',      malware.cve || 'N/A'                                      ]
    ];

    const cellW = (this.COL_W - 3) / 2;

    attrs.forEach(([label, val], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const ax  = this.MARGIN + col * (cellW + 3);
      const ay  = y + row * 13;

      this._roundRect(doc, ax, ay, cellW, 11, 1.5, this.C.bgLight, this.C.border);
      doc.setFontSize(6.5);
      doc.setTextColor(...this.C.textMuted);
      doc.setFont('helvetica', 'normal');
      doc.text(label.toUpperCase(), ax + 3, ay + 5);
      doc.setFontSize(8.5);
      doc.setTextColor(...this.C.blue);
      doc.setFont('helvetica', 'bold');
      doc.text(val, ax + cellW - 3, ay + 9, { align: 'right' });
      doc.setFont('helvetica', 'normal');
    });

    // Target affinity bar chart
    const affY = y + 56;
    doc.setFontSize(8);
    doc.setTextColor(...this.C.textBody);
    doc.setFont('helvetica', 'bold');
    doc.text('DEVICE AFFINITY MATRIX:', this.MARGIN, affY);

    const aff  = malware.targetAffinities || {};
    const devs = ['desktop','laptop','phone','server','iot','router','scada','medical'];
    const bW   = (this.COL_W - (devs.length - 1) * 1.5) / devs.length;

    devs.forEach((dev, i) => {
      const pct    = aff[dev] || 0;
      const bx     = this.MARGIN + i * (bW + 1.5);
      const maxH   = 22;
      const barH   = Math.max(1, pct * maxH);
      const bColor = pct >= 0.8 ? this.C.red : pct >= 0.5 ? this.C.amber : this.C.green;
      const baseY  = affY + 32;

      // Track
      this._roundRect(doc, bx, baseY - maxH, bW, maxH, 1, this.C.bgCard, this.C.border);
      // Bar
      this._roundRect(doc, bx, baseY - barH, bW, barH, 1, bColor, null);
      // Label
      doc.setFontSize(5.5);
      doc.setTextColor(...this.C.textMuted);
      doc.setFont('helvetica', 'normal');
      doc.text(dev.toUpperCase().slice(0, 6), bx + bW / 2, baseY + 4, { align: 'center' });
      doc.setFontSize(6.5);
      doc.setTextColor(...bColor);
      doc.text(`${Math.round(pct * 100)}%`, bx + bW / 2, baseY - maxH - 1.5, { align: 'center' });
    });

    return affY + 46;
  }

  // ──────────────────────────────────────────────
  //  Device Table
  // ──────────────────────────────────────────────

  _drawDeviceTable(doc, stats, y) {
    y = this._sectionTitle(doc, '03 — Device Ecosystem Infection Breakdown', y);

    const headers   = ['DEVICE TYPE', 'TOTAL', 'INFECTED', 'INFECTION RATE', 'STATUS'];
    const colWidths = [35, 20, 20, 35, 64];
    const rowH      = 10;

    this._roundRect(doc, this.MARGIN, y, this.COL_W, rowH, 1.5, this.C.bgCardAlt, this.C.border);
    let cx = this.MARGIN + 3;
    headers.forEach((h, i) => {
      doc.setFontSize(6.5);
      doc.setTextColor(...this.C.textMuted);
      doc.setFont('helvetica', 'bold');
      doc.text(h, cx, y + 6.5);
      cx += colWidths[i];
    });

    const devOrder = ['desktop','laptop','phone','server','iot','router','scada','medical'];
    devOrder.forEach((dev, ri) => {
      const info = stats.byDevice[dev];
      if (!info) return;
      const ry = y + rowH + ri * (rowH - 1);
      const bg = info.infected > 0 ? this.C.redLight : this.C.bgLight;
      this._roundRect(doc, this.MARGIN, ry, this.COL_W, rowH - 1, 1, bg, this.C.border);

      const pct      = info.total > 0 ? ((info.infected / info.total) * 100).toFixed(1) : '0.0';
      const stat     = info.infected === 0 ? 'CLEAN' : parseFloat(pct) >= 50 ? 'CRITICALLY COMPROMISED' : 'PARTIALLY INFECTED';
      const statColor = info.infected === 0 ? this.C.green : parseFloat(pct) >= 50 ? this.C.red : this.C.amber;
      const values   = [dev.toUpperCase(), info.total, info.infected, `${pct}%`, stat];

      let dcx = this.MARGIN + 3;
      values.forEach((v, vi) => {
        doc.setFontSize(7.5);
        doc.setFont('helvetica', vi === 4 ? 'bold' : 'normal');
        doc.setTextColor(...(vi === 4 ? statColor : vi >= 2 && info.infected > 0 ? this.C.red : this.C.textBody));
        doc.text(String(v), dcx, ry + 6.5);
        dcx += colWidths[vi];
      });
    });

    return y + rowH + devOrder.length * (rowH - 1) + 8;
  }

  // ──────────────────────────────────────────────
  //  Network Topology
  // ──────────────────────────────────────────────

  _drawTopologySection(doc, network, stats, y) {
    y = this._sectionTitle(doc, '06 — Network Topology Analysis', y);

    const topologyNames = {
      corporate : 'Corporate Enterprise LAN (HQ & DMZ)',
      iot_grid  : 'Smart City IoT Grid & Traffic Control',
      healthcare: 'Hospital ICU & Healthcare Network',
      global    : 'Global Internet Subnet Mesh'
    };

    this._roundRect(doc, this.MARGIN, y, this.COL_W, 16, 2, this.C.blueLight, this.C.blue);
    this._smallLabel(doc, 'ACTIVE TOPOLOGY', this.MARGIN + 4, y + 6);
    doc.setFontSize(10);
    doc.setTextColor(...this.C.blue);
    doc.setFont('helvetica', 'bold');
    doc.text(topologyNames[network.topologyType] || 'Corporate', this.MARGIN + 4, y + 13);
    y += 22;

    doc.setFontSize(7.5);
    doc.setTextColor(...this.C.textBody);
    doc.setFont('helvetica', 'bold');
    doc.text('SUBNET ANALYSIS:', this.MARGIN, y);
    y += 6;

    const subnetMap = stats.bySubnet || {};
    const subnets = Object.keys(subnetMap).slice(0, 10);

    subnets.forEach((sn, i) => {
      const info  = subnetMap[sn];
      const pct   = info.total > 0 ? ((info.infected / info.total) * 100).toFixed(0) : '0';
      const bColor = parseInt(pct) >= 50 ? this.C.red : parseInt(pct) > 0 ? this.C.amber : this.C.green;
      const ry    = y + i * 11;

      this._roundRect(doc, this.MARGIN, ry, this.COL_W, 9.5, 1.5, this.C.bgLight, this.C.border);
      const barW = Math.max(0, (parseInt(pct) / 100) * (this.COL_W - 8));
      if (barW > 0) {
        this._rect(doc, this.MARGIN + 4, ry + 6, barW, 2, bColor, null);
      }
      doc.setFontSize(7);
      doc.setTextColor(...this.C.textBody);
      doc.setFont('helvetica', 'normal');
      doc.text(sn.slice(0, 40), this.MARGIN + 4, ry + 5);
      doc.setFontSize(7);
      doc.setTextColor(...bColor);
      doc.setFont('helvetica', 'bold');
      doc.text(`${info.infected}/${info.total} (${pct}%)`, this.MARGIN + this.COL_W - 4, ry + 5, { align: 'right' });
    });

    return y + subnets.length * 11 + 8;
  }

  // ──────────────────────────────────────────────
  //  Threat Intelligence Bulletins
  // ──────────────────────────────────────────────

  _drawThreatFeedSection(doc, simulation, y) {
    y = this._sectionTitle(doc, '07 — Threat Intelligence Bulletins', y);

    const alerts = (simulation.alertFeed || []).slice(0, 8);
    if (alerts.length === 0) {
      doc.setFontSize(8);
      doc.setTextColor(...this.C.textMuted);
      doc.text('No alerts recorded yet.', this.MARGIN, y + 6);
      return y + 16;
    }

    alerts.forEach((a, i) => {
      const ay = y + i * 16;
      const levelColor = a.level === 'critical' ? this.C.red    :
                         a.level === 'danger'   ? [234, 88, 12] :
                         a.level === 'warning'  ? this.C.amber  :
                         a.level === 'success'  ? this.C.green  : this.C.blue;
      const levelBg    = a.level === 'critical' ? this.C.redLight    :
                         a.level === 'danger'   ? [255, 237, 213]    :
                         a.level === 'warning'  ? this.C.amberLight  :
                         a.level === 'success'  ? this.C.greenLight  : this.C.blueLight;

      this._roundRect(doc, this.MARGIN, ay, this.COL_W, 14.5, 2, levelBg, levelColor);

      doc.setFontSize(6);
      doc.setTextColor(...levelColor);
      doc.setFont('helvetica', 'bold');
      doc.text(`[DAY ${a.day}] ${a.level.toUpperCase()}`, this.MARGIN + 3, ay + 5.5);

      doc.setFontSize(7.5);
      doc.setTextColor(...this.C.textDark);
      doc.setFont('helvetica', 'bold');
      doc.text(a.title || '', this.MARGIN + 3, ay + 10);

      doc.setFontSize(6.5);
      doc.setTextColor(...this.C.textBody);
      doc.setFont('helvetica', 'normal');
      const tLines = doc.splitTextToSize(a.text || '', this.COL_W - 50);
      doc.text(tLines[0] || '', this.MARGIN + 50, ay + 10);
    });

    return y + alerts.length * 16 + 4;
  }

  // ──────────────────────────────────────────────
  //  Recommendations
  // ──────────────────────────────────────────────

  _drawRecommendations(doc, malware, stats, y) {
    y = this._sectionTitle(doc, '08 — Incident Response Recommendations', y);

    const baseRecs = [
      { priority: 'IMMEDIATE',  text: `Isolate all systems running ${malware.vector?.split(' ')[0] || 'affected software'} from network segments. Enforce emergency zero-trust microsegmentation.` },
      { priority: 'IMMEDIATE',  text: `Apply vendor patches for ${malware.cve || 'affected CVE'}. Prioritize internet-facing and high-affinity device types. Do not restore from backup until systems are verified clean.` },
      { priority: 'SHORT-TERM', text: `Deploy updated EDR/XDR signatures to all endpoints. Enable behavior-based detection for ${malware.type.toLowerCase()} patterns.` },
      { priority: 'SHORT-TERM', text: `Reset all privileged credentials. Audit service accounts, API keys, and OAuth tokens for unauthorized usage during the compromise window.` },
      { priority: 'MEDIUM-TERM',text: `Conduct full forensic timeline analysis. Preserve system memory dumps and network PCAP captures for IOC extraction.` },
      { priority: 'MEDIUM-TERM',text: `Notify CERTs, CISA, and law enforcement (if applicable). File CVE disclosure if novel variants observed.` }
    ];

    const catRecs = {
      ransomware  : { priority: 'IMMEDIATE', text: `DO NOT pay ransom. Engage cyber insurance and law enforcement. Restore from offline backups only. Verify backup integrity BEFORE reconnecting to network.` },
      botnet      : { priority: 'IMMEDIATE', text: `Block all Telnet/SSH (23, 2323, 22) externally. Change default credentials on ALL IoT and network devices immediately. Consider factory reset for enslaved endpoints.` },
      spyware     : { priority: 'IMMEDIATE', text: `All communications on affected devices are compromised. Rotate credentials, API keys, and MFA tokens. Notify individuals under applicable privacy laws.` },
      scada       : { priority: 'CRITICAL',  text: `Physically disconnect OT network from IT backbone. Engage ICS-CERT immediately. Manual operation procedures may be required.` },
      supplychain : { priority: 'IMMEDIATE', text: `Audit all third-party software dependencies and build pipeline integrity. Rebuild from source on verified infrastructure. Notify downstream consumers.` },
      worm        : { priority: 'IMMEDIATE', text: `Block lateral spread ports at all network boundaries. Segment flat networks into isolated zones immediately.` },
      trojan      : { priority: 'SHORT-TERM',text: `Hunt for C2 beaconing using DNS anomaly detection and network flow analysis. Block known IoC domains/IPs at perimeter firewall.` }
    };

    const allRecs = [...baseRecs];
    if (catRecs[malware.category]) allRecs.splice(2, 0, catRecs[malware.category]);

    allRecs.slice(0, 7).forEach((rec, i) => {
      const ry     = y + i * 18;
      const pColor = rec.priority === 'IMMEDIATE' || rec.priority === 'CRITICAL' ? this.C.red :
                     rec.priority === 'SHORT-TERM' ? this.C.amber : this.C.blue;
      const pBg    = rec.priority === 'IMMEDIATE' || rec.priority === 'CRITICAL' ? this.C.redLight :
                     rec.priority === 'SHORT-TERM' ? this.C.amberLight : this.C.blueLight;

      this._roundRect(doc, this.MARGIN, ry, this.COL_W, 16, 2, pBg, pColor);
      doc.setFontSize(6.5);
      doc.setTextColor(...pColor);
      doc.setFont('helvetica', 'bold');
      doc.text(`[${rec.priority}]`, this.MARGIN + 3, ry + 6);

      doc.setFontSize(7.5);
      doc.setTextColor(...this.C.textDark);
      doc.setFont('helvetica', 'normal');
      const rLines = doc.splitTextToSize(rec.text, this.COL_W - 8);
      doc.text(rLines.slice(0, 2), this.MARGIN + 3, ry + 12);
    });

    return y + Math.min(7, allRecs.length) * 18 + 6;
  }

  // ──────────────────────────────────────────────
  //  Appendix
  // ──────────────────────────────────────────────

  _drawAppendix(doc, malware, y) {
    if (y > 245) return y;
    y = this._sectionTitle(doc, 'Appendix — Malware Reference Card', y);

    const items = [
      ['Malware Family',    malware.name],
      ['Category',          (malware.category || 'UNKNOWN').toUpperCase()],
      ['CVE',               malware.cve     || 'N/A'],
      ['Origin',            malware.origin  || 'Unknown'],
      ['Base R0',           String(malware.r0 || 0)],
      ['Transmission Rate', `${Math.round((malware.transmissionRate||0)*100)}%`],
      ['Patch Difficulty',  `${Math.round((malware.patchDifficulty ||0)*100)}%`],
      ['Stealth',           `${malware.stealth  || 0}/10`],
      ['Lethality',         `${malware.lethality|| 0}/10`],
      ['Mutation Rate',     `${Math.round((malware.mutationRate||0)*100)}%`],
    ];

    const cellW = (this.COL_W - 4) / 2;
    items.forEach(([k, v], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const ax  = this.MARGIN + col * (cellW + 4);
      const ay  = y + row * 10;
      doc.setFontSize(6.5);
      doc.setTextColor(...this.C.textMuted);
      doc.setFont('helvetica', 'normal');
      doc.text(`${k}:`, ax, ay);
      doc.setTextColor(...this.C.textDark);
      doc.setFont('helvetica', 'bold');
      doc.text(String(v).slice(0, 40), ax + 35, ay);
    });

    return y + Math.ceil(items.length / 2) * 10 + 4;
  }

  // ──────────────────────────────────────────────
  //  Page Footer
  // ──────────────────────────────────────────────

  _drawPageFooter(doc, page, total, reportId) {
    const { PAGE_W, PAGE_H, MARGIN } = this;
    this._rect(doc, 0, PAGE_H - 9, PAGE_W, 9, this.C.blue, null);
    doc.setFontSize(6);
    doc.setTextColor(...this.C.bgWhite);
    doc.setFont('helvetica', 'normal');
    doc.text(`CYBEROUTBREAK INCIDENT REPORT — ${reportId} — CONFIDENTIAL`, MARGIN, PAGE_H - 4);
    doc.text(`Page ${page} of ${total}`, PAGE_W - MARGIN, PAGE_H - 4, { align: 'right' });
  }

  // ──────────────────────────────────────────────
  //  Helpers
  // ──────────────────────────────────────────────

  _sectionTitle(doc, title, y) {
    doc.setFontSize(9);
    doc.setTextColor(...this.C.blue);
    doc.setFont('helvetica', 'bold');
    doc.text(title.toUpperCase(), this.MARGIN, y + 4);
    doc.setDrawColor(...this.C.borderDark);
    doc.setLineWidth(0.4);
    doc.line(this.MARGIN, y + 6, this.MARGIN + this.COL_W, y + 6);
    return y + 13;
  }

  _smallLabel(doc, label, x, y) {
    doc.setFontSize(6);
    doc.setTextColor(...this.C.textMuted);
    doc.setFont('helvetica', 'normal');
    doc.text(label.toUpperCase(), x, y);
  }

  _rect(doc, x, y, w, h, fillRgb, strokeRgb) {
    if (fillRgb)   doc.setFillColor(...fillRgb);
    if (strokeRgb) doc.setDrawColor(...strokeRgb);
    else           doc.setDrawColor(0, 0, 0, 0);
    doc.rect(x, y, w, h, fillRgb && strokeRgb ? 'FD' : fillRgb ? 'F' : 'D');
  }

  _roundRect(doc, x, y, w, h, r, fillRgb, strokeRgb) {
    if (fillRgb)   doc.setFillColor(...fillRgb);
    if (strokeRgb) doc.setDrawColor(...strokeRgb);
    else           doc.setDrawColor(0, 0, 0, 0);
    doc.roundedRect(x, y, w, h, r, r, fillRgb && strokeRgb ? 'FD' : fillRgb ? 'F' : 'D');
  }
}

window.ReportEngine = ReportEngine;
