// render.js: paints the field, units, shots, particles and the brush cursor.
import { ART, PAL } from './art.js';
import { UNITS } from './units.js';

const TAU = Math.PI * 2;
const TINT = {
  red: 'rgba(229,72,77,0.05)',
  green: 'rgba(48,164,108,0.06)',
  blue: 'rgba(62,123,250,0.05)',
};
const RING = {
  red: 'rgba(229,72,77,0.5)',
  green: 'rgba(48,164,108,0.5)',
  blue: 'rgba(62,123,250,0.5)',
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wrap = (v) => ((v % TAU) + TAU) % TAU;

/* Pre-drawn poses. Each unit's look depends on a few quantised values. Only the
   values a unit actually uses go into its key, so an ant is never split by aim.
   Each combination is drawn once into a small bitmap and reused. */
const WALK_FRAMES = 12;
const TIME_FRAMES = { snake: 12, dragon: 8, mine: 2 };
const AIM_TYPES = new Set(['soldier', 'sniper', 'archer', 'mage', 'grenadier', 'rifleman', 'marksman', 'heavy', 'medic', 'breacher']);
const GUN_TYPES = new Set(['soldier', 'sniper', 'grenadier', 'rifleman', 'marksman', 'heavy', 'medic', 'breacher']);
const ATK_TYPES = new Set(['archer', 'cavalry', 'dragon']);
const BAKE = 96;          // logical size of a cached pose, centred on the unit
const BAKE_SCALE = 1.25;  // bitmap pixels per logical unit
const CACHE_LIMIT = 400;  // bitmaps kept at once; the cache clears when full
const POSES = new Map();

function bakePose(type, team, state) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = Math.ceil(BAKE * BAKE_SCALE);
  const g = cv.getContext('2d');
  const h = (BAKE / 2) * BAKE_SCALE;
  g.setTransform(BAKE_SCALE, 0, 0, BAKE_SCALE, h, h);
  ART[type](g, PAL[team], state);
  return cv;
}

/* Time-driven units use a fixed number of frames per cycle, read from the clock. */
function timeIndex(type, t) {
  if (type === 'snake') return Math.round((wrap(t * 3) / TAU) * TIME_FRAMES.snake) % TIME_FRAMES.snake;
  if (type === 'dragon') return Math.round((wrap(t * 9) / TAU) * TIME_FRAMES.dragon) % TIME_FRAMES.dragon;
  return Math.sin(t * 6) > 0 ? 1 : 0; // mine: blink on or off
}

/* The clock value to bake for a given frame index, so the drawer shows that frame. */
function timeState(type, i) {
  if (type === 'snake') return ((i / TIME_FRAMES.snake) * TAU) / 3;
  if (type === 'dragon') return ((i / TIME_FRAMES.dragon) * TAU) / 9;
  return i === 1 ? Math.PI / 12 : 0;
}

function pose(type, team, a) {
  const wi = a.moving ? Math.round((wrap(a.walk) / TAU) * WALK_FRAMES) % WALK_FRAMES : -1;
  const ti = TIME_FRAMES[type] ? timeIndex(type, a.t || 0) : -1;
  const aimQ = AIM_TYPES.has(type) ? Math.round((a.aim || 0) * 10) : 0;
  const recQ = GUN_TYPES.has(type) ? Math.round((a.rec || 0) * 4) : 0;
  const atkQ = ATK_TYPES.has(type) ? Math.round((a.atk || 0) * 8) : 0;
  const muz = GUN_TYPES.has(type) && a.muzzle ? 1 : 0;
  const key = `${type}|${team}|${wi}|${ti}|${aimQ}|${recQ}|${atkQ}|${muz}`;
  let bmp = POSES.get(key);
  if (!bmp) {
    if (POSES.size >= CACHE_LIMIT) POSES.clear();
    bmp = bakePose(type, team, {
      walk: wi < 0 ? 0 : (wi / WALK_FRAMES) * TAU,
      moving: wi >= 0,
      aim: aimQ / 10,
      rec: recQ / 4,
      atk: atkQ / 8,
      muzzle: muz === 1,
      t: ti < 0 ? 0 : timeState(type, ti),
    });
    POSES.set(key, bmp);
  }
  return bmp;
}

/* Draw one character. Used for units, mines, ghosts, previews and the cursor. */
export function drawSprite(c, type, team, x, y, s, face, a, alpha = 1) {
  c.save();
  c.globalAlpha = alpha;
  c.translate(x, y);
  c.scale(face * s, s);
  c.drawImage(pose(type, team, a), -BAKE / 2, -BAKE / 2, BAKE, BAKE);
  c.restore();
}

/* The static field layer (dots, team tints and the divider) is drawn once per
   size, mode and team set, then copied each frame. */
const FIELD = { key: '', canvas: null };

function paintField(c, w, h, world) {
  c.fillStyle = '#f7f6f2';
  c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(30,40,60,0.07)';
  for (let x = 15; x < w; x += 30) {
    for (let y = 15; y < h; y += 30) c.fillRect(x, y, 2, 2);
  }
  if (!world.teamMode) return;

  const teams = world.activeTeams(), n = teams.length;
  teams.forEach((t, i) => {
    c.fillStyle = TINT[t];
    c.fillRect((w * i) / n, 0, w / n + 1, h);
  });
  c.save();
  c.setLineDash([2, 9]);
  c.lineCap = 'round';
  c.lineWidth = 2;
  c.strokeStyle = 'rgba(20,22,28,0.22)';
  c.beginPath();
  for (let i = 1; i < n; i++) {
    c.moveTo((w * i) / n, 8);
    c.lineTo((w * i) / n, h - 8);
  }
  c.stroke();
  c.restore();
}

function fieldLayer(w, h, dpr, world) {
  const teams = world.teamMode ? world.activeTeams().join(',') : '';
  const key = `${w}|${h}|${dpr}|${world.teamMode ? 1 : 0}|${teams}`;
  if (FIELD.key !== key) {
    const cv = document.createElement('canvas');
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintField(g, w, h, world);
    FIELD.key = key;
    FIELD.canvas = cv;
  }
  return FIELD.canvas;
}

function drawUnit(c, u, now, teamMode) {
  const d = u.def, s = u.r / 11;
  const bob = d.structure ? 0 : u.moving ? -Math.abs(Math.sin(u.walk)) * 1.6 : Math.sin(u.bob) * 0.8;
  const push = Math.max(0, u.lunge) * 20;
  const hover = d.fly ? -14 + Math.sin(now / 300 + u.id) * 2 : 0;
  const x = u.x + Math.cos(u.aim) * push;
  const y = u.y + bob + Math.sin(u.aim) * push + hover;

  // ground shadow and team ring
  c.fillStyle = d.fly ? 'rgba(20,22,28,0.10)' : 'rgba(20,22,28,0.16)';
  c.beginPath();
  c.ellipse(u.x, u.y + u.r * 0.8, u.r * (d.fly ? 0.8 : 0.95), u.r * 0.3, 0, 0, TAU);
  c.fill();
  if (teamMode && !d.structure) {
    c.fillStyle = RING[u.team];
    c.beginPath();
    c.ellipse(u.x, u.y + u.r * 0.8, u.r * 1.05, u.r * 0.34, 0, 0, TAU);
    c.fill();
  }

  const aimL = clamp(Math.atan2(Math.sin(u.aim), Math.cos(u.aim) * u.face), -1.2, 1.2);
  drawSprite(c, u.type, u.team, x, y, s, u.face, {
    walk: u.walk, moving: u.moving, aim: aimL, rec: u.recoil, atk: u.atk,
    muzzle: u.muzzle > 0, t: now / 1000 + u.id,
  });

  if (u.flash > 0) {
    c.globalAlpha = Math.min(0.85, u.flash * 9);
    c.beginPath();
    c.arc(x, y, u.r, 0, TAU);
    c.fillStyle = '#ffffff';
    c.fill();
    c.globalAlpha = 1;
  }
  if (u.poison > 0) {
    c.setLineDash([3, 3]);
    c.strokeStyle = 'rgba(48,164,108,0.85)';
    c.lineWidth = 1.6;
    c.beginPath();
    c.arc(x, y, u.r * 1.25, 0, TAU);
    c.stroke();
    c.setLineDash([]);
  }
  if (u.hp < u.maxHp) {
    const w = Math.max(24, u.r * 2.4), f = clamp(u.hp / u.maxHp, 0, 1), top = y - u.r * 2.2 - 6;
    c.fillStyle = 'rgba(20,22,28,0.45)';
    c.fillRect(u.x - w / 2, top, w, 4.5);
    c.fillStyle = f > 0.5 ? '#30a46c' : f > 0.25 ? '#f5a524' : '#e5484d';
    c.fillRect(u.x - w / 2, top, w * f, 4.5);
  }
}

function drawShot(c, s) {
  c.save();
  c.translate(s.x, s.y);
  c.rotate(Math.atan2(s.vy, s.vx));
  if (s.type === 'archer') {
    c.strokeStyle = '#8a5a2b';
    c.lineWidth = 1.8;
    c.beginPath();
    c.moveTo(-10, 0);
    c.lineTo(5, 0);
    c.stroke();
    c.fillStyle = '#d7dde6';
    c.beginPath();
    c.moveTo(7, 0);
    c.lineTo(3, -2.2);
    c.lineTo(3, 2.2);
    c.fill();
  } else if (s.type === 'mage') {
    c.shadowColor = s.col;
    c.shadowBlur = 12;
    c.fillStyle = s.col;
    c.beginPath();
    c.arc(0, 0, 4, 0, TAU);
    c.fill();
    c.shadowBlur = 0;
  } else if (s.type === 'dragon') {
    c.fillStyle = '#ff8c42';
    c.beginPath();
    c.ellipse(-2, 0, 8, 4, 0, 0, TAU);
    c.fill();
    c.fillStyle = '#fff3b0';
    c.beginPath();
    c.ellipse(0, 0, 4, 2, 0, 0, TAU);
    c.fill();
  } else {
    c.strokeStyle = s.col;
    c.lineWidth = 2.2;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(-12, 0);
    c.lineTo(0, 0);
    c.stroke();
  }
  c.restore();
}

function drawPart(c, p) {
  const a = Math.max(0, 1 - p.t / p.life);
  c.globalAlpha = a;
  if (p.kind === 'ring') {
    c.strokeStyle = p.col;
    c.lineWidth = 1 + 4 * a;
    c.beginPath();
    c.arc(p.x, p.y, p.size * (1.05 - 0.7 * a), 0, TAU);
    c.stroke();
  } else if (p.kind === 'smoke') {
    c.fillStyle = 'rgba(130,130,130,0.5)';
    c.beginPath();
    c.arc(p.x, p.y, p.size, 0, TAU);
    c.fill();
  } else {
    c.fillStyle = p.col;
    c.beginPath();
    c.arc(p.x, p.y, p.size * (0.5 + 0.5 * a), 0, TAU);
    c.fill();
  }
  c.globalAlpha = 1;
}

function drawGhost(c, g, now) {
  const a = 1 - g.t / g.life;
  drawSprite(c, g.type, g.team, g.x, g.y, g.r / 11, g.face, { aim: 0, t: now / 1000 }, a * 0.6);
}

function drawCursor(c, cur, world, now) {
  c.save();
  c.translate(cur.x, cur.y);
  c.lineWidth = 1.6;
  if (cur.erase) {
    c.setLineDash([4, 4]);
    c.strokeStyle = 'rgba(90,96,108,0.8)';
  } else {
    c.strokeStyle = world.teamMode ? RING[cur.team] : 'rgba(62,123,250,0.6)';
  }
  c.beginPath();
  c.arc(0, 0, cur.radius, 0, TAU);
  c.stroke();
  c.setLineDash([]);
  if (!cur.erase) {
    const r = UNITS[cur.type].r;
    drawSprite(c, cur.type, cur.team, 0, 0, r / 11, 1,
      { walk: now / 90, moving: true, aim: 0, t: now / 1000 }, 0.8);
  }
  c.restore();
}

const SORT = []; // reused each frame so no new array is made

export function render(c, world, cur, now) {
  const dpr = c.getTransform().a || 1;
  const layer = fieldLayer(world.W, world.H, dpr, world);
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.drawImage(layer, 0, 0);
  c.restore();

  c.save();
  if (world.shake > 0.2) {
    c.translate((Math.random() - 0.5) * world.shake, (Math.random() - 0.5) * world.shake);
  }
  for (const m of world.traps) drawSprite(c, m.type, m.team, m.x, m.y, m.r / 11, 1, { t: now / 1000 + m.id });
  SORT.length = 0;
  for (const u of world.units) SORT.push(u);
  SORT.sort((p, q) => p.y - q.y);
  for (const u of SORT) drawUnit(c, u, now, world.teamMode);
  for (const g of world.ghosts) drawGhost(c, g, now);
  for (const s of world.shots) drawShot(c, s);
  for (const p of world.parts) drawPart(c, p);
  c.restore();
  if (cur) drawCursor(c, cur, world, now);
}
