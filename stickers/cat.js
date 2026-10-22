/* Pixel — параметрический рисунок кота (PX-14 «чёрный минимал»). Claude, 22.10.2026.
   Общий модуль для стикеров и Mini App. Координаты — «единицы сайта» (сидящий кот ~ x 26..94, y 12..92).
   PX.cat(o) -> строка SVG <g>. Все параметры необязательны. */
(function (G) {
  var C = { fur: '#1f1f23', furD: '#17171a', white: '#f7f5f0', whiteD: '#dedad2', eye: '#a8d86a', pupil: '#0b0b0d',
    nose: '#f0a0ac', ear: '#4a4a52', wh: '#8d8d95', line: '#c9c9cf', mouth: '#5a1f2a', tongue: '#f08a9a' };
  function f(n) { return (Math.round(n * 100) / 100).toString(); }
  function heart(x, y, s, col) {
    return '<path transform="translate(' + f(x) + ' ' + f(y) + ') scale(' + f(s) + ')" d="M0 3 C-6 -1 -4 -6 0 -3 C4 -6 6 -1 0 3 Z" fill="' + (col || C.nose) + '"/>';
  }
  function eyes(o) {
    var t = o.eyes || 'open', px = o.pdx || 0, py = o.pdy || 0, out = '';
    function openEye(cx, big) {
      var rx = big ? 5.7 : 4.9, ry = big ? 6.4 : 5.5;
      var s = '<ellipse cx="' + f(cx) + '" cy="-2" rx="' + rx + '" ry="' + ry + '" fill="' + C.eye + '"/>';
      if (big) s += '<circle cx="' + f(cx + px * .6) + '" cy="' + f(-1.6 + py * .6) + '" r="1.7" fill="' + C.pupil + '"/>';
      else s += '<ellipse cx="' + f(cx + .3 + px) + '" cy="' + f(-1.6 + py) + '" rx="' + (o.pupilW || 2) + '" ry="3.9" fill="' + C.pupil + '"/>';
      s += '<circle cx="' + f(cx + 1.7 + px * .5) + '" cy="' + f(-3.8 + py * .5) + '" r="' + (big ? 1.6 : 1.35) + '" fill="#fff"/>' +
        '<circle cx="' + f(cx - 1.3 + px * .5) + '" cy="' + f(.9 + py * .5) + '" r=".6" fill="#fff"/>';
      return s;
    }
    function arc(cx, up) { // up=true: ^ (радость); false: ‿ (закрыт спокойно)
      return '<path d="M' + f(cx - 3.8) + ' ' + (up ? '-.6' : '-1.6') + ' q3.8 ' + (up ? '-4.4' : '3.2') + ' 7.6 0" stroke="' + C.line + '" stroke-width="1.8" fill="none" stroke-linecap="round"/>';
    }
    if (t === 'open' || t === 'sad' || t === 'angry' || t === 'look') { out = openEye(-7.8) + openEye(7.8); }
    else if (t === 'wide') { out = openEye(-7.8, true) + openEye(7.8, true); }
    else if (t === 'happy') { out = arc(-7.8, true) + arc(7.8, true); }
    else if (t === 'closed') { out = arc(-7.8) + arc(7.8); }
    else if (t === 'wink') { out = arc(-7.8, true) + openEye(7.8); }
    else if (t === 'heart') { out = heart(-7.8, -1.6, 1.25) + heart(7.8, -1.6, 1.25); }
    else if (t === 'squeeze') { // >_<
      out = '<path d="M-11 -4.4 l5 2.6 l-5 2.6 M11 -4.4 l-5 2.6 l5 2.6" stroke="' + C.line + '" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>';
    }
    if (o.blink && (t === 'open' || t === 'look' || t === 'sad')) {
      var b = o.blink; // 0..1 доля закрытия
      out += '<rect x="-14" y="' + f(-8 - 1) + '" width="28" height="' + f(12 * b) + '" fill="' + C.fur + '"/>';
      if (b > .85) out += arc(-7.8) + arc(7.8);
    }
    if (t === 'sad') {
      out += '<path d="M-12 -9.6 L-4.6 -11.4 M12 -9.6 L4.6 -11.4" stroke="' + C.line + '" stroke-width="1.5" stroke-linecap="round"/>';
    }
    if (t === 'angry') {
      out += '<path d="M-14 -10 L-2.6 -5.2 L-2.6 -11 Z M14 -10 L2.6 -5.2 L2.6 -11 Z" fill="' + C.fur + '"/>' +
        '<path d="M-12.4 -9 L-3.6 -5.2 M12.4 -9 L3.6 -5.2" stroke="' + C.line + '" stroke-width="1.5" stroke-linecap="round"/>';
    }
    return out;
  }
  function mouth(o) {
    var m = o.mouth || 'w';
    var nose = '<path d="M-2 3.4 h4 l-2 2.2 z" fill="' + C.nose + '" stroke="' + C.nose + '" stroke-width=".8" stroke-linejoin="round"/>';
    var s = '';
    if (m === 'w') s = '<path d="M0 5.8 v.9 M-2.8 7 q1.4 1.6 2.8 0 q1.4 1.6 2.8 0" stroke="' + C.fur + '" stroke-width="1.1" fill="none" stroke-linecap="round"/>';
    else if (m === 'open') {
      var k = o.mouthOpen == null ? 1 : o.mouthOpen;
      s = '<path d="M-3.6 6.6 Q0 ' + f(6.8 + 6 * k) + ' 3.6 6.6 Z" fill="' + C.mouth + '"/>' +
        '<ellipse cx="0" cy="' + f(6.8 + 4.2 * k) + '" rx="' + f(1.8 * k + .4) + '" ry="' + f(1.2 * k + .2) + '" fill="' + C.tongue + '"/>';
    }
    else if (m === 'o') s = '<ellipse cx="0" cy="8.4" rx="1.7" ry="' + f(o.oSize || 2.3) + '" fill="' + C.mouth + '"/>';
    else if (m === 'flat') s = '<path d="M-2.2 7.6 h4.4" stroke="' + C.fur + '" stroke-width="1.1" stroke-linecap="round"/>';
    else if (m === 'frown') s = '<path d="M-2.8 8.8 q2.8 -2.4 5.6 0" stroke="' + C.fur + '" stroke-width="1.1" fill="none" stroke-linecap="round"/>';
    else if (m === 'grr') s = '<path d="M-3.2 7.2 h6.4 v2.2 h-6.4 z" fill="' + C.mouth + '"/><path d="M-2.4 7.2 l.8 1.4 l.8 -1.4 M.8 7.2 l.8 1.4 l.8 -1.4" fill="#fff"/>';
    return nose + s;
  }
  function head(o) {
    var eL = o.earL || 0, eR = o.earR || 0;
    var s = '<g transform="rotate(' + f(eL) + ' -9 -11)"><path d="M-16 -5 Q-18 -23 -13 -25 Q-6 -19 -3 -13 Z" fill="' + C.fur + '" stroke="' + C.fur + '" stroke-width="2.2" stroke-linejoin="round"/><path d="M-13.5 -9 Q-14.5 -19 -12 -20.5 Q-8 -17 -6.5 -13.5 Z" fill="' + C.ear + '"/></g>' +
      '<g transform="rotate(' + f(eR) + ' 9 -11)"><path d="M16 -5 Q18 -23 13 -25 Q6 -19 3 -13 Z" fill="' + C.fur + '" stroke="' + C.fur + '" stroke-width="2.2" stroke-linejoin="round"/><path d="M13.5 -9 Q14.5 -19 12 -20.5 Q8 -17 6.5 -13.5 Z" fill="' + C.ear + '"/></g>' +
      '<ellipse rx="19" ry="16" fill="' + C.fur + '" stroke="' + C.fur + '" stroke-width="2.2"/>' +
      '<ellipse cy="5.9" rx="5.4" ry="4" fill="' + C.white + '"/>' + eyes(o) +
      '<ellipse cx="-11" cy="5.2" rx="2.6" ry="1.6" fill="' + C.nose + '" opacity="' + (o.blush || .35) + '"/><ellipse cx="11" cy="5.2" rx="2.6" ry="1.6" fill="' + C.nose + '" opacity="' + (o.blush || .35) + '"/>' +
      mouth(o) +
      '<path d="M-6 5 l-15 -2 M-6 7.5 l-15 1.8 M6 5 l15 -2 M6 7.5 l15 1.8" stroke="' + C.wh + '" stroke-width=".8" stroke-linecap="round"/>';
    if (o.tear != null) { // слеза: 0..1 падение
      var ty = 2 + o.tear * 14, op = o.tear > .85 ? (1 - o.tear) / .15 : 1;
      s += '<path transform="translate(-9 ' + f(ty) + ')" d="M0 -2.6 Q2 .4 0 1.6 Q-2 .4 0 -2.6 Z" fill="#9fd3f5" opacity="' + f(op) + '"/>';
    }
    if (o.sweat) s += '<path transform="translate(17 -10)" d="M0 -3 Q2.4 .6 0 2 Q-2.4 .6 0 -3 Z" fill="#9fd3f5"/>';
    return s;
  }
  // лапка: из точки плеча, угол в градусах (0 — вниз, 90 — влево (к зрителю справа налево), -90 — вправо, 180 — вверх)
  function arm(x, y, ang, len, front) {
    len = len || 15;
    return '<g transform="translate(' + f(x) + ' ' + f(y) + ') rotate(' + f(ang) + ')"><rect x="-3.8" y="-2" width="7.6" height="' + f(len + 2) + '" rx="3.8" fill="' + C.fur + '"/>' +
      '<ellipse cy="' + f(len) + '" rx="4.6" ry="3.8" fill="' + C.white + '"/></g>';
  }
  function cat(o) {
    o = o || {};
    var hx = 55 + (o.hdx || 0), hy = 41 + (o.hdy || 0), hr = o.hrot || 0, sy = o.breath || 1, tail = o.tail || 0;
    var s = '<g class="px-cat">';
    if (o.pose === 'lie') return lie(o);
    // хвост
    s += '<g transform="rotate(' + f(tail) + ' 72 84)"><path d="M70 84 C88 84 90 66 80 60" stroke="' + C.fur + '" stroke-width="9" fill="none" stroke-linecap="round"/>' +
      (o.puff ? '<path d="M70 84 C88 84 90 66 80 60" stroke="' + C.fur + '" stroke-width="13" fill="none" stroke-linecap="round" stroke-dasharray="2 3"/>' : '') + '</g>';
    // тело
    s += '<g transform="translate(55 86) scale(' + f(o.bodySx || 1) + ' ' + f(sy) + ') translate(-55 -86)"><path d="M36 86 C32 70 39 56 55 56 C71 56 78 70 74 86 Z" fill="' + C.fur + '" stroke="' + C.fur + '" stroke-width="2.2" stroke-linejoin="round"/></g>';
    // нижние лапки
    if (!o.noPawL) s += '<ellipse cx="47" cy="85.5" rx="6.8" ry="4.2" fill="' + C.white + '"/>';
    if (!o.noPawR) s += '<ellipse cx="63" cy="85.5" rx="6.8" ry="4.2" fill="' + C.white + '"/>';
    if (o.behindHead) s += o.behindHead;
    // голова
    s += '<g transform="translate(' + f(hx) + ' ' + f(hy) + ') rotate(' + f(hr) + ')">' + head(o) + '</g>';
    // поднятые лапки поверх
    if (o.armL != null) s += arm(46, 66 + (o.armLy || 0), o.armL, o.armLlen);
    if (o.armR != null) s += arm(64, 66 + (o.armRy || 0), o.armR, o.armRlen);
    if (o.front) s += o.front;
    return s + '</g>';
  }
  function lie(o) {
    var b = o.breath || 1;
    var s = '<g class="px-cat">';
    s += '<path d="M84 84 C98 86 100 74 92 70" stroke="' + C.fur + '" stroke-width="8" fill="none" stroke-linecap="round" transform="rotate(' + f(o.tail || 0) + ' 84 84)"/>';
    s += '<g transform="translate(62 86) scale(1 ' + f(b) + ') translate(-62 -86)"><ellipse cx="62" cy="76" rx="27" ry="11.5" fill="' + C.fur + '"/></g>';
    s += '<ellipse cx="82" cy="86" rx="6" ry="3.4" fill="' + C.white + '"/>';
    s += '<g transform="translate(37 70) rotate(-8) scale(.98)">' + head({ eyes: 'closed', mouth: o.mouth || 'w', earL: -6, earR: 4 }) + '</g>';
    s += '<ellipse cx="40" cy="86.5" rx="7" ry="3.6" fill="' + C.white + '"/><ellipse cx="53" cy="86.8" rx="6.6" ry="3.4" fill="' + C.white + '"/>';
    return s + '</g>';
  }
  G.PX = { C: C, cat: cat, head: head, heart: heart, f: f };
})(typeof window !== 'undefined' ? window : globalThis);
