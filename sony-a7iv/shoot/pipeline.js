import * as THREE from 'three';

// Конвейер кадра:
// 1) сцена → HDR-текстура + глубина;
// 2) глубина резкости (пол-разрешения): размер кружка нерезкости из формулы тонкой линзы, сбор «боке-диском»;
// 3) смешивание резкого и размытого (при съёмке — накопление подкадров для смаза);
// 4) экспозиция, тональная кривая, виньетирование, шум ISO.

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';

const COC = /* glsl */`
  #include <packing>
  uniform sampler2D tDepth;
  uniform float uNear, uFar, uF, uN, uS, uPxPerMm;
  float distAt(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar); }
  // радиус кружка нерезкости в пикселях полного кадра
  float cocR(float d){ float D = d * 1000.; float c = (uF * uF / (uN * max(uS - uF, 1.))) * abs(D - uS) / D; return 0.5 * c * uPxPerMm; }
`;

const DOF_FRAG = /* glsl */`
  varying vec2 vUv;
  uniform sampler2D tColor;
  uniform vec2 uTexel;          // размер пикселя половинного разрешения в uv
  uniform float uMaxR, uRadScale;
  ${COC}
  const float GOLDEN = 2.39996323;
  void main(){
    float cd = distAt(vUv);
    float cs = cocR(cd) * 0.5;                      // в пикселях половинного разрешения
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
      if (sd > cd) ss = clamp(ss, 0.0, cs * 2.0);   // резкий передний план не «втягивает» размытый фон
      float m = smoothstep(radius - 0.5, radius + 0.5, ss);
      if (sd < cd - 0.05) fg = max(fg, m);          // размытый передний план растекается на резкие пиксели
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
  uniform float uScale, uNoise, uChroma, uSeed, uVignette;
  uniform vec2 uRes;
  float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0., 1.); }
  vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - 0.055, step(0.0031308, c)); }
  void main(){
    vec3 c = texture2D(tHDR, vUv).rgb * uScale;
    vec2 p = vUv - 0.5;
    c *= 1.0 - uVignette * dot(p, p) * 2.2;
    // шум сенсора: сильнее в тенях, на высоких ISO — цветной
    vec2 q = floor(vUv * uRes) + uSeed;
    float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float amp = uNoise * (0.35 + 0.65 / (1.0 + lum * 6.0));
    c += (hash(q) - 0.5) * amp * max(lum, 0.02) * 6.0;
    c += (vec3(hash(q + 17.1), hash(q + 41.7), hash(q + 83.3)) - 0.5) * uChroma * max(lum, 0.02) * 5.0;
    c = aces(max(c, 0.0));
    gl_FragColor = vec4(toSRGB(c), 1.0);
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

export class Pipeline {
  constructor(renderer, { mobile = false } = {}) {
    this.r = renderer;
    this.mobile = mobile;
    this.budget = mobile ? 110 : 320;         // число выборок в боке-диске (качество/скорость)
    this.nearest = 0.5;                       // ближайший предмет в кадре, м (задаёт приложение)
    this.expBase = 1.0;
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
      uniforms: { tHDR: { value: null }, uScale: { value: 1 }, uNoise: { value: 0 }, uChroma: { value: 0 }, uSeed: { value: 0 }, uVignette: { value: 0 }, uRes: { value: new THREE.Vector2() } },
    });
    this.dofQ = new FSQuad(this.dofMat);
    this.mixQ = new FSQuad(this.mixMat);
    this.finalQ = new FSQuad(this.finalMat);
    this.w = this.h = 0;
  }

  setSize(w, h) {
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    for (const rt of [this.sceneRT, this.dofRT, this.mixRT]) rt?.dispose();
    this.sceneRT = hdrRT(w, h, true, 4);       // MSAA: ровные края у резких объектов
    this.dofRT = hdrRT(Math.max(1, w >> 1), Math.max(1, h >> 1), false);
    this.mixRT = hdrRT(w, h, false);
  }

  // p: { f, N, focus (м), exposure (EV отклонения), iso, camera }
  _optics(p, camera) {
    const u = this.cocUniforms;
    u.uNear.value = camera.near; u.uFar.value = camera.far;
    u.uF.value = p.f; u.uN.value = p.N; u.uS.value = p.focus * 1000;
    u.uPxPerMm.value = this.w / 36;
    // самый большой кружок в кадре: на бесконечности или на ближайшем предмете
    const coc = (d) => (p.f * p.f / (p.N * Math.max(p.focus * 1000 - p.f, 1))) * Math.abs(d * 1000 - p.focus * 1000) / (d * 1000);
    const maxR = 0.5 * Math.max(coc(1e5), coc(Math.max(0.1, this.nearest))) * (this.w / 36) * 0.5;
    const capR = this.mobile ? 34 : 56;
    this.dofMat.uniforms.uMaxR.value = Math.min(maxR + 1, capR);
    this.dofMat.uniforms.uRadScale.value = Math.max(0.5, (Math.min(maxR, capR) ** 2) / (2 * this.budget));
    this.dofMat.uniforms.uTexel.value.set(1 / this.dofRT.width, 1 / this.dofRT.height);
  }

  _sceneAndDof(scene, camera, p) {
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

  _final(p, scale, target) {
    const fu = this.finalMat.uniforms;
    fu.uScale.value = this.expBase * 2 ** p.exposure * scale;
    const isoK = Math.sqrt(p.iso / 100);
    fu.uNoise.value = 0.0045 * isoK;
    fu.uChroma.value = p.iso > 3200 ? 0.0028 * Math.sqrt(p.iso / 3200) : 0;
    fu.uSeed.value = Math.floor(Math.random() * 1000);
    fu.uVignette.value = Math.max(0, 0.38 - (p.N - 1.4) * 0.07);   // открытая диафрагма — темнее углы
    fu.uRes.value.set(this.w, this.h);
    this.finalQ.render(this.r, target);
  }

  // Живое изображение в видоискателе
  renderLive(scene, camera, p) {
    this._optics(p, camera);
    this._sceneAndDof(scene, camera, p);
    this.mixQ.render(this.r, this.mixRT);
    this.finalMat.uniforms.tHDR.value = this.mixRT.texture;
    this._final(p, 1, null);
  }

  // Снимок: K подкадров за время выдержки (движение объектов + дрожание рук), усреднение
  capture(scene, camera, p, { frames, step }) {
    const r = this.r;
    this._optics(p, camera);
    const accum = hdrRT(this.w, this.h, false);
    r.setRenderTarget(accum);
    r.setClearColor(0x000000, 0);
    r.clear();
    const autoClear = r.autoClear;
    r.autoClear = false;                      // иначе каждый подкадр стирал бы предыдущие
    this.mixMat.blending = THREE.AdditiveBlending;
    this.mixMat.transparent = true;
    for (let k = 0; k < frames; k++) {
      step(k);
      this._sceneAndDof(scene, camera, p);
      this.mixQ.render(r, accum);
    }
    r.autoClear = autoClear;
    r.setClearColor(0x000000, 1);
    this.mixMat.blending = THREE.NormalBlending;
    this.mixMat.transparent = false;
    const out = new THREE.WebGLRenderTarget(this.w, this.h);
    this.finalMat.uniforms.tHDR.value = accum.texture;
    this._final(p, 1 / frames, out);
    const px = new Uint8Array(this.w * this.h * 4);
    r.readRenderTargetPixels(out, 0, 0, this.w, this.h, px);
    r.setRenderTarget(null);
    accum.dispose(); out.dispose();
    // WebGL отдаёт строки снизу вверх — переворачиваем
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
