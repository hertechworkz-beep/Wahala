// Renders PWA icons and the default Open Graph image with the pre-installed Chromium.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const icon = (size, pad) => `<html><body style="margin:0;width:${size}px;height:${size}px;background:#08090D;display:flex;align-items:center;justify-content:center;font-family:Arial Black,Arial,sans-serif">
<div style="width:${size - pad * 2}px;height:${size - pad * 2}px;border-radius:${(size - pad * 2) * 0.24}px;background:radial-gradient(circle at 30% 25%,#F43F5E,#7f1d3a 70%);display:flex;align-items:center;justify-content:center;flex-direction:column">
<div style="color:#fff;font-weight:900;font-size:${size * 0.5}px;line-height:1">W</div>
<div style="width:${size * 0.12}px;height:${size * 0.12}px;border-radius:50%;background:#F59E0B;margin-top:${size * 0.02}px"></div></div></body></html>`;

const og = `<html><body style="margin:0;width:1200px;height:630px;background:#08090D;font-family:Arial Black,Arial,sans-serif;color:#F5F1E8;position:relative;overflow:hidden">
<div style="position:absolute;inset:0;background:radial-gradient(60% 80% at 15% 20%,rgba(244,63,94,.55),transparent 60%),radial-gradient(50% 70% at 90% 90%,rgba(245,158,11,.45),transparent 60%)"></div>
<div style="position:absolute;left:80px;top:120px"><div style="font-size:150px;font-weight:900;letter-spacing:-6px">WAHA<span style="color:#F43F5E">LA</span><span style="color:#F59E0B">.</span></div>
<div style="font-size:34px;letter-spacing:10px;color:#ffffffaa;margin-top:10px">THE DATING SURVIVAL SIM</div>
<div style="font-size:44px;margin-top:50px">Date Chief Emeka for 7 days. <span style="color:#F43F5E">Survive the wahala.</span></div></div></body></html>`;

mkdirSync('public/icons', { recursive: true });
mkdirSync('public/og', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
for (const [name, size, pad] of [['icon-192', 192, 0], ['icon-512', 512, 0], ['icon-maskable-512', 512, 60]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(icon(size, pad));
  await page.screenshot({ path: `public/icons/${name}.png` });
}
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(og);
await page.screenshot({ path: 'public/og/default.png' });
await browser.close();
console.log('icons + og image written');
