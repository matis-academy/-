import * as THREE from 'three';
import { rng, canvasTex, skyDome, makePerson, loopX } from './kit.js?v=2';
import { kelvinRGB } from '../optics.js?v=2';

// «Ночная улица», синий час. Свет — фонари (натриевые, ~2300 K), витрины, неон, фары машин.
// Модель стоит под фонарём на тротуаре в начале координат, дорога — позади неё.
export function build({ mobile = false } = {}) {
  const R = rng(21);
  const scene = new THREE.Scene();
  const solids = [];
  const add = (o, solid = true) => { scene.add(o); if (solid) solids.push(o); return o; };
  const L = 0.067;                                 // общий уровень света ночью: замер ≈ EV 5
  const K = (k, mult = 1) => new THREE.Color(...kelvinRGB(k)).multiplyScalar(mult * L);

  scene.add(skyDome({ top: [0.02, 0.05, 0.16], mid: [0.12, 0.1, 0.2], bottom: [0.08, 0.06, 0.08], mult: 0.016 * L }));
  scene.fog = new THREE.Fog(new THREE.Color(0.0012, 0.0012, 0.003).multiplyScalar(L), 30, 220);
  scene.add(new THREE.HemisphereLight(0x5a6aa0, 0x1a1410, 0.012 * L));

  // Асфальт, тротуары
  const asphalt = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#2a2a2c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { g.fillStyle = R() < 0.5 ? '#232325' : '#323236'; g.fillRect(R() * w, R() * h, 2, 2); }
  }, 1);
  asphalt.repeat.set(40, 3);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(300, 7), new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.45, metalness: 0.15 }));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0, -8);
  road.receiveShadow = true;
  add(road);
  const lineTex = canvasTex(256, 16, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#d8d8d0'; g.fillRect(0, 4, 150, 8); });
  lineTex.wrapS = THREE.RepeatWrapping; lineTex.repeat.set(60, 1);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(300, 0.15), new THREE.MeshStandardMaterial({ map: lineTex, roughness: 0.5, transparent: true, alphaMap: lineTex }));
  line.rotation.x = -Math.PI / 2; line.position.set(0, 0.004, -8);
  scene.add(line);
  const concrete = new THREE.MeshStandardMaterial({ color: 0x77736c, roughness: 0.85 });
  for (const [z, d] of [[4, 17], [-13.5, 4]]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(300, 0.15, d), concrete);
    s.position.set(0, 0.075, z);
    s.receiveShadow = true;
    add(s);
  }

  // Дома на дальней стороне: окна светятся
  const winTex = (seed, lit) => canvasTex(256, 512, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    for (let y = 18; y < h - 60; y += 44) for (let x = 14; x < w - 20; x += 40) {
      if (r() < lit) { const c = r(); g.fillStyle = c < 0.6 ? '#ffd7a0' : c < 0.85 ? '#fff1d8' : '#b8d4ff'; g.globalAlpha = 0.5 + r() * 0.5; g.fillRect(x, y, 24, 28); }
    }
    g.globalAlpha = 1;
    g.fillStyle = '#ffcf8a'; g.fillRect(10, h - 50, w - 20, 40);     // витрина первого этажа
  });
  const facadeCols = [0x4a3b33, 0x3d3f45, 0x55483a, 0x36393f, 0x4d4440];
  let x = -70;
  while (x < 70) {
    const w = 7 + R() * 9, h = 9 + R() * 18;
    const tex = winTex(Math.floor(R() * 1e6), 0.35 + R() * 0.35);
    tex.repeat.set(Math.max(1, Math.round(w / 6)), Math.max(1, Math.round(h / 12)));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const mat = new THREE.MeshStandardMaterial({ color: facadeCols[Math.floor(R() * facadeCols.length)], roughness: 0.9, emissive: K(3200, 0.22), emissiveMap: tex });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w - 0.3, h, 10), mat);
    b.position.set(x + w / 2, h / 2, -20.5);
    add(b);
    x += w;
  }
  // Неоновая вывеска
  const neonTex = canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.font = '700 92px "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#ff3fa8'; g.shadowBlur = 18; g.fillStyle = '#ff6fc0'; g.fillText('КОФЕ', w / 2, h / 2 + 4);
  });
  const neon = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.1), new THREE.MeshBasicMaterial({ map: neonTex, color: new THREE.Color(1, 1, 1).multiplyScalar(0.9 * L), transparent: true, blending: THREE.AdditiveBlending }));
  neon.position.set(3, 4.2, -15.45);
  scene.add(neon);
  const neonLight = new THREE.PointLight(0xff4fb0, 0.9 * L, 0, 2);
  neonLight.position.set(3, 4, -14.5);
  scene.add(neonLight);

  // Фонари
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.6, metalness: 0.5 });
  const lampHeadMat = new THREE.MeshBasicMaterial({ color: K(2300, 9) });
  const lamps = [[-1.6, 0.9, true], [-18, -4.2], [14, -4.2], [-8, -11.8], [8, -11.8], [26, -11.8]];
  for (const [lx, lz, main] of lamps) {
    const h = main ? 4.2 : 6.5;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, h, 10), poleMat);
    pole.position.set(lx, h / 2, lz);
    pole.castShadow = true;
    add(pole);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.18, 0.18, 16), lampHeadMat);
    head.position.set(lx + (main ? 0.45 : 0), h, lz + (main ? -0.2 : lz > -8 ? -0.6 : 0.6));
    scene.add(head);
    const l = new THREE.PointLight(K(2300).multiplyScalar(1 / L), (main ? 9 : 14) * L, 0, 2);
    l.position.copy(head.position).add(new THREE.Vector3(0, -0.25, 0));
    if (main) { l.castShadow = !mobile; l.shadow.mapSize.set(512, 512); l.shadow.bias = -0.002; }
    scene.add(l);
  }

  // Модель под фонарём
  const person = makePerson({ coat: 0x3a3f4a, pants: 0x1f2430, scarf: 0xd7b03a, hair: 0x241810 });
  person.group.rotation.y = -0.15;
  add(person.group);

  // Машины с фарами — на длинной выдержке оставляют световые следы
  const cars = [];
  const mkCar = (color, dir, laneZ, speed, offset) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new RoundBox(4.3, 0.8, 1.8), new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.6 }));
    body.position.y = 0.6;
    const cabin = new THREE.Mesh(new RoundBox(2.2, 0.6, 1.6), new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.15, metalness: 0.8 }));
    cabin.position.set(-0.2, 1.25, 0);
    g.add(body, cabin);
    const tire = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.8 });
    for (const wx of [-1.4, 1.4]) for (const wz of [-0.85, 0.85]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.25, 16), tire);
      w.rotation.x = Math.PI / 2; w.position.set(wx, 0.33, wz); g.add(w);
    }
    const lightsG = new THREE.Group();
    const head = new THREE.MeshBasicMaterial({ color: K(4500, 60) });
    const tail = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.04, 0.02).multiplyScalar(18 * L) });
    // огни и их «следы»: тонкие полоски, которые при съёмке закрывают путь за подкадр
    const glow = [];
    const streakGeo = new THREE.BoxGeometry(1, 0.07, 0.07);
    for (const wz of [-0.65, 0.65]) {
      for (const [mat, x, y, r] of [[head, 2.16, 0.7, 0.11], [tail, -2.16, 0.75, 0.09]]) {
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), mat);
        bulb.position.set(x, y, wz);
        const sm = mat.clone();
        const streak = new THREE.Mesh(streakGeo, sm);
        streak.position.set(x, y, wz);
        streak.visible = false;
        lightsG.add(bulb, streak);
        glow.push({ bulb, streak, x, size: 2 * r, base: mat.color.clone() });
      }
    }
    g.add(lightsG);
    g.rotation.y = dir > 0 ? 0 : Math.PI;
    g.position.set(0, 0, laneZ);
    g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    add(g);
    cars.push({ g, dir, speed, offset, glow });
  };
  // по три машины на полосе: за выдержку в несколько секунд хотя бы одна пересечёт кадр
  mkCar(0x8a1c1c, 1, -6.3, 11, 0); mkCar(0x2a4f8a, 1, -6.3, 11, 55); mkCar(0x1c1c1c, 1, -6.3, 11, 110);
  mkCar(0xc8c8cc, -1, -9.7, 9, 25); mkCar(0x6a6a2a, -1, -9.7, 9, 80); mkCar(0xa04a1c, -1, -9.7, 9, 135);

  function update(time, opts = {}) {
    for (const c of cars) {
      c.g.position.x = c.dir * loopX(time, c.speed, 160, c.offset);
      // При съёмке огонь рисуется полоской длиной в путь за подкадр. Яркость делится на длину:
      // свет фары «размазывается» по следу, а не множится — как на настоящей матрице.
      const len = (opts.streakDt || 0) * c.speed;
      for (const g of c.glow) {
        const on = len > g.size;
        g.bulb.visible = !on;
        g.streak.visible = on;
        if (on) {
          g.streak.scale.x = len * 1.04;
          // фары — отрезок вперёд, фонари — назад: так след не прячется за корпусом машины
          g.streak.position.x = g.x + (g.x > 0 ? len / 2 : -len / 2);
          g.streak.material.color.copy(g.base).multiplyScalar(g.size / len);
        }
      }
    }
  }
  update(0);

  return {
    id: 'night', name: 'Ночная улица', about: 'Синий час, фонари и неон. Мало света: высокий ISO, штатив и длинные выдержки.',
    scene, solids, update, nominalEV: 4.5, lightK: 2700,
    rig: { target: new THREE.Vector3(0, 1.6, 0), back: new THREE.Vector3(0, 0, 1), height: 1.6, thirds: true },
    dists: [1, 1.2, 1.5, 1.8, 2, 2.5, 3, 3.5, 4, 5, 6, 8, 10],
    defaults: { dist: 2.5, lensId: '50', f: 50 },
    subject: { name: 'модель', root: person.group, face: person.faceWorld, eyes: person.eyesWorld },
    movers: cars.map((c) => ({ name: 'машина', speed: c.speed, root: c.g, anchor: () => c.g.localToWorld(new THREE.Vector3(0, 0.8, 0)) })),
    bg: { name: 'вывеска', pos: new THREE.Vector3(3, 4.2, -15.4) },
    markers: [
      { name: 'модель', pos: new THREE.Vector3(0, 1.6, 0) }, { name: 'машины', pos: new THREE.Vector3(0, 0.8, -8) },
      { name: 'вывеска', pos: new THREE.Vector3(3, 4.2, -15.4) }, { name: 'дома', pos: new THREE.Vector3(0, 8, -20) },
    ],
  };
}

// скруглённый параллелепипед без зависимостей
function RoundBox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d, 4, 2, 2);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 0.92 + 0.08 * (1 - Math.abs(v.y) / (h / 2));
    p.setXYZ(i, v.x * (Math.abs(v.x) > w * 0.45 ? 0.97 : 1), v.y, v.z * k);
  }
  g.computeVertexNormals();
  return g;
}
