// End-to-end acceptance run: plays a full Chief Emeka run in a phone viewport against the
// production build and screenshots every stage (Immersion requirement 9).
// Usage: npm run build && npm run shots   (writes screenshots/chief-run/*.png)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';

const OUT = process.env.OUT || 'screenshots/chief-run';
const PORT = 4173;
const VIBE = process.env.VIBE || 'Lovergirl';
const PICK = process.env.PICK || 'first'; // first | last | random
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const server = spawn('npx', process.env.DEV ? ['vite', '--port', String(PORT), '--strictPort'] : ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((r) => setTimeout(r, process.env.DEV ? 4000 : 2500));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
page.setDefaultTimeout(8000);
const errors = [];
page.on('pageerror', (e) => (errors.push(String(e)), console.log('PAGEERROR', e.stack ?? String(e))));
page.on('console', (m) => m.type() === 'error' && !/fonts|Failed to load resource/.test(m.text()) && errors.push(m.text()));

let n = 0;
const shot = async (name) => {
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${OUT}/${String(++n).padStart(2, '0')}-${name}.png` });
};

try {
  await page.goto(`http://localhost:${PORT}/`);
  await shot('home');
  await page.getByText('Start dating').click();
  await shot('age-gate');
  await page.getByText("Yes, I'm 18+").click();
  await page.getByLabel('Display name').fill('Adaeze_O');
  await page.getByLabel('Skin tone s9').click();
  await page.getByText('Curvy / Thick').click();
  await page.getByText('30-inch Bone Straight').click();
  await shot('avatar');
  await page.getByText('Looking good').click();
  await page.getByText('Men', { exact: true }).click();
  await page.getByText('Next', { exact: true }).click();
  await page.getByText(VIBE, { exact: true }).click();
  await page.getByText('Secure the Bag').click();
  await shot('vibe-goal');
  await page.getByText('Pick your date').click();
  await page.waitForTimeout(500);
  await shot('roster');
  await page.getByLabel('Date').click();
  await page.waitForTimeout(700);
  await shot('match');
  await page.getByText('Day 1 →').click();
  await page.waitForTimeout(5500);
  await shot('cold-open-a');
  await page.waitForTimeout(5000);
  await shot('cold-open-b');
  await page.locator('[data-skip-cold]').click();

  let shots = 0;
  let openedPhone = false;
  for (let step = 0; step < 120; step++) {
    await page.waitForTimeout(300);
    if (await page.locator('[data-verdict]').count()) {
      await page.waitForTimeout(600);
      await shot('ending');
      await page.locator('[data-verdict]').click();
      break;
    }
    if (await page.locator('[data-let-end]').count()) {
      await shot('bailout');
      await page.locator('[data-let-end]').click();
      continue;
    }
    if (await page.locator('[data-sleep]').count()) {
      if (!openedPhone) {
        openedPhone = true;
        await shot('night');
        await page.getByText('📱 City spots').click();
        await page.waitForTimeout(500);
        await shot('phone-home');
        await page.getByText('Bestie', { exact: true }).click();
        await page.waitForTimeout(300);
        await page.getByText('Vent for an hour').click();
        await page.waitForTimeout(600);
        await shot('spot-bestie');
        await page.getByText('Done').click();
        await page.getByLabel('Close phone').click();
      }
      await page.locator('[data-sleep]').click();
      continue;
    }
    if (await page.locator('[data-answer]').count()) {
      await shot('incoming-call');
      await page.locator('[data-answer]').click();
      continue;
    }
    if (await page.getByLabel('Play voice note').count()) {
      await shot('voice-note');
      await page.getByLabel('Play voice note').click();
      await page.waitForTimeout(1200);
      continue;
    }
    const choices = page.locator('[data-choice]:not([disabled])');
    if (await choices.count()) {
      if (shots < 14) await shot(`card-${++shots}`);
      const k = await choices.count();
      const idx = PICK === 'last' ? k - 1 : PICK === 'random' ? Math.floor(Math.random() * k) : 0;
      await choices.nth(idx).click();
      await page.waitForTimeout(1500);
      if (shots <= 8) await shot(`outcome-${shots}`);
      continue;
    }
    if (await page.locator('[data-next]').count()) {
      await page.locator('[data-next]').click();
      continue;
    }
    // Mid-typing: tap to skip.
    await page.mouse.click(195, 700);
  }

  await page.waitForTimeout(1500);
  await shot('verdict-card');
  await page.getByRole('button', { name: 'Wahala Receipts' }).click();
  await page.waitForTimeout(800);
  await shot('receipts');
  await page.evaluate(() => document.querySelector('.overflow-y-auto')?.scrollTo(0, 99999));
  await page.waitForTimeout(500);
  await shot('verdict-bottom');

  // Share link landing page.
  const url = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('wahala.run.v1') || 'null');
    return raw ? 'ok' : 'none';
  });
  console.log('saved run:', url);
  await page.goto(`http://localhost:${PORT}/advertise`);
  await shot('advertise');

  // Under-18 path: no names, numbers or emails may be collected.
  const kid = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  await kid.goto(`http://localhost:${PORT}/play`);
  await kid.getByText('No', { exact: true }).click();
  await kid.waitForTimeout(500);
  const inputs = await kid.locator('input, textarea, form').count();
  if (inputs) throw new Error(`under-18 screen has ${inputs} input fields`);
  await kid.screenshot({ path: `${OUT}/${String(++n).padStart(2, '0')}-under-18.png` });
  console.log('under-18 path: no inputs');
} catch (e) {
  console.error('E2E FAILED:', e);
  await shot('failure');
  process.exitCode = 1;
} finally {
  console.log(errors.length ? `Page errors:\n${errors.join('\n')}` : 'No page errors.');
  if (errors.length) process.exitCode = 1;
  await browser.close();
  server.kill();
}
process.exit(process.exitCode ?? 0);
