// The home scene: one emblem per subject on the plinth (an atom, a microchip, a gear, a math
// surface). Clicking an emblem opens that subject's lessons. Built through the same ctx a lesson
// gets, so it is disposed the same way.

import * as THREE from 'three';
import { SUBJECT_COLORS } from './env.js';

export default {
  id: 'home',
  subject: null,
  view: { dist: 10, yaw: 0, pitch: 0.26, target: [0, 0.35, 0], auto: 0.12 },
  build(ctx) {
    const { root } = ctx;
    const items = [];
    const place = (g, i, subject) => {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      g.position.set(Math.sin(a) * 2.5, 1.3, Math.cos(a) * 2.5);
      g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
      root.add(g);
      const label = ctx.label(subject[0].toUpperCase() + subject.slice(1), { color: SUBJECT_COLORS[subject], size: 1.1 });
      label.position.set(0, 1.0, 0);
      g.add(label);
      ctx.pickable(g, () => ctx.openSubject(subject));
      items.push(g);
    };

    // Science: a Bohr-style carbon atom.
    {
      const g = new THREE.Group();
      const pm = new THREE.MeshPhysicalMaterial({ color: 0xff5a5a, roughness: 0.25, clearcoat: 1 });
      const nm = new THREE.MeshPhysicalMaterial({ color: 0x9fb3c8, roughness: 0.3, clearcoat: 1 });
      const ball = new THREE.SphereGeometry(0.11, 24, 16);
      for (let i = 0; i < 12; i++) {
        const m = new THREE.Mesh(ball, i % 2 ? pm : nm);
        m.position.setFromSphericalCoords(0.16 * Math.cbrt(i + 1) * 0.9, Math.acos(1 - (2 * (i + 0.5)) / 12), i * 2.4);
        g.add(m);
      }
      const em = new THREE.MeshStandardMaterial({ color: 0x4fd1ff, emissive: 0x2aa8ff, emissiveIntensity: 1.6 });
      const rings = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const orbit = new THREE.Group();
        orbit.rotation.set((k * Math.PI) / 3, 0, (k * Math.PI) / 5);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.008, 8, 120), new THREE.MeshBasicMaterial({ color: 0x4fd1a5, transparent: true, opacity: 0.6 }));
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), em);
        e.position.x = 0.8;
        const spin = new THREE.Group();
        spin.add(e);
        orbit.add(ring, spin);
        orbit.userData.spin = spin;
        orbit.userData.speed = 1.6 + k * 0.5;
        rings.add(orbit);
      }
      g.add(rings);
      g.userData.tick = (dt) => rings.children.forEach((o) => (o.userData.spin.rotation.z += dt * o.userData.speed));
      place(g, 0, 'science');
    }

    // Technology: a microchip with glowing traces.
    {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.14, 1.0), new THREE.MeshStandardMaterial({ color: 0x1b1f27, roughness: 0.45, metalness: 0.3 }));
      const die = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.5), new THREE.MeshPhysicalMaterial({ color: 0x5aa9ff, metalness: 0.9, roughness: 0.2, iridescence: 1 }));
      die.position.y = 0.085;
      g.add(body, die);
      const pin = new THREE.BoxGeometry(0.05, 0.03, 0.18);
      const gold = new THREE.MeshStandardMaterial({ color: 0xe8c068, metalness: 1, roughness: 0.25 });
      for (let s = 0; s < 4; s++) for (let i = 0; i < 7; i++) {
        const p = new THREE.Mesh(pin, gold);
        const off = -0.39 + i * 0.13;
        const side = s % 2 ? 1 : -1;
        if (s < 2) p.position.set(off, -0.03, side * 0.58); else { p.position.set(side * 0.58, -0.03, off); p.rotation.y = Math.PI / 2; }
        g.add(p);
      }
      const glow = new THREE.MeshBasicMaterial({ color: 0x5aa9ff, toneMapped: false });
      for (let i = 0; i < 6; i++) {
        const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.004, 0.012), glow);
        t.position.set(0, 0.102, -0.18 + i * 0.07);
        g.add(t);
      }
      g.rotation.x = -0.5;
      g.userData.tick = (dt, t) => (glow.color.setHSL(0.6, 1, 0.45 + 0.2 * Math.sin(t * 3)));
      place(g, 1, 'technology');
    }

    // Engineering: two meshing gears.
    {
      const g = new THREE.Group();
      const steel = new THREE.MeshStandardMaterial({ color: 0xc9ccd2, metalness: 1, roughness: 0.28 });
      const brass = new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 1, roughness: 0.3 });
      const a = gear(16, 0.5, steel), b = gear(10, 0.32, brass);
      a.position.x = -0.24; b.position.x = 0.24 + 0.33;
      b.rotation.z = Math.PI / 10;
      g.add(a, b);
      g.scale.setScalar(1.15);
      g.userData.tick = (dt) => { a.rotation.z += dt * 0.6; b.rotation.z -= dt * 0.6 * 1.6; };
      place(g, 2, 'engineering');
    }

    // Math: a saddle surface z = x² − y² with a coloured height map.
    {
      const g = new THREE.Group();
      const geo = new THREE.PlaneGeometry(1.4, 1.4, 48, 48);
      const pos = geo.attributes.position, col = [];
      const c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) / 0.7, y = pos.getY(i) / 0.7, z = (x * x - y * y) * 0.35;
        pos.setZ(i, z);
        c.setHSL(0.75 - (z + 0.35) * 0.5, 0.8, 0.55);
        col.push(c.r, c.g, c.b);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.35, clearcoat: 0.6 }));
      m.rotation.x = -Math.PI / 2;
      g.add(m);
      g.userData.tick = (dt) => (g.rotation.y += dt * 0.3);
      place(g, 3, 'math');
    }

    return {
      update(dt, t) {
        for (const g of items) {
          g.userData.tick?.(dt, t);
          g.position.y = 1.3 + Math.sin(t * 0.9 + g.position.x) * 0.06;
        }
      },
    };
  },
};

/** A simple spur gear: `n` teeth, pitch radius `r`. */
export function gear(n, r, mat, thick = 0.12) {
  const s = new THREE.Shape();
  const ro = r + 0.045, ri = r - 0.05;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, w = (Math.PI * 2) / n;
    const pts = [[ri, a], [ro, a + w * 0.18], [ro, a + w * 0.45], [ri, a + w * 0.63]];
    pts.forEach(([rr, aa], k) => (i === 0 && k === 0 ? s.moveTo(rr * Math.cos(aa), rr * Math.sin(aa)) : s.lineTo(rr * Math.cos(aa), rr * Math.sin(aa))));
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, r * 0.22, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2, curveSegments: 6 });
  geo.translate(0, 0, -thick / 2);
  return new THREE.Mesh(geo, mat);
}
