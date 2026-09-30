// The level editor (only while running `npm run dev`): a list of the
// levels to edit (or a new one), and while editing, a panel with the
// level's details and limits, Try it and Save. The level's pieces are
// drawn with the normal tools; the Start, Goal and Heart tools place the
// rest. It can only be saved once it's been won with every heart in Try
// it, and that win's pieces are saved as its solution (see
// levels.test.ts). Saving writes its file through the dev server
// (dev/level-files.ts), which then reloads the page, so the editor opens
// the level again afterwards.
import type { App } from "../app";
import { boundsOf, type Point } from "../geometry/point";
import type { LevelDraft } from "../levels/draft";
import type { Level, LevelLimits } from "../levels/level";
import { LEVELS } from "../levels/levels";
import { emptyLayout, type Layout } from "../world/layout";
import { levelTile, type LevelScreens } from "./levels";
import { labelled } from "./toolbar";

// Where the dev server saves a level (dev/level-files.ts).
const SAVE_PATH = "/__levels/save";
// Remembers which level to reopen after saving reloads the page.
const REOPEN_KEY = "editing";

export function setupEditor(
  { playground, history, toolbar, camera }: App,
  screens: LevelScreens,
  draft: LevelDraft,
): void {
  const list = screen();
  const panel = document.createElement("form");
  panel.id = "editor-panel";
  document.body.append(panel);
  let status = "";

  // --- The list of levels to edit ---

  const editorButton = document.createElement("button");
  editorButton.append("🛠️", labelled("Editor"));
  editorButton.addEventListener("click", showList);
  screens.addFrontButton(editorButton);

  function showList(): void {
    const tiles = LEVELS.map((level, i) => {
      const id = labelled(level.id);
      id.className = "id";
      const tile = levelTile(String(i + 1), level.name, id);
      tile.addEventListener("click", () => edit(level));
      return tile;
    });
    const add = levelTile("➕", "New level", labelled(""));
    add.addEventListener("click", () => edit(null));
    list.querySelector(".levels")!.replaceChildren(...tiles, add);
    screens.show(list);
  }

  // --- Editing ---

  // Edit a level (or a new one).
  function edit(level: Level | null): void {
    draft.load(level);
    resume(level?.pieces ?? emptyLayout());
  }

  // Carry on editing the draft, with these pieces.
  function resume(pieces: Layout): void {
    screens.enterEditor();
    showGoal();
    playground.loadLayout(pieces);
    history.reset();
    toolbar.update();
    toolbar.setNote(
      "Editing a level · draw it, then place its start, goal and hearts",
    );
    screens.setBack("Levels", "Back to the levels to edit", showList);
    status = "";
    fillPanel();
    frame();
    screens.show(null);
  }

  // The goal cup is fixed, as it will be in the level.
  function showGoal(): void {
    playground.fix({
      ...emptyLayout(),
      cups: draft.goal ? [draft.goal] : [],
    });
  }

  // Show all of the level, or the start of the world if it's empty.
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
            // Clear of the panel, on the left.
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
      setStatus("Place a start and a goal first");
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
      setStatus(`Saved as ${level.id}.json`);
    } catch (error) {
      setStatus(`Couldn't save: ${String(error)}`);
    }
  }

  // --- The panel ---

  const field = (name: string, input: HTMLElement) => {
    const label = document.createElement("label");
    label.append(name, input);
    return label;
  };
  const text = (placeholder: string) => {
    const input = document.createElement("input");
    input.placeholder = placeholder;
    return input;
  };
  const number = () => {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.placeholder = "none";
    return input;
  };
  const id = text("my-level");
  const name = text("My level");
  const tip = text("What to do");
  const rider = document.createElement("select");
  rider.append(new Option("Ball", "ball"), new Option("Sledge", "sledge"));
  const ink = number();
  const boost = number();
  const portals = number();
  const statusLine = document.createElement("p");
  statusLine.className = "status";
  const tryButton = document.createElement("button");
  tryButton.type = "button";
  tryButton.textContent = "▶️ Try it";
  tryButton.addEventListener("click", tryIt);
  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.textContent = "💾 Save";
  saveButton.addEventListener("click", () => void save());
  const buttons = document.createElement("div");
  buttons.className = "buttons";
  buttons.append(tryButton, saveButton);
  const limits = document.createElement("div");
  limits.className = "limits";
  limits.append(
    field("Ink", ink),
    field("Boost", boost),
    field("Portals", portals),
  );
  panel.append(
    field("Id", id),
    field("Name", name),
    field("Tip", tip),
    field("Rider", rider),
    limits,
    statusLine,
    buttons,
  );
  panel.addEventListener("submit", (e) => e.preventDefault());
  panel.addEventListener("input", () => {
    const amount = (input: HTMLInputElement) =>
      Number(input.value) > 0 ? Number(input.value) : undefined;
    const levelLimits: LevelLimits = {};
    const setLimit = (key: keyof LevelLimits, input: HTMLInputElement) => {
      const value = amount(input);
      if (value !== undefined) levelLimits[key] = value;
    };
    setLimit("ink", ink);
    setLimit("boost", boost);
    setLimit("portals", portals);
    draft.update({
      id: id.value.trim(),
      name: name.value.trim(),
      tip: tip.value.trim(),
      rider: rider.value === "sledge" ? "sledge" : "ball",
      limits: levelLimits,
    });
  });

  function fillPanel(): void {
    id.value = draft.id;
    name.value = draft.name;
    tip.value = draft.tip;
    rider.value = draft.rider;
    ink.value = String(draft.limits.ink ?? "");
    boost.value = String(draft.limits.boost ?? "");
    portals.value = String(draft.limits.portals ?? "");
    showStatus();
  }

  function setStatus(message: string): void {
    status = message;
    showStatus();
  }

  // What it still needs before it can be saved, or that it's ready.
  function showStatus(): void {
    const needs = draft.needs(playground.layout());
    const ready =
      needs.length === 0 ? "✓ Won with every heart · ready to save" : "";
    statusLine.textContent = status || ready || `Needs ${needs.join(", ")}`;
    saveButton.disabled = needs.length > 0;
  }

  // Keep the goal cup and the status up to date while editing.
  draft.changed.listen(() => {
    if (screens.mode !== "editor") return;
    showGoal();
    status = "";
    showStatus();
  });
  playground.designChanged.listen(() => {
    if (screens.mode === "editor") showStatus();
  });

  // Back from saving (which reloaded the page): carry on editing.
  const reopen = sessionStorage.getItem(REOPEN_KEY);
  sessionStorage.removeItem(REOPEN_KEY);
  const level = LEVELS.find((l) => l.id === reopen);
  if (level) {
    edit(level);
    setStatus(`Saved as ${level.id}.json`);
  }

  // The list screen, like the level map.
  function screen(): HTMLElement {
    const el = document.createElement("div");
    el.id = "editor-list";
    el.className = "screen";
    el.hidden = true;
    const card = document.createElement("div");
    card.className = "card";
    const header = document.createElement("header");
    const back = document.createElement("button");
    back.className = "back";
    back.title = "Back";
    back.textContent = "⬅️";
    back.addEventListener("click", () => screens.showFront());
    const title = document.createElement("h2");
    title.textContent = "Edit a level";
    header.append(back, title);
    const levels = document.createElement("div");
    levels.className = "levels";
    card.append(header, levels);
    el.append(card);
    document.body.append(el);
    screens.addScreen(el);
    return el;
  }
}
