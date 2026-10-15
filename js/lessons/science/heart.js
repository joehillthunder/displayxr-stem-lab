// The Heart & Blood Flow (Anatomy). A stylised four-chamber heart in the textbook frontal view
// (patient's right on the viewer's left), built as one signed-distance field and meshed with
// marching cubes, twice: a back half and a front half split on the coronal plane z = 0, so the
// front can be closed, see-through or removed to show the chambers, septum and valves.
//
// A cardiac-cycle model (timings scale with heart rate, QT roughly by Bazett's √RR) drives
// everything: ventricular and atrial volumes (a vertex-shader squeeze), the four valves (leaflets
// that hinge open and shut), the ECG (P, QRS, T drawn as a sweeping trace), the heart sounds
// (S1 "lub" when the AV valves shut, S2 "dub" when the semilunar valves shut) and the blood
// cells, which walk a graph of path segments and queue behind any valve that is closed.
//
// Heart-local units: everything lives in one group scaled by S and lifted to HY.

import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const S = 1.05, HY = 1.9;
const VIEW = { dist: 6.3, yaw: 0.2, pitch: 0.1, target: [0, 1.9, 0] };
const BLUE = new THREE.Color('#3d63ff'), RED = new THREE.Color('#ff2b3a');
const ESV = 50; // mL left in each ventricle after it contracts (resting adult, about)
const ECG_WIN = 3; // seconds across the monitor
const ECG_M = 360;

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeOut = (x) => 1 - (1 - x) * (1 - x);

function snapView(v) {
  const sv = window.stem?.view;
  if (!sv) return;
  Object.assign(sv, { yaw: v.yaw, pitch: v.pitch, dist: v.dist, goal: null });
  sv.target.set(...v.target);
}
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── signed distance field of the heart (heart-local units) ─────────────────────────────────
function smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }
function ell(x, y, z, e) {
  const X = (x - e[0]) / e[3], Y = (y - e[1]) / e[4], Z = (z - e[2]) / e[5];
  const k0 = Math.sqrt(X * X + Y * Y + Z * Z);
  const k1 = Math.sqrt((X / e[3]) ** 2 + (Y / e[4]) ** 2 + (Z / e[5]) ** 2) + 1e-9;
  return (k0 * (k0 - 1)) / k1;
}
function cap(x, y, z, c) {
  const bx = c[3] - c[0], by = c[4] - c[1], bz = c[5] - c[2];
  const px = x - c[0], py = y - c[1], pz = z - c[2];
  const h = clamp((px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz), 0, 1);
  const dx = px - bx * h, dy = py - by * h, dz = pz - bz * h;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - c[6];
}
function rcone(x, y, z, c) { // round cone (Inigo Quilez): a, b, r1, r2
  const bax = c[3] - c[0], bay = c[4] - c[1], baz = c[5] - c[2];
  const l2 = bax * bax + bay * bay + baz * baz, rr = c[6] - c[7], a2 = l2 - rr * rr, il2 = 1 / l2;
  const pax = x - c[0], pay = y - c[1], paz = z - c[2];
  const yv = pax * bax + pay * bay + paz * baz, zv = yv - l2;
  const qx = pax * l2 - bax * yv, qy = pay * l2 - bay * yv, qz = paz * l2 - baz * yv;
  const x2 = qx * qx + qy * qy + qz * qz, y2 = yv * yv * l2, z2 = zv * zv * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(zv) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - c[7];
  if (Math.sign(yv) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - c[6];
  return (Math.sqrt(x2 * a2 * il2) + yv * rr) * il2 - c[6];
}
const G = {
  vent: [0.0, -0.16, 0, 0.36, -0.84, 0, 0.56, 0.1], // ventricular mass (z squashed 1.3×)
  raO: [-0.5, 0.25, 0, 0.28, 0.27, 0.27],
  laO: [0.48, 0.3, -0.06, 0.27, 0.22, 0.27],
  conR: [-0.19, 0.0, 0.05, -0.13, 0.5, 0.07, 0.14],
  conL: [0.17, -0.05, 0, 0.12, 0.48, -0.04, 0.14],
  raAur: [-0.3, 0.44, 0.17, 0.12, 0.075, 0.085],
  laAur: [0.3, 0.47, 0.12, 0.1, 0.06, 0.08],
  raL: [-0.5, 0.25, 0, 0.2, 0.2, 0.2],
  rvL: [-0.31, -0.3, 0.02, 0.19, 0.24, 0.24],
  rvot: [-0.22, -0.2, 0.03, -0.13, 0.45, 0.07, 0.085],
  tri: [-0.48, 0.15, 0, -0.32, -0.2, 0.01, 0.1],
  svcH: [-0.52, 0.3, 0, -0.53, 0.9, -0.02, 0.08],
  ivcH: [-0.52, 0.15, -0.04, -0.62, -0.35, -0.24, 0.085],
  ptH: [-0.13, 0.45, 0.07, -0.1, 0.85, 0.13, 0.085],
  laL: [0.48, 0.3, -0.06, 0.19, 0.15, 0.19],
  lvL: [0.22, -0.22, 0, 0.33, -0.62, 0, 0.17, 0.07],
  lvot: [0.2, -0.2, 0, 0.12, 0.45, -0.04, 0.08],
  mit: [0.46, 0.22, -0.05, 0.3, -0.1, 0, 0.09],
  aoH: [0.12, 0.45, -0.04, 0.07, 0.85, -0.06, 0.085],
  pv: [[0.5, 0.33, -0.07, 0.92, 0.42, -0.15, 0.055], [0.5, 0.27, -0.08, 0.92, 0.2, -0.17, 0.055],
    [0.44, 0.33, -0.12, 0.33, 0.38, -0.55, 0.055], [0.44, 0.27, -0.12, 0.33, 0.24, -0.55, 0.055]],
};
// Roots of the great vessels: short walled stubs the translucent vessel tubes plug into.
const STUBS = [
  { c: [-0.525, 0.35, -0.01, -0.53, 0.66, -0.02, 0.1], side: 1 }, // superior vena cava
  { c: [-0.55, 0.0, -0.1, -0.62, -0.33, -0.24, 0.105], side: 1 }, // inferior vena cava
  { c: [-0.13, 0.42, 0.07, -0.11, 0.66, 0.12, 0.105], side: 1 }, // pulmonary trunk
  { c: [0.12, 0.42, -0.04, 0.08, 0.66, -0.06, 0.112], side: 0 }, // aorta
  { c: [0.6, 0.36, -0.1, 0.8, 0.41, -0.14, 0.066], side: 0 }, // pulmonary veins ×4
  { c: [0.6, 0.24, -0.11, 0.8, 0.21, -0.16, 0.066], side: 0 },
  { c: [0.4, 0.35, -0.25, 0.36, 0.37, -0.45, 0.066], side: 0 },
  { c: [0.4, 0.26, -0.25, 0.36, 0.25, -0.45, 0.066], side: 0 },
];
function sdBody(x, y, z) {
  let o = rcone(x, y, z * 1.3, G.vent);
  o = smin(o, ell(x, y, z, G.raO), 0.14);
  o = smin(o, ell(x, y, z, G.laO), 0.14);
  o = smin(o, cap(x, y, z, G.conR), 0.1);
  o = smin(o, cap(x, y, z, G.conL), 0.1);
  o = smin(o, ell(x, y, z, G.raAur), 0.06);
  o = smin(o, ell(x, y, z, G.laAur), 0.06);
  return o;
}
let stubSide = 0;
function sdStubs(x, y, z) {
  let d = 1e9;
  for (const s of STUBS) { const e = cap(x, y, z, s.c); if (e < d) { d = e; stubSide = s.side; } }
  return d;
}
function sdOuter(x, y, z) { return smin(sdBody(x, y, z), sdStubs(x, y, z), 0.05); }
function sdRight(x, y, z) {
  let r = smin(ell(x, y, z, G.raL), cap(x, y, z, G.tri), 0.06);
  r = smin(r, ell(x, y, z, G.rvL), 0.07);
  r = smin(r, cap(x, y, z, G.rvot), 0.06);
  r = smin(r, cap(x, y, z, G.svcH), 0.04);
  r = smin(r, cap(x, y, z, G.ivcH), 0.04);
  return smin(r, cap(x, y, z, G.ptH), 0.03);
}
function sdLeft(x, y, z) {
  let l = smin(ell(x, y, z, G.laL), cap(x, y, z, G.mit), 0.06);
  l = smin(l, rcone(x, y, z, G.lvL), 0.07);
  l = smin(l, cap(x, y, z, G.lvot), 0.05);
  l = smin(l, cap(x, y, z, G.aoH), 0.03);
  for (const p of G.pv) l = smin(l, cap(x, y, z, p), 0.035);
  return l;
}
function sdHeart(x, y, z) {
  const o = sdOuter(x, y, z), c = Math.min(sdRight(x, y, z), sdLeft(x, y, z));
  return -smin(-o, c, 0.03); // smooth max(o, -c)
}

// The beat: the same squeeze runs in the vertex shader (heart walls) and in JS (blood, valves).
const DEFORM_GLSL = /* glsl */`
uniform float uV; uniform float uA;
attribute vec2 aDef;
vec3 heartDeform(vec3 p, float t, float side) {
  float wV = 1.0 - smoothstep(-0.08, 0.08, p.y - (0.02 + 0.1 * p.x));
  wV = max(wV, (1.0 - smoothstep(0.18, 0.3, abs(p.x))) * (1.0 - smoothstep(0.5, 0.7, p.y)));
  vec3 cV = mix(vec3(0.08, -0.38, 0.0), mix(vec3(0.24, -0.3, 0.0), vec3(-0.28, -0.3, 0.02), side), t);
  vec3 cA = mix(vec3(0.48, 0.3, -0.05), vec3(-0.5, 0.25, 0.0), side);
  float kV = mix(0.09, 0.3, t) * uV;
  float kA = mix(0.06, 0.18, t) * uA;
  float fade = 1.0 - smoothstep(0.62, 0.9, length(vec3(p.x * 0.95, (p.y + 0.12) * 0.9, p.z * 1.3)));
  return p + fade * (wV * kV * (cV - p) + (1.0 - wV) * kA * (cA - p));
}
`;
function deformJS(o, x, y, z, t, side, uV, uA) {
  let wV = 1 - sstep(-0.08, 0.08, y - (0.02 + 0.1 * x));
  wV = Math.max(wV, (1 - sstep(0.18, 0.3, Math.abs(x))) * (1 - sstep(0.5, 0.7, y)));
  const cvx = 0.08 + ((0.24 + (-0.28 - 0.24) * side) - 0.08) * t;
  const cvy = -0.38 + (-0.3 + 0.38) * t;
  const cvz = 0.02 * side * t;
  const cax = 0.48 + (-0.5 - 0.48) * side, cay = 0.3 + (0.25 - 0.3) * side, caz = -0.05 + 0.05 * side;
  const kV = (0.09 + 0.21 * t) * uV, kA = (0.06 + 0.12 * t) * uA;
  const fade = 1 - sstep(0.62, 0.9, Math.sqrt((x * 0.95) ** 2 + ((y + 0.12) * 0.9) ** 2 + (z * 1.3) ** 2));
  const a = fade * wV * kV, b = fade * (1 - wV) * kA;
  o.set(x + a * (cvx - x) + b * (cax - x), y + a * (cvy - y) + b * (cay - y), z + a * (cvz - z) + b * (caz - z));
  return o;
}

/** Mesh one half of the heart (sign +1 = front, −1 = back) with marching cubes. */
function heartHalf(mc, field, sign, B) {
  const N = mc.size, h = mc.halfsize;
  for (let i = 0; i < N * N * N; i++) {
    const z = B.cz + ((Math.floor(i / (N * N)) - h) / h) * B.ez;
    mc.field[i] = Math.min(field[i], sign * z);
  }
  mc.normal_cache.fill(0);
  mc.update();
  const n = mc.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  for (let v = 0; v < n; v++) {
    pos[v * 3] = B.cx + mc.positionArray[v * 3] * B.ex;
    pos[v * 3 + 1] = B.cy + mc.positionArray[v * 3 + 1] * B.ey;
    pos[v * 3 + 2] = B.cz + mc.positionArray[v * 3 + 2] * B.ez;
    let nx = mc.normalArray[v * 3] / B.ex, ny = mc.normalArray[v * 3 + 1] / B.ey, nz = mc.normalArray[v * 3 + 2] / B.ez;
    const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nor[v * 3] = nx / l; nor[v * 3 + 1] = ny / l; nor[v * 3 + 2] = nz / l;
  }
  // Wind every triangle so its front face points along the field normal (outward).
  for (let t = 0; t < n; t += 3) {
    const a = t * 3, b = a + 3, c = a + 6;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    if (cx * (nor[a] + nor[b] + nor[c]) + cy * (nor[a + 1] + nor[b + 1] + nor[c + 1]) + cz * (nor[a + 2] + nor[b + 2] + nor[c + 2]) < 0) {
      for (let k = 0; k < 3; k++) {
        let s = pos[b + k]; pos[b + k] = pos[c + k]; pos[c + k] = s;
        s = nor[b + k]; nor[b + k] = nor[c + k]; nor[c + k] = s;
      }
    }
  }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g = mergeVertices(g, 1e-5);
  // Per-vertex: how far through the wall (0 outer surface → 1 cavity lining), which side, colour.
  const P = g.attributes.position, Nn = g.attributes.normal, cnt = P.count;
  const def = new Float32Array(cnt * 2), col = new Float32Array(cnt * 3);
  const cMus = new THREE.Color('#741321'), cCut = new THREE.Color('#82222e'), cFat = new THREE.Color('#b98a4a');
  const cR = new THREE.Color('#2f3b8c'), cL = new THREE.Color('#9a1a28'), c = new THREE.Color(), c2 = new THREE.Color();
  const cVein = new THREE.Color('#3a4796'), cArt = new THREE.Color('#b02a3a');
  for (let v = 0; v < cnt; v++) {
    const x = P.getX(v), y = P.getY(v), z = P.getZ(v);
    const dO = Math.abs(sdOuter(x, y, z)), dR = Math.abs(sdRight(x, y, z)), dL = Math.abs(sdLeft(x, y, z));
    const dC = Math.min(dR, dL);
    const t = dO / (dO + dC + 1e-6), side = dL / (dR + dL + 1e-6);
    def[v * 2] = t; def[v * 2 + 1] = side;
    const cut = Math.abs(z) < 0.003 && Math.abs(Nn.getZ(v)) > 0.9;
    const grain = 0.93 + 0.07 * Math.sin(x * 61 + Math.sin(y * 47) * 2 + z * 23);
    if (cut) {
      c.copy(cCut).lerp(c2.copy(cR).lerp(cL, 1 - side), sstep(0.75, 0.98, t) * 0.5);
    } else if (t > 0.5) {
      c.copy(cR).lerp(cL, 1 - side);
    } else {
      c.copy(cMus);
      // Yellow fat in the AV groove and the interventricular grooves (where coronary vessels run).
      const av = 1 - sstep(0.012, 0.05, Math.abs(y - (0.03 + 0.1 * x)));
      const iv = (1 - sstep(0.01, 0.045, Math.abs(x - (-0.06 - 0.3 * y)))) * sstep(0.12, 0.25, Math.abs(z)) * (y < 0.05 ? 1 : 0);
      c.lerp(cFat, Math.max(av * (Math.abs(x) > 0.24 ? 0.35 : 0), iv * 0.35) * (1 - sstep(0.15, 0.4, t)));
      const ds = sdStubs(x, y, z), db = sdBody(x, y, z);
      c.lerp(stubSide ? cVein : cArt, sstep(-0.005, 0.03, db - ds));
    }
    c.multiplyScalar(grain);
    col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
  }
  g.setAttribute('aDef', new THREE.BufferAttribute(def, 2));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeBoundingSphere();
  return g;
}

// ── valves ────────────────────────────────────────────────────────────────────────────────
const NPHI = 10, NRHO = 6;
class Valve {
  constructor(id, center, axis, R, n, kind, mat, ringMat) {
    Object.assign(this, { id, R, n, kind, o: 0, drawn: -1 });
    this.base = new THREE.Vector3(...center);
    this.axis = new THREE.Vector3(...axis).normalize();
    const tmp = Math.abs(this.axis.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    this.u = new THREE.Vector3().crossVectors(this.axis, tmp).normalize();
    this.w = new THREE.Vector3().crossVectors(this.axis, this.u).normalize();
    this.group = new THREE.Group();
    this.group.position.copy(this.base);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.014, 10, 48), ringMat);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.axis);
    this.group.add(ring);
    this.leaflets = [];
    const idx = [];
    for (let i = 0; i < NPHI; i++) for (let j = 0; j < NRHO; j++) {
      const a = i * (NRHO + 1) + j, b = a + NRHO + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    for (let k = 0; k < n; k++) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((NPHI + 1) * (NRHO + 1) * 3), 3).setUsage(THREE.DynamicDrawUsage));
      g.setIndex(idx);
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R * 2.5);
      const m = new THREE.Mesh(g, mat);
      m.castShadow = true;
      this.group.add(m);
      this.leaflets.push(m);
    }
    this.edge = Array.from({ length: n * 3 }, () => new THREE.Vector3()); // free-edge points (for chordae)
    this.shape(0);
  }
  shape(o) {
    const { R, n, axis, u, w } = this;
    const th = o * Math.PI * 0.46, ct = Math.cos(th), st = Math.sin(th);
    const gap = 0.05;
    for (let k = 0; k < n; k++) {
      const arr = this.leaflets[k].geometry.attributes.position.array;
      const p0 = (k / n) * Math.PI * 2 + gap, p1 = ((k + 1) / n) * Math.PI * 2 - gap;
      let q = 0;
      for (let i = 0; i <= NPHI; i++) {
        const phi = p0 + ((p1 - p0) * i) / NPHI, cp = Math.cos(phi), sp = Math.sin(phi);
        const rx = u.x * cp + w.x * sp, ry = u.y * cp + w.y * sp, rz = u.z * cp + w.z * sp;
        // Sector edges taper so neighbouring leaflets meet along lines when shut.
        const mid = Math.sin(((phi - p0) / (p1 - p0)) * Math.PI);
        for (let j = 0; j <= NRHO; j++) {
          const rho = j / NRHO;
          const inward = rho * R * (ct + 0.14 * st) * (1 - 0.04 * (1 - mid));
          const along = rho * R * (this.kind === 'av' ? 1.05 : 0.8) * st;
          const billow = -(1 - o) * R * 0.22 * Math.sin(Math.PI * rho) * (0.4 + 0.6 * mid);
          arr[q++] = rx * (R - inward) + axis.x * (along + billow);
          arr[q++] = ry * (R - inward) + axis.y * (along + billow);
          arr[q++] = rz * (R - inward) + axis.z * (along + billow);
        }
        if (i === 2 || i === 5 || i === 8) {
          const e = this.edge[k * 3 + (i === 2 ? 0 : i === 5 ? 1 : 2)];
          e.set(arr[q - 3], arr[q - 2], arr[q - 1]);
        }
      }
      const g = this.leaflets[k].geometry;
      g.attributes.position.needsUpdate = true;
      g.computeVertexNormals();
    }
    this.drawn = o;
  }
}

// ── lesson ───────────────────────────────────────────────────────────────────────────────
const CARDS = {
  ra: ['Right atrium', 'Chamber', `<p>Receives <b>deoxygenated</b> blood from the body through the <b>superior and inferior venae cavae</b> (and from the heart's own veins through the coronary sinus).</p><p>It passes the blood through the <b>tricuspid valve</b> into the right ventricle. Its wall holds the <b>sinoatrial (SA) node</b>, the heart's natural pacemaker, which starts every beat (the P wave on the ECG).</p>`],
  rv: ['Right ventricle', 'Chamber', `<p>Pumps <b>deoxygenated</b> blood through the <b>pulmonary valve</b> into the pulmonary trunk and on to the lungs.</p><p>The lungs are close by and need only low pressure (about 25 mmHg at peak, versus about 120 mmHg in the left ventricle), so its wall is thin, about 3–5 mm.</p>`],
  la: ['Left atrium', 'Chamber', `<p>Receives <b>oxygenated</b> blood from the lungs through the <b>four pulmonary veins</b> (two from each lung).</p><p>It passes the blood through the <b>mitral (bicuspid) valve</b> into the left ventricle. In a real chest it is the most posterior chamber, lying against the oesophagus.</p>`],
  lv: ['Left ventricle', 'Chamber', `<p>Pumps <b>oxygenated</b> blood through the <b>aortic valve</b> into the aorta and round the whole body.</p><p>It has to push against about 120 mmHg, so it has the <b>thickest wall</b> of the heart: about 8–12 mm, roughly three times the right ventricle. Both ventricles still pump the <b>same volume</b> each beat (the stroke volume, about 70 mL at rest).</p>`],
  septum: ['Septum', 'Wall', `<p>The muscular wall between the left and right sides of the heart. It keeps oxygenated and deoxygenated blood apart, so the two circuits run in series: body → right heart → lungs → left heart → body.</p><p>The <b>interventricular septum</b> is thick muscle that squeezes with the left ventricle, and it carries the conduction fibres (bundle of His) that spread the beat from the top of the heart down to the apex.</p>`],
  tri: ['Tricuspid valve', 'Atrioventricular valve', `<p>Between the right atrium and right ventricle. It has <b>three leaflets</b> tied by <b>chordae tendineae</b> ("heart strings") to <b>papillary muscles</b>, which stop the leaflets flipping back into the atrium.</p><p>It is open while the ventricle fills and slams shut when the ventricle starts to contract: part of the first heart sound, <b>S1 "lub"</b>.</p>`],
  mit: ['Mitral (bicuspid) valve', 'Atrioventricular valve', `<p>Between the left atrium and left ventricle. It has <b>two leaflets</b> held by chordae tendineae and papillary muscles.</p><p>It closes with the tricuspid valve at the start of ventricular systole, making the first heart sound, <b>S1 "lub"</b>.</p>`],
  pul: ['Pulmonary valve', 'Semilunar valve', `<p>Between the right ventricle and the pulmonary trunk. Three pocket-shaped <b>semilunar cusps</b>, with no chordae.</p><p>It opens when right-ventricle pressure rises above pulmonary-artery pressure, and snaps shut when the ventricle relaxes and blood starts to fall back: part of the second heart sound, <b>S2 "dub"</b>.</p>`],
  aor: ['Aortic valve', 'Semilunar valve', `<p>Between the left ventricle and the aorta. Three semilunar cusps; the two <b>coronary arteries</b>, which feed the heart muscle itself, branch off just above them.</p><p>It opens during ejection and shuts at the end of systole with the pulmonary valve: the second heart sound, <b>S2 "dub"</b>.</p>`],
  svc: ['Superior vena cava', 'Vein · deoxygenated', `<p>Brings deoxygenated blood from the <b>head, neck and arms</b> back into the right atrium.</p><p>Veins carry blood <b>toward</b> the heart. Their pressure is low, so they are thinner-walled than arteries.</p>`],
  ivc: ['Inferior vena cava', 'Vein · deoxygenated', `<p>The largest vein in the body. It brings deoxygenated blood from everything <b>below the diaphragm</b> (legs, gut, kidneys, liver) back into the right atrium.</p>`],
  pa: ['Pulmonary trunk and arteries', 'Artery · deoxygenated', `<p>The pulmonary trunk leaves the right ventricle and splits under the aortic arch into the <b>left and right pulmonary arteries</b>, one to each lung.</p><p>An artery is any vessel that carries blood <b>away from</b> the heart, whatever its oxygen. These are the only arteries after birth that carry <b>deoxygenated</b> blood.</p>`],
  pv: ['Pulmonary veins', 'Vein · oxygenated', `<p>Four pulmonary veins (two from each lung) bring freshly <b>oxygenated</b> blood from the lungs into the left atrium.</p><p>They are the only veins after birth that carry oxygenated blood. (The right-lung veins pass behind the right atrium to reach it.)</p>`],
  aorta: ['Aorta', 'Artery · oxygenated', `<p>The largest artery. It rises from the left ventricle (<b>ascending aorta</b>), curves over the pulmonary arteries (<b>aortic arch</b>, whose three branches supply the head and arms) and runs down behind the heart (<b>descending aorta</b>) to the rest of the body.</p><p>Its elastic wall stretches as blood is pumped in and recoils between beats, so blood keeps flowing in diastole. That stretch is the pulse you can feel.</p>`],
  lung: ['Lungs', 'Gas exchange', `<p>The pulmonary arteries branch down to capillaries wrapped around about 300–500 million air sacs (<b>alveoli</b>). Oxygen diffuses from the air into the blood and binds to haemoglobin; carbon dioxide diffuses out to be breathed away.</p><p>Blood arrives about 75% saturated with oxygen and leaves about 97–98% saturated. Here the cells turn from blue (deoxygenated) to red (oxygenated) in the colour code.</p>`],
  body: ['Body capillaries', 'Gas exchange', `<p>Arteries branch into arterioles and then <b>capillaries</b>, so narrow (about 5–10 µm) that red blood cells pass in single file. Oxygen diffuses out to the cells, which use it in respiration; carbon dioxide diffuses in.</p><p>At rest the tissues take only about a quarter of the oxygen, so blood returns to the heart still about 75% saturated. This model shows two beds (upper body and lower body) standing in for billions of capillaries.</p>`],
  ecg: ['ECG (electrocardiogram)', 'Electrical activity', `<p>Electrodes on the skin pick up the tiny voltages made as heart muscle depolarises and repolarises. Electrical events come <b>just before</b> the movement they cause.</p><ul><li><b>P wave</b>: the atria depolarise → the atria contract.</li><li><b>QRS complex</b>: the ventricles depolarise → the ventricles contract (it also hides the atria repolarising).</li><li><b>T wave</b>: the ventricles repolarise → they relax.</li></ul><p>Normal PR interval 0.12–0.20 s; normal QRS under 0.12 s.</p>`],
  rbc: ['Red blood cell', 'Cell', `<p>A <b>biconcave disc</b> about 7.5 µm across with no nucleus, packed with about 270 million haemoglobin molecules; each haemoglobin can carry four O₂ molecules.</p><p>The cells here are drawn hugely enlarged and far fewer than real: a microlitre of blood holds about 5 million of them.</p>`],
};

export default {
  view: { ...VIEW, minDist: 3.5, maxDist: 18 },
  floor: true,
  explain: `
    <p>Your heart is two pumps side by side, beating together about 100 000 times a day. Blood travels a <b>double circulation</b>:</p>
    <ul>
      <li><b>Pulmonary circuit</b> (right side): body → <b>venae cavae</b> → <b>right atrium</b> → tricuspid valve → <b>right ventricle</b> → pulmonary valve → <b>pulmonary arteries</b> → lungs, where blood picks up O₂ and drops CO₂.</li>
      <li><b>Systemic circuit</b> (left side): lungs → <b>pulmonary veins</b> → <b>left atrium</b> → mitral valve → <b>left ventricle</b> → aortic valve → <b>aorta</b> → body capillaries, where cells take the O₂.</li>
    </ul>
    <p><b>Colour code.</b> Blue means deoxygenated and red means oxygenated, as in textbooks. Real deoxygenated blood is <b>dark red</b>, never blue; veins only look blue through skin because of how skin scatters and absorbs light.</p>
    <p><b>The cardiac cycle</b> (one beat, 0.8 s at 75 bpm):</p>
    <ol>
      <li><b>Atrial systole</b>: after the P wave the atria contract and top up the ventricles (the last 20–30% of filling).</li>
      <li><b>Ventricular systole</b>: after the QRS complex the ventricles contract. Their pressure shuts the AV valves (tricuspid and mitral): <b>S1 "lub"</b>. For a moment all four valves are shut (isovolumetric contraction); then the pressure forces the semilunar valves open and blood is <b>ejected</b> into the aorta and pulmonary trunk.</li>
      <li><b>Diastole</b>: the ventricles relax (after the T wave), and blood in the arteries pushes back and snaps the semilunar valves shut: <b>S2 "dub"</b>. When ventricular pressure falls below atrial pressure the AV valves open and the ventricles refill, mostly passively.</li>
    </ol>
    <p>Valves open and close only because of <b>pressure differences</b>; they are one-way doors that stop backflow. The chordae tendineae stop the AV valves flipping inside out.</p>
    <p><b>Cardiac output</b> is the volume each ventricle pumps per minute: heart rate × stroke volume. At rest that is about 5 L/min, roughly all your blood every minute. In hard exercise it can reach 20–25 L/min.</p>
    <p class="muted">Simplified: the chambers are laid out flat in one plane, as in textbook diagrams; in a real chest the heart is turned so the right ventricle faces forward, the left atrium sits at the back and the apex points down to the patient's left. Two capillary beds stand in for the whole body. Cells are enlarged and few, and their speed is scaled for viewing. Timings use typical resting values; the QT interval shortens with √(beat length) as in Bazett's formula. Stroke volume and heart rate are set separately here; in a real body a very fast rate leaves less time to fill, so stroke volume drops.</p>`,
  formula: 'Cardiac output: CO = HR × SV &nbsp;·&nbsp; 70 beats/min × 70 mL/beat = 4 900 mL/min ≈ 4.9 L/min &nbsp;·&nbsp; ejection fraction EF = SV ÷ EDV',
  vocab: [
    ['Atrium (pl. atria)', 'An upper, thin-walled chamber that receives blood returning to the heart.'],
    ['Ventricle', 'A lower, muscular chamber that pumps blood out of the heart.'],
    ['Septum', 'The wall that separates the left and right sides of the heart.'],
    ['AV valves', 'Tricuspid (right) and mitral or bicuspid (left): between each atrium and ventricle.'],
    ['Semilunar valves', 'Pulmonary and aortic: between each ventricle and its artery.'],
    ['Systole / diastole', 'The contraction phase and the relaxation (filling) phase of a chamber.'],
    ['Artery / vein', 'Arteries carry blood away from the heart; veins carry it back. The oxygen level does not decide the name.'],
    ['Stroke volume (SV)', 'Blood pumped by one ventricle in one beat; about 70 mL at rest.'],
    ['Cardiac output (CO)', 'Blood pumped by one ventricle per minute: CO = HR × SV, about 5 L/min at rest.'],
    ['Ejection fraction', 'The share of the filled ventricle (EDV) pumped out each beat; normally about 55–70%.'],
    ['ECG', 'A recording of the heart\'s electrical activity: P wave, QRS complex, T wave.'],
    ['Chordae tendineae', 'Cords that tie the AV valve leaflets to papillary muscles so they can\'t turn inside out.'],
  ],
  standards: ['NGSS HS-LS1-2'],
  quiz: [
    { q: 'Which vessel carries deoxygenated blood away from the heart?', choices: ['Pulmonary artery', 'Pulmonary vein', 'Aorta', 'Superior vena cava'], answer: 0,
      why: 'Arteries carry blood away from the heart. The pulmonary artery takes deoxygenated blood from the right ventricle to the lungs. The vena cava brings deoxygenated blood toward the heart.' },
    { q: 'Why is the wall of the left ventricle thicker than the right?', choices: ['It pumps blood round the whole body, against a much higher pressure', 'It holds a larger volume of blood each beat', 'It pumps deoxygenated blood', 'It receives blood straight from the lungs'], answer: 0,
      why: 'The left ventricle drives the systemic circuit at about 120 mmHg; the right only has to reach the nearby lungs at about 25 mmHg. Both eject the same stroke volume.' },
    { q: 'A heart beats 80 times a minute with a stroke volume of 75 mL. What is the cardiac output?', choices: ['6.0 L/min', '155 L/min', '0.94 L/min', '60 L/min'], answer: 0,
      why: 'CO = HR × SV = 80 × 75 mL = 6 000 mL/min = 6.0 L/min.' },
    { q: 'What causes the first heart sound, "lub"?', choices: ['The tricuspid and mitral valves closing as the ventricles start to contract', 'The aortic and pulmonary valves closing as the ventricles relax', 'The atria contracting', 'Blood rushing into the lungs'], answer: 0,
      why: 'S1 is the AV valves shutting at the start of ventricular systole. S2, "dub", is the semilunar valves shutting at the end of it.' },
    { q: 'On an ECG, what does the QRS complex show?', choices: ['The ventricles depolarising, just before they contract', 'The atria depolarising', 'The ventricles repolarising as they relax', 'The valves closing'], answer: 0,
      why: 'Electrical events come just before movement: P = atria depolarise, QRS = ventricles depolarise, T = ventricles repolarise. The ECG records electricity, not valve sounds.' },
  ],

  build(ctx) {
    // Test-only URL options (for headless screenshots, which run only a few frames):
    //   ?hr=40–180  ?sv=40–120   heart rate (bpm) and stroke volume (mL)
    //   ?phase=0–4 (atrial | ivc | eject | ivr | fill) or ?tau=0–1 (fraction of the cycle): pose and pause
    //   ?wall=closed|glass|cut   ?flow=0   ?labels=0   ?slow   ?follow   ?cam=heart (close-up)
    //   ?pick=ra|rv|la|lv|septum|tri|mit|pul|aor|svc|ivc|pa|pv|aorta|lung|body|ecg|rbc   ?warm=<s> (pre-run time)
    const { root, ui } = ctx;
    const q = new URLSearchParams(location.search);
    const num = (k, d, a, b) => (q.has(k) && isFinite(parseFloat(q.get(k))) ? clamp(parseFloat(q.get(k)), a, b) : d);

    const st = {
      hr: Math.round(num('hr', 70, 40, 180)), sv: Math.round(num('sv', 70, 40, 120)),
      tau: 0, beat: 0, paused: false, slow: q.has('slow'),
      wall: ['closed', 'glass', 'cut'].includes(q.get('wall')) ? q.get('wall') : 'cut',
      flow: q.get('flow') !== '0', labels: q.get('labels') !== '0', sound: false,
      follow: -1, lubT: 0, dubT: 0, lastSound: '',
    };

    const heart = new THREE.Group();
    heart.position.y = HY;
    heart.scale.setScalar(S);
    root.add(heart);

    // ── heart walls ──────────────────────────────────────────────────────────────────────
    const B = { cx: 0, cy: -0.07, cz: 0.0037, ex: 0.98, ey: 0.95, ez: 0.62 };
    const RES = 84;
    const mc = new MarchingCubes(RES, new THREE.MeshBasicMaterial(), false, false, 90000);
    mc.isolation = 0;
    const field = new Float32Array(RES * RES * RES);
    {
      const h = mc.halfsize;
      for (let k = 0, i = 0; k < RES; k++) {
        const z = B.cz + ((k - h) / h) * B.ez;
        for (let j = 0; j < RES; j++) {
          const y = B.cy + ((j - h) / h) * B.ey;
          for (let ii = 0; ii < RES; ii++, i++) field[i] = -sdHeart(B.cx + ((ii - h) / h) * B.ex, y, z);
        }
      }
    }
    const backGeo = heartHalf(mc, field, -1, B);
    const frontGeo = heartHalf(mc, field, 1, B);
    mc.geometry.dispose();
    mc.material.dispose();

    const U = { uV: { value: 0 }, uA: { value: 0 } };
    const withBeat = (m) => {
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uV = U.uV; sh.uniforms.uA = U.uA;
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\n' + DEFORM_GLSL)
          .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = heartDeform(transformed, aDef.x, aDef.y);');
      };
      m.customProgramCacheKey = () => 'heart-beat';
      return m;
    };
    const wallOpts = { vertexColors: true, roughness: 0.36, metalness: 0, clearcoat: 0.85, clearcoatRoughness: 0.18, sheen: 0.25, sheenRoughness: 0.5, sheenColor: new THREE.Color('#ff7a7a') };
    const backMat = withBeat(new THREE.MeshPhysicalMaterial(wallOpts));
    const frontMat = withBeat(new THREE.MeshPhysicalMaterial(wallOpts));
    const glassMat = withBeat(new THREE.MeshPhysicalMaterial({ ...wallOpts, transparent: true, opacity: 0.2, depthWrite: false }));
    const backMesh = new THREE.Mesh(backGeo, backMat);
    const frontMesh = new THREE.Mesh(frontGeo, frontMat);
    for (const m of [backMesh, frontMesh]) { m.castShadow = true; m.receiveShadow = true; heart.add(m); }

    // ── valves, papillary muscles, chordae ─────────────────────────────────────────────────
    const leafMat = new THREE.MeshPhysicalMaterial({ color: '#f1dcc4', roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.3, sheen: 0.8, sheenColor: new THREE.Color('#fff2e0'), side: THREE.DoubleSide });
    const ringMat = new THREE.MeshPhysicalMaterial({ color: '#e9cfae', roughness: 0.5, clearcoat: 0.4 });
    const valves = {
      tri: new Valve('tri', [-0.4, -0.02, 0.005], [0.34, -0.94, 0.04], 0.1, 3, 'av', leafMat, ringMat),
      mit: new Valve('mit', [0.36, 0.04, -0.02], [-0.35, -0.93, 0.1], 0.09, 2, 'av', leafMat, ringMat),
      pul: new Valve('pul', [-0.13, 0.45, 0.07], [0.137, 0.99, 0.06], 0.085, 3, 'sl', leafMat, ringMat),
      aor: new Valve('aor', [0.12, 0.42, -0.04], [-0.122, 0.99, -0.06], 0.08, 3, 'sl', leafMat, ringMat),
    };
    for (const v of Object.values(valves)) heart.add(v.group);
    const papMat = new THREE.MeshPhysicalMaterial({ color: '#a8303c', roughness: 0.4, clearcoat: 0.8, sheen: 0.5, sheenColor: new THREE.Color('#ff9a9a') });
    const pap = [
      { v: 'tri', base: [-0.42, -0.48, 0.08], side: 1 }, { v: 'tri', base: [-0.24, -0.5, -0.1], side: 1 },
      { v: 'mit', base: [0.25, -0.47, 0.05], side: 0 }, { v: 'mit', base: [0.34, -0.46, -0.05], side: 0 },
    ].map((p) => {
      const vv = valves[p.v];
      const b = new THREE.Vector3(...p.base);
      const dir = vv.base.clone().sub(b).normalize();
      const geo = new THREE.ConeGeometry(0.032, 0.14, 14, 1);
      geo.translate(0, 0.07, 0);
      const m = new THREE.Mesh(geo, papMat);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      heart.add(m);
      return { ...p, b, dir, mesh: m, tip: new THREE.Vector3() };
    });
    const chordPos = new Float32Array((3 * 3 + 2 * 3) * 2 * 3);
    const chordGeo = new THREE.BufferGeometry();
    chordGeo.setAttribute('position', new THREE.BufferAttribute(chordPos, 3).setUsage(THREE.DynamicDrawUsage));
    const chords = new THREE.LineSegments(chordGeo, new THREE.LineBasicMaterial({ color: '#f6e7d4', transparent: true, opacity: 0.85 }));
    chords.frustumCulled = false;
    heart.add(chords);

    // ── vessels, lungs, capillary beds ───────────────────────────────────────────────────────
    const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
    const curve = (pts) => new THREE.CatmullRomCurve3(pts.map(V3), false, 'centripetal');
    const vesselMat = (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.22, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, transparent: true, opacity: 0.4, depthWrite: false, sheen: 0.4, sheenColor: new THREE.Color('#ffffff') });
    const veinMat = vesselMat('#4058d6'), artMat = vesselMat('#d0303e');
    const pickParts = [];
    function vessel(pts, r, mat, card, segs = 72) {
      const m = new THREE.Mesh(new THREE.TubeGeometry(curve(pts), segs, r, 18, false), mat);
      m.renderOrder = 2;
      heart.add(m);
      pickParts.push([m, card]);
      return m;
    }
    vessel([[-0.42, 1.62, 0], [-0.5, 1.38, 0], [-0.53, 1.0, -0.01], [-0.53, 0.7, -0.02], [-0.525, 0.46, -0.015]], 0.096, veinMat, 'svc');
    vessel([[-0.6, -1.38, -0.2], [-0.64, -1.0, -0.25], [-0.6, -0.45, -0.22], [-0.56, -0.12, -0.13], [-0.55, 0.0, -0.1]], 0.1, veinMat, 'ivc');
    vessel([[-0.135, 0.38, 0.065], [-0.13, 0.45, 0.07], [-0.1, 0.7, 0.14], [0.06, 0.92, 0.13], [0.18, 1.0, 0.0]], 0.1, veinMat, 'pa');
    vessel([[0.18, 1.0, 0.0], [0.45, 0.98, -0.05], [0.85, 0.78, -0.08], [1.14, 0.6, -0.06]], 0.072, veinMat, 'pa');
    vessel([[0.18, 1.0, 0.0], [0.05, 1.0, -0.26], [-0.45, 0.92, -0.3], [-0.85, 0.75, -0.2], [-1.14, 0.6, -0.08]], 0.072, veinMat, 'pa');
    const PV = {
      pvl0: [[1.14, 0.42, -0.12], [0.85, 0.42, -0.15], [0.62, 0.38, -0.12], [0.48, 0.3, -0.06]],
      pvl1: [[1.14, 0.28, -0.12], [0.85, 0.22, -0.18], [0.62, 0.24, -0.14], [0.48, 0.3, -0.06]],
      pvr0: [[-1.14, 0.42, -0.12], [-0.75, 0.45, -0.42], [-0.1, 0.42, -0.5], [0.33, 0.37, -0.36], [0.48, 0.3, -0.06]],
      pvr1: [[-1.14, 0.28, -0.12], [-0.75, 0.25, -0.42], [-0.1, 0.22, -0.5], [0.33, 0.25, -0.36], [0.48, 0.3, -0.06]],
    };
    for (const pts of Object.values(PV)) vessel(pts.slice(0, -1).concat([[pts[pts.length - 2][0] * 0.6 + 0.48 * 0.4, pts[pts.length - 2][1] * 0.6 + 0.3 * 0.4, pts[pts.length - 2][2] * 0.6 - 0.06 * 0.4]]), 0.06, artMat, 'pv', 48);
    const AORTA = [[0.12, 0.38, -0.04], [0.12, 0.42, -0.04], [0.06, 0.75, -0.06], [-0.02, 1.05, -0.05], [0.04, 1.27, -0.15], [0.3, 1.22, -0.35], [0.38, 0.9, -0.52], [0.3, 0.2, -0.6], [0.2, -0.6, -0.6], [0.12, -1.12, -0.45], [0.1, -1.36, -0.3]];
    vessel(AORTA, 0.106, artMat, 'aorta', 140);
    const BR = { brR: [[0.0, 1.26, -0.13], [-0.08, 1.4, -0.1], [-0.12, 1.56, -0.05]], brL: [[0.12, 1.27, -0.18], [0.14, 1.4, -0.12], [0.2, 1.56, -0.05]] };
    for (const pts of Object.values(BR)) vessel(pts, 0.045, artMat, 'aorta', 24);

    // Lungs.
    const lungMat = new THREE.MeshPhysicalMaterial({ color: '#e98d9c', roughness: 0.62, metalness: 0, transparent: true, opacity: 0.36, depthWrite: false, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffd7de'), clearcoat: 0.3 });
    const LUNG = [{ c: [-1.48, 0.42, -0.06], sgn: -1 }, { c: [1.48, 0.42, -0.06], sgn: 1 }];
    for (const L of LUNG) {
      const g = new THREE.SphereGeometry(1, 56, 40);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const u = (y + 1) / 2;
        const w = 1 - 0.5 * u * u;
        if (x * L.sgn < 0) x *= 0.55 + 0.25 * u; // flatter medial face (the heart's side)
        if (L.sgn > 0 && x < 0 && y < 0.1 && y > -0.75) x *= 0.75; // cardiac notch of the left lung
        y = y * 0.7 + (y < -0.4 ? 0.12 * (1 - x * x - z * z) * sstep(-0.4, -1, y) : 0);
        p.setXYZ(i, L.c[0] + x * 0.37 * w, L.c[1] + y, L.c[2] + z * 0.42 * w);
      }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, lungMat);
      m.renderOrder = 3;
      heart.add(m);
      pickParts.push([m, 'lung']);
    }
    // Capillary beds (soft tissue blocks).
    const tissueMat = new THREE.MeshPhysicalMaterial({ color: '#e8b9a6', roughness: 0.55, transparent: true, opacity: 0.22, depthWrite: false, sheen: 1, sheenColor: new THREE.Color('#ffe3d6') });
    for (const [c, r] of [[[-0.2, -1.46, -0.06], [0.82, 0.13, 0.44]], [[-0.1, 1.66, -0.02], [0.56, 0.1, 0.3]]]) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), tissueMat);
      m.position.set(...c); m.scale.set(...r);
      m.renderOrder = 3;
      heart.add(m);
      pickParts.push([m, 'body']);
    }

    // ── blood path graph ─────────────────────────────────────────────────────────────────
    const R = rng(7);
    const segs = [], segId = {};
    function seg(id, pts, o) {
      const c = curve(pts), len = c.getLength();
      const M = Math.max(16, Math.ceil(len / 0.012));
      const sp = c.getSpacedPoints(M);
      const pos = new Float32Array((M + 1) * 3), tan = new Float32Array((M + 1) * 3);
      const tv = new THREE.Vector3();
      for (let i = 0; i <= M; i++) {
        pos[i * 3] = sp[i].x; pos[i * 3 + 1] = sp[i].y; pos[i * 3 + 2] = sp[i].z;
        c.getTangentAt(i / M, tv);
        tan[i * 3] = tv.x; tan[i * 3 + 1] = tv.y; tan[i * 3 + 2] = tv.z;
      }
      const s = { id, len, M, pos, tan, kind: 'vein', side: 1, col: 0, rad: [0.05], queue: 0, gate: null, next: [], w: null, where: '', ...o };
      segId[id] = segs.length;
      segs.push(s);
      return s;
    }
    seg('svc', [[-0.42, 1.62, 0], [-0.5, 1.38, 0], [-0.53, 1.0, -0.01], [-0.53, 0.7, -0.02], [-0.52, 0.42, -0.01], [-0.5, 0.25, 0]], { rad: [0.04, 0.05, 0.05, 0.08], next: ['ra'], where: 'svc' });
    seg('ivc', [[-0.6, -1.38, -0.2], [-0.64, -1.0, -0.25], [-0.6, -0.45, -0.22], [-0.56, -0.12, -0.13], [-0.52, 0.1, -0.04], [-0.5, 0.25, 0]], { rad: [0.04, 0.055, 0.055, 0.08], next: ['ra'], where: 'ivc' });
    seg('ra', [[-0.5, 0.25, 0], [-0.47, 0.13, 0.0], [-0.4, -0.02, 0.005]], { kind: 'atrium', rad: [0.08, 0.11, 0.05], queue: 0.3, gate: 'tri', next: ['rv'], where: 'ra' });
    seg('rv', [[-0.4, -0.02, 0.005], [-0.35, -0.22, 0.02], [-0.32, -0.42, 0.02], [-0.22, -0.4, 0.03], [-0.17, -0.12, 0.04], [-0.14, 0.2, 0.06], [-0.13, 0.45, 0.07]], { kind: 'vent', rad: [0.05, 0.11, 0.12, 0.1, 0.05, 0.04], queue: 0.85, gate: 'pul', next: ['pt'], where: 'rv' });
    seg('pt', [[-0.13, 0.45, 0.07], [-0.1, 0.7, 0.14], [0.06, 0.92, 0.13], [0.18, 1.0, 0.0]], { kind: 'artery', rad: [0.04, 0.055], next: ['lpa', 'rpa'], where: 'pt' });
    seg('lpa', [[0.18, 1.0, 0.0], [0.45, 0.98, -0.05], [0.85, 0.78, -0.08], [1.14, 0.6, -0.06]], { kind: 'artery', rad: [0.045], where: 'lpa' });
    seg('rpa', [[0.18, 1.0, 0.0], [0.05, 1.0, -0.26], [-0.45, 0.92, -0.3], [-0.85, 0.75, -0.2], [-1.14, 0.6, -0.08]], { kind: 'artery', rad: [0.045], where: 'rpa' });
    // Lung capillary loops and their visible vessels (blue → red).
    const capTubes = [];
    for (const L of LUNG) {
      const ids = [];
      for (let k = 0; k < 6; k++) {
        const s = L.sgn, low = k % 2;
        const a = [s * 1.14, 0.6, s > 0 ? -0.06 : -0.08], e = [s * 1.14, low ? 0.28 : 0.42, -0.12];
        const T = [L.c[0] + s * (0.02 + R() * 0.16), L.c[1] + (R() * 2 - 1) * 0.42, L.c[2] + (R() * 2 - 1) * 0.22];
        const m1 = [(a[0] + T[0]) / 2, (a[1] + T[1]) / 2 + 0.06, (a[2] + T[2]) / 2 + 0.05];
        const loop = [[T[0] + s * 0.05, T[1] + 0.04, T[2]], [T[0] + s * 0.07, T[1] - 0.03, T[2] + 0.04], [T[0] + s * 0.02, T[1] - 0.06, T[2] - 0.03]];
        const m2 = [(e[0] + T[0]) / 2, (e[1] + T[1]) / 2 - 0.05, (e[2] + T[2]) / 2 - 0.04];
        const pts = [a, m1, T, ...loop, m2, e];
        const id = `lung${s > 0 ? 'L' : 'R'}${k}`;
        seg(id, pts, { kind: 'cap', col: 'b2r', rad: [0.02, 0.008, 0.008, 0.02], next: [`pv${s > 0 ? 'l' : 'r'}${low}`], where: 'lung' });
        capTubes.push([pts, 'b2r', 'lung']);
        ids.push(id);
      }
      segs[segId[L.sgn > 0 ? 'lpa' : 'rpa']].next = ids;
    }
    for (const [id, pts] of Object.entries(PV)) seg(id, pts, { kind: 'vein', side: 0, col: 1, rad: [0.03, 0.035, 0.035, 0.07], next: ['la'], where: 'pv' });
    seg('la', [[0.48, 0.3, -0.06], [0.44, 0.17, -0.04], [0.36, 0.04, -0.02]], { kind: 'atrium', side: 0, col: 1, rad: [0.08, 0.1, 0.045], queue: 0.3, gate: 'mit', next: ['lv'], where: 'la' });
    seg('lv', [[0.36, 0.04, -0.02], [0.31, -0.2, 0], [0.3, -0.44, 0], [0.22, -0.4, 0], [0.17, -0.15, -0.01], [0.14, 0.15, -0.03], [0.12, 0.42, -0.04]], { kind: 'vent', side: 0, col: 1, rad: [0.045, 0.09, 0.07, 0.07, 0.05, 0.04], queue: 0.85, gate: 'aor', next: ['asc'], where: 'lv' });
    seg('asc', [[0.12, 0.42, -0.04], [0.06, 0.75, -0.06], [-0.02, 1.05, -0.05], [0.04, 1.27, -0.15]], { kind: 'artery', side: 0, col: 1, rad: [0.045, 0.06], next: ['brR', 'brL', 'desc'], w: [0.15, 0.15, 0.7], where: 'asc' });
    seg('desc', [[0.04, 1.27, -0.15], [0.3, 1.22, -0.35], [0.38, 0.9, -0.52], [0.3, 0.2, -0.6], [0.2, -0.6, -0.6], [0.12, -1.12, -0.45], [0.1, -1.36, -0.3]], { kind: 'artery', side: 0, col: 1, rad: [0.06, 0.055], where: 'desc' });
    seg('brR', [[0.04, 1.27, -0.15], ...BR.brR], { kind: 'artery', side: 0, col: 1, rad: [0.03, 0.02], where: 'branch' });
    seg('brL', [[0.04, 1.27, -0.15], ...BR.brL], { kind: 'artery', side: 0, col: 1, rad: [0.03, 0.02], where: 'branch' });
    // Body capillary loops (red → blue).
    const bodyBed = (from, to, n, box, prefix, nextId) => {
      const ids = [];
      for (let k = 0; k < n; k++) {
        const T = [box[0] + R() * (box[1] - box[0]), box[2] + R() * (box[3] - box[2]), box[4] + R() * (box[5] - box[4])];
        const m1 = [(from[0] + T[0]) / 2, (from[1] + T[1]) / 2 + (R() - 0.5) * 0.06, (from[2] + T[2]) / 2 + 0.08];
        const loop = [[T[0] + 0.05, T[1] + 0.02, T[2] + 0.04], [T[0] - 0.02, T[1] - 0.02, T[2] + 0.07], [T[0] - 0.06, T[1] + 0.01, T[2] - 0.02]];
        const m2 = [(to[0] + T[0]) / 2, (to[1] + T[1]) / 2 + (R() - 0.5) * 0.06, (to[2] + T[2]) / 2 - 0.06];
        const pts = [from, m1, T, ...loop, m2, to];
        const id = `${prefix}${k}`;
        seg(id, pts, { kind: 'cap', side: 0, col: 'r2b', rad: [0.02, 0.008, 0.008, 0.02], next: [nextId], where: 'body' });
        capTubes.push([pts, 'r2b', 'body']);
        ids.push(id);
      }
      return ids;
    };
    segs[segId.desc].next = bodyBed([0.1, -1.36, -0.3], [-0.6, -1.38, -0.2], 7, [-0.85, 0.5, -1.5, -1.42, -0.32, 0.3], 'low', 'ivc');
    segs[segId.brR].next = bodyBed(BR.brR[2], [-0.42, 1.62, 0], 3, [-0.55, 0.3, 1.62, 1.7, -0.18, 0.18], 'upR', 'svc');
    segs[segId.brL].next = bodyBed(BR.brL[2], [-0.42, 1.62, 0], 3, [-0.55, 0.3, 1.62, 1.7, -0.18, 0.18], 'upL', 'svc');
    for (const s of segs) {
      s.nextIdx = s.next.map((n) => segId[n]);
      s.heartish = ['svc', 'ivc', 'ra', 'rv', 'pt', 'la', 'lv', 'asc', 'pvl0', 'pvl1', 'pvr0', 'pvr1'].includes(s.id);
    }
    // Visible capillary vessels with a colour gradient along their length.
    const capMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, transparent: true, opacity: 0.75, emissive: '#200008', depthWrite: false });
    const cTmp = new THREE.Color();
    for (const [pts, mode, card] of capTubes) {
      const tsegs = 60, rad = 8;
      const g = new THREE.TubeGeometry(curve(pts), tsegs, 0.011, rad, false);
      const col = new Float32Array(g.attributes.position.count * 3);
      for (let i = 0; i <= tsegs; i++) {
        let k = sstep(0.3, 0.72, i / tsegs);
        if (mode === 'r2b') k = 1 - k;
        cTmp.lerpColors(BLUE, RED, k);
        for (let j = 0; j <= rad; j++) { const v = (i * (rad + 1) + j) * 3; col[v] = cTmp.r; col[v + 1] = cTmp.g; col[v + 2] = cTmp.b; }
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const m = new THREE.Mesh(g, capMat);
      m.renderOrder = 1;
      heart.add(m);
      pickParts.push([m, card]);
    }

    // ── blood cells ────────────────────────────────────────────────────────────────────────
    const NP = 380;
    const prof = [];
    const rbcH = (x) => (Math.sqrt(Math.max(0, 1 - x * x)) * (0.81 + 7.83 * x * x - 4.39 * x ** 4)) / (2 * 3.91); // Evans–Fung shape
    for (let i = 0; i <= 12; i++) { const x = Math.sin((i / 12) * Math.PI / 2); prof.push(new THREE.Vector2(x, rbcH(x))); }
    for (let i = 11; i >= 0; i--) { const x = Math.sin((i / 12) * Math.PI / 2); prof.push(new THREE.Vector2(x, -rbcH(x))); }
    const rbcGeo = new THREE.LatheGeometry(prof, 18);
    rbcGeo.scale(0.034, 0.034, 0.034);
    const rbcMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2, emissive: '#1a0006' });
    const cells = new THREE.InstancedMesh(rbcGeo, rbcMat, NP);
    cells.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    cells.frustumCulled = false;
    cells.castShadow = true;
    heart.add(cells);
    const pSeg = new Int16Array(NP), pS = new Float32Array(NP), pOff = new Float32Array(NP * 3), pQ = new Float32Array(NP);
    const pAx = new Float32Array(NP * 3), pPh = new Float32Array(NP), pSpin = new Float32Array(NP), pWait = new Uint8Array(NP);
    {
      const tot = segs.reduce((a, s) => a + s.len, 0);
      for (let k = 0; k < NP; k++) {
        let r = R() * tot, si = 0;
        while (r > segs[si].len && si < segs.length - 1) { r -= segs[si].len; si++; }
        pSeg[k] = si; pS[k] = r;
        let x, y, z;
        do { x = R() * 2 - 1; y = R() * 2 - 1; z = R() * 2 - 1; } while (x * x + y * y + z * z > 1);
        pOff[k * 3] = x; pOff[k * 3 + 1] = y; pOff[k * 3 + 2] = z;
        pQ[k] = Math.sqrt(R());
        const ax = new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).normalize();
        pAx[k * 3] = ax.x; pAx[k * 3 + 1] = ax.y; pAx[k * 3 + 2] = ax.z;
        pPh[k] = R() * 6.28; pSpin[k] = 0.6 + R() * 1.6;
      }
    }
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.075, 20, 14), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    halo.renderOrder = 15;
    halo.visible = false;
    heart.add(halo);
    const haloLabel = ctx.label('this cell', { color: '#ffffff', size: 0.5, anchorY: 0.9 });
    halo.add(haloLabel);

    // ── ECG monitor ─────────────────────────────────────────────────────────────────────────
    const mon = new THREE.Group();
    mon.position.set(1.95, 0.98, 1.05);
    mon.rotation.y = -0.22;
    root.add(mon);
    const caseMat = new THREE.MeshPhysicalMaterial({ color: '#1c2333', roughness: 0.35, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.76, 0.08), caseMat);
    box.castShadow = true;
    mon.add(box);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.62, 16), caseMat);
    pole.position.y = -0.69; pole.castShadow = true;
    mon.add(pole);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.04, 32), caseMat);
    foot.position.y = -0.98; foot.receiveShadow = true;
    mon.add(foot);
    const scrCanvas = document.createElement('canvas');
    scrCanvas.width = 1024; scrCanvas.height = 512;
    const scrTex = new THREE.CanvasTexture(scrCanvas);
    scrTex.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.26, 0.66), new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false }));
    screen.position.z = 0.041;
    mon.add(screen);
    pickParts.push([box, 'ecg'], [screen, 'ecg']);
    const EW = 1.14, EY = -0.1, EA = 0.17;
    function drawScreen() {
      const g = scrCanvas.getContext('2d');
      g.fillStyle = '#03110c'; g.fillRect(0, 0, 1024, 512);
      g.lineWidth = 1;
      for (let x = 0; x <= 1024; x += 20) { g.strokeStyle = x % 100 === 0 ? '#0f3b2b' : '#08241a'; g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, 512); g.stroke(); }
      for (let y = 0; y <= 512; y += 20) { g.strokeStyle = y % 100 === 0 ? '#0f3b2b' : '#08241a'; g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(1024, y + 0.5); g.stroke(); }
      g.fillStyle = '#5dffb0';
      g.font = '600 34px "Segoe UI", system-ui, sans-serif';
      g.fillText('ECG · lead II', 28, 50);
      g.textAlign = 'right';
      g.font = '700 64px "Segoe UI", system-ui, sans-serif';
      g.fillStyle = '#7dffc0';
      g.fillText(`♥ ${st.hr}`, 996, 70);
      g.font = '500 26px "Segoe UI", system-ui, sans-serif';
      g.fillText('bpm', 996, 102);
      g.textAlign = 'left';
      g.fillStyle = '#3fbf88';
      g.font = '500 24px "Segoe UI", system-ui, sans-serif';
      g.fillText('P: atria depolarise   QRS: ventricles depolarise   T: ventricles repolarise', 28, 488);
      g.textAlign = 'right';
      g.fillText(`CO ${(st.hr * st.sv / 1000).toFixed(1)} L/min · ${ECG_WIN} s across`, 996, 134);
      scrTex.needsUpdate = true;
    }
    const ecgVal = new Float32Array(ECG_M);
    const mkRibbon = (opacity) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ECG_M * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(ECG_M * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
      const idx = [];
      for (let i = 0; i < ECG_M - 1; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 2, i * 2 + 1, i * 2 + 3);
      g.setIndex(idx);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
      m.frustumCulled = false;
      m.renderOrder = 4;
      mon.add(m);
      return m;
    };
    const traceCore = mkRibbon(1), traceGlow = mkRibbon(0.35);
    traceCore.position.z = 0.047; traceGlow.position.z = 0.045;
    const headDot = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8), new THREE.MeshBasicMaterial({ color: '#d8ffe9', toneMapped: false }));
    headDot.position.z = 0.05;
    mon.add(headDot);
    const waveLabels = ['P', 'QRS', 'T'].map((tx) => { const l = ctx.label(tx, { color: '#8dffc6', bg: 'rgba(2,20,12,0.8)', size: 0.42 }); l.visible = false; mon.add(l); return l; });

    // ── labels ───────────────────────────────────────────────────────────────────────────
    const LB = { neutral: '#e9fff8', blue: '#a9bbff', red: '#ffb0b6', valve: '#ffe7c4' };
    const labels = [];
    const addLabel = (text, p, color, group = 'always', size = 0.56) => {
      const l = ctx.label(text, { color, size });
      l.position.set(...p);
      heart.add(l);
      labels.push({ l, group });
      return l;
    };
    addLabel('Right atrium', [-0.62, 0.3, 0.32], LB.blue);
    addLabel('Right ventricle', [-0.36, -0.42, 0.42], LB.blue);
    addLabel('Left atrium', [0.66, 0.36, 0.3], LB.red);
    addLabel('Left ventricle', [0.36, -0.55, 0.4], LB.red);
    addLabel('Septum', [-0.03, -0.3, 0.34], LB.neutral, 'open', 0.5);
    addLabel('Tricuspid', [-0.58, -0.08, 0.2], LB.valve, 'open', 0.5);
    addLabel('Mitral', [0.55, 0.02, 0.2], LB.valve, 'open', 0.5);
    addLabel('Pulmonary valve', [-0.42, 0.5, 0.22], LB.valve, 'open', 0.5);
    addLabel('Aortic valve', [0.36, 0.52, 0.12], LB.valve, 'open', 0.5);
    addLabel('Superior vena cava', [-0.75, 1.15, 0], LB.blue);
    addLabel('Inferior vena cava', [-0.85, -0.95, -0.2], LB.blue);
    addLabel('Pulmonary trunk', [-0.3, 0.86, 0.2], LB.blue);
    addLabel('Pulmonary arteries', [0.62, 1.04, -0.05], LB.blue);
    addLabel('Pulmonary veins', [0.84, 0.12, -0.1], LB.red);
    addLabel('Aorta', [0.3, 1.38, -0.2], LB.red);
    addLabel('Right lung', [-1.5, 1.22, -0.05], LB.neutral);
    addLabel('Left lung', [1.5, 1.22, -0.05], LB.neutral);
    addLabel('Body tissues (lower body)', [0.55, -1.42, 0.3], LB.neutral);
    addLabel('Head & arms', [0.45, 1.74, 0.1], LB.neutral);
    const lubL = ctx.label('LUB  (S1: AV valves shut)', { color: '#ffffff', bg: 'rgba(30,60,140,0.85)', size: 0.6 });
    const dubL = ctx.label('DUB  (S2: semilunar valves shut)', { color: '#ffffff', bg: 'rgba(140,30,50,0.85)', size: 0.6 });
    lubL.position.set(-0.9, -0.3, 0.5); dubL.position.set(0.9, 0.62, 0.45);
    lubL.visible = dubL.visible = false;
    heart.add(lubL, dubL);
    function applyLabels() {
      const open = st.wall !== 'closed';
      for (const { l, group } of labels) l.visible = st.labels && (group === 'always' || open);
    }

    // ── cardiac cycle model ──────────────────────────────────────────────────────────────
    let C = null;
    function timing() {
      const T = 60 / st.hr, f = Math.sqrt(T / 0.8);
      let c = { aStart: 0.04 * f, aEnd: 0.14 * f, pPeak: 0.045 * f, pW: 0.016 * f, qrs: 0.16 * f, vs: 0.21 * f, ej: 0.26 * f, ejEnd: 0.53 * f, ivr: 0.61 * f };
      const k = Math.min(1, (T - 0.03) / c.ivr);
      for (const key in c) c[key] *= k;
      c.T = T;
      c.rPeak = c.qrs + 0.04 * f * k; c.tPeak = c.ejEnd - 0.075 * f * k; c.tW = 0.04 * f * k; c.qw = f * k;
      return c;
    }
    function ecgAt(tau) {
      let v = 0;
      for (let w = -1; w <= 1; w++) {
        const x = tau + w * C.T;
        const g = (mu, s, a) => a * Math.exp(-0.5 * ((x - mu) / s) ** 2);
        v += g(C.pPeak, C.pW, 0.13) + g(C.qrs + 0.014 * C.qw, 0.007 * C.qw, -0.12) + g(C.rPeak, 0.009 * C.qw, 1.05) + g(C.rPeak + 0.024 * C.qw, 0.008 * C.qw, -0.25) + g(C.tPeak, C.tW, 0.3);
      }
      return v;
    }
    const PHASES = [
      { name: 'Atrial systole', sub: 'After the P wave the atria contract and top up the ventricles. AV valves open, semilunar valves shut.' },
      { name: 'Ventricular systole: isovolumetric contraction', sub: 'After the QRS the ventricles start to squeeze. The AV valves slam shut (S1, "lub"); all four valves are shut, so pressure rises with no change in volume.' },
      { name: 'Ventricular systole: ejection', sub: 'Ventricular pressure beats arterial pressure: the semilunar valves open and blood is pumped into the aorta and pulmonary trunk. The atria refill.' },
      { name: 'Diastole: isovolumetric relaxation', sub: 'After the T wave the ventricles relax. Blood falling back snaps the semilunar valves shut (S2, "dub"). All four valves are shut.' },
      { name: 'Diastole: ventricular filling', sub: 'Ventricular pressure drops below atrial pressure, the AV valves open and blood flows in passively (most of the filling).' },
    ];
    const phaseOf = (tau) => (tau < C.aStart ? 4 : tau < C.vs ? 0 : tau < C.ej ? 1 : tau < C.ejEnd ? 2 : tau < C.ivr ? 3 : 4);
    const phaseMid = (i) => [(C.aStart + C.vs) / 2, (C.vs + C.ej) / 2, (C.ej + C.ejEnd) / 2, (C.ejEnd + C.ivr) / 2, C.ivr + (C.T - C.ivr) * 0.45][i];
    const avOpenAt = (tau) => tau < C.vs || tau >= C.ivr;
    const slOpenAt = (tau) => tau >= C.ej && tau < C.ejEnd;
    function ventVol(tau) { // mL in each ventricle
      const sv = st.sv, edv = sv + ESV, passive = ESV + 0.75 * sv;
      if (tau < C.aStart) return passive;
      if (tau < C.aEnd) return passive + (edv - passive) * sstep(C.aStart, C.aEnd, tau);
      if (tau < C.ej) return edv;
      if (tau < C.ejEnd) return edv - sv * easeOut((tau - C.ej) / (C.ejEnd - C.ej));
      if (tau < C.ivr) return ESV;
      const x = (tau - C.ivr) / (C.T - C.ivr);
      return ESV + 0.75 * sv * (1 - (1 - Math.min(1, x * 1.6)) ** 3);
    }
    function atrialSqueeze(tau) {
      const contract = tau >= C.aStart && tau < C.aEnd ? Math.sin(Math.PI * (tau - C.aStart) / (C.aEnd - C.aStart)) : 0;
      let fill;
      if (tau >= C.vs && tau < C.ivr) fill = (tau - C.vs) / (C.ivr - C.vs);
      else if (tau >= C.ivr) fill = 1 - 0.7 * sstep(C.ivr, C.ivr + 0.15, tau);
      else fill = 0.3 * (1 - sstep(C.aStart, C.aEnd, tau));
      return contract - 0.45 * fill;
    }

    // ── particle motion ────────────────────────────────────────────────────────────────────
    const speed = { vein: 0.5, atrium: 0.5, vent: 0.5, artery: 0.5, cap: 0.3 };
    function setSpeeds(tau) {
      const av = avOpenAt(tau), sl = slOpenAt(tau), atr = tau >= C.aStart && tau < C.aEnd;
      const k = clamp(((st.hr * st.sv) / 4900) ** 0.7, 0.4, 2.6);
      speed.vein = 0.5 * k;
      speed.atrium = (atr ? 1.6 : av ? 0.75 : 0.35) * k;
      speed.vent = (sl ? 3.4 : av ? 0.6 : 0) * k;
      speed.artery = (sl ? 2.6 : 0.45) * k;
      speed.cap = 0.3 * k;
    }
    function gateOpen(g) { return !g || valves[g].o > 0.5; }
    function pickNext(sg) {
      if (sg.nextIdx.length === 1) return sg.nextIdx[0];
      if (sg.w) { let r = Math.random(), i = 0; while (i < sg.w.length - 1 && r > sg.w[i]) { r -= sg.w[i]; i++; } return sg.nextIdx[i]; }
      return sg.nextIdx[Math.floor(Math.random() * sg.nextIdx.length)];
    }
    let laps = 0;
    function moveCells(dt) {
      for (let k = 0; k < NP; k++) {
        let sg = segs[pSeg[k]];
        let s = pS[k] + speed[sg.kind] * dt;
        pWait[k] = 0;
        if (s >= sg.len - (sg.queue ? pQ[k] * sg.queue : 0) && !gateOpen(sg.gate)) {
          const stop = sg.len - pQ[k] * sg.queue;
          s = Math.max(Math.min(s, stop), Math.min(pS[k], sg.len));
          pWait[k] = 1;
        }
        while (s >= sg.len) {
          s -= sg.len;
          const ni = pickNext(sg);
          if (k === st.follow && (sg.id === 'ivc' || sg.id === 'svc')) laps++;
          pSeg[k] = ni;
          sg = segs[ni];
        }
        pS[k] = s;
      }
    }

    // ── stepping the model ─────────────────────────────────────────────────────────────────
    let ecgHead = 0, simT = 0;
    const lastPeak = [0, 0, 0];
    function advance(dt) {
      const t0 = st.tau;
      let t1 = t0 + dt;
      const wrapped = t1 >= C.T;
      const crossed = (x) => (wrapped ? x >= t0 || x < t1 - C.T : x >= t0 && x < t1);
      if (crossed(C.vs)) soundEvent('lub');
      if (crossed(C.ejEnd)) soundEvent('dub');
      const peaks = [C.pPeak, C.rPeak, C.tPeak];
      for (let i = 0; i < 3; i++) if (crossed(peaks[i])) lastPeak[i] = 1;
      if (wrapped) { t1 -= C.T; st.beat++; }
      st.tau = t1;
      simT += dt;
      // ECG: write the samples the head swept over.
      const h0 = ecgHead, h1 = ecgHead + (dt / ECG_WIN) * ECG_M;
      for (let i = Math.floor(h0) + 1; i <= Math.floor(h1); i++) {
        const tt = t0 + dt * ((i - h0) / (h1 - h0));
        ecgVal[i % ECG_M] = ecgAt(tt % C.T);
      }
      ecgHead = h1 % ECG_M;
      for (let i = 0; i < 3; i++) if (lastPeak[i]) { lastPeak[i] = 0; waveLabels[i].userData.x = Math.floor(ecgHead); waveLabels[i].userData.on = true; }
      // Valves ease toward open/shut.
      const kk = 1 - Math.exp(-dt * 30);
      for (const v of Object.values(valves)) v.o += ((v.kind === 'av' ? avOpenAt(st.tau) : slOpenAt(st.tau)) - v.o) * kk;
      setSpeeds(st.tau);
      moveCells(dt);
    }
    function valvesInstant() { for (const v of Object.values(valves)) v.o = (v.kind === 'av' ? avOpenAt(st.tau) : slOpenAt(st.tau)) ? 1 : 0; }

    let audio = null;
    function soundEvent(kind) {
      if (kind === 'lub') st.lubT = 0.35; else st.dubT = 0.3;
      st.lastSound = kind;
      if (st.sound && audio && !st.warming) {
        const now = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(kind === 'lub' ? 58 : 82, now);
        o.frequency.exponentialRampToValueAtTime(kind === 'lub' ? 38 : 55, now + 0.12);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(kind === 'lub' ? 0.9 : 0.6, now + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, now + (kind === 'lub' ? 0.16 : 0.11));
        o.connect(g).connect(audio.destination);
        o.start(now); o.stop(now + 0.2);
      }
    }

    // ── drawing ──────────────────────────────────────────────────────────────────────────
    const vP = new THREE.Vector3(), vQ = new THREE.Vector3(), qR = new THREE.Quaternion(), vAx = new THREE.Vector3(), vSc = new THREE.Vector3();
    const mTmp = new THREE.Matrix4(), cCol = new THREE.Color(), WHITE = new THREE.Color(1, 1, 1);
    function cellPos(k, out) {
      const sg = segs[pSeg[k]], s = pS[k];
      const u = clamp(s / sg.len, 0, 1) * sg.M, i = Math.min(Math.floor(u), sg.M - 1), f = u - i;
      const P = sg.pos, T = sg.tan, a = i * 3, b = a + 3;
      const x = P[a] + (P[b] - P[a]) * f, y = P[a + 1] + (P[b + 1] - P[a + 1]) * f, z = P[a + 2] + (P[b + 2] - P[a + 2]) * f;
      const tx = T[a], ty = T[a + 1], tz = T[a + 2];
      const ra = sg.rad, rr = ra.length === 1 ? ra[0] : (() => { const v = (s / sg.len) * (ra.length - 1), j = Math.min(Math.floor(v), ra.length - 2); return ra[j] + (ra[j + 1] - ra[j]) * (v - j); })();
      let ox = pOff[k * 3] * rr, oy = pOff[k * 3 + 1] * rr, oz = pOff[k * 3 + 2] * rr;
      const d = ox * tx + oy * ty + oz * tz;
      ox -= d * tx; oy -= d * ty; oz -= d * tz;
      if (sg.heartish) deformJS(out, x + ox, y + oy, z + oz, 1, sg.side, U.uV.value, U.uA.value);
      else out.set(x + ox, y + oy, z + oz);
      return out;
    }
    function cellColor(k, out) {
      const sg = segs[pSeg[k]];
      if (sg.col === 0) return out.copy(BLUE);
      if (sg.col === 1) return out.copy(RED);
      let x = sstep(0.3, 0.72, pS[k] / sg.len);
      if (sg.col === 'r2b') x = 1 - x;
      return out.lerpColors(BLUE, RED, x);
    }
    function drawCells(t) {
      cells.visible = st.flow;
      if (!st.flow) { halo.visible = false; return; }
      for (let k = 0; k < NP; k++) {
        cellPos(k, vP);
        vAx.set(pAx[k * 3], pAx[k * 3 + 1], pAx[k * 3 + 2]);
        qR.setFromAxisAngle(vAx, pPh[k] + t * pSpin[k]);
        const sc = k === st.follow ? 1.5 : 1;
        vSc.set(sc, sc, sc);
        cells.setMatrixAt(k, mTmp.compose(vP, qR, vSc));
        cellColor(k, cCol);
        if (k === st.follow) { halo.position.copy(vP); cCol.lerp(WHITE, 0.35); }
        cells.setColorAt(k, cCol);
      }
      halo.visible = st.follow >= 0;
      cells.instanceMatrix.needsUpdate = true;
      if (cells.instanceColor) cells.instanceColor.needsUpdate = true;
    }
    function drawValves() {
      for (const v of Object.values(valves)) {
        deformJS(v.group.position, v.base.x, v.base.y, v.base.z, 0.6, v.id === 'tri' || v.id === 'pul' ? 1 : 0, U.uV.value, U.uA.value);
        if (Math.abs(v.o - v.drawn) > 0.003) v.shape(v.o);
      }
      for (const p of pap) {
        deformJS(p.mesh.position, p.b.x, p.b.y, p.b.z, 0.8, p.side, U.uV.value, U.uA.value);
        p.tip.copy(p.dir).multiplyScalar(0.14).add(p.mesh.position);
      }
      let w = 0;
      for (const [vi, pa, pb] of [['tri', 0, 1], ['mit', 2, 3]]) {
        const v = valves[vi];
        for (let e = 0; e < v.edge.length; e++) {
          const tip = pap[e % 2 === 0 ? pa : pb].tip;
          vP.copy(v.edge[e]).add(v.group.position);
          chordPos[w++] = vP.x; chordPos[w++] = vP.y; chordPos[w++] = vP.z;
          chordPos[w++] = tip.x; chordPos[w++] = tip.y; chordPos[w++] = tip.z;
        }
      }
      chordGeo.setDrawRange(0, w / 3);
      chordGeo.attributes.position.needsUpdate = true;
    }
    const ribP = [traceCore, traceGlow].map((m) => m.geometry.attributes.position.array);
    const ribC = [traceCore, traceGlow].map((m) => m.geometry.attributes.color.array);
    function drawECG() {
      const head = Math.floor(ecgHead);
      for (let j = 0; j < ECG_M; j++) {
        const x = -EW / 2 + (EW * j) / (ECG_M - 1), y = EY + ecgVal[j] * EA;
        const jm = Math.max(0, j - 1), jp = Math.min(ECG_M - 1, j + 1);
        const dx = (EW * (jp - jm)) / (ECG_M - 1), dy = (ecgVal[jp] - ecgVal[jm]) * EA;
        const l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
        const age = (head - j + ECG_M) % ECG_M;
        const b = age > ECG_M - 14 ? 0 : 1 - (0.6 * age) / ECG_M;
        for (let r = 0; r < 2; r++) {
          const hw = r === 0 ? 0.0055 : 0.017, P = ribP[r], Cc = ribC[r], o = j * 6;
          P[o] = x + nx * hw; P[o + 1] = y + ny * hw; P[o + 2] = 0;
          P[o + 3] = x - nx * hw; P[o + 4] = y - ny * hw; P[o + 5] = 0;
          Cc[o] = Cc[o + 3] = 0.3 * b; Cc[o + 1] = Cc[o + 4] = 1.0 * b; Cc[o + 2] = Cc[o + 5] = 0.62 * b;
        }
      }
      for (const m of [traceCore, traceGlow]) { m.geometry.attributes.position.needsUpdate = true; m.geometry.attributes.color.needsUpdate = true; }
      headDot.position.set(-EW / 2 + (EW * head) / (ECG_M - 1), EY + ecgVal[head] * EA, 0.05);
      const off = [0.07, 0.235, 0.11];
      waveLabels.forEach((l, i) => {
        const x = l.userData.x ?? 0, age = (head - x + ECG_M) % ECG_M;
        l.visible = !!l.userData.on && age < ECG_M - 20;
        l.position.set(-EW / 2 + (EW * x) / (ECG_M - 1), EY + off[i], 0.06);
      });
    }

    // ── readouts / controls ──────────────────────────────────────────────────────────────
    ui.heading('Heartbeat');
    const hrSl = ui.slider('Heart rate', { min: 40, max: 180, step: 1, value: st.hr, fmt: (v) => `${v} bpm`, onChange: (v) => setRate(v, st.sv) });
    ui.slider('Stroke volume', { min: 40, max: 120, step: 1, value: st.sv, fmt: (v) => `${v} mL`, onChange: (v) => setRate(st.hr, v) });
    const pauseBtn = ui.button('Pause', () => setPaused(!st.paused));
    ui.button('Next phase ▸', () => stepPhase(), { primary: true });
    ui.toggle('Slow motion (¼ speed)', { value: st.slow, onChange: (v) => (st.slow = v) });
    const r = {
      phase: ui.readout('Phase'),
      valves: ui.readout('Valves open'),
      sound: ui.readout('Heart sound'),
      vol: ui.readout('Each ventricle'),
      co: ui.readout('Cardiac output'),
    };
    const phaseNote = ui.note('');
    ui.heading('View');
    ui.choice('Heart wall', { options: [{ value: 'closed', label: 'Closed' }, { value: 'glass', label: 'See-through' }, { value: 'cut', label: 'Cut open' }], value: st.wall, onChange: (v) => setWall(v) });
    ui.toggle('Show blood flow', { value: st.flow, onChange: (v) => { st.flow = v; if (!v) setFollow(false); } });
    ui.toggle('Labels', { value: st.labels, onChange: (v) => { st.labels = v; applyLabels(); } });
    ui.toggle('Heart sounds (audio)', { value: false, onChange: (v) => {
      st.sound = v;
      if (v && !audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch { audio = null; } }
      audio?.resume?.();
    } });
    ui.heading('Follow a blood cell');
    const followBtn = ui.button('Follow a blood cell', () => setFollow(st.follow < 0), { primary: true });
    const cellNote = ui.note('<span class="muted">Pick one red blood cell and track its trip round both circuits.</span>');
    ui.note('<span class="muted">Colour code: <b style="color:#7d95ff">blue = deoxygenated</b>, <b style="color:#ff6b75">red = oxygenated</b> (real deoxygenated blood is dark red). The patient\'s right is on your left. Click a chamber, valve, vessel, lung or the ECG to learn about it.</span>');

    function setRate(hr, sv) {
      const frac = C ? st.tau / C.T : 0;
      st.hr = hr; st.sv = sv;
      C = timing();
      st.tau = frac * C.T;
      drawScreen();
    }
    function setPaused(p) {
      st.paused = p;
      pauseBtn.textContent = p ? 'Play' : 'Pause';
    }
    function stepPhase() {
      setPaused(true);
      const i = (phaseOf(st.tau) + 1) % 5;
      st.tau = phaseMid(i);
      valvesInstant();
      setSpeeds(st.tau);
      if (i === 1) soundEvent('lub');
      if (i === 3) soundEvent('dub');
    }
    function setWall(v) {
      st.wall = v;
      frontMesh.visible = v !== 'cut';
      frontMesh.material = v === 'glass' ? glassMat : frontMat;
      frontMesh.castShadow = v === 'closed';
      chords.visible = v !== 'closed';
      ctx.unpickable(frontMesh);
      if (v === 'closed') ctx.pickable(frontMesh, (h) => heartCard(h));
      applyLabels();
    }
    function setFollow(on) {
      if (on) {
        // Start with a cell coming back from the body in the inferior vena cava.
        let best = 0;
        for (let k = 0; k < NP; k++) if (segs[pSeg[k]].id === 'ivc') { best = k; break; }
        st.follow = best; laps = segs[pSeg[best]].id === "ivc" ? -1 : 0; st.followT0 = simT;
        if (!st.flow) { st.flow = true; }
        if (st.wall === 'closed') setWall('glass');
      } else st.follow = -1;
      followBtn.textContent = on ? 'Stop following' : 'Follow a blood cell';
      if (!on) cellNote.set('<span class="muted">Pick one red blood cell and track its trip round both circuits.</span>');
    }
    const WHERE = {
      svc: () => 'In the <b>superior vena cava</b>, coming back from the head and arms. <b style="color:#7d95ff">Deoxygenated.</b>',
      ivc: () => 'In the <b>inferior vena cava</b>, coming back from the lower body. <b style="color:#7d95ff">Deoxygenated.</b>',
      ra: (w) => (w ? 'In the <b>right atrium</b>, waiting: the <b>tricuspid valve</b> is shut while the ventricle contracts.' : 'Crossing the <b>right atrium</b> toward the tricuspid valve.'),
      rv: (w) => (w ? 'In the <b>right ventricle</b>. The <b>pulmonary valve</b> stays shut until the ventricle contracts.' : slOpenAt(st.tau) ? 'Ejected! Leaving the <b>right ventricle</b> through the pulmonary valve.' : 'Through the tricuspid valve into the <b>right ventricle</b>.'),
      pt: () => 'In the <b>pulmonary trunk</b>: an artery carrying <b style="color:#7d95ff">deoxygenated</b> blood to the lungs.',
      lpa: () => 'In the <b>left pulmonary artery</b>, heading for the left lung.',
      rpa: () => 'In the <b>right pulmonary artery</b>, passing under the aortic arch to the right lung.',
      lung: () => 'In a <b>lung capillary</b>, single file: CO₂ diffuses out into the air sacs, O₂ diffuses in and binds to haemoglobin.',
      pv: () => 'In a <b>pulmonary vein</b>, now <b style="color:#ff6b75">oxygenated</b>, returning to the heart.',
      la: (w) => (w ? 'In the <b>left atrium</b>, waiting for the <b>mitral valve</b> to open.' : 'Crossing the <b>left atrium</b> toward the mitral valve.'),
      lv: (w) => (w ? 'In the <b>left ventricle</b>, the thickest-walled chamber. The <b>aortic valve</b> is shut until it contracts.' : slOpenAt(st.tau) ? 'Ejected! Leaving the <b>left ventricle</b> through the aortic valve.' : 'Through the mitral valve into the <b>left ventricle</b>.'),
      asc: () => 'In the <b>ascending aorta</b>. The coronary arteries, which feed the heart muscle, branch off just here.',
      branch: () => 'Up a branch of the <b>aortic arch</b> toward the head and arms.',
      desc: () => 'Down the <b>descending aorta</b>, behind the heart, toward the lower body.',
      body: () => 'In a <b>body capillary</b>, single file: O₂ diffuses out to the cells, CO₂ diffuses in.',
    };

    function refreshReadouts() {
      const ph = phaseOf(st.tau), av = avOpenAt(st.tau), sl = slOpenAt(st.tau);
      r.phase.set(`<b>${PHASES[ph].name}</b>`);
      phaseNote.set(`<span class="muted">${PHASES[ph].sub}</span>`);
      r.valves.set(av ? '<b>tricuspid, mitral</b> <span class="muted">(AV)</span>' : sl ? '<b>pulmonary, aortic</b> <span class="muted">(semilunar)</span>' : '<b>none</b> <span class="muted">(all four shut)</span>');
      const lub = st.lubT > 0, dub = st.dubT > 0;
      r.sound.set(`<span style="padding:1px 8px;border-radius:6px;${lub ? 'background:#3157d6;color:#fff' : 'opacity:0.45'}">LUB</span> <span style="padding:1px 8px;border-radius:6px;${dub ? 'background:#c2283f;color:#fff' : 'opacity:0.45'}">DUB</span>`);
      const v = ventVol(st.tau), edv = st.sv + ESV;
      r.vol.set(`${Math.round(v)} mL <span class="muted">· EDV ${edv} → ESV ${ESV} · EF ${Math.round((st.sv / edv) * 100)}%</span>`);
      r.co.set(`<b>${((st.hr * st.sv) / 1000).toFixed(1)} L/min</b> <span class="muted">= ${st.hr} × ${st.sv} mL</span>`);
      if (st.follow >= 0) {
        const sg = segs[pSeg[st.follow]];
        const secs = simT - st.followT0;
        cellNote.set(`${WHERE[sg.where](pWait[st.follow])}<br><span class="muted">Trip time ${secs.toFixed(1)} s (model time) · full circuits: ${Math.max(0, laps)}</span>`);
      }
    }

    // ── picking ───────────────────────────────────────────────────────────────────────────
    const show = (key) => { const [t, kind, body] = CARDS[key]; ctx.card(t, body, { kind }); };
    const loc = new THREE.Vector3();
    function heartCard(h) {
      loc.copy(h.point);
      heart.worldToLocal(loc);
      const { x, y, z } = loc;
      if (y > 0.5 && Math.abs(x) < 0.3) return show(x < 0 ? 'pa' : 'aorta');
      const d = {
        ra: ell(x, y, z, G.raL), rv: Math.min(ell(x, y, z, G.rvL), cap(x, y, z, G.rvot)),
        la: ell(x, y, z, G.laL), lv: Math.min(rcone(x, y, z, G.lvL), cap(x, y, z, G.lvot)),
      };
      if (y < 0.0 && d.rv > 0.015 && d.lv > 0.015 && x > -0.16 && x < 0.1 && Math.abs(z) < 0.3) return show('septum');
      let best = 'ra';
      for (const k in d) if (d[k] < d[best]) best = k;
      show(best);
    }
    ctx.pickable(backMesh, heartCard);
    for (const v of Object.values(valves)) ctx.pickable(v.group, () => show(v.id));
    for (const p of pap) ctx.pickable(p.mesh, () => show(p.v));
    for (const [m, card] of pickParts) ctx.pickable(m, () => show(card));
    ctx.pickable(cells, () => show('rbc'));

    // ── start ─────────────────────────────────────────────────────────────────────────────
    C = timing();
    drawScreen();
    setWall(st.wall);
    applyLabels();
    st.warming = true;
    const warm = num('warm', 7, 0, 60);
    for (let w = 0; w < warm * 30; w++) advance(1 / 30);
    st.warming = false;
    st.lubT = st.dubT = 0;
    const PH = { atrial: 0, ivc: 1, eject: 2, ivr: 3, fill: 4 };
    if (q.has('phase')) {
      const p = q.get('phase');
      const i = PH[p] ?? clamp(parseInt(p, 10) || 0, 0, 4);
      setPaused(true);
      st.tau = phaseMid(i);
      valvesInstant();
      if (i === 1) st.lubT = 99;
      if (i === 3) st.dubT = 99;
    } else if (q.has('tau')) {
      setPaused(true);
      st.tau = clamp(parseFloat(q.get('tau')) || 0, 0, 0.999) * C.T;
      valvesInstant();
    }
    if (q.has('follow')) setFollow(true);
    if (q.get('cam') === 'heart') ctx.view({ yaw: 0.12, pitch: 0.08, dist: 4.6, target: [0, HY - 0.1, 0] }, true);
    const pk = q.get('pick');
    if (pk && CARDS[pk]) show(pk);
    let snap = q.has('snap') && q.get('cam') !== 'heart';

    function frame(t) {
      const v = ventVol(st.tau);
      U.uV.value = ((st.sv + ESV - v) / st.sv) * clamp(st.sv / 70, 0.6, 1.5);
      U.uA.value = atrialSqueeze(st.tau);
      drawValves();
      drawCells(t);
      drawECG();
      lubL.visible = st.lubT > 0; dubL.visible = st.dubT > 0;
      refreshReadouts();
    }
    frame(0);

    return {
      update(dt, t) {
        if (snap) { snap = false; snapView(VIEW); }
        const rdt = Math.min(dt, 0.05);
        if (!st.paused) advance(rdt * (st.slow ? 0.25 : 1));
        if (st.lubT < 50) st.lubT = Math.max(0, st.lubT - rdt);
        if (st.dubT < 50) st.dubT = Math.max(0, st.dubT - rdt);
        if (!st.paused) { if (st.lubT > 50) st.lubT = 0; if (st.dubT > 50) st.dubT = 0; }
        frame(t);
      },
      onKey(e) {
        if (e.key === ' ' && !e.target.closest?.('button')) { setPaused(!st.paused); e.preventDefault?.(); }
        if (e.key === 'n' || e.key === 'N') stepPhase();
      },
      dispose() {
        try { audio?.close(); } catch { /* ignore */ }
        scrTex.dispose();
      },
    };
  },
};
