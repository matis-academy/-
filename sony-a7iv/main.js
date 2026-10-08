import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { PARTS, GROUPS } from './parts.js';

// Единицы сцены: 1 = 1 см. Оси: +x — сторона разъёмов, −x — рукоятка,
// +y — верх, +z — перед (байонет), −z — задняя панель (экран).
const W = 13.1, H = 7.2, D = 3.8;          // корпус без рукоятки и «горба» видоискателя
const ZF = D / 2, ZB = -D / 2;              // передняя / задняя плоскости
const XL = W / 2, XG = -W / 2;              // сторона разъёмов / сторона рукоятки
const LENS_X = 1.0, LENS_Y = 3.7;           // ось объектива
const ACCENT = new THREE.Color(0xff8a2a);

// ───────────────────────── Сцена ─────────────────────────
const canvas = document.getElementById('scene');
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 400);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 9;
controls.maxDistance = 60;
controls.autoRotateSpeed = 1.2;

const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(-8, 16, -10);
const fill = new THREE.DirectionalLight(0xbfd4ff, 0.7);
fill.position.set(14, 6, 12);
const rim = new THREE.DirectionalLight(0xffe2c4, 0.8);
rim.position.set(4, 10, 18);
scene.add(key, fill, rim, new THREE.HemisphereLight(0xffffff, 0x202024, 0.35));

const cam = new THREE.Group();          // вся камера
scene.add(cam);

// ───────────────────────── Материалы ─────────────────────────
const M = {
  body:   new THREE.MeshStandardMaterial({ color: 0x1d1e21, roughness: 0.55, metalness: 0.25 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.92, metalness: 0.0 }),
  button: new THREE.MeshStandardMaterial({ color: 0x1e1f23, roughness: 0.5, metalness: 0.05, envMapIntensity: 0.6 }),
  dark:   new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.7, metalness: 0.1 }),
  metal:  new THREE.MeshStandardMaterial({ color: 0xc9cbd0, roughness: 0.28, metalness: 1.0 }),
  gold:   new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.25, metalness: 1.0 }),
  glass:  new THREE.MeshStandardMaterial({ color: 0x0a0f1a, roughness: 0.05, metalness: 0.6 }),
  throat: new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.95, side: THREE.BackSide }),
  hidden: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
};

// ───────────────────────── Текстуры-надписи ─────────────────────────
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
const FONT = '"Helvetica Neue", Arial, sans-serif';

function textTex(text, { color = '#e8e8e8', weight = 700, w = 256, h = 256, fill = 0.62 } = {}) {
  return canvasTex(w, h, (g) => {
    let size = h * 0.5;
    g.font = `${weight} ${size}px ${FONT}`;
    const tw = g.measureText(text).width;
    if (tw > w * fill) size *= (w * fill) / tw;
    g.font = `${weight} ${size}px ${FONT}`;
    g.fillStyle = color;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + size * 0.04);
  });
}

function knurlTex(count = 48, light = '#3a3b40', dark = '#151517') {
  const t = canvasTex(256, 16, (g, w, h) => {
    g.fillStyle = dark; g.fillRect(0, 0, w, h);
    g.fillStyle = light;
    for (let i = 0; i < 8; i++) g.fillRect(i * 32, 0, 12, h);
  });
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(count / 8, 1);
  return t;
}

// ───────────────────────── Регистрация частей ─────────────────────────
const partObjects = new Map();   // id -> { meshes: [], anchor: Vector3, face }
const pickables = [];

function register(id, obj, face) {
  if (!partObjects.has(id)) partObjects.set(id, { meshes: [], face, anchor: new THREE.Vector3() });
  const rec = partObjects.get(id);
  obj.traverse((m) => {
    if (!m.isMesh) return;
    m.userData.partId = id;
    if (m.material !== M.hidden) {
      m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone();
      rec.meshes.push(m);
    }
    pickables.push(m);
  });
  return obj;
}

// Ориентирует объект так, что его локальная ось +Y смотрит вдоль нормали поверхности.
const UP = new THREE.Vector3(0, 1, 0);
function alignY(obj, normal) {
  obj.quaternion.setFromUnitVectors(UP, normal.clone().normalize());
  return obj;
}

// Плоская надпись на поверхности: нормаль n, «верх» текста up.
function decal(tex, w, h, pos, n, up, { opacity = 1 } = {}) {
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent: true, opacity, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -4,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  const N = n.clone().normalize(), U = up.clone().normalize();
  const R = new THREE.Vector3().crossVectors(U, N);
  m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(R, U, N));
  m.position.copy(pos);
  return m;
}
const FACE = {
  rear:   { n: new THREE.Vector3(0, 0, -1), up: new THREE.Vector3(0, 1, 0) },
  front:  { n: new THREE.Vector3(0, 0, 1),  up: new THREE.Vector3(0, 1, 0) },
  top:    { n: new THREE.Vector3(0, 1, 0),  up: new THREE.Vector3(0, 0, 1) },
  left:   { n: new THREE.Vector3(1, 0, 0),  up: new THREE.Vector3(0, 1, 0) },   // разъёмы
  right:  { n: new THREE.Vector3(-1, 0, 0), up: new THREE.Vector3(0, 1, 0) },   // рукоятка
  bottom: { n: new THREE.Vector3(0, -1, 0), up: new THREE.Vector3(0, 0, 1) },
};

// Круглая кнопка: основание на поверхности в точке p, выступает по нормали face на h.
function roundButton(id, faceName, p, r, h, { label = '', labelColor, mat = M.button, ring } = {}) {
  const f = FACE[faceName];
  const g = new THREE.Group();
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.04, h, 40), mat);
  cyl.position.y = h / 2;
  g.add(cyl);
  if (ring) {
    const rg = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.32, r * 1.32, h * 0.35, 40), ring);
    rg.position.y = h * 0.175;
    g.add(rg);
  }
  alignY(g, f.n);
  g.position.copy(p);
  cam.add(g);
  if (label) {
    const pos = p.clone().addScaledVector(f.n, h + 0.004);
    cam.add(register(id, decal(textTex(label, { color: labelColor }), r * 1.9, r * 1.9, pos, f.n, f.up), faceName));
  }
  return register(id, g, faceName);
}

// Колесо/диск: цилиндр с насечкой, ось — нормаль face.
function dial(id, faceName, p, r, h, { segs = 64, knurl = 40, top = M.button } = {}) {
  const side = new THREE.MeshStandardMaterial({ map: knurlTex(knurl), roughness: 0.6, metalness: 0.1 });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, segs), [side, top, top]);
  alignY(m, FACE[faceName].n);
  m.position.copy(p);
  cam.add(m);
  return register(id, m, faceName);
}

function box(w, h, d, mat, p, radius = 0, segs = 2) {
  const geo = radius > 0 ? new RoundedBoxGeometry(w, h, d, segs, radius) : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(p);
  cam.add(m);
  return m;
}

function proxy(id, faceName, p, r = 0.35) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), M.hidden);
  m.position.copy(p);
  cam.add(m);
  register(id, m, faceName);
  return m;
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ───────────────────────── Корпус ─────────────────────────
{
  // Корпус — профиль со сквозным отверстием горловины байонета, выдавленный по z со скруглёнными кромками
  const B = 0.45, w = W / 2 - B, h = H / 2 - B, r = 0.12;
  const s = new THREE.Shape();
  s.moveTo(-w + r, -h); s.lineTo(w - r, -h); s.quadraticCurveTo(w, -h, w, -h + r);
  s.lineTo(w, h - r); s.quadraticCurveTo(w, h, w - r, h); s.lineTo(-w + r, h);
  s.quadraticCurveTo(-w, h, -w, h - r); s.lineTo(-w, -h + r); s.quadraticCurveTo(-w, -h, -w + r, -h);
  const hole = new THREE.Path();
  hole.absarc(LENS_X, LENS_Y - H / 2, 2.32 + B, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, { depth: D - 2 * B, bevelEnabled: true, bevelThickness: B, bevelSize: B, bevelSegments: 6, curveSegments: 72 });
  const body = new THREE.Mesh(geo, M.body);
  body.position.set(0, H / 2, ZB + B);
  cam.add(body);
  // заглушка отверстия сзади (за экраном)
  const cap = new THREE.Mesh(new THREE.CircleGeometry(2.9, 48), M.body);
  cap.rotation.y = Math.PI;
  cap.position.set(LENS_X, LENS_Y, ZB + 0.2);
  cam.add(cap);
}
// рукоятка
box(3.7, H, 3.8, M.rubber, V(-4.7, H / 2, 2.4), 1.1, 6);
// «горб» видоискателя — трапеция, выдавленная по z
{
  const s = new THREE.Shape();
  const hb = 2.35, ht = 1.45, hh = 2.6;
  s.moveTo(-hb, 0); s.lineTo(hb, 0); s.lineTo(ht + 0.1, hh - 0.35);
  s.quadraticCurveTo(ht, hh, ht - 0.4, hh); s.lineTo(-ht + 0.4, hh);
  s.quadraticCurveTo(-ht, hh, -ht - 0.1, hh - 0.35); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 3.0, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.22, bevelSegments: 5, curveSegments: 10 });
  const hump = new THREE.Mesh(geo, M.body);
  hump.position.set(LENS_X, 7.0, -1.65);
  cam.add(hump);
}
const HUMP_TOP = 7.0 + 2.6 + 0.22, HUMP_FRONT = -1.65 + 3.0 + 0.25;

// Надписи на корпусе
cam.add(decal(textTex('SONY', { color: '#d8d9dc', w: 512, h: 128, fill: 0.95 }), 2.3, 0.58, V(LENS_X, 8.65, HUMP_FRONT + 0.003), FACE.front.n, FACE.front.up));
cam.add(decal(textTex('α', { color: '#d8d9dc', weight: 400 }), 0.9, 0.9, V(4.75, 6.05, ZF + 0.003), FACE.front.n, FACE.front.up));
cam.add(decal(textTex('7 IV', { color: '#bfc1c6', weight: 500, w: 256, h: 128, fill: 0.9 }), 0.9, 0.45, V(-2.15, 1.0, ZF + 0.003), FACE.front.n, FACE.front.up));

// ───────────────────────── ВЕРХ ─────────────────────────
// Кнопка спуска + кольцо питания (на рукоятке)
{
  const p = V(-4.7, H, 2.6);
  const ring = new THREE.Group();
  const rm = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.86, 0.18, 48), M.button);
  rm.position.y = 0.09;
  const tab = new THREE.Mesh(new RoundedBoxGeometry(0.55, 0.16, 0.42, 2, 0.06), M.button);
  tab.position.set(-0.85, 0.09, 0.35);
  ring.add(rm, tab);
  ring.position.copy(p);
  cam.add(ring);
  register('power', ring, 'top');
  cam.add(register('power', decal(textTex('ON', { color: '#cfd1d6', w: 128, h: 64, fill: 0.9 }), 0.42, 0.21, V(-5.75, H + 0.003, 3.45), FACE.top.n, FACE.top.up), 'top'));
  cam.add(register('power', decal(textTex('OFF', { color: '#cfd1d6', w: 128, h: 64, fill: 0.9 }), 0.48, 0.24, V(-5.85, H + 0.003, 2.3), FACE.top.n, FACE.top.up), 'top'));

  const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.52, 0.42, 48), M.button);
  sh.position.copy(p).add(V(0, 0.21, 0));
  const shTop = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 12, 0, Math.PI * 2, 0, 0.5), M.button);
  shTop.scale.y = 0.5;
  shTop.position.copy(p).add(V(0, 0.38, 0));
  cam.add(sh, shTop);
  register('shutter', sh, 'top'); register('shutter', shTop, 'top');
}
// Передний диск — под пальцем на рукоятке
dial('frontDial', 'top', V(-4.7, 6.55, 3.72), 0.85, 0.32, { knurl: 44 });
partObjects.get('frontDial').face = 'front';

// Переключатель Фото/Видео/S&Q + диск режимов
{
  const p = V(-3.0, H, 0.0);
  const collarSide = canvasTex(1024, 64, (g, w, h) => {
    g.fillStyle = '#1b1c1f'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2c2d32';
    for (let i = 0; i < 64; i++) g.fillRect(i * 16, 0, 6, h * 0.22);
    g.font = `700 30px ${FONT}`; g.fillStyle = '#e4e4e4'; g.textBaseline = 'middle'; g.textAlign = 'center';
    ['PHOTO', 'MOVIE', 'S&Q'].forEach((t, i) => g.fillText(t, 120 + i * 150, h * 0.62));
  });
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.36, 0.38, 72),
    [new THREE.MeshStandardMaterial({ map: collarSide, roughness: 0.6, metalness: 0.2 }), M.button, M.button]);
  collar.rotation.y = Math.PI * 0.65;
  collar.position.copy(p).add(V(0, 0.19, 0));
  cam.add(collar);
  const lock = box(0.36, 0.2, 0.18, M.button, V(-3.0, H + 0.19, 1.37), 0.06);
  register('stillMovie', collar, 'top'); register('stillMovie', lock, 'top');

  const topTex = canvasTex(512, 512, (g, w) => {
    const c = w / 2;
    g.fillStyle = '#1f2023'; g.beginPath(); g.arc(c, c, c, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#2e2f34'; g.lineWidth = 6; g.beginPath(); g.arc(c, c, c * 0.42, 0, Math.PI * 2); g.stroke();
    const labels = ['P', 'A', 'S', 'M', '1', '2', '3', 'AUTO'];
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#efefef';
    labels.forEach((t, i) => {
      const a = Math.PI / 2 + i * (Math.PI * 2 / 9);     // «P» — к фотографу (вниз текстуры)
      const x = c + Math.cos(a) * c * 0.72, y = c + Math.sin(a) * c * 0.72;
      g.save(); g.translate(x, y); g.rotate(a - Math.PI / 2);
      g.font = `700 ${t === 'AUTO' ? 44 : 70}px ${FONT}`;
      g.fillStyle = t === 'AUTO' ? '#7fd36a' : '#efefef';
      g.fillText(t, 0, 0); g.restore();
    });
  });
  const md = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.14, 0.52, 72),
    [new THREE.MeshStandardMaterial({ map: knurlTex(60), roughness: 0.6, metalness: 0.1 }), M.button, M.button]);
  md.position.copy(p).add(V(0, 0.38 + 0.26, 0));
  cam.add(md);
  const mdTop = decal(topTex, 2.2, 2.2, V(-3.0, H + 0.38 + 0.52 + 0.003, 0), FACE.top.n, FACE.top.up);
  cam.add(mdTop);
  const mdLock = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.08, 32), M.button);
  mdLock.position.set(-3.0, H + 0.94, 0);
  cam.add(mdLock);
  register('modeDial', md, 'top'); register('modeDial', mdTop, 'top'); register('modeDial', mdLock, 'top');
  // индекс диска
  cam.add(decal(canvasTex(64, 64, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(32, 8); g.lineTo(52, 50); g.lineTo(12, 50); g.fill(); }),
    0.22, 0.22, V(-3.0, H + 0.385, -1.2), FACE.top.n, FACE.top.up));
}

// Задний диск L (колесо у заднего края) и задний диск R (с блокировкой)
dial('dialL', 'top', V(-4.1, 6.82, ZB - 0.02), 0.8, 0.3, { knurl: 40 });
{
  const p = V(-5.7, H, -1.0);
  const r = dial('dialR', 'top', p.clone().add(V(0, 0.28, 0)), 1.0, 0.56, { knurl: 56 });
  const lk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 32), M.button);
  lk.position.copy(p).add(V(0, 0.62, 0));
  cam.add(lk);
  register('dialR', lk, 'top');
  cam.add(register('dialR', decal(canvasTex(64, 64, (g) => { g.fillStyle = '#fff'; g.fillRect(28, 6, 8, 52); }), 0.5, 0.5, p.clone().add(V(0, 0.683, 0)), FACE.top.n, FACE.top.up), 'top'));
}

roundButton('movie', 'top', V(-4.6, H, 0.9), 0.33, 0.18, { label: '●', labelColor: '#e0302a' });
roundButton('c2', 'top', V(-3.85, H, 1.8), 0.3, 0.16, { label: 'C2' });

// Многоинтерфейсный башмак
{
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 2.2), M.metal);
  base.position.y = 0.04;
  const railL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 2.2), M.metal);
  railL.position.set(-0.95, 0.12, 0);
  const railR = railL.clone(); railR.position.x = 0.95;
  const lipL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 2.2), M.metal);
  lipL.position.set(-0.78, 0.235, 0);
  const lipR = lipL.clone(); lipR.position.x = 0.78;
  const contacts = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.45), M.dark);
  contacts.position.set(0, 0.1, 0.55);
  g.add(base, railL, railR, lipL, lipR, contacts);
  for (let i = 0; i < 10; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.32), M.gold);
    c.position.set(-0.45 + i * 0.1, 0.135, 0.55);
    g.add(c);
  }
  g.position.set(LENS_X, HUMP_TOP, -0.15);
  cam.add(g);
  register('shoe', g, 'top');
}

// Метка положения матрицы ⊖
{
  const tex = canvasTex(128, 128, (g) => {
    g.strokeStyle = '#e6e6e6'; g.lineWidth = 9;
    g.beginPath(); g.arc(64, 64, 34, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(8, 64); g.lineTo(120, 64); g.stroke();
  });
  // метка стоит на линии плоскости матрицы (z ≈ 0.3)
  const d = decal(tex, 0.55, 0.55, V(4.5, H + 0.003, 0.3), FACE.top.n, FACE.top.up);
  cam.add(d);
  register('sensorMark', d, 'top');
  proxy('sensorMark', 'top', V(4.5, H, 0.3), 0.32);
}

// ───────────────────────── ЗАДНЯЯ ПАНЕЛЬ ─────────────────────────
// Экран на поворотном шарнире (шарнир у стороны разъёмов)
const HINGE = V(6.05, 3.25, ZB - 0.5);
const monitorPivot = new THREE.Group();
monitorPivot.position.copy(HINGE);
cam.add(monitorPivot);
{
  const mw = 7.7, mh = 5.1, md = 0.42;
  const frame = new THREE.Mesh(new RoundedBoxGeometry(mw, mh, md, 4, 0.18), M.body.clone());
  frame.position.set(2.05 - HINGE.x, 0, ZB - md / 2 - HINGE.z);
  monitorPivot.add(frame);
  const screenTex = canvasTex(1024, 672, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#6f97c7'); sky.addColorStop(0.55, '#c9d7e2'); sky.addColorStop(0.56, '#566a52'); sky.addColorStop(1, '#2d3a2a');
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = '#3d4b5a';
    g.beginPath(); g.moveTo(0, 380); g.lineTo(180, 250); g.lineTo(330, 330); g.lineTo(520, 200); g.lineTo(720, 340); g.lineTo(880, 270); g.lineTo(w, 360); g.lineTo(w, 380); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2;
    for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(w * i / 3, 0); g.lineTo(w * i / 3, h); g.stroke(); g.beginPath(); g.moveTo(0, h * i / 3); g.lineTo(w, h * i / 3); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 0, w, 64); g.fillRect(0, h - 70, w, 70);
    g.fillStyle = '#fff'; g.font = `600 34px ${FONT}`; g.textBaseline = 'middle';
    g.fillText('P   AF-C   [ ]   4K 10bit', 24, 33);
    g.fillText('1/250    F5.6    ±0.0    ISO 400', 24, h - 35);
    g.fillText('100%', w - 120, 33);
    g.strokeStyle = '#4fe06a'; g.lineWidth = 5; g.strokeRect(w / 2 - 70, h / 2 - 60, 140, 120);
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 4.6), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  screen.rotation.y = Math.PI;
  screen.position.set(2.05 - HINGE.x, 0, ZB - md - 0.003 - HINGE.z);
  monitorPivot.add(screen);
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 3.4, 20), M.button);
  hinge.position.set(0, 0, 0.12);
  monitorPivot.add(hinge);
  register('monitor', monitorPivot, 'rear');
}

// Видоискатель + наглазник
{
  const eyecup = box(3.4, 2.7, 0.95, M.rubber, V(LENS_X, 8.25, ZB - 0.47), 0.35, 4);
  register('eyecup', eyecup, 'rear');
  const glass = box(2.0, 1.45, 0.06, M.glass, V(LENS_X, 8.3, ZB - 0.93), 0.03);
  register('viewfinder', glass, 'rear');
  proxy('viewfinder', 'rear', V(LENS_X, 8.3, ZB - 0.98), 0.6);
  const sensor = box(1.1, 0.26, 0.06, M.glass, V(LENS_X, 6.55, ZB - 0.02), 0.03);
  register('eyeSensor', sensor, 'rear');
  proxy('eyeSensor', 'rear', V(LENS_X, 6.55, ZB - 0.05), 0.28);
}
// Диоптрийное колесо — на правом скате «горба»
{
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 32),
    [new THREE.MeshStandardMaterial({ map: knurlTex(24), roughness: 0.6 }), M.button, M.button]);
  m.rotation.z = Math.PI / 2;
  m.position.set(LENS_X - 2.25, 8.0, -1.15);
  cam.add(m);
  register('diopter', m, 'rear');
}

roundButton('c3', 'rear', V(5.45, 6.3, ZB), 0.3, 0.2, { label: 'C3' });
roundButton('menu', 'rear', V(4.15, 6.3, ZB), 0.34, 0.2, { label: 'MENU' });
roundButton('c1', 'rear', V(-2.0, 6.3, ZB), 0.3, 0.2, { label: 'C1' });
roundButton('afon', 'rear', V(-3.25, 5.95, ZB), 0.46, 0.24, { label: 'AF-ON' });
roundButton('ael', 'rear', V(-4.6, 5.95, ZB), 0.36, 0.22, { label: 'AEL' });
roundButton('fn', 'rear', V(-5.25, 4.75, ZB), 0.38, 0.22, { label: 'Fn' });
roundButton('playback', 'rear', V(-3.1, 1.3, ZB), 0.34, 0.2, { label: '▶' });
roundButton('c4', 'rear', V(-5.45, 1.3, ZB), 0.34, 0.2, { label: 'C4' });

// Мультиселектор (джойстик)
{
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.46, 0.08, 32), M.dark);
  base.position.y = 0.04;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.24, 20), M.button);
  stem.position.y = 0.18;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.14, 32),
    [M.button, new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (c) => {
      c.fillStyle = '#26272b'; c.fillRect(0, 0, 128, 128);
      c.fillStyle = '#34353b';
      for (let y = 8; y < 128; y += 16) for (let x = 8; x < 128; x += 16) { c.beginPath(); c.arc(x, y, 4, 0, 7); c.fill(); }
    }), roughness: 0.8 }), M.button]);
  cap.position.y = 0.36;
  g.add(base, stem, cap);
  alignY(g, FACE.rear.n);
  g.position.set(-3.35, 4.6, ZB);
  cam.add(g);
  register('joystick', g, 'rear');
}
// Колесо управления
{
  const p = V(-4.3, 3.0, ZB);
  dial('wheel', 'rear', p.clone().add(V(0, 0, -0.12)), 1.05, 0.24, { knurl: 72 });
  const ringTex = canvasTex(512, 512, (g, w) => {
    const c = w / 2;
    g.fillStyle = '#e9e9e9'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `700 54px ${FONT}`;
    g.fillText('DISP', c, c - 190);
    g.save(); g.translate(c + 192, c); g.rotate(Math.PI / 2); g.fillText('ISO', 0, 0); g.restore();
    // значок «протяжка»: два прямоугольника
    g.strokeStyle = '#e9e9e9'; g.lineWidth = 7;
    g.strokeRect(c - 226, c - 22, 34, 44); g.strokeRect(c - 208, c - 36, 34, 44);
  });
  cam.add(register('wheel', decal(ringTex, 2.1, 2.1, p.clone().add(V(0, 0, -0.243)), FACE.rear.n, FACE.rear.up), 'rear'));
  const center = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.3, 40), M.button);
  alignY(center, FACE.rear.n);
  center.position.copy(p).add(V(0, 0, -0.15));
  cam.add(center);
  register('wheel', center, 'rear');
}
// Индикатор доступа
{
  const m = box(0.14, 0.32, 0.04, new THREE.MeshStandardMaterial({ color: 0xff3b2f, emissive: 0x551008, roughness: 0.3 }), V(-6.1, 2.45, ZB - 0.02), 0.03);
  register('accessLamp', m, 'rear');
  proxy('accessLamp', 'rear', V(-6.1, 2.45, ZB - 0.05), 0.28);
}

// ───────────────────────── ПЕРЕД ─────────────────────────
const lensMountParts = new THREE.Group();
cam.add(lensMountParts);
{
  // Байонет
  const s = new THREE.Shape(); s.absarc(0, 0, 2.95, 0, Math.PI * 2, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, 2.32, 0, Math.PI * 2, true); s.holes.push(hole);
  const mount = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 64 }), M.metal);
  mount.position.set(LENS_X, LENS_Y, ZF - 0.02);
  cam.add(mount);
  register('mount', mount, 'front');
  for (let i = 0; i < 4; i++) {         // винты
    const a = Math.PI / 4 + i * Math.PI / 2;
    const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 12), M.dark);
    sc.rotation.x = Math.PI / 2;
    sc.position.set(LENS_X + Math.cos(a) * 2.64, LENS_Y + Math.sin(a) * 2.64, ZF + 0.33);
    cam.add(sc);
    register('mount', sc, 'front');
  }
  // Горловина
  const throat = new THREE.Mesh(new THREE.CylinderGeometry(2.32, 2.32, 1.65, 64, 1, true), M.throat);
  throat.rotation.x = Math.PI / 2;
  throat.position.set(LENS_X, LENS_Y, ZF - 0.825);
  cam.add(throat);
  // Матрица
  const sensTex = canvasTex(512, 340, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#2a3f52'); gr.addColorStop(0.45, '#5a3f6e'); gr.addColorStop(0.7, '#2d5c58'); gr.addColorStop(1, '#1d2a3a');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.08)';
    for (let x = 0; x < w; x += 6) g.fillRect(x, 0, 1, h);
  });
  const sensor = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.4), new THREE.MeshStandardMaterial({ map: sensTex, roughness: 0.15, metalness: 0.7 }));
  sensor.position.set(LENS_X, LENS_Y, ZF - 1.6);
  const sensorFrame = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 3.2), M.dark);
  sensorFrame.position.set(LENS_X, LENS_Y, ZF - 1.62);
  cam.add(sensor, sensorFrame);
  const backDisc = new THREE.Mesh(new THREE.CircleGeometry(2.8, 48), M.dark);
  backDisc.position.set(LENS_X, LENS_Y, ZF - 1.66);
  cam.add(backDisc);
  register('sensor', sensor, 'front');
  // Контакты объектива
  const cg = new THREE.Group();
  for (let i = 0; i < 11; i++) {
    const a = -Math.PI / 2 + (i - 5) * 0.085;
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.32), M.gold);
    c.position.set(Math.cos(a) * 2.18, Math.sin(a) * 2.18, 0);
    c.rotation.z = a + Math.PI / 2;
    cg.add(c);
  }
  const plate = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.2, 0.4), M.dark);
  plate.position.set(0, -2.24, -0.05);
  cg.add(plate);
  cg.position.set(LENS_X, LENS_Y, ZF + 0.05);
  cam.add(cg);
  register('contacts', cg, 'front');
  // Метка крепления (белая точка)
  const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 20), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
  dot.rotation.x = Math.PI / 2;
  dot.position.set(LENS_X + 0.55, LENS_Y + 2.8, ZF + 0.35);
  cam.add(dot);
  register('mountIndex', dot, 'front');
  proxy('mountIndex', 'front', dot.position.clone(), 0.22);
}
roundButton('lensRelease', 'front', V(4.45, 2.55, ZF), 0.4, 0.22, { mat: M.metal.clone() });
{
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 32),
    new THREE.MeshStandardMaterial({ color: 0xff9a4a, emissive: 0x3a1300, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.9 }));
  lamp.rotation.x = Math.PI / 2;
  lamp.position.set(-2.3, 6.15, ZF + 0.03);
  cam.add(lamp);
  register('afLamp', lamp, 'front');
}
// Микрофоны на передней стороне «горба»
{
  const micTex = canvasTex(128, 64, (g) => {
    g.fillStyle = '#060606';
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) { g.beginPath(); g.arc(14 + c * 20, 14 + r * 18, 5, 0, 7); g.fill(); }
  });
  for (const x of [LENS_X - 1.55, LENS_X + 1.55]) {
    const d = decal(micTex, 0.8, 0.4, V(x, 7.55, HUMP_FRONT + 0.004), FACE.front.n, FACE.front.up);
    cam.add(d);
    register('mic', d, 'front');
    proxy('mic', 'front', V(x, 7.55, HUMP_FRONT), 0.3);
  }
}

// ───────────────────────── ОБЪЕКТИВ (кит 28-70) ─────────────────────────
const lens = new THREE.Group();
lens.position.set(LENS_X, LENS_Y, ZF + 0.3);
cam.add(lens);
function lensCyl(r0, r1, z0, len, mat, segs = 72) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, segs), mat);
  m.rotation.x = Math.PI / 2;
  m.position.z = z0 + len / 2;
  lens.add(m);
  return m;
}
{
  lensCyl(2.9, 2.9, 0, 0.35, M.metal);
  lensCyl(3.05, 3.1, 0.35, 1.5, M.body);
  const ribs = new THREE.MeshStandardMaterial({ map: knurlTex(160, '#2a2b2f', '#121214'), roughness: 0.9 });
  const zoom = lensCyl(3.28, 3.28, 1.85, 2.5, [ribs, M.rubber, M.rubber]);
  register('zoomRing', zoom, 'front');
  lensCyl(3.05, 3.0, 4.35, 1.3, M.body);
  const focus = lensCyl(3.12, 3.12, 5.65, 1.0, [new THREE.MeshStandardMaterial({ map: knurlTex(200, '#26272b', '#111113'), roughness: 0.85 }), M.rubber, M.rubber]);
  register('focusRing', focus, 'front');
  lensCyl(3.0, 2.95, 6.65, 0.45, M.body);
  const ringTex = canvasTex(1024, 1024, (g, w) => {
    const c = w / 2;
    g.fillStyle = '#0d0d0f'; g.beginPath(); g.arc(c, c, c, 0, 7); g.fill();
    g.fillStyle = '#000'; g.beginPath(); g.arc(c, c, c * 0.82, 0, 7); g.fill();
    g.fillStyle = '#d9d9d9'; g.font = `600 44px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const txt = 'SONY   FE 3.5-5.6 / 28-70   OSS   Ø55   ';
    const chars = [...txt]; const step = (Math.PI * 2) / chars.length;
    chars.forEach((ch, i) => { const a = -Math.PI / 2 + i * step; g.save(); g.translate(c + Math.cos(a) * c * 0.91, c + Math.sin(a) * c * 0.91); g.rotate(a + Math.PI / 2); g.fillText(ch, 0, 0); g.restore(); });
  });
  const front = new THREE.Mesh(new THREE.CircleGeometry(2.95, 72), new THREE.MeshStandardMaterial({ map: ringTex, roughness: 0.7 }));
  front.position.z = 7.1;
  lens.add(front);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(4.2, 64, 16, 0, Math.PI * 2, 0, 0.58),
    new THREE.MeshStandardMaterial({ color: 0x0b1424, roughness: 0.02, metalness: 0.9, envMapIntensity: 1.6 }));
  glass.rotation.x = Math.PI / 2;
  glass.position.z = 7.1 - 4.2 * Math.cos(0.58) + 0.02;
  lens.add(glass);
}

// ───────────────────────── БОКА ─────────────────────────
// Сторона разъёмов (+x)
{
  const n = FACE.left.n, up = FACE.left.up;
  const X = XL;
  // ниши под открытыми заглушками
  for (const [y, h] of [[6.0, 1.15], [4.7, 1.0], [3.0, 1.75]]) {
    const m = box(0.04, h, 2.3, M.dark, V(X + 0.005, y, 0), 0.015);
    m.material = M.dark;
  }
  function jack(id, y, z, label) {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 32), M.metal);
    ring.position.y = 0.04;
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.09, 24), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    hole.position.y = 0.05;
    g.add(ring, hole);
    alignY(g, n); g.position.set(X, y, z); cam.add(g);
    register(id, g, 'left');
    if (label) cam.add(register(id, decal(label, 0.42, 0.24, V(X + 0.03, y - 0.42, z), n, up), 'left'));
  }
  const phonesIcon = canvasTex(128, 64, (g) => {
    g.strokeStyle = '#ddd'; g.lineWidth = 6; g.beginPath(); g.arc(64, 40, 20, Math.PI, 0); g.stroke();
    g.fillStyle = '#ddd'; g.fillRect(38, 38, 9, 18); g.fillRect(81, 38, 9, 18);
  });
  jack('micJack', 6.1, 0.55, textTex('MIC', { w: 128, h: 64, fill: 0.9 }));
  jack('phonesJack', 6.1, -0.55, phonesIcon);

  function port(id, y, z, h, w, radius, label) {
    const m = box(0.1, h, w, M.dark, V(X + 0.03, y, z), radius);
    const inner = box(0.04, h * 0.45, w * 0.7, M.metal, V(X + 0.075, y, z), Math.min(radius, h * 0.2));
    register(id, m, 'left'); register(id, inner, 'left');
    if (label) cam.add(register(id, decal(textTex(label, { w: 256, h: 64, fill: 0.95 }), 0.9, 0.22, V(X + 0.03, y - h / 2 - 0.2, z), n, up), 'left'));
  }
  port('hdmi', 4.75, 0, 0.42, 1.3, 0.08, 'HDMI');
  port('usbc', 3.55, 0.55, 0.28, 0.8, 0.12, 'USB-C');
  port('multiUsb', 3.55, -0.6, 0.28, 0.7, 0.05, 'MULTI');
  const lamp = box(0.06, 0.18, 0.18, new THREE.MeshStandardMaterial({ color: 0xffa23a, emissive: 0x4a2400, roughness: 0.3 }), V(X + 0.02, 2.55, 0.55), 0.04);
  register('chargeLamp', lamp, 'left');
  proxy('chargeLamp', 'left', V(X + 0.05, 2.55, 0.55), 0.25);
  cam.add(register('chargeLamp', decal(textTex('CHG', { w: 128, h: 64, fill: 0.9, color: '#bbb' }), 0.36, 0.18, V(X + 0.03, 2.55, -0.05), n, up), 'left'));
  // динамик
  const spk = canvasTex(256, 128, (g) => { g.fillStyle = '#050505'; for (let r = 0; r < 4; r++) for (let c = 0; c < 10; c++) { g.beginPath(); g.arc(18 + c * 24, 20 + r * 28, 6, 0, 7); g.fill(); } });
  const sp = decal(spk, 1.4, 0.7, V(X + 0.004, 1.15, 0), n, up);
  cam.add(sp);
  register('speaker', sp, 'left');
  proxy('speaker', 'left', V(X, 1.15, 0), 0.45);
}
// Ушки для ремня (с обеих сторон)
for (const [x, z, s] of [[XL + 0.05, 0.6, 1], [XG - 0.05, 0.1, -1]]) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.6, 0.9, 2, 0.08), M.body);
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.07, 12, 32), M.metal);
  loop.rotation.y = Math.PI / 2;
  loop.position.set(0.2 * s, 0.22, 0);
  g.add(base, loop);
  g.position.set(x, 6.45, z);
  cam.add(g);
  register('strapHook', g, s > 0 ? 'left' : 'right');
}
// Сторона рукоятки (−x): крышка слотов карт
{
  const cover = box(0.1, 3.8, 3.7, M.body, V(XG - 0.04, 3.8, 1.0), 0.08);
  const sw = box(0.12, 0.5, 0.22, M.button, V(XG - 0.1, 5.25, 2.45), 0.05);
  register('cardCover', cover, 'right'); register('cardCover', sw, 'right');
  const tex = canvasTex(512, 160, (g, w, h) => {
    g.fillStyle = '#cfcfd3'; g.font = `600 40px ${FONT}`; g.textBaseline = 'middle';
    g.fillText('1  CFexpress A / SD', 10, h * 0.3); g.fillText('2  SD', 10, h * 0.72);
  });
  cam.add(register('cardCover', decal(tex, 2.4, 0.75, V(XG - 0.095, 2.6, 1.0), FACE.right.n, FACE.right.up), 'right'));
}

// ───────────────────────── НИЗ ─────────────────────────
{
  const b = FACE.bottom;
  const tri = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 40), M.metal);
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 32), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  hole.position.y = 0.005;
  tri.add(ring, hole);
  alignY(tri, b.n);
  tri.position.set(LENS_X, -0.02, 0);
  cam.add(tri);
  register('tripod', tri, 'bottom');

  const cover = box(2.4, 0.08, 4.2, M.body, V(-4.75, -0.035, 1.15), 0.06);
  register('batteryCover', cover, 'bottom');
  const tex = canvasTex(256, 64, (g) => { g.fillStyle = '#cfcfd3'; g.font = `600 30px ${FONT}`; g.textBaseline = 'middle'; g.fillText('NP-FZ100  ⇦ OPEN', 6, 32); });
  cam.add(register('batteryCover', decal(tex, 1.8, 0.45, V(-4.75, -0.08, 0.2), b.n, V(1, 0, 0)), 'bottom'));
  const lever = box(0.5, 0.12, 0.28, M.button, V(-3.25, -0.06, -0.95), 0.04);
  register('lockLever', lever, 'bottom');
}

// Тень под камерой
{
  const tex = canvasTex(256, 256, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  });
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(22, 16), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2;
  sh.position.set(0.5, 0, 2.5);
  sh.position.y = -4.33;
  scene.add(sh);
}

// Центрируем модель
cam.position.set(-0.5, -4.3, -2.2);
cam.updateMatrixWorld(true);

// Якоря частей: центр bounding box
for (const rec of partObjects.values()) {
  const bb = new THREE.Box3();
  for (const m of rec.meshes) bb.expandByObject(m);
  if (bb.isEmpty()) continue;
  bb.getCenter(rec.anchor);
  rec.local = cam.worldToLocal(rec.anchor.clone());
}

// ───────────────────────── Состояние / UI ─────────────────────────
const byId = new Map(PARTS.map((p) => [p.id, p]));
let lang = 'ru';
let hoverId = null, pinnedId = null;
let lensOn = true, screenOpen = false;

const I18N = {
  ru: {
    eyebrow: 'Интерактивная 3D-модель', hint: 'Наведите на кнопку — она подсветится и появится описание. Вращайте модель мышью, колесо — масштаб.',
    vFront: 'Спереди', vTop: 'Сверху', vRear: 'Сзади', vLeft: 'Разъёмы', vRight: 'Слоты', vBottom: 'Снизу',
    tLens: 'Объектив', tScreen: 'Открыть экран', tSpin: 'Вращение', controls: 'Органы управления', search: 'Поиск: Fn, ISO, видео…',
    source: 'Источник:', disclaimer: '3D-модель упрощённая; расположение и назначение органов управления — по официальной инструкции.',
    shoot: 'Съёмка', view: 'Просмотр', loading: 'Загрузка модели…',
  },
  en: {
    eyebrow: 'Interactive 3D model', hint: 'Hover a control to highlight it and see what it does. Drag to rotate, scroll to zoom.',
    vFront: 'Front', vTop: 'Top', vRear: 'Rear', vLeft: 'Ports', vRight: 'Card slots', vBottom: 'Bottom',
    tLens: 'Lens', tScreen: 'Open screen', tSpin: 'Auto-rotate', controls: 'Controls', search: 'Search: Fn, ISO, movie…',
    source: 'Source:', disclaimer: 'Simplified 3D model; control layout and functions follow the official Help Guide.',
    shoot: 'Shooting', view: 'Viewing', loading: 'Loading…',
  },
};

const listEl = document.getElementById('list');
const tip = document.getElementById('tip');
const dot = document.createElement('div');
dot.className = 'anchor-dot';
Object.assign(dot.style, {
  position: 'absolute', width: '12px', height: '12px', borderRadius: '50%', background: '#ff8a2a',
  boxShadow: '0 0 0 5px rgba(255,138,42,.25)', transform: 'translate(-50%,-50%)', pointerEvents: 'none', display: 'none', zIndex: 4,
});
stage.appendChild(dot);

function buildList() {
  listEl.innerHTML = '';
  for (const grp of GROUPS) {
    const h = document.createElement('div');
    h.className = 'grp'; h.textContent = grp[lang]; h.dataset.group = grp.id;
    listEl.appendChild(h);
    for (const p of PARTS.filter((x) => x.group === grp.id)) {
      const b = document.createElement('button');
      b.className = 'item'; b.dataset.id = p.id;
      const other = lang === 'ru' ? 'en' : 'ru';
      b.innerHTML = `<span class="badge ${p.label ? '' : 'dot'}">${p.label || ''}</span>
        <span><div class="item-name">${p[lang]}</div><div class="item-alt">${p[other]}</div></span>`;
      b.addEventListener('mouseenter', () => setHover(p.id, 'list'));
      b.addEventListener('mouseleave', () => setHover(null, 'list'));
      b.addEventListener('click', () => { pinnedId = p.id; focusPart(p.id); refresh(); });
      listEl.appendChild(b);
    }
  }
  applySearch();
}

function applyLang() {
  document.documentElement.lang = lang;
  const t = I18N[lang];
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const k = el.dataset.i18n;
    if (k === 'tScreen') el.textContent = screenOpen ? (lang === 'ru' ? 'Закрыть экран' : 'Close screen') : t.tScreen;
    else el.textContent = t[k];
  });
  document.getElementById('search').placeholder = t.search;
  document.querySelectorAll('.lang-b').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  buildList();
  refresh();
}

function applySearch() {
  const q = document.getElementById('search').value.trim().toLowerCase();
  listEl.querySelectorAll('.item').forEach((el) => {
    const p = byId.get(el.dataset.id);
    const hay = [p.ru, p.en, p.label, p.dru, p.den, p.shoot?.ru, p.shoot?.en, p.view?.ru, p.view?.en].join(' ').toLowerCase();
    el.classList.toggle('hidden', q && !hay.includes(q));
  });
  listEl.querySelectorAll('.grp').forEach((g) => {
    const any = [...listEl.querySelectorAll('.item:not(.hidden)')].some((el) => byId.get(el.dataset.id).group === g.dataset.group);
    g.style.display = any ? '' : 'none';
  });
}

function setHover(id, src) {
  hoverId = id;
  if (src === 'list' && id) ensureVisibleFor(id);
  refresh();
}

function activeId() { return hoverId || pinnedId; }

function refresh() {
  const id = activeId();
  listEl.querySelectorAll('.item').forEach((el) => el.classList.toggle('on', el.dataset.id === id));
  if (!id) { tip.hidden = true; dot.style.display = 'none'; return; }
  const p = byId.get(id);
  const other = lang === 'ru' ? 'en' : 'ru';
  const t = I18N[lang];
  document.getElementById('tipBadge').textContent = p.label || '';
  document.getElementById('tipName').textContent = p[lang];
  document.getElementById('tipAlt').textContent = p[other];
  document.getElementById('tipGroup').textContent = GROUPS.find((g) => g.id === p.group)[lang];
  const body = document.getElementById('tipBody');
  body.innerHTML = '';
  if (p.shoot) {
    for (const [cls, k, v] of [['m-shoot', t.shoot, p.shoot], ['m-view', t.view, p.view]]) {
      const row = document.createElement('div');
      row.className = `mode ${cls}`;
      row.innerHTML = `<b></b><span></span>`;
      row.querySelector('b').textContent = k;
      row.querySelector('span').textContent = v[lang];
      body.appendChild(row);
    }
  } else {
    body.textContent = lang === 'ru' ? p.dru : p.den;
  }
  tip.hidden = false;
  placeTip();
}

// Позиция подсказки: рядом с проекцией якоря на экран
const tmpV = new THREE.Vector3();
function placeTip() {
  const id = activeId();
  if (!id || tip.hidden) return;
  const rec = partObjects.get(id);
  if (!rec) return;
  tmpV.copy(rec.local).applyMatrix4(cam.matrixWorld);
  if (id === 'monitor') tmpV.copy(rec.meshes[0].getWorldPosition(new THREE.Vector3()));
  tmpV.project(camera);
  const r = stage.getBoundingClientRect();
  if (tmpV.z > 1) { tip.style.opacity = 0; dot.style.display = 'none'; return; }
  const x = (tmpV.x * 0.5 + 0.5) * r.width;
  const y = (-tmpV.y * 0.5 + 0.5) * r.height;
  dot.style.display = 'block';
  dot.style.left = `${x}px`; dot.style.top = `${y}px`;
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  let tx = x + 26, ty = y - 24;
  if (tx + tw > r.width - 12) tx = x - 26 - tw;
  if (tx < 12) tx = Math.max(12, Math.min(r.width - tw - 12, x - tw / 2));
  ty = Math.max(12, Math.min(r.height - th - 70, ty));
  tip.style.opacity = 1;
  tip.style.transform = `translate(${Math.round(tx)}px, ${Math.round(ty)}px)`;
}

// Подсветка
function highlight(time) {
  const id = activeId();
  const k = 0.55 + 0.35 * Math.sin(time * 0.006);
  for (const [pid, rec] of partObjects) {
    for (const m of rec.meshes) {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (mat.emissive) {
          if (!mat.userData.base) mat.userData.base = { e: mat.emissive.clone(), i: mat.emissiveIntensity };
          if (pid === id) { mat.emissive.copy(ACCENT); mat.emissiveIntensity = k; }
          else { mat.emissive.copy(mat.userData.base.e); mat.emissiveIntensity = mat.userData.base.i; }
        } else if (mat.isMeshBasicMaterial && mat.map) {
          mat.color.set(pid === id ? 0xffb070 : 0xffffff);
        }
      }
    }
  }
}

// Видимость объектива: детали байонета скрыты им
function ensureVisibleFor(id) {
  const p = byId.get(id);
  if (['sensor', 'mount', 'contacts', 'mountIndex'].includes(id) && lensOn) setLens(false);
  if (p.group === 'lens' && !lensOn) setLens(true);
}
function setLens(on) {
  lensOn = on;
  lens.visible = on;
  document.getElementById('tLens').setAttribute('aria-pressed', String(on));
}

// ───────────────────────── Камера: виды и перелёты ─────────────────────────
const VIEWS = {
  front:  V(0.15, 0.35, 1),
  top:    V(0.0, 1, -0.45),
  rear:   V(-0.15, 0.3, -1),
  left:   V(1, 0.3, 0.15),
  right:  V(-1, 0.3, 0.2),
  bottom: V(0.45, -1, 0.75),
  home:   V(-0.55, 0.62, -0.95),
};
const CENTER = V(0, 0.4, 0.3);
let fly = null;
function flyTo(target, dir, dist) {
  fly = {
    start: performance.now(),
    p0: camera.position.clone(), t0: controls.target.clone(),
    p1: target.clone().addScaledVector(dir.clone().normalize(), dist), t1: target.clone(),
  };
}
function focusPart(id) {
  ensureVisibleFor(id);
  const rec = partObjects.get(id);
  const face = rec.face;
  const target = rec.local.clone().applyMatrix4(cam.matrixWorld).lerp(CENTER, 0.35);
  flyTo(target, VIEWS[face] || VIEWS.home, face === 'front' && lensOn ? 26 : 19);
}

document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
  const v = b.dataset.view;
  flyTo(CENTER, VIEWS[v], v === 'front' && lensOn ? 30 : 26);
}));
document.getElementById('tLens').addEventListener('click', () => setLens(!lensOn));
document.getElementById('tSpin').addEventListener('click', (e) => {
  controls.autoRotate = !controls.autoRotate;
  e.currentTarget.setAttribute('aria-pressed', String(controls.autoRotate));
});
let screenAngle = 0;
document.getElementById('tScreen').addEventListener('click', (e) => {
  screenOpen = !screenOpen;
  e.currentTarget.setAttribute('aria-pressed', String(screenOpen));
  applyLang();
});
document.querySelectorAll('.lang-b').forEach((b) => b.addEventListener('click', () => { lang = b.dataset.lang; applyLang(); }));
document.getElementById('search').addEventListener('input', applySearch);

// ───────────────────────── Указатель ─────────────────────────
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function visibleChain(o) { for (; o; o = o.parent) if (!o.visible) return false; return true; }
function pick(ev) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  for (const h of ray.intersectObject(cam, true)) {
    if (!visibleChain(h.object)) continue;
    return h.object.userData.partId || null;   // первое видимое попадание: деталь или корпус
  }
  return null;
}
let downAt = null;
canvas.addEventListener('pointermove', (ev) => {
  if (ev.pointerType !== 'mouse') return;
  const id = pick(ev);
  if (id !== hoverId) { hoverId = id; refresh(); }
  canvas.style.cursor = id ? 'pointer' : 'grab';
});
canvas.addEventListener('pointerleave', () => { if (hoverId) { hoverId = null; refresh(); } });
canvas.addEventListener('pointerdown', (ev) => { downAt = [ev.clientX, ev.clientY]; controls.autoRotate = false; document.getElementById('tSpin').setAttribute('aria-pressed', 'false'); });
canvas.addEventListener('pointerup', (ev) => {
  if (!downAt || Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]) > 5) return;
  const id = pick(ev);
  pinnedId = id;
  if (ev.pointerType !== 'mouse') hoverId = null;
  refresh();
  if (id) listEl.querySelector(`.item[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});

// ───────────────────────── Цикл ─────────────────────────
function resize() {
  const r = stage.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height;
  camera.fov = camera.aspect < 0.9 ? 48 : 32;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();

controls.target.copy(CENTER);
camera.position.copy(CENTER).addScaledVector(VIEWS.home.clone().normalize(), camera.aspect < 0.9 ? 40 : 33);

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (fly) {
    const t = Math.min(1, (now - fly.start) / 900);
    const k = ease(t);
    camera.position.lerpVectors(fly.p0, fly.p1, k);
    controls.target.lerpVectors(fly.t0, fly.t1, k);
    if (t >= 1) fly = null;
  }
  const want = screenOpen ? -Math.PI : 0;
  screenAngle += (want - screenAngle) * Math.min(1, dt * 5);
  monitorPivot.rotation.y = screenAngle;
  controls.update();
  highlight(now);
  renderer.render(scene, camera);
  placeTip();
  requestAnimationFrame(loop);
}

applyLang();
requestAnimationFrame(loop);
document.getElementById('loading').classList.add('done');

// Для отладки/тестов
window.__a7 = { partObjects, PARTS, camera, controls, focusPart, setHover, refresh };
