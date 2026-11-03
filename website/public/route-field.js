// The hero's route: one cobalt rail from the URL the CLI printed on this computer to the
// phone, and a packet carrying the sample file's own heading along it. 30 fps, paused off
// screen; under reduced motion the packet rests, whole, on the last run. Without script
// the hero keeps its dot grid and every word stays in the page.
(() => {
  const hero = document.querySelector('.stage-hero');
  const canvas = hero && hero.querySelector('.route-field');
  if (!hero || !canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const token = name => getComputedStyle(hero).getPropertyValue(name).trim();
  const TRAVEL = 3600, REST = 1400;
  let source = '<h1>Onboarding, draft 3</h1>';
  let rail = [], runs = [], railLen = 0, stacked = false, phoneLeft = 0, plane = null, colors = {}, w = 0, h = 0, visible = true, last = 0, frame = 0;

  const box = el => { const r = el.getBoundingClientRect(), s = hero.getBoundingClientRect(); return { l: r.left - s.left, t: r.top - s.top, r: r.right - s.left, b: r.bottom - s.top }; };

  // Beside: out of the printed URL, up or down to the height of the phone's rendered
  // heading (rising at the route column's edge, clear of the headline), then into the
  // phone. Stacked: straight down into the phone's top edge.
  function railPoints(term, out, phone, headY, column) {
    if (phone.l > term.r + 80) {
      const y1 = (out.t + out.b) / 2, x = Math.max(term.r + 40, column + 4);
      return [[term.r + 6, y1], [x, y1], [x, headY], [phone.l - 14, headY]];
    }
    const x = phone.l + 24;
    return [[x, term.b + 6], [x, phone.t - 10]];
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

    const term = box(hero.querySelector('.terminal'));
    const out = box(hero.querySelector('.terminal samp'));
    const shot = hero.querySelector('.stage-phone');
    const phone = box(shot);
    const inset = parseFloat(getComputedStyle(shot).borderTopWidth) || 0;
    const scale = (phone.r - phone.l - 2 * inset) / (Number(shot.dataset.captureWidth) || 320);
    const headY = phone.t + inset + (Number(shot.dataset.headingY) || 87) * scale;
    const stage = box(hero.querySelector('.route-stage'));

    rail = railPoints(term, out, phone, headY, stage.l);
    phoneLeft = phone.l;
    // Beside the copy, a cobalt wash holds the route, the phone and its sample link as one
    // object, bleeding to the hero's edge.
    plane = stacked ? null : { l: rail[1][0] - 32, t: phone.t - 28, r: w, b: Math.min(h, phone.b + 56) };
    stacked = rail.length === 2;
    hero.style.setProperty('--rail-y', `${Math.round(rail[rail.length - 1][1] - stage.t)}px`);
    runs = []; railLen = 0;
    for (let i = 1; i < rail.length; i++) {
      const len = Math.hypot(rail[i][0] - rail[i - 1][0], rail[i][1] - rail[i - 1][1]);
      runs.push({ a: rail[i - 1], b: rail[i], len, start: railLen, end: railLen + len });
      railLen += len;
    }
  }

  // At rest the packet sits just above the last run, against the phone, clear of the
  // rail's corner and the caption below it.
  function packet(x, y, resting) {
    ctx.font = `500 14px ${token('--font-outlier')}`;
    const pw = ctx.measureText(source).width + 24, ph = 30;
    const px = resting ? phoneLeft - pw - 12 : Math.max(rail[0][0] + 6, Math.min(phoneLeft - pw - 12, x - pw / 2));
    if (resting) y -= ph / 2 + 10;
    const py = y - ph / 2;
    ctx.fillStyle = colors.paper; ctx.strokeStyle = colors.rail; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(px, py, pw, ph, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = colors.deep; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText(source, px + 12, y + 1);
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

    // The packet rides the whole rail beside the phone; stacked, the run is too short to carry it.
    if (!stacked) {
      const lastRun = runs[runs.length - 1];
      const p = still.matches ? 1 : Math.min(1, (time % (TRAVEL + REST)) / TRAVEL);
      const at = Math.min(railLen - 40, railLen * (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2));
      packet(...(p === 1 ? pointAt(lastRun.end) : pointAt(at)), p === 1);
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
  fetch('/examples/preview.html').then(r => (r.ok ? r.text() : '')).then(text => {
    const heading = (text.match(/<h1>[\s\S]*?<\/h1>/) || [])[0];
    if (heading) { source = heading.replace(/\s+/g, ' '); start(); }
  }).catch(() => {});
  document.fonts.ready.then(start);
})();
