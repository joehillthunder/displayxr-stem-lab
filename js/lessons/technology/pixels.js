// Pixels, Colour & Bits: the RGB colour cube (R, G, B along x, y, z) as a lattice of small cubes,
// a solid cube or three slices through the chosen colour, with a probe marking that colour. A
// magnified display pixel shows its red, green and blue subpixels glowing at the chosen levels,
// next to the mixed colour your eye sees, and three coloured lamps overlap on the floor to show
// additive mixing. A bit-depth slider quantises every channel to n bits and reports the number of
// colours (2^3n) and the size of an uncompressed 1920 × 1080 image.

import * as THREE from 'three';

const S = 2.0;                                    // cube edge
const O = new THREE.Vector3(-2.45, 0.6, -1.25);   // the black corner (0, 0, 0)
const PIX = new THREE.Vector3(1.2, 1.55, -0.35); // pixel close-up centre
const SW = new THREE.Vector3(2.8, 1.55, -0.2);  // mixed-light swatch centre
const VENN = new THREE.Vector3(0.6, 0.004, 1.75); // additive mixing lamps on the floor
const W = 1920, H = 1080;

const hex2 = (v) => v.toString(16).toUpperCase().padStart(2, '0');
const bin = (v, n) => v.toString(2).padStart(n, '0');
const fmtInt = (v) => v.toLocaleString('en-US');

export default {
  view: { dist: 8.8, yaw: 0.32, pitch: 0.36, target: [0, 1.35, 0.1], minDist: 3, maxDist: 18 },
  explain: `
    <p>A screen is a grid of <b>pixels</b>. Look closely (a magnifying glass works) and each pixel is three tiny
    lights called <b>subpixels</b>: one red, one green, one blue. In an OLED screen each subpixel makes its own light;
    in an LCD a white backlight shines through red, green and blue filters. Every colour on the screen is a mix of
    those three.</p>
    <p>Light mixes by <b>adding</b>. Red + green light looks yellow, green + blue looks cyan, red + blue looks
    magenta, and all three at full power look white. (Paint is different: pigments <i>absorb</i> light, so mixing
    paint is subtractive.)</p>
    <p>Each channel is stored as a number. With <b>8 bits</b> per channel there are 2⁸ = 256 levels (0–255), so a
    colour needs 3 × 8 = 24 bits and there are 256³ = 16,777,216 possible colours. Web colours write the three bytes
    in <b>hexadecimal</b>: #FF8000 is R = FF = 255, G = 80 = 128, B = 00 = 0 (orange).</p>
    <p>Every colour is a point inside the <b>RGB cube</b>: black at one corner, white at the opposite one, and the
    grey colours on the diagonal between them. Fewer bits per channel means fewer points in the cube, so smooth
    gradients turn into visible steps (<b>banding</b>), but files get smaller.</p>`,
  formula: 'Colours = 2<sup>3<i>n</i></sup> &nbsp;&nbsp; (n bits per channel)<br>Size (bytes) = width × height × 3<i>n</i> ÷ 8',
  vocab: [
    ['Pixel', 'The smallest dot of an image or screen; on a screen it is made of red, green and blue subpixels.'],
    ['Subpixel', 'One of the three coloured light sources (R, G or B) inside a screen pixel.'],
    ['Additive mixing', 'Mixing coloured light: the lights add, so R + G + B at full power make white.'],
    ['Bit depth', 'How many bits store each colour channel; n bits give 2ⁿ levels.'],
    ['Hexadecimal', 'Base 16 (digits 0–9 and A–F). One byte (0–255) is two hex digits, 00–FF.'],
    ['RGB cube', 'The space of all colours, with red, green and blue as the three axes.'],
    ['Banding', 'Visible steps in a smooth gradient caused by too few colour levels.'],
    ['Uncompressed', 'Stored with every pixel’s full value, without a format such as PNG or JPEG shrinking it.'],
  ],
  standards: ['CSTA 3A-DA-09'],
  quiz: [
    { q: 'A pixel shows its red and green subpixels at full brightness and blue off. What colour do you see?', choices: ['Brown', 'Yellow', 'White', 'Cyan'], answer: 1, why: 'Light mixes additively: red + green light = yellow. Adding blue as well would make white.' },
    { q: 'How many different levels can one 8-bit colour channel store?', choices: ['8', '255', '256', '16,777,216'], answer: 2, why: '8 bits give 2⁸ = 256 values, numbered 0 to 255.' },
    { q: 'What colour is #00FFFF?', choices: ['Red', 'Yellow', 'Cyan', 'Magenta'], answer: 2, why: 'R = 00 (off), G = FF (255), B = FF (255): green + blue light = cyan.' },
    { q: 'With 4 bits per channel, how many colours can be shown?', choices: ['12', '48', '4,096', '65,536'], answer: 2, why: '4 bits per channel × 3 channels = 12 bits, and 2¹² = 4,096 colours (16 levels per channel, 16³ = 4,096).' },
    { q: 'How big is an uncompressed 1920 × 1080 image at 24 bits per pixel?', choices: ['About 2 MB', 'About 6.2 MB', 'About 50 MB', 'About 24 KB'], answer: 1, why: '1920 × 1080 = 2,073,600 pixels × 3 bytes = 6,220,800 bytes ≈ 6.2 MB.' },
  ],

  build(ctx) {
    const { root, ui } = ctx;
    const owned = [];
    const own = (x) => (owned.push(x), x);
    const qs = new URLSearchParams(location.search);

    let rgb = [255, 128, 0];
    if (qs.has('rgb')) { const p = qs.get('rgb').split(',').map((v) => Math.max(0, Math.min(255, Math.round(+v) || 0))); if (p.length === 3) rgb = p; }
    let bits = Math.max(1, Math.min(8, +(qs.get('bits') || 8)));
    let viewMode = ['lattice', 'solid', 'slices'].includes(qs.get('cube')) ? qs.get('cube') : 'lattice';

    const levels = () => 1 << bits;
    const quant = (v) => { const L = levels() - 1; return Math.round((v * L) / 255); };
    const deq = (q) => Math.round((q * 255) / (levels() - 1));
    const shown = () => rgb.map((v) => deq(quant(v)));

    const col = new THREE.Color();
    const srgb = (r, g, b) => col.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);

    // ── materials ──────────────────────────────────────────────────────────────────────────
    const M = {
      frame: own(new THREE.MeshStandardMaterial({ color: 0xaab4c4, metalness: 1, roughness: 0.25 })),
      dark: own(new THREE.MeshPhysicalMaterial({ color: 0x14171d, roughness: 0.35, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.2 })),
      housing: own(new THREE.MeshPhysicalMaterial({ color: 0x1c212b, roughness: 0.4, metalness: 0.6, clearcoat: 0.6 })),
      glass: own(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.12, depthWrite: false })),
      lattice: own(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0, envMapIntensity: 0.35 })),
      probe: own(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })),
      ring: own(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })),
    };

    // ── the RGB cube ───────────────────────────────────────────────────────────────────────
    const cube = new THREE.Group();
    root.add(cube);
    // a slim post to hold it up
    {
      const post = new THREE.Mesh(own(new THREE.CylinderGeometry(0.05, 0.08, O.y - 0.02, 20).translate(0, (O.y - 0.02) / 2, 0)), M.frame);
      post.position.set(O.x + S / 2, 0, O.z + S / 2);
      post.castShadow = true;
      const foot = new THREE.Mesh(own(new THREE.CylinderGeometry(0.42, 0.46, 0.05, 48)), M.dark);
      foot.position.set(O.x + S / 2, 0.025, O.z + S / 2);
      foot.receiveShadow = true;
      cube.add(post, foot);
    }
    // frame: 12 edges
    {
      const edge = own(new THREE.CylinderGeometry(0.012, 0.012, S, 10));
      const im = new THREE.InstancedMesh(edge, M.frame, 12);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
      let k = 0;
      for (const ax of [0, 1, 2]) for (const a of [0, 1]) for (const b of [0, 1]) {
        p.set(0.5, 0.5, 0.5);
        const o = [0, 1, 2].filter((i) => i !== ax);
        p.setComponent(o[0], a); p.setComponent(o[1], b);
        p.multiplyScalar(S).add(O);
        q.setFromEuler(new THREE.Euler(ax === 2 ? Math.PI / 2 : 0, 0, ax === 0 ? Math.PI / 2 : 0));
        im.setMatrixAt(k++, m.compose(p, q, one));
      }
      im.castShadow = true;
      cube.add(im);
    }
    // axes with arrow heads, labels and ticks
    const axisCols = [[1, 0.25, 0.25], [0.25, 1, 0.35], [0.3, 0.55, 1]];
    for (let ax = 0; ax < 3; ax++) {
      const c = new THREE.Color().setRGB(...axisCols[ax], THREE.SRGBColorSpace);
      const mat = own(new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));
      const len = S + 0.32;
      const shaft = new THREE.Mesh(own(new THREE.CylinderGeometry(0.018, 0.018, len, 12).translate(0, len / 2, 0)), mat);
      const head = new THREE.Mesh(own(new THREE.ConeGeometry(0.06, 0.16, 20).translate(0, len + 0.08, 0)), mat);
      const g = new THREE.Group();
      g.add(shaft, head);
      g.position.copy(O);
      if (ax === 0) g.rotation.z = -Math.PI / 2;
      if (ax === 2) g.rotation.x = Math.PI / 2;
      cube.add(g);
      const dir = new THREE.Vector3().setComponent(ax, 1);
      const name = ['R  (red)', 'G  (green)', 'B  (blue)'][ax];
      const l = ctx.label(name, { color: '#' + c.getHexString(THREE.SRGBColorSpace), size: 0.85 });
      l.position.copy(O).addScaledVector(dir, len + 0.22);
      root.add(l);
      const t = ctx.label('255', { color: '#9fb0c8', size: 0.55, bold: false });
      t.position.copy(O).addScaledVector(dir, S);
      t.position.y -= ax === 1 ? 0 : 0.12;
      if (ax === 1) t.position.x -= 0.18;
      root.add(t);
    }
    {
      const l = ctx.label('0', { color: '#9fb0c8', size: 0.55, bold: false });
      l.position.copy(O).add(new THREE.Vector3(-0.1, -0.14, 0));
      root.add(l);
    }
    // corner names
    const corners = [['Black', 0, 0, 0], ['Red', 1, 0, 0], ['Green', 0, 1, 0], ['Blue', 0, 0, 1], ['Yellow', 1, 1, 0], ['Cyan', 0, 1, 1], ['Magenta', 1, 0, 1], ['White', 1, 1, 1]];
    const cornerLabels = corners.map(([n, r, g, b]) => {
      if (n === 'Black' || n === 'Red' || n === 'Green' || n === 'Blue') return null; // the axes already say these
      const l = ctx.label(n, { color: '#' + srgb(r * 255, g * 255, b * 255).getHexString(THREE.SRGBColorSpace), size: 0.62 });
      l.position.set(O.x + r * S + (r ? 0.12 : -0.12), O.y + g * S + 0.1, O.z + b * S + (b ? 0.12 : -0.12));
      root.add(l);
      return l;
    });

    // lattice (instanced)
    const MAXL = 16;
    const latGeo = own(new THREE.BoxGeometry(1, 1, 1));
    const lattice = new THREE.InstancedMesh(latGeo, M.lattice, MAXL ** 3);
    lattice.castShadow = true;
    lattice.receiveShadow = true;
    lattice.frustumCulled = false;
    cube.add(lattice);
    let latL = 0, latHi = -1;
    const latVals = new Uint8Array(MAXL ** 3 * 3);
    const mtx = new THREE.Matrix4();
    function buildLattice() {
      const L = Math.min(levels(), MAXL);
      latL = L;
      const step = S / (L - 1);
      const size = Math.min(0.2, step * 0.28);
      let k = 0;
      for (let i = 0; i < L; i++) for (let j = 0; j < L; j++) for (let l = 0; l < L; l++) {
        // displayed levels are evenly spread over 0..255 (a subset of the real levels when n > 4)
        const r = Math.round((i * 255) / (L - 1)), g = Math.round((j * 255) / (L - 1)), b = Math.round((l * 255) / (L - 1));
        mtx.makeScale(size, size, size).setPosition(O.x + i * step, O.y + j * step, O.z + l * step);
        lattice.setMatrixAt(k, mtx);
        lattice.setColorAt(k, srgb(r, g, b));
        latVals[k * 3] = r; latVals[k * 3 + 1] = g; latVals[k * 3 + 2] = b;
        k++;
      }
      lattice.count = k;
      lattice.instanceMatrix.needsUpdate = true;
      lattice.instanceColor.needsUpdate = true;
      latHi = -1;
    }
    function highlightLattice() {
      const L = latL, step = S / (L - 1), size = Math.min(0.2, step * 0.28);
      if (latHi >= 0) {
        const i = Math.floor(latHi / (L * L)), j = Math.floor(latHi / L) % L, l = latHi % L;
        lattice.setMatrixAt(latHi, mtx.makeScale(size, size, size).setPosition(O.x + i * step, O.y + j * step, O.z + l * step));
      }
      latHi = -1;
      // highlight only when the shown colour is one of the displayed lattice points
      const sh = shown();
      const idx = sh.map((v) => ((v * (L - 1)) / 255));
      if (idx.every((v) => Math.abs(v - Math.round(v)) < 1e-6)) {
        const [i, j, l] = idx.map(Math.round);
        latHi = (i * L + j) * L + l;
        const s2 = size * 1.9;
        lattice.setMatrixAt(latHi, mtx.makeScale(s2, s2, s2).setPosition(O.x + i * step, O.y + j * step, O.z + l * step));
      }
      lattice.instanceMatrix.needsUpdate = true;
    }
    ctx.pickable(lattice, (hit) => {
      if (hit.instanceId == null) return;
      const k = hit.instanceId;
      setRGB([latVals[k * 3], latVals[k * 3 + 1], latVals[k * 3 + 2]]);
    });

    // solid cube with exact vertex colours
    const solidGeo = own(new THREE.BoxGeometry(S, S, S, 8, 8, 8));
    {
      const p = solidGeo.attributes.position, cols = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) {
        srgb((p.getX(i) / S + 0.5) * 255, (p.getY(i) / S + 0.5) * 255, (p.getZ(i) / S + 0.5) * 255);
        cols.set([col.r, col.g, col.b], i * 3);
      }
      solidGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    }
    const solid = new THREE.Mesh(solidGeo, own(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })));
    solid.position.copy(O).addScalar(S / 2);
    cube.add(solid);
    ctx.pickable(solid, (hit) => {
      const p = hit.point;
      setRGB([(p.x - O.x) / S, (p.y - O.y) / S, (p.z - O.z) / S].map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255)));
    });

    // three slices through the probe
    const slices = new THREE.Group();
    cube.add(slices);
    const sliceMat = own(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide, transparent: true, opacity: 0.94 }));
    const slice = [0, 1, 2].map((ax) => {
      const g = own(new THREE.PlaneGeometry(S, S, 1, 1));
      if (ax === 0) g.rotateY(Math.PI / 2);
      if (ax === 1) g.rotateX(-Math.PI / 2);
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(12), 3));
      const m = new THREE.Mesh(g, sliceMat);
      slices.add(m);
      ctx.pickable(m, (hit) => {
        const p = hit.point;
        setRGB([(p.x - O.x) / S, (p.y - O.y) / S, (p.z - O.z) / S].map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255)));
      });
      return m;
    });
    function updateSlices(sh) {
      const f = sh.map((v) => v / 255);
      slice.forEach((m, ax) => {
        m.position.set(O.x + S / 2, O.y + S / 2, O.z + S / 2).setComponent(ax, [O.x, O.y, O.z][ax] + f[ax] * S);
        const p = m.geometry.attributes.position, c = m.geometry.attributes.color;
        for (let i = 0; i < 4; i++) {
          const w = [p.getX(i) / S + 0.5, p.getY(i) / S + 0.5, p.getZ(i) / S + 0.5];
          w[ax] = f[ax];
          srgb(w[0] * 255, w[1] * 255, w[2] * 255);
          c.setXYZ(i, col.r, col.g, col.b);
        }
        c.needsUpdate = true;
      });
    }

    // the probe: a glowing bead in a gyroscope of rings, with dashed drop lines to the walls
    const probe = new THREE.Group();
    cube.add(probe);
    const bead = new THREE.Mesh(own(new THREE.SphereGeometry(0.09, 32, 20)), M.probe);
    probe.add(bead);
    const ringGeo = own(new THREE.TorusGeometry(0.15, 0.008, 8, 64));
    const rings = [0, 1, 2].map((i) => {
      const r = new THREE.Mesh(ringGeo, M.ring);
      if (i === 1) r.rotation.x = Math.PI / 2;
      if (i === 2) r.rotation.y = Math.PI / 2;
      probe.add(r);
      return r;
    });
    const dropMat = own(new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.05, gapSize: 0.04, transparent: true, opacity: 0.7 }));
    const dropGeo = own(new THREE.BufferGeometry());
    dropGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(18), 3));
    const drops = new THREE.LineSegments(dropGeo, dropMat);
    cube.add(drops);
    let probeLabel = ctx.label('#FF8000', { color: '#ffffff', size: 0.8 });
    probeLabel.position.y = 0.22;
    probe.add(probeLabel);
    let probeText = '';

    // ── the magnified pixel ────────────────────────────────────────────────────────────────
    const pix = new THREE.Group();
    pix.position.copy(PIX);
    pix.rotation.y = -0.12;
    root.add(pix);
    const PW = 1.25, PH = 1.25;
    {
      const housing = new THREE.Mesh(own(roundedBoxGeo(PW + 0.12, 0.14, PH + 0.12, 0.04)), M.housing);
      housing.rotation.x = Math.PI / 2;
      housing.position.z = -0.07;
      housing.castShadow = true;
      // black matrix: the dark grid between subpixels
      const bm = new THREE.Mesh(own(new THREE.PlaneGeometry(PW, PH)), own(new THREE.MeshStandardMaterial({ color: 0x050608, roughness: 0.8 })));
      bm.position.z = 0.001;
      const cover = new THREE.Mesh(own(new THREE.BoxGeometry(PW, PH, 0.03)), M.glass);
      cover.position.z = 0.06;
      const stand = new THREE.Mesh(own(new THREE.CylinderGeometry(0.04, 0.06, PIX.y - PH / 2 - 0.02, 16).translate(0, -(PIX.y - PH / 2 - 0.02) / 2, 0)), M.frame);
      stand.position.set(0, -PH / 2 - 0.05, -0.07);
      stand.castShadow = true;
      const foot = new THREE.Mesh(own(new THREE.CylinderGeometry(0.3, 0.33, 0.05, 40)), M.dark);
      foot.position.set(0, -PIX.y + 0.025, -0.07);
      foot.receiveShadow = true;
      pix.add(housing, bm, cover, stand, foot);
    }
    const subW = 0.3, subH = 1.0, subGap = 0.4;
    const subGeo = own(roundedBoxGeo(subW, 0.06, subH, 0.05));
    const subMats = [0, 1, 2].map(() => own(new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false })));
    const haloTex = own(radialTexture());
    const halos = [];
    const subs = [0, 1, 2].map((i) => {
      const m = new THREE.Mesh(subGeo, subMats[i]);
      m.rotation.x = Math.PI / 2;
      m.position.set((i - 1) * subGap, 0, 0.03);
      pix.add(m);
      const h = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: haloTex, color: new THREE.Color(...[[1, 0.1, 0.1], [0.1, 1, 0.2], [0.15, 0.35, 1]][i]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false })));
      h.scale.set(0.75, 1.5, 1);
      h.position.set((i - 1) * subGap, 0, 0.12);
      pix.add(h);
      halos.push(h);
      return m;
    });
    const subLabels = [0, 1, 2].map((i) => {
      const l = ctx.label(' ', { size: 0.62 });
      l.position.set((i - 1) * subGap, -PH / 2 - 0.2, 0.1);
      pix.add(l);
      return { sprite: l, text: '' };
    });
    {
      const l = ctx.label('One pixel, magnified', { color: '#cfe0f5', size: 0.72 });
      l.position.set(0, PH / 2 + 0.12, 0);
      pix.add(l);
    }

    // ── the mixed-light swatch ─────────────────────────────────────────────────────────────
    const sw = new THREE.Group();
    sw.position.copy(SW);
    sw.rotation.y = -0.25;
    root.add(sw);
    const swMat = own(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    const swOrigMat = own(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    {
      const frame = new THREE.Mesh(own(roundedBoxGeo(0.86, 0.1, 0.86, 0.04)), M.housing);
      frame.rotation.x = Math.PI / 2;
      frame.position.z = -0.05;
      frame.castShadow = true;
      const face = new THREE.Mesh(own(new THREE.PlaneGeometry(0.74, 0.74)), swMat);
      face.position.z = 0.002;
      // a small inset showing the full 8-bit colour, so quantisation is visible side by side
      const inset = new THREE.Mesh(own(new THREE.PlaneGeometry(0.22, 0.22)), swOrigMat);
      inset.position.set(0.22, -0.22, 0.004);
      const insetRim = new THREE.Mesh(own(new THREE.PlaneGeometry(0.25, 0.25)), own(new THREE.MeshBasicMaterial({ color: 0x0b0d12 })));
      insetRim.position.set(0.22, -0.22, 0.003);
      const stand = new THREE.Mesh(own(new THREE.CylinderGeometry(0.035, 0.05, SW.y - 0.45, 16).translate(0, -(SW.y - 0.45) / 2, 0)), M.frame);
      stand.position.set(0, -0.43, -0.05);
      const foot = new THREE.Mesh(own(new THREE.CylinderGeometry(0.24, 0.27, 0.05, 40)), M.dark);
      foot.position.set(0, -SW.y + 0.025, -0.05);
      sw.add(frame, face, insetRim, inset, stand, foot);
      const l = ctx.label('What your eye sees', { color: '#cfe0f5', size: 0.72 });
      l.position.set(0, 0.5, 0);
      sw.add(l);
    }
    const insetObj = sw.children[3], insetRimObj = sw.children[2];
    let swLabel = ctx.label(' ', { size: 0.66 });
    swLabel.position.set(0, -0.62, 0.05);
    sw.add(swLabel);
    let swText = '';

    // ── additive-mixing lamps on the floor ─────────────────────────────────────────────────
    const venn = new THREE.Group();
    venn.position.copy(VENN);
    root.add(venn);
    const discGeo = own(new THREE.CircleGeometry(0.5, 64).rotateX(-Math.PI / 2));
    const discMats = [0, 1, 2].map(() => own(new THREE.MeshBasicMaterial({ color: 0x000000, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false })));
    const beamGeo = own(new THREE.CylinderGeometry(0.05, 0.5, 1, 40, 1, true).translate(0, 0.5, 0));
    const beamMats = [0, 1, 2].map(() => own(new THREE.MeshBasicMaterial({ color: 0x000000, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, opacity: 0.18 })));
    const lampGeo = own(new THREE.CylinderGeometry(0.07, 0.1, 0.16, 24));
    const lampLens = [0, 1, 2].map(() => own(new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false })));
    const lensGeo = own(new THREE.CircleGeometry(0.075, 32).rotateX(Math.PI / 2));
    const LH = 0.95;
    for (let i = 0; i < 3; i++) {
      const a = Math.PI / 2 + (i * Math.PI * 2) / 3;
      const x = Math.cos(a) * 0.3, z = -Math.sin(a) * 0.3;
      const d = new THREE.Mesh(discGeo, discMats[i]);
      d.position.set(x, 0.002 + i * 0.001, z);
      d.renderOrder = 2;
      const beam = new THREE.Mesh(beamGeo, beamMats[i]);
      beam.position.set(x, 0, z);
      beam.scale.y = LH;
      beam.renderOrder = 3;
      const lamp = new THREE.Mesh(lampGeo, M.housing);
      lamp.position.set(x, LH + 0.08, z);
      lamp.castShadow = true;
      const lens = new THREE.Mesh(lensGeo, lampLens[i]);
      lens.position.set(x, LH - 0.001, z);
      venn.add(d, beam, lamp, lens);
    }
    {
      const hub = new THREE.Mesh(own(new THREE.CylinderGeometry(0.012, 0.012, LH + 0.2, 10).translate(0, (LH + 0.2) / 2, 0)), M.frame);
      hub.position.set(0, 0, -0.75);
      const bar = new THREE.Mesh(own(new THREE.TorusGeometry(0.3, 0.012, 8, 48)), M.frame);
      bar.rotation.x = Math.PI / 2;
      bar.position.y = LH + 0.17;
      const link = new THREE.Mesh(own(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 8)), M.frame);
      link.rotation.x = Math.PI / 2;
      link.position.set(0, LH + 0.17, -0.52);
      const base = new THREE.Mesh(own(new THREE.CylinderGeometry(0.12, 0.14, 0.03, 24)), M.dark);
      base.position.set(0, 0.015, -0.75);
      venn.add(hub, bar, link, base);
      const l = ctx.label('Adding light', { color: '#cfe0f5', size: 0.66 });
      l.position.set(0, LH + 0.35, 0);
      venn.add(l);
    }

    // ── panel ──────────────────────────────────────────────────────────────────────────────
    const chan = ['Red', 'Green', 'Blue'];
    const chanCol = ['#ff6b6b', '#5fe08a', '#6aa8ff'];
    const sliders = [0, 1, 2].map((i) => ui.slider(`<span style="color:${chanCol[i]}">${chan[i]}</span>`, { min: 0, max: 255, step: 1, value: rgb[i], fmt: (v) => `${v}`, onChange: (v) => { rgb[i] = v; refresh(); } }));
    const rHex = ui.readout('Hex code');
    const rBin = ui.readout('Binary (8 bits each)');
    ui.button('Red', () => setRGB([255, 0, 0]));
    ui.button('Yellow', () => setRGB([255, 255, 0]));
    ui.button('Cyan', () => setRGB([0, 255, 255]));
    ui.button('Magenta', () => setRGB([255, 0, 255]));
    ui.button('White', () => setRGB([255, 255, 255]));
    ui.button('Grey', () => setRGB([128, 128, 128]));
    ui.button('Orange', () => setRGB([255, 128, 0]));
    ui.button('Random', () => setRGB([0, 0, 0].map(() => (Math.random() * 256) | 0)));
    ui.heading('Bit depth');
    ui.slider('Bits per channel', { min: 1, max: 8, step: 1, value: bits, fmt: (v) => `${v} bit${v > 1 ? 's' : ''} → ${1 << v} levels`, onChange: (v) => { bits = v; buildLattice(); refresh(); } });
    const rStored = ui.readout('Stored as');
    const rColours = ui.readout('Total colours');
    const rSize = ui.readout('1920 × 1080 image');
    const nBits = ui.note('');
    ui.choice('Cube', { options: [{ value: 'lattice', label: 'Lattice' }, { value: 'slices', label: 'Slices' }, { value: 'solid', label: 'Solid' }], value: viewMode, onChange: (v) => { viewMode = v; refresh(); } });
    ui.note('Click anywhere in the cube to pick that colour. The small square on the swatch is the full 8-bit colour; the big one is what is stored at the chosen bit depth.');

    function setRGB(v) {
      rgb = v.slice();
      sliders.forEach((s, i) => s.set(rgb[i]));
      refresh();
    }

    function refresh() {
      const sh = shown();
      const f = sh.map((v) => v / 255);
      // views
      lattice.visible = viewMode === 'lattice';
      solid.visible = viewMode === 'solid';
      slices.visible = viewMode === 'slices';
      if (viewMode === 'lattice') highlightLattice();
      if (viewMode === 'slices') updateSlices(sh);
      // probe
      probe.position.set(O.x + f[0] * S, O.y + f[1] * S, O.z + f[2] * S);
      probe.visible = viewMode !== 'solid';
      M.probe.color.copy(srgb(...sh));
      const lum = 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
      M.ring.color.setRGB(lum > 0.5 ? 0.05 : 1, lum > 0.5 ? 0.05 : 1, lum > 0.5 ? 0.08 : 1);
      const pa = drops.geometry.attributes.position;
      const P = probe.position;
      pa.setXYZ(0, P.x, P.y, P.z); pa.setXYZ(1, P.x, O.y, P.z);   // to the floor (G = 0)
      pa.setXYZ(2, P.x, P.y, P.z); pa.setXYZ(3, O.x, P.y, P.z);   // to the left wall (R = 0)
      pa.setXYZ(4, P.x, P.y, P.z); pa.setXYZ(5, P.x, P.y, O.z);   // to the back wall (B = 0)
      pa.needsUpdate = true;
      drops.computeLineDistances();
      drops.visible = viewMode === 'lattice';
      const hx = '#' + sh.map(hex2).join('');
      if (hx !== probeText) { probeLabel = ctx.relabel(probeLabel, hx, { color: '#ffffff', size: 0.8 }); probeText = hx; }
      probeLabel.visible = probe.visible;
      // pixel close-up
      for (let i = 0; i < 3; i++) {
        const c = [0, 0, 0];
        c[i] = sh[i];
        subMats[i].color.copy(srgb(...c));
        halos[i].material.opacity = Math.pow(f[i], 1.2) * 0.85;
        halos[i].visible = f[i] > 0.01;
        const t = `${chan[i][0]} ${sh[i]}`;
        if (subLabels[i].text !== t) { subLabels[i].sprite = ctx.relabel(subLabels[i].sprite, t, { color: chanCol[i], size: 0.62 }); subLabels[i].text = t; }
      }
      swMat.color.copy(srgb(...sh));
      swOrigMat.color.copy(srgb(...rgb));
      insetObj.visible = insetRimObj.visible = bits < 8;
      const st = `rgb(${sh.join(', ')})`;
      if (st !== swText) { swLabel = ctx.relabel(swLabel, st, { color: '#e6eefa', size: 0.66 }); swText = st; }
      // lamps
      for (let i = 0; i < 3; i++) {
        const c = [0, 0, 0];
        c[i] = sh[i];
        srgb(...c);
        discMats[i].color.copy(col);
        beamMats[i].color.copy(col);
        lampLens[i].color.copy(col);
      }
      // panel
      const hex8 = '#' + rgb.map(hex2).join('');
      rHex.set(`<span style="display:inline-block;width:14px;height:14px;border-radius:3px;vertical-align:-2px;margin-right:6px;background:${hex8};border:1px solid #fff4"></span><b>${hex8}</b> = rgb(${rgb.join(', ')})`);
      rBin.set(rgb.map((v, i) => `<span style="color:${chanCol[i]}">${bin(v, 8)}</span>`).join(' '));
      const qv = rgb.map(quant);
      rStored.set(bits === 8 ? 'exactly (8 bits each)' : `${qv.map((v, i) => `<span style="color:${chanCol[i]}">${bin(v, bits)}</span>`).join(' ')} → shown as ${'#' + sh.map(hex2).join('')}`);
      const nCol = 2 ** (3 * bits);
      rColours.set(`2<sup>${3 * bits}</sup> = ${fmtInt(nCol)}`);
      const bytes = (W * H * 3 * bits) / 8;
      rSize.set(`${fmtInt(bytes)} bytes ≈ ${(bytes / 1e6).toFixed(bytes < 1e6 ? 2 : 1)} MB`);
      nBits.set(`${bits} bit${bits > 1 ? 's' : ''} per channel × 3 channels = <b>${3 * bits} bits per pixel</b>. ${W} × ${H} = ${fmtInt(W * H)} pixels × ${3 * bits} bits ÷ 8 = ${fmtInt(bytes)} bytes.${levels() > MAXL ? ` (The lattice shows ${MAXL} of the ${levels()} levels per channel; drawing all ${fmtInt(nCol)} would hide everything.)` : ''}`);
    }

    buildLattice();
    refresh();
    snapView(this.view, qs);

    return {
      update(dt, t) {
        probe.rotation.y += dt * 0.8;
        rings[0].rotation.z += dt * 0.6;
        const s = 1 + 0.08 * Math.sin(t * 3);
        bead.scale.setScalar(s);
      },
      dispose() {
        for (const o of owned) o.dispose?.();
        lattice.dispose();
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

/** A rounded box: w (x) × h (y) × d (z). */
function roundedBoxGeo(w, h, d, r) {
  const g = new THREE.ExtrudeGeometry(roundedRect(w - 2 * r, d - 2 * r, r * 0.6), { depth: h - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 3, curveSegments: 6 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -(h - 2 * r) / 2, 0);
  g.computeVertexNormals();
  return g;
}

function radialTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)');
  gr.addColorStop(0.3, 'rgba(255,255,255,0.35)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
