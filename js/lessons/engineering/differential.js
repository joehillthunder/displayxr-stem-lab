// The Car Differential: an open bevel-gear differential on a rear axle. Driveshaft → pinion (11
// teeth) → ring gear (41 teeth, bolted to the carrier) → two spider gears (10 teeth) on a cross
// shaft → two side gears (16 teeth) splined to the half-shafts → wheels. Straight bevel teeth are
// built from an involute profile on the back cone (Tredgold's approximation), every tooth line
// runs to the cone apex, and the gears share apexes so they mesh phase-correctly.
//
// Kinematics (all exact for ideal gears):
//   n_carrier = n_driveshaft / G,  G = 41/11
//   n_carrier = (n_L + n_R) / 2                     (open differential)
//   n_spider  = (n_L − n_R) / 2 · z_side / z_spider (relative to the carrier)
//   turn: n_inner, n_outer = n_carrier · (R ∓ T/2) / R
//
// Frame: the car drives toward +z (toward the default camera); its LEFT wheel is at +x.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const PA = (20 * Math.PI) / 180; // pressure angle
const INV = (a) => Math.tan(a) - a;
const TAU = Math.PI * 2;

const Z_RING = 41, Z_PIN = 11, Z_SIDE = 16, Z_SPI = 10;
const G = Z_RING / Z_PIN; // final-drive ratio ≈ 3.727
const TRACK = 1.6; // m, real track width used for the readouts and the road
const TYRE_R = 0.32; // m, real rolling radius used for vehicle speed
const SLOW = 1 / 20;

// Scene geometry (about metres, but the gears are drawn larger than real next to the wheels).
const YA = 0.63; // axle height
const WHEEL_X = 1.62; // wheel centre plane
const K = (2 * WHEEL_X) / TRACK; // scene units per real metre on the road
const R_RING = 0.44, M1 = (2 * R_RING) / Z_RING, F1 = 0.13;
const R_SIDE = 0.17, M2 = (2 * R_SIDE) / Z_SIDE, F2 = 0.065;
const D_PIN = Math.atan2(Z_PIN, Z_RING), D_RING = Math.PI / 2 - D_PIN;
const D_SPI = Math.atan2(Z_SPI, Z_SIDE), D_SIDE = Math.PI / 2 - D_SPI;
const R_PIN = (M1 * Z_PIN) / 2, R_SPI = (M2 * Z_SPI) / 2;

const COL_L = '#5aa9ff', COL_R = '#ff8a65';

const params = new URLSearchParams(location.search);
const fmt = (v, d = 0) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-US') : v.toFixed(d));

// ── geometry helpers ──────────────────────────────────────────────────────────────────────────

/** One tooth pitch of an involute spur profile with (possibly non-integer) zv teeth: [r, φ] pairs,
 *  tooth centred on φ = 0, from its rising flank to just before the next tooth. Tip corners are
 *  doubled so the normals stay crisp there. */
function toothProfile(zv, m) {
  const rp = (m * zv) / 2, rb = rp * Math.cos(PA), ra = rp + m, rf = rp - 1.25 * m;
  const r0 = Math.max(rb, rf + 0.05 * m);
  const psiP = Math.PI / (2 * zv) + INV(PA);
  const NF = 7;
  const fr = [], fa = [];
  for (let i = 0; i <= NF; i++) {
    const t = i / NF;
    const r = r0 + (ra - r0) * t * (0.35 + 0.65 * t);
    fr.push(r);
    fa.push(psiP - INV(Math.acos(Math.min(1, rb / r))));
  }
  const step = TAU / zv, psi0 = fa[0];
  const gapHalf = (step - 2 * psi0) / 2;
  const fil = Math.min(gapHalf * 0.45, (0.38 * m) / rf);
  const out = [];
  const P = (r, a) => out.push([r, a]);
  const bez = (ra0, aa0, rc, ac, ra1, aa1, ts) => {
    const x0 = ra0 * Math.cos(aa0), y0 = ra0 * Math.sin(aa0);
    const xc = rc * Math.cos(ac), yc = rc * Math.sin(ac);
    const x1 = ra1 * Math.cos(aa1), y1 = ra1 * Math.sin(aa1);
    for (const t of ts) {
      const u = 1 - t;
      const x = u * u * x0 + 2 * u * t * xc + t * t * x1, y = u * u * y0 + 2 * u * t * yc + t * t * y1;
      P(Math.hypot(x, y), Math.atan2(y, x));
    }
  };
  for (let i = 0; i <= NF; i++) P(fr[i], -fa[i]);
  P(ra, -fa[NF]);
  for (let j = 1; j < 4; j++) P(ra, -fa[NF] + (2 * fa[NF] * j) / 4);
  P(ra, fa[NF]);
  for (let i = NF; i >= 0; i--) P(fr[i], fa[i]);
  const a0 = psi0, a1 = step - psi0;
  bez(r0, a0, rf, a0, rf, a0 + fil, [0.33, 0.66, 1]);
  for (let j = 1; j < 4; j++) P(rf, a0 + fil + ((a1 - a0 - 2 * fil) * j) / 4);
  bez(rf, a1 - fil, rf, a1, r0, a1, [0, 0.34, 0.67]);
  return { pts: out, rpv: rp };
}

/**
 * Straight bevel gear teeth: z teeth, outer (heel) module m, pitch-cone angle δ, face width F.
 * Axis +y, cone apex at the origin, tooth 0 centred at local angle 0 where angle = atan2(-z, x)
 * (so rotation.y adds to it). Returns the toothed shell and the root-cone points for the body.
 */
function bevelGear(z, m, delta, F) {
  const Rp = (m * z) / 2, L = Rp / Math.sin(delta), H = L * Math.cos(delta), s0 = (L - F) / L;
  const zv = z / Math.cos(delta);
  const { pts, rpv } = toothProfile(zv, m);
  const cd = Math.cos(delta), sd = Math.sin(delta);
  const dIn = -1.25 * m - 0.5 * m;
  const heel = [], inner = [], ang = [];
  for (let k = 0; k < z; k++) {
    for (const [r, phi] of pts) {
      const d = r - rpv, th = (phi * zv) / z + (k * TAU) / z;
      const rho = Rp + d * cd, y = H - d * sd;
      const ri = Rp + dIn * cd, yi = H - dIn * sd;
      heel.push([rho * Math.cos(th), y, -rho * Math.sin(th)]);
      inner.push([ri * Math.cos(th), yi, -ri * Math.sin(th)]);
      ang.push(th);
    }
  }
  const N = heel.length;
  const pos = [], uv = [], parts = [];
  const add = (p, u, v) => { pos.push(p[0], p[1], p[2]); uv.push(u, v); return pos.length / 3 - 1; };
  const sc = (p, s) => [p[0] * s, p[1] * s, p[2] * s];
  // Each part: two rings of vertices and an expected outward direction (from the angle).
  const ring = (A, B, dir) => {
    const ia = [], ib = [];
    for (let i = 0; i < N; i++) { ia.push(add(A[i], (ang[i] / TAU) * 6, 0)); ib.push(add(B[i], (ang[i] / TAU) * 6, 0.3)); }
    parts.push({ ia, ib, dir });
  };
  ring(heel, heel.map((p) => sc(p, s0)), (th) => [cd * Math.cos(th), -sd, -cd * Math.sin(th)]); // tooth surface
  ring(heel, inner, (th) => [sd * Math.cos(th), cd, -sd * Math.sin(th)]); // heel cap (back cone)
  ring(heel.map((p) => sc(p, s0)), inner.map((p) => sc(p, s0)), (th) => [-sd * Math.cos(th), -cd, sd * Math.sin(th)]); // toe cap
  const index = [];
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  const P = (i, v) => v.set(pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]);
  for (const { ia, ib, dir } of parts) {
    const tris = [];
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      tris.push([ia[i], ib[i], ib[j]], [ia[i], ib[j], ia[j]]);
    }
    // Orient the part so its faces point outward.
    let score = 0;
    for (let t = 0; t < tris.length; t += 7) {
      const [a, b, c] = tris[t];
      P(a, va); P(b, vb); P(c, vc);
      e1.subVectors(vb, va); e2.subVectors(vc, va); e1.cross(e2);
      const th = Math.atan2(-(va.z + vb.z + vc.z), va.x + vb.x + vc.x);
      const d = dir(th);
      score += e1.x * d[0] + e1.y * d[1] + e1.z * d[2];
    }
    for (const [a, b, c] of tris) { if (score >= 0) index.push(a, b, c); else index.push(a, c, b); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const db = -1.25 * m - 0.2 * m;
  const rb = Rp + db * cd, yb = H - db * sd;
  return { geo, Rp, L, H, s0, heelRoot: [rb, yb], toeRoot: [rb * s0, yb * s0], tipHeel: [Rp + m * cd, H - m * sd] };
}

/**
 * Revolve a closed (ρ, y) profile about +y, like LatheGeometry but with crisp corners: segments
 * meeting at more than `smooth` radians get separate normals. Traverse the profile anticlockwise
 * (ρ to the right, y up) for outward faces. A point at angle φ lands at (ρ sin φ, y, ρ cos φ).
 */
function revolve(pts, { segs = 64, phiStart = 0, phiLength = TAU, smooth = 0.45 } = {}) {
  const S = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const dr = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dr, dy);
    if (len < 1e-7) continue;
    S.push({ a, b, nr: dy / len, ny: -dr / len, len });
  }
  const cosS = Math.cos(smooth);
  const pos = [], nor = [], uv = [], index = [];
  let vacc = 0;
  S.forEach((s, i) => {
    const pv = S[(i - 1 + S.length) % S.length], nx = S[(i + 1) % S.length];
    const avg = (o) => {
      if (o.nr * s.nr + o.ny * s.ny < cosS) return [s.nr, s.ny];
      const r = o.nr + s.nr, y = o.ny + s.ny, l = Math.hypot(r, y) || 1;
      return [r / l, y / l];
    };
    const na = avg(pv), nb = avg(nx);
    const base = pos.length / 3;
    for (let j = 0; j <= segs; j++) {
      const ph = phiStart + (phiLength * j) / segs, sn = Math.sin(ph), cs = Math.cos(ph);
      pos.push(s.a[0] * sn, s.a[1], s.a[0] * cs, s.b[0] * sn, s.b[1], s.b[0] * cs);
      nor.push(na[0] * sn, na[1], na[0] * cs, nb[0] * sn, nb[1], nb[0] * cs);
      uv.push((j / segs) * 4, vacc * 4, (j / segs) * 4, (vacc + s.len) * 4);
    }
    vacc += s.len;
    for (let j = 0; j < segs; j++) {
      const a0 = base + 2 * j, b0 = a0 + 1, a1 = a0 + 2, b1 = a0 + 3;
      index.push(a0, a1, b0, b0, a1, b1);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  return geo;
}

/** A partial revolve plus flat caps on both cut faces (for cutaways and windows). */
function revolveCut(pts, mat, capMat, phiStart, phiLength, segs = 48) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(revolve(pts, { segs, phiStart, phiLength }), mat));
  const shapeGeo = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([r, y]) => new THREE.Vector2(r, y))));
  for (const ph of [phiStart, phiStart + phiLength]) {
    const c = new THREE.Mesh(shapeGeo, capMat);
    c.rotation.y = ph - Math.PI / 2;
    g.add(c);
  }
  return g;
}

const mirrorY = (pts) => pts.map(([r, y]) => [r, -y]).reverse();

function brushedTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#8a8a8a';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1600; i++) {
    const y = Math.random() * 256, v = (95 + Math.random() * 90) | 0, x = Math.random() * 300 - 40;
    g.strokeStyle = `rgba(${v},${v},${v},0.35)`;
    g.lineWidth = 0.4 + Math.random() * 1.2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 40 + Math.random() * 140, y);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Speckled roughness for cast iron. */
function castTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#9a9a9a';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) {
    const v = (110 + Math.random() * 120) | 0;
    g.fillStyle = `rgba(${v},${v},${v},0.5)`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function shadowed(o) {
  o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return o;
}

function clear(g) {
  for (let i = g.children.length - 1; i >= 0; i--) {
    const c = g.children[i];
    c.traverse((o) => o.geometry?.dispose?.());
    g.remove(c);
  }
}

// ── lesson ────────────────────────────────────────────────────────────────────────────────────

export default {
  view: { dist: 5.4, yaw: 0.55, pitch: 0.36, target: [0, 0.55, 0.2], minDist: 1.2, maxDist: 16 },
  floor: true,
  explain: `
<p>When a car turns a corner, its wheels follow circles of different sizes. The outside wheel has further to go than the inside wheel in the same time, so it must spin faster. If both driven wheels were fixed to one solid axle, one tyre would have to skid. The <b>differential</b> solves this: it sends the engine’s power to both wheels but lets them turn at different speeds.</p>
<p><b>Step 1: the final drive.</b> The driveshaft turns a small <b>pinion</b> gear, which drives a big <b>ring gear</b>. They are <b>bevel gears</b> (cone-shaped), so the drive turns through 90° to line up with the axles. With 41 teeth on the ring and 11 on the pinion, the ring turns 41/11 ≈ 3.73 times more slowly than the driveshaft, with 3.73 times the torque. This is the <b>final-drive ratio</b>.</p>
<p><b>Step 2: the differential.</b> The ring gear is bolted to the <b>carrier</b>, a case holding a cross shaft with two small <b>spider gears</b>. The spiders mesh with two <b>side gears</b>, and each side gear is splined to one axle half-shaft. Driving straight, the spiders don’t turn on their shaft: they just carry both side gears round, so the whole carrier turns as one block. In a turn the spiders roll round the side gears, so one wheel speeds up by exactly as much as the other slows down. The rule is: <b>carrier speed = the average of the two wheel speeds</b>.</p>
<p><b>The catch.</b> An open differential always gives the two wheels <b>equal torque</b>, because each spider gear pushes equally on both side gears, like a balance beam. If one wheel is on ice, it can only take a tiny torque before it slips, so the other wheel gets the same tiny torque, which is not enough to move the car. The ice wheel spins at twice the carrier speed and the car sits still.</p>
<p>A <b>locking differential</b> joins the two half-shafts so they must turn together. That gets you out of mud or off ice, but on a dry road in a turn the tyres have to <b>scrub</b> (slide sideways and hop), which wears them and strains the axle, so drivers unlock it. A <b>limited-slip differential</b> sits in between: clutches or special gears resist a speed difference, so some extra torque can go to the wheel with grip, while the car can still turn smoothly.</p>
<p><b>Simplified here:</b> ideal gears with no friction losses; straight bevel teeth (real final drives use curved spiral-bevel or offset hypoid teeth, which run more quietly); the gears are drawn much larger than real next to the wheels; the turn uses simple geometry (the middle of the rear axle follows a circle of radius R, with no tyre slip angles). Speeds use a 1.6 m track and a 0.32 m tyre radius.</p>`,
  formula: 'G = z<sub>ring</sub> / z<sub>pinion</sub> = 41/11 ≈ 3.73 &nbsp;·&nbsp; n<sub>carrier</sub> = n<sub>driveshaft</sub> / G = (n<sub>L</sub> + n<sub>R</sub>) / 2 &nbsp;·&nbsp; n<sub>spider</sub> = ½(n<sub>L</sub> − n<sub>R</sub>) · z<sub>side</sub> / z<sub>spider</sub> &nbsp;·&nbsp; n<sub>inner, outer</sub> = n<sub>carrier</sub> · (R ∓ T/2) / R',
  vocab: [
    ['Differential', 'The gearset in a drive axle that splits the drive between two wheels and lets them turn at different speeds.'],
    ['Final-drive ratio', 'Ring-gear teeth ÷ pinion teeth. The carrier turns this many times more slowly than the driveshaft.'],
    ['Bevel gear', 'A cone-shaped gear. Two bevel gears turn the drive through an angle, here 90°.'],
    ['Pinion', 'The small gear on the end of the driveshaft that drives the ring gear.'],
    ['Ring gear', 'The large bevel gear bolted to the carrier, also called the crown wheel.'],
    ['Carrier', 'The case that turns with the ring gear and holds the cross shaft and spider gears.'],
    ['Spider gears', 'Small bevel gears on the cross shaft. They spin on the shaft only when the two wheels turn at different speeds.'],
    ['Side gears', 'The two bevel gears splined to the axle half-shafts, one for each wheel.'],
    ['Track width (T)', 'The distance between the centres of the left and right tyres.'],
    ['Locking differential', 'A differential that can join both half-shafts so they turn at the same speed.'],
    ['Limited-slip differential', 'A differential with clutches or special gears that resist a speed difference, sending more torque to the wheel with grip.'],
  ],
  quiz: [
    {
      q: 'A ring gear has 40 teeth and the pinion has 10. The driveshaft turns at 2,000 RPM. How fast does the carrier turn?',
      choices: ['8,000 RPM', '2,000 RPM', '500 RPM', '200 RPM'],
      answer: 2,
      why: 'The final-drive ratio is 40/10 = 4, so the carrier turns 4 times more slowly: 2,000 ÷ 4 = 500 RPM.',
    },
    {
      q: 'A car turns a corner with its carrier at 300 RPM. The inner wheel turns at 270 RPM. How fast does the outer wheel turn?',
      choices: ['300 RPM', '330 RPM', '570 RPM', '30 RPM'],
      answer: 1,
      why: 'The carrier speed is the average of the two wheels: (270 + n)/2 = 300, so n = 330 RPM. The outer wheel gains exactly what the inner one loses.',
    },
    {
      q: 'The car drives in a straight line on a dry road. What do the spider gears do?',
      choices: ['They spin on their cross shaft at the carrier speed', 'They go round with the carrier but do not spin on their shaft', 'They stay still while the carrier turns', 'They spin twice as fast as the wheels'],
      answer: 1,
      why: 'Both side gears turn at the same speed as the carrier, so nothing moves relative to the carrier. The spiders act like a solid link, and the whole carrier turns as one block.',
    },
    {
      q: 'An open differential has one wheel on ice and the other on dry tarmac. The carrier turns at 200 RPM and the car does not move. How fast is the wheel on ice spinning?',
      choices: ['0 RPM', '100 RPM', '200 RPM', '400 RPM'],
      answer: 3,
      why: 'The gripping wheel is not turning (0 RPM). The carrier is the average, (0 + n)/2 = 200, so the ice wheel spins at 400 RPM, twice the carrier speed.',
    },
    {
      q: 'Why should a locked differential be unlocked before turning on a dry road?',
      choices: ['Locking it disconnects the engine from the wheels', 'Locking it makes the inside wheel spin faster than the outside one', 'Both wheels are forced to turn at the same speed, but the outer wheel has further to go, so the tyres scrub and the axle is strained', 'Locking it changes the final-drive ratio'],
      answer: 2,
      why: 'In a turn the outer tyre’s path is longer. Locked axles must turn together, so the tyres slide and hop against the road, wearing them and twisting the axle.',
    },
  ],

  build(ctx) {
    // Test-only URL options (pose a state for a headless screenshot):
    //   sc=straight|left|right|ice   scenario            r=<m>        turn radius (3–30)
    //   rpm=<n>        driveshaft RPM                     lock         lock the differential
    //   housing=cut|glass|solid      housing view        slow=0       real-time motion
    //   t=<s>          advance the motion by s seconds    pause        start paused
    //   look=gears|core|top|wheel|pinion  camera close-up     nolabels     hide labels
    //   pick=pinion|ring|carrier|spider|side|axle|wheel|housing|driveshaft   open that part's card
    //   selftest       log kinematic and mesh checks to the console
    const { root } = ctx;
    const ACC = 0xffb347;

    // ── materials ──
    const brush = brushedTexture();
    brush.repeat.set(2, 2);
    const cast = castTexture();
    cast.repeat.set(3, 3);
    const gearSteel = new THREE.MeshPhysicalMaterial({ color: 0xc9cdd4, metalness: 1, roughness: 0.36, roughnessMap: brush, clearcoat: 0.2, clearcoatRoughness: 0.3 });
    const pinSteel = new THREE.MeshPhysicalMaterial({ color: 0xd8c39a, metalness: 1, roughness: 0.34, roughnessMap: brush, clearcoat: 0.2 });
    const spiderSteel = new THREE.MeshPhysicalMaterial({ color: 0xbcc8d8, metalness: 1, roughness: 0.3, roughnessMap: brush, clearcoat: 0.25 });
    const bright = new THREE.MeshStandardMaterial({ color: 0xe3e6eb, metalness: 1, roughness: 0.18 });
    const darkSteel = new THREE.MeshStandardMaterial({ color: 0x6c727c, metalness: 1, roughness: 0.34, roughnessMap: brush });
    const iron = new THREE.MeshStandardMaterial({ color: 0x6a6e74, metalness: 0.75, roughness: 0.62, roughnessMap: cast });
    const housingPaint = new THREE.MeshPhysicalMaterial({ color: 0x2a2f37, metalness: 0.35, roughness: 0.55, roughnessMap: cast, clearcoat: 0.35, clearcoatRoughness: 0.4 });
    const housingGlass = new THREE.MeshPhysicalMaterial({ color: 0x9fb6cc, metalness: 0.1, roughness: 0.15, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide });
    const cutMat = new THREE.MeshStandardMaterial({ color: ACC, metalness: 0.2, roughness: 0.6, side: THREE.DoubleSide });
    const accentPaint = new THREE.MeshPhysicalMaterial({ color: ACC, metalness: 0.3, roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.2 });
    const rubber = new THREE.MeshPhysicalMaterial({ color: 0x17191c, metalness: 0, roughness: 0.9, sheen: 0.3, sheenColor: 0x444444 });
    const alloy = new THREE.MeshPhysicalMaterial({ color: 0xcfd3d9, metalness: 1, roughness: 0.24, clearcoat: 0.6, clearcoatRoughness: 0.15 });
    const shaftMat = new THREE.MeshPhysicalMaterial({ color: 0xb8bec7, metalness: 1, roughness: 0.28, roughnessMap: brush });
    const tubeMat = new THREE.MeshPhysicalMaterial({ color: 0x3a3f47, metalness: 0.5, roughness: 0.4, clearcoat: 0.5 });
    const asphalt = new THREE.MeshStandardMaterial({ color: 0x24272d, roughness: 0.95, metalness: 0 });
    const lineWhite = new THREE.MeshStandardMaterial({ color: 0xd9dde4, roughness: 0.7, emissive: 0x333333 });
    const trackL = new THREE.MeshBasicMaterial({ color: COL_L, toneMapped: false });
    const trackR = new THREE.MeshBasicMaterial({ color: COL_R, toneMapped: false });
    const iceMat = new THREE.MeshPhysicalMaterial({ color: 0xa8dcff, emissive: 0x1a3a55, roughness: 0.05, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.5 });

    const mesh = (geo, mat) => new THREE.Mesh(geo, mat);
    const xAxis = (geo) => { geo.rotateZ(-Math.PI / 2); return geo; }; // cylinder along +x

    // ── state ──
    const sc0 = params.get('sc');
    const S = {
      sc: ['straight', 'left', 'right', 'ice'].includes(sc0) ? sc0 : 'straight',
      radius: Math.min(30, Math.max(3, +params.get('r') || 6)),
      rpm: params.has('rpm') ? Math.min(3000, Math.max(0, +params.get('rpm'))) : 1200,
      lock: params.has('lock'),
      housing: ['cut', 'glass', 'solid'].includes(params.get('housing')) ? params.get('housing') : 'cut',
      slow: params.get('slow') !== '0',
      labels: !params.has('nolabels'),
      playing: !params.has('pause'),
    };
    let phiC = 0; // carrier angle about +x (forward roll is positive)
    let dif = 0; // θ_L − φ_C: how far the left half-shaft has turned relative to the carrier

    // ── assembly groups ──
    const asm = new THREE.Group();
    asm.position.set(0, YA, 0);
    root.add(asm);
    const carrierG = new THREE.Group(); // turns with the ring gear about +x
    const axleL = new THREE.Group(), axleR = new THREE.Group(); // turn with each wheel about +x
    const pinionHolder = new THREE.Group(); // axis +z (the driveshaft points at the camera)
    pinionHolder.rotation.x = Math.PI / 2;
    const pinionSpin = new THREE.Group();
    pinionHolder.add(pinionSpin);
    const housingG = new THREE.Group();
    asm.add(carrierG, axleL, axleR, pinionHolder, housingG);

    // ── gears ──
    const ringB = bevelGear(Z_RING, M1, D_RING, F1);
    const pinB = bevelGear(Z_PIN, M1, D_PIN, F1);
    const sideB = bevelGear(Z_SIDE, M2, D_SIDE, F2);
    const spiB = bevelGear(Z_SPI, M2, D_SPI, F2);

    // Ring gear: axis −x (on the car's right side), bolted to the carrier flange.
    const ringHolder = new THREE.Group();
    ringHolder.rotation.z = Math.PI / 2; // local +y → world −x
    const ringSpin = new THREE.Group();
    ringHolder.add(ringSpin);
    {
      const [hr, hy] = ringB.heelRoot, [tr, ty] = ringB.toeRoot;
      const rIn = 0.287, yBack = 0.185;
      ringSpin.add(mesh(ringB.geo, gearSteel));
      ringSpin.add(mesh(revolve([[rIn, ty], [tr, ty], [hr, hy], [hr + 0.004, hy + 0.01], [hr + 0.004, yBack - 0.004], [hr, yBack], [rIn, yBack]], { segs: 96 }), gearSteel));
      // Bolt holes' worth of bolts are on the carrier flange (below).
    }
    carrierG.add(ringHolder);

    // Pinion with its shank, bearings' journal, companion flange and driveshaft (all spin together).
    const pinionGearG = new THREE.Group(), driveG = new THREE.Group();
    pinionSpin.add(pinionGearG, driveG);
    {
      const [hr, hy] = pinB.heelRoot, [tr, ty] = pinB.toeRoot;
      pinionGearG.add(mesh(pinB.geo, pinSteel));
      pinionGearG.add(mesh(revolve([[0, ty - 0.03], [0.03, ty - 0.03], [tr, ty], [hr, hy], [hr, 0.475], [0.052, 0.48], [0.048, 0.5], [0.048, 0.86], [0, 0.86]], { segs: 48 }), pinSteel));
      // Companion flange with 4 bolts, a universal joint and the driveshaft tube.
      driveG.add(mesh(revolve([[0, 0.855], [0.055, 0.855], [0.06, 0.87], [0.11, 0.875], [0.11, 0.9], [0, 0.9]], { segs: 48 }), darkSteel));
      const boltGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.022, 6);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + Math.PI / 4;
        const b = mesh(boltGeo, bright);
        b.position.set(Math.sin(a) * 0.085, 0.91, Math.cos(a) * 0.085);
        driveG.add(b);
      }
      const ear = new RoundedBoxGeometry(0.03, 0.09, 0.05, 2, 0.01);
      for (const s of [-1, 1]) {
        const e1 = mesh(ear, darkSteel); e1.position.set(s * 0.065, 0.935, 0); driveG.add(e1);
        const e2 = mesh(ear, darkSteel); e2.position.set(0, 1.0, s * 0.065); driveG.add(e2);
      }
      const cross1 = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.15, 12), bright); cross1.rotation.z = Math.PI / 2; cross1.position.y = 0.965;
      const cross2 = mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.15, 12), bright); cross2.rotation.x = Math.PI / 2; cross2.position.y = 0.965;
      driveG.add(cross1, cross2);
      driveG.add(mesh(revolve([[0, 1.03], [0.09, 1.03], [0.09, 1.05], [0.062, 1.07], [0.062, 1.86], [0.07, 1.87], [0.07, 1.9], [0, 1.9]], { segs: 48 }), tubeMat));
      const weld = mesh(new THREE.TorusGeometry(0.064, 0.006, 8, 40), darkSteel); weld.rotation.x = Math.PI / 2; weld.position.y = 1.075; driveG.add(weld);
    }

    // Carrier case (built about local +y, mapped to world −x so its flange faces the ring gear).
    const caseG = new THREE.Group();
    caseG.rotation.z = Math.PI / 2;
    carrierG.add(caseG);
    {
      const hubRing = [[0.065, 0.28], [0.097, 0.28], [0.1, 0.29], [0.1, 0.43], [0.094, 0.44], [0.065, 0.44]];
      const flangeBell = [[0.25, 0.185], [0.405, 0.185], [0.415, 0.193], [0.415, 0.227], [0.405, 0.235], [0.26, 0.235], [0.2, 0.262], [0.115, 0.3], [0.065, 0.3], [0.065, 0.282], [0.17, 0.245], [0.225, 0.212], [0.235, 0.185]];
      const plainBell = [[0.25, 0.185], [0.275, 0.185], [0.27, 0.21], [0.2, 0.262], [0.115, 0.3], [0.065, 0.3], [0.065, 0.282], [0.17, 0.245], [0.225, 0.212], [0.235, 0.185]];
      const band = [[0.25, -0.185], [0.275, -0.185], [0.275, 0.185], [0.25, 0.185]];
      caseG.add(mesh(revolve(hubRing, { segs: 48 }), iron), mesh(revolve(mirrorY(hubRing), { segs: 48 }), iron));
      caseG.add(mesh(revolve(flangeBell, { segs: 96 }), iron));
      // The middle band has two big windows facing ±z (at the start), so the gears show.
      for (const c of [Math.PI / 2, (3 * Math.PI) / 2]) caseG.add(revolveCut(band, iron, iron, c - 0.4, 0.8, 16), revolveCut(mirrorY(plainBell), iron, iron, c - 0.4, 0.8, 16));
      // The open (left) side: two arms of the bell join the band to the hub, so the left side gear shows too.
      caseG.add(mesh(revolve([[0.065, -0.3], [0.115, -0.3], [0.115, -0.282], [0.065, -0.282]], { segs: 48 }), iron));
      // Ring-gear bolts on the flange.
      const boltGeo = new THREE.CylinderGeometry(0.017, 0.017, 0.016, 6);
      const bolts = new THREE.InstancedMesh(boltGeo, bright, 10);
      const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
        bolts.setMatrixAt(i, mtx.compose(v.set(Math.sin(a) * 0.36, 0.243, Math.cos(a) * 0.36), q, one));
      }
      caseG.add(bolts);
    }
    // Cross-shaft bosses, cross shaft and its lock pin (carrier frame: shaft along y).
    const spiderG = new THREE.Group();
    carrierG.add(spiderG);
    {
      for (const s of [-1, 1]) {
        const boss = mesh(new THREE.CylinderGeometry(0.052, 0.056, 0.07, 32), iron);
        boss.position.y = s * 0.285;
        carrierG.add(boss);
      }
      const shaft = mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.64, 24), bright);
      spiderG.add(shaft);
      const pin = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 10), darkSteel);
      pin.rotation.z = Math.PI / 2;
      pin.position.y = 0.3;
      spiderG.add(pin);
    }
    const spiderSpins = [];
    for (const s of [1, -1]) {
      const h = new THREE.Group();
      if (s < 0) h.rotation.x = Math.PI; // local +y → world −y
      const spin = new THREE.Group();
      h.add(spin);
      const [hr, hy] = spiB.heelRoot, [tr, ty] = spiB.toeRoot;
      spin.add(mesh(spiB.geo, spiderSteel));
      // Spherical back (concentric with the cone apex, as on real spider gears) and a bore.
      const Rs = Math.hypot(hr, hy) + 0.012;
      const back = [];
      for (let i = 0; i <= 8; i++) {
        const a0 = Math.atan2(hr, Math.sqrt(Math.max(0, Rs * Rs - hr * hr)));
        const a = a0 + ((Math.asin(0.0255 / Rs) - a0) * i) / 8;
        back.push([Rs * Math.sin(a), Rs * Math.cos(a)]);
      }
      spin.add(mesh(revolve([[0.0255, ty - 0.004], [tr, ty], [hr, hy], ...back, [0.0255, back[back.length - 1][1]]], { segs: 48, smooth: 0.6 }), spiderSteel));
      spiderG.add(h);
      spiderSpins.push({ holder: h, spin });
    }

    // Side gears, half-shafts, brake rotors and wheels. axle groups turn about +x.
    const sideSpins = {};
    const wheelGroups = {};
    const shaftGroups = {};
    const tread = new RoundedBoxGeometry(0.05, 0.11, 0.026, 2, 0.006);
    for (const side of ['L', 'R']) {
      const sx = side === 'L' ? 1 : -1;
      const ax = side === 'L' ? axleL : axleR;
      const holder = new THREE.Group();
      holder.rotation.z = -sx * Math.PI / 2; // local +y → outward (±x)
      const spin = new THREE.Group();
      holder.add(spin);
      const [hr, hy] = sideB.heelRoot, [tr, ty] = sideB.toeRoot;
      spin.add(mesh(sideB.geo, gearSteel));
      spin.add(mesh(revolve([[0.037, ty - 0.004], [tr, ty], [hr, hy], [hr, 0.14], [0.062, 0.145], [0.06, 0.36], [0.037, 0.36]], { segs: 64 }), gearSteel));
      // Splines on the inner end of the half-shaft, visible between the gear hub and the carrier.
      const sh = new THREE.Group();
      sh.add(mesh(xAxis(new THREE.CylinderGeometry(0.035, 0.035, 1.55, 28)), shaftMat));
      sh.children[0].position.x = sx * (0.04 + 1.55 / 2);
      const spl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.012, 0.012), shaftMat, 14);
      const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * TAU;
        q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), a);
        spl.setMatrixAt(i, mtx.compose(v.set(sx * 0.42, Math.cos(a) * 0.036, Math.sin(a) * 0.036), q, one));
      }
      sh.add(spl);
      // Hub flange with 5 studs.
      const hubF = mesh(xAxis(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 40)), darkSteel);
      hubF.position.x = sx * 1.575;
      sh.add(hubF);
      ax.add(holder, sh);
      shaftGroups[side] = sh;
      sideSpins[side] = { holder, spin };

      // Ventilated brake rotor (turns with the wheel).
      const rotorG = new THREE.Group();
      rotorG.rotation.z = -sx * Math.PI / 2;
      rotorG.position.x = sx * 1.52;
      rotorG.add(mesh(revolve([[0.11, -0.032], [0.3, -0.032], [0.3, -0.012], [0.135, -0.012], [0.135, 0.012], [0.3, 0.012], [0.3, 0.032], [0.11, 0.032]], { segs: 64 }), darkSteel));
      const vanes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.008, 0.026, 0.16), darkSteel, 30);
      for (let i = 0; i < 30; i++) {
        const a = (i / 30) * TAU;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
        vanes.setMatrixAt(i, mtx.compose(v.set(Math.sin(a) * 0.22, 0, Math.cos(a) * 0.22), q, one));
      }
      rotorG.add(vanes);
      ax.add(rotorG);

      // Wheel: alloy rim with 5 spokes, lug nuts, tyre with staggered tread blocks.
      const wheel = new THREE.Group();
      wheel.rotation.z = -sx * Math.PI / 2;
      wheel.position.x = sx * WHEEL_X;
      wheel.add(mesh(revolve([[0.4, -0.172], [0.47, -0.176], [0.555, -0.17], [0.592, -0.145], [0.6, -0.1], [0.6, 0.1], [0.592, 0.145], [0.555, 0.17], [0.47, 0.176], [0.4, 0.172]], { segs: 96, smooth: 0.7 }), rubber));
      const blocks = new THREE.InstancedMesh(tread, rubber, 96);
      for (let i = 0; i < 96; i++) {
        const row = i % 2, a = ((i >> 1) / 48) * TAU + row * (TAU / 96);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
        blocks.setMatrixAt(i, mtx.compose(v.set(Math.sin(a) * 0.605, row ? 0.062 : -0.062, Math.cos(a) * 0.605), q, one));
      }
      wheel.add(blocks);
      wheel.add(mesh(revolve([[0.375, -0.165], [0.41, -0.168], [0.41, -0.15], [0.385, -0.14], [0.385, 0.12], [0.41, 0.135], [0.415, 0.165], [0.395, 0.17], [0.37, 0.15], [0.37, -0.15]], { segs: 80 }), alloy));
      wheel.add(mesh(revolve([[0.05, 0.03], [0.15, 0.03], [0.16, 0.06], [0.15, 0.09], [0.06, 0.1], [0.05, 0.1]], { segs: 48 }), alloy));
      const spokeGeo = new RoundedBoxGeometry(0.075, 0.035, 0.25, 3, 0.012);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        const sp = mesh(spokeGeo, alloy);
        sp.position.set(Math.sin(a) * 0.265, 0.1 + 0.02, Math.cos(a) * 0.265);
        sp.rotation.y = a;
        sp.rotation.x = 0;
        wheel.add(sp);
      }
      const nuts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 6), bright, 5);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU + TAU / 10;
        nuts.setMatrixAt(i, mtx.compose(v.set(Math.sin(a) * 0.1, 0.11, Math.cos(a) * 0.1), q.identity(), one));
      }
      wheel.add(nuts);
      const cap = mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.03, 32), accentPaint);
      cap.position.y = 0.115;
      wheel.add(cap);
      ax.add(wheel);
      wheelGroups[side] = wheel;
    }

    // ── housing (stationary) ──
    const housingParts = { full: new THREE.Group(), cut: new THREE.Group(), fixed: new THREE.Group() };
    housingG.add(housingParts.full, housingParts.cut, housingParts.fixed);
    const fullMeshes = [];
    {
      // Banjo around the carrier (local +y → world −x).
      const banjo = [[0.11, -0.6], [0.2, -0.5], [0.42, -0.37], [0.53, -0.2], [0.56, 0], [0.53, 0.2], [0.42, 0.37], [0.2, 0.5], [0.11, 0.6],
        [0.075, 0.6], [0.17, 0.47], [0.39, 0.345], [0.5, 0.19], [0.53, 0], [0.5, -0.19], [0.39, -0.345], [0.17, -0.47], [0.075, -0.6]];
      const nose = [[0.2, 0.5], [0.2, 0.6], [0.16, 0.68], [0.125, 0.72], [0.125, 0.8], [0.15, 0.81], [0.15, 0.84], [0.06, 0.84], [0.06, 0.74], [0.09, 0.7], [0.17, 0.6], [0.17, 0.5]];
      const tube = [[0.05, 0.58], [0.08, 0.58], [0.08, 1.31], [0.27, 1.32], [0.27, 1.36], [0.05, 1.36]];
      const place = (o, kind, sx) => {
        if (kind === 'banjo') o.rotation.z = Math.PI / 2;
        else if (kind === 'nose') o.rotation.x = Math.PI / 2;
        else o.rotation.z = -sx * Math.PI / 2;
        return o;
      };
      const full = (pts, kind, sx) => {
        const m = mesh(revolve(pts, { segs: 72 }), housingPaint);
        fullMeshes.push(m);
        housingParts.full.add(place(m, kind, sx));
      };
      full(banjo, 'banjo'); full(nose, 'nose'); full(tube, 'tube', 1); full(tube, 'tube', -1);
      // Cutaway: keep the far half of the banjo (z < 0) and the bottom half of the nose and tubes.
      housingParts.cut.add(place(revolveCut(banjo, housingPaint, cutMat, Math.PI / 2, Math.PI, 48), 'banjo'));
      housingParts.cut.add(place(revolveCut(nose, housingPaint, cutMat, -Math.PI / 2, Math.PI, 32), 'nose'));
      // Tube bottom half: for +x, world y = −ρ sin φ (φ in 0..π); for −x, world y = ρ sin φ (φ in π..2π).
      housingParts.cut.add(place(revolveCut(tube, housingPaint, cutMat, 0, Math.PI, 32), 'tube', 1));
      housingParts.cut.add(place(revolveCut(tube, housingPaint, cutMat, Math.PI, Math.PI, 32), 'tube', -1));
      // Always-visible: pinion bearing cups, brake calipers.
      for (const z of [0.6, 0.78]) {
        const cup = mesh(new THREE.TorusGeometry(0.062, 0.014, 10, 40), darkSteel);
        cup.position.z = z;
        housingParts.fixed.add(cup);
      }
      for (const sx of [1, -1]) {
        const cal = mesh(new RoundedBoxGeometry(0.11, 0.17, 0.12, 3, 0.03), accentPaint);
        cal.position.set(sx * 1.52, 0.2, 0.2);
        cal.rotation.x = -0.8;
        housingParts.fixed.add(cal);
      }
    }

    shadowed(asm);
    for (const m of fullMeshes) m.receiveShadow = true;

    // ── road, tyre tracks, ice ──
    const roadG = new THREE.Group();
    root.add(roadG);
    function rebuildRoad() {
      clear(roadG);
      const turn = S.sc === 'left' || S.sc === 'right';
      const W = 2 * WHEEL_X + 1.3, LEN = 6.2;
      if (!turn) {
        const road = mesh(new THREE.PlaneGeometry(W, LEN), asphalt);
        road.rotation.x = -Math.PI / 2; road.position.y = 0.004;
        road.receiveShadow = true;
        roadG.add(road);
        for (const s of [-1, 1]) {
          const edge = mesh(new THREE.PlaneGeometry(0.05, LEN), lineWhite);
          edge.rotation.x = -Math.PI / 2; edge.position.set(s * (W / 2 - 0.1), 0.006, 0);
          roadG.add(edge);
          const tr = mesh(new THREE.PlaneGeometry(0.06, LEN), s > 0 ? trackL : trackR);
          tr.rotation.x = -Math.PI / 2; tr.position.set(s * WHEEL_X, 0.007, 0);
          roadG.add(tr);
        }
        addArrow(0, 2.5, 0);
      } else {
        const Rs = S.radius * K, sgn = S.sc === 'left' ? 1 : -1; // turn centre at x = sgn·Rs (left = +x)
        const span = Math.min(1.2, 2.9 / Rs);
        const a0 = sgn > 0 ? Math.PI : 0;
        const ringAt = (r0, r1, mat, y) => {
          const m = mesh(new THREE.RingGeometry(Math.max(0.01, r0), r1, Math.max(48, Math.round(span * 120)), 1, a0 - span, 2 * span), mat);
          m.rotation.x = -Math.PI / 2; m.position.set(sgn * Rs, y, 0);
          m.receiveShadow = true;
          roadG.add(m);
        };
        ringAt(Rs - W / 2, Rs + W / 2, asphalt, 0.004);
        ringAt(Rs - W / 2 + 0.075, Rs - W / 2 + 0.125, lineWhite, 0.006);
        ringAt(Rs + W / 2 - 0.125, Rs + W / 2 - 0.075, lineWhite, 0.006);
        ringAt(Rs - WHEEL_X - 0.03, Rs - WHEEL_X + 0.03, sgn > 0 ? trackL : trackR, 0.007);
        ringAt(Rs + WHEEL_X - 0.03, Rs + WHEEL_X + 0.03, sgn > 0 ? trackR : trackL, 0.007);
        // Forward arrow on the centre line, pointing along the arc.
        const a = 2.5 / Rs;
        addArrow(sgn * Rs - sgn * Rs * Math.cos(a), Rs * Math.sin(a), -sgn * a);
      }
      if (S.sc === 'ice') {
        const ice = mesh(new RoundedBoxGeometry(1.05, 0.012, 1.7, 2, 0.005), iceMat);
        ice.position.set(WHEEL_X, 0.01, 0.1);
        roadG.add(ice);
      }
    }
    function addArrow(x, z, rotY) {
      const s = new THREE.Shape();
      s.moveTo(0, 0.42); s.lineTo(0.26, 0.1); s.lineTo(0.1, 0.1); s.lineTo(0.1, -0.3); s.lineTo(-0.1, -0.3); s.lineTo(-0.1, 0.1); s.lineTo(-0.26, 0.1);
      const m = mesh(new THREE.ShapeGeometry(s), lineWhite);
      m.rotation.order = 'YXZ';
      m.rotation.set(-Math.PI / 2, rotY, Math.PI);
      m.position.set(x, 0.008, z);
      roadG.add(m);
    }

    // ── labels ──
    const labels = {};
    const LBL = { color: '#ffd59a', size: 0.7 };
    const mkLabel = (key, text, x, y, z, opts = LBL) => {
      const s = ctx.label(text, opts);
      s.position.set(x, y, z);
      root.add(s);
      labels[key] = { s, text, opts };
    };
    const setLabelText = (key, text) => {
      const l = labels[key];
      if (l.text !== text) { l.s = ctx.relabel(l.s, text, l.opts); l.text = text; }
    };
    mkLabel('drive', 'Driveshaft', 0, YA + 0.16, 1.6);
    mkLabel('pinion', `Pinion · ${Z_PIN} teeth`, 0, YA - 0.3, 0.62);
    mkLabel('ring', `Ring gear · ${Z_RING} teeth`, -0.25, YA + 0.62, -0.2);
    mkLabel('carrier', 'Carrier', 0.5, YA + 0.32, -0.3);
    mkLabel('spider', `Spider gears · ${Z_SPI} teeth`, 0.1, YA + 0.42, 0.25);
    mkLabel('side', `Side gears · ${Z_SIDE} teeth`, 0.32, YA - 0.4, 0.1);
    mkLabel('wL', 'Left wheel', WHEEL_X, YA + 0.68, 0, { color: COL_L, size: 0.72 });
    mkLabel('wR', 'Right wheel', -WHEEL_X, YA + 0.68, 0, { color: COL_R, size: 0.72 });
    function showLabels() { for (const k in labels) labels[k].s.visible = S.labels; }

    // ── kinematics ──
    function speeds() {
      const nd = S.rpm, nc = nd / G, T = TRACK, R = S.radius;
      let nL = nc, nR = nc, v = (nc * TAU * TYRE_R) / 60;
      if ((S.sc === 'left' || S.sc === 'right') && !S.lock) {
        const inner = (nc * (R - T / 2)) / R, outer = (nc * (R + T / 2)) / R;
        if (S.sc === 'left') { nL = inner; nR = outer; } else { nL = outer; nR = inner; }
      } else if (S.sc === 'ice') {
        if (!S.lock) { nL = 2 * nc; nR = 0; v = 0; }
      }
      const ns = ((nL - nR) / 2) * (Z_SIDE / Z_SPI);
      return { nd, nc, nL, nR, ns, v };
    }
    // Phase offsets so a tooth of one gear sits in a gap of its mate at each pitch contact.
    const tmpV = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
    const localAngle = (holder, p) => {
      holder.updateMatrixWorld(true);
      holder.getWorldQuaternion(tmpQ);
      tmpV.copy(p).applyQuaternion(tmpQ.invert());
      return Math.atan2(-tmpV.z, tmpV.x);
    };
    root.updateMatrixWorld(true);
    const Qrp = new THREE.Vector3(-R_PIN, 0, R_RING); // ring–pinion pitch contact (heel)
    const Qtop = new THREE.Vector3(R_SPI, R_SIDE, 0); // left side gear (+x) – top spider
    const QtopR = new THREE.Vector3(-R_SPI, R_SIDE, 0);
    const Qbot = new THREE.Vector3(R_SPI, -R_SIDE, 0);
    const base = {
      ring: localAngle(ringHolder, Qrp),
      pin: localAngle(pinionHolder, Qrp) + Math.PI / Z_PIN,
      L: localAngle(sideSpins.L.holder, Qtop),
      R: localAngle(sideSpins.R.holder, QtopR),
      top: localAngle(spiderSpins[0].holder, Qtop) + Math.PI / Z_SPI,
      bot: localAngle(spiderSpins[1].holder, Qbot) + Math.PI / Z_SPI,
    };
    ringSpin.rotation.y = base.ring;
    sideSpins.L.spin.rotation.y = base.L;
    sideSpins.R.spin.rotation.y = base.R;

    function apply() {
      carrierG.rotation.x = phiC;
      axleL.rotation.x = phiC + dif;
      axleR.rotation.x = phiC - dif;
      pinionSpin.rotation.y = base.pin + phiC * G;
      const psi = -dif * (Z_SIDE / Z_SPI);
      spiderSpins[0].spin.rotation.y = base.top + psi;
      spiderSpins[1].spin.rotation.y = base.bot + psi;
    }

    // ── controls ──
    const ui = ctx.ui;
    ui.choice('Scenario', {
      options: [{ value: 'straight', label: 'Straight' }, { value: 'left', label: 'Turn left' }, { value: 'right', label: 'Turn right' }, { value: 'ice', label: 'Left wheel on ice' }],
      value: S.sc,
      onChange: (v) => { S.sc = v; rebuildRoad(); refresh(); },
    });
    const rSlider = ui.slider('Turn radius R', { min: 3, max: 30, step: 0.5, value: S.radius, fmt: (v) => `${v.toFixed(1)} m`, onChange: (v) => { S.radius = v; rebuildRoad(); refresh(); } });
    ui.slider('Driveshaft speed', { min: 0, max: 3000, step: 50, value: S.rpm, fmt: (v) => `${fmt(v)} RPM`, onChange: (v) => { S.rpm = v; refresh(); } });
    const lockT = ui.toggle('Lock the differential', { value: S.lock, onChange: (v) => { S.lock = v; refresh(); } });
    ui.heading('View');
    ui.choice('Housing', {
      options: [{ value: 'cut', label: 'Cutaway' }, { value: 'glass', label: 'See-through' }, { value: 'solid', label: 'Solid' }],
      value: S.housing,
      onChange: (v) => { S.housing = v; showHousing(); },
    });
    ui.toggle('Labels', { value: S.labels, onChange: (v) => { S.labels = v; showLabels(); } });
    ui.toggle(`Slow motion (×1/${Math.round(1 / SLOW)})`, { value: S.slow, onChange: (v) => { S.slow = v; refresh(); } });
    const playBtn = ui.button(S.playing ? 'Pause' : 'Play', () => setPlaying(!S.playing), { primary: true });
    ui.button('Gears', () => ctx.view({ yaw: 0.3, pitch: 0.5, dist: 2.4, target: [0, YA, 0.1] }));
    ui.button('Whole axle', () => ctx.view({ yaw: 0.55, pitch: 0.36, dist: 5.4, target: [0, 0.55, 0.2] }));
    ui.button('From above', () => ctx.view({ yaw: 0, pitch: 1.35, dist: 8, target: [0, 0, 0.3] }));
    function setPlaying(p) { S.playing = p; playBtn.textContent = p ? 'Pause' : 'Play'; }

    ui.heading('Readouts');
    const rG = ui.readout('Final-drive ratio');
    const rD = ui.readout('Driveshaft (pinion)');
    const rC = ui.readout('Ring gear & carrier');
    const rL = ui.readout('Left wheel');
    const rR = ui.readout('Right wheel');
    const rS = ui.readout('Spider gears (on their shaft)');
    const rAvg = ui.readout('(L + R) / 2');
    const rV = ui.readout('Car speed');
    const rT = ui.readout('Torque split L / R');
    const mapNote = ui.note('<canvas width="640" height="360" style="width:100%;height:auto;display:block;border-radius:10px;background:#0c1017"></canvas>');
    const mapCanvas = mapNote.el.querySelector('canvas');
    const note = ui.note('');

    function refresh() {
      const sp = speeds();
      rSlider.el.style.display = S.sc === 'left' || S.sc === 'right' ? '' : 'none';
      rG.set(`${Z_RING} / ${Z_PIN} = <b>${G.toFixed(2)} : 1</b>`);
      rD.set(`<b>${fmt(sp.nd)} RPM</b>`);
      rC.set(`${fmt(sp.nd)} ÷ ${G.toFixed(2)} = <b>${fmt(sp.nc, 1)} RPM</b>`);
      rL.set(`<b style="color:${COL_L}">${fmt(sp.nL, 1)} RPM</b>`);
      rR.set(`<b style="color:${COL_R}">${fmt(sp.nR, 1)} RPM</b>`);
      rS.set(Math.abs(sp.ns) < 0.05 ? '<b>0 RPM</b> (carried round, not spinning)' : `<b>${fmt(Math.abs(sp.ns), 1)} RPM</b>`);
      rAvg.set(`${fmt((sp.nL + sp.nR) / 2, 1)} RPM ${Math.abs((sp.nL + sp.nR) / 2 - sp.nc) < 1e-6 ? '= carrier ✓' : ''}`);
      rV.set(`<b>${fmt(sp.v * 3.6, 1)} km/h</b>${sp.v === 0 && sp.nd > 0 ? ' (stuck!)' : ''}`);
      const turn = S.sc === 'left' || S.sc === 'right';
      let torque;
      if (!S.lock) torque = S.sc === 'ice' ? '50% / 50%, but each side gets only the tiny torque the ice can hold' : '<b>50% / 50%</b> (an open diff always splits torque equally)';
      else if (S.sc === 'ice') torque = 'almost all to the <b>right</b> wheel, the one with grip';
      else if (turn) torque = 'uneven: the tyres fight each other and <b>scrub</b>';
      else torque = '50% / 50% (both wheels grip equally)';
      rT.set(torque);
      for (const k of ['wL', 'wR']) setLabelText(k, `${k === 'wL' ? 'Left' : 'Right'} wheel · ${fmt(k === 'wL' ? sp.nL : sp.nR)} RPM`);
      showLabels();
      const R = S.radius, T = TRACK;
      let txt;
      if (S.sc === 'straight') txt = S.lock
        ? 'Locked or not, driving straight both wheels turn at carrier speed, so locking changes nothing here.'
        : 'Driving straight, both wheels turn at the carrier speed. The spider gears ride round with the carrier without spinning on their shaft: the whole carrier turns as one block.';
      else if (turn) {
        const inner = (Math.PI / 2) * (R - T / 2), outer = (Math.PI / 2) * (R + T / 2);
        txt = `In a quarter turn the inner wheel travels (π/2)(R − T/2) = <b>${inner.toFixed(2)} m</b> and the outer wheel (π/2)(R + T/2) = <b>${outer.toFixed(2)} m</b>. The difference is always πT/2 = ${(Math.PI * T / 2).toFixed(2)} m, whatever the radius.`;
        if (S.lock) {
          const scrub = (sp.nc * TAU * TYRE_R / 60) * (T / 2) / R;
          txt += ` <b>Locked:</b> both wheels must turn at ${fmt(sp.nc, 1)} RPM, so each tyre has to slide about <b>${scrub.toFixed(2)} m/s</b> against the road: tyre scrub. Unlock it on dry roads. A limited-slip diff only resists the speed difference, so it still lets the car turn.`;
        } else txt += ` The spider gears spin on their shaft so the outer wheel gains exactly what the inner one loses.`;
      } else txt = S.lock
        ? '<b>Locked:</b> both half-shafts turn together at carrier speed. The left tyre still slips on the ice, but the right wheel is forced to turn and its grip pushes the car out. A limited-slip diff does a gentler version of this.'
        : '<b>Open diff on ice:</b> torque is always split equally, and the ice wheel can only hold a tiny torque, so the gripping wheel gets that same tiny torque. The right wheel stops (0 RPM) and the ice wheel spins at twice the carrier speed. The car doesn’t move. Try locking the diff.';
      note.set(txt);
      drawMap(sp);
    }

    // Top-down map: the car on its road, with both tyre paths.
    function drawMap(sp) {
      const g = mapCanvas.getContext('2d');
      const W = mapCanvas.width, H = mapCanvas.height, T = TRACK;
      g.clearRect(0, 0, W, H);
      g.fillStyle = '#0c1017';
      g.fillRect(0, 0, W, H);
      g.font = '600 30px "Segoe UI", system-ui, sans-serif';
      g.lineCap = 'round';
      const car = (x, y, rot, s, alpha) => {
        g.save();
        g.translate(x, y); g.rotate(rot); g.globalAlpha = alpha;
        g.fillStyle = '#ffb347';
        g.beginPath(); g.roundRect(-0.9 * s, -3.4 * s, 1.8 * s, 4.45 * s, 0.35 * s); g.fill();
        g.fillStyle = '#1a2230';
        g.fillRect(-0.72 * s, -2.3 * s, 1.44 * s, 0.9 * s);
        g.fillStyle = '#0a0d12';
        for (const [wx, wy] of [[-T / 2, 0], [T / 2, 0], [-T / 2, -2.8], [T / 2, -2.8]]) g.fillRect((wx - 0.12) * s, (wy - 0.32) * s, 0.24 * s, 0.64 * s);
        g.strokeStyle = '#0a0d12'; g.lineWidth = Math.max(1, 0.08 * s);
        g.beginPath(); g.moveTo(-T / 2 * s, 0); g.lineTo(T / 2 * s, 0); g.stroke();
        g.restore();
      };
      const turn = S.sc === 'left' || S.sc === 'right';
      if (turn) {
        const R = S.radius, sgn = S.sc === 'left' ? -1 : 1;
        const s = (H - 40) / (R + T / 2 + 1.4);
        const cx = sgn < 0 ? 24 + 0.0 * s : W - 24, cy = H - 18 - 1.1 * s;
        const ax = cx - sgn * R * s;
        // road band
        g.strokeStyle = '#262a31'; g.lineWidth = (T + 1.4) * s;
        g.beginPath();
        if (sgn < 0) g.arc(cx, cy, R * s, -Math.PI / 2, 0); else g.arc(cx, cy, R * s, Math.PI, -Math.PI / 2);
        g.stroke();
        const path = (r, col) => {
          g.strokeStyle = col; g.lineWidth = 4;
          g.beginPath();
          if (sgn < 0) g.arc(cx, cy, r * s, -Math.PI / 2, 0); else g.arc(cx, cy, r * s, Math.PI, -Math.PI / 2);
          g.stroke();
        };
        const rl = sgn < 0 ? R - T / 2 : R + T / 2, rr = sgn < 0 ? R + T / 2 : R - T / 2;
        path(rl, COL_L); path(rr, COL_R);
        g.fillStyle = '#9aa4b2'; g.beginPath(); g.arc(cx, cy, 5, 0, TAU); g.fill();
        g.strokeStyle = '#5b6573'; g.lineWidth = 1.5; g.setLineDash([6, 6]);
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(ax, cy); g.stroke(); g.setLineDash([]);
        car(cx, cy - R * s, sgn < 0 ? -Math.PI / 2 : Math.PI / 2, s, 0.28);
        car(ax, cy, 0, s, 1);
        g.textAlign = sgn < 0 ? 'right' : 'left';
        const tx = sgn < 0 ? W - 16 : 16;
        g.fillStyle = COL_L; g.fillText(`Left path ${((Math.PI / 2) * rl).toFixed(1)} m`, tx, 40);
        g.fillStyle = COL_R; g.fillText(`Right path ${((Math.PI / 2) * rr).toFixed(1)} m`, tx, 78);
        g.fillStyle = '#9aa4b2'; g.fillText(`R = ${R.toFixed(1)} m (quarter turn)`, tx, 116);
        if (S.lock) { g.fillStyle = '#ff6b6b'; g.fillText('Locked: tyres scrub!', tx, 154); }
      } else {
        const s = 22, x0 = W / 2, y0 = H - 70;
        g.fillStyle = '#262a31'; g.fillRect(x0 - (T / 2 + 0.8) * s, 0, (T + 1.6) * s, H);
        const moving = sp.v > 0;
        g.lineWidth = 4;
        for (const [sx, col] of [[-1, COL_L], [1, COL_R]]) {
          g.strokeStyle = col;
          g.beginPath(); g.moveTo(x0 + (sx * T / 2) * s, y0); g.lineTo(x0 + (sx * T / 2) * s, moving ? 14 : y0 - 4); g.stroke();
        }
        if (S.sc === 'ice') {
          g.fillStyle = 'rgba(190,230,255,0.55)';
          g.beginPath(); g.roundRect(x0 - (T / 2 + 0.6) * s, y0 - 1.4 * s, 1.2 * s, 2.6 * s, 8); g.fill();
        }
        car(x0, y0, 0, s, 1);
        g.textAlign = 'left';
        const tx = x0 + (T / 2 + 1.2) * s;
        if (S.sc === 'straight') {
          g.fillStyle = '#d6dde8'; g.fillText('Both tyre paths', tx, 40); g.fillText('are equal', tx, 78);
        } else if (!S.lock) {
          g.fillStyle = COL_L; g.fillText('Left: spins on ice', tx, 40);
          g.fillStyle = COL_R; g.fillText('Right: 0 RPM', tx, 78);
          g.fillStyle = '#ff6b6b'; g.fillText('Car is stuck', tx, 96);
        } else {
          g.fillStyle = '#8be38b'; g.fillText('Locked: right', tx, 40); g.fillText('wheel pushes', tx, 68); g.fillText('the car out', tx, 96);
        }
        g.textAlign = 'right';
        g.fillStyle = '#9aa4b2'; g.fillText('top view ↑ forward', x0 - (T / 2 + 1.2) * s, 40);
      }
    }

    function showHousing() {
      housingParts.cut.visible = S.housing === 'cut';
      housingParts.full.visible = S.housing !== 'cut';
      for (const m of fullMeshes) { m.material = S.housing === 'glass' ? housingGlass : housingPaint; m.castShadow = S.housing === 'solid'; }
      ctx.unpickable(housingG);
      if (S.housing !== 'glass') ctx.pickable(housingG, housingCard);
    }

    // ── picking ──
    const turnTxt = (n) => `${fmt(n, 1)} RPM`;
    const cards = {
      driveshaft: () => {
        const sp = speeds();
        ctx.card('Driveshaft', `<p>A steel tube from the gearbox, with a <b>universal joint</b> at each end so the axle can move up and down on the suspension. It turns at <b>${fmt(sp.nd)} RPM</b>, the same speed as the pinion it is bolted to.</p>`, { kind: 'Input' });
      },
      pinion: () => {
        const sp = speeds();
        ctx.card('Pinion gear', `<p>A small bevel gear with <b>${Z_PIN} teeth</b> on the end of the driveshaft, held by two tapered roller bearings. It turns at <b>${fmt(sp.nd)} RPM</b> and drives the ring gear through a right angle.</p><p>Most real rear axles use a <b>hypoid</b> pinion that sits below the ring gear’s centre and has curved teeth; here it is drawn as a straight bevel gear on the centre line so the meshing is easy to see.</p>`, { kind: 'Final drive' });
      },
      ring: () => {
        const sp = speeds();
        ctx.card('Ring gear (crown wheel)', `<p>A large bevel gear with <b>${Z_RING} teeth</b>, bolted to the carrier with 10 bolts. Ratio ${Z_RING}/${Z_PIN} = <b>${G.toFixed(2)}</b>: it turns ${G.toFixed(2)} times more slowly than the pinion and, ideally, passes on ${G.toFixed(2)} times the torque.</p><p>Now turning at <b>${turnTxt(sp.nc)}</b>.</p>`, { kind: 'Final drive' });
      },
      carrier: () => {
        const sp = speeds();
        ctx.card('Carrier (differential case)', `<p>A cast-iron case that turns with the ring gear, at <b>${turnTxt(sp.nc)}</b>. It holds the cross shaft, so it swings the spider gears round the axle.</p><p>Its speed is always the average of the two wheels: (${fmt(sp.nL, 1)} + ${fmt(sp.nR, 1)}) / 2 = <b>${fmt((sp.nL + sp.nR) / 2, 1)} RPM</b>. The big windows let you see the gears inside (real cases have windows too, for oil to reach the gears).</p>`, { kind: 'Differential' });
      },
      spider: () => {
        const sp = speeds();
        ctx.card('Spider gears & cross shaft', `<p>Two bevel gears with <b>${Z_SPI} teeth</b>, free to turn on a steel cross shaft fixed in the carrier. They mesh with both side gears at once.</p><p>Going straight they don’t spin on the shaft and just carry the side gears round. When the wheels turn at different speeds they spin at ½(n<sub>L</sub> − n<sub>R</sub>) × ${Z_SIDE}/${Z_SPI} = <b>${fmt(Math.abs(sp.ns), 1)} RPM</b> relative to the carrier.</p><p>Because each spider pushes equally on both side gears (like a balance beam), an open differential always gives both wheels <b>equal torque</b>.</p>`, { kind: 'Differential' });
      },
      side: () => {
        const sp = speeds();
        ctx.card('Side gears', `<p>Two bevel gears with <b>${Z_SIDE} teeth</b>, one splined to each half-shaft, so each turns with its own wheel: left <b>${turnTxt(sp.nL)}</b>, right <b>${turnTxt(sp.nR)}</b>.</p><p>The spider gears sit between them. If one side gear turns faster than the carrier, the other must turn slower by the same amount.</p>`, { kind: 'Differential' });
      },
      axle: () => {
        const sp = speeds();
        ctx.card('Axle half-shafts', `<p>Steel shafts with splines at the inner end (into the side gear) and a flange at the outer end that carries the brake disc and wheel. Each one turns at its wheel’s speed: left <b>${turnTxt(sp.nL)}</b>, right <b>${turnTxt(sp.nR)}</b>.</p>`, { kind: 'Output' });
      },
      wheel: () => {
        const sp = speeds(), R = S.radius, T = TRACK, turn = S.sc === 'left' || S.sc === 'right';
        const geo = turn ? `<p>Tyre paths in this turn: R − T/2 = ${(R - T / 2).toFixed(2)} m and R + T/2 = ${(R + T / 2).toFixed(2)} m from the turn centre. Wheel speed is proportional to path radius.</p>` : '';
        ctx.card('Wheels', `<p>Left <b>${turnTxt(sp.nL)}</b>, right <b>${turnTxt(sp.nR)}</b>. With a ${TYRE_R} m rolling radius, a wheel at n RPM covers 2π × ${TYRE_R} × n / 60 metres per second.</p>${geo}`, { kind: 'Output' });
      },
      housing: housingCard,
    };
    function housingCard() {
      ctx.card('Axle housing', `<p>The stationary casting (a “banjo” housing with axle tubes) that holds the bearings, keeps the gears lined up and holds the gear oil. The half-shafts run inside the tubes to the wheels.</p><p>Use <b>Housing</b> in the Lab tab to cut it away or see through it.</p>`, { kind: 'Structure' });
    }
    ctx.pickable(driveG, cards.driveshaft);
    ctx.pickable(pinionGearG, cards.pinion);
    ctx.pickable(ringHolder, cards.ring);
    ctx.pickable(caseG, cards.carrier);
    ctx.pickable(spiderG, cards.spider);
    for (const s of ['L', 'R']) {
      ctx.pickable(sideSpins[s].holder, cards.side);
      ctx.pickable(shaftGroups[s], cards.axle);
      ctx.pickable(wheelGroups[s], cards.wheel);
    }

    // ── start ──
    rebuildRoad();
    showHousing();
    refresh();
    apply();

    const step = (dt) => {
      const sp = speeds();
      const k = (TAU / 60) * (S.slow ? SLOW : 1);
      phiC += sp.nc * k * dt;
      dif += (sp.nL - sp.nc) * k * dt;
    };
    if (params.has('t')) { const t = +params.get('t') || 0; for (let i = 0; i < 100; i++) step(t / 100); apply(); }
    const look = params.get('look');
    const v = window.stem?.view;
    const setV = (o) => { if (v) { v.goal = null; v.yaw = o.yaw; v.pitch = o.pitch; v.dist = o.dist; v.target.set(...o.target); } };
    if (look === 'gears') setV({ yaw: 0.3, pitch: 0.5, dist: 2.4, target: [0, YA, 0.1] });
    if (look === 'core') setV({ yaw: 0.1, pitch: 0.2, dist: 1.2, target: [0, YA, 0.1] });
    if (look === 'top') setV({ yaw: 0, pitch: 1.35, dist: 8, target: [0, 0, 0.3] });
    if (look === 'wheel') setV({ yaw: 1.0, pitch: 0.3, dist: 3, target: [WHEEL_X, YA, 0] });
    if (look === 'pinion') setV({ yaw: -0.5, pitch: 0.5, dist: 1.8, target: [-0.15, YA, 0.35] });
    if (params.has('pick') && cards[params.get('pick')]) cards[params.get('pick')]();

    // ── selftest ──
    if (params.has('selftest')) {
      const log = (ok, msg) => console.info(`[stem] selftest ${ok ? 'PASS' : 'FAIL'} ${msg}`);
      const save = { ...S };
      const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
      // Speed relations.
      Object.assign(S, { sc: 'straight', lock: false, rpm: 1500 });
      let sp = speeds();
      log(near(sp.nL, sp.nc) && near(sp.nR, sp.nc) && near(sp.ns, 0), `straight: L=${sp.nL.toFixed(3)} R=${sp.nR.toFixed(3)} carrier=${sp.nc.toFixed(3)} spider=${sp.ns}`);
      log(near(sp.nc, 1500 / (41 / 11)), `carrier = 1500/(41/11) = ${sp.nc.toFixed(3)}`);
      for (const sc of ['left', 'right']) for (const R of [3, 6, 20]) {
        Object.assign(S, { sc, radius: R });
        sp = speeds();
        const inner = sc === 'left' ? sp.nL : sp.nR, outer = sc === 'left' ? sp.nR : sp.nL;
        log(near((sp.nL + sp.nR) / 2, sp.nc) && near(outer / inner, (R + 0.8) / (R - 0.8)) && near(sp.ns, ((sp.nL - sp.nR) / 2) * 1.6),
          `${sc} R=${R}: (L+R)/2=${((sp.nL + sp.nR) / 2).toFixed(3)} carrier=${sp.nc.toFixed(3)} outer/inner=${(outer / inner).toFixed(4)} spider=${sp.ns.toFixed(2)}`);
      }
      Object.assign(S, { sc: 'ice' });
      sp = speeds();
      log(near(sp.nL, 2 * sp.nc) && sp.nR === 0 && sp.v === 0, `ice open: L=${sp.nL.toFixed(2)} (2×carrier ${(2 * sp.nc).toFixed(2)}) R=${sp.nR} v=${sp.v}`);
      Object.assign(S, { sc: 'left', lock: true });
      sp = speeds();
      log(near(sp.nL, sp.nc) && near(sp.nR, sp.nc) && near(sp.ns, 0), `locked turn: L=R=carrier=${sp.nc.toFixed(3)}`);
      Object.assign(S, save);

      // Mesh checks with the real transforms: material points at each pitch contact must move
      // together (no slipping or interference), and tooth/gap phases must line up at the start.
      const pairs = [
        ['ring–pinion', ringSpin, pinionSpin, Qrp, Z_RING, Z_PIN, asm],
        ['left side–top spider', sideSpins.L.spin, spiderSpins[0].spin, Qtop, Z_SIDE, Z_SPI, carrierG],
        ['right side–top spider', sideSpins.R.spin, spiderSpins[0].spin, QtopR, Z_SIDE, Z_SPI, carrierG],
        ['left side–bottom spider', sideSpins.L.spin, spiderSpins[1].spin, Qbot, Z_SIDE, Z_SPI, carrierG],
        ['right side–bottom spider', sideSpins.R.spin, spiderSpins[1].spin, new THREE.Vector3(-R_SPI, -R_SIDE, 0), Z_SIDE, Z_SPI, carrierG],
      ];
      const p0 = phiC, d0 = dif;
      const phaseOf = (spin, P, z) => {
        const lp = spin.worldToLocal(asm.localToWorld(P.clone()));
        const a = Math.atan2(-lp.z, lp.x) * z / TAU;
        return a - Math.round(a); // 0 = tooth centre at the contact, ±0.5 = gap centre
      };
      for (const [dc, dd, tag] of [[0.001, 0, 'straight'], [0.001, 0.0004, 'turning'], [0, 0.001, 'carrier held']]) {
        for (const [name, A, B, P, za, zb, frame] of pairs) {
          phiC = p0 + 0.3; dif = d0 + 0.2; apply(); root.updateMatrixWorld(true);
          const W = frame.localToWorld(P.clone()); // the pitch contact is fixed in this frame
          const la = A.worldToLocal(W.clone()), lb = B.worldToLocal(W.clone());
          phiC += dc; dif += dd; apply(); root.updateMatrixWorld(true);
          const wa = A.localToWorld(la.clone()), wb = B.localToWorld(lb.clone());
          const move = Math.max(wa.distanceTo(W), wb.distanceTo(W));
          const err = wa.distanceTo(wb);
          log(move < 1e-9 || err / move < 0.02, `${tag} ${name}: contact points move ${move.toExponential(2)}, mismatch ${(move > 1e-9 ? err / move : 0).toFixed(4)}`);
        }
      }
      phiC = 0; dif = 0; apply(); root.updateMatrixWorld(true);
      for (const [name, A, B, P, za, zb, frame] of pairs) {
        const pa = phaseOf(A, P, za), pb = phaseOf(B, P, zb);
        log(Math.abs(pa) < 0.02 && Math.abs(Math.abs(pb) - 0.5) < 0.02, `phase ${name}: tooth ${pa.toFixed(3)} (want 0), gap ${pb.toFixed(3)} (want ±0.5)`);
      }
      phiC = p0; dif = d0; apply();
    }

    return {
      update(dt) {
        if (S.playing) step(Math.min(dt, 0.05));
        apply();
      },
      onKey(e) {
        if (e.key === ' ') { e.preventDefault(); setPlaying(!S.playing); }
      },
      dispose() {},
    };
  },
};
