/* ---------- Тренажёр «Композиция кадра» ---------- */
(function () {
  'use strict';
  var S = window.MLStudio, U = S.util;

  var SHOTS = { wide: { n: 'Общий', d: 5.6, ty: 0.9 }, mid: { n: 'Средний', d: 2.4, ty: 1.25 }, close: { n: 'Крупный', d: 1.15, ty: 1.5 } };
  var HEIGHTS = { low: { n: 'Снизу', y: 0.75 }, eye: { n: 'На уровне глаз', y: 1.58 }, high: { n: 'Сверху', y: 2.35 } };

  function widget(root) {
    var u = U.el, T = S.three();
    var box = u('div', 'mls');
    box.innerHTML =
      '<div class="mls-view"><svg class="ov" viewBox="0 0 1600 900" preserveAspectRatio="none" data-v="ov"></svg>' +
        '<div class="mls-tag" style="left:2.5%;top:4%" data-v="lbl"></div></div>' +
      '<div class="mls-row2">' +
        '<div class="mls-card"><h4>Кадр</h4>' +
          '<div class="mls-ctl"><span class="hd"><b>Крупность</b><output data-o="shot"></output></span><div class="mls-seg" data-seg="shot">' +
            '<button type="button" data-v="wide">Общий</button><button type="button" data-v="mid">Средний</button><button type="button" data-v="close">Крупный</button></div></div>' +
          '<label class="mls-ctl"><span class="hd"><b>Где герой в кадре</b><output data-o="x"></output></span><input type="range" min="-100" max="100" step="1" data-r="x" aria-label="Положение героя по горизонтали">' +
            '<span class="hint">Тяните, чтобы сдвинуть героя влево или вправо (камера поворачивается).</span></label>' +
          '<label class="mls-ctl"><span class="hd"><b>Воздух над головой</b><output data-o="y"></output></span><input type="range" min="-8" max="40" step="1" data-r="y" aria-label="Отступ над головой">' +
            '<span class="hint">Расстояние от макушки до верхнего края кадра.</span></label>' +
          '<div class="mls-ctl"><span class="hd"><b>Куда смотрит герой</b><output data-o="look"></output></span><div class="mls-seg" data-seg="look">' +
            '<button type="button" data-v="-1">Влево</button><button type="button" data-v="0">В камеру</button><button type="button" data-v="1">Вправо</button></div></div>' +
          '<div class="mls-ctl"><span class="hd"><b>Высота камеры</b><output data-o="h"></output></span><div class="mls-seg" data-seg="h">' +
            '<button type="button" data-v="low">Снизу</button><button type="button" data-v="eye">Уровень глаз</button><button type="button" data-v="high">Сверху</button></div></div>' +
          '<div class="mls-ctl"><span class="hd"><b>Передний план</b><output data-o="fg"></output></span><div class="mls-seg" data-seg="fg">' +
            '<button type="button" data-v="none">Нет</button><button type="button" data-v="branch">Ветка</button><button type="button" data-v="ots">Плечо собеседника</button></div></div>' +
          '<div class="mls-ctl"><span class="hd"><b>Задний план</b><output data-o="bg"></output></span><div class="mls-seg" data-seg="bg">' +
            '<button type="button" data-v="clean">Чистый</button><button type="button" data-v="post">Столб за героем</button></div></div>' +
          '<div class="mls-tools"><button type="button" class="mls-btn pr" data-act="fix">Подсказать кадр</button><button type="button" class="mls-btn on" data-act="grid">Сетка третей</button></div>' +
        '</div>' +
        '<div class="mls-col"><div class="mls-card"><h4>Разбор кадра</h4><ul class="mls-checks"></ul><div class="mls-sum"></div></div>' +
          '<div class="mls-card"><h4>Три плана кадра</h4><p class="mls-txt"><b>Передний</b> — то, что ближе героя: ветки, плечо, предметы. Даёт глубину и ощущение присутствия.</p>' +
          '<p class="mls-txt"><b>Средний</b> — герой и действие.</p><p class="mls-txt"><b>Задний</b> — фон и место действия. Он должен помогать истории, а не спорить с героем.</p></div>' +
        '</div>' +
      '</div>';
    root.appendChild(box);
    var $ = function (s) { return box.querySelector(s); };
    var view = $('.mls-view');
    var stage = new S.Stage(view);
    stage.setSun(120, 30); stage.setDaylight(30);
    S.buildPark(stage, { pathZ: -2.6, lamps: [[-7, -9], [7.5, -10]] });
    stage.scene.add(S.makePlaza(2.2));
    var fig = new S.Figure(); stage.scene.add(fig.root);
    fig.setPose(S.POSES.pockets, true);

    /* столб «из головы» */
    var post = S.makeLamp(); post.visible = false; stage.scene.add(post);
    /* передний план: ветка и плечо собеседника — крепятся к камере */
    stage.scene.add(stage.camera);
    var branch = new T.Group(), R = U.rng(5);
    var stem = new T.Mesh(new T.CylinderGeometry(0.012, 0.02, 0.9, 6), U.mat('#4a3626')); stem.rotation.z = 1.1; branch.add(stem);
    for (var i = 0; i < 26; i++) {
      var lf = new T.Mesh(new T.SphereGeometry(0.05, 8, 6), U.mat(['#3f6b2c', '#4f7d35', '#2f5622'][i % 3]));
      var t = R() * 0.9 - 0.45; lf.position.set(-Math.sin(1.1) * t + (R() - 0.5) * 0.14, Math.cos(1.1) * t + (R() - 0.5) * 0.14, (R() - 0.5) * 0.08);
      lf.scale.set(1.4, 0.7, 1); lf.rotation.z = R() * 3; branch.add(lf);
    }
    branch.position.set(-0.3, 0.17, -0.7); branch.scale.setScalar(0.55); branch.visible = false; stage.camera.add(branch);
    var ots = new S.Figure({ colors: { jacket: '#3d4b5e', hair: '#1f1a17' } });
    ots.setPose(S.POSES.soldier, true);
    ots.root.visible = false; stage.camera.add(ots.root);

    var st = { shot: 'mid', x: -33, y: 12, look: 1, h: 'eye', fg: 'none', bg: 'clean', grid: true };
    var shotN = { wide: 'общий', mid: 'средний', close: 'крупный' };

    function frameCamera() {
      var sh = SHOTS[st.shot], H = HEIGHTS[st.h];
      var camY = st.h === 'eye' ? U.lerp(1.2, 1.58, st.shot === 'wide' ? 0.3 : 1) : H.y;
      if (st.shot === 'close' && st.h !== 'eye') camY = st.h === 'low' ? 1.15 : 2.0;
      var cam = stage.camera;
      cam.position.set(0, camY, sh.d);
      stage.setFocal(50);
      /* подбираем поворот и наклон, чтобы глаза/макушка встали в нужные точки кадра */
      var yaw = 0, pitch = Math.atan2(sh.ty - camY, sh.d);
      var P = fig.points();
      var wantX = 0.5 + st.x / 100 * 0.36, wantTop = st.y / 100;
      for (var k = 0; k < 4; k++) {
        cam.rotation.set(pitch, yaw, 0, 'YXZ'); cam.updateMatrixWorld();
        var e = stage.projectPx(P.eyes), tp = stage.projectPx(P.top);
        var vf = cam.fov * U.D2R, hf = 2 * Math.atan(Math.tan(vf / 2) * cam.aspect);
        yaw -= (e.x - wantX) * hf;
        pitch -= (tp.y - wantTop) * vf;
      }
      cam.rotation.set(pitch, yaw, 0, 'YXZ'); cam.updateMatrixWorld();
      /* столб ровно за головой с точки зрения камеры */
      var zPost = -7, head = P.headCenter, c = cam.position;
      var tt = (zPost - c.z) / (head.z - c.z);
      post.position.set(c.x + (head.x - c.x) * tt - 0.45, 0, zPost);
      post.visible = st.bg === 'post';
      branch.visible = st.fg === 'branch';
      ots.root.visible = st.fg === 'ots';
      if (st.fg === 'ots') {
        var side = st.x <= 0 ? 1 : -1;
        ots.root.position.set(0.3 * side, -1.58, -0.75);
        ots.root.rotation.set(-pitch, Math.PI - side * 0.35, 0);
      }
      stage.invalidate();
    }
    function applyLook() {
      fig.extra.bodyYaw = st.look * 28;
      fig.extra.headYaw = st.look * 22;
      fig.apply(fig.current);
    }

    var ov = $('[data-v="ov"]'), NS = 'http://www.w3.org/2000/svg';
    function sv(tag, at) { var e = document.createElementNS(NS, tag); for (var k in at) e.setAttribute(k, at[k]); ov.appendChild(e); return e; }
    function drawOverlay(info) {
      ov.innerHTML = '';
      if (st.grid) {
        [1, 2].forEach(function (i) {
          sv('line', { x1: 1600 * i / 3, y1: 0, x2: 1600 * i / 3, y2: 900, stroke: 'rgba(255,255,255,.55)', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' });
          sv('line', { x1: 0, y1: 900 * i / 3, x2: 1600, y2: 900 * i / 3, stroke: 'rgba(255,255,255,.55)', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' });
        });
        [[1, 1], [2, 1], [1, 2], [2, 2]].forEach(function (p) { sv('circle', { cx: 1600 * p[0] / 3, cy: 900 * p[1] / 3, r: 9, fill: 'none', stroke: 'rgba(255,255,255,.7)', 'stroke-width': 2 }); });
      }
      var e = info.eyes;
      sv('circle', { cx: e.x * 1600, cy: e.y * 900, r: 11, fill: info.thirdOk ? '#3ecf7a' : '#f3b23a', stroke: '#111', 'stroke-width': 2 });
      /* запас по взгляду */
      if (st.look) {
        var x2 = e.x * 1600 + st.look * 150;
        sv('line', { x1: e.x * 1600 + st.look * 20, y1: e.y * 900, x2: x2, y2: e.y * 900, stroke: info.lookOk ? '#3ecf7a' : '#ff5d52', 'stroke-width': 5, 'stroke-linecap': 'round' });
        sv('path', { d: 'M' + x2 + ' ' + (e.y * 900 - 14) + ' L' + (x2 + st.look * 22) + ' ' + e.y * 900 + ' L' + x2 + ' ' + (e.y * 900 + 14) + 'Z', fill: info.lookOk ? '#3ecf7a' : '#ff5d52' });
      }
      if (info.postBad) sv('line', { x1: info.post * 1600, y1: 0, x2: info.post * 1600, y2: info.top.y * 900, stroke: '#ff5d52', 'stroke-width': 6, 'stroke-dasharray': '18 12' });
      if (info.horBad) sv('line', { x1: 0, y1: info.hor * 900, x2: 1600, y2: info.hor * 900, stroke: '#ff5d52', 'stroke-width': 4, 'stroke-dasharray': '18 12' });
      var ty = info.top.y * 900;
      if (info.headroomBad) sv('rect', { x: info.top.x * 1600 - 70, y: 0, width: 140, height: Math.max(4, ty), fill: 'rgba(255,93,82,.28)' });
    }

    function check(c, t, d) { return '<li class="' + c + '"><span class="ic">' + (c === 'ok' ? '✓' : c === 'info' ? 'i' : '!') + '</span><span><b>' + t + '</b><small>' + d + '</small></span></li>'; }
    function analyse() {
      var P = fig.points(), cam = stage.camera;
      var e = stage.projectPx(P.eyes), top = stage.projectPx(P.top), chin = stage.projectPx(P.chin);
      /* горизонт: далёкая точка на высоте камеры прямо по направлению взгляда камеры */
      var dir = new T.Vector3(0, 0, -1).applyQuaternion(cam.quaternion); dir.y = 0; dir.normalize();
      var horP = stage.projectPx(cam.position.clone().addScaledVector(dir, 300));
      var postX = post.visible ? stage.projectPx(new T.Vector3(post.position.x, 2.5, post.position.z)).x : -1;
      var out = [], info = { eyes: e, top: top, hor: horP.y, post: postX };
      /* треть */
      var dx3 = Math.min(Math.abs(e.x - 1 / 3), Math.abs(e.x - 2 / 3)), dc = Math.abs(e.x - 0.5);
      info.thirdOk = dx3 < 0.06;
      if (info.thirdOk) out.push(check('ok', 'Герой на линии трети', 'Кадр живой и уравновешенный.'));
      else if (dc < 0.05) out.push(check(st.look ? 'warn' : 'info', 'Герой по центру', st.look ? 'При взгляде в сторону центр выглядит случайно. Сдвиньте героя на линию трети.' : 'Симметрично и статично — так снимают обращение прямо в камеру.'));
      else out.push(check('warn', 'Герой между третью и центром', 'Положение выглядит случайным. Поставьте глаза на линию трети.'));
      /* запас по взгляду */
      if (st.look) {
        var room = st.look > 0 ? 1 - e.x : e.x;
        info.lookOk = room > 0.5;
        out.push(info.lookOk ? check('ok', 'Есть воздух по направлению взгляда', 'Герою есть куда смотреть — кадр не «упирается».') :
          check('bad', 'Взгляд упирается в край кадра', 'Перед лицом должно быть больше места, чем за затылком. Сдвиньте героя в противоположную сторону.'));
      }
      /* воздух над головой */
      var tp = top.y;
      var lo = st.shot === 'close' ? -0.06 : 0.03, hi = st.shot === 'wide' ? 0.3 : st.shot === 'close' ? 0.1 : 0.18;
      info.headroomBad = tp < lo || tp > hi;
      if (tp < lo) out.push(check('bad', 'Срезана макушка', st.shot === 'close' ? 'На крупном плане можно срезать волосы, но не лоб.' : 'Опустите кадр — голова не должна касаться края.'));
      else if (tp > hi) out.push(check('warn', 'Слишком много воздуха над головой', 'Герой «проваливается» вниз. Поднимите его так, чтобы глаза были на верхней трети.'));
      else out.push(check('ok', 'Воздух над головой в норме', st.shot === 'close' ? 'На крупном плане лёгкий срез волос допустим.' : 'Голова не прижата к краю и не тонет.'));
      /* линия глаз */
      if (st.shot !== 'wide') {
        var ok = Math.abs(e.y - 1 / 3) < 0.08;
        out.push(ok ? check('ok', 'Глаза на верхней трети', 'Взгляд зрителя сразу попадает в лицо.') : check('warn', 'Глаза не на верхней трети', e.y > 1 / 3 ? 'Лицо слишком низко.' : 'Лицо слишком высоко.'));
      }
      /* фон */
      info.postBad = post.visible && Math.abs(postX - top.x) < 0.06;
      if (info.postBad) out.push(check('bad', 'Столб «растёт из головы»', 'Сместитесь в сторону или измените ракурс, чтобы фон не пересекал голову.'));
      info.horBad = horP.y > chin.y - 0.005 && horP.y < chin.y + 0.07 && horP.y > 0 && horP.y < 1;
      if (info.horBad) out.push(check('warn', 'Горизонт режет шею', 'Линия горизонта «отрезает» голову. Поднимите или опустите камеру.'));
      else if (!info.postBad) out.push(check('ok', 'Фон не спорит с героем', 'Ничего не торчит из головы, горизонт не режет шею.'));
      /* передний план */
      if (st.fg === 'branch') out.push(check('info', 'Передний план — ветка', 'Добавляет глубину и ощущение, что мы подсматриваем. На реальной камере ветка будет размыта.'));
      else if (st.fg === 'ots') out.push(check('info', 'Плечо собеседника', 'Классический кадр диалога «через плечо» — зритель становится участником разговора.'));
      else out.push(check('info', 'Переднего плана нет', 'Кадр чистый. Ветка или плечо собеседника добавят глубины.'));
      if (st.h !== 'eye') out.push(check('info', st.h === 'low' ? 'Камера снизу' : 'Камера сверху', st.h === 'low' ? 'Герой выглядит сильнее и значительнее.' : 'Герой выглядит меньше и уязвимее.'));
      $('.mls-checks').innerHTML = out.join('');
      var bad = (out.join('').match(/class="(warn|bad)"/g) || []).length;
      var sum = $('.mls-sum'); sum.className = 'mls-sum' + (bad ? '' : ' ok');
      sum.textContent = bad ? 'Исправьте: ' + bad + '. Подсказка — кнопка «Подсказать кадр».' : '✓ Кадр собран — так снимают профессионалы.';
      drawOverlay(info);
    }

    function sync() {
      applyLook(); frameCamera();
      stage.camera.updateMatrixWorld(); fig.root.updateMatrixWorld(true);
      box.querySelectorAll('[data-seg] button').forEach(function (b) { var k = b.parentNode.getAttribute('data-seg'); b.classList.toggle('on', String(st[k]) === b.getAttribute('data-v')); });
      $('[data-r="x"]').value = st.x; $('[data-r="y"]').value = st.y;
      $('[data-o="x"]').textContent = st.x < -5 ? 'левее центра' : st.x > 5 ? 'правее центра' : 'по центру';
      $('[data-o="y"]').textContent = st.y + '%';
      $('[data-o="shot"]').textContent = shotN[st.shot];
      $('[data-o="look"]').textContent = st.look < 0 ? 'влево' : st.look > 0 ? 'вправо' : 'в камеру';
      $('[data-o="h"]').textContent = HEIGHTS[st.h].n.toLowerCase();
      $('[data-o="fg"]').textContent = st.fg === 'none' ? 'нет' : st.fg === 'branch' ? 'ветка' : 'плечо';
      $('[data-o="bg"]').textContent = st.bg === 'clean' ? 'чистый' : 'столб';
      $('[data-act="grid"]').classList.toggle('on', st.grid);
      $('[data-v="lbl"]').textContent = SHOTS[st.shot].n + ' план · 50 мм';
      analyse();
      stage.invalidate();
    }
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-seg] button');
      if (b) {
        var k = b.parentNode.getAttribute('data-seg'), v = b.getAttribute('data-v');
        st[k] = k === 'look' ? +v : v;
        if (k === 'shot') st.y = v === 'wide' ? 18 : v === 'mid' ? 12 : 2;
        sync(); return;
      }
      var a = e.target.closest('[data-act]'); if (!a) return;
      if (a.getAttribute('data-act') === 'grid') st.grid = !st.grid;
      else {
        st.x = st.look > 0 ? -33 : st.look < 0 ? 33 : -33; if (!st.look) st.look = 1;
        st.y = st.shot === 'wide' ? 18 : st.shot === 'mid' ? 12 : 2; st.bg = 'clean'; st.h = 'eye';
        if (st.fg === 'none') st.fg = 'branch';
      }
      sync();
    });
    $('[data-r="x"]').addEventListener('input', function () { st.x = +this.value; sync(); });
    $('[data-r="y"]').addEventListener('input', function () { st.y = +this.value; sync(); });
    /* перетаскивание по кадру двигает героя */
    var drag = null;
    view.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY, sx: st.x, sy: st.y }; view.setPointerCapture(e.pointerId); });
    view.addEventListener('pointermove', function (e) {
      if (!drag) return;
      st.x = U.clamp(Math.round(drag.sx + (e.clientX - drag.x) / view.clientWidth * 280), -100, 100);
      st.y = U.clamp(Math.round(drag.sy + (e.clientY - drag.y) / view.clientHeight * 100), -8, 40);
      sync();
    });
    ['pointerup', 'pointercancel'].forEach(function (n) { view.addEventListener(n, function () { drag = null; }); });
    stage.onFrame = function () { };
    var ro = 'ResizeObserver' in window ? new ResizeObserver(function () { sync(); }) : null;
    if (ro) ro.observe(view);
    st.x = 40; st.look = 1; st.bg = 'post';
    sync();
    root.__mlsApi = { stage: stage, st: st, sync: sync };
  }
  S.widgets.compose = widget;
})();
