// Particle field: Three.js renders, Anime.js drives every morph.
// Shapes: scatter → star dust over the universe scene (hero) → drift → eye (work) → globe (contact)
import * as THREE from 'three';
import { animate } from 'animejs';
import { createBackground } from './background.js';
import { createUniverse } from './universe.js';

const COLOR_A = new THREE.Color('#f1ece2');
const COLOR_B = new THREE.Color('#c8f169');
const SPREAD = 0.55; // how much of the morph is staggered across particles

const vertexShader = /* glsl */ `
  attribute vec3 aFrom;
  attribute vec3 aTo;
  attribute float aDelay;
  attribute float aRand;

  uniform float uProgress;
  uniform float uTime;
  uniform float uDrift;
  uniform vec2  uMouse;
  uniform float uMouseStrength;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uOpacity;
  uniform float uVel;
  uniform vec3  uColorA;
  uniform vec3  uColorB;

  varying vec3 vColor;
  varying float vAlpha;

  float easeInOutCubic(float t) {
    return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
  }

  void main() {
    float p = clamp(uProgress * (1.0 + ${SPREAD.toFixed(2)}) - aDelay * ${SPREAD.toFixed(2)}, 0.0, 1.0);
    float e = easeInOutCubic(p);
    vec3 pos = mix(aFrom, aTo, e);

    // particles lift out of the plane mid-flight
    pos.z += sin(e * 3.14159) * (aRand - 0.5) * 0.8;

    // slow organic breathing
    pos += vec3(
      sin(uTime * 0.6 + aRand * 20.0),
      cos(uTime * 0.5 + aRand * 17.0),
      sin(uTime * 0.4 + aRand * 11.0)
    ) * 0.012 * uDrift;

    vec4 world = modelMatrix * vec4(pos, 1.0);

    // cursor gently pushes particles aside, like a hand through water
    vec2 d = world.xy - uMouse;
    float dist = length(d);
    float force = smoothstep(1.1, 0.0, dist) * uMouseStrength;
    world.xy += normalize(d + 0.0001) * force * 0.45;
    world.z  += force * 0.6;

    // scroll velocity shears particles slightly, like motion blur in space
    world.y += uVel * (aRand - 0.5) * 0.012;

    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixelRatio * (0.55 + aRand * 0.9) * (12.0 / -mv.z);

    vColor = aRand > 0.86 ? uColorB : uColorA;
    vAlpha = uOpacity * (0.35 + aRand * 0.65) * (1.0 + force * 0.8);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d);
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`;

/* ---------- shape builders (unit space, roughly [-1, 1]) ---------- */

const rand = (a, b) => a + Math.random() * (b - a);

function scatterShape(n) {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = rand(2.5, 5);
    const t = rand(0, Math.PI * 2);
    const ph = Math.acos(rand(-1, 1));
    out[i * 3] = r * Math.sin(ph) * Math.cos(t);
    out[i * 3 + 1] = r * Math.sin(ph) * Math.sin(t);
    out[i * 3 + 2] = r * Math.cos(ph) - 2;
  }
  return out;
}

function eyeShape(n) {
  const out = new Float32Array(n * 3);
  const H = 0.46;
  const upper = (x) => H * Math.cos((x * Math.PI) / 2);
  const lower = (x) => -H * 0.82 * Math.cos((x * Math.PI) / 2);
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    let x, y;
    if (r < 0.3) {
      // eyelids
      x = rand(-1, 1);
      y = (Math.random() < 0.55 ? upper(x) : lower(x)) + rand(-0.012, 0.012);
    } else if (r < 0.72) {
      // iris with radial fibres
      const ray = Math.floor(Math.random() * 120) / 120 * Math.PI * 2 + rand(-0.008, 0.008);
      const rr = rand(0.17, 0.4);
      x = Math.cos(ray) * rr;
      y = Math.sin(ray) * rr;
    } else if (r < 0.84) {
      // pupil ring
      const a = rand(0, Math.PI * 2);
      const rr = rand(0.12, 0.135);
      x = Math.cos(a) * rr;
      y = Math.sin(a) * rr;
    } else {
      // faint scan lines across the eye — a nod to detection
      x = rand(-0.95, 0.95);
      const k = Math.ceil(Math.random() * 5) / 6;
      y = lower(x) + (upper(x) - lower(x)) * k;
      if (Math.hypot(x, y) < 0.42) { x = rand(-1, -0.45) * Math.sign(rand(-1, 1)); y = lower(x) + (upper(x) - lower(x)) * k; }
    }
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = rand(-0.03, 0.03);
  }
  return out;
}

function globeShape(n) {
  const out = new Float32Array(n * 3);
  const sphereN = Math.floor(n * 0.7);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const R = 0.78;
  for (let i = 0; i < sphereN; i++) {
    const y = 1 - (i / (sphereN - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const t = golden * i;
    out[i * 3] = Math.cos(t) * rad * R;
    out[i * 3 + 1] = y * R;
    out[i * 3 + 2] = Math.sin(t) * rad * R;
  }
  // tilted orbit ring
  const tilt = 0.42;
  for (let i = sphereN; i < n; i++) {
    const a = rand(0, Math.PI * 2);
    const rr = rand(1.08, 1.16);
    const x = Math.cos(a) * rr;
    const z = Math.sin(a) * rr;
    out[i * 3] = x;
    out[i * 3 + 1] = z * Math.sin(tilt) + rand(-0.01, 0.01);
    out[i * 3 + 2] = z * Math.cos(tilt);
  }
  return out;
}

function driftShape(n) {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    out[i * 3] = rand(-1, 1);
    out[i * 3 + 1] = rand(-1, 1);
    out[i * 3 + 2] = rand(-1, 1);
  }
  return out;
}

/* ---------- scene ---------- */

export async function initHero(canvas) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = matchMedia('(max-width: 768px)').matches;
  const COUNT = isMobile ? 1600 : 3600;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: false, powerPreference: 'high-performance' });
  } catch (_) {
    canvas.remove();
    return { setShape() {}, setVelocity() {}, setScroll() {} };
  }
  const dpr = Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2);
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.z = 12;

  // build in slices with a frame between each, so the intro animation keeps running
  const breathe = () => new Promise((r) => requestAnimationFrame(() => r()));
  const bg = createBackground({ scene, camera, renderer, isMobile, reduced, dpr });
  await breathe();
  const universe = createUniverse({ scene, isMobile, reduced });
  await breathe();
  let scrollY = window.scrollY;

  const shapes = {
    scatter: scatterShape(COUNT),
    universe: driftShape(COUNT),
    eye: eyeShape(COUNT),
    globe: globeShape(COUNT),
    drift: driftShape(COUNT),
  };

  const geometry = new THREE.BufferGeometry();
  const from = new Float32Array(shapes.scatter);
  const to = new Float32Array(shapes.scatter);
  const delay = new Float32Array(COUNT);
  const rnd = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) rnd[i] = Math.random();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
  geometry.setAttribute('aFrom', new THREE.BufferAttribute(from, 3));
  geometry.setAttribute('aTo', new THREE.BufferAttribute(to, 3));
  geometry.setAttribute('aDelay', new THREE.BufferAttribute(delay, 1));
  geometry.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);

  const uniforms = {
    uProgress: { value: 1 },
    uTime: { value: 0 },
    uDrift: { value: reduced ? 0 : 1 },
    uMouse: { value: new THREE.Vector2(99, 99) },
    uMouseStrength: { value: 0 },
    uSize: { value: isMobile ? 5 : 5.5 },
    uPixelRatio: { value: dpr },
    uOpacity: { value: 0 },
    uVel: { value: 0 },
    uColorA: { value: COLOR_A },
    uColorB: { value: COLOR_B },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader, fragmentShader, uniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  const tiltGroup = new THREE.Group(); // follows the cursor slightly
  const layoutGroup = new THREE.Group(); // positioned/scaled per state
  layoutGroup.add(points);
  tiltGroup.add(layoutGroup);
  scene.add(tiltGroup);

  /* ---------- layout per state ---------- */
  let viewW = 1, viewH = 1;
  function layoutFor(state) {
    const mobile = window.innerWidth < 900;
    const s = (v) => ({ x: v, y: v, z: v });
    switch (state) {
      case 'universe':
        // particles become faint star dust drifting through the printed scene
        return { x: 0, y: 0, scale: { x: viewW * 0.65, y: viewH * 0.65, z: 3 }, opacity: 0.05 };
      case 'eye':
        return mobile
          ? { x: 0, y: 0, scale: s(viewW * 0.46), opacity: 0.15 }
          : { x: 0, y: -viewH * 0.04, scale: s(Math.min(viewW * 0.3, 4.6)), opacity: 0.17 };
      case 'globe':
        return mobile
          ? { x: 0, y: viewH * 0.26, scale: s(viewW * 0.36), opacity: 0.45 }
          : { x: viewW * 0.3, y: -viewH * 0.02, scale: s(Math.min(viewH * 0.22, viewW * 0.14)), opacity: 0.85 };
      case 'drift':
      default:
        return { x: 0, y: 0, scale: { x: viewW * 0.6, y: viewH * 0.6, z: 2 }, opacity: 0.22 };
    }
  }

  function applyLayout(state, duration) {
    const l = layoutFor(state);
    const ease = 'inOutQuart';
    animate(layoutGroup.position, { x: l.x, y: l.y, duration, ease });
    animate(layoutGroup.scale, { x: l.scale.x, y: l.scale.y, z: l.scale.z, duration, ease });
    animate(uniforms.uOpacity, { value: l.opacity, duration, ease });
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    bg.resize(w, h);
    viewH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    viewW = viewH * camera.aspect;
    universe.layout(viewW, viewH);
  }

  /* ---------- morphing (Anime.js drives uProgress) ---------- */
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  let current = 'scatter';
  let morphAnim = null;

  function captureCurrent() {
    const p = uniforms.uProgress.value;
    if (p >= 1) { from.set(to); return; }
    for (let i = 0; i < COUNT; i++) {
      const e = easeInOutCubic(Math.min(1, Math.max(0, p * (1 + SPREAD) - delay[i] * SPREAD)));
      for (let k = 0; k < 3; k++) {
        const j = i * 3 + k;
        from[j] = from[j] + (to[j] - from[j]) * e;
      }
    }
  }

  function setShape(state, { duration = 2200 } = {}) {
    if (!shapes[state] || state === current) return;
    if (reduced) {
      // no morphing: keep the static mark, only dim it outside the hero
      animate(uniforms.uOpacity, { value: state === 'universe' ? layoutFor('universe').opacity : 0.12, duration: 300 });
      bg.setTint(state);
      current = state;
      return;
    }
    morphAnim?.pause();
    captureCurrent();
    const target = shapes[state];
    to.set(target);

    // stagger from the centre outward — Anime.js' stagger({ from: 'center' }) idea, done per-particle on the GPU
    let maxR = 0.0001;
    for (let i = 0; i < COUNT; i++) maxR = Math.max(maxR, Math.hypot(target[i * 3], target[i * 3 + 1]));
    for (let i = 0; i < COUNT; i++) {
      delay[i] = (Math.hypot(target[i * 3], target[i * 3 + 1]) / maxR) * 0.75 + rnd[i] * 0.25;
    }
    geometry.attributes.aFrom.needsUpdate = true;
    geometry.attributes.aTo.needsUpdate = true;
    geometry.attributes.aDelay.needsUpdate = true;

    uniforms.uProgress.value = 0;
    morphAnim = animate(uniforms.uProgress, { value: 1, duration, ease: 'linear' });

    // unwind the globe spin smoothly when leaving it
    if (current === 'globe') {
      const full = Math.PI * 2;
      animate(points.rotation, { y: Math.round(points.rotation.y / full) * full, duration, ease: 'inOutQuart' });
    }
    applyLayout(state, duration);
    bg.setTint(state);
    current = state;
  }

  /* ---------- pointer ---------- */
  const mouseNdc = new THREE.Vector2(0, 0);
  const mouseWorld = new THREE.Vector2(99, 99);
  let pointerActive = false;
  let lastMove = 0;
  if (!reduced && matchMedia('(pointer: fine)').matches) {
    window.addEventListener('pointermove', (e) => {
      mouseNdc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      pointerActive = true;
      lastMove = performance.now();
    }, { passive: true });
    document.addEventListener('pointerleave', () => { pointerActive = false; });
  }

  /* ---------- loop ---------- */
  const clock = new THREE.Timer();
  function tick() {
    clock.update();
    const t = clock.getElapsed();
    if (!reduced) uniforms.uTime.value = t;

    // smoothed cursor in world space (z = 0 plane)
    const tx = mouseNdc.x * viewW / 2;
    const ty = mouseNdc.y * viewH / 2;
    if (pointerActive) {
      mouseWorld.x += (tx - mouseWorld.x) * 0.12;
      mouseWorld.y += (ty - mouseWorld.y) * 0.12;
    }
    uniforms.uMouse.value.copy(mouseWorld);
    const idle = performance.now() - lastMove > 1800;
    const targetStrength = pointerActive && !idle ? 1 : 0;
    uniforms.uMouseStrength.value += (targetStrength - uniforms.uMouseStrength.value) * 0.05;

    // subtle parallax tilt
    tiltGroup.rotation.y += (mouseNdc.x * 0.12 - tiltGroup.rotation.y) * 0.04;
    tiltGroup.rotation.x += (-mouseNdc.y * 0.08 - tiltGroup.rotation.x) * 0.04;

    if (current === 'globe' && !reduced) points.rotation.y += 0.0025;

    universe.update(t, scrollY / window.innerHeight, mouseNdc);
    bg.setDither(universe.amount);
    bg.update(t, mouseNdc);
    uniforms.uVel.value = bg.velocity;
    bg.render();
  }

  resize();
  window.addEventListener('resize', () => {
    resize();
    if (!reduced) return applyLayout(current, 600);
    const l = layoutFor('universe');
    layoutGroup.position.set(l.x, l.y, 0);
    layoutGroup.scale.set(l.scale.x, l.scale.y, l.scale.z);
  });
  document.addEventListener('visibilitychange', () => {
    renderer.setAnimationLoop(document.hidden ? null : tick);
  });
  // compile shaders off the main thread where supported, so the intro never stalls
  try { await renderer.compileAsync(scene, camera); } catch (_) { /* falls back to compiling on first frame */ }
  renderer.setAnimationLoop(tick);

  // intro: scatter → universe
  applyLayout('universe', 0);
  uniforms.uOpacity.value = 0;
  if (reduced) {
    to.set(shapes.universe); from.set(shapes.universe);
    geometry.attributes.aFrom.needsUpdate = true;
    geometry.attributes.aTo.needsUpdate = true;
    current = 'universe';
    animate(uniforms.uOpacity, { value: layoutFor('universe').opacity, duration: 0 });
  } else {
    setShape('universe', { duration: 2800 });
  }

  // the eye glides toward whichever project is hovered
  function focus(nx) {
    if (current !== 'eye' || reduced) return;
    const base = layoutFor('eye');
    animate(layoutGroup.position, { x: base.x + nx * viewW * 0.3, duration: 1400, ease: 'outExpo' });
  }

  return {
    setShape: (s) => setShape(s),
    setVelocity: (v) => bg.setVelocity(v),
    setScroll: (y) => { scrollY = y; bg.setScroll(y); },
    focus,
  };
}
