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
  /* =====================================================================
   *  НАСТРОЙКИ (вкладка Settings) — порядок и названия как в приложении 3.5
   *  t: sel — выбор из списка (экран с галочкой), tog — переключатель,
   *     link — открывает отдельный экран, info — только значение, btn — кнопка
   *  h: справка (RU), sim: что происходит в симуляторе
   * ===================================================================== */
  var CODECS = [
    ['prores422hq', 'Apple ProRes 422 HQ'], ['prores422', 'Apple ProRes 422'], ['prores422lt', 'Apple ProRes 422 LT'],
    ['proresproxy', 'Apple ProRes 422 Proxy'], ['hevc', 'HEVC (H.265)'], ['h264', 'H.264']
  ];
  /* Мбит/с для 3840×2160 при 30 к/с (ProRes — по данным Apple) */
  var CODEC_RATE = { prores422hq: 707, prores422: 471, prores422lt: 328, proresproxy: 145 };
  var BITRATES = [['max', 'Max (54Mbps)', 54], ['high', 'High (36Mbps)', 36], ['medium', 'Medium (27Mbps)', 27], ['low', 'Low (18Mbps)', 18]];

  var SETTINGS = [
    { id: 'record', title: 'Record', groups: [
      [
        { k: 'codec', l: 'Codec', t: 'sel', o: CODECS,
          k2: 'bitrate', l2: 'Bit Rate', o2: BITRATES.map(function (b) { return [b[0], b[1]]; }), show2: function (S) { return S.codec === 'hevc' || S.codec === 'h264'; },
          h: 'Кодек — способ сжатия видео. Apple ProRes (422 HQ, 422, LT, Proxy) почти не сжимает картинку: файлы огромные, но удобны для монтажа и цветокоррекции. HEVC (H.265) и H.264 сжимают сильно: файлы в 10–20 раз меньше. Для HEVC и H.264 на этом же экране выбирается битрейт (Bit Rate).',
          tip: 'Для Apple Log и цветокоррекции — ProRes 422 HQ или 422. Для соцсетей и долгих съёмок — HEVC. На iPhone 15 Pro ProRes 4K 60 к/с пишется только на внешний диск.' },
        { k: 'resolution', l: 'Resolution', t: 'sel', o: [['4k', '4K'], ['hd', 'HD'], ['720p', '720p'], ['opengate', 'Open Gate']],
          h: 'Разрешение записи: 4K — 3840×2160, HD — 1920×1080, 720p — 1280×720. Open Gate — 1920×1440 (4:3) со всей площади сенсора, удобно, чтобы потом кадрировать и в горизонталь, и в вертикаль.',
          tip: '100 и 120 к/с доступны только в HD. Open Gate работает с Apple Log.' },
        { k: 'colorspace', l: 'Color Space', t: 'sel', o: [['rec709', 'Rec.709'], ['rec2020', 'Rec.2020 - HDR'], ['p3', 'P3 D65'], ['applelog', 'Apple Log - HDR']],
          h: 'Цветовое пространство и гамма записи. Rec.709 — обычное видео «как есть». Rec.2020 - HDR и P3 D65 — расширенный цвет для HDR-экранов. Apple Log — «плоская» логарифмическая картинка: максимум деталей в светах и тенях, но без цветокоррекции или LUT выглядит серой.',
          tip: 'Apple Log выбирают, когда будут красить материал в DaVinci Resolve. Для монитора включите LUT Rec 709 Neutral.' },
        { k: 'hdr', l: 'HDR Video', t: 'tog', h: 'Записывать видео с HDR-метаданными: светлые участки сохраняют больше деталей и на HDR-экране выглядят ярче.', sim: 'В симуляторе мягче «сворачиваются» пересветы.' },
        { k: 'timelapse', l: 'Timelapse Recording', t: 'tog', h: 'Интервальная (покадровая) съёмка: камера снимает 1 кадр через заданный интервал. Облака, толпа, закат «ускоряются» в сотни раз.' },
        { k: 'tlInterval', l: 'Capture 1 Frame Every', t: 'sel', dis: function (S) { return !S.timelapse; },
          o: [['2s', '2 Seconds'], ['5s', '5 Seconds'], ['10s', '10 Seconds'], ['30s', '30 Seconds'], ['1m', '1 Minute'], ['5m', '5 Minutes'], ['10m', '10 Minutes']],
          h: 'Интервал таймлапса: от 1 кадра каждые 2 секунды до 1 кадра каждые 10 минут. Пример: интервал 2 с и проект 25 к/с — 1 минута съёмки даст 1,2 секунды видео.' }
      ],
      [
        { k: 'trigger', l: 'Trigger Record Indicator', t: 'sel', page: 'Camera', o: [['beeper', 'Beeper'], ['beeperflash', 'Beeper and Flash'], ['none', 'None']],
          h: 'Сигнал о начале записи: звуковой (Beeper), звук и вспышка фонарика (Beeper and Flash) или без сигнала. Удобно, когда камера далеко или вы в кадре.', sim: 'Звук пиликает, вспышка — белое мигание экрана.' },
        { k: 'volumeRec', l: 'Use Volume Button to Trigger Record', t: 'tog', h: 'Кнопки громкости iPhone запускают и останавливают запись — не нужно касаться экрана и трясти камеру.', sim: 'В симуляторе — клавиши ↑ / ↓ или пробел.' },
        { k: 'swipeDim', l: 'Swipe Right to Dim Screen While Recording', t: 'tog', h: 'Во время записи свайп вправо по экрану затемняет его: экономит батарею и не слепит в темноте.', sim: 'Свайп вправо по кадру во время записи.' },
        { k: 'lockWbRec', l: 'Lock White Balance on Record', t: 'tog', h: 'С началом записи автоматический баланс белого фиксируется, чтобы цвет не «плыл» посреди дубля.' },
        { k: 'dropFrame', l: 'If Media Drops Frame', t: 'sel', o: [['alert', 'Alert'], ['stop', 'Stop Recording']],
          h: 'Что делать, если носитель не успевает записывать и пропускает кадры: показать предупреждение (Alert) или остановить запись (Stop Recording).', sim: 'Пропуск кадров случается при ProRes 4K выше 30 к/с во внутреннюю память.' }
      ],
      [
        { k: 'tcDisplay', l: 'Timecode Display', t: 'sel', o: [['rr', 'Record Run'], ['tod', 'Time of Day (TOD)']],
          h: 'Режим таймкода. Record Run — счёт идёт только во время записи и продолжается с того места, где остановился. Time of Day — таймкод равен текущему времени; нужен для синхронизации нескольких камер и звука.' },
        { k: 'refSource', l: 'Reference Source', t: 'sel', dis: function () { return true; }, o: [['none', 'None']],
          h: 'Внешний источник таймкода (например, Tentacle Sync E по Bluetooth). Доступен, когда включён Bluetooth и подключено устройство.' }
      ]
    ] },
    { id: 'camera', title: 'Camera', groups: [
      [
        { k: 'cinematic', l: 'Cinematic Mode', sub: 'Records a depth of field effect to the clip.', t: 'tog',
          h: 'Кинематографический режим iPhone: программно размывает фон за объектом, имитируя малую глубину резкости большой камеры.', sim: 'Фон заметно размывается.' }
      ],
      [
        { k: 'vertical', l: 'Enable Vertical Video', t: 'tog', h: 'Разрешает запись вертикального видео, когда телефон держат вертикально. Если выключено, видео всегда пишется горизонтальным.' },
        { k: 'lockOrient', l: 'Lock Current Orientation', t: 'tog', h: 'Сохраняет текущую ориентацию интерфейса, даже если телефон повернуть.' },
        { k: 'mirrorFront', l: 'Mirror Front-Facing Camera', t: 'tog', h: 'Зеркалит изображение фронтальной камеры, как в зеркале.', sim: 'Работает при выборе модуля Front.' }
      ],
      [
        { k: 'shutterMeas', l: 'Shutter Measurement', t: 'sel', o: [['speed', 'Speed'], ['angle', 'Angle']],
          h: 'Как показывать выдержку: Speed — долями секунды (1/50), Angle — углом затвора в градусах (180°), как на кинокамерах. 180° = выдержка 1/(2×fps) при любой частоте кадров.' },
        { k: 'flickerHz', l: 'Flicker Free Shutter Based On', t: 'sel', o: [['50', '50Hz'], ['60', '60Hz']],
          h: 'Частота электросети, под которую подбираются «безмерцающие» значения выдержки в колесе SHUTTER. В России и Европе — 50 Гц (выдержки 1/50, 1/100, 1/33, 1/25), в США — 60 Гц (1/60, 1/120, 1/40, 1/30).' },
        { k: 'irisMeas', l: 'Iris Measurement', t: 'sel', o: [['fraction', 'Fraction'], ['decimal', 'Decimal']],
          h: 'Как показывать диафрагму: Fraction — f/1.8, Decimal — 1.8.' }
      ],
      [
        { k: 'lensCorr', l: 'Lens Correction', t: 'tog', h: 'Программно исправляет дисторсию объектива — особенно заметную бочку у сверхширокого модуля 0.5x.', sim: 'Выключите и выберите 13 мм: прямые линии изогнутся.' },
        { k: 'extLens', l: 'Use External Lens', t: 'tog', h: 'Режим для насадочных объективов (анаморфных, широкоугольных), которые надеваются на iPhone.' },
        { k: 'desqueeze', l: 'Anamorphic De-Squeeze', t: 'sel', o: [['1', 'None'], ['1.33', '1.33'], ['1.55', '1.55'], ['2', '2.00']],
          h: 'Растягивает изображение для анаморфной насадки, которая «сжимает» картинку по горизонтали. Коэффициент должен совпадать с насадкой: 1.33, 1.55 или 2.00.', tip: 'Без насадки включать нельзя — все люди станут широкими.' },
        { k: 'flipSlr', l: 'Flip Image for SLR Lens', t: 'tog', h: 'Переворачивает изображение для адаптеров зеркальных объективов, которые дают перевёрнутую картинку.' }
      ]
    ] },
    { id: 'media', title: 'Media', groups: [
      [
        { k: 'saveTo', l: 'Save Clips to', t: 'sel', o: [['inapp', 'In-App Only'], ['inappphotos', 'In-App and Photo Library'], ['files', 'Files'], ['external', 'Pro Video Storage']],
          subs: { external: 'For ProRes codecs' },
          h: 'Куда сохранять клипы: только в приложении, в приложении и в «Фото», в «Файлы» или на внешний носитель (Pro Video Storage — SSD через USB-C, для ProRes).',
          tip: 'Для ProRes 4K 60 к/с на iPhone 15 Pro нужен внешний SSD.' },
        { k: 'saveLoc', l: 'Save Location Data to Clip', t: 'tog', h: 'Записывать координаты GPS в метаданные клипа.' },
        { k: 'filename', l: 'Filename Convention', t: 'sel', o: [['bm', 'Blackmagic Camera'], ['ios', 'iOS']],
          h: 'Схема имён файлов. Blackmagic Camera: A001_10111718_C019 — камера A, катушка 001, дата и время (ММДДЧЧММ), клип 19. iOS: IMG_0123.' }
      ],
      [
        { k: 'proxy', l: 'Record Proxy', t: 'tog', h: 'Одновременно с оригиналом записывать лёгкую копию 1920×1080 HEVC (прокси) — для быстрой загрузки в облако и монтажа.' },
        { l: 'Proxy Clip Manager', t: 'link', page: 'proxy', h: 'Сколько прокси-файлов хранится и сколько места они занимают; кнопка Delete Proxy Clips удаляет их.' }
      ],
      [
        { k: 'autoUpload', l: 'Auto Upload To Selected Project', t: 'tog', h: 'Автоматически загружать снятые клипы в выбранный проект Blackmagic Cloud.' },
        { k: 'uploadClips', l: 'Upload Clips', t: 'sel', o: [['proxies', 'Proxies Only'], ['both', 'Originals and Proxies']], h: 'Что загружать в облако: только прокси или оригиналы вместе с прокси.' },
        { k: 'liveSync', l: 'Live Sync', t: 'tog', h: 'Клипы появляются у монтажёра в DaVinci Resolve прямо во время съёмки через Blackmagic Cloud.' },
        { k: 'wifiOnly', l: 'Enable Upload Only Over Wi-Fi', t: 'tog', h: 'Загружать только по Wi-Fi и не тратить мобильный интернет.' }
      ]
    ] },
    { id: 'audio', title: 'Audio', groups: [
      [
        { k: 'audioSrc', l: 'Audio Source', t: 'sel', o: [['none', 'None'], ['iphone', 'iPhone Microphone']], h: 'Источник звука: без звука (None), встроенный микрофон iPhone или подключённый внешний микрофон.', sim: 'При None аудиометры пустые, клипы без звука.' },
        { k: 'iphoneMic', l: 'iPhone Microphone', t: 'sel', o: [['auto', 'Auto'], ['back', 'Back'], ['bottom', 'Bottom'], ['front', 'Front']],
          h: 'Какой из микрофонов iPhone использовать: задний (рядом с камерами, слышит то, что в кадре), нижний (у разъёма) или передний (у динамика, для съёмки себя).' }
      ],
      [
        { k: 'audioFmt', l: 'Audio Format', t: 'sel', o: [['pcm', 'Linear PCM'], ['float', 'IEEE Float'], ['aac', 'AAC']],
          h: 'Формат звука. Linear PCM и IEEE Float — без потерь, для монтажа; IEEE Float почти невозможно «перегрузить» при обработке. AAC — сжатый, файлы меньше.' },
        { k: 'audioCh', l: 'Record Audio as', t: 'sel', o: [['mono', 'Mono'], ['stereo', 'Stereo'], ['dualmono', 'Dual Mono'], ['4ch', '4 Channels']],
          h: 'Сколько каналов записывать: Mono, Stereo, Dual Mono (один сигнал в двух каналах — второй можно записать тише как страховку) или 4 канала.' },
        { k: 'sampleRate', l: 'Sample Rate', t: 'sel', o: [['auto', 'Auto'], ['44.1', '44.1 kHz'], ['48', '48.0 kHz'], ['96', '96.0 kHz'], ['192', '192.0 kHz']],
          h: 'Частота дискретизации. Для видео стандарт — 48 kHz.' }
      ],
      [
        { k: 'metering', l: 'Audio Metering', t: 'sel', o: [['vu18', 'VU (-18dBFS)'], ['vu20', 'VU (-20dBFS)'], ['ppm18', 'PPM (-18dBFS)'], ['ppm20', 'PPM (-20dBFS)']],
          h: 'Тип индикатора уровня. VU — «усреднённый», медленный, показывает громкость на слух. PPM — пиковый, быстрый, ловит короткие всплески. Число — опорный уровень (−18 или −20 dBFS), на который ориентируются при записи речи.', sim: 'Меняется скорость стрелки и метка опорного уровня.' },
        { k: 'audioMon', l: 'Audio Monitor', t: 'tog', h: 'Прослушивать звук во время записи — в наушниках или динамике.' },
        { k: 'audioOut', l: 'Audio Output', t: 'sel', o: [['speaker', 'Speaker']], h: 'Куда выводится прослушка: динамик iPhone или подключённые наушники (в том числе Bluetooth/AirPlay).' }
      ]
    ] },
    { id: 'monitor', title: 'Monitor', groups: [
      [
        { k: 'faMode', l: 'Focus Assist', t: 'sel', o: [['peaking', 'Peaking'], ['lines', 'Colored Lines']],
          h: 'Способ подсветки резкости. Peaking — резкие края «светятся». Colored Lines — резкие края обводятся цветными линиями (цвет — в Focus Assist Color).' },
        { k: 'faColor', l: 'Focus Assist Color', t: 'sel', o: [['white', 'White'], ['black', 'Black'], ['red', 'Red'], ['green', 'Green'], ['blue', 'Blue']], h: 'Цвет линий фокус-ассиста. Выбирайте цвет, которого мало в кадре.' },
        { k: 'guidesOp', l: 'Guides Opacity', t: 'sel', o: [['25', '25%'], ['50', '50%'], ['75', '75%'], ['100', '100%']], h: 'Насколько затемняется область за рамкой кадра (Frame Guide).' },
        { k: 'guidesColor', l: 'Guides Color', t: 'sel', o: [['white', 'White'], ['black', 'Black'], ['red', 'Red'], ['green', 'Green'], ['blue', 'Blue']], h: 'Цвет линий рамки кадра и Safe Area.' },
        { k: 'gridsOp', l: 'Grids Opacity', t: 'sel', o: [['25', '25%'], ['50', '50%'], ['75', '75%'], ['100', '100%']], h: 'Прозрачность линий сетки (трети, перекрестие, точка).' }
      ],
      [
        { k: 'hdmi', l: 'HDMI Out', t: 'sel', o: [['mirror', 'Mirror Display'], ['feed', 'Video Feed']], page: 'Monitor',
          h: 'Что выводить на внешний монитор через переходник USB-C → HDMI: копию экрана (Mirror Display) или чистое видео (Video Feed) с выбранными поверх него элементами (Clean Feed, Status Text, Zebra, Frame Guide и др.).', sim: 'Имитация: внешнего монитора в симуляторе нет.' }
      ],
      [
        { k: 'dispAudio', l: 'Display Audio Meters', t: 'tog', h: 'Показывать панель аудиометров внизу экрана.' },
        { k: 'dispHist', l: 'Display Histogram', t: 'tog', h: 'Показывать гистограмму внизу экрана.' },
        { k: 'dispStorage', l: 'Display Storage Status', t: 'tog', h: 'Показывать панель носителя: сколько минут записи осталось и сколько места свободно.' },
        { k: 'dispStream', l: 'Display Stream Status', t: 'tog', h: 'Показывать статус прямой трансляции.' },
        { k: 'dispUpload', l: 'Display Upload Status', t: 'tog', h: 'Показывать статус загрузки клипов в облако.' },
        { k: 'dispBattery', l: 'Display Battery Indicator', t: 'tog', h: 'Показывать заряд батареи в правом верхнем углу.' }
      ]
    ] },
    { id: 'livestream', title: 'Live Stream', groups: [
      [
        { k: 'platform', l: 'Platform', t: 'sel', o: [['bmcloud', 'Blackmagic Cloud'], ['youtube', 'YouTube'], ['twitch', 'Twitch'], ['vimeo', 'Vimeo']], page: 'Live Stream',
          h: 'Куда вести прямую трансляцию: Blackmagic Cloud, YouTube, Twitch или Vimeo. Кнопка Import Stream Settings загружает файл с ключом трансляции (например, из ATEM).' },
        { l: 'Log in to Blackmagic Cloud', t: 'link', page: 'cloud', h: 'Вход в учётную запись Blackmagic Cloud — нужен для трансляции, облачных проектов и чата.' },
        { k: 'liveStream', l: 'Live Stream', t: 'tog', dis: function (S) { return !S.cloudLogged; }, h: 'Запуск трансляции. Становится доступным после входа в аккаунт выбранной платформы.' }
      ]
    ] },
    { id: 'fbuttons', title: 'Function Buttons', groups: [
      [
        { k: 'fbOn', l: 'Function Buttons', t: 'tog', h: 'Показывать программируемые кнопки F1, F2, F3 в правой выдвижной панели (⋮ справа).' },
        { k: 'f1', l: 'F1', t: 'sel', o: null, h: 'Функция кнопки F1 — быстрый доступ к инструменту одним нажатием.' },
        { k: 'f2', l: 'F2', t: 'sel', o: null, h: 'Функция кнопки F2.' },
        { k: 'f3', l: 'F3', t: 'sel', o: null, h: 'Функция кнопки F3.' }
      ]
    ] },
    { id: 'luts', title: 'LUTs', groups: [
      [
        { l: 'LUTs Manager', t: 'link', page: 'luts', val: function (S) { return String(S.lutEnabled.filter(Boolean).length); },
          h: 'Список LUT: встроенные Blackmagic LUTs (можно отключить ненужные), импорт своих файлов .cube, экспорт и удаление.' },
        { k: 'recLut', l: 'Record LUT to Clip', t: 'tog', dis: function (S) { return !S.lutOn; },
          h: '«Вшить» LUT в запись: клип сразу будет с этим видом, исходную Log-картинку уже не вернуть. Если выключено, LUT только на экране, а в файл пишется исходный сигнал.', tip: 'Под цветокоррекцию LUT обычно НЕ вшивают.' }
      ]
    ] },
    { id: 'remote', title: 'Remote Camera Control', groups: [
      [
        { k: 'remoteOn', l: 'Remote Camera Control', t: 'tog', h: 'Управление несколькими iPhone по сети: один телефон (или iPad) — пульт, остальные — камеры. Пульт видит картинку всех камер и меняет их настройки.' },
        { k: 'remoteRole', l: 'Use This iPhone as', t: 'sel', dis: function (S) { return !S.remoteOn; }, o: [['controller', 'Controller'], ['camera', 'Remote Camera']], h: 'Роль этого телефона: пульт (Controller) или управляемая камера (Remote Camera).' }
      ],
      [
        { k: 'camName', l: 'Camera Name', t: 'info', dis: function (S) { return !S.remoteOn; }, val: function (S) { return S.camName; }, h: 'Имя камеры (буква A, B, C…). Попадает в имя файла: A001_…' },
        { l: 'Remote Password', t: 'info', dis: function (S) { return !S.remoteOn; }, val: function () { return 'No password set'; }, h: 'Пароль, чтобы к камере не подключился чужой пульт.' },
        { k: 'camAvail', l: 'Camera Available for', t: 'sel', dis: function (S) { return !S.remoteOn; }, o: [['control', 'Control and Monitor'], ['monitor', 'Monitor Only']], h: 'Что разрешено пульту: управлять и смотреть или только смотреть.' },
        { k: 'syncClips', l: 'Sync Clips To Controller after Record', t: 'tog', dis: function (S) { return !S.remoteOn; }, h: 'После записи клипы автоматически копируются на пульт.' }
      ],
      [
        { l: 'Remote Cameras Manager', t: 'info', dis: function (S) { return !S.remoteOn; }, val: function () { return 'No Cameras Saved'; }, h: 'Список сохранённых камер для пульта.' }
      ],
      [
        { k: 'syncRec', l: 'Sync Record Across Cameras', t: 'tog', dis: function (S) { return !S.remoteOn; }, h: 'Запись стартует одновременно на всех камерах.' },
        { k: 'hideFeed', l: 'Hide Remote Camera Video Feed', t: 'tog', dis: function (S) { return !S.remoteOn; }, h: 'Не передавать картинку камеры на пульт (экономит сеть).' },
        { k: 'dimRemote', l: 'Dim Remote Cameras on Record', t: 'tog', dis: function (S) { return !S.remoteOn; }, h: 'Затемнять экраны камер во время записи.' }
      ]
    ] },
    { id: 'presets', title: 'Presets', groups: [
      [ { l: 'Preset Selection', t: 'link', page: 'presets', h: 'Пресеты — сохранённые наборы настроек. Save New Preset сохраняет текущие, Import/Export переносят между телефонами, Overwrite Preset перезаписывает выбранный.' } ]
    ] },
    { id: 'accessories', title: 'Accessories', groups: [
      [
        { k: 'bluetooth', l: 'Use Bluetooth', t: 'tog', h: 'Bluetooth-аксессуары: беспроводной фоллоу-фокус Nucleus, генератор таймкода Tentacle Sync E, стабилизатор Insta360 Flow Pro.' },
        { l: 'Nucleus Wireless Lens Control', t: 'info', val: function () { return 'None'; }, h: 'Подключение беспроводного фоллоу-фокуса Tilta Nucleus для управления фокусом.' }
      ]
    ] },
    { id: 'network', title: 'Network Access', groups: [
      [ { l: 'HTTP Server', t: 'link', page: 'http', h: 'Встроенный веб-сервер: управлять камерой и скачивать клипы можно с компьютера по Wi-Fi через браузер или REST API.' } ]
    ] },
    { id: 'cloud', title: 'Blackmagic Cloud', groups: [
      [ { l: 'Log in to Blackmagic Cloud', t: 'link', page: 'cloud', h: 'Вход в Blackmagic Cloud: облачные проекты DaVinci Resolve, загрузка клипов, Live Sync и чат.' } ]
    ] },
    { id: 'reset', title: 'Reset', groups: [
      [ { l: 'Reset Blackmagic Cam Settings', t: 'link', page: 'reset', h: 'Сброс: только настроек камеры, настроек камеры и облака или полный сброс с удалением всех клипов.' } ]
    ] },
    { id: 'about', title: 'About', groups: [
      [
        { l: 'App Version', t: 'info', val: function () { return '3.5.200045'; }, h: 'Версия приложения, которую повторяет этот симулятор.' },
        { l: 'Learn More at Blackmagicdesign.com', t: 'link', page: 'learn', h: 'Сайт производителя с описанием приложения.' }
      ]
    ] }
  ];

  /* функции для F1–F3 (точный список из приложения не снят — набор основных инструментов) */
  var FUNCTIONS = [
    ['none', 'None'], ['zebra', 'Zebra'], ['focusassist', 'Focus Assist'], ['falsecolor', 'False Color'], ['frameguide', 'Frame Guide'],
    ['grid', 'Grid'], ['safearea', 'Safe Area'], ['lut', 'Display LUT'], ['cleanfeed', 'Clean Feed'], ['torch', 'Torch'],
    ['stab', 'Stabilization'], ['aelock', 'AE Lock'], ['wblock', 'WB Lock'], ['goodtake', 'Good Take']
  ];
  SETTINGS[6].groups[0][1].o = SETTINGS[6].groups[0][2].o = SETTINGS[6].groups[0][3].o = FUNCTIONS;

  /* ---------- Состояние по умолчанию ---------- */
  function defaults() {
    return {
      /* Record */
      codec: 'hevc', bitrate: 'max', resolution: '4k', colorspace: 'applelog', hdr: true, timelapse: false, tlInterval: '1m',
      trigger: 'none', volumeRec: true, swipeDim: true, lockWbRec: true, dropFrame: 'alert', tcDisplay: 'rr', refSource: 'none',
      /* Camera */
      cinematic: false, vertical: true, lockOrient: true, mirrorFront: true, shutterMeas: 'speed', flickerHz: '50', irisMeas: 'fraction',
      lensCorr: true, extLens: false, desqueeze: '1', flipSlr: false,
      /* Media */
      saveTo: 'inappphotos', saveLoc: true, filename: 'bm', proxy: true, autoUpload: true, uploadClips: 'proxies', liveSync: true, wifiOnly: false,
      /* Audio */
      audioSrc: 'iphone', iphoneMic: 'auto', audioFmt: 'float', audioCh: 'stereo', sampleRate: 'auto', metering: 'vu18', audioMon: true, audioOut: 'speaker',
      /* Monitor */
      faMode: 'lines', faColor: 'red', guidesOp: '25', guidesColor: 'white', gridsOp: '25', hdmi: 'mirror',
      dispAudio: true, dispHist: true, dispStorage: true, dispStream: true, dispUpload: false, dispBattery: true,
      /* Live stream, F-buttons, LUTs, remote */
      platform: 'bmcloud', liveStream: false, cloudLogged: false, fbOn: true, f1: 'none', f2: 'none', f3: 'none',
      lutEnabled: LUTS.map(function () { return true; }), bmLuts: true, recLut: false,
      remoteOn: false, remoteRole: 'controller', camName: 'A', camAvail: 'control', syncClips: false, syncRec: false, hideFeed: false, dimRemote: false,
      bluetooth: false,
      /* Камера: колёса HUD */
      lens: 'w', zoom: 1, fps: 23.98, offSpeed: false, offFps: 60,
      shAuto: true, shDen: 48, shAngle: 180, shLock: false,
      isoAuto: true, iso: 400, isoLock: false,
      wbAuto: true, wbK: 5600, wbLock: false, wbPreset: null,
      tintAuto: true, tint: 0, tintLock: false,
      afAuto: true, focus: 0.97, aeAuto: true, ev: 0,
      lutOn: false, lut: 'rec709',
      /* инструменты монитора */
      zebra: false, zebraLvl: 95, zebraMode: 'level', fa: false, faLvl: 50, grid: false, gridThirds: true, gridHorizon: false, gridCross: false, gridDot: false,
      fg: false, fgRatio: '2.39:1', safe: false, safeLvl: 90, falseColor: false, torch: false, torchLvl: 50, torchAuto: false,
      stab: 'standard',
      /* слейт */
      reel: 1, sceneNo: 1, take: 1, interior: true, day: true, goodTake: false, prodName: '', director: '', operator: ''
    };
  }
  /* =====================================================================
   *  СПРАВКА по элементам главного экрана (t — заголовок, d — что это, tip — совет)
   * ===================================================================== */
  var HELP = {
    /* верхняя строка */
    lens: { t: 'LENS — объектив', d: 'Фокусное расстояние выбранного модуля в эквиваленте 35 мм. У iPhone 15 Pro Max: 13 мм (сверхширокий 0.5x, f/2.2), 24 мм (основной 1x, f/1.78), 48 мм (2x — кроп центра основного сенсора), 120 мм (телефото 5x, f/2.8) и фронтальная камера. Нажмите, чтобы открыть колесо выбора модуля и зума.', tip: 'В темноте лучше 24 мм: у него самая светосильная диафрагма и самый большой сенсор. 13 и 120 мм шумят заметно сильнее.' },
    fps: { t: 'FPS — частота кадров', d: 'Сколько кадров в секунду записывает камера. 24 (23.98) — «кино», 25 — стандарт Европы и России, 30 — США и соцсети, 50/60 — плавное движение или замедление ×2. Внутри колеса: OFF/SPEED — съёмка с другой частотой для замедления/ускорения, TIME LAPSE — интервальная съёмка.', tip: 'Выдержку подбирают от FPS: по правилу 180° она равна 1/(2×FPS).' },
    shutter: { t: 'SHUTTER — выдержка', d: 'Сколько времени экспонируется каждый кадр. Короче выдержка — темнее кадр и резче движение (вплоть до «дёрганого» стробоскопа). Длиннее — светлее и больше смаза. Синяя «A» — выдержка автоматическая. Колонка справа — значения без мерцания для сети 50/60 Гц. Замок фиксирует значение.', tip: 'Правило 180°: 1/50 при 25 к/с, 1/48 при 24 к/с, 1/60 при 30 к/с. Под лампами в сети 50 Гц — 1/50 или 1/100.' },
    iris: { t: 'IRIS — диафрагма', d: 'Светосила объектива. У iPhone диафрагма фиксированная и меняется только вместе с модулем (f/1.8, f/2.2, f/2.8), поэтому значение серое и не нажимается. Экспозицию на iPhone регулируют выдержкой и ISO.' },
    tc: { t: 'Таймкод', d: 'Часы:минуты:секунды:кадры. В режиме Record Run считает время записи, в Time of Day показывает текущее время (Settings → Record → Timecode Display). Во время записи становится красным.' },
    iso: { t: 'ISO — чувствительность', d: 'Насколько усиливается сигнал сенсора. Выше ISO — светлее кадр, но больше цифрового шума. Синяя «A» — ISO автоматическое. Колонка справа — быстрые значения 100…3200, линейка — точные. Замок фиксирует значение.', tip: 'Сначала выставьте выдержку по правилу 180°, а яркость добирайте ISO. Если ISO выше 1600–3200, шум станет заметен.' },
    wb: { t: 'WB — баланс белого', d: 'Под какую цветовую температуру света настроена камера, в кельвинах. Свет ламп накаливания ≈ 3000 K, дневной ≈ 5600 K, тень и пасмурно ≈ 6500–7500 K. Если WB выше реального света — картинка теплеет (желтеет), ниже — холодеет (синеет). AUTO — автоматический, замок фиксирует. Иконки — пресеты: солнце, лампа накаливания, люминесцентная лампа, тень, облачно.', tip: 'В дубле баланс белого должен быть ручным, иначе цвет будет «плавать».' },
    tint: { t: 'TINT — оттенок', d: 'Поправка по оси зелёный ↔ пурпурный, дополняет баланс белого. Люминесцентные и дешёвые LED-лампы часто дают зелёный оттенок — его убирают положительным TINT (в сторону пурпурного).' },
    format: { t: '4K 16:9 — формат записи', d: 'Текущее разрешение и соотношение сторон кадра. Меняется в Settings → Record → Resolution.' },
    battery: { t: 'Батарея', d: 'Заряд батареи iPhone. Запись 4K, фонарик и яркий экран разряжают телефон быстрее. Отключается в Settings → Monitor → Display Battery Indicator.' },
    /* правая колонка */
    tools: { t: 'Инструменты монитора', d: 'Открывает колонку инструментов контроля: Zebra (пересветы), Focus Assist (резкость), Grid (сетки), Frame Guide (рамка кадра), Safe Area (безопасная зона), False Color (экспозиция цветом) и Torch (фонарик). Нажмите на инструмент, чтобы выбрать его, а переключатель OFF/ON вверху включает или выключает выбранный.' },
    focus: { t: 'Фокус', d: 'Колесо фокуса: шкала 0.000 — минимальная дистанция (вплотную), 1.000 — бесконечность. AUTO — автофокус (камера сама наводится; тап по кадру выбирает точку). Внизу — точки фокуса для перевода фокуса (rack focus).', tip: 'Для интервью выключите AUTO, наведитесь на глаза и включите Focus Assist, чтобы проверить резкость.' },
    exposure: { t: 'Экспозиция', d: 'AUTO — полностью автоматическая экспозиция: выдержка и ISO подбираются сами (у них появляется «A»). Шкала −3…+3 — экспокоррекция: сделать кадр темнее или светлее относительно автоматики.' },
    rec: { t: 'Запись', d: 'Начать / остановить запись клипа. Во время записи таймкод красный, вокруг кадра красная рамка. Клип появляется во вкладке Media, номер дубля (Take) увеличивается.' },
    lensBtn: { t: 'Объектив и зум', d: 'То же колесо, что и LENS: выбор модуля 13/24/48/120 мм, фронтальной камеры и плавный зум. Подпись под кнопкой — текущее увеличение.' },
    lutBtn: { t: 'LUT', d: 'Панель LUT — «таблиц преобразования цвета». ON/OFF включает LUT на экране, список — выбор LUT (Rec 709 Neutral, Cinema Teal, Day Night, Dusty, Monochrome, Nature, Nostalgic, Paloma, Rift, Vivid, Warm Fade). Кнопка внизу — Record LUT to Clip: вшить LUT в запись.', tip: 'При съёмке в Apple Log включайте Rec 709 Neutral на экране, чтобы видеть нормальную картинку, но в файл LUT не вшивайте.' },
    stabBtn: { t: 'Стабилизация', d: 'Электронная стабилизация: Off, Standard, Cinematic, Extreme. Чем сильнее, тем меньше тряски, но тем сильнее кадр обрезается (кроп) и тем больше задержка изображения.' },
    /* навигация */
    navCamera: { t: 'Camera', d: 'Экран камеры: видоискатель и все органы управления.' },
    navMedia: { t: 'Media', d: 'Снятые клипы: просмотр, метаданные (сцена, дубль, параметры), удаление.' },
    navChat: { t: 'Chat', d: 'Чат с участниками проекта DaVinci Resolve через Blackmagic Cloud. Нужен вход в аккаунт.' },
    navSettings: { t: 'Settings', d: 'Все настройки приложения: запись, камера, медиа, звук, монитор, трансляция, функциональные кнопки, LUT, удалённое управление, пресеты.' },
    /* нижние панели */
    hist: { t: 'Гистограмма', d: 'Распределение яркостей кадра: слева — тени, справа — света, по каналам R, G, B. Если график «упирается» в правый край — есть пересвет, в левый — провалы в чёрное. Подпись — цветовое пространство записи. Нажмите — откроется большой осциллограф.', tip: 'Для Apple Log гистограмма сжата к середине — так и должно быть.' },
    storage: { t: 'Internal Storage — носитель', d: 'Сколько ещё можно записать (часы:минуты:секунды) с текущими настройками, процент и объём свободного места. Время меняется от кодека, разрешения и частоты кадров.' },
    meters: { t: 'Аудиометры', d: 'Уровень звука каналов в dBFS: 0 — предел, выше будет искажение (клиппинг). Речь записывают так, чтобы пики были около −12…−6 dBFS, а средний уровень около −18/−20. Нажмите — индикатор увеличится.' },
    leftHandle: { t: '⋮ левая панель', d: 'Быстрый доступ: Presets (пресеты настроек), Slate (метаданные клипа: сцена, дубль, катушка) и Remote Camera (удалённые камеры).' },
    rightHandle: { t: '⋮ правая панель', d: 'Программируемые кнопки F1, F2, F3. Функции назначаются в Settings → Function Buttons.' },
    image: { t: 'Видоискатель', d: 'Тап — точка автофокуса и автоэкспозиции (AE/AF). Свайп вверх/вниз — скрыть или показать надписи (HUD). Свайп вправо во время записи — затемнить экран.' },
    /* инструменты */
    zebra: { t: 'Zebra — зебра', d: 'Диагональная штриховка поверх участков ярче порога. Порог 75–100 %: при 95–100 % зебра показывает пересвеченные места. Кнопки Mid Grey и MG+1 включают зебру на средне-сером (18 %) и на стоп светлее — так проверяют экспозицию кожи.', tip: 'Если зебра на 95 % закрывает лицо или важную деталь — убавьте экспозицию.' },
    fa: { t: 'Focus Assist — фокус-ассист', d: 'Подсвечивает резкие края: всё, что в фокусе, обводится цветом (или «светится» в режиме Peaking). Шкала — чувствительность 0–100 %. Режим и цвет — в Settings → Monitor.' },
    grid: { t: 'Grid — сетки', d: 'Вспомогательные линии композиции: Thirds — правило третей, Horizon — линия горизонта, Crosshair — перекрестие в центре, Centre Dot — точка в центре. Можно включить несколько.' },
    fg: { t: 'Frame Guide — рамка кадра', d: 'Показывает границы другого соотношения сторон: 9:16 и 4:5 для соцсетей, 1:1, 4:3, 14:9, 1.85:1 и 2.39:1 для кино. Снаружи рамки кадр затемняется.', tip: 'Снимаете горизонтально, а публиковать будете в Reels? Включите 9:16 и держите героя внутри рамки.' },
    safe: { t: 'Safe Area — безопасная зона', d: 'Прямоугольник заданного процента от кадра (5–100 %). Внутрь стоит помещать титры и важные детали, чтобы их не обрезали экраны и интерфейсы соцсетей.' },
    falsecolor: { t: 'False Color — ложные цвета', d: 'Окрашивает кадр по яркости, чтобы точно читать экспозицию. Легенда слева: красный — пересвет, жёлтый — почти белое (95%WC), светлый — 80%WC, розовый — на стоп выше среднего (MG+1, светлая кожа), зелёный — средне-серый 18 % (MG), синий — почти чёрное (NBDL), фиолетовый — провал в чёрное (BDL).', tip: 'Лицо светлокожего человека при правильной экспозиции — розовое (MG+1), смуглого — зелёное.' },
    torch: { t: 'Torch — фонарик', d: 'Включает светодиод вспышки как постоянный свет. Шкала — яркость 0–100 %, AUTO — автоматически. Помогает на близкой дистанции в темноте, дальше 1–2 м почти бесполезен.' },
    /* колёса — общие кнопки */
    lock: { t: 'Замок', d: 'Фиксирует значение: автоматика его не меняет, а случайное касание не собьёт.' },
    auto: { t: 'AUTO', d: 'Автоматический режим. Синяя кнопка — автоматика включена; любое ручное значение её выключает.' },
    offspeed: { t: 'OFF/SPEED', d: 'Съёмка с частотой, отличной от частоты проекта. Например, проект 25 к/с, съёмка 100 к/с — при воспроизведении движение замедлится в 4 раза. Съёмка 12 к/с — ускорится в 2 раза.', tip: '100 и 120 к/с доступны только в HD.' },
    timelapseBtn: { t: 'TIME LAPSE', d: 'Включает интервальную съёмку (то же, что Settings → Record → Timelapse Recording). Интервал задаётся там же.' },
    zoomReset: { t: '↺ Сброс зума', d: 'Возвращает зум к 1x основного модуля.' },
    front: { t: 'Front — фронтальная камера', d: 'Переключение на фронтальную камеру (для съёмки себя). Она хуже основной по шуму и светосиле.' },
    rackFocus: { t: 'Точки фокуса', d: 'Сохраните до трёх дистанций фокуса и переводите фокус между ними плавно (rack focus) — например, с руки на лицо.' },
    recLutBtn: { t: 'Record LUT to Clip', d: 'Вшить выбранный LUT в записываемый клип. Подпись гистограммы сменится на «Rec.709».' },
    mgZebra: { t: 'Mid Grey / MG+1', d: 'Зебра не на пересветах, а на средне-сером (18 %) или на стоп светлее — для точной экспозиции лица.' },
    /* панели */
    presets: { t: 'Presets — пресеты', d: 'Сохранённые наборы настроек. + — сохранить текущие, ✓ — применить выбранный, ↻ — перезаписать его текущими, ✎ — переименовать, корзина — удалить.' },
    slate: { t: 'Slate — хлопушка', d: 'Метаданные следующего клипа: катушка (Reel), сцена (Scene), дубль (Take), интерьер/натура, день/ночь, отметка удачного дубля (Good Take Last Clip) для предыдущего клипа. На второй странице — название проекта, режиссёр, оператор. Всё это попадает в файл и потом видно в DaVinci Resolve.' },
    remoteCam: { t: 'Remote Camera', d: 'Переход к удалённым камерам. Неактивно, пока выключено Settings → Remote Camera Control.' },
    fbutton: { t: 'F1 / F2 / F3', d: 'Программируемые кнопки: каждая включает и выключает назначенную функцию одним нажатием. Назначение — Settings → Function Buttons.' }
  };
  /* =====================================================================
   *  СЦЕНА: векторное рисование мира в трёх слоях
   *   c — цвет поверхностей (как при нейтральном свете), d — глубина (диоптрии),
   *   x — излучающие объекты (небо, солнце, лампы) с яркостью выше белого
   *  Мир задан в «единицах 13 мм»: кадр сверхширокого модуля = 1600 × 900, центр (0,0).
   * ===================================================================== */
  var RW = 640, RH = 360, WORLD_W = 1600;
  var EMK = 14;        // во сколько раз излучающий слой ярче «белой» поверхности
  var CLIP = 1.25;     // насыщение сенсора
  var DMAX = 4;        // глубина кодируется 0..DMAX диоптрий (0 — бесконечность)

  function painter(ctx, mode) {
    function depthGrey(d) { var v = Math.round(255 * clamp((d > 0 ? 1 / d : 0) / DMAX, 0, 1)); return 'rgb(' + v + ',' + v + ',' + v + ')'; }
    function style(st) {
      if (mode === 'c') {
        if (st.g) { var gr = ctx.createLinearGradient(st.g[0], st.g[1], st.g[2], st.g[3]); st.g[4].forEach(function (s) { gr.addColorStop(s[0], s[1]); }); return gr; }
        if (st.rg) { var r = ctx.createRadialGradient(st.rg[0], st.rg[1], 0, st.rg[0], st.rg[1], st.rg[2]); st.rg[3].forEach(function (s) { r.addColorStop(s[0], s[1]); }); return r; }
        return st.c;
      }
      if (mode === 'd') {
        if (st.dg) { var g2 = ctx.createLinearGradient(0, st.dg[0], 0, st.dg[2]); g2.addColorStop(0, depthGrey(st.dg[1])); g2.addColorStop(1, depthGrey(st.dg[3])); return g2; }
        return depthGrey(st.d);
      }
      /* x */
      if (st.xg) { var g3 = ctx.createLinearGradient(st.xg[0], st.xg[1], st.xg[2], st.xg[3]); st.xg[4].forEach(function (s) { g3.addColorStop(s[0], s[1]); }); return g3; }
      if (st.xrg) { var r3 = ctx.createRadialGradient(st.xrg[0], st.xrg[1], 0, st.xrg[0], st.xrg[1], st.xrg[2]); st.xrg[3].forEach(function (s) { r3.addColorStop(s[0], s[1]); }); return r3; }
      return st.x || '#000';
    }
    function go(pathFn, st) {
      if (mode === 'd' && st.nod) return;
      if (mode === 'x' && st.glow && !st.xrg && !st.x) return;   // свечение только в цветовом слое
      if (mode === 'c' && st.xonly) return;
      ctx.save();
      if (st.a != null && (mode === 'c' || st.glow)) ctx.globalAlpha = st.a;
      if (mode === 'x' && st.xa != null) ctx.globalAlpha = st.xa;
      if (st.blend && mode !== 'd') ctx.globalCompositeOperation = st.blend;
      ctx.beginPath(); pathFn(ctx);
      if (st.stroke) { ctx.lineWidth = st.stroke; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = style(st); ctx.stroke(); }
      else { ctx.fillStyle = style(st); ctx.fill(); }
      ctx.restore();
    }
    return {
      mode: mode,
      rect: function (x, y, w, h, st) { go(function (k) { k.rect(x, y, w, h); }, st); },
      rr: function (x, y, w, h, r, st) { go(function (k) { if (k.roundRect) k.roundRect(x, y, w, h, r); else k.rect(x, y, w, h); }, st); },
      ell: function (cx, cy, rx, ry, st) { go(function (k) { k.ellipse(cx, cy, Math.abs(rx), Math.abs(ry), 0, 0, 6.2832); }, st); },
      poly: function (pts, st) { go(function (k) { k.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) k.lineTo(pts[i], pts[i + 1]); k.closePath(); }, st); },
      line: function (pts, w, st) { st.stroke = w; go(function (k) { k.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) k.lineTo(pts[i], pts[i + 1]); }, st); },
      path: function (fn, st) { go(fn, st); }
    };
  }

  /* ---------- Человек (общий для сцен) ---------- */
  function paintPerson(p, o) {
    /* o: x, y (центр головы), s (масштаб: единиц на метр), d (глубина), skin, shirt, hair, seated, t (время для мимики) */
    var s = o.s, x = o.x, y = o.y, d = o.d;
    var hw = 0.085 * s, hh = 0.115 * s;           // полуширина/полувысота головы
    var sh = { d: d };
    function S(c, extra) { var r = { c: c, d: d }; if (extra) for (var k in extra) r[k] = extra[k]; return r; }
    /* корпус */
    var shY = y + hh * 1.55, shW = 0.23 * s;
    var bodyH = o.seated ? 0.62 * s : 1.45 * s;
    p.path(function (k) {
      k.moveTo(x - shW * 0.55, shY - 0.04 * s);
      k.quadraticCurveTo(x - shW, shY, x - shW * 1.02, shY + 0.18 * s);
      k.lineTo(x - shW * 0.92, shY + bodyH * (o.seated ? 1 : 0.42));
      k.lineTo(x + shW * 0.92, shY + bodyH * (o.seated ? 1 : 0.42));
      k.lineTo(x + shW * 1.02, shY + 0.18 * s);
      k.quadraticCurveTo(x + shW, shY, x + shW * 0.55, shY - 0.04 * s);
      k.closePath();
    }, S(o.shirt));
    /* складки/свет на рубашке */
    p.path(function (k) { k.moveTo(x - shW * 0.95, shY + 0.2 * s); k.lineTo(x - shW * 0.55, shY + 0.02 * s); k.lineTo(x - shW * 0.35, shY + bodyH * 0.4); k.lineTo(x - shW * 0.9, shY + bodyH * 0.4); k.closePath(); }, S('rgba(0,0,0,0.18)', { nod: true, a: 1 }));
    /* воротник */
    p.poly([x - 0.06 * s, shY - 0.03 * s, x, shY + 0.08 * s, x + 0.06 * s, shY - 0.03 * s, x + 0.035 * s, shY - 0.05 * s, x, shY + 0.03 * s, x - 0.035 * s, shY - 0.05 * s], S(o.collar || '#e8e6e0'));
    if (!o.seated) {
      /* ноги */
      var hip = shY + bodyH * 0.42;
      p.rect(x - shW * 0.85, hip, shW * 0.8, bodyH * 0.58, S(o.pants || '#2b3442'));
      p.rect(x + shW * 0.05, hip, shW * 0.8, bodyH * 0.58, S(o.pants || '#2b3442'));
      p.rect(x - shW * 0.9, hip + bodyH * 0.56, shW * 0.9, 0.06 * s, S('#1a1a1a'));
      p.rect(x + shW * 0.02, hip + bodyH * 0.56, shW * 0.9, 0.06 * s, S('#1a1a1a'));
      /* руки */
      p.rr(x - shW * 1.18, shY + 0.05 * s, 0.085 * s, 0.6 * s, 0.04 * s, S(o.shirt));
      p.rr(x + shW * 1.18 - 0.085 * s, shY + 0.05 * s, 0.085 * s, 0.6 * s, 0.04 * s, S(o.shirt));
      p.ell(x - shW * 1.14, shY + 0.68 * s, 0.045 * s, 0.055 * s, S(o.skin));
      p.ell(x + shW * 1.14, shY + 0.68 * s, 0.045 * s, 0.055 * s, S(o.skin));
    } else {
      /* руки на столе, лёгкое движение кисти */
      var gx = Math.sin((o.t || 0) * 2.1) * 0.03 * s;
      p.rr(x - shW * 1.05, shY + 0.1 * s, 0.09 * s, 0.42 * s, 0.04 * s, S(o.shirt));
      p.rr(x + shW * 1.05 - 0.09 * s, shY + 0.1 * s, 0.09 * s, 0.42 * s, 0.04 * s, S(o.shirt));
      p.ell(x - shW * 0.7 + gx, shY + 0.55 * s, 0.06 * s, 0.045 * s, S(o.skin));
      p.ell(x + shW * 0.72, shY + 0.56 * s, 0.06 * s, 0.045 * s, S(o.skin));
    }
    /* шея */
    p.rect(x - 0.045 * s, y + hh * 0.7, 0.09 * s, 0.1 * s, S(o.skinD || o.skin));
    /* волосы сзади */
    p.ell(x, y - hh * 0.12, hw * 1.12, hh * 1.05, S(o.hair));
    /* лицо */
    p.ell(x, y, hw, hh, S(o.skin));
    /* тень на щеке (свет сбоку) */
    p.path(function (k) { k.ellipse(x + hw * 0.45, y + hh * 0.05, hw * 0.55, hh * 0.92, 0, -1.4, 1.4); k.closePath(); }, S(o.skinD || 'rgba(0,0,0,0.15)', { nod: true }));
    /* уши */
    p.ell(x - hw * 0.98, y + hh * 0.05, hw * 0.16, hh * 0.22, S(o.skin));
    p.ell(x + hw * 0.98, y + hh * 0.05, hw * 0.16, hh * 0.22, S(o.skinD || o.skin));
    /* чёлка */
    p.path(function (k) { k.ellipse(x, y - hh * 0.62, hw * 1.04, hh * 0.5, 0, Math.PI, 0); k.lineTo(x + hw * 0.9, y - hh * 0.35); k.quadraticCurveTo(x, y - hh * 0.62, x - hw * 0.95, y - hh * 0.3); k.closePath(); }, S(o.hair));
    /* брови, глаза, нос, рот — мелкие детали для фокуса */
    var ey = y - hh * 0.08, ex = hw * 0.4;
    var blink = ((o.t || 0) % 4.1) < 0.12;
    [-1, 1].forEach(function (sd) {
      p.line([x + sd * ex - hw * 0.2, ey - hh * 0.2, x + sd * ex + hw * 0.18, ey - hh * 0.23], 0.012 * s, S('#2a1c14'));
      if (blink) p.line([x + sd * ex - hw * 0.15, ey, x + sd * ex + hw * 0.15, ey], 0.008 * s, S('#3a2a20'));
      else { p.ell(x + sd * ex, ey, hw * 0.17, hh * 0.075, S('#f4f1ec')); p.ell(x + sd * ex, ey, hw * 0.075, hh * 0.07, S('#3b2a1e')); p.ell(x + sd * ex, ey, hw * 0.035, hh * 0.035, S('#080808')); p.ell(x + sd * ex + hw * 0.03, ey - hh * 0.025, hw * 0.02, hh * 0.018, S('#ffffff')); }
    });
    p.line([x + hw * 0.05, y + hh * 0.02, x + hw * 0.14, y + hh * 0.3, x - hw * 0.02, y + hh * 0.33], 0.009 * s, S(o.skinD || '#a87a60'));
    var talk = o.talk ? Math.abs(Math.sin((o.t || 0) * 9)) * 0.06 : 0;
    p.ell(x, y + hh * 0.55, hw * 0.3, hh * (0.05 + talk), S('#8e4a46'));
  }

  /* ---------- Сцена «улица» ---------- */
  function paintStreet(p, sc) {
    var night = sc.sky === 'night', sunset = sc.sky === 'sunset', over = sc.sky === 'overcast';
    var HOR = 40;   // линия горизонта (мировые единицы)
    /* небо */
    var skyStops = night ? [[0, '#05070f'], [0.6, '#0d1630'], [1, '#1d2a4a']] :
      sunset ? [[0, '#31406e'], [0.45, '#b9707a'], [0.8, '#f2a25c'], [1, '#ffd38a']] :
      over ? [[0, '#9aa3ad'], [1, '#c9ced3']] : [[0, '#3f7fd0'], [0.7, '#86b6e6'], [1, '#cfe3f3']];
    var skyX = night ? [[0, '#000'], [1, '#05070d']] : sunset ? [[0, '#1a2038'], [0.6, '#6e3c30'], [1, '#c48a40']] : over ? [[0, '#5a6066'], [1, '#7a8086']] : [[0, '#18324f'], [1, '#4a5e70']];
    p.rect(-1000, -600, 2000, 600 + HOR, { g: [0, -450, 0, HOR, skyStops], d: 0, xg: [0, -450, 0, HOR, skyX] });
    /* солнце */
    if (sc.sky === 'day') { p.ell(-560, -330, 26, 26, { c: '#fffbe8', d: 0, x: '#ffffff' }); p.ell(-560, -330, 160, 160, { rg: [-560, -330, 160, [[0, 'rgba(255,250,220,0.55)'], [1, 'rgba(255,250,220,0)']]], nod: true, glow: true }); }
    if (sunset) { p.ell(-380, HOR - 30, 34, 34, { c: '#fff1c4', d: 0, x: '#ffe2a0' }); p.ell(-380, HOR - 30, 300, 220, { rg: [-380, HOR - 30, 300, [[0, 'rgba(255,190,110,0.6)'], [1, 'rgba(255,170,90,0)']]], nod: true, glow: true, xrg: [-380, HOR - 30, 300, [[0, 'rgba(120,70,30,1)'], [1, 'rgba(0,0,0,0)']]] }); }
    if (night) { var R = rng(7); for (var i = 0; i < 60; i++) { var sx = -800 + R() * 1600, sy = -440 + R() * 380; p.ell(sx, sy, 1.2, 1.2, { c: '#dfe6ff', d: 0, x: '#9aa8d0', xa: 0.6 }); } p.ell(420, -320, 18, 18, { c: '#f2f0e6', d: 0, x: '#b0aea0' }); }
    /* облака */
    if (!night) { var R2 = rng(3); for (var j = 0; j < 7; j++) { var cx = -760 + j * 250 + R2() * 80, cy = -300 + R2() * 160; var cc = sunset ? '#f4b48a' : over ? '#d4d8dc' : '#f5f8fb', cxl = sunset ? '#7a4a30' : over ? '#6a7076' : '#6f7b88'; for (var q = 0; q < 4; q++) p.ell(cx + q * 34 - 50, cy + (q % 2) * 10, 60 - q * 6, 24, { c: cc, d: 0, x: cxl, a: over ? 0.7 : 0.85 }); } }
    /* дальние дома (60 м) */
    var R3 = rng(11), bx = -820;
    while (bx < 820) {
      var bw = 70 + R3() * 110, bh = 90 + R3() * 220, by = HOR - bh;
      var bcol = night ? '#151a26' : sunset ? ['#6b5a64', '#7d6060', '#5d5a70'][(R3() * 3) | 0] : ['#b7b2a8', '#c9bba2', '#9fa7ad', '#c4a58c', '#a3988c'][(R3() * 5) | 0];
      p.rect(bx, by, bw, bh, { c: bcol, d: 60 });
      for (var wy = by + 12; wy < HOR - 14; wy += 22) for (var wx = bx + 8; wx < bx + bw - 12; wx += 18) {
        var lit = night && R3() < 0.45;
        p.rect(wx, wy, 9, 12, { c: lit ? '#ffd59a' : night ? '#0b0e16' : sunset ? '#3a3040' : '#5d6874', d: 60, x: lit ? '#ffb860' : null, xa: lit ? 0.35 : 1 });
      }
      bx += bw + 6 + R3() * 20;
    }
    /* земля: тротуар и дорога — глубина по строкам */
    var G0 = HOR, G1 = 460;
    p.rect(-1000, G0, 2000, G1 - G0 + 200, { g: [0, G0, 0, G1, night ? [[0, '#1a1d24'], [1, '#2c2a2a']] : sunset ? [[0, '#6c5a58'], [1, '#8a6a58']] : [[0, '#8a8c8e'], [1, '#6e6a66']]], dg: [G0, 60, G1, 2.2] });
    p.rect(-1000, G0 + 30, 2000, 70, { c: night ? '#14161b' : sunset ? '#4a3c3e' : '#55585c', dg: [G0 + 30, 20, G0 + 100, 9] });
    for (var k2 = -9; k2 < 10; k2++) p.rect(k2 * 110, G0 + 62, 50, 5, { c: night ? '#5a5644' : '#e0dccc', d: 13 });
    /* бордюр */
    p.rect(-1000, G0 + 100, 2000, 8, { c: night ? '#2b2b2e' : '#b4b0a8', d: 8 });
    /* плитка тротуара (мелкие линии — для фокус-ассиста) */
    for (var ty = G0 + 120; ty < G1 + 100; ty += 26) p.line([-1000, ty, 1000, ty], 1.4, { c: 'rgba(0,0,0,0.25)', nod: true });
    /* деревья (20 м) */
    [-640, -250, 520].forEach(function (tx, n) {
      p.rect(tx - 7, HOR - 60, 14, 100, { c: night ? '#120e0c' : '#4a3a2c', d: 20 });
      var tc = night ? '#0c1410' : sunset ? '#4d5a3a' : over ? '#4f6a48' : '#3f7a3a';
      for (var b = 0; b < 6; b++) p.ell(tx + (b % 3 - 1) * 26, HOR - 110 + Math.floor(b / 3) * 34, 40, 34, { c: tc, d: 20 });
    });
    /* фонари (10 м) */
    [-470, 380].forEach(function (lx) {
      p.rect(lx - 3, HOR - 170, 6, 290, { c: night ? '#1c1e22' : '#3b3f45', d: 10 });
      p.rect(lx - 3, HOR - 172, 40, 6, { c: night ? '#1c1e22' : '#3b3f45', d: 10 });
      p.rr(lx + 26, HOR - 170, 22, 12, 4, { c: night ? '#ffe2a8' : '#cfd3d6', d: 10, x: night ? '#ffd28a' : null });
      if (night) {
        p.ell(lx + 37, HOR - 150, 120, 120, { rg: [lx + 37, HOR - 150, 120, [[0, 'rgba(255,190,110,0.55)'], [1, 'rgba(255,170,90,0)']]], glow: true, nod: true, xrg: [lx + 37, HOR - 150, 70, [[0, 'rgba(255,190,110,0.5)'], [1, 'rgba(0,0,0,0)']]] });
        p.ell(lx + 37, HOR + 170, 150, 40, { rg: [lx + 37, HOR + 170, 150, [[0, 'rgba(255,190,120,0.45)'], [1, 'rgba(255,170,90,0)']]], glow: true, nod: true });
      }
    });
    /* припаркованная машина (12 м) */
    var cx0 = 200, cy0 = G0 + 46;
    p.rr(cx0, cy0, 210, 48, 14, { c: night ? '#2a0f12' : '#a0262c', d: 12 });
    p.rr(cx0 + 40, cy0 - 36, 120, 44, 16, { c: night ? '#2a0f12' : '#8e2228', d: 12 });
    p.rr(cx0 + 52, cy0 - 30, 46, 30, 6, { c: night ? '#0a0c12' : '#2e3e52', d: 12 });
    p.rr(cx0 + 104, cy0 - 30, 46, 30, 6, { c: night ? '#0a0c12' : '#2e3e52', d: 12 });
    p.ell(cx0 + 45, cy0 + 48, 18, 18, { c: '#101010', d: 12 }); p.ell(cx0 + 165, cy0 + 48, 18, 18, { c: '#101010', d: 12 });
    p.rr(cx0 + 196, cy0 + 12, 12, 8, 3, { c: night ? '#ffe9c0' : '#f0eadc', d: 12, x: night ? '#ffeacc' : null });
    /* скамейка (6 м) */
    p.rect(-380, G0 + 160, 170, 10, { c: '#6a4a30', d: 6 }); p.rect(-380, G0 + 130, 170, 8, { c: '#6a4a30', d: 6 }); p.rect(-370, G0 + 170, 6, 26, { c: '#2a2a2a', d: 6 }); p.rect(-226, G0 + 170, 6, 26, { c: '#2a2a2a', d: 6 });
    /* человек — главный объект (4 м) */
    paintPerson(p, { x: 25, y: -12, s: 157, d: 4, skin: night ? '#c09078' : '#d9a68a', skinD: night ? '#8a6050' : '#b98068', shirt: night ? '#20345a' : '#2f6fb0', hair: '#3a2618', pants: '#2b3442', t: sc.t });
    /* растение на переднем плане слева (1 м) */
    for (var lf = 0; lf < 9; lf++) { var a = -1.2 + lf * 0.3; p.path(function (k) { k.moveTo(-720, 470); k.quadraticCurveTo(-720 + Math.cos(a) * 160, 470 + Math.sin(a) * 220 - 120, -720 + Math.cos(a) * 260, 470 + Math.sin(a) * 300 - 260); k.quadraticCurveTo(-700 + Math.cos(a) * 150, 470 + Math.sin(a) * 200 - 90, -700, 470); k.closePath(); }, { c: night ? '#0f1a12' : '#2f6b2a', d: 1 }); }
    p.rr(-790, 380, 150, 120, 10, { c: night ? '#20160f' : '#7a4a2a', d: 1 });
  }

  /* ---------- Сцена «комната» ---------- */
  function paintRoom(p, sc) {
    var tung = sc.lamp === 'tungsten', led = sc.lamp === 'led', win = sc.lamp === 'window';
    var wall = tung ? '#c9b49a' : led ? '#c5cbc7' : '#d4d0c8';
    /* задняя стена (3.5 м) */
    p.rect(-1000, -600, 2000, 1000, { c: wall, d: 3.5 });
    /* освещённость стены */
    if (tung) p.ell(-430, -60, 520, 420, { rg: [-430, -60, 520, [[0, 'rgba(255,236,200,0.55)'], [1, 'rgba(255,230,190,0)']]], nod: true, glow: true });
    if (win) p.ell(-560, -40, 700, 520, { rg: [-560, -40, 700, [[0, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]], nod: true, glow: true });
    p.rect(-1000, -600, 2000, 1000, { g: [0, -450, 0, 450, [[0, 'rgba(0,0,0,0.25)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.2)']]], nod: true, glow: true });
    /* потолочные LED-панели */
    if (led) [-520, -60, 400].forEach(function (lx) { p.rect(lx - 110, -470, 220, 34, { c: '#f4fff6', d: 3, x: '#eaffee' }); p.ell(lx, -430, 260, 110, { rg: [lx, -430, 260, [[0, 'rgba(235,255,240,0.5)'], [1, 'rgba(235,255,240,0)']]], glow: true, nod: true }); });
    /* окно */
    var wx = win ? -760 : 480, ww = win ? 360 : 230;
    p.rect(wx, -380, ww, 420, { c: tung ? '#141a2a' : '#cfe3f5', d: 40, x: tung ? '#02040a' : '#b8d4ee', xa: win ? 1 : 0.7 });
    if (!tung) { p.rect(wx + 20, -60, ww - 40, 100, { c: '#7aa06a', d: 40, x: '#4a6a40', xa: win ? 0.9 : 0.6 }); p.ell(wx + ww * 0.3, -110, 70, 60, { c: '#6a9a5a', d: 40, x: '#405a30', xa: 0.6 }); }
    p.rect(wx - 10, -390, ww + 20, 12, { c: '#ece8e0', d: 3.5 }); p.rect(wx - 10, 36, ww + 20, 14, { c: '#ece8e0', d: 3.5 });
    p.rect(wx + ww / 2 - 5, -380, 10, 420, { c: '#ece8e0', d: 3.5 }); p.rect(wx, -175, ww, 9, { c: '#ece8e0', d: 3.5 });
    if (win) p.rect(wx + ww + 10, -400, 60, 560, { c: '#e9e0d0', d: 3.3 });
    /* книжная полка (3.4 м) — мелкие детали */
    var shx = win ? 140 : -640, R = rng(21);
    for (var sh = 0; sh < 3; sh++) {
      var sy = -330 + sh * 120;
      p.rect(shx, sy + 92, 380, 10, { c: '#5a3d26', d: 3.4 });
      var bxx = shx + 6;
      while (bxx < shx + 370) {
        var bw = 10 + R() * 16, bh = 62 + R() * 28;
        p.rect(bxx, sy + 92 - bh, bw, bh, { c: ['#8a2c2c', '#2c4a7a', '#d6c08a', '#3a6a4a', '#6a4a7a', '#c86a3a', '#e8e2d2', '#202020'][(R() * 8) | 0], d: 3.4 });
        p.rect(bxx + 2, sy + 92 - bh + 8, bw - 4, 3, { c: 'rgba(255,255,255,0.5)', d: 3.4 });
        bxx += bw + 1.5;
      }
    }
    /* картина */
    var px0 = win ? 520 : -100;
    p.rect(px0, -360, 200, 140, { c: '#2a2420', d: 3.5 }); p.rect(px0 + 10, -350, 180, 120, { c: '#9ab0c0', d: 3.5 });
    p.poly([px0 + 10, -230, px0 + 70, -300, px0 + 120, -250, px0 + 150, -280, px0 + 190, -230], { c: '#4a6a5a', d: 3.5 });
    /* торшер с лампой накаливания */
    if (tung) {
      p.rect(-436, -130, 8, 560, { c: '#2a2420', d: 2.6 });
      p.poly([-500, -140, -364, -140, -390, -250, -474, -250], { c: '#f6dcb0', d: 2.6, x: '#ffb860', xa: 0.55 });
      p.ell(-432, -130, 50, 14, { c: '#fff2d0', d: 2.6, x: '#ffd8a0' });
      p.ell(-432, -190, 240, 220, { rg: [-432, -190, 240, [[0, 'rgba(255,200,130,0.5)'], [1, 'rgba(255,190,120,0)']]], glow: true, nod: true, xrg: [-432, -190, 120, [[0, 'rgba(255,170,90,0.35)'], [1, 'rgba(0,0,0,0)']]] });
    }
    /* пол */
    p.rect(-1000, 250, 2000, 400, { g: [0, 250, 0, 500, [[0, '#6a5240'], [1, '#4a382c']]], dg: [250, 3.4, 500, 1.4] });
    /* человек за столом (2 м) */
    paintPerson(p, { x: 10, y: -22, s: 314, d: 2, seated: true, talk: sc.speech, skin: '#d9a68a', skinD: '#b47a62', shirt: led ? '#5a6a7a' : '#7a3a3a', hair: '#2a1a10', collar: '#e8e4dc', t: sc.t });
    /* стол на переднем плане (1.2 м) */
    p.poly([-1000, 300, 1000, 300, 1000, 500, -1000, 500], { c: '#8a6440', d: 1.2 });
    p.rect(-1000, 296, 2000, 10, { c: '#a87c50', d: 1.3 });
    /* кружка и растение на столе (1 м) */
    p.rr(420, 200, 70, 96, 10, { c: '#e9e4da', d: 1.05 }); p.path(function (k) { k.arc(498, 240, 22, -1.4, 1.4); }, { c: '#e9e4da', d: 1.05, stroke: 9 });
    p.rr(-560, 220, 110, 80, 8, { c: '#b8643a', d: 1 });
    for (var lf = 0; lf < 7; lf++) { var a = -2.6 + lf * 0.35; p.ell(-505 + Math.cos(a) * 60, 210 + Math.sin(a) * 70, 22, 46, { c: '#3a7a3a', d: 1 }); }
  }

  /* бегун (рисуется отдельным спрайтом, мировые координаты относительно центра спрайта) */
  function paintRunner(p, s, phase, night) {
    var sk = night ? '#a07a66' : '#c98e6e', sh = night ? '#5a2020' : '#e0452a', pa = '#1f2a3a';
    var sw = Math.sin(phase) * 0.5;
    function L(a, b, c) { return { c: c, d: 9 }; }
    p.line([0, -0.35 * s, -0.25 * s * sw, 0.15 * s, -0.4 * s * sw, 0.55 * s], 0.11 * s, L(0, 0, pa));
    p.line([0, -0.35 * s, 0.25 * s * sw, 0.15 * s, 0.4 * s * sw, 0.55 * s], 0.11 * s, L(0, 0, pa));
    p.rr(-0.13 * s, -0.95 * s, 0.26 * s, 0.62 * s, 0.08 * s, L(0, 0, sh));
    p.line([0, -0.85 * s, 0.3 * s * sw, -0.55 * s, 0.45 * s * sw, -0.62 * s], 0.08 * s, L(0, 0, sk));
    p.line([0, -0.85 * s, -0.3 * s * sw, -0.55 * s, -0.42 * s * sw, -0.5 * s], 0.08 * s, L(0, 0, sk));
    p.ell(0, -1.1 * s, 0.1 * s, 0.12 * s, L(0, 0, sk));
    p.ell(-0.01 * s, -1.17 * s, 0.11 * s, 0.07 * s, L(0, 0, '#2a1a10'));
  }
  /* =====================================================================
   *  ДВИЖОК: построение кадра, экспозиция, фокус, обработка сигнала
   * ===================================================================== */
  var SENSOR_W = { uw: 5.6, w: 9.8, w2: 9.8, t: 4.8, f: 4.8 };   // ширина сенсора, мм (приближённо)
  var LEVELS = [0, 1, 2, 3.5, 6, 10];                             // радиусы размытия (px) для предрасчёта
  var OETF = new Uint8ClampedArray(4096);
  for (var oi = 0; oi < 4096; oi++) OETF[oi] = Math.round(255 * l2s(oi / 4095));
  var LIN8 = new Float32Array(256);
  for (var li = 0; li < 256; li++) LIN8[li] = s2l(li / 255);
  var NZN = 1 << 18, NZM = NZN - 1, NZ = new Float32Array(NZN);
  (function () { var R = rng(99); for (var i = 0; i < NZN; i += 2) { var u = Math.max(1e-7, R()), v = R(), m = Math.sqrt(-2 * Math.log(u)); NZ[i] = m * Math.cos(6.2831853 * v); NZ[i + 1] = m * Math.sin(6.2831853 * v); } })();
  /* таблицы для быстрого цикла: вход — линейный свет 0..2 (4096 шагов) */
  var T709 = new Float32Array(4096), T709H = new Float32Array(4096), TLOG = new Float32Array(4096), TSTOP = new Float32Array(4096), TIRE = new Float32Array(4096);
  for (var ti = 0; ti < 4096; ti++) { var tx = ti / 2048; T709[ti] = rec709(tx, false); T709H[ti] = rec709(tx, true); TLOG[ti] = appleLog(tx); TSTOP[ti] = Math.log2(Math.max(tx, 1e-5) / 0.18); TIRE[ti] = l2s(T709[ti]); }
  function ti2(x) { x = (x * 2048) | 0; return x < 0 ? 0 : x > 4095 ? 4095 : x; }
  function oe(x) { x = (x * 4095) | 0; return OETF[x < 0 ? 0 : x > 4095 ? 4095 : x] / 255; }
  var VIG = new Float32Array(RW * RH);
  (function () { var cx = RW / 2, cy = RH / 2, d = cx * cx + cy * cy; for (var y = 0; y < RH; y++) for (var x = 0; x < RW; x++) VIG[y * RW + x] = Math.pow(((x - cx) * (x - cx) + (y - cy) * (y - cy)) / d, 1.2); })();

  function boxesForGauss(sigma, n) {
    var wIdeal = Math.sqrt((12 * sigma * sigma / n) + 1), wl = Math.floor(wIdeal); if (wl % 2 === 0) wl--;
    var wu = wl + 2, m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4)), s = [];
    for (var i = 0; i < n; i++) s.push(i < m ? wl : wu); return s;
  }
  function blurPass(src, dst, w, h, r, horiz, ch) {
    var n = horiz ? w : h, lines = horiz ? h : w, step = horiz ? ch : w * ch, inv = 1 / (2 * r + 1);
    for (var L = 0; L < lines; L++) {
      var base = horiz ? L * w * ch : L * ch;
      for (var c = 0; c < ch; c++) {
        var b0 = base + c, acc = 0, k, kk;
        for (k = -r; k <= r; k++) { kk = k < 0 ? 0 : (k > n - 1 ? n - 1 : k); acc += src[b0 + kk * step]; }
        for (var i = 0; i < n; i++) {
          dst[b0 + i * step] = acc * inv;
          var add = i + r + 1; if (add > n - 1) add = n - 1;
          var rem = i - r; if (rem < 0) rem = 0;
          acc += src[b0 + add * step] - src[b0 + rem * step];
        }
      }
    }
  }
  function gaussBlur(buf, w, h, sigma, ch) {
    var a = new Float32Array(buf); if (sigma < 0.35) return a;
    var b = new Float32Array(buf.length), boxes = boxesForGauss(sigma, 3);
    for (var i = 0; i < 3; i++) { var r = (boxes[i] - 1) >> 1; if (r < 1) continue; blurPass(a, b, w, h, r, true, ch); blurPass(b, a, w, h, r, false, ch); }
    return a;
  }

  /* --- экспозиционная математика --- */
  function shutterTime(S) { var fpsE = S.offSpeed ? S.offFps : S.fps; return S.shutterMeas === 'angle' && !S.shAuto ? S.shAngle / 360 / fpsE : 1 / S.shDen; }
  function camEV(N, t, iso) { return Math.log2(N * N / t) - Math.log2(iso / 100); }
  function curFps(S) { return S.offSpeed ? S.offFps : S.fps; }
  function maxFpsFor(S) { return S.resolution === 'hd' || S.resolution === '720p' ? 120 : 60; }
  function focusToD(f) { return 10 * (1 - f); }           // значение шкалы фокуса → диоптрии
  function dToFocus(D) { return clamp(1 - D / 10, 0, 1); }

  function createEngine(S) {
    var cvs = { c: document.createElement('canvas'), d: document.createElement('canvas'), x: document.createElement('canvas') };
    for (var k in cvs) { cvs[k].width = RW; cvs[k].height = RH; }
    var N = RW * RH;
    var BASE = new Float32Array(N * 3), DEP = new Float32Array(N), levels = [], FOC = new Float32Array(N * 3), FRM = new Float32Array(N * 3);
    var avgLum = 0.18, sceneObj = null, view = null, runner = null, focusMixed = -1, cineMixed = null;
    var out = document.createElement('canvas'); out.width = RW; out.height = RH;
    var octx = out.getContext('2d'), img = octx.createImageData(RW, RH);
    var LUM = new Float32Array(N);       // яркость дисплейного сигнала (для пикинга)
    var hist = [new Uint32Array(64), new Uint32Array(64), new Uint32Array(64)];
    var wave = null;                     // данные осциллографа (по требованию)
    var stat = { clip: 0, black: 0, faceMean: 0, meanDisp: 0, flickerAmp: 0 };
    var eng = { out: out, hist: hist, stat: stat, wantWave: false, wave: null, gain: 1, sceneEV: 10, dirty: true };

    function lensBlurPx(D, Df) {
      var L = lensById(S.lens), f = L.f, sw = SENSOR_W[L.id], crop = (L.crop || 1) * (S.zoom / L.zoom);
      var px = RW * f * f / L.N / sw * Math.abs(D - Df) * 1e-3 * crop;
      if (S.cinematic) px += 9 * Math.abs(D - Df) * (D < Df ? 0.35 : 1);
      return Math.min(px, LEVELS[LEVELS.length - 1]);
    }

    /* --- построение слоёв сцены --- */
    function rebuild() {
      sceneObj = sceneById(S.scene);
      var L = lensById(S.lens);
      var eq = L.front ? 23 : L.eq * (S.zoom / L.zoom);
      var vw = WORLD_W * 13 / eq, sc = RW / vw;
      view = { vw: vw, sc: sc, eq: eq };
      ['c', 'd', 'x'].forEach(function (m) {
        var ctx = cvs[m].getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, RW, RH);
        ctx.setTransform(sc, 0, 0, sc, RW / 2, RH / 2);
        var p = painter(ctx, m), so = { sky: sceneObj.sky, lamp: sceneObj.lamp, speech: sceneObj.speech, t: 0 };
        if (sceneObj.kind === 'street') paintStreet(p, so); else paintRoom(p, so);
      });
      var dc = cvs.c.getContext('2d').getImageData(0, 0, RW, RH).data, dd = cvs.d.getContext('2d').getImageData(0, 0, RW, RH).data, dx = cvs.x.getContext('2d').getImageData(0, 0, RW, RH).data;
      /* свет сцены: цвет источника и зелёный сдвиг */
      var il = normLum([kRGB(sceneObj.K)[0] / kRGB(5600)[0], kRGB(sceneObj.K)[1] / kRGB(5600)[1], kRGB(sceneObj.K)[2] / kRGB(5600)[2]]);
      il[1] *= 1 + sceneObj.tint * 0.006;
      /* фонарик: свет ~1/d², сравнимый со сценой EV 5 на 1 м */
      var torch = S.torch ? (S.torchAuto ? 0.6 : S.torchLvl / 100) * Math.pow(2, 6 - sceneObj.ev) : 0;
      var tc = normLum([1, 0.97, 0.93]);
      var distort = L.id === 'uw' && !S.lensCorr;
      var sum = 0, cnt = 0;
      for (var y = 0; y < RH; y++) for (var x = 0; x < RW; x++) {
        var sx = x, sy = y;
        if (distort) { /* бочкообразная дисторсия */
          var nx = (x - RW / 2) / (RW / 2), ny = (y - RH / 2) / (RW / 2), r2 = nx * nx + ny * ny, f = 1 - 0.22 * r2 + 0.05 * r2 * r2;
          sx = Math.round(RW / 2 + nx * f * (RW / 2) * 1.0); sy = Math.round(RH / 2 + ny * f * (RW / 2));
          if (sx < 0 || sy < 0 || sx >= RW || sy >= RH) { var q0 = y * RW + x; BASE[q0 * 3] = BASE[q0 * 3 + 1] = BASE[q0 * 3 + 2] = 0; DEP[q0] = 0; continue; }
        }
        var si = (sy * RW + sx) * 4, q = y * RW + x, D = dd[si] / 255 * DMAX;
        DEP[q] = D;
        var tk = torch > 0 ? torch * D * D : 0;
        for (var ch = 0; ch < 3; ch++) {
          var v = LIN8[dc[si + ch]] * (il[ch] + tk * tc[ch]) + LIN8[dx[si + ch]] * EMK;
          BASE[q * 3 + ch] = v;
        }
        if ((x & 3) === 0 && (y & 3) === 0) { var lm = 0.2126 * BASE[q * 3] + 0.7152 * BASE[q * 3 + 1] + 0.0722 * BASE[q * 3 + 2], wgt = 1.6 - VIG[q]; sum += Math.min(lm, 0.9) * wgt; cnt += wgt; }
      }
      avgLum = sum / cnt;
      levels = LEVELS.map(function (r) { return gaussBlur(BASE, RW, RH, r * 0.6, 3); });
      focusMixed = -1;
      buildRunner();
      eng.sceneEV = sceneObj.ev;
      eng.dirty = false;
    }

    /* --- смешивание уровней размытия по глубине (фокус) --- */
    function mixFocus() {
      var Df = focusToD(S.focus);
      if (Math.abs(Df - focusMixed) < 1e-4 && cineMixed === S.cinematic) return;
      focusMixed = Df; cineMixed = S.cinematic;
      var maxL = LEVELS.length - 1;
      for (var i = 0; i < N; i++) {
        var rr = lensBlurPx(DEP[i], Df), l = 0;
        while (l < maxL - 1 && LEVELS[l + 1] < rr) l++;
        var t = clamp((rr - LEVELS[l]) / (LEVELS[l + 1] - LEVELS[l]), 0, 1), A = levels[l], B = levels[l + 1], j = i * 3;
        FOC[j] = A[j] + (B[j] - A[j]) * t; FOC[j + 1] = A[j + 1] + (B[j + 1] - A[j + 1]) * t; FOC[j + 2] = A[j + 2] + (B[j + 2] - A[j + 2]) * t;
      }
    }

    /* --- бегун: 8 фаз спрайта в линейном RGBA --- */
    function buildRunner() {
      runner = null;
      if (!sceneObj.runner) return;
      var sc = view.sc, unitsPerM = 157 * 4 / 9, s = unitsPerM;
      var wpx = Math.ceil(1.1 * s * sc) + 4, hpx = Math.ceil(1.45 * s * sc) + 4;
      if (wpx > 900 || hpx > 900) { wpx = Math.min(wpx, 900); hpx = Math.min(hpx, 900); }
      var frames = [], c = document.createElement('canvas'); c.width = wpx; c.height = hpx;
      var ctx = c.getContext('2d');
      var night = sceneObj.sky === 'night';
      var il = normLum([kRGB(sceneObj.K)[0] / kRGB(5600)[0], kRGB(sceneObj.K)[1] / kRGB(5600)[1], kRGB(sceneObj.K)[2] / kRGB(5600)[2]]);
      for (var f = 0; f < 8; f++) {
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, wpx, hpx);
        ctx.setTransform(sc, 0, 0, sc, wpx / 2, hpx - 2 - 0.55 * s * sc);
        paintRunner(painter(ctx, 'c'), s, f / 8 * 6.2832, night);
        var d = ctx.getImageData(0, 0, wpx, hpx).data, a = new Float32Array(wpx * hpx * 4);
        for (var i = 0, n = wpx * hpx; i < n; i++) { var al = d[i * 4 + 3] / 255; a[i * 4] = LIN8[d[i * 4]] * il[0] * al; a[i * 4 + 1] = LIN8[d[i * 4 + 1]] * il[1] * al; a[i * 4 + 2] = LIN8[d[i * 4 + 2]] * il[2] * al; a[i * 4 + 3] = al; }
        frames.push(a);
      }
      runner = { frames: frames, w: wpx, h: hpx, footY: 130.6, s: s, speed: 4 * s, D: 1 / 9 };
    }

    function compositeRunner(time, tExp) {
      FRM.set(FOC);
      if (!runner) return;
      var sc = view.sc, period = (1900 / runner.speed) + 1.5, tt = time % period, wx = -950 + runner.speed * tt;
      var cx = RW / 2 + wx * sc, footPx = RH / 2 + runner.footY * sc;
      var x0 = Math.round(cx - runner.w / 2), y0 = Math.round(footPx - runner.h + 2 + 0.55 * runner.s * sc);
      if (x0 > RW || x0 + runner.w < 0) return;
      var blur = runner.speed * sc * tExp;                     // смаз движения в пикселях за время выдержки
      var n = Math.max(1, Math.min(24, Math.ceil(blur / 1.2)));
      var phase = ((time * 2.6) % 1) * 8 | 0, fr = runner.frames[phase];
      var defoc = lensBlurPx(runner.D, focusToD(S.focus));
      var bw = runner.w + Math.ceil(blur) + 1, acc = new Float32Array(bw * runner.h * 4), inv = 1 / n;
      for (var s = 0; s < n; s++) {
        var off = Math.round(blur * (n === 1 ? 0 : s / (n - 1)));
        for (var yy = 0; yy < runner.h; yy++) {
          var sr = yy * runner.w * 4, dr = (yy * bw + off) * 4;
          for (var xx = 0; xx < runner.w * 4; xx++) acc[dr + xx] += fr[sr + xx] * inv;
        }
      }
      if (defoc > 0.8) { var bl = gaussBlur(acc, bw, runner.h, defoc * 0.6, 4); acc = bl; }
      x0 -= Math.round(blur);
      for (yy = 0; yy < runner.h; yy++) {
        var Y = y0 + yy; if (Y < 0 || Y >= RH) continue;
        for (xx = 0; xx < bw; xx++) {
          var X = x0 + xx; if (X < 0 || X >= RW) continue;
          var k = (yy * bw + xx) * 4, a = acc[k + 3]; if (a < 0.003) continue;
          var p = Y * RW + X; if (DEP[p] > runner.D + 0.02) continue;   // объект ближе бегуна — перекрывает
          var j = p * 3, ia = 1 - a;
          FRM[j] = acc[k] + ia * FRM[j]; FRM[j + 1] = acc[k + 1] + ia * FRM[j + 1]; FRM[j + 2] = acc[k + 2] + ia * FRM[j + 2];
        }
      }
    }

    /* --- автоматика: экспозиция, фокус, баланс белого --- */
    var shake = { x: 0, y: 0, vx: 0, vy: 0 };
    function spotLum(px, py) {
      var s = 0, c = 0, x0 = Math.round(px * RW), y0 = Math.round(py * RH);
      for (var y = y0 - 14; y <= y0 + 14; y += 2) for (var x = x0 - 14; x <= x0 + 14; x += 2) {
        if (x < 0 || y < 0 || x >= RW || y >= RH) continue; var j = (y * RW + x) * 3;
        s += Math.min(0.9, 0.2126 * FOC[j] + 0.7152 * FOC[j + 1] + 0.0722 * FOC[j + 2]); c++;
      }
      return c ? s / c : avgLum;
    }
    function depthAt(px, py) {
      var x0 = Math.round(px * RW), y0 = Math.round(py * RH), best = 0;
      for (var y = y0 - 6; y <= y0 + 6; y += 2) for (var x = x0 - 6; x <= x0 + 6; x += 2) { if (x < 0 || y < 0 || x >= RW || y >= RH) continue; best = Math.max(best, DEP[y * RW + x]); }
      return best;
    }
    function autoAdjust(dt) {
      var L = lensById(S.lens), fpsE = curFps(S);
      var k = 1 - Math.exp(-dt * 4);
      /* фокус */
      if (S.afAuto) {
        var pt = S.tap || { x: 0.5, y: 0.45 }, Dt = depthAt(pt.x, pt.y);
        var tgt = dToFocus(Math.min(Dt, 10 / 1 * 0.99));
        tgt = Math.max(tgt, 1 - (1 / L.minFocus) / 10);
        S.focus += (tgt - S.focus) * (1 - Math.exp(-dt * 6));
      }
      /* экспозиция */
      if ((S.shAuto && !S.shLock) || (S.isoAuto && !S.isoLock)) {
        var meas = S.tap ? spotLum(S.tap.x, S.tap.y) : avgLum;
        var wantEV = sceneObj.ev - Math.log2(0.18 / Math.max(meas, 1e-4)) - S.ev;   // нужный EV камеры
        var N2 = Math.log2(L.N * L.N), iso = S.iso, den = 1 / shutterTime(S);
        var autoSh = S.shAuto && !S.shLock, autoIso = S.isoAuto && !S.isoLock;
        if (autoSh && autoIso) {
          var d180 = 2 * fpsE;
          iso = L.isoMin; den = Math.pow(2, wantEV - N2 + Math.log2(iso / 100));
          if (den < d180) { den = d180; iso = 100 * Math.pow(2, N2 + Math.log2(den) - wantEV); if (iso > L.isoMax) { iso = L.isoMax; den = Math.max(fpsE, Math.pow(2, wantEV - N2 + Math.log2(iso / 100))); } }
          if (den > 8000) den = 8000;
        } else if (autoSh) {
          den = clamp(Math.pow(2, wantEV - N2 + Math.log2(iso / 100)), fpsE, 8000);
        } else if (autoIso) {
          iso = clamp(100 * Math.pow(2, N2 + Math.log2(den) - wantEV), L.isoMin, L.isoMax);
        }
        if (autoSh) { var cur = Math.log2(S.shDen); S.shDen = Math.pow(2, cur + (Math.log2(den) - cur) * k); }
        if (autoIso) { var ci = Math.log2(S.iso); S.iso = Math.pow(2, ci + (Math.log2(iso) - ci) * k); }
      }
      S.iso = clamp(S.iso, L.isoMin, L.isoMax);
      /* баланс белого */
      if (S.wbAuto && !S.wbLock && !(S.recording && S.lockWbRec)) {
        var estK = sceneObj.K + (5600 - sceneObj.K) * 0.18;
        S.wbK += (estK - S.wbK) * (1 - Math.exp(-dt * 2));
      }
      if (S.tintAuto && !S.tintLock && !(S.recording && S.lockWbRec)) S.tint += (sceneObj.tint * 0.8 - S.tint) * (1 - Math.exp(-dt * 2));
      /* дрожание рук и стабилизация */
      var amp = (S.stab === 'off' ? 1 : S.stab === 'standard' ? 0.35 : S.stab === 'cinematic' ? 0.14 : 0.05) * 2.2 * Math.pow(view.eq / 24, 0.75);
      shake.vx += (Math.random() - 0.5) * 2 * dt * 30 - shake.x * dt * 6; shake.vy += (Math.random() - 0.5) * 2 * dt * 30 - shake.y * dt * 6;
      shake.vx *= 0.9; shake.vy *= 0.9; shake.x += shake.vx * dt * 3; shake.y += shake.vy * dt * 3;
      eng.shake = { x: clamp(shake.x, -1, 1) * amp, y: clamp(shake.y, -1, 1) * amp };
    }

    /* --- главный проход: экспозиция → шум → клиппинг → баланс белого → гамма/Log → LUT → инструменты --- */
    var frameNo = 0;
    function process(time) {
      var L = lensById(S.lens), t = shutterTime(S), fpsE = curFps(S);
      var cev = camEV(L.N, t, S.iso), gain = Math.pow(2, sceneObj.ev - cev);
      eng.gain = gain; eng.camEV = cev;
      eng.expStops = Math.log2(Math.max(gain * avgLum, 1e-6) / 0.18);   // отклонение от «нормы» замера (средняя яркость = 18 %)
      compositeRunner(time, t);
      /* баланс белого камеры + TINT */
      var gref = kRGB(5600), gk = kRGB(S.wbK), wb = normLum([gref[0] / gk[0], gref[1] / gk[1], gref[2] / gk[2]]);
      wb[1] *= 1 - S.tint * 0.006;
      /* мерцание ламп (100 Гц) */
      var flAmp = 0, flPh = 0, nb = 1.7;
      if (sceneObj.flicker > 0) {
        var x = Math.PI * 100 * t, res = Math.abs(Math.sin(x) / x);
        flAmp = sceneObj.flicker * res;
        var fi = Math.floor(time * fpsE); flPh = (fi * 100 / fpsE) % 1;
      }
      stat.flickerAmp = flAmp;
      var iso = S.iso, ig = iso / 100 * L.noise * 1.5, na = 0.00004 * ig, nb2 = Math.pow(0.00025 * ig, 2);
      var noff = (Math.random() * NZN) | 0, o = img.data;
      var log = S.colorspace === 'applelog', recLut = S.recLut && S.lutOn, dispLut = S.lutOn, lutFn = lutById(S.lut).fn;
      var hdr = S.hdr && S.colorspace !== 'rec709', satK = S.colorspace === 'p3' ? 1.08 : S.colorspace === 'rec2020' ? 1.12 : 1;
      var zeb = S.zebra, zl = S.zebraLvl / 100, zm = S.zebraMode, fc = S.falseColor, ph8 = (frameNo >> 1) & 7;
      var clipN = 0, blackN = 0, sumD = 0, cnt = 0;
      hist[0].fill(0); hist[1].fill(0); hist[2].fill(0);
      var wantWave = eng.wantWave; if (wantWave) { wave = { r: new Uint16Array(160 * 64), g: new Uint16Array(160 * 64), b: new Uint16Array(160 * 64), y: new Uint16Array(160 * 64) }; }
      var vk = 0.28;
      for (var yy = 0, i = 0; yy < RH; yy++) {
        var rowK = 1 - flAmp * 0.5 * (1 + Math.sin(6.2832 * (yy / RH * nb + flPh)));
        for (var xx = 0; xx < RW; xx++, i++) {
          var j = i * 3, v = (1 - vk * VIG[i]) * gain * rowK;
          var R = FRM[j] * v, G = FRM[j + 1] * v, B = FRM[j + 2] * v;
          var lum = 0.2126 * R + 0.7152 * G + 0.0722 * B; if (lum < 0) lum = 0;
          var sg = Math.sqrt(na * lum + nb2), kk = (i + noff) & NZM, n0 = NZ[kk], n1 = NZ[(kk + 9973) & NZM], n2 = NZ[(kk + 31337) & NZM];
          R += sg * (n0 + 0.5 * n1); G += sg * (n0 - 0.2 * n1 - 0.2 * n2); B += sg * 1.25 * (n0 + 0.6 * n2);
          var clipped = R >= CLIP || G >= CLIP || B >= CLIP;
          if (R > CLIP) R = CLIP; if (G > CLIP) G = CLIP; if (B > CLIP) B = CLIP;
          R *= wb[0]; G *= wb[1]; B *= wb[2];
          if (R < 0) R = 0; if (G < 0) G = 0; if (B < 0) B = 0;
          var Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
          /* записываемый сигнал (коды 0..1) */
          var rr, gg, bb, dr, dg, db, TT = hdr ? T709H : T709;
          var t709r = TT[ti2(R)], t709g = TT[ti2(G)], t709b = TT[ti2(B)];
          if (satK !== 1) { var cy = 0.2126 * t709r + 0.7152 * t709g + 0.0722 * t709b; t709r = clamp(cy + (t709r - cy) * satK, 0, 1); t709g = clamp(cy + (t709g - cy) * satK, 0, 1); t709b = clamp(cy + (t709b - cy) * satK, 0, 1); }
          if (recLut) { var lr = lutFn(t709r, t709g, t709b); rr = oe(lr[0]); gg = oe(lr[1]); bb = oe(lr[2]); }
          else if (log) { rr = TLOG[ti2(R)]; gg = TLOG[ti2(G)]; bb = TLOG[ti2(B)]; }
          else { rr = oe(t709r); gg = oe(t709g); bb = oe(t709b); }
          if (dispLut && !recLut) { var ld = lutFn(t709r, t709g, t709b); dr = oe(ld[0]); dg = oe(ld[1]); db = oe(ld[2]); }
          else { dr = rr; dg = gg; db = bb; }
          /* гистограмма и осциллограф — по записываемому сигналу */
          if (!(xx & 1) && !(yy & 1)) {
            hist[0][(rr * 63.99) | 0]++; hist[1][(gg * 63.99) | 0]++; hist[2][(bb * 63.99) | 0]++;
            if (clipped) clipN++; if (Y < 0.004) blackN++; cnt++;
          }
          if (wantWave && !(xx & 3) && !(yy & 1)) { var col = xx >> 2; wave.r[col * 64 + ((rr * 63.99) | 0)]++; wave.g[col * 64 + ((gg * 63.99) | 0)]++; wave.b[col * 64 + ((bb * 63.99) | 0)]++; wave.y[col * 64 + (((0.2126 * rr + 0.7152 * gg + 0.0722 * bb) * 63.99) | 0)]++; }
          /* «IRE» для зебры и false color — по Rec.709 сцены */
          var yi = ti2(Y), ire = TIRE[yi], st = TSTOP[yi];
          sumD += ire;
          if (fc) {
            var c = null;
            if (clipped) c = [255, 0, 0]; else if (ire >= 0.93) c = [255, 230, 0]; else if (ire >= 0.78 && ire < 0.83) c = [235, 235, 210];
            else if (st >= 0.75 && st < 1.25) c = [255, 150, 200]; else if (st >= -0.25 && st < 0.25) c = [40, 210, 60];
            else if (ire < 0.025) c = [120, 30, 170]; else if (ire < 0.07) c = [30, 70, 230];
            if (c) { dr = c[0] / 255; dg = c[1] / 255; db = c[2] / 255; } else { var gy = 0.2126 * dr + 0.7152 * dg + 0.0722 * db; dr = dg = db = gy * 0.8; }
          }
          if (zeb) {
            var hit = zm === 'mg' ? (st >= -0.2 && st < 0.2) : zm === 'mg1' ? (st >= 0.8 && st < 1.2) : ire >= zl;
            if (hit && ((xx + yy + ph8) & 7) < 3) { dr = dg = db = zm === 'level' ? 0.08 : 0.95; }
          }
          var q = i * 4;
          o[q] = dr * 255; o[q + 1] = dg * 255; o[q + 2] = db * 255; o[q + 3] = 255;
          LUM[i] = 0.2126 * dr + 0.7152 * dg + 0.0722 * db;
        }
      }
      /* фокус-ассист */
      if (S.fa) {
        var thr = lerp(0.42, 0.06, S.faLvl / 100), col2 = { white: [255, 255, 255], black: [0, 0, 0], red: [255, 40, 40], green: [40, 255, 60], blue: [60, 120, 255] }[S.faColor];
        for (var y2 = 1; y2 < RH - 1; y2++) for (var x2 = 1; x2 < RW - 1; x2++) {
          var p2 = y2 * RW + x2, e = Math.abs(LUM[p2 + 1] - LUM[p2 - 1]) + Math.abs(LUM[p2 + RW] - LUM[p2 - RW]);
          if (e > thr) { var q2 = p2 * 4; if (S.faMode === 'lines') { o[q2] = col2[0]; o[q2 + 1] = col2[1]; o[q2 + 2] = col2[2]; } else { o[q2] = Math.min(255, o[q2] + 120); o[q2 + 1] = Math.min(255, o[q2 + 1] + 120); o[q2 + 2] = Math.min(255, o[q2 + 2] + 120); } }
        }
      }
      octx.putImageData(img, 0, 0);
      stat.clip = clipN / cnt; stat.black = blackN / cnt; stat.meanDisp = sumD / N;
      eng.wave = wantWave ? wave : null;
      frameNo++;
    }

    function measureFace() {
      /* средняя «IRE» в районе лица героя (для заданий): центр кадра выше середины */
      var face = sceneObj.kind === 'street' ? { x: 25, y: -12 } : { x: 10, y: -22 };
      var px = RW / 2 + face.x * view.sc, py = RH / 2 + face.y * view.sc;
      var r = Math.max(2, Math.round((sceneObj.kind === 'street' ? 0.06 * 157 : 0.06 * 314) * view.sc)), s = 0, c = 0, d = img.data;
      for (var y = Math.round(py - r); y <= py + r; y++) for (var x = Math.round(px - r); x <= px + r; x++) {
        if (x < 0 || y < 0 || x >= RW || y >= RH) continue;
        var i = y * RW + x; s += LUM[i]; c++;
      }
      return { ire: c ? s / c : 0, visible: c > 4, px: px / RW, py: py / RH, depth: sceneObj.kind === 'street' ? 4 : 2 };
    }

    eng.rebuild = rebuild;
    eng.frame = function (time, dt) {
      if (eng.dirty || !sceneObj) rebuild();
      autoAdjust(dt);
      mixFocus();
      process(time);
    };
    eng.view = function () { return view; };
    eng.scene = function () { return sceneObj; };
    eng.measureFace = measureFace;
    eng.depthAt = depthAt;
    return eng;
  }
  /* ---------- Иконки (SVG 24×24, линия currentColor) ---------- */
  function svg(body, extra) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"' + (extra || '') + '>' + body + '</svg>'; }
  var IC = {
    camTab: svg('<rect x="2.5" y="6.5" width="13" height="11" rx="2.2"/><path d="M15.5 10.5l5-3v9l-5-3"/><circle cx="6" cy="10" r="1.1" fill="currentColor"/><path d="M5 14.5h3"/>'),
    media: svg('<rect x="3" y="5" width="18" height="14" rx="1.6"/><path d="M6 5v14M18 5v14"/><path d="M10.5 9.5l4 2.5-4 2.5z" fill="currentColor"/>'),
    chat: svg('<path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5h-7l-3.5 3v-3H4A1.5 1.5 0 0 1 2.5 15.5V7A1.5 1.5 0 0 1 4 5.5z"/><circle cx="8.5" cy="11.3" r=".9" fill="currentColor"/><circle cx="12" cy="11.3" r=".9" fill="currentColor"/><circle cx="15.5" cy="11.3" r=".9" fill="currentColor"/>'),
    gear: svg('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.8l1.6 2.3 2.7-.7.6 2.7 2.6 1-.9 2.6 1.9 2-1.9 2 .9 2.6-2.6 1-.6 2.7-2.7-.7L12 21.2l-1.6-2.3-2.7.7-.6-2.7-2.6-1 .9-2.6L3.5 11.3l1.9-2-.9-2.6 2.6-1 .6-2.7 2.7.7z"/>'),
    frame: svg('<path d="M4 9V6a2 2 0 0 1 2-2h3M15 4h3a2 2 0 0 1 2 2v3M20 15v3a2 2 0 0 1-2 2h-3M9 20H6a2 2 0 0 1-2-2v-3"/>'),
    focus: svg('<path d="M3 8.5V7a2 2 0 0 1 2-2h1.5M14.5 5H16a2 2 0 0 1 2 2v1.5M18 15.5V17a2 2 0 0 1-2 2h-1.5M6.5 19H5a2 2 0 0 1-2-2v-1.5"/><circle cx="10.5" cy="12" r="2.6"/>'),
    expo: svg('<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><path d="M20.5 3.5L3.5 20.5" /><path d="M7 8.5h4M9 6.5v4M13.5 16h4"/><path d="M20.5 3.5L3.5 20.5V17a3.5 3.5 0 0 1 0 0" fill="currentColor" opacity=".0"/>'),
    lens: svg('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.6" fill="currentColor" opacity=".35"/><circle cx="10.3" cy="10.3" r="1.2" fill="currentColor"/>'),
    lut: '<svg viewBox="0 0 30 24"><rect x="2" y="3.5" width="25" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="4" y="18.5" width="22" height="2.5" rx="1" fill="currentColor" opacity=".5"/><text x="14.5" y="15.3" text-anchor="middle" font-size="9" font-weight="700" fill="currentColor" font-family="Arial,sans-serif">LUT</text></svg>',
    stab: svg('<path d="M7 7.5V6.5a1.5 1.5 0 0 1 1.5-1.5h1M14.5 5h1A1.5 1.5 0 0 1 17 6.5v1M17 16.5v1a1.5 1.5 0 0 1-1.5 1.5h-1M9.5 19h-1A1.5 1.5 0 0 1 7 17.5v-1"/><circle cx="12" cy="12" r="2.6"/><path d="M2.5 12h2.5M19 12h2.5"/><circle cx="12" cy="22" r=".6" fill="currentColor"/>'),
    zebra: svg('<circle cx="12" cy="12" r="8"/><path d="M6.5 17.5l11-11M5 13.5l8.5-8.5M10.5 19l8.5-8.5M8 15l7-7" />'),
    faPerson: svg('<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="10" r="2.4"/><path d="M8 16.5c.8-2 2.2-3 4-3s3.2 1 4 3"/>'),
    grid: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16M3 9.3h18M3 14.7h18"/>'),
    fguide: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 8.5h18M3 15.5h18"/>'),
    safe: svg('<rect x="3" y="4.5" width="18" height="15" rx="2"/><rect x="6.5" y="7.5" width="11" height="9" rx="1"/><path d="M6.5 7.5L3 4.5M17.5 7.5L21 4.5M6.5 16.5L3 19.5M17.5 16.5L21 19.5"/>'),
    falsecolor: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9c3-2 5 2 9 0s6-2 9 0M3 14c3-2 5 2 9 0s6-2 9 0"/>'),
    torch: svg('<path d="M13.5 2.5L6 13.5h5l-1.5 8 7.5-11h-5z" fill="currentColor" stroke="none"/>'),
    lock: svg('<rect x="5.5" y="10.5" width="13" height="10" rx="2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/>'),
    unlock: svg('<rect x="5.5" y="10.5" width="13" height="10" rx="2"/><path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 6.8-1.2"/>'),
    reset: svg('<path d="M5 12a7 7 0 1 0 2.1-5"/><path d="M5 4.5V8h3.5"/>'),
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>'),
    bulb: svg('<path d="M9 17.5h6M10 20.5h4M8.2 14.5a5.5 5.5 0 1 1 7.6 0c-.8.8-1.3 1.8-1.3 3h-5c0-1.2-.5-2.2-1.3-3z"/><path d="M12 2v-1M4 9H3M21 9h-1M5.5 3.5l.8.8M18.5 3.5l-.8.8"/>'),
    fluo: svg('<rect x="3" y="9.5" width="18" height="5" rx="2.5"/><path d="M12 3v3M5.5 5l1.5 2.5M18.5 5L17 7.5M12 21v-3M5.5 19l1.5-2.5M18.5 19L17 16.5"/>'),
    shade: svg('<path d="M3.5 19.5V10l6.5-5.5 6.5 5.5v9.5z"/><path d="M12 19.5l8.5-8.5M15 19.5l5.5-5.5M18 19.5l2.5-2.5"/>'),
    cloud: svg('<path d="M7 18.5a4.5 4.5 0 0 1-.6-9 5.5 5.5 0 0 1 10.6 1.5 3.8 3.8 0 0 1 .5 7.5z"/>'),
    presets: svg('<rect x="4" y="3" width="9" height="18" rx="2"/><rect x="12" y="7.5" width="9" height="5" rx="2.5"/><circle cx="18.5" cy="10" r="1.6" fill="currentColor"/><rect x="12" y="14" width="9" height="5" rx="2.5"/><circle cx="14.5" cy="16.5" r="1.6" fill="currentColor"/>'),
    slate: svg('<rect x="3.5" y="9" width="17" height="11" rx="1.5"/><path d="M3.5 9l1-4.5 16 0-1 4.5"/><path d="M8 4.5L6.5 9M12.5 4.5L11 9M17 4.5L15.5 9"/><path d="M7 13h10M7 16.5h7"/>'),
    remote: svg('<rect x="7" y="2.5" width="10" height="19" rx="2.2"/><circle cx="12" cy="17.5" r="1"/><path d="M10 5.5h4"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    check: svg('<path d="M4.5 12.5l5 5 10-11"/>'),
    refresh: svg('<path d="M19 12a7 7 0 0 1-12.2 4.7M5 12a7 7 0 0 1 12.2-4.7"/><path d="M17.5 3.5v4h-4M6.5 20.5v-4h4"/>'),
    pencil: svg('<path d="M15.5 4.5l4 4L8.5 19.5l-5 1 1-5z"/>'),
    trash: svg('<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/>'),
    close: svg('<path d="M5.5 5.5l13 13M18.5 5.5l-13 13"/>'),
    chevR: svg('<path d="M9 5l7 7-7 7"/>'),
    chevL: svg('<path d="M15 5l-7 7 7 7"/>'),
    imp: svg('<path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M5 19.5h14"/>'),
    exp: svg('<path d="M14 5h5v5M19 5l-8 8"/><path d="M11 5H5v14h14v-6"/>'),
    mount: svg('<path d="M2.5 18l5.5-8 4 5.5 2.5-3.5 4 6z"/><path d="M15 20h6M18.5 17.5l2.5 2.5-2.5 2.5"/>'),
    switchCam: svg('<rect x="3" y="6" width="13" height="11" rx="2"/><path d="M16 10l5-3v9l-5-3"/><path d="M6 20.5h12M15.5 18l2.5 2.5-2.5 2.5"/>'),
    front: svg('<rect x="5" y="3" width="14" height="18" rx="2.2"/><circle cx="12" cy="10" r="2.5"/><path d="M8 17c.8-2 2.2-3 4-3s3.2 1 4 3"/>'),
    lensSmall: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.2" fill="currentColor" opacity=".25"/>'),
    recLut: svg('<path d="M9 2.5v8M6 7.5l3 3 3-3"/><rect x="5" y="13" width="12" height="8" rx="1.5"/><circle cx="18.5" cy="17" r="3"/>'),
    cloudBig: '<svg viewBox="0 0 64 48" fill="none" stroke="#3a8cff" stroke-width="2.4"><path d="M16 40a12 12 0 0 1-1.5-23.9A15 15 0 0 1 43.6 12a11 11 0 0 1 4.4 21.4"/><path d="M22 30l4 4 4-6 4 8 4-4 4 2" stroke-width="2"/></svg>',
    sortI: svg('<path d="M4 6h10M4 11h7M4 16h4M17 5v14M14 16l3 3 3-3"/>'),
    selectI: svg('<rect x="3" y="5" width="14" height="11" rx="1.5"/><path d="M6 19h11a2 2 0 0 0 2-2V8"/><circle cx="17" cy="17" r="4" fill="currentColor" stroke="none" opacity=".9"/><path d="M15.2 17l1.3 1.3 2.4-2.6" stroke="#0b0f17"/>'),
    filterI: svg('<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16M8 6.5a8 8 0 0 1 8 0M7 17.5a8 8 0 0 0 10 0"/>'),
    sidebar: svg('<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M9 4.5v15"/>'),
    help: svg('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.6 2.6 0 0 1 5 1c0 1.8-2.5 2.2-2.5 4"/><circle cx="12" cy="17.3" r=".7" fill="currentColor"/>'),
    full: svg('<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>'),
    play: svg('<path d="M8 5l11 7-11 7z" fill="currentColor" stroke="none"/>'),
    pause: svg('<path d="M8 5v14M16 5v14" stroke-width="3"/>')
  };
  /* ---------- Стили (вся вёрстка приложения — в точках 932×430) ---------- */
  var CSS = [
    '.mlbm{--bg:#0b0f17;--rail:#0f141c;--blue:#2f7fff;--blue2:#3a8cff;--navact:#0f2747;--txt:#fff;--mut:#8d95a3;--card:#1c1c1e;--sep:#2e2e31;--red:#e0302a;',
    '--page:#0d1015;--panel:#151a22;--panel2:#1b212b;--ptxt:#e7eaf0;--pmut:#9aa3b2;--line:#262d38;--ok:#3ccf6e;--bad:#ff5d52;--warn:#ffbf3c;',
    'font-family:Lato,"Helvetica Neue",-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:var(--ptxt);background:var(--page);border-radius:14px;padding:14px;box-sizing:border-box;-webkit-tap-highlight-color:transparent;line-height:1.35}',
    '.mlbm *{box-sizing:border-box}',
    ':where(.mlbm) button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}',
    '.mlbm button:focus-visible,.mlbm [tabindex]:focus-visible{outline:2px solid var(--blue2);outline-offset:2px}',
    /* верхняя панель тренажёра */
    '.mlbm-top{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin-bottom:12px}',
    '.mlbm-title{font-weight:800;font-size:17px;letter-spacing:.2px;margin-right:auto}',
    '.mlbm-title small{display:block;font-weight:400;font-size:12px;color:var(--pmut);letter-spacing:0}',
    '.mlbm-sel{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--pmut)}',
    '.mlbm-sel select{font:inherit;font-size:13px;color:var(--ptxt);background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:6px 8px;max-width:230px}',
    '.mlbm-tbtn{display:inline-flex;align-items:center;gap:6px;font-size:13px;padding:7px 11px;border-radius:9px;background:var(--panel2);border:1px solid var(--line)!important;color:var(--ptxt)}',
    '.mlbm-tbtn svg{width:16px;height:16px}',
    '.mlbm-tbtn.on{background:var(--blue);border-color:var(--blue)!important;color:#fff}',
    '.mlbm-main{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:14px;align-items:start}',
    '@media (max-width:1100px){.mlbm-main{grid-template-columns:minmax(0,1fr)}}',
    /* телефон */
    '.mlbm-stage{position:relative;width:100%;min-width:0}',
    '.mlbm-phone{position:relative;margin:0 auto;border-radius:56px;background:#1d1f24;box-shadow:0 0 0 2px #3b3e45 inset,0 10px 40px rgba(0,0,0,.5);padding:14px}',
    '.mlbm-phone.fs{border-radius:0;padding:0;box-shadow:none;background:#000}',
    '.mlbm-screenbox{position:relative;overflow:hidden;border-radius:44px;background:#000}',
    '.mlbm-phone.fs .mlbm-screenbox{border-radius:0}',
    '.mlbm-screen{position:absolute;left:0;top:0;width:932px;height:430px;transform-origin:0 0;overflow:hidden;background:var(--bg);color:var(--txt);font-size:12px;user-select:none;-webkit-user-select:none;touch-action:none}',
    '.mlbm-island{position:absolute;left:12px;top:150px;width:34px;height:126px;border-radius:17px;background:#000;z-index:60;pointer-events:none}',
    '.mlbm-rotate{display:none;margin-top:8px;font-size:13px;color:var(--pmut);text-align:center}',
    '@media (max-width:560px) and (orientation:portrait){.mlbm-rotate{display:block}}',
    /* навигация */
    '.bm-rail{position:absolute;right:0;top:0;width:80px;height:430px;background:var(--rail);display:flex;flex-direction:column;align-items:center;justify-content:space-around;padding:30px 0 50px;z-index:40}',
    '.bm-nav{width:58px;height:66px;border-radius:9px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;color:#c8ced8;font-size:10.5px}',
    '.bm-nav svg{width:30px;height:30px}',
    '.bm-nav.act{background:var(--navact);color:var(--blue2)}',
    '.bm-view{position:absolute;left:0;top:0;width:852px;height:430px;display:none}',
    '.bm-view.act{display:block}',
    /* камера */
    '.bm-img{position:absolute;left:62px;top:17px;width:705px;height:397px;overflow:hidden;background:#000}',
    '.bm-img canvas.bm-cv{position:absolute;left:0;top:0;width:705px;height:397px;transform-origin:50% 50%}',
    '.bm-img.rec:after{content:"";position:absolute;inset:0;border:2px solid var(--red);pointer-events:none;z-index:4}',
    '.bm-ov{position:absolute;inset:0;pointer-events:none}',
    '.bm-ov svg{position:absolute;inset:0;width:100%;height:100%}',
    '.bm-hud{position:absolute;inset:0;pointer-events:none;transition:opacity .25s}',
    '.bm-hud.hidden{opacity:0}',
    '.bm-hud .it{position:absolute;top:14px;pointer-events:auto;padding:3px 4px;border-radius:4px;text-shadow:0 1px 2px rgba(0,0,0,.6)}',
    '.bm-hud .it.sel{background:var(--blue);text-shadow:none}',
    '.bm-hud .lb{font-size:9.5px;letter-spacing:.3px;display:flex;align-items:center;gap:3px;color:#f2f4f7;font-weight:400}',
    '.bm-hud .va{font-size:15px;margin-top:1px;font-weight:400;font-variant-numeric:tabular-nums;white-space:nowrap}',
    '.bm-a{display:inline-block;background:var(--blue);color:#fff;font-size:8.5px;font-weight:700;line-height:11px;width:11px;text-align:center;border-radius:2px}',
    '.bm-hud .it.sel .bm-a{background:#fff;color:var(--blue)}',
    '.bm-hud .it.dim{opacity:.45;pointer-events:auto}',
    '.bm-tc{position:absolute;top:13px;left:270px;width:166px;text-align:center;font-size:26px;font-weight:300;letter-spacing:.5px;font-variant-numeric:tabular-nums;pointer-events:auto;text-shadow:0 1px 3px rgba(0,0,0,.6)}',
    '.bm-tc.rec{color:#ff4a42}',
    '.bm-fmt{position:absolute;top:17px;left:607px;width:32px;height:22px;background:#fff;color:#000;border-radius:3px;font-size:9px;font-weight:800;text-align:center;line-height:10px;padding-top:1px;pointer-events:auto}',
    '.bm-fmt small{display:block;background:#000;color:#fff;margin:1px 1px 0;border-radius:1px;font-size:7px;font-weight:400;line-height:9px}',
    '.bm-bat{position:absolute;top:18px;left:648px;width:34px;height:18px;border:1.5px solid #fff;border-radius:4px;font-size:9.5px;font-weight:700;text-align:center;line-height:15px;background:rgba(255,255,255,.95);color:#000;pointer-events:auto}',
    '.bm-bat:after{content:"";position:absolute;right:-4px;top:5px;width:2px;height:6px;background:#fff;border-radius:0 1px 1px 0}',
    '.bm-bat.low{background:#ff4a42;color:#fff;border-color:#ff4a42}',
    '.bm-handle{position:absolute;top:186px;width:14px;height:28px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2.5px;pointer-events:auto;z-index:5}',
    '.bm-handle i{width:3.5px;height:3.5px;border-radius:50%;background:#fff;box-shadow:0 0 2px rgba(0,0,0,.6)}',
    '.bm-panel{position:absolute;bottom:12px;height:56px;background:rgba(22,26,34,.82);border-radius:4px;pointer-events:auto;font-size:7px}',
    '.bm-panel .pt{position:absolute;left:6px;top:4px;font-size:6.5px;color:#e8ebf0}',
    '.bm-hist{left:16px;width:140px}',
    '.bm-hist canvas{position:absolute;left:6px;top:13px;width:118px;height:38px}',
    '.bm-hist .clipi{position:absolute;right:6px;top:13px;width:5px;height:38px;border:1px solid #8a919c}',
    '.bm-hist .clipi b{position:absolute;left:0;right:0;height:50%;}',
    '.bm-stor{left:283px;width:140px;display:flex}',
    '.bm-stor .ph{width:38px;display:flex;align-items:center;justify-content:center;border-right:1px solid rgba(255,255,255,.08)}',
    '.bm-stor .ph i{width:12px;height:22px;border:1.4px solid #fff;border-radius:3px}',
    '.bm-stor .in{flex:1;padding:4px 7px 0}',
    '.bm-stor .t1{font-size:6.5px}',
    '.bm-stor .t2{font-size:12.5px;font-weight:700;margin-top:1px;font-variant-numeric:tabular-nums}',
    '.bm-stor .bar{height:3px;background:#3a414d;border-radius:2px;margin-top:3px}',
    '.bm-stor .bar b{display:block;height:100%;background:var(--blue2);border-radius:2px}',
    '.bm-stor .t3{display:flex;justify-content:space-between;font-size:6.5px;margin-top:2px;font-weight:700}',
    '.bm-aud{left:549px;width:140px}',
    '.bm-aud canvas{position:absolute;left:4px;top:12px;width:132px;height:42px}',
    '.bm-rcol{position:absolute;left:767px;top:0;width:85px;height:430px}',
    '.bm-rb{position:absolute;left:24px;width:38px;height:38px;display:flex;align-items:center;justify-content:center;color:#fff}',
    '.bm-rb svg{width:30px;height:30px}',
    '.bm-rb.on{color:var(--blue2)}',
    '.bm-rb .aa{position:absolute;right:-3px;top:13px;font-size:11px;font-weight:700}',
    '.bm-rb .sub{position:absolute;left:0;right:0;bottom:-6px;text-align:center;font-size:8px}',
    '.bm-rb .dot{position:absolute;bottom:-3px;left:17px;width:4px;height:4px;border-radius:50%;background:#fff}',
    '.bm-recb{position:absolute;left:12px;top:184px;width:61px;height:61px;border-radius:50%;border:2.5px solid #fff!important;display:flex;align-items:center;justify-content:center}',
    '.bm-recb i{width:34px;height:34px;border-radius:50%;background:#8e1414;transition:all .15s}',
    '.bm-recb.rec i{width:24px;height:24px;border-radius:5px;background:#ff3b30}',
    /* колёса */
    '.bm-dial{position:absolute;right:0;top:0;width:110px;height:397px;background:linear-gradient(90deg,rgba(0,0,0,0) 0,rgba(10,12,16,.55) 28px,rgba(10,12,16,.7) 100%);pointer-events:auto;touch-action:none}',
    '.bm-dial canvas{position:absolute;left:28px;top:0;width:40px;height:397px}',
    '.bm-bub{position:absolute;right:120px;top:182px;min-width:48px;height:32px;padding:0 9px;background:rgba(32,36,44,.9);border-radius:5px;font-size:15px;display:flex;align-items:center;justify-content:center;font-variant-numeric:tabular-nums;pointer-events:none;white-space:nowrap}',
    '.bm-bub:after{content:"";position:absolute;right:-30px;top:15.5px;width:28px;height:1.5px;background:var(--blue2)}',
    '.bm-qc{position:absolute;right:0;top:0;width:44px;height:397px;display:flex;flex-direction:column;align-items:center;justify-content:space-evenly}',
    '.bm-q{min-width:36px;padding:5px 3px;border-radius:5px;font-size:10.5px;text-align:center;color:#fff;display:flex;flex-direction:column;align-items:center;gap:1px}',
    '.bm-q svg{width:22px;height:22px}',
    '.bm-q small{font-size:7.5px}',
    '.bm-q.on{background:var(--blue);}',
    '.bm-q.dis{opacity:.35;pointer-events:none}',
    '.bm-dtop{position:absolute;top:6px;right:4px;display:flex;gap:4px;align-items:center;z-index:2}',
    '.bm-dtop .tb{height:32px;min-width:36px;padding:0 6px;border-radius:5px;font-size:10.5px;font-weight:700;display:flex;align-items:center;justify-content:center;color:#fff;background:rgba(40,44,52,.6)}',
    '.bm-dtop .tb.on{background:var(--blue)}',
    '.bm-dtop .tb svg{width:20px;height:20px}',
    '.bm-dbot{position:absolute;bottom:8px;right:4px;width:40px;display:flex;flex-direction:column;align-items:center;gap:6px;z-index:2}',
    '.bm-dbot .tb{min-width:36px;min-height:30px;border-radius:5px;font-size:9.5px;font-weight:700;display:flex;align-items:center;justify-content:center;color:#fff;text-align:center;line-height:1.05}',
    '.bm-dbot .tb.on{background:var(--blue)}',
    '.bm-dbot .tb svg{width:22px;height:22px}',
    '.bm-midbtn{position:absolute;right:52px;bottom:14px;display:flex;flex-direction:column;gap:12px;align-items:center;z-index:2}',
    '.bm-midbtn .tb{font-size:10px;font-weight:700;color:#fff;text-align:center;line-height:1.1;padding:4px 3px;border-radius:5px}',
    '.bm-midbtn .tb.on{background:var(--blue)}',
    /* колонка инструментов */
    '.bm-tools{position:absolute;right:0;top:0;width:44px;height:397px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:52px 0 14px;pointer-events:auto;background:rgba(10,12,16,.55)}',
    '.bm-tl{width:36px;height:36px;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;position:relative}',
    '.bm-tl svg{width:26px;height:26px}',
    '.bm-tl.sel{background:var(--blue)}',
    '.bm-tl.en:after{content:"";position:absolute;bottom:-2px;left:16px;width:4px;height:4px;border-radius:50%;background:#fff}',
    '.bm-tl .lv{position:absolute;right:-1px;bottom:0;font-size:7.5px;font-weight:700}',
    '.bm-onoff{position:absolute;top:6px;right:48px;height:32px;min-width:40px;padding:0 6px;border-radius:5px;font-size:10.5px;font-weight:700;display:flex;align-items:center;justify-content:center;z-index:3;pointer-events:auto}',
    '.bm-onoff.on{background:var(--blue)}',
    '.bm-gridpop{position:absolute;right:52px;top:60px;display:flex;flex-direction:column;gap:22px;pointer-events:auto;z-index:3}',
    '.bm-gridpop .tl{width:36px;height:36px;border-radius:7px;display:flex;align-items:center;justify-content:center;background:rgba(40,44,52,.75);color:#fff}',
    '.bm-gridpop .tl.on{background:var(--blue)}',
    '.bm-gridpop svg{width:24px;height:24px}',
    /* LUT */
    '.bm-lutp{position:absolute;right:0;top:0;width:150px;height:397px;pointer-events:auto;background:linear-gradient(90deg,rgba(0,0,0,0),rgba(8,10,14,.75) 40%)}',
    '.bm-lutp .lst{position:absolute;right:6px;top:52px;bottom:52px;overflow-y:auto;display:flex;flex-direction:column;gap:3px;align-items:flex-end;scrollbar-width:none}',
    '.bm-lutp .lst::-webkit-scrollbar{display:none}',
    '.bm-lr{display:flex;align-items:center;gap:7px;font-size:9.5px;color:#d8dde5;padding:2px 0}',
    '.bm-lr span{padding:4px 6px;border-radius:3px}',
    '.bm-lr.on span{background:rgba(40,44,52,.9);color:#fff}',
    '.bm-chip{width:26px;height:20px;border-radius:5px;border:2px solid transparent;background:#222;overflow:hidden;display:flex}',
    '.bm-chip i{flex:1}',
    '.bm-lr.on .bm-chip{border-color:#fff;box-shadow:0 0 0 1px #888}',
    '.bm-lr.on.lon .bm-chip{border-image:linear-gradient(90deg,#ff5d52,#ffd23c,#3ccf6e,#3a8cff,#c05cff) 1;border-radius:5px}',
    '.bm-lutbadge{position:absolute;left:24px;top:52px;width:22px;height:16px;color:#fff;pointer-events:none}',
    '.bm-torchbadge{position:absolute;left:50px;top:52px;width:18px;height:18px;border-radius:4px;background:var(--blue);color:#fff;display:flex;align-items:center;justify-content:center;pointer-events:none}',
    '.bm-torchbadge svg{width:13px;height:13px}',
    /* стабилизация */
    '.bm-stabp{position:absolute;right:0;top:0;width:86px;height:397px;background:rgba(8,10,14,.6);display:flex;flex-direction:column;justify-content:space-around;align-items:center;pointer-events:auto}',
    '.bm-stabp button{font-size:12px;padding:6px 6px;border-radius:5px;color:#fff}',
    '.bm-stabp button.on{background:var(--blue)}',
    /* боковые ⋮ панели */
    '.bm-side{position:absolute;top:110px;display:flex;flex-direction:column;gap:12px;pointer-events:auto;z-index:6}',
    '.bm-side button{width:36px;height:40px;border-radius:9px;background:rgba(70,62,58,.75);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700}',
    '.bm-side button svg{width:22px;height:22px}',
    '.bm-side button.dis{opacity:.4}',
    '.bm-side button.on{background:var(--blue)}',
    /* оверлеи */
    '.bm-card{position:absolute;background:rgba(40,40,40,.86);border-radius:8px;pointer-events:auto;color:#fff;z-index:20}',
    '.bm-presets{left:200px;top:110px;width:320px;min-height:170px;padding:12px 16px}',
    '.bm-presets h4,.bm-sheet h4{margin:0 0 10px;font-size:12px;font-weight:400;text-align:center}',
    '.bm-presets .empty{text-align:center;font-size:11px;line-height:1.5;color:#ddd;padding:6px 10px 14px}',
    '.bm-presets .lst{display:flex;flex-direction:column;gap:3px;max-height:110px;overflow:auto;margin-bottom:8px}',
    '.bm-presets .pr{padding:6px 9px;border-radius:5px;font-size:11px;text-align:left}',
    '.bm-presets .pr.on{background:var(--blue)}',
    '.bm-presets .bar{display:flex;justify-content:space-around;border-top:1px solid rgba(255,255,255,.12);padding-top:8px}',
    '.bm-presets .bar button{width:34px;height:28px;display:flex;align-items:center;justify-content:center;color:#ddd}',
    '.bm-presets .bar button svg{width:18px;height:18px}',
    '.bm-slate{position:absolute;inset:0;background:#0b0f17;z-index:30;pointer-events:auto;padding:22px 52px 18px 62px}',
    '.bm-slate .x{position:absolute;right:10px;top:8px;width:30px;height:30px;color:#ddd}',
    '.bm-slate .x svg{width:22px;height:22px}',
    '.bm-sg{display:grid;gap:3px;background:#0b0f17}',
    '.bm-sc{background:#243149;padding:8px 12px;position:relative}',
    '.bm-sc .l{font-size:7.5px;color:#c9d2e2;letter-spacing:.4px}',
    '.bm-sc .v{font-size:13px;margin-top:6px}',
    '.bm-sc input{font:inherit;font-size:13px;color:#fff;background:none;border:0;border-bottom:1px solid #3e5070;width:100%;margin-top:4px;padding:2px 0}',
    '.bm-step{display:flex;align-items:center;justify-content:space-between;margin-top:8px}',
    '.bm-step b{font-size:40px;font-weight:300}',
    '.bm-step button{width:30px;height:40px;color:#fff}',
    '.bm-step button svg{width:22px;height:22px}',
    '.bm-tg{background:#243149;height:56px;font-size:12.5px;color:#a9b4c8;border-bottom:3px solid transparent}',
    '.bm-tg.on{background:#2c4a7a;color:#fff;border-bottom-color:var(--blue2)}',
    '.bm-dots{display:flex;justify-content:center;gap:6px;margin-top:10px}',
    '.bm-dots i{width:6px;height:6px;border-radius:50%;background:#555;cursor:pointer}',
    '.bm-dots i.on{background:var(--blue2)}',
    '.bm-scope{left:40px;top:28px;width:450px;height:300px;padding:10px;background:rgba(10,12,16,.82)}',
    '.bm-scope canvas{width:430px;height:240px;display:block}',
    '.bm-scope .ctr{display:flex;align-items:center;gap:10px;margin-top:8px;font-size:11px}',
    '.bm-scope input[type=range]{flex:1;accent-color:#3a8cff}',
    '.bm-scope .pg{display:flex;gap:8px}',
    '.bm-scope .pg i{width:12px;height:12px;border-radius:50%;border:1.5px solid #aaa;cursor:pointer}',
    '.bm-scope .pg i.on{background:#aaa}',
    '.bm-audbig{left:180px;top:90px;width:300px;height:150px;padding:10px 14px;text-align:center;font-size:12px}',
    '.bm-audbig canvas{width:270px;height:90px;margin-top:10px}',
    '.bm-toast{position:absolute;left:50%;top:60px;transform:translateX(-50%);background:rgba(20,22,28,.92);border:1px solid #444;border-radius:8px;padding:8px 14px;font-size:11.5px;z-index:50;max-width:520px;text-align:center;pointer-events:none}',
    '.bm-toast.warn{border-color:#ffbf3c;color:#ffe2a0}',
    '.bm-af{position:absolute;width:56px;height:56px;margin:-28px 0 0 -28px;pointer-events:none}',
    '.bm-af:before{content:attr(data-l);position:absolute;top:-15px;left:0;right:0;text-align:center;font-size:8px;color:#fff;background:rgba(0,0,0,.35);border-radius:2px;width:30px;margin:0 auto}',
    '.bm-af svg{width:56px;height:56px}',
    '.bm-dim{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;transition:opacity .3s;z-index:55}',
    '.bm-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:56}',
    '.bm-fcleg{position:absolute;left:10px;top:70px;width:46px;height:210px;pointer-events:none;background:rgba(0,0,0,.35);border-radius:3px}',
    '.bm-fcleg i{position:absolute;left:5px;width:7px}',
    '.bm-fcleg span{position:absolute;left:15px;font-size:6.5px;color:#fff;transform:translateY(-50%)}',
    /* настройки */
    '.bm-set{background:#000}',
    '.bm-set .lft{position:absolute;left:0;top:0;width:262px;height:430px;padding:22px 0 0 58px;overflow-y:auto;scrollbar-width:none}',
    '.bm-set .lft::-webkit-scrollbar,.bm-set .rgt::-webkit-scrollbar,.bm-media .grid::-webkit-scrollbar{display:none}',
    '.bm-set .lft h2{margin:0 0 12px;font-size:22px;font-weight:700}',
    '.bm-set .sec{display:block;width:100%;text-align:left;padding:11px 14px;font-size:13px;border-bottom:1px solid #1d1f22}',
    '.bm-set .sec.act{background:var(--blue);border-bottom-color:var(--blue);border-radius:2px}',
    '.bm-set .rgt{position:absolute;left:272px;top:0;width:580px;height:430px;overflow-y:auto;padding:0 16px 30px 12px;scrollbar-width:none}',
    '.bm-set .hd{position:sticky;top:0;background:#000;height:42px;display:flex;align-items:center;justify-content:center;font-size:14px;z-index:2}',
    '.bm-set .hd button{position:absolute;left:0;top:7px;width:30px;height:28px;color:#fff}',
    '.bm-set .hd button svg{width:20px;height:20px}',
    '.bm-set .gh{font-size:13px;font-weight:700;color:#8e8e93;margin:14px 6px 6px}',
    '.bm-grp{background:var(--card);border-radius:10px;margin-bottom:10px;overflow:hidden}',
    '.bm-row{display:flex;align-items:center;min-height:42px;padding:0 14px;position:relative;width:100%;text-align:left;font-size:13.5px}',
    '.bm-row+.bm-row:before{content:"";position:absolute;left:14px;right:0;top:0;height:1px;background:var(--sep)}',
    '.bm-row .lb{flex:1;min-width:0;padding:8px 0}',
    '.bm-row .lb small{display:block;font-size:11px;color:#8e8e93;margin-top:2px}',
    '.bm-row .vl{color:#8e8e93;font-size:13px;margin-left:10px;white-space:nowrap;max-width:240px;overflow:hidden;text-overflow:ellipsis}',
    '.bm-row .ch{width:16px;height:16px;color:#8e8e93;margin-left:6px;flex:none}',
    '.bm-row.dis{color:#6b6b70}',
    '.bm-row.dis .tgl{opacity:.45}',
    '.bm-row .ck{width:20px;height:20px;color:var(--blue2);margin-right:10px;flex:none;visibility:hidden}',
    '.bm-row.sel .ck{visibility:visible}',
    '.bm-row .ic{width:28px;height:28px;border-radius:6px;background:#173a6e;color:#cfe0ff;display:flex;align-items:center;justify-content:center;margin-right:10px}',
    '.bm-row .ic svg{width:18px;height:18px}',
    '.tgl{width:51px;height:31px;border-radius:16px;background:#39393d;position:relative;flex:none;transition:background .2s}',
    '.tgl:after{content:"";position:absolute;left:2px;top:2px;width:27px;height:27px;border-radius:50%;background:#fff;transition:left .2s;box-shadow:0 2px 4px rgba(0,0,0,.3)}',
    '.tgl.on{background:var(--blue)}',
    '.tgl.on:after{left:22px}',
    '.tgl:before{content:"";position:absolute;right:9px;top:10px;width:9px;height:9px;border:1.5px solid #8e8e93;border-radius:50%}',
    '.tgl.on:before{left:12px;right:auto;top:10px;width:0;height:10px;border:0;border-left:1.5px solid #fff;border-radius:0}',
    '.bm-note{font-size:11px;color:#8e8e93;margin:4px 8px 10px;line-height:1.45}',
    '.bm-bigbtn{display:block;margin:16px auto;padding:10px 20px;border:1.5px solid #8e8e93!important;border-radius:10px;font-size:13px}',
    /* медиа и чат */
    '.bm-media{background:#0b0f17}',
    '.bm-media .mh{position:absolute;left:62px;right:16px;top:0;height:42px;display:flex;align-items:center;gap:14px;font-size:14px}',
    '.bm-media .mh .t{flex:1}',
    '.bm-media .mh button{width:28px;height:28px;color:#ddd}',
    '.bm-media .mh svg{width:22px;height:22px}',
    '.bm-media .grid{position:absolute;left:62px;right:16px;top:48px;bottom:0;overflow-y:auto;display:grid;grid-template-columns:repeat(4,1fr);gap:14px 14px;align-content:start;padding-bottom:20px;scrollbar-width:none}',
    '.bm-clip{text-align:center;font-size:11px}',
    '.bm-clip .th{position:relative;aspect-ratio:16/9;background:#1a1d24;border-radius:5px;overflow:hidden}',
    '.bm-clip .th img{width:100%;height:100%;object-fit:cover;display:block}',
    '.bm-clip .th span{position:absolute;right:4px;bottom:4px;background:rgba(0,0,0,.6);border-radius:3px;font-size:9px;padding:1px 4px}',
    '.bm-clip .th em{position:absolute;left:4px;top:4px;background:var(--ok);color:#000;border-radius:3px;font-size:8px;padding:1px 4px;font-style:normal;font-weight:700}',
    '.bm-clip .nm{margin-top:5px}',
    '.bm-media .empty{position:absolute;left:0;right:0;top:170px;text-align:center;color:#8e8e93;font-size:13px;line-height:1.6}',
    '.bm-player{position:absolute;inset:0;background:#05070b;z-index:5;display:flex}',
    '.bm-player .pv{position:relative;width:600px;padding-left:52px!important;height:430px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;padding:12px}',
    '.bm-player .pv img{width:520px;height:292px;object-fit:contain;background:#000;border-radius:4px}',
    '.bm-player .pc{display:flex;align-items:center;gap:10px;width:520px;font-size:11px;font-variant-numeric:tabular-nums}',
    '.bm-player .pc input{flex:1;accent-color:#3a8cff}',
    '.bm-player .pc button{width:26px;height:26px;color:#fff}',
    '.bm-player .pc button svg{width:18px;height:18px}',
    '.bm-player .meta{flex:1;padding:14px 14px 14px 4px;overflow-y:auto;font-size:11px;scrollbar-width:none}',
    '.bm-player .meta h5{margin:0 0 8px;font-size:13px;font-weight:700}',
    '.bm-player .meta dl{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;margin:0}',
    '.bm-player .meta dt{color:#8e8e93}',
    '.bm-player .meta dd{margin:0}',
    '.bm-player .acts{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}',
    '.bm-player .acts button{padding:6px 10px;border-radius:7px;background:#1f2633;font-size:11px}',
    '.bm-player .acts button.del{color:#ff6b62}',
    '.bm-player .x{position:absolute;left:56px;top:10px;width:28px;height:28px;color:#fff;z-index:2}',
    '.bm-player .x svg{width:20px;height:20px}',
    '.bm-chatv{background:#0b0f17}',
    '.bm-chatv .c{position:absolute;inset:0 0 0 0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px}',
    '.bm-chatv .logo svg{width:64px;height:48px}',
    '.bm-chatv h3{margin:0;font-size:26px;font-weight:700}',
    '.bm-chatv h3 b{color:#3a8cff;font-weight:700}',
    '.bm-chatv p{color:#8e8e93;font-size:13px;margin:16px 0 18px}',
    '.bm-chatv .lg{width:200px;height:40px;border-radius:6px;background:#2f7fff;color:#fff;font-size:13px}',
    '.bm-msgs{position:absolute;left:40px;right:40px;top:20px;bottom:64px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;scrollbar-width:none}',
    '.bm-msg{max-width:70%;background:#1f2633;padding:7px 11px;border-radius:10px;font-size:12px}',
    '.bm-msg b{display:block;font-size:10px;color:#3a8cff;margin-bottom:2px}',
    '.bm-msg.me{align-self:flex-end;background:#2f7fff}',
    '.bm-msg.me b{color:#dbe8ff}',
    '.bm-chatin{position:absolute;left:40px;right:40px;bottom:16px;display:flex;gap:8px}',
    '.bm-chatin input{flex:1;font:inherit;font-size:12px;background:#1f2633;border:0;border-radius:8px;color:#fff;padding:9px 11px}',
    '.bm-chatin button{padding:0 14px;border-radius:8px;background:#2f7fff;font-size:12px}',
    /* режим справки */
    '.mlbm.helpmode .mlbm-screen [data-h],.mlbm.helpmode .mlbm-screen [data-hs]{cursor:help}',
    '.mlbm.helpmode .mlbm-screen{outline:2px dashed rgba(255,191,60,.6);outline-offset:-2px}',
    '.bm-hl{position:absolute;border:2px solid #ffbf3c;border-radius:6px;pointer-events:none;z-index:70;box-shadow:0 0 0 2000px rgba(0,0,0,.0);transition:all .12s}',
    /* правая панель тренажёра */
    '.mlbm-side{background:var(--panel);border:1px solid var(--line);border-radius:12px;min-width:0;display:flex;flex-direction:column;max-height:760px}',
    '.mlbm-tabs{display:flex;border-bottom:1px solid var(--line)}',
    '.mlbm-tabs button{flex:1;padding:11px 6px;font-size:13px;color:var(--pmut);border-bottom:2px solid transparent!important}',
    '.mlbm-tabs button.on{color:var(--ptxt);border-bottom-color:var(--blue2)!important;font-weight:700}',
    '.mlbm-pane{padding:14px 16px 18px;overflow-y:auto;min-height:0;font-size:13.5px}',
    '.mlbm-pane h3{margin:0 0 4px;font-size:16px;line-height:1.25;text-wrap:balance}',
    '.mlbm-pane .en{font-size:11.5px;color:var(--pmut);margin-bottom:8px;letter-spacing:.2px}',
    '.mlbm-pane p{margin:0 0 10px;line-height:1.5}',
    '.mlbm-pane .tip{background:rgba(58,140,255,.1);border-left:3px solid var(--blue2);padding:8px 10px;border-radius:0 8px 8px 0;margin:10px 0;font-size:13px;line-height:1.45}',
    '.mlbm-pane .sim{background:rgba(255,191,60,.08);border-left:3px solid var(--warn);padding:8px 10px;border-radius:0 8px 8px 0;margin:10px 0;font-size:12.5px;color:#f0dcb0}',
    '.mlbm-pane .vals{font-size:12px;color:var(--pmut);margin-top:6px}',
    '.mlbm-pane .hint{color:var(--pmut);font-size:12.5px;line-height:1.5}',
    '.mlbm-pane .live{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;font-size:12.5px;margin-top:12px;padding-top:10px;border-top:1px solid var(--line);font-variant-numeric:tabular-nums}',
    '.mlbm-pane .live dt{color:var(--pmut)}',
    '.mlbm-pane .live dd{margin:0}',
    '.mlbm-search{width:100%;font:inherit;font-size:13px;background:var(--panel2);border:1px solid var(--line);border-radius:8px;color:var(--ptxt);padding:8px 10px;margin-bottom:10px}',
    '.mlbm-gl h4{margin:14px 0 4px;font-size:12px;color:var(--pmut);text-transform:uppercase;letter-spacing:.6px}',
    '.mlbm-gl button{display:block;width:100%;text-align:left;padding:6px 8px;border-radius:6px;font-size:13px}',
    '.mlbm-gl button:hover{background:var(--panel2)}',
    '.mlbm-gl button small{color:var(--pmut);font-size:11.5px;margin-left:4px}',
    '.mlbm-task{border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:8px;background:var(--panel2);width:100%;text-align:left;display:block}',
    '.mlbm-task .tn{font-weight:700;font-size:13.5px;display:flex;gap:8px;align-items:center}',
    '.mlbm-task .tn i{font-style:normal;font-size:11px;color:var(--pmut);font-weight:400;margin-left:auto}',
    '.mlbm-task .td{font-size:12px;color:var(--pmut);margin-top:3px}',
    '.mlbm-task.done .tn:before{content:"✓";color:var(--ok)}',
    '.mlbm-task.act{border-color:var(--blue2)}',
    '.mlbm-chk{list-style:none;margin:10px 0;padding:0}',
    '.mlbm-chk li{display:flex;gap:8px;font-size:13px;padding:5px 0;border-bottom:1px solid var(--line);line-height:1.4}',
    '.mlbm-chk li b{flex:none;width:18px;text-align:center}',
    '.mlbm-chk li.ok b{color:var(--ok)}',
    '.mlbm-chk li.bad b{color:var(--bad)}',
    '.mlbm-chk li.wait b{color:var(--pmut)}',
    '.mlbm-chk li small{display:block;color:var(--pmut);font-size:12px}',
    '.mlbm-score{font-size:22px;font-weight:800;margin:6px 0}',
    '.mlbm-score.ok{color:var(--ok)}',
    '.mlbm-act{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}',
    '.mlbm-act button{padding:7px 12px;border-radius:8px;background:var(--panel2);border:1px solid var(--line)!important;font-size:13px}',
    '.mlbm-act button.pri{background:var(--blue);border-color:var(--blue)!important;color:#fff}',
    '.mlbm-foot{margin-top:12px;font-size:11.5px;color:var(--pmut);line-height:1.5}',
    '@media (prefers-reduced-motion:reduce){.mlbm *{transition:none!important}}'
  ].join('\n');

  function injectCSS() {
    if (document.getElementById('mlbm-css')) return;
    var st = document.createElement('style'); st.id = 'mlbm-css'; st.textContent = CSS; document.head.appendChild(st);
    if (!document.querySelector('link[data-mlbm-font]')) {
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.setAttribute('data-mlbm-font', '1');
      l.href = 'https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700;900&display=swap'; document.head.appendChild(l);
    }
  }
  /* =====================================================================
   *  ПРИЛОЖЕНИЕ: каркас, экран камеры, верхняя строка, панели, запись
   * ===================================================================== */
  function h(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === 'cls') e.className = attrs[k]; else if (k === 'style') e.style.cssText = attrs[k]; else e.setAttribute(k, attrs[k]); }
    if (html != null) e.innerHTML = html;
    return e;
  }
  function resFactor(r) { return r === '4k' ? 1 : r === 'opengate' ? 0.333 : r === 'hd' ? 0.25 : 0.111; }
  function videoRate(S) {
    var fps = curFps(S), r = resFactor(S.resolution);
    if (CODEC_RATE[S.codec]) return CODEC_RATE[S.codec] * r * fps / 30;
    var b = 54; BITRATES.forEach(function (x) { if (x[0] === S.bitrate) b = x[2]; });
    if (S.codec === 'h264') b *= 1.2;
    return b * Math.pow(r, 0.6) * Math.pow(fps / 30, 0.6);
  }
  function totalRate(S) {
    var a = S.audioSrc === 'none' ? 0 : S.audioFmt === 'aac' ? 0.32 : S.audioFmt === 'pcm' ? 2.3 : 3.07;
    a *= S.audioCh === 'mono' ? 0.5 : S.audioCh === '4ch' ? 2 : 1;
    return videoRate(S) + (S.proxy ? 5 : 0) + a;
  }
  function needsExternal(S) { return /^prores/.test(S.codec) && (S.resolution === '4k' || S.resolution === 'opengate') && curFps(S) > 30 && S.saveTo !== 'external'; }
  function fmtShutter(S, den) {
    var fpsE = curFps(S);
    if (S.shutterMeas === 'angle') { var a = S.shAuto ? 360 * fpsE / den : S.shAngle; return (Math.round(a * 10) / 10) + '°'; }
    return '1/' + Math.round(den);
  }
  function fmtIris(S, N) { return S.irisMeas === 'decimal' ? N.toFixed(1).replace('.', ',') : 'f/' + N.toFixed(1).replace('.', ','); }
  function fmtFps(f) { return String(f); }

  function mount(root, opts) {
    opts = opts || {};
    injectCSS();
    root.innerHTML = '';
    var saved = store('settings');
    var S = defaults();
    if (saved && typeof saved === 'object') for (var k in saved) if (k in S && k !== 'recording') S[k] = saved[k];
    S.scene = opts.scene || (saved && saved.scene) || 'day';
    S.recording = false; S.tap = null;
    var app = { S: S, root: root, clips: [], tcFrames: 0, free: 51e9, total: 512e9, battery: 82, view: 'camera', open: null, helpMode: false, opts: opts };
    var eng = createEngine(S); app.eng = eng;

    /* ---------- каркас ---------- */
    var el = h('div', { cls: 'mlbm', tabindex: '0' });
    root.appendChild(el); app.el = el;
    var top = h('div', { cls: 'mlbm-top' });
    top.innerHTML = '<div class="mlbm-title">Blackmagic Camera — симулятор<small>Учебный тренажёр приложения 3.5 для iPhone 15 Pro Max. Не официальный продукт Blackmagic Design.</small></div>' +
      '<label class="mlbm-sel">Условия <select class="sel-scene">' + SCENES.map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + '</option>'; }).join('') + '</select></label>' +
      '<button type="button" class="mlbm-tbtn b-help" title="Режим справки: нажмите на любой элемент, чтобы узнать, что он делает">' + IC.help + 'Что это?</button>' +
      '<button type="button" class="mlbm-tbtn b-full" title="Во весь экран">' + IC.full + 'Во весь экран</button>';
    el.appendChild(top);
    var main = h('div', { cls: 'mlbm-main' }); el.appendChild(main);
    var stage = h('div', { cls: 'mlbm-stage' }); main.appendChild(stage);
    var phone = h('div', { cls: 'mlbm-phone' }); stage.appendChild(phone);
    var box = h('div', { cls: 'mlbm-screenbox' }); phone.appendChild(box);
    var scr = h('div', { cls: 'mlbm-screen' }); box.appendChild(scr); app.scr = scr;
    box.appendChild(h('div', { cls: 'mlbm-island' }));
    stage.appendChild(h('div', { cls: 'mlbm-rotate' }, 'Поверните телефон горизонтально или нажмите «Во весь экран» — так кнопки будут крупнее.'));
    var side = h('div', { cls: 'mlbm-side' }); main.appendChild(side); app.side = side;

    /* масштаб экрана телефона под ширину блока */
    function fit() {
      var fs = phone.classList.contains('fs');
      var avail = fs ? window.innerWidth : stage.clientWidth;
      var availH = fs ? window.innerHeight : Infinity;
      var pad = fs ? 0 : 28;
      var s = Math.min((avail - pad) / 932, (availH - pad) / 430);
      if (!fs) { s = Math.min(s, 1.25); if (window.innerHeight < 620 && window.innerWidth > window.innerHeight) s = Math.min(s, (window.innerHeight - 24) / 430); }
      s = Math.max(s, 0.25);
      app.scale = s;
      scr.style.transform = 'scale(' + s + ')';
      box.style.width = 932 * s + 'px'; box.style.height = 430 * s + 'px';
      phone.style.width = (932 * s + pad) + 'px';
      if (app.dial) app.dial.redraw();
    }
    app.fit = fit;
    if (window.ResizeObserver) new ResizeObserver(fit).observe(stage); else window.addEventListener('resize', fit);
    top.querySelector('.b-full').onclick = function () {
      var on = !phone.classList.contains('fs');
      if (on) { phone.classList.add('fs'); var rq = phone.requestFullscreen || phone.webkitRequestFullscreen; if (rq) { var pr = rq.call(phone); if (pr && pr.catch) pr.catch(function () {}); } }
      else { phone.classList.remove('fs'); if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen(); }
      setTimeout(fit, 60);
    };
    document.addEventListener('fullscreenchange', function () { if (!document.fullscreenElement) phone.classList.remove('fs'); setTimeout(fit, 60); });
    var selScene = top.querySelector('.sel-scene'); selScene.value = S.scene;
    selScene.onchange = function () { setScene(selScene.value); };
    function setScene(id) { S.scene = id; selScene.value = id; eng.dirty = true; app.save(); app.showHelpText(sceneById(id).name, 'Условия съёмки', sceneById(id).about); }
    app.setScene = setScene;

    /* ---------- навигация ---------- */
    var rail = h('div', { cls: 'bm-rail' });
    [['camera', 'Camera', IC.camTab, 'navCamera'], ['media', 'Media', IC.media, 'navMedia'], ['chat', 'Chat', IC.chat, 'navChat'], ['settings', 'Settings', IC.gear, 'navSettings']].forEach(function (n) {
      var b = h('button', { cls: 'bm-nav', 'data-nav': n[0], 'data-h': n[3], type: 'button' }, n[2] + '<span>' + n[1] + '</span>');
      b.onclick = function () { app.go(n[0]); };
      rail.appendChild(b);
    });
    scr.appendChild(rail);
    var views = {};
    ['camera', 'media', 'chat', 'settings'].forEach(function (v) { views[v] = h('div', { cls: 'bm-view bm-' + (v === 'settings' ? 'set' : v === 'chat' ? 'chatv' : v) }); scr.appendChild(views[v]); });
    app.views = views;
    app.go = function (v) {
      app.view = v;
      for (var k in views) views[k].classList.toggle('act', k === v);
      rail.querySelectorAll('.bm-nav').forEach(function (b) { b.classList.toggle('act', b.getAttribute('data-nav') === v); });
      if (v === 'settings') app.renderSettings(); if (v === 'media') app.renderMedia(); if (v === 'chat') app.renderChat();
    };

    /* ---------- экран камеры ---------- */
    var cam = views.camera;
    var img = h('div', { cls: 'bm-img', 'data-h': 'image' }); cam.appendChild(img); app.img = img;
    var cv = h('canvas', { cls: 'bm-cv', width: RW, height: RH }); img.appendChild(cv);
    var cvx = cv.getContext('2d');
    var ov = h('div', { cls: 'bm-ov' }); img.appendChild(ov);
    var ovSvg = h('div', { cls: 'bm-ov' }); ov.appendChild(ovSvg);
    var fcLeg = h('div', { cls: 'bm-fcleg' }); fcLeg.style.display = 'none'; img.appendChild(fcLeg);
    (function () {
      var bands = [['#ff1010', '', 0, 6], ['#ffe600', '95%WC', 6, 22], ['#d9d9d0', '80%WC', 22, 50], ['#9a9a9a', '', 50, 70], ['#ff96c8', 'MG+1', 70, 92], ['#9a9a9a', '', 92, 112], ['#2ad23c', '18%MG', 112, 135], ['#6a6a6a', '', 135, 160], ['#1e46e6', 'NBDL', 160, 182], ['#781eaa', 'BDL', 182, 200]];
      fcLeg.innerHTML = bands.map(function (b) { return '<i style="top:' + (b[2] + 5) + 'px;height:' + (b[3] - b[2]) + 'px;background:' + b[0] + '"></i>' + (b[1] ? '<span style="top:' + ((b[2] + b[3]) / 2 + 5) + 'px">' + b[1] + '</span>' : ''); }).join('');
    })();
    var lutBadge = h('div', { cls: 'bm-lutbadge' }, IC.lut); img.appendChild(lutBadge);
    var torchBadge = h('div', { cls: 'bm-torchbadge' }, IC.torch); img.appendChild(torchBadge);
    var afBox = h('div', { cls: 'bm-af' }, svg('<path d="M3 9V5a2 2 0 0 1 2-2h4M15 3h4a2 2 0 0 1 2 2v4M21 15v4a2 2 0 0 1-2 2h-4M9 21H5a2 2 0 0 1-2-2v-4" stroke="#fff" stroke-width="1"/><path d="M10 12h4M12 10v4" stroke="#fff" stroke-width=".8"/>')); afBox.style.display = 'none'; img.appendChild(afBox);

    /* верхняя строка (HUD) */
    var hud = h('div', { cls: 'bm-hud' }); img.appendChild(hud); app.hud = hud;
    function hudItem(id, label, left, help, dial) {
      var it = h('div', { cls: 'it', 'data-h': help, 'data-dial': dial || '' });
      it.style.left = left + 'px';
      it.innerHTML = '<div class="lb">' + label + '<span class="bm-a" style="display:none">A</span><span class="lk" style="display:none;width:9px;height:9px">' + IC.lock + '</span></div><div class="va">—</div>';
      hud.appendChild(it);
      if (dial) it.addEventListener('click', function () { app.toggleDial(dial); });
      return it;
    }
    var H = {
      lens: hudItem('lens', 'LENS', 22, 'lens', 'lens'),
      fps: hudItem('fps', 'FPS', 88, 'fps', 'fps'),
      sh: hudItem('sh', 'SHUTTER', 140, 'shutter', 'shutter'),
      iris: hudItem('iris', 'IRIS', 214, 'iris', null),
      iso: hudItem('iso', 'ISO', 440, 'iso', 'iso'),
      wb: hudItem('wb', 'WB', 488, 'wb', 'wb'),
      tint: hudItem('tint', 'TINT', 550, 'tint', 'tint')
    };
    H.iris.classList.add('dim');
    var tcEl = h('div', { cls: 'bm-tc', 'data-h': 'tc' }, '00:00:00:00'); hud.appendChild(tcEl);
    var fmtEl = h('div', { cls: 'bm-fmt', 'data-h': 'format' }, '4K<small>16:9</small>'); hud.appendChild(fmtEl);
    fmtEl.addEventListener('click', function () { app.go('settings'); app.openSection('record'); });
    var batEl = h('div', { cls: 'bm-bat', 'data-h': 'battery' }, '82%'); hud.appendChild(batEl);
    var hL = h('div', { cls: 'bm-handle', 'data-h': 'leftHandle' }, '<i></i><i></i><i></i>'); hL.style.left = '4px'; img.appendChild(hL);
    var hR = h('div', { cls: 'bm-handle', 'data-h': 'rightHandle' }, '<i></i><i></i><i></i>'); hR.style.right = '4px'; img.appendChild(hR);
    hL.onclick = function () { app.toggleSide('left'); };
    hR.onclick = function () { app.toggleSide('right'); };

    /* нижние панели */
    var pHist = h('div', { cls: 'bm-panel bm-hist', 'data-h': 'hist' }, '<div class="pt">Apple Log - HDR</div><canvas width="236" height="76"></canvas><div class="clipi"><b style="top:0"></b><b style="bottom:0"></b></div>');
    var pStor = h('div', { cls: 'bm-panel bm-stor', 'data-h': 'storage' }, '<div class="ph"><i></i></div><div class="in"><div class="t1">Internal Storage</div><div class="t2">0:00:00</div><div class="bar"><b></b></div><div class="t3"><span>10%</span><span>51GB</span></div></div>');
    var pAud = h('div', { cls: 'bm-panel bm-aud', 'data-h': 'meters' }, '<div class="pt">iPhone Microphone</div><canvas width="264" height="84"></canvas>');
    [pHist, pStor, pAud].forEach(function (p) { img.appendChild(p); });
    pHist.onclick = function () { app.toggleOverlay('scope'); };
    pAud.onclick = function () { app.toggleOverlay('audbig'); };
    var histCv = pHist.querySelector('canvas'), histCtx = histCv.getContext('2d');
    var audCv = pAud.querySelector('canvas'), audCtx = audCv.getContext('2d');

    var dimEl = h('div', { cls: 'bm-dim' }); scr.appendChild(dimEl);
    var flashEl = h('div', { cls: 'bm-flash' }); scr.appendChild(flashEl);

    /* правая колонка */
    var rcol = h('div', { cls: 'bm-rcol' }); cam.appendChild(rcol);
    function rb(icon, y, help, fn, extra) { var b = h('button', { cls: 'bm-rb', type: 'button', 'data-h': help }, icon + (extra || '')); b.style.top = y + 'px'; b.onclick = fn; rcol.appendChild(b); return b; }
    var RB = {
      tools: rb(IC.frame, 13, 'tools', function () { app.toggleDial('tools'); }),
      focus: rb(IC.focus, 66, 'focus', function () { app.toggleDial('focus'); }, '<span class="aa">A</span>'),
      expo: rb(IC.expo, 119, 'exposure', function () { app.toggleDial('exposure'); }, '<span class="aa">A</span>'),
      lens: rb(IC.lensSmall, 278, 'lensBtn', function () { app.toggleDial('lens'); }, '<span class="sub">1x</span>'),
      lut: rb(IC.lut, 327, 'lutBtn', function () { app.toggleDial('lut'); }, '<span class="dot" style="display:none"></span>'),
      stab: rb(IC.stab, 378, 'stabBtn', function () { app.toggleDial('stab'); })
    };
    var recB = h('button', { cls: 'bm-recb', type: 'button', 'data-h': 'rec' }, '<i></i>'); rcol.appendChild(recB);
    recB.onclick = function () { app.toggleRec(); };

    /* ---------- оверлей: сетки, рамки, safe area ---------- */
    var ovSig = '';
    function colorOf(n) { return { white: '#fff', black: '#000', red: '#ff3b30', green: '#34c759', blue: '#2f7fff' }[n] || '#fff'; }
    function drawOverlay() {
      var sig = [S.grid, S.gridThirds, S.gridHorizon, S.gridCross, S.gridDot, S.gridsOp, S.fg, S.fgRatio, S.guidesOp, S.guidesColor, S.safe, S.safeLvl, S.resolution].join('|');
      if (sig === ovSig) return; ovSig = sig;
      var W = 705, Hh = 397, s = '<svg viewBox="0 0 705 397" preserveAspectRatio="none">';
      var gc = colorOf(S.guidesColor);
      if (S.resolution === 'opengate') { var gw = Hh * 4 / 3, gx = (W - gw) / 2; s += '<rect x="0" y="0" width="' + gx + '" height="397" fill="#000"/><rect x="' + (gx + gw) + '" y="0" width="' + gx + '" height="397" fill="#000"/>'; }
      if (S.fg) {
        var r = ratioVal(S.fgRatio), a = parseInt(S.guidesOp, 10) / 100 * 0.9, fw = W, fh = Hh;
        if (r > W / Hh) fh = W / r; else fw = Hh * r;
        var x0 = (W - fw) / 2, y0 = (Hh - fh) / 2;
        s += '<path d="M0 0H705V397H0Z M' + x0 + ' ' + y0 + 'V' + (y0 + fh) + 'H' + (x0 + fw) + 'V' + y0 + 'Z" fill="rgba(0,0,0,' + a + ')" fill-rule="evenodd"/>';
        s += '<rect x="' + x0 + '" y="' + y0 + '" width="' + fw + '" height="' + fh + '" fill="none" stroke="' + gc + '" stroke-width="1"/>';
      }
      if (S.safe) { var k = S.safeLvl / 100, sw = W * k, sh = Hh * k; s += '<rect x="' + (W - sw) / 2 + '" y="' + (Hh - sh) / 2 + '" width="' + sw + '" height="' + sh + '" fill="none" stroke="' + gc + '" stroke-width="1.5"/>'; }
      if (S.grid) {
        var go = parseInt(S.gridsOp, 10) / 100 * 0.9 + 0.1, st = 'stroke="rgba(255,255,255,' + go + ')" stroke-width="1"';
        if (S.gridThirds) s += '<path d="M235 0V397M470 0V397M0 132.3H705M0 264.7H705" ' + st + '/>';
        if (S.gridHorizon) s += '<path d="M150 198.5H555" ' + st + ' stroke-dasharray="6 4"/>';
        if (S.gridCross) s += '<path d="M340 198.5H365M352.5 186V211" ' + st + '/>';
        if (S.gridDot) s += '<circle cx="352.5" cy="198.5" r="2.5" fill="rgba(255,255,255,' + go + ')"/>';
      }
      ovSvg.innerHTML = s + '</svg>';
    }

    /* ---------- верхняя строка: обновление ---------- */
    function setTxt(e, t) { if (e.__t !== t) { e.__t = t; e.textContent = t; } }
    function setHud(item, val, auto, lock, sel) {
      setTxt(item.querySelector('.va'), val);
      item.querySelector('.bm-a').style.display = auto && !lock ? '' : 'none';
      item.querySelector('.lk').style.display = lock ? 'inline-block' : 'none';
      item.classList.toggle('sel', !!sel);
    }
    var lastTodSec = -1;
    function updateHud() {
      var L = lensById(S.lens), od = app.open;
      setHud(H.lens, (L.front ? 'Front' : L.eq + 'mm'), false, false, od === 'lens');
      setHud(H.fps, S.offSpeed ? fmtFps(S.offFps) : fmtFps(S.fps), false, false, od === 'fps');
      H.fps.querySelector('.lb').firstChild.textContent = S.offSpeed ? 'OFF SPEED' : 'FPS';
      setHud(H.sh, fmtShutter(S, S.shDen), S.shAuto, S.shLock, od === 'shutter');
      H.sh.querySelector('.lb').firstChild.textContent = S.shutterMeas === 'angle' ? 'ANGLE' : 'SHUTTER';
      setHud(H.iris, fmtIris(S, L.N), false, false, false);
      setHud(H.iso, String(Math.round(S.iso)), S.isoAuto, S.isoLock, od === 'iso');
      setHud(H.wb, Math.round(S.wbK / 10) * 10 + 'K', S.wbAuto, S.wbLock || (S.recording && S.lockWbRec && S.wbAuto), od === 'wb');
      setHud(H.tint, String(Math.round(S.tint)), S.tintAuto, S.tintLock, od === 'tint');
      var fps = S.fps;
      if (S.tcDisplay === 'tod') { var d = new Date(), sec = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(); setTxt(tcEl, fmtTC(sec * Math.round(fps) + Math.floor(d.getMilliseconds() / 1000 * fps), fps)); }
      else setTxt(tcEl, fmtTC(Math.floor(app.tcFrames), fps));
      tcEl.classList.toggle('rec', S.recording);
      setTxt(fmtEl.firstChild, { '4k': '4K', hd: 'HD', '720p': '720', opengate: 'OG' }[S.resolution]);
      setTxt(fmtEl.querySelector('small'), S.resolution === 'opengate' ? '4:3' : '16:9');
      batEl.style.display = S.dispBattery ? '' : 'none';
      setTxt(batEl, Math.round(app.battery) + '%'); batEl.classList.toggle('low', app.battery < 20);
      pHist.style.display = S.dispHist ? '' : 'none';
      pStor.style.display = S.dispStorage ? '' : 'none';
      pAud.style.display = S.dispAudio ? '' : 'none';
      setTxt(pHist.querySelector('.pt'), S.recLut && S.lutOn ? 'Rec.709' : { rec709: 'Rec.709', rec2020: 'Rec.2020 - HDR', p3: 'P3 D65', applelog: 'Apple Log - HDR' }[S.colorspace]);
      setTxt(pAud.querySelector('.pt'), S.audioSrc === 'none' ? 'No Audio' : 'iPhone Microphone');
      var remain = app.free * 8 / (totalRate(S) * 1e6);
      setTxt(pStor.querySelector('.t2'), fmtDur(remain));
      var pct = app.free / app.total;
      pStor.querySelector('.bar b').style.width = (pct * 100).toFixed(1) + '%';
      setTxt(pStor.querySelector('.t3 span'), Math.round(pct * 100) + '%');
      setTxt(pStor.querySelector('.t3 span:last-child'), Math.round(app.free / 1e9) + 'GB');
      setTxt(pStor.querySelector('.t1'), S.saveTo === 'external' ? 'External SSD' : 'Internal Storage');
      lutBadge.style.display = S.lutOn ? '' : 'none';
      hud.style.visibility = od === 'lut' ? 'hidden' : '';
      torchBadge.style.display = S.torch ? '' : 'none';
      fcLeg.style.display = S.falseColor ? '' : 'none';
      img.classList.toggle('rec', S.recording);
      recB.classList.toggle('rec', S.recording);
      RB.focus.querySelector('.aa').style.display = S.afAuto ? '' : 'none';
      RB.focus.classList.toggle('on', od === 'focus');
      RB.expo.querySelector('.aa').style.display = (S.shAuto || S.isoAuto) ? '' : 'none';
      RB.expo.classList.toggle('on', od === 'exposure');
      RB.tools.classList.toggle('on', od === 'tools');
      RB.lens.classList.toggle('on', od === 'lens');
      setTxt(RB.lens.querySelector('.sub'), L.front ? 'Front' : (Math.round(S.zoom * 10) / 10) + 'x');
      RB.lut.classList.toggle('on', od === 'lut' || S.lutOn);
      RB.lut.querySelector('.dot').style.display = S.lutOn ? '' : 'none';
      RB.stab.classList.toggle('on', S.stab !== 'off');
      drawOverlay();
    }
    app.updateHud = updateHud;

    /* ---------- гистограмма в панели ---------- */
    function drawHist() {
      var w = histCv.width, hh = histCv.height, ctx = histCtx, hs = eng.hist, mx = 1;
      for (var c = 0; c < 3; c++) for (var i = 1; i < 63; i++) if (hs[c][i] > mx) mx = hs[c][i];
      ctx.clearRect(0, 0, w, hh);
      ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, w - 1, hh - 1);
      var cols = ['rgba(255,70,70,0.55)', 'rgba(70,230,90,0.5)', 'rgba(70,140,255,0.55)'];
      ctx.globalCompositeOperation = 'lighter';
      for (c = 0; c < 3; c++) {
        ctx.fillStyle = cols[c]; ctx.beginPath(); ctx.moveTo(0, hh);
        for (i = 0; i < 64; i++) { var v = Math.min(1, hs[c][i] / mx); ctx.lineTo(i / 63 * w, hh - Math.sqrt(v) * (hh - 3)); }
        ctx.lineTo(w, hh); ctx.closePath(); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      var bs = pHist.querySelectorAll('.clipi b');
      bs[0].style.background = eng.stat.clip > 0.004 ? '#ff4a42' : 'transparent';
      bs[1].style.background = eng.stat.black > 0.03 ? '#4a8cff' : 'transparent';
    }

    /* ---------- звук: имитация уровня и индикаторы ---------- */
    var aud = { lv: [-60, -60, -60, -60], pk: [-60, -60, -60, -60], t: 0 };
    function audioTick(dt, time) {
      var sc = eng.scene() || sceneById(S.scene), n = S.audioCh === 'mono' ? 1 : S.audioCh === '4ch' ? 4 : 2;
      var micK = { auto: 0, back: sc.speech ? -2 : 1, bottom: -3, front: sc.speech ? -6 : -4 }[S.iphoneMic] || 0;
      for (var c = 0; c < 4; c++) {
        var target = -90;
        if (S.audioSrc !== 'none' && c < n) {
          var base = sc.audio + micK + (Math.random() - 0.5) * 6;
          if (sc.speech) { var env = Math.max(0, Math.sin(time * 3.1 + c * 0.2) * Math.sin(time * 0.9) ); base = sc.audio - 14 + env * 16 + (Math.random() - 0.5) * 5; }
          if (S.audioCh === 'dualmono' && c === 1) base -= 6;
          target = base;
        }
        var vu = S.metering.indexOf('vu') === 0, att = vu ? 6 : 30, rel = vu ? 6 : 3;
        var k = 1 - Math.exp(-dt * (target > aud.lv[c] ? att : rel));
        aud.lv[c] += (target - aud.lv[c]) * k;
        aud.pk[c] = Math.max(aud.pk[c] - dt * 12, aud.lv[c]);
      }
      if (!S.dispAudio && app.open !== 'audbig') return;
      drawMeters(audCtx, audCv.width, audCv.height, n, false);
      if (app.audBig) drawMeters(app.audBig.getContext('2d'), app.audBig.width, app.audBig.height, n, true);
    }
    function drawMeters(ctx, w, hh, n, big) {
      ctx.clearRect(0, 0, w, hh);
      var scale = [-45, -30, -20, -10, -6, -3, 0, 3], x0 = big ? 24 : 12, x1 = w - 6, rowH = Math.min(big ? 26 : 13, (hh - (big ? 30 : 20)) / Math.max(n, 2));
      function X(db) { var t = (db + 45) / 48; return x0 + clamp(t, 0, 1) * (x1 - x0); }
      var ref = S.metering.indexOf('18') > 0 ? -18 : -20;
      for (var c = 0; c < n; c++) {
        var y = 4 + c * (rowH + 3);
        ctx.fillStyle = '#1e5a26'; ctx.fillRect(x0, y, X(-12) - x0, rowH);
        ctx.fillStyle = '#5e5a1e'; ctx.fillRect(X(-12), y, X(-3) - X(-12), rowH);
        ctx.fillStyle = '#5e1e1e'; ctx.fillRect(X(-3), y, x1 - X(-3), rowH);
        var lv = aud.lv[c];
        if (lv > -45) {
          ctx.fillStyle = '#3ad24a'; ctx.fillRect(x0, y, Math.min(X(lv), X(-12)) - x0, rowH);
          if (lv > -12) { ctx.fillStyle = '#e8d43a'; ctx.fillRect(X(-12), y, Math.min(X(lv), X(-3)) - X(-12), rowH); }
          if (lv > -3) { ctx.fillStyle = '#ff3b30'; ctx.fillRect(X(-3), y, X(lv) - X(-3), rowH); }
          ctx.fillStyle = '#fff'; ctx.fillRect(X(aud.pk[c]) - 1, y, 2, rowH);
        }
        ctx.fillStyle = '#fff'; ctx.font = (big ? 12 : 9) + 'px Lato,Arial'; ctx.fillText(String(c + 1), 1, y + rowH - 1);
      }
      var yl = 4 + n * (rowH + 3) + (big ? 12 : 9);
      ctx.font = (big ? 11 : 8.5) + 'px Lato,Arial'; ctx.textAlign = 'center';
      scale.forEach(function (d) { ctx.fillStyle = '#fff'; ctx.fillText(String(d), X(d), yl); ctx.fillRect(X(d) - 0.5, yl - (big ? 22 : 13), 1, 2); });
      ctx.fillStyle = '#3a8cff'; ctx.fillRect(X(ref) - 1, 2, 2, n * (rowH + 3));
      ctx.textAlign = 'left';
    }

    /* ---------- запись ---------- */
    var rec = null, beepCtx = null;
    function beep() {
      try { beepCtx = beepCtx || new (window.AudioContext || window.webkitAudioContext)(); var o = beepCtx.createOscillator(), g = beepCtx.createGain(); o.frequency.value = 1000; g.gain.value = 0.08; o.connect(g); g.connect(beepCtx.destination); o.start(); o.stop(beepCtx.currentTime + 0.12); } catch (e) {}
    }
    function flash() { flashEl.style.transition = 'none'; flashEl.style.opacity = '0.85'; setTimeout(function () { flashEl.style.transition = 'opacity .4s'; flashEl.style.opacity = '0'; }, 60); }
    app.toggleRec = function () {
      if (S.recording) return stopRec();
      if (needsExternal(S) && S.dropFrame === 'stop') { app.toast('Запись невозможна: ProRes 4K выше 30 к/с на iPhone 15 Pro пишется только на внешний SSD (Settings → Media → Save Clips to → Pro Video Storage).', true); return; }
      S.recording = true;
      rec = { t0: app.time, frames: [], lastCap: -1, tc0: app.tcFrames, dropped: false, snap: null, maxClip: 0 };
      if (S.trigger !== 'none') beep();
      if (S.trigger === 'beeperflash') flash();
      if (needsExternal(S)) { rec.dropped = true; app.toast('Media dropped frames — носитель не успевает записывать ProRes 4K ' + curFps(S) + ' к/с. Нужен внешний SSD.', true); }
      if (app.tasks) app.tasks.onRecStart();
      app.save();
    };
    function captureFrame() {
      var c = document.createElement('canvas'); c.width = 192; c.height = 108;
      c.getContext('2d').drawImage(cv, 0, 0, 192, 108);
      try { return c.toDataURL('image/jpeg', 0.7); } catch (e) { return ''; }
    }
    app.metaNow = function () {
      var L = lensById(S.lens), face = eng.measureFace();
      return {
        scene: S.scene, sceneName: sceneById(S.scene).name, lens: L.front ? 'Front' : L.eq + ' mm', zoom: S.zoom, fps: S.fps, offSpeed: S.offSpeed, offFps: S.offFps,
        shutter: fmtShutter(S, S.shDen), shDen: S.shDen, t: shutterTime(S), shAuto: S.shAuto, iso: Math.round(S.iso), isoAuto: S.isoAuto,
        wbK: Math.round(S.wbK), wbAuto: S.wbAuto, tint: Math.round(S.tint), tintAuto: S.tintAuto, focus: S.focus, afAuto: S.afAuto,
        codec: S.codec, codecName: CODECS.filter(function (c) { return c[0] === S.codec; })[0][1], resolution: S.resolution, colorspace: S.colorspace,
        lutOn: S.lutOn, lut: S.lut, recLut: S.recLut && S.lutOn, stab: S.stab, timelapse: S.timelapse, dropped: needsExternal(S),
        reel: S.reel, sceneNo: S.sceneNo, take: S.take, interior: S.interior, day: S.day,
        clip: eng.stat.clip, meanDisp: eng.stat.meanDisp, flicker: eng.stat.flickerAmp, faceIre: face.ire, faceDepth: face.depth, focusD: focusToD(S.focus),
        stops: eng.expStops || 0,
        zebra: S.zebra, fa: S.fa, falseColor: S.falseColor, fg: S.fg, fgRatio: S.fgRatio, saveTo: S.saveTo, hdr: S.hdr, audioSrc: S.audioSrc, cinematic: S.cinematic, torch: S.torch
      };
    };
    function stopRec() {
      S.recording = false;
      if (S.trigger !== 'none') beep();
      var dur = app.time - rec.t0, L = lensById(S.lens), clipNo = app.clips.length + 1 + (app.clipBase || 18);
      var d = new Date(), stamp = pad(d.getMonth() + 1) + pad(d.getDate()) + pad(d.getHours()) + pad(d.getMinutes());
      var name = S.filename === 'ios' ? 'IMG_' + pad(4000 + clipNo, 4) : S.camName + pad(S.reel, 3) + '_' + stamp + '_C' + pad(clipNo, 3);
      if (!rec.frames.length) rec.frames.push(captureFrame());
      var meta = app.metaNow(); meta.dropped = rec.dropped;
      var clip = {
        id: Date.now(), name: name, dur: dur, frames: rec.frames, thumb: rec.frames[Math.floor(rec.frames.length / 2)] || rec.frames[0],
        playSpeed: S.offSpeed ? S.fps / S.offFps : S.timelapse ? 8 : 1,
        meta: meta,
        good: false
      };
      app.clips.push(clip);
      S.take += 1;
      if (app.tasks) app.tasks.onClip(clip);
      app.toast('Клип ' + name + ' записан (' + fmtClipDur(dur) + '). Он во вкладке Media.');
      rec = null; app.save();
    }
    app.stopRec = function () { if (S.recording) stopRec(); };
    app.recTick = function (dt) {
      if (!S.recording || !rec) return;
      var fpsE = curFps(S);
      if (S.timelapse) { var iv = { '2s': 2, '5s': 5, '10s': 10, '30s': 30, '1m': 60, '5m': 300, '10m': 600 }[S.tlInterval]; app.tcFrames += dt / iv; }
      else app.tcFrames += dt * S.fps;
      app.free = Math.max(0, app.free - totalRate(S) * 1e6 / 8 * dt);
      if (app.time - rec.lastCap > 1 / 6 && rec.frames.length < 90) { rec.frames.push(captureFrame()); rec.lastCap = app.time; }
      if (app.free <= 0) { app.toast('Носитель заполнен — запись остановлена.', true); stopRec(); }
    };

    /* ---------- сообщения ---------- */
    var toastT = null;
    app.toast = function (msg, warn) {
      var t = scr.querySelector('.bm-toast'); if (!t) { t = h('div', { cls: 'bm-toast' }); scr.appendChild(t); }
      t.textContent = msg; t.className = 'bm-toast' + (warn ? ' warn' : ''); t.style.display = '';
      clearTimeout(toastT); toastT = setTimeout(function () { t.style.display = 'none'; }, warn ? 5200 : 3200);
    };

    /* ---------- касания по кадру: AE/AF, свайпы ---------- */
    var gst = null;
    img.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.bm-dial,.bm-tools,.bm-lutp,.bm-stabp,.bm-side,.bm-card,.bm-panel,.bm-hud .it,.bm-handle,.bm-tc,.bm-fmt,.bm-bat,.bm-onoff,.bm-gridpop,.bm-slate')) return;
      gst = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    img.addEventListener('pointerup', function (e) {
      if (!gst || app.helpMode) { gst = null; return; }
      var dx = (e.clientX - gst.x) / app.scale, dy = (e.clientY - gst.y) / app.scale; gst = null;
      if (dimEl.style.opacity === '0.92') { dimEl.style.opacity = '0'; return; }
      if (Math.abs(dy) > 45 && Math.abs(dy) > Math.abs(dx)) { hud.classList.toggle('hidden'); return; }
      if (dx > 60 && Math.abs(dx) > Math.abs(dy)) { if (S.recording && S.swipeDim) { dimEl.style.opacity = '0.92'; dimEl.style.pointerEvents = 'auto'; } return; }
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
        if (app.open && app.open !== 'tools') { app.closeDial(); return; }
        var r = img.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        if (!S.afAuto && !S.shAuto && !S.isoAuto) return;
        S.tap = { x: px, y: py };
        afBox.style.left = px * 705 + 'px'; afBox.style.top = py * 397 + 'px';
        afBox.setAttribute('data-l', S.afAuto && (S.shAuto || S.isoAuto) ? 'AE/AF' : S.afAuto ? 'AF' : 'AE');
        afBox.style.display = ''; clearTimeout(app.afT); app.afT = setTimeout(function () { afBox.style.display = 'none'; }, 2200);
      }
    });
    dimEl.addEventListener('click', function () { dimEl.style.opacity = '0'; dimEl.style.pointerEvents = 'none'; });

    /* клавиши: кнопки громкости — ↑/↓, пробел */
    el.addEventListener('keydown', function (e) {
      if (e.target.closest('input,select,textarea')) return;
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === ' ') && S.volumeRec && app.view === 'camera') { e.preventDefault(); app.toggleRec(); }
      if (e.key === 'Escape') { app.closeDial(); app.closeOverlay(); }
    });

    /* ---------- сохранение ---------- */
    var saveT = null;
    app.save = function () { clearTimeout(saveT); saveT = setTimeout(function () { var o = {}; for (var k in S) if (k !== 'recording' && k !== 'tap') o[k] = S[k]; store('settings', o); }, 400); };

    /* ---------- модули ---------- */
    buildDials(app);
    buildSettings(app);
    buildMedia(app);
    buildSidePanel(app);
    buildTasks(app);
    bindHelp(app);

    /* ---------- главный цикл ---------- */
    var last = performance.now(), visible = true, acc = 0;
    app.time = 0;
    if (window.IntersectionObserver) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(el);
    function loop(now) {
      requestAnimationFrame(loop);
      var dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (!visible || document.hidden) return;
      acc += dt;
      if (acc < 1 / 30) return;
      dt = acc; acc = 0;
      app.time += dt;
      app.battery = Math.max(1, app.battery - dt * (0.0025 + (S.recording ? 0.006 : 0) + (S.torch ? 0.01 : 0)));
      if (app.view === 'camera' || S.recording) {
        eng.wantWave = app.open === 'scope';
        eng.frame(app.time, dt);
        /* вывод: стабилизация (кроп + дрожание), де-сквиз, переворот, зеркало */
        var sh = eng.shake || { x: 0, y: 0 }, crop = { off: 1, standard: 1.06, cinematic: 1.12, extreme: 1.25 }[S.stab] || 1;
        var dq = parseFloat(S.desqueeze) || 1, mir = lensById(S.lens).front && S.mirrorFront, flip = S.flipSlr;
        cv.style.transform = 'translate(' + sh.x + 'px,' + sh.y + 'px) scale(' + (crop * dq * (mir ? -1 : 1)) + ',' + crop + ')' + (flip ? ' rotate(180deg)' : '');
        cvx.drawImage(eng.out, 0, 0);
        if (S.dispHist) drawHist();
        if (app.open === 'scope') app.drawScope();
        updateHud();
        audioTick(dt, app.time);
        app.recTick(dt);
        if (app.dial) app.dial.tick();
        if (app.tasks) app.tasks.tick();
      }
      app.sideTick();
    }
    fit();
    app.go('camera');
    requestAnimationFrame(loop);
    app.showHelpText(null);
    return app;
  }
  /* =====================================================================
   *  КОЛЁСА (вертикальные шкалы у правого края кадра), инструменты, LUT,
   *  стабилизация, боковые панели ⋮, оверлеи
   * ===================================================================== */
  function range(a, b, st, dec) { var r = []; for (var v = a; v <= b + 1e-9; v += st) r.push(+v.toFixed(dec == null ? 3 : dec)); return r; }
  var ZOOMS = range(0.5, 1, 0.1, 1).concat(range(1.1, 5, 0.1, 1)).concat(range(5.5, 15, 0.5, 1));
  var WB_VALUES = range(2500, 10000, 50, 0);
  var TINT_VALUES = range(-50, 50, 1, 0);
  var FOCUS_VALUES = range(0, 1, 0.002, 3);
  var EV_VALUES = range(-3, 3, 0.1, 1);
  var PCT = function (a, b) { return range(a, b, 1, 0); };

  function buildDials(app) {
    var S = app.S, img = app.img, wrap = h('div', { cls: 'bm-ov' }); wrap.style.pointerEvents = 'none'; img.appendChild(wrap);
    app.toolSel = 'zebra';
    function lensForZoom(z) { return z < 1 ? 'uw' : z < 2 ? 'w' : z < 5 ? 'w2' : 't'; }
    function setZoom(z) { S.zoom = z; if (!lensById(S.lens).front) { var nl = lensForZoom(z); if (nl !== S.lens) S.lens = nl; } app.eng.dirty = true; app.save(); }
    function setLens(id, z) { S.lens = id; S.zoom = z; app.eng.dirty = true; app.save(); }
    function manualSh() { S.shAuto = false; }
    function fpsValues() { var a = FPS_LIST.slice(); if (maxFpsFor(S) > 60) a = a.concat(FPS_HD_EXTRA); return a; }
    function shValues() {
      var fe = curFps(S);
      if (S.shutterMeas === 'angle') return SHUTTER_ANGLES.slice();
      return SHUTTER_SPEEDS.filter(function (d) { return d >= fe - 0.01; });
    }
    function ffQuick() {
      var base = S.flickerHz === '60' ? [120, 60, 40, 30] : [100, 50, 33.33, 25], fe = curFps(S);
      return base.map(function (den) {
        var lbl = S.shutterMeas === 'angle' ? (Math.round(360 * fe / den * 10) / 10) + '°' : '1/' + Math.round(den);
        return { label: lbl, h: 'shutter', dis: function () { return den < fe - 0.01 || S.shLock; }, on: function () { return !S.shAuto && Math.abs(1 / shutterTime(S) - den) < 0.6; },
          act: function () { manualSh(); S.shDen = den; S.shAngle = Math.round(360 * fe / den * 10) / 10; } };
      });
    }
    var WBI = { daylight: IC.sun, incandescent: IC.bulb, fluorescent: IC.fluo, shade: IC.shade, cloud: IC.cloud };

    var DEFS = {
      lens: function () { return {
        values: ZOOMS, cur: function () { return lensById(S.lens).front ? 1 : S.zoom; }, set: function (v) { if (lensById(S.lens).front) S.lens = 'w'; setZoom(v); }, label: function (v) { return (Math.round(v * 10) / 10) + 'x'; },
        top: [{ icon: IC.reset, h: 'zoomReset', act: function () { setLens('w', 1); } }],
        quick: [
          { icon: IC.lensSmall, small: '120mm', h: 'lens', on: function () { return S.lens === 't'; }, act: function () { setLens('t', 5); } },
          { icon: IC.lensSmall, small: '48mm', h: 'lens', on: function () { return S.lens === 'w2'; }, act: function () { setLens('w2', 2); } },
          { icon: IC.lensSmall, small: '24mm', h: 'lens', on: function () { return S.lens === 'w'; }, act: function () { setLens('w', 1); } },
          { icon: IC.lensSmall, small: '13mm', h: 'lens', on: function () { return S.lens === 'uw'; }, act: function () { setLens('uw', 0.5); } },
          { icon: IC.front, small: 'Front', h: 'front', on: function () { return S.lens === 'f'; }, act: function () { setLens('f', 1); } }
        ],
        bottom: [{ icon: IC.switchCam, h: 'front', act: function () { if (S.lens === 'f') setLens('w', 1); else setLens('f', 1); } }]
      }; },
      fps: function () { return {
        values: S.offSpeed ? OFFSPEED_LIST.filter(function (f) { return f <= maxFpsFor(S); }) : fpsValues(),
        cur: function () { return S.offSpeed ? S.offFps : S.fps; },
        set: function (v) { if (S.offSpeed) S.offFps = v; else S.fps = v; if (!S.shAuto && S.shutterMeas === 'speed' && S.shDen < curFps(S)) S.shDen = curFps(S); app.save(); },
        label: function (v) { return String(v); },
        top: [{ label: 'OFF/<br>SPEED', h: 'offspeed', on: function () { return S.offSpeed; }, act: function () { S.offSpeed = !S.offSpeed; if (S.offSpeed && S.offFps > maxFpsFor(S)) S.offFps = 60; app.reopenDial(); } }],
        bottom: [{ label: 'TIME<br>LAPSE', h: 'timelapseBtn', on: function () { return S.timelapse; }, act: function () { S.timelapse = !S.timelapse; app.toast(S.timelapse ? 'Таймлапс включён: 1 кадр каждые ' + S.tlInterval.replace('s', ' с').replace('m', ' мин') + '.' : 'Таймлапс выключен.'); } }]
      }; },
      shutter: function () { return {
        values: shValues(),
        cur: function () { return S.shutterMeas === 'angle' ? (S.shAuto ? 360 * curFps(S) / S.shDen : S.shAngle) : 1 / shutterTime(S); },
        set: function (v) { if (S.shLock) return; manualSh(); if (S.shutterMeas === 'angle') { S.shAngle = v; S.shDen = 360 * curFps(S) / v; } else { S.shDen = v; S.shAngle = 360 * curFps(S) / v; } app.save(); },
        label: function (v) { return S.shutterMeas === 'angle' ? v + '°' : '1/' + Math.round(v); },
        top: [{ icon: IC.lock, h: 'lock', on: function () { return S.shLock; }, act: function () { S.shLock = !S.shLock; if (S.shLock) S.shAuto = false; } }],
        quick: ffQuick()
      }; },
      iso: function () { var L = lensById(S.lens); return {
        values: ISO_FINE.filter(function (v) { return v >= L.isoMin && v <= L.isoMax; }),
        cur: function () { return S.iso; }, set: function (v) { if (S.isoLock) return; S.isoAuto = false; S.iso = v; app.save(); }, label: function (v) { return String(Math.round(v)); },
        top: [{ icon: IC.lock, h: 'lock', on: function () { return S.isoLock; }, act: function () { S.isoLock = !S.isoLock; if (S.isoLock) S.isoAuto = false; } }],
        quick: ISO_QUICK.map(function (v) { return { label: String(v), h: 'iso', dis: function () { return v < L.isoMin || v > L.isoMax || S.isoLock; }, on: function () { return !S.isoAuto && Math.abs(S.iso - v) < 1; }, act: function () { S.isoAuto = false; S.iso = v; } }; })
      }; },
      wb: function () { return {
        values: WB_VALUES, cur: function () { return S.wbK; }, set: function (v) { if (S.wbLock) return; S.wbAuto = false; S.wbK = v; app.save(); }, label: function (v) { return Math.round(v) + 'K'; },
        top: [{ label: 'AUTO', h: 'auto', on: function () { return S.wbAuto; }, act: function () { S.wbAuto = !S.wbAuto; S.wbLock = false; } }, { icon: IC.lock, h: 'lock', on: function () { return S.wbLock; }, act: function () { S.wbLock = !S.wbLock; if (S.wbLock) S.wbAuto = false; } }],
        quick: WB_PRESETS.map(function (p) { return { icon: WBI[p.id], h: 'wb', title: p.name + ' ' + p.K + 'K', on: function () { return !S.wbAuto && Math.abs(S.wbK - p.K) < 1; }, act: function () { if (S.wbLock) return; S.wbAuto = false; S.wbK = p.K; } }; })
      }; },
      tint: function () { return {
        values: TINT_VALUES, cur: function () { return S.tint; }, set: function (v) { if (S.tintLock) return; S.tintAuto = false; S.tint = v; app.save(); }, label: function (v) { return String(Math.round(v)); },
        top: [{ label: 'AUTO', h: 'auto', on: function () { return S.tintAuto; }, act: function () { S.tintAuto = !S.tintAuto; S.tintLock = false; } }, { icon: IC.lock, h: 'lock', on: function () { return S.tintLock; }, act: function () { S.tintLock = !S.tintLock; if (S.tintLock) S.tintAuto = false; } }],
        quick: WB_PRESETS.map(function (p) { return { icon: WBI[p.id], h: 'tint', title: p.name + ' tint ' + p.tint, on: function () { return !S.tintAuto && Math.abs(S.tint - p.tint) < 0.5; }, act: function () { if (S.tintLock) return; S.tintAuto = false; S.tint = p.tint; } }; })
      }; },
      focus: function () { return {
        values: FOCUS_VALUES, cur: function () { return S.focus; }, set: function (v) { S.afAuto = false; S.focus = v; }, label: function (v) { return v.toFixed(3); },
        top: [{ label: 'AUTO', h: 'auto', on: function () { return S.afAuto; }, act: function () { S.afAuto = !S.afAuto; } }],
        bottom: [{ icon: IC.mount, h: 'rackFocus', on: function () { return app.rackOpen; }, act: function () { app.rackOpen = !app.rackOpen; app.reopenDial(); } }],
        mid: app.rackOpen ? [0, 1, 2].map(function (i) {
          return { label: (S['rack' + i] != null ? S['rack' + i].toFixed(2) : '+') + '<br><small>' + 'ABC'[i] + '</small>', h: 'rackFocus', on: function () { return S['rack' + i] != null && Math.abs(S.focus - S['rack' + i]) < 0.003; },
            act: function () { if (S['rack' + i] == null) { S['rack' + i] = S.focus; app.toast('Точка фокуса ' + 'ABC'[i] + ' сохранена. Нажмите ещё раз, чтобы перевести фокус.'); app.reopenDial(); } else { S.afAuto = false; app.rackTo(S['rack' + i]); } } };
        }) : null
      }; },
      exposure: function () { return {
        values: EV_VALUES, cur: function () { return S.ev; }, set: function (v) { S.ev = v; app.save(); }, label: function (v) { return (v > 0 ? '+' : v < 0 ? '' : '') + v.toFixed(1); },
        top: [{ label: 'AUTO', h: 'auto', on: function () { return S.shAuto && S.isoAuto; }, act: function () { var on = !(S.shAuto && S.isoAuto); S.shAuto = S.isoAuto = on; S.shLock = S.isoLock = false; if (!on) { S.shAuto = false; S.isoAuto = false; } } }]
      }; }
    };
    /* шкалы инструментов */
    var TOOLDEFS = {
      zebra: function () { return { values: PCT(75, 100), cur: function () { return S.zebraLvl; }, set: function (v) { S.zebraLvl = v; S.zebraMode = 'level'; }, label: function (v) { return v + '%'; },
        mid: [{ label: 'Mid<br>Grey', h: 'mgZebra', on: function () { return S.zebraMode === 'mg'; }, act: function () { S.zebraMode = S.zebraMode === 'mg' ? 'level' : 'mg'; S.zebra = true; } },
              { label: 'MG+1', h: 'mgZebra', on: function () { return S.zebraMode === 'mg1'; }, act: function () { S.zebraMode = S.zebraMode === 'mg1' ? 'level' : 'mg1'; S.zebra = true; } }] }; },
      fa: function () { return { values: PCT(0, 100), cur: function () { return S.faLvl; }, set: function (v) { S.faLvl = v; }, label: function (v) { return v + '%'; } }; },
      fg: function () { return { values: FRAME_GUIDES.map(function (r, i) { return i; }), cur: function () { return FRAME_GUIDES.indexOf(S.fgRatio); }, set: function (v) { S.fgRatio = FRAME_GUIDES[v]; }, label: function (v) { return FRAME_GUIDES[v]; } }; },
      safe: function () { return { values: PCT(5, 100), cur: function () { return S.safeLvl; }, set: function (v) { S.safeLvl = v; }, label: function (v) { return v + '%'; } }; },
      torch: function () { return { values: PCT(0, 100), cur: function () { return S.torchLvl; }, set: function (v) { S.torchLvl = v; S.torchAuto = false; app.eng.dirty = true; }, label: function (v) { return v + '%'; },
        mid: [{ label: 'AUTO', h: 'torch', on: function () { return S.torchAuto; }, act: function () { S.torchAuto = !S.torchAuto; app.eng.dirty = true; } }] }; },
      grid: function () { return null; }, falsecolor: function () { return null; }
    };
    var TOOLS = [['zebra', IC.zebra, 'zebra', 'zebra'], ['fa', IC.faPerson, 'fa', 'fa'], ['grid', IC.grid, 'grid', 'grid'], ['fg', IC.fguide, 'fg', 'fg'], ['safe', IC.safe, 'safe', 'safe'], ['falsecolor', IC.falsecolor, 'falseColor', 'falsecolor'], ['torch', IC.torch, 'torch', 'torch']];

    /* ---------- универсальная шкала ---------- */
    var cur = null;   // { id, spec, root, cv, idx }
    function mkBtn(b, cls) {
      var e = h('button', { cls: cls, type: 'button', 'data-h': b.h || '' }, (b.icon || '') + (b.label ? '<span>' + b.label + '</span>' : '') + (b.small ? '<small>' + b.small + '</small>' : ''));
      if (b.title) e.title = b.title;
      e.onclick = function (ev) { ev.stopPropagation(); b.act(); app.updateHud(); refreshBtns(); app.save(); };
      e.__b = b; return e;
    }
    function refreshBtns() {
      if (!cur) return;
      cur.root.querySelectorAll('button').forEach(function (e) { var b = e.__b; if (!b) return; e.classList.toggle('on', !!(b.on && b.on())); e.classList.toggle('dis', !!(b.dis && b.dis())); });
      if (cur.tools) refreshTools();
    }
    function buildScale(spec, container, offsetRight) {
      var d = h('div', { cls: 'bm-dial', 'data-h': cur.helpKey });
      if (offsetRight) d.style.right = offsetRight + 'px';
      var cvs = h('canvas'); d.appendChild(cvs);
      var bub = h('div', { cls: 'bm-bub' }); d.appendChild(bub);
      container.appendChild(d);
      cur.cv = cvs; cur.bub = bub; cur.spec = spec; cur.scaleEl = d;
      /* перетаскивание */
      var drag = null;
      d.addEventListener('pointerdown', function (e) {
        if (app.helpMode || e.target.closest('button')) return;
        e.preventDefault(); e.stopPropagation();
        drag = { y: e.clientY, i0: nearestIdx(spec.values, spec.cur()), moved: false };
        try { d.setPointerCapture(e.pointerId); } catch (er) {}
      });
      d.addEventListener('pointermove', function (e) {
        if (!drag) return;
        var dy = (e.clientY - drag.y) / app.scale, step = spacing(spec);
        if (Math.abs(dy) > 2) drag.moved = true;
        var ni = clamp(Math.round(drag.i0 + dy / step), 0, spec.values.length - 1);
        if (spec.values[ni] !== spec.cur()) { spec.set(spec.values[ni]); app.updateHud(); }
        draw();
      });
      d.addEventListener('pointerup', function () { drag = null; app.save(); });
      d.addEventListener('wheel', function (e) {
        e.preventDefault(); var i = nearestIdx(spec.values, spec.cur());
        var ni = clamp(i + (e.deltaY < 0 ? 1 : -1) * (spec.values.length > 300 ? 5 : 1), 0, spec.values.length - 1);
        spec.set(spec.values[ni]); app.updateHud(); draw(); app.save();
      }, { passive: false });
      draw();
    }
    function spacing(spec) { var n = spec.values.length; return n > 300 ? 2.2 : n > 100 ? 3.4 : n > 40 ? 7 : 14; }
    function draw() {
      if (!cur || !cur.cv) return;
      var spec = cur.spec, cv = cur.cv, dpr = (window.devicePixelRatio || 1) * (app.scale || 1), W = 40, Hh = 397;
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr); }
      var ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, Hh);
      var vals = spec.values, v = spec.cur(), i0 = nearestIdx(vals, v), step = spacing(spec), every = Math.max(1, Math.ceil(34 / step));
      /* точная позиция для дробных значений (автоматика) */
      var frac = i0;
      if (i0 < vals.length - 1 && vals[i0] !== v && typeof v === 'number') {
        var nb = v > vals[i0] ? i0 + 1 : i0 - 1; if (nb >= 0 && nb < vals.length && vals[nb] !== vals[i0]) frac = i0 + (v - vals[i0]) / (vals[nb] - vals[i0]) * (nb - i0);
      }
      ctx.font = '7.5px Lato,Arial'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (var i = 0; i < vals.length; i++) {
        var y = Hh / 2 - (i - frac) * step; if (y < 8 || y > Hh - 8) continue;
        var major = i % every === 0;
        ctx.strokeStyle = major ? 'rgba(255,255,255,.8)' : 'rgba(255,255,255,.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(major ? 24 : 28, y + 0.5); ctx.lineTo(36, y + 0.5); ctx.stroke();
        if (major) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillText(String(spec.label(vals[i])).replace(/<[^>]+>/g, ''), 21, y); }
      }
      ctx.fillStyle = '#3a8cff'; ctx.fillRect(18, Hh / 2 - 0.75, 22, 1.5);
      setBub(spec.label(typeof v === 'number' && spec.values === FOCUS_VALUES ? v : (typeof v === 'number' && Math.abs(v - vals[i0]) > 1e-6 && cur.id !== 'fg' ? v : vals[i0])));
    }
    function setBub(t) { if (cur.bub.__t !== t) { cur.bub.__t = t; cur.bub.innerHTML = t; } }

    function open(id) {
      close();
      app.open = id; cur = { id: id };
      var root = h('div', { cls: 'bm-ov' }); root.style.pointerEvents = 'none'; wrap.appendChild(root); cur.root = root;
      if (id === 'tools') return openTools(root);
      if (id === 'lut') return openLut(root);
      if (id === 'stab') return openStab(root);
      var spec = DEFS[id](); cur.helpKey = { lens: 'lens', fps: 'fps', shutter: 'shutter', iso: 'iso', wb: 'wb', tint: 'tint', focus: 'focus', exposure: 'exposure' }[id];
      buildScale(spec, root, 0);
      decorate(spec, root, cur.scaleEl);
      refreshBtns();
    }
    function decorate(spec, root, scaleEl) {
      if (spec.quick) { var qc = h('div', { cls: 'bm-qc' }); spec.quick.forEach(function (b) { qc.appendChild(mkBtn(b, 'bm-q')); }); scaleEl.appendChild(qc); }
      if (spec.top) { var tp = h('div', { cls: 'bm-dtop' }); spec.top.forEach(function (b) { tp.appendChild(mkBtn(b, 'tb')); }); scaleEl.appendChild(tp); }
      if (spec.bottom) { var bt = h('div', { cls: 'bm-dbot' }); spec.bottom.forEach(function (b) { bt.appendChild(mkBtn(b, 'tb')); }); scaleEl.appendChild(bt); }
      if (spec.mid) { var md = h('div', { cls: 'bm-midbtn' }); spec.mid.forEach(function (b) { md.appendChild(mkBtn(b, 'tb')); }); scaleEl.appendChild(md); }
    }
    function close() { if (cur && cur.root) cur.root.remove(); cur = null; app.open = null; }
    app.toggleDial = function (id) { if (app.helpMode) return; if (app.open === id) { close(); app.updateHud(); return; } closeSideOnly(); open(id); app.updateHud(); };
    app.closeDial = function () { close(); app.updateHud(); };
    app.reopenDial = function () { if (!cur) return; var id = cur.id, ts = app.toolSel; close(); app.toolSel = ts; open(id); };
    app.dial = { redraw: function () { draw(); }, tick: function () { if (cur && cur.cv) draw(); if (cur) refreshBtns(); } };

    /* перевод фокуса */
    app.rackTo = function (target) {
      var from = S.focus, t0 = performance.now(), dur = 1400;
      function st(now) { var k = clamp((now - t0) / dur, 0, 1), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; S.focus = from + (target - from) * e; if (k < 1) requestAnimationFrame(st); }
      requestAnimationFrame(st);
    };

    /* ---------- инструменты монитора ---------- */
    function toolOn(id) { return id === 'falsecolor' ? S.falseColor : S[id]; }
    function setToolOn(id, v) { if (id === 'falsecolor') S.falseColor = v; else S[id] = v; if (id === 'torch') app.eng.dirty = true; }
    function openTools(root) {
      cur.tools = true;
      var col = h('div', { cls: 'bm-tools' }); root.appendChild(col);
      TOOLS.forEach(function (t) {
        var b = h('button', { cls: 'bm-tl', type: 'button', 'data-h': t[3] }, t[1] + (t[0] === 'torch' ? '<span class="lv"></span>' : ''));
        b.onclick = function (e) { e.stopPropagation(); if (app.toolSel === t[0]) setToolOn(t[0], !toolOn(t[0])); app.toolSel = t[0]; buildToolScale(); refreshTools(); app.save(); };
        b.__t = t[0]; col.appendChild(b);
      });
      var onoff = h('button', { cls: 'bm-onoff', type: 'button', 'data-h': 'tools' }, 'OFF'); root.appendChild(onoff); cur.onoff = onoff;
      onoff.onclick = function (e) { e.stopPropagation(); var t = app.toolSel; setToolOn(t, !toolOn(t)); refreshTools(); app.save(); };
      cur.col = col;
      buildToolScale(); refreshTools();
    }
    function buildToolScale() {
      if (cur.toolRoot) cur.toolRoot.remove();
      var r = h('div', { cls: 'bm-ov' }); r.style.pointerEvents = 'none'; cur.root.insertBefore(r, cur.root.firstChild); cur.toolRoot = r;
      cur.cv = null;
      var t = app.toolSel, spec = TOOLDEFS[t] ? TOOLDEFS[t]() : null;
      cur.helpKey = { zebra: 'zebra', fa: 'fa', grid: 'grid', fg: 'fg', safe: 'safe', falsecolor: 'falsecolor', torch: 'torch' }[t];
      if (t === 'grid') {
        var gp = h('div', { cls: 'bm-gridpop' });
        [['gridThirds', IC.grid, 'Thirds'], ['gridHorizon', svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 12h10M12 9v6"/><path d="M7 9h3" />'), 'Horizon'], ['gridCross', svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 12h4M12 10v4"/>'), 'Crosshair'], ['gridDot', svg('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/>'), 'Centre Dot']].forEach(function (g) {
          var b = h('button', { cls: 'tl', type: 'button', 'data-h': 'grid', title: g[2] }, g[1]);
          b.onclick = function (e) { e.stopPropagation(); S[g[0]] = !S[g[0]]; S.grid = S.gridThirds || S.gridHorizon || S.gridCross || S.gridDot; refreshTools(); app.save(); };
          b.__g = g[0]; gp.appendChild(b);
        });
        r.appendChild(gp); cur.gridPop = gp;
      } else cur.gridPop = null;
      if (spec) { buildScale(spec, r, 44); cur.scaleEl.style.width = '110px'; decorate(spec, r, cur.scaleEl); }
    }
    function refreshTools() {
      if (!cur || !cur.col) return;
      cur.col.querySelectorAll('.bm-tl').forEach(function (b) { b.classList.toggle('sel', b.__t === app.toolSel); b.classList.toggle('en', !!toolOn(b.__t)); var lv = b.querySelector('.lv'); if (lv) lv.textContent = S.torchAuto ? 'A' : S.torchLvl; });
      var on = toolOn(app.toolSel); cur.onoff.textContent = on ? 'ON' : 'OFF'; cur.onoff.classList.toggle('on', !!on);
      if (cur.gridPop) cur.gridPop.querySelectorAll('.tl').forEach(function (b) { b.classList.toggle('on', !!S[b.__g]); });
      if (cur.toolRoot) cur.toolRoot.querySelectorAll('button').forEach(function (e) { var b = e.__b; if (b) e.classList.toggle('on', !!(b.on && b.on())); });
    }

    /* ---------- LUT ---------- */
    function openLut(root) {
      var p = h('div', { cls: 'bm-lutp', 'data-h': 'lutBtn' }); root.appendChild(p);
      var onoff = h('button', { cls: 'bm-onoff', type: 'button', 'data-h': 'lutBtn' }); onoff.style.right = '6px'; p.appendChild(onoff);
      var lst = h('div', { cls: 'lst' }); p.appendChild(lst);
      var rl = h('button', { cls: 'bm-q', type: 'button', 'data-h': 'recLutBtn', style: 'position:absolute;right:6px;bottom:8px' }, IC.recLut); p.appendChild(rl);
      function render() {
        onoff.textContent = S.lutOn ? 'ON' : 'OFF'; onoff.classList.toggle('on', S.lutOn);
        rl.classList.toggle('on', S.recLut && S.lutOn); rl.classList.toggle('dis', !S.lutOn);
        lst.innerHTML = '';
        LUTS.forEach(function (L, i) {
          if (!S.bmLuts || !S.lutEnabled[i]) return;
          var r = h('button', { cls: 'bm-lr' + (S.lut === L.id ? ' on' : '') + (S.lutOn ? ' lon' : ''), type: 'button', 'data-h': 'lutBtn', 'data-lut': L.id }, '<span>' + L.name + '</span><i class="bm-chip">' + L.chip.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('') + '</i>');
          r.onclick = function (e) { e.stopPropagation(); S.lut = L.id; S.lutOn = true; render(); app.save(); app.showHelpText(L.name, 'LUT', L.about); };
          lst.appendChild(r);
        });
        if (!lst.children.length) lst.innerHTML = '<div style="font-size:10px;color:#aaa;padding:6px">Нет включённых LUT. Settings → LUTs → LUTs Manager.</div>';
      }
      onoff.onclick = function (e) { e.stopPropagation(); S.lutOn = !S.lutOn; if (!S.lutOn) S.recLut = false; render(); app.save(); };
      rl.onclick = function (e) { e.stopPropagation(); if (!S.lutOn) return; S.recLut = !S.recLut; render(); app.toast(S.recLut ? 'LUT будет вшит в запись (Record LUT to Clip).' : 'LUT только на экране, в файл пишется исходный сигнал.'); app.save(); };
      render();
    }
    /* ---------- стабилизация ---------- */
    function openStab(root) {
      var p = h('div', { cls: 'bm-stabp', 'data-h': 'stabBtn' }); root.appendChild(p);
      [['off', 'Off'], ['standard', 'Standard'], ['cinematic', 'Cinematic'], ['extreme', 'Extreme']].forEach(function (o) {
        var b = h('button', { type: 'button', 'data-h': 'stabBtn' }, o[1]); b.classList.toggle('on', S.stab === o[0]);
        b.onclick = function (e) { e.stopPropagation(); S.stab = o[0]; p.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); app.save(); app.updateHud(); };
        p.appendChild(b);
      });
    }

    /* ---------- боковые панели ⋮ ---------- */
    var sideEl = null, sideWhich = null;
    function closeSideOnly() { if (sideEl) { sideEl.remove(); sideEl = null; sideWhich = null; } }
    app.toggleSide = function (w) {
      if (app.helpMode) return;
      if (sideWhich === w) { closeSideOnly(); return; }
      closeSideOnly(); close(); app.updateHud();
      sideWhich = w; sideEl = h('div', { cls: 'bm-side' }); sideEl.style[w === 'left' ? 'left' : 'right'] = '22px';
      if (w === 'left') {
        [[IC.presets, 'presets', function () { app.toggleOverlay('presets'); }], [IC.slate, 'slate', function () { app.toggleOverlay('slate'); }], [IC.remote, 'remoteCam', function () { if (!S.remoteOn) app.toast('Remote Camera Control выключен (Settings → Remote Camera Control).'); }]].forEach(function (b, i) {
          var e = h('button', { type: 'button', 'data-h': b[1] }, b[0]); if (i === 2 && !S.remoteOn) e.classList.add('dis'); e.onclick = function (ev) { ev.stopPropagation(); b[2](); }; sideEl.appendChild(e);
        });
      } else {
        ['f1', 'f2', 'f3'].forEach(function (f) {
          var fn = S[f], e = h('button', { type: 'button', 'data-h': 'fbutton', title: FUNCTIONS.filter(function (x) { return x[0] === fn; })[0][1] }, f.toUpperCase());
          if (!S.fbOn || fn === 'none') e.classList.add('dis');
          if (fnActive(fn)) e.classList.add('on');
          e.onclick = function (ev) { ev.stopPropagation(); if (!S.fbOn) return app.toast('Функциональные кнопки выключены: Settings → Function Buttons.'); if (fn === 'none') return app.toast('Кнопке ' + f.toUpperCase() + ' не назначена функция: Settings → Function Buttons → ' + f.toUpperCase() + '.'); runFn(fn); e.classList.toggle('on', fnActive(fn)); };
          sideEl.appendChild(e);
        });
      }
      app.img.appendChild(sideEl);
    };
    function fnActive(fn) {
      return { zebra: S.zebra, focusassist: S.fa, falsecolor: S.falseColor, frameguide: S.fg, grid: S.grid, safearea: S.safe, lut: S.lutOn, cleanfeed: app.hud.classList.contains('hidden'), torch: S.torch, stab: S.stab !== 'off', aelock: S.shLock && S.isoLock, wblock: S.wbLock }[fn] || false;
    }
    function runFn(fn) {
      switch (fn) {
        case 'zebra': S.zebra = !S.zebra; break; case 'focusassist': S.fa = !S.fa; break; case 'falsecolor': S.falseColor = !S.falseColor; break;
        case 'frameguide': S.fg = !S.fg; break; case 'grid': S.grid = !S.grid; if (S.grid && !(S.gridThirds || S.gridHorizon || S.gridCross || S.gridDot)) S.gridThirds = true; break;
        case 'safearea': S.safe = !S.safe; break; case 'lut': S.lutOn = !S.lutOn; break; case 'cleanfeed': app.hud.classList.toggle('hidden'); break;
        case 'torch': S.torch = !S.torch; app.eng.dirty = true; break; case 'stab': S.stab = S.stab === 'off' ? 'standard' : 'off'; break;
        case 'aelock': var on = !(S.shLock && S.isoLock); S.shLock = S.isoLock = on; if (on) { S.shAuto = false; S.isoAuto = false; } break;
        case 'wblock': S.wbLock = !S.wbLock; if (S.wbLock) S.wbAuto = false; break;
        case 'goodtake': if (app.clips.length) { var c = app.clips[app.clips.length - 1]; c.good = !c.good; app.toast(c.good ? 'Клип ' + c.name + ' отмечен как удачный дубль.' : 'Отметка удачного дубля снята.'); } else app.toast('Пока нет записанных клипов.'); break;
      }
      app.save(); app.updateHud();
    }
    app.runFn = runFn;

    /* ---------- оверлеи: пресеты, слейт, осциллограф, аудио ---------- */
    var ovEl = null;
    app.closeOverlay = function () { if (ovEl) { ovEl.remove(); ovEl = null; } if (app.open === 'scope' || app.open === 'audbig') app.open = null; app.audBig = null; app.overlay = null; };
    app.toggleOverlay = function (id) {
      if (app.helpMode) return;
      if (app.overlay === id) { app.closeOverlay(); return; }
      app.closeOverlay(); closeSideOnly(); close();
      app.overlay = id;
      if (id === 'presets') ovEl = buildPresets();
      if (id === 'slate') ovEl = buildSlate();
      if (id === 'scope') { app.open = 'scope'; ovEl = buildScope(); }
      if (id === 'audbig') { app.open = 'audbig'; ovEl = h('div', { cls: 'bm-card bm-audbig', 'data-h': 'meters' }, '<div>' + (S.audioSrc === 'none' ? 'No Audio' : 'iPhone Microphone') + '</div><canvas width="540" height="180"></canvas>'); app.audBig = ovEl.querySelector('canvas'); ovEl.onclick = app.closeOverlay; }
      (id === 'slate' ? app.views.camera : app.img).appendChild(ovEl);
      app.updateHud();
    };
    function buildPresets() {
      var c = h('div', { cls: 'bm-card bm-presets', 'data-h': 'presets' }), sel = null;
      function list() { return store('presets') || []; }
      function render() {
        var ps = list();
        c.innerHTML = '<h4>Presets</h4>' + (ps.length ? '<div class="lst">' + ps.map(function (p, i) { return '<button type="button" class="pr' + (sel === i ? ' on' : '') + '" data-i="' + i + '" data-h="presets">' + esc(p.name) + '</button>'; }).join('') + '</div>' :
          '<div class="empty">No presets currently created.<br>Create a preset using your current settings<br>by pressing the + icon</div>') +
          '<div class="bar"><button type="button" data-a="add" data-h="presets">' + IC.plus + '</button><button type="button" data-a="apply" data-h="presets">' + IC.check + '</button><button type="button" data-a="over" data-h="presets">' + IC.refresh + '</button><button type="button" data-a="ren" data-h="presets">' + IC.pencil + '</button><button type="button" data-a="del" data-h="presets">' + IC.trash + '</button></div>';
      }
      c.addEventListener('click', function (e) {
        e.stopPropagation(); var b = e.target.closest('button'); if (!b || app.helpMode) return;
        var ps = list();
        if (b.dataset.i != null) { sel = +b.dataset.i; render(); return; }
        var a = b.dataset.a;
        if (a === 'add') { ps.push({ name: 'Preset ' + (ps.length + 1) + ' · ' + sceneById(S.scene).short, s: app.presetSnapshot() }); store('presets', ps); sel = ps.length - 1; app.toast('Пресет сохранён из текущих настроек.'); }
        if (sel == null || !ps[sel]) { render(); return; }
        if (a === 'apply') { app.applyPreset(ps[sel].s); app.toast('Пресет «' + ps[sel].name + '» применён.'); }
        if (a === 'over') { ps[sel].s = app.presetSnapshot(); store('presets', ps); app.toast('Пресет перезаписан текущими настройками.'); }
        if (a === 'ren') { ps[sel].name = ps[sel].name.indexOf('★ ') === 0 ? ps[sel].name.slice(2) : '★ ' + ps[sel].name; store('presets', ps); }
        if (a === 'del') { ps.splice(sel, 1); store('presets', ps); sel = null; }
        render();
      });
      render(); return c;
    }
    var PRESET_KEYS = ['codec', 'bitrate', 'resolution', 'colorspace', 'hdr', 'fps', 'offSpeed', 'offFps', 'shAuto', 'shDen', 'shAngle', 'isoAuto', 'iso', 'wbAuto', 'wbK', 'tintAuto', 'tint', 'lutOn', 'lut', 'recLut', 'stab', 'shutterMeas', 'flickerHz', 'lens', 'zoom', 'zebra', 'zebraLvl', 'fa', 'fg', 'fgRatio', 'falseColor', 'grid', 'gridThirds', 'audioFmt', 'audioCh'];
    app.presetSnapshot = function () { var o = {}; PRESET_KEYS.forEach(function (k) { o[k] = S[k]; }); return o; };
    app.applyPreset = function (o) { for (var k in o) if (PRESET_KEYS.indexOf(k) >= 0) S[k] = o[k]; app.eng.dirty = true; app.save(); app.updateHud(); };

    var slatePage = 0;
    function buildSlate() {
      var c = h('div', { cls: 'bm-slate', 'data-h': 'slate' });
      function step(k, lbl) { return '<div class="bm-sc" data-h="slate"><div class="l">' + lbl + '</div><div class="bm-step"><button type="button" data-k="' + k + '" data-d="-1">' + IC.chevL + '</button><b>' + S[k] + '</b><button type="button" data-k="' + k + '" data-d="1">' + IC.chevR + '</button></div></div>'; }
      function tg(k, v, lbl) { return '<button type="button" class="bm-tg' + (S[k] === v ? ' on' : '') + '" data-t="' + k + '" data-v="' + v + '" data-h="slate">' + lbl + '</button>'; }
      function field(k, lbl, ph) { return '<div class="bm-sc" data-h="slate"><div class="l">' + lbl + '</div><input data-f="' + k + '" value="' + esc(S[k] || '') + '" placeholder="' + ph + '"></div>'; }
      function render() {
        var L = lensById(S.lens), last = app.clips[app.clips.length - 1];
        var html = '<button type="button" class="x" data-x="1" data-h="slate">' + IC.close + '</button>';
        if (slatePage === 0) {
          html += '<div class="bm-sg" style="grid-template-columns:1fr 1fr"><div class="bm-sc"><div class="l">SLATE FOR</div><div class="v">Next Clip</div></div><div class="bm-sc"><div class="l">LENS DATA</div><div class="v">iPhone 15 Pro Max ' + (L.front ? 'Front' : L.eq + 'mm') + '</div></div></div>' +
            '<div class="bm-sg" style="grid-template-columns:1fr 1fr 1fr;margin-top:3px">' + step('reel', 'REEL') + step('sceneNo', 'SCENE') + step('take', 'TAKE') + '</div>' +
            '<div class="bm-sg" style="grid-template-columns:1.6fr 1fr 1fr 1fr 1fr;margin-top:3px"><button type="button" class="bm-tg' + (last && last.good ? ' on' : '') + '" data-good="1" data-h="slate">Good Take Last Clip</button>' + tg('interior', true, 'Interior') + tg('interior', false, 'Exterior') + tg('day', true, 'Day') + tg('day', false, 'Night') + '</div>';
        } else {
          html += '<div class="bm-sg" style="grid-template-columns:1fr 1fr">' + field('prodName', 'PRODUCTION NAME', 'Название проекта') + '<div class="bm-sc"><div class="l">CAMERA IDENT</div><div class="v">' + esc(S.camName) + '</div></div>' + field('director', 'DIRECTOR', 'Режиссёр') + field('operator', 'CAMERA OPERATOR', 'Оператор') + '</div>';
        }
        html += '<div class="bm-dots"><i class="' + (slatePage === 0 ? 'on' : '') + '" data-p="0"></i><i class="' + (slatePage === 1 ? 'on' : '') + '" data-p="1"></i></div>';
        c.innerHTML = html;
      }
      c.addEventListener('click', function (e) {
        e.stopPropagation(); if (app.helpMode) return;
        var b = e.target.closest('[data-k],[data-t],[data-good],[data-x],[data-p]'); if (!b) return;
        if (b.dataset.x) { app.closeOverlay(); return; }
        if (b.dataset.p != null) { slatePage = +b.dataset.p; render(); return; }
        if (b.dataset.k) { S[b.dataset.k] = Math.max(1, S[b.dataset.k] + +b.dataset.d); }
        if (b.dataset.t) S[b.dataset.t] = b.dataset.v === 'true';
        if (b.dataset.good) { var last = app.clips[app.clips.length - 1]; if (last) { last.good = !last.good; app.toast(last.good ? 'Предыдущий клип ' + last.name + ' отмечен как удачный дубль.' : 'Отметка снята.'); } else app.toast('Ещё нет записанных клипов.'); }
        render(); app.save();
      });
      c.addEventListener('input', function (e) { var f = e.target.dataset.f; if (f) { S[f] = e.target.value; app.save(); } });
      render(); return c;
    }
    var scopePage = 0, scopeOp = 100;
    function buildScope() {
      var c = h('div', { cls: 'bm-card bm-scope', 'data-h': 'hist' }, '<canvas width="860" height="480"></canvas><div class="ctr"><input type="range" min="10" max="100" value="' + scopeOp + '"><span class="op">' + scopeOp + '%</span><div class="pg"><i data-p="0"></i><i data-p="1"></i><i data-p="2"></i></div></div>');
      app.scopeCv = c.querySelector('canvas');
      c.querySelector('input').oninput = function (e) { scopeOp = +e.target.value; c.querySelector('.op').textContent = scopeOp + '%'; c.style.opacity = 0.35 + scopeOp / 100 * 0.65; };
      c.addEventListener('click', function (e) { e.stopPropagation(); var p = e.target.closest('[data-p]'); if (p) scopePage = +p.dataset.p; else if (e.target.tagName === 'CANVAS') app.closeOverlay(); });
      return c;
    }
    app.drawScope = function () {
      var cvs = app.scopeCv; if (!cvs || !ovEl) return;
      ovEl.querySelectorAll('.pg i').forEach(function (i) { i.classList.toggle('on', +i.dataset.p === scopePage); });
      var ctx = cvs.getContext('2d'), W = cvs.width, Hh = cvs.height, wv = app.eng.wave;
      ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, W, Hh);
      var gx = 20, gy = 30, gw = W - 40, gh = Hh - 60;
      ctx.font = '13px Lato,Arial'; ctx.fillStyle = '#ddd';
      for (var p = 0; p <= 10; p++) {
        ctx.strokeStyle = p === 0 || p === 10 ? '#d4c050' : 'rgba(255,255,255,.3)'; ctx.setLineDash(p === 0 || p === 10 ? [] : [6, 6]); ctx.beginPath();
        if (scopePage === 0) { var x = gx + p / 10 * gw; ctx.moveTo(x, gy); ctx.lineTo(x, gy + gh); ctx.stroke(); ctx.fillText(p * 10 + '%', x - 10, gy - 10); }
        else { var yy = gy + gh - p / 10 * gh; ctx.moveTo(gx, yy); ctx.lineTo(gx + gw, yy); ctx.stroke(); }
      }
      ctx.setLineDash([]);
      if (scopePage === 0) {
        var hs = app.eng.hist, mx = 1; for (var c2 = 0; c2 < 3; c2++) for (var i = 1; i < 63; i++) mx = Math.max(mx, hs[c2][i]);
        var cols = ['rgba(255,70,70,.7)', 'rgba(70,230,90,.65)', 'rgba(70,140,255,.7)'];
        for (c2 = 0; c2 < 3; c2++) { var bh = gh / 3, by = gy + c2 * bh; ctx.fillStyle = cols[c2]; ctx.beginPath(); ctx.moveTo(gx, by + bh); for (i = 0; i < 64; i++) ctx.lineTo(gx + i / 63 * gw, by + bh - Math.sqrt(Math.min(1, hs[c2][i] / mx)) * (bh - 6)); ctx.lineTo(gx + gw, by + bh); ctx.fill(); }
        ctx.fillText('0', gx, Hh - 10); ctx.fillText('64', gx + 0.0625 * gw, Hh - 10); ctx.fillText('940', gx + 0.918 * gw - 10, Hh - 10); ctx.fillText('1023', gx + gw - 26, Hh - 10);
        return;
      }
      if (!wv) return;
      /* 1 — RGB парад, 2 — яркостный осциллограф */
      var parts = scopePage === 1 ? [['r', '255,80,80'], ['g', '80,240,100'], ['b', '90,150,255']] : [['y', '235,235,235']];
      parts.forEach(function (pt, k) {
        var pw = gw / parts.length, px0 = gx + k * pw, arr = wv[pt[0]];
        for (var col = 0; col < 160; col++) for (var lv = 0; lv < 64; lv++) {
          var n = arr[col * 64 + lv]; if (!n) continue;
          ctx.fillStyle = 'rgba(' + pt[1] + ',' + Math.min(0.9, 0.08 + n / 30) + ')';
          ctx.fillRect(px0 + col / 160 * pw, gy + gh - (lv + 1) / 64 * gh, pw / 160 + 0.8, gh / 64 + 0.6);
        }
      });
      ctx.fillStyle = '#ddd'; [0, 25, 50, 75, 100].forEach(function (v) { ctx.fillText(v + '%', 2, gy + gh - v / 100 * gh + 4); });
    };
  }
  /* =====================================================================
   *  ВКЛАДКА SETTINGS (горизонтальная раскладка: слева разделы, справа пункты)
   * ===================================================================== */
  function buildSettings(app) {
    var S = app.S, v = app.views.settings, curSec = 'record', sub = null, rgtScroll = 0;
    app.rowHelp = {};
    SETTINGS.forEach(function (sec) { sec.groups.forEach(function (g, gi) { g.forEach(function (r, ri) { r.key = sec.id + ':' + gi + ':' + ri; r.sec = sec.title; app.rowHelp[r.key] = r; }); }); });
    function optLabel(r, val) { var o = (r.o || []).filter(function (x) { return x[0] === val; })[0]; return o ? o[1] : String(val); }
    function chev() { return '<span class="ch">' + IC.chevR + '</span>'; }
    function rowHTML(r) {
      var dis = r.dis && r.dis(S), cls = 'bm-row' + (dis ? ' dis' : ''), lb = '<span class="lb">' + esc(r.l) + (r.sub ? '<small>' + esc(r.sub) + '</small>' : '') + '</span>';
      var attrs = ' data-hs="' + r.key + '"';
      if (r.t === 'tog') return '<button type="button" class="' + cls + '" data-tog="' + r.k + '"' + attrs + (dis ? ' disabled' : '') + '>' + lb + '<span class="tgl' + (S[r.k] ? ' on' : '') + '"></span></button>';
      if (r.t === 'sel') return '<button type="button" class="' + cls + '" data-sel="' + r.key + '"' + attrs + (dis ? ' disabled' : '') + '>' + lb + '<span class="vl">' + esc(optLabel(r, S[r.k])) + '</span>' + chev() + '</button>';
      if (r.t === 'link') return '<button type="button" class="' + cls + '" data-page="' + r.page + '"' + attrs + '>' + lb + (r.val ? '<span class="vl">' + esc(r.val(S)) + '</span>' : '') + chev() + '</button>';
      if (r.t === 'info') return '<div class="' + cls + '"' + attrs + '>' + lb + '<span class="vl">' + esc(r.val(S)) + '</span></div>';
      return '';
    }
    function render() {
      var keepScroll = v.querySelector('.rgt') ? v.querySelector('.rgt').scrollTop : 0;
      var lft = '<div class="lft"><h2>Settings</h2>' + SETTINGS.map(function (s) { return '<button type="button" class="sec' + (s.id === curSec ? ' act' : '') + '" data-sec="' + s.id + '" data-h="navSettings">' + esc(s.title) + '</button>'; }).join('') + '</div>';
      var rgt = '<div class="rgt">';
      if (!sub) {
        var sec = SETTINGS.filter(function (s) { return s.id === curSec; })[0];
        rgt += '<div class="hd">' + esc(sec.title) + '</div>' + sec.groups.map(function (g) { return '<div class="bm-grp">' + g.map(rowHTML).join('') + '</div>'; }).join('');
        if (curSec === 'about') rgt += '<button type="button" class="bm-bigbtn" data-page="iosset" data-h="navSettings">Open Blackmagic Cam Settings</button>';
      } else rgt += subHTML();
      rgt += '</div>';
      v.innerHTML = lft + rgt;
      if (!sub || sub === app.__lastSub) v.querySelector('.rgt').scrollTop = keepScroll;
      app.__lastSub = sub;
    }
    function selPage(r) {
      var opts = r.o, html = '<div class="hd"><button type="button" data-back="1" data-h="navSettings">' + IC.chevL + '</button>' + esc(r.page || r.sec) + '</div>';
      html += '<div class="gh">' + esc(r.l) + '</div><div class="bm-grp">' + opts.map(function (o) {
        var sel = S[r.k] === o[0], dis = (r.k === 'resolution' && false), subt = r.subs && r.subs[o[0]] ? '<small>' + esc(r.subs[o[0]]) + '</small>' : '';
        return '<button type="button" class="bm-row' + (sel ? ' sel' : '') + (dis ? ' dis' : '') + '" data-opt="' + esc(String(o[0])) + '" data-hs="' + r.key + '"><span class="ck">' + IC.check + '</span><span class="lb">' + esc(o[1]) + subt + '</span></button>';
      }).join('') + '</div>';
      if (r.k2 && r.show2(S)) html += '<div class="gh">' + esc(r.l2) + '</div><div class="bm-grp">' + r.o2.map(function (o) { return '<button type="button" class="bm-row' + (S[r.k2] === o[0] ? ' sel' : '') + '" data-opt2="' + o[0] + '" data-hs="' + r.key + '"><span class="ck">' + IC.check + '</span><span class="lb">' + esc(o[1]) + '</span></button>'; }).join('') + '</div>';
      if (r.k === 'saveTo') html += '<div class="bm-grp"><button type="button" class="bm-row" data-page="prostorage" data-hs="' + r.key + '"><span class="lb">Configure Pro Video Storage</span>' + chev() + '</button></div>';
      if (r.k === 'platform') html += '<div class="bm-grp"><button type="button" class="bm-row" data-act="importstream" data-hs="' + r.key + '"><span class="ic">' + IC.imp + '</span><span class="lb">Import Stream Settings</span></button></div>';
      if (r.k === 'hdmi') {
        var feed = S.hdmi === 'feed';
        html += '<div class="bm-grp">' + ['Clean Feed', 'Status Text', 'Text Surrounds Image', 'Display LUT', 'Zebra', 'Focus Assist', 'Frame Guide', 'Grid', 'Safe Area Guide', 'False Color', 'Limit Monitoring to HD'].map(function (n, i) {
          var k = 'hdmi_' + i; return '<button type="button" class="bm-row' + (feed ? '' : ' dis') + '" data-tog="' + k + '" data-hs="' + r.key + '"' + (feed ? '' : ' disabled') + '><span class="lb">' + n + '</span><span class="tgl' + (S[k] ? ' on' : '') + '"></span></button>';
        }).join('') + '</div><div class="bm-note">Переключатели работают в режиме Video Feed: выбирают, что выводить поверх чистого видео на внешний монитор (имитация).</div>';
      }
      if (r.h) html += '<div class="bm-note">' + esc(r.h) + '</div>';
      return html;
    }
    function hdr(t) { return '<div class="hd"><button type="button" data-back="1" data-h="navSettings">' + IC.chevL + '</button>' + esc(t) + '</div>'; }
    function subHTML() {
      if (sub.indexOf('sel:') === 0) return selPage(app.rowHelp[sub.slice(4)]);
      switch (sub) {
        case 'proxy': return hdr('Media') + '<div class="gh">Proxy Clip Manager</div><div class="bm-grp"><div class="bm-row" data-hs="media:1:1"><span class="lb">' + app.clips.length + ' Clips</span><span class="vl">' + (app.clips.length * 0.11).toFixed(1).replace('.', ',') + ' GB</span></div></div><div class="bm-grp"><button type="button" class="bm-row" data-act="delproxy" data-hs="media:1:1"><span class="ic">' + IC.close + '</span><span class="lb">Delete Proxy Clips</span></button></div>';
        case 'cloud': return hdr('Blackmagic Cloud') + (S.cloudLogged ?
          '<div class="bm-grp"><div class="bm-row"><span class="lb">Signed in as</span><span class="vl">student@matis.academy</span></div><div class="bm-row"><span class="lb">Project</span><span class="vl">Курс: Мобильная съёмка</span></div></div><div class="bm-grp"><button type="button" class="bm-row" data-act="logout"><span class="lb" style="color:#ff6b62">Log Out</span></button></div>' :
          '<div class="bm-grp"><button type="button" class="bm-row" data-act="login"><span class="ic">' + IC.cloud + '</span><span class="lb">Log in to Blackmagic Cloud</span></button></div>') + '<div class="bm-note">Имитация: в симуляторе вход условный, данные никуда не отправляются. В приложении здесь вводится Blackmagic ID.</div>';
        case 'presets': return hdr('Presets') + '<div class="gh">Preset Selection</div>' + [['add', IC.plus, 'Save New Preset'], ['import', IC.imp, 'Import Preset'], ['export', IC.exp, 'Export Preset'], ['overwrite', IC.refresh, 'Overwrite Preset']].map(function (b) { return '<div class="bm-grp"><button type="button" class="bm-row" data-act="p_' + b[0] + '" data-hs="presets:0:0"><span class="ic">' + b[1] + '</span><span class="lb">' + b[2] + '</span></button></div>'; }).join('') +
          ((store('presets') || []).length ? '<div class="gh">Saved</div><div class="bm-grp">' + (store('presets') || []).map(function (p, i) { return '<button type="button" class="bm-row" data-act="p_apply" data-i="' + i + '" data-hs="presets:0:0"><span class="lb">' + esc(p.name) + '</span><span class="vl">Apply</span></button>'; }).join('') + '</div>' : '') +
          '<div class="bm-note">Пресеты хранятся в этом браузере. Export копирует пресет как текст, Import принимает такой текст.</div><textarea class="mlbm-search" data-ptext style="height:70px;display:none"></textarea>';
        case 'luts': return hdr('LUTs') + '<div class="gh">Blackmagic LUTs</div><div class="bm-grp"><button type="button" class="bm-row" data-tog="bmLuts" data-hs="luts:0:0"><span class="lb">Enable Blackmagic LUTs</span><span class="tgl' + (S.bmLuts ? ' on' : '') + '"></span></button></div><div class="bm-grp">' +
          LUTS.map(function (L, i) { return '<button type="button" class="bm-row' + (S.bmLuts ? '' : ' dis') + '" data-lut="' + i + '" data-hs="luts:0:0"><span class="lb">' + esc(L.name) + '<small>' + esc(L.about) + '</small></span><span class="tgl' + (S.lutEnabled[i] ? ' on' : '') + '"></span></button>'; }).join('') + '</div>' +
          [['imp', IC.imp, 'Import LUT'], ['exp', IC.exp, 'Export LUT'], ['rem', IC.close, 'Remove LUTs']].map(function (b) { return '<div class="bm-grp"><button type="button" class="bm-row" data-act="lut_' + b[0] + '" data-hs="luts:0:0"><span class="ic">' + b[1] + '</span><span class="lb">' + b[2] + '</span></button></div>'; }).join('') +
          '<div class="bm-note">Импорт своих LUT (.cube) в симуляторе не поддерживается — работают 11 встроенных.</div>';
        case 'http': return hdr('Network Access') + '<div class="bm-grp"><button type="button" class="bm-row" data-tog="httpOn" data-hs="network:0:0"><span class="lb">HTTP Server</span><span class="tgl' + (S.httpOn ? ' on' : '') + '"></span></button>' + (S.httpOn ? '<div class="bm-row"><span class="lb">Address</span><span class="vl">http://192.168.1.24:8080</span></div>' : '') + '</div><div class="bm-note">Встроенный сервер позволяет управлять камерой и скачивать клипы по Wi-Fi из браузера (имитация).</div>';
        case 'reset': return hdr('Reset') + '<div class="gh">Reset Blackmagic Cam Settings</div><div class="bm-grp"><button type="button" class="bm-row" data-act="reset1" data-hs="reset:0:0"><span class="lb">Reset Camera Settings</span></button><button type="button" class="bm-row" data-act="reset2" data-hs="reset:0:0"><span class="lb">Reset Camera and Cloud Settings</span></button><button type="button" class="bm-row" data-act="reset3" data-hs="reset:0:0"><span class="lb" style="color:#ff6b62">Reset All Settings and Erase All Content</span></button></div>' +
          (app.confirmReset ? '<div class="bm-grp"><div class="bm-row"><span class="lb">' + { reset1: 'Сбросить настройки камеры?', reset2: 'Сбросить настройки камеры и облака?', reset3: 'Сбросить всё и удалить все клипы?' }[app.confirmReset] + '</span></div><button type="button" class="bm-row" data-act="doreset"><span class="lb" style="color:#ff6b62">Reset</span></button><button type="button" class="bm-row" data-act="noreset"><span class="lb">Cancel</span></button></div>' : '');
        case 'prostorage': return hdr('Media') + '<div class="gh">Configure Pro Video Storage</div><div class="bm-grp"><div class="bm-row"><span class="lb">External SSD</span><span class="vl">' + (S.saveTo === 'external' ? 'Samsung T7 · 931 GB' : 'Not selected') + '</span></div></div><div class="bm-note">Внешний SSD подключается через USB-C. Он нужен для ProRes 4K 60 к/с на iPhone 15 Pro и Pro Max (имитация).</div>';
        case 'learn': return hdr('About') + '<div class="bm-note" style="font-size:13px">Описание приложения и техспецификации — на сайте производителя: blackmagicdesign.com → Products → Blackmagic Camera.</div>';
        case 'iosset': return hdr('iOS Settings') + '<div class="bm-note" style="font-size:13px">Кнопка открывает системные настройки iOS для приложения: доступ к камере, микрофону, фото, геолокации, локальной сети и Bluetooth.</div>';
      }
      return hdr('');
    }
    function changed(k) {
      if (k === 'lensCorr' || k === 'scene') app.eng.dirty = true;
      if (k === 'resolution' && curFps(S) > maxFpsFor(S)) { if (S.offSpeed) S.offFps = 60; else S.fps = 60; app.toast('100 и 120 к/с доступны только в HD — частота снижена до 60.', true); }
      if (k === 'codec' && needsExternal(S)) app.toast('ProRes 4K ' + curFps(S) + ' к/с на iPhone 15 Pro пишется только на внешний SSD. Выберите Save Clips to → Pro Video Storage, иначе будут пропуски кадров.', true);
      if (k === 'colorspace' && S.colorspace === 'applelog' && !S.lutOn) app.toast('Apple Log выглядит плоским. Для монитора включите LUT Rec 709 Neutral (кнопка LUT справа).');
      if (k === 'audioSrc' || k === 'audioCh') {}
      app.save(); app.updateHud();
    }
    v.addEventListener('click', function (e) {
      if (app.helpMode && !e.target.closest('[data-sec],[data-back],[data-sel],[data-page]')) return;
      var b = e.target.closest('button'); if (!b || b.disabled) return;
      var d = b.dataset;
      if (d.sec) { curSec = d.sec; sub = null; app.confirmReset = null; render(); v.querySelector('.rgt').scrollTop = 0; return; }
      if (d.back) { sub = null; app.confirmReset = null; render(); return; }
      if (d.tog) { S[d.tog] = !S[d.tog]; if (d.tog === 'remoteOn' && !S.remoteOn) {} changed(d.tog); render(); return; }
      if (d.sel) { sub = 'sel:' + d.sel; render(); v.querySelector('.rgt').scrollTop = 0; return; }
      if (d.opt != null) { var r = app.rowHelp[sub.slice(4)]; var val = d.opt; (r.o.forEach(function (o) { if (String(o[0]) === val) val = o[0]; })); S[r.k] = val; changed(r.k); render(); return; }
      if (d.opt2) { var r2 = app.rowHelp[sub.slice(4)]; S[r2.k2] = d.opt2; changed(r2.k2); render(); return; }
      if (d.page) { sub = d.page; render(); v.querySelector('.rgt').scrollTop = 0; return; }
      if (d.lut != null) { if (!S.bmLuts) return; var i = +d.lut; S.lutEnabled[i] = !S.lutEnabled[i]; if (!S.lutEnabled[i] && S.lut === LUTS[i].id) S.lutOn = false; app.save(); render(); return; }
      if (d.act) act(d.act, b);
    });
    function act(a, b) {
      var ps = store('presets') || [], ta = v.querySelector('[data-ptext]');
      switch (a) {
        case 'login': S.cloudLogged = true; app.toast('Вход выполнен (имитация).'); break;
        case 'logout': S.cloudLogged = false; S.liveStream = false; break;
        case 'importstream': app.toast('Файл настроек трансляции импортирован (имитация).'); break;
        case 'delproxy': app.toast('Прокси-файлы удалены (имитация).'); break;
        case 'p_add': ps.push({ name: 'Preset ' + (ps.length + 1) + ' · ' + sceneById(S.scene).short, s: app.presetSnapshot() }); store('presets', ps); app.toast('Пресет сохранён.'); break;
        case 'p_overwrite': if (!ps.length) { app.toast('Нет пресетов для перезаписи.'); break; } ps[ps.length - 1].s = app.presetSnapshot(); store('presets', ps); app.toast('Последний пресет перезаписан.'); break;
        case 'p_export': if (!ps.length) { app.toast('Сначала сохраните пресет.'); break; } render(); ta = v.querySelector('[data-ptext]'); ta.style.display = ''; ta.value = JSON.stringify(ps[ps.length - 1]); ta.select(); try { navigator.clipboard.writeText(ta.value).catch(function () {}); } catch (er) {} app.toast('Пресет скопирован как текст.'); return;
        case 'p_import': render(); ta = v.querySelector('[data-ptext]'); ta.style.display = ''; ta.placeholder = 'Вставьте текст пресета и нажмите Import ещё раз'; if (ta.__ready && ta.value) {} ta.oninput = function () { try { var o = JSON.parse(ta.value); if (o && o.s) { ps.push(o); store('presets', ps); app.toast('Пресет импортирован.'); render(); } } catch (er) {} }; return;
        case 'p_apply': app.applyPreset(ps[+b.dataset.i].s); app.toast('Пресет «' + ps[+b.dataset.i].name + '» применён.'); break;
        case 'lut_imp': case 'lut_exp': app.toast('В симуляторе работают только встроенные LUT.'); break;
        case 'lut_rem': app.toast('Встроенные LUT удалить нельзя — их можно выключить переключателями.'); break;
        case 'reset1': case 'reset2': case 'reset3': app.confirmReset = a; break;
        case 'noreset': app.confirmReset = null; break;
        case 'doreset':
          var keep = { scene: S.scene }, d = defaults();
          for (var k in d) S[k] = d[k];
          S.scene = keep.scene;
          if (app.confirmReset === 'reset3') { app.clips.length = 0; app.free = 51e9; app.tcFrames = 0; }
          app.confirmReset = null; app.eng.dirty = true; app.toast('Настройки сброшены.'); break;
      }
      app.save(); render(); app.updateHud();
    }
    app.renderSettings = render;
    app.openSection = function (id) { curSec = id; sub = null; render(); };
  }
  /* =====================================================================
   *  ВКЛАДКИ MEDIA и CHAT
   * ===================================================================== */
  function buildMedia(app) {
    var S = app.S, mv = app.views.media, cv = app.views.chat, sortAsc = false, player = null;
    function renderMedia() {
      stopPlayer();
      var clips = app.clips.slice(); if (!sortAsc) clips.reverse();
      mv.innerHTML = '<div class="mh"><button type="button" data-h="navMedia" title="Проекты">' + IC.sidebar + '</button><span class="t">' + (S.cloudLogged ? 'Курс: Мобильная съёмка' : 'No project selected') + ' - All Clips</span>' +
        '<button type="button" data-h="navMedia" title="Фильтр">' + IC.filterI + '</button><button type="button" data-h="navMedia" title="Выбрать клипы">' + IC.selectI + '</button><button type="button" data-sort="1" data-h="navMedia" title="Сортировка">' + IC.sortI + '</button><button type="button" data-h="navMedia" title="Облако">' + IC.cloud + '</button></div>' +
        (clips.length ? '<div class="grid">' + clips.map(function (c) {
          return '<button type="button" class="bm-clip" data-clip="' + c.id + '" data-h="navMedia"><div class="th"><img alt="" src="' + c.thumb + '"><span>' + fmtClipDur(c.dur) + '</span>' + (c.good ? '<em>GOOD</em>' : '') + '</div><div class="nm">' + esc(c.name) + '</div></button>';
        }).join('') + '</div>' : '<div class="empty">Клипов пока нет.<br>Вернитесь во вкладку Camera и нажмите красную кнопку записи.</div>');
    }
    function metaRows(c) {
      var m = c.meta, rows = [
        ['Условия', m.sceneName], ['Объектив', m.lens + (m.zoom && m.zoom % 1 ? ' · ' + m.zoom + 'x' : '')], ['FPS', m.offSpeed ? m.offFps + ' (off speed → ' + m.fps + ')' : m.fps + (m.timelapse ? ' · timelapse' : '')],
        ['Выдержка', m.shutter + (m.shAuto ? ' (A)' : '')], ['ISO', m.iso + (m.isoAuto ? ' (A)' : '')], ['WB / Tint', m.wbK + 'K' + (m.wbAuto ? ' (A)' : '') + ' / ' + m.tint],
        ['Фокус', m.focus.toFixed(3) + (m.afAuto ? ' (AF)' : '')], ['Кодек', m.codecName], ['Разрешение', { '4k': '3840×2160', hd: '1920×1080', '720p': '1280×720', opengate: '1920×1440 Open Gate' }[m.resolution]],
        ['Цвет', { rec709: 'Rec.709', rec2020: 'Rec.2020 - HDR', p3: 'P3 D65', applelog: 'Apple Log - HDR' }[m.colorspace] + (m.recLut ? ' + LUT ' + lutById(m.lut).name + ' (вшит)' : m.lutOn ? ' (LUT ' + lutById(m.lut).name + ' только на экране)' : '')],
        ['Стабилизация', m.stab], ['Звук', m.audioSrc === 'none' ? 'нет' : 'iPhone Microphone'], ['Reel / Scene / Take', m.reel + ' / ' + m.sceneNo + ' / ' + m.take], ['Место', (m.interior ? 'Interior' : 'Exterior') + ', ' + (m.day ? 'Day' : 'Night')],
        ['Пересвет', (m.clip * 100).toFixed(1) + '% кадра'], ['Мерцание', m.flicker > 0.02 ? 'есть, ' + Math.round(m.flicker * 100) + '%' : 'нет']
      ];
      if (m.dropped) rows.push(['Внимание', 'пропуск кадров (носитель не успевал)']);
      return rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('');
    }
    function openClip(id) {
      var c = app.clips.filter(function (x) { return String(x.id) === String(id); })[0]; if (!c) return;
      var p = h('div', { cls: 'bm-player' });
      p.innerHTML = '<button type="button" class="x" data-close="1" data-h="navMedia">' + IC.chevL + '</button><div class="pv"><img alt=""><div class="pc"><button type="button" data-play="1" data-h="navMedia">' + IC.play + '</button><input type="range" min="0" max="' + (c.frames.length - 1) + '" value="0" aria-label="Скраббер"><span class="tm">00:00</span></div>' +
        (c.playSpeed !== 1 ? '<div style="font-size:11px;color:#9aa3b2">' + (c.playSpeed < 1 ? 'Замедление ×' + Math.round(1 / c.playSpeed * 10) / 10 + ' (off speed)' : 'Таймлапс — ускоренное воспроизведение') + '</div>' : '') + '</div>' +
        '<div class="meta"><h5>' + esc(c.name) + '</h5><dl>' + metaRows(c) + '</dl><div class="acts"><button type="button" data-good="1" data-h="slate">' + (c.good ? 'Снять отметку Good Take' : 'Отметить Good Take') + '</button><button type="button" class="del" data-del="1" data-h="navMedia">Удалить</button></div><div class="confirm"></div></div>';
      mv.appendChild(p);
      var im = p.querySelector('img'), rg = p.querySelector('input'), tm = p.querySelector('.tm'), playBtn = p.querySelector('[data-play]');
      var st = { i: 0, playing: false, t: 0 };
      function show(i) { st.i = i; im.src = c.frames[i]; rg.value = i; tm.textContent = fmtClipDur(i / Math.max(1, c.frames.length - 1) * c.dur / c.playSpeed); }
      show(0);
      rg.oninput = function () { show(+rg.value); };
      function tick(now) {
        if (!st.playing) return;
        if (!st.last) st.last = now; var dt = (now - st.last) / 1000; st.last = now; st.t += dt;
        var step = (1 / 6) / c.playSpeed;
        while (st.t > step) { st.t -= step; if (st.i >= c.frames.length - 1) { st.playing = false; playBtn.innerHTML = IC.play; return; } show(st.i + 1); }
        player.raf = requestAnimationFrame(tick);
      }
      playBtn.onclick = function () { st.playing = !st.playing; st.last = 0; playBtn.innerHTML = st.playing ? IC.pause : IC.play; if (st.playing) { if (st.i >= c.frames.length - 1) show(0); player.raf = requestAnimationFrame(tick); } };
      p.addEventListener('click', function (e) {
        if (app.helpMode) return;
        var b = e.target.closest('button'); if (!b) return;
        if (b.dataset.close) { renderMedia(); }
        if (b.dataset.good) { c.good = !c.good; b.textContent = c.good ? 'Снять отметку Good Take' : 'Отметить Good Take'; }
        if (b.dataset.del) { p.querySelector('.confirm').innerHTML = '<div class="acts"><span style="font-size:11px">Удалить клип без возможности восстановления?</span><button type="button" class="del" data-yes="1">Удалить</button><button type="button" data-no="1">Отмена</button></div>'; }
        if (b.dataset.yes) { app.clips.splice(app.clips.indexOf(c), 1); renderMedia(); }
        if (b.dataset.no) p.querySelector('.confirm').innerHTML = '';
      });
      player = { el: p, st: st };
    }
    function stopPlayer() { if (player) { cancelAnimationFrame(player.raf); player.st.playing = false; player = null; } }
    mv.addEventListener('click', function (e) {
      if (app.helpMode) return;
      var b = e.target.closest('button'); if (!b || b.closest('.bm-player')) return;
      if (b.dataset.clip) openClip(b.dataset.clip);
      else if (b.dataset.sort) { sortAsc = !sortAsc; renderMedia(); }
      else app.toast('Сортировка, фильтры и выбор клипов в симуляторе упрощены: доступны просмотр, метаданные и удаление.');
    });

    /* ---------- Chat ---------- */
    var msgs = [
      { who: 'Монтажёр · DaVinci Resolve', t: 'Привет! Вижу твои прокси в проекте. Сцена 1, дубль 2 — лучший, отмечу его.' },
      { who: 'Режиссёр', t: 'Следующий кадр: крупный план, 48 мм, фокус на глазах. И выключи авто баланс белого.' }
    ];
    function renderChat() {
      if (!S.cloudLogged) {
        cv.innerHTML = '<div class="c"><div class="logo">' + IC.cloudBig + '</div><h3>Blackmagic <b>Cloud</b></h3><p>Log in to Blackmagic Cloud to access your projects chat.</p><button type="button" class="lg" data-login="1" data-h="navChat">Log In</button></div>';
        return;
      }
      cv.innerHTML = '<div class="bm-msgs">' + msgs.map(function (m) { return '<div class="bm-msg' + (m.me ? ' me' : '') + '"><b>' + esc(m.who) + '</b>' + esc(m.t) + '</div>'; }).join('') + '</div><form class="bm-chatin"><input placeholder="Сообщение участникам проекта" aria-label="Сообщение"><button type="submit">Send</button></form>';
      var box = cv.querySelector('.bm-msgs'); box.scrollTop = box.scrollHeight;
      cv.querySelector('form').onsubmit = function (e) { e.preventDefault(); var i = cv.querySelector('input'); if (!i.value.trim()) return; msgs.push({ who: 'Вы', t: i.value.trim(), me: true }); setTimeout(function () { msgs.push({ who: 'Монтажёр · DaVinci Resolve', t: 'Принято! (это имитация чата Blackmagic Cloud)' }); if (app.view === 'chat') renderChat(); }, 900); renderChat(); };
    }
    cv.addEventListener('click', function (e) { if (app.helpMode) return; if (e.target.closest('[data-login]')) { S.cloudLogged = true; app.save(); renderChat(); app.toast('Вход в Blackmagic Cloud выполнен (имитация).'); } });
    app.renderMedia = renderMedia; app.renderChat = renderChat;
  }
  /* =====================================================================
   *  ПАНЕЛЬ ТРЕНАЖЁРА: справка по элементу, задания, справочник
   * ===================================================================== */
  function buildSidePanel(app) {
    var S = app.S, side = app.side, tab = store('tab') || 'help';
    side.innerHTML = '<div class="mlbm-tabs"><button type="button" data-tab="help">Справка</button><button type="button" data-tab="tasks">Задания</button><button type="button" data-tab="index">Справочник</button></div>' +
      '<div class="mlbm-pane" data-pane="help"><div class="hbody"></div><dl class="live"></dl></div><div class="mlbm-pane" data-pane="tasks"></div><div class="mlbm-pane" data-pane="index"></div>';
    var panes = {}; side.querySelectorAll('[data-pane]').forEach(function (p) { panes[p.dataset.pane] = p; });
    app.taskPane = panes.tasks;
    function setTab(t) { tab = t; store('tab', t); side.querySelectorAll('[data-tab]').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === t); }); for (var k in panes) panes[k].style.display = k === t ? '' : 'none'; if (t === 'index') renderIndex(); if (t === 'tasks' && app.tasks) app.tasks.render(); }
    app.setTab = setTab;
    side.querySelector('.mlbm-tabs').onclick = function (e) { var b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); };
    var hb = panes.help.querySelector('.hbody'), live = panes.help.querySelector('.live');

    app.showHelpText = function (title, en, d, tip, sim, vals) {
      if (title == null) {
        hb.innerHTML = '<h3>Как пользоваться</h3><p class="hint">Управляйте камерой как в приложении: нажимайте на значения вверху кадра (LENS, FPS, SHUTTER, ISO, WB, TINT), кнопки справа, ⋮ по краям кадра и вкладки Media, Chat, Settings.</p>' +
          '<p class="hint">Здесь появляется объяснение каждой кнопки и настройки, которой вы коснулись. Наведите мышь — подсказка покажется без нажатия.</p>' +
          '<p class="hint">Кнопка <b>«Что это?»</b> включает режим справки: нажатия ничего не меняют, а только объясняют элемент.</p>' +
          '<p class="hint">Колёса прокручиваются перетаскиванием вверх-вниз или колёсиком мыши. Запись — красная кнопка, пробел или стрелки (как кнопки громкости).</p>';
        return;
      }
      hb.innerHTML = '<h3>' + esc(title) + '</h3>' + (en ? '<div class="en">' + esc(en) + '</div>' : '') + (d ? '<p>' + esc(d) + '</p>' : '') + (vals ? '<div class="vals">Варианты: ' + esc(vals) + '</div>' : '') + (tip ? '<div class="tip">' + esc(tip) + '</div>' : '') + (sim ? '<div class="sim">В симуляторе: ' + esc(sim) + '</div>' : '');
    };
    app.showHelpKey = function (k) { var x = HELP[k]; if (x) app.showHelpText(x.t, 'Экран Camera', x.d, x.tip); };
    app.showRowHelp = function (key) {
      var r = app.rowHelp[key]; if (!r) return;
      var vals = r.o ? r.o.map(function (o) { return o[1]; }).join(', ') : r.t === 'tog' ? 'On / Off' : '';
      if (r.k2 && r.o2) vals += '; ' + r.l2 + ': ' + r.o2.map(function (o) { return o[1]; }).join(', ');
      app.showHelpText(r.l, 'Settings → ' + r.sec, r.h, r.tip, r.sim, vals);
    };

    /* живые значения (что сейчас выставлено и что получается) */
    var lastLive = 0;
    app.sideTick = function () {
      if (tab !== 'help') return;
      var now = performance.now(); if (now - lastLive < 250) return; lastLive = now;
      var eng = app.eng, sc = eng.scene(); if (!sc) return;
      var L = lensById(S.lens), t = shutterTime(S), stops = eng.expStops || 0;
      var fe = curFps(S), angle = 360 * t * fe;
      var rows = [
        ['Условия', sc.name], ['Модуль', (L.front ? 'Front' : L.eq + ' мм') + ', ' + fmtIris({ irisMeas: 'fraction' }, L.N)],
        ['Выдержка', '1/' + Math.round(1 / t) + ' = ' + (Math.round(angle * 10) / 10) + '° при ' + fe + ' к/с'],
        ['Экспозиция', (stops >= 0 ? '+' : '') + stops.toFixed(1) + ' стоп' + (Math.abs(stops) < 0.35 ? ' — норма' : stops > 0 ? ' — светлее нормы' : ' — темнее нормы')],
        ['Пересвет', (eng.stat.clip * 100).toFixed(1) + '% кадра'], ['Мерцание ламп', eng.stat.flickerAmp > 0.02 ? 'видно (' + Math.round(eng.stat.flickerAmp * 100) + '%)' : 'нет'],
        ['Свет сцены', sc.K + ' K' + (sc.tint ? ', зелёный сдвиг' : '')], ['Осталось записи', fmtDur(app.free * 8 / (totalRate(S) * 1e6))]
      ];
      live.innerHTML = rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('');
    };

    /* справочник */
    function renderIndex() {
      var q = (panes.index.querySelector('input') || {}).value || '';
      var groups = [['Экран Camera', Object.keys(HELP).map(function (k) { return { n: HELP[k].t, k: 'h:' + k, s: HELP[k].d }; })]];
      SETTINGS.forEach(function (sec) { var items = []; sec.groups.forEach(function (g) { g.forEach(function (r) { items.push({ n: r.l, k: 'r:' + r.key, s: r.h || '' }); }); }); groups.push(['Settings → ' + sec.title, items]); });
      groups.push(['LUT', LUTS.map(function (L) { return { n: L.name, k: 'l:' + L.id, s: L.about }; })]);
      groups.push(['Условия съёмки', SCENES.map(function (s) { return { n: s.name, k: 's:' + s.id, s: s.about }; })]);
      var ql = q.toLowerCase(), html = '';
      groups.forEach(function (g) {
        var it = g[1].filter(function (x) { return !ql || (x.n + ' ' + x.s).toLowerCase().indexOf(ql) >= 0; });
        if (!it.length) return;
        html += '<h4>' + esc(g[0]) + '</h4>' + it.map(function (x) { return '<button type="button" data-k="' + x.k + '">' + esc(x.n) + '</button>'; }).join('');
      });
      var keep = panes.index.querySelector('input');
      if (!keep) { panes.index.innerHTML = '<input class="mlbm-search" type="search" placeholder="Поиск: зебра, выдержка, LUT…" aria-label="Поиск по справочнику"><div class="mlbm-gl"></div>'; keep = panes.index.querySelector('input'); keep.oninput = renderIndex; }
      panes.index.querySelector('.mlbm-gl').innerHTML = html || '<p class="hint">Ничего не найдено.</p>';
    }
    panes.index.addEventListener('click', function (e) {
      var b = e.target.closest('[data-k]'); if (!b) return;
      var k = b.dataset.k, t = k.slice(0, 1), id = k.slice(2);
      if (t === 'h') app.showHelpKey(id);
      if (t === 'r') app.showRowHelp(id);
      if (t === 'l') { var L = lutById(id); app.showHelpText(L.name, 'LUT', L.about); }
      if (t === 's') { var s = sceneById(id); app.showHelpText(s.name, 'Условия съёмки', s.about, 'Выбрать эти условия можно в списке «Условия» над телефоном.'); }
      setTab('help');
    });
    setTab(tab);
  }

  /* ---------- режим «Что это?» и подсказки при наведении ---------- */
  function bindHelp(app) {
    var scr = app.scr, btn = app.el.querySelector('.b-help'), hl = h('div', { cls: 'bm-hl' }); hl.style.display = 'none'; scr.appendChild(hl);
    function target(e) { return e.target.closest && e.target.closest('[data-hs],[data-h]'); }
    function explain(el) {
      if (!el) return;
      if (el.dataset.hs) app.showRowHelp(el.dataset.hs);
      else {
        var k = el.dataset.h;
        if (k === 'lutBtn' && el.dataset.lut) { var L = lutById(el.dataset.lut); app.showHelpText(L.name, 'LUT', L.about); return; }
        app.showHelpKey(k);
      }
    }
    function mark(el) {
      if (!el) { hl.style.display = 'none'; return; }
      var r = el.getBoundingClientRect(), s = scr.getBoundingClientRect(), k = app.scale;
      hl.style.display = ''; hl.style.left = (r.left - s.left) / k - 2 + 'px'; hl.style.top = (r.top - s.top) / k - 2 + 'px'; hl.style.width = r.width / k + 4 + 'px'; hl.style.height = r.height / k + 4 + 'px';
    }
    btn.onclick = function () {
      app.helpMode = !app.helpMode; btn.classList.toggle('on', app.helpMode); app.el.classList.toggle('helpmode', app.helpMode); mark(null);
      if (app.helpMode) { app.setTab('help'); app.showHelpText('Режим «Что это?»', 'включён', 'Нажимайте на любые кнопки, значения и пункты меню — они не сработают, а здесь появится объяснение. Чтобы снова управлять камерой, нажмите «Что это?» ещё раз.'); }
    };
    ['pointerdown', 'pointerup', 'click', 'wheel'].forEach(function (ev) {
      scr.addEventListener(ev, function (e) {
        if (!app.helpMode) return;
        var t = target(e); if (e.target.closest('.bm-nav') && ev === 'click') { /* вкладки можно переключать и в режиме справки */ var n = e.target.closest('.bm-nav'); app.go(n.dataset.nav); explain(n); mark(n); e.stopPropagation(); return; }
        if (e.target.closest('.bm-set .sec,[data-back],[data-sel],[data-page]') && ev === 'click') { /* навигация по меню тоже разрешена */ explain(t); return; }
        e.stopPropagation(); if (ev !== 'wheel') e.preventDefault();
        if (ev === 'click') { explain(t); mark(t); }
      }, true);
    });
    /* обычный режим: справка о том, чего коснулись */
    scr.addEventListener('click', function (e) { if (app.helpMode) return; var t = target(e); if (t) explain(t); });
    var hovT = null, lastHov = null;
    scr.addEventListener('pointerover', function (e) {
      if (e.pointerType !== 'mouse') return;
      var t = target(e); if (!t || t === lastHov) return;
      clearTimeout(hovT); hovT = setTimeout(function () { lastHov = t; explain(t); if (app.helpMode) mark(t); }, 280);
    });
    scr.addEventListener('pointerleave', function () { clearTimeout(hovT); lastHov = null; });
  }
  /* =====================================================================
   *  ЗАДАНИЯ: условия съёмки + цели, проверка «вживую» и по записанному дублю
   * ===================================================================== */
  function angleOf(m) { return 360 * m.t * (m.offSpeed ? m.offFps : m.fps); }
  function near(v, list, tol) { for (var i = 0; i < list.length; i++) if (Math.abs(v - list[i]) <= (tol || 0.01)) return true; return false; }
  var TASKS = [
    { id: 'rule180', title: 'Правило 180°', scene: 'overcast', level: 'база',
      brief: 'Снимите пасмурную улицу «как в кино»: 24 или 25 кадров в секунду и выдержка по правилу 180° — вдвое короче кадра. Экспозиция — без пересвета и провала.',
      goals: [
        { t: 'FPS 24, 25 или 23.98', c: function (m) { return !m.offSpeed && near(m.fps, [23.98, 24, 25]); }, why: 'Нажмите FPS вверху и выберите 24 или 25.' },
        { t: 'Выдержка ручная (без «A»)', c: function (m) { return !m.shAuto; }, why: 'В автоматическом режиме выдержка «плавает». Выберите значение в колесе SHUTTER.' },
        { t: 'Угол затвора ≈ 180° (1/48 или 1/50)', c: function (m) { var a = angleOf(m); return a >= 160 && a <= 200; }, why: 'При 25 к/с — 1/50, при 24 к/с — 1/48 или 1/50.' },
        { t: 'Экспозиция в норме (±0,7 стопа)', c: function (m) { return Math.abs(m.stops) <= 0.7; }, why: 'Подстройте яркость через ISO, не трогая выдержку. Смотрите гистограмму и строку «Экспозиция» в справке.' },
        { t: 'Дубль не короче 2 секунд', c: function (m, clip) { return !clip || clip.dur >= 2; }, why: 'Держите запись хотя бы 2 секунды.' }
      ],
      tips: ['ISO — главный способ менять яркость на iPhone: диафрагма фиксированная.', 'Правило 180° даёт привычный «киношный» смаз движения бегуна.'] },
    { id: 'sun', title: 'Солнце без пересветов', scene: 'day', level: 'база',
      brief: 'Яркий солнечный день (≈ EV 15). Нужно убрать пересветы: включите зебру и добейтесь, чтобы штриховка почти исчезла. Баланс белого — дневной.',
      goals: [
        { t: 'ISO ручное и минимальное (≤ 80)', c: function (m) { return !m.isoAuto && m.iso <= 80; }, why: 'Откройте ISO и выберите наименьшее значение на шкале.' },
        { t: 'Зебра включена', c: function (m) { return m.zebra; }, why: 'Иконка-рамка справа → Zebra → ON.' },
        { t: 'Пересвет меньше 2 % кадра', c: function (m) { return m.clip < 0.02; }, why: 'Укоротите выдержку (1/400…1/1000), пока зебра не исчезнет с лица и машины.' },
        { t: 'WB ручной, 5000–6000 K', c: function (m) { return !m.wbAuto && m.wbK >= 5000 && m.wbK <= 6000; }, why: 'В колесе WB выберите иконку солнца (Daylight 5600K).' }
      ],
      tips: ['Без ND-фильтра на солнце 180° не получится: свет слишком яркий. Профессионалы ставят ND-фильтр на телефон, чтобы снимать с 1/50.', 'Короткая выдержка даёт «дёрганое» движение — посмотрите на бегуна.'] },
    { id: 'tungsten', title: 'Лампы накаливания', scene: 'tungsten', level: 'база',
      brief: 'Вечер в комнате с тёплыми лампами. Уберите жёлтый оттенок балансом белого и выберите выдержку, при которой не будет мерцания (сеть 50 Гц).',
      goals: [
        { t: 'WB ручной, 2800–3500 K', c: function (m) { return !m.wbAuto && m.wbK >= 2800 && m.wbK <= 3500; }, why: 'В колесе WB выберите лампочку (Incandescent 3200K) или подберите на шкале.' },
        { t: 'Нет мерцания ламп', c: function (m) { return m.flicker < 0.02; }, why: 'Под лампами в сети 50 Гц используйте 1/50 или 1/100 — они в колонке справа в колесе SHUTTER.' },
        { t: 'ISO не выше 1600', c: function (m) { return m.iso <= 1600; }, why: 'Чем выше ISO, тем больше шума. Здесь хватает 400–1250.' },
        { t: 'Экспозиция в норме (±1 стоп)', c: function (m) { return Math.abs(m.stops) <= 1; }, why: 'Подберите ISO.' }
      ],
      tips: ['Полосы бегут по кадру, когда выдержка не кратна 1/100 с — именно так мерцают лампы в сети 50 Гц.'] },
    { id: 'office', title: 'Офис: LED-лампы', scene: 'office', level: 'средний',
      brief: 'Дешёвые светодиодные панели сильно мерцают и дают зелёный оттенок. Уберите полосы и зелень.',
      goals: [
        { t: 'Нет мерцания', c: function (m) { return m.flicker < 0.02; }, why: 'Выдержка 1/50 или 1/100 (Flicker Free Shutter Based On = 50Hz).' },
        { t: 'WB ручной, 3700–4500 K', c: function (m) { return !m.wbAuto && m.wbK >= 3700 && m.wbK <= 4500; }, why: 'Попробуйте пресет Fluorescent (4000K).' },
        { t: 'TINT ручной, убрана зелень (+10…+26)', c: function (m) { return !m.tintAuto && m.tint >= 10 && m.tint <= 26; }, why: 'Откройте TINT и сдвиньте в плюс (к пурпурному).' },
        { t: 'Экспозиция в норме (±0,7 стопа)', c: function (m) { return Math.abs(m.stops) <= 0.7; }, why: 'Подберите ISO.' }
      ],
      tips: ['TINT компенсирует зелёный/пурпурный сдвиг, который не исправить одной цветовой температурой.'] },
    { id: 'night', title: 'Ночная улица', scene: 'night', level: 'средний',
      brief: 'Света очень мало. Выберите модуль, который лучше всего видит в темноте, и найдите баланс между яркостью и шумом.',
      goals: [
        { t: 'Основной модуль 24 мм', c: function (m) { return m.lens === '24 mm'; }, why: 'У 24 мм самая светосильная диафрагма f/1.78 и самый большой сенсор. 13 и 120 мм в темноте шумят сильнее.' },
        { t: 'Выдержка ручная, не длиннее 1/(2×FPS)', c: function (m) { return !m.shAuto && angleOf(m) <= 200; }, why: 'Длинная выдержка смазывает движение. Держите ≈180°.' },
        { t: 'ISO не выше 3200', c: function (m) { return m.iso <= 3200; }, why: 'Выше 3200 шум съедает детали.' },
        { t: 'Кадр не слишком тёмный (не ниже −1,5 стопа)', c: function (m) { return m.stops >= -1.5 && m.stops <= 0.7; }, why: 'Поднимите ISO. Ночная картинка может быть темнее «нормы», но не чёрной.' }
      ],
      tips: ['Тёмная ночь — это нормально: не пытайтесь сделать из неё день, иначе шум будет огромным.'] },
    { id: 'slowmo', title: 'Замедление бегуна', scene: 'day', level: 'средний',
      brief: 'Снимите бегуна для плавного замедления: проект 24/25 к/с, съёмка 100 или 120 к/с (OFF/SPEED), короткая выдержка.',
      goals: [
        { t: 'Разрешение HD', c: function (m) { return m.resolution === 'hd'; }, why: '100 и 120 к/с доступны только в HD: Settings → Record → Resolution → HD.' },
        { t: 'OFF/SPEED включён, 100 или 120 к/с', c: function (m) { return m.offSpeed && m.offFps >= 100; }, why: 'Откройте FPS → OFF/SPEED → выберите 100 или 120.' },
        { t: 'Проект 24 или 25 к/с', c: function (m) { return near(m.fps, [23.98, 24, 25]); }, why: 'Выключите OFF/SPEED, выберите 24 или 25, затем включите OFF/SPEED снова.' },
        { t: 'Выдержка не длиннее 1/200', c: function (m) { return m.t <= 1 / 195; }, why: 'При 100–120 к/с правило 180° даёт 1/200–1/240.' }
      ],
      tips: ['Замедление = частота съёмки ÷ частота проекта. 120 ÷ 24 = в 5 раз медленнее.', 'Посмотрите записанный дубль во вкладке Media — он воспроизводится замедленно.'] },
    { id: 'interview', title: 'Интервью у окна', scene: 'window', level: 'средний',
      brief: 'Средний план человека у окна. Фокус — вручную на лице, экспозиция по коже, в слейте — интерьер.',
      goals: [
        { t: 'Объектив 48 мм (2x)', c: function (m) { return m.lens === '48 mm'; }, why: '48 мм — классическое «портретное» поле зрения без искажений лица.' },
        { t: 'Фокус ручной и на лице', c: function (m) { return !m.afAuto && Math.abs(m.focusD - 1 / m.faceDepth) < 0.15; }, why: 'Выключите AUTO в колесе фокуса и наведитесь на лицо (≈ 0.950). Включите Focus Assist, чтобы проверить.' },
        { t: 'Лицо проэкспонировано правильно', c: function (m) { return m.faceIre >= 0.42 && m.faceIre <= 0.72; }, why: 'Включите False Color: светлая кожа должна стать розовой (MG+1) или зелёной (18% MG).' },
        { t: 'В слейте отмечено Interior', c: function (m) { return m.interior; }, why: '⋮ слева → Slate → Interior.' },
        { t: 'Звук записывается', c: function (m) { return m.audioSrc !== 'none'; }, why: 'Settings → Audio → Audio Source → iPhone Microphone.' }
      ],
      tips: ['False Color точнее гистограммы: он показывает, какая именно часть кадра в какой яркости.'] },
    { id: 'reels', title: 'Вертикаль для Reels', scene: 'overcast', level: 'база',
      brief: 'Снимаете горизонтально, а публиковать будете в Reels/TikTok. Включите рамку 9:16 и подберите настройки для соцсетей.',
      goals: [
        { t: 'Рамка кадра 9:16 включена', c: function (m) { return m.fg && m.fgRatio === '9:16'; }, why: 'Иконка-рамка справа → Frame Guide → 9:16 → ON.' },
        { t: 'FPS 25 или 30', c: function (m) { return !m.offSpeed && near(m.fps, [25, 29.97, 30]); }, why: 'Соцсети чаще всего показывают 25/30 к/с.' },
        { t: 'Кодек HEVC (H.265)', c: function (m) { return m.codec === 'hevc'; }, why: 'Settings → Record → Codec → HEVC: файлы в разы меньше ProRes.' },
        { t: 'Стабилизация включена', c: function (m) { return m.stab !== 'off'; }, why: 'Нижняя иконка справа → Standard или Cinematic.' }
      ],
      tips: ['Рамка не обрезает запись — она лишь показывает, что останется после кадрирования в вертикаль.'] },
    { id: 'sunset', title: 'Золотой час', scene: 'sunset', level: 'средний',
      brief: 'Закат должен остаться тёплым и золотым. Автоматический баланс белого «съедает» атмосферу — поставьте его вручную. Не пересветите небо.',
      goals: [
        { t: 'WB ручной, не ниже 5000 K', c: function (m) { return !m.wbAuto && m.wbK >= 5000; }, why: 'Поставьте Daylight (5600K) — закат останется оранжевым.' },
        { t: 'Пересвет меньше 5 % кадра', c: function (m) { return m.clip < 0.05; }, why: 'Солнце может пересвечиваться, но небо — нет. Включите зебру и уменьшите экспозицию.' },
        { t: 'Экспозиция −1…+0,5 стопа', c: function (m) { return m.stops >= -1 && m.stops <= 0.5; }, why: 'На закате лучше слегка недоэкспонировать, чем потерять цвет неба.' }
      ],
      tips: ['Попробуйте AUTO баланс и сравните: закат станет почти серым.'] },
    { id: 'log', title: 'Apple Log под цветокоррекцию', scene: 'window', level: 'продвинутый',
      brief: 'Снимите материал для цветокоррекции в DaVinci Resolve: Apple Log, ProRes, LUT только на экране.',
      goals: [
        { t: 'Color Space: Apple Log', c: function (m) { return m.colorspace === 'applelog'; }, why: 'Settings → Record → Color Space → Apple Log - HDR.' },
        { t: 'Кодек ProRes 422 HQ или 422', c: function (m) { return m.codec === 'prores422hq' || m.codec === 'prores422'; }, why: 'Settings → Record → Codec.' },
        { t: 'LUT включён на экране, но не вшит', c: function (m) { return m.lutOn && !m.recLut; }, why: 'Кнопка LUT → ON → Rec 709 Neutral; кнопка внизу панели (Record LUT to Clip) — выключена.' },
        { t: 'Без пропуска кадров', c: function (m) { return !m.dropped; }, why: 'ProRes 4K выше 30 к/с требует внешнего SSD. Снимайте 24/25/30 к/с или выберите Pro Video Storage.' },
        { t: 'Пересвет меньше 1 %', c: function (m) { return m.clip < 0.01; }, why: 'Log сохраняет света, но пересвет не исправить и в Resolve.' }
      ],
      tips: ['В Log картинка без LUT серая — так и должно быть. Цвет «вытягивают» на цветокоррекции.'] }
  ];

  function buildTasks(app) {
    var S = app.S, pane = app.taskPane, done = store('tasksDone') || {}, active = null, result = null, showTips = false, liveT = 0;
    var CAM_KEYS = ['lens', 'zoom', 'fps', 'offSpeed', 'offFps', 'shAuto', 'shDen', 'shAngle', 'shLock', 'isoAuto', 'iso', 'isoLock', 'wbAuto', 'wbK', 'wbLock', 'tintAuto', 'tint', 'tintLock', 'afAuto', 'focus', 'ev', 'lutOn', 'recLut', 'zebra', 'fa', 'fg', 'falseColor', 'safe', 'grid', 'torch', 'stab', 'codec', 'bitrate', 'resolution', 'colorspace', 'interior', 'audioSrc', 'saveTo'];
    function start(t) {
      var d = defaults(); CAM_KEYS.forEach(function (k) { S[k] = d[k]; });
      S.colorspace = 'rec709';
      active = t; result = null; showTips = false;
      app.setScene(t.scene); app.eng.dirty = true; app.go('camera'); app.closeDial(); app.save();
      render();
    }
    function evalGoals(m, clip) { return active.goals.map(function (g) { var ok = false; try { ok = !!g.c(m, clip); } catch (e) {} return { g: g, ok: ok }; }); }
    function render() {
      if (!active) {
        pane.innerHTML = '<p class="hint">Каждое задание задаёт условия съёмки и цель. Настройте камеру, запишите дубль красной кнопкой — тренажёр проверит его и объяснит ошибки.</p>' +
          TASKS.map(function (t) { return '<button type="button" class="mlbm-task' + (done[t.id] ? ' done' : '') + '" data-t="' + t.id + '"><div class="tn">' + esc(t.title) + '<i>' + t.level + '</i></div><div class="td">' + esc(sceneById(t.scene).name) + '</div></button>'; }).join('') +
          '<div class="mlbm-foot">Выполнено: ' + Object.keys(done).filter(function (k) { return done[k]; }).length + ' из ' + TASKS.length + '. Прогресс хранится в этом браузере.</div>';
        return;
      }
      var t = active, html = '<h3>' + esc(t.title) + '</h3><div class="en">Условия: ' + esc(sceneById(t.scene).name) + '</div><p>' + esc(t.brief) + '</p>';
      if (result) {
        var okN = result.res.filter(function (r) { return r.ok; }).length, all = okN === result.res.length;
        html += '<div class="mlbm-score' + (all ? ' ok' : '') + '">' + (all ? 'Задание выполнено!' : 'Дубль: ' + okN + ' из ' + result.res.length) + '</div><div class="en">' + esc(result.clip.name) + ' · ' + fmtClipDur(result.clip.dur) + '</div>' +
          '<ul class="mlbm-chk">' + result.res.map(function (r) { return '<li class="' + (r.ok ? 'ok' : 'bad') + '"><b>' + (r.ok ? '✓' : '✗') + '</b><span>' + esc(r.g.t) + (r.ok ? '' : '<small>' + esc(r.g.why) + '</small>') + '</span></li>'; }).join('') + '</ul>';
        html += '<div class="mlbm-act"><button type="button" class="pri" data-a="again">Снять ещё дубль</button><button type="button" data-a="list">Все задания</button></div>';
      } else {
        html += '<div class="en" style="margin-top:6px">Цели (обновляются по мере настройки):</div><ul class="mlbm-chk live-goals"></ul>' +
          '<div class="mlbm-act"><button type="button" class="pri" data-a="rec">' + (S.recording ? 'Остановить запись' : 'Записать дубль') + '</button><button type="button" data-a="tips">' + (showTips ? 'Скрыть подсказки' : 'Подсказки') + '</button><button type="button" data-a="restart">Сначала</button><button type="button" data-a="list">Все задания</button></div>';
        if (showTips) html += t.tips.map(function (x) { return '<div class="tip">' + esc(x) + '</div>'; }).join('');
      }
      pane.innerHTML = html;
      liveT = 0; tick();
    }
    function tick() {
      if (!active || result || !app.metaNow) return;
      var now = performance.now(); if (now - liveT < 300) return; liveT = now;
      var ul = pane.querySelector('.live-goals'); if (!ul) return;
      var res = evalGoals(app.metaNow(), null);
      ul.innerHTML = res.map(function (r) { return '<li class="' + (r.ok ? 'ok' : 'wait') + '"><b>' + (r.ok ? '✓' : '○') + '</b><span>' + esc(r.g.t) + '</span></li>'; }).join('');
      var rb = pane.querySelector('[data-a="rec"]'); if (rb) rb.textContent = S.recording ? 'Остановить запись' : 'Записать дубль';
    }
    pane.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.t) { start(TASKS.filter(function (t) { return t.id === b.dataset.t; })[0]); return; }
      var a = b.dataset.a;
      if (a === 'list') { active = null; result = null; render(); }
      if (a === 'again') { result = null; render(); }
      if (a === 'tips') { showTips = !showTips; render(); }
      if (a === 'restart') start(active);
      if (a === 'rec') { app.go('camera'); app.toggleRec(); render(); }
    });
    app.tasks = {
      render: render, tick: tick,
      onRecStart: function () { if (active && !result) render(); },
      onClip: function (clip) {
        if (!active) return;
        if (S.scene !== active.scene) { app.toast('Дубль снят не в условиях задания — выберите «' + sceneById(active.scene).name + '».', true); return; }
        result = { clip: clip, res: evalGoals(clip.meta, clip) };
        if (result.res.every(function (r) { return r.ok; })) { done[active.id] = true; store('tasksDone', done); }
        app.setTab('tasks'); render();
      }
    };
    render();
  }
  /* ---------- Подключение ---------- */
  function autoMount() {
    var nodes = document.querySelectorAll('[data-ml-widget="bmcamera"],.ml-bmcamera-sim');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i]; if (n.__mlbm) continue; n.__mlbm = true;
      mount(n, { scene: n.getAttribute('data-scene') || undefined });
    }
  }
  window.MLBMCameraSim = { mount: mount, version: '1.0' };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount); else autoMount();
})();
