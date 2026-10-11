/*!
 * Matis.Academy — 3D-студия для урока 3 (композиция, позы, свет, движение камеры, крупности)
 * Виджеты: data-ml-widget="studio-pose" | "studio-compose" | "studio-move" | "studio-sun" | "studio-shots"
 * Нужен Three.js r128 — скрипт подгружает его сам с cdnjs, если на странице его нет.
 */
(function () {
  'use strict';
  if (window.MLStudio) return;

  var THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
  var T = null; /* THREE */
  var waiting = [], loading = false, failed = false;
  function withThree(cb, onFail) {
    if (window.THREE) { T = window.THREE; return cb(); }
    if (failed) return onFail && onFail();
    waiting.push([cb, onFail]);
    if (loading) return;
    loading = true;
    var s = document.createElement('script');
    s.src = THREE_URL; s.async = true;
    s.onload = function () { T = window.THREE; var w = waiting; waiting = []; w.forEach(function (f) { f[0](); }); };
    s.onerror = function () { failed = true; var w = waiting; waiting = []; w.forEach(function (f) { f[1] && f[1](); }); };
    document.head.appendChild(s);
  }

  /* ---------- утилиты ---------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function ease(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  var D2R = Math.PI / 180;
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  /* фокусное расстояние (мм, полный кадр, кадр 16:9) → вертикальный угол обзора */
  function focalToFov(mm) { return 2 * Math.atan(10.125 / mm) / D2R; }

  /* ---------- общие стили ---------- */
  var CSS = [
    '.mls{--acc:#fd7e2f;--bg:#111214;--panel:#1a1c1f;--panel2:#212428;--line:#2d3035;--tx:#efece7;--mut:#9da0a6;--ok:#3ecf7a;--warn:#f3b23a;--bad:#ff5d52;',
    'font-family:inherit;color:var(--tx);background:var(--bg);border-radius:20px;padding:14px;box-sizing:border-box;max-width:1120px;margin:0 auto;line-height:1.4;-webkit-text-size-adjust:100%;text-align:left}',
    '.mls *,.mls *::before,.mls *::after{box-sizing:border-box}',
    '.mls button{font:inherit;color:inherit;cursor:pointer}',
    '.mls-view{position:relative;width:100%;aspect-ratio:16/9;border-radius:12px;overflow:hidden;background:#0b0c0e;user-select:none;-webkit-user-select:none;touch-action:pan-y;container-type:inline-size}',
    '.mls-view>canvas{position:absolute;inset:0;width:100%!important;height:100%!important;display:block}',
    '.mls-view .ov{position:absolute;inset:0;pointer-events:none}',
    '.mls-load{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--mut);font-size:14px;text-align:center;padding:20px}',
    '.mls-hud{position:absolute;pointer-events:none;color:#fff;font:600 12px/1.25 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:clamp(9px,1.7cqw,13px);text-shadow:0 1px 2px rgba(0,0,0,.85)}',
    '.mls-tag{position:absolute;pointer-events:none;background:rgba(0,0,0,.55);color:#fff;border-radius:6px;padding:.3em .6em;font-size:clamp(10px,1.8cqw,13px);font-weight:600;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}',
    '.mls-row2{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:12px;margin-top:12px}',
    '@media (max-width:820px){.mls-row2{grid-template-columns:minmax(0,1fr)}}',
    '.mls-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px;min-width:0}',
    '.mls-card h4{margin:0 0 10px;font-size:15px;font-weight:700;color:var(--tx)}',
    '.mls-col{display:flex;flex-direction:column;gap:12px;min-width:0}',
    '.mls-ctl{display:block;margin:0 0 12px}',
    '.mls-ctl:last-child{margin-bottom:0}',
    '.mls-ctl .hd{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:14px}',
    '.mls-ctl .hd b{font-weight:600}',
    '.mls-ctl output{font:700 14px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:var(--acc);white-space:nowrap}',
    '.mls-ctl .hint{display:block;font-size:12px;color:var(--mut);margin-top:3px}',
    '.mls input[type=range]{width:100%;margin:6px 0 0;accent-color:var(--acc);height:22px;background:transparent}',
    '.mls-seg{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}',
    '.mls-seg button{background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:6px 10px;font-size:13px;line-height:1.2}',
    '.mls-seg button.on{border-color:var(--acc);color:var(--acc);background:#2a1e16}',
    '.mls-chips{display:grid;gap:6px;margin:12px 0 0}',
    '.mls-chip{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:9px 8px;display:flex;flex-direction:column;align-items:center;gap:3px;min-width:0;text-align:center;transition:border-color .15s,background .15s}',
    '.mls-chip:hover{border-color:#4a4e55}',
    '.mls-chip.on{border-color:var(--acc);background:#2a1e16}',
    '.mls-chip .nm{font-size:13px;font-weight:700;line-height:1.15}',
    '.mls-chip .sb{font-size:11px;color:var(--mut);line-height:1.2}',
    '.mls-chip .mk{font-size:11px;font-weight:800;border-radius:999px;padding:1px 7px;margin-top:2px}',
    '.mls-chip .mk.ok{background:#12301f;color:#7df0a9}.mls-chip .mk.bad{background:#3a1513;color:#ff8d84}.mls-chip .mk.mid{background:#33290f;color:#f6c766}',
    '.mls-tools{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}',
    '.mls-btn{background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:9px 12px;font-size:14px;font-weight:600}',
    '.mls-btn.on{border-color:var(--acc);color:var(--acc)}',
    '.mls-btn.pr{background:var(--acc);border-color:var(--acc);color:#1a0f08}',
    '.mls-checks{list-style:none;margin:0;padding:0}',
    '.mls-checks li{display:grid;grid-template-columns:22px minmax(0,1fr);gap:8px;padding:8px 0;border-top:1px solid var(--line);font-size:14px}',
    '.mls-checks li:first-child{border-top:0;padding-top:0}',
    '.mls-checks .ic{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#111;margin-top:1px}',
    '.mls-checks .ok .ic{background:var(--ok)}.mls-checks .warn .ic{background:var(--warn)}.mls-checks .bad .ic{background:var(--bad)}.mls-checks .info .ic{background:#6b7280;color:#fff}',
    '.mls-checks b{font-weight:700}',
    '.mls-checks small{display:block;color:var(--mut);font-size:12.5px;margin-top:2px}',
    '.mls-sum{margin-top:10px;padding:10px 12px;border-radius:10px;font-size:14px;font-weight:700;background:var(--panel2)}',
    '.mls-sum.ok{background:#12301f;color:#7df0a9}',
    '.mls-txt{font-size:14px;color:#d9d6d0;margin:0}',
    '.mls-txt+.mls-txt{margin-top:8px}',
    '.mls-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:10px}',
    '.mls-facts div{background:var(--panel2);border-radius:10px;padding:8px 10px;font-size:13px}',
    '.mls-facts span{display:block;color:var(--mut);font-size:11.5px;margin-bottom:2px}',
    '.mls-tips{margin:0;padding-left:18px;font-size:13.5px;color:#d9d6d0}',
    '.mls-tips li{margin:4px 0}',
    '.mls-note{font-size:12px;color:var(--mut);margin-top:10px}',
    '.mls-badge{display:inline-block;font-size:12px;font-weight:800;border-radius:999px;padding:2px 9px;margin-left:6px;vertical-align:2px}',
    '.mls-badge.ok{background:#12301f;color:#7df0a9}.mls-badge.bad{background:#3a1513;color:#ff8d84}.mls-badge.mid{background:#33290f;color:#f6c766}',
    '@media (max-width:820px){.mls>.mls-view{position:sticky;top:6px;z-index:5;box-shadow:0 6px 18px rgba(0,0,0,.45)}}',
    '@media (max-width:520px){.mls{padding:10px;border-radius:14px}.mls-card{padding:12px}.mls-chip .nm{font-size:12px}.mls-chip .sb{font-size:10.5px}}'
  ].join('\n');
  function injectCSS(id, css) {
    if (document.getElementById(id)) return;
    var s = document.createElement('style'); s.id = id; s.textContent = css; document.head.appendChild(s);
  }

  /* ---------- сцена ---------- */
  var SKY_VS = 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
  var SKY_FS = [
    'uniform vec3 top; uniform vec3 hor; uniform vec3 glow; uniform vec3 sunDir; uniform float glowK; uniform vec3 gnd;',
    'varying vec3 vW;',
    'void main(){',
    '  vec3 d = normalize(vW);',
    '  float h = d.y;',
    '  vec3 c = mix(hor, top, pow(clamp(h,0.0,1.0), 0.55));',
    '  float s = max(dot(d, normalize(sunDir)), 0.0);',
    '  c += glow * (pow(s, 8.0) * 0.55 + pow(s, 120.0) * 1.2) * glowK;',
    '  c = mix(c, gnd, smoothstep(0.0, -0.08, h));',
    '  gl_FragColor = vec4(c, 1.0);',
    '}'
  ].join('\n');

  function canvasTex(w, h, draw, rep) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    var t = new T.CanvasTexture(c);
    t.encoding = T.sRGBEncoding;
    t.anisotropy = 4;
    if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep, rep); }
    return t;
  }
  function grassTex() {
    return canvasTex(512, 512, function (g, w, h) {
      g.fillStyle = '#6f8a4a'; g.fillRect(0, 0, w, h);
      var R = rng(4);
      for (var i = 0; i < 9000; i++) {
        var x = R() * w, y = R() * h, l = 2 + R() * 5;
        g.strokeStyle = R() < 0.5 ? 'rgba(40,60,20,0.25)' : 'rgba(170,190,110,0.18)';
        g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 2, y - l); g.stroke();
      }
      for (i = 0; i < 40; i++) {
        g.fillStyle = 'rgba(' + (R() < 0.5 ? '60,80,35' : '140,150,80') + ',0.12)';
        g.beginPath(); g.arc(R() * w, R() * h, 20 + R() * 60, 0, 6.283); g.fill();
      }
    }, 60);
  }
  function stoneTex() {
    return canvasTex(512, 512, function (g, w, h) {
      g.fillStyle = '#b9b3a8'; g.fillRect(0, 0, w, h);
      var R = rng(9), n = 8, s = w / n;
      for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
        var v = 170 + Math.floor(R() * 30);
        g.fillStyle = 'rgb(' + v + ',' + (v - 5) + ',' + (v - 14) + ')';
        g.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
      }
      for (var i = 0; i < 4000; i++) { g.fillStyle = 'rgba(0,0,0,' + (R() * 0.06) + ')'; g.fillRect(R() * w, R() * h, 2, 2); }
    }, 3);
  }

  function Stage(host, opt) {
    opt = opt || {};
    var self = this;
    this.host = host;
    this.aspect = opt.aspect || 16 / 9;
    var r = this.renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.outputEncoding = T.sRGBEncoding;
    r.toneMapping = T.LinearToneMapping;
    r.toneMappingExposure = 0.95;
    r.shadowMap.enabled = true;
    r.shadowMap.type = T.PCFSoftShadowMap;
    host.insertBefore(r.domElement, host.firstChild);

    var sc = this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(focalToFov(35), this.aspect, 0.05, 600);
    this.camera.position.set(0, 1.6, 5);

    /* небо */
    this.skyU = { top: { value: new T.Color('#4f86d1') }, hor: { value: new T.Color('#cfe0ee') }, glow: { value: new T.Color('#fff2d0') },
      sunDir: { value: new T.Vector3(0.3, 0.6, -0.7) }, glowK: { value: 1 }, gnd: { value: new T.Color('#9fb08a') } };
    var sky = new T.Mesh(new T.SphereGeometry(400, 32, 16), new T.ShaderMaterial({ uniforms: this.skyU, vertexShader: SKY_VS, fragmentShader: SKY_FS, side: T.BackSide, depthWrite: false, fog: false }));
    sky.renderOrder = -1;
    sc.add(sky);
    sc.fog = new T.Fog('#cfe0ee', 25, 190);

    /* свет */
    this.hemi = new T.HemisphereLight('#cfe3ff', '#6b6a4e', 0.3);
    sc.add(this.hemi);
    var sun = this.sun = new T.DirectionalLight('#fff4e0', 2.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    var sc2 = sun.shadow.camera; sc2.left = -6; sc2.right = 6; sc2.top = 6; sc2.bottom = -6; sc2.near = 1; sc2.far = 80;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
    sc.add(sun); sc.add(sun.target);
    this.fill = new T.DirectionalLight('#ffffff', 0); /* отражатель / заполняющий свет */
    sc.add(this.fill); sc.add(this.fill.target);
    this.setSun(140, 35);

    /* земля */
    var ground = new T.Mesh(new T.CircleGeometry(220, 64), new T.MeshStandardMaterial({ map: grassTex(), roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    sc.add(ground);
    this.ground = ground;

    this.anims = [];
    this.visible = true; this.dirty = true; this.running = false;
    this._resize = function () {
      var w = host.clientWidth || 640, h = Math.round(w / self.aspect);
      r.setSize(w, h, false);
      self.camera.aspect = self.aspect; self.camera.updateProjectionMatrix();
      self.invalidate();
    };
    this._last = 0;
    this._tick = function (now) {
      self.running = false;
      if (!self.visible || document.hidden) { self._last = 0; return; }
      var dt = self._last ? Math.min(0.1, (now - self._last) / 1000) : 0.016;
      self._last = now;
      var busy = false;
      for (var i = 0; i < self.anims.length; i++) if (self.anims[i](dt, now / 1000)) busy = true;
      if (self.onFrame) self.onFrame(dt);
      r.render(sc, self.camera);
      if (self.afterRender) self.afterRender();
      self.dirty = false;
      if (busy) self._req(); else self._last = 0;
    };
    document.addEventListener('visibilitychange', function () { if (!document.hidden) self.invalidate(); });
    if ('ResizeObserver' in window) new ResizeObserver(this._resize).observe(host); else window.addEventListener('resize', this._resize);
    this._resize();
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { self.visible = e[0].isIntersecting; if (self.visible) self.invalidate(); }).observe(host);

  }
  Stage.prototype._req = function () { if (this._tick && !this.running) { this.running = true; requestAnimationFrame(this._tick); } };
  Stage.prototype.invalidate = function () { this.dirty = true; this._req(); };
  /* функция f(dt, t) возвращает true, пока нужна анимация */
  Stage.prototype.animate = function (f) { this.anims.push(f); this.invalidate(); };
  Stage.prototype.setFocal = function (mm) { this.camera.fov = focalToFov(mm); this.camera.updateProjectionMatrix(); this.invalidate(); };
  /* азимут (0 — солнце за спиной у зрителя, на оси +z), высота над горизонтом, град. */
  Stage.prototype.setSun = function (az, el, target) {
    var a = az * D2R, e = el * D2R, d = 30, t = target || new T.Vector3(0, 0.9, 0);
    var dir = new T.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
    this.sun.position.copy(t).addScaledVector(dir, d);
    this.sun.target.position.copy(t);
    this.skyU.sunDir.value.copy(dir);
    this.sunDir = dir;
    this.invalidate();
  };
  /* цвет неба/света по высоте солнца — от рассвета до полудня */
  Stage.prototype.setDaylight = function (el) {
    var k = smooth(clamp((el - 2) / 40, 0, 1));
    var warm = new T.Color('#ff9a4a'), noon = new T.Color('#fff6ea');
    this.sun.color.copy(warm).lerp(noon, k);
    this.sun.intensity = lerp(1.15, 1.3, k) * (el < 0 ? 0 : clamp(el / 4, 0.15, 1));
    this.skyU.top.value.set('#33508f').lerp(new T.Color('#3f7fd6'), k);
    this.skyU.hor.value.set('#f2b38a').lerp(new T.Color('#cfe0ee'), k);
    this.skyU.glow.value.set('#ffb070').lerp(new T.Color('#fff2d0'), k);
    this.skyU.glowK.value = lerp(1.6, 0.8, k);
    this.hemi.color.set('#9fb0d8').lerp(new T.Color('#cfe3ff'), k);
    this.hemi.intensity = lerp(0.36, 0.42, k);
    this.scene.fog.color.copy(this.skyU.hor.value);
    this.invalidate();
  };
  Stage.prototype.projectPx = function (v) {
    var p = v.clone().project(this.camera);
    return { x: (p.x + 1) / 2, y: (1 - p.y) / 2, z: p.z };
  };

  /* ---------- окружение ---------- */
  function mat(c, o) { var m = new T.MeshStandardMaterial({ color: c, roughness: 0.85 }); if (o) for (var k in o) m[k] = o[k]; return m; }
  function shadowy(o) { o.traverse(function (m) { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return o; }
  function makeTree(h, seed) {
    var R = rng(seed || 1), g = new T.Group();
    var trunk = new T.Mesh(new T.CylinderGeometry(0.09 * h / 5, 0.16 * h / 5, h * 0.45, 8), mat('#5b4634'));
    trunk.position.y = h * 0.225; g.add(trunk);
    var greens = ['#4f7a35', '#5c8a3c', '#46702f', '#628f40'];
    for (var i = 0; i < 6; i++) {
      var r = h * (0.17 + R() * 0.1);
      var b = new T.Mesh(new T.IcosahedronGeometry(r, 1), mat(greens[i % 4]));
      b.position.set((R() - 0.5) * h * 0.35, h * (0.55 + R() * 0.3), (R() - 0.5) * h * 0.35);
      b.scale.y = 0.85;
      g.add(b);
    }
    return shadowy(g);
  }
  function makeLamp() {
    var g = new T.Group(), m = mat('#2b2d31', { roughness: 0.5, metalness: 0.4 });
    var p = new T.Mesh(new T.CylinderGeometry(0.045, 0.07, 3.6, 10), m); p.position.y = 1.8; g.add(p);
    var arm = new T.Mesh(new T.BoxGeometry(0.5, 0.05, 0.05), m); arm.position.set(0.22, 3.55, 0); g.add(arm);
    var head = new T.Mesh(new T.CylinderGeometry(0.06, 0.16, 0.16, 12), m); head.position.set(0.45, 3.48, 0); g.add(head);
    return shadowy(g);
  }
  function makeBench() {
    var g = new T.Group(), wood = mat('#8a5a36', { roughness: 0.7 }), iron = mat('#2a2b2f', { roughness: 0.5, metalness: 0.5 });
    for (var i = 0; i < 4; i++) { var s = new T.Mesh(new T.BoxGeometry(1.7, 0.035, 0.1), wood); s.position.set(0, 0.45, -0.18 + i * 0.12); g.add(s); }
    for (i = 0; i < 3; i++) { var b2 = new T.Mesh(new T.BoxGeometry(1.7, 0.09, 0.03), wood); b2.position.set(0, 0.62 + i * 0.12, -0.27); b2.rotation.x = -0.12; g.add(b2); }
    [-0.7, 0.7].forEach(function (x) {
      var l = new T.Mesh(new T.BoxGeometry(0.05, 0.45, 0.5), iron); l.position.set(x, 0.225, -0.05); g.add(l);
      var bk = new T.Mesh(new T.BoxGeometry(0.05, 0.42, 0.04), iron); bk.position.set(x, 0.66, -0.29); bk.rotation.x = -0.12; g.add(bk);
    });
    return shadowy(g);
  }
  function makeWall(w, h) {
    var tex = canvasTex(512, 256, function (g, W, H) {
      g.fillStyle = '#a7826a'; g.fillRect(0, 0, W, H);
      var R = rng(3), bh = 16, bw = 46;
      for (var y = 0; y < H; y += bh) for (var x = -((y / bh) % 2) * bw / 2; x < W; x += bw) {
        var v = R();
        g.fillStyle = 'rgb(' + (150 + v * 40 | 0) + ',' + (95 + v * 30 | 0) + ',' + (75 + v * 20 | 0) + ')';
        g.fillRect(x + 1, y + 1, bw - 2, bh - 2);
      }
    });
    tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(w / 2.5, h / 1.25);
    var m = new T.Mesh(new T.BoxGeometry(w, h, 0.3), new T.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    m.position.y = h / 2;
    return shadowy(m);
  }
  function makeBuilding(w, h, d, col) {
    var tex = canvasTex(128, 256, function (g, W, H) {
      g.fillStyle = col; g.fillRect(0, 0, W, H);
      for (var y = 10; y < H - 6; y += 22) for (var x = 8; x < W - 8; x += 20) { g.fillStyle = 'rgba(40,55,75,0.55)'; g.fillRect(x, y, 11, 14); }
    });
    tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(Math.max(1, Math.round(w / 6)), Math.max(1, Math.round(h / 10)));
    var m = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    m.position.y = h / 2; m.receiveShadow = true;
    return m;
  }
  function makePlaza(r) {
    var m = new T.Mesh(new T.CircleGeometry(r, 48), new T.MeshStandardMaterial({ map: stoneTex(), roughness: 0.9 }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.004; m.receiveShadow = true;
    return m;
  }
  /* парк: деревья, фонари, дома вдали */
  function buildPark(stage, o) {
    o = o || {};
    var sc = stage.scene, R = rng(o.seed || 21), g = new T.Group();
    var trees = o.trees || [[-8, -13, 5.5], [7.5, -15, 6.5], [-15, -22, 7], [14, -26, 8], [-3, -32, 8], [21, -14, 6], [-22, -11, 6.5], [4, -40, 9], [-30, -30, 8], [30, -34, 8]];
    trees.forEach(function (t, i) { var tr = makeTree(t[2], i + 3); tr.position.set(t[0], 0, t[1]); tr.rotation.y = R() * 6; g.add(tr); });
    (o.lamps || [[-4.5, -6], [4.5, -6]]).forEach(function (p) { var l = makeLamp(); l.position.set(p[0], 0, p[1]); g.add(l); });
    if (o.buildings !== false) {
      [[-60, -120, 22, 24, 14, '#b9a99a'], [-30, -130, 18, 32, 14, '#c7bfb2'], [0, -125, 24, 20, 14, '#a99f97'], [32, -128, 18, 28, 14, '#bdb2a4'], [62, -118, 22, 18, 14, '#ae9f8f']]
        .forEach(function (b) { var m = makeBuilding(b[2], b[3], b[4], b[5]); m.position.set(b[0], 0, b[1]); g.add(m); });
    }
    if (o.path !== false) {
      var path = new T.Mesh(new T.PlaneGeometry(300, 2.4), new T.MeshStandardMaterial({ color: '#b8ad9a', roughness: 1 }));
      path.rotation.x = -Math.PI / 2; path.position.set(0, 0.003, o.pathZ == null ? -3.2 : o.pathZ); path.receiveShadow = true; g.add(path);
    }
    sc.add(g);
    return g;
  }

  /* ---------- итальянская пьяцца ---------- */
  var FACADES = ['#dba566', '#cf7f5c', '#e9c6a6', '#eedcbb', '#e5b85c', '#d99a80', '#e8cf9a'];
  function shade(hex, k) { var c = new T.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); }
  function plasterTex(col, seed) {
    return canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = col; g.fillRect(0, 0, w, h);
      var R = rng(seed || 7);
      for (var i = 0; i < 90; i++) {
        g.fillStyle = (R() < 0.5 ? 'rgba(90,60,40,' : 'rgba(255,245,230,') + (0.03 + R() * 0.05) + ')';
        g.beginPath(); g.ellipse(R() * w, R() * h, 10 + R() * 50, 6 + R() * 30, R() * 3, 0, 6.283); g.fill();
      }
      for (i = 0; i < 2500; i++) { g.fillStyle = 'rgba(0,0,0,' + R() * 0.05 + ')'; g.fillRect(R() * w, R() * h, 1.5, 1.5); }
    });
  }
  /* фасад: ставни, арки на первом этаже, балконы, карниз */
  function facadeTex(col, bays, floors, seed, arcade) {
    var bw = 64, fh = 84, W = bays * bw, H = floors * fh + 26;
    return canvasTex(W, H, function (g) {
      var R = rng(seed);
      g.fillStyle = col; g.fillRect(0, 0, W, H);
      for (var i = 0; i < bays * floors * 3; i++) {
        g.fillStyle = (R() < 0.55 ? 'rgba(90,60,40,' : 'rgba(255,245,230,') + (0.03 + R() * 0.06) + ')';
        g.beginPath(); g.ellipse(R() * W, R() * H, 8 + R() * 40, 5 + R() * 25, R() * 3, 0, 6.283); g.fill();
      }
      var stone = '#e8dcc4', shutter = ['#5d7a52', '#4f6b62', '#6f8a5a'][Math.floor(R() * 3)];
      /* карниз и межэтажные тяги */
      g.fillStyle = shade(col, 0.82); g.fillRect(0, 0, W, 10);
      g.fillStyle = stone; g.fillRect(0, 10, W, 8);
      for (var f = 1; f < floors; f++) { g.fillStyle = 'rgba(255,250,240,.45)'; g.fillRect(0, 26 + f * fh - 4, W, 4); }
      for (f = 0; f < floors; f++) {
        var y0 = 26 + f * fh, ground = f === floors - 1;
        for (var b = 0; b < bays; b++) {
          var x0 = b * bw;
          if (ground) {
            /* арки / двери первого этажа */
            var aw = arcade ? 46 : 30, ah = arcade ? 70 : 58, ax = x0 + (bw - aw) / 2, ay = y0 + fh - ah;
            g.fillStyle = stone; g.beginPath(); g.moveTo(ax - 5, y0 + fh); g.lineTo(ax - 5, ay + aw / 2); g.arc(ax + aw / 2, ay + aw / 2, aw / 2 + 5, Math.PI, 0); g.lineTo(ax + aw + 5, y0 + fh); g.fill();
            g.fillStyle = arcade ? '#3b2c24' : (R() < 0.5 ? '#5a3a28' : '#2f3a3e');
            g.beginPath(); g.moveTo(ax, y0 + fh); g.lineTo(ax, ay + aw / 2); g.arc(ax + aw / 2, ay + aw / 2, aw / 2, Math.PI, 0); g.lineTo(ax + aw, y0 + fh); g.fill();
            if (!arcade && R() < 0.5) { g.fillStyle = 'rgba(255,220,160,.35)'; g.fillRect(ax + 4, ay + aw / 2, aw - 8, ah - aw / 2 - 6); }
          } else {
            var ww = 20, wh = 44, wx = x0 + (bw - ww) / 2, wy = y0 + 18;
            var open = R() < 0.35;
            g.fillStyle = stone; g.fillRect(wx - 4, wy - 5, ww + 8, wh + 10);
            g.fillStyle = '#2d2a2c'; g.fillRect(wx, wy, ww, wh);
            g.fillStyle = 'rgba(160,190,210,.25)'; g.fillRect(wx + 2, wy + 2, ww / 2 - 3, wh / 2);
            g.fillStyle = shutter;
            if (open) { g.fillRect(wx - 15, wy, 11, wh); g.fillRect(wx + ww + 4, wy, 11, wh); }
            else { g.fillRect(wx, wy, ww / 2 - 1, wh); g.fillRect(wx + ww / 2 + 1, wy, ww / 2 - 1, wh); }
            g.fillStyle = 'rgba(0,0,0,.18)';
            for (var sl = 0; sl < wh; sl += 4) { if (open) { g.fillRect(wx - 15, wy + sl, 11, 1); g.fillRect(wx + ww + 4, wy + sl, 11, 1); } else g.fillRect(wx, wy + sl, ww, 1); }
            if (f === floors - 2 && (b % 2 === 1 || R() < 0.3)) {
              g.fillStyle = stone; g.fillRect(wx - 10, wy + wh + 2, ww + 20, 4);
              g.strokeStyle = '#2b2522'; g.lineWidth = 1.5;
              for (var bx = wx - 9; bx <= wx + ww + 9; bx += 4) { g.beginPath(); g.moveTo(bx, wy + wh + 2); g.lineTo(bx, wy + wh - 16); g.stroke(); }
              g.beginPath(); g.moveTo(wx - 10, wy + wh - 16); g.lineTo(wx + ww + 10, wy + wh - 16); g.stroke();
              if (R() < 0.7) { g.fillStyle = ['#d24b5a', '#e88a3a', '#f0d0e0', '#c43c48'][Math.floor(R() * 4)]; for (var fl = 0; fl < 9; fl++) { g.beginPath(); g.arc(wx - 8 + R() * (ww + 16), wy + wh - 4 + R() * 5, 2.4, 0, 6.283); g.fill(); } g.fillStyle = '#4f7a3a'; g.fillRect(wx - 9, wy + wh - 1, ww + 18, 3); }
            }
          }
        }
      }
    });
  }
  function tileTex() {
    return canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = '#b4583b'; g.fillRect(0, 0, w, h);
      var R = rng(12);
      for (var y = 0; y < h; y += 16) for (var x = (y / 16 % 2) * 8; x < w; x += 16) {
        g.fillStyle = 'rgb(' + (160 + R() * 40 | 0) + ',' + (75 + R() * 25 | 0) + ',' + (50 + R() * 15 | 0) + ')';
        g.fillRect(x, y, 14, 14); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, y + 12, 14, 2);
      }
    }, 1);
  }
  function pavingTex() {
    return canvasTex(512, 512, function (g, w, h) {
      g.fillStyle = '#a99b86'; g.fillRect(0, 0, w, h);
      var R = rng(31), rowH = 32;
      for (var y = 0; y < h; y += rowH) {
        var x = -R() * 60;
        while (x < w) {
          var sw = 44 + R() * 50, v = 188 + R() * 34;
          g.fillStyle = 'rgb(' + (v | 0) + ',' + (v - 9 | 0) + ',' + (v - 24 | 0) + ')';
          g.fillRect(x + 2, y + 2, sw - 4, rowH - 4);
          for (var k = 0; k < 6; k++) { g.fillStyle = 'rgba(80,60,40,' + R() * 0.08 + ')'; g.fillRect(x + R() * sw, y + R() * rowH, 6 + R() * 10, 3); }
          x += sw;
        }
      }
    }, 10);
  }
  function makeHouse(w, h, d, col, seed, arcade) {
    var g = new T.Group();
    var bays = Math.max(2, Math.round(w / 2.6)), floors = Math.max(2, Math.round(h / 3.4));
    var side = new T.MeshStandardMaterial({ map: plasterTex(col, seed), roughness: 0.95 });
    var front = new T.MeshStandardMaterial({ map: facadeTex(col, bays, floors, seed, arcade), roughness: 0.92 });
    var box = new T.Mesh(new T.BoxGeometry(w, h, d), [side, side, side, side, front, side]);
    box.position.y = h / 2; box.receiveShadow = true; g.add(box);
    var roofM = new T.MeshStandardMaterial({ map: tileTex(), roughness: 0.85 });
    roofM.map.repeat.set(w / 3, d / 3);
    var eave = new T.Mesh(new T.BoxGeometry(w + 0.5, 0.18, d + 0.7), U_mat(shade(col, 0.75)));
    eave.position.set(0, h + 0.09, 0.1); g.add(eave);
    var sh = new T.Shape(), rd = (d + 0.7) / 2, rh = d * 0.22;
    sh.moveTo(-rd, 0); sh.lineTo(rd, 0); sh.lineTo(0, rh); sh.lineTo(-rd, 0);
    var rg = new T.ExtrudeGeometry(sh, { depth: w + 0.5, bevelEnabled: false });
    rg.translate(0, 0, -(w + 0.5) / 2);
    var roof = new T.Mesh(rg, roofM); roof.rotation.y = Math.PI / 2; roof.position.set(0, h + 0.18, 0.1);
    g.add(roof);
    return g;
  }
  function U_mat(c) { return mat(c, { roughness: 0.9 }); }
  function makeCampanile() {
    var g = new T.Group(), col = '#c98a5c', H = 26;
    var shaft = new T.Mesh(new T.BoxGeometry(4.2, H, 4.2), new T.MeshStandardMaterial({ map: plasterTex(col, 41), roughness: 0.95 }));
    shaft.position.y = H / 2; g.add(shaft);
    var bel = canvasTex(128, 128, function (c2) {
      c2.fillStyle = col; c2.fillRect(0, 0, 128, 128);
      c2.fillStyle = '#ead9bd'; c2.fillRect(0, 0, 128, 12); c2.fillRect(0, 116, 128, 12);
      c2.fillStyle = '#2a201c'; c2.beginPath(); c2.moveTo(34, 112); c2.lineTo(34, 52); c2.arc(64, 52, 30, Math.PI, 0); c2.lineTo(94, 112); c2.fill();
      c2.fillStyle = '#7a5a2a'; c2.beginPath(); c2.arc(64, 62, 13, 0, Math.PI * 2); c2.fill();
    });
    var belfry = new T.Mesh(new T.BoxGeometry(4.6, 5, 4.6), new T.MeshStandardMaterial({ map: bel, roughness: 0.9 }));
    belfry.position.y = H + 2.5; g.add(belfry);
    var cap = new T.Mesh(new T.BoxGeometry(5, 0.4, 5), U_mat('#ead9bd')); cap.position.y = H + 5.2; g.add(cap);
    var spire = new T.Mesh(new T.ConeGeometry(3.3, 5.5, 4), new T.MeshStandardMaterial({ map: tileTex(), roughness: 0.85 }));
    spire.rotation.y = Math.PI / 4; spire.position.y = H + 8.1; g.add(spire);
    return g;
  }
  function makeCypress(h, seed) {
    var R = rng(seed || 1), r = h * (0.075 + R() * 0.02);
    var m = lathe([[0.001, 0], [r * 0.7, h * 0.04], [r, h * 0.3], [r * 0.85, h * 0.6], [r * 0.45, h * 0.85], [0.001, h]], 10, 0, 0, mat(['#2e472a', '#344f2d', '#29402a'][Math.floor(R() * 3)], { roughness: 1 }));
    return m;
  }
  function makePot(lemon, seed) {
    var g = new T.Group(), R = rng(seed || 2);
    var pot = new T.Mesh(new T.CylinderGeometry(0.34, 0.24, 0.55, 16), U_mat('#b8613f')); pot.position.y = 0.275; g.add(pot);
    var rim = new T.Mesh(new T.TorusGeometry(0.34, 0.04, 8, 20), U_mat('#a5553a')); rim.rotation.x = Math.PI / 2; rim.position.y = 0.55; g.add(rim);
    var trunk = new T.Mesh(new T.CylinderGeometry(0.03, 0.04, 0.7, 6), U_mat('#5a4330')); trunk.position.y = 0.9; g.add(trunk);
    var crown = new T.Mesh(new T.IcosahedronGeometry(0.48, 1), U_mat(lemon ? '#3f6a2c' : '#7d8f62')); crown.position.y = 1.45; g.add(crown);
    if (lemon) for (var i = 0; i < 9; i++) {
      var a = R() * 6.28, e = (R() - 0.3) * 1.2, l = new T.Mesh(new T.SphereGeometry(0.055, 8, 6), mat('#f2cf3a', { roughness: 0.5 }));
      l.scale.y = 1.25; l.position.set(Math.cos(a) * Math.cos(e) * 0.46, 1.45 + Math.sin(e) * 0.4, Math.sin(a) * Math.cos(e) * 0.46); g.add(l);
    }
    return shadowy(g);
  }
  function makeFountain() {
    var g = new T.Group(), st = U_mat('#e3d6bd');
    var basin = lathe([[1.9, 0], [1.95, 0.45], [1.75, 0.5], [1.7, 0.12], [0.001, 0.12]], 40, 0, 0, st); g.add(basin);
    var water = new T.Mesh(new T.CircleGeometry(1.72, 40), new T.MeshStandardMaterial({ color: '#5f9aa0', roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.85 }));
    water.rotation.x = -Math.PI / 2; water.position.y = 0.38; g.add(water);
    var col = new T.Mesh(new T.CylinderGeometry(0.18, 0.28, 1.6, 16), st); col.position.y = 0.9; g.add(col);
    var bowl = lathe([[0.001, 1.6], [0.8, 1.72], [0.85, 1.85], [0.75, 1.82], [0.001, 1.75]], 32, 0, 0, st); g.add(bowl);
    var top = new T.Mesh(new T.SphereGeometry(0.16, 16, 12), st); top.position.y = 2.05; g.add(top);
    return shadowy(g);
  }
  function makeCafe() {
    var g = new T.Group();
    var pole = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 2.3, 8), U_mat('#3a3330')); pole.position.y = 1.15; g.add(pole);
    var umb = new T.Mesh(new T.ConeGeometry(1.25, 0.45, 8, 1, true), mat('#f1e6d2', { roughness: 0.9, side: T.DoubleSide })); umb.position.y = 2.35; g.add(umb);
    var table = new T.Mesh(new T.CylinderGeometry(0.38, 0.38, 0.03, 20), U_mat('#ece6dc')); table.position.y = 0.74; g.add(table);
    [-1, 1].forEach(function (s) {
      var ch = new T.Group();
      var seat = new T.Mesh(new T.BoxGeometry(0.42, 0.04, 0.42), U_mat('#2f4a3a')); seat.position.y = 0.46; ch.add(seat);
      var backr = new T.Mesh(new T.BoxGeometry(0.42, 0.42, 0.04), U_mat('#2f4a3a')); backr.position.set(0, 0.68, -0.2); ch.add(backr);
      ch.position.set(s * 0.65, 0, 0); ch.rotation.y = -s * Math.PI / 2; g.add(ch);
    });
    return shadowy(g);
  }
  /* пьяцца: дома по трём сторонам, колокольня, фонтан, кипарисы и тосканские холмы */
  function buildPiazza(stage, o) {
    o = o || {};
    var sc = stage.scene, g = new T.Group(), plan = { boxes: [], dots: [] };
    stage.ground.material.map = canvasTex(256, 256, function (c2, w, h) {
      c2.fillStyle = '#9da46a'; c2.fillRect(0, 0, w, h);
      var R = rng(5); for (var i = 0; i < 400; i++) { c2.fillStyle = 'rgba(' + (R() < 0.5 ? '200,180,110' : '90,110,60') + ',.18)'; c2.fillRect(R() * w, R() * h, 3 + R() * 10, 2); }
    }, 80);
    stage.ground.material.needsUpdate = true;
    var pave = new T.Mesh(new T.PlaneGeometry(26, 40), new T.MeshStandardMaterial({ map: pavingTex(), roughness: 0.92 }));
    pave.material.map.repeat.set(5, 8);
    pave.rotation.x = -Math.PI / 2; pave.position.set(-1, 0.005, -4); pave.receiveShadow = true; g.add(pave);
    var ci = 0;
    function row(list) {
      list.forEach(function (b) {
        var h = makeHouse(b.w, b.h, b.d || 8, FACADES[ci++ % FACADES.length], 100 + ci, b.arc);
        h.position.set(b.x, 0, b.z); h.rotation.y = b.r || 0; g.add(h);
        plan.boxes.push({ x: b.x, z: b.z, w: b.w, d: b.d || 8, r: b.r || 0 });
      });
    }
    /* задняя сторона (фасадами к нам) */
    row([{ x: -14.5, z: -18, w: 7, h: 13 }, { x: -8, z: -18.5, w: 6, h: 11, arc: true }, { x: -2, z: -18, w: 6, h: 14, arc: true }, { x: 4, z: -18.5, w: 6, h: 12 }, { x: 13, z: -18, w: 7, h: 11 }]);
    var camp = makeCampanile(); camp.position.set(9, 0, -20); g.add(camp); plan.boxes.push({ x: 9, z: -20, w: 4.2, d: 4.2, r: 0, tower: true });
    /* левая сторона (фасадами вправо) */
    row([{ x: -15, z: -10, w: 8, h: 12, r: Math.PI / 2 }, { x: -15.5, z: -2, w: 8, h: 10, r: Math.PI / 2, arc: true }, { x: -15, z: 6, w: 8, h: 13, r: Math.PI / 2 }, { x: -15.5, z: 14, w: 8, h: 11, r: Math.PI / 2 }]);
    /* правая сторона (фасадами влево) — короче, за ней вид на холмы */
    row([{ x: 15, z: -10, w: 8, h: 11, r: -Math.PI / 2 }, { x: 15.5, z: -2.5, w: 7, h: 12, r: -Math.PI / 2, arc: true }]);
    /* сторона за камерой */
    row([{ x: -8, z: 22, w: 9, h: 12, r: Math.PI }, { x: 2, z: 22.5, w: 8, h: 11, r: Math.PI }]);
    /* фонтан, кафе, лимоны */
    var fo = makeFountain(); fo.position.set(o.fountain ? o.fountain[0] : -5, 0, o.fountain ? o.fountain[1] : -8); g.add(fo); plan.dots.push({ x: fo.position.x, z: fo.position.z, r: 1.9, c: '#8fb7bd' });
    [[-9.5, -12], [-9.8, -9.6], [6.5, -12.6]].forEach(function (p) { var cf = makeCafe(); cf.position.set(p[0], 0, p[1]); g.add(cf); plan.dots.push({ x: p[0], z: p[1], r: 1.2, c: '#e8dcc6' }); });
    [[-10.6, -4.5, 1], [-10.6, 0.5, 0], [-10.6, 5, 1], [10.6, -6, 1], [10.6, -1, 0], [-3.5, -13.4, 1], [1.5, -13.4, 1]].forEach(function (p, i) {
      var pt = makePot(!!p[2], i + 4); pt.position.set(p[0], 0, p[1]); g.add(pt); plan.dots.push({ x: p[0], z: p[1], r: 0.5, c: '#4f7a35' });
    });
    /* кипарисы: у правого края площади и на холмах */
    [[12.5, 5, 10], [14.5, 8.5, 12], [12, 12, 9], [18, 4, 11], [21, 10, 13], [24, 1, 10]].forEach(function (p, i) { var cy = makeCypress(p[2], i + 1); cy.position.set(p[0], 0, p[1]); g.add(cy); plan.dots.push({ x: p[0], z: p[1], r: 0.8, c: '#2e472a' }); });
    var balM = U_mat('#e3d6bd');
    var rail = new T.Mesh(new T.BoxGeometry(0.3, 0.12, 17), balM); rail.position.set(11, 0.95, 9); g.add(rail);
    var base = new T.Mesh(new T.BoxGeometry(0.35, 0.18, 17), balM); base.position.set(11, 0.09, 9); g.add(base);
    var bal = new T.InstancedMesh(new T.CylinderGeometry(0.07, 0.09, 0.78, 8), balM, 40), mtx = new T.Matrix4();
    for (var bi = 0; bi < 40; bi++) { mtx.makeTranslation(11, 0.57, 0.7 + bi * 0.42); bal.setMatrixAt(bi, mtx); }
    g.add(bal); plan.boxes.push({ x: 11, z: 9, w: 0.35, d: 17, r: 0, wall: true });
    /* холмы Тосканы */
    [[60, -170, 90, '#9aa76a'], [-60, -190, 110, '#8e9c62'], [150, -120, 80, '#a6ad72'], [0, -230, 140, '#93a066'], [140, 40, 70, '#a1a96c']].forEach(function (hl) {
      var m = new T.Mesh(new T.SphereGeometry(hl[2], 32, 16), mat(hl[3], { roughness: 1 })); m.scale.y = 0.14; m.position.set(hl[0], -2, hl[1]); g.add(m);
    });
    var R2 = rng(77);
    for (var k = 0; k < 40; k++) { var cy2 = makeCypress(9 + R2() * 6, k + 20); var a = -0.4 + R2() * 1.9, rr = 70 + R2() * 90; cy2.position.set(Math.sin(a) * rr + 20, 0, -Math.cos(a) * rr + 20); g.add(cy2); }
    sc.add(g);
    stage.hemi.groundColor.set('#a08a68');
    stage.piazza = plan;
    return g;
  }

  /* ---------- модель: девушка в летнем платье ---------- */
  var COL = { skin: '#d9a283', hair: '#4a2a1b', dress: '#b8433a', shoe: '#c49a6c', lip: '#c2606a', gold: '#d8b25a' };
  var DIM = { hipsY: 0.92, spine: 0.1, chest: 0.19, sh: [0.138, 0.148], neck: 0.215, head: 0.108, hip: [0.08, -0.04], up: 0.27, lo: 0.24, th: 0.41, sn: 0.41, ank: 0.068 };

  function lathe(pts, segs, phiStart, phiLen, m) {
    var v = pts.map(function (p) { return new T.Vector2(p[0], p[1]); });
    var g = new T.LatheGeometry(v, segs || 24, phiStart || 0, phiLen || Math.PI * 2);
    var mesh = new T.Mesh(g, m);
    return mesh;
  }
  function limbMesh(len, r1, r2, m) {
    var g = new T.Group();
    var c = new T.Mesh(new T.CylinderGeometry(r2, r1, len, 16), m); c.position.y = -len / 2; g.add(c);
    var s = new T.Mesh(new T.SphereGeometry(r1, 16, 12), m); g.add(s);
    var e = new T.Mesh(new T.SphereGeometry(r2, 16, 12), m); e.position.y = -len; g.add(e);
    return g;
  }
  function ell(r, sx, sy, sz, m, x, y, z) {
    var e = new T.Mesh(new T.SphereGeometry(r, 24, 16), m); e.scale.set(sx, sy, sz); e.position.set(x || 0, y || 0, z || 0); return e;
  }

  function Figure(opt) {
    opt = opt || {};
    var c = Object.assign({}, COL, opt.colors || {});
    var M = this.mats = {
      skin: mat(c.skin, { roughness: 0.55 }), hair: mat(c.hair, { roughness: 0.55 }), dress: mat(c.dress, { roughness: 0.78 }),
      shoe: mat(c.shoe, { roughness: 0.6 }), white: mat('#f4efe9', { roughness: 0.3 }), iris: mat('#3a2418', { roughness: 0.25 }),
      dark: mat('#1c120d', { roughness: 0.5 }), lip: mat(c.lip, { roughness: 0.45 }), gold: mat(c.gold, { roughness: 0.3, metalness: 0.8 })
    };
    M.dress.side = T.DoubleSide; M.hair.side = T.DoubleSide;
    var root = this.root = new T.Group();
    var hips = this.hips = new T.Group(); hips.position.y = DIM.hipsY; root.add(hips);
    /* юбка с мягкими складками по подолу */
    var skirt = lathe([[0.112, 0.1], [0.126, 0.05], [0.158, -0.04], [0.198, -0.16], [0.24, -0.3], [0.275, -0.42], [0.28, -0.445]], 56, 0, 0, M.dress);
    var pos = skirt.geometry.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), k = Math.max(0, -y) / 0.445, ph = Math.atan2(x, z);
      var f = 1 + 0.05 * k * k * Math.sin(ph * 7) + 0.015 * k * Math.sin(ph * 13 + 1);
      pos.setX(i, x * f); pos.setZ(i, z * f * 0.82);
    }
    skirt.geometry.computeVertexNormals();
    hips.add(skirt);
    var belt = new T.Mesh(new T.TorusGeometry(0.117, 0.007, 8, 40), M.gold); belt.rotation.x = Math.PI / 2; belt.scale.y = 0.82; belt.position.y = 0.095; hips.add(belt);
    var spine = this.spine = new T.Group(); spine.position.y = DIM.spine; hips.add(spine);
    var chest = this.chest = new T.Group(); chest.position.y = DIM.chest; spine.add(chest);
    /* тело и лиф платья */
    var body = lathe([[0.001, -0.2], [0.114, -0.195], [0.12, -0.08], [0.135, 0.02], [0.148, 0.1], [0.14, 0.15], [0.1, 0.185], [0.05, 0.2], [0.001, 0.2]], 32, 0, 0, M.skin);
    body.scale.z = 0.6; chest.add(body);
    var bod = lathe([[0.117, -0.2], [0.124, -0.11], [0.13, -0.04], [0.146, 0.04], [0.15, 0.09], [0.144, 0.115]], 32, 0, 0, M.dress);
    bod.scale.z = 0.66; chest.add(bod);
    [-1, 1].forEach(function (s) {
      var strap = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(0.07 * s, 0.1, 0.075), new T.Vector3(0.09 * s, 0.17, 0.03), new T.Vector3(0.09 * s, 0.17, -0.03), new T.Vector3(0.075 * s, 0.1, -0.075)]), 12, 0.009, 6), M.dress);
      chest.add(strap);
    });
    /* шея и голова */
    var neck = this.neck = new T.Group(); neck.position.y = DIM.neck; chest.add(neck);
    var nk = new T.Mesh(new T.CylinderGeometry(0.039, 0.046, 0.12, 16), M.skin); nk.position.y = 0.02; neck.add(nk);
    var head = this.head = new T.Group(); head.position.y = DIM.head; neck.add(head);
    head.add(ell(0.092, 0.86, 1.08, 0.94, M.skin));
    head.add(ell(0.06, 0.95, 0.85, 0.9, M.skin, 0, -0.048, 0.022));
    [-1, 1].forEach(function (s) {
      head.add(ell(0.0128, 1, 0.78, 0.7, M.white, 0.03 * s, 0.01, 0.075));
      head.add(ell(0.0085, 1, 1, 0.6, M.iris, 0.03 * s, 0.009, 0.0818));
      var lid = new T.Mesh(new T.TorusGeometry(0.0135, 0.0032, 6, 14, Math.PI), M.dark);
      lid.position.set(0.03 * s, 0.0105, 0.0795); lid.rotation.x = -0.25; lid.scale.y = 0.6; head.add(lid);
      var brow = new T.Mesh(new T.TorusGeometry(0.02, 0.0024, 6, 14, Math.PI * 0.55), M.hair);
      brow.position.set(0.031 * s, 0.022, 0.08); brow.rotation.set(-0.2, 0, Math.PI * 0.22 + (s > 0 ? 0 : 0.2)); brow.scale.y = 0.45; head.add(brow);
      head.add(ell(0.0045, 1, 1, 1, M.gold, 0.079 * s, -0.045, 0.005));
    });
    head.add(ell(0.0095, 0.85, 1.7, 1.05, M.skin, 0, -0.016, 0.084));
    head.add(ell(0.017, 1, 0.38, 0.5, M.lip, 0, -0.043, 0.079));
    head.add(ell(0.015, 1, 0.45, 0.55, M.lip, 0, -0.051, 0.077));
    /* волосы: объём сверху, по бокам, длинные пряди за спиной и у лица */
    var cap = new T.Mesh(new T.SphereGeometry(0.1, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.6), M.hair);
    cap.scale.set(0.95, 1.07, 1.06); cap.rotation.x = -0.72; cap.position.set(0, 0.012, -0.006); head.add(cap);
    [-1, 1].forEach(function (s) {
      head.add(ell(0.1, 0.26, 1.0, 0.62, M.hair, 0.074 * s, -0.035, -0.03));
      var str = ell(0.1, 0.13, 1.25, 0.24, M.hair, 0.071 * s, -0.11, 0.012); str.rotation.z = 0.1 * s; head.add(str);
    });
    var back = lathe([[0.096, 0.05], [0.106, -0.03], [0.104, -0.13], [0.096, -0.24], [0.075, -0.33], [0.04, -0.385], [0.001, -0.4]], 32, 0, 0, M.hair);
    back.scale.set(1, 1, 0.5); back.position.set(0, -0.005, -0.05); head.add(back);
    /* руки */
    this.arms = [1, -1].map(function (s) {
      var up = new T.Group(); up.position.set(DIM.sh[0] * s, DIM.sh[1], 0); chest.add(up);
      up.add(limbMesh(DIM.up, 0.039, 0.033, M.skin));
      var lo = new T.Group(); lo.position.y = -DIM.up; up.add(lo);
      lo.add(limbMesh(DIM.lo, 0.034, 0.026, M.skin));
      var hand = ell(0.036, 0.55, 1.2, 0.95, M.skin, 0, -DIM.lo - 0.055, 0);
      lo.add(hand);
      var th = ell(0.014, 1, 1.8, 1, M.skin, 0, -DIM.lo - 0.04, 0.028); lo.add(th);
      if (s > 0) { var br = new T.Mesh(new T.TorusGeometry(0.031, 0.004, 6, 20), M.gold); br.rotation.x = Math.PI / 2; br.position.y = -DIM.lo + 0.02; lo.add(br); }
      return { up: up, lo: lo, s: s, hand: [hand, th] };
    });
    /* ноги */
    this.legs = [1, -1].map(function (s) {
      var th = new T.Group(); th.position.set(DIM.hip[0] * s, DIM.hip[1], 0); hips.add(th);
      th.add(limbMesh(DIM.th, 0.072, 0.05, M.skin));
      var sn = new T.Group(); sn.position.y = -DIM.th; th.add(sn);
      sn.add(limbMesh(DIM.sn, 0.05, 0.032, M.skin));
      var calf = ell(0.05, 0.95, 1.9, 1, M.skin, 0, -0.13, -0.008); sn.add(calf);
      var ft = new T.Group(); ft.position.y = -DIM.sn; sn.add(ft);
      var shoe = new T.Mesh(new T.BoxGeometry(0.07, 0.035, 0.2), M.shoe); shoe.position.set(0, -0.052, 0.05); ft.add(shoe);
      ft.add(ell(0.036, 1, 0.55, 1, M.shoe, 0, -0.052, 0.145));
      ft.add(ell(0.03, 1, 0.9, 1.6, M.skin, 0, -0.03, 0.05));
      return { th: th, sn: sn, ft: ft, s: s };
    });
    shadowy(root);
    this.pose = null; this.from = null; this.t = 1; this.dur = 0.7;
    this.extra = { headYaw: 0, headPitch: 0, bodyYaw: 0 };
    this._v = [new T.Vector3(), new T.Vector3(), new T.Vector3(), new T.Vector3()];
    this._q = new T.Quaternion(); this._q2 = new T.Quaternion(); this._m = new T.Matrix4();
  }
  var DOWN = null;
  /* решение двузвенной ИК: S — плечо/бедро, Tg — цель (кисть/лодыжка), P — куда смотрит локоть/колено; всё в координатах родителя */
  Figure.prototype._ik = function (upper, lower, a, b, Tg, P) {
    if (!DOWN) DOWN = new T.Vector3(0, -1, 0);
    var S = upper.position, v = this._v;
    var ax = v[0].copy(Tg).sub(S), d = ax.length();
    d = clamp(d, Math.abs(a - b) + 1e-3, (a + b) * 0.9995);
    ax.normalize();
    var cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    var pp = v[1].copy(P).sub(S); pp.addScaledVector(ax, -pp.dot(ax));
    if (pp.lengthSq() < 1e-8) pp.set(0, 0, 1);
    pp.normalize();
    var E = v[2].copy(S).addScaledVector(ax, a * cosA).addScaledVector(pp, a * sinA);
    var u = v[3].copy(E).sub(S).normalize();
    upper.quaternion.setFromUnitVectors(DOWN, u);
    /* нижнее звено — в локальных координатах верхнего */
    var tgt = v[1].copy(S).addScaledVector(ax, d).sub(E).normalize();
    this._q.copy(upper.quaternion).invert();
    tgt.applyQuaternion(this._q);
    lower.quaternion.setFromUnitVectors(DOWN, tgt);
  };
  function lerpArr(a, b, t) { return a.map(function (x, i) { return lerp(x, b[i], t); }); }
  /* поза в координатах корня (м), модель смотрит в +z, левая сторона — +x */
  var NEUTRAL = {
    hips: [0, DIM.hipsY, 0], hipsRot: [0, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], neck: [0, 0, 0], head: [0, 0, 0], yaw: 0,
    lH: [0.22, 0.95, 0.02], rH: [-0.22, 0.95, 0.02], lE: [0.4, 1.2, -0.45], rE: [-0.4, 1.2, -0.45],
    lF: [0.1, DIM.ank, 0.0], rF: [-0.1, DIM.ank, 0.0], lK: [0.12, 0.6, 0.6], rK: [-0.12, 0.6, 0.6], footYaw: [0, 0], heel: [0, 0], pocket: [0, 0]
  };
  function fullPose(p) { var o = {}; for (var k in NEUTRAL) o[k] = p[k] != null ? p[k] : NEUTRAL[k]; return o; }
  Figure.prototype.setPose = function (p, instant, dur) {
    p = fullPose(p);
    if (!this.pose || instant) { this.pose = p; this.from = p; this.t = 1; this.apply(p); return; }
    this.from = this.current || this.pose; this.pose = p; this.t = 0; this.dur = dur || 0.75;
  };
  Figure.prototype.blend = function (a, b, t) {
    var o = {};
    for (var k in a) o[k] = Array.isArray(a[k]) ? lerpArr(a[k], b[k], t) : lerp(a[k], b[k], t);
    return o;
  };
  Figure.prototype.update = function (dt) {
    if (this.t >= 1) return false;
    this.t = Math.min(1, this.t + dt / this.dur);
    this.current = this.blend(this.from, this.pose, ease(this.t));
    this.apply(this.current);
    return this.t < 1;
  };
  Figure.prototype.apply = function (p) {
    this.current = p;
    var e = this.extra;
    this.root.rotation.y = (p.yaw + e.bodyYaw) * D2R;
    this.hips.position.fromArray(p.hips);
    this.hips.rotation.set(p.hipsRot[0] * D2R, p.hipsRot[1] * D2R, p.hipsRot[2] * D2R);
    this.spine.rotation.set(p.spine[0] * D2R, p.spine[1] * D2R, p.spine[2] * D2R);
    this.chest.rotation.set(p.chest[0] * D2R, p.chest[1] * D2R, p.chest[2] * D2R);
    this.neck.rotation.set(p.neck[0] * D2R, p.neck[1] * D2R, p.neck[2] * D2R, 'YXZ');
    this.head.rotation.set((p.head[0] + e.headPitch) * D2R, (p.head[1] + e.headYaw) * D2R, p.head[2] * D2R, 'YXZ');
    this.root.updateMatrixWorld(true);
    var self = this, tmp = new T.Vector3(), tmp2 = new T.Vector3();
    function toLocal(obj, arr, out) { out.fromArray(arr); self.root.localToWorld(out); obj.worldToLocal(out); return out; }
    /* руки — в системе грудной клетки */
    [[this.arms[0], p.lH, p.lE], [this.arms[1], p.rH, p.rE]].forEach(function (a) {
      var Tg = toLocal(self.chest, a[1], tmp), P = toLocal(self.chest, a[2], tmp2);
      self._ik(a[0].up, a[0].lo, DIM.up, DIM.lo, Tg.clone(), P.clone());
    });
    /* ноги — в системе таза */
    [[this.legs[0], p.lF, p.lK, 0], [this.legs[1], p.rF, p.rK, 1]].forEach(function (l) {
      var Tg = toLocal(self.hips, l[1], tmp), P = toLocal(self.hips, l[2], tmp2);
      self._ik(l[0].th, l[0].sn, DIM.th, DIM.sn, Tg.clone(), P.clone());
    });
    if (this.arms[0].hand) { var hide = p.pocket || [0, 0]; this.arms[0].hand.forEach(function (m) { m.visible = hide[0] < 0.5; }); this.arms[1].hand.forEach(function (m) { m.visible = hide[1] < 0.5; }); }
    this.root.updateMatrixWorld(true);
    /* стопы ставим параллельно земле (с поворотом носка и подъёмом пятки) */
    var rq = new T.Quaternion(); this.root.getWorldQuaternion(rq);
    this.legs.forEach(function (l, i) {
      var pq = new T.Quaternion(); l.sn.getWorldQuaternion(pq);
      var want = rq.clone().multiply(new T.Quaternion().setFromEuler(new T.Euler(-p.heel[i] * D2R, p.footYaw[i] * D2R * l.s, 0, 'YXZ')));
      l.ft.quaternion.copy(pq.invert().multiply(want));
    });
    this.root.updateMatrixWorld(true);
  };
  /* контровой «ореол»: френелевская подсветка контура со стороны солнца */
  Figure.prototype.enableRim = function () {
    var U = this.rimU = { rimDir: { value: new T.Vector3(0, 0, -1) }, rimColor: { value: new T.Color('#ffd9a0') }, rimK: { value: 0 } };
    var seen = [];
    this.root.traverse(function (m) {
      if (!m.isMesh || seen.indexOf(m.material) >= 0) return;
      seen.push(m.material);
      m.material.onBeforeCompile = function (sh) {
        sh.uniforms.rimDir = U.rimDir; sh.uniforms.rimColor = U.rimColor; sh.uniforms.rimK = U.rimK;
        sh.fragmentShader = 'uniform vec3 rimDir; uniform vec3 rimColor; uniform float rimK;\n' + sh.fragmentShader.replace('#include <dithering_fragment>',
          'float frs = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.6);\n' +
          'float sideK = smoothstep(-0.1, 0.7, dot(normal, rimDir));\n' +
          'gl_FragColor.rgb += rimColor * frs * sideK * rimK;\n#include <dithering_fragment>');
      };
      m.material.needsUpdate = true;
    });
  };
  /* мировые точки для проверок кадра */
  Figure.prototype.points = function () {
    this.root.updateMatrixWorld(true);
    var w = function (o, x, y, z) { return o.localToWorld(new T.Vector3(x || 0, y || 0, z || 0)); };
    var h = this.head;
    return {
      top: w(h, 0, 0.118, 0), eyes: w(h, 0, 0.012, 0.075), chin: w(h, 0, -0.1, 0.045), nose: w(h, 0, -0.01, 0.12),
      neck: w(this.neck, 0, 0, 0), chest: w(this.chest, 0, 0.12, 0.1), waist: w(this.hips, 0, 0.08, 0.1), hips: w(this.hips, 0, -0.05, 0),
      knee: w(this.legs[0].sn, 0, 0, 0), knee2: w(this.legs[1].sn, 0, 0, 0), ankle: w(this.legs[0].ft, 0, 0, 0), foot: w(this.legs[0].ft, 0, -0.08, 0.05),
      elbow: w(this.arms[0].lo, 0, 0, 0), elbow2: w(this.arms[1].lo, 0, 0, 0), wrist: w(this.arms[0].lo, 0, -DIM.lo, 0),
      headCenter: w(h, 0, 0, 0), forward: new T.Vector3(0, 0, 1).applyQuaternion(h.getWorldQuaternion(new T.Quaternion()))
    };
  };
  /* силуэт: все материалы — чёрные */
  Figure.prototype.setSilhouette = function (on) {
    var self = this;
    if (!this._sil) this._sil = new T.MeshBasicMaterial({ color: '#111111' });
    this.root.traverse(function (m) {
      if (!m.isMesh) return;
      if (on) { if (!m.userData.mat) m.userData.mat = m.material; m.material = self._sil; }
      else if (m.userData.mat) m.material = m.userData.mat;
    });
  };
  /* шаг на месте — для движения камеры: phase в радианах */
  Figure.prototype.walkPose = function (ph) {
    var s = Math.sin(ph), c = Math.cos(ph), lift = function (x) { return Math.max(0, x); };
    return fullPose({
      hips: [0, DIM.hipsY - 0.03 - 0.015 * Math.abs(c), 0], hipsRot: [0, s * 6, 0], chest: [4, -s * 8, 0], head: [-2, s * 4, 0],
      lF: [0.1, DIM.ank + 0.08 * lift(-c), s * 0.3], rF: [-0.1, DIM.ank + 0.08 * lift(c), -s * 0.3],
      lK: [0.12, 0.6, 0.9], rK: [-0.12, 0.6, 0.9],
      lH: [0.22, 0.97, -s * 0.22], rH: [-0.22, 0.97, s * 0.22],
      lE: [0.35, 1.2, -0.6], rE: [-0.35, 1.2, -0.6], heel: [lift(s) * 25, lift(-s) * 25]
    });
  };

  /* ---------- готовая 3D-модель (glTF со скелетом Mixamo) ---------- */
  var LOADER_URLS = {
    GLTFLoader: 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js',
    SkeletonUtils: 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/utils/SkeletonUtils.js'
  };
  function loadScript(src) {
    return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }
  var modelCache = {};
  function loadModel(url) {
    if (!modelCache[url]) {
      var need = Object.keys(LOADER_URLS).filter(function (k) { return !T[k]; });
      modelCache[url] = Promise.all(need.map(function (k) { return loadScript(LOADER_URLS[k]); })).then(function () {
        return new Promise(function (res, rej) { new T.GLTFLoader().load(url, res, null, rej); });
      });
    }
    return modelCache[url];
  }
  function modelUrlFor(node) { return (node && node.getAttribute('data-model')) || window.ML_STUDIO_MODEL || null; }

  function ModelFig(g) {
    var self = this;
    var scene = T.SkeletonUtils.clone(g.scene);
    this.root = new T.Group(); this.root.add(scene);
    scene.traverse(function (m) { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; } });
    this.bones = {};
    scene.traverse(function (o) { if (o.isBone) self.bones[o.name.replace(/^mixamorig:?/, '')] = o; });
    this.clips = {}; g.animations.forEach(function (a) { self.clips[a.name.toLowerCase()] = a; });
    this.mixer = new T.AnimationMixer(scene);
    this.aIdle = this.mixer.clipAction(this.clips.idle); this.aWalk = this.mixer.clipAction(this.clips.walk);
    this.aIdle.play(); this.aWalk.play(); this.aWalk.weight = 0;
    this.idleT = 0.7;
    this.extra = { headYaw: 0, headPitch: 0, bodyYaw: 0 };
    this.mixer.setTime(this.idleT); this.root.updateMatrixWorld(true);
    var top = this.bones.HeadTop_End.getWorldPosition(new T.Vector3()).y;
    scene.scale.multiplyScalar(1.66 / top);
    this.pose = { mode: 'idle' }; this.current = this.pose;
    this.apply(this.pose);
  }
  ModelFig.prototype.setPose = function () { this.apply(this.pose); };
  ModelFig.prototype.update = function () { return false; };
  ModelFig.prototype.walkPose = function (ph) {
    var d = this.clips.walk.duration;
    return { mode: 'walk', t: (((ph / (2 * Math.PI)) % 1) + 1) % 1 * d };
  };
  ModelFig.prototype.apply = function (p) {
    p = p && p.mode ? p : this.pose;
    this.current = p;
    var walk = p.mode === 'walk';
    this.aIdle.weight = walk ? 0 : 1; this.aWalk.weight = walk ? 1 : 0;
    this.mixer.setTime(walk ? p.t : this.idleT);
    this.root.rotation.y = this.extra.bodyYaw * D2R;
    this.root.updateMatrixWorld(true);
    if (this.extra.headYaw || this.extra.headPitch) {
      var h = this.bones.Head, pq = h.parent.getWorldQuaternion(new T.Quaternion());
      var turn = new T.Quaternion().setFromEuler(new T.Euler(this.extra.headPitch * D2R, this.extra.headYaw * D2R, 0, 'YXZ'));
      var bodyQ = this.root.getWorldQuaternion(new T.Quaternion());
      turn = bodyQ.clone().multiply(turn).multiply(bodyQ.clone().invert());
      h.quaternion.premultiply(pq.clone().invert().multiply(turn).multiply(pq));
      this.root.updateMatrixWorld(true);
    }
  };
  ModelFig.prototype.points = function () {
    this.root.updateMatrixWorld(true);
    var b = this.bones, w = function (o) { return o.getWorldPosition(new T.Vector3()); };
    var head = w(b.Head), top = w(b.HeadTop_End), fwd = new T.Vector3(0, 0, 1).applyQuaternion(this.root.quaternion);
    var hc = head.clone().lerp(top, 0.4);
    return {
      top: top, eyes: hc.clone().addScaledVector(fwd, 0.08), chin: head.clone().addScaledVector(fwd, 0.07).add(new T.Vector3(0, -0.025, 0)),
      nose: hc.clone().addScaledVector(fwd, 0.11), neck: w(b.Neck), chest: w(b.Spine2), waist: w(b.Spine), hips: w(b.Hips),
      knee: w(b.LeftLeg), knee2: w(b.RightLeg), ankle: w(b.LeftFoot), foot: w(b.LeftToeBase),
      elbow: w(b.LeftForeArm), elbow2: w(b.RightForeArm), wrist: w(b.LeftHand), headCenter: hc, forward: fwd
    };
  };
  /* подменяет нарисованную фигуру готовой моделью, когда та загрузится */
  function attachModel(host, stage, fig, swap) {
    var url = modelUrlFor(host);
    if (!url) return;
    loadModel(url).then(function (g) {
      var m = new ModelFig(g);
      m.extra.bodyYaw = fig.extra.bodyYaw; m.extra.headYaw = fig.extra.headYaw;
      var parent = fig.root.parent;
      m.root.position.copy(fig.root.position);
      parent.add(m.root); parent.remove(fig.root);
      m.apply(m.pose);
      swap(m);
      stage.invalidate();
    }).catch(function (e) { if (window.console) console.warn('MLStudio: модель не загрузилась, остаётся встроенная фигура', e); });
  }

  /* ---------- позы ---------- */
  var POSES = {
    soldier: { lH: [0.215, 0.94, 0.0], rH: [-0.215, 0.94, 0.0], lF: [0.095, DIM.ank, 0], rF: [-0.095, DIM.ank, 0] },
    contra: {
      yaw: 0, hips: [-0.035, DIM.hipsY - 0.01, 0], hipsRot: [0, 6, -5], spine: [0, -4, 3], chest: [0, -4, 3], head: [0, 0, 5],
      rF: [-0.06, DIM.ank, -0.01], lF: [0.11, DIM.ank, 0.1], lK: [0.1, 0.6, 0.8], footYaw: [20, 6],
      lH: [0.235, 0.96, 0.07], lE: [0.45, 1.15, -0.4],
      rH: [-0.16, 1.0, 0.04], rE: [-0.6, 1.25, -0.25]
    },
    pockets: {
      hips: [-0.02, DIM.hipsY - 0.005, 0], hipsRot: [0, 4, -3], chest: [-3, -3, 2], head: [-3, 0, 3],
      rF: [-0.1, DIM.ank, 0], lF: [0.16, DIM.ank, 0.06], lK: [0.3, 0.6, 0.6], footYaw: [15, 8],
      lH: [0.125, 0.9, 0.1], lE: [0.5, 1.1, -0.3], rH: [-0.125, 0.9, 0.1], rE: [-0.5, 1.1, -0.3], pocket: [1, 1]
    },
    crossed: {
      hips: [0, DIM.hipsY - 0.005, 0], chest: [-3, 0, 0], head: [-4, 0, 0],
      lF: [0.15, DIM.ank, 0.02], rF: [-0.15, DIM.ank, 0], footYaw: [12, 12],
      lH: [-0.08, 1.2, 0.16], lE: [0.26, 1.02, 0.12], rH: [0.08, 1.23, 0.18], rE: [-0.26, 1.02, 0.14]
    },
    think: {
      hips: [0.02, DIM.hipsY - 0.005, 0], hipsRot: [0, -4, 4], chest: [3, 4, -2], neck: [6, 0, 0], head: [4, -8, -6],
      lF: [0.08, DIM.ank, 0], rF: [-0.16, DIM.ank, 0.08], rK: [-0.4, 0.6, 0.7], footYaw: [6, 20],
      rH: [-0.03, 1.43, 0.17], rE: [-0.3, 1.1, 0.25], lH: [-0.12, 1.17, 0.17], lE: [0.32, 1.05, 0.15]
    },
    walk: {
      hips: [0, DIM.hipsY - 0.035, 0], hipsRot: [0, -7, 0], chest: [4, 9, 0], head: [-2, -6, 0],
      lF: [0.1, DIM.ank + 0.01, 0.33], rF: [-0.1, DIM.ank + 0.06, -0.3], rK: [-0.12, 0.6, 0.9], heel: [0, 30],
      lH: [0.24, 0.98, -0.2], lE: [0.35, 1.2, -0.6], rH: [-0.22, 1.0, 0.22], rE: [-0.35, 1.2, -0.5]
    },
    wall: {
      hips: [0, DIM.hipsY - 0.01, -0.03], spine: [-4, 0, 0], chest: [-3, 0, 0], head: [2, 0, 4],
      lF: [0.12, DIM.ank, 0.12], rF: [-0.09, 0.42, -0.08], rK: [-0.12, 0.7, 0.7], footYaw: [12, 0],
      lH: [0.125, 0.9, 0.1], lE: [0.5, 1.1, -0.3], rH: [-0.125, 0.9, 0.1], rE: [-0.5, 1.1, -0.3], pocket: [1, 1]
    },
    sit: {
      hips: [0, 0.58, -0.06], hipsRot: [-6, 0, 0], spine: [16, 0, 0], chest: [8, 0, 0], neck: [-10, 0, 0], head: [-12, 0, 0],
      lF: [0.16, DIM.ank, 0.36], rF: [-0.15, DIM.ank, 0.34], lK: [0.22, 1.2, 1.2], rK: [-0.22, 1.2, 1.2], footYaw: [8, 8],
      lH: [0.03, 0.56, 0.38], lE: [0.42, 0.75, 0.25], rH: [-0.03, 0.56, 0.38], rE: [-0.42, 0.75, 0.25]
    },
    shoulder: {
      yaw: 0, hips: [-0.03, DIM.hipsY - 0.01, 0], hipsRot: [0, 0, -4], chest: [0, 18, 2], neck: [0, 25, 0], head: [-3, 38, 4],
      rF: [-0.08, DIM.ank, 0], lF: [0.16, DIM.ank, -0.06], lK: [0.3, 0.6, 0.6], footYaw: [10, 4],
      lH: [0.23, 0.96, 0.03], lE: [0.45, 1.15, -0.4], rH: [-0.2, 0.96, 0.06], rE: [-0.45, 1.15, -0.4]
    }
  };

  ModelFig.prototype.enableRim = function () { return Figure.prototype.enableRim.call(this); };
  window.MLStudio = {
    withThree: withThree, Stage: Stage, Figure: Figure, ModelFig: ModelFig, attachModel: attachModel, loadModel: loadModel, POSES: POSES, DIM: DIM,
    buildPark: buildPark, buildPiazza: buildPiazza, makeTree: makeTree, makeLamp: makeLamp, makeBench: makeBench, makeWall: makeWall, makePlaza: makePlaza, makeBuilding: makeBuilding,
    util: { clamp: clamp, lerp: lerp, smooth: smooth, ease: ease, D2R: D2R, el: el, rng: rng, focalToFov: focalToFov, mat: mat, shadowy: shadowy },
    injectCSS: function () { injectCSS('mls-css', CSS); }, three: function () { return T; },
    widgets: {}
  };
  function init() {
    var nodes = document.querySelectorAll('[data-ml-widget^="studio-"]');
    Array.prototype.forEach.call(nodes, function (n) {
      if (n.__mls) return;
      var name = n.getAttribute('data-ml-widget').slice(7), w = window.MLStudio.widgets[name];
      if (!w) return;
      n.__mls = true;
      window.MLStudio.injectCSS();
      n.innerHTML = '<div class="mls"><div class="mls-view"><div class="mls-load">Загружаю 3D-сцену…</div></div></div>';
      withThree(function () { n.innerHTML = ''; w(n); }, function () {
        n.querySelector('.mls-load').textContent = 'Не удалось загрузить 3D-библиотеку. Проверьте интернет и обновите страницу.';
      });
    });
  }
  window.MLStudio.init = init;
  /* запуск после того, как подключатся все виджеты (см. конец сборки) */
})();
