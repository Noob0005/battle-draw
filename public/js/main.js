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
  ffa: 'Each unit type is its own army. Deploy anywhere and rivals fight on contact.',
  teams2: 'Red holds the left side, blue the right. Deploy into either side.',
  teams3: 'Red left, green middle, blue right. Deploy into any zone.',
};
const PAUSE_ICON = '<path d="M9 5v14M15 5v14"/>';
const PLAY_ICON = '<path d="M7 5v14l12-7z" fill="currentColor" stroke="none"/>';
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const groupName = (k) => (world.teamMode ? TEAM_NAME[k] + ' team' : UNITS[k].name);
const groupColor = (k) => TEAM_HEX[world.teamMode ? k : typeTeam(k)];

let drag = null, ptr = null, hudTimer = 0, toastTimer = 0, muted = false, fullWarned = 0;
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

/* ---------- deploying ---------- */

function place(p) {
  if (world.paint(ui.type, p.x, p.y, ui.brush * 0.55)) return;
  const now = performance.now();
  if (now - fullWarned > 2000) {
    fullWarned = now;
    toast('The field is full. Erase some units first.');
  }
}

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
  canvas.setPointerCapture(e.pointerId);
  pushHistory();
  drag = { erase: e.button === 2 || ui.erase, last: null };
  stroke(ptr);
});

canvas.addEventListener('pointermove', (e) => {
  ptr = pos(e);
  if (drag) stroke(ptr);
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

/* ---------- modes and battle controls ---------- */

function setMode(m) {
  for (const b of document.querySelectorAll('#modes button')) {
    b.classList.toggle('on', b.dataset.mode === m);
  }
  history.length = 0;
  world.setMode(m);
  $('#result').hidden = true;
  toast(MODE_TIP[m], 3600);
}

function togglePause() {
  if (world.over) {
    toast('The battle is finished. Deploy fighters to start another.');
    return;
  }
  world.togglePause();
}

function finishBattle() {
  if (world.over) {
    showResult(world.over);
    return;
  }
  if (!world.count) {
    toast('Deploy some fighters first.');
    return;
  }
  showResult(world.finish());
}

function clearField() {
  pushHistory();
  world.reset();
  $('#result').hidden = true;
  toast('Field cleared. Ctrl+Z brings it back.');
}

function undo() {
  const s = history.pop();
  if (!s) {
    toast('Nothing to undo', 1400);
    return;
  }
  world.load(s);
  $('#result').hidden = true;
  toast('Undone', 1200);
}

/* ---------- finish verdict card ---------- */

function mvpLine() {
  const tally = {};
  for (const k of world.kills) {
    if (!k.type) continue;
    const key = world.teamMode ? k.team : k.type;
    tally[key] = (tally[key] || 0) + 1;
  }
  const top = Object.entries(tally).sort((x, y) => y[1] - x[1])[0];
  return top ? `Most kills: ${groupName(top[0])}, ${top[1]}` : '';
}

function showResult(v) {
  const [a, b] = v.rows;
  let title, sub;
  if (v.kind === 'draw') {
    title = 'Draw';
    sub = v.reason === 'empty'
      ? 'No fighters left to rank.'
      : `${v.tied.length} groups tied on ${v.count} fighters and ${v.hp} total health.`;
  } else {
    title = `${groupName(v.winner)} wins`;
    sub = v.reason === 'alone' ? `Last group standing with ${a.count} fighters.`
      : v.reason === 'count' ? `Most fighters: ${a.count} to ${b.count}.`
      : `Same number of fighters (${a.count}). More total health: ${a.hp} to ${b.hp}.`;
  }
  $('#resTitle').textContent = title;
  $('#resSub').textContent = `Battle time ${fmt(world.time)}. ${sub}`;
  $('#resRows').innerHTML = v.rows.length
    ? '<table><thead><tr><th>Group</th><th>Fighters</th><th>Total health</th></tr></thead><tbody>' +
      v.rows.map((r) => `<tr><td><i style="background:${groupColor(r.key)}"></i>${groupName(r.key)}</td><td>${r.count}</td><td>${r.hp}</td></tr>`).join('') +
      '</tbody></table>'
    : '';
  $('#resMvp').textContent = mvpLine();
  $('#result').hidden = false;
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
  if (!ptr) return null;
  return {
    ...ptr,
    type: ui.type,
    team: world.teamOf(ptr.x, ui.type),
    radius: ui.erase ? ui.brush + 12 : ui.brush,
    erase: ui.erase,
  };
}

function updateHud() {
  const rows = world.standings();
  const sc = $('#scores');
  sc.hidden = !rows.length;
  sc.innerHTML = rows
    .map((r) => `<span class="score"><i style="background:${groupColor(r.key)}"></i>${groupName(r.key)} · ${r.count}</span>`)
    .join('');

  let status = `${world.count} on the field`;
  if (world.over) status = `Battle finished · ${status}`;
  else if (world.paused) status = `Paused · ${status}`;
  else if (rows.length === 1) status = `Only ${groupName(rows[0].key)} left · ${status}`;
  else if (rows.length > 1) status = `Battle live · ${status}`;
  $('#count').textContent = status;

  $('#finishBtn').disabled = !world.count;
  $('#pauseBtn svg').innerHTML = world.paused ? PLAY_ICON : PAUSE_ICON;
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  world.update(dt);
  for (const name of world.drainSounds()) playSfx(name);

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
$('#finishBtn').onclick = finishBattle;
$('#brushBtn').onclick = () => setEraser(false);
$('#eraseBtn').onclick = () => setEraser(true);
$('#closeBtn').onclick = () => { $('#result').hidden = true; };
$('#againBtn').onclick = clearField;
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
  } else if (k === 'f') {
    finishBattle();
  } else if (k === 'c') {
    clearField();
  } else if (k === 'e') {
    setEraser(!ui.erase);
  } else if (k === 'b') {
    setEraser(false);
  } else if (k === 'm') {
    toggleMute();
  } else if (k === 'escape') {
    $('#result').hidden = true;
  } else if (e.key === 'Tab') {
    e.preventDefault();
    const i = CATS.findIndex((c) => c.id === ui.cat);
    selectCat(CATS[(i + 1) % CATS.length].id);
  } else if (/^[1-9]$/.test(e.key)) {
    const pick = unitKeys()[Number(e.key) - 1];
    if (pick) pickUnit(pick);
  }
});

/* ---------- start with an empty field ---------- */

buildCats();
buildUnits();
setEraser(false);
resize();
new ResizeObserver(resize).observe($('#stage'));
setTimeout(() => toast(
  'Deploy fighters anywhere. Rivals fight on contact. Hit Finish battle when you want the verdict.',
  4200,
), 400);
requestAnimationFrame(frame);
