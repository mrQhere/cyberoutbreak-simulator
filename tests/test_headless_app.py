#!/usr/bin/env python3
"""
Phase 29 — Comprehensive Headless Browser Integration Test Suite
Automates a real browser session using Selenium with Headless Firefox.
Tests the full operational lifecycle:
- Page load and zero console errors
- Scenario and topology selection
- Authoritative ticking, play, pause, and step
- Deterministic reset
- Node inspection with causal chain factor breakdown
- Active defense intervention (patching and isolation)
- Chart updates and telemetry sync
- Run persistence (save & load)
- Authoritative historical replay scrubbing
"""

import sys
import os
import time
import subprocess
import requests
from selenium import webdriver
from selenium.webdriver.firefox.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select, WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

PORT = 8000
BASE_URL = f"http://127.0.0.1:{PORT}"

def wait_for_server(url, timeout=10):
    start = time.time()
    while time.time() - start < timeout:
        try:
            r = requests.get(url, timeout=1)
            if r.status_code == 200:
                return True
        except Exception:
            time.sleep(0.3)
    return False

def run_headless_tests():
    print("=" * 60)
    print(" STARTING PHASE 29 HEADLESS BROWSER INTEGRATION TEST")
    print("=" * 60)

    # 1. Start background server if not already running
    server_process = None
    if not wait_for_server(BASE_URL, timeout=1):
        print(f"[*] Starting local server on port {PORT}...")
        root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        server_process = subprocess.Popen(
            [sys.executable, "server.py"],
            cwd=root_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        if not wait_for_server(BASE_URL, timeout=10):
            print("[FAIL] Server failed to start within timeout.")
            if server_process:
                server_process.terminate()
            sys.exit(1)

    print(f"[+] Server operational at {BASE_URL}")

    # 2. Configure Headless Firefox
    options = Options()
    options.add_argument("--headless")
    options.add_argument("--width=1280")
    options.add_argument("--height=900")

    driver = None
    tests_passed = 0
    total_tests = 12

    try:
        driver = webdriver.Firefox(options=options)
        driver.get(BASE_URL)
        time.sleep(1.5)

        # ── Test 1: Application Loads & Zero Uncaught Console Errors ──
        print("\n[TEST 1] Verifying Page Load and DOM Initialization...")
        assert "CyberOutbreak" in driver.title, f"Unexpected page title: {driver.title}"
        canvas = driver.find_element(By.ID, "canvas-network")
        assert canvas.is_displayed(), "Network canvas not displayed."

        # Check for uncaught JS errors
        js_errors = driver.execute_script("return window.errors || [];")
        assert len(js_errors) == 0, f"Uncaught JS errors detected: {js_errors}"
        print("  ✓ [PASS] Page loaded cleanly with zero uncaught JavaScript errors.")
        tests_passed += 1

        # ── Test 2: Scenario Selector Works ──
        print("\n[TEST 2] Verifying Scenario Selector & Patient Zero Attribution...")
        sel_scenario_el = driver.find_element(By.ID, "select-scenario")
        select_scenario = Select(sel_scenario_el)
        select_scenario.select_by_value("scenario-iot-botnet")
        time.sleep(0.5)

        current_scen = driver.execute_script("return window.simulation.activeScenario.id;")
        assert current_scen == "scenario-iot-botnet", f"Expected scenario-iot-botnet, got {current_scen}"

        pz_host = driver.find_element(By.ID, "pz-node-label").text
        assert "HOST:" in pz_host and "--" not in pz_host, f"Patient Zero host not attributed: {pz_host}"
        print(f"  ✓ [PASS] Scenario switched to scenario-iot-botnet with Patient Zero: {pz_host}")
        tests_passed += 1

        # ── Test 3: Topology Selector Works ──
        print("\n[TEST 3] Verifying Network Topology Selector...")
        sel_topo_el = driver.find_element(By.ID, "select-topology")
        select_topo = Select(sel_topo_el)
        select_topo.select_by_value("healthcare")
        time.sleep(0.5)

        node_count = driver.execute_script("return window.simulation.network.getAllNodes().length;")
        assert node_count >= 50, f"Expected at least 50 nodes in healthcare topology, got {node_count}"
        print(f"  ✓ [PASS] Healthcare network topology generated with {node_count} nodes.")
        tests_passed += 1

        # ── Test 4: Simulation Starts & Authoritatively Advances ──
        print("\n[TEST 4] Verifying Launch Simulation & Authoritative Ticks...")
        btn_play = driver.find_element(By.ID, "btn-play")
        btn_play.click()
        time.sleep(1.8) # Wait for presentation timer ticks

        current_tick = driver.execute_script("return window.simulation.currentTick;")
        assert current_tick >= 1, f"Expected simulation to advance at least 1 tick, got {current_tick}"
        kpi_day_text = driver.find_element(By.ID, "kpi-current-day").text
        assert "TICK" in kpi_day_text, f"KPI timeline does not reflect tick: {kpi_day_text}"
        print(f"  ✓ [PASS] Simulation started and advanced to Tick {current_tick}.")
        tests_passed += 1

        # ── Test 5: Pause Works & Halts Clock ──
        print("\n[TEST 5] Verifying Pause Mechanism...")
        btn_play.click() # Pause
        paused_tick = driver.execute_script("return window.simulation.currentTick;")
        time.sleep(1.2)
        tick_after_pause = driver.execute_script("return window.simulation.currentTick;")
        assert paused_tick == tick_after_pause, f"Simulation continued advancing while paused: {paused_tick} vs {tick_after_pause}"
        print(f"  ✓ [PASS] Pause verified. Clock solidly halted at Tick {paused_tick}.")
        tests_passed += 1

        # ── Test 6: Step Works (+1 Authoritative Tick) ──
        print("\n[TEST 6] Verifying Step Execution (+1 Tick)...")
        btn_step = driver.find_element(By.ID, "btn-step")
        btn_step.click()
        time.sleep(0.3)
        stepped_tick = driver.execute_script("return window.simulation.currentTick;")
        assert stepped_tick == paused_tick + 1, f"Expected Tick {paused_tick + 1}, got {stepped_tick}"
        print(f"  ✓ [PASS] Step advanced exactly 1 tick to Tick {stepped_tick}.")
        tests_passed += 1

        # ── Test 7: Reset Works & Restores Initial State ──
        print("\n[TEST 7] Verifying Deterministic Reset...")
        btn_reset = driver.find_element(By.ID, "btn-reset")
        btn_reset.click()
        time.sleep(0.5)

        reset_tick = driver.execute_script("return window.simulation.currentTick;")
        assert reset_tick == 0, f"Expected Tick 0 after reset, got {reset_tick}"
        reset_day_text = driver.find_element(By.ID, "kpi-current-day").text
        assert "TICK 0" in reset_day_text, f"KPI does not show TICK 0: {reset_day_text}"
        print("  ✓ [PASS] Reset restored simulation cleanly to Tick 0.")
        tests_passed += 1

        # ── Test 8: Device Inspection & Causal Chain Breakdown ──
        print("\n[TEST 8] Verifying Device Inspector & 'Why is this node infected?' Causal Chain...")
        # Step twice to produce infection/exposure events
        btn_step.click()
        time.sleep(0.2)
        btn_step.click()
        time.sleep(0.2)

        # Select patient zero node to inspect
        driver.execute_script("""
            const pz = window.simulation.patientZero;
            const node = window.simulation.network.getNode(pz.nodeId);
            window.network.selectedNode = node;
            window.network.onNodeSelected(node);
        """)
        time.sleep(0.5)

        drawer = driver.find_element(By.ID, "device-inspector")
        assert "open" in drawer.get_attribute("class"), "Device inspector drawer is not open."

        insp_host_text = driver.find_element(By.ID, "insp-hostname").text
        assert len(insp_host_text) > 0, "Inspector hostname is empty."

        causal_chain_el = driver.find_element(By.ID, "insp-causal-chain")
        causal_text = causal_chain_el.text
        assert len(causal_text) > 10, f"Causal chain analysis is empty: {causal_text}"
        print(f"  ✓ [PASS] Node inspector open for {insp_host_text} with causal factors: {causal_text[:60]}...")
        tests_passed += 1

        # ── Test 9: Defensive Interventions (Patch & Isolate) ──
        print("\n[TEST 9] Verifying Active Defensive Interventions...")
        btn_patch = driver.find_element(By.ID, "btn-insp-patch")
        btn_patch.click()
        time.sleep(0.3)

        node_state = driver.execute_script("return window.network.selectedNode.state;")
        assert node_state in ["PATCHED", "RECOVERING", "RECOVERED"], f"Node state did not reflect patch: {node_state}"

        btn_isolate = driver.find_element(By.ID, "btn-insp-isolate")
        btn_isolate.click()
        time.sleep(0.3)

        is_isolated = driver.execute_script("return window.network.selectedNode.securityControls.isolated;")
        assert is_isolated is True, "Node was not marked isolated after clicking Isolate."
        print(f"  ✓ [PASS] Defense actions verified: state is {node_state} and isolation status is {is_isolated}.")
        tests_passed += 1

        # ── Test 10: Telemetry Sync & Canvas Charts Update ──
        print("\n[TEST 10] Verifying Charts Engine & Authoritative Telemetry Sync...")
        telemetry_len = driver.execute_script("return window.simulation.metricsEngine.telemetryHistory.length;")
        assert telemetry_len >= 2, f"Expected at least 2 telemetry records, found {telemetry_len}"

        chart_curve = driver.find_element(By.ID, "chart-curve")
        assert chart_curve.is_displayed(), "Epidemic curve canvas not visible."
        print(f"  ✓ [PASS] Charts Engine verified with {telemetry_len} synchronized telemetry ticks.")
        tests_passed += 1

        # ── Test 11: Run Persistence (Save & Load Manager) ──
        print("\n[TEST 11] Verifying Run Persistence & Serialization...")
        errs_before = driver.execute_script("return window.errors || [];")
        print("  [DEBUG] window.errors before click:", errs_before)

        btn_open_sl = driver.find_element(By.ID, "btn-open-save-load")
        modal_sl = driver.find_element(By.ID, "modal-save-load")

        # Test opening the modal directly or via button
        driver.execute_script("""
            const btn = document.getElementById('btn-open-save-load');
            if (btn) btn.click();
        """)
        time.sleep(0.6)

        errs_after = driver.execute_script("return window.errors || [];")
        print("  [DEBUG] window.errors after click:", errs_after)
        print("  [DEBUG] modal class:", modal_sl.get_attribute("class"))

        assert "open" in modal_sl.get_attribute("class"), f"Save/Load modal not opened. Class: {modal_sl.get_attribute('class')}"

        btn_save = driver.find_element(By.ID, "btn-save-current-run")
        driver.execute_script("arguments[0].click();", btn_save)
        time.sleep(1.0)

        # Verify saved run appears in list
        saved_list = driver.find_element(By.ID, "saved-runs-list")
        assert "saved-run-card" in saved_list.get_attribute("innerHTML"), "Saved run card not found in list."

        close_btn = driver.find_element(By.ID, "btn-close-save-load")
        driver.execute_script("arguments[0].click();", close_btn)
        time.sleep(0.3)
        print("  ✓ [PASS] Simulation run serialized and persisted successfully.")
        tests_passed += 1

        # ── Test 12: Historical Replay Mode & Scrubber ──
        print("\n[TEST 12] Verifying Authoritative Replay Mode & State Restoration...")
        # Step a few more times
        driver.execute_script("arguments[0].click();", btn_step)
        time.sleep(0.2)
        driver.execute_script("arguments[0].click();", btn_step)
        time.sleep(0.2)

        final_tick = driver.execute_script("return window.simulation.currentTick;")
        assert final_tick >= 4, f"Current tick is {final_tick}, need at least 4 for replay test."

        btn_replay = driver.find_element(By.ID, "btn-toggle-replay")
        driver.execute_script("arguments[0].click();", btn_replay)
        time.sleep(0.4)

        scrubber_box = driver.find_element(By.ID, "replay-scrubber-box")
        assert scrubber_box.is_displayed(), "Replay scrubber box not displayed."

        # Scrub backward to Tick 1
        driver.execute_script("""
            const slider = document.getElementById('replay-slider');
            slider.value = 1;
            slider.dispatchEvent(new Event('input'));
        """)
        time.sleep(0.5)

        restored_tick = driver.execute_script("return window.simulation.currentTick;")
        assert restored_tick == 1, f"Expected simulation to restore to Tick 1, got {restored_tick}"
        print(f"  ✓ [PASS] Replay scrubber successfully restored state to Tick {restored_tick}.")
        tests_passed += 1

    except Exception as e:
        print(f"\n[FAIL] Exception during headless integration test: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if driver:
            driver.quit()
        if server_process:
            server_process.terminate()
            server_process.wait()

    print("\n" + "=" * 60)
    print(f" HEADLESS TEST SUMMARY: {tests_passed}/{total_tests} TESTS PASSED")
    print("=" * 60)

    if tests_passed == total_tests:
        print("[SUCCESS] All Phase 29 Headless Browser Integration Tests Passed!\n")
        sys.exit(0)
    else:
        print(f"[FAILURE] Only {tests_passed}/{total_tests} passed.\n")
        sys.exit(1)

if __name__ == '__main__':
    run_headless_tests()
