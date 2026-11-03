// The relay's rails, measured from the page: lit cobalt lines from the agent's message to
// the screen you read on and on to a teammate on your tailnet, and a dashed line through
// the Cloud gate to someone outside it. A small light travels each at 30 fps, paused off
// screen; reduced motion keeps the lines and drops the lights.
// Stacked on phones the numbered steps carry the order without rails, as without script.
(() => {
  const hero = document.querySelector('.relay-hero');
  const canvas = hero && hero.querySelector('.route-field');
  if (!hero || !canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const token = name => getComputedStyle(hero).getPropertyValue(name).trim();
  const CYCLE = 3200;
  let rails = [], colors = {}, w = 0, h = 0, visible = true, last = 0, frame = 0;

  const box = el => { const r = el.getBoundingClientRect(), s = hero.getBoundingClientRect(); return { l: r.left - s.left, t: r.top - s.top, r: r.right - s.left, b: r.bottom - s.top }; };
  const shown = el => el && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none';
  const length = pts => pts.slice(1).reduce((n, p, i) => n + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
  function pointAt(pts, at) {
    let run = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], len = Math.hypot(bx - ax, by - ay);
      if (at <= run + len) { const t = (at - run) / len; return [ax + t * (bx - ax), ay + t * (by - ay)]; }
      run += len;
    }
    return pts[pts.length - 1];
  }
  // Leave the source's right edge at its height, step at the gap's middle, enter the
  // target's left edge. Stacked steps (phones) read in order without rails.
  function link(from, to, y) {
    const x0 = from.r + 8, x1 = to.l - 10, ty = Math.max(to.t + 24, Math.min(to.b - 24, y)), mx = (x0 + x1) / 2;
    return ty === y ? [[x0, y], [x1, y]] : [[x0, y], [mx, y], [mx, ty], [x1, ty]];
  }

  function layout() {
    const r = hero.getBoundingClientRect();
    w = r.width; h = r.height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    colors = { lit: token('--color-accent-2'), planned: token('--color-graphite-glyph-3') };

    const msg = box(hero.querySelector('.agent-msg'));
    const screen = hero.querySelector('.stage-screen');
    const you = box(shown(screen) ? screen : hero.querySelector('.stage-phone'));
    const youAll = box(hero.querySelector('.you-screens'));
    const team = box(hero.querySelector('.team-screen'));
    const guest = box(hero.querySelector('.guest-screen'));
    const gate = box(hero.querySelector('.cloud-gate'));
    const beside = (a, b) => b.l > a.r + 24;
    rails = [
      { pts: link(msg, you, msg.t + 56), dashed: false, on: beside(msg, you) },
      { pts: link(youAll, team, (team.t + team.b) / 2), dashed: false, on: beside(youAll, team) },
      { pts: link(team, guest, (gate.t + gate.b) / 2), dashed: true, on: beside(team, guest) },
    ].filter(rl => rl.on).map(rl => ({ ...rl, len: length(rl.pts) }));
  }

  function draw(time) {
    ctx.clearRect(0, 0, w, h);
    for (const [i, rl] of rails.entries()) {
      ctx.strokeStyle = rl.dashed ? colors.planned : colors.lit;
      ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
      ctx.setLineDash(rl.dashed ? [6, 6] : []);
      ctx.beginPath(); rl.pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      ctx.setLineDash([]);
      const end = rl.pts[rl.pts.length - 1];
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath(); ctx.arc(end[0], end[1], 3.5, 0, Math.PI * 2); ctx.fill();
      if (still.matches) continue;
      const p = ((time + i * CYCLE / 2) % CYCLE) / CYCLE;
      const [x, y] = pointAt(rl.pts, rl.len * p);
      ctx.globalAlpha = Math.sin(Math.PI * p);
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
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
  document.fonts.ready.then(start);
})();
