  /* =====================================================================
   *  ПАНЕЛЬ ТРЕНАЖЁРА: справка по элементу, задания, справочник
   * ===================================================================== */
  function buildSidePanel(app) {
    var S = app.S, side = app.side, tab = store('tab') || 'help';
    side.innerHTML = '<div class="mlbm-tabs"><button type="button" data-tab="help">Справка</button><button type="button" data-tab="tasks">Задания</button><button type="button" data-tab="index">Справочник</button></div>' +
      '<div class="mlbm-pane" data-pane="help"><div class="hbody"></div><dl class="live"></dl></div><div class="mlbm-pane" data-pane="tasks"></div><div class="mlbm-pane" data-pane="index"></div>';
    var panes = {}; side.querySelectorAll('[data-pane]').forEach(function (p) { panes[p.dataset.pane] = p; });
    app.taskPane = panes.tasks;
    function setTab(t) { tab = t; store('tab', t); side.querySelectorAll('[data-tab]').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === t); }); for (var k in panes) panes[k].style.display = k === t ? '' : 'none'; if (t === 'index') renderIndex(); if (t === 'tasks' && app.tasks) app.tasks.render(); }
    app.setTab = setTab;
    side.querySelector('.mlbm-tabs').onclick = function (e) { var b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); };
    var hb = panes.help.querySelector('.hbody'), live = panes.help.querySelector('.live');

    app.showHelpText = function (title, en, d, tip, sim, vals) {
      if (title == null) {
        hb.innerHTML = '<h3>Как пользоваться</h3><p class="hint">Управляйте камерой как в приложении: нажимайте на значения вверху кадра (LENS, FPS, SHUTTER, ISO, WB, TINT), кнопки справа, ⋮ по краям кадра и вкладки Media, Chat, Settings.</p>' +
          '<p class="hint">Здесь появляется объяснение каждой кнопки и настройки, которой вы коснулись. Наведите мышь — подсказка покажется без нажатия.</p>' +
          '<p class="hint">Кнопка <b>«Что это?»</b> включает режим справки: нажатия ничего не меняют, а только объясняют элемент.</p>' +
          '<p class="hint">Колёса прокручиваются перетаскиванием вверх-вниз или колёсиком мыши. Запись — красная кнопка, пробел или стрелки (как кнопки громкости).</p>';
        return;
      }
      hb.innerHTML = '<h3>' + esc(title) + '</h3>' + (en ? '<div class="en">' + esc(en) + '</div>' : '') + (d ? '<p>' + esc(d) + '</p>' : '') + (vals ? '<div class="vals">Варианты: ' + esc(vals) + '</div>' : '') + (tip ? '<div class="tip">' + esc(tip) + '</div>' : '') + (sim ? '<div class="sim">В симуляторе: ' + esc(sim) + '</div>' : '');
    };
    app.showHelpKey = function (k) { var x = HELP[k]; if (x) app.showHelpText(x.t, 'Экран Camera', x.d, x.tip); };
    app.showRowHelp = function (key) {
      var r = app.rowHelp[key]; if (!r) return;
      var vals = r.o ? r.o.map(function (o) { return o[1]; }).join(', ') : r.t === 'tog' ? 'On / Off' : '';
      if (r.k2 && r.o2) vals += '; ' + r.l2 + ': ' + r.o2.map(function (o) { return o[1]; }).join(', ');
      app.showHelpText(r.l, 'Settings → ' + r.sec, r.h, r.tip, r.sim, vals);
    };

    /* живые значения (что сейчас выставлено и что получается) */
    var lastLive = 0;
    app.sideTick = function () {
      if (tab !== 'help') return;
      var now = performance.now(); if (now - lastLive < 250) return; lastLive = now;
      var eng = app.eng, sc = eng.scene(); if (!sc) return;
      var L = lensById(S.lens), t = shutterTime(S), stops = eng.expStops || 0;
      var fe = curFps(S), angle = 360 * t * fe;
      var rows = [
        ['Условия', sc.name], ['Модуль', (L.front ? 'Front' : L.eq + ' мм') + ', ' + fmtIris({ irisMeas: 'fraction' }, L.N)],
        ['Выдержка', '1/' + Math.round(1 / t) + ' = ' + (Math.round(angle * 10) / 10) + '° при ' + fe + ' к/с'],
        ['Экспозиция', (stops >= 0 ? '+' : '') + stops.toFixed(1) + ' стоп' + (Math.abs(stops) < 0.35 ? ' — норма' : stops > 0 ? ' — светлее нормы' : ' — темнее нормы')],
        ['Пересвет', (eng.stat.clip * 100).toFixed(1) + '% кадра'], ['Мерцание ламп', eng.stat.flickerAmp > 0.02 ? 'видно (' + Math.round(eng.stat.flickerAmp * 100) + '%)' : 'нет'],
        ['Свет сцены', sc.K + ' K' + (sc.tint ? ', зелёный сдвиг' : '')], ['Осталось записи', fmtDur(app.free * 8 / (totalRate(S) * 1e6))]
      ];
      live.innerHTML = rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('');
    };

    /* справочник */
    function renderIndex() {
      var q = (panes.index.querySelector('input') || {}).value || '';
      var groups = [['Экран Camera', Object.keys(HELP).map(function (k) { return { n: HELP[k].t, k: 'h:' + k, s: HELP[k].d }; })]];
      SETTINGS.forEach(function (sec) { var items = []; sec.groups.forEach(function (g) { g.forEach(function (r) { items.push({ n: r.l, k: 'r:' + r.key, s: r.h || '' }); }); }); groups.push(['Settings → ' + sec.title, items]); });
      groups.push(['LUT', LUTS.map(function (L) { return { n: L.name, k: 'l:' + L.id, s: L.about }; })]);
      groups.push(['Условия съёмки', SCENES.map(function (s) { return { n: s.name, k: 's:' + s.id, s: s.about }; })]);
      var ql = q.toLowerCase(), html = '';
      groups.forEach(function (g) {
        var it = g[1].filter(function (x) { return !ql || (x.n + ' ' + x.s).toLowerCase().indexOf(ql) >= 0; });
        if (!it.length) return;
        html += '<h4>' + esc(g[0]) + '</h4>' + it.map(function (x) { return '<button type="button" data-k="' + x.k + '">' + esc(x.n) + '</button>'; }).join('');
      });
      var keep = panes.index.querySelector('input');
      if (!keep) { panes.index.innerHTML = '<input class="mlbm-search" type="search" placeholder="Поиск: зебра, выдержка, LUT…" aria-label="Поиск по справочнику"><div class="mlbm-gl"></div>'; keep = panes.index.querySelector('input'); keep.oninput = renderIndex; }
      panes.index.querySelector('.mlbm-gl').innerHTML = html || '<p class="hint">Ничего не найдено.</p>';
    }
    panes.index.addEventListener('click', function (e) {
      var b = e.target.closest('[data-k]'); if (!b) return;
      var k = b.dataset.k, t = k.slice(0, 1), id = k.slice(2);
      if (t === 'h') app.showHelpKey(id);
      if (t === 'r') app.showRowHelp(id);
      if (t === 'l') { var L = lutById(id); app.showHelpText(L.name, 'LUT', L.about); }
      if (t === 's') { var s = sceneById(id); app.showHelpText(s.name, 'Условия съёмки', s.about, 'Выбрать эти условия можно в списке «Условия» над телефоном.'); }
      setTab('help');
    });
    setTab(tab);
  }

  /* ---------- режим «Что это?» и подсказки при наведении ---------- */
  function bindHelp(app) {
    var scr = app.scr, btn = app.el.querySelector('.b-help'), hl = h('div', { cls: 'bm-hl' }); hl.style.display = 'none'; scr.appendChild(hl);
    function target(e) { return e.target.closest && e.target.closest('[data-hs],[data-h]'); }
    function explain(el) {
      if (!el) return;
      if (el.dataset.hs) app.showRowHelp(el.dataset.hs);
      else {
        var k = el.dataset.h;
        if (k === 'lutBtn' && el.dataset.lut) { var L = lutById(el.dataset.lut); app.showHelpText(L.name, 'LUT', L.about); return; }
        app.showHelpKey(k);
      }
    }
    function mark(el) {
      if (!el) { hl.style.display = 'none'; return; }
      var r = el.getBoundingClientRect(), s = scr.getBoundingClientRect(), k = app.scale;
      hl.style.display = ''; hl.style.left = (r.left - s.left) / k - 2 + 'px'; hl.style.top = (r.top - s.top) / k - 2 + 'px'; hl.style.width = r.width / k + 4 + 'px'; hl.style.height = r.height / k + 4 + 'px';
    }
    btn.onclick = function () {
      app.helpMode = !app.helpMode; btn.classList.toggle('on', app.helpMode); app.el.classList.toggle('helpmode', app.helpMode); mark(null);
      if (app.helpMode) { app.setTab('help'); app.showHelpText('Режим «Что это?»', 'включён', 'Нажимайте на любые кнопки, значения и пункты меню — они не сработают, а здесь появится объяснение. Чтобы снова управлять камерой, нажмите «Что это?» ещё раз.'); }
    };
    ['pointerdown', 'pointerup', 'click', 'wheel'].forEach(function (ev) {
      scr.addEventListener(ev, function (e) {
        if (!app.helpMode) return;
        var t = target(e); if (e.target.closest('.bm-nav') && ev === 'click') { /* вкладки можно переключать и в режиме справки */ var n = e.target.closest('.bm-nav'); app.go(n.dataset.nav); explain(n); mark(n); e.stopPropagation(); return; }
        if (e.target.closest('.bm-set .sec,[data-back],[data-sel],[data-page]') && ev === 'click') { /* навигация по меню тоже разрешена */ explain(t); return; }
        e.stopPropagation(); if (ev !== 'wheel') e.preventDefault();
        if (ev === 'click') { explain(t); mark(t); }
      }, true);
    });
    /* обычный режим: справка о том, чего коснулись */
    scr.addEventListener('click', function (e) { if (app.helpMode) return; var t = target(e); if (t) explain(t); });
    var hovT = null, lastHov = null;
    scr.addEventListener('pointerover', function (e) {
      if (e.pointerType !== 'mouse') return;
      var t = target(e); if (!t || t === lastHov) return;
      clearTimeout(hovT); hovT = setTimeout(function () { lastHov = t; explain(t); if (app.helpMode) mark(t); }, 280);
    });
    scr.addEventListener('pointerleave', function () { clearTimeout(hovT); lastHov = null; });
  }
