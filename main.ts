// main.ts — hands the VERDANT STRUGGLE entry in (Node 22, stdlib only, erasable TS).
// The game itself lives in ./game as plain static ES-module files that load offline
// from game/index.html. This program copies game/ and screenshots/ to the output
// directory and writes dossier.json with the vendored make.fun library.
//
// Local run (outside the grader):
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Local play:
//   node serve.ts  →  http://localhost:8080
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });

mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's caps (gate.json): text_max_bytes shapes the dossier bytes; the rest
// mirror refusals — at most 4 screenshots ≤ 256 KiB, game/ ≤ 993 entries / 48 MiB,
// path ≤ 1000 bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
console.log(`dossier written to ${join(out, 'dossier.json')}`);
