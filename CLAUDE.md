# Ball Playground

A physics playground for a young child: draw tracks, drop balls and bubbles,
add boosts, portals, cups and cannons. Runs in the browser (Mac, PC, phones
and tablets). Vite + TypeScript + Planck.js (a Box2D port) + Canvas 2D.

Live site: https://espaull.github.io/interactive-ball-thing/ — every push to
`main` tests, builds and deploys it (`.github/workflows/deploy.yml`).

## Commands

- `npm run dev` — dev server (add `-- --host` to open it on a phone)
- `npm test` — Vitest (the physics runs headless, no browser needed)
- `npx tsc -p .` — type-check
- `npm run format` — Prettier (default settings); `format:check` to verify

## Layout

- `src/world/` — the simulation. `playground.ts` owns the Planck world,
  lines, balls and stepping; each feature has its own module (`bubbles`,
  `boosts`, `portals`, `cups`, `cannons`, `crossings`). **Planck works in
  metres; only code in `world/` may touch Planck bodies or `PX_PER_M`.**
  Everything else uses pixels (`ball.position`, `bubble.position`).
- `src/tools/` — one class per toolbar tool, implementing `Tool` (`tool.ts`).
  `input.ts` handles the shared plumbing: pointer capture, panning (Space or
  middle-drag), wheel zoom, two-finger touch gestures, popping bubbles.
- `src/geometry/` — pure maths: smoothing, splines, simplification, erasing,
  line joining. Easiest code to unit-test.
- `src/render/` — drawing; `palette.ts` holds the colours.
- `src/ui.ts` — toolbar, hints, background picker, saves gallery; `main.ts`
  wires it all up and runs the fixed-step game loop.
- `src/saves.ts` — the autosave and the gallery, in `localStorage`. What's
  saved is a `Layout` (`world/layout.ts`): the design only, no balls or
  bubbles.
- `src/history.ts` — Undo/redo: snapshots of the `Layout`, checkpointed
  whenever `Input` says an action has ended (and after Clear and loading).

## Adding things

- **A tool:** write a class implementing `Tool` in `src/tools/`, then add it
  to a group in `tools/index.ts`. The toolbar button, hint and cursor come
  from the class. Groups with several tools open a menu. A tool with
  half-done work (like the Curve tool's points) can offer `canUndoStep` and
  `undoStep`, which Undo steps back through before the design's history.
- **Something in the world:** its own module in `world/`, hooked into
  `Playground.step`, `eraseAt` and `clear`. Expose callbacks (like `onCatch`)
  for effects and sounds, which `main.ts` wires to `render/effects.ts` and
  `sound.ts` (sounds are synthesised, no audio files). If it's part of the
  design, add it to `Layout`, `parseLayout`, `Playground.layout`/`loadLayout`
  and the thumbnail (`render/thumbnail.ts`). Saves already out there won't
  have it, so parsing must cope with it missing.

## Working agreements

- Each feature or fix in its **own commit**, so it can be reverted alone.
- **Don't push unless asked** (pushing publishes the live site).
- Add tests for new behaviour. For bugs, write a failing test first, and
  check it fails without the fix.
- Verify changes in the running app (the browser pane), not just the tests.
  Touch gestures can only be simulated there, so check them on a real device.
- Offer a choice when a design decision is genuinely open.

## Things worth knowing

- **Loop-the-loops:** a 2D loop must cross its own track. `world/crossings.ts`
  lets a ball pass through where a line crosses _itself_, following the
  stretch it's on (or was on in the last 0.3s, as fast balls hop off at
  bumps). Separate lines still block each other.
- Bubbles pop on their 3rd bump; bumps are counted once per physics step,
  because a line is many segments and contacts flicker between them.
- Planck reuses contact objects, so any set of contacts must be cleaned up
  in `end-contact`.
- Phones: the canvas is sized from its own box (not `100vh`), so touches
  land where they're drawn; a single touch waits 100ms before reaching the
  tool, in case it's the start of a pinch.
