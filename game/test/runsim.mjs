// headless sim of the quilt run loop (logic only, no canvas)
import { makeRun, chooseTrainer, rollShop, buy, sell, autoMerge, makeOpponent, stageReward, nextDay, freeRerolls, dayIncome, serializeRun, restoreRun, TRAINERS_BY_ID } from '../src/run.js';
import { Showdown } from '../src/showdown.js';

function pickBest(run) {
  // buy the most expensive affordable in slot order
  for (let i = 0; i < run.shop.length; i++) if (run.shop[i] && run.shop[i].cost <= run.coins) { const e = buy(run, i); if (!e) return true; }
  return false;
}

let won = 0, lost = 0, champ = 0;
for (let trial = 0; trial < 30; trial++) {
  const run = makeRun(trial * 7919 + 13);
  chooseTrainer(run, ['ranger', 'sparker', 'cinder'][trial % 3]);
  for (let day = 1; day <= 12 && run.phase !== 'over' && run.phase !== 'champion'; day++) {
    rollShop(run);
    let guard = 0;
    while (pickBest(run) && guard++ < 8);
    autoMerge(run);
    if (!run.board.length) { run.alive = false; break; }
    // run the battle through Showdown at 16x virtual speed
    const opp = makeOpponent(run);
    const sd = new Showdown(run.board.slice(), opp.squad, 'run', null);
    sd.speed = 4;
    let steps = 0;
    while (sd.phase !== 'end' && steps++ < 100000) sd.update(0.25);
    const didWin = sd.winner === 'player';
    if (didWin) won++; else lost++;
    stageReward(run, didWin);
    if (run.phase === 'champion') { champ++; break; }
    if (run.reward) { /* take first trinket offer if any */ }
    nextDay(run);
    // serialize round-trip once
    if (day === 3) {
      const r2 = restoreRun(JSON.parse(JSON.stringify(serializeRun(run))));
      if (r2.day !== run.day || r2.coins !== run.coins || r2.board.length !== run.board.length) { console.error('SERIALIZE MISMATCH day', day); process.exit(1); }
    }
  }
  if (run.phase === 'over' && run.alive) console.error('alive but over?', trial);
}
console.log(`trials=30 battleW=${won} battleL=${lost} champion=${champ}`);
console.log('OK');
