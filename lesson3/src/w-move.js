/* ---------- Тренажёр «Движение камеры» ---------- */
(function () {
  'use strict';
  var S = window.MLStudio, U = S.util;

  /* каждое движение: f(t) → { p: [x,y,z], l: [x,y,z] (куда смотрит), f: фокусное, walk: x героя | null } */
  var MOVES = [
    { id: 'pan', name: 'Панорама', sub: 'поворот по горизонтали', view: 'top',
      how: 'Камера стоит на месте и поворачивается влево или вправо, как голова человека.',
      feel: 'Открывает пространство или ведёт зрителя за героем. Медленная панорама — спокойствие, быстрая — тревога.',
      gear: 'Штатив с панорамной головой, гимбал или просто поворот корпусом с телефоном.',
      mistake: 'Слишком быстрая панорама «рвёт» картинку. Начинайте и заканчивайте движение плавно, на статичном кадре.',
      f: function (t) { var a = U.lerp(-55, 0, t) * U.D2R; return { p: [0.4, 1.5, 4.2], l: [0.4 + Math.sin(a) * 5, 1.4, 4.2 - Math.cos(a) * 5], f: 35 }; } },
    { id: 'tilt', name: 'Тилт', sub: 'наклон вверх-вниз', view: 'side',
      how: 'Камера стоит на месте и наклоняется вверх или вниз.',
      feel: 'Знакомит с героем «с ног до головы», показывает высоту и масштаб. Тилт вверх — герой выглядит значительнее.',
      gear: 'Штатив, гимбал или наклон телефона кистью.',
      mistake: 'Тилт без цели. Он должен вести от детали к важному — например, от обуви к лицу.',
      f: function (t) { return { p: [0, 1.3, 2.4], l: [0, U.lerp(0.15, 1.55, t), 0], f: 40 }; } },
    { id: 'in', name: 'Наезд', sub: 'камера приближается', view: 'top',
      how: 'Камера физически едет к герою: на тележке, слайдере, гимбале или шагом оператора.',
      feel: 'Усиливает внимание и эмоцию: зритель «подходит» к герою в важный момент.',
      gear: 'Гимбал или стабилизация в телефоне, плавный шаг. Для коротких наездов — слайдер.',
      mistake: 'Подменять наезд зумом: перспектива не меняется, и движение выглядит плоским.',
      f: function (t) { var z = U.lerp(5.2, 1.4, t); return { p: [0, 1.55, z], l: [0, U.lerp(1.15, 1.55, t), 0], f: 35 }; } },
    { id: 'out', name: 'Отъезд', sub: 'камера удаляется', view: 'top',
      how: 'Камера отъезжает от героя, постепенно открывая всё больше пространства.',
      feel: 'Показывает контекст, одиночество, финал сцены. Часто используют в концовках.',
      gear: 'Гимбал (идти спиной вперёд — с помощником), слайдер, дрон.',
      mistake: 'Отъезд без нового смысла в кадре. Пространство, которое открывается, должно что-то рассказывать.',
      f: function (t) { var z = U.lerp(1.4, 7.5, t); return { p: [0, U.lerp(1.55, 1.9, t), z], l: [0, U.lerp(1.55, 1.0, t), 0], f: 35 }; } },
    { id: 'truck', name: 'Проезд', sub: 'вбок вместе с героем', view: 'top', walk: true,
      how: 'Камера движется параллельно идущему герою, сохраняя расстояние.',
      feel: 'Динамика и сопровождение: зритель идёт рядом с героем. Фон «бежит» — ощущение скорости.',
      gear: 'Гимбал, машина, велосипед, слайдер для коротких проходов.',
      mistake: 'Камера отстаёт или обгоняет героя — он «плавает» в кадре. Держите одинаковое расстояние и скорость.',
      f: function (t) { var x = U.lerp(-3, 3, t); return { p: [x + 0.3, 1.45, 3.2], l: [x + 0.3, 1.2, 0], f: 35, walk: x }; } },
    { id: 'arc', name: 'Облёт', sub: 'по дуге вокруг героя', view: 'top',
      how: 'Камера движется по дуге вокруг героя, не выпуская его из центра внимания.',
      feel: 'Подчёркивает значимость момента и объём. Фон вращается за героем — кадр выглядит дорого.',
      gear: 'Гимбал, плавный шаг по кругу. Держите расстояние до героя одинаковым.',
      mistake: 'Меняется расстояние до героя — он то растёт, то уменьшается в кадре.',
      f: function (t) { var a = U.lerp(-60, 60, t) * U.D2R, r = 2.6; return { p: [Math.sin(a) * r, 1.5, Math.cos(a) * r], l: [0, 1.3, 0], f: 35 }; } },
    { id: 'crane', name: 'Кран', sub: 'подъём вверх', view: 'side',
      how: 'Камера поднимается вверх (или опускается), продолжая смотреть на героя.',
      feel: 'Эпичность и масштаб: герой становится частью большого пространства. Часто — начало или конец фильма.',
      gear: 'Операторский кран, дрон, телескопическая палка; на телефоне — поднять руки над головой плавно.',
      mistake: 'Подъём рывками. Лучше короткий плавный подъём, чем длинный с тряской.',
      f: function (t) { var y = U.lerp(0.9, 6.5, t); return { p: [0, y, U.lerp(3.2, 5.5, t)], l: [0, U.lerp(1.2, 0.6, t), 0], f: 30 }; } },
    { id: 'zoom', name: 'Зум', sub: 'камера стоит, меняется фокусное', view: 'top',
      how: 'Камера на месте, меняется фокусное расстояние объектива (на телефоне — «приближение»).',
      feel: 'Резкий акцент или «подсмотренный» взгляд. Фон приближается вместе с героем — перспектива не меняется.',
      gear: 'Объектив-зум или переключение камер телефона (лучше выбрать нужную заранее).',
      mistake: 'Цифровой зум на телефоне — теряется качество. И зум не заменяет наезд.',
      f: function (t) { return { p: [0, 1.55, 6.5], l: [0, U.lerp(1.1, 1.55, t), 0], f: U.lerp(28, 110, t) }; } }
  ];

  function widget(root) {
    var u = U.el, T = S.three();
    var box = u('div', 'mls');
    box.innerHTML =
      '<div class="mls-sun-grid">' +
        '<div class="mls-view"><div class="ov"><div class="mls-tag" style="left:2.5%;top:4%" data-v="lbl"></div>' +
          '<div class="mls-tag" style="right:2.5%;top:4%" data-v="lens"></div>' +
          '<div style="position:absolute;left:2.5%;right:2.5%;bottom:4%;height:4px;border-radius:2px;background:rgba(255,255,255,.25)"><div data-v="bar" style="height:100%;width:0;border-radius:2px;background:#fd7e2f"></div></div></div></div>' +
        '<div class="mls-card mls-map"><h4 data-v="schemeT">Схема</h4><svg viewBox="0 0 300 300" class="mls-svg" style="cursor:default" data-v="svg"></svg>' +
          '<div class="mls-tools" style="justify-content:center"><button type="button" class="mls-btn pr" data-act="play">Пауза</button></div>' +
          '<div class="mls-ctl" style="margin-top:10px"><span class="hd"><b>Скорость</b><output data-o="spd"></output></span><div class="mls-seg" data-seg="spd">' +
            '<button type="button" data-v="0.5">Медленно</button><button type="button" data-v="1">Обычно</button><button type="button" data-v="2">Быстро</button></div></div>' +
        '</div>' +
      '</div>' +
      '<div class="mls-chips" style="grid-template-columns:repeat(auto-fit,minmax(110px,1fr))"></div>' +
      '<div class="mls-row2"><div class="mls-card" data-v="about"></div><div class="mls-card" data-v="gear"></div></div>';
    root.appendChild(box);
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
    stage.setSun(125, 32); stage.setDaylight(32);
    var TREES = [[-7, -9, 6], [6.5, -11, 7], [-4, 4, 5], [-8, 1, 6], [8, 2, 5.5], [-13, -16, 8], [12, -19, 9], [-3, -24, 9], [18, -9, 6], [-19, -6, 7]];
    S.buildPark(stage, { trees: TREES, pathZ: -2.2, lamps: [[-4.5, -5], [4.5, -5]] });
    stage.scene.add(S.makePlaza(2.2));
    var bench = S.makeBench(); bench.position.set(-2.2, 0, -1.2); bench.rotation.y = 0.5; stage.scene.add(bench);
    var fig = new S.Figure(); stage.scene.add(fig.root);
    fig.setPose(S.POSES.contra, true); fig.extra.bodyYaw = 10; fig.apply(fig.current);

    var st = { m: 0, t: 0, dir: 1, hold: 0, play: true, spd: 1 };
    var phase = 0;
    function cur() { return MOVES[st.m]; }
    function applyT(dt) {
      var M = cur(), k = U.ease(st.t), c = M.f(k);
      stage.camera.position.fromArray(c.p);
      stage.camera.lookAt(c.l[0], c.l[1], c.l[2]);
      stage.setFocal(c.f);
      if (M.walk) {
        phase += (dt || 0) * 7.2 * st.spd * (st.hold > 0 ? 0 : 1);
        fig.root.position.x = c.walk;
        fig.extra.bodyYaw = st.dir > 0 ? 90 : -90;
        fig.apply(fig.walkPose(phase));
      }
      $('[data-v="lens"]').textContent = Math.round(c.f) + ' мм';
      $('[data-v="bar"]').style.width = (st.t * 100) + '%';
      drawScheme(c);
    }
    stage.animate(function (dt) {
      if (!st.play) return false;
      if (st.hold > 0) { st.hold -= dt; if (cur().walk) applyT(0); return true; }
      st.t += st.dir * dt / 4 * st.spd;
      if (st.t >= 1 || st.t <= 0) {
        st.t = U.clamp(st.t, 0, 1); st.hold = 0.9;
        st.dir = cur().walk ? -st.dir : (st.t >= 1 ? -1 : 1);
        if (!cur().walk && st.t >= 1) st.dir = -1;
      }
      applyT(dt);
      return true;
    });

    /* схема */
    var svg = $('[data-v="svg"]'), NS = 'http://www.w3.org/2000/svg';
    function sv(tag, at, par) { var e = document.createElementNS(NS, tag); for (var k in at) e.setAttribute(k, at[k]); (par || svg).appendChild(e); return e; }
    var pathCache = null;
    function drawScheme(c) {
      var M = cur(), side = M.view === 'side';
      var sc = side ? 26 : 22, cx = side ? 70 : 150, cy = side ? 250 : 130;
      function P(x, y, z) { return side ? [cx + z * sc, cy - y * sc] : [cx + x * sc, cy + z * sc]; }
      if (!pathCache || pathCache.id !== M.id) {
        svg.innerHTML = '';
        sv('rect', { x: 0, y: 0, width: 300, height: 300, rx: 14, fill: '#15171a' });
        if (side) {
          sv('line', { x1: 0, y1: cy, x2: 300, y2: cy, stroke: '#3a3d43', 'stroke-width': 2 });
          var tx = sv('text', { x: 12, y: cy + 18 }); tx.textContent = 'вид сбоку';
        } else {
          TREES.forEach(function (t) { var q = P(t[0], 0, t[1]); if (q[0] > -20 && q[0] < 320 && q[1] > -20 && q[1] < 320) sv('circle', { cx: q[0], cy: q[1], r: t[2] * 1.6, fill: '#2f4a26', opacity: 0.8 }); });
          var tx2 = sv('text', { x: 12, y: 290 }); tx2.textContent = 'вид сверху';
        }
        var pts = [];
        for (var i = 0; i <= 40; i++) { var q2 = M.f(U.ease(i / 40)); pts.push(P(q2.p[0], q2.p[1], q2.p[2]).join(',')); }
        sv('polyline', { points: pts.join(' '), fill: 'none', stroke: '#fd7e2f', 'stroke-width': 3, 'stroke-dasharray': '6 6', opacity: 0.8 });
        pathCache = { id: M.id, subj: sv('g', {}), fr: sv('path', { fill: 'rgba(253,126,47,.18)', stroke: 'rgba(253,126,47,.7)', 'stroke-width': 1.5 }), cam: sv('g', {}) };
        if (side) {
          sv('rect', { x: -5, y: -44, width: 10, height: 44, rx: 4, fill: '#c98a2e' }, pathCache.subj);
          sv('circle', { cx: 0, cy: -50, r: 6, fill: '#d6a084' }, pathCache.subj);
        } else {
          sv('ellipse', { cx: 0, cy: 0, rx: 10, ry: 6, fill: '#c98a2e' }, pathCache.subj);
          sv('circle', { cx: 0, cy: 0, r: 4.5, fill: '#3b2a20' }, pathCache.subj);
        }
        sv('rect', { x: -9, y: -7, width: 18, height: 14, rx: 3, fill: '#fd7e2f', stroke: '#111', 'stroke-width': 1.5 }, pathCache.cam);
      }
      var sp = P(fig.root.position.x, 0, fig.root.position.z);
      pathCache.subj.setAttribute('transform', 'translate(' + sp[0] + ',' + sp[1] + ')');
      var cp = P(c.p[0], c.p[1], c.p[2]), lp = P(c.l[0], c.l[1], c.l[2]);
      var ang = Math.atan2(lp[1] - cp[1], lp[0] - cp[0]), half = (side ? U.focalToFov(c.f) : 2 * Math.atan(18 / c.f) / U.D2R) / 2 * U.D2R, L = 300;
      var a1 = [cp[0] + Math.cos(ang - half) * L, cp[1] + Math.sin(ang - half) * L], a2 = [cp[0] + Math.cos(ang + half) * L, cp[1] + Math.sin(ang + half) * L];
      pathCache.fr.setAttribute('d', 'M' + cp + ' L' + a1 + ' L' + a2 + 'Z');
      pathCache.cam.setAttribute('transform', 'translate(' + cp[0] + ',' + cp[1] + ') rotate(' + (ang / U.D2R) + ')');
    }

    /* выбор движения */
    var chips = $('.mls-chips');
    chips.innerHTML = MOVES.map(function (m, i) { return '<button type="button" class="mls-chip" data-i="' + i + '"><span class="nm">' + m.name + '</span><span class="sb">' + m.sub + '</span></button>'; }).join('');
    chips.addEventListener('click', function (e) { var b = e.target.closest('.mls-chip'); if (b) select(+b.getAttribute('data-i')); });
    function select(i) {
      st.m = i; st.t = 0; st.dir = 1; st.hold = 0.5; st.play = true; pathCache = null;
      if (!cur().walk) { fig.root.position.x = 0; fig.extra.bodyYaw = 10; fig.apply(fig.pose); }
      sync(); applyT(0); stage.invalidate();
    }
    box.addEventListener('click', function (e) {
      var s = e.target.closest('[data-seg] button');
      if (s) { st.spd = +s.getAttribute('data-v'); sync(); return; }
      var a = e.target.closest('[data-act]'); if (!a) return;
      st.play = !st.play; sync(); stage.invalidate();
    });
    function sync() {
      var M = cur();
      box.querySelectorAll('.mls-chip').forEach(function (b, i) { b.classList.toggle('on', i === st.m); });
      box.querySelectorAll('[data-seg="spd"] button').forEach(function (b) { b.classList.toggle('on', +b.getAttribute('data-v') === st.spd); });
      $('[data-o="spd"]').textContent = st.spd === 0.5 ? 'медленно' : st.spd === 1 ? 'обычно' : 'быстро';
      $('[data-act="play"]').textContent = st.play ? 'Пауза' : 'Смотреть';
      $('[data-v="lbl"]').textContent = '🎥 ' + M.name;
      $('[data-v="schemeT"]').textContent = M.view === 'side' ? 'Схема — вид сбоку' : 'Схема — вид сверху';
      $('[data-v="about"]').innerHTML = '<h4>' + M.name + '</h4><p class="mls-txt"><b>Как:</b> ' + M.how + '</p><p class="mls-txt"><b>Зачем:</b> ' + M.feel + '</p>';
      $('[data-v="gear"]').innerHTML = '<h4>Как снять</h4><p class="mls-txt">' + M.gear + '</p><p class="mls-txt"><b>Частая ошибка:</b> ' + M.mistake + '</p>' +
        (st.spd === 2 ? '<p class="mls-note">Быстрое движение выглядит нервно — используйте его только когда это нужно истории.</p>' : '');
    }
    select(0);
    root.__mlsApi = { stage: stage, st: st, select: select, applyT: applyT };
  }
  S.widgets.move = widget;
})();
