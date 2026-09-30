// The level editor. Anyone can make levels (from the My levels tab), which
// are kept in the browser; while running `npm run dev` it can also edit the
// built-in levels, saving their files into the project. A level's pieces
// are drawn with the normal tools, and the Start, Goal and Heart tools
// place the rest. It can only be saved once it's been won with every heart
// in Try it, and that win's pieces are saved as its solution (for the
// built-in levels, levels.test.ts replays it).
import type { App } from "../app";
import { boundsOf, type Point } from "../geometry/point";
import type { LevelDraft } from "../levels/draft";
import { newLevelId, type Level, type LevelLimits } from "../levels/level";
import { LEVELS } from "../levels/levels";
import type { MyLevel } from "../saves";
import { emptyLayout, type Layout } from "../world/layout";
import { levelTile, type Editor, type LevelScreens } from "./levels";
import { labelled } from "./toolbar";

// Where the dev server saves a level (dev/level-files.ts).
const SAVE_PATH = "/__levels/save";
// Remembers which built-in level to reopen after saving reloads the page.
const REOPEN_KEY = "editing";

// What's being edited: one of My levels (or a new one), or (in dev) one of
// the built-in levels.
type Target = { mine: MyLevel | null } | { project: Level | null };

export function setupEditor(
  { playground, history, toolbar, camera, saves }: App,
  screens: LevelScreens,
  draft: LevelDraft,
): Editor {
  const panel = document.createElement("form");
  panel.id = "editor-panel";
  document.body.append(panel);
  let target: Target = { mine: null };
  let status = "";
  // The level as it was last saved (or opened), to tell if it's changed.
  let saved = "";

  // --- Editing ---

  function edit(to: Target): void {
    target = to;
    if ("mine" in to) {
      draft.load(to.mine?.level ?? null);
      // A new level, or a copy of one shared with you, gets an id of its
      // own.
      if (!to.mine?.made) draft.update({ id: newLevelId() });
      if (!to.mine) draft.update({ name: "My level" });
      resume(to.mine?.level.pieces ?? emptyLayout());
    } else {
      draft.load(to.project);
      resume(to.project?.pieces ?? emptyLayout());
    }
    saved = snapshot();
  }

  // Carry on editing the draft, with these pieces.
  function resume(pieces: Layout): void {
    screens.enterEditor();
    showGoal();
    playground.loadLayout(pieces);
    history.reset();
    toolbar.update();
    toolbar.setNote(
      "Draw your level, then place its start 🚩, goal 🏆 and hearts ❤️",
    );
    if ("mine" in target) {
      screens.setBack("Levels", "Back to my levels", () => {
        if (leave()) screens.showMap("mine");
      });
    } else {
      screens.setBack("Levels", "Back to the levels to edit", () => {
        if (leave()) showProjectList();
      });
    }
    status = "";
    id.parentElement!.hidden = !("project" in target);
    name.value = draft.name;
    tip.value = draft.tip;
    id.value = draft.id;
    showDraft();
    frame();
    screens.show(null);
  }

  // Everything about the level, to tell whether it's changed.
  function snapshot(): string {
    const { id, name, tip, rider, start, goal, hearts, limits } = draft;
    const pieces = playground.layout();
    return JSON.stringify({
      id,
      name,
      tip,
      rider,
      start,
      goal,
      hearts,
      limits,
      pieces,
    });
  }

  // Leaving the editor: true to go ahead (asking first if it's not saved).
  function leave(): boolean {
    return (
      snapshot() === saved || window.confirm("Leave without saving your level?")
    );
  }

  // The goal cup is fixed, as it will be in the level.
  function showGoal(): void {
    playground.fix({
      ...emptyLayout(),
      cups: draft.goal ? [draft.goal] : [],
    });
  }

  // Show all of the level (clear of the panel), or the start of the world
  // if it's empty.
  function frame(): void {
    const points: Point[] = [...draft.hearts];
    if (draft.start) points.push(draft.start);
    if (draft.goal) points.push(draft.goal);
    const design = playground.designBounds();
    if (design) {
      points.push(
        { x: design.left, y: design.top },
        { x: design.right, y: design.bottom },
      );
    }
    const toolbarBottom = document
      .querySelector("#toolbar")!
      .getBoundingClientRect().bottom;
    camera.homeView =
      points.length > 0
        ? {
            box: boundsOf(points),
            margins: {
              top: toolbarBottom + 12,
              bottom: 70,
              left: panel.getBoundingClientRect().right + 16,
              right: 16,
            },
          }
        : null;
    camera.home();
  }

  function tryIt(): void {
    const pieces = playground.layout();
    const level = draft.level(pieces);
    if (!level) {
      setStatus("Place a start 🚩 and a goal 🏆 first");
      return;
    }
    screens.tryLevel(level, {
      won: (hearts) => draft.won(level, playground.layout(), hearts),
      back: () => resume(pieces),
    });
  }

  async function save(): Promise<void> {
    const pieces = playground.layout();
    const needs = draft.needs(pieces);
    const level = draft.level(pieces);
    if (needs.length > 0 || !level) {
      setStatus(`Still needs ${needs.join(", ")}`);
      return;
    }
    if ("mine" in target) {
      if (!saves.keepLevel({ level, made: true })) {
        setStatus("No room to save it · delete a level you don't need");
        return;
      }
      saved = snapshot();
      screens.showMap("mine");
      return;
    }
    // A built-in level: its file, through the dev server.
    setStatus("Saving…");
    try {
      const response = await fetch(SAVE_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(level),
      });
      if (!response.ok) throw new Error(await response.text());
      // Saving changes the level files, so the page reloads: open this one
      // again when it does. (If nothing changed, it won't reload.)
      sessionStorage.setItem(REOPEN_KEY, level.id);
      saved = snapshot();
      setStatus(`Saved as ${level.id}.json`);
    } catch (error) {
      setStatus(`Couldn't save: ${String(error)}`);
    }
  }

  // --- The panel ---

  const element = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className = "",
    ...children: (Node | string)[]
  ) => {
    const el = document.createElement(tag);
    el.className = className;
    el.append(...children);
    return el;
  };
  const button = (text: string, action: () => void, className = "") => {
    const b = element("button", className, text);
    b.type = "button";
    b.addEventListener("click", action);
    return b;
  };
  const textBox = (label: string, placeholder: string) => {
    const input = element("input");
    input.placeholder = placeholder;
    element("label", "", label, input);
    return input;
  };

  const id = textBox("Id", "my-level");
  const name = textBox("Name", "My level");
  const tip = textBox("Tip (if you like)", "What to do");
  for (const input of [id, name, tip]) {
    input.addEventListener("input", () =>
      draft.update({
        id: id.value.trim(),
        name: name.value.trim(),
        tip: tip.value.trim(),
      }),
    );
  }

  // Ball or sledge.
  const riders = (["ball", "sledge"] as const).map((rider) =>
    button(
      rider === "ball" ? "⚽ Ball" : "🛷 Sledge",
      () => draft.update({ rider }),
      "choice",
    ),
  );

  // What the player gets: a − and + for each supply.
  const steppers = (
    [
      ["ink", "✏️ Ink", 50, 5000],
      ["boost", "🚀 Boost", 50, 5000],
      ["portals", "🌀 Portals", 1, 5],
    ] as const
  ).map(([key, label, step, max]) => {
    const value = element("output");
    const change = (by: number) => {
      const amount = Math.max(
        0,
        Math.min(
          max,
          Math.round(((draft.limits[key] ?? 0) + by) / step) * step,
        ),
      );
      const limits: LevelLimits = { ...draft.limits };
      if (amount > 0) limits[key] = amount;
      else delete limits[key];
      draft.update({ limits });
    };
    const row = element(
      "div",
      "stepper",
      element("span", "", label),
      button("−", () => change(-step)),
      value,
      button("+", () => change(step)),
    );
    return { key, value, row };
  });

  const limitButton = button("🎯 Limit to what I used", () =>
    draft.limitToWin(playground.layout()),
  );
  limitButton.title =
    "Give the player just what your win used (and a little spare)";
  const statusLine = element("p", "status");
  const saveButton = button("💾 Save", () => void save());
  const body = element(
    "div",
    "body",
    id.parentElement!,
    name.parentElement!,
    tip.parentElement!,
    element("div", "choices", ...riders),
    element("p", "heading", "What the player gets"),
    ...steppers.map((s) => s.row),
    limitButton,
    statusLine,
    element("div", "buttons", button("▶️ Try it", tryIt), saveButton),
  );
  // Tuck the panel away to see more of the level.
  const collapse = button(
    "◀",
    () => {
      panel.classList.toggle("collapsed");
      collapse.textContent = panel.classList.contains("collapsed") ? "⚙️" : "◀";
    },
    "collapse",
  );
  collapse.title = "Hide or show the level's settings";
  panel.append(
    element("header", "", element("strong", "", "Your level"), collapse),
    body,
  );
  panel.addEventListener("submit", (e) => e.preventDefault());

  // Show the draft's rider, supplies and status (not its text, which would
  // move the cursor while typing).
  function showDraft(): void {
    riders.forEach((b, i) =>
      b.classList.toggle(
        "active",
        draft.rider === (i === 0 ? "ball" : "sledge"),
      ),
    );
    for (const { key, value } of steppers) {
      value.textContent = String(draft.limits[key] ?? "none");
    }
    const pieces = playground.layout();
    limitButton.disabled = draft.solution(pieces) === null;
    const needs = draft.needs(pieces);
    const ready =
      needs.length === 0 ? "✓ Won with every heart · ready to save" : "";
    statusLine.textContent = status || ready || `Needs ${needs.join(", ")}`;
    saveButton.disabled = needs.length > 0;
  }

  function setStatus(message: string): void {
    status = message;
    showDraft();
  }

  // Keep the goal cup and the panel up to date while editing.
  draft.changed.listen(() => {
    if (screens.mode !== "editor") return;
    showGoal();
    status = "";
    showDraft();
  });
  playground.designChanged.listen(() => {
    if (screens.mode === "editor") showDraft();
  });

  // --- Built-in levels (dev only) ---

  let showProjectList = () => {};
  if (import.meta.env.DEV) {
    const list = listScreen();
    showProjectList = () => {
      const tiles = LEVELS.map((level, i) => {
        const levelId = labelled(level.id);
        levelId.className = "id";
        const tile = levelTile(String(i + 1), level.name, levelId);
        tile.addEventListener("click", () => edit({ project: level }));
        return tile;
      });
      const add = levelTile("➕", "New level", labelled(""));
      add.addEventListener("click", () => edit({ project: null }));
      list.querySelector(".levels")!.replaceChildren(...tiles, add);
      screens.show(list);
    };
    const editorButton = element("button", "", "🛠️", labelled("Editor"));
    editorButton.addEventListener("click", showProjectList);
    screens.addFrontButton(editorButton);

    // Back from saving (which reloaded the page): carry on editing.
    const reopen = sessionStorage.getItem(REOPEN_KEY);
    sessionStorage.removeItem(REOPEN_KEY);
    const level = LEVELS.find((l) => l.id === reopen);
    if (level) {
      edit({ project: level });
      setStatus(`Saved as ${level.id}.json`);
    }
  }

  // The list of built-in levels to edit, like the level map.
  function listScreen(): HTMLElement {
    const back = button("⬅️", () => screens.showFront(), "back");
    back.title = "Back";
    const el = element(
      "div",
      "screen",
      element(
        "div",
        "card",
        element("header", "", back, element("h2", "", "Edit a level")),
        element("div", "levels"),
      ),
    );
    el.id = "editor-list";
    el.hidden = true;
    document.body.append(el);
    screens.addScreen(el);
    return el;
  }

  return { edit: (mine) => edit({ mine }) };
}
