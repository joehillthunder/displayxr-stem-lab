# STEM Lab 3D

Sixteen hands-on high-school STEM labs as interactive 3D models. On a DisplayXR (Leia) display the
models stand out of the screen in glasses-free 3D; in any other browser they render in 2D.

**Live:** https://joehillthunder.github.io/displayxr-stem-lab/

| Subject | Lessons |
|---|---|
| **Science** | Atoms & Electron Shells · DNA & Replication · Projectile Motion · The Heart & Blood Flow |
| **Technology** | Logic Gates & Adders · Packets & Routing · Pixels, Colour & Bits · Data Centers & AI |
| **Engineering** | Truss Bridges & Forces · The Four-Stroke Engine · Gears & Mechanical Advantage · The Car Differential |
| **Math** | Functions of Two Variables · The Unit Circle & Waves · Solids of Revolution · Matrices as Transformations |

Every lesson has three tabs:

- **Learn**: the idea in plain words, the key equation, vocabulary and the standards it supports.
- **Lab**: the 3D model with live controls. Drag to rotate, scroll or pinch to zoom, right-drag to
  pan, and click parts for details.
- **Quiz**: five questions with explanations. Your best score is saved in the browser, and a perfect
  score earns a ★ on the lesson.

URL options: `?lesson=<id>` (for example `?lesson=bridge`) opens a lesson directly, `?tab=learn|lab|quiz`,
`?mono` forces 2D and `?depth=0-2` sets the stereo depth.

Built with three.js 0.161 and the DisplayXR inline-3D SDK 1.45.1. There's no build step: it's static
files served by GitHub Pages. See `CLAUDE.md` for how lessons are written and tested.
