import * as THREE from 'three';
import * as O from './optics.js?v=1';
import { LENSES, lensById } from './lenses.js?v=1';
import { buildPark } from './park.js?v=1';
import { Pipeline } from './pipeline.js?v=1';

const $ = (id) => document.getElementById(id);
const mobile = matchMedia('(max-width: 860px), (pointer: coarse)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ───────────────────────── Состояние камеры ─────────────────────────
const S = {
  mode: 'A', N: 2.8, t: 1 / 250, iso: 'AUTO', ec: 0,
  lensId: '85', f: 85,
  fm: 'AF', mfDist: 3,
  dist: 3,                      // расстояние до модели, м
  yaw: 0, pitch: 0,             // поворот камеры относительно направления на модель
  steady: true, tripod: false, grid: true,
  focusUV: [0.5, 0.33],         // точка фокусировки в кадре (0…1, от левого верхнего угла)
};
let R = null;                   // решённая экспозиция
let focusTarget = 3, focusCur = 3, focusOk = true, focusTooClose = false;
const shots = [];

const lens = () => lensById(S.lensId);
const lensSpec = () => ({ f: S.f, maxN: lens().maxN(S.f), minN: lens().minN });
const stabStops = () => (S.tripod ? Infinity : S.steady ? 5.5 : 0);

// ───────────────────────── Рендер ─────────────────────────
const canvas = $('cv');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x000000, 1);
const pipe = new Pipeline(renderer, { mobile });
pipe.expBase = 0.85;
const park = buildPark({ mobile });
const camera = new THREE.PerspectiveCamera(O.fovV(S.f), 1.5, 0.1, 2000);
const raycaster = new THREE.Raycaster();

// Ближайший предмет в кадре (сетка лучей) — от него зависит, насколько сильным может быть размытие
const nearRay = new THREE.Raycaster();
function measureNearest() {
  let m = 1000;
  for (let i = 0; i < 7; i++) for (let j = 0; j < 5; j++) {
    nearRay.setFromCamera(new THREE.Vector2(-0.95 + i * (1.9 / 6), -0.95 + j * (1.9 / 4)), camera);
    const h = nearRay.intersectObjects(park.solids, true)[0];
    if (h) m = Math.min(m, h.distance);
  }
  pipe.nearest = m;
}

let resScale = 1;
function resize() {
  const r = $('vf').getBoundingClientRect();
  const pr = Math.min(devicePixelRatio, mobile ? 1.5 : 1.25) * resScale;
  const w = Math.round(Math.min(r.width * pr, mobile ? 1100 : 1700));
  const h = Math.round(w / 1.5);
  renderer.setSize(w, h, false);
  pipe.setSize(w, h);
}
new ResizeObserver(resize).observe($('vf'));

function placeCamera(extraYaw = 0, extraPitch = 0) {
  camera.fov = O.fovV(S.f);
  camera.aspect = 1.5;
  camera.updateProjectionMatrix();
  camera.position.set(0, 1.6, S.dist);
  // базовое направление — чуть ниже лица, чтобы голова была на верхней трети
  const halfH = S.dist * Math.tan(THREE.MathUtils.degToRad(O.fovV(S.f) / 2));
  const aim = new THREE.Vector3(0, Math.max(0.7, 1.6 - halfH / 3), 0);
  const dir = aim.sub(camera.position).normalize();
  const yaw0 = Math.atan2(-dir.x, -dir.z), pitch0 = Math.asin(dir.y);
  camera.rotation.set(pitch0 + S.pitch + extraPitch, yaw0 + S.yaw + extraYaw, 0, 'YXZ');
  camera.updateMatrixWorld();
}

// Автофокус: луч из точки фокусировки, расстояние вдоль оси объектива
function autofocus(instant = false) {
  placeCamera();
  const ndc = new THREE.Vector2(S.focusUV[0] * 2 - 1, -(S.focusUV[1] * 2 - 1));
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(park.solids, true)[0];
  const fwd = camera.getWorldDirection(new THREE.Vector3());
  let d = hit ? hit.point.clone().sub(camera.position).dot(fwd) : 1000;
  const mfd = lens().minFocus(S.f);
  focusTooClose = d < mfd;
  d = Math.max(d, mfd);
  focusTarget = d;
  focusOk = !focusTooClose;
  if (instant) focusCur = d;
  update();
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
      const list = cfg.values();
      const i = cfg.index();
      const on = cfg.active();
      range.max = list.length - 1;
      range.value = i;
      range.disabled = !on;
      steps.forEach((b) => { b.disabled = !on; });
      val.textContent = cfg.format(list[i], i);
      val.classList.toggle('warn', !!cfg.warn?.());
      const tg = cfg.tag?.() || '';
      tag.textContent = tg;
      tag.classList.toggle('auto', !on && !!tg);
      el.classList.toggle('disabled', !on);
    },
  };
  const set = (i) => { const list = cfg.values(); cfg.set(list[clamp(i, 0, list.length - 1)], clamp(i, 0, list.length - 1)); onChange(cfg.refocus); };
  range.addEventListener('input', () => set(+range.value));
  steps.forEach((b) => b.addEventListener('click', () => set(cfg.index() + +b.dataset.d)));
  return api;
}

const apertureList = () => O.APERTURES.filter((n) => n >= lens().maxN(S.f) - 1e-6 && n <= lens().minN + 1e-6);
const ISO_LIST = ['AUTO', ...O.ISOS];
const DISTS = [0.8, 1, 1.2, 1.5, 1.8, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 10, 12, 15];
const MF_LIST = [0.3, 0.35, 0.4, 0.45, 0.5, 0.6, 0.7, 0.8, 1, 1.2, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 8, 10, 15, 20, 30, 50, 100, 1000];
const idx = (list, v) => { let bi = 0, bd = Infinity; list.forEach((x, i) => { const d = typeof x === 'number' && typeof v === 'number' ? Math.abs(Math.log(x) - Math.log(v)) : (x === v ? 0 : Infinity); if (d < bd) { bd = d; bi = i; } }); return bi; };

const C = {
  N: control($('cN'), {
    name: 'Диафрагма', hint: 'Меньше число F — шире отверстие: больше света и сильнее размыт фон.',
    values: apertureList, index: () => idx(apertureList(), S.mode === 'A' || S.mode === 'M' ? S.N : R.N),
    active: () => S.mode === 'A' || S.mode === 'M', set: (v) => { S.N = v; }, format: (v) => O.fmtF(v),
    tag: () => (S.mode === 'A' || S.mode === 'M' ? 'передний диск' : 'подбирает камера'), warn: () => R.warnN,
  }),
  T: control($('cT'), {
    name: 'Выдержка', hint: 'Короче выдержка — меньше света, но движение замирает. Длиннее — светлее, но возможен смаз.',
    values: () => O.SHUTTERS, index: () => idx(O.SHUTTERS, S.mode === 'S' || S.mode === 'M' ? S.t : R.t),
    active: () => S.mode === 'S' || S.mode === 'M', set: (v) => { S.t = v; }, format: (v) => O.fmtShutter(v),
    tag: () => (S.mode === 'S' || S.mode === 'M' ? 'задний диск' : 'подбирает камера'), warn: () => R.warnT,
  }),
  Iso: control($('cIso'), {
    name: 'ISO', hint: 'Усиление сигнала матрицы: выше ISO — светлее кадр, но больше шума.',
    values: () => ISO_LIST, index: () => (S.mode === 'AUTO' ? 0 : idx(ISO_LIST, S.iso)),
    active: () => S.mode !== 'AUTO', set: (v) => { S.iso = v; },
    format: (v) => (v === 'AUTO' ? `AUTO · ${R.iso}` : String(v)),
    tag: () => (S.mode === 'AUTO' ? 'подбирает камера' : 'колесо → вправо'),
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
    values: () => { const l = lens(); return l.fMin === l.fMax ? [l.fMin] : Array.from({ length: l.fMax - l.fMin + 1 }, (_, i) => l.fMin + i); },
    index: () => S.f - lens().fMin, active: () => lens().fMin !== lens().fMax,
    set: (v) => { S.f = v; }, format: (v) => `${v} мм`, tag: () => (lens().fMin === lens().fMax ? 'фикс' : 'кольцо зума'), refocus: true,
  }),
  Focus: control($('cFocus'), {
    name: 'Дистанция фокусировки', hint: 'В режиме MF вращайте кольцо фокусировки. Резко будет то, что на этой дистанции.',
    values: () => MF_LIST.filter((d) => d >= lens().minFocus(S.f) - 1e-6),
    index: () => idx(MF_LIST.filter((d) => d >= lens().minFocus(S.f) - 1e-6), S.fm === 'MF' ? S.mfDist : focusTarget),
    active: () => S.fm === 'MF', set: (v) => { S.mfDist = v; focusTarget = v; },
    format: (v) => O.fmtDist(S.fm === 'MF' ? v : focusTarget), tag: () => (S.fm === 'MF' ? 'кольцо фокуса' : 'наводит автофокус'),
  }),
  Dist: control($('cDist'), {
    name: 'Расстояние до модели', hint: 'Ближе — крупнее модель и сильнее размыт фон. Перспектива зависит от точки съёмки, а не от объектива.',
    values: () => DISTS, index: () => idx(DISTS, S.dist), active: () => true, set: (v) => { S.dist = v; },
    format: (v) => O.fmtDist(v), tag: () => 'шаги вперёд/назад', refocus: true,
  }),
};

const MODE_NOTES = {
  AUTO: 'Камера сама выбирает всё. Удобно, но вы не управляете ни размытием фона, ни смазом.',
  P: 'Программный: камера подбирает диафрагму и выдержку, вы — ISO и экспокоррекцию.',
  A: 'Приоритет диафрагмы: вы задаёте F — глубину резкости, камера подбирает выдержку. Главный режим для портрета.',
  S: 'Приоритет выдержки: вы задаёте время — заморозить или смазать движение, камера подбирает диафрагму.',
  M: 'Ручной: всё задаёте вы, внизу кадра — отклонение от нормы. С ISO AUTO камера держит экспозицию сама.',
};

document.querySelectorAll('#modes button').forEach((b) => b.addEventListener('click', () => {
  S.mode = b.dataset.mode;
  if (S.mode === 'M' && R) { S.N = R.N; S.t = R.t; }   // в M начинаем с текущих значений, как камера
  if (S.mode === 'A' && R) S.N = R.N;
  if (S.mode === 'S' && R) S.t = R.t;
  onChange();
}));
document.querySelectorAll('#focusModes button').forEach((b) => b.addEventListener('click', () => {
  S.fm = b.dataset.fm;
  if (S.fm === 'MF') S.mfDist = O.nearest(MF_LIST, focusTarget);
  else autofocus();
  onChange();
}));

function renderLenses() {
  $('lenses').innerHTML = LENSES.map((l) => `<button data-lens="${l.id}" role="radio"><b>${l.short}</b><span>${l.fMin === l.fMax ? 'фикс' : 'зум'} · F${String(l.maxN(l.fMin)).replace('.', ',')}</span></button>`).join('');
  $('lenses').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
    S.lensId = b.dataset.lens;
    const l = lens();
    S.f = clamp(S.f, l.fMin, l.fMax);
    if (l.fMin !== l.fMax) S.f = l.fMin === 28 ? 50 : l.fMin;
    S.N = Math.max(S.N, l.maxN(S.f));
    onChange(true);
  }));
}
renderLenses();

$('swSteady').addEventListener('change', (e) => { S.steady = e.target.checked; onChange(); });
$('swTripod').addEventListener('change', (e) => { S.tripod = e.target.checked; onChange(); });
$('swGrid').addEventListener('change', (e) => { S.grid = e.target.checked; onChange(); });

function onChange(refocus = false) {
  if (refocus && S.fm === 'AF') autofocus();
  update();
}

// ───────────────────────── Обновление интерфейса ─────────────────────────
function cameraZ() { return S.dist; }

function update() {
  const ls = lensSpec();
  if (S.N < ls.maxN) S.N = O.nearest(apertureList(), ls.maxN);
  R = O.solveExposure(S, ls, park.sceneEV);
  for (const c of Object.values(C)) c.refresh();
  document.querySelectorAll('#modes button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === S.mode)));
  document.querySelectorAll('#focusModes button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.fm === S.fm)));
  $('lenses').querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.lens === S.lensId)));
  $('modeNote').textContent = MODE_NOTES[S.mode];
  $('lensNote').textContent = `${lens().name}. ${lens().about} Мин. дистанция фокусировки ${O.fmtDist(lens().minFocus(S.f))}.`;
  $('vfGrid').classList.toggle('off', !S.grid);

  // индикация в видоискателе
  $('oMode').textContent = S.mode === 'AUTO' ? 'iA' : S.mode;
  $('oLens').textContent = `${S.f} мм`;
  $('oAf').textContent = S.fm === 'MF' ? `MF ${O.fmtDist(focusTarget)}` : 'AF-S';
  $('oIs').classList.toggle('off', !S.steady || S.tripod);
  $('oT').textContent = O.fmtShutter(R.t);
  $('oN').textContent = O.fmtF(R.N);
  $('oIso').textContent = `ISO ${R.isoAuto ? 'AUTO ' : ''}${R.iso}`;
  const manualMeter = S.mode === 'M' && !R.isoAuto;
  $('oEv').textContent = manualMeter ? `M.M. ${O.fmtEV(R.offset)}` : O.fmtEV(R.ec);
  $('oT').classList.toggle('warn', R.warnT);
  $('oN').classList.toggle('warn', R.warnN);
  $('oEv').classList.toggle('warn', manualMeter && Math.abs(R.offset) > 2);
  const fe = $('oFocus');
  fe.style.left = `${S.focusUV[0] * 100}%`;
  fe.style.top = `${S.focusUV[1] * 100}%`;
  fe.classList.toggle('mf', S.fm === 'MF');
  updateExplain();
}

// ───────────────────────── Пояснения ─────────────────────────
function analyse(st, res, focus) {
  const f = st.f, N = res.N, t = res.t;
  const camZ = st.dist;
  const d = O.dof(f, N, focus);
  const subj = camZ - 0.1;                              // лицо модели (модель в начале координат, камера на z = dist)
  const bgDist = camZ + 15;                             // гирлянды
  const bgCoc = O.cocMm(f, N, focus, bgDist) / O.SENSOR.coc;
  const subjSharp = subj >= d.near * 0.98 && subj <= d.far * 1.02;
  const stops = st.tripod ? Infinity : st.steady ? 5.5 : 0;
  const shake = st.tripod ? 0 : O.shakeBlurMm(f, t, stops) / O.SENSOR.coc;
  const bikeDist = camZ + 14;
  const motion = O.motionBlurMm(f, park.movers[0].speed, bikeDist, t) / O.SENSOR.coc;
  const moveCm = park.movers[0].speed * t * 100;
  // выдержка, при которой смаз движения не больше двух допустимых кружков
  const freezeT = O.SHUTTERS.find((x) => O.motionBlurMm(f, park.movers[0].speed, bikeDist, x) / O.SENSOR.coc <= 2) || 1 / 8000;
  const widthM = 2 * camZ * Math.tan(THREE.MathUtils.degToRad(O.fovH(f) / 2));
  return { d, bgCoc, subjSharp, shake, motion, moveCm, widthM, bgDist, bikeDist, stops, freezeT };
}

function setTile(id, cls, big, text) {
  const el = $(id);
  el.className = `tile ${cls}`;
  el.querySelector('.big').textContent = big;
  el.querySelector('p').textContent = text;
}

function blurWord(ratio) {
  return ratio < 1.2 ? 'резкий' : ratio < 4 ? 'слегка размыт' : ratio < 15 ? 'заметно размыт' : 'сильно размыт';
}

function updateExplain() {
  const A = analyse(S, R, focusTarget);
  const off = R.offset;
  // экспозиция
  if (Math.abs(off) < 0.34) {
    setTile('tExp', 'ok', 'Норма', S.mode === 'M' && !R.isoAuto
      ? 'Ручные настройки совпали с замером: диафрагма, выдержка и ISO вместе дают нужное количество света.'
      : `Камера подобрала ${S.mode === 'S' ? 'диафрагму' : S.mode === 'A' ? 'выдержку' : 'настройки'} так, чтобы кадр был нормальной яркости${R.ec ? ` с поправкой ${O.fmtEV(R.ec)} EV` : ''}.`);
  } else {
    const over = off > 0;
    const how = over ? 'закройте диафрагму (больше F), сократите выдержку или опустите ISO' : 'откройте диафрагму (меньше F), удлините выдержку или поднимите ISO';
    const why = R.warnT ? ' Выдержке не хватает диапазона камеры (мигает).' : R.warnN ? ' Диафрагме объектива не хватает диапазона (мигает).' : '';
    setTile('tExp', Math.abs(off) < 1.5 ? 'warn' : 'bad', `${O.fmtEV(off)} EV — ${over ? 'пересвет' : 'недосвет'}`, `Кадр ${over ? 'светлее' : 'темнее'} нормы в ${(2 ** Math.abs(off)).toFixed(1).replace('.', ',')} раза.${why} Чтобы исправить, ${how}.`);
  }
  // ГРИП
  const zone = `${O.fmtDist(A.d.near)} – ${O.fmtDist(A.d.far)}`;
  if (!A.subjSharp) {
    setTile('tDof', 'bad', 'Модель не в фокусе', `Резко только ${zone}, а модель на ${O.fmtDist(S.dist)}. Нажмите на лицо модели в кадре, чтобы перефокусироваться.`);
  } else {
    const total = isFinite(A.d.total) ? O.fmtDist(A.d.total) : 'до бесконечности';
    setTile('tDof', 'ok', `Резко ${zone}`, `Глубина резкости ${total}. Гирлянды на фоне (${O.fmtDist(A.bgDist)}) ${blurWord(A.bgCoc)}${A.bgCoc >= 1.2 ? ` — кружок в ${Math.round(A.bgCoc)}× больше допустимого` : ''}. Сильнее размыть фон: меньше F, длиннее фокусное или ближе к модели.`);
  }
  // угол
  const fh = O.fovH(S.f);
  const kind = S.f < 35 ? 'Широкий угол: много окружения, перспектива подчёркнута — близкое кажется крупнее.'
    : S.f <= 60 ? 'Нормальный угол, близкий к зрению человека.'
      : 'Портретный угол: фон «приближается» и кажется крупнее, перспектива сжимается.';
  setTile('tFov', 'ok', `${fh.toFixed(1).replace('.', ',')}° по ширине`, `${kind} На расстоянии модели в кадр по ширине входит ${O.fmtDist(A.widthM)}.`);
  // смаз
  const worst = Math.max(A.shake, A.motion);
  const safe = O.safeShutter(S.f, isFinite(A.stops) ? A.stops : 12);
  const shakeTxt = S.tripod ? 'Камера на штативе — дрожания рук нет.'
    : `Безопасная выдержка с рук ≈ ${O.fmtShutter(O.nearest(O.SHUTTERS, Math.min(30, safe)))}${S.steady ? ' (со SteadyShot)' : ' (правило 1/f)'}.`;
  const motionTxt = `Велосипедист за ${O.fmtShutter(R.t)} проедет ${A.moveCm < 1 ? `${(A.moveCm * 10).toFixed(0)} мм` : A.moveCm < 100 ? `${A.moveCm.toFixed(0)} см` : `${(A.moveCm / 100).toFixed(1).replace('.', ',')} м`} — ${A.motion <= 2 ? 'замрёт' : A.motion < 6 ? 'чуть смажется' : 'смажется'}${A.motion > 2 ? ` (заморозит ${O.fmtShutter(A.freezeT)} и короче)` : ''}.`;
  setTile('tBlur', A.shake < 1.5 && A.motion <= 2 ? 'ok' : A.shake >= 3 ? 'bad' : 'warn',
    A.shake >= 3 ? 'Шевелёнка!' : A.shake >= 1.5 ? 'Лёгкая шевелёнка' : A.motion > 2 ? 'Движение смажется' : 'Резко', `${shakeTxt} ${motionTxt}`);
  // шум
  const iso = R.iso;
  setTile('tNoise', iso <= 1600 ? 'ok' : iso <= 6400 ? 'ok' : iso <= 25600 ? 'warn' : 'bad',
    iso <= 1600 ? `ISO ${iso} — чисто` : iso <= 6400 ? `ISO ${iso} — малый шум` : iso <= 25600 ? `ISO ${iso} — шумно` : `ISO ${iso} — сильный шум`,
    'ISO усиливает сигнал матрицы вместе с шумом. α7 IV даёт чистую картинку примерно до ISO 6400.');
  drawDofBar(A);
}

// Шкала ГРИП в логарифмическом масштабе
const LMIN = Math.log(0.3), LMAX = Math.log(120);
const xPos = (d) => (isFinite(d) ? clamp((Math.log(Math.max(d, 0.3)) - LMIN) / (LMAX - LMIN), 0, 1) * 92 + 2 : 97);
function drawDofBar(A) {
  const zone = $('dofZone');
  const a = xPos(A.d.near), b = xPos(A.d.far);
  zone.style.left = `${a}%`;
  zone.style.width = `${Math.max(0.6, b - a)}%`;
  $('dofFocus').style.left = `${xPos(focusTarget)}%`;
  const marks = park.markers.map((m) => ({ name: m.name, d: S.dist - m.z })).filter((m) => m.d > 0.3);
  $('dofMarks').innerHTML = marks.map((m) => `<span style="left:${xPos(m.d)}%">${m.name}</span>`).join('');
  $('dofScale').innerHTML = [0.5, 1, 2, 5, 10, 20, 50].map((d) => `<span style="left:${xPos(d)}%">${O.fmtDist(d)}</span>`).join('') + '<span style="left:97%">∞</span>';
}

// ───────────────────────── Видоискатель: фокус и поворот ─────────────────────────
const vf = $('vf');
let down = null;
vf.addEventListener('pointerdown', (e) => {
  vf.setPointerCapture(e.pointerId);
  down = { x: e.clientX, y: e.clientY, yaw: S.yaw, pitch: S.pitch, drag: false };
});
vf.addEventListener('pointermove', (e) => {
  if (!down) return;
  const dx = e.clientX - down.x, dy = e.clientY - down.y;
  if (!down.drag && Math.hypot(dx, dy) > 6) down.drag = true;
  if (!down.drag) return;
  const k = THREE.MathUtils.degToRad(O.fovV(S.f)) / vf.clientHeight;
  S.yaw = clamp(down.yaw + dx * k, -0.9, 0.9);
  S.pitch = clamp(down.pitch + dy * k, -0.45, 0.45);
});
vf.addEventListener('pointerup', (e) => {
  if (!down) return;
  const r = vf.getBoundingClientRect();
  if (!down.drag) {
    S.focusUV = [clamp((e.clientX - r.left) / r.width, 0.04, 0.96), clamp((e.clientY - r.top) / r.height, 0.06, 0.94)];
    if (S.fm === 'AF') autofocus(); else update();
  } else if (S.fm === 'AF') autofocus();
  down = null;
  $('vfHint').classList.add('hide');
});

// ───────────────────────── Спуск затвора ─────────────────────────
let busy = false;
async function shoot() {
  if (busy) return;
  busy = true;
  document.querySelectorAll('.shutter').forEach((b) => b.classList.add('busy'));
  if (S.fm === 'AF') autofocus(true); else focusCur = focusTarget;
  const st = { ...S }, res = { ...R }, focus = focusTarget;
  const A = analyse(st, res, focus);
  await new Promise((r) => setTimeout(r, 30));

  const liveW = pipe.w, liveH = pipe.h;
  const cw = mobile ? 1350 : 2100;
  pipe.setSize(cw, Math.round(cw / 1.5));
  const shakePx = (A.shake * O.SENSOR.coc) / 36 * cw;
  const motionPx = (A.motion * O.SENSOR.coc) / 36 * cw;
  const frames = clamp(Math.ceil(Math.max(shakePx, motionPx) / 2.5), 1, mobile ? 24 : 40);
  const theta = st.tripod ? 0 : O.shakeBlurMm(st.f, res.t, A.stops) / st.f;     // угол дрожания, рад
  const phi = Math.random() * Math.PI * 2;
  measureNearest();
  const t0 = performance.now() / 1000;
  const params = { f: st.f, N: res.N, focus, exposure: res.offset, iso: res.iso };
  const out = pipe.capture(park.scene, camera, params, {
    frames,
    step: (k) => {
      const s = frames > 1 ? k / (frames - 1) - 0.5 : 0;
      park.update(t0 + (frames > 1 ? k / (frames - 1) : 0) * res.t);
      const wob = Math.sin(s * 9 + phi) * 0.25;
      placeCamera(Math.cos(phi) * theta * (s + wob * 0.3), Math.sin(phi) * theta * (s - wob * 0.3));
    },
  });
  pipe.setSize(liveW, liveH);
  placeCamera();
  const url = out.toDataURL('image/jpeg', 0.92);
  shots.unshift({ url, st, res, focus, A, n: shots.length + 1 });
  renderGallery();
  $('vfFlash').classList.remove('on'); void $('vfFlash').offsetWidth; $('vfFlash').classList.add('on');
  document.querySelectorAll('.shutter').forEach((b) => b.classList.remove('busy'));
  busy = false;
}
$('shutter').addEventListener('click', shoot);
$('mbShutter').addEventListener('click', shoot);
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !['INPUT', 'BUTTON', 'A'].includes(document.activeElement?.tagName) && !$('photo').open) { e.preventDefault(); shoot(); }
});
$('mbExplain').addEventListener('click', () => $('explain').scrollIntoView({ behavior: 'smooth', block: 'start' }));

// ───────────────────────── Галерея и разбор снимка ─────────────────────────
function exifLine(s) {
  return `${s.st.f} мм · ${O.fmtF(s.res.N)} · ${O.fmtShutter(s.res.t)} · ISO ${s.res.iso}`;
}
function renderGallery() {
  $('shotCount').textContent = shots.length ? `(${shots.length})` : '';
  $('gallery').innerHTML = shots.length
    ? shots.map((s, i) => `<button data-i="${i}"><img src="${s.url}" alt="Снимок ${s.n}"><i>${exifLine(s)}</i></button>`).join('')
    : '<p class="note">Здесь появятся ваши кадры с разбором настроек.</p>';
  $('gallery').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => openPhoto(+b.dataset.i)));
  if (shots[0]) $('mbThumb').style.backgroundImage = `url(${shots[0].url})`;
}
$('mbThumb').addEventListener('click', () => shots.length && openPhoto(0));

function notesFor(s) {
  const n = [], A = s.A, off = s.res.offset;
  if (Math.abs(off) < 0.34) n.push(['ok', 'Экспозиция в норме.']);
  else n.push([Math.abs(off) < 1.5 ? 'warn' : 'bad', `Кадр ${off > 0 ? 'пересвечен' : 'недоэкспонирован'} на ${O.fmtEV(Math.abs(off)).slice(1)} EV. ${off > 0 ? 'Закройте диафрагму, сократите выдержку или опустите ISO.' : 'Откройте диафрагму, удлините выдержку или поднимите ISO.'}`]);
  if (!A.subjSharp) n.push(['bad', `Модель вне зоны резкости (резко ${O.fmtDist(A.d.near)} – ${O.fmtDist(A.d.far)}). Фокус был на ${O.fmtDist(s.focus)}.`]);
  else n.push(['ok', `Модель в фокусе. Зона резкости ${O.fmtDist(A.d.near)} – ${O.fmtDist(A.d.far)}.`]);
  n.push([A.bgCoc > 6 ? 'ok' : 'warn', `Фон ${blurWord(A.bgCoc)}.${A.bgCoc <= 6 ? ' Для портрета с мягким фоном: F1,8–2,8, фокусное 85 мм, подойдите ближе.' : ''}`]);
  if (A.shake >= 1.5) n.push([A.shake >= 3 ? 'bad' : 'warn', `${A.shake >= 3 ? 'Шевелёнка' : 'Лёгкая шевелёнка'}: выдержка ${O.fmtShutter(s.res.t)} слишком длинная для съёмки с рук на ${s.st.f} мм${s.st.steady ? ' даже со SteadyShot' : ' — включите SteadyShot'}.`]);
  if (A.motion > 2) n.push(['warn', `Велосипедист смазан: за ${O.fmtShutter(s.res.t)} он проехал ${A.moveCm >= 100 ? `${(A.moveCm / 100).toFixed(1).replace('.', ',')} м` : `${A.moveCm.toFixed(0)} см`}. Чтобы заморозить его на этом расстоянии, нужна выдержка ${O.fmtShutter(A.freezeT)} и короче — или оставьте смаз намеренно, чтобы передать движение.`]);
  if (s.res.iso > 6400) n.push(['warn', `ISO ${s.res.iso}: шум заметен. Света мало — откройте диафрагму или удлините выдержку.`]);
  return n;
}

let cur = 0;
function openPhoto(i) {
  cur = clamp(i, 0, shots.length - 1);
  const s = shots[cur];
  $('phImg').src = s.url;
  $('phDl').href = s.url;
  $('phDl').download = `a7iv_${String(s.n).padStart(3, '0')}.jpg`;
  $('phExif').innerHTML = `<b>Снимок ${s.n}</b><br>${lensById(s.st.lensId).name}<br>${exifLine(s)} · ${s.st.mode === 'AUTO' ? 'iA' : s.st.mode}<br>Фокус ${O.fmtDist(s.focus)} · до модели ${O.fmtDist(s.st.dist)}`;
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

// ───────────────────────── Цикл ─────────────────────────
// стартовая точка фокуса — на глазах модели
placeCamera();
{
  const eye = new THREE.Vector3(0, 1.615, 0.1).project(camera);
  S.focusUV = [eye.x * 0.5 + 0.5, -eye.y * 0.5 + 0.5];
}
resize();
autofocus(true);

let last = performance.now(), slow = 0, frameNo = 0;
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!document.hidden && !busy) {
    // мотор автофокуса: плавно в логарифмах расстояния
    focusCur = Math.exp(Math.log(focusCur) + (Math.log(focusTarget) - Math.log(focusCur)) * Math.min(1, dt * 9));
    $('oFocus').classList.toggle('ok', S.fm === 'AF' && focusOk && Math.abs(Math.log(focusCur / focusTarget)) < 0.02);
    park.update(now / 1000);
    placeCamera();
    if (++frameNo % 6 === 0) measureNearest();
    pipe.renderLive(park.scene, camera, { f: S.f, N: R.N, focus: focusCur, exposure: R.offset, iso: R.iso });
    // адаптивное разрешение, если устройство не успевает
    slow = slow * 0.95 + (dt > 0.05 ? 1 : 0) * 0.05;
    if (slow > 0.6 && resScale > 0.55) { resScale *= 0.85; slow = 0; resize(); }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
$('loading').classList.add('done');
if (mobile) $('vfHint').textContent = 'Нажмите — фокус, тяните — поворот';
setTimeout(() => $('vfHint').classList.add('hide'), 7000);

window.__sim = { S, get R() { return R; }, shoot, update, autofocus, pipe, shots };
