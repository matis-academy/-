// Оптика и экспозиция полнокадровой камеры. Только формулы, без графики.
// Расстояния — в метрах, фокусное — в миллиметрах, выдержка — в секундах.

export const SENSOR = { w: 36, h: 24, coc: 0.03 };   // кадр 36×24 мм, допустимый кружок нерезкости 0,03 мм

// Ряды значений с шагом 1/3 ступени, как на камере
export const APERTURES = [1.4, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9, 10, 11, 13, 14, 16, 18, 20, 22];
export const SHUTTERS = [
  30, 25, 20, 15, 13, 10, 8, 6, 5, 4, 3.2, 2.5, 2, 1.6, 1.3, 1, 0.8, 0.6, 0.5, 0.4, 0.3,
  1 / 4, 1 / 5, 1 / 6, 1 / 8, 1 / 10, 1 / 13, 1 / 15, 1 / 20, 1 / 25, 1 / 30, 1 / 40, 1 / 50, 1 / 60, 1 / 80,
  1 / 100, 1 / 125, 1 / 160, 1 / 200, 1 / 250, 1 / 320, 1 / 400, 1 / 500, 1 / 640, 1 / 800, 1 / 1000,
  1 / 1250, 1 / 1600, 1 / 2000, 1 / 2500, 1 / 3200, 1 / 4000, 1 / 5000, 1 / 6400, 1 / 8000,
];
export const ISOS = [100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200,
  4000, 5000, 6400, 8000, 10000, 12800, 16000, 20000, 25600, 32000, 40000, 51200];
export const ECS = Array.from({ length: 31 }, (_, i) => Math.round((i - 15) / 3 * 100) / 100);  // −5…+5 EV
export const AUTO_ISO_MAX = 12800;

const log2 = Math.log2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Ближайшее значение ряда (сравнение в логарифмах — как ступени экспозиции)
export function nearest(list, v) {
  let best = list[0], bd = Infinity;
  for (const x of list) {
    const d = Math.abs(log2(x) - log2(v));
    if (d < bd) { bd = d; best = x; }
  }
  return best;
}

// Угол обзора, градусы
export const fovV = (f) => 2 * Math.atan(SENSOR.h / (2 * f)) * 180 / Math.PI;
export const fovH = (f) => 2 * Math.atan(SENSOR.w / (2 * f)) * 180 / Math.PI;
export const fovD = (f) => 2 * Math.atan(Math.hypot(SENSOR.w, SENSOR.h) / (2 * f)) * 180 / Math.PI;

// Диаметр кружка нерезкости на матрице (мм) для точки на расстоянии d при фокусе на s
export function cocMm(f, N, s, d) {
  const S = s * 1000, D = d * 1000;
  if (S <= f) return Infinity;
  return (f * f / (N * (S - f))) * Math.abs(D - S) / D;
}

// Гиперфокальное расстояние и границы ГРИП (м)
export function dof(f, N, s, c = SENSOR.coc) {
  const H = f * f / (N * c) + f;              // мм
  const S = s * 1000;
  const near = S * (H - f) / (H + S - 2 * f);
  const far = S < H ? S * (H - f) / (H - S) : Infinity;
  return { hyperfocal: H / 1000, near: near / 1000, far: far / 1000, total: far === Infinity ? Infinity : (far - near) / 1000 };
}

// Экспозиционное число настроек (EV при ISO 100) и отклонение кадра от нормы
export const settingsEV = (N, t) => log2(N * N / t);
export const isoShift = (iso) => log2(iso / 100);
// > 0 — кадр светлее нормы (пересвет), < 0 — темнее
export const exposureOffset = (sceneEV, N, t, iso) => sceneEV + isoShift(iso) - settingsEV(N, t);

// Смаз на матрице (мм): дрожание рук и движение объекта
export const SHAKE_RAD_PER_S = 0.03;   // при таком дрожании правило «выдержка 1/f» даёт смаз ровно 0,03 мм
export const shakeBlurMm = (f, t, stops = 0) => f * SHAKE_RAD_PER_S * t / 2 ** stops;
export const motionBlurMm = (f, speed, distance, t) => f * speed * t / distance;
export const safeShutter = (f, stops = 0) => 2 ** stops / f;

// Подбор экспозиции под режим камеры.
// st: { mode: 'AUTO'|'P'|'A'|'S'|'M', N, t, iso: number|'AUTO', ec }
// lens: { maxN, minN, f }
export function solveExposure(st, lens, sceneEV) {
  const mode = st.mode;
  const isoAuto = mode === 'AUTO' || st.iso === 'AUTO';
  const ec = mode === 'AUTO' ? 0 : st.ec;
  const avMin = log2(lens.maxN ** 2), avMax = log2(lens.minN ** 2);
  const tvMin = log2(1 / 30), tvMax = log2(8000);
  // авто-ISO держит выдержку не длиннее 1/f (настройка «Мин. выдержка»: медленнее — 1/(f/2), быстрее — 1/(2f))
  const tvHand = log2(lens.f * ({ slow: 0.5, fast: 2 }[st.autoMinSS] || 1));
  const isoMax = isoAuto ? log2(AUTO_ISO_MAX / 100) : 0;
  let isoS = isoAuto ? 0 : isoShift(st.iso);
  const need = () => sceneEV + isoS - ec;      // нужное av + tv
  let av, tv, warnN = false, warnT = false;

  if (mode === 'AUTO' || mode === 'P') {
    av = clamp(avMin + Math.max(0, need() - 10) * 0.5, avMin, Math.min(avMax, 8));
    tv = need() - av;
    if (isoAuto && tv < tvHand) { isoS = clamp(isoS + (tvHand - tv), 0, isoMax); tv = need() - av; }
    if (tv < tvMin) tv = tvMin;
    if (tv > tvMax) { av = clamp(need() - tvMax, avMin, avMax); tv = clamp(need() - av, tvMin, tvMax); }
  } else if (mode === 'A') {
    av = clamp(log2(st.N ** 2), avMin, avMax);
    tv = need() - av;
    if (isoAuto && tv < tvHand) { isoS = clamp(isoS + (tvHand - tv), 0, isoMax); tv = need() - av; }
    if (tv < tvMin || tv > tvMax) { warnT = true; tv = clamp(tv, tvMin, tvMax); }
  } else if (mode === 'S') {
    tv = log2(1 / st.t);
    av = need() - tv;
    if (isoAuto && av < avMin) { isoS = clamp(isoS + (avMin - av), 0, isoMax); av = need() - tv; }
    if (av < avMin || av > avMax) { warnN = true; av = clamp(av, avMin, avMax); }
  } else {                                       // M
    av = clamp(log2(st.N ** 2), avMin, avMax);
    tv = log2(1 / st.t);
    if (isoAuto) isoS = clamp(av + tv - sceneEV + ec, 0, isoMax);
  }

  const N = nearest(APERTURES.filter((x) => x >= lens.maxN - 1e-6 && x <= lens.minN + 1e-6), Math.sqrt(2 ** av));
  const t = nearest(SHUTTERS, 1 / 2 ** tv);
  const iso = nearest(ISOS, 100 * 2 ** isoS);
  const offset = exposureOffset(sceneEV, N, t, iso);
  // В P/A/S (и M с авто-ISO) камера сама держит экспозицию — мигаем, если не смогла
  if ((mode !== 'M' || isoAuto) && Math.abs(offset - ec) > 0.34) {
    if (mode === 'A' || mode === 'P' || mode === 'AUTO') warnT = true;
    if (mode === 'S') warnN = true;
  }
  return { N, t, iso, isoAuto, offset, ec, warnN, warnT };
}

// Цвет излучения чёрного тела (приближение Таннера Хелланда), линейный RGB, максимум = 1
export function kelvinRGB(K) {
  const t = clamp(K, 1000, 40000) / 100;
  let r, g, b;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const lin = (v) => { const c = clamp(v, 0, 255) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const out = [lin(r), lin(g), lin(b)];
  const m = Math.max(...out);
  return out.map((x) => x / m);
}
// Множители каналов для баланса белого K: свет с температурой K станет нейтральным.
// Опорная точка — дневной свет 5500 K (сцена отрисована «как есть» при 5500 K).
export function wbGains(K) {
  const ref = kelvinRGB(5500), k = kelvinRGB(K);
  const g = ref.map((x, i) => x / Math.max(k[i], 1e-3));
  return g.map((x) => x / g[1]);
}
// Авто-баланс белого: почти полностью нейтрализует основной свет сцены, оставляя немного атмосферы
export const awbKelvin = (lightK) => lightK + (5500 - lightK) * 0.12;

// Форматирование, как на экране камеры
export function fmtShutter(t) {
  if (t >= 0.3) return `${Math.round(t * 10) / 10}″`.replace('.', ',');
  return `1/${Math.round(1 / t)}`;
}
export const fmtF = (N) => `F${String(N).replace('.', ',')}`;
export const fmtEV = (v) => `${v > 0.005 ? '+' : v < -0.005 ? '−' : '±'}${Math.abs(v).toFixed(1).replace('.', ',')}`;
export function fmtDist(m) {
  if (!isFinite(m)) return '∞';
  if (m < 1) return `${Math.round(m * 100)} см`;
  if (m < 10) return `${(Math.round(m * 10) / 10).toString().replace('.', ',')} м`;
  return `${Math.round(m)} м`;
}
