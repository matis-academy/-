import * as THREE from 'three';
import { rng, canvasTex, skyDome, makePerson, makeTree, loopX } from './kit.js?v=2';
import { kelvinRGB } from '../optics.js?v=3';

// «Портрет в парке», золотой час. Солнце низко за спиной модели — контровой свет.
// Модель стоит в начале координат лицом к +z, фотограф — на оси +z.
export function build({ mobile = false } = {}) {
  const R = rng(7);
  const scene = new THREE.Scene();
  const solids = [];
  const add = (o, solid = true) => { scene.add(o); if (solid) solids.push(o); return o; };

  scene.add(skyDome({ top: [0.28, 0.45, 0.85], mid: [0.95, 0.72, 0.5], bottom: [0.9, 0.62, 0.42], mult: 2.0 }));
  scene.fog = new THREE.Fog(new THREE.Color(0.86, 0.68, 0.52), 25, 230);

  const sunDir = new THREE.Vector3(-0.55, 0.32, -0.77).normalize();
  const sun = new THREE.DirectionalLight(new THREE.Color(...kelvinRGB(3600)), 3.4);
  sun.position.copy(sunDir).multiplyScalar(40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 90 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0xbfd2ff, 0x5a4a30, 1.15));
  const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(14, 24, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.85, 0.6).multiplyScalar(40), fog: false }));
  sunDisc.position.copy(sunDir).multiplyScalar(820);
  scene.add(sunDisc);

  const grass = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#4f6b2c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      const v = R();
      g.fillStyle = v < 0.33 ? '#5f7d33' : v < 0.66 ? '#445d25' : '#6d8a3a';
      g.fillRect(R() * w, R() * h, 2, 4 + R() * 6);
    }
  }, 60);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  add(ground);
  const pathTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#b9a07c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) { g.fillStyle = R() < 0.5 ? '#a68d6a' : '#c8b08b'; g.fillRect(R() * w, R() * h, 2, 2); }
  }, 1);
  pathTex.repeat.set(2, 60);
  for (const [w, l, x, z, ry] of [[2.4, 120, 0.6, -50, 0], [2.6, 140, 0, -14, Math.PI / 2]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshStandardMaterial({ map: pathTex, roughness: 1 }));
    p.rotation.set(-Math.PI / 2, 0, ry);
    p.position.set(x, 0.005 + (ry ? 0.002 : 0), z);
    p.receiveShadow = true;
    add(p);
  }

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b4330, roughness: 0.95 });
  const leafMats = [0x4a6e2a, 0x5d7f30, 0x3f5f27, 0x6f8c34, 0x8a8a32].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true }));
  const tree = (x, z, s) => { const t = makeTree(R, s, leafMats, trunkMat); t.position.set(x, 0, z); add(t); };
  for (let i = 0; i < (mobile ? 55 : 85); i++) {
    const z = -7 - R() * 70, x = (R() - 0.5) * (30 + -z * 1.4);
    if (Math.abs(x - 0.6) < 2.2 || Math.abs(z + 14) < 2.2) continue;
    tree(x, z, 0.8 + R() * 0.7);
  }
  for (const [x, z] of [[-6, -4], [7, -5], [-11, 2], [12, 1], [-15, 8], [16, 9], [-18, 20], [20, 22]]) tree(x, z, 1.1);

  // Фонари с гирляндой — источники боке
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2c, roughness: 0.5, metalness: 0.6 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(...kelvinRGB(2400)).multiplyScalar(14) });
  const bulbGeo = new THREE.SphereGeometry(0.045, 10, 6);
  const posts = [];
  for (const z of [-8, -15, -22, -29]) for (const x of [-2.2, 3.4]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.2, 10), poleMat);
    p.position.set(x, 1.6, z);
    p.castShadow = true;
    add(p);
    posts.push(new THREE.Vector3(x, 3.1, z));
  }
  const garland = (a, b, sag) => {
    const n = Math.max(6, Math.round(a.distanceTo(b) / 0.42));
    for (let i = 1; i < n; i++) {
      const k = i / n;
      const m = new THREE.Mesh(bulbGeo, bulbMat);
      m.position.lerpVectors(a, b, k);
      m.position.y -= Math.sin(Math.PI * k) * sag;
      scene.add(m);
    }
  };
  for (let i = 0; i + 2 < posts.length; i += 2) { garland(posts[i], posts[i + 2], 0.45); garland(posts[i + 1], posts[i + 3], 0.45); }
  for (let i = 0; i < posts.length; i += 2) garland(posts[i], posts[i + 1], 0.6);

  // Скамейка
  {
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.8 });
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 0.12), wood); s.position.set(0, 0.45, -0.16 + i * 0.16); g.add(s); }
    for (let i = 0; i < 2; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.04), wood); s.position.set(0, 0.7 + i * 0.16, -0.26); g.add(s); }
    for (const x of [-0.8, 0.8]) for (const z of [-0.2, 0.2]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.06), poleMat); l.position.set(x, 0.22, z); g.add(l); }
    g.traverse((m) => { m.castShadow = true; });
    g.position.set(-3.2, 0, -6);
    g.rotation.y = 0.5;
    add(g);
  }

  // Модель
  const person = makePerson();
  person.group.rotation.y = 0.12;
  add(person.group);

  // Цветы на переднем плане
  {
    const stem = new THREE.MeshStandardMaterial({ color: 0x4e7a2c, roughness: 0.9 });
    const petals = [0xf2d64b, 0xe8e2d6, 0xd9577a, 0xf08a3a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));
    for (let i = 0; i < 46; i++) {
      const x = (R() < 0.5 ? -1 : 1) * (0.45 + R() * 1.2), z = 0.6 + R() * 1.6, h = 0.25 + R() * 0.35;
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, h, 5), stem);
      s.position.set(x, h / 2, z);
      add(s);
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 6), petals[Math.floor(R() * petals.length)]);
      f.scale.y = 0.45;
      f.position.set(x, h, z);
      add(f);
    }
  }

  // Велосипедист
  const bike = new THREE.Group();
  const wheels = [];
  {
    const tire = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.8 });
    const frame = new THREE.MeshStandardMaterial({ color: 0xd8b02a, roughness: 0.4, metalness: 0.3 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0xe6e6e6, roughness: 0.7 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc89070, roughness: 0.6 });
    for (const x of [-0.52, 0.52]) {
      const w = new THREE.Group();
      w.add(new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.025, 8, 28), tire));
      for (let i = 0; i < 6; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.64, 0.01), frame); sp.rotation.z = i * Math.PI / 6; w.add(sp); }
      w.position.set(x, 0.35, 0);
      bike.add(w); wheels.push(w);
    }
    const bar = (len, x, y, rz) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, len, 6), frame); b.position.set(x, y, 0); b.rotation.z = rz; bike.add(b); };
    bar(0.7, 0, 0.62, Math.PI / 2); bar(0.55, -0.25, 0.5, 0.9); bar(0.55, 0.25, 0.5, -0.5);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.4, 4, 10), shirt);
    torso.position.set(-0.05, 1.1, 0); torso.rotation.z = -0.5; bike.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 10), skin);
    head.position.set(0.18, 1.45, 0); bike.add(head);
    for (const z of [-0.09, 0.09]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.55, 4, 8), new THREE.MeshStandardMaterial({ color: 0x223, roughness: 0.8 }));
      leg.position.set(-0.08, 0.62, z); leg.rotation.z = 0.3; bike.add(leg);
    }
    bike.traverse((m) => { m.castShadow = true; });
  }
  bike.position.set(0, 0, -14);
  add(bike);
  const BIKE_SPEED = 5.5;

  function update(time) {
    bike.position.x = loopX(time, BIKE_SPEED, 70);
    for (const w of wheels) w.rotation.z = -time * BIKE_SPEED / 0.33;
  }
  update(0);

  return {
    id: 'park', name: 'Портрет в парке', about: 'Золотой час, солнце за спиной модели. Гирлянды на фоне дают боке.',
    scene, solids, update, nominalEV: 12, lightK: 4300,
    rig: { target: new THREE.Vector3(0, 1.6, 0), back: new THREE.Vector3(0, 0, 1), height: 1.6, thirds: true },
    dists: [0.8, 1, 1.2, 1.5, 1.8, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 10, 12, 15],
    defaults: { dist: 3, lensId: '85', f: 85 },
    subject: { name: 'модель', root: person.group, face: person.faceWorld, eyes: person.eyesWorld },
    movers: [{ name: 'велосипедист', speed: BIKE_SPEED, root: bike, anchor: () => bike.localToWorld(new THREE.Vector3(0, 1.1, 0)) }],
    bg: { name: 'гирлянды', pos: new THREE.Vector3(0.6, 2.8, -15) },
    markers: [
      { name: 'цветы', pos: new THREE.Vector3(0, 0.4, 1.6) }, { name: 'модель', pos: new THREE.Vector3(0, 1.6, 0) },
      { name: 'скамейка', pos: new THREE.Vector3(-3.2, 0.5, -6) }, { name: 'гирлянды', pos: new THREE.Vector3(0.6, 2.8, -15) },
      { name: 'деревья', pos: new THREE.Vector3(0, 4, -35) },
    ],
  };
}
