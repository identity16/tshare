// Cobalt field for the hero: the sample file's own source rides one cobalt rail from the
// command on this computer to the phone, over a field of characters on an 8 x 16 cell.
// 30 fps, paused off screen, one still frame under reduced motion. Without script the hero
// keeps its dot grid and every word stays in the page.
(() => {
  const hero = document.querySelector('.stage-hero');
  const canvas = hero && hero.querySelector('.route-field');
  if (!hero || !canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const CW = 8, CH = 16, RAMP = ' .:-=+*';
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const token = name => getComputedStyle(hero).getPropertyValue(name).trim();
  let source = '<h1>A place for<br>unfinished ideas.</h1>';
  let field = [], rail = [], railLen = 0, colors = {}, w = 0, h = 0, visible = true, last = 0, frame = 0;

  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const box = el => { const r = el.getBoundingClientRect(), s = hero.getBoundingClientRect(); return { l: r.left - s.left, t: r.top - s.top, r: r.right - s.left, b: r.bottom - s.top }; };

  // Beside: out of the printed URL, up or down to the height of the phone's rendered
  // heading, then into the phone. Stacked: straight down into the phone's top edge.
  function railPoints(term, out, phone, headY) {
    if (phone.l > term.r + 80) {
      const y1 = (out.t + out.b) / 2, x = term.r + 40;
      return [[term.r + 6, y1], [x, y1], [x, headY], [phone.l - 14, headY]];
    }
    const x = phone.l + 24;
    return [[x, term.b + 6], [x, phone.t - 10]];
  }
  function layout() {
    const r = hero.getBoundingClientRect();
    w = r.width; h = r.height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    colors = { paper: token('--color-paper'), g1: token('--color-glyph-1'), g2: token('--color-glyph-2'), g3: token('--color-glyph-3'), g4: token('--color-glyph-4'), rail: token('--color-accent'), deep: token('--color-accent-deep') };

    const term = box(hero.querySelector('.terminal'));
    const out = box(hero.querySelector('.terminal samp'));
    const shot = hero.querySelector('.stage-phone');
    const phone = box(shot);
    const inset = parseFloat(getComputedStyle(shot).borderTopWidth) || 0;
    const scale = (phone.r - phone.l - 2 * inset) / (Number(shot.dataset.captureWidth) || 320);
    const headY = phone.t + inset + (Number(shot.dataset.headingY) || 124) * scale;
    const stage = box(hero.querySelector('.route-stage'));
    const quiet = [...hero.querySelectorAll('h1, .lead, .stage-actions, .terminal, .stage-route, .stage-sample, .cloud-invitation')].map(box);
    quiet.push(phone);

    rail = railPoints(term, out, phone, headY);
    hero.style.setProperty('--rail-y', `${Math.round(rail[rail.length - 1][1] - stage.t)}px`);
    hero.style.setProperty('--rail-x', `${Math.round(Math.min(0, rail[1][0] - stage.l))}px`);
    railLen = rail.slice(1).reduce((n, p, i) => n + Math.hypot(p[0] - rail[i][0], p[1] - rail[i][1]), 0);
    const toRail = (x, y) => {
      let best = Infinity, along = 0, run = 0;
      for (let i = 1; i < rail.length; i++) {
        const [ax, ay] = rail[i - 1], [bx, by] = rail[i], len = Math.hypot(bx - ax, by - ay);
        const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / (len * len)));
        const d = Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay)));
        if (d < best) { best = d; along = (run + t * len) / railLen; }
        run += len;
      }
      return [best, along];
    };

    field = [];
    const cols = Math.ceil(w / CW), rows = Math.ceil(h / CH);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const cx = x * CW + CW / 2, cy = y * CH + CH / 2;
      if (quiet.some(q => cx > q.l - 10 && cx < q.r + 10 && cy > q.t - 8 && cy < q.b + 8)) continue;
      const [d, along] = toRail(cx, cy);
      if (d < 22 || d > 64) continue;
      // A quiet echo of the traffic along the rail, strongest just before the phone.
      const pull = (1 - d / 64) * (0.4 + along * 0.6);
      const n = noise(x / 7, y / 3) * 0.75 + noise(x / 2.5, y / 1.5) * 0.25;
      const level = Math.floor(Math.max(0, n * pull * 1.2 - 0.25) * 3 * 1.6);
      if (level > 0) field.push({ cx, cy, ch: RAMP[Math.min(level, RAMP.length - 1)], tone: level > 2 ? colors.g3 : level > 1 ? colors.g2 : colors.g1 });
    }
  }

  function draw(time) {
    ctx.fillStyle = colors.paper;
    ctx.fillRect(0, 0, w, h);
    ctx.font = `400 12px ${token('--font-outlier')}`;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    for (const c of field) { ctx.fillStyle = c.tone; ctx.fillText(c.ch, c.cx, c.cy); }

    // The rail, then the file's own source riding it toward the phone.
    ctx.strokeStyle = colors.rail; ctx.lineWidth = 1.5;
    ctx.beginPath(); rail.forEach(([x, y], i) => (i ? ctx.lineTo(x, y + 12) : ctx.moveTo(x, y + 12))); ctx.stroke();
    const end = rail[rail.length - 1];
    ctx.fillStyle = colors.rail; ctx.fillRect(end[0] - 3, end[1] + 9, 7, 7);
    // The heading's own source rides the last run into the phone, whole tokens fading in and out at the ends.
    const [ax, ay] = rail[rail.length - 2], [bx, by] = rail[rail.length - 1];
    if (ay === by && bx - ax > CW * 8) {
      ctx.font = `500 14px ${token('--font-outlier')}`;
      const text = `${source}   `, L = text.length, run = bx - ax - 8;
      const shift = still.matches ? 0 : (time / 1000) * 18;
      const fade = 40;
      for (let i = -1; i * CW < run + CW; i++) {
        const x = ax + 4 + i * CW + (shift % CW);
        if (x < ax + 2 || x > bx - 6) continue;
        const edge = Math.min(x - ax, bx - x);
        ctx.globalAlpha = Math.min(1, edge / fade);
        ctx.fillStyle = colors.deep;
        ctx.fillText(text[(((i - Math.floor(shift / CW)) % L) + L) % L], x, ay);
      }
      ctx.globalAlpha = 1;
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
