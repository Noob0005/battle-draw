// =============================================================================
// Army characters (fixed version)
// Expects the game's existing helpers: paint(c, fill, lw), poly(c, pts, fill, lw),
// oval(c, x, y, rx, ry, fill, rot), box(c, x, y, w, h, r, fill),
// line(c, pts, colour, width), dot(c, x, y, r, colour), ik2(a, b, l1, l2, bend),
// pt(origin, lx, ly, angle), INK, SKIN, TAU
//
// Changes from the previous version:
//  - Standing legs are straight. The hip height is solved from the ankle position,
//    so a planted leg always has its full length.
//  - Stance feet roll back at constant speed (no sliding at the ends of a step).
//  - One shared leg function (drawBootLeg) is used by all six units.
// =============================================================================

const LEG_L1 = 5.7, LEG_L2 = 5.8, LEG_REACH = LEG_L1 + LEG_L2;
// Hips stay fixed. The foot moves +/- WALK_STRIDE around the hip, and the knee bends
// to follow it. Standing legs sit at full stretch (straight). Tune WALK_STRIDE for more
// or less walk: larger means more stride and a deeper knee bend mid-step.
const WALK_STRIDE = 2.6;
// Vertical hip-to-ankle distance. Close to full reach, so the knee bends only about
// 8 degrees mid-step. The stride ends sit a fraction of a unit past reach and are clamped.
const HIP_DROP = 11.47;

/**
 * Knee position for a hip -> ankle pair. Always solvable: reach is clamped,
 * so a fully extended leg comes out straight and never produces NaN.
 */
function legKnee(hip, foot, bend) {
  const dx = foot[0] - hip[0], dy = foot[1] - hip[1];
  const len = Math.hypot(dx, dy) || 1e-6;
  const ux = dx / len, uy = dy / len;
  const d = Math.min(len, LEG_REACH * 0.9999);
  const a = (LEG_L1 * LEG_L1 - LEG_L2 * LEG_L2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, LEG_L1 * LEG_L1 - a * a));
  return [hip[0] + ux * a - uy * h * bend, hip[1] + uy * a + ux * h * bend];
}

/**
 * Draws a tapered clothed limb segment with an optional directional rim highlight.
 */
function drawSeg(c, p1, p2, w1, w2, fill, hi) {
  const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  poly(c, [
    [p1[0] + nx * w1, p1[1] + ny * w1],
    [p2[0] + nx * w2, p2[1] + ny * w2],
    [p2[0] - nx * w2, p2[1] - ny * w2],
    [p1[0] - nx * w1, p1[1] - ny * w1]
  ], fill, 1.15);
  if (hi) {
    line(c, [
      [p1[0] + nx * (w1 * 0.55), p1[1] + ny * (w1 * 0.55)],
      [p2[0] + nx * (w2 * 0.55), p2[1] + ny * (w2 * 0.55)]
    ], hi, 0.75);
  }
}

/**
 * Shared tactical leg: trouser leg, thigh pocket, knee pad, and a combat boot that
 * pitches with the stride. `idleX` is the standing foot x position.
 * The hip y argument is ignored: hip height is solved from the foot so the leg
 * stays straight while planted.
 */
function drawBootLeg(c, hip, phase, mv, idleX, col, pocketCol, bootCol, hiCol, bulk = 1) {
  // ---- Foot path -----------------------------------------------------------
  const stride = WALK_STRIDE;
  const side = idleX >= hip[0] ? 1 : -1;   // standing foot sits on this side of the hip
  let off = side * WALK_STRIDE, lift = 0, rot = 0;
  if (mv) {
    // th runs from -PI to PI. Swing while the foot is ahead of the hip (cos > 0).
    const th = (((phase + Math.PI) % TAU) + TAU) % TAU - Math.PI;
    if (Math.cos(th) > 0) {
      // Swing: foot travels from behind the hip to in front of it, lifted.
      const t = (th + Math.PI / 2) / Math.PI;               // 0..1
      off = -stride * Math.cos(Math.PI * t);
      lift = 1.4 * Math.sin(Math.PI * t);   // low clearance keeps the thigh swing natural
      rot = 0.25 * (1 - t) - 0.1 * Math.sin(Math.PI * t);   // toe-off to heel-strike
    } else {
      // Stance: foot rolls back at constant speed while planted.
      const tau = ((th > 0 ? th : th + TAU) - Math.PI / 2) / Math.PI;   // 0..1
      off = stride * (1 - 2 * tau);
      rot = 0.25 * Math.pow(Math.max(0, (tau - 0.6) / 0.4), 2);        // toe-off pitch
    }
  }

  const fx = hip[0] + off;
  const footY = 11.75 - lift - 3.8 * Math.max(0, rot);
  const foot = [fx, footY];

  // ---- Fixed hip: the knee does the bending. The hip never moves in height or angle
  // beyond the knee's own solve, so a planted leg is straight at the stride ends and
  // bends at the knee as the foot passes under the hip.
  const hipPt = [hip[0], 11.75 - HIP_DROP];
  const knee = legKnee(hipPt, foot, -1);

  // ---- Shin direction (foot -> knee) for boot and cuff geometry -------------
  const sdx = knee[0] - foot[0], sdy = knee[1] - foot[1];
  const slen = Math.hypot(sdx, sdy) || 1;
  const ux = sdx / slen, uy = sdy / slen;
  const px = -uy, py = ux;

  const B = (x, y) => pt(foot, x, y, rot);
  const cw = 1.35 * bulk;
  const cBack = [foot[0] + ux * 2.5 - px * cw, foot[1] + uy * 2.5 - py * cw];
  const cFront = [foot[0] + ux * 2.5 + px * cw, foot[1] + uy * 2.5 + py * cw];
  const ankleBack = [foot[0] + ux * 0.8 - px * (1.25 * bulk), foot[1] + uy * 0.8 - py * (1.25 * bulk)];
  const ankleFront = [foot[0] + ux * 0.8 + px * (1.15 * bulk), foot[1] + uy * 0.8 + py * (1.15 * bulk)];

  // ---- Boot: single outlined silhouette ------------------------------------
  c.beginPath();
  c.moveTo(cBack[0], cBack[1]);
  c.quadraticCurveTo(ankleBack[0], ankleBack[1], B(-1.8, 0.15)[0], B(-1.8, 0.15)[1]);
  c.lineTo(B(-1.85, 1.25)[0], B(-1.85, 1.25)[1]);
  c.lineTo(B(3.85, 1.25)[0], B(3.85, 1.25)[1]);
  c.quadraticCurveTo(B(4.35, 0.72)[0], B(4.35, 0.72)[1], B(3.8, 0.08)[0], B(3.8, 0.08)[1]);
  c.quadraticCurveTo(B(2.05, -0.35)[0], B(2.05, -0.35)[1], ankleFront[0], ankleFront[1]);
  c.lineTo(cFront[0], cFront[1]);
  c.closePath();
  paint(c, bootCol, 1.15);

  poly(c, [
    B(-1.95, 0.9), B(-0.15, 0.9), B(0.35, 1.05), B(3.95, 0.95),
    B(4.1, 1.38), B(0.25, 1.38), B(-0.15, 1.22), B(-1.95, 1.38)
  ], '#13171d', 0.85);
  line(c, [B(2.2, -0.05), B(3.65, 0.25)], '#5a6470', 0.65);
  line(c, [
    [foot[0] + ux * 1.55 + px * 0.55, foot[1] + uy * 1.55 + py * 0.55],
    [foot[0] + ux * 1.55 + px * 1.3, foot[1] + uy * 1.55 + py * 1.3]
  ], '#161a20', 0.7);
  line(c, [
    [foot[0] + ux * 0.75 + px * 0.65, foot[1] + uy * 0.75 + py * 0.65],
    [foot[0] + ux * 0.75 + px * 1.3, foot[1] + uy * 0.75 + py * 1.3]
  ], '#161a20', 0.7);

  // ---- Trouser leg ----------------------------------------------------------
  const calfEnd = [foot[0] + ux * 1.9, foot[1] + uy * 1.9];
  drawSeg(c, hipPt, knee, 2.3 * bulk, 1.72 * bulk, col, hiCol);
  drawSeg(c, knee, calfEnd, 1.72 * bulk, 1.46 * bulk, col, hiCol);

  const cuffTop = [foot[0] + ux * 2.85, foot[1] + uy * 2.85];
  const cuffBot = [foot[0] + ux * 1.85, foot[1] + uy * 1.85];
  poly(c, [
    [cuffTop[0] - px * 1.58 * bulk, cuffTop[1] - py * 1.58 * bulk],
    [cuffTop[0] + px * 1.62 * bulk, cuffTop[1] + py * 1.62 * bulk],
    [cuffBot[0] + px * 1.52 * bulk, cuffBot[1] + py * 1.52 * bulk],
    [cuffBot[0] - px * 1.48 * bulk, cuffBot[1] - py * 1.48 * bulk]
  ], col, 1.05);
  line(c, [
    [cuffBot[0] - px * 1.35, cuffBot[1] - py * 1.35],
    [cuffBot[0] + px * 1.35, cuffBot[1] + py * 1.35]
  ], INK, 0.75);

  if (pocketCol) {
    const tx = (hipPt[0] + knee[0]) * 0.5, ty = (hipPt[1] + knee[1]) * 0.5;
    const tang = Math.atan2(knee[1] - hipPt[1], knee[0] - hipPt[0]) - Math.PI / 2;
    const C = (x, y) => pt([tx, ty], x, y, tang);
    poly(c, [C(-1.2, -1.4), C(1.1, -1.4), C(1.0, 1.2), C(-1.2, 1.2)], pocketCol, 0.75);
  }

  oval(c, knee[0] + 0.85, knee[1], 1.4 * bulk, 1.7 * bulk, '#252a31', 0.15);
  line(c, [[knee[0] + 1.0, knee[1] - 0.7], [knee[0] + 1.3, knee[1] + 0.6]], '#4a5360', 0.6);
}

// =============================================================================
// Squad Character Render Methods (Export-Style Object Literal)
// =============================================================================
const SQUAD_UNITS = {
  /**
   * 1. GRENADIER (Approved Olive default palette: { b: '#658354', d: '#3f5734', l: '#9bb889' })
   * Heavy rotary 40mm grenade launcher, rucksack + whip antenna, plate carrier & FAST helmet.
   */
  grenadier(c, T, a) {
    const mv = !!a.moving;
    const ph = a.walk || 0;
    const bob = mv ? -Math.abs(Math.cos(ph)) * 1.35 : 0;
    const aim = a.aim || 0;
    const rec = (a.rec || 0) * 3.8;
    const lean = (mv ? 1.3 : 0.6) - rec * 0.28;
    const sway = mv ? Math.sin(ph * 2) * 0.35 : 0;

    const gun = [2.4 + lean - Math.cos(aim) * rec, -5.0 + bob + sway - Math.sin(aim) * rec];
    const P = (x, y) => pt(gun, x, y, aim);

    // Back parts: whip antenna, rucksack, back leg, support arm
    const antBase = [-9.6 + lean, -10.8 + bob];
    const antSway = (mv ? Math.sin(ph - 0.8) * 1.4 : 0) - rec * 0.9;
    c.beginPath();
    c.moveTo(antBase[0], antBase[1]);
    c.quadraticCurveTo(antBase[0] - 1.6 + antSway * 0.5, antBase[1] - 6.5, antBase[0] - 2.4 + antSway, antBase[1] - 11.8);
    c.strokeStyle = '#252a31';
    c.lineWidth = 0.85;
    c.lineCap = 'round';
    c.stroke();
    dot(c, antBase[0] - 2.4 + antSway, antBase[1] - 11.8, 0.55, '#3b424c');

    poly(c, [
      [-11.4 + lean, -9.8 + bob], [-5.2 + lean, -9.8 + bob],
      [-4.8 + lean, 0.8 + bob], [-10.8 + lean, 1.0 + bob]
    ], T.d, 1.2);
    box(c, -11.6 + lean, -11.4 + bob, 5.6, 2.6, 1.0, '#3f463d');
    line(c, [[-11.0 + lean, -5.0 + bob], [-5.4 + lean, -5.0 + bob]], '#1c2026', 0.95);
    line(c, [[-11.0 + lean, -2.0 + bob], [-5.4 + lean, -2.0 + bob]], '#1c2026', 0.95);
    line(c, [[-10.4 + lean, -10.7 + bob], [-6.6 + lean, -10.7 + bob]], '#5d6658', 0.65);

    const bHip = [-0.8 + lean * 0.35, 2.2 + bob];
    drawBootLeg(c, bHip, ph + Math.PI, mv, -4.3, T.d, null, '#242930', null);

    const bSh = [3.0 + lean, -7.8 + bob];
    const bHand = P(10.8, 1.6);
    const bElb = ik2(bSh, bHand, 5.5, 5.6, 1);
    drawSeg(c, bSh, bElb, 1.65, 1.35, T.d, null);
    drawSeg(c, bElb, bHand, 1.35, 1.05, T.d, null);
    dot(c, bHand[0], bHand[1], 1.55, '#242930');

    // Body: torso, plate carrier, 40mm pouches, belt, front leg
    poly(c, [
      [-4.6 + lean * 0.7, 0.5 + bob], [4.4 + lean * 0.7, 0.6 + bob],
      [3.8 + lean * 0.5, 3.8 + bob], [-4.2 + lean * 0.5, 3.6 + bob]
    ], T.d, 1.15);

    c.beginPath();
    c.moveTo(-4.8 + lean, -9.4 + bob);
    c.quadraticCurveTo(0.8 + lean, -10.8 + bob, 5.0 + lean, -8.8 + bob);
    c.bezierCurveTo(6.1 + lean, -4.5 + bob, 5.5 + lean, -0.5 + bob, 4.4 + lean, 1.6 + bob);
    c.lineTo(-4.6 + lean, 1.4 + bob);
    c.bezierCurveTo(-5.8 + lean, -1.8 + bob, -5.8 + lean, -6.0 + bob, -4.8 + lean, -9.4 + bob);
    c.closePath();
    paint(c, T.b, 1.3);

    poly(c, [
      [-3.8 + lean, -8.8 + bob], [4.2 + lean, -8.3 + bob],
      [4.8 + lean, 0.5 + bob], [-4.0 + lean, 0.3 + bob]
    ], T.d, 1.15);
    line(c, [[-3.2 + lean, -8.1 + bob], [3.6 + lean, -7.7 + bob]], T.l, 0.85);
    line(c, [[-3.4 + lean, -6.2 + bob], [3.8 + lean, -5.9 + bob]], '#1f252b', 0.65);

    for (let i = 0; i < 3; i++) {
      const gx = -2.0 + i * 2.2 + lean;
      const gy = -4.6 + i * 0.35 + bob;
      box(c, gx, gy, 1.75, 3.1, 0.55, '#4b5446');
      oval(c, gx + 0.88, gy + 0.35, 0.75, 0.55, '#c79638', 0);
    }

    box(c, -4.7 + lean * 0.85, 0.6 + bob, 9.4, 1.9, 0.5, '#252a31');
    box(c, -3.9 + lean * 0.85, 0.3 + bob, 2.7, 2.7, 0.5, '#3b424c');
    box(c, 1.8 + lean * 0.85, 0.75 + bob, 1.7, 1.5, 0.3, '#6e7785');

    const fHip = [1.2 + lean * 0.35, 2.3 + bob];
    drawBootLeg(c, fHip, ph, mv, 4.2, T.b, T.d, '#2e343d', T.l);

    // Head: neck gaiter, profile, FAST helmet, comms headset, ballistic goggles
    const hx = 1.0 + lean, hy = -15.6 + bob;
    poly(c, [
      [hx - 2.6, hy + 3.4], [hx + 2.4, hy + 3.6],
      [hx + 2.9, hy + 6.4], [hx - 3.0, hy + 6.2]
    ], '#343b42', 1.05);

    c.save();
    c.translate(hx, hy + 3.6);
    c.rotate(aim * 0.28 - rec * 0.035);
    c.translate(-hx, -(hy + 3.6));

    c.beginPath();
    c.moveTo(hx - 1.8, hy - 0.8);
    c.lineTo(hx + 3.8, hy - 0.6);
    c.lineTo(hx + 4.3, hy + 1.0);
    c.lineTo(hx + 4.9, hy + 2.0);
    c.lineTo(hx + 4.3, hy + 2.5);
    c.quadraticCurveTo(hx + 4.5, hy + 4.2, hx + 2.4, hy + 4.4);
    c.quadraticCurveTo(hx - 0.6, hy + 4.4, hx - 1.8, hy + 2.4);
    c.closePath();
    paint(c, SKIN, 1.15);
    line(c, [[hx + 2.4, hy + 3.1], [hx + 3.9, hy + 3.0]], '#a47254', 0.75);
    line(c, [[hx - 0.6, hy + 2.2], [hx + 1.8, hy + 4.2]], '#262b33', 0.85);

    c.beginPath();
    c.moveTo(hx - 5.2, hy + 1.8);
    c.bezierCurveTo(hx - 5.6, hy - 4.8, hx + 4.5, hy - 5.2, hx + 5.2, hy - 0.5);
    c.quadraticCurveTo(hx + 2.2, hy - 0.2, hx + 0.4, hy + 1.2);
    c.quadraticCurveTo(hx - 2.4, hy + 2.2, hx - 5.2, hy + 1.8);
    c.closePath();
    paint(c, T.d, 1.3);
    c.beginPath();
    c.moveTo(hx - 3.2, hy - 2.6);
    c.quadraticCurveTo(hx + 0.5, hy - 4.0, hx + 3.4, hy - 2.2);
    c.strokeStyle = T.l;
    c.lineWidth = 0.9;
    c.lineCap = 'round';
    c.stroke();
    box(c, hx - 3.6, hy - 1.4, 2.2, 1.4, 0.3, '#3c434d');

    box(c, hx + 4.2, hy - 2.5, 1.5, 1.8, 0.35, '#242930');
    oval(c, hx - 1.0, hy + 1.8, 1.55, 2.0, '#2a3038', -0.08);
    dot(c, hx - 1.0, hy + 1.8, 0.65, '#48515c');
    line(c, [[hx - 0.5, hy + 2.8], [hx + 2.6, hy + 3.2]], '#1f242b', 0.8);

    poly(c, [
      [hx + 1.0, hy - 0.9], [hx + 4.6, hy - 0.8],
      [hx + 4.8, hy + 0.9], [hx + 2.2, hy + 1.3], [hx + 0.8, hy + 0.5]
    ], '#182430', 1.0);
    line(c, [[hx + 1.6, hy - 0.2], [hx + 3.9, hy - 0.1]], '#8ab6d6', 0.85);
    c.restore();

    // Front parts: weapon sling, M32 rotary 40mm launcher, muzzle blast, front arm
    const slA = [-1.4 + lean, -8.2 + bob];
    const slB = P(0.8, 0.8);
    c.beginPath();
    c.moveTo(slA[0], slA[1]);
    c.quadraticCurveTo((slA[0] + slB[0]) * 0.5 - 1.2, (slA[1] + slB[1]) * 0.5 + 2.4, slB[0], slB[1]);
    c.strokeStyle = '#20242b';
    c.lineWidth = 1.15;
    c.stroke();

    poly(c, [P(-8.6, -0.5), P(-1.8, -1.4), P(-1.8, 1.2), P(-8.6, 2.2)], '#282d35', 1.15);
    line(c, [P(-8.2, -0.1), P(-2.2, -0.8)], '#4d5663', 0.75);
    poly(c, [P(-1.8, 0.8), P(0.8, 0.8), P(-0.2, 4.5), P(-2.5, 4.1)], '#21252c', 1.05);
    poly(c, [P(-1.8, -2.3), P(16.6, -2.3), P(16.6, 0.7), P(-1.8, 0.7)], '#474f5a', 1.25);
    line(c, [P(-1.2, -1.7), P(16.0, -1.7)], '#7a8594', 0.8);
    poly(c, [P(16.2, -2.7), P(19.4, -2.7), P(19.4, 1.1), P(16.2, 1.1)], '#2a3038', 1.15);
    line(c, [P(17.8, -2.1), P(17.8, 0.5)], '#15181d', 0.85);
    poly(c, [P(2.4, -3.6), P(6.6, -3.6), P(6.6, -2.3), P(2.4, -2.3)], '#252a31', 0.95);
    dot(c, P(6.1, -3.0)[0], P(6.1, -3.0)[1], 0.45, '#ef4444');
    poly(c, [P(10.0, 0.7), P(11.8, 0.7), P(11.4, 3.8), P(9.8, 3.8)], '#23282f', 0.95);
    poly(c, [P(2.2, -1.1), P(8.8, -1.1), P(8.8, 3.6), P(2.2, 3.6)], '#343a44', 1.2);
    poly(c, [P(4.8, -0.7), P(6.2, -0.7), P(6.2, 0.4), P(4.8, 0.4)], '#c79638', 0.55);
    line(c, [P(4.4, -1.1), P(4.4, 3.6)], INK, 0.95);
    line(c, [P(6.6, -1.1), P(6.6, 3.6)], INK, 0.95);
    line(c, [P(2.8, -0.4), P(8.2, -0.4)], '#5d6673', 0.7);
    line(c, [P(11.0, -1.2), P(12.6, -1.2)], '#20252b', 0.9);
    line(c, [P(13.6, -1.2), P(15.2, -1.2)], '#20252b', 0.9);

    if (a.muzzle) {
      poly(c, [P(17.8, -2.7), P(16.6, -6.2), P(19.0, -2.7)], '#ffad33', 0.7);
      poly(c, [P(17.8, 1.1), P(16.6, 4.4), P(19.0, 1.1)], '#ffad33', 0.7);
      poly(c, [P(19.4, -0.8), P(24.2, -5.4), P(23.5, -1.8), P(31.2, -0.8), P(23.5, 0.5), P(24.8, 3.9)], '#ff881a', 1.0);
      poly(c, [P(19.4, -0.8), P(23.8, -2.8), P(27.4, -0.8), P(23.8, 1.2)], '#fff5bd', 0.65);
    }

    const fSh = [-2.0 + lean, -7.8 + bob];
    const fHand = P(-0.4, 2.2);
    const fElb = ik2(fSh, fHand, 5.4, 5.3, 1);
    drawSeg(c, fSh, fElb, 1.8, 1.45, T.b, T.l);
    drawSeg(c, fElb, fHand, 1.45, 1.15, T.b, T.l);
    oval(c, fElb[0] - 0.3, fElb[1] + 0.5, 1.2, 1.0, '#252a31', 0.3);
    dot(c, fHand[0], fHand[1], 1.65, '#252a31');
    oval(c, fSh[0] + 0.1, fSh[1] + 0.1, 2.5, 2.0, T.l, -0.25);
    box(c, fSh[0] - 0.8, fSh[1] + 0.8, 1.8, 1.1, 0.25, '#2d333b');
  },

  /**
   * 2. RIFLEMAN
   * Agile assault infantry with patrol cap, comms headset, chest rig, and M4-style carbine.
   */
  rifleman(c, T, a) {
    const mv = !!a.moving, ph = a.walk || 0;
    const bob = mv ? -Math.abs(Math.cos(ph)) * 1.45 : 0;
    const aim = a.aim || 0, rec = (a.rec || 0) * 2.8;
    const lean = (mv ? 1.5 : 0.8) - rec * 0.22;
    const sway = mv ? Math.sin(ph * 2) * 0.3 : 0;
    const gun = [2.6 + lean - Math.cos(aim) * rec, -5.6 + bob + sway - Math.sin(aim) * rec];
    const P = (x, y) => pt(gun, x, y, aim);

    // Back parts
    box(c, -8.8 + lean, -8.8 + bob, 4.4, 8.8, 1.2, T.d);
    line(c, [[-8.2 + lean, -5.4 + bob], [-4.8 + lean, -5.4 + bob]], '#1c2026', 0.85);
    drawBootLeg(c, [-0.7 + lean * 0.35, 2.2 + bob], ph + Math.PI, mv, -4.1, T.d, null, '#242930', null, 0.95);

    const bSh = [2.8 + lean, -7.8 + bob];
    const bHand = P(11.4, 0.8);
    const bElb = ik2(bSh, bHand, 5.4, 5.5, 1);
    drawSeg(c, bSh, bElb, 1.5, 1.25, T.d, null);
    drawSeg(c, bElb, bHand, 1.25, 1.0, T.d, null);
    dot(c, bHand[0], bHand[1], 1.45, '#242930');

    // Body
    poly(c, [
      [-4.2 + lean * 0.7, 0.5 + bob], [4.0 + lean * 0.7, 0.6 + bob],
      [3.5 + lean * 0.5, 3.6 + bob], [-3.8 + lean * 0.5, 3.5 + bob]
    ], T.d, 1.1);
    c.beginPath();
    c.moveTo(-4.3 + lean, -9.2 + bob);
    c.quadraticCurveTo(0.8 + lean, -10.5 + bob, 4.6 + lean, -8.6 + bob);
    c.bezierCurveTo(5.6 + lean, -4.5 + bob, 5.0 + lean, -0.6 + bob, 4.0 + lean, 1.4 + bob);
    c.lineTo(-4.2 + lean, 1.3 + bob);
    c.bezierCurveTo(-5.3 + lean, -1.8 + bob, -5.2 + lean, -6.0 + bob, -4.3 + lean, -9.2 + bob);
    c.closePath();
    paint(c, T.b, 1.25);

    poly(c, [
      [-3.2 + lean, -7.8 + bob], [4.0 + lean, -7.5 + bob],
      [4.3 + lean, -0.4 + bob], [-3.4 + lean, -0.5 + bob]
    ], '#343b42', 1.05);
    for (let i = 0; i < 3; i++) {
      box(c, -2.0 + i * 2.0 + lean, -4.5 + bob, 1.6, 3.2, 0.4, T.d);
      line(c, [[-1.6 + i * 2.0 + lean, -3.7 + bob], [-0.8 + i * 2.0 + lean, -3.7 + bob]], T.l, 0.65);
    }
    box(c, -4.3 + lean * 0.85, 0.6 + bob, 8.6, 1.7, 0.45, '#252a31');
    drawBootLeg(c, [1.1 + lean * 0.35, 2.3 + bob], ph, mv, 4.0, T.b, T.d, '#2e343d', T.l, 0.95);

    // Head
    const hx = 1.1 + lean, hy = -15.5 + bob;
    poly(c, [[hx - 2.3, hy + 3.4], [hx + 2.2, hy + 3.5], [hx + 2.6, hy + 6.2], [hx - 2.6, hy + 6.0]], '#30363e', 1.0);
    c.save();
    c.translate(hx, hy + 3.5);
    c.rotate(aim * 0.3 - rec * 0.03);
    c.translate(-hx, -(hy + 3.5));

    c.beginPath();
    c.moveTo(hx - 2.2, hy - 0.6);
    c.lineTo(hx + 3.7, hy - 0.5);
    c.lineTo(hx + 4.8, hy + 1.9);
    c.lineTo(hx + 4.2, hy + 2.5);
    c.quadraticCurveTo(hx + 4.3, hy + 4.2, hx + 2.2, hy + 4.3);
    c.quadraticCurveTo(hx - 0.8, hy + 4.3, hx - 2.2, hy + 2.2);
    c.closePath();
    paint(c, SKIN, 1.15);
    line(c, [[hx + 2.2, hy + 3.1], [hx + 3.7, hy + 3.0]], '#a47254', 0.7);

    c.beginPath();
    c.moveTo(hx - 4.4, hy + 0.5);
    c.bezierCurveTo(hx - 4.4, hy - 4.4, hx + 3.8, hy - 4.4, hx + 4.4, hy - 0.6);
    c.lineTo(hx + 7.4, hy - 0.2);
    c.quadraticCurveTo(hx + 5.6, hy + 0.7, hx + 3.8, hy + 0.4);
    c.quadraticCurveTo(hx - 0.4, hy + 0.8, hx - 4.4, hy + 0.5);
    c.closePath();
    paint(c, T.d, 1.2);
    line(c, [[hx - 2.6, hy - 2.2], [hx + 2.4, hy - 2.1]], T.l, 0.8);

    oval(c, hx - 1.2, hy + 1.5, 1.4, 1.85, '#252a31', -0.05);
    line(c, [[hx - 0.6, hy + 2.6], [hx + 2.4, hy + 3.0]], '#1f242b', 0.75);
    poly(c, [[hx + 1.2, hy + 0.1], [hx + 4.5, hy + 0.2], [hx + 4.4, hy + 1.4], [hx + 1.5, hy + 1.5]], '#16202b', 0.9);
    line(c, [[hx + 1.8, hy + 0.6], [hx + 3.8, hy + 0.65]], '#7ba8c7', 0.75);
    c.restore();

    // Front parts: M4 carbine + front arm
    poly(c, [P(-7.8, -0.8), P(-1.8, -1.2), P(-1.8, 0.9), P(-7.8, 2.0)], '#2a3038', 1.1);
    poly(c, [P(-1.4, 0.8), P(0.6, 0.8), P(-0.4, 4.0), P(-2.2, 3.6)], '#21252c', 1.0);
    poly(c, [P(4.2, 0.8), P(6.4, 0.8), P(7.4, 5.2), P(5.2, 5.4)], '#333942', 1.05);
    poly(c, [P(-2.0, -1.7), P(13.8, -1.7), P(13.8, 1.0), P(-2.0, 1.0)], '#404752', 1.2);
    line(c, [P(-1.4, -1.1), P(13.2, -1.1)], '#788391', 0.75);
    poly(c, [P(1.4, -3.2), P(5.0, -3.2), P(5.0, -1.7), P(1.4, -1.7)], '#252a31', 0.95);
    dot(c, P(4.4, -2.5)[0], P(4.4, -2.5)[1], 0.4, '#22c55e');
    poly(c, [P(9.8, 1.0), P(12.2, 1.0), P(11.4, 2.3), P(9.4, 1.9)], '#23282f', 0.85);
    poly(c, [P(13.8, -1.1), P(20.6, -1.1), P(20.6, 0.1), P(13.8, 0.1)], '#2a3038', 1.05);
    poly(c, [P(20.2, -1.4), P(22.2, -1.4), P(22.2, 0.4), P(20.2, 0.4)], '#1d2228', 0.95);

    if (a.muzzle) {
      poly(c, [P(22.2, -0.5), P(26.5, -3.4), P(25.8, -1.2), P(31.8, -0.5), P(25.8, 0.3), P(26.6, 2.4)], '#ff9e2c', 0.9);
      poly(c, [P(22.2, -0.5), P(26.0, -1.7), P(28.6, -0.5), P(26.0, 0.8)], '#fff7c2', 0.6);
    }

    const fSh = [-1.8 + lean, -7.8 + bob];
    const fHand = P(-0.3, 2.0);
    const fElb = ik2(fSh, fHand, 5.2, 5.1, 1);
    drawSeg(c, fSh, fElb, 1.65, 1.35, T.b, T.l);
    drawSeg(c, fElb, fHand, 1.35, 1.08, T.b, T.l);
    dot(c, fHand[0], fHand[1], 1.55, '#252a31');
    oval(c, fSh[0] + 0.1, fSh[1] + 0.1, 2.2, 1.8, T.l, -0.25);
  },

  /**
   * 3. SNIPER
   * Hooded recon cloak, balaclava with rangefinder optics, and suppressed long marksman rifle.
   */
  sniper(c, T, a) {
    const mv = !!a.moving, ph = a.walk || 0;
    const bob = mv ? -Math.abs(Math.cos(ph)) * 1.2 : 0;
    const aim = a.aim || 0, rec = (a.rec || 0) * 3.4;
    const lean = (mv ? 1.8 : 1.1) - rec * 0.25;
    const flutter = mv ? Math.sin(ph * 2 - 0.6) * 1.8 : 0;
    const gun = [2.4 + lean - Math.cos(aim) * rec, -5.8 + bob - Math.sin(aim) * rec];
    const P = (x, y) => pt(gun, x, y, aim);

    // Back parts: fluttering cloak, back leg, support arm
    c.beginPath();
    c.moveTo(-4.0 + lean, -10.5 + bob);
    c.quadraticCurveTo(-9.5 + lean - flutter * 0.4, -4.0 + bob, -11.5 + lean - flutter, 4.5 + bob);
    c.lineTo(-4.5 + lean - flutter * 0.4, 5.2 + bob);
    c.quadraticCurveTo(-3.2 + lean, -2.5 + bob, -1.5 + lean, -9.0 + bob);
    c.closePath();
    paint(c, T.d, 1.2);
    line(c, [[-9.2 + lean - flutter * 0.6, 0.5 + bob], [-5.8 + lean - flutter * 0.3, 1.2 + bob]], T.l, 0.9);
    line(c, [[-8.2 + lean - flutter * 0.4, -3.5 + bob], [-5.0 + lean, -2.8 + bob]], '#3a4236', 0.9);

    drawBootLeg(c, [-0.8 + lean * 0.35, 2.2 + bob], ph + Math.PI, mv, -4.2, T.d, null, '#242930', null, 0.92);

    const bSh = [2.8 + lean, -7.8 + bob];
    const bHand = P(12.2, 0.8);
    const bElb = ik2(bSh, bHand, 5.6, 5.6, 1);
    drawSeg(c, bSh, bElb, 1.45, 1.2, T.d, null);
    drawSeg(c, bElb, bHand, 1.2, 0.98, T.d, null);
    dot(c, bHand[0], bHand[1], 1.4, '#242930');

    // Body
    poly(c, [
      [-4.0 + lean * 0.7, 0.6 + bob], [3.8 + lean * 0.7, 0.6 + bob],
      [3.4 + lean * 0.5, 3.6 + bob], [-3.6 + lean * 0.5, 3.5 + bob]
    ], T.d, 1.05);
    c.beginPath();
    c.moveTo(-4.2 + lean, -9.2 + bob);
    c.quadraticCurveTo(0.8 + lean, -10.4 + bob, 4.5 + lean, -8.5 + bob);
    c.bezierCurveTo(5.4 + lean, -4.2 + bob, 4.8 + lean, -0.5 + bob, 3.8 + lean, 1.4 + bob);
    c.lineTo(-4.2 + lean, 1.2 + bob);
    c.closePath();
    paint(c, T.b, 1.2);

    c.beginPath();
    c.moveTo(-5.0 + lean, -9.6 + bob);
    c.quadraticCurveTo(0.8 + lean, -11.0 + bob, 4.8 + lean, -8.8 + bob);
    c.lineTo(4.2 + lean, -3.0 + bob);
    c.quadraticCurveTo(0.2 + lean, -1.6 + bob, -5.6 + lean, -3.4 + bob);
    c.closePath();
    paint(c, T.d, 1.1);
    line(c, [[-3.8 + lean, -5.8 + bob], [2.6 + lean, -5.2 + bob]], T.l, 0.8);

    box(c, -4.1 + lean * 0.85, 0.6 + bob, 8.2, 1.6, 0.4, '#252a31');
    drawBootLeg(c, [1.0 + lean * 0.35, 2.3 + bob], ph, mv, 4.1, T.b, T.d, '#2e343d', T.l, 0.92);

    // Head: balaclava, optics, deep hood
    const hx = 1.2 + lean, hy = -15.4 + bob;
    c.save();
    c.translate(hx, hy + 3.5);
    c.rotate(aim * 0.32 - rec * 0.03);
    c.translate(-hx, -(hy + 3.5));

    oval(c, hx + 0.6, hy + 1.4, 3.6, 3.9, '#2b3138', 0);
    box(c, hx + 1.1, hy - 0.1, 3.1, 1.45, 0.4, SKIN);
    poly(c, [[hx + 1.4, hy - 0.4], [hx + 4.8, hy - 0.3], [hx + 4.8, hy + 1.3], [hx + 1.6, hy + 1.3]], '#1c242e', 0.95);
    dot(c, hx + 3.5, hy + 0.5, 0.75, '#38bdf8');

    c.beginPath();
    c.moveTo(hx - 5.6, hy + 4.4);
    c.bezierCurveTo(hx - 6.2, hy - 4.8, hx + 3.8, hy - 5.6, hx + 5.6, hy - 1.2);
    c.quadraticCurveTo(hx + 2.6, hy - 1.2, hx + 0.6, hy + 1.0);
    c.quadraticCurveTo(hx - 1.4, hy + 4.2, hx - 5.6, hy + 4.4);
    c.closePath();
    paint(c, T.d, 1.25);
    line(c, [[hx - 3.4, hy - 2.6], [hx + 2.8, hy - 2.6]], T.l, 0.85);
    c.restore();

    // Front parts: suppressed DMR + scope + front arm
    poly(c, [P(-8.4, -0.6), P(-1.8, -1.2), P(-1.8, 1.0), P(-8.4, 2.2)], '#313740', 1.1);
    poly(c, [P(-6.8, -1.6), P(-3.2, -1.6), P(-3.2, -0.8), P(-6.8, -0.8)], '#1f242b', 0.8);
    poly(c, [P(-1.4, 0.9), P(0.5, 0.9), P(-0.4, 3.8), P(-2.0, 3.5)], '#21252c', 0.95);
    poly(c, [P(3.8, 0.8), P(6.6, 0.8), P(6.6, 3.6), P(3.8, 3.6)], '#2d333c', 0.95);
    poly(c, [P(-2.0, -1.5), P(15.2, -1.5), P(15.2, 0.9), P(-2.0, 0.9)], '#454d58', 1.15);
    poly(c, [P(15.2, -0.9), P(23.5, -0.9), P(23.5, 0.2), P(15.2, 0.2)], '#2a3038', 1.0);
    poly(c, [P(22.6, -1.4), P(29.0, -1.4), P(29.0, 0.6), P(22.6, 0.6)], '#232830', 1.1);
    line(c, [P(23.2, -0.9), P(28.4, -0.9)], '#5a6573', 0.7);
    line(c, [P(14.5, 0.9), P(19.6, 2.1)], '#1f242b', 1.15);
    poly(c, [P(0.2, -3.5), P(10.6, -3.8), P(10.6, -2.0), P(0.2, -2.2)], '#1f242b', 1.0);
    line(c, [P(1.4, -3.1), P(9.8, -3.2)], '#6b7787', 0.7);
    line(c, [P(10.6, -3.6), P(10.6, -2.2)], '#38bdf8', 0.9);

    if (a.muzzle) {
      poly(c, [P(29.0, -0.4), P(33.5, -1.8), P(36.2, -0.4), P(33.5, 1.0)], '#ffd070', 0.75);
    }

    const fSh = [-1.8 + lean, -7.8 + bob];
    const fHand = P(-0.3, 2.0);
    const fElb = ik2(fSh, fHand, 5.2, 5.1, 1);
    drawSeg(c, fSh, fElb, 1.55, 1.28, T.b, T.l);
    drawSeg(c, fElb, fHand, 1.28, 1.02, T.b, T.l);
    dot(c, fHand[0], fHand[1], 1.5, '#252a31');
  },

  /**
   * 4. HEAVY GUNNER
   * Bulky juggernaut armor, Altyn-style armored face shield, shoulder pauldrons, belt-fed LMG.
   */
  heavy(c, T, a) {
    const mv = !!a.moving, ph = a.walk || 0;
    const bob = mv ? -Math.abs(Math.cos(ph)) * 1.05 : 0;
    const aim = a.aim || 0, rec = (a.rec || 0) * 2.6;
    const lean = (mv ? 0.9 : 0.4) - rec * 0.2;
    const vib = a.muzzle ? (Math.sin(ph * 17) * 0.45) : 0;
    const gun = [2.8 + lean - Math.cos(aim) * rec, -3.2 + bob + vib - Math.sin(aim) * rec];
    const P = (x, y) => pt(gun, x, y, aim);

    // Back parts
    box(c, -12.6 + lean, -10.5 + bob, 6.8, 11.4, 1.4, T.d);
    box(c, -11.6 + lean, -9.2 + bob, 4.6, 3.0, 0.5, '#3b424c');
    line(c, [[-12.0 + lean, -4.4 + bob], [-6.2 + lean, -4.4 + bob]], '#1c2026', 1.0);
    drawBootLeg(c, [-1.0 + lean * 0.35, 2.3 + bob], ph + Math.PI, mv, -4.4, T.d, null, '#20252b', null, 1.15);

    const bSh = [3.6 + lean, -8.2 + bob];
    const bHand = P(10.6, -1.6);
    const bElb = ik2(bSh, bHand, 5.8, 5.8, 1);
    drawSeg(c, bSh, bElb, 2.0, 1.65, T.d, null);
    drawSeg(c, bElb, bHand, 1.65, 1.3, T.d, null);
    dot(c, bHand[0], bHand[1], 1.75, '#20252b');

    // Body
    poly(c, [
      [-5.6 + lean * 0.7, 0.4 + bob], [5.4 + lean * 0.7, 0.5 + bob],
      [4.6 + lean * 0.5, 4.2 + bob], [-5.0 + lean * 0.5, 4.0 + bob]
    ], T.d, 1.25);
    c.beginPath();
    c.moveTo(-6.0 + lean, -10.2 + bob);
    c.quadraticCurveTo(0.8 + lean, -11.8 + bob, 6.2 + lean, -9.4 + bob);
    c.bezierCurveTo(7.4 + lean, -4.5 + bob, 6.6 + lean, -0.2 + bob, 5.4 + lean, 1.8 + bob);
    c.lineTo(-5.6 + lean, 1.6 + bob);
    c.bezierCurveTo(-7.0 + lean, -2.0 + bob, -7.0 + lean, -6.5 + bob, -6.0 + lean, -10.2 + bob);
    c.closePath();
    paint(c, T.b, 1.4);

    poly(c, [
      [-4.8 + lean, -9.6 + bob], [5.2 + lean, -9.0 + bob],
      [5.8 + lean, 0.8 + bob], [-5.0 + lean, 0.6 + bob]
    ], '#343b44', 1.25);
    line(c, [[-4.0 + lean, -8.8 + bob], [4.6 + lean, -8.3 + bob]], T.l, 1.0);
    poly(c, [[-4.2 + lean, -11.4 + bob], [4.4 + lean, -11.0 + bob], [4.8 + lean, -8.8 + bob], [-4.6 + lean, -9.0 + bob]], T.d, 1.15);
    poly(c, [[-2.0 + lean * 0.7, 1.2 + bob], [3.6 + lean * 0.7, 1.3 + bob], [3.0 + lean * 0.6, 4.8 + bob], [-1.4 + lean * 0.6, 4.7 + bob]], '#2c323a', 1.0);

    drawBootLeg(c, [1.4 + lean * 0.35, 2.3 + bob], ph, mv, 4.3, T.b, T.d, '#282e36', T.l, 1.15);

    // Head: Altyn helmet + ballistic face shield
    const hx = 1.0 + lean, hy = -16.2 + bob;
    c.save();
    c.translate(hx, hy + 3.6);
    c.rotate(aim * 0.2 - rec * 0.025);
    c.translate(-hx, -(hy + 3.6));

    c.beginPath();
    c.moveTo(hx - 5.8, hy + 3.6);
    c.bezierCurveTo(hx - 6.4, hy - 5.4, hx + 5.2, hy - 5.8, hx + 5.8, hy - 0.6);
    c.lineTo(hx + 5.4, hy + 4.0);
    c.quadraticCurveTo(hx + 0.5, hy + 4.8, hx - 5.8, hy + 3.6);
    c.closePath();
    paint(c, T.d, 1.35);
    poly(c, [
      [hx + 0.2, hy - 1.6], [hx + 6.0, hy - 1.2],
      [hx + 5.6, hy + 4.2], [hx + 0.0, hy + 3.8]
    ], '#3a424d', 1.2);
    poly(c, [
      [hx + 1.4, hy - 0.5], [hx + 5.4, hy - 0.3],
      [hx + 5.3, hy + 1.1], [hx + 1.4, hy + 1.0]
    ], '#182430', 0.95);
    line(c, [[hx + 2.0, hy + 0.2], [hx + 4.6, hy + 0.25]], '#8ecae6', 0.85);
    line(c, [[hx - 3.4, hy - 3.2], [hx + 3.2, hy - 3.0]], T.l, 0.95);
    c.restore();

    // Front parts: hanging brass belt + LMG + pauldron arm
    const beltStart = [-6.5 + lean, -2.5 + bob];
    const beltEnd = P(4.2, 2.2);
    c.beginPath();
    c.moveTo(beltStart[0], beltStart[1]);
    c.quadraticCurveTo((beltStart[0] + beltEnd[0]) * 0.5, Math.max(beltStart[1], beltEnd[1]) + 3.6, beltEnd[0], beltEnd[1]);
    c.strokeStyle = INK;
    c.lineWidth = 3.2;
    c.stroke();
    c.strokeStyle = '#d4a23a';
    c.setLineDash([1.6, 1.2]);
    c.lineWidth = 1.9;
    c.stroke();
    c.setLineDash([]);

    poly(c, [P(-7.5, -1.4), P(-1.2, -1.8), P(-1.2, 1.6), P(-7.5, 2.2)], '#252a31', 1.2);
    poly(c, [P(-1.5, -2.5), P(15.6, -2.5), P(15.6, 1.5), P(-1.5, 1.5)], '#434b56', 1.3);
    line(c, [P(-0.8, -1.8), P(14.8, -1.8)], '#7c8796', 0.85);
    line(c, [P(3.0, -2.5), P(4.4, -4.2), P(11.6, -4.2), P(12.6, -2.5)], '#20252b', 1.6);
    poly(c, [P(2.4, 1.4), P(8.8, 1.4), P(8.6, 5.4), P(2.2, 5.4)], T.d, 1.2);
    line(c, [P(3.6, 2.4), P(7.4, 2.4)], '#c79638', 0.9);
    poly(c, [P(15.6, -1.6), P(23.2, -1.6), P(23.2, 0.6), P(15.6, 0.6)], '#2a3038', 1.15);
    line(c, [P(16.6, -0.5), P(22.2, -0.5)], '#5c6673', 0.8);
    poly(c, [P(22.6, -2.2), P(25.2, -2.2), P(25.2, 1.2), P(22.6, 1.2)], '#1b2026', 1.1);

    if (a.muzzle) {
      poly(c, [P(25.2, -0.5), P(30.4, -5.2), P(29.4, -1.6), P(36.8, -0.5), P(29.4, 0.8), P(30.8, 4.2)], '#ff881a', 1.0);
      poly(c, [P(25.2, -0.5), P(29.8, -2.4), P(33.2, -0.5), P(29.8, 1.4)], '#fff5bd', 0.7);
    }

    const fSh = [-2.4 + lean, -8.2 + bob];
    const fHand = P(-0.5, 2.2);
    const fElb = ik2(fSh, fHand, 5.6, 5.5, 1);
    drawSeg(c, fSh, fElb, 2.1, 1.75, T.b, T.l);
    drawSeg(c, fElb, fHand, 1.75, 1.35, T.b, T.l);
    dot(c, fHand[0], fHand[1], 1.8, '#20252b');
    c.beginPath();
    c.ellipse(fSh[0] + 0.2, fSh[1] + 0.5, 3.6, 3.0, -0.2, 0, TAU);
    paint(c, T.l, 1.25);
    line(c, [[fSh[0] - 1.8, fSh[1] + 0.8], [fSh[0] + 2.2, fSh[1] + 0.4]], T.d, 1.0);
  },

  /**
   * 5. COMBAT MEDIC
   * Field trauma pack, red-cross helmet emblem & brassard armband, suppressed compact SMG.
   */
  medic(c, T, a) {
    const mv = !!a.moving, ph = a.walk || 0;
    const bob = mv ? -Math.abs(Math.cos(ph)) * 1.5 : 0;
    const aim = a.aim || 0, rec = (a.rec || 0) * 2.2;
    const lean = (mv ? 1.6 : 0.8) - rec * 0.2;
    const gun = [2.6 + lean - Math.cos(aim) * rec, -5.4 + bob - Math.sin(aim) * rec];
    const P = (x, y) => pt(gun, x, y, aim);

    // Back parts: trauma pack
    box(c, -11.4 + lean, -9.6 + bob, 6.2, 10.2, 1.5, '#e2e8f0');
    box(c, -9.1 + lean, -7.2 + bob, 1.6, 5.0, 0.2, '#dc2626');
    box(c, -10.8 + lean, -5.5 + bob, 5.0, 1.6, 0.2, '#dc2626');
    line(c, [[-11.0 + lean, -1.2 + bob], [-5.6 + lean, -1.2 + bob]], '#475569', 0.9);

    drawBootLeg(c, [-0.7 + lean * 0.35, 2.2 + bob], ph + Math.PI, mv, -4.0, T.d, null, '#242930', null, 0.92);

    const bSh = [2.6 + lean, -7.8 + bob];
    const bHand = P(8.6, 1.2);
    const bElb = ik2(bSh, bHand, 5.2, 5.2, 1);
    drawSeg(c, bSh, bElb, 1.48, 1.2, T.d, null);
    drawSeg(c, bElb, bHand, 1.2, 0.95, T.d, null);
    dot(c, bHand[0], bHand[1], 1.4, '#242930');

    // Body
    poly(c, [
      [-4.1 + lean * 0.7, 0.5 + bob], [3.9 + lean * 0.7, 0.6 + bob],
      [3.4 + lean * 0.5, 3.6 + bob], [-3.7 + lean * 0.5, 3.5 + bob]
    ], T.d, 1.1);
    c.beginPath();
    c.moveTo(-4.3 + lean, -9.2 + bob);
    c.quadraticCurveTo(0.8 + lean, -10.5 + bob, 4.5 + lean, -8.5 + bob);
    c.bezierCurveTo(5.5 + lean, -4.4 + bob, 4.9 + lean, -0.5 + bob, 3.9 + lean, 1.4 + bob);
    c.lineTo(-4.2 + lean, 1.3 + bob);
    c.closePath();
    paint(c, T.b, 1.25);

    poly(c, [[-3.3 + lean, -7.8 + bob], [3.8 + lean, -7.5 + bob], [4.2 + lean, -0.4 + bob], [-3.5 + lean, -0.5 + bob]], T.d, 1.05);
    box(c, -1.8 + lean, -5.8 + bob, 3.2, 2.4, 0.4, '#f1f5f9');
    line(c, [[-0.2 + lean, -5.3 + bob], [-0.2 + lean, -3.9 + bob]], '#dc2626', 1.1);
    line(c, [[-0.9 + lean, -4.6 + bob], [0.5 + lean, -4.6 + bob]], '#dc2626', 1.1);
    box(c, -4.2 + lean * 0.85, 0.6 + bob, 8.4, 1.7, 0.45, '#252a31');

    drawBootLeg(c, [1.1 + lean * 0.35, 2.3 + bob], ph, mv, 3.9, T.b, T.d, '#2e343d', T.l, 0.92);

    // Head
    const hx = 1.0 + lean, hy = -15.5 + bob;
    poly(c, [[hx - 2.3, hy + 3.4], [hx + 2.2, hy + 3.5], [hx + 2.6, hy + 6.2], [hx - 2.6, hy + 6.0]], '#343b42', 1.0);
    c.save();
    c.translate(hx, hy + 3.5);
    c.rotate(aim * 0.3 - rec * 0.025);
    c.translate(-hx, -(hy + 3.5));

    c.beginPath();
    c.moveTo(hx - 1.8, hy - 0.8);
    c.lineTo(hx + 3.8, hy - 0.6);
    c.lineTo(hx + 4.8, hy + 2.0);
    c.lineTo(hx + 4.2, hy + 2.5);
    c.quadraticCurveTo(hx + 4.4, hy + 4.2, hx + 2.3, hy + 4.3);
    c.quadraticCurveTo(hx - 0.6, hy + 4.3, hx - 1.8, hy + 2.3);
    c.closePath();
    paint(c, SKIN, 1.15);
    line(c, [[hx + 2.3, hy + 3.1], [hx + 3.8, hy + 3.0]], '#a47254', 0.7);

    c.beginPath();
    c.moveTo(hx - 5.0, hy + 1.6);
    c.bezierCurveTo(hx - 5.4, hy - 4.7, hx + 4.4, hy - 5.0, hx + 5.0, hy - 0.5);
    c.quadraticCurveTo(hx + 1.8, hy - 0.2, hx + 0.2, hy + 1.1);
    c.quadraticCurveTo(hx - 2.4, hy + 2.0, hx - 5.0, hy + 1.6);
    c.closePath();
    paint(c, T.d, 1.25);
    oval(c, hx - 1.8, hy - 1.4, 1.85, 1.85, '#f8fafc', 0);
    line(c, [[hx - 1.8, hy - 2.4], [hx - 1.8, hy - 0.4]], '#dc2626', 1.05);
    line(c, [[hx - 2.8, hy - 1.4], [hx - 0.8, hy - 1.4]], '#dc2626', 1.05);
    poly(c, [[hx + 1.2, hy - 0.6], [hx + 4.6, hy - 0.5], [hx + 4.6, hy + 1.1], [hx + 1.4, hy + 1.1]], '#334e68', 0.9);
    line(c, [[hx + 1.8, hy + 0.0], [hx + 3.9, hy + 0.05]], '#bae6fd', 0.8);
    c.restore();

    // Front parts: suppressed PDW/SMG + armband
    poly(c, [P(-4.8, -0.8), P(-1.2, -1.0), P(-1.2, 0.6), P(-4.8, 1.0)], '#252a31', 0.95);
    poly(c, [P(-1.2, 0.7), P(0.8, 0.7), P(0.0, 3.8), P(-1.8, 3.6)], '#21252c', 0.95);
    poly(c, [P(3.8, 0.8), P(5.5, 0.8), P(6.2, 4.8), P(4.6, 4.9)], '#2b313a', 0.95);
    poly(c, [P(-1.6, -1.6), P(10.6, -1.6), P(10.6, 0.9), P(-1.6, 0.9)], '#434b56', 1.15);
    poly(c, [P(1.4, -2.9), P(4.4, -2.9), P(4.4, -1.6), P(1.4, -1.6)], '#23282f', 0.85);
    poly(c, [P(10.6, -1.2), P(15.2, -1.2), P(15.2, 0.4), P(10.6, 0.4)], '#23282f', 1.0);

    if (a.muzzle) {
      poly(c, [P(15.2, -0.4), P(19.0, -2.2), P(22.0, -0.4), P(19.0, 1.4)], '#ffb347', 0.75);
    }

    const fSh = [-1.8 + lean, -7.8 + bob];
    const fHand = P(-0.2, 2.0);
    const fElb = ik2(fSh, fHand, 5.0, 5.0, 1);
    drawSeg(c, fSh, fElb, 1.55, 1.28, T.b, T.l);
    drawSeg(c, fElb, fHand, 1.28, 1.02, T.b, T.l);
    dot(c, fHand[0], fHand[1], 1.5, '#252a31');
    box(c, fSh[0] - 1.1, fSh[1] + 1.0, 2.6, 1.8, 0.3, '#f8fafc');
    line(c, [[fSh[0] + 0.2, fSh[1] + 1.3], [fSh[0] + 0.2, fSh[1] + 2.5]], '#dc2626', 0.9);
    line(c, [[fSh[0] - 0.4, fSh[1] + 1.9], [fSh[0] + 0.8, fSh[1] + 1.9]], '#dc2626', 0.9);
  },

  /**
   * 6. RIOT BREACHER
   * Tall ballistic riot shield with armored viewport, SWAT visor helmet, and pump shotgun.
   */
  breacher(c, T, a) {
    const mv = !!a.moving, ph = a.walk || 0;
    const bob = mv ? -Math.abs(Math.cos(ph)) * 1.1 : 0;
    const aim = a.aim || 0, rec = (a.rec || 0) * 3.6;
    const lean = (mv ? 1.1 : 0.5) - rec * 0.28;
    const gun = [3.0 + lean - Math.cos(aim) * rec, -6.2 + bob - Math.sin(aim) * rec];
    const P = (x, y) => pt(gun, x, y, aim);

    // Back parts
    box(c, -10.2 + lean, -9.2 + bob, 5.2, 9.2, 1.2, T.d);
    line(c, [[-8.6 + lean, -14.2 + bob], [-6.8 + lean, -8.5 + bob]], '#374151', 1.6);
    box(c, -9.8 + lean, -15.0 + bob, 2.6, 1.3, 0.3, '#1f2937');
    drawBootLeg(c, [-0.9 + lean * 0.35, 2.3 + bob], ph + Math.PI, mv, -4.3, T.d, null, '#20252b', null, 1.08);

    // Body
    poly(c, [
      [-4.8 + lean * 0.7, 0.5 + bob], [4.6 + lean * 0.7, 0.6 + bob],
      [4.0 + lean * 0.5, 3.9 + bob], [-4.4 + lean * 0.5, 3.8 + bob]
    ], T.d, 1.15);
    c.beginPath();
    c.moveTo(-5.0 + lean, -9.6 + bob);
    c.quadraticCurveTo(0.8 + lean, -11.0 + bob, 5.2 + lean, -8.8 + bob);
    c.bezierCurveTo(6.2 + lean, -4.5 + bob, 5.6 + lean, -0.5 + bob, 4.6 + lean, 1.5 + bob);
    c.lineTo(-4.8 + lean, 1.4 + bob);
    c.closePath();
    paint(c, T.b, 1.3);
    poly(c, [[-4.0 + lean, -8.8 + bob], [4.4 + lean, -8.3 + bob], [4.8 + lean, 0.6 + bob], [-4.2 + lean, 0.5 + bob]], '#2d333c', 1.15);
    for (let i = 0; i < 4; i++) {
      box(c, -2.4 + i * 1.4 + lean, -4.4 + bob, 1.0, 2.4, 0.25, '#dc2626');
      box(c, -2.4 + i * 1.4 + lean, -2.5 + bob, 1.0, 0.6, 0.1, '#d4a23a');
    }

    drawBootLeg(c, [1.2 + lean * 0.35, 2.3 + bob], ph, mv, 4.2, T.b, T.d, '#282e36', T.l, 1.08);

    // Head: SWAT riot helmet
    const hx = 1.0 + lean, hy = -15.6 + bob;
    poly(c, [[hx - 2.5, hy + 3.4], [hx + 2.4, hy + 3.5], [hx + 2.8, hy + 6.2], [hx - 2.8, hy + 6.0]], '#282e36', 1.05);
    c.save();
    c.translate(hx, hy + 3.5);
    c.rotate(aim * 0.25 - rec * 0.03);
    c.translate(-hx, -(hy + 3.5));

    oval(c, hx + 0.8, hy + 1.4, 3.6, 3.8, '#252a31', 0);
    c.beginPath();
    c.moveTo(hx - 5.2, hy + 2.4);
    c.bezierCurveTo(hx - 5.8, hy - 5.0, hx + 4.8, hy - 5.2, hx + 5.2, hy - 0.6);
    c.quadraticCurveTo(hx + 1.6, hy - 0.2, hx - 0.2, hy + 1.6);
    c.quadraticCurveTo(hx - 2.8, hy + 2.6, hx - 5.2, hy + 2.4);
    c.closePath();
    paint(c, T.d, 1.3);
    c.beginPath();
    c.moveTo(hx + 0.6, hy - 1.2);
    c.quadraticCurveTo(hx + 5.8, hy - 1.0, hx + 6.2, hy + 2.8);
    c.quadraticCurveTo(hx + 3.4, hy + 4.0, hx + 0.4, hy + 3.0);
    c.closePath();
    paint(c, '#243b53', 1.05);
    line(c, [[hx + 2.0, hy - 0.2], [hx + 4.8, hy + 0.4]], '#93c5fd', 0.9);
    line(c, [[hx - 3.2, hy - 2.8], [hx + 3.0, hy - 2.6]], T.l, 0.85);
    c.restore();

    // Front parts: shotgun + ballistic riot shield
    const bSh = [3.0 + lean, -7.8 + bob];
    const bHand = P(1.2, 1.6);
    const bElb = ik2(bSh, bHand, 5.2, 5.2, 1);
    drawSeg(c, bSh, bElb, 1.6, 1.3, T.d, null);
    drawSeg(c, bElb, bHand, 1.3, 1.05, T.d, null);

    poly(c, [P(-2.0, -1.4), P(14.5, -1.4), P(14.5, 0.8), P(-2.0, 0.8)], '#3b424c', 1.15);
    poly(c, [P(5.2, 0.2), P(11.6, 0.2), P(11.6, 1.6), P(5.2, 1.6)], '#23282f', 0.95);
    poly(c, [P(13.8, -1.8), P(16.0, -1.8), P(16.0, 1.0), P(13.8, 1.0)], '#1c2026', 1.0);

    if (a.muzzle) {
      poly(c, [P(16.0, -0.4), P(21.5, -5.6), P(20.6, -1.8), P(27.5, -0.4), P(20.6, 1.0), P(21.8, 4.6)], '#ff8c1a', 1.0);
      poly(c, [P(16.0, -0.4), P(20.4, -2.5), P(23.8, -0.4), P(20.4, 1.6)], '#fff5bd', 0.65);
    }

    const shCenter = [8.2 + lean - rec * 0.45, -2.2 + bob];
    const shRot = aim * 0.16 - rec * 0.04;
    const S = (x, y) => pt(shCenter, x, y, shRot);

    const fSh = [-1.8 + lean, -7.8 + bob];
    const fHand = S(-1.2, -0.8);
    const fElb = ik2(fSh, fHand, 5.5, 5.4, 1);
    drawSeg(c, fSh, fElb, 1.8, 1.45, T.b, T.l);
    drawSeg(c, fElb, fHand, 1.45, 1.18, T.b, T.l);
    oval(c, fSh[0] + 0.1, fSh[1] + 0.1, 2.5, 2.0, T.l, -0.25);

    poly(c, [
      S(-2.2, -10.8), S(2.6, -10.0), S(3.4, 10.6), S(-1.8, 11.2)
    ], '#272d35', 1.35);
    poly(c, [S(-1.8, -2.4), S(2.9, -2.2), S(3.0, 1.6), S(-1.9, 1.5)], T.b, 0.9);
    line(c, [S(2.2, -9.4), S(2.9, 9.8)], '#64748b', 0.9);
    poly(c, [S(-0.8, -8.4), S(2.2, -8.0), S(2.4, -4.4), S(-0.8, -4.6)], '#1e3a5f', 1.05);
    line(c, [S(0.2, -7.5), S(1.6, -7.2)], '#93c5fd', 0.95);
    dot(c, S(0.4, 5.6)[0], S(0.4, 5.6)[1], 0.55, '#64748b');
    dot(c, S(0.5, 8.6)[0], S(0.5, 8.6)[1], 0.55, '#64748b');
  }
};

// =============================================================================
// Stances and fire lines
// a.fire: draw the tracer this frame. The tracer is drawn in the figure's own frame.
// =============================================================================

// Approximate muzzle position in gun-local space, and tracer style per unit.
const MUZZLE = {
  grenadier: [31.0, -0.6], rifleman: [31.8, -0.5], sniper: [36.2, -0.4],
  heavy: [36.8, -0.5], medic: [22.0, -0.4], breacher: [27.5, -0.4]
};
const TRACER = {
  grenadier: { len: 90, w: 0.5, col: 'rgba(255,200,90,0.95)' },
  rifleman:  { len: 90, w: 0.4, col: 'rgba(255,220,130,0.95)' },
  sniper:    { len: 150, w: 0.3, col: 'rgba(255,240,170,0.98)' },
  heavy:     { len: 110, w: 0.9, col: 'rgba(255,170,60,0.9)' },
  medic:     { len: 70, w: 0.4, col: 'rgba(255,210,120,0.9)' },
  breacher:  { len: 70, w: 0.5, col: 'rgba(255,190,90,0.9)' }
};

function drawTracer(c, origin, aim, opt) {
  const x1 = origin[0] + Math.cos(aim) * opt.len;
  const y1 = origin[1] + Math.sin(aim) * opt.len;
  const g = c.createLinearGradient(origin[0], origin[1], x1, y1);
  g.addColorStop(0, opt.col);
  g.addColorStop(1, 'rgba(255,200,90,0)');
  c.save();
  c.strokeStyle = g;
  c.lineWidth = opt.w;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(origin[0], origin[1]);
  c.lineTo(x1, y1);
  c.stroke();
  c.restore();
}

/** Draws a unit standing, with the tracer when a.fire is set. */
function drawStanced(name, c, T, a) {
  c.save();
  SQUAD_UNITS[name](c, T, a);
  if (a.fire && TRACER[name]) {
    const m = MUZZLE[name];
    const aim = a.aim || 0;
    // gun pivot (approximate, matches the units' gun origin), then the muzzle along the aim
    const G = [3.0, -5.5];
    const o = pt(G, m[0], m[1], aim);
    drawTracer(c, o, aim, TRACER[name]);
  }
  c.restore();
}
