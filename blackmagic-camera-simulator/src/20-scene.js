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
