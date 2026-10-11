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
