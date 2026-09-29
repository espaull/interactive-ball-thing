// The HTML controls around the canvas: toolbar, hint, background picker.
import type { Camera } from "./camera";
import { BACKGROUNDS, makeTile, type Background } from "./render/backgrounds";
import type { Effects } from "./render/effects";
import { drawThumbnail } from "./render/thumbnail";
import type { Save, SaveStore } from "./saves";
import type { Tool } from "./tools";
import type { Input } from "./tools/input";
import { isEmpty } from "./world/layout";
import type { Playground } from "./world/playground";

// Touchscreens have no Space key or Enter, so they get simpler hints.
const TOUCH = window.matchMedia("(hover: none)").matches;
const BG_STORAGE_KEY = "background";

// Keep focus off the buttons, so Space and Enter never "press" one.
export function keepFocusOffButtons(): void {
  for (const el of document.querySelectorAll(
    "#toolbar, #tool-menu, #bg-button, #bg-picker, #saves-button, #saves-panel",
  )) {
    el.addEventListener("mousedown", (e) => e.preventDefault());
  }
}

// One toolbar button per group of tools (before the divider), and the hint
// at the bottom of the screen for whichever tool is selected. A group button
// shows the tool last picked from it: tapping it picks that tool, and tapping
// it again (while it's selected) opens a menu of the group's other tools.
export function setupToolbar(groups: Tool[][], input: Input): void {
  const hint = document.querySelector<HTMLElement>("#hint")!;
  const divider = document.querySelector("#toolbar .divider")!;
  const menu = document.querySelector<HTMLElement>("#tool-menu")!;
  // The tool each group button currently stands for.
  const chosen = groups.map((group) => group[0]);

  const buttons = groups.map((group, g) => {
    const button = document.createElement("button");
    button.addEventListener("click", () => {
      const tool = chosen[g];
      if (group.length > 1 && input.tool === tool && menu.hidden) {
        openMenu(g);
      } else {
        select(tool);
      }
    });
    divider.before(button);
    return button;
  });

  function select(tool: Tool): void {
    input.setTool(tool);
    const g = groups.findIndex((group) => group.includes(tool));
    chosen[g] = tool;
    buttons.forEach((button, i) => {
      const group = groups[i];
      const shown = chosen[i];
      // "▾" marks the buttons that open a menu.
      const more = group.length > 1 ? " ▾" : "";
      button.replaceChildren(shown.icon, labelled(shown.label + more));
      button.title =
        group.length > 1 ? `${shown.title} (tap again for more)` : shown.title;
      button.classList.toggle("active", i === g);
    });
    hint.textContent = TOUCH ? tool.hints.touch : tool.hints.mouse;
    menu.hidden = true;
  }

  function openMenu(g: number): void {
    menu.replaceChildren(
      ...groups[g].map((tool) => {
        const item = document.createElement("button");
        item.title = tool.title;
        item.append(tool.icon, labelled(tool.label));
        item.classList.toggle("active", tool === input.tool);
        item.addEventListener("click", () => select(tool));
        return item;
      }),
    );
    menu.hidden = false;
    // Just below its button, kept on screen.
    const anchor = buttons[g].getBoundingClientRect();
    const width = menu.offsetWidth;
    const left = anchor.left + anchor.width / 2 - width / 2;
    menu.style.left = `${Math.max(16, Math.min(left, innerWidth - 16 - width))}px`;
    menu.style.top = `${anchor.bottom + 8}px`;
  }

  // A tap on the canvas while the menu is open just closes it, without also
  // using the tool. (Capturing, so this runs before the tool's own handler.)
  document.querySelector("#stage")!.addEventListener(
    "pointerdown",
    (e) => {
      if (menu.hidden) return;
      menu.hidden = true;
      e.stopImmediatePropagation();
    },
    { capture: true },
  );

  select(chosen[0]);
}

function labelled(text: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.textContent = text;
  return span;
}

// The Follow, Home and Clear buttons.
export function setupActions(
  camera: Camera,
  playground: Playground,
  input: Input,
  effects: Effects,
): void {
  const followButton = document.querySelector<HTMLButtonElement>("#follow")!;
  camera.onFollowChange = (following) =>
    followButton.classList.toggle("active", following);
  followButton.addEventListener("click", () => {
    // Turning Follow on picks up the most recent ball (or bubble if there are none).
    const latest = playground.balls.at(-1) ?? playground.bubbles.at(-1) ?? null;
    camera.setFollowing(!camera.following, latest);
  });

  document
    .querySelector("#home")!
    .addEventListener("click", () => camera.home());

  document.querySelector("#clear")!.addEventListener("click", () => {
    input.cancel();
    playground.clear();
    effects.clear();
    camera.home();
  });
}

// The 🎨 button and its swatches. The choice is remembered in this browser.
// Returns something to read the current background from.
export function setupBackgroundPicker(canvas: HTMLCanvasElement): {
  current: Background;
} {
  const state = { current: BACKGROUNDS[0] };
  try {
    const saved = localStorage.getItem(BG_STORAGE_KEY);
    state.current = BACKGROUNDS.find((b) => b.name === saved) ?? state.current;
  } catch {
    // Storage can be unavailable (private windows); the default is fine.
  }

  const button = document.querySelector<HTMLButtonElement>("#bg-button")!;
  const picker = document.querySelector<HTMLElement>("#bg-picker")!;

  const swatches = BACKGROUNDS.map((bg) => {
    const swatch = document.createElement("button");
    swatch.title = bg.name;
    swatch.style.backgroundImage = `url(${makeTile(bg, 1).toDataURL()})`;
    swatch.style.backgroundSize = `${bg.size / 2}px`;
    swatch.classList.toggle("active", bg === state.current);
    swatch.addEventListener("click", () => {
      state.current = bg;
      for (const s of swatches) s.classList.toggle("active", s === swatch);
      picker.hidden = true;
      try {
        localStorage.setItem(BG_STORAGE_KEY, bg.name);
      } catch {}
    });
    picker.append(swatch);
    return swatch;
  });

  button.addEventListener("click", () => (picker.hidden = !picker.hidden));
  // Close the picker when you start playing again.
  canvas.addEventListener("pointerdown", () => (picker.hidden = true));
  return state;
}

// How long a remove button stays armed (red) waiting for its second tap.
const REMOVE_ARMED_MS = 3000;

// The 🖼️ button and its gallery: a Save tile that keeps a picture of the
// playground, then one tile per saved playground, newest first. Tapping one
// loads it. Whatever was there is kept in the gallery first (unless it's
// already saved or empty), so loading never loses anything.
export function setupGallery(
  store: SaveStore,
  canvas: HTMLCanvasElement,
  camera: Camera,
  playground: Playground,
  input: Input,
  effects: Effects,
  background: { current: Background },
): void {
  const button = document.querySelector<HTMLButtonElement>("#saves-button")!;
  const panel = document.querySelector<HTMLElement>("#saves-panel")!;
  const bgPicker = document.querySelector<HTMLElement>("#bg-picker")!;
  // The tile to bounce, after saving.
  let justSaved: string | null = null;
  let note = "";

  const keep = (): Save | null =>
    store.add(
      playground.layout(),
      drawThumbnail(playground, background.current.base),
    );

  function save(): void {
    const saved = keep();
    note = saved ? "" : "No room for more · remove a picture to make some";
    justSaved = saved?.id ?? null;
    show();
  }

  function load(save: Save): void {
    const current = playground.layout();
    if (!isEmpty(current) && !store.find(current) && !keep()) {
      note = "No room to keep what's here · remove a picture first";
      show();
      return;
    }
    input.cancel();
    playground.loadLayout(save.layout);
    effects.clear();
    camera.home();
    panel.hidden = true;
  }

  function show(): void {
    const noteEl = document.createElement("p");
    noteEl.className = "note";
    noteEl.textContent = note;
    const tiles = document.createElement("div");
    tiles.className = "tiles";

    const saveButton = document.createElement("button");
    saveButton.title = "Save this playground";
    saveButton.append("💾", labelled("Save"));
    saveButton.disabled = isEmpty(playground.layout());
    saveButton.addEventListener("click", save);
    tiles.append(tile(saveButton));

    for (const s of store.list()) {
      const picture = document.createElement("button");
      picture.title = "Load this playground";
      picture.style.backgroundImage = `url(${s.picture})`;
      picture.addEventListener("click", () => load(s));
      const t = tile(picture, removeButton(s));
      t.classList.toggle("just-saved", s.id === justSaved);
      tiles.append(t);
    }
    tiles.dataset.columns = String(Math.min(3, tiles.children.length));
    panel.replaceChildren(noteEl, tiles);
    justSaved = null;
  }

  function removeButton(s: Save): HTMLButtonElement {
    const remove = document.createElement("button");
    remove.className = "remove";
    remove.title = "Remove (tap twice)";
    remove.textContent = "✕";
    let timer = 0;
    remove.addEventListener("click", () => {
      if (!remove.classList.contains("armed")) {
        remove.classList.add("armed");
        remove.textContent = "🗑️";
        timer = window.setTimeout(() => {
          remove.classList.remove("armed");
          remove.textContent = "✕";
        }, REMOVE_ARMED_MS);
        return;
      }
      window.clearTimeout(timer);
      store.remove(s.id);
      note = "";
      show();
    });
    return remove;
  }

  button.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    if (panel.hidden) return;
    note = "";
    show();
    bgPicker.hidden = true;
  });
  // Opening the background picker, or starting to play again, closes it.
  document
    .querySelector("#bg-button")!
    .addEventListener("click", () => (panel.hidden = true));
  canvas.addEventListener("pointerdown", () => (panel.hidden = true));
}

function tile(...children: HTMLElement[]): HTMLDivElement {
  const div = document.createElement("div");
  div.className = "save-tile";
  div.append(...children);
  return div;
}
