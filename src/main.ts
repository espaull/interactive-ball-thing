import "./style.css";
import { BACKGROUNDS, makeTile } from "./backgrounds";
import { Camera } from "./camera";
import { Effects } from "./effects";
import { Playground } from "./physics";
import { Input, type Tool } from "./input";
import { render } from "./render";
import { playPop } from "./sound";

const STEP = 1 / 60;
const MAX_FRAME_TIME = 0.25; // stops a backgrounded tab "catching up" in one jump

const canvas = document.querySelector<HTMLCanvasElement>("#stage")!;
const ctx = canvas.getContext("2d")!;
const playground = new Playground();
const camera = new Camera();
const effects = new Effects();
const input = new Input(canvas, playground, camera);

// However a bubble pops (clicked, or bumped too often): splash and sound.
playground.onPop = (x, y, radius) => {
  effects.pop(x, y, radius);
  playPop(radius);
};

function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  // Size the drawing to the canvas's actual on-screen box, so a touch lands
  // exactly where it's drawn. (Window sizes can disagree with it on phones.)
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  camera.resize(width, height);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  // Draw in CSS pixels; the canvas backing store is scaled for sharp lines.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
// Catches the phone address bar sliding in and out, as well as window resizes.
new ResizeObserver(resize).observe(canvas);
// Moving the window to a screen with a different pixel density.
window.addEventListener("resize", resize);
resize();

// Toolbar
// Touchscreens have no Space key or Enter, so they get simpler hints.
const TOUCH = window.matchMedia("(hover: none)").matches;
const HINTS: Record<Tool, string> = TOUCH
  ? {
      pencil: "Drag to draw · start or finish on a ring to join lines up · tap bubbles to pop them",
      eraser: "Drag over lines to rub them out",
      curve: "Tap to add points · tap the last point again, or a ring, to finish",
      move: "Drag to look around · tap a ball or bubble to follow it",
      ball: "Tap to drop a ball · tap bubbles to pop them",
      bubble: "Tap to blow a bubble · tap one to pop it",
    }
  : {
      pencil: "Drag to draw · start or finish on a ring to join lines up · click bubbles to pop them · hold Space and drag to move around",
      eraser: "Drag over lines to rub them out · the cut ends get rings you can draw from",
      curve: "Click to add points · click the last point again, a ring, or press Enter to finish · Backspace undoes a point · Esc cancels",
      move: "Drag to look around · tap a ball or bubble to follow it",
      ball: "Click to drop a ball · click bubbles to pop them · hold Space and drag to move around",
      bubble: "Click to blow a bubble · click one to pop it · hold Space and drag to move around",
    };
const hint = document.querySelector<HTMLElement>("#hint")!;
const toolButtons = document.querySelectorAll<HTMLButtonElement>("[data-tool]");

function selectTool(tool: Tool): void {
  input.setTool(tool);
  for (const b of toolButtons) b.classList.toggle("active", b.dataset.tool === tool);
  hint.textContent = HINTS[tool];
}

for (const button of toolButtons) {
  button.addEventListener("click", () => selectTool(button.dataset.tool as Tool));
}
selectTool("pencil");

// Keep focus off the buttons, so Space and Enter never "press" one.
for (const el of document.querySelectorAll("#toolbar, #bg-button, #bg-picker")) {
  el.addEventListener("mousedown", (e) => e.preventDefault());
}

// Background picker. The choice is remembered in this browser.
const BG_STORAGE_KEY = "background";
let background = BACKGROUNDS[0];
try {
  background = BACKGROUNDS.find((b) => b.name === localStorage.getItem(BG_STORAGE_KEY)) ?? background;
} catch {
  // Storage can be unavailable (private windows); the default is fine.
}

const bgButton = document.querySelector<HTMLButtonElement>("#bg-button")!;
const bgPicker = document.querySelector<HTMLElement>("#bg-picker")!;
const swatches = BACKGROUNDS.map((bg) => {
  const swatch = document.createElement("button");
  swatch.title = bg.name;
  swatch.style.backgroundImage = `url(${makeTile(bg, 1).toDataURL()})`;
  swatch.style.backgroundSize = `${bg.size / 2}px`;
  swatch.addEventListener("click", () => {
    background = bg;
    for (const s of swatches) s.classList.toggle("active", s === swatch);
    bgPicker.hidden = true;
    try {
      localStorage.setItem(BG_STORAGE_KEY, bg.name);
    } catch {}
  });
  swatch.classList.toggle("active", bg === background);
  bgPicker.append(swatch);
  return swatch;
});
bgButton.addEventListener("click", () => (bgPicker.hidden = !bgPicker.hidden));
// Close the picker when you start playing again.
canvas.addEventListener("pointerdown", () => (bgPicker.hidden = true));

const followButton = document.querySelector<HTMLButtonElement>("#follow")!;
camera.onFollowChange = (following) => followButton.classList.toggle("active", following);
followButton.addEventListener("click", () => {
  // Turning Follow on picks up the most recent ball (or bubble if there are none).
  camera.setFollowing(!camera.following, playground.balls.at(-1) ?? playground.bubbles.at(-1) ?? null);
});

document.querySelector("#home")!.addEventListener("click", () => camera.home());
document.querySelector("#clear")!.addEventListener("click", () => {
  input.cancelCurve();
  playground.clear();
  effects.clear();
  camera.home();
});

// Game loop: fixed-step physics, render every animation frame.
let last = performance.now();
let accumulator = 0;

function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, MAX_FRAME_TIME);
  last = now;
  accumulator += dt;
  while (accumulator >= STEP) {
    playground.step(STEP);
    accumulator -= STEP;
  }
  // Balls are removed below the lowest line (or the first screen), bubbles
  // above the highest line (or the top of the first screen).
  playground.cull(camera.height, 0);
  // Hold the camera still while a line is being drawn, so it doesn't slide
  // out from under the pen.
  effects.update(dt);
  if (!input.isBusy) camera.update(dt, playground);
  render(ctx, camera, background, playground, input.overlay, effects);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handy for poking at things from the browser console.
Object.assign(window, { playground, camera, input });
