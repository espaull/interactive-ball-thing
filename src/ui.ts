// The HTML controls around the canvas: toolbar, hint, background picker.
import type { Camera } from "./camera";
import { BACKGROUNDS, makeTile, type Background } from "./render/backgrounds";
import type { Effects } from "./render/effects";
import type { Tool } from "./tools";
import type { Input } from "./tools/input";
import type { Playground } from "./world/playground";

// Touchscreens have no Space key or Enter, so they get simpler hints.
const TOUCH = window.matchMedia("(hover: none)").matches;
const BG_STORAGE_KEY = "background";

// Keep focus off the buttons, so Space and Enter never "press" one.
export function keepFocusOffButtons(): void {
  for (const el of document.querySelectorAll(
    "#toolbar, #tool-menu, #bg-button, #bg-picker",
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
