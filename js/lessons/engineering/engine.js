// The Four-Stroke Engine: a cutaway petrol engine (single cylinder, or an inline-4) with a
// slider-crank piston, connecting rod, counterweighted crankshaft, twin overhead camshafts driven
// at half crank speed by a toothed belt, poppet valves lifted by real cam profiles, a spark plug
// and the cylinder's gas coloured by what it holds.
//
// Kinematics: piston-pin height above the crank axis  x = r·cosθ + √(l² − r²·sin²θ).
// Valve lift is the cam's support function in the follower direction (a flat bucket tappet),
// so the tappet always touches the drawn lobe.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { gear } from '../../home.js';

const D2R = Math.PI / 180;
const MM = 107.5;          // model units → millimetres (bore 0.8 → 86 mm)
const R_BORE = 0.4;        // bore radius
const R_CRANK = 0.4;       // crank radius (stroke 0.8 = 86 mm)
const L_ROD = 1.35;        // con-rod length (145 mm)
const Y_CRANK = 0.95;      // crank axis height
const PIN_TO_CROWN = 0.22; // wrist pin → piston crown
const Y_ROOF = 3.0;        // combustion-chamber roof (head face)
const Y_DECK = 1.55;       // bottom of the cylinder block
const Y_HEAD = 3.4;        // top of the head
const TILT = 0.2;          // valve tilt from vertical (rad)
const SEAT_X = 0.2;        // valve seat offset from the bore axis
const RB = 0.13;           // cam base-circle radius
const LIFT = 0.075;        // max valve lift (8 mm)
const CAM_W = 1.15;        // lobe half-width (cam rad) → ~264° crank duration
const CAM_U = 0.72 + RB;   // cam centre distance along the valve axis
const IN_CENTRE = 105;     // intake lobe centreline, crank deg after TDC (intake)
const EX_CENTRE = 615;     // exhaust lobe centreline (105° before TDC overlap)
const SPARK = 352;         // ignition, 8° before TDC on compression
const PITCH = 1.0;         // inline-4 bore spacing
const STROKES = [
  { name: 'Intake', col: '#5ab4ff', tip: 'Piston moves down, intake valve open: fuel–air mixture is drawn in.' },
  { name: 'Compression', col: '#7d8cff', tip: 'Both valves closed: piston squeezes the mixture to about 1/11 of its volume.' },
  { name: 'Power', col: '#ff9a3c', tip: 'Spark ignites the mixture; hot, high-pressure gas drives the piston down.' },
  { name: 'Exhaust', col: '#aab2bd', tip: 'Exhaust valve open: piston pushes the burnt gas out.' },
];

const pinHeight = (thDeg) => {
  const t = thDeg * D2R, s = Math.sin(t);
  return R_CRANK * Math.cos(t) + Math.sqrt(L_ROD * L_ROD - R_CRANK * R_CRANK * s * s);
};
const X_TDC = R_CRANK + L_ROD;

const INFO = {
  piston: ['Piston', '<p>A cast-aluminium plug that slides up and down the cylinder. Its crown takes the push of the burning gas; in the power stroke the pressure can be more than 50 times atmospheric pressure.</p><p>The three <b>piston rings</b> spring outward against the cylinder wall: the top two seal in the gas, the bottom one scrapes oil back down.</p>'],
  rod: ['Connecting rod', '<p>Links the piston\'s <b>wrist pin</b> (small end) to a crank pin (big end). It turns the piston\'s straight-line motion into rotation. Because the rod tilts as the crank turns, the piston moves faster near the top than near the bottom, so its motion is not a pure sine wave.</p>'],
  crank: ['Crankshaft', '<p>Turns up-and-down force into rotation. Each <b>crank pin</b> is offset from the main axis by the crank radius <i>r</i> (half the stroke).</p><p>The heavy <b>counterweights</b> opposite each pin balance the swinging rod and pin, so the engine runs smoothly.</p>'],
  cam: ['Camshaft', '<p>An egg-shaped <b>lobe</b> pushes each valve open once per turn. The camshaft is belt-driven from the crank with a 2 : 1 sprocket ratio, so it turns at <b>half crank speed</b>: each valve opens once every two crank turns (once per four-stroke cycle).</p>'],
  intake: ['Intake valve', '<p>A <b>poppet valve</b>: a mushroom-shaped disc on a stem. The cam pushes it down into the cylinder to open it; the spring snaps it shut onto its seat. It lets fuel–air mixture in during the intake stroke and is the larger of the two valves in most engines.</p>'],
  exhaust: ['Exhaust valve', '<p>Opens near the end of the power stroke and stays open through the exhaust stroke so the rising piston can push the burnt gas out into the exhaust pipe. It runs very hot (several hundred °C).</p>'],
  spring: ['Valve spring', '<p>Closes the valve again once the cam lobe has passed, and keeps the bucket tappet pressed against the cam.</p>'],
  plug: ['Spark plug', '<p>A high-voltage pulse (tens of thousands of volts) jumps the gap between its electrodes. It fires a few degrees <b>before</b> top dead centre at the end of compression, because the flame takes a moment to spread; peak pressure then arrives just after TDC, as the power stroke begins.</p>'],
  block: ['Cylinder block', '<p>The cast body that holds the cylinder bores. In this cutaway the front has been sliced away (the orange faces are the cut) so you can see inside. The blue channels are the <b>water jacket</b>: coolant flows through them to carry heat away. The cylinder walls are lined with hard steel that the rings slide on.</p>'],
  head: ['Cylinder head', '<p>Caps the cylinder and forms the roof of the combustion chamber. It holds the valves, ports, spark plug and camshafts. A gasket seals it to the block.</p>'],
  belt: ['Timing belt', '<p>A toothed belt links the crankshaft sprocket to the camshaft sprockets. The cam sprockets have <b>twice as many teeth</b> (28 vs 14), so the cams turn once for every two crank turns, keeping valves in step with the piston.</p>'],
  gas: ['Cylinder gas', '<p><b style="color:#5ab4ff">Blue</b>: fuel–air mixture (intake, compression). <b style="color:#ff9a3c">Orange</b>: burning gas (power). <b style="color:#aab2bd">Grey</b>: exhaust gas being pushed out.</p>'],
  intakePort: ['Intake port', '<p>The passage that carries air and fuel to the intake valve.</p>'],
  exhaustPort: ['Exhaust port', '<p>Carries hot burnt gas from the exhaust valve to the exhaust pipe.</p>'],
};

export default {
  view: { dist: 7.4, yaw: 0.42, pitch: 0.2, target: [0, 1.85, 0], minDist: 3, maxDist: 18 },
  explain: `
<p>Most cars and motorbikes run on a <b>four-stroke</b> engine. A piston slides in a cylinder; a
<b>connecting rod</b> joins it to the <b>crankshaft</b>, which turns. One full cycle takes
<b>four strokes</b> (piston trips) and <b>two crank turns (720°)</b>:</p>
<ol>
<li><b>Intake</b> (0–180°): piston goes down, intake valve open, fuel–air mixture is drawn in.</li>
<li><b>Compression</b> (180–360°): both valves shut, piston goes up and squeezes the mixture.</li>
<li><b>Power</b> (360–540°): the spark plug fires just before the top; the burning gas expands and shoves the piston down. This is the only stroke that makes work.</li>
<li><b>Exhaust</b> (540–720°): exhaust valve open, piston goes up and pushes the burnt gas out.</li>
</ol>
<p>The <b>camshafts</b> open the valves. They are driven at <b>half crank speed</b>, so each valve opens
once per cycle. Real valves open a little early and close a little late, so near the top between
exhaust and intake both are slightly open at once (<b>valve overlap</b>).</p>
<p>This model is an 86 mm bore × 86 mm stroke engine with a 145 mm rod and an 11 : 1 compression
ratio. The piston position comes from the slider-crank equation below, where <i>r</i> is the crank
radius (half the stroke), <i>l</i> the rod length and θ the crank angle. An inline-4 fires its
cylinders in the order 1-3-4-2, so there is a power stroke every 180° of crank rotation.</p>`,
  formula: 'Piston pin height: <i>x</i> = <i>r</i> cos θ + √(<i>l</i>² − <i>r</i>² sin² θ)<br>Cam angle = ½ × crank angle<br>Compression ratio = (<i>V</i><sub>swept</sub> + <i>V</i><sub>clearance</sub>) ÷ <i>V</i><sub>clearance</sub>',
  vocab: [
    ['Stroke', 'One trip of the piston between top and bottom, and also the distance it travels (here 86 mm).'],
    ['TDC / BDC', 'Top dead centre / bottom dead centre: the highest and lowest piston positions, where it stops for an instant.'],
    ['Crankshaft', 'The shaft that turns the piston\'s up-and-down motion into rotation.'],
    ['Camshaft', 'A shaft with lobes that push the valves open; it turns at half crank speed.'],
    ['Poppet valve', 'A mushroom-shaped valve that is pushed open into the cylinder and closed by a spring.'],
    ['Compression ratio', 'Cylinder volume at BDC divided by volume at TDC (about 11 : 1 here).'],
    ['Valve overlap', 'The few degrees around TDC when the exhaust and intake valves are both slightly open.'],
    ['Firing order', 'The order the cylinders of a multi-cylinder engine fire in (1-3-4-2 for most inline-4s).'],
  ],
  standards: ['NGSS HS-PS3-3'],
  quiz: [
    { q: 'How many times does the crankshaft turn during one complete four-stroke cycle?', choices: ['Once', 'Twice', 'Four times', 'Half a turn'], answer: 1, why: 'Each stroke is half a turn (180°), so four strokes take 720°, two full turns.' },
    { q: 'How fast does the camshaft turn compared with the crankshaft?', choices: ['Twice as fast', 'The same speed', 'Half as fast', 'A quarter as fast'], answer: 2, why: 'Each valve must open once per cycle, and a cycle is two crank turns, so the cam turns once per two crank turns. Its sprocket has twice the teeth of the crank sprocket.' },
    { q: 'In which stroke are both valves closed while the piston moves DOWN?', choices: ['Intake', 'Compression', 'Power', 'Exhaust'], answer: 2, why: 'In the power stroke the burning gas pushes the piston down with both valves shut. In compression both are shut too, but the piston moves up.' },
    { q: 'A cylinder holds 550 cm³ with the piston at BDC and 50 cm³ at TDC. What is its compression ratio?', choices: ['10 : 1', '11 : 1', '12 : 1', '500 : 1'], answer: 1, why: 'Compression ratio = largest volume ÷ smallest volume = 550 ÷ 50 = 11.' },
    { q: 'An inline-4 fires 1-3-4-2. How many power strokes happen for every turn of its crankshaft?', choices: ['1', '2', '4', '8'], answer: 1, why: 'Four cylinders each fire once per 720°, so there is one power stroke every 180°: two per crank turn.' },
  ],

  build(ctx) {
    const { root } = ctx;
    const params = new URLSearchParams(location.search);

    // ── materials ──
    const M = {
      alu: new THREE.MeshStandardMaterial({ color: 0xb4b9c1, metalness: 0.85, roughness: 0.42 }),
      piston: new THREE.MeshStandardMaterial({ color: 0xd2d5da, metalness: 0.9, roughness: 0.26 }),
      steel: new THREE.MeshStandardMaterial({ color: 0xd8dce2, metalness: 1, roughness: 0.18 }),
      forged: new THREE.MeshStandardMaterial({ color: 0x8e949d, metalness: 1, roughness: 0.3 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x3a3e46, metalness: 1, roughness: 0.34 }),
      liner: new THREE.MeshStandardMaterial({ color: 0x9da3ab, metalness: 1, roughness: 0.22, side: THREE.DoubleSide }),
      cut: new THREE.MeshStandardMaterial({ color: 0xd9782a, metalness: 0.2, roughness: 0.62 }),
      caseIn: new THREE.MeshStandardMaterial({ color: 0x4b525d, metalness: 0.7, roughness: 0.55 }),
      jacket: new THREE.MeshStandardMaterial({ color: 0x1f4f8a, metalness: 0.1, roughness: 0.4, emissive: 0x0a2240 }),
      spring: new THREE.MeshStandardMaterial({ color: 0x4f78b8, metalness: 0.7, roughness: 0.35 }),
      exhaust: new THREE.MeshStandardMaterial({ color: 0x9a6e52, metalness: 1, roughness: 0.42, side: THREE.DoubleSide }),
      runner: new THREE.MeshPhysicalMaterial({ color: 0x2a2e36, metalness: 0.2, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.15, side: THREE.DoubleSide }),
      ceramic: new THREE.MeshPhysicalMaterial({ color: 0xf2f0ea, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 }),
      rubber: new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.75, metalness: 0, side: THREE.DoubleSide }),
      ghost: new THREE.MeshStandardMaterial({ color: 0x9cc0ff, metalness: 0, roughness: 0.2, transparent: true, opacity: 0.05, depthWrite: false, side: THREE.DoubleSide }),
      edge: new THREE.LineBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.35 }),
      mark: new THREE.MeshBasicMaterial({ color: 0xffb347, toneMapped: false }),
      spark: new THREE.MeshBasicMaterial({ color: 0xcfe8ff, toneMapped: false, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }),
    };
    M.cutBox = [M.alu, M.alu, M.alu, M.alu, M.cut, M.alu]; // +z face is the cut

    // Belt teeth texture (scrolls with the belt).
    const beltTex = (() => {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 16;
      const g = c.getContext('2d');
      g.fillStyle = '#26282d'; g.fillRect(0, 0, 64, 16);
      g.fillStyle = '#3d4048'; g.fillRect(0, 0, 30, 16);
      g.fillStyle = '#ffb347'; g.fillRect(0, 6, 3, 4);
      const t = new THREE.CanvasTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    M.belt = new THREE.MeshStandardMaterial({ map: beltTex, roughness: 0.7, metalness: 0, side: THREE.DoubleSide });

    // ── shared geometry ──
    const G = {};
    const zCyl = (geo) => geo.rotateX(Math.PI / 2);
    G.piston = (() => {
      const p = [[0, 0.1], [0.3, 0.1], [0.345, 0.02], [0.345, -0.32], [0.392, -0.32], [0.392, 0.005]];
      for (const y of [0.035, 0.105, 0.175]) p.push([0.392, y - 0.018], [0.372, y - 0.018], [0.372, y + 0.018], [0.392, y + 0.018]);
      p.push([0.392, PIN_TO_CROWN - 0.012], [0.38, PIN_TO_CROWN], [0, PIN_TO_CROWN]);
      return new THREE.LatheGeometry(p.map(([x, y]) => new THREE.Vector2(x, y)), 56);
    })();
    G.rings = mergeGeometries([0.035, 0.105, 0.175].map((y) => new THREE.TorusGeometry(0.383, 0.0135, 8, 64).rotateX(Math.PI / 2).translate(0, y, 0)));
    G.wristPin = zCyl(new THREE.CylinderGeometry(0.068, 0.068, 0.62, 24));
    G.rod = (() => {
      const s = new THREE.Shape(), l = L_ROD;
      s.moveTo(0.115, 0);
      s.absarc(0, 0, 0.115, 0, Math.PI, false);
      s.lineTo(-0.062, -0.2);
      s.lineTo(-0.09, -l + 0.24);
      s.lineTo(-0.215, -l);
      s.absarc(0, -l, 0.215, Math.PI, Math.PI * 2, false);
      s.lineTo(0.09, -l + 0.24);
      s.lineTo(0.062, -0.2);
      s.lineTo(0.115, 0);
      const h1 = new THREE.Path(); h1.absarc(0, 0, 0.07, 0, Math.PI * 2, true);
      const h2 = new THREE.Path(); h2.absarc(0, -l, 0.112, 0, Math.PI * 2, true);
      s.holes.push(h1, h2);
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 28 });
      g.translate(0, 0, -0.05);
      return g;
    })();
    // Rod cap bolts and the cap split line.
    G.rodBolts = mergeGeometries([-0.16, 0.16].map((x) => new THREE.CylinderGeometry(0.03, 0.03, 0.1, 6).translate(x, -L_ROD - 0.12, 0)));
    G.web = (() => {
      const s = new THREE.Shape();
      const N = 28;
      for (let i = 0; i <= N; i++) {
        const a = Math.PI + 0.42 + (i / N) * (Math.PI - 0.84);
        const x = 0.52 * Math.cos(a), y = 0.52 * Math.sin(a);
        i ? s.lineTo(x, y) : s.moveTo(x, y);
      }
      for (let i = 0; i <= N; i++) {
        const a = -0.25 + (i / N) * (Math.PI + 0.5);
        s.lineTo(0.2 * Math.cos(a), R_CRANK + 0.2 * Math.sin(a));
      }
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 3 });
      return g;
    })();
    G.crankPin = zCyl(new THREE.CylinderGeometry(0.11, 0.11, 0.36, 32)).translate(0, R_CRANK, 0);
    G.liner = new THREE.CylinderGeometry(R_BORE, R_BORE, Y_ROOF - Y_DECK, 64, 1, true, Math.PI / 2, Math.PI).translate(0, (Y_ROOF + Y_DECK) / 2, 0);
    G.gas = new THREE.CylinderGeometry(0.384, 0.384, 1, 48).translate(0, 0.5, 0);
    G.valve = (() => {
      const p = [[0, 0], [0.15, 0], [0.15, 0.018]];
      for (let i = 1; i <= 10; i++) { const t = i / 10; p.push([0.15 - 0.122 * Math.sin(t * Math.PI / 2), 0.018 + 0.12 * (1 - Math.cos(t * Math.PI / 2))]); }
      p.push([0.028, 0.66], [0.022, 0.67], [0, 0.67]);
      return new THREE.LatheGeometry(p.map(([x, y]) => new THREE.Vector2(x, y)), 40);
    })();
    G.bucket = new THREE.LatheGeometry([[0, 0.6], [0.06, 0.6], [0.06, 0.63], [0.098, 0.63], [0.1, 0.64], [0.1, 0.712], [0.094, 0.72], [0, 0.72]].map(([x, y]) => new THREE.Vector2(x, y)), 40);
    G.spring = (() => {
      const pts = [], turns = 6, n = 200;
      for (let i = 0; i <= n; i++) { const t = i / n, a = t * turns * Math.PI * 2; pts.push(new THREE.Vector3(0.068 * Math.cos(a), t, 0.068 * Math.sin(a))); }
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, 0.012, 6, false);
    })();
    G.seat = new THREE.CylinderGeometry(0.09, 0.09, 0.02, 32).translate(0, 0.01, 0);
    // Cam lobe: polar profile r(ψ) = rb + L·½(1 + cos(πψ/w)) inside |ψ| < w, nose at ψ = 0 (+x).
    const LOBE_N = 120, lobePsi = new Float32Array(LOBE_N), lobeR = new Float32Array(LOBE_N);
    G.lobe = (() => {
      const s = new THREE.Shape();
      for (let i = 0; i < LOBE_N; i++) {
        let a = (i / LOBE_N) * Math.PI * 2; if (a > Math.PI) a -= Math.PI * 2;
        const r = RB + (Math.abs(a) < CAM_W ? LIFT * 0.5 * (1 + Math.cos((Math.PI * a) / CAM_W)) : 0);
        lobePsi[i] = a; lobeR[i] = r;
        const x = r * Math.cos(a), y = r * Math.sin(a);
        i ? s.lineTo(x, y) : s.moveTo(x, y);
      }
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 });
      g.translate(0, 0, -0.05);
      return g;
    })();
    const camLift = (rot, beta) => {
      let m = -1;
      for (let i = 0; i < LOBE_N; i++) { const v = lobeR[i] * Math.cos(lobePsi[i] + rot - beta); if (v > m) m = v; }
      return Math.max(0, m - RB);
    };
    G.plug = (() => {
      const parts = [];
      parts.push(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 16).translate(0, 0.1, 0));                         // thread
      parts.push(new THREE.CylinderGeometry(0.075, 0.075, 0.1, 6).translate(0, 0.27, 0));                      // hex
      return mergeGeometries(parts);
    })();
    G.plugTip = new THREE.BoxGeometry(0.012, 0.03, 0.012).translate(0.012, -0.012, 0);
    G.insulator = new THREE.LatheGeometry([[0, 0.32], [0.05, 0.32], [0.05, 0.36], [0.04, 0.4], [0.042, 0.44], [0.036, 0.46], [0.04, 0.5], [0.034, 0.52], [0.038, 0.56], [0.03, 0.6], [0.018, 0.62], [0, 0.62]].map(([x, y]) => new THREE.Vector2(x, y)), 28);
    G.terminal = new THREE.CylinderGeometry(0.02, 0.02, 0.07, 12).translate(0, 0.655, 0);
    G.sparkBall = new THREE.SphereGeometry(0.05, 16, 12);
    G.bolt = mergeGeometries([new THREE.CylinderGeometry(0.042, 0.042, 0.04, 6).translate(0, 0.03, 0), new THREE.CylinderGeometry(0.058, 0.058, 0.012, 20).translate(0, 0.006, 0)]);

    // ── helpers ──
    const shadow = (o) => { o.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } }); return o; };
    const box = (x0, x1, y0, y1, z0, z1, mat) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat);
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      return m;
    };
    const ghostBox = (x0, x1, y0, y1, z0, z1) => {
      const m = box(x0, x1, y0, y1, z0, z1, M.ghost);
      m.renderOrder = 5;
      m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), M.edge));
      return m;
    };
    // Back half of a tube along a planar (xy) curve: the front half is "cut away".
    const halfTube = (curve, radius, segs = 48, radial = 12) => {
      const frames = curve.computeFrenetFrames(segs, false);
      const pos = [], idx = [];
      const P = new THREE.Vector3();
      for (let i = 0; i <= segs; i++) {
        curve.getPointAt(i / segs, P);
        const N = frames.normals[i], B = frames.binormals[i];
        const flip = B.z > 0 ? Math.PI : 0;
        for (let j = 0; j <= radial; j++) {
          const v = flip + (j / radial) * Math.PI;
          const c = Math.cos(v), s = Math.sin(v);
          pos.push(P.x + radius * (c * N.x + s * B.x), P.y + radius * (c * N.y + s * B.y), P.z + radius * (c * N.z + s * B.z));
        }
      }
      for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
        const a = i * (radial + 1) + j, b = a + radial + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    };
    // A flat toothed belt around circles (listed counter-clockwise), as a ribbon in z.
    const beltRibbon = (circles, z, width) => {
      const n = circles.length, tang = [];
      for (let i = 0; i < n; i++) {
        const a = circles[i], b = circles[(i + 1) % n];
        const dx = b.x - a.x, dy = b.y - a.y, D = Math.hypot(dx, dy);
        const ux = dx / D, uy = dy / D, s = (a.r - b.r) / D, c = Math.sqrt(1 - s * s);
        const nx = uy * c + ux * s, ny = -ux * c + uy * s;
        tang.push({ ang: Math.atan2(ny, nx), p1: [a.x + a.r * nx, a.y + a.r * ny], p2: [b.x + b.r * nx, b.y + b.r * ny] });
      }
      const pts = [];
      for (let i = 0; i < n; i++) {
        const c = circles[i], tin = tang[(i - 1 + n) % n], tout = tang[i];
        let a0 = tin.ang, a1 = tout.ang;
        while (a1 < a0) a1 += Math.PI * 2;
        const steps = Math.max(2, Math.ceil((a1 - a0) / 0.08));
        for (let k = 0; k <= steps; k++) { const a = a0 + ((a1 - a0) * k) / steps; pts.push([c.x + c.r * Math.cos(a), c.y + c.r * Math.sin(a)]); }
      }
      pts.push(pts[0]);
      const pos = [], uv = [], idx = [];
      let len = 0;
      for (let i = 0; i < pts.length; i++) {
        if (i) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        pos.push(pts[i][0], pts[i][1], z - width / 2, pts[i][0], pts[i][1], z + width / 2);
        uv.push(len / 0.05, 0, len / 0.05, 1);
        if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    };

    const labelsOn = { v: !params.has('nolabels') };
    const allLabels = [];
    const addLabel = (parent, text, x, y, z, color = '#ffd9a0') => {
      const l = ctx.label(text, { color, size: 0.72 });
      l.position.set(x, y, z);
      l.visible = labelsOn.v;
      parent.add(l);
      allLabels.push(l);
      return l;
    };
    const pick = (obj, key) => ctx.pickable(obj, () => ctx.card(INFO[key][0], INFO[key][1], { kind: 'Engine part' }));

    // ── build one engine (single or inline-4) ──
    function buildEngine(n) {
      const eng = new THREE.Group();
      eng.scale.setScalar(0.85);
      const single = n === 1;
      // Cylinder k sits at z; firing-order phase φ: cylinder 1 at 0, 3 at 180, 4 at 360, 2 at 540.
      const PHASE = [0, 540, 180, 360];
      const cyls = [];
      const zs = [];
      for (let k = 0; k < n; k++) zs.push(single ? 0 : (k - 1.5) * PITCH);
      const zMin = zs[0], zMax = zs[n - 1];
      const zBack = zMin - 0.55, zFront = zMax + 0.55, zBelt = zMin - 0.7;

      // Crankshaft (one rotating group).
      const crank = new THREE.Group();
      crank.position.y = Y_CRANK;
      eng.add(crank);
      const journals = [];
      for (let k = 0; k < n; k++) {
        const th = new THREE.Group();
        th.position.z = zs[k];
        th.rotation.z = (PHASE[k] % 360) * D2R;
        const w1 = new THREE.Mesh(G.web, M.forged); w1.position.z = 0.075;
        const w2 = new THREE.Mesh(G.web, M.forged); w2.position.z = -0.145;
        const pinM = new THREE.Mesh(G.crankPin, M.steel);
        th.add(w1, w2, pinM);
        crank.add(th);
      }
      // Main journals between and beyond the throws.
      const jz = [zBelt - 0.08];
      for (const z of zs) jz.push(z - 0.16, z + 0.16);
      jz.push(single ? 0.66 : zFront + 0.1);
      for (let i = 0; i < jz.length; i += 2) {
        const len = jz[i + 1] - jz[i];
        const j = new THREE.Mesh(zCyl(new THREE.CylinderGeometry(0.13, 0.13, len, 32)), M.steel);
        j.position.z = (jz[i] + jz[i + 1]) / 2;
        crank.add(j);
        journals.push(j);
      }
      // Front pulley (harmonic balancer) with a timing mark.
      const pulley = new THREE.Mesh(zCyl(new THREE.LatheGeometry([[0.13, -0.05], [0.24, -0.05], [0.24, -0.02], [0.225, -0.01], [0.24, 0], [0.225, 0.01], [0.24, 0.02], [0.24, 0.05], [0.13, 0.05]].map(([x, y]) => new THREE.Vector2(x, y)), 48)), M.dark);
      pulley.position.z = (single ? 0.66 : zFront + 0.1) - 0.05;
      const pmark = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.01), M.mark);
      pmark.position.set(0, 0.2, 0.052);
      pulley.add(pmark);
      crank.add(pulley);
      const cs = gear(14, 0.13, M.steel, 0.1);
      cs.position.z = zBelt;
      crank.add(cs);
      shadow(crank);
      pick(crank, 'crank');

      // Camshafts.
      const camC = [];
      for (const side of [-1, 1]) {
        const dirx = side * Math.sin(TILT), diry = Math.cos(TILT);
        camC.push({ x: side * SEAT_X + dirx * CAM_U, y: Y_ROOF + diry * CAM_U });
      }
      const cams = camC.map((c, si) => {
        const g = new THREE.Group();
        g.position.set(c.x, c.y, 0);
        const shaft = new THREE.Mesh(zCyl(new THREE.CylinderGeometry(0.06, 0.06, zFront - 0.25 - zBelt, 24)), M.steel);
        shaft.position.z = (zFront - 0.25 + zBelt) / 2;
        g.add(shaft);
        const sp = gear(28, 0.27, M.dark, 0.1);
        sp.position.z = zBelt;
        const spMark = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.01, 16).rotateX(Math.PI / 2), M.mark);
        spMark.position.set(0, 0.2, 0.065);
        sp.add(spMark);
        g.add(sp);
        g.userData.lobes = [];
        eng.add(g);
        shadow(g);
        pick(g, 'cam');
        // Cam bearing caps (behind each lobe).
        for (const z of zs) eng.add(shadow(box(c.x - 0.1, c.x + 0.1, c.y - 0.06, c.y + 0.1, z - 0.42, z - 0.28, M.alu)));
        return g;
      });

      // Static block / head.
      const stat = new THREE.Group();
      eng.add(stat);
      if (single) {
        // Cutaway: back halves solid (orange cut faces), front halves as ghost glass.
        stat.add(box(-0.72, -R_BORE, Y_DECK, Y_ROOF, zBack, 0, M.cutBox));
        stat.add(box(R_BORE, 0.72, Y_DECK, Y_ROOF, zBack, 0, M.cutBox));
        stat.add(box(-R_BORE, R_BORE, Y_DECK, Y_ROOF, zBack, -R_BORE, M.cutBox));
        stat.add(box(-0.72, 0.72, Y_ROOF, Y_HEAD, zBack, 0, M.cutBox));
        stat.add(box(-0.72, -0.64, 0.3, Y_DECK, zBack, 0, M.cutBox));
        stat.add(box(0.64, 0.72, 0.3, Y_DECK, zBack, 0, M.cutBox));
        for (const sx of [-1, 1]) {
          stat.add(box(sx > 0 ? 0.5 : -0.6, sx > 0 ? 0.6 : -0.5, 1.85, 2.92, -0.25, 0.002, M.jacket));
        }
        stat.add(box(-0.72, 0.72, 0.22, 0.3, zBack, 0, M.cutBox));
        eng.add(ghostBox(-0.72, 0.72, 0.22, Y_HEAD, 0, zFront));
      } else {
        stat.add(box(-0.72, 0.72, 0.22, 0.3, zBack, zFront, M.alu));
        eng.add(ghostBox(-0.72, 0.72, 0.3, Y_HEAD, zBack, zFront));
      }
      // Timing-end wall with a main-bearing boss.
      stat.add(box(-0.72, 0.72, 0.3, Y_HEAD, zBack - 0.08, zBack, M.caseIn));
      const bossM = new THREE.Mesh(zCyl(new THREE.CylinderGeometry(0.21, 0.21, 0.1, 40)), M.caseIn);
      bossM.position.set(0, Y_CRANK, zBack - 0.1);
      stat.add(bossM);
      // Cam cover (ghost) with an orange gasket line.
      eng.add(ghostBox(-0.72, 0.72, Y_HEAD, 4.18, zBack, zFront));
      if (single) stat.add(box(-0.73, 0.73, Y_HEAD - 0.005, Y_HEAD + 0.015, zBack, 0, M.cut));
      for (const z of zs) stat.add(new THREE.Mesh(G.liner, M.liner).translateZ(z));
      shadow(stat);
      pick(stat, 'block');

      // Bolts (instanced): head bolts and sump flange bolts.
      const boltPos = [];
      for (const z of zs) for (const x of [-0.6, 0.6]) for (const dz of [-0.4, 0.4]) if (!single || dz < 0) boltPos.push([x, Y_HEAD, z + dz]);
      for (const x of [-0.6, -0.2, 0.2, 0.6]) boltPos.push([x, 0.22, zBack + 0.08], [x, Y_HEAD, zBack - 0.04]);
      const bolts = new THREE.InstancedMesh(G.bolt, M.dark, boltPos.length);
      const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), down = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI), one = new THREE.Vector3(1, 1, 1);
      boltPos.forEach(([x, y, z], i) => {
        const facingDown = y < 1;
        const p = new THREE.Vector3(x, y, z);
        bolts.setMatrixAt(i, mtx.compose(p, facingDown ? down : q, one));
        if (y === Y_HEAD && z < zBack) bolts.setMatrixAt(i, mtx.compose(p.set(x, Y_HEAD - 0.2, zBack - 0.08), down.clone().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), one));
      });
      bolts.castShadow = true;
      eng.add(bolts);

      // Timing belt around crank sprocket and both cam sprockets (counter-clockwise order).
      const beltGeo = beltRibbon([{ x: 0, y: Y_CRANK, r: 0.165 }, { x: camC[1].x, y: camC[1].y, r: 0.305 }, { x: camC[0].x, y: camC[0].y, r: 0.305 }], zBelt, 0.09);
      const belt = new THREE.Mesh(beltGeo, M.belt);
      belt.castShadow = true;
      eng.add(belt);
      pick(belt, 'belt');

      // Per-cylinder moving parts.
      for (let k = 0; k < n; k++) {
        const z = zs[k];
        const c = { z, phase: PHASE[k], k };
        // Piston + rings + pin.
        c.piston = new THREE.Group();
        c.piston.position.z = z;
        c.piston.add(new THREE.Mesh(G.piston, M.piston), new THREE.Mesh(G.rings, M.dark), new THREE.Mesh(G.wristPin, M.steel));
        eng.add(shadow(c.piston));
        pick(c.piston, 'piston');
        // Con-rod.
        c.rod = new THREE.Group();
        c.rod.position.z = z;
        c.rod.add(new THREE.Mesh(G.rod, M.forged), new THREE.Mesh(G.rodBolts, M.dark));
        eng.add(shadow(c.rod));
        pick(c.rod, 'rod');
        // Gas column.
        c.gasMat = new THREE.MeshStandardMaterial({ color: 0x5ab4ff, emissive: 0x000000, transparent: true, opacity: 0.35, depthWrite: false, roughness: 0.4, metalness: 0 });
        c.gas = new THREE.Mesh(G.gas, c.gasMat);
        c.gas.position.z = z;
        c.gas.renderOrder = 4;
        eng.add(c.gas);
        pick(c.gas, 'gas');
        // Valves.
        c.valves = [];
        for (const [si, kind] of [[0, 'intake'], [1, 'exhaust']]) {
          const side = si ? 1 : -1;
          const frame = new THREE.Group();
          frame.position.set(side * SEAT_X, Y_ROOF, z);
          frame.rotation.z = -side * TILT;
          const mv = new THREE.Group();
          const vm = new THREE.Mesh(G.valve, M.steel);
          const bk = new THREE.Mesh(G.bucket, M.steel);
          mv.add(vm, bk);
          const spr = new THREE.Mesh(G.spring, M.spring);
          spr.position.y = 0.41;
          const seat = new THREE.Mesh(G.seat, M.dark);
          seat.position.y = 0.4;
          frame.add(mv, spr, seat);
          eng.add(shadow(frame));
          pick(mv, kind);
          pick(spr, 'spring');
          // Cam lobe for this valve.
          const cg = cams[si];
          const lobe = new THREE.Mesh(G.lobe, M.forged);
          lobe.position.z = z;
          // Follower direction from cam centre toward the valve.
          const beta = Math.atan2(-Math.cos(TILT), -side * Math.sin(TILT));
          const centre = kind === 'intake' ? IN_CENTRE : EX_CENTRE;
          const alpha = beta + ((c.phase + centre) / 2) * D2R; // nose angle in cam frame
          lobe.rotation.z = alpha;
          lobe.castShadow = true;
          cg.add(lobe);
          c.valves.push({ kind, mv, spr, alpha, beta, lift: 0 });
        }
        // Ports with gas inside (back half of each runner is shown; front is cut away).
        const inCurve = new THREE.CatmullRomCurve3([[-0.2, 3.03], [-0.36, 3.16], [-0.62, 3.22], [-0.95, 3.2], [-1.25, 3.06], [-1.42, 2.82]].map(([x, y]) => new THREE.Vector3(x, y, z)));
        const exCurve = new THREE.CatmullRomCurve3([[0.2, 3.03], [0.36, 3.16], [0.62, 3.2], [0.92, 3.1], [1.12, 2.82], [1.2, 2.4], [1.2, 1.95]].map(([x, y]) => new THREE.Vector3(x, y, z)));
        const inPipe = new THREE.Mesh(halfTube(inCurve, 0.1), M.runner);
        const exPipe = new THREE.Mesh(halfTube(exCurve, 0.1), M.exhaust);
        c.inGasMat = new THREE.MeshStandardMaterial({ color: 0x1f7cff, emissive: 0x0b2c66, transparent: true, opacity: 0.4, depthWrite: false, roughness: 0.5 });
        c.exGasMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, emissive: 0x000000, transparent: true, opacity: 0.2, depthWrite: false, roughness: 0.5 });
        const inGas = new THREE.Mesh(new THREE.TubeGeometry(inCurve, 40, 0.072, 12), c.inGasMat);
        const exGas = new THREE.Mesh(new THREE.TubeGeometry(exCurve, 40, 0.072, 12), c.exGasMat);
        inGas.renderOrder = exGas.renderOrder = 4;
        inPipe.castShadow = exPipe.castShadow = true;
        // Flanges at the outer ends.
        for (const [curve, mat] of [[inCurve, M.runner], [exCurve, M.exhaust]]) {
          const f = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 10, 32), mat);
          const p = curve.getPointAt(1), tg = curve.getTangentAt(1);
          f.position.copy(p);
          f.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tg);
          f.castShadow = true;
          eng.add(f);
        }
        eng.add(inPipe, exPipe, inGas, exGas);
        pick(inPipe, 'intakePort'); pick(inGas, 'intakePort');
        pick(exPipe, 'exhaustPort'); pick(exGas, 'exhaustPort');
        // Spark plug.
        const plug = new THREE.Group();
        plug.position.set(0, Y_ROOF - 0.01, z);
        plug.add(new THREE.Mesh(G.plug, M.steel), new THREE.Mesh(G.insulator, M.ceramic), new THREE.Mesh(G.terminal, M.steel), new THREE.Mesh(G.plugTip, M.steel));
        c.spark = new THREE.Mesh(G.sparkBall, M.spark);
        c.spark.position.y = -0.015;
        c.spark.visible = false;
        plug.add(c.spark);
        eng.add(shadow(plug));
        c.spark.castShadow = false;
        pick(plug, 'plug');
        cyls.push(c);
      }

      // Spark light (one, moved to the firing cylinder; intensity, not visibility, is animated).
      const light = new THREE.PointLight(0xffc27a, 0, 4, 2);
      light.position.set(0, Y_ROOF - 0.12, 0);
      eng.add(light);

      // Labels.
      const L = {};
      if (single) {
        L.piston = addLabel(cyls[0].piston, 'Piston', 0, 0.02, 0.5);
        L.rod = addLabel(cyls[0].rod, 'Connecting rod', 0, -0.75, 0.2);
        addLabel(eng, 'Crankshaft', 0, Y_CRANK - 0.05, 0.75);
        addLabel(eng, 'Counterweight', -0.9, 0.55, 0.3);
        addLabel(eng, 'Intake valve', -0.85, 3.6, 0.2, '#9fd0ff');
        addLabel(eng, 'Exhaust valve', 0.9, 3.6, 0.2, '#d6dbe3');
        addLabel(eng, 'Camshafts (½ speed)', 0, 4.35, 0);
        addLabel(eng, 'Spark plug', 0.0, 3.4, 0.55);
        addLabel(eng, 'Cylinder', 0.68, 2.2, 0.2);
        addLabel(eng, 'Timing belt', 1.0, 0.9, zBelt);
      } else {
        zs.forEach((z, k) => addLabel(eng, `Cyl ${k + 1}`, 0, 4.4, z));
        addLabel(eng, 'Crankshaft', 0.9, Y_CRANK, zFront);
        addLabel(eng, 'Timing belt', 1.0, 0.9, zBelt);
      }

      root.add(eng);
      return { group: eng, cyls, crank, cams, light, single, beltLen: 0 };
    }

    const engines = { 1: buildEngine(1), 4: buildEngine(4) };
    let mode = params.has('i4') ? 4 : 1;
    const setMode = (m) => {
      mode = m;
      engines[1].group.visible = m === 1;
      engines[4].group.visible = m === 4;
      ctx.view(m === 4 ? { yaw: -1.1, pitch: 0.28, dist: 9.2, target: [0, 1.8, 0] } : { yaw: 0.42, pitch: 0.2, dist: 7.4, target: [0, 1.85, 0] });
    };
    setMode(mode);
    // Screenshot/test helpers: ?eyaw=&epitch=&edist= set the camera; ?espin= turns the model.
    if (params.has('espin')) root.rotation.y = +params.get('espin');
    if (params.has('eyaw')) ctx.view({ yaw: +params.get('eyaw'), pitch: +(params.get('epitch') ?? 0.2), dist: +(params.get('edist') ?? 7.4), target: [0, 1.85, 0] });

    // ── state + controls ──
    let angle = params.has('angle') ? parseFloat(params.get('angle')) || 0 : 30; // crank deg, cylinder 1
    let playing = !params.has('angle');
    let rpm = 24;
    let goal = null;
    let showGas = true;

    ctx.ui.choice('Engine', { options: [{ value: 1, label: 'Single cylinder' }, { value: 4, label: 'Inline-4' }], value: mode, onChange: setMode });
    ctx.ui.slider('Crank speed (slow motion)', { min: 2, max: 120, step: 1, value: rpm, fmt: (v) => `${v} rpm`, onChange: (v) => (rpm = v) });
    ctx.ui.note('<span class="muted">A real engine idles at about 800 rpm, far too fast to watch. This one runs in slow motion.</span>');
    const playBtn = ctx.ui.button(playing ? 'Pause' : 'Play', () => setPlaying(!playing), { primary: true });
    ctx.ui.button('◀ Stroke', () => step(-1));
    ctx.ui.button('Stroke ▶', () => step(1));
    function setPlaying(p) { playing = p; goal = null; playBtn.textContent = p ? 'Pause' : 'Play'; }
    function step(dir) {
      setPlaying(false);
      const base = goal ?? angle;
      goal = dir > 0 ? (Math.floor(base / 180 + 1e-6) + 1) * 180 : (Math.ceil(base / 180 - 1e-6) - 1) * 180;
    }
    ctx.ui.toggle('Show labels', { value: labelsOn.v, onChange: (v) => { labelsOn.v = v; for (const l of allLabels) l.visible = v; } });
    ctx.ui.toggle('Show gas', { value: true, onChange: (v) => (showGas = v) });
    ctx.ui.heading('Readouts');
    const rStroke = ctx.ui.readout('Stroke (cyl 1)');
    const rAngle = ctx.ui.readout('Crank angle');
    const rPiston = ctx.ui.readout('Piston (cyl 1)');
    const rValves = ctx.ui.readout('Valves (cyl 1)');
    const rFiring = ctx.ui.readout('Power stroke in');
    const rNote = ctx.ui.note('');

    // ── per-frame ──
    const cIn = new THREE.Color(0x1f7cff), cComp = new THREE.Color(0x2a3dff), cHot = new THREE.Color(0xfff2c0), cBurn = new THREE.Color(0xff5200), cDull = new THREE.Color(0x9a3a12), cEx = new THREE.Color(0x9aa0a8);
    const tmpC = new THREE.Color();
    let readTimer = 0;
    const mod720 = (a) => ((a % 720) + 720) % 720;

    function poseEngine(E, a) {
      const camRot = (-a / 2) * D2R;
      E.crank.rotation.z = -a * D2R;
      E.cams[0].rotation.z = camRot;
      E.cams[1].rotation.z = camRot;
      M.belt.map.offset.x = (-a * D2R * 0.165) / 0.05;
      let flash = 0, flashZ = 0;
      for (const c of E.cyls) {
        const ak = mod720(a - c.phase);
        const th = ak * D2R, s = Math.sin(th);
        const x = pinHeight(ak);
        c.piston.position.y = Y_CRANK + x;
        c.rod.position.set(0, Y_CRANK + x, c.z);
        c.rod.rotation.z = Math.asin((R_CRANK * s) / L_ROD);
        // Valves.
        for (const v of c.valves) {
          v.lift = camLift(v.alpha + camRot, v.beta);
          v.mv.position.y = -v.lift;
          v.spr.scale.y = 0.2 - v.lift;
        }
        const inL = c.valves[0].lift / LIFT, exL = c.valves[1].lift / LIFT;
        // Gas.
        const top = c.piston.position.y + PIN_TO_CROWN;
        c.gas.position.y = top;
        c.gas.scale.y = Math.max(0.01, Y_ROOF - top);
        c.gas.visible = showGas;
        const gm = c.gasMat;
        let emi = 0;
        if (ak < 180) { gm.color.copy(cIn); gm.opacity = 0.42; }
        else if (ak < SPARK) { const f = (ak - 180) / (SPARK - 180); gm.color.copy(cIn).lerp(cComp, f); gm.opacity = 0.42 + 0.3 * f; }
        else if (ak < 540) {
          const f = (ak - SPARK) / (540 - SPARK);
          if (f < 0.15) gm.color.copy(cHot).lerp(cBurn, f / 0.15); else gm.color.copy(cBurn).lerp(cDull, (f - 0.15) / 0.85);
          emi = f < 0.15 ? 1.2 : 0.9 * (1 - (f - 0.15) / 0.85) + 0.15;
          gm.opacity = 0.85 - 0.35 * f;
        } else { const f = (ak - 540) / 180; gm.color.copy(cDull).lerp(cEx, Math.min(1, f * 3)); gm.opacity = 0.45 - 0.2 * f; }
        gm.emissive.copy(gm.color);
        if (emi === 0) emi = 0.35;
        gm.emissiveIntensity = emi;
        c.inGasMat.opacity = showGas ? 0.12 + 0.45 * Math.min(1, inL * 1.5) : 0;
        const exHot = ak > 480 && ak < 600 ? 1 - Math.abs(ak - 540) / 60 : 0;
        c.exGasMat.color.copy(cEx).lerp(cBurn, exHot * 0.6);
        c.exGasMat.emissive.copy(cBurn).multiplyScalar(exHot * 0.5);
        c.exGasMat.opacity = showGas ? 0.1 + 0.45 * Math.min(1, exL * 1.5) : 0;
        // Spark: a short flash starting at ignition.
        const sp = ak >= SPARK && ak < SPARK + 14 ? 1 - (ak - SPARK) / 14 : 0;
        c.spark.visible = sp > 0;
        if (sp > 0) { c.spark.scale.setScalar(0.8 + sp * 2.4); if (sp > flash) { flash = sp; flashZ = c.z; } }
      }
      E.light.intensity = flash * 14;
      E.light.position.z = flashZ;
    }

    function updateReadouts(a) {
      const E = engines[mode];
      const c1 = E.cyls[0];
      const ak = mod720(a);
      const st = STROKES[Math.floor(ak / 180)];
      rStroke.set(`<b style="color:${st.col}">${st.name}</b>`);
      rAngle.set(`${ak.toFixed(0)}° <span class="muted">of 720° (cam ${(ak / 2).toFixed(0)}°)</span>`);
      const down = (X_TDC - pinHeight(ak)) * MM;
      rPiston.set(`${down.toFixed(1)} mm below TDC <span class="muted">(${((down / (2 * R_CRANK * MM)) * 100).toFixed(0)}% of 86 mm)</span>`);
      const vs = (v) => (v.lift > 0.002 ? `<b>open ${(v.lift * MM).toFixed(1)} mm</b>` : 'closed');
      rValves.set(`In ${vs(c1.valves[0])} · Ex ${vs(c1.valves[1])}`);
      if (mode === 4) {
        let who = 1;
        for (const c of E.cyls) { const k = mod720(a - c.phase); if (k >= 360 && k < 540) who = c.k + 1; }
        rFiring.set(`cylinder ${who} <span class="muted">(order 1-3-4-2)</span>`);
      } else rFiring.set(ak >= 360 && ak < 540 ? '<b style="color:#ff9a3c">now</b>' : 'cylinder 1 every 720°');
      rNote.set(st.tip);
    }

    poseEngine(engines[mode], angle);
    updateReadouts(angle);

    return {
      update(dt) {
        if (playing) angle += rpm * 6 * dt;
        else if (goal != null) {
          const d = goal - angle, stepA = Math.max(60, Math.abs(d) * 4) * dt;
          if (Math.abs(d) <= stepA) { angle = goal; goal = null; } else angle += Math.sign(d) * stepA;
        }
        if (angle > 7200 || angle < -7200) { const m = mod720(angle); if (goal != null) goal += m - angle; angle = m; }
        poseEngine(engines[mode], angle);
        readTimer -= dt;
        if (readTimer <= 0) { readTimer = 0.1; updateReadouts(angle); }
      },
      onKey(e) {
        if (e.key === ' ') { e.preventDefault(); setPlaying(!playing); }
        if (e.key === 'ArrowRight') step(1);
        if (e.key === 'ArrowLeft') step(-1);
      },
    };
  },
};
