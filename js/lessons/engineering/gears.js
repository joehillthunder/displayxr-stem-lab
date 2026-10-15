// Gears & Mechanical Advantage: involute spur gears that really mesh (same module, centre
// distance m(z1 + z2)/2, phase-correct so teeth never pass through each other), driven by an
// electric motor and lifting a load on a rope drum. Simple pair, two-stage compound train, or
// rack and pinion. Ideal relations: n_out = n_in / G, T_out = T_in · G · η per mesh.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const PA = (20 * Math.PI) / 180; // pressure angle
const INV = (a) => Math.tan(a) - a; // involute function
const TAU = Math.PI * 2;
const M_REAL = 2; // the "real" module in mm used for the readouts
const DRUM_R_REAL = 0.05; // m, drum radius used for the readouts
const GRAV = 9.81;
const FACE = 0.12; // gear face width (scene units)
const SHAFT_R = 0.032;
const BASE_TOP = 0.12;
const PLATE_Z = -0.25;
const PLANE_B = 0.17; // second gear plane in the compound train
const DRUM_R = 0.12; // drum core radius (scene)
const ROPE_R = DRUM_R + 0.014; // radius where the rope leaves the drum

const params = new URLSearchParams(location.search);
const fmt = (v, d = 2) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-US') : v.toFixed(d));

// ── geometry ──────────────────────────────────────────────────────────────────────────────────

/** A keyed bore: a circle of radius r with a rectangular keyway at angle 0. */
function borePath(r) {
  const p = new THREE.Path();
  const kw = r * 0.5, kd = r * 0.35;
  const a = Math.asin(kw / 2 / r);
  p.moveTo(r * Math.cos(a), r * Math.sin(a));
  const n = 28;
  for (let i = 1; i <= n; i++) {
    const t = a + ((TAU - 2 * a) * i) / n;
    p.lineTo(r * Math.cos(t), r * Math.sin(t));
  }
  p.lineTo(r + kd, -kw / 2);
  p.lineTo(r + kd, kw / 2);
  return p;
}

/**
 * An involute spur gear with `z` teeth and module `m` (scene units): addendum m, dedendum 1.25m,
 * 20° pressure angle, a filleted root, keyed bore and lightening holes when there is room.
 * Tooth 0 is centred on the +x axis.
 */
function gearGeometry(z, m) {
  const rp = (m * z) / 2, rb = rp * Math.cos(PA), ra = rp + m, rf = rp - 1.25 * m;
  const r0 = Math.max(rb, rf + 0.05 * m); // involute starts at the base circle (or just above the root)
  const psiP = Math.PI / (2 * z) + INV(PA); // half tooth angle at the base circle reference
  const NF = 8;
  const fr = [], fa = [];
  for (let i = 0; i <= NF; i++) {
    const t = i / NF;
    const r = r0 + (ra - r0) * t * (0.35 + 0.65 * t); // denser near the base, where the involute curves most
    fr.push(r);
    fa.push(psiP - INV(Math.acos(Math.min(1, rb / r))));
  }
  const step = TAU / z, psi0 = fa[0];
  const gapHalf = (step - 2 * psi0) / 2;
  const fil = Math.min(gapHalf * 0.45, (0.38 * m) / rf);
  const s = new THREE.Shape();
  let first = true;
  const P = (x, y) => { if (first) { s.moveTo(x, y); first = false; } else s.lineTo(x, y); };
  const PP = (r, a) => P(r * Math.cos(a), r * Math.sin(a));
  const bez = (ra0, aa0, rc, ac, ra1, aa1, ts) => {
    const x0 = ra0 * Math.cos(aa0), y0 = ra0 * Math.sin(aa0);
    const xc = rc * Math.cos(ac), yc = rc * Math.sin(ac);
    const x1 = ra1 * Math.cos(aa1), y1 = ra1 * Math.sin(aa1);
    for (const t of ts) {
      const u = 1 - t;
      P(u * u * x0 + 2 * u * t * xc + t * t * x1, u * u * y0 + 2 * u * t * yc + t * t * y1);
    }
  };
  for (let k = 0; k < z; k++) {
    const c = k * step;
    for (let i = 0; i <= NF; i++) PP(fr[i], c - fa[i]);
    for (let j = 1; j < 4; j++) PP(ra, c - fa[NF] + (2 * fa[NF] * j) / 4);
    for (let i = NF; i >= 0; i--) PP(fr[i], c + fa[i]);
    const a0 = c + psi0, a1 = c + step - psi0;
    bez(r0, a0, rf, a0, rf, a0 + fil, [0.33, 0.66, 1]);
    for (let j = 1; j < 4; j++) PP(rf, a0 + fil + ((a1 - a0 - 2 * fil) * j) / 4);
    bez(rf, a1 - fil, rf, a1, r0, a1, [0, 0.34, 0.67]);
  }
  s.holes.push(borePath(SHAFT_R));
  const rh = SHAFT_R * 2.4;
  // Lightening holes in the web.
  const rimIn = rf - 1.3 * m - 0.03;
  if (rimIn - rh > 0.13) {
    const rc = (rimIn + rh) / 2;
    let n = 6, hr = 0;
    for (; n >= 4; n--) {
      hr = Math.min((rimIn - rh) / 2 - 0.022, rc * Math.sin(Math.PI / n) - 0.03);
      if (hr > 0.035) break;
    }
    if (hr > 0.035) for (let i = 0; i < n; i++) {
      const a = (i + 0.5) * (TAU / n);
      const h = new THREE.Path();
      h.absarc(rc * Math.cos(a), rc * Math.sin(a), hr, 0, TAU, true);
      s.holes.push(h);
    }
  }
  const bs = Math.min(0.006, 0.12 * m);
  const depth = FACE - 2 * bs;
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bs, bevelSize: bs, bevelOffset: -bs, bevelSegments: 1, curveSegments: 24 });
  geo.translate(0, 0, -depth / 2);

  // A hub boss, thicker than the gear, around the bore.
  const hs = new THREE.Shape();
  hs.absarc(0, 0, rh, 0, TAU, false);
  hs.holes.push(borePath(SHAFT_R));
  const hd = FACE + 0.05;
  const hub = new THREE.ExtrudeGeometry(hs, { depth: hd - 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelOffset: -0.006, bevelSegments: 2, curveSegments: 32 });
  hub.translate(0, 0, -(hd - 0.012) / 2);
  return { geo, hub, rp, ra, rf };
}

/** A straight-sided rack (20° flanks) whose teeth are centred at x = k·πm; pitch line at y = 0. */
function rackGeometry(m, len, hb) {
  const p = Math.PI * m, N = Math.ceil(len / p / 2);
  const tn = Math.tan(PA);
  const yT = m, yR = -1.25 * m, yB = yR - hb;
  const wT = p / 4 - m * tn, wR = p / 4 + 1.25 * m * tn;
  const x0 = -N * p - p / 2, x1 = N * p + p / 2;
  const s = new THREE.Shape();
  s.moveTo(x0, yB);
  s.lineTo(x1, yB);
  s.lineTo(x1, yR);
  for (let k = N; k >= -N; k--) {
    const c = k * p;
    s.lineTo(c + wR, yR);
    s.lineTo(c + wT, yT);
    s.lineTo(c - wT, yT);
    s.lineTo(c - wR, yR);
  }
  s.lineTo(x0, yR);
  const bs = Math.min(0.006, 0.12 * m);
  const depth = FACE - 2 * bs;
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bs, bevelSize: bs, bevelOffset: -bs, bevelSegments: 1 });
  geo.translate(0, 0, -depth / 2);
  return { geo, halfLen: x1 };
}

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
  t.repeat.set(3, 3);
  return t;
}

function ropeTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#b9a477';
  g.fillRect(0, 0, 64, 64);
  g.strokeStyle = '#6f6040';
  g.lineWidth = 6;
  for (let i = -64; i < 128; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 64, 64); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Remove and free everything under a group (shared materials are kept). */
function clear(g) {
  for (let i = g.children.length - 1; i >= 0; i--) {
    const c = g.children[i];
    c.traverse((o) => { o.geometry?.dispose?.(); if (o.isInstancedMesh) o.dispose(); });
    g.remove(c);
  }
}

function shadowed(o) {
  o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return o;
}

// ── lesson ────────────────────────────────────────────────────────────────────────────────────

export default {
  view: { dist: 6.9, yaw: 0.38, pitch: 0.24, target: [0, 1.15, 0], minDist: 1.2, maxDist: 16 },
  floor: true,
  explain: `
<p>A <b>gear</b> is a wheel with teeth. When two gears <b>mesh</b>, the teeth push on each other so turning one turns the other. Every tooth that passes the meshing point on one gear must pass it on the other too, so a gear with <b>3 times as many teeth turns 3 times more slowly</b>.</p>
<p>The <b>gear ratio</b> is G = z<sub>out</sub> / z<sub>in</sub> (teeth on the output gear divided by teeth on the input gear). The output speed is the input speed divided by G, and the output <b>torque</b> (turning force) is the input torque multiplied by G. This is the trade: you can have speed <i>or</i> torque, not both. Power (P = T·ω) stays the same, apart from friction losses: real spur gears lose about 1–2% of the power at every mesh, so we multiply by an <b>efficiency</b> η each time.</p>
<p>Two external gears turn in <b>opposite directions</b>. A <b>compound train</b> puts two gears on one shaft, so the ratios multiply: G = (z<sub>2</sub>/z<sub>1</sub>)·(z<sub>4</sub>/z<sub>3</sub>). That is how a small motor can lift a heavy load slowly.</p>
<p>Gears only mesh if they have the same <b>module</b> m (tooth size): the pitch diameter is d = m·z, so the shafts sit m(z<sub>1</sub>+z<sub>2</sub>)/2 apart. The tooth sides are <b>involute</b> curves, the shape traced by the end of a string unwound from a circle, which keeps the speed ratio perfectly steady as the teeth roll. A <b>rack and pinion</b> turns rotation into a straight line: one turn of the pinion moves the rack one pitch circumference, π·d.</p>
<p>In this model every gear has module 2 mm and the drum has a 50 mm radius; the readouts use those real sizes.</p>`,
  formula: 'G = z<sub>out</sub> / z<sub>in</sub> &nbsp;·&nbsp; n<sub>out</sub> = n<sub>in</sub> / G &nbsp;·&nbsp; T<sub>out</sub> = T<sub>in</sub> · G · η &nbsp;·&nbsp; P = T·ω',
  vocab: [
    ['Gear ratio', 'Teeth on the output gear ÷ teeth on the input gear. Above 1 = slower and stronger output.'],
    ['Torque', 'Turning force about an axis, in newton-metres (N·m): force × distance from the axis.'],
    ['Mechanical advantage', 'How many times the machine multiplies the input force or torque (here G × η).'],
    ['Module', 'Tooth size in mm: pitch diameter ÷ number of teeth. Meshing gears must share it.'],
    ['Pitch circle', 'The imaginary circles of meshing gears that roll on each other without slipping.'],
    ['Idler gear', 'A gear between driver and output that changes direction but not the overall ratio.'],
    ['Compound gear', 'Two gears fixed on the same shaft, so they turn together at the same speed.'],
    ['Efficiency (η)', 'Output power ÷ input power. Friction makes it less than 100%.'],
  ],
  quiz: [
    {
      q: 'A 12-tooth driver turns at 300 RPM and meshes with a 36-tooth gear. How fast does the 36-tooth gear turn?',
      choices: ['900 RPM', '300 RPM', '100 RPM', '36 RPM'],
      answer: 2,
      why: 'G = 36 / 12 = 3, so the output turns 3 times more slowly: 300 / 3 = 100 RPM.',
    },
    {
      q: 'In the same 12 → 36 pair, the motor gives 2 N·m. Ignoring friction, what torque does the output shaft give?',
      choices: ['0.67 N·m', '2 N·m', '6 N·m', '24 N·m'],
      answer: 2,
      why: 'Torque is multiplied by the ratio: 2 N·m × 3 = 6 N·m. The output is 3 times slower but 3 times stronger.',
    },
    {
      q: 'The driver turns clockwise. An idler gear is added between it and the output gear. Which way does the output turn now?',
      choices: ['Clockwise, with the same overall ratio', 'Anticlockwise, with the same ratio', 'Clockwise, and the ratio doubles', 'It cannot turn at all'],
      answer: 0,
      why: 'Each external mesh reverses direction, so two meshes give the same direction as the driver. The idler’s teeth cancel out of the ratio: (z_idler/z_in)·(z_out/z_idler) = z_out/z_in.',
    },
    {
      q: 'A compound train has a 10-tooth gear driving 30 teeth, and on that shaft a 10-tooth gear driving 40 teeth. What is the overall ratio?',
      choices: ['7 : 1', '12 : 1', '70 : 1', '4 : 3'],
      answer: 1,
      why: 'Ratios of the stages multiply: (30/10) × (40/10) = 3 × 4 = 12.',
    },
    {
      q: 'A gearbox makes the output torque 4 times bigger. Ideally, what happens to the power?',
      choices: ['It is 4 times bigger', 'It is 4 times smaller', 'It stays the same, because the speed is 4 times smaller', 'It doubles'],
      answer: 2,
      why: 'Power = torque × angular speed. Gears trade one for the other; an ideal gearbox cannot create energy, and a real one loses a little to friction.',
    },
  ],

  build(ctx) {
    const { root } = ctx;
    const ACC = 0xffb347;

    // Materials (shared, created once; freed with the lesson).
    const brush = brushedTexture();
    const steel = new THREE.MeshPhysicalMaterial({ color: 0xc9cdd4, metalness: 1, roughness: 0.5, roughnessMap: brush, clearcoat: 0.15 });
    const brass = new THREE.MeshPhysicalMaterial({ color: 0xd8a84e, metalness: 1, roughness: 0.55, roughnessMap: brush });
    const bright = new THREE.MeshStandardMaterial({ color: 0xdfe3ea, metalness: 1, roughness: 0.16 });
    const darkSteel = new THREE.MeshStandardMaterial({ color: 0x6c727c, metalness: 1, roughness: 0.32 });
    const paint = new THREE.MeshPhysicalMaterial({ color: ACC, metalness: 0.25, roughness: 0.42, clearcoat: 0.7, clearcoatRoughness: 0.25 });
    const graphite = new THREE.MeshPhysicalMaterial({ color: 0x2b313c, metalness: 0.45, roughness: 0.5, clearcoat: 0.35 });
    const baseMat = new THREE.MeshPhysicalMaterial({ color: 0x1c2029, metalness: 0.5, roughness: 0.45, clearcoat: 0.4 });
    const iron = new THREE.MeshStandardMaterial({ color: 0x41454c, metalness: 0.7, roughness: 0.55 });
    const ropeTex = ropeTexture();
    ropeTex.repeat.set(26, 3);
    const ropeWound = new THREE.MeshStandardMaterial({ map: ropeTex, roughness: 0.85 });
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0xbfa978, roughness: 0.85 });

    // ── state ──
    const S = {
      mode: ['simple', 'compound', 'rack'].includes(params.get('mode')) ? params.get('mode') : 'simple',
      z1: +params.get('z1') || 12, z2: +params.get('z2') || 30, z3: +params.get('z3') || 12, z4: +params.get('z4') || 28,
      rpm: 30, torque: 2, eff: 0.98, playing: true, labels: true,
    };
    let dir = -1; // +1 = driver turns anticlockwise as seen from the front
    let th1 = 0, thOutPrev = 0, h = 0, hMax = 1, xr = 0;
    const L = { m: 0.05, Yc: 1.3, x1: 0, x2: 0, x4: 0, xo: 0, zOut: 0, zDrum: 0.4, rp1: 0, p: 0, travel: 0.5 };

    // ── persistent holders (pick targets) ──
    const mech = new THREE.Group();
    const H1 = new THREE.Group(), H2 = new THREE.Group(), H3 = new THREE.Group(), H4 = new THREE.Group();
    const drumG = new THREE.Group(), weightG = new THREE.Group(), motorG = new THREE.Group(), rackG = new THREE.Group();
    root.add(mech, H1, H2, H3, H4, drumG, weightG, motorG, rackG);

    // Motor: painted can with cooling fins, fan cover and terminal box. Its shaft is gear 1's shaft.
    {
      const prof = [[0, -0.3], [0.19, -0.3], [0.215, -0.29], [0.228, -0.27], [0.23, -0.25], [0.23, 0.25], [0.228, 0.27], [0.215, 0.29], [0.19, 0.3], [0, 0.3]]
        .map(([r, y]) => new THREE.Vector2(r, y));
      const can = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), paint);
      can.rotation.x = Math.PI / 2;
      can.position.z = -0.6;
      const finGeo = new THREE.BoxGeometry(0.03, 0.04, 0.46);
      const fins = new THREE.InstancedMesh(finGeo, graphite, 18);
      const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), zAx = new THREE.Vector3(0, 0, 1);
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU + 0.17;
        q.setFromAxisAngle(zAx, a);
        v.set(Math.cos(a) * 0.245, Math.sin(a) * 0.245, -0.62);
        fins.setMatrixAt(i, mtx.compose(v, q, one));
      }
      const capProf = [[0, -0.12], [0.2, -0.12], [0.215, -0.1], [0.215, 0.06], [0.2, 0.08], [0, 0.08]].map(([r, y]) => new THREE.Vector2(r, y));
      const cap = new THREE.Mesh(new THREE.LatheGeometry(capProf, 48), graphite);
      cap.rotation.x = Math.PI / 2;
      cap.position.z = -0.98;
      const grille = new THREE.Group();
      for (let i = 1; i <= 4; i++) {
        const t = new THREE.Mesh(new THREE.TorusGeometry(i * 0.04, 0.007, 8, 48), darkSteel);
        t.position.z = -1.065;
        grille.add(t);
      }
      const flange = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.5, 0.04, 3, 0.03), paint);
      flange.position.z = -0.295;
      const tbox = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.1, 0.2, 3, 0.02), graphite);
      tbox.position.set(0, 0.265, -0.58);
      const gland = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.05, 16), darkSteel);
      gland.rotation.z = Math.PI / 2;
      gland.position.set(0.1, 0.265, -0.58);
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.07), new THREE.MeshStandardMaterial({ color: 0xe8e8e8, metalness: 0.8, roughness: 0.3 }));
      plate.position.set(0, 0, -0.6);
      plate.rotation.y = Math.PI / 2;
      plate.position.x = 0.268;
      motorG.add(shadowed(new THREE.Group().add(can, fins, cap, grille, flange, tbox, gland)), plate);
    }

    // Drum: painted flanges, a core with rope wound on it, bolts that show it turning.
    {
      const w = 0.24;
      const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.025, 64), paint);
      fl.rotation.x = Math.PI / 2;
      const fl2 = fl.clone();
      fl.position.z = -w / 2; fl2.position.z = w / 2;
      const core = new THREE.Mesh(new THREE.CylinderGeometry(DRUM_R, DRUM_R, w, 48), darkSteel);
      core.rotation.x = Math.PI / 2;
      const wound = new THREE.Mesh(new THREE.CylinderGeometry(ROPE_R, ROPE_R, w - 0.03, 48, 1, true), ropeWound);
      wound.rotation.x = Math.PI / 2;
      const bolt = new THREE.CylinderGeometry(0.016, 0.016, 0.014, 6);
      const bi = new THREE.InstancedMesh(bolt, bright, 12);
      const mtx = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
      for (let i = 0; i < 12; i++) {
        const a = ((i % 6) / 6) * TAU, s = i < 6 ? 1 : -1;
        v.set(Math.cos(a) * 0.16, Math.sin(a) * 0.16, s * (w / 2 + 0.018));
        bi.setMatrixAt(i, mtx.compose(v, q, one));
      }
      const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.032, 6), bright);
      nut.rotation.x = Math.PI / 2;
      nut.position.z = w / 2 + 0.03;
      const washer = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.008, 32), darkSteel);
      washer.rotation.x = Math.PI / 2;
      washer.position.z = w / 2 + 0.016;
      drumG.add(shadowed(new THREE.Group().add(fl, fl2, core, wound, bi, nut, washer)));
    }

    // Weight: a cast-iron block with an eye and a painted band.
    {
      const prof = [[0, 0], [0.1, 0], [0.115, 0.015], [0.115, 0.2], [0.1, 0.215], [0.03, 0.225], [0, 0.225]].map(([r, y]) => new THREE.Vector2(r, y));
      const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), iron);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.117, 0.117, 0.05, 48, 1, true), paint);
      band.position.y = 0.11;
      const eye = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.009, 12, 32), bright);
      eye.position.y = 0.255;
      weightG.add(shadowed(new THREE.Group().add(body, band, eye)));
    }
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 10), ropeMat);
    rope.castShadow = true;
    root.add(rope);

    // ── labels ──
    const labels = {};
    const mkLabel = (key, text) => { labels[key] = { s: ctx.label(text, { color: '#ffd59a', size: 0.75 }), text }; root.add(labels[key].s); };
    const setLabel = (key, text, x, y, z, vis) => {
      const l = labels[key];
      if (l.text !== text) { l.s = ctx.relabel(l.s, text, { color: '#ffd59a', size: 0.75 }); l.text = text; }
      l.s.position.set(x, y, z);
      l.s.visible = vis && S.labels;
    };
    for (const k of ['g1', 'g2', 'g3', 'g4', 'motor', 'load']) mkLabel(k, k);

    // ── layout + rebuild ──
    function rebuild() {
      for (const g of [mech, H1, H2, H3, H4, rackG]) clear(g);
      const { mode } = S;
      const z1 = S.z1, z2 = S.z2, z3 = S.z3, z4 = S.z4;
      const bolts = []; // [x, y, z, nx, ny, nz]
      let maxR;
      if (mode === 'rack') {
        const m = (L.m = Math.min(0.11, 2.2 / (z1 + 2)));
        L.rp1 = (m * z1) / 2;
        L.p = Math.PI * m;
        const railTop = BASE_TOP + 0.1, hb = 0.12;
        L.pitchY = railTop + hb + 1.25 * m;
        L.Yc = L.pitchY + L.rp1;
        L.x1 = 0;
        maxR = L.rp1 + m;
      } else {
        const ra = (z) => z / 2 + 1;
        const x2u = (z1 + z2) / 2, x4u = x2u + (z3 + z4) / 2;
        let lo = Math.min(-ra(z1), x2u - ra(z2)), hi = Math.max(ra(z1), x2u + ra(z2));
        let maxRu = Math.max(ra(z1), ra(z2));
        if (mode === 'compound') {
          lo = Math.min(lo, x2u - ra(z3), x4u - ra(z4));
          hi = Math.max(hi, x2u + ra(z3), x4u + ra(z4));
          maxRu = Math.max(maxRu, ra(z3), ra(z4));
        }
        const m = (L.m = Math.min(0.075, 3.5 / (hi - lo), 1.25 / maxRu));
        const shift = (-(lo + hi) / 2) * m;
        L.x1 = shift;
        L.x2 = x2u * m + shift;
        L.x4 = x4u * m + shift;
        L.xo = mode === 'compound' ? L.x4 : L.x2;
        L.zOut = mode === 'compound' ? PLANE_B : 0;
        L.zDrum = L.zOut + 0.36;
        maxR = maxRu * m;
        L.Yc = Math.max(1.3, BASE_TOP + maxR + 0.14);
        hMax = L.Yc - 0.2 - BASE_TOP - 0.29 - 0.05;
        h = Math.min(Math.max(h, 0), hMax);
      }
      const m = L.m;

      // Gears.
      const addGear = (holder, z, mat, x, zPlane, shaftFrom, shaftTo) => {
        const g = gearGeometry(z, m);
        const gear = new THREE.Mesh(g.geo, mat);
        const hub = new THREE.Mesh(g.hub, mat);
        gear.position.z = hub.position.z = zPlane;
        holder.add(gear, hub);
        if (shaftTo > shaftFrom) {
          const sh = new THREE.Mesh(new THREE.CylinderGeometry(SHAFT_R * 0.97, SHAFT_R * 0.97, shaftTo - shaftFrom, 28), bright);
          sh.rotation.x = Math.PI / 2;
          sh.position.z = (shaftFrom + shaftTo) / 2;
          const key = new THREE.Mesh(new THREE.BoxGeometry(SHAFT_R * 0.5, SHAFT_R * 0.5, FACE + 0.05), darkSteel);
          key.position.set(SHAFT_R * 1.05, 0, zPlane);
          holder.add(sh, key);
        }
        holder.position.set(x, L.Yc, 0);
        holder.userData.z = z;
        holder.userData.rp = g.rp;
        shadowed(holder);
        return g;
      };
      const frontEnd = (zp) => zp + FACE / 2 + 0.06;
      addGear(H1, z1, steel, L.x1, 0, -0.32, frontEnd(0));
      const backShafts = [L.x1];
      if (mode === 'simple') {
        addGear(H2, z2, brass, L.x2, 0, PLATE_Z, L.zDrum + 0.165);
        backShafts.push(L.x2);
      } else if (mode === 'compound') {
        addGear(H2, z2, brass, L.x2, 0, PLATE_Z, frontEnd(PLANE_B));
        addGear(H3, z3, steel, L.x2, PLANE_B, 0, 0);
        addGear(H4, z4, brass, L.x4, PLANE_B, PLANE_B - FACE / 2 - 0.03, L.zDrum + 0.165);
        backShafts.push(L.x2);
      } else {
        const r = rackGeometry(m, 2.6, 0.12);
        const rack = new THREE.Mesh(r.geo, steel);
        rackG.add(shadowed(rack));
        const endCap = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.16 + 1.25 * m, FACE + 0.04, 2, 0.012), paint);
        endCap.position.set(r.halfLen + 0.025, -1.25 * m - 0.12 + (0.16 + 1.25 * m) / 2 - 0.02, 0);
        const endCap2 = endCap.clone();
        endCap2.position.x = -endCap.position.x;
        rackG.add(shadowed(endCap), shadowed(endCap2));
        L.travel = Math.max(0.2, 1.85 - r.halfLen);
      }
      H2.visible = mode !== 'rack';
      H3.visible = H4.visible = mode === 'compound';
      rackG.visible = mode === 'rack';
      drumG.visible = weightG.visible = rope.visible = mode !== 'rack';

      // Base slab.
      let bx0 = Math.min(L.x1 - 0.4, (mode === 'rack' ? -2 : L.x1 - maxR - 0.15));
      let bx1 = mode === 'rack' ? 2 : Math.max(L.xo + ROPE_R + 0.3, (mode === 'compound' ? L.x4 : L.x2) + maxR * 0.3 + 0.2);
      if (mode !== 'rack') { bx0 = Math.min(bx0, -1.9); bx1 = Math.max(bx1, 1.9); }
      const bz0 = -1.12, bz1 = mode === 'rack' ? 0.5 : L.zDrum + 0.34;
      const base = new THREE.Mesh(new RoundedBoxGeometry(bx1 - bx0, 0.12, bz1 - bz0, 3, 0.035), baseMat);
      base.position.set((bx0 + bx1) / 2, 0.06, (bz0 + bz1) / 2);
      mech.add(base);
      for (const [x, z] of [[bx0 + 0.1, bz0 + 0.1], [bx1 - 0.1, bz0 + 0.1], [bx0 + 0.1, bz1 - 0.1], [bx1 - 0.1, bz1 - 0.1]]) bolts.push([x, BASE_TOP, z, 0, 1, 0]);
      // Thin accent stripe along the base front.
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(bx1 - bx0 - 0.1, 0.018, 0.004), new THREE.MeshBasicMaterial({ color: ACC, toneMapped: false }));
      stripe.position.set((bx0 + bx1) / 2, 0.06, bz1 + 0.001);
      mech.add(stripe);

      // Back plate with bearing housings.
      const pm = mode === "rack" ? Math.max(0.34, L.rp1 + 0.15) : 0.34;
      const px0 = Math.min(...backShafts) - pm, px1 = Math.max(...backShafts) + pm;
      const ph = L.Yc + 0.3 - BASE_TOP;
      const plate = new THREE.Mesh(new RoundedBoxGeometry(px1 - px0, ph, 0.05, 3, 0.015), graphite);
      plate.position.set((px0 + px1) / 2, BASE_TOP + ph / 2, PLATE_Z);
      mech.add(plate);
      const foot = new THREE.Mesh(new RoundedBoxGeometry(px1 - px0, 0.04, 0.22, 2, 0.012), graphite);
      foot.position.set((px0 + px1) / 2, BASE_TOP + 0.02, PLATE_Z + 0.08);
      mech.add(foot);
      for (const x of [px0 + 0.08, px1 - 0.08]) { bolts.push([x, BASE_TOP + 0.04, PLATE_Z + 0.14, 0, 1, 0]); bolts.push([x, L.Yc + 0.22, PLATE_Z + 0.025, 0, 0, 1]); }
      const housingProf = [[SHAFT_R * 1.02, 0], [0.085, 0], [0.085, 0.05], [0.075, 0.07], [SHAFT_R * 1.02, 0.07]].map(([r, y]) => new THREE.Vector2(r, y));
      const housingGeo = new THREE.LatheGeometry(housingProf, 48);
      housingGeo.rotateX(Math.PI / 2);
      const addHousing = (x, z, dirZ) => {
        const hgeo = dirZ > 0 ? housingGeo : housingGeo.clone().rotateY(Math.PI);
        const hs = new THREE.Mesh(hgeo, paint);
        hs.position.set(x, L.Yc, z);
        mech.add(hs);
        for (let i = 0; i < 4; i++) {
          const a = Math.PI / 4 + (i * Math.PI) / 2;
          bolts.push([x + Math.cos(a) * 0.115, L.Yc + Math.sin(a) * 0.115, z, 0, 0, dirZ]);
        }
      };
      for (const x of backShafts) addHousing(x, PLATE_Z + 0.025, 1);

      // Motor on a stand behind the plate.
      motorG.position.set(L.x1, L.Yc, 0);
      const standH = L.Yc - 0.2 - BASE_TOP;
      if (standH > 0.02) {
        const stand = new THREE.Mesh(new RoundedBoxGeometry(0.34, standH, 0.5, 2, 0.015), graphite);
        stand.position.set(L.x1, BASE_TOP + standH / 2, -0.62);
        mech.add(stand);
        for (const sx of [-0.2, 0.2]) for (const sz of [-0.8, -0.44]) bolts.push([L.x1 + sx, BASE_TOP, sz, 0, 1, 0]);
        const sfoot = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.03, 0.5, 2, 0.01), graphite);
        sfoot.position.set(L.x1, BASE_TOP + 0.015, -0.62);
        mech.add(sfoot);
      }
      for (let i = 0; i < 4; i++) bolts.push([L.x1 + (i % 2 ? 0.2 : -0.2), L.Yc + (i < 2 ? 0.2 : -0.2), -0.272, 0, 0, 1]);

      if (mode !== 'rack') {
        drumG.position.set(L.xo, L.Yc, L.zDrum);
      } else {
        // Rack guide: a rail under the rack and two lips that keep it in line.
        const railH = 0.1;
        const rail = new THREE.Mesh(new RoundedBoxGeometry(3.9, railH, FACE + 0.14, 2, 0.015), graphite);
        rail.position.set(0, BASE_TOP + railH / 2, 0);
        mech.add(rail);
        for (const s of [-1, 1]) {
          const lip = new THREE.Mesh(new RoundedBoxGeometry(3.9, 0.07, 0.03, 2, 0.008), paint);
          lip.position.set(0, BASE_TOP + railH + 0.035, s * (FACE / 2 + 0.035));
          mech.add(lip);
          for (const x of [-1.7, -0.6, 0.6, 1.7]) bolts.push([x, BASE_TOP + railH + 0.07, s * (FACE / 2 + 0.035), 0, 1, 0]);
        }
        rackG.position.set(0, L.pitchY, 0);
      }

      // All bolts as one InstancedMesh.
      const boltGeo = new THREE.CylinderGeometry(0.019, 0.019, 0.016, 6);
      boltGeo.translate(0, 0.008, 0);
      const bim = new THREE.InstancedMesh(boltGeo, bright, bolts.length);
      const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), n = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
      bolts.forEach(([x, y, z, nx, ny, nz], i) => {
        q.setFromUnitVectors(up, n.set(nx, ny, nz));
        bim.setMatrixAt(i, mtx.compose(v.set(x, y, z), q, one));
      });
      mech.add(bim);
      shadowed(mech);

      // Reset the motion so the teeth start in mesh.
      if (mode === 'rack') { th1 = -Math.PI / 2; dir = -1; }
      else dir = mode === 'simple' ? -1 : 1; // so the drum starts by lifting
      thOutPrev = outAngle();
      placeLabels();
      refresh();
    }

    function outAngle() {
      if (S.mode === 'simple') return -th1 * (S.z1 / S.z2) + Math.PI - Math.PI / S.z2;
      const th2 = -th1 * (S.z1 / S.z2) + Math.PI - Math.PI / S.z2;
      return -th2 * (S.z3 / S.z4) + Math.PI - Math.PI / S.z4;
    }

    function placeLabels() {
      const m = L.m, y = (z) => L.Yc + (z / 2 + 1) * m + 0.08;
      const rack = S.mode === 'rack', comp = S.mode === 'compound';
      setLabel('g1', `${rack ? 'Pinion' : 'Driver'} · ${S.z1} teeth`, L.x1, y(S.z1), 0, true);
      setLabel('g2', `${comp ? 'Gear 2' : 'Output'} · ${S.z2} teeth`, L.x2, y(S.z2), 0, !rack);
      setLabel('g3', `Gear 3 · ${S.z3} teeth`, L.x2, L.Yc + 0.02, PLANE_B + 0.1, comp);
      setLabel('g4', `Output · ${S.z4} teeth`, L.x4, y(S.z4), PLANE_B, comp);
      setLabel("motor", "Motor", L.x1 - 0.5, L.Yc + 0.05, -0.6, true);
      setLabel('load', rack ? 'Rack' : 'Load', rack ? 1.0 : L.xo + ROPE_R, rack ? L.pitchY + 0.05 : 0, rack ? 0.2 : L.zDrum, true);
    }

    // ── physics readouts ──
    const rads = (rpm) => (rpm * TAU) / 60;
    function stats() {
      const n1 = S.rpm, T1 = S.torque, eta = S.eff;
      if (S.mode === 'rack') {
        const r = (S.z1 * M_REAL) / 2 / 1000;
        return { n1, T1, r, v: rads(n1) * r, Fid: T1 / r, F: (T1 * eta) / r };
      }
      const meshes = S.mode === 'simple' ? 1 : 2;
      const G = S.mode === 'simple' ? S.z2 / S.z1 : (S.z2 / S.z1) * (S.z4 / S.z3);
      const ef = Math.pow(eta, meshes);
      const nOut = n1 / G, Tid = T1 * G, T = Tid * ef;
      return { n1, T1, G, meshes, ef, nOut, Tid, T, MA: G * ef, lift: rads(nOut) * DRUM_R_REAL, mass: T / (DRUM_R_REAL * GRAV), Pin: T1 * rads(n1), Pout: T * rads(nOut) };
    }
    const turn = (s) => (s > 0 ? 'anticlockwise ↺' : 'clockwise ↻');

    // ── controls ──
    const ui = ctx.ui;
    ui.choice('Mechanism', {
      options: [{ value: 'simple', label: 'Gear pair' }, { value: 'compound', label: 'Compound (2 stages)' }, { value: 'rack', label: 'Rack & pinion' }],
      value: S.mode,
      onChange: (v) => { S.mode = v; showSliders(); rebuild(); ctx.view({ target: [0, v === "rack" ? 0.8 : 1.15, 0], dist: v === "rack" ? 6 : 6.9 }); },
    });
    ui.heading('Teeth');
    const s1 = ui.slider('Driver z₁', { min: 8, max: 60, step: 1, value: S.z1, fmt: (v) => `${v} teeth`, onChange: (v) => { S.z1 = v; rebuild(); } });
    const s2 = ui.slider('Driven z₂', { min: 8, max: 60, step: 1, value: S.z2, fmt: (v) => `${v} teeth`, onChange: (v) => { S.z2 = v; rebuild(); } });
    const s3 = ui.slider('Stage 2 driver z₃', { min: 8, max: 60, step: 1, value: S.z3, fmt: (v) => `${v} teeth`, onChange: (v) => { S.z3 = v; rebuild(); } });
    const s4 = ui.slider('Output z₄', { min: 8, max: 60, step: 1, value: S.z4, fmt: (v) => `${v} teeth`, onChange: (v) => { S.z4 = v; rebuild(); } });
    function showSliders() {
      s1.el.querySelector('.ctl-name').textContent = S.mode === 'rack' ? 'Pinion z₁' : 'Driver z₁';
      s2.el.style.display = S.mode === 'rack' ? 'none' : '';
      s2.el.querySelector('.ctl-name').textContent = S.mode === 'compound' ? 'Driven z₂' : 'Output z₂';
      s3.el.style.display = s4.el.style.display = S.mode === 'compound' ? '' : 'none';
    }
    ui.heading('Motor');
    ui.slider('Motor speed', { min: 5, max: 120, step: 1, value: S.rpm, fmt: (v) => `${v} RPM`, onChange: (v) => { S.rpm = v; refresh(); } });
    ui.slider('Motor torque', { min: 0.5, max: 20, step: 0.5, value: S.torque, fmt: (v) => `${v.toFixed(1)} N·m`, onChange: (v) => { S.torque = v; refresh(); } });
    ui.slider('Efficiency per mesh', { min: 0.8, max: 1, step: 0.01, value: S.eff, fmt: (v) => `${Math.round(v * 100)}%`, onChange: (v) => { S.eff = v; refresh(); } });
    const playBtn = ui.button('Pause', () => setPlaying(!S.playing), { primary: true });
    ui.button('Reverse motor', () => { dir = -dir; refresh(); });
    ui.toggle('Show labels', { value: true, onChange: (v) => { S.labels = v; placeLabels(); } });
    function setPlaying(p) { S.playing = p; playBtn.textContent = p ? 'Pause' : 'Play'; }

    ui.heading('Results');
    const rRatio = ui.readout('Gear ratio');
    const rSpeed = ui.readout('Output speed');
    const rTorque = ui.readout('Output torque');
    const rMA = ui.readout('Mechanical advantage');
    const rDir = ui.readout('Rotation');
    const rLoad = ui.readout('Load');
    const rPow = ui.readout('Power in → out');
    const note = ui.note('');
    const nameOf = (r, t) => { r.el.querySelector('.ctl-name').textContent = t; };

    function refresh() {
      const st = stats();
      if (S.mode === 'rack') {
        nameOf(rRatio, 'Pinion pitch radius'); rRatio.set(`${fmt(st.r * 1000, 0)} mm`);
        nameOf(rSpeed, 'Rack speed'); rSpeed.set(`${fmt(st.v * 100, 1)} cm/s`);
        nameOf(rTorque, 'Force on rack'); rTorque.set(`${fmt(st.Fid, 0)} N ideal · <b>${fmt(st.F, 0)} N</b> real`);
        nameOf(rMA, 'Travel per turn'); rMA.set(`π·d = ${fmt(Math.PI * st.r * 2 * 1000, 0)} mm`);
        rDir.set(`pinion ${turn(dir)} → rack moves ${dir > 0 ? 'right →' : '← left'}`);
        rLoad.el.style.display = 'none';
        rPow.set(`${fmt(st.T1 * rads(st.n1), 1)} W → ${fmt(st.F * st.v, 1)} W`);
        note.set(`F = T / r and v = ω·r: a small pinion gives a big push but a slow rack.`);
        return;
      }
      rLoad.el.style.display = '';
      nameOf(rRatio, 'Gear ratio');
      nameOf(rSpeed, 'Output speed');
      nameOf(rTorque, 'Output torque');
      nameOf(rMA, 'Mechanical advantage');
      const ratioTxt = S.mode === 'simple' ? `${S.z2}/${S.z1}` : `(${S.z2}/${S.z1})·(${S.z4}/${S.z3})`;
      rRatio.set(`${ratioTxt} = <b>${fmt(st.G)} : 1</b> ${st.G > 1.001 ? '(reduction)' : st.G < 0.999 ? '(overdrive)' : ''}`);
      rSpeed.set(`${fmt(st.n1, 0)} ÷ ${fmt(st.G)} = <b>${fmt(st.nOut, st.nOut < 10 ? 2 : 1)} RPM</b>`);
      rTorque.set(`${fmt(st.Tid)} N·m ideal · <b>${fmt(st.T)} N·m</b> real`);
      rMA.set(`G × η${st.meshes > 1 ? '²' : ''} = <b>${fmt(st.MA)}×</b>`);
      const outSign = S.mode === 'simple' ? -dir : dir;
      rDir.set(`driver ${turn(dir)} → output ${turn(outSign)}`);
      const lifting = outSign > 0;
      rLoad.set(`${lifting ? 'lifting' : 'lowering'} at ${fmt(st.lift * 100, 1)} cm/s · max ${fmt(st.mass, 1)} kg`);
      rPow.set(`${fmt(st.Pin, 1)} W → ${fmt(st.Pout, 1)} W`);
      note.set(`Module m = ${M_REAL} mm on every gear, so the centre distance is m(z₁+z₂)/2 = ${fmt((M_REAL * (S.z1 + S.z2)) / 2, 0)} mm${S.mode === 'compound' ? ` and m(z₃+z₄)/2 = ${fmt((M_REAL * (S.z3 + S.z4)) / 2, 0)} mm` : ''}. Drum radius 50 mm.`);
    }

    // ── picking ──
    const gearCard = (which) => () => {
      const z = { 1: S.z1, 2: S.z2, 3: S.z3, 4: S.z4 }[which];
      let n = S.rpm, T = S.torque, sgn = dir;
      if (which >= 2) { n = (S.rpm * S.z1) / S.z2; T = S.torque * (S.z2 / S.z1) * S.eff; sgn = -dir; }
      if (which === 4) { n = n * (S.z3 / S.z4); T = T * (S.z4 / S.z3) * S.eff; sgn = dir; }
      const name = S.mode === 'rack' ? 'Pinion' : which === 1 ? 'Driver gear' : (S.mode === 'simple' && which === 2) || which === 4 ? 'Output gear' : `Gear ${which}`;
      const extra = which === 3 ? '<p>Gear 3 is keyed to the same shaft as gear 2, so it turns at exactly the same speed: a <b>compound</b> gear.</p>' : '';
      ctx.card(name, `<p><b>${z} teeth</b>, module ${M_REAL} mm → pitch diameter d = m·z = <b>${z * M_REAL} mm</b>, outside diameter ${(z + 2) * M_REAL} mm.</p><p>Turning <b>${fmt(n, n < 10 ? 2 : 1)} RPM</b> ${turn(sgn)} with <b>${fmt(T)} N·m</b> of torque.</p>${extra}`, { kind: 'Spur gear' });
    };
    ctx.pickable(H1, gearCard(1));
    ctx.pickable(H2, gearCard(2));
    ctx.pickable(H3, gearCard(3));
    ctx.pickable(H4, gearCard(4));
    ctx.pickable(motorG, () => {
      const P = S.torque * rads(S.rpm);
      ctx.card('Electric motor', `<p>Supplies <b>${fmt(S.torque, 1)} N·m</b> at <b>${S.rpm} RPM</b> (${fmt(rads(S.rpm))} rad/s).</p><p>Power P = T·ω = ${fmt(S.torque, 1)} × ${fmt(rads(S.rpm))} = <b>${fmt(P, 1)} W</b>. Gears can change the torque and speed, but never increase this power.</p>`, { kind: 'Input' });
    });
    const loadCard = () => {
      const st = stats();
      ctx.card('Load drum & weight', `<p>The output shaft turns a drum of radius 50 mm. Rope force F = T / r = ${fmt(st.T)} / 0.05 = <b>${fmt(st.T / DRUM_R_REAL, 0)} N</b>, enough to hold <b>${fmt(st.mass, 1)} kg</b> (F = m·g).</p><p>Rope speed v = ω·r = <b>${fmt(st.lift * 100, 1)} cm/s</b>.</p>`, { kind: 'Output' });
    };
    ctx.pickable(drumG, loadCard);
    ctx.pickable(weightG, loadCard);
    ctx.pickable(rackG, () => {
      const st = stats();
      ctx.card('Rack', `<p>A straight "gear" with the same 2 mm module. One turn of the pinion moves it π·d = <b>${fmt(Math.PI * st.r * 2000, 0)} mm</b>.</p><p>Speed v = ω·r = <b>${fmt(st.v * 100, 1)} cm/s</b>; push F = T·η / r = <b>${fmt(st.F, 0)} N</b>. Steering racks in cars work like this.</p>`, { kind: 'Linear motion' });
    });

    // ── start ──
    showSliders();
    rebuild();
    h = hMax * 0.15;
    if (params.has('pause')) setPlaying(false);
    if (params.has('t1')) { th1 += +params.get('t1'); thOutPrev = outAngle(); }
    if (params.has('zoom')) {
      const xm = S.mode === 'rack' ? 0 : L.x1 + (S.z1 / 2) * L.m;
      const ym = S.mode === 'rack' ? L.pitchY : L.Yc;
      const v = window.stem?.view;
      if (v) { v.goal = null; v.yaw = 0; v.pitch = 0; v.dist = 1.4; v.target.set(xm, ym, 0); }
    }

    function apply() {
      H1.rotation.z = th1;
      if (S.mode === 'rack') {
        xr = L.p / 2 + (th1 + Math.PI / 2) * L.rp1;
        rackG.position.x = xr;
        return;
      }
      const th2 = -th1 * (S.z1 / S.z2) + Math.PI - Math.PI / S.z2;
      H2.rotation.z = th2;
      H3.rotation.z = th2;
      const thOut = S.mode === 'simple' ? th2 : -th2 * (S.z3 / S.z4) + Math.PI - Math.PI / S.z4;
      H4.rotation.z = thOut;
      drumG.rotation.z = thOut;
      h += (thOut - thOutPrev) * ROPE_R;
      thOutPrev = thOut;
      const wy = BASE_TOP + h;
      weightG.position.set(L.xo + ROPE_R, wy, L.zDrum);
      const top = L.Yc, bot = wy + 0.255;
      rope.position.set(L.xo + ROPE_R, (top + bot) / 2, L.zDrum);
      rope.scale.y = Math.max(0.001, top - bot);
      labels.load.s.position.y = wy + 0.3;
    }
    apply();

    return {
      update(dt) {
        if (S.playing) {
          th1 += dir * rads(S.rpm) * Math.min(dt, 0.05);
          if (S.mode === 'rack') {
            const off = L.p / 2 + (th1 + Math.PI / 2) * L.rp1 - L.p / 2;
            if ((off > L.travel && dir > 0) || (off < -L.travel && dir < 0)) { dir = -dir; refresh(); }
          }
        }
        apply();
        if (S.mode !== 'rack') {
          const outSign = S.mode === 'simple' ? -dir : dir;
          if ((h >= hMax && outSign > 0) || (h <= 0 && outSign < 0)) { dir = -dir; refresh(); }
        }
      },
      onKey(e) {
        if (e.key === ' ') { e.preventDefault(); setPlaying(!S.playing); }
      },
      dispose() {},
    };
  },
};
