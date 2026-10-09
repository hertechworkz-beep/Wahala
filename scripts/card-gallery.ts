// Renders the Verdict Card for every ending through the real share-link page (/v/<payload>)
// and checks the card fits its 9:16 frame (footer + QR visible). Needs `npm run build` first.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { loadCity } from '../src/content/node';
import { createRun } from '../src/engine/engine';
import { buildVerdict } from '../src/engine/verdict';
import type { EndingId } from '../src/engine/types';
import { toCard } from '../src/ui/verdict/payload';

const content = loadCity();
const ENDINGS: EndingId[] = ['locked_in', 'counter_con', 'survived', 'scandal', 'sapa', 'breakdown', 'ghosted', 'fumbled', 'obsession', 'walked_away'];
const OUT = 'screenshots/verdicts';
mkdirSync(OUT, { recursive: true });

function payloadFor(e: EndingId, i: number): string {
  const truth = e === 'fumbled' ? 'divorced' : e === 'obsession' || e === 'counter_con' ? 'serial_sponsor' : 'broke';
  const s = createRun(content, { name: 'Lekki Baddie', gender: 'woman', datePref: 'men', vibe: (['lover', 'sugar', 'bigboy', 'runs', 'corporate'] as const)[i % 5], goal: (['bag', 'love', 'ring', 'revenge'] as const)[i % 4], avatar: { set: 'woman', build: 'Curvy / Thick', hair: 'Knotless Braids', style: 'Designer Glam' } }, 'chief_emeka', 1000 + i, { force: { truth } });
  s.status = 'ended';
  s.ending = e;
  s.endedDay = e === 'sapa' ? 4 : 7;
  s.redFlagsMissed = 3;
  const card = toCard(buildVerdict(content, s));
  return Buffer.from(JSON.stringify(card), 'utf8').toString('base64url');
}

const server = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { stdio: 'pipe' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
let bad = 0;
for (const [i, e] of ENDINGS.entries()) {
  await page.goto(`http://localhost:4174/v/${payloadFor(e, i)}`);
  await page.waitForTimeout(900);
  const fit = await page.evaluate(() => {
    const qr = document.querySelector('img[src^="data:image/png"]');
    const card = qr?.closest('.relative.overflow-hidden') as HTMLElement | null;
    if (!qr || !card) return { ok: false, why: 'no qr/card' };
    const a = qr.getBoundingClientRect();
    const b = card.getBoundingClientRect();
    return { ok: a.bottom <= b.bottom + 0.5 && a.top >= b.top, why: `qr ${Math.round(a.bottom)} card ${Math.round(b.bottom)}` };
  });
  if (!fit.ok) bad++;
  console.log(`${fit.ok ? 'OK  ' : 'FAIL'} ${e.padEnd(12)} ${fit.why}`);
  await page.screenshot({ path: `${OUT}/${String(i + 1).padStart(2, '0')}-${e}.png` });
}
await browser.close();
server.kill();
process.exit(bad ? 1 : 0);
