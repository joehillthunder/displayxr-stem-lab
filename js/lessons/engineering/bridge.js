// Truss Bridges & Forces: a steel through-truss bridge (two parallel planar trusses, floor beams,
// deck and lateral bracing) on concrete abutments. A truck is the moving load. Each planar truss
// is solved exactly as a statically determinate pin-jointed truss: 2 equations (ΣFx = 0, ΣFy = 0)
// per joint, unknowns = member forces + 3 support reactions (pin + roller), solved by Gaussian
// elimination. Deflections come from the compatibility equations (the transpose of the same
// matrix) with member stretch e = F·L / (E·A).
//
// The model is a 1:10 scale of a 36 m span, 7.2 m deep bridge with 6 m panels: scene units × 10
// = real metres, and forces are in kN for the real bridge.
//
// URL helpers for screenshots and checks (harmless): ?truss=pratt|howe|warren, ?pos=0..1,
// ?load=kN, ?sw=1 (self-weight), ?defl=1, ?forces=1, ?pick=<member index>, ?drive=1, ?selftest.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const SCALE = 10;         // real metres per scene unit
const PANELS = 6;
const PANEL = 0.6;        // scene units (6 m)
const DEPTH = 0.72;       // truss depth (7.2 m)
const X0 = -(PANELS * PANEL) / 2;
const SPAN = PANELS * PANEL;
const YB = 1.0;           // bottom-chord centreline
const ZT = 0.45;          // the two trusses sit at z = ±ZT (9 m apart)
const DECK_TOP = YB + 0.065;
const E_STEEL = 200e6;    // kN/m² (200 GPa)
const AREA = { bottom: 0.012, top: 0.012, end: 0.012, vertical: 0.006, diagonal: 0.006 }; // m²
const WT = { bottom: 2.0, top: 2.0, end: 2.0, vertical: 1.0, diagonal: 1.0 };            // kN per m of member
const DECK_LOAD = 20;     // kN per metre of span, per truss (concrete deck + floor system)
const KIND_NAME = { bottom: 'Bottom chord', top: 'Top chord', end: 'End post', vertical: 'Vertical', diagonal: 'Diagonal' };
const KIND_INFO = {
  bottom: 'The bottom chord is the bottom edge of the truss. When the bridge sags, its bottom edge is stretched, so the bottom chord is normally in <b>tension</b>.',
  top: 'The top chord is the top edge of the truss. When the bridge sags, its top edge is squeezed, so the top chord is normally in <b>compression</b> and must be stiff enough not to buckle.',
  end: 'The end post carries the load from the top chord down into the support. It is usually the most heavily compressed member.',
  vertical: 'Verticals pass load between the top and bottom chords. In a Pratt truss they are mostly squeezed; in a Howe truss they are mostly stretched.',
  diagonal: 'Diagonals carry the shear force: the part of the load that has to travel sideways to the supports. Which way they slope decides whether they are pulled or pushed.',
};

const TYPES = {
  pratt: { name: 'Pratt', blurb: 'Diagonals slope down toward the middle, so under gravity they are in tension and the shorter verticals take the compression. Good for steel, which is strong in tension.' },
  howe: { name: 'Howe', blurb: 'Diagonals slope up toward the middle, so they are in compression and the verticals are in tension. Popular for timber bridges with iron rods as verticals.' },
  warren: { name: 'Warren', blurb: 'No verticals: equilateral-ish triangles whose diagonals alternate between tension and compression. Fewer members and joints.' },
};

/** Joints and members of one planar truss. Node positions are in scene units (x, y). */
function makeTruss(type) {
  const nodes = [];
  for (let i = 0; i <= PANELS; i++) nodes.push({ x: X0 + i * PANEL, y: YB, name: 'L' + i, bottom: true });
  const U = {};
  if (type === 'warren') {
    for (let j = 1; j <= PANELS; j++) { U[j] = nodes.length; nodes.push({ x: X0 + (j - 0.5) * PANEL, y: YB + DEPTH, name: 'U' + j }); }
  } else {
    for (let j = 1; j < PANELS; j++) { U[j] = nodes.length; nodes.push({ x: X0 + j * PANEL, y: YB + DEPTH, name: 'U' + j }); }
  }
  const members = [];
  const add = (a, b, kind) => members.push({ a, b, kind, name: `${nodes[a].name}–${nodes[b].name}` });
  for (let i = 0; i < PANELS; i++) add(i, i + 1, 'bottom');
  if (type === 'warren') {
    for (let j = 1; j < PANELS; j++) add(U[j], U[j + 1], 'top');
    for (let i = 0; i < PANELS; i++) { add(i, U[i + 1], 'diagonal'); add(U[i + 1], i + 1, 'diagonal'); }
  } else {
    for (let j = 1; j < PANELS - 1; j++) add(U[j], U[j + 1], 'top');
    add(0, U[1], 'end');
    add(PANELS, U[PANELS - 1], 'end');
    for (let j = 1; j < PANELS; j++) add(j, U[j], 'vertical');
    const h = PANELS / 2;
    for (let j = 1; j < h; j++) {
      if (type === 'pratt') { add(U[j], j + 1, 'diagonal'); add(U[PANELS - j], PANELS - j - 1, 'diagonal'); }
      else { add(j, U[j + 1], 'diagonal'); add(PANELS - j, U[PANELS - j - 1], 'diagonal'); }
    }
  }
  const N = nodes.length, M = members.length, n = 2 * N;
  if (M + 3 !== n) throw new Error(`truss not determinate: m + r = ${M + 3}, 2j = ${n}`);
  // Equilibrium matrix A (n × n): rows = (x, y) of each joint, columns = member forces (tension +)
  // then the reactions Ax, Ay at L0 (pin) and By at L6 (roller). A·x = −P.
  const A = new Float64Array(n * n);
  for (let m = 0; m < M; m++) {
    const mb = members[m], na = nodes[mb.a], nb = nodes[mb.b];
    const dx = nb.x - na.x, dy = nb.y - na.y, L = Math.hypot(dx, dy);
    mb.ux = dx / L; mb.uy = dy / L; mb.len = L * SCALE;
    A[(2 * mb.a) * n + m] += mb.ux; A[(2 * mb.a + 1) * n + m] += mb.uy;
    A[(2 * mb.b) * n + m] -= mb.ux; A[(2 * mb.b + 1) * n + m] -= mb.uy;
  }
  A[0 * n + M] = 1;                 // Ax at L0
  A[1 * n + M + 1] = 1;             // Ay at L0
  A[(2 * PANELS + 1) * n + M + 2] = 1; // By at L6
  const AT = new Float64Array(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) AT[c * n + r] = A[r * n + c];
  return {
    type, nodes, members, N, M, n, A, AT,
    work: new Float64Array(n * n), rhs: new Float64Array(n), load: new Float64Array(n),
    x: new Float64Array(n), d: new Float64Array(n), perm: new Int32Array(n),
  };
}

/** Solve M·x = b by Gaussian elimination with partial pivoting. M and b are overwritten. */
function gauss(M, b, n, x) {
  for (let c = 0; c < n; c++) {
    let p = c, best = Math.abs(M[c * n + c]);
    for (let r = c + 1; r < n; r++) { const v = Math.abs(M[r * n + c]); if (v > best) { best = v; p = r; } }
    if (best < 1e-12) return false;
    if (p !== c) {
      for (let k = 0; k < n; k++) { const t = M[c * n + k]; M[c * n + k] = M[p * n + k]; M[p * n + k] = t; }
      const t = b[c]; b[c] = b[p]; b[p] = t;
    }
    const piv = M[c * n + c];
    for (let r = c + 1; r < n; r++) {
      const f = M[r * n + c] / piv;
      if (f === 0) continue;
      for (let k = c; k < n; k++) M[r * n + k] -= f * M[c * n + k];
      b[r] -= f * b[c];
    }
  }
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= M[r * n + k] * x[k];
    x[r] = s / M[r * n + r];
  }
  return true;
}

/** Fill the joint loads (kN, per truss) for a truck of `W` kN at scene x `xs`, plus self-weight. */
function fillLoads(T, W, xs, selfWeight) {
  const P = T.load;
  P.fill(0);
  // The truck's weight reaches the trusses through stringers and floor beams: half to each truss,
  // shared between the two nearest bottom joints by the lever rule.
  const u = Math.min(PANELS - 1e-9, Math.max(0, (xs - X0) / PANEL));
  const i = Math.floor(u), t = u - i;
  P[2 * i + 1] -= (W / 2) * (1 - t);
  P[2 * (i + 1) + 1] -= (W / 2) * t;
  if (selfWeight) {
    const panel = PANEL * SCALE;
    for (let k = 0; k <= PANELS; k++) P[2 * k + 1] -= DECK_LOAD * panel * (k === 0 || k === PANELS ? 0.5 : 1);
    for (const mb of T.members) {
      const w = WT[mb.kind] * mb.len / 2;
      P[2 * mb.a + 1] -= w;
      P[2 * mb.b + 1] -= w;
    }
  }
}

/** Member forces + reactions, then joint displacements (real metres). */
function solveTruss(T) {
  const { n, M } = T;
  T.work.set(T.A);
  for (let k = 0; k < n; k++) T.rhs[k] = -T.load[k];
  const ok = gauss(T.work, T.rhs, n, T.x);
  // Compatibility: Aᵀ·d = (−e, 0, 0, 0), e = F·L/(E·A), with the three support displacements fixed.
  T.work.set(T.AT);
  for (let m = 0; m < M; m++) { const mb = T.members[m]; T.rhs[m] = -(T.x[m] * mb.len) / (E_STEEL * AREA[mb.kind]); }
  T.rhs[M] = T.rhs[M + 1] = T.rhs[M + 2] = 0;
  gauss(T.work, T.rhs, n, T.d);
  return ok;
}

// ── textures ────────────────────────────────────────────────────────────────────────────────

function concreteTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#9a978f';
  g.fillRect(0, 0, 256, 256);
  const img = g.getImageData(0, 0, 256, 256), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = (Math.random() - 0.5) * 26;
    d[i] += v; d[i + 1] += v; d[i + 2] += v * 0.9;
  }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(60,58,54,0.35)' : 'rgba(210,206,198,0.3)';
    g.beginPath();
    g.arc(Math.random() * 256, Math.random() * 256, Math.random() * 1.6 + 0.3, 0, Math.PI * 2);
    g.fill();
  }
  // Formwork lines.
  g.strokeStyle = 'rgba(70,68,64,0.35)';
  g.lineWidth = 1.5;
  for (let y = 64; y < 256; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function asphaltTex() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#2b2d31';
  g.fillRect(0, 0, 256, 128);
  const img = g.getImageData(0, 0, 256, 128), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const v = (Math.random() - 0.5) * 30; d[i] += v; d[i + 1] += v; d[i + 2] += v; }
  g.putImageData(img, 0, 0);
  g.fillStyle = '#e9e6dc';
  g.fillRect(0, 10, 256, 4);
  g.fillRect(0, 114, 256, 4);
  g.fillStyle = '#f2c14a';
  g.fillRect(20, 62, 90, 4);
  g.fillRect(148, 62, 90, 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ── geometry helpers ────────────────────────────────────────────────────────────────────────

/** A wide-flange (H) section, unit length along +x from −0.5 to 0.5; depth along y, width along z. */
function hSection(depth, width, tf, tw) {
  const h = depth / 2, w = width / 2, s = new THREE.Shape();
  // Drawn in shape (u, v) = (−z, y): flanges are the two plates at z = ±w (parallel to the truss plane).
  s.moveTo(-w, -h); s.lineTo(-w + tf, -h); s.lineTo(-w + tf, -tw / 2); s.lineTo(w - tf, -tw / 2);
  s.lineTo(w - tf, -h); s.lineTo(w, -h); s.lineTo(w, h); s.lineTo(w - tf, h); s.lineTo(w - tf, tw / 2);
  s.lineTo(-w + tf, tw / 2); s.lineTo(-w + tf, h); s.lineTo(-w, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0018, bevelSegments: 1, curveSegments: 1 });
  g.rotateY(Math.PI / 2);
  g.translate(-0.5, 0, 0);
  g.computeVertexNormals();
  return g;
}

function roundedPlate(w, h, r, t, yOff) {
  const s = new THREE.Shape();
  const x0 = -w / 2, x1 = w / 2, y0 = yOff - h / 2, y1 = yOff + h / 2;
  s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r);
  s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1); s.lineTo(x0 + r, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - r); s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 1, curveSegments: 4 });
  g.translate(0, 0, -t / 2);
  return g;
}

function arrow(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.4, metalness: 0.1 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 16), mat);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 20), mat);
  g.add(shaft, head);
  g.userData = { shaft, head };
  return g;
}
/** Point an arrow (built along +y) to end its tip at `tipY` with length `len`, direction dir = ±1. */
function setArrow(a, len, dir) {
  const { shaft, head } = a.userData;
  const L = Math.max(0.001, len);
  shaft.scale.y = Math.max(0.001, L - 0.12);
  shaft.position.y = -dir * (0.12 + shaft.scale.y / 2);
  head.position.y = -dir * 0.06;
  head.rotation.z = dir > 0 ? 0 : Math.PI;
  a.visible = len > 0.02;
}

// ── lesson ──────────────────────────────────────────────────────────────────────────────────

export default {
  view: { dist: 6.3, yaw: 0.42, pitch: 0.2, target: [0.25, 1.1, 0], minDist: 2.5, maxDist: 16 },
  floor: true,

  explain: `
<p>A <b>truss</b> is a frame made of straight members joined into triangles. A triangle cannot change shape unless one of its sides changes length, so a truss is very stiff for its weight. That is why steel bridges, roofs and cranes are full of triangles.</p>
<p>Engineers model each joint as a <b>pin</b>, so every member is only ever <b>pulled</b> (tension) or <b>pushed</b> (compression) along its length. Nothing in the bridge is accelerating, so at every joint the forces must balance: ΣF<sub>x</sub> = 0 and ΣF<sub>y</sub> = 0. That gives 2 equations per joint. This is the <b>method of joints</b>.</p>
<p>This bridge has a <b>pin</b> support at A (it can't slide) and a <b>roller</b> at B (it can slide, so the bridge can expand on a hot day). That makes 3 unknown reactions. If <i>m</i> + 3 = 2<i>j</i> (members + reactions = 2 × joints), the truss is <b>statically determinate</b>: there are exactly enough equations. The app writes all 2<i>j</i> equations as a matrix and solves them together with Gaussian elimination, the same maths a structural-analysis program uses.</p>
<ul>
<li><b style="color:#5aa0ff">Blue</b> members are in tension, <b style="color:#ff5a4d">red</b> ones in compression; the stronger the colour, the bigger the force. Grey means (almost) zero.</li>
<li>Bridges sag like a bent ruler: the <b>top chord is squeezed</b> and the <b>bottom chord is stretched</b>.</li>
<li>Compare <b>Pratt</b> and <b>Howe</b>: mirror-image diagonals swap tension and compression.</li>
<li>In the Pratt truss, the middle vertical U3–L3 carries nothing unless something presses on joint U3: a <b>zero-force member</b>.</li>
</ul>
<p>The sag uses Hooke's law for steel: each member stretches by e = <i>F</i>·<i>L</i> / (<i>E</i>·<i>A</i>) with <i>E</i> = 200 GPa. Real sag is only a few centimetres, so it is drawn hundreds of times larger. The model is a 1:10 scale of a 36 m span; each of the two trusses carries half the load.</p>`,
  formula: 'At every joint: ΣF<sub>x</sub> = 0, ΣF<sub>y</sub> = 0 &nbsp;·&nbsp; whole bridge: R<sub>A</sub> + R<sub>B</sub> = W, &nbsp;R<sub>B</sub> = W·<i>a</i> / <i>L</i> &nbsp;(<i>a</i> = distance of the load from A)',
  vocab: [
    ['Truss', 'A frame of straight members joined into triangles.'],
    ['Tension', 'A pulling force that stretches a member.'],
    ['Compression', 'A pushing force that squeezes a member. Long members in compression can buckle.'],
    ['Chord', 'The top or bottom edge member of a truss.'],
    ['Gusset plate', 'A steel plate bolted over a joint to connect the members that meet there.'],
    ['Reaction', 'The force a support pushes back with to hold the structure up.'],
    ['Pin / roller support', 'A pin stops movement in every direction but lets the end rotate; a roller only stops movement up and down.'],
    ['Zero-force member', 'A member that carries no force under a particular load, but still braces the truss.'],
    ['Statically determinate', 'A structure whose forces can be found from equilibrium alone (m + r = 2j for a plane truss).'],
  ],
  standards: ['NGSS HS-ETS1-2'],
  quiz: [
    {
      q: 'A 400 kN truck stands exactly in the middle of a simply supported bridge (ignore the bridge\'s own weight). What is the upward reaction at each end?',
      choices: ['400 kN each', '200 kN each', '100 kN each', '800 kN each'],
      answer: 1,
      why: 'The reactions must add up to the load (ΣF<sub>y</sub> = 0), and with the load in the middle, moments make them equal: 400 ÷ 2 = 200 kN each.',
    },
    {
      q: 'When a truss bridge sags under its load, the bottom chord is mostly in…',
      choices: ['compression', 'tension', 'no force at all', 'torsion'],
      answer: 1,
      why: 'Like a bent ruler, the bottom edge of a sagging span gets longer, so the bottom chord is stretched: tension. The top chord is squeezed: compression.',
    },
    {
      q: 'In a Pratt truss carrying a load spread along the deck, the diagonals are mainly in…',
      choices: ['tension', 'compression', 'bending', 'shear only'],
      answer: 0,
      why: 'Pratt diagonals slope down toward the middle, so they are pulled. The verticals are pushed. The Howe truss mirrors the diagonals and swaps these.',
    },
    {
      q: 'Why are compression members usually made thicker or deeper than tension members carrying the same force?',
      choices: ['Steel is weaker when it is pushed', 'Long slender members can buckle sideways when pushed', 'Compression members get hotter', 'To make the bridge heavier'],
      answer: 1,
      why: 'A rope can be pulled but not pushed. A slender strut buckles sideways at a load far below what the steel itself could take, so compression members need a stiffer cross-section.',
    },
    {
      q: 'A plane truss has 12 joints and 3 support reactions. How many members must it have to be statically determinate?',
      choices: ['12', '21', '24', '27'],
      answer: 1,
      why: 'Each joint gives 2 equations: 2 × 12 = 24. The unknowns are the members plus 3 reactions, so m = 24 − 3 = 21. (That is the Pratt and Howe trusses in this lab.)',
    },
  ],

  build(ctx) {
    const { root, ui } = ctx;
    const params = new URLSearchParams(location.search);
    const subject = ctx.color('engineering');
    // Any non-member card clears the member selection (so live refreshes don't overwrite it).
    const otherCard = (title, html, opts) => { state.sel = -1; placeSelection(); ctx.card(title, html, opts); };

    // ── materials ──
    const memberMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.2, roughness: 0.5 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x7c848f, metalness: 0.6, roughness: 0.45 });
    const gussetMat = new THREE.MeshStandardMaterial({ color: 0x8f969f, metalness: 0.55, roughness: 0.38 });
    const boltMat = new THREE.MeshStandardMaterial({ color: 0xc3c8cf, metalness: 0.95, roughness: 0.3 });
    const darkSteel = new THREE.MeshStandardMaterial({ color: 0x3d434b, metalness: 0.8, roughness: 0.35 });
    const ctex = concreteTex();
    const concrete = new THREE.MeshStandardMaterial({ map: ctex, roughness: 0.92, metalness: 0 });
    const deckMat = new THREE.MeshStandardMaterial({ map: asphaltTex(), roughness: 0.85, metalness: 0 });
    const water = new THREE.MeshPhysicalMaterial({ color: 0x0b2a40, roughness: 0.12, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.88 });

    // ── static scenery: abutments, bearings, river ──
    for (const s of [-1, 1]) {
      const ab = new THREE.Mesh(new RoundedBoxGeometry(0.75, 0.85, 1.3, 3, 0.025), concrete);
      ab.position.set(s * 1.975, 0.425, 0);
      const back = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.23, 1.3, 3, 0.015), concrete);
      back.position.set(s * 2.15, DECK_TOP - 0.115, 0);
      const road = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.012, 0.82), deckMat);
      road.position.set(s * 2.15, DECK_TOP - 0.006 + 0.001, 0);
      const footing = new THREE.Mesh(new RoundedBoxGeometry(0.95, 0.12, 1.5, 2, 0.02), concrete);
      footing.position.set(s * 1.975, 0.06, 0);
      for (const m of [ab, back, footing]) { m.castShadow = m.receiveShadow = true; root.add(m); }
      road.receiveShadow = true;
      root.add(road);
      ctx.pickable(ab, () => otherCard('Abutment', '<p>A reinforced-concrete <b>abutment</b> at each end holds the bridge up and keeps back the earth of the approach road. The truss sits on steel <b>bearings</b> on top of it. All the bridge\'s weight and traffic finally flow down through the bearings into the abutments and the ground.</p>', { kind: 'Substructure' }));
    }

    // Bearings: a pin at A (x = X0), a roller nest at B (x = X0 + SPAN), under each truss.
    const bearings = new THREE.Group();
    root.add(bearings);
    const plateG = new RoundedBoxGeometry(0.17, 0.022, 0.16, 2, 0.006);
    const pinG = new THREE.CylinderGeometry(0.024, 0.024, 0.15, 24);
    const rockerG = new THREE.CylinderGeometry(0.035, 0.06, 0.05, 4, 1);
    const rollerG = new THREE.CylinderGeometry(0.014, 0.014, 0.15, 20);
    const pinGroup = new THREE.Group(), rollerGroup = new THREE.Group();
    bearings.add(pinGroup, rollerGroup);
    for (const z of [-ZT, ZT]) {
      const add = (grp, geo, mat, x, y, rx = 0, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.castShadow = true; grp.add(m); return m; };
      // Pin bearing.
      add(pinGroup, plateG, darkSteel, X0, 0.861);
      add(pinGroup, rockerG, darkSteel, X0, 0.897, 0, Math.PI / 4);
      add(pinGroup, pinG, boltMat, X0, 0.93, Math.PI / 2);
      add(pinGroup, plateG, darkSteel, X0, 0.952);
      // Roller bearing.
      const xr = X0 + SPAN;
      add(rollerGroup, plateG, darkSteel, xr, 0.861);
      for (const dx of [-0.045, 0, 0.045]) add(rollerGroup, rollerG, boltMat, xr + dx, 0.886, Math.PI / 2);
      add(rollerGroup, plateG, darkSteel, xr, 0.911);
      add(rollerGroup, new RoundedBoxGeometry(0.12, 0.04, 0.14, 2, 0.008), darkSteel, xr, 0.94);
    }
    ctx.pickable(pinGroup, () => otherCard('A · pin bearing', `<p>A <b>pin</b> lets the end of the bridge rotate a little but stops it moving up, down or sideways. It can push back with a vertical force <b>and</b> a horizontal force: 2 unknown reactions.</p><p>Right now: R<sub>A</sub> = <b>${fmtK(state.RA)}</b> up (whole bridge), horizontal ${fmtK(Math.abs(state.HA))}.</p>`, { kind: 'Support' }));
    ctx.pickable(rollerGroup, () => otherCard('B · roller bearing', `<p>A <b>roller</b> can only push straight up. It lets the bridge grow and shrink with temperature (steel expands about 1.2 mm per 10 m for every 10 °C) without pushing the abutments apart. 1 unknown reaction.</p><p>Right now: R<sub>B</sub> = <b>${fmtK(state.RB)}</b> up (whole bridge).</p>`, { kind: 'Support' }));

    const river = new THREE.Mesh(new THREE.PlaneGeometry(SPAN - 0.12, 1.9), water);
    river.rotation.x = -Math.PI / 2;
    river.position.y = 0.035;
    river.receiveShadow = true;
    root.add(river);
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(SPAN - 0.1, 1.95), new THREE.MeshStandardMaterial({ color: 0x2c3528, roughness: 1 }));
    bed.rotation.x = -Math.PI / 2;
    bed.position.y = 0.012;
    root.add(bed);

    // ── instanced steelwork ──
    const MAXM = 26, MAXN = 13;
    const chordGeo = hSection(0.075, 0.075, 0.012, 0.009);
    const members = new THREE.InstancedMesh(chordGeo, memberMat, MAXM * 2);
    members.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXM * 2 * 3), 3);
    members.castShadow = true; members.receiveShadow = true;
    members.frustumCulled = false;
    root.add(members);

    const gussetGeo = roundedPlate(0.2, 0.16, 0.03, 0.006, 0.035);
    const gussets = new THREE.InstancedMesh(gussetGeo, gussetMat, MAXN * 4);
    gussets.castShadow = true; gussets.frustumCulled = false;
    root.add(gussets);

    const boltGeo = new THREE.CylinderGeometry(0.0085, 0.0085, 0.007, 6);
    boltGeo.rotateX(Math.PI / 2);
    const BOLT_PATTERN = [];
    for (const by of [0.012, 0.062]) for (const bx of [-0.07, -0.025, 0.025, 0.07]) BOLT_PATTERN.push([bx, by]);
    const bolts = new THREE.InstancedMesh(boltGeo, boltMat, MAXN * 4 * BOLT_PATTERN.length);
    bolts.frustumCulled = false;
    root.add(bolts);

    const braceGeo = hSection(0.04, 0.035, 0.007, 0.006);
    const braces = new THREE.InstancedMesh(braceGeo, steelMat, 48);
    braces.castShadow = true; braces.frustumCulled = false;
    root.add(braces);

    const floorGeo = hSection(0.06, 0.05, 0.008, 0.007);
    const floorBeams = new THREE.InstancedMesh(floorGeo, steelMat, PANELS + 1);
    floorBeams.castShadow = true; floorBeams.frustumCulled = false;
    root.add(floorBeams);

    const deckGeo = new THREE.BoxGeometry(1, 0.035, 0.82);
    const deck = new THREE.InstancedMesh(deckGeo, deckMat, PANELS);
    deck.castShadow = true; deck.receiveShadow = true; deck.frustumCulled = false;
    root.add(deck);
    const kerbGeo = new THREE.BoxGeometry(1, 0.03, 0.03);
    const kerbs = new THREE.InstancedMesh(kerbGeo, concrete, PANELS * 2);
    kerbs.castShadow = true; kerbs.frustumCulled = false;
    root.add(kerbs);

    // Selected-member highlight.
    const selMat = new THREE.MeshBasicMaterial({ color: subject, transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false });
    const selMeshes = [new THREE.Mesh(chordGeo, selMat), new THREE.Mesh(chordGeo, selMat)];
    for (const s of selMeshes) { s.matrixAutoUpdate = false; s.visible = false; s.renderOrder = 5; root.add(s); }

    // ── truck ──
    const truck = new THREE.Group();
    root.add(truck);
    const paint = new THREE.MeshPhysicalMaterial({ color: subject, metalness: 0.3, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.15 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0x0b1420, metalness: 0.2, roughness: 0.05, clearcoat: 1 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xe6e9ee, metalness: 1, roughness: 0.18 });
    const tyre = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.85 });
    const chassisMat = new THREE.MeshStandardMaterial({ color: 0x24282e, metalness: 0.5, roughness: 0.5 });
    const tMesh = (geo, mat, x, y, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; truck.add(m); return m; };
    tMesh(new RoundedBoxGeometry(0.2, 0.17, 0.25, 3, 0.03), paint, 0.36, 0.165);
    tMesh(new RoundedBoxGeometry(0.06, 0.08, 0.24, 2, 0.015), paint, 0.475, 0.12);       // nose
    tMesh(new RoundedBoxGeometry(0.012, 0.075, 0.22, 2, 0.004), glass, 0.461, 0.195);   // windscreen
    for (const z of [-0.126, 0.126]) tMesh(new THREE.BoxGeometry(0.09, 0.06, 0.004), glass, 0.39, 0.2, z);
    tMesh(new THREE.BoxGeometry(0.02, 0.035, 0.22), chrome, 0.506, 0.1);               // grille
    tMesh(new THREE.BoxGeometry(0.9, 0.03, 0.14), chassisMat, 0.0, 0.07);              // chassis
    tMesh(new RoundedBoxGeometry(0.66, 0.025, 0.25, 2, 0.006), chassisMat, -0.13, 0.098); // flatbed
    const cargo = tMesh(new RoundedBoxGeometry(0.6, 1, 0.22, 2, 0.012), concrete, -0.13, 0.11);
    const wheelG = new THREE.CylinderGeometry(0.045, 0.045, 0.035, 28);
    wheelG.rotateX(Math.PI / 2);
    const hubG = new THREE.CylinderGeometry(0.022, 0.022, 0.037, 16);
    hubG.rotateX(Math.PI / 2);
    const wheels = [];
    for (const x of [0.36, -0.2, -0.3]) for (const z of [-0.11, 0.11]) {
      const w = new THREE.Group();
      w.position.set(x, 0.045, z);
      const t = new THREE.Mesh(wheelG, tyre); t.castShadow = true;
      w.add(t, new THREE.Mesh(hubG, chrome));
      truck.add(w);
      wheels.push(w);
    }
    const loadArrow = arrow(0xffb347);
    truck.add(loadArrow);
    let truckLabel = ctx.label('400 kN', { color: '#ffd28a', size: 0.8 });
    truck.add(truckLabel);
    ctx.pickable(truck, () => otherCard('The load', `<p>A loaded truck weighing <b>${fmtK(state.W)}</b> (about ${Math.round(state.W / 9.81)} tonnes). Its weight goes into the deck, then the floor beams, then the bottom joints of the two trusses: half to each truss, shared between the two nearest joints.</p><p>Move it with the <b>Load position</b> slider, or turn on <b>Drive across</b>.</p>`, { kind: 'Load' }));

    // Reaction arrows below the bearings, outside the front truss.
    const raA = arrow(0x4fd1a5), raB = arrow(0x4fd1a5);
    raA.position.set(X0, 0.84, ZT + 0.32);
    raB.position.set(X0 + SPAN, 0.84, ZT + 0.32);
    root.add(raA, raB);
    let labA = ctx.label('A', { color: '#7fe8c2', size: 0.75 });
    let labB = ctx.label('B', { color: '#7fe8c2', size: 0.75 });
    labA.position.set(X0 - 0.05, 0.12, ZT + 0.32);
    labB.position.set(X0 + SPAN + 0.05, 0.12, ZT + 0.32);
    root.add(labA, labB);

    // ── state ──
    const state = {
      type: ['pratt', 'howe', 'warren'].includes(params.get('truss')) ? params.get('truss') : 'pratt',
      pos: params.has('pos') ? Math.min(1, Math.max(0, +params.get('pos'))) : 0.5,
      W: params.has('load') ? Math.min(800, Math.max(0, +params.get('load'))) : 400,
      sw: params.get('sw') === '1',
      defl: params.get('defl') === '1',
      exag: 100,
      forces: params.get('forces') === '1',
      drive: params.get('drive') === '1',
      driveDir: 1,
      RA: 0, RB: 0, HA: 0,
      sel: -1,
      dirty: true, layout: true,
    };
    let T = makeTruss(state.type);
    const disp = new Float64Array(2 * MAXN);       // displayed displacement (scene units), eased
    const forceLabels = [];
    const labelText = [];
    let labelClock = 0, cardClock = 0;

    const cTension = new THREE.Color('#1560ff'), cComp = new THREE.Color('#f01e10'), cZero = new THREE.Color('#9aa3ad'), cTmp = new THREE.Color();
    const fmtK = (v) => `${Math.round(v).toLocaleString('en-US')} kN`;

    // ── controls ──
    ui.choice('Truss type', {
      options: [{ value: 'pratt', label: 'Pratt' }, { value: 'howe', label: 'Howe' }, { value: 'warren', label: 'Warren' }],
      value: state.type,
      onChange: (v) => { state.type = v; T = makeTruss(v); state.sel = -1; ctx.hideCard(); state.layout = state.dirty = true; typeNote.set(TYPES[v].blurb); rebuildForceLabels(); },
    });
    const typeNote = ui.note(TYPES[state.type].blurb);
    ui.heading('Load');
    const posSlider = ui.slider('Load position', { min: 0, max: 1, step: 0.005, value: state.pos, fmt: (v) => `${(v * SPAN * SCALE).toFixed(1)} m from A`, onChange: (v) => { state.pos = v; state.dirty = true; } });
    ui.slider('Truck weight', { min: 0, max: 800, step: 10, value: state.W, fmt: (v) => `${v} kN (${Math.round(v / 9.81)} t)`, onChange: (v) => { state.W = v; state.dirty = true; } });
    ui.toggle('Drive across', { value: state.drive, onChange: (v) => (state.drive = v) });
    ui.toggle('Include self-weight (deck + steel)', { value: state.sw, onChange: (v) => { state.sw = v; state.dirty = true; } });
    ui.heading('Display');
    ui.toggle('Show force values', { value: state.forces, onChange: (v) => { state.forces = v; rebuildForceLabels(); } });
    ui.toggle('Exaggerated deflection', { value: state.defl, onChange: (v) => { state.defl = v; state.dirty = true; } });
    ui.slider('Exaggeration', { min: 10, max: 600, step: 10, value: state.exag, fmt: (v) => `× ${v}`, onChange: (v) => { state.exag = v; state.dirty = true; } });
    ui.heading('Results');
    const rA = ui.readout('Support A (pin)');
    const rB = ui.readout('Support B (roller)');
    const rSum = ui.readout('Total load = R<sub>A</sub> + R<sub>B</sub>');
    const rT = ui.readout('Max tension');
    const rC = ui.readout('Max compression');
    const rD = ui.readout('Mid-span sag (real)');
    ui.note('<span style="color:#5aa0ff">■</span> tension &nbsp; <span style="color:#ff5a4d">■</span> compression &nbsp; <span style="color:#9aa3ad">■</span> ≈ 0. Member forces are for one truss (each carries half). Click a member for details.');

    // ── force labels ──
    function rebuildForceLabels() {
      for (const l of forceLabels) l.visible = false;
      if (!state.forces) return;
      while (forceLabels.length < T.M) {
        const l = ctx.label('0', { color: '#ffffff', size: 0.55 });
        root.add(l);
        forceLabels.push(l);
        labelText.push('');
      }
      for (let m = 0; m < T.M; m++) { forceLabels[m].visible = true; labelText[m] = ''; }
      labelClock = 1;
    }
    function refreshForceLabels() {
      if (!state.forces) return;
      for (let m = 0; m < T.M; m++) {
        const F = T.x[m];
        const txt = Math.abs(F) < 0.5 ? '0' : (F > 0 ? '+' : '−') + Math.round(Math.abs(F));
        if (txt !== labelText[m]) {
          forceLabels[m] = ctx.relabel(forceLabels[m], txt, { color: Math.abs(F) < 0.5 ? '#c9d0d8' : F > 0 ? '#8cc0ff' : '#ff8f86', size: 0.55 });
          labelText[m] = txt;
        }
      }
    }

    // ── picking ──
    ctx.pickable(members, (hit) => {
      if (hit.instanceId == null) return;
      state.sel = Math.floor(hit.instanceId / 2);
      showMemberCard();
      placeSelection();
    });
    function showMemberCard() {
      const m = state.sel;
      if (m < 0 || m >= T.M) return;
      const mb = T.members[m], F = T.x[m], A = AREA[mb.kind];
      const kind = Math.abs(F) < 0.5 ? 'carries almost no force' : F > 0 ? 'is in <b style="color:#5aa0ff">tension</b> (pulled)' : 'is in <b style="color:#ff5a4d">compression</b> (pushed)';
      const sigma = Math.abs(F) / A / 1000; // MPa
      const strain = (F / (E_STEEL * A)) * mb.len * 1000; // mm
      ctx.card(`${KIND_NAME[mb.kind]} ${mb.name}`,
        `<p>This member ${kind}: <b>${Math.abs(F) < 0.5 ? '0 kN' : fmtK(Math.abs(F))}</b> in each truss.</p>` +
        `<p>Length ${mb.len.toFixed(2)} m · area ${(A * 1e4).toFixed(0)} cm² · stress σ = F/A = ${sigma.toFixed(0)} MPa · it ${F >= 0 ? 'stretches' : 'shortens'} by ${Math.abs(strain).toFixed(2)} mm.</p>` +
        `<p>${KIND_INFO[mb.kind]}</p>`, { kind: TYPES[state.type].name + ' truss member' });
    }

    // ── per-frame transform updates ──
    const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _dir = new THREE.Vector3(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
    const _q = new THREE.Quaternion(), _qr = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    const _m = new THREE.Matrix4();
    const X = new THREE.Vector3(1, 0, 0);
    const qPi = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
    const qId = new THREE.Quaternion();

    function bar(out, a, b, sy, sz, roll = false, extra = 0) {
      _dir.subVectors(b, a);
      const len = _dir.length();
      _dir.divideScalar(len);
      _q.setFromUnitVectors(X, _dir);
      if (roll) _q.multiply(_qr);
      _p.addVectors(a, b).multiplyScalar(0.5);
      _s.set(len + extra, sy, sz);
      return out.compose(_p, _q, _s);
    }
    const nx = (i) => T.nodes[i].x + disp[2 * i];
    const ny = (i) => T.nodes[i].y + disp[2 * i + 1];

    function placeSelection() {
      const m = state.sel;
      for (let t = 0; t < 2; t++) {
        const s = selMeshes[t];
        s.visible = m >= 0 && m < T.M;
        if (!s.visible) continue;
        const mb = T.members[m], z = t ? ZT : -ZT;
        const web = mb.kind === 'vertical' || mb.kind === 'diagonal';
        _a.set(nx(mb.a), ny(mb.a), z); _b.set(nx(mb.b), ny(mb.b), z);
        bar(s.matrix, _a, _b, (web ? 0.72 : 1) * 1.35, 1.3, false, -0.1);
        s.matrixWorldNeedsUpdate = true;
      }
    }

    function layout() {
      // Truss members (front and back truss).
      for (let m = 0; m < T.M; m++) {
        const mb = T.members[m];
        const web = mb.kind === 'vertical' || mb.kind === 'diagonal';
        for (let t = 0; t < 2; t++) {
          const z = t ? ZT : -ZT;
          _a.set(nx(mb.a), ny(mb.a), z); _b.set(nx(mb.b), ny(mb.b), z);
          members.setMatrixAt(m * 2 + t, bar(_m, _a, _b, web ? 0.72 : 1, 1, false, web ? -0.06 : 0));
        }
      }
      members.count = T.M * 2;
      members.instanceMatrix.needsUpdate = true;
      members.boundingSphere = null;

      // Gussets + bolts: two plates per joint per truss, sandwiching the members.
      let g = 0, bi = 0;
      for (let i = 0; i < T.N; i++) {
        const top = !T.nodes[i].bottom;
        const q = top ? qPi : qId;
        for (let t = 0; t < 2; t++) for (const side of [-1, 1]) {
          const zc = (t ? ZT : -ZT) + side * 0.0415;
          _p.set(nx(i), ny(i), zc);
          _s.set(1, 1, 1);
          gussets.setMatrixAt(g++, _m.compose(_p, q, _s));
          for (const [bx, by] of BOLT_PATTERN) {
            _a.set(nx(i) + bx, ny(i) + (top ? -by : by), zc + side * 0.0055);
            bolts.setMatrixAt(bi++, _m.compose(_a, qId, _s));
          }
        }
      }
      gussets.count = g; bolts.count = bi;
      gussets.instanceMatrix.needsUpdate = bolts.instanceMatrix.needsUpdate = true;

      // Floor beams, deck slabs, kerbs.
      for (let i = 0; i <= PANELS; i++) {
        _a.set(nx(i), ny(i) - 0.002, -ZT + 0.03); _b.set(nx(i), ny(i) - 0.002, ZT - 0.03);
        floorBeams.setMatrixAt(i, bar(_m, _a, _b, 1, 1, true));
      }
      floorBeams.instanceMatrix.needsUpdate = true;
      for (let i = 0; i < PANELS; i++) {
        _a.set(nx(i), ny(i) + 0.0475, 0); _b.set(nx(i + 1), ny(i + 1) + 0.0475, 0);
        deck.setMatrixAt(i, bar(_m, _a, _b, 1, 1, false, 0.004));
        for (let k = 0; k < 2; k++) {
          const z = k ? 0.385 : -0.385;
          _a.set(nx(i), ny(i) + 0.08, z); _b.set(nx(i + 1), ny(i + 1) + 0.08, z);
          kerbs.setMatrixAt(i * 2 + k, bar(_m, _a, _b, 1, 1, false, 0.003));
        }
      }
      deck.instanceMatrix.needsUpdate = kerbs.instanceMatrix.needsUpdate = true;

      // Lateral bracing: struts across the top joints, X-bracing in the top and bottom panels.
      let k = 0;
      const tops = [];
      for (let i = 0; i < T.N; i++) if (!T.nodes[i].bottom) tops.push(i);
      for (const i of tops) {
        _a.set(nx(i), ny(i) - 0.005, -ZT + 0.04); _b.set(nx(i), ny(i) - 0.005, ZT - 0.04);
        braces.setMatrixAt(k++, bar(_m, _a, _b, 1, 1, true));
      }
      for (let j = 0; j + 1 < tops.length; j++) {
        const i0 = tops[j], i1 = tops[j + 1];
        _a.set(nx(i0), ny(i0) + 0.02, -ZT + 0.04); _b.set(nx(i1), ny(i1) + 0.02, ZT - 0.04);
        braces.setMatrixAt(k++, bar(_m, _a, _b, 0.6, 0.8, true));
        _a.set(nx(i0), ny(i0) + 0.02, ZT - 0.04); _b.set(nx(i1), ny(i1) + 0.02, -ZT + 0.04);
        braces.setMatrixAt(k++, bar(_m, _a, _b, 0.6, 0.8, true));
      }
      for (let i = 0; i < PANELS; i++) {
        _a.set(nx(i), ny(i) - 0.035, -ZT + 0.04); _b.set(nx(i + 1), ny(i + 1) - 0.035, ZT - 0.04);
        braces.setMatrixAt(k++, bar(_m, _a, _b, 0.6, 0.8, true));
        _a.set(nx(i), ny(i) - 0.035, ZT - 0.04); _b.set(nx(i + 1), ny(i + 1) - 0.035, -ZT + 0.04);
        braces.setMatrixAt(k++, bar(_m, _a, _b, 0.6, 0.8, true));
      }
      braces.count = k;
      braces.instanceMatrix.needsUpdate = true;

      // Force labels sit on the front truss, just in front of each member.
      if (state.forces) for (let m = 0; m < T.M; m++) {
        const mb = T.members[m];
        forceLabels[m].position.set((nx(mb.a) + nx(mb.b)) / 2, (ny(mb.a) + ny(mb.b)) / 2 - 0.02, ZT + 0.09);
      }
      placeSelection();
      placeTruck();
    }

    function placeTruck() {
      const xs = X0 + state.pos * SPAN;
      const u = Math.min(PANELS - 1e-9, Math.max(0, (xs - X0) / PANEL));
      const i = Math.floor(u), t = u - i;
      const y0 = disp[2 * i + 1], y1 = disp[2 * (i + 1) + 1];
      truck.position.set(xs, DECK_TOP + y0 + (y1 - y0) * t, 0);
      truck.rotation.z = Math.atan2(y1 - y0, PANEL);
      const h = 0.02 + (state.W / 800) * 0.16;
      cargo.scale.y = Math.max(0.001, h);
      cargo.position.y = 0.11 + h / 2;
      cargo.visible = state.W > 0;
      // The load arrow points down at the truck's centre (where its weight acts in this model).
      const len = 0.15 + (state.W / 800) * 0.25;
      loadArrow.position.set(0, 0.11 + h + 0.02, 0);
      setArrow(loadArrow, state.W > 0 ? len : 0, -1);
      truckLabel.position.set(0, loadArrow.position.y + len + 0.02, 0);
    }

    // ── solve + colour ──
    const target = new Float64Array(2 * MAXN);
    let maxT = 0, maxC = 0, iT = -1, iC = -1;
    function solveAndColour() {
      fillLoads(T, state.W, X0 + state.pos * SPAN, state.sw);
      if (!solveTruss(T)) { console.warn('[bridge] singular truss'); return; }
      const { M } = T;
      state.HA = 2 * T.x[M]; state.RA = 2 * T.x[M + 1]; state.RB = 2 * T.x[M + 2];
      let fmax = 1e-9; maxT = 0; maxC = 0; iT = -1; iC = -1;
      for (let m = 0; m < M; m++) {
        const F = T.x[m];
        fmax = Math.max(fmax, Math.abs(F));
        if (F > maxT) { maxT = F; iT = m; }
        if (-F > maxC) { maxC = -F; iC = m; }
      }
      for (let m = 0; m < M; m++) {
        const F = T.x[m], k = Math.abs(F) < 0.5 ? 0 : Math.abs(F) / fmax;
        cTmp.copy(cZero).lerp(F >= 0 ? cTension : cComp, 0.15 + 0.85 * k);
        if (k === 0) cTmp.copy(cZero);
        members.setColorAt(m * 2, cTmp);
        members.setColorAt(m * 2 + 1, cTmp);
      }
      members.instanceColor.needsUpdate = true;
      const kd = state.defl ? (state.exag / SCALE) : 0;
      target.fill(0);
      for (let k = 0; k < T.n; k++) target[k] = T.d[k] * kd;

      // Readouts. Reactions are for the whole bridge (both trusses).
      let total = 0;
      for (let k = 1; k < T.n; k += 2) total -= T.load[k];
      total *= 2;
      rA.set(`${fmtK(state.RA)} ↑`);
      rB.set(`${fmtK(state.RB)} ↑`);
      rSum.set(`${fmtK(total)} ${Math.abs(state.RA + state.RB - total) < 0.01 ? '<span style="color:#4fd1a5">✓ balanced</span>' : '✗'}`);
      rT.set(iT >= 0 ? `<span style="color:#8cc0ff">${T.members[iT].name}: ${fmtK(maxT)}</span>` : '—');
      rC.set(iC >= 0 ? `<span style="color:#ff8f86">${T.members[iC].name}: ${fmtK(maxC)}</span>` : '—');
      rD.set(`${(-T.d[2 * (PANELS / 2) + 1] * 1000).toFixed(1)} mm`);
      const lenA = Math.min(0.72, Math.max(0, state.RA) * 0.0007), lenB = Math.min(0.72, Math.max(0, state.RB) * 0.0007);
      setArrow(raA, lenA, 1);
      setArrow(raB, lenB, 1);
      labA.position.y = Math.max(0.1, 0.84 - lenA - 0.07);
      labB.position.y = Math.max(0.1, 0.84 - lenB - 0.07);
    }

    function updateLabelsText() {
      const t = `${Math.round(state.W)} kN`;
      if (truckLabel.userData.txt !== t) { truckLabel = ctx.relabel(truckLabel, t, { color: '#ffd28a', size: 0.8 }); truckLabel.userData.txt = t; }
      const ta = `A ${Math.round(state.RA)} kN`, tb = `B ${Math.round(state.RB)} kN`;
      if (labA.userData.txt !== ta) { labA = ctx.relabel(labA, ta, { color: '#7fe8c2', size: 0.75 }); labA.userData.txt = ta; }
      if (labB.userData.txt !== tb) { labB = ctx.relabel(labB, tb, { color: '#7fe8c2', size: 0.75 }); labB.userData.txt = tb; }
      refreshForceLabels();
    }

    // ── self-test (?selftest): hand-checkable cases logged to the console ──
    if (params.has('selftest')) {
      const report = [];
      for (const type of ['pratt', 'howe', 'warren']) {
        const S = makeTruss(type);
        fillLoads(S, 400, 0, false);       // 400 kN truck at mid-span: 200 kN per truss at L3
        solveTruss(S);
        const f = (a, b) => { const m = S.members.find((mm) => mm.name === `${a}–${b}` || mm.name === `${b}–${a}`); return m ? S.x[S.members.indexOf(m)] : NaN; };
        // Hand calc: R = 100 kN per truss each side; bottom chord at mid-span = M/h = 100·18/7.2 = 250 kN (Pratt/Howe).
        report.push(`${type}: RA=${S.x[S.M + 1].toFixed(3)} RB=${S.x[S.M + 2].toFixed(3)} HA=${S.x[S.M].toFixed(3)} L2–L3=${f('L2', 'L3').toFixed(3)} U2–U3=${f('U2', 'U3').toFixed(3)} U3–L3=${f('L3', 'U3').toFixed(3)} sag=${(-S.d[7] * 1000).toFixed(2)}mm`);
        fillLoads(S, 400, X0 + SPAN / 6, false); // load at L1: RA = 200·5/6, RB = 200/6
        solveTruss(S);
        report.push(`${type} @L1: RA=${S.x[S.M + 1].toFixed(3)} (expect 166.667) RB=${S.x[S.M + 2].toFixed(3)} (expect 33.333)`);
      }
      console.info('[bridge selftest] ' + report.join(' | '));
    }

    rebuildForceLabels();
    if (params.has('camdist')) ctx.view({ dist: +params.get('camdist'), yaw: +(params.get('camyaw') ?? 0.42), pitch: +(params.get('campitch') ?? 0.2), target: [+(params.get('camx') ?? 0.25), +(params.get('camy') ?? 1.1), 0] });
    if (params.has('pick')) { state.sel = Math.min(T.M - 1, +params.get('pick') || 0); }
    state.dirty = false;
    solveAndColour();
    disp.set(target);
    layout();
    updateLabelsText();
    if (state.sel >= 0) showMemberCard();

    return {
      update(dt) {
        if (state.drive) {
          state.pos += state.driveDir * dt * 0.09;
          if (state.pos > 1) { state.pos = 1; state.driveDir = -1; }
          if (state.pos < 0) { state.pos = 0; state.driveDir = 1; }
          posSlider.set(state.pos);
          state.dirty = true;
          const spin = (state.driveDir * dt * 0.09 * SPAN) / 0.045;
          for (const w of wheels) w.rotation.z -= spin;
        }
        if (state.dirty) {
          state.dirty = false;
          solveAndColour();
          state.layout = true;
          if (state.sel >= 0) cardClock += 1;
        }
        // Ease the drawn shape toward the solved deflection.
        let moving = false;
        const k = 1 - Math.exp(-6 * dt);
        for (let i = 0; i < 2 * T.N; i++) {
          const dlt = target[i] - disp[i];
          if (Math.abs(dlt) > 1e-6) { disp[i] += dlt * k; moving = true; } else disp[i] = target[i];
        }
        if (moving || state.layout) { state.layout = false; layout(); }
        labelClock += dt;
        if (labelClock > 0.25) { labelClock = 0; updateLabelsText(); if (cardClock && state.sel >= 0 && !document.getElementById('card').hidden) showMemberCard(); cardClock = 0; }
      },
      onKey(e) {
        if (e.key === 'ArrowRight') { state.pos = Math.min(1, state.pos + 1 / 12); posSlider.set(state.pos); state.dirty = true; }
        if (e.key === 'ArrowLeft') { state.pos = Math.max(0, state.pos - 1 / 12); posSlider.set(state.pos); state.dirty = true; }
      },
      dispose() {},
    };
  },
};
