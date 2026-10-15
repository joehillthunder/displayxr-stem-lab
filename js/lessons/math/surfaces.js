// Functions of Two Variables: z = f(x, y) as a glossy, height-coloured surface. Contour lines come
// from marching squares on the sample grid and are drawn on the surface and projected onto the
// floor (a contour map). Slicing planes x = a and y = b show cross-sections, and a point you can
// drag (sliders, or click the surface) carries its tangent plane, built from the exact partial
// derivatives, and the gradient arrow on the floor.
//
// Test hooks (harmless URL params): ?fn=<id> picks the function, ?slices=1 shows both planes,
// ?tour=1 starts the point moving.

const N = 120;            // grid cells per side
const HALF = 2;           // world half-width of the domain square
const Y0 = 0.6, H = 2.5;  // world height of z = zmin, and the world height of the whole z range
const FY = 0.046;         // top of the floor plate, where the contour map is drawn

const COL = { x: '#ff6b8b', y: '#6be3a4', z: '#6fb8ff', grad: '#ffd166', math: '#c38bff' };

// Number formatting with a real minus sign.
const fmt = (v, d = 2) => {
  const s = (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toFixed(d);
  return s.startsWith('-') ? '−' + s.slice(1) : s;
};
const term = (c, s) => (c < 0 ? ` − ${fmt(-c)}${s}` : ` + ${fmt(c)}${s}`);
const X = '<i>x</i>', Y = '<i>y</i>';

const FUNCS = [
  {
    id: 'paraboloid', name: 'Paraboloid', html: `${X}² + ${Y}²`, R: 2, zmin: 0, zmax: 8, step: 0.5,
    zt: [0, 2, 4, 6, 8],
    d(x, y, o) { o.f = x * x + y * y; o.fx = 2 * x; o.fy = 2 * y; o.fxx = 2; o.fyy = 2; o.fxy = 0; },
    crit: [[0, 0]],
    sx: (a) => `z = ${Y}²${term(a * a, '')}  (a parabola opening up)`,
    sy: (b) => `z = ${X}²${term(b * b, '')}  (a parabola opening up)`,
  },
  {
    id: 'saddle', name: 'Saddle', html: `${X}² − ${Y}²`, R: 2, zmin: -4, zmax: 4, step: 0.5,
    zt: [-4, -2, 0, 2, 4],
    d(x, y, o) { o.f = x * x - y * y; o.fx = 2 * x; o.fy = -2 * y; o.fxx = 2; o.fyy = -2; o.fxy = 0; },
    crit: [[0, 0]],
    sx: (a) => `z = ${fmt(a * a)} − ${Y}²  (opens down)`,
    sy: (b) => `z = ${X}² − ${fmt(b * b)}  (opens up)`,
  },
  {
    id: 'ripples', name: 'Ripples', html: `sin ${X} · cos ${Y}`, R: Math.PI, zmin: -1, zmax: 1, step: 0.2,
    zt: [-1, -0.5, 0, 0.5, 1], ticks: [[-Math.PI, '−π'], [-Math.PI / 2, '−π/2'], [0, '0'], [Math.PI / 2, 'π/2'], [Math.PI, 'π']],
    d(x, y, o) {
      const sx = Math.sin(x), cx = Math.cos(x), sy = Math.sin(y), cy = Math.cos(y);
      o.f = sx * cy; o.fx = cx * cy; o.fy = -sx * sy; o.fxx = -sx * cy; o.fyy = -sx * cy; o.fxy = -cx * sy;
    },
    crit: [[Math.PI / 2, 0], [-Math.PI / 2, 0], [0, Math.PI / 2], [0, -Math.PI / 2]],
    sx: (a) => `z = ${fmt(Math.sin(a))} · cos ${Y}`,
    sy: (b) => `z = ${fmt(Math.cos(b))} · sin ${X}`,
  },
  {
    id: 'gauss', name: 'Gaussian bump', html: `<i>e</i><sup>−(${X}² + ${Y}²)</sup>`, R: 2, zmin: 0, zmax: 1, step: 0.1,
    zt: [0, 0.25, 0.5, 0.75, 1],
    d(x, y, o) {
      const f = Math.exp(-(x * x + y * y));
      o.f = f; o.fx = -2 * x * f; o.fy = -2 * y * f;
      o.fxx = (4 * x * x - 2) * f; o.fyy = (4 * y * y - 2) * f; o.fxy = 4 * x * y * f;
    },
    crit: [[0, 0]],
    sx: (a) => `z = ${fmt(Math.exp(-a * a))} · <i>e</i><sup>−${Y}²</sup>  (a bell curve)`,
    sy: (b) => `z = ${fmt(Math.exp(-b * b))} · <i>e</i><sup>−${X}²</sup>  (a bell curve)`,
  },
  {
    id: 'plane', name: 'Plane', html: `1 + ${X}/2 − ${Y}/2`, R: 2, zmin: -1, zmax: 3, step: 0.25,
    zt: [-1, 0, 1, 2, 3],
    d(x, y, o) { o.f = 1 + x / 2 - y / 2; o.fx = 0.5; o.fy = -0.5; o.fxx = 0; o.fyy = 0; o.fxy = 0; },
    crit: [],
    sx: (a) => `z = ${fmt(1 + a / 2)} − ${Y}/2  (a line, slope −1/2)`,
    sy: (b) => `z = ${fmt(1 - b / 2)} + ${X}/2  (a line, slope 1/2)`,
  },
  {
    id: 'monkey', name: 'Monkey saddle', html: `${X}³ − 3${X}${Y}²`, R: 1.5, zmin: -6.75, zmax: 6.75, step: 1,
    zt: [-6, -3, 0, 3, 6], ticks: [[-1.5, '−1.5'], [-0.75, '−0.75'], [0, '0'], [0.75, '0.75'], [1.5, '1.5']],
    d(x, y, o) {
      o.f = x * x * x - 3 * x * y * y; o.fx = 3 * x * x - 3 * y * y; o.fy = -6 * x * y;
      o.fxx = 6 * x; o.fyy = -6 * x; o.fxy = -6 * y;
    },
    crit: [[0, 0]],
    sx: (a) => `z = ${fmt(a ** 3)}${term(-3 * a, ` ${Y}²`)}`,
    sy: (b) => `z = ${X}³${term(-3 * b * b, ` ${X}`)}`,
  },
];
const byId = Object.fromEntries(FUNCS.map((f) => [f.id, f]));

// Height colour map: deep indigo → violet → lilac → pink → amber.
const STOPS = ['#24125e', '#5b2fd0', '#9b6bff', '#e07bd0', '#ff9f7a', '#ffd166'];

export default {
  view: { dist: 9.6, yaw: 0.62, pitch: 0.42, target: [0, 1.4, 0], minDist: 4, maxDist: 18 },
  floor: true,
  explain: `
<p>A <b>function of two variables</b> takes a point (<i>x</i>, <i>y</i>) on the floor and gives back a
height <i>z</i> = <i>f</i>(<i>x</i>, <i>y</i>). Plot every point and you get a <b>surface</b>, like a
landscape. Colour shows height: dark violet is low, gold is high. (The vertical axis is scaled to fit.)</p>
<p><b>Contour lines</b> join points at the same height, like the lines on a hiking map. They are drawn
on the surface and dropped onto the floor as a <b>contour map</b>. Lines packed close together mean steep
ground. The computer finds them with <i>marching squares</i>: it checks each little grid square to see
whether the level passes between its corners.</p>
<p>A <b>cross-section</b> fixes one variable. Slicing with the plane <i>x</i> = <i>a</i> leaves a
curve <i>z</i> = <i>f</i>(<i>a</i>, <i>y</i>) of one variable that you already know how to read.</p>
<p>The slope of that slice is a <b>partial derivative</b>. ∂<i>f</i>/∂<i>x</i> is the slope if you walk
in the <i>x</i> direction with <i>y</i> held still. Both slopes together give the <b>tangent plane</b>,
the flat plane that touches the surface at your point. The <b>gradient</b> ∇<i>f</i> =
(∂<i>f</i>/∂<i>x</i>, ∂<i>f</i>/∂<i>y</i>) is the gold arrow on the floor: it points uphill the steepest
way and always crosses contour lines at right angles.</p>
<p>Where ∇<i>f</i> = 0 the tangent plane is flat: a <b>critical point</b>. The second-derivative test
uses <i>D</i> = <i>f<sub>xx</sub></i><i>f<sub>yy</sub></i> − <i>f<sub>xy</sub></i>²: <i>D</i> &gt; 0 and
<i>f<sub>xx</sub></i> &gt; 0 is a minimum, <i>D</i> &gt; 0 and <i>f<sub>xx</sub></i> &lt; 0 a maximum,
<i>D</i> &lt; 0 a saddle point, and <i>D</i> = 0 tells you nothing (try the monkey saddle).</p>
<p><b>Try it:</b> click anywhere on the surface to move the point, or press <b>Next critical point</b>.</p>`,
  formula: `<i>z</i> − <i>z</i><sub>0</sub> = <i>f<sub>x</sub></i>(<i>x</i><sub>0</sub>, <i>y</i><sub>0</sub>)(<i>x</i> − <i>x</i><sub>0</sub>) + <i>f<sub>y</sub></i>(<i>x</i><sub>0</sub>, <i>y</i><sub>0</sub>)(<i>y</i> − <i>y</i><sub>0</sub>)<br>∇<i>f</i> = ( ∂<i>f</i>/∂<i>x</i> , ∂<i>f</i>/∂<i>y</i> )`,
  vocab: [
    ['Function of two variables', 'A rule z = f(x, y) that gives one output for each input pair (x, y).'],
    ['Level curve (contour)', 'All the points where f(x, y) equals one fixed value c.'],
    ['Cross-section', 'The curve you get by cutting the surface with a plane such as x = a.'],
    ['Partial derivative', '∂f/∂x is the rate of change of f in the x direction with y held constant.'],
    ['Tangent plane', 'The plane that just touches the surface at a point and has the same slopes there.'],
    ['Gradient ∇f', 'The vector (∂f/∂x, ∂f/∂y). It points in the direction of steepest increase; its length is that steepest slope.'],
    ['Critical point', 'A point where ∇f = 0: a maximum, a minimum, a saddle point, or a flat spot the test cannot decide.'],
    ['Saddle point', 'A critical point that is a minimum along one direction and a maximum along another.'],
  ],
  quiz: [
    {
      q: 'What do the level curves of f(x, y) = x² + y² look like?',
      choices: ['Parallel straight lines', 'Circles centred on the origin', 'Parabolas', 'Hyperbolas'],
      answer: 1,
      why: 'x² + y² = c is a circle of radius √c centred at (0, 0), for every c > 0.',
    },
    {
      q: 'For f(x, y) = x² + y², what is ∂f/∂y at the point (1, 2)?',
      choices: ['2', '4', '5', '6'],
      answer: 1,
      why: 'Hold x fixed and differentiate in y: ∂f/∂y = 2y, and 2 × 2 = 4.',
    },
    {
      q: 'The gradient ∇f at a point on a contour map points…',
      choices: ['along the contour line', 'in the direction of steepest increase, perpendicular to the contour', 'straight down the surface', 'toward the origin'],
      answer: 1,
      why: 'Moving along a contour does not change f, so the steepest climb is at right angles to it. That is the gradient direction.',
    },
    {
      q: 'f(x, y) = x² − y² has ∇f = 0 at (0, 0), with fxx = 2, fyy = −2, fxy = 0. What kind of point is it?',
      choices: ['A local minimum', 'A local maximum', 'A saddle point', 'The test is inconclusive'],
      answer: 2,
      why: 'D = fxx·fyy − fxy² = (2)(−2) − 0 = −4 < 0, which means a saddle point: up along x, down along y.',
    },
    {
      q: 'On a contour map with equally spaced levels, where are the contour lines closest together?',
      choices: ['Where the surface is flattest', 'Where the surface is steepest', 'Only at a maximum', 'Only at a saddle point'],
      answer: 1,
      why: 'Close lines mean the height changes by a full step over a short distance: a large slope, so a large |∇f|.',
    },
  ],

  build(ctx) {
    const { THREE, root, ui } = ctx;
    const V3 = THREE.Vector3;
    const params = new URLSearchParams(location.search);

    // ── state ────────────────────────────────────────────────────────────────────────────────
    let F = byId[params.get('fn')] || FUNCS[0];
    let s = HALF / F.R;                       // world units per math unit (horizontal)
    let k = H / (F.zmax - F.zmin);            // world units per math unit (vertical)
    const vals = new Float32Array((N + 1) * (N + 1));
    const D = { f: 0, fx: 0, fy: 0, fxx: 0, fyy: 0, fxy: 0 };
    const pt = { x: 1, y: 0.8 };
    const slice = { a: 0.5, b: -0.5, showA: params.get('slices') === '1', showB: params.get('slices') === '1' };
    let tour = params.get('tour') === '1', tourT = 0, critIdx = -1;

    const wY = (z) => Y0 + k * (z - F.zmin);
    // Right-handed, textbook layout: math x comes toward the viewer (world +z), y goes right (world +x), z is up.
    const toWorld = (x, y, z, out) => out.set(s * y, wY(z), s * x);

    // ── materials ────────────────────────────────────────────────────────────────────────────
    const glow = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, ...extra });
    const gridTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, 128, 128);
      g.fillStyle = 'rgba(30,20,60,0.55)';
      g.fillRect(0, 0, 128, 3);
      g.fillRect(0, 0, 3, 128);
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(16, 16);
      t.anisotropy = 8;
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const surfMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true, map: gridTex, side: THREE.DoubleSide, roughness: 0.4, metalness: 0,
      clearcoat: 0.8, clearcoatRoughness: 0.2, envMapIntensity: 0.45,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    });

    // ── surface mesh (positions/normals/colours rewritten when the function changes) ────────
    const NV = (N + 1) * (N + 1);
    const sGeo = new THREE.BufferGeometry();
    const sPos = new Float32Array(NV * 3), sNor = new Float32Array(NV * 3), sCol = new Float32Array(NV * 3), sUv = new Float32Array(NV * 2);
    const sIdx = new Uint32Array(N * N * 6);
    for (let j = 0, q = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
      sIdx[q++] = a; sIdx[q++] = b; sIdx[q++] = d; sIdx[q++] = a; sIdx[q++] = d; sIdx[q++] = c;
    }
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { const v = j * (N + 1) + i; sUv[v * 2] = i / N; sUv[v * 2 + 1] = j / N; }
    sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    sGeo.setAttribute('normal', new THREE.BufferAttribute(sNor, 3));
    sGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
    sGeo.setAttribute('uv', new THREE.BufferAttribute(sUv, 2));
    sGeo.setIndex(new THREE.BufferAttribute(sIdx, 1));
    const surface = new THREE.Mesh(sGeo, surfMat);
    surface.castShadow = true;
    root.add(surface);

    const stops = STOPS.map((h) => new THREE.Color(h));
    const heat = (t, out) => {
      t = Math.min(1, Math.max(0, t)) * (stops.length - 1);
      const i = Math.min(stops.length - 2, Math.floor(t));
      return out.copy(stops[i]).lerp(stops[i + 1], t - i);
    };

    // Boundary of the surface: a glowing rim.
    const rimPts = new Float32Array((4 * N + 1) * 3);
    const rimGeo = new THREE.BufferGeometry();
    rimGeo.setAttribute('position', new THREE.BufferAttribute(rimPts, 3));
    const rim = new THREE.Line(rimGeo, new THREE.LineBasicMaterial({ color: COL.math, toneMapped: false }));
    root.add(rim);

    // ── floor plate, grid, axes ──────────────────────────────────────────────────────────────
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(HALF * 2 + 0.5, 0.04, HALF * 2 + 0.5),
      new THREE.MeshPhysicalMaterial({ color: 0x0c1122, roughness: 0.42, metalness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.3 }),
    );
    plate.position.y = FY - 0.02;
    plate.receiveShadow = true;
    root.add(plate);
    const grid = new THREE.GridHelper(HALF * 2, 16, 0x3a3f66, 0x262a48);
    grid.position.y = FY + 0.001;
    grid.material.transparent = true;
    grid.material.opacity = 0.55;
    root.add(grid);
    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(HALF * 2, HALF * 2)).rotateX(-Math.PI / 2),
      new THREE.LineBasicMaterial({ color: COL.math, transparent: true, opacity: 0.6, toneMapped: false }),
    );
    frame.position.y = FY + 0.002;
    root.add(frame);

    const shaftGeo = new THREE.CylinderGeometry(1, 1, 1, 12).translate(0, 0.5, 0);
    const headGeo = new THREE.ConeGeometry(1, 1, 18).translate(0, 0.5, 0);
    const UP = new V3(0, 1, 0);
    const arrow = (color, r = 0.014) => {
      const g = new THREE.Group();
      const m = glow(color);
      const shaft = new THREE.Mesh(shaftGeo, m), head = new THREE.Mesh(headGeo, m);
      g.add(shaft, head);
      g.userData = { shaft, head, r };
      return g;
    };
    const _d = new V3();
    const aimArrow = (g, from, dir, len, headLen = 0.16) => {
      const { shaft, head, r } = g.userData;
      g.position.copy(from);
      g.quaternion.setFromUnitVectors(UP, _d.copy(dir).normalize());
      const sl = Math.max(0.001, len - headLen);
      shaft.scale.set(r, sl, r);
      head.scale.set(r * 4, headLen, r * 4);
      head.position.y = sl;
    };
    const xAxis = arrow(COL.x), yAxis = arrow(COL.y), zAxis = arrow(COL.z, 0.012);
    root.add(xAxis, yAxis, zAxis);
    aimArrow(xAxis, new V3(0, FY + 0.01, -HALF - 0.15), new V3(0, 0, 1), HALF * 2 + 0.55);
    aimArrow(yAxis, new V3(-HALF - 0.15, FY + 0.01, 0), new V3(1, 0, 0), HALF * 2 + 0.55);
    const zx = -HALF - 0.25, zz = -HALF - 0.25;
    aimArrow(zAxis, new V3(zx, FY, zz), UP, Y0 + H + 0.45);
    const axisLabel = (t, c, x, y, z) => { const l = ctx.label(t, { color: c, size: 0.95 }); l.position.set(x, y, z); root.add(l); return l; };
    axisLabel('x', COL.x, 0, FY + 0.05, HALF + 0.6);
    axisLabel('y', COL.y, HALF + 0.6, FY + 0.05, 0);
    axisLabel('z', COL.z, zx, Y0 + H + 0.55, zz);

    // Tick marks + labels (rebuilt when the function changes).
    const tickMat = new THREE.LineBasicMaterial({ color: 0x9aa3c7, transparent: true, opacity: 0.8 });
    const tickGeo = new THREE.BufferGeometry();
    const tickPos = new Float32Array(15 * 2 * 3);
    tickGeo.setAttribute('position', new THREE.BufferAttribute(tickPos, 3));
    root.add(new THREE.LineSegments(tickGeo, tickMat));
    let tickLabels = [];

    // ── contour lines (marching squares) ─────────────────────────────────────────────────────
    // Segments are emitted in grid coordinates (gi, gj) into `out` (4 floats per segment).
    function march(level, out, start, cap) {
      let n = start;
      const W = N + 1;
      const ex = [0, 0, 0, 0], ey = [0, 0, 0, 0], cut = [false, false, false, false];
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const v0 = vals[j * W + i], v1 = vals[j * W + i + 1], v2 = vals[(j + 1) * W + i + 1], v3 = vals[(j + 1) * W + i];
        const a0 = v0 >= level, a1 = v1 >= level, a2 = v2 >= level, a3 = v3 >= level;
        if (a0 === a1 && a1 === a2 && a2 === a3) continue;
        // e0: v0-v1 (bottom), e1: v1-v2 (right), e2: v3-v2 (top), e3: v0-v3 (left)
        cut[0] = a0 !== a1; cut[1] = a1 !== a2; cut[2] = a3 !== a2; cut[3] = a0 !== a3;
        if (cut[0]) { ex[0] = i + (level - v0) / (v1 - v0); ey[0] = j; }
        if (cut[1]) { ex[1] = i + 1; ey[1] = j + (level - v1) / (v2 - v1); }
        if (cut[2]) { ex[2] = i + (level - v3) / (v2 - v3); ey[2] = j + 1; }
        if (cut[3]) { ex[3] = i; ey[3] = j + (level - v0) / (v3 - v0); }
        const emit = (p, q) => {
          if (n + 4 > cap) return;
          out[n++] = ex[p]; out[n++] = ey[p]; out[n++] = ex[q]; out[n++] = ey[q];
        };
        if (cut[0] && cut[1] && cut[2] && cut[3]) {
          // Ambiguous saddle cell: cut off the corners that disagree with the cell centre.
          const c = (v0 + v1 + v2 + v3) / 4 >= level;
          if (a0 !== c) emit(3, 0);
          if (a1 !== c) emit(0, 1);
          if (a2 !== c) emit(1, 2);
          if (a3 !== c) emit(2, 3);
        } else {
          let p = -1;
          for (let e = 0; e < 4; e++) if (cut[e]) { if (p < 0) p = e; else emit(p, e); }
        }
      }
      return n;
    }
    const gx = (g) => -F.R + (2 * F.R * g) / N; // grid → math

    const CAP = 120000; // floats of grid-coordinate segments for all levels
    const segBuf = new Float32Array(CAP);
    const segLevel = new Float32Array(CAP / 4);
    const cPosS = new Float32Array((CAP / 4) * 6), cPosF = new Float32Array((CAP / 4) * 6), cCol = new Float32Array((CAP / 4) * 6);
    const cGeoS = new THREE.BufferGeometry(), cGeoF = new THREE.BufferGeometry();
    cGeoS.setAttribute('position', new THREE.BufferAttribute(cPosS, 3));
    cGeoF.setAttribute('position', new THREE.BufferAttribute(cPosF, 3));
    cGeoF.setAttribute('color', new THREE.BufferAttribute(cCol, 3));
    const contoursS = new THREE.LineSegments(cGeoS, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, toneMapped: false }));
    const contoursF = new THREE.LineSegments(cGeoF, new THREE.LineBasicMaterial({ vertexColors: true, toneMapped: false }));
    contoursS.frustumCulled = contoursF.frustumCulled = false;
    contoursS.renderOrder = 2;
    root.add(contoursS, contoursF);

    // The level curve through the point, highlighted (recomputed when the point moves).
    const HCAP = 24000;
    const hSeg = new Float32Array(HCAP);
    const hPosS = new Float32Array((HCAP / 4) * 6), hPosF = new Float32Array((HCAP / 4) * 6);
    const hGeoS = new THREE.BufferGeometry(), hGeoF = new THREE.BufferGeometry();
    hGeoS.setAttribute('position', new THREE.BufferAttribute(hPosS, 3).setUsage(THREE.DynamicDrawUsage));
    hGeoF.setAttribute('position', new THREE.BufferAttribute(hPosF, 3).setUsage(THREE.DynamicDrawUsage));
    const hMat = new THREE.LineBasicMaterial({ color: COL.grad, toneMapped: false });
    const levelS = new THREE.LineSegments(hGeoS, hMat), levelF = new THREE.LineSegments(hGeoF, hMat);
    levelS.frustumCulled = levelF.frustumCulled = false;
    levelS.renderOrder = levelF.renderOrder = 3;
    root.add(levelS, levelF);

    // ── tubes (slice curves) ─────────────────────────────────────────────────────────────────
    function makeTube(maxPts, radial, radius, material) {
      const W = radial + 1;
      const pos = new Float32Array(maxPts * W * 3), nor = new Float32Array(maxPts * W * 3);
      const idx = new Uint32Array((maxPts - 1) * radial * 6);
      for (let i = 0, q = 0; i < maxPts - 1; i++) for (let j = 0; j < radial; j++) {
        const a = i * W + j, b = a + W;
        idx[q++] = a; idx[q++] = b; idx[q++] = a + 1; idx[q++] = b; idx[q++] = b + 1; idx[q++] = a + 1;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      const mesh = new THREE.Mesh(geo, material);
      mesh.frustumCulled = false;
      const T = new V3(), Nn = new V3(), B = new V3(), P = new V3(), A = new V3(), Bp = new V3();
      return {
        mesh,
        set(pts, count) {
          for (let i = 0; i < count; i++) {
            const i0 = Math.max(0, i - 1), i1 = Math.min(count - 1, i + 1);
            A.fromArray(pts, i0 * 3); Bp.fromArray(pts, i1 * 3);
            T.subVectors(Bp, A).normalize();
            if (i === 0) {
              Nn.set(Math.abs(T.x) < 0.9 ? 1 : 0, Math.abs(T.x) < 0.9 ? 0 : 1, 0);
            }
            Nn.addScaledVector(T, -Nn.dot(T));
            if (Nn.lengthSq() < 1e-10) Nn.set(-T.y, T.x, 0).lengthSq() < 1e-10 && Nn.set(0, -T.z, T.y);
            Nn.normalize();
            B.crossVectors(T, Nn);
            P.fromArray(pts, i * 3);
            for (let j = 0; j <= radial; j++) {
              const ang = (j / radial) * Math.PI * 2, c = Math.cos(ang), sn = Math.sin(ang);
              const nx = Nn.x * c + B.x * sn, ny = Nn.y * c + B.y * sn, nz = Nn.z * c + B.z * sn;
              const o = (i * W + j) * 3;
              nor[o] = nx; nor[o + 1] = ny; nor[o + 2] = nz;
              pos[o] = P.x + nx * radius; pos[o + 1] = P.y + ny * radius; pos[o + 2] = P.z + nz * radius;
            }
          }
          geo.attributes.position.needsUpdate = true;
          geo.attributes.normal.needsUpdate = true;
          geo.setDrawRange(0, Math.max(0, count - 1) * radial * 6);
        },
      };
    }

    // ── slicing planes ───────────────────────────────────────────────────────────────────────
    const SM = 160;
    const slicePts = new Float32Array(SM * 3);
    const planeH = Y0 + H + 0.35;
    const makeSlice = (color, rotY) => {
      const g = new THREE.Group();
      const sheet = new THREE.Mesh(
        new THREE.PlaneGeometry(HALF * 2, planeH),
        new THREE.MeshPhysicalMaterial({ color, transparent: true, opacity: 0.13, roughness: 0.15, metalness: 0, depthWrite: false, side: THREE.DoubleSide }),
      );
      sheet.position.y = planeH / 2;
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(HALF * 2, planeH)), new THREE.LineBasicMaterial({ color, toneMapped: false, transparent: true, opacity: 0.85 }));
      edge.position.y = planeH / 2;
      const inner = new THREE.Group();
      inner.rotation.y = rotY;
      inner.add(sheet, edge);
      const tube = makeTube(SM, 10, 0.03, glow(color));
      const lab = ctx.label('', { color, size: 0.85 });
      lab.position.y = planeH + 0.1;
      g.add(inner, lab);
      root.add(g, tube.mesh);
      return { g, tube, lab, color };
    };
    const sliceA = makeSlice(COL.x, 0);           // x = a: plane spans the y (world x) direction
    const sliceB = makeSlice(COL.y, Math.PI / 2); // y = b: plane spans the x (world z) direction
    const tw = new V3();
    function updateSlices() {
      sliceA.g.visible = sliceA.tube.mesh.visible = slice.showA;
      sliceB.g.visible = sliceB.tube.mesh.visible = slice.showB;
      if (slice.showA) {
        sliceA.g.position.set(0, 0, s * slice.a);
        for (let i = 0; i < SM; i++) {
          const y = -F.R + (2 * F.R * i) / (SM - 1);
          F.d(slice.a, y, D);
          toWorld(slice.a, y, D.f, tw).toArray(slicePts, i * 3);
        }
        sliceA.tube.set(slicePts, SM);
        sliceA.lab = ctx.relabel(sliceA.lab, `x = ${fmt(slice.a)}`, { color: COL.x, size: 0.85 });
        sliceA.lab.position.set(-HALF, planeH + 0.1, 0);
      }
      if (slice.showB) {
        sliceB.g.position.set(s * slice.b, 0, 0);
        for (let i = 0; i < SM; i++) {
          const x = -F.R + (2 * F.R * i) / (SM - 1);
          F.d(x, slice.b, D);
          toWorld(x, slice.b, D.f, tw).toArray(slicePts, i * 3);
        }
        sliceB.tube.set(slicePts, SM);
        sliceB.lab = ctx.relabel(sliceB.lab, `y = ${fmt(slice.b)}`, { color: COL.y, size: 0.85 });
        sliceB.lab.position.set(0, planeH + 0.1, -HALF);
      }
      rSliceA.set(slice.showA ? F.sx(slice.a) : '—');
      rSliceB.set(slice.showB ? F.sy(slice.b) : '—');
    }

    // ── the point, tangent plane, gradient ───────────────────────────────────────────────────
    const ballMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, emissive: COL.grad, emissiveIntensity: 0.6, roughness: 0.15, clearcoat: 1 });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.075, 32, 20), ballMat);
    ball.castShadow = true;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 28), glow(COL.grad));
    const dropGeo = new THREE.BufferGeometry();
    const dropPos = new Float32Array(6);
    dropGeo.setAttribute('position', new THREE.BufferAttribute(dropPos, 3));
    const drop = new THREE.Line(dropGeo, new THREE.LineDashedMaterial({ color: COL.grad, dashSize: 0.08, gapSize: 0.06, toneMapped: false }));
    drop.frustumCulled = false;
    root.add(ball, foot, drop);

    const tpGeo = new THREE.BufferGeometry();
    const tpPos = new Float32Array(12), tpNor = new Float32Array(12);
    tpGeo.setAttribute('position', new THREE.BufferAttribute(tpPos, 3));
    tpGeo.setAttribute('normal', new THREE.BufferAttribute(tpNor, 3));
    tpGeo.setIndex([0, 1, 2, 0, 2, 3]);
    const tangent = new THREE.Group();
    const tpMesh = new THREE.Mesh(tpGeo, new THREE.MeshPhysicalMaterial({
      color: '#7fe3ff', transparent: true, opacity: 0.38, roughness: 0.1, metalness: 0.1, clearcoat: 1,
      side: THREE.DoubleSide, depthWrite: false, emissive: '#3fb6ff', emissiveIntensity: 0.35,
    }));
    tpMesh.renderOrder = 4;
    const tpEdgeGeo = new THREE.BufferGeometry();
    const tpEdge = new Float32Array(15);
    tpEdgeGeo.setAttribute('position', new THREE.BufferAttribute(tpEdge, 3));
    const tpLine = new THREE.Line(tpEdgeGeo, new THREE.LineBasicMaterial({ color: '#bff3ff', toneMapped: false }));
    tpMesh.frustumCulled = tpLine.frustumCulled = false;
    const stickGeo = new THREE.CylinderGeometry(1, 1, 1, 10);
    const stickX = new THREE.Mesh(stickGeo, glow(COL.x)), stickY = new THREE.Mesh(stickGeo, glow(COL.y));
    tangent.add(tpMesh, tpLine, stickX, stickY);
    root.add(tangent);
    const stick = (m, a, b, r) => {
      _d.subVectors(b, a);
      const L = _d.length();
      m.position.addVectors(a, b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(UP, _d.multiplyScalar(1 / Math.max(L, 1e-9)));
      m.scale.set(r, L, r);
    };

    const gradArrow = arrow(COL.grad, 0.022);
    const gradLab = ctx.label('∇f', { color: COL.grad, size: 0.85 });
    root.add(gradArrow, gradLab);

    const P0 = new V3(), Px = new V3(), Py = new V3(), Nrm = new V3(), c0 = new V3(), c1 = new V3(), gdir = new V3(), base = new V3();
    function setPoint(x, y) {
      pt.x = Math.max(-F.R, Math.min(F.R, x));
      pt.y = Math.max(-F.R, Math.min(F.R, y));
      F.d(pt.x, pt.y, D);
      const { f, fx, fy } = D;
      toWorld(pt.x, pt.y, f, P0);
      ball.position.copy(P0);
      foot.position.set(P0.x, FY + 0.006, P0.z);
      dropPos[0] = P0.x; dropPos[1] = P0.y; dropPos[2] = P0.z;
      dropPos[3] = P0.x; dropPos[4] = FY; dropPos[5] = P0.z;
      dropGeo.attributes.position.needsUpdate = true;
      drop.computeLineDistances();

      // Tangent plane: P0 + u·∂P/∂x + v·∂P/∂y (world scaling applied to the exact partials).
      Px.set(0, k * fx, s);
      Py.set(s, k * fy, 0);
      Nrm.set(-k * fy, s, -k * fx).normalize();
      const hm = 0.3 * F.R;
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (let c = 0; c < 4; c++) {
        c0.copy(P0).addScaledVector(Px, corners[c][0] * hm).addScaledVector(Py, corners[c][1] * hm);
        c0.toArray(tpPos, c * 3);
        Nrm.toArray(tpNor, c * 3);
        c0.toArray(tpEdge, c * 3);
      }
      tpEdge[12] = tpPos[0]; tpEdge[13] = tpPos[1]; tpEdge[14] = tpPos[2];
      tpGeo.attributes.position.needsUpdate = true;
      tpGeo.attributes.normal.needsUpdate = true;
      tpEdgeGeo.attributes.position.needsUpdate = true;
      c0.copy(P0).addScaledVector(Px, -hm * 1.25); c1.copy(P0).addScaledVector(Px, hm * 1.25);
      stick(stickX, c0, c1, 0.011);
      c0.copy(P0).addScaledVector(Py, -hm * 1.25); c1.copy(P0).addScaledVector(Py, hm * 1.25);
      stick(stickY, c0, c1, 0.011);

      // Gradient on the floor: math (fx, fy) → world (fx, 0, −fy).
      const g = Math.hypot(fx, fy);
      const gref = (F.zmax - F.zmin) / (2 * F.R);
      gradArrow.visible = gradLab.visible = showGrad && g > 1e-4;
      if (g > 1e-4) {
        const L = 0.25 + 1.35 * Math.tanh(g / (1.4 * gref));
        gdir.set(fy, 0, fx).normalize();
        base.set(P0.x, FY + 0.03, P0.z);
        aimArrow(gradArrow, base, gdir, L, 0.2);
        gradLab.position.copy(base).addScaledVector(gdir, L + 0.18);
        gradLab.position.y += 0.05;
      }

      // Level curve through the point.
      const n = march(f, hSeg, 0, HCAP);
      const yS = wY(f);
      for (let q = 0, o = 0; q < n; q += 2, o += 3) {
        const mx = gx(hSeg[q]), my = gx(hSeg[q + 1]);
        hPosS[o] = s * my; hPosS[o + 1] = yS; hPosS[o + 2] = s * mx;
        hPosF[o] = s * my; hPosF[o + 1] = FY + 0.004; hPosF[o + 2] = s * mx;
      }
      hGeoS.setDrawRange(0, n / 2); hGeoF.setDrawRange(0, n / 2);
      hGeoS.attributes.position.needsUpdate = true;
      hGeoF.attributes.position.needsUpdate = true;
      levelS.visible = showLevel && showSurfC;
      levelF.visible = showLevel && showFloorC;

      // Readouts.
      rPoint.set(`(${fmt(pt.x)}, ${fmt(pt.y)})`);
      rF.set(fmt(f, 3));
      rFx.set(`<span style="color:${COL.x}">${fmt(fx, 3)}</span>`);
      rFy.set(`<span style="color:${COL.y}">${fmt(fy, 3)}</span>`);
      rG.set(`<span style="color:${COL.grad}">${fmt(g, 3)}</span>`);
      rTP.set(`Tangent plane: z = ${fmt(f)}${term(fx, `(x${term(-pt.x, '')})`)}${term(fy, `(y${term(-pt.y, '')})`)}`.replace(/<[^>]+>/g, ''));
      let cls;
      if (g < 0.02) {
        const Dd = D.fxx * D.fyy - D.fxy * D.fxy;
        const tag = `D = ${fmt(Dd)}, f<sub>xx</sub> = ${fmt(D.fxx)}`;
        if (Math.abs(Dd) < 1e-3) cls = `<b>Critical point</b>, test inconclusive (${tag})`;
        else if (Dd < 0) cls = `<b>Saddle point</b> (${tag} → D &lt; 0)`;
        else if (D.fxx > 0) cls = `<b>Local minimum</b> (${tag})`;
        else cls = `<b>Local maximum</b> (${tag})`;
        ballMat.emissive.set('#ffffff');
      } else {
        cls = `Not critical: ∇f ≠ 0, so the surface tilts here`;
        ballMat.emissive.set(COL.grad);
      }
      rClass.set(cls);
    }

    // ── rebuild everything for a new function ────────────────────────────────────────────────
    const tmpC = new THREE.Color();
    function setFunction(fn) {
      F = fn;
      s = HALF / F.R;
      k = H / (F.zmax - F.zmin);
      const W = N + 1;
      for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
        const x = gx(i), y = gx(j), v = j * W + i;
        F.d(x, y, D);
        vals[v] = D.f;
        sPos[v * 3] = s * y; sPos[v * 3 + 1] = wY(D.f); sPos[v * 3 + 2] = s * x;
        Nrm.set(-k * D.fy, s, -k * D.fx).normalize();
        sNor[v * 3] = Nrm.x; sNor[v * 3 + 1] = Nrm.y; sNor[v * 3 + 2] = Nrm.z;
        heat((D.f - F.zmin) / (F.zmax - F.zmin), tmpC);
        sCol[v * 3] = tmpC.r; sCol[v * 3 + 1] = tmpC.g; sCol[v * 3 + 2] = tmpC.b;
      }
      for (const a of ['position', 'normal', 'color']) sGeo.attributes[a].needsUpdate = true;
      sGeo.computeBoundingSphere();

      // Rim.
      let r = 0;
      const rimAt = (i, j) => { const v = j * W + i; rimPts[r++] = sPos[v * 3]; rimPts[r++] = sPos[v * 3 + 1]; rimPts[r++] = sPos[v * 3 + 2]; };
      for (let i = 0; i < N; i++) rimAt(i, 0);
      for (let j = 0; j < N; j++) rimAt(N, j);
      for (let i = N; i > 0; i--) rimAt(i, N);
      for (let j = N; j >= 0; j--) rimAt(0, j);
      rimGeo.attributes.position.needsUpdate = true;
      rimGeo.computeBoundingSphere();

      // Contours at every multiple of `step` strictly inside (zmin, zmax).
      let n = 0;
      for (let L = Math.ceil((F.zmin + 1e-9) / F.step) * F.step; L < F.zmax - 1e-9; L += F.step) {
        const lv = Math.abs(L) < 1e-9 ? 1e-7 : L; // nudge 0 off exact grid zeros
        const before = n;
        n = march(lv, segBuf, n, CAP);
        for (let q = before / 4; q < n / 4; q++) segLevel[q] = L;
      }
      for (let q = 0; q < n / 4; q++) {
        const L = segLevel[q], yS = wY(L);
        heat((L - F.zmin) / (F.zmax - F.zmin), tmpC);
        tmpC.offsetHSL(0, 0, 0.12);
        for (let e = 0; e < 2; e++) {
          const mx = gx(segBuf[q * 4 + e * 2]), my = gx(segBuf[q * 4 + e * 2 + 1]), o = q * 6 + e * 3;
          cPosS[o] = s * my; cPosS[o + 1] = yS; cPosS[o + 2] = s * mx;
          cPosF[o] = s * my; cPosF[o + 1] = FY + 0.003; cPosF[o + 2] = s * mx;
          cCol[o] = tmpC.r; cCol[o + 1] = tmpC.g; cCol[o + 2] = tmpC.b;
        }
      }
      cGeoS.setDrawRange(0, n / 2); cGeoF.setDrawRange(0, n / 2);
      cGeoS.attributes.position.needsUpdate = true;
      cGeoF.attributes.position.needsUpdate = true;
      cGeoF.attributes.color.needsUpdate = true;

      // Ticks and labels.
      const ticks = F.ticks || [-2, -1, 0, 1, 2].map((v) => [v * F.R / 2, fmt(v * F.R / 2, Number.isInteger(v * F.R / 2) ? 0 : 1)]);
      let t = 0;
      const seg = (x0, y0, z0, x1, y1, z1) => { tickPos.set([x0, y0, z0, x1, y1, z1], t); t += 6; };
      let li = 0;
      const lab = (txt, c, x, y, z, size = 0.72) => {
        const opts = { color: c, size, bold: false };
        let l = tickLabels[li];
        if (!l) { l = ctx.label(txt, opts); root.add(l); tickLabels.push(l); } else if (l.userData.txt !== txt || l.userData.c !== c) l = tickLabels[li] = ctx.relabel(l, txt, opts);
        l.userData.txt = txt; l.userData.c = c;
        l.visible = true;
        l.position.set(x, y, z);
        li++;
      };
      for (const [v, txt] of ticks) {
        seg(HALF, FY + 0.005, s * v, HALF + 0.12, FY + 0.005, s * v);
        lab(txt, '#ffc2cf', HALF + 0.36, FY, s * v);
        seg(s * v, FY + 0.005, HALF, s * v, FY + 0.005, HALF + 0.12);
        lab(txt, '#c4f5da', s * v, FY, HALF + 0.3);
      }
      for (const v of F.zt) {
        const y = wY(v);
        seg(zx, y, zz, zx + 0.14, y, zz + 0.14);
        lab(fmt(v, Number.isInteger(v) ? 0 : 2), '#c9e2ff', zx - 0.3, y - 0.1, zz);
      }
      tickPos.fill(0, t);
      for (let q = li; q < tickLabels.length; q++) tickLabels[q].visible = false;
      tickGeo.attributes.position.needsUpdate = true;
      tickGeo.computeBoundingSphere();

      // Sliders follow the new domain.
      for (const sl of [sX, sY, sA, sB]) {
        const inp = sl.el.querySelector('input');
        inp.min = -F.R; inp.max = F.R; inp.step = F.R / 100;
      }
      critIdx = -1;
      slice.a = Math.max(-F.R, Math.min(F.R, slice.a));
      slice.b = Math.max(-F.R, Math.min(F.R, slice.b));
      sA.set(slice.a); sB.set(slice.b);
      rFn.set(`z = ${F.html}`);
      setPoint(pt.x * F.R / prevR, pt.y * F.R / prevR);
      sX.set(pt.x); sY.set(pt.y);
      prevR = F.R;
      updateSlices();
    }
    let prevR = F.R;

    // ── controls ─────────────────────────────────────────────────────────────────────────────
    let showGrad = true, showLevel = true, showSurfC = true, showFloorC = true;
    ui.select('Function', { options: FUNCS.map((f) => ({ value: f.id, label: `${f.name}` })), value: F.id, onChange: (v) => setFunction(byId[v]) });
    const rFn = ui.readout('Surface', '');
    ui.heading('Point (click the surface to move it)');
    const sX = ui.slider('x₀', { min: -F.R, max: F.R, step: F.R / 100, value: pt.x, fmt: (v) => fmt(v), onChange: (v) => { tour = false; tTour.set(false); setPoint(v, pt.y); } });
    const sY = ui.slider('y₀', { min: -F.R, max: F.R, step: F.R / 100, value: pt.y, fmt: (v) => fmt(v), onChange: (v) => { tour = false; tTour.set(false); setPoint(pt.x, v); } });
    ui.button('Next critical point', () => {
      if (!F.crit.length) { ctx.toast('A tilted plane has no critical points: ∇f is never 0.'); return; }
      tour = false; tTour.set(false);
      critIdx = (critIdx + 1) % F.crit.length;
      const [cx, cy] = F.crit[critIdx];
      setPoint(cx, cy); sX.set(cx); sY.set(cy);
    }, { primary: true });
    const tTour = ui.toggle('Tour: move the point round a circle', { value: tour, onChange: (v) => (tour = v) });
    const rPoint = ui.readout('(x₀, y₀)');
    const rF = ui.readout('f(x₀, y₀)');
    const rFx = ui.readout('∂f/∂x');
    const rFy = ui.readout('∂f/∂y');
    const rG = ui.readout('|∇f|');
    const rClass = ui.note('');
    const rTP = ui.note('');
    ui.heading('Show');
    ui.toggle('Tangent plane', { value: true, onChange: (v) => (tangent.visible = v) });
    ui.toggle('Gradient arrow', { value: true, onChange: (v) => { showGrad = v; setPoint(pt.x, pt.y); } });
    ui.toggle('Contours on surface', { value: true, onChange: (v) => { showSurfC = contoursS.visible = v; setPoint(pt.x, pt.y); } });
    ui.toggle('Contour map on floor', { value: true, onChange: (v) => { showFloorC = contoursF.visible = v; setPoint(pt.x, pt.y); } });
    ui.toggle('Level curve through the point', { value: true, onChange: (v) => { showLevel = v; setPoint(pt.x, pt.y); } });
    ui.heading('Cross-sections');
    const tA = ui.toggle('Slice x = a', { value: slice.showA, onChange: (v) => { slice.showA = v; updateSlices(); } });
    const sA = ui.slider('a', { min: -F.R, max: F.R, step: F.R / 100, value: slice.a, fmt: (v) => fmt(v), onChange: (v) => { slice.a = v; slice.showA = true; tA.set(true); updateSlices(); } });
    const rSliceA = ui.readout('x = a slice', '—');
    const tB = ui.toggle('Slice y = b', { value: slice.showB, onChange: (v) => { slice.showB = v; updateSlices(); } });
    const sB = ui.slider('b', { min: -F.R, max: F.R, step: F.R / 100, value: slice.b, fmt: (v) => fmt(v), onChange: (v) => { slice.b = v; slice.showB = true; tB.set(true); updateSlices(); } });
    const rSliceB = ui.readout('y = b slice', '—');

    ctx.pickable(surface, (hit) => {
      tour = false; tTour.set(false);
      setPoint(hit.point.z / s, hit.point.x / s);
      sX.set(pt.x); sY.set(pt.y);
    });

    setFunction(F);
    snapView(this.view, params);

    return {
      update(dt) {
        if (!tour) return;
        tourT += dt * 0.45;
        const r = 0.62 * F.R;
        setPoint(r * Math.cos(tourT), r * Math.sin(tourT) * 0.85);
        sX.set(pt.x); sY.set(pt.y);
      },
      dispose() { gridTex.dispose(); shaftGeo.dispose(); headGeo.dispose(); stickGeo.dispose(); },
    };
  },
};

/** Test hook: ?snap jumps the camera straight to the lesson view (headless screenshots run only a
 *  few frames, so the eased camera would not arrive). Harmless in normal use. */
function snapView(v, params) {
  const sv = window.stem?.view;
  if (!params.has('snap') || !sv) return;
  sv.goal = null;
  Object.assign(sv, { yaw: v.yaw, pitch: v.pitch, dist: v.dist });
  sv.target.fromArray(v.target);
}
