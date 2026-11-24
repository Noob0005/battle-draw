// sim.js: battle rules and unit AI. Pure JavaScript with no DOM access.
//
// There is no automatic winner. Units keep fighting (or celebrating) until the
// player calls finish(), which ranks the groups by fighter count, then by total
// health. A group is a unit type in free-for-all, or a team in team modes.
import { UNITS } from './units.js';

const HP_SCALE = 2.8; // HP goes up and damage down so fights last
const DMG_SCALE = 0.62;
const MAX_ENTITIES = 700;
const SOFT = { red: '#ffa39b', green: '#a6e6bb', blue: '#a9ccff' };
const FFA_TEAM = Object.fromEntries(Object.keys(UNITS).map((k, i) => [k, i % 2 ? 'red' : 'blue']));

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const angleDiff = (a, b) => {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};
const dmgOf = (def) => def.dmg * DMG_SCALE;
export const typeTeam = (type) => FFA_TEAM[type];
let seq = 1;

export class World {
  constructor() {
    this.W = 800;
    this.H = 600;
    this.mode = 'ffa';
    this.reset();
  }

  get teamMode() { return this.mode !== 'ffa'; }
  get count() { return this.units.length + this.traps.length; }

  setSize(w, h) {
    this.W = Math.max(300, w);
    this.H = Math.max(300, h);
    for (const u of this.units) {
      u.x = clamp(u.x, u.r, this.W - u.r);
      u.y = clamp(u.y, u.r, this.H - u.r);
    }
  }

  setMode(mode) { this.mode = mode; this.reset(); }

  reset() {
    Object.assign(this, {
      units: [], traps: [], shots: [], parts: [], ghosts: [], kills: [], sounds: [],
      time: 0, shake: 0, paused: false, over: null,
    });
  }

  teamOf(x, type) {
    if (this.mode === 'teams2') return x < this.W / 2 ? 'red' : 'blue';
    if (this.mode === 'teams3') return x < this.W / 3 ? 'red' : x < (this.W * 2) / 3 ? 'green' : 'blue';
    return FFA_TEAM[type];
  }

  activeTeams() { return this.mode === 'teams3' ? ['red', 'green', 'blue'] : ['red', 'blue']; }
  foe(a, b) { return this.teamMode ? a.team !== b.team : a.type !== b.type; }
  fighters() { return this.units.filter((u) => !u.dead && !u.def.structure); }
  teamAlive(t) { return this.fighters().filter((u) => u.team === t).length; }
  groupOf(u) { return this.teamMode ? u.team : u.type; }

  /* ---------- placing and editing ---------- */

  add(type, team, x, y) {
    const def = UNITS[type], id = seq++;
    if (def.trap) {
      const m = { id, type, def, team, x, y, r: def.r };
      this.traps.push(m);
      return m;
    }
    const hp = Math.round(def.hp * HP_SCALE);
    const u = {
      id, type, def, team, x, y, r: def.r, hp, maxHp: hp, dead: false,
      face: team === 'red' ? -1 : 1, aim: team === 'red' ? Math.PI : 0,
      cd: rand(0, 0.2), retarget: Math.random() * 0.15, target: null,
      walk: rand(0, 6), bob: rand(0, 6), moving: false, cheer: false,
      atk: 0, recoil: 0, lunge: 0, flash: 0, muzzle: 0, poison: 0,
      charged: !!def.charge,
    };
    this.units.push(u);
    return u;
  }

  /* Deploy one unit from the brush. Deploying after a finished battle starts a new one.
     Returns false when the field is full. */
  paint(type, x, y, jitter) {
    if (this.count >= MAX_ENTITIES) return false;
    if (this.over) this.resume();
    const def = UNITS[type], j = def.structure || def.trap ? 0 : jitter;
    this.add(
      type,
      this.teamOf(x, type),
      clamp(x + rand(-j, j), 14, this.W - 14),
      clamp(y + rand(-j, j), 14, this.H - 14),
    );
    return true;
  }

  resume() { Object.assign(this, { over: null, paused: false, time: 0, kills: [] }); }

  erase(x, y, rad) {
    const near = (o) => (o.x - x) ** 2 + (o.y - y) ** 2 < rad * rad;
    this.units = this.units.filter((u) => !near(u));
    this.traps = this.traps.filter((m) => !near(m));
  }

  snapshot() {
    const pack = (list) => list.map((o) => [o.type, o.team, Math.round(o.x), Math.round(o.y)]);
    return JSON.stringify({ units: pack(this.units), traps: pack(this.traps) });
  }

  load(json) {
    const d = JSON.parse(json);
    Object.assign(this, { units: [], traps: [], shots: [], parts: [], ghosts: [], over: null, paused: false });
    for (const [t, tm, x, y] of [...d.units, ...d.traps]) this.add(t, tm, x, y);
  }

  /* ---------- battle flow ---------- */

  togglePause() { if (!this.over) this.paused = !this.paused; }
  drainSounds() { const s = this.sounds; this.sounds = []; return s; }

  update(dt) {
    this.shake = Math.max(0, this.shake - dt * 26);

    for (const p of this.parts) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'spark') p.vy += 260 * dt;
      if (p.kind === 'smoke') { p.vy -= 18 * dt; p.size += 9 * dt; }
    }
    this.parts = this.parts.filter((p) => p.t < p.life);
    for (const g of this.ghosts) g.t += dt;
    this.ghosts = this.ghosts.filter((g) => g.t < g.life);

    if (this.paused || this.over) {
      for (const u of this.units) u.bob += dt * 2.2;
      return;
    }
    this.time += dt;
    for (const u of this.units) if (!u.dead) this.think(u, dt);
    this.updateShots(dt);
    this.updateTraps();
    this.units = this.units.filter((u) => !u.dead);
  }

  /* Every group with fighters on the field, strongest first: most fighters, then most total health. */
  standings() {
    const rows = new Map();
    for (const u of this.fighters()) {
      const key = this.groupOf(u);
      const row = rows.get(key) || { key, count: 0, hp: 0 };
      row.count += 1;
      row.hp += Math.max(0, Math.ceil(u.hp));
      rows.set(key, row);
    }
    return [...rows.values()].sort((a, b) => b.count - a.count || b.hp - a.hp);
  }

  /* Ends the battle and returns the verdict. Only the player calls this. */
  finish() {
    const rows = this.standings();
    const [a, b] = rows;
    let verdict;
    if (!a) {
      verdict = { kind: 'draw', reason: 'empty', rows };
    } else {
      const tied = rows.filter((r) => r.count === a.count && r.hp === a.hp);
      if (tied.length > 1) {
        verdict = { kind: 'draw', reason: 'equal', rows, tied: tied.map((r) => r.key), count: a.count, hp: a.hp };
      } else if (!b) {
        verdict = { kind: 'win', reason: 'alone', winner: a.key, rows };
      } else if (a.count !== b.count) {
        verdict = { kind: 'win', reason: 'count', winner: a.key, rows };
      } else {
        verdict = { kind: 'win', reason: 'health', winner: a.key, rows };
      }
    }
    Object.assign(this, { over: verdict, paused: false });
    this.sounds.push(verdict.kind === 'win' ? 'win' : 'die');
    return verdict;
  }

  /* ---------- unit AI ---------- */

  think(u, dt) {
    const d = u.def;
    u.cd -= dt;
    u.flash -= dt;
    u.lunge -= dt;
    u.muzzle -= dt;
    u.recoil = Math.max(0, u.recoil - dt * 6.5);
    u.atk = Math.max(0, u.atk - dt * 3.1);
    u.bob += dt * (u.moving ? 11 : 2.2);
    u.moving = false;

    if (u.poison > 0) {
      u.poison -= dt;
      this.hurt(u, 1.7 * dt, null);
      if (u.dead) return;
    }
    if (d.structure) return;

    u.retarget -= dt;
    if (u.retarget <= 0 || !u.target || u.target.dead) {
      u.retarget = 0.13 + Math.random() * 0.06;
      u.target = this.nearestFoe(u);
    }
    const t = u.target;
    u.cheer = !t; // no rivals left on the field: celebrate until one is deployed
    if (!t) return;

    u.aim += angleDiff(Math.atan2(t.y - u.y, t.x - u.x), u.aim) * Math.min(1, dt * 14);
    u.face = Math.cos(u.aim) < 0 ? -1 : 1;

    const dist = Math.hypot(t.x - u.x, t.y - u.y);
    if (dist > d.range + t.r * 0.55 || (d.proj && !d.fly && this.blocked(u, t))) {
      this.step(u, t, dt);
    } else if (u.cd <= 0) {
      u.cd = d.atk * rand(0.9, 1.1);
      if (d.proj) this.shoot(u, t);
      else this.strike(u, t);
    }
  }

  nearestFoe(u) {
    let best = null, bd = Infinity;
    for (const o of this.units) {
      if (o.dead || o === u || o.def.structure || !this.foe(u, o)) continue;
      const d2 = (o.x - u.x) ** 2 + (o.y - u.y) ** 2;
      if (d2 < bd) { bd = d2; best = o; }
    }
    return best;
  }

  /* Is the line from a to b cut by a wall? */
  blocked(a, b) {
    const vx = b.x - a.x, vy = b.y - a.y, L2 = vx * vx + vy * vy || 1;
    for (const w of this.units) {
      if (w.dead || !w.def.structure) continue;
      const k = clamp(((w.x - a.x) * vx + (w.y - a.y) * vy) / L2, 0, 1);
      if (Math.hypot(w.x - (a.x + vx * k), w.y - (a.y + vy * k)) < w.r * 0.9) return true;
    }
    return false;
  }

  step(u, t, dt) {
    const spd = u.def.speed;
    u.moving = true;
    u.walk += dt * (11 + spd * 0.11);
    const ang = Math.atan2(t.y - u.y, t.x - u.x);
    let mx = Math.cos(ang) * spd * dt, my = Math.sin(ang) * spd * dt;

    for (const o of this.units) {
      if (o === u || o.dead) continue;
      const dx = u.x - o.x, dy = u.y - o.y, dd = Math.hypot(dx, dy), gap = u.r + o.r + 1;
      if (dd > 0.01 && dd < gap) {
        const push = ((gap - dd) / gap) * 46 * dt;
        mx += (dx / dd) * push;
        my += (dy / dd) * push;
        if (o.def.structure && !u.def.fly) {
          mx += (dx / dd) * spd * dt * 0.9;
          my += (dy / dd) * spd * dt * 0.9;
        }
      }
    }
    u.x = clamp(u.x + mx, u.r, this.W - u.r);
    u.y = clamp(u.y + my, u.r, this.H - u.r);

    if (!u.def.fly && Math.random() < dt * 5) {
      this.parts.push({
        kind: 'smoke', x: u.x, y: u.y + u.r * 0.8, vx: rand(-8, 8), vy: -6,
        t: 0, life: 0.5, size: 2.2, col: 'rgba(120,120,120,0.35)',
      });
    }
  }

  strike(u, t) {
    const mult = u.charged ? 2 : 1;
    Object.assign(u, { atk: 1, recoil: 1, lunge: 0.14, charged: false });
    this.hurt(t, dmgOf(u.def) * mult, u);
    if (u.def.poison && !t.dead) t.poison = 3;
    this.burst((u.x + t.x) / 2, (u.y + t.y) / 2 - 3, '#ffe9a0', 5, 110);
    this.sounds.push('hit');
  }

  shoot(u, t) {
    const d = u.def, ang = Math.atan2(t.y - u.y, t.x - u.x), mult = u.charged ? 2 : 1;
    Object.assign(u, { aim: ang, atk: 1, recoil: 1, muzzle: 0.09, charged: false });
    this.shots.push({
      type: u.type, from: u, col: d.col || '#ffffff', splash: d.splash || 0, t: 0,
      x: u.x + Math.cos(ang) * (u.r + 8),
      y: u.y - 2 + Math.sin(ang) * (u.r + 8),
      vx: Math.cos(ang) * d.proj, vy: Math.sin(ang) * d.proj,
      dmg: dmgOf(d) * mult,
    });
    this.sounds.push(u.type === 'archer' ? 'arrow' : 'shoot');
  }

  updateShots(dt) {
    for (const s of this.shots) {
      s.t += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.t > 2.2 || s.x < -30 || s.x > this.W + 30 || s.y < -30 || s.y > this.H + 30) {
        s.dead = true;
        continue;
      }
      if (Math.random() < 0.5) {
        this.parts.push({ kind: 'spark', x: s.x, y: s.y, vx: 0, vy: 0, t: 0, life: 0.12, size: 1.6, col: s.col });
      }
      if (this.units.some((w) => !w.dead && w.def.structure && Math.hypot(w.x - s.x, w.y - s.y) < w.r)) {
        s.dead = true;
        this.burst(s.x, s.y, '#cccccc', 3, 60);
        continue;
      }
      const hit = this.units.find((o) =>
        !o.dead && !o.def.structure && this.foe(s.from, o) && Math.hypot(o.x - s.x, o.y - s.y) < o.r + 3);
      if (!hit) continue;
      s.dead = true;
      if (s.splash) {
        this.explode(s.x, s.y, s.splash, s.dmg, s.from);
      } else {
        this.hurt(hit, s.dmg, s.from);
        this.burst(s.x, s.y, s.col, 4, 90);
        this.sounds.push('hit');
      }
    }
    this.shots = this.shots.filter((s) => !s.dead);
  }

  updateTraps() {
    for (const m of this.traps) {
      for (const u of this.units) {
        if (u.dead || u.def.fly || u.def.structure) continue;
        if (this.teamMode && u.team === m.team) continue;
        if (Math.hypot(u.x - m.x, u.y - m.y) < 26 + u.r) {
          m.dead = true;
          this.explode(m.x, m.y, 54, dmgOf(m.def), m);
          break;
        }
      }
    }
    this.traps = this.traps.filter((m) => !m.dead);
  }

  /* Damage is applied silently: no numbers are produced, only HP bars and flashes. */
  hurt(u, amt, killer) {
    if (!u || u.dead) return;
    u.hp -= amt;
    u.flash = 0.09;
    if (u.hp > 0) return;
    u.dead = true;
    this.kills.push({
      t: this.time, team: killer?.team ?? null, type: killer?.type ?? null, victim: u.type,
    });
    this.ghosts.push({
      type: u.type, team: u.team, x: u.x, y: u.y, r: u.r, face: u.face, aim: u.aim, t: 0, life: 0.55,
    });
    this.burst(u.x, u.y, SOFT[u.team], 10, 120);
    this.sounds.push('die');
  }

  explode(x, y, radius, dmg, src) {
    this.parts.push({ kind: 'ring', x, y, vx: 0, vy: 0, t: 0, life: 0.4, size: radius, col: '#ffb020' });
    this.burst(x, y, '#ffb020', 18, 220);
    this.burst(x, y, '#8a8f96', 6, 90, 'smoke');
    this.shake = Math.min(11, Math.max(this.shake, radius * 0.14));
    this.sounds.push('boom');
    for (const o of this.units) {
      if (o.dead || o === src || !this.foe(src, o)) continue;
      const d = Math.hypot(o.x - x, o.y - y);
      if (d < radius + o.r) this.hurt(o, dmg * (1 - (d / (radius + o.r)) * 0.5), src);
    }
  }

  burst(x, y, col, n, spd, kind = 'spark') {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = rand(spd * 0.3, spd);
      this.parts.push({
        kind, x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - (kind === 'spark' ? 20 : 0),
        t: 0, life: rand(0.25, 0.55),
        size: kind === 'smoke' ? rand(4, 7) : rand(1.6, 3),
        col,
      });
    }
  }
}
