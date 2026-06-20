// ─── CryptoPulse Premium Interaction Engine ────────────────────────────────
// Custom cursor + spotlight, magnetic buttons, 3D tilt cards, count-up
// numbers, scroll-triggered reveals. Zero dependencies, pure vanilla —
// safe to include on every page.

const Premium = (() => {

  const isFinePointer = window.matchMedia('(pointer: fine)').matches;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Custom cursor ──────────────────────────────────────────────────────
  function initCursor() {
    if (!isFinePointer || reduceMotion) return;
    document.body.classList.add('premium-cursor-active');

    const dot = document.createElement('div'); dot.className = 'pcur-dot';
    const ring = document.createElement('div'); ring.className = 'pcur-ring';
    const glow = document.createElement('div'); glow.className = 'pcur-glow';
    document.body.append(glow, ring, dot);

    let mx = window.innerWidth / 2, my = window.innerHeight / 2;
    let rx = mx, ry = my, gx = mx, gy = my;

    window.addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`;
    });

    function loop() {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      gx += (mx - gx) * 0.08; gy += (my - gy) * 0.08;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
      glow.style.transform = `translate(${gx}px, ${gy}px) translate(-50%,-50%)`;
      requestAnimationFrame(loop);
    }
    loop();

    const hoverSelector = 'a, button, .btn, .card, .coin-row, [data-cursor-hover]';
    const textSelector = 'h1, h2, h3, .text-cursor-expand';

    document.addEventListener('mouseover', (e) => {
      if (e.target.closest(hoverSelector)) ring.classList.add('hover');
      if (e.target.closest(textSelector)) ring.classList.add('text-hover');
    });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest(hoverSelector)) ring.classList.remove('hover');
      if (e.target.closest(textSelector)) ring.classList.remove('text-hover');
    });

    // Light trailing sparkle (throttled)
    let lastSpark = 0;
    window.addEventListener('mousemove', () => {
      const now = Date.now();
      if (now - lastSpark < 60) return;
      lastSpark = now;
      const spark = document.createElement('div');
      spark.style.cssText = `position:fixed;top:${my}px;left:${mx}px;width:3px;height:3px;border-radius:50%;background:rgba(0,240,255,0.6);pointer-events:none;z-index:9998;transform:translate(-50%,-50%);transition:opacity 0.5s, transform 0.5s;`;
      document.body.appendChild(spark);
      requestAnimationFrame(() => { spark.style.opacity = '0'; spark.style.transform += ' scale(2.5)'; });
      setTimeout(() => spark.remove(), 520);
    });
  }

  // ── Magnetic buttons ────────────────────────────────────────────────────
  function initMagnetic(selector = '.btn-primary, .btn-outline, [data-magnetic]', strength = 0.35) {
    if (!isFinePointer || reduceMotion) return;
    document.querySelectorAll(selector).forEach(el => {
      el.setAttribute('data-magnetic', '');
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
      });
      el.addEventListener('mouseleave', () => { el.style.transform = 'translate(0,0)'; });
      el.addEventListener('click', (e) => {
        el.classList.remove('rippling');
        const r = el.getBoundingClientRect();
        el.style.setProperty('--rx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--ry', (e.clientY - r.top) + 'px');
        void el.offsetWidth;
        el.classList.add('rippling');
      });
    });
  }

  // ── 3D tilt cards ───────────────────────────────────────────────────────
  function initTilt(selector = '.card', maxDeg = 6) {
    if (!isFinePointer || reduceMotion) return;
    document.querySelectorAll(selector).forEach(el => {
      el.setAttribute('data-tilt', '');
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        const rx = (py - 0.5) * -maxDeg * 2;
        const ry = (px - 0.5) * maxDeg * 2;
        el.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
      });
      el.addEventListener('mouseleave', () => { el.style.transform = 'perspective(800px) rotateX(0) rotateY(0)'; });
    });
  }

  // ── Count-up numbers ────────────────────────────────────────────────────
  function countUp(el, target, { duration = 1200, prefix = '', suffix = '', decimals = 0 } = {}) {
    if (reduceMotion) { el.textContent = prefix + target.toFixed(decimals) + suffix; return; }
    const start = performance.now();
    const from = 0;
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const val = from + (target - from) * eased;
      el.textContent = prefix + val.toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: decimals }) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ── Scroll reveal ───────────────────────────────────────────────────────
  function initReveal(selector = '[data-reveal]') {
    const els = document.querySelectorAll(selector);
    if (!els.length) return;
    if (reduceMotion) { els.forEach(el => el.classList.add('in')); return; }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('in'); obs.unobserve(entry.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(el => obs.observe(el));
  }

  // ── Auto-init everything safe to run on any page ───────────────────────
  function autoInit() {
    initCursor();
    initMagnetic();
    initTilt('.card');
    initReveal();
  }

  return { initCursor, initMagnetic, initTilt, countUp, initReveal, autoInit };
})();

document.addEventListener('DOMContentLoaded', () => Premium.autoInit());
