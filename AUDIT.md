# Comprehensive Architectural Audit & Flaw Analysis: CyberOutbreak Simulator

**Audit Date**: October 2026  
**Auditor**: Senior Systems & Simulation Architecture Engineer  
**Target Repository**: `https://github.com/mrQhere/cyberoutbreak-simulator`  
**Status**: Prototype requiring foundational redesign and mathematical reconstruction

---

## 1. Executive Summary

A comprehensive, line-by-line inspection was conducted across all files in the repository (`index.html`, `style.css`, `server.py`, `update_server.py`, `requirements.txt`, `start.sh`, `start.bat`, `test_browser.py`, `README.md`, `USER_GUIDE.md`, and all JavaScript files in `js/`).

The current repository represents a visually polished prototype, but **its underlying simulation mechanics are largely decorative and mathematically disconnected from real epidemic modeling or network security principles**. The simulation core is tightly coupled to the browser DOM, Web Audio API, and HTML5 Canvas, completely relies on unseeded global `Math.random()`, calculates critical epidemiological metrics (such as $R_0$) via simplistic heuristics rather than empirical lineage tracking, completely ignores the "Exposed" state in its purported SEIR model, and has severe discrepancies between its documented capabilities and actual code implementation.

---

## 2. Current Architecture & Data Flow

### 2.1 Current Architecture Diagram

```
+-----------------------------------------------------------------------------------+
| Browser UI Layer (index.html, style.css)                                         |
|  - Canvas Network Visualizer (#canvas-network)                                    |
|  - 4 Canvas Charts (#chart-curve, #chart-damages, #chart-donut, #chart-r0)         |
|  - DOM KPI Counters & Inspector Drawer                                            |
+-----------------------------------------------------------------------------------+
                               |  ^
     Direct DOM / UI Calls     |  | Event Listeners & updateUI()
                               v  |
+-----------------------------------------------------------------------------------+
| js/app.js (Orchestrator)                                                          |
|  - Wires NetworkEngine, SimulationEngine, ChartsEngine, ThreatFeed, ReportEngine  |
|  - Directly mutates node state from Inspector buttons                             |
|  - Computes DEFCON levels via ad-hoc percentage thresholds                       |
+-----------------------------------------------------------------------------------+
          |                      |                   |                  |
          v                      v                   v                  v
+------------------+   +-------------------+   +---------------+  +------------------+
| js/network_      |   | js/simulation_    |   | js/charts_    |  | js/report_       |
|    engine.js     |   |    engine.js      |   |    engine.js  |  |    engine.js     |
| - Physics/canvas |   | - Wall-clock ticks|   | - Re-computes |  | - jsPDF export   |
| - Topology gen   |   | - Heuristic jumps |   |   values for  |  | - Takes canvas    |
| - Particle/burst |   | - Direct window.* |   |   canvas      |  |   screenshots    |
+------------------+   +-------------------+   +---------------+  +------------------+
          ^                      |
          | Direct calls to      |
          | spawnJump/Burst      |
          +----------------------+
                                 | Calls window.soundFX
                                 v
                       +-------------------+
                       | js/audio.js       |
                       | Web Audio Synth   |
                       +-------------------+

+-----------------------------------------------------------------------------------+
| External / Backend Layer (server.py & threat_feed.js)                             |
|  - Flask Server + SQLite (cyberoutbreak_malware.db)                               |
|  - Proxies: CISA KEV, NVD, MalwareBazaar                                          |
|  - Inconsistent database schemas & endpoint routes                               |
+-----------------------------------------------------------------------------------+
```

### 2.2 Current Data Flow & Simulation Loop
1. `app.js` initializes `NetworkEngine`, `SimulationEngine`, and `ChartsEngine`.
2. When the user clicks "Launch Simulation", `SimulationEngine.start()` checks for an infected node; if none exists, it randomly infects a node via `infectPatientZero()` using `Math.random()`.
3. `SimulationEngine.scheduleNextTick()` uses wall-clock `setTimeout(..., baseTickMs / speed)`.
4. In each tick (`stepDay()`):
   - It iterates through infected nodes.
   - For each infected node, it picks a candidate from immediate neighbors or subnet peers or WAN at random.
   - It tests `Math.random() < transmissionRate * deviceAffinity`.
   - If successful, it **immediately** sets `target.state = 'infected'` and `target.infectionProgress = 1.0` (skipping the "Exposed" state entirely).
   - It directly invokes canvas visual methods (`network.spawnJump`, `network.spawnBurst`) and Web Audio methods (`window.soundFX.playInfection()`).
   - It randomly rolls out patches (`simulateDailyUpdates()`) on 1-4 random nodes.
   - It records history and executes `onTick()`, which calls `updateUI()`.
   - `updateUI()` pushes raw history into `charts.renderAll()`.

---

## 3. Detailed Audit Findings

### 3.1 Trace of UI Controls to Invocations
| UI Control ID | DOM Event | Invoked Function / Method | Mutates State? |
|---|---|---|---|
| `btn-play` | `click` | `simulation.togglePlay()` | Sets `simulation.isRunning`, starts/clears `setTimeout` |
| `btn-step` | `click` | `simulation.stepDay()` | Advances `currentDay`, executes propagation step |
| `btn-reset` | `click` | `simulation.resetSimulation()` | Resets nodes to `susceptible`, clears history & particles |
| `btn-update-daily` | `click` | `simulation.installDailyUpdatesManually()` | Patches random nodes, adds alert, updates history |
| `check-auto-update`| `change` | Direct assignment | Toggles `simulation.autoDailyUpdates` |
| `select-malware` | `change` | `simulation.setMalware()`, `resetSimulation()` | Switches active threat, resets network state |
| `select-topology`| `change` | `network.generateTopology()`, `resetSimulation()` | Rebuilds node/link arrays, resets state |
| `.speed-btn` | `click` | `simulation.setSpeed()` | Modifies `simulation.speed`, reschedules `setTimeout` |
| `canvas-network` | `mousedown` | `network.findNodeAt()` | Sets `network.selectedNode`, opens inspector drawer |
| `btn-insp-patch` | `click` | Anonymous in `app.js` | Direct mutation: `node.state = 'patched'`, `shieldActive = true` |
| `btn-insp-infect`| `click` | `simulation.infectPatientZero(node.id)` | Direct mutation: sets node to infected |
| `btn-insp-isolate`| `click` | Anonymous in `app.js` | Direct mutation: toggles `node.shieldActive` |
| `btn-sound` | `click` | `window.soundFX.toggleMute()` | Toggles audio mute |
| `btn-open-database`| `click` | `renderDatabaseCatalog()` | Opens modal, queries `window.MalwareDatabase` |
| `form-zeroday` | `submit` | Anonymous in `app.js` | Pushes to `window.MalwareDatabase`, resets simulation |
| `btn-open-threat-feed`| `click`| Anonymous in `app.js` | Opens threat feed modal |
| `btn-fetch-now` | `click` | `threatFeed.fetchNow()` | Asynchronously fetches from Flask proxy endpoints |
| `btn-import-all` | `click` | `threatFeed.importAll()` | Copies entries into `window.MalwareDatabase` |
| `btn-generate-report`| `click`| `reporter.generate()` | Synchronously reads canvas DOM & builds PDF via jsPDF |
| `btn-export-logs`| `click` | Anonymous in `app.js` | Serializes simulation history to client JSON download |

### 3.2 Simulation State Mutations
- **State Inconsistencies**: Nodes possess both `state` (`susceptible`, `exposed`, `infected`, `compromised`, `patched`), `payloadStatus`, `compromiseType`, and `shieldActive`.
- **Bypassing the Simulation Core**: Inspector buttons (`btn-insp-patch`, `btn-insp-isolate`) directly mutate node object properties inside `app.js` without dispatching events through `SimulationEngine`.
- **No Invariant Enforcement**: Nothing prevents an already patched node from being manually infected via `btn-insp-infect`, or an isolated node from communicating if candidate selection falls back to the WAN jump logic.

### 3.3 Dead Code & Syntax Errors
1. **Broken NVD Fetcher**: In `js/threat_feed.js` (lines 216-221), `_fetchNVD()` assigns `const entry = ...`, fails to call `entries.push(entry)`, and prematurely executes `return entries;` inside the loop with malformed braces.
2. **Unused Node Properties**: `node.infectionProgress` is declared and reset, but is immediately assigned `1.0` upon infection and never queried by any logic.
3. **Dead Malware Schema Fields**: `airgapHop`, `patchDifficulty`, and `killSwitchDomain` are defined in `database.js` but completely ignored by `simulation_engine.js`.
4. **Redundant Server Update Script**: `update_server.py` duplicates seeding logic from `server.py` and suffers from `os.path.abspath('server.py')` resolving to current working directory rather than script directory.

### 3.4 Duplicated State
- **Threat Database**: Stored in 3 separate locations:
  1. In-memory `window.MalwareDatabase` array in `database.js`.
  2. Browser `localStorage['cyberoutbreak_threat_db']`.
  3. SQLite database table `malware_entries` in `cyberoutbreak_malware.db`.
- **Topology Representation**: Node coordinates, links, and subnet groupings are maintained in `NetworkEngine`, while `SimulationEngine` keeps duplicate lists and references.

### 3.5 UI Values Calculated Independently From Engine
- **Donut Chart**: `ChartsEngine.renderDeviceDonut()` independently recalculates infected device totals by iterating `stats.byDevice`.
- **Daily Damages**: `ChartsEngine.renderDamagesChart()` deduces daily damage by subtracting adjacent entries in `history.damage` rather than receiving true tick-level incident costs.
- **DEFCON Badge**: `app.js` computes threat level on line 185 based on arbitrary fraction thresholds rather than using a risk engine.

### 3.6 Race Conditions & Timer Problems
- **Browser Event Loop Coupling**: Simulation progression depends entirely on `setTimeout`. Tab throttling, browser backgrounding, or heavy DOM reflows alter the effective tick duration.
- **Speed Multiplier Artifacts**: Changing speed (`setSpeed()`) calls `pause()` then `start()`, which can overlap with an already executing tick timeout.
- **PDF Generation During Run**: The check `if (simulation.isRunning)` is checked at button click, but canvas captures occur across an 80ms `setTimeout` window where state could mutate.

### 3.7 Non-Deterministic Randomness
`Math.random()` is used indiscriminately throughout:
- `simulation_engine.js`: lines 76, 77, 215, 218, 221, 224, 239, 258, 286, 300, 304, 315, 373, 385, 391, 419.
- `network_engine.js`: lines 189, 198, 199, 200, 216, 233, 244, 277, 293, 301, 319, 320, 327, 328.
- `threat_feed.js`: lines 290, 291, 292, 320.
There is **no seed support**, making regression testing and repeatable scientific simulations impossible.

### 3.8 Fake & Placeholder Calculations
- **Fake SEIR**: `exposed` state is never entered during natural transmission. Nodes transition instantly $S \rightarrow I$.
- **Fake $R_0$**: Computed as $R_0 = \text{baseR0} \times (S / N) \times (1 - 0.8 R/N)$. This is an algebraic toy formula, not an empirical reproduction number derived from transmission lineage.
- **Fake Damage**: Simply $(\text{infected} + \text{compromised}) \times \text{constant}$. Completely ignores node business criticality, service downtime duration, recovery expenses, or data loss.
- **Fake Network Transmission**: Link properties (bandwidth, latency, firewall, segmentation) do not exist. Any node can transmit across subnets via a hardcoded 20% "WAN jump" coin-toss.

### 3.9 Discrepancies Against README & Documentation
| Claim in README / User Guide | Actual Code Reality |
|---|---|
| "SEIR Model — Susceptible → Exposed → Infected → Recovered/Patched" | Exposed state is unused (0); Recovered state does not exist (only instant Patched). |
| "22+ built-in malware profiles" | Exactly 15 profiles exist in `js/database.js`. |
| API endpoints `GET /api/db/entries`, `POST /api/db/save` | `server.py` actually exposes `/api/db/malware` and `/api/db/malware/<id>`. |
| Database stored at `~/.cyberoutbreak_malware.db` | Stored in current repository directory as `cyberoutbreak_malware.db`. |
| "Air-gap hop modeling" | `airgapHop` is an unreferenced property in data objects. |
| "Live R0 tracking updates every tick" | Formula is an uncalibrated heuristic scaling `malware.r0` by susceptible fraction. |

---

## 4. Proposed Replacement Architecture

To satisfy all 32 required phases, the application will be refactored into a clean, modular, deterministic, and testable architecture:

```
+-------------------------------------------------------------------------------+
|                             SIMULATION CORE                                   |
|                        (Zero DOM / Zero Audio / Pure JS)                      |
|                                                                               |
|  +---------------------+   +---------------------+   +---------------------+  |
|  | RandomSource        |   | SimulationConfig    |   | EventQueue          |  |
|  | Seedable PRNG       |   | Duration, seeds,    |   | Deterministic event |  |
|  | (LCG / PCG / Xor)   |   | rate parameters     |   | ordering & dispatch |  |
|  +---------------------+   +---------------------+   +---------------------+  |
|             |                         |                         |             |
|             v                         v                         v             |
|  +-------------------------------------------------------------------------+  |
|  |                           SimulationEngine                              |  |
|  |   - Authoritative tick controller (step, run, pause, replay)            |  |
|  |   - Snapshot state capture for Replay & Serialization                   |  |
|  +-------------------------------------------------------------------------+  |
|             |                         |                         |             |
|             v                         v                         v             |
|  +---------------------+   +---------------------+   +---------------------+  |
|  | NetworkModel        |   | TransmissionModel   |   | MetricsEngine       |  |
|  | Nodes & Graph Edges |   | Multi-factor causal |   | True SEIR counts,   |  |
|  | Subnets, Firewalls, |   | transmission logic: |   | Empirical Rt from   |  |
|  | Segmentation        |   | P = P_base * vuln * |   | lineage, generation |  |
|  |                     |   | reach * (1-defense) |   | interval, damage    |  |
|  +---------------------+   +---------------------+   +---------------------+  |
|             |                         |                         |             |
|             v                         v                         v             |
|  +---------------------+   +---------------------+   +---------------------+  |
|  | NodeStateMachine    |   | ThreatModel /       |   | DefenderModel &     |  |
|  | S -> E -> I ->      |   | AttackerAgent       |   | DetectionModel      |  |
|  | Compromised ->      |   | Behavioral policies |   | Telemetry, IDS/EDR, |  |
|  | Recovering -> R/P   |   | (Random, Greedy,    |   | Isolate, Patch,     |  |
|  | Isolated, Decom     |   | Stealth)            |   | Restore, Segment    |  |
|  +---------------------+   +---------------------+   +---------------------+  |
+-------------------------------------------------------------------------------+
                                      |
                                      | Authoritative Event Stream & Telemetry
                                      v
+-------------------------------------------------------------------------------+
|                              PRESENTATION LAYER                               |
|                                                                               |
|  +---------------------+   +---------------------+   +---------------------+  |
|  | NetworkRenderer     |   | ChartsRenderer      |   | UIController        |  |
|  | Canvas graph,       |   | SEIR, Rt, damage,   |   | Inspector, buttons, |  |
|  | real event packets, |   | attack graph,       |   | DEFCON, modals,     |  |
|  | visual feedback     |   | transmission tree   |   | telemetry display   |  |
|  +---------------------+   +---------------------+   +---------------------+  |
|             |                         |                         |             |
|             v                         v                         v             |
|  +---------------------+   +---------------------+   +---------------------+  |
|  | AudioPlayer         |   | PDFReporter         |   | StateStorage        |  |
|  | Web Audio reacts    |   | Authoritative run   |   | Run save / load /   |  |
|  | to emitted events   |   | telemetry export    |   | replay system       |  |
|  +---------------------+   +---------------------+   +---------------------+  |
+-------------------------------------------------------------------------------+
                                      |
                                      v
+-------------------------------------------------------------------------------+
| BACKEND SERVICES (server.py)                                                  |
|  - Offline-first SQLite database with migration schema                        |
|  - Caching & sanitized proxy for CISA KEV, NVD, MalwareBazaar                 |
|  - Zero crash on network disconnect                                           |
+-------------------------------------------------------------------------------+
```

---

## 5. Verification Plan & Test Strategy

1. **Automated Unit & Invariant Testing**:
   - Seeded runs yield byte-for-byte identical event histories and final metrics.
   - Node state machine rejects invalid state transitions.
   - Air-gapped / segmented nodes reject lateral transmission unless bridged.
   - Isolated nodes neither transmit nor receive infection.
   - Patched / remediated nodes have strictly reduced/zero attack surface.
   - Empirical $R_t$ and secondary attack rates match exact transmission tree lineage.
   - Node downtime and criticality accurately accumulate in financial damage totals.
   - Replay from tick 0 to $T$ reconstructs the exact state at every step.
2. **Headless Browser Integration Testing**:
   - Verify UI controls, speed multipliers, inspector actions, chart updates, save/load, and replay via automated browser execution.
3. **Failure Injection & Resilience**:
   - Test behavior under simulated EDR failures, network segmentation breakdowns, and firewall drops.

Proceeding to implementation across all phases.
