  /* =====================================================================
   *  ПРИЛОЖЕНИЕ: каркас, экран камеры, верхняя строка, панели, запись
   * ===================================================================== */
  function h(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (k === 'cls') e.className = attrs[k]; else if (k === 'style') e.style.cssText = attrs[k]; else e.setAttribute(k, attrs[k]); }
    if (html != null) e.innerHTML = html;
    return e;
  }
  function resFactor(r) { return r === '4k' ? 1 : r === 'opengate' ? 0.333 : r === 'hd' ? 0.25 : 0.111; }
  function videoRate(S) {
    var fps = curFps(S), r = resFactor(S.resolution);
    if (CODEC_RATE[S.codec]) return CODEC_RATE[S.codec] * r * fps / 30;
    var b = 54; BITRATES.forEach(function (x) { if (x[0] === S.bitrate) b = x[2]; });
    if (S.codec === 'h264') b *= 1.2;
    return b * Math.pow(r, 0.6) * Math.pow(fps / 30, 0.6);
  }
  function totalRate(S) {
    var a = S.audioSrc === 'none' ? 0 : S.audioFmt === 'aac' ? 0.32 : S.audioFmt === 'pcm' ? 2.3 : 3.07;
    a *= S.audioCh === 'mono' ? 0.5 : S.audioCh === '4ch' ? 2 : 1;
    return videoRate(S) + (S.proxy ? 5 : 0) + a;
  }
  function needsExternal(S) { return /^prores/.test(S.codec) && (S.resolution === '4k' || S.resolution === 'opengate') && curFps(S) > 30 && S.saveTo !== 'external'; }
  function fmtShutter(S, den) {
    var fpsE = curFps(S);
    if (S.shutterMeas === 'angle') { var a = S.shAuto ? 360 * fpsE / den : S.shAngle; return (Math.round(a * 10) / 10) + '°'; }
    return '1/' + Math.round(den);
  }
  function fmtIris(S, N) { return S.irisMeas === 'decimal' ? N.toFixed(1).replace('.', ',') : 'f/' + N.toFixed(1).replace('.', ','); }
  function fmtFps(f) { return String(f); }

  function mount(root, opts) {
    opts = opts || {};
    injectCSS();
    root.innerHTML = '';
    var saved = store('settings');
    var S = defaults();
    if (saved && typeof saved === 'object') for (var k in saved) if (k in S && k !== 'recording') S[k] = saved[k];
    S.scene = opts.scene || (saved && saved.scene) || 'day';
    S.recording = false; S.tap = null;
    var app = { S: S, root: root, clips: [], tcFrames: 0, free: 51e9, total: 512e9, battery: 82, view: 'camera', open: null, helpMode: false, opts: opts };
    var eng = createEngine(S); app.eng = eng;

    /* ---------- каркас ---------- */
    var el = h('div', { cls: 'mlbm', tabindex: '0' });
    root.appendChild(el); app.el = el;
    var top = h('div', { cls: 'mlbm-top' });
    top.innerHTML = '<div class="mlbm-title">Blackmagic Camera — симулятор<small>Учебный тренажёр приложения 3.5 для iPhone 15 Pro Max. Не официальный продукт Blackmagic Design.</small></div>' +
      '<label class="mlbm-sel">Условия <select class="sel-scene">' + SCENES.map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + '</option>'; }).join('') + '</select></label>' +
      '<button type="button" class="mlbm-tbtn b-help" title="Режим справки: нажмите на любой элемент, чтобы узнать, что он делает">' + IC.help + 'Что это?</button>' +
      '<button type="button" class="mlbm-tbtn b-full" title="Во весь экран">' + IC.full + 'Во весь экран</button>';
    el.appendChild(top);
    var main = h('div', { cls: 'mlbm-main' }); el.appendChild(main);
    var stage = h('div', { cls: 'mlbm-stage' }); main.appendChild(stage);
    var phone = h('div', { cls: 'mlbm-phone' }); stage.appendChild(phone);
    var box = h('div', { cls: 'mlbm-screenbox' }); phone.appendChild(box);
    var scr = h('div', { cls: 'mlbm-screen' }); box.appendChild(scr); app.scr = scr;
    box.appendChild(h('div', { cls: 'mlbm-island' }));
    stage.appendChild(h('div', { cls: 'mlbm-rotate' }, 'Поверните телефон горизонтально или нажмите «Во весь экран» — так кнопки будут крупнее.'));
    var side = h('div', { cls: 'mlbm-side' }); main.appendChild(side); app.side = side;

    /* масштаб экрана телефона под ширину блока */
    function fit() {
      var fs = phone.classList.contains('fs');
      var avail = fs ? window.innerWidth : stage.clientWidth;
      var availH = fs ? window.innerHeight : Infinity;
      var pad = fs ? 0 : 28;
      var s = Math.min((avail - pad) / 932, (availH - pad) / 430);
      if (!fs) { s = Math.min(s, 1.25); if (window.innerHeight < 620 && window.innerWidth > window.innerHeight) s = Math.min(s, (window.innerHeight - 24) / 430); }
      s = Math.max(s, 0.25);
      app.scale = s;
      scr.style.transform = 'scale(' + s + ')';
      box.style.width = 932 * s + 'px'; box.style.height = 430 * s + 'px';
      phone.style.width = (932 * s + pad) + 'px';
      if (app.dial) app.dial.redraw();
    }
    app.fit = fit;
    if (window.ResizeObserver) new ResizeObserver(fit).observe(stage); else window.addEventListener('resize', fit);
    top.querySelector('.b-full').onclick = function () {
      var on = !phone.classList.contains('fs');
      if (on) { phone.classList.add('fs'); var rq = phone.requestFullscreen || phone.webkitRequestFullscreen; if (rq) { var pr = rq.call(phone); if (pr && pr.catch) pr.catch(function () {}); } }
      else { phone.classList.remove('fs'); if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen(); }
      setTimeout(fit, 60);
    };
    document.addEventListener('fullscreenchange', function () { if (!document.fullscreenElement) phone.classList.remove('fs'); setTimeout(fit, 60); });
    var selScene = top.querySelector('.sel-scene'); selScene.value = S.scene;
    selScene.onchange = function () { setScene(selScene.value); };
    function setScene(id) { S.scene = id; selScene.value = id; eng.dirty = true; app.save(); app.showHelpText(sceneById(id).name, 'Условия съёмки', sceneById(id).about); }
    app.setScene = setScene;

    /* ---------- навигация ---------- */
    var rail = h('div', { cls: 'bm-rail' });
    [['camera', 'Camera', IC.camTab, 'navCamera'], ['media', 'Media', IC.media, 'navMedia'], ['chat', 'Chat', IC.chat, 'navChat'], ['settings', 'Settings', IC.gear, 'navSettings']].forEach(function (n) {
      var b = h('button', { cls: 'bm-nav', 'data-nav': n[0], 'data-h': n[3], type: 'button' }, n[2] + '<span>' + n[1] + '</span>');
      b.onclick = function () { app.go(n[0]); };
      rail.appendChild(b);
    });
    scr.appendChild(rail);
    var views = {};
    ['camera', 'media', 'chat', 'settings'].forEach(function (v) { views[v] = h('div', { cls: 'bm-view bm-' + (v === 'settings' ? 'set' : v === 'chat' ? 'chatv' : v) }); scr.appendChild(views[v]); });
    app.views = views;
    app.go = function (v) {
      app.view = v;
      for (var k in views) views[k].classList.toggle('act', k === v);
      rail.querySelectorAll('.bm-nav').forEach(function (b) { b.classList.toggle('act', b.getAttribute('data-nav') === v); });
      if (v === 'settings') app.renderSettings(); if (v === 'media') app.renderMedia(); if (v === 'chat') app.renderChat();
    };

    /* ---------- экран камеры ---------- */
    var cam = views.camera;
    var img = h('div', { cls: 'bm-img', 'data-h': 'image' }); cam.appendChild(img); app.img = img;
    var cv = h('canvas', { cls: 'bm-cv', width: RW, height: RH }); img.appendChild(cv);
    var cvx = cv.getContext('2d');
    var ov = h('div', { cls: 'bm-ov' }); img.appendChild(ov);
    var ovSvg = h('div', { cls: 'bm-ov' }); ov.appendChild(ovSvg);
    var fcLeg = h('div', { cls: 'bm-fcleg' }); fcLeg.style.display = 'none'; img.appendChild(fcLeg);
    (function () {
      var bands = [['#ff1010', '', 0, 6], ['#ffe600', '95%WC', 6, 22], ['#d9d9d0', '80%WC', 22, 50], ['#9a9a9a', '', 50, 70], ['#ff96c8', 'MG+1', 70, 92], ['#9a9a9a', '', 92, 112], ['#2ad23c', '18%MG', 112, 135], ['#6a6a6a', '', 135, 160], ['#1e46e6', 'NBDL', 160, 182], ['#781eaa', 'BDL', 182, 200]];
      fcLeg.innerHTML = bands.map(function (b) { return '<i style="top:' + (b[2] + 5) + 'px;height:' + (b[3] - b[2]) + 'px;background:' + b[0] + '"></i>' + (b[1] ? '<span style="top:' + ((b[2] + b[3]) / 2 + 5) + 'px">' + b[1] + '</span>' : ''); }).join('');
    })();
    var lutBadge = h('div', { cls: 'bm-lutbadge' }, IC.lut); img.appendChild(lutBadge);
    var torchBadge = h('div', { cls: 'bm-torchbadge' }, IC.torch); img.appendChild(torchBadge);
    var afBox = h('div', { cls: 'bm-af' }, svg('<path d="M3 9V5a2 2 0 0 1 2-2h4M15 3h4a2 2 0 0 1 2 2v4M21 15v4a2 2 0 0 1-2 2h-4M9 21H5a2 2 0 0 1-2-2v-4" stroke="#fff" stroke-width="1"/><path d="M10 12h4M12 10v4" stroke="#fff" stroke-width=".8"/>')); afBox.style.display = 'none'; img.appendChild(afBox);

    /* верхняя строка (HUD) */
    var hud = h('div', { cls: 'bm-hud' }); img.appendChild(hud); app.hud = hud;
    function hudItem(id, label, left, help, dial) {
      var it = h('div', { cls: 'it', 'data-h': help, 'data-dial': dial || '' });
      it.style.left = left + 'px';
      it.innerHTML = '<div class="lb">' + label + '<span class="bm-a" style="display:none">A</span><span class="lk" style="display:none;width:9px;height:9px">' + IC.lock + '</span></div><div class="va">—</div>';
      hud.appendChild(it);
      if (dial) it.addEventListener('click', function () { app.toggleDial(dial); });
      return it;
    }
    var H = {
      lens: hudItem('lens', 'LENS', 22, 'lens', 'lens'),
      fps: hudItem('fps', 'FPS', 88, 'fps', 'fps'),
      sh: hudItem('sh', 'SHUTTER', 140, 'shutter', 'shutter'),
      iris: hudItem('iris', 'IRIS', 214, 'iris', null),
      iso: hudItem('iso', 'ISO', 440, 'iso', 'iso'),
      wb: hudItem('wb', 'WB', 488, 'wb', 'wb'),
      tint: hudItem('tint', 'TINT', 550, 'tint', 'tint')
    };
    H.iris.classList.add('dim');
    var tcEl = h('div', { cls: 'bm-tc', 'data-h': 'tc' }, '00:00:00:00'); hud.appendChild(tcEl);
    var fmtEl = h('div', { cls: 'bm-fmt', 'data-h': 'format' }, '4K<small>16:9</small>'); hud.appendChild(fmtEl);
    fmtEl.addEventListener('click', function () { app.go('settings'); app.openSection('record'); });
    var batEl = h('div', { cls: 'bm-bat', 'data-h': 'battery' }, '82%'); hud.appendChild(batEl);
    var hL = h('div', { cls: 'bm-handle', 'data-h': 'leftHandle' }, '<i></i><i></i><i></i>'); hL.style.left = '4px'; img.appendChild(hL);
    var hR = h('div', { cls: 'bm-handle', 'data-h': 'rightHandle' }, '<i></i><i></i><i></i>'); hR.style.right = '4px'; img.appendChild(hR);
    hL.onclick = function () { app.toggleSide('left'); };
    hR.onclick = function () { app.toggleSide('right'); };

    /* нижние панели */
    var pHist = h('div', { cls: 'bm-panel bm-hist', 'data-h': 'hist' }, '<div class="pt">Apple Log - HDR</div><canvas width="236" height="76"></canvas><div class="clipi"><b style="top:0"></b><b style="bottom:0"></b></div>');
    var pStor = h('div', { cls: 'bm-panel bm-stor', 'data-h': 'storage' }, '<div class="ph"><i></i></div><div class="in"><div class="t1">Internal Storage</div><div class="t2">0:00:00</div><div class="bar"><b></b></div><div class="t3"><span>10%</span><span>51GB</span></div></div>');
    var pAud = h('div', { cls: 'bm-panel bm-aud', 'data-h': 'meters' }, '<div class="pt">iPhone Microphone</div><canvas width="264" height="84"></canvas>');
    [pHist, pStor, pAud].forEach(function (p) { img.appendChild(p); });
    pHist.onclick = function () { app.toggleOverlay('scope'); };
    pAud.onclick = function () { app.toggleOverlay('audbig'); };
    var histCv = pHist.querySelector('canvas'), histCtx = histCv.getContext('2d');
    var audCv = pAud.querySelector('canvas'), audCtx = audCv.getContext('2d');

    var dimEl = h('div', { cls: 'bm-dim' }); scr.appendChild(dimEl);
    var flashEl = h('div', { cls: 'bm-flash' }); scr.appendChild(flashEl);

    /* правая колонка */
    var rcol = h('div', { cls: 'bm-rcol' }); cam.appendChild(rcol);
    function rb(icon, y, help, fn, extra) { var b = h('button', { cls: 'bm-rb', type: 'button', 'data-h': help }, icon + (extra || '')); b.style.top = y + 'px'; b.onclick = fn; rcol.appendChild(b); return b; }
    var RB = {
      tools: rb(IC.frame, 13, 'tools', function () { app.toggleDial('tools'); }),
      focus: rb(IC.focus, 66, 'focus', function () { app.toggleDial('focus'); }, '<span class="aa">A</span>'),
      expo: rb(IC.expo, 119, 'exposure', function () { app.toggleDial('exposure'); }, '<span class="aa">A</span>'),
      lens: rb(IC.lensSmall, 278, 'lensBtn', function () { app.toggleDial('lens'); }, '<span class="sub">1x</span>'),
      lut: rb(IC.lut, 327, 'lutBtn', function () { app.toggleDial('lut'); }, '<span class="dot" style="display:none"></span>'),
      stab: rb(IC.stab, 378, 'stabBtn', function () { app.toggleDial('stab'); })
    };
    var recB = h('button', { cls: 'bm-recb', type: 'button', 'data-h': 'rec' }, '<i></i>'); rcol.appendChild(recB);
    recB.onclick = function () { app.toggleRec(); };

    /* ---------- оверлей: сетки, рамки, safe area ---------- */
    var ovSig = '';
    function colorOf(n) { return { white: '#fff', black: '#000', red: '#ff3b30', green: '#34c759', blue: '#2f7fff' }[n] || '#fff'; }
    function drawOverlay() {
      var sig = [S.grid, S.gridThirds, S.gridHorizon, S.gridCross, S.gridDot, S.gridsOp, S.fg, S.fgRatio, S.guidesOp, S.guidesColor, S.safe, S.safeLvl, S.resolution].join('|');
      if (sig === ovSig) return; ovSig = sig;
      var W = 705, Hh = 397, s = '<svg viewBox="0 0 705 397" preserveAspectRatio="none">';
      var gc = colorOf(S.guidesColor);
      if (S.resolution === 'opengate') { var gw = Hh * 4 / 3, gx = (W - gw) / 2; s += '<rect x="0" y="0" width="' + gx + '" height="397" fill="#000"/><rect x="' + (gx + gw) + '" y="0" width="' + gx + '" height="397" fill="#000"/>'; }
      if (S.fg) {
        var r = ratioVal(S.fgRatio), a = parseInt(S.guidesOp, 10) / 100 * 0.9, fw = W, fh = Hh;
        if (r > W / Hh) fh = W / r; else fw = Hh * r;
        var x0 = (W - fw) / 2, y0 = (Hh - fh) / 2;
        s += '<path d="M0 0H705V397H0Z M' + x0 + ' ' + y0 + 'V' + (y0 + fh) + 'H' + (x0 + fw) + 'V' + y0 + 'Z" fill="rgba(0,0,0,' + a + ')" fill-rule="evenodd"/>';
        s += '<rect x="' + x0 + '" y="' + y0 + '" width="' + fw + '" height="' + fh + '" fill="none" stroke="' + gc + '" stroke-width="1"/>';
      }
      if (S.safe) { var k = S.safeLvl / 100, sw = W * k, sh = Hh * k; s += '<rect x="' + (W - sw) / 2 + '" y="' + (Hh - sh) / 2 + '" width="' + sw + '" height="' + sh + '" fill="none" stroke="' + gc + '" stroke-width="1.5"/>'; }
      if (S.grid) {
        var go = parseInt(S.gridsOp, 10) / 100 * 0.9 + 0.1, st = 'stroke="rgba(255,255,255,' + go + ')" stroke-width="1"';
        if (S.gridThirds) s += '<path d="M235 0V397M470 0V397M0 132.3H705M0 264.7H705" ' + st + '/>';
        if (S.gridHorizon) s += '<path d="M150 198.5H555" ' + st + ' stroke-dasharray="6 4"/>';
        if (S.gridCross) s += '<path d="M340 198.5H365M352.5 186V211" ' + st + '/>';
        if (S.gridDot) s += '<circle cx="352.5" cy="198.5" r="2.5" fill="rgba(255,255,255,' + go + ')"/>';
      }
      ovSvg.innerHTML = s + '</svg>';
    }

    /* ---------- верхняя строка: обновление ---------- */
    function setTxt(e, t) { if (e.__t !== t) { e.__t = t; e.textContent = t; } }
    function setHud(item, val, auto, lock, sel) {
      setTxt(item.querySelector('.va'), val);
      item.querySelector('.bm-a').style.display = auto && !lock ? '' : 'none';
      item.querySelector('.lk').style.display = lock ? 'inline-block' : 'none';
      item.classList.toggle('sel', !!sel);
    }
    var lastTodSec = -1;
    function updateHud() {
      var L = lensById(S.lens), od = app.open;
      setHud(H.lens, (L.front ? 'Front' : L.eq + 'mm'), false, false, od === 'lens');
      setHud(H.fps, S.offSpeed ? fmtFps(S.offFps) : fmtFps(S.fps), false, false, od === 'fps');
      H.fps.querySelector('.lb').firstChild.textContent = S.offSpeed ? 'OFF SPEED' : 'FPS';
      setHud(H.sh, fmtShutter(S, S.shDen), S.shAuto, S.shLock, od === 'shutter');
      H.sh.querySelector('.lb').firstChild.textContent = S.shutterMeas === 'angle' ? 'ANGLE' : 'SHUTTER';
      setHud(H.iris, fmtIris(S, L.N), false, false, false);
      setHud(H.iso, String(Math.round(S.iso)), S.isoAuto, S.isoLock, od === 'iso');
      setHud(H.wb, Math.round(S.wbK / 10) * 10 + 'K', S.wbAuto, S.wbLock || (S.recording && S.lockWbRec && S.wbAuto), od === 'wb');
      setHud(H.tint, String(Math.round(S.tint)), S.tintAuto, S.tintLock, od === 'tint');
      var fps = S.fps;
      if (S.tcDisplay === 'tod') { var d = new Date(), sec = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(); setTxt(tcEl, fmtTC(sec * Math.round(fps) + Math.floor(d.getMilliseconds() / 1000 * fps), fps)); }
      else setTxt(tcEl, fmtTC(Math.floor(app.tcFrames), fps));
      tcEl.classList.toggle('rec', S.recording);
      setTxt(fmtEl.firstChild, { '4k': '4K', hd: 'HD', '720p': '720', opengate: 'OG' }[S.resolution]);
      setTxt(fmtEl.querySelector('small'), S.resolution === 'opengate' ? '4:3' : '16:9');
      batEl.style.display = S.dispBattery ? '' : 'none';
      setTxt(batEl, Math.round(app.battery) + '%'); batEl.classList.toggle('low', app.battery < 20);
      pHist.style.display = S.dispHist ? '' : 'none';
      pStor.style.display = S.dispStorage ? '' : 'none';
      pAud.style.display = S.dispAudio ? '' : 'none';
      setTxt(pHist.querySelector('.pt'), S.recLut && S.lutOn ? 'Rec.709' : { rec709: 'Rec.709', rec2020: 'Rec.2020 - HDR', p3: 'P3 D65', applelog: 'Apple Log - HDR' }[S.colorspace]);
      setTxt(pAud.querySelector('.pt'), S.audioSrc === 'none' ? 'No Audio' : 'iPhone Microphone');
      var remain = app.free * 8 / (totalRate(S) * 1e6);
      setTxt(pStor.querySelector('.t2'), fmtDur(remain));
      var pct = app.free / app.total;
      pStor.querySelector('.bar b').style.width = (pct * 100).toFixed(1) + '%';
      setTxt(pStor.querySelector('.t3 span'), Math.round(pct * 100) + '%');
      setTxt(pStor.querySelector('.t3 span:last-child'), Math.round(app.free / 1e9) + 'GB');
      setTxt(pStor.querySelector('.t1'), S.saveTo === 'external' ? 'External SSD' : 'Internal Storage');
      lutBadge.style.display = S.lutOn ? '' : 'none';
      hud.style.visibility = od === 'lut' ? 'hidden' : '';
      torchBadge.style.display = S.torch ? '' : 'none';
      fcLeg.style.display = S.falseColor ? '' : 'none';
      img.classList.toggle('rec', S.recording);
      recB.classList.toggle('rec', S.recording);
      RB.focus.querySelector('.aa').style.display = S.afAuto ? '' : 'none';
      RB.focus.classList.toggle('on', od === 'focus');
      RB.expo.querySelector('.aa').style.display = (S.shAuto || S.isoAuto) ? '' : 'none';
      RB.expo.classList.toggle('on', od === 'exposure');
      RB.tools.classList.toggle('on', od === 'tools');
      RB.lens.classList.toggle('on', od === 'lens');
      setTxt(RB.lens.querySelector('.sub'), L.front ? 'Front' : (Math.round(S.zoom * 10) / 10) + 'x');
      RB.lut.classList.toggle('on', od === 'lut' || S.lutOn);
      RB.lut.querySelector('.dot').style.display = S.lutOn ? '' : 'none';
      RB.stab.classList.toggle('on', S.stab !== 'off');
      drawOverlay();
    }
    app.updateHud = updateHud;

    /* ---------- гистограмма в панели ---------- */
    function drawHist() {
      var w = histCv.width, hh = histCv.height, ctx = histCtx, hs = eng.hist, mx = 1;
      for (var c = 0; c < 3; c++) for (var i = 1; i < 63; i++) if (hs[c][i] > mx) mx = hs[c][i];
      ctx.clearRect(0, 0, w, hh);
      ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, w - 1, hh - 1);
      var cols = ['rgba(255,70,70,0.55)', 'rgba(70,230,90,0.5)', 'rgba(70,140,255,0.55)'];
      ctx.globalCompositeOperation = 'lighter';
      for (c = 0; c < 3; c++) {
        ctx.fillStyle = cols[c]; ctx.beginPath(); ctx.moveTo(0, hh);
        for (i = 0; i < 64; i++) { var v = Math.min(1, hs[c][i] / mx); ctx.lineTo(i / 63 * w, hh - Math.sqrt(v) * (hh - 3)); }
        ctx.lineTo(w, hh); ctx.closePath(); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      var bs = pHist.querySelectorAll('.clipi b');
      bs[0].style.background = eng.stat.clip > 0.004 ? '#ff4a42' : 'transparent';
      bs[1].style.background = eng.stat.black > 0.03 ? '#4a8cff' : 'transparent';
    }

    /* ---------- звук: имитация уровня и индикаторы ---------- */
    var aud = { lv: [-60, -60, -60, -60], pk: [-60, -60, -60, -60], t: 0 };
    function audioTick(dt, time) {
      var sc = eng.scene() || sceneById(S.scene), n = S.audioCh === 'mono' ? 1 : S.audioCh === '4ch' ? 4 : 2;
      var micK = { auto: 0, back: sc.speech ? -2 : 1, bottom: -3, front: sc.speech ? -6 : -4 }[S.iphoneMic] || 0;
      for (var c = 0; c < 4; c++) {
        var target = -90;
        if (S.audioSrc !== 'none' && c < n) {
          var base = sc.audio + micK + (Math.random() - 0.5) * 6;
          if (sc.speech) { var env = Math.max(0, Math.sin(time * 3.1 + c * 0.2) * Math.sin(time * 0.9) ); base = sc.audio - 14 + env * 16 + (Math.random() - 0.5) * 5; }
          if (S.audioCh === 'dualmono' && c === 1) base -= 6;
          target = base;
        }
        var vu = S.metering.indexOf('vu') === 0, att = vu ? 6 : 30, rel = vu ? 6 : 3;
        var k = 1 - Math.exp(-dt * (target > aud.lv[c] ? att : rel));
        aud.lv[c] += (target - aud.lv[c]) * k;
        aud.pk[c] = Math.max(aud.pk[c] - dt * 12, aud.lv[c]);
      }
      if (!S.dispAudio && app.open !== 'audbig') return;
      drawMeters(audCtx, audCv.width, audCv.height, n, false);
      if (app.audBig) drawMeters(app.audBig.getContext('2d'), app.audBig.width, app.audBig.height, n, true);
    }
    function drawMeters(ctx, w, hh, n, big) {
      ctx.clearRect(0, 0, w, hh);
      var scale = [-45, -30, -20, -10, -6, -3, 0, 3], x0 = big ? 24 : 12, x1 = w - 6, rowH = Math.min(big ? 26 : 13, (hh - (big ? 30 : 20)) / Math.max(n, 2));
      function X(db) { var t = (db + 45) / 48; return x0 + clamp(t, 0, 1) * (x1 - x0); }
      var ref = S.metering.indexOf('18') > 0 ? -18 : -20;
      for (var c = 0; c < n; c++) {
        var y = 4 + c * (rowH + 3);
        ctx.fillStyle = '#1e5a26'; ctx.fillRect(x0, y, X(-12) - x0, rowH);
        ctx.fillStyle = '#5e5a1e'; ctx.fillRect(X(-12), y, X(-3) - X(-12), rowH);
        ctx.fillStyle = '#5e1e1e'; ctx.fillRect(X(-3), y, x1 - X(-3), rowH);
        var lv = aud.lv[c];
        if (lv > -45) {
          ctx.fillStyle = '#3ad24a'; ctx.fillRect(x0, y, Math.min(X(lv), X(-12)) - x0, rowH);
          if (lv > -12) { ctx.fillStyle = '#e8d43a'; ctx.fillRect(X(-12), y, Math.min(X(lv), X(-3)) - X(-12), rowH); }
          if (lv > -3) { ctx.fillStyle = '#ff3b30'; ctx.fillRect(X(-3), y, X(lv) - X(-3), rowH); }
          ctx.fillStyle = '#fff'; ctx.fillRect(X(aud.pk[c]) - 1, y, 2, rowH);
        }
        ctx.fillStyle = '#fff'; ctx.font = (big ? 12 : 9) + 'px Lato,Arial'; ctx.fillText(String(c + 1), 1, y + rowH - 1);
      }
      var yl = 4 + n * (rowH + 3) + (big ? 12 : 9);
      ctx.font = (big ? 11 : 8.5) + 'px Lato,Arial'; ctx.textAlign = 'center';
      scale.forEach(function (d) { ctx.fillStyle = '#fff'; ctx.fillText(String(d), X(d), yl); ctx.fillRect(X(d) - 0.5, yl - (big ? 22 : 13), 1, 2); });
      ctx.fillStyle = '#3a8cff'; ctx.fillRect(X(ref) - 1, 2, 2, n * (rowH + 3));
      ctx.textAlign = 'left';
    }

    /* ---------- запись ---------- */
    var rec = null, beepCtx = null;
    function beep() {
      try { beepCtx = beepCtx || new (window.AudioContext || window.webkitAudioContext)(); var o = beepCtx.createOscillator(), g = beepCtx.createGain(); o.frequency.value = 1000; g.gain.value = 0.08; o.connect(g); g.connect(beepCtx.destination); o.start(); o.stop(beepCtx.currentTime + 0.12); } catch (e) {}
    }
    function flash() { flashEl.style.transition = 'none'; flashEl.style.opacity = '0.85'; setTimeout(function () { flashEl.style.transition = 'opacity .4s'; flashEl.style.opacity = '0'; }, 60); }
    app.toggleRec = function () {
      if (S.recording) return stopRec();
      if (needsExternal(S) && S.dropFrame === 'stop') { app.toast('Запись невозможна: ProRes 4K выше 30 к/с на iPhone 15 Pro пишется только на внешний SSD (Settings → Media → Save Clips to → Pro Video Storage).', true); return; }
      S.recording = true;
      rec = { t0: app.time, frames: [], lastCap: -1, tc0: app.tcFrames, dropped: false, snap: null, maxClip: 0 };
      if (S.trigger !== 'none') beep();
      if (S.trigger === 'beeperflash') flash();
      if (needsExternal(S)) { rec.dropped = true; app.toast('Media dropped frames — носитель не успевает записывать ProRes 4K ' + curFps(S) + ' к/с. Нужен внешний SSD.', true); }
      if (app.tasks) app.tasks.onRecStart();
      app.save();
    };
    function captureFrame() {
      var c = document.createElement('canvas'); c.width = 192; c.height = 108;
      c.getContext('2d').drawImage(cv, 0, 0, 192, 108);
      try { return c.toDataURL('image/jpeg', 0.7); } catch (e) { return ''; }
    }
    app.metaNow = function () {
      var L = lensById(S.lens), face = eng.measureFace();
      return {
        scene: S.scene, sceneName: sceneById(S.scene).name, lens: L.front ? 'Front' : L.eq + ' mm', zoom: S.zoom, fps: S.fps, offSpeed: S.offSpeed, offFps: S.offFps,
        shutter: fmtShutter(S, S.shDen), shDen: S.shDen, t: shutterTime(S), shAuto: S.shAuto, iso: Math.round(S.iso), isoAuto: S.isoAuto,
        wbK: Math.round(S.wbK), wbAuto: S.wbAuto, tint: Math.round(S.tint), tintAuto: S.tintAuto, focus: S.focus, afAuto: S.afAuto,
        codec: S.codec, codecName: CODECS.filter(function (c) { return c[0] === S.codec; })[0][1], resolution: S.resolution, colorspace: S.colorspace,
        lutOn: S.lutOn, lut: S.lut, recLut: S.recLut && S.lutOn, stab: S.stab, timelapse: S.timelapse, dropped: needsExternal(S),
        reel: S.reel, sceneNo: S.sceneNo, take: S.take, interior: S.interior, day: S.day,
        clip: eng.stat.clip, meanDisp: eng.stat.meanDisp, flicker: eng.stat.flickerAmp, faceIre: face.ire, faceDepth: face.depth, focusD: focusToD(S.focus),
        stops: eng.expStops || 0,
        zebra: S.zebra, fa: S.fa, falseColor: S.falseColor, fg: S.fg, fgRatio: S.fgRatio, saveTo: S.saveTo, hdr: S.hdr, audioSrc: S.audioSrc, cinematic: S.cinematic, torch: S.torch
      };
    };
    function stopRec() {
      S.recording = false;
      if (S.trigger !== 'none') beep();
      var dur = app.time - rec.t0, L = lensById(S.lens), clipNo = app.clips.length + 1 + (app.clipBase || 18);
      var d = new Date(), stamp = pad(d.getMonth() + 1) + pad(d.getDate()) + pad(d.getHours()) + pad(d.getMinutes());
      var name = S.filename === 'ios' ? 'IMG_' + pad(4000 + clipNo, 4) : S.camName + pad(S.reel, 3) + '_' + stamp + '_C' + pad(clipNo, 3);
      if (!rec.frames.length) rec.frames.push(captureFrame());
      var meta = app.metaNow(); meta.dropped = rec.dropped;
      var clip = {
        id: Date.now(), name: name, dur: dur, frames: rec.frames, thumb: rec.frames[Math.floor(rec.frames.length / 2)] || rec.frames[0],
        playSpeed: S.offSpeed ? S.fps / S.offFps : S.timelapse ? 8 : 1,
        meta: meta,
        good: false
      };
      app.clips.push(clip);
      S.take += 1;
      if (app.tasks) app.tasks.onClip(clip);
      app.toast('Клип ' + name + ' записан (' + fmtClipDur(dur) + '). Он во вкладке Media.');
      rec = null; app.save();
    }
    app.stopRec = function () { if (S.recording) stopRec(); };
    app.recTick = function (dt) {
      if (!S.recording || !rec) return;
      var fpsE = curFps(S);
      if (S.timelapse) { var iv = { '2s': 2, '5s': 5, '10s': 10, '30s': 30, '1m': 60, '5m': 300, '10m': 600 }[S.tlInterval]; app.tcFrames += dt / iv; }
      else app.tcFrames += dt * S.fps;
      app.free = Math.max(0, app.free - totalRate(S) * 1e6 / 8 * dt);
      if (app.time - rec.lastCap > 1 / 6 && rec.frames.length < 90) { rec.frames.push(captureFrame()); rec.lastCap = app.time; }
      if (app.free <= 0) { app.toast('Носитель заполнен — запись остановлена.', true); stopRec(); }
    };

    /* ---------- сообщения ---------- */
    var toastT = null;
    app.toast = function (msg, warn) {
      var t = scr.querySelector('.bm-toast'); if (!t) { t = h('div', { cls: 'bm-toast' }); scr.appendChild(t); }
      t.textContent = msg; t.className = 'bm-toast' + (warn ? ' warn' : ''); t.style.display = '';
      clearTimeout(toastT); toastT = setTimeout(function () { t.style.display = 'none'; }, warn ? 5200 : 3200);
    };

    /* ---------- касания по кадру: AE/AF, свайпы ---------- */
    var gst = null;
    img.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.bm-dial,.bm-tools,.bm-lutp,.bm-stabp,.bm-side,.bm-card,.bm-panel,.bm-hud .it,.bm-handle,.bm-tc,.bm-fmt,.bm-bat,.bm-onoff,.bm-gridpop,.bm-slate')) return;
      gst = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    img.addEventListener('pointerup', function (e) {
      if (!gst || app.helpMode) { gst = null; return; }
      var dx = (e.clientX - gst.x) / app.scale, dy = (e.clientY - gst.y) / app.scale; gst = null;
      if (dimEl.style.opacity === '0.92') { dimEl.style.opacity = '0'; return; }
      if (Math.abs(dy) > 45 && Math.abs(dy) > Math.abs(dx)) { hud.classList.toggle('hidden'); return; }
      if (dx > 60 && Math.abs(dx) > Math.abs(dy)) { if (S.recording && S.swipeDim) { dimEl.style.opacity = '0.92'; dimEl.style.pointerEvents = 'auto'; } return; }
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
        if (app.open && app.open !== 'tools') { app.closeDial(); return; }
        var r = img.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        if (!S.afAuto && !S.shAuto && !S.isoAuto) return;
        S.tap = { x: px, y: py };
        afBox.style.left = px * 705 + 'px'; afBox.style.top = py * 397 + 'px';
        afBox.setAttribute('data-l', S.afAuto && (S.shAuto || S.isoAuto) ? 'AE/AF' : S.afAuto ? 'AF' : 'AE');
        afBox.style.display = ''; clearTimeout(app.afT); app.afT = setTimeout(function () { afBox.style.display = 'none'; }, 2200);
      }
    });
    dimEl.addEventListener('click', function () { dimEl.style.opacity = '0'; dimEl.style.pointerEvents = 'none'; });

    /* клавиши: кнопки громкости — ↑/↓, пробел */
    el.addEventListener('keydown', function (e) {
      if (e.target.closest('input,select,textarea')) return;
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === ' ') && S.volumeRec && app.view === 'camera') { e.preventDefault(); app.toggleRec(); }
      if (e.key === 'Escape') { app.closeDial(); app.closeOverlay(); }
    });

    /* ---------- сохранение ---------- */
    var saveT = null;
    app.save = function () { clearTimeout(saveT); saveT = setTimeout(function () { var o = {}; for (var k in S) if (k !== 'recording' && k !== 'tap') o[k] = S[k]; store('settings', o); }, 400); };

    /* ---------- модули ---------- */
    buildDials(app);
    buildSettings(app);
    buildMedia(app);
    buildSidePanel(app);
    buildTasks(app);
    bindHelp(app);

    /* ---------- главный цикл ---------- */
    var last = performance.now(), visible = true, acc = 0;
    app.time = 0;
    if (window.IntersectionObserver) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(el);
    function loop(now) {
      requestAnimationFrame(loop);
      var dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (!visible || document.hidden) return;
      acc += dt;
      if (acc < 1 / 30) return;
      dt = acc; acc = 0;
      app.time += dt;
      app.battery = Math.max(1, app.battery - dt * (0.0025 + (S.recording ? 0.006 : 0) + (S.torch ? 0.01 : 0)));
      if (app.view === 'camera' || S.recording) {
        eng.wantWave = app.open === 'scope';
        eng.frame(app.time, dt);
        /* вывод: стабилизация (кроп + дрожание), де-сквиз, переворот, зеркало */
        var sh = eng.shake || { x: 0, y: 0 }, crop = { off: 1, standard: 1.06, cinematic: 1.12, extreme: 1.25 }[S.stab] || 1;
        var dq = parseFloat(S.desqueeze) || 1, mir = lensById(S.lens).front && S.mirrorFront, flip = S.flipSlr;
        cv.style.transform = 'translate(' + sh.x + 'px,' + sh.y + 'px) scale(' + (crop * dq * (mir ? -1 : 1)) + ',' + crop + ')' + (flip ? ' rotate(180deg)' : '');
        cvx.drawImage(eng.out, 0, 0);
        if (S.dispHist) drawHist();
        if (app.open === 'scope') app.drawScope();
        updateHud();
        audioTick(dt, app.time);
        app.recTick(dt);
        if (app.dial) app.dial.tick();
        if (app.tasks) app.tasks.tick();
      }
      app.sideTick();
    }
    fit();
    app.go('camera');
    requestAnimationFrame(loop);
    app.showHelpText(null);
    return app;
  }
