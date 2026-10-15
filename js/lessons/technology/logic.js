// Logic Gates & Adders: a printed circuit board with real gate bodies (AND, OR, XOR, NOT), toggle
// switches for inputs, gold traces that glow and carry pulses when they hold a 1, and LEDs for
// outputs. Four boards: one gate, a half adder, a full adder (two half adders + OR) and a 4-bit
// ripple-carry adder built from four full-adder chips, where the carry visibly ripples from bit 0
// to bit 3 with a delay per stage. Every gate is simulated with a propagation delay, so the
// signals settle the way they do in hardware.

import * as THREE from 'three';

const BLUE = '#5aa9ff';
const BT = 0.3;            // board top (y)
const BW = 5.9, BD = 3.9;  // board size (x, z)

const GATES = {
  AND: { n: 2, f: (a, b) => a & b, expr: 'Out = A · B', desc: 'The output is 1 only when <b>both</b> inputs are 1.' },
  OR: { n: 2, f: (a, b) => a | b, expr: 'Out = A + B', desc: 'The output is 1 when <b>at least one</b> input is 1.' },
  XOR: { n: 2, f: (a, b) => a ^ b, expr: 'Out = A ⊕ B', desc: 'Exclusive OR: the output is 1 when the inputs are <b>different</b>.' },
  NOT: { n: 1, f: (a) => a ^ 1, expr: 'Out = ¬A', desc: 'An inverter: the output is the <b>opposite</b> of the input.' },
};
const fa = {
  s: (a, b, c) => a ^ b ^ c,
  c: (a, b, c) => (a & b) | (c & (a ^ b)),
};

const bin = (v, n) => v.toString(2).padStart(n, '0');

export default {
  view: { dist: 7.6, yaw: 0, pitch: 0.92, target: [0, 0.25, 0.25], minDist: 3, maxDist: 16 },
  explain: `
    <p>Every computer is built from tiny switches called <b>transistors</b>. Wire a few together and you get a
    <b>logic gate</b>: a circuit that takes bits (0 = low voltage, 1 = high voltage) in and puts one bit out.</p>
    <ul>
      <li><b>AND</b>: 1 only if both inputs are 1.</li>
      <li><b>OR</b>: 1 if either input (or both) is 1.</li>
      <li><b>XOR</b> (exclusive or): 1 if the inputs are different.</li>
      <li><b>NOT</b>: flips the bit.</li>
    </ul>
    <p>A <b>truth table</b> lists the output for every possible input. With <i>n</i> inputs there are 2<sup><i>n</i></sup> rows.</p>
    <p><b>Adding in binary.</b> 1 + 1 = 10₂ (two): the sum bit is 0 and a 1 is <b>carried</b>. That is exactly
    XOR (sum) and AND (carry), so one XOR and one AND make a <b>half adder</b>. A <b>full adder</b> also adds a
    carry coming in, using two half adders and an OR gate.</p>
    <p>Chain four full adders, carry-out to carry-in, and you have a <b>4-bit ripple-carry adder</b> that adds
    numbers from 0 to 15. Each gate takes a moment to switch (its <b>propagation delay</b>), so the carry has
    to "ripple" from bit to bit. That is why real processors use cleverer carry-lookahead adders.</p>
    <p>On the board, gold traces that carry a 1 glow blue and pulses flow along them. Click the switches to flip inputs.</p>`,
  formula: 'Half adder: S = A ⊕ B, C = A · B<br>Full adder: S = A ⊕ B ⊕ C<sub>in</sub>, C<sub>out</sub> = A·B + C<sub>in</sub>·(A ⊕ B)',
  vocab: [
    ['Bit', 'A binary digit, 0 or 1. In a circuit, 0 is a low voltage and 1 is a high voltage.'],
    ['Logic gate', 'A small circuit that computes one output bit from its input bits.'],
    ['Truth table', 'A table listing a circuit’s output for every combination of inputs.'],
    ['Half adder', 'Adds two bits: sum = A XOR B, carry = A AND B.'],
    ['Full adder', 'Adds two bits plus a carry-in, giving a sum bit and a carry-out.'],
    ['Ripple carry', 'Adders chained so each stage waits for the carry from the stage before.'],
    ['Propagation delay', 'The short time a gate needs before its output changes after an input changes.'],
    ['Overflow', 'A result too big for the bits available; in a 4-bit adder the carry-out is the 5th bit.'],
  ],
  standards: ['CSTA 3A-CS-02'],
  quiz: [
    { q: 'An XOR gate has inputs A = 1 and B = 1. What is its output?', choices: ['0', '1', '2', 'It depends on the previous output'], answer: 0, why: 'XOR is 1 only when the inputs are different. Both are 1, so the output is 0.' },
    { q: 'Which gates make a half adder?', choices: ['AND for the sum, OR for the carry', 'XOR for the sum, AND for the carry', 'OR for the sum, NOT for the carry', 'Two NOT gates'], answer: 1, why: 'Sum = A XOR B (1 when exactly one input is 1) and carry = A AND B (1 only for 1 + 1).' },
    { q: 'How many rows does the truth table of a full adder (inputs A, B, C<sub>in</sub>) have?', choices: ['3', '6', '8', '16'], answer: 2, why: 'Three inputs, each 0 or 1: 2³ = 8 combinations.' },
    { q: 'A 4-bit adder computes 1011₂ + 0110₂. What is the result?', choices: ['1101₂ (13)', '10001₂ (17)', '10011₂ (19)', '01111₂ (15)'], answer: 1, why: '1011₂ = 11 and 0110₂ = 6; 11 + 6 = 17 = 10001₂. The leading 1 is the carry-out, the 5th bit.' },
    { q: 'Why does a ripple-carry adder get slower as you add more bits?', choices: ['Each extra bit needs more electricity', 'Each stage must wait for the carry from the stage before it', 'Binary numbers with more bits are harder to store', 'The truth tables get longer'], answer: 1, why: 'The carry passes from stage to stage, and every stage adds its own gate delay, so the worst-case time grows with the number of bits.' },
  ],

  build(ctx) {
    const { root, ui } = ctx;
    const owned = []; // shared geometries/materials/textures, disposed at the end
    const own = (x) => (owned.push(x), x);
    const qs = new URLSearchParams(location.search);

    // ── shared materials ───────────────────────────────────────────────────────────────────
    const M = {
      pcb: own(new THREE.MeshPhysicalMaterial({ color: 0x07361f, roughness: 0.55, metalness: 0.05, clearcoat: 0.7, clearcoatRoughness: 0.35 })),
      gold: own(new THREE.MeshStandardMaterial({ color: 0xd9ad55, metalness: 1, roughness: 0.28 })),
      brass: own(new THREE.MeshStandardMaterial({ color: 0xc89b4a, metalness: 1, roughness: 0.35 })),
      chrome: own(new THREE.MeshStandardMaterial({ color: 0xe6e9ee, metalness: 1, roughness: 0.15 })),
      plastic: own(new THREE.MeshPhysicalMaterial({ color: 0x23272f, roughness: 0.45, clearcoat: 0.8, clearcoatRoughness: 0.25 })),
      gateOff: own(new THREE.MeshPhysicalMaterial({ color: 0x1b2333, roughness: 0.32, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.12 })),
      gateOn: own(new THREE.MeshPhysicalMaterial({ color: 0x1d2b44, roughness: 0.32, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.12, emissive: new THREE.Color(BLUE), emissiveIntensity: 0.28 })),
      glow: own(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.68, 1.0), toneMapped: false })),
      pulse: own(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.97, 1.0), toneMapped: false })),
      ledInOff: own(new THREE.MeshPhysicalMaterial({ color: 0x1b3a5c, roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0.85 })),
      ledInOn: own(new THREE.MeshBasicMaterial({ color: new THREE.Color(BLUE).multiplyScalar(1.4), toneMapped: false })),
      ledOutOff: own(new THREE.MeshPhysicalMaterial({ color: 0x5a3208, roughness: 0.12, clearcoat: 1, transparent: true, opacity: 0.8 })),
      ledOutOn: own(new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.72, 0.25), toneMapped: false })),
      chipTopGlow: own(new THREE.MeshBasicMaterial({ color: new THREE.Color(BLUE), toneMapped: false, transparent: true, opacity: 0, depthWrite: false })),
    };
    const haloTex = own(radialTexture());
    const haloBlue = own(new THREE.SpriteMaterial({ map: haloTex, color: new THREE.Color(BLUE), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
    const haloAmber = own(new THREE.SpriteMaterial({ map: haloTex, color: new THREE.Color(1, 0.65, 0.2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));

    // ── the board ──────────────────────────────────────────────────────────────────────────
    const board = new THREE.Group();
    root.add(board);
    {
      const s = roundedRect(BW, BD, 0.2);
      const g = own(new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 10 }));
      g.rotateX(-Math.PI / 2);
      g.translate(0, BT - 0.082, 0);
      const pcb = new THREE.Mesh(g, M.pcb);
      pcb.receiveShadow = true;
      pcb.castShadow = true;
      board.add(pcb);
      const standoff = own(new THREE.CylinderGeometry(0.07, 0.07, BT - 0.08, 20));
      const ring = own(new THREE.TorusGeometry(0.075, 0.025, 10, 28));
      ring.rotateX(Math.PI / 2);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const x = sx * (BW / 2 - 0.22), z = sz * (BD / 2 - 0.22);
        const so = new THREE.Mesh(standoff, M.brass);
        so.position.set(x, (BT - 0.08) / 2, z);
        so.castShadow = true;
        const r = new THREE.Mesh(ring, M.gold);
        r.position.set(x, BT + 0.004, z);
        board.add(so, r);
      }
    }
    // Silkscreen (white printing on the board), redrawn per mode.
    const silkCanvas = document.createElement('canvas');
    silkCanvas.width = 2048; silkCanvas.height = Math.round(2048 * BD / BW);
    const silkTex = own(new THREE.CanvasTexture(silkCanvas));
    silkTex.colorSpace = THREE.SRGBColorSpace;
    silkTex.anisotropy = 8;
    {
      const g = own(new THREE.PlaneGeometry(BW, BD));
      g.rotateX(-Math.PI / 2);
      const m = own(new THREE.MeshStandardMaterial({ map: silkTex, transparent: true, roughness: 0.7, depthWrite: false }));
      const silk = new THREE.Mesh(g, m);
      silk.position.y = BT + 0.0015;
      silk.receiveShadow = true;
      board.add(silk);
    }

    // ── instanced traces, glow cores, pads and pulses ──────────────────────────────────────
    const unitBox = own(new THREE.BoxGeometry(1, 1, 1));
    const MAXSEG = 400;
    const traces = new THREE.InstancedMesh(unitBox, M.gold, MAXSEG);
    const cores = new THREE.InstancedMesh(unitBox, M.glow, MAXSEG);
    const padGeo = own(new THREE.CylinderGeometry(1, 1, 1, 18));
    const pads = new THREE.InstancedMesh(padGeo, M.gold, 200);
    const pulseGeo = own(new THREE.SphereGeometry(1, 12, 8));
    const pulses = new THREE.InstancedMesh(pulseGeo, M.pulse, 400);
    traces.receiveShadow = true;
    for (const im of [traces, cores, pads, pulses]) { im.count = 0; im.frustumCulled = false; root.add(im); }

    // ── shared part geometry ───────────────────────────────────────────────────────────────
    const gateGeo = {};
    for (const t of Object.keys(GATES)) gateGeo[t] = own(gateGeometry(t));
    const gateTex = {};
    for (const t of Object.keys(GATES)) gateTex[t] = own(textTexture(t, 256, 112, 84));
    const gateLabelGeo = own(new THREE.PlaneGeometry(0.36, 0.16).rotateX(-Math.PI / 2));
    const gateLabelMat = {};
    for (const t of Object.keys(GATES)) gateLabelMat[t] = own(new THREE.MeshBasicMaterial({ map: gateTex[t], transparent: true, depthWrite: false }));

    const swBase = own(roundedBoxGeo(0.26, 0.11, 0.32, 0.03));
    const swCollar = own(new THREE.CylinderGeometry(0.06, 0.065, 0.04, 24));
    const swLever = own(new THREE.CylinderGeometry(0.018, 0.024, 0.22, 16).translate(0, 0.11, 0));
    const swKnob = own(new THREE.SphereGeometry(0.034, 20, 14));
    const ledSmall = own(ledGeometry(0.045, 0.05));
    const ledBig = own(ledGeometry(0.075, 0.08));
    const ledRim = own(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 28));

    const chipBody = own(roundedBoxGeo(0.84, 0.14, 0.6, 0.025));
    const chipLeg = own(new THREE.BoxGeometry(0.05, 0.02, 0.12));
    const chipTopGeo = own(new THREE.PlaneGeometry(0.76, 0.5).rotateX(-Math.PI / 2));
    const chipTex = [0, 1, 2, 3].map((i) => own(chipTexture(i)));
    const chipTopMat = chipTex.map((t) => own(new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.6, depthWrite: false })));
    const chipGlowMat = [0, 1, 2, 3].map(() => own(M.chipTopGlow.clone()));
    const chipGlowGeo = own(new THREE.PlaneGeometry(0.84, 0.6).rotateX(-Math.PI / 2));

    // ── state ──────────────────────────────────────────────────────────────────────────────
    let mode = ['gate', 'half', 'full', 'adder4'].includes(qs.get('logicmode')) ? qs.get('logicmode') : 'gate';
    let gateType = GATES[qs.get('gate')] ? qs.get('gate') : 'AND';
    let delay = 0.3;
    const inputs = { A: 1, B: 0, C: 0 }; // gate / half / full modes
    let numA = 11, numB = 6;               // 4-bit mode
    if (qs.has('in')) { const s = qs.get('in'); inputs.A = +s[0] || 0; inputs.B = +s[1] || 0; inputs.C = +s[2] || 0; }
    if (qs.has('a')) numA = clampInt(+qs.get('a'), 0, 15);
    if (qs.has('b')) numB = clampInt(+qs.get('b'), 0, 15);

    let circ = null;           // THREE.Group of the current mode
    let nodes = {}, order = [], wires = [], outs = [], switches = [], chips = [];
    let dirty = true;          // visuals need refreshing
    let segCount = 0, padCount = 0;
    const mtx = new THREE.Matrix4();
    const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

    // Label slots (sprites) reused across modes.
    const slots = [];
    for (let i = 0; i < 6; i++) {
      const l = ctx.label(' ', { color: '#dbe9ff', size: 0.85 });
      l.visible = false;
      root.add(l);
      slots.push({ sprite: l, text: '', color: '' });
    }
    function setSlot(i, text, x, y, z, color = '#dbe9ff') {
      const s = slots[i];
      if (s.text !== text || s.color !== color) {
        s.sprite = ctx.relabel(s.sprite, text, { color, size: 0.85 });
        s.text = text; s.color = color;
      }
      s.sprite.position.set(x, y, z);
      s.sprite.visible = true;
    }

    // ── circuit construction ───────────────────────────────────────────────────────────────
    function addNode(id, n) { nodes[id] = { id, v: 0, pend: 0, timer: 0, ...n }; if (n.f) order.push(nodes[id]); return nodes[id]; }

    function addSwitch(id, name, x, z, { pinOff = [0.15, 0], dir = [1, 0], ledOff = [0, -0.27], get, set }) {
      const g = new THREE.Group();
      g.position.set(x, BT, z);
      const base = new THREE.Mesh(swBase, M.plastic);
      base.position.y = 0.055;
      const collar = new THREE.Mesh(swCollar, M.chrome);
      collar.position.y = 0.13;
      const pivot = new THREE.Group();
      pivot.position.y = 0.13;
      const lever = new THREE.Mesh(swLever, M.chrome);
      const knob = new THREE.Mesh(swKnob, M.chrome);
      knob.position.y = 0.22;
      pivot.add(lever, knob);
      const led = new THREE.Mesh(ledSmall, M.ledInOff);
      led.position.set(ledOff[0], 0, ledOff[1]);
      const halo = new THREE.Sprite(haloBlue);
      halo.scale.setScalar(0.32);
      halo.position.set(ledOff[0], 0.07, ledOff[1]);
      g.add(base, collar, pivot, led, halo);
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      circ.add(g);
      const sw = { id, name, g, pivot, led, halo, get, set, ang: get() ? -0.5 : 0.5 };
      pivot.rotation.x = sw.ang;
      switches.push(sw);
      ctx.pickable(g, () => { set(get() ^ 1); onInputsChanged(); });
      addNode(id, { kind: 'in', pin: { x: x + pinOff[0], z: z + pinOff[1], dx: dir[0], dz: dir[1] }, v: get(), pend: get() });
      pad(x + pinOff[0], z + pinOff[1], 0.045);
      return sw;
    }

    function addGate(id, type, x, z, s, ins) {
      const geo = gateGeo[type];
      const g = new THREE.Group();
      g.position.set(x, BT, z);
      g.scale.setScalar(s);
      const body = new THREE.Mesh(geo, M.gateOff);
      body.castShadow = true;
      body.receiveShadow = true;
      const lab = new THREE.Mesh(gateLabelGeo, gateLabelMat[type]);
      lab.position.set(type === 'NOT' ? -0.06 : type === 'AND' ? -0.02 : 0, 0.163, 0);
      lab.scale.setScalar(type === 'NOT' ? 0.62 : 1);
      g.add(body, lab);
      circ.add(g);
      ctx.pickable(g, () => gateCard(type));
      const n = GATES[type].n;
      const pinsIn = n === 2 ? [{ x: x - 0.2 * s, z: z - 0.1 * s }, { x: x - 0.2 * s, z: z + 0.1 * s }] : [{ x: x - 0.2 * s, z }];
      for (const p of pinsIn) { p.dx = 1; p.dz = 0; }
      return addNode(id, { kind: 'gate', type, body, ins, f: GATES[type].f, pinsIn, pin: { x: x + 0.2 * s, z, dx: 1, dz: 0 } });
    }

    function addChip(i, x, z, ins) {
      const g = new THREE.Group();
      g.position.set(x, BT, z);
      const body = new THREE.Mesh(chipBody, M.plastic);
      body.position.y = 0.1;
      body.castShadow = true;
      const top = new THREE.Mesh(chipTopGeo, chipTopMat[i]);
      top.position.y = 0.172;
      const glow = new THREE.Mesh(chipGlowGeo, chipGlowMat[i]);
      glow.position.y = 0.174;
      g.add(body, top, glow);
      for (let k = 0; k < 7; k++) for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(chipLeg, M.chrome);
        leg.position.set(-0.36 + k * 0.12, 0.03, side * 0.33);
        leg.castShadow = true;
        g.add(leg);
      }
      circ.add(g);
      ctx.pickable(g, () => faCard(i));
      const sN = addNode(`s${i}`, { kind: 'fa', ins, f: fa.s, pinsIn: [{ x: x - 0.18, z: z - 0.33, dx: 0, dz: 1 }, { x: x + 0.18, z: z - 0.33, dx: 0, dz: 1 }, { x: x + 0.42, z, dx: -1, dz: 0 }], pin: { x, z: z + 0.3, dx: 0, dz: 1 } });
      const cN = addNode(`c${i + 1}`, { kind: 'fa', ins, f: fa.c, pinsIn: [], pin: { x: x - 0.42, z, dx: -1, dz: 0 } });
      chips.push({ i, glowMat: chipGlowMat[i], sN, cN });
    }

    function addLed(id, name, src, x, z, dir = [1, 0], route = {}) {
      const g = new THREE.Group();
      g.position.set(x, BT, z);
      const rim = new THREE.Mesh(ledRim, M.plastic);
      rim.position.y = 0.01;
      const led = new THREE.Mesh(ledBig, M.ledOutOff);
      led.position.y = 0.02;
      led.castShadow = true;
      const halo = new THREE.Sprite(haloAmber);
      halo.scale.setScalar(0.7);
      halo.position.y = 0.13;
      g.add(rim, led, halo);
      circ.add(g);
      ctx.pickable(g, () => ctx.toast(`${name} = ${nodes[src].v}`));
      outs.push({ id, name, src, led, halo });
      wire(src, { x, z, dx: dir[0], dz: dir[1] }, route);
    }

    function wire(srcId, to, h = {}) {
      const p0 = nodes[srcId].pin;
      const pts = routePts(p0, to, h);
      const w = { src: srcId, pts, segs: [], cum: [0], len: 0, on: -1 };
      for (let i = 1; i < pts.length; i++) {
        const [x0, z0] = pts[i - 1], [x1, z1] = pts[i];
        const L = Math.hypot(x1 - x0, z1 - z0);
        if (L < 1e-6) continue;
        w.len += L;
        w.cum.push(w.len);
        const k = segCount++;
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, horiz = Math.abs(x1 - x0) > Math.abs(z1 - z0);
        const tw = 0.042, cw = 0.02;
        mtx.makeScale(horiz ? L + tw : tw, 0.012, horiz ? tw : L + tw).setPosition(cx, BT + 0.006, cz);
        traces.setMatrixAt(k, mtx);
        const core = new THREE.Matrix4().makeScale(horiz ? L + cw : cw, 0.014, horiz ? cw : L + cw).setPosition(cx, BT + 0.009, cz);
        w.segs.push({ k, core });
      }
      if (w.cum.length !== pts.length) { // drop zero-length points so cum lines up with pts
        const clean = [pts[0]];
        for (let i = 1; i < pts.length; i++) if (Math.hypot(pts[i][0] - clean[clean.length - 1][0], pts[i][1] - clean[clean.length - 1][1]) > 1e-6) clean.push(pts[i]);
        w.pts = clean;
      }
      pad(pts[pts.length - 1][0], pts[pts.length - 1][1], 0.032);
      wires.push(w);
      return w;
    }

    function pad(x, z, r) {
      mtx.makeScale(r, 0.014, r).setPosition(x, BT + 0.007, z);
      pads.setMatrixAt(padCount++, mtx);
    }

    function routePts(a, b, h) {
      const pts = [[a.x, a.z]];
      const ax = a.dx !== 0, bx = b.dx !== 0;
      if (ax && bx) {
        if (Math.abs(a.z - b.z) > 1e-6) { const mx = h.mx ?? (a.x + b.x) / 2; pts.push([mx, a.z], [mx, b.z]); }
      } else if (!ax && !bx) {
        if (Math.abs(a.x - b.x) > 1e-6) { const mz = h.mz ?? (a.z + b.z) / 2; pts.push([a.x, mz], [b.x, mz]); }
      } else if (ax) pts.push([b.x, a.z]);
      else pts.push([a.x, b.z]);
      pts.push([b.x, b.z]);
      return pts;
    }

    function gateWires(id, hints = []) {
      const n = nodes[id];
      n.ins.forEach((src, k) => wire(src, n.pinsIn[k], hints[k] || {}));
    }

    // ── per-mode layouts ───────────────────────────────────────────────────────────────────
    const silk = []; // { text, x, z, size, align }
    const boxes = []; // dashed outlines { x0, z0, x1, z1, text }

    function build() {
      if (circ) { circ.visible = false; root.remove(circ); }
      circ = new THREE.Group();
      root.add(circ);
      nodes = {}; order = []; wires = []; outs = []; switches = []; chips = [];
      segCount = 0; padCount = 0;
      silk.length = 0; boxes.length = 0;
      for (const s of slots) s.sprite.visible = false;
      const inSw = (key, name, x, z, opts = {}) => addSwitch(key, name, x, z, { ...opts, get: () => inputs[key], set: (v) => (inputs[key] = v) });

      if (mode === 'gate') {
        const t = gateType, two = GATES[t].n === 2, s = 2.1;
        inSw('A', 'A', -2.1, two ? -0.75 : 0);
        if (two) inSw('B', 'B', -2.1, 0.75);
        addGate('g', t, 0, 0, s, two ? ['A', 'B'] : ['A']);
        gateWires('g');
        addLed('Q', 'Out', 'g', 2.05, 0);
        silk.push({ text: `${t} GATE`, x: 0, z: -1.45, size: 70 }, { text: GATES[t].expr.replace('Out', 'OUT'), x: 0, z: 1.25, size: 54 });
      } else if (mode === 'half') {
        const s = 1.35;
        inSw('A', 'A', -2.3, -0.8);
        inSw('B', 'B', -2.3, 0.8);
        addGate('x', 'XOR', 0, -0.8, s, ['A', 'B']);
        addGate('a', 'AND', 0, 0.8, s, ['A', 'B']);
        gateWires('x', [{ mx: -0.75 }, { mx: -1.05 }]);
        gateWires('a', [{ mx: -1.35 }, { mx: -0.6 }]);
        addLed('S', 'Sum', 'x', 2.1, -0.8);
        addLed('C', 'Carry', 'a', 2.1, 0.8);
        silk.push({ text: 'HALF ADDER', x: 0, z: -1.6, size: 64 }, { text: 'S = A ⊕ B', x: 1.1, z: -1.15, size: 40 }, { text: 'C = A · B', x: 1.1, z: 1.2, size: 40 });
      } else if (mode === 'full') {
        const s = 1.05;
        inSw('A', 'A', -2.45, -1.2);
        inSw('B', 'B', -2.45, -0.4);
        inSw('C', 'Cin', -2.45, 1.15);
        addGate('x1', 'XOR', -1.05, -0.85, s, ['A', 'B']);
        addGate('a1', 'AND', -1.05, 0.1, s, ['A', 'B']);
        addGate('x2', 'XOR', 0.75, -0.6, s, ['x1', 'C']);
        addGate('a2', 'AND', 0.0, 0.8, s, ['x1', 'C']);
        addGate('o', 'OR', 1.2, 0.45, s, ['a1', 'a2']);
        gateWires('x1', [{ mx: -1.65 }, { mx: -1.5 }]);
        gateWires('a1', [{ mx: -1.95 }, { mx: -1.75 }]);
        gateWires('x2', [{ mx: 0.1 }, { mx: 0.35 }]);
        gateWires('a2', [{ mx: -0.55 }, { mx: -0.4 }]);
        gateWires('o', [{ mx: 0.6 }, { mx: 0.75 }]);
        addLed('S', 'Sum', 'x2', 2.3, -0.6);
        addLed('Co', 'Cout', 'o', 2.3, 0.45);
        boxes.push({ x0: -1.45, z0: -1.2, x1: -0.62, z1: 0.42, text: 'HALF ADDER 1' }, { x0: -0.42, z0: -1.0, x1: 1.12, z1: 1.18, text: 'HALF ADDER 2' });
        silk.push({ text: 'FULL ADDER', x: 0.6, z: -1.6, size: 64 });
      } else {
        const cols = [1.95, 0.65, -0.65, -1.95]; // bit 0 on the right, so the binary reads left to right
        addNode('gnd', { kind: 'const', v: 0, pend: 0, pin: { x: 2.62, z: -0.1, dx: -1, dz: 0 } });
        pad(2.62, -0.1, 0.06);
        for (let i = 0; i < 4; i++) {
          const cx = cols[i];
          addSwitch(`A${i}`, `A${i}`, cx - 0.22, -1.38, { pinOff: [0, 0.17], dir: [0, 1], ledOff: [0, -0.26], get: () => (numA >> i) & 1, set: (v) => (numA = (numA & ~(1 << i)) | (v << i)) });
          addSwitch(`B${i}`, `B${i}`, cx + 0.22, -1.38, { pinOff: [0, 0.17], dir: [0, 1], ledOff: [0, -0.26], get: () => (numB >> i) & 1, set: (v) => (numB = (numB & ~(1 << i)) | (v << i)) });
          silk.push({ text: `A${i}`, x: cx - 0.45, z: -1.36, size: 36 }, { text: `B${i}`, x: cx + 0.45, z: -1.36, size: 36 });
        }
        for (let i = 0; i < 4; i++) addChip(i, cols[i], -0.1, [`A${i}`, `B${i}`, i ? `c${i}` : 'gnd']);
        for (let i = 0; i < 4; i++) {
          const n = nodes[`s${i}`];
          n.ins.forEach((src, k) => wire(src, n.pinsIn[k], { mz: -0.85 }));
          addLed(`S${i}`, `S${i}`, `s${i}`, cols[i], 0.95, [0, 1]);
          silk.push({ text: `S${i}`, x: cols[i], z: 1.3, size: 44 });
        }
        addLed('C4', 'Carry out', 'c4', -2.6, 0.95, [0, 1]);
        silk.push({ text: 'C4', x: -2.6, z: 1.3, size: 44 }, { text: 'GND', x: 2.62, z: 0.12, size: 30 },
          { text: '4-BIT RIPPLE-CARRY ADDER', x: 0.75, z: 1.72, size: 34 }, { text: '← carry', x: 0, z: 0.12, size: 30 });
      }
      traces.count = segCount; cores.count = segCount; pads.count = padCount;
      traces.instanceMatrix.needsUpdate = true;
      pads.instanceMatrix.needsUpdate = true;
      settle();
      drawSilk();
      showControls();
      dirty = true;
      refreshPanel();
    }

    function settle() {
      for (let pass = 0; pass < 12; pass++) for (const n of order) { n.v = n.pend = evalNode(n); n.timer = 0; }
    }
    const tmpIn = [0, 0, 0];
    function evalNode(n) {
      for (let k = 0; k < n.ins.length; k++) tmpIn[k] = nodes[n.ins[k]].v;
      return n.f(tmpIn[0], tmpIn[1], tmpIn[2]);
    }

    function onInputsChanged() {
      for (const sw of switches) nodes[sw.id].v = sw.get();
      syncPanel();
      refreshPanel();
      dirty = true;
    }

    // ── silkscreen ─────────────────────────────────────────────────────────────────────────
    function drawSilk() {
      const c = silkCanvas, g = c.getContext('2d'), W = c.width, H = c.height;
      const px = (x) => ((x + BW / 2) / BW) * W, pz = (z) => ((z + BD / 2) / BD) * H, k = W / BW;
      g.clearRect(0, 0, W, H);
      // faint copper-pour hatch
      g.fillStyle = 'rgba(160,230,190,0.06)';
      for (let y = 30; y < H; y += 26) for (let x = 30 + ((y / 26) % 2) * 13; x < W; x += 26) g.fillRect(x, y, 3, 3);
      g.strokeStyle = 'rgba(235,245,240,0.85)';
      g.lineWidth = 4;
      g.beginPath();
      g.roundRect(0.1 * k, 0.1 * k, W - 0.2 * k, H - 0.2 * k, 0.14 * k);
      g.stroke();
      g.fillStyle = 'rgba(235,245,240,0.9)';
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.font = '600 34px "Segoe UI", system-ui, sans-serif';
      g.fillText('STEM LAB 3D · LOGIC TRAINER  REV 3', 0.42 * k, H - 0.16 * k);
      g.textAlign = 'right';
      g.fillText('5V  ⏚', W - 0.42 * k, H - 0.16 * k);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const b of boxes) {
        g.setLineDash([18, 12]);
        g.lineWidth = 3;
        g.strokeStyle = 'rgba(235,245,240,0.6)';
        g.beginPath();
        g.roundRect(px(b.x0), pz(b.z0), (b.x1 - b.x0) * k, (b.z1 - b.z0) * k, 20);
        g.stroke();
        g.setLineDash([]);
        g.font = '600 30px "Segoe UI", system-ui, sans-serif';
        g.fillText(b.text, px((b.x0 + b.x1) / 2), pz(b.z0) - 22);
      }
      for (const s of silk) {
        g.font = `700 ${s.size}px "Segoe UI", system-ui, sans-serif`;
        g.fillText(s.text, px(s.x), pz(s.z));
      }
      // input names beside switches (gate/half/full)
      if (mode !== 'adder4') {
        g.font = '600 26px "Segoe UI", system-ui, sans-serif';
        for (const sw of switches) { g.fillText('1', px(sw.g.position.x), pz(sw.g.position.z - 0.48)); g.fillText('0', px(sw.g.position.x), pz(sw.g.position.z + 0.27)); }
      }
      silkTex.needsUpdate = true;
    }

    // ── panel ──────────────────────────────────────────────────────────────────────────────
    ui.choice('Board', {
      options: [{ value: 'gate', label: 'One gate' }, { value: 'half', label: 'Half adder' }, { value: 'full', label: 'Full adder' }, { value: 'adder4', label: '4-bit adder' }],
      value: mode,
      onChange: (v) => { mode = v; build(); },
    });
    const cGate = ui.choice('Gate', { options: Object.keys(GATES), value: gateType, onChange: (v) => { gateType = v; build(); } });
    ui.heading('Inputs');
    const tA = ui.toggle('A', { value: !!inputs.A, onChange: (v) => { inputs.A = +v; onInputsChanged(); } });
    const tB = ui.toggle('B', { value: !!inputs.B, onChange: (v) => { inputs.B = +v; onInputsChanged(); } });
    const tC = ui.toggle('C<sub>in</sub> (carry in)', { value: !!inputs.C, onChange: (v) => { inputs.C = +v; onInputsChanged(); } });
    const sA = ui.slider('A (4 bits)', { min: 0, max: 15, step: 1, value: numA, fmt: (v) => `${bin(v, 4)}₂ = ${v}`, onChange: (v) => { numA = v; onInputsChanged(); } });
    const sB = ui.slider('B (4 bits)', { min: 0, max: 15, step: 1, value: numB, fmt: (v) => `${bin(v, 4)}₂ = ${v}`, onChange: (v) => { numB = v; onInputsChanged(); } });
    const bRand = ui.button('Random inputs', () => {
      if (mode === 'adder4') { numA = (Math.random() * 16) | 0; numB = (Math.random() * 16) | 0; }
      else { inputs.A = Math.random() < 0.5 ? 1 : 0; inputs.B = Math.random() < 0.5 ? 1 : 0; inputs.C = Math.random() < 0.5 ? 1 : 0; }
      for (const sw of switches) nodes[sw.id].v = sw.get();
      onInputsChanged();
    });
    const bWorst = ui.button('Longest ripple: 15 + 1', () => {
      numA = 15; numB = 0; for (const sw of switches) nodes[sw.id].v = sw.get();
      settle(); dirty = true;
      setTimeout(() => { numB = 1; onInputsChanged(); }, 250);
    });
    const tAuto = ui.toggle('Step through every input', { value: false, onChange: (v) => { autoT = 0; autoRow = -1; auto = v; } });
    ui.slider('Gate delay', { min: 0.05, max: 1, step: 0.05, value: delay, fmt: (v) => `${v.toFixed(2)} s (slowed down)`, onChange: (v) => (delay = v) });
    ui.heading('Outputs');
    const rOut = ui.readout('Output');
    const rState = ui.readout('Signals');
    const nTable = ui.note('');
    ui.note('Real gates switch in about 10 picoseconds; here the delay is slowed down so you can watch the signals settle.');
    let auto = false, autoT = 0, autoRow = -1;

    function showControls() {
      const show = (c, on) => { (c.el || c).style.display = on ? '' : 'none'; };
      show(cGate, mode === 'gate');
      show(tA, mode !== 'adder4');
      show(tB, mode !== 'adder4' && !(mode === 'gate' && gateType === 'NOT'));
      show(tC, mode === 'full');
      show(sA, mode === 'adder4');
      show(sB, mode === 'adder4');
      show(bWorst, mode === 'adder4');
      bRand.parentElement.style.display = '';
    }
    function syncPanel() {
      tA.set(!!inputs.A); tB.set(!!inputs.B); tC.set(!!inputs.C);
      sA.set(numA); sB.set(numB);
    }

    const cell = (v, on, hi) => `<td style="padding:2px 10px;text-align:center;${hi ? 'font-weight:700;' : ''}${on ? `color:${BLUE}` : ''}">${v}</td>`;
    function table(heads, nIn, rows, cur) {
      const th = heads.map((h, i) => `<th style="padding:2px 10px;${i === nIn ? 'border-left:1px solid #3a4a66;' : ''}">${h}</th>`).join('');
      const body = rows.map((r, ri) => `<tr style="${ri === cur ? 'background:rgba(90,169,255,0.25);outline:1px solid #5aa9ff;' : ''}">${r.map((v, i) => cell(v, ri === cur && i >= nIn, ri === cur).replace('<td style="', `<td style="${i === nIn ? 'border-left:1px solid #3a4a66;' : ''}`)).join('')}</tr>`).join('');
      return `<table style="border-collapse:collapse;margin:6px 0;font-variant-numeric:tabular-nums"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
    }
    function refreshPanel() {
      const { A, B, C } = inputs;
      if (mode === 'gate') {
        const G = GATES[gateType];
        const rows = G.n === 2 ? [[0, 0], [0, 1], [1, 0], [1, 1]].map(([a, b]) => [a, b, G.f(a, b)]) : [[0, 1], [1, 0]];
        const cur = G.n === 2 ? A * 2 + B : A;
        nTable.set(`<b>${gateType} truth table</b> (${G.expr}). ${G.desc}${table(G.n === 2 ? ['A', 'B', 'Out'] : ['A', 'Out'], G.n, rows, cur)}`);
      } else if (mode === 'half') {
        const rows = [[0, 0], [0, 1], [1, 0], [1, 1]].map(([a, b]) => [a, b, a ^ b, a & b]);
        nTable.set(`<b>Half adder</b>: A + B = (C S)₂${table(['A', 'B', 'S', 'C'], 2, rows, A * 2 + B)}`);
      } else if (mode === 'full') {
        const rows = [];
        for (let r = 0; r < 8; r++) { const a = r >> 2, b = (r >> 1) & 1, c = r & 1; rows.push([a, b, c, fa.s(a, b, c), fa.c(a, b, c)]); }
        nTable.set(`<b>Full adder</b>: A + B + C<sub>in</sub> = (C<sub>out</sub> S)₂${table(['A', 'B', 'C<sub>in</sub>', 'S', 'C<sub>out</sub>'], 3, rows, A * 4 + B * 2 + C)}`);
      } else {
        const sum = numA + numB;
        nTable.set(`<b>${bin(numA, 4)}₂ + ${bin(numB, 4)}₂ = ${bin(sum, 5)}₂</b><br>${numA} + ${numB} = ${sum}${sum > 15 ? ' (too big for 4 bits: the carry-out C4 is the 5th bit, an <i>overflow</i>)' : ''}.<br>Bit 0 is on the right. Each full-adder chip adds A<sub>i</sub> + B<sub>i</sub> + carry and passes its carry left.`);
      }
    }
    function refreshOutputs() {
      let pending = false;
      for (const n of order) if (n.timer > 0) pending = true;
      if (mode === 'adder4') {
        let s = 0;
        for (let i = 0; i < 4; i++) s |= nodes[`s${i}`].v << i;
        s |= nodes.c4.v << 4;
        rOut.set(`${bin(s, 5)}₂ = ${s}`);
      } else {
        rOut.set(outs.map((o) => `${o.name} = <b style="color:${nodes[o.src].v ? '#ffb43c' : 'inherit'}">${nodes[o.src].v}</b>`).join(' &nbsp; '));
      }
      rState.set(pending ? '<span style="color:#ffb43c">settling…</span>' : 'settled');
    }

    // ── cards ──────────────────────────────────────────────────────────────────────────────
    function gateCard(t) {
      const G = GATES[t];
      const rows = G.n === 2 ? [[0, 0], [0, 1], [1, 0], [1, 1]].map(([a, b]) => [a, b, G.f(a, b)]) : [[0, 1], [1, 0]];
      ctx.card(`${t} gate`, `<p>${G.desc}</p><p><b>${G.expr}</b></p>${table(G.n === 2 ? ['A', 'B', 'Out'] : ['A', 'Out'], G.n, rows, -1)}<p class="muted">Inside a chip, a ${t} gate is a handful of transistors (CMOS: ${({ AND: 6, OR: 6, XOR: '8–12', NOT: 2 })[t]}).</p>`, { kind: 'Logic gate' });
    }
    function faCard(i) {
      ctx.card(`Full adder, bit ${i}`, `<p>Adds A${i} + B${i} + carry-in and outputs sum S${i} and carry-out C${i + 1}.</p><p>S = A ⊕ B ⊕ C<sub>in</sub><br>C<sub>out</sub> = A·B + C<sub>in</sub>·(A ⊕ B)</p><p class="muted">Switch to the <b>Full adder</b> board to see the five gates inside.</p>`, { kind: 'Chip' });
    }

    // ── per-frame ──────────────────────────────────────────────────────────────────────────
    function applyVisuals() {
      for (const w of wires) {
        const on = nodes[w.src].v;
        if (on === w.on) continue;
        w.on = on;
        for (const s of w.segs) cores.setMatrixAt(s.k, on ? s.core : ZERO);
        cores.instanceMatrix.needsUpdate = true;
      }
      for (const n of order) if (n.body) n.body.material = n.v ? M.gateOn : M.gateOff;
      for (const o of outs) { const v = nodes[o.src].v; o.led.material = v ? M.ledOutOn : M.ledOutOff; o.halo.visible = !!v; }
      for (const sw of switches) { const v = sw.get(); sw.led.material = v ? M.ledInOn : M.ledInOff; sw.halo.visible = !!v; }
      // floating labels
      if (mode === 'adder4') {
        let s = 0;
        for (let i = 0; i < 4; i++) s |= nodes[`s${i}`].v << i;
        s |= nodes.c4.v << 4;
        setSlot(0, `A = ${bin(numA, 4)} (${numA})    B = ${bin(numB, 4)} (${numB})`, 0, BT + 0.75, -1.45, '#cfe3ff');
        setSlot(1, `Sum = ${bin(s, 5)} (${s})`, 0, BT + 0.12, 1.6, '#ffcf7a');
      } else {
        let i = 0;
        for (const sw of switches) { setSlot(i++, `${sw.name} = ${sw.get()}`, sw.g.position.x, BT + 0.42, sw.g.position.z, sw.get() ? '#9fd0ff' : '#c3cbd8'); }
        for (const o of outs) { const v = nodes[o.src].v; setSlot(i++, `${o.name} = ${v}`, o.led.parent.position.x, BT + 0.3, o.led.parent.position.z, v ? '#ffcf7a' : '#c3cbd8'); }
      }
      refreshOutputs();
    }

    function autoStep() {
      autoRow++;
      if (mode === 'adder4') { numA = (Math.random() * 16) | 0; numB = (Math.random() * 16) | 0; }
      else {
        const nIn = mode === 'full' ? 3 : mode === 'gate' && gateType === 'NOT' ? 1 : 2;
        const r = autoRow % (1 << nIn);
        if (nIn === 1) inputs.A = r;
        else if (nIn === 2) { inputs.A = r >> 1; inputs.B = r & 1; }
        else { inputs.A = r >> 2; inputs.B = (r >> 1) & 1; inputs.C = r & 1; }
      }
      onInputsChanged();
    }

    build();
    syncPanel();
    snapView(this.view, qs);

    const api = {
      update(dt, t) {
        if (auto) { autoT -= dt; if (autoT <= 0) { autoT = Math.max(1.6, delay * (mode === 'adder4' ? 12 : 5)); autoStep(); } }
        // gate simulation with propagation delay
        const d = mode === 'adder4' ? delay * 1.6 : delay;
        for (const n of order) {
          const target = evalNode(n);
          if (target !== n.pend) { n.pend = target; n.timer = target !== n.v ? d : 0; }
          if (n.timer > 0) {
            n.timer -= dt;
            if (n.timer <= 0) { n.timer = 0; if (n.v !== n.pend) { n.v = n.pend; dirty = true; } }
          }
        }
        if (dirty) { dirty = false; applyVisuals(); }
        else if ((t * 10 | 0) % 3 === 0) refreshOutputs();
        // chips glow while they are working
        for (const c of chips) {
          const busy = c.sN.timer > 0 || c.cN.timer > 0;
          c.glowMat.opacity += ((busy ? 0.35 + 0.15 * Math.sin(t * 20) : 0) - c.glowMat.opacity) * Math.min(1, dt * 12);
        }
        // switch levers
        for (const sw of switches) {
          const goal = sw.get() ? -0.5 : 0.5;
          sw.ang += (goal - sw.ang) * Math.min(1, dt * 14);
          sw.pivot.rotation.x = sw.ang;
        }
        // pulses along the wires that carry 1
        let p = 0;
        const sp = 0.32, speed = 0.9, r = 0.026;
        for (const w of wires) {
          if (!nodes[w.src].v || w.len < 0.05) continue;
          const n = Math.max(1, Math.floor(w.len / sp));
          const gap = w.len / n;
          const off = (t * speed) % gap;
          for (let k = 0; k < n && p < 400; k++) {
            const s = off + k * gap;
            let i = 1;
            while (i < w.cum.length - 1 && w.cum[i] < s) i++;
            const s0 = w.cum[i - 1], s1 = w.cum[i], a = w.pts[i - 1], b = w.pts[i];
            const f = s1 > s0 ? (s - s0) / (s1 - s0) : 0;
            const fade = Math.min(1, s / 0.08, (w.len - s) / 0.08);
            const rr = r * Math.max(0.2, fade);
            mtx.makeScale(rr, rr * 0.6, rr).setPosition(a[0] + (b[0] - a[0]) * f, BT + 0.02, a[1] + (b[1] - a[1]) * f);
            pulses.setMatrixAt(p++, mtx);
          }
        }
        pulses.count = p;
        pulses.instanceMatrix.needsUpdate = true;
      },
      onKey(e) {
        const k = e.key.toLowerCase();
        if (mode === 'adder4') return;
        if (k === 'a') { inputs.A ^= 1; onInputsChanged(); }
        if (k === 'b') { inputs.B ^= 1; onInputsChanged(); }
        if (k === 'c' && mode === 'full') { inputs.C ^= 1; onInputsChanged(); }
      },
      dispose() {
        for (const o of owned) o.dispose?.();
        traces.dispose(); cores.dispose(); pads.dispose(); pulses.dispose();
      },
    };
    return api;
  },
};

// ── geometry + texture helpers ───────────────────────────────────────────────────────────────

/** ?snap (testing): put the camera straight at the lesson view instead of easing there. */
function snapView(v, qs) {
  const V = window.stem?.view;
  if (!qs.has('snap') || !V || !v) return;
  V.goal = null; V.yaw = v.yaw; V.pitch = v.pitch; V.dist = v.dist; V.target.fromArray(v.target);
}

function clampInt(v, a, b) { return Number.isFinite(v) ? Math.min(b, Math.max(a, Math.round(v))) : a; }

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function roundedBoxGeo(w, h, d, r) {
  const g = new THREE.ExtrudeGeometry(roundedRect(w - 2 * r, d - 2 * r, r * 0.6), { depth: h - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 3, curveSegments: 6 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -(h - 2 * r) / 2, 0);
  g.computeVertexNormals();
  return g;
}

/** Standard gate symbols, extruded: a flat back + semicircle (AND), a curved shield (OR), OR with a
 *  second curve behind (XOR), a triangle with an inversion bubble (NOT). About 0.5 × 0.4 units. */
function gateGeometry(type) {
  const shapes = [];
  const s = new THREE.Shape();
  if (type === 'AND') {
    s.moveTo(-0.25, -0.2); s.lineTo(0.03, -0.2); s.absarc(0.03, 0, 0.2, -Math.PI / 2, Math.PI / 2, false); s.lineTo(-0.25, 0.2); s.lineTo(-0.25, -0.2);
    shapes.push(s);
  } else if (type === 'OR' || type === 'XOR') {
    const o = type === 'XOR' ? 0.04 : 0;
    s.moveTo(-0.25 + o, -0.2); s.quadraticCurveTo(0.1 + o, -0.2, 0.26 + o, 0); s.quadraticCurveTo(0.1 + o, 0.2, -0.25 + o, 0.2); s.quadraticCurveTo(-0.13 + o, 0, -0.25 + o, -0.2);
    shapes.push(s);
    if (type === 'XOR') {
      const c = new THREE.Shape();
      c.moveTo(-0.3, -0.2); c.quadraticCurveTo(-0.18, 0, -0.3, 0.2); c.lineTo(-0.27, 0.2); c.quadraticCurveTo(-0.15, 0, -0.27, -0.2); c.lineTo(-0.3, -0.2);
      shapes.push(c);
    }
  } else {
    s.moveTo(-0.22, -0.18); s.lineTo(0.14, 0); s.lineTo(-0.22, 0.18); s.lineTo(-0.22, -0.18);
    const b = new THREE.Shape();
    b.absarc(0.195, 0, 0.05, 0, Math.PI * 2, false);
    shapes.push(s, b);
  }
  const g = new THREE.ExtrudeGeometry(shapes, { depth: 0.11, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.014, bevelSegments: 4, curveSegments: 28 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0.025, 0);
  g.computeVertexNormals();
  return g;
}

function ledGeometry(r, h) {
  const pts = [];
  pts.push(new THREE.Vector2(0, 0), new THREE.Vector2(r * 1.12, 0), new THREE.Vector2(r * 1.12, r * 0.25), new THREE.Vector2(r, r * 0.3), new THREE.Vector2(r, h));
  for (let i = 1; i <= 10; i++) { const a = (i / 10) * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * r, h + Math.sin(a) * r)); }
  return new THREE.LatheGeometry(pts, 28);
}

function textTexture(text, w, h, size) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.font = `700 ${size}px "Segoe UI", system-ui, sans-serif`;
  g.fillStyle = '#e9f2ff';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function chipTexture(i) {
  const c = document.createElement('canvas');
  c.width = 384; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(210,220,235,0.85)';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 72px "Segoe UI", system-ui, sans-serif';
  g.fillText(`FA${i}`, 192, 110);
  g.font = '600 28px "Segoe UI", system-ui, sans-serif';
  g.fillStyle = 'rgba(200,210,225,0.6)';
  g.fillText('FULL ADDER', 192, 178);
  g.beginPath(); g.arc(34, 34, 12, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function radialTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
