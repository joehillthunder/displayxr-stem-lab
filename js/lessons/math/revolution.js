// Solids of Revolution. A region under y = f(x) on [a, b] spins round the x-axis into a glossy
// translucent solid (sweep angle 0 → 360°). The disc / washer view slices it into n cylinders whose
// volumes π·(R² − r²)·Δx add up to a Riemann sum that converges to V = π∫(f² − g²) dx, computed
// exactly for every curve below.
//
// Test hooks (harmless URL params): ?curve=<id>, ?n=<1-60>, ?sweep=<deg>, ?washer=1, ?discs=0|1,
// ?rule=left|mid|right, ?snap.

const YA = 1.75;      // world height of the axis of rotation
const NX = 160;       // samples along x for the solid
const NT = 96;        // angular segments for the solid
const NS = 64;        // angular segments per disc
const NMAX = 60;
const PI = Math.PI;

const I = (s) => `<i>${s}</i>`;
const CURVES = [
  {
    id: 'sqrt', name: '√x on [0, 4]', fh: `√${I('x')}`, a: 0, b: 4, f: (x) => Math.sqrt(Math.max(0, x)),
    gh: `${I('x')}/2`, g: (x) => x / 2,
    V: 8 * PI, Vt: '8π', Vw: `π∫<sub>0</sub><sup>4</sup> (√${I('x')})² d${I('x')} = π∫<sub>0</sub><sup>4</sup> ${I('x')} d${I('x')} = π[${I('x')}²/2]<sub>0</sub><sup>4</sup> = 8π`,
    W: (8 * PI) / 3, Wt: '8π/3', Ww: `π∫<sub>0</sub><sup>4</sup> (${I('x')} − ${I('x')}²/4) d${I('x')} = π(8 − 16/3) = 8π/3`,
    ticks: [[0, '0'], [1, '1'], [2, '2'], [3, '3'], [4, '4']],
  },
  {
    id: 'square', name: 'x² on [0, 1]', fh: `${I('x')}²`, a: 0, b: 1, f: (x) => x * x,
    gh: `${I('x')}³`, g: (x) => x * x * x,
    V: PI / 5, Vt: 'π/5', Vw: `π∫<sub>0</sub><sup>1</sup> ${I('x')}<sup>4</sup> d${I('x')} = π[${I('x')}<sup>5</sup>/5]<sub>0</sub><sup>1</sup> = π/5`,
    W: (2 * PI) / 35, Wt: '2π/35', Ww: `π∫<sub>0</sub><sup>1</sup> (${I('x')}<sup>4</sup> − ${I('x')}<sup>6</sup>) d${I('x')} = π(1/5 − 1/7) = 2π/35`,
    ticks: [[0, '0'], [0.5, '0.5'], [1, '1']],
  },
  {
    id: 'sin', name: 'sin x on [0, π]', fh: `sin ${I('x')}`, a: 0, b: PI, f: (x) => Math.max(0, Math.sin(x)),
    gh: `½ sin ${I('x')}`, g: (x) => Math.max(0, Math.sin(x)) / 2,
    V: (PI * PI) / 2, Vt: 'π²/2', Vw: `π∫<sub>0</sub><sup>π</sup> sin²${I('x')} d${I('x')} = π · π/2 = π²/2`,
    W: (3 * PI * PI) / 8, Wt: '3π²/8', Ww: `π∫<sub>0</sub><sup>π</sup> ¾ sin²${I('x')} d${I('x')} = ¾ · π²/2 = 3π²/8`,
    ticks: [[0, '0'], [PI / 2, 'π/2'], [PI, 'π']],
  },
  {
    id: 'recip', name: '1/x on [1, 3]', fh: `1/${I('x')}`, a: 1, b: 3, f: (x) => 1 / x,
    gh: '1/3', g: () => 1 / 3,
    V: (2 * PI) / 3, Vt: '2π/3', Vw: `π∫<sub>1</sub><sup>3</sup> ${I('x')}<sup>−2</sup> d${I('x')} = π[−1/${I('x')}]<sub>1</sub><sup>3</sup> = π(1 − 1/3) = 2π/3`,
    W: (4 * PI) / 9, Wt: '4π/9', Ww: `π∫<sub>1</sub><sup>3</sup> (1/${I('x')}² − 1/9) d${I('x')} = π(2/3 − 2/9) = 4π/9`,
    ticks: [[1, '1'], [1.5, '1.5'], [2, '2'], [2.5, '2.5'], [3, '3']],
  },
  {
    id: 'cone', name: 'Cone: x/2 on [0, 4]', fh: `${I('x')}/2`, a: 0, b: 4, f: (x) => x / 2,
    gh: `${I('x')}/4`, g: (x) => x / 4,
    V: (16 * PI) / 3, Vt: '16π/3', Vw: `π∫<sub>0</sub><sup>4</sup> ${I('x')}²/4 d${I('x')} = π · 64/12 = 16π/3, the same as ⅓π${I('r')}²${I('h')} = ⅓π(2²)(4)`,
    W: 4 * PI, Wt: '4π', Ww: `π∫<sub>0</sub><sup>4</sup> (${I('x')}²/4 − ${I('x')}²/16) d${I('x')} = π · (3/16) · (64/3) = 4π`,
    ticks: [[0, '0'], [1, '1'], [2, '2'], [3, '3'], [4, '4']],
  },
  {
    id: 'sphere', name: 'Sphere: √(4 − x²)', fh: `√(4 − ${I('x')}²)`, a: -2, b: 2, f: (x) => Math.sqrt(Math.max(0, 4 - x * x)),
    gh: `√(1 − ${I('x')}²) for |${I('x')}| ≤ 1`, g: (x) => Math.sqrt(Math.max(0, 1 - x * x)),
    V: (32 * PI) / 3, Vt: '32π/3', Vw: `π∫<sub>−2</sub><sup>2</sup> (4 − ${I('x')}²) d${I('x')} = π(16 − 16/3) = 32π/3, the same as ⁴⁄₃π${I('r')}³ with ${I('r')} = 2`,
    W: (28 * PI) / 3, Wt: '28π/3', Ww: `32π/3 − 4π/3 = 28π/3 (a radius-2 ball with a radius-1 ball hollowed out)`,
    ticks: [[-2, '−2'], [-1, '−1'], [0, '0'], [1, '1'], [2, '2']],
  },
];
const byId = Object.fromEntries(CURVES.map((c) => [c.id, c]));

const fmt = (v, d = 3) => {
  const s = v.toFixed(d);
  return s.startsWith('-') ? '−' + s.slice(1) : s;
};

export default {
  view: { dist: 8.8, yaw: 0.42, pitch: 0.32, target: [0, 1.45, 0], minDist: 3, maxDist: 18 },
  floor: true,
  explain: `
<p>Take the flat region under a curve <i>y</i> = <i>f</i>(<i>x</i>) between <i>x</i> = <i>a</i> and
<i>x</i> = <i>b</i>, and spin it a full turn round the <i>x</i>-axis. It sweeps out a <b>solid of
revolution</b>: a vase, a bowl, a cone or a ball, depending on the curve.</p>
<p>Every slice across the axis is a circle of radius <i>f</i>(<i>x</i>). So cut the solid into
<i>n</i> thin <b>discs</b> of thickness Δ<i>x</i> = (<i>b</i> − <i>a</i>)/<i>n</i>. Each one is a
short cylinder with volume π<i>R</i>²Δ<i>x</i>, where <i>R</i> = <i>f</i>(<i>x</i>*) is the curve's
height at a sample point in that slice (its left end, middle or right end).</p>
<p>Adding the discs gives a <b>Riemann sum</b>. Make the discs thinner (raise <i>n</i>) and the sum
gets closer to the true volume. In the limit it becomes the <b>definite integral</b>
V = π∫<sub><i>a</i></sub><sup><i>b</i></sup> <i>f</i>(<i>x</i>)² d<i>x</i>. Watch the error shrink
as you slide <i>n</i> up to 60.</p>
<p>If the region lies between two curves, the slices are <b>washers</b> (discs with a hole). A washer
has volume π(<i>R</i>² − <i>r</i>²)Δ<i>x</i>, where <i>R</i> is the outer radius <i>f</i>(<i>x</i>)
and <i>r</i> the inner radius <i>g</i>(<i>x</i>). Note that this is <b>not</b> π(<i>R</i> − <i>r</i>)².</p>
<p>Two good checks: the line <i>y</i> = <i>x</i>/2 gives a cone, and the integral matches
⅓π<i>r</i>²<i>h</i>. The half-circle <i>y</i> = √(4 − <i>x</i>²) gives a ball, and it matches
⁴⁄₃π<i>r</i>³.</p>`,
  formula: `<i>V</i> = π∫<sub><i>a</i></sub><sup><i>b</i></sup> [<i>f</i>(<i>x</i>)]² d<i>x</i> &nbsp;&nbsp; washers: <i>V</i> = π∫<sub><i>a</i></sub><sup><i>b</i></sup> ([<i>f</i>(<i>x</i>)]² − [<i>g</i>(<i>x</i>)]²) d<i>x</i><br><i>V<sub>n</sub></i> = Σ π[<i>f</i>(<i>x<sub>i</sub></i>*)]² Δ<i>x</i> → <i>V</i> as <i>n</i> → ∞`,
  vocab: [
    ['Solid of revolution', 'The 3D shape swept out when a flat region turns a full circle round a line (the axis).'],
    ['Axis of rotation', 'The line the region spins round. Here it is the x-axis.'],
    ['Disc method', 'Slicing the solid into thin cylinders of volume πR²Δx and adding them up.'],
    ['Washer method', 'The same idea when the solid has a hole: each slice is a ring of volume π(R² − r²)Δx.'],
    ['Riemann sum', 'An approximation that adds up many thin pieces, each built from one sample value of the function.'],
    ['Definite integral', 'The exact limit of the Riemann sums as the pieces get infinitely thin: ∫ f(x) dx from a to b.'],
    ['Δx', 'The thickness of each slice: (b − a)/n.'],
  ],
  standards: [
    'CCSS.MATH.CONTENT.HSG.GMD.A.1',
    'CCSS.MATH.CONTENT.HSG.GMD.A.3',
    'CCSS.MATH.CONTENT.HSG.GMD.B.4',
  ],
  quiz: [
    {
      q: 'The region under y = √x on [0, 4] spins round the x-axis. What is the volume?',
      choices: ['4π', '8π', '16π', '32π/3'],
      answer: 1,
      why: 'V = π∫₀⁴ (√x)² dx = π∫₀⁴ x dx = π · 16/2 = 8π.',
    },
    {
      q: 'Spinning y = x/2 on [0, 4] round the x-axis makes a cone. What is its volume?',
      choices: ['4π/3', '16π/3', '8π', '16π'],
      answer: 1,
      why: 'π∫₀⁴ (x/2)² dx = π · 64/12 = 16π/3. Check: the cone has r = 2, h = 4, and ⅓π(2²)(4) = 16π/3.',
    },
    {
      q: 'A washer has outer radius R, inner radius r and thickness Δx. What is its volume?',
      choices: ['π(R − r)²Δx', 'π(R² − r²)Δx', '2π(R − r)Δx', 'π(R + r)Δx'],
      answer: 1,
      why: 'It is a big disc πR²Δx with a small disc πr²Δx removed: π(R² − r²)Δx. Squaring the difference, (R − r)², is a common mistake.',
    },
    {
      q: 'For y = 1/x on [1, 3], which decreases, discs sampled at the LEFT end of each slice give…',
      choices: ['an overestimate', 'an underestimate', 'the exact volume', 'a negative volume'],
      answer: 0,
      why: 'f is largest at the left edge of each slice, so every left-endpoint disc is a little too fat. The sum is too big.',
    },
    {
      q: 'What happens to the Riemann sum Σ π f(xᵢ*)² Δx as the number of discs n grows without limit?',
      choices: ['It grows without limit', 'It shrinks to 0', 'It approaches the exact integral π∫f(x)² dx', 'It stays the same'],
      answer: 2,
      why: 'Thinner discs fit the curve better and the error goes to 0. The limit of the sums is the definite integral.',
    },
  ],

  build(ctx) {
    const { THREE, root, ui } = ctx;
    const V3 = THREE.Vector3;
    const params = new URLSearchParams(location.search);

    const st = {
      curve: byId[params.get('curve')] || CURVES[0],
      n: Math.max(1, Math.min(NMAX, parseInt(params.get('n') || '8', 10) || 8)),
      sweep: params.has('sweep') ? Math.max(0, Math.min(360, +params.get('sweep'))) * (PI / 180) : 0,
      washer: params.get('washer') === '1',
      solid: true,
      discs: params.get('discs') === '1',
      rule: ['left', 'mid', 'right'].includes(params.get('rule')) ? params.get('rule') : 'mid',
      spinning: !params.has('sweep'),
      converging: false, nf: 1,
    };
    let C = st.curve, S = 1, XM = 0, fmax = 1;

    const glow = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, ...extra });
    const UP = new V3(0, 1, 0), _d = new V3();
    const stickGeo = new THREE.CylinderGeometry(1, 1, 1, 14);
    const stick = (m, a, b, r) => {
      _d.subVectors(b, a);
      const L = _d.length();
      m.visible = L > 1e-5;
      if (!m.visible) return;
      m.position.addVectors(a, b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(UP, _d.multiplyScalar(1 / L));
      m.scale.set(r, L, r);
    };
    const wx = (x) => S * (x - XM);
    const deriv = (fn, x) => {
      const h = 1e-4 * (C.b - C.a);
      const x0 = Math.max(C.a, x - h), x1 = Math.min(C.b, x + h);
      return (fn(x1) - fn(x0)) / (x1 - x0);
    };

    // ── a mesh with fixed-size, in-place attributes ──────────────────────────────────────────
    function gridMesh(rows, cols, material, parent = root) {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(rows * cols * 3), nor = new Float32Array(rows * cols * 3);
      const idx = new Uint32Array((rows - 1) * (cols - 1) * 6);
      for (let i = 0, q = 0; i < rows - 1; i++) for (let j = 0; j < cols - 1; j++) {
        const a = i * cols + j, b = a + cols;
        idx[q++] = a; idx[q++] = b; idx[q++] = a + 1; idx[q++] = b; idx[q++] = b + 1; idx[q++] = a + 1;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      const mesh = new THREE.Mesh(geo, material);
      mesh.frustumCulled = false;
      parent.add(mesh);
      return { mesh, pos, nor, cols, done() { geo.attributes.position.needsUpdate = true; geo.attributes.normal.needsUpdate = true; } };
    }

    // ── materials ────────────────────────────────────────────────────────────────────────────
    const solidMat = new THREE.MeshPhysicalMaterial({
      color: '#c9a0ff', transmission: 0.5, thickness: 1.2, ior: 1.45, roughness: 0.1, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.06, attenuationColor: new THREE.Color('#9a5cff'), attenuationDistance: 2.2,
      side: THREE.DoubleSide, specularIntensity: 1, envMapIntensity: 1.1,
    });
    const innerMat = solidMat.clone();
    innerMat.color.set('#ffb3e2');
    // With the discs showing, the solid becomes a faint glass ghost so the slices read clearly.
    const ghostMat = new THREE.MeshPhysicalMaterial({ color: '#c9a0ff', transparent: true, opacity: 0.16, roughness: 0.1, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false });
    const ghostInner = ghostMat.clone();
    ghostInner.color.set('#ffb3e2');
    const regionMat = glow('#c38bff', { transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false });
    const outlineMat = glow('#ead9ff');
    const innerLineMat = glow('#ff8fd2');

    // ── the solid: outer and inner surfaces, end caps ────────────────────────────────────────
    const outer = gridMesh(NX, NT + 1, solidMat);
    const inner = gridMesh(NX, NT + 1, innerMat);
    const capA = gridMesh(2, NT + 1, solidMat), capB = gridMesh(2, NT + 1, solidMat);
    outer.mesh.castShadow = true;
    const fx = new Float32Array(NX), gx = new Float32Array(NX), xs = new Float32Array(NX), dfx = new Float32Array(NX), dgx = new Float32Array(NX);

    function buildSolid() {
      const ph = st.sweep;
      const show = st.solid && ph > 1e-4;
      outer.mesh.visible = show;
      inner.mesh.visible = show && st.washer;
      for (let i = 0; i < NX; i++) {
        const X = wx(xs[i]);
        for (let j = 0; j <= NT; j++) {
          const p = (ph * j) / NT, c = Math.cos(p), s = -Math.sin(p); // sweep away from the viewer (+y toward −z)
          const o = (i * (NT + 1) + j) * 3;
          let r = S * fx[i];
          outer.pos[o] = X; outer.pos[o + 1] = YA + r * c; outer.pos[o + 2] = r * s;
          let d = -dfx[i], L = Math.hypot(d, 1);
          outer.nor[o] = d / L; outer.nor[o + 1] = c / L; outer.nor[o + 2] = s / L;
          if (st.washer) {
            r = S * gx[i];
            inner.pos[o] = X; inner.pos[o + 1] = YA + r * c; inner.pos[o + 2] = r * s;
            d = dgx[i]; L = Math.hypot(d, 1);
            inner.nor[o] = d / L; inner.nor[o + 1] = -c / L; inner.nor[o + 2] = -s / L;
          }
        }
      }
      outer.done();
      if (st.washer) inner.done();
      // End caps (flat rings at x = a and x = b) where the region has height there.
      for (const [cap, i, nx] of [[capA, 0, -1], [capB, NX - 1, 1]]) {
        const rOut = S * fx[i], rIn = st.washer ? S * gx[i] : 0;
        cap.mesh.visible = show && rOut - rIn > 1e-4;
        if (!cap.mesh.visible) continue;
        const X = wx(xs[i]);
        for (let k = 0; k < 2; k++) for (let j = 0; j <= NT; j++) {
          const p = (ph * j) / NT, r = k ? rOut : rIn, o = (k * (NT + 1) + j) * 3;
          cap.pos[o] = X; cap.pos[o + 1] = YA + r * Math.cos(p); cap.pos[o + 2] = -r * Math.sin(p);
          cap.nor[o] = nx; cap.nor[o + 1] = 0; cap.nor[o + 2] = 0;
        }
        cap.done();
      }
      blade.rotation.x = -ph;
      startFace.visible = show && ph < 2 * PI - 1e-3;
      rSweep.set(`${fmt((ph * 180) / PI, 0)}°`);
    }

    // ── the generating region (the "blade") and its outline ──────────────────────────────────
    const blade = new THREE.Group();
    blade.position.y = YA;
    root.add(blade);
    const region = gridMesh(NX, 2, regionMat, blade);
    region.mesh.renderOrder = 3;
    const startFace = new THREE.Mesh(region.mesh.geometry, glow('#c38bff', { transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
    startFace.position.y = YA;
    root.add(startFace);

    function makeTube(maxPts, radial, radius, material, parent) {
      const W = radial + 1;
      const t = gridMesh(maxPts, W, material, parent);
      const T = new V3(), Nn = new V3(), B = new V3(), P = new V3(), A = new V3(), Bp = new V3();
      return {
        mesh: t.mesh,
        set(pts, count) {
          for (let i = 0; i < count; i++) {
            A.fromArray(pts, Math.max(0, i - 1) * 3);
            Bp.fromArray(pts, Math.min(count - 1, i + 1) * 3);
            T.subVectors(Bp, A).normalize();
            if (i === 0) Nn.set(0, 0, 1);
            Nn.addScaledVector(T, -Nn.dot(T));
            if (Nn.lengthSq() < 1e-8) Nn.set(0, 1, 0).addScaledVector(T, -T.y);
            Nn.normalize();
            B.crossVectors(T, Nn);
            P.fromArray(pts, i * 3);
            for (let j = 0; j <= radial; j++) {
              const ang = (j / radial) * 2 * PI, c = Math.cos(ang), s = Math.sin(ang);
              const nx = Nn.x * c + B.x * s, ny = Nn.y * c + B.y * s, nz = Nn.z * c + B.z * s, o = (i * W + j) * 3;
              t.nor[o] = nx; t.nor[o + 1] = ny; t.nor[o + 2] = nz;
              t.pos[o] = P.x + nx * radius; t.pos[o + 1] = P.y + ny * radius; t.pos[o + 2] = P.z + nz * radius;
            }
          }
          t.done();
          t.mesh.geometry.setDrawRange(0, (count - 1) * radial * 6);
        },
      };
    }
    // Outline: up the left edge, along f, down the right edge (in the blade's local frame).
    const OUT = NX + 2;
    const oPts = new Float32Array(OUT * 3), iPts = new Float32Array(NX * 3);
    const fTube = makeTube(OUT, 8, 0.022, outlineMat, blade);
    const gTube = makeTube(NX, 8, 0.018, innerLineMat, blade);
    let fLab = ctx.label(' ', { color: '#ead9ff', size: 0.8 });
    let gLab = ctx.label(' ', { color: '#ff8fd2', size: 0.75 });
    blade.add(fLab, gLab);

    function buildRegion() {
      for (let i = 0; i < NX; i++) {
        const X = wx(xs[i]), lo = st.washer ? S * gx[i] : 0, hi = S * fx[i];
        region.pos.set([X, lo, 0, X, hi, 0], i * 6);
        region.nor.set([0, 0, 1, 0, 0, 1], i * 6);
        oPts.set([X, hi, 0], (i + 1) * 3);
        iPts.set([X, lo, 0], i * 3);
      }
      region.done();
      oPts.set([wx(xs[0]), st.washer ? S * gx[0] : 0, 0], 0);
      oPts.set([wx(xs[NX - 1]), st.washer ? S * gx[NX - 1] : 0, 0], (NX + 1) * 3);
      fTube.set(oPts, OUT);
      gTube.mesh.visible = st.washer;
      if (st.washer) gTube.set(iPts, NX);
      const xl = C.a + 0.72 * (C.b - C.a);
      fLab = ctx.relabel(fLab, `y = ${C.fh.replace(/<\/?i>/g, '').replace(/<\/?sup>/g, '')}`, { color: '#ead9ff', size: 0.8 });
      fLab.position.set(wx(xl), S * C.f(xl) + 0.22, 0);
      gLab = ctx.relabel(gLab, `g(x) = ${C.gh.replace(/<\/?i>/g, '')}`, { color: '#ff8fd2', size: 0.72 });
      const xg = C.a + 0.5 * (C.b - C.a);
      gLab.position.set(wx(xg), S * C.g(xg) - 0.2, 0);
      gLab.visible = st.washer;
    }

    // ── axis of rotation, spin arrow, floor ruler ────────────────────────────────────────────
    const axisMat = glow('#9fb0ff');
    const axis = new THREE.Mesh(stickGeo, axisMat);
    const axisHead = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 18), axisMat);
    axisHead.rotation.z = -PI / 2;
    const spinArrow = new THREE.Group();
    const spinRing = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.014, 10, 64, 1.5 * PI), glow('#ffd166'));
    const spinHead = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 16), glow('#ffd166'));
    spinHead.position.set(0, -0.28, 0); // the end of the 270° arc, pointing along the turn
    spinHead.rotation.z = -PI / 2;
    spinArrow.add(spinRing, spinHead);
    spinArrow.rotation.y = -PI / 2; // torus lies in yz round the x-axis, turning the same way as the sweep
    root.add(axis, axisHead, spinArrow);
    const axisLab = ctx.label('axis of rotation', { color: '#9fb0ff', size: 0.62, bold: false });
    root.add(axisLab);

    const ruler = new THREE.Mesh(stickGeo, glow('#8a93b8'));
    root.add(ruler);
    const tickMeshes = [], tickLabels = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(stickGeo, glow('#8a93b8'));
      root.add(m);
      tickMeshes.push(m);
    }
    let aLab = ctx.label(' ', { color: '#ffd166', size: 0.62 }), bLab = ctx.label(' ', { color: '#ffd166', size: 0.62 });
    root.add(aLab, bLab);
    const p0 = new V3(), p1 = new V3();
    function buildAxes() {
      const xa = wx(C.a), xb = wx(C.b);
      stick(axis, p0.set(xa - 0.55, YA, 0), p1.set(xb + 0.6, YA, 0), 0.01);
      axisHead.position.set(xb + 0.68, YA, 0);
      spinArrow.position.set(xb + 0.4, YA, 0);
      axisLab.position.set(xb + 0.75, YA + 0.25, 0);
      const zr = S * fmax + 0.45, yr = 0.03;
      stick(ruler, p0.set(xa, yr, zr), p1.set(xb, yr, zr), 0.008);
      let k = 0;
      for (const [v, txt] of C.ticks) {
        const m = tickMeshes[k];
        m.visible = true;
        stick(m, p0.set(wx(v), yr, zr), p1.set(wx(v), yr, zr + 0.12), 0.007);
        const opts = { color: '#d6dcff', size: 0.6, bold: false };
        if (!tickLabels[k]) { tickLabels[k] = ctx.label(txt, opts); root.add(tickLabels[k]); }
        else if (tickLabels[k].userData.txt !== txt) tickLabels[k] = ctx.relabel(tickLabels[k], txt, opts);
        tickLabels[k].userData.txt = txt;
        tickLabels[k].visible = true;
        tickLabels[k].position.set(wx(v), yr, zr + 0.32);
        k++;
      }
      for (; k < tickMeshes.length; k++) { tickMeshes[k].visible = false; if (tickLabels[k]) tickLabels[k].visible = false; }
      aLab.position.set(xa, yr, zr - 0.22);
      bLab.position.set(xb, yr, zr - 0.22);
    }

    // ── discs / washers (rebuilt when n, rule, mode or curve changes) ────────────────────────
    const discMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.26, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.1 });
    const discs = new THREE.Mesh(new THREE.BufferGeometry(), discMat);
    discs.castShadow = true;
    root.add(discs);
    const cA = new THREE.Color('#6d3df5'), cB = new THREE.Color('#ff9ad5'), cTmp = new THREE.Color();
    function setDiscsVisible(v) {
      st.discs = discs.visible = v;
      for (const m of [outer.mesh, capA.mesh, capB.mesh]) m.material = v ? ghostMat : solidMat;
      inner.mesh.material = v ? ghostInner : innerMat;
      outer.mesh.castShadow = !v;
    }
    const sample = (i, dx) => C.a + (st.rule === 'left' ? i : st.rule === 'right' ? i + 1 : i + 0.5) * dx;

    function buildDiscs() {
      const n = st.n, dx = (C.b - C.a) / n;
      const pos = [], nor = [], col = [], idx = [];
      let vSum = 0;
      for (let i = 0; i < n; i++) {
        const xi = sample(i, dx);
        const R = C.f(xi), r = st.washer ? Math.min(R, C.g(xi)) : 0;
        vSum += PI * (R * R - r * r) * dx;
        const W = S * dx, gap = Math.min(0.1 * W, 0.025);
        const x0 = wx(C.a + i * dx) + gap / 2, x1 = x0 + W - gap;
        const Ro = S * R, Ri = S * r;
        if (Ro - Ri < 1e-5) continue;
        cTmp.copy(cA).lerp(cB, n > 1 ? i / (n - 1) : 0.5);
        const ring = (rad, xa, xb, out) => { // a cylinder side
          const base = pos.length / 3;
          for (let j = 0; j <= NS; j++) {
            const p = (j / NS) * 2 * PI, c = Math.cos(p), s = Math.sin(p);
            pos.push(xa, YA + rad * c, rad * s, xb, YA + rad * c, rad * s);
            nor.push(0, out * c, out * s, 0, out * c, out * s);
            col.push(cTmp.r, cTmp.g, cTmp.b, cTmp.r, cTmp.g, cTmp.b);
          }
          for (let j = 0; j < NS; j++) {
            const a = base + j * 2;
            if (out > 0) idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
            else idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
          }
        };
        const face = (xf, nx) => { // a flat ring (or disc when Ri = 0)
          const base = pos.length / 3;
          for (let j = 0; j <= NS; j++) {
            const p = (j / NS) * 2 * PI, c = Math.cos(p), s = Math.sin(p);
            pos.push(xf, YA + Ri * c, Ri * s, xf, YA + Ro * c, Ro * s);
            nor.push(nx, 0, 0, nx, 0, 0);
            col.push(cTmp.r * 1.1, cTmp.g * 1.1, cTmp.b * 1.1, cTmp.r * 1.1, cTmp.g * 1.1, cTmp.b * 1.1);
          }
          for (let j = 0; j < NS; j++) {
            const a = base + j * 2;
            if (nx > 0) idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
            else idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
          }
        };
        ring(Ro, x0, x1, 1);
        if (Ri > 1e-5) ring(Ri, x0, x1, -1);
        face(x0, -1);
        face(x1, 1);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      discs.geometry.dispose();
      discs.geometry = g;
      setDiscsVisible(st.discs);

      const V = st.washer ? C.W : C.V, Vt = st.washer ? C.Wt : C.Vt;
      rN.set(`${n}`);
      rDx.set(`${fmt(dx, 4)}`);
      rVn.set(`<b>${fmt(vSum, 4)}</b>`);
      rV.set(`${Vt} ≈ ${fmt(V, 4)}`);
      const err = ((vSum - V) / V) * 100;
      rErr.set(`<span style="color:${Math.abs(err) < 1 ? '#6be3a4' : Math.abs(err) < 5 ? '#ffd166' : '#ff8f8f'}">${err >= 0 ? '+' : '−'}${fmt(Math.abs(err), 2)} %</span>`);
      rWork.set(`<b>Exact:</b> ${st.washer ? C.Ww : C.Vw}` + (C.id === "sin" && n >= 2 ? "<br>For sin <i>x</i> every sum with <i>n</i> ≥ 2 is exact: sin²<i>x</i> = (1 − cos 2<i>x</i>)/2, and the cos 2<i>x</i> parts cancel over equal slices of a full period. Try n = 1, or another curve." : ""));
    }

    // ── a new curve or mode ──────────────────────────────────────────────────────────────────
    function setCurve(c) {
      C = st.curve = c;
      XM = (C.a + C.b) / 2;
      fmax = 0;
      for (let i = 0; i < NX; i++) {
        const x = C.a + ((C.b - C.a) * i) / (NX - 1);
        xs[i] = x; fx[i] = C.f(x); gx[i] = Math.min(fx[i], C.g(x));
        fmax = Math.max(fmax, fx[i]);
      }
      S = Math.min(4.2 / (C.b - C.a), 3.0 / (2 * fmax));
      for (let i = 0; i < NX; i++) { dfx[i] = deriv(C.f, xs[i]); dgx[i] = deriv(C.g, xs[i]); }
      rCurve.set(`<i>f</i>(<i>x</i>) = ${C.fh}` + (st.washer ? `, <i>g</i>(<i>x</i>) = ${C.gh}` : ''));
      buildAxes();
      buildRegion();
      buildSolid();
      buildDiscs();
      const at = (C.a < 0 ? '−' + -C.a : C.a), bt = C.id === 'sin' ? 'π' : C.b;
      relabelAB(`a = ${at}`, `b = ${bt}`);
    }
    let abTxt = '';
    const relabelAB = (ta, tb) => {
      if (abTxt === ta + tb) return;
      abTxt = ta + tb;
      aLab = ctx.relabel(aLab, ta, { color: "#ffd166", size: 0.62 });
      bLab = ctx.relabel(bLab, tb, { color: "#ffd166", size: 0.62 });
    };

    // ── controls ─────────────────────────────────────────────────────────────────────────────
    ui.select('Curve', { options: CURVES.map((c) => ({ value: c.id, label: c.name })), value: C.id, onChange: (v) => setCurve(byId[v]) });
    const rCurve = ui.readout('Region', '');
    ui.choice('Method', {
      options: [{ value: 'disc', label: 'Discs' }, { value: 'washer', label: 'Washers (with inner curve g)' }],
      value: st.washer ? 'washer' : 'disc',
      onChange: (v) => { st.washer = v === 'washer'; setCurve(C); },
    });
    ui.heading('Spin');
    const sSweep = ui.slider('Sweep angle', {
      min: 0, max: 360, step: 1, value: (st.sweep * 180) / PI, fmt: (v) => `${v}°`,
      onChange: (v) => { st.spinning = false; st.sweep = (v * PI) / 180; buildSolid(); },
    });
    ui.button('Spin it', () => { st.sweep = 0; st.spinning = true; }, { primary: true });
    ui.toggle('Show the solid', { value: st.solid, onChange: (v) => { st.solid = v; buildSolid(); } });
    const rSweep = ui.readout('Turned through', '0°');

    ui.heading('Slice into discs');
    const tDiscs = ui.toggle('Show discs / washers', { value: st.discs, onChange: (v) => setDiscsVisible(v) });
    const sN = ui.slider('Number of slices n', { min: 1, max: NMAX, step: 1, value: st.n, onChange: (v) => { st.converging = false; st.n = v; buildDiscs(); } });
    ui.choice('Sample point x*', {
      options: [{ value: 'left', label: 'Left' }, { value: 'mid', label: 'Middle' }, { value: 'right', label: 'Right' }],
      value: st.rule,
      onChange: (v) => { st.rule = v; buildDiscs(); },
    });
    ui.button('Watch it converge (n = 1 → 60)', () => { st.converging = true; st.nf = 1; setDiscsVisible(true); tDiscs.set(true); });
    const rN = ui.readout('n');
    const rDx = ui.readout('Δx = (b − a)/n');
    const rVn = ui.readout('Riemann sum V<sub>n</sub>');
    const rV = ui.readout('Exact V');
    const rErr = ui.readout('Error');
    const rWork = ui.note('');
    ui.note('Tip: click a disc to see its own volume.');

    ctx.pickable(discs, (hit) => {
      const n = st.n, dx = (C.b - C.a) / n;
      const x = hit.point.x / S + XM;
      const i = Math.max(0, Math.min(n - 1, Math.floor((x - C.a) / dx)));
      const xi = sample(i, dx), R = C.f(xi), r = st.washer ? Math.min(R, C.g(xi)) : 0;
      const v = PI * (R * R - r * r) * dx;
      ctx.card(
        `Slice ${i + 1} of ${n}`,
        `<p>Sample point <i>x</i>* = ${fmt(xi)} (${st.rule === 'mid' ? 'middle' : st.rule} of [${fmt(C.a + i * dx)}, ${fmt(C.a + (i + 1) * dx)}])</p>` +
        `<p>Outer radius <i>R</i> = <i>f</i>(<i>x</i>*) = ${fmt(R)}` + (st.washer ? `, inner radius <i>r</i> = <i>g</i>(<i>x</i>*) = ${fmt(r)}` : '') + `</p>` +
        `<p>Volume = π(${st.washer ? '<i>R</i>² − <i>r</i>²' : '<i>R</i>²'})Δ<i>x</i> = π × ${fmt(R * R - r * r, 4)} × ${fmt(dx, 4)} = <b>${fmt(v, 4)}</b></p>`,
        { kind: st.washer ? 'Washer' : 'Disc' },
      );
    });

    setCurve(C);
    snapView(this.view, params);

    return {
      update(dt) {
        if (st.spinning) {
          st.sweep = Math.min(2 * PI, st.sweep + dt * 2.1);
          if (st.sweep >= 2 * PI) st.spinning = false;
          buildSolid();
          sSweep.set(Math.round((st.sweep * 180) / PI));
        }
        if (st.converging) {
          st.nf += dt * 14;
          const n = Math.min(NMAX, Math.floor(st.nf));
          if (n !== st.n) { st.n = n; sN.set(n); buildDiscs(); }
          if (n >= NMAX) st.converging = false;
        }
        spinArrow.rotation.x -= dt * 1.2;
      },
      dispose() { stickGeo.dispose(); for (const m of [solidMat, innerMat, ghostMat, ghostInner]) m.dispose(); },
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
