// Plays Chief's first date end to end in a phone viewport, screenshots every step and records
// a video of the whole night. Usage: npm run build && node scripts/date-e2e.mjs
// Env: OUT (folder), REACT=hide|stay|hand|face, GENDER=woman|man, DEV=1 (use the dev server)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, readdirSync, renameSync } from 'node:fs';

const OUT = process.env.OUT || 'screenshots/first-date';
const PORT = 4174;
const REACT = process.env.REACT || 'hide';
const GENDER = process.env.GENDER || 'woman';
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const server = spawn('npx', process.env.DEV ? ['vite', '--port', String(PORT), '--strictPort'] : ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((r) => setTimeout(r, process.env.DEV ? 4000 : 2500));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, recordVideo: { dir: `${OUT}/video`, size: { width: 390, height: 844 } } });
const page = await ctx.newPage();
page.setDefaultTimeout(10000);
const errors = [];
page.on('pageerror', (e) => (errors.push(String(e)), console.log('PAGEERROR', e.stack ?? String(e))));
page.on('console', (m) => m.type() === 'error' && !/fonts|Failed to load resource/.test(m.text()) && errors.push(m.text()));

let n = 0;
const shot = async (name) => {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${String(++n).padStart(2, '0')}-${name}.png` });
};
const act = (id) => { const l = page.locator(`[data-act="${id}"]`); return { click: (o = {}) => l.click({ force: true, ...o }), count: () => l.count() }; };
const tapCaption = async () => page.mouse.click(195, 790);
async function until(sel, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.locator(sel).count()) return true;
    await tapCaption();
    await page.waitForTimeout(450);
  }
  throw new Error(`timed out waiting for ${sel}`);
}
const step = () => page.locator('[data-step]').getAttribute('data-step');

try {
  await page.goto(`http://localhost:${PORT}/`);
  await page.getByText('Start dating').click();
  await page.getByText("Yes, I'm 18+").click();
  await page.getByLabel('Display name').fill(GENDER === 'woman' ? 'Adaeze_O' : 'Tunde_K');
  if (GENDER === 'man') await page.getByText('Man', { exact: true }).first().click();
  await page.getByLabel('Skin tone s7').click();
  if (GENDER === 'woman') {
    await page.getByText('Curvy / Thick').click();
    await page.getByText('Knotless Braids').click();
  } else {
    await page.getByText('Big Daddy').click();
    await page.getByText('Waves').click();
  }
  await page.getByText('Looking good').click();
  await page.getByText('Men', { exact: true }).click();
  await page.getByText('Next', { exact: true }).click();
  await page.getByText(GENDER === 'woman' ? 'Lovergirl' : 'Loverboy', { exact: true }).click();
  await page.getByText('Secure the Bag').click();
  await page.getByText('Pick your date').click();
  await page.waitForTimeout(500);
  await page.getByLabel('Date').click();
  await page.waitForTimeout(700);
  await page.getByText('Day 1 →').click();
  await page.waitForTimeout(1500);
  await page.locator('[data-skip-cold]').click();

  // 1. Getting ready
  await page.waitForSelector('[data-step="getting_ready"]');
  await shot('dressup-start');
  const outfit = GENDER === 'woman' ? 'w_red_bodycon' : 'm_agbada';
  await page.locator(`[data-item="${outfit}"]`).click();
  await shot('dressup-outfit');
  await page.locator('[data-tab="hair"]').click();
  await page.locator(`[data-item="${GENDER === 'woman' ? 'h_gele' : 'h_cap'}"]`).click();
  await shot('dressup-hair');
  await page.waitForSelector('[data-act="answer"]');
  await shot('bestie-ringing');
  await act('answer').click();
  await until('[data-act="call-checkin"]');
  await act('call-checkin').click();
  await page.waitForTimeout(6000);
  await page.locator('[data-tab="shoes"]').click();
  await page.locator(`[data-item="${GENDER === 'woman' ? 's_heels' : 's_loafers'}"]`).click();
  await page.locator('[data-tab="jewellery"]').click();
  await page.locator('[data-item="j_coral"]').click();
  await page.locator('[data-tab="bag"]').click();
  await page.locator('[data-item="b_designer"]').click().catch(() => {});
  await page.locator('[data-tab="perfume"]').click();
  await page.locator('[data-item="p_oud"]').click();
  await shot('dressup-done');
  await act('leave').click();

  // 2. Ride
  await page.waitForSelector('[data-step="the_ride"]');
  await page.waitForTimeout(1500);
  await shot('ride');
  await until('[data-phone]');
  await shot('ride-text');
  await act('keep-phone').click();
  await shot('ride-result');
  await act('arrive').click();

  // 3. Seat
  await page.waitForSelector('[data-step="choose_table"]');
  await shot('floorplan');
  await act('seat-window').click();
  await page.waitForTimeout(2200);
  await shot('seated');
  await act('wait').click();

  // 4. Arrival
  await page.waitForTimeout(2600);
  await shot('chief-walks-in');
  await until('[data-act="sit"]');
  await shot('chief-reacts');
  await act('sit').click();

  // 5. Talk
  await until('[data-act="talk-honest"]');
  await shot('talk-choose');
  if (await page.locator('[data-spot="rolex"]').count()) {
    await page.locator('[data-spot="rolex"]').click();
    await page.waitForTimeout(1200);
    await shot('rolex-snap');
  }
  await act('talk-honest').click();
  await until('[data-step="first_talk"] [data-act="continue"]');
  await shot('talk-result');
  await act('continue').click();

  // 6. Toast
  await until('[data-act="clink"]');
  await shot('toast-aim');
  await act('clink').click();
  await shot('toast-result');
  await act('continue').click();

  // 7. Glance
  await page.waitForSelector('[data-step="phone_glance"]');
  await page.waitForTimeout(1300);
  await shot('glance');
  await act('read').click();
  await shot('glance-read');
  await act('continue').click();

  // 8. Briefcase
  await until('[data-act="latch-0"]');
  await shot('briefcase-closed');
  await act('latch-0').click();
  await act('latch-1').click();
  await page.waitForTimeout(400);
  const clue = page.locator('[data-clue]').first();
  if (await clue.count()) await clue.click();
  else {
    await act('next-page').click();
    await page.locator('[data-clue]').first().click();
  }
  await shot('briefcase-open');
  await act('close-case').click();
  await page.waitForTimeout(800);
  await shot('briefcase-result');
  await until('[data-step="briefcase"] [data-act="continue"]');
  await act('continue').click();

  // 9. Photo
  await until('[data-act="open-photo"]');
  await shot('photo-buzz');
  await act('open-photo').click();
  await act('zoom').click();
  await page.waitForTimeout(900);
  await shot('photo-zoom');
  await act('photo-forward').click();
  await until('[data-step="unknown_photo"] [data-act="continue"]');
  await shot('photo-result');
  await act('continue').click();

  // 10. Wife escape
  await page.waitForSelector('[data-step="wife_escape"]');
  await page.waitForTimeout(1600);
  await shot('escape-enter');
  await act(`react-${REACT}`).click();
  if (REACT === 'hide') {
    // Head for the restroom, then try the long way round to the kitchen.
    for (let i = 0; i < 14; i++) {
      if (await page.locator('[data-step="wife_escape"] [data-act="continue"]').count()) break;
      const nodes = await page.locator('[data-node]').evaluateAll((els) => els.map((e) => e.getAttribute('data-node')));
      const pref = ['kitchen', 'band', 'plant', 'restroom', 'bar', 'centre', 'booth', 'aisle', 'window'].find((x) => nodes.includes(x));
      if (i === 1) await shot('escape-hunt');
      if (pref) await page.locator(`[data-node="${pref}"]`).click({ force: true });
      await page.waitForTimeout(900);
    }
  }
  await until('[data-step="wife_escape"] [data-act="continue"]', 30000);
  await shot('escape-outcome');
  await act('continue').click();

  // 11. Ride home + envelope
  await until('[data-act="envelope"]');
  await shot('outro');
  await act('envelope').click();
  await page.waitForTimeout(1700);
  await shot('envelope');
  await act('recap').click();
  await page.waitForTimeout(600);
  await shot('recap');
  await page.evaluate(() => document.querySelector('.overflow-y-auto')?.scrollTo(0, 99999));
  await shot('recap-bottom');
  await act('go-home').click();
  await page.waitForTimeout(1200);
  await shot('after-date');
  console.log('final step attr:', await page.locator('[data-step]').count());
} catch (e) {
  console.log('E2E FAILED:', e.message);
  await shot('failure');
  errors.push(e.message);
} finally {
  await ctx.close();
  await browser.close();
  server.kill();
  for (const f of readdirSync(`${OUT}/video`)) renameSync(`${OUT}/video/${f}`, `${OUT}/video/first-date-${REACT}.webm`);
  console.log(errors.length ? `ERRORS (${errors.length}):\n${errors.join('\n')}` : 'No page errors.');
  process.exit(errors.length ? 1 : 0);
}
