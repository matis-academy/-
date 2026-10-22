// Автотест в браузере (Playwright). Запуск: python3 -m http.server 8765 в корне репозитория, затем
// node hover.test.mjs <папка-для-скриншотов>
import { chromium, devices } from 'playwright';
const out = process.argv[2];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errs = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', x => { if (x.type() === 'error') errs.push(x.text()); });
await page.goto('http://127.0.0.1:8765/sony-a7iv/shoot/?notour'); await page.waitForTimeout(4000);
await page.click('#bMenu'); await page.click('.mn-tabs button[data-tab="1"]'); await page.click('.mn-groups button[data-group="2"]');
await page.hover('.mn-row[data-row="0"]'); await page.waitForTimeout(150);
await page.locator('#vfWrap').screenshot({ path: out + '/h1.png' });
console.log('hover0:', (await page.$eval('.mn-info h4', e => e.textContent)));
await page.hover('.mn-row[data-row="2"]'); await page.waitForTimeout(150);
console.log('hover2:', (await page.$eval('.mn-info h4', e => e.textContent)));
await page.click('.mn-row[data-row="0"]'); await page.hover('.mn-row[data-row="2"]'); await page.waitForTimeout(150);
await page.locator('#vfWrap').screenshot({ path: out + '/h2.png' });
await page.click('#bMenu'); await page.click('#bFn'); await page.hover('.fn-tile[data-fn="6"]'); await page.waitForTimeout(150);
console.log('fn hover:', (await page.$eval('.fn-panel .menu-help', e => e.textContent.slice(0, 60))));
await page.click('#bFn');
const m = await browser.newPage({ ...devices['iPhone 13'] });
m.on('pageerror', e => errs.push('m pageerror: ' + e.message));
await m.goto('http://127.0.0.1:8765/sony-a7iv/shoot/?notour'); await m.waitForTimeout(4000);
await m.tap('#bMenu'); await m.tap('.mn-tabs button[data-tab="1"]'); await m.tap('.mn-groups button[data-group="4"]'); await m.tap('.mn-row[data-row="0"]'); await m.waitForTimeout(300);
await m.screenshot({ path: out + '/h-mob.png' });
console.log(errs.join('\n') || 'no errors');
await browser.close();
