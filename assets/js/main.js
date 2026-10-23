/* ==========================================================================
   Rayaan Quraishi — portfolio
   Vanilla JS, no dependencies. Every effect pauses when off-screen and
   respects prefers-reduced-motion.
   ========================================================================== */
(() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;
  const touch = matchMedia('(hover: none), (pointer: coarse)').matches;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const EMAIL = 'rayyaanquraishi@gmail.com';

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };

  /* ------------------------------------------------------------------
     Theme-aware colours for canvases
     ------------------------------------------------------------------ */
  const palette = {};
  function readPalette() {
    const cs = getComputedStyle(root);
    const v = (n) => cs.getPropertyValue(n).trim();
    palette.node = v('--node');
    palette.hot = v('--node-hot');
    palette.fg = v('--fg');
    palette.fg2 = v('--fg-2');
    palette.muted = v('--muted');
    palette.line = v('--line');
    palette.accent = v('--accent');
    palette.accentText = v('--accent-text');
    palette.bg = v('--bg');
    palette.bg3 = v('--bg-3');
  }
  readPalette();
  const rgba = (triplet, a) => `rgba(${triplet}, ${a})`;

  /* ------------------------------------------------------------------
     Toast
     ------------------------------------------------------------------ */
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-on'), 2600);
  }

  /* ------------------------------------------------------------------
     Boot sequence: first visit per session only
     ------------------------------------------------------------------ */
  function boot() {
    let seen = false;
    try { seen = sessionStorage.getItem('rq-booted') === '1'; sessionStorage.setItem('rq-booted', '1'); } catch (e) {}
    const el = $('#boot');
    if (seen || reduced) return Promise.resolve();

    el.classList.add('is-on');
    const log = $('#bootLog'), bar = $('#bootBar'), pct = $('#bootPct');
    const lines = [
      '> initialising rayaan.os <b>v2026</b>',
      '> loading weights ............ <b>ok</b>',
      '> mounting /projects ......... <b>ok</b>',
      '> warming up neural field .... <b>ok</b>',
      '> retrieving context (RAG) ... <b>ok</b>',
      '> hello, human. <b>✦</b>',
    ];
    const total = 1150;
    const start = performance.now();
    return new Promise((resolve) => {
      function tick(now) {
        const p = Math.min(1, (now - start) / total);
        const eased = 1 - Math.pow(1 - p, 3);
        bar.style.width = (eased * 100).toFixed(1) + '%';
        pct.textContent = Math.round(eased * 100);
        log.innerHTML = lines.slice(0, Math.ceil(p * lines.length)).join('\n');
        if (p < 1) requestAnimationFrame(tick);
        else {
          el.classList.add('is-done');
          setTimeout(() => { el.classList.remove('is-on'); resolve(); }, 650);
          setTimeout(resolve, 200);
        }
      }
      requestAnimationFrame(tick);
      el.addEventListener('click', () => { el.classList.add('is-done'); setTimeout(() => el.classList.remove('is-on'), 650); resolve(); }, { once: true });
    });
  }

  /* ------------------------------------------------------------------
     Text scramble
     ------------------------------------------------------------------ */
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=<>/\\';
  function scramble(el, duration = 900) {
    const target = el.dataset.text || el.textContent;
    if (reduced) { el.textContent = target; return; }
    const start = performance.now();
    function frame(now) {
      const p = Math.min(1, (now - start) / duration);
      let out = '';
      for (let i = 0; i < target.length; i++) {
        const lock = (i + 1) / target.length;
        out += p >= lock * 0.9 ? target[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = target;
    }
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------
     Canvas helpers + shared animation loop
     ------------------------------------------------------------------ */
  function fitCanvas(c) {
    const r = c.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (c.width !== w * DPR || c.height !== h * DPR) {
      c.width = w * DPR; c.height = h * DPR;
    }
    const ctx = c.getContext('2d');
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    return { ctx, w, h };
  }

  const scenes = new Set();       // scenes currently on-screen
  const allScenes = [];
  let rafId = null;
  function loop(now) {
    for (const s of scenes) s.draw(now);
    rafId = scenes.size && !document.hidden ? requestAnimationFrame(loop) : null;
  }
  function kick() { if (!rafId && scenes.size && !document.hidden) rafId = requestAnimationFrame(loop); }
  document.addEventListener('visibilitychange', kick);

  function mountScene(canvas, factory) {
    const scene = factory(canvas);
    // Reduced motion: render a single still frame whenever the canvas is shown or resized.
    const still = () => { scene.resize(); scene.draw(performance.now()); };
    const io = new IntersectionObserver(([e]) => {
      if (reduced) { if (e.isIntersecting) still(); return; }
      if (e.isIntersecting) { scene.resize(); scenes.add(scene); kick(); }
      else scenes.delete(scene);
    }, { rootMargin: '100px' });
    io.observe(canvas);
    new ResizeObserver(() => (reduced ? still() : scene.resize())).observe(canvas);
    scene.still = still;
    return scene;
  }

  /* ------------------------------------------------------------------
     Hero: neural field. Click to fire a signal that propagates.
     ------------------------------------------------------------------ */
  function neuralScene(canvas) {
    let ctx, w, h, nodes = [], signals = [];
    const mouse = { x: -9999, y: -9999, active: false };
    const LINK = 150;

    function seed() {
      const count = Math.round(Math.min(120, Math.max(36, (w * h) / 13000)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
        e: 0, refr: 0,
      }));
    }
    function nearest(x, y) {
      let best = null, bd = Infinity;
      for (const n of nodes) { const d = (n.x - x) ** 2 + (n.y - y) ** 2; if (d < bd) { bd = d; best = n; } }
      return best;
    }
    function fire(n, depth) {
      if (!n || n.refr > 0) return;
      n.e = 1; n.refr = 60;
      if (depth > 7) return;
      for (const m of nodes) {
        if (m === n || m.refr > 0) continue;
        const d = Math.hypot(m.x - n.x, m.y - n.y);
        if (d < LINK && Math.random() < 0.75) signals.push({ a: n, b: m, t: 0, v: 0.035 + Math.random() * 0.03, depth: depth + 1 });
      }
    }

    const hero = canvas.parentElement;
    hero.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.active = true;
    });
    hero.addEventListener('pointerleave', () => { mouse.active = false; mouse.x = mouse.y = -9999; });
    hero.addEventListener('click', (e) => {
      if (e.target.closest('a, button')) return;
      const r = canvas.getBoundingClientRect();
      fire(nearest(e.clientX - r.left, e.clientY - r.top), 0);
      kick();
    });

    let lastSpont = 0;
    return {
      resize() {
        const prevW = w, prevH = h;
        ({ ctx, w, h } = fitCanvas(canvas));
        if (!nodes.length || Math.abs(prevW - w) > 120 || Math.abs(prevH - h) > 200) seed();
      },
      draw(now) {
        ctx.clearRect(0, 0, w, h);
        if (now - lastSpont > 2600 && !reduced) { lastSpont = now; fire(nodes[(Math.random() * nodes.length) | 0], 3); }

        for (const n of nodes) {
          if (!reduced) {
            n.x += n.vx; n.y += n.vy;
            if (n.x < -20) n.x = w + 20; else if (n.x > w + 20) n.x = -20;
            if (n.y < -20) n.y = h + 20; else if (n.y > h + 20) n.y = -20;
            if (mouse.active) {
              const dx = mouse.x - n.x, dy = mouse.y - n.y, d = Math.hypot(dx, dy);
              if (d < 180) { n.x += dx * 0.004; n.y += dy * 0.004; n.e = Math.max(n.e, (1 - d / 180) * 0.6); }
            }
          }
          n.e *= 0.95; if (n.refr > 0) n.refr--;
        }

        ctx.lineWidth = 1;
        for (let i = 0; i < nodes.length; i++) {
          const a = nodes[i];
          for (let j = i + 1; j < nodes.length; j++) {
            const b = nodes[j];
            const dx = a.x - b.x, dy = a.y - b.y;
            if (Math.abs(dx) > LINK || Math.abs(dy) > LINK) continue;
            const d = Math.hypot(dx, dy);
            if (d > LINK) continue;
            const k = 1 - d / LINK;
            const heat = Math.max(a.e, b.e);
            ctx.strokeStyle = heat > 0.15 ? rgba(palette.hot, k * (0.15 + heat * 0.7)) : rgba(palette.node, k * 0.14);
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }

        for (let i = signals.length - 1; i >= 0; i--) {
          const s = signals[i];
          s.t += s.v;
          if (s.t >= 1) { signals.splice(i, 1); fire(s.b, s.depth); continue; }
          const x = s.a.x + (s.b.x - s.a.x) * s.t, y = s.a.y + (s.b.y - s.a.y) * s.t;
          ctx.fillStyle = rgba(palette.hot, 0.95);
          ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
        }
        if (signals.length > 400) signals.splice(0, signals.length - 400);

        for (const n of nodes) {
          const r = 1.3 + n.e * 3;
          ctx.fillStyle = n.e > 0.15 ? rgba(palette.hot, 0.5 + n.e * 0.5) : rgba(palette.node, 0.45);
          ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill();
          if (n.e > 0.4) {
            ctx.fillStyle = rgba(palette.hot, n.e * 0.12);
            ctx.beginPath(); ctx.arc(n.x, n.y, r * 6, 0, Math.PI * 2); ctx.fill();
          }
        }
      },
    };
  }

  /* ------------------------------------------------------------------
     Project visualisations: one tiny generative scene per project
     ------------------------------------------------------------------ */
  const vizzes = {
    // Weekly distress bars sliding left; forecast zone on the right.
    crisis(canvas) {
      let ctx, w, h;
      const weeks = [];
      let base = 0.3, offset = 0, lastPush = 0;
      const next = () => { base += (Math.random() - 0.48) * 0.22; base = Math.max(0.08, Math.min(0.98, base)); return base; };
      for (let i = 0; i < 40; i++) weeks.push(next());
      const stateOf = (v) => (v < 0.4 ? 0 : v < 0.6 ? 1 : v < 0.8 ? 2 : 3);
      const labels = ['STABLE', 'EARLY SIGNAL', 'ELEVATED', 'SEVERE'];
      return {
        resize() { ({ ctx, w, h } = fitCanvas(canvas)); },
        draw(now) {
          ctx.clearRect(0, 0, w, h);
          const pad = 28, chartH = h - pad * 2 - 30, n = 28;
          const bw = (w - pad * 2) / n;
          if (!reduced && now - lastPush > 70) { lastPush = now; offset += 0.06; if (offset >= 1) { offset = 0; weeks.shift(); weeks.push(next()); } }
          const fx = pad + bw * (n - 4);
          ctx.fillStyle = rgba(palette.hot, 0.06); ctx.fillRect(fx, pad, w - pad - fx, chartH + 4);
          ctx.setLineDash([3, 4]); ctx.strokeStyle = rgba(palette.hot, 0.6);
          ctx.beginPath(); ctx.moveTo(fx, pad); ctx.lineTo(fx, pad + chartH + 4); ctx.stroke(); ctx.setLineDash([]);
          ctx.font = '500 10px "JetBrains Mono", monospace';
          ctx.fillStyle = palette.accentText; ctx.fillText('FORECAST →', fx + 6, pad + 12);
          for (let s = 1; s < 4; s++) {
            const y = pad + chartH - chartH * (0.2 + s * 0.2);
            ctx.strokeStyle = rgba(palette.node, 0.07); ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke();
          }
          for (let i = 0; i < n + 1; i++) {
            const v = weeks[weeks.length - n - 1 + i];
            if (v == null) continue;
            const x = pad + (i - offset) * bw;
            if (x < pad - bw) continue;
            const bh = v * chartH, st = stateOf(v);
            const fut = x >= fx;
            const alpha = [0.18, 0.35, 0.65, 1][st] * (fut ? 0.8 : 1);
            ctx.fillStyle = st >= 2 ? rgba(palette.hot, alpha) : rgba(palette.node, alpha);
            const y = pad + chartH - bh;
            if (fut) { ctx.strokeStyle = ctx.fillStyle; ctx.strokeRect(x + 2.5, y + 0.5, bw - 6, bh - 1); }
            else ctx.fillRect(x + 2, y, bw - 5, bh);
          }
          const cur = stateOf(weeks[weeks.length - 1]);
          ctx.fillStyle = palette.muted; ctx.fillText('NEXT WEEK', pad, h - pad + 4);
          ctx.fillStyle = cur >= 2 ? palette.accentText : palette.fg;
          ctx.font = '600 13px "JetBrains Mono", monospace';
          ctx.fillText(`STATE ${cur} · ${labels[cur]}`, pad + 82, h - pad + 4);
          ctx.font = '500 10px "JetBrains Mono", monospace'; ctx.fillStyle = palette.muted;
          ctx.textAlign = 'right'; ctx.fillText('LSTM · 8-WEEK WINDOW', w - pad, h - pad + 4); ctx.textAlign = 'left';
        },
      };
    },

    // A page being scanned; text, image and video become a summary.
    summarizer(canvas) {
      let ctx, w, h;
      const particles = [];
      const summary = ['Key idea: RAG grounds answers in sources', 'PDF p.3 → pricing table extracted', 'Video 02:14 → demo of the API', 'Image (OCR) → architecture diagram'];
      return {
        resize() { ({ ctx, w, h } = fitCanvas(canvas)); },
        draw(now) {
          ctx.clearRect(0, 0, w, h);
          const t = reduced ? 1800 : now;
          const pw = Math.min(w * 0.38, 210), ph = h - 70, px = 28, py = 35;
          ctx.strokeStyle = rgba(palette.node, 0.25); ctx.lineWidth = 1;
          ctx.strokeRect(px + 0.5, py + 0.5, pw, ph);
          ctx.fillStyle = rgba(palette.node, 0.12); ctx.fillRect(px, py, pw, 18);
          const items = [];
          let y = py + 32;
          for (let i = 0; y < py + ph - 14; i++) {
            if (i === 3) { ctx.fillStyle = rgba(palette.node, 0.12); ctx.fillRect(px + 12, y, pw - 24, 46); ctx.fillStyle = palette.muted; ctx.font = '500 9px "JetBrains Mono", monospace'; ctx.fillText('IMG · OCR', px + 18, y + 27); items.push(y + 23); y += 58; continue; }
            if (i === 7) { ctx.fillStyle = rgba(palette.node, 0.12); ctx.fillRect(px + 12, y, pw - 24, 40); ctx.fillStyle = rgba(palette.node, 0.5); ctx.beginPath(); ctx.moveTo(px + pw / 2 - 6, y + 12); ctx.lineTo(px + pw / 2 + 8, y + 20); ctx.lineTo(px + pw / 2 - 6, y + 28); ctx.fill(); items.push(y + 20); y += 52; continue; }
            const lw = (pw - 24) * (0.55 + ((i * 37) % 40) / 100);
            ctx.fillStyle = rgba(palette.node, 0.2); ctx.fillRect(px + 12, y, lw, 5); items.push(y + 2); y += 13;
          }
          const scanY = py + 20 + ((t / 18) % (ph - 20));
          const g = ctx.createLinearGradient(0, scanY - 30, 0, scanY);
          g.addColorStop(0, rgba(palette.hot, 0)); g.addColorStop(1, rgba(palette.hot, 0.35));
          ctx.fillStyle = g; ctx.fillRect(px, scanY - 30, pw, 30);
          ctx.fillStyle = rgba(palette.hot, 0.9); ctx.fillRect(px, scanY, pw, 1.5);

          const bx = px + pw + Math.max(30, w * 0.07), bw = w - bx - 28, by = py + 10;
          if (!reduced && Math.random() < 0.35) particles.push({ x: px + pw, y: scanY, tx: bx, ty: by + 40 + Math.random() * (h * 0.4), t: 0 });
          for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i]; p.t += 0.03;
            if (p.t >= 1) { particles.splice(i, 1); continue; }
            const e = 1 - Math.pow(1 - p.t, 3);
            const x = p.x + (p.tx - p.x) * e, yy = p.y + (p.ty - p.y) * e - Math.sin(e * Math.PI) * 30;
            ctx.fillStyle = rgba(palette.hot, 1 - p.t * 0.5); ctx.fillRect(x, yy, 2, 2);
          }
          if (bw > 120) {
            ctx.fillStyle = palette.bg3; roundRect(ctx, bx, by, bw, h - 80, 12); ctx.fill();
            ctx.font = '500 10px "JetBrains Mono", monospace'; ctx.fillStyle = palette.accentText; ctx.fillText('✦ SUMMARY', bx + 16, by + 24);
            ctx.font = '400 12px "Space Grotesk", sans-serif';
            const cycle = (t / 60) % (summary.join('').length + 40);
            let shown = cycle, ly = by + 50;
            for (const line of summary) {
              if (shown <= 0) break;
              const txt = line.slice(0, Math.floor(shown));
              ctx.fillStyle = palette.fg2;
              wrapText(ctx, '• ' + txt, bx + 16, ly, bw - 30, 16).forEach((l, k) => { ctx.fillText(l, bx + 16, ly + k * 16); });
              ly += 16 * Math.ceil(ctx.measureText('• ' + line).width / (bw - 30)) + 10;
              shown -= line.length;
            }
            const iy = by + h - 80 - 46;
            ctx.strokeStyle = rgba(palette.node, 0.18); roundRect(ctx, bx + 12, iy, bw - 24, 32, 16); ctx.stroke();
            ctx.fillStyle = palette.muted; ctx.font = '400 11px "Space Grotesk", sans-serif';
            ctx.fillText('Ask a follow-up about this page…', bx + 26, iy + 20);
            ctx.fillStyle = palette.accent; ctx.beginPath(); ctx.arc(bx + bw - 28, iy + 16, 10, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = palette.bg; ctx.lineWidth = 1.6; ctx.beginPath();
            ctx.moveTo(bx + bw - 28, iy + 21); ctx.lineTo(bx + bw - 28, iy + 11); ctx.moveTo(bx + bw - 32, iy + 15); ctx.lineTo(bx + bw - 28, iy + 11); ctx.lineTo(bx + bw - 24, iy + 15); ctx.stroke();
            ctx.lineWidth = 1;
            if (bw > 240) {
              ctx.font = '500 10px "JetBrains Mono", monospace'; ctx.fillStyle = palette.muted;
              ctx.fillText('SOURCES  [1] page  [2] tavily  [3] youtube', bx + 16, iy - 14);
            }
          }
        },
      };
    },

    // Regulation radar with sweep and blips.
    juristrack(canvas) {
      let ctx, w, h;
      const blips = [
        { a: 0.6, r: 0.55, l: 'EU DSA', risk: 'HIGH' }, { a: 1.9, r: 0.75, l: 'CCPA', risk: 'MED' },
        { a: 2.9, r: 0.35, l: 'UTAH', risk: 'HIGH' }, { a: 4.1, r: 0.65, l: 'FLORIDA', risk: 'LOW' },
        { a: 5.2, r: 0.45, l: 'NCMEC', risk: 'HIGH' },
      ].map((b) => ({ ...b, glow: 0 }));
      let last = 0;
      return {
        resize() { ({ ctx, w, h } = fitCanvas(canvas)); },
        draw(now) {
          ctx.clearRect(0, 0, w, h);
          const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 30;
          ctx.strokeStyle = rgba(palette.node, 0.14); ctx.lineWidth = 1;
          for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.arc(cx, cy, (R * i) / 4, 0, Math.PI * 2); ctx.stroke(); }
          for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke(); }
          const sweep = reduced ? 1.2 : (now / 1400) % (Math.PI * 2);
          const steps = 30;
          for (let i = 0; i < steps; i++) {
            const a0 = sweep - (i + 1) * 0.03, a1 = sweep - i * 0.03;
            ctx.fillStyle = rgba(palette.hot, 0.22 * (1 - i / steps));
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a1); ctx.closePath(); ctx.fill();
          }
          ctx.strokeStyle = rgba(palette.hot, 0.9); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R); ctx.stroke();
          const dt = Math.min(50, now - last); last = now;
          ctx.font = '500 10px "JetBrains Mono", monospace';
          for (const b of blips) {
            const diff = (sweep - b.a + Math.PI * 4) % (Math.PI * 2);
            if (diff < 0.08) b.glow = 1; else b.glow = Math.max(reduced ? 0.6 : 0, b.glow - dt / 2400);
            const x = cx + Math.cos(b.a) * R * b.r, y = cy + Math.sin(b.a) * R * b.r;
            const hot = b.risk === 'HIGH';
            ctx.fillStyle = hot ? rgba(palette.hot, 0.25 + b.glow * 0.75) : rgba(palette.node, 0.25 + b.glow * 0.6);
            ctx.beginPath(); ctx.arc(x, y, 3.5 + b.glow * 2, 0, Math.PI * 2); ctx.fill();
            if (b.glow > 0.05) {
              ctx.strokeStyle = hot ? rgba(palette.hot, b.glow * 0.6) : rgba(palette.node, b.glow * 0.4);
              ctx.beginPath(); ctx.arc(x, y, 6 + (1 - b.glow) * 14, 0, Math.PI * 2); ctx.stroke();
              ctx.fillStyle = hot ? palette.accentText : palette.fg2;
              ctx.globalAlpha = Math.min(1, b.glow * 1.6);
              ctx.fillText(`${b.l} · ${b.risk}`, x + 10, y - 8);
              ctx.globalAlpha = 1;
            }
          }
          ctx.fillStyle = palette.muted; ctx.fillText('GEO-COMPLIANCE RADAR', 24, 30);
          ctx.textAlign = 'right'; ctx.fillText('RISK 0–100', w - 24, h - 20); ctx.textAlign = 'left';
        },
      };
    },

    // Code lines heat up and then get optimised; CO₂ counter falls.
    greenory(canvas) {
      let ctx, w, h;
      const lines = Array.from({ length: 18 }, (_, i) => ({
        indent: [0, 1, 1, 2, 2, 1, 2, 3, 3, 2, 1, 0, 1, 2, 2, 1, 1, 0][i],
        len: 0.25 + ((i * 53) % 55) / 100, heat: 0, fixed: false,
      }));
      let co2 = 142.0, lastEvent = 0, active = -1;
      return {
        resize() { ({ ctx, w, h } = fitCanvas(canvas)); },
        draw(now) {
          ctx.clearRect(0, 0, w, h);
          if (!reduced && now - lastEvent > 900) {
            lastEvent = now;
            const candidates = lines.map((l, i) => i).filter((i) => !lines[i].fixed);
            if (!candidates.length) { lines.forEach((l) => { l.fixed = false; l.heat = 0; }); co2 = 142.0; }
            else { active = candidates[(Math.random() * candidates.length) | 0]; lines[active].heat = 1; }
          }
          const pad = 28, lh = Math.min(16, (h - pad * 2 - 40) / lines.length);
          const codeW = Math.min(w * 0.6, 360);
          ctx.font = '400 10px "JetBrains Mono", monospace';
          lines.forEach((l, i) => {
            const y = pad + 26 + i * lh;
            ctx.fillStyle = palette.muted; ctx.fillText(String(i + 1).padStart(2, '0'), pad, y + 6);
            const x = pad + 28 + l.indent * 16, lw = (codeW - 28 - l.indent * 16) * l.len;
            if (l.heat > 0 && !l.fixed) {
              l.heat -= 0.012;
              if (l.heat <= 0.02) { l.fixed = true; co2 = Math.max(18, co2 - (4 + Math.random() * 6)); }
              ctx.fillStyle = `rgba(255, 92, 60, ${0.3 + l.heat * 0.6})`;
              ctx.fillRect(x - 6, y - 2, codeW - x + pad, lh - 3);
            }
            ctx.fillStyle = l.fixed ? rgba(palette.hot, 0.8) : rgba(palette.node, 0.28);
            ctx.fillRect(x, y, l.fixed ? lw * 0.7 : lw, 5);
          });
          ctx.fillStyle = palette.muted; ctx.fillText('AST SCAN · src/train.py', pad, pad + 6);

          const gx = pad + codeW + 30;
          if (w - gx > 120) {
            const gcx = gx + (w - gx - pad) / 2, gcy = h / 2 + 10, gr = Math.min((w - gx - pad) / 2, h / 3);
            const frac = (co2 - 18) / (142 - 18);
            ctx.lineWidth = 10; ctx.lineCap = 'round';
            ctx.strokeStyle = rgba(palette.node, 0.1);
            ctx.beginPath(); ctx.arc(gcx, gcy, gr, Math.PI * 0.75, Math.PI * 2.25); ctx.stroke();
            ctx.strokeStyle = frac > 0.5 ? 'rgba(255, 92, 60, 0.85)' : rgba(palette.hot, 0.9);
            ctx.beginPath(); ctx.arc(gcx, gcy, gr, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * frac); ctx.stroke();
            ctx.lineWidth = 1; ctx.lineCap = 'butt';
            ctx.textAlign = 'center'; ctx.fillStyle = palette.fg;
            ctx.font = `600 ${Math.round(gr / 2.4)}px "Space Grotesk", sans-serif`;
            ctx.fillText(co2.toFixed(1), gcx, gcy + 6);
            ctx.font = '500 10px "JetBrains Mono", monospace'; ctx.fillStyle = palette.muted;
            ctx.fillText('gCO₂e / run', gcx, gcy + 26);
            ctx.textAlign = 'left';
          }
        },
      };
    },

    // Waveform, Devanagari syllables and a pronunciation score.
    lingoleap(canvas) {
      let ctx, w, h;
      const letters = ['क', 'ख', 'ग', 'र', 'स', 'श', 'ल', 'ट'];
      let idx = 0, lastSwap = 0, score = 0, target = 82;
      return {
        resize() { ({ ctx, w, h } = fitCanvas(canvas)); },
        draw(now) {
          ctx.clearRect(0, 0, w, h);
          const t = reduced ? 0 : now / 1000;
          if (!reduced && now - lastSwap > 2400) { lastSwap = now; idx = (idx + 1) % letters.length; score = 0; target = 70 + Math.round(Math.random() * 28); }
          score += (target - score) * 0.04;
          const cy = h * 0.62, bars = Math.floor((w - 56) / 7);
          for (let i = 0; i < bars; i++) {
            const x = 28 + i * 7;
            const env = Math.sin((i / bars) * Math.PI);
            const a = (Math.sin(i * 0.35 + t * 6) * 0.5 + Math.sin(i * 0.13 - t * 3.3) * 0.5) * env;
            const bh = 4 + Math.abs(a) * h * 0.22;
            const lit = i / bars < ((now - lastSwap) / 2400);
            ctx.fillStyle = lit ? rgba(palette.hot, 0.85) : rgba(palette.node, 0.22);
            ctx.fillRect(x, cy - bh / 2, 3, bh);
          }
          ctx.textAlign = 'center';
          ctx.font = `600 ${Math.round(h * 0.26)}px "Noto Sans Devanagari", "Mangal", "Kohinoor Devanagari", sans-serif`;
          ctx.fillStyle = palette.fg;
          ctx.fillText(letters[idx], w * 0.5, h * 0.36);
          ctx.font = '500 10px "JetBrains Mono", monospace'; ctx.fillStyle = palette.muted;
          ctx.fillText('SAY IT OUT LOUD', w * 0.5, h * 0.36 + 22);
          ctx.textAlign = 'left';
          const sx = w - 92, sy = 52;
          ctx.lineWidth = 4; ctx.strokeStyle = rgba(palette.node, 0.12);
          ctx.beginPath(); ctx.arc(sx, sy, 24, 0, Math.PI * 2); ctx.stroke();
          ctx.strokeStyle = rgba(palette.hot, 0.9);
          ctx.beginPath(); ctx.arc(sx, sy, 24, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * score) / 100); ctx.stroke();
          ctx.lineWidth = 1;
          ctx.textAlign = 'center'; ctx.font = '600 13px "Space Grotesk", sans-serif'; ctx.fillStyle = palette.fg;
          ctx.fillText(Math.round(score), sx, sy + 5); ctx.textAlign = 'left';
          ctx.font = '500 10px "JetBrains Mono", monospace'; ctx.fillStyle = palette.muted;
          ctx.fillText('LEVEL 3 · STREAK 7 ✦', 28, 34);
        },
      };
    },
  };

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function wrapText(ctx, text, x, y, max) {
    const words = text.split(' '), out = []; let line = '';
    for (const wd of words) { const test = line ? line + ' ' + wd : wd; if (ctx.measureText(test).width > max && line) { out.push(line); line = wd; } else line = test; }
    if (line) out.push(line); return out;
  }

  /* ------------------------------------------------------------------
     Hero details: clock, rotating role, random fact, word reveal
     ------------------------------------------------------------------ */
  function clock() {
    const el = $('#clock');
    const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Singapore' });
    const tick = () => { el.textContent = fmt.format(new Date()); };
    tick(); setInterval(tick, 15000);
  }

  function roles() {
    const el = $('#role');
    const list = ['MComp AI @ NUS', 'SWE Intern @ BIOTRONIK', 'building microservices', 'shipping LLM agents', 'building RAG pipelines', 'AWS Certified Developer', 'open to SWE & AI roles'];
    if (reduced) return;
    let i = 0;
    async function type(text) {
      for (let k = el.textContent.length; k >= 0; k--) { el.textContent = el.textContent.slice(0, k); await wait(22); }
      for (let k = 1; k <= text.length; k++) { el.textContent = text.slice(0, k); await wait(45); }
    }
    (async function run() { for (;;) { await wait(2600); i = (i + 1) % list.length; await type(list[i]); } })();
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const FACTS = [
    'I moved from Mumbai to Singapore to study AI.',
    'I help roll out Claude Code to software teams at BIOTRONIK.',
    'I graduated with a 9.97 / 10 GPA. That last 0.03 still haunts me.',
    'I published at a Springer Nature conference before finishing my bachelor\'s.',
    'I was the Tech Head at MUN: mics, projectors and panic.',
    'My first ML model recommended movies. It still thinks everyone wants Avatar.',
    'I have won three institute-level competitions, two of them for startup ideas.',
    'I have volunteered with the Rotaract Club for community service.',
    'This site has no framework. Every pixel is hand-written.',
  ];
  function facts() {
    const btn = $('#fact');
    let i = Math.floor(Math.random() * FACTS.length);
    btn.textContent = FACTS[i];
    btn.addEventListener('click', () => {
      i = (i + 1 + Math.floor(Math.random() * (FACTS.length - 1))) % FACTS.length;
      btn.textContent = FACTS[i];
    });
  }

  function splitWords(el, cls, delayStep) {
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const s = document.createElement('span'); s.className = cls; s.textContent = part; frag.appendChild(s);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) walk(child);
      });
    };
    walk(el);
    if (delayStep) $$('.' + cls, el).forEach((s, i) => { s.style.transitionDelay = (0.35 + i * delayStep) + 's'; });
    return $$('.' + cls, el);
  }

  /* ------------------------------------------------------------------
     Scroll: progress bar, nav state, statement scrub
     ------------------------------------------------------------------ */
  function scrollEffects() {
    const bar = $('#progress'), nav = $('#nav');
    const statement = $('#statement');
    const words = reduced ? [] : splitWords(statement, 'sw');
    let lastY = scrollY, ticking = false;

    function update() {
      ticking = false;
      const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
      nav.classList.toggle('is-scrolled', y > 40);
      const hidden = y > lastY && y > 400 && !document.querySelector('dialog[open]');
      nav.classList.toggle('is-hidden', hidden);
      lastY = y;
      if (words.length) {
        const r = statement.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.35)));
        const lit = Math.floor(p * words.length);
        words.forEach((w, i) => w.classList.toggle('on', i < lit));
      }
    }
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();

    const links = $$('[data-nav]');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('main section[id]').forEach((s) => io.observe(s));
  }

  function reveals() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    $$('.reveal').forEach((el) => io.observe(el));

    const cio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        cio.unobserve(e.target);
        const el = e.target, to = parseFloat(el.dataset.count), dec = +el.dataset.decimals || 0;
        if (reduced) { el.textContent = to.toFixed(dec); return; }
        const start = performance.now(), dur = 1400;
        (function f(now) {
          const p = Math.min(1, (now - start) / dur), v = to * (1 - Math.pow(1 - p, 4));
          el.textContent = v.toFixed(dec);
          if (p < 1) requestAnimationFrame(f);
        })(start);
      });
    }, { threshold: 0.6 });
    $$('[data-count]').forEach((el) => cio.observe(el));
  }

  /* ------------------------------------------------------------------
     Pointer: custom cursor, magnetic buttons, card spotlight + tilt
     ------------------------------------------------------------------ */
  function pointer() {
    if (!finePointer || reduced) return;
    root.classList.add('has-cursor');
    const cur = $('.cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring');
    let mx = -100, my = -100, rx = -100, ry = -100;
    addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`; }, { passive: true });
    addEventListener('pointerdown', () => cur.classList.add('is-down'));
    addEventListener('pointerup', () => cur.classList.remove('is-down'));
    document.addEventListener('pointerover', (e) => cur.classList.toggle('is-hover', !!e.target.closest('a, button, .project, input, .chips li')));
    const dialogs = $$('dialog');
    const syncDialogs = () => root.classList.toggle('dialog-open', dialogs.some((d) => d.open));
    const mo = new MutationObserver(syncDialogs);
    dialogs.forEach((d) => mo.observe(d, { attributes: true, attributeFilter: ['open'] }));
    (function follow() {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
      requestAnimationFrame(follow);
    })();

    $$('.magnetic').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
        el.style.transform = `translate(${x * 0.25}px, ${y * 0.3}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transition = 'transform .5s cubic-bezier(.22,1,.36,1)'; el.style.transform = ''; setTimeout(() => (el.style.transition = ''), 500); });
    });

    $$('.project').forEach((card) => {
      const viz = $('.project__viz', card);
      card.addEventListener('pointermove', (e) => {
        const r = viz.getBoundingClientRect();
        viz.style.setProperty('--mx', ((e.clientX - r.left) / r.width) * 100 + '%');
        viz.style.setProperty('--my', ((e.clientY - r.top) / r.height) * 100 + '%');
      });
    });
  }

  /* ------------------------------------------------------------------
     Theme
     ------------------------------------------------------------------ */
  function setTheme(t) {
    root.dataset.theme = t;
    store.set('rq-theme', t);
    $('meta[name="theme-color"]').setAttribute('content', t === 'light' ? '#f3f1ea' : '#0b0b0c');
    requestAnimationFrame(() => { readPalette(); allScenes.forEach((s) => (reduced ? s.still() : s.draw(performance.now()))); });
  }
  const toggleTheme = () => setTheme(root.dataset.theme === 'light' ? 'dark' : 'light');

  /* ------------------------------------------------------------------
     Case-study drawer
     ------------------------------------------------------------------ */
  function caseStudies() {
    const dlg = $('#caseDialog');
    function open(id, push = true) {
      const card = $(`.project[data-project="${id}"]`);
      if (!card) return;
      $('#caseTitle').textContent = $('.project__title', card).textContent;
      $('#caseMeta').textContent = $$('.project__top span', card).map((s) => s.textContent).join('  ·  ');
      $('#caseTags').innerHTML = $('.tags', card).innerHTML;
      const content = $('#caseContent');
      content.replaceChildren($('template[data-case]', card).content.cloneNode(true));
      const links = $('#caseLinks');
      links.replaceChildren(...$$('.project__links a', card).map((a) => a.cloneNode(true)));
      if (!dlg.open) dlg.showModal();
      $('.case__inner', dlg).scrollTop = 0;
      if (push) history.replaceState(null, '', '#case-' + id);
    }
    function close() { if (dlg.open) dlg.close(); }
    dlg.addEventListener('close', () => { if (location.hash.startsWith('#case-')) history.replaceState(null, '', location.pathname + location.search); });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
    $('#caseClose').addEventListener('click', close);
    $$('[data-open]').forEach((b) => b.addEventListener('click', () => open(b.dataset.open)));
    $$('.project').forEach((card) => {
      $('.project__viz', card).addEventListener('click', () => open(card.dataset.project));
      $('.project__viz', card).style.cursor = 'pointer';
    });
    if (location.hash.startsWith('#case-')) setTimeout(() => open(location.hash.slice(6), false), 400);
    return open;
  }

  /* ------------------------------------------------------------------
     Archive: filters + live GitHub metadata
     ------------------------------------------------------------------ */
  const LANG_COLORS = { Python: '#3572A5', JavaScript: '#f1e05a', TypeScript: '#3178c6', 'C++': '#f34b7d', HTML: '#e34c26', CSS: '#663399', PHP: '#4F5D95', 'Jupyter Notebook': '#DA5B0B' };
  function archive() {
    const rows = $$('.archive tbody tr');
    $$('.filter').forEach((btn) => btn.addEventListener('click', () => {
      $$('.filter').forEach((b) => { b.classList.toggle('is-active', b === btn); b.setAttribute('aria-pressed', b === btn); });
      const f = btn.dataset.filter;
      rows.forEach((r) => r.classList.toggle('is-hidden', f !== 'all' && !r.dataset.tags.split(' ').includes(f)));
    }));

    fetch('data/github.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((data) => {
      if (!data || !data.repos) return;
      rows.forEach((row) => {
        const repo = data.repos[row.dataset.repo];
        if (!repo) return;
        const a = $('.num a', row);
        if (!a) return;
        const bits = [];
        if (repo.language) bits.push(`<span class="star hide-sm"><i class="lang-dot" style="background:${LANG_COLORS[repo.language] || 'var(--muted)'}"></i>${repo.language}</span>`);
        if (repo.stars > 0) bits.push(`<span class="star">★ ${repo.stars}</span>`);
        a.innerHTML = bits.join(' ') + ' ↗';
      });
    }).catch(() => {});
  }

  /* ------------------------------------------------------------------
     Email copy
     ------------------------------------------------------------------ */
  async function copyEmail() {
    try { await navigator.clipboard.writeText(EMAIL); toast('Email copied: ' + EMAIL); return true; }
    catch (e) { location.href = 'mailto:' + EMAIL; return false; }
  }
  function emailButton() {
    const btn = $('#copyEmail'), hint = $('#copyHint');
    btn.addEventListener('click', async () => {
      if (await copyEmail()) { hint.textContent = 'copied ✓'; setTimeout(() => (hint.textContent = 'click to copy'), 2000); }
    });
  }

  /* ------------------------------------------------------------------
     Résumé button appears only if the PDF has been added to the repo
     ------------------------------------------------------------------ */
  let resumeUrl = null;
  function resume() {
    const btn = $('#resumeBtn');
    fetch(btn.getAttribute('href'), { method: 'HEAD' }).then((r) => {
      if (r.ok) { btn.hidden = false; resumeUrl = btn.href; }
    }).catch(() => {});
  }

  /* ------------------------------------------------------------------
     Hire mode easter egg (Konami code or `sudo hire-me`)
     ------------------------------------------------------------------ */
  function hireMode() {
    const on = document.body.classList.toggle('hire-mode');
    readPalette();
    toast(on ? 'Hire mode unlocked: ' + EMAIL : 'Back to normal');
    return on;
  }
  function konami() {
    const seq = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let i = 0;
    addEventListener('keydown', (e) => {
      i = e.key === seq[i] ? i + 1 : e.key === seq[0] ? 1 : 0;
      if (i === seq.length) { i = 0; hireMode(); }
    });
  }

  /* ------------------------------------------------------------------
     Command palette (⌘K / Ctrl+K)
     ------------------------------------------------------------------ */
  function commandPalette(openCase, openTerm) {
    const dlg = $('#palette'), input = $('#paletteInput'), list = $('#paletteList');
    const go = (sel) => () => $(sel).scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    const cmds = [
      { g: 'Go to', t: 'Selected work', k: 'G W', run: go('#work') },
      { g: 'Go to', t: 'About', k: 'G A', run: go('#about') },
      { g: 'Go to', t: 'Experience & education', k: 'G E', run: go('#experience') },
      { g: 'Go to', t: 'Archive', k: 'G R', run: go('#archive') },
      { g: 'Go to', t: 'Contact', k: 'G C', run: go('#contact') },
      ...$$('.project').map((p) => ({ g: 'Case study', t: $('.project__title', p).textContent, run: () => openCase(p.dataset.project) })),
      { g: 'Action', t: 'Copy email address', run: copyEmail },
      { g: 'Action', t: 'Toggle light / dark theme', k: 'T', run: toggleTheme },
      { g: 'Action', t: 'Open terminal', k: '`', run: openTerm },
      { g: 'Action', t: 'Download résumé', run: () => (resumeUrl ? open(resumeUrl, '_blank') : toast('Résumé available on request: ' + EMAIL)) },
      { g: 'Link', t: 'GitHub: RayaanQ', run: () => open('https://github.com/RayaanQ', '_blank', 'noopener') },
      { g: 'Link', t: 'LinkedIn', run: () => open('https://www.linkedin.com/in/rayaan-quraishi', '_blank', 'noopener') },
      { g: 'Link', t: 'Send an email', run: () => (location.href = 'mailto:' + EMAIL) },
      { g: 'Secret', t: 'Hire mode ✦', run: hireMode },
    ];
    let filtered = cmds, sel = 0;
    function render() {
      const q = input.value.trim().toLowerCase();
      filtered = cmds.filter((c) => (c.g + ' ' + c.t).toLowerCase().includes(q));
      sel = Math.min(sel, Math.max(0, filtered.length - 1));
      list.innerHTML = filtered.length
        ? filtered.map((c, i) => `<li role="option" aria-selected="${i === sel}" data-i="${i}"><span class="pk">${c.t}</span><span class="pg">${c.g}${c.k && !touch ? ' · ' + c.k : ''}</span></li>`).join('')
        : '<li class="empty">No results. Try "work" or "theme"</li>';
      const cur = list.children[sel]; if (cur) cur.scrollIntoView({ block: 'nearest' });
    }
    function run(i) { const c = filtered[i]; if (!c) return; dlg.close(); setTimeout(c.run, 60); }
    // On touch screens the palette doubles as the site menu, so don't pop the keyboard over it.
    if (touch) { const box = $('.palette__box', dlg); box.tabIndex = -1; box.setAttribute('autofocus', ''); input.placeholder = 'Search…'; }
    function show() { if (dlg.open) return; input.value = ''; sel = 0; render(); dlg.showModal(); if (!touch) input.focus(); }
    input.addEventListener('input', () => { sel = 0; render(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(1, filtered.length); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + filtered.length) % Math.max(1, filtered.length); render(); }
      else if (e.key === 'Enter') { e.preventDefault(); run(sel); }
    });
    list.addEventListener('click', (e) => { const li = e.target.closest('li[data-i]'); if (li) run(+li.dataset.i); });
    list.addEventListener('pointermove', (e) => { const li = e.target.closest('li[data-i]'); if (li && +li.dataset.i !== sel) { sel = +li.dataset.i; render(); } });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    $('#paletteBtn').addEventListener('click', show);
    return show;
  }

  /* ------------------------------------------------------------------
     Terminal
     ------------------------------------------------------------------ */
  function terminal(openCase) {
    const dlg = $('#term'), out = $('#termOut'), input = $('#termInput'), form = $('#termForm'), body = $('#termBody');
    const history = []; let hi = 0;
    const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const print = (html) => { const d = document.createElement('div'); d.innerHTML = html; out.appendChild(d); body.scrollTop = body.scrollHeight; };
    const link = (href, label) => `<a href="${href}" target="_blank" rel="noopener">${label || href}</a>`;
    const projects = $$('.project').map((p, i) => ({ n: i + 1, id: p.dataset.project, title: $('.project__title', p).textContent, desc: $('.project__desc', p).textContent }));

    const NEOFETCH = [
      ['██████   ██████ ', '<span class="accent">guest</span>@<span class="accent">rayaan</span>'],
      ['██   ██ ██    ██', '----------------'],
      ['██████  ██    ██', '<span class="accent">OS</span>: rayaan.os 2026 (vanilla js)'],
      ['██   ██ ██ ▄▄ ██', '<span class="accent">Host</span>: NUS · BIOTRONIK'],
      ['██   ██  ██████ ', '<span class="accent">Kernel</span>: MComp, Artificial Intelligence'],
      ['            ▀▀  ', '<span class="accent">Shell</span>: python · c++ · javascript'],
      ['                ', '<span class="accent">Packages</span>: langchain, pytorch, fastapi, aws'],
      ['                ', '<span class="accent">GPA</span>: 9.97 / 10'],
    ].map(([art, info]) => `<span class="accent">${art}</span>   ${info}`).join('\n');

    const cmds = {
      help: () => `Available commands:
  <span class="accent">whoami</span>       who is this guy?
  <span class="accent">about</span>        the short story
  <span class="accent">projects</span>     list selected work
  <span class="accent">open</span> &lt;n&gt;     open a case study (e.g. open 1)
  <span class="accent">skills</span>       the toolbox
  <span class="accent">experience</span>   where I've worked
  <span class="accent">education</span>    where I've studied
  <span class="accent">contact</span>      ways to reach me
  <span class="accent">resume</span>       get my résumé
  <span class="accent">neofetch</span>     system info
  <span class="accent">theme</span>        toggle light / dark
  <span class="accent">clear</span>        clear the screen
  <span class="accent">exit</span>         close the terminal
<span class="muted">…and maybe a secret or two. Try sudo.</span>`,
      whoami: () => 'Rayaan Quraishi: software & AI engineer, MComp (AI) student at NUS, Software Developer Intern at BIOTRONIK, based in Singapore.\nOpen to Software Development and AI Engineering roles.',
      about: () => 'I build intelligent software: production microservices, RAG pipelines and LLM agents.\nMComp AI @ NUS (GPA 4.67/5), B.E. Computer Engineering (GPA 9.97/10), AWS Certified Developer, Springer-published.',
      projects: () => projects.map((p) => `<span class="accent">[${p.n}]</span> ${esc(p.title)}\n    <span class="muted">${esc(p.desc.slice(0, 96))}…</span>`).join('\n') + '\n\nType <span class="accent">open &lt;n&gt;</span> for the case study.',
      open: (arg) => {
        const p = projects.find((x) => String(x.n) === arg || x.id === arg);
        if (!p) return 'usage: open &lt;1-' + projects.length + '&gt;';
        setTimeout(() => { dlg.close(); openCase(p.id); }, 250);
        return 'opening ' + esc(p.title) + '…';
      },
      skills: () => $$('.toolbox__group').map((g) => `<span class="accent">${esc($('h3', g).textContent)}</span>: ${$$('li', g).map((l) => esc(l.textContent)).join(', ')}`).join('\n'),
      experience: () => $$('.tl').filter((t) => /Intern/.test($('h3', t).textContent)).map((t) => `<span class="accent">${esc($('.tl__when', t).textContent)}</span>  ${esc($('h3', t).textContent)} · ${esc($('.tl__org', t).textContent)}`).join('\n'),
      education: () => $$('.tl').filter((t) => !/Intern/.test($('h3', t).textContent)).map((t) => `<span class="accent">${esc($('.tl__when', t).textContent)}</span>  ${esc($('h3', t).textContent)} · ${esc($('.tl__org', t).textContent)}`).join('\n'),
      contact: () => `email     ${link('mailto:' + EMAIL, EMAIL)}\ngithub    ${link('https://github.com/RayaanQ')}\nlinkedin  ${link('https://www.linkedin.com/in/rayaan-quraishi')}`,
      resume: () => (resumeUrl ? 'Opening résumé… ' + link(resumeUrl, 'résumé.pdf') + (open(resumeUrl, '_blank'), '') : 'Résumé available on request: ' + link('mailto:' + EMAIL, EMAIL)),
      neofetch: () => NEOFETCH,
      theme: () => { toggleTheme(); return 'theme → ' + root.dataset.theme; },
      ls: () => 'about.md  projects/  experience.log  skills.json  contact.txt  secrets/',
      'ls secrets/': () => 'permission denied. nice try though.',
      cat: (arg) => ({ 'about.md': cmds.about(), 'skills.json': cmds.skills(), 'contact.txt': cmds.contact(), 'experience.log': cmds.experience() }[arg] || `cat: ${esc(arg || '')}: no such file`),
      date: () => new Date().toString(),
      echo: (arg) => esc(arg),
      pwd: () => '/home/guest/rayaan',
      sudo: (arg) => (/hire/.test(arg) ? (hireMode(), '<span class="accent">✦ access granted.</span> Rayaan has been added to your shortlist.\nNext step: ' + link('mailto:' + EMAIL + '?subject=Let%27s%20talk', 'send an email')) : `[sudo] password for guest: ********\nguest is not in the sudoers file. This incident will be reported. 👀\n<span class="muted">hint: sudo hire-me</span>`),
      'rm': () => 'rm: refusing to delete my portfolio, thank you very much.',
      vim: () => 'You are now trapped in vim. Just kidding. Type exit.',
      coffee: () => '☕ brewing… done. Productivity +12%.',
      clear: () => { out.innerHTML = ''; return null; },
      exit: () => { setTimeout(() => dlg.close(), 120); return 'bye 👋'; },
    };

    function exec(raw) {
      const line = raw.trim();
      print(`<span class="accent">guest@rayaan</span>:<span class="muted">~</span>$ ${esc(line)}`);
      if (!line) return;
      history.push(line); hi = history.length;
      const [cmd, ...rest] = line.split(/\s+/);
      const arg = rest.join(' ');
      const fn = cmds[line] || cmds[cmd.toLowerCase()];
      const res = fn ? fn(arg) : `command not found: ${esc(cmd)}. Type <span class="accent">help</span>.`;
      if (res != null) print(res);
    }

    form.addEventListener('submit', (e) => { e.preventDefault(); exec(input.value); input.value = ''; });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') { e.preventDefault(); hi = Math.max(0, hi - 1); input.value = history[hi] || ''; }
      else if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.min(history.length, hi + 1); input.value = history[hi] || ''; }
      else if (e.key === 'Tab') {
        e.preventDefault();
        const m = Object.keys(cmds).filter((k) => k.startsWith(input.value));
        if (m.length === 1) input.value = m[0] + ' ';
        else if (m.length > 1) print(m.join('  '));
      }
    });
    body.addEventListener('click', () => input.focus());
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    $('#termClose').addEventListener('click', () => dlg.close());

    // drag by title bar
    const bar = $('.term__bar', dlg); let dx = 0, dy = 0, sx, sy, dragging = false;
    bar.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; dragging = true; sx = e.clientX - dx; sy = e.clientY - dy; bar.setPointerCapture(e.pointerId); });
    bar.addEventListener('pointermove', (e) => { if (!dragging) return; dx = e.clientX - sx; dy = e.clientY - sy; dlg.style.transform = `translate(${dx}px, ${dy}px)`; });
    bar.addEventListener('pointerup', () => { dragging = false; });

    let greeted = false;
    function show() {
      if (dlg.open) return;
      dlg.showModal();
      if (!greeted) { greeted = true; print(`<span class="muted">rayaan.os 2026 · type</span> <span class="accent">help</span> <span class="muted">to get started.</span>`); }
      input.focus();
    }
    $('#termBtn').addEventListener('click', show);
    return show;
  }

  /* ------------------------------------------------------------------
     Keyboard shortcuts
     ------------------------------------------------------------------ */
  function shortcuts(showPalette, showTerm) {
    addEventListener('keydown', (e) => {
      const typing = e.target.closest('input, textarea, [contenteditable]');
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); showPalette(); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('dialog[open]')) return;
      if (e.key === '`' || e.key === '~') { e.preventDefault(); showTerm(); }
      else if (e.key === '/') { e.preventDefault(); showPalette(); }
      else if (e.key.toLowerCase() === 't') toggleTheme();
    });
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    if (touch) {
      root.classList.add('touch');
      $('#paletteBtn span').textContent = 'Menu';
      $('#heroHint').textContent = 'tap anywhere to fire a signal through the network ✦';
      $('#footHint').innerHTML = 'Tap <kbd>&gt;_</kbd> for a terminal';
    } else if (!isMac) $('#paletteBtn span').textContent = 'Ctrl K';
  }

  /* ------------------------------------------------------------------
     Init
     ------------------------------------------------------------------ */
  $('#year').textContent = new Date().getFullYear();
  clock();
  facts();
  $('#themeBtn').addEventListener('click', toggleTheme);
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => { if (!store.get('rq-theme')) setTheme(e.matches ? 'light' : 'dark'); });

  const lede = $('.hero__lede');
  if (!reduced) splitWords(lede, 'w', 0.035);

  boot().then(() => {
    root.classList.add('is-ready');
    $$('.scramble').forEach((el, i) => setTimeout(() => scramble(el, 1000), 150 + i * 120));
    roles();
  });

  allScenes.push(mountScene($('#neural'), neuralScene));
  $$('canvas[data-viz]').forEach((c) => allScenes.push(mountScene(c, vizzes[c.dataset.viz])));

  scrollEffects();
  reveals();
  pointer();
  archive();
  emailButton();
  resume();
  konami();
  const openCase = caseStudies();
  const showTerm = terminal(openCase);
  const showPalette = commandPalette(openCase, showTerm);
  shortcuts(showPalette, showTerm);

  console.log('%c✦ Hey, curious one.', 'font: 600 16px sans-serif; color: #d4ff3a; background: #0b0b0c; padding: 6px 10px; border-radius: 6px');
  console.log('Press ` for a terminal, or ⌘K for the command menu. Hiring? → ' + EMAIL);
})();
