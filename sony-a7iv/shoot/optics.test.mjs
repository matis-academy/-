// Проверка формул: node --test sony-a7iv/shoot/optics.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as O from './optics.js';

const near = (a, b, eps) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b} (±${eps})`);

test('угол обзора: 50 мм ≈ 39,6° по горизонтали, 46,8° по диагонали', () => {
  near(O.fovH(50), 39.6, 0.1);
  near(O.fovD(50), 46.8, 0.1);
  near(O.fovH(28), 65.5, 0.1);
});

test('ГРИП: 50 мм F8 с фокусом на 5 м', () => {
  const d = O.dof(50, 8, 5);
  near(d.hyperfocal, 10.47, 0.02);
  near(d.near, 3.39, 0.02);
  near(d.far, 9.5, 0.06);
});

test('ГРИП: фокус дальше гиперфокального — резко до бесконечности', () => {
  const d = O.dof(28, 11, 5);
  assert.equal(d.far, Infinity);
});

test('кружок нерезкости: в плоскости фокуса 0, фон на бесконечности = f²/(N(s−f))', () => {
  assert.equal(O.cocMm(85, 1.8, 3, 3), 0);
  near(O.cocMm(85, 1.8, 3, 1e9), 85 * 85 / (1.8 * (3000 - 85)), 1e-4);
  // на границе ГРИП кружок равен допустимому
  const d = O.dof(85, 4, 3);
  near(O.cocMm(85, 4, 3, d.far), O.SENSOR.coc, 1e-4);
  near(O.cocMm(85, 4, 3, d.near), O.SENSOR.coc, 1e-4);
});

test('экспозиция: «солнечные 16» — F16, 1/100, ISO 100 при EV 15', () => {
  near(O.exposureOffset(15, 16, 1 / 100, 100), 0, 0.4);
  // +1 ступень ISO = +1 EV к яркости
  near(O.exposureOffset(15, 16, 1 / 100, 200) - O.exposureOffset(15, 16, 1 / 100, 100), 1, 1e-9);
});

test('режим A держит экспозицию и показывает предупреждение при нехватке выдержки', () => {
  const lens = { maxN: 1.8, minN: 22, f: 85 };
  const r = O.solveExposure({ mode: 'A', N: 2.8, t: 1 / 100, iso: 100, ec: 0 }, lens, 12);
  near(r.offset, 0, 0.34);
  assert.equal(r.N, 2.8);
  const bright = O.solveExposure({ mode: 'A', N: 1.8, t: 1 / 100, iso: 3200, ec: 0 }, lens, 16);
  assert.equal(bright.t, 1 / 8000);
  assert.ok(bright.warnT);
});

test('авто-ISO в режиме A не даёт выдержке стать длиннее 1/f', () => {
  const lens = { maxN: 1.8, minN: 22, f: 85 };
  const r = O.solveExposure({ mode: 'A', N: 8, t: 1 / 100, iso: 'AUTO', ec: 0 }, lens, 8);
  assert.ok(r.t <= 1 / 80 + 1e-9, `t = ${r.t}`);
  assert.ok(r.iso > 100);
  near(r.offset, 0, 0.34);
});

test('режим S и M: S подбирает диафрагму, M показывает отклонение', () => {
  const lens = { maxN: 3.5, minN: 22, f: 28 };
  const s = O.solveExposure({ mode: 'S', N: 8, t: 1 / 250, iso: 100, ec: 0 }, lens, 13);
  near(s.offset, 0, 0.34);
  const m = O.solveExposure({ mode: 'M', N: 8, t: 1 / 250, iso: 100, ec: 0 }, lens, 13);
  near(m.offset, 13 - O.settingsEV(8, 1 / 250), 1e-9);
});

test('смаз: правило 1/f даёт 0,03 мм, стабилизатор уменьшает в 2^ступеней раз', () => {
  near(O.shakeBlurMm(50, 1 / 50), 0.03, 1e-9);
  near(O.shakeBlurMm(50, 1 / 50, 5), 0.03 / 32, 1e-9);
});

test('форматирование значений', () => {
  assert.equal(O.fmtShutter(1 / 250), '1/250');
  assert.equal(O.fmtShutter(0.5), '0,5″');
  assert.equal(O.fmtF(1.8), 'F1,8');
  assert.equal(O.fmtEV(-0.33), '−0,3');
  assert.equal(O.fmtDist(0.45), '45 см');
});

test('цветовая температура: 3200 K теплее (краснее) 5500 K, 8000 K холоднее', () => {
  const warm = O.kelvinRGB(3200), day = O.kelvinRGB(5500), cool = O.kelvinRGB(8000);
  assert.ok(warm[2] / warm[0] < day[2] / day[0]);
  assert.ok(cool[2] / cool[0] > day[2] / day[0]);
});

test('баланс белого: свет лампы × множители «Лампа 3200 K» = нейтральный', () => {
  const light = O.kelvinRGB(3200), ref = O.kelvinRGB(5500), g = O.wbGains(3200);
  const out = light.map((x, i) => x * g[i] / ref[i]);
  near(out[0] / out[1], 1, 1e-6);
  near(out[2] / out[1], 1, 1e-6);
  const d = O.wbGains(5500);
  near(d[0], 1, 1e-9); near(d[2], 1, 1e-9);
});

test('авто-ISO: «медленнее» допускает выдержку 1/(f/2)', () => {
  const lens = { maxN: 1.8, minN: 22, f: 50 };
  const std = O.solveExposure({ mode: 'A', N: 8, t: 1 / 100, iso: 'AUTO', ec: 0 }, lens, 6);
  const slow = O.solveExposure({ mode: 'A', N: 8, t: 1 / 100, iso: 'AUTO', ec: 0, autoMinSS: 'slow' }, lens, 6);
  assert.ok(slow.t > std.t, `${slow.t} > ${std.t}`);
  assert.ok(slow.iso < std.iso);
});
