#!/usr/bin/env python3
"""test-showdown.py — drives the auto-battler in headless Chromium."""
import subprocess, sys, time, os
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.join(HERE, "game")
PORT = 8796
BASE = f"http://127.0.0.1:{PORT}/index.html?road=1"

server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--directory", GAME],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.7)
fails, errors = [], []

def check(cond, msg):
    print(("PASS: " if cond else "FAIL: ") + msg)
    if not cond: fails.append(msg)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.on("pageerror", lambda e: (errors.append(str(e)), print("PAGEERR:", str(e)[:400])))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

        page.goto(BASE)
        page.wait_for_timeout(700)
        page.evaluate("localStorage.clear()")
        page.keyboard.press("Enter")
        page.wait_for_timeout(400)
        check(page.evaluate("__vs.mode") in ("field", "road"), "play shell active")

        # start a showdown wild battle (3-5 foes)
        page.evaluate("__vs._draftDone=true; __vsHooks.startEncounterBattle(__vsHooks.makeCreature('mossbeak', 6), 'wild')")
        page.wait_for_timeout(300)
        b = page.evaluate("(()=>{const s=__vs.battle;return s?{isSD:!!s.isShowdown,phase:s.phase,pu:s.squad('player').length,eu:s.squad('enemy').length}:null})()")
        check(b and b["isSD"], "battle is a Showdown")
        check(b and b["phase"] == "vs", "starts on VS splash")
        page.screenshot(path=os.path.join(HERE, "screenshots", "sd-vs.jpg"))

        page.wait_for_timeout(2100)
        b2 = page.evaluate("({phase:__vs.battle.phase, pu:__vs.battle.squad('player').length, eu:__vs.battle.squad('enemy').length})")
        check(b2["phase"] == "live", "auto-battle is live")
        page.screenshot(path=os.path.join(HERE, "screenshots", "sd-live.jpg"))

        # FF to 4x and let it resolve (max 90s of sim via looped update is too slow — fast-forward clicks)
        page.mouse.click(1280/2 + 74, 34)  # ff button
        page.mouse.click(1280/2 + 74, 34)  # ff again -> 4x
        for _ in range(40):
            ph = page.evaluate("__vs.battle ? __vs.battle.phase : 'none'")
            if ph != "live": break
            page.wait_for_timeout(1000)
        check(ph in ("end", "none"), f"battle resolves (phase={ph})")
        res = page.evaluate("__vs.battle ? {winner:__vs.battle.winner, xp:__vs.battle.xpGained} : {winner:'auto',xp:0}")
        print("RESULT:", res)
        page.screenshot(path=os.path.join(HERE, "screenshots", "sd-end.jpg"))

        # click continue -> back to field
        if ph == "end":
            page.mouse.click(640, 400)
            page.wait_for_timeout(400)
            check(page.evaluate("__vs.mode") in ("field", "defeat", "victory"), f"continues to {page.evaluate('__vs.mode')}")

        # capture path: fresh game, spam capture with seedstones
        page.evaluate("__vsHooks.newGame(); __vs._draftDone=true; __vs.team.seedstones=30; __vsHooks.startEncounterBattle(__vsHooks.makeCreature('tidrel',3),'wild')")
        page.wait_for_timeout(2300)
        for _ in range(6):
            page.mouse.click(1280-190+85, 800-66+23)
            page.wait_for_timeout(250)
        w = page.evaluate("__vs.battle ? __vs.battle.winner : 'none'")
        print("capture spam winner:", w)
        check(w in ("captured", "player", "live", "none") or page.evaluate("__vs.mode")=="field", "capture path doesn't crash")

        # pause works
        page.evaluate("__vsHooks.newGame()")
        page.evaluate("__vs._draftDone=true; __vsHooks.startEncounterBattle(__vsHooks.makeCreature('voltip',3),'wild')")
        page.wait_for_timeout(2300)
        page.mouse.click(1280/2 - 74, 34)
        t1 = page.evaluate("__vs.battle.time")
        page.wait_for_timeout(900)
        t2 = page.evaluate("__vs.battle.time")
        check(abs(t2 - t1) < 0.05, "pause freezes the sim")
        page.screenshot(path=os.path.join(HERE, "screenshots", "sd-pause.jpg"))

        # boss battle uses bossSquad (leader + escorts)
        page.evaluate("__vsHooks.newGame(); __vs.team.healPartyFull()")
        page.evaluate("__vsHooks.startEncounterBattle(__vsHooks.makeCreature('magmoth',14),'boss',{key:'magmoth',zone:'cliff',name:'Magmoth'})")
        page.wait_for_timeout(300)
        eu = page.evaluate("__vs.battle.squad('enemy').length")
        check(2 <= eu <= 4, f"boss squad has escorts (n={eu})")

        check(not errors, f"no JS errors ({len(errors)}): " + (errors[0][:200] if errors else ""))
        browser.close()
finally:
    server.terminate()

print("\n" + ("ALL PASS" if not fails else f"{len(fails)} FAILURES"))
sys.exit(1 if fails or errors else 0)
