import * as THREE from 'three';

// Конвейер кадра:
// 1) сцена → HDR-текстура + глубина (яркость в относительных физических единицах);
// 2) глубина резкости (пол-разрешения): кружок нерезкости из формулы тонкой линзы, сбор «боке-диском»;
// 3) смешивание резкого и размытого (при съёмке — накопление подкадров для смаза);
// 4) экспозиция, баланс белого, DRO, тональная кривая, Creative Look, шум ISO;
//    в живом изображении — ещё пикинг и зебра;
// 5) экспозамер: уменьшенная копия HDR-кадра (логарифм яркости) читается на процессор.

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';

const COC = /* glsl */`
  #include <packing>
  uniform sampler2D tDepth;
  uniform float uNear, uFar, uF, uN, uS, uPxPerMm;
  float distAt(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar); }
  float cocR(float d){ float D = d * 1000.; float c = (uF * uF / (uN * max(uS - uF, 1.))) * abs(D - uS) / D; return 0.5 * c * uPxPerMm; }
`;

const DOF_FRAG = /* glsl */`
  varying vec2 vUv;
  uniform sampler2D tColor;
  uniform vec2 uTexel;
  uniform float uMaxR, uRadScale;
  ${COC}
  const float GOLDEN = 2.39996323;
  void main(){
    float cd = distAt(vUv);
    float cs = cocR(cd) * 0.5;
    vec3 col = texture2D(tColor, vUv).rgb;
    float tot = 1.0, fg = 0.0;
    float radius = uRadScale;
    float ang = 0.0;
    for (int i = 0; i < 400; i++) {
      if (radius >= uMaxR) break;
      vec2 tc = vUv + vec2(cos(ang), sin(ang)) * uTexel * radius;
      vec3 sc = texture2D(tColor, tc).rgb;
      float sd = distAt(tc);
      float ss = cocR(sd) * 0.5;
      if (sd > cd) ss = clamp(ss, 0.0, cs * 2.0);
      float m = smoothstep(radius - 0.5, radius + 0.5, ss);
      if (sd < cd - 0.05) fg = max(fg, m);
      col += mix(col / tot, sc, m);
      tot += 1.0;
      radius += uRadScale / radius;
      ang += GOLDEN;
    }
    gl_FragColor = vec4(col / tot, max(smoothstep(0.35, 1.0, cs), fg));
  }
`;

const MIX_FRAG = /* glsl */`
  varying vec2 vUv;
  uniform sampler2D tSharp, tBlur;
  void main(){
    vec4 b = texture2D(tBlur, vUv);
    vec3 s = texture2D(tSharp, vUv).rgb;
    gl_FragColor = vec4(mix(s, b.rgb, b.a), 1.0);
  }
`;

const FINAL_FRAG = /* glsl */`
  varying vec2 vUv;
  uniform sampler2D tHDR;
  uniform float uScale, uNoise, uChroma, uSeed, uVignette, uDro, uPeak, uZebra;
  uniform int uLook;
  uniform vec3 uWB, uPeakColor;
  uniform vec2 uRes;
  const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
  float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0., 1.); }
  vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - 0.055, step(0.0031308, c)); }
  vec3 expose(vec3 c){
    c *= uScale * uWB;
    float l = dot(c, LUMA);
    c *= 1.0 + uDro * 0.9 * (1.0 - smoothstep(0.0, 0.3, l));   // DRO: поднимает тени
    return c;
  }
  vec3 sat(vec3 s, float k){ float l = dot(s, LUMA); return mix(vec3(l), s, k); }
  vec3 con(vec3 s, float k){ return (s - 0.5) * k + 0.5; }
  vec3 look(vec3 s){
    float l = dot(s, LUMA);
    if (uLook == 1) s = con(sat(s, 0.92), 0.95) * vec3(1.02, 1.0, 0.98);                 // PT — портрет
    else if (uLook == 2) s = con(sat(s, 0.75), 0.9);                                     // NT — нейтральный
    else if (uLook == 3) s = con(sat(s, 1.38), 1.12);                                    // VV — яркий
    else if (uLook == 4) s = sat(s, 1.3) + 0.03;                                         // VV2 — яркий светлый
    else if (uLook == 5) { s = con(sat(s, 0.8), 0.86) * 0.93 + 0.05;                     // FL — плёнка
      s += vec3(0.02, 0.0, -0.02) * smoothstep(0.4, 1.0, l) + vec3(-0.02, 0.01, 0.035) * (1.0 - smoothstep(0.0, 0.45, l)); }
    else if (uLook == 6) s = con(sat(s, 0.68), 0.84) * 0.92 + vec3(0.07, 0.06, 0.04);    // IN — моментальное фото
    else if (uLook == 7) s = sat(pow(max(s, 0.0), vec3(0.82)), 0.9);                    // SH — светлый, мягкий
    else if (uLook == 8) s = con(vec3(l), 1.08);                                         // BW — ч/б
    else if (uLook == 9) s = vec3(l) * vec3(1.07, 0.95, 0.78);                           // SE — сепия
    return clamp(s, 0.0, 1.0);
  }
  float dispLum(vec2 uv){ return dot(aces(expose(texture2D(tHDR, uv).rgb)), LUMA); }
  void main(){
    vec3 c = expose(texture2D(tHDR, vUv).rgb);
    vec2 p = vUv - 0.5;
    c *= 1.0 - uVignette * dot(p, p) * 2.2;
    vec2 q = floor(vUv * uRes) + uSeed;
    float lum = dot(c, LUMA);
    float amp = uNoise * (0.35 + 0.65 / (1.0 + lum * 6.0));
    c += (hash(q) - 0.5) * amp * max(lum, 0.02) * 6.0;
    c += (vec3(hash(q + 17.1), hash(q + 41.7), hash(q + 83.3)) - 0.5) * uChroma * max(lum, 0.02) * 5.0;
    vec3 s = look(toSRGB(aces(max(c, 0.0))));
    // Зебра: штриховка там, где яркость выше порога
    if (uZebra > 0.0 && dot(s, LUMA) >= uZebra && mod(gl_FragCoord.x + gl_FragCoord.y, 10.0) < 4.0) s = mix(s, vec3(0.15), 0.6);
    // Пикинг: подсветка резких контуров
    if (uPeak > 0.0) {
      vec2 t = 1.0 / uRes;
      float g = abs(dispLum(vUv + vec2(t.x, 0.)) - dispLum(vUv - vec2(t.x, 0.))) + abs(dispLum(vUv + vec2(0., t.y)) - dispLum(vUv - vec2(0., t.y)));
      s = mix(s, uPeakColor, smoothstep(0.16 * uPeak, 0.3 * uPeak, g) * 0.9);
    }
    gl_FragColor = vec4(s, 1.0);
  }
`;

// Экспозамер: каждая ячейка сетки — среднее 4×4 выборок, логарифм яркости упакован в R и G
const METER_FRAG = /* glsl */`
  varying vec2 vUv;
  uniform sampler2D tHDR;
  uniform vec2 uCell;
  void main(){
    float s = 0.0;
    for (int i = 0; i < 4; i++) for (int j = 0; j < 4; j++) {
      vec2 o = (vec2(float(i), float(j)) + 0.5) / 4.0 - 0.5;
      s += dot(texture2D(tHDR, vUv + o * uCell).rgb, vec3(0.2126, 0.7152, 0.0722));
    }
    float v = clamp((log2(max(s / 16.0, 1e-7)) + 24.0) / 40.0, 0.0, 1.0);
    float hi = floor(v * 255.0);
    gl_FragColor = vec4(hi / 255.0, fract(v * 255.0), 0.0, 1.0);
  }
`;

class FSQuad {
  constructor(material) {
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.mesh.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  render(renderer, target) { renderer.setRenderTarget(target); renderer.render(this.scene, this.cam); }
}

const hdrRT = (w, h, depth, samples = 0) => {
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: !!depth, samples });
  if (depth) {
    rt.depthTexture = new THREE.DepthTexture(w, h);
    rt.depthTexture.type = THREE.UnsignedIntType;
  }
  return rt;
};

export const LOOKS = ['ST', 'PT', 'NT', 'VV', 'VV2', 'FL', 'IN', 'SH', 'BW', 'SE'];
export const METER_W = 64, METER_H = 43;

export class Pipeline {
  constructor(renderer, { mobile = false } = {}) {
    this.r = renderer;
    this.mobile = mobile;
    this.budget = mobile ? 110 : 320;
    this.nearest = 0.5;
    this.cocUniforms = {
      tDepth: { value: null }, uNear: { value: 0.1 }, uFar: { value: 1000 },
      uF: { value: 50 }, uN: { value: 2.8 }, uS: { value: 3000 }, uPxPerMm: { value: 30 },
    };
    this.dofMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: DOF_FRAG, depthTest: false, depthWrite: false,
      uniforms: { ...this.cocUniforms, tColor: { value: null }, uTexel: { value: new THREE.Vector2() }, uMaxR: { value: 1 }, uRadScale: { value: 0.5 } },
    });
    this.mixMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: MIX_FRAG, depthTest: false, depthWrite: false,
      uniforms: { tSharp: { value: null }, tBlur: { value: null } },
    });
    this.finalMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FINAL_FRAG, depthTest: false, depthWrite: false,
      uniforms: {
        tHDR: { value: null }, uScale: { value: 1 }, uNoise: { value: 0 }, uChroma: { value: 0 }, uSeed: { value: 0 }, uVignette: { value: 0 },
        uRes: { value: new THREE.Vector2() }, uWB: { value: new THREE.Vector3(1, 1, 1) }, uLook: { value: 0 }, uDro: { value: 0 },
        uPeak: { value: 0 }, uPeakColor: { value: new THREE.Vector3(1, 0.1, 0.1) }, uZebra: { value: 0 },
      },
    });
    this.meterMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: METER_FRAG, depthTest: false, depthWrite: false,
      uniforms: { tHDR: { value: null }, uCell: { value: new THREE.Vector2(1 / METER_W, 1 / METER_H) } },
    });
    this.dofQ = new FSQuad(this.dofMat);
    this.mixQ = new FSQuad(this.mixMat);
    this.finalQ = new FSQuad(this.finalMat);
    this.meterQ = new FSQuad(this.meterMat);
    this.meterRT = new THREE.WebGLRenderTarget(METER_W, METER_H, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.meterPx = new Uint8Array(METER_W * METER_H * 4);
    this.meterLog = new Float32Array(METER_W * METER_H);
    this.w = this.h = 0;
  }

  setSize(w, h) {
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    for (const rt of [this.sceneRT, this.dofRT, this.mixRT]) rt?.dispose();
    this.sceneRT = hdrRT(w, h, true, 4);
    this.dofRT = hdrRT(Math.max(1, w >> 1), Math.max(1, h >> 1), false);
    this.mixRT = hdrRT(w, h, false);
  }

  _optics(p, camera) {
    const u = this.cocUniforms;
    u.uNear.value = camera.near; u.uFar.value = camera.far;
    u.uF.value = p.f; u.uN.value = p.N; u.uS.value = p.focus * 1000;
    u.uPxPerMm.value = this.w / 36;
    const coc = (d) => (p.f * p.f / (p.N * Math.max(p.focus * 1000 - p.f, 1))) * Math.abs(d * 1000 - p.focus * 1000) / (d * 1000);
    const maxR = 0.5 * Math.max(coc(1e5), coc(Math.max(0.1, this.nearest))) * (this.w / 36) * 0.5;
    const capR = this.mobile ? 34 : 56;
    this.dofMat.uniforms.uMaxR.value = Math.min(maxR + 1, capR);
    this.dofMat.uniforms.uRadScale.value = Math.max(0.5, (Math.min(maxR, capR) ** 2) / (2 * this.budget));
    this.dofMat.uniforms.uTexel.value.set(1 / this.dofRT.width, 1 / this.dofRT.height);
  }

  _sceneAndDof(scene, camera) {
    const r = this.r;
    r.setRenderTarget(this.sceneRT);
    r.clear();
    r.render(scene, camera);
    this.cocUniforms.tDepth.value = this.sceneRT.depthTexture;
    this.dofMat.uniforms.tColor.value = this.sceneRT.texture;
    this.dofQ.render(r, this.dofRT);
    this.mixMat.uniforms.tSharp.value = this.sceneRT.texture;
    this.mixMat.uniforms.tBlur.value = this.dofRT.texture;
  }

  // p: { gain, iso, N, wb:[r,g,b], look, dro (0…1), peak (0 — выкл, иначе множитель порога), peakColor, zebra, nr }
  _final(p, scale, target, live) {
    const fu = this.finalMat.uniforms;
    fu.uScale.value = p.gain * scale;
    const nr = p.nr || 1;                  // ослабленное шумоподавление — больше шума на высоких ISO
    const k = p.iso > 800 ? nr : 1 + (nr - 1) * (p.iso / 800);
    fu.uNoise.value = 0.0045 * Math.sqrt(p.iso / 100) * k;
    fu.uChroma.value = p.iso > 3200 ? 0.0028 * Math.sqrt(p.iso / 3200) * k : 0;
    fu.uSeed.value = Math.floor(Math.random() * 1000);
    fu.uVignette.value = Math.max(0, 0.38 - (p.N - 1.4) * 0.07);
    fu.uRes.value.set(this.w, this.h);
    fu.uWB.value.set(...(p.wb || [1, 1, 1]));
    fu.uLook.value = Math.max(0, LOOKS.indexOf(p.look || 'ST'));
    fu.uDro.value = Number(p.dro) || 0;
    fu.uPeak.value = live && p.peak ? p.peak : 0;      // множитель порога: меньше — больше контуров
    if (p.peakColor) fu.uPeakColor.value.set(...p.peakColor);
    fu.uZebra.value = live && p.zebra ? p.zebra : 0;
    this.finalQ.render(this.r, target);
  }

  renderLive(scene, camera, p) {
    this._optics(p, camera);
    this._sceneAndDof(scene, camera);
    this.mixQ.render(this.r, this.mixRT);
    this.finalMat.uniforms.tHDR.value = this.mixRT.texture;
    this._final(p, 1, null, true);
  }

  // Экспозамер по последнему живому кадру: log2 яркости в каждой ячейке сетки METER_W × METER_H
  readMeter() {
    this.meterMat.uniforms.tHDR.value = this.mixRT.texture;
    this.meterQ.render(this.r, this.meterRT);
    this.r.readRenderTargetPixels(this.meterRT, 0, 0, METER_W, METER_H, this.meterPx);
    this.r.setRenderTarget(null);
    const px = this.meterPx, out = this.meterLog;
    // строки идут снизу вверх — переворачиваем, чтобы (0,0) был левым верхним углом
    for (let y = 0; y < METER_H; y++) for (let x = 0; x < METER_W; x++) {
      const i = ((METER_H - 1 - y) * METER_W + x) * 4;
      out[y * METER_W + x] = ((px[i] + px[i + 1] / 255) / 255) * 40 - 24;
    }
    return out;
  }

  capture(scene, camera, p, { frames, step }) {
    const r = this.r;
    this._optics(p, camera);
    const accum = hdrRT(this.w, this.h, false);
    r.setRenderTarget(accum);
    r.setClearColor(0x000000, 0);
    r.clear();
    const autoClear = r.autoClear;
    r.autoClear = false;
    this.mixMat.blending = THREE.AdditiveBlending;
    this.mixMat.transparent = true;
    for (let k = 0; k < frames; k++) {
      step(k);
      this._sceneAndDof(scene, camera);
      this.mixQ.render(r, accum);
    }
    r.autoClear = autoClear;
    r.setClearColor(0x000000, 1);
    this.mixMat.blending = THREE.NormalBlending;
    this.mixMat.transparent = false;
    const out = new THREE.WebGLRenderTarget(this.w, this.h);
    this.finalMat.uniforms.tHDR.value = accum.texture;
    this._final(p, 1 / frames, out, false);
    const px = new Uint8Array(this.w * this.h * 4);
    r.readRenderTargetPixels(out, 0, 0, this.w, this.h, px);
    r.setRenderTarget(null);
    accum.dispose(); out.dispose();
    const c = document.createElement('canvas');
    c.width = this.w; c.height = this.h;
    const g = c.getContext('2d');
    const img = g.createImageData(this.w, this.h);
    const row = this.w * 4;
    for (let y = 0; y < this.h; y++) img.data.set(px.subarray((this.h - 1 - y) * row, (this.h - y) * row), y * row);
    g.putImageData(img, 0, 0);
    return c;
  }
}
