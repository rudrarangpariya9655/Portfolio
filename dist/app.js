(() => {
  const root = document.documentElement;
  const $ = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];

  /* ── motion: follows the OS preference, with a manual override ───────── */
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motionButton = $('#motion-toggle');
  let motionOff = reduced.matches;
  const motionListeners = [];
  const frameTasks = [];
  function applyMotion() {
    root.classList.toggle('motion-off', motionOff);
    if (motionButton) {
      motionButton.setAttribute('aria-pressed', String(motionOff));
      motionButton.textContent = motionOff ? 'Play motion' : 'Pause motion';
    }
    motionListeners.forEach(fn => fn());
  }
  motionButton?.addEventListener('click', () => { motionOff = !motionOff; applyMotion(); });
  reduced.addEventListener('change', event => { motionOff = event.matches; applyMotion(); });

  /* the accent colour as "r, g, b", re-read whenever the mood changes */
  let accentRGB = '255, 91, 58';
  const readAccent = () => { accentRGB = getComputedStyle(root).getPropertyValue('--accent-rgb').trim() || accentRGB; };
  readAccent();

  /* ── sound: a small plucked synth, silent until the visitor turns it on ─ */
  const audio = (() => {
    let ctx = null, master = null, on = false;
    const PENTATONIC = [0, 2, 4, 7, 9];
    const pitch = step => {
      const octave = Math.floor(step / 5), degree = ((step % 5) + 5) % 5;
      return 146.83 * 2 ** (octave + PENTATONIC[degree] / 12);
    };
    function boot() {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      ctx = new Ctx();
      master = ctx.createGain();
      master.gain.value = 0.55;
      const echo = ctx.createDelay(1), feedback = ctx.createGain(), wet = ctx.createGain();
      echo.delayTime.value = 0.29; feedback.gain.value = 0.34; wet.gain.value = 0.32;
      master.connect(ctx.destination);
      master.connect(echo); echo.connect(feedback); feedback.connect(echo); echo.connect(wet); wet.connect(ctx.destination);
      return true;
    }
    function pluck(step, volume = 0.2, length = 0.9) {
      if (!on || !ctx) return;
      const t = ctx.currentTime;
      const body = ctx.createOscillator(), shimmer = ctx.createOscillator();
      const shimmerGain = ctx.createGain(), filter = ctx.createBiquadFilter(), envelope = ctx.createGain();
      body.type = 'triangle'; body.frequency.value = pitch(step);
      shimmer.type = 'sine'; shimmer.frequency.value = pitch(step) * 2.004; shimmerGain.gain.value = 0.3;
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(3400, t);
      filter.frequency.exponentialRampToValueAtTime(480, t + length);
      envelope.gain.setValueAtTime(0.0001, t);
      envelope.gain.exponentialRampToValueAtTime(volume, t + 0.012);
      envelope.gain.exponentialRampToValueAtTime(0.0001, t + length);
      body.connect(filter); shimmer.connect(shimmerGain); shimmerGain.connect(filter);
      filter.connect(envelope); envelope.connect(master);
      body.start(t); shimmer.start(t);
      body.stop(t + length + 0.05); shimmer.stop(t + length + 0.05);
    }
    return {
      get on() { return on; },
      toggle() {
        if (!ctx && !boot()) return false;
        on = !on;
        if (on) ctx.resume();
        return on;
      },
      pluck,
      chord(steps, volume = 0.16) { steps.forEach((step, index) => setTimeout(() => pluck(step, volume), index * 75)); },
    };
  })();

  /* ── intro: plays once per tab (the flag is set in the page head) ────── */
  const loader = $('.loader');
  if (loader && root.classList.contains('loading')) {
    window.__introStarted = true;
    if (reduced.matches) {
      root.classList.remove('loading');
      loader.remove();
    } else {
      /* wobbly concentric contour rings, drawn outward from the centre */
      const rings = $('.loader-rings', loader);
      for (let k = 0; k < 9; k++) {
        const radius = 46 + k * 34;
        let d = '';
        for (let step = 0; step <= 96; step++) {
          const angle = (step / 96) * Math.PI * 2;
          const r = radius * (1 + 0.075 * Math.sin(3 * angle + k * 0.9) + 0.05 * Math.sin(5 * angle - k * 1.7) + 0.03 * Math.cos(2 * angle + k));
          d += `${step ? 'L' : 'M'}${(Math.cos(angle) * r).toFixed(1)} ${(Math.sin(angle) * r).toFixed(1)}`;
        }
        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        ring.setAttribute('d', `${d}Z`);
        ring.setAttribute('pathLength', '1');
        ring.style.setProperty('--i', k);
        rings.append(ring);
      }
      $$('.loader-word span', loader).forEach((letter, index) => letter.style.setProperty('--i', index));

      const count = $('.loader-count', loader);
      const fill = $('.loader-bar i', loader);
      const DURATION = 2100;
      const began = performance.now();
      let ready = false;
      let finished = false;
      const markReady = () => { ready = true; };
      (document.fonts ? document.fonts.ready : Promise.resolve()).then(markReady);
      setTimeout(markReady, 3000);
      const finish = () => {
        if (finished) return;
        finished = true;
        count.textContent = '100';
        fill.style.transform = 'scaleX(1)';
        root.classList.replace('loading', 'loading-out');
        setTimeout(() => { loader.remove(); root.classList.remove('loading-out'); }, 1500);
      };
      const advance = now => {
        if (finished) return;
        const linear = Math.min(1, (now - began) / DURATION);
        /* holds just short of the end until the fonts are really in */
        const eased = Math.min(1 - (1 - linear) ** 3, ready ? 1 : 0.93);
        count.textContent = String(Math.round(eased * 100)).padStart(3, '0');
        fill.style.transform = `scaleX(${eased.toFixed(4)})`;
        if (linear >= 1 && ready) { setTimeout(finish, 280); return; }
        requestAnimationFrame(advance);
      };
      requestAnimationFrame(advance);
      /* impatient visitors can skip it */
      loader.addEventListener('click', finish);
      window.addEventListener('keydown', finish, { once: true });
    }
  }

  /* ── contour field: a slow terrain that rises under the pointer ──────── */
  const STEP = 0.22;
  const BASE = -4;
  const BUMP_RADIUS = 170;
  const height = (x, y, t) =>
    Math.sin(x * 0.0034 + t * 0.21) * Math.cos(y * 0.0046 - t * 0.16) +
    0.62 * Math.sin((x + y) * 0.0025 + t * 0.12) +
    0.38 * Math.cos(x * 0.0067 - y * 0.0041 + t * 0.19);

  class Contours {
    constructor(canvas) {
      this.canvas = canvas;
      this.host = canvas.parentElement;
      this.ctx = canvas.getContext('2d');
      this.visible = false;
      this.pointer = { x: 0, y: 0, tx: 0, ty: 0, k: 0, tk: 0 };
      this.readout = $('[data-readout]', this.host);
      this.time = 0;
      this.ripples = [];
      this.host.addEventListener('pointerdown', event => {
        const box = this.canvas.getBoundingClientRect();
        this.ripple(event.clientX - box.left, event.clientY - box.top);
      }, { passive: true });
      this.host.addEventListener('pointermove', event => {
        const box = this.canvas.getBoundingClientRect();
        const p = this.pointer;
        p.tx = event.clientX - box.left;
        p.ty = event.clientY - box.top;
        if (p.k < 0.02) { p.x = p.tx; p.y = p.ty; }
        p.tk = 1;
      }, { passive: true });
      this.host.addEventListener('pointerleave', () => { this.pointer.tk = 0; });
      new ResizeObserver(() => { this.resize(); this.draw(); }).observe(canvas);
      new IntersectionObserver(entries => { this.visible = entries[0].isIntersecting; }).observe(canvas);
      this.resize();
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = this.canvas.clientWidth;
      this.h = this.canvas.clientHeight;
      this.canvas.width = Math.max(1, Math.round(this.w * dpr));
      this.canvas.height = Math.max(1, Math.round(this.h * dpr));
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.cell = this.w < 700 ? 14 : 18;
      this.cols = Math.ceil(this.w / this.cell) + 1;
      this.rows = Math.ceil(this.h / this.cell) + 1;
      this.vals = new Float32Array(this.cols * this.rows);
    }

    /* a ring that travels outward from a click */
    ripple(x, y, step) {
      /* with sound on, every ripple is a note: higher ground, higher pitch */
      audio.pluck(step === undefined ? Math.max(0, Math.min(16, Math.round((this.sample(x, y) + 2) * 3.2))) : step, 0.22);
      if (motionOff) return;
      this.ripples.push({ x, y, t0: this.time });
      if (this.ripples.length > 4) this.ripples.shift();
    }

    sample(x, y) {
      const p = this.pointer;
      let v = height(x, y, this.time);
      if (p.k > 0.002) {
        const dx = x - p.x, dy = y - p.y;
        v += p.k * 1.5 * Math.exp(-(dx * dx + dy * dy) / (2 * BUMP_RADIUS * BUMP_RADIUS));
      }
      for (const r of this.ripples) {
        const age = this.time - r.t0;
        const gap = Math.hypot(x - r.x, y - r.y) - age * 460;
        if (gap > -160 && gap < 160) v += 1.25 * Math.exp(-age * 1.1) * Math.exp(-(gap * gap) / 3200);
      }
      return v;
    }

    draw() {
      const { ctx, w, h, cell, cols, rows, vals, pointer: p } = this;
      if (!w || !h) return;
      if (motionOff) { p.k = 0; this.ripples.length = 0; }
      else {
        p.x += (p.tx - p.x) * 0.14;
        p.y += (p.ty - p.y) * 0.14;
        p.k += (p.tk - p.k) * 0.07;
      }
      this.ripples = this.ripples.filter(r => this.time - r.t0 < 3.2);

      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) vals[j * cols + i] = this.sample(i * cell, j * cell);
      }

      const minor = new Path2D();
      const major = new Path2D();
      for (let j = 0; j < rows - 1; j++) {
        for (let i = 0; i < cols - 1; i++) {
          const a = vals[j * cols + i], b = vals[j * cols + i + 1];
          const c = vals[(j + 1) * cols + i + 1], d = vals[(j + 1) * cols + i];
          const lo = Math.min(a, b, c, d), hi = Math.max(a, b, c, d);
          const k1 = Math.floor((hi - BASE) / STEP);
          for (let k = Math.ceil((lo - BASE) / STEP); k <= k1; k++) {
            const L = BASE + k * STEP;
            const idx = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
            if (idx === 0 || idx === 15) continue;
            const x0 = i * cell, y0 = j * cell;
            const path = k % 5 === 0 ? major : minor;
            const top = () => [x0 + cell * (L - a) / (b - a), y0];
            const right = () => [x0 + cell, y0 + cell * (L - b) / (c - b)];
            const bottom = () => [x0 + cell * (L - d) / (c - d), y0 + cell];
            const left = () => [x0, y0 + cell * (L - a) / (d - a)];
            const seg = (m, n) => { path.moveTo(m[0], m[1]); path.lineTo(n[0], n[1]); };
            switch (idx) {
              case 1: case 14: seg(left(), bottom()); break;
              case 2: case 13: seg(bottom(), right()); break;
              case 3: case 12: seg(left(), right()); break;
              case 4: case 11: seg(top(), right()); break;
              case 6: case 9: seg(top(), bottom()); break;
              case 7: case 8: seg(top(), left()); break;
              case 5: seg(top(), left()); seg(bottom(), right()); break;
              case 10: seg(top(), right()); seg(left(), bottom()); break;
            }
          }
        }
      }

      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(236, 231, 220, 0.15)';
      ctx.stroke(minor);
      ctx.strokeStyle = 'rgba(236, 231, 220, 0.34)';
      ctx.stroke(major);

      /* lines near the pointer warm up to the accent colour */
      if (p.k > 0.01) {
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, BUMP_RADIUS * 1.7);
        glow.addColorStop(0, `rgba(${accentRGB}, ${0.95 * p.k})`);
        glow.addColorStop(1, `rgba(${accentRGB}, 0)`);
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'source-over';
      }

      if (this.readout && p.k > 0.01) {
        const pad = n => String(Math.max(0, Math.round(n))).padStart(4, '0');
        const elev = this.sample(p.x, p.y);
        this.readout.textContent = `X ${pad(p.x)} · Y ${pad(p.y)} · ELEV ${elev >= 0 ? '+' : '−'}${Math.abs(elev).toFixed(2)}`;
      }
    }
  }

  const fields = $$('[data-contours]').map(canvas => new Contours(canvas));
  const started = performance.now();
  function tick(now) {
    if (!motionOff) {
      fields.forEach(field => {
        if (!field.visible) return;
        field.time = (now - started) / 1000;
        field.draw();
      });
    }
    frameTasks.forEach(task => task(now));
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  motionListeners.push(() => fields.forEach(field => field.draw()));

  /* ── scroll progress + "you are here" in the nav ─────────────────────── */
  const bar = $('.progress i');
  let queued = false;
  function updateProgress() {
    queued = false;
    const max = root.scrollHeight - window.innerHeight;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
  }
  window.addEventListener('scroll', () => {
    if (!queued) { queued = true; requestAnimationFrame(updateProgress); }
  }, { passive: true });
  window.addEventListener('resize', updateProgress);
  updateProgress();

  const spyLinks = $$('[data-spy]');
  const setCurrent = id => spyLinks.forEach(link => {
    if (link.dataset.spy === id) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  });
  const spy = new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) setCurrent(entry.target.id); });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main > section').forEach(section => spy.observe(section));
  /* the footer and wordmark sit below the last section; at the very bottom
     the reader is still "at" contact */
  window.addEventListener('scroll', () => {
    if (root.scrollHeight - window.innerHeight - window.scrollY < 4) setCurrent('contact');
  }, { passive: true });

  /* ── projects: one open at a time, live preview loads on demand ──────── */
  const projects = $$('.project');
  const heads = projects.map(project => $('.project-head', project));

  function loadPreview(project) {
    const frame = $('iframe[data-src]', project);
    if (!frame) return;
    const shot = frame.closest('.shot');
    /* the load event can land before the page has painted; give it a beat so
       the poster never cross-fades into a blank frame */
    frame.addEventListener('load', () => setTimeout(() => shot.classList.add('is-live'), 1800), { once: true });
    frame.src = frame.dataset.src;
    frame.removeAttribute('data-src');
  }

  function setOpen(project, open) {
    project.classList.toggle('is-open', open);
    $('.project-head', project).setAttribute('aria-expanded', String(open));
    if (open && workNear) loadPreview(project);
  }

  /* a panel closing above the clicked row would drag it up the screen, so the
     row is held where the click happened while the panels resize */
  function holdInPlace(head) {
    const startTop = head.getBoundingClientRect().top;
    const began = performance.now();
    let released = false;
    const release = () => { released = true; };
    window.addEventListener('wheel', release, { once: true, passive: true });
    window.addEventListener('touchmove', release, { once: true, passive: true });
    const resizing = () => document.getAnimations().some(a => a.transitionProperty === 'grid-template-rows');
    const step = () => {
      if (released) return;
      const drift = head.getBoundingClientRect().top - startTop;
      if (Math.abs(drift) > 0.5) window.scrollBy({ top: drift, behavior: 'instant' });
      const elapsed = performance.now() - began;
      if (elapsed < 120 || (elapsed < 3000 && resizing())) requestAnimationFrame(step);
      else { window.removeEventListener('wheel', release); window.removeEventListener('touchmove', release); }
    };
    requestAnimationFrame(step);
  }

  heads.forEach((head, index) => {
    head.addEventListener('click', () => {
      const project = projects[index];
      const willOpen = !project.classList.contains('is-open');
      holdInPlace(head);
      if (willOpen) audio.chord([5, 9, 12]);
      projects.forEach(other => setOpen(other, other === project && willOpen));
    });
    head.addEventListener('keydown', event => {
      const move = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: heads.length - 1 }[event.key];
      if (move === undefined) return;
      event.preventDefault();
      heads[(move + heads.length) % heads.length].focus();
    });
  });

  /* the first preview waits until the work section is close to the viewport */
  let workNear = false;
  const work = $('#work');
  if (work) {
    const near = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return;
      workNear = true;
      near.disconnect();
      projects.filter(project => project.classList.contains('is-open')).forEach(loadPreview);
    }, { rootMargin: '600px 0px' });
    near.observe(work);
  }

  /* each preview is a 1280px page scaled down to its frame */
  const scaler = new ResizeObserver(entries => {
    entries.forEach(entry => entry.target.style.setProperty('--s', (entry.contentRect.width / 1280).toFixed(4)));
  });
  $$('.shot-view').forEach(view => scaler.observe(view));

  /* ── reveal on scroll ────────────────────────────────────────────────── */
  const reveal = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      if (!motionOff) $$('.kicker', entry.target).forEach(scramble);
      reveal.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  $$('[data-reveal], .outro-word').forEach(element => reveal.observe(element));

  /* ── copy the email address, with whatever the browser allows ────────── */
  const copyButton = $('[data-copy]');
  const copyStatus = $('.copy-status');
  let copyTimer;
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(area);
      area.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      area.remove();
      return ok;
    }
  }
  copyButton?.addEventListener('click', async () => {
    const tag = $('.copy-tag', copyButton);
    const ok = await copyText(copyButton.dataset.copy);
    copyButton.classList.toggle('is-done', ok);
    const terrain = fields.find(field => field.host.id === 'contact');
    if (ok && terrain) {
      const from = copyButton.getBoundingClientRect();
      const box = terrain.canvas.getBoundingClientRect();
      terrain.ripple(from.left + from.width / 2 - box.left, from.top + from.height / 2 - box.top);
    }
    tag.textContent = ok ? 'Copied ✓' : 'Copy';
    copyStatus.textContent = ok
      ? 'Email address copied to your clipboard.'
      : `Couldn’t copy automatically. The address is ${copyButton.dataset.copy}`;
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copyButton.classList.remove('is-done');
      tag.textContent = 'Copy';
      copyStatus.textContent = '';
    }, 2600);
  });

  /* ══ motion layer ════════════════════════════════════════════════════ */
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

  /* wraps every word in a clipped span so it can rise into place */
  function splitWords(element, className) {
    let count = 0;
    const walk = node => [...node.childNodes].forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        const fragment = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (!part.trim()) { fragment.append(' '); return; }
          const outer = document.createElement('span');
          const inner = document.createElement('span');
          outer.className = className;
          inner.textContent = part;
          inner.style.setProperty('--i', count++);
          outer.append(inner);
          fragment.append(outer);
        });
        child.replaceWith(fragment);
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') walk(child);
    });
    walk(element);
  }
  $$('.sec-head h2, .contact h2').forEach(heading => splitWords(heading, 'w'));

  /* section labels decode themselves as they arrive */
  function scramble(element) {
    const node = element.lastChild;
    if (!node || node.nodeType !== Node.TEXT_NODE || element.dataset.scrambled) return;
    element.dataset.scrambled = '1';
    const final = node.textContent;
    const noise = '/\\+×·—01';
    const began = performance.now();
    const run = now => {
      const progress = Math.min(1, (now - began) / 750);
      const keep = Math.floor(final.length * progress);
      node.textContent = final.slice(0, keep) + [...final.slice(keep)]
        .map(ch => (ch === ' ' ? ' ' : noise[Math.floor(Math.random() * noise.length)])).join('');
      if (progress < 1) requestAnimationFrame(run);
      else node.textContent = final;
    };
    requestAnimationFrame(run);
  }

  /* ── headline: letters gain weight as the pointer comes near ─────────── */
  const title = $('#hero-title');
  const heroSection = $('.hero');
  if (title && heroSection && fine) {
    const BASE_WEIGHT = 560, EXTRA = 240, REACH = 250;
    const glyphs = [];
    title.setAttribute('aria-label', title.textContent.replace(/\s+/g, ' ').trim());
    $$('.line > span', title).forEach(line => {
      line.setAttribute('aria-hidden', 'true');
      [...line.childNodes].forEach(node => {
        if (node.nodeType !== Node.TEXT_NODE) return;
        const fragment = document.createDocumentFragment();
        [...node.textContent].forEach(ch => {
          if (!ch.trim()) { fragment.append(ch); return; }
          const glyph = document.createElement('span');
          glyph.className = 'glyph';
          glyph.textContent = ch;
          fragment.append(glyph);
          glyphs.push({ el: glyph, weight: BASE_WEIGHT });
        });
        node.replaceWith(fragment);
      });
    });
    const near = { x: 0, y: 0, on: false };
    heroSection.addEventListener('pointermove', event => {
      near.x = event.clientX; near.y = event.clientY; near.on = event.pointerType === 'mouse';
    }, { passive: true });
    heroSection.addEventListener('pointerleave', () => { near.on = false; });
    let resting = true;
    frameTasks.push(() => {
      const active = near.on && !motionOff;
      if (!active && resting) return;
      const boxes = active ? glyphs.map(glyph => glyph.el.getBoundingClientRect()) : null;
      let moving = false;
      glyphs.forEach((glyph, index) => {
        let target = BASE_WEIGHT;
        if (active) {
          const box = boxes[index];
          const distance = Math.hypot(near.x - (box.left + box.width / 2), near.y - (box.top + box.height / 2));
          target += EXTRA * Math.max(0, 1 - distance / REACH) ** 2;
        }
        const next = motionOff ? BASE_WEIGHT : glyph.weight + (target - glyph.weight) * 0.16;
        if (Math.abs(next - glyph.weight) > 0.3) {
          glyph.weight = next;
          glyph.el.style.fontWeight = Math.round(next);
          moving = true;
        } else if (!active && glyph.weight !== BASE_WEIGHT) {
          glyph.weight = BASE_WEIGHT;
          glyph.el.style.fontWeight = '';
        }
      });
      resting = !active && !moving;
    });
  }

  /* ── cursor follower: grows on links, labels the live previews ───────── */
  if (fine) {
    const cursor = document.createElement('div');
    cursor.className = 'cursor';
    cursor.setAttribute('aria-hidden', 'true');
    cursor.innerHTML = '<svg class="cursor-arrow" viewBox="0 0 24 28" width="24" height="28"><path d="M2 1.5 L2 22 L7.4 16.9 L11 25.5 L14.6 24 L11.1 15.6 L18.6 15.6 Z"/></svg><span class="cursor-label"></span>';
    document.body.append(cursor);
    root.classList.add('has-cursor');
    const label = $('span', cursor);
    /* it is the pointer itself, so it tracks the mouse exactly, with no easing */
    window.addEventListener('pointermove', event => {
      if (event.pointerType !== 'mouse') return;
      cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
      cursor.classList.add('is-on');
    }, { passive: true });
    window.addEventListener('pointerdown', () => cursor.classList.add('is-down'));
    window.addEventListener('pointerup', () => cursor.classList.remove('is-down'));
    document.addEventListener('pointerover', event => {
      const target = event.target.closest ? event.target.closest('[data-cursor], a, button') : null;
      const text = target && target.dataset.cursor ? target.dataset.cursor : '';
      cursor.classList.toggle('is-link', Boolean(target) && !text);
      cursor.classList.toggle('is-label', Boolean(text));
      if (text) label.textContent = text;
    });
    root.addEventListener('pointerleave', () => cursor.classList.remove('is-on'));

    /* previews tilt toward the pointer; tool tiles get a spotlight */
    $$('.shot').forEach(shot => {
      shot.addEventListener('pointermove', event => {
        if (motionOff) return;
        const box = shot.getBoundingClientRect();
        shot.style.setProperty('--ry', `${(((event.clientX - box.left) / box.width) - 0.5) * 7}deg`);
        shot.style.setProperty('--rx', `${(((event.clientY - box.top) / box.height) - 0.5) * -6}deg`);
      });
      shot.addEventListener('pointerleave', () => { shot.style.removeProperty('--rx'); shot.style.removeProperty('--ry'); });
    });
    $$('.tools li').forEach(tile => {
      tile.addEventListener('pointermove', event => {
        const box = tile.getBoundingClientRect();
        tile.style.setProperty('--mx', `${event.clientX - box.left}px`);
        tile.style.setProperty('--my', `${event.clientY - box.top}px`);
      });
    });
  }
  $$('.tools li').forEach((tile, index) => tile.style.setProperty('--i', index));
  $$('.outro-word span').forEach((letter, index) => letter.style.setProperty('--i', index));

  /* ── marquee: drifts on its own, leans with the scroll, and can be
        grabbed and thrown ───────────────────────────────────────────────── */
  const track = $('.marquee-track');
  if (track) {
    const band = track.parentElement;
    const unit = track.firstElementChild;
    let unitWidth = unit.offsetWidth || 1;
    const fill = () => {
      unitWidth = unit.offsetWidth || 1;
      const needed = Math.min(8, Math.ceil(window.innerWidth / unitWidth) + 1);
      while (track.children.length < needed) track.append(unit.cloneNode(true));
    };
    fill();
    window.addEventListener('resize', fill);
    if (document.fonts) document.fonts.ready.then(fill);
    let x = 0, speed = 0, lean = 0, direction = -1, thrown = 0, lastY = window.scrollY, lastTime = performance.now();
    const grab = { on: false, lastX: 0 };
    band.addEventListener('pointerdown', event => {
      if (motionOff) return;
      grab.on = true; grab.lastX = event.clientX; thrown = 0;
      band.setPointerCapture(event.pointerId);
    });
    band.addEventListener('pointermove', event => {
      if (!grab.on) return;
      const dx = event.clientX - grab.lastX;
      grab.lastX = event.clientX;
      x += dx;
      thrown = dx;
      if (dx) direction = dx > 0 ? 1 : -1;
    });
    const drop = () => { grab.on = false; };
    band.addEventListener('pointerup', drop);
    band.addEventListener('pointercancel', drop);
    frameTasks.push(now => {
      const dt = Math.min(64, now - lastTime);
      lastTime = now;
      const dy = window.scrollY - lastY;
      lastY = window.scrollY;
      if (motionOff) { track.style.transform = ''; return; }
      if (dy) direction = dy > 0 ? -1 : 1;
      speed += (Math.abs(dy) - speed) * 0.1;
      if (!grab.on) {
        x += direction * (0.05 * dt + speed * 0.7) + thrown;
        thrown *= 0.94;
        if (Math.abs(thrown) < 0.05) thrown = 0;
      }
      lean += (clamp(dy * 0.35 - thrown * 0.5, -12, 12) - lean) * 0.12;
      x = ((x % unitWidth) - unitWidth) % unitWidth;
      track.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0) skewX(${(-lean).toFixed(2)}deg)`;
    });
  }

  /* ── scroll-linked: hero recedes, the about statement lights up ──────── */
  const heroInner = $('.hero-inner');
  const statement = $('.about-copy .big');
  let litWords = [];
  if (statement) {
    splitWords(statement, 'sw');
    litWords = $$('.sw', statement);
  }
  let fxQueued = false;
  function onScrollFx() {
    fxQueued = false;
    const vh = window.innerHeight;
    if (heroInner) {
      const away = motionOff ? 0 : clamp(window.scrollY / vh, 0, 1);
      heroInner.style.transform = away ? `translate3d(0, ${(away * 90).toFixed(1)}px, 0) scale(${(1 - away * 0.05).toFixed(4)})` : '';
      heroInner.style.opacity = away ? String(clamp(1 - away * 1.25, 0, 1)) : '';
    }
    if (litWords.length) {
      const box = statement.getBoundingClientRect();
      const read = motionOff ? 1 : clamp((vh * 0.88 - box.top) / (vh * 0.5), 0, 1);
      const lit = Math.round(read * litWords.length);
      litWords.forEach((word, index) => word.classList.toggle('on', index < lit));
    }
  }
  window.addEventListener('scroll', () => {
    if (!fxQueued) { fxQueued = true; requestAnimationFrame(onScrollFx); }
  }, { passive: true });
  window.addEventListener('resize', onScrollFx);
  motionListeners.push(onScrollFx);
  onScrollFx();

  /* ══ interactive layer ═══════════════════════════════════════════════ */

  /* ── sound toggle ────────────────────────────────────────────────────── */
  const soundButton = $('#sound-toggle');
  soundButton?.addEventListener('click', () => {
    const on = audio.toggle();
    soundButton.setAttribute('aria-pressed', String(on));
    if (on) audio.chord([5, 7, 9, 12]);
  });

  /* ── colour moods ────────────────────────────────────────────────────── */
  const swatches = $$('.swatch');
  const markMood = () => {
    const current = root.dataset.palette || 'ember';
    swatches.forEach(swatch => swatch.setAttribute('aria-checked', String(swatch.dataset.palette === current)));
  };
  function setMood(name, from) {
    if ((root.dataset.palette || 'ember') === name) return;
    const apply = () => {
      if (name === 'ember') delete root.dataset.palette; else root.dataset.palette = name;
      try { localStorage.setItem('rudra-mood', name); } catch { /* not remembered */ }
      markMood();
      readAccent();
      fields.forEach(field => field.draw());
    };
    audio.chord(name === 'moss' ? [7, 9, 12] : name === 'dusk' ? [3, 7, 10] : [5, 9, 12]);
    if (!document.startViewTransition || motionOff) { apply(); return; }
    const box = from.getBoundingClientRect();
    const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
    const reach = Math.hypot(Math.max(cx, window.innerWidth - cx), Math.max(cy, window.innerHeight - cy));
    root.classList.add('mood-shift');
    const shift = document.startViewTransition(apply);
    shift.ready.then(() => root.animate(
      { clipPath: [`circle(0px at ${cx}px ${cy}px)`, `circle(${reach}px at ${cx}px ${cy}px)`] },
      { duration: 800, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' }
    )).catch(() => {});
    shift.finished.finally(() => root.classList.remove('mood-shift'));
  }
  swatches.forEach((swatch, index) => {
    swatch.addEventListener('click', () => setMood(swatch.dataset.palette, swatch));
    swatch.addEventListener('keydown', event => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const next = swatches[(index + step + swatches.length) % swatches.length];
      next.focus();
      next.click();
    });
  });
  markMood();

  /* ── type to play: every letter is a note and a ripple ───────────────── */
  window.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    if (!/^[a-z0-9]$/i.test(event.key) || root.classList.contains('loading')) return;
    const focused = document.activeElement ? document.activeElement.tagName : '';
    if (focused === 'INPUT' || focused === 'TEXTAREA' || focused === 'SELECT') return;
    const code = event.key.toLowerCase().charCodeAt(0);
    const index = code >= 97 ? code - 97 : code - 48 + 26;
    const field = fields.find(candidate => candidate.visible);
    if (field) field.ripple(field.w * (0.08 + 0.84 * (((index * 7) % 36) / 35)), field.h * (0.28 + 0.44 * (((index * 13) % 36) / 35)), index % 16);
    else audio.pluck(index % 16, 0.2);
  });

  /* ── things answer back when the pointer arrives ─────────────────────── */
  const sing = (selector, note, volume, length) => $$(selector).forEach((element, index) => {
    element.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse') audio.pluck(note(index), volume, length);
    });
  });
  sing('.project-head', index => 5 + index * 2, 0.11, 0.55);
  sing('.tools li', index => 5 + index, 0.13, 0.7);
  sing('.nav a', index => 10 + index, 0.07, 0.35);
  sing('.btn', () => 12, 0.07, 0.3);
  sing('.outro-word span', index => 10 - index, 0.12, 0.6);

  /* ── peek: a closed project's summary follows the pointer ────────────── */
  if (fine) {
    const peek = document.createElement('div');
    peek.className = 'peek';
    peek.setAttribute('aria-hidden', 'true');
    peek.innerHTML = '<div class="peek-top"></div><div class="peek-body"><p class="peek-desc"></p><span class="peek-hint">Click to open it live</span></div>';
    document.body.append(peek);
    const spot = { x: 0, y: 0, tx: 0, ty: 0, on: false };
    const place = event => {
      const right = event.clientX + 30 + 270 > window.innerWidth;
      spot.tx = right ? event.clientX - 30 - 270 : event.clientX + 30;
      spot.ty = Math.min(event.clientY + 26, window.innerHeight - 230);
    };
    const hide = () => { spot.on = false; peek.classList.remove('is-on'); };
    projects.forEach(project => {
      const head = $('.project-head', project);
      head.addEventListener('pointerenter', event => {
        if (motionOff || event.pointerType !== 'mouse' || project.classList.contains('is-open')) return;
        $('.peek-top', peek).textContent = $('.title', head).textContent;
        $('.peek-desc', peek).textContent = $('.project-desc', project).textContent;
        peek.style.setProperty('--tint', $('.shot', project).style.getPropertyValue('--tint'));
        place(event);
        spot.x = spot.tx; spot.y = spot.ty; spot.on = true;
        peek.classList.add('is-on');
      });
      head.addEventListener('pointermove', event => { if (spot.on) place(event); });
      head.addEventListener('pointerleave', hide);
      head.addEventListener('click', hide);
    });
    frameTasks.push(() => {
      if (!spot.on) return;
      const vx = spot.tx - spot.x;
      spot.x += vx * 0.16;
      spot.y += (spot.ty - spot.y) * 0.16;
      peek.style.transform = `translate3d(${spot.x.toFixed(1)}px, ${spot.y.toFixed(1)}px, 0) rotate(${clamp(vx * 0.06, -7, 7).toFixed(2)}deg)`;
    });
  }

  /* ── trail: one line runs the length of the page and is walked by
        scrolling; a marker waits at each section ────────────────────────── */
  const mainEl = $('main');
  const wideEnough = window.matchMedia('(min-width: 900px)');
  if (mainEl && $('.marquee') && $('#contact')) {
    const NS = 'http://www.w3.org/2000/svg';
    const make = (tag, cls) => { const node = document.createElementNS(NS, tag); node.setAttribute('class', cls); return node; };
    const trail = make('svg', 'trail');
    trail.setAttribute('aria-hidden', 'true');
    const basePath = make('path', 'trail-base'), donePath = make('path', 'trail-done');
    const stopLayer = make('g', 'trail-stops');
    const pulse = make('circle', 'trail-pulse'), headDot = make('circle', 'trail-head');
    pulse.setAttribute('r', 5); headDot.setAttribute('r', 4);
    trail.append(basePath, donePath, stopLayer, pulse, headDot);
    mainEl.prepend(trail);
    let total = 0, stops = [], lastSize = '';

    const walk = () => {
      if (!total) return;
      /* the walker sits at the point of the line level with 60% down the screen */
      const level = window.scrollY + window.innerHeight * 0.6 - (mainEl.getBoundingClientRect().top + window.scrollY);
      let lo = 0, hi = total;
      for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2;
        if (basePath.getPointAtLength(mid).y < level) lo = mid; else hi = mid;
      }
      const point = basePath.getPointAtLength(lo);
      donePath.style.strokeDasharray = `${total}`;
      donePath.style.strokeDashoffset = `${total - lo}`;
      headDot.setAttribute('cx', point.x); headDot.setAttribute('cy', point.y);
      pulse.setAttribute('cx', point.x); pulse.setAttribute('cy', point.y);
      stops.forEach(stop => stop.node.classList.toggle('on', stop.y <= point.y + 1));
    };

    const chart = () => {
      if (!wideEnough.matches) { total = 0; return; }
      const width = mainEl.clientWidth, height = mainEl.offsetHeight;
      const size = `${width}x${height}`;
      if (size === lastSize) return;
      lastSize = size;
      trail.setAttribute('viewBox', `0 0 ${width} ${height}`);
      trail.style.height = `${height}px`;
      const gutter = $('#work').getBoundingClientRect().left - mainEl.getBoundingClientRect().left;
      const margin = Math.max(14, gutter / 2);
      const marquee = $('.marquee'), contact = $('#contact');
      let x = width / 2, y = marquee.offsetTop + marquee.offsetHeight;
      let d = `M${x} ${y}`;
      const sweep = (toX, toY) => {
        const dy = toY - y;
        d += ` C${x} ${y + dy * 0.62} ${toX} ${toY - dy * 0.62} ${toX} ${toY}`;
        x = toX; y = toY;
      };
      stopLayer.replaceChildren();
      stops = [];
      ['work', 'about', 'toolbox'].forEach((id, index) => {
        const section = document.getElementById(id);
        if (!section) return;
        const side = index % 2 === 0 ? width - margin : margin;
        const pad = parseFloat(getComputedStyle(section).paddingTop) || 0;
        sweep(side, section.offsetTop + pad * 0.72);
        const node = make('circle', 'trail-stop');
        node.setAttribute('cx', x); node.setAttribute('cy', y); node.setAttribute('r', 4.5);
        stopLayer.append(node);
        stops.push({ node, y });
        y = section.offsetTop + section.offsetHeight;
        d += ` L${x} ${y}`;
      });
      sweep(width / 2, contact.offsetTop + 64);
      basePath.setAttribute('d', d);
      donePath.setAttribute('d', d);
      total = basePath.getTotalLength();
      walk();
    };

    chart();
    new ResizeObserver(chart).observe(mainEl);
    wideEnough.addEventListener('change', () => { lastSize = ''; chart(); });
    let walkQueued = false;
    window.addEventListener('scroll', () => {
      if (walkQueued) return;
      walkQueued = true;
      requestAnimationFrame(() => { walkQueued = false; walk(); });
    }, { passive: true });
  }

  /* ── terrain buttons: contour rings bloom under the pointer inside each
        button, follow it around, and sink into a crater on press; the
        label's letters ride the hill as it passes beneath them ──────────── */
  if (fine) {
    const CELL = 5, SPREAD = 42, STEP_B = 0.16, FLOOR = -3.2;
    const live = new Set();

    $$('.btn, .nav-cta').forEach(button => {
      /* split the label into letters, keeping the accessible name intact */
      const letters = [];
      if (!button.classList.contains('copy')) {
        const spoken = button.cloneNode(true);
        spoken.querySelectorAll('[aria-hidden="true"]').forEach(node => node.remove());
        button.setAttribute('aria-label', spoken.textContent.replace(/\s+/g, ' ').trim());
        [...button.childNodes].forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.replace(/\s+/g, ' ').trim();
            if (!text) return;
            const run = document.createElement('span');
            run.className = 'bl-run';
            run.setAttribute('aria-hidden', 'true');
            [...text].forEach(ch => {
              if (ch === ' ') { run.append(' '); return; }
              const letter = document.createElement('span');
              letter.className = 'bl';
              letter.textContent = ch;
              run.append(letter);
              letters.push(letter);
            });
            node.replaceWith(run);
          } else if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('arr')) {
            node.classList.add('bl');
            letters.push(node);
          }
        });
      }

      const canvas = document.createElement('canvas');
      canvas.className = 'btn-map';
      canvas.setAttribute('aria-hidden', 'true');
      button.prepend(canvas);
      const state = { button, canvas, pen: canvas.getContext('2d'), letters, centers: [], amp: 0, target: 0, x: 0, y: 0, tx: 0, ty: 0, w: 0, h: 0 };

      const locate = event => {
        const box = button.getBoundingClientRect();
        state.tx = event.clientX - box.left;
        state.ty = event.clientY - box.top;
        return box;
      };
      button.addEventListener('pointerenter', event => {
        if (motionOff || event.pointerType !== 'mouse') return;
        const box = locate(event);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        state.w = box.width; state.h = box.height;
        canvas.width = Math.round(box.width * dpr);
        canvas.height = Math.round(box.height * dpr);
        state.pen.setTransform(dpr, 0, 0, dpr, 0, 0);
        state.centers = letters.map(letter => {
          const at = letter.getBoundingClientRect();
          return at.left + at.width / 2 - box.left;
        });
        if (!live.has(state)) { state.x = state.tx; state.y = state.ty; }
        state.target = 1;
        live.add(state);
      });
      button.addEventListener('pointermove', event => { if (state.target) locate(event); });
      button.addEventListener('pointerleave', () => { state.target = 0; });
      /* a press punches the hill down into a crater before it springs back */
      button.addEventListener('pointerdown', () => { if (live.has(state)) state.amp = -1; });
    });

    const rest = state => {
      state.pen.clearRect(0, 0, state.w, state.h);
      state.letters.forEach(letter => { letter.style.transform = ''; });
      state.amp = 0;
      live.delete(state);
    };

    frameTasks.push(now => {
      const t = now / 1000;
      live.forEach(state => {
        state.amp += (state.target - state.amp) * (state.target ? 0.1 : 0.17);
        state.x += (state.tx - state.x) * 0.24;
        state.y += (state.ty - state.y) * 0.24;
        if (motionOff || !state.button.isConnected || (!state.target && Math.abs(state.amp) < 0.012)) { rest(state); return; }

        const { pen, w, h, amp, x: px, y: py } = state;
        const cols = Math.ceil(w / CELL) + 1, rows = Math.ceil(h / CELL) + 1;
        const vals = new Float32Array(cols * rows);
        for (let r = 0; r < rows; r++) {
          for (let q = 0; q < cols; q++) {
            const gx = q * CELL, gy = r * CELL;
            const dx = gx - px, dy = gy - py;
            vals[r * cols + q] = amp * 1.7 * Math.exp(-(dx * dx + dy * dy) / (2 * SPREAD * SPREAD))
              + amp * 0.09 * Math.sin(gx * 0.055 + t * 1.7) * Math.cos(gy * 0.1 - t * 1.3);
          }
        }
        const lines = new Path2D();
        for (let r = 0; r < rows - 1; r++) {
          for (let q = 0; q < cols - 1; q++) {
            const a = vals[r * cols + q], b = vals[r * cols + q + 1];
            const c = vals[(r + 1) * cols + q + 1], d = vals[(r + 1) * cols + q];
            const lo = Math.min(a, b, c, d), hi = Math.max(a, b, c, d);
            const last = Math.floor((hi - FLOOR) / STEP_B);
            for (let k = Math.ceil((lo - FLOOR) / STEP_B); k <= last; k++) {
              const L = FLOOR + k * STEP_B;
              if (Math.abs(L) < 0.06) continue;
              const idx = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
              if (idx === 0 || idx === 15) continue;
              const x0 = q * CELL, y0 = r * CELL;
              const top = () => [x0 + CELL * (L - a) / (b - a), y0];
              const right = () => [x0 + CELL, y0 + CELL * (L - b) / (c - b)];
              const bottom = () => [x0 + CELL * (L - d) / (c - d), y0 + CELL];
              const left = () => [x0, y0 + CELL * (L - a) / (d - a)];
              const seg = (m, n) => { lines.moveTo(m[0], m[1]); lines.lineTo(n[0], n[1]); };
              switch (idx) {
                case 1: case 14: seg(left(), bottom()); break;
                case 2: case 13: seg(bottom(), right()); break;
                case 3: case 12: seg(left(), right()); break;
                case 4: case 11: seg(top(), right()); break;
                case 6: case 9: seg(top(), bottom()); break;
                case 7: case 8: seg(top(), left()); break;
                case 5: seg(top(), left()); seg(bottom(), right()); break;
                case 10: seg(top(), right()); seg(left(), bottom()); break;
              }
            }
          }
        }

        /* dark ink on a filled button, the accent colour on an outlined one */
        const filled = state.button.matches('.primary, [aria-current="true"]');
        const strength = Math.min(1, Math.abs(amp));
        pen.clearRect(0, 0, w, h);
        const glow = pen.createRadialGradient(px, py, 0, px, py, SPREAD * 2.2);
        glow.addColorStop(0, filled ? `rgba(255, 255, 255, ${0.22 * strength})` : `rgba(${accentRGB}, ${0.2 * strength})`);
        glow.addColorStop(1, filled ? 'rgba(255, 255, 255, 0)' : `rgba(${accentRGB}, 0)`);
        pen.fillStyle = glow;
        pen.fillRect(0, 0, w, h);
        pen.lineWidth = 1;
        pen.strokeStyle = filled ? `rgba(12, 9, 6, ${0.5 * strength})` : `rgba(${accentRGB}, ${0.6 * strength})`;
        pen.stroke(lines);

        state.letters.forEach((letter, index) => {
          const gap = state.centers[index] - px;
          const lift = amp * 5.5 * Math.exp(-(gap * gap) / (2 * 36 * 36));
          letter.style.transform = `translateY(${(-lift).toFixed(2)}px)`;
        });
      });
    });
  }

  applyMotion();
})();
