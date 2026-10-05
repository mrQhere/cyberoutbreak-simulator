# CyberOutbreak Simulator 🦠

![Status](https://img.shields.io/badge/Status-Active-success) ![License](https://img.shields.io/badge/License-MIT-blue) ![Python](https://img.shields.io/badge/Python-3.8%2B-blue) ![Flask](https://img.shields.io/badge/Flask-2.x-lightgrey)

Welcome to **CyberOutbreak Simulator**, your very own digital petri dish. We built a high-fidelity, mathematically coherent, deterministic, and causally explainable cyber-epidemic simulator so you don't have to test malware on your production servers (seriously, please don't).

Whether you're researching threat propagation, training analysts, or just curious how quickly a single unpatched IoT smart toaster can bring down a hospital network, you've come to the right place.

---

## ⚡ Plug & Play (Zero to Outbreak in 30 Seconds)

We hate complicated setups just as much as you do. CyberOutbreak is designed to be **100% Plug & Play**.

```bash
# 1. Clone the repo (you probably did this already)
git clone https://github.com/mrQhere/cyberoutbreak-simulator.git
cd cyberoutbreak-simulator

# 2. Start the local server
chmod +x start.sh
./start.sh

# 3. Open your browser
# Navigate to http://127.0.0.1:8000
```
*That’s it.* No obscure databases to configure, no Docker containers throwing tantrums. Just raw, unadulterated simulation bliss.

---

## 🛡️ The "Please Don't Sue Us" Safety Boundary

This is an **abstract cybersecurity simulation and research environment**. 
- Does it look real? Yes.
- Does it *behave* like real malware? Mathematically, yes.
- Will it actually hack your computer, steal your passwords, or summon demons? **No.**

All CVEs, MITRE ATT&CK techniques, and threat profiles are discrete simulation metadata. There are **zero real vulnerabilities**, **zero real malware payloads**, and **absolutely zero manipulative data**. We follow a strict principle: **No inaccurate data, even if it means displaying "N/A"**. If the math can't prove it, we don't fake it. 

---

## 🧠 Core Simulation Architecture (The Nerdy Stuff)

Under the hood, we threw out the DOM and built a pure, headless computational engine (`js/simulation/`). It’s smart, it’s fast, and it’s completely deterministic.

- **Deterministic PRNG:** Powered by Mulberry32. If you use the same seed (`12345`), you get the exact same outbreak every single time. Perfect for science!
- **9-State Machine:** Devices aren't just "good" or "bad". They transition through `SUSCEPTIBLE` ➔ `EXPOSED` ➔ `INFECTED` ➔ `COMPROMISED` ➔ `RECOVERING` ➔ `RECOVERED` (or `PATCHED` / `ISOLATED`). 
- **Causal Transmission:** Every infection has a receipt. Our additive math (`Base + Vulnerability + Subnet - EDR - Firewall`) explains *exactly* why Node A infected Node B.
- **Empirical $R_t$:** We calculate the true effective reproduction number based on actual transmission lineage.
- **Financial Damage Model:** Because executives only understand dollar signs.

---

## 🧪 Validating the Science

Don't trust our math? Good! You shouldn't trust strangers on the internet. Run the tests yourself:

```bash
# 1. Pure simulation core unit tests (18 tests verifying determinism, R0, etc.)
node tests/test_simulation_core.js

# 2. Performance benchmark (Watch it handle 5,000 nodes at ~42ms per tick!)
node tests/test_performance.js

# 3. Headless browser integration tests (Selenium + Firefox)
python3 tests/test_headless_app.py
```

---

## 📖 Learn More

Ready to unleash your inner chaos monkey? Check out the [USER_GUIDE.md](USER_GUIDE.md) to learn how to inject network failures, track patient zero, and synthesize your own custom zero-days.

Happy hunting! 🎯
