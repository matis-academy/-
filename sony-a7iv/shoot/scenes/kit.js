import * as THREE from 'three';

// Общие детали для сцен симулятора. Единицы — метры.

export function rng(seed) {             // детерминированный генератор: сцена всегда одинаковая
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  t.anisotropy = 8;
  return t;
}

// Небо-градиент; mult — яркость (день / ночь отличаются на много ступеней)
export function skyDome({ top, mid, bottom, mult = 1 }) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(...top) }, mid: { value: new THREE.Color(...mid) }, bottom: { value: new THREE.Color(...bottom) }, mult: { value: mult } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform vec3 top, mid, bottom; uniform float mult; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = h > 0. ? mix(mid, top, pow(clamp(h*1.6,0.,1.), 0.7)) : mix(mid, bottom, clamp(-h*4.,0.,1.));
        gl_FragColor = vec4(c * mult, 1.); }`,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
  m.renderOrder = -1;
  return m;
}

// Человек из простых фигур. Возвращает группу, точки глаз и функцию анимации бега.
export function makePerson({ coat = 0x2f4f6f, pants = 0x2b3446, skin = 0xe0ac8a, hair = 0x3a2618, scarf = 0xc8463a, shoes = 0x222222 } = {}) {
  const g = new THREE.Group();
  const M = (c, r = 0.7) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const mSkin = M(skin, 0.6), mCoat = M(coat), mPants = M(pants, 0.8), mHair = M(hair), mScarf = M(scarf, 0.8);
  const mWhite = M(0xf4f0ea, 0.3), mDark = M(0x1b1410, 0.3), mShoe = M(shoes, 0.6);
  const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 16);
  const part = (parent, geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true;
    parent.add(m); return m;
  };
  const pivot = (x, y, z) => { const p = new THREE.Group(); p.position.set(x, y, z); g.add(p); return p; };

  const legs = [pivot(-0.1, 0.86, 0), pivot(0.1, 0.86, 0)];
  for (const l of legs) {
    part(l, cap(0.075, 0.7), mPants, 0, -0.43, 0);
    part(l, new THREE.BoxGeometry(0.1, 0.06, 0.22), mShoe, 0, -0.84, 0.04);
  }
  part(g, cap(0.19, 0.42), mCoat, 0, 1.13, 0, 1, 1, 0.72);                       // корпус
  part(g, new THREE.SphereGeometry(0.068, 16, 10), mCoat, -0.175, 1.31, 0, 1, 0.85, 0.9);
  part(g, new THREE.SphereGeometry(0.068, 16, 10), mCoat, 0.175, 1.31, 0, 1, 0.85, 0.9);
  const arms = [pivot(-0.205, 1.32, 0.01), pivot(0.205, 1.32, 0.01)];
  arms.forEach((a, i) => {
    const s = i ? -1 : 1;
    a.rotation.z = 0.07 * s;
    part(a, cap(0.048, 0.48), mCoat, 0, -0.25, 0);
    part(a, new THREE.SphereGeometry(0.045, 12, 8), mSkin, 0, -0.53, 0.01, 1, 1.3, 0.8);
  });
  part(g, new THREE.CylinderGeometry(0.05, 0.06, 0.12, 12), mSkin, 0, 1.43, 0);
  if (scarf != null) part(g, new THREE.TorusGeometry(0.085, 0.04, 8, 20), mScarf, 0, 1.43, 0).rotation.x = Math.PI / 2;
  part(g, new THREE.SphereGeometry(0.11, 24, 16), mSkin, 0, 1.6, 0, 0.92, 1.1, 0.98);          // голова
  const hairCap = part(g, new THREE.SphereGeometry(0.118, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), mHair, 0, 1.62, -0.012, 0.98, 1.12, 1.02);
  hairCap.rotation.x = -0.25;
  part(g, new THREE.SphereGeometry(0.1, 16, 12), mHair, 0, 1.55, -0.07, 1, 1.3, 0.8);
  const eyes = [];
  for (const x of [-0.037, 0.037]) {
    part(g, new THREE.SphereGeometry(0.016, 12, 8), mWhite, x, 1.615, 0.093, 1, 0.8, 0.5);
    part(g, new THREE.SphereGeometry(0.008, 10, 6), mDark, x, 1.615, 0.1);
    eyes.push(new THREE.Vector3(x, 1.615, 0.1));
  }
  part(g, new THREE.SphereGeometry(0.014, 8, 6), mSkin, 0, 1.585, 0.107);
  part(g, new THREE.SphereGeometry(0.02, 10, 6), M(0xb05050, 0.5), 0, 1.55, 0.098, 1.4, 0.45, 0.5);

  // фаза бега: ноги и руки в противофазе
  function run(phase, amp = 0.75) {
    const s = Math.sin(phase);
    legs[0].rotation.x = s * amp; legs[1].rotation.x = -s * amp;
    arms[0].rotation.x = -s * amp * 0.9; arms[1].rotation.x = s * amp * 0.9;
    g.position.y = Math.abs(Math.cos(phase)) * 0.05;
  }
  // мировые координаты глаз (с учётом поворота группы)
  const eyesWorld = () => eyes.map((e) => g.localToWorld(e.clone()));
  const faceWorld = () => g.localToWorld(new THREE.Vector3(0, 1.565, 0.1));   // щёки: ниже чёлки и глаз
  return { group: g, run, eyesWorld, faceWorld };
}

export function makeTree(R, s, leafMats, trunkMat) {
  const g = new THREE.Group();
  const h = (3 + R() * 2.5) * s;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.2 * s, h, 8), trunkMat);
  trunk.position.y = h / 2;
  trunk.castShadow = true;
  g.add(trunk);
  const n = 4 + Math.floor(R() * 3), mat = leafMats[Math.floor(R() * leafMats.length)];
  const geo = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < n; i++) {
    const l = new THREE.Mesh(geo, mat);
    l.scale.setScalar((1.1 + R() * 0.9) * s);
    l.position.set((R() - 0.5) * 2.2 * s, h + (R() - 0.2) * 1.6 * s, (R() - 0.5) * 2.2 * s);
    l.rotation.set(R() * 3, R() * 3, 0);
    l.castShadow = true;
    g.add(l);
  }
  return g;
}

// Повторение по кругу: позиция объекта, бегущего по прямой и возвращающегося в начало
export const loopX = (t, speed, span, offset = 0) => ((((t * speed + offset) % span) + span) % span) - span / 2;
