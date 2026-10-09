// Build-time content validation and launch gate (rules 6, 13, 16, 17, 22).
// Fails the build if any playable character breaks a rule.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_ROOT, loadCity } from '../src/content/node';
import { validateCity } from '../src/engine/validate';
import { simulate, POLICIES } from '../src/engine/sim';
import type { EndingId } from '../src/engine/types';

const content = loadCity('lagos', { withGenerated: false });
const report = validateCity(content);
const errors = report.issues.filter((i) => i.level === 'error');
const warns = report.issues.filter((i) => i.level === 'warn');

const ALL_ENDINGS: EndingId[] = ['locked_in', 'counter_con', 'survived', 'scandal', 'sapa', 'breakdown', 'ghosted', 'fumbled', 'obsession', 'walked_away'];
const launch: Record<string, { pass: boolean; errors: string[] }> = {};
const hasDeck = (id: string) => content.cards.some((c) => c.character === id);

for (const ch of content.characters) {
  const r = report.characters[ch.id];
  const errs = [...r.errors];
  if (hasDeck(ch.id) && r.pass) {
    // Rule 17: every ending reachable in simulation (mixed bot policies, with and without bail-outs).
    const stats = simulate(content, ch.id, 3000, { policies: POLICIES, seedBase: 17, spotChance: 0.35 });
    const stats2 = simulate(content, ch.id, 600, { policies: POLICIES, seedBase: 29, acceptBailout: true, loanChance: 0.2 });
    const expected = ALL_ENDINGS.filter((e) => (e === 'obsession' ? ch.temperament.controlling : true));
    for (const e of expected) if (!stats.endings[e] && !stats2.endings[e]) errs.push(`ending ${e} not reached in 3,600 simulated runs`);
    const neverSeen = content.cards.filter((c) => c.character === ch.id && !stats.cardsSeen[c.id] && !stats2.cardsSeen[c.id]).map((c) => c.id);
    for (const c of neverSeen) errs.push(`card ${c} never drawn in simulation`);
  }
  launch[ch.id] = { pass: hasDeck(ch.id) && errs.length === 0, errors: hasDeck(ch.id) ? errs : ['deck not written yet', ...errs] };
}

console.log('\nWAHALA CONTENT VALIDATION');
console.log('Shared deck:', JSON.stringify(report.shared.counts), report.shared.pass ? 'PASS' : 'FAIL');
for (const [id, v] of Object.entries(launch)) {
  const counts = JSON.stringify(report.characters[id].counts);
  console.log(`${v.pass ? 'PASS' : 'LOCK'}  ${id.padEnd(12)} ${counts}`);
  if (!v.pass) for (const e of v.errors.slice(0, 6)) console.log(`        - ${e}`);
}
if (warns.length) {
  console.log(`\n${warns.length} warnings:`);
  for (const w of warns) console.log(`  warn  ${w.where}: ${w.msg}`);
}
if (errors.length) {
  console.log(`\n${errors.length} errors:`);
  for (const e of errors) console.log(`  ERROR ${e.where}: ${e.msg}`);
}
writeFileSync(join(DATA_ROOT, 'launch-gate.json'), JSON.stringify(launch, null, 2) + '\n');

const playable = Object.values(launch).filter((v) => v.pass).length;
console.log(`\nLaunch gate: ${playable}/${content.characters.length} characters playable.`);
// Global (non-character) errors and the shared deck block the build; locked characters do not.
const blocking = errors.filter((e) => {
  const card = content.cards.find((c) => e.where === `card ${c.id}` || e.where.startsWith(`card ${c.id} `));
  if (card?.character) return false; // character errors lock that character instead
  return true;
});
if (blocking.length || !report.shared.pass || playable === 0) {
  console.log('VALIDATION FAILED');
  process.exit(1);
}
console.log('VALIDATION PASSED');
