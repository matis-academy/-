/* ---------- Тренажёр «Поставь модель» ---------- */
(function () {
  'use strict';
  var S = window.MLStudio, U = S.util;

  var LIST = [
    { id: 'soldier', name: 'Солдатик', sub: 'стоит ровно', mark: 'bad', yaw: 0, weight: false, gaps: false,
      why: 'Корпус «в лоб», руки прижаты, вес на обеих ногах. Фигура выглядит шире и скованно, как на фото на паспорт.',
      tips: ['Попросите перенести вес на одну ногу.', 'Разверните корпус на 30–45° от камеры.', 'Дайте рукам занятие: карман, ремень сумки, чашка.'] },
    { id: 'contra', name: 'Вес на ногу', sub: 'контрапост', mark: 'ok', yaw: 28, weight: true, gaps: true,
      why: 'Вес на одной ноге: бёдра и плечи наклоняются в разные стороны, появляется естественный S-изгиб. Рука на поясе даёт «треугольник» — просвет между рукой и телом.',
      tips: ['Опорная нога — дальняя от камеры.', 'Свободная нога чуть согнута и выставлена вперёд.', 'Просветы между руками и телом делают фигуру стройнее.'] },
    { id: 'pockets', name: 'Руки в карманах', sub: 'расслабленно', mark: 'ok', yaw: 22, weight: true, gaps: true,
      why: 'Простая поза, которая сразу убирает вопрос «куда деть руки». Локти отведены от корпуса — силуэт читается.',
      tips: ['Кисти в карманах не до конца — большие пальцы снаружи.', 'Плечи опущены, не поднимайте их к ушам.', 'Хорошо работает в паре с шагом или опорой о стену.'] },
    { id: 'crossed', name: 'Руки скрещены', sub: 'закрытая поза', mark: 'mid', yaw: 18, weight: false, gaps: false,
      why: 'Читается как уверенность, но и как защита: руки перекрывают корпус. Подходит для делового портрета, в остальном — с осторожностью.',
      tips: ['Не прижимайте руки слишком сильно — пусть лежат свободно.', 'Добавьте улыбку или поворот головы, чтобы поза не выглядела враждебной.', 'Разверните корпус, чтобы руки не закрывали всю грудь.'] },
    { id: 'think', name: 'Рука у лица', sub: 'задумчиво', mark: 'ok', yaw: -25, weight: true, gaps: true,
      why: 'Рука ведёт взгляд зрителя к лицу и задаёт настроение. Вторая рука поддерживает локоть — поза собранная.',
      tips: ['Рука касается лица легко, не подпирает и не деформирует щёку.', 'Кисть повёрнута ребром к камере, а не ладонью.', 'Хорошо на среднем и крупном плане.'] },
    { id: 'walk', name: 'Шаг', sub: 'в движении', mark: 'ok', yaw: 40, weight: true, gaps: true,
      why: 'Движение снимает зажим: человек перестаёт позировать. Видео особенно выигрывает — поза живая и в динамике.',
      tips: ['Попросите пройти несколько раз туда и обратно, снимайте каждый проход.', 'Идти медленнее обычного — в кадре это выглядит естественно.', 'Камера на уровне груди или пояса.'] },
    { id: 'wall', name: 'У стены', sub: 'опора', mark: 'ok', yaw: 15, weight: true, gaps: true, prop: 'wall',
      why: 'Опора даёт телу естественный изгиб и расслабляет. Согнутая нога со стопой на стене — классика уличного портрета.',
      tips: ['Опирайтесь лопатками, а не всей спиной.', 'Не «утопайте» в стене — оставьте немного воздуха между головой и стеной.', 'Свободные руки — в карманы или скрестить.'] },
    { id: 'sit', name: 'Сидя', sub: 'на скамейке', mark: 'ok', yaw: 25, weight: true, gaps: true, prop: 'bench',
      why: 'Наклон вперёд и локти на коленях — поза разговора, вовлечённости. Хорошо для интервью и спокойных сцен.',
      tips: ['Садитесь на край, а не вглубь скамейки — спина не сутулится.', 'Камера на уровне глаз сидящего, а не сверху.', 'Колени не направляйте прямо в камеру — разверните корпус.'] },
    { id: 'shoulder', name: 'Через плечо', sub: 'взгляд назад', mark: 'ok', yaw: 145, weight: true, gaps: true,
      why: 'Корпус развёрнут от камеры, а голова — к ней. Поза создаёт интригу и вытягивает шею, выглядит кинематографично.',
      tips: ['Поворачивайте плечи, а не только голову — иначе шея «перекручивается».', 'Подбородок к плечу, но не опускайте его.', 'Хорошо работает в контровом свете.'] }
  ];

  function widget(root) {
    var u = U.el, T = S.three();
    var box = u('div', 'mls');
    box.innerHTML =
      '<div class="mls-view"><div class="ov">' +
        '<div class="mls-tag" style="left:2.5%;top:4%" data-v="cam"></div>' +
        '<div class="mls-tag" style="right:2.5%;top:4%">Тяните кадр, чтобы обойти модель</div>' +
      '</div></div>' +
      '<div class="mls-chips" style="grid-template-columns:repeat(auto-fit,minmax(100px,1fr))"></div>' +
      '<div class="mls-row2">' +
        '<div class="mls-card"><h4>Настройки</h4>' +
          '<div class="mls-ctl"><span class="hd"><b>Ракурс камеры</b><output data-o="cam"></output></span><div class="mls-seg" data-seg="cam">' +
            '<button type="button" data-v="0">Анфас</button><button type="button" data-v="35">3/4</button><button type="button" data-v="90">Профиль</button><button type="button" data-v="-35">3/4 справа</button></div></div>' +
          '<label class="mls-ctl"><span class="hd"><b>Разворот модели</b><output data-o="yaw"></output></span><input type="range" min="-180" max="180" step="1" data-r="yaw" aria-label="Разворот модели">' +
            '<span class="hint">0° — лицом к камере. Лучше всего обычно 25–45°.</span></label>' +
          '<label class="mls-ctl"><span class="hd"><b>Поворот головы</b><output data-o="head"></output></span><input type="range" min="-60" max="60" step="1" data-r="head" aria-label="Поворот головы">' +
            '<span class="hint">Голову можно повернуть к камере сильнее, чем корпус.</span></label>' +
          '<div class="mls-tools"><button type="button" class="mls-btn" data-act="sil">Показать силуэт</button><button type="button" class="mls-btn" data-act="best">Лучший ракурс</button></div>' +
          '<div class="mls-note">Силуэт — проверка, которую делают художники и фотографы: если поза читается чёрным пятном, она читается и в кадре.</div>' +
        '</div>' +
        '<div class="mls-col">' +
          '<div class="mls-card"><h4>Проверка позы</h4><ul class="mls-checks"></ul><div class="mls-sum"></div></div>' +
          '<div class="mls-card" data-v="about"></div>' +
        '</div>' +
      '</div>';
    root.appendChild(box);
    var $ = function (s) { return box.querySelector(s); };
    var view = $('.mls-view');
    var stage = new S.Stage(view);
    stage.setSun(125, 38); stage.setDaylight(38);
    S.buildPark(stage, { pathZ: -3.4 });
    var plaza = S.makePlaza(2.2); stage.scene.add(plaza);
    var wall = S.makeWall(3.2, 2.4); wall.position.set(0, 1.2, -0.35); wall.visible = false; stage.scene.add(wall);
    var bench = S.makeBench(); bench.position.set(0, 0, 0.1); bench.visible = false; stage.scene.add(bench);
    var fig = new S.Figure(); stage.scene.add(fig.root);

    var st = { pose: 'contra', yaw: 28, head: 0, camAz: 0, camTarget: 0, sil: false };
    var cam = { az: 0, dist: 3.5, h: 1.2 };

    function placeCamera() {
      var a = cam.az * U.D2R, d = cam.dist;
      stage.camera.position.set(Math.sin(a) * d, cam.h, Math.cos(a) * d);
      stage.camera.lookAt(0, 0.9, 0);
    }
    stage.setFocal(35);
    placeCamera();

    var wrapper = { root: wall, bench: bench };
    function poseById(id) { for (var i = 0; i < LIST.length; i++) if (LIST[i].id === id) return LIST[i]; }
    function setPose(id, instant) {
      var P = poseById(id); st.pose = id; st.yaw = P.yaw; st.head = 0;
      fig.setPose(S.POSES[id], instant);
      wall.visible = P.prop === 'wall'; bench.visible = P.prop === 'bench';
      sync();
    }
    stage.animate(function (dt) {
      var busy = fig.update(dt);
      /* плавный поворот модели и камеры */
      var ty = st.yaw, cy = fig.extra.bodyYaw + (fig.current ? fig.current.yaw : 0);
      var k = 1 - Math.pow(0.0005, dt);
      fig.extra.bodyYaw += (st.yaw - fig.extra.bodyYaw) * k;
      fig.extra.headYaw += (st.head - fig.extra.headYaw) * k;
      if (Math.abs(st.yaw - fig.extra.bodyYaw) > 0.05 || Math.abs(st.head - fig.extra.headYaw) > 0.05) { busy = true; fig.apply(fig.current); }
      else { fig.extra.bodyYaw = st.yaw; fig.extra.headYaw = st.head; }
      var dAz = st.camTarget - cam.az;
      if (Math.abs(dAz) > 0.05) { cam.az += dAz * k; busy = true; } else cam.az = st.camTarget;
      /* опора вращается вместе с моделью */
      var a = fig.root.rotation.y;
      wall.rotation.y = a; wall.position.set(Math.sin(a) * -0.33, 1.2, Math.cos(a) * -0.33);
      bench.rotation.y = a; bench.position.set(Math.sin(a) * 0.1, 0, Math.cos(a) * 0.1);
      placeCamera();
      return busy;
    });

    /* перетаскивание — обход вокруг модели */
    var drag = null;
    view.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, az: st.camTarget }; view.setPointerCapture(e.pointerId); });
    view.addEventListener('pointermove', function (e) {
      if (!drag) return;
      st.camTarget = drag.az - (e.clientX - drag.x) / view.clientWidth * 220;
      cam.az = st.camTarget; stage.invalidate(); syncLite();
    });
    ['pointerup', 'pointercancel'].forEach(function (n) { view.addEventListener(n, function () { drag = null; sync(); }); });

    /* фишки поз */
    var chips = $('.mls-chips');
    chips.innerHTML = LIST.map(function (p) {
      var mk = p.mark === 'ok' ? '<span class="mk ok">так хорошо</span>' : p.mark === 'bad' ? '<span class="mk bad">ошибка</span>' : '<span class="mk mid">с осторожностью</span>';
      return '<button type="button" class="mls-chip" data-id="' + p.id + '"><span class="nm">' + p.name + '</span><span class="sb">' + p.sub + '</span>' + mk + '</button>';
    }).join('');
    chips.addEventListener('click', function (e) { var b = e.target.closest('.mls-chip'); if (b) setPose(b.getAttribute('data-id')); });

    var R = { yaw: $('[data-r="yaw"]'), head: $('[data-r="head"]') };
    R.yaw.addEventListener('input', function () { st.yaw = +R.yaw.value; sync(); stage.invalidate(); });
    R.head.addEventListener('input', function () { st.head = +R.head.value; sync(); stage.invalidate(); });
    $('[data-seg="cam"]').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; st.camTarget = +b.getAttribute('data-v'); sync(); stage.invalidate(); });
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var a = b.getAttribute('data-act');
      if (a === 'sil') {
        st.sil = !st.sil; fig.setSilhouette(st.sil);
        stage.scene.children.forEach(function (o) { if (o !== fig.root) o.visible = st.sil ? false : (o === wall ? poseById(st.pose).prop === 'wall' : o === bench ? poseById(st.pose).prop === 'bench' : true); });
        stage.scene.background = st.sil ? new T.Color('#efebe4') : null;
        stage.scene.fog.far = st.sil ? 1e6 : 160;
      } else if (a === 'best') { var P = poseById(st.pose); st.yaw = P.yaw; st.head = 0; st.camTarget = 0; }
      sync(); stage.invalidate();
    });

    function angDiff(a, b) { var d = ((a - b) % 360 + 540) % 360 - 180; return d; }
    function syncLite() {
      $('[data-v="cam"]').textContent = 'Камера: ' + camLabel(st.camTarget);
      $('[data-o="cam"]').textContent = camLabel(st.camTarget);
    }
    function camLabel(a) {
      var d = Math.abs(angDiff(a, 0));
      return d < 12 ? 'анфас' : d < 60 ? '3/4' : d < 120 ? 'профиль' : 'со спины';
    }
    function check(c, t, d) { return '<li class="' + c + '"><span class="ic">' + (c === 'ok' ? '✓' : c === 'info' ? 'i' : '!') + '</span><span><b>' + t + '</b><small>' + d + '</small></span></li>'; }
    function sync() {
      var P = poseById(st.pose);
      box.querySelectorAll('.mls-chip').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-id') === st.pose); });
      box.querySelectorAll('[data-seg="cam"] button').forEach(function (b) { b.classList.toggle('on', Math.abs(angDiff(+b.getAttribute('data-v'), st.camTarget)) < 1); });
      R.yaw.value = st.yaw; R.head.value = st.head;
      $('[data-o="yaw"]').textContent = (st.yaw > 0 ? '+' : '') + Math.round(st.yaw) + '°';
      $('[data-o="head"]').textContent = (st.head > 0 ? '+' : '') + Math.round(st.head) + '°';
      $('[data-act="sil"]').classList.toggle('on', st.sil);
      syncLite();

      /* угол корпуса относительно камеры и куда смотрит лицо */
      var body = Math.abs(angDiff(st.yaw, st.camTarget));
      var face = Math.abs(angDiff(st.yaw + st.head + (S.POSES[st.pose].head ? S.POSES[st.pose].head[1] : 0) + (S.POSES[st.pose].neck ? S.POSES[st.pose].neck[1] : 0) + (S.POSES[st.pose].chest ? S.POSES[st.pose].chest[1] : 0), st.camTarget));
      var out = [];
      if (body < 12) out.push(check('warn', 'Корпус «в лоб» к камере', 'Фигура выглядит шире и плоско. Разверните модель на 25–45°.'));
      else if (body <= 60) out.push(check('ok', 'Корпус развёрнут на ' + Math.round(body) + '°', 'Ракурс 3/4 даёт объём и стройнит.'));
      else if (body <= 120) out.push(check('info', 'Корпус в профиль', 'Чёткий силуэт, но лицо и эмоции читаются хуже.'));
      else out.push(check(face < 70 ? 'ok' : 'warn', 'Корпус спиной к камере', face < 70 ? 'Лицо повёрнуто к камере — получается поза «через плечо».' : 'Лица не видно. Поверните голову к камере.'));
      out.push(P.weight ? check('ok', 'Вес на одной ноге', 'Тело расслаблено, появляется естественный изгиб.') : check('warn', 'Вес на обеих ногах', 'Поза выглядит зажатой. Перенесите вес на дальнюю от камеры ногу.'));
      out.push(P.gaps ? check('ok', 'Руки не прижаты к телу', 'Есть просветы — силуэт читается, фигура стройнее.') : check('warn', 'Руки прижаты к телу', 'Силуэт сливается в одно пятно. Отведите локти, займите руки.'));
      if (face > 100) out.push(check('warn', 'Лица не видно', 'Поверните голову или модель к камере.'));
      else if (face <= 45) out.push(check('ok', 'Лицо читается', face < 12 ? 'Взгляд в камеру — контакт со зрителем.' : 'Лицо в 3/4 — объёмно и выразительно.'));
      else out.push(check('info', 'Лицо в профиль', 'Хорошо для задумчивых и «подсмотренных» кадров.'));
      var bad = (out.join('').match(/class="(warn|bad)"/g) || []).length;
      $('.mls-checks').innerHTML = out.join('');
      var sum = $('.mls-sum');
      sum.className = 'mls-sum' + (bad ? '' : ' ok');
      sum.textContent = bad ? 'Есть что улучшить: ' + bad + '. Попробуйте кнопку «Лучший ракурс».' : '✓ Поза работает — можно снимать.';
      var badge = P.mark === 'ok' ? '<span class="mls-badge ok">так хорошо</span>' : P.mark === 'bad' ? '<span class="mls-badge bad">ошибка</span>' : '<span class="mls-badge mid">с осторожностью</span>';
      $('[data-v="about"]').innerHTML = '<h4>' + P.name + badge + '</h4><p class="mls-txt">' + P.why + '</p><ul class="mls-tips" style="margin-top:8px">' + P.tips.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>';
    }
    setPose(root.getAttribute('data-start') || 'contra', true);
    fig.extra.bodyYaw = st.yaw; fig.apply(fig.current);
    stage.invalidate();
    root.__mlsApi = { stage: stage, fig: fig, st: st, setPose: setPose, sync: sync };
  }
  S.widgets.pose = widget;
})();
