// The lab studio every lesson sits in: an image-based-lighting environment (so metals, glass and
// plastics read as real materials), a key light with soft shadows, a round display plinth and a
// dark gradient backdrop. Lessons only add their own models; the studio stays across lessons.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const SUBJECT_COLORS = {
  science: '#4fd1a5',
  technology: '#5aa9ff',
  engineering: '#ffb347',
  math: '#c38bff',
};

export class Studio {
  constructor(renderer, scene) {
    this.scene = scene;
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
    pmrem.dispose();
    scene.environment = this.envMap;
    scene.background = backdrop();
    scene.fog = new THREE.Fog(0x070b16, 26, 70);

    const hemi = new THREE.HemisphereLight(0xbfd6ff, 0x1a1420, 0.55);
    scene.add(hemi);

    const key = (this.key = new THREE.DirectionalLight(0xfff3e2, 2.2));
    key.position.set(5, 9, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 4;
    const sc = key.shadow.camera;
    sc.left = -7; sc.right = 7; sc.top = 7; sc.bottom = -7; sc.near = 1; sc.far = 30;
    scene.add(key, key.target);

    const rim = new THREE.DirectionalLight(0x8fb8ff, 0.9);
    rim.position.set(-6, 4, -7);
    scene.add(rim);

    // The plinth: a dark satin disc with a glowing subject-coloured edge.
    const plinth = (this.plinth = new THREE.Group());
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.35, 0.18, 96),
      new THREE.MeshStandardMaterial({ color: 0x141a28, roughness: 0.38, metalness: 0.55 }),
    );
    top.receiveShadow = true;
    top.position.y = -0.09;
    this.ringMat = new THREE.MeshBasicMaterial({ color: SUBJECT_COLORS.science, toneMapped: false });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.28, 0.025, 8, 160), this.ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.005;
    const shadowCatcher = new THREE.Mesh(new THREE.CircleGeometry(4.15, 96), new THREE.ShadowMaterial({ opacity: 0.45 }));
    shadowCatcher.rotation.x = -Math.PI / 2;
    shadowCatcher.position.y = 0.002;
    shadowCatcher.receiveShadow = true;
    const grid = new THREE.PolarGridHelper(4.1, 16, 8, 96, 0x2a3550, 0x1c2438);
    grid.position.y = 0.004;
    grid.material.transparent = true;
    grid.material.opacity = 0.5;
    plinth.add(top, ring, shadowCatcher, grid);
    scene.add(plinth);

    // Slow dust motes catch the light and give the empty space depth on a 3D display.
    const n = 260, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 3 + Math.random() * 12, a = Math.random() * Math.PI * 2;
      pos.set([Math.cos(a) * r, Math.random() * 9 - 1, Math.sin(a) * r], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.motes = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9fc4ff, size: 0.035, transparent: true, opacity: 0.55, depthWrite: false }));
    scene.add(this.motes);
  }

  /** Lessons can lower or hide the plinth (`floor: { y }` or `floor: false`). */
  configure({ subject, floor }) {
    this.ringMat.color.set(SUBJECT_COLORS[subject] || '#8fd0ff');
    this.plinth.visible = floor !== false;
    this.plinth.position.y = floor && typeof floor.y === 'number' ? floor.y : 0;
  }

  update(dt) {
    this.motes.rotation.y += dt * 0.012;
  }
}

function backdrop() {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#0d1630');
  grad.addColorStop(0.55, '#080d1c');
  grad.addColorStop(1, '#04060c');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
