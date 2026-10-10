// Перенос анимаций idle/walk с Xbot на Michelle (одинаковые имена костей Mixamo, разные позы покоя).
// Ретаргетинг через мировые повороты: Gt = Gs(t) * inv(Gs_ref) * Gt_ref.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const [M, OUT] = [process.argv[2], process.argv[3]];

const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qinv = (q) => [-q[0], -q[1], -q[2], q[3]];
const qnorm = (q) => { const l = Math.hypot(...q) || 1; return q.map(v => v / l); };
const qrot = (q, v) => { const r = qmul(qmul(q, [v[0], v[1], v[2], 0]), qinv(q)); return [r[0], r[1], r[2]]; };
function slerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  if (d < 0) { b = b.map(v => -v); d = -d; }
  if (d > 0.9995) return qnorm(a.map((v, i) => v + (b[i] - v) * t));
  const th = Math.acos(d), s = Math.sin(th);
  return a.map((v, i) => (v * Math.sin((1 - t) * th) + b[i] * Math.sin(t * th)) / s);
}
function sample(ch, t) {
  const s = ch.getSampler(), inp = s.getInput().getArray(), out = s.getOutput().getArray(), n = ch.getTargetPath() === 'rotation' ? 4 : 3;
  if (t <= inp[0]) return Array.from(out.slice(0, n));
  if (t >= inp[inp.length - 1]) return Array.from(out.slice((inp.length - 1) * n, inp.length * n));
  let i = 0; while (inp[i + 1] < t) i++;
  const k = (t - inp[i]) / (inp[i + 1] - inp[i]), a = Array.from(out.slice(i * n, i * n + n)), b = Array.from(out.slice(i * n + n, i * n + 2 * n));
  return n === 4 ? slerp(a, b, k) : a.map((v, j) => v + (b[j] - v) * k);
}

const src = await io.read(`${M}/Xbot.glb`), dst = await io.read(`${M}/Michelle.glb`);
const S = src.getRoot(), D = dst.getRoot();
const bones = (root) => { const m = {}; root.listNodes().forEach(n => { if (n.getName().startsWith('mixamorig:')) m[n.getName()] = n; }); return m; };
const sb = bones(S), db = bones(D);
const parentOf = (doc) => { const p = new Map(); doc.getRoot().listNodes().forEach(n => n.listChildren().forEach(c => p.set(c, n))); return p; };
const sp = parentOf(src), dp = parentOf(dst);
/* глобальный поворот узла при заданных локальных поворотах */
function globalRot(node, parents, local) {
  let q = local(node), p = parents.get(node);
  while (p) { q = qmul(local(p), q); p = parents.get(p); }
  return q;
}
function globalRotParent(node, parents, local) { const p = parents.get(node); return p ? globalRot(p, parents, local) : [0, 0, 0, 1]; }

/* опорные позы: Xbot — поза покоя (T-поза), Michelle — клип TPose */
const tpose = D.listAnimations().find(a => a.getName() === 'TPose');
const tposeRot = new Map(), tposeT = new Map();
tpose.listChannels().forEach(c => { if (c.getTargetPath() === 'rotation') tposeRot.set(c.getTargetNode(), sample(c, 0)); if (c.getTargetPath() === 'translation') tposeT.set(c.getTargetNode(), sample(c, 0)); });
const dRefLocal = (n) => tposeRot.get(n) || n.getRotation();
const sRefLocal = (n) => n.getRotation();
const names = Object.keys(db).filter(n => sb[n]);
const sRefG = {}, dRefG = {};
names.forEach(n => { sRefG[n] = globalRot(sb[n], sp, sRefLocal); dRefG[n] = globalRot(db[n], dp, dRefLocal); });

/* высота таза для масштаба смещений */
const sHipRef = sb['mixamorig:Hips'].getTranslation(), dHipRef = tposeT.get(db['mixamorig:Hips']) || db['mixamorig:Hips'].getTranslation();
const sHipParentG = globalRotParent(sb['mixamorig:Hips'], sp, sRefLocal), dHipParentG = globalRotParent(db['mixamorig:Hips'], dp, dRefLocal);
const sHipUp = qrot(sHipParentG, sHipRef)[1], dHipUp = qrot(dHipParentG, dHipRef)[1];
const scale = dHipUp / sHipUp;
console.log('bones mapped', names.length, 'hip scale', scale.toFixed(3));

/* убираем старые клипы */
D.listAnimations().forEach(a => a.dispose());
const buf = D.listBuffers()[0];
for (const clipName of ['idle', 'walk']) {
  const clip = S.listAnimations().find(a => a.getName() === clipName);
  const chans = clip.listChannels();
  const times = Array.from(chans.find(c => c.getTargetPath() === 'rotation').getSampler().getInput().getArray());
  const byNode = new Map();
  chans.forEach(c => { const n = c.getTargetNode(); if (!byNode.has(n)) byNode.set(n, {}); byNode.get(n)[c.getTargetPath()] = c; });
  const outRot = {}; names.forEach(n => outRot[n] = []);
  const outHip = [];
  for (const t of times) {
    const sLocal = (n) => { const e = byNode.get(n); return e && e.rotation ? sample(e.rotation, t) : n.getRotation(); };
    const tgtG = {};
    names.forEach(n => { const g = globalRot(sb[n], sp, sLocal); tgtG[n] = qmul(qmul(g, qinv(sRefG[n])), dRefG[n]); });
    /* локальные повороты цели: inv(глобальный родителя) * глобальный */
    names.forEach(n => {
      const p = dp.get(db[n]);
      let pg;
      if (p && p.getName().startsWith('mixamorig:')) pg = tgtG[p.getName()];
      else pg = p ? globalRot(p, dp, dRefLocal) : [0, 0, 0, 1];
      outRot[n].push(...qnorm(qmul(qinv(pg), tgtG[n])));
    });
    /* смещение таза */
    const e = byNode.get(sb['mixamorig:Hips']);
    const st = e && e.translation ? sample(e.translation, t) : sHipRef;
    const dW = qrot(sHipParentG, [st[0] - sHipRef[0], st[1] - sHipRef[1], st[2] - sHipRef[2]]).map(v => v * scale);
    const dL = qrot(qinv(dHipParentG), dW);
    outHip.push(dHipRef[0] + dL[0], dHipRef[1] + dL[1], dHipRef[2] + dL[2]);
  }
  const anim = dst.createAnimation(clipName);
  const inAcc = dst.createAccessor().setType('SCALAR').setArray(new Float32Array(times)).setBuffer(buf);
  names.forEach(n => {
    const outAcc = dst.createAccessor().setType('VEC4').setArray(new Float32Array(outRot[n])).setBuffer(buf);
    const smp = dst.createAnimationSampler().setInput(inAcc).setOutput(outAcc).setInterpolation('LINEAR');
    anim.addSampler(smp).addChannel(dst.createAnimationChannel().setTargetNode(db[n]).setTargetPath('rotation').setSampler(smp));
  });
  const hAcc = dst.createAccessor().setType('VEC3').setArray(new Float32Array(outHip)).setBuffer(buf);
  const hs = dst.createAnimationSampler().setInput(inAcc).setOutput(hAcc).setInterpolation('LINEAR');
  anim.addSampler(hs).addChannel(dst.createAnimationChannel().setTargetNode(db['mixamorig:Hips']).setTargetPath('translation').setSampler(hs));
  console.log('clip', clipName, 'frames', times.length, 'dur', times[times.length - 1].toFixed(2));
}
/* поза покоя модели = T-поза, чтобы без анимации она не была «скрученной» */
tposeRot.forEach((q, n) => n.setRotation(q));
await io.write(OUT, dst);
console.log('written', OUT);
