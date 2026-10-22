import * as THREE from 'three';
import { rng, canvasTex, skyDome, makePerson, loopX } from './kit.js?v=2';
import { kelvinRGB } from '../optics.js?v=3';

// «Стадион», яркий полдень (≈ EV 15, «солнечные 16»). Бегун пересекает кадр по дорожке.
export function build({ mobile = false } = {}) {
  const R = rng(5);
  const scene = new THREE.Scene();
  const solids = [];
  const add = (o, solid = true) => { scene.add(o); if (solid) solids.push(o); return o; };
  const DAY = 3.6;                                 // примерно на 2 ступени светлее парка на закате: замер ≈ EV 15

  scene.add(skyDome({ top: [0.18, 0.4, 0.85], mid: [0.62, 0.76, 0.92], bottom: [0.7, 0.75, 0.8], mult: 1.1 * DAY }));
  scene.fog = new THREE.Fog(new THREE.Color(0.62, 0.72, 0.86).multiplyScalar(DAY), 90, 500);

  const sunDir = new THREE.Vector3(0.35, 0.85, 0.4).normalize();
  const sun = new THREE.DirectionalLight(new THREE.Color(...kelvinRGB(5600)), 3.2 * DAY);
  sun.position.copy(sunDir).multiplyScalar(60);
  sun.target.position.set(0, 0, -12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 140 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0xb8d0ff, 0x6a6a50, 1.0 * DAY));

  // Газон с полосами покоса
  const grass = canvasTex(512, 512, (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#4f8a35' : '#5c9a3c'; g.fillRect(0, i * h / 8, w, h / 8); }
    for (let i = 0; i < 6000; i++) { g.fillStyle = R() < 0.5 ? 'rgba(40,80,30,.4)' : 'rgba(110,160,70,.35)'; g.fillRect(R() * w, R() * h, 2, 3); }
  });
  grass.wrapS = grass.wrapT = THREE.RepeatWrapping; grass.repeat.set(12, 8);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  add(ground);

  // Беговая дорожка: 6 полос
  const trackTex = canvasTex(64, 512, (g, w, h) => {
    g.fillStyle = '#b04a36'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1500; i++) { g.fillStyle = R() < 0.5 ? '#a3432f' : '#bd5540'; g.fillRect(R() * w, R() * h, 1, 1); }
    g.fillStyle = '#f2f2ee';
    for (let i = 0; i <= 6; i++) g.fillRect(0, Math.min(h - 4, i * (h / 6)), w, 4);
  });
  trackTex.wrapS = THREE.RepeatWrapping; trackTex.repeat.set(80, 1);
  const track = new THREE.Mesh(new THREE.PlaneGeometry(300, 7.2), new THREE.MeshStandardMaterial({ map: trackTex, roughness: 0.85 }));
  track.rotation.x = -Math.PI / 2;
  track.position.set(0, 0.01, -12);
  track.receiveShadow = true;
  add(track);

  // Трибуны со зрителями
  const crowd = canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = '#3a3f4a'; g.fillRect(0, 0, w, h);
    const cols = ['#e8e8e8', '#d23b3b', '#2f5fb5', '#f0c33a', '#2a2a2a', '#7fbf5f', '#e07a2f', '#c9a27a'];
    for (let y = 6; y < h; y += 11) for (let x = 3; x < w; x += 7) {
      if (R() < 0.82) { g.fillStyle = cols[Math.floor(R() * cols.length)]; g.fillRect(x + R() * 2, y, 5, 8); }
    }
  });
  crowd.wrapS = THREE.RepeatWrapping; crowd.repeat.set(6, 1);
  for (let i = 0; i < 6; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(260, 2.2, 3), new THREE.MeshStandardMaterial({ map: crowd, roughness: 0.9 }));
    step.position.set(0, 1.1 + i * 2.2, -62 - i * 3);
    step.receiveShadow = true;
    add(step);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(262, 0.6, 22), new THREE.MeshStandardMaterial({ color: 0xdedfe2, roughness: 0.6, metalness: 0.3 }));
  roof.position.set(0, 17, -72);
  roof.castShadow = true;
  add(roof);
  const towerMat = new THREE.MeshStandardMaterial({ color: 0x8a8d93, roughness: 0.5, metalness: 0.6 });
  for (const tx of [-90, 90]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 34, 10), towerMat);
    t.position.set(tx, 17, -55); add(t);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 0.8), towerMat);
    lamp.position.set(tx, 34, -55); add(lamp);
  }
  // Барьер вдоль дорожки
  const rail = new THREE.Mesh(new THREE.BoxGeometry(300, 0.9, 0.12), new THREE.MeshStandardMaterial({ color: 0x1f4f9a, roughness: 0.6 }));
  rail.position.set(0, 0.45, -16.2);
  rail.castShadow = true;
  add(rail);

  // Бегун
  const runner = makePerson({ coat: 0xd23b3b, pants: 0x1a1a1a, scarf: null, hair: 0x2a1a10, skin: 0xb98a68 });
  runner.group.rotation.y = Math.PI / 2;                   // бежит вдоль +x
  add(runner.group);
  const RUN_SPEED = 8;                                     // м/с ≈ 29 км/ч — спринт

  function update(time) {
    runner.group.position.x = loopX(time, RUN_SPEED, 64);
    runner.group.position.z = -11.4;
    runner.run(time * RUN_SPEED / 0.95 * Math.PI, 0.85);
  }
  update(0);

  return {
    id: 'stadium', name: 'Стадион', about: 'Яркий полдень. Бегун мчится со скоростью ~29 км/ч: заморозить или передать движение?',
    scene, solids, update, nominalEV: 15, lightK: 5600,
    rig: { target: new THREE.Vector3(0, 1.25, -11.4), back: new THREE.Vector3(0, 0, 1), height: 1.5, thirds: false },
    dists: [5, 6, 8, 10, 12, 15, 20, 25, 30, 40],
    defaults: { dist: 12, lensId: '70200', f: 100 },
    subject: { name: 'бегун', root: runner.group, face: runner.faceWorld, eyes: runner.eyesWorld, moving: true },
    movers: [{ name: 'бегун', speed: RUN_SPEED, root: runner.group, anchor: () => runner.group.localToWorld(new THREE.Vector3(0, 1.25, 0)) }],
    bg: { name: 'трибуны', pos: new THREE.Vector3(0, 6, -65) },
    markers: [
      { name: 'бегун', pos: new THREE.Vector3(0, 1.3, -11.4) }, { name: 'барьер', pos: new THREE.Vector3(0, 0.5, -16.2) },
      { name: 'трибуны', pos: new THREE.Vector3(0, 6, -65) },
    ],
  };
}
