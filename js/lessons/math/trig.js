// The Unit Circle & Waves. A point goes round the unit circle (a vertical plane at the left end of
// the model); the same point is carried along the θ axis as θ grows, so it traces a helix
// (cos θ, sin θ, θ). Project the helix onto the back wall and you get y = sin θ; onto the floor and
// you get x = cos θ. The wall also carries y = A·sin(B(x − C)) for the amplitude / period / phase
// sliders.
//
// Layout (world): θ runs along +x, cos θ along +z (toward the viewer), sin θ along +y. Looking down
// the θ axis from the −x end shows the circle the standard way round (counterclockwise).
//
// Test hooks (harmless URL params): ?theta=<radians>, ?play=1, ?tan=1, ?wave=A,B,C, ?snap.

const XC = -1.9;   // world x of the circle (θ = 0)
const YC = 1.7;    // world y of the circle centre (sin θ = 0)
const U = 0.6;     // world units per radian along the θ axis
const WZ = -1.4;   // back wall (sine)
const FLY = 0.05;  // floor panel top (cosine)
const TAU = Math.PI * 2;
const XE = XC + U * TAU;

const COL = { cos: '#4fd8ff', sin: '#ff6fae', tan: '#ffd166', wave: '#ffb347', math: '#c38bff', helix: '#c38bff' };

// Exact values at the 16 special angles: [degrees, radians, cos, sin, tan].
const SPECIAL = [
  [0, '0', '1', '0', '0'],
  [30, 'π/6', '√3/2', '1/2', '√3/3'],
  [45, 'π/4', '√2/2', '√2/2', '1'],
  [60, 'π/3', '1/2', '√3/2', '√3'],
  [90, 'π/2', '0', '1', 'undefined'],
  [120, '2π/3', '−1/2', '√3/2', '−√3'],
  [135, '3π/4', '−√2/2', '√2/2', '−1'],
  [150, '5π/6', '−√3/2', '1/2', '−√3/3'],
  [180, 'π', '−1', '0', '0'],
  [210, '7π/6', '−√3/2', '−1/2', '√3/3'],
  [225, '5π/4', '−√2/2', '−√2/2', '1'],
  [240, '4π/3', '−1/2', '−√3/2', '√3'],
  [270, '3π/2', '0', '−1', 'undefined'],
  [300, '5π/3', '1/2', '−√3/2', '−√3'],
  [315, '7π/4', '√2/2', '−√2/2', '−1'],
  [330, '11π/6', '√3/2', '−1/2', '−√3/3'],
  [360, '2π', '1', '0', '0'],
];
const SPECIAL_RAD = SPECIAL.map((s) => (s[0] * Math.PI) / 180);

const fmt = (v, d = 3) => {
  const s = (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toFixed(d);
  return s.startsWith('-') ? '−' + s.slice(1) : s;
};
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
/** k·π/den as a reduced fraction string, e.g. piFrac(3, 12) → "π/4". */
function piFrac(k, den) {
  if (k === 0) return '0';
  const g = gcd(k, den), n = k / g, d = den / g;
  const sign = n < 0 ? '−' : '';
  const a = Math.abs(n);
  return `${sign}${a === 1 ? '' : a}π${d === 1 ? '' : '/' + d}`;
}

export default {
  view: { dist: 9.6, yaw: -0.82, pitch: 0.3, target: [0, 1.5, 0], minDist: 3, maxDist: 18 },
  floor: true,
  explain: `
<p>The <b>unit circle</b> has radius 1 and its centre at the origin. Start at (1, 0) and turn
counterclockwise through an angle θ. The point you land on is defined to be
(<b>cos θ</b>, <b>sin θ</b>). So cosine is the point's <span style="color:${COL.cos}">horizontal</span>
position and sine is its <span style="color:${COL.sin}">vertical</span> position.</p>
<p>Angles here are in <b>radians</b>: one radian is the angle whose arc is as long as the radius, so a
full turn is 2π radians = 360°. On the unit circle, θ in radians is exactly the arc length you have
walked. The right triangle inside the circle has hypotenuse 1, so Pythagoras gives
cos²θ + sin²θ = 1 for every angle.</p>
<p>The <b>special angles</b> (multiples of π/6 and π/4) come from the 30-60-90 and 45-45-90
triangles, which is why their values involve ½, √2/2 and √3/2.</p>
<p>Now let θ grow and slide the point along the θ axis at the same time. It traces a <b>helix</b>.
Shine a light from the front and its shadow on the back wall is the wave <i>y</i> = sin θ; shine it from
above and the shadow on the floor is <i>x</i> = cos θ. Sine and cosine are the same circle motion seen
from two sides, a quarter turn apart.</p>
<p>On the wall, <i>y</i> = <i>A</i> sin(<i>B</i>(<i>x</i> − <i>C</i>)) stretches that wave:
|<i>A</i>| is the <b>amplitude</b> (height), the <b>period</b> is 2π/<i>B</i> (length of one cycle), and
<i>C</i> is the <b>phase shift</b> (a slide to the right when <i>C</i> &gt; 0).</p>
<p><b>tan θ</b> = sin θ / cos θ is the slope of the radius. Switch on the tangent and it appears as the
height where the radius line meets the vertical line <i>x</i> = 1. It is undefined at π/2 and 3π/2,
where cos θ = 0.</p>`,
  formula: `(<i>x</i>, <i>y</i>) = (cos θ, sin θ) &nbsp;&nbsp; cos²θ + sin²θ = 1 &nbsp;&nbsp; tan θ = sin θ / cos θ<br><i>y</i> = <i>A</i> sin(<i>B</i>(<i>x</i> − <i>C</i>)): amplitude |<i>A</i>|, period 2π/<i>B</i>, shift <i>C</i>`,
  vocab: [
    ['Unit circle', 'The circle of radius 1 centred at the origin: x² + y² = 1.'],
    ['Radian', 'The angle that cuts off an arc equal to the radius. 2π radians = 360°, so π radians = 180°.'],
    ['Cosine', 'cos θ is the x-coordinate of the point at angle θ on the unit circle.'],
    ['Sine', 'sin θ is the y-coordinate of the point at angle θ on the unit circle.'],
    ['Tangent', 'tan θ = sin θ / cos θ, the slope of the radius. Undefined when cos θ = 0.'],
    ['Reference angle', 'The acute angle between the radius and the x-axis. It fixes the size of the values; the quadrant fixes the signs.'],
    ['Amplitude', 'Half the distance from a wave\'s lowest to highest point: |A| in y = A sin(B(x − C)).'],
    ['Period', 'The length of one full cycle: 2π / B for y = A sin(B(x − C)) (B > 0).'],
    ['Phase shift', 'A sideways slide of the graph: C in y = A sin(B(x − C)), to the right when C > 0.'],
    ['Helix', 'A curve that winds round a cylinder while moving along its axis, like a spring.'],
  ],
  standards: [
    'CCSS.MATH.CONTENT.HSF.TF.A.1',
    'CCSS.MATH.CONTENT.HSF.TF.A.2',
    'CCSS.MATH.CONTENT.HSF.TF.A.3',
    'CCSS.MATH.CONTENT.HSF.TF.B.5',
    'CCSS.MATH.CONTENT.HSF.TF.C.8',
    'CCSS.MATH.CONTENT.HSF.IF.C.7.E',
  ],
  quiz: [
    {
      q: 'What is sin(π/6)?',
      choices: ['1/2', '√3/2', '√2/2', '1'],
      answer: 0,
      why: 'π/6 is 30°. In the 30-60-90 triangle with hypotenuse 1 the side opposite 30° is 1/2, so the point is (√3/2, 1/2).',
    },
    {
      q: 'Which point on the unit circle is at θ = 3π/4?',
      choices: ['(√2/2, −√2/2)', '(−√2/2, √2/2)', '(−1/2, √3/2)', '(−√3/2, 1/2)'],
      answer: 1,
      why: '3π/4 is 135°, in quadrant II (x negative, y positive), with reference angle π/4. So (−√2/2, √2/2).',
    },
    {
      q: 'What is 120° in radians?',
      choices: ['π/3', '3π/4', '2π/3', '5π/6'],
      answer: 2,
      why: 'Multiply by π/180: 120 × π/180 = 2π/3.',
    },
    {
      q: 'What is the period of y = 3 sin(2x)?',
      choices: ['π', '2π', '3', '4π'],
      answer: 0,
      why: 'The period is 2π/B = 2π/2 = π. The 3 is the amplitude; it changes the height, not the period.',
    },
    {
      q: 'In which quadrant are sin θ and cos θ both negative?',
      choices: ['Quadrant I', 'Quadrant II', 'Quadrant III', 'Quadrant IV'],
      answer: 2,
      why: 'Both coordinates of the point are negative only in quadrant III, between π and 3π/2 (180° to 270°).',
    },
  ],

  build(ctx) {
    const { THREE, root, ui } = ctx;
    const V3 = THREE.Vector3;
    const params = new URLSearchParams(location.search);

    const st = {
      theta: Math.min(TAU, Math.max(0, parseFloat(params.get('theta') ?? (Math.PI / 3)))),
      playing: params.get('play') === '1',
      speed: 0.6,
      snap: true,
      tan: params.get('tan') === '1',
      A: 1, B: 1, C: 0, showWave: true,
    };
    const w = (params.get('wave') || '').split(',').map(Number);
    if (w.length === 3 && w.every(Number.isFinite)) { st.A = w[0]; st.B = w[1]; st.C = w[2]; }

    const glow = (c, extra = {}) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, ...extra });
    const lineMat = (c, opacity = 1) => new THREE.LineBasicMaterial({ color: c, toneMapped: false, transparent: opacity < 1, opacity });
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
    const polyline = (pts, mat) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const l = new THREE.Line(g, mat);
      root.add(l);
      return l;
    };
    const segs = (pts, mat) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const l = new THREE.LineSegments(g, mat);
      root.add(l);
      return l;
    };
    const lab = (text, color, x, y, z, size = 0.8, bold = true) => {
      const l = ctx.label(text, { color, size, bold });
      l.position.set(x, y, z);
      root.add(l);
      return l;
    };

    // ── tube with in-place updates (helix and its two shadows) ────────────────────────────────
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
      root.add(mesh);
      const T = new V3(), Nn = new V3(), B = new V3(), P = new V3(), A = new V3(), Bp = new V3();
      return {
        mesh,
        set(pts, count) {
          mesh.visible = count >= 2;
          if (count < 2) return;
          for (let i = 0; i < count; i++) {
            A.fromArray(pts, Math.max(0, i - 1) * 3);
            Bp.fromArray(pts, Math.min(count - 1, i + 1) * 3);
            T.subVectors(Bp, A).normalize();
            if (i === 0) Nn.set(0, 1, 0);
            Nn.addScaledVector(T, -Nn.dot(T));
            if (Nn.lengthSq() < 1e-8) Nn.set(0, 0, 1).addScaledVector(T, -T.z);
            Nn.normalize();
            B.crossVectors(T, Nn);
            P.fromArray(pts, i * 3);
            for (let j = 0; j <= radial; j++) {
              const ang = (j / radial) * TAU, c = Math.cos(ang), s = Math.sin(ang);
              const nx = Nn.x * c + B.x * s, ny = Nn.y * c + B.y * s, nz = Nn.z * c + B.z * s;
              const o = (i * W + j) * 3;
              nor[o] = nx; nor[o + 1] = ny; nor[o + 2] = nz;
              pos[o] = P.x + nx * radius; pos[o + 1] = P.y + ny * radius; pos[o + 2] = P.z + nz * radius;
            }
          }
          geo.attributes.position.needsUpdate = true;
          geo.attributes.normal.needsUpdate = true;
          geo.setDrawRange(0, (count - 1) * radial * 6);
        },
      };
    }

    // ── the back wall (sine) and floor panel (cosine) ────────────────────────────────────────
    const panelMat = new THREE.MeshPhysicalMaterial({ color: 0x0d1224, roughness: 0.45, metalness: 0.25, clearcoat: 0.7, clearcoatRoughness: 0.25 });
    const WX0 = XC - 0.35, WX1 = XE + 0.35, WW = WX1 - WX0, WXM = (WX0 + WX1) / 2;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(WW, YC + 1.75, 0.05), panelMat);
    wall.position.set(WXM, (YC + 1.75) / 2, WZ - 0.03);
    wall.receiveShadow = true;
    const floorP = new THREE.Mesh(new THREE.BoxGeometry(WW, 0.04, -WZ * 2 + 0.06), panelMat);
    floorP.position.set(WXM, FLY - 0.02, 0);
    floorP.receiveShadow = true;
    root.add(wall, floorP);
    // Grid lines: θ every π/4, values every 0.5.
    {
      const gw = [], gf = [];
      for (let k = 0; k <= 8; k++) {
        const x = XC + (U * k * Math.PI) / 4;
        gw.push(x, YC - 1.5, WZ + 0.003, x, YC + 1.5, WZ + 0.003);
        gf.push(x, FLY + 0.002, -1.3, x, FLY + 0.002, 1.3);
      }
      for (let v = -1.5; v <= 1.501; v += 0.5) {
        gw.push(XC, YC + v, WZ + 0.003, XE, YC + v, WZ + 0.003);
        if (Math.abs(v) <= 1.25) gf.push(XC, FLY + 0.002, v, XE, FLY + 0.002, v);
      }
      segs(gw, lineMat('#3b4270', 0.7));
      segs(gf, lineMat('#3b4270', 0.7));
      // Zero lines (the θ axes of the two graphs).
      segs([XC, YC, WZ + 0.004, XE + 0.2, YC, WZ + 0.004], lineMat('#9aa3c7'));
      segs([XC, FLY + 0.003, 0, XE + 0.2, FLY + 0.003, 0], lineMat('#9aa3c7'));
      const names = ['π/2', 'π', '3π/2', '2π'];
      for (let k = 1; k <= 4; k++) {
        const x = XC + (U * k * Math.PI) / 2;
        lab(names[k - 1], '#d6dcff', x, YC - 1.68, WZ + 0.05, 0.62, false);
        lab(names[k - 1], '#d6dcff', x, FLY + 0.02, 1.48, 0.62, false);
      }
      lab('1', COL.sin, WX0 + 0.12, YC + 1 - 0.08, WZ + 0.05, 0.6, false);
      lab('−1', COL.sin, WX0 + 0.12, YC - 1 - 0.08, WZ + 0.05, 0.6, false);
      lab('1', COL.cos, XE + 0.25, FLY + 0.02, 1, 0.6, false);
      lab('−1', COL.cos, XE + 0.25, FLY + 0.02, -1, 0.6, false);
      lab('y = sin θ', COL.sin, XC + 0.7, YC + 1.62, WZ + 0.05, 0.8);
      lab('x = cos θ', COL.cos, XE - 0.5, FLY + 0.02, 1.5, 0.8);
    }

    // ── the θ axis and the full ghost helix ─────────────────────────────────────────────────
    const axis = new THREE.Mesh(stickGeo, glow('#9aa3c7'));
    stick(axis, new V3(XC - 0.4, YC, 0), new V3(XE + 0.5, YC, 0), 0.008);
    const axisHead = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 16), glow('#9aa3c7'));
    axisHead.rotation.z = -Math.PI / 2;
    axisHead.position.set(XE + 0.55, YC, 0);
    root.add(axis, axisHead);
    const axisLab = lab('θ', '#e4e8ff', XE + 0.8, YC, 0, 0.9);
    {
      const gh = [], gs = [], gc = [];
      for (let i = 0; i <= 400; i++) {
        const t = (i / 400) * TAU, x = XC + U * t;
        gh.push(x, YC + Math.sin(t), Math.cos(t));
        gs.push(x, YC + Math.sin(t), WZ + 0.006);
        gc.push(x, FLY + 0.004, Math.cos(t));
      }
      polyline(gh, lineMat(COL.helix, 0.28));
      polyline(gs, lineMat(COL.sin, 0.28));
      polyline(gc, lineMat(COL.cos, 0.28));
    }

    // ── the unit circle ─────────────────────────────────────────────────────────────────────
    const circle = new THREE.Group();
    circle.position.set(XC, YC, 0);
    root.add(circle);
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1, 128),
      new THREE.MeshPhysicalMaterial({ color: COL.math, transparent: true, opacity: 0.1, roughness: 0.08, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }),
    );
    disc.rotation.y = -Math.PI / 2; // circle geometry is in xy; turn it into the yz plane
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.016, 14, 240), new THREE.MeshPhysicalMaterial({ color: '#e8dcff', emissive: COL.math, emissiveIntensity: 0.9, roughness: 0.2, clearcoat: 1 }));
    ring.rotation.y = Math.PI / 2;
    ring.castShadow = true;
    circle.add(disc, ring);
    // In-plane axes (horizontal = cos, vertical = sin).
    const hAx = new THREE.Mesh(stickGeo, glow('#8a93b8')), vAx = new THREE.Mesh(stickGeo, glow('#8a93b8'));
    stick(hAx, new V3(0, 0, -1.3), new V3(0, 0, 1.3), 0.006);
    stick(vAx, new V3(0, -1.3, 0), new V3(0, 1.3, 0), 0.006);
    circle.add(hAx, vAx);
    lab('cos', COL.cos, XC, YC - 0.12, 1.5, 0.62);
    lab('sin', COL.sin, XC, YC + 1.45, 0, 0.62);
    // Special-angle markers and their labels.
    const markGeo = new THREE.SphereGeometry(0.03, 16, 10);
    const markMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', emissive: COL.math, emissiveIntensity: 0.5, roughness: 0.2, clearcoat: 1 });
    const specialLabels = [];
    for (let i = 0; i < 16; i++) {
      const t = SPECIAL_RAD[i];
      const m = new THREE.Mesh(markGeo, markMat);
      m.position.set(0, Math.sin(t), Math.cos(t));
      circle.add(m);
      const l = ctx.label(SPECIAL[i][1], { color: '#e9ddff', size: 0.5, bold: false });
      l.position.set(0, Math.sin(t) * 1.27 - 0.06, Math.cos(t) * 1.27);
      circle.add(l);
      specialLabels.push(l);
    }

    // Radius, legs, triangle, angle arc, the moving point.
    const radius = new THREE.Mesh(stickGeo, glow('#ffffff'));
    const cosLeg = new THREE.Mesh(stickGeo, glow(COL.cos));
    const sinLeg = new THREE.Mesh(stickGeo, glow(COL.sin));
    circle.add(radius, cosLeg, sinLeg);
    const triPos = new Float32Array(9);
    const triGeo = new THREE.BufferGeometry();
    triGeo.setAttribute('position', new THREE.BufferAttribute(triPos, 3));
    const tri = new THREE.Mesh(triGeo, new THREE.MeshBasicMaterial({ color: COL.math, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    tri.frustumCulled = false;
    circle.add(tri);
    const ARC = 97;
    const arcPos = new Float32Array(ARC * 3);
    const arcGeo = new THREE.BufferGeometry();
    arcGeo.setAttribute('position', new THREE.BufferAttribute(arcPos, 3));
    const arc = new THREE.Line(arcGeo, lineMat('#ffffff'));
    arc.frustumCulled = false;
    circle.add(arc);
    const thetaLab = ctx.label('θ', { color: '#ffffff', size: 0.75 });
    circle.add(thetaLab);
    const cosLab = ctx.label('cos θ', { color: COL.cos, size: 0.62 });
    const sinLab = ctx.label('sin θ', { color: COL.sin, size: 0.62 });
    circle.add(cosLab, sinLab);
    let ptLab = ctx.label(' ', { color: '#ffffff', size: 0.72 });
    ptLab.userData.txt = ' ';
    circle.add(ptLab);

    const ballGeo = new THREE.SphereGeometry(0.075, 32, 20);
    const ball = (c) => {
      const m = new THREE.Mesh(ballGeo, new THREE.MeshPhysicalMaterial({ color: '#ffffff', emissive: c, emissiveIntensity: 0.7, roughness: 0.15, clearcoat: 1 }));
      m.castShadow = true;
      return m;
    };
    const cPoint = ball(COL.math);
    circle.add(cPoint);

    // Tangent: the segment on the line x = 1 and the radius line extended to meet it.
    const tanSeg = new THREE.Mesh(stickGeo, glow(COL.tan));
    const tanRay = new THREE.Mesh(stickGeo, glow(COL.tan, { transparent: true, opacity: 0.55 }));
    const tanLine = new THREE.Mesh(stickGeo, glow('#6d6a55'));
    stick(tanLine, new V3(0, -1.6, 1), new V3(0, 1.6, 1), 0.005);
    const tanDot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 12), glow(COL.tan));
    const tanLab = ctx.label('tan θ', { color: COL.tan, size: 0.62 });
    const tanGroup = new THREE.Group();
    tanGroup.add(tanSeg, tanRay, tanLine, tanDot, tanLab);
    circle.add(tanGroup);

    // ── helix, shadows, connectors ───────────────────────────────────────────────────────────
    const HM = 260;
    const hPts = new Float32Array(HM * 3), sPts = new Float32Array(HM * 3), cPts = new Float32Array(HM * 3);
    const helixMat = new THREE.MeshPhysicalMaterial({ color: '#9b5cff', emissive: '#6a2bff', emissiveIntensity: 0.65, roughness: 0.25, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.15, envMapIntensity: 0.6 });
    const helix = makeTube(HM, 12, 0.03, helixMat);
    helix.mesh.castShadow = true;
    const sineT = makeTube(HM, 8, 0.02, glow(COL.sin));
    const cosT = makeTube(HM, 8, 0.02, glow(COL.cos));
    const hPoint = ball(COL.helix), sPoint = ball(COL.sin), fPoint = ball(COL.cos);
    sPoint.scale.setScalar(0.75); fPoint.scale.setScalar(0.75);
    root.add(hPoint, sPoint, fPoint);
    const dash = (c) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const l = new THREE.Line(g, new THREE.LineDashedMaterial({ color: c, dashSize: 0.07, gapSize: 0.05, toneMapped: false }));
      l.frustumCulled = false;
      root.add(l);
      return l;
    };
    const toWall = dash(COL.sin), toFloor = dash(COL.cos), toCircle = dash('#ffffff');
    const setDash = (l, a, b) => {
      const p = l.geometry.attributes.position.array;
      p[0] = a.x; p[1] = a.y; p[2] = a.z; p[3] = b.x; p[4] = b.y; p[5] = b.z;
      l.geometry.attributes.position.needsUpdate = true;
      l.computeLineDistances();
    };

    // ── y = A sin(B(x − C)) on the wall ──────────────────────────────────────────────────────
    const WM = 480;
    const wPts = new Float32Array(WM * 3);
    const waveT = makeTube(WM, 6, 0.011, glow(COL.wave));
    const wPoint = ball(COL.wave);
    wPoint.scale.setScalar(0.7);
    root.add(wPoint);
    function buildWave() {
      for (let i = 0; i < WM; i++) {
        const t = (i / (WM - 1)) * TAU;
        wPts[i * 3] = XC + U * t;
        wPts[i * 3 + 1] = YC + st.A * Math.sin(st.B * (t - st.C));
        wPts[i * 3 + 2] = WZ + 0.012;
      }
      waveT.set(wPts, WM);
      waveT.mesh.visible = wPoint.visible = st.showWave;
      const m = Math.round(st.B * 2); // B in steps of 1/2 → period 2π/B = 4π/m
      rAmp.set(fmt(Math.abs(st.A), 2));
      rPer.set(`2π/${fmt(st.B, 1).replace('.0', '')} = ${piFrac(4, m)} ≈ ${fmt(TAU / st.B, 3)}`);
      rPha.set(`${piFrac(Math.round(st.C / (Math.PI / 12)), 12)} ${st.C > 0 ? '(right)' : st.C < 0 ? '(left)' : ''}`);
      const kC = Math.round(st.C / (Math.PI / 12)), bS = fmt(st.B, 1).replace(".0", "");
      const inner = kC === 0 ? `${bS === "1" ? "" : bS}x` : `${bS === "1" ? "" : bS}(x ${kC < 0 ? "+" : "−"} ${piFrac(Math.abs(kC), 12)})`;
      rEq.set(`y = ${fmt(st.A, 2)} sin(${inner})`);
    }

    // ── update for a new θ ───────────────────────────────────────────────────────────────────
    const P = new V3(), Q = new V3(), O = new V3(), H = new V3(), Wp = new V3(), Fp = new V3();
    let lastReadout = -1, curSpecial = -2;
    function setTheta(theta, force = false) {
      st.theta = theta;
      const c = Math.cos(theta), s = Math.sin(theta);
      // In the circle's local frame: (0, sin, cos).
      O.set(0, 0, 0);
      P.set(0, s, c);
      Q.set(0, 0, c);
      cPoint.position.copy(P);
      stick(radius, O, P, 0.012);
      stick(cosLeg, O, Q, 0.016);
      stick(sinLeg, Q, P, 0.016);
      triPos[3] = 0; triPos[4] = 0; triPos[5] = c;
      triPos[6] = 0; triPos[7] = s; triPos[8] = c;
      triGeo.attributes.position.needsUpdate = true;
      const n = Math.max(2, Math.round((theta / TAU) * (ARC - 1)) + 1);
      for (let i = 0; i < n; i++) {
        const a = (theta * i) / (n - 1);
        arcPos[i * 3] = 0; arcPos[i * 3 + 1] = 0.3 * Math.sin(a); arcPos[i * 3 + 2] = 0.3 * Math.cos(a);
      }
      arcGeo.setDrawRange(0, n);
      arcGeo.attributes.position.needsUpdate = true;
      thetaLab.position.set(0, 0.45 * Math.sin(theta / 2) - 0.06, 0.45 * Math.cos(theta / 2));
      cosLab.position.set(0, s >= 0 ? -0.2 : 0.08, c / 2);
      sinLab.position.set(0, s / 2 - 0.06, c + (c >= 0 ? 0.32 : -0.32));
      cosLab.visible = Math.abs(c) > 0.18;
      sinLab.visible = Math.abs(s) > 0.18;

      // Tangent: the radius line meets x = 1 at height tan θ (drawn up to ±1.6).
      const tanOk = Math.abs(c) > 1e-6;
      tanGroup.visible = st.tan;
      if (st.tan) {
        const tv = tanOk ? s / c : 0;
        const tc = Math.max(-1.6, Math.min(1.6, tv));
        const shown = tanOk && Math.abs(tv) <= 1.6;
        Q.set(0, tc, 1);
        tanSeg.visible = tanDot.visible = tanLab.visible = shown;
        if (shown) {
          stick(tanSeg, Wp.set(0, 0, 1), Q, 0.016);
          tanDot.position.copy(Q);
          tanLab.position.set(0, tc / 2 - 0.06, 1.38);
        }
        // Radius line extended through the centre to x = 1 (or as far as the chart goes).
        if (tanOk) {
          const k = Math.min(1, 1.6 / Math.max(1e-9, Math.abs(tv)));
          stick(tanRay, O, Fp.set(0, tv * k, k), 0.006);
        } else tanRay.visible = false;
      }

      // Helix and its shadows, from 0 to θ.
      const m = Math.max(2, Math.min(HM, Math.round((theta / TAU) * (HM - 1)) + 1));
      for (let i = 0; i < m; i++) {
        const t = (theta * i) / (m - 1), x = XC + U * t, ct = Math.cos(t), sn = Math.sin(t);
        hPts[i * 3] = x; hPts[i * 3 + 1] = YC + sn; hPts[i * 3 + 2] = ct;
        sPts[i * 3] = x; sPts[i * 3 + 1] = YC + sn; sPts[i * 3 + 2] = WZ + 0.04;
        cPts[i * 3] = x; cPts[i * 3 + 1] = FLY + 0.02; cPts[i * 3 + 2] = ct;
      }
      const draw = theta > 1e-4 ? m : 0;
      helix.set(hPts, draw); sineT.set(sPts, draw); cosT.set(cPts, draw);
      const x = XC + U * theta;
      H.set(x, YC + s, c);
      Wp.set(x, YC + s, WZ + 0.04);
      Fp.set(x, FLY + 0.02, c);
      hPoint.position.copy(H); sPoint.position.copy(Wp); fPoint.position.copy(Fp);
      setDash(toWall, H, Wp);
      setDash(toFloor, H, Fp);
      setDash(toCircle, P.set(XC, YC + s, c), H);
      toCircle.visible = theta > 0.05;
      wPoint.position.set(x, YC + st.A * Math.sin(st.B * (theta - st.C)), WZ + 0.03);

      // Exact values at special angles.
      let sp = -1;
      for (let i = 0; i < SPECIAL_RAD.length; i++) if (Math.abs(theta - SPECIAL_RAD[i]) < 1e-6) { sp = i; break; }
      if (sp !== curSpecial) {
        curSpecial = sp;
        const txt = sp >= 0 ? `(${SPECIAL[sp][2]}, ${SPECIAL[sp][3]})` : ' ';
        ptLab = ctx.relabel(ptLab, txt, { color: '#ffffff', size: 0.72 });
        ptLab.visible = sp >= 0;
      }
      if (sp >= 0) ptLab.position.set(0, s + (s >= 0 ? 0.14 : -0.42), c + (c >= 0 ? 0.95 : -0.95));

      // Readouts (throttled while playing).
      const now = performance.now();
      if (!force && now - lastReadout < 90) return;
      lastReadout = now;
      const deg = (theta * 180) / Math.PI;
      if (sp >= 0) {
        const [d, r, cs, sn, tn] = SPECIAL[sp];
        rTheta.set(`<b>${r}</b> rad ≈ ${fmt(theta)}`);
        rDeg.set(`${d}°`);
        rCos.set(`<b style="color:${COL.cos}">${cs}</b> ≈ ${fmt(c)}`);
        rSin.set(`<b style="color:${COL.sin}">${sn}</b> ≈ ${fmt(s)}`);
        rTan.set(tn === 'undefined' ? 'undefined (cos θ = 0)' : `<b style="color:${COL.tan}">${tn}</b> ≈ ${fmt(s / c)}`);
      } else {
        rTheta.set(`${fmt(theta)} rad`);
        rDeg.set(`${fmt(deg, 1)}°`);
        rCos.set(`<span style="color:${COL.cos}">${fmt(c)}</span>`);
        rSin.set(`<span style="color:${COL.sin}">${fmt(s)}</span>`);
        rTan.set(Math.abs(c) < 1e-9 ? 'undefined' : `<span style="color:${COL.tan}">${fmt(s / c)}</span>`);
      }
      const q = theta % TAU;
      const quad = [0, 90, 180, 270, 360].some((a) => Math.abs(deg - a) < 1e-6) ? 'on an axis' : `quadrant ${['I', 'II', 'III', 'IV'][Math.floor(q / (Math.PI / 2)) % 4]}`;
      rQuad.set(quad);
      rId.set(`cos²θ + sin²θ = ${fmt(c * c, 3)} + ${fmt(s * s, 3)} = ${fmt(c * c + s * s, 3)}`);
      rWy.set(fmt(st.A * Math.sin(st.B * (theta - st.C))));
    }

    // ── controls ─────────────────────────────────────────────────────────────────────────────
    const snapTheta = (v) => {
      if (!st.snap) return v;
      for (const r of SPECIAL_RAD) if (Math.abs(v - r) < (4 * Math.PI) / 180) return r;
      return v;
    };
    const sTheta = ui.slider('Angle θ', {
      min: 0, max: TAU, step: 0.001, value: st.theta,
      fmt: (v) => `${fmt(v, 2)} rad · ${fmt((v * 180) / Math.PI, 0)}°`,
      onChange: (v) => { stop(); setTheta(snapTheta(v), true); },
    });
    const step = (dir) => {
      stop();
      const eps = 1e-6;
      let t;
      if (dir > 0) t = SPECIAL_RAD.find((r) => r > st.theta + eps) ?? 0;
      else t = [...SPECIAL_RAD].reverse().find((r) => r < st.theta - eps) ?? TAU;
      setTheta(t, true);
      sTheta.set(t);
    };
    ui.button('◀ Special', () => step(-1));
    const playBtn = ui.button(st.playing ? 'Pause' : 'Play', () => { st.playing = !st.playing; playBtn.textContent = st.playing ? 'Pause' : 'Play'; }, { primary: true });
    ui.button('Special ▶', () => step(1));
    const stop = () => { st.playing = false; playBtn.textContent = 'Play'; };
    ui.slider('Speed', { min: 0.1, max: 2, step: 0.05, value: st.speed, fmt: (v) => `${fmt(v, 2)} rad/s`, onChange: (v) => (st.speed = v) });
    ui.toggle('Snap to special angles', { value: st.snap, onChange: (v) => (st.snap = v) });
    ui.toggle('Show tan θ', { value: st.tan, onChange: (v) => { st.tan = v; setTheta(st.theta, true); } });
    let labelsOn = true, labelOp = -1;
    const camDir = new V3();
    ui.toggle('Label special angles (when facing the circle)', { value: true, onChange: (v) => { labelsOn = v; labelOp = -1; } });
    const rTheta = ui.readout('θ');
    const rDeg = ui.readout('Degrees');
    const rCos = ui.readout('cos θ');
    const rSin = ui.readout('sin θ');
    const rTan = ui.readout('tan θ');
    const rQuad = ui.readout('Where');
    const rId = ui.note('');

    ui.heading('Wave on the wall: y = A sin(B(x − C))');
    ui.toggle('Show the wave', { value: st.showWave, onChange: (v) => { st.showWave = v; buildWave(); } });
    ui.slider('Amplitude A', { min: -1.5, max: 1.5, step: 0.05, value: st.A, fmt: (v) => fmt(v, 2), onChange: (v) => { st.A = v; buildWave(); setTheta(st.theta, true); } });
    ui.slider('Frequency B', { min: 0.5, max: 4, step: 0.5, value: st.B, fmt: (v) => fmt(v, 1), onChange: (v) => { st.B = v; buildWave(); setTheta(st.theta, true); } });
    ui.slider('Phase shift C', { min: -Math.PI, max: Math.PI, step: Math.PI / 12, value: st.C, fmt: (v) => piFrac(Math.round(v / (Math.PI / 12)), 12), onChange: (v) => { st.C = v; buildWave(); setTheta(st.theta, true); } });
    const rEq = ui.readout('Equation');
    const rAmp = ui.readout('Amplitude |A|');
    const rPer = ui.readout('Period 2π/B');
    const rPha = ui.readout('Phase shift C');
    const rWy = ui.readout('y at the current θ');

    ui.heading('Look from');
    const views = {
      '3d': this.view,
      axis: { yaw: -Math.PI / 2, pitch: 0.02, dist: 6.2, target: [XC, YC, 0] },
      wall: { yaw: 0, pitch: 0.03, dist: 8.2, target: [0, YC, 0] },
      floor: { yaw: 0, pitch: 1.38, dist: 8.2, target: [0, 0.2, 0] },
    };
    ui.choice('', {
      options: [{ value: '3d', label: '3D' }, { value: 'axis', label: 'Down the θ axis' }, { value: 'wall', label: 'Sine wall' }, { value: 'floor', label: 'Cos floor' }],
      value: '3d',
      onChange: (v) => ctx.view(views[v]),
    });
    ui.note('Down the θ axis the helix collapses to the circle. From the front it is a sine wave; from above, a cosine wave.');

    buildWave();
    st.theta = snapTheta(st.theta);
    setTheta(st.theta, true);
    snapView(params.get('look') && views[params.get('look')] ? views[params.get('look')] : this.view, params);

    return {
      update(dt) {
        // The 16 angle names only make sense when you look at the circle face-on (down the θ axis).
        ctx.camera.getWorldDirection(camDir);
        const op = labelsOn ? Math.min(1, Math.max(0, (Math.abs(camDir.x) - 0.78) / 0.15)) : 0;
        axisLab.visible = Math.abs(camDir.x) < 0.8;
        if (Math.abs(op - labelOp) > 0.02) {
          labelOp = op;
          for (const l of specialLabels) { l.visible = op > 0.02; l.material.opacity = op; }
        }
        if (!st.playing) return;
        let t = st.theta + st.speed * dt;
        if (t > TAU) t -= TAU;
        setTheta(t);
        sTheta.set(t);
      },
      onKey(e) {
        if (e.key === ' ') { st.playing = !st.playing; playBtn.textContent = st.playing ? 'Pause' : 'Play'; e.preventDefault(); }
        if (e.key === 'ArrowRight') step(1);
        if (e.key === 'ArrowLeft') step(-1);
      },
      dispose() { stickGeo.dispose(); markGeo.dispose(); ballGeo.dispose(); },
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
