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
    "#toolbar, #bg-button, #bg-picker",
  )) {
    el.addEventListener("mousedown", (e) => e.preventDefault());
  }
}

// One toolbar button per tool (before the divider), and the hint at the
// bottom of the screen for whichever is selected.
export function setupToolbar(tools: Tool[], input: Input): void {
  const hint = document.querySelector<HTMLElement>("#hint")!;
  const divider = document.querySelector("#toolbar .divider")!;

  const select = (tool: Tool) => {
    input.setTool(tool);
    buttons.forEach((b, i) => b.classList.toggle("active", tools[i] === tool));
    hint.textContent = TOUCH ? tool.hints.touch : tool.hints.mouse;
  };

  const buttons = tools.map((tool) => {
    const button = document.createElement("button");
    button.title = tool.title;
    const label = document.createElement("span");
    label.textContent = tool.label;
    button.append(tool.icon, label);
    button.addEventListener("click", () => select(tool));
    divider.before(button);
    return button;
  });

  select(tools[0]);
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
