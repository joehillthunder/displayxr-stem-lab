// Data Centers & AI: a cutaway AI data hall on the plinth. Two rows of GPU racks face cold aisles on
// a raised floor; their backs share a contained hot aisle whose chimneys duct warm air back to the
// CRAH units. Direct-to-chip liquid cooling runs from a CDU to every rack, and facility water carries
// the heat to a cooling tower outside. Power comes from the grid through a transformer, switchgear
// and UPS batteries to PDUs and an overhead busway, with a backup generator. Airflow is drawn as
// particles (blue in, orange out), fibre trays carry data pulses, and a second view opens one
// 8-GPU server tray. The Lab tab holds an AI training/inference estimator (C ≈ 6·N·D) whose
// assumptions also drive the animation (LED activity, exhaust temperature, fan speed, power meters).

import * as THREE from 'three';

const BLUE = '#5aa9ff';
const YF = 0.16;                 // raised-floor top
const RW = 0.3, RD = 0.5, RH = 1.0; // rack width, depth, height (≈ half scale)
const NR = 7;                    // racks per row
const TRAYS = 8;                 // GPU servers per rack (simplified)
const ROWZ = [0.5, -0.5];        // row centres: fronts at ±0.75 (cold aisles), backs at ±0.25 (hot aisle)
const FACE = [1, -1];
const CRAH_X = [-1.95, -0.75];
const rackX = (i) => -2.25 + i * RW;
const HOME_KWH = 10500;          // approx. average US home electricity per year (EIA, rounded)
const T_IN = 24;                 // cold-aisle supply air, °C (inside the ASHRAE recommended 18–27 °C)
const T_COOLANT = 32;            // liquid supply to the cold plates, °C (illustrative "warm water")

const N_OPTS = [1e9, 3e9, 7e9, 8e9, 13e9, 34e9, 70e9, 175e9, 405e9, 1e12, 2e12];
const D_OPTS = [2e10, 1e11, 3e11, 1e12, 1.4e12, 2e12, 5e12, 1e13, 1.5e13, 2e13, 3e13];
const G_OPTS = [8, 64, 256, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 100000];
const PEAK_OPTS = [1e14, 2e14, 3e14, 5e14, 1e15, 2e15, 5e15];

const CARDS = {
  rack: ['Computing', 'GPU server rack', `<p>A rack is a steel frame about 600 mm wide and 2 m tall. Servers slide into numbered slots measured in “U” (1U = 44.45 mm). This model shows 8 GPU servers per rack, a simplification.</p><p>Cool air enters the front from the <b>cold aisle</b>; hot air leaves the back into the <b>hot aisle</b>. A rack of ordinary servers often draws well under 15 kW, while racks built for the newest GPUs can be designed for 100 kW or more, which is why they need liquid cooling.</p>`],
  net: ['Network', 'Network rack', `<p>The rack at the end of each row holds network switches. Every GPU server has several high-speed ports (hundreds of gigabits per second each) linked by fibre to these switches, making a <b>fabric</b> where any GPU can reach any other in a few hops.</p><p>During training the GPUs must regularly share their results (gradients). A slow network leaves expensive GPUs waiting, so AI clusters spend a lot on networking.</p>`],
  crah: ['Cooling', 'CRAH: computer room air handler', `<p>A large fan unit with a coil of chilled water inside. Warm air from the hot aisle comes back through the ducts, crosses the cold coil, gives up its heat and is blown out under the raised floor. (A <b>CRAC</b> unit is similar but has its own refrigeration compressor.)</p><p>The heat ends up in the facility water, which carries it outside. ASHRAE’s guideline recommends server inlet air of roughly 18–27 °C.</p>`],
  cdu: ['Cooling', 'CDU: coolant distribution unit', `<p>Pumps a closed loop of clean, treated coolant (often water or a water–glycol mix) to <b>cold plates</b> on the GPUs and back. Inside, a heat exchanger hands the heat to the facility water loop without the two liquids mixing, and it controls flow, pressure and temperature.</p><p>Liquid carries heat far better than air: for each degree it warms, a litre of water stores about 3,500 times as much heat as a litre of air.</p>`],
  pdu: ['Power', 'PDU: power distribution unit', `<p>Takes power from the UPS and splits it into many protected, metered circuits for the racks, here through an overhead <b>busway</b> with a tap-off box above each rack. Inside the rack, power strips feed each server’s power supplies, which convert AC into the low-voltage DC that chips use.</p>`],
  ups: ['Power', 'UPS & batteries', `<p>An <b>uninterruptible power supply</b> sits between the grid and the servers. It smooths the power and, if the grid dips or fails, its batteries (often lithium-ion or lead-acid) take over instantly. They only need to last long enough, seconds to minutes, for the generators to start.</p><p>Every conversion step loses a little energy as heat, which is part of the overhead that PUE measures.</p>`],
  switchgear: ['Power', 'Switchgear & transfer switch', `<p>Breakers that connect and protect the big power circuits. An <b>automatic transfer switch</b> moves the load from the grid to the generators when the grid fails, and back again when it returns.</p>`],
  transformer: ['Power', 'Transformer', `<p>Power travels long distances at high voltage because the current is then smaller, and wire losses grow with current squared (<i>P</i> = <i>I</i>²<i>R</i>). A transformer uses two coils on an iron core to step the voltage down, for example from tens of kilovolts to roughly 400–480 V for the building.</p><p>Oil inside cools and insulates the coils; the fins radiate the heat. Large campuses often have their own high-voltage substation.</p>`],
  generator: ['Power', 'Backup generator', `<p>Usually a diesel engine driving an alternator. If the grid fails, it starts automatically and the transfer switch moves the load across, typically within seconds; the UPS batteries cover the gap.</p><p>Sites usually keep a spare unit (called N+1), store fuel for many hours or days, and test-run the generators regularly.</p>`],
  tower: ['Cooling', 'Cooling tower', `<p>Warm facility water is sprayed over fill inside the tower while a big fan pulls air through. A little of the water evaporates, and evaporation absorbs a lot of heat: about 2.4 MJ per kilogram. Rejecting 1 kWh (3.6 MJ) of heat by evaporation alone uses roughly 1.5 litres of water.</p><p>So cooling towers save electricity but use water. <b>Dry coolers</b> (giant radiators) use almost no water but need more fan power, or chillers, on hot days. WUE (litres per kWh of IT energy) tracks water use.</p>`],
  fibre: ['Network', 'Fibre-optic trays', `<p>The yellow trays carry bundles of optical fibre. Data travels as pulses of infrared light in glass strands about as thin as a hair, and links in AI clusters run at hundreds of gigabits per second. Each GPU server has several links, so thousands of GPUs can work together like one machine.</p>`],
  containment: ['Cooling', 'Hot-aisle containment', `<p>Doors and a roof close off the hot aisle between the two rows, and chimneys duct the hot exhaust straight back to the CRAH units. Without containment, hot air would curl round and mix into the server inlets, so the cooling plant would have to make colder air and use more energy.</p>`],
  utility: ['Power', 'Utility feed', `<p>The connection to the electricity grid. AI campuses can need tens to hundreds of megawatts, so access to a strong grid connection, ideally with cheap, low-carbon power, is one of the biggest factors in where they are built.</p>`],
  gpu: ['Server', 'GPU (graphics processing unit)', `<p>Thousands of simple cores plus matrix units (tensor cores) that each do many multiply-adds per clock tick. A neural-network layer is a matrix multiplication <b>C = A × B</b>. Each entry of C is a sum of products and can be worked out independently, so a GPU computes thousands of them at once.</p><p>The grey stacks beside the chip are <b>HBM</b> (high-bandwidth memory), stacked memory chips that feed it data at terabytes per second. Data-center GPUs draw from hundreds of watts to over a kilowatt each.</p>`],
  switch: ['Server', 'Switch chips (GPU-to-GPU links)', `<p>These chips link every GPU in the tray to every other one, at hundreds of gigabytes per second per GPU, far faster than the network between servers. That lets 8 GPUs split one big model or batch and share results quickly.</p>`],
  nic: ['Server', 'Network cards & ports', `<p>Typically one high-speed network card per GPU. Each port takes a fibre-optic cable to the cluster fabric so GPUs in different servers and racks can exchange data.</p>`],
  heatsink: ['Server', 'Heat sinks (air cooling)', `<p>Blocks of thin metal fins with a large surface area. Fans push air between the fins to carry the heat away. As GPUs approach a kilowatt each they become very hard to cool with air alone, which is why many new AI systems switch to cold plates.</p>`],
  plate: ['Server', 'Cold plates (direct-to-chip liquid cooling)', `<p>A copper block with tiny channels sits right on each chip. Coolant flows in (blue), picks up heat, and flows out warmer (orange) to the rack manifold and the CDU.</p><p>Because liquid carries heat so well, the coolant can be well above room temperature and still keep the chips safe, which lets outdoor air cool it for much of the year.</p>`],
  fans: ['Server', 'Fans', `<p>Fans pull cool air in from the cold aisle and push it out of the back. By the fan affinity laws, fan power rises roughly with the <b>cube</b> of speed, so doubling the airflow takes about 8 times the power. Liquid cooling lets fans run slower.</p>`],
};

export default {
  view: { dist: 9.2, yaw: 0.55, pitch: 0.58, target: [0, 0.7, 0], minDist: 3, maxDist: 20 },
  explain: `
    <p>Every chatbot answer, video stream and web search runs on computers in a <b>data center</b>. An AI data hall is packed
    with <b>racks</b> of servers full of <b>GPUs</b>. Almost every watt they use ends up as heat, so a data center is really three
    systems working together: <b>computing</b>, <b>power</b> and <b>cooling</b>.</p>
    <p><b>Air cooling.</b> CRAH units (computer room air handlers) blow cool air under a raised floor. It rises through
    perforated tiles into the <b>cold aisle</b>, server fans pull it through the servers, and it leaves warmer into the
    <b>hot aisle</b>. Walls and a roof around the hot aisle (<b>containment</b>) stop hot and cold air mixing, and ducts return the
    hot air to the CRAHs.</p>
    <p><b>Liquid cooling.</b> Racks of modern GPUs make more heat than air can easily carry. In <b>direct-to-chip</b> cooling a
    <b>cold plate</b> sits on each GPU and coolant flows through it. A <b>CDU</b> (coolant distribution unit) pumps that loop and
    passes the heat to facility water, which carries it outside to a <b>cooling tower</b> or dry cooler.</p>
    <p><b>Power.</b> Electricity arrives from the grid at high voltage, a <b>transformer</b> steps it down, a <b>UPS</b> with
    batteries rides through any glitch, and <b>PDUs</b> share the power out to the racks. If the grid fails, the batteries
    bridge the gap until the <b>backup generators</b> start.</p>
    <p><b>Why GPUs?</b> Training a neural network is mostly <b>matrix multiplication</b>: huge grids of multiply-and-add. Each
    output number can be worked out independently, so a GPU’s thousands of cores compute many at once. The 8 GPUs in a server
    are joined by very fast links so they can share results.</p>
    <p><b>How much compute?</b> A widely used approximation says training a model with <i>N</i> parameters on <i>D</i> tokens
    takes about <b>6·N·D</b> floating-point operations (FLOPs): about 2·N·D for the forward pass and 4·N·D for the backward pass.
    Running the trained model (<b>inference</b>) costs about 2·N FLOPs per token.</p>
    <p><b>PUE</b> (power usage effectiveness) = total facility power ÷ IT power. A PUE of 1.0 would mean every watt reaches the
    computers; the extra goes to cooling, power-conversion losses and lighting. Industry surveys put the average around 1.5, and
    some of the most efficient large sites report about 1.1.</p>
    <p><b>Water.</b> Cooling towers reject heat by evaporating water. Each litre that evaporates carries away about 2.4 MJ
    (0.67 kWh), so towers save electricity but use water. Dry coolers use almost no water but need more power on hot days.
    Builders weigh the two, especially where water is scarce.</p>
    <p><b>Location.</b> Data centers are built where electricity is cheap and plentiful (ideally low-carbon), near major
    fibre-optic routes, where land and water are available, and often where a cool climate allows “free cooling” with outside air.</p>
    <p><i>Simplified:</i> the model is only roughly to scale, the temperatures, air speeds and power meter are illustrative, and the
    estimator ignores failures, restarts, communication delays and storage, so real training runs usually take longer.</p>`,
  formula: 'C ≈ 6·<i>N</i>·<i>D</i> FLOPs<br>t = C ÷ (GPUs × peak FLOP/s × MFU)<br>E<sub>IT</sub> = GPUs × P<sub>GPU</sub> × t &nbsp;·&nbsp; E<sub>facility</sub> = E<sub>IT</sub> × PUE<br>PUE = P<sub>facility</sub> ÷ P<sub>IT</sub><br>inference ≈ 2·<i>N</i> FLOPs per token',
  vocab: [
    ['Rack', 'A standard steel frame that holds stacked servers, switches and power strips.'],
    ['GPU', 'Graphics processing unit: a chip with thousands of cores that do many calculations in parallel.'],
    ['Cold aisle / hot aisle', 'Racks face each other so cool air is supplied on one side and hot exhaust is collected on the other.'],
    ['CRAH', 'Computer room air handler: fans blow room air across a chilled-water coil.'],
    ['CDU', 'Coolant distribution unit: pumps the liquid loop to cold plates and passes its heat to facility water.'],
    ['UPS', 'Uninterruptible power supply: batteries and electronics that keep power flowing through grid glitches.'],
    ['PDU', 'Power distribution unit: splits power into protected circuits for the racks.'],
    ['PUE', 'Power usage effectiveness = total facility power ÷ IT power. 1.0 is the ideal.'],
    ['FLOP', 'One floating-point operation, such as a multiply or an add. FLOP/s measures speed.'],
    ['Parameter', 'One learned number (weight) inside a neural network.'],
    ['Token', 'A chunk of text, often part of a word, that a language model reads or writes.'],
    ['MFU', 'Model FLOPs utilisation: the fraction of the GPUs’ peak speed a training run actually achieves.'],
    ['Inference', 'Using a trained model to produce answers, as opposed to training it.'],
  ],
  quiz: [
    { q: 'A data center draws 12 MW in total while its servers and network (the IT load) use 10 MW. What is its PUE?', choices: ['1.2', '0.83', '2.2', '120'], answer: 0, why: 'PUE = total facility power ÷ IT power = 12 ÷ 10 = 1.2. The other 2 MW goes to cooling, power-conversion losses and lighting.' },
    { q: 'Using C ≈ 6·N·D, about how much compute does it take to train a 1-billion-parameter model on 20 billion tokens?', choices: ['1.2 × 10²⁰ FLOPs', '2 × 10¹⁹ FLOPs', '1.2 × 10¹⁰ FLOPs', '6 × 10²⁰ FLOPs'], answer: 0, why: '6 × (1 × 10⁹) × (2 × 10¹⁰) = 12 × 10¹⁹ = 1.2 × 10²⁰ FLOPs.' },
    { q: 'Why are GPUs so good at training neural networks?', choices: ['They do thousands of multiply-adds in parallel, which is exactly what matrix multiplication needs', 'Their clock speed is much higher than any CPU’s', 'They can compute without using electricity', 'They store the whole training dataset inside the chip'], answer: 0, why: 'Neural networks are mostly matrix multiplications, and every output entry can be computed independently, so thousands of parallel cores help enormously. GPU clocks are actually similar to or slower than CPU clocks.' },
    { q: 'What is hot-aisle containment for?', choices: ['Stopping hot exhaust air mixing with the cold supply air, so cooling works efficiently', 'Keeping the servers warm so they run faster', 'Stopping fibre-optic signals from leaking out', 'Storing the backup batteries'], answer: 0, why: 'If hot exhaust mixes into the cold aisle, server inlets get warmer and the cooling plant must work harder. Containment keeps the two air streams apart.' },
    { q: 'With ideal scaling, you double the number of GPUs for the same training run (same N, D, MFU and power per GPU). What happens?', choices: ['Training time about halves; total energy stays about the same', 'Training time halves and total energy halves', 'Training time stays the same; total energy doubles', 'Training time doubles; total energy stays the same'], answer: 0, why: 't = 6ND ÷ (GPUs × peak × MFU), so twice the GPUs means half the time. Energy = GPUs × power × time: twice the GPUs for half as long uses the same energy. (Real scaling is a bit worse than ideal.)' },
  ],

  build(ctx) {
    // Test-only URL options (headless screenshots can't click):
    //   view=hall|server   mode=idle|train|infer   cool=air|liquid   bare (server: lift coolers off)
    //   n=<params> d=<tokens> gpus=<count> peak=<FLOP/s> mfu=<%> pw=<kW per GPU> pue=<x> inf=<%>
    //   labels=0  air=0  outage=<seconds since grid loss>  pick=<card id, e.g. rack, crah, cdu, gpu>
    const { root, ui } = ctx;
    const qs = new URLSearchParams(location.search);
    const snap = qs.has('snap');

    // ── shared helpers ───────────────────────────────────────────────────────────────────────
    const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
    const _e = new THREE.Euler(), _c = new THREE.Color(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
    const UP = new THREE.Vector3(0, 1, 0);
    function setI(im, k, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0, order = 'XYZ') {
      _e.set(rx, ry, rz, order);
      _q.setFromEuler(_e);
      im.setMatrixAt(k, _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)));
    }
    function inst(geo, mat, count, parent, cast = true) {
      const im = new THREE.InstancedMesh(geo, mat, count);
      im.castShadow = cast;
      im.receiveShadow = true;
      parent.add(im);
      return im;
    }
    function mesh(parent, geo, mat, x, y, z, cast = true) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = cast;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    }
    /** Box with its bottom at y. */
    const box = (parent, w, h, d, mat, x, y, z, cast = true) => mesh(parent, new THREE.BoxGeometry(w, h, d), mat, x, y + h / 2, z, cast);
    function canvasTex(w, h, draw, rep) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      draw(c.getContext('2d'), w, h);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
      return t;
    }
    const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 14);
    const unitSph = new THREE.SphereGeometry(1, 12, 8);
    const pulseGeo = new THREE.SphereGeometry(1, 10, 6);

    /** Collects pipe/cable polylines per material, then builds one InstancedMesh of cylinders (+ joints) per material. */
    function pipeKit() {
      const list = new Map();
      return {
        add(mat, pts, r) {
          let L = list.get(mat);
          if (!L) list.set(mat, (L = { segs: [], joints: [] }));
          for (let i = 1; i < pts.length; i++) L.segs.push([...pts[i - 1], ...pts[i], r]);
          for (let i = 1; i < pts.length - 1; i++) L.joints.push([...pts[i], r]);
        },
        build(parent) {
          for (const [mat, L] of list) {
            const cyl = inst(unitCyl, mat, L.segs.length, parent);
            L.segs.forEach((s, k) => {
              _v1.set(s[0], s[1], s[2]); _v2.set(s[3], s[4], s[5]);
              const len = _v1.distanceTo(_v2);
              _p.subVectors(_v2, _v1).normalize();
              _q.setFromUnitVectors(UP, _p);
              _p.addVectors(_v1, _v2).multiplyScalar(0.5);
              cyl.setMatrixAt(k, _m.compose(_p, _q, _s.set(s[6], len, s[6])));
            });
            if (L.joints.length) {
              const sp = inst(unitSph, mat, L.joints.length, parent, false);
              L.joints.forEach((j, k) => setI(sp, k, j[0], j[1], j[2], j[3], j[3], j[3]));
            }
          }
        },
      };
    }

    /** Glowing beads that travel along polylines (flow of power, data or coolant). */
    function pulses(parent, paths, per, color, r) {
      const S = paths.map((pts) => {
        const n = pts.length, P = new Float32Array(n * 3), cum = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          P[i * 3] = pts[i][0]; P[i * 3 + 1] = pts[i][1]; P[i * 3 + 2] = pts[i][2];
          if (i) cum[i] = cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
        }
        return { P, cum, n, L: cum[n - 1] };
      });
      const count = S.length * per;
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), toneMapped: false });
      const im = new THREE.InstancedMesh(pulseGeo, mat, count);
      im.frustumCulled = false;
      parent.add(im);
      const which = new Uint16Array(count), off = new Float32Array(count);
      for (let k = 0; k < count; k++) { which[k] = Math.floor(k / per); off[k] = ((k % per) + 0.35 * Math.random()) / per; }
      const sys = {
        im, phase: 0, scale: 1,
        step(dist) {
          sys.phase += dist;
          const sc = r * sys.scale;
          for (let k = 0; k < count; k++) {
            const p = S[which[k]];
            const s = (off[k] * p.L + sys.phase) % p.L;
            let j = 1;
            while (j < p.n - 1 && p.cum[j] < s) j++;
            const a = (j - 1) * 3, b = j * 3, seg = p.cum[j] - p.cum[j - 1];
            const u = seg > 0 ? (s - p.cum[j - 1]) / seg : 0;
            _m.makeScale(sc, sc, sc);
            _m.setPosition(p.P[a] + (p.P[b] - p.P[a]) * u, p.P[a + 1] + (p.P[b + 1] - p.P[a + 1]) * u, p.P[a + 2] + (p.P[b + 2] - p.P[a + 2]) * u);
            im.setMatrixAt(k, _m);
          }
          im.instanceMatrix.needsUpdate = true;
        },
      };
      sys.step(0);
      return sys;
    }

    const labelRecs = [];
    function label(parent, text, x, y, z, color = '#d6e4f7', size = 0.68) {
      const s = ctx.label(text, { color, size });
      s.position.set(x, y, z);
      parent.add(s);
      const rec = { s, text, color, size };
      labelRecs.push(rec);
      return rec;
    }
    function setLabel(rec, text) {
      if (rec.text === text) return;
      rec.s = ctx.relabel(rec.s, text, { color: rec.color, size: rec.size });
      rec.text = text;
    }

    // ── textures ─────────────────────────────────────────────────────────────────────────────
    const tileTex = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#9097a1'; g.fillRect(0, 0, w, h);
      const gr = g.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0, 'rgba(255,255,255,0.08)'); gr.addColorStop(1, 'rgba(0,0,0,0.08)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},0.05)`; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
      g.strokeStyle = '#4c525b'; g.lineWidth = 4; g.strokeRect(0, 0, w, h);
    }, [11.8, 10.7]);
    const perfTex = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#b4bcc6'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#39404a';
      for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) { g.beginPath(); g.arc(10 + i * 9.8, 10 + j * 9.8, 3.1, 0, 7); g.fill(); }
      g.strokeStyle = '#4c525b'; g.lineWidth = 4; g.strokeRect(0, 0, w, h);
    }, [7, 1]);
    const ventTex = canvasTex(256, 88, (g, w, h) => {
      g.fillStyle = '#1a2130'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(210,230,255,0.85)';
      for (let r = 0; r < 6; r++) for (let c = 0; c < 15; c++) { g.beginPath(); g.arc(46 + c * 13 + (r % 2) * 6.5, 14 + r * 12, 4.4, 0, 7); g.fill(); }
      g.fillStyle = '#ffffff'; g.fillRect(8, 10, 24, 68);           // bright status window
      g.fillStyle = '#5c6575'; g.fillRect(0, 0, 4, h); g.fillRect(w - 4, 0, 4, h); // handles
    });
    const torTex = canvasTex(256, 24, (g, w, h) => {
      g.fillStyle = '#10151e'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffffff';
      for (let i = 0; i < 24; i++) g.fillRect(14 + i * 9.6, 7, 6, 10);
    });
    const dotTex = canvasTex(64, 64, (g) => {
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    });
    const screenTex = canvasTex(128, 64, (g, w, h) => {
      g.fillStyle = '#062033'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#4fd1ff'; g.lineWidth = 3;
      g.beginPath(); for (let x = 0; x <= w; x += 4) g.lineTo(x, 40 - 14 * Math.sin(x / 12) * Math.exp(-x / 160)); g.stroke();
      g.fillStyle = '#9fe6ff'; g.fillRect(8, 8, 40, 6); g.fillRect(8, 50, 70, 5);
    });
    const gravelTex = canvasTex(128, 128, (g, w, h) => {
      g.fillStyle = '#6d6a66'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 1400; i++) { const v = 70 + Math.random() * 90 | 0; g.fillStyle = `rgb(${v},${v - 4},${v - 8})`; g.fillRect(Math.random() * w, Math.random() * h, 2.5, 2.5); }
    }, [3, 3]);

    // ── materials ────────────────────────────────────────────────────────────────────────────
    const M = {
      slab: new THREE.MeshStandardMaterial({ color: 0x4e545d, roughness: 0.92 }),
      floor: new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.5, metalness: 0.15 }),
      perf: new THREE.MeshStandardMaterial({ map: perfTex, roughness: 0.45, metalness: 0.5 }),
      wall: new THREE.MeshStandardMaterial({ color: 0xc4cad2, roughness: 0.82 }),
      wallCap: new THREE.MeshStandardMaterial({ color: 0x2f3540, roughness: 0.5, metalness: 0.4 }),
      rack: new THREE.MeshPhysicalMaterial({ color: 0x141922, metalness: 0.7, roughness: 0.36, clearcoat: 0.35, clearcoatRoughness: 0.35 }),
      rackTop: new THREE.MeshStandardMaterial({ color: 0x2a313d, metalness: 0.85, roughness: 0.3 }),
      front: new THREE.MeshBasicMaterial({ map: ventTex, toneMapped: false }),
      tor: new THREE.MeshBasicMaterial({ map: torTex, toneMapped: false }),
      led: new THREE.MeshBasicMaterial({ toneMapped: false }),
      glass: new THREE.MeshPhysicalMaterial({ color: 0xa8d8ff, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }),
      edge: new THREE.LineBasicMaterial({ color: 0x9fc6ec, transparent: true, opacity: 0.55 }),
      frame: new THREE.MeshStandardMaterial({ color: 0x9aa4b2, metalness: 0.9, roughness: 0.3 }),
      steel: new THREE.MeshStandardMaterial({ color: 0xb9c0cc, metalness: 1, roughness: 0.3 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x1d2129, metalness: 0.5, roughness: 0.5 }),
      cabinet: new THREE.MeshPhysicalMaterial({ color: 0xdfe3e8, metalness: 0.25, roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.3 }),
      cabinetDark: new THREE.MeshPhysicalMaterial({ color: 0x2a303a, metalness: 0.55, roughness: 0.4, clearcoat: 0.4 }),
      screen: new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }),
      cool: new THREE.MeshPhysicalMaterial({ color: 0x2c7fd6, roughness: 0.3, metalness: 0.2, clearcoat: 0.7, emissive: new THREE.Color('#1f74e0'), emissiveIntensity: 0.35 }),
      warm: new THREE.MeshPhysicalMaterial({ color: 0xd9652a, roughness: 0.3, metalness: 0.2, clearcoat: 0.7, emissive: new THREE.Color('#ff5a14'), emissiveIntensity: 0.35 }),
      fibre: new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.45, metalness: 0.1, emissive: new THREE.Color('#3a2a00'), emissiveIntensity: 0.6 }),
      fibreCable: new THREE.MeshStandardMaterial({ color: 0x58d8e8, roughness: 0.4, emissive: new THREE.Color('#0f6f80'), emissiveIntensity: 0.5 }),
      busway: new THREE.MeshStandardMaterial({ color: 0x8c95a3, metalness: 0.8, roughness: 0.35 }),
      cable: new THREE.MeshStandardMaterial({ color: 0x23272e, roughness: 0.55, emissive: new THREE.Color('#ff9a1f'), emissiveIntensity: 0.12 }),
      copper: new THREE.MeshStandardMaterial({ color: 0xc77b4a, metalness: 1, roughness: 0.28 }),
      transformer: new THREE.MeshStandardMaterial({ color: 0x5c6d62, metalness: 0.45, roughness: 0.5 }),
      gen: new THREE.MeshPhysicalMaterial({ color: 0x31503f, metalness: 0.45, roughness: 0.42, clearcoat: 0.5 }),
      tower: new THREE.MeshStandardMaterial({ color: 0xb9c2cb, roughness: 0.55, metalness: 0.1 }),
      louvre: new THREE.MeshStandardMaterial({ color: 0x5d6873, metalness: 0.4, roughness: 0.5 }),
      asphalt: new THREE.MeshStandardMaterial({ color: 0x343940, roughness: 0.95 }),
      gravel: new THREE.MeshStandardMaterial({ map: gravelTex, roughness: 1 }),
      porcelain: new THREE.MeshPhysicalMaterial({ color: 0x7a4a2c, roughness: 0.25, clearcoat: 1 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x5a4430, roughness: 0.9 }),
      water: new THREE.MeshPhysicalMaterial({ color: 0x2f7bb0, roughness: 0.08, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.8 }),
      battery: new THREE.MeshPhysicalMaterial({ color: 0x20242b, metalness: 0.5, roughness: 0.35, clearcoat: 0.6 }),
      meter: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 1, 0.55), toneMapped: false }),
      meterBg: new THREE.MeshStandardMaterial({ color: 0x0b0e13, roughness: 0.6 }),
      // server tray
      pcb: new THREE.MeshPhysicalMaterial({ color: 0x0e3b2a, roughness: 0.45, clearcoat: 0.6 }),
      sub: new THREE.MeshPhysicalMaterial({ color: 0x1d5a3e, roughness: 0.4, clearcoat: 0.5 }),
      pkg: new THREE.MeshPhysicalMaterial({ color: 0x2b6b48, roughness: 0.35, clearcoat: 0.6 }),
      die: new THREE.MeshPhysicalMaterial({ color: 0x0a0c12, metalness: 0.6, roughness: 0.12, clearcoat: 1, iridescence: 0.6 }),
      hbm: new THREE.MeshPhysicalMaterial({ color: 0x4a515c, metalness: 0.8, roughness: 0.22 }),
      fin: new THREE.MeshStandardMaterial({ color: 0xcfd6de, metalness: 1, roughness: 0.22 }),
      chassis: new THREE.MeshStandardMaterial({ color: 0x5b6472, metalness: 0.9, roughness: 0.32 }),
      trace: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.75, 1.0), toneMapped: false, transparent: true, opacity: 0.55 }),
      fan: new THREE.MeshStandardMaterial({ color: 0x15181e, roughness: 0.55, side: THREE.DoubleSide }),
      tile: new THREE.MeshBasicMaterial({ toneMapped: false }),
      plateCover: new THREE.MeshPhysicalMaterial({ color: 0x1a1f27, metalness: 0.3, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.55 }),
    };

    // ════════════════════════════════════════════════════════════════════════════════════════
    // THE SITE (hall + yard). Built in hall-local x, shifted so the whole site is centred.
    // ════════════════════════════════════════════════════════════════════════════════════════
    const site = new THREE.Group();
    site.position.x = -0.3;
    root.add(site);
    const hallLabels = new THREE.Group();
    site.add(hallLabels);

    // Slab, raised floor with pedestals (cut away at the front so the plenum shows), walls.
    const HX0 = -2.6, HX1 = 0.95, HZ0 = -1.75, HZ1 = 1.45;
    const HW = HX1 - HX0, HD = HZ1 - HZ0, HCX = (HX0 + HX1) / 2, HCZ = (HZ0 + HZ1) / 2;
    box(site, HW, 0.02, HD, M.slab, HCX, 0, HCZ, false);
    box(site, HW, 0.03, HD, M.floor, HCX, YF - 0.03, HCZ, false).castShadow = false;
    {
      const ped = new THREE.CylinderGeometry(0.012, 0.016, YF - 0.05, 8);
      const pts = [];
      for (let x = HX0 + 0.15; x < HX1; x += 0.3) for (let z = HZ0 + 0.15; z < HZ1; z += 0.3) pts.push([x, z]);
      const ip = inst(ped, M.steel, pts.length, site, false);
      pts.forEach(([x, z], k) => setI(ip, k, x, 0.02 + (YF - 0.05) / 2, z));
    }
    for (const z of [1.0, -1.0]) {
      const perfGeo = new THREE.PlaneGeometry(2.1, 0.3).rotateX(-Math.PI / 2);
      mesh(site, perfGeo, M.perf, -1.35, YF + 0.002, z, false);
    }
    box(site, HW, 1.75, 0.05, M.wall, HCX, 0, HZ0 - 0.025);
    box(site, 0.05, 1.75, HD, M.wall, HX0 - 0.025, 0, HCZ);
    box(site, HW + 0.05, 0.03, 0.07, M.wallCap, HCX - 0.025, 1.75, HZ0 - 0.025, false);
    box(site, 0.07, 0.03, HD, M.wallCap, HX0 - 0.025, 1.75, HCZ, false);
    box(site, 0.05, 0.32, HD, M.wall, HX1 + 0.025, 0, HCZ);

    // ── racks (instanced) ─────────────────────────────────────────────────────────────────────
    const rackG = new THREE.Group();
    site.add(rackG);
    const NRK = NR * 2, NT = NRK * TRAYS;
    const iRack = inst(new THREE.BoxGeometry(RW - 0.008, RH, RD), M.rack, NRK, rackG);
    const iCap = inst(new THREE.BoxGeometry(RW - 0.004, 0.015, RD + 0.004), M.rackTop, NRK, rackG, false);
    const iTor = inst(new THREE.PlaneGeometry(0.255, 0.04), M.tor, NRK, rackG, false);
    const iFront = inst(new THREE.PlaneGeometry(0.255, 0.088), M.front, NT, rackG, false);
    const iLed = inst(new THREE.BoxGeometry(0.012, 0.012, 0.006), M.led, NT * 2, rackG, false);
    iRack.userData.per = 1; iCap.userData.per = 1; iTor.userData.per = 1; iFront.userData.per = TRAYS; iLed.userData.per = TRAYS * 2;
    const trayH1 = new Float32Array(NT), trayH2 = new Float32Array(NT);
    for (let r = 0; r < 2; r++) {
      const f = FACE[r], z = ROWZ[r], ry = f > 0 ? 0 : Math.PI;
      for (let i = 0; i < NR; i++) {
        const k = r * NR + i, x = rackX(i);
        setI(iRack, k, x, YF + RH / 2, z);
        setI(iCap, k, x, YF + RH + 0.0075, z);
        setI(iTor, k, x, YF + RH - 0.05, z + f * (RD / 2 + 0.003), 1, 1, 1, 0, ry);
        iTor.setColorAt(k, _c.set(i === 0 ? '#7fe0ff' : '#4f86c8'));
        for (let j = 0; j < TRAYS; j++) {
          const t = k * TRAYS + j, y = YF + 0.1 + j * 0.1;
          setI(iFront, t, x, y, z + f * (RD / 2 + 0.003), 1, 1, 1, 0, ry);
          setI(iLed, t * 2, x + f * 0.112, y + 0.02, z + f * (RD / 2 + 0.006));
          setI(iLed, t * 2 + 1, x + f * 0.112, y - 0.02, z + f * (RD / 2 + 0.006));
          iFront.setColorAt(t, _c.setRGB(0.1, 0.15, 0.25));
          iLed.setColorAt(t * 2, _c.setRGB(0.2, 1, 0.4)); iLed.setColorAt(t * 2 + 1, _c.setRGB(0.2, 1, 0.4));
          trayH1[t] = Math.random(); trayH2[t] = Math.random();
        }
      }
    }
    const rackOf = (hit) => (hit.instanceId == null ? -1 : Math.floor(hit.instanceId / (hit.object.userData.per || 1)));
    ctx.pickable(rackG, (hit) => {
      const k = rackOf(hit);
      if (k < 0) return;
      const r = Math.floor(k / NR), i = k % NR;
      const [kind, title, body] = CARDS[i === 0 ? 'net' : 'rack'];
      ctx.card(title, body + `<p class="muted">Row ${r + 1}, rack ${i + 1}${i === 0 ? ' (network)' : ` · ${TRAYS} GPU servers × 8 GPUs = ${TRAYS * 8} GPUs in this model`}.</p>`, { kind });
    });

    // Hot-aisle containment: glass roof and end doors, chimneys and ceiling ducts back to the CRAHs.
    const contG = new THREE.Group();
    site.add(contG);
    const edgeBox = (w, h, d, x, y, z) => {
      const g = new THREE.BoxGeometry(w, h, d);
      const m = mesh(contG, g, M.glass, x, y + h / 2, z, false);
      m.renderOrder = 2;
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), M.edge);
      e.position.copy(m.position);
      contG.add(e);
      return m;
    };
    {
      const x0 = rackX(0) - RW / 2, x1 = rackX(NR - 1) + RW / 2;
      const roof = mesh(contG, new THREE.PlaneGeometry(x1 - x0, 0.5).rotateX(-Math.PI / 2), M.glass, (x0 + x1) / 2, YF + RH + 0.004, 0, false);
      roof.renderOrder = 2;
      for (const x of [x0, x1]) {
        const door = mesh(contG, new THREE.PlaneGeometry(0.5, RH).rotateY(Math.PI / 2), M.glass, x, YF + RH / 2, 0, false);
        door.renderOrder = 2;
        box(contG, 0.025, RH, 0.025, M.frame, x, YF, 0, false);
        box(contG, 0.02, 0.02, 0.5, M.frame, x, YF + RH - 0.02, 0, false);
      }
      box(contG, x1 - x0, 0.02, 0.02, M.frame, (x0 + x1) / 2, YF + RH, 0.25, false);
      box(contG, x1 - x0, 0.02, 0.02, M.frame, (x0 + x1) / 2, YF + RH, -0.25, false);
      for (const cx of CRAH_X) {
        edgeBox(0.32, 0.44, 0.4, cx, YF + RH, 0);
        edgeBox(0.32, 0.17, 1.74, cx, 1.6, -0.84);
        edgeBox(0.32, 0.45, 0.3, cx, YF + 1.1, -1.55);
      }
    }
    ctx.pickable(contG, () => showCard('containment'));

    // CRAH units against the back wall.
    const crahG = new THREE.Group();
    site.add(crahG);
    {
      const slat = new THREE.BoxGeometry(0.6, 0.012, 0.02);
      const iSlat = inst(slat, M.louvre, CRAH_X.length * 12, crahG, false);
      let s = 0;
      for (const cx of CRAH_X) {
        box(crahG, 0.7, 1.1, 0.32, M.cabinet, cx, YF, -1.55);
        box(crahG, 0.66, 0.02, 0.3, M.dark, cx, YF + 1.1, -1.55, false);
        mesh(crahG, new THREE.PlaneGeometry(0.16, 0.08), M.screen, cx + 0.22, YF + 0.92, -1.388, false);
        for (let j = 0; j < 12; j++) setI(iSlat, s++, cx, YF + 0.12 + j * 0.05, -1.385, 1, 1, 1, -0.5);
      }
    }
    ctx.pickable(crahG, () => showCard('crah'));

    // PDUs at the row ends, busway and tap-offs above the racks.
    const pduG = new THREE.Group();
    site.add(pduG);
    const pduMeters = [];
    for (const z of ROWZ) {
      box(pduG, 0.2, 0.95, 0.45, M.cabinetDark, -0.13, YF, z);
      mesh(pduG, new THREE.PlaneGeometry(0.12, 0.07).rotateY(Math.PI / 2), M.screen, -0.029, YF + 0.78, z, false);
      mesh(pduG, new THREE.PlaneGeometry(0.06, 0.4).rotateY(Math.PI / 2), M.meterBg, -0.028, YF + 0.5, z + 0.12, false);
      const bar = mesh(pduG, new THREE.PlaneGeometry(0.04, 0.38).translate(0, 0.19, 0).rotateY(Math.PI / 2), M.meter, -0.026, YF + 0.31, z + 0.12, false);
      pduMeters.push(bar);
      box(pduG, 2.32, 0.06, 0.08, M.busway, -1.27, YF + RH + 0.09, z);
    }
    {
      const iTap = inst(new THREE.BoxGeometry(0.08, 0.06, 0.1), M.cabinetDark, NRK, pduG, false);
      const iDrop = inst(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 6), M.cable, NRK, pduG, false);
      for (let r = 0; r < 2; r++) for (let i = 0; i < NR; i++) {
        setI(iTap, r * NR + i, rackX(i), YF + RH + 0.06, ROWZ[r]);
        setI(iDrop, r * NR + i, rackX(i), YF + RH + 0.03, ROWZ[r] + 0.03);
      }
    }
    ctx.pickable(pduG, () => showCard('pdu'));

    // Fibre trays over the cold-aisle side of each row, linked across the end.
    const fibreG = new THREE.Group();
    site.add(fibreG);
    const YT = YF + RH + 0.2;
    {
      const run = (len, x, z, alongX) => {
        const w = 0.11;
        const [sx, sz] = alongX ? [len, w] : [w, len];
        box(fibreG, sx, 0.01, sz, M.fibre, x, YT, z, false);
        for (const s of [-1, 1]) box(fibreG, alongX ? len : 0.008, 0.04, alongX ? 0.008 : len, M.fibre, x + (alongX ? 0 : s * w / 2), YT, z + (alongX ? s * w / 2 : 0), false);
        const bundle = mesh(fibreG, new THREE.CylinderGeometry(0.022, 0.022, len, 10), M.fibreCable, x, YT + 0.025, z, false);
        if (alongX) bundle.rotation.z = Math.PI / 2; else bundle.rotation.x = Math.PI / 2;
      };
      run(2.3, -1.4, 0.86, true);
      run(2.3, -1.4, -0.86, true);
      run(1.83, -2.5, 0, false);
      // drops into every rack's top-of-rack switch
      const iW = inst(new THREE.BoxGeometry(0.03, YT - (YF + RH), 0.012), M.fibreCable, NRK, fibreG, false);
      for (let r = 0; r < 2; r++) for (let i = 0; i < NR; i++) setI(iW, r * NR + i, rackX(i), (YT + YF + RH) / 2, FACE[r] * 0.74);
    }
    ctx.pickable(fibreG, () => showCard('fibre'));
    const dataPulse = pulses(fibreG, [
      [[-0.3, YT + 0.055, 0.86], [-2.5, YT + 0.055, 0.86], [-2.5, YT + 0.055, -0.86], [-0.3, YT + 0.055, -0.86]],
      [[-0.3, YT + 0.055, -0.86], [-2.5, YT + 0.055, -0.86], [-2.5, YT + 0.055, 0.86], [-0.3, YT + 0.055, 0.86]],
    ], 16, '#bff4ff', 0.018);

    // ── liquid cooling: CDU, headers in the hot aisle, rack manifolds, facility water ─────────
    const liquidG = new THREE.Group();
    site.add(liquidG);
    const cduG = new THREE.Group();
    site.add(cduG);
    box(cduG, 0.36, 0.8, 0.4, M.cabinet, 0.45, YF, -1.15);
    mesh(cduG, new THREE.PlaneGeometry(0.16, 0.09), M.screen, 0.45, YF + 0.65, -0.948, false);
    for (let j = 0; j < 2; j++) mesh(cduG, new THREE.CylinderGeometry(0.05, 0.05, 0.12, 16).rotateZ(Math.PI / 2), M.steel, 0.45, YF + 0.2 + j * 0.16, -0.94, false);
    ctx.pickable(cduG, () => showCard('cdu'));
    const cduLabel = label(hallLabels, 'CDU', 0.45, YF + 1.18, -1.15);
    const YS = 1.1, YR = 1.03, X_END = rackX(0) - 0.1;
    const kitL = pipeKit();
    kitL.add(M.cool, [[0.4, YF + 0.8, -1.15], [0.4, YS, -1.15], [0.4, YS, 0.06], [X_END, YS, 0.06]], 0.022);
    kitL.add(M.warm, [[X_END, YR, -0.06], [0.5, YR, -0.06], [0.5, YR, -1.15], [0.5, YF + 0.8, -1.15]], 0.022);
    for (let r = 0; r < 2; r++) for (let i = 0; i < NR; i++) {
      const x = rackX(i), zb = FACE[r] * 0.235;
      kitL.add(M.cool, [[x - 0.05, YS, 0.06], [x - 0.05, YS, zb], [x - 0.05, YF + 0.1, zb]], 0.009);
      kitL.add(M.warm, [[x + 0.05, YR, -0.06], [x + 0.05, YR, zb], [x + 0.05, YF + 0.1, zb]], 0.009);
    }
    kitL.build(liquidG);
    const coolPulse = pulses(liquidG, [[[0.4, YF + 0.8, -1.15], [0.4, YS, -1.15], [0.4, YS, 0.06], [X_END, YS, 0.06]]], 14, '#8fd0ff', 0.02);
    const warmPulse = pulses(liquidG, [[[X_END, YR, -0.06], [0.5, YR, -0.06], [0.5, YR, -1.15], [0.5, YF + 0.8, -1.15]]], 14, '#ffc08a', 0.02);
    ctx.pickable(liquidG, () => showCard('cdu'));

    // Facility water: CDU and CRAH coils ⇄ cooling tower.
    const TX = 2.4, TZ = -1.1;
    const facG = new THREE.Group();
    site.add(facG);
    const kitF = pipeKit();
    const facOut = [[0.63, 0.55, -1.2], [TX - 0.44, 0.55, -1.2]];          // warm water to the tower
    const facIn = [[TX - 0.44, 0.4, -1.05], [0.63, 0.4, -1.05]];           // cool water back
    const crahIn = [[TX - 0.44, 0.25, -1.4], [1.05, 0.25, -1.4], [1.05, 0.07, -1.62], [CRAH_X[0], 0.07, -1.62]];
    kitF.add(M.warm, facOut, 0.03);
    kitF.add(M.cool, facIn, 0.03);
    kitF.add(M.cool, crahIn, 0.028);
    kitF.build(facG);
    const facPulseW = pulses(facG, [facOut], 8, '#ffc08a', 0.026);
    const facPulseC = pulses(facG, [facIn, crahIn], 8, '#8fd0ff', 0.026);
    ctx.pickable(facG, () => showCard('tower'));

    // ── yard ─────────────────────────────────────────────────────────────────────────────────
    box(site, 2.3, 0.015, 3.35, M.asphalt, 2.12, 0, -0.1, false);

    // Cooling tower.
    const towerG = new THREE.Group();
    site.add(towerG);
    const fanRot = new THREE.Group();
    {
      const S = 0.82;
      box(towerG, S + 0.06, 0.1, S + 0.06, M.tower, TX, 0.015, TZ);
      mesh(towerG, new THREE.BoxGeometry(S - 0.02, 0.01, S - 0.02), M.water, TX, 0.11, TZ, false);
      box(towerG, S, 0.34, S, M.tower, TX, 0.5, TZ);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(towerG, 0.04, 0.4, 0.04, M.tower, TX + dx * (S / 2 - 0.02), 0.11, TZ + dz * (S / 2 - 0.02));
      const iL = inst(new THREE.BoxGeometry(S, 0.012, 0.05), M.louvre, 4 * 7, towerG, false);
      let n = 0;
      for (let side = 0; side < 4; side++) for (let j = 0; j < 7; j++) {
        const a = side * Math.PI / 2, y = 0.15 + j * 0.05;
        setI(iL, n++, TX + Math.sin(a) * (S / 2 - 0.01), y, TZ + Math.cos(a) * (S / 2 - 0.01), 1, 1, 1, 0.6, a, 0, 'YXZ');
      }
      box(towerG, S + 0.02, 0.03, S + 0.02, M.louvre, TX, 0.84, TZ, false);
      const stack = mesh(towerG, new THREE.CylinderGeometry(0.33, 0.3, 0.22, 40, 1, true), M.tower, TX, 0.98, TZ);
      stack.material = M.tower.clone();
      stack.material.side = THREE.DoubleSide;
      mesh(towerG, new THREE.TorusGeometry(0.33, 0.012, 8, 40).rotateX(Math.PI / 2), M.steel, TX, 1.09, TZ, false);
      fanRot.position.set(TX, 0.95, TZ);
      towerG.add(fanRot);
      mesh(fanRot, new THREE.CylinderGeometry(0.05, 0.05, 0.05, 16), M.dark, 0, 0, 0, false);
      for (let b = 0; b < 6; b++) {
        const bl = mesh(fanRot, new THREE.BoxGeometry(0.26, 0.008, 0.07), M.dark, 0, 0, 0, false);
        const a = (b / 6) * Math.PI * 2;
        bl.position.set(Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15);
        bl.rotation.set(0, -a, 0.3, 'YXZ');
      }
    }
    ctx.pickable(towerG, () => showCard('tower'));
    // Water vapour plume above the fan.
    const NM = 90;
    const mistPos = new Float32Array(NM * 3), mistV = new Float32Array(NM);
    for (let k = 0; k < NM; k++) {
      mistPos[k * 3] = TX + (Math.random() - 0.5) * 0.4; mistPos[k * 3 + 1] = 1.05 + Math.random(); mistPos[k * 3 + 2] = TZ + (Math.random() - 0.5) * 0.4;
      mistV[k] = 0.6 + Math.random() * 0.6;
    }
    const mistGeo = new THREE.BufferGeometry();
    mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPos, 3).setUsage(THREE.DynamicDrawUsage));
    const mistMat = new THREE.PointsMaterial({ size: 0.22, map: dotTex, color: 0xe6eef6, transparent: true, opacity: 0.18, depthWrite: false });
    const mist = new THREE.Points(mistGeo, mistMat);
    mist.frustumCulled = false;
    site.add(mist);

    // UPS room: UPS cabinets, battery cabinets with meters, switchgear.
    const upsG = new THREE.Group(), swG = new THREE.Group();
    site.add(upsG, swG);
    box(site, 1.0, 0.03, 1.1, M.slab, 1.65, 0, 0.95, false);
    box(site, 1.0, 0.75, 0.04, M.wall, 1.65, 0, 0.42);
    const batLeds = [], upsMeters = [];
    {
      const ledGeo = new THREE.BoxGeometry(0.012, 0.012, 0.01);
      for (let i = 0; i < 4; i++) {
        const x = 1.29 + i * 0.24, isUps = i < 2;
        box(upsG, 0.22, 0.62, 0.28, isUps ? M.cabinet : M.battery, x, 0.03, 0.6);
        if (isUps) {
          mesh(upsG, new THREE.PlaneGeometry(0.12, 0.07), M.screen, x, 0.52, 0.741, false);
          mesh(upsG, new THREE.PlaneGeometry(0.05, 0.3), M.meterBg, x, 0.24, 0.741, false);
          upsMeters.push(mesh(upsG, new THREE.PlaneGeometry(0.035, 0.28).translate(0, 0.14, 0), M.meter, x, 0.1, 0.743, false));
        } else {
          for (let j = 0; j < 5; j++) {
            const led = new THREE.Mesh(ledGeo, new THREE.MeshBasicMaterial({ color: 0x40ff70, toneMapped: false }));
            led.position.set(x - 0.08, 0.15 + j * 0.1, 0.746);
            upsG.add(led);
            batLeds.push(led);
            box(upsG, 0.16, 0.004, 0.005, M.dark, x + 0.02, 0.12 + j * 0.1, 0.742, false);
          }
        }
      }
      box(swG, 0.5, 0.5, 0.22, M.cabinetDark, 1.42, 0.03, 1.28);
      for (let j = 0; j < 3; j++) mesh(swG, new THREE.BoxGeometry(0.08, 0.1, 0.02), M.steel, 1.27 + j * 0.15, 0.36, 1.395, false);
    }
    ctx.pickable(upsG, () => showCard('ups'));
    ctx.pickable(swG, () => showCard('switchgear'));

    // Transformer on a gravel pad.
    const trG = new THREE.Group();
    site.add(trG);
    const poleG = new THREE.Group();
    site.add(poleG);
    ctx.pickable(poleG, () => showCard('utility'));
    const TRX = 2.7, TRZ = 1.0;
    {
      box(trG, 0.75, 0.02, 0.6, M.gravel, TRX, 0.015, TRZ, false);
      box(trG, 0.36, 0.42, 0.3, M.transformer, TRX, 0.04, TRZ);
      const iFin = inst(new THREE.BoxGeometry(0.1, 0.34, 0.008), M.transformer, 2 * 7, trG, false);
      for (let s = 0; s < 2; s++) for (let j = 0; j < 7; j++) setI(iFin, s * 7 + j, TRX + (s ? 1 : -1) * 0.23, 0.25, TRZ - 0.12 + j * 0.04);
      mesh(trG, new THREE.CylinderGeometry(0.05, 0.05, 0.3, 20).rotateZ(Math.PI / 2), M.transformer, TRX, 0.55, TRZ - 0.1);
      const disc = new THREE.CylinderGeometry(0.028, 0.028, 0.012, 16);
      const iDisc = inst(disc, M.porcelain, 3 * 6, trG, false);
      for (let b = 0; b < 3; b++) {
        mesh(trG, new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8), M.porcelain, TRX - 0.1 + b * 0.1, 0.56, TRZ + 0.06, false);
        for (let j = 0; j < 6; j++) setI(iDisc, b * 6 + j, TRX - 0.1 + b * 0.1, 0.48 + j * 0.028, TRZ + 0.06);
      }
      // utility pole and lines
      const PX = 3.25, PZ = 1.75;
      mesh(poleG, new THREE.CylinderGeometry(0.03, 0.04, 1.3, 12).translate(0, 0.65, 0), M.wood, PX, 0, PZ);
      mesh(poleG, new THREE.BoxGeometry(0.5, 0.04, 0.05).rotateY(-0.6), M.wood, PX, 1.18, PZ);
      const kitP = pipeKit();
      for (let b = 0; b < 3; b++) {
        const t = (b - 1) * 0.2;
        const ax = PX + Math.cos(0.6) * t, az = PZ + Math.sin(0.6) * t;
        mesh(poleG, new THREE.CylinderGeometry(0.012, 0.016, 0.06, 8), M.porcelain, ax, 1.23, az, false);
        const bx = TRX - 0.1 + b * 0.1, bz = TRZ + 0.06;
        kitP.add(M.dark, [[ax, 1.26, az], [(ax + bx) / 2, 0.92, (az + bz) / 2], [bx, 0.66, bz]], 0.006);
      }
      kitP.build(poleG);
    }
    ctx.pickable(trG, () => showCard('transformer'));

    // Generator.
    const genG = new THREE.Group();
    site.add(genG);
    const GX = 2.62, GZ = 0.05;
    const genLed = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.01), new THREE.MeshBasicMaterial({ color: 0x40ff70, toneMapped: false }));
    {
      box(genG, 0.95, 0.07, 0.42, M.dark, GX, 0.015, GZ);
      const body = box(genG, 0.92, 0.42, 0.4, M.gen, GX, 0.085, GZ);
      genG.userData.body = body;
      const iS = inst(new THREE.BoxGeometry(0.008, 0.02, 0.3), M.louvre, 2 * 8, genG, false);
      for (let s = 0; s < 2; s++) for (let j = 0; j < 8; j++) setI(iS, s * 8 + j, GX + (s ? 1 : -1) * 0.462, 0.15 + j * 0.04, GZ, 1, 1, 1, 0, 0, 0);
      for (let j = 0; j < 3; j++) box(genG, 0.004, 0.36, 0.006, M.dark, GX - 0.3 + j * 0.3, 0.11, GZ + 0.201, false);
      mesh(genG, new THREE.CylinderGeometry(0.035, 0.035, 0.32, 14), M.steel, GX + 0.3, 0.66, GZ - 0.1);
      mesh(genG, new THREE.CylinderGeometry(0.05, 0.035, 0.03, 14), M.steel, GX + 0.3, 0.83, GZ - 0.1, false);
      genLed.position.set(GX - 0.35, 0.42, GZ + 0.205);
      genG.add(genLed);
    }
    ctx.pickable(genG, () => showCard('generator'));

    // Power cables and the flow of power.
    const pwrG = new THREE.Group();
    site.add(pwrG);
    const gridPath = [[TRX - 0.15, 0.25, TRZ + 0.16], [TRX - 0.15, 0.25, 1.42], [1.7, 0.25, 1.42], [1.7, 0.25, 1.29]];
    const genPath = [[GX - 0.3, 0.12, GZ + 0.21], [GX - 0.3, 0.12, 0.3], [2.25, 0.12, 0.3], [2.25, 0.12, 1.28], [1.7, 0.12, 1.28]];
    const upsIn = [[1.42, 0.53, 1.28], [1.42, 0.7, 1.05], [1.42, 0.7, 0.75]];
    const feedA = [[1.33, 0.65, 0.6], [1.33, 1.32, 0.6], [0.95, 1.32, 0.6], [-0.13, 1.32, 0.6], [-0.13, YF + 0.95, 0.6]];
    const feedB = [[1.38, 0.65, 0.6], [1.38, 1.36, 0.6], [0.95, 1.36, 0.6], [-0.06, 1.36, 0.6], [-0.06, 1.36, -0.5], [-0.06, YF + 0.95, -0.5]];
    const busA = [[-0.2, YF + RH + 0.13, ROWZ[0]], [-2.4, YF + RH + 0.13, ROWZ[0]]];
    const busB = [[-0.2, YF + RH + 0.13, ROWZ[1]], [-2.4, YF + RH + 0.13, ROWZ[1]]];
    {
      const kit = pipeKit();
      for (const p of [gridPath, genPath, upsIn, feedA, feedB]) kit.add(M.cable, p, 0.016);
      kit.build(pwrG);
    }
    const gridPulse = pulses(pwrG, [[[3.25 - 0.05, 1.26, 1.75], [TRX, 0.66, TRZ + 0.06]], gridPath, upsIn], 7, '#ffc24a', 0.024);
    const genPulse = pulses(pwrG, [genPath, upsIn], 7, '#ffc24a', 0.024);
    const feedPulse = pulses(pwrG, [feedA, feedB, busA, busB], 8, '#ffc24a', 0.022);
    genPulse.im.visible = false;
    ctx.pickable(pwrG, () => showCard('pdu'));

    // ── airflow particles ────────────────────────────────────────────────────────────────────
    const NA = 950, K = 12;
    const wp = new Float32Array(NA * K * 3), cum = new Float32Array(NA * K);
    const apos = new Float32Array(NA * 3), acol = new Float32Array(NA * 3);
    const aS = new Float32Array(NA), aSeg = new Uint8Array(NA), aV = new Float32Array(NA);
    for (let n = 0; n < NA; n++) {
      const r = n % 2, f = FACE[r];
      const x = rackX(0) - 0.12 + Math.random() * (RW * NR - 0.06);
      const cx = x < -1.35 ? CRAH_X[0] : CRAH_X[1];
      const jx = (Math.random() - 0.5) * 0.25, jz = (Math.random() - 0.5) * 0.08;
      const ys = YF + 0.08 + Math.random() * 0.82;
      const pts = [
        [cx + jx, 0.08, -1.34],
        [x, 0.08, f * 1.0 + jz],
        [x, YF + 0.14, f * 1.0 + jz],
        [x, ys, f * 0.77],
        [x, ys, f * 0.23],
        [x, YF + RH - 0.12, f * 0.06],
        [cx + jx * 0.6, YF + RH + 0.05, jz],
        [cx + jx * 0.6, 1.66, jz],
        [cx + jx * 0.6, 1.66, -1.55],
        [cx + jx * 0.8, YF + 1.05, -1.55],
        [cx + jx * 0.8, 0.08, -1.55],
        [cx + jx, 0.08, -1.34],
      ];
      for (let i = 0; i < K; i++) {
        const o = (n * K + i) * 3;
        wp[o] = pts[i][0]; wp[o + 1] = pts[i][1]; wp[o + 2] = pts[i][2];
        if (i) cum[n * K + i] = cum[n * K + i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]);
      }
      aS[n] = Math.random() * cum[n * K + K - 1];
      aV[n] = 0.8 + Math.random() * 0.4;
    }
    const airGeo = new THREE.BufferGeometry();
    airGeo.setAttribute('position', new THREE.BufferAttribute(apos, 3).setUsage(THREE.DynamicDrawUsage));
    airGeo.setAttribute('color', new THREE.BufferAttribute(acol, 3).setUsage(THREE.DynamicDrawUsage));
    const air = new THREE.Points(airGeo, new THREE.PointsMaterial({ size: 0.1, map: dotTex, vertexColors: true, transparent: true, alphaTest: 0.05, depthWrite: false, toneMapped: false }));
    air.frustumCulled = false;
    air.renderOrder = 3;
    site.add(air);
    const COLD = new THREE.Color('#3aa0ff'), HOT = new THREE.Color('#ff7a2a'), hotNow = new THREE.Color();

    // ── hall labels ──────────────────────────────────────────────────────────────────────────
    const lCold = label(hallLabels, 'Cold aisle', -1.35, YF + 0.35, 1.12, '#9fd2ff');
    const lHot = label(hallLabels, 'Hot aisle', -1.35, YF + RH + 0.12, 0, '#ffb27a');
    label(hallLabels, 'CRAH units', -1.35, 1.95, -1.55);
    label(hallLabels, 'Network rack', rackX(0) - 0.05, YF + RH + 0.42, 0.62, '#9ff0ff', 0.6);
    label(hallLabels, 'PDUs', -0.13, YF + 1.05, 0.25, '#ffd58a', 0.6);
    const lUps = label(hallLabels, 'UPS + batteries', 1.65, 0.92, 0.6, '#ffd58a');
    label(hallLabels, 'Transformer', TRX + 0.1, 0.72, TRZ - 0.3, '#ffd58a');
    label(hallLabels, 'Utility feed', 3.25, 1.95, 1.75, '#ffd58a', 0.6);
    const lGen = label(hallLabels, 'Generator · standby', GX, 0.98, GZ, '#ffd58a');
    label(hallLabels, 'Cooling tower', TX, 1.32, TZ, '#9fd2ff');
    label(hallLabels, 'Fibre', -2.5, YT + 0.16, 0, '#ffe27a', 0.58);

    // ════════════════════════════════════════════════════════════════════════════════════════
    // INSIDE ONE SERVER: an 8-GPU tray at large scale.
    // ════════════════════════════════════════════════════════════════════════════════════════
    const srv = new THREE.Group();
    srv.visible = false;
    root.add(srv);
    const Y0 = 0.33;                         // top of the board
    const GXS = [-1.2, -0.4, 0.4, 1.2], GZS = [-0.42, 0.42];
    const GPUS = [];
    for (const gz of GZS) for (const gx of GXS) GPUS.push([gx, gz]);
    const SWX = [-1.2, -0.4, 0.4, 1.2], SWZ = -0.98;
    {
      box(srv, 3.5, 0.04, 2.5, M.chassis, 0, 0.26, 0);
      box(srv, 3.5, 0.14, 0.03, M.chassis, 0, 0.26, -1.235);
      for (const s of [-1, 1]) box(srv, 0.03, 0.14, 2.5, M.chassis, s * 1.735, 0.26, 0);
      for (const s of [-1, 1]) box(srv, 3.0, 0.26, 0.1, M.dark, 0, 0, s * 0.9);
      box(srv, 3.4, 0.03, 2.38, M.pcb, 0, 0.3, -0.03, false);
    }
    // GPUs: module board, package, die, HBM stacks.
    const gpuG = new THREE.Group();
    srv.add(gpuG);
    {
      const iSub = inst(new THREE.BoxGeometry(0.62, 0.03, 0.66), M.sub, 8, gpuG);
      const iPkg = inst(new THREE.BoxGeometry(0.44, 0.02, 0.44), M.pkg, 8, gpuG);
      const iDie = inst(new THREE.BoxGeometry(0.2, 0.014, 0.26), M.die, 8, gpuG);
      const iHbm = inst(new THREE.BoxGeometry(0.07, 0.022, 0.09), M.hbm, 48, gpuG);
      const iCon = inst(new THREE.BoxGeometry(0.5, 0.04, 0.06), M.dark, 16, gpuG, false);
      GPUS.forEach(([gx, gz], g) => {
        setI(iCon, g * 2, gx, Y0 + 0.02, gz - 0.2); setI(iCon, g * 2 + 1, gx, Y0 + 0.02, gz + 0.2);
        setI(iSub, g, gx, Y0 + 0.055, gz);
        setI(iPkg, g, gx, Y0 + 0.08, gz);
        setI(iDie, g, gx, Y0 + 0.097, gz);
        let h = 0;
        for (const sx of [-1, 1]) for (let j = -1; j <= 1; j++) setI(iHbm, g * 6 + h++, gx + sx * 0.155, Y0 + 0.1, gz + j * 0.11);
      });
    }
    ctx.pickable(gpuG, () => showCard('gpu'));
    // Switch chips and links.
    const swG2 = new THREE.Group();
    srv.add(swG2);
    {
      const iSw = inst(new THREE.BoxGeometry(0.22, 0.02, 0.22), M.pkg, 4, swG2);
      const iLid = inst(new THREE.BoxGeometry(0.15, 0.03, 0.15), M.steel, 4, swG2);
      SWX.forEach((x, i) => { setI(iSw, i, x, Y0 + 0.01, SWZ); setI(iLid, i, x, Y0 + 0.035, SWZ); });
      const iTr = inst(new THREE.BoxGeometry(1, 0.003, 0.014), M.trace, 32, swG2, false);
      let n = 0;
      for (const [gx, gz] of GPUS) for (const sx of SWX) {
        const dx = sx - gx, dz = SWZ - gz, len = Math.hypot(dx, dz);
        setI(iTr, n++, (gx + sx) / 2, Y0 + 0.003, (gz + SWZ) / 2, len, 1, 1, 0, -Math.atan2(dz, dx), 0);
      }
    }
    ctx.pickable(swG2, () => showCard('switch'));
    const linkPaths = [];
    GPUS.forEach(([gx, gz], g) => SWX.forEach((sx, s) => {
      const a = [gx, Y0 + 0.012, gz], b = [sx, Y0 + 0.012, SWZ];
      linkPaths.push((g + s) % 2 ? [a, b] : [b, a]);
    }));
    const linkPulse = pulses(srv, linkPaths, 2, '#c8f0ff', 0.016);
    // Network cards at the rear.
    const nicG = new THREE.Group();
    srv.add(nicG);
    {
      const iCage = inst(new THREE.BoxGeometry(0.14, 0.07, 0.12), M.steel, 8, nicG);
      const iPort = inst(new THREE.PlaneGeometry(0.1, 0.04), M.led, 8, nicG, false);
      const iFib = inst(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 8).rotateX(Math.PI / 2), M.fibre, 8, nicG, false);
      for (let i = 0; i < 8; i++) {
        const x = -1.4 + i * 0.4;
        setI(iCage, i, x, Y0 + 0.035, -1.16);
        setI(iPort, i, x, Y0 + 0.035, -1.222, 1, 1, 1, 0, Math.PI);
        iPort.setColorAt(i, _c.setRGB(0.4, 0.9, 1.0));
        setI(iFib, i, x, Y0 + 0.035, -1.37);
      }
    }
    ctx.pickable(nicG, () => showCard('nic'));
    // Fans across the front.
    const fanG = new THREE.Group();
    srv.add(fanG);
    const NF = 6, FB = 7, fanX = (i) => -1.45 + i * 0.58, fanY = Y0 + 0.17, fanZ = 1.1;
    const iBlade = inst(new THREE.BoxGeometry(0.11, 0.04, 0.006), M.fan, NF * FB, fanG, false);
    iBlade.frustumCulled = false;
    {
      const iShroud = inst(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 28, 1, true).rotateX(Math.PI / 2), M.fan, NF, fanG);
      const iFrame = inst(new THREE.BoxGeometry(0.36, 0.36, 0.015), M.dark, NF * 1, fanG);
      const iHub = inst(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 18).rotateX(Math.PI / 2), M.dark, NF, fanG, false);
      for (let i = 0; i < NF; i++) {
        setI(iShroud, i, fanX(i), fanY, fanZ);
        setI(iFrame, i, fanX(i), fanY, fanZ - 0.045, 1, 1, 0.3);
        setI(iHub, i, fanX(i), fanY, fanZ);
      }
    }
    ctx.pickable(fanG, () => showCard('fans'));
    // Air-cooling heat sinks.
    const sinkG = new THREE.Group();
    srv.add(sinkG);
    {
      const iBase = inst(new THREE.BoxGeometry(0.5, 0.03, 0.58), M.copper, 8, sinkG);
      const iFin = inst(new THREE.BoxGeometry(0.01, 0.34, 0.58), M.fin, 8 * 13, sinkG);
      GPUS.forEach(([gx, gz], g) => {
        setI(iBase, g, gx, Y0 + 0.125, gz);
        for (let j = 0; j < 13; j++) setI(iFin, g * 13 + j, gx - 0.24 + j * 0.04, Y0 + 0.31, gz);
      });
    }
    ctx.pickable(sinkG, () => showCard('heatsink'));
    // Liquid cold plates, hoses and headers.
    const plateG = new THREE.Group();
    srv.add(plateG);
    const hoseSup = [], hoseRet = [];
    {
      const iPl = inst(new THREE.BoxGeometry(0.46, 0.05, 0.5), M.copper, 8, plateG);
      const iCov = inst(new THREE.BoxGeometry(0.4, 0.025, 0.42), M.plateCover, 8, plateG, false);
      GPUS.forEach(([gx, gz], g) => { setI(iPl, g, gx, Y0 + 0.135, gz); setI(iCov, g, gx, Y0 + 0.17, gz); });
      const kit = pipeKit();
      const HS = Y0 + 0.42, HR = Y0 + 0.52, ZS = -0.03, ZR = 0.03;
      GPUS.forEach(([gx, gz]) => {
        const s = [[gx - 0.1, Y0 + 0.18, gz], [gx - 0.1, HS, gz], [gx - 0.1, HS, ZS]];
        const r = [[gx + 0.1, HR, ZR], [gx + 0.1, HR, gz], [gx + 0.1, Y0 + 0.18, gz]];
        kit.add(M.cool, s, 0.022); kit.add(M.warm, r, 0.022);
        hoseSup.push([[1.62, HS, ZS], [gx - 0.1, HS, ZS], ...s.slice().reverse().slice(1)]);
        hoseRet.push([[gx + 0.1, Y0 + 0.18, gz], [gx + 0.1, HR, gz], [gx + 0.1, HR, ZR], [1.68, HR, ZR], [1.68, HR, -1.15]]);
      });
      kit.add(M.cool, [[GXS[0] - 0.1, HS, ZS], [1.62, HS, ZS], [1.62, HS, -1.15], [1.62, Y0 + 0.1, -1.15]], 0.032);
      kit.add(M.warm, [[GXS[0] + 0.1, HR, ZR], [1.68, HR, ZR], [1.68, HR, -1.15], [1.68, Y0 + 0.1, -1.15]], 0.032);
      kit.build(plateG);
    }
    const plateSupPulse = pulses(plateG, hoseSup, 3, '#8fd0ff', 0.022);
    const plateRetPulse = pulses(plateG, hoseRet, 3, '#ffc08a', 0.022);
    ctx.pickable(plateG, () => showCard('plate'));
    // Matrix-multiply tiles hovering over each GPU: every tile of C = A × B is computed at once.
    const TN = 6;
    const iTile = inst(new THREE.BoxGeometry(0.052, 0.01, 0.052), M.tile, 8 * TN * TN, srv, false);
    iTile.frustumCulled = false;
    GPUS.forEach(([gx, gz], g) => {
      for (let i = 0; i < TN; i++) for (let j = 0; j < TN; j++) {
        setI(iTile, (g * TN + i) * TN + j, gx + (i - (TN - 1) / 2) * 0.064, 1.02, gz + (j - (TN - 1) / 2) * 0.064);
        iTile.setColorAt((g * TN + i) * TN + j, _c.setRGB(0.2, 0.4, 0.7));
      }
    });
    const srvLabels = new THREE.Group();
    srv.add(srvLabels);
    label(srvLabels, 'GPU × 8', GXS[0], 1.22, GZS[1], '#9fd2ff');
    label(srvLabels, 'C = A × B: all tiles at once', GXS[2], 1.22, GZS[1], '#cfe6ff', 0.6);
    label(srvLabels, 'Switch chips: GPU ↔ GPU links', 0.4, Y0 + 0.24, SWZ - 0.05, '#c8f0ff', 0.58);
    label(srvLabels, 'Network ports → fibre', -1.4, Y0 + 0.2, -1.3, '#ffe27a', 0.58);
    label(srvLabels, 'Fans', fanX(5), fanY + 0.28, fanZ, '#d6e4f7', 0.58);
    const lCooler = label(srvLabels, 'Cold plates: coolant in / out', 1.68, Y0 + 0.72, -0.6, '#ffc08a', 0.58);

    // ════════════════════════════════════════════════════════════════════════════════════════
    // STATE, ESTIMATOR, PANEL
    // ════════════════════════════════════════════════════════════════════════════════════════
    const nearest = (opts, v) => { let b = 0; for (let i = 1; i < opts.length; i++) if (Math.abs(Math.log(opts[i] / v)) < Math.abs(Math.log(opts[b] / v))) b = i; return b; };
    const qn = (k, def) => { const v = parseFloat(qs.get(k)); return Number.isFinite(v) && v > 0 ? v : def; };
    const pct = (v) => (v > 1 ? v / 100 : v);
    const S = {
      view: qs.get('view') === 'server' ? 'server' : 'hall',
      mode: ['idle', 'train', 'infer'].includes(qs.get('mode')) ? qs.get('mode') : 'train',
      cool: qs.get('cool') === 'air' ? 'air' : 'liquid',
      bare: qs.has('bare'),
      n: nearest(N_OPTS, qn('n', 70e9)), d: nearest(D_OPTS, qn('d', 1.4e12)), g: nearest(G_OPTS, qn('gpus', 4096)),
      peak: nearest(PEAK_OPTS, qn('peak', 1e15)),
      mfu: Math.min(0.7, Math.max(0.05, pct(qn('mfu', 40)))),
      pw: Math.min(2, Math.max(0.3, qn('pw', 1.0))),
      pue: Math.min(2, Math.max(1.05, qn('pue', 1.2))),
      inf: Math.min(0.6, Math.max(0.05, pct(qn('inf', 20)))),
      outage: qs.has('outage'), tOut: qn('outage', 0),
    };
    let act = 0.5, actTarget = 0.5, tExh = 36, tRet = 40, lastLoad = -1, lastTemps = '', lastPhase = '';

    function showCard(id) {
      const [kind, title, body] = CARDS[id];
      let extra = '';
      if (id === 'cdu') extra = `<p class="muted">Now (illustrative): coolant to chips ≈ ${T_COOLANT} °C, back ≈ ${Math.round(tRet)} °C.</p>`;
      if (id === 'crah' || id === 'containment') extra = `<p class="muted">Now (illustrative): cold aisle ≈ ${T_IN} °C, hot aisle ≈ ${Math.round(tExh)} °C.</p>`;
      if (id === 'ups') extra = `<p class="muted">Your cluster’s IT load at full training power: ≈ ${fmtPower(G_OPTS[S.g] * S.pw)}.</p>`;
      ctx.card(title, body + extra, { kind });
    }

    // number formatting
    const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
    const sup = (e) => String(e).split('').map((ch) => (ch === '-' ? '⁻' : SUP[+ch])).join('');
    function sci(x, d = 1) {
      if (!(x > 0)) return '0';
      let e = Math.floor(Math.log10(x)), m = x / 10 ** e;
      if (+m.toFixed(d) >= 10) { m /= 10; e++; }
      return `${m.toFixed(d)}×10${sup(e)}`;
    }
    const p3 = (v) => (v >= 100 ? Math.round(v).toLocaleString('en-US') : v >= 10 ? v.toFixed(1) : v.toFixed(2));
    const count = (n) => (n >= 1e12 ? `${+(n / 1e12).toPrecision(3)} trillion` : n >= 1e9 ? `${+(n / 1e9).toPrecision(3)} billion` : n.toLocaleString('en-US'));
    const short = (n) => (n >= 1e12 ? `${+(n / 1e12).toPrecision(3)} T` : n >= 1e9 ? `${+(n / 1e9).toPrecision(3)} B` : n.toLocaleString('en-US'));
    function fmtDur(s) {
      const h = s / 3600;
      if (h < 1) return `${p3(s / 60)} minutes`;
      if (h < 48) return `${p3(h)} hours`;
      const d = h / 24;
      if (d < 365) return `${p3(d)} days`;
      return `${p3(d / 365.25)} years`;
    }
    const fmtEnergy = (kWh) => (kWh >= 1e6 ? `${p3(kWh / 1e6)} GWh` : kWh >= 1e3 ? `${p3(kWh / 1e3)} MWh` : `${p3(kWh)} kWh`);
    const fmtPower = (kW) => (kW >= 1e3 ? `${p3(kW / 1e3)} MW` : `${p3(kW)} kW`);

    function recompute() {
      const N = N_OPTS[S.n], D = D_OPTS[S.d], G = G_OPTS[S.g], peak = PEAK_OPTS[S.peak];
      const C = 6 * N * D;
      const rate = G * peak * S.mfu;                 // achieved FLOP/s
      const t = C / rate;                             // s
      const itKW = G * S.pw, facKW = itKW * S.pue;
      const itKWh = itKW * t / 3600, facKWh = itKWh * S.pue;
      rC.set(`≈ ${sci(C)} FLOPs`);
      rT.set(`≈ ${fmtDur(t)}`);
      rGH.set(`≈ ${sci(G * t / 3600, 2)} GPU-hours`);
      rPw.set(`IT ≈ ${fmtPower(itKW)} · facility ≈ ${fmtPower(facKW)}`);
      rEit.set(`≈ ${fmtEnergy(itKWh)}`);
      rEf.set(`≈ ${fmtEnergy(facKWh)}`);
      rHomes.set(`≈ ${p3(facKWh / HOME_KWH)} homes`);
      nCalc.set(
        `<b>C</b> = 6 × ${sci(N)} × ${sci(D)} = <b>${sci(C)}</b> FLOPs<br>` +
        `<b>t</b> = ${sci(C)} ÷ (${G.toLocaleString('en-US')} × ${sci(peak)} FLOP/s × ${S.mfu.toFixed(2)}) = ${sci(t)} s = <b>${fmtDur(t)}</b><br>` +
        `<b>E<sub>IT</sub></b> = ${G.toLocaleString('en-US')} × ${S.pw.toFixed(2)} kW × ${p3(t / 3600)} h = <b>${fmtEnergy(itKWh)}</b><br>` +
        `<b>E<sub>facility</sub></b> = ${fmtEnergy(itKWh)} × ${S.pue.toFixed(2)} = <b>${fmtEnergy(facKWh)}</b><br>` +
        `Homes = ${fmtEnergy(facKWh)} ÷ ${HOME_KWH.toLocaleString('en-US')} kWh per home per year (approx. US average).`);
      // inference
      const tps = G * peak * S.inf / (2 * N);
      const jPerTok = facKW * 1000 / tps;
      rTps.set(`≈ ${sci(tps, 2)} tokens/s`);
      rTok.set(`≈ ${p3(jPerTok * 1000 / 3600)} Wh`);
      nInf.set(`tokens/s = GPUs × peak × utilisation ÷ (2·N) = ${G.toLocaleString('en-US')} × ${sci(peak)} × ${S.inf.toFixed(2)} ÷ (2 × ${sci(N)}). Energy per token = facility power ÷ tokens/s = ${p3(jPerTok)} J. Real serving is often limited by memory bandwidth, not arithmetic, so treat this as a rough upper estimate.`);
      nPue.set(`PUE ${S.pue.toFixed(2)}: for every 1 kW reaching the computers, another ${(S.pue - 1).toFixed(2)} kW goes to cooling, power conversion and lighting. Here: ${fmtPower(facKW)} ÷ ${fmtPower(itKW)} = ${S.pue.toFixed(2)}.`);
      actTarget = S.mode === 'idle' ? 0.05 : Math.min(1, 0.1 + 1.3 * (S.mode === 'train' ? S.mfu : S.inf));
    }

    function applyView(instant, moveCam = true) {
      const server = S.view === 'server';
      site.visible = !server;
      srv.visible = server;
      ctx.hideCard();
      if (!moveCam) return;
      if (server) ctx.view({ yaw: 0.42, pitch: 0.74, dist: 7.6, target: [0, 0.6, 0.05] }, instant);
      else ctx.view({ yaw: 0.55, pitch: 0.58, dist: 9.2, target: [0, 0.7, 0] }, instant);
    }
    function applyCooling() {
      const liquid = S.cool === 'liquid';
      liquidG.visible = liquid; cduG.visible = liquid;
      cduLabel.s.visible = liquid;
      sinkG.visible = !liquid && !S.bare;
      plateG.visible = liquid && !S.bare;
      setLabel(lCooler, S.bare ? 'Coolers lifted off: GPU dies + HBM' : liquid ? 'Cold plates: coolant in / out' : 'Heat sinks (air cooling)');
    }

    // ── panel ────────────────────────────────────────────────────────────────────────────────
    ui.heading('Explore');
    const cView = ui.choice('View', { options: [{ value: 'hall', label: 'Data hall' }, { value: 'server', label: 'Inside one server' }], value: S.view, onChange: (v) => { S.view = v; applyView(false); } });
    ui.choice('The cluster is', { options: [{ value: 'idle', label: 'Idle' }, { value: 'train', label: 'Training' }, { value: 'infer', label: 'Serving' }], value: S.mode, onChange: (v) => { S.mode = v; recompute(); } });
    ui.choice('GPU cooling', { options: [{ value: 'air', label: 'Air only' }, { value: 'liquid', label: 'Liquid + air' }], value: S.cool, onChange: (v) => { S.cool = v; applyCooling(); } });
    ui.toggle('Lift coolers off the GPUs (server view)', { value: S.bare, onChange: (v) => { S.bare = v; applyCooling(); } });
    const tLabels = ui.toggle('Labels', { value: qs.get('labels') !== '0', onChange: (v) => { hallLabels.visible = srvLabels.visible = v; } });
    ui.toggle('Airflow particles', { value: qs.get('air') !== '0', onChange: (v) => (air.visible = v) });
    ui.button('Simulate a grid outage', () => { S.outage = !S.outage; S.tOut = 0; if (!S.outage) ctx.toast('Grid power restored.', 'good'); });
    const rTemps = ui.readout('Air: cold → hot aisle');
    const rCoolant = ui.readout('Coolant to chips → back');
    const rLoad = ui.readout('IT power draw');
    const nOut = ui.note('Click any rack, unit or pipe for a card about it. Temperatures and the power meter are illustrative.');

    ui.heading('AI training estimator');
    ui.note('<b>Assumptions</b> (change them). Every result is a rough estimate.');
    ui.slider('Model parameters N', { min: 0, max: N_OPTS.length - 1, step: 1, value: S.n, fmt: (v) => short(N_OPTS[v]), onChange: (v) => { S.n = v; recompute(); } });
    ui.slider('Training tokens D', { min: 0, max: D_OPTS.length - 1, step: 1, value: S.d, fmt: (v) => short(D_OPTS[v]), onChange: (v) => { S.d = v; recompute(); } });
    ui.slider('Number of GPUs', { min: 0, max: G_OPTS.length - 1, step: 1, value: S.g, fmt: (v) => G_OPTS[v].toLocaleString('en-US'), onChange: (v) => { S.g = v; recompute(); } });
    ui.slider('Peak speed per GPU (approx., low precision)', { min: 0, max: PEAK_OPTS.length - 1, step: 1, value: S.peak, fmt: (v) => `${sci(PEAK_OPTS[v])} FLOP/s`, onChange: (v) => { S.peak = v; recompute(); } });
    ui.slider('Utilisation, MFU', { min: 0.05, max: 0.7, step: 0.01, value: S.mfu, fmt: (v) => `${Math.round(v * 100)}%`, onChange: (v) => { S.mfu = v; recompute(); } });
    ui.slider('Power per GPU incl. its share of the server', { min: 0.3, max: 2, step: 0.05, value: S.pw, fmt: (v) => `${v.toFixed(2)} kW`, onChange: (v) => { S.pw = v; recompute(); } });
    ui.slider('PUE', { min: 1.05, max: 2, step: 0.01, value: S.pue, fmt: (v) => v.toFixed(2), onChange: (v) => { S.pue = v; recompute(); } });
    const rC = ui.readout('Training compute C');
    const rT = ui.readout('Training time');
    const rGH = ui.readout('GPU time');
    const rPw = ui.readout('Power while training');
    const rEit = ui.readout('IT energy');
    const rEf = ui.readout('Facility energy');
    const rHomes = ui.readout('≈ US homes’ electricity for a year');
    const nCalc = ui.note('');
    ui.heading('Serving the model (inference)');
    ui.slider('Utilisation while serving', { min: 0.05, max: 0.6, step: 0.01, value: S.inf, fmt: (v) => `${Math.round(v * 100)}%`, onChange: (v) => { S.inf = v; recompute(); } });
    const rTps = ui.readout('Throughput');
    const rTok = ui.readout('Facility energy per 1,000 tokens');
    const nInf = ui.note('');
    ui.heading('PUE = facility power ÷ IT power');
    const nPue = ui.note('');
    void cView; void tLabels;

    hallLabels.visible = srvLabels.visible = qs.get('labels') !== '0';
    air.visible = qs.get('air') !== '0';
    recompute();
    act = actTarget;
    { const pf0 = 0.3 + 0.7 * act; tExh = T_IN + (S.cool === 'air' ? 3 + 15 * pf0 : 2 + 7 * pf0); tRet = T_COOLANT + 10 * pf0; }
    applyCooling();
    applyView(snap, S.view === 'server'); // the hall view is the lesson default, already set by the app
    if (qs.has('pick') && CARDS[qs.get('pick')]) showCard(qs.get('pick'));

    // ── animation ────────────────────────────────────────────────────────────────────────────
    const FRONT_BASE = new THREE.Color(0.38, 0.66, 1.0), FRONT_NET = new THREE.Color(0.3, 0.95, 1.0);
    function updateHall(dt, t, pf) {
      // Rack fronts and LEDs. Training: all servers compute in lockstep, then pause to exchange results
      // over the network; serving: each server works on its own bursts of requests.
      const stepPhase = (t * 0.9) % 1, computing = stepPhase < 0.78;
      for (let k = 0; k < NRK; k++) {
        const net = k % NR === 0;
        for (let j = 0; j < TRAYS; j++) {
          const n = k * TRAYS + j, h1 = trayH1[n], h2 = trayH2[n];
          let b;
          if (S.mode === 'idle') b = 0.1 + 0.03 * Math.sin(t * 0.8 + h1 * 6);
          else if (S.mode === 'train') b = net ? (computing ? 0.25 : 1.1) * (0.4 + act) : 0.12 + act * (computing ? 1.0 : 0.4);
          else b = 0.12 + act * (Math.sin(t * (1.5 + h1 * 3) + h2 * 6.28) > 0.1 ? 1.1 : 0.35);
          const base = net ? FRONT_NET : FRONT_BASE;
          iFront.setColorAt(n, _c.setRGB(base.r * b, base.g * b, base.b * b));
          const blink = Math.sin(t * (4 + h1 * 9) * (0.3 + act) + h2 * 20) > 0.2 - act * 0.5;
          const onBattery = S.outage && S.tOut < 6;
          iLed.setColorAt(n * 2, onBattery ? _c.setRGB(1, 0.6, 0.1) : _c.setRGB(0.2, 1, 0.4));
          iLed.setColorAt(n * 2 + 1, blink && S.mode !== 'idle' ? _c.setRGB(0.4, 0.9, 1.2) : _c.setRGB(0.03, 0.08, 0.12));
        }
      }
      iFront.instanceColor.needsUpdate = true;
      iLed.instanceColor.needsUpdate = true;

      // Airflow particles.
      if (air.visible) {
        const t01 = Math.min(1, Math.max(0, (tExh - T_IN) / 22));
        hotNow.setRGB(1, 0.85 - 0.5 * t01, 0.45 - 0.35 * t01);
        const v = (0.3 + 0.9 * pf) * (S.cool === 'air' ? 1.3 : 1.0) * dt;
        for (let n = 0; n < NA; n++) {
          const base = n * K, L = cum[base + K - 1];
          let s = aS[n] + v * aV[n], seg = aSeg[n];
          if (s >= L) { s -= L; seg = 0; }
          while (seg < K - 2 && s > cum[base + seg + 1]) seg++;
          aS[n] = s; aSeg[n] = seg;
          const c0 = cum[base + seg], c1 = cum[base + seg + 1];
          const u = c1 > c0 ? (s - c0) / (c1 - c0) : 0;
          const a = (base + seg) * 3, b = a + 3;
          apos[n * 3] = wp[a] + (wp[b] - wp[a]) * u;
          apos[n * 3 + 1] = wp[a + 1] + (wp[b + 1] - wp[a + 1]) * u;
          apos[n * 3 + 2] = wp[a + 2] + (wp[b + 2] - wp[a + 2]) * u;
          // temperature: cold until the server (seg 3 heats), hot until the CRAH coil (seg 9 cools)
          const w = seg < 3 || seg === 10 ? 0 : seg === 3 ? u : seg === 9 ? 1 - u : 1;
          acol[n * 3] = (COLD.r + (hotNow.r - COLD.r) * w);
          acol[n * 3 + 1] = (COLD.g + (hotNow.g - COLD.g) * w);
          acol[n * 3 + 2] = (COLD.b + (hotNow.b - COLD.b) * w);
        }
        airGeo.attributes.position.needsUpdate = true;
        airGeo.attributes.color.needsUpdate = true;
      }

      // Flows.
      dataPulse.step(dt * (0.15 + 1.4 * act) * (S.mode === 'train' && !computing ? 2.2 : 1));
      if (liquidG.visible) { const fv = dt * (0.2 + 0.5 * pf); coolPulse.step(fv); warmPulse.step(fv); }
      facPulseW.step(dt * (0.15 + 0.35 * pf)); facPulseC.step(dt * (0.15 + 0.35 * pf));
      const genOn = S.outage && S.tOut >= 6, gridOn = !S.outage;
      gridPulse.im.visible = gridOn; genPulse.im.visible = genOn;
      const pv = dt * (0.25 + 0.7 * pf);
      if (gridOn) gridPulse.step(pv);
      if (genOn) genPulse.step(pv);
      feedPulse.step(pv);
      fanRot.rotation.y += dt * (2 + 9 * pf);
      // Plume of water vapour: more heat, more evaporation.
      mistMat.opacity = 0.06 + 0.2 * pf;
      for (let k = 0; k < NM; k++) {
        mistPos[k * 3 + 1] += dt * mistV[k] * (0.2 + 0.5 * pf);
        mistPos[k * 3] += dt * 0.08;
        if (mistPos[k * 3 + 1] > 1.9) { mistPos[k * 3 + 1] = 1.02; mistPos[k * 3] = TX + (Math.random() - 0.5) * 0.4; }
      }
      mistGeo.attributes.position.needsUpdate = true;
      // Meters and the outage sequence.
      for (const m of pduMeters) m.scale.y = 0.05 + 0.95 * pf;
      for (const m of upsMeters) m.scale.y = 0.05 + 0.95 * pf;
      const onBattery = S.outage && S.tOut < 6;
      for (let i = 0; i < batLeds.length; i++) {
        const lit = onBattery ? (i % 5) < 5 - Math.floor(S.tOut / 1.5) : true;
        batLeds[i].material.color.setRGB(onBattery ? (lit ? 1 : 0.1) : 0.25, onBattery ? (lit ? 0.6 : 0.05) : 1, onBattery ? 0.1 : 0.45);
      }
      genLed.material.color.setRGB(genOn ? 1 : 0.25, genOn ? 0.35 : 1, genOn ? 0.1 : 0.45);
      const body = genG.userData.body;
      body.position.y = 0.085 + 0.21 + (genOn ? 0.003 * Math.sin(t * 90) : 0);
    }

    function updateServer(dt, t, pf) {
      const stepPhase = (t * 0.9) % 1, computing = S.mode !== 'train' || stepPhase < 0.78;
      for (let g = 0; g < 8; g++) for (let i = 0; i < TN; i++) for (let j = 0; j < TN; j++) {
        const n = (g * TN + i) * TN + j;
        const wave = 0.5 + 0.5 * Math.sin(t * 7 - (i + j) * 0.5 + g * 0.7);
        const b = S.mode === 'idle' ? 0.12 : 0.15 + act * (computing ? 0.55 + 0.6 * wave : 0.25);
        iTile.setColorAt(n, _c.setRGB(0.3 * b, 0.62 * b, 1.0 * b));
      }
      iTile.instanceColor.needsUpdate = true;
      linkPulse.step(dt * (0.2 + 1.2 * act) * (computing ? 1 : 3));
      linkPulse.scale = computing ? 1 : 1.5;
      if (plateG.visible) { const fv = dt * (0.15 + 0.45 * pf); plateSupPulse.step(fv); plateRetPulse.step(fv); }
      // fan blades
      fanSpin += dt * (6 + 30 * pf) * (S.cool === 'air' ? 1.4 : 0.7);
      let n = 0;
      for (let i = 0; i < NF; i++) for (let b = 0; b < FB; b++) {
        const a = fanSpin + (b / FB) * Math.PI * 2;
        setI(iBlade, n++, fanX(i) + Math.cos(a) * 0.1, fanY + Math.sin(a) * 0.1, fanZ, 1, 1, 1, 0.5, 0, a, 'ZYX');
      }
      iBlade.instanceMatrix.needsUpdate = true;
    }
    let fanSpin = 0;

    return {
      update(dt, t) {
        act += (actTarget - act) * Math.min(1, dt * 1.5);
        const pf = 0.3 + 0.7 * act;                 // illustrative fraction of rated IT power
        const dT = S.cool === 'air' ? 3 + 15 * pf : 2 + 7 * pf;
        tExh += (T_IN + dT - tExh) * Math.min(1, dt * 0.8);
        tRet += (T_COOLANT + 10 * pf - tRet) * Math.min(1, dt * 0.8);
        if (S.outage) S.tOut += dt;
        // readouts (only when the rounded values change)
        const temps = `${Math.round(tExh)}|${Math.round(tRet)}|${S.cool}`;
        if (temps !== lastTemps) {
          lastTemps = temps;
          rTemps.set(`≈ ${T_IN} °C → ${Math.round(tExh)} °C`);
          rCoolant.set(S.cool === 'liquid' ? `≈ ${T_COOLANT} °C → ${Math.round(tRet)} °C` : 'off (air only)');
          setLabel(lHot, `Hot aisle ≈ ${Math.round(tExh)} °C`);
          setLabel(lCold, `Cold aisle ≈ ${T_IN} °C`);
          setLabel(cduLabel, `CDU · ${T_COOLANT} → ${Math.round(tRet)} °C`);
        }
        const load = Math.round(pf * 20) * 5;
        if (load !== lastLoad) {
          lastLoad = load;
          rLoad.set(`≈ ${load}% of the cluster’s rated`);
        }
        const phase = !S.outage ? 'grid' : S.tOut < 6 ? 'battery' : 'gen';
        if (phase !== lastPhase) {
          lastPhase = phase;
          setLabel(lGen, phase === 'gen' ? 'Generator · running' : 'Generator · standby');
          setLabel(lUps, phase === 'battery' ? 'UPS · on battery!' : 'UPS + batteries');
          nOut.set(phase === 'grid' ? 'Click any rack, unit or pipe for a card about it. Temperatures and the power meter are illustrative.'
            : phase === 'battery' ? '<b>Grid lost!</b> The UPS batteries took over instantly, so the servers never noticed. The generator is starting… (sped up here; real batteries can last minutes)'
              : '<b>Generator running.</b> The transfer switch moved the load to the generator; the UPS batteries now recharge. Click the button again to restore the grid.');
          if (phase === 'battery' && S.tOut < 0.5) ctx.toast('Grid outage! UPS batteries carry the load.');
          if (phase === 'gen') ctx.toast('Generator is carrying the load.', 'good');
        }
        if (site.visible) updateHall(dt, t, pf);
        if (srv.visible) updateServer(dt, t, pf);
      },
      onKey(e) {
        if (e.key === 'v') { S.view = S.view === 'hall' ? 'server' : 'hall'; cView.set(S.view); applyView(false); }
      },
      dispose() {
        root.traverse((o) => { if (o.isInstancedMesh) o.dispose(); });
      },
    };
  },
};
