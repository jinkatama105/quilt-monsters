// Entrypoint for the make.fun submission. Copies the finished game into the
// output dir MAKEFUN_OUTPUT_DIR (game/ and screenshots/), then writes
// dossier.json there using make.fun's own buildDossier, so our file matches
// byte for byte what the scorer rebuilds from what we hand in.
//
// The entry this describes is Quilt Monsters: a pixel auto-battler roguelite.
// You draft a team of patchwork monsters, then watch the fight play itself
// out across a run of battles, shops and a road map. The screenshots/*.png
// (prod-run, run_shop, ui-shop, ui-trainer) cite that loop: a run in
// progress, the shop between fights, and the team and trainer screens.
//
// Run: MAKEFUN_OUTPUT_DIR=/path/to/out node main.ts   (Node 22, no deps)

import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

// The bounty's caps, from its gate.json. Only text_max_bytes shapes the
// dossier's bytes; the rest just refuse what is too big.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const outDir = process.env.MAKEFUN_OUTPUT_DIR;
if (!outDir) {
  console.error('MAKEFUN_OUTPUT_DIR is not set: nothing to build');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
cpSync(join('game'), join(outDir, 'game'), { recursive: true });
cpSync(join('screenshots'), join(outDir, 'screenshots'), { recursive: true });

// buildDossier reads <dir>/game and <dir>/screenshots, so point it at the copy.
const dossier = buildDossier(outDir, CAPS);
const dossierPath = join(outDir, 'dossier.json');
writeFileSync(dossierPath, dossier);
console.log(`${dossierPath}: ${dossier.length} bytes`);
