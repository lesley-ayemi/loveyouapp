import { gsap } from '/vendor/gsap/index.js';
import { poems } from '/poems.js';

const $ = (id) => document.getElementById(id);
const canvas = $('stage');
const ctx = canvas.getContext('2d');
const intro = $('intro');
const magnet = $('magnet');
const loveBtn = $('loveBtn');
const reveal = $('reveal');
const loveText = $('loveText');
const nameText = $('nameText');
const subText = $('subText');
const readBtn = $('readBtn');
const replayBtn = $('replayBtn');
const tapHint = $('tapHint');
const poemSection = $('poem');
const poemCount = $('poemCount');
const poemTitle = $('poemTitle');
const poemBody = $('poemBody');
const poemDots = $('poemDots');
const nextBtn = $('nextBtn');
const finale = $('finale');
const finaleTop = $('finaleTop');
const finaleBottom = $('finaleBottom');

const HER_NAME = 'Lauretha';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const TAU = Math.PI * 2;
const rand = (min, max) => Math.random() * (max - min) + min;

let W = 0;
let H = 0;
let DPR = 1;
let phase = 'idle'; // particle shape: idle -> explode -> heart | name
let scene = 'intro'; // intro -> reveal -> poem -> finale
let phaseStart = 0;
const mouse = { x: -9999, y: -9999 };
// Tweened by GSAP: dims the particle heart while poems are being read
const fx = { alpha: 1 };

// ---------- Canvas sizing ----------
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  // Match the canvas's real on-screen size so drawing is never stretched
  W = canvas.clientWidth || window.innerWidth;
  H = canvas.clientHeight || window.innerHeight;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  buildStars();
  if (phase === 'name') assignNameTargets();
}
window.addEventListener('resize', resize);
// Mobile browser bars sliding in and out change the visible height without a window resize
window.visualViewport?.addEventListener('resize', resize);

// ---------- Heart maths ----------
// Classic parametric heart: x ∈ [-16, 16], y ∈ [-17, 12]
const heartX = (t) => 16 * Math.sin(t) ** 3;
const heartY = (t) => 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);

function heartScale() {
  return Math.min(W, H) * (W < 640 ? 0.028 : 0.024);
}

// Double "lub-dub" thump, period ~1.2s
function beat(time) {
  const p = (time % 1.2) / 1.2;
  const lub = Math.exp(-(((p - 0.05) / 0.05) ** 2));
  const dub = Math.exp(-(((p - 0.25) / 0.06) ** 2)) * 0.6;
  return 1 + 0.07 * (lub + dub);
}

function traceHeart(c, x, y, size) {
  c.beginPath();
  c.moveTo(x, y + size * 0.3);
  c.bezierCurveTo(x, y, x - size * 0.5, y, x - size * 0.5, y + size * 0.3);
  c.bezierCurveTo(x - size * 0.5, y + size * 0.6, x, y + size * 0.8, x, y + size);
  c.bezierCurveTo(x, y + size * 0.8, x + size * 0.5, y + size * 0.6, x + size * 0.5, y + size * 0.3);
  c.bezierCurveTo(x + size * 0.5, y, x, y, x, y + size * 0.3);
  c.closePath();
}

// ---------- Starfield + shooting stars ----------
let stars = [];
function buildStars() {
  const count = Math.floor((W * H) / (reducedMotion ? 9000 : 4500));
  stars = Array.from({ length: count }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: rand(0.3, 1.4),
    tw: rand(0, TAU),
    speed: rand(0.5, 2),
  }));
}

function drawStars(time) {
  for (const s of stars) {
    const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(time * s.speed + s.tw));
    ctx.fillStyle = `rgba(255, 220, 235, ${a})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, TAU);
    ctx.fill();
  }
}

const shooting = [];
function updateShootingStars() {
  const chance = scene === 'intro' ? 0.003 : 0.008;
  if (!reducedMotion && Math.random() < chance) {
    const angle = rand(0.35, 0.6);
    shooting.push({ x: rand(-W * 0.1, W * 0.7), y: rand(-20, H * 0.35), angle, speed: rand(9, 15), life: 1 });
  }
  ctx.lineCap = 'round';
  for (let i = shooting.length - 1; i >= 0; i--) {
    const s = shooting[i];
    s.x += Math.cos(s.angle) * s.speed;
    s.y += Math.sin(s.angle) * s.speed;
    s.life -= 0.012;
    if (s.life <= 0) {
      shooting.splice(i, 1);
      continue;
    }
    ctx.strokeStyle = `rgba(255, 240, 220, ${s.life})`;
    ctx.lineWidth = 1.6 * s.life;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x - Math.cos(s.angle) * 14, s.y - Math.sin(s.angle) * 14);
    ctx.stroke();
  }
}

// ---------- Floating background hearts ----------
const floaters = [];
function spawnFloater(fromY = H + 20) {
  floaters.push({
    x: Math.random() * W,
    y: fromY,
    size: rand(8, 22),
    speed: rand(0.3, 1.1),
    sway: rand(0, TAU),
    hue: rand(330, 360),
    alpha: rand(0.15, 0.45),
  });
}

function updateFloaters(time) {
  const max = scene === 'intro' ? 14 : 34;
  if (floaters.length < max && Math.random() < 0.05) spawnFloater();
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i];
    f.y -= f.speed;
    const x = f.x + Math.sin(time + f.sway) * 18;
    ctx.fillStyle = `hsla(${f.hue}, 90%, 65%, ${f.alpha})`;
    traceHeart(ctx, x, f.y, f.size);
    ctx.fill();
    if (f.y < -40) floaters.splice(i, 1);
  }
}

// ---------- Particles: a heart, or her name ----------
let particles = [];
function buildParticles(originX, originY) {
  const count = reducedMotion ? 600 : Math.min(2200, Math.floor((W * H) / 600));
  particles = Array.from({ length: count }, (_, i) => {
    const t = Math.random() * TAU;
    // 45% on the outline for a crisp edge, the rest fill the body
    const onEdge = i < count * 0.45;
    const r = onEdge ? rand(0.97, 1.03) : Math.sqrt(Math.random()) * 0.95;
    const angle = Math.random() * TAU;
    const speed = rand(4, 22);
    return {
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      ux: heartX(t) * r,
      uy: -heartY(t) * r,
      nx: 0,
      ny: 0,
      size: onEdge ? rand(1.2, 2.6) : rand(0.6, 1.8),
      hue: onEdge ? rand(335, 360) : rand(320, 380) % 360,
      light: rand(55, 78),
      delay: rand(0, 0.9),
      wobble: rand(0, TAU),
    };
  });
}

// Render her name off-screen, then hand each particle a pixel of it to fly to
function assignNameTargets() {
  const off = document.createElement('canvas');
  off.width = W;
  off.height = H;
  const o = off.getContext('2d');
  let size = Math.min(W * 0.26, H * 0.32);
  o.font = `${size}px "Great Vibes", cursive`;
  const width = o.measureText(HER_NAME).width;
  if (width > W * 0.88) {
    size *= (W * 0.88) / width;
    o.font = `${size}px "Great Vibes", cursive`;
  }
  o.fillStyle = '#fff';
  o.textAlign = 'center';
  o.textBaseline = 'middle';
  o.fillText(HER_NAME, W / 2, H * 0.44);

  const data = o.getImageData(0, 0, W, H).data;
  const gap = Math.max(2, Math.round(size / 55));
  const points = [];
  for (let y = 0; y < H; y += gap) {
    for (let x = 0; x < W; x += gap) {
      if (data[(y * W + x) * 4 + 3] > 128) points.push([x, y]);
    }
  }
  if (!points.length) return;
  for (let i = points.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [points[i], points[j]] = [points[j], points[i]];
  }
  particles.forEach((p, i) => {
    const [x, y] = points[i % points.length];
    p.nx = x + (i >= points.length ? rand(-1.5, 1.5) : 0);
    p.ny = y + (i >= points.length ? rand(-1.5, 1.5) : 0);
    p.delay = rand(0, 1.2);
  });
}

function setShape(shape) {
  phase = shape;
  phaseStart = performance.now() / 1000;
}

function updateParticles(time) {
  if (!particles.length) return;
  const elapsed = time - phaseStart;
  const S = heartScale() * beat(time);
  const cx = W / 2;
  const cy = H / 2 - heartScale() * 1.5;

  ctx.globalCompositeOperation = 'lighter';

  // Soft pulsing glow behind the heart
  if (phase === 'heart') {
    const glowR = S * 22;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
    const intensity = Math.max(0, Math.min(1, (elapsed - 0.8) / 1.5)) * fx.alpha;
    g.addColorStop(0, `rgba(255, 60, 120, ${0.22 * intensity})`);
    g.addColorStop(1, 'rgba(255, 60, 120, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - glowR, cy - glowR, glowR * 2, glowR * 2);
  }

  for (const p of particles) {
    const active = (phase === 'heart' || phase === 'name') && elapsed > p.delay;
    if (active) {
      let tx;
      let ty;
      if (phase === 'heart') {
        tx = cx + p.ux * S + Math.sin(time * 2 + p.wobble) * 1.5;
        ty = cy + p.uy * S + Math.cos(time * 2 + p.wobble) * 1.5;
      } else {
        tx = p.nx + Math.sin(time * 1.5 + p.wobble) * 0.8;
        ty = p.ny + Math.cos(time * 1.5 + p.wobble) * 0.8;
      }
      p.vx += (tx - p.x) * 0.018;
      p.vy += (ty - p.y) * 0.018;
      p.vx *= 0.86;
      p.vy *= 0.86;
    } else {
      p.vx *= 0.95;
      p.vy *= 0.95;
    }

    // Particles shy away from the cursor, then spring back
    const dx = p.x - mouse.x;
    const dy = p.y - mouse.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 110 * 110 && d2 > 0.01) {
      const d = Math.sqrt(d2);
      const force = (110 - d) / 110;
      p.vx += (dx / d) * force * 3;
      p.vy += (dy / d) * force * 3;
    }

    p.x += p.vx;
    p.y += p.vy;

    const sparkle = (0.6 + 0.4 * Math.sin(time * 6 + p.wobble)) * fx.alpha;
    // Her name glows in warm gold instead of pink
    const hue = phase === 'name' ? 30 + (p.hue % 25) : p.hue;
    ctx.fillStyle = `hsla(${hue}, 100%, ${p.light}%, ${sparkle})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, phase === 'name' ? p.size * 0.8 : p.size, 0, TAU);
    ctx.fill();
  }

  ctx.globalCompositeOperation = 'source-over';
}

// ---------- Heart-shaped fireworks ----------
const sparks = [];
function heartBurst(x, y, count = 70, power = 0.32, gold = false) {
  const hueBase = gold ? rand(25, 45) : rand(320, 360);
  for (let i = 0; i < count; i++) {
    const t = (i / count) * TAU;
    const jitter = rand(0.85, 1.05);
    sparks.push({
      x,
      y,
      vx: heartX(t) * power * jitter,
      vy: -heartY(t) * power * jitter,
      life: 1,
      decay: rand(0.008, 0.016),
      size: rand(1.2, 2.6),
      hue: (hueBase + rand(-15, 30)) % 360,
    });
  }
}

function updateSparks() {
  ctx.globalCompositeOperation = 'lighter';
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.vx *= 0.965;
    s.vy = s.vy * 0.965 + 0.04;
    s.x += s.vx;
    s.y += s.vy;
    s.life -= s.decay;
    if (s.life <= 0) {
      sparks.splice(i, 1);
      continue;
    }
    ctx.fillStyle = `hsla(${s.hue}, 100%, 70%, ${s.life})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size * s.life + 0.3, 0, TAU);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

function celebrate(gold = false) {
  heartBurst(W * 0.22, H * 0.3, 70, 0.32, gold);
  gsap.delayedCall(0.25, () => heartBurst(W * 0.78, H * 0.28, 70, 0.32, gold));
  gsap.delayedCall(0.5, () => heartBurst(W * 0.5, H * 0.16, 90, 0.4, gold));
}

// ---------- Render loop ----------
function frame(ms) {
  const time = ms / 1000;
  // Fade the previous frame instead of clearing it: gives every particle a silky trail
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';

  drawStars(time);
  updateShootingStars();
  updateFloaters(time);
  updateParticles(time);
  updateSparks();

  requestAnimationFrame(frame);
}

// ---------- Scene 2: "I Love You, Lauretha" ----------
function splitLetters(el, className) {
  const text = el.getAttribute('aria-label');
  el.innerHTML = '';
  return [...text].map((ch, i) => {
    const span = document.createElement('span');
    span.className = `letter ${className}`;
    span.setAttribute('aria-hidden', 'true');
    span.style.animationDelay = `${-i * 0.35}s`;
    span.textContent = ch === ' ' ? ' ' : ch;
    el.appendChild(span);
    return span;
  });
}

let floatTween = null;
function revealText() {
  scene = 'reveal';
  const letters = splitLetters(loveText, 'love-text');
  const nameLetters = splitLetters(nameText, 'love-text-gold');
  gsap.set(reveal, { autoAlpha: 1 });
  gsap.set([subText, readBtn, replayBtn], { opacity: 0, y: 12 });

  gsap
    .timeline()
    .fromTo(
      letters,
      { opacity: 0, y: 90, rotationX: -100, scale: 0.2, filter: 'blur(14px)' },
      {
        opacity: 1,
        y: 0,
        rotationX: 0,
        scale: 1,
        filter: 'blur(0px)',
        duration: 1.2,
        ease: 'back.out(1.9)',
        stagger: 0.09,
        clearProps: 'filter',
      }
    )
    // Her name is written in, letter by letter, like a pen across the sky
    .fromTo(
      nameLetters,
      { opacity: 0, x: -30, scale: 1.6, filter: 'blur(20px)' },
      { opacity: 1, x: 0, scale: 1, filter: 'blur(0px)', duration: 1, ease: 'power3.out', stagger: 0.14, clearProps: 'filter' },
      '-=0.3'
    )
    .add(() => celebrate(true), '-=0.5')
    .to(subText, { opacity: 1, y: 0, duration: 1, ease: 'power2.out' }, '-=0.2')
    .to([readBtn, replayBtn], { opacity: 1, y: 0, duration: 0.8, stagger: 0.15 }, '+=0.4')
    .to(tapHint, { opacity: 1, duration: 0.8 }, '<');

  floatTween = gsap.to([...letters, ...nameLetters], {
    y: -10,
    duration: 1.4,
    ease: 'sine.inOut',
    repeat: -1,
    yoyo: true,
    stagger: { each: 0.12 },
    delay: 4,
  });
}

// ---------- Scene 3: the poems ----------
let poemIndex = 0;
let poemTl = null;

function buildDots() {
  poemDots.innerHTML = '';
  poems.forEach(() => {
    const dot = document.createElement('span');
    dot.className = 'h-1.5 w-1.5 rounded-full bg-pink-200/30 transition-all duration-500';
    poemDots.appendChild(dot);
  });
}

function showPoem(index) {
  poemIndex = index;
  const poem = poems[index];
  poemTl?.kill();

  poemCount.textContent = `Poem ${index + 1} of ${poems.length}`;
  poemTitle.textContent = poem.title;
  poemBody.innerHTML = '';
  [...poemDots.children].forEach((dot, i) => {
    dot.className =
      i === index
        ? 'h-1.5 w-6 rounded-full bg-amber-300 transition-all duration-500'
        : `h-1.5 w-1.5 rounded-full transition-all duration-500 ${i < index ? 'bg-pink-300/70' : 'bg-pink-200/30'}`;
  });

  const lines = poem.lines.map((line) => {
    const div = document.createElement('div');
    line.split(' ').forEach((w, i, arr) => {
      const span = document.createElement('span');
      span.className = 'word';
      span.textContent = w;
      div.appendChild(span);
      if (i < arr.length - 1) div.appendChild(document.createTextNode(' '));
    });
    poemBody.appendChild(div);
    return [...div.querySelectorAll('.word')];
  });

  nextBtn.textContent = index === poems.length - 1 ? 'One last thing →' : 'Next poem →';
  gsap.set(nextBtn, { opacity: 0, pointerEvents: 'none' });
  gsap.set(lines.flat(), { opacity: 0, y: 14, filter: 'blur(8px)' });

  poemTl = gsap.timeline();
  poemTl
    .fromTo([poemCount, poemTitle], { opacity: 0, y: -16, letterSpacing: '0.3em' }, { opacity: 1, y: 0, letterSpacing: 'normal', duration: 1.2, ease: 'power3.out', stagger: 0.15 })
    .set(poemCount, { letterSpacing: '0.5em' });
  lines.forEach((words) => {
    poemTl.to(words, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.9, ease: 'power2.out', stagger: 0.07 }, '+=0.25');
  });
  poemTl.to(nextBtn, { opacity: 1, pointerEvents: 'auto', duration: 0.6 }, '+=0.4');
}

function startPoems() {
  scene = 'poem';
  floatTween?.kill();
  gsap.to(fx, { alpha: 0.28, duration: 1.5 });
  gsap.to([reveal, tapHint], { autoAlpha: 0, duration: 0.6 });
  if (phase !== 'heart') setShape('heart');
  buildDots();
  gsap.set(poemSection, { autoAlpha: 1 });
  showPoem(0);
}

function nextPoem() {
  const content = [poemCount, poemTitle, poemBody, nextBtn];
  gsap.to(content, {
    opacity: 0,
    y: -20,
    filter: 'blur(6px)',
    duration: 0.6,
    stagger: 0.05,
    onComplete: () => {
      gsap.set(content, { y: 0, filter: 'none' });
      gsap.set(poemBody, { opacity: 1 });
      if (poemIndex < poems.length - 1) showPoem(poemIndex + 1);
      else startFinale();
    },
  });
}

// ---------- Scene 4: her name in the stars ----------
async function startFinale() {
  scene = 'finale';
  poemTl?.kill();
  gsap.set(poemSection, { autoAlpha: 0 });
  gsap.set(finaleBottom, { opacity: 0, y: 20 });
  gsap.set(finale, { autoAlpha: 1 });
  gsap.fromTo(finaleTop, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 1.6, ease: 'power2.out' });

  await document.fonts.load(`100px "Great Vibes"`).catch(() => {});
  // Shatter the heart, then let every particle find its place in her name
  for (const p of particles) {
    const a = Math.random() * TAU;
    p.vx += Math.cos(a) * rand(4, 14);
    p.vy += Math.sin(a) * rand(4, 14);
  }
  gsap.to(fx, { alpha: 1, duration: 1.5 });
  gsap.delayedCall(0.6, () => {
    assignNameTargets();
    setShape('name');
  });
  gsap.delayedCall(3.6, () => {
    celebrate(true);
    gsap.to(finaleBottom, { opacity: 1, y: 0, duration: 1.4, ease: 'power3.out' });
  });
}

function reread() {
  gsap.to(finale, { autoAlpha: 0, duration: 0.6 });
  setShape('heart');
  startPoems();
}

// ---------- Scene 1: the button ----------
function startLove() {
  if (phase !== 'idle') return;
  phase = 'explode';
  const rect = loveBtn.getBoundingClientRect();
  const ox = rect.left + rect.width / 2;
  const oy = rect.top + rect.height / 2;
  // The CSS heartbeat owns `transform`; drop it so GSAP can take over
  loveBtn.classList.remove('animate-heartbeat');

  gsap
    .timeline()
    .to(loveBtn, { scale: 1.25, duration: 0.15, ease: 'power2.out' })
    .to(loveBtn, { scale: 0, opacity: 0, rotation: 12, duration: 0.35, ease: 'back.in(2)' })
    .add(() => {
      buildParticles(ox, oy);
      heartBurst(ox, oy, 50, 0.25);
      phaseStart = performance.now() / 1000;
    })
    .to(intro, { autoAlpha: 0, duration: 0.4 }, '<')
    .add(() => setShape('heart'), '+=0.45')
    .add(revealText, '+=1.5');
}

function reset() {
  floatTween?.kill();
  poemTl?.kill();
  gsap.killTweensOf([loveBtn, intro, reveal, subText, readBtn, replayBtn, tapHint, finaleBottom]);
  // Blow the shape apart before going back to the start
  for (const p of particles) {
    const a = Math.random() * TAU;
    p.vx = Math.cos(a) * rand(6, 20);
    p.vy = Math.sin(a) * rand(6, 20);
  }
  phase = 'explode';
  gsap.to([reveal, poemSection, finale, tapHint], { autoAlpha: 0, duration: 0.5 });
  gsap.delayedCall(1.1, () => {
    particles = [];
    phase = 'idle';
    scene = 'intro';
    fx.alpha = 1;
    gsap.set(loveBtn, { clearProps: 'all' });
    loveBtn.classList.add('animate-heartbeat');
    gsap.fromTo(intro, { autoAlpha: 0, scale: 0.9 }, { autoAlpha: 1, scale: 1, duration: 0.7, ease: 'power2.out' });
  });
}

// ---------- Interactions ----------
loveBtn.addEventListener('click', startLove);
readBtn.addEventListener('click', startPoems);
nextBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  nextPoem();
});
$('rereadBtn').addEventListener('click', reread);
$('restartBtn').addEventListener('click', reset);
replayBtn.addEventListener('click', reset);

window.addEventListener('pointerdown', (e) => {
  if (e.target.closest?.('button')) return;
  if (scene === 'reveal' || scene === 'finale') heartBurst(e.clientX, e.clientY, 60, 0.22, scene === 'finale');
  // In a poem, a tap speeds up the words still to come
  if (scene === 'poem' && poemTl?.isActive()) poemTl.timeScale(4);
});

window.addEventListener('pointermove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;

  // Magnetic button: it leans toward the cursor when it's close
  if (phase !== 'idle') return;
  const rect = magnet.getBoundingClientRect();
  const dx = e.clientX - (rect.left + rect.width / 2);
  const dy = e.clientY - (rect.top + rect.height / 2);
  const dist = Math.hypot(dx, dy);
  if (dist < 180) {
    gsap.to(magnet, { x: dx * 0.35, y: dy * 0.35, duration: 0.4, ease: 'power3.out', overwrite: 'auto' });
  } else {
    gsap.to(magnet, { x: 0, y: 0, duration: 0.8, ease: 'elastic.out(1, 0.4)', overwrite: 'auto' });
  }
});
window.addEventListener('pointerleave', () => {
  mouse.x = mouse.y = -9999;
});

// ---------- Boot ----------
resize();
for (let i = 0; i < 10; i++) spawnFloater(Math.random() * H);
gsap.from('#hint', { opacity: 0, y: -20, duration: 1.2, ease: 'power2.out' });
gsap.from(magnet, { scale: 0, duration: 1.2, ease: 'elastic.out(1, 0.5)', delay: 0.3 });
requestAnimationFrame(frame);
