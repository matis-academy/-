// Автотест в браузере (Playwright). Запуск: python3 -m http.server 8765 в корне репозитория, затем
// node menu.test.mjs <папка-для-скриншотов>
import { chromium, devices } from 'playwright';
const out = process.argv[2];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errs = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', x => { if (x.type() === 'error') errs.push(x.text()); });
await page.addInitScript(() => { window.__simFast = true; });
await page.goto('http://127.0.0.1:8765/sony-a7iv/shoot/?notour'); await page.waitForTimeout(5000);
const S = () => page.evaluate(() => ({ ...__sim.S }));
await page.click('#bMenu'); await page.waitForTimeout(400);
await page.locator('#vfWrap').screenshot({ path: out + '/m-menu1.png' });
// exp tab -> group 5 (Баланс белого) -> item 0 -> pick "Лампа накал."
await page.click('.mn-tabs button[data-tab="1"]');
await page.click('.mn-groups button[data-group="4"]');
await page.click('.mn-row[data-row="0"]'); await page.waitForTimeout(200);
await page.locator('#vfWrap').screenshot({ path: out + '/m-opts.png' });
await page.click('.mn-row:has-text("Лампа накал.")'); await page.waitForTimeout(300);
console.log('wb', (await S()).wb);
await page.click('.mn-row[data-row="0"]'); await page.click('.mn-row:has-text("Цв.тмп./Ф-тр.")'); await page.waitForTimeout(200);
console.log('rows after K:', await page.$$eval('.mn-row', (b) => b.map((x) => x.textContent.trim()).slice(0, 4)));
// keyboard: go to af tab via tabs column
await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
for (let i = 0; i < 1; i++) await page.keyboard.press('ArrowDown');
await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
console.log('fm after keys:', (await S()).fm, 'head:', await page.$eval('.mn-head', (e) => e.textContent));
// drive bracket via menu
await page.click('.mn-tabs button[data-tab="0"]'); await page.click('.mn-groups button[data-group="5"]');
await page.click('.mn-row[data-row="0"]'); await page.click('.mn-row:has-text("Непрер. брекет.")'); await page.waitForTimeout(200);
console.log('drive', (await S()).drive);
await page.locator('#vfWrap').screenshot({ path: out + '/m-drive.png' });
// star to my menu
await page.click('.mn-row[data-row="0"]'); await page.keyboard.press('Escape');
await page.click('.mn-star'); await page.waitForTimeout(100);
await page.click('.mn-tabs button[data-tab="6"]'); await page.waitForTimeout(200);
await page.locator('#vfWrap').screenshot({ path: out + '/m-my.png' });
console.log('my groups:', await page.$$eval('.mn-groups button', (b) => b.map((x) => x.textContent)));
// movie-only row
await page.click('.mn-tabs button[data-tab="0"]'); await page.click('.mn-groups button[data-group="7"]'); await page.click('.mn-row[data-row="0"]'); await page.waitForTimeout(150);
console.log('movie note:', await page.$eval('.mn-info p', (e) => e.textContent.slice(0, 80)));
// Fn editor
await page.click('.mn-tabs button[data-tab="5"]'); await page.click('.mn-groups button[data-group="2"]');
await page.click('.mn-row:has-text("Настройки меню Fn")'); await page.waitForTimeout(150);
await page.locator('#vfWrap').screenshot({ path: out + '/m-fnedit.png' });
await page.click('#bMenu');
await page.click('#bFn'); await page.waitForTimeout(300);
await page.locator('#vfWrap').screenshot({ path: out + '/m-fn.png' });
await page.click('.fn-tile[data-fn="0"]'); await page.click('.fn-list button:has-text("Непрерывн. AF")'); await page.waitForTimeout(200);
console.log('fm via Fn', (await S()).fm);
await page.click('#bFn');
// bracket shoot
await page.keyboard.press('Space'); await page.waitForTimeout(12000);
console.log('shots after bracket:', await page.evaluate(() => __sim.shots.map((s) => [s.tag, s.res.t, s.st.ec])));
// aspect + grid + zebra + peaking + level
await page.evaluate(() => { const s = __sim.setKey; s('aspect', '16:9'); s('zebraOn', true); s('zebraLvl', 70); s('peakOn', true); s('peakColor', 'blue'); s('disp', 'level'); s('focusColor', 'red'); s('area', 'spotS'); });
await page.waitForTimeout(2500);
await page.locator('#vfWrap').screenshot({ path: out + '/m-vf.png' });
await page.evaluate(() => { __sim.setKey('drive', 'single'); __sim.setKey('review', 2); });
await page.keyboard.press('Space'); await page.waitForTimeout(5000);
const img = await page.evaluate(() => new Promise((r) => { const i = new Image(); i.onload = () => r([i.width, i.height]); i.src = __sim.shots[0].url; }));
console.log('16:9 shot size', img, 'review visible', await page.evaluate(() => !document.getElementById('vfReview').hidden));
// factory reset
await page.click('#bMenu'); await page.click('.mn-tabs button[data-tab="5"]'); await page.click('.mn-groups button[data-group="1"]');
await page.click('.mn-row[data-row="0"]'); await page.click('.mn-row[data-row="0"]'); await page.locator('#vfWrap').screenshot({ path: out + '/m-confirm.png' });
await page.click('.mn-row:has-text("Ввод")'); await page.waitForTimeout(500);
const s2 = await S(); console.log('after reset', s2.drive, s2.aspect, s2.wb, 'menu hidden', await page.$eval('#camMenu', (e) => e.hidden));
// mobile
const m = await browser.newPage({ ...devices['iPhone 13'] });
m.on('pageerror', e => errs.push('m pageerror: ' + e.message));
await m.addInitScript(() => { window.__simFast = true; });
await m.goto('http://127.0.0.1:8765/sony-a7iv/shoot/?notour'); await m.waitForTimeout(5000);
await m.tap('#bMenu'); await m.waitForTimeout(400);
await m.screenshot({ path: out + '/m-mob1.png' });
await m.tap('.mn-tabs button[data-tab="2"]'); await m.tap('.mn-groups button[data-group="1"]'); await m.tap('.mn-row[data-row="0"]'); await m.waitForTimeout(300);
await m.screenshot({ path: out + '/m-mob2.png' });
console.log('mobile overflow', await m.evaluate(() => [document.documentElement.scrollWidth, innerWidth]));
console.log(errs.join('\n') || 'no errors');
await browser.close();
