// STEM Lab 3D: high-school science, technology, engineering and math lessons as interactive 3D
// models, in glasses-free 3D on a DisplayXR display and in 2D in any browser.
//
//   stage.js        the DisplayXR camera rig (woven 3D on a Leia display, 2D elsewhere)
//   env.js          the studio: lighting, environment map, plinth
//   ui.js           control builders for the lesson panel
//   lessons/        the catalogue (index.js) and one module per lesson
//   home.js         the subject emblems shown on the home screen
//
// URL options: ?lesson=<id> opens a lesson, ?mono forces 2D, ?depth=0-2, ?tab=learn|lab|quiz,
// ?snap skips the camera ease (for headless screenshots).

import * as THREE from 'three';
import { Stage } from './stage.js';
import { Studio, SUBJECT_COLORS } from './env.js';
import { makeUI } from './ui.js';
import { makeLabel, disposeLabel, updateLabels } from './labels.js';
import { SUBJECTS, LESSONS, lessonById, subjectById } from './lessons/index.js';
import HOME from './home.js';
import { clamp, damp, dampAngle } from './util.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

const store = {
  get(k, d) { try { const v = localStorage.getItem('stemlab.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('stemlab.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const progress = store.get('progress', {}); // { [lessonId]: { visited, best, total } }
const saveProgress = () => store.set('progress', progress);

// ── stage ────────────────────────────────────────────────────────────────────────────────────

const stage = new Stage($('stage'));
const studio = new Studio(stage.renderer, stage.scene);

const view = {
  yaw: 0, pitch: 0.3, dist: 8, target: new THREE.Vector3(0, 1, 0),
  goal: null, // { yaw, pitch, dist, target } the camera eases toward
  minDist: 2, maxDist: 24,
  auto: 0, lastInput: 0,
};

function setView(v, instant = false) {
  const goal = {
    yaw: v.yaw ?? view.yaw, pitch: v.pitch ?? view.pitch, dist: v.dist ?? view.dist,
    target: v.target ? new THREE.Vector3().fromArray(v.target) : view.target.clone(),
  };
  if (v.minDist) view.minDist = v.minDist;
  if (v.maxDist) view.maxDist = v.maxDist;
  if (instant) { Object.assign(view, { yaw: goal.yaw, pitch: goal.pitch, dist: goal.dist }); view.target.copy(goal.target); view.goal = null; }
  else view.goal = goal;
}

const rightV = new THREE.Vector3(), lookV = new THREE.Vector3();
/** World units to shift the camera right: half the panel width, at the target distance. */
function sideShift() {
  if (document.body.dataset.mode !== 'lesson') return 0;
  const W = innerWidth, panel = $('panel').offsetWidth + 24;
  if (W < 760 || !panel) return 0;
  const halfW = view.dist * Math.tan((stage.cam.fov * Math.PI) / 360) * stage.cam.aspect;
  return (halfW * panel) / W;
}

function updateCamera(dt) {
  const g = view.goal;
  if (g) {
    view.yaw = dampAngle(view.yaw, g.yaw, 4, dt);
    view.pitch = damp(view.pitch, g.pitch, 4, dt);
    view.dist = damp(view.dist, g.dist, 4, dt);
    view.target.lerp(g.target, 1 - Math.exp(-4 * dt));
    if (Math.abs(view.dist - g.dist) < 0.01 && view.target.distanceTo(g.target) < 0.01) view.goal = null;
  } else if (view.auto && performance.now() - view.lastInput > 4000) {
    view.yaw += view.auto * dt;
  }
  const cp = Math.cos(view.pitch);
  stage.cam.position.set(
    view.target.x + view.dist * cp * Math.sin(view.yaw),
    view.target.y + view.dist * Math.sin(view.pitch),
    view.target.z + view.dist * cp * Math.cos(view.yaw),
  );
  // Slide the camera sideways so the orbit target sits in the middle of the space the lesson panel
  // leaves free (a pure translation, so stereo is unaffected).
  const side = sideShift();
  if (side) {
    rightV.set(Math.cos(view.yaw), 0, -Math.sin(view.yaw)).multiplyScalar(side);
    stage.cam.position.add(rightV);
    lookV.copy(view.target).add(rightV);
    stage.cam.lookAt(lookV);
  } else stage.cam.lookAt(view.target);
  stage.focusDist = view.dist;
}

// ── lessons ──────────────────────────────────────────────────────────────────────────────────

let current = null; // { meta, mod, root, inst, pickables, labels }
let loadToken = 0;
const modules = {};

async function loadModule(id) {
  if (id === 'home') return HOME;
  if (!modules[id]) modules[id] = import(`./lessons/${lessonById[id].subject}/${id}.js`).then((m) => m.default);
  return modules[id];
}

function disposeCurrent() {
  if (!current) return;
  try { current.inst?.dispose?.(); } catch (e) { console.error(e); }
  for (const l of current.labels) disposeLabel(l);
  stage.scene.remove(current.root);
  current.root.traverse((o) => {
    o.geometry?.dispose?.();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const k in m) if (m[k]?.isTexture) m[k].dispose();
      m.dispose();
    }
  });
  current = null;
  hideCard();
}

async function open(id, { push = true } = {}) {
  const token = ++loadToken;
  const meta = id === 'home' ? { id: 'home', subject: null } : lessonById[id];
  if (!meta) return open('home');
  document.body.dataset.mode = id === 'home' ? 'home' : 'lesson';
  $('loading').hidden = false;
  let mod;
  try {
    mod = await loadModule(id);
  } catch (e) {
    console.error('[stem] lesson failed to load', id, e);
    $('loading').hidden = true;
    toast(`Couldn't load that lesson.`);
    return;
  }
  if (token !== loadToken) return;
  disposeCurrent();
  const root = new THREE.Group();
  root.name = 'lesson:' + id;
  stage.scene.add(root);
  current = { meta, mod, root, inst: null, pickables: [], labels: [] };
  studio.configure({ subject: meta.subject || 'science', floor: mod.floor ?? true });
  if (id === 'home') studio.ringMat.color.set('#8fd0ff');
  const v = mod.view || {};
  view.minDist = v.minDist ?? 2;
  view.maxDist = v.maxDist ?? 24;
  view.auto = v.auto ?? 0;
  setView({ yaw: 0.5, pitch: 0.35, dist: 8, target: [0, 1, 0], ...v }, params.has('snap'));

  const ctx = makeCtx(current, $('controls'));
  try {
    current.inst = mod.build(ctx) || {};
  } catch (e) {
    console.error('[stem] lesson build failed', id, e);
    toast('This lesson hit an error while building.');
    current.inst = {};
  }
  $('loading').hidden = true;
  if (id !== 'home') {
    progress[id] = { ...(progress[id] || {}), visited: true };
    saveProgress();
    fillPanel(meta, mod);
  }
  renderMenu();
  if (push) {
    const u = new URL(location.href);
    if (id === 'home') u.searchParams.delete('lesson'); else u.searchParams.set('lesson', id);
    history.pushState({ id }, '', u);
  }
  console.info(`[stem] opened ${id}`);
}

window.addEventListener('popstate', (e) => open(e.state?.id || new URLSearchParams(location.search).get('lesson') || 'home', { push: false }));

function makeCtx(cur, controlsEl) {
  const ui = makeUI(controlsEl);
  return {
    THREE,
    root: cur.root,
    scene: stage.scene,
    camera: stage.cam,
    renderer: stage.renderer,
    envMap: studio.envMap,
    ui,
    color: (s) => SUBJECT_COLORS[s],
    /** A text sprite with real depth; scaled to a constant screen size. */
    label(text, opts) {
      const l = makeLabel(text, opts);
      cur.labels.push(l);
      return l;
    },
    /** Replace a label's text (returns the new sprite, already in the same parent/position). */
    relabel(old, text, opts) {
      const l = makeLabel(text, opts);
      l.position.copy(old.position);
      l.visible = old.visible;
      old.parent?.add(l);
      old.parent?.remove(old);
      disposeLabel(old);
      cur.labels.splice(cur.labels.indexOf(old), 1, l);
      return l;
    },
    /** Make an object clickable. onPick(hit) runs on click; onHover(hit|null) on hover changes. */
    pickable(obj, onPick, onHover) {
      cur.pickables.push({ obj, onPick, onHover });
    },
    /** Stop picking an object (for lessons that rebuild their models). */
    unpickable(obj) {
      cur.pickables = cur.pickables.filter((p) => p.obj !== obj);
    },
    card: showCard,
    hideCard,
    toast,
    /** Ease the camera to a new view: { yaw, pitch, dist, target: [x,y,z] }. */
    view: (v, instant = false) => setView(v, instant),
    openSubject: (s) => { menuSubject = s; renderMenu(); $('menu').classList.add('open'); },
  };
}

// ── panel: learn / lab / quiz ────────────────────────────────────────────────────────────────

let tab = params.get('tab') || 'lab';

function fillPanel(meta, mod) {
  const sub = subjectById[meta.subject];
  const col = SUBJECT_COLORS[meta.subject];
  document.documentElement.style.setProperty('--subject', col);
  $('p-kind').textContent = `${sub.name} · ${meta.topic}`;
  $('p-title').textContent = meta.title;
  $('p-summary').textContent = meta.summary;
  $('learn').innerHTML =
    (mod.explain || '') +
    (mod.formula ? `<div class="formula">${mod.formula}</div>` : '') +
    (mod.vocab?.length ? `<h4>Key words</h4><dl class="vocab">${mod.vocab.map(([w, d]) => `<dt>${w}</dt><dd>${d}</dd>`).join('')}</dl>` : '') +
    (mod.standards?.length ? `<p class="standards">Standards: ${mod.standards.join(' · ')}</p>` : '');
  startQuiz(meta, mod);
  setTab(tab);
}

function setTab(t) {
  tab = t;
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.tab === t);
  for (const p of ['learn', 'lab', 'quiz']) $(p + 'pane').hidden = p !== t;
}
for (const b of document.querySelectorAll('#tabs button')) b.addEventListener('click', () => setTab(b.dataset.tab));

let quiz = null;
function startQuiz(meta, mod) {
  // Shuffle each question's choices, so the right answer isn't always in the same place.
  const qs = (mod.quiz || []).map((q) => {
    const order = q.choices.map((_, k) => k);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    return { ...q, choices: order.map((k) => q.choices[k]), answer: order.indexOf(q.answer) };
  });
  quiz = { meta, qs, i: 0, score: 0, answered: false };
  renderQuiz();
}
function renderQuiz() {
  const pane = $('quizpane');
  const { qs, i, meta } = quiz;
  if (!qs.length) { pane.innerHTML = '<p class="muted">No quiz for this lesson yet.</p>'; return; }
  if (i >= qs.length) {
    const p = progress[meta.id] || {};
    const best = Math.max(p.best ?? 0, quiz.score);
    progress[meta.id] = { ...p, best, total: qs.length };
    saveProgress();
    renderMenu();
    const perfect = quiz.score === qs.length;
    pane.innerHTML = `<div class="qdone"><div class="big">${quiz.score} / ${qs.length}</div><p>${perfect ? 'Perfect score. Lesson mastered!' : quiz.score >= qs.length * 0.75 ? 'Great work. Try again for a perfect score.' : 'Go back to the Lab, try the model again, then retake the quiz.'}</p><p class="muted">Best: ${best} / ${qs.length}</p><div class="btnrow"><button class="btn primary" id="qretry">Retake quiz</button>${nextLessonId(meta.id) ? '<button class="btn" id="qnext">Next lesson →</button>' : ''}</div></div>`;
    $('qretry').onclick = () => startQuiz(meta, current.mod);
    if ($('qnext')) $('qnext').onclick = () => open(nextLessonId(meta.id));
    if (perfect) toast('★ Lesson mastered!', 'good');
    return;
  }
  const q = qs[i];
  pane.innerHTML = `<div class="qhead"><span>Question ${i + 1} of ${qs.length}</span><span>Score ${quiz.score}</span></div><div class="meter"><i style="width:${(i / qs.length) * 100}%"></i></div><p class="qtext">${q.q}</p><div class="qopts">${q.choices.map((c, k) => `<button class="qopt" data-k="${k}">${c}</button>`).join('')}</div><div id="qwhy"></div>`;
  for (const b of pane.querySelectorAll('.qopt')) b.addEventListener('click', () => answer(+b.dataset.k));
}
function answer(k) {
  if (quiz.answered) return;
  quiz.answered = true;
  const q = quiz.qs[quiz.i];
  const ok = k === q.answer;
  if (ok) quiz.score++;
  const btns = $('quizpane').querySelectorAll('.qopt');
  btns.forEach((b, j) => { b.disabled = true; b.classList.toggle('right', j === q.answer); b.classList.toggle('wrong', j === k && !ok); });
  $('qwhy').innerHTML = `<p class="why ${ok ? 'good' : 'bad'}"><b>${ok ? 'Correct.' : 'Not quite.'}</b> ${q.why || ''}</p><button class="btn primary" id="qgo">${quiz.i + 1 < quiz.qs.length ? 'Next question' : 'See score'}</button>`;
  $('qgo').onclick = () => { quiz.i++; quiz.answered = false; renderQuiz(); };
}

function nextLessonId(id) {
  const i = LESSONS.findIndex((l) => l.id === id);
  return LESSONS[i + 1]?.id;
}

// ── menu ─────────────────────────────────────────────────────────────────────────────────────

let menuSubject = params.get('subject') || 'science';

function stars(id) {
  const p = progress[id];
  if (!p) return '';
  if (p.total && p.best === p.total) return '<span class="star" title="Quiz mastered">★</span>';
  if (p.best != null) return `<span class="score">${p.best}/${p.total}</span>`;
  return '<span class="seen" title="Visited">•</span>';
}

function renderMenu() {
  const tabs = SUBJECTS.map((s) => `<button class="subj ${s.id === menuSubject ? 'on' : ''}" data-s="${s.id}" style="--c:${SUBJECT_COLORS[s.id]}"><b>${s.letter}</b><span>${s.name}</span></button>`).join('');
  const sub = subjectById[menuSubject];
  const list = LESSONS.filter((l) => l.subject === menuSubject)
    .map((l) => `<button class="lesson ${current?.meta.id === l.id ? 'on' : ''}" data-l="${l.id}"><span class="t">${l.title}${stars(l.id)}</span><span class="d">${l.topic}</span></button>`)
    .join('');
  $('menu-subjects').innerHTML = tabs;
  $('menu-lessons').innerHTML = `<p class="blurb">${sub.blurb}</p>${list}`;
  $('menu').style.setProperty('--subject', SUBJECT_COLORS[menuSubject]);
  for (const b of $('menu-subjects').querySelectorAll('.subj')) b.onclick = () => { menuSubject = b.dataset.s; renderMenu(); };
  for (const b of $('menu-lessons').querySelectorAll('.lesson')) b.onclick = () => { $('menu').classList.remove('open'); open(b.dataset.l); };

  // Home hero cards.
  $('hero-grid').innerHTML = SUBJECTS.map((s) => {
    const ls = LESSONS.filter((l) => l.subject === s.id);
    const done = ls.filter((l) => progress[l.id]?.total && progress[l.id].best === progress[l.id].total).length;
    return `<section class="hcard" style="--c:${SUBJECT_COLORS[s.id]}"><h3><b>${s.letter}</b>${s.name}</h3><p>${s.blurb}</p>${ls.map((l) => `<button data-l="${l.id}">${l.title}${stars(l.id)}</button>`).join('')}<div class="hfoot">${done}/${ls.length} mastered</div></section>`;
  }).join('');
  for (const b of $('hero-grid').querySelectorAll('button')) b.onclick = () => open(b.dataset.l);
}

$('menu-btn').onclick = () => { if (current?.meta.subject) menuSubject = current.meta.subject; renderMenu(); $('menu').classList.toggle('open'); };
$('menu-close').onclick = () => $('menu').classList.remove('open');
$('home-btn').onclick = () => open('home');
$('reset-view').onclick = () => setView({ yaw: 0.5, pitch: 0.35, dist: 8, target: [0, 1, 0], ...(current?.mod.view || {}) });
$('hero-hide').onclick = () => document.body.classList.toggle('hero-min');

// ── card + toast ─────────────────────────────────────────────────────────────────────────────

function showCard(title, html, { kind = '' } = {}) {
  $('card-kind').textContent = kind;
  $('card-title').innerHTML = title;
  $('card-body').innerHTML = html;
  $('card').hidden = false;
}
function hideCard() { $('card').hidden = true; }
$('card-x').onclick = hideCard;

let toastTimer;
function toast(text, kind = '') {
  const t = $('toast');
  t.textContent = text;
  t.className = 'panel ' + kind;
  t.style.opacity = 1;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.style.opacity = 0), 2600);
}

// ── input: orbit, zoom, pick ─────────────────────────────────────────────────────────────────

const canvas = $('stage');
const pointers = new Map();
let drag = null, pinch = null;
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let hovered = null;

function pickAt(x, y) {
  if (!current) return null;
  const r = canvas.getBoundingClientRect();
  ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, stage.cam);
  const objs = current.pickables.filter((p) => visibleChain(p.obj)).map((p) => p.obj);
  const hits = ray.intersectObjects(objs, true);
  for (const h of hits) {
    if (h.object.isSprite || h.object.isLine || h.object.isPoints) continue;
    let o = h.object;
    while (o) {
      const p = current.pickables.find((pp) => pp.obj === o);
      if (p) return { p, hit: h };
      o = o.parent;
    }
  }
  return null;
}
function visibleChain(o) {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
}

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  view.lastInput = performance.now();
  view.goal = null;
  if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, pan: e.button === 2 || e.shiftKey };
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: view.dist };
    drag = null;
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    view.dist = clamp((pinch.dist * pinch.d) / Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), view.minDist, view.maxDist);
    return;
  }
  if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 5) drag.moved = true;
    if (!drag.moved) return;
    canvas.classList.add('dragging');
    view.lastInput = performance.now();
    if (drag.pan) {
      const k = view.dist * 0.0016;
      const right = new THREE.Vector3().setFromMatrixColumn(stage.cam.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(stage.cam.matrixWorld, 1);
      view.target.addScaledVector(right, -dx * k).addScaledVector(up, dy * k);
    } else {
      view.yaw -= dx * 0.006;
      view.pitch = clamp(view.pitch + dy * 0.005, -1.2, 1.45);
    }
    return;
  }
  if (e.pointerType === 'mouse') {
    const h = pickAt(e.clientX, e.clientY);
    const p = h?.p || null;
    if (p !== hovered) {
      hovered?.onHover?.(null);
      hovered = p;
    }
    p?.onHover?.(h.hit);
    canvas.classList.toggle('hot', !!p);
  }
});
function endPointer(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (drag && pointers.size === 0) {
    if (!drag.moved) {
      const h = pickAt(e.clientX, e.clientY);
      if (h) h.p.onPick?.(h.hit);
    }
    drag = null;
    canvas.classList.remove('dragging');
  }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  view.goal = null;
  view.lastInput = performance.now();
  view.dist = clamp(view.dist * Math.exp(e.deltaY * 0.0012), view.minDist, view.maxDist);
}, { passive: false });
canvas.addEventListener('dblclick', () => $('reset-view').click());

document.addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, select, textarea')) return;
  if (e.key === 'Escape') { if (!$('card').hidden) hideCard(); else if ($('menu').classList.contains('open')) $('menu').classList.remove('open'); else open('home'); }
  if (e.key === 'm' || e.key === 'M') $('menu-btn').click();
  if (current?.meta.id !== 'home') {
    if (e.key === '1') setTab('learn');
    if (e.key === '2') setTab('lab');
    if (e.key === '3') setTab('quiz');
  }
  current?.inst?.onKey?.(e);
});

// ── 2D/3D + depth ────────────────────────────────────────────────────────────────────────────

const depth = clamp(parseFloat(params.get('depth') ?? store.get('depth', 1)), 0, 2);
$('depth').value = depth;
stage.setDepth(depth);
$('depth').addEventListener('input', () => { stage.setDepth(+$('depth').value); store.set('depth', +$('depth').value); });
$('mode3d').onclick = async () => { await stage.setStereo(!stage.stereo); };
stage.onModeChange = (on) => {
  $('mode3d').textContent = on ? '3D' : '2D';
  $('mode3d').classList.toggle('on', on);
  $('badge').textContent = stage.woven ? (on ? 'GLASSES-FREE 3D' : '2D') : '2D PREVIEW';
  $('badge').dataset.kind = stage.woven && on ? 'ok' : '';
};

// ── loop ─────────────────────────────────────────────────────────────────────────────────────

let t = 0;
stage.onTick = (dt) => {
  t += dt;
  updateCamera(dt);
  studio.update(dt);
  try { current?.inst?.update?.(dt, t); } catch (e) { console.error('[stem] update', e); current.inst.update = null; }
};
stage.onEye = (cam) => updateLabels(cam);

async function boot() {
  renderMenu();
  const res = params.has("mono") ? (stage.sizeToCanvas(), stage.monoLoop(), { woven: false }) : await stage.start();
  stage.onModeChange(stage.stereo && res.woven);
  $('mode3d').hidden = !stage.displayModesSupported;
  await open(params.get('lesson') || 'home', { push: false });
  history.replaceState({ id: current?.meta.id }, '', location.href);
  res.firstWoven?.then?.((r) => console.info(`[stem] firstWoven woven=${r?.woven} confirmed=${r?.confirmed}`));
}
boot();

window.stem = { stage, studio, view, open, get current() { return current; }, setTab, LESSONS };
