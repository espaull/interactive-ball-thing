# Ball Playground

A physics playground for children: draw tracks, drop balls, sledges and
bubbles, add boosts, portals, cups and cannons. Free play is the sandbox;
Levels are puzzles (get the rider into the cup with limited pieces,
collecting hearts). Runs in the browser (Mac, PC, phones and tablets).
Vite + TypeScript + Planck.js (a Box2D port) + Canvas 2D.

Live site: https://espaull.github.io/interactive-ball-thing/ — every push to
`main` checks formatting, tests, builds and deploys it
(`.github/workflows/deploy.yml`).

## Commands

- `npm run dev` — dev server (add `-- --host` to open it on a phone)
- `npm test` — Vitest (the physics runs headless, no browser needed). Tests
  that need the DOM, like `tools/input.test.ts`, start with
  `// @vitest-environment happy-dom`; everything else runs in plain Node.
- `npx tsc -p .` — type-check
- `npm run format` — Prettier (default settings); `format:check` to verify

## Layout

- `src/world/` — the simulation. `playground.ts` owns the Planck world,
  balls (and sledges, a `Ball` subclass, so everything that works on balls
  works on them), bubbles and stepping (which does nothing while `paused`: every
  timer runs on the playground's own time, so everything waits). The
  design is made of **parts** (`part.ts`): `lines`, `boosts`, `portals`,
  `cups`, `cannons`, each a module that keeps
  its own things and erases, picks up, saves and loads them
  (`playground.cups.add(…)`, `playground.cannons.aim(…)`). Their fields are
  read-only outside the part: every change goes through it, which bumps
  `playground.revision` and emits `designChanged` (Undo and the autosave
  rely on this). What isn't saved (a cannon being held or its next shot, a
  cup's count) isn't the design, so changing it doesn't count. Things can
  be **fixed** (a level's own pieces, loaded with `playground.fix(…)`):
  they work like any other but can't be erased, moved or joined onto, and
  aren't in `layout()`, so saves and Undo never see them. `saved.ts`
  has the helpers each part's parser uses. `bubbles` and `crossings` add
  behaviour on top of Planck. `budget.ts` holds a level's limits (ink and
  boost in pixels, portals etc. counted) and what's left of each; each
  tool names the `supply` it uses, and the toolbar only offers tools the
  budget allows.
  **Planck works in metres; only code in `world/` may touch Planck bodies
  or `PX_PER_M`.** Everything else uses pixels (`ball.position`).
- `src/tools/` — one class per toolbar tool, implementing `Tool` (`tool.ts`).
  `input.ts` handles the shared plumbing: pointer capture, panning (Space or
  middle-drag), wheel zoom, two-finger touch gestures, popping bubbles,
  keyboard shortcuts, and saying when an action has ended.
- `src/geometry/` — pure maths: smoothing, splines, simplification, erasing,
  line joining. Easiest code to unit-test.
- `src/render/` — drawing; `design.ts` draws the design for the screen and
  the gallery's pictures (which are fitted using each part's `extent`).
  `src/palette.ts` holds the colours.
- `src/levels/` — `level.ts` (what a level is), `levels.ts` (the levels, in
  order), `play.ts` (`LevelPlay`: fixes a level's pieces, sets the budget,
  keeps the rider waiting paused until Go, collects hearts, wins at the
  goal cup, resets a lost or stuck rider). `solutions.ts` is only for
  `levels.test.ts`, which proves every level can be won with every heart
  within its limits. **A new or changed level needs its solution updated
  and that test passing.**
- `src/ui/` — the HTML controls: `toolbar` (tool buttons, menus, hint,
  supply meters), `actions` (Pause, Follow, Home, Undo, Clear),
  `background`, `gallery`, `levels` (front screen, level map, win panel,
  Go and Back, and switching between free play and a level).
  Each `setup…` takes the `App` (`src/app.ts`), which `main.ts` builds
  before running the fixed-step game loop. Keyboard shortcuts (plain keys
  like P, or with Ctrl/Cmd) go through `input.addShortcut`, so the tools
  never see them.
- `src/guides.ts` — help for building around a moving ball, shown while
  paused: the trail behind the followed (or newest) ball (recorded after
  each physics step all the time, so it's there when you pause), and the
  path it'll take (`world/prediction.ts` runs a hidden
  copy of the playground with the design and that ball, worked out again
  only when the design or the ball changes).
- `src/signal.ts` — `Signal`, for things several parts of the app listen to
  (`input.actionEnded`, `playground.designChanged`, `history.changed`).
  Effects and sounds use plain callbacks (`playground.onCatch`), as only
  `main.ts` listens to them.
- `src/saves.ts` — the autosave (2s after a change; paused while in a
  level, so a level never overwrites free play), the gallery, and level
  progress (most hearts per level), in `localStorage`. What's saved is a
  `Layout` (`world/layout.ts`): each part's things, no balls or bubbles.
- `src/history.ts` — Undo/redo: snapshots of the `Layout`, checkpointed
  whenever `Input` says an action has ended (and after Clear and loading),
  skipped when `playground.revision` hasn't moved.

## Adding things

- **A tool:** write a class implementing `Tool` in `src/tools/`, then add it
  to a group in `tools/index.ts`. The toolbar button, hint and cursor come
  from the class. Groups with several tools open a menu. A tool with
  half-done work (like the Curve tool's points) can offer `canUndoStep` and
  `undoStep`, which Undo steps back through before the design's history.
- **A new kind of thing in the design:** a module in `world/` with a class
  implementing `Part` (see `cups.ts` for a small one) and a parser for its
  saved form, which must cope with the data being missing (older saves).
  Every change to it goes through the part and calls `changed`. Then add
  it to `Playground` (a field, `parts`, `layout`, `restoreLayout`), to
  `Layout`, `emptyLayout` and `parseLayout`, and draw it in
  `render/design.ts`. `parts` is in drawing order from the top, so what's
  picked up is what's on top. It's then erased, picked up by the Move tool,
  saved, undone and pictured without more work, but the Eraser's and Move
  tool's hints list what they work on.
- **Other things in the world:** hook into `Playground.step`. Expose
  callbacks (like `onCatch`) for effects and sounds, which `main.ts` wires
  to `render/effects.ts` and `sound.ts` (sounds are synthesised, no audio
  files).

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
- **The toolbar sizes itself:** `ui/toolbar.ts` measures it and adds the
  `toolbar-compact`, `-tight` and `-rows` classes (in `style.css`) until it
  fits with 16px either side. Don't add screen-width breakpoints for it; a
  new button just works.
- Phones: the canvas is sized from its own box (not `100vh`), so touches
  land where they're drawn; a single touch waits 100ms before reaching the
  tool, in case it's the start of a pinch.
