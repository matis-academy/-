  /* =====================================================================
   *  ВКЛАДКИ MEDIA и CHAT
   * ===================================================================== */
  function buildMedia(app) {
    var S = app.S, mv = app.views.media, cv = app.views.chat, sortAsc = false, player = null;
    function renderMedia() {
      stopPlayer();
      var clips = app.clips.slice(); if (!sortAsc) clips.reverse();
      mv.innerHTML = '<div class="mh"><button type="button" data-h="navMedia" title="Проекты">' + IC.sidebar + '</button><span class="t">' + (S.cloudLogged ? 'Курс: Мобильная съёмка' : 'No project selected') + ' - All Clips</span>' +
        '<button type="button" data-h="navMedia" title="Фильтр">' + IC.filterI + '</button><button type="button" data-h="navMedia" title="Выбрать клипы">' + IC.selectI + '</button><button type="button" data-sort="1" data-h="navMedia" title="Сортировка">' + IC.sortI + '</button><button type="button" data-h="navMedia" title="Облако">' + IC.cloud + '</button></div>' +
        (clips.length ? '<div class="grid">' + clips.map(function (c) {
          return '<button type="button" class="bm-clip" data-clip="' + c.id + '" data-h="navMedia"><div class="th"><img alt="" src="' + c.thumb + '"><span>' + fmtClipDur(c.dur) + '</span>' + (c.good ? '<em>GOOD</em>' : '') + '</div><div class="nm">' + esc(c.name) + '</div></button>';
        }).join('') + '</div>' : '<div class="empty">Клипов пока нет.<br>Вернитесь во вкладку Camera и нажмите красную кнопку записи.</div>');
    }
    function metaRows(c) {
      var m = c.meta, rows = [
        ['Условия', m.sceneName], ['Объектив', m.lens + (m.zoom && m.zoom % 1 ? ' · ' + m.zoom + 'x' : '')], ['FPS', m.offSpeed ? m.offFps + ' (off speed → ' + m.fps + ')' : m.fps + (m.timelapse ? ' · timelapse' : '')],
        ['Выдержка', m.shutter + (m.shAuto ? ' (A)' : '')], ['ISO', m.iso + (m.isoAuto ? ' (A)' : '')], ['WB / Tint', m.wbK + 'K' + (m.wbAuto ? ' (A)' : '') + ' / ' + m.tint],
        ['Фокус', m.focus.toFixed(3) + (m.afAuto ? ' (AF)' : '')], ['Кодек', m.codecName], ['Разрешение', { '4k': '3840×2160', hd: '1920×1080', '720p': '1280×720', opengate: '1920×1440 Open Gate' }[m.resolution]],
        ['Цвет', { rec709: 'Rec.709', rec2020: 'Rec.2020 - HDR', p3: 'P3 D65', applelog: 'Apple Log - HDR' }[m.colorspace] + (m.recLut ? ' + LUT ' + lutById(m.lut).name + ' (вшит)' : m.lutOn ? ' (LUT ' + lutById(m.lut).name + ' только на экране)' : '')],
        ['Стабилизация', m.stab], ['Звук', m.audioSrc === 'none' ? 'нет' : 'iPhone Microphone'], ['Reel / Scene / Take', m.reel + ' / ' + m.sceneNo + ' / ' + m.take], ['Место', (m.interior ? 'Interior' : 'Exterior') + ', ' + (m.day ? 'Day' : 'Night')],
        ['Пересвет', (m.clip * 100).toFixed(1) + '% кадра'], ['Мерцание', m.flicker > 0.02 ? 'есть, ' + Math.round(m.flicker * 100) + '%' : 'нет']
      ];
      if (m.dropped) rows.push(['Внимание', 'пропуск кадров (носитель не успевал)']);
      return rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('');
    }
    function openClip(id) {
      var c = app.clips.filter(function (x) { return String(x.id) === String(id); })[0]; if (!c) return;
      var p = h('div', { cls: 'bm-player' });
      p.innerHTML = '<button type="button" class="x" data-close="1" data-h="navMedia">' + IC.chevL + '</button><div class="pv"><img alt=""><div class="pc"><button type="button" data-play="1" data-h="navMedia">' + IC.play + '</button><input type="range" min="0" max="' + (c.frames.length - 1) + '" value="0" aria-label="Скраббер"><span class="tm">00:00</span></div>' +
        (c.playSpeed !== 1 ? '<div style="font-size:11px;color:#9aa3b2">' + (c.playSpeed < 1 ? 'Замедление ×' + Math.round(1 / c.playSpeed * 10) / 10 + ' (off speed)' : 'Таймлапс — ускоренное воспроизведение') + '</div>' : '') + '</div>' +
        '<div class="meta"><h5>' + esc(c.name) + '</h5><dl>' + metaRows(c) + '</dl><div class="acts"><button type="button" data-good="1" data-h="slate">' + (c.good ? 'Снять отметку Good Take' : 'Отметить Good Take') + '</button><button type="button" class="del" data-del="1" data-h="navMedia">Удалить</button></div><div class="confirm"></div></div>';
      mv.appendChild(p);
      var im = p.querySelector('img'), rg = p.querySelector('input'), tm = p.querySelector('.tm'), playBtn = p.querySelector('[data-play]');
      var st = { i: 0, playing: false, t: 0 };
      function show(i) { st.i = i; im.src = c.frames[i]; rg.value = i; tm.textContent = fmtClipDur(i / Math.max(1, c.frames.length - 1) * c.dur / c.playSpeed); }
      show(0);
      rg.oninput = function () { show(+rg.value); };
      function tick(now) {
        if (!st.playing) return;
        if (!st.last) st.last = now; var dt = (now - st.last) / 1000; st.last = now; st.t += dt;
        var step = (1 / 6) / c.playSpeed;
        while (st.t > step) { st.t -= step; if (st.i >= c.frames.length - 1) { st.playing = false; playBtn.innerHTML = IC.play; return; } show(st.i + 1); }
        player.raf = requestAnimationFrame(tick);
      }
      playBtn.onclick = function () { st.playing = !st.playing; st.last = 0; playBtn.innerHTML = st.playing ? IC.pause : IC.play; if (st.playing) { if (st.i >= c.frames.length - 1) show(0); player.raf = requestAnimationFrame(tick); } };
      p.addEventListener('click', function (e) {
        if (app.helpMode) return;
        var b = e.target.closest('button'); if (!b) return;
        if (b.dataset.close) { renderMedia(); }
        if (b.dataset.good) { c.good = !c.good; b.textContent = c.good ? 'Снять отметку Good Take' : 'Отметить Good Take'; }
        if (b.dataset.del) { p.querySelector('.confirm').innerHTML = '<div class="acts"><span style="font-size:11px">Удалить клип без возможности восстановления?</span><button type="button" class="del" data-yes="1">Удалить</button><button type="button" data-no="1">Отмена</button></div>'; }
        if (b.dataset.yes) { app.clips.splice(app.clips.indexOf(c), 1); renderMedia(); }
        if (b.dataset.no) p.querySelector('.confirm').innerHTML = '';
      });
      player = { el: p, st: st };
    }
    function stopPlayer() { if (player) { cancelAnimationFrame(player.raf); player.st.playing = false; player = null; } }
    mv.addEventListener('click', function (e) {
      if (app.helpMode) return;
      var b = e.target.closest('button'); if (!b || b.closest('.bm-player')) return;
      if (b.dataset.clip) openClip(b.dataset.clip);
      else if (b.dataset.sort) { sortAsc = !sortAsc; renderMedia(); }
      else app.toast('Сортировка, фильтры и выбор клипов в симуляторе упрощены: доступны просмотр, метаданные и удаление.');
    });

    /* ---------- Chat ---------- */
    var msgs = [
      { who: 'Монтажёр · DaVinci Resolve', t: 'Привет! Вижу твои прокси в проекте. Сцена 1, дубль 2 — лучший, отмечу его.' },
      { who: 'Режиссёр', t: 'Следующий кадр: крупный план, 48 мм, фокус на глазах. И выключи авто баланс белого.' }
    ];
    function renderChat() {
      if (!S.cloudLogged) {
        cv.innerHTML = '<div class="c"><div class="logo">' + IC.cloudBig + '</div><h3>Blackmagic <b>Cloud</b></h3><p>Log in to Blackmagic Cloud to access your projects chat.</p><button type="button" class="lg" data-login="1" data-h="navChat">Log In</button></div>';
        return;
      }
      cv.innerHTML = '<div class="bm-msgs">' + msgs.map(function (m) { return '<div class="bm-msg' + (m.me ? ' me' : '') + '"><b>' + esc(m.who) + '</b>' + esc(m.t) + '</div>'; }).join('') + '</div><form class="bm-chatin"><input placeholder="Сообщение участникам проекта" aria-label="Сообщение"><button type="submit">Send</button></form>';
      var box = cv.querySelector('.bm-msgs'); box.scrollTop = box.scrollHeight;
      cv.querySelector('form').onsubmit = function (e) { e.preventDefault(); var i = cv.querySelector('input'); if (!i.value.trim()) return; msgs.push({ who: 'Вы', t: i.value.trim(), me: true }); setTimeout(function () { msgs.push({ who: 'Монтажёр · DaVinci Resolve', t: 'Принято! (это имитация чата Blackmagic Cloud)' }); if (app.view === 'chat') renderChat(); }, 900); renderChat(); };
    }
    cv.addEventListener('click', function (e) { if (app.helpMode) return; if (e.target.closest('[data-login]')) { S.cloudLogged = true; app.save(); renderChat(); app.toast('Вход в Blackmagic Cloud выполнен (имитация).'); } });
    app.renderMedia = renderMedia; app.renderChat = renderChat;
  }
