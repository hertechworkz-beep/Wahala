// Deliberate-play check: how many of 40 seeds reach Locked In, per vibe, for a character.
// Usage: npx tsx scripts/reach.ts chief_emeka   (target: >= 20/40 for every vibe)
import { loadCity } from '../src/content/node';
import { lockedInReach } from '../src/engine/sim';
import type { VibeId } from '../src/engine/types';

const content = loadCity('lagos', { withGenerated: false });
const ids = process.argv.slice(2).length ? process.argv.slice(2) : content.characters.filter((c) => content.cards.some((x) => x.character === c.id)).map((c) => c.id);
let fail = false;
for (const id of ids) {
  const row = content.vibes.map((v) => [v.id, lockedInReach(content, id, v.id as VibeId)] as const);
  const ok = row.every(([, n]) => n >= 20);
  if (!ok) fail = true;
  console.log(`${ok ? 'OK  ' : 'LOW '} ${id.padEnd(14)} ${row.map(([v, n]) => `${v} ${n}/40`).join('  ')}`);
}
process.exit(fail ? 1 : 0);
