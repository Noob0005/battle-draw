// main.js: UI, input, sound and the frame loop. Battle rules live in sim.js.
import { World, typeTeam } from './sim.js';
import { UNITS, CATS } from './units.js';
import { render, drawSprite } from './render.js';

const $ = (sel) => document.querySelector(sel);
const canvas = $('#field');
const ctx = canvas.getContext('2d');
const world = new World();
const ui = { type: 'soldier', cat: 'army', erase: false, brush: 30, dpr: 1 };
const history = [];
const previews = [];
const TEAM_NAME = { red: 'Red', green: 'Green', blue: 'Blue' };
const TEAM_HEX = { red: '#e5484d', green: '#30a46c', blue: '#3e7bfa' };
const MODE_TIP = {
  ffa: 'Paint two different types and they brawl on their own.',
  teams2: 'Red is on the left, blue on the right. Press Start once both sides have fighters.',
  teams3: 'Red left, green middle, blue right. Press Start once two zones have fighters.',
};
const PAUSE_ICON = '<path d="M9 5v14M15 5v14"/>';
const PLAY_ICON = '<path d="M7 5v14l12-7z" fill="currentColor" stroke="none"/>';
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

let drag = null, ptr = null, shownFor = null, hudTimer = 0, toastTimer = 0, muted = false;
let last = performance.now();
let audio = null;
const lastSfx = {};

/* ---------- sound: synthesised in the browser, nothing to download ---------- */

function ac() {
  if (!audio) {
    try {
      audio = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (audio.state === 'suspended') audio.resume();
  return audio;
}

function tone(f, dur, type, vol, slide = 0) {
  const a = ac();
  if (!a || muted) return;
  const t = a.currentTime, o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur);
}

const SFX = {
  shoot: () => tone(680, 0.06, 'square', 0.03, -300),
  arrow: () => tone(360, 0.08, 'triangle', 0.035, 140),
  hit: () => tone(160, 0.05, 'triangle', 0.03, -60),
  boom: () => tone(70, 0.3, 'sine', 0.16, -30),
  die: () => tone(220, 0.15, 'sawtooth', 0.015, -120),
  win: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.08), i * 110)),
};

function playSfx(name) {
  const now = performance.now();
  if (now - (lastSfx[name] || 0) < 60) return;
  lastSfx[name] = now;
  SFX[name]?.();
}

function toggleMute() {
  muted = !muted;
  $('#soundBtn').classList.toggle('off', muted);
  toast(muted ? 'Sound off' : 'Sound on', 1200);
}

/* ---------- canvas sizing and helpers ---------- */

function resize() {
  const r = $('#stage').getBoundingClientRect();
  ui.dpr = Math.min(window.devicePixelRatio || 1, 2);
  world.setSize(r.width, r.height);
  canvas.width = Math.round(world.W * ui.dpr);
  canvas.height = Math.round(world.H * ui.dpr);
}

function toast(msg, ms = 2400) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

const pos = (e) => {
  const r = canvas.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
};

function pushHistory() {
  history.push(world.snapshot());
  if (history.length > 30) history.shift();
}

/* ---------- painting ---------- */

function place(p) { world.paint(ui.type, p.x, p.y, ui.brush * 0.55); }

function stroke(p) {
  if (drag.erase) {
    world.erase(p.x, p.y, ui.brush + 12);
    return;
  }
  const def = UNITS[ui.type];
  const step = def.structure ? def.r * 1.5 : def.trap ? def.r * 2.4 : Math.max(13, def.r * 1.45);
  if (!drag.last) {
    place(p);
    drag.last = p;
    return;
  }
  let dx = p.x - drag.last.x, dy = p.y - drag.last.y, dist = Math.hypot(dx, dy);
  while (dist >= step) {
    drag.last = { x: drag.last.x + (dx / dist) * step, y: drag.last.y + (dy / dist) * step };
    place(drag.last);
    dx = p.x - drag.last.x;
    dy = p.y - drag.last.y;
    dist = Math.hypot(dx, dy);
  }
}

canvas.addEventListener('pointerdown', (e) => {
  ac();
  ptr = pos(e);
  if (!world.canPaint) {
    toast('Battle running. Press New battle or Clear to redraw.');
    return;
  }
  canvas.setPointerCapture(e.pointerId);
  pushHistory();
  drag = { erase: e.button === 2 || ui.erase, last: null };
  stroke(ptr);
});

canvas.addEventListener('pointermove', (e) => {
  ptr = pos(e);
  if (drag && world.canPaint) stroke(ptr);
});

const endDrag = () => { drag = null; };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('pointerleave', () => { ptr = null; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  ui.brush = clamp(ui.brush - Math.sign(e.deltaY) * 6, 14, 80);
}, { passive: false });

/* ---------- modes, seeding and battle controls ---------- */

function seed() {
  const W = world.W, H = world.H;
  const block = (type, cx, cy) => {
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        world.add(type, world.teamOf(cx, type), cx + (i - 1) * 30, cy + (j - 1) * 30);
      }
    }
  };
  if (world.mode === 'teams3') {
    block('soldier', W * 0.16, H * 0.5);
    world.add('archer', 'red', W * 0.07, H * 0.3);
    world.add('archer', 'red', W * 0.07, H * 0.7);
    block('zombie', W * 0.5, H * 0.5);
    world.add('mage', 'green', W * 0.5, H * 0.2);
    block('soldier', W * 0.84, H * 0.5);
    world.add('archer', 'blue', W * 0.93, H * 0.3);
    world.add('archer', 'blue', W * 0.93, H * 0.7);
  } else if (world.mode === 'teams2') {
    block('soldier', W * 0.22, H * 0.5);
    world.add('archer', 'red', W * 0.13, H * 0.32);
    world.add('archer', 'red', W * 0.13, H * 0.68);
    world.add('wall', 'red', W * 0.34, H * 0.24);
    block('soldier', W * 0.78, H * 0.5);
    world.add('archer', 'blue', W * 0.87, H * 0.32);
    world.add('archer', 'blue', W * 0.87, H * 0.68);
    world.add('wall', 'blue', W * 0.66, H * 0.76);
  } else {
    block('soldier', W * 0.3, H * 0.5);
    block('zombie', W * 0.7, H * 0.5);
  }
}

function setMode(m) {
  for (const b of document.querySelectorAll('#modes button')) {
    b.classList.toggle('on', b.dataset.mode === m);
  }
  history.length = 0;
  world.setMode(m);
  seed();
  toast(MODE_TIP[m], 3600);
}

function startBattle() {
  if (world.started || world.start()) return;
  toast(world.mode === 'teams3'
    ? 'Paint fighters in at least two zones first.'
    : 'Paint fighters on both sides first.');
}

function togglePause() {
  if (!world.started) {
    if (world.teamMode) startBattle();
    else toast('Free-for-all starts on its own. Paint two different types.');
    return;
  }
  world.togglePause();
}

function clearField() {
  pushHistory();
  world.reset();
  $('#result').hidden = true;
  toast('Field cleared. Ctrl+Z brings it back.');
}

function undo() {
  if (!world.canPaint) {
    toast("Can't undo during a team battle.");
    return;
  }
  const s = history.pop();
  if (!s) {
    toast('Nothing to undo', 1400);
    return;
  }
  world.load(s);
  toast('Undone', 1200);
}

/* ---------- result card ---------- */

function mvpLine() {
  const tally = {};
  for (const k of world.kills) {
    if (!k.type) continue;
    const key = (world.teamMode ? k.team : '') + ':' + k.type;
    tally[key] = tally[key] || { team: k.team, type: k.type, n: 0 };
    tally[key].n++;
  }
  const best = Object.values(tally).sort((a, b) => b.n - a.n)[0];
  if (!best) return '';
  const side = world.teamMode ? TEAM_NAME[best.team] + ' ' : '';
  return `MVP: ${side}${UNITS[best.type].name}, ${best.n} kills`;
}

function showResult() {
  const o = world.over, time = fmt(world.time);
  let title, sub;
  if (o.kind === 'draw') {
    title = 'Total annihilation';
    sub = `Every fighter fell in ${time}.`;
  } else if (o.kind === 'team') {
    title = `${TEAM_NAME[o.key]} team wins`;
    const kills = world.kills.filter((k) => k.team === o.key).length;
    sub = `${time} · ${kills} kills · ${world.teamAlive(o.key)} still standing`;
  } else {
    title = `${UNITS[o.key].name} wins`;
    sub = `${time} · ${world.fighters().length} still standing`;
  }
  $('#resTitle').textContent = title;
  $('#resSub').textContent = sub;
  $('#resMvp').textContent = mvpLine();
  $('#result').hidden = false;
}

function closeResult() {
  $('#result').hidden = true;
  world.rearm();
}

/* ---------- palette ---------- */

function unitKeys() { return Object.keys(UNITS).filter((k) => UNITS[k].cat === ui.cat); }

function buildCats() {
  $('#cats').innerHTML = CATS
    .map((c) => `<button data-cat="${c.id}" class="${c.id === ui.cat ? 'on' : ''}">${c.name}</button>`)
    .join('');
}

function buildUnits() {
  const keys = unitKeys();
  $('#units').innerHTML = keys
    .map((k) => `<button class="unit${k === ui.type ? ' on' : ''}" data-type="${k}">` +
      `<canvas width="112" height="104"></canvas><span>${UNITS[k].name}</span></button>`)
    .join('');
  previews.length = 0;
  $('#units').querySelectorAll('canvas').forEach((el, i) => {
    previews.push({ g: el.getContext('2d'), type: keys[i] });
  });
}

function drawPreviews(now) {
  const t = now / 1000;
  previews.forEach(({ g, type }, i) => {
    const k = ((t + i * 0.13) * 1.4) % 1;
    const atk = k < 0.25 ? Math.sin((k / 0.25) * Math.PI) : 0;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, 112, 104);
    drawSprite(g, type, typeTeam(type), 56, 62, 1.45, 1,
      { walk: t * 8 + i, moving: true, aim: 0, rec: atk, atk, muzzle: atk > 0.7, t });
  });
}

function selectCat(id) {
  ui.cat = id;
  buildCats();
  buildUnits();
}

function pickUnit(k) {
  ui.type = k;
  setEraser(false);
  buildUnits();
}

function setEraser(on) {
  ui.erase = on;
  $('#brushBtn').classList.toggle('on', !on);
  $('#eraseBtn').classList.toggle('on', on);
}

/* ---------- HUD and frame loop ---------- */

function cursor() {
  if (!ptr || !world.canPaint) return null;
  return {
    ...ptr,
    type: ui.type,
    team: world.teamOf(ptr.x, ui.type),
    radius: ui.erase ? ui.brush + 12 : ui.brush,
    erase: ui.erase,
  };
}

function updateHud() {
  $('#count').textContent = `${world.count} on the field`;
  const sc = $('#scores');
  sc.hidden = !world.teamMode;
  if (world.teamMode) {
    sc.innerHTML = world.activeTeams()
      .map((t) => `<span class="score"><i style="background:${TEAM_HEX[t]}"></i>${TEAM_NAME[t]} · ${world.teamAlive(t)}</span>`)
      .join('');
  }
  $('#startBtn').hidden = !(world.teamMode && !world.started && world.canStart());
  $('#units').classList.toggle('locked', !world.canPaint);
  $('#pauseBtn svg').innerHTML = world.paused ? PLAY_ICON : PAUSE_ICON;
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  world.update(dt);
  for (const name of world.drainSounds()) playSfx(name);
  if (world.over && shownFor !== world.over) {
    shownFor = world.over;
    showResult();
  }
  if (!world.over) shownFor = null;

  ctx.setTransform(ui.dpr, 0, 0, ui.dpr, 0, 0);
  render(ctx, world, cursor(), now);
  drawPreviews(now);

  hudTimer -= dt;
  if (hudTimer <= 0) {
    hudTimer = 0.2;
    updateHud();
  }
  requestAnimationFrame(frame);
}

/* ---------- wiring ---------- */

$('#undoBtn').onclick = undo;
$('#clearBtn').onclick = clearField;
$('#pauseBtn').onclick = togglePause;
$('#soundBtn').onclick = toggleMute;
$('#startBtn').onclick = startBattle;
$('#brushBtn').onclick = () => setEraser(false);
$('#eraseBtn').onclick = () => setEraser(true);
$('#againBtn').onclick = clearField;
$('#closeBtn').onclick = closeResult;
$('#modes').onclick = (e) => {
  const b = e.target.closest('button');
  if (b && b.dataset.mode !== world.mode) setMode(b.dataset.mode);
};
$('#cats').onclick = (e) => {
  const b = e.target.closest('button');
  if (b) selectCat(b.dataset.cat);
};
$('#units').onclick = (e) => {
  const b = e.target.closest('button');
  if (b) pickUnit(b.dataset.type);
};

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z') {
    e.preventDefault();
    undo();
  } else if (e.key === ' ') {
    e.preventDefault();
    togglePause();
  } else if (k === 'c') {
    clearField();
  } else if (k === 'e') {
    setEraser(!ui.erase);
  } else if (k === 'b') {
    setEraser(false);
  } else if (k === 'm') {
    toggleMute();
  } else if (k === 'escape') {
    if (!$('#result').hidden) closeResult();
  } else if (e.key === 'Tab') {
    e.preventDefault();
    const i = CATS.findIndex((c) => c.id === ui.cat);
    selectCat(CATS[(i + 1) % CATS.length].id);
  } else if (/^[1-9]$/.test(e.key)) {
    const pick = unitKeys()[Number(e.key) - 1];
    if (pick) pickUnit(pick);
  }
});

/* ---------- start ---------- */

buildCats();
buildUnits();
setEraser(false);
resize();
seed();
new ResizeObserver(resize).observe($('#stage'));
setTimeout(() => toast(
  'Paint two types and they brawl on their own. Scroll to resize the brush, right-click to erase.',
  4200,
), 400);
requestAnimationFrame(frame);
