#!/usr/bin/env python3
"""test-run.py — drive the quilt run (Batomon day loop) headless."""
import subprocess, sys, time, os
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.join(HERE, "game")
PORT = 8799
BASE = f"http://127.0.0.1:{PORT}/index.html"

server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--directory", GAME],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.7)
fails, errors = [], []

def check(cond, msg):
    print(("PASS: " if cond else "FAIL: ") + msg)
    if not cond: fails.append(msg)

def click_btn(page, btn_id):
    """Click a run.js button by its id, using its real on-canvas rect."""
    rect = page.evaluate(f"""(()=>{{
      const b = (__vs.run._btns||[]).find(x=>x.id==='{btn_id}'); if(!b) return null;
      const c = document.querySelector('canvas'); const r = c.getBoundingClientRect();
      return {{x: r.left + (b.x+b.w/2)*(r.width/c.width), y: r.top + (b.y+b.h/2)*(r.height/c.height)}};
    }})()""")
    if not rect: return False
    page.mouse.click(rect["x"], rect["y"]); page.wait_for_timeout(280)
    return True

try:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.on("pageerror", lambda e: (errors.append(str(e)), print("PAGEERR:", str(e)[:400])))
        def on_console(m):
            if m.type == "error" and "404" not in m.text and "Failed to load resource" not in m.text:
                errors.append(m.text)
        page.on("console", on_console)

        page.goto(BASE)
        page.wait_for_timeout(700)
        page.evaluate("localStorage.clear()")
        page.keyboard.press("Enter")
        page.wait_for_timeout(400)
        st = page.evaluate("({mode: __vs.mode, run: __vs.run && __vs.run.phase})")
        check(st["mode"] == "run" and st["run"] == "trainer", f"trainer select shows ({st})")

        check(click_btn(page, "trainer:ranger"), "clicked trainer:pip")
        st = page.evaluate("({run: __vs.run.phase, trainer: __vs.run.trainerId, coins: __vs.run.coins})")
        check(st["run"] == "shop", f"trainer chosen -> shop ({st})")

        # buy until board has 2 (affordability may cap it)
        for i in range(4): click_btn(page, f"buy:{i}")
        board = page.evaluate("__vs.run.board.length")
        check(board >= 1, f"bought monsters, board={board}")

        check(click_btn(page, "battle"), "clicked FIGHT")
        phase = page.evaluate("({run:__vs.run.phase, mode:__vs.mode})")
        check(phase["run"] == "battle" and phase["mode"] == "battle", f"battle scene entered ({phase})")

        # speed up then wait for auto-resolution (engine pauses on the end card awaiting a tap)
        page.evaluate("__vs.battle && (__vs.battle.speed=4)")
        p2 = {"phase": "battle"}
        for _ in range(80):
            page.wait_for_timeout(400)
            ended = page.evaluate("__vs.battle && __vs.battle.phase === 'end'")
            if ended:
                page.keyboard.press("Enter"); page.wait_for_timeout(350)
            p2 = page.evaluate("({phase: __vs.run && __vs.run.phase, mode: __vs.mode})")
            if p2["phase"] != "battle": break
        check(p2["phase"] == "reward", f"battle auto-resolved to reward ({p2})")
        hearts = page.evaluate("__vs.run.hearts")
        check(hearts is not None, f"hearts tracked: {hearts}")

        check(click_btn(page, "nextday"), "clicked NEXT DAY")
        p3 = page.evaluate("__vs.run.phase")
        check(p3 in ("shop", "champion", "over"), f"advanced day -> {p3}")

        # persistence: reload -> title -> Enter (continue) restores run
        day_before = page.evaluate("__vs.run.day")
        page.reload(); page.wait_for_timeout(900)
        page.keyboard.press("Enter"); page.wait_for_timeout(400)
        p4 = page.evaluate("({mode: __vs.mode, run: __vs.run && __vs.run.phase, day: __vs.run && __vs.run.day})")
        check(p4["mode"] == "run" and p4["day"] == day_before, f"run restored after reload d{day_before} ({p4})")

        check(len(errors) == 0, f"no console errors ({errors[:2]})")
        os.makedirs(os.path.join(HERE, "screenshots"), exist_ok=True)
        page.screenshot(path=os.path.join(HERE, "screenshots", "run_shop.png"))
        browser.close()
finally:
    server.terminate()

print("\n" + ("ALL PASS" if not fails else f"{len(fails)} FAILED"))
sys.exit(0 if not fails else 1)
