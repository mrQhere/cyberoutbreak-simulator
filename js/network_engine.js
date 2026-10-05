/**
 * HTML5 Canvas Network Physics & Event Stream Visualizer
 * Projects the authoritative SimulationEngine graph state and animates true simulation events.
 * Zero fake animations — all packets represent real simulation transmission attempts.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NetworkEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class NetworkEngine {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.networkModel = null; // Bound to SimCore.NetworkModel

      this.jumpPackets = [];
      this.particles = [];
      this.selectedNode = null;
      this.hoveredNode = null;
      this.transform = { x: 0, y: 0, k: 1 };
      this.isDragging = false;
      this.dragStart = { x: 0, y: 0 };

      this.onNodeSelected = null;

      this.initCanvasSize();
      this.initEventListeners();
      this.animate = this.animate.bind(this);
      requestAnimationFrame(this.animate);
    }

    bindNetworkModel(networkModel) {
      this.networkModel = networkModel;
      this.jumpPackets = [];
      this.particles = [];
      this.selectedNode = null;
      this.hoveredNode = null;
      this.centerView();
    }

    centerView() {
      const w = this.width || 900;
      const h = this.height || 600;
      this.transform = { x: w / 2, y: h / 2, k: 0.95 };
    }

    initCanvasSize() {
      if (!this.canvas || !this.canvas.parentElement) return;
      const rect = this.canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.width = rect.width;
      this.height = rect.height;
      this.canvas.width = Math.round(this.width * dpr);
      this.canvas.height = Math.round(this.height * dpr);
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr, dpr);
    }

    resize() {
      this.initCanvasSize();
      this.render();
    }

    initEventListeners() {
      if (!this.canvas || !this.canvas.parentElement) return;
      const ro = new ResizeObserver(() => { this.resize(); });
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
        if (this.canvas) this.canvas.style.cursor = 'default';
      });

      this.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
        const newK = Math.max(0.3, Math.min(3.5, this.transform.k * zoomFactor));
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
      if (!this.networkModel) return null;
      const nodes = this.networkModel.getAllNodes();
      for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        const dx = node.x - x;
        const dy = node.y - y;
        if (dx * dx + dy * dy <= (node.radius + 8) * (node.radius + 8)) {
          return node;
        }
      }
      return null;
    }

    /**
     * Handle Authoritative Simulation Event and animate true packets
     */
    handleSimulationEvent(event) {
      if (!this.networkModel) return;

      if (event.type === 'TRANSMISSION_ATTEMPT' || event.type === 'TRANSMISSION_BLOCKED' || event.type === 'PROBE_ATTEMPT') {
        const source = this.networkModel.getNode(event.sourceNodeId);
        const target = this.networkModel.getNode(event.targetNodeId);
        if (source && target) {
          const type = event.result === 'EXPLOITED' ? 'exploit' : (event.result === 'BLOCKED' ? 'blocked' : 'probe');
          this.spawnEventPacket(source, target, type, event.reason || '');
        }
      } else if (event.type === 'INFECTION_CONFIRMED' || event.type === 'SYSTEM_COMPROMISED') {
        const target = this.networkModel.getNode(event.targetNodeId);
        if (target) {
          this.spawnBurst(target.x, target.y, '#ef4444', 20);
          if (window.soundFX) window.soundFX.playInfection();
        }
      } else if (event.type === 'NODE_PATCHED' || event.type === 'NODE_RECOVERED') {
        const target = this.networkModel.getNode(event.targetNodeId);
        if (target) {
          this.spawnBurst(target.x, target.y, '#06b6d4', 16);
          if (window.soundFX) window.soundFX.playPatched();
        }
      } else if (event.type === 'NODE_ISOLATED') {
        const target = this.networkModel.getNode(event.targetNodeId);
        if (target) {
          this.spawnBurst(target.x, target.y, '#f59e0b', 12);
        }
      }
    }

    spawnEventPacket(sourceNode, targetNode, type, reason) {
      const mx = (sourceNode.x + targetNode.x) / 2;
      const my = (sourceNode.y + targetNode.y) / 2;
      const dx = targetNode.x - sourceNode.x;
      const dy = targetNode.y - sourceNode.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const perpX = -dy / (dist || 1);
      const perpY = dx / (dist || 1);
      const curveAmount = (Math.random() - 0.5) * Math.min(60, dist * 0.35);

      const color = type === 'exploit' ? '#ef4444' : (type === 'blocked' ? '#06b6d4' : '#f59e0b');

      this.jumpPackets.push({
        source: sourceNode,
        target: targetNode,
        cp: { x: mx + perpX * curveAmount, y: my + perpY * curveAmount },
        progress: 0,
        speed: 0.035 + Math.random() * 0.02,
        type,
        color,
        reason,
        tail: []
      });

      if (window.soundFX && Math.random() < 0.4) {
        window.soundFX.playJump();
      }
    }

    spawnBurst(x, y, color, count = 12) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 3.5;
        this.particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          alpha: 1.0,
          decay: 0.025 + Math.random() * 0.025,
          size: 2 + Math.random() * 3,
          color
        });
      }
    }

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

        const t = p.progress;
        const invT = 1 - t;
        const curX = invT * invT * p.source.x + 2 * invT * t * p.cp.x + t * t * p.target.x;
        const curY = invT * invT * p.source.y + 2 * invT * t * p.cp.y + t * t * p.target.y;

        p.tail.unshift({ x: curX, y: curY, alpha: 1.0 });
        if (p.tail.length > 8) p.tail.pop();
        p.tail.forEach(pt => pt.alpha *= 0.82);

        if (p.progress >= 1) {
          if (p.type === 'exploit') {
            this.spawnBurst(p.target.x, p.target.y, '#ef4444', 14);
          } else if (p.type === 'blocked') {
            this.spawnBurst(p.target.x, p.target.y, '#06b6d4', 8);
          }
          this.jumpPackets.splice(i, 1);
        }
      }

      // Update particles
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
      if (!ctx || !this.width) return;

      ctx.clearRect(0, 0, this.width, this.height);

      ctx.save();
      ctx.translate(this.transform.x, this.transform.y);
      ctx.scale(this.transform.k, this.transform.k);

      // 1. Grid
      this.renderGrid(ctx);

      if (this.networkModel) {
        // 2. Subnet zones
        this.renderSubnetZones(ctx);

        // 3. Graph Edges
        this.renderEdges(ctx);

        // 4. Packets
        this.renderJumpPackets(ctx);

        // 5. Particles
        this.renderParticles(ctx);

        // 6. Nodes
        this.renderNodes(ctx);
      }

      ctx.restore();
    }

    renderGrid(ctx) {
      const gridSize = 40;
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.04)';
      ctx.lineWidth = 1;

      const startX = -this.transform.x / this.transform.k - 200;
      const startY = -this.transform.y / this.transform.k - 200;
      const endX = startX + (this.width / this.transform.k) + 400;
      const endY = startY + (this.height / this.transform.k) + 400;

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
      const nodes = this.networkModel.getAllNodes();
      const subnets = {};

      nodes.forEach(n => {
        if (!subnets[n.subnet]) {
          subnets[n.subnet] = { count: 0, sumX: 0, sumY: 0, maxR: 0, hasInfected: false };
        }
        const s = subnets[n.subnet];
        s.count++;
        s.sumX += n.x;
        s.sumY += n.y;
        if (n.state === 'INFECTED' || n.state === 'COMPROMISED') s.hasInfected = true;
      });

      Object.keys(subnets).forEach(name => {
        const s = subnets[name];
        const avgX = s.sumX / s.count;
        const avgY = s.sumY / s.count;

        nodes.filter(n => n.subnet === name).forEach(n => {
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

        ctx.strokeStyle = s.hasInfected ? 'rgba(239, 68, 68, 0.20)' : 'rgba(56, 189, 248, 0.12)';
        ctx.setLineDash([4, 6]);
        ctx.stroke();

        ctx.fillStyle = s.hasInfected ? '#ef4444' : '#64748b';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(name.toUpperCase(), avgX, avgY - radius + 14);
        ctx.restore();
      });
    }

    renderEdges(ctx) {
      const edges = this.networkModel.getAllEdges();
      ctx.save();

      for (const edge of edges) {
        const s = this.networkModel.getNode(edge.sourceId);
        const t = this.networkModel.getNode(edge.targetId);
        if (!s || !t) continue;

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);

        if (edge.segmentation === 'AIR_GAP') {
          // Air gap broken line with red cross
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 12]);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (edge.state === 'BLOCKED' || !edge.reachable) {
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 5]);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (edge.state === 'SEGMENTED') {
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.5)';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (edge.isBackbone) {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
          ctx.lineWidth = 2.2;
          ctx.stroke();
        } else {
          // Normal link
          const bothInfected = (s.state === 'INFECTED' || s.state === 'COMPROMISED') && (t.state === 'INFECTED' || t.state === 'COMPROMISED');
          ctx.strokeStyle = bothInfected ? 'rgba(239, 68, 68, 0.45)' : 'rgba(0, 0, 0, 0.12)';
          ctx.lineWidth = bothInfected ? 1.6 : 1;
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    renderJumpPackets(ctx) {
      ctx.save();
      for (const p of this.jumpPackets) {
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
      const nodes = this.networkModel.getAllNodes();

      for (const node of nodes) {
        const isSelected = this.selectedNode === node;
        const isHovered = this.hoveredNode === node;

        let primaryColor = '#10b981'; // SUSCEPTIBLE
        let glowColor = 'rgba(16, 185, 129, 0.4)';

        switch (node.state) {
          case 'EXPOSED':
            primaryColor = '#f59e0b';
            glowColor = 'rgba(245, 158, 11, 0.6)';
            break;
          case 'INFECTED':
            primaryColor = '#ef4444';
            glowColor = 'rgba(239, 68, 68, 0.8)';
            break;
          case 'COMPROMISED':
            primaryColor = '#8b5cf6';
            glowColor = 'rgba(139, 92, 246, 0.8)';
            break;
          case 'RECOVERING':
            primaryColor = '#0ea5e9';
            glowColor = 'rgba(14, 165, 233, 0.6)';
            break;
          case 'RECOVERED':
            primaryColor = '#3b82f6';
            glowColor = 'rgba(59, 130, 246, 0.5)';
            break;
          case 'PATCHED':
            primaryColor = '#06b6d4';
            glowColor = 'rgba(6, 182, 212, 0.5)';
            break;
          case 'ISOLATED':
            primaryColor = '#64748b';
            glowColor = 'rgba(100, 116, 139, 0.4)';
            break;
          case 'DECOMMISSIONED':
            primaryColor = '#334155';
            glowColor = 'rgba(51, 65, 85, 0.2)';
            break;
        }

        ctx.save();

        // Pulsing aura for active states
        if (node.state === 'INFECTED' || node.state === 'COMPROMISED') {
          const pulse = (Math.sin(time * 3 + node.x) + 1) * 0.5;
          const pulseR = node.radius + 6 + pulse * 10;
          ctx.strokeStyle = primaryColor;
          ctx.globalAlpha = 0.4 - pulse * 0.3;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(node.x, node.y, pulseR, 0, Math.PI * 2);
          ctx.stroke();
        } else if (node.state === 'EXPOSED') {
          // Incubation progress ring
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2.5;
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          const startAngle = -Math.PI / 2;
          const endAngle = startAngle + (node.infectionProgress * Math.PI * 2);
          ctx.arc(node.x, node.y, node.radius + 4, startAngle, endAngle);
          ctx.stroke();
        }

        // Selection ring
        if (isSelected || isHovered) {
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 3;
          ctx.globalAlpha = 0.95;
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 6, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Main Node Circle
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = (node.state === 'INFECTED' || isSelected) ? 14 : 5;

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Draw Device Glyph Inside Node
        if (window.drawDeviceGlyph) {
          ctx.shadowBlur = 0;
          window.drawDeviceGlyph(ctx, node.deviceType, node.x, node.y, node.radius * 1.25, primaryColor);
        }

        // Node IP / ID label below node
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#334155';
        ctx.font = '8.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        const labelText = node.ip.split('.').slice(-2).join('.');
        ctx.fillText(labelText, node.x, node.y + node.radius + 11);

        ctx.restore();
      }
    }
  }

  return NetworkEngine;
}));
