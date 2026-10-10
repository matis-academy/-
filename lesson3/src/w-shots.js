/* ---------- Тренажёр «Крупности» ---------- */
(function () {
  'use strict';
  var S = window.MLStudio, U = S.util;

  /* низ и верх кадра в плоскости героя (м), фокусное, высота камеры */
  var PLANS = [
    { id: 'xls', name: 'Сверхобщий', sub: 'человек в пейзаже', b: -2.2, t: 8, f: 24, h: 2.0,
      what: 'Пространство главнее человека: герой — маленькая фигура в большом мире.',
      use: 'Начало сцены, смена места действия, ощущение масштаба или одиночества.', feel: 'Эпично, отстранённо.' },
    { id: 'ls', name: 'Общий', sub: 'в полный рост', b: -0.18, t: 1.9, f: 35, h: 1.45,
      what: 'Герой виден целиком, с запасом сверху и снизу. Читаются поза, одежда и место.',
      use: 'Показать, кто и где находится; действие всем телом: идёт, танцует, работает.', feel: 'Нейтрально, информативно.' },
    { id: 'mls', name: 'Средне-общий', sub: 'по колено', b: 0.6, t: 1.82, f: 50, h: 1.45,
      what: 'Кадр от середины бедра или чуть выше колена. Видны жесты и часть окружения.',
      use: 'Диалоги в движении, герой с предметом в руках, вестерны («американский план»).', feel: 'Динамично, по-киношному.' },
    { id: 'ms', name: 'Средний', sub: 'по пояс', b: 0.93, t: 1.78, f: 50, h: 1.45,
      what: 'Кадр по пояс. Хорошо читаются жесты рук и мимика.',
      use: 'Интервью, разговоры, ведущий в кадре — самый ходовой план видео.', feel: 'Естественно, как в живом разговоре.' },
    { id: 'mcu', name: 'Средне-крупный', sub: 'по грудь', b: 1.15, t: 1.74, f: 50, h: 1.5,
      what: 'Кадр по грудь. Внимание смещается на лицо, но жесты ещё видны.',
      use: 'Интервью и эмоциональные моменты разговора.', feel: 'Ближе, доверительно.' },
    { id: 'cu', name: 'Крупный', sub: 'лицо и плечи', b: 1.3, t: 1.73, f: 85, h: 1.55,
      what: 'Лицо крупно, чуть видны плечи. Макушку можно немного срезать.',
      use: 'Эмоции, реакции, важные слова.', feel: 'Интимно, сильная эмоция.' },
    { id: 'ecu', name: 'Сверхкрупный', sub: 'деталь: глаза', b: 1.49, t: 1.61, f: 100, h: 1.55,
      what: 'Деталь — глаза, губы, руки. Остальное за кадром.',
      use: 'Акцент, напряжение, детали, которые важны для истории.', feel: 'Очень сильно, напряжённо.' }
  ];

  function widget(root) {
    var u = U.el, T = S.three();
    var box = u('div', 'mls');
    box.innerHTML =
      '<div class="mls-sun-grid">' +
        '<div class="mls-view"><div class="ov"><div class="mls-tag" style="left:2.5%;top:4%" data-v="lbl"></div><div class="mls-tag" style="right:2.5%;top:4%" data-v="lens"></div>' +
          '<div class="mls-tag" style="left:2.5%;bottom:4%;top:auto;display:none;background:rgba(200,40,30,.85)" data-v="warn"></div></div></div>' +
        '<div class="mls-card mls-map"><h4>Где проходит край кадра</h4><svg viewBox="0 0 300 330" class="mls-svg" style="cursor:default" data-v="svg"></svg>' +
          '<p class="mls-note" style="margin-top:4px">Красные линии — суставы. Резать по ним нельзя: кажется, что человеку «отрезали» ноги или руки.</p></div>' +
      '</div>' +
      '<div class="mls-chips" style="grid-template-columns:repeat(7,minmax(0,1fr))"></div>' +
      '<div class="mls-card" style="margin-top:12px"><label class="mls-ctl"><span class="hd"><b>Плавно меняйте крупность</b><output data-o="s"></output></span>' +
        '<input type="range" min="0" max="600" step="1" data-r="s" aria-label="Крупность"><span class="hint">Следите, где окажется нижний край кадра.</span></label></div>' +
      '<div class="mls-row2"><div class="mls-card" data-v="about"></div><div class="mls-card"><h4>Правила крупностей</h4><ul class="mls-tips">' +
        '<li>Меняйте крупность при монтажной склейке хотя бы на один шаг — иначе получится «скачок».</li>' +
        '<li>Чем ближе план, тем короче он может быть в монтаже.</li>' +
        '<li>Не режьте по суставам: щиколотки, колени, локти, запястья, шея.</li>' +
        '<li>На крупном плане можно срезать макушку, но не подбородок.</li></ul></div></div>';
    root.appendChild(box);
    if (!document.getElementById('mls-sun-css')) {
      var st0 = document.createElement('style'); st0.id = 'mls-sun-css';
      st0.textContent = '.mls-sun-grid{display:grid;grid-template-columns:minmax(0,1.9fr) minmax(0,1fr);gap:12px;align-items:start}' +
        '@media (max-width:820px){.mls-sun-grid{grid-template-columns:minmax(0,1fr)}}' +
        '.mls-svg{width:100%;max-width:300px;display:block;margin:0 auto 6px;touch-action:none;cursor:grab}' +
        '.mls-svg text{font:600 11px system-ui,sans-serif;fill:#c9c6c0}';
      document.head.appendChild(st0);
    }
    var st1 = document.getElementById('mls-shots-css');
    if (!st1) {
      st1 = document.createElement('style'); st1.id = 'mls-shots-css';
      st1.textContent = '@media (max-width:640px){.mls-shots-chips{grid-template-columns:repeat(4,minmax(0,1fr))!important}}';
      document.head.appendChild(st1);
    }
    var $ = function (s) { return box.querySelector(s); };
    $('.mls-chips').classList.add('mls-shots-chips');
    var view = $('.mls-view');
    var stage = new S.Stage(view);
    stage.setSun(60, 30); stage.setDaylight(30);
    S.buildPiazza(stage);
    var fig = new S.Figure(); stage.scene.add(fig.root);
    fig.setPose(S.POSES.contra, true); fig.extra.bodyYaw = 18; fig.extra.headYaw = -10; fig.apply(fig.current);

    var st = { s: 300, target: 300 };
    function planAt(s) {
      var i = Math.min(5, Math.floor(s / 100)), k = U.smooth(s / 100 - i), A = PLANS[i], B = PLANS[i + 1];
      var spanA = A.t - A.b, spanB = B.t - B.b, span = Math.exp(U.lerp(Math.log(spanA), Math.log(spanB), k));
      var midA = (A.t + A.b) / 2, midB = (B.t + B.b) / 2, w = (span - spanB) / ((spanA - spanB) || 1);
      return { b: 0, mid: U.lerp(midB, midA, U.clamp(w, 0, 1)), span: span, f: U.lerp(A.f, B.f, k), h: U.lerp(A.h, B.h, k) };
    }
    function place() {
      var p = planAt(st.s), cam = stage.camera;
      stage.setFocal(p.f);
      var vf = cam.fov * U.D2R, d = p.span / (2 * Math.tan(vf / 2));
      cam.position.set(Math.sin(0.12) * d, p.h, Math.cos(0.12) * d);
      cam.lookAt(0, p.mid, 0); cam.updateMatrixWorld();
      $('[data-v="lens"]').textContent = Math.round(p.f) + ' мм · ' + (d < 10 ? d.toFixed(1).replace('.', ',') : Math.round(d)) + ' м';
      return p;
    }
    stage.animate(function (dt) {
      var dS = st.target - st.s;
      if (Math.abs(dS) < 0.3) { if (st.s !== st.target) { st.s = st.target; place(); analyse(); } return false; }
      st.s += dS * (1 - Math.pow(0.002, dt));
      place(); analyse(true);
      return true;
    });

    /* схема тела с краями кадра */
    var svg = $('[data-v="svg"]'), NS = 'http://www.w3.org/2000/svg';
    function sv(tag, at, par) { var e = document.createElementNS(NS, tag); for (var k in at) e.setAttribute(k, at[k]); (par || svg).appendChild(e); return e; }
    var HY = function (y) { return 312 - y * 165; }; /* 1 м = 165 px, земля на 312 */
    svg.innerHTML = '';
    sv('rect', { x: 0, y: 0, width: 300, height: 330, rx: 14, fill: '#15171a' });
    var body = sv('g', {});
    /* силуэт человека (вид спереди) */
    function bodyPart(x, y0, y1, w, col) { sv('rect', { x: 150 + x - w / 2, y: HY(y1), width: w, height: HY(y0) - HY(y1), rx: Math.min(w / 2, 10), fill: col }, body); }
    var SK = '#e2b196', DR = '#b8433a', HR = '#4a2a1b';
    sv('path', { d: 'M128 ' + HY(1.6) + ' Q124 ' + HY(1.38) + ' 132 ' + HY(1.26) + ' L168 ' + HY(1.26) + ' Q176 ' + HY(1.38) + ' 172 ' + HY(1.6) + 'Z', fill: HR }, body);
    bodyPart(-10, 0.04, 0.52, 13, SK); bodyPart(10, 0.04, 0.52, 13, SK);
    bodyPart(-30, 0.87, 1.38, 9, SK); bodyPart(30, 0.87, 1.38, 9, SK);
    sv('ellipse', { cx: 120, cy: HY(0.85), rx: 5, ry: 8, fill: SK }, body); sv('ellipse', { cx: 180, cy: HY(0.85), rx: 5, ry: 8, fill: SK }, body);
    sv('path', { d: 'M132 ' + HY(1.03) + ' L168 ' + HY(1.03) + ' L193 ' + HY(0.48) + ' Q181 ' + HY(0.455) + ' 171 ' + HY(0.48) + ' Q160 ' + HY(0.455) + ' 150 ' + HY(0.48) + ' Q140 ' + HY(0.455) + ' 129 ' + HY(0.48) + ' Q119 ' + HY(0.455) + ' 107 ' + HY(0.48) + 'Z', fill: DR }, body);
    sv('path', { d: 'M126 ' + HY(1.31) + ' Q150 ' + HY(1.29) + ' 174 ' + HY(1.31) + ' L168 ' + HY(1.02) + ' L132 ' + HY(1.02) + 'Z', fill: DR }, body);
    sv('path', { d: 'M126 ' + HY(1.31) + ' Q150 ' + HY(1.29) + ' 174 ' + HY(1.31) + ' Q178 ' + HY(1.38) + ' 170 ' + HY(1.39) + ' L130 ' + HY(1.39) + ' Q122 ' + HY(1.38) + ' 126 ' + HY(1.31) + 'Z', fill: SK }, body);
    sv('rect', { x: 130, y: HY(1.033), width: 40, height: 3, fill: '#d8b25a' }, body);
    bodyPart(0, 1.37, 1.46, 10, SK);
    sv('ellipse', { cx: 150, cy: HY(1.545), rx: 13, ry: 17, fill: SK }, body);
    sv('path', { d: 'M136 ' + HY(1.5) + ' Q134 ' + HY(1.68) + ' 150 ' + HY(1.67) + ' Q166 ' + HY(1.68) + ' 164 ' + HY(1.5) + ' Q160 ' + HY(1.62) + ' 150 ' + HY(1.62) + ' Q140 ' + HY(1.62) + ' 136 ' + HY(1.5) + 'Z', fill: HR }, body);
    sv('rect', { x: 132, y: HY(0.04) - 5, width: 15, height: 6, rx: 3, fill: '#c49a6c' }, body);
    sv('rect', { x: 153, y: HY(0.04) - 5, width: 15, height: 6, rx: 3, fill: '#c49a6c' }, body);
    var JOINTS = [[0.08, 'щиколотки'], [0.47, 'колени'], [0.87, 'запястья'], [1.1, 'локти'], [1.43, 'подбородок / шея']];
    JOINTS.forEach(function (j) {
      sv('line', { x1: 96, y1: HY(j[0]), x2: 204, y2: HY(j[0]), stroke: '#ff5d52', 'stroke-width': 1.5, 'stroke-dasharray': '4 4' });
      var t = sv('text', { x: 210, y: HY(j[0]) + 4 }); t.textContent = j[1]; t.setAttribute('style', 'fill:#ff8d84');
    });
    var shadeTop = sv('rect', { x: 0, y: 0, width: 300, height: 0, fill: 'rgba(10,11,13,.78)' });
    var shadeBot = sv('rect', { x: 0, y: 0, width: 300, height: 0, fill: 'rgba(10,11,13,.78)' });
    var frameR = sv('rect', { x: 60, y: 0, width: 180, height: 0, fill: 'none', stroke: '#fd7e2f', 'stroke-width': 3, rx: 4 });
    var smallNote = sv('text', { x: 150, y: 24, 'text-anchor': 'middle' });

    /* где край кадра пересекает плоскость героя */
    var ray = new T.Raycaster(), plane = new T.Plane(new T.Vector3(0, 0, 1), 0), hit = new T.Vector3();
    function edgeY(ndcY) {
      ray.setFromCamera({ x: 0, y: ndcY }, stage.camera);
      var n = new T.Vector3(); stage.camera.getWorldDirection(n); n.y = 0; n.normalize(); plane.normal.copy(n).negate(); plane.constant = 0;
      return ray.ray.intersectPlane(plane, hit) ? hit.y : null;
    }
    function nearest() { return Math.round(st.s / 100); }
    function analyse(light) {
      var bot = edgeY(-1), top = edgeY(1);
      if (bot == null || top == null) return;
      var yT = HY(Math.min(top, 1.88)), yB = HY(Math.max(bot, -0.1));
      shadeTop.setAttribute('height', Math.max(0, yT));
      shadeBot.setAttribute('y', Math.min(330, yB)); shadeBot.setAttribute('height', Math.max(0, 330 - yB));
      frameR.setAttribute('y', yT); frameR.setAttribute('height', Math.max(2, yB - yT));
      var big = top - bot > 4;
      smallNote.textContent = big ? 'человек занимает ' + Math.round(1.66 / (top - bot) * 100) + '% высоты кадра' : '';
      /* суставы у нижнего края */
      var P = fig.points(), cut = null;
      [[P.ankle, 'щиколотки'], [P.knee, 'колени'], [P.wrist, 'запястья'], [P.elbow, 'локти'], [P.chin, 'подбородок']].forEach(function (j) {
        if (cut) return;
        var p = stage.projectPx(j[0]);
        if (Math.abs(p.y - 1) < 0.035) cut = j[1];
      });
      var w = $('[data-v="warn"]');
      w.style.display = cut ? 'block' : 'none';
      w.textContent = cut ? '✂ Край кадра режет ' + cut : '';
      var n = nearest(), Pl = PLANS[n];
      $('[data-v="lbl"]').textContent = Pl.name + ' план';
      $('[data-o="s"]').textContent = Pl.name.toLowerCase();
      box.querySelectorAll('.mls-chip').forEach(function (b, i) { b.classList.toggle('on', i === n); });
      if (light) return;
      $('[data-r="s"]').value = Math.round(st.target);
      $('[data-v="about"]').innerHTML = '<h4>' + Pl.name + ' план <span style="font-weight:500;color:var(--mut)">· ' + Pl.sub + '</span></h4>' +
        '<p class="mls-txt">' + Pl.what + '</p><div class="mls-facts" style="margin-top:10px"><div><span>Для чего</span>' + Pl.use + '</div><div><span>Ощущение</span>' + Pl.feel + '</div></div>' +
        (cut ? '<p class="mls-txt" style="color:#ff8d84"><b>Сейчас край кадра режет ' + cut + '.</b> Сделайте план чуть крупнее или чуть общее.</p>' : '');
    }

    var chips = $('.mls-chips');
    chips.innerHTML = PLANS.map(function (p, i) { return '<button type="button" class="mls-chip" data-i="' + i + '"><span class="nm">' + p.name + '</span><span class="sb">' + p.sub + '</span></button>'; }).join('');
    chips.addEventListener('click', function (e) { var b = e.target.closest('.mls-chip'); if (!b) return; st.target = +b.getAttribute('data-i') * 100; stage.invalidate(); });
    $('[data-r="s"]').addEventListener('input', function () { st.target = +this.value; stage.invalidate(); });
    place(); analyse();
    root.__mlsApi = { stage: stage, st: st, fig: fig, place: place, analyse: analyse };
    S.attachModel(root, stage, fig, function (m) { fig = m; root.__mlsApi.fig = m; place(); analyse(); });
  }
  S.widgets.shots = widget;
})();
