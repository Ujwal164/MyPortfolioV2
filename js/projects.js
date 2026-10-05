// Each project card owns a small motion study. It plays once when the card
// scrolls into view, and replays on hover.
import { animate, createTimeline, createAnimatable, stagger, utils, svg, scrambleText, onScroll } from 'animejs';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
};
const html = (str) => {
  const t = document.createElement('template');
  t.innerHTML = str.trim();
  return t.content.firstElementChild;
};
const countTo = (node, to, { duration = 1400, suffix = '' } = {}) => {
  const o = { v: 0 };
  return animate(o, { v: to, duration, ease: 'outExpo', onUpdate: () => { node.textContent = Math.round(o.v) + suffix; } });
};

/* ---------------- DeepDrishti ---------------- */
function deepfake(root) {
  const s = el('svg', { viewBox: '0 0 600 400', preserveAspectRatio: 'xMidYMid meet' }, root);
  s.innerHTML = `
    <defs>
      <radialGradient id="heat" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ff6b5b" stop-opacity=".9"/>
        <stop offset="45%" stop-color="#ffb05b" stop-opacity=".45"/>
        <stop offset="100%" stop-color="#ffb05b" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="scan" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#c8f169" stop-opacity="0"/>
        <stop offset="100%" stop-color="#c8f169" stop-opacity=".28"/>
      </linearGradient>
      <clipPath id="faceClip"><rect x="110" y="40" width="240" height="300"/></clipPath>
    </defs>
    <g class="df-heat" style="mix-blend-mode:screen">
      <circle cx="196" cy="172" r="62" fill="url(#heat)" opacity="0"/>
      <circle cx="266" cy="176" r="54" fill="url(#heat)" opacity="0"/>
      <circle cx="232" cy="262" r="50" fill="url(#heat)" opacity="0"/>
    </g>
    <g class="df-face" fill="none" stroke="#f1ece2" stroke-width="1.4" stroke-linecap="round" opacity=".85">
      <path d="M230 62 C300 62 330 122 328 192 C326 262 285 320 230 322 C175 320 134 262 132 192 C130 122 160 62 230 62 Z"/>
      <path d="M176 172 Q196 160 216 172 Q196 182 176 172 Z"/>
      <path d="M244 172 Q264 160 284 172 Q264 182 244 172 Z"/>
      <path d="M170 150 Q193 138 216 148"/>
      <path d="M244 148 Q267 138 290 150"/>
      <path d="M230 178 L222 228 Q230 235 238 228"/>
      <path d="M200 262 Q230 279 260 262"/>
    </g>
    <g class="df-dots" fill="#c8f169"></g>
    <g class="df-box" fill="none" stroke="#c8f169" stroke-width="1.5">
      <path d="M118 66 v-20 h20"/><path d="M322 46 h20 v20"/><path d="M342 318 v20 h-20"/><path d="M138 338 h-20 v-20"/>
    </g>
    <g clip-path="url(#faceClip)">
      <g class="df-scan" opacity="0">
        <rect x="110" y="-40" width="240" height="40" fill="url(#scan)"/>
        <rect x="110" y="0" width="240" height="1.5" fill="#c8f169"/>
      </g>
    </g>
    <text x="118" y="36" class="mono" font-size="11" fill="#9a958b" letter-spacing="1">FACE_01 · 0.94 IOU</text>
  `;
  // compact variant (floating card): crop the viewBox to the face only
  if (root.hasAttribute('data-compact')) s.setAttribute('viewBox', '100 22 260 330');
  // landmark dots sampled along the face paths
  const dotsG = s.querySelector('.df-dots');
  const paths = [...s.querySelectorAll('.df-face path')];
  paths.forEach((p, idx) => {
    const len = p.getTotalLength();
    const n = idx === 0 ? 18 : 5;
    for (let i = 0; i < n; i++) {
      const pt = p.getPointAtLength((len / n) * i);
      el('circle', { cx: pt.x.toFixed(1), cy: pt.y.toFixed(1), r: 2.2, opacity: 0 }, dotsG);
    }
  });

  const panel = html(`
    <div class="df-panel">
      <span class="df-panel__label">Model accuracy</span>
      <span class="df-panel__value"><span class="js-score">0</span>%</span>
      <div class="df-panel__bar"><i></i></div>
      <span class="df-panel__verdict"></span>
    </div>`);
  root.appendChild(panel);
  const label = html(`<span class="demo-hud df-frames-label">FRAME ANALYSIS · 16 / 240</span>`);
  root.appendChild(label);
  const frames = html(`<div class="df-frames">${'<i></i>'.repeat(16)}</div>`);
  root.appendChild(frames);
  const flagged = [5, 6, 7, 11, 12];

  const face = svg.createDrawable(paths);
  const box = svg.createDrawable(s.querySelectorAll('.df-box path'));
  const dots = dotsG.querySelectorAll('circle');
  const heat = s.querySelectorAll('.df-heat circle');
  const scan = s.querySelector('.df-scan');
  const score = panel.querySelector('.js-score');
  const bar = panel.querySelector('.df-panel__bar i');
  const verdict = panel.querySelector('.df-panel__verdict');
  const frameEls = frames.querySelectorAll('i');

  return () => {
    utils.set(face, { draw: '0 0' });
    utils.set(box, { draw: '0 0' });
    utils.set(dots, { opacity: 0, scale: 0 });
    utils.set(heat, { opacity: 0 });
    utils.set(bar, { scaleX: 0 });
    utils.set(frameEls, { opacity: 0.25 });
    frameEls.forEach((f) => f.classList.remove('is-flag'));
    score.textContent = '0';
    verdict.textContent = '';

    const tl = createTimeline({ defaults: { ease: 'outExpo' } });
    tl.add(face, { draw: ['0 0', '0 1'], duration: 1400, delay: stagger(90), ease: 'inOutQuad' })
      .add(box, { draw: ['0 0', '0 1'], duration: 700, delay: stagger(60) }, 300)
      .add(dots, { opacity: [0, 1], scale: [0, 1], duration: 500, delay: stagger(12) }, 900)
      .add(scan, { opacity: [0, 1], duration: 200 }, 1200)
      .add(scan, { translateY: [40, 340], duration: 1800, ease: 'inOutSine' }, 1200)
      .add(frameEls, { opacity: [0.25, 1], duration: 300, delay: stagger(100) }, 1200)
      .call(() => flagged.forEach((i) => frameEls[i].classList.add('is-flag')), 2600)
      .add(scan, { opacity: 0, duration: 300 }, 3000)
      .add(heat, { opacity: [0, 0.85], duration: 1200, delay: stagger(180), ease: 'outSine' }, 2400)
      .add(bar, { scaleX: 0.93, duration: 1400 }, 2600)
      .call(() => countTo(score, 93), 2600)
      .call(() => {
        verdict.textContent = '● FACE-SWAP DETECTED';
        animate(verdict, { innerHTML: scrambleText({ chars: 'uppercase', revealRate: 90 }) });
      }, 3400);
    return tl;
  };
}

/* ---------------- Crime report — QR ---------------- */
function qr(root) {
  const N = 13;
  const grid = html(`<div class="qr"></div>`);
  const isFinder = (r, c) => {
    const corners = [[0, 0], [0, N - 5], [N - 5, 0]];
    for (const [r0, c0] of corners) {
      const rr = r - r0, cc = c - c0;
      if (rr >= 0 && rr < 5 && cc >= 0 && cc < 5) {
        return { on: rr === 0 || rr === 4 || cc === 0 || cc === 4 || (rr === 2 && cc === 2) };
      }
      if (rr >= -1 && rr <= 5 && cc >= -1 && cc <= 5) return { on: false };
    }
    return null;
  };
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const f = isFinder(r, c);
      const on = f ? f.on : rnd() > 0.48;
      const i = document.createElement('i');
      if (!on) i.className = 'off';
      grid.appendChild(i);
    }
  }
  root.appendChild(grid);
  root.appendChild(html(`<span class="demo-hud qr-scan">SCAN TO TRACK · ANONYMOUS</span>`));
  const card = html(`
    <div class="qr-card">
      <span class="qr-card__id">REPORT #CR-7F2A</span>
      <span class="qr-badge"><span class="js-sev">Severity: High</span></span>
      <span class="qr-card__id js-status">Gemini · auto-categorised</span>
    </div>`);
  root.appendChild(card);
  const cells = grid.querySelectorAll('i');
  const sev = card.querySelector('.js-sev');

  return () => {
    utils.set(cells, { scale: 0 });
    utils.set(card, { opacity: 0, translateY: 14 });
    return createTimeline()
      .add(cells, { scale: [0, 1], duration: 700, ease: 'outElastic(1, .7)', delay: stagger(22, { grid: [N, N], from: 'center' }) })
      .add(card, { opacity: 1, translateY: 0, duration: 800, ease: 'outExpo' }, 900)
      .add(sev, { innerHTML: scrambleText({ chars: 'uppercase' }) }, 1100)
      .add(card.querySelector('.qr-badge'), { scale: [1, 1.08, 1], duration: 600, ease: 'inOutSine' }, 1700);
  };
}

/* ---------------- RIYA voice agent ---------------- */
function voice(root) {
  const pill = html(`<span class="voice-state"><i></i><span class="js-state">IDLE</span></span>`);
  const bars = html(`<div class="voice-bars">${'<i></i>'.repeat(36)}</div>`);
  const sheet = html(`
    <div class="voice-sheet">
      <div class="voice-field"><small>Complaint</small><span data-v="Chest pain"></span></div>
      <div class="voice-field"><small>BP</small><span data-v="148/92"></span></div>
      <div class="voice-field"><small>Heart rate</small><span data-v="112 bpm"></span></div>
    </div>`);
  root.append(pill, bars, sheet);
  const barEls = bars.querySelectorAll('i');
  const dot = pill.querySelector('i');
  const state = pill.querySelector('.js-state');
  const fields = sheet.querySelectorAll('span');

  const setState = (label, color) => () => {
    state.textContent = label;
    animate(dot, { backgroundColor: color, scale: [1.8, 1], duration: 500 });
  };

  return () => {
    utils.set(barEls, { scaleY: 0.08 });
    fields.forEach((f) => (f.textContent = ''));
    const tl = createTimeline({ defaults: { ease: 'inOutSine' } });
    tl.call(setState('LISTENING', '#c8f169'), 0);
    for (let i = 0; i < 9; i++) {
      tl.add(barEls, { scaleY: () => utils.random(0.12, 1, 2), duration: 220 }, i * 220);
    }
    tl.call(setState('PROCESSING', '#8b9cff'), 2000)
      .add(barEls, { scaleY: [0.1, 0.45, 0.1], duration: 900, delay: stagger(30, { from: 'center' }) }, 2000)
      .add(barEls, { scaleY: [0.1, 0.45, 0.1], duration: 900, delay: stagger(30, { from: 'center' }) }, 2700);
    fields.forEach((f, i) => {
      tl.call(() => { f.textContent = f.dataset.v; animate(f, { innerHTML: scrambleText({ chars: 'A-Z0-9' }) }); }, 2400 + i * 350);
    });
    tl.call(setState('ALERTING', '#ff6b5b'), 3600)
      .add(fields[2].parentElement, { borderColor: ['rgba(255,107,91,.8)', 'rgba(241,236,226,.09)'], duration: 1400 }, 3600)
      .call(setState('IDLE', '#5f5b54'), 5200)
      .add(barEls, { scaleY: 0.08, duration: 600 }, 5200);
    return tl;
  };
}

/* ---------------- Taskflow ---------------- */
function todo(root) {
  const tasks = ['Design review', 'Ship checkout flow', 'Gym at 6 pm', 'Read 20 pages'];
  const card = html(`
    <div class="todo-float">
      ${tasks.map((t) => `
        <div class="todo-row">
          <svg viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="rgba(241,236,226,.25)"/>
            <circle class="js-fill" cx="8" cy="8" r="7" fill="#6d5dfc" opacity="0"/>
            <path class="js-check" d="M4.6 8.3 L7 10.6 L11.4 5.8" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>${t}</span>
        </div>`).join('')}
      <div class="todo-progress"><i></i></div>
    </div>`);
  root.appendChild(card);
  const checks = svg.createDrawable(card.querySelectorAll('.js-check'));
  const fills = card.querySelectorAll('.js-fill');
  const labels = card.querySelectorAll('.todo-row span');
  const bar = card.querySelector('.todo-progress i');

  return () => {
    utils.set(checks, { draw: '0 0' });
    utils.set(fills, { opacity: 0 });
    utils.set(labels, { '--strike': 0, opacity: 1 });
    utils.set(bar, { scaleX: 0 });
    utils.set(card, { opacity: 0, translateY: 20 });
    const tl = createTimeline({ defaults: { ease: 'outExpo' } })
      .add(card, { opacity: 1, translateY: 0, duration: 800 });
    tasks.forEach((_, i) => {
      const t = 500 + i * 420;
      tl.add(fills[i], { opacity: 1, duration: 300 }, t)
        .add(checks[i], { draw: '0 1', duration: 400, ease: 'outQuad' }, t + 80)
        .add(labels[i], { '--strike': 1, opacity: 0.5, duration: 500 }, t + 150)
        .add(bar, { scaleX: (i + 1) / tasks.length, duration: 500 }, t + 150);
    });
    return tl;
  };
}

/* ---------------- Image analyzer ---------------- */
function vision(root) {
  const s = el('svg', { viewBox: '0 0 600 375', preserveAspectRatio: 'xMidYMid slice' }, root);
  s.innerHTML = `
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2230"/><stop offset="1" stop-color="#2a2730"/></linearGradient></defs>
    <rect width="600" height="375" fill="url(#sky)"/>
    <circle cx="470" cy="92" r="30" fill="#ffb05b" opacity=".85"/>
    <polygon points="0,300 140,150 250,270 330,190 470,300" fill="#3b4150"/>
    <polygon points="200,300 330,190 420,260 520,170 600,240 600,300" fill="#2f3442"/>
    <rect y="296" width="600" height="80" fill="#1d2018"/>
    <g fill="#14161a"><circle cx="110" cy="252" r="34"/><rect x="104" y="270" width="12" height="40"/></g>
    <g fill="#e9e3d8"><circle cx="380" cy="248" r="11"/><rect x="368" y="261" width="24" height="44" rx="10"/></g>
    <g class="vis-grid" stroke="rgba(200,241,105,.12)">${Array.from({ length: 11 }, (_, i) => `<line x1="${i * 60}" y1="0" x2="${i * 60}" y2="375"/>`).join('')}${Array.from({ length: 7 }, (_, i) => `<line x1="0" y1="${i * 60}" x2="600" y2="${i * 60}"/>`).join('')}</g>
  `;
  const boxes = [
    { x: 356, y: 230, w: 48, h: 80, label: 'Person 96.1%' },
    { x: 70, y: 212, w: 82, h: 102, label: 'Tree 92.7%' },
    { x: 12, y: 140, w: 452, h: 162, label: 'Mountain 98.4%' },
    { x: 432, y: 54, w: 76, h: 76, label: 'Sun 89.3%' },
  ];
  const gBoxes = el('g', {}, s);
  const rects = [], tags = [];
  boxes.forEach((b) => {
    rects.push(el('rect', { x: b.x, y: b.y, width: b.w, height: b.h, rx: 3, class: 'vision-box' }, gBoxes));
    const g = el('g', { class: 'vision-label', opacity: 0 }, gBoxes);
    const w = b.label.length * 6.4 + 12;
    el('rect', { x: b.x, y: b.y - 18, width: w, height: 16, rx: 3 }, g);
    const t = el('text', { x: b.x + 6, y: b.y - 6.5 }, g);
    t.textContent = b.label;
    tags.push(g);
  });
  const hud = html(`<span class="demo-hud" style="left:18px;top:16px">detectLabels() · <span class="js-n">0</span> labels</span>`);
  root.appendChild(hud);
  const n = hud.querySelector('.js-n');
  const drawRects = svg.createDrawable(rects);
  const gridEl = s.querySelector('.vis-grid');

  return () => {
    utils.set(drawRects, { draw: '0 0' });
    utils.set(tags, { opacity: 0, translateY: 4 });
    utils.set(gridEl, { opacity: 0 });
    n.textContent = '0';
    const tl = createTimeline({ defaults: { ease: 'outExpo' } })
      .add(gridEl, { opacity: [0, 1, 0], duration: 1400, ease: 'inOutSine' })
      .add(drawRects, { draw: ['0.5 0.5', '0 1'], duration: 900, delay: stagger(260) }, 500)
      .add(tags, { opacity: 1, translateY: 0, duration: 600, delay: stagger(260) }, 900)
      .call(() => countTo(n, boxes.length, { duration: 1200 }), 600);
    return tl;
  };
}

/* ---------------- Fruit Dump ---------------- */
function fruit(root) {
  const s = el('svg', { viewBox: '0 0 600 375', preserveAspectRatio: 'xMidYMid meet' }, root);
  s.innerHTML = `
    <rect x="262" y="0" width="76" height="300" fill="#1a1b1e" stroke="rgba(241,236,226,.12)"/>
    <line class="belt" x1="300" y1="0" x2="300" y2="300" stroke="rgba(241,236,226,.18)" stroke-width="70" stroke-dasharray="2 22"/>
    <g font-family="JetBrains Mono, monospace" font-size="11" letter-spacing="2" text-anchor="middle">
      <rect x="40" y="270" width="150" height="80" rx="10" fill="rgba(255,107,91,.08)" stroke="rgba(255,107,91,.5)"/>
      <text x="115" y="342" fill="#ff6b5b">APPLES</text>
      <rect x="410" y="270" width="150" height="80" rx="10" fill="rgba(255,176,91,.08)" stroke="rgba(255,176,91,.5)"/>
      <text x="485" y="342" fill="#ffb05b">ORANGES</text>
    </g>
    <g class="fruits"></g>
  `;
  const hud = html(`<span class="demo-hud" style="right:18px;top:16px;text-align:right">SCORE <b class="js-score" style="color:var(--text)">0</b> · SPEED ×<span class="js-speed">1.0</span></span>`);
  root.appendChild(hud);
  const belt = s.querySelector('.belt');
  animate(belt, { strokeDashoffset: [0, -24], duration: 600, ease: 'linear', loop: true });

  const seq = ['apple', 'orange', 'orange', 'apple', 'orange'];
  const fruitsG = s.querySelector('.fruits');
  const fruits = seq.map((type) => {
    const g = el('g', { opacity: 0 }, fruitsG);
    el('circle', { cx: 0, cy: 0, r: 17, fill: type === 'apple' ? '#ff6b5b' : '#ffb05b' }, g);
    el('path', { d: 'M0 -16 q4 -8 10 -8', stroke: '#c8f169', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }, g);
    return { g, type };
  });
  const score = hud.querySelector('.js-score');
  const speed = hud.querySelector('.js-speed');

  return () => {
    fruits.forEach(({ g }) => utils.set(g, { opacity: 0, translateX: 300, translateY: -30, rotate: 0 }));
    score.textContent = '0';
    speed.textContent = '1.0';
    const tl = createTimeline();
    fruits.forEach(({ g, type }, i) => {
      const t = i * 650;
      const left = type === 'apple';
      const step = 760 - i * 70; // the belt speeds up, like the game
      tl.add(g, { opacity: [0, 1], translateY: [-30, 150], duration: step, ease: 'linear' }, t)
        .add(g, {
          translateX: { to: (left ? 115 : 485) + [-36, 0, 36][i % 3], ease: 'outQuad' },
          translateY: { to: 300, ease: 'outBounce' },
          rotate: left ? -200 : 200,
          duration: 900,
        }, t + step)
        .call(() => {
          score.textContent = String(i + 1);
          speed.textContent = (1 + (i + 1) * 0.2).toFixed(1);
        }, t + step + 500);
    });
    return tl;
  };
}

/* ---------------- My Projects stack ---------------- */
function stack(root) {
  const wrap = html(`
    <div class="stack">
      <div class="stack__card"><small>Study No. 04</small><strong>HushCard</strong></div>
      <div class="stack__card"><small>Study No. 02</small><strong>Simon Game</strong></div>
      <div class="stack__card"><small>Study No. 01</small><strong>Drum Kit</strong></div>
      <div class="stack__card stack__card--img"><img src="/images/myprojects.png" alt="" loading="lazy"/></div>
    </div>`);
  root.appendChild(wrap);
  const cards = wrap.querySelectorAll('.stack__card');
  const fan = [-9, -4, 4, 0];
  const shiftX = [-20, -9, 11, 0];

  const collapse = () => animate(cards, { rotate: 0, translateX: 0, translateY: (_, i) => (cards.length - 1 - i) * -6, duration: 700, ease: 'outExpo' });
  root.closest('.project-row')?.addEventListener('mouseleave', collapse);

  return () => {
    utils.set(cards, { rotate: 0, translateX: 0, translateY: (_, i) => (cards.length - 1 - i) * -6 });
    return animate(cards, {
      rotate: (_, i) => fan[i],
      translateX: (_, i) => `${shiftX[i]}%`,
      translateY: (_, i) => (i === 3 ? -6 : 4),
      duration: 1200,
      delay: stagger(90),
      ease: 'outElastic(1, .75)',
    });
  };
}

const builders = { deepfake, qr, voice, todo, vision, fruit, stack };

/* ---------------- screenshot showcase ---------------- */
// Auto-cycles while visible. Hovering the row jumps to the next screen right
// away, speeds the cycle up, and fans the upcoming screens out behind the frame.
function initShowcase(stage, reduced) {
  const row = stage.closest('.project-row');
  const screen = stage.querySelector('.stage__screen');
  const imgs = [...screen.querySelectorAll(':scope > img')];
  const caption = row.querySelector('.showcase__caption');
  const progress = row.querySelector('.showcase__progress');
  const scan = stage.querySelector('.showcase__scan');
  const baseInterval = +stage.dataset.interval || 3600;
  const hoverInterval = 2000;
  if (!imgs.length) return;
  const single = imgs.length === 1;
  const visual = row.querySelector('.project-row__visual');
  // fan away from the text: left-hand visuals fan left, right-hand ones fan right
  const sideOf = () => {
    const v = visual.getBoundingClientRect(), r = row.getBoundingClientRect();
    return v.left + v.width / 2 < r.left + r.width / 2 ? -1 : 1;
  };

  imgs.forEach((img) => {
    const check = () => img.classList.toggle('is-portrait', img.naturalHeight > img.naturalWidth * 1.1);
    img.complete ? check() : img.addEventListener('load', check, { once: true });
  });

  // deck of the next two screens, tucked behind the frame
  let deck = [];
  if (!single) {
    const d = document.createElement('div');
    d.className = 'stage__deck';
    d.setAttribute('aria-hidden', 'true');
    d.innerHTML = '<div><img alt="" /></div><div><img alt="" /></div>';
    stage.prepend(d);
    deck = [...d.children];
    utils.set(deck, { translateY: (_, i) => -(i + 1) * 7, scale: (_, i) => 1 - (i + 1) * 0.035 });
  }
  const tuck = () => animate(deck, { translateX: 0, translateY: (_, i) => -(i + 1) * 7, rotate: 0, scale: (_, i) => 1 - (i + 1) * 0.035, duration: 800, ease: 'outExpo' });
  const fan = (side = sideOf()) => animate(deck, {
    translateX: (_, i) => `${side * (i + 1) * 7}%`,
    translateY: (_, i) => `${-(i + 1) * 3}%`,
    rotate: (_, i) => side * (i + 1) * 4,
    scale: (_, i) => 1 - (i + 1) * 0.06,
    duration: 1000, delay: stagger(70), ease: 'outElastic(1, .8)',
  });

  const bars = progress ? imgs.map((img, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-label', img.dataset.caption || `Screen ${i + 1}`);
    b.innerHTML = '<b></b>';
    b.addEventListener('click', () => go(i));
    progress.appendChild(b);
    return b.querySelector('b');
  }) : [];

  let index = -1;
  let fill = null;
  let hovering = false;
  let visible = false;

  function go(i) {
    const prev = imgs[index];
    index = (i + imgs.length) % imgs.length;
    const next = imgs[index];

    imgs.forEach((img) => { img.style.zIndex = img === next ? 2 : img === prev ? 1 : 0; });
    utils.set(next, { visibility: 'visible' });
    if (reduced || !prev) {
      imgs.forEach((img) => { if (img !== next) img.style.visibility = 'hidden'; });
      utils.set(next, { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, opacity: 1 });
    } else if (prev !== next) {
      // wipe the new screen in from the bottom while the old one sinks back
      animate(next, { clipPath: ['inset(100% 0% 0% 0%)', 'inset(0% 0% 0% 0%)'], duration: 1000, ease: 'inOutQuart' });
      animate(next, { scale: [1.12, 1], duration: 1600, ease: 'outExpo' });
      animate(prev, { scale: 0.94, opacity: 0.3, duration: 1000, ease: 'inOutQuart',
        onComplete: () => { if (imgs[index] !== prev) prev.style.visibility = 'hidden'; utils.set(prev, { scale: 1, opacity: 1 }); } });
      if (scan) animate(scan, { translateY: ['-110%', '360%'], duration: 1400, ease: 'inOutSine' });
    }

    // deck shows what's coming next
    deck.forEach((card, k) => { card.querySelector('img').src = imgs[(index + k + 1) % imgs.length].src; });

    if (caption) {
      const text = next.dataset.caption || '';
      caption.textContent = text;
      if (!reduced) animate(caption, { opacity: [0, 1], translateY: [8, 0], duration: 700, ease: 'outExpo' });
    }

    bars.forEach((b, k) => utils.set(b, { scaleX: k < index ? 1 : 0 }));
    fill?.pause();
    if (reduced || single) { if (bars[index]) utils.set(bars[index], { scaleX: 1 }); return; }
    fill = animate(bars[index], {
      scaleX: [0, 1], duration: hovering ? hoverInterval : baseInterval, ease: 'linear',
      autoplay: visible, onComplete: () => go(index + 1),
    });
  }

  // single screenshot: hovering scrolls the page inside the frame
  let pan = null;
  row.addEventListener('mouseenter', () => {
    hovering = true;
    if (reduced) return;
    if (single) {
      pan?.pause();
      pan = animate(imgs[0], { objectPosition: ['50% 0%', '50% 100%'], duration: 3200, ease: 'inOutSine' });
      return;
    }
    fan();
    go(index + 1);
  });
  row.addEventListener('mouseleave', () => {
    hovering = false;
    if (reduced) return;
    if (single) { pan?.pause(); pan = animate(imgs[0], { objectPosition: '50% 0%', duration: 1200, ease: 'outExpo' }); return; }
    tuck();
  });

  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (index === -1) { if (visible) go(0); return; }
    if (visible) fill?.play(); else fill?.pause();
  }, { threshold: 0.3 });
  io.observe(stage);

  // floating cards drift against the scroll for depth
  if (!reduced) {
    stage.querySelectorAll('.showcase__float').forEach((f, i) => {
      animate(f, {
        translateY: [50, -50],
        rotate: i % 2 ? [3, -2] : [-3, 2],
        ease: 'linear',
        autoplay: onScroll({ target: row, enter: 'bottom top', leave: 'top bottom', sync: 0.3 }),
      });
    });
  }
}

/* ---------------- wiring ---------------- */
export function initProjects() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('[data-showcase]').forEach((s) => initShowcase(s, reduced));

  document.querySelectorAll('[data-demo]').forEach((root) => {
    const build = builders[root.dataset.demo];
    if (!build) return;
    const play = build(root);
    let running = null;
    let seen = false;

    const run = () => {
      if (running && !running.completed) return;
      running = play();
      if (reduced && running) running.seek(running.duration);
    };

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !seen) { seen = true; setTimeout(run, 250); io.disconnect(); }
      });
    }, { threshold: 0.45 });
    io.observe(root);

    if (!reduced) root.closest('.project-row')?.addEventListener('mouseenter', () => { if (seen) run(); });
  });

  document.querySelectorAll('.project-row').forEach((row) => {
    row.addEventListener('mouseenter', () => {
      const r = row.querySelector('.project-row__visual').getBoundingClientRect();
      const nx = ((r.left + r.width / 2) / window.innerWidth) * 2 - 1;
      window.dispatchEvent(new CustomEvent('project-focus', { detail: nx }));
    });
    row.addEventListener('mouseleave', () => window.dispatchEvent(new CustomEvent('project-focus', { detail: 0 })));
  });

  // gentle 3D tilt on cards
  if (reduced || !matchMedia('(pointer: fine)').matches) return;
  document.querySelectorAll('[data-tilt]').forEach((card) => {
    const tilt = createAnimatable(card, { rotateX: 600, rotateY: 600, ease: 'out(3)' });
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      const max = 2.5;
      tilt.rotateY(x * max * 2);
      tilt.rotateX(-y * max * 2);
    });
    card.addEventListener('pointerleave', () => { tilt.rotateX(0); tilt.rotateY(0); });
  });
}
