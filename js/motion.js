// motion.js — Premium interactions layer
// Loads after app.js and adds motion without touching business logic

(function () {
  'use strict';

  // ── 3D Card Tilt ─────────────────────────────────────────────────────────
  const TILT_MAX = 7;

  function applyTilt(el) {
    if (el._tiltBound) return;
    el._tiltBound = true;

    let raf;

    function onMove(e) {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(700px) rotateX(${(-y * TILT_MAX).toFixed(2)}deg) rotateY(${(x * TILT_MAX).toFixed(2)}deg) translateY(-6px) scale(1.01)`;
        el.style.transition = 'transform 0.08s ease-out, box-shadow 0.08s ease-out';
        el.style.boxShadow = '0 20px 48px rgba(0,0,0,0.14), 0 0 1px rgba(0,0,0,0.04)';
        const shine = el.querySelector('.card-shine');
        if (shine) {
          shine.style.opacity = '1';
          shine.style.background = `radial-gradient(ellipse at ${((x + 0.5) * 100).toFixed(1)}% ${((y + 0.5) * 100).toFixed(1)}%, rgba(255,255,255,0.15) 0%, transparent 65%)`;
        }
      });
    }

    function onLeave() {
      cancelAnimationFrame(raf);
      el.style.transform = '';
      el.style.boxShadow = '';
      el.style.transition = 'transform 0.5s cubic-bezier(0.22,1,0.36,1), box-shadow 0.5s cubic-bezier(0.22,1,0.36,1)';
      const shine = el.querySelector('.card-shine');
      if (shine) shine.style.opacity = '0';
    }

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
  }

  function initTilt() {
    document.querySelectorAll('.card').forEach(el => {
      if (!el.querySelector('.card-shine')) {
        const shine = document.createElement('div');
        shine.className = 'card-shine';
        el.appendChild(shine);
      }
      applyTilt(el);
    });
  }

  // ── Magnetic Buttons ──────────────────────────────────────────────────────
  const MAG_STRENGTH = 0.32;

  function initMagnetic() {
    document.querySelectorAll('.btn-primary, .btn-hero-primary, .btn-nav-primary').forEach(btn => {
      if (btn._magBound) return;
      btn._magBound = true;

      btn.addEventListener('mousemove', e => {
        const r = btn.getBoundingClientRect();
        const x = ((e.clientX - r.left - r.width / 2) * MAG_STRENGTH).toFixed(2);
        const y = ((e.clientY - r.top - r.height / 2) * MAG_STRENGTH).toFixed(2);
        btn.style.transform = `translate(${x}px, ${y}px)`;
        btn.style.transition = 'transform 0.1s ease-out';
      });

      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
        btn.style.transition = 'transform 0.45s cubic-bezier(0.22,1,0.36,1)';
      });
    });
  }

  // ── Ripple on click ───────────────────────────────────────────────────────
  function initRipple() {
    document.addEventListener('click', e => {
      const target = e.target.closest('.btn, .nav-item, .btn-google, .btn-hero-primary');
      if (!target) return;
      const r = target.getBoundingClientRect();
      const size = Math.max(r.width, r.height) * 2.2;
      const ripple = document.createElement('span');
      ripple.className = 'ripple-effect';
      ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
      target.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    }, true);
  }

  // ── Animated Counters ─────────────────────────────────────────────────────
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function animateCounter(el, from, to, duration, prefix, suffix) {
    prefix = prefix || '';
    suffix = suffix || '';
    duration = duration || 900;
    const isFloat = !Number.isInteger(to) || String(to).includes('.');
    const decimals = isFloat ? 2 : 0;
    const start = performance.now();

    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const val = from + (to - from) * easeOutCubic(p);
      el.textContent = prefix + val.toLocaleString('es-SV', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // Exposed for use in app.js
  window.animateCounter = animateCounter;

  // Animate all .value elements that contain numbers on first render
  function animateMetrics() {
    document.querySelectorAll('.metric-card .value').forEach(el => {
      if (el._animated) return;
      el._animated = true;
      const raw = el.textContent.trim();
      const hasDollar = raw.startsWith('$');
      const hasPct = raw.endsWith('%');
      const num = parseFloat(raw.replace(/[$%,\s]/g, '').replace(',', '.'));
      if (!isNaN(num) && num > 0) {
        animateCounter(el, 0, num, 900, hasDollar ? '$' : '', hasPct ? '%' : '');
      }
    });
  }

  // ── View Transitions (Chrome 111+) ────────────────────────────────────────
  window.pageTransition = function (fn) {
    if (document.startViewTransition) {
      document.startViewTransition(fn);
    } else {
      fn();
    }
  };

  // Wrap showView to use view transitions
  const _origShowView = window.showView;
  if (_origShowView) {
    window.showView = function (view, el) {
      window.pageTransition(() => _origShowView.call(this, view, el));
    };
  }

  // ── Scroll Reveal (landing page) ─────────────────────────────────────────
  function initScrollReveal() {
    const els = document.querySelectorAll('.reveal, .reveal-left');
    if (!els.length) return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    els.forEach(el => obs.observe(el));
  }

  // ── Stagger children on view load ────────────────────────────────────────
  function staggerIn(parent, selector, delay) {
    delay = delay || 60;
    const items = parent.querySelectorAll(selector);
    items.forEach((el, i) => {
      el.style.animationDelay = `${i * delay}ms`;
    });
  }

  window.staggerIn = staggerIn;

  // ── Smooth number update (called when a metric changes) ──────────────────
  window.updateMetric = function (el, newVal, prefix) {
    const old = parseFloat(el.dataset.counterVal || el.textContent.replace(/[$%,\s]/g, '') || 0);
    el.dataset.counterVal = newVal;
    animateCounter(el, old, newVal, 600, prefix || '');
  };

  // ── Init ─────────────────────────────────────────────────────────────────
  function init() {
    initRipple();
    initScrollReveal();

    // Give app.js time to render
    setTimeout(() => {
      initTilt();
      initMagnetic();
      animateMetrics();
    }, 400);

    // Re-run after view changes
    const origShow = window.showView;
    if (origShow && origShow !== init) {
      const _wrap = window.showView;
      window.showView = function (...args) {
        _wrap.apply(this, args);
        setTimeout(() => {
          initTilt();
          initMagnetic();
          animateMetrics();
        }, 350);
      };
    }

    // Watch for DOM additions (new cards rendered)
    const mo = new MutationObserver(() => {
      initTilt();
      initMagnetic();
      animateMetrics();
    });
    const content = document.getElementById('view-content');
    if (content) mo.observe(content, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
