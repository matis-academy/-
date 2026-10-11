/*!
 * Matis.Academy — симулятор приложения Blackmagic Camera 3.5 (iPhone 15 Pro Max)
 * Учебный тренажёр, не связан с Blackmagic Design и не является официальным продуктом.
 *
 * Встраивание в урок (Bricks, ml-lesson): пустой Block с атрибутом data-ml-widget="bmcamera"
 * или класс ml-bmcamera-sim. Вручную: MLBMCameraSim.mount(element).
 * Без зависимостей, стили добавляются скриптом.
 *
 * Как устроено:
 *  - интерфейс приложения свёрстан в точках экрана iPhone 15 Pro Max (932×430, горизонтально) и масштабируется;
 *  - сцена рисуется в линейном HDR, экспозиция считается по EV = log2(N²/t) − log2(ISO/100),
 *    как в симуляторе времени суток курса;
 *  - поверх: глубина резкости, смаз движения, шум, баланс белого, мерцание ламп, Apple Log и LUT,
 *    зебра, false color, фокус-пикинг, гистограмма, рамки и сетки.
 */
(function () {
  'use strict';
  if (window.MLBMCameraSim) return;

  /* ---------- Утилиты ---------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function s2l(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function l2s(c) { c = clamp(c, 0, 1); return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }
  function hx(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = (s + 0x6D2B79F5) >>> 0; var t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pad(n, w) { n = String(n); while (n.length < (w || 2)) n = '0' + n; return n; }
  function fmtTC(frames, fps) {
    var f = Math.round(fps) || 24, fr = frames % f, s = Math.floor(frames / f);
    return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60) + ':' + pad(fr);
  }
  function fmtDur(sec) { sec = Math.max(0, Math.floor(sec)); return Math.floor(sec / 3600) + ':' + pad(Math.floor(sec / 60) % 60) + ':' + pad(sec % 60); }
  function fmtClipDur(sec) { sec = Math.max(0, Math.round(sec)); return pad(Math.floor(sec / 60)) + ':' + pad(sec % 60); }
  function nearestIdx(arr, v, key) {
    var b = 0, bd = Infinity;
    for (var i = 0; i < arr.length; i++) { var x = key ? arr[i][key] : arr[i], d = Math.abs(x - v); if (d < bd) { bd = d; b = i; } }
    return b;
  }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem('mlbm.' + k)); localStorage.setItem('mlbm.' + k, JSON.stringify(v)); } catch (e) { return null; } }

  /* Цвет абсолютно чёрного тела (приближение Таннера Хелланда), линейный RGB */
  function kRGB(K) {
    var t = K / 100, r, g, b;
    if (t <= 66) {
      r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661;
      b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    } else {
      r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
      g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); b = 255;
    }
    return [s2l(clamp(r, 1, 255) / 255), s2l(clamp(g, 1, 255) / 255), s2l(clamp(b, 1, 255) / 255)];
  }
  function normLum(c) { var n = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; return [c[0] / n, c[1] / n, c[2] / n]; }

  /* ---------- Модули камеры iPhone 15 Pro Max ---------- */
  /* f — реальное фокусное (мм), eq — эквивалент, N — диафрагма, noise — множитель шума сенсора */
  var LENSES = [
    { id: 'uw', eq: 13, f: 2.22, N: 2.2, zoom: 0.5, noise: 1.7, isoMin: 50, isoMax: 3200, name: 'Ultra Wide', minFocus: 0.02 },
    { id: 'w', eq: 24, f: 6.86, N: 1.78, zoom: 1, noise: 1.0, isoMin: 55, isoMax: 7616, name: 'Main', minFocus: 0.15 },
    { id: 'w2', eq: 48, f: 6.86, N: 1.78, zoom: 2, noise: 1.25, isoMin: 55, isoMax: 7616, name: 'Main 48 mm (2x crop)', minFocus: 0.15, crop: 2 },
    { id: 't', eq: 120, f: 15.66, N: 2.8, zoom: 5, noise: 1.45, isoMin: 40, isoMax: 8701, name: 'Telephoto 5x', minFocus: 0.45 },
    { id: 'f', eq: 23, f: 2.69, N: 1.9, zoom: 1, noise: 1.9, isoMin: 32, isoMax: 2304, name: 'Front (TrueDepth)', minFocus: 0.25, front: true }
  ];
  function lensById(id) { for (var i = 0; i < LENSES.length; i++) if (LENSES[i].id === id) return LENSES[i]; return LENSES[1]; }

  /* ---------- Значения колёс ---------- */
  var FPS_LIST = [23.98, 24, 25, 29.97, 30, 48, 50, 59.94, 60];
  var FPS_HD_EXTRA = [100, 120];
  var OFFSPEED_LIST = [4, 5, 6, 8, 10, 12, 15, 20, 24, 25, 30, 48, 50, 60, 100, 120];
  var SHUTTER_SPEEDS = [24, 25, 30, 33, 40, 48, 50, 60, 80, 96, 100, 120, 125, 160, 200, 240, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 6400, 8000];
  var SHUTTER_ANGLES = [11.25, 15, 22.5, 30, 45, 60, 72, 75, 90, 120, 144, 150, 172.8, 180, 216, 270, 324, 360];
  var ISO_FINE = [25, 32, 40, 50, 55, 64, 80, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 5280, 6400, 7616, 8701];
  var ISO_QUICK = [3200, 1600, 800, 400, 200, 100];
  var WB_PRESETS = [
    { id: 'daylight', K: 5600, tint: 10, name: 'Daylight' },
    { id: 'incandescent', K: 3200, tint: 0, name: 'Incandescent' },
    { id: 'fluorescent', K: 4000, tint: 15, name: 'Fluorescent' },
    { id: 'shade', K: 7500, tint: 10, name: 'Shade' },
    { id: 'cloud', K: 6500, tint: 10, name: 'Cloud' }
  ];
  var FRAME_GUIDES = ['9:16', '4:5', '1:1', '4:3', '14:9', '1.85:1', '2:1', '2.35:1', '2.39:1', '2.4:1', '2.76:1'];
  function ratioVal(s) { var p = s.split(':'); return parseFloat(p[0]) / parseFloat(p[1]); }

  /* ---------- Условия съёмки (сцены) ---------- */
  /* ev — яркость сцены (EV при ISO 100); K — цвет основного света; tint — зелёный сдвиг света;
     flicker — глубина мерцания 100 Гц (сеть 50 Гц); kind — какая сцена рисуется */
  var SCENES = [
    { id: 'day', name: 'Улица, солнечный день', short: 'Солнце', kind: 'street', ev: 14.6, K: 5600, tint: 0, flicker: 0, sky: 'day', runner: true, audio: -32, speech: false,
      about: 'Яркое солнце, жёсткие тени. Яркость сцены ≈ EV 15: без ND-фильтра при выдержке 1/50 кадр будет пересвечен даже на минимальном ISO.' },
    { id: 'overcast', name: 'Улица, пасмурно', short: 'Пасмурно', kind: 'street', ev: 12, K: 6500, tint: 0, flicker: 0, sky: 'overcast', runner: true, audio: -34, speech: false,
      about: 'Мягкий рассеянный свет без теней, цвет чуть холоднее дневного (≈ 6500 K). EV ≈ 12.' },
    { id: 'sunset', name: 'Закат, золотой час', short: 'Закат', kind: 'street', ev: 11, K: 3300, tint: 0, flicker: 0, sky: 'sunset', runner: true, audio: -36, speech: false,
      about: 'Низкое тёплое солнце (≈ 3000–3500 K). Если поставить баланс белого «как для лампы», закат станет синим и потеряет атмосферу.' },
    { id: 'night', name: 'Ночная улица, фонари', short: 'Ночь', kind: 'street', ev: 4, K: 3000, tint: 0, flicker: 0.12, sky: 'night', runner: true, audio: -40, speech: false,
      about: 'Очень мало света: EV ≈ 4. Тёплые фонари на фоне тёмно-синего неба. Здесь видно, какой модуль светосильнее и откуда берётся шум.' },
    { id: 'tungsten', name: 'Комната, лампы накаливания', short: 'Лампы', kind: 'room', ev: 7, K: 2900, tint: 0, flicker: 0.12, lamp: 'tungsten', runner: false, audio: -44, speech: true,
      about: 'Тёплый свет ламп ≈ 2900 K, слабое мерцание 100 Гц (сеть 50 Гц). EV ≈ 7.' },
    { id: 'office', name: 'Офис, светодиодные лампы', short: 'LED', kind: 'room', ev: 8, K: 4100, tint: 18, flicker: 0.65, lamp: 'led', runner: false, audio: -42, speech: true,
      about: 'Дешёвые светодиодные панели: сильное мерцание 100 Гц и зеленоватый оттенок. Нужны «безмерцающая» выдержка и коррекция TINT.' },
    { id: 'window', name: 'Интервью у окна', short: 'Окно', kind: 'room', ev: 9, K: 5800, tint: 0, flicker: 0, lamp: 'window', runner: false, audio: -24, speech: true,
      about: 'Человек сидит у большого окна: мягкий дневной свет сбоку. Удобная сцена для фокуса на лице и экспозиции по коже.' }
  ];
  function sceneById(id) { for (var i = 0; i < SCENES.length; i++) if (SCENES[i].id === id) return SCENES[i]; return SCENES[0]; }

  /* ---------- Тональные кривые и LUT ---------- */
  /* «камерная» кривая Rec.709 с мягким плечом (вход — линейный свет, 0.18 — средне-серый) */
  function rec709(x, hdr) {
    if (x <= 0) return 0;
    var k = hdr ? 0.7 : 0.78, s = hdr ? 1.6 : 1;
    if (x > k) x = k + (1 - k) * (1 - Math.exp(-(x - k) / ((1 - k) * s)));
    return x;
  }
  /* Apple Log (приближение): средне-серый ≈ 41 %, примерно 0.075 кода на стоп */
  function appleLog(x) { return clamp(0.41 + 0.075 * Math.log2(Math.max(x, 1e-4) / 0.18), 0, 1); }
  function sat(r, g, b, s) { var y = 0.2126 * r + 0.7152 * g + 0.0722 * b; return [y + (r - y) * s, y + (g - y) * s, y + (b - y) * s]; }
  /* LUT получают линейный свет после экспозиции и баланса белого, возвращают «дисплейный» линейный RGB 0..1 */
  var LUTS = [
    { id: 'rec709', name: 'Rec 709 Neutral', chip: ['#8c8c8c', '#bfbfbf', '#5a5a5a'], about: 'Нейтральное преобразование Apple Log → Rec.709: нормальный контраст и насыщенность, без «окраса». Отправная точка для цветокоррекции.',
      fn: function (r, g, b) { return [r, g, b]; } },
    { id: 'cinemateal', name: 'Cinema Teal', chip: ['#1f6f78', '#e3a26a', '#21414a'], about: 'Популярный «киношный» вид: тёплая кожа и бирюзовые тени (teal & orange).',
      fn: function (r, g, b) { var y = 0.2126 * r + 0.7152 * g + 0.0722 * b, sh = clamp(1 - y * 2.2, 0, 1), hi = clamp((y - 0.3) * 1.6, 0, 1); var c = sat(r, g, b, 1.15); return [c[0] * (1 - 0.18 * sh) + 0.06 * hi, c[1] * (1 + 0.02 * sh) + 0.02 * hi, c[2] * (1 + 0.22 * sh) - 0.05 * hi]; } },
    { id: 'daynight', name: 'Day Night', chip: ['#16243f', '#2c4a78', '#0b1220'], about: '«Day for night»: днём снятый кадр превращается в ночь — тёмно-синий, приглушённый, с опущенной экспозицией.',
      fn: function (r, g, b) { var c = sat(r, g, b, 0.45); return [c[0] * 0.35, c[1] * 0.45, c[2] * 0.75 + 0.01]; } },
    { id: 'dusty', name: 'Dusty', chip: ['#9b8c7a', '#c9b9a2', '#6d625a'], about: 'Пыльный, выцветший вид: низкая насыщенность, приподнятые тени, тёплый оттенок.',
      fn: function (r, g, b) { var c = sat(r, g, b, 0.55); return [0.05 + c[0] * 0.9, 0.045 + c[1] * 0.87, 0.04 + c[2] * 0.8]; } },
    { id: 'mono', name: 'Monochrome', chip: ['#202020', '#9a9a9a', '#e8e8e8'], about: 'Чёрно-белое изображение с умеренным контрастом.',
      fn: function (r, g, b) { var y = 0.2126 * r + 0.7152 * g + 0.0722 * b; y = y * 1.08; return [y, y, y]; } },
    { id: 'nature', name: 'Nature', chip: ['#3f7a2e', '#d9a441', '#2b5a3a'], about: 'Сочная «природная» картинка: тёплый свет и насыщенные зелёные и жёлтые.',
      fn: function (r, g, b) { var c = sat(r, g, b, 1.35); return [c[0] * 1.1, c[1] * 1.03, c[2] * 0.82]; } },
    { id: 'nostalgic', name: 'Nostalgic', chip: ['#a07b55', '#d8b98a', '#5c4a3a'], about: 'Ностальгический тёплый вид, как у старой плёнки: мягкие чёрные, сдвиг в янтарь.',
      fn: function (r, g, b) { var c = sat(r, g, b, 0.75); return [0.04 + c[0] * 1.02, 0.03 + c[1] * 0.92, 0.02 + c[2] * 0.7]; } },
    { id: 'paloma', name: 'Paloma', chip: ['#c79a4a', '#f1d28a', '#7a5a2a'], about: 'Золотистый солнечный вид: тёплые светá и мягкий контраст.',
      fn: function (r, g, b) { var c = sat(r, g, b, 1.05); return [c[0] * 1.12, c[1] * 1.0, c[2] * 0.72]; } },
    { id: 'rift', name: 'Rift', chip: ['#3a5a6a', '#b07a5a', '#1a2a30'], about: 'Холодный контрастный вид с глубокими тенями.',
      fn: function (r, g, b) { var c = sat(r, g, b, 0.9); return [c[0] * c[0] * 1.15, c[1] * c[1] * 1.1 + c[1] * 0.1, c[2] * 0.9 + 0.03]; } },
    { id: 'vivid', name: 'Vivid', chip: ['#d23a4a', '#3ab0e0', '#f0c030'], about: 'Яркий, насыщенный, контрастный вид.',
      fn: function (r, g, b) { var c = sat(r, g, b, 1.55); return [c[0] * 1.04, c[1] * 1.04, c[2] * 1.04]; } },
    { id: 'warmfade', name: 'Warm Fade', chip: ['#b08070', '#e8c0a0', '#704840'], about: 'Тёплый «выцветший» вид с приподнятыми тенями и мягкими светами.',
      fn: function (r, g, b) { var c = sat(r, g, b, 0.8); return [0.06 + c[0] * 0.95, 0.04 + c[1] * 0.86, 0.035 + c[2] * 0.76]; } }
  ];
  function lutById(id) { for (var i = 0; i < LUTS.length; i++) if (LUTS[i].id === id) return LUTS[i]; return LUTS[0]; }
