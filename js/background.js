// Atmosphere behind the particle morph: a slow flowing nebula, a deep starfield
// that parallaxes with scroll, and a post-processing stack (bloom + lens pass).
import * as THREE from 'three';
import { animate } from 'animejs';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Colours are written raw (no colour management) so they match the CSS exactly.
const raw = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
};

// tint of the nebula per section
const TINTS = {
  universe: raw('#8a8f99'), // neutral — the hero is printed in 1-bit
  drift: raw('#6f7a8c'), // neutral slate while reading
  eye: raw('#22d3ee'),   // cyan — echoes the DeepDrishti UI
  globe: raw('#ffb05b'), // warm — "let's talk"
};

/* ---------------- nebula (full-screen quad) ---------------- */
const nebulaVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.999, 1.0);
  }
`;

const nebulaFragment = /* glsl */ `
  uniform float uTime;
  uniform vec2  uRes;
  uniform vec2  uMouse;
  uniform vec3  uTint;
  uniform float uIntensity;
  uniform float uScroll;
  uniform float uDim;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = rot * p * 2.02; a *= 0.5; }
    return v;
  }

  void main() {
    float aspect = uRes.x / uRes.y;
    vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
    p.y += uScroll * 0.15;
    float t = uTime * 0.025;

    // domain-warped fbm — slow, smoky flow
    vec2 q = vec2(fbm(p * 1.3 + vec2(0.0, t)), fbm(p * 1.3 + vec2(5.2, -t)));
    vec2 r = vec2(fbm(p * 1.6 + 3.5 * q + vec2(1.7, 9.2) + t * 1.4),
                  fbm(p * 1.6 + 3.5 * q + vec2(8.3, 2.8) - t));
    float f = fbm(p * 1.1 + 3.0 * r);

    vec3 base = vec3(0.043, 0.043, 0.047);
    float cloud = pow(f, 3.2) * 1.6;
    float rim = smoothstep(0.55, 0.75, f) * 0.25;

    // a soft light that follows the cursor
    vec2 m = uMouse * vec2(aspect * 0.5, 0.5);
    float glow = smoothstep(0.7, 0.0, length(p - m)) * 0.06;

    // faint light source top-right
    float key = smoothstep(1.3, 0.0, length(p - vec2(aspect * 0.35, 0.45))) * 0.05;

    vec3 col = base + uTint * (cloud * 0.16 + rim * 0.08 + glow + key) * uIntensity;

    // keep edges darker
    float vig = smoothstep(1.25, 0.25, length(p * vec2(0.85, 1.0)));
    col = mix(base * 0.7, col, vig);
    col = mix(base, col, uDim);
    gl_FragColor = vec4(col, 1.0);
  }
`;

/* ---------------- stars ---------------- */
const starVertex = /* glsl */ `
  attribute float aRand;
  uniform float uTime;
  uniform float uScroll;
  uniform float uVel;
  uniform float uPixelRatio;
  uniform float uDim;
  varying float vAlpha;
  void main() {
    vec3 pos = position;
    float depth = (pos.z + 30.0) / 22.0;           // 0 far → 1 near
    pos.y = mod(pos.y + uScroll * (0.6 + depth * 2.4) + 16.0, 32.0) - 16.0;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    float tw = 0.55 + 0.45 * sin(uTime * (0.6 + aRand * 1.8) + aRand * 40.0);
    gl_PointSize = (1.0 + aRand * 1.8 + abs(uVel) * depth * 0.12) * uPixelRatio * (14.0 / -mv.z);
    vAlpha = (0.15 + depth * 0.45) * tw * uDim;
  }
`;
const starFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(vec3(0.92, 0.9, 0.86), a * vAlpha);
  }
`;

/* ---------------- final pass: lens fringe + 1-bit dither for the hero ---------------- */
const LensShader = {
  uniforms: {
    tDiffuse: { value: null },
    uAberration: { value: 0 },
    uDither: { value: 0 },
    uPixel: { value: 2 },
    uFloor: { value: 0.075 },
    uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uAberration;
    uniform float uDither;
    uniform float uPixel;
    uniform float uFloor;
    uniform vec2  uRes;
    varying vec2 vUv;

    // ordered (Bayer) dither for halftone shading, white noise for the dark sky
    float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
    float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
    float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    void main() {
      vec2 dir = vUv - 0.5;
      float d = length(dir);
      vec3 c;
      c.r = texture2D(tDiffuse, vUv - dir * uAberration * d * 2.0).r;
      c.g = texture2D(tDiffuse, vUv).g;
      c.b = texture2D(tDiffuse, vUv + dir * uAberration * d * 2.0).b;
      if (uDither > 0.001) {
        vec2 cell = floor(gl_FragCoord.xy / uPixel);
        vec3 s = texture2D(tDiffuse, (cell + 0.5) * uPixel / uRes).rgb;
        float l = dot(s, vec3(0.299, 0.587, 0.114));
        l = pow(clamp((l - uFloor) * 1.8, 0.0, 1.0), 0.8);
        float th = mix(hash(cell), bayer8(cell), smoothstep(0.02, 0.22, l));
        float on = step(th, l) * step(0.1, l);              // faint haze drops out entirely
        on = max(on, step(0.9983, hash(cell + 17.0)));   // stippled star dust
        vec3 ink = mix(vec3(0.043, 0.043, 0.047), vec3(0.945, 0.925, 0.886), on);
        c = mix(c, ink, uDither);
      }
      gl_FragColor = vec4(c, 1.0);
    }
  `,
};

export function createBackground({ scene, camera, renderer, isMobile, reduced, dpr }) {
  /* nebula */
  const nebulaUniforms = {
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uMouse: { value: new THREE.Vector2(0, 0) },
    uTint: { value: new THREE.Vector3(TINTS.universe.r, TINTS.universe.g, TINTS.universe.b) },
    uIntensity: { value: 0 },
    uScroll: { value: 0 },
    uDim: { value: 1 },
  };
  const nebula = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ vertexShader: nebulaVertex, fragmentShader: nebulaFragment, uniforms: nebulaUniforms, depthTest: false, depthWrite: false }),
  );
  nebula.frustumCulled = false;
  nebula.renderOrder = -10;
  scene.add(nebula);

  /* stars */
  const STARS = isMobile ? 500 : 1400;
  const sPos = new Float32Array(STARS * 3);
  const sRnd = new Float32Array(STARS);
  for (let i = 0; i < STARS; i++) {
    sPos[i * 3] = (Math.random() - 0.5) * 50;
    sPos[i * 3 + 1] = (Math.random() - 0.5) * 32;
    sPos[i * 3 + 2] = -30 + Math.random() * 22;
    sRnd[i] = Math.random();
  }
  const sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sGeo.setAttribute('aRand', new THREE.BufferAttribute(sRnd, 1));
  const starUniforms = {
    uTime: { value: 0 }, uScroll: { value: 0 }, uVel: { value: 0 }, uPixelRatio: { value: dpr }, uDim: { value: 1 },
  };
  const stars = new THREE.Points(sGeo, new THREE.ShaderMaterial({
    vertexShader: starVertex, fragmentShader: starFragment, uniforms: starUniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  stars.frustumCulled = false;
  stars.renderOrder = -5;
  scene.add(stars);

  /* post-processing (desktop only — phones render directly) */
  // phones skip the bloom but keep the final pass (it carries the dither)
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(dpr, 1.5));
  composer.addPass(new RenderPass(scene, camera));
  let bloom = null;
  if (!isMobile) {
    bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.55, 0.6, 0.18);
    composer.addPass(bloom);
  }
  const lens = new ShaderPass(LensShader);
  lens.uniforms.uPixel.value = Math.round(2 * dpr);
  lens.uniforms.uFloor.value = isMobile ? 0.15 : 0.11; // calmer sky behind text on phones
  composer.addPass(lens);
  const bufferSize = new THREE.Vector2();

  // fade the atmosphere in
  animate(nebulaUniforms.uIntensity, { value: 1, duration: 2400, ease: 'outQuad', delay: 200 });

  let vel = 0;
  let scrollY = window.scrollY;

  return {
    setTint(state) {
      const t = TINTS[state] || TINTS.drift;
      animate(nebulaUniforms.uTint.value, { x: t.r, y: t.g, z: t.b, duration: 2000, ease: 'inOutQuad' });
    },
    setVelocity(v) { if (!reduced) vel = Math.max(-40, Math.min(40, v)); },
    setScroll(y) { scrollY = y; },
    resize(w, h) {
      nebulaUniforms.uRes.value.set(w, h);
      composer.setSize(w, h);
      if (bloom) bloom.resolution.set(w / 2, h / 2);
      renderer.getDrawingBufferSize(bufferSize);
      lens.uniforms.uRes.value.copy(bufferSize);
    },
    update(t, mouseNdc) {
      nebulaUniforms.uTime.value = reduced ? 0 : t;
      nebulaUniforms.uMouse.value.lerp(mouseNdc, 0.04);
      const s = scrollY / window.innerHeight;
      nebulaUniforms.uScroll.value += (s - nebulaUniforms.uScroll.value) * 0.08;
      starUniforms.uTime.value = t;
      starUniforms.uScroll.value = nebulaUniforms.uScroll.value;
      starUniforms.uVel.value += (vel - starUniforms.uVel.value) * 0.1;
      vel *= 0.9;
      {
        const target = Math.min(Math.abs(starUniforms.uVel.value) * 0.00006, 0.0025);
        lens.uniforms.uAberration.value += (target - lens.uniforms.uAberration.value) * 0.15;
      }
    },
    render() {
      composer.render();
    },
    setDither(v) {
      lens.uniforms.uDither.value = v;
      starUniforms.uDim.value = 1 - 0.85 * v; // the print has its own star stipple
      nebulaUniforms.uDim.value = 1 - v;      // clouds would dither into noise
      if (bloom) bloom.strength = 0.55 * Math.pow(1 - v, 3); // no glow while printed
    },
    get velocity() { return starUniforms.uVel.value; },
  };
}
