// DNA & Replication (Biology). A B-DNA double helix built to real proportions (2 nm wide,
// 0.338 nm rise, 10.5 bp per turn, right-handed, strands 140° apart so the grooves are unequal),
// with sugar-phosphate backbones as smooth tubes, purines as fused 5+6 rings, pyrimidines as single
// 6 rings, and 2 or 3 hydrogen bonds per pair. "Replicate" runs helicase up the helix while free
// nucleotides drift in and pair with each template strand: two daughter helices, each half old.
//
// Every nucleotide is driven by one frame matrix (origin at its C1′ atom, x toward its partner,
// y toward the helix axis); its base, sugar and phosphate sit at fixed offsets in that frame.
// URL helpers for screenshots: ?seq=ACGT…&demo=replicate&fork=<bp>&snap

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const NM = 0.62; // scene units per nanometre
const SC = NM / 0.48; // part sizes below were drawn for 0.48
const RISE = 0.338 * NM;
const TW = (Math.PI * 2) / 10.5;
const DELTA = (140 * Math.PI) / 180; // angle between the strands across the minor groove
const R_P = 0.89 * NM, R_S = 0.7 * NM, R_C1 = 0.59 * NM;
const Y0 = 0.3;
const MAXL = 21, MINL = 6;
const D_SEP = 0.95; // daughter axes end up ±D_SEP from the original axis
const W_FORK = 3, LAG = 3.4, P_SPAN = 1.6;
const BASE_COL = { A: '#ff4f5e', T: '#ffc23d', G: '#3f8cff', C: '#34d67f' };
const PAIR = { A: 'T', T: 'A', G: 'C', C: 'G' };
const NAMES = { A: 'Adenine', T: 'Thymine', G: 'Guanine', C: 'Cytosine' };
const PURINE = { A: true, G: true, T: false, C: false };
const OLD_COL = '#4fd1a5', NEW_COL = '#c77dff';
const DEFAULT_SEQ = 'ATGCGTACCGATTAGCCATGC';
const VIEW = { dist: 7.8, yaw: 0.3, pitch: 0.2, target: [0, 1.55, 0] };
const AXIS_Y = 1.75; // the helix lies along x at this height

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

function snapView(v) {
  const sv = window.stem?.view;
  if (!sv) return;
  Object.assign(sv, { yaw: v.yaw, pitch: v.pitch, dist: v.dist, goal: null });
  sv.target.set(...v.target);
}

/** A tube through up to maxPts control points (Catmull-Rom), rebuilt in place without allocating. */
class DynTube {
  constructor(maxPts, sub, radial, radius, mat) {
    Object.assign(this, { sub, radial, radius });
    const maxRings = (maxPts - 1) * sub + 1;
    this.c = new Float32Array(maxRings * 3);
    const nv = maxRings * (radial + 1);
    this.pos = new Float32Array(nv * 3);
    this.nor = new Float32Array(nv * 3);
    const idx = [];
    for (let r = 0; r < maxRings - 1; r++) for (let j = 0; j < radial; j++) {
      const a = r * (radial + 1) + j, b = a + radial + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2, 0), 4.5);
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
  }
  set(p, n) {
    const { sub, radial, radius, c, pos, nor } = this;
    if (n < 2) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    let w = 0;
    for (let s = 0; s < n - 1; s++) {
      const i0 = Math.max(s - 1, 0) * 3, i1 = s * 3, i2 = (s + 1) * 3, i3 = Math.min(s + 2, n - 1) * 3;
      const kmax = s === n - 2 ? sub : sub - 1;
      for (let k = 0; k <= kmax; k++) {
        const t = k / sub, t2 = t * t, t3 = t2 * t;
        for (let d = 0; d < 3; d++) {
          const p0 = p[i0 + d], p1 = p[i1 + d], p2 = p[i2 + d], p3 = p[i3 + d];
          c[w * 3 + d] = 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
        }
        w++;
      }
    }
    const rings = w;
    let nx = 0, ny = 0, nz = 0;
    for (let r = 0; r < rings; r++) {
      const a = Math.max(r - 1, 0) * 3, b = Math.min(r + 1, rings - 1) * 3;
      let tx = c[b] - c[a], ty = c[b + 1] - c[a + 1], tz = c[b + 2] - c[a + 2];
      const tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl; ty /= tl; tz /= tl;
      if (r === 0) { if (Math.abs(ty) < 0.9) { nx = 0; ny = 1; nz = 0; } else { nx = 1; ny = 0; nz = 0; } }
      const dt = nx * tx + ny * ty + nz * tz;
      nx -= tx * dt; ny -= ty * dt; nz -= tz * dt;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;
      const bx = ty * nz - tz * ny, by = tz * nx - tx * nz, bz = tx * ny - ty * nx;
      for (let j = 0; j <= radial; j++) {
        const ang = (j / radial) * Math.PI * 2, co = Math.cos(ang), si = Math.sin(ang);
        const dx = nx * co + bx * si, dy = ny * co + by * si, dz = nz * co + bz * si;
        const v = (r * (radial + 1) + j) * 3;
        pos[v] = c[r * 3] + dx * radius; pos[v + 1] = c[r * 3 + 1] + dy * radius; pos[v + 2] = c[r * 3 + 2] + dz * radius;
        nor[v] = dx; nor[v + 1] = dy; nor[v + 2] = dz;
      }
    }
    const g = this.mesh.geometry;
    g.setDrawRange(0, (rings - 1) * radial * 6);
    g.attributes.position.needsUpdate = true;
    g.attributes.normal.needsUpdate = true;
  }
}

/** Base geometry in the nucleotide frame: x from C1′ toward the partner, y toward the axis, z = stacking. */
function baseGeometry(purine) {
  const s = 0.065, T = 0.045, lift = 0.045, stem = 0.03;
  const shapes = [];
  const poly = (cx, cy, R, n, a0) => {
    const sh = new THREE.Shape();
    for (let k = 0; k < n; k++) {
      const a = a0 + (k / n) * Math.PI * 2;
      if (k === 0) sh.moveTo(cx + R * Math.cos(a), cy + R * Math.sin(a)); else sh.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a));
    }
    sh.closePath();
    return sh;
  };
  let left;
  if (purine) {
    const R5 = s / (2 * Math.sin(Math.PI / 5)), a5 = s / (2 * Math.tan(Math.PI / 5)), a6 = (s * Math.sqrt(3)) / 2;
    const c5 = stem + R5;
    shapes.push(poly(c5, lift, R5, 5, Math.PI)); // a vertex points back at C1′, a vertical edge faces the hexagon
    shapes.push(poly(c5 + a5 + a6, lift, s, 6, Math.PI / 6)); // flat sides left/right, sharing the edge
    left = new THREE.Vector3(stem, lift, 0);
  } else {
    shapes.push(poly(stem + 0.015 + s, lift, s, 6, 0)); // pointy hexagon
    left = new THREE.Vector3(stem + 0.015, lift, 0);
  }
  const ext = new THREE.ExtrudeGeometry(shapes, { depth: T, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.007, bevelSegments: 2, curveSegments: 1 });
  ext.translate(0, 0, -T / 2);
  ext.deleteAttribute('uv');
  const len = left.length() + 0.01;
  const st = new THREE.CylinderGeometry(0.013, 0.013, len, 10).toNonIndexed();
  st.deleteAttribute('uv');
  st.rotateZ(Math.atan2(left.y, left.x) - Math.PI / 2);
  st.translate(left.x / 2, left.y / 2, 0);
  const g = mergeGeometries([ext.index ? ext.toNonIndexed() : ext, st], false);
  g.computeVertexNormals();
  g.scale(SC, SC, SC);
  return g;
}
const TIP = { pur: (0.03 + 0.0553 + 0.0447 + 2 * 0.0563) * SC, pyr: (0.03 + 0.015 + 0.13) * SC };

export default {
  view: { ...VIEW, minDist: 3, maxDist: 16 },
  floor: true,
  explain: `
    <p><b>DNA</b> stores the instructions for building and running a living thing. It is two long strands twisted into a <b>double helix</b>.</p>
    <ul>
      <li>Each strand is a chain of <b>nucleotides</b>. A nucleotide is a sugar (deoxyribose), a phosphate group and one of four <b>bases</b>: adenine (A), thymine (T), guanine (G) or cytosine (C).</li>
      <li>Sugars and phosphates link up to form each strand's <b>backbone</b> (the smooth tubes).</li>
      <li>Bases pair across the middle: <b>A with T</b> using 2 hydrogen bonds, and <b>G with C</b> using 3. A and G are larger <b>purines</b> (two rings); T and C are smaller <b>pyrimidines</b> (one ring). Each rung is one purine plus one pyrimidine, so every rung is the same width.</li>
      <li>The strands run in opposite directions (<b>antiparallel</b>: one 5′→3′, the other 3′→5′). They twist into a right-handed helix about 2 nm wide, with about 10.5 base pairs per turn, 0.34 nm apart. The twist leaves a wide <b>major groove</b> and a narrow <b>minor groove</b>.</li>
    </ul>
    <p><b>Replication.</b> Before a cell divides it copies its DNA. <b>Helicase</b> unzips the helix by breaking the hydrogen bonds, opening a <b>replication fork</b>. <b>DNA polymerase</b> then builds a new strand along each old one, adding free nucleotides that pair with the template (A with T, G with C). Each new DNA molecule keeps one old strand and gains one new one, so replication is <b>semi-conservative</b>, as Meselson and Stahl showed in 1958.</p>
    <p class="muted">Simplified: polymerase can only build in the 5′→3′ direction, so in a real cell one new strand (the lagging strand) is made in short Okazaki fragments, and other enzymes (primase, ligase) help. Here both new strands grow smoothly. The model is to scale, but atoms are drawn as simple shapes.</p>`,
  formula: 'Chargaff\'s rule: %A = %T and %G = %C &nbsp;·&nbsp; GC content = (G + C) ÷ total bases &nbsp;·&nbsp; 1 turn ≈ 10.5 bp ≈ 3.6 nm',
  vocab: [
    ['Nucleotide', 'One unit of DNA: a sugar, a phosphate and a base.'],
    ['Base pair', 'Two bases joined across the helix by hydrogen bonds: A–T or G–C.'],
    ['Purine / pyrimidine', 'Purines (A, G) have two rings; pyrimidines (T, C) have one.'],
    ['Hydrogen bond', 'A weak attraction that holds paired bases together; easy to break for copying.'],
    ['Antiparallel', 'The two strands run in opposite directions, 5′→3′ and 3′→5′.'],
    ['Major / minor groove', 'The wide and narrow spiral gaps between the two backbones.'],
    ['Helicase', 'The enzyme that unwinds DNA and separates the two strands.'],
    ['DNA polymerase', 'The enzyme that adds nucleotides to build a new strand on a template.'],
    ['Semi-conservative', 'Each copy keeps one original strand and one newly made strand.'],
    ['GC content', 'The percentage of bases in a DNA sequence that are G or C.'],
  ],
  standards: ['NGSS HS-LS1-1', 'NGSS HS-LS3-1'],
  quiz: [
    { q: 'In DNA, which base pairs with adenine (A)?', choices: ['Guanine', 'Cytosine', 'Thymine', 'Uracil'], answer: 2,
      why: 'A always pairs with T (2 hydrogen bonds) and G with C (3). Uracil replaces thymine in RNA, not DNA.' },
    { q: 'How many hydrogen bonds hold a G–C base pair together?', choices: ['1', '2', '3', '4'], answer: 2,
      why: 'G–C pairs have 3 hydrogen bonds and A–T pairs have 2, so GC-rich DNA is harder to pull apart.' },
    { q: 'A DNA sample is 30% adenine. What percentage is guanine?', choices: ['30%', '20%', '40%', '70%'], answer: 1,
      why: 'A = T, so A + T = 60%. That leaves 40% for G + C, and G = C, so G = 20%.' },
    { q: 'After one round of replication, what does each new DNA molecule contain?', choices: ['Two new strands', 'Two original strands', 'One original strand and one new strand', 'Random pieces of old and new DNA'], answer: 2,
      why: 'Replication is semi-conservative: each old strand is the template for a new partner, so every copy is half old and half new.' },
    { q: 'What does helicase do during replication?', choices: ['Joins nucleotides into a new strand', 'Unwinds the helix and separates the strands by breaking hydrogen bonds', 'Cuts DNA into genes', 'Turns DNA into protein'], answer: 1,
      why: 'Helicase opens the replication fork. DNA polymerase is the enzyme that then builds the new strands.' },
  ],

  build(ctx) {
    const { root, ui } = ctx;
    const q = new URLSearchParams(location.search);
    const clean = (s) => (s || '').toUpperCase().replace(/[^ACGT]/g, '').slice(0, MAXL);
    let seq = clean(q.get('seq'));
    if (seq.length < MINL) seq = DEFAULT_SEQ;
    let L = seq.length;

    const dna = new THREE.Group();
    // Built along local y, then laid on its side: local y → world x, local x → world −y.
    const holder = new THREE.Group();
    holder.position.y = AXIS_Y;
    holder.rotation.z = -Math.PI / 2;
    holder.add(dna);
    root.add(holder);

    // ── geometry + instanced parts ─────────────────────────────────────────────────────────
    const N4 = 4 * MAXL;
    const baseMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.18 });
    const purMesh = new THREE.InstancedMesh(baseGeometry(true), baseMat, N4);
    const pyrMesh = new THREE.InstancedMesh(baseGeometry(false), baseMat, N4);
    const bbMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.28, metalness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.2 });
    const sugarGeo = new THREE.CylinderGeometry(0.042 * SC, 0.042 * SC, 0.032 * SC, 5);
    sugarGeo.rotateX(Math.PI / 2);
    const sugMesh = new THREE.InstancedMesh(sugarGeo, bbMat, N4);
    const phoMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.056 * SC, 20, 14), bbMat, N4);
    const bondGeo = new THREE.CylinderGeometry(0.0075 * SC, 0.0075 * SC, 1, 8);
    const bondMesh = new THREE.InstancedMesh(bondGeo, new THREE.MeshBasicMaterial({ color: 0xe6f6ff, toneMapped: false, transparent: true, opacity: 0.9 }), 2 * MAXL * 3);
    const bigSphere = new THREE.Sphere(new THREE.Vector3(0, 2, 0), 4.5);
    for (const m of [purMesh, pyrMesh, sugMesh, phoMesh, bondMesh]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.boundingSphere = bigSphere;
      if (m !== bondMesh) { m.castShadow = true; m.receiveShadow = true; }
      dna.add(m);
    }
    const oldCol = new THREE.Color(OLD_COL), newCol = new THREE.Color(NEW_COL);
    const oldBead = new THREE.Color(OLD_COL).lerp(new THREE.Color('#ffffff'), 0.35);
    const newBead = new THREE.Color(NEW_COL).lerp(new THREE.Color('#ffffff'), 0.3);
    for (let k = 0; k < N4; k++) {
      const c = k >= 2 * MAXL ? newBead : oldBead;
      sugMesh.setColorAt(k, c);
      phoMesh.setColorAt(k, c);
    }
    const tubeOld = new THREE.MeshPhysicalMaterial({ color: oldCol, roughness: 0.25, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.15, emissive: oldCol, emissiveIntensity: 0.12 });
    const tubeNew = new THREE.MeshPhysicalMaterial({ color: newCol, roughness: 0.25, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.15, emissive: newCol, emissiveIntensity: 0.15 });
    const tubes = [0, 1, 2, 3].map((s) => new DynTube(MAXL, 8, 14, 0.042 * SC, s < 2 ? tubeOld : tubeNew));
    for (const t of tubes) dna.add(t.mesh);
    const tubePts = [0, 1, 2, 3].map(() => new Float32Array(MAXL * 3));

    // Enzymes.
    const enzMat = new THREE.MeshPhysicalMaterial({ color: '#ffb347', roughness: 0.45, clearcoat: 0.6, transparent: true, opacity: 0.62, depthWrite: false, sheen: 1, sheenColor: new THREE.Color('#ffe2b0') });
    const helicase = new THREE.Group();
    const lobeGeo = new THREE.SphereGeometry(0.15 * SC, 24, 16);
    for (let k = 0; k < 6; k++) {
      const lobe = new THREE.Mesh(lobeGeo, enzMat);
      const a = (k / 6) * Math.PI * 2;
      lobe.position.set(Math.cos(a) * 0.36 * SC, 0, Math.sin(a) * 0.36 * SC);
      lobe.scale.set(1, 0.75, 1);
      helicase.add(lobe);
    }
    const polMat = new THREE.MeshPhysicalMaterial({ color: '#5aa9ff', roughness: 0.4, clearcoat: 0.7, transparent: true, opacity: 0.45, depthWrite: false, sheen: 1, sheenColor: new THREE.Color('#bfe0ff') });
    const polGeo = new THREE.SphereGeometry(0.5 * SC, 32, 20);
    const pols = [-1, 1].map(() => { const m = new THREE.Mesh(polGeo, polMat); m.scale.set(1, 0.55, 1); dna.add(m); return m; });
    dna.add(helicase);
    const helLabel = ctx.label('Helicase', { color: '#ffc77a', size: 0.7 });
    helLabel.position.set(0.62, 0.05, 0);
    dna.add(helLabel);
    const polLabel = ctx.label('DNA polymerase', { color: '#9cc9ff', size: 0.7 });
    polLabel.position.set(-0.55, 0, 0);
    pols[0].add(polLabel);

    // Ends, grooves, selection.
    const endLabels = [0, 1, 2, 3].map(() => { const l = ctx.label('5′', { color: '#bff5e2', size: 0.62 }); dna.add(l); return l; });
    const grooveLabels = [ctx.label('major groove', { color: '#d9e4ff', size: 0.62 }), ctx.label('minor groove', { color: '#d9e4ff', size: 0.62 })];
    for (const l of grooveLabels) dna.add(l);
    const daughterLabels = [ctx.label('Copy 1: old + new strand', { color: '#e4c8ff', size: 0.7 }), ctx.label('Copy 2: old + new strand', { color: '#e4c8ff', size: 0.7 })];
    for (const l of daughterLabels) { l.visible = false; dna.add(l); }
    const selRing = new THREE.Mesh(new THREE.TorusGeometry(0.5 * SC, 0.009, 8, 96), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, opacity: 0.85 }));
    selRing.rotation.x = Math.PI / 2;
    selRing.visible = false;
    dna.add(selRing);
    let selected = -1;

    // ── frames ─────────────────────────────────────────────────────────────────────────────
    const frames = Array.from({ length: N4 }, () => new THREE.Matrix4());
    const prog = new Float32Array(N4); // attach progress of new nucleotides
    const homes = new Float32Array(N4 * 3), spinAx = new Float32Array(N4 * 3), phase = new Float32Array(N4);
    const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vX = new THREE.Vector3(), vY = new THREE.Vector3(), vZ = new THREE.Vector3();
    const vPos = new THREE.Vector3(), vScale = new THREE.Vector3(1, 1, 1), vTmp = new THREE.Vector3(), vAx = new THREE.Vector3();
    const qT = new THREE.Quaternion(), qF = new THREE.Quaternion(), mTmp = new THREE.Matrix4();
    const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
    const UP = new THREE.Vector3(0, 1, 0);
    const cyl = (out, r, ang, y, ax) => out.set(ax + r * Math.cos(ang), y, -r * Math.sin(ang));

    function frameFor(out, i, role, ax) {
      const y = Y0 + i * RISE, th = i * TW;
      const a = role === 0 ? th : th + DELTA, b = role === 0 ? th + DELTA : th;
      cyl(vA, R_C1, a, y, ax);
      cyl(vB, R_C1, b, y, ax);
      vX.subVectors(vB, vA).normalize();
      vY.crossVectors(UP, vX);
      vTmp.set(ax - (vA.x + vB.x) / 2, 0, -(vA.z + vB.z) / 2);
      if (vY.dot(vTmp) < 0) vY.negate();
      vZ.crossVectors(vX, vY);
      return out.makeBasis(vX, vY, vZ).setPosition(vA);
    }
    // Sugar and phosphate offsets in the nucleotide frame (the same for every nucleotide).
    const F0inv = frameFor(new THREE.Matrix4(), 0, 0, 0).clone().invert();
    const localS = cyl(new THREE.Vector3(), R_S, -0.12 * TW, Y0 - 0.12 * RISE, 0).applyMatrix4(F0inv);
    const localP = cyl(new THREE.Vector3(), R_P, -0.42 * TW, Y0 - 0.42 * RISE, 0).applyMatrix4(F0inv);
    const Ls = new THREE.Matrix4().makeTranslation(localS.x, localS.y, localS.z);
    const Lp = new THREE.Matrix4().makeTranslation(localP.x, localP.y, localP.z);
    const chord = 2 * R_C1 * Math.sin(DELTA / 2);
    // Hydrogen bonds across the gap, in the frame of the role-0 nucleotide.
    const bondLocal = (purineFirst, offs) => {
      const x0 = (purineFirst ? TIP.pur : TIP.pyr) - 0.01, x1 = chord - (purineFirst ? TIP.pyr : TIP.pur) + 0.01;
      return offs.map((o) => new THREE.Matrix4().compose(new THREE.Vector3((x0 + x1) / 2, (0.045 + o) * SC, 0), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI / 2), new THREE.Vector3(1, x1 - x0, 1)));
    };
    const BONDS = {
      A: bondLocal(true, [-0.022, 0.022]), T: bondLocal(false, [-0.022, 0.022]),
      G: bondLocal(true, [-0.032, 0, 0.032]), C: bondLocal(false, [-0.032, 0, 0.032]),
    };

    const baseOf = (st, i) => (st === 0 || st === 3 ? seq[i] : PAIR[seq[i]]);
    const S = { state: 'idle', fork: -10, speed: 1.6, spin: true, labels: true, popT: 0, t: 0 };

    function seedFree() {
      const rnd = Math.random;
      for (let st = 2; st < 4; st++) for (let i = 0; i < L; i++) {
        const k = st * MAXL + i;
        frameFor(mTmp, i, st === 2 ? 1 : 0, st === 2 ? -D_SEP : D_SEP);
        vPos.setFromMatrixPosition(mTmp);
        const out = st === 2 ? -1 : 1;
        homes[k * 3] = vPos.x + out * (0.3 + rnd() * 0.55);
        homes[k * 3 + 1] = vPos.y + (rnd() - 0.5) * 0.5;
        homes[k * 3 + 2] = vPos.z + (rnd() - 0.5) * 1.1;
        vAx.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
        spinAx[k * 3] = vAx.x; spinAx[k * 3 + 1] = vAx.y; spinAx[k * 3 + 2] = vAx.z;
        phase[k] = rnd() * 10;
      }
    }

    function layout() {
      const run = S.state !== 'idle', f = S.fork, t = S.t;
      const pop = smooth(S.popT / 0.8);
      let attached2 = 0, attached3 = 0, open2 = true, open3 = true;
      for (let i = 0; i < L; i++) {
        const sep = run ? smooth((f - i) / W_FORK) : 0;
        const ax1 = -D_SEP * sep, ax2 = D_SEP * sep;
        frameFor(frames[i], i, 0, ax1);
        frameFor(frames[MAXL + i], i, 1, ax2);
        const p = run ? smooth((f - i - LAG) / P_SPAN) : 0;
        for (let st = 2; st < 4; st++) {
          const k = st * MAXL + i, F = frames[k];
          prog[k] = p;
          frameFor(F, i, st === 2 ? 1 : 0, st === 2 ? ax1 : ax2);
          if (p < 1 && run) {
            vPos.setFromMatrixPosition(F);
            qT.setFromRotationMatrix(F);
            vAx.set(spinAx[k * 3], spinAx[k * 3 + 1], spinAx[k * 3 + 2]);
            qF.setFromAxisAngle(vAx, phase[k] + t * 0.9);
            const e = p;
            vTmp.set(
              homes[k * 3] + Math.sin(t * 1.1 + phase[k]) * 0.07,
              homes[k * 3 + 1] + Math.sin(t * 0.8 + phase[k] * 1.7) * 0.07,
              homes[k * 3 + 2] + Math.cos(t * 0.9 + phase[k]) * 0.07,
            );
            vPos.lerpVectors(vTmp, vPos, e);
            qF.slerp(qT, e);
            const sc = pop;
            vScale.set(sc, sc, sc);
            F.compose(vPos, qF, vScale);
          }
        }
        if (open2 && p >= 1) attached2++; else open2 = false;
        if (open3 && p >= 1) attached3++; else open3 = false;
      }
      // Instances.
      let nb = 0;
      for (let st = 0; st < 4; st++) {
        const tp = tubePts[st];
        let np = 0;
        const limit = st < 2 ? L : st === 2 ? attached2 : attached3;
        for (let i = 0; i < MAXL; i++) {
          const k = st * MAXL + i;
          const hidden = i >= L || (st >= 2 && !run);
          if (hidden) {
            purMesh.setMatrixAt(k, ZERO); pyrMesh.setMatrixAt(k, ZERO); sugMesh.setMatrixAt(k, ZERO); phoMesh.setMatrixAt(k, ZERO);
            continue;
          }
          const F = frames[k], b = baseOf(st, i);
          (PURINE[b] ? purMesh : pyrMesh).setMatrixAt(k, F);
          (PURINE[b] ? pyrMesh : purMesh).setMatrixAt(k, ZERO);
          mTmp.multiplyMatrices(F, Ls); sugMesh.setMatrixAt(k, mTmp);
          mTmp.multiplyMatrices(F, Lp); phoMesh.setMatrixAt(k, mTmp);
          if (i < limit) {
            vA.copy(localP).applyMatrix4(F);
            tp[np++] = vA.x; tp[np++] = vA.y; tp[np++] = vA.z;
          }
        }
        tubes[st].set(tp, np / 3);
      }
      // Hydrogen bonds: set 0 on strand 0 (with the old partner, or the new one once attached); set 1 on strand 3.
      for (let i = 0; i < L; i++) {
        const sep = run ? smooth((f - i) / W_FORK) : 0;
        const b = seq[i], list = BONDS[b];
        const show0 = sep < 0.03 || prog[2 * MAXL + i] >= 1;
        const show1 = run && prog[3 * MAXL + i] >= 1;
        for (let j = 0; j < 3; j++) {
          bondMesh.setMatrixAt(nb++, show0 && j < list.length ? mTmp.multiplyMatrices(frames[i], list[j]) : ZERO);
          bondMesh.setMatrixAt(nb++, show1 && j < list.length ? mTmp.multiplyMatrices(frames[3 * MAXL + i], list[j]) : ZERO);
        }
      }
      for (; nb < bondMesh.count; nb++) bondMesh.setMatrixAt(nb, ZERO);
      for (const m of [purMesh, pyrMesh, sugMesh, phoMesh, bondMesh]) m.instanceMatrix.needsUpdate = true;

      // Enzymes, labels.
      const fy = Y0 + Math.min(Math.max(f, 0), L - 1) * RISE;
      helicase.visible = run && f > -0.5 && f < L + 0.5;
      helicase.position.set(0, fy + RISE * 0.5, 0);
      helicase.rotation.y = -t * 2.2;
      helLabel.position.set(-0.8, fy + RISE * 0.5 + 0.12, 0);
      helLabel.visible = helicase.visible && S.labels;
      const py = f - LAG;
      for (const [k, m] of pols.entries()) {
        m.visible = run && py > -0.5 && py < L - 0.3;
        m.position.set((k ? 1 : -1) * D_SEP, Y0 + Math.max(0, py) * RISE, 0);
      }
      placeEnd(endLabels[0], 0, 0, -1); placeEnd(endLabels[1], 0, L - 1, 1);
      placeEnd(endLabels[2], MAXL, 0, -1); placeEnd(endLabels[3], MAXL, L - 1, 1);
      const done = S.state === 'done';
      for (const [k, l] of daughterLabels.entries()) {
        l.visible = done && S.labels;
        l.position.set((k ? 1 : -1) * D_SEP, Y0 + L * RISE + 0.35, 0);
      }
      if (selected >= 0) placeSel();
    }
    function placeEnd(label, off, i, dir) {
      vPos.copy(localP).applyMatrix4(frames[off + i]);
      label.position.set(vPos.x * 1.25, vPos.y + dir * 0.16, vPos.z * 1.25);
    }
    function placeSel() {
      const i = selected % MAXL;
      vPos.setFromMatrixPosition(frames[i]);
      vTmp.setFromMatrixPosition(frames[MAXL + i]);
      const st = Math.floor(selected / MAXL);
      if (st === 1 || st === 2) vPos.copy(vTmp);
      const sep = S.state !== 'idle' ? smooth((S.fork - i) / W_FORK) : 0;
      const ax = (st === 0 || st === 2 ? -1 : 1) * D_SEP * sep;
      selRing.position.set(ax, Y0 + i * RISE, 0);
      selRing.visible = true;
    }
    function updateEndText() {
      // Strand 0 (role 0) runs 5′→3′ upward; strand 1 runs 3′→5′ upward.
      const tx = ['5′', '3′', '3′', '5′'];
      for (let k = 0; k < 4; k++) endLabels[k] = ctx.relabel(endLabels[k], tx[k], { color: '#bff5e2', size: 0.62 });
    }
    function placeGrooves() {
      const k = Math.floor(L / 2) + 1, y = Y0 + k * RISE, th = k * TW;
      cyl(grooveLabels[1].position, R_P + 0.35, th + DELTA / 2, y, 0);
      cyl(grooveLabels[0].position, R_P + 0.35, th + DELTA / 2 + Math.PI, y + RISE * 1.5, 0);
    }

    // ── readouts / controls ────────────────────────────────────────────────────────────────
    ui.heading('Sequence (strand 1, 5′→3′)');
    const seqNote = ui.note(`<input id="dna-seq" spellcheck="false" maxlength="${MAXL}" style="width:100%;box-sizing:border-box;padding:7px 9px;border-radius:8px;border:1px solid rgba(160,190,255,0.25);background:rgba(255,255,255,0.05);color:#e8eeff;font:600 14px ui-monospace,Consolas,monospace;letter-spacing:0.12em;text-transform:uppercase">`);
    const input = seqNote.el.querySelector('input');
    input.value = seq;
    input.addEventListener('change', () => {
      const s = clean(input.value);
      if (s.length < MINL) { ctx.toast(`Use at least ${MINL} letters (A, C, G, T).`); input.value = seq; return; }
      setSeq(s);
    });
    const lenSl = ui.slider('Length', { min: MINL, max: MAXL, step: 1, value: L, fmt: (v) => `${v} bp`, onChange: (v) => {
      let s = seq.slice(0, v);
      while (s.length < v) s += 'ACGT'[Math.floor(Math.random() * 4)];
      setSeq(s, false);
    } });
    ui.button('Random sequence', () => {
      let s = '';
      for (let i = 0; i < L; i++) s += 'ACGT'[Math.floor(Math.random() * 4)];
      setSeq(s);
    });
    ui.button('GC-rich', () => setSeq(Array.from({ length: L }, () => 'GCGCGCAT'[Math.floor(Math.random() * 8)]).join('')));
    ui.button('AT-rich', () => setSeq(Array.from({ length: L }, () => 'ATATATGC'[Math.floor(Math.random() * 8)]).join('')));

    const r = {
      len: ui.readout('Length'),
      gc: ui.readout('GC content'),
      hb: ui.readout('Hydrogen bonds'),
      s1: ui.readout('Strand 1'),
      s2: ui.readout('Strand 2'),
    };
    for (const k of ['s1', 's2']) r[k].el.querySelector('.ctl-val').style.cssText += 'font-family:ui-monospace,Consolas,monospace;font-size:12px;letter-spacing:0.05em;word-break:break-all';

    ui.heading('Replication');
    ui.button('Unzip / Replicate', () => startReplication(), { primary: true });
    ui.button('Reset', () => resetReplication());
    ui.slider('Speed', { min: 0.4, max: 5, step: 0.1, value: S.speed, fmt: (v) => `${v.toFixed(1)} bp/s`, onChange: (v) => (S.speed = v) });
    const status = ui.note('');
    ui.heading('View');
    ui.toggle('Spin', { value: S.spin, onChange: (v) => (S.spin = v) });
    ui.toggle('Labels', { value: S.labels, onChange: (v) => { S.labels = v; applyLabels(); } });
    ui.note('<span class="muted">Click a base pair to see it (and change it); click a backbone for its parts. Base colours: <b style="color:#ff6b6b">A</b> <b style="color:#ffd166">T</b> <b style="color:#5aa9ff">G</b> <b style="color:#7bed9f">C</b>. Backbones: <b style="color:#4fd1a5">original</b>, <b style="color:#c77dff">new</b>.</span>');

    function applyLabels() {
      const idle = S.state === 'idle';
      for (const l of endLabels) l.visible = S.labels && idle;
      for (const l of grooveLabels) l.visible = S.labels && idle;
      helLabel.visible = polLabel.visible = S.labels;
      for (const l of daughterLabels) l.visible = S.labels && S.state === 'done';
    }

    function refreshReadouts() {
      let gc = 0, at = 0;
      for (const c of seq) { if (c === 'G' || c === 'C') gc++; else at++; }
      r.len.set(`${L} bp &nbsp;<span class="muted">${(L / 10.5).toFixed(2)} turns · ${(L * 0.338).toFixed(1)} nm</span>`);
      r.gc.set(`${Math.round((gc / L) * 100)}% &nbsp;<span class="muted">(${gc} G–C, ${at} A–T)</span>`);
      r.hb.set(`${2 * at + 3 * gc} &nbsp;<span class="muted">(2 × ${at} + 3 × ${gc})</span>`);
      const col = (s) => [...s].map((c) => `<span style="color:${BASE_COL[c]}">${c}</span>`).join('');
      r.s1.set(`5′ ${col(seq)} 3′`);
      r.s2.set(`3′ ${col([...seq].map((c) => PAIR[c]).join(''))} 5′`);
    }

    function setSeq(s, syncSlider = true) {
      if (S.state !== 'idle') resetReplication();
      seq = s; L = s.length;
      input.value = seq;
      if (syncSlider) lenSl.set(L);
      for (let st = 0; st < 4; st++) for (let i = 0; i < MAXL; i++) {
        const k = st * MAXL + i;
        if (i < L) { const c = new THREE.Color(BASE_COL[baseOf(st, i)]); purMesh.setColorAt(k, c); pyrMesh.setColorAt(k, c); }
      }
      purMesh.instanceColor.needsUpdate = pyrMesh.instanceColor.needsUpdate = true;
      selected = -1; selRing.visible = false;
      ctx.hideCard();
      dna.position.y = -(Y0 + ((L - 1) * RISE) / 2);
      updateEndText();
      placeGrooves();
      applyLabels();
      refreshReadouts();
      layout();
    }

    function startReplication() {
      if (S.state !== 'idle') resetReplication();
      seedFree();
      S.state = 'run'; S.fork = -1.2; S.popT = 0;
      selected = -1; selRing.visible = false;
      applyLabels();
      status.set('Helicase is opening the fork; polymerase follows, pairing free nucleotides with each old strand.');
      ctx.view({ ...VIEW, dist: 9.2 });
    }
    function resetReplication() {
      S.state = 'idle'; S.fork = -10;
      applyLabels();
      status.set('');
      layout();
    }

    // ── picking ────────────────────────────────────────────────────────────────────────────
    function pairCard(k) {
      const st = Math.floor(k / MAXL), i = k % MAXL;
      if (i >= L) return;
      const a = baseOf(st, i), b = PAIR[a];
      const nb = a === 'A' || a === 'T' ? 2 : 3;
      const isNew = st >= 2;
      const ring = (x) => (PURINE[x] ? 'a purine, two rings' : 'a pyrimidine, one ring');
      const editable = S.state === 'idle';
      const btn = (p) => `<button class="btn" data-pair="${p}" style="padding:3px 10px;margin:0 4px 4px 0">${p[0]}–${p[1]}</button>`;
      ctx.card(`Base pair ${i + 1}: <span style="color:${BASE_COL[a]}">${a}</span>–<span style="color:${BASE_COL[b]}">${b}</span>`,
        `<p><b style="color:${BASE_COL[a]}">${NAMES[a]}</b> (${ring(a)}) pairs with <b style="color:${BASE_COL[b]}">${NAMES[b]}</b> (${ring(b)}) through <b>${nb} hydrogen bonds</b>.</p>` +
        `<p>It sits ${(i * 0.338).toFixed(2)} nm up the helix, turned ${Math.round((i * 360) / 10.5) % 360}° from the first pair.${isNew ? ' This base is on a <b style="color:#c77dff">newly made strand</b>: it was a free nucleotide until polymerase paired it with the old strand.' : ''}</p>` +
        (editable ? `<p>Change this pair: ${btn('AT')}${btn('TA')}${btn('GC')}${btn('CG')}</p>` : '<p class="muted">Reset replication to edit the sequence.</p>'),
        { kind: isNew ? 'New base pair' : 'Base pair' });
      selected = st * MAXL + i;
      placeSel();
      const body = document.getElementById('card-body');
      body?.querySelectorAll('button[data-pair]').forEach((el) => el.addEventListener('click', () => {
        const p = el.dataset.pair;
        const first = st === 0 || st === 3 ? p[0] : p[1];
        const s = seq.slice(0, i) + first + seq.slice(i + 1);
        setSeq(s);
        pairCard(k);
      }));
    }
    function backboneCard(k) {
      const st = Math.floor(k / MAXL);
      const isNew = st >= 2;
      const dir = st === 0 || st === 3 ? 'runs 5′→3′ upward' : 'runs 5′→3′ downward (antiparallel)';
      ctx.card(`Sugar–phosphate backbone${isNew ? ' (new strand)' : ''}`,
        `<p>Each nucleotide's sugar (deoxyribose, the pentagons) is joined by strong covalent bonds to the next nucleotide's phosphate group (the beads). The bases hang off the sugars and point inward.</p>` +
        `<p>This strand ${dir}. The 5′ end has a free phosphate and the 3′ end a free –OH group on the sugar; polymerase can only add new nucleotides to a 3′ end.</p>`,
        { kind: isNew ? 'New strand' : 'Original strand' });
    }
    ctx.pickable(purMesh, (h) => pairCard(h.instanceId));
    ctx.pickable(pyrMesh, (h) => pairCard(h.instanceId));
    ctx.pickable(sugMesh, (h) => backboneCard(h.instanceId));
    ctx.pickable(phoMesh, (h) => backboneCard(h.instanceId));
    tubes.forEach((t, s) => ctx.pickable(t.mesh, () => backboneCard(s * MAXL)));

    // ── start ──────────────────────────────────────────────────────────────────────────────
    setSeq(seq);
    if (q.get('demo') === 'replicate') {
      startReplication();
      if (q.has('fork')) { S.fork = parseFloat(q.get('fork')) || 0; S.popT = 1; S.t = 3; layout(); }
    }
    if (q.get('demo') === 'card') pairCard(3);
    let snap = q.has('snap');
    const camPos = new THREE.Vector3(), wp = new THREE.Vector3(), axisW = new THREE.Vector3();

    return {
      update(dt, t) {
        if (snap) { snap = false; snapView(S.state === 'idle' ? VIEW : { ...VIEW, dist: 9.2 }); }
        if (S.spin && S.state === 'idle') dna.rotation.y += dt * 0.3;
        else if (S.state !== 'idle') dna.rotation.y = damp(dna.rotation.y, Math.round(dna.rotation.y / (Math.PI * 2)) * Math.PI * 2, 2, dt);
        if (S.state === 'run') {
          S.t += dt;
          S.popT += dt;
          S.fork += dt * S.speed;
          if (S.fork >= L - 1 + LAG + P_SPAN + 0.3) {
            S.state = 'done';
            applyLabels();
            status.set('<b>Done:</b> two identical DNA molecules. Each keeps one original strand (teal) and has one new strand (violet). That is semi-conservative replication.');
            ctx.toast('Replication complete: two copies, each half old, half new.', 'good');
          }
          layout();
        }
        // Hide groove labels when they are behind the helix.
        if (S.labels && S.state === 'idle') {
          ctx.camera.getWorldPosition(camPos);
          axisW.set(0, Y0 + (L / 2) * RISE, 0);
          dna.localToWorld(axisW);
          const da = camPos.distanceTo(axisW);
          for (const l of grooveLabels) l.visible = l.getWorldPosition(wp).distanceTo(camPos) < da + 0.05;
          for (const l of endLabels) l.visible = l.getWorldPosition(wp).distanceTo(camPos) < da + 0.25;
        }
      },
    };
  },
};
