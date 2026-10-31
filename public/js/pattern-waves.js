(() => {
  const canvas = document.getElementById('pattern-waves-background');
  if (!canvas) return;

  const context = canvas.getContext('2d', { alpha: false });
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const cursor = { x: -1000, y: -1000, active: false };
  const settings = {
    spacing: 9,
    speed: 0.35,
    direction: 20 * Math.PI / 180,
    cursorSize: 50,
    cursorStrength: 0.6,
    fadeSize: 0.5,
    background: '#120f17'
  };

  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let frame = 0;
  let lastFrameAt = 0;
  let elapsed = 0;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    draw(elapsed);
  }

  function draw(time) {
    context.fillStyle = settings.background;
    context.fillRect(0, 0, width, height);

    const cosine = Math.cos(settings.direction);
    const sine = Math.sin(settings.direction);
    const edgeRange = Math.max(1, Math.min(width, height) * settings.fadeSize);
    const timeOffset = time * settings.speed;
    const introOpacity = Math.min(1, time / 1.4);
    const cursorRadius = settings.cursorSize * 2;

    for (let y = settings.spacing / 2; y < height; y += settings.spacing) {
      const edgeY = Math.min(y, height - y);
      for (let x = settings.spacing / 2; x < width; x += settings.spacing) {
        const edge = Math.min(1, x / edgeRange, (width - x) / edgeRange, edgeY / edgeRange);
        const rotatedX = x * cosine + y * sine;
        const rotatedY = -x * sine + y * cosine;
        const silk = Math.sin(rotatedX * 0.018 + Math.sin(rotatedY * 0.012) * 1.6 - timeOffset);
        const crossWave = Math.cos(rotatedY * 0.02 + timeOffset * 0.65);
        const dx = x - cursor.x;
        const dy = y - cursor.y;
        const cursorDistance = Math.sqrt(dx * dx + dy * dy);
        const cursorWave = cursor.active && cursorDistance < cursorRadius
          ? Math.sin((cursorRadius - cursorDistance) * 0.14 - timeOffset * 1.8)
            * (1 - cursorDistance / cursorRadius) * settings.cursorStrength
          : 0;
        const ridge = (silk * 0.62 + crossWave * 0.25 + cursorWave * 0.8 + 0.15);
        const alpha = Math.max(0, Math.min(0.52, (0.1 + ridge * 0.16) * edge * introOpacity));
        if (alpha < 0.025) continue;

        const radius = 0.55 + Math.max(0, ridge) * 0.65;
        context.globalAlpha = alpha;
        context.fillStyle = '#ffffff';
        context.beginPath();
        context.arc(x, y + silk * 1.5 + cursorWave * 2, radius, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.globalAlpha = 1;
  }

  function animate(timestamp) {
    if (document.hidden) {
      frame = 0;
      return;
    }
    if (timestamp - lastFrameAt >= 33) {
      elapsed += Math.min((timestamp - (lastFrameAt || timestamp)) / 1000, 0.05);
      lastFrameAt = timestamp;
      draw(elapsed);
    }
    frame = window.requestAnimationFrame(animate);
  }

  function start() {
    if (!frame && !reducedMotion.matches && !document.hidden) {
      frame = window.requestAnimationFrame(animate);
    }
  }

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pointermove', event => {
    cursor.x = event.clientX;
    cursor.y = event.clientY;
    cursor.active = true;
  }, { passive: true });
  window.addEventListener('pointerleave', () => { cursor.active = false; });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
    } else {
      start();
    }
  });
  reducedMotion.addEventListener?.('change', () => {
    if (reducedMotion.matches && frame) {
      window.cancelAnimationFrame(frame);
      frame = 0;
      draw(elapsed);
    } else {
      start();
    }
  });

  resize();
  start();
})();
