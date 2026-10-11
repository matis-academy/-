  /* =====================================================================
   *  ВКЛАДКА SETTINGS (горизонтальная раскладка: слева разделы, справа пункты)
   * ===================================================================== */
  function buildSettings(app) {
    var S = app.S, v = app.views.settings, curSec = 'record', sub = null, rgtScroll = 0;
    app.rowHelp = {};
    SETTINGS.forEach(function (sec) { sec.groups.forEach(function (g, gi) { g.forEach(function (r, ri) { r.key = sec.id + ':' + gi + ':' + ri; r.sec = sec.title; app.rowHelp[r.key] = r; }); }); });
    function optLabel(r, val) { var o = (r.o || []).filter(function (x) { return x[0] === val; })[0]; return o ? o[1] : String(val); }
    function chev() { return '<span class="ch">' + IC.chevR + '</span>'; }
    function rowHTML(r) {
      var dis = r.dis && r.dis(S), cls = 'bm-row' + (dis ? ' dis' : ''), lb = '<span class="lb">' + esc(r.l) + (r.sub ? '<small>' + esc(r.sub) + '</small>' : '') + '</span>';
      var attrs = ' data-hs="' + r.key + '"';
      if (r.t === 'tog') return '<button type="button" class="' + cls + '" data-tog="' + r.k + '"' + attrs + (dis ? ' disabled' : '') + '>' + lb + '<span class="tgl' + (S[r.k] ? ' on' : '') + '"></span></button>';
      if (r.t === 'sel') return '<button type="button" class="' + cls + '" data-sel="' + r.key + '"' + attrs + (dis ? ' disabled' : '') + '>' + lb + '<span class="vl">' + esc(optLabel(r, S[r.k])) + '</span>' + chev() + '</button>';
      if (r.t === 'link') return '<button type="button" class="' + cls + '" data-page="' + r.page + '"' + attrs + '>' + lb + (r.val ? '<span class="vl">' + esc(r.val(S)) + '</span>' : '') + chev() + '</button>';
      if (r.t === 'info') return '<div class="' + cls + '"' + attrs + '>' + lb + '<span class="vl">' + esc(r.val(S)) + '</span></div>';
      return '';
    }
    function render() {
      var keepScroll = v.querySelector('.rgt') ? v.querySelector('.rgt').scrollTop : 0;
      var lft = '<div class="lft"><h2>Settings</h2>' + SETTINGS.map(function (s) { return '<button type="button" class="sec' + (s.id === curSec ? ' act' : '') + '" data-sec="' + s.id + '" data-h="navSettings">' + esc(s.title) + '</button>'; }).join('') + '</div>';
      var rgt = '<div class="rgt">';
      if (!sub) {
        var sec = SETTINGS.filter(function (s) { return s.id === curSec; })[0];
        rgt += '<div class="hd">' + esc(sec.title) + '</div>' + sec.groups.map(function (g) { return '<div class="bm-grp">' + g.map(rowHTML).join('') + '</div>'; }).join('');
        if (curSec === 'about') rgt += '<button type="button" class="bm-bigbtn" data-page="iosset" data-h="navSettings">Open Blackmagic Cam Settings</button>';
      } else rgt += subHTML();
      rgt += '</div>';
      v.innerHTML = lft + rgt;
      if (!sub || sub === app.__lastSub) v.querySelector('.rgt').scrollTop = keepScroll;
      app.__lastSub = sub;
    }
    function selPage(r) {
      var opts = r.o, html = '<div class="hd"><button type="button" data-back="1" data-h="navSettings">' + IC.chevL + '</button>' + esc(r.page || r.sec) + '</div>';
      html += '<div class="gh">' + esc(r.l) + '</div><div class="bm-grp">' + opts.map(function (o) {
        var sel = S[r.k] === o[0], dis = (r.k === 'resolution' && false), subt = r.subs && r.subs[o[0]] ? '<small>' + esc(r.subs[o[0]]) + '</small>' : '';
        return '<button type="button" class="bm-row' + (sel ? ' sel' : '') + (dis ? ' dis' : '') + '" data-opt="' + esc(String(o[0])) + '" data-hs="' + r.key + '"><span class="ck">' + IC.check + '</span><span class="lb">' + esc(o[1]) + subt + '</span></button>';
      }).join('') + '</div>';
      if (r.k2 && r.show2(S)) html += '<div class="gh">' + esc(r.l2) + '</div><div class="bm-grp">' + r.o2.map(function (o) { return '<button type="button" class="bm-row' + (S[r.k2] === o[0] ? ' sel' : '') + '" data-opt2="' + o[0] + '" data-hs="' + r.key + '"><span class="ck">' + IC.check + '</span><span class="lb">' + esc(o[1]) + '</span></button>'; }).join('') + '</div>';
      if (r.k === 'saveTo') html += '<div class="bm-grp"><button type="button" class="bm-row" data-page="prostorage" data-hs="' + r.key + '"><span class="lb">Configure Pro Video Storage</span>' + chev() + '</button></div>';
      if (r.k === 'platform') html += '<div class="bm-grp"><button type="button" class="bm-row" data-act="importstream" data-hs="' + r.key + '"><span class="ic">' + IC.imp + '</span><span class="lb">Import Stream Settings</span></button></div>';
      if (r.k === 'hdmi') {
        var feed = S.hdmi === 'feed';
        html += '<div class="bm-grp">' + ['Clean Feed', 'Status Text', 'Text Surrounds Image', 'Display LUT', 'Zebra', 'Focus Assist', 'Frame Guide', 'Grid', 'Safe Area Guide', 'False Color', 'Limit Monitoring to HD'].map(function (n, i) {
          var k = 'hdmi_' + i; return '<button type="button" class="bm-row' + (feed ? '' : ' dis') + '" data-tog="' + k + '" data-hs="' + r.key + '"' + (feed ? '' : ' disabled') + '><span class="lb">' + n + '</span><span class="tgl' + (S[k] ? ' on' : '') + '"></span></button>';
        }).join('') + '</div><div class="bm-note">Переключатели работают в режиме Video Feed: выбирают, что выводить поверх чистого видео на внешний монитор (имитация).</div>';
      }
      if (r.h) html += '<div class="bm-note">' + esc(r.h) + '</div>';
      return html;
    }
    function hdr(t) { return '<div class="hd"><button type="button" data-back="1" data-h="navSettings">' + IC.chevL + '</button>' + esc(t) + '</div>'; }
    function subHTML() {
      if (sub.indexOf('sel:') === 0) return selPage(app.rowHelp[sub.slice(4)]);
      switch (sub) {
        case 'proxy': return hdr('Media') + '<div class="gh">Proxy Clip Manager</div><div class="bm-grp"><div class="bm-row" data-hs="media:1:1"><span class="lb">' + app.clips.length + ' Clips</span><span class="vl">' + (app.clips.length * 0.11).toFixed(1).replace('.', ',') + ' GB</span></div></div><div class="bm-grp"><button type="button" class="bm-row" data-act="delproxy" data-hs="media:1:1"><span class="ic">' + IC.close + '</span><span class="lb">Delete Proxy Clips</span></button></div>';
        case 'cloud': return hdr('Blackmagic Cloud') + (S.cloudLogged ?
          '<div class="bm-grp"><div class="bm-row"><span class="lb">Signed in as</span><span class="vl">student@matis.academy</span></div><div class="bm-row"><span class="lb">Project</span><span class="vl">Курс: Мобильная съёмка</span></div></div><div class="bm-grp"><button type="button" class="bm-row" data-act="logout"><span class="lb" style="color:#ff6b62">Log Out</span></button></div>' :
          '<div class="bm-grp"><button type="button" class="bm-row" data-act="login"><span class="ic">' + IC.cloud + '</span><span class="lb">Log in to Blackmagic Cloud</span></button></div>') + '<div class="bm-note">Имитация: в симуляторе вход условный, данные никуда не отправляются. В приложении здесь вводится Blackmagic ID.</div>';
        case 'presets': return hdr('Presets') + '<div class="gh">Preset Selection</div>' + [['add', IC.plus, 'Save New Preset'], ['import', IC.imp, 'Import Preset'], ['export', IC.exp, 'Export Preset'], ['overwrite', IC.refresh, 'Overwrite Preset']].map(function (b) { return '<div class="bm-grp"><button type="button" class="bm-row" data-act="p_' + b[0] + '" data-hs="presets:0:0"><span class="ic">' + b[1] + '</span><span class="lb">' + b[2] + '</span></button></div>'; }).join('') +
          ((store('presets') || []).length ? '<div class="gh">Saved</div><div class="bm-grp">' + (store('presets') || []).map(function (p, i) { return '<button type="button" class="bm-row" data-act="p_apply" data-i="' + i + '" data-hs="presets:0:0"><span class="lb">' + esc(p.name) + '</span><span class="vl">Apply</span></button>'; }).join('') + '</div>' : '') +
          '<div class="bm-note">Пресеты хранятся в этом браузере. Export копирует пресет как текст, Import принимает такой текст.</div><textarea class="mlbm-search" data-ptext style="height:70px;display:none"></textarea>';
        case 'luts': return hdr('LUTs') + '<div class="gh">Blackmagic LUTs</div><div class="bm-grp"><button type="button" class="bm-row" data-tog="bmLuts" data-hs="luts:0:0"><span class="lb">Enable Blackmagic LUTs</span><span class="tgl' + (S.bmLuts ? ' on' : '') + '"></span></button></div><div class="bm-grp">' +
          LUTS.map(function (L, i) { return '<button type="button" class="bm-row' + (S.bmLuts ? '' : ' dis') + '" data-lut="' + i + '" data-hs="luts:0:0"><span class="lb">' + esc(L.name) + '<small>' + esc(L.about) + '</small></span><span class="tgl' + (S.lutEnabled[i] ? ' on' : '') + '"></span></button>'; }).join('') + '</div>' +
          [['imp', IC.imp, 'Import LUT'], ['exp', IC.exp, 'Export LUT'], ['rem', IC.close, 'Remove LUTs']].map(function (b) { return '<div class="bm-grp"><button type="button" class="bm-row" data-act="lut_' + b[0] + '" data-hs="luts:0:0"><span class="ic">' + b[1] + '</span><span class="lb">' + b[2] + '</span></button></div>'; }).join('') +
          '<div class="bm-note">Импорт своих LUT (.cube) в симуляторе не поддерживается — работают 11 встроенных.</div>';
        case 'http': return hdr('Network Access') + '<div class="bm-grp"><button type="button" class="bm-row" data-tog="httpOn" data-hs="network:0:0"><span class="lb">HTTP Server</span><span class="tgl' + (S.httpOn ? ' on' : '') + '"></span></button>' + (S.httpOn ? '<div class="bm-row"><span class="lb">Address</span><span class="vl">http://192.168.1.24:8080</span></div>' : '') + '</div><div class="bm-note">Встроенный сервер позволяет управлять камерой и скачивать клипы по Wi-Fi из браузера (имитация).</div>';
        case 'reset': return hdr('Reset') + '<div class="gh">Reset Blackmagic Cam Settings</div><div class="bm-grp"><button type="button" class="bm-row" data-act="reset1" data-hs="reset:0:0"><span class="lb">Reset Camera Settings</span></button><button type="button" class="bm-row" data-act="reset2" data-hs="reset:0:0"><span class="lb">Reset Camera and Cloud Settings</span></button><button type="button" class="bm-row" data-act="reset3" data-hs="reset:0:0"><span class="lb" style="color:#ff6b62">Reset All Settings and Erase All Content</span></button></div>' +
          (app.confirmReset ? '<div class="bm-grp"><div class="bm-row"><span class="lb">' + { reset1: 'Сбросить настройки камеры?', reset2: 'Сбросить настройки камеры и облака?', reset3: 'Сбросить всё и удалить все клипы?' }[app.confirmReset] + '</span></div><button type="button" class="bm-row" data-act="doreset"><span class="lb" style="color:#ff6b62">Reset</span></button><button type="button" class="bm-row" data-act="noreset"><span class="lb">Cancel</span></button></div>' : '');
        case 'prostorage': return hdr('Media') + '<div class="gh">Configure Pro Video Storage</div><div class="bm-grp"><div class="bm-row"><span class="lb">External SSD</span><span class="vl">' + (S.saveTo === 'external' ? 'Samsung T7 · 931 GB' : 'Not selected') + '</span></div></div><div class="bm-note">Внешний SSD подключается через USB-C. Он нужен для ProRes 4K 60 к/с на iPhone 15 Pro и Pro Max (имитация).</div>';
        case 'learn': return hdr('About') + '<div class="bm-note" style="font-size:13px">Описание приложения и техспецификации — на сайте производителя: blackmagicdesign.com → Products → Blackmagic Camera.</div>';
        case 'iosset': return hdr('iOS Settings') + '<div class="bm-note" style="font-size:13px">Кнопка открывает системные настройки iOS для приложения: доступ к камере, микрофону, фото, геолокации, локальной сети и Bluetooth.</div>';
      }
      return hdr('');
    }
    function changed(k) {
      if (k === 'lensCorr' || k === 'scene') app.eng.dirty = true;
      if (k === 'resolution' && curFps(S) > maxFpsFor(S)) { if (S.offSpeed) S.offFps = 60; else S.fps = 60; app.toast('100 и 120 к/с доступны только в HD — частота снижена до 60.', true); }
      if (k === 'codec' && needsExternal(S)) app.toast('ProRes 4K ' + curFps(S) + ' к/с на iPhone 15 Pro пишется только на внешний SSD. Выберите Save Clips to → Pro Video Storage, иначе будут пропуски кадров.', true);
      if (k === 'colorspace' && S.colorspace === 'applelog' && !S.lutOn) app.toast('Apple Log выглядит плоским. Для монитора включите LUT Rec 709 Neutral (кнопка LUT справа).');
      if (k === 'audioSrc' || k === 'audioCh') {}
      app.save(); app.updateHud();
    }
    v.addEventListener('click', function (e) {
      if (app.helpMode && !e.target.closest('[data-sec],[data-back],[data-sel],[data-page]')) return;
      var b = e.target.closest('button'); if (!b || b.disabled) return;
      var d = b.dataset;
      if (d.sec) { curSec = d.sec; sub = null; app.confirmReset = null; render(); v.querySelector('.rgt').scrollTop = 0; return; }
      if (d.back) { sub = null; app.confirmReset = null; render(); return; }
      if (d.tog) { S[d.tog] = !S[d.tog]; if (d.tog === 'remoteOn' && !S.remoteOn) {} changed(d.tog); render(); return; }
      if (d.sel) { sub = 'sel:' + d.sel; render(); v.querySelector('.rgt').scrollTop = 0; return; }
      if (d.opt != null) { var r = app.rowHelp[sub.slice(4)]; var val = d.opt; (r.o.forEach(function (o) { if (String(o[0]) === val) val = o[0]; })); S[r.k] = val; changed(r.k); render(); return; }
      if (d.opt2) { var r2 = app.rowHelp[sub.slice(4)]; S[r2.k2] = d.opt2; changed(r2.k2); render(); return; }
      if (d.page) { sub = d.page; render(); v.querySelector('.rgt').scrollTop = 0; return; }
      if (d.lut != null) { if (!S.bmLuts) return; var i = +d.lut; S.lutEnabled[i] = !S.lutEnabled[i]; if (!S.lutEnabled[i] && S.lut === LUTS[i].id) S.lutOn = false; app.save(); render(); return; }
      if (d.act) act(d.act, b);
    });
    function act(a, b) {
      var ps = store('presets') || [], ta = v.querySelector('[data-ptext]');
      switch (a) {
        case 'login': S.cloudLogged = true; app.toast('Вход выполнен (имитация).'); break;
        case 'logout': S.cloudLogged = false; S.liveStream = false; break;
        case 'importstream': app.toast('Файл настроек трансляции импортирован (имитация).'); break;
        case 'delproxy': app.toast('Прокси-файлы удалены (имитация).'); break;
        case 'p_add': ps.push({ name: 'Preset ' + (ps.length + 1) + ' · ' + sceneById(S.scene).short, s: app.presetSnapshot() }); store('presets', ps); app.toast('Пресет сохранён.'); break;
        case 'p_overwrite': if (!ps.length) { app.toast('Нет пресетов для перезаписи.'); break; } ps[ps.length - 1].s = app.presetSnapshot(); store('presets', ps); app.toast('Последний пресет перезаписан.'); break;
        case 'p_export': if (!ps.length) { app.toast('Сначала сохраните пресет.'); break; } render(); ta = v.querySelector('[data-ptext]'); ta.style.display = ''; ta.value = JSON.stringify(ps[ps.length - 1]); ta.select(); try { navigator.clipboard.writeText(ta.value).catch(function () {}); } catch (er) {} app.toast('Пресет скопирован как текст.'); return;
        case 'p_import': render(); ta = v.querySelector('[data-ptext]'); ta.style.display = ''; ta.placeholder = 'Вставьте текст пресета и нажмите Import ещё раз'; if (ta.__ready && ta.value) {} ta.oninput = function () { try { var o = JSON.parse(ta.value); if (o && o.s) { ps.push(o); store('presets', ps); app.toast('Пресет импортирован.'); render(); } } catch (er) {} }; return;
        case 'p_apply': app.applyPreset(ps[+b.dataset.i].s); app.toast('Пресет «' + ps[+b.dataset.i].name + '» применён.'); break;
        case 'lut_imp': case 'lut_exp': app.toast('В симуляторе работают только встроенные LUT.'); break;
        case 'lut_rem': app.toast('Встроенные LUT удалить нельзя — их можно выключить переключателями.'); break;
        case 'reset1': case 'reset2': case 'reset3': app.confirmReset = a; break;
        case 'noreset': app.confirmReset = null; break;
        case 'doreset':
          var keep = { scene: S.scene }, d = defaults();
          for (var k in d) S[k] = d[k];
          S.scene = keep.scene;
          if (app.confirmReset === 'reset3') { app.clips.length = 0; app.free = 51e9; app.tcFrames = 0; }
          app.confirmReset = null; app.eng.dirty = true; app.toast('Настройки сброшены.'); break;
      }
      app.save(); render(); app.updateHud();
    }
    app.renderSettings = render;
    app.openSection = function (id) { curSec = id; sub = null; render(); };
  }
