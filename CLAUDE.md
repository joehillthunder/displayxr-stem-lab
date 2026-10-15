# STEM Lab 3D

High-school STEM lessons (science, technology, engineering, math) as interactive 3D models for
DisplayXR: glasses-free 3D on Leia displays, 2D in any browser. Plain ES modules, no build step, no
package.json. GitHub Pages serves the `main` branch root:
https://joehillthunder.github.io/displayxr-stem-lab/ . There is no CI, so test before you push.

## Layout

| File | Role |
|---|---|
| `index.html` | All CSS and DOM: top bar, home hero, lesson panel (Learn / Lab / Quiz tabs), menu drawer, card, toast. Import map (three 0.161.0, inline3d 1.45.1, jsDelivr). |
| `js/main.js` | Boot, orbit camera, lesson loading/disposal, picking, quiz, progress (localStorage `stemlab.*`), `window.stem`. |
| `js/stage.js` | DisplayXR rig (attach pattern, one persistent canvas, double-width woven buffer, 2D fallback). Shadows update once per frame. |
| `js/env.js` | The studio: RoomEnvironment IBL, key light with soft shadows, plinth (radius 4.2, top at y = 0), backdrop, dust. `SUBJECT_COLORS`. |
| `js/ui.js` | Control builders behind `ctx.ui`. |
| `js/labels.js` | Text sprites with real depth, constant screen size, `depthTest: false`. |
| `js/home.js` | Home scene: one emblem per subject. |
| `js/lessons/index.js` | The catalogue (`SUBJECTS`, `LESSONS`). The menu reads this without loading lesson code. |
| `js/lessons/<subject>/<id>.js` | One lesson per file, imported on first open. |

## The lesson contract

A lesson file default-exports a plain object:

```js
export default {
  view: { dist: 8, yaw: 0.5, pitch: 0.35, target: [0, 1.2, 0], minDist: 3, maxDist: 18, auto: 0 },
  floor: true,              // the plinth; false hides it, { y } moves it
  explain: '<p>…</p>',      // Learn tab HTML: short paragraphs / lists, written for a 15-year-old
  formula: 'R = <i>v</i>²·sin 2θ / <i>g</i>', // optional, HTML (no LaTeX renderer)
  vocab: [['Term', 'definition'], …],
  standards: ['NGSS HS-PS2-1'],  // only codes you are sure of; omit when unsure
  quiz: [{ q, choices: [4 strings], answer: index, why: 'explanation' }, …], // 4–5 questions
  build(ctx) { …; return { update(dt, t) {}, dispose() {}, onKey(e) {} }; },
};
```

`ctx` gives you:

- `ctx.THREE`, `ctx.root` (a Group: put **everything** in it; it and all geometries, materials and
  textures under it are disposed when the lesson closes), `ctx.camera`, `ctx.renderer`, `ctx.envMap`.
- `ctx.ui.slider(label, { min, max, step, value, fmt, onChange })`, `toggle`, `choice` (segmented,
  `options: [{value,label}]`), `select`, `button(label, fn, { primary })`, `readout(label)` →
  `{ set(html) }`, `note(html)` → `{ set(html) }`, `heading(text)`. Controls go in the Lab tab.
- `ctx.label(text, { color, bg, size, anchorY })` → a sprite (add it to something in `ctx.root`);
  `ctx.relabel(old, text, opts)` swaps its text. Labels are depth-free overlays: hide them yourself when
  they would show through a model.
- `ctx.pickable(obj, onPick(hit), onHover(hit|null))`: clicks without a drag raycast these (and their
  children). `ctx.card(titleHtml, bodyHtml, { kind })` / `ctx.hideCard()` show an info card;
  `ctx.toast(text, 'good')`.
- `ctx.view({ yaw, pitch, dist, target }, instant)` eases (or jumps) the camera. `ctx.unpickable(obj)` undoes `pickable`.
- `update(dt, t)` runs once per frame (not per eye). Keep it allocation-free; reuse vectors.

## Look and scale

- Units are about metres. The plinth top is y = 0, radius 4.2; keep a model inside roughly a
  4 × 3.5 × 4 box above it, centred on x = z = 0. The default camera is ~8 units away.
- High fidelity is the point: `MeshPhysicalMaterial`/`MeshStandardMaterial` with real roughness and
  metalness (the scene has an environment map), clearcoat on plastics, transmission for glass, emissive
  + `toneMapped: false` for glowing signals, smooth geometry (enough segments), `castShadow` on solid
  parts. No external assets: build geometry in code and draw textures on canvases.
- No post-processing (it would run per eye). No `logarithmicDepthBuffer`.
- Subject colours: science `#4fd1a5`, technology `#5aa9ff`, engineering `#ffb347`, math `#c38bff`.

## Facts

The audience is high-school students and their teachers. Every claim, number and quiz answer must be
correct and checkable. Simulations should use the real equations (say which in `explain`).

## DisplayXR rules

- One persistent canvas; never replace it. `renderer.setPixelRatio(1)`; the woven buffer is double width.
- In `xrFrame`, validate the views before clearing. A bad frame is skipped, never drawn black.
- Convergence = 1.08 × camera distance (floor 0.6); eye separation scales with distance (cap 5).
- DOM UI sits flat on the glass; anything that should have depth is a sprite or mesh in the scene.

## Testing (demo PC: no Python or Node)

- Serve: `pwsh -NoProfile -File tools/serve.ps1 -Root . -Port 8796` (8765, 8791 are taken by other demos).
- Screenshot + console: `pwsh -NoProfile -File tools/shot.ps1 -Url "http://localhost:8796/?mono&lesson=atom" -Out <png>`
  (headless Edge, SwiftShader; the console lines land in `<png>.log`). A JS error in a lesson shows
  up as a console error and the lesson toast "hit an error".
- `window.stem` exposes `{ stage, studio, view, open(id), current, setTab, LESSONS }`.
- Woven 3D can only be checked in the DisplayXR Browser on the Leia panel
  (`C:\Program Files\DisplayXR\Browser\chrome.exe --enable-logging`, look for `[stem] firstWoven`).

## Related

The HQ homepage room is `stem-lab` in `joehillthunder/joehillthunder.github.io` (`home/demos.js` and a
set piece in `home/office.js`). Use your own worktree there.
