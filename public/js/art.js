// art.js: how each unit is drawn. Each drawer paints in local space: the origin
// is the unit's centre, the figure is about 36 units wide, and it faces +x.
// render.js scales the figure and mirrors it for left-facing units.

export const PAL = {
  red: { b: '#ef5b4d', d: '#b5382d', l: '#ffb4a9' },
  blue: { b: '#4d8ef2', d: '#2f62b5', l: '#b3d1ff' },
  green: { b: '#43b76a', d: '#2a7d43', l: '#b2e8c2' },
};

const INK = '#1c1f24';
const SKIN = '#f2c79b';
const TAU = Math.PI * 2;

/* ---------- drawing primitives ---------- */

const trace = (c, pts, closed) => {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  if (closed) c.closePath();
};
const paint = (c, fill, lw = 1.3) => {
  c.fillStyle = fill;
  c.fill();
  c.lineWidth = lw;
  c.strokeStyle = INK;
  c.stroke();
};
const poly = (c, pts, fill, lw) => { trace(c, pts, true); paint(c, fill, lw); };
const oval = (c, x, y, rx, ry, fill, rot = 0) => {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, TAU);
  paint(c, fill);
};
const box = (c, x, y, w, h, r, fill) => { c.beginPath(); c.roundRect(x, y, w, h, r); paint(c, fill); };
const cap = (c, x, y, r, a0, a1, fill) => { c.beginPath(); c.arc(x, y, r, a0, a1); c.closePath(); paint(c, fill); };
const line = (c, pts, col, w) => {
  trace(c, pts, false);
  c.strokeStyle = col;
  c.lineWidth = w;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.stroke();
};
const limb = (c, pts, col, w) => { line(c, pts, INK, w + 1.6); line(c, pts, col, w); };
const dot = (c, x, y, r, col = INK) => {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fillStyle = col;
  c.fill();
};
const face = (c, x = 0.6, y = -13) => { oval(c, x, y, 5.1, 5.3, SKIN); dot(c, x + 2.6, y + 0.6, 1.1); };

/* Two-bone solve: the joint between a and b bends by l1 and l2; bend picks the side. */
const ik2 = (a, b, l1, l2, bend) => {
  let dx = b[0] - a[0], dy = b[1] - a[1];
  let d = Math.hypot(dx, dy) || 1e-6;
  const max = l1 + l2 - 0.01;
  if (d > max) { const k = max / d; dx *= k; dy *= k; d = max; }
  d = Math.max(d, Math.abs(l1 - l2) + 0.01);
  const ang = Math.atan2(dy, dx);
  const A = Math.acos(Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  return {
    e: [a[0] + Math.cos(ang + bend * A) * l1, a[1] + Math.sin(ang + bend * A) * l1],
    end: [a[0] + Math.cos(ang) * d, a[1] + Math.sin(ang) * d],
  };
};
/* Point (lx, ly) in a frame at origin o, rotated by angle a. */
const pt = (o, lx, ly, a) => [o[0] + lx * Math.cos(a) - ly * Math.sin(a), o[1] + lx * Math.sin(a) + ly * Math.cos(a)];

/* ---------- shared parts ---------- */

function legs(c, a, col) {
  const sw = a.moving ? Math.sin(a.walk) * 0.5 : 0;
  for (const [hx, s] of [[-2.4, sw], [2.4, -sw]]) {
    const fx = hx + Math.sin(s) * 8 + 2;
    limb(c, [[hx, 3], [fx, 13.5]], col, 3.6);
    box(c, fx - 3.6, 12.8, 8, 3.4, 1.5, '#262a31');
  }
}

function torso(c, T) {
  box(c, -6.5, -10.5, 13, 15.5, 4.5, T.b);
  box(c, -6.5, -3.6, 13, 2.6, 1, T.d);
}

/* A rifle held at the shoulder, rotated to the aim angle. */
function gunAt(c, a, T, len, scope) {
  c.save();
  c.translate(1.5, -6);
  c.rotate(a.aim);
  c.translate(-(a.rec || 0) * 2, 0);
  limb(c, [[-1, 0], [5, 0.6]], T.d, 3.4);
  line(c, [[-4.5, 1.5], [1, 0.4]], '#7a4e26', 3.8);
  limb(c, [[1, 0], [len, -0.2]], '#3e434b', 2.8);
  box(c, 5, -3.2, 4.5, 3, 1, '#2a2e35');
  if (scope) box(c, 6, -6.3, 9, 2.6, 1.2, '#23262c');
  if (a.muzzle) {
    c.beginPath();
    c.ellipse(len + 2, 0, 4, 2.2, 0, 0, TAU);
    c.fillStyle = '#ffe27a';
    c.fill();
  }
  c.restore();
}

/* ---------- the characters ---------- */

export const ART = {
  soldier(c, T, a) {
    const th = a.moving ? a.walk : 0;
    const hips = { L: [-2.4, 3], R: [2.4, 3] };
    const feet = {
      L: [hips.L[0] + 2 + Math.sin(th) * 3.6, 13.5 - Math.max(0, Math.cos(th)) * 2.6],
      R: [hips.R[0] + 2 + Math.sin(th + Math.PI) * 3.6, 13.5 - Math.max(0, -Math.cos(th)) * 2.6],
    };
    for (const [side, col] of [['R', '#2f343c'], ['L', '#3b4048']]) {
      const { e, end } = ik2(hips[side], feet[side], 6, 6, -1);
      limb(c, [hips[side], e, end], col, 3.6);
      box(c, end[0] - 3.6, end[1] - 0.7, 8, 3.4, 1.5, '#262a31');
    }

    const aim = a.aim || 0, rec = a.rec || 0;
    const O = [1.5 - 2 * rec * Math.cos(aim), -6 - 2 * rec * Math.sin(aim)];
    const rear = pt(O, 0.2, 1, aim), fore = pt(O, 6.2, 0.8, aim);
    const shF = [3.2, -8.2], shR = [-2.4, -8.4];
    const armR = ik2(shR, rear, 5.6, 5.4, 1), armF = ik2(shF, fore, 5.6, 5.4, 1);
    limb(c, [shR, armR.e, armR.end], T.d, 3);

    torso(c, T);
    face(c);
    cap(c, 0.6, -14.5, 6, Math.PI, 0, T.d); // helmet

    c.save();
    c.translate(O[0], O[1]);
    c.rotate(aim);
    limb(c, [[-1, 0], [5, 0.6]], T.d, 3.4);
    line(c, [[-4.5, 1.5], [1, 0.4]], '#7a4e26', 3.8);
    limb(c, [[1, 0], [17, -0.2]], '#3e434b', 2.8);
    box(c, 5, -3.2, 4.5, 3, 1, '#2a2e35');
    if (a.muzzle) { // firing: flash and sparks at the muzzle
      c.beginPath();
      c.ellipse(19, -0.2, 4, 2.2, 0, 0, TAU);
      c.fillStyle = '#ffe27a';
      c.fill();
      line(c, [[21, -2.6], [24.5, -4.4]], '#ffe27a', 1);
      line(c, [[21, 2.2], [24.5, 3.8]], '#ffe27a', 1);
    }
    c.restore();

    limb(c, [shF, armF.e, armF.end], T.d, 3);
    dot(c, armF.end[0], armF.end[1], 1.6, SKIN);
    dot(c, armR.end[0], armR.end[1], 1.6, SKIN);
  },

  sniper(c, T, a) {
    legs(c, a, '#3b4048');
    torso(c, T);
    face(c);
    oval(c, 0.6, -18.2, 9.2, 2.3, '#5d6b3c'); // boonie hat brim
    cap(c, 0.6, -18.2, 5.4, Math.PI, 0, '#5d6b3c');
    gunAt(c, a, T, 28, true);
  },

  archer(c, T, a) {
    legs(c, a, '#5a4632');
    poly(c, [[-6, -9], [-7.5, -15], [-1.5, -21.5], [4.5, -18.5], [5.5, -10]], '#3f7a37'); // hood
    torso(c, T);
    face(c);
    c.save();
    c.translate(1.5, -6);
    c.rotate(a.aim);
    const pull = (a.atk || 0) * 3;
    limb(c, [[-1, 0], [5, 0.6]], T.d, 3.4);
    c.beginPath();
    c.arc(4, 0, 9, -1.15, 1.15);
    c.strokeStyle = INK;
    c.lineWidth = 3.8;
    c.lineCap = 'round';
    c.stroke();
    c.strokeStyle = '#8a5a2b';
    c.lineWidth = 2.2;
    c.stroke();
    line(c, [[7.7, -8.2], [4 - pull, 0], [7.7, 8.2]], '#ece6d6', 0.8);
    line(c, [[4 - pull, 0], [16, 0]], '#d7dde6', 1.2);
    poly(c, [[16, 0], [12.5, -2], [12.5, 2]], '#d7dde6', 1);
    c.restore();
  },

  cavalry(c, T, a) {
    const g = a.moving ? Math.sin(a.walk) * 0.45 : 0;
    const horse = '#a86f3f';
    for (const [x, k] of [[-12, g], [-7, -g], [7, -g], [11, g]]) {
      limb(c, [[x, 4], [x + Math.sin(k) * 5, 15]], '#6b4324', 3.2);
    }
    line(c, [[-14, -1], [-19, 3], [-21, 9]], '#3a2412', 2.4); // tail
    oval(c, 0, 2, 15, 7.5, horse);
    limb(c, [[9, -2], [15, -10]], horse, 7); // neck
    poly(c, [[16, -15], [17.5, -20], [19.5, -14.5]], horse, 1.1); // ear
    oval(c, 18.5, -11.5, 5.5, 3.8, horse, 0.5);
    dot(c, 20.5, -12.5, 0.9);
    box(c, -7, -5, 13, 5, 1.5, T.d); // saddle cloth
    box(c, -5, -15.5, 10, 11, 3.5, T.b); // rider
    oval(c, -0.4, -19, 4.2, 4.4, SKIN);
    cap(c, -0.4, -19.6, 4.9, Math.PI, 0, T.d);
    const t = (a.atk || 0) * 6;
    limb(c, [[3, -11], [27 + t, -12.5]], '#8a5a2b', 2.2); // lance
    poly(c, [[27 + t, -12.5], [34 + t, -13.4], [27 + t, -10.8]], '#d7dde6', 1);
    poly(c, [[12 + t, -11.6], [19 + t, -9.6], [12 + t, -7.6]], T.b, 1); // pennant
  },

  boar(c, T, a) {
    const g = a.moving ? Math.sin(a.walk) * 1.2 : 0;
    for (const [x, k] of [[-9, g], [-3, -g], [6, -g], [11, g]]) limb(c, [[x, 4], [x + k, 13]], T.d, 3.4);
    for (let i = 0; i < 5; i++) {
      const x = -10 + i * 4.5;
      poly(c, [[x, -6], [x + 2.4, -13], [x + 4.8, -6]], T.d, 1.1); // bristles
    }
    oval(c, 0, 1, 14.5, 9, T.b);
    oval(c, 14, 4, 6.5, 5.5, T.b);
    box(c, 17.5, 1, 4.5, 6, 2, T.l); // snout
    poly(c, [[11, 6.5], [14.5, 13.5], [10, 8]], '#fdfdf4', 1); // tusk
    dot(c, 10.5, -1.5, 1.1);
    poly(c, [[6, -6], [9, -10.5], [11, -5.5]], T.d, 1.1); // ear
  },

  snake(c, T, a) {
    const pts = [];
    for (let i = 0; i <= 14; i++) pts.push([-19 + i * 2.8, Math.sin(i * 0.75 - (a.t || 0) * 3) * 3.4]);
    line(c, pts, INK, 8.4);
    line(c, pts, T.b, 5.8);
    line(c, pts.map(([x, y]) => [x, y - 1.7]), T.l, 1.2);
    const [hx, hy] = pts[pts.length - 1];
    oval(c, hx + 2, hy, 5.2, 4.2, T.b);
    dot(c, hx + 3.4, hy - 1.6, 1.4, '#ffffff');
    dot(c, hx + 3.9, hy - 1.6, 0.7);
    line(c, [[hx + 6.5, hy + 1], [hx + 10, hy + 1], [hx + 11.8, hy - 0.2]], '#e5484d', 1.1);
    line(c, [[hx + 10, hy + 1], [hx + 11.8, hy + 2.4]], '#e5484d', 1.1);
  },

  ant(c, T, a) {
    for (const side of [-1, 1]) {
      for (let i = -1; i <= 1; i++) {
        const x = -1 + i * 4;
        const ph = a.moving ? Math.sin(a.walk + i * 2 + (side > 0 ? Math.PI : 0)) * 1.8 : 0;
        line(c, [[x, side], [x + ph, side * 7], [x - 4, side * 9]], INK, 1.6);
      }
    }
    oval(c, -8, 0.5, 6, 5, T.b); // abdomen
    oval(c, -1, 0, 4, 3.6, T.d); // thorax
    oval(c, 8.5, -0.5, 4.2, 3.8, T.d); // head
    line(c, [[10, -2], [13, -7], [17, -7]], INK, 1);
    line(c, [[10, 1], [13, 6], [17, 6]], INK, 1);
    dot(c, 10.5, -1.5, 1);
  },

  zombie(c, T, a) {
    const k = a.moving ? Math.sin(a.walk) * 0.2 : 0;
    legs(c, a, '#3c4a2a');
    poly(c, [[-6.5, -10], [6.5, -10], [6, 5], [1, 3], [-2.5, 6], [-6.5, 4]], T.b); // torn shirt
    limb(c, [[1, -7], [11, -6 + k * 10]], '#8fbf63', 3.2);
    limb(c, [[-1, -7], [9, -3 - k * 10]], '#78aa52', 3.2);
    oval(c, 0.5, -13.5, 5.6, 5.6, '#9ccc70');
    line(c, [[1.5, -15.6], [4, -13]], INK, 1.1); // X eyes
    line(c, [[4, -15.6], [1.5, -13]], INK, 1.1);
    line(c, [[-1, -10], [1, -9], [3, -10], [4.5, -9]], INK, 1);
  },

  mage(c, T, a) {
    poly(c, [[-5, -9], [5, -9], [9.5, 8], [-9.5, 8]], T.b); // robe
    line(c, [[-8.5, 1.5], [8.5, 1.5]], T.d, 1.8);
    oval(c, 0.5, -12.5, 4.6, 4.8, SKIN);
    dot(c, 2.5, -12, 1);
    poly(c, [[-3.5, -9], [3.5, -9], [0, -2.5]], '#f4f4f4', 1); // beard
    poly(c, [[-8, -14], [8, -14], [1, -34]], T.d); // hat
    oval(c, 0, -14, 9, 2.4, T.d);
    dot(c, -1.5, -22, 1.2, '#ffd94d');
    dot(c, 3, -27, 1, '#ffd94d');
    c.save();
    c.translate(3, -4);
    c.rotate(a.aim);
    limb(c, [[0, 0], [5, 0.5]], T.b, 3.2);
    line(c, [[3, 0], [15, 0]], '#7a4a21', 2.2); // staff
    c.beginPath();
    c.arc(15, 0, 6.5, 0, TAU);
    c.fillStyle = 'rgba(199,125,255,0.35)';
    c.fill();
    oval(c, 15, 0, 3.6, 3.6, '#c77dff');
    c.restore();
  },

  dragon(c, T, a) {
    const flap = Math.sin((a.t || 0) * 9) * 5;
    poly(c, [[-3, -3], [-14, -24 - flap], [-9, -16 - flap * 0.4], [-18, -18 - flap * 0.6], [-4, 2]], T.d); // far wing
    limb(c, [[-12, 2], [-20, 6], [-26, 3], [-29, -3]], T.b, 3.4); // tail
    poly(c, [[-28, -3], [-37, -8], [-33, -1], [-37, 1], [-28, 1]], T.b, 1.1);
    limb(c, [[-5, 7], [-7, 13]], T.d, 3.2);
    limb(c, [[4, 7], [6, 13]], T.d, 3.2);
    oval(c, 0, 2, 14, 8, T.b);
    oval(c, 2, 6, 9, 3.4, T.l);
    poly(c, [[-1, -4], [-6, -27 + flap], [-1, -18 + flap * 0.4], [5, -24 + flap], [7, -3]], T.l); // near wing
    limb(c, [[8, -2], [15, -8]], T.b, 7); // neck
    poly(c, [[14, -13], [12, -21], [18, -15]], '#f2e3c6', 1); // horn
    oval(c, 19, -10, 7, 5, T.b);
    poly(c, [[24, -12], [31, -9], [24, -7.5]], T.b); // snout
    dot(c, 21, -12, 1.8, '#ffffff');
    dot(c, 21.6, -12, 1);
    if (a.atk > 0) { // breath
      c.beginPath();
      c.ellipse(36, -9, 6 + a.atk * 4, 3.4, 0, 0, TAU);
      c.fillStyle = '#ff8c42';
      c.fill();
      c.beginPath();
      c.ellipse(33, -9, 4, 2, 0, 0, TAU);
      c.fillStyle = '#fff3b0';
      c.fill();
    }
  },

  wall(c) {
    box(c, -13, -11, 26, 22, 2.5, '#b4634a');
    const m = '#6b2f1f';
    line(c, [[-13, -3.7], [13, -3.7]], m, 1.3);
    line(c, [[-13, 3.7], [13, 3.7]], m, 1.3);
    for (const [x, y1, y2] of [
      [-4, -11, -3.7], [6, -11, -3.7], [-9, -3.7, 3.7], [1, -3.7, 3.7],
      [11, -3.7, 3.7], [-4, 3.7, 11], [6, 3.7, 11],
    ]) {
      line(c, [[x, y1], [x, y2]], m, 1.3);
    }
  },

  mine(c, T, a) {
    for (let i = 0; i < 8; i++) {
      const an = (i * Math.PI) / 4;
      line(c, [[Math.cos(an) * 7, Math.sin(an) * 7], [Math.cos(an) * 11, Math.sin(an) * 11]], INK, 2.6);
    }
    oval(c, 0, 0, 7.5, 7.5, '#4a4f58');
    dot(c, -2.5, -2.5, 1.8, 'rgba(255,255,255,0.35)');
    dot(c, 0, 0, 2.6, Math.sin((a.t || 0) * 6) > 0 ? '#ff3b30' : '#7a2420'); // blinking light
  },
};
