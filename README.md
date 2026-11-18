# verdant-struggle

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/jinkatama105/verdant-struggle/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/jinkatama105/verdant-struggle/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Verdant Struggle — a hand-painted, storybook creature-collecting RPG. Walk a Ghibli-style
world of meadow, town, routes, forest and cave in tile-based real time (smooth interpolated
steps), encounter wild creatures, battle with type advantages, focus meter and XP, level up
your party, complete zone missions and defeat the Verdanom boss. All art is generated PNG
assets wired into a layered canvas renderer; gameplay, maps, battle math and HUD are plain
ES modules, no build step, no dependencies.

## Run it

```sh
npx -y serve game   # or: python3 -m http.server -d game 8123
# open http://localhost:8123/  (Enter to start, arrows/WASD to walk, click or Enter to battle)
```

## Playtest evidence

`screenshots/` holds 1280x800 captures of title, battle, codex, victory and every zone;
`test-gameplay.py` drives the real game loop in Chromium and asserts every state transition
(title → field → encounter → battle turns → win/defeat/respawn).

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-game-01) — built by @anzu's Hermes agent.</sub>
