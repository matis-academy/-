/* ---------- Тренажёр «Двигай солнце вокруг модели» ---------- */
(function () {
  'use strict';
  var S = window.MLStudio, U = S.util;

  var SCHEMES = [
    { max: 25, id: 'front', name: 'Фронтальный свет', color: '#f3d36b',
      look: 'Лицо освещено ровно, теней почти нет. Картинка плоская, а герой щурится от солнца.',
      use: 'Когда нужно просто хорошо видеть лицо: документальная съёмка, быстрые интервью.',
      tips: ['Сместитесь или разверните героя так, чтобы солнце ушло на 30–45° в сторону — появится объём.', 'Если герой щурится, попросите закрыть глаза и открыть их по команде.'] },
    { max: 65, id: 'rembrandt', name: 'Рисующий свет 45°', color: '#fd9a3f',
      look: 'Одна сторона лица светлее, тень от носа ложится на щёку. Есть объём, лицо выглядит выразительно.',
      use: 'Классика портрета и интервью — самый надёжный вариант.',
      tips: ['Если тень слишком плотная, подсветите теневую сторону отражателем.', 'Следите, чтобы на теневой стороне оставался блик в глазу.'] },
    { max: 115, id: 'side', name: 'Боковой свет', color: '#e8663c',
      look: 'Половина лица в свету, половина в тени. Драматично, подчёркивает фактуру кожи и одежды.',
      use: 'Характерные портреты, напряжённые и драматичные сцены.',
      tips: ['Для рекламы и «мягких» историй смягчите тень отражателем.', 'Хорошо работает, когда фон тёмный.'] },
    { max: 155, id: 'kicker', name: 'Контровой-боковой', color: '#c94f8a',
      look: 'Светится контур волос и плеч, лицо в мягкой тени. Самый «киношный» свет.',
      use: 'Атмосферные сцены, золотой час, клипы и лайфстайл.',
      tips: ['Экспонируйте по лицу — небо может пересветиться, это нормально.', 'Отражатель спереди вернёт свет в глаза.'] },
    { max: 181, id: 'back', name: 'Контровой свет', color: '#8a5cf0',
      look: 'Солнце за спиной героя: сияющий ореол, лицо в тени. Можно снять силуэт или подсветить лицо.',
      use: 'Силуэты на закате, романтичные и загадочные кадры.',
      tips: ['Прикройте объектив ладонью или блендой — иначе блики и «молоко».', 'Хотите видеть лицо — нужен отражатель или вспышка спереди.'] }
  ];
  function scheme(az) { var a = Math.abs(az); for (var i = 0; i < SCHEMES.length; i++) if (a < SCHEMES[i].max) return SCHEMES[i]; return SCHEMES[4]; }
  function elevText(el) {
    return el < 12 ? { t: 'Низкое солнце', d: 'Утро или вечер: тёплый мягкий свет, длинные тени.' } :
      el < 45 ? { t: 'Солнце средней высоты', d: 'Чёткий рисунок света и тени, нейтральный цвет.' } :
      { t: 'Высокое солнце', d: 'Около полудня: тени в глазницах и под носом, тень на земле короткая.' };
  }

  function widget(root) {
    var u = U.el, T = S.three();
    var box = u('div', 'mls');
    box.innerHTML =
      '<div class="mls-sun-grid">' +
        '<div class="mls-view"><div class="ov">' +
          '<div class="mls-tag" style="left:2.5%;top:4%" data-v="name"></div>' +
          '<div class="mls-tag" style="right:2.5%;bottom:4%;top:auto" data-v="inset">Вид со стороны</div>' +
        '</div></div>' +
        '<div class="mls-card mls-map"><h4>Солнце — сверху <span style="font-weight:500;color:var(--mut)">тяните ☀</span></h4>' +
          '<svg viewBox="0 0 300 300" class="mls-svg" role="img" aria-label="Положение солнца вокруг модели"></svg>' +
          '<label class="mls-ctl"><span class="hd"><b>Высота солнца</b><output data-o="el"></output></span><input type="range" min="3" max="75" step="1" data-r="el" aria-label="Высота солнца"><span class="hint" data-h="el"></span></label>' +
          '<div class="mls-tools"><button type="button" class="mls-btn" data-act="refl">Отражатель</button><button type="button" class="mls-btn" data-act="spin">Обойти по кругу</button></div>' +
        '</div>' +
      '</div>' +
      '<div class="mls-chips" style="grid-template-columns:repeat(auto-fit,minmax(96px,1fr))"></div>' +
      '<div class="mls-row2">' +
        '<div class="mls-card" data-v="about"></div>' +
        '<div class="mls-card"><h4>Что видно в кадре</h4><div class="mls-facts" data-v="facts"></div><p class="mls-txt" data-v="elev"></p></div>' +
      '</div>';
    root.appendChild(box);
    S.injectCSS();
    if (!document.getElementById('mls-sun-css')) {
      var st0 = document.createElement('style'); st0.id = 'mls-sun-css';
      st0.textContent = '.mls-sun-grid{display:grid;grid-template-columns:minmax(0,1.9fr) minmax(0,1fr);gap:12px;align-items:start}' +
        '@media (max-width:820px){.mls-sun-grid{grid-template-columns:minmax(0,1fr)}}' +
        '.mls-svg{width:100%;max-width:300px;display:block;margin:0 auto 6px;touch-action:none;cursor:grab}' +
        '.mls-svg text{font:600 11px system-ui,sans-serif;fill:#c9c6c0}';
      document.head.appendChild(st0);
    }
    var $ = function (s) { return box.querySelector(s); };
    var view = $('.mls-view');
    var stage = new S.Stage(view);
    S.buildPiazza(stage);
    var sc = stage.sun.shadow.camera; sc.left = -3; sc.right = 3; sc.top = 3; sc.bottom = -3; sc.updateProjectionMatrix();
    var fig = new S.Figure(); stage.scene.add(fig.root);
    fig.setPose(S.POSES.contra, true); fig.extra.bodyYaw = 8; fig.apply(fig.current);
    fig.enableRim();

    /* основная камера — средний план, вставка — общий вид сверху-сбоку */
    stage.setFocal(50);
    stage.camera.position.set(0.3, 1.4, 3.4); stage.camera.lookAt(0, 1.13, 0); stage.camera.updateMatrixWorld();
    var cam2 = new T.PerspectiveCamera(40, 1.35, 0.1, 400);
    cam2.position.set(-6.5, 6.2, 7.5); cam2.lookAt(0, 0.7, 0);
    cam2.layers.enable(1);
    var gizmo = new T.Mesh(new T.SphereGeometry(0.16, 20, 14), new T.MeshBasicMaterial({ color: '#ffd34d', fog: false }));
    gizmo.layers.set(1); stage.scene.add(gizmo);
    var beamGeo = new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]);
    var beam = new T.Line(beamGeo, new T.LineBasicMaterial({ color: '#ffd34d', fog: false, transparent: true, opacity: 0.8 }));
    beam.layers.set(1); stage.scene.add(beam);
    var camMark = new T.Mesh(new T.BoxGeometry(0.18, 0.12, 0.22), new T.MeshBasicMaterial({ color: '#fd7e2f' }));
    camMark.position.copy(stage.camera.position); camMark.lookAt(0, 1.25, 0); camMark.layers.set(1); stage.scene.add(camMark);

    stage.afterRender = function () {
      var r = stage.renderer, size = r.getSize(new T.Vector2()), w = Math.round(size.x * 0.3), h = Math.round(w / 1.35), m = Math.round(size.x * 0.02);
      cam2.aspect = w / h; cam2.updateProjectionMatrix();
      r.setScissorTest(true);
      r.setViewport(size.x - w - m, m, w, h); r.setScissor(size.x - w - m, m, w, h);
      r.render(stage.scene, cam2);
      r.setScissorTest(false); r.setViewport(0, 0, size.x, size.y);
    };
    var insetTag = $('[data-v="inset"]');
    function placeInsetTag() { insetTag.style.right = '2.5%'; insetTag.style.bottom = 'calc(2% + ' + (view.clientWidth * 0.3 / 1.35) + 'px + 4px)'; }

    var st = { az: 50, el: 22, refl: false, spin: false };
    var target = new T.Vector3(0, 1.0, 0);
    function applySun() {
      stage.setSun(st.az, st.el, target);
      stage.setDaylight(st.el);
      var d = stage.sunDir;
      gizmo.position.copy(target).addScaledVector(d, 2.6);
      beamGeo.setFromPoints([gizmo.position.clone(), target.clone()]);
      /* контровая подсветка — сильнее, когда солнце за спиной и низко */
      var back = U.clamp((Math.abs(st.az) - 95) / 70, 0, 1);
      fig.rimU.rimK.value = back * U.lerp(1.6, 0.5, U.clamp((st.el - 10) / 50, 0, 1));
      fig.rimU.rimColor.value.copy(stage.sun.color);
      fig.rimU.rimDir.value.copy(d).transformDirection(stage.camera.matrixWorldInverse);
      /* отражатель: мягкий свет со стороны камеры */
      stage.fill.intensity = st.refl ? 0.5 : 0;
      stage.fill.position.copy(stage.camera.position).setY(1.3); stage.fill.target.position.set(0, 1.2, 0);
      stage.invalidate();
    }

    /* карта сверху */
    var svg = $('.mls-svg'), NS = 'http://www.w3.org/2000/svg', C = 150, RR = 112;
    function sv(tag, at, parent) { var e = document.createElementNS(NS, tag); for (var k in at) e.setAttribute(k, at[k]); (parent || svg).appendChild(e); return e; }
    function pt(az, r) { var a = az * U.D2R; return [C + r * Math.sin(a), C + r * Math.cos(a)]; }
    function arc(a0, a1, r0, r1) {
      var p0 = pt(a0, r1), p1 = pt(a1, r1), p2 = pt(a1, r0), p3 = pt(a0, r0), large = Math.abs(a1 - a0) > 180 ? 1 : 0;
      return 'M' + p0 + ' A' + r1 + ' ' + r1 + ' 0 ' + large + ' 0 ' + p1 + ' L' + p2 + ' A' + r0 + ' ' + r0 + ' 0 ' + large + ' 1 ' + p3 + 'Z';
    }
    sv('circle', { cx: C, cy: C, r: RR + 22, fill: '#15171a', stroke: '#2d3035' });
    var bands = [[-25, 25, 0], [25, 65, 1], [-65, -25, 1], [65, 115, 2], [-115, -65, 2], [115, 155, 3], [-155, -115, 3], [155, 205, 4]];
    var bandEls = bands.map(function (b) { return sv('path', { d: arc(b[0], b[1], RR - 14, RR + 14), fill: SCHEMES[b[2]].color, opacity: 0.22 }); });
    [[0, 'фронт'], [45, '45°'], [90, 'бок'], [135, '135°'], [180, 'контр']].forEach(function (l) {
      var p = pt(l[0], RR - 32);
      var t = sv('text', { x: p[0], y: p[1] + 4, 'text-anchor': 'middle' }); t.textContent = l[1];
    });
    var shadowLine = sv('line', { x1: C, y1: C, x2: C, y2: C, stroke: '#000', 'stroke-width': 9, 'stroke-linecap': 'round', opacity: 0.45 });
    /* модель: плечи и нос */
    var modelG = sv('g', {});
    sv('ellipse', { cx: 0, cy: 0, rx: 20, ry: 11, fill: '#c98a2e' }, modelG);
    sv('circle', { cx: 0, cy: 0, r: 8, fill: '#3b2a20' }, modelG);
    sv('path', { d: 'M-4 7 L0 15 L4 7Z', fill: '#d6a084' }, modelG);
    /* камера */
    var cp = pt(0, RR + 4);
    var camG = sv('g', { transform: 'translate(' + cp[0] + ',' + (cp[1] - 6) + ')' });
    sv('rect', { x: -14, y: -2, width: 28, height: 18, rx: 4, fill: '#fd7e2f' }, camG);
    sv('path', { d: 'M-7 -2 L-4 -10 L4 -10 L7 -2Z', fill: '#fd7e2f' }, camG);
    var ct = sv('text', { x: C, y: 296, 'text-anchor': 'middle' }); ct.textContent = 'камера';
    /* солнце */
    var sunG = sv('g', { style: 'cursor:grab' });
    sv('circle', { r: 20, fill: '#ffd34d', opacity: 0.25 }, sunG);
    sv('circle', { r: 12, fill: '#ffd34d', stroke: '#fff3c2', 'stroke-width': 2 }, sunG);
    function drawMap() {
      var p = pt(st.az, RR);
      sunG.setAttribute('transform', 'translate(' + p[0] + ',' + p[1] + ')');
      var yaw = fig.root.rotation.y / U.D2R;
      modelG.setAttribute('transform', 'translate(' + C + ',' + C + ') rotate(' + (-yaw) + ')');
      var len = U.clamp(1.6 / Math.tan(Math.max(4, st.el) * U.D2R), 0.2, 9) * 14;
      var q = pt(st.az + 180, Math.min(len, RR - 4));
      shadowLine.setAttribute('x2', q[0]); shadowLine.setAttribute('y2', q[1]);
      var cur = scheme(st.az);
      bands.forEach(function (b, i) { bandEls[i].setAttribute('opacity', SCHEMES[b[2]] === cur ? 0.75 : 0.18); });
    }
    function fromEvent(e) {
      var r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 300 - C, y = (e.clientY - r.top) / r.height * 300 - C;
      st.az = Math.round(Math.atan2(x, y) / U.D2R);
      st.spin = false; update();
    }
    var dragging = false;
    svg.addEventListener('pointerdown', function (e) { dragging = true; svg.setPointerCapture(e.pointerId); fromEvent(e); });
    svg.addEventListener('pointermove', function (e) { if (dragging) fromEvent(e); });
    ['pointerup', 'pointercancel'].forEach(function (n) { svg.addEventListener(n, function () { dragging = false; }); });

    /* быстрые схемы */
    var chips = $('.mls-chips'), PRE = [[0, 'Фронтальный', 'солнце сзади камеры'], [45, 'Рисующий', '45° сбоку'], [90, 'Боковой', '90°'], [135, 'Контровой-боковой', '135°'], [180, 'Контровой', 'солнце за героем']];
    chips.innerHTML = PRE.map(function (p, i) { return '<button type="button" class="mls-chip" data-i="' + i + '"><span class="nm">' + p[1] + '</span><span class="sb">' + p[2] + '</span></button>'; }).join('');
    chips.addEventListener('click', function (e) { var b = e.target.closest('.mls-chip'); if (!b) return; tween(PRE[+b.getAttribute('data-i')][0]); });
    var tw = null;
    function tween(to) {
      st.spin = false;
      var d = ((to - st.az) % 360 + 540) % 360 - 180;
      tw = { from: st.az, d: d, t: 0 };
      stage.animate(function (dt) {
        if (!tw) return false;
        tw.t = Math.min(1, tw.t + dt / 0.9);
        st.az = Math.round(tw.from + tw.d * U.ease(tw.t));
        st.az = ((st.az + 540) % 360) - 180;
        update(true);
        if (tw.t >= 1) { tw = null; update(); return false; }
        return true;
      });
    }
    var elR = $('[data-r="el"]');
    elR.addEventListener('input', function () { st.el = +elR.value; update(); });
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var a = b.getAttribute('data-act');
      if (a === 'refl') st.refl = !st.refl;
      if (a === 'spin') {
        st.spin = !st.spin;
        if (st.spin) stage.animate(function (dt) { if (!st.spin) return false; st.az += dt * 40; if (st.az > 180) st.az -= 360; update(true); return true; });
      }
      update();
    });

    function update(light) {
      applySun(); drawMap();
      var cur = scheme(st.az), E = elevText(st.el), a = Math.abs(st.az);
      $('[data-v="name"]').textContent = '☀ ' + cur.name + (st.el >= 50 ? ' · верхний' : '');
      $('[data-o="el"]').textContent = st.el + '°';
      $('[data-h="el"]').textContent = st.el < 12 ? 'Как на рассвете или на закате' : st.el < 45 ? 'Утро или вторая половина дня' : 'Около полудня';
      $('[data-act="refl"]').classList.toggle('on', st.refl);
      $('[data-act="spin"]').classList.toggle('on', st.spin);
      box.querySelectorAll('.mls-chip').forEach(function (b, i) { b.classList.toggle('on', scheme(PRE[i][0]) === cur); });
      if (light) return;
      elR.value = st.el;
      $('[data-v="about"]').innerHTML = '<h4>' + cur.name + '</h4><p class="mls-txt">' + cur.look + '</p><p class="mls-txt"><b>Когда использовать:</b> ' + cur.use + '</p>' +
        '<ul class="mls-tips" style="margin-top:8px">' + cur.tips.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>';
      var faceShadow = a < 25 ? 'почти нет' : a < 65 ? 'на дальней щеке' : a < 115 ? 'половина лица' : 'лицо в тени';
      var vol = a < 25 ? 'плоско' : a < 115 ? 'объёмно' : 'объём по контуру';
      var rim = a > 115 ? (st.el < 30 ? 'яркий ореол' : 'слабый ореол') : 'нет';
      var shadowLen = (1 / Math.tan(Math.max(3, st.el) * U.D2R)).toFixed(1).replace('.', ',');
      $('[data-v="facts"]').innerHTML = '<div><span>Тень на лице</span>' + faceShadow + (st.refl && a > 25 ? ', смягчена отражателем' : '') + '</div><div><span>Объём</span>' + vol + '</div>' +
        '<div><span>Контур (ореол)</span>' + rim + '</div><div><span>Тень на земле</span>в ' + shadowLen + ' раза длиннее роста</div>';
      $('[data-v="elev"]').innerHTML = '<b>' + E.t + '.</b> ' + E.d;
    }
    placeInsetTag();
    if ('ResizeObserver' in window) new ResizeObserver(placeInsetTag).observe(view);
    update();
    root.__mlsApi = { stage: stage, fig: fig, st: st, update: update, tween: tween };
  }
  S.widgets.sun = widget;
})();
