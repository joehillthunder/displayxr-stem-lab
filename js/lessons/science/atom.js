// Atoms & Electron Shells (Chemistry). Two views of the first 18 elements:
//   Bohr:     a nucleus of packed protons and neutrons with electrons on shells (2, 8, 8). Add or
//             remove neutrons (isotopes) and electrons (ions); valence electrons glow gold.
//   Orbitals: quantum-model probability clouds, sampled from the exact hydrogen wavefunctions
//             (|ψ|² = R(r)² · |Y|²), coloured by the sign (phase) of ψ.
// URL helpers for screenshots: ?el=<Z>&demo=orbitals&orb=2p|3pz|…&e=<electrons>&n=<neutrons>

import * as THREE from 'three';

// [symbol, name, neutrons in the most common isotope, stable mass numbers]
const ELEMENTS = [
  ['H', 'Hydrogen', 0, [1, 2]],
  ['He', 'Helium', 2, [3, 4]],
  ['Li', 'Lithium', 4, [6, 7]],
  ['Be', 'Beryllium', 5, [9]],
  ['B', 'Boron', 6, [10, 11]],
  ['C', 'Carbon', 6, [12, 13]],
  ['N', 'Nitrogen', 7, [14, 15]],
  ['O', 'Oxygen', 8, [16, 17, 18]],
  ['F', 'Fluorine', 10, [19]],
  ['Ne', 'Neon', 10, [20, 21, 22]],
  ['Na', 'Sodium', 12, [23]],
  ['Mg', 'Magnesium', 12, [24, 25, 26]],
  ['Al', 'Aluminium', 14, [27]],
  ['Si', 'Silicon', 14, [28, 29, 30]],
  ['P', 'Phosphorus', 16, [31]],
  ['S', 'Sulfur', 16, [32, 33, 34, 36]],
  ['Cl', 'Chlorine', 18, [35, 37]],
  ['Ar', 'Argon', 22, [36, 38, 40]],
];
const GROUP = [1, 18, 1, 2, 13, 14, 15, 16, 17, 18, 1, 2, 13, 14, 15, 16, 17, 18];
const SPECIAL = {
  '1-2': 'deuterium, stable',
  '1-3': 'tritium, radioactive (half-life about 12.3 years)',
  '6-14': 'carbon-14, radioactive (half-life about 5,730 years)',
};
const SUBSHELLS = [['1s', 2], ['2s', 2], ['2p', 6], ['3s', 2], ['3p', 6]];
const SHELL_CAP = [2, 8, 8];
const SHELL_R = [0.72, 1.18, 1.64];
const SHELL_W = [0.95, 0.62, 0.44]; // angular speed, rad/s
const MAX_N = 30, MAX_E = 18;
const NUC_R = 0.095;
const ATOM_Y = 1.95;
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻' };
const sup = (s) => String(s).split('').map((c) => SUP[c] ?? c).join('');
const BOHR_VIEW = { yaw: 0.32, pitch: 0.2, dist: 8.6, target: [0, 1.85, 0] };
const ORB_VIEW = { yaw: 0.55, pitch: 0.3, dist: 8.2, target: [0, 1.8, 0] };

/** Test helper (?snap): jump the camera to a view instead of easing (headless frames are slow). */
function snapView(v) {
  const sv = window.stem?.view;
  if (!sv) return;
  Object.assign(sv, { yaw: v.yaw, pitch: v.pitch, dist: v.dist, goal: null });
  sv.target.set(...v.target);
}

const C_PROTON = new THREE.Color('#ff5a5a');
const C_NEUTRON = new THREE.Color('#aab9cf');
const C_INNER = new THREE.Color('#6cc8ff');
const C_VALENCE = new THREE.Color('#ffd25e');
const C_PLUS = new THREE.Color('#4fd1a5');
const C_MINUS = new THREE.Color('#ff6fc0');
const C_AXIS = [new THREE.Color('#ff7a7a'), new THREE.Color('#7dff9a'), new THREE.Color('#7ab8ff')];

// ── hydrogen-like orbitals (Z = 1, r in Bohr radii a₀; radial parts unnormalised) ─────────────
const RADIAL = {
  1: { 0: (r) => Math.exp(-r), rmax: 9 },
  2: { 0: (r) => (2 - r) * Math.exp(-r / 2), 1: (r) => r * Math.exp(-r / 2), rmax: 20 },
  3: { 0: (r) => (27 - 18 * r + 2 * r * r) * Math.exp(-r / 3), 1: (r) => r * (6 - r) * Math.exp(-r / 3), rmax: 34 },
};
const ORBITALS = [
  { id: '1s', label: '1s' },
  { id: '2s', label: '2s' },
  { id: '2px', label: '2p x' }, { id: '2py', label: '2p y' }, { id: '2pz', label: '2p z' },
  { id: '2p', label: '2p (x, y, z together)' },
  { id: '3s', label: '3s' },
  { id: '3px', label: '3p x' }, { id: '3py', label: '3p y' }, { id: '3pz', label: '3p z' },
  { id: '3p', label: '3p (x, y, z together)' },
];
const ORB_INFO = {
  s1: 'A sphere. No nodes. It is the lowest-energy orbital and holds the first two electrons of every atom.',
  s2: 'A sphere with one spherical <b>radial node</b> (at r = 2 a₀ for hydrogen) where the electron is never found. Inside and outside the node, ψ has opposite signs (colours).',
  p2: 'A dumbbell: two lobes on opposite sides of the nucleus with a flat <b>nodal plane</b> between them. ψ is positive in one lobe and negative in the other. There are three 2p orbitals, along x, y and z.',
  s3: 'A sphere with two radial nodes, so three shells of probability. It is much larger than 1s.',
  p3: 'Two lobes like 2p, plus one radial node (at r = 6 a₀ for hydrogen), so each lobe has a small inner part with the opposite sign.',
};

function radialSampler(n, l) {
  const R = RADIAL[n][l], rmax = RADIAL[n].rmax, M = 4000;
  const cdf = new Float64Array(M + 1);
  for (let i = 1; i <= M; i++) {
    const r = (rmax * (i - 0.5)) / M, v = R(r);
    cdf[i] = cdf[i - 1] + r * r * v * v;
  }
  const tot = cdf[M];
  for (let i = 0; i <= M; i++) cdf[i] /= tot;
  let r99 = rmax;
  for (let i = 0; i <= M; i++) if (cdf[i] >= 0.99) { r99 = (rmax * i) / M; break; }
  return {
    r99,
    R,
    sample(u) {
      let lo = 0, hi = M;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cdf[m] < u) lo = m; else hi = m; }
      const f = (u - cdf[lo]) / Math.max(1e-12, cdf[hi] - cdf[lo]);
      return (rmax * (lo + f)) / M;
    },
  };
}

function mulberry(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dotTexture(soft) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  if (soft) { grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.18, 'rgba(255,255,255,0.6)'); grad.addColorStop(0.5, 'rgba(255,255,255,0.14)'); grad.addColorStop(1, 'rgba(255,255,255,0)'); }
  else { grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.45, 'rgba(255,255,255,0.8)'); grad.addColorStop(1, 'rgba(255,255,255,0)'); }
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Bohr shell occupancy for e electrons (2, 8, 8). */
function shellsFor(e) {
  const s = [];
  let left = e;
  for (const cap of SHELL_CAP) { if (left <= 0) break; const k = Math.min(cap, left); s.push(k); left -= k; }
  return s;
}
function configFor(e) {
  if (e === 0) return '(no electrons)';
  const out = [];
  let left = e;
  for (const [name, cap] of SUBSHELLS) { if (left <= 0) break; const k = Math.min(cap, left); out.push(`${name}<sup>${k}</sup>`); left -= k; }
  return out.join(' ');
}
const chargeText = (q) => (q === 0 ? '0 (neutral)' : q > 0 ? `+${q}` : `−${-q}`);
const ionSym = (sym, q) => (q === 0 ? sym : sym + sup((Math.abs(q) > 1 ? Math.abs(q) : '') + (q > 0 ? '+' : '-')));

export default {
  view: { dist: 8.6, yaw: 0.32, pitch: 0.2, target: [0, 1.85, 0], minDist: 3, maxDist: 16 },
  floor: true,
  explain: `
    <p>Every atom has a tiny, dense <b>nucleus</b> made of <b>protons</b> (charge +1) and <b>neutrons</b> (no charge), with <b>electrons</b> (charge −1) around it.</p>
    <ul>
      <li>The number of protons, the <b>atomic number <i>Z</i></b>, decides the element. Change it and you have a different element.</li>
      <li>Change the number of neutrons and you get an <b>isotope</b>: the same element with a different mass. The <b>mass number</b> is <i>A</i> = protons + neutrons.</li>
      <li>Change the number of electrons and you get an <b>ion</b>. Lose electrons and the atom becomes positive; gain electrons and it becomes negative.</li>
    </ul>
    <p>In the <b>Bohr model</b>, electrons sit in shells. For the first 18 elements the shells fill 2, then 8, then 8. Electrons in the outermost shell are <b>valence electrons</b> (gold here). They take part in bonding, which is why elements in the same group of the periodic table behave alike.</p>
    <p>The Bohr model is a useful simplification. Electrons do not really travel on circular paths. In the <b>quantum model</b> each electron is described by an <b>orbital</b>: a cloud showing where it is likely to be found. The Orbitals view plots thousands of sample positions from the real hydrogen wavefunctions, so dense regions are where the electron is most likely to be.</p>
    <p class="muted">Not to scale: a real nucleus is tens of thousands of times smaller across than its atom.</p>`,
  formula: '<i>A</i> = <i>Z</i> + <i>N</i> &nbsp;&nbsp;·&nbsp;&nbsp; charge = protons − electrons &nbsp;&nbsp;·&nbsp;&nbsp; shell <i>n</i> holds up to 2<i>n</i>²',
  vocab: [
    ['Proton', 'A positive particle in the nucleus. Its count is the atomic number Z.'],
    ['Neutron', 'A neutral particle in the nucleus, with about the same mass as a proton.'],
    ['Electron', 'A negative particle about 1/1836 the mass of a proton, found around the nucleus.'],
    ['Mass number', 'A = protons + neutrons. Written after the name, as in carbon-14.'],
    ['Isotope', 'Atoms of the same element with different numbers of neutrons.'],
    ['Ion', 'An atom with more or fewer electrons than protons, so it has a charge.'],
    ['Valence electron', 'An electron in the outermost occupied shell; it takes part in bonding.'],
    ['Orbital', 'A region around the nucleus where an electron is likely to be found. Holds up to 2 electrons.'],
    ['Electron configuration', 'A list of how electrons fill subshells, such as 1s² 2s² 2p² for carbon.'],
  ],
  standards: ['NGSS HS-PS1-1'],
  quiz: [
    { q: 'What decides which element an atom is?', choices: ['The number of neutrons', 'The number of protons', 'The number of electrons', 'The mass number'], answer: 1,
      why: 'The atomic number Z, the number of protons, defines the element. Every carbon atom has 6 protons.' },
    { q: 'Chlorine-35 and chlorine-37 are isotopes. How are they different?', choices: ['Number of protons', 'Number of electrons', 'Number of neutrons', 'Electric charge'], answer: 2,
      why: 'Both have 17 protons. Chlorine-35 has 18 neutrons and chlorine-37 has 20, so their mass numbers differ.' },
    { q: 'A neutral sodium atom (Z = 11) loses one electron. What do you get?', choices: ['A neon atom', 'Na⁺, an ion with charge +1', 'Na⁻, an ion with charge −1', 'Sodium-22'], answer: 1,
      why: 'It now has 11 protons but only 10 electrons, so the charge is +1. It is still sodium because the proton count did not change.' },
    { q: 'How many valence electrons does a neutral oxygen atom (Z = 8) have?', choices: ['2', '4', '6', '8'], answer: 2,
      why: 'Eight electrons fill the shells 2, 6. The outer shell has 6 electrons (configuration 1s² 2s² 2p⁴).' },
    { q: 'In the quantum model, what does an orbital show?', choices: ['The exact circular path of an electron', 'A region where an electron is likely to be found', 'Where the neutrons are', 'The size of the nucleus'], answer: 1,
      why: 'An orbital is a probability cloud. It tells you where an electron is likely to be found, not a fixed path. That is why the Bohr picture is only a simplification.' },
  ],

  build(ctx) {
    const { root, ui } = ctx;
    const q = new URLSearchParams(location.search);
    const S = { z: 6, n: 6, e: 6, mode: 'bohr', orb: '2pz', trueScale: false };
    S.z = Math.min(18, Math.max(1, parseInt(q.get('el')) || 6));
    S.n = ELEMENTS[S.z - 1][2];
    S.e = S.z;
    if (q.has('n')) S.n = Math.min(MAX_N, Math.max(0, parseInt(q.get('n')) || 0));
    if (q.has('e')) S.e = Math.min(MAX_E, Math.max(0, parseInt(q.get('e')) || 0));
    if (q.get('demo') === 'orbitals') S.mode = 'orbitals';
    if (q.get('orb') && ORBITALS.some((o) => o.id === q.get('orb'))) { S.orb = q.get('orb'); S.mode = 'orbitals'; }

    const atom = new THREE.Group();
    atom.position.y = ATOM_Y;
    root.add(atom);
    const bohr = new THREE.Group();
    const orbit = new THREE.Group();
    atom.add(bohr, orbit);

    // ── nucleus ────────────────────────────────────────────────────────────────────────────
    const nucGeo = new THREE.SphereGeometry(NUC_R, 32, 22);
    const nucMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 0.4, sheenColor: new THREE.Color('#ffd0d0') });
    const nucleus = new THREE.InstancedMesh(nucGeo, nucMat, 18 + MAX_N);
    nucleus.castShadow = true;
    nucleus.receiveShadow = true;
    const nucGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTexture(true), color: 0xff8a7a, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
    bohr.add(nucleus, nucGlow);

    const tmpM = new THREE.Matrix4();
    const tmpV = new THREE.Vector3();
    function packNucleus() {
      const Z = S.z, A = S.z + S.n;
      const rnd = mulberry(Z * 131 + S.n * 7 + 1);
      const R = NUC_R * 1.05 * Math.cbrt(A);
      const p = new Float32Array(A * 3);
      for (let i = 0; i < A; i++) {
        const rr = A === 1 ? 0 : R * Math.cbrt((i + 0.5) / A);
        const y = 1 - (2 * (i + 0.5)) / A, s = Math.sqrt(1 - y * y), ph = i * 2.39996 + rnd() * 0.3;
        p[i * 3] = rr * s * Math.cos(ph); p[i * 3 + 1] = rr * y; p[i * 3 + 2] = rr * s * Math.sin(ph);
      }
      // Relax: push overlapping nucleons apart, pull everything gently to the centre.
      const min = NUC_R * 2 * 0.97;
      for (let it = 0; it < 80; it++) {
        for (let i = 0; i < A; i++) for (let j = i + 1; j < A; j++) {
          const dx = p[j * 3] - p[i * 3], dy = p[j * 3 + 1] - p[i * 3 + 1], dz = p[j * 3 + 2] - p[i * 3 + 2];
          const d = Math.hypot(dx, dy, dz) || 1e-4;
          if (d < min) {
            const k = ((min - d) / d) * 0.5;
            p[i * 3] -= dx * k; p[i * 3 + 1] -= dy * k; p[i * 3 + 2] -= dz * k;
            p[j * 3] += dx * k; p[j * 3 + 1] += dy * k; p[j * 3 + 2] += dz * k;
          }
        }
        for (let i = 0; i < A * 3; i++) p[i] *= 0.985;
      }
      const types = [];
      for (let i = 0; i < A; i++) types.push(i < Z);
      for (let i = A - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [types[i], types[j]] = [types[j], types[i]]; }
      for (let i = 0; i < A; i++) {
        tmpM.makeTranslation(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
        nucleus.setMatrixAt(i, tmpM);
        nucleus.setColorAt(i, types[i] ? C_PROTON : C_NEUTRON);
      }
      nucleus.count = A;
      nucleus.instanceMatrix.needsUpdate = true;
      nucleus.instanceColor.needsUpdate = true;
      nucleus.computeBoundingSphere();
      const rad = nucleus.boundingSphere.radius + NUC_R;
      nucGlow.scale.setScalar(rad * 4.2);
    }

    // ── shells ─────────────────────────────────────────────────────────────────────────────
    const shells = SHELL_R.map((r, i) => {
      const mat = new THREE.MeshBasicMaterial({ color: 0x4fd1a5, transparent: true, opacity: 0.5, toneMapped: false, depthWrite: false });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0075, 10, 220), mat);
      const hit = new THREE.Mesh(new THREE.TorusGeometry(r, 0.06, 6, 90), new THREE.MeshBasicMaterial({ visible: false }));
      ring.add(hit);
      bohr.add(ring);
      const label = ctx.label(`Shell ${i + 1}`, { color: '#8fe8c8', size: 0.62 });
      const a = -0.62 - i * 0.12;
      label.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
      bohr.add(label);
      ctx.pickable(hit, () => shellCard(i));
      return { ring, mat, label };
    });

    // ── electrons ──────────────────────────────────────────────────────────────────────────
    const eMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.058, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), MAX_E);
    eMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    eMesh.frustumCulled = false;
    eMesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2);
    for (let i = 0; i < MAX_E; i++) eMesh.setColorAt(i, C_INNER);
    const haloPos = new Float32Array(MAX_E * 3), haloCol = new Float32Array(MAX_E * 3);
    const haloGeo = new THREE.BufferGeometry();
    haloGeo.setAttribute('position', new THREE.BufferAttribute(haloPos, 3).setUsage(THREE.DynamicDrawUsage));
    haloGeo.setAttribute('color', new THREE.BufferAttribute(haloCol, 3));
    const halos = new THREE.Points(haloGeo, new THREE.PointsMaterial({ size: 0.95, map: dotTexture(true), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    halos.frustumCulled = false;
    bohr.add(eMesh, halos);
    const eShell = new Int8Array(MAX_E), eSlot = new Int8Array(MAX_E), shellCount = [0, 0, 0];

    function placeElectrons() {
      const occ = shellsFor(S.e);
      const outer = occ.length - 1;
      let j = 0;
      for (let s = 0; s < 3; s++) {
        shellCount[s] = occ[s] || 0;
        for (let k = 0; k < shellCount[s]; k++, j++) {
          eShell[j] = s; eSlot[j] = k;
          const c = s === outer ? C_VALENCE : C_INNER;
          eMesh.setColorAt(j, c);
          haloCol[j * 3] = c.r; haloCol[j * 3 + 1] = c.g; haloCol[j * 3 + 2] = c.b;
        }
        shells[s].mat.opacity = shellCount[s] ? (s === outer ? 0.85 : 0.55) : 0.16;
        shells[s].mat.color.set(s === outer ? '#ffd25e' : '#4fd1a5');
        shells[s].label.visible = shellCount[s] > 0;
      }
      eMesh.count = S.e;
      eMesh.instanceColor.needsUpdate = true;
      haloGeo.attributes.color.needsUpdate = true;
      haloGeo.setDrawRange(0, S.e);
      moveElectrons(lastT);
    }
    let lastT = 0;
    function moveElectrons(t) {
      for (let j = 0; j < S.e; j++) {
        const s = eShell[j], k = shellCount[s];
        const a = (Math.PI * 2 * eSlot[j]) / k + s * 0.7 + SHELL_W[s] * t;
        const x = Math.cos(a) * SHELL_R[s], y = Math.sin(a) * SHELL_R[s];
        tmpM.makeTranslation(x, y, 0);
        eMesh.setMatrixAt(j, tmpM);
        haloPos[j * 3] = x; haloPos[j * 3 + 1] = y; haloPos[j * 3 + 2] = 0;
      }
      eMesh.instanceMatrix.needsUpdate = true;
      haloGeo.attributes.position.needsUpdate = true;
    }

    // Title label above the atom.
    let title = ctx.label('…', { color: '#4fd1a5', size: 1.1 });
    title.position.set(0, SHELL_R[2] + 0.32, 0);
    atom.add(title);

    // ── orbitals ───────────────────────────────────────────────────────────────────────────
    const samplers = {};
    const sampler = (n, l) => (samplers[n * 10 + l] ||= radialSampler(n, l));
    let r99max = 0;
    for (const n of [1, 2, 3]) for (const l of n > 1 ? [0, 1] : [0]) r99max = Math.max(r99max, sampler(n, l).r99);
    const clouds = new Map();
    const dotTex = dotTexture(false);
    const cloudMat = new THREE.PointsMaterial({ size: 0.04, map: dotTex, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const cloudPts = new THREE.Points(new THREE.BufferGeometry(), cloudMat);
    cloudPts.frustumCulled = false;
    const cloudGroup = new THREE.Group();
    cloudGroup.add(cloudPts);
    orbit.add(cloudGroup);

    // chem axes (x, y, z) → three (x, -z, y): chem z is "up", chem y points into the screen.
    const AX = [[1, 0, 0], [0, 0, -1], [0, 1, 0]];
    function makeCloud(id) {
      const n = +id[0], l = id[1] === 's' ? 0 : 1;
      const axes = l === 0 ? [-1] : id.length === 3 ? ['xyz'.indexOf(id[2])] : [0, 1, 2];
      const per = axes.length > 1 ? 9000 : 14000;
      const N = per * axes.length;
      const smp = sampler(n, l);
      const rnd = mulberry(n * 977 + l * 31 + axes.length);
      const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
      let w = 0;
      for (const ax of axes) {
        for (let i = 0; i < per; i++, w++) {
          const r = smp.sample(rnd());
          let ux, uy, uz, sign = Math.sign(smp.R(r)) || 1;
          const phi = rnd() * Math.PI * 2;
          if (l === 0) {
            const ct = rnd() * 2 - 1, st = Math.sqrt(1 - ct * ct);
            ux = st * Math.cos(phi); uy = st * Math.sin(phi); uz = ct;
          } else {
            // |Y₁₀|² ∝ cos²θ: |cos θ| = cbrt(U), random sign.
            const sg = rnd() < 0.5 ? -1 : 1, ct = sg * Math.cbrt(rnd()), st = Math.sqrt(1 - ct * ct);
            sign *= sg;
            // local frame: lobe axis = ax
            const a = st * Math.cos(phi), b = st * Math.sin(phi);
            if (ax === 0) { ux = ct; uy = a; uz = b; } else if (ax === 1) { ux = b; uy = ct; uz = a; } else { ux = a; uy = b; uz = ct; }
          }
          // chem (ux, uy, uz) → three (ux, uz, -uy)
          pos[w * 3] = r * ux; pos[w * 3 + 1] = r * uz; pos[w * 3 + 2] = -r * uy;
          const c = axes.length > 1 ? C_AXIS[ax] : sign > 0 ? C_PLUS : C_MINUS;
          const k = axes.length > 1 ? (sign > 0 ? 1 : 0.55) : 1;
          col[w * 3] = c.r * k; col[w * 3 + 1] = c.g * k; col[w * 3 + 2] = c.b * k;
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.userData.r99 = smp.r99;
      return g;
    }
    // Axes with labels.
    const axisMat = new THREE.LineBasicMaterial({ color: 0x6f7fa8, transparent: true, opacity: 0.6 });
    const axisLen = 1.9;
    ['x', 'y', 'z'].forEach((name, i) => {
      const d = AX[i];
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-d[0], -d[1], -d[2]).multiplyScalar(axisLen), new THREE.Vector3(...d).multiplyScalar(axisLen)]);
      orbit.add(new THREE.Line(g, axisMat));
      const l = ctx.label(name, { color: '#' + C_AXIS[i].getHexString(), size: 0.7 });
      l.position.set(d[0] * (axisLen + 0.12), d[1] * (axisLen + 0.12), d[2] * (axisLen + 0.12));
      orbit.add(l);
    });
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff6a5a, toneMapped: false }));
    orbit.add(core);
    const cloudHit = new THREE.Mesh(new THREE.SphereGeometry(1.75, 24, 16), new THREE.MeshBasicMaterial({ visible: false }));
    orbit.add(cloudHit);
    ctx.pickable(cloudHit, () => orbitalCard());
    let orbLabel = ctx.label('…', { color: '#4fd1a5', size: 1.0 });
    orbLabel.position.set(0, -1.75, 0);
    orbit.add(orbLabel);

    function showOrbital() {
      if (!clouds.has(S.orb)) clouds.set(S.orb, makeCloud(S.orb));
      const g = clouds.get(S.orb);
      cloudPts.geometry = g;
      const scale = 1.75 / (S.trueScale ? r99max : g.userData.r99);
      cloudGroup.scale.setScalar(scale);
      cloudMat.size = 0.04 * Math.min(1.6, Math.max(0.8, Math.sqrt(scale / 0.35)));
      const lab = S.orb.length === 3 ? S.orb.slice(0, 2) + ' ' + S.orb[2] : S.orb;
      orbLabel = ctx.relabel(orbLabel, `${lab} orbital${S.orb.length === 2 && S.orb[1] === 'p' ? 's' : ''}`, { color: '#4fd1a5', size: 1.0 });
      orbNote.set(orbitalNoteHtml());
    }

    // ── state → scene + readouts ───────────────────────────────────────────────────────────
    function refresh({ nucleus: nucChanged = true } = {}) {
      const [sym, name, , stable] = ELEMENTS[S.z - 1];
      const A = S.z + S.n, qn = S.z - S.e;
      if (nucChanged) packNucleus();
      placeElectrons();
      title = ctx.relabel(title, `${name}-${A}${qn ? '  ·  ' + ionSym(sym, qn) + ' ion' : ''}`, { color: '#4fd1a5', size: 1.1 });
      const occ = shellsFor(S.e);
      r.el.set(`${name} (${sym})`);
      r.z.set(`${S.z} protons`);
      r.n.set(`${S.n}`);
      r.a.set(`${A} &nbsp;<span class="muted">(${S.z} + ${S.n})</span>`);
      r.e.set(`${S.e}`);
      r.q.set(qn === 0 ? '0 &nbsp;<span class="muted">neutral atom</span>' : `<b>${chargeText(qn)}</b> &nbsp;<span class="muted">${ionSym(sym, qn)}</span>`);
      r.cfg.set(configFor(S.e));
      r.sh.set(occ.length ? occ.join(', ') : '—');
      r.val.set(occ.length ? `${occ[occ.length - 1]}` : '0');
      r.pg.set(`period ${S.z <= 2 ? 1 : S.z <= 10 ? 2 : 3}, group ${GROUP[S.z - 1]}`);
      const key = `${S.z}-${A}`;
      const iso = `${name.toLowerCase()}-${A}`;
      let status;
      if (SPECIAL[key]) status = SPECIAL[key];
      else if (stable.includes(A)) status = `${iso}, stable${A === S.z + ELEMENTS[S.z - 1][2] ? ' (the most common isotope)' : ''}`;
      else status = `${iso}: not a stable isotope (radioactive, if it can form at all)`;
      r.iso.set(status);
      const noble = S.e === 2 || S.e === 10 || S.e === 18;
      ionNote.set(qn === 0
        ? `Neutral: ${S.z} protons balance ${S.e} electrons.${noble ? ' Its outer shell is full, so it hardly reacts.' : ''}`
        : `${qn > 0 ? `Lost ${qn}` : `Gained ${-qn}`} electron${Math.abs(qn) > 1 ? 's' : ''}: charge ${chargeText(qn)}.${noble ? ' It now has a full outer shell, like a noble gas: a common, stable ion.' : ''}`);
      elSel.set(S.z);
      if (S.mode === 'orbitals') orbNote.set(orbitalNoteHtml());
    }

    function orbitalNoteHtml() {
      const id = S.orb;
      const key = (id[1] === 's' ? 's' : 'p') + id[0];
      const [, name] = ELEMENTS[S.z - 1];
      const colours = id.length === 2 && id[1] === 'p'
        ? 'Colours: <span style="color:#ff7a7a">p<sub>x</sub></span>, <span style="color:#7dff9a">p<sub>y</sub></span>, <span style="color:#7ab8ff">p<sub>z</sub></span>; the darker lobe of each is the negative phase.'
        : 'Colours show the sign of ψ: <span style="color:#4fd1a5">positive</span> and <span style="color:#ff6fc0">negative</span>.';
      return `${ORB_INFO[key]}<br>${colours}<br><span class="muted">${S.trueScale ? 'All orbitals drawn at the same scale.' : 'Each orbital is scaled to fit; tick “true relative size” to compare.'} ${name} (${S.e} electrons): ${configFor(S.e)}.</span>`;
    }

    // ── cards ──────────────────────────────────────────────────────────────────────────────
    function nucleusCard() {
      const [, name] = ELEMENTS[S.z - 1];
      const A = S.z + S.n;
      ctx.card(`Nucleus of ${name.toLowerCase()}-${A}`,
        `<p><b style="color:#ff6a6a">${S.z} proton${S.z > 1 ? 's' : ''}</b> (charge +1 each) and <b style="color:#b9c6da">${S.n} neutron${S.n === 1 ? '' : 's'}</b> (no charge), so the nucleus has charge +${S.z} and mass number ${A}.</p>` +
        `<p>The strong nuclear force holds protons and neutrons together even though the protons repel each other. The nucleus holds more than 99.9% of the atom's mass but is tens of thousands of times smaller across than the atom; here it is drawn hugely enlarged.</p>`,
        { kind: 'Nucleus' });
    }
    function electronCard(j) {
      const s = eShell[j], occ = shellsFor(S.e), outer = s === occ.length - 1;
      ctx.card(`Electron in shell ${s + 1}`,
        `<p>Charge −1, mass about 1/1836 of a proton's. Shell ${s + 1} has ${occ[s]} of its ${SHELL_CAP[s]} places filled here.</p>` +
        (outer ? `<p><b style="color:#ffd25e">Valence electron.</b> It is in the outermost shell, so it is the one that is shared, gained or lost when the atom bonds.</p>`
          : `<p>An inner (core) electron. It is held more tightly, closer to the nucleus, and does not usually take part in bonding.</p>`),
        { kind: 'Electron' });
    }
    function shellCard(s) {
      ctx.card(`Shell ${s + 1} (energy level n = ${s + 1})`,
        `<p>Holds up to 2n² = ${2 * (s + 1) ** 2} electrons.${s === 2 ? ' For the first 20 elements, though, it takes only 8 before the 4th shell starts to fill.' : ''} Electrons further out have more energy and are held less tightly.</p>` +
        `<p>Subshells: ${s === 0 ? '1s (2)' : s === 1 ? '2s (2) and 2p (6)' : '3s (2), 3p (6) and 3d (10)'}. Now holding ${shellCount[s] || 0}.</p>`,
        { kind: 'Bohr shell' });
    }
    function orbitalCard() {
      const id = S.orb, key = (id[1] === 's' ? 's' : 'p') + id[0];
      const n = +id[0], l = id[1] === 's' ? 0 : 1;
      ctx.card(`${ORBITALS.find((o) => o.id === id).label} orbital${id.length === 2 && l === 1 ? 's' : ''}`,
        `<p>${ORB_INFO[key]}</p><p>n = ${n}, l = ${l}: it has ${n - 1} node${n - 1 === 1 ? '' : 's'} in total (${n - l - 1} radial, ${l} angular). Each orbital holds at most 2 electrons, with opposite spins.</p>` +
        `<p class="muted">Each dot is one possible position from the exact hydrogen wavefunction |ψ|². 99% of the probability lies within ${clouds.get(id).userData.r99.toFixed(1)} Bohr radii (a₀ = 0.0529 nm).</p>`,
        { kind: 'Quantum orbital' });
    }
    ctx.pickable(nucleus, () => nucleusCard());
    ctx.pickable(eMesh, (hit) => electronCard(hit.instanceId ?? 0));

    // ── controls ───────────────────────────────────────────────────────────────────────────
    ui.heading('Element');
    const elSel = ui.select('Element', {
      options: ELEMENTS.map(([s, n], i) => ({ value: i + 1, label: `${i + 1}  ${s}  ${n}` })),
      value: S.z,
      onChange: (v) => setElement(+v),
    });
    ui.button('◀ Previous', () => setElement(S.z > 1 ? S.z - 1 : 18));
    ui.button('Next ▶', () => setElement(S.z < 18 ? S.z + 1 : 1));
    function setElement(z) {
      S.z = z; S.n = ELEMENTS[z - 1][2]; S.e = z;
      refresh();
    }

    ui.heading('Isotope (neutrons)');
    ui.button('− neutron', () => { if (S.n > 0) { S.n--; refresh(); } else ctx.toast('No neutrons left.'); });
    ui.button('+ neutron', () => { if (S.n < MAX_N) { S.n++; refresh(); } else ctx.toast(`That's the most this lab allows.`); });
    ui.heading('Ion (electrons)');
    ui.button('− electron', () => { if (S.e > 0) { S.e--; refresh({ nucleus: false }); } else ctx.toast('No electrons left: a bare nucleus.'); });
    ui.button('+ electron', () => { if (S.e < MAX_E) { S.e++; refresh({ nucleus: false }); } else ctx.toast('The Bohr view here stops at 18 electrons.'); });
    ui.button('Neutral atom', () => setElement(S.z));
    const ionNote = ui.note('');

    const r = {
      el: ui.readout('Element'),
      z: ui.readout('Atomic number Z'),
      n: ui.readout('Neutrons N'),
      a: ui.readout('Mass number A'),
      e: ui.readout('Electrons'),
      q: ui.readout('Charge'),
      cfg: ui.readout('Configuration'),
      sh: ui.readout('Bohr shells'),
      val: ui.readout('Valence electrons'),
      pg: ui.readout('Periodic table'),
      iso: ui.readout('Isotope'),
    };
    r.iso.el.style.flexWrap = 'wrap';
    for (const k in r) Object.assign(r[k].el.style, { display: 'flex', justifyContent: 'space-between', gap: '10px', margin: '0 0 6px' });

    ui.heading('Model');
    const modeCtl = ui.choice('', {
      options: [{ value: 'bohr', label: 'Bohr shells' }, { value: 'orbitals', label: 'Quantum orbitals' }],
      value: S.mode,
      onChange: (v) => setMode(v),
    });
    ui.select('Orbital', {
      options: ORBITALS.map((o) => ({ value: o.id, label: o.label })),
      value: S.orb,
      onChange: (v) => { S.orb = v; if (S.mode !== 'orbitals') { modeCtl.set('orbitals'); setMode('orbitals'); } else showOrbital(); },
    });
    ui.toggle('True relative size', { value: false, onChange: (v) => { S.trueScale = v; if (S.mode === 'orbitals') showOrbital(); } });
    const orbNote = ui.note('');
    ui.note('<span class="muted">The Bohr model (flat circles) is a simplification: real electrons are spread out in orbitals. Click the nucleus, an electron, a shell or a cloud for details.</span>');

    function setMode(m) {
      S.mode = m;
      bohr.visible = m === 'bohr';
      title.visible = m === 'bohr';
      orbit.visible = m === 'orbitals';
      ctx.hideCard();
      if (m === 'orbitals') { showOrbital(); ctx.view(ORB_VIEW); }
      else { orbNote.set(''); ctx.view(BOHR_VIEW); }
    }

    refresh();
    bohr.visible = S.mode === 'bohr';
    title.visible = S.mode === 'bohr';
    orbit.visible = S.mode === 'orbitals';
    if (S.mode === 'orbitals') showOrbital();
    if (q.get('demo') === 'card') nucleusCard();
    let snap = q.has('snap');

    return {
      update(dt, t) {
        lastT = t;
        if (bohr.visible) {
          moveElectrons(t);
          nucleus.rotation.y += dt * 0.35;
          nucleus.rotation.x = Math.sin(t * 0.4) * 0.25;
        }
        if (snap) { snap = false; snapView(S.mode === 'orbitals' ? ORB_VIEW : BOHR_VIEW); }
      },
      dispose() {
        for (const g of clouds.values()) g.dispose();
        dotTex.dispose();
      },
    };
  },
};
