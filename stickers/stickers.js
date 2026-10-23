/* Анимированные стикеры Пикселя. Каждый: {id, emoji, dur(с), draw(t) -> внутренность SVG 512×512}. t ∈ [0,1) — цикл. */
(function (G) {
  var PX = G.PX, f = PX.f, C = PX.C, TAU = Math.PI * 2;
  var S = 4.6, X = 256 - 59 * S, Y = 474 - 90 * S;
  function sin(t, n, ph) { return Math.sin(TAU * (t * (n || 1) + (ph || 0))); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ease(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function place(inner, dx, dy, sc) { // inner в единицах сайта
    sc = sc || 1;
    return '<g transform="translate(' + f(X + (dx || 0)) + ' ' + f(Y + (dy || 0)) + ') translate(' + f(59 * S) + ' ' + f(90 * S) + ') scale(' + f(S * sc) + ') translate(-59 -90)">' + inner + '</g>';
  }
  function bubble(x, y, text, size, o) { // пиксели; x,y — центр
    o = o || {};
    size = size || 40;
    var w = text.length * size * (o.font === 'russo' ? .66 : .62) + size * 1.1, h = size * 1.75, sc = o.scale == null ? 1 : o.scale;
    if (sc <= 0) return '';
    var tail = o.tail === false ? '' : '<path d="M' + f(-w * .18) + ' ' + f(h / 2 - 2) + ' l' + f(-size * .25) + ' ' + f(size * .55) + ' l' + f(size * .7) + ' ' + f(-size * .55) + ' Z" fill="#2b1c13"/>';
    return '<g transform="translate(' + f(x) + ' ' + f(y) + ') scale(' + f(sc) + ') rotate(' + f(o.rot || 0) + ')">' + tail +
      '<rect x="' + f(-w / 2) + '" y="' + f(-h / 2) + '" width="' + f(w) + '" height="' + f(h) + '" rx="' + f(h / 2) + '" fill="#2b1c13"/>' +
      '<text x="0" y="' + f(size * .36) + '" text-anchor="middle" font-family="' + (o.font === 'russo' ? 'Russo One' : 'Montserrat') + '" font-weight="600" font-size="' + size + '" fill="' + (o.col || '#f2efe8') + '">' + text + '</text></g>';
  }
  function pop(t, a, b) { // 0→1 с отскоком в [a, a+.08], держится до b, исчезает за .06
    if (t < a || t > b + .06) return 0;
    if (t < a + .08) { var k = (t - a) / .08; return Math.sin(k * Math.PI * .75) / Math.sin(Math.PI * .75) * (k < 1 ? 1 : 1); }
    if (t > b) return 1 - (t - b) / .06;
    return 1;
  }
  function blinkAt(t, c, w) { w = w || .05; var d = Math.abs(t - c); return d < w ? 1 - d / w : 0; }
  function sparkle(x, y, s, col) { return '<path transform="translate(' + f(x) + ' ' + f(y) + ') scale(' + f(s) + ')" d="M0 -10 Q1.4 -1.4 10 0 Q1.4 1.4 0 10 Q-1.4 1.4 -10 0 Q-1.4 -1.4 0 -10 Z" fill="' + (col || '#ffd76a') + '"/>'; }

  var L = [];
  // 1. Привет
  L.push({ id: 'privet', emoji: '👋', dur: 2, draw: function (t) {
    var o = { eyes: 'open', mouth: 'open', mouthOpen: .55, hrot: 5 * sin(t, 1), armR: 216 + 16 * sin(t, 3), armRlen: 26, armRy: -6, earR: 6 * Math.max(0, sin(t, 2)), tail: 6 * sin(t, 1), blink: blinkAt(t, .62) };
    return place(PX.cat(o)) + bubble(150, 92, 'Привет!', 44, { scale: ease((t - .05) / .12) * (t < .9 ? 1 : 1) });
  } });
  // 2. Мур
  L.push({ id: 'mur', emoji: '🥰', dur: 2.4, draw: function (t) {
    var o = { eyes: 'happy', mouth: 'w', blush: .75, hrot: 9 * sin(t, 1), hdx: 1.2 * sin(t, 1), tail: 8 * sin(t, 1, .25) };
    var hs = '';
    for (var i = 0; i < 4; i++) {
      var p = (t + i / 4) % 1, y = 26 - p * 26, x = 55 + [-20, 18, -8, 26][i] + 3 * Math.sin(TAU * (p * 1.5 + i * .3));
      var op = p < .15 ? p / .15 : p > .7 ? (1 - p) / .3 : 1;
      hs += '<g opacity="' + f(op) + '">' + PX.heart(x, y, 1.6 + .5 * Math.sin(i), i % 2 ? '#f0a0ac' : '#e8697e') + '</g>';
    }
    return place(PX.cat(o) + hs) + bubble(380, 120, 'мррр', 40, { scale: .95 + .05 * sin(t, 2), tail: false });
  } });
  // 3. Ура
  L.push({ id: 'ura', emoji: '🎉', dur: 2, draw: function (t) {
    var j = Math.abs(sin(t, 2)), lift = -j * 9, sq = 1 - .06 * (1 - j) * (1 - j);
    var o = { eyes: 'happy', mouth: 'open', mouthOpen: 1, armL: 146 - 12 * sin(t, 4), armR: 214 + 12 * sin(t, 4), armRlen: 26, armLlen: 26, armLy: -6, armRy: -6, breath: sq, earL: -6 * j, earR: 6 * j, tail: 12 * sin(t, 2) };
    var cf = '', cols = ['#fd7e2f', '#a8d86a', '#f0a0ac', '#ffd76a', '#f7f5f0', '#7fc8f8'];
    for (var i = 0; i < 26; i++) {
      var p = (t + i * .137) % 1, x = (i * 97) % 512, y = -20 + p * 560, r = (p * 720 + i * 40) % 360;
      cf += '<rect x="-7" y="-4" width="14" height="8" rx="2" fill="' + cols[i % 6] + '" transform="translate(' + f(x + 18 * Math.sin(TAU * p * 2 + i)) + ' ' + f(y) + ') rotate(' + f(r) + ') scale(' + f(Math.abs(Math.cos(TAU * p * 3 + i))) + ' 1)"/>';
    }
    return cf + place(PX.cat(o), 0, lift * S) + bubble(256, 70, 'УРА!', 46, { font: 'russo', tail: false, col: '#fd7e2f', scale: 1 + .08 * j });
  } });
  // 4. Ха-ха
  L.push({ id: 'haha', emoji: '😂', dur: 2, draw: function (t) {
    var k = .55 + .45 * Math.abs(sin(t, 4));
    var o = { eyes: 'squeeze', mouth: 'open', mouthOpen: k, hdx: 1.4 * sin(t, 8), hdy: -1.2 * Math.abs(sin(t, 4)), hrot: -6 + 4 * sin(t, 4), armL: -30, armR: 30, armLlen: 12, armRlen: 12, tail: 10 * sin(t, 4), blush: .7, breath: 1 + .03 * sin(t, 8) };
    var tears = '';
    for (var i = 0; i < 2; i++) {
      var p = (t * 2 + i * .5) % 1, side = i ? 1 : -1;
      tears += '<path transform="translate(' + f(55 + side * (13 + p * 16)) + ' ' + f(36 - 10 * p + 22 * p * p) + ') rotate(' + f(side * 40) + ')" d="M0 -2.6 Q2 .4 0 1.6 Q-2 .4 0 -2.6 Z" fill="#9fd3f5" opacity="' + f(1 - p) + '"/>';
    }
    return place(PX.cat(o) + tears) + bubble(400, 96, 'ха-ха', 38, { rot: 6 * sin(t, 4), tail: false }) + bubble(110, 150, 'ха', 34, { rot: -8, tail: false, scale: ease(Math.abs(sin(t, 2))) * .9 + .1 });
  } });
  // 5. Шок
  L.push({ id: 'shok', emoji: '😱', dur: 2, draw: function (t) {
    var tr = sin(t, 14) * .9;
    var o = { eyes: 'wide', mouth: 'o', oSize: 2.6 + .4 * sin(t, 4), earL: -10, earR: 10, hdx: tr * .6, bodySx: .96, puff: true, tail: -10, armL: 120, armR: 240, armLlen: 13, armRlen: 13, sweat: true };
    var s = 1 + .12 * Math.abs(sin(t, 2));
    var ex = '<g transform="translate(' + f(55) + ' ' + f(6) + ') scale(' + f(s) + ')"><rect x="-2.2" y="-12" width="4.4" height="11" rx="2.2" fill="#fd7e2f"/><circle cy="3" r="2.4" fill="#fd7e2f"/></g>';
    return place(PX.cat(o) + ex, tr * 3);
  } });
  // 6. Думает
  L.push({ id: 'dumaet', emoji: '🤔', dur: 2.6, draw: function (t) {
    var o = { eyes: 'look', pdx: 1.3, pdy: -2.2, mouth: 'flat', hrot: 8 + 3 * sin(t, 1), armR: 162 + 4 * Math.max(0, sin(t, 3)), armRlen: 13, tail: 14 * sin(t, 1), blink: blinkAt(t, .8), earL: -3 * sin(t, 1) };
    var q = '<g transform="translate(' + f(80) + ' ' + f(12 - 2.5 * sin(t, 1)) + ') rotate(' + f(10 * sin(t, 1, .2)) + ')"><text x="0" y="0" text-anchor="middle" font-family="Russo One" font-size="22" fill="#fd7e2f">?</text></g>' +
      '<g opacity="' + f(.6 + .4 * sin(t, 1, .5)) + '"><text x="94" y="20" text-anchor="middle" font-family="Russo One" font-size="13" fill="#894a1f">?</text></g>';
    return place(PX.cat(o) + q);
  } });
  // 7. Грустит
  L.push({ id: 'grust', emoji: '😢', dur: 2.6, draw: function (t) {
    var o = { eyes: 'sad', pdy: 1.2, mouth: 'frown', earL: -48, earR: 48, hdy: 2.5, hrot: 3 * sin(t, 1), breath: 1 + .02 * sin(t, 1), tear: (t * 1) % 1, tail: -14 };
    var cloud = '<g transform="translate(' + f(58 + 2 * sin(t, 1)) + ' 4)"><ellipse cx="0" cy="0" rx="16" ry="7" fill="#b9bcc6"/><ellipse cx="-8" cy="-3" rx="8" ry="6" fill="#b9bcc6"/><ellipse cx="6" cy="-5" rx="9" ry="7" fill="#b9bcc6"/>';
    for (var i = 0; i < 4; i++) { var p = (t * 2 + i / 4) % 1; cloud += '<rect x="' + f(-10 + i * 7) + '" y="' + f(7 + p * 12) + '" width="1.6" height="4" rx=".8" fill="#9fd3f5" opacity="' + f(1 - p) + '"/>'; }
    cloud += '</g>';
    return place(PX.cat(o) + cloud);
  } });
  // 8. Спит
  L.push({ id: 'spit', emoji: '😴', dur: 3, draw: function (t) {
    var o = { pose: 'lie', breath: 1 + .05 * sin(t, 1), tail: 4 * sin(t, 1) };
    var z = '';
    for (var i = 0; i < 3; i++) {
      var p = (t + i / 3) % 1, op = p < .2 ? p / .2 : 1 - (p - .2) / .8;
      z += '<text x="' + f(44 + p * 22 + i) + '' + '" y="' + f(54 - p * 34) + '" font-family="Russo One" font-size="' + f(14 + p * 14) + '" fill="#894a1f" opacity="' + f(op) + '">Z</text>';
    }
    return place(PX.cat(o) + z, 0, 0);
  } });
  // 9. Щёлк (фотографирует)
  L.push({ id: 'shchelk', emoji: '📸', dur: 2.4, draw: function (t) {
    var fl = blinkAt(t, .42, .06);
    var cam = '<g transform="translate(63 44) rotate(-4)"><rect x="-14" y="-9" width="28" height="18" rx="3.5" fill="#2e2e33"/><rect x="-11" y="-13" width="9" height="5" rx="1.5" fill="#2e2e33"/><rect x="6" y="-12" width="6" height="3.5" rx="1" fill="#c9c9cd"/>' +
      '<circle cx="2" cy="0" r="7.2" fill="#c9c9cd"/><circle cx="2" cy="0" r="5.4" fill="#0e0e10"/><circle cx="3.6" cy="-1.6" r="1.6" fill="#ffffff" opacity=".8"/>' +
      (fl > 0 ? '<g transform="translate(-6.5 -10.5)" opacity="' + f(fl) + '">' + sparkle(0, 0, 1.6, '#ffffff') + '</g>' : '') + '</g>';
    var o = { eyes: 'wink', mouth: 'w', hrot: -6, hdx: -2, armL: 205, armLlen: 13, armR: 196, armRlen: 12, front: cam, tail: 8 * sin(t, 1) };
    var flash = fl > 0 ? '<g opacity="' + f(fl) + '">' + sparkle(330, 175, 9, '#fffbe6') + sparkle(330, 175, 5, '#ffd76a') + '</g>' : '';
    return place(PX.cat(o)) + flash + bubble(372, 84, 'Щёлк!', 42, { scale: pop(t, .44, .9) });
  } });
  // 10. REC (снимает видео)
  L.push({ id: 'rec', emoji: '🎬', dur: 2.6, draw: function (t) {
    var on = (t * 4) % 1 < .55;
    var ph = '<g transform="translate(70 42) rotate(4)"><rect x="-8" y="-13" width="16" height="26" rx="3.4" fill="#2e2e33"/><rect x="-6.6" y="-11" width="13.2" height="22" rx="2" fill="#3c4a3a"/>' +
      '<path d="M-6.6 4 Q0 -2 6.6 3 V11 H-6.6 Z" fill="#56704f"/>' + (on ? '<circle cx="3.6" cy="-7.6" r="1.5" fill="#ff4b4b"/>' : '') + '</g>';
    var o = { eyes: 'look', pdx: 1.8, pdy: .4, mouth: 'w', hrot: -3, armR: 186, armRlen: 12, armL: 228, armLlen: 18, front: ph, tail: 9 * sin(t, 1), blink: blinkAt(t, .7) };
    var sec = Math.floor(t * 2.6);
    return place(PX.cat(o)) + bubble(360, 70, (on ? '●' : '○') + ' REC 00:0' + sec, 34, { tail: false, col: '#f2efe8' });
  } });
  // 11. ОК
  L.push({ id: 'ok', emoji: '🔥', dur: 2, draw: function (t) {
    var o = { eyes: 'wink', mouth: 'open', mouthOpen: .5, hrot: -6 + 2 * sin(t, 1), armR: 212 + 5 * sin(t, 2), armRlen: 26, armRy: -6, tail: 10 * sin(t, 1) };
    var sp = sparkle(96, 6, .7 + .3 * sin(t, 2)) + sparkle(84, -6, .45 + .25 * sin(t, 2, .5), '#f7f5f0') + sparkle(104, 18, .4 + .2 * sin(t, 2, .25), '#fd7e2f');
    return place(PX.cat(o) + sp) + bubble(150, 96, 'Огонь!', 42, { scale: ease((t - .04) / .12) });
  } });
  // 12. Фыр
  L.push({ id: 'fyr', emoji: '😾', dur: 2, draw: function (t) {
    var tr = sin(t, 12);
    var o = { eyes: 'angry', mouth: 'grr', earL: 26, earR: -26, puff: true, tail: -18 + 6 * sin(t, 4), hdx: tr * .7, bodySx: 1.06, blush: .55 };
    var st = '';
    for (var i = 0; i < 2; i++) { var p = (t * 2 + i * .5) % 1; st += '<g opacity="' + f(1 - p) + '"><circle cx="' + f(i ? 80 + p * 6 : 30 - p * 6) + '" cy="' + f(22 - p * 14) + '" r="' + f(2.4 + p * 3) + '" fill="#d7d7dc"/></g>'; }
    return place(PX.cat(o) + st, tr * 2) + bubble(390, 96, 'Фыр!', 42, { font: 'russo', tail: false, rot: 4 * tr });
  } });
  // 13. Спасибо
  L.push({ id: 'spasibo', emoji: '🙏', dur: 2.4, draw: function (t) {
    var b = ease(t < .5 ? t / .25 : (1 - t) / .25 * 1.0);
    b = t < .25 ? ease(t / .25) : t < .6 ? 1 : 1 - ease((t - .6) / .3);
    var o = { eyes: 'happy', mouth: 'w', blush: .7, hdy: 6 * b, hrot: 0, armL: -24, armR: 24, armLlen: 9, armRlen: 9, armLy: -6, armRy: -6, tail: 6 * sin(t, 1) };
    var h = '<g opacity="' + f(b) + '">' + PX.heart(92, 22 - 6 * b, 1.4) + PX.heart(22, 30 - 4 * b, 1.1, '#e8697e') + '</g>';
    return place(PX.cat(o) + h) + bubble(256, 70, 'Спасибо!', 44, { tail: false, scale: .92 + .08 * b });
  } });
  // 14. Рендер 99%
  L.push({ id: 'render', emoji: '⏳', dur: 3, draw: function (t) {
    var o = { eyes: 'open', pdy: 2.2, pdx: -.8, mouth: 'flat', blink: Math.max(blinkAt(t, .3, .07), blinkAt(t, .82, .07)) * .55 + .35, hrot: 4, armR: 160 + 6 * Math.max(0, sin(t, 6)), armRlen: 12, sweat: true, tail: 4 * sin(t, 1) };
    var ang = (t * 720) % 360;
    var panel = '<g transform="translate(256 82)"><rect x="-200" y="-56" width="400" height="112" rx="22" fill="#151311"/>' +
      '<text x="-176" y="-14" font-family="Montserrat" font-weight="600" font-size="30" fill="#f2efe8">Рендер…</text>' +
      '<text x="176" y="-14" text-anchor="end" font-family="Russo One" font-size="34" fill="#fd7e2f">99%</text>' +
      '<rect x="-176" y="12" width="352" height="18" rx="9" fill="#3a271b"/><rect x="-176" y="12" width="' + f(352 * .99) + '" height="18" rx="9" fill="#fd7e2f"/>' +
      '</g>';
    var spin = '<g transform="translate(304 68) rotate(' + f(ang) + ')"><circle r="11" fill="none" stroke="#fd7e2f" stroke-width="4.5" stroke-dasharray="40 30" stroke-linecap="round"/></g>';
    return place(PX.cat(o), 0, 34) + panel + spin;
  } });
  // 15. Фейспалм
  L.push({ id: 'facepalm', emoji: '🤦', dur: 2.2, draw: function (t) {
    var o = { eyes: 'closed', mouth: 'flat', hrot: 5 * sin(t, 2), earL: -14, earR: 14, armR: 163, armRlen: 25, armRy: -2, tail: -6 + 6 * sin(t, 1) };
    return place(PX.cat(o)) + bubble(390, 88, 'ну вот…', 36, { tail: false, scale: .95 + .05 * sin(t, 1) });
  } });
  // 16. Выглядывает
  L.push({ id: 'glyadit', emoji: '👀', dur: 2.6, draw: function (t) {
    var up = t < .22 ? ease(t / .22) : t < .78 ? 1 : 1 - ease((t - .78) / .22);
    var look = t < .4 ? 0 : t < .55 ? -2.4 : t < .7 ? 2.4 : 0;
    var o = { eyes: 'look', pdx: look, mouth: 'w', earL: -8 * up, earR: 8 * up, blink: blinkAt(t, .48, .03) };
    var dy = (1 - up) * 330 + 120;
    return '<defs><clipPath id="cb"><rect x="0" y="0" width="512" height="470"/></clipPath></defs><g clip-path="url(#cb)">' + place(PX.cat(o), 0, dy) + '</g>' +
      '<rect x="40" y="466" width="432" height="10" rx="5" fill="#2b1c13"/>';
  } });

  // 17. Табличка MATIS ACADEMY над головой (Claude, 23.10.2026)
  L.push({ id: 'tablichka', emoji: '🎓', dur: 2.4, draw: function (t) {
    var j = sin(t, 2), w = sin(t, 1);
    var lenL = 42 + 2.2 * j + 1.6 * w, lenR = 42 + 2.2 * j - 1.6 * w, aL = 151, aR = 209, yS = 60;
    function end(x, a, len) { var r = a * Math.PI / 180; return [x - len * Math.sin(r), yS + len * Math.cos(r)]; }
    var pL = end(46, aL, lenL), pR = end(64, aR, lenR);
    var cx = (pL[0] + pR[0]) / 2, cy = (pL[1] + pR[1]) / 2, rot = Math.atan2(pR[1] - pL[1], pR[0] - pL[0]) * 180 / Math.PI;
    var sign = '<g transform="translate(' + f(cx) + ' ' + f(cy - 1.5) + ') rotate(' + f(rot) + ')">' +
      '<rect x="-38" y="-35" width="76" height="35" rx="4.5" fill="#2b1c13" stroke="#f2efe8" stroke-width="1.6"/>' +
      '<text x="0" y="-20" text-anchor="middle" font-family="Russo One" font-size="14.5" letter-spacing=".6" fill="#fd7e2f">MATIS</text>' +
      '<text x="0" y="-6.2" text-anchor="middle" font-family="Russo One" font-size="11.2" letter-spacing=".5" fill="#f2efe8">ACADEMY</text></g>';
    var o = { eyes: 'happy', mouth: 'open', mouthOpen: .7 + .2 * Math.abs(j), hdy: 3, hrot: 3 * w, armL: aL, armR: aR, armLlen: lenL, armRlen: lenR, armLy: -6, armRy: -6,
      earL: -4 + 3 * j, earR: 4 - 3 * j, tail: 10 * sin(t, 2), behindHead: sign, breath: 1 + .015 * j };
    var sp = '<g opacity="' + f(.5 + .5 * Math.max(0, sin(t, 1))) + '">' + sparkle(8, -24, .55) + '</g><g opacity="' + f(.5 + .5 * Math.max(0, sin(t, 1, .5))) + '">' + sparkle(104, -20, .5, '#fd7e2f') + '</g>';
    return place(PX.cat(o) + sp, 0, 0, .84);
  } });

  G.PXS = { list: L, X: X, Y: Y, S: S };
})(typeof window !== 'undefined' ? window : globalThis);
