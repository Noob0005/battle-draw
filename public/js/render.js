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

/* Draw one character. Used for units, mines, ghosts, previews and the cursor. */
export function drawSprite(c, type, team, x, y, s, face, a, alpha = 1) {
  c.save();
  c.globalAlpha = alpha;
  c.translate(x, y);
  c.scale(face * s, s);
  ART[type](c, PAL[team], a);
  c.restore();
}

function drawField(c, w, h, world) {
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

function drawUnit(c, u, now, teamMode) {
  const d = u.def, s = u.r / 11;
  const bob = d.structure ? 0 : u.moving ? -Math.abs(Math.sin(u.walk)) * 1.6 : Math.sin(u.bob) * 0.8;
  const push = Math.max(0, u.lunge) * 20;
  const hover = d.fly ? -14 + Math.sin(now / 300 + u.id) * 2 : 0;
  const x = u.x + Math.cos(u.aim) * push;
  const cheer = !!u.cheer && !d.structure;
  const beat = now / 170 + u.id;
  const y = u.y + bob + Math.sin(u.aim) * push + hover - (cheer ? Math.abs(Math.sin(beat)) * 9 : 0);

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
  c.save();
  c.translate(x, y);
  if (cheer) c.rotate(Math.sin(beat) * 0.12);
  drawSprite(c, u.type, u.team, 0, 0, s, u.face, {
    walk: u.walk, moving: u.moving, aim: aimL, rec: u.recoil, atk: u.atk,
    muzzle: u.muzzle > 0, t: now / 1000 + u.id,
  });
  c.restore();
  if (cheer) {
    for (let i = 0; i < 3; i++) {
      const a = beat * 0.7 + i * 2.1;
      c.fillStyle = ['#ffd94d', '#ff8c42', '#3e7bfa'][i];
      c.beginPath();
      c.arc(u.x + Math.cos(a) * u.r * 1.5, y - u.r * 2.6 + Math.sin(a * 1.3) * 3, 2.2, 0, TAU);
      c.fill();
    }
  }

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

export function render(c, world, cur, now) {
  drawField(c, world.W, world.H, world);
  c.save();
  if (world.shake > 0.2) {
    c.translate((Math.random() - 0.5) * world.shake, (Math.random() - 0.5) * world.shake);
  }
  for (const m of world.traps) drawSprite(c, m.type, m.team, m.x, m.y, m.r / 11, 1, { t: now / 1000 + m.id });
  for (const u of [...world.units].sort((p, q) => p.y - q.y)) drawUnit(c, u, now, world.teamMode);
  for (const g of world.ghosts) drawGhost(c, g, now);
  for (const s of world.shots) drawShot(c, s);
  for (const p of world.parts) drawPart(c, p);
  c.restore();
  if (cur) drawCursor(c, cur, world, now);
}
