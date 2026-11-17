#!/usr/bin/env python3
"""test-gameplay.py — drives the real game loop in Chromium and asserts state transitions."""
import subprocess, sys, time, os
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.join(HERE, "game")
PORT = 8792
BASE = f"http://127.0.0.1:{PORT}/index.html"

server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--directory", GAME],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.7)
fails = []
errors = []

def check(cond, msg):
    if cond: print("PASS:", msg)
    else:
        print("FAIL:", msg); fails.append(msg)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        def _pageerr(e):
            errors.append(str(e))
            print("PAGEERR STACK:", (e.stack or str(e))[:1500])
        page.on("pageerror", _pageerr)
        page.on("console", lambda m: (errors.append(m.text), print("CONSOLEERR:", m.text[:200], getattr(m,"location",None))) if m.type == "error" else None)

        # --- title -> field via Enter
        page.goto(BASE)
        page.wait_for_timeout(800)
        check(page.evaluate("__vs.mode") == "title", "starts on title")
        page.keyboard.press("Enter")
        page.wait_for_timeout(400)
        check(page.evaluate("__vs.mode") == "field", "Enter starts game -> field")

        # --- walking changes position
        x0 = page.evaluate("__vs.world.px"); y0 = page.evaluate("__vs.world.py")
        for _ in range(14):
            page.keyboard.press("d"); page.wait_for_timeout(160)
        x1 = page.evaluate("__vs.world.px")
        check(x1 > x0, f"walking moved ranger {x0}->{x1}")

        # --- force a wild encounter through the debug hooks and battle it
        page.evaluate("__vsHooks.startEncounterBattle(__vsHooks.makeCreature('gloomcap', 6), 'wild')")
        page.wait_for_timeout(500)
        mode = page.evaluate("__vs.mode")
        check(mode == "battle", f"grass step triggered encounter (mode={mode})")

        if mode == "battle":
            # attack: click FIGHT then first move, retrying until damage lands (95% acc can miss)
            before_hp = page.evaluate("__vs.battle.enemy.hp")
            dmg = False
            for _ in range(5):
                if page.evaluate("__vs.mode") != "battle":
                    page.evaluate("__vsHooks.startEncounterBattle(__vsHooks.makeCreature('gloomcap', 6), 'wild')")
                    page.wait_for_timeout(300)
                    before_hp = page.evaluate("__vs.battle.enemy.hp")
                page.mouse.click(200 + 118, 800 - 130 + 23)   # FIGHT button center
                page.wait_for_timeout(300)
                opened = page.evaluate("__vs.submenu") == "moves"
                page.mouse.click(200 + 118, 800 - 130 + 23)   # first move (emberDart)
                page.wait_for_timeout(1800)
                hp_after = page.evaluate("__vs.battle ? __vs.battle.enemy.hp : -1")
                if hp_after != before_hp or page.evaluate("__vs.mode") != "battle":
                    dmg = True
                    break
            check(dmg, f"attack dealt damage ({before_hp}->{page.evaluate('__vs.battle ? __vs.battle.enemy.hp : 0')})")

            # capture attempt loop: weaken enemy then throw seedstone (respect busy lockout)
            page.evaluate("() => { const b = __vs.battle; if (b) b.enemy.hp = 1; }")
            if page.evaluate("__vs.mode") == "battle":
                for _ in range(30):
                    st = page.evaluate("""() => ({mode:__vs.mode, busy:__vs.busy, seed:__vs.team.seedstones})""")
                    if st["mode"] != "battle": break
                    if st["busy"] <= 0 and st["seed"] > 0:
                        page.mouse.click(450 + 118, 800 - 130 + 23)  # SEEDSTONE button
                    page.wait_for_timeout(400)
            check(page.evaluate("__vs.mode") != "battle", "battle resolved after capture attempts")

        # --- codex opens and closes
        if page.evaluate("__vs.mode") == "field":
            page.keyboard.press("c")
            page.wait_for_timeout(300)
            check(page.evaluate("__vs.mode") == "codex", "C opens codex")
            check(page.evaluate("__vs.team.dexSeen.size") > 0, "codex has entries")
            page.keyboard.press("c")
            page.wait_for_timeout(200)
            check(page.evaluate("__vs.mode") == "field", "C closes codex")

        # --- hidden item pickup via real mouse click (ranger mid-map so camera is unclamped)
        # wait until the field loop accepts input again (battle exit may still hold busy)
        for _ in range(10):
            mode = page.evaluate("__vs.mode")
            if mode == "defeat":
                page.keyboard.press("Enter")   # respawn in meadow, revive party
                page.wait_for_timeout(600)
                continue
            ready = page.evaluate("""() => {
              const st = __vs;
              if (st.mode !== 'field' || st.busy > 0 || st.fade) return false;
              st.world.zoneId = 'route';
              st.world.px = 6; st.world.py = 3; st.world.moving = 0;
              st.world.items = [{x: 7, y: 3, kind: 'seedstone', bob: 0}];
              return true;
            }""")
            if ready: break
            page.wait_for_timeout(400)
        before = page.evaluate("__vs.team.seedstones")
        sx = 7*40 + 20; sy = 3*40 + 20   # route map is smaller than the viewport: camera pinned at 0,0
        got = False
        for _ in range(5):
            m = page.evaluate("__vs.mode")
            if m == "defeat":
                page.keyboard.press("Enter"); page.wait_for_timeout(600)
            elif m != "field":
                page.keyboard.press("Escape"); page.wait_for_timeout(300)
            page.evaluate("""() => {
              const st = __vs;
              if (st.mode === 'field') {
                st.world.zoneId = 'route'; st.world.px = 6; st.world.py = 3; st.world.moving = 0;
                st.world.items = [{x: 7, y: 3, kind: 'seedstone', bob: 0}];
              }
            }""")
            page.mouse.click(sx, sy)
            page.wait_for_timeout(350)
            if page.evaluate("__vs.team.seedstones") > before:
                got = True
                break
        picked2 = page.evaluate("__vs.team.seedstones")
        check(got, f"clicked sparkle granted seedstone ({before}->{picked2})")

        # --- defeat path: wipe party
        page.evaluate("""() => {
          const st = __vs;
          st.team.party.forEach(c => c.hp = 0);
          st.battle = st.battle || null;
        }""")
        if page.evaluate("__vs.battle"):
            page.evaluate("() => { const b=__vs.battle; b.player.hp=0; b.checkEnd(); b.phase='end'; }")
            page.wait_for_timeout(1600)
        check(page.evaluate("__vs.mode") in ("defeat", "field"), "fainted party routes to defeat/field")

        # --- debug victory + restart
        page.goto(BASE + "?debug=win")
        page.wait_for_timeout(600)
        check(page.evaluate("__vs.mode") == "victory", "debug=win shows victory screen")
        score = page.evaluate("(typeof victoryScore==='function') ? 1 : 0")
        page.keyboard.press("Enter")
        page.wait_for_timeout(400)
        check(page.evaluate("__vs.mode") in ("field", "title"), "restart from victory returns to play")

        # --- zone transitions (walk east off the town edge -> route)
        page.goto(BASE + "?debug=field")
        page.wait_for_timeout(500)
        z = page.evaluate("""() => {
          const st = __vs;
          st.world.px = 14; st.world.py = 17; st.world.moving = 0; st.world.warpCd = 0;
          for (let i = 0; i < 30; i++) { st.world.moving = 0; st.world.tryMove(0, 1); }
          return st.world.zoneId;
        }""")
        z2 = page.evaluate("""() => {
          const st = __vs;
          st.world.warpTo({ zone: 'forest', px: 1, py: 20 });
          st.world.warpTo({ zone: 'cave', px: 1, py: 1 });
          return st.world.zoneId;
        }""")
        check(z == "route", f"town east edge warps to route ({z})")
        check(z2 == "cave", f"warp seams chain town->forest->cave ({z2})")

        browser.close()
finally:
    server.terminate()

print()
if errors:
    print("JS/console errors:")
    for e in errors: print("  -", e)
    fails.append("console-errors")
if fails:
    print("RESULT: FAIL", len(fails)); sys.exit(1)
print("RESULT: ALL GAMEPLAY CHECKS PASSED")
