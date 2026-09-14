# CyberOutbreak — User Guide

## Overview

CyberOutbreak is a professional cyber threat epidemic simulator. It models how malware propagates across network topologies using a modified SEIR epidemiological model, populated with real-world threat intelligence from CISA KEV, NVD, and MalwareBazaar.

---

## Interface Layout

| Zone | Description |
|------|-------------|
| **Header** | App branding, threat status badge, and action buttons |
| **KPI Strip** | Live counters — infected devices, patched %, R0, day, financial impact |
| **Control Bar** | Simulation controls, malware selector, topology selector |
| **Network Canvas** | Interactive node graph — drag, zoom, click to inspect |
| **Right Sidebar** | SEIR chart, financial damages, device breakdown donut, R0 trend, jump log, bulletins |

---

## Header Buttons

| Button | Function |
|--------|----------|
| **Audio ON / Muted** | Toggle sound effects |
| **Threat Database (N)** | Open the local malware catalog — count updates dynamically as you import threats |
| **Live Feed** | Open the live threat intelligence feed (CISA KEV + NVD + MalwareBazaar) |
| **PDF Report** | Download a PDF report — only available when simulation is paused |
| **Export Logs** | Download raw simulation data as a JSON file |
| **Synthesize Zero-Day** | Create a custom malware strain with configurable parameters |

---

## Starting a Simulation

1. Select an **Active Malware Threat** from the dropdown in the Control Bar
   - Changing threats prompts a confirmation and resets to a clean state
2. Select a **Network Topology** (Corporate LAN, IoT Grid, Healthcare, Global Subnet)
3. Click **Launch Simulation** — a Patient Zero device is randomly infected
4. Use **Step (+1 Day)** to advance manually, or set a speed multiplier (1x–10x)
5. Click **Install Daily Updates** to push patches mid-simulation

---

## Simulation States (SEIR Model)

| Color | State | Description |
|-------|-------|-------------|
| Green | Susceptible | Clean, uninfected, vulnerable |
| Amber | Exposed | Being scanned or brute-forced |
| Red | Infected | Actively compromised, spreading |
| Purple | Compromised | Fully locked (e.g. ransomware) |
| Cyan | Patched | Secured, cannot be reinfected |

---

## Network Canvas Interactions

- **Scroll** — Zoom in/out
- **Drag** — Pan the network
- **Click a Device** — Opens the Device Inspector with:
  - Device details, CVEs, event log
  - **Deploy Emergency Patch** — Instantly patches the device
  - **Inject Threat Vector** — Manually infect the device
  - **Engage Zero-Trust Shield** — Toggle firewall isolation

---

## Threat Intelligence Database

The **Threat Database** button shows the live count of all loaded threats (built-in + imported). Each card shows R0, stealth, lethality, mutation rate, CVE, vector, and MITRE ATT&CK TTP mapping.

- **Deploy to Network** — Activate the threat immediately
- **Edit & Fork** — Clone into the Zero-Day creator

---

## Live Threat Feed

1. Click **Live Feed**
2. Click **Fetch Latest Now** — pulls from:
   - CISA KEV (Known Exploited Vulnerabilities)
   - NVD (National Vulnerability Database)
   - MalwareBazaar (real-world recent malware samples)
3. Click **Import to DB** or **Import All New Threats**
4. Imported threats are persisted to `~/.cyberoutbreak_malware.db` and available across sessions

> The server must be running (`./start.sh`) for live feeds and persistence.

---

## PDF Report

Only available when the simulation is **paused**. Includes malware profile, KPI summary, and all charts with solid white backgrounds.

---

## Export Logs (JSON)

Downloads a JSON snapshot at any time: active malware profile, stats, and full tick-by-tick simulation history.

---

## Synthesize Zero-Day

Create custom malware with full control over R0, stealth, lethality, attack vector, and per-device-type affinity weights.

---

## Server & Database

Run `./start.sh` to start the local Flask server at `http://127.0.0.1:8000`.  
The SQLite database is stored at `~/.cyberoutbreak_malware.db`.  
Without the server, the app runs with the built-in static database only.
