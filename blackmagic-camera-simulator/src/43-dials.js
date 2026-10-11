  /* =====================================================================
   *  КОЛЁСА (вертикальные шкалы у правого края кадра), инструменты, LUT,
   *  стабилизация, боковые панели ⋮, оверлеи
   * ===================================================================== */
  function range(a, b, st, dec) { var r = []; for (var v = a; v <= b + 1e-9; v += st) r.push(+v.toFixed(dec == null ? 3 : dec)); return r; }
  var ZOOMS = range(0.5, 1, 0.1, 1).concat(range(1.1, 5, 0.1, 1)).concat(range(5.5, 15, 0.5, 1));
  var WB_VALUES = range(2500, 10000, 50, 0);
  var TINT_VALUES = range(-50, 50, 1, 0);
  var FOCUS_VALUES = range(0, 1, 0.002, 3);
  var EV_VALUES = range(-3, 3, 0.1, 1);
  var PCT = function (a, b) { return range(a, b, 1, 0); };

  function buildDials(app) {
    var S = app.S, img = app.img, wrap = h('div', { cls: 'bm-ov' }); wrap.style.pointerEvents = 'none'; img.appendChild(wrap);
    app.toolSel = 'zebra';
    function lensForZoom(z) { return z < 1 ? 'uw' : z < 2 ? 'w' : z < 5 ? 'w2' : 't'; }
    function setZoom(z) { S.zoom = z; if (!lensById(S.lens).front) { var nl = lensForZoom(z); if (nl !== S.lens) S.lens = nl; } app.eng.dirty = true; app.save(); }
    function setLens(id, z) { S.lens = id; S.zoom = z; app.eng.dirty = true; app.save(); }
    function manualSh() { S.shAuto = false; }
    function fpsValues() { var a = FPS_LIST.slice(); if (maxFpsFor(S) > 60) a = a.concat(FPS_HD_EXTRA); return a; }
    function shValues() {
      var fe = curFps(S);
      if (S.shutterMeas === 'angle') return SHUTTER_ANGLES.slice();
      return SHUTTER_SPEEDS.filter(function (d) { return d >= fe - 0.01; });
    }
    function ffQuick() {
      var base = S.flickerHz === '60' ? [120, 60, 40, 30] : [100, 50, 33.33, 25], fe = curFps(S);
      return base.map(function (den) {
        var lbl = S.shutterMeas === 'angle' ? (Math.round(360 * fe / den * 10) / 10) + '°' : '1/' + Math.round(den);
        return { label: lbl, h: 'shutter', dis: function () { return den < fe - 0.01 || S.shLock; }, on: function () { return !S.shAuto && Math.abs(1 / shutterTime(S) - den) < 0.6; },
          act: function () { manualSh(); S.shDen = den; S.shAngle = Math.round(360 * fe / den * 10) / 10; } };
      });
    }
    var WBI = { daylight: IC.sun, incandescent: IC.bulb, fluorescent: IC.fluo, shade: IC.shade, cloud: IC.cloud };

    var DEFS = {
      lens: function () { return {
        values: ZOOMS, cur: function () { return lensById(S.lens).front ? 1 : S.zoom; }, set: function (v) { if (lensById(S.lens).front) S.lens = 'w'; setZoom(v); }, label: function (v) { return (Math.round(v * 10) / 10) + 'x'; },
        top: [{ icon: IC.reset, h: 'zoomReset', act: function () { setLens('w', 1); } }],
        quick: [
          { icon: IC.lensSmall, small: '120mm', h: 'lens', on: function () { return S.lens === 't'; }, act: function () { setLens('t', 5); } },
          { icon: IC.lensSmall, small: '48mm', h: 'lens', on: function () { return S.lens === 'w2'; }, act: function () { setLens('w2', 2); } },
          { icon: IC.lensSmall, small: '24mm', h: 'lens', on: function () { return S.lens === 'w'; }, act: function () { setLens('w', 1); } },
          { icon: IC.lensSmall, small: '13mm', h: 'lens', on: function () { return S.lens === 'uw'; }, act: function () { setLens('uw', 0.5); } },
          { icon: IC.front, small: 'Front', h: 'front', on: function () { return S.lens === 'f'; }, act: function () { setLens('f', 1); } }
        ],
        bottom: [{ icon: IC.switchCam, h: 'front', act: function () { if (S.lens === 'f') setLens('w', 1); else setLens('f', 1); } }]
      }; },
      fps: function () { return {
        values: S.offSpeed ? OFFSPEED_LIST.filter(function (f) { return f <= maxFpsFor(S); }) : fpsValues(),
        cur: function () { return S.offSpeed ? S.offFps : S.fps; },
        set: function (v) { if (S.offSpeed) S.offFps = v; else S.fps = v; if (!S.shAuto && S.shutterMeas === 'speed' && S.shDen < curFps(S)) S.shDen = curFps(S); app.save(); },
        label: function (v) { return String(v); },
        top: [{ label: 'OFF/<br>SPEED', h: 'offspeed', on: function () { return S.offSpeed; }, act: function () { S.offSpeed = !S.offSpeed; if (S.offSpeed && S.offFps > maxFpsFor(S)) S.offFps = 60; app.reopenDial(); } }],
        bottom: [{ label: 'TIME<br>LAPSE', h: 'timelapseBtn', on: function () { return S.timelapse; }, act: function () { S.timelapse = !S.timelapse; app.toast(S.timelapse ? 'Таймлапс включён: 1 кадр каждые ' + S.tlInterval.replace('s', ' с').replace('m', ' мин') + '.' : 'Таймлапс выключен.'); } }]
      }; },
      shutter: function () { return {
        values: shValues(),
        cur: function () { return S.shutterMeas === 'angle' ? (S.shAuto ? 360 * curFps(S) / S.shDen : S.shAngle) : 1 / shutterTime(S); },
        set: function (v) { if (S.shLock) return; manualSh(); if (S.shutterMeas === 'angle') { S.shAngle = v; S.shDen = 360 * curFps(S) / v; } else { S.shDen = v; S.shAngle = 360 * curFps(S) / v; } app.save(); },
        label: function (v) { return S.shutterMeas === 'angle' ? v + '°' : '1/' + Math.round(v); },
        top: [{ icon: IC.lock, h: 'lock', on: function () { return S.shLock; }, act: function () { S.shLock = !S.shLock; if (S.shLock) S.shAuto = false; } }],
        quick: ffQuick()
      }; },
      iso: function () { var L = lensById(S.lens); return {
        values: ISO_FINE.filter(function (v) { return v >= L.isoMin && v <= L.isoMax; }),
        cur: function () { return S.iso; }, set: function (v) { if (S.isoLock) return; S.isoAuto = false; S.iso = v; app.save(); }, label: function (v) { return String(Math.round(v)); },
        top: [{ icon: IC.lock, h: 'lock', on: function () { return S.isoLock; }, act: function () { S.isoLock = !S.isoLock; if (S.isoLock) S.isoAuto = false; } }],
        quick: ISO_QUICK.map(function (v) { return { label: String(v), h: 'iso', dis: function () { return v < L.isoMin || v > L.isoMax || S.isoLock; }, on: function () { return !S.isoAuto && Math.abs(S.iso - v) < 1; }, act: function () { S.isoAuto = false; S.iso = v; } }; })
      }; },
      wb: function () { return {
        values: WB_VALUES, cur: function () { return S.wbK; }, set: function (v) { if (S.wbLock) return; S.wbAuto = false; S.wbK = v; app.save(); }, label: function (v) { return Math.round(v) + 'K'; },
        top: [{ label: 'AUTO', h: 'auto', on: function () { return S.wbAuto; }, act: function () { S.wbAuto = !S.wbAuto; S.wbLock = false; } }, { icon: IC.lock, h: 'lock', on: function () { return S.wbLock; }, act: function () { S.wbLock = !S.wbLock; if (S.wbLock) S.wbAuto = false; } }],
        quick: WB_PRESETS.map(function (p) { return { icon: WBI[p.id], h: 'wb', title: p.name + ' ' + p.K + 'K', on: function () { return !S.wbAuto && Math.abs(S.wbK - p.K) < 1; }, act: function () { if (S.wbLock) return; S.wbAuto = false; S.wbK = p.K; } }; })
      }; },
      tint: function () { return {
        values: TINT_VALUES, cur: function () { return S.tint; }, set: function (v) { if (S.tintLock) return; S.tintAuto = false; S.tint = v; app.save(); }, label: function (v) { return String(Math.round(v)); },
        top: [{ label: 'AUTO', h: 'auto', on: function () { return S.tintAuto; }, act: function () { S.tintAuto = !S.tintAuto; S.tintLock = false; } }, { icon: IC.lock, h: 'lock', on: function () { return S.tintLock; }, act: function () { S.tintLock = !S.tintLock; if (S.tintLock) S.tintAuto = false; } }],
        quick: WB_PRESETS.map(function (p) { return { icon: WBI[p.id], h: 'tint', title: p.name + ' tint ' + p.tint, on: function () { return !S.tintAuto && Math.abs(S.tint - p.tint) < 0.5; }, act: function () { if (S.tintLock) return; S.tintAuto = false; S.tint = p.tint; } }; })
      }; },
      focus: function () { return {
        values: FOCUS_VALUES, cur: function () { return S.focus; }, set: function (v) { S.afAuto = false; S.focus = v; }, label: function (v) { return v.toFixed(3); },
        top: [{ label: 'AUTO', h: 'auto', on: function () { return S.afAuto; }, act: function () { S.afAuto = !S.afAuto; } }],
        bottom: [{ icon: IC.mount, h: 'rackFocus', on: function () { return app.rackOpen; }, act: function () { app.rackOpen = !app.rackOpen; app.reopenDial(); } }],
        mid: app.rackOpen ? [0, 1, 2].map(function (i) {
          return { label: (S['rack' + i] != null ? S['rack' + i].toFixed(2) : '+') + '<br><small>' + 'ABC'[i] + '</small>', h: 'rackFocus', on: function () { return S['rack' + i] != null && Math.abs(S.focus - S['rack' + i]) < 0.003; },
            act: function () { if (S['rack' + i] == null) { S['rack' + i] = S.focus; app.toast('Точка фокуса ' + 'ABC'[i] + ' сохранена. Нажмите ещё раз, чтобы перевести фокус.'); app.reopenDial(); } else { S.afAuto = false; app.rackTo(S['rack' + i]); } } };
        }) : null
      }; },
      exposure: function () { return {
        values: EV_VALUES, cur: function () { return S.ev; }, set: function (v) { S.ev = v; app.save(); }, label: function (v) { return (v > 0 ? '+' : v < 0 ? '' : '') + v.toFixed(1); },
        top: [{ label: 'AUTO', h: 'auto', on: function () { return S.shAuto && S.isoAuto; }, act: function () { var on = !(S.shAuto && S.isoAuto); S.shAuto = S.isoAuto = on; S.shLock = S.isoLock = false; if (!on) { S.shAuto = false; S.isoAuto = false; } } }]
      }; }
    };
    /* шкалы инструментов */
    var TOOLDEFS = {
      zebra: function () { return { values: PCT(75, 100), cur: function () { return S.zebraLvl; }, set: function (v) { S.zebraLvl = v; S.zebraMode = 'level'; }, label: function (v) { return v + '%'; },
        mid: [{ label: 'Mid<br>Grey', h: 'mgZebra', on: function () { return S.zebraMode === 'mg'; }, act: function () { S.zebraMode = S.zebraMode === 'mg' ? 'level' : 'mg'; S.zebra = true; } },
              { label: 'MG+1', h: 'mgZebra', on: function () { return S.zebraMode === 'mg1'; }, act: function () { S.zebraMode = S.zebraMode === 'mg1' ? 'level' : 'mg1'; S.zebra = true; } }] }; },
      fa: function () { return { values: PCT(0, 100), cur: function () { return S.faLvl; }, set: function (v) { S.faLvl = v; }, label: function (v) { return v + '%'; } }; },
      fg: function () { return { values: FRAME_GUIDES.map(function (r, i) { return i; }), cur: function () { return FRAME_GUIDES.indexOf(S.fgRatio); }, set: function (v) { S.fgRatio = FRAME_GUIDES[v]; }, label: function (v) { return FRAME_GUIDES[v]; } }; },
      safe: function () { return { values: PCT(5, 100), cur: function () { return S.safeLvl; }, set: function (v) { S.safeLvl = v; }, label: function (v) { return v + '%'; } }; },
      torch: function () { return { values: PCT(0, 100), cur: function () { return S.torchLvl; }, set: function (v) { S.torchLvl = v; S.torchAuto = false; app.eng.dirty = true; }, label: function (v) { return v + '%'; },
        mid: [{ label: 'AUTO', h: 'torch', on: function () { return S.torchAuto; }, act: function () { S.torchAuto = !S.torchAuto; app.eng.dirty = true; } }] }; },
      grid: function () { return null; }, falsecolor: function () { return null; }
    };
    var TOOLS = [['zebra', IC.zebra, 'zebra', 'zebra'], ['fa', IC.faPerson, 'fa', 'fa'], ['grid', IC.grid, 'grid', 'grid'], ['fg', IC.fguide, 'fg', 'fg'], ['safe', IC.safe, 'safe', 'safe'], ['falsecolor', IC.falsecolor, 'falseColor', 'falsecolor'], ['torch', IC.torch, 'torch', 'torch']];

    /* ---------- универсальная шкала ---------- */
    var cur = null;   // { id, spec, root, cv, idx }
    function mkBtn(b, cls) {
      var e = h('button', { cls: cls, type: 'button', 'data-h': b.h || '' }, (b.icon || '') + (b.label ? '<span>' + b.label + '</span>' : '') + (b.small ? '<small>' + b.small + '</small>' : ''));
      if (b.title) e.title = b.title;
      e.onclick = function (ev) { ev.stopPropagation(); b.act(); app.updateHud(); refreshBtns(); app.save(); };
      e.__b = b; return e;
    }
    function refreshBtns() {
      if (!cur) return;
      cur.root.querySelectorAll('button').forEach(function (e) { var b = e.__b; if (!b) return; e.classList.toggle('on', !!(b.on && b.on())); e.classList.toggle('dis', !!(b.dis && b.dis())); });
      if (cur.tools) refreshTools();
    }
    function buildScale(spec, container, offsetRight) {
      var d = h('div', { cls: 'bm-dial', 'data-h': cur.helpKey });
      if (offsetRight) d.style.right = offsetRight + 'px';
      var cvs = h('canvas'); d.appendChild(cvs);
      var bub = h('div', { cls: 'bm-bub' }); d.appendChild(bub);
      container.appendChild(d);
      cur.cv = cvs; cur.bub = bub; cur.spec = spec; cur.scaleEl = d;
      /* перетаскивание */
      var drag = null;
      d.addEventListener('pointerdown', function (e) {
        if (app.helpMode || e.target.closest('button')) return;
        e.preventDefault(); e.stopPropagation();
        drag = { y: e.clientY, i0: nearestIdx(spec.values, spec.cur()), moved: false };
        try { d.setPointerCapture(e.pointerId); } catch (er) {}
      });
      d.addEventListener('pointermove', function (e) {
        if (!drag) return;
        var dy = (e.clientY - drag.y) / app.scale, step = spacing(spec);
        if (Math.abs(dy) > 2) drag.moved = true;
        var ni = clamp(Math.round(drag.i0 + dy / step), 0, spec.values.length - 1);
        if (spec.values[ni] !== spec.cur()) { spec.set(spec.values[ni]); app.updateHud(); }
        draw();
      });
      d.addEventListener('pointerup', function () { drag = null; app.save(); });
      d.addEventListener('wheel', function (e) {
        e.preventDefault(); var i = nearestIdx(spec.values, spec.cur());
        var ni = clamp(i + (e.deltaY < 0 ? 1 : -1) * (spec.values.length > 300 ? 5 : 1), 0, spec.values.length - 1);
        spec.set(spec.values[ni]); app.updateHud(); draw(); app.save();
      }, { passive: false });
      draw();
    }
    function spacing(spec) { var n = spec.values.length; return n > 300 ? 2.2 : n > 100 ? 3.4 : n > 40 ? 7 : 14; }
    function draw() {
      if (!cur || !cur.cv) return;
      var spec = cur.spec, cv = cur.cv, dpr = (window.devicePixelRatio || 1) * (app.scale || 1), W = 40, Hh = 397;
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr); }
      var ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, Hh);
      var vals = spec.values, v = spec.cur(), i0 = nearestIdx(vals, v), step = spacing(spec), every = Math.max(1, Math.ceil(34 / step));
      /* точная позиция для дробных значений (автоматика) */
      var frac = i0;
      if (i0 < vals.length - 1 && vals[i0] !== v && typeof v === 'number') {
        var nb = v > vals[i0] ? i0 + 1 : i0 - 1; if (nb >= 0 && nb < vals.length && vals[nb] !== vals[i0]) frac = i0 + (v - vals[i0]) / (vals[nb] - vals[i0]) * (nb - i0);
      }
      ctx.font = '7.5px Lato,Arial'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (var i = 0; i < vals.length; i++) {
        var y = Hh / 2 - (i - frac) * step; if (y < 8 || y > Hh - 8) continue;
        var major = i % every === 0;
        ctx.strokeStyle = major ? 'rgba(255,255,255,.8)' : 'rgba(255,255,255,.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(major ? 24 : 28, y + 0.5); ctx.lineTo(36, y + 0.5); ctx.stroke();
        if (major) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillText(String(spec.label(vals[i])).replace(/<[^>]+>/g, ''), 21, y); }
      }
      ctx.fillStyle = '#3a8cff'; ctx.fillRect(18, Hh / 2 - 0.75, 22, 1.5);
      setBub(spec.label(typeof v === 'number' && spec.values === FOCUS_VALUES ? v : (typeof v === 'number' && Math.abs(v - vals[i0]) > 1e-6 && cur.id !== 'fg' ? v : vals[i0])));
    }
    function setBub(t) { if (cur.bub.__t !== t) { cur.bub.__t = t; cur.bub.innerHTML = t; } }

    function open(id) {
      close();
      app.open = id; cur = { id: id };
      var root = h('div', { cls: 'bm-ov' }); root.style.pointerEvents = 'none'; wrap.appendChild(root); cur.root = root;
      if (id === 'tools') return openTools(root);
      if (id === 'lut') return openLut(root);
      if (id === 'stab') return openStab(root);
      var spec = DEFS[id](); cur.helpKey = { lens: 'lens', fps: 'fps', shutter: 'shutter', iso: 'iso', wb: 'wb', tint: 'tint', focus: 'focus', exposure: 'exposure' }[id];
      buildScale(spec, root, 0);
      decorate(spec, root, cur.scaleEl);
      refreshBtns();
    }
    function decorate(spec, root, scaleEl) {
      if (spec.quick) { var qc = h('div', { cls: 'bm-qc' }); spec.quick.forEach(function (b) { qc.appendChild(mkBtn(b, 'bm-q')); }); scaleEl.appendChild(qc); }
      if (spec.top) { var tp = h('div', { cls: 'bm-dtop' }); spec.top.forEach(function (b) { tp.appendChild(mkBtn(b, 'tb')); }); scaleEl.appendChild(tp); }
      if (spec.bottom) { var bt = h('div', { cls: 'bm-dbot' }); spec.bottom.forEach(function (b) { bt.appendChild(mkBtn(b, 'tb')); }); scaleEl.appendChild(bt); }
      if (spec.mid) { var md = h('div', { cls: 'bm-midbtn' }); spec.mid.forEach(function (b) { md.appendChild(mkBtn(b, 'tb')); }); scaleEl.appendChild(md); }
    }
    function close() { if (cur && cur.root) cur.root.remove(); cur = null; app.open = null; }
    app.toggleDial = function (id) { if (app.helpMode) return; if (app.open === id) { close(); app.updateHud(); return; } closeSideOnly(); open(id); app.updateHud(); };
    app.closeDial = function () { close(); app.updateHud(); };
    app.reopenDial = function () { if (!cur) return; var id = cur.id, ts = app.toolSel; close(); app.toolSel = ts; open(id); };
    app.dial = { redraw: function () { draw(); }, tick: function () { if (cur && cur.cv) draw(); if (cur) refreshBtns(); } };

    /* перевод фокуса */
    app.rackTo = function (target) {
      var from = S.focus, t0 = performance.now(), dur = 1400;
      function st(now) { var k = clamp((now - t0) / dur, 0, 1), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; S.focus = from + (target - from) * e; if (k < 1) requestAnimationFrame(st); }
      requestAnimationFrame(st);
    };

    /* ---------- инструменты монитора ---------- */
    function toolOn(id) { return id === 'falsecolor' ? S.falseColor : S[id]; }
    function setToolOn(id, v) { if (id === 'falsecolor') S.falseColor = v; else S[id] = v; if (id === 'torch') app.eng.dirty = true; }
    function openTools(root) {
      cur.tools = true;
      var col = h('div', { cls: 'bm-tools' }); root.appendChild(col);
      TOOLS.forEach(function (t) {
        var b = h('button', { cls: 'bm-tl', type: 'button', 'data-h': t[3] }, t[1] + (t[0] === 'torch' ? '<span class="lv"></span>' : ''));
        b.onclick = function (e) { e.stopPropagation(); if (app.toolSel === t[0]) setToolOn(t[0], !toolOn(t[0])); app.toolSel = t[0]; buildToolScale(); refreshTools(); app.save(); };
        b.__t = t[0]; col.appendChild(b);
      });
      var onoff = h('button', { cls: 'bm-onoff', type: 'button', 'data-h': 'tools' }, 'OFF'); root.appendChild(onoff); cur.onoff = onoff;
      onoff.onclick = function (e) { e.stopPropagation(); var t = app.toolSel; setToolOn(t, !toolOn(t)); refreshTools(); app.save(); };
      cur.col = col;
      buildToolScale(); refreshTools();
    }
    function buildToolScale() {
      if (cur.toolRoot) cur.toolRoot.remove();
      var r = h('div', { cls: 'bm-ov' }); r.style.pointerEvents = 'none'; cur.root.insertBefore(r, cur.root.firstChild); cur.toolRoot = r;
      cur.cv = null;
      var t = app.toolSel, spec = TOOLDEFS[t] ? TOOLDEFS[t]() : null;
      cur.helpKey = { zebra: 'zebra', fa: 'fa', grid: 'grid', fg: 'fg', safe: 'safe', falsecolor: 'falsecolor', torch: 'torch' }[t];
      if (t === 'grid') {
        var gp = h('div', { cls: 'bm-gridpop' });
        [['gridThirds', IC.grid, 'Thirds'], ['gridHorizon', svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 12h10M12 9v6"/><path d="M7 9h3" />'), 'Horizon'], ['gridCross', svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 12h4M12 10v4"/>'), 'Crosshair'], ['gridDot', svg('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/>'), 'Centre Dot']].forEach(function (g) {
          var b = h('button', { cls: 'tl', type: 'button', 'data-h': 'grid', title: g[2] }, g[1]);
          b.onclick = function (e) { e.stopPropagation(); S[g[0]] = !S[g[0]]; S.grid = S.gridThirds || S.gridHorizon || S.gridCross || S.gridDot; refreshTools(); app.save(); };
          b.__g = g[0]; gp.appendChild(b);
        });
        r.appendChild(gp); cur.gridPop = gp;
      } else cur.gridPop = null;
      if (spec) { buildScale(spec, r, 44); cur.scaleEl.style.width = '110px'; decorate(spec, r, cur.scaleEl); }
    }
    function refreshTools() {
      if (!cur || !cur.col) return;
      cur.col.querySelectorAll('.bm-tl').forEach(function (b) { b.classList.toggle('sel', b.__t === app.toolSel); b.classList.toggle('en', !!toolOn(b.__t)); var lv = b.querySelector('.lv'); if (lv) lv.textContent = S.torchAuto ? 'A' : S.torchLvl; });
      var on = toolOn(app.toolSel); cur.onoff.textContent = on ? 'ON' : 'OFF'; cur.onoff.classList.toggle('on', !!on);
      if (cur.gridPop) cur.gridPop.querySelectorAll('.tl').forEach(function (b) { b.classList.toggle('on', !!S[b.__g]); });
      if (cur.toolRoot) cur.toolRoot.querySelectorAll('button').forEach(function (e) { var b = e.__b; if (b) e.classList.toggle('on', !!(b.on && b.on())); });
    }

    /* ---------- LUT ---------- */
    function openLut(root) {
      var p = h('div', { cls: 'bm-lutp', 'data-h': 'lutBtn' }); root.appendChild(p);
      var onoff = h('button', { cls: 'bm-onoff', type: 'button', 'data-h': 'lutBtn' }); onoff.style.right = '6px'; p.appendChild(onoff);
      var lst = h('div', { cls: 'lst' }); p.appendChild(lst);
      var rl = h('button', { cls: 'bm-q', type: 'button', 'data-h': 'recLutBtn', style: 'position:absolute;right:6px;bottom:8px' }, IC.recLut); p.appendChild(rl);
      function render() {
        onoff.textContent = S.lutOn ? 'ON' : 'OFF'; onoff.classList.toggle('on', S.lutOn);
        rl.classList.toggle('on', S.recLut && S.lutOn); rl.classList.toggle('dis', !S.lutOn);
        lst.innerHTML = '';
        LUTS.forEach(function (L, i) {
          if (!S.bmLuts || !S.lutEnabled[i]) return;
          var r = h('button', { cls: 'bm-lr' + (S.lut === L.id ? ' on' : '') + (S.lutOn ? ' lon' : ''), type: 'button', 'data-h': 'lutBtn', 'data-lut': L.id }, '<span>' + L.name + '</span><i class="bm-chip">' + L.chip.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('') + '</i>');
          r.onclick = function (e) { e.stopPropagation(); S.lut = L.id; S.lutOn = true; render(); app.save(); app.showHelpText(L.name, 'LUT', L.about); };
          lst.appendChild(r);
        });
        if (!lst.children.length) lst.innerHTML = '<div style="font-size:10px;color:#aaa;padding:6px">Нет включённых LUT. Settings → LUTs → LUTs Manager.</div>';
      }
      onoff.onclick = function (e) { e.stopPropagation(); S.lutOn = !S.lutOn; if (!S.lutOn) S.recLut = false; render(); app.save(); };
      rl.onclick = function (e) { e.stopPropagation(); if (!S.lutOn) return; S.recLut = !S.recLut; render(); app.toast(S.recLut ? 'LUT будет вшит в запись (Record LUT to Clip).' : 'LUT только на экране, в файл пишется исходный сигнал.'); app.save(); };
      render();
    }
    /* ---------- стабилизация ---------- */
    function openStab(root) {
      var p = h('div', { cls: 'bm-stabp', 'data-h': 'stabBtn' }); root.appendChild(p);
      [['off', 'Off'], ['standard', 'Standard'], ['cinematic', 'Cinematic'], ['extreme', 'Extreme']].forEach(function (o) {
        var b = h('button', { type: 'button', 'data-h': 'stabBtn' }, o[1]); b.classList.toggle('on', S.stab === o[0]);
        b.onclick = function (e) { e.stopPropagation(); S.stab = o[0]; p.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); app.save(); app.updateHud(); };
        p.appendChild(b);
      });
    }

    /* ---------- боковые панели ⋮ ---------- */
    var sideEl = null, sideWhich = null;
    function closeSideOnly() { if (sideEl) { sideEl.remove(); sideEl = null; sideWhich = null; } }
    app.toggleSide = function (w) {
      if (app.helpMode) return;
      if (sideWhich === w) { closeSideOnly(); return; }
      closeSideOnly(); close(); app.updateHud();
      sideWhich = w; sideEl = h('div', { cls: 'bm-side' }); sideEl.style[w === 'left' ? 'left' : 'right'] = '22px';
      if (w === 'left') {
        [[IC.presets, 'presets', function () { app.toggleOverlay('presets'); }], [IC.slate, 'slate', function () { app.toggleOverlay('slate'); }], [IC.remote, 'remoteCam', function () { if (!S.remoteOn) app.toast('Remote Camera Control выключен (Settings → Remote Camera Control).'); }]].forEach(function (b, i) {
          var e = h('button', { type: 'button', 'data-h': b[1] }, b[0]); if (i === 2 && !S.remoteOn) e.classList.add('dis'); e.onclick = function (ev) { ev.stopPropagation(); b[2](); }; sideEl.appendChild(e);
        });
      } else {
        ['f1', 'f2', 'f3'].forEach(function (f) {
          var fn = S[f], e = h('button', { type: 'button', 'data-h': 'fbutton', title: FUNCTIONS.filter(function (x) { return x[0] === fn; })[0][1] }, f.toUpperCase());
          if (!S.fbOn || fn === 'none') e.classList.add('dis');
          if (fnActive(fn)) e.classList.add('on');
          e.onclick = function (ev) { ev.stopPropagation(); if (!S.fbOn) return app.toast('Функциональные кнопки выключены: Settings → Function Buttons.'); if (fn === 'none') return app.toast('Кнопке ' + f.toUpperCase() + ' не назначена функция: Settings → Function Buttons → ' + f.toUpperCase() + '.'); runFn(fn); e.classList.toggle('on', fnActive(fn)); };
          sideEl.appendChild(e);
        });
      }
      app.img.appendChild(sideEl);
    };
    function fnActive(fn) {
      return { zebra: S.zebra, focusassist: S.fa, falsecolor: S.falseColor, frameguide: S.fg, grid: S.grid, safearea: S.safe, lut: S.lutOn, cleanfeed: app.hud.classList.contains('hidden'), torch: S.torch, stab: S.stab !== 'off', aelock: S.shLock && S.isoLock, wblock: S.wbLock }[fn] || false;
    }
    function runFn(fn) {
      switch (fn) {
        case 'zebra': S.zebra = !S.zebra; break; case 'focusassist': S.fa = !S.fa; break; case 'falsecolor': S.falseColor = !S.falseColor; break;
        case 'frameguide': S.fg = !S.fg; break; case 'grid': S.grid = !S.grid; if (S.grid && !(S.gridThirds || S.gridHorizon || S.gridCross || S.gridDot)) S.gridThirds = true; break;
        case 'safearea': S.safe = !S.safe; break; case 'lut': S.lutOn = !S.lutOn; break; case 'cleanfeed': app.hud.classList.toggle('hidden'); break;
        case 'torch': S.torch = !S.torch; app.eng.dirty = true; break; case 'stab': S.stab = S.stab === 'off' ? 'standard' : 'off'; break;
        case 'aelock': var on = !(S.shLock && S.isoLock); S.shLock = S.isoLock = on; if (on) { S.shAuto = false; S.isoAuto = false; } break;
        case 'wblock': S.wbLock = !S.wbLock; if (S.wbLock) S.wbAuto = false; break;
        case 'goodtake': if (app.clips.length) { var c = app.clips[app.clips.length - 1]; c.good = !c.good; app.toast(c.good ? 'Клип ' + c.name + ' отмечен как удачный дубль.' : 'Отметка удачного дубля снята.'); } else app.toast('Пока нет записанных клипов.'); break;
      }
      app.save(); app.updateHud();
    }
    app.runFn = runFn;

    /* ---------- оверлеи: пресеты, слейт, осциллограф, аудио ---------- */
    var ovEl = null;
    app.closeOverlay = function () { if (ovEl) { ovEl.remove(); ovEl = null; } if (app.open === 'scope' || app.open === 'audbig') app.open = null; app.audBig = null; app.overlay = null; };
    app.toggleOverlay = function (id) {
      if (app.helpMode) return;
      if (app.overlay === id) { app.closeOverlay(); return; }
      app.closeOverlay(); closeSideOnly(); close();
      app.overlay = id;
      if (id === 'presets') ovEl = buildPresets();
      if (id === 'slate') ovEl = buildSlate();
      if (id === 'scope') { app.open = 'scope'; ovEl = buildScope(); }
      if (id === 'audbig') { app.open = 'audbig'; ovEl = h('div', { cls: 'bm-card bm-audbig', 'data-h': 'meters' }, '<div>' + (S.audioSrc === 'none' ? 'No Audio' : 'iPhone Microphone') + '</div><canvas width="540" height="180"></canvas>'); app.audBig = ovEl.querySelector('canvas'); ovEl.onclick = app.closeOverlay; }
      (id === 'slate' ? app.views.camera : app.img).appendChild(ovEl);
      app.updateHud();
    };
    function buildPresets() {
      var c = h('div', { cls: 'bm-card bm-presets', 'data-h': 'presets' }), sel = null;
      function list() { return store('presets') || []; }
      function render() {
        var ps = list();
        c.innerHTML = '<h4>Presets</h4>' + (ps.length ? '<div class="lst">' + ps.map(function (p, i) { return '<button type="button" class="pr' + (sel === i ? ' on' : '') + '" data-i="' + i + '" data-h="presets">' + esc(p.name) + '</button>'; }).join('') + '</div>' :
          '<div class="empty">No presets currently created.<br>Create a preset using your current settings<br>by pressing the + icon</div>') +
          '<div class="bar"><button type="button" data-a="add" data-h="presets">' + IC.plus + '</button><button type="button" data-a="apply" data-h="presets">' + IC.check + '</button><button type="button" data-a="over" data-h="presets">' + IC.refresh + '</button><button type="button" data-a="ren" data-h="presets">' + IC.pencil + '</button><button type="button" data-a="del" data-h="presets">' + IC.trash + '</button></div>';
      }
      c.addEventListener('click', function (e) {
        e.stopPropagation(); var b = e.target.closest('button'); if (!b || app.helpMode) return;
        var ps = list();
        if (b.dataset.i != null) { sel = +b.dataset.i; render(); return; }
        var a = b.dataset.a;
        if (a === 'add') { ps.push({ name: 'Preset ' + (ps.length + 1) + ' · ' + sceneById(S.scene).short, s: app.presetSnapshot() }); store('presets', ps); sel = ps.length - 1; app.toast('Пресет сохранён из текущих настроек.'); }
        if (sel == null || !ps[sel]) { render(); return; }
        if (a === 'apply') { app.applyPreset(ps[sel].s); app.toast('Пресет «' + ps[sel].name + '» применён.'); }
        if (a === 'over') { ps[sel].s = app.presetSnapshot(); store('presets', ps); app.toast('Пресет перезаписан текущими настройками.'); }
        if (a === 'ren') { ps[sel].name = ps[sel].name.indexOf('★ ') === 0 ? ps[sel].name.slice(2) : '★ ' + ps[sel].name; store('presets', ps); }
        if (a === 'del') { ps.splice(sel, 1); store('presets', ps); sel = null; }
        render();
      });
      render(); return c;
    }
    var PRESET_KEYS = ['codec', 'bitrate', 'resolution', 'colorspace', 'hdr', 'fps', 'offSpeed', 'offFps', 'shAuto', 'shDen', 'shAngle', 'isoAuto', 'iso', 'wbAuto', 'wbK', 'tintAuto', 'tint', 'lutOn', 'lut', 'recLut', 'stab', 'shutterMeas', 'flickerHz', 'lens', 'zoom', 'zebra', 'zebraLvl', 'fa', 'fg', 'fgRatio', 'falseColor', 'grid', 'gridThirds', 'audioFmt', 'audioCh'];
    app.presetSnapshot = function () { var o = {}; PRESET_KEYS.forEach(function (k) { o[k] = S[k]; }); return o; };
    app.applyPreset = function (o) { for (var k in o) if (PRESET_KEYS.indexOf(k) >= 0) S[k] = o[k]; app.eng.dirty = true; app.save(); app.updateHud(); };

    var slatePage = 0;
    function buildSlate() {
      var c = h('div', { cls: 'bm-slate', 'data-h': 'slate' });
      function step(k, lbl) { return '<div class="bm-sc" data-h="slate"><div class="l">' + lbl + '</div><div class="bm-step"><button type="button" data-k="' + k + '" data-d="-1">' + IC.chevL + '</button><b>' + S[k] + '</b><button type="button" data-k="' + k + '" data-d="1">' + IC.chevR + '</button></div></div>'; }
      function tg(k, v, lbl) { return '<button type="button" class="bm-tg' + (S[k] === v ? ' on' : '') + '" data-t="' + k + '" data-v="' + v + '" data-h="slate">' + lbl + '</button>'; }
      function field(k, lbl, ph) { return '<div class="bm-sc" data-h="slate"><div class="l">' + lbl + '</div><input data-f="' + k + '" value="' + esc(S[k] || '') + '" placeholder="' + ph + '"></div>'; }
      function render() {
        var L = lensById(S.lens), last = app.clips[app.clips.length - 1];
        var html = '<button type="button" class="x" data-x="1" data-h="slate">' + IC.close + '</button>';
        if (slatePage === 0) {
          html += '<div class="bm-sg" style="grid-template-columns:1fr 1fr"><div class="bm-sc"><div class="l">SLATE FOR</div><div class="v">Next Clip</div></div><div class="bm-sc"><div class="l">LENS DATA</div><div class="v">iPhone 15 Pro Max ' + (L.front ? 'Front' : L.eq + 'mm') + '</div></div></div>' +
            '<div class="bm-sg" style="grid-template-columns:1fr 1fr 1fr;margin-top:3px">' + step('reel', 'REEL') + step('sceneNo', 'SCENE') + step('take', 'TAKE') + '</div>' +
            '<div class="bm-sg" style="grid-template-columns:1.6fr 1fr 1fr 1fr 1fr;margin-top:3px"><button type="button" class="bm-tg' + (last && last.good ? ' on' : '') + '" data-good="1" data-h="slate">Good Take Last Clip</button>' + tg('interior', true, 'Interior') + tg('interior', false, 'Exterior') + tg('day', true, 'Day') + tg('day', false, 'Night') + '</div>';
        } else {
          html += '<div class="bm-sg" style="grid-template-columns:1fr 1fr">' + field('prodName', 'PRODUCTION NAME', 'Название проекта') + '<div class="bm-sc"><div class="l">CAMERA IDENT</div><div class="v">' + esc(S.camName) + '</div></div>' + field('director', 'DIRECTOR', 'Режиссёр') + field('operator', 'CAMERA OPERATOR', 'Оператор') + '</div>';
        }
        html += '<div class="bm-dots"><i class="' + (slatePage === 0 ? 'on' : '') + '" data-p="0"></i><i class="' + (slatePage === 1 ? 'on' : '') + '" data-p="1"></i></div>';
        c.innerHTML = html;
      }
      c.addEventListener('click', function (e) {
        e.stopPropagation(); if (app.helpMode) return;
        var b = e.target.closest('[data-k],[data-t],[data-good],[data-x],[data-p]'); if (!b) return;
        if (b.dataset.x) { app.closeOverlay(); return; }
        if (b.dataset.p != null) { slatePage = +b.dataset.p; render(); return; }
        if (b.dataset.k) { S[b.dataset.k] = Math.max(1, S[b.dataset.k] + +b.dataset.d); }
        if (b.dataset.t) S[b.dataset.t] = b.dataset.v === 'true';
        if (b.dataset.good) { var last = app.clips[app.clips.length - 1]; if (last) { last.good = !last.good; app.toast(last.good ? 'Предыдущий клип ' + last.name + ' отмечен как удачный дубль.' : 'Отметка снята.'); } else app.toast('Ещё нет записанных клипов.'); }
        render(); app.save();
      });
      c.addEventListener('input', function (e) { var f = e.target.dataset.f; if (f) { S[f] = e.target.value; app.save(); } });
      render(); return c;
    }
    var scopePage = 0, scopeOp = 100;
    function buildScope() {
      var c = h('div', { cls: 'bm-card bm-scope', 'data-h': 'hist' }, '<canvas width="860" height="480"></canvas><div class="ctr"><input type="range" min="10" max="100" value="' + scopeOp + '"><span class="op">' + scopeOp + '%</span><div class="pg"><i data-p="0"></i><i data-p="1"></i><i data-p="2"></i></div></div>');
      app.scopeCv = c.querySelector('canvas');
      c.querySelector('input').oninput = function (e) { scopeOp = +e.target.value; c.querySelector('.op').textContent = scopeOp + '%'; c.style.opacity = 0.35 + scopeOp / 100 * 0.65; };
      c.addEventListener('click', function (e) { e.stopPropagation(); var p = e.target.closest('[data-p]'); if (p) scopePage = +p.dataset.p; else if (e.target.tagName === 'CANVAS') app.closeOverlay(); });
      return c;
    }
    app.drawScope = function () {
      var cvs = app.scopeCv; if (!cvs || !ovEl) return;
      ovEl.querySelectorAll('.pg i').forEach(function (i) { i.classList.toggle('on', +i.dataset.p === scopePage); });
      var ctx = cvs.getContext('2d'), W = cvs.width, Hh = cvs.height, wv = app.eng.wave;
      ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, W, Hh);
      var gx = 20, gy = 30, gw = W - 40, gh = Hh - 60;
      ctx.font = '13px Lato,Arial'; ctx.fillStyle = '#ddd';
      for (var p = 0; p <= 10; p++) {
        ctx.strokeStyle = p === 0 || p === 10 ? '#d4c050' : 'rgba(255,255,255,.3)'; ctx.setLineDash(p === 0 || p === 10 ? [] : [6, 6]); ctx.beginPath();
        if (scopePage === 0) { var x = gx + p / 10 * gw; ctx.moveTo(x, gy); ctx.lineTo(x, gy + gh); ctx.stroke(); ctx.fillText(p * 10 + '%', x - 10, gy - 10); }
        else { var yy = gy + gh - p / 10 * gh; ctx.moveTo(gx, yy); ctx.lineTo(gx + gw, yy); ctx.stroke(); }
      }
      ctx.setLineDash([]);
      if (scopePage === 0) {
        var hs = app.eng.hist, mx = 1; for (var c2 = 0; c2 < 3; c2++) for (var i = 1; i < 63; i++) mx = Math.max(mx, hs[c2][i]);
        var cols = ['rgba(255,70,70,.7)', 'rgba(70,230,90,.65)', 'rgba(70,140,255,.7)'];
        for (c2 = 0; c2 < 3; c2++) { var bh = gh / 3, by = gy + c2 * bh; ctx.fillStyle = cols[c2]; ctx.beginPath(); ctx.moveTo(gx, by + bh); for (i = 0; i < 64; i++) ctx.lineTo(gx + i / 63 * gw, by + bh - Math.sqrt(Math.min(1, hs[c2][i] / mx)) * (bh - 6)); ctx.lineTo(gx + gw, by + bh); ctx.fill(); }
        ctx.fillText('0', gx, Hh - 10); ctx.fillText('64', gx + 0.0625 * gw, Hh - 10); ctx.fillText('940', gx + 0.918 * gw - 10, Hh - 10); ctx.fillText('1023', gx + gw - 26, Hh - 10);
        return;
      }
      if (!wv) return;
      /* 1 — RGB парад, 2 — яркостный осциллограф */
      var parts = scopePage === 1 ? [['r', '255,80,80'], ['g', '80,240,100'], ['b', '90,150,255']] : [['y', '235,235,235']];
      parts.forEach(function (pt, k) {
        var pw = gw / parts.length, px0 = gx + k * pw, arr = wv[pt[0]];
        for (var col = 0; col < 160; col++) for (var lv = 0; lv < 64; lv++) {
          var n = arr[col * 64 + lv]; if (!n) continue;
          ctx.fillStyle = 'rgba(' + pt[1] + ',' + Math.min(0.9, 0.08 + n / 30) + ')';
          ctx.fillRect(px0 + col / 160 * pw, gy + gh - (lv + 1) / 64 * gh, pw / 160 + 0.8, gh / 64 + 0.6);
        }
      });
      ctx.fillStyle = '#ddd'; [0, 25, 50, 75, 100].forEach(function (v) { ctx.fillText(v + '%', 2, gy + gh - v / 100 * gh + 4); });
    };
  }
