// HTML5 Canvas Network Physics & Jump Sequence Particle Engine

class NetworkEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.nodes = [];
    this.links = [];
    this.jumpPackets = [];
    this.particles = [];
    this.selectedNode = null;
    this.hoveredNode = null;
    this.transform = { x: 0, y: 0, k: 1 };
    this.isDragging = false;
    this.dragStart = { x: 0, y: 0 };
    this.topologyType = 'corporate';
    this.onNodeSelected = null;
    this.onJumpOccurred = null;

    this.initCanvasSize();
    this.initEventListeners();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initCanvasSize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.scale(dpr, dpr);
  }

  resize() {
    this.initCanvasSize();
  }

  initEventListeners() {
    const ro = new ResizeObserver(() => {
      this.resize();
    });
    ro.observe(this.canvas.parentElement);

    this.canvas.addEventListener('mousedown', (e) => {
      const pos = this.getCanvasPos(e);
      const clicked = this.findNodeAt(pos.x, pos.y);
      if (clicked) {
        this.selectedNode = clicked;
        if (this.onNodeSelected) this.onNodeSelected(clicked);
        if (window.soundFX) window.soundFX.playClick();
      } else {
        this.isDragging = true;
        this.dragStart = { x: e.clientX - this.transform.x, y: e.clientY - this.transform.y };
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        this.transform.x = e.clientX - this.dragStart.x;
        this.transform.y = e.clientY - this.dragStart.y;
      } else {
        const rect = this.canvas.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
          const pos = this.getCanvasPos(e);
          this.hoveredNode = this.findNodeAt(pos.x, pos.y);
          this.canvas.style.cursor = this.hoveredNode ? 'pointer' : 'grab';
        }
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
      this.canvas.style.cursor = 'default';
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newK = Math.max(0.4, Math.min(3.0, this.transform.k * zoomFactor));
      const pos = this.getCanvasPos(e);

      this.transform.x = pos.screenX - (pos.x * newK);
      this.transform.y = pos.screenY - (pos.y * newK);
      this.transform.k = newK;
    }, { passive: false });
  }

  getCanvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const x = (screenX - this.transform.x) / this.transform.k;
    const y = (screenY - this.transform.y) / this.transform.k;
    return { x, y, screenX, screenY };
  }

  findNodeAt(x, y) {
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const node = this.nodes[i];
      const dx = node.x - x;
      const dy = node.y - y;
      if (dx * dx + dy * dy <= (node.radius + 8) * (node.radius + 8)) {
        return node;
      }
    }
    return null;
  }

  resetTransform() {
    this.transform = { x: 0, y: 0, k: 1 };
  }

  // Generate diverse topologies
  generateTopology(type = 'corporate', count = 75) {
    this.topologyType = type;
    this.nodes = [];
    this.links = [];
    this.jumpPackets = [];
    this.particles = [];
    this.selectedNode = null;

    const w = this.width || 900;
    const h = this.height || 600;
    const cx = w / 2;
    const cy = h / 2;

    const subnets = [];

    if (type === 'corporate') {
      subnets.push(
        { name: "DMZ & Web Perimeter", cx: cx - 280, cy: cy - 140, r: 110, types: ['router', 'server', 'iot'] },
        { name: "Executive Suite", cx: cx, cy: cy - 180, r: 90, types: ['laptop', 'phone', 'desktop'] },
        { name: "Finance & Accounting", cx: cx + 260, cy: cy - 120, r: 120, types: ['desktop', 'server', 'laptop'] },
        { name: "Engineering & Dev LAN", cx: cx - 240, cy: cy + 140, r: 130, types: ['laptop', 'desktop', 'server'] },
        { name: "Mobile & Guest Wi-Fi", cx: cx + 50, cy: cy + 170, r: 120, types: ['phone', 'laptop'] },
        { name: "Core Data Center", cx: cx + 280, cy: cy + 150, r: 100, types: ['server', 'router'] }
      );
    } else if (type === 'iot_grid') {
      subnets.push(
        { name: "Smart Traffic Grid", cx: cx - 260, cy: cy - 130, r: 120, types: ['iot', 'router', 'scada'] },
        { name: "Municipal Surveillance", cx: cx + 240, cy: cy - 140, r: 120, types: ['iot', 'server'] },
        { name: "Smart Energy & Grid", cx: cx - 220, cy: cy + 150, r: 120, types: ['scada', 'iot', 'router'] },
        { name: "Smart Homes Fleet", cx: cx + 220, cy: cy + 150, r: 130, types: ['iot', 'router', 'phone'] },
        { name: "Cloud Control Center", cx: cx, cy: cy, r: 90, types: ['server', 'desktop'] }
      );
    } else if (type === 'healthcare') {
      subnets.push(
        { name: "ICU & Patient Monitoring", cx: cx - 260, cy: cy - 120, r: 110, types: ['medical', 'iot', 'desktop'] },
        { name: "Radiology & Imaging", cx: cx + 250, cy: cy - 130, r: 110, types: ['medical', 'server', 'desktop'] },
        { name: "Doctors & Nursing Station", cx: cx - 200, cy: cy + 160, r: 120, types: ['laptop', 'phone', 'desktop'] },
        { name: "Pharmacy & Labs", cx: cx + 220, cy: cy + 160, r: 110, types: ['desktop', 'scada', 'server'] },
        { name: "Hospital Core Infrastructure", cx: cx, cy: cy - 20, r: 95, types: ['server', 'router'] }
      );
    } else { // Global Internet
      subnets.push(
        { name: "North America (AWS/Azure)", cx: cx - 280, cy: cy - 120, r: 120, types: ['server', 'desktop', 'phone', 'laptop'] },
        { name: "Europe (Enterprise & Telco)", cx: cx + 50, cy: cy - 170, r: 110, types: ['server', 'laptop', 'router'] },
        { name: "Asia-Pacific (IoT & Mobile)", cx: cx + 280, cy: cy - 60, r: 130, types: ['phone', 'iot', 'desktop'] },
        { name: "Latin America WAN", cx: cx - 180, cy: cy + 160, r: 110, types: ['desktop', 'phone', 'router'] },
        { name: "Middle East / Africa Grid", cx: cx + 180, cy: cy + 160, r: 120, types: ['router', 'iot', 'server'] }
      );
    }

    const nodesPerSubnet = Math.floor(count / subnets.length);
    let nodeId = 1;

    subnets.forEach((sub, sIdx) => {
      // Subnet gateway router
      const gwId = `node-${nodeId++}`;
      const gw = {
        id: gwId,
        ip: `10.${sIdx + 1}.0.1`,
        hostname: `gw-${sub.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.net`,
        deviceType: 'router',
        os: 'VyOS / Cisco IOS XE',
        state: 'susceptible', // susceptible, exposed, infected, compromised, patched
        subnet: sub.name,
        subnetIndex: sIdx,
        x: sub.cx,
        y: sub.cy,
        radius: 18,
        infectionProgress: 0,
        compromiseType: null,
        shieldActive: Math.random() < 0.25,
        cves: ['CVE-2023-38606', 'CVE-2024-21887'],
        payloadStatus: 'Clean',
        logs: [`[BOOT] Gateway interface UP on 10.${sIdx + 1}.0.1/24`]
      };
      this.nodes.push(gw);

      // Child devices in this subnet
      for (let i = 0; i < nodesPerSubnet; i++) {
        const dType = sub.types[Math.floor(Math.random() * sub.types.length)];
        const angle = (i / nodesPerSubnet) * Math.PI * 2 + (Math.random() * 0.4);
        const dist = 35 + Math.random() * (sub.r - 40);
        const nx = sub.cx + Math.cos(angle) * dist;
        const ny = sub.cy + Math.sin(angle) * dist;

        const osMap = {
          desktop: ['Windows 11 Pro', 'Windows 10 Enterprise', 'Ubuntu 24.04 LTS'],
          laptop: ['macOS Sonoma 14.5', 'Windows 11 Home', 'Fedora 40'],
          phone: ['iOS 17.5.1', 'Android 14 (OneUI 6.1)', 'Android 13'],
          server: ['Ubuntu Server 22.04', 'Debian 12', 'Windows Server 2022 Datacenter', 'RHEL 9.3'],
          iot: ['Embedded Linux / BusyBox', 'OpenWrt 23.05', 'FreeRTOS v10.4'],
          router: ['MikroTik RouterOS', 'pfSense 2.7.2', 'Cisco IOS'],
          scada: ['Siemens Simatic S7-1500 PLC', 'Schneider Modicon M580', 'Rockwell ControlLogix'],
          medical: ['GE Healthcare CARESCAPE', 'Philips IntelliVue MX800', 'Baxter Infusion Pump OS']
        };

        const osList = osMap[dType] || ['Generic OS'];
        const chosenOs = osList[Math.floor(Math.random() * osList.length)];
        const octet = 10 + i;

        const node = {
          id: `node-${nodeId++}`,
          ip: `10.${sIdx + 1}.1.${octet}`,
          hostname: `${dType}-${octet}.${sub.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)}.local`,
          deviceType: dType,
          os: chosenOs,
          state: 'susceptible',
          subnet: sub.name,
          subnetIndex: sIdx,
          x: nx,
          y: ny,
          radius: dType === 'server' || dType === 'scada' ? 16 : 14,
          infectionProgress: 0,
          compromiseType: null,
          shieldActive: Math.random() < 0.20,
          cves: ['CVE-2017-0144', 'CVE-2021-44228', 'CVE-2024-3094'],
          payloadStatus: 'Clean',
          logs: [`[DHCP] Bound lease IP 10.${sIdx + 1}.1.${octet}`]
        };

        this.nodes.push(node);
        // Link to gateway
        this.links.push({ source: gw, target: node, strength: 0.8 });

        // Occasional lateral peer links within subnet
        if (i > 0 && Math.random() < 0.35) {
          const peer = this.nodes[this.nodes.length - 2];
          this.links.push({ source: peer, target: node, strength: 0.3 });
        }
      }
    });

    // Inter-subnet backbone links between gateways
    const gateways = this.nodes.filter(n => n.deviceType === 'router');
    for (let i = 0; i < gateways.length; i++) {
      const g1 = gateways[i];
      const g2 = gateways[(i + 1) % gateways.length];
      this.links.push({ source: g1, target: g2, strength: 0.9, isBackbone: true });
      if (gateways.length > 3 && i === 0) {
        this.links.push({ source: g1, target: gateways[2], strength: 0.9, isBackbone: true });
      }
    }
  }

  // Trigger a visual packet jump sequence between nodes
  spawnJump(sourceNode, targetNode, type = 'exploit', malwareName = 'Malware') {
    if (!sourceNode || !targetNode) return;

    // Calculate curve control point
    const mx = (sourceNode.x + targetNode.x) / 2;
    const my = (sourceNode.y + targetNode.y) / 2;
    const dx = targetNode.x - sourceNode.x;
    const dy = targetNode.y - sourceNode.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Perpendicular offset for organic curved jump arcs
    const perpX = -dy / (dist || 1);
    const perpY = dx / (dist || 1);
    const curveAmount = (Math.random() - 0.5) * Math.min(80, dist * 0.4);

    const cp = {
      x: mx + perpX * curveAmount,
      y: my + perpY * curveAmount
    };

    const color = type === 'exploit' ? '#ef4444' :
                  type === 'blocked' ? '#06b6d4' :
                  type === 'probe' ? '#f59e0b' : '#a855f7';

    const packet = {
      source: sourceNode,
      target: targetNode,
      cp: cp,
      progress: 0,
      speed: 0.022 + Math.random() * 0.015,
      type: type,
      malwareName: malwareName,
      color: color,
      tail: []
    };

    this.jumpPackets.push(packet);
    if (window.soundFX && Math.random() < 0.35) {
      window.soundFX.playJump();
    }

    if (this.onJumpOccurred) {
      this.onJumpOccurred({
        source: sourceNode,
        target: targetNode,
        type: type,
        malwareName: malwareName,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  }

  // Spawn visual explosion/spark particles when a node is infected or patched
  spawnBurst(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3.5;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1.0,
        decay: 0.02 + Math.random() * 0.03,
        size: 2 + Math.random() * 3,
        color: color
      });
    }
  }

  // Animation Loop (60 FPS)
  animate() {
    this.update();
    this.render();
    requestAnimationFrame(this.animate);
  }

  update() {
    // Update jump packet arcs
    for (let i = this.jumpPackets.length - 1; i >= 0; i--) {
      const p = this.jumpPackets[i];
      p.progress += p.speed;

      // Current pos on quadratic bezier curve
      const t = p.progress;
      const invT = 1 - t;
      const curX = invT * invT * p.source.x + 2 * invT * t * p.cp.x + t * t * p.target.x;
      const curY = invT * invT * p.source.y + 2 * invT * t * p.cp.y + t * t * p.target.y;

      // Record tail
      p.tail.unshift({ x: curX, y: curY, alpha: 1.0 });
      if (p.tail.length > 8) p.tail.pop();
      p.tail.forEach(pt => pt.alpha *= 0.82);

      // Check arrival
      if (p.progress >= 1) {
        if (p.type === 'exploit') {
          this.spawnBurst(p.target.x, p.target.y, '#ef4444', 16);
          if (window.soundFX) window.soundFX.playInfection();
        } else if (p.type === 'blocked') {
          this.spawnBurst(p.target.x, p.target.y, '#06b6d4', 8);
        }
        this.jumpPackets.splice(i, 1);
      }
    }

    // Update burst particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.alpha -= pt.decay;
      if (pt.alpha <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.translate(this.transform.x, this.transform.y);
    ctx.scale(this.transform.k, this.transform.k);

    // 1. Draw subtle background cyber grid
    this.renderGrid(ctx);

    // 2. Draw Subnet boundary clouds / halos
    this.renderSubnetZones(ctx);

    // 3. Draw Network Links
    this.renderLinks(ctx);

    // 4. Draw Animated Jump Packets
    this.renderJumpPackets(ctx);

    // 5. Draw Particles
    this.renderParticles(ctx);

    // 6. Draw Device Nodes
    this.renderNodes(ctx);

    ctx.restore();
  }

  renderGrid(ctx) {
    const gridSize = 40;
    ctx.save();
    // Dim baseline grid on white background
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.lineWidth = 1;

    const startX = -this.transform.x / this.transform.k - 100;
    const startY = -this.transform.y / this.transform.k - 100;
    const endX = startX + (this.width / this.transform.k) + 200;
    const endY = startY + (this.height / this.transform.k) + 200;

    ctx.beginPath();
    for (let x = Math.floor(startX / gridSize) * gridSize; x < endX; x += gridSize) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = Math.floor(startY / gridSize) * gridSize; y < endY; y += gridSize) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  renderSubnetZones(ctx) {
    const subnets = {};
    this.nodes.forEach(n => {
      if (!subnets[n.subnet]) {
        subnets[n.subnet] = { count: 0, sumX: 0, sumY: 0, maxR: 0, hasInfected: false };
      }
      const s = subnets[n.subnet];
      s.count++;
      s.sumX += n.x;
      s.sumY += n.y;
      if (n.state === 'infected' || n.state === 'compromised') s.hasInfected = true;
    });

    Object.keys(subnets).forEach(name => {
      const s = subnets[name];
      const avgX = s.sumX / s.count;
      const avgY = s.sumY / s.count;

      this.nodes.filter(n => n.subnet === name).forEach(n => {
        const dist = Math.hypot(n.x - avgX, n.y - avgY);
        if (dist > s.maxR) s.maxR = dist;
      });

      const radius = Math.max(80, s.maxR + 35);
      const gradient = ctx.createRadialGradient(avgX, avgY, 10, avgX, avgY, radius);
      if (s.hasInfected) {
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.08)');
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0.00)');
      } else {
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.04)');
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0.00)');
      }

      ctx.save();
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(avgX, avgY, radius, 0, Math.PI * 2);
      ctx.fill();

      // Subnet boundary ring
      ctx.strokeStyle = s.hasInfected ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.10)';
      ctx.setLineDash([4, 6]);
      ctx.stroke();

      // Subnet Label
      ctx.fillStyle = s.hasInfected ? '#ef4444' : '#64748b';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(name.toUpperCase(), avgX, avgY - radius + 14);
      ctx.restore();
    });
  }

  renderLinks(ctx) {
    ctx.save();
    for (const link of this.links) {
      const s = link.source;
      const t = link.target;

      let strokeColor = 'rgba(0, 0, 0, 0.15)';
      let lineWidth = 1;

      if (link.isBackbone) {
        strokeColor = 'rgba(56, 189, 248, 0.5)';
        lineWidth = 1.8;
      }

      if ((s.state === 'infected' || s.state === 'compromised') &&
          (t.state === 'infected' || t.state === 'compromised')) {
        strokeColor = 'rgba(239, 68, 68, 0.45)';
        lineWidth = 1.6;
      }

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  renderJumpPackets(ctx) {
    ctx.save();
    for (const p of this.jumpPackets) {
      // Draw tail trail
      if (p.tail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(p.tail[0].x, p.tail[0].y);
        for (let i = 1; i < p.tail.length; i++) {
          ctx.lineTo(p.tail[i].x, p.tail[i].y);
        }
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Draw head glowing projectile
      if (p.tail.length > 0) {
        const head = p.tail[0];
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(head.x, head.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  renderParticles(ctx) {
    ctx.save();
    for (const pt of this.particles) {
      ctx.globalAlpha = Math.max(0, pt.alpha);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  renderNodes(ctx) {
    const time = Date.now() * 0.003;

    for (const node of this.nodes) {
      const isSelected = this.selectedNode === node;
      const isHovered = this.hoveredNode === node;

      let primaryColor = '#10b981'; // green for susceptible
      let glowColor = 'rgba(16, 185, 129, 0.4)';
      let bgColor = 'rgba(16, 185, 129, 0.12)';

      if (node.state === 'exposed') {
        primaryColor = '#f59e0b'; // amber
        glowColor = 'rgba(245, 158, 11, 0.6)';
        bgColor = 'rgba(245, 158, 11, 0.18)';
      } else if (node.state === 'infected') {
        primaryColor = '#ef4444'; // viral red
        glowColor = 'rgba(239, 68, 68, 0.8)';
        bgColor = 'rgba(239, 68, 68, 0.25)';
      } else if (node.state === 'compromised') {
        primaryColor = '#8b5cf6'; // deep purple (ransomware encrypted)
        glowColor = 'rgba(139, 92, 246, 0.8)';
        bgColor = 'rgba(139, 92, 246, 0.25)';
      } else if (node.state === 'patched') {
        primaryColor = '#06b6d4'; // cyan immune/patched
        glowColor = 'rgba(6, 182, 212, 0.5)';
        bgColor = 'rgba(6, 182, 212, 0.15)';
      }

      ctx.save();

      // Pulsing viral aura for infected nodes
      if (node.state === 'infected' || node.state === 'compromised') {
        const pulse = (Math.sin(time * 3 + node.x) + 1) * 0.5;
        const pulseR = node.radius + 6 + pulse * 10;
        ctx.strokeStyle = primaryColor;
        ctx.globalAlpha = 0.4 - pulse * 0.3;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(node.x, node.y, pulseR, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Selection ring
      if (isSelected || isHovered) {
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Main Node Circle
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = (node.state === 'infected' || isSelected) ? 14 : 6;

      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Device Glyph Inside Node
      if (window.drawDeviceGlyph) {
        ctx.shadowBlur = 0;
        window.drawDeviceGlyph(ctx, node.deviceType, node.x, node.y, node.radius * 1.25, primaryColor);
      }

      // Node mini badge label (IP or OS type)
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#334155';
      ctx.font = '8.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(node.ip.split('.').slice(-2).join('.'), node.x, node.y + node.radius + 11);

      ctx.restore();
    }
  }
}

window.NetworkEngine = NetworkEngine;
