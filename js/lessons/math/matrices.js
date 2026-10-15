// Matrices as Transformations: a 3×3 matrix A moves every point of space, v → A·v. A glowing lattice
// (the transformed grid) bends over a faint fixed reference grid; the basis vectors i, j, k are thick
// arrows that land on the columns of A; the unit cube they span becomes a glossy parallelepiped whose
// volume is |det A| (it turns orange when det < 0: orientation flipped). Real eigenvectors are drawn
// as long gold lines that stay on their own span. A compose mode applies A, then B, and shows B·A.
//
// The whole transformed space is one Group whose matrix is (math → world) · A, so moving the grid,
// the cube and the sculpture costs nothing per frame. three.js uses the inverse-transpose for normals
// and flips the face winding when det < 0, so shading stays right for any invertible matrix; a
// singular matrix gets a tiny +εI nudge for drawing only (its normal matrix would be undefined).
//
// Math axes: x → world +x, y → world −z, z → world +y (right-handed both ways), origin at (0, OY, 0).

const U = 0.6;      // world units per math unit
const OY = 1.9;     // world height of the math origin
const HB = 1.75;    // half-size (world) of the clipping box the transformed space is seen through
const LAT = 2;      // lattice lines at integer coordinates −LAT..LAT
const EXT = 3;      // lattice lines run from −EXT to EXT
const DUR = 2.4;    // seconds for one animation (compose: ×1.8)

const COL = { i: '#ff5a6e', j: '#5ee38a', k: '#5aa8ff', math: '#c38bff', flip: '#ff9a4d', eig: '#ffd166', v: '#7fe3ff' };
const COLS = [COL.i, COL.j, COL.k];
const SUB = ['₁', '₂', '₃'];

// Number formatting with a real minus sign.
const fmt = (v, d = 2) => {
  const s = (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toFixed(d);
  return s.startsWith('-') ? '−' + s.slice(1) : s;
};

// ── 3×3 helpers (row-major Float64Array(9); allocation-free) ─────────────────────────────────
const det3 = (m) => m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
function mul3(a, b, o) { // o = a·b (o must not alias a or b)
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  return o;
}
function setM(o, a, b, c, d, e, f, g, h, i) { o[0] = a; o[1] = b; o[2] = c; o[3] = d; o[4] = e; o[5] = f; o[6] = g; o[7] = h; o[8] = i; return o; }
const setDiag = (o, a, b, c) => setM(o, a, 0, 0, 0, b, 0, 0, 0, c);
const rotZ = (o, th) => { const c = Math.cos(th), s = Math.sin(th); return setM(o, c, -s, 0, s, c, 0, 0, 0, 1); };
const maxAbs = (m) => { let s = 0; for (let q = 0; q < 9; q++) s = Math.max(s, Math.abs(m[q])); return s; };
const sameM = (a, b, tol = 1e-9) => { for (let q = 0; q < 9; q++) if (Math.abs(a[q] - b[q]) > tol) return false; return true; };

/** Eigenvalues of a real 3×3 from its characteristic polynomial λ³ − tr·λ² + c₂·λ − det = 0
 *  (Cardano / trigonometric form, then Newton polishing). Fills E.re (real roots, descending),
 *  E.nReal, and E.cRe ± i·E.cIm for a complex pair. */
function eig3(m, E) {
  const tr = m[0] + m[4] + m[8];
  const c2 = m[0] * m[4] - m[1] * m[3] + m[0] * m[8] - m[2] * m[6] + m[4] * m[8] - m[5] * m[7];
  const d = det3(m);
  const a = -tr, b = c2, c = -d;                 // λ³ + aλ² + bλ + c
  const p = b - (a * a) / 3, q = (2 * a * a * a) / 27 - (a * b) / 3 + c, sh = -a / 3; // λ = t + sh, t³ + pt + q = 0
  const sc = Math.max(Math.abs(p) / 3, Math.cbrt(Math.abs(q) / 2) ** 2);
  const disc = (q / 2) ** 2 + (p / 3) ** 3;
  E.cRe = 0; E.cIm = 0;
  if (sc < 1e-12 * (1 + tr * tr)) {               // triple root
    E.re[0] = E.re[1] = E.re[2] = sh; E.nReal = 3;
    return E;
  }
  if (disc > 1e-10 * sc * sc * sc) {              // one real root + a complex pair
    const sd = Math.sqrt(disc), u = Math.cbrt(-q / 2 + sd), v = Math.cbrt(-q / 2 - sd);
    E.re[0] = u + v + sh; E.nReal = 1;
    E.cRe = -(u + v) / 2 + sh; E.cIm = (Math.sqrt(3) / 2) * Math.abs(u - v);
  } else if (p >= 0) {                            // p ≈ q ≈ 0 within tolerance: triple root
    E.re[0] = E.re[1] = E.re[2] = sh; E.nReal = 3;
    return E;
  } else {                                        // three real roots (some may coincide)
    const r = 2 * Math.sqrt(-p / 3);
    const arg = Math.max(-1, Math.min(1, ((3 * q) / (2 * p)) * Math.sqrt(-3 / p)));
    const phi = Math.acos(arg) / 3;
    for (let k = 0; k < 3; k++) E.re[k] = r * Math.cos(phi - (2 * Math.PI * k) / 3) + sh;
    E.nReal = 3;
  }
  // Newton polish on simple roots (skipped near a repeated root, where f' ≈ 0).
  for (let k = 0; k < E.nReal; k++) {
    let x = E.re[k];
    for (let it = 0; it < 4; it++) {
      const f = ((x + a) * x + b) * x + c, fp = (3 * x + 2 * a) * x + b;
      if (Math.abs(fp) < 1e-6 * (1 + sc)) break;
      x -= f / fp;
    }
    E.re[k] = x;
  }
  // sort descending
  for (let i = 0; i < E.nReal; i++) for (let j = i + 1; j < E.nReal; j++) if (E.re[j] > E.re[i]) { const t = E.re[i]; E.re[i] = E.re[j]; E.re[j] = t; }
  return E;
}

const _B = new Float64Array(9), _c = new Float64Array(9);
const cross = (m, i, j, o, oi) => {
  const ax = m[i * 3], ay = m[i * 3 + 1], az = m[i * 3 + 2], bx = m[j * 3], by = m[j * 3 + 1], bz = m[j * 3 + 2];
  o[oi] = ay * bz - az * by; o[oi + 1] = az * bx - ax * bz; o[oi + 2] = ax * by - ay * bx;
};
const n3 = (o, i) => Math.hypot(o[i], o[i + 1], o[i + 2]);

/** The eigenspace of m for eigenvalue lam: null space of (m − λI). Returns its dimension (1, 2 or 3);
 *  e.v is the direction (dim 1) and e.n the normal of the eigen-plane (dim 2). */
function eigenspace(m, lam, e) {
  for (let q = 0; q < 9; q++) _B[q] = m[q];
  _B[0] -= lam; _B[4] -= lam; _B[8] -= lam;
  const S = Math.max(1, maxAbs(m), Math.abs(lam));
  let rmax = 0, ri = 0;
  for (let r = 0; r < 3; r++) { const l = n3(_B, r * 3); if (l > rmax) { rmax = l; ri = r; } }
  if (rmax < 1e-6 * S) { e.dim = 3; return 3; }
  cross(_B, 0, 1, _c, 0); cross(_B, 0, 2, _c, 3); cross(_B, 1, 2, _c, 6);
  let cmax = 0, ci = 0;
  for (let r = 0; r < 3; r++) { const l = n3(_c, r * 3); if (l > cmax) { cmax = l; ci = r; } }
  let o, L, arr;
  if (cmax < 1e-5 * S * S) { e.dim = 2; arr = _B; o = ri * 3; L = rmax; } else { e.dim = 1; arr = _c; o = ci * 3; L = cmax; }
  const tgt = e.dim === 1 ? e.v : e.n;
  tgt[0] = arr[o] / L; tgt[1] = arr[o + 1] / L; tgt[2] = arr[o + 2] / L;
  // Sign convention: the largest component is positive.
  let big = 0;
  for (let q = 1; q < 3; q++) if (Math.abs(tgt[q]) > Math.abs(tgt[big]) + 1e-9) big = q;
  if (tgt[big] < 0) { tgt[0] = -tgt[0]; tgt[1] = -tgt[1]; tgt[2] = -tgt[2]; }
  return e.dim;
}

/** All real eigenspaces of m into list (preallocated); returns the count. */
function eigenspaces(m, E, list) {
  eig3(m, E);
  let n = 0;
  for (let k = 0; k < E.nReal; k++) {
    const lam = E.re[k];
    if (n > 0 && Math.abs(lam - list[n - 1].lamSum / list[n - 1].mult) < 1e-5 * Math.max(1, Math.abs(lam))) {
      list[n - 1].lamSum += lam; list[n - 1].mult++;
      continue;
    }
    list[n].lamSum = lam; list[n].mult = 1; n++;
  }
  for (let q = 0; q < n; q++) {
    const e = list[q];
    e.lam = e.lamSum / e.mult;
    if (Math.abs(e.lam) < 1e-9) e.lam = 0;
    eigenspace(m, e.lam, e);
  }
  return n;
}

/** Rank of m (0–3). */
function rank3(m) {
  const S = maxAbs(m);
  if (S < 1e-9) return 0;
  if (Math.abs(det3(m)) > 1e-6 * Math.max(1, S * S * S)) return 3;
  cross(m, 0, 1, _c, 0); cross(m, 0, 2, _c, 3); cross(m, 1, 2, _c, 6);
  return Math.max(n3(_c, 0), n3(_c, 3), n3(_c, 6)) > 1e-6 * Math.max(1, S * S) ? 2 : 1;
}

const ease = (u) => u * u * (3 - 2 * u);

/** Matrix as HTML: a bracketed 3×3 grid, columns colour-coded to i, j, k. */
function matHTML(m, colored = true) {
  let h = '<span style="display:inline-grid;grid-template-columns:repeat(3,auto);gap:1px 10px;padding:2px 7px;border-left:2px solid #9aa3c7;border-right:2px solid #9aa3c7;border-radius:5px;font:600 12.5px ui-monospace,Consolas,monospace;text-align:right;vertical-align:middle">';
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) h += `<span style="color:${colored ? COLS[c] : '#e8eeff'}">${fmt(m[r * 3 + c])}</span>`;
  return h + '</span>';
}

export default {
  view: { dist: 8.2, yaw: 0.62, pitch: 0.3, target: [0, OY, 0], minDist: 4, maxDist: 18 },
  floor: true,
  explain: `
<p>A <b>3×3 matrix</b> <i>A</i> is a machine that moves every point of space: the point (vector)
<b>v</b> goes to <i>A</i><b>v</b>. Matrix maps are <b>linear</b>: the origin stays put, and grid lines stay
straight, parallel and evenly spaced. Watch the glowing grid bend while the faint grid stays where it was.</p>
<p><b>The columns tell you everything.</b> Column 1 of <i>A</i> is where <span style="color:${COL.i}"><b>i</b></span>
= (1, 0, 0) lands, column 2 is where <span style="color:${COL.j}"><b>j</b></span> lands, column 3 is where
<span style="color:${COL.k}"><b>k</b></span> lands. Since any <b>v</b> = <i>x</i><b>i</b> + <i>y</i><b>j</b> +
<i>z</i><b>k</b>, its image is <i>A</i><b>v</b> = <i>x</i><b>a</b>₁ + <i>y</i><b>a</b>₂ + <i>z</i><b>a</b>₃: the
same recipe, made with the new arrows. Turn on <b>Vector v</b> to see that path drawn tip to tail.</p>
<p><b>Determinant.</b> The unit cube becomes a slanted box (a parallelepiped) whose volume is |det <i>A</i>|, and
every other shape's volume is multiplied by the same factor. If det <i>A</i> &lt; 0 the map also
<b>flips orientation</b>: a right hand becomes a left hand, and the cube turns orange. You can't flip a cube
by smoothly moving it, so the reflection animation has to squash it flat on the way (det passes through 0).</p>
<p>If det <i>A</i> = 0, space is crushed onto a plane, a line or a point. The <b>rank</b> is the dimension of
what is left. Different points land on the same spot, so nothing can undo it: the matrix has <b>no inverse</b>.</p>
<p><b>Eigenvectors.</b> Most vectors are knocked off their own line. An eigenvector <b>v</b> only gets
stretched: <i>A</i><b>v</b> = λ<b>v</b>. λ &lt; 0 reverses it and λ = 0 squashes it to nothing. The gold lines
are the real eigen-directions; a gold disc means a whole plane of them. A rotation about the <i>z</i>-axis has only
one: the axis. Its other two eigenvalues are complex numbers, listed but not drawn. The app finds λ by solving
det(<i>A</i> − λ<i>I</i>) = 0, a cubic, numerically.</p>
<p><b>Order matters.</b> Doing <i>A</i> first and then <i>B</i> is the single matrix <i>B</i>·<i>A</i>
(the matrix next to <b>v</b> acts first). Usually <i>B</i>·<i>A</i> ≠ <i>A</i>·<i>B</i>: try <b>Compose</b>.</p>
<p><b>About the animation:</b> a matrix only says where things end up. To let you watch, the app blends the
entries in a straight line, (1 − <i>t</i>)<i>I</i> + <i>tA</i> (for a rotation it turns the angle instead).
For that straight-line blend the eigenvectors of <i>A</i> stay on their lines the whole way, scaled by
(1 − <i>t</i>) + <i>t</i>λ.</p>`,
  formula: `<i>A</i><b>v</b> = <i>x</i>·<b>a</b>₁ + <i>y</i>·<b>a</b>₂ + <i>z</i>·<b>a</b>₃ &nbsp;(<b>a</b><sub>n</sub> = column n)<br>
volume of image = |det <i>A</i>| × volume of shape<br>
<i>A</i><b>v</b> = λ<b>v</b> &nbsp;⇔&nbsp; det(<i>A</i> − λ<i>I</i>) = 0, <b>v</b> ≠ 0<br>
“<i>A</i>, then <i>B</i>”: <b>v</b> ↦ <i>B</i>(<i>A</i><b>v</b>) = (<i>BA</i>)<b>v</b>`,
  vocab: [
    ['Linear transformation', 'A map of space that keeps the origin fixed and keeps lines straight, parallel and evenly spaced. Every 3×3 matrix gives one.'],
    ['Basis vectors i, j, k', 'The unit arrows (1, 0, 0), (0, 1, 0) and (0, 0, 1). Every vector is a combination xi + yj + zk.'],
    ['Column vector', 'Column n of A is the image of the n-th basis vector: A·i is column 1, A·j column 2, A·k column 3.'],
    ['Identity matrix I', 'The matrix with 1s on the diagonal and 0s elsewhere. It leaves every vector where it is, like multiplying by 1.'],
    ['Determinant', 'det A: the factor by which A scales volume, with a minus sign when it flips orientation.'],
    ['Orientation', 'Handedness: whether i, j, k form a right-handed or a left-handed set. A negative determinant swaps it.'],
    ['Rank', 'The dimension of the space A lands in: 3 (all of space), 2 (a plane), 1 (a line) or 0 (a point).'],
    ['Inverse A⁻¹', 'The matrix that undoes A: A⁻¹A = I. It exists exactly when det A ≠ 0.'],
    ['Eigenvector, eigenvalue', 'A non-zero v with Av = λv: A only stretches it, by the eigenvalue λ, along its own line.'],
    ['Composition', 'Doing one transformation after another. "A, then B" is the product BA, and in general BA ≠ AB.'],
  ],
  standards: [
    'CCSS.MATH.CONTENT.HSN.VM.C.8',
    'CCSS.MATH.CONTENT.HSN.VM.C.9',
    'CCSS.MATH.CONTENT.HSN.VM.C.10',
    'CCSS.MATH.CONTENT.HSN.VM.C.11',
    'CCSS.MATH.CONTENT.HSN.VM.C.12',
  ],
  quiz: [
    {
      q: 'The columns of A are (2, 0, 0), (0, 3, 0) and (0, 0, 1). What is A·(1, 1, 1)?',
      choices: ['(2, 3, 1)', '(6, 0, 0)', '(1, 1, 1)', '(5, 5, 5)'],
      answer: 0,
      why: 'A·v = x·a₁ + y·a₂ + z·a₃ = 1·(2, 0, 0) + 1·(0, 3, 0) + 1·(0, 0, 1) = (2, 3, 1).',
    },
    {
      q: 'A matrix has determinant −2. What does it do to the unit cube?',
      choices: [
        'Doubles its volume and flips its orientation (a mirror image)',
        'Halves its volume',
        'Squashes it flat',
        'Doubles its volume and keeps its orientation',
      ],
      answer: 0,
      why: '|det| = 2 is the volume scale factor, and the minus sign means orientation is reversed: right-handed becomes left-handed.',
    },
    {
      q: 'The projection P = diag(1, 1, 0) flattens space onto the xy-plane. Why has it no inverse?',
      choices: [
        'det P = 0: different points land on the same point, so you cannot tell where they came from',
        'det P = 1, so it does nothing to undo',
        'Its eigenvalues are complex',
        'No 3×3 matrix has an inverse',
      ],
      answer: 0,
      why: 'For example (1, 2, 5) and (1, 2, −3) both land on (1, 2, 0). No matrix can send one point back to two places, and det P = 1·1·0 = 0.',
    },
    {
      q: 'v is an eigenvector of A with eigenvalue 3. What is A·(2v)?',
      choices: ['6v', '3v', '2v', '5v'],
      answer: 0,
      why: 'A is linear, so A(2v) = 2·Av = 2·3v = 6v. Every non-zero multiple of an eigenvector is an eigenvector with the same λ.',
    },
    {
      q: 'R rotates 90° about the z-axis and S = diag(2, 1, 1) stretches x by 2. Which single matrix means "first R, then S"?',
      choices: ['SR', 'RS', 'R + S', 'Either SR or RS: the order of matrices never matters'],
      answer: 0,
      why: 'v ↦ Rv ↦ S(Rv) = (SR)v: the matrix next to v acts first. Here the order matters: SR·i = S·j = (0, 1, 0), but RS·i = R·(2, 0, 0) = (0, 2, 0).',
    },
  ],

  build(ctx) {
    // Test-only URL options (harmless):
    //   ?m=a,b,c,d,e,f,g,h,i   matrix A, row by row        ?preset=identity|scale|stretch|shear|rot|reflect|project|random
    //   ?theta=<deg>           rotation angle (with rot)    ?t=0..1  animation time (default: plays from 0; 1 with ?snap)
    //   ?eig=0|1               eigen lines (default on)     ?vec=x,y,z  show v and Av
    //   ?obj=knot|sphere|none  the object to transform      ?grid=0  hide the lattice
    //   ?compose=1  compose mode; ?b=… (like ?m) sets B; ?order=ab applies B first; ?example=1 rotate-then-stretch
    //   ?edit=b                edit B in the panel          ?selftest  logs [matrices selftest] checks
    const { THREE, root, ui } = ctx;
    const V3 = THREE.Vector3;
    const params = new URLSearchParams(location.search);

    // ── state ────────────────────────────────────────────────────────────────────────────────
    const slot = (vals) => ({ m: setM(new Float64Array(9), ...vals), rot: null });
    const A = slot([1.5, 0.5, 0.3, 0, 0.8, 0.4, 0, 0, 1.2]);
    const B = slot([2, 0, 0, 0, 1, 0, 0, 0, 1]);
    let compose = params.get('compose') === '1' || params.get('example') === '1';
    let orderAB = params.get('order') === 'ab'; // false: A then B (B·A); true: B then A (A·B)
    let edit = params.get('edit') === 'b' && compose ? B : A;
    let theta = (+(params.get('theta') ?? 90) * Math.PI) / 180;
    let t = 1, playing = false, playU = 0;
    let showEig = params.get('eig') !== '0';
    let showVec = params.has('vec');
    const vec = [1, 1, 1];
    if (showVec) params.get('vec').split(',').slice(0, 3).forEach((s, q) => { if (isFinite(+s) && s !== '') vec[q] = +s; });

    const M = new Float64Array(9);   // what is drawn now (depends on t)
    const F = new Float64Array(9);   // the full map at t = 1 (A, or the product)
    const R = new Float64Array(9);   // render copy (nudged when singular)
    const T1 = new Float64Array(9), T2 = new Float64Array(9), OTHER = new Float64Array(9);
    const E = { re: new Float64Array(3), nReal: 0, cRe: 0, cIm: 0 };
    const eigList = [0, 1, 2].map(() => ({ lam: 0, lamSum: 0, mult: 0, dim: 0, v: new Float64Array(3), n: new Float64Array(3) }));
    let nEig = 0;

    const interp = (S, s, o) => {
      if (S.rot !== null) return rotZ(o, s * S.rot);
      for (let q = 0; q < 9; q++) o[q] = s * S.m[q] + (q % 4 === 0 ? 1 - s : 0);
      return o;
    };
    const first = () => (orderAB ? B : A), second = () => (orderAB ? A : B);

    // math → world
    const toWorld = (x, y, z, out) => out.set(U * x, OY + U * z, -U * y);
    const applyW = (m, x, y, z, out) => toWorld(m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z, m[6] * x + m[7] * y + m[8] * z, out);

    // ── clipping box (the transformed space is seen through it) ─────────────────────────────
    const prevClip = ctx.renderer.localClippingEnabled;
    ctx.renderer.localClippingEnabled = true;
    const clip = [
      new THREE.Plane(new V3(-1, 0, 0), HB), new THREE.Plane(new V3(1, 0, 0), HB),
      new THREE.Plane(new V3(0, -1, 0), OY + HB), new THREE.Plane(new V3(0, 1, 0), HB - OY),
      new THREE.Plane(new V3(0, 0, -1), HB), new THREE.Plane(new V3(0, 0, 1), HB),
    ];

    const space = new THREE.Group();   // its matrix = (math → world) · A
    space.matrixAutoUpdate = false;
    root.add(space);

    // ── transformed lattice ─────────────────────────────────────────────────────────────────
    const tint = COLS.map((c) => new THREE.Color(c).lerp(new THREE.Color(COL.math), 0.45));
    {
      const STEP = 0.25, NS = Math.round((2 * EXT) / STEP), NL = 2 * LAT + 1;
      const nv = 3 * NL * NL * NS * 2;
      const pos = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
      const fade = (x, y, z) => { const r = Math.hypot(x, y, z); return r < 1.4 ? 1 : Math.max(0, 1 - (r - 1.4) / 1.8) ** 1.6; };
      let o = 0;
      const p = [0, 0, 0];
      for (let ax = 0; ax < 3; ax++) for (let u = -LAT; u <= LAT; u++) for (let w = -LAT; w <= LAT; w++) {
        const b1 = (ax + 1) % 3, b2 = (ax + 2) % 3;
        const axisLine = u === 0 && w === 0;
        const gain = axisLine ? 1.25 : 0.62;
        for (let sI = 0; sI < NS; sI++) for (let e = 0; e < 2; e++) {
          p[ax] = -EXT + (sI + e) * STEP; p[b1] = u; p[b2] = w;
          pos[o] = p[0]; pos[o + 1] = p[1]; pos[o + 2] = p[2];
          const f = fade(p[0], p[1], p[2]) * gain;
          col[o] = tint[ax].r * f; col[o + 1] = tint[ax].g * f; col[o + 2] = tint[ax].b * f;
          o += 3;
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      var lattice = new THREE.LineSegments(g, new THREE.LineBasicMaterial({
        vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, clippingPlanes: clip,
      }));
      lattice.frustumCulled = false;
      lattice.visible = params.get('grid') !== '0';
      space.add(lattice);
    }

    // ── fixed reference: faint xy-plane grid, axes, unit cube outline, box frame ─────────────
    const refGroup = new THREE.Group();
    root.add(refGroup);
    {
      const pts = [];
      const w = new V3(), w2 = new V3();
      for (let u = -EXT; u <= EXT; u++) {
        if (u === 0) continue;
        toWorld(u, -EXT, 0, w); toWorld(u, EXT, 0, w2); pts.push(w.x, w.y, w.z, w2.x, w2.y, w2.z);
        toWorld(-EXT, u, 0, w); toWorld(EXT, u, 0, w2); pts.push(w.x, w.y, w.z, w2.x, w2.y, w2.z);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      refGroup.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x8a96c8, transparent: true, opacity: 0.2, depthWrite: false })));
      const ax = [];
      for (let a = 0; a < 3; a++) {
        const v = [0, 0, 0];
        v[a] = -EXT - 0.2; toWorld(v[0], v[1], v[2], w);
        v[a] = EXT + 0.2; toWorld(v[0], v[1], v[2], w2);
        ax.push(w.x, w.y, w.z, w2.x, w2.y, w2.z);
      }
      const ga = new THREE.BufferGeometry();
      ga.setAttribute('position', new THREE.Float32BufferAttribute(ax, 3));
      refGroup.add(new THREE.LineSegments(ga, new THREE.LineBasicMaterial({ color: 0xb8c2ea, transparent: true, opacity: 0.45, depthWrite: false })));
      ['x', 'y', 'z'].forEach((n, a) => {
        const v = [0, 0, 0];
        v[a] = EXT + 0.45;
        const l = ctx.label(n, { color: '#aeb8de', size: 0.7, bold: false });
        toWorld(v[0], v[1], v[2], l.position);
        refGroup.add(l);
      });
      // original unit cube, dashed
      const cp = [];
      for (let a = 0; a < 3; a++) for (let u = 0; u < 2; u++) for (let v = 0; v < 2; v++) {
        const s = [0, 0, 0], e = [0, 0, 0];
        s[(a + 1) % 3] = e[(a + 1) % 3] = u; s[(a + 2) % 3] = e[(a + 2) % 3] = v; e[a] = 1;
        toWorld(s[0], s[1], s[2], w); toWorld(e[0], e[1], e[2], w2);
        cp.push(w.x, w.y, w.z, w2.x, w2.y, w2.z);
      }
      const gc = new THREE.BufferGeometry();
      gc.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
      const ref = new THREE.LineSegments(gc, new THREE.LineDashedMaterial({ color: 0xdfe5ff, dashSize: 0.05, gapSize: 0.04, transparent: true, opacity: 0.5, depthWrite: false }));
      ref.computeLineDistances();
      refGroup.add(ref);
      // clipping-box frame
      const bf = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(2 * HB, 2 * HB, 2 * HB)),
        new THREE.LineBasicMaterial({ color: COL.math, transparent: true, opacity: 0.16, depthWrite: false, toneMapped: false }),
      );
      bf.position.y = OY;
      refGroup.add(bf);
    }

    // ── unit cube → parallelepiped ──────────────────────────────────────────────────────────
    const cubeCol = { pos: new THREE.Color(COL.math), neg: new THREE.Color(COL.flip) };
    const cubeMat = new THREE.MeshPhysicalMaterial({
      color: COL.math, emissive: COL.math, emissiveIntensity: 0.12, transparent: true, opacity: 0.34,
      roughness: 0.1, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.3,
      side: THREE.DoubleSide, depthWrite: false, clippingPlanes: clip,
    });
    const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0.5, 0.5), cubeMat);
    cube.renderOrder = 5;
    const cubeEdges = (() => {
      const pos = [], col = [];
      for (let a = 0; a < 3; a++) for (let u = 0; u < 2; u++) for (let v = 0; v < 2; v++) {
        const s = [0, 0, 0], e = [0, 0, 0];
        s[(a + 1) % 3] = e[(a + 1) % 3] = u; s[(a + 2) % 3] = e[(a + 2) % 3] = v; e[a] = 1;
        pos.push(...s, ...e);
        const c = new THREE.Color(COLS[a]);
        col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, toneMapped: false, clippingPlanes: clip }));
    })();
    const cubeGroup = new THREE.Group();
    cubeGroup.add(cube, cubeEdges);
    space.add(cubeGroup);
    let detLab = ctx.label('det', { color: COL.math, size: 0.8 });
    root.add(detLab);
    let detText = '', detDirty = true, detTimer = 1;

    // ── the object: torus-knot sculpture or a sphere of points ──────────────────────────────
    const knotGeo = new THREE.TorusKnotGeometry(0.44, 0.13, 260, 28, 2, 3).rotateX(0.75).rotateY(0.3);
    {
      const n = knotGeo.attributes.position.count, cols = new Float32Array(n * 3);
      const stops = ['#7c4dff', '#c38bff', '#ff7ac8', '#ffb86b', '#7c4dff'].map((h) => new THREE.Color(h));
      const tc = new THREE.Color();
      for (let q = 0; q < n; q++) {
        const u = (Math.floor(q / 29) / 261) * (stops.length - 1);
        const i = Math.min(stops.length - 2, Math.floor(u));
        tc.copy(stops[i]).lerp(stops[i + 1], u - i);
        cols[q * 3] = tc.r; cols[q * 3 + 1] = tc.g; cols[q * 3 + 2] = tc.b;
      }
      knotGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    }
    const knot = new THREE.Mesh(knotGeo, new THREE.MeshPhysicalMaterial({
      vertexColors: true, roughness: 0.22, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08,
      iridescence: 0.6, iridescenceIOR: 1.5, envMapIntensity: 1.1, clippingPlanes: clip, clipShadows: true,
    }));
    knot.position.set(-0.6, -1.3, -1.2); // math coordinates
    knot.castShadow = true;
    space.add(knot);

    const sphere = (() => {
      const n = 1500, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
      const ga = Math.PI * (3 - Math.sqrt(5));
      for (let q = 0; q < n; q++) {
        const z = 1 - (2 * (q + 0.5)) / n, r = Math.sqrt(1 - z * z), a = q * ga;
        const x = r * Math.cos(a), y = r * Math.sin(a);
        pos.set([x, y, z], q * 3);
        col.set([0.35 + 0.65 * (0.5 + 0.5 * x), 0.35 + 0.65 * (0.5 + 0.5 * y), 0.45 + 0.55 * (0.5 + 0.5 * z)], q * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return new THREE.Points(g, new THREE.PointsMaterial({ size: 0.045, vertexColors: true, toneMapped: false, transparent: true, opacity: 0.95, clippingPlanes: clip }));
    })();
    space.add(sphere);
    const setObject = (v) => { knot.visible = v === 'knot'; sphere.visible = v === 'sphere'; };
    let objChoice = ['knot', 'sphere', 'none'].includes(params.get('obj')) ? params.get('obj') : 'knot';
    setObject(objChoice);

    // ── arrows ──────────────────────────────────────────────────────────────────────────────
    const shaftGeo = new THREE.CylinderGeometry(1, 1, 1, 20).translate(0, 0.5, 0);
    const headGeo = new THREE.ConeGeometry(1, 1, 28).translate(0, 0.5, 0);
    const stickGeo = new THREE.CylinderGeometry(1, 1, 1, 12);
    const UP = new V3(0, 1, 0);
    const _d = new V3();
    const makeArrow = (color, r, { opacity = 1, glow = 0.55 } = {}) => {
      const m = new THREE.MeshPhysicalMaterial({
        color, emissive: color, emissiveIntensity: glow, roughness: 0.28, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.1,
        transparent: opacity < 1, opacity,
      });
      const g = new THREE.Group();
      const shaft = new THREE.Mesh(shaftGeo, m), head = new THREE.Mesh(headGeo, m);
      shaft.castShadow = head.castShadow = opacity === 1;
      g.add(shaft, head);
      g.userData = { shaft, head, r };
      root.add(g);
      return g;
    };
    /** Point arrow g from world `from` to world `to`; returns false (and hides it) when too short. */
    const aim = (g, from, to) => {
      _d.subVectors(to, from);
      const len = _d.length();
      g.visible = len > 0.02;
      if (!g.visible) return false;
      const { shaft, head, r } = g.userData;
      const hl = Math.min(r * 7, len * 0.45);
      g.position.copy(from);
      g.quaternion.setFromUnitVectors(UP, _d.multiplyScalar(1 / len));
      shaft.scale.set(r, len - hl, r);
      head.scale.set(r * 2.7, hl, r * 2.7);
      head.position.y = len - hl;
      return true;
    };
    const stick = (m, a, b, r) => {
      _d.subVectors(b, a);
      const L = _d.length();
      m.visible = L > 0.005;
      if (!m.visible) return;
      m.position.addVectors(a, b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(UP, _d.multiplyScalar(1 / L));
      m.scale.set(r, L, r);
    };

    const O = new V3(0, OY, 0);
    const basis = COLS.map((c) => makeArrow(c, 0.034));
    const basisLab = ['i', 'j', 'k'].map((n, a) => { const l = ctx.label(n, { color: COLS[a], size: 0.95 }); root.add(l); return l; });
    const originBall = new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 16), new THREE.MeshPhysicalMaterial({ color: '#ffffff', emissive: '#c38bff', emissiveIntensity: 0.5, roughness: 0.2, clearcoat: 1 }));
    originBall.position.copy(O);
    root.add(originBall);
    basis.forEach((g, a) => ctx.pickable(g, () => {
      const c = [M[a], M[3 + a], M[6 + a]].map((v) => fmt(v)).join(', ');
      ctx.card(`<span style="color:${COLS[a]}">${'ijk'[a]}</span> lands on column ${a + 1}`,
        `<p>${'ijk'[a]} = ${['(1, 0, 0)', '(0, 1, 0)', '(0, 0, 1)'][a]} goes to <b>a${SUB[a]}</b> = (${c}), which is column ${a + 1} of the matrix (shown in the same colour in the panel).</p>`);
    }));

    // ── eigen visuals ───────────────────────────────────────────────────────────────────────
    const eigCore = new THREE.MeshBasicMaterial({ color: COL.eig, toneMapped: false, clippingPlanes: clip });
    const eigHalo = new THREE.MeshBasicMaterial({ color: COL.eig, toneMapped: false, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, clippingPlanes: clip });
    const LLEN = 2 * HB * Math.sqrt(3) + 0.2;
    const eigLines = [0, 1, 2].map(() => {
      const g = new THREE.Group();
      const core = new THREE.Mesh(stickGeo, eigCore), halo = new THREE.Mesh(stickGeo, eigHalo);
      core.scale.set(0.011, LLEN, 0.011);
      halo.scale.set(0.045, LLEN, 0.045);
      g.add(core, halo);
      g.position.copy(O);
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.065, 24, 16), new THREE.MeshPhysicalMaterial({ color: '#fff4cf', emissive: COL.eig, emissiveIntensity: 0.9, roughness: 0.2, clearcoat: 1 }));
      const lab = ctx.label('λ', { color: COL.eig, size: 0.8 });
      root.add(g, bead, lab);
      return { g, bead, lab, text: '', w: new V3(), v: new Float64Array(3) };
    });
    const eigPlane = (() => {
      const g = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.CircleGeometry(2.6, 96), new THREE.MeshPhysicalMaterial({
        color: COL.eig, emissive: COL.eig, emissiveIntensity: 0.25, transparent: true, opacity: 0.1, roughness: 0.2,
        side: THREE.DoubleSide, depthWrite: false, clippingPlanes: clip,
      }));
      const spokes = [];
      for (let q = 0; q < 12; q++) { const a = (q / 12) * Math.PI; spokes.push(-2.6 * Math.cos(a), -2.6 * Math.sin(a), 0, 2.6 * Math.cos(a), 2.6 * Math.sin(a), 0); }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute('position', new THREE.Float32BufferAttribute(spokes, 3));
      const rays = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: COL.eig, transparent: true, opacity: 0.26, toneMapped: false, clippingPlanes: clip }));
      g.add(disc, rays);
      g.position.copy(O);
      const lab = ctx.label('λ', { color: COL.eig, size: 0.8 });
      root.add(g, lab);
      return { g, lab, text: '' };
    })();
    let allLab = ctx.label('every vector is an eigenvector', { color: COL.eig, size: 0.75 });
    allLab.position.set(0, OY + HB + 0.25, 0);
    root.add(allLab);
    let allText = '';
    const Z = new V3(0, 0, 1), wn = new V3();

    function setEigLabel(obj, text) {
      if (obj.text === text) return;
      obj.text = text;
      obj.lab = ctx.relabel(obj.lab, text, { color: COL.eig, size: 0.8 });
    }
    function placeEigen() {
      let li = 0;
      eigPlane.g.visible = eigPlane.lab.visible = false;
      allLab.visible = false;
      if (showEig) for (let q = 0; q < nEig; q++) {
        const e = eigList[q];
        if (e.dim === 1 && li < 3) {
          const L = eigLines[li++];
          L.v.set(e.v);
          L.w.set(e.v[0], e.v[2], -e.v[1]).normalize();
          L.g.quaternion.setFromUnitVectors(UP, L.w);
          setEigLabel(L, `λ = ${fmt(e.lam)}`);
          L.lab.position.copy(O).addScaledVector(L.w, 1.62);
          L.g.visible = L.lab.visible = L.bead.visible = true;
        } else if (e.dim === 2) {
          wn.set(e.n[0], e.n[2], -e.n[1]).normalize();
          eigPlane.g.quaternion.setFromUnitVectors(Z, wn);
          eigPlane.g.visible = eigPlane.lab.visible = true;
          setEigLabel(eigPlane, `plane: λ = ${fmt(e.lam)}`);
          // label on the plane, at its "highest" point inside the box
          _d.set(0, 1, 0).addScaledVector(wn, -wn.y);
          if (_d.lengthSq() < 1e-6) _d.set(1, 0, 0).addScaledVector(wn, -wn.x);
          eigPlane.lab.position.copy(O).addScaledVector(_d.normalize(), 1.45);
          eigPlane.lab.position.x -= 0.5;
        } else if (e.dim === 3) {
          const txt = `every vector is an eigenvector: λ = ${fmt(e.lam)}`;
          if (txt !== allText) { allText = txt; allLab = ctx.relabel(allLab, txt, { color: COL.eig, size: 0.75 }); }
          allLab.visible = true;
        }
      }
      for (let q = li; q < 3; q++) eigLines[q].g.visible = eigLines[q].lab.visible = eigLines[q].bead.visible = false;
    }

    // ── vector v and Av ─────────────────────────────────────────────────────────────────────
    const vArrow = makeArrow('#ffffff', 0.016, { opacity: 0.55, glow: 0.3 });
    const avArrow = makeArrow(COL.v, 0.026, { glow: 0.7 });
    const pathSticks = COLS.map((c) => { const m = new THREE.Mesh(stickGeo, new THREE.MeshBasicMaterial({ color: c, toneMapped: false, transparent: true, opacity: 0.9 })); root.add(m); return m; });
    const vLab = ctx.label('v', { color: '#ffffff', size: 0.8 }), avLab = ctx.label('Av', { color: COL.v, size: 0.85 });
    root.add(vLab, avLab);
    const P0 = new V3(), P1 = new V3(), P2 = new V3(), P3 = new V3(), W = new V3();

    // ── UI ──────────────────────────────────────────────────────────────────────────────────
    ui.heading('The matrix: its columns are where i, j, k land');
    const editChoice = ui.choice('Editing', {
      options: [{ value: 'A', label: 'Matrix A' }, { value: 'B', label: 'Matrix B' }],
      value: edit === B ? 'B' : 'A',
      onChange: (v) => { edit = v === 'B' ? B : A; syncInputs(); },
    });
    const inStyle = (c) => `width:100%;box-sizing:border-box;padding:6px 4px;border-radius:7px;border:1px solid ${c}88;background:${c}1c;color:#f2f5ff;font:600 14px ui-monospace,Consolas,monospace;text-align:center`;
    let gridHTML = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:6px 8px;border-left:2px solid #9aa3c7;border-right:2px solid #9aa3c7;border-radius:8px">';
    for (let c = 0; c < 3; c++) gridHTML += `<div style="text-align:center;font-size:11.5px;font-weight:700;color:${COLS[c]}">a${SUB[c]} = A·${'ijk'[c]}</div>`;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) gridHTML += `<input type="number" min="-3" max="3" step="0.1" data-k="${r * 3 + c}" style="${inStyle(COLS[c])}">`;
    gridHTML += '</div>';
    const gridNote = ui.note(gridHTML);
    const inputs = [...gridNote.el.querySelectorAll('input')];
    const syncInputs = () => { for (const inp of inputs) inp.value = +edit.m[+inp.dataset.k].toFixed(3); };
    for (const inp of inputs) {
      const k = +inp.dataset.k;
      inp.addEventListener('input', () => {
        const v = parseFloat(inp.value);
        if (!isFinite(v)) return;
        edit.m[k] = Math.max(-3, Math.min(3, v));
        edit.rot = null;
        playing = false; t = 1; tSl.set(1);
        retarget();
      });
      inp.addEventListener('change', () => { inp.value = +edit.m[k].toFixed(3); });
    }

    const PRESETS = {
      identity: (o) => setDiag(o, 1, 1, 1),
      scale: (o) => setDiag(o, 1.5, 1.5, 1.5),
      stretch: (o) => setDiag(o, 2, 1, 0.5),
      shear: (o) => setM(o, 1, 0, 1, 0, 1, 0, 0, 0, 1),
      rot: (o) => rotZ(o, theta),
      reflect: (o) => setM(o, 0, 1, 0, 1, 0, 0, 0, 0, 1),
      project: (o) => setDiag(o, 1, 1, 0),
      random: (o) => { for (let q = 0; q < 9; q++) o[q] = Math.round((Math.random() * 3.6 - 1.6) * 10) / 10; return o; },
    };
    const presetNotes = {
      identity: 'Identity: nothing moves. det = 1.',
      scale: 'Uniform scale ×1.5: volume × 1.5³ = 3.375.',
      stretch: 'Stretch x by 2 and squash z by ½: the shape changes, but det = 2 · 1 · ½ = 1, so volume does not.',
      shear: 'Shear: k leans over to (1, 0, 1), like pushing a stack of cards. det = 1 (volume kept).',
      rot: 'Rotation about the z-axis: lengths and volume kept (det = 1). Only the axis is an eigen-direction.',
      reflect: 'Reflection in the plane y = x (swap x and y): det = −1. Watch the cube squash flat, then come back inside out.',
      project: 'Projection onto the xy-plane: z is thrown away. det = 0, rank 2: space collapses flat.',
      random: 'A random matrix.',
    };
    const presetMsg = ui.note('');
    function applyPreset(id, animate = true) {
      PRESETS[id](edit.m);
      edit.rot = id === 'rot' ? theta : null;
      presetMsg.set(presetNotes[id] || '');
      syncInputs();
      retarget();
      if (animate) play(); else { t = 1; tSl.set(1); refresh(); }
    }
    ui.button('Identity', () => applyPreset('identity'));
    ui.button('Scale', () => applyPreset('scale'));
    ui.button('Stretch', () => applyPreset('stretch'));
    ui.button('Shear', () => applyPreset('shear'));
    ui.button('Rotate z', () => applyPreset('rot'));
    ui.button('Reflect', () => applyPreset('reflect'));
    ui.button('Project', () => applyPreset('project'));
    ui.button('Random', () => applyPreset('random'));
    const thSl = ui.slider('Rotation angle θ (Rotate z)', {
      min: -180, max: 180, step: 1, value: Math.round((theta * 180) / Math.PI), fmt: (v) => `${v}°`,
      onChange: (v) => { theta = (v * Math.PI) / 180; applyPreset('rot', false); },
    });

    ui.heading('Animate from I to the matrix');
    const tSl = ui.slider('t', { min: 0, max: 1, step: 0.01, value: t, fmt: (v) => v.toFixed(2), onChange: (v) => { playing = false; t = v; refresh(); } });
    ui.button('▶ Play', () => play(), { primary: true });
    ui.button('t = 0', () => { playing = false; t = 0; tSl.set(0); refresh(); });
    ui.button('t = 1', () => { playing = false; t = 1; tSl.set(1); refresh(); });
    const rNow = ui.readout('Matrix now');
    const rDet = ui.readout('det');
    const rVol = ui.readout('Volume scale |det|');
    const rInv = ui.readout('Invertible?');
    const rOrient = ui.note('');

    ui.heading('Eigenvectors (of the full matrix)');
    ui.toggle('Show real eigen-directions', { value: showEig, onChange: (v) => { showEig = v; placeEigen(); refresh(); } });
    const rEig = ui.note('');

    ui.heading('Vector v and its image Av');
    const tVec = ui.toggle('Show v, Av and the column recipe', { value: showVec, onChange: (v) => { showVec = v; refresh(); } });
    const vSl = ['x', 'y', 'z'].map((n, q) => ui.slider(n, {
      min: -2, max: 2, step: 0.1, value: vec[q], fmt: (v) => fmt(v, 1),
      onChange: (v) => { vec[q] = v; if (!showVec) { showVec = true; tVec.set(true); } refresh(); },
    }));
    const rVec = ui.note('');

    ui.heading('Compose: one matrix after another');
    const tComp = ui.toggle('Compose A and B', { value: compose, onChange: (v) => { compose = v; if (!v) { edit = A; editChoice.set('A'); syncInputs(); } layoutCompose(); retarget(); play(); } });
    const orderChoice = ui.choice('Order', {
      options: [{ value: 'ba', label: 'A, then B → B·A' }, { value: 'ab', label: 'B, then A → A·B' }],
      value: orderAB ? 'ab' : 'ba',
      onChange: (v) => { orderAB = v === 'ab'; retarget(); play(); },
    });
    const rComp = ui.note('');
    ui.button('Example: rotate, then stretch', () => loadExample(true));

    ui.heading('Show');
    ui.choice('Object', {
      options: [{ value: 'knot', label: 'Torus knot' }, { value: 'sphere', label: 'Sphere of points' }, { value: 'none', label: 'None' }],
      value: objChoice, onChange: (v) => { objChoice = v; setObject(v); },
    });
    ui.toggle('Transformed grid', { value: lattice.visible, onChange: (v) => (lattice.visible = v) });
    ui.toggle('Unit cube', { value: true, onChange: (v) => { cubeGroup.visible = v; detDirty = true; } });
    ui.toggle('Reference grid', { value: true, onChange: (v) => (refGroup.visible = v) });

    function layoutCompose() {
      editChoice.el.style.display = orderChoice.el.style.display = rComp.el.style.display = compose ? '' : 'none';
    }
    function loadExample(animate) {
      rotZ(A.m, Math.PI / 2); A.rot = Math.PI / 2;
      setDiag(B.m, 2, 1, 1); B.rot = null;
      theta = Math.PI / 2; thSl.set(90);
      compose = true; tComp.set(true); orderAB = false; orderChoice.set('ba');
      layoutCompose(); syncInputs();
      presetMsg.set('A = rotate 90° about z, B = stretch x by 2. Switch the order to see a different result.');
      retarget();
      if (animate) play();
    }
    function play() { playing = true; playU = 0; t = 0; tSl.set(0); refresh(); }

    // ── recompute ───────────────────────────────────────────────────────────────────────────
    /** The matrices changed: full map F, its eigenvectors, product readouts. */
    function retarget() {
      if (compose) {
        mul3(second().m, first().m, F);
        mul3(first().m, second().m, OTHER);
      } else F.set(A.m);
      nEig = eigenspaces(F, E, eigList);
      placeEigen();

      // eigen readout
      let h = '';
      for (let q = 0; q < nEig; q++) {
        const e = eigList[q];
        const what = e.dim === 1 ? `line along (${fmt(e.v[0])}, ${fmt(e.v[1])}, ${fmt(e.v[2])})`
          : e.dim === 2 ? 'a whole plane of eigenvectors' : 'every vector';
        const extra = e.lam === 0 ? ' (squashed to 0)' : e.lam < 0 ? ' (reversed)' : '';
        h += `<b style="color:${COL.eig}">λ = ${fmt(e.lam)}</b>${e.mult > 1 ? ` (×${e.mult})` : ''}: ${what}${extra}<br>`;
      }
      if (E.nReal === 1) h += `<b style="color:${COL.eig}">λ = ${fmt(E.cRe)} ± ${fmt(E.cIm)}<i>i</i></b>: complex pair, no real direction (this part of space turns)<br>`;
      h += `<span style="color:#8e9bb8">Check: λ's add to the trace ${fmt(F[0] + F[4] + F[8])} and multiply to det ${fmt(det3(F))}.${compose ? ' (Eigenvectors of the product.)' : ''}</span>`;
      rEig.set(h);

      if (compose) {
        const f = orderAB ? 'B' : 'A', s = orderAB ? 'A' : 'B';
        const same = sameM(F, OTHER, 1e-9);
        rComp.set(`A ${matHTML(A.m, false)} &nbsp; B ${matHTML(B.m, false)}<br><br>
${f}, then ${s}: <b>${s}·${f}</b> = ${matHTML(F)}<br><br>
<span style="color:#8e9bb8">Other order, ${f}·${s} =</span> ${matHTML(OTHER, false)}<br>
${same ? 'These two happen to commute: the order does not matter for this pair.' : `<b>${s}·${f} ≠ ${f}·${s}</b>: order matters. The matrix next to <b>v</b> acts first.`}`);
      }
      refresh();
    }

    const tmpC = new THREE.Color();
    /** t or the matrices changed: redraw. */
    function refresh() {
      if (compose) {
        // first half of t: apply the first matrix; second half: then the second.
        const s1 = Math.min(1, Math.max(0, 2 * t)), s2 = Math.min(1, Math.max(0, 2 * t - 1));
        interp(first(), s1, T1);
        interp(second(), s2, T2);
        mul3(T2, T1, M);
      } else interp(A, t, M);
      const d = det3(M);

      // render matrix (singular → a tiny +εI so normals stay defined)
      R.set(M);
      if (Math.abs(d) < 1e-4 * Math.max(1, maxAbs(M) ** 3)) {
        let eps = 0.02;
        R[0] = M[0] + eps; R[4] = M[4] + eps; R[8] = M[8] + eps;
        if (Math.abs(det3(R)) < 1e-6) { eps = -0.02; R[0] = M[0] + eps; R[4] = M[4] + eps; R[8] = M[8] + eps; }
      }
      space.matrix.set(
        U * R[0], U * R[1], U * R[2], 0,
        U * R[6], U * R[7], U * R[8], OY,
        -U * R[3], -U * R[4], -U * R[5], 0,
        0, 0, 0, 1,
      );
      space.matrixWorldNeedsUpdate = true;

      // basis arrows = columns
      for (let a = 0; a < 3; a++) {
        toWorld(M[a], M[3 + a], M[6 + a], W);
        const ok = aim(basis[a], O, W);
        basisLab[a].visible = ok;
        if (ok) basisLab[a].position.copy(W).addScaledVector(_d.subVectors(W, O).normalize(), 0.17);
      }

      // cube colour: violet when det > 0, orange when flipped
      const k = Math.max(0, Math.min(1, 0.5 - d * 4));
      tmpC.copy(cubeCol.pos).lerp(cubeCol.neg, k);
      cubeMat.color.copy(tmpC); cubeMat.emissive.copy(tmpC);
      applyW(M, 0.5, 0.5, 0.5, detLab.position);
      const txt = `det = ${fmt(d)}${d < -1e-9 ? ' · flipped' : Math.abs(d) < 1e-9 ? ' · flat' : ''}`;
      if (txt !== detText) { detText = txt; detDirty = true; }

      // eigen beads slide along their lines (for the straight-line blend they never leave them)
      for (let q = 0; q < 3; q++) {
        const L = eigLines[q];
        if (!L.g.visible) continue;
        applyW(M, 1.5 * L.v[0], 1.5 * L.v[1], 1.5 * L.v[2], L.bead.position);
      }

      // v, Av and the recipe x·a1 + y·a2 + z·a3
      vArrow.visible = avArrow.visible = vLab.visible = avLab.visible = showVec;
      for (const s of pathSticks) s.visible = showVec;
      if (showVec) {
        const [x, y, z] = vec;
        toWorld(x, y, z, W);
        vLab.visible = aim(vArrow, O, W);
        vLab.position.copy(W);
        P0.copy(O);
        toWorld(x * M[0], x * M[3], x * M[6], P1);
        toWorld(x * M[0] + y * M[1], x * M[3] + y * M[4], x * M[6] + y * M[7], P2);
        applyW(M, x, y, z, P3);
        stick(pathSticks[0], P0, P1, 0.012);
        stick(pathSticks[1], P1, P2, 0.012);
        stick(pathSticks[2], P2, P3, 0.012);
        avLab.visible = aim(avArrow, O, P3);
        avLab.position.copy(P3).addScaledVector(_d.subVectors(P3, O).normalize(), 0.18);
        const ax = M[0] * x + M[1] * y + M[2] * z, ay = M[3] * x + M[4] * y + M[5] * z, az = M[6] * x + M[7] * y + M[8] * z;
        const term = (c, w, col) => `<span style="color:${col}">${fmt(w, 1)}·(${fmt(M[c])}, ${fmt(M[3 + c])}, ${fmt(M[6 + c])})</span>`;
        rVec.set(`<b style="color:${COL.v}">Av</b> = ${term(0, x, COL.i)} + ${term(1, y, COL.j)} + ${term(2, z, COL.k)}<br>= <b style="color:${COL.v}">(${fmt(ax)}, ${fmt(ay)}, ${fmt(az)})</b>`);
      } else rVec.set('<span style="color:#8e9bb8">Turn on to see Av built from the columns, tip to tail.</span>');

      // readouts
      rNow.set(`${matHTML(M)} <span style="color:#8e9bb8">t = ${t.toFixed(2)}</span>`);
      const dc = d < -1e-9 ? COL.flip : Math.abs(d) < 1e-9 ? '#8e9bb8' : COL.math;
      rDet.set(`<span style="color:${dc}">${fmt(d, 3)}</span>`);
      rVol.set(`× ${fmt(Math.abs(d), 3)}`);
      const rk = rank3(M);
      rInv.set(rk === 3 ? '<span style="color:#6fe0a4">yes (det ≠ 0)</span>'
        : `<span style="color:#ff7a7a">no: rank ${rk}</span>`);
      rOrient.set(rk < 3
        ? `det = 0: space is squashed onto ${['a single point', 'a line', 'a plane'][rk]} (rank ${rk}). Points pile up, so this cannot be undone.`
        : d < 0 ? 'Negative det: orientation is <b style="color:#ff9a4d">flipped</b>. i, j, k now form a left-handed set, so the cube is a mirror image (inside out).'
          : 'Positive det: orientation kept (i, j, k stay right-handed).');
    }

    // ── initial state from URL ──────────────────────────────────────────────────────────────
    const parseM = (s, o) => {
      const v = (s || '').split(',').map(Number);
      if (v.length === 9 && v.every(isFinite)) { for (let q = 0; q < 9; q++) o[q] = Math.max(-3, Math.min(3, v[q])); return true; }
      return false;
    };
    parseM(params.get('m'), A.m);
    parseM(params.get('b'), B.m);
    layoutCompose();
    if (params.get('example') === '1') loadExample(false);
    if (PRESETS[params.get('preset')]) {
      PRESETS[params.get('preset')](edit.m);
      edit.rot = params.get('preset') === 'rot' ? theta : null;
      presetMsg.set(presetNotes[params.get('preset')]);
    }
    syncInputs();
    retarget();
    if (params.has('t')) { t = Math.max(0, Math.min(1, +params.get('t') || 0)); tSl.set(t); refresh(); }
    else if (!params.has('snap')) play();

    // ── self-test ───────────────────────────────────────────────────────────────────────────
    if (params.has('selftest')) {
      const out = [];
      let fails = 0;
      const check = (name, ok, info = '') => { if (!ok) fails++; out.push(`${ok ? 'PASS' : 'FAIL'} ${name}${info ? ' ' + info : ''}`); };
      const m = new Float64Array(9), m2 = new Float64Array(9), m3 = new Float64Array(9);
      const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
      check('det I = 1', near(det3(setDiag(m, 1, 1, 1)), 1));
      check('det diag(2,3,4) = 24', near(det3(setDiag(m, 2, 3, 4)), 24));
      check('det shear = 1', near(det3(PRESETS.shear(m)), 1));
      check('det Rz(37°) = 1', near(det3(rotZ(m, 0.6457718232)), 1));
      check('det swap x,y = −1', near(det3(PRESETS.reflect(m)), -1));
      check('det project = 0', near(det3(PRESETS.project(m)), 0));
      check('det [[2,1,0],[1,3,1],[0,1,4]] = 18', near(det3(setM(m, 2, 1, 0, 1, 3, 1, 0, 1, 4)), 18));
      const L = [0, 1, 2].map(() => ({ v: new Float64Array(3), n: new Float64Array(3) }));
      // symmetric: eigenvalues 11, 2, 1; v(11) ∝ (0, 1, 2)
      let n = eigenspaces(setM(m, 2, 0, 0, 0, 3, 4, 0, 4, 9), E, L);
      check('eig [[2,0,0],[0,3,4],[0,4,9]] = 11, 2, 1', n === 3 && near(L[0].lam, 11, 1e-9) && near(L[1].lam, 2, 1e-9) && near(L[2].lam, 1, 1e-9), `got ${[0, 1, 2].map((q) => L[q].lam?.toFixed(6)).join(', ')}`);
      check('v(11) ∥ (0, 1, 2)/√5', near(L[0].v[0], 0, 1e-7) && near(L[0].v[1], 1 / Math.sqrt(5), 1e-7) && near(L[0].v[2], 2 / Math.sqrt(5), 1e-7));
      n = eigenspaces(rotZ(m, Math.PI / 2), E, L);
      check('eig Rz(90°): λ = 1 (axis) and 0 ± 1i', n === 1 && near(L[0].lam, 1, 1e-9) && near(Math.abs(L[0].v[2]), 1, 1e-9) && near(E.cRe, 0, 1e-9) && near(E.cIm, 1, 1e-9));
      n = eigenspaces(PRESETS.shear(m), E, L);
      check('eig shear: λ = 1 ×3, eigen-plane z = 0', n === 1 && L[0].mult === 3 && L[0].dim === 2 && near(Math.abs(L[0].n[2]), 1, 1e-9));
      n = eigenspaces(PRESETS.reflect(m), E, L);
      check('eig swap: plane λ = 1, line λ = −1 along (1, −1, 0)', n === 2 && L[0].dim === 2 && near(L[0].lam, 1, 1e-9) && L[1].dim === 1 && near(L[1].lam, -1, 1e-9) && near(Math.abs(L[1].v[0] * Math.SQRT2), 1, 1e-9) && near(L[1].v[0], -L[1].v[1], 1e-9));
      n = eigenspaces(setDiag(m, 2, 2, 2), E, L);
      check('eig 2I: every vector, λ = 2', n === 1 && L[0].dim === 3 && near(L[0].lam, 2, 1e-12));
      n = eigenspaces(PRESETS.project(m), E, L);
      check('eig project: plane λ = 1, line λ = 0 along z; rank 2', n === 2 && L[0].dim === 2 && L[1].lam === 0 && near(L[1].v[2], 1, 1e-9) && rank3(m) === 2);
      check('rank of [[1,2,3],[2,4,6],[1,2,3]] = 1', rank3(setM(m, 1, 2, 3, 2, 4, 6, 1, 2, 3)) === 1);
      // order matters: S·R vs R·S on i
      rotZ(m, Math.PI / 2); setDiag(m2, 2, 1, 1);
      mul3(m2, m, m3); const sr = [m3[0], m3[3], m3[6]];
      mul3(m, m2, m3); const rs = [m3[0], m3[3], m3[6]];
      check('SR·i = (0, 1, 0), RS·i = (0, 2, 0)', near(sr[0], 0, 1e-12) && near(sr[1], 1, 1e-12) && near(rs[0], 0, 1e-12) && near(rs[1], 2, 1e-12));
      // random residuals: |Av − λv| small; Σλ = trace, Πλ = det
      let worst = 0, worstTr = 0;
      for (let it = 0; it < 500; it++) {
        PRESETS.random(m);
        n = eigenspaces(m, E, L);
        for (let q = 0; q < n; q++) if (L[q].dim === 1) {
          const v = L[q].v;
          for (let r = 0; r < 3; r++) worst = Math.max(worst, Math.abs(m[r * 3] * v[0] + m[r * 3 + 1] * v[1] + m[r * 3 + 2] * v[2] - L[q].lam * v[r]));
        }
        let sum = 0, prod = 1;
        for (let q = 0; q < E.nReal; q++) { sum += E.re[q]; prod *= E.re[q]; }
        if (E.nReal === 1) { sum += 2 * E.cRe; prod *= E.cRe * E.cRe + E.cIm * E.cIm; }
        worstTr = Math.max(worstTr, Math.abs(sum - (m[0] + m[4] + m[8])), Math.abs(prod - det3(m)));
      }
      check('500 random: max |Av − λv|', worst < 1e-6, worst.toExponential(2));
      check('500 random: Σλ = trace, Πλ = det', worstTr < 1e-6, worstTr.toExponential(2));
      // the straight-line blend keeps eigenvectors: ((1−t)I + tA)v = ((1−t) + tλ)v
      setM(m, 1.5, 0.5, 0.3, 0, 0.8, 0.4, 0, 0, 1.2);
      n = eigenspaces(m, E, L);
      for (let q = 0; q < 9; q++) m2[q] = 0.37 * m[q] + (q % 4 === 0 ? 0.63 : 0);
      let bl = 0;
      for (let q = 0; q < n; q++) { const v = L[q].v, mu = 0.63 + 0.37 * L[q].lam; for (let r = 0; r < 3; r++) bl = Math.max(bl, Math.abs(m2[r * 3] * v[0] + m2[r * 3 + 1] * v[1] + m2[r * 3 + 2] * v[2] - mu * v[r])); }
      check('blend keeps eigenvectors (eig 1.5, 1.2, 0.8)', n === 3 && near(L[0].lam, 1.5, 1e-9) && near(L[1].lam, 1.2, 1e-9) && near(L[2].lam, 0.8, 1e-9) && bl < 1e-9);
      console.info(`[matrices selftest] ${fails ? fails + ' FAILED' : 'all passed'} | ` + out.join(' | '));
    }

    return {
      update(dt) {
        if (playing) {
          playU = Math.min(1, playU + dt / (compose ? DUR * 1.8 : DUR));
          if (compose) {
            // phase 1, a short hold, phase 2
            t = playU < 0.45 ? ease(playU / 0.45) * 0.5 : playU < 0.55 ? 0.5 : 0.5 + ease((playU - 0.55) / 0.45) * 0.5;
          } else t = ease(playU);
          if (playU >= 1) { playing = false; t = 1; }
          tSl.set(t);
          refresh();
        }
        detTimer += dt;
        if (detDirty && detTimer > 0.12) {
          detDirty = false; detTimer = 0;
          detLab = ctx.relabel(detLab, detText, { color: detText.includes('flipped') ? COL.flip : '#e9dcff', size: 0.8 });
        }
        detLab.visible = cubeGroup.visible;
      },
      onKey(e) {
        if (e.key === 'p' || e.key === 'P') play();
      },
      dispose() {
        ctx.renderer.localClippingEnabled = prevClip;
        shaftGeo.dispose(); headGeo.dispose(); stickGeo.dispose(); knotGeo.dispose();
      },
    };
  },
};
