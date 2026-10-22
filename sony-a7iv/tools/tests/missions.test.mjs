// Автотест в браузере (Playwright). Запуск: python3 -m http.server 8765 в корне репозитория, затем
// node missions.test.mjs <папка-для-скриншотов>
import { chromium } from 'playwright';
import fs from 'node:fs';
const out = process.argv[2];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
await page.addInitScript(() => { window.__simFast = true; });
await page.goto('http://127.0.0.1:8765/sony-a7iv/shoot/?notour'); await page.waitForTimeout(5000);
const run = async (id, st, waitRunner, save) => {
  await page.evaluate((id) => __sim.startMission(id), id); await page.waitForTimeout(2000);
  await page.evaluate((st) => { Object.assign(__sim.S, st); __sim.acquireFocus(true); }, st);
  await page.waitForTimeout(2500);
  if (waitRunner) await page.waitForFunction(() => { const m = __sim.SC.movers[0]; const v = m.anchor().project(__sim.camera); return Math.abs(v.x) < 0.25 && v.z < 1; }, null, { timeout: 60000, polling: 50 }).catch(() => {});
  const n = await page.evaluate(() => __sim.shots.length);
  await page.evaluate(() => __sim.shoot());
  await page.waitForFunction((n) => __sim.shots.length > n, n, { timeout: 300000 }).catch(() => {});
  const r = await page.evaluate(() => { const s = __sim.shots[0]; return (s.mission.pass ? 'PASS ' : 'fail ') + s.mission.results.map(r => (r.ok ? '+' : '-') + r.text).join(' | ') + ' [' + s.st.mode + ' F' + s.res.N + ' t' + s.res.t.toFixed(4) + ']'; });
  console.log(id, JSON.stringify(st), r);
  if (save) fs.writeFileSync(out + '/' + save, Buffer.from((await page.evaluate(() => __sim.shots[0].url)).split(',')[1], 'base64'));
};
await run('freeze', {}, true);
await run('bokeh', { lensId: '85', f: 85, mode: 'A', N: 1.8, dist: 2.5, ec: 0.7 });
await run('backlight', { ec: 1 });
await run('hyperfocal', { lensId: '1635', f: 16, N: 8, fm: 'MF', mfDist: 2 });
await run('freeze', { mode: 'S', t: 1/2000, fm: 'AF-C', area: 'wide' }, true);
await run('pan', { mode: 'S', t: 1/60, pan: true });
await run('sunny16', { mode: 'M', iso: 100, N: 16, t: 1/125 });
await run('nightportrait', { lensId: '50', f: 50, N: 1.8, iso: 'AUTO', steady: true });
await run('wb', { wb: 'tungsten' });
await run('wb', { wb: 'c1' });
await run('wb', { wb: 'AWBa' });
await run('freeze', { mode: 'S', t: 1/2000, fm: 'AF-A', area: 'wide' }, true);
console.log(errs.join('\n') || 'no errors');
await browser.close();
