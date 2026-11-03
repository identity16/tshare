// The hero's route on the dark band: one glowing cobalt rail from the URL tshare printed
// on the agent's machine down into the laptop where you read the report, with a packet
// carrying the report's own heading. A grid fades out from the scene and a single cobalt
// light sits behind the laptop. 30 fps, paused off screen; under reduced motion the packet
// rests at the end of the rail. Without script the band keeps a CSS grid and every word.
(() => {
  const hero = document.querySelector('.stage-hero');
  const canvas = hero && hero.querySelector('.route-field');
  if (!hero || !canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const token = name => getComputedStyle(hero).getPropertyValue(name).trim();
  const TRAVEL = 2600, REST = 2000, GRID = 56;
  let source = '<h1>Checkout copy fixes</h1>';
  let rail = [], stacked = false, glow = null, colors = {}, w = 0, h = 0, visible = true, last = 0, frame = 0;

  const box = el => { const r = el.getBoundingClientRect(), s = hero.getBoundingClientRect(); return { l: r.left - s.left, t: r.top - s.top, r: r.right - s.left, b: r.bottom - s.top }; };
  const shown = el => el && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none';
  // Tokens are oklch; gradients need alpha, so read each token back as rgb once.
  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const rgba = (name, a) => { probe.clearRect(0, 0, 1, 1); probe.fillStyle = token(name); probe.fillRect(0, 0, 1, 1); const [r, g, b] = probe.getImageData(0, 0, 1, 1).data; return `rgba(${r},${g},${b},${a})`; };

  // Beside the copy: out of the printed URL, a short run right, then down into the laptop.
  // Stacked on phones: straight down into the phone.
  function railPoints(term, out, target) {
    if (!stacked) {
      const y = (out.t + out.b) / 2, x = term.r + 32;
      return [[term.r + 6, y], [x, y], [x, target.t - 14]];
    }
    const x = target.l + 24;
    return [[x, term.b + 6], [x, target.t - 10]];
  }

  function layout() {
    const r = hero.getBoundingClientRect();
    w = r.width; h = r.height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    colors = { bg: token('--color-graphite'), line: token('--color-graphite-glyph-1'), rail: token('--color-accent-2'), panel: token('--color-graphite-2'), light: rgba('--color-accent', 0.55), clear: rgba('--color-accent', 0), fadeIn: rgba('--color-graphite', 0), fadeOut: rgba('--color-graphite', 1) };

    const screen = hero.querySelector('.stage-screen');
    stacked = !shown(screen);
    const term = box(hero.querySelector('.terminal'));
    const out = box(hero.querySelector('.terminal samp'));
    const target = box(stacked ? hero.querySelector('.stage-phone') : screen);
    rail = railPoints(term, out, target);
    glow = { x: (target.l + target.r) / 2, y: (target.t + target.b) / 2, r: Math.max(target.r - target.l, 240) * 0.75 };
  }

  function packet(x, y) {
    ctx.font = `500 13px ${token('--font-outlier')}`;
    const pw = ctx.measureText(source).width + 24, ph = 28;
    const px = Math.min(w - pw - 8, x + 16);
    ctx.shadowBlur = 0;
    ctx.fillStyle = colors.panel; ctx.strokeStyle = colors.rail; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(px, y - ph / 2, pw, ph, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = colors.rail; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText(source, px + 12, y + 1);
  }

  function draw(time) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = colors.bg; ctx.fillRect(0, 0, w, h);

    // One cobalt light behind the screen you read on.
    const light = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, glow.r);
    light.addColorStop(0, colors.light); light.addColorStop(1, colors.clear);
    ctx.fillStyle = light; ctx.fillRect(0, 0, w, h);

    // A grid that fades out away from the scene.
    ctx.strokeStyle = colors.line; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0.5; x < w; x += GRID) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = 0.5; y < h; y += GRID) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
    const fade = ctx.createRadialGradient(glow.x, glow.y, glow.r * 0.4, glow.x, glow.y, Math.max(w, h) * 0.8);
    fade.addColorStop(0, colors.fadeIn); fade.addColorStop(1, colors.fadeOut);
    ctx.fillStyle = fade; ctx.fillRect(0, 0, w, h);

    // The rail, lit.
    ctx.strokeStyle = colors.rail; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.shadowColor = colors.light; ctx.shadowBlur = 16;
    ctx.beginPath(); rail.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    const end = rail[rail.length - 1];
    ctx.fillStyle = colors.rail;
    ctx.beginPath(); ctx.arc(end[0], end[1], 5, 0, Math.PI * 2); ctx.fill();

    // The packet slides down the last run, beside it and clear of the caption; on phones
    // the run is too short to carry it.
    if (!stacked) {
      const [x, y0] = rail[1], y1 = end[1];
      const p = still.matches ? 1 : Math.min(1, (time % (TRAVEL + REST)) / TRAVEL);
      const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      packet(x, y0 + 30 + (y1 - y0 - 46) * eased);
    }
    canvas.classList.add('is-drawn');
  }

  function loop(time) {
    if (!visible || still.matches) return;
    if (time - last > 33) { last = time; draw(time); }
    frame = requestAnimationFrame(loop);
  }
  function start() { cancelAnimationFrame(frame); layout(); draw(performance.now()); if (!still.matches) frame = requestAnimationFrame(loop); }

  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) start(); else cancelAnimationFrame(frame); }).observe(hero);
  new ResizeObserver(() => start()).observe(hero);
  still.addEventListener('change', start);
  fetch('/examples/agent-report.html').then(r => (r.ok ? r.text() : '')).then(text => {
    const heading = (text.match(/<h1>[\s\S]*?<\/h1>/) || [])[0];
    if (heading) { source = heading.replace(/\s+/g, ' '); start(); }
  }).catch(() => {});
  document.fonts.ready.then(start);
})();
