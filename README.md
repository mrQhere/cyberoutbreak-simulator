# CyberOutbreak Simulator

![Status](https://img.shields.io/badge/Status-Active-success) ![License](https://img.shields.io/badge/License-MIT-blue) ![Python](https://img.shields.io/badge/Python-3.8%2B-blue) ![Flask](https://img.shields.io/badge/Flask-2.x-lightgrey)

A professional cyber threat epidemic simulator that models malware propagation across network topologies using a real-time SEIR epidemiological model, backed by live threat intelligence from CISA KEV, NVD, and MalwareBazaar.

---

## Quick Start

```bash
chmod +x start.sh
./start.sh
```

Open `http://127.0.0.1:8000` in your browser.

---

## Features

### Simulation Engine
- **SEIR Model** — Susceptible → Exposed → Infected → Recovered/Patched epidemic math
- **4 Network Topologies** — Corporate LAN, IoT Grid, Healthcare, Global Subnet Mesh
- **75 device mesh** — Desktops, laptops, servers, phones, IoT, routers, SCADA, medical devices
- **Live R0 tracking** — Reproduction rate updates every tick
- **Financial damage modeling** — Per-malware ransom/damage costs tracked cumulatively

### Threat Intelligence
- **22+ built-in malware profiles** — WannaCry, Mirai, Pegasus, Stuxnet, NotPetya, Log4Shell, and more
- **Live feed integration** — CISA KEV, NVD, MalwareBazaar (via local proxy, no CORS)
- **Local SQLite database** — All imported threats persist at `~/.cyberoutbreak_malware.db`
- **Dynamic threat count** — Header button updates automatically as you import threats
- **MITRE ATT&CK mapping** — Every threat card shows associated TTPs

### Interactive UI
- **Network canvas** — Scroll to zoom, drag to pan, click any device to inspect
- **Device Inspector** — View CVEs, logs, deploy patches, inject threats, or isolate devices
- **Simulation reset guard** — Changing malware mid-run prompts confirmation and resets state
- **Speed control** — 1x / 2x / 5x / 10x simulation speed

### Reporting & Export
- **PDF Report** — Full outbreak report with all charts (available when paused)
- **JSON Export** — Raw tick-by-tick simulation telemetry
- **Chart suite** — SEIR curve, financial damages, device breakdown donut, R0 trend

### Zero-Day Synthesizer
Create custom malware strains with configurable R0, stealth, lethality, attack vector, and per-device-type affinity weights. Deployed strains are added to the live database.

---

## Architecture

```
malware-outbreak-simulator/
├── index.html              # Main app shell
├── style.css               # Light-theme professional UI
├── server.py               # Flask server + SQLite DB + API proxies
├── start.sh                # One-click launcher
├── requirements.txt        # Python deps (flask, flask-cors, requests)
└── js/
    ├── app.js              # Main orchestrator & UI controller
    ├── database.js         # Built-in malware profiles (22+ entries)
    ├── network_engine.js   # Canvas physics, node graph, animations
    ├── simulation_engine.js # SEIR model, tick logic, state management
    ├── charts_engine.js    # Canvas chart renderers (SEIR, donut, R0, damages)
    ├── threat_feed.js      # Live API fetcher (CISA KEV, NVD, MalwareBazaar)
    ├── report_engine.js    # jsPDF report generator
    ├── audio.js            # Web Audio API sound effects
    └── icons.js            # Canvas device glyph renderer
```

## API Endpoints (Local Server)

| Endpoint | Description |
|----------|-------------|
| `GET /` | Serve index.html |
| `GET /api/threats/cisa-kev` | Proxy CISA KEV catalog |
| `GET /api/threats/nvd` | Proxy NVD critical CVEs |
| `GET /api/threats/malwarebazaar` | Proxy MalwareBazaar recent samples |
| `GET /api/db/entries` | List all saved DB entries |
| `POST /api/db/save` | Save a threat entry to SQLite |
| `DELETE /api/db/entries/<id>` | Remove a DB entry |

---

## Requirements

- Python 3.8+
- Flask, flask-cors, requests (`pip install -r requirements.txt`)
- Modern browser (Chrome/Firefox recommended)
