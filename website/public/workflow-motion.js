// Decorative packets illustrate planned workflows; no content, auth, or agent actions run.
(() => {
  const planes = [...document.querySelectorAll('[data-motion]')];
  if (!planes.length) return;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  function points(plane, source, target) {
    const root = plane.getBoundingClientRect();
    const a = source.getBoundingClientRect(), b = target.getBoundingClientRect();
    if (plane.dataset.axis === 'vertical') {
      const start = [(a.left + a.right) / 2 - root.left, a.bottom - root.top];
      const end = [(b.left + b.right) / 2 - root.left, b.top - root.top];
      const mid = (start[1] + end[1]) / 2;
      return [start, [start[0], mid], [end[0], mid], end];
    }
    const start = [a.right - root.left, (a.top + a.bottom) / 2 - root.top];
    const end = [b.left - root.left, (b.top + b.bottom) / 2 - root.top];
    const mid = (start[0] + end[0]) / 2;
    return [start, [mid, start[1]], [mid, end[1]], end];
  }
  const names = ['start', 'mid1', 'mid2', 'end'];
  function layout(plane) {
    const source = plane.querySelector('[data-route-source]');
    const target = plane.querySelector('[data-route-target]');
    const svg = plane.querySelector('.motion-route');
    if (!source || !target || !svg || !plane.clientWidth) return;
    svg.setAttribute('viewBox', `0 0 ${plane.clientWidth} ${plane.clientHeight}`);
    const route = points(plane, source, target);
    const path = route.map(([x,y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
    svg.querySelector('.flow-path').setAttribute('d', path);
    const alt = plane.querySelector('[data-route-alt]');
    if (alt) svg.querySelector('.branch-path').setAttribute('d', points(plane, source, alt).map(([x,y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' '));
    route.forEach(([x,y], i) => { plane.style.setProperty(`--route-${names[i]}-x`, `${x}px`); plane.style.setProperty(`--route-${names[i]}-y`, `${y}px`); });
    plane.classList.add('has-route');
  }
  const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    for (const entry of entries) {
      const plane = entry.target;
      if (entry.isIntersecting) {
        layout(plane);
        if (!preference.matches && !plane.dataset.played) {
          plane.dataset.played = 'true';
          plane.classList.add('is-playing');
        }
        plane.classList.remove('is-offscreen');
      } else plane.classList.add('is-offscreen');
    }
  }, {threshold: .4}) : null;
  for (const plane of planes) {
    layout(plane);
    observer?.observe(plane);
    plane.addEventListener('animationend', event => {
      if (event.animationName !== 'carry-context') return;
      plane.classList.remove('is-playing');
      observer?.unobserve(plane);
    });
  }
  if (typeof ResizeObserver === 'function') {
    const resize = new ResizeObserver(entries => entries.forEach(entry => layout(entry.target)));
    planes.forEach(plane => resize.observe(plane));
  }
  document.fonts?.ready.then(() => planes.forEach(layout));
  preference.addEventListener('change', () => {
    if (preference.matches) planes.forEach(plane => plane.classList.remove('is-playing'));
  });
})();
