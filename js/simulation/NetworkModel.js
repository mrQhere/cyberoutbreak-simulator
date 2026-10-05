/**
 * Network Graph Topology Model for CyberOutbreak Simulator
 * Pure graph data structure managing Nodes, Edges, Subnets, and Reachability.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const NodeModel = require('./NodeModel');
    const EdgeModel = require('./EdgeModel');
    const RandomSource = require('./RandomSource');
    module.exports = factory(NodeModel, EdgeModel, RandomSource);
  } else {
    root.SimCore = root.SimCore || {};
    root.SimCore.NetworkModel = factory(
      root.SimCore.NodeModel,
      root.SimCore.EdgeModel,
      root.SimCore.RandomSource
    );
  }
}(typeof self !== 'undefined' ? self : this, function (NodeModel, EdgeModel, RandomSource) {
  'use strict';

  class NetworkModel {
    constructor() {
      this.nodes = new Map(); // id -> NodeModel
      this.edges = new Map(); // id -> EdgeModel
      this.adjacency = new Map(); // id -> Set<EdgeModel>
      this.subnets = new Map(); // subnetName -> Set<NodeId>
    }

    addNode(node) {
      if (!(node instanceof NodeModel)) {
        node = new NodeModel(node);
      }
      this.nodes.set(node.id, node);
      if (!this.adjacency.has(node.id)) {
        this.adjacency.set(node.id, new Set());
      }
      if (!this.subnets.has(node.subnet)) {
        this.subnets.set(node.subnet, new Set());
      }
      this.subnets.get(node.subnet).add(node.id);
      return node;
    }

    getNode(nodeId) {
      return this.nodes.get(nodeId) || null;
    }

    getAllNodes() {
      return Array.from(this.nodes.values());
    }

    addEdge(edgeConfig) {
      let edge = edgeConfig;
      if (!(edge instanceof EdgeModel)) {
        edge = new EdgeModel(edgeConfig);
      }
      this.edges.set(edge.id, edge);

      if (!this.adjacency.has(edge.sourceId)) {
        this.adjacency.set(edge.sourceId, new Set());
      }
      if (!this.adjacency.has(edge.targetId)) {
        this.adjacency.set(edge.targetId, new Set());
      }

      this.adjacency.get(edge.sourceId).add(edge);
      // For bidirectional network propagation, we also add reverse edge or index both directions
      this.adjacency.get(edge.targetId).add(edge);
      return edge;
    }

    getEdge(sourceId, targetId) {
      const id1 = `edge-${sourceId}-${targetId}`;
      const id2 = `edge-${targetId}-${sourceId}`;
      return this.edges.get(id1) || this.edges.get(id2) || null;
    }

    getAllEdges() {
      return Array.from(this.edges.values());
    }

    getNeighbors(nodeId) {
      const adj = this.adjacency.get(nodeId);
      if (!adj) return [];
      const neighbors = [];
      for (const edge of adj) {
        if (!edge.reachable || edge.state === EdgeModel.EdgeStates.BLOCKED) continue;
        const otherId = edge.sourceId === nodeId ? edge.targetId : edge.sourceId;
        const otherNode = this.nodes.get(otherId);
        if (otherNode && otherNode.state !== 'ISOLATED' && otherNode.state !== 'DECOMMISSIONED') {
          neighbors.push({ node: otherNode, edge });
        }
      }
      return neighbors;
    }

    /**
     * Compute topological reachability between source and target
     * Evaluates VLAN, router status, firewall rules, and air-gaps.
     */
    canReach(sourceId, targetId, protocol = null, port = null) {
      const source = this.nodes.get(sourceId);
      const target = this.nodes.get(targetId);
      if (!source || !target) return { reachable: false, reason: 'NODE_NOT_FOUND', hops: 0, path: [] };

      // Isolated nodes cannot communicate
      if (source.state === 'ISOLATED' || source.securityControls.isolated) {
        return { reachable: false, reason: 'SOURCE_ISOLATED', hops: 0, path: [] };
      }
      if (target.state === 'ISOLATED' || target.securityControls.isolated) {
        return { reachable: false, reason: 'TARGET_ISOLATED', hops: 0, path: [] };
      }
      if (source.state === 'DECOMMISSIONED' || target.state === 'DECOMMISSIONED') {
        return { reachable: false, reason: 'NODE_DECOMMISSIONED', hops: 0, path: [] };
      }

      // Direct edge check
      const directEdge = this.getEdge(sourceId, targetId);
      if (directEdge) {
        const trav = directEdge.canTraverse(protocol, port);
        if (!trav.allowed) {
          return { reachable: false, reason: trav.reason, hops: 1, path: [directEdge] };
        }
      }

      // Same subnet with direct broadcast / LAN switch
      if (source.subnet === target.subnet) {
        return { reachable: true, reason: 'SAME_SUBNET', hops: 1, path: directEdge ? [directEdge] : [] };
      }

      // Inter-subnet routing: BFS path search across network backbone
      const queue = [{ id: sourceId, path: [], hops: 0 }];
      const visited = new Set([sourceId]);

      while (queue.length > 0) {
        const current = queue.shift();
        if (current.id === targetId) {
          return { reachable: true, reason: 'ROUTED_PATH', hops: current.hops, path: current.path };
        }

        const edges = this.adjacency.get(current.id) || [];
        for (const edge of edges) {
          const trav = edge.canTraverse(protocol, port);
          if (!trav.allowed) continue;

          const nextId = edge.sourceId === current.id ? edge.targetId : edge.sourceId;
          if (visited.has(nextId)) continue;

          const nextNode = this.nodes.get(nextId);
          if (!nextNode) continue;

          // Routers/firewalls that are offline or decommissioned break the route
          if (nextNode.deviceType === NodeModel.DeviceTypes.ROUTER && nextNode.state === 'DECOMMISSIONED') {
            continue;
          }
          if (nextNode.state === 'ISOLATED') {
            continue;
          }

          visited.add(nextId);
          queue.push({
            id: nextId,
            path: [...current.path, edge],
            hops: current.hops + 1
          });
        }
      }

      return { reachable: false, reason: 'NO_ROUTABLE_PATH', hops: 0, path: [] };
    }

    /**
     * Deterministic Topology Generator
     */
    generateTopology(type = 'corporate', count = 75, rng = new RandomSource(12345)) {
      this.clear();

      let subnetsDef = [];
      if (type === 'corporate') {
        subnetsDef = [
          { name: "DMZ & Web Perimeter", cx: -280, cy: -140, r: 110, types: ['router', 'firewall', 'server'], vlan: 10 },
          { name: "Executive Suite", cx: 0, cy: -180, r: 90, types: ['laptop', 'mobile', 'workstation'], vlan: 20 },
          { name: "Finance & Accounting", cx: 260, cy: -120, r: 120, types: ['workstation', 'server', 'database'], vlan: 30 },
          { name: "Engineering & Dev LAN", cx: -240, cy: 140, r: 130, types: ['workstation', 'laptop', 'server'], vlan: 40 },
          { name: "Mobile & Guest Wi-Fi", cx: 50, cy: 170, r: 120, types: ['mobile', 'laptop'], vlan: 50 },
          { name: "Core Data Center", cx: 280, cy: 150, r: 100, types: ['server', 'domain_controller', 'database'], vlan: 60 }
        ];
      } else if (type === 'iot_grid') {
        subnetsDef = [
          { name: "Smart Traffic Grid", cx: -260, cy: -130, r: 120, types: ['iot', 'router', 'scada'], vlan: 100 },
          { name: "Municipal Surveillance", cx: 240, cy: -140, r: 120, types: ['iot', 'server'], vlan: 101 },
          { name: "Smart Energy & Grid", cx: -220, cy: 150, r: 120, types: ['scada', 'iot', 'router'], vlan: 102 },
          { name: "Smart Homes Fleet", cx: 220, cy: 150, r: 130, types: ['iot', 'router', 'mobile'], vlan: 103 },
          { name: "Cloud Control Center", cx: 0, cy: 0, r: 90, types: ['server', 'workstation'], vlan: 104 }
        ];
      } else if (type === 'healthcare') {
        subnetsDef = [
          { name: "ICU & Patient Monitoring", cx: -260, cy: -120, r: 110, types: ['medical', 'iot', 'workstation'], vlan: 200 },
          { name: "Radiology & Imaging", cx: 250, cy: -130, r: 110, types: ['medical', 'server', 'database'], vlan: 201 },
          { name: "Doctors & Nursing Station", cx: -200, cy: 160, r: 120, types: ['laptop', 'mobile', 'workstation'], vlan: 202 },
          { name: "Pharmacy & Labs", cx: 220, cy: 160, r: 110, types: ['workstation', 'server', 'iot'], vlan: 203 },
          { name: "Hospital Core Infrastructure", cx: 0, cy: -20, r: 95, types: ['server', 'domain_controller', 'router'], vlan: 204 }
        ];
      } else if (type === 'scada_ot') {
        subnetsDef = [
          { name: "Safety Instrumented Systems (SIS)", cx: -260, cy: -140, r: 100, types: ['scada'], vlan: 300, airGap: true },
          { name: "Turbine & Generator Control", cx: -240, cy: 130, r: 110, types: ['scada', 'server'], vlan: 301 },
          { name: "Operator HMI Workstations", cx: 20, cy: -160, r: 100, types: ['workstation', 'laptop'], vlan: 302 },
          { name: "Historian & Plant DMZ", cx: 240, cy: -100, r: 110, types: ['server', 'database', 'firewall'], vlan: 303 },
          { name: "Corporate Supervisory LAN", cx: 180, cy: 150, r: 120, types: ['workstation', 'laptop', 'server'], vlan: 304 }
        ];
      } else { // global internet
        subnetsDef = [
          { name: "North America Cloud Subnet", cx: -280, cy: -120, r: 120, types: ['server', 'workstation', 'cloud_service', 'laptop'], vlan: 400 },
          { name: "Europe Enterprise Mesh", cx: 50, cy: -170, r: 110, types: ['server', 'laptop', 'router'], vlan: 401 },
          { name: "Asia-Pacific Edge Grid", cx: 280, cy: -60, r: 130, types: ['mobile', 'iot', 'workstation'], vlan: 402 },
          { name: "Latin America Regional WAN", cx: -180, cy: 160, r: 110, types: ['workstation', 'mobile', 'router'], vlan: 403 },
          { name: "Middle East / Africa Data Hub", cx: 180, cy: 160, r: 120, types: ['router', 'iot', 'server'], vlan: 404 }
        ];
      }

      const nodesPerSubnet = Math.floor(count / subnetsDef.length);
      let nodeId = 1;
      const gateways = [];

      subnetsDef.forEach((sub, sIdx) => {
        // Subnet Gateway Router
        const gwNode = new NodeModel({
          id: `node-${nodeId++}`,
          ip: `10.${sIdx + 1}.0.1`,
          hostname: `gw-${sub.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 15)}.net`,
          deviceType: NodeModel.DeviceTypes.ROUTER,
          os: 'VyOS Enterprise Router',
          osVersion: '1.4-LTS',
          subnet: sub.name,
          vlanId: sub.vlan,
          criticality: 4.5,
          businessValue: 25000,
          services: [
            { name: 'routing', port: 179, protocol: 'tcp', version: 'BGP-4', active: true },
            { name: 'ssh', port: 22, protocol: 'tcp', version: 'OpenSSH 8.9', active: true }
          ],
          vulnerabilities: [
            { cve: 'CVE-2023-38606', cvss: 7.8, vector: 'Remote Command Injection', requiredPort: 22, patched: false }
          ],
          patchLevel: 0.8,
          securityControls: { edr: false, firewall: true, firewallStrength: 0.85, ids: true, patchManager: true },
          x: sub.cx,
          y: sub.cy,
          radius: 18
        });

        this.addNode(gwNode);
        gateways.push(gwNode);

        // Child devices in this subnet
        for (let i = 0; i < nodesPerSubnet; i++) {
          const dType = rng.choice(sub.types);
          const angle = (i / nodesPerSubnet) * Math.PI * 2 + rng.uniform(-0.2, 0.2);
          const dist = rng.uniform(35, Math.max(40, sub.r - 20));
          const nx = sub.cx + Math.cos(angle) * dist;
          const ny = sub.cy + Math.sin(angle) * dist;
          const octet = 10 + i;

          const osOptions = {
            workstation: ['Windows 11 Pro 23H2', 'Windows 10 Enterprise', 'Ubuntu Desktop 24.04 LTS'],
            laptop: ['macOS Sonoma 14.5', 'Windows 11 Enterprise', 'Fedora Workstation 40'],
            mobile: ['iOS 17.5.1', 'Android 14 (OneUI 6.1)', 'Android 13'],
            server: ['Ubuntu Server 22.04 LTS', 'Red Hat Enterprise Linux 9.3', 'Windows Server 2022 Datacenter'],
            database: ['PostgreSQL on Ubuntu 22.04', 'Oracle Database 19c on RHEL', 'MS SQL Server 2022'],
            domain_controller: ['Windows Server 2022 Active Directory'],
            iot: ['Embedded Linux / BusyBox', 'FreeRTOS v10.4', 'OpenWrt 23.05'],
            scada: ['Siemens Simatic S7-1500 PLC Firmware', 'Schneider Modicon M580', 'Rockwell ControlLogix 5580'],
            medical: ['GE Healthcare CARESCAPE OS', 'Philips IntelliVue MX800', 'Baxter Infusion Pump OS'],
            router: ['Cisco IOS XE 17.9', 'MikroTik RouterOS 7.12'],
            firewall: ['Palo Alto PAN-OS 11.0', 'Fortinet FortiOS 7.4'],
            cloud_service: ['AWS Linux 2023', 'Azure Linux 3.0']
          };

          const chosenOs = rng.choice(osOptions[dType] || ['Generic Linux']);

          // Assign realistic services
          const services = [];
          if (dType === 'server' || dType === 'database' || dType === 'domain_controller') {
            services.push({ name: 'ssh', port: 22, protocol: 'tcp', version: 'OpenSSH 8.9', active: true });
            services.push({ name: 'smb', port: 445, protocol: 'tcp', version: 'SMBv3', active: true });
            if (dType === 'database') {
              services.push({ name: 'database', port: 5432, protocol: 'tcp', version: 'PostgreSQL 15', active: true });
            }
            if (dType === 'domain_controller') {
              services.push({ name: 'kerberos', port: 88, protocol: 'tcp', version: 'Kerberos 5', active: true });
              services.push({ name: 'ldap', port: 389, protocol: 'tcp', version: 'Active Directory LDAP', active: true });
            }
          } else if (dType === 'workstation' || dType === 'laptop') {
            services.push({ name: 'smb', port: 445, protocol: 'tcp', version: 'SMBv2/v3', active: true });
            services.push({ name: 'rdp', port: 3389, protocol: 'tcp', version: 'MS-RDP', active: rng.bernoulli(0.4) });
            services.push({ name: 'browser', port: 80, protocol: 'tcp', version: 'Client Browser', active: true });
          } else if (dType === 'iot') {
            services.push({ name: 'telnet', port: 23, protocol: 'tcp', version: 'BusyBox Telnetd', active: true });
            services.push({ name: 'http', port: 80, protocol: 'tcp', version: 'GoAhead WebServer', active: true });
          } else if (dType === 'scada') {
            services.push({ name: 'modbus', port: 502, protocol: 'tcp', version: 'Modbus TCP', active: true });
            services.push({ name: 's7comm', port: 102, protocol: 'tcp', version: 'Siemens S7Comm', active: true });
          } else if (dType === 'medical') {
            services.push({ name: 'dicom', port: 104, protocol: 'tcp', version: 'DICOM Imaging', active: true });
            services.push({ name: 'hl7', port: 2575, protocol: 'tcp', version: 'HL7 Medical Protocol', active: true });
          }

          // Diverse vulnerability distribution
          const vulnerabilities = [];
          if (rng.bernoulli(0.35)) {
            vulnerabilities.push({ cve: 'CVE-2017-0144', cvss: 9.8, vector: 'SMBv1 Remote Code Execution', requiredPort: 445, patched: false });
          }
          if (rng.bernoulli(0.25)) {
            vulnerabilities.push({ cve: 'CVE-2021-44228', cvss: 10.0, vector: 'JNDI LDAP Remote Code Execution', requiredPort: 80, patched: false });
          }
          if (dType === 'iot' && rng.bernoulli(0.60)) {
            vulnerabilities.push({ cve: 'CVE-DEFAULT-CREDS', cvss: 8.5, vector: 'Telnet/SSH Hardcoded Credentials', requiredPort: 23, patched: false });
          }
          if (dType === 'scada' && rng.bernoulli(0.45)) {
            vulnerabilities.push({ cve: 'CVE-2010-2568', cvss: 9.3, vector: 'Siemens PLC Logic Manipulation', requiredPort: 102, patched: false });
          }
          if (dType === 'mobile' && rng.bernoulli(0.20)) {
            vulnerabilities.push({ cve: 'CVE-2021-30860', cvss: 9.8, vector: 'FORCEDENTRY Zero-Click', requiredPort: 443, patched: false });
          }

          const criticalityMap = {
            domain_controller: 5.0,
            database: 4.5,
            server: 4.0,
            scada: 4.5,
            medical: 4.8,
            firewall: 4.5,
            router: 4.0,
            workstation: 2.0,
            laptop: 2.0,
            mobile: 1.5,
            iot: 1.5,
            cloud_service: 4.0
          };

          const businessValueMap = {
            domain_controller: 50000,
            database: 40000,
            server: 25000,
            scada: 45000,
            medical: 50000,
            firewall: 20000,
            router: 15000,
            workstation: 4000,
            laptop: 3500,
            mobile: 1500,
            iot: 1200,
            cloud_service: 30000
          };

          const node = new NodeModel({
            id: `node-${nodeId++}`,
            ip: `10.${sIdx + 1}.1.${octet}`,
            hostname: `${dType}-${octet}.${sub.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)}.local`,
            deviceType: dType,
            os: chosenOs,
            osVersion: 'Latest',
            subnet: sub.name,
            vlanId: sub.vlan,
            criticality: criticalityMap[dType] || 2.0,
            businessValue: businessValueMap[dType] || 5000,
            hourlyDowntimeCost: (criticalityMap[dType] || 2.0) * 100,
            services,
            vulnerabilities,
            patchLevel: rng.uniform(0.3, 0.9),
            securityControls: {
              edr: rng.bernoulli(dType === 'server' || dType === 'workstation' ? 0.65 : 0.15),
              edrEffectiveness: 0.85,
              firewall: true,
              firewallStrength: rng.uniform(0.5, 0.85),
              mfa: rng.bernoulli(dType === 'server' ? 0.8 : 0.3),
              ids: rng.bernoulli(0.5),
              patchManager: rng.bernoulli(0.6),
              isolated: false
            },
            trustLevel: rng.uniform(0.4, 0.8),
            userExposure: dType === 'workstation' || dType === 'laptop' ? 0.75 : 0.2,
            networkExposure: dType === 'server' || dType === 'router' ? 0.8 : 0.3,
            monitoringCoverage: rng.uniform(0.4, 0.9),
            x: nx,
            y: ny,
            radius: dType === 'server' || dType === 'domain_controller' || dType === 'database' ? 16 : 13
          });

          this.addNode(node);

          // Connect child to gateway edge
          this.addEdge({
            sourceId: gwNode.id,
            targetId: node.id,
            bandwidth: 1000,
            trustLevel: 0.9,
            latency: 1,
            segmentation: EdgeModel.SegmentationTypes.VLAN,
            firewallStrength: 0.2,
            reachable: true
          });

          // Occasional lateral LAN peer link
          if (i > 0 && rng.bernoulli(0.35)) {
            const prevChildId = `node-${nodeId - 2}`;
            this.addEdge({
              sourceId: prevChildId,
              targetId: node.id,
              bandwidth: 1000,
              trustLevel: 0.7,
              latency: 1,
              segmentation: EdgeModel.SegmentationTypes.NONE,
              firewallStrength: 0.0,
              reachable: true
            });
          }
        }
      });

      // Connect Backbone between routers / gateways
      for (let i = 0; i < gateways.length; i++) {
        const g1 = gateways[i];
        const g2 = gateways[(i + 1) % gateways.length];
        const isAirGapped = !!subnetsDef[i].airGap;

        this.addEdge({
          sourceId: g1.id,
          targetId: g2.id,
          bandwidth: 10000,
          trustLevel: 0.95,
          latency: 5,
          segmentation: isAirGapped ? EdgeModel.SegmentationTypes.AIR_GAP : EdgeModel.SegmentationTypes.FIREWALL,
          firewallStrength: isAirGapped ? 1.0 : 0.75,
          reachable: !isAirGapped,
          isBackbone: true
        });

        if (gateways.length > 3 && i === 0 && !isAirGapped) {
          this.addEdge({
            sourceId: g1.id,
            targetId: gateways[2].id,
            bandwidth: 10000,
            trustLevel: 0.95,
            latency: 5,
            segmentation: EdgeModel.SegmentationTypes.FIREWALL,
            firewallStrength: 0.75,
            reachable: true,
            isBackbone: true
          });
        }
      }
    }

    clear() {
      this.nodes.clear();
      this.edges.clear();
      this.adjacency.clear();
      this.subnets.clear();
    }

    getState() {
      const nodesState = {};
      this.nodes.forEach((n, id) => {
        nodesState[id] = n.getState();
      });
      const edgesState = {};
      this.edges.forEach((e, id) => {
        edgesState[id] = e.getState();
      });
      return {
        nodes: nodesState,
        edges: edgesState
      };
    }

    setState(saved) {
      if (!saved) return;
      if (saved.nodes) {
        Object.keys(saved.nodes).forEach(id => {
          const n = this.nodes.get(id);
          if (n) n.setState(saved.nodes[id]);
        });
      }
      if (saved.edges) {
        Object.keys(saved.edges).forEach(id => {
          const e = this.edges.get(id);
          if (e) e.setState(saved.edges[id]);
        });
      }
    }
  }

  return NetworkModel;
}));
