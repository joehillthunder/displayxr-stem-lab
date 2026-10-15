# STEM Lab 3D

High-school STEM lessons (science, technology, engineering, math) as interactive 3D models for
DisplayXR: glasses-free 3D on Leia displays, 2D in any browser. Plain ES modules, no build step, no
package.json, no external assets. three.js 0.161.0 and `@displayxr/inline3d` 1.45.1 load from jsDelivr
through the import map in `index.html`; pin exact versions if you bump them.

- Live: https://joehillthunder.github.io/displayxr-stem-lab/
- Deploy: push to `main`. GitHub Pages serves the branch root (legacy build + `.nojekyll`). There is no
  CI, and the `gh` token has no `workflow` scope, so don't add GitHub Actions. Test before you push.

## Layout

| File | Role |
|---|---|
| `index.html` | All CSS and DOM: top bar, home hero, lesson panel (Learn / Lab / Quiz tabs), menu drawer, card, toast, import map. |
| `js/main.js` | Boot, orbit camera, lesson loading/disposal, the `ctx` API, picking, quiz, progress (localStorage `stemlab.*`), `window.stem`. |
| `js/stage.js` | DisplayXR rig (attach pattern, one persistent canvas, double-width woven buffer, 2D fallback). Shadows update once per frame. |
| `js/env.js` | The studio: RoomEnvironment IBL, key light with soft shadows, plinth (radius 4.2, top at y = 0), backdrop, dust. `SUBJECT_COLORS`. |
| `js/ui.js` | Control builders behind `ctx.ui`. |
| `js/labels.js` | Text sprites with real depth, constant screen size, `depthTest: false`. |
| `js/home.js` | Home scene: one emblem per subject. Exports a `gear()` helper. |
| `js/lessons/index.js` | The catalogue (`SUBJECTS`, `LESSONS`: id, subject, title, topic, summary). The menu reads it without loading lesson code. |
| `js/lessons/<subject>/<id>.js` | One lesson per file, imported on first open. |
| `tools/serve.ps1`, `tools/shot.ps1` | Local static server and headless screenshot (see Testing). |

## Lessons

| Id | Lesson | Notes |
|---|---|---|
| `atom` | Atoms & Electron Shells | Z 1–18, Bohr shells 2-8-8, ions/isotopes; "stable" only for isotopes on its own list. Orbitals mode samples exact hydrogen wavefunctions. |
| `dna` | DNA & Replication | To-scale B-DNA (0.338 nm rise, 10.5 bp/turn, right-handed). Replication is simplified (no Okazaki fragments), and the Learn text says so. |
| `projectile` | Projectile Motion | No drag. Hides the plinth and builds its own range per world (Earth 120 m, Mars 280 m, Moon 600 m), with equal scale on both axes. |
| `heart` | The Heart & Blood Flow | Stylised frontal four-chamber cutaway (patient's right on the viewer's left). A five-phase cycle model drives chamber volumes, valves, the ECG, lub/dub and ~380 cells that queue at closed valves. CO = HR × SV; end-systolic volume fixed at 50 mL. Blue/red is a colour code (the Learn text says real deoxygenated blood is dark red). |
| `logic` | Logic Gates & Adders | One gate, half adder, full adder, 4-bit ripple-carry adder with visible carry delay. |
| `network` | Packets & Routing | 11 routers, 19 links; step-by-step Dijkstra; cut a link to reroute; packets reorder by seq. |
| `pixels` | Pixels, Colour & Bits | RGB cube, subpixels, bit depth 1–8. From 5 bits up the lattice draws only 16 levels (the panel says so). |
| `datacenter` | Data Centers & AI | Cutaway GPU hall (hot/cold aisles, CRAH, CDU liquid loop, cooling tower, utility → UPS → PDU power path, generator) plus an 8-GPU server view. Estimator: compute ≈ 6·N·D, time = 6ND / (GPUs × peak × MFU), energy × PUE, ~10,500 kWh per US home-year; inference ≈ 2·N FLOPs/token. All presented as estimates with editable assumptions. |
| `bridge` | Truss Bridges & Forces | Pratt/Howe/Warren, solved by a full joint-equilibrium linear solve; sag from member stretch (E = 200 GPa). `?selftest` compares hand cases. |
| `engine` | The Four-Stroke Engine | Slider-crank kinematics, cams at half crank speed, spark 8° BTDC; inline-4 option fires 1-3-4-2. |
| `gears` | Gears & Mechanical Advantage | Involute teeth, centre distance m(z1+z2)/2, compound train, rack & pinion. |
| `differential` | The Car Differential | Straight bevel gears (ring 41 / pinion 11 = 3.73, spiders 10, sides 16) mesh phase-correctly. Open: (L+R)/2 = carrier; ice: slipping wheel at 2× carrier, car stops; locked: both at carrier. Gears are drawn oversized next to the wheels (said in Learn). `?selftest` checks speeds and meshing. |
| `surfaces` | Functions of Two Variables | Six functions, marching-squares contours, exact partials, second-derivative test. |
| `trig` | The Unit Circle & Waves | Helix whose wall/floor shadows are sin/cos; exact values at the 16 special angles. |
| `revolution` | Solids of Revolution | Disc/washer Riemann sums vs exact volumes (hand-worked). For sin x the midpoint sum is exact for every n ≥ 2 (a symmetry of sin²x); a note explains it so it isn't mistaken for a bug. |
| `matrices` | Matrices as Transformations | 3×3 editor with column colours = images of i, j, k; presets incl. projection (det 0); det sign/volume; eigen-lines/planes from the characteristic cubic; compose B·A vs A·B. Turns on `renderer.localClippingEnabled` for its clipping box and restores it in `dispose()`. `?selftest` (19 checks). |

### Adding a lesson

1. Add an entry to `LESSONS` in `js/lessons/index.js` (title and summary appear in the menu and hero).
2. Create `js/lessons/<subject>/<id>.js` following the contract below.
3. Screenshot it with `?mono&snap&lesson=<id>` and read the log for errors. Check the Learn and Quiz tabs too.
4. If the subject or lesson count changes, update the HQ room description (see Related) and the README.

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
  quiz: [{ q, choices: [4 strings], answer: index, why: 'explanation' }, …], // 5 questions
  build(ctx) { …; return { update(dt, t) {}, dispose() {}, onKey(e) {} }; },
};
```

`ctx` gives you:

- `ctx.THREE`, `ctx.root` (a Group: put **everything** in it; it and all geometries, materials and
  textures under it are disposed when the lesson closes), `ctx.camera`, `ctx.renderer`, `ctx.envMap`.
- `ctx.ui.slider(label, { min, max, step, value, fmt, onChange })`, `toggle`, `choice` (segmented,
  `options: [{value,label}]`), `select`, `button(label, fn, { primary })` (consecutive buttons share a
  row), `readout(label)` → `{ set(html) }`, `note(html)` → `{ set(html) }`, `heading(text)`. All
  controls go in the Lab tab. There's no text-input builder; `dna.js` puts its own `<input>` in a note.
- `ctx.label(text, { color, bg, size, anchorY })` → a sprite (add it to something in `ctx.root`);
  `ctx.relabel(old, text, opts)` swaps its text. Labels draw over everything (`depthTest: false`), so
  hide them yourself when they would show through a model.
- `ctx.pickable(obj, onPick(hit), onHover(hit|null))`: a click without a drag raycasts these (and their
  children; sprites, lines and points are skipped). `ctx.unpickable(obj)` removes one, which matters for
  lessons that rebuild models. `ctx.card(titleHtml, bodyHtml, { kind })` / `ctx.hideCard()` show an info
  card; `ctx.toast(text, 'good')`.
- `ctx.view({ yaw, pitch, dist, target }, instant)` eases (or jumps) the camera.
- `update(dt, t)` runs once per frame (not per eye). Keep it allocation-free: reuse vectors and rebuild
  geometry only when a setting changes.

Rules the framework applies for you, so don't redo them in a lesson:

- **Panel offset.** `sideShift()` in `main.js` slides the camera sideways so the orbit target sits in the
  middle of the space the 370 px lesson panel leaves free (only in lesson mode, wider than 760 px). Keep
  `view.target` on the model's real centre; don't shift it to make room for the panel.
- **Quiz shuffle.** Choices are shuffled every attempt and `answer` is remapped, so author `answer` as the
  index in the array you wrote. Never write order-dependent choices ("all of the above", "both A and B").
- **`?snap`** skips the camera ease. Some lessons still carry their own older `snapView()` helper; it's
  harmless.

## Look and scale

- Units are about metres. The plinth top is y = 0, radius 4.2; keep a model inside roughly a
  4 × 3.5 × 4 box above it, centred on x = z = 0. The default camera is ~8 units away.
- High fidelity is the point: `MeshPhysicalMaterial`/`MeshStandardMaterial` with real roughness and
  metalness (the scene has an environment map), clearcoat on plastics, transmission for glass, emissive
  + `toneMapped: false` for glowing signals, smooth geometry, `castShadow` on solid parts.
  `InstancedMesh` for repeated parts (bolts, lattice cubes, nucleons). Build geometry in code and draw
  textures on canvases.
- No post-processing (it would run per eye). No `logarithmicDepthBuffer`.
- Subject colours: science `#4fd1a5`, technology `#5aa9ff`, engineering `#ffb347`, math `#c38bff`.

## Facts

The audience is high-school students and their teachers. Every claim, number and quiz answer must be
correct and checkable. Simulations use the real equations, and `explain` says which ones and what is
simplified (no air resistance, no Okazaki fragments, Bohr model vs orbitals, ideal gears). List a
standard only when you're sure of the code. Some current ones are loose fits, flagged by their authors:
`engine` HS-PS3-3 and `logic` CSTA 3A-CS-02.

## DisplayXR rules

- One persistent canvas; never replace it. `renderer.setPixelRatio(1)`; the woven buffer is double width,
  and the per-eye width is capped at 2560 px.
- In `xrFrame`, validate the views before clearing. A bad frame is skipped, never drawn black.
- Convergence = 1.08 × camera distance (floor 0.6); eye separation = dist / 1.8, clamped 0.2–5, times
  the depth slider.
- DOM UI sits flat on the glass; anything that should have depth is a sprite or mesh in the scene.

## Testing (demo PC: no Python or Node)

- Serve: `pwsh -NoProfile -File tools/serve.ps1 -Root . -Port 8796` (8765 and 8791 are taken by other demos).
- Screenshot + console:
  `pwsh -NoProfile -File tools/shot.ps1 -Url "http://localhost:8796/?mono&snap&lesson=atom" -Out <png>`
  (headless Edge, SwiftShader). Console lines land in `<png>.log`, and the script prints the
  interesting ones. A healthy page logs `[stem] opened <id>`. A lesson that throws in `build` logs
  `[stem] lesson build failed` and shows the toast "This lesson hit an error".
- Always check one page after editing `main.js` before batch-screenshotting: a syntax error there blanks
  every lesson (the page then shows only the home hero with no 3D).
- App URL options: `?lesson=<id>`, `?tab=learn|lab|quiz`, `?snap`, `?mono`, `?depth=0-2`, `?subject=<id>`.
- Lessons read their own test-only URL options to pose a state for a screenshot (headless runs only a
  few frames, so you can't click or wait). Read the top of `build()` in each file for its list, e.g.
  bridge `truss/pos/load/forces/pick/selftest`, logic `logicmode/gate/in/a/b`, network `src/dst/step/cut`,
  pixels `rgb/bits/cube`, trig `theta/tan/wave/look`, revolution `curve/n/sweep/discs/washer`,
  atom `el/n/e/orb`, dna `seq/demo/fork`, projectile `w/a/v/h/demo`, heart
  `hr/sv/phase/tau/wall/flow/follow/cam/pick`, datacenter `view/mode/cool/n/d/gpus/pue/outage/pick`,
  differential `sc/r/rpm/lock/housing/look/pick/selftest`, matrices `m/preset/theta/t/eig/vec/compose/selftest`.
- `window.stem` exposes `{ stage, studio, view, open(id), current, setTab, LESSONS }`.
- three's `MarchingCubes` addon defaults to `isolation = 80`; set it to 0 for a signed-distance field or the mesh is silently empty (the heart hit this).
- Headless gotchas: transmission materials (the revolution solid) render milky under SwiftShader; judge
  them on a real GPU. Headless can't go narrower than about 500 px, so check phone layout on a device.
- Woven 3D can only be checked in the DisplayXR Browser on the Leia panel
  (`C:\Program Files\DisplayXR\Browser\chrome.exe --user-data-dir=<scratch> --enable-logging --v=0`,
  then look for `[stem] firstWoven` and the 5 s frame stats in `chrome_debug.log`). GDI screenshots of the
  woven panel come out blank.

## Status

- Not yet checked woven on the Leia panel (depth comfort, labels drawn over models).
- Real mouse clicks, drags and hover have not been exercised; headless tests posed states through URL
  options instead.

## Git

- Commit messages end with a `Co-Authored-By` line when an agent writes the commit.
- Files are committed with CRLF on this PC (`core.autocrlf`). When editing with perl/sed, match `\r?\n`.

## Related

The HQ homepage room is `stem-lab` in the Training Center of `joehillthunder/joehillthunder.github.io`
(`home/demos.js` entry and a lab-bench set piece in `home/office.js`). Use your own worktree there
(`git worktree add ../<name>-wt -b <branch> origin/main`): the shared clone often has other sessions'
uncommitted work. Ship HQ changes through a PR.
