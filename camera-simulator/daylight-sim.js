/*!
 * Matis.Academy — симулятор съёмки в разное время суток
 * Виджет для уроков ml-lesson: пустой Block с атрибутом data-ml-widget="daylight".
 * Без зависимостей, стили встраиваются сам скриптом.
 *
 * Как устроено:
 *  - сцена рисуется в линейном HDR (солнце и фонари ярче «белого»);
 *  - экспозиция считается по формуле EV = log2(N²/t) − log2(ISO/100) + ND;
 *  - поверх: глубина резкости (диафрагма), смаз движения (выдержка),
 *    шум (ISO), баланс белого, клиппинг сенсора, зебра, гистограмма.
 */
(function () {
  'use strict';
  if (window.__mlDaylightSim) return;
  window.__mlDaylightSim = true;

  var W = 768, H = 432, HOR = 250, ROAD = 318, FEET = 400, CX = 476;
  var BOOSTK = 16;      // во сколько раз «яркость» в HDR-слое может превышать белый
  var CLIP = 1.2;       // насыщение сенсора (в линейных единицах)
  var NOISE_A = 0.00004, NOISE_B = 0.00025;

  /* ---------- Списки значений камеры ---------- */
  var SH = [25, 30, 40, 50, 60, 80, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 8000];
  var FN = [1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9, 10, 11, 13, 14, 16, 18, 20, 22];
  var ISO = [100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 6400, 8000, 10000, 12800, 16000, 20000, 25600];
  var ND = [
    { n: 'нет', s: 0 }, { n: 'ND2', s: 1 }, { n: 'ND4', s: 2 }, { n: 'ND8', s: 3 },
    { n: 'ND16', s: 4 }, { n: 'ND32', s: 5 }, { n: 'ND64', s: 6 }, { n: 'ND1000', s: 10 }
  ];
  var FPS = [25, 50, 100];

  /* ---------- Время суток ---------- */
  var TIMES = [
    {
      id: 'sunrise', name: 'Рассвет', clock: '05:50', ev: 9.6, awb: 4300, wbOK: [4800, 6500], expTol: [-0.6, 0.5],
      sky: ['#56679c', '#9d8fb4', '#e9b5a6', '#ffd6a6'], skyPos: [0, 0.45, 0.8, 1], skyBoost: [0.1, 0.9],
      sun: { vis: true, x: 140, y: HOR - 8, r: 14, col: '#fff3dc', glow: '#ffb98e', glowA: 0.85, glowR: 330, glowM: 1.6 },
      amb: [0.40, 0.38, 0.50], key: [0.95, 0.66, 0.45], groundK: 0.35, facK: 0.35, sunSide: -1,
      haze: '#cfaab4', mount: '#626a8c', cloud: '#f6c0ae', cloudA: 0.55, mist: 0.6,
      lamps: 0, windows: 0.06, stars: 0, glint: 0.05,
      subj: { kL: 0.55, kR: 0.04, top: 0, rim: { side: -1, col: '#ffcf9e', a: 0.85, m: 1.2 } },
      shadow: { dx: 230, dy: 22, a: 0.42 },
      rec: { fps: 25, sh: 50, f: 4, iso: 100, nd: 0, wb: 5600 },
      info: {
        light: 'Мягкий, тёплый, розово-персиковый', temp: '≈ 3000–4000 K', ev: 'EV ≈ 10', shadow: 'Длинные и мягкие',
        tips: [
          'Свет меняется каждые 5–10 минут — перепроверяйте экспозицию.',
          'Ставьте баланс белого вручную (5000–5600K), иначе автоматика «съест» розовые тона.',
          'Солнце за спиной героя даёт контровой свет — лицо темнее неба, это нормально.'
        ],
        task: 'Сохраните нежный цвет неба и снимите без шума.'
      }
    },
    {
      id: 'morning', name: 'Утро', clock: '09:00', ev: 13.6, awb: 5400, wbOK: [5000, 6200], expTol: [-0.5, 0.5],
      sky: ['#3a78cc', '#6b9fdc', '#a9c9ea', '#d3e3ee'], skyPos: [0, 0.4, 0.8, 1], skyBoost: [0.15, 0.55],
      sun: { vis: false, x: -40, y: 10, r: 0, glow: '#fff1cf', glowA: 0.55, glowR: 300, glowM: 1.0 },
      amb: [0.27, 0.31, 0.40], key: [1.0, 0.92, 0.80], groundK: 0.62, facK: 0.75, sunSide: -1,
      haze: '#c3d3e2', mount: '#6d7f97', cloud: '#ffffff', cloudA: 0.7, mist: 0.15,
      lamps: 0, windows: 0, stars: 0, glint: 0.04,
      subj: { kL: 0.92, kR: 0.14, top: 0.15, rim: null },
      shadow: { dx: 160, dy: -26, a: 0.55 },
      rec: { fps: 25, sh: 50, f: 4, iso: 100, nd: 4, wb: 5600 },
      info: {
        light: 'Направленный, ещё мягкий, чуть тёплый', temp: '≈ 4500–5500 K', ev: 'EV ≈ 13–14', shadow: 'Длинные, чёткие',
        tips: [
          'Боковой свет красиво рисует объём лица — ставьте героя боком к солнцу.',
          'Уже светло: чтобы снимать на 1/50 с открытой диафрагмой, нужен ND-фильтр.',
          'ISO держите базовым (100) — света хватает.'
        ],
        task: 'Сохраните выдержку 1/50 и размытый фон — без ND не получится.'
      }
    },
    {
      id: 'noon', name: 'Полдень', clock: '13:00', ev: 14.6, awb: 5700, wbOK: [5000, 6200], expTol: [-0.6, 0.4],
      sky: ['#2462c9', '#4a87da', '#8fbbea', '#c4dcef'], skyPos: [0, 0.4, 0.82, 1], skyBoost: [0.15, 0.5],
      sun: { vis: false, x: 380, y: -200, r: 0, glow: '#ffffff', glowA: 0.25, glowR: 300, glowM: 0.5 },
      amb: [0.20, 0.24, 0.32], key: [1.12, 1.08, 1.0], groundK: 1.0, facK: 0.9, sunSide: 0,
      haze: '#bcd2e6', mount: '#6f8299', cloud: '#ffffff', cloudA: 0.85, mist: 0,
      lamps: 0, windows: 0, stars: 0, glint: 0,
      subj: { kL: 0.42, kR: 0.32, top: 1, rim: null },
      shadow: { dx: 16, dy: 5, a: 0.62 },
      rec: { fps: 25, sh: 50, f: 5.6, iso: 100, nd: 4, wb: 5600 },
      info: {
        light: 'Жёсткий, контрастный, сверху', temp: '≈ 5500–6500 K', ev: 'EV ≈ 15', shadow: 'Короткие, резкие; тени в глазницах',
        tips: [
          'Самое яркое время: без ND придётся ставить короткую выдержку — движение станет «дёрганым».',
          'Верхний свет кладёт тени под глаза и нос — по возможности уведите героя в тень.',
          'Включите зебру: белая одежда и небо пересвечиваются первыми.'
        ],
        task: 'Уберите пересвет, не трогая правило 180°.'
      }
    },
    {
      id: 'sunset', name: 'Закат', clock: '19:40', ev: 11.6, awb: 3400, wbOK: [5000, 7000], expTol: [-0.9, 0.4],
      sky: ['#2f3b74', '#8a5c86', '#e57d5d', '#ffb056'], skyPos: [0, 0.42, 0.78, 1], skyBoost: [0.1, 1.2],
      sun: { vis: true, x: 630, y: HOR - 22, r: 15, col: '#fff0c8', glow: '#ff9a45', glowA: 0.95, glowR: 380, glowM: 2.0 },
      amb: [0.30, 0.23, 0.29], key: [1.15, 0.6, 0.28], groundK: 0.38, facK: 0.08, sunSide: 1,
      haze: '#d98a6e', mount: '#4a3b5e', cloud: '#ff9f7a', cloudA: 0.75, mist: 0.2,
      lamps: 0, windows: 0.04, stars: 0, glint: 0.18,
      subj: { kL: 0.0, kR: 0.18, top: 0, rim: { side: 1, col: '#ffbf72', a: 1, m: 1.8 } },
      shadow: { dx: -250, dy: 34, a: 0.5 },
      rec: { fps: 25, sh: 50, f: 2.8, iso: 100, nd: 3, wb: 5600 },
      info: {
        light: 'Тёплый, золотой, низкий, контровой', temp: '≈ 2500–3500 K', ev: 'EV ≈ 11–12', shadow: 'Очень длинные',
        tips: [
          'Автобаланс белого «гасит» закат — ставьте 5600K вручную.',
          'Солнце в кадре сбивает экспонометр — ориентируйтесь на зебру и лицо героя.',
          '«Золотой час» короткий: на съёмку у вас 20–40 минут.'
        ],
        task: 'Сохраните тёплый цвет и не «выбейте» небо в белое.'
      }
    },
    {
      id: 'blue', name: 'Синий час', clock: '20:25', ev: 5.6, awb: 8200, wbOK: [3800, 5800], expTol: [-0.7, 0.6],
      sky: ['#0b1840', '#1d3570', '#3d5b9a', '#a7889a'], skyPos: [0, 0.45, 0.85, 1], skyBoost: [0, 0.15],
      sun: { vis: false, x: 700, y: HOR + 60, r: 0, glow: '#d98b6a', glowA: 0.35, glowR: 260, glowM: 0.2 },
      amb: [0.15, 0.21, 0.46], key: [0.95, 0.62, 0.30], groundK: 0, facK: 0, sunSide: 0,
      haze: '#40568c', mount: '#1c2547', cloud: '#5a5f8f', cloudA: 0.4, mist: 0,
      lamps: 1, windows: 0.32, stars: 0.6, glint: 0,
      subj: { kL: 0.75, kR: 0.0, top: 0, rim: { side: 1, col: '#7fa4ff', a: 0.35, m: 0 } },
      shadow: { dx: 0, dy: 0, a: 0 },
      rec: { fps: 25, sh: 50, f: 2.8, iso: 800, nd: 0, wb: 4800 },
      info: {
        light: 'Рассеянный и холодный + тёплые фонари', temp: 'небо ≈ 9000–12000 K, фонари ≈ 3000 K', ev: 'EV ≈ 5–6', shadow: 'Почти нет',
        tips: [
          'Света мало: откройте диафрагму полностью, выдержку не делайте длиннее 1/50.',
          'Поднимайте ISO постепенно — выше 1600–3200 появится заметный шум.',
          'Главная красота — контраст синего неба и тёплых фонарей. Баланс белого 4000–5000K.',
          'Синий час длится всего 20–40 минут после заката.'
        ],
        task: 'Получите светлый кадр с минимальным шумом.'
      }
    }
  ];

  /* ---------- Утилиты ---------- */
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function s2l(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function l2s(c) { c = clamp(c, 0, 1); return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }
  function hx(h) {
    h = h.charAt(0) === '#' ? h.slice(1) : h;
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  }
  function lin(h) { var a = hx(h); return [s2l(a[0]), s2l(a[1]), s2l(a[2])]; }
  function css(l, a) {
    var r = Math.round(255 * l2s(l[0])), g = Math.round(255 * l2s(l[1])), b = Math.round(255 * l2s(l[2]));
    return a == null ? 'rgb(' + r + ',' + g + ',' + b + ')' : 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }
  function mixL(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function mixH(h1, h2, t) { return css(mixL(lin(h1), lin(h2), t)); }
  function gray(m) { var v = Math.round(clamp(m / BOOSTK, 0, 1) * 255); return 'rgb(' + v + ',' + v + ',' + v + ')'; }
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  /* цвет поверхности: альбедо × (рассеянный + ключевой·k) */
  function litL(T, albedo, k) {
    var a = lin(albedo);
    return [a[0] * (T.amb[0] + T.key[0] * k), a[1] * (T.amb[1] + T.key[1] * k), a[2] * (T.amb[2] + T.key[2] * k)];
  }
  function lit(T, albedo, k, a) { return css(litL(T, albedo, k), a); }
  function hazeL(T, l, t) { return mixL(l, lin(T.haze), t); }

  /* Цвет абсолютно чёрного тела (приближение Таннера Хелланда), в линейном RGB */
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
  /* Коэффициенты баланса белого: сцена «как снята на 5600K» */
  function wbGains(K) {
    var ref = kRGB(5600), c = kRGB(K);
    var g = [ref[0] / c[0], ref[1] / c[1], ref[2] / c[2]];
    var n = 0.2126 * g[0] + 0.7152 * g[1] + 0.0722 * g[2];
    return [g[0] / n, g[1] / n, g[2] / n];
  }

  /* ---------- Размытие (3 прохода box ≈ гаусс) ---------- */
  function boxesForGauss(sigma, n) {
    var wIdeal = Math.sqrt((12 * sigma * sigma / n) + 1), wl = Math.floor(wIdeal);
    if (wl % 2 === 0) wl--;
    var wu = wl + 2, m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4)), s = [];
    for (var i = 0; i < n; i++) s.push(i < m ? wl : wu);
    return s;
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
    var a = new Float32Array(buf);
    if (sigma < 0.35) return a;
    var b = new Float32Array(buf.length), boxes = boxesForGauss(sigma, 3);
    for (var i = 0; i < 3; i++) {
      var r = (boxes[i] - 1) >> 1;
      if (r < 1) continue;
      blurPass(a, b, w, h, r, true, ch);
      blurPass(b, a, w, h, r, false, ch);
    }
    return a;
  }

  /* ---------- Таблицы ---------- */
  var OETF = new Uint8ClampedArray(4096);
  for (var oi = 0; oi < 4096; oi++) OETF[oi] = Math.round(255 * l2s(oi / 4095));
  var LIN8 = new Float32Array(256);
  for (var li = 0; li < 256; li++) LIN8[li] = s2l(li / 255);
  var NZN = 1 << 19, NZM = NZN - 1, NZ = new Float32Array(NZN);
  (function () {
    var R = rng(99);
    for (var i = 0; i < NZN; i += 2) {
      var u = Math.max(1e-7, R()), v = R(), m = Math.sqrt(-2 * Math.log(u));
      NZ[i] = m * Math.cos(6.2831853 * v); NZ[i + 1] = m * Math.sin(6.2831853 * v);
    }
  })();
  var RR = new Float32Array(W * H);
  (function () {
    var cx = W / 2, cy = H / 2, d = cx * cx + cy * cy;
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var q = ((x - cx) * (x - cx) + (y - cy) * (y - cy)) / d;
      RR[y * W + x] = Math.pow(q, 1.15);
    }
  })();
  /* «удалённость» строки кадра: 1 — дальний план, 0 — плоскость фокуса (ноги героя) */
  var DEPTH = new Float32Array(H);
  for (var dy = 0; dy < H; dy++) {
    DEPTH[dy] = dy < HOR ? 1 :
      dy < ROAD ? 1 - 0.5 * (dy - HOR) / (ROAD - HOR) :
      dy < FEET ? 0.5 * (1 - (dy - ROAD) / (FEET - ROAD)) :
      0.2 * (dy - FEET) / (H - FEET);
  }
  var LEVELS = [0, 1.2, 2.5, 4.5, 7.5, 11.5]; // радиусы размытия (px) для предрасчёта

  /* ---------- Рисование сцены ---------- */
  function paintScene(T) {
    var B = canvas(W, H), X = canvas(W, H), b = B.getContext('2d'), x = X.getContext('2d');
    var R = rng(11);
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
    var lights = [];

    /* небо */
    var g = b.createLinearGradient(0, 0, 0, HOR + 4);
    for (var i = 0; i < T.sky.length; i++) g.addColorStop(T.skyPos[i], T.sky[i]);
    b.fillStyle = g; b.fillRect(0, 0, W, HOR + 4);
    g = x.createLinearGradient(0, 0, 0, HOR + 4);
    g.addColorStop(0, gray(T.skyBoost[0])); g.addColorStop(1, gray(T.skyBoost[1]));
    x.fillStyle = g; x.fillRect(0, 0, W, HOR + 4);

    /* звёзды */
    if (T.stars) {
      for (i = 0; i < 90; i++) {
        var sx = R() * W, sy = R() * HOR * 0.6, sa = T.stars * (0.3 + 0.7 * R()) * (1 - sy / (HOR * 0.6));
        b.fillStyle = 'rgba(235,240,255,' + sa.toFixed(3) + ')';
        b.fillRect(sx, sy, R() < 0.15 ? 1.6 : 1, R() < 0.15 ? 1.6 : 1);
      }
    }

    /* сияние солнца */
    var S = T.sun;
    b.save(); b.globalCompositeOperation = 'screen';
    g = b.createRadialGradient(S.x, S.y, 0, S.x, S.y, S.glowR);
    g.addColorStop(0, css(lin(S.glow), S.glowA)); g.addColorStop(0.25, css(lin(S.glow), S.glowA * 0.45));
    g.addColorStop(1, css(lin(S.glow), 0));
    b.fillStyle = g; b.fillRect(0, 0, W, HOR + 4); b.restore();
    x.save(); x.globalCompositeOperation = 'lighter';
    g = x.createRadialGradient(S.x, S.y, 0, S.x, S.y, S.glowR * 0.7);
    g.addColorStop(0, gray(S.glowM)); g.addColorStop(0.3, gray(S.glowM * 0.35)); g.addColorStop(1, gray(0));
    x.fillStyle = g; x.fillRect(0, 0, W, HOR + 4); x.restore();

    /* облака */
    var cl = lin(T.cloud);
    for (i = 0; i < 7; i++) {
      var cx = R() * W, cy = 30 + R() * (HOR - 110), cw = 60 + R() * 140, ch = 6 + R() * 9;
      for (var k = 0; k < 4; k++) {
        var ox = cx + (R() - 0.5) * cw, oy = cy + (R() - 0.5) * ch * 1.5, rr = cw * (0.35 + R() * 0.3);
        b.save(); b.translate(ox, oy); b.scale(1, ch / rr);
        g = b.createRadialGradient(0, 0, 0, 0, 0, rr);
        g.addColorStop(0, css(cl, T.cloudA * 0.55)); g.addColorStop(1, css(cl, 0));
        b.fillStyle = g; b.beginPath(); b.arc(0, 0, rr, 0, 6.2832); b.fill(); b.restore();
      }
    }

    /* солнечный диск */
    if (S.vis) {
      b.fillStyle = S.col; b.beginPath(); b.arc(S.x, S.y, S.r, 0, 6.2832); b.fill();
      g = x.createRadialGradient(S.x, S.y, 0, S.x, S.y, S.r * 3);
      g.addColorStop(0, gray(16)); g.addColorStop(0.3, gray(12)); g.addColorStop(0.36, gray(3)); g.addColorStop(1, gray(0));
      x.save(); x.globalCompositeOperation = 'lighter'; x.fillStyle = g;
      x.beginPath(); x.arc(S.x, S.y, S.r * 3, 0, 6.2832); x.fill(); x.restore();
    }

    /* горы: дальний и ближний хребты */
    function ridge(y0, amp, seed, col) {
      var r2 = rng(seed), p = [r2() * 6, r2() * 6, r2() * 6];
      function path(c) {
        c.beginPath(); c.moveTo(0, HOR + 4);
        for (var xx = 0; xx <= W; xx += 6) {
          var n = 0.5 * Math.sin(xx / 97 + p[0]) + 0.3 * Math.sin(xx / 41 + p[1]) + 0.2 * Math.sin(xx / 17 + p[2]);
          c.lineTo(xx, y0 - amp * (0.5 + 0.5 * n));
        }
        c.lineTo(W, HOR + 4); c.closePath();
      }
      path(b); b.fillStyle = col; b.fill();
      path(x); x.fillStyle = '#000'; x.fill();
    }
    var mt = litL(T, '#7a8299', T.facK * 0.4);
    mt = mixL(mt, lin(T.mount), 0.6);
    ridge(HOR - 6, 46, 3, css(hazeL(T, mt, 0.62)));
    ridge(HOR + 2, 26, 8, css(hazeL(T, mt, 0.4)));

    /* дымка */
    if (T.mist) {
      g = b.createLinearGradient(0, HOR - 40, 0, HOR + 40);
      var hz = lin(T.haze);
      g.addColorStop(0, css(hz, 0)); g.addColorStop(0.55, css(hz, 0.55 * T.mist)); g.addColorStop(1, css(hz, 0));
      b.fillStyle = g; b.fillRect(0, HOR - 40, W, 80);
    }

    /* город */
    function city(x0, x1, hmin, hmax, seed) {
      var r2 = rng(seed), xx = x0;
      while (xx < x1) {
        var bw = 16 + r2() * 26, bh = hmin + r2() * (hmax - hmin), by = HOR + 6 - bh;
        var alb = ['#8d9098', '#a39a8c', '#7c8494', '#9a8f88'][Math.floor(r2() * 4)];
        var face = hazeL(T, litL(T, alb, T.facK), 0.35), side = hazeL(T, litL(T, alb, T.facK * 0.25), 0.35);
        b.fillStyle = css(face); b.fillRect(xx, by, bw, bh);
        b.fillStyle = css(side); b.fillRect(T.sunSide > 0 ? xx : xx + bw - 4, by, 4, bh);
        x.fillStyle = '#000'; x.fillRect(xx, by, bw, bh);
        for (var wy = by + 5; wy < HOR; wy += 8) {
          for (var wx = xx + 4; wx < xx + bw - 6; wx += 6) {
            var q = r2();
            if (q < T.windows) {
              b.fillStyle = q < T.windows * 0.5 ? '#ffd08a' : '#ffe7bd'; b.fillRect(wx, wy, 3, 4);
              x.fillStyle = gray(1.6); x.fillRect(wx, wy, 3, 4);
            } else if (q > 1 - T.glint) {
              b.fillStyle = '#ffd9a0'; b.fillRect(wx, wy, 3, 4);
              x.fillStyle = gray(2.5); x.fillRect(wx, wy, 3, 4);
            } else {
              b.fillStyle = css(mixL(face, lin(T.sky[1]), 0.35), 0.9); b.fillRect(wx, wy, 3, 4);
            }
          }
        }
        if (T.lamps) for (var c = 0; c < 2; c++) lights.push({ x: xx + r2() * bw, y: HOR + 3 + r2() * 3, d: 1, I: [2.2, 1.6, 0.9] });
        xx += bw + r2() * 3;
      }
    }
    city(4, 300, 26, 92, 21);
    city(712, 768, 20, 44, 34);

    /* деревья среднего плана */
    function tree(tx, ty, th, seed) {
      var r2 = rng(seed), alb = '#4f6e35';
      var lt = css(hazeL(T, litL(T, alb, 0.85 * (T.groundK + 0.15)), 0.22)), sh = css(hazeL(T, litL(T, alb, 0), 0.22));
      b.fillStyle = css(hazeL(T, litL(T, '#4a3a2c', 0.2), 0.2)); b.fillRect(tx - 2, ty - th * 0.35, 4, th * 0.35);
      x.fillStyle = '#000'; x.fillRect(tx - 2, ty - th * 0.35, 4, th * 0.35);
      for (var j = 0; j < 7; j++) {
        var px = tx + (r2() - 0.5) * th * 0.55, py = ty - th * 0.45 - r2() * th * 0.45, pr = th * (0.16 + r2() * 0.12);
        var gx = T.sunSide === 0 ? b.createLinearGradient(px, py - pr, px, py + pr) :
          b.createLinearGradient(px - pr * T.sunSide, py, px + pr * T.sunSide, py);
        if (T.sunSide > 0) { gx.addColorStop(0, sh); gx.addColorStop(1, lt); }
        else { gx.addColorStop(0, lt); gx.addColorStop(1, sh); }
        b.fillStyle = gx; b.beginPath(); b.arc(px, py, pr, 0, 6.2832); b.fill();
        x.fillStyle = '#000'; x.beginPath(); x.arc(px, py, pr, 0, 6.2832); x.fill();
      }
    }
    tree(328, HOR + 12, 62, 5); tree(372, HOR + 10, 48, 6); tree(724, HOR + 14, 70, 7); tree(16, HOR + 14, 54, 9);

    /* земля */
    var grass = litL(T, '#6f8f45', T.groundK);
    g = b.createLinearGradient(0, HOR, 0, H);
    g.addColorStop(0, css(hazeL(T, grass, 0.55))); g.addColorStop(0.25, css(hazeL(T, grass, 0.2)));
    g.addColorStop(1, css(mixL(grass, [0, 0, 0], 0.25)));
    b.fillStyle = g; b.fillRect(0, HOR + 3, W, H - HOR);
    x.fillStyle = '#000'; x.fillRect(0, HOR + 3, W, H - HOR);
    for (i = 0; i < 900; i++) {
      var gy = HOR + 6 + Math.pow(R(), 0.7) * (H - HOR - 6), gx2 = R() * W, gl = 1 + (gy - HOR) / 40;
      b.strokeStyle = R() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,220,0.07)';
      b.lineWidth = 0.6 + (gy - HOR) / 160; b.beginPath(); b.moveTo(gx2, gy); b.lineTo(gx2 + (R() - 0.5) * gl, gy - gl * 1.6); b.stroke();
    }

    /* дорога */
    var asph = hazeL(T, litL(T, '#5c5d61', T.groundK), 0.12);
    b.fillStyle = css(asph);
    b.beginPath(); b.moveTo(0, 304); b.quadraticCurveTo(W / 2, 300, W, 304); b.lineTo(W, 330); b.quadraticCurveTo(W / 2, 326, 0, 330); b.fill();
    b.strokeStyle = css(hazeL(T, litL(T, '#b5b1a8', T.groundK), 0.1)); b.lineWidth = 1.2;
    b.beginPath(); b.moveTo(0, 304); b.quadraticCurveTo(W / 2, 300, W, 304); b.stroke();
    b.beginPath(); b.moveTo(0, 330); b.quadraticCurveTo(W / 2, 326, W, 330); b.stroke();
    b.strokeStyle = css(hazeL(T, litL(T, '#d9d5c8', T.groundK), 0.1), 0.7); b.setLineDash([14, 12]); b.lineWidth = 1.4;
    b.beginPath(); b.moveTo(0, 317); b.quadraticCurveTo(W / 2, 313, W, 317); b.stroke(); b.setLineDash([]);

    /* фонари */
    [64, 236, 566, 690].forEach(function (lx) {
      var top = 300 - 52, pole = css(hazeL(T, litL(T, '#2c2d31', 0.3), 0.15));
      b.fillStyle = pole; b.fillRect(lx - 1, top, 2, 52); b.fillRect(lx - 1, top, 9, 2);
      x.fillStyle = '#000'; x.fillRect(lx - 1, top, 2, 52);
      b.fillStyle = T.lamps ? '#ffe2a8' : pole; b.fillRect(lx + 5, top + 1, 5, 3);
      if (T.lamps) {
        lights.push({ x: lx + 7.5, y: top + 3, d: 0.85, I: [14, 9.5, 4.8] });
        b.save(); b.globalCompositeOperation = 'screen';
        g = b.createRadialGradient(lx + 7, top + 3, 0, lx + 7, top + 3, 26);
        g.addColorStop(0, 'rgba(255,190,110,0.45)'); g.addColorStop(1, 'rgba(255,190,110,0)');
        b.fillStyle = g; b.fillRect(lx - 30, top - 30, 70, 70);
        b.translate(lx + 8, 318); b.scale(1, 0.22);
        g = b.createRadialGradient(0, 0, 0, 0, 0, 60);
        g.addColorStop(0, 'rgba(255,170,90,0.55)'); g.addColorStop(1, 'rgba(255,170,90,0)');
        b.fillStyle = g; b.beginPath(); b.arc(0, 0, 60, 0, 6.2832); b.fill(); b.restore();
      }
    });

    /* тень героя на земле */
    var sh = T.shadow;
    var ratio = [0, 1, 2].map(function (c) { var a = T.amb[c], s = T.key[c] * T.groundK; return a / (a + s + 1e-6); });
    var shc = css(ratio);
    b.save(); b.globalCompositeOperation = 'multiply';
    if (sh.a) {
      var tx2 = CX + sh.dx, ty2 = FEET + sh.dy;
      g = b.createLinearGradient(CX, FEET, tx2, ty2);
      g.addColorStop(0, css(ratio, sh.a + 0.35)); g.addColorStop(1, css(ratio, sh.a * 0.6));
      b.fillStyle = g;
      var nx = -(ty2 - FEET), ny = tx2 - CX, nl = Math.sqrt(nx * nx + ny * ny) || 1; nx /= nl; ny /= nl;
      b.beginPath();
      b.moveTo(CX - nx * 18, FEET - ny * 6); b.lineTo(tx2 - nx * 16, ty2 - ny * 10);
      b.quadraticCurveTo(tx2 + (tx2 - CX) * 0.06, ty2 + (ty2 - FEET) * 0.06, tx2 + nx * 16, ty2 + ny * 10);
      b.lineTo(CX + nx * 18, FEET + ny * 6); b.closePath(); b.fill();
    }
    b.translate(CX, FEET - 2); b.scale(1, 0.25);
    g = b.createRadialGradient(0, 0, 0, 0, 0, 40);
    g.addColorStop(0, 'rgba(20,20,30,0.55)'); g.addColorStop(1, 'rgba(20,20,30,0)');
    b.fillStyle = g; b.beginPath(); b.arc(0, 0, 40, 0, 6.2832); b.fill();
    b.restore();
    void shc;

    /* передний план: тёмная трава */
    for (i = 0; i < 160; i++) {
      var fx = R() * W, fy = H - R() * 22, fl = 8 + R() * 16;
      b.strokeStyle = css(mixL(grass, [0, 0, 0], 0.5), 0.7); b.lineWidth = 1.4;
      b.beginPath(); b.moveTo(fx, H); b.quadraticCurveTo(fx + (R() - 0.5) * 6, fy, fx + (R() - 0.5) * 10, fy - fl); b.stroke();
    }

    /* в линейный HDR */
    var bd = b.getImageData(0, 0, W, H).data, xd = x.getImageData(0, 0, W, H).data;
    var bg = new Float32Array(W * H * 3);
    for (var p = 0, q = 0; p < W * H; p++, q += 4) {
      var m = 1 + xd[q] / 255 * BOOSTK;
      bg[p * 3] = LIN8[bd[q]] * m; bg[p * 3 + 1] = LIN8[bd[q + 1]] * m; bg[p * 3 + 2] = LIN8[bd[q + 2]] * m;
    }
    return { bg: bg, lights: lights };
  }

  /* ---------- Герой (отдельный резкий слой) ---------- */
  function paintSubject(T) {
    var C = canvas(W, H), X = canvas(W, H), c = C.getContext('2d'), x = X.getContext('2d');
    var su = T.subj;
    function grad(albedo, x0, x1) {
      var g = c.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, lit(T, albedo, su.kL)); g.addColorStop(1, lit(T, albedo, su.kR));
      return g;
    }
    function shape(fn, fill) { c.beginPath(); fn(c); c.fillStyle = fill; c.fill(); }
    function ell(cx, cy, rx, ry) { return function (k) { k.ellipse(cx, cy, rx, ry, 0, 0, 6.2832); }; }
    function poly(pts) { return function (k) { k.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) k.lineTo(pts[i], pts[i + 1]); k.closePath(); }; }
    var SKIN = '#d6a084', HAIR = '#3b2a20', JACKET = '#c98a2e', TEE = '#ebe6dc', JEANS = '#33435f', SHOE = '#242326';
    var X0 = CX - 40, X1 = CX + 40;

    /* ноги и обувь */
    shape(poly([CX - 24, 290, CX - 1, 290, CX - 4, 392, CX - 19, 392]), grad(JEANS, X0, X1));
    shape(poly([CX + 1, 290, CX + 24, 290, CX + 19, 392, CX + 4, 392]), grad(JEANS, X0, X1));
    shape(poly([CX - 25, 280, CX + 25, 280, CX + 25, 300, CX - 25, 300]), grad(JEANS, X0, X1));
    shape(ell(CX - 13, 395, 10, 5), grad(SHOE, X0, X1));
    shape(ell(CX + 13, 395, 10, 5), grad(SHOE, X0, X1));
    /* шея */
    shape(poly([CX - 5.5, 180, CX + 5.5, 180, CX + 6, 198, CX - 6, 198]), grad(SKIN, CX - 10, CX + 10));
    /* футболка */
    shape(poly([CX - 29, 197, CX + 29, 197, CX + 24, 284, CX - 24, 284]), grad(TEE, X0, X1));
    /* куртка (две полы) и плечи */
    shape(poly([CX - 31, 196, CX - 8, 196, CX - 10, 286, CX - 27, 286]), grad(JACKET, X0, X1));
    shape(poly([CX + 8, 196, CX + 31, 196, CX + 27, 286, CX + 10, 286]), grad(JACKET, X0, X1));
    shape(ell(CX - 27, 205, 10, 10), grad(JACKET, X0, X1));
    shape(ell(CX + 27, 205, 10, 10), grad(JACKET, X0, X1));
    /* рукава и кисти */
    shape(poly([CX - 37, 202, CX - 22, 202, CX - 27, 274, CX - 39, 274]), grad(JACKET, X0, X1));
    shape(poly([CX + 22, 202, CX + 37, 202, CX + 39, 274, CX + 27, 274]), grad(JACKET, X0, X1));
    shape(ell(CX - 33, 281, 5, 8), grad(SKIN, X0, X1));
    shape(ell(CX + 33, 281, 5, 8), grad(SKIN, X0, X1));
    /* голова */
    shape(ell(CX, 163, 15.5, 17), grad(HAIR, CX - 16, CX + 16));
    shape(ell(CX, 168, 13.5, 17), grad(SKIN, CX - 14, CX + 14));
    c.save(); c.beginPath(); c.ellipse(CX, 168, 13.5, 17, 0, 0, 6.2832); c.clip();
    shape(ell(CX + 1, 152, 15, 8), grad(HAIR, CX - 16, CX + 16)); c.restore();
    /* лицо */
    var dark = css(litL(T, '#2a1d18', 0.3));
    c.fillStyle = dark;
    c.beginPath(); c.ellipse(CX - 5, 167, 1.7, 1.3, 0, 0, 6.2832); c.fill();
    c.beginPath(); c.ellipse(CX + 5, 167, 1.7, 1.3, 0, 0, 6.2832); c.fill();
    c.strokeStyle = css(litL(T, HAIR, 0.3)); c.lineWidth = 1.3;
    c.beginPath(); c.moveTo(CX - 8, 163); c.lineTo(CX - 2.5, 162.5); c.moveTo(CX + 2.5, 162.5); c.lineTo(CX + 8, 163); c.stroke();
    c.strokeStyle = css(litL(T, '#9c5a4b', 0.4)); c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(CX - 3.5, 177.5); c.quadraticCurveTo(CX, 178.6, CX + 3.5, 177.5); c.stroke();
    /* тени носа на стороне без света */
    var nsSide = su.kL >= su.kR ? 1 : -1;
    c.fillStyle = 'rgba(70,30,20,0.25)';
    c.beginPath(); c.ellipse(CX + 1.8 * nsSide, 172, 1.8, 3.5, 0, 0, 6.2832); c.fill();

    /* верхний свет: тени в глазницах, под носом и подбородком */
    if (su.top) {
      c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = su.top;
      [[-5, 166.5], [5, 166.5]].forEach(function (e) {
        var ge = c.createRadialGradient(CX + e[0], e[1], 0, CX + e[0], e[1], 5);
        ge.addColorStop(0, 'rgba(110,80,80,0.75)'); ge.addColorStop(1, 'rgba(110,80,80,0)');
        c.fillStyle = ge; c.beginPath(); c.arc(CX + e[0], e[1], 5, 0, 6.2832); c.fill();
      });
      var gn = c.createRadialGradient(CX, 175.5, 0, CX, 175.5, 4);
      gn.addColorStop(0, 'rgba(140,110,105,0.45)'); gn.addColorStop(1, 'rgba(120,90,90,0)');
      c.fillStyle = gn; c.beginPath(); c.arc(CX, 175.5, 4, 0, 6.2832); c.fill();
      var gk = c.createLinearGradient(0, 181, 0, 197);
      gk.addColorStop(0, 'rgb(105,85,90)'); gk.addColorStop(1, 'rgb(190,180,180)');
      c.fillStyle = gk; c.fillRect(CX - 6, 181, 12, 16);
      c.restore();
      c.save(); c.globalCompositeOperation = 'screen'; c.globalAlpha = 0.5 * su.top;
      var gh = c.createLinearGradient(0, 146, 0, 160);
      gh.addColorStop(0, 'rgba(255,250,235,0.9)'); gh.addColorStop(1, 'rgba(255,250,235,0)');
      c.fillStyle = gh; c.beginPath(); c.ellipse(CX, 158, 15, 12, 0, 0, 6.2832); c.fill();
      c.restore();
    }

    /* контровой свет: светлая кромка по силуэту */
    if (su.rim) {
      var rimC = canvas(W, H), rc = rimC.getContext('2d');
      [[1.5, 1], [3.5, 0.45], [6, 0.18]].forEach(function (s) {
        var u = canvas(W, H), uc = u.getContext('2d');
        uc.drawImage(C, 0, 0); uc.globalCompositeOperation = 'source-in';
        uc.fillStyle = '#fff'; uc.fillRect(0, 0, W, H);
        uc.globalCompositeOperation = 'destination-out';
        uc.drawImage(C, -su.rim.side * s[0], s[0] * 0.55);
        rc.globalAlpha = s[1]; rc.drawImage(u, 0, 0);
      });
      function tint(col) {
        var t = canvas(W, H), tc = t.getContext('2d');
        tc.drawImage(rimC, 0, 0); tc.globalCompositeOperation = 'source-in'; tc.fillStyle = col; tc.fillRect(0, 0, W, H);
        return t;
      }
      c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = su.rim.a; c.drawImage(tint(su.rim.col), 0, 0); c.restore();
      if (su.rim.m) { x.save(); x.globalCompositeOperation = 'lighter'; x.drawImage(tint(gray(su.rim.m)), 0, 0); x.restore(); }
    }

    var cd = c.getImageData(0, 0, W, H).data, xd = x.getImageData(0, 0, W, H).data;
    var rgb = new Float32Array(W * H * 3), al = new Float32Array(W * H);
    for (var p = 0, q = 0; p < W * H; p++, q += 4) {
      var a = cd[q + 3] / 255;
      if (!a) continue;
      var m = (1 + xd[q] / 255 * BOOSTK) * a;
      al[p] = a; rgb[p * 3] = LIN8[cd[q]] * m; rgb[p * 3 + 1] = LIN8[cd[q + 1]] * m; rgb[p * 3 + 2] = LIN8[cd[q + 2]] * m;
    }
    return { rgb: rgb, a: al };
  }

  /* ---------- Велосипедист (спрайт для смаза движения) ---------- */
  var SPW = 140, SPH = 112, SPOX = 10, SPOY = 8;
  function paintCyclist(T) {
    var C = canvas(SPW, SPH), X = canvas(SPW, SPH), c = C.getContext('2d'), x = X.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, SPW, SPH);
    c.translate(SPOX, SPOY); x.translate(SPOX, SPOY);
    var k = 0.55, hz = 0.1;
    function col(a, kk) { return css(hazeL(T, litL(T, a, kk == null ? k : kk), hz)); }
    c.lineCap = 'round'; c.lineJoin = 'round';
    /* колёса */
    [[28, 78], [90, 78]].forEach(function (w) {
      c.strokeStyle = col('#1d1d20'); c.lineWidth = 3.2; c.beginPath(); c.arc(w[0], w[1], 17, 0, 6.2832); c.stroke();
      c.strokeStyle = col('#9a9aa0', 0.4); c.lineWidth = 0.6;
      for (var a = 0; a < 6.28; a += 0.52) { c.beginPath(); c.moveTo(w[0], w[1]); c.lineTo(w[0] + Math.cos(a) * 15, w[1] + Math.sin(a) * 15); c.stroke(); }
    });
    /* рама */
    c.strokeStyle = col('#b8352b'); c.lineWidth = 2.6;
    c.beginPath(); c.moveTo(28, 78); c.lineTo(52, 56); c.lineTo(82, 56); c.lineTo(90, 78);
    c.moveTo(52, 56); c.lineTo(57, 78); c.lineTo(28, 78); c.moveTo(57, 78); c.lineTo(82, 56);
    c.moveTo(50, 50); c.lineTo(57, 78); c.moveTo(82, 56); c.lineTo(84, 46); c.stroke();
    c.strokeStyle = col('#222'); c.lineWidth = 3; c.beginPath(); c.moveTo(45, 50); c.lineTo(55, 50); c.moveTo(81, 46); c.lineTo(89, 47); c.stroke();
    /* гонщик */
    c.strokeStyle = col('#27272c'); c.lineWidth = 6;
    c.beginPath(); c.moveTo(51, 46); c.lineTo(64, 60); c.lineTo(59, 80); c.stroke();
    c.lineWidth = 5.5; c.beginPath(); c.moveTo(51, 46); c.lineTo(58, 64); c.lineTo(62, 76); c.stroke();
    c.strokeStyle = col('#2d6cb5'); c.lineWidth = 11;
    c.beginPath(); c.moveTo(51, 44); c.lineTo(71, 22); c.stroke();
    c.lineWidth = 4.5; c.beginPath(); c.moveTo(71, 24); c.lineTo(80, 36); c.lineTo(86, 46); c.stroke();
    c.fillStyle = col('#d4a083'); c.beginPath(); c.arc(79, 13, 6.5, 0, 6.2832); c.fill();
    c.fillStyle = col('#e9e9ec'); c.beginPath(); c.arc(78, 11, 7.5, 3.3, 6.2); c.fill();
    if (T.lamps) {
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(90, 47, 2, 0, 6.2832); c.fill();
      x.fillStyle = gray(10); x.beginPath(); x.arc(90, 47, 2.2, 0, 6.2832); x.fill();
      c.fillStyle = '#ff2a1a'; c.fillRect(44, 47, 3, 2.5);
      x.fillStyle = gray(4); x.fillRect(44, 47, 3, 2.5);
    }
    var cd = c.getImageData(0, 0, SPW, SPH).data, xd = x.getImageData(0, 0, SPW, SPH).data;
    var sp = new Float32Array(SPW * SPH * 4);
    for (var p = 0, q = 0; p < SPW * SPH; p++, q += 4) {
      var a = cd[q + 3] / 255; if (!a) continue;
      var m = (1 + xd[q] / 255 * BOOSTK) * a;
      sp[q] = LIN8[cd[q]] * m; sp[q + 1] = LIN8[cd[q + 1]] * m; sp[q + 2] = LIN8[cd[q + 2]] * m; sp[q + 3] = a;
    }
    return sp;
  }

  /* ---------- Блики объектива (только когда солнце в кадре) ---------- */
  function paintFlare(T) {
    var f = new Float32Array(W * H * 3);
    if (!T.sun.vis) return f;
    var sx = T.sun.x, sy = T.sun.y, vx = W / 2 - sx, vy = H / 2 - sy;
    var ghosts = [[0.55, 34, [0.020, 0.012, 0.006]], [1.3, 9, [0.05, 0.035, 0.02]], [1.6, 22, [0.012, 0.022, 0.03]], [2.05, 5, [0.06, 0.04, 0.02]]];
    ghosts.forEach(function (gh) {
      var gx = sx + vx * gh[0], gy = sy + vy * gh[0], r = gh[1];
      for (var y = Math.max(0, Math.floor(gy - r - 2)); y < Math.min(H, gy + r + 2); y++)
        for (var x = Math.max(0, Math.floor(gx - r - 2)); x < Math.min(W, gx + r + 2); x++) {
          var d = Math.sqrt((x - gx) * (x - gx) + (y - gy) * (y - gy)), e = clamp((r - d) / 2.5, 0, 1);
          if (!e) continue;
          e *= 0.6 + 0.4 * d / r;
          var j = (y * W + x) * 3; f[j] += gh[2][0] * e; f[j + 1] += gh[2][1] * e; f[j + 2] += gh[2][2] * e;
        }
    });
    /* лёгкая вуаль вокруг солнца */
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var dd = ((x - sx) * (x - sx) + (y - sy) * (y - sy)) / (220 * 220), v = 0.05 / (1 + dd * 6);
      var j = (y * W + x) * 3; f[j] += v; f[j + 1] += v * 0.75; f[j + 2] += v * 0.5;
    }
    return f;
  }

  /* ---------- Стили ---------- */
  var CSS = [
    '.dls{--acc:#fd7e2f;--bg:#111214;--panel:#1a1c1f;--panel2:#212428;--line:#2d3035;--tx:#efece7;--mut:#9da0a6;--ok:#3ecf7a;--warn:#f3b23a;--bad:#ff5d52;',
    'font-family:inherit;color:var(--tx);background:var(--bg);border-radius:20px;padding:14px;box-sizing:border-box;max-width:1120px;margin:0 auto;line-height:1.4;-webkit-text-size-adjust:100%;text-align:left}',
    '.dls *,.dls *::before,.dls *::after{box-sizing:border-box}',
    '.dls button{font:inherit;color:inherit;cursor:pointer}',
    '.dls-view{position:relative;width:100%;aspect-ratio:16/9;border-radius:12px;overflow:hidden;background:#000;container-type:inline-size;user-select:none;-webkit-user-select:none}',
    '.dls-view>canvas{position:absolute;inset:0;width:100%;height:100%;display:block}',
    '.dls-fade{pointer-events:none;opacity:0}',
    '.dls-hud{position:absolute;inset:0;pointer-events:none;color:#fff;font:600 11px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:clamp(8px,1.75cqw,14px);text-shadow:0 1px 2px rgba(0,0,0,.8)}',
    '.dls-hud::before,.dls-hud::after{content:"";position:absolute;left:0;right:0;height:16%;pointer-events:none}',
    '.dls-hud::before{top:0;background:linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,0))}',
    '.dls-hud::after{bottom:0;height:22%;background:linear-gradient(rgba(0,0,0,0),rgba(0,0,0,.5))}',
    '.dls-hud .t{z-index:1;position:absolute;left:2.2%;right:2.2%;top:3%;display:flex;justify-content:space-between;align-items:center;gap:8px}',
    '.dls-hud .b{z-index:1;position:absolute;left:2.2%;right:2.2%;bottom:3.5%;display:flex;justify-content:space-between;align-items:flex-end;gap:8px}',
    '.dls-rec{display:inline-flex;align-items:center;gap:.45em}',
    '.dls-rec i{width:.8em;height:.8em;border-radius:50%;background:#777;display:inline-block}',
    '.dls-rec.on i{background:#ff3b30;animation:dlsBlink 1s steps(2,start) infinite}',
    '@keyframes dlsBlink{to{visibility:hidden}}',
    '.dls-bat{display:inline-block;width:1.9em;height:.9em;border:1.5px solid #fff;border-radius:2px;position:relative;vertical-align:-0.1em;margin-left:.5em}',
    '.dls-bat::before{content:"";position:absolute;left:1px;top:1px;bottom:1px;width:70%;background:#fff}',
    '.dls-bat::after{content:"";position:absolute;right:-4px;top:25%;height:50%;width:2px;background:#fff}',
    '.dls-set span{margin-right:.9em;white-space:nowrap}',
    '.dls-set span.warn{color:#ffb84d}',
    '.dls-meter{position:relative;width:30%;min-width:90px;height:1.9em}',
    '.dls-meter .sc{position:absolute;left:0;right:0;bottom:0;height:1em;display:flex;justify-content:space-between;align-items:flex-end;font-size:.8em}',
    '.dls-meter .sc b{font-weight:600;width:0;display:flex;justify-content:center}',
    '.dls-meter .mk{position:absolute;top:0;width:0;height:0;border-left:.45em solid transparent;border-right:.45em solid transparent;border-top:.6em solid var(--acc);transform:translateX(-50%);transition:left .15s}',
    '.dls-meter .ln{position:absolute;left:0;right:0;bottom:1.05em;height:1px;background:rgba(255,255,255,.7)}',
    '.dls-histo{width:22%;max-width:180px;aspect-ratio:2.3/1;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.35);border-radius:3px;display:block}',
    '.dls-af{position:absolute;border:1.5px solid #4cff7a;border-radius:2px;box-shadow:0 0 2px rgba(0,0,0,.6)}',
    '.dls-grid{position:absolute;inset:0;background:linear-gradient(90deg,transparent calc(33.33% - .5px),rgba(255,255,255,.28) calc(33.33% - .5px),rgba(255,255,255,.28) calc(33.33% + .5px),transparent calc(33.33% + .5px),transparent calc(66.66% - .5px),rgba(255,255,255,.28) calc(66.66% - .5px),rgba(255,255,255,.28) calc(66.66% + .5px),transparent calc(66.66% + .5px)),linear-gradient(0deg,transparent calc(33.33% - .5px),rgba(255,255,255,.28) calc(33.33% - .5px),rgba(255,255,255,.28) calc(33.33% + .5px),transparent calc(33.33% + .5px),transparent calc(66.66% - .5px),rgba(255,255,255,.28) calc(66.66% - .5px),rgba(255,255,255,.28) calc(66.66% + .5px),transparent calc(66.66% + .5px));display:none}',
    '.dls-grid.on{display:block}',
    '.dls-tabs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;margin:12px 0}',
    '.dls-tab{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:8px 4px 7px;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0;transition:border-color .15s,background .15s}',
    '.dls-tab:hover{border-color:#4a4e55}',
    '.dls-tab.on{border-color:var(--acc);background:#2a1e16}',
    '.dls-tab .sw{width:100%;max-width:64px;height:22px;border-radius:6px}',
    '.dls-tab .nm{font-size:13px;font-weight:700;line-height:1.1;text-align:center}',
    '.dls-tab .tm{font-size:11px;color:var(--mut)}',
    '.dls-main{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:12px}',
    '@media (max-width:820px){.dls-main{grid-template-columns:minmax(0,1fr)}}',
    '.dls-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px;min-width:0}',
    '.dls-card h4{margin:0 0 10px;font-size:15px;font-weight:700;color:var(--tx);letter-spacing:.01em}',
    '.dls-row{display:block;margin:0 0 12px}',
    '.dls-row .hd{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:14px}',
    '.dls-row .hd b{font-weight:600}',
    '.dls-row output{font:700 14px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--acc);white-space:nowrap}',
    '.dls-row .hint{font-size:12px;color:var(--mut);margin-top:2px}',
    '.dls input[type=range]{width:100%;margin:6px 0 0;accent-color:var(--acc);height:22px;background:transparent}',
    '.dls-seg{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}',
    '.dls-seg button{background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:6px 10px;font-size:13px;line-height:1.2}',
    '.dls-seg button.on{border-color:var(--acc);color:var(--acc);background:#2a1e16}',
    '.dls-tools{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}',
    '.dls-btn{background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:9px 12px;font-size:14px;font-weight:600}',
    '.dls-btn.on{border-color:var(--acc);color:var(--acc)}',
    '.dls-btn.pr{background:var(--acc);border-color:var(--acc);color:#1a0f08}',
    '.dls-btn.rec.on{background:#3a1311;border-color:#ff3b30;color:#ff6b62}',
    '.dls-checks{list-style:none;margin:0;padding:0}',
    '.dls-checks li{display:grid;grid-template-columns:22px minmax(0,1fr);gap:8px;padding:8px 0;border-top:1px solid var(--line);font-size:14px}',
    '.dls-checks li:first-child{border-top:0;padding-top:0}',
    '.dls-checks .ic{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#111;margin-top:1px}',
    '.dls-checks .ok .ic{background:var(--ok)}.dls-checks .warn .ic{background:var(--warn)}.dls-checks .bad .ic{background:var(--bad)}.dls-checks .info .ic{background:#6b7280;color:#fff}',
    '.dls-checks b{font-weight:700}',
    '.dls-checks small{display:block;color:var(--mut);font-size:12.5px;margin-top:2px}',
    '.dls-sum{margin-top:10px;padding:10px 12px;border-radius:10px;font-size:14px;font-weight:700;background:var(--panel2)}',
    '.dls-sum.ok{background:#12301f;color:#7df0a9}',
    '.dls-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:10px}',
    '.dls-facts div{background:var(--panel2);border-radius:10px;padding:8px 10px;font-size:13px}',
    '.dls-facts span{display:block;color:var(--mut);font-size:11.5px;margin-bottom:2px}',
    '.dls-tips{margin:0;padding-left:18px;font-size:13.5px;color:#d9d6d0}',
    '.dls-tips li{margin:4px 0}',
    '.dls-task{margin-top:10px;font-size:13.5px;border-left:3px solid var(--acc);padding:4px 0 4px 10px}',
    '.dls-side{display:flex;flex-direction:column;gap:12px;min-width:0}',
    '.dls-note{font-size:12px;color:var(--mut);margin-top:10px}',
    '@container (max-width:520px){.dls-histo{display:none}.dls-hud .q{display:none}.dls-meter{width:34%}}',
    '@media (max-width:820px){.dls-view{position:sticky;top:6px;z-index:5;box-shadow:0 6px 18px rgba(0,0,0,.45)}}',
    '@media (max-width:520px){.dls{padding:10px;border-radius:14px}.dls-tab .nm{font-size:11.5px}.dls-tab .tm{font-size:10px}.dls-tab .sw{height:16px}.dls-tabs{gap:4px}.dls-card{padding:12px}.dls-meter{min-width:70px}.dls-set span{margin-right:.6em}}'
  ].join('\n');

  function injectCSS() {
    if (document.getElementById('dls-css')) return;
    var s = document.createElement('style'); s.id = 'dls-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  /* ---------- Виджет ---------- */
  function fmtSh(d) { return '1/' + d; }
  function fmtF(n) { return 'f/' + (n % 1 ? n.toFixed(1) : n); }
  function idxOf(arr, v) {
    var best = 0, bd = Infinity;
    for (var i = 0; i < arr.length; i++) { var d = Math.abs(Math.log(arr[i] / v)); if (d < bd) { bd = d; best = i; } }
    return best;
  }
  function fmtEV(v) { return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1).replace('.', ','); }

  function mount(root) {
    if (root.__dls) return; root.__dls = true;
    injectCSS();
    var start = parseInt(root.getAttribute('data-start') || '3', 10);
    if (!(start >= 0 && start < TIMES.length)) start = 3;

    var tabsHTML = TIMES.map(function (T, i) {
      return '<button type="button" class="dls-tab" data-i="' + i + '"><span class="sw" style="background:linear-gradient(180deg,' +
        T.sky[0] + ',' + T.sky[2] + ' 70%,' + T.sky[3] + ')"></span><span class="nm">' + T.name + '</span><span class="tm">≈ ' + T.clock + '</span></button>';
    }).join('');

    function slider(id, label, max) {
      return '<label class="dls-row"><span class="hd"><b>' + label + '</b><output data-o="' + id + '"></output></span>' +
        '<input type="range" min="0" max="' + max + '" step="1" data-r="' + id + '" aria-label="' + label + '"><span class="hint" data-h="' + id + '"></span></label>';
    }

    var el = document.createElement('div');
    el.className = 'dls';
    el.innerHTML =
      '<div class="dls-view">' +
        '<canvas width="' + W + '" height="' + H + '" class="dls-main-c" aria-label="Кадр с камеры"></canvas>' +
        '<canvas width="' + W + '" height="' + H + '" class="dls-fade"></canvas>' +
        '<div class="dls-grid"></div>' +
        '<div class="dls-hud">' +
          '<div class="dls-af" style="left:' + ((CX - 22) / W * 100) + '%;top:' + (143 / H * 100) + '%;width:' + (44 / W * 100) + '%;height:' + (48 / H * 100) + '%"></div>' +
          '<div class="t"><span class="dls-rec"><i></i><span class="st">STBY</span>&nbsp;<span class="tc">00:00:00:00</span></span>' +
          '<span><span class="fp">25p</span><span class="q"> · 4K</span> · <span class="ck"></span><span class="dls-bat"></span></span></div>' +
          '<div class="b"><div class="dls-set"></div>' +
            '<div class="dls-meter"><div class="mk"></div><div class="ln"></div><div class="sc"><b>−3</b><b>2</b><b>1</b><b>0</b><b>1</b><b>2</b><b>+3</b></div></div>' +
            '<canvas class="dls-histo" width="128" height="56"></canvas>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="dls-tabs" role="tablist" aria-label="Время суток">' + tabsHTML + '</div>' +
      '<div class="dls-main">' +
        '<div class="dls-card dls-ctrl"><h4>Настройки камеры</h4>' +
          '<div class="dls-row"><span class="hd"><b>Частота кадров</b><output data-o="fps"></output></span><div class="dls-seg" data-seg="fps">' +
            FPS.map(function (f) { return '<button type="button" data-v="' + f + '">' + f + ' к/с</button>'; }).join('') +
          '</div><span class="hint" data-h="fps"></span></div>' +
          slider('sh', 'Выдержка', SH.length - 1) +
          slider('f', 'Диафрагма', FN.length - 1) +
          slider('iso', 'ISO', ISO.length - 1) +
          slider('nd', 'ND-фильтр', ND.length - 1) +
          '<div class="dls-row"><span class="hd"><b>Баланс белого</b><output data-o="wb"></output></span>' +
            '<input type="range" min="2500" max="10000" step="100" data-r="wb" aria-label="Баланс белого">' +
            '<div class="dls-seg" data-seg="wb"><button type="button" data-v="auto">Авто</button><button type="button" data-v="3200">Лампа 3200K</button>' +
            '<button type="button" data-v="5600">Солнце 5600K</button><button type="button" data-v="6500">Облачно 6500K</button></div></div>' +
          '<div class="dls-tools">' +
            '<button type="button" class="dls-btn pr" data-act="rec">Подсказать настройки</button>' +
            '<button type="button" class="dls-btn" data-act="zebra">Зебра</button>' +
            '<button type="button" class="dls-btn" data-act="grid">Сетка</button>' +
            '<button type="button" class="dls-btn rec" data-act="record">● REC</button>' +
          '</div>' +
          '<div class="dls-note">Велосипедист проезжает каждые несколько секунд — следите, как выдержка меняет движение. 50 и 100 к/с показаны как замедление на монтаже 25p.</div>' +
        '</div>' +
        '<div class="dls-side">' +
          '<div class="dls-card"><h4>Оценка кадра</h4><ul class="dls-checks"></ul><div class="dls-sum"></div></div>' +
          '<div class="dls-card dls-info"></div>' +
        '</div>' +
      '</div>';
    root.innerHTML = '';
    root.appendChild(el);

    var $ = function (s) { return el.querySelector(s); };
    var cv = $('.dls-main-c'), ctx = cv.getContext('2d'), fade = $('.dls-fade'), fctx = fade.getContext('2d');
    var hc = $('.dls-histo'), hctx = hc.getContext('2d');
    var img = ctx.createImageData(W, H);

    var st = { t: start, fps: 25, sh: 3, f: 4, iso: 0, nd: 0, wb: 5600, awb: false, zebra: false, grid: false, rec: false };
    function applyRec() {
      var r = TIMES[st.t].rec;
      st.fps = r.fps; st.sh = SH.indexOf(r.sh); st.f = idxOf(FN, r.f); st.iso = idxOf(ISO, r.iso);
      st.nd = ND.findIndex(function (n) { return n.s === r.nd; }); st.wb = r.wb; st.awb = false;
    }
    applyRec();

    /* --- кэш сцены --- */
    var scene = null, cache = { key: '' }, F = new Float32Array(W * H * 3);
    var bgCache = new Float32Array(W * H * 3), fullCache = new Float32Array(W * H * 3);
    var spBlur = null, simT = 0, frameNo = 0, tcFrames = 0, ev = {};

    function buildScene() {
      var T = TIMES[st.t], p = paintScene(T), s = paintSubject(T);
      var levels = LEVELS.map(function (r) { return gaussBlur(p.bg, W, H, r * 0.55, 3); });
      scene = { T: T, levels: levels, lights: p.lights, subj: s, sprite: paintCyclist(T), flare: paintFlare(T) };
      cache.key = '';
    }

    /* фон с нужной глубиной резкости + боке фонарей + герой */
    function buildCache() {
      var N = FN[st.f], key = st.t + ':' + N;
      if (cache.key === key) return;
      cache.key = key;
      var rbg = 18 / N, L = scene.levels, maxL = LEVELS.length - 1;
      for (var y = 0; y < H; y++) {
        var rr = rbg * DEPTH[y], i = 0;
        while (i < maxL - 1 && LEVELS[i + 1] < rr) i++;
        var t = clamp((rr - LEVELS[i]) / (LEVELS[i + 1] - LEVELS[i]), 0, 1), A = L[i], Bv = L[i + 1];
        for (var j = y * W * 3, e = j + W * 3; j < e; j++) bgCache[j] = A[j] + (Bv[j] - A[j]) * t;
      }
      /* точечные источники рисуем дисками боке (энергия сохраняется) */
      scene.lights.forEach(function (lt) {
        var R = Math.max(0.7, rbg * lt.d), sum = 0, pts = [];
        for (var yy = Math.floor(lt.y - R - 1); yy <= Math.ceil(lt.y + R + 1); yy++)
          for (var xx = Math.floor(lt.x - R - 1); xx <= Math.ceil(lt.x + R + 1); xx++) {
            if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
            var d = Math.sqrt((xx - lt.x) * (xx - lt.x) + (yy - lt.y) * (yy - lt.y)), cov = clamp(R + 0.5 - d, 0, 1);
            if (R > 2.5) cov *= 0.8 + 0.2 * clamp((d - R + 2) / 2, 0, 1); /* светлый ободок, как у реального боке */
            if (cov > 0) { pts.push(yy * W + xx, cov); sum += cov; }
          }
        for (var k = 0; k < pts.length; k += 2) {
          var w = pts[k + 1] / sum, j3 = pts[k] * 3;
          bgCache[j3] += lt.I[0] * w; bgCache[j3 + 1] += lt.I[1] * w; bgCache[j3 + 2] += lt.I[2] * w;
        }
      });
      var sr = scene.subj.rgb, sa = scene.subj.a;
      for (var p = 0, q = 0; p < W * H; p++, q += 3) {
        var a = sa[p];
        if (a) {
          fullCache[q] = sr[q] + (1 - a) * bgCache[q]; fullCache[q + 1] = sr[q + 1] + (1 - a) * bgCache[q + 1]; fullCache[q + 2] = sr[q + 2] + (1 - a) * bgCache[q + 2];
        } else { fullCache[q] = bgCache[q]; fullCache[q + 1] = bgCache[q + 1]; fullCache[q + 2] = bgCache[q + 2]; }
      }
      spBlur = gaussBlur(scene.sprite, SPW, SPH, rbg * 0.5 * 0.55, 4);
    }

    /* --- экспозиция --- */
    function compute() {
      var T = TIMES[st.t], N = FN[st.f], den = SH[st.sh], iso = ISO[st.iso], nd = ND[st.nd].s;
      var evCam = Math.log2(N * N * den) - Math.log2(iso / 100) + nd;
      ev.delta = T.ev - evCam;
      ev.gain = Math.pow(2, ev.delta);
      ev.K = st.awb ? T.awb : st.wb;
      ev.wb = wbGains(ev.K);
      ev.vk = 0.08 + 0.3 * clamp((4 - N) / 2.2, 0, 1);
      /* экспонометр (центровзвешенный) и доля пересвета */
      var sum = 0, wsum = 0, clip = 0, cnt = 0;
      for (var y = 4; y < H; y += 6) for (var x = 3; x < W; x += 6) {
        var p = y * W + x, j = p * 3, v = (1 - ev.vk * RR[p]) * ev.gain;
        var r = fullCache[j] * v, g = fullCache[j + 1] * v, b = fullCache[j + 2] * v;
        var l = Math.min(0.2126 * r + 0.7152 * g + 0.0722 * b, 40), dx = x / W - 0.5, dy = y / H - 0.5, w = 1 + 2 * Math.exp(-(dx * dx + dy * dy) / 0.05);
        sum += l * w; wsum += w; cnt++;
        if (Math.max(r, g, b) >= CLIP) clip++;
      }
      ev.meter = Math.log2(Math.max(1e-5, sum / wsum) / 0.18) - 0.8; /* калибровка «матричного» замера */
      ev.clip = clip / cnt;
    }

    /* --- кадр --- */
    var hist = new Uint32Array(64);
    function render() {
      buildCache();
      F.set(fullCache);
      /* велосипедист со смазом движения */
      var speed = 330, period = (W + 300) / speed + 1.2, slow = st.fps / 25;
      var tt = (simT / slow) % period, px = -150 + speed * tt;
      if (px < W + 10) {
        var blur = speed * (1 / SH[st.sh]);
        var n = Math.max(1, Math.min(40, Math.ceil(blur / 1.1)));
        var x0 = Math.round(px - blur), bw = SPW + Math.ceil(blur) + 1, sy0 = ROAD - 91 - SPOY + 6;
        var acc = new Float32Array(bw * SPH * 4), sp = spBlur, inv = 1 / n;
        for (var s = 0; s < n; s++) {
          var off = Math.round(blur * (n === 1 ? 1 : s / (n - 1)));
          for (var yy = 0; yy < SPH; yy++) {
            var srow = yy * SPW * 4, drow = (yy * bw + off) * 4;
            for (var xx = 0; xx < SPW * 4; xx++) acc[drow + xx] += sp[srow + xx] * inv;
          }
        }
        var sr = scene.subj.rgb, sa = scene.subj.a;
        for (yy = 0; yy < SPH; yy++) {
          var Y = sy0 + yy; if (Y < 0 || Y >= H) continue;
          for (xx = 0; xx < bw; xx++) {
            var X = x0 + xx; if (X < 0 || X >= W) continue;
            var k = (yy * bw + xx) * 4, ca = acc[k + 3]; if (ca < 0.002) continue;
            var p = Y * W + X, j = p * 3, ia = 1 - ca;
            var r = acc[k] + ia * bgCache[j], g = acc[k + 1] + ia * bgCache[j + 1], b = acc[k + 2] + ia * bgCache[j + 2];
            var a = sa[p];
            if (a) { r = sr[j] + (1 - a) * r; g = sr[j + 1] + (1 - a) * g; b = sr[j + 2] + (1 - a) * b; }
            F[j] = r; F[j + 1] = g; F[j + 2] = b;
          }
        }
      }
      /* проявка: экспозиция → шум сенсора → клиппинг → баланс белого → кривая → sRGB */
      var gn = ev.gain, wr = ev.wb[0], wg = ev.wb[1], wbb = ev.wb[2], vk = ev.vk, FL = scene.flare;
      var ig = ISO[st.iso] / 100, na = NOISE_A * ig, nb2 = (NOISE_B * ig) * (NOISE_B * ig);
      var noff = (Math.random() * NZN) | 0, out = img.data, zeb = st.zebra, ph = (frameNo >> 1) & 7;
      hist.fill(0);
      for (var y = 0, i = 0; y < H; y++) {
        for (var x = 0; x < W; x++, i++) {
          var j3 = i * 3, v = (1 - vk * RR[i]) * gn;
          var R_ = (F[j3] + FL[j3]) * v, G_ = (F[j3 + 1] + FL[j3 + 1]) * v, B_ = (F[j3 + 2] + FL[j3 + 2]) * v;
          var lum = 0.2126 * R_ + 0.7152 * G_ + 0.0722 * B_; if (lum < 0) lum = 0;
          var sg = Math.sqrt(na * lum + nb2), kk = (i + noff) & NZM;
          var n0 = NZ[kk], n1 = NZ[(kk + 9973) & NZM], n2 = NZ[(kk + 31337) & NZM];
          R_ += sg * (n0 + 0.5 * n1); G_ += sg * (n0 - 0.2 * n1 - 0.2 * n2); B_ += sg * 1.25 * (n0 + 0.6 * n2);
          if (R_ > CLIP) R_ = CLIP; if (G_ > CLIP) G_ = CLIP; if (B_ > CLIP) B_ = CLIP;
          R_ *= wr; G_ *= wg; B_ *= wbb;
          if (R_ > 0.8) { var d = R_ - 0.8; R_ = d >= 0.4 ? 1 : 0.8 + d - d * d * 1.25; }
          if (G_ > 0.8) { d = G_ - 0.8; G_ = d >= 0.4 ? 1 : 0.8 + d - d * d * 1.25; }
          if (B_ > 0.8) { d = B_ - 0.8; B_ = d >= 0.4 ? 1 : 0.8 + d - d * d * 1.25; }
          var o = i * 4;
          var r8 = OETF[R_ <= 0 ? 0 : (R_ * 4095) | 0], g8 = OETF[G_ <= 0 ? 0 : (G_ * 4095) | 0], b8 = OETF[B_ <= 0 ? 0 : (B_ * 4095) | 0];
          var y8 = (54 * r8 + 183 * g8 + 19 * b8) >> 8;
          if (!(x & 1) && !(y & 1)) hist[y8 >> 2]++;
          if (zeb && y8 >= 242 && ((x + y + ph) & 7) < 3) { r8 = g8 = b8 = 20; }
          out[o] = r8; out[o + 1] = g8; out[o + 2] = b8; out[o + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      drawHisto();
    }

    function drawHisto() {
      var w = hc.width, h = hc.height, mx = 1;
      for (var i = 1; i < 63; i++) if (hist[i] > mx) mx = hist[i];
      hctx.clearRect(0, 0, w, h);
      hctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (i = 0; i < 64; i++) {
        var v = Math.min(1, hist[i] / mx), bh = Math.sqrt(v) * (h - 4);
        hctx.fillRect(i * w / 64, h - 2 - bh, w / 64 + 0.6, bh);
      }
      if (hist[63] > (W * H / 4) * 0.01) { hctx.fillStyle = '#ff5d52'; hctx.fillRect(w - 3, 0, 3, h); }
      if (hist[0] > (W * H / 4) * 0.03) { hctx.fillStyle = '#5da2ff'; hctx.fillRect(0, 0, 3, h); }
    }

    /* --- оценка --- */
    function check(cls, title, detail) { return { c: cls, t: title, d: detail || '' }; }
    function evaluate() {
      var T = TIMES[st.t], items = [], d = ev.delta, fps = st.fps, den = SH[st.sh], iso = ISO[st.iso], N = FN[st.f];
      /* экспозиция */
      if (d > T.expTol[1]) {
        items.push(check(d > 1.5 ? 'bad' : 'warn', 'Пересвет: ' + fmtEV(d) + ' EV',
          (T.id === 'noon' || T.id === 'morning' ? 'Света много — поставьте ND-фильтр или закройте диафрагму. ' : 'Закройте диафрагму, снизьте ISO или добавьте ND. ') +
          'Выдержку для этого лучше не укорачивать.'));
      } else if (d < T.expTol[0]) {
        items.push(check(d < -1.5 ? 'bad' : 'warn', 'Недосвет: ' + fmtEV(d) + ' EV',
          ND[st.nd].s ? 'Сначала уберите или ослабьте ND-фильтр.' : N > 2.8 ? 'Откройте диафрагму, затем при необходимости поднимите ISO.' : 'Диафрагма уже открыта — поднимите ISO.'));
      } else {
        items.push(check('ok', 'Экспозиция в норме', ev.clip > 0.16 ? 'Но ' + Math.round(ev.clip * 100) + '% кадра в пересвете — следите за небом.' :
          T.id === 'blue' ? 'Ночь и должна выглядеть тёмной — экспонометр может показывать «−».' :
          T.id === 'sunset' || T.id === 'sunrise' ? 'Небо сохранено, лицо в контровом свете чуть темнее — так и задумано.' : ''));
      }
      /* правило 180° */
      var ratio = 2 * fps / den;
      var norm = '1/' + (fps * 2);
      if (ratio > 1.3) items.push(check('warn', 'Выдержка длиннее нормы', 'Движение сильно смазано. Для ' + fps + ' к/с ставьте ' + norm + '.'));
      else if (ratio >= 0.74) items.push(check('ok', 'Правило 180° соблюдено', fmtSh(den) + ' при ' + fps + ' к/с — движение плавное и естественное.'));
      else if (ratio >= 0.4) items.push(check('warn', 'Выдержка короче нормы', 'Движение становится чуть «дёрганым». Для ' + fps + ' к/с — ' + norm + ', а лишний свет гасите ND.'));
      else items.push(check('bad', 'Эффект стробоскопа', 'Велосипедист движется рывками, без естественного смаза. Верните ' + norm + ' и поставьте ND-фильтр.'));
      /* шум */
      if (iso <= 800) items.push(check('ok', 'Шум незаметен', 'ISO ' + iso + (iso <= 200 ? ' — максимальное качество.' : '.')));
      else if (iso <= 3200) items.push(check('warn', 'Заметный шум в тенях', 'ISO ' + iso + '. ' + (N > 2.8 ? 'Сначала откройте диафрагму, потом поднимайте ISO.' : 'Для синего часа это допустимо, но выше лучше не поднимать.')));
      else items.push(check('bad', 'Сильный цифровой шум', 'ISO ' + iso + ' — картинка «зернит» и теряет детали.' + (d > 0.5 ? ' К тому же кадр пересвечен — ISO можно смело снижать.' : '')));
      /* баланс белого */
      var K = ev.K;
      if (st.awb && (T.id === 'sunset' || T.id === 'sunrise' || T.id === 'blue')) {
        items.push(check('warn', 'Автобаланс «съел» атмосферу', T.id === 'blue' ? 'Автоматика сделала синий час серым. Поставьте 4000–5000K вручную.' : 'Тёплый свет стал серым. Поставьте 5600K вручную.'));
      } else if (K < T.wbOK[0]) items.push(check(K < T.wbOK[0] - 1200 ? 'bad' : 'warn', 'Слишком холодно', K + 'K — кадр синеет. ' + (T.id === 'blue' ? 'Немного синевы — это красиво, но лицо стало мертвенным.' : 'Для этого света — ' + T.wbOK[0] + '–' + T.wbOK[1] + 'K.')));
      else if (K > T.wbOK[1]) items.push(check(K > T.wbOK[1] + 1200 ? 'bad' : 'warn', 'Слишком тепло', K + 'K — кадр желтит. Для этого света — ' + T.wbOK[0] + '–' + T.wbOK[1] + 'K.'));
      else items.push(check('ok', 'Цвет передан верно', (st.awb ? 'Авто: ' : '') + K + 'K' + (T.id === 'sunset' ? ' — тёплый закат сохранён.' : T.id === 'blue' ? ' — синее небо и тёплые фонари.' : '.')));
      /* глубина резкости (справочно) */
      items.push(check('info', N <= 2.8 ? 'Фон сильно размыт' : N <= 5.6 ? 'Фон слегка размыт' : 'Фон почти резкий',
        fmtF(N) + (N <= 2.8 ? ' — герой отделён от фона, фонари превращаются в «боке».' : N <= 5.6 ? ' — фон читается, но не спорит с героем.' : ' — всё в резкости, фон может отвлекать от героя.')));

      var bad = items.filter(function (x) { return x.c === 'bad' || x.c === 'warn'; }).length;
      $('.dls-checks').innerHTML = items.map(function (it) {
        var ic = it.c === 'ok' ? '✓' : it.c === 'info' ? 'i' : '!';
        return '<li class="' + it.c + '"><span class="ic">' + ic + '</span><span><b>' + it.t + '</b><small>' + it.d + '</small></span></li>';
      }).join('');
      var sum = $('.dls-sum');
      sum.className = 'dls-sum' + (bad ? '' : ' ok');
      sum.textContent = bad ? 'Исправьте: ' + bad + ' ' + (bad === 1 ? 'пункт' : bad < 5 ? 'пункта' : 'пунктов') + '. Подсказка — кнопка «Подсказать настройки».' : '✓ Кадр готов — так снимают профессионалы.';
    }

    function renderInfo() {
      var T = TIMES[st.t], I = T.info;
      $('.dls-info').innerHTML = '<h4>Свет: ' + T.name.toLowerCase() + '</h4><div class="dls-facts">' +
        '<div><span>Характер света</span>' + I.light + '</div><div><span>Цветовая температура</span>' + I.temp + '</div>' +
        '<div><span>Яркость сцены</span>' + I.ev + '</div><div><span>Тени</span>' + I.shadow + '</div></div>' +
        '<ul class="dls-tips">' + I.tips.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>' +
        '<div class="dls-task"><b>Задание:</b> ' + I.task + '</div>';
    }

    /* --- синхронизация интерфейса --- */
    var inputs = {};
    ['sh', 'f', 'iso', 'nd', 'wb'].forEach(function (k) { inputs[k] = el.querySelector('[data-r="' + k + '"]'); });
    function minSh() { for (var i = 0; i < SH.length; i++) if (SH[i] >= st.fps) return i; return 0; }
    function sync() {
      var T = TIMES[st.t], ms = minSh();
      if (st.sh < ms) st.sh = ms;
      inputs.sh.min = ms;
      inputs.sh.value = st.sh; inputs.f.value = st.f; inputs.iso.value = st.iso; inputs.nd.value = st.nd; inputs.wb.value = st.awb ? T.awb : st.wb;
      var o = function (k, v) { el.querySelector('[data-o="' + k + '"]').textContent = v; };
      var h = function (k, v) { el.querySelector('[data-h="' + k + '"]').textContent = v; };
      o('fps', st.fps + ' к/с'); o('sh', fmtSh(SH[st.sh])); o('f', fmtF(FN[st.f])); o('iso', ISO[st.iso]);
      o('nd', ND[st.nd].s ? ND[st.nd].n + ' (−' + ND[st.nd].s + ' EV)' : 'нет'); o('wb', st.awb ? 'Авто (' + T.awb + 'K)' : st.wb + 'K');
      h('fps', st.fps === 25 ? 'Стандарт для кино и YouTube.' : 'Замедление ×' + (st.fps / 25) + ' на монтаже 25p. Нужно больше света.');
      h('sh', 'Норма по правилу 180° для ' + st.fps + ' к/с — 1/' + (st.fps * 2) + '. Короче — движение «дёргается», длиннее нельзя.');
      h('f', 'Меньше число — больше света и сильнее размыт фон.');
      h('iso', 'Усиление сигнала: светлее, но больше шума.');
      h('nd', 'Тёмное «стекло» на объектив: убирает свет, не меняя выдержку и диафрагму.');
      el.querySelectorAll('[data-seg="fps"] button').forEach(function (b) { b.classList.toggle('on', +b.getAttribute('data-v') === st.fps); });
      el.querySelectorAll('[data-seg="wb"] button').forEach(function (b) {
        var v = b.getAttribute('data-v'); b.classList.toggle('on', v === 'auto' ? st.awb : (!st.awb && +v === st.wb));
      });
      el.querySelectorAll('.dls-tab').forEach(function (b, i) { b.classList.toggle('on', i === st.t); b.setAttribute('aria-selected', i === st.t); });
      $('[data-act="zebra"]').classList.toggle('on', st.zebra);
      $('[data-act="grid"]').classList.toggle('on', st.grid);
      $('[data-act="record"]').classList.toggle('on', st.rec);
      $('.dls-grid').classList.toggle('on', st.grid);
      /* HUD */
      compute();
      var ratio = 2 * st.fps / SH[st.sh];
      $('.dls-set').innerHTML = '<span' + (ratio < 0.74 || ratio > 1.3 ? ' class="warn"' : '') + '>' + fmtSh(SH[st.sh]) + '</span><span>' + fmtF(FN[st.f]).replace('f/', 'F') +
        '</span><span' + (ISO[st.iso] > 3200 ? ' class="warn"' : '') + '>ISO ' + ISO[st.iso] + '</span>' + (ND[st.nd].s ? '<span>' + ND[st.nd].n + '</span>' : '') +
        '<span>' + (st.awb ? 'AWB' : st.wb + 'K') + '</span>';
      var m = clamp(ev.meter, -3.2, 3.2);
      $('.dls-meter .mk').style.left = (50 + m / 3 * 50) + '%';
      $('.fp').textContent = st.fps + 'p';
      $('.ck').textContent = T.clock;
      var rc = $('.dls-rec'); rc.classList.toggle('on', st.rec); rc.querySelector('.st').textContent = st.rec ? 'REC' : 'STBY';
      evaluate();
    }

    function setTime(i) {
      if (i === st.t) return;
      fctx.drawImage(cv, 0, 0);
      fade.style.transition = 'none'; fade.style.opacity = '1';
      st.t = i; sync0();
      setTimeout(function () {
        buildScene(); sync(); renderInfo(); render();
        void fade.offsetWidth;
        fade.style.transition = 'opacity .6s ease'; fade.style.opacity = '0';
      }, 30);
    }
    function sync0() { el.querySelectorAll('.dls-tab').forEach(function (b, k) { b.classList.toggle('on', k === st.t); }); }

    el.querySelector('.dls-tabs').addEventListener('click', function (e) {
      var b = e.target.closest('.dls-tab'); if (b) setTime(+b.getAttribute('data-i'));
    });
    ['sh', 'f', 'iso', 'nd'].forEach(function (k) {
      inputs[k].addEventListener('input', function () { st[k] = +inputs[k].value; sync(); dirty = true; });
    });
    inputs.wb.addEventListener('input', function () { st.wb = +inputs.wb.value; st.awb = false; sync(); dirty = true; });
    el.querySelector('[data-seg="fps"]').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      st.fps = +b.getAttribute('data-v'); sync(); dirty = true;
    });
    el.querySelector('[data-seg="wb"]').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var v = b.getAttribute('data-v');
      if (v === 'auto') st.awb = true; else { st.awb = false; st.wb = +v; }
      sync(); dirty = true;
    });
    el.querySelector('.dls-tools').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var a = b.getAttribute('data-act');
      if (a === 'rec') applyRec();
      else if (a === 'zebra') st.zebra = !st.zebra;
      else if (a === 'grid') st.grid = !st.grid;
      else if (a === 'record') { st.rec = !st.rec; if (st.rec) tcFrames = 0; }
      sync(); dirty = true;
    });

    /* --- цикл: 25 кадров/с на «таймлайне», пауза вне экрана --- */
    var visible = true, dirty = true, last = 0, accT = 0;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(el);
    }
    function tick(now) {
      requestAnimationFrame(tick);
      if (!last) last = now;
      var dt = Math.min(0.2, (now - last) / 1000); last = now;
      if (!visible || document.hidden) return;
      accT += dt;
      if (accT >= 0.04 || dirty) {
        var steps = Math.floor(accT / 0.04);
        if (steps > 0) { simT += steps * 0.04; accT -= steps * 0.04; frameNo += steps; if (st.rec) tcFrames += steps; }
        dirty = false;
        render();
        if (st.rec) {
          var f = tcFrames, ss = Math.floor(f / 25), pad = function (n) { return (n < 10 ? '0' : '') + n; };
          $('.tc').textContent = pad(Math.floor(ss / 3600)) + ':' + pad(Math.floor(ss / 60) % 60) + ':' + pad(ss % 60) + ':' + pad(f % 25);
        }
      }
    }

    buildScene(); sync(); renderInfo(); render();
    requestAnimationFrame(tick);

    root.__dlsApi = { st: st, ev: ev, sync: sync, render: render, setTime: setTime, applyRec: applyRec, TIMES: TIMES };
  }

  function init() {
    var nodes = document.querySelectorAll('[data-ml-widget="daylight"], .ml-daylight-sim');
    for (var i = 0; i < nodes.length; i++) mount(nodes[i]);
  }
  window.MLDaylightSim = { mount: mount, init: init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
