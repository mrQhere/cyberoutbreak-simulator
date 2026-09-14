"""
CyberOutbreak Local Server
- Serves the frontend (index.html and static assets)
- Proxies external CISA KEV and NVD threat intelligence APIs (bypasses CORS)
- Manages a per-user persistent SQLite database for the malware/virus library
"""

import os
import sqlite3
import json
import requests
from flask import Flask, jsonify, request, send_from_directory, g
from flask_cors import CORS

# ─────────────────────────────────────────────
# App Setup
# ─────────────────────────────────────────────

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# SQLite database stored in user's home directory for persistence across sessions
DB_PATH = os.path.join(os.path.expanduser('~'), '.cyberoutbreak_malware.db')


# ─────────────────────────────────────────────
# Database Initialization & Connection
# ─────────────────────────────────────────────

def get_db():
    """Get the database connection for the current request context."""
    if 'db' not in g:
        g.db = sqlite3.connect(DB_PATH, detect_types=sqlite3.PARSE_DECLTYPES)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(error):
    """Close the database connection at the end of each request."""
    db = g.pop('db', None)
    if db is not None:
        db.close()


def init_db():
    """Create the database schema if it doesn't already exist."""
    db = sqlite3.connect(DB_PATH)
    db.execute('''
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
    db.commit()
    db.close()
    print(f"[DB] Malware database initialized at: {DB_PATH}")


# ─────────────────────────────────────────────
# Static File Serving
# ─────────────────────────────────────────────

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/<path:path>')
def static_proxy(path):
    return app.send_static_file(path)

@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response


# ─────────────────────────────────────────────
# Threat Intelligence Proxy Endpoints
# ─────────────────────────────────────────────

@app.route('/api/threats/cisa-kev')
def fetch_cisa_kev():
    """Proxy the CISA KEV catalog to avoid CORS issues."""
    url = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"error": str(e), "vulnerabilities": []}), 500


@app.route('/api/threats/nvd')
def fetch_nvd():
    """Proxy the NVD API for recent critical CVEs (rate-limited without API key)."""
    url = "https://services.nvd.nist.gov/rest/json/cves/2.0?cvssV3Severity=CRITICAL&resultsPerPage=50"
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"error": str(e), "vulnerabilities": []}), 500


@app.route('/api/threats/malwarebazaar')
def fetch_malwarebazaar():
    """Proxy the MalwareBazaar API for recent malware samples."""
    url = "https://mb-api.abuse.ch/api/v1/"
    data = {
        "query": "get_recent",
        "selector": "time"
    }
    try:
        response = requests.post(url, data=data, timeout=15)
        response.raise_for_status()
        return jsonify(response.json())
    except Exception as e:
        return jsonify({"query_status": "error", "error": str(e), "data": []}), 500


# ─────────────────────────────────────────────
# Malware Database (Persistent SQLite) Endpoints
# ─────────────────────────────────────────────

@app.route('/api/db/malware', methods=['GET'])
def get_malware_db():
    """Return all stored malware entries from the local user database."""
    db = get_db()
    rows = db.execute('SELECT data_json FROM malware_entries ORDER BY created_at DESC').fetchall()
    entries = [json.loads(row['data_json']) for row in rows]
    return jsonify({"count": len(entries), "entries": entries})


@app.route('/api/db/malware', methods=['POST'])
def save_malware_entry():
    """Save or update a malware entry in the persistent database."""
    entry = request.get_json(force=True)
    if not entry or not entry.get('id'):
        return jsonify({"error": "Missing required field: id"}), 400

    db = get_db()
    db.execute('''
        INSERT INTO malware_entries (id, name, category, type, year, origin, severity, cve, vector, r0, source, date_added, data_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            data_json = excluded.data_json,
            created_at = CURRENT_TIMESTAMP
    ''', (
        entry.get('id'),
        entry.get('name', ''),
        entry.get('category', ''),
        entry.get('type', ''),
        entry.get('year', 0),
        entry.get('origin', ''),
        entry.get('severity', ''),
        entry.get('cve', ''),
        entry.get('vector', ''),
        entry.get('r0', 0.0),
        entry.get('_source', 'USER'),
        entry.get('_dateAdded', ''),
        json.dumps(entry)
    ))
    db.commit()
    return jsonify({"status": "ok", "id": entry['id']})


@app.route('/api/db/malware/bulk', methods=['POST'])
def bulk_save_malware():
    """Bulk-save multiple malware entries (e.g., after importing a feed)."""
    payload = request.get_json(force=True)
    entries = payload if isinstance(payload, list) else payload.get('entries', [])

    db = get_db()
    saved = 0
    for entry in entries:
        if not entry.get('id'):
            continue
        db.execute('''
            INSERT INTO malware_entries (id, name, category, type, year, origin, severity, cve, vector, r0, source, date_added, data_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                data_json = excluded.data_json
        ''', (
            entry.get('id'), entry.get('name', ''), entry.get('category', ''),
            entry.get('type', ''), entry.get('year', 0), entry.get('origin', ''),
            entry.get('severity', ''), entry.get('cve', ''), entry.get('vector', ''),
            entry.get('r0', 0.0), entry.get('_source', 'FEED'),
            entry.get('_dateAdded', ''), json.dumps(entry)
        ))
        saved += 1

    db.commit()
    return jsonify({"status": "ok", "saved": saved})


@app.route('/api/db/malware/<entry_id>', methods=['DELETE'])
def delete_malware_entry(entry_id):
    """Remove a specific malware entry from the database."""
    db = get_db()
    db.execute('DELETE FROM malware_entries WHERE id = ?', (entry_id,))
    db.commit()
    return jsonify({"status": "deleted", "id": entry_id})


@app.route('/api/db/stats', methods=['GET'])
def get_db_stats():
    """Return statistics about the local malware database."""
    db = get_db()
    total = db.execute('SELECT COUNT(*) as cnt FROM malware_entries').fetchone()['cnt']
    sources = db.execute('SELECT source, COUNT(*) as cnt FROM malware_entries GROUP BY source').fetchall()
    return jsonify({
        "total": total,
        "by_source": {row['source']: row['cnt'] for row in sources},
        "db_path": DB_PATH
    })


# ─────────────────────────────────────────────
# Start
# ─────────────────────────────────────────────

if __name__ == '__main__':
    init_db()
    port = int(os.environ.get("PORT", 8000))
    print(f"═══════════════════════════════════════════════")
    print(f"  CyberOutbreak Local Server")
    print(f"  URL:  http://127.0.0.1:{port}")
    print(f"  DB:   {DB_PATH}")
    print(f"═══════════════════════════════════════════════")
    app.run(host='127.0.0.1', port=port, debug=False)
