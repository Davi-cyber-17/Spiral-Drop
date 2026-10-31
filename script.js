const cv = document.getElementById('game'), ctx = cv.getContext('2d'), $ = id => document.getElementById(id);
const TAU = Math.PI * 2, HP = Math.PI / 2;
const K = .3, RI = 84, RO = 172, RB = 128, BR = 12, GAP = 150, TH = 16, FIRST = 220;
let CX = 200, LW = 400;
const G = 1900, BOUNCE = 560, MAXV = 1000;
const VT = .7; // duração da animação do piso sumindo
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

// segmentos: 0 = vão, 1 = seguro, 2 = perigoso, 3 = chegada
const THEMES = [
  { bg: ['#050b1f', '#0b2347'], tower: '#14284a', safe: '#1aa7d6', danger: '#ff2d6f', ball: '#fff27a', neon: '#00e5ff' },
  { bg: ['#12062b', '#2d0c52'], tower: '#2a1250', safe: '#7d52f0', danger: '#ff3b3b', ball: '#00ffd0', neon: '#c46bff' },
  { bg: ['#02140f', '#06352c'], tower: '#0d2f27', safe: '#18c98f', danger: '#ff9a1f', ball: '#e8ff4d', neon: '#3dffb0' }
];

let S = 1, LH = 700, state = 'menu', level = 1, score = 0, best = 0;
let plats = [], fin, by = 0, vy = 0, rot = 0, rotT = 0, combo = 0, cam = 0, parts = [], rings = [], trail = [];
let wt = 0, mt = 0, dead = false, cf = 0, clock = 0, ts = 1;
let shake = 0, flash = 0, flashC = '255,255,255', sq = 0, fireK = 0, newBest = false, lastScore = 0, lastFill = -1;
const keys = {}, pats = {};
const stars = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), z: .2 + Math.random() * .8, ph: Math.random() * TAU }));
try { best = +localStorage.getItem('hbj_best') || 0; } catch (e) {}

const easeOut = u => 1 - Math.pow(1 - u, 3);
const easeOutBack = u => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };
const theme = () => THEMES[(level - 1) % THEMES.length];

function resize() {
  const d = Math.min(devicePixelRatio || 1, 2);
  cv.width = Math.round(innerWidth * d); cv.height = Math.round(innerHeight * d);
  S = Math.min(cv.width / 400, cv.height / 640);
  LW = cv.width / S; LH = cv.height / S; CX = LW / 2;
}
addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 120)); resize();

function shade(h, f) {
  const n = parseInt(h.slice(1), 16);
  return `rgb(${Math.min(255, (n >> 16 & 255) * f) | 0},${Math.min(255, (n >> 8 & 255) * f) | 0},${Math.min(255, (n & 255) * f) | 0})`;
}
function hexA(h, a) { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }
function pat(c) {
  if (!pats[c]) {
    const k = document.createElement('canvas'); k.width = k.height = 12;
    const x = k.getContext('2d');
    x.fillStyle = c; x.fillRect(0, 0, 12, 12);
    x.strokeStyle = shade(c, .5); x.lineWidth = 3.5;
    x.beginPath(); x.moveTo(-2, 14); x.lineTo(14, -2); x.stroke();
    pats[c] = ctx.createPattern(k, 'repeat');
  }
  return pats[c];
}
function checker() {
  if (!pats.chk) {
    const k = document.createElement('canvas'); k.width = k.height = 16;
    const x = k.getContext('2d');
    x.fillStyle = '#2fd36a'; x.fillRect(0, 0, 16, 16);
    x.fillStyle = '#e9fff0'; x.fillRect(0, 0, 8, 8); x.fillRect(8, 8, 8, 8);
    pats.chk = ctx.createPattern(k, 'repeat');
  }
  return pats.chk;
}

function build() {
  const n = 7 + level * 3, gl = Math.max(.8, 1.3 - level * .06);
  plats = [];
  for (let i = 0; i < n; i++) {
    let s = Math.random() * TAU;
    const segs = [{ s, e: s + gl, t: 0 }];
    s += gl;
    const c = 3 + (Math.random() * 3 | 0);
    const w = Array.from({ length: c }, () => .5 + Math.random());
    const sum = w.reduce((a, b) => a + b), rest = TAU - gl;
    const pd = i < 2 ? 0 : Math.min(.55, .15 + level * .05 + i / n * .15);
    w.forEach(x => {
      const l = x / sum * rest;
      segs.push({ s, e: s + l, t: Math.random() < pd ? 2 : 1 });
      s += l;
    });
    if (!segs.some(q => q.t === 1)) segs[1].t = 1;
    plats.push({ y: FIRST + i * GAP, segs, sp: -i * .06, dip: 0, bt: 0 });
  }
  fin = { y: FIRST + n * GAP, finish: true, segs: [{ s: 0, e: TAU, t: 3 }], sp: -n * .06, dip: 0, bt: 0 };
  plats.push(fin);
}

function typeAt(p, a) {
  for (const g of p.segs) {
    const d = ((a - g.s) % TAU + TAU) % TAU;
    if (d < g.e - g.s) return g.t;
  }
  return 0;
}

// ---------- UI helpers ----------
let toastTimer;
function showToast(txt, ms) {
  const t = $('toast'); t.textContent = txt; t.classList.add('show');
  clearTimeout(toastTimer);
  if (ms) toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
function show(el) { clearTimeout(el._t); el.classList.remove('hidden', 'out'); }
function hide(el) {
  if (el.classList.contains('hidden')) return;
  el.classList.add('out'); clearTimeout(el._t);
  el._t = setTimeout(() => { el.classList.add('hidden'); el.classList.remove('out'); }, 300);
}
const shown = el => !el.classList.contains('hidden') && !el.classList.contains('out');
function pop(el, from, ms) {
  if (RM || !el.animate) return;
  el.animate([{ transform: from }, { transform: 'none' }], { duration: ms || 220, easing: 'cubic-bezier(.2,1.5,.4,1)' });
}
function updCombo() {
  const el = $('combo');
  if (combo >= 2 && state === 'play') {
    el.textContent = combo >= 3 ? 'FOGO x' + combo : 'COMBO x' + combo;
    el.classList.add('on'); el.classList.toggle('fire', combo >= 3);
    if (!RM && el.animate) el.animate([{ transform: 'translateX(-50%) scale(1.4)' }, { transform: 'translateX(-50%) scale(1)' }], { duration: 200, easing: 'ease-out' });
  } else el.classList.remove('on', 'fire');
}

function applyTheme() {
  document.documentElement.style.setProperty('--neon', theme().neon);
  document.documentElement.style.setProperty('--bg', theme().bg[0]);
}
function start(keep) {
  if (!keep) { level = 1; score = 0; newBest = false; }
  build(); applyTheme();
  by = 0; vy = 0; rot = 0; rotT = 0; combo = 0; cam = -LH * .32; parts = []; rings = []; trail = [];
  wt = 0; cf = 0; dead = false; sq = 0; shake = 0; flash = 0; ts = 1; fireK = 0; lastFill = -1;
  state = 'play';
  hide($('menu')); hide($('over'));
  $('toast').classList.remove('show');
  $('fade').classList.remove('on');
  $('lvA').textContent = level; $('lvB').textContent = level + 1;
  $('best').textContent = 'BEST: ' + best;
  $('score').textContent = score; lastScore = score;
  updCombo();
  if (keep) { showToast('Nível ' + level, 900); pop($('lvA'), 'scale(1.6)', 400); pop($('lvB'), 'scale(1.6)', 400); }
}

// ---------- efeitos ----------
function burst(x, y, c, n, o) {
  o = o || {};
  const sp = o.speed || 300;
  for (let i = 0; i < n; i++) {
    const l = (o.life || .6) * (.7 + Math.random() * .6);
    parts.push({
      x, y, vx: (Math.random() - .5) * sp, vy: -Math.random() * sp * (o.up || 1) + (o.dy || 0),
      g: o.g === undefined ? 900 : o.g, l, m: l, c: Array.isArray(c) ? c[i % c.length] : c, r: 2 + Math.random() * 3
    });
  }
}
function ring(y, c) { rings.push({ x: CX, y, l: .45, m: .45, c }); }
function mkSplat(a) {
  return { a, b: Array.from({ length: 8 }, () => ({ x: (Math.random() - .5) * 44, y: (Math.random() - .5) * 30, r: 3 + Math.random() * 9 })) };
}

// o piso que a bola atravessa (ou destrói) se desfaz: peças voam para fora e somem
function vanish(p, mode) {
  p.broken = true; p.bt = 0; p.mode = mode;
  const T = theme();
  for (const g of p.segs) {
    if (!g.t) continue;
    const am = (g.s + g.e) / 2 + rot;
    const c = g.t === 2 ? T.danger : g.t === 1 ? T.safe : T.ball;
    burst(CX + RB * Math.cos(am), p.y + K * RB * Math.sin(am), [c, '#ffffff'], 3, { speed: 160, life: .5, g: 500 });
  }
}
function smash(p) {
  vanish(p, 'smash'); score++; combo = 0; updCombo();
  shake = Math.max(shake, 4); flash = Math.max(flash, .12); flashC = '255,150,30';
  burst(CX, p.y + K * RB, ['#ff9a1f', '#ffd24d', theme().safe], 14, { speed: 420 });
}
function die() {
  state = 'over'; dead = true; ts = .3; updCombo();
  newBest = score > best;
  if (newBest) { best = score; try { localStorage.setItem('hbj_best', best); } catch (e) {} }
  const T = theme();
  burst(CX, by + K * RB, [T.ball, '#ffffff', T.danger], 36, { speed: 520, life: .9 });
  ring(by + K * RB, T.danger);
  shake = 13; flash = .5; flashC = '255,45,111';
  $('res').textContent = `Pontos: ${score}  ·  Recorde: ${best}` + (newBest ? '  ·  Novo recorde!' : '');
  $('best').textContent = 'BEST: ' + best;
  setTimeout(() => { if (state === 'over') show($('over')); }, 600);
}
function confetti() {
  const T = theme(), cols = [T.neon, T.safe, T.ball, '#ffffff'];
  burst(CX, by + K * RB, cols, 10, { speed: 440, life: 1.1, g: 700, up: 1.4 });
}

// ---------- lógica ----------
function update(dt) {
  const dir = (keys.ArrowLeft || keys.KeyA ? 1 : 0) - (keys.ArrowRight || keys.KeyD ? 1 : 0);
  if (state === 'play' || state === 'win') rotT += dir * 3 * dt;
  if (state === 'menu') rotT += dt * .5;
  rot += (rotT - rot) * (1 - Math.exp(-dt * 20)); // rotação suave com inércia

  shake *= Math.exp(-dt * 8); flash *= Math.exp(-dt * 4.5); sq *= Math.exp(-dt * 13);
  fireK += ((combo >= 3 && state === 'play' ? 1 : 0) - fireK) * Math.min(1, dt * 6);

  for (const q of parts) { q.l -= dt; q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
  parts = parts.filter(q => q.l > 0);
  for (const r of rings) r.l -= dt;
  rings = rings.filter(r => r.l > 0);
  for (const q of trail) q.l -= dt;
  trail = trail.filter(q => q.l > 0);
  for (const p of plats) {
    p.sp += dt;
    if (p.dip > 0) p.dip = Math.max(0, p.dip - dt * 5);
    if (p.broken) { p.bt += dt; if (p.bt > VT) p.gone = true; }
  }

  if (state === 'menu') {
    mt += dt; cam = -LH * .32;
    by = 150 - Math.abs(Math.sin(mt * 3.5)) * 90; return;
  }
  if (state === 'win') {
    wt += dt; vy += G * dt; by += vy * dt;
    if (by > fin.y - BR) { by = fin.y - BR; vy = -BOUNCE * .75; sq = .25; }
    cf -= dt;
    if (wt < 1 && cf <= 0) { cf = .14; confetti(); }
    if (wt > 1.1) $('fade').classList.add('on');
    if (wt > 1.5) { level++; start(true); }
    return;
  }
  if (state !== 'play') return;

  const pb = by + BR;
  vy = Math.min(vy + G * dt, MAXV); by += vy * dt;
  const nb = by + BR, T = theme();
  if (vy > 0) for (const p of plats) {
    if (p.broken || pb > p.y || nb < p.y) continue;
    const a = HP - rot, t = typeAt(p, a);
    if (t === 0) {
      if (!p.passed) {
        p.passed = true; score++; combo++;
        vanish(p, 'pass'); updCombo();
        if (combo === 3) { showToast('Modo fogo!', 800); flash = .3; flashC = '255,140,0'; shake = Math.max(shake, 5); }
      }
      continue;
    }
    if (t === 3) {
      by = p.y - BR; vy = -BOUNCE; state = 'win'; wt = 0; cf = 0; sq = .35; updCombo();
      showToast(`Nível ${level} completo!`, 0);
      burst(CX, p.y + K * RB, T.ball, 20); ring(p.y + K * RB, T.neon);
      flash = .35; flashC = '255,255,255'; shake = 5;
      break;
    }
    if (combo >= 3) { smash(p); continue; }
    if (t === 2) { die(); break; }
    by = p.y - BR; vy = -BOUNCE; combo = 0; updCombo();
    p.splat = mkSplat(a); p.dip = 1; sq = .4; shake = Math.max(shake, 2.5);
    ring(p.y + K * RB, T.neon);
    burst(CX, p.y + K * RB, [T.ball, '#ffffff'], 12, { speed: 320 });
    break;
  }
  // câmera suave, com um pequeno "olhar à frente" quando a bola cai rápido
  const tg = by - LH * .32 + Math.max(0, vy) * .03;
  if (tg > cam) cam += (tg - cam) * (1 - Math.exp(-dt * 10));
}

// ---------- desenho ----------
function drawBG(T) {
  const bg = ctx.createLinearGradient(0, 0, 0, LH);
  bg.addColorStop(0, T.bg[0]); bg.addColorStop(1, T.bg[1]);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, LW, LH);

  // manchas de luz suaves com parallax
  for (let i = 0; i < 3; i++) {
    const x = LW * (.15 + .35 * i) + Math.sin(clock * .25 + i * 2) * 40, span = LH + 500;
    const y = (((i * 330 - cam * .12) % span) + span) % span - 250, r = 250;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r), c = i === 1 ? T.safe : T.neon;
    g.addColorStop(0, hexA(c, .16)); g.addColorStop(1, hexA(c, 0));
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // estrelas / poeira com parallax e rastro de velocidade
  const sp = state === 'play' ? Math.max(0, vy) : 0;
  for (const s of stars) {
    const py = (((s.y * LH - cam * s.z * .45) % LH) + LH) % LH, px = s.x * LW;
    ctx.globalAlpha = (.35 + .35 * Math.sin(clock * 2 + s.ph)) * (.4 + s.z * .6);
    ctx.fillStyle = fireK > .3 ? '#ffb347' : s.z > .7 ? '#fff' : T.neon;
    const len = 1.5 * s.z + sp * .012 * s.z * (1 + fireK * 1.5);
    ctx.fillRect(px, py - len * .5, 1.4 * s.z + .4, len);
  }
  ctx.globalAlpha = 1;

  // grade tecnológica
  ctx.strokeStyle = T.neon; ctx.globalAlpha = .07; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = CX % 40; x < LW; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, LH); }
  const gy = ((cam * .3 % 40) + 40) % 40;
  for (let y = -gy; y < LH; y += 40) { ctx.moveTo(0, y); ctx.lineTo(LW, y); }
  ctx.stroke(); ctx.globalAlpha = 1;

  const vg = ctx.createRadialGradient(CX, LH * .45, LH * .2, CX, LH * .45, Math.max(LW, LH) * .75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, LW, LH);

  if (fireK > .01) {
    const f = ctx.createLinearGradient(0, LH, 0, LH * .35);
    f.addColorStop(0, `rgba(255,110,0,${.3 * fireK})`); f.addColorStop(1, 'rgba(255,110,0,0)');
    ctx.fillStyle = f; ctx.fillRect(0, 0, LW, LH);
  }
}

function drawPlat(p, sy, T) {
  if (p.gone || p.sp < 0) return;
  const u = p.broken ? Math.min(1, p.bt / VT) : 0, smashed = p.mode === 'smash';
  sy += p.dip * 5;
  ctx.save();
  ctx.globalAlpha = Math.min(1, p.sp / .3) * (p.broken ? Math.pow(1 - u, 1.5) : 1);
  if (p.sp < .45) { // animação de entrada
    const k = .7 + .3 * easeOutBack(p.sp / .45);
    ctx.translate(CX, sy); ctx.scale(k, k); ctx.translate(-CX, -sy);
  }
  const col = t => t === 1 ? T.safe : t === 2 ? T.danger : '#3ccf5a';
  const arcs = p.segs.filter(g => g.t).map(g => {
    const a0 = ((g.s + rot) % TAU + TAU) % TAU, a1 = a0 + g.e - g.s;
    let ox = 0, oy = 0;
    if (p.broken) { // cada peça voa para fora
      const am = (a0 + a1) / 2, d = easeOut(u) * (smashed ? 150 : 120);
      ox = Math.cos(am) * d; oy = Math.sin(am) * K * d + (smashed ? u * u * 300 : -u * 45);
    }
    return { a0, a1, t: g.t, ox, oy };
  });

  // laterais
  for (const g of arcs) {
    ctx.save(); ctx.translate(g.ox, g.oy);
    ctx.fillStyle = shade(col(g.t), .62);
    for (const k of [0, 1]) {
      const lo = Math.max(g.a0, k * TAU), hi = Math.min(g.a1, k * TAU + Math.PI);
      if (lo >= hi) continue;
      ctx.beginPath();
      ctx.ellipse(CX, sy, RO, RO * K, 0, lo - k * TAU, hi - k * TAU);
      ctx.ellipse(CX, sy + TH, RO, RO * K, 0, hi - k * TAU, lo - k * TAU, true);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  // topos com degradê, brilho na borda e pulso nas peças perigosas
  const grads = {};
  const fillFor = t => {
    if (t === 2) return pat(col(2));
    if (t === 3) return checker();
    if (!grads[t]) {
      const g = ctx.createLinearGradient(0, sy - RO * K, 0, sy + RO * K);
      g.addColorStop(0, shade(col(t), 1.3)); g.addColorStop(1, shade(col(t), .92));
      grads[t] = g;
    }
    return grads[t];
  };
  const pulse = .5 + .5 * Math.sin(clock * 5);
  for (const g of arcs) {
    ctx.save(); ctx.translate(g.ox, g.oy);
    ctx.fillStyle = fillFor(g.t);
    ctx.beginPath();
    ctx.ellipse(CX, sy, RO, RO * K, 0, g.a0, g.a1);
    ctx.ellipse(CX, sy, RI, RI * K, 0, g.a1, g.a0, true);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1.1; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(CX, sy, RO - 1, RO * K - .3, 0, g.a0, g.a1);
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1.6; ctx.stroke();
    if (g.t === 2 && !p.broken) {
      ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= .15 + .35 * pulse;
      ctx.strokeStyle = T.danger; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(CX, sy, RO, RO * K, 0, g.a0, g.a1); ctx.stroke();
    }
    ctx.restore();
  }
  if (p.splat && !p.broken) {
    const an = p.splat.a + rot, px = CX + RB * Math.cos(an), py = sy + K * RB * Math.sin(an);
    ctx.fillStyle = T.ball;
    ctx.beginPath(); ctx.ellipse(px, py, 15, 6, 0, 0, TAU); ctx.fill();
    for (const b of p.splat.b) { ctx.beginPath(); ctx.ellipse(px + b.x, py + b.y * K, b.r, b.r * .45, 0, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

function slab(y0, y1, g, T, i) {
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(CX - RI, y0); ctx.lineTo(CX - RI, y1);
  ctx.ellipse(CX, y1, RI, RI * K, 0, Math.PI, 0, true);
  ctx.lineTo(CX + RI, y0); ctx.fill();
  ctx.strokeStyle = T.neon;
  ctx.globalAlpha = .16; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const f of [-.55, 0, .55]) { const x = CX + RI * f; ctx.moveTo(x, y0); ctx.lineTo(x, y1 + RI * K * Math.sqrt(1 - f * f)); }
  ctx.stroke();
  // pulsos de energia subindo pela torre
  ctx.setLineDash([10, 52]); ctx.lineDashOffset = clock * 70 + i * 13;
  ctx.globalAlpha = .5; ctx.lineWidth = 2; ctx.stroke();
  ctx.setLineDash([]);
  // emenda neon com brilho pulsante
  const pl = .65 + .25 * Math.sin(clock * 3 + i);
  ctx.globalAlpha = .13 * pl; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.ellipse(CX, y1, RI, RI * K, 0, 0, Math.PI); ctx.stroke();
  ctx.globalAlpha = pl; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(CX, y1, RI, RI * K, 0, 0, Math.PI); ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawShadow() {
  if (dead || state === 'menu') return;
  const pb = by + BR;
  for (const p of plats) {
    if (p.broken || p.y < pb - 2) continue;
    if (typeAt(p, HP - rot) === 0) return; // sombra só cai em peça sólida
    const k = Math.max(.35, 1 - (p.y - pb) / 380);
    ctx.fillStyle = `rgba(0,0,0,${.38 * k})`;
    ctx.beginPath(); ctx.ellipse(CX, p.y - cam + K * RB + p.dip * 5, BR * 1.5 * k, BR * .5 * k, 0, 0, TAU); ctx.fill();
    return;
  }
}

function drawBall(T) {
  const fire = fireK > .5, base = fire ? '#ff8a00' : T.ball, bx = CX, y = by - cam + K * RB;
  for (const q of trail) {
    const a = q.l / q.m;
    ctx.globalAlpha = a * .3; ctx.fillStyle = base;
    ctx.beginPath(); ctx.arc(bx, q.y - cam + K * RB, BR * (.45 + .55 * a), 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (state === 'play' && vy > 150) {
    const len = Math.min(vy * (fire ? .2 : .14), 150);
    ctx.fillStyle = fire ? 'rgba(255,150,30,.55)' : 'rgba(255,255,255,.4)';
    ctx.beginPath(); ctx.moveTo(bx - BR * .5, y); ctx.lineTo(bx + BR * .5, y); ctx.lineTo(bx, y - len); ctx.fill();
  }
  const st = state === 'play' ? Math.min(Math.abs(vy) / MAXV, 1) * .16 : 0;
  ctx.save();
  ctx.translate(bx, y + BR); ctx.scale(1 + sq * .8 - st * .6, 1 - sq + st); ctx.translate(0, -BR); // squash & stretch
  ctx.shadowColor = fire ? '#ff7a00' : T.ball; ctx.shadowBlur = fire ? 26 : 16;
  const g = ctx.createRadialGradient(-4, -5, 1, 0, 0, BR);
  g.addColorStop(0, '#ffffff'); g.addColorStop(.3, base); g.addColorStop(1, shade(base, .5));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, BR, 0, TAU); ctx.fill();
  ctx.restore();
}

function draw() {
  ctx.setTransform(S, 0, 0, S, 0, 0);
  const T = theme();
  drawBG(T);

  ctx.save();
  if (shake > .1 && !RM) ctx.translate((Math.random() - .5) * shake * 2, (Math.random() - .5) * shake * 2);

  const tg = ctx.createLinearGradient(CX - RI, 0, CX + RI, 0);
  tg.addColorStop(0, shade(T.tower, .55)); tg.addColorStop(.3, shade(T.tower, 1.3)); tg.addColorStop(1, shade(T.tower, .45));
  for (let i = plats.length - 1; i >= 0; i--) {
    const p = plats[i], sy = p.y - cam;
    if (sy < -130 || sy - GAP > LH) continue;
    drawPlat(p, sy, T);
    slab(i === 0 ? -3000 : sy - GAP, sy, tg, T, i);
  }

  drawShadow();

  // ondas de choque
  ctx.globalCompositeOperation = 'lighter';
  for (const r of rings) {
    const a = r.l / r.m, rr = RB * .4 + (RO * 1.1 - RB * .4) * easeOut(1 - a);
    ctx.globalAlpha = a * .8; ctx.strokeStyle = r.c; ctx.lineWidth = 1 + 3 * a;
    ctx.beginPath(); ctx.ellipse(r.x, r.y - cam, rr, rr * K, 0, 0, TAU); ctx.stroke();
  }
  // partículas brilhantes
  for (const q of parts) {
    const a = Math.max(0, q.l / q.m);
    ctx.globalAlpha = Math.min(1, a * 1.5); ctx.fillStyle = q.c;
    ctx.beginPath(); ctx.arc(q.x, q.y - cam, q.r * (.4 + .6 * a), 0, TAU); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;

  if (!dead) drawBall(T);
  ctx.restore();

  if (flash > .01) { ctx.fillStyle = `rgba(${flashC},${Math.min(.6, flash)})`; ctx.fillRect(0, 0, LW, LH); }

  if (score !== lastScore) { lastScore = score; $('score').textContent = score; pop($('score'), 'scale(1.35)', 240); }
  const f = state === 'win' ? 100 : state === 'play' ? Math.round(Math.max(0, Math.min(1, by / fin.y)) * 1000) / 10 : -1;
  if (f >= 0 && f !== lastFill) { lastFill = f; $('fill').style.width = f + '%'; }
}

// ---------- controles ----------
let dragX = null;
addEventListener('pointerdown', e => { if (!e.target.closest('button')) dragX = e.clientX; });
addEventListener('pointermove', e => {
  if (dragX === null) return;
  if (state === 'play' || state === 'win') rotT -= (e.clientX - dragX) / Math.min(innerWidth, innerHeight * .62, 520) * 5;
  dragX = e.clientX;
});
addEventListener('pointerup', () => dragX = null);
addEventListener('pointercancel', () => dragX = null);
addEventListener('keydown', e => {
  keys[e.code] = true;
  if ((e.code === 'Enter' || e.code === 'Space') && ((state === 'menu' && shown($('menu'))) || (state === 'over' && shown($('over'))))) start();
});
addEventListener('keyup', e => keys[e.code] = false);
$('play').onclick = () => start();
$('again').onclick = () => start();

build(); applyTheme();
$('best').textContent = 'BEST: ' + best;
let last = performance.now();
(function loop(t) {
  const real = Math.min(.033, (t - last) / 1000); last = t;
  clock += real;
  ts += (1 - ts) * Math.min(1, real * 2.2); // câmera lenta ao morrer, volta ao normal
  const dt = real * ts, n = Math.max(1, Math.ceil(dt / (1 / 120)));
  for (let i = 0; i < n; i++) update(dt / n);
  if (state === 'play') {
    if (vy > 300) trail.push({ y: by, l: .16, m: .16 });
    if (combo >= 3) for (let i = 0; i < 2; i++) parts.push({
      x: CX + (Math.random() - .5) * 12, y: by + K * RB + (Math.random() - .5) * 8,
      vx: (Math.random() - .5) * 60, vy: -30 - Math.random() * 50, g: 0, l: .35, m: .35,
      c: Math.random() < .5 ? '#ff9a1f' : '#ff4d00', r: 3 + Math.random() * 3
    });
  }
  draw();
  requestAnimationFrame(loop);
})(last);
