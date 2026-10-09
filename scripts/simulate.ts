// Rule 7: 1,000 random runs per vibe; reports reach-Day-7 rates and ending spread.
// `--write-rarity` stores ending odds per character in data/rarity.json for the Verdict Card.
// Random runs measure balance. They do NOT prove coverage: see tests/scripted.test.ts.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_ROOT, loadCity } from '../src/content/node';
import { simulate } from '../src/engine/sim';
import type { EndingId, VibeId } from '../src/engine/types';

const content = loadCity();
const N = Number(process.argv.find((a) => a.startsWith('--n='))?.slice(4) ?? 1000);
const writeRarity = process.argv.includes('--write-rarity');
const playable = content.characters.filter((c) => content.launch[c.id]?.pass);
if (!playable.length) {
  console.error('No playable characters. Run `npm run validate` first.');
  process.exit(1);
}

const pct = (a: number, b: number) => `${((a / b) * 100).toFixed(1)}%`.padStart(6);
const ENDINGS: EndingId[] = ['locked_in', 'counter_con', 'survived', 'scandal', 'sapa', 'breakdown', 'ghosted', 'fumbled', 'obsession', 'walked_away'];
const rarity: Record<string, { runs: number; endings: Partial<Record<EndingId, number>> }> = {};
let failed = false;

for (const ch of playable) {
  console.log(`\n=== ${ch.name}: ${N} random runs per vibe (payments off, no bail-outs) ===`);
  console.log('vibe        day7    ' + ENDINGS.map((e) => e.slice(0, 9).padStart(10)).join(''));
  const total: Partial<Record<EndingId, number>> = {};
  let runs = 0;
  for (const v of content.vibes) {
    const st = simulate(content, ch.id, N, { vibe: v.id as VibeId, seedBase: 101 + content.vibes.indexOf(v), policies: ['random'], spotChance: 0.3 });
    runs += st.runs;
    for (const e of ENDINGS) total[e] = (total[e] ?? 0) + (st.endings[e] ?? 0);
    console.log(`${v.id.padEnd(10)} ${pct(st.reachedDay7, st.runs)}  ` + ENDINGS.map((e) => pct(st.endings[e] ?? 0, st.runs).padStart(10)).join('') + `   avg cards ${st.avgCards}`);
    if (st.reachedDay7 === 0) {
      console.log(`  FAIL: vibe ${v.id} never reaches Day 7`);
      failed = true;
    }
  }
  console.log(`truth roll check (all vibes): good-one share should be ~25%`);
  const t = simulate(content, ch.id, 2000, { seedBase: 999, policies: ['random'] });
  for (const [k, n] of Object.entries(t.truths)) console.log(`  ${k.padEnd(16)} ${pct(n, t.runs)}`);
  rarity[ch.id] = { runs, endings: Object.fromEntries(ENDINGS.map((e) => [e, (total[e] ?? 0) / runs])) };
}

if (writeRarity) {
  writeFileSync(join(DATA_ROOT, 'rarity.json'), JSON.stringify(rarity, null, 2) + '\n');
  console.log('\nWrote data/rarity.json');
}
if (failed) process.exit(1);
