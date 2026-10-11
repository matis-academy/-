  /* =====================================================================
   *  ЗАДАНИЯ: условия съёмки + цели, проверка «вживую» и по записанному дублю
   * ===================================================================== */
  function angleOf(m) { return 360 * m.t * (m.offSpeed ? m.offFps : m.fps); }
  function near(v, list, tol) { for (var i = 0; i < list.length; i++) if (Math.abs(v - list[i]) <= (tol || 0.01)) return true; return false; }
  var TASKS = [
    { id: 'rule180', title: 'Правило 180°', scene: 'overcast', level: 'база',
      brief: 'Снимите пасмурную улицу «как в кино»: 24 или 25 кадров в секунду и выдержка по правилу 180° — вдвое короче кадра. Экспозиция — без пересвета и провала.',
      goals: [
        { t: 'FPS 24, 25 или 23.98', c: function (m) { return !m.offSpeed && near(m.fps, [23.98, 24, 25]); }, why: 'Нажмите FPS вверху и выберите 24 или 25.' },
        { t: 'Выдержка ручная (без «A»)', c: function (m) { return !m.shAuto; }, why: 'В автоматическом режиме выдержка «плавает». Выберите значение в колесе SHUTTER.' },
        { t: 'Угол затвора ≈ 180° (1/48 или 1/50)', c: function (m) { var a = angleOf(m); return a >= 160 && a <= 200; }, why: 'При 25 к/с — 1/50, при 24 к/с — 1/48 или 1/50.' },
        { t: 'Экспозиция в норме (±0,7 стопа)', c: function (m) { return Math.abs(m.stops) <= 0.7; }, why: 'Подстройте яркость через ISO, не трогая выдержку. Смотрите гистограмму и строку «Экспозиция» в справке.' },
        { t: 'Дубль не короче 2 секунд', c: function (m, clip) { return !clip || clip.dur >= 2; }, why: 'Держите запись хотя бы 2 секунды.' }
      ],
      tips: ['ISO — главный способ менять яркость на iPhone: диафрагма фиксированная.', 'Правило 180° даёт привычный «киношный» смаз движения бегуна.'] },
    { id: 'sun', title: 'Солнце без пересветов', scene: 'day', level: 'база',
      brief: 'Яркий солнечный день (≈ EV 15). Нужно убрать пересветы: включите зебру и добейтесь, чтобы штриховка почти исчезла. Баланс белого — дневной.',
      goals: [
        { t: 'ISO ручное и минимальное (≤ 80)', c: function (m) { return !m.isoAuto && m.iso <= 80; }, why: 'Откройте ISO и выберите наименьшее значение на шкале.' },
        { t: 'Зебра включена', c: function (m) { return m.zebra; }, why: 'Иконка-рамка справа → Zebra → ON.' },
        { t: 'Пересвет меньше 2 % кадра', c: function (m) { return m.clip < 0.02; }, why: 'Укоротите выдержку (1/400…1/1000), пока зебра не исчезнет с лица и машины.' },
        { t: 'WB ручной, 5000–6000 K', c: function (m) { return !m.wbAuto && m.wbK >= 5000 && m.wbK <= 6000; }, why: 'В колесе WB выберите иконку солнца (Daylight 5600K).' }
      ],
      tips: ['Без ND-фильтра на солнце 180° не получится: свет слишком яркий. Профессионалы ставят ND-фильтр на телефон, чтобы снимать с 1/50.', 'Короткая выдержка даёт «дёрганое» движение — посмотрите на бегуна.'] },
    { id: 'tungsten', title: 'Лампы накаливания', scene: 'tungsten', level: 'база',
      brief: 'Вечер в комнате с тёплыми лампами. Уберите жёлтый оттенок балансом белого и выберите выдержку, при которой не будет мерцания (сеть 50 Гц).',
      goals: [
        { t: 'WB ручной, 2800–3500 K', c: function (m) { return !m.wbAuto && m.wbK >= 2800 && m.wbK <= 3500; }, why: 'В колесе WB выберите лампочку (Incandescent 3200K) или подберите на шкале.' },
        { t: 'Нет мерцания ламп', c: function (m) { return m.flicker < 0.02; }, why: 'Под лампами в сети 50 Гц используйте 1/50 или 1/100 — они в колонке справа в колесе SHUTTER.' },
        { t: 'ISO не выше 1600', c: function (m) { return m.iso <= 1600; }, why: 'Чем выше ISO, тем больше шума. Здесь хватает 400–1250.' },
        { t: 'Экспозиция в норме (±1 стоп)', c: function (m) { return Math.abs(m.stops) <= 1; }, why: 'Подберите ISO.' }
      ],
      tips: ['Полосы бегут по кадру, когда выдержка не кратна 1/100 с — именно так мерцают лампы в сети 50 Гц.'] },
    { id: 'office', title: 'Офис: LED-лампы', scene: 'office', level: 'средний',
      brief: 'Дешёвые светодиодные панели сильно мерцают и дают зелёный оттенок. Уберите полосы и зелень.',
      goals: [
        { t: 'Нет мерцания', c: function (m) { return m.flicker < 0.02; }, why: 'Выдержка 1/50 или 1/100 (Flicker Free Shutter Based On = 50Hz).' },
        { t: 'WB ручной, 3700–4500 K', c: function (m) { return !m.wbAuto && m.wbK >= 3700 && m.wbK <= 4500; }, why: 'Попробуйте пресет Fluorescent (4000K).' },
        { t: 'TINT ручной, убрана зелень (+10…+26)', c: function (m) { return !m.tintAuto && m.tint >= 10 && m.tint <= 26; }, why: 'Откройте TINT и сдвиньте в плюс (к пурпурному).' },
        { t: 'Экспозиция в норме (±0,7 стопа)', c: function (m) { return Math.abs(m.stops) <= 0.7; }, why: 'Подберите ISO.' }
      ],
      tips: ['TINT компенсирует зелёный/пурпурный сдвиг, который не исправить одной цветовой температурой.'] },
    { id: 'night', title: 'Ночная улица', scene: 'night', level: 'средний',
      brief: 'Света очень мало. Выберите модуль, который лучше всего видит в темноте, и найдите баланс между яркостью и шумом.',
      goals: [
        { t: 'Основной модуль 24 мм', c: function (m) { return m.lens === '24 mm'; }, why: 'У 24 мм самая светосильная диафрагма f/1.78 и самый большой сенсор. 13 и 120 мм в темноте шумят сильнее.' },
        { t: 'Выдержка ручная, не длиннее 1/(2×FPS)', c: function (m) { return !m.shAuto && angleOf(m) <= 200; }, why: 'Длинная выдержка смазывает движение. Держите ≈180°.' },
        { t: 'ISO не выше 3200', c: function (m) { return m.iso <= 3200; }, why: 'Выше 3200 шум съедает детали.' },
        { t: 'Кадр не слишком тёмный (не ниже −1,5 стопа)', c: function (m) { return m.stops >= -1.5 && m.stops <= 0.7; }, why: 'Поднимите ISO. Ночная картинка может быть темнее «нормы», но не чёрной.' }
      ],
      tips: ['Тёмная ночь — это нормально: не пытайтесь сделать из неё день, иначе шум будет огромным.'] },
    { id: 'slowmo', title: 'Замедление бегуна', scene: 'day', level: 'средний',
      brief: 'Снимите бегуна для плавного замедления: проект 24/25 к/с, съёмка 100 или 120 к/с (OFF/SPEED), короткая выдержка.',
      goals: [
        { t: 'Разрешение HD', c: function (m) { return m.resolution === 'hd'; }, why: '100 и 120 к/с доступны только в HD: Settings → Record → Resolution → HD.' },
        { t: 'OFF/SPEED включён, 100 или 120 к/с', c: function (m) { return m.offSpeed && m.offFps >= 100; }, why: 'Откройте FPS → OFF/SPEED → выберите 100 или 120.' },
        { t: 'Проект 24 или 25 к/с', c: function (m) { return near(m.fps, [23.98, 24, 25]); }, why: 'Выключите OFF/SPEED, выберите 24 или 25, затем включите OFF/SPEED снова.' },
        { t: 'Выдержка не длиннее 1/200', c: function (m) { return m.t <= 1 / 195; }, why: 'При 100–120 к/с правило 180° даёт 1/200–1/240.' }
      ],
      tips: ['Замедление = частота съёмки ÷ частота проекта. 120 ÷ 24 = в 5 раз медленнее.', 'Посмотрите записанный дубль во вкладке Media — он воспроизводится замедленно.'] },
    { id: 'interview', title: 'Интервью у окна', scene: 'window', level: 'средний',
      brief: 'Средний план человека у окна. Фокус — вручную на лице, экспозиция по коже, в слейте — интерьер.',
      goals: [
        { t: 'Объектив 48 мм (2x)', c: function (m) { return m.lens === '48 mm'; }, why: '48 мм — классическое «портретное» поле зрения без искажений лица.' },
        { t: 'Фокус ручной и на лице', c: function (m) { return !m.afAuto && Math.abs(m.focusD - 1 / m.faceDepth) < 0.15; }, why: 'Выключите AUTO в колесе фокуса и наведитесь на лицо (≈ 0.950). Включите Focus Assist, чтобы проверить.' },
        { t: 'Лицо проэкспонировано правильно', c: function (m) { return m.faceIre >= 0.42 && m.faceIre <= 0.72; }, why: 'Включите False Color: светлая кожа должна стать розовой (MG+1) или зелёной (18% MG).' },
        { t: 'В слейте отмечено Interior', c: function (m) { return m.interior; }, why: '⋮ слева → Slate → Interior.' },
        { t: 'Звук записывается', c: function (m) { return m.audioSrc !== 'none'; }, why: 'Settings → Audio → Audio Source → iPhone Microphone.' }
      ],
      tips: ['False Color точнее гистограммы: он показывает, какая именно часть кадра в какой яркости.'] },
    { id: 'reels', title: 'Вертикаль для Reels', scene: 'overcast', level: 'база',
      brief: 'Снимаете горизонтально, а публиковать будете в Reels/TikTok. Включите рамку 9:16 и подберите настройки для соцсетей.',
      goals: [
        { t: 'Рамка кадра 9:16 включена', c: function (m) { return m.fg && m.fgRatio === '9:16'; }, why: 'Иконка-рамка справа → Frame Guide → 9:16 → ON.' },
        { t: 'FPS 25 или 30', c: function (m) { return !m.offSpeed && near(m.fps, [25, 29.97, 30]); }, why: 'Соцсети чаще всего показывают 25/30 к/с.' },
        { t: 'Кодек HEVC (H.265)', c: function (m) { return m.codec === 'hevc'; }, why: 'Settings → Record → Codec → HEVC: файлы в разы меньше ProRes.' },
        { t: 'Стабилизация включена', c: function (m) { return m.stab !== 'off'; }, why: 'Нижняя иконка справа → Standard или Cinematic.' }
      ],
      tips: ['Рамка не обрезает запись — она лишь показывает, что останется после кадрирования в вертикаль.'] },
    { id: 'sunset', title: 'Золотой час', scene: 'sunset', level: 'средний',
      brief: 'Закат должен остаться тёплым и золотым. Автоматический баланс белого «съедает» атмосферу — поставьте его вручную. Не пересветите небо.',
      goals: [
        { t: 'WB ручной, не ниже 5000 K', c: function (m) { return !m.wbAuto && m.wbK >= 5000; }, why: 'Поставьте Daylight (5600K) — закат останется оранжевым.' },
        { t: 'Пересвет меньше 5 % кадра', c: function (m) { return m.clip < 0.05; }, why: 'Солнце может пересвечиваться, но небо — нет. Включите зебру и уменьшите экспозицию.' },
        { t: 'Экспозиция −1…+0,5 стопа', c: function (m) { return m.stops >= -1 && m.stops <= 0.5; }, why: 'На закате лучше слегка недоэкспонировать, чем потерять цвет неба.' }
      ],
      tips: ['Попробуйте AUTO баланс и сравните: закат станет почти серым.'] },
    { id: 'log', title: 'Apple Log под цветокоррекцию', scene: 'window', level: 'продвинутый',
      brief: 'Снимите материал для цветокоррекции в DaVinci Resolve: Apple Log, ProRes, LUT только на экране.',
      goals: [
        { t: 'Color Space: Apple Log', c: function (m) { return m.colorspace === 'applelog'; }, why: 'Settings → Record → Color Space → Apple Log - HDR.' },
        { t: 'Кодек ProRes 422 HQ или 422', c: function (m) { return m.codec === 'prores422hq' || m.codec === 'prores422'; }, why: 'Settings → Record → Codec.' },
        { t: 'LUT включён на экране, но не вшит', c: function (m) { return m.lutOn && !m.recLut; }, why: 'Кнопка LUT → ON → Rec 709 Neutral; кнопка внизу панели (Record LUT to Clip) — выключена.' },
        { t: 'Без пропуска кадров', c: function (m) { return !m.dropped; }, why: 'ProRes 4K выше 30 к/с требует внешнего SSD. Снимайте 24/25/30 к/с или выберите Pro Video Storage.' },
        { t: 'Пересвет меньше 1 %', c: function (m) { return m.clip < 0.01; }, why: 'Log сохраняет света, но пересвет не исправить и в Resolve.' }
      ],
      tips: ['В Log картинка без LUT серая — так и должно быть. Цвет «вытягивают» на цветокоррекции.'] }
  ];

  function buildTasks(app) {
    var S = app.S, pane = app.taskPane, done = store('tasksDone') || {}, active = null, result = null, showTips = false, liveT = 0;
    var CAM_KEYS = ['lens', 'zoom', 'fps', 'offSpeed', 'offFps', 'shAuto', 'shDen', 'shAngle', 'shLock', 'isoAuto', 'iso', 'isoLock', 'wbAuto', 'wbK', 'wbLock', 'tintAuto', 'tint', 'tintLock', 'afAuto', 'focus', 'ev', 'lutOn', 'recLut', 'zebra', 'fa', 'fg', 'falseColor', 'safe', 'grid', 'torch', 'stab', 'codec', 'bitrate', 'resolution', 'colorspace', 'interior', 'audioSrc', 'saveTo'];
    function start(t) {
      var d = defaults(); CAM_KEYS.forEach(function (k) { S[k] = d[k]; });
      S.colorspace = 'rec709';
      active = t; result = null; showTips = false;
      app.setScene(t.scene); app.eng.dirty = true; app.go('camera'); app.closeDial(); app.save();
      render();
    }
    function evalGoals(m, clip) { return active.goals.map(function (g) { var ok = false; try { ok = !!g.c(m, clip); } catch (e) {} return { g: g, ok: ok }; }); }
    function render() {
      if (!active) {
        pane.innerHTML = '<p class="hint">Каждое задание задаёт условия съёмки и цель. Настройте камеру, запишите дубль красной кнопкой — тренажёр проверит его и объяснит ошибки.</p>' +
          TASKS.map(function (t) { return '<button type="button" class="mlbm-task' + (done[t.id] ? ' done' : '') + '" data-t="' + t.id + '"><div class="tn">' + esc(t.title) + '<i>' + t.level + '</i></div><div class="td">' + esc(sceneById(t.scene).name) + '</div></button>'; }).join('') +
          '<div class="mlbm-foot">Выполнено: ' + Object.keys(done).filter(function (k) { return done[k]; }).length + ' из ' + TASKS.length + '. Прогресс хранится в этом браузере.</div>';
        return;
      }
      var t = active, html = '<h3>' + esc(t.title) + '</h3><div class="en">Условия: ' + esc(sceneById(t.scene).name) + '</div><p>' + esc(t.brief) + '</p>';
      if (result) {
        var okN = result.res.filter(function (r) { return r.ok; }).length, all = okN === result.res.length;
        html += '<div class="mlbm-score' + (all ? ' ok' : '') + '">' + (all ? 'Задание выполнено!' : 'Дубль: ' + okN + ' из ' + result.res.length) + '</div><div class="en">' + esc(result.clip.name) + ' · ' + fmtClipDur(result.clip.dur) + '</div>' +
          '<ul class="mlbm-chk">' + result.res.map(function (r) { return '<li class="' + (r.ok ? 'ok' : 'bad') + '"><b>' + (r.ok ? '✓' : '✗') + '</b><span>' + esc(r.g.t) + (r.ok ? '' : '<small>' + esc(r.g.why) + '</small>') + '</span></li>'; }).join('') + '</ul>';
        html += '<div class="mlbm-act"><button type="button" class="pri" data-a="again">Снять ещё дубль</button><button type="button" data-a="list">Все задания</button></div>';
      } else {
        html += '<div class="en" style="margin-top:6px">Цели (обновляются по мере настройки):</div><ul class="mlbm-chk live-goals"></ul>' +
          '<div class="mlbm-act"><button type="button" class="pri" data-a="rec">' + (S.recording ? 'Остановить запись' : 'Записать дубль') + '</button><button type="button" data-a="tips">' + (showTips ? 'Скрыть подсказки' : 'Подсказки') + '</button><button type="button" data-a="restart">Сначала</button><button type="button" data-a="list">Все задания</button></div>';
        if (showTips) html += t.tips.map(function (x) { return '<div class="tip">' + esc(x) + '</div>'; }).join('');
      }
      pane.innerHTML = html;
      liveT = 0; tick();
    }
    function tick() {
      if (!active || result || !app.metaNow) return;
      var now = performance.now(); if (now - liveT < 300) return; liveT = now;
      var ul = pane.querySelector('.live-goals'); if (!ul) return;
      var res = evalGoals(app.metaNow(), null);
      ul.innerHTML = res.map(function (r) { return '<li class="' + (r.ok ? 'ok' : 'wait') + '"><b>' + (r.ok ? '✓' : '○') + '</b><span>' + esc(r.g.t) + '</span></li>'; }).join('');
      var rb = pane.querySelector('[data-a="rec"]'); if (rb) rb.textContent = S.recording ? 'Остановить запись' : 'Записать дубль';
    }
    pane.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.t) { start(TASKS.filter(function (t) { return t.id === b.dataset.t; })[0]); return; }
      var a = b.dataset.a;
      if (a === 'list') { active = null; result = null; render(); }
      if (a === 'again') { result = null; render(); }
      if (a === 'tips') { showTips = !showTips; render(); }
      if (a === 'restart') start(active);
      if (a === 'rec') { app.go('camera'); app.toggleRec(); render(); }
    });
    app.tasks = {
      render: render, tick: tick,
      onRecStart: function () { if (active && !result) render(); },
      onClip: function (clip) {
        if (!active) return;
        if (S.scene !== active.scene) { app.toast('Дубль снят не в условиях задания — выберите «' + sceneById(active.scene).name + '».', true); return; }
        result = { clip: clip, res: evalGoals(clip.meta, clip) };
        if (result.res.every(function (r) { return r.ok; })) { done[active.id] = true; store('tasksDone', done); }
        app.setTab('tasks'); render();
      }
    };
    render();
  }
