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
    r.toneMapping = T.ACESFilmicToneMapping;
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
    this.sun.intensity = lerp(2.1, 2.5, k) * (el < 0 ? 0 : clamp(el / 4, 0.15, 1));
    this.skyU.top.value.set('#33508f').lerp(new T.Color('#3f7fd6'), k);
    this.skyU.hor.value.set('#f2b38a').lerp(new T.Color('#cfe0ee'), k);
    this.skyU.glow.value.set('#ffb070').lerp(new T.Color('#fff2d0'), k);
    this.skyU.glowK.value = lerp(1.6, 0.8, k);
    this.hemi.color.set('#9fb0d8').lerp(new T.Color('#cfe3ff'), k);
    this.hemi.intensity = lerp(0.26, 0.32, k);
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

  /* ---------- манекен ---------- */
  var COL = { skin: '#d6a084', hair: '#3b2a20', jacket: '#c98a2e', tee: '#ebe6dc', jeans: '#33435f', shoe: '#242326' };
  var DIM = { hipsY: 0.95, spine: 0.11, chest: 0.2, sh: [0.165, 0.185], neck: 0.235, head: 0.112, hip: [0.085, -0.045], up: 0.29, lo: 0.26, th: 0.42, sn: 0.42, ank: 0.075 };

  function lathe(pts, segs, phiStart, phiLen, m) {
    var v = pts.map(function (p) { return new T.Vector2(p[0], p[1]); });
    var g = new T.LatheGeometry(v, segs || 24, phiStart || 0, phiLen || Math.PI * 2);
    var mesh = new T.Mesh(g, m);
    return mesh;
  }
  function limbMesh(len, r1, r2, m) {
    var g = new T.Group();
    var c = new T.Mesh(new T.CylinderGeometry(r2, r1, len, 14), m); c.position.y = -len / 2; g.add(c);
    var s = new T.Mesh(new T.SphereGeometry(r1, 14, 10), m); g.add(s);
    var e = new T.Mesh(new T.SphereGeometry(r2, 14, 10), m); e.position.y = -len; g.add(e);
    return g;
  }

  function Figure(opt) {
    opt = opt || {};
    var c = Object.assign({}, COL, opt.colors || {});
    var M = this.mats = {
      skin: mat(c.skin, { roughness: 0.62 }), hair: mat(c.hair, { roughness: 0.75 }), jacket: mat(c.jacket, { roughness: 0.8 }),
      tee: mat(c.tee, { roughness: 0.85 }), jeans: mat(c.jeans, { roughness: 0.9 }), shoe: mat(c.shoe, { roughness: 0.6 }),
      dark: mat('#1d1512', { roughness: 0.4 }), lip: mat('#a8645a', { roughness: 0.6 })
    };
    this.mats.jacket.side = T.DoubleSide;
    var root = this.root = new T.Group();
    var hips = this.hips = new T.Group(); hips.position.y = DIM.hipsY; root.add(hips);
    /* таз */
    var pel = lathe([[0, -0.125], [0.135, -0.115], [0.172, -0.04], [0.165, 0.04], [0.15, 0.11], [0, 0.11]], 24, 0, 0, M.jeans);
    pel.scale.z = 0.74; hips.add(pel);
    var spine = this.spine = new T.Group(); spine.position.y = DIM.spine; hips.add(spine);
    var chest = this.chest = new T.Group(); chest.position.y = DIM.chest; spine.add(chest);
    /* торс: футболка + куртка с распахнутой полой */
    var torsoPts = [[0.001, -0.31], [0.148, -0.3], [0.15, -0.2], [0.154, -0.08], [0.17, 0.04], [0.188, 0.13], [0.182, 0.19], [0.13, 0.225], [0.055, 0.24], [0.001, 0.24]];
    var tee = lathe(torsoPts, 28, 0, 0, M.tee); tee.scale.z = 0.62; chest.add(tee);
    var jk = lathe(torsoPts.map(function (p) { return [p[0] * 1.06 + 0.004, p[1] - 0.004]; }), 28, Math.PI * 0.12, Math.PI * 1.76, M.jacket);
    jk.scale.z = 0.66; chest.add(jk);
    /* шея и голова */
    var neck = this.neck = new T.Group(); neck.position.y = DIM.neck; chest.add(neck);
    var nk = new T.Mesh(new T.CylinderGeometry(0.048, 0.055, 0.1, 12), M.skin); nk.position.y = 0.03; neck.add(nk);
    var head = this.head = new T.Group(); head.position.y = DIM.head; neck.add(head);
    var hd = new T.Mesh(new T.SphereGeometry(0.1, 32, 24), M.skin); hd.scale.set(0.9, 1.12, 1.0); head.add(hd);
    var jaw = new T.Mesh(new T.SphereGeometry(0.075, 24, 16), M.skin); jaw.position.set(0, -0.05, 0.025); jaw.scale.set(1, 0.9, 1); head.add(jaw);
    var hair = new T.Mesh(new T.SphereGeometry(0.106, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.56), M.hair);
    hair.scale.set(0.93, 1.12, 1.04); hair.rotation.x = -0.32; hair.position.set(0, 0.012, -0.008); head.add(hair);
    [-1, 1].forEach(function (s) {
      var eye = new T.Mesh(new T.SphereGeometry(0.012, 12, 8), M.dark); eye.position.set(0.034 * s, 0.012, 0.088); head.add(eye);
      var brow = new T.Mesh(new T.BoxGeometry(0.03, 0.006, 0.01), M.hair); brow.position.set(0.034 * s, 0.036, 0.092); brow.rotation.z = -0.12 * s; head.add(brow);
      var ear = new T.Mesh(new T.SphereGeometry(0.022, 10, 8), M.skin); ear.scale.set(0.45, 1, 0.8); ear.position.set(0.09 * s, 0.0, 0.0); head.add(ear);
    });
    var nose = new T.Mesh(new T.SphereGeometry(0.016, 14, 10), M.skin); nose.scale.set(0.8, 1.35, 1.1); nose.position.set(0, -0.016, 0.098); head.add(nose);
    var mouth = new T.Mesh(new T.BoxGeometry(0.032, 0.006, 0.008), M.lip); mouth.position.set(0, -0.052, 0.09); head.add(mouth);
    /* руки */
    var self = this;
    this.arms = [1, -1].map(function (s) {
      var up = new T.Group(); up.position.set(DIM.sh[0] * s, DIM.sh[1], 0); chest.add(up);
      up.add(limbMesh(DIM.up, 0.05, 0.045, M.jacket));
      var lo = new T.Group(); lo.position.y = -DIM.up; up.add(lo);
      lo.add(limbMesh(DIM.lo, 0.047, 0.04, M.jacket));
      var cuff = new T.Mesh(new T.CylinderGeometry(0.03, 0.032, 0.03, 10), M.skin); cuff.position.y = -DIM.lo - 0.015; lo.add(cuff);
      var hand = new T.Mesh(new T.SphereGeometry(0.045, 14, 10), M.skin); hand.scale.set(0.55, 1.15, 0.95); hand.position.y = -DIM.lo - 0.07; lo.add(hand);
      var th = new T.Mesh(new T.SphereGeometry(0.018, 8, 6), M.skin); th.scale.set(1, 1.7, 1); th.position.set(0, -DIM.lo - 0.05, 0.035); lo.add(th);
      return { up: up, lo: lo, s: s, hand: [hand, th] };
    });
    /* ноги */
    this.legs = [1, -1].map(function (s) {
      var th = new T.Group(); th.position.set(DIM.hip[0] * s, DIM.hip[1], 0); hips.add(th);
      th.add(limbMesh(DIM.th, 0.086, 0.062, M.jeans));
      var sn = new T.Group(); sn.position.y = -DIM.th; th.add(sn);
      sn.add(limbMesh(DIM.sn, 0.062, 0.047, M.jeans));
      var ft = new T.Group(); ft.position.y = -DIM.sn; sn.add(ft);
      var shoe = new T.Mesh(new T.BoxGeometry(0.1, 0.075, 0.26), M.shoe); shoe.position.set(0, -0.04, 0.055); ft.add(shoe);
      var toe = new T.Mesh(new T.SphereGeometry(0.05, 12, 8), M.shoe); toe.scale.set(1, 0.75, 1); toe.position.set(0, -0.045, 0.17); ft.add(toe);
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
      top: w(h, 0, 0.125, 0), eyes: w(h, 0, 0.012, 0.08), chin: w(h, 0, -0.115, 0.05), nose: w(h, 0, -0.01, 0.12),
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

  /* ---------- позы ---------- */
  var POSES = {
    soldier: { lH: [0.215, 0.94, 0.0], rH: [-0.215, 0.94, 0.0], lF: [0.095, DIM.ank, 0], rF: [-0.095, DIM.ank, 0] },
    contra: {
      yaw: 0, hips: [-0.035, DIM.hipsY - 0.01, 0], hipsRot: [0, 6, -5], spine: [0, -4, 3], chest: [0, -4, 3], head: [0, 0, 5],
      rF: [-0.07, DIM.ank, -0.01], lF: [0.17, DIM.ank, 0.09], lK: [0.4, 0.6, 0.7], footYaw: [20, 6],
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

  window.MLStudio = {
    withThree: withThree, Stage: Stage, Figure: Figure, POSES: POSES, DIM: DIM,
    buildPark: buildPark, makeTree: makeTree, makeLamp: makeLamp, makeBench: makeBench, makeWall: makeWall, makePlaza: makePlaza, makeBuilding: makeBuilding,
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
