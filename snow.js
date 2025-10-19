const canvas = document.getElementById('snow');
const ctx = canvas.getContext('2d');

let flakeCount = 600;
const WIND_MIN_CHANGE_MS = 5000;
const WIND_MAX_CHANGE_MS = 10000;
const WIND_SMOOTH = 0.02;
const WIND_INFLUENCE_SMALL = 0.01;
const WIND_INFLUENCE_LARGE = WIND_INFLUENCE_SMALL / 3;

const VORTEX_MIN_RADIUS = 200;
const VORTEX_MAX_RADIUS = 500;
const VORTEX_MIN_STRENGTH = 0.25;
const VORTEX_MAX_STRENGTH = 1.0;
const VORTEX_MIN_DURATION = 3000;
const VORTEX_MAX_DURATION = 8000;
const VORTEX_SPAWN_MIN_MS = 4000;
const VORTEX_SPAWN_MAX_MS = 12000;
const VORTEX_VX_SCALE = 0.02;
const VORTEX_VY_SCALE = 0.02;

let devicePixelRatio = window.devicePixelRatio || 1;

const elFlakes = document.getElementById('slider-flakes');
const elVert = document.getElementById('slider-vert');
const elWind = document.getElementById('slider-wind');
const elDayNight = document.getElementById('toggle-daynight');

const valFlakes = document.getElementById('val-flakes');
const valVert = document.getElementById('val-vert');
const valWind = document.getElementById('val-wind');

let isDay = false;

function resize() {
  devicePixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * devicePixelRatio);
  canvas.height = Math.floor(window.innerHeight * devicePixelRatio);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
resize();
window.addEventListener('resize', resize);

function createSnowFlake(yStart = -10) {
  return {
    x: Math.random() * window.innerWidth,
    y: typeof yStart === 'number' ? yStart : Math.random() * window.innerHeight,
    r: Math.random() * 3 + 1,
    s: Math.random() * 4 + 1,
    vx: 0
  };
}

let flakes = [];

let verticalMult = 1.0;
let windMult = 1.0;

function initFlakes(count) {
  flakeCount = Math.max(1, Math.floor(count));
  if (!flakes || flakes.length === 0) {
    flakes = Array.from({ length: flakeCount }, () => createSnowFlake(Math.random() * window.innerHeight));
    return;
  }
  const diff = flakeCount - flakes.length;
  if (diff > 0) {
    for (let i = 0; i < diff; i++) flakes.push(createSnowFlake(-Math.random() * 100));
  } else if (diff < 0) {
    flakes.length = flakeCount;
  }
}

if (elFlakes) {
  initFlakes(parseInt(elFlakes.value, 10) || flakeCount);
  valFlakes.textContent = elFlakes.value;
} else {
  initFlakes(flakeCount);
}
if (elVert) {
  verticalMult = parseFloat(elVert.value) || 1.0;
  valVert.textContent = parseFloat(verticalMult).toFixed(1);
}
if (elWind) {
  windMult = parseFloat(elWind.value) || 1.0;
  valWind.textContent = parseFloat(windMult).toFixed(1);
}

let windSpeed = 0;
let baseTargetWind = 0;
let targetWind = 0;

function scheduleWindChange() {
  baseTargetWind = (Math.random() * 2 - 1) * 5;
  targetWind = baseTargetWind * windMult;
  const interval = WIND_MIN_CHANGE_MS + Math.random() * (WIND_MAX_CHANGE_MS - WIND_MIN_CHANGE_MS);
  setTimeout(scheduleWindChange, interval);
}
scheduleWindChange();

const vortices = [];

function createVortex() {
  const radius = VORTEX_MIN_RADIUS + Math.random() * (VORTEX_MAX_RADIUS - VORTEX_MIN_RADIUS);
  const strength = VORTEX_MIN_STRENGTH + Math.random() * (VORTEX_MAX_STRENGTH - VORTEX_MIN_STRENGTH);
  const duration = VORTEX_MIN_DURATION + Math.random() * (VORTEX_MAX_DURATION - VORTEX_MIN_DURATION);
  const dir = Math.random() < 0.5 ? -1 : 1;
  const x = Math.random() * window.innerWidth;
  const y = Math.random() * (window.innerHeight * 0.6);
  const now = Date.now();
  vortices.push({ x, y, radius, strength, dir, start: now, end: now + duration });
}

function spawnVortexLoop() {
  if (Math.random() < 0.5) createVortex();
  const next = VORTEX_SPAWN_MIN_MS + Math.random() * (VORTEX_SPAWN_MAX_MS - VORTEX_SPAWN_MIN_MS);
  setTimeout(spawnVortexLoop, next);
}
spawnVortexLoop();

function draw() {
  ctx.clearRect(0, 0, canvas.width / devicePixelRatio, canvas.height / devicePixelRatio);

  windSpeed += (targetWind - windSpeed) * WIND_SMOOTH;

  const now = Date.now();
  for (let i = vortices.length - 1; i >= 0; i--) {
    if (vortices[i].end < now) vortices.splice(i, 1);
  }

  flakes.forEach((f) => {
    let baseColor;
    if (f.s < 1.5) baseColor = '#797979';
    else if (f.s < 3) baseColor = '#aaaaaa';
    else baseColor = '#ffffff';

    const color = (typeof lerpColor === 'function' && isDay)
      ? lerpColor(baseColor, '#ffffff', 0.65)
      : baseColor;

    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    f.y += f.s * verticalMult;

    if (vortices.length) {
      let accX = 0;
      let accY = 0;
      for (const v of vortices) {
        const dx = f.x - v.x;
        const dy = f.y - v.y;
        const dist = Math.hypot(dx, dy) + 0.0001;
        if (dist < v.radius) {
          const n = 1 - dist / v.radius;
          const tangential = v.dir * v.strength * n;
          accX += (-dy / dist) * tangential;
          accY += (dx / dist) * tangential;
          accY += 0.25 * v.strength * n;
        }
      }
      f.vx += accX * VORTEX_VX_SCALE;
      f.y += accY * VORTEX_VY_SCALE;
    }

    const influence = f.s < 3 ? WIND_INFLUENCE_SMALL : WIND_INFLUENCE_LARGE;
    f.vx += (windSpeed - f.vx) * influence;
    f.x += f.vx;

    if (f.y > window.innerHeight + 10) {
      const nf = createSnowFlake(-10 - Math.random() * 30);
      f.x = nf.x;
      f.y = nf.y;
      f.r = nf.r;
      f.s = nf.s;
      f.vx = nf.vx;
    }

    if (f.x > window.innerWidth + 10) f.x = -10;
    if (f.x < -10) f.x = window.innerWidth + 10;
  });

  requestAnimationFrame(draw);
}

draw();

function updateRangeVisual(el) {
  if (!el) return;
  const min = parseFloat(el.min) || 0;
  const max = parseFloat(el.max) || 100;
  const val = parseFloat(el.value);
  const pct = ((val - min) / (max - min)) * 100;
  el.style.setProperty('--percent', pct + '%');
}

updateRangeVisual(elFlakes);
updateRangeVisual(elVert);
updateRangeVisual(elWind);

if (elFlakes) {
  elFlakes.addEventListener('input', (e) => {
    const v = parseInt(e.target.value, 10) || 600;
    valFlakes.textContent = v;
    initFlakes(v);
    updateRangeVisual(elFlakes);
  });
}
if (elVert) {
  elVert.addEventListener('input', (e) => {
    verticalMult = parseFloat(e.target.value) || 1.0;
    valVert.textContent = verticalMult.toFixed(1);
    updateRangeVisual(elVert);
  });
}
if (elWind) {
  elWind.addEventListener('input', (e) => {
    windMult = parseFloat(e.target.value) || 1.0;
    valWind.textContent = windMult.toFixed(1);
    targetWind = baseTargetWind * windMult;
    updateRangeVisual(elWind);
  });
}

const DAY_SKY = { top: '#9fb3c8', bottom: '#cfd8e3' };
const NIGHT_SKY = { top: '#000015', bottom: '#1e162b' };

function applySkyColors(colors) {
  document.body.style.background = `linear-gradient(to top, ${colors.bottom}, ${colors.top})`;
}

if (elDayNight) {
  isDay = !!elDayNight.checked;
  applySkyColors(isDay ? DAY_SKY : NIGHT_SKY);

  elDayNight.addEventListener('change', (e) => {
    isDay = e.target.checked;
    applySkyColors(isDay ? DAY_SKY : NIGHT_SKY);
  });
} else {
  isDay = false;
  applySkyColors(NIGHT_SKY);
}

function hexToRgb(hex) {
  const h = hex.replace('#','');
  const bigint = parseInt(h, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}
function rgbToHex(r,g,b){
  return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
}
function lerp(a, b, t) { return a + (b - a) * t; }
function lerpColor(c1, c2, t){
  const a = hexToRgb(c1), b = hexToRgb(c2);
  return rgbToHex(Math.round(lerp(a[0], b[0], t)),
                   Math.round(lerp(a[1], b[1], t)),
                   Math.round(lerp(a[2], b[2], t)));
}
