import os
import sys
import subprocess
import requests
import time
from selenium import webdriver
from selenium.webdriver.firefox.options import Options

def wait_for_server(url, timeout=5):
    start = time.time()
    while time.time() - start < timeout:
        try:
            r = requests.get(url, timeout=1)
            if r.status_code == 200:
                return True
        except Exception:
            time.sleep(0.3)
    return False

server_process = None
if not wait_for_server("http://127.0.0.1:8000", timeout=1):
    server_process = subprocess.Popen(
        [sys.executable, "server.py"],
        cwd=os.path.dirname(os.path.abspath(__file__)),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    assert wait_for_server("http://127.0.0.1:8000", timeout=5), "Server failed to start."

options = Options()
options.add_argument('--headless')

try:
    driver = webdriver.Firefox(options=options)
    driver.get("http://127.0.0.1:8000")
    time.sleep(1.5)
    
    errors = driver.execute_script("return window.errors || [];")
    print("Window Errors:", errors)
    assert len(errors) == 0, f"Errors found: {errors}"
    print("✓ Page loaded successfully with zero errors.")
    driver.quit()
except Exception as e:
    print("Selenium Error:", str(e))
    sys.exit(1)
finally:
    if server_process:
        server_process.terminate()
        server_process.wait()

