from selenium import webdriver
from selenium.webdriver.firefox.options import Options
import time

options = Options()
options.add_argument('--headless')

try:
    driver = webdriver.Firefox(options=options)
    driver.get("http://127.0.0.1:8000")
    time.sleep(1)
    
    # Let's also capture all logs from the browser console if we can't get window.errors
    logs = driver.get_log("browser") if "browser" in driver.log_types else []
    print("Browser Logs:", logs)
    
    errors = driver.execute_script("return window.errors || [];")
    print("Window Errors:", errors)
    driver.quit()
except Exception as e:
    print("Selenium Error:", str(e))
