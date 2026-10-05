# CyberOutbreak — The Unofficial Field Guide 🦠

Welcome to **CyberOutbreak Simulator**. You’ve successfully managed to get your hands on a professional cyber-epidemic modeling platform. Don’t panic—it’s designed to be completely **Plug & Play**.

This guide is your best friend. Whether you're here to learn about malware propagation, test incident response, or just watch things turn red, we’ve got you covered.

---

## ⚡ Plug & Play: How to Start Breaking Things (Safely)

We meant it when we said Plug & Play. Here’s the 1-2-3 of starting a simulation:

1. **Fire it up:** Run `./start.sh` in your terminal and open `http://127.0.0.1:8000`.
2. **Pick a Poison:** Choose a **Scenario** from the top dropdown (e.g., *Corporate Ransomware* or *IoT Botnet*).
3. **Roll the Dice:** Set a **Seed** (like `12345`) so your outbreak is 100% reproducible. 
4. **Hit Play:** Click **Launch Simulation** and watch the chaos unfold.

*Pro Tip: Use the speed multipliers (up to 100x) if you’re impatient. The math stays perfectly accurate no matter how fast it renders.*

---

## 🛡️ The "No Inaccurate Data" Principle

Let’s get one thing straight: **If the math can't prove it, we don't fake it.** 
- Every infection event has a mathematical causal receipt.
- If there’s not enough data to calculate an empirical $R_t$ (Reproduction Number), we proudly display **"N/A"**. We will never show you manipulative or guessed data.
- **Safety Guarantee:** This is an abstract environment. There are **zero real vulnerabilities**, **zero real malware**, and absolutely nothing here will escape and attack your actual laptop. (You're welcome).

---

## 🕹️ Interface Layout: What am I looking at?

| Zone | What it does (and why you care) |
|------|-------------|
| **Header** | Your command center. Threat badges, seed rolling (🎲), and big buttons. |
| **KPI Strip** | Live scoreboards. Infected devices, patched percentages, and exactly how many dollars the breach is costing your imaginary company. |
| **Network Canvas** | The battlefield. Drag, zoom, and click on nodes to inspect them. |
| **Right Sidebar** | Data nerds rejoice: SEIR charts, $R_t$ trends, financial damages, and live bulletins. |

---

## 🦠 The 9-State Epidemiological Machine

Nodes aren't just "good" or "bad". They live complex lives:

| Color | State | What it means in plain English |
|-------|-------|----------------------------------|
| 🟢 Green | `SUSCEPTIBLE` | Ignorance is bliss. Clean, but vulnerable. |
| 🟠 Amber | `EXPOSED` | They clicked the link. Malware is incubating. |
| 🔴 Red | `INFECTED` | Active infection. Spreading the love to neighbors. |
| 🟣 Purple | `COMPROMISED` | Game over. Ransomware deployed or data exfiltrated. |
| 🔵 Blue | `RECOVERING` | IT is frantically restoring from backups. |
| ✨ Emerald | `RECOVERED` | Clean and immune (for now). |
| 🛡️ Cyan | `PATCHED` | Vulnerability closed. Transmission probability neutralized. |
| 🚧 Orange | `ISOLATED` | Quarantined. Cannot talk to anyone. |
| 🪦 Slate | `DECOMMISSIONED` | R.I.P. Server thrown out the window. |

---

## 🕵️ Device Inspector (The "Why is this node infected?" Tool)

Click any device on the canvas to open the **Device Inspector**. 
This is where the magic happens. You’ll see:
- Identity, IP, OS, and Business Value.
- **Causal Chain Breakdown**: The exact math that led to infection. You’ll see base virulence, subnet bonuses (+0.20), CVE matches (+0.25), and EDR deductions (-0.20). No guessing required.

**Incident Response Actions:**
- **Investigate**: Probe telemetry to confirm threat indicators.
- **Isolate Endpoint**: Sever network ties instantly.
- **Deploy Hotfix**: Patch the CVE.
- **Restore Clean Image**: Bring them back from the dead.

---

## 💥 Chaos Engineering & Failure Injection

Because things don't go wrong enough in real life, you can force them to go wrong here.
Click the **Failure Injection** button to:
- Drop firewalls.
- Crash EDR agents.
- Simulate a router failure.
Stress-test your network's resilience while under active attack.

---

## 💾 Save, Load, and Export

We respect your time. 
- Click **Save / Load** to persist your current disaster to the local SQLite database.
- Use the **Replay Scrubber** (next to the Play button) to rewind time tick-by-tick if you missed exactly *when* the domain controller fell.
- Hit **Export Logs** to grab the raw JSON telemetry for your own external analysis.

Happy hunting, and remember: it’s just a simulation. *Breathe.*
