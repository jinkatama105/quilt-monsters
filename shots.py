#!/usr/bin/env python3
"""shots.py — serve game/ and capture the four required screenshots with Playwright.
Writes JPEGs to screenshots/ (quality tuned so each stays under 256 KiB, longest side 1280).
Also fails loudly on any console error or page error."""
import subprocess, sys, time, os, json
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.join(HERE, "game")
OUT = os.path.join(HERE, "screenshots")
PORT = 8791
BASE = f"http://127.0.0.1:{PORT}/index.html"

os.makedirs(OUT, exist_ok=True)

server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--directory", GAME],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)

SHOTS = [
    ("01-title.jpg", "?debug=title", None),
    ("02-battle.jpg", "?debug=battle", None),
    ("03-codex.jpg", "?debug=codex", None),
    ("04-victory.jpg", "?debug=win", None),
    ("05-town.jpg", "?debug=field", "town"),
    ("06-route.jpg", None, "route"),
    ("07-forest.jpg", None, "forest"),
    ("08-cave.jpg", None, "cave"),
    ("09-ghibli-boss.jpg", None, "boss"),
]

errors = []
try:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        for name, query, special in SHOTS:
            if special is None:
                page.goto(BASE + query)
                page.wait_for_timeout(1400)
            elif special == "boss":
                page.goto(BASE + "?debug=field")
                page.wait_for_timeout(600)
                page.evaluate("__vsHooks.startEncounterBattle(__vsHooks.makeCreature('gelundra', 14), 'boss', {key:'gelundra', name:'Gelundra'})")
                page.wait_for_timeout(1600)
            else:
                page.goto(BASE + "?debug=field")
                page.wait_for_timeout(600)
                page.evaluate("(z) => { __vs.world.warpTo({zone:z, px:7, py:10}); }", special)
                page.wait_for_timeout(1600)
            path = os.path.join(OUT, name)
            page.screenshot(path=path, type="jpeg", quality=88)
            size = os.path.getsize(path)
            print(f"{name}: {size} bytes")
            if size > 262144:
                page.screenshot(path=path, type="jpeg", quality=70)
                print(f"{name}: re-shot at q70 -> {os.path.getsize(path)} bytes")
        browser.close()
finally:
    server.terminate()

if errors:
    print("CONSOLE ERRORS:")
    for e in errors:
        print("  -", e)
    sys.exit(1)
print("no console errors; shots written")
