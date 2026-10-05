import Lenis from 'lenis';
import { animate, stagger, splitText, onScroll, utils } from 'animejs';
import { initProjects } from './projects.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- smooth scroll ---------- */
let lenis = null;
let heroApi = null;
if (!reduced) {
  lenis = new Lenis({ duration: 1.15, smoothWheel: true });
  lenis.on('scroll', (e) => {
    heroApi?.setVelocity(e.velocity);
    heroApi?.setScroll(e.animatedScroll);
  });
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const target = id === '#top' ? document.body : document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(id === '#top' ? 0 : target, { offset: -20 });
    else target.scrollIntoView();
  });
});

/* ---------- hero intro ---------- */
function heroIntro() {
  const lines = document.querySelectorAll('.hero__line');
  utils.set(lines, { visibility: 'visible' });
  if (reduced) {
    utils.set('[data-hero-fade]', { opacity: 1 });
    return;
  }
  lines.forEach((line, i) => {
    // no clipping wrapper: italic serif glyphs overhang their boxes and would get cut
    const { chars } = splitText(line, { chars: true });
    animate(chars, {
      opacity: [0, 1],
      translateY: ['0.35em', '0em'],
      filter: ['blur(12px)', 'blur(0px)'],
      duration: 1400,
      delay: stagger(55, { start: 250 + i * 220 }),
      ease: 'outExpo',
    });
  });
  animate('[data-hero-fade]', {
    opacity: [0, 1],
    translateY: [16, 0],
    duration: 1100,
    delay: stagger(120, { start: 700 }),
    ease: 'outExpo',
  });
}

/* ---------- scroll reveals ---------- */
function reveals() {
  const items = document.querySelectorAll('[data-reveal]');
  if (reduced) { utils.set(items, { opacity: 1 }); return; }

  const io = new IntersectionObserver((entries) => {
    const entering = entries.filter((e) => e.isIntersecting).map((e) => e.target);
    if (!entering.length) return;
    animate(entering, {
      opacity: [0, 1],
      translateY: [28, 0],
      duration: 1100,
      delay: stagger(90),
      ease: 'outExpo',
    });
    entering.forEach((t) => {
      io.unobserve(t);
      // staggered children (skills tags)
      const kids = t.querySelectorAll('[data-stagger] > *');
      if (kids.length) animate(kids, { opacity: [0, 1], translateY: [10, 0], duration: 700, delay: stagger(40, { start: 200 }), ease: 'outExpo' });
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
  items.forEach((i) => io.observe(i));

  // groups whose children reveal one by one
  document.querySelectorAll('[data-reveal-group]').forEach((group) => {
    const kids = [...group.children];
    utils.set(kids, { opacity: 0 });
    const gio = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      animate(kids, { opacity: [0, 1], translateY: [24, 0], duration: 1000, delay: stagger(110), ease: 'outExpo' });
      gio.disconnect();
    }, { threshold: 0.3 });
    gio.observe(group);
  });
}

/* ---------- number counters ---------- */
function counters() {
  document.querySelectorAll('[data-count]').forEach((node) => {
    const to = +node.dataset.count;
    if (reduced) { node.textContent = to; return; }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      const o = { v: 0 };
      animate(o, { v: to, duration: 1800, ease: 'outExpo', onUpdate: () => { node.textContent = Math.round(o.v); } });
      io.disconnect();
    }, { threshold: 0.6 });
    io.observe(node);
  });
}

/* ---------- experience line draws with scroll ---------- */
function timelineLine() {
  const line = document.querySelector('.timeline__line');
  if (!line || reduced) return;
  animate(line, {
    scaleY: [0, 1],
    ease: 'linear',
    autoplay: onScroll({ target: '.timeline', enter: 'bottom top', leave: 'center bottom', sync: 0.4 }),
  });
}

/* ---------- nav ---------- */
function nav() {
  const navEl = document.getElementById('nav');
  let lastY = window.scrollY;
  const onScrollY = () => {
    const y = window.scrollY;
    navEl.classList.toggle('is-scrolled', y > 40);
    navEl.classList.toggle('is-hidden', y > 400 && y > lastY + 2);
    if (y < lastY - 2) navEl.classList.remove('is-hidden');
    lastY = y;
  };
  window.addEventListener('scroll', onScrollY, { passive: true });
  onScrollY();
}

/* ---------- sections drive the particle shape + active nav link ---------- */
function sectionWatcher(hero) {
  const links = document.querySelectorAll('[data-nav]');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      hero?.setShape(e.target.dataset.shape);
      const id = e.target.id;
      links.forEach((l) => l.classList.toggle('is-active', l.dataset.nav === id));
    });
  }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });
  document.querySelectorAll('[data-shape]').forEach((s) => io.observe(s));
}

/* ---------- boot ---------- */
heroIntro();
reveals();
counters();
timelineLine();
nav();
initProjects();

const canvas = document.getElementById('particles');
const nextFrames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
const heroReady = nextFrames()
  .then(() => import('./hero.js'))
  .then(({ initHero }) => initHero(canvas));

heroReady
  .then((hero) => {
    heroApi = hero;
    window.addEventListener('project-focus', (e) => hero.focus?.(e.detail));
    if (!lenis) window.addEventListener('scroll', () => hero.setScroll(window.scrollY), { passive: true });
    sectionWatcher(hero);
  })
  .catch((err) => { console.warn('Particles disabled:', err); canvas.remove(); sectionWatcher(null); });
