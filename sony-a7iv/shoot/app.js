import * as THREE from 'three';
import * as O from './optics.js?v=2';
import { LENSES, lensById } from './lenses.js?v=2';
import { Pipeline, METER_W, METER_H } from './pipeline.js?v=2';
import { CameraMenu } from './menu.js?v=2';
import { MISSIONS, missionById } from './tasks.js?v=2';
import { Tour } from './tour.js?v=1';
import * as Park from './scenes/park.js?v=2';
import * as Night from './scenes/night.js?v=2';
import * as Stadium from './scenes/stadium.js?v=2';

const SCENES = { park: Park, night: Night, stadium: Stadium };
const SCENE_LIST = [['park', 'Парк', 'закат'], ['night', 'Улица', 'ночь'], ['stadium', 'Стадион', 'полдень']];

const $ = (id) => document.getElementById(id);
const V3 = THREE.Vector3;
const mobile = matchMedia('(max-width: 860px), (pointer: coarse)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const log2 = Math.log2;

// Калибровка экспонометра: средний log2-яркости HDR-кадра парка при виде по умолчанию соответствует EV 12
const LREF_LOG = -4.37;
// Экспозиция по замеру переводит средний log-уровень кадра в 0,12 линейной яркости —
// после тональной кривой это стандартный средне-серый (~45 % в sRGB)
const GAIN0 = 0.12 / 2 ** LREF_LOG;

// ───────────────────────── Состояние ─────────────────────────
const DEFAULTS = {
  mode: 'A', N: 2.8, t: 1 / 250, iso: 'AUTO', ec: 0, autoMinSS: 'std',
  fm: 'AF-S', area: 'point', eyeAF: true, mfDist: 3,
  meter: 'multi', spotLink: 'center',
  wb: 'AWB', wbK: 5500, dro: false, look: 'ST', zebra: 0, peak: 'off',
  drive: 'single', steady: true, tripod: false, pan: false,
  fileFormat: 'JPEG', jpegSize: 'L',
};
const S = {
  ...DEFAULTS, sceneId: 'park', lensId: '85', f: 85, dist: 3, yaw: 0, pitch: 0, focusUV: [0.5, 0.33],
  grid: 'thirds', disp: 'all', beep: true,
};
let SC = null;                       // текущая сцена
let R = null;                        // решённая экспозиция
let meterEV = 12, lockedEV = null;   // замер (сглаженный) и зафиксированный AEL
let meterReady = false;              // сетка замера уже прочитана с текущей сцены
let focusTarget = 3, focusCur = 3, focusOk = true, focusLocked = false, focusKind = 'point';
let trackRoot = null, trackLocal = null;
let activeMission = null;
const shots = [];
let done = new Set();
try { done = new Set(JSON.parse(localStorage.getItem('a7sim-done') || '[]')); } catch (e) { /* хранилище недоступно */ }

const lens = () => lensById(S.lensId);
const lensSpec = () => ({ f: S.f, maxN: lens().maxN(S.f), minN: lens().minN });
const apertureList = () => O.APERTURES.filter((n) => n >= lens().maxN(S.f) - 1e-6 && n <= lens().minN + 1e-6);
const stabStops = (st = S) => (st.tripod ? Infinity : st.steady ? 5.5 : 0);
const WB_K = { day: 5500, shade: 7500, cloudy: 6500, tungsten: 3200, fluor: 4000 };
const wbKelvin = (st = S) => Math.round(st.wb === 'AWB' ? O.awbKelvin(SC.lightK) : st.wb === 'K' ? st.wbK : WB_K[st.wb]);
const PEAK = { red: [1, 0.12, 0.1], yellow: [1, 0.9, 0.1], white: [1, 1, 1] };
const evSource = () => (lockedEV ?? meterEV);
const gainFor = (res) => GAIN0 * 2 ** (12 + O.isoShift(res.iso) - O.settingsEV(res.N, res.t));

// ───────────────────────── Рендер ─────────────────────────
const canvas = $('cv');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x000000, 1);
const pipe = new Pipeline(renderer, { mobile });
const camera = new THREE.PerspectiveCamera(O.fovV(S.f), 1.5, 0.1, 2000);
const ray = new THREE.Raycaster();

let resScale = 1;
function resize() {
  const r = $('vf').getBoundingClientRect();
  const pr = Math.min(devicePixelRatio, mobile ? 1.5 : 1.25) * resScale;
  const w = Math.round(Math.min(r.width * pr, mobile ? 1100 : 1700));
  renderer.setSize(w, Math.round(w / 1.5), false);
  pipe.setSize(w, Math.round(w / 1.5));
}
new ResizeObserver(resize).observe($('vf'));

function disposeScene(sc) {
  sc.scene.traverse((o) => {
    o.geometry?.dispose();
    for (const m of [].concat(o.material || [])) { for (const v of Object.values(m)) if (v?.isTexture) v.dispose(); m.dispose(); }
  });
}

function loadScene(id, { keep = true } = {}) {
  if (SC) disposeScene(SC);
  SC = SCENES[id].build({ mobile });
  SC.scene.updateMatrixWorld(true);       // координаты нужны лучам автофокуса ещё до первого кадра
  S.sceneId = id;
  const d = SC.defaults;
  if (!keep || !SC.dists.includes(S.dist)) S.dist = d.dist;
  S.lensId = d.lensId; S.f = d.f;
  S.yaw = 0; S.pitch = 0;
  meterEV = SC.nominalEV; lockedEV = null; meterReady = false;
  trackRoot = null;
  if (!SC.movers.length) S.pan = false;
  placeCamera();
  const eye = projectUV(SC.subject.eyes()[0]);
  S.focusUV = inFrameUV(eye) ? [eye.x, eye.y] : [0.5, 0.5];
  focusCur = focusTarget = Math.max(lens().minFocus(S.f), SC.subject.face().distanceTo(camera.position));
  renderScenes();
  $('sceneName').textContent = `Сцена: ${SC.name.toLowerCase()}. ${SC.about}`;
  buildPosition();
  acquireFocus(true);
}

// Камера фотографа: на линии rig.back от цели, на высоте глаз
function placeCamera(extraYaw = 0, extraPitch = 0) {
  camera.fov = O.fovV(S.f);
  camera.aspect = 1.5;
  camera.updateProjectionMatrix();
  const rig = SC.rig;
  camera.position.set(rig.target.x + rig.back.x * S.dist, rig.height, rig.target.z + rig.back.z * S.dist);
  const halfH = S.dist * Math.tan(THREE.MathUtils.degToRad(O.fovV(S.f) / 2));
  const aim = new V3(rig.target.x, rig.thirds ? Math.max(0.7, rig.target.y - halfH / 3) : rig.target.y, rig.target.z);
  const dir = aim.sub(camera.position).normalize();
  const yaw0 = Math.atan2(-dir.x, -dir.z), pitch0 = Math.asin(dir.y);
  camera.rotation.set(pitch0 + S.pitch + extraPitch, yaw0 + S.yaw + extraYaw, 0, 'YXZ');
  camera.updateMatrixWorld();
  return yaw0;
}
const projectUV = (p, cam = camera) => { const v = p.clone().project(cam); return { x: v.x * 0.5 + 0.5, y: -v.y * 0.5 + 0.5, z: v.z }; };
const inFrameUV = (u, m = 0.03) => u.z < 1 && u.x > m && u.x < 1 - m && u.y > m && u.y < 1 - m;
const fwdOf = (cam = camera) => cam.getWorldDirection(new V3());
const depthOf = (p, cam = camera) => p.clone().sub(cam.position).dot(fwdOf(cam));

// Проводка: камера поворачивается вслед за движущимся объектом
function panMover() {
  if (!SC.movers.length) return null;
  return SC.movers.find((m) => m.root === trackRoot) || SC.movers[0];
}
function followYaw(m) {
  const yaw0 = placeCamera();
  const a = m.anchor().sub(camera.position);
  return clamp(Math.atan2(-a.x, -a.z) - yaw0, -1.3, 1.3);
}

// ───────────────────────── Автофокус ─────────────────────────
function rootOf(obj) {
  const roots = [SC.subject.root, ...SC.movers.map((m) => m.root)];
  for (let o = obj; o; o = o.parent) if (roots.includes(o)) return o;
  return null;
}
function hitAt(uv) {
  ray.setFromCamera(new THREE.Vector2(uv[0] * 2 - 1, -(uv[1] * 2 - 1)), camera);
  return ray.intersectObjects(SC.solids, true)[0] || null;
}
// глаз модели, если он виден в кадре и не закрыт другими предметами
function visibleEye() {
  const eyes = SC.subject.eyes().sort((a, b) => a.distanceTo(camera.position) - b.distanceTo(camera.position));
  for (const e of eyes) {
    const u = projectUV(e);
    if (!inFrameUV(u, 0.02)) continue;
    const h = hitAt([u.x, u.y]);
    if (h && h.distance < e.distanceTo(camera.position) - 0.12) continue;
    return { uv: [u.x, u.y], dist: depthOf(e) };
  }
  return null;
}
function acquireFocus(instant = false, quiet = false) {
  placeCamera();
  if (S.fm === 'MF') { focusTarget = S.mfDist; focusKind = 'mf'; focusOk = true; if (instant) focusCur = focusTarget; if (!quiet) update(); return; }
  let uv = S.focusUV, dist = null, kind = S.area;
  if (S.area === 'track' && trackRoot) {
    const m = SC.movers.find((x) => x.root === trackRoot);
    const p = m ? m.anchor() : SC.subject.face();
    const u = projectUV(p);
    if (inFrameUV(u, 0.01)) { uv = [u.x, u.y]; S.focusUV = uv; dist = depthOf(p); }
  }
  if (S.eyeAF && (S.area === 'wide' || (S.area === 'track' && trackRoot === SC.subject.root) || S.area === 'point')) {
    const e = visibleEye();
    if (e && (S.area !== 'point' || Math.hypot((e.uv[0] - uv[0]) * 1.5, e.uv[1] - uv[1]) < 0.16)) { uv = e.uv; dist = e.dist; kind = 'eye'; }
  }
  if (dist == null && S.area === 'wide') {
    let best = null;       // широкая зона: ближайший предмет в центральной части кадра
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) {
      const u = [0.25 + i * 0.125, 0.3 + j * 0.2], h = hitAt(u);
      if (h && (!best || h.distance < best.h.distance)) best = { h, u };
    }
    if (best) { uv = best.u; dist = depthOf(best.h.point); }
  }
  if (dist == null) { const h = hitAt(uv); dist = h ? depthOf(h.point) : 1000; }
  const mfd = lens().minFocus(S.f);
  focusOk = dist >= mfd;
  focusTarget = Math.max(dist, mfd);
  focusKind = kind;
  if (S.area !== 'point' || kind === 'eye') S.focusUV = uv;
  if (instant) focusCur = focusTarget;
  if (!quiet) { focusLocked = false; update(); }
}

// ───────────────────────── Экспозамер ─────────────────────────
const METER_NAMES = { multi: 'Мульти', center: 'Центр', spot: 'Точечный', average: 'Средний', highlight: 'Света' };
const spotCenter = () => (S.spotLink === 'focus' ? S.focusUV : [0.5, 0.5]);
function measure(grid) {
  const W = METER_W, H = METER_H;
  if (S.meter === 'highlight') {
    const v = Array.from(grid).sort((a, b) => a - b);
    return 12 + v[Math.floor(v.length * 0.985)] - LREF_LOG - 2.6;
  }
  const [sx, sy] = spotCenter();
  const weight = (cx, cy) => {
    const dx = (cx - 0.5) * 1.5, dy = cy - 0.5, r2 = dx * dx + dy * dy;
    if (S.meter === 'average') return 1;
    if (S.meter === 'center') return Math.exp(-r2 / (2 * 0.18 * 0.18)) + 0.03;
    if (S.meter === 'spot') return Math.hypot((cx - sx) * 1.5, cy - sy) < 0.06 ? 1 : 0;
    return 1 + 2 * Math.exp(-r2 / (2 * 0.3 * 0.3));
  };
  let sw = 0, s = 0;
  const vals = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const w = weight((x + 0.5) / W, (y + 0.5) / H);
    if (w > 0) { vals.push([grid[y * W + x], w]); sw += w; s += w * grid[y * W + x]; }
  }
  if (!sw) return meterEV;
  let mean = s / sw;
  if (S.meter === 'multi') {           // оценочный: яркие пятна (солнце, лампы) ограничиваются
    s = 0; for (const [v, w] of vals) s += w * Math.min(v, mean + 2);
    mean = s / sw;
  }
  return 12 + mean - LREF_LOG;
}
// Насколько лицо на снимке светлее (+) или темнее (−) нормальной кожи (≈ 52 % яркости в sRGB), в ступенях
const SKIN = 0.52;
const toDisp = (L) => { const s = acesJS(L); return s <= 0.0031308 ? s * 12.92 : 1.055 * s ** (1 / 2.4) - 0.055; };
function faceOffsetLive() {
  if (!meterReady) return null;
  const u = projectUV(SC.subject.face());
  if (!inFrameUV(u)) return null;
  const x = Math.floor(u.x * METER_W), y = Math.floor(u.y * METER_H);
  let v = 0;                                  // три соседние ячейки по горизонтали
  for (const dx of [-1, 0, 1]) v += pipe.meterLog[y * METER_W + clamp(x + dx, 0, METER_W - 1)] / 3;
  const gain = gainFor(R);
  let lo = -10, hi = 10;
  for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (toDisp(2 ** (v + m) * gain) < SKIN) lo = m; else hi = m; }
  return -(lo + hi) / 2;
}

// ───────────────────────── Элементы управления ─────────────────────────
function control(el, cfg) {
  el.innerHTML = `
    <div class="ctl-head"><span class="ctl-name">${cfg.name}</span><span class="ctl-tag"></span></div>
    <div class="ctl-row"><button class="step" data-d="-1" aria-label="меньше">−</button><div class="ctl-val"></div>
      <button class="step" data-d="1" aria-label="больше">+</button><input type="range" min="0" step="1" aria-label="${cfg.name}"></div>
    ${cfg.hint ? `<div class="ctl-hint">${cfg.hint}</div>` : ''}`;
  const range = el.querySelector('input'), val = el.querySelector('.ctl-val'), tag = el.querySelector('.ctl-tag');
  const steps = el.querySelectorAll('.step');
  const api = {
    refresh() {
      const list = cfg.values(), i = cfg.index(), on = cfg.active();
      range.max = list.length - 1; range.value = i; range.disabled = !on;
      steps.forEach((b) => { b.disabled = !on; });
      val.textContent = cfg.format(list[i], i);
      val.classList.toggle('warn', !!cfg.warn?.());
      const tg = cfg.tag?.() || '';
      tag.textContent = tg;
      tag.classList.toggle('auto', !on && !!tg);
      el.classList.toggle('disabled', !on);
    },
  };
  const set = (i) => { const list = cfg.values(); i = clamp(i, 0, list.length - 1); cfg.set(list[i]); onChange(cfg.refocus); };
  range.addEventListener('input', () => set(+range.value));
  steps.forEach((b) => b.addEventListener('click', () => set(cfg.index() + +b.dataset.d)));
  return api;
}
const ISO_LIST = ['AUTO', ...O.ISOS];
const MF_LIST = [0.28, 0.3, 0.35, 0.4, 0.45, 0.5, 0.6, 0.7, 0.8, 1, 1.2, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 8, 10, 12, 15, 20, 30, 50, 100, 1000];
const idx = (list, v) => { let bi = 0, bd = Infinity; list.forEach((x, i) => { const d = typeof x === 'number' && typeof v === 'number' ? Math.abs(Math.log(x) - Math.log(v)) : (x === v ? 0 : Infinity); if (d < bd) { bd = d; bi = i; } }); return bi; };
const mfList = () => MF_LIST.filter((d) => d >= lens().minFocus(S.f) - 1e-6);

const C = {
  N: control($('cN'), {
    name: 'Диафрагма', hint: 'Меньше число F — шире отверстие: больше света и сильнее размыт фон.',
    values: apertureList, index: () => idx(apertureList(), S.mode === 'A' || S.mode === 'M' ? S.N : R.N),
    active: () => S.mode === 'A' || S.mode === 'M', set: (v) => { S.N = v; }, format: (v) => O.fmtF(v),
    tag: () => (S.mode === 'A' || S.mode === 'M' ? 'передний диск' : 'подбирает камера'), warn: () => R.warnN,
  }),
  T: control($('cT'), {
    name: 'Выдержка', hint: 'Короче — меньше света, движение замирает. Длиннее — светлее, но возможен смаз.',
    values: () => O.SHUTTERS, index: () => idx(O.SHUTTERS, S.mode === 'S' || S.mode === 'M' ? S.t : R.t),
    active: () => S.mode === 'S' || S.mode === 'M', set: (v) => { S.t = v; }, format: (v) => O.fmtShutter(v),
    tag: () => (S.mode === 'S' || S.mode === 'M' ? 'задний диск' : 'подбирает камера'), warn: () => R.warnT,
  }),
  Iso: control($('cIso'), {
    name: 'ISO', hint: 'Усиление сигнала матрицы: выше ISO — светлее кадр, но больше шума.',
    values: () => ISO_LIST, index: () => (S.mode === 'AUTO' ? 0 : idx(ISO_LIST, S.iso)),
    active: () => S.mode !== 'AUTO', set: (v) => { S.iso = v; },
    format: (v) => (v === 'AUTO' ? `AUTO · ${R.iso}` : String(v)), tag: () => (S.mode === 'AUTO' ? 'подбирает камера' : 'колесо → вправо'),
  }),
  Ec: control($('cEc'), {
    name: 'Экспокоррекция', hint: 'Просим камеру сделать кадр светлее (+) или темнее (−) её расчёта.',
    values: () => O.ECS, index: () => idx(O.ECS.map((x) => x + 10), S.ec + 10),
    active: () => S.mode === 'P' || S.mode === 'A' || S.mode === 'S' || (S.mode === 'M' && S.iso === 'AUTO'),
    set: (v) => { S.ec = v; }, format: (v) => O.fmtEV(v),
    tag: () => (S.mode === 'AUTO' ? 'нет в AUTO' : S.mode === 'M' && S.iso !== 'AUTO' ? 'только с ISO AUTO' : 'диск R'),
  }),
  Zoom: control($('cZoom'), {
    name: 'Фокусное расстояние', hint: 'Кольцо зума: меньше мм — шире угол, больше мм — крупнее и «сжатая» перспектива.',
    values: () => zoomList(),
    index: () => idx(zoomList(), S.f), active: () => lens().fMin !== lens().fMax,
    set: (v) => { S.f = v; }, format: (v) => `${v} мм`, tag: () => (lens().fMin === lens().fMax ? 'фикс' : 'кольцо зума'), refocus: true,
  }),
  Focus: control($('cFocus'), {
    name: 'Дистанция фокусировки', hint: 'В режиме MF вращайте кольцо фокусировки. Резко будет то, что на этой дистанции.',
    values: mfList, index: () => idx(mfList(), S.fm === 'MF' ? S.mfDist : focusTarget),
    active: () => S.fm === 'MF', set: (v) => { S.mfDist = v; focusTarget = v; },
    format: (v) => O.fmtDist(S.fm === 'MF' ? v : focusTarget), tag: () => (S.fm === 'MF' ? 'кольцо фокуса' : 'наводит автофокус'),
  }),
};
function zoomList() { const l = lens(); if (l.fMin === l.fMax) return [l.fMin]; const st = l.fMax - l.fMin > 60 ? 5 : 1; const a = []; for (let f = l.fMin; f <= l.fMax; f += st) a.push(f); if (a.at(-1) !== l.fMax) a.push(l.fMax); return a; }

// «Положение фотографа» зависит от сцены (свой ряд расстояний)
function buildPosition() {
  C.Dist = control($('cDist'), {
    name: `Расстояние до ${SC.subject.moving ? 'дорожки' : 'модели'}`, hint: 'Ближе — крупнее объект и сильнее размыт фон. Перспектива зависит от точки съёмки, а не от объектива.',
    values: () => SC.dists, index: () => idx(SC.dists, S.dist), active: () => true, set: (v) => { S.dist = v; },
    format: (v) => O.fmtDist(v), tag: () => 'шаги вперёд/назад', refocus: true,
  });
  $('panLabel').textContent = SC.movers.length ? `Проводка — вести камеру за объектом (${panMover().name})` : 'Проводка — в этой сцене нет движущихся объектов';
  $('swPan').disabled = !SC.movers.length;
}

const MODE_NOTES = {
  AUTO: 'Камера сама выбирает всё. Удобно, но вы не управляете ни размытием фона, ни смазом.',
  P: 'Программный: камера подбирает диафрагму и выдержку, вы — ISO и экспокоррекцию.',
  A: 'Приоритет диафрагмы: вы задаёте F — глубину резкости, камера подбирает выдержку. Главный режим для портрета.',
  S: 'Приоритет выдержки: вы задаёте время — заморозить или смазать движение, камера подбирает диафрагму.',
  M: 'Ручной: всё задаёте вы, внизу кадра — отклонение от замера (M.M.). С ISO AUTO камера держит экспозицию сама.',
};

document.querySelectorAll('#modes button').forEach((b) => b.addEventListener('click', () => setKey('mode', b.dataset.mode)));
document.querySelectorAll('#focusModes button').forEach((b) => b.addEventListener('click', () => setKey('fm', b.dataset.fm)));
document.querySelectorAll('#focusAreas button').forEach((b) => b.addEventListener('click', () => setKey('area', b.dataset.area)));
$('swEye').addEventListener('change', (e) => setKey('eyeAF', e.target.checked));
$('swSteady').addEventListener('change', (e) => setKey('steady', e.target.checked));
$('swTripod').addEventListener('change', (e) => setKey('tripod', e.target.checked));
$('swPan').addEventListener('change', (e) => setKey('pan', e.target.checked));

// Единая точка изменения настроек (панель, Fn, MENU)
function setKey(k, v) {
  if (k === 'mode') {
    if (v === 'M' && R) { S.N = R.N; S.t = R.t; }
    if (v === 'A' && R) S.N = R.N;
    if (v === 'S' && R) S.t = R.t;
  }
  if (k === 'fm' && v === 'MF') S.mfDist = O.nearest(MF_LIST, focusTarget);
  if (k === 'pan' && !v) S.yaw = 0;
  if (k === 'area' && v !== 'track') trackRoot = null;
  S[k] = v;
  if (menu.open) menu.render();
  if (k === 'disp' || k === 'grid') { update(); return; }
  if (['fm', 'area', 'eyeAF', 'pan'].includes(k)) acquireFocus(); else update();
}

function renderLenses() {
  $('lenses').innerHTML = LENSES.map((l) => `<button data-lens="${l.id}" role="radio"><b>${l.short}</b><span>${l.fMin === l.fMax ? 'фикс' : 'зум'} · F${String(l.maxN(l.fMin)).replace('.', ',')}</span></button>`).join('');
  $('lenses').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    S.lensId = b.dataset.lens;
    const l = lens();
    S.f = clamp(S.f, l.fMin, l.fMax);
    S.N = Math.max(S.N, l.maxN(S.f));
    onChange(true);
  }));
}
renderLenses();

function renderScenes() {
  $('scenes').innerHTML = SCENE_LIST.map(([id, n, d]) => `<button data-scene="${id}" role="radio" aria-checked="${id === S.sceneId}"><b>${n}</b><span>${d}</span></button>`).join('');
  $('scenes').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { if (b.dataset.scene !== S.sceneId) loadScene(b.dataset.scene); }));
}

function onChange(refocus = false) {
  if (refocus && S.fm !== 'MF') acquireFocus(); else update();
}

// ───────────────────────── Обновление интерфейса ─────────────────────────
function update() {
  if (!SC) return;
  const ls = lensSpec();
  if (S.N < ls.maxN) S.N = O.nearest(apertureList(), ls.maxN);
  R = O.solveExposure(S, ls, evSource());
  for (const c of Object.values(C)) c.refresh();
  document.querySelectorAll('#modes button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === S.mode)));
  document.querySelectorAll('#focusModes button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.fm === S.fm)));
  document.querySelectorAll('#focusAreas button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.area === S.area)));
  $('lenses').querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.lens === S.lensId)));
  $('swEye').checked = S.eyeAF; $('swSteady').checked = S.steady; $('swTripod').checked = S.tripod; $('swPan').checked = S.pan;
  $('modeNote').textContent = MODE_NOTES[S.mode];
  $('lensNote').textContent = `${lens().name}. ${lens().about} Мин. дистанция фокусировки ${O.fmtDist(lens().minFocus(S.f))}.`;
  drawGrid();

  // индикация в видоискателе
  const ui = $('vfUi');
  ui.classList.toggle('hidden', S.disp === 'none');
  $('vfHist').hidden = S.disp !== 'hist';
  $('oMode').textContent = S.mode === 'AUTO' ? 'iA' : S.mode;
  $('oLens').textContent = `${S.f} мм`;
  $('oAf').textContent = S.fm === 'MF' ? `MF ${O.fmtDist(focusTarget)}` : `${S.fm}${S.eyeAF ? ' 👁' : ''}`;
  $('oMeter').textContent = METER_NAMES[S.meter];
  $('oWb').textContent = S.wb === 'AWB' ? 'AWB' : `${wbKelvin()}K`;
  $('oLook').textContent = S.look;
  $('oIs').classList.toggle('off', !S.steady || S.tripod);
  $('oAel').hidden = lockedEV == null;
  $('oT').textContent = O.fmtShutter(R.t);
  $('oN').textContent = O.fmtF(R.N);
  $('oIso').textContent = `ISO ${R.isoAuto ? 'AUTO ' : ''}${R.iso}`;
  const manualMeter = S.mode === 'M' && !R.isoAuto;
  $('oEv').textContent = manualMeter ? `M.M. ${O.fmtEV(R.offset)}` : O.fmtEV(R.ec);
  $('oT').classList.toggle('warn', R.warnT);
  $('oN').classList.toggle('warn', R.warnN);
  $('oEv').classList.toggle('warn', manualMeter && Math.abs(R.offset) > 2);
  const sp = $('oSpot'), sc = spotCenter();
  sp.hidden = S.meter !== 'spot';
  sp.style.left = `${sc[0] * 100}%`; sp.style.top = `${sc[1] * 100}%`;
  placeFocusFrame();
  $('bAel').setAttribute('aria-pressed', String(lockedEV != null));
  updateExplain();
}

function placeFocusFrame() {
  const fe = $('oFocus');
  fe.style.left = `${S.focusUV[0] * 100}%`;
  fe.style.top = `${S.focusUV[1] * 100}%`;
  fe.className = `vf-focus ${S.fm === 'MF' ? 'mf' : ''} ${focusKind === 'eye' && S.fm !== 'MF' ? 'eye' : ''} ${S.area === 'track' && trackRoot ? 'track' : ''} ${focusLocked && focusOk ? 'ok' : ''} ${!focusOk ? 'bad' : ''}`;
}

function drawGrid() {
  const g = $('vfGrid');
  const L = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  let s = '';
  if (S.grid === 'thirds') for (const k of [1 / 3, 2 / 3]) s += L(k * 150, 0, k * 150, 100) + L(0, k * 100, 150, k * 100);
  if (S.grid === 'square' || S.grid === 'diag') { for (let i = 1; i < 6; i++) s += L(i * 25, 0, i * 25, 100); for (let j = 1; j < 4; j++) s += L(0, j * 25, 150, j * 25); }
  if (S.grid === 'diag') s += L(0, 0, 150, 100) + L(150, 0, 0, 100);
  g.innerHTML = s;
}

// ───────────────────────── Пояснения ─────────────────────────
function analyse(st, res, focus, cam = camera) {
  const f = st.f, N = res.N, t = res.t, coc = O.SENSOR.coc;
  const d = O.dof(f, N, focus);
  const inDof = (x) => x >= d.near * 0.98 && x <= d.far * 1.02;
  const face = SC.subject.face();
  const dSubj = depthOf(face, cam);
  const dBg = Math.max(0.5, depthOf(SC.bg.pos, cam));
  const stops = stabStops(st);
  const shake = st.tripod ? 0 : O.shakeBlurMm(f, t, stops) / coc;
  const pm = st.pan ? panMover() : null;
  const movers = SC.movers.map((m) => {
    const a = m.anchor();
    const dist = Math.max(1, a.distanceTo(cam.position));
    const rel = m === pm ? m.speed * 0.04 : m.speed;           // при проводке объект почти неподвижен относительно кадра
    return {
      name: m.name, speed: m.speed, dist,
      motion: O.motionBlurMm(f, rel, dist, t) / coc,
      trail: (f * m.speed * t / dist) / 36,
      inFrame: inFrameUV(projectUV(a, cam)), sharp: inDof(depthOf(a, cam)),
      freezeT: O.SHUTTERS.find((x) => O.motionBlurMm(f, m.speed, dist, x) / coc <= 2) || 1 / 8000,
      moveCm: m.speed * t * 100,
    };
  });
  const pmi = pm ? SC.movers.indexOf(pm) : -1;
  const panBg = pmi >= 0 ? (f * (pm.speed / movers[pmi].dist) * t) / coc : 0;
  const markerDist = {};
  for (const mk of SC.markers) markerDist[mk.name] = depthOf(mk.pos, cam);
  return {
    d, dSubj, subjName: SC.subject.name, subjSharp: inDof(dSubj), faceInFrame: inFrameUV(projectUV(face, cam)),
    dBg, bgName: SC.bg.name, bgCoc: O.cocMm(f, N, focus, dBg) / coc,
    shake, stops, movers, panBg, markerDist,
    widthM: 2 * Math.abs(dSubj) * Math.tan(THREE.MathUtils.degToRad(O.fovH(f) / 2)),
    wbK: wbKelvin(st),
  };
}

function setTile(id, cls, big, text) {
  const el = $(id);
  el.className = `tile ${cls}`;
  el.querySelector('.big').textContent = big;
  el.querySelector('p').textContent = text;
}
const blurWord = (r) => (r < 1.2 ? 'резкий' : r < 4 ? 'слегка размыт' : r < 15 ? 'заметно размыт' : 'сильно размыт');
const fmtLen = (cm) => (cm < 1 ? `${(cm * 10).toFixed(0)} мм` : cm < 100 ? `${cm.toFixed(0)} см` : `${(cm / 100).toFixed(1).replace('.', ',')} м`);

function updateExplain() {
  const A = analyse(S, R, focusTarget);
  const off = R.offset;
  const meterTxt = `Замер «${METER_NAMES[S.meter]}»${lockedEV != null ? ' (AEL)' : ''}: EV сцены ${evSource().toFixed(1).replace('.', ',')}.`;
  const fo = faceOffsetLive();
  const faceTxt = fo == null ? '' : Math.abs(fo) < 0.6 ? ` Лицо ${A.subjName === 'бегун' ? 'бегуна' : 'модели'} в норме.` : ` Лицо ${fo < 0 ? 'темнее' : 'светлее'} нормы на ${Math.abs(fo).toFixed(1).replace('.', ',')} EV${fo < 0 ? ' — попробуйте точечный замер или «+» экспокоррекцию' : ''}.`;
  if (Math.abs(off - (R.isoAuto || S.mode !== 'M' ? R.ec : 0)) < 0.34 || (S.mode !== 'M' && Math.abs(off - R.ec) < 0.34)) {
    setTile('tExp', fo != null && Math.abs(fo) >= 1 ? 'warn' : 'ok', fo != null && Math.abs(fo) >= 1 ? `Лицо ${fo > 0 ? '+' : '−'}${Math.abs(fo).toFixed(1).replace('.', ',')} EV` : 'По замеру — норма', `${meterTxt}${faceTxt}`);
  } else {
    const over = off > 0;
    const how = over ? 'закройте диафрагму, сократите выдержку или опустите ISO' : 'откройте диафрагму, удлините выдержку или поднимите ISO';
    const why = R.warnT ? ' Выдержке не хватает диапазона (мигает).' : R.warnN ? ' Диафрагме не хватает диапазона (мигает).' : '';
    setTile('tExp', Math.abs(off) < 1.5 ? 'warn' : 'bad', `${O.fmtEV(off)} EV — ${over ? 'пересвет' : 'недосвет'}`, `${meterTxt}${why} Чтобы исправить, ${how}.${faceTxt}`);
  }
  const zone = `${O.fmtDist(A.d.near)} – ${O.fmtDist(A.d.far)}`;
  if (!A.subjSharp) setTile('tDof', 'bad', `${A.subjName[0].toUpperCase() + A.subjName.slice(1)} не в фокусе`, `Резко только ${zone}, а ${A.subjName} на ${O.fmtDist(A.dSubj)}. Нажмите на него в кадре или включите «Глаз AF».`);
  else setTile('tDof', 'ok', `Резко ${zone}`, `Глубина резкости ${isFinite(A.d.total) ? O.fmtDist(A.d.total) : 'до бесконечности'}. ${A.bgName[0].toUpperCase() + A.bgName.slice(1)} (${O.fmtDist(A.dBg)}) — ${blurWord(A.bgCoc)}${A.bgCoc >= 1.2 ? `, кружок в ${Math.round(A.bgCoc)}× больше допустимого` : ''}.`);
  const fh = O.fovH(S.f);
  const kind = S.f < 24 ? 'Сверхширокий угол: пространство «растягивается», близкое сильно крупнее далёкого.'
    : S.f < 35 ? 'Широкий угол: много окружения, перспектива подчёркнута.'
      : S.f <= 60 ? 'Нормальный угол, близкий к зрению человека.'
        : S.f <= 135 ? 'Портретный угол: фон «приближается», перспектива сжимается.' : 'Телеобъектив: сильное сжатие пространства, узкий угол.';
  setTile('tFov', 'ok', `${fh.toFixed(1).replace('.', ',')}° по ширине`, `${kind} На расстоянии ${A.subjName === 'модель' ? 'модели' : 'объекта'} в кадр по ширине входит ${O.fmtDist(A.widthM)}.`);
  const m = A.movers[0];
  const safe = O.safeShutter(S.f, isFinite(A.stops) ? A.stops : 12);
  const shakeTxt = S.tripod ? 'На штативе дрожания нет.' : `Безопасная выдержка с рук ≈ ${O.fmtShutter(O.nearest(O.SHUTTERS, Math.min(30, safe)))}${S.steady ? ' (со SteadyShot)' : ' (1/f)'}.`;
  const motionTxt = m ? ` ${m.name[0].toUpperCase() + m.name.slice(1)} за ${O.fmtShutter(R.t)} сместится на ${fmtLen(m.moveCm)}${S.pan ? ' — камера ведёт его, фон смажется' : m.motion <= 2 ? ' — замрёт' : ` — смажется (заморозит ${O.fmtShutter(m.freezeT)})`}.` : '';
  const motionBad = m && m.motion > 2;
  setTile('tBlur', A.shake < 1.5 && !motionBad ? 'ok' : A.shake >= 3 ? 'bad' : 'warn',
    A.shake >= 3 ? 'Шевелёнка!' : A.shake >= 1.5 ? 'Лёгкая шевелёнка' : motionBad ? 'Движение смажется' : S.pan && A.panBg > 5 ? 'Проводка' : 'Резко', `${shakeTxt}${motionTxt}`);
  const iso = R.iso;
  setTile('tNoise', iso <= 6400 ? 'ok' : iso <= 25600 ? 'warn' : 'bad',
    iso <= 1600 ? `ISO ${iso} — чисто` : iso <= 6400 ? `ISO ${iso} — малый шум` : iso <= 25600 ? `ISO ${iso} — шумно` : `ISO ${iso} — сильный шум`,
    'ISO усиливает сигнал матрицы вместе с шумом. α7 IV даёт чистую картинку примерно до ISO 6400.');
  const lk = SC.lightK, k = A.wbK, dk = Math.log2(k / lk);
  setTile('tWb', Math.abs(dk) < 0.25 ? 'ok' : 'warn', `${S.wb === 'AWB' ? 'AWB · ' : ''}${k} K`,
    `Основной свет сцены ≈ ${lk} K. ${Math.abs(dk) < 0.25 ? 'Баланс близок к свету — цвета естественные.' : dk > 0 ? 'Баланс выше температуры света — кадр уйдёт в тёплые, оранжевые тона.' : 'Баланс ниже температуры света — кадр станет синеватым.'}`);
  drawDofBar(A);
}

const LMIN = Math.log(0.3), LMAX = Math.log(150);
const xPos = (d) => (isFinite(d) ? clamp((Math.log(Math.max(d, 0.3)) - LMIN) / (LMAX - LMIN), 0, 1) * 92 + 2 : 97);
function drawDofBar(A) {
  const a = xPos(A.d.near), b = xPos(A.d.far);
  $('dofZone').style.left = `${a}%`;
  $('dofZone').style.width = `${Math.max(0.6, b - a)}%`;
  $('dofFocus').style.left = `${xPos(focusTarget)}%`;
  $('dofMarks').innerHTML = Object.entries(A.markerDist).filter(([, d]) => d > 0.3).map(([n, d]) => `<span style="left:${xPos(d)}%">${n}</span>`).join('');
  $('dofScale').innerHTML = [0.5, 1, 2, 5, 10, 20, 50, 100].map((d) => `<span style="left:${xPos(d)}%">${O.fmtDist(d)}</span>`).join('') + '<span style="left:97%">∞</span>';
}

// ───────────────────────── Меню камеры ─────────────────────────
const menu = new CameraMenu($('camMenu'), {
  S,
  set: (k, v) => setKey(k, v),
  act: (a) => {
    if (a === 'gallery') { menu.close(); if (shots.length) openPhoto(0); }
    if (a === 'clear') { shots.length = 0; renderGallery(); menu.render(); toast('Галерея очищена'); }
    if (a === 'reset') { Object.assign(S, DEFAULTS); S.lensId = SC.defaults.lensId; S.f = SC.defaults.f; lockedEV = null; acquireFocus(true); toast('Настройки сброшены'); }
  },
});
$('bMenu').addEventListener('click', () => menu.toggle('menu'));
$('bFn').addEventListener('click', () => menu.toggle('fn'));
$('bAel').addEventListener('click', () => { lockedEV = lockedEV == null ? meterEV : null; update(); toast(lockedEV != null ? 'Экспозиция зафиксирована (AEL)' : 'AEL снят'); });
$('bDisp').addEventListener('click', () => setKey('disp', { all: 'hist', hist: 'none', none: 'all' }[S.disp]));
$('bPlay').addEventListener('click', () => (shots.length ? openPhoto(0) : toast('Снимков пока нет')));
$('bWhy').addEventListener('click', () => $('explain').scrollIntoView({ behavior: 'smooth', block: 'start' }));

let toastT = 0;
function toast(text, kind = '') {
  const t = $('vfToast');
  t.textContent = text;
  t.className = `vf-toast show ${kind}`;
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.className = 'vf-toast'; }, kind ? 4200 : 2000);
}

// ───────────────────────── Видоискатель: касания ─────────────────────────
const vf = $('vf');
let down = null;
const isUi = (e) => e.target.closest('.cam-menu, .vf-shutter');
vf.addEventListener('pointerdown', (e) => {
  if (isUi(e) || menu.open) return;
  vf.setPointerCapture(e.pointerId);
  down = { x: e.clientX, y: e.clientY, yaw: S.yaw, pitch: S.pitch, drag: false };
});
vf.addEventListener('pointermove', (e) => {
  if (!down) return;
  const dx = e.clientX - down.x, dy = e.clientY - down.y;
  if (!down.drag && Math.hypot(dx, dy) > 6) down.drag = true;
  if (!down.drag) return;
  const k = THREE.MathUtils.degToRad(O.fovV(S.f)) / vf.clientHeight;
  if (!S.pan) S.yaw = clamp(down.yaw + dx * k, -1.3, 1.3);
  S.pitch = clamp(down.pitch + dy * k, -0.5, 0.5);
});
vf.addEventListener('pointerup', (e) => {
  if (!down) return;
  const r = vf.getBoundingClientRect();
  if (!down.drag) {
    S.focusUV = [clamp((e.clientX - r.left) / r.width, 0.04, 0.96), clamp((e.clientY - r.top) / r.height, 0.06, 0.94)];
    if (S.area === 'track') {
      const h = hitAt(S.focusUV);
      trackRoot = h ? rootOf(h.object) : null;
      toast(trackRoot ? `Трекинг: ${trackRoot === SC.subject.root ? SC.subject.name : panMover().name}` : 'Трекинг: объект не выбран');
      if (S.pan) S.yaw = 0;
    }
    if (S.fm !== 'MF') acquireFocus(); else update();
  } else if (S.fm !== 'MF') acquireFocus();
  down = null;
  $('vfHint').classList.add('hide');
});

// ───────────────────────── Звук фокуса ─────────────────────────
let audio = null;
function beep() {
  if (!S.beep) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = 2600; g.gain.value = 0.03;
    o.connect(g).connect(audio.destination);
    o.start(); o.stop(audio.currentTime + 0.05);
  } catch (e) { /* звук недоступен */ }
}

// ───────────────────────── Спуск затвора ─────────────────────────
let busy = false;
const CAPTURE_W = { L: mobile ? 1500 : 2400, M: mobile ? 1100 : 1600, S: mobile ? 850 : 1200 };

async function shoot() {
  if (busy || menu.open) return;
  busy = true;
  document.querySelectorAll('.shutter').forEach((b) => b.classList.add('busy'));
  try {
    if (S.drive === 'timer2' || S.drive === 'timer10') {
      for (let s = S.drive === 'timer2' ? 2 : 10; s > 0; s--) { $('vfCount').textContent = s; $('vfCount').hidden = false; await sleep(1000); }
      $('vfCount').hidden = true;
    }
    const n = S.drive === 'burst' ? 5 : 1;
    const t0 = performance.now() / 1000;
    for (let i = 0; i < n; i++) { await captureOne(t0 + i * 0.1); await sleep(16); }
  } finally {
    document.querySelectorAll('.shutter').forEach((b) => b.classList.remove('busy'));
    busy = false;
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function captureOne(t0) {
  SC.update(t0);
  SC.scene.updateMatrixWorld(true);
  if (S.pan) { const m = panMover(); if (m) S.yaw = followYaw(m); }
  if (S.fm !== 'MF') acquireFocus(true); else focusCur = focusTarget;
  placeCamera();
  const st = { ...S }, res = { ...R }, focus = focusTarget;
  const A = analyse(st, res, focus);
  const faceUV = projectUV(SC.subject.face());
  await sleep(20);

  const liveW = pipe.w, liveH = pipe.h;
  const cw = window.__simFast ? 600 : CAPTURE_W[S.jpegSize];      // __simFast — только для автотестов
  pipe.setSize(cw, Math.round(cw / 1.5));
  const coc2px = O.SENSOR.coc / 36 * cw;
  const moverPx = Math.max(0, ...A.movers.map((m) => m.motion * coc2px), st.pan ? A.panBg * coc2px : 0);
  const frames = clamp(Math.ceil(Math.max(A.shake * coc2px, moverPx) / 3), 1, window.__simFast ? 6 : mobile ? 28 : 48);
  const theta = st.tripod ? 0 : O.shakeBlurMm(st.f, res.t, A.stops) / st.f;
  const phi = Math.random() * Math.PI * 2;
  const pm = st.pan ? panMover() : null;
  const seen = SC.movers.map(() => false);           // попал ли объект в кадр за время выдержки
  const out = pipe.capture(SC.scene, camera, { f: st.f, N: res.N, focus, iso: res.iso, gain: gainFor(res), wb: O.wbGains(A.wbK), look: st.look, dro: st.dro }, {
    frames,
    step: (k) => {
      const s = frames > 1 ? k / (frames - 1) : 0;
      SC.update(t0 + s * res.t, { streakDt: res.t / frames });
      const yawFollow = pm ? followYaw(pm) : st.yaw;
      const saved = S.yaw;
      S.yaw = yawFollow;
      const wob = Math.sin((s - 0.5) * 9 + phi) * 0.25;
      placeCamera(Math.cos(phi) * theta * (s - 0.5 + wob * 0.3), Math.sin(phi) * theta * (s - 0.5 - wob * 0.3));
      SC.movers.forEach((m, i) => { if (!seen[i] && inFrameUV(projectUV(m.anchor()), 0)) seen[i] = true; });
      S.yaw = saved;
    },
  });
  A.movers.forEach((m, i) => { m.seen = seen[i] || m.inFrame; });
  SC.update(performance.now() / 1000);
  pipe.setSize(liveW, liveH);
  placeCamera();
  const shot = { url: out.toDataURL('image/jpeg', 0.92), st, res, focus, A, n: shots.length + 1, sceneId: SC.id, face: faceBrightness(out, faceUV, st.f, A) };
  if (activeMission && missionById(activeMission).scene === SC.id) {
    const ms = missionById(activeMission);
    const results = ms.check(shot);
    shot.mission = { id: ms.id, title: ms.title, results, pass: results.every((r) => r.ok) };
    if (shot.mission.pass) {
      done.add(ms.id);
      try { localStorage.setItem('a7sim-done', JSON.stringify([...done])); } catch (e) { /* хранилище недоступно */ }
      toast(`✓ Задание «${ms.title}» выполнено!`, 'good');
      renderMissions();
    } else toast(`Почти! ${results.find((r) => !r.ok).text}`, 'bad');
  }
  shots.unshift(shot);
  renderGallery();
  $('vfFlash').classList.remove('on'); void $('vfFlash').offsetWidth; $('vfFlash').classList.add('on');
}

// средняя яркость лица на готовом снимке (0…1)
function faceBrightness(canvasOut, u, f, A) {
  if (!inFrameUV(u, 0.01)) return null;
  const W = canvasOut.width, H = canvasOut.height;
  const facePx = (0.2 / Math.max(0.3, A.dSubj)) * (f / 36) * W;
  const r = clamp(Math.round(facePx * 0.22), 2, 60);
  const x = Math.round(u.x * W), y = Math.round(u.y * H);
  const d = canvasOut.getContext('2d').getImageData(clamp(x - r, 0, W - 1), clamp(y - r, 0, H - 1), 2 * r, 2 * r).data;
  let s = 0;
  for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  return s / (d.length / 4) / 255;
}

$('shutter').addEventListener('click', (e) => { e.stopPropagation(); shoot(); });
// Пробел — спуск. Не мешаем только вводу текста и кнопкам, выбранным с клавиатуры.
document.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || menu.open || $('photo').open || document.body.classList.contains('touring')) return;
  const a = document.activeElement;
  if (a && (['TEXTAREA', 'SELECT'].includes(a.tagName) || (a.tagName === 'INPUT' && a.type !== 'range' && a.type !== 'checkbox') || (a.tagName === 'BUTTON' && a.matches(':focus-visible')))) return;
  e.preventDefault();
  shoot();
});
// после клика мышью снимаем фокус с кнопки, чтобы пробел оставался спуском
document.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && e.detail > 0) b.blur(); });

// ───────────────────────── Задания ─────────────────────────
// Карточка сворачивается (по умолчанию свёрнута): видны прогресс и текущее задание, список — по нажатию.
let missionsOpen = false;
try { missionsOpen = localStorage.getItem('a7sim-missions-open') === '1'; } catch (e) { /* хранилище недоступно */ }
function setMissionsOpen(open) {
  missionsOpen = open;
  $('missions').hidden = !open;
  $('missionsHead').setAttribute('aria-expanded', String(open));
  try { localStorage.setItem('a7sim-missions-open', open ? '1' : '0'); } catch (e) { /* хранилище недоступно */ }
}
$('missionsHead').addEventListener('click', () => setMissionsOpen(!missionsOpen));

function renderMissions() {
  const ms = activeMission ? missionById(activeMission) : null;
  const nDone = MISSIONS.filter((m) => done.has(m.id)).length;
  $('missionsSum').textContent = `выполнено ${nDone} из ${MISSIONS.length}`;
  $('missionCur').innerHTML = ms ? `<div class="mission-cur">
      <div class="mc-head"><span><small>Сейчас</small><b>${ms.title}</b></span><button class="mc-x" id="mcStop">Выйти</button></div>
      <details><summary>Цель и подсказки</summary><p>${ms.goal}</p><ul>${ms.hints.map((h) => `<li>${h}</li>`).join('')}</ul></details>
    </div>` : '';
  $('missions').innerHTML = `
    ${ms ? '' : '<p class="note">Выберите задание: сцена загрузится, камера вернётся к исходным настройкам, а каждый снимок будет проверяться.</p>'}
    <div class="mission-list">${MISSIONS.map((m) => `<button data-m="${m.id}" class="${m.id === activeMission ? 'on' : ''}"><span class="mc-ok">${done.has(m.id) ? '✓' : ''}</span><span>${m.title}</span><small>${SCENE_LIST.find((x) => x[0] === m.scene)[1]}</small></button>`).join('')}</div>`;
  $('missions').querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => startMission(b.dataset.m)));
  $('mcStop')?.addEventListener('click', () => { activeMission = null; renderMissions(); });
  setMissionsOpen(missionsOpen);
}
function startMission(id) {
  activeMission = id;
  const ms = missionById(id);
  Object.assign(S, DEFAULTS);
  lockedEV = null;
  loadScene(ms.scene, { keep: false });
  if (ms.setup) { Object.assign(S, ms.setup); acquireFocus(true); }
  missionsOpen = false;                       // список сворачивается, остаётся только текущее задание
  renderMissions();
  toast(`Задание: ${ms.title}`);
  if (mobile) $('vfWrap').scrollIntoView({ behavior: 'smooth' });
}

// ───────────────────────── Галерея и разбор снимка ─────────────────────────
const exifLine = (s) => `${s.st.f} мм · ${O.fmtF(s.res.N)} · ${O.fmtShutter(s.res.t)} · ISO ${s.res.iso}`;
function renderGallery() {
  $('shotCount').textContent = shots.length ? `(${shots.length})` : '';
  $('gallery').innerHTML = shots.length
    ? shots.map((s, i) => `<button data-i="${i}"><img src="${s.url}" alt="Снимок ${s.n}"><i>${s.mission ? (s.mission.pass ? '✓ ' : '✗ ') : ''}${exifLine(s)}</i></button>`).join('')
    : '<p class="note">Здесь появятся ваши кадры с разбором настроек.</p>';
  $('gallery').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => openPhoto(+b.dataset.i)));
  if (shots[0]) $('bPlay').style.backgroundImage = `url(${shots[0].url})`;
}

function notesFor(s) {
  const n = [], A = s.A, off = s.res.offset;
  const target = s.st.mode === 'M' && !s.res.isoAuto ? 0 : s.res.ec;
  if (Math.abs(off - target) < 0.34) n.push(['ok', `Экспозиция по замеру «${METER_NAMES[s.st.meter]}» в норме${s.res.ec ? ` (поправка ${O.fmtEV(s.res.ec)})` : ''}.`]);
  else n.push([Math.abs(off) < 1.5 ? 'warn' : 'bad', `Кадр ${off > 0 ? 'светлее' : 'темнее'} замера на ${Math.abs(off).toFixed(1).replace('.', ',')} EV.`]);
  if (s.face != null) {
    const f = s.face;
    n.push([f >= 0.33 && f <= 0.72 ? 'ok' : 'warn', f < 0.33 ? `Лицо тёмное (${Math.round(f * 100)}%). Против света нужен точечный замер или «+».` : f > 0.72 ? `Лицо пересвечено (${Math.round(f * 100)}%).` : `Лицо проэкспонировано хорошо (${Math.round(f * 100)}%).`]);
  }
  n.push([A.subjSharp ? 'ok' : 'bad', A.subjSharp ? `${A.subjName[0].toUpperCase() + A.subjName.slice(1)} в фокусе. Зона резкости ${O.fmtDist(A.d.near)} – ${O.fmtDist(A.d.far)}.` : `${A.subjName[0].toUpperCase() + A.subjName.slice(1)} вне зоны резкости (${O.fmtDist(A.d.near)} – ${O.fmtDist(A.d.far)}), фокус был на ${O.fmtDist(s.focus)}.`]);
  n.push([A.bgCoc > 6 ? 'ok' : 'warn', `${A.bgName[0].toUpperCase() + A.bgName.slice(1)} — ${blurWord(A.bgCoc)}.`]);
  if (A.shake >= 1.5) n.push([A.shake >= 3 ? 'bad' : 'warn', `${A.shake >= 3 ? 'Шевелёнка' : 'Лёгкая шевелёнка'}: ${O.fmtShutter(s.res.t)} слишком долго для съёмки с рук на ${s.st.f} мм${s.st.steady ? ' даже со SteadyShot' : ' — включите SteadyShot'}.`]);
  for (const m of A.movers) if (m.inFrame && m.motion > 2) n.push(['warn', `${m.name[0].toUpperCase() + m.name.slice(1)} смазан: за ${O.fmtShutter(s.res.t)} сместился на ${fmtLen(m.moveCm)}. Заморозит ${O.fmtShutter(m.freezeT)} и короче.`]);
  if (s.st.pan && A.panBg > 5) n.push(['ok', 'Проводка: фон размазан движением камеры.']);
  if (s.res.iso > 6400) n.push(['warn', `ISO ${s.res.iso}: шум заметен.`]);
  return n;
}

let cur = 0;
function openPhoto(i) {
  cur = clamp(i, 0, shots.length - 1);
  const s = shots[cur];
  $('phImg').src = s.url;
  $('phDl').href = s.url;
  $('phDl').download = `a7iv_${String(s.n).padStart(3, '0')}.jpg`;
  $('phExif').innerHTML = `<b>Снимок ${s.n}</b><br>${lensById(s.st.lensId).name}<br>${exifLine(s)} · ${s.st.mode === 'AUTO' ? 'iA' : s.st.mode}<br>ББ ${s.st.wb === 'AWB' ? 'AWB ' : ''}${s.A.wbK} K · ${s.st.look} · замер «${METER_NAMES[s.st.meter]}»<br>Фокус ${O.fmtDist(s.focus)}`;
  $('phMission').innerHTML = s.mission ? `<div class="phm ${s.mission.pass ? 'pass' : 'fail'}"><b>${s.mission.pass ? '✓ Задание выполнено' : '✗ Задание не выполнено'}: ${s.mission.title}</b><ul>${s.mission.results.map((r) => `<li class="${r.ok ? 'ok' : 'bad'}">${r.ok ? '✓' : '✗'} ${r.text}</li>`).join('')}</ul></div>` : '';
  $('phNotes').innerHTML = notesFor(s).map(([c, t]) => `<li class="${c}">${t}</li>`).join('');
  drawHist(s.url);
  if (!$('photo').open) $('photo').showModal();
}
function drawHist(url) {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = 240; c.height = 160;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, 240, 160);
    const d = g.getImageData(0, 0, 240, 160).data;
    const bins = new Array(256).fill(0);
    for (let i = 0; i < d.length; i += 4) bins[Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2])]++;
    const max = Math.max(...bins.slice(1, 255)) || 1;
    const h = $('phHist').getContext('2d');
    h.clearRect(0, 0, 256, 80);
    h.fillStyle = '#d7dbe3';
    bins.forEach((v, i) => { const y = Math.min(80, (v / max) * 76); h.fillRect(i, 80 - y, 1, y); });
  };
  img.src = url;
}
$('phClose').addEventListener('click', () => $('photo').close());
$('phPrev').addEventListener('click', () => openPhoto(cur - 1));
$('phNext').addEventListener('click', () => openPhoto(cur + 1));
$('photo').addEventListener('click', (e) => { if (e.target === $('photo')) $('photo').close(); });

// Живая гистограмма по сетке экспозамера
const acesJS = (x) => clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0, 1);
function drawLiveHist() {
  const c = $('vfHist'), g = c.getContext('2d');
  const bins = new Array(48).fill(0), gain = gainFor(R);
  for (const v of pipe.meterLog) {
    const s = acesJS(2 ** v * gain);
    const srgb = s <= 0.0031308 ? s * 12.92 : 1.055 * s ** (1 / 2.4) - 0.055;
    bins[Math.min(47, Math.floor(srgb * 48))]++;
  }
  const max = Math.max(...bins) || 1;
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#fff';
  bins.forEach((v, i) => { const h = (v / max) * (c.height - 4); g.fillRect(i * (c.width / 48), c.height - h, c.width / 48 - 0.5, h); });
}

// ───────────────────────── Цикл ─────────────────────────
let last = performance.now(), slow = 0, frameNo = 0;
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!document.hidden && !busy && SC) {
    SC.update(now / 1000);
    SC.scene.updateMatrixWorld();
    if (S.pan) { const m = panMover(); if (m) S.yaw = followYaw(m); }
    if (S.fm === 'AF-C' && frameNo % 4 === 0) acquireFocusQuiet();
    focusCur = Math.exp(Math.log(focusCur) + (Math.log(focusTarget) - Math.log(focusCur)) * Math.min(1, dt * 9));
    const locked = S.fm !== 'MF' && focusOk && Math.abs(Math.log(focusCur / focusTarget)) < 0.02;
    if (locked && !focusLocked && S.fm === 'AF-S') beep();
    if (locked !== focusLocked) { focusLocked = locked; placeFocusFrame(); }
    placeCamera();
    if (++frameNo % 6 === 0) measureNearest();
    pipe.renderLive(SC.scene, camera, {
      f: S.f, N: R.N, focus: focusCur, iso: R.iso, gain: gainFor(R), wb: O.wbGains(wbKelvin()), look: S.look, dro: S.dro,
      peak: S.peak !== 'off', peakColor: PEAK[S.peak], zebra: S.zebra,
    });
    if (frameNo % 8 === 0) {
      const raw = measure(pipe.readMeter());
      meterReady = true;
      const prev = meterEV;
      meterEV += (raw - meterEV) * Math.min(1, dt * 8 * 2.5);
      if (lockedEV == null && Math.abs(meterEV - prev) > 0.02) update();
      else if (frameNo % 48 === 0) updateExplain();
      if (S.disp === 'hist') drawLiveHist();
    }
    slow = slow * 0.95 + (dt > 0.05 ? 1 : 0) * 0.05;
    if (slow > 0.6 && resScale > 0.55) { resScale *= 0.85; slow = 0; resize(); }
  }
  requestAnimationFrame(loop);
}
// AF-C: тихое обновление дистанции (без перерисовки всего интерфейса каждый раз)
function acquireFocusQuiet() {
  const prevT = focusTarget, prevUV = S.focusUV.join();
  acquireFocus(false, true);
  if (Math.abs(Math.log(prevT / focusTarget)) > 0.01 || prevUV !== S.focusUV.join()) { placeFocusFrame(); if (frameNo % 24 === 0) update(); }
}
const nearRay = new THREE.Raycaster();
function measureNearest() {
  let m = 1000;
  for (let i = 0; i < 7; i++) for (let j = 0; j < 5; j++) {
    nearRay.setFromCamera(new THREE.Vector2(-0.95 + i * (1.9 / 6), -0.95 + j * (1.9 / 4)), camera);
    const h = nearRay.intersectObjects(SC.solids, true)[0];
    if (h) m = Math.min(m, h.distance);
  }
  pipe.nearest = m;
}

// ───────────────────────── Тур для новичков ─────────────────────────
const card = (id) => () => $(id)?.closest('.card');
const TOUR_STEPS = [
  { el: () => $('vf'), title: 'Это экран камеры',
    text: 'Картинка считается по законам оптики: угол обзора, глубина резкости, экспозиция и смаз — как у настоящей α7 IV. Нажмите в кадре, чтобы сфокусироваться, а потяните — чтобы повернуть камеру.' },
  { el: () => $('shutter'), title: 'Спуск затвора',
    text: `Делает снимок${mobile ? '' : ' (на компьютере — ещё и клавиша «Пробел»)'}. К каждому кадру будет разбор: что получилось и как сделать лучше.` },
  { el: () => document.querySelector('.vf-bottom'), title: 'Главные цифры',
    text: 'Выдержка, диафрагма, экспокоррекция и ISO. Если камере не хватает диапазона, значение мигает красным.' },
  { el: () => document.querySelector('.cam-bar'), title: 'Кнопки камеры',
    text: `MENU — все настройки, Fn — быстрые (фокус, замер, баланс белого…), AEL — зафиксировать экспозицию, DISP — гистограмма и вид экрана, ▶ — просмотр снимков.${mobile ? ' «Почему так?» — пояснения к кадру.' : ''}` },
  { el: () => $('missionsCard'), title: 'Задания', before: () => setMissionsOpen(false),
    text: 'Лучший способ начать: 9 упражнений, каждый снимок проверяется автоматически. Нажмите на заголовок, чтобы раскрыть список.' },
  { el: card('scenes'), title: 'Сцены', text: 'Парк на закате, ночная улица и стадион в полдень: разный свет — разные задачи.' },
  { el: card('modes'), title: 'Режим съёмки',
    text: 'Как диск режимов на камере: A — вы выбираете диафрагму, S — выдержку, M — всё сами, P и AUTO — камера помогает.' },
  { el: card('cN'), title: 'Экспозиция',
    text: 'Диафрагма, выдержка, ISO и экспокоррекция. Значения с пометкой «подбирает камера» в этом режиме выбирает она сама.' },
  { el: card('lenses'), title: 'Объективы', text: 'Пять объективов Sony FE: от широкого 16-35 до телевика 70-200. У каждого своя светосила и минимальная дистанция фокусировки.' },
  { el: card('swTripod'), title: 'Где стоит фотограф',
    text: 'Расстояние до объекта, стабилизатор, штатив и проводка — от них зависят перспектива, шевелёнка и смаз движения.' },
  { el: () => $('explain'), title: 'Что происходит в кадре',
    text: 'Пояснения обновляются вживую: экспозиция, глубина резкости, смаз, шум и цвет. Шкала внизу показывает, что попадает в зону резкости.' },
  { el: null, title: 'Готово!', text: 'Начните с задания «Портрет с размытым фоном». Повторить тур можно кнопкой «?» вверху страницы.' },
];
// Прокрутка к элементу: на телефоне — под закреплённый видоискатель, на компьютере — внутри панели настроек
function tourScroll(el) {
  if ($('vfWrap').contains(el)) { if (mobile) window.scrollTo({ top: 0, behavior: 'smooth' }); else el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
  if (mobile) {
    const top = el.getBoundingClientRect().top + window.scrollY - $('vfWrap').getBoundingClientRect().bottom - 12;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  } else el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
const tour = new Tour(TOUR_STEPS, {
  scrollFor: tourScroll,
  onEnd: () => { try { localStorage.setItem('a7sim-tour', 'done'); } catch (e) { /* хранилище недоступно */ } window.scrollTo({ top: 0, behavior: 'smooth' }); },
});
function startTour() { menu.close(); if ($('photo').open) $('photo').close(); $('vfHint').classList.add('hide'); tour.start(); }
$('tourBtn').addEventListener('click', startTour);

// ───────────────────────── Старт ─────────────────────────
resize();
renderMissions();
loadScene('park', { keep: false });
requestAnimationFrame(loop);
$('loading').classList.add('done');
if (mobile) $('vfHint').textContent = 'Нажмите — фокус, тяните — поворот';
setTimeout(() => $('vfHint').classList.add('hide'), 7000);
let tourSeen = false;
try { tourSeen = localStorage.getItem('a7sim-tour') === 'done' || new URLSearchParams(location.search).has('notour'); } catch (e) { /* хранилище недоступно */ }
if (!tourSeen) setTimeout(startTour, 900);

window.__sim = { startTour, S, get R() { return R; }, get meterEV() { return meterEV; }, get SC() { return SC; }, get focus() { return { focusTarget, focusCur, focusOk, focusKind }; }, camera, hitAt, shoot, update, acquireFocus, loadScene, startMission, pipe, shots, measure, setKey };
