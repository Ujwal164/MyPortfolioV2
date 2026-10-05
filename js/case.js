import Lenis from 'lenis';
import { animate, stagger, splitText, utils, svg } from 'animejs';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!reduced) {
  const lenis = new Lenis({ duration: 1.15 });
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
}

/* nav background */
const navEl = document.getElementById('nav');
const onY = () => navEl.classList.toggle('is-scrolled', window.scrollY > 40);
window.addEventListener('scroll', onY, { passive: true });
onY();

/* title */
const title = document.querySelector('.case-hero__title');
if (title && !reduced) {
  const { chars } = splitText(title, { chars: { wrap: 'clip' } });
  utils.set(title, { opacity: 1 });
  animate(chars, { translateY: ['105%', '0%'], duration: 1200, delay: stagger(35, { start: 150 }), ease: 'outExpo' });
}

/* reveals */
const items = [...document.querySelectorAll('[data-reveal]')].filter((n) => n !== title || reduced);
if (reduced) {
  utils.set('[data-reveal]', { opacity: 1 });
} else {
  const io = new IntersectionObserver((entries) => {
    const entering = entries.filter((e) => e.isIntersecting).map((e) => e.target);
    if (!entering.length) return;
    animate(entering, { opacity: [0, 1], translateY: [28, 0], duration: 1100, delay: stagger(90), ease: 'outExpo' });
    entering.forEach((t) => io.unobserve(t));
  }, { threshold: 0.15 });
  items.forEach((i) => io.observe(i));
}

/* groups */
document.querySelectorAll('[data-reveal-group]').forEach((group) => {
  const kids = [...group.children];
  if (reduced) return;
  utils.set(kids, { opacity: 0 });
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    animate(kids, { opacity: [0, 1], translateY: [20, 0], duration: 1000, delay: stagger(100, { start: 300 }), ease: 'outExpo' });
    io.disconnect();
  }, { threshold: 0.2 });
  io.observe(group);
});

/* counters */
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

/* pipelines: line draws, then each step pops in */
document.querySelectorAll('.pipeline').forEach((p) => {
  const line = svg.createDrawable(p.querySelectorAll('.pipeline__lines path'));
  const steps = p.querySelectorAll('.pipeline__steps li');
  const dots = p.querySelectorAll('.pipeline__steps span');
  if (reduced) return;
  utils.set(line, { draw: '0 0' });
  utils.set(steps, { opacity: 0 });
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    animate(line, { draw: ['0 0', '0 1'], duration: 1600, ease: 'inOutQuart' });
    animate(steps, { opacity: [0, 1], translateY: [16, 0], duration: 900, delay: stagger(220, { start: 200 }), ease: 'outExpo' });
    animate(dots, { scale: [0.4, 1], duration: 900, delay: stagger(220, { start: 200 }), ease: 'outElastic(1, .6)' });
    io.disconnect();
  }, { threshold: 0.4 });
  io.observe(p);
});
