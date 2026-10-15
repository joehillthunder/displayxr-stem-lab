// Packets & Routing: eleven routers on the plinth joined by cables, each labelled with its latency.
// Pick a source and a destination, run Dijkstra's shortest-path algorithm one step at a time
// (visited set, tentative distances and the frontier are shown on the routers), then send a
// message split into numbered packets that hop along the routers' forwarding tables. Click a cable
// to cut it: routes are recomputed, packets on the cut cable are lost and TCP resends them, and
// the receiver puts the packets back in order by sequence number.

import * as THREE from 'three';

const BLUE = '#5aa9ff';
const COL = {
  idle: new THREE.Color('#5d6a80'),
  frontier: new THREE.Color('#ffb43c'),
  current: new THREE.Color('#ffffff'),
  done: new THREE.Color(BLUE),
};
const HEX = { idle: '#aab6c8', frontier: '#ffc864', current: '#ffffff', done: '#8cc6ff' };

// name, x, z, pedestal height
const NODES = [
  ['A', -3.1, 0.2, 0.45], ['B', -2.0, -1.6, 0.75], ['C', -1.9, 1.75, 0.3], ['D', -0.9, 0.05, 0.6],
  ['E', -0.15, -2.35, 0.95], ['F', 0.0, 2.45, 0.35], ['G', 0.65, 0.45, 0.8], ['H', 1.45, -1.55, 0.5],
  ['I', 1.95, 1.8, 0.6], ['J', 3.1, -0.05, 0.4], ['K', -0.75, -1.2, 0.25],
];
// a, b, latency in ms
const EDGES = [
  ['A', 'B', 7], ['A', 'C', 9], ['A', 'D', 14], ['B', 'K', 4], ['B', 'E', 12], ['C', 'D', 6], ['C', 'F', 10],
  ['D', 'K', 5], ['D', 'G', 9], ['K', 'E', 6], ['K', 'H', 15], ['E', 'H', 8], ['F', 'G', 4], ['F', 'I', 11],
  ['G', 'H', 7], ['G', 'I', 6], ['G', 'J', 16], ['H', 'J', 5], ['I', 'J', 7],
];
const MESSAGE = 'HELLO, STEM LAB!';
const CHUNK = 4;
const SEC_PER_MS = 0.075;   // animation time per millisecond of latency

export default {
  view: { dist: 9.4, yaw: 0, pitch: 0.62, target: [0, 0.6, 0.1], minDist: 3, maxDist: 18 },
  explain: `
    <p>When you send a message over the internet it is chopped into small <b>packets</b>. Each packet carries a
    <b>header</b> with the source address, the destination address, a sequence number and a <b>TTL</b> (time to live,
    a hop counter that stops lost packets circling forever), followed by a slice of the data.</p>
    <p><b>Routers</b> are computers that pass packets on. Each one looks at the destination address and its
    <b>routing table</b> to pick the next router. Every router-to-router step is a <b>hop</b>. Each link has a
    <b>latency</b>: the time in milliseconds a packet takes to cross it.</p>
    <p>To build their tables, routers using link-state protocols such as OSPF run <b>Dijkstra’s algorithm</b>:</p>
    <ol>
      <li>Give the source distance 0 and every other router ∞.</li>
      <li>Visit the unvisited router with the smallest distance. Its distance is now final.</li>
      <li>For each neighbour, try “my distance + link latency”. If that is smaller, it becomes the neighbour’s new
      tentative distance.</li>
      <li>Repeat until the destination is visited.</li>
    </ol>
    <p>The shortest path is not always the one with the fewest hops. Cut a cable and the routers recompute,
    so traffic flows around the break.</p>
    <p>Packets can take different times and arrive out of order, and some get lost. <b>TCP</b> numbers every packet so the
    receiver can put them back in order, and it resends any packet that is not acknowledged.</p>`,
  formula: 'Relax edge (u, v): d(v) ← min( d(v), d(u) + w(u, v) )',
  vocab: [
    ['Packet', 'A small chunk of data with a header (source, destination, sequence number, TTL).'],
    ['Router', 'A device that forwards each packet towards its destination using a routing table.'],
    ['Hop', 'One step of a packet’s journey, from one router to the next.'],
    ['Latency', 'The delay for data to cross a link, usually measured in milliseconds (ms).'],
    ['IP address', 'The number that identifies a device on a network; routers read the destination IP.'],
    ['Dijkstra’s algorithm', 'Finds the lowest-total-weight path from one node to all others in a graph with non-negative weights.'],
    ['TCP', 'A protocol that numbers packets, reassembles them in order and resends lost ones.'],
    ['Redundancy', 'Having more than one possible path, so the network survives a broken link.'],
  ],
  standards: ['CSTA 3A-NI-04'],
  quiz: [
    { q: 'What does a router read to decide where to send a packet next?', choices: ['The data inside the packet', 'The destination address in the header', 'The size of the packet', 'The time of day'], answer: 1, why: 'Routers look up the destination IP address from the header in their routing table to choose the next hop.' },
    { q: 'At each step, which router does Dijkstra’s algorithm visit next?', choices: ['The one with the most links', 'The neighbour reached by the cheapest single link', 'The unvisited router with the smallest tentative distance', 'A random unvisited router'], answer: 2, why: 'It always finalises the unvisited node with the smallest tentative distance; with non-negative weights no shorter route to it can turn up later.' },
    { q: 'A path crosses links of 7, 4, 6, 8 and 5 ms. How many hops is it, and what is its total latency?', choices: ['5 hops, 30 ms', '6 hops, 30 ms', '5 hops, 8 ms', '4 hops, 30 ms'], answer: 0, why: 'Five links means five hops, and the latencies add: 7 + 4 + 6 + 8 + 5 = 30 ms.' },
    { q: 'Packets numbered 1–4 arrive in the order 3, 1, 4, 2. What does TCP do?', choices: ['Throws them all away', 'Delivers them in arrival order', 'Uses the sequence numbers to put them back in order 1, 2, 3, 4', 'Asks the router to send them again in order'], answer: 2, why: 'Every TCP segment carries a sequence number; the receiver buffers out-of-order data and hands it to the app in order.' },
    { q: 'A cable on the shortest path is cut. What happens?', choices: ['The message can never be delivered', 'Routers recompute their tables and use the next-best path, if one exists', 'Packets wait until the cable is repaired', 'The latency of every link becomes zero'], answer: 1, why: 'Routing protocols notice the dead link and rerun the shortest-path calculation; redundant links let traffic flow around the break, usually with a bit more latency.' },
  ],

  build(ctx) {
    const { root, ui } = ctx;
    const owned = [];
    const own = (x) => (owned.push(x), x);
    const N = NODES.length;
    const idx = Object.fromEntries(NODES.map((n, i) => [n[0], i]));
    const pos = NODES.map(([, x, z, h]) => ({ x, z, h, top: h + 0.24 }));
    const edges = EDGES.map(([a, b, w]) => ({ a: idx[a], b: idx[b], w, cut: false }));
    const adj = Array.from({ length: N }, () => []);
    edges.forEach((e, k) => { adj[e.a].push(k); adj[e.b].push(k); });
    const qs = new URLSearchParams(location.search);

    // ── routers (instanced) ────────────────────────────────────────────────────────────────
    const M = {
      metal: own(new THREE.MeshPhysicalMaterial({ color: 0x2b3446, metalness: 0.85, roughness: 0.32, clearcoat: 0.4, clearcoatRoughness: 0.3 })),
      bezel: own(new THREE.MeshPhysicalMaterial({ color: 0x0b0e14, metalness: 0.2, roughness: 0.25, clearcoat: 1 })),
      steel: own(new THREE.MeshStandardMaterial({ color: 0xb9c0cc, metalness: 1, roughness: 0.3 })),
      gunmetal: own(new THREE.MeshStandardMaterial({ color: 0x3b4352, metalness: 0.9, roughness: 0.38 })),
      rubber: own(new THREE.MeshStandardMaterial({ color: 0x15181f, roughness: 0.8 })),
      port: own(new THREE.MeshStandardMaterial({ color: 0x050608, roughness: 0.6 })),
      glow: own(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })),
    };
    const ped = own(new THREE.CylinderGeometry(0.07, 0.1, 1, 24).translate(0, 0.5, 0));
    const foot = own(new THREE.CylinderGeometry(0.22, 0.24, 0.04, 32).translate(0, 0.02, 0));
    const body = own(roundedBoxGeo(0.66, 0.2, 0.44, 0.03));
    const bezel = own(new THREE.BoxGeometry(0.6, 0.15, 0.02));
    const topPlate = own(new THREE.BoxGeometry(0.42, 0.012, 0.06));
    const statusBar = own(new THREE.BoxGeometry(0.1, 0.03, 0.012));
    const portGeo = own(new THREE.BoxGeometry(0.055, 0.045, 0.012));
    const portLed = own(new THREE.BoxGeometry(0.014, 0.01, 0.01));
    const antenna = own(new THREE.CylinderGeometry(0.012, 0.016, 0.34, 10).translate(0, 0.17, 0));
    const antTip = own(new THREE.SphereGeometry(0.022, 12, 8));
    const PORTS = 6;

    const routers = new THREE.Group();
    root.add(routers);
    const inst = (geo, mat, count, per, shadow = true) => {
      const m = new THREE.InstancedMesh(geo, mat, count);
      m.userData.per = per;
      m.castShadow = shadow;
      m.receiveShadow = true;
      routers.add(m);
      return m;
    };
    const iPed = inst(ped, M.gunmetal, N, 1), iFoot = inst(foot, M.rubber, N, 1), iBody = inst(body, M.metal, N, 1);
    const iBezel = inst(bezel, M.bezel, N, 1, false), iTop = inst(topPlate, M.glow, N, 1, false), iStatus = inst(statusBar, M.glow, N, 1, false);
    const iPort = inst(portGeo, M.port, N * PORTS, PORTS, false), iLed = inst(portLed, M.glow, N * PORTS, PORTS, false);
    const iAnt = inst(antenna, M.rubber, N * 2, 2), iTip = inst(antTip, M.steel, N * 2, 2, false);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), sc = new THREE.Vector3(), c3 = new THREE.Color();
    const place = (im, k, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => {
      q.setFromEuler(new THREE.Euler(rx, 0, rz));
      im.setMatrixAt(k, m4.compose(v3.set(x, y, z), q, sc.set(sx, sy, sz)));
    };
    for (let i = 0; i < N; i++) {
      const { x, z, h } = pos[i];
      place(iFoot, i, x, 0, z);
      place(iPed, i, x, 0.04, z, 1, h - 0.04, 1);
      place(iBody, i, x, h + 0.1, z);
      place(iBezel, i, x, h + 0.1, z + 0.222);
      place(iTop, i, x, h + 0.206, z);
      place(iStatus, i, x + 0.22, h + 0.1, z + 0.232);
      for (let p = 0; p < PORTS; p++) {
        const px = x - 0.24 + p * 0.07;
        place(iPort, i * PORTS + p, px, h + 0.095, z + 0.232);
        place(iLed, i * PORTS + p, px - 0.015, h + 0.128, z + 0.234);
      }
      place(iAnt, i * 2, x - 0.26, h + 0.19, z - 0.17, 1, 1, 1, -0.12, 0.18);
      place(iAnt, i * 2 + 1, x + 0.26, h + 0.19, z - 0.17, 1, 1, 1, -0.12, -0.18);
      place(iTip, i * 2, x - 0.26 - Math.sin(0.18) * 0.34, h + 0.19 + 0.335, z - 0.17 - 0.04);
      place(iTip, i * 2 + 1, x + 0.26 + Math.sin(0.18) * 0.34, h + 0.19 + 0.335, z - 0.17 - 0.04);
      iTop.setColorAt(i, COL.idle); iStatus.setColorAt(i, COL.idle);
      for (let p = 0; p < PORTS; p++) iLed.setColorAt(i * PORTS + p, COL.idle);
    }
    ctx.pickable(routers, (hit) => {
      const per = hit.object.userData.per || 1;
      if (hit.instanceId == null) return;
      pickRouter(Math.floor(hit.instanceId / per));
    });

    // Source / destination markers: spinning rings over the routers.
    const ringGeo = own(new THREE.TorusGeometry(0.2, 0.022, 12, 48));
    const srcMat = own(new THREE.MeshBasicMaterial({ color: new THREE.Color('#4fe0a0'), toneMapped: false }));
    const dstMat = own(new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff6ad5'), toneMapped: false }));
    const srcRing = new THREE.Mesh(ringGeo, srcMat), dstRing = new THREE.Mesh(ringGeo, dstMat);
    srcRing.rotation.x = dstRing.rotation.x = Math.PI / 2;
    root.add(srcRing, dstRing);

    // ── cables ─────────────────────────────────────────────────────────────────────────────
    const CM = {
      idle: own(new THREE.MeshPhysicalMaterial({ color: 0x2a3a58, roughness: 0.45, clearcoat: 0.6, emissive: new THREE.Color(BLUE), emissiveIntensity: 0.06 })),
      tree: own(new THREE.MeshStandardMaterial({ color: 0x24456e, roughness: 0.4, emissive: new THREE.Color(BLUE), emissiveIntensity: 0.35 })),
      exam: own(new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.72, 0.25), toneMapped: false })),
      path: own(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.45, 0.85, 1.0), toneMapped: false })),
      cut: own(new THREE.MeshStandardMaterial({ color: 0x7a1820, roughness: 0.5, emissive: new THREE.Color('#ff3040'), emissiveIntensity: 0.5 })),
      none: own(new THREE.MeshBasicMaterial({ visible: false })),
      hover: own(new THREE.MeshStandardMaterial({ color: 0x8a96ad, roughness: 0.4, emissive: new THREE.Color('#ff8090'), emissiveIntensity: 0.35 })),
    };
    const SEG = 48, RAD = 10;
    const cableGroup = new THREE.Group();
    root.add(cableGroup);
    const tmpP = new THREE.Vector3();
    edges.forEach((e, k) => {
      const A = pos[e.a], B = pos[e.b];
      const p0 = new THREE.Vector3(A.x, A.h + 0.1, A.z), p2 = new THREE.Vector3(B.x, B.h + 0.1, B.z);
      const len = p0.distanceTo(p2);
      const mid = p0.clone().lerp(p2, 0.5);
      mid.y = Math.max(0.1, Math.min(p0.y, p2.y) - 0.18 - 0.1 * len);
      e.curve = new THREE.QuadraticBezierCurve3(p0, mid, p2);
      const geo = own(new THREE.TubeGeometry(e.curve, SEG, 0.024, RAD, false));
      const per = RAD * 6;
      geo.clearGroups();
      geo.addGroup(0, per * 21, 0);
      geo.addGroup(per * 21, per * 6, 1);
      geo.addGroup(per * 27, per * (SEG - 27), 0);
      e.mats = [CM.idle, CM.idle];
      e.mesh = new THREE.Mesh(geo, e.mats);
      e.mesh.castShadow = true;
      const hitGeo = own(new THREE.TubeGeometry(e.curve, 16, 0.1, 6, false));
      e.hit = new THREE.Mesh(hitGeo, CM.none);
      cableGroup.add(e.mesh, e.hit);
      ctx.pickable(e.hit, () => toggleCut(k), (h) => { const want = h ? k : (hoverEdge === k ? -1 : hoverEdge); if (want !== hoverEdge) { hoverEdge = want; if (steps.length) applyStep(); } });
      e.curve.getPoint(0.5, tmpP);
      e.label = ctx.label(`${e.w} ms`, { color: '#b9c7dc', size: 0.62 });
      e.label.position.set(tmpP.x, tmpP.y + 0.06, tmpP.z);
      root.add(e.label);
    });

    // Router name / distance labels.
    const nodeLabel = NODES.map(([name], i) => {
      const l = ctx.label(name, { color: HEX.idle, size: 0.9 });
      l.position.set(pos[i].x, pos[i].top + 0.42, pos[i].z);
      root.add(l);
      return { sprite: l, text: name, color: HEX.idle };
    });
    function setNodeLabel(i, text, color) {
      const L = nodeLabel[i];
      if (L.text === text && L.color === color) return;
      L.sprite = ctx.relabel(L.sprite, text, { color, size: 0.9 });
      L.text = text; L.color = color;
    }

    // ── packets ────────────────────────────────────────────────────────────────────────────
    const pktGeo = own(roundedBoxGeo(0.2, 0.12, 0.14, 0.03));
    const pktMat = own(new THREE.MeshPhysicalMaterial({ color: 0x9fd0ff, roughness: 0.2, clearcoat: 1, emissive: new THREE.Color(BLUE), emissiveIntensity: 0.9 }));
    const pktLost = own(new THREE.MeshPhysicalMaterial({ color: 0xff6070, roughness: 0.3, emissive: new THREE.Color('#ff2040'), emissiveIntensity: 0.8, transparent: true }));
    const stripeGeo = own(new THREE.BoxGeometry(0.205, 0.03, 0.145));
    const stripeMat = own(new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1), toneMapped: false }));
    const POOL = 12;
    const pool = [];
    for (let i = 0; i < POOL; i++) {
      const g = new THREE.Group();
      const m = new THREE.Mesh(pktGeo, pktMat);
      m.castShadow = true;
      const s = new THREE.Mesh(stripeGeo, stripeMat);
      s.position.y = 0.025;
      g.add(m, s);
      g.visible = false;
      root.add(g);
      const l = ctx.label(' ', { color: '#e6f2ff', size: 0.62 });
      l.position.y = 0.12;
      g.add(l);
      pool.push({ g, m, label: l, text: '', active: false });
    }
    let packets = []; // active
    let sendState = null; // { src, dst, n, sent, nextT, received: [], lost, done }

    // ── state ──────────────────────────────────────────────────────────────────────────────
    let src = idx[qs.get('src')] ?? 0, dst = idx[qs.get('dst')] ?? idx.J;
    let steps = [], stepI = -1, running = false, runT = 0, clickSets = 'src';
    let nextHop = new Array(N).fill(-1);
    let hoverEdge = -1;

    function dijkstraSteps(s, d) {
      const dist = new Array(N).fill(Infinity), prev = new Array(N).fill(-1), done = new Array(N).fill(false);
      dist[s] = 0;
      const out = [];
      const snap = (extra) => out.push({ dist: dist.slice(), prev: prev.slice(), done: done.slice(), cur: -1, edge: -1, ...extra });
      snap({ msg: `Start: ${NODES[s][0]} gets distance 0, every other router ∞.` });
      for (;;) {
        let u = -1;
        for (let i = 0; i < N; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
        if (u < 0) { snap({ msg: `No unvisited router is reachable. ${NODES[d][0]} cannot be reached!`, end: true }); break; }
        done[u] = true;
        if (u === d) { snap({ cur: u, msg: `Visit <b>${NODES[u][0]}</b> (smallest tentative distance, ${dist[u]} ms). That is the destination, so we are done.`, end: true }); break; }
        snap({ cur: u, msg: `Visit <b>${NODES[u][0]}</b>: it has the smallest tentative distance (${dist[u]} ms), so that distance is now final.` });
        for (const k of adj[u]) {
          const e = edges[k];
          if (e.cut) continue;
          const v = e.a === u ? e.b : e.a;
          if (done[v]) continue;
          const nd = dist[u] + e.w;
          const old = dist[v];
          if (nd < old) {
            dist[v] = nd; prev[v] = u;
            snap({ cur: u, edge: k, v, msg: `${NODES[u][0]}→${NODES[v][0]}: ${dist[u]} + ${e.w} = ${nd} ms, better than ${old === Infinity ? '∞' : old + ' ms'}. Update ${NODES[v][0]}.` });
          } else {
            snap({ cur: u, edge: k, v, msg: `${NODES[u][0]}→${NODES[v][0]}: ${dist[u]} + ${e.w} = ${nd} ms, not better than ${old} ms. Keep it.` });
          }
        }
      }
      return out;
    }

    /** Full Dijkstra from the destination: each router's next hop toward it (the forwarding table). */
    function computeTables() {
      const dist = new Array(N).fill(Infinity), done = new Array(N).fill(false);
      nextHop = new Array(N).fill(-1);
      dist[dst] = 0;
      for (;;) {
        let u = -1;
        for (let i = 0; i < N; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
        if (u < 0) break;
        done[u] = true;
        for (const k of adj[u]) {
          const e = edges[k];
          if (e.cut) continue;
          const v = e.a === u ? e.b : e.a;
          if (dist[u] + e.w < dist[v]) { dist[v] = dist[u] + e.w; nextHop[v] = u; }
        }
      }
    }
    function edgeBetween(a, b) {
      for (const k of adj[a]) { const e = edges[k]; if ((e.a === b || e.b === b) && !e.cut) return k; }
      return -1;
    }
    function fewestHops(s, d) {
      const prev = new Array(N).fill(-2);
      prev[s] = -1;
      const Q = [s];
      while (Q.length) {
        const u = Q.shift();
        if (u === d) break;
        for (const k of adj[u]) { const e = edges[k]; if (e.cut) continue; const v = e.a === u ? e.b : e.a; if (prev[v] === -2) { prev[v] = u; Q.push(v); } }
      }
      if (prev[d] === -2) return null;
      const p = [];
      for (let v = d; v !== -1; v = prev[v]) p.unshift(v);
      return p;
    }
    const pathLatency = (p) => { let s = 0; for (let i = 1; i < p.length; i++) s += edges[edgeBetween(p[i - 1], p[i])].w; return s; };

    function restart(toEnd = false) {
      steps = dijkstraSteps(src, dst);
      stepI = toEnd ? steps.length - 1 : 0;
      running = false;
      computeTables();
      applyStep();
    }

    // ── visuals for the current step ───────────────────────────────────────────────────────
    function applyStep() {
      const st = steps[stepI];
      const final = st.end && st.dist[dst] < Infinity;
      const path = [];
      if (final) for (let v = dst; v !== -1; v = st.prev[v]) path.unshift(v);
      const pathEdges = new Set();
      for (let i = 1; i < path.length; i++) pathEdges.add(edgeBetween(path[i - 1], path[i]));
      const treeEdges = new Set();
      for (let v = 0; v < N; v++) if (st.prev[v] >= 0) treeEdges.add(edgeBetween(st.prev[v], v));
      edges.forEach((e, k) => {
        let m = CM.idle;
        if (e.cut) m = CM.cut;
        else if (pathEdges.has(k)) m = CM.path;
        else if (k === st.edge) m = CM.exam;
        else if (k === hoverEdge) m = CM.hover;
        else if (treeEdges.has(k) && stepI > 0 && !final) m = CM.tree;
        e.mats[0] = m;
        e.mats[1] = e.cut ? CM.none : m;
        const want = e.cut ? '✂ cut' : `${e.w} ms`;
        const color = e.cut ? '#ff7a85' : pathEdges.has(k) ? '#cfe6ff' : k === st.edge ? '#ffd27a' : '#b9c7dc';
        if (e.labelText !== want || e.labelColor !== color) {
          e.label = ctx.relabel(e.label, want, { color, size: 0.62 });
          e.labelText = want; e.labelColor = color;
        }
      });
      for (let i = 0; i < N; i++) {
        const state = i === st.cur ? 'current' : st.done[i] ? 'done' : st.dist[i] < Infinity ? 'frontier' : 'idle';
        iTop.setColorAt(i, COL[state]);
        iStatus.setColorAt(i, COL[state]);
        const d = st.dist[i];
        const text = stepI === 0 && i !== src ? NODES[i][0] : `${NODES[i][0]} · ${d === Infinity ? '∞' : d + ' ms'}`;
        setNodeLabel(i, text, HEX[state]);
      }
      iTop.instanceColor.needsUpdate = true;
      iStatus.instanceColor.needsUpdate = true;
      srcRing.position.set(pos[src].x, pos[src].top + 0.08, pos[src].z);
      dstRing.position.set(pos[dst].x, pos[dst].top + 0.08, pos[dst].z);
      dstRing.visible = dst !== src;
      // panel
      nStep.set(`<b>Step ${stepI} of ${steps.length - 1}.</b> ${st.msg}`);
      const rows = NODES.map(([name], i) => {
        const state = i === st.cur ? 'current' : st.done[i] ? 'done' : st.dist[i] < Infinity ? 'frontier' : 'idle';
        const bg = i === st.cur ? 'background:rgba(255,255,255,0.12);' : i === st.v ? 'background:rgba(255,180,60,0.16);' : '';
        return `<tr style="${bg}color:${HEX[state]}"><td style="padding:1px 8px"><b>${name}</b>${i === src ? ' (src)' : i === dst ? ' (dst)' : ''}</td><td style="padding:1px 8px;text-align:right">${st.dist[i] === Infinity ? '∞' : st.dist[i]}</td><td style="padding:1px 8px;text-align:center">${st.prev[i] >= 0 ? NODES[st.prev[i]][0] : '–'}</td><td style="padding:1px 8px;text-align:center">${st.done[i] ? '✓' : ''}</td></tr>`;
      }).join('');
      nTable.set(`<table style="border-collapse:collapse;font-variant-numeric:tabular-nums;font-size:13px"><thead><tr><th style="padding:1px 8px;text-align:left">Router</th><th style="padding:1px 8px">dist (ms)</th><th style="padding:1px 8px">via</th><th style="padding:1px 8px">visited</th></tr></thead><tbody>${rows}</tbody></table><span style="color:${HEX.frontier}">■</span> frontier &nbsp;<span style="color:${HEX.done}">■</span> visited &nbsp;<span style="color:#fff">■</span> current`);
      if (final) {
        const fh = fewestHops(src, dst);
        const fl = fh ? pathLatency(fh) : 0;
        rPath.set(`${path.map((i) => NODES[i][0]).join(' → ')}<br>${st.dist[dst]} ms, ${path.length - 1} hops`);
        nCompare.set(fh && fh.length < path.length ? `Fewest hops would be ${fh.map((i) => NODES[i][0]).join(' → ')} (${fh.length - 1} hops) but that takes ${fl} ms. Shortest ≠ fewest hops!` : 'Here the fastest path is also the one with the fewest hops.');
      } else if (st.end) {
        rPath.set('<span style="color:#ff7a85">unreachable</span>');
        nCompare.set('Every route to the destination is cut. Click a red cable to repair it.');
      } else {
        rPath.set('…');
        nCompare.set('');
      }
    }

    function pickRouter(i) {
      if (clickSets === 'src') { if (i === dst) dst = src; src = i; } else { if (i === src) src = dst; dst = i; }
      selSrc.set(NODES[src][0]); selDst.set(NODES[dst][0]);
      clickSets = clickSets === 'src' ? 'dst' : 'src';
      cClick.set(clickSets);
      cancelSend();
      restart();
      ctx.toast(`Source ${NODES[src][0]}, destination ${NODES[dst][0]}`);
    }

    function toggleCut(k) {
      const e = edges[k];
      e.cut = !e.cut;
      // packets crossing a cut cable are lost
      if (e.cut) for (const p of packets) if (p.state === 'move' && p.edge === k) loseAt(p);
      restart(true);
      const st = steps[steps.length - 1];
      const ok = st.dist[dst] < Infinity;
      ctx.toast(e.cut ? `Cable ${NODES[e.a][0]}–${NODES[e.b][0]} cut. ${ok ? `New shortest path: ${st.dist[dst]} ms.` : 'Destination unreachable!'}` : `Cable ${NODES[e.a][0]}–${NODES[e.b][0]} repaired.`, e.cut ? '' : 'good');
    }

    // ── sending ────────────────────────────────────────────────────────────────────────────
    function cancelSend() {
      for (const p of packets) freePkt(p);
      packets = [];
      sendState = null;
      rRecv.set('–');
    }
    function send() {
      cancelSend();
      computeTables();
      if (nextHop[src] < 0 && src !== dst) { ctx.toast('No route to the destination.'); return; }
      const n = Math.ceil(MESSAGE.length / CHUNK);
      sendState = { src, dst, n, queue: Array.from({ length: n }, (_, i) => i + 1), nextT: 0, got: [], arrivals: [], lost: 0, sent: 0, done: false };
      rRecv.set('waiting…');
    }
    function allocPkt() {
      const s = pool.find((p) => !p.active);
      if (!s) return null;
      s.active = true;
      s.g.visible = true;
      s.m.material = pktMat;
      return s;
    }
    function freePkt(p) {
      p.slot.active = false;
      p.slot.g.visible = false;
    }
    function launch(seq) {
      const slot = allocPkt();
      if (!slot) return false;
      const text = `#${seq} ${NODES[sendState.src][0]}→${NODES[sendState.dst][0]}`;
      if (slot.text !== text) { slot.label = ctx.relabel(slot.label, text, { color: '#e6f2ff', size: 0.62 }); slot.text = text; }
      const p = { slot, seq, at: sendState.src, state: 'wait', t: 0.05, edge: -1, from: 0, to: 0, s: 0, dur: 1, ttl: 16, fall: 0 };
      packets.push(p);
      sendState.sent++;
      return true;
    }
    function loseAt(p) {
      p.state = 'lost';
      p.fall = 0;
      p.slot.m.material = pktLost;
      sendState.lost++;
      sendState.queue.push(p.seq); // TCP will resend it
      sendState.nextT = Math.max(sendState.nextT, 1.2); // retransmission timeout
    }

    const P = new THREE.Vector3();
    function stepPackets(dt, t) {
      if (!sendState) return;
      const S = sendState;
      S.nextT -= dt;
      if (S.queue.length && S.nextT <= 0) {
        if (launch(S.queue[0])) S.queue.shift();
        S.nextT = 0.45;
      }
      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i];
        const g = p.slot.g;
        if (p.state === 'wait') {
          p.t -= dt;
          const top = pos[p.at];
          g.position.set(top.x, top.top + 0.1 + 0.03 * Math.sin(t * 6 + p.seq), top.z);
          if (p.t <= 0) {
            const nh = nextHop[p.at];
            const k = nh >= 0 ? edgeBetween(p.at, nh) : -1;
            if (k < 0 || --p.ttl <= 0) { loseAt(p); continue; }
            Object.assign(p, { state: 'move', edge: k, from: p.at, to: nh, s: 0, dur: edges[k].w * SEC_PER_MS });
          }
        } else if (p.state === 'move') {
          p.s += dt / p.dur;
          const e = edges[p.edge];
          const u = Math.min(1, p.s);
          e.curve.getPoint(e.a === p.from ? u : 1 - u, P);
          g.position.set(P.x, P.y + 0.09, P.z);
          if (p.s >= 1) {
            p.at = p.to;
            if (p.at === S.dst) {
              p.state = 'arrived';
              S.arrivals.push(p.seq);
              if (!S.got.includes(p.seq)) S.got.push(p.seq);
              p.slotI = S.arrivals.length - 1;
              p.t = 0;
            } else {
              p.state = 'wait';
              p.t = 0.15 + (jitter ? Math.random() * 0.9 : 0); // processing + queueing delay
            }
          }
        } else if (p.state === 'lost') {
          p.fall += dt;
          g.position.y -= dt * (0.4 + p.fall * 3);
          p.slot.m.material.opacity = Math.max(0, 1 - p.fall);
          if (p.fall > 1) { freePkt(p); packets.splice(i, 1); }
        } else if (p.state === 'arrived') {
          // stack above the destination in arrival order, then in sequence order once all are in
          const D = pos[S.dst];
          const order = S.done ? p.seq - 1 : p.slotI;
          const tx = D.x + (order - (S.n - 1) / 2) * 0.26, ty = D.top + 0.55, tz = D.z;
          g.position.x += (tx - g.position.x) * Math.min(1, dt * 6);
          g.position.y += (ty - g.position.y) * Math.min(1, dt * 6);
          g.position.z += (tz - g.position.z) * Math.min(1, dt * 6);
        }
      }
      if (!S.done && S.got.length === S.n) {
        S.done = true;
        // duplicates (if a resend crossed with the original) are dropped by TCP
        for (let i = packets.length - 1; i >= 0; i--) {
          const p = packets[i];
          if (p.state === 'arrived' && packets.findIndex((o) => o.state === 'arrived' && o.seq === p.seq) !== i) { freePkt(p); packets.splice(i, 1); }
        }
        const chunks = [];
        for (let s = 1; s <= S.n; s++) chunks.push(MESSAGE.slice((s - 1) * CHUNK, s * CHUNK));
        const inOrder = S.arrivals.every((s, i) => i === 0 || s >= S.arrivals[i - 1]);
        rRecv.set(`arrived ${S.arrivals.join(', ')}${S.lost ? ` (${S.lost} lost, resent)` : ''}<br>“${chunks.join('')}”`);
        ctx.toast(inOrder ? 'Message delivered in order.' : 'Packets arrived out of order; TCP put them back in sequence.', 'good');
      } else if (!S.done) {
        rRecv.set(`${S.arrivals.length ? 'arrived ' + S.arrivals.join(', ') : 'in flight…'}${S.lost ? ` · ${S.lost} lost` : ''}`);
      }
    }

    // ── panel ──────────────────────────────────────────────────────────────────────────────
    const opts = NODES.map(([n]) => ({ value: n, label: `Router ${n}` }));
    const selSrc = ui.select('Source', { options: opts, value: NODES[src][0], onChange: (v) => { src = idx[v]; if (src === dst) dst = (src + 1) % N; selDst.set(NODES[dst][0]); cancelSend(); restart(); } });
    const selDst = ui.select('Destination', { options: opts, value: NODES[dst][0], onChange: (v) => { dst = idx[v]; if (src === dst) src = (dst + 1) % N; selSrc.set(NODES[src][0]); cancelSend(); restart(); } });
    const cClick = ui.choice('Clicking a router sets', { options: [{ value: 'src', label: 'Source' }, { value: 'dst', label: 'Destination' }], value: 'src', onChange: (v) => (clickSets = v) });
    ui.heading('Dijkstra’s algorithm');
    ui.button('Step', () => { running = false; if (stepI < steps.length - 1) { stepI++; applyStep(); } }, { primary: true });
    ui.button('Run', () => { if (stepI >= steps.length - 1) stepI = 0; running = true; runT = 0; applyStep(); });
    ui.button('Reset', () => { cancelSend(); restart(); });
    ui.button('Jump to end', () => { running = false; stepI = steps.length - 1; applyStep(); });
    const nStep = ui.note('');
    const nTable = ui.note('');
    const rPath = ui.readout('Shortest path');
    const nCompare = ui.note('');
    ui.heading('Send a message');
    ui.button(`Send “${MESSAGE}”`, send, { primary: true });
    let jitter = true;
    ui.toggle('Random queueing delay at routers', { value: true, onChange: (v) => (jitter = v) });
    const rRecv = ui.readout('Received', '–');
    ui.note(`The message is split into ${Math.ceil(MESSAGE.length / CHUNK)} packets of ${CHUNK} characters. Each carries a header: <b>#seq src→dst</b>. Click a cable to cut it (or repair it) while packets are flying.`);

    if (qs.has('cut')) for (const pair of qs.get('cut').split(',')) { const [a, b] = pair.split(''); const k = edges.findIndex((e) => (NODES[e.a][0] === a && NODES[e.b][0] === b) || (NODES[e.a][0] === b && NODES[e.b][0] === a)); if (k >= 0) edges[k].cut = true; }
    restart(qs.has('end'));
    if (qs.has('step')) { stepI = Math.min(steps.length - 1, +qs.get('step')); applyStep(); }
    if (qs.has('send')) send();
    snapView(this.view, qs);

    return {
      update(dt, t) {
        if (running) {
          runT -= dt;
          if (runT <= 0) {
            runT = 0.75;
            if (stepI < steps.length - 1) { stepI++; applyStep(); } else running = false;
          }
        }
        srcRing.rotation.z += dt * 1.5;
        dstRing.rotation.z -= dt * 1.5;
        const bob = 0.03 * Math.sin(t * 2.5);
        srcRing.position.y = pos[src].top + 0.1 + bob;
        dstRing.position.y = pos[dst].top + 0.1 - bob;
        // port activity LEDs
        for (let i = 0; i < N * PORTS; i++) {
          const on = Math.sin(t * (3 + (i * 7) % 11) + i * 1.7) > 0.55;
          c3.setRGB(on ? 0.3 : 0.05, on ? 1.0 : 0.18, on ? 0.45 : 0.08);
          iLed.setColorAt(i, c3);
        }
        iLed.instanceColor.needsUpdate = true;
        stepPackets(dt, t);
      },
      onKey(e) {
        if (e.key === ' ' || e.key === 'n') { if (stepI < steps.length - 1) { stepI++; applyStep(); } }
      },
      dispose() {
        for (const o of owned) o.dispose?.();
        for (const m of routers.children) m.dispose?.();
      },
    };
  },
};

/** ?snap (testing): put the camera straight at the lesson view instead of easing there. */
function snapView(v, qs) {
  const V = window.stem?.view;
  if (!qs.has('snap') || !V || !v) return;
  V.goal = null; V.yaw = v.yaw; V.pitch = v.pitch; V.dist = v.dist; V.target.fromArray(v.target);
}

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
