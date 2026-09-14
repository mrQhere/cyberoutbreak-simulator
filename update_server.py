import sqlite3
import os
import requests
import json

DB_PATH = os.path.join(os.path.dirname(os.path.abspath('server.py')), 'cyberoutbreak_malware.db')

def seed_cisa_kev():
    db = sqlite3.connect(DB_PATH)
    count = db.execute('SELECT COUNT(*) FROM malware_entries').fetchone()[0]
    if count == 0:
        print("Fetching real CISA KEV database...")
        try:
            resp = requests.get('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json', timeout=10)
            data = resp.json()
            saved = 0
            for vuln in data.get('vulnerabilities', [])[:50]:
                uid = "cisa_" + vuln.get('cveID', '').replace('-', '_')
                entry = {
                    "id": uid,
                    "name": vuln.get('vulnerabilityName', 'Unknown'),
                    "category": "cisa_kev",
                    "type": "Exploited Vulnerability",
                    "year": int(vuln.get('dateAdded', '2020')[:4]),
                    "origin": "Real World",
                    "severity": "CRITICAL",
                    "cve": vuln.get('cveID', ''),
                    "vector": vuln.get('shortDescription', '')[:50],
                    "r0": 3.0,
                    "_source": "CISA_KEV"
                }
                db.execute('''
                    INSERT OR IGNORE INTO malware_entries
                    (id, name, category, type, year, origin, severity, cve, vector, r0, source, date_added, data_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    uid, entry['name'], entry['category'], entry['type'], entry['year'],
                    entry['origin'], entry['severity'], entry['cve'], entry['vector'],
                    entry['r0'], entry['_source'], vuln.get('dateAdded', ''), json.dumps(entry)
                ))
                saved += 1
            db.commit()
            print(f"Seeded {saved} real CISA KEV threats into local DB.")
        except Exception as e:
            print("Failed to seed CISA KEV:", str(e))

if __name__ == "__main__":
    seed_cisa_kev()
