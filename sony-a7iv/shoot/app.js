import * as THREE from 'three';
import * as O from './optics.js?v=4';
import { LENSES, lensById } from './lenses.js?v=2';
import { Pipeline, METER_W, METER_H } from './pipeline.js?v=5';
import { CameraMenu } from './menu.js?v=9';
import { MISSIONS, missionById } from './tasks.js?v=4';
import { Tour } from './tour.js?v=1';
import * as Park from './scenes/park.js?v=4';
import * as Night from './scenes/night.js?v=4';
import * as Stadium from './scenes/stadium.js?v=4';

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
// Настройки камеры (сбрасываются заданиями и «Сброс настроек камеры»). Названия значений — в menu.js.
const DEFAULTS = {
  mode: 'A', N: 2.8, t: 1 / 250, iso: 'AUTO', ec: 0, autoMinSS: 'std',
  fm: 'AF-S', area: 'point', eyeAF: true, eyeSubj: 'human', mfDist: 3,
  meter: 'multi', spotLink: 'center',
  wb: 'AWB', wbK: 5500, awbPri: 'std', dro: false, look: 'ST',
  zebraOn: false, zebraLvl: 101, peakOn: false, peakLvl: 1, peakColor: 'white',
  // «Пользоват. 1/2» уровня зебры (справочник, стр. 192, «Совет»): 1 — стандартное значение и диапазон, 2 — минимальное значение
  zc1: { range: true, std: 70, rng: 5, min: 101 }, zc2: { range: false, std: 70, rng: 5, min: 101 },
  drive: 'single', burstFps: 10, timerSec: 10, brStep: 1, steady: true, tripod: false, pan: false,
  fileFormat: 'JPEG', jpegSize: 'L', aspect: '3:2', nr: 1, lvOff: false,
  // видео: частота кадров записи и звук (MENU → Съемка → Парамет. видео / Запись звука)
  fps: 25, audioOn: true, audioLvl: 26, audioShow: true,
};
// Настройки экрана и управления (сбрасывает только «Инициализировать»)
const VIEW_DEFAULTS = { gridOn: true, grid: 'thirds', disp: 'all', beep: true, focusColor: 'white', touch: 'on', touchFn: 'focus', review: 0 };
const S = {
  ...DEFAULTS, ...VIEW_DEFAULTS, sceneId: 'park', lensId: '85', f: 85, dist: 3, yaw: 0, pitch: 0, focusUV: [0.5, 0.33], zoneUV: [0.5, 0.5],
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
const WB_K = { day: 5500, shade: 7500, cloudy: 6500, tungsten: 3200, fluorWW: 3000, fluorCW: 4000, fluorDW: 5000, fluorD: 6500, flash: 6000 };
const autoWB = (wb) => ['AWB', 'AWBa', 'AWBw', 'uw'].includes(wb);
// сколько «тёплого» оттенка оставляет AWB: Атмосфера — больше, Белый — почти ничего
const awbKeep = (st) => (st.wb === 'AWBa' ? 0.3 : st.wb === 'AWBw' ? 0.02 : { std: 0.12, amb: 0.3, white: 0.02 }[st.awbPri]);
// «Пользоват.» — как будто баланс замерен по серой карте под основным светом сцены
const wbKelvin = (st = S) => Math.round(autoWB(st.wb) ? O.awbKelvin(SC.lightK, awbKeep(st)) : st.wb === 'K' ? st.wbK : /^c\d$/.test(st.wb) ? SC.lightK : WB_K[st.wb]);
const WB_TAG = { AWB: 'AWB', AWBa: 'AWB A', AWBw: 'AWB W', uw: 'AWB ≈', c1: 'C1', c2: 'C2', c3: 'C3' };
const PEAK = { red: [1, 0.12, 0.1], yellow: [1, 0.9, 0.1], blue: [0.3, 0.5, 1], white: [1, 1, 1] };
const zebraY = (v) => (v > 100 ? 0.985 : v / 100 * 0.97);
// [нижний, верхний] порог зебры: уровень 70…100+ — «от и выше», «Пользоват.» — диапазон или минимальное значение
const zebraThr = () => {
  const c = S.zebraLvl === 'c1' ? S.zc1 : S.zebraLvl === 'c2' ? S.zc2 : { range: false, min: S.zebraLvl };
  return c.range ? [zebraY(c.std - c.rng), zebraY(c.std + c.rng)] : [zebraY(c.min), 9];
};
const ASPECT = { '3:2': 1.5, '4:3': 4 / 3, '16:9': 16 / 9, '1:1': 1 };
// Область фокусировки: «широкие» (камера выбирает сама) и «точечные» (там, куда указали)
const areaWide = (a = S.area) => a === 'wide' || a === 'zone';
const areaPoint = (a = S.area) => !areaWide(a) && a !== 'track';
const ZONE_W = 0.3, ZONE_H = 0.4;     // размер зоны «Зонная фокус.» в долях кадра
let touchTrack = false;              // отслеживание, запущенное касанием (Сенс. отслежив.)
const tracking = () => S.area === 'track' || touchTrack;
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
  if (S.area === 'center') S.focusUV = [0.5, 0.5];
  let uv = S.focusUV, dist = null, kind = areaPoint() ? 'point' : S.area;
  if (tracking() && trackRoot) {
    const m = SC.movers.find((x) => x.root === trackRoot);
    const p = m ? m.anchor() : SC.subject.face();
    const u = projectUV(p);
    if (inFrameUV(u, 0.01)) { uv = [u.x, u.y]; S.focusUV = uv; dist = depthOf(p); }
  }
  const zc = S.area === 'zone' ? S.zoneUV : null;      // «Зонная фокус.»: ищем только внутри зоны
  const inZone = (u) => !zc || (Math.abs(u[0] - zc[0]) < ZONE_W / 2 && Math.abs(u[1] - zc[1]) < ZONE_H / 2);
  if (S.eyeAF && S.eyeSubj === 'human' && (areaWide() || (tracking() && trackRoot === SC.subject.root) || (areaPoint() && !touchTrack))) {
    const e = visibleEye();
    if (e && inZone(e.uv) && (!areaPoint() || tracking() || Math.hypot((e.uv[0] - uv[0]) * 1.5, e.uv[1] - uv[1]) < 0.16)) { uv = e.uv; dist = e.dist; kind = 'eye'; }
  }
  if (dist == null && areaWide()) {
    let best = null;       // широкая зона: ближайший предмет в центральной части кадра (в зонной — внутри зоны)
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) {
      const u = zc ? [zc[0] + (i - 2) * ZONE_W / 5, zc[1] + (j - 1) * ZONE_H / 3.2] : [0.25 + i * 0.125, 0.3 + j * 0.2], h = hitAt(u);
      if (h && (!best || h.distance < best.h.distance)) best = { h, u };
    }
    if (best) { uv = best.u; dist = depthOf(best.h.point); }
  }
  if (dist == null) { const h = hitAt(uv); dist = h ? depthOf(h.point) : 1000; }
  const mfd = lens().minFocus(S.f);
  focusOk = dist >= mfd;
  focusTarget = Math.max(dist, mfd);
  focusKind = kind;
  if (!areaPoint() || tracking() || kind === 'eye') S.focusUV = uv;
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
// справочник ILCE-7M4, стр. 121: в «Видео» доступны только AF-C и MF — во всех точках входа (меню, боковые кнопки, вызов настроек)
const VIDEO_FM = ['AF-C', 'MF'];
function isMovie() { try { return !!menu.X.movie; } catch (e) { return false; } }
function setKey(k, v) {
  if (k === 'fm' && isMovie() && !VIDEO_FM.includes(v)) { toast('В режиме «Видео» — только AF-C или MF'); return; }
  if (k === 'fps') {
    if (V.rec) { toast('Во время записи частоту кадров не изменить — остановите запись'); return; }
    if (menu.X.vals.setup0_2 !== fpsSystem(v)) { menu.X.vals.setup0_2 = fpsSystem(v); menu.save(); }
  }
  if (k === 'mode') {
    if (v === 'M' && R) { S.N = R.N; S.t = R.t; }
    if (v === 'A' && R) S.N = R.N;
    if (v === 'S' && R) S.t = R.t;
  }
  if (k === 'fm' && v === 'MF') S.mfDist = O.nearest(MF_LIST, focusTarget);
  if (k === 'pan' && !v) S.yaw = 0;
  if (k === 'area') { touchTrack = false; if (v !== 'track') trackRoot = null; }
  if (k === 'drive') brIdx = 0;
  S[k] = v;
  if (menu.open) menu.render();
  if (['fm', 'area', 'eyeAF', 'eyeSubj', 'pan'].includes(k)) acquireFocus(); else update();
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
  if (isMovie() && !VIDEO_FM.includes(S.fm)) S.fm = 'AF-C';
  if (!SC) return;
  const ls = lensSpec();
  if (S.N < ls.maxN) S.N = O.nearest(apertureList(), ls.maxN);
  const mv = isMovie();
  if (mv && !vidShutters().some((x) => Math.abs(x - S.t) < 1e-9)) S.t = O.nearest(vidShutters(), Math.min(S.t, vidShutters()[0]));
  R = O.solveExposure(mv ? { ...S, tMaxAuto: 1 / S.fps } : S, ls, evSource());
  for (const c of Object.values(C)) c.refresh();
  document.querySelectorAll('#modes button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === S.mode)));
  document.querySelectorAll('#focusModes button').forEach((b) => { b.setAttribute('aria-checked', String(b.dataset.fm === S.fm)); const off = isMovie() && !VIDEO_FM.includes(b.dataset.fm); b.disabled = off; b.title = off ? 'В режиме «Видео» доступны только AF-C и MF' : ''; });
  const areaOn = { wide: areaWide(), point: areaPoint(), track: S.area === 'track' };
  document.querySelectorAll('#focusAreas button').forEach((b) => b.setAttribute('aria-checked', String(areaOn[b.dataset.area])));
  $('lenses').querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.lens === S.lensId)));
  $('swEye').checked = S.eyeAF; $('swSteady').checked = S.steady; $('swTripod').checked = S.tripod; $('swPan').checked = S.pan;
  $('modeNote').textContent = MODE_NOTES[S.mode];
  $('lensNote').textContent = `${lens().name}. ${lens().about} Мин. дистанция фокусировки ${O.fmtDist(lens().minFocus(S.f))}.`;
  drawGrid();

  // индикация в видоискателе
  const ui = $('vfUi');
  ui.classList.toggle('hidden', S.disp === 'none');
  $('vfHist').hidden = S.disp !== 'hist';
  $('oLevel').hidden = S.disp !== 'level';
  const ar = ASPECT[S.aspect], mw = ar < 1.5 ? ar / 1.5 : 1, mh = ar > 1.5 ? 1.5 / ar : 1;
  $('vfMask').hidden = ar === 1.5;
  $('vfMask').style.cssText = `left:${(1 - mw) * 50}%;right:${(1 - mw) * 50}%;top:${(1 - mh) * 50}%;bottom:${(1 - mh) * 50}%`;
  $('oMode').textContent = S.mode === 'AUTO' ? 'iA' : S.mode;
  $('oLens').textContent = `${S.f} мм`;
  $('oAf').textContent = S.fm === 'MF' ? `MF ${O.fmtDist(focusTarget)}` : `${S.fm}${S.eyeAF ? ' 👁' : ''}`;
  $('oMeter').textContent = METER_NAMES[S.meter];
  $('oWb').textContent = WB_TAG[S.wb] || `${wbKelvin()}K`;
  $('oLook').textContent = S.lvOff ? 'VIEW' : S.look;
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
  renderVid();
  updateExplain();
}

function placeFocusFrame() {
  const fe = $('oFocus');
  fe.style.left = `${S.focusUV[0] * 100}%`;
  fe.style.top = `${S.focusUV[1] * 100}%`;
  const zn = $('oZone');
  zn.hidden = S.area !== 'zone' || S.fm === 'MF';
  zn.style.cssText = `left:${S.zoneUV[0] * 100}%;top:${S.zoneUV[1] * 100}%;width:${ZONE_W * 100}%;height:${ZONE_H * 100}%`;
  fe.className = `vf-focus sz-${S.area} ${S.focusColor === 'red' ? 'red' : ''} ${S.fm === 'MF' ? 'mf' : ''} ${focusKind === 'eye' && S.fm !== 'MF' ? 'eye' : ''} ${tracking() && trackRoot ? 'track' : ''} ${focusLocked && focusOk ? 'ok' : ''} ${!focusOk ? 'bad' : ''}`;
}

function drawGrid() {
  const g = $('vfGrid');
  const L = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  let s = '';
  if (!S.gridOn) { g.innerHTML = ''; return; }
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
  if (isMovie()) explainVideo(A);
  else setTile('tBlur', A.shake < 1.5 && !motionBad ? 'ok' : A.shake >= 3 ? 'bad' : 'warn',
    A.shake >= 3 ? 'Шевелёнка!' : A.shake >= 1.5 ? 'Лёгкая шевелёнка' : motionBad ? 'Движение смажется' : S.pan && A.panBg > 5 ? 'Проводка' : 'Резко', `${shakeTxt}${motionTxt}`);
  const iso = R.iso;
  setTile('tNoise', iso <= 6400 ? 'ok' : iso <= 25600 ? 'warn' : 'bad',
    iso <= 1600 ? `ISO ${iso} — чисто` : iso <= 6400 ? `ISO ${iso} — малый шум` : iso <= 25600 ? `ISO ${iso} — шумно` : `ISO ${iso} — сильный шум`,
    'ISO усиливает сигнал матрицы вместе с шумом. α7 IV даёт чистую картинку примерно до ISO 6400.');
  const lk = SC.lightK, k = A.wbK, dk = Math.log2(k / lk);
  setTile('tWb', Math.abs(dk) < 0.25 ? 'ok' : 'warn', `${autoWB(S.wb) ? 'AWB · ' : ''}${k} K`,
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
  snapshot: () => JSON.parse(JSON.stringify(Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, S[k]])))),
  set: (k, v) => setKey(k, v),
  refresh: () => update(),
  act: (a, arg) => {
    if (a === 'gallery') { menu.close(); if (shots.length) openPhoto(0); else toast('Снимков пока нет'); }
    if (a === 'clear' || a === 'clearOld') { shots.length = a === 'clear' ? 0 : Math.min(1, shots.length); renderGallery(); menu.render(); toast(a === 'clear' ? 'Все снимки удалены' : 'Оставлен последний снимок'); }
    if (a === 'recall' && arg) {      // Вызов настр.кам.: настройки, сохранённые в «Регис. настр.кам.»
      Object.assign(S, arg); lockedEV = null; trackRoot = null; touchTrack = false;
      menu.close(); acquireFocus(true); toast('Настройки камеры вызваны');
    }
    if (a === 'reset' || a === 'init') {
      Object.assign(S, DEFAULTS); S.lensId = SC.defaults.lensId; S.f = SC.defaults.f; lockedEV = null; trackRoot = null; touchTrack = false;
      if (a === 'init') { Object.assign(S, VIEW_DEFAULTS); shots.length = 0; renderGallery(); }
      menu.resetStore(a === 'init');
      menu.close(); acquireFocus(true); toast(a === 'init' ? 'Камера инициализирована' : 'Настройки камеры сброшены');
    }
  },
});
$('bMenu').addEventListener('click', () => menu.toggle('menu'));
$('bFn').addEventListener('click', () => menu.toggle('fn'));
$('bAel').addEventListener('click', () => { lockedEV = lockedEV == null ? meterEV : null; update(); toast(lockedEV != null ? 'Экспозиция зафиксирована (AEL)' : 'AEL снят'); });
$('bDisp').addEventListener('click', () => setKey('disp', { all: 'hist', hist: 'level', level: 'none', none: 'all' }[S.disp]));
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
const isUi = (e) => e.target.closest('.cam-menu, .vf-shutter, .vd-chip, .vd-pick');
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
  // касание экрана: что делает — задаёт MENU → Настройка → Сенсорн.управл.
  const tf = S.touch === 'on' ? S.touchFn : 'off';
  if (!down.drag && tf === 'off') toast(S.touch === 'on' ? 'Касание выключено: «Сенс. функ. в съем.» = Выкл' : 'Сенсорное управление выключено в MENU → Настройка');
  else if (!down.drag) {
    const uv = [clamp((e.clientX - r.left) / r.width, 0.04, 0.96), clamp((e.clientY - r.top) / r.height, 0.06, 0.94)];
    const startTrack = S.area === 'track' || (tf === 'track' && S.fm !== 'MF');
    if (S.area !== 'center' || startTrack) S.focusUV = uv;
    if (S.area === 'zone') S.zoneUV = [clamp(uv[0], ZONE_W / 2, 1 - ZONE_W / 2), clamp(uv[1], ZONE_H / 2, 1 - ZONE_H / 2)];
    if (startTrack) {
      const h = hitAt(uv);
      trackRoot = h ? rootOf(h.object) : null;
      touchTrack = S.area !== 'track' && !!trackRoot;
      toast(trackRoot ? `Отслеживание: ${trackRoot === SC.subject.root ? SC.subject.name : SC.movers.find((m) => m.root === trackRoot)?.name || 'объект'}` : 'Отслеживание: объект не выбран');
      if (S.pan) S.yaw = 0;
    }
    if (S.fm !== 'MF') acquireFocus(); else update();
    if (tf === 'shutter') { if (isMovie()) recToggle(); else shoot(); }
  } else if (S.fm !== 'MF') acquireFocus();
  down = null;
  $('vfHint').classList.add('hide');
});

// ───────────────────────── Видео: экранная панель, кадры, мерцание, звук, запись ─────────────────────────
// Справочник ILCE-7M4: частота кадров записи 120p/60p/30p/24p (NTSC) и 100p/50p/25p (PAL), стр. 245, 446;
// выдержка в видео — до 1/4 с. Названия пунктов — как в меню камеры.
const FPS_ALL = [24, 25, 30, 50, 60, 100, 120];
const FPS_PAL = [25, 50, 100];
const fpsSystem = (f) => (FPS_PAL.includes(f) ? 'PAL' : 'NTSC');
const VID_T = O.SHUTTERS.filter((t) => t <= 1 / 4 + 1e-9);
// 100p/120p: выдержка не длиннее кадра (1/100, 1/125)
const vidShutters = () => VID_T.filter((t) => S.fps < 100 || t <= 1 / S.fps + 1e-9);
// выдержка длиннее кадра: камера повторяет кадр — картинка обновляется реже
const vidInterval = () => Math.max(1, Math.ceil(R.t * S.fps - 1e-6)) / S.fps;
const tcBase = (f) => (f === 24 ? 24 : fpsSystem(f) === 'PAL' ? 25 : 30);
const V = { last: -1, rec: false, recT0: 0, tc: 0, dur: 0, recorder: null, chunks: [], type: '', thumb: null, thumbWant: false, track: null,
  flk: null, flkMax: 0, aud: [-60, -60], peak: [-60, -60], peakT: [0, 0], nz: [0, 0], pick: null };

// Мерцание ламп от сети 50 Гц: свет пульсирует 100 раз в секунду. Каждая строка матрицы копит свет за выдержку t;
// строки считываются сверху вниз за READOUT. Если t кратна 1/100 — в каждую строку попадает целое число пульсаций
// и яркость ровная; иначе по кадру идут полосы (при 30p/60p — ползут, при 25p/50p — стоят).
const READOUT = 0.025;          // время считывания кадра, с — учебное значение
const MAINS_DEPTH = 0.95;       // глубина пульсации: натриевые фонари и неон мигают почти до нуля
function flickerAt(tf, t) {
  if (!SC.mains) return null;
  const f = 2 * SC.mains, x = Math.PI * f * t;
  // ×1,8 — усилено для наглядности на маленьком экране телефона (на камере полосы так же видны в движении)
  const amp = clamp(1.8 * MAINS_DEPTH * Math.sin(x) / x, -0.92, 0.92);
  if (Math.abs(amp) < 0.006) return null;
  return { amp, phase: (((f * (tf + t / 2)) % 1) + 1) % 1, bands: f * READOUT };
}
const flickerAmp = (t = R.t) => (SC?.mains ? Math.abs(MAINS_DEPTH * Math.sin(Math.PI * 2 * SC.mains * t) / (Math.PI * 2 * SC.mains * t)) : 0);

// Сколько подкадров нужно, чтобы смаз за выдержку был сплошным (не «двоился»)
function vidSubframes(t) {
  const coc2px = O.SENSOR.coc / 36 * pipe.w;
  const pm = S.pan ? panMover() : null;
  let px = 0;
  for (const m of SC.movers) {
    const a = m.anchor(), dist = Math.max(1, a.distanceTo(camera.position));
    if (!inFrameUV(projectUV(a), -0.25)) continue;
    px = Math.max(px, O.motionBlurMm(S.f, m === pm ? m.speed * 0.04 : m.speed, dist, t) / O.SENSOR.coc * coc2px);
    if (m === pm) px = Math.max(px, (S.f * (m.speed / dist) * t) / O.SENSOR.coc * coc2px);
  }
  const fpsEff = Math.min(60, 1 / vidInterval());
  const kMax = Math.max(1, Math.floor((mobile ? 110 : 360) / fpsEff));
  return clamp(Math.ceil(px / 5), 1, Math.min(kMax, mobile ? 5 : 12));
}

function renderVideoFrame(tf) {
  const t = R.t, K = vidSubframes(t), pm = S.pan ? panMover() : null;
  const p = liveParams();
  p.flk = flickerAt(tf, t);
  V.flk = p.flk;
  pipe.renderVideo(SC.scene, camera, p, {
    frames: K,
    step: (k) => {
      SC.update(tf + (k / K) * t, { streakDt: t / K });
      SC.scene.updateMatrixWorld();
      if (pm) S.yaw = followYaw(pm);
      placeCamera();
    },
  });
  if (V.rec) {
    V.flkMax = Math.max(V.flkMax, Math.abs(p.flk?.amp || 0));
    V.track?.requestFrame?.();
    if (V.thumbWant) { V.thumbWant = false; try { V.thumb = canvas.toDataURL('image/jpeg', 0.8); } catch (e) { V.thumb = null; } }
  }
}

// ── экранная панель ──
const AREA_OPTS = [['wide', 'Широкая'], ['zone', 'Зонная фокус.'], ['center', 'Фиксац. центра'], ['spotS', 'Пятно: S'], ['point', 'Пятно: M'], ['spotL', 'Пятно: L'], ['spotX', 'Расшир. пятно'], ['track', 'Отслеживание']];
const AREA_SHORT = { wide: 'Широкая', zone: 'Зона', center: 'Центр', spotS: 'Пятно S', point: 'Пятно M', spotL: 'Пятно L', spotX: 'Расш. пятно', track: 'Отслеж.' };
const ico = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">${d}</svg>`;
const AREA_ICO = {
  wide: ico('<path d="M3 8V4h4M17 4h4v4M21 16v4h-4M7 20H3v-4"/>'),
  zone: ico('<path d="M3 8V4h4M17 4h4v4M21 16v4h-4M7 20H3v-4"/><path d="M8 9h8M8 12h8M8 15h8" stroke-dasharray="1.5 2.5"/>'),
  center: ico('<rect x="8" y="9" width="8" height="6" rx="1"/><path d="M12 3v3M12 18v3"/>'),
  spot: ico('<rect x="8.5" y="9.5" width="7" height="5" rx="1"/>'),
  spotX: ico('<rect x="8.5" y="9.5" width="7" height="5" rx="1"/><rect x="5" y="6.5" width="14" height="11" rx="2" stroke-dasharray="2 2.5"/>'),
  track: ico('<rect x="5" y="6" width="14" height="12" rx="2"/><circle cx="12" cy="12" r="2" fill="currentColor"/>'),
};
const areaIco = (a) => AREA_ICO[a] || AREA_ICO.spot;
const WB_OPTS = [['AWB', 'Авто'], ['AWBa', 'Авто: Атмосф.'], ['AWBw', 'Авто: Белый'], ['day', 'Дневной свет'], ['shade', 'Тень'], ['cloudy', 'Облачно'], ['tungsten', 'Лампа накал.'],
  ['fluorWW', 'Флуор.:Теп.бел.'], ['fluorCW', 'Флуор.:Хол.бел'], ['fluorDW', 'Флуор.: Дн.бел.'], ['fluorD', 'Флуор.: Дн.свет'], ['flash', 'Вспышка'], ['K', 'Цв.тмп./Ф-тр.']];
const WB_K_LIST = [2500, 2800, 3000, 3200, 3600, 4000, 4500, 5000, 5500, 6000, 6500, 7500, 8500, 9900];
const WB_SHORT = { AWB: 'AWB', AWBa: 'AWB A', AWBw: 'AWB W', day: 'Дн. свет', shade: 'Тень', cloudy: 'Облачно', tungsten: 'Лампа', fluorWW: 'Флуор.', fluorCW: 'Флуор.', fluorDW: 'Флуор.', fluorD: 'Флуор.', flash: 'Вспышка', uw: 'AWB ≈', c1: 'C1', c2: 'C2', c3: 'C3' };
const modeName = (m) => (m === 'AUTO' ? 'iA' : m);
const near = (a, b) => (typeof a === 'number' && typeof b === 'number' ? Math.abs(Math.log(a) - Math.log(b)) < 1e-3 : a === b);
// lock() — почему значение сейчас нельзя менять: [текст, ключ, значение, подпись кнопки]
const PICK = {
  mode: { title: 'Режим экспозиции', opts: () => ['AUTO', 'P', 'A', 'S', 'M'].map((v) => [v, modeName(v)]), cur: () => S.mode, set: (v) => setKey('mode', v),
    note: () => 'S — вы задаёте выдержку, M — всё сами. Для видео чаще всего M.' },
  fm: { title: 'Режим фокусир.', opts: () => [['AF-C', 'Непрерывн. AF'], ['MF', 'Ручной фокус']], cur: () => S.fm, set: (v) => setKey('fm', v),
    note: () => 'В видео камера даёт только непрерывный AF или ручной фокус.' },
  area: { title: 'Область фокус.', opts: () => AREA_OPTS, cur: () => S.area, set: (v) => setKey('area', v),
    note: () => (S.area === 'zone' ? 'Нажмите в кадре — зона встанет туда.' : areaWide() ? 'Камера сама выбирает, на что наводиться.' : S.area === 'track' ? 'Нажмите на объект — камера поведёт его по кадру.' : 'Нажмите в кадре — туда встанет рамка фокуса.'),
    lock: () => (S.fm === 'MF' ? ['При ручном фокусе область не используется.', 'fm', 'AF-C', 'Включить AF-C'] : null) },
  wb: { title: 'Баланс белого', opts: () => WB_OPTS, cur: () => S.wb, set: (v) => setKey('wb', v),
    row2: () => (S.wb === 'K' ? { opts: WB_K_LIST.map((k) => [k, `${k}K`]), cur: () => S.wbK, set: (k) => { S.wbK = k; setKey('wb', 'K'); } } : null),
    note: () => `Свет сцены ≈ ${SC.lightK} K. ${S.wb === 'K' ? 'Меньше кельвинов — кадр холоднее, больше — теплее.' : 'Цв.тмп. — задать кельвины вручную.'}` },
  fps: { title: 'Част. кадров зап.', opts: () => FPS_ALL.map((f) => [f, `${f}p`, fpsSystem(f)]), cur: () => S.fps, set: (v) => setKey('fps', v),
    note: () => (S.fps >= 100 ? 'Экран показывает до 60 кадров в секунду — 100p/120p нужны для замедления в монтаже.' : 'Смотрите на движущиеся объекты: меньше кадров — движение «шагает».'),
    lock: () => (V.rec ? ['Во время записи частоту кадров не изменить.', null] : null) },
  t: { title: 'Выдержка', opts: () => vidShutters().map((t) => [t, O.fmtShutter(t)]), cur: () => R.t, set: (v) => { S.t = v; onChange(); },
    note: () => (SC.mains ? 'Под фонарями (сеть 50 Гц) без полос — 1/50 или 1/100.' : 'Длиннее — мягкий смаз движения, короче — чёткие «рваные» фазы.'),
    lock: () => (S.mode === 'S' || S.mode === 'M' ? null : [`В режиме ${modeName(S.mode)} выдержку подбирает камера.`, 'mode', 'S', 'Режим S']) },
  N: { title: 'Диафрагма', opts: () => apertureList().map((n) => [n, O.fmtF(n)]), cur: () => R.N, set: (v) => { S.N = v; onChange(); },
    note: () => 'Меньше число F — больше света и сильнее размыт фон.',
    lock: () => (S.mode === 'A' || S.mode === 'M' ? null : [`В режиме ${modeName(S.mode)} диафрагму подбирает камера.`, 'mode', 'M', 'Режим M']) },
  iso: { title: 'ISO', opts: () => ISO_LIST.map((v) => [v, v === 'AUTO' ? 'ISO AUTO' : String(v)]), cur: () => (S.mode === 'AUTO' ? 'AUTO' : S.iso), set: (v) => { S.iso = v; onChange(); },
    note: () => `Сейчас ISO ${R.iso}. Выше ISO — светлее и шумнее.`,
    lock: () => (S.mode === 'AUTO' ? ['В режиме iA ISO подбирает камера.', 'mode', 'M', 'Режим M'] : null) },
  ec: { title: 'Экспокоррекция', opts: () => O.ECS.map((v) => [v, O.fmtEV(v)]), cur: () => S.ec, set: (v) => { S.ec = v; onChange(); },
    note: () => 'Камера держит экспозицию сама, а вы просите светлее (+) или темнее (−).',
    lock: () => (S.mode === 'AUTO' ? ['В режиме iA экспокоррекции нет.', 'mode', 'P', 'Режим P']
      : S.mode === 'M' && S.iso !== 'AUTO' ? ['В M шкала M.M. показывает, насколько кадр светлее или темнее замера. Меняйте выдержку, диафрагму или ISO.', null] : null) },
};

function chipHtml() {
  const vu = $('vidUi');
  vu.innerHTML = `
    <div class="vd-top">
      <button class="vd-chip vd-mode" data-p="mode" aria-label="Режим экспозиции">${ico('<rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 11l5-3v8l-5-3z"/>')}<b id="vMode"></b></button>
      <span class="vd-rec" id="vRec"><i></i><b>STBY</b></span>
      <span class="vd-tc" id="vTc">00:00:00:00</span>
      <span class="vd-fmt" id="vFmt"></span>
      <span class="vd-flk" id="vFlk" hidden></span>
      <div class="vd-aud" id="vAud" aria-label="Уровень звука"><span><em>1</em><i><s></s><u></u></i></span><span><em>2</em><i><s></s><u></u></i></span></div>
    </div>
    <div class="vd-left">
      <button class="vd-chip" data-p="fm"><small>Фокус</small><b id="vFm"></b></button>
      <button class="vd-chip" data-p="area"><small>Область</small><b id="vArea"></b></button>
      <button class="vd-chip" data-p="wb"><small>ББ</small><b id="vWb"></b></button>
    </div>
    <button class="vd-chip vd-meter" data-p="ec" aria-label="Экспонометр"><small id="vMeterL">M.M.</small><span class="vd-scale"><i class="vd-ticks"></i><i class="vd-ptr" id="vPtr"></i></span><b id="vMeterV"></b></button>
    <div class="vd-bottom">
      <button class="vd-chip" data-p="fps"><small>Кадр/с</small><b id="vFps"></b></button>
      <button class="vd-chip" data-p="t"><small>Выдержка</small><b id="vT"></b></button>
      <button class="vd-chip" data-p="N"><small>Диафр.</small><b id="vN"></b></button>
      <button class="vd-chip" data-p="iso"><small>ISO</small><b id="vIso"></b></button>
    </div>
    <div class="vd-pick" id="vPick" hidden></div>`;
  vu.querySelectorAll('.vd-chip').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); openPick(V.pick === b.dataset.p ? null : b.dataset.p); }));
}

function renderVid() {
  const mv = isMovie();
  vf.classList.toggle('movie', mv);
  $('vidUi').hidden = !mv || S.disp === 'none';
  $('shutter').classList.toggle('rec', mv);
  $('shutter').classList.toggle('on', mv && V.rec);
  $('shutter').setAttribute('aria-label', mv ? (V.rec ? 'Остановить запись (пробел)' : 'Начать запись видео (пробел)') : 'Сделать снимок (пробел)');
  $('shutter').title = mv ? 'REC — запись видео (пробел)' : 'Спуск затвора (пробел)';
  document.querySelectorAll('[data-pm]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.pm === 'movie') === mv)));
  $('tVid').hidden = !mv;
  if (!mv) { if (V.pick) openPick(null); return; }
  $('vMode').textContent = modeName(S.mode);
  $('vRec').classList.toggle('on', V.rec);
  $('vRec').querySelector('b').textContent = V.rec ? 'REC' : 'STBY';
  $('vFmt').textContent = `${S.fps >= 100 ? 'HD' : '4K'} ${S.fps}p`;
  $('vFm').textContent = S.fm;
  $('vArea').innerHTML = `${areaIco(S.area)}${AREA_SHORT[S.area] || S.area}`;
  $('vWb').textContent = S.wb === 'K' ? `${S.wbK}K` : WB_SHORT[S.wb] || S.wb;
  $('vFps').textContent = `${S.fps}p`;
  $('vT').textContent = O.fmtShutter(R.t);
  $('vN').textContent = O.fmtF(R.N);
  $('vIso').textContent = `${R.isoAuto ? 'AUTO ' : ''}${R.iso}`;
  // экспонометр: в M с ручным ISO — отклонение от замера (M.M.), в остальных — поправка, которую держит камера
  const manualMeter = S.mode === 'M' && !R.isoAuto;
  $('vMeterL').textContent = manualMeter ? 'M.M.' : 'Эксп.';
  $('vMeterV').textContent = O.fmtEV(manualMeter ? R.offset : R.ec);
  $('vPtr').style.left = `${50 + clamp(R.offset, -5, 5) * 10}%`;
  $('vPtr').classList.toggle('over', Math.abs(R.offset) > 5);
  $('vMeterV').classList.toggle('warn', manualMeter && Math.abs(R.offset) > 2);
  const fl = SC?.mains;
  $('vFlk').hidden = !fl;
  if (fl) { const a = flickerAmp(); $('vFlk').textContent = `Свет ${fl} Гц`; $('vFlk').classList.toggle('bad', a > 0.006); $('vFlk').title = a > 0.006 ? 'Выдержка не кратна 1/100 — мерцание' : 'Выдержка кратна 1/100 — без мерцания'; }
  vf.querySelectorAll('.vd-chip').forEach((b) => b.classList.toggle('on', b.dataset.p === V.pick));
  $('vAud').hidden = !S.audioShow;
  $('vAud').classList.toggle('off', !S.audioOn);
  if (V.pick) refreshPick();
}

function openPick(id) {
  V.pick = id;
  const el = $('vPick');
  vf.querySelectorAll('.vd-chip').forEach((b) => b.classList.toggle('on', b.dataset.p === id));
  vf.classList.toggle('picking', !!id);
  if (!id) { el.hidden = true; el.innerHTML = ''; return; }
  const P = PICK[id];
  const list = (opts, rowId) => `<div class="vd-pl" data-row="${rowId}">${opts.map(([, l, sub], i) => `<button data-i="${i}">${l}${sub ? `<small>${sub}</small>` : ''}</button>`).join('')}</div>`;
  const r2 = P.row2?.();
  el.innerHTML = `<div class="vd-ph"><b>${P.title}</b><span class="vd-pn"></span><button class="vd-px" aria-label="Закрыть">✕</button></div>${list(P.opts(), 1)}${r2 ? list(r2.opts, 2) : ''}<div class="vd-plock" hidden><span></span><button></button></div>`;
  el.hidden = false;
  el.querySelector('.vd-px').addEventListener('click', (e) => { e.stopPropagation(); openPick(null); });
  el.querySelectorAll('.vd-pl').forEach((row) => row.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    e.stopPropagation();
    const P2 = PICK[V.pick], lk = P2.lock?.();
    if (lk) { toast(lk[0]); return; }
    const rr = row.dataset.row === '2' ? P2.row2() : null;
    const [v] = (rr ? rr.opts : P2.opts())[+b.dataset.i];
    (rr ? rr.set : P2.set)(v);
    if (P2.row2 && !rr) openPick(V.pick); else refreshPick();
  }));
  el.querySelector('.vd-plock button').addEventListener('click', (e) => {
    e.stopPropagation();
    const lk = PICK[V.pick].lock?.();
    if (lk?.[1]) { setKey(lk[1], lk[2]); refreshPick(); }
  });
  refreshPick(true);
}
function refreshPick(scroll = false) {
  const el = $('vPick'), P = PICK[V.pick];
  if (!P || el.hidden) return;
  const lk = P.lock?.();
  el.classList.toggle('locked', !!lk);
  el.querySelector('.vd-pn').textContent = P.note?.() || '';
  const lb = el.querySelector('.vd-plock');
  lb.hidden = !lk;
  if (lk) { lb.querySelector('span').textContent = lk[0]; lb.querySelector('button').hidden = !lk[1]; lb.querySelector('button').textContent = lk[3] || ''; }
  const mark = (row, opts, cur) => {
    if (!row) return;
    let on = null;
    row.querySelectorAll('button').forEach((b, i) => { const x = near(opts[i][0], cur); b.classList.toggle('on', x); if (x) on = b; });
    if (scroll && on) row.scrollLeft = on.offsetLeft - row.clientWidth / 2 + on.offsetWidth / 2;
  };
  mark(el.querySelector('[data-row="1"]'), P.opts(), P.cur());
  const r2 = P.row2?.();
  if (r2) mark(el.querySelector('[data-row="2"]'), r2.opts, r2.cur());
}

// ── таймкод и индикатор уровня звука: шум сцены + проезжающие объекты; «Уров. записи звука» 26 — исходный ──
function vidTick(now, dt) {
  if (V.rec) {
    const sec = V.tc + (now - V.recT0) / 1000, b = tcBase(S.fps);
    const ff = Math.floor((sec % 1) * b), ss = Math.floor(sec) % 60, mm = Math.floor(sec / 60) % 60, hh = Math.floor(sec / 3600);
    $('vTc').textContent = [hh, mm, ss, ff].map((x) => String(x).padStart(2, '0')).join(':');
    if (now - V.recT0 > 60000) { recStop(); toast('Запись остановлена: в тренажёре клип — до 60 секунд'); }
  }
  if (frameNo % 2) return;
  let base = SC.audioDb ?? -36;
  const loud = SC.id === 'night' ? -6 : SC.id === 'stadium' ? -12 : -16;
  for (const m of SC.movers) base = Math.max(base, loud - 20 * Math.log10(Math.max(2, m.anchor().distanceTo(camera.position)) / 2));
  const gain = (S.audioLvl - 26) * 1.2;
  const nowS = now / 1000;
  for (let c = 0; c < 2; c++) {
    V.nz[c] += ((Math.random() - 0.5) * 14 - V.nz[c]) * 0.35;
    const target = S.audioOn ? clamp(base + gain + V.nz[c] + (c ? -1.2 : 0), -60, 0) : -60;
    V.aud[c] += (target - V.aud[c]) * Math.min(1, dt * (target > V.aud[c] ? 30 : 8));
    if (V.aud[c] >= V.peak[c] || nowS - V.peakT[c] > 1.2) { V.peak[c] = V.aud[c]; V.peakT[c] = nowS; }
  }
  const pct = (db) => `${clamp((db + 48) / 48, 0, 1) * 100}%`;
  $('vAud').querySelectorAll('span').forEach((sp, c) => {
    sp.querySelector('s').style.width = pct(V.aud[c]);
    sp.querySelector('u').style.left = pct(V.peak[c]);
    sp.classList.toggle('clip', V.peak[c] > -1);
  });
}

// ── запись: REC — кадры с экрана пишутся в видеофайл (если браузер умеет) ──
function recToggle() {
  if (!isMovie() || menu.open) return;
  if (V.rec) { recStop(); return; }
  if (V.pick) openPick(null);
  V.rec = true; V.recT0 = performance.now(); V.flkMax = 0; V.thumbWant = true; V.thumb = null; V.chunks = []; V.recorder = null;
  try {
    const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    V.type = window.MediaRecorder ? types.find((x) => MediaRecorder.isTypeSupported?.(x)) || '' : '';
    if (V.type && canvas.captureStream) {
      const stream = canvas.captureStream(0);
      V.track = stream.getVideoTracks()[0];
      V.recorder = new MediaRecorder(stream, { mimeType: V.type, videoBitsPerSecond: mobile ? 6e6 : 12e6 });
      V.recorder.ondataavailable = (e) => { if (e.data.size) V.chunks.push(e.data); };
      V.recorder.onstop = saveClip;
      V.recorder.start(1000);
    }
  } catch (e) { V.recorder = null; }
  V.last = -1;
  update();
}
function recStop() {
  if (!V.rec) return;
  V.rec = false;
  V.dur = (performance.now() - V.recT0) / 1000;
  V.tc += V.dur;
  V.track = null;
  if (V.recorder && V.recorder.state !== 'inactive') V.recorder.stop(); else saveClip();
  update();
}
function saveClip() {
  const blob = V.chunks.length ? new Blob(V.chunks, { type: V.type.split(';')[0] }) : null;
  V.chunks = []; V.recorder = null;
  const st = { ...S }, res = { ...R };
  const clip = { kind: 'clip', url: V.thumb || '', video: blob ? URL.createObjectURL(blob) : null, ext: V.type.includes('mp4') ? 'mp4' : 'webm',
    st, res, dur: V.dur, flk: V.flkMax, mains: SC.mains, mainsName: SC.mainsName, sceneId: SC.id, A: analyse(st, res, focusTarget), focus: focusTarget, n: shots.length + 1 };
  shots.unshift(clip);
  renderGallery();
  toast(blob ? `Видео ${fmtDur(V.dur)} сохранено — в «Снимки»` : 'Запись остановлена. Этот браузер не умеет сохранять видео с экрана — файл не создан.');
}
const fmtDur = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// Пояснения в режиме видео: плавность и смаз движения, мерцание
function explainVideo(A) {
  const fps = S.fps, t = R.t, iv = vidInterval();
  const m = A.movers.filter((x) => x.inFrame).sort((a, b) => b.motion - a.motion)[0];
  const rep = iv > 1 / fps + 1e-6 ? ` Выдержка длиннее кадра — камера повторяет кадры, картинка обновляется ${Math.round(1 / iv)} раз в секунду.` : '';
  const base = fpsSystem(fps) === 'PAL' ? 25 : 30;
  const how = fps >= 100 ? `${fps}p — запас для замедления: в монтаже на ${base}p движение станет в ${Math.round(fps / base)} раза медленнее. Экран показывает до 60 кадров в секунду.`
    : fps >= 50 ? `${fps}p — ${fps} кадров в секунду: движение плавное.` : `${fps}p — ${fps} кадр${fps === 24 ? 'а' : 'ов'} в секунду: привычная «киношная» плавность.`;
  if (!m) setTile('tBlur', 'ok', `${fps}p`, `${how} Сейчас в кадре ничего не движется — плавность видна, когда кто-то проходит мимо или вы поворачиваете камеру.${rep}`);
  else {
    const name = m.name[0].toUpperCase() + m.name.slice(1);
    const strobe = t * fps < 0.2 && m.motion > 0.5;
    const look = strobe ? 'в каждом кадре он резкий, а между кадрами «прыгает» — движение выглядит рваным' : m.motion > 2 ? 'в каждом кадре лёгкий смаз — движение выглядит плавным, как привык видеть глаз' : 'смаза почти нет';
    setTile('tBlur', strobe ? 'warn' : 'ok', strobe ? 'Рваное движение' : m.motion > 2 ? 'Мягкий смаз' : `${fps}p`,
      `${how} ${name} за ${O.fmtShutter(t)} сместится на ${fmtLen(m.moveCm)} — ${look}.${rep}`);
  }
  if (!SC.mains) {
    setTile('tVid', 'ok tile-wide', 'Свет без мерцания', 'Солнце светит ровно — полос и пульсации не будет при любой выдержке. Мерцание появляется под лампами: откройте сцену «Улица».');
    return;
  }
  const a = flickerAmp(), step = ((100 * iv) % 1 + 1) % 1, rolling = step > 0.02 && step < 0.98;
  const src = SC.mainsName[0].toUpperCase() + SC.mainsName.slice(1);
  if (a <= 0.006) setTile('tVid', 'ok tile-wide', 'Без мерцания', `${src} питаются от сети 50 Гц и мигают 100 раз в секунду. Выдержка ${O.fmtShutter(t)} кратна 1/100: каждая строка кадра собирает целое число вспышек — яркость ровная.`);
  else setTile('tVid', a > 0.12 ? 'bad tile-wide' : 'warn tile-wide', `Мерцание: ${rolling ? 'полосы ползут' : 'полосы стоят'}`,
    `${src} мигают 100 раз в секунду (сеть 50 Гц). Выдержка ${O.fmtShutter(t)} не кратна 1/100 — строки кадра получают разный свет, по кадру идут полосы${rolling ? `, а при ${fps}p они ещё и ползут` : ''}. Поставьте 1/50 или 1/100${fpsSystem(fps) === 'NTSC' ? ` или перейдите на ${{ 24: 25, 30: 25, 60: 50, 120: 100 }[fps]}p` : ''}.`);
}

chipHtml();
// на телефоне видна одна кнопка — текущий режим; нажатие переключает на другой
document.querySelectorAll('[data-pm]').forEach((b) => b.addEventListener('click', () => {
  let on = b.dataset.pm === 'movie';
  if (on === isMovie()) { if (document.querySelector(`[data-pm="${on ? 'photo' : 'movie'}"]`).offsetParent) return; on = !on; }
  if (!on) { recStop(); openPick(null); }
  menu.setMovie(on);
  toast(on ? 'Видео: параметры меняются касанием прямо на экране' : 'Фото');
}));

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
    const d = S.drive;
    if (d === 'timer' || d === 'timerC') {
      for (let s = S.timerSec; s > 0; s--) { $('vfCount').textContent = s; $('vfCount').hidden = false; await sleep(1000); }
      $('vfCount').hidden = true;
    }
    // каждый кадр серии: сдвиг экспозиции (брекетинг), баланса белого (в майредах) или уровень DRO
    const st = S.brStep, ev = (x) => `${x > 0 ? '+' : x < 0 ? '−' : '±'}${O.fmtEV(Math.abs(x)).replace(/^[+±]/, '')} EV`;
    let plan = [{}], dt = 0.1;
    if (d === 'burst') { plan = Array(5).fill({}); dt = 1 / S.burstFps; }
    if (d === 'timerC') plan = Array(3).fill({});
    if (d === 'bracketC') plan = [0, -st, st].map((x) => ({ ec: x, tag: `брекетинг ${ev(x)}` }));
    if (d === 'bracketS') { const x = [0, -st, st][brIdx]; plan = [{ ec: x, tag: `брекетинг ${brIdx + 1}/3: ${ev(x)}` }]; brIdx = (brIdx + 1) % 3; }
    if (d === 'bracketWB') plan = [0, -20, 20].map((m) => ({ mired: m, tag: `брекетинг ББ ${m ? (m > 0 ? 'холоднее' : 'теплее') : 'исходный'}` }));
    if (d === 'bracketDRO') plan = [0, 0.5, 1].map((x) => ({ dro: x, tag: `брекетинг DRO ${['выкл', 'Lo', 'Hi'][x * 2]}` }));
    const t0 = performance.now() / 1000;
    for (let i = 0; i < plan.length; i++) { await captureOne(t0 + i * dt, plan[i]); await sleep(16); }
    if (S.review) showReview(shots[0].url, S.review);
  } finally {
    document.querySelectorAll('.shutter').forEach((b) => b.classList.remove('busy'));
    busy = false;
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let brIdx = 0;                        // номер кадра в покадровом брекетинге
// Экспозиция кадра брекетинга: в M с ручным ISO сдвигается выдержка, иначе — как экспокоррекция
function bracketRes(shift) {
  if (S.mode === 'M' && S.iso !== 'AUTO') return O.solveExposure({ ...S, t: O.nearest(O.SHUTTERS, S.t * 2 ** shift) }, lensSpec(), evSource());
  return O.solveExposure({ ...S, ec: S.ec + shift }, lensSpec(), evSource());
}
let reviewT = 0;
function showReview(url, sec) {
  const el = $('vfReview');
  el.src = url; el.hidden = false;
  clearTimeout(reviewT);
  reviewT = setTimeout(() => { el.hidden = true; }, sec * 1000);
}
$('vfReview').addEventListener('pointerdown', (e) => { e.stopPropagation(); $('vfReview').hidden = true; });
function cropAspect(c, a) {
  const r = ASPECT[a];
  if (r === 1.5) return c;
  const w = r < 1.5 ? Math.round(c.height * r) : c.width, h = r > 1.5 ? Math.round(c.width / r) : c.height;
  const o = document.createElement('canvas');
  o.width = w; o.height = h;
  o.getContext('2d').drawImage(c, (c.width - w) / 2, (c.height - h) / 2, w, h, 0, 0, w, h);
  return o;
}

async function captureOne(t0, mod = {}) {
  SC.update(t0);
  SC.scene.updateMatrixWorld(true);
  if (S.pan) { const m = panMover(); if (m) S.yaw = followYaw(m); }
  if (S.fm !== 'MF') acquireFocus(true); else focusCur = focusTarget;
  placeCamera();
  const st = { ...S }, res = mod.ec ? bracketRes(mod.ec) : { ...R }, focus = focusTarget;
  if (mod.ec && !(S.mode === 'M' && S.iso !== 'AUTO')) st.ec = S.ec + mod.ec;
  if (mod.dro != null) st.dro = mod.dro;
  const A = analyse(st, res, focus);
  if (mod.mired) A.wbK = Math.round(1e6 / (1e6 / A.wbK + mod.mired));
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
  const out = pipe.capture(SC.scene, camera, { f: st.f, N: res.N, focus, iso: res.iso, gain: gainFor(res), wb: O.wbGains(A.wbK), look: st.look, dro: st.dro, nr: st.nr }, {
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
  const face = faceBrightness(out, faceUV, st.f, A);
  const shot = { url: cropAspect(out, st.aspect).toDataURL('image/jpeg', 0.92), st, res, focus, A, n: shots.length + 1, sceneId: SC.id, face, tag: mod.tag };
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

$('shutter').addEventListener('click', (e) => { e.stopPropagation(); if (isMovie()) recToggle(); else shoot(); });
// Пробел — спуск. Не мешаем только вводу текста и кнопкам, выбранным с клавиатуры.
document.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || menu.open || $('photo').open || document.body.classList.contains('touring')) return;
  const a = document.activeElement;
  if (a && (['TEXTAREA', 'SELECT'].includes(a.tagName) || (a.tagName === 'INPUT' && a.type !== 'range' && a.type !== 'checkbox') || (a.tagName === 'BUTTON' && a.matches(':focus-visible')))) return;
  e.preventDefault();
  if (isMovie()) recToggle(); else shoot();
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
  lockedEV = null; trackRoot = null; touchTrack = false;
  loadScene(ms.scene, { keep: false });
  if (ms.setup) { Object.assign(S, ms.setup); acquireFocus(true); }
  missionsOpen = false;                       // список сворачивается, остаётся только текущее задание
  renderMissions();
  toast(`Задание: ${ms.title}`);
  if (mobile) $('vfWrap').scrollIntoView({ behavior: 'smooth' });
}

// ───────────────────────── Галерея и разбор снимка ─────────────────────────
const exifLine = (s) => (s.kind === 'clip' ? `▶ ${s.st.fps}p · ${O.fmtShutter(s.res.t)} · ${fmtDur(s.dur)}` : `${s.st.f} мм · ${O.fmtF(s.res.N)} · ${O.fmtShutter(s.res.t)} · ISO ${s.res.iso}`);
function renderGallery() {
  $('shotCount').textContent = shots.length ? `(${shots.length})` : '';
  $('gallery').innerHTML = shots.length
    ? shots.map((s, i) => `<button data-i="${i}"${s.kind === 'clip' ? ' class="clip"' : ''}><img src="${s.url}" alt="${s.kind === 'clip' ? 'Видео' : 'Снимок'} ${s.n}"><i>${s.mission ? (s.mission.pass ? '✓ ' : '✗ ') : ''}${exifLine(s)}</i></button>`).join('')
    : '<p class="note">Здесь появятся ваши кадры с разбором настроек.</p>';
  $('gallery').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => openPhoto(+b.dataset.i)));
  if (shots[0]) $('bPlay').style.backgroundImage = `url(${shots[0].url})`;
}

function notesForClip(s) {
  const n = [], A = s.A, fps = s.st.fps, t = s.res.t;
  const target = s.st.mode === 'M' && !s.res.isoAuto ? 0 : s.res.ec;
  n.push([Math.abs(s.res.offset - target) < 0.34 ? 'ok' : Math.abs(s.res.offset) < 1.5 ? 'warn' : 'bad', Math.abs(s.res.offset - target) < 0.34 ? 'Экспозиция по замеру в норме.' : `Видео ${s.res.offset > 0 ? 'светлее' : 'темнее'} замера на ${Math.abs(s.res.offset).toFixed(1).replace('.', ',')} EV.`]);
  if (s.mains) n.push(s.flk > 0.006 ? ['bad', `Мерцание: ${s.mainsName} мигают 100 раз в секунду, а выдержка ${O.fmtShutter(t)} не кратна 1/100 — по кадру шли полосы. Нужна 1/50 или 1/100.`] : ['ok', `Без мерцания: выдержка ${O.fmtShutter(t)} кратна 1/100.`]);
  const m = A.movers.filter((x) => x.inFrame).sort((a, b) => b.motion - a.motion)[0];
  if (m) n.push(t * fps < 0.2 && m.motion > 0.5 ? ['warn', `${m.name[0].toUpperCase() + m.name.slice(1)} при ${O.fmtShutter(t)} резкий в каждом кадре — движение «рваное». Для плавности выдержку делают длиннее, например 1/${fps >= 50 ? 100 : 50}.`] : ['ok', `${fps}p, ${O.fmtShutter(t)}: движение ${m.motion > 2 ? 'с лёгким смазом, плавное' : 'чёткое'}.`]);
  n.push([A.subjSharp ? 'ok' : 'bad', A.subjSharp ? `${A.subjName[0].toUpperCase() + A.subjName.slice(1)} в фокусе.` : `${A.subjName[0].toUpperCase() + A.subjName.slice(1)} вне зоны резкости.`]);
  if (s.res.iso > 6400) n.push(['warn', `ISO ${s.res.iso}: шум заметен.`]);
  return n;
}
function notesFor(s) {
  if (s.kind === 'clip') return notesForClip(s);
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
  const s = shots[cur], clip = s.kind === 'clip';
  const pv = $('phVid');
  pv.pause();
  $('phImg').hidden = clip && !!s.video;
  pv.hidden = !(clip && s.video);
  if (clip && s.video) { pv.src = s.video; pv.poster = s.url; } else pv.removeAttribute('src');
  $('phImg').src = s.url;
  $('phDl').hidden = clip && !s.video;
  $('phDl').href = clip ? s.video || '' : s.url;
  $('phDl').download = clip ? `a7iv_C${String(s.n).padStart(4, '0')}.${s.ext}` : `a7iv_${String(s.n).padStart(3, '0')}.jpg`;
  if (clip) {
    $('phExif').innerHTML = `<b>Видео ${s.n}</b> · ${fmtDur(s.dur)}<br>${lensById(s.st.lensId).name}<br>${s.st.fps >= 100 ? 'HD' : '4K'} ${s.st.fps}p · ${O.fmtShutter(s.res.t)} · ${O.fmtF(s.res.N)} · ISO ${s.res.iso} · ${modeName(s.st.mode)}<br>ББ ${WB_TAG[s.st.wb] ? `${WB_TAG[s.st.wb]} ` : ''}${s.A.wbK} K · фокус ${O.fmtDist(s.focus)}`;
    $('phMission').innerHTML = '';
    $('phNotes').innerHTML = notesFor(s).map(([c, t]) => `<li class="${c}">${t}</li>`).join('');
    if (s.url) drawHist(s.url);
    if (!$('photo').open) $('photo').showModal();
    return;
  }
  $('phExif').innerHTML = `<b>Снимок ${s.n}</b><br>${lensById(s.st.lensId).name}<br>${exifLine(s)} · ${s.st.mode === 'AUTO' ? 'iA' : s.st.mode}<br>ББ ${WB_TAG[s.st.wb] ? `${WB_TAG[s.st.wb]} ` : ''}${s.A.wbK} K${s.tag ? ` · ${s.tag}` : ''} · ${s.st.look} · замер «${METER_NAMES[s.st.meter]}»<br>Фокус ${O.fmtDist(s.focus)}`;
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
$('photo').addEventListener('close', () => $('phVid').pause());
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
  if (!document.hidden && !busy && SC && !window.__simHold) {      // __simHold — только для покадровой записи
    SC.update(now / 1000);
    SC.scene.updateMatrixWorld();
    if (S.pan) { const m = panMover(); if (m) S.yaw = followYaw(m); }
    if (afc() && frameNo % 4 === 0) acquireFocusQuiet();
    focusCur = Math.exp(Math.log(focusCur) + (Math.log(focusTarget) - Math.log(focusCur)) * Math.min(1, dt * 9));
    const locked = S.fm !== 'MF' && focusOk && Math.abs(Math.log(focusCur / focusTarget)) < 0.02;
    if (locked && !focusLocked && !afc()) beep();
    if (locked !== focusLocked) { focusLocked = locked; placeFocusFrame(); }
    placeCamera();
    if (++frameNo % 6 === 0) measureNearest();
    if (isMovie()) {
      // видео: новая картинка — только когда камера пишет следующий кадр (25p — 25 раз в секунду)
      const iv = vidInterval(), fi = Math.floor(now / 1000 / iv);
      if (fi !== V.last) { V.last = fi; renderVideoFrame(fi * iv); }
      vidTick(now, dt);
    } else pipe.renderLive(SC.scene, camera, liveParams());
    if (S.disp === 'level' && frameNo % 6 === 0) drawLevel();
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
// параметры живого изображения. «Отоб.парам.ВЫКЛ»: видоискатель показывает нормальную яркость без баланса белого и стиля
function liveParams() {
  const lv = S.lvOff;
  return {
    f: S.f, N: R.N, focus: focusCur, iso: R.iso, nr: S.nr,
    gain: lv ? GAIN0 * 2 ** (12 - evSource()) : gainFor(R), wb: O.wbGains(lv ? O.awbKelvin(SC.lightK) : wbKelvin()),
    look: lv ? 'ST' : S.look, dro: lv ? 0 : S.dro,
    peak: S.peakOn ? S.peakLvl : 0, peakColor: PEAK[S.peakColor], zebra: S.zebraOn ? zebraThr()[0] : 0, zebraHi: zebraThr()[1],
  };
}
// AF-A ведёт себя как AF-C, когда объект движется
function afc() { return S.fm === 'AF-C' || (S.fm === 'AF-A' && (!!SC.subject.moving || (tracking() && !!trackRoot && trackRoot !== SC.subject.root))); }
// Уровень (DISP): крена у камеры в симуляторе нет, показываем наклон вперёд/назад
function drawLevel() {
  const deg = THREE.MathUtils.radToDeg(camera.rotation.x);
  const el = $('oLevel');
  el.classList.toggle('flat', Math.abs(deg) < 1);
  el.querySelector('span').textContent = `${deg > 0 ? '↑' : deg < 0 ? '↓' : ''} ${Math.abs(deg).toFixed(1).replace('.', ',')}°`;
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
    text: `${mobile ? 'Значок камеры' : '«Фото | Видео»'} — диск режима: в «Видео» на экране появляется панель (частота кадров, выдержка, баланс белого, фокус, звук) и кнопка REC. MENU — полное меню α7 IV по справочнику (зелёная точка — пункт влияет на кадр), Fn — быстрые (фокус, замер, баланс белого…), AEL — зафиксировать экспозицию, DISP — гистограмма и вид экрана, ▶ — просмотр снимков.${mobile ? ' «Почему так?» — пояснения к кадру.' : ''}` },
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

window.__sim = { startTour, S, get R() { return R; }, get meterEV() { return meterEV; }, get SC() { return SC; }, get focus() { return { focusTarget, focusCur, focusOk, focusKind }; }, camera, hitAt, shoot, update, acquireFocus, loadScene, startMission, pipe, shots, measure, setKey, menu, V, recToggle, openPick,
  // покадровая запись видео (автотесты, ролики): кадр в момент tf, секунды
  vframe: (tf) => { renderVideoFrame(tf); renderVid(); }, vtick: (now, dt) => vidTick(now, dt) };
