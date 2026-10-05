// Hero "universe": a lunar horizon, a banded planet, a Voyager-style probe and
// four-point sparkle stars. Everything is plain lit geometry — the 1-bit print
// look comes from the dither pass in background.js.
import * as THREE from 'three';

const rand = (a, b) => a + Math.random() * (b - a);

/* ---------------- moon surface ---------------- */
function buildMoon(isMobile) {
  const R = 12;
  const geo = new THREE.SphereGeometry(R, isMobile ? 160 : 260, isMobile ? 60 : 90, 0, Math.PI * 2, 0, 0.62);
  const pos = geo.attributes.position;

  // craters: random directions on the cap, power-law sizes
  const craters = [];
  const N = isMobile ? 55 : 90;
  for (let i = 0; i < N; i++) {
    const phi = Math.acos(1 - Math.random() * (1 - Math.cos(0.6)));
    const th = rand(0, Math.PI * 2);
    const dir = new THREE.Vector3(Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th));
    const r = 0.012 + Math.pow(Math.random(), 3.2) * 0.09; // angular radius
    // cosLimit lets most crater/vertex pairs be rejected with one dot product
    craters.push({ x: dir.x, y: dir.y, z: dir.z, r, h: r * R * rand(0.18, 0.3), cosLimit: Math.cos(r * 1.6) });
  }

  const d = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    d.fromBufferAttribute(pos, i).normalize();
    let h = 0;
    for (let k = 0; k < craters.length; k++) {
      const c = craters[k];
      const dot = d.x * c.x + d.y * c.y + d.z * c.z;
      if (dot < c.cosLimit) continue;
      const x = Math.acos(Math.min(1, dot)) / c.r;
      if (x < 1) h -= (1 - x * x) * c.h;                       // bowl
      h += c.h * 0.4 * Math.exp(-Math.pow((x - 1) / 0.22, 2)); // raised rim
    }
    // fine regolith noise
    h += (Math.sin(d.x * 90) * Math.sin(d.z * 85) + Math.sin(d.x * 210 + d.z * 170) * 0.4) * 0.012;
    pos.setXYZ(i, d.x * (R + h), d.y * (R + h), d.z * (R + h));
  }
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xbdb9b1, roughness: 1, metalness: 0, transparent: true }));
  const pivot = new THREE.Group();
  pivot.add(mesh);
  pivot.rotation.x = 0.42; // tip the pole toward the camera so we look across the surface
  pivot.userData = { R, mesh };
  return pivot;
}

/* ---------------- banded planet ---------------- */
function bandTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const ctx = c.getContext('2d');
  for (let y = 0; y < 256; y++) {
    const t = y / 256;
    const band = 0.55 + 0.25 * Math.sin(t * 38 + Math.sin(t * 9) * 2) + 0.15 * Math.sin(t * 95);
    const l = Math.max(0, Math.min(1, band)) * 255;
    ctx.fillStyle = `rgb(${l},${l},${l})`;
    ctx.fillRect(0, y, 512, 1);
  }
  // storm swirls
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(${Math.random() > 0.5 ? 255 : 40},${Math.random() > 0.5 ? 255 : 40},${Math.random() > 0.5 ? 255 : 40},0.25)`;
    ctx.beginPath();
    ctx.ellipse(rand(0, 512), rand(20, 236), rand(10, 50), rand(2, 7), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function buildPlanet() {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 64, 48),
    new THREE.MeshStandardMaterial({ map: bandTexture(), roughness: 1, metalness: 0, transparent: true }),
  );
  mesh.rotation.z = 0.35;
  return mesh;
}

/* ---------------- Voyager-style probe ---------------- */
function rod(len, r, mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6), mat);
  m.geometry.translate(0, len / 2, 0); // pivot at base
  return m;
}

function truss(len, w, mat, segments = 8) {
  // triangular lattice boom along +y
  const g = new THREE.Group();
  const corners = [0, 1, 2].map((k) => new THREE.Vector2(Math.cos((k / 3) * Math.PI * 2) * w, Math.sin((k / 3) * Math.PI * 2) * w));
  corners.forEach((c) => { const r = rod(len, 0.012, mat); r.position.set(c.x, 0, c.y); g.add(r); });
  const pts = [];
  for (let s = 0; s < segments; s++) {
    const y0 = (s / segments) * len, y1 = ((s + 1) / segments) * len;
    for (let k = 0; k < 3; k++) {
      const a = corners[k], b = corners[(k + 1) % 3];
      pts.push(new THREE.Vector3(a.x, y0, a.y), new THREE.Vector3(b.x, y1, b.y));
      pts.push(new THREE.Vector3(a.x, y1, a.y), new THREE.Vector3(b.x, y1, b.y));
    }
  }
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true })));
  return g;
}

function buildProbe() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.55, metalness: 0.35, side: THREE.DoubleSide, transparent: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x8a8780, roughness: 0.7, metalness: 0.4, transparent: true });
  const probe = new THREE.Group();

  // high-gain dish (parabola), facing +z
  const prof = [];
  for (let i = 0; i <= 24; i++) { const r = (i / 24) * 1.15; prof.push(new THREE.Vector2(r, r * r * 0.26)); }
  const dish = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), mat);
  dish.rotation.x = Math.PI / 2; // bowl opens toward +z
  probe.add(dish);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.03, 8, 64), mat);
  rim.position.z = 0.344;
  probe.add(rim);
  // feed horn struts
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    const s = rod(0.95, 0.01, dark);
    s.position.set(Math.cos(a) * 0.95, Math.sin(a) * 0.95, 0.25);
    s.lookAt(0, 0, 0.9);
    s.rotateX(Math.PI / 2);
    probe.add(s);
  }
  const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 0.25, 12), dark);
  horn.rotation.x = Math.PI / 2;
  horn.position.z = 0.85;
  probe.add(horn);

  // ten-sided bus behind the dish
  const bus = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.38, 10), mat);
  bus.rotation.x = Math.PI / 2;
  bus.position.z = -0.25;
  probe.add(bus);
  const busDark = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.25, 10), dark);
  busDark.rotation.x = Math.PI / 2;
  busDark.position.z = -0.55;
  probe.add(busDark);

  // tetrahedral frame under the bus
  const tetra = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.42, 0)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true }));
  tetra.position.set(-0.45, -0.25, -0.5);
  probe.add(tetra);

  // science boom with scan platform (down-right)
  const sci = truss(2.3, 0.07, mat);
  sci.position.set(0.3, -0.3, -0.4);
  sci.rotation.set(0.2, 0, -2.45);
  probe.add(sci);
  const platform = new THREE.Group();
  const box1 = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.22, 0.26), mat);
  const box2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.3, 0.18), dark);
  box2.position.set(0.22, 0.05, 0);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 12), mat);
  lens.rotation.z = Math.PI / 2;
  lens.position.set(-0.05, -0.18, 0.08);
  platform.add(box1, box2, lens);
  platform.position.set(0, 2.35, 0);
  sci.add(platform);

  // RTG boom (up-left) with three generator canisters
  const rtg = truss(1.9, 0.06, mat, 6);
  rtg.position.set(-0.3, 0.25, -0.4);
  rtg.rotation.set(-0.2, 0, 0.95);
  probe.add(rtg);
  for (let k = 0; k < 3; k++) {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.26, 8), dark);
    can.position.set(0, 1.25 + k * 0.28, 0);
    rtg.add(can);
    for (let f = 0; f < 6; f++) {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.22, 0.1), mat);
      const a = (f / 6) * Math.PI * 2;
      fin.position.set(Math.cos(a) * 0.15, 1.25 + k * 0.28, Math.sin(a) * 0.15);
      fin.rotation.y = -a;
      rtg.add(fin);
    }
  }

  // long magnetometer boom (up-right) and two whip antennas (left)
  const mag = rod(8, 0.014, mat);
  mag.position.set(0.25, 0.4, -0.45);
  mag.rotation.set(0.15, 0, -0.42);
  probe.add(mag);
  const whip1 = rod(6, 0.007, mat);
  whip1.position.set(-0.2, -0.1, -0.5);
  whip1.rotation.set(0, 0, 1.75);
  const whip2 = rod(5, 0.007, mat);
  whip2.position.set(-0.2, -0.15, -0.5);
  whip2.rotation.set(0.3, 0, 2.05);
  probe.add(whip1, whip2);

  // overall pose: dish turned toward the viewer, tipped like the reference print
  probe.rotation.set(-0.3, -0.6, 0.3);
  return probe;
}

/* ---------------- four-point sparkle stars ---------------- */
function sparkleTexture() {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.12);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = '#fff';
  // thin cross spikes
  ctx.beginPath();
  ctx.moveTo(s / 2, 0); ctx.lineTo(s / 2 + 7, s / 2); ctx.lineTo(s / 2, s); ctx.lineTo(s / 2 - 7, s / 2); ctx.closePath();
  ctx.moveTo(0, s / 2); ctx.lineTo(s / 2, s / 2 - 7); ctx.lineTo(s, s / 2); ctx.lineTo(s / 2, s / 2 + 7); ctx.closePath();
  ctx.fill();
  return new THREE.CanvasTexture(c);
}

export function createUniverse({ scene, isMobile, reduced }) {
  const root = new THREE.Group();
  scene.add(root);

  // low, raking sunlight from the left so craters cast long shadows
  const sun = new THREE.DirectionalLight(0xffffff, 3.4);
  sun.position.set(-9, 3.5, 3);
  const fill = new THREE.AmbientLight(0xffffff, 0.06);
  root.add(sun, fill);

  const moon = buildMoon(isMobile);
  const planet = buildPlanet();
  const probe = buildProbe();
  const probeHolder = new THREE.Group();
  probeHolder.add(probe);
  root.add(moon, planet, probeHolder);

  const sparkTex = sparkleTexture();
  const sparkles = [
    [-0.02, 0.36, 0.9], [0.08, 0.1, 0.75], [0.44, 0.02, 0.8], [-0.1, 0.45, 0.5], [0.24, 0.42, 0.6], [0.4, -0.26, 0.55],
  ].map(([x, y, s]) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.userData = { x, y, s, phase: Math.random() * 10 };
    root.add(sp);
    return sp;
  });

  // collect every material so the whole scene can fade out on scroll
  const materials = new Set();
  root.traverse((o) => { if (o.material) materials.add(o.material); });

  let viewW = 1, viewH = 1;
  const base = {};

  function layout(w, h) {
    viewW = w; viewH = h;
    const mobile = window.innerWidth < 900;
    // lunar horizon rises toward the right, leaving the text side open
    const R = moon.userData.R;
    base.moon = new THREE.Vector3(mobile ? viewW * 0.2 : viewW * 0.3, -viewH * (mobile ? 0.62 : 0.47) - R * 0.97, -7);
    moon.position.copy(base.moon);
    moon.rotation.z = mobile ? 0 : 0.1;

    base.planet = new THREE.Vector3(viewW * (mobile ? -0.28 : 0.33), viewH * (mobile ? 0.4 : 0.3), -4);
    planet.position.copy(base.planet);
    planet.scale.setScalar(mobile ? 0.4 : 1);

    base.probe = new THREE.Vector3(mobile ? viewW * 0.22 : viewW * 0.16, mobile ? viewH * 0.33 : viewH * 0.04, 0.5);
    probeHolder.position.copy(base.probe);
    probeHolder.scale.setScalar(mobile ? 0.42 : 0.95);

    sparkles.forEach((sp) => {
      const { x, y, s } = sp.userData;
      sp.position.set(x * viewW, y * viewH, -2);
      sp.scale.setScalar(s * (mobile ? 0.7 : 1));
    });
  }

  let visibleAmt = 1;

  return {
    layout,
    // s = how many screens we've scrolled; mouse = normalised cursor
    update(t, s, mouse) {
      const fade = 1 - THREE.MathUtils.smoothstep(s, 0.2, 0.75);
      visibleAmt = fade;
      root.visible = fade > 0.001;
      if (!root.visible) return;
      materials.forEach((m) => { m.opacity = fade; });

      // as you scroll it feels like lifting off: the moon sinks away,
      // the probe drifts up and out, the distant planet barely moves
      const lift = s * viewH;
      moon.position.y = base.moon.y - lift * 0.7;
      planet.position.y = base.planet.y + lift * 0.15;
      probeHolder.position.y = base.probe.y + lift * 0.45;
      probeHolder.position.x = base.probe.x + s * viewW * 0.15;

      if (!reduced) {
        moon.userData.mesh.rotation.y = t * 0.012;
        planet.rotation.y = t * 0.05;
        probe.rotation.y = -0.6 + Math.sin(t * 0.15) * 0.12 + mouse.x * 0.18;
        probe.rotation.x = -0.35 + Math.sin(t * 0.11) * 0.06 - mouse.y * 0.1;
        probeHolder.position.y += Math.sin(t * 0.4) * 0.06;
        sparkles.forEach((sp) => {
          const { s: sz, phase } = sp.userData;
          const k = 0.75 + 0.25 * Math.sin(t * 1.3 + phase);
          sp.scale.setScalar(sz * k * (window.innerWidth < 900 ? 0.7 : 1));
        });
      }
    },
    get amount() { return visibleAmt; },
  };
}
