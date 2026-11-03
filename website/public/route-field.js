// The hero's route: one cobalt rail from the URL tshare printed on the agent's machine to
// the screen where you read the report, and a packet carrying the report's own heading
// along it. 30 fps, paused off screen; under reduced motion the packet rests, whole, at
// the end of the rail. Without script the hero keeps its dot grid and every word.
(() => {
  const hero = document.querySelector('.stage-hero');
  const canvas = hero && hero.querySelector('.route-field');
  if (!hero || !canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const token = name => getComputedStyle(hero).getPropertyValue(name).trim();
  const TRAVEL = 3200, REST = 1600;
  let source = '<h1>Checkout copy fixes</h1>';
  let rail = [], runs = [], railLen = 0, stacked = false, plane = null, colors = {}, w = 0, h = 0, visible = true, last = 0, frame = 0;

  const box = el => { const r = el.getBoundingClientRect(), s = hero.getBoundingClientRect(); return { l: r.left - s.left, t: r.top - s.top, r: r.right - s.left, b: r.bottom - s.top }; };
  const shown = el => el && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none';

  // Beside the copy: out of the printed URL, a short run right, then down into the
  // laptop screen below the terminal. Stacked on phones: straight down into the phone.
  function railPoints(term, out, target) {
    if (!stacked) {
      const y = (out.t + out.b) / 2, x = term.r + 32;
      return [[term.r + 6, y], [x, y], [x, target.t - 12]];
    }
    const x = target.l + 24;
    return [[x, term.b + 6], [x, target.t - 10]];
  }
  function pointAt(at) {
    for (const r of runs) if (at <= r.end) { const t = (at - r.start) / r.len; return [r.a[0] + t * (r.b[0] - r.a[0]), r.a[1] + t * (r.b[1] - r.a[1])]; }
    return rail[rail.length - 1];
  }

  function layout() {
    const r = hero.getBoundingClientRect();
    w = r.width; h = r.height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    colors = { paper: token('--color-paper'), wash: token('--color-accent-wash'), rail: token('--color-accent'), deep: token('--color-accent-deep') };

    const screen = hero.querySelector('.stage-screen');
    stacked = !shown(screen);
    const term = box(hero.querySelector('.terminal'));
    const out = box(hero.querySelector('.terminal samp'));
    const target = box(stacked ? hero.querySelector('.stage-phone') : screen);
    const stage = box(hero.querySelector('.route-stage'));

    rail = railPoints(term, out, target);
    // Beside the copy, a cobalt wash holds the terminal, the route and both screens as one
    // object, bleeding to the hero's edge.
    const phone = box(hero.querySelector('.stage-phone'));
    plane = stacked ? null : { l: stage.l - 28, t: stage.t - 28, r: w, b: Math.min(h, Math.max(stage.b, phone.b) + 28) };
    runs = []; railLen = 0;
    for (let i = 1; i < rail.length; i++) {
      const len = Math.hypot(rail[i][0] - rail[i - 1][0], rail[i][1] - rail[i - 1][1]);
      runs.push({ a: rail[i - 1], b: rail[i], len, start: railLen, end: railLen + len });
      railLen += len;
    }
  }

  // Travelling, the packet is centred on the rail; at rest it sits beside the rail's last
  // run, just above the screen it reached.
  function packet(x, y, resting) {
    ctx.font = `500 13px ${token('--font-outlier')}`;
    const pw = ctx.measureText(source).width + 24, ph = 28;
    const end = rail[rail.length - 1];
    const px = Math.min(w - pw - 8, resting ? end[0] + 14 : x - pw / 2);
    const cy = resting ? end[1] - ph / 2 - 4 : y;
    ctx.fillStyle = colors.paper; ctx.strokeStyle = colors.rail; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(px, cy - ph / 2, pw, ph, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = colors.deep; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText(source, px + 12, cy + 1);
  }

  function draw(time) {
    ctx.fillStyle = colors.paper;
    ctx.fillRect(0, 0, w, h);
    if (plane) {
      const { l, t, r, b } = plane, c = 16;
      ctx.fillStyle = colors.wash;
      ctx.beginPath(); ctx.moveTo(l + c, t); ctx.lineTo(r, t); ctx.lineTo(r, b - c); ctx.lineTo(r - c, b); ctx.lineTo(l, b); ctx.lineTo(l, t + c); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = colors.rail; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath(); rail.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    const end = rail[rail.length - 1];
    ctx.fillStyle = colors.rail;
    ctx.beginPath(); ctx.arc(end[0], end[1], 5, 0, Math.PI * 2); ctx.fill();

    // On phones the rail is too short to carry the packet.
    if (!stacked) {
      const p = still.matches ? 1 : Math.min(1, (time % (TRAVEL + REST)) / TRAVEL);
      const at = railLen * (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
      packet(...pointAt(at), p === 1);
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
