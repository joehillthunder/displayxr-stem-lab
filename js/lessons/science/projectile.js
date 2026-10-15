// Projectile Motion (Physics). A launcher on a long range: angle, speed and launch height, on Earth,
// the Moon or Mars. The ball follows the exact no-drag solution
//   x = v cosθ · t,   y = h + v sinθ · t − ½ g t²
// with live velocity-component arrows, strobe dots at equal time steps, a dashed prediction, and
// earlier shots kept for comparison. Metres are scaled to scene units per world so the longest
// possible shot fits the range; both axes use the same scale, so the shape is true.
// URL helpers for screenshots: ?w=earth|moon|mars&a=&v=&h=&demo=fire|compare&t=<s>&snap

import * as THREE from 'three';

const WORLDS = {
  earth: { name: 'Earth', g: 9.81, maxM: 120, major: 20, minor: 5, ground: ['#2d6a39', '#3f8a4c'], speck: '#5fae62', line: 'rgba(240,255,235,0.85)' },
  moon: { name: 'Moon', g: 1.62, maxM: 600, major: 100, minor: 25, ground: ['#55585f', '#6b6e75'], speck: '#a4a7ae', line: 'rgba(255,255,255,0.8)' },
  mars: { name: 'Mars', g: 3.71, maxM: 280, major: 40, minor: 10, ground: ['#8a3f22', '#b0582f'], speck: '#d07a4a', line: 'rgba(255,240,225,0.85)' },
};
const X0 = -4.2, SPAN = 8.4, GX0 = -4.8, GLEN = 9.6, GDEPTH = 2.2;
const KA = 0.045; // arrow length per m/s
const BALL_R = 0.075;
const TUBE_SEG = 240, TUBE_RAD = 8;
const MAX_DOTS = 64, MAX_HIST = 5;
const HIST_COL = ['#ffb347', '#5aa9ff', '#c38bff', '#ff6fae', '#ffe066'];
const C_VX = '#ff9f43', C_VY = '#4fa8ff', C_V = '#4fd1a5';
const VIEW = { dist: 10.9, yaw: 0, pitch: 0.22, target: [0, 1.35, 0] };
const deg = Math.PI / 180;

function snapView(v) {
  const sv = window.stem?.view;
  if (!sv) return;
  Object.assign(sv, { yaw: v.yaw, pitch: v.pitch, dist: v.dist, goal: null });
  sv.target.set(...v.target);
}

/** The exact flight for a shot, as numbers (metres, seconds). */
function solve(a, v, h, g) {
  const vx = v * Math.cos(a * deg), vy = v * Math.sin(a * deg);
  const T = (vy + Math.sqrt(vy * vy + 2 * g * h)) / g;
  const tApex = Math.max(0, vy / g);
  const H = h + (vy > 0 ? (vy * vy) / (2 * g) : 0);
  return { a, v, h, g, vx, vy, T, tApex, H, R: vx * T };
}

class FlightCurve extends THREE.Curve {
  constructor(s, u) { super(); this.s = s; this.u = u; }
  getPoint(k, out = new THREE.Vector3()) {
    const { vx, vy, h, g, T } = this.s, t = k * T;
    return out.set(X0 + vx * t * this.u, Math.max(0, h + vy * t - 0.5 * g * t * t) * this.u, 0);
  }
}

function makeArrow(color) {
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, roughness: 0.4, toneMapped: false });
  const shaftGeo = new THREE.CylinderGeometry(0.022, 0.022, 1, 14);
  shaftGeo.translate(0, 0.5, 0);
  const headGeo = new THREE.ConeGeometry(0.06, 0.16, 18);
  headGeo.translate(0, 0.08, 0);
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(shaftGeo, mat), head = new THREE.Mesh(headGeo, mat);
  g.add(shaft, head);
  g.userData = { shaft, head };
  return g;
}
/** Point an arrow from (x, y, z) along (dx, dy) with length len (no allocation). */
function setArrow(g, x, y, z, dx, dy, len) {
  const { shaft, head } = g.userData;
  g.visible = len > 0.012;
  if (!g.visible) return;
  g.position.set(x, y, z);
  g.rotation.set(0, 0, Math.atan2(dy, dx) - Math.PI / 2);
  const hl = Math.min(0.16, len * 0.6), k = hl / 0.16;
  head.scale.set(Math.max(0.5, k), k, Math.max(0.5, k));
  shaft.scale.y = Math.max(0.001, len - hl);
  head.position.y = len - hl;
}

export default {
  view: { ...VIEW, minDist: 4, maxDist: 22 },
  floor: false,
  explain: `
    <p>A <b>projectile</b> is anything that flies freely after it is launched: a ball, a long jumper, a water jet. This lab ignores <b>air resistance</b>, so the only force is gravity. By Newton's second law (<i>a</i> = <i>F</i>/<i>m</i> = <i>mg</i>/<i>m</i>) every projectile accelerates downward at <i>g</i>, whatever its mass.</p>
    <ul>
      <li>Split the launch velocity into a horizontal part <i>v</i><sub>x</sub> = <i>v</i> cos θ and a vertical part <i>v</i><sub>y</sub> = <i>v</i> sin θ (the orange and blue arrows).</li>
      <li><b>Horizontally</b> no force acts, so <i>v</i><sub>x</sub> never changes. The strobe dots, dropped at equal time steps, are evenly spaced left to right.</li>
      <li><b>Vertically</b> gravity changes <i>v</i><sub>y</sub> by <i>g</i> every second. It shrinks to zero at the top, then grows downward.</li>
      <li>Together the two motions make a <b>parabola</b>.</li>
    </ul>
    <p>From flat ground the longest range is at 45°, and angles that add up to 90° (like 30° and 60°) land in the same place. Launching from a height changes this: the best angle drops below 45°.</p>
    <p>Gravity is weaker on Mars (3.71 m/s²) and the Moon (1.62 m/s²), so flights last longer and go further: from the ground, the same launch goes about 6 times as far on the Moon as on Earth.</p>
    <p class="muted">The simulation uses the exact equations below (no air, flat ground). The range is scaled to fit, with distances marked in real metres.</p>`,
  formula: '<i>x</i> = <i>v</i> cos θ · <i>t</i> &nbsp;&nbsp; <i>y</i> = <i>h</i> + <i>v</i> sin θ · <i>t</i> − ½<i>g</i><i>t</i>²<br>' +
    'Flight time <i>T</i> = (<i>v</i> sin θ + √(<i>v</i>² sin²θ + 2<i>gh</i>)) / <i>g</i><br>' +
    'Max height <i>H</i> = <i>h</i> + <i>v</i>² sin²θ / 2<i>g</i> &nbsp;&nbsp; Range <i>R</i> = <i>v</i> cos θ · <i>T</i><br>' +
    'From the ground (<i>h</i> = 0): <i>R</i> = <i>v</i>² sin 2θ / <i>g</i>',
  vocab: [
    ['Projectile', 'An object moving under gravity alone after it is launched.'],
    ['Trajectory', 'The path a projectile follows; here a parabola.'],
    ['Velocity components', 'The horizontal (vx) and vertical (vy) parts of the velocity.'],
    ['g', 'Acceleration due to gravity: 9.81 m/s² on Earth, 3.71 on Mars, 1.62 on the Moon.'],
    ['Time of flight', 'How long the projectile is in the air (T).'],
    ['Maximum height', 'The highest point (H), where the vertical velocity is zero.'],
    ['Range', 'The horizontal distance from launch to landing (R).'],
    ['Air resistance', 'Drag from the air. Ignored here; in real life it shortens long flights.'],
  ],
  standards: ['NGSS HS-PS2-1'],
  quiz: [
    { q: 'With no air resistance, what happens to a projectile\'s horizontal velocity during its flight?', choices: ['It increases', 'It decreases', 'It stays the same', 'It becomes zero at the top'], answer: 2,
      why: 'No horizontal force acts, so by Newton\'s laws the horizontal velocity stays constant. Only the vertical velocity changes.' },
    { q: 'At the very top of its path, what is the projectile\'s vertical velocity?', choices: ['Zero', 'Equal to the launch speed', '9.81 m/s', 'At its maximum'], answer: 0,
      why: 'The vertical velocity shrinks to zero at the top, then points downward. The acceleration is still g there; only vy is zero.' },
    { q: 'Launching from flat ground at a fixed speed, which angle gives the longest range?', choices: ['30°', '45°', '60°', '90°'], answer: 1,
      why: 'R = v² sin 2θ / g is largest when sin 2θ = 1, which is at θ = 45°.' },
    { q: 'A ball launched from the ground at 30° lands 35 m away. At the same speed, which other angle lands at the same spot?', choices: ['15°', '45°', '60°', '75°'], answer: 2,
      why: 'sin 2θ is the same for θ and 90° − θ: sin 60° = sin 120°. So 30° and 60° give the same range.' },
    { q: 'The same ground-level launch is done on the Moon (g = 1.62 m/s²) instead of Earth (g = 9.81 m/s²). The range is:', choices: ['About the same', 'About 6 times shorter', 'About 6 times longer', 'About 36 times longer'], answer: 2,
      why: 'R = v² sin 2θ / g, so range is inversely proportional to g. 9.81 / 1.62 ≈ 6.' },
  ],

  build(ctx) {
    const { root, ui } = ctx;
    const q = new URLSearchParams(location.search);
    const num = (k, d, lo, hi) => (q.has(k) && Number.isFinite(+q.get(k)) ? Math.min(hi, Math.max(lo, +q.get(k))) : d);
    const S = {
      world: WORLDS[q.get('w')] ? q.get('w') : 'earth',
      angle: num('a', 45, 0, 90), speed: num('v', 20, 1, 30), h: num('h', 0, 0, 20),
      play: 1, phase: 'idle', t: 0, shot: null, target: null, readT: 0,
    };
    const W = () => WORLDS[S.world];
    const U = () => SPAN / W().maxM; // scene units per metre

    // ── the range ─────────────────────────────────────────────────────────────────────────
    const canvas = document.createElement('canvas');
    canvas.width = 2048; canvas.height = 470;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const side = new THREE.MeshStandardMaterial({ color: 0x1a2030, roughness: 0.6, metalness: 0.4 });
    const top = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0 });
    const ground = new THREE.Mesh(new THREE.BoxGeometry(GLEN, 0.16, GDEPTH), [side, side, top, side, side, side]);
    ground.position.y = -0.08;
    ground.receiveShadow = true;
    const stand = new THREE.Mesh(new THREE.BoxGeometry(GLEN + 0.5, 0.22, GDEPTH + 0.5), new THREE.MeshStandardMaterial({ color: 0x121826, roughness: 0.4, metalness: 0.6 }));
    stand.position.y = -0.27;
    stand.receiveShadow = true;
    const edgeMat = new THREE.MeshBasicMaterial({ color: '#4fd1a5', toneMapped: false });
    for (const z of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(GLEN + 0.5, 0.02, 0.02), edgeMat);
      e.position.set(0, -0.16, z * (GDEPTH / 2 + 0.25));
      root.add(e);
    }
    root.add(ground, stand);

    const tickLabels = Array.from({ length: 8 }, () => { const l = ctx.label('0 m', { color: '#e6ecff', size: 0.6 }); root.add(l); return l; });
    function paintGround() {
      const w = W(), g = canvas.getContext('2d'), Wc = canvas.width, Hc = canvas.height;
      const grad = g.createLinearGradient(0, 0, 0, Hc);
      grad.addColorStop(0, w.ground[0]); grad.addColorStop(0.5, w.ground[1]); grad.addColorStop(1, w.ground[0]);
      g.fillStyle = grad;
      g.fillRect(0, 0, Wc, Hc);
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      g.fillStyle = w.speck;
      for (let i = 0; i < 9000; i++) { g.globalAlpha = 0.08 + rnd() * 0.18; g.fillRect(rnd() * Wc, rnd() * Hc, 1 + rnd() * 3, 1 + rnd() * 3); }
      if (S.world === 'moon') { // a few shallow craters
        for (let i = 0; i < 26; i++) { const x = rnd() * Wc, y = rnd() * Hc, r = 6 + rnd() * 26; g.globalAlpha = 0.18; g.strokeStyle = '#2d2f35'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke(); }
      }
      g.globalAlpha = 1;
      const px = (m) => ((X0 + m * U() - GX0) / GLEN) * Wc;
      // lane
      g.fillStyle = 'rgba(0,0,0,0.16)';
      g.fillRect(px(0), Hc * 0.3, px(w.maxM) - px(0), Hc * 0.4);
      g.strokeStyle = w.line;
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(px(0), Hc * 0.3); g.lineTo(px(w.maxM), Hc * 0.3); g.moveTo(px(0), Hc * 0.7); g.lineTo(px(w.maxM), Hc * 0.7); g.stroke();
      for (let m = 0; m <= w.maxM + 1e-6; m += w.minor) {
        const major = Math.abs(m / w.major - Math.round(m / w.major)) < 1e-6;
        g.lineWidth = major ? 5 : 2;
        g.globalAlpha = major ? 0.95 : 0.55;
        g.beginPath(); g.moveTo(px(m), Hc * (major ? 0.18 : 0.3)); g.lineTo(px(m), Hc * (major ? 0.82 : 0.7)); g.stroke();
      }
      g.globalAlpha = 1;
      tex.needsUpdate = true;
      let k = 0;
      for (let m = 0; m <= w.maxM + 1e-6; m += w.major, k++) {
        tickLabels[k] = ctx.relabel(tickLabels[k], `${m} m`, { color: '#e6ecff', size: 0.6 });
        tickLabels[k].position.set(X0 + m * U(), 0.02, GDEPTH / 2 + 0.05);
        tickLabels[k].visible = true;
      }
      for (; k < tickLabels.length; k++) tickLabels[k].visible = false;
    }

    // ── launcher ──────────────────────────────────────────────────────────────────────────
    const steel = new THREE.MeshStandardMaterial({ color: 0xb9c0cc, metalness: 1, roughness: 0.3 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a3142, metalness: 0.7, roughness: 0.35 });
    const accent = new THREE.MeshPhysicalMaterial({ color: '#4fd1a5', roughness: 0.3, clearcoat: 1, metalness: 0.2 });
    const launcher = new THREE.Group();
    launcher.position.x = X0;
    root.add(launcher);
    const towerGeo = new THREE.CylinderGeometry(0.075, 0.1, 1, 28);
    towerGeo.translate(0, 0.5, 0);
    const tower = new THREE.Mesh(towerGeo, steel);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.05, 40), dark);
    foot.position.y = 0.025;
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 40), dark);
    const yoke = new THREE.Group();
    for (const z of [-0.085, 0.085]) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.02), accent);
      plate.position.set(0, 0.06, z);
      yoke.add(plate);
    }
    const pivot = new THREE.Group();
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 24), steel);
    hub.rotation.x = Math.PI / 2;
    const barrelGeo = new THREE.CylinderGeometry(0.058, 0.07, 0.62, 32, 1, true);
    barrelGeo.rotateZ(-Math.PI / 2);
    barrelGeo.translate(-0.17, 0, 0);
    const barrel = new THREE.Mesh(barrelGeo, new THREE.MeshPhysicalMaterial({ color: 0x3a4256, metalness: 0.9, roughness: 0.25, clearcoat: 0.6, side: THREE.DoubleSide }));
    const muzzle = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.012, 10, 32), accent);
    muzzle.rotation.y = Math.PI / 2;
    muzzle.position.x = 0.14;
    const breech = new THREE.Mesh(new THREE.SphereGeometry(0.07, 24, 16), dark);
    breech.position.x = -0.48;
    pivot.add(hub, barrel, muzzle, breech);
    launcher.add(tower, foot, deck, yoke, pivot);
    launcher.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    let launchLabel = ctx.label('h = 0 m', { color: '#bff5e2', size: 0.62 });
    launcher.add(launchLabel);

    function placeLauncher() {
      const y = S.h * U();
      tower.visible = y > 0.06;
      tower.scale.y = Math.max(0.001, y - 0.1);
      deck.position.y = Math.max(0.02, y - 0.1);
      yoke.position.y = deck.position.y;
      yoke.scale.y = Math.max(0.2, (y - deck.position.y + 0.02) / 0.1);
      pivot.position.y = y;
      pivot.rotation.z = S.angle * deg;
      launchLabel.position.set(-0.45, y * 0.5 + 0.1, 0.35);
    }

    // ── ball, arrows, strobe dots ─────────────────────────────────────────────────────────
    const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 40, 28), new THREE.MeshPhysicalMaterial({ color: '#ff5a4f', roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 }));
    ball.castShadow = true;
    root.add(ball);
    const arrows = { vx: makeArrow(C_VX), vy: makeArrow(C_VY), v: makeArrow(C_V) };
    for (const a of Object.values(arrows)) root.add(a);
    const arrowLabels = {
      vx: ctx.label('vx', { color: C_VX, size: 0.6 }), vy: ctx.label('vy', { color: C_VY, size: 0.6 }), v: ctx.label('v', { color: C_V, size: 0.6 }),
    };
    for (const l of Object.values(arrowLabels)) root.add(l);
    const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.032, 14, 10), new THREE.MeshBasicMaterial({ color: '#e9fff7', toneMapped: false }), MAX_DOTS);
    dots.count = 0;
    dots.frustumCulled = false;
    root.add(dots);
    const mTmp = new THREE.Matrix4();

    // ── prediction ghost ──────────────────────────────────────────────────────────────────
    const GN = 161;
    const ghostGeo = new THREE.BufferGeometry();
    ghostGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(GN * 3), 3));
    ghostGeo.setAttribute('lineDistance', new THREE.BufferAttribute(new Float32Array(GN), 1));
    const ghost = new THREE.Line(ghostGeo, new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.09, gapSize: 0.07, transparent: true, opacity: 0.55 }));
    ghost.frustumCulled = false;
    root.add(ghost);
    const ghostLand = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.13, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, toneMapped: false, side: THREE.DoubleSide }));
    ghostLand.rotation.x = -Math.PI / 2;
    ghostLand.position.y = 0.006;
    root.add(ghostLand);

    function updateGhost() {
      const s = solve(S.angle, S.speed, S.h, W().g), u = U();
      const pos = ghostGeo.attributes.position.array, ld = ghostGeo.attributes.lineDistance.array;
      let px = 0, py = 0;
      for (let i = 0; i < GN; i++) {
        const t = (i / (GN - 1)) * s.T;
        const x = X0 + s.vx * t * u, y = Math.max(0, s.h + s.vy * t - 0.5 * s.g * t * t) * u;
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = 0;
        ld[i] = i ? ld[i - 1] + Math.hypot(x - px, y - py) : 0;
        px = x; py = y;
      }
      ghostGeo.attributes.position.needsUpdate = true;
      ghostGeo.attributes.lineDistance.needsUpdate = true;
      ghostLand.position.x = X0 + s.R * u;
      pred.T.set(`${s.T.toFixed(2)} s`);
      pred.H.set(`${s.H.toFixed(2)} m`);
      pred.R.set(`<b>${s.R.toFixed(2)} m</b>`);
      pred.vxy.set(`${s.vx.toFixed(2)} / ${s.vy.toFixed(2)} m/s`);
      flatNote.set(S.h === 0
        ? `From the ground: R = v² sin 2θ / g = ${S.speed}² × sin ${2 * S.angle}° / ${W().g} = <b>${s.R.toFixed(2)} m</b>.`
        : `Launched ${S.h} m up, so the ground-level formula no longer applies: it would give ${((S.speed * S.speed * Math.sin(2 * S.angle * deg)) / W().g).toFixed(2)} m.`);
      if (S.phase === 'idle') placeBallAt(0, s);
    }

    // ── shots ─────────────────────────────────────────────────────────────────────────────
    const histGroup = new THREE.Group();
    root.add(histGroup);
    const history = []; // { mesh, marker, s }
    const rows = [];
    let current = null; // { s, tube, dtS, nDots }
    const curMat = new THREE.MeshBasicMaterial({ color: '#4fd1a5', toneMapped: false });
    const apex = new THREE.Group();
    const apexLineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0)]);
    const apexLine = new THREE.Line(apexLineGeo, new THREE.LineDashedMaterial({ color: C_VY, dashSize: 0.06, gapSize: 0.05 }));
    apexLine.computeLineDistances();
    const apexDot = new THREE.Mesh(new THREE.OctahedronGeometry(0.05), new THREE.MeshBasicMaterial({ color: C_VY, toneMapped: false }));
    apex.add(apexLine, apexDot);
    apex.visible = false;
    root.add(apex);
    let apexLabel = ctx.label('H', { color: '#9fd0ff', size: 0.62 });
    root.add(apexLabel);
    apexLabel.visible = false;
    let landLabel = ctx.label('R', { color: '#bff5e2', size: 0.7 });
    root.add(landLabel);
    landLabel.visible = false;
    const puff = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.1, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, toneMapped: false, side: THREE.DoubleSide, depthWrite: false }));
    puff.rotation.x = -Math.PI / 2;
    puff.position.y = 0.01;
    root.add(puff);
    let puffT = 9;

    function placeBallAt(t, s) {
      const u = U();
      const vyNow = s.vy - s.g * t;
      const x = X0 + s.vx * t * u, y = Math.max(0, s.h + s.vy * t - 0.5 * s.g * t * t) * u;
      ball.position.set(x, y, 0);
      const z = 0.0;
      setArrow(arrows.vx, x, y, z, 1, 0, s.vx * KA);
      setArrow(arrows.vy, x, y, z, 0, Math.sign(vyNow) || 1, Math.abs(vyNow) * KA);
      setArrow(arrows.v, x, y, z, s.vx, vyNow, Math.hypot(s.vx, vyNow) * KA);
      arrowLabels.vx.visible = arrows.vx.visible;
      arrowLabels.vy.visible = arrows.vy.visible;
      arrowLabels.v.visible = arrows.v.visible;
      arrowLabels.vx.position.set(x + s.vx * KA + 0.12, y, z);
      arrowLabels.vy.position.set(x - 0.14, y + vyNow * KA + (vyNow >= 0 ? 0.1 : -0.1), z);
      arrowLabels.v.position.set(x + s.vx * KA + 0.1, y + vyNow * KA + 0.1, z);
      if (performance.now() - S.readT > 90 || t === 0 || t === s.T) {
        S.readT = performance.now();
        live.t.set(`${t.toFixed(2)} s`);
        live.xy.set(`${(s.vx * t).toFixed(1)} m, ${Math.max(0, s.h + s.vy * t - 0.5 * s.g * t * t).toFixed(1)} m`);
        live.v.set(`<span style="color:${C_VX}">${s.vx.toFixed(1)}</span> / <span style="color:${C_VY}">${vyNow.toFixed(1)}</span> m/s · |v| ${Math.hypot(s.vx, vyNow).toFixed(1)}`);
      }
    }

    function retireCurrent() {
      if (!current) return;
      const col = HIST_COL[Math.max(0, rows.length - 1) % HIST_COL.length];
      current.tube.material = new THREE.MeshBasicMaterial({ color: col, toneMapped: false, transparent: true, opacity: 0.7 });
      current.tube.geometry.setDrawRange(0, Infinity);
      const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 8), current.tube.material);
      marker.position.set(X0 + current.s.R * U(), 0.15, 0);
      histGroup.add(current.tube, marker);
      history.push({ mesh: current.tube, marker });
      while (history.length > MAX_HIST) {
        const old = history.shift();
        for (const m of [old.mesh, old.marker]) { histGroup.remove(m); m.geometry.dispose(); }
        old.mesh.material.dispose();
      }
      current = null;
    }
    function clearHistory() {
      if (current && S.phase !== 'flying') retireCurrent();
      for (const h of history) { for (const m of [h.mesh, h.marker]) { histGroup.remove(m); m.geometry.dispose(); } h.mesh.material.dispose(); }
      history.length = 0;
    }

    function launch() {
      if (current) {
        if (S.phase === 'flying') { // finish the old shot instantly and keep it
          S.t = current.s.T;
          land(true);
        }
        retireCurrent();
      }
      const s = solve(S.angle, S.speed, S.h, W().g);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new FlightCurve(s, U()), TUBE_SEG, 0.02, TUBE_RAD, false), curMat);
      tube.geometry.setDrawRange(0, 0);
      tube.frustumCulled = false;
      root.add(tube);
      const steps = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2];
      const dtS = steps.find((d) => s.T / d <= MAX_DOTS - 2) ?? 2;
      current = { s, tube, dtS, nDots: 0 };
      dots.count = 0;
      S.t = 0; S.phase = 'flying';
      apex.visible = false; apexLabel.visible = false; landLabel.visible = false;
      apexLabel = ctx.relabel(apexLabel, `H = ${s.H.toFixed(1)} m`, { color: '#9fd0ff', size: 0.62 });
      apexLabel.position.set(X0 + s.vx * s.tApex * U() + 0.08, s.H * U() + 0.2, 0);
      apex.position.set(X0 + s.vx * s.tApex * U(), 0, 0);
      apexLine.scale.y = Math.max(0.001, s.H * U());
      apexDot.position.y = s.H * U();
      landLabel = ctx.relabel(landLabel, `R = ${s.R.toFixed(1)} m`, { color: '#bff5e2', size: 0.7 });
      landLabel.position.set(X0 + s.R * U(), 0.35, 0);
      landLabel.visible = false;
      strobeNote.set(`Strobe dots every ${dtS} s. Equal horizontal gaps: v<sub>x</sub> is constant.`);
      status.set(`In flight on ${W().name}…`);
    }

    function land(quiet = false) {
      const s = current.s;
      S.phase = 'landed';
      S.t = s.T;
      current.tube.geometry.setDrawRange(0, Infinity);
      placeBallAt(s.T, s);
      while (current.nDots * current.dtS <= s.T + 1e-9 && current.nDots < MAX_DOTS) addDot();
      landLabel.visible = true;
      apex.visible = s.vy > 0; apexLabel.visible = s.vy > 0;
      puffT = 0;
      puff.position.x = X0 + s.R * U();
      rows.push({ ...s, world: W().name });
      renderRows();
      let msg = `Landed: R = ${s.R.toFixed(2)} m after ${s.T.toFixed(2)} s.`;
      if (S.target != null) {
        const tolM = 0.2 / U();
        const miss = s.R - S.target;
        if (Math.abs(miss) <= tolM) { msg += ' Bullseye!'; if (!quiet) ctx.toast('Target hit!', 'good'); }
        else msg += ` ${Math.abs(miss).toFixed(1)} m ${miss > 0 ? 'past' : 'short of'} the target.`;
      }
      status.set(msg);
    }
    function addDot() {
      const s = current.s, t = current.nDots * current.dtS, u = U();
      mTmp.makeTranslation(X0 + s.vx * t * u, Math.max(0, s.h + s.vy * t - 0.5 * s.g * t * t) * u, 0);
      dots.setMatrixAt(current.nDots, mTmp);
      current.nDots++;
      dots.count = current.nDots;
      dots.instanceMatrix.needsUpdate = true;
    }

    function renderRows() {
      if (!rows.length) { table.set('<span class="muted">No shots yet. Launch to start a comparison.</span>'); return; }
      const last = rows.slice(-6);
      const off = rows.length - last.length;
      table.set(`<table style="width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums">` +
        `<tr style="color:#8e9bb8;text-align:right"><th style="text-align:left">#</th><th>θ</th><th>v</th><th>h</th><th>g</th><th>T s</th><th>H m</th><th>R m</th></tr>` +
        last.map((r, i) => {
          const n = off + i;
          const col = n === rows.length - 1 ? '#4fd1a5' : HIST_COL[n % HIST_COL.length];
          return `<tr style="text-align:right"><td style="text-align:left;color:${col}">●${n + 1}</td><td>${r.a}°</td><td>${r.v}</td><td>${r.h}</td><td>${r.g}</td><td>${r.T.toFixed(2)}</td><td>${r.H.toFixed(1)}</td><td><b>${r.R.toFixed(1)}</b></td></tr>`;
        }).join('') + '</table>');
    }

    // ── target challenge ──────────────────────────────────────────────────────────────────
    const target = new THREE.Group();
    [0.2, 0.15, 0.1, 0.05].forEach((r, i) => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshStandardMaterial({ color: i % 2 ? '#ffffff' : '#ff4d4d', roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1 - i, polygonOffsetUnits: -1 - i }));
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.004 + i * 0.001;
      m.receiveShadow = true;
      target.add(m);
    });
    const flag = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 8), steel);
    flag.position.set(0, 0.25, -0.3);
    target.add(flag);
    let targetLabel = ctx.label('Target', { color: '#ff9a9a', size: 0.62 });
    targetLabel.position.set(0, 0.6, -0.3);
    target.add(targetLabel);
    target.visible = false;
    root.add(target);
    function placeTarget() {
      if (S.target == null) { target.visible = false; return; }
      target.visible = true;
      target.position.x = X0 + S.target * U();
      targetLabel = ctx.relabel(targetLabel, `Target ${S.target} m`, { color: '#ff9a9a', size: 0.62 });
    }

    // ── controls ──────────────────────────────────────────────────────────────────────────
    ui.choice('Gravity', {
      options: [{ value: 'earth', label: 'Earth 9.81' }, { value: 'moon', label: 'Moon 1.62' }, { value: 'mars', label: 'Mars 3.71' }],
      value: S.world,
      onChange: (v) => setWorld(v),
    });
    ui.slider('Launch angle θ', { min: 0, max: 90, step: 1, value: S.angle, fmt: (v) => `${v}°`, onChange: (v) => { S.angle = v; settingsChanged(); } });
    ui.slider('Launch speed v', { min: 1, max: 30, step: 0.5, value: S.speed, fmt: (v) => `${v} m/s`, onChange: (v) => { S.speed = v; settingsChanged(); } });
    ui.slider('Launch height h', { min: 0, max: 20, step: 0.5, value: S.h, fmt: (v) => `${v} m`, onChange: (v) => { S.h = v; settingsChanged(); } });
    ui.button('Launch', () => launch(), { primary: true });
    ui.button('Clear shots', () => { clearHistory(); rows.length = 0; renderRows(); });
    ui.button('New target', () => {
      const w = W();
      S.target = Math.round(w.maxM * (0.25 + Math.random() * 0.6));
      placeTarget();
      status.set(`Hit the target at ${S.target} m. The dashed curve shows where you'll land.`);
    });
    ui.choice('Playback', { options: [{ value: 0.5, label: '½×' }, { value: 1, label: '1×' }, { value: 2, label: '2×' }, { value: 4, label: '4×' }], value: 1, onChange: (v) => (S.play = v) });
    ui.toggle('Show prediction', { value: true, onChange: (v) => { ghost.visible = ghostLand.visible = v; } });
    const status = ui.note('');

    ui.heading('Prediction (exact formulas)');
    const pred = { T: ui.readout('Flight time T'), H: ui.readout('Max height H'), R: ui.readout('Range R'), vxy: ui.readout('vx / vy at launch') };
    const flatNote = ui.note('');
    ui.heading('Live');
    const live = { t: ui.readout('Time t'), xy: ui.readout('Position x, y'), v: ui.readout('Velocity vx / vy') };
    const strobeNote = ui.note('');
    ui.heading('Shots');
    const table = ui.note('');
    ui.note('<span class="muted">No air resistance: real balls fall short of these ranges, especially fast ones.</span>');

    function settingsChanged() {
      placeLauncher();
      if (S.phase !== 'flying' && current) { retireCurrent(); }
      if (S.phase !== 'flying') { S.phase = 'idle'; dots.count = 0; apex.visible = apexLabel.visible = landLabel.visible = false; }
      launchLabel = ctx.relabel(launchLabel, `h = ${S.h} m`, { color: '#bff5e2', size: 0.62 });
      updateGhost();
    }
    function setWorld(w) {
      if (current && S.phase === 'flying') { S.t = current.s.T; land(true); }
      clearHistory();
      if (current) { root.remove(current.tube); current.tube.geometry.dispose(); current = null; }
      if (S.target != null) S.target = Math.round(Math.min(S.target * (WORLDS[w].maxM / W().maxM), WORLDS[w].maxM));
      S.world = w; S.phase = 'idle'; dots.count = 0;
      apex.visible = apexLabel.visible = landLabel.visible = false;
      paintGround();
      placeLauncher();
      placeTarget();
      updateGhost();
      status.set(`${W().name}: g = ${W().g} m/s². Range marks rescaled to ${W().maxM} m.`);
    }

    // ── start ─────────────────────────────────────────────────────────────────────────────
    paintGround();
    placeLauncher();
    settingsChanged();
    renderRows();
    const demo = q.get('demo');
    if (demo === 'compare') {
      for (const a of [30, 45, 60]) { S.angle = a; launch(); land(true); }
      S.angle = num('a', 45, 0, 90);
      updateGhost();
    }
    if (demo === 'fire' || demo === 'compare') {
      launch();
      if (q.has('t')) S.t = Math.min(current.s.T, +q.get('t') || 0);
    }
    let snap = q.has('snap');

    return {
      update(dt) {
        if (snap) { snap = false; snapView(VIEW); }
        if (S.phase === 'flying' && current) {
          const s = current.s;
          S.t = Math.min(s.T, S.t + dt * S.play);
          const seg = Math.ceil((S.t / s.T) * TUBE_SEG);
          current.tube.geometry.setDrawRange(0, seg * TUBE_RAD * 6);
          while (current.nDots < MAX_DOTS && current.nDots * current.dtS <= S.t) addDot();
          if (s.vy > 0 && S.t >= s.tApex && !apex.visible) { apex.visible = true; apexLabel.visible = true; }
          placeBallAt(S.t, s);
          if (S.t >= s.T) land();
        }
        if (puffT < 1) {
          puffT += dt * 1.6;
          const k = Math.min(1, puffT);
          puff.scale.setScalar(1 + k * 5);
          puff.material.opacity = 0.7 * (1 - k);
        }
      },
      dispose() {
        for (const h of history) h.mesh.material.dispose();
      },
    };
  },
};
