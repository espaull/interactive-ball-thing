// Choosing the background.
import { BACKGROUNDS, makeTile, type Background } from "../render/backgrounds";

const BG_STORAGE_KEY = "background";

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
