"""
CyberOutbreak Local Server & Threat Intelligence Gateway
- Pure Python 3 server supporting Flask (with CORS) and standard library http.server fallback
- Offline-first design with local SQLite persistence and automated schema migrations
- Relational storage for threats, vulnerabilities, scenarios, simulation_runs, simulation_events, simulation_snapshots
- External Threat Feeds proxy & local offline cache: CISA KEV, NVD, MalwareBazaar
"""

import os
import sys
import json
import sqlite3
import urllib.request
import urllib.error
from datetime import datetime

# ─────────────────────────────────────────────
# Database Configuration & Schema Migrations
# ─────────────────────────────────────────────

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cyberoutbreak_malware.db')

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def run_migrations():
    """Apply versioned relational schema migrations."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    applied = {row['version'] for row in cursor.execute('SELECT version FROM schema_migrations').fetchall()}

    # Migration 1: Core Relational Schema
    if 1 not in applied:
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS threats (
                id                  TEXT PRIMARY KEY,
                name                TEXT NOT NULL,
                category            TEXT,
                type                TEXT,
                year                INTEGER,
                origin              TEXT,
                severity            TEXT,
                vector              TEXT,
                r0                  REAL,
                base_transmission   REAL,
                stealth             INTEGER,
                lethality           INTEGER,
                source              TEXT,
                description         TEXT,
                data_json           TEXT,
                created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS vulnerabilities (
                cve_id              TEXT PRIMARY KEY,
                threat_id           TEXT,
                cvss                REAL,
                vector              TEXT,
                required_port       INTEGER,
                description         TEXT,
                FOREIGN KEY(threat_id) REFERENCES threats(id) ON DELETE CASCADE
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS scenarios (
                id                  TEXT PRIMARY KEY,
                name                TEXT NOT NULL,
                topology            TEXT NOT NULL,
                device_count        INTEGER,
                duration            INTEGER,
                seed                INTEGER,
                description         TEXT,
                config_json         TEXT NOT NULL,
                is_custom           INTEGER DEFAULT 0,
                created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS simulation_runs (
                id                  TEXT PRIMARY KEY,
                scenario_id         TEXT,
                threat_id           TEXT,
                seed                INTEGER,
                final_tick          INTEGER,
                peak_infected       INTEGER,
                total_compromised   INTEGER,
                total_damage        INTEGER,
                result              TEXT,
                data_json           TEXT,
                created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS simulation_events (
                id                  TEXT PRIMARY KEY,
                run_id              TEXT,
                tick                INTEGER,
                type                TEXT NOT NULL,
                source_node_id      TEXT,
                target_node_id      TEXT,
                result              TEXT,
                reason              TEXT,
                data_json           TEXT,
                created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(run_id) REFERENCES simulation_runs(id) ON DELETE CASCADE
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS simulation_snapshots (
                id                  TEXT PRIMARY KEY,
                run_id              TEXT,
                tick                INTEGER,
                telemetry_json      TEXT NOT NULL,
                network_state_json  TEXT,
                created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(run_id) REFERENCES simulation_runs(id) ON DELETE CASCADE
            )
        ''')

        # Backward compatibility view / table for legacy malware_entries
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS malware_entries (
                id          TEXT PRIMARY KEY,
                name        TEXT NOT NULL,
                category    TEXT,
                type        TEXT,
                year        INTEGER,
                origin      TEXT,
                severity    TEXT,
                cve         TEXT,
                vector      TEXT,
                r0          REAL,
                source      TEXT,
                date_added  TEXT,
                data_json   TEXT NOT NULL,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        cursor.execute('INSERT INTO schema_migrations (version) VALUES (1)')
        conn.commit()
        print("[DB] Applied migration 1: Relational simulation schema created.")

    conn.close()

# ─────────────────────────────────────────────
# Seed Built-in Threats into Database
# ─────────────────────────────────────────────

def seed_database_if_empty():
    conn = get_db_connection()
    count = conn.execute('SELECT COUNT(*) FROM threats').fetchone()[0]

    if count == 0:
        built_in_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'js', 'simulation', 'BuiltInThreats.js')
        if os.path.exists(built_in_file):
            try:
                # Load built-in threats by parsing JSON-like array or seed records directly
                sample_threats = [
                    ("wannacry", "WannaCry (WanaCrypt0r 2.0)", "ransomware", "Cryptoworm", 2017, "Lazarus Group", "CRITICAL", "SMBv1 Remote Code Execution (Port 445)", 5.8, 0.72, 2, 9, "BUILT_IN", "Weaponized NSA EternalBlue exploit to propagate autonomously."),
                    ("mirai", "Mirai Botnet", "botnet", "IoT Swarm Botnet", 2016, "Paras Jha & Josiah White", "HIGH", "Telnet/SSH Default Credential Brute Force", 8.4, 0.85, 4, 6, "BUILT_IN", "Scans ARC, ARM, MIPS IoT cameras and home routers using default dictionary."),
                    ("notpetya", "NotPetya (ExPetr)", "ransomware", "Destructive Wiper", 2017, "Sandworm / GRU", "CRITICAL", "M.E.Doc Supply Chain Update & PsExec/EternalBlue", 6.4, 0.78, 3, 10, "BUILT_IN", "Destructive wiper irreversibly scrambling MFT and MBR."),
                    ("conficker", "Conficker (Downup / Kido)", "worm", "Self-Propagating Worm", 2008, "Unknown", "HIGH", "MS08-067 RPC NetPathCanonicalize Buffer Overflow", 7.2, 0.82, 5, 5, "BUILT_IN", "Infected 10+ million systems via MS08-067 and DGA domains."),
                    ("stuxnet", "Stuxnet", "scada", "Cyberweapon / Rootkit", 2010, "Operation Olympic Games", "CRITICAL", "Air-Gap USB LNK Exploit & Siemens Step7 PLC", 2.1, 0.45, 9, 10, "BUILT_IN", "World's first proven digital weapon capable of physical destruction of centrifuges."),
                    ("solarwinds", "SUNBURST (SolarWinds)", "supplychain", "Supply Chain Backdoor", 2020, "APT29 / Cozy Bear", "CRITICAL", "Digitally Signed Orion DLL Update", 2.8, 0.48, 10, 8, "BUILT_IN", "Covert backdoor injected into software build pipeline."),
                    ("pegasus", "Pegasus", "spyware", "Zero-Click Mobile Spyware", 2021, "NSO Group", "CRITICAL", "FORCEDENTRY iMessage Zero-Click", 1.4, 0.42, 10, 8, "BUILT_IN", "Military-grade spyware gaining root privilege with zero user interaction."),
                    ("lockbit3", "LockBit 3.0", "ransomware", "Ransomware-as-a-Service", 2022, "LockBit Cartel", "CRITICAL", "Exposed RDP & Citrix Bleed", 3.8, 0.55, 6, 9, "BUILT_IN", "Fast multi-threaded cryptographic ransomware with double extortion."),
                    ("log4shell", "Log4Shell Exploitation", "worm", "Zero-Day Remote Exploit", 2021, "Alibaba Cloud Security", "CRITICAL", "JNDI / LDAP Injection in Apache Log4j 2", 7.9, 0.84, 6, 8, "BUILT_IN", "Remote code execution triggered by string logging."),
                    ("xzbackdoor", "XZ Utils Backdoor", "supplychain", "Open-Source Supply Chain", 2024, "Jia Tan", "CRITICAL", "Obfuscated M4 Macro & OpenSSH Interception", 3.2, 0.52, 10, 9, "BUILT_IN", "Subversive backdoor targeting OpenSSH server authentication.")
                ]

                for t in sample_threats:
                    conn.execute('''
                        INSERT OR IGNORE INTO threats
                        (id, name, category, type, year, origin, severity, vector, r0, base_transmission, stealth, lethality, source, description, data_json)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (t[0], t[1], t[2], t[3], t[4], t[5], t[6], t[7], t[8], t[9], t[10], t[11], t[12], t[13], json.dumps({
                        "id": t[0], "name": t[1], "category": t[2], "type": t[3], "year": t[4], "origin": t[5],
                        "severity": t[6], "vector": t[7], "r0": t[8], "transmissionRate": t[9], "stealth": t[10], "lethality": t[11]
                    })))

                    # Mirror into legacy table for backwards compatibility
                    conn.execute('''
                        INSERT OR IGNORE INTO malware_entries
                        (id, name, category, type, year, origin, severity, cve, vector, r0, source, date_added, data_json)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (t[0], t[1], t[2], t[3], t[4], t[5], t[6], "CVE-N/A", t[7], t[8], t[12], "2024-01-01", json.dumps({"id": t[0], "name": t[1]})))

                conn.commit()
                print(f"[DB] Seeded {len(sample_threats)} authoritative threat profiles.")
            except Exception as e:
                print(f"[DB] Warning: seeding error: {e}")

    conn.close()

# ─────────────────────────────────────────────
# Safe Threat Feed Proxies (Offline-Resilient)
# ─────────────────────────────────────────────

def fetch_feed_safe(url, timeout=8):
    """Fetch external feed with strict timeout, offline handling, and fallback."""
    headers = {
        'User-Agent': 'CyberOutbreak-Research-Simulator/2.0'
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            if response.status == 200:
                data = json.loads(response.read().decode('utf-8'))
                return data, None
    except Exception as err:
        return None, str(err)
    return None, "Unknown error"

# ─────────────────────────────────────────────
# Flask Application Setup
# ─────────────────────────────────────────────

try:
    from flask import Flask, jsonify, request, send_from_directory
    from flask_cors import CORS

    app = Flask(__name__, static_folder='.', static_url_path='')
    CORS(app)

    @app.after_request
    def add_header(response):
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        return response

    @app.route('/')
    def index():
        return app.send_static_file('index.html')

    @app.route('/<path:path>')
    def static_proxy(path):
        return app.send_static_file(path)

    # ── Threat Intelligence Proxy Endpoints ──
    @app.route('/api/threats/cisa-kev')
    def api_cisa_kev():
        url = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
        data, err = fetch_feed_safe(url, timeout=6)
        if data:
            return jsonify(data)
        return jsonify({"vulnerabilities": [], "offline": True, "error": err or "Offline mode active"})

    @app.route('/api/threats/nvd')
    def api_nvd():
        url = "https://services.nvd.nist.gov/rest/json/cves/2.0?cvssV3Severity=CRITICAL&resultsPerPage=30"
        data, err = fetch_feed_safe(url, timeout=6)
        if data:
            return jsonify(data)
        return jsonify({"vulnerabilities": [], "offline": True, "error": err or "NVD Offline/Rate-limited"})

    @app.route('/api/threats/malwarebazaar')
    def api_malwarebazaar():
        return jsonify({"data": [], "offline": True, "message": "MalwareBazaar simulation metadata cache"})

    # ── Database Relational Endpoints ──
    @app.route('/api/db/threats', methods=['GET', 'POST'])
    def api_threats():
        conn = get_db_connection()
        if request.method == 'POST':
            payload = request.get_json(force=True)
            if not payload or not payload.get('id'):
                conn.close()
                return jsonify({"error": "Missing required 'id'"}), 400
            conn.execute('''
                INSERT INTO threats (id, name, category, type, year, origin, severity, vector, r0, base_transmission, stealth, lethality, source, description, data_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    data_json = excluded.data_json
            ''', (
                payload.get('id'), payload.get('name', 'Custom Threat'), payload.get('category', 'worm'),
                payload.get('type', 'Custom'), payload.get('year', 2024), payload.get('origin', 'User Lab'),
                payload.get('severity', 'HIGH'), payload.get('vector', ''), payload.get('r0', 3.0),
                payload.get('baseTransmission', 0.5), payload.get('stealth', 5), payload.get('lethality', 7),
                payload.get('source', 'USER'), payload.get('description', ''), json.dumps(payload)
            ))
            conn.commit()
            conn.close()
            return jsonify({"status": "saved", "id": payload['id']})

        rows = conn.execute('SELECT * FROM threats ORDER BY created_at DESC').fetchall()
        entries = [dict(r) for r in rows]
        conn.close()
        return jsonify({"count": len(entries), "threats": entries})

    @app.route('/api/db/runs', methods=['GET', 'POST'])
    @app.route('/api/runs', methods=['GET', 'POST'])
    def api_runs():
        conn = get_db_connection()
        if request.method == 'POST':
            payload = request.get_json(force=True)
            run_id = payload.get('id') or f"run-{int(datetime.now().timestamp())}"
            conn.execute('''
                INSERT INTO simulation_runs (id, scenario_id, threat_id, seed, final_tick, peak_infected, total_compromised, total_damage, result, data_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json
            ''', (
                run_id, payload.get('scenarioId'), payload.get('threatId'), payload.get('seed', 0),
                payload.get('finalTick', 0), payload.get('peakInfected', 0), payload.get('totalCompromised', 0),
                payload.get('totalDamage', 0), payload.get('result', 'COMPLETED'), json.dumps(payload)
            ))
            conn.commit()
            conn.close()
            return jsonify({"status": "saved", "runId": run_id})

        rows = conn.execute('SELECT id, scenario_id, threat_id, seed, final_tick, peak_infected, total_damage, result, created_at FROM simulation_runs ORDER BY created_at DESC LIMIT 50').fetchall()
        runs = [dict(r) for r in rows]
        conn.close()
        return jsonify({"count": len(runs), "runs": runs})

    @app.route('/api/db/runs/<run_id>', methods=['GET'])
    def api_get_run(run_id):
        conn = get_db_connection()
        row = conn.execute('SELECT * FROM simulation_runs WHERE id = ?', (run_id,)).fetchone()
        conn.close()
        if not row:
            return jsonify({"error": "Run not found"}), 404
        return jsonify(json.loads(row['data_json']) if row['data_json'] else dict(row))

    # Backward compatibility with existing frontend
    @app.route('/api/db/malware', methods=['GET', 'POST'])
    def api_malware_legacy():
        conn = get_db_connection()
        if request.method == 'POST':
            entry = request.get_json(force=True)
            if entry and entry.get('id'):
                conn.execute('''
                    INSERT INTO malware_entries (id, name, category, type, year, origin, severity, cve, vector, r0, source, date_added, data_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET name = excluded.name, data_json = excluded.data_json
                ''', (
                    entry.get('id'), entry.get('name', ''), entry.get('category', ''), entry.get('type', ''),
                    entry.get('year', 2024), entry.get('origin', ''), entry.get('severity', ''), entry.get('cve', ''),
                    entry.get('vector', ''), entry.get('r0', 3.0), entry.get('_source', 'USER'),
                    entry.get('_dateAdded', ''), json.dumps(entry)
                ))
                conn.commit()
                conn.close()
                return jsonify({"status": "ok", "id": entry['id']})
            conn.close()
            return jsonify({"error": "Invalid entry"}), 400

        rows = conn.execute('SELECT data_json FROM malware_entries ORDER BY created_at DESC').fetchall()
        entries = []
        for r in rows:
            try:
                entries.append(json.loads(r['data_json']))
            except Exception:
                pass
        conn.close()
        return jsonify({"count": len(entries), "entries": entries})

    @app.route('/api/db/malware/bulk', methods=['POST'])
    def api_malware_bulk_legacy():
        conn = get_db_connection()
        payload = request.get_json(force=True)
        entries = payload if isinstance(payload, list) else payload.get('entries', [])
        saved = 0
        for entry in entries:
            if not entry.get('id'): continue
            conn.execute('''
                INSERT INTO malware_entries (id, name, category, type, year, origin, severity, cve, vector, r0, source, date_added, data_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET name = excluded.name, data_json = excluded.data_json
            ''', (
                entry.get('id'), entry.get('name', ''), entry.get('category', ''), entry.get('type', ''),
                entry.get('year', 2024), entry.get('origin', ''), entry.get('severity', ''), entry.get('cve', ''),
                entry.get('vector', ''), entry.get('r0', 3.0), entry.get('_source', 'FEED'),
                entry.get('_dateAdded', ''), json.dumps(entry)
            ))
            saved += 1
        conn.commit()
        conn.close()
        return jsonify({"status": "ok", "saved": saved})

    @app.route('/api/db/stats')
    def api_stats():
        conn = get_db_connection()
        threats_count = conn.execute('SELECT COUNT(*) FROM threats').fetchone()[0]
        runs_count = conn.execute('SELECT COUNT(*) FROM simulation_runs').fetchone()[0]
        conn.close()
        return jsonify({"threats": threats_count, "runs": runs_count, "db_path": DB_PATH})

except ImportError:
    app = None

# ─────────────────────────────────────────────
# Server Entry Point
# ─────────────────────────────────────────────

def main():
    run_migrations()
    seed_database_if_empty()

    port = int(os.environ.get("PORT", 8000))
    print("═══════════════════════════════════════════════")
    print(f"  CyberOutbreak Simulation Platform Server")
    print(f"  URL:      http://127.0.0.1:{port}")
    print(f"  Database: {DB_PATH}")
    print("═══════════════════════════════════════════════")

    if app:
        app.run(host='127.0.0.1', port=port, debug=False)
    else:
        import http.server
        import socketserver
        print("[Server] Running standard library HTTP server fallback on port", port)
        handler = http.server.SimpleHTTPRequestHandler
        with socketserver.TCPServer(("127.0.0.1", port), handler) as httpd:
            httpd.serve_forever()

if __name__ == '__main__':
    main()
