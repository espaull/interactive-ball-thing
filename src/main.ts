import "./style.css";
import { Camera } from "./camera";
import { Effects } from "./render/effects";
import { render } from "./render/render";
import { playPop, playPortal } from "./sound";
import { PORTAL_RADIUS_PX } from "./world/portals";
import { createToolGroups } from "./tools";
import { Input } from "./tools/input";
import {
  keepFocusOffButtons,
  setupActions,
  setupBackgroundPicker,
  setupToolbar,
} from "./ui";
import { Playground } from "./world/playground";

const STEP = 1 / 60;
const MAX_FRAME_TIME = 0.25; // stops a backgrounded tab "catching up" in one jump

const canvas = document.querySelector<HTMLCanvasElement>("#stage")!;
const ctx = canvas.getContext("2d")!;
const playground = new Playground();
const camera = new Camera();
const effects = new Effects();
const toolGroups = createToolGroups(playground, camera);
const input = new Input(canvas, playground, camera, toolGroups[0][0]);

// However a bubble pops (clicked, or bumped too often): splash and sound.
playground.onPop = (x, y, radius) => {
  effects.pop(x, y, radius);
  playPop(radius);
};

// Going through a portal: a flash at both ends, and a whoop.
playground.onTeleport = ({ from, to, color }) => {
  effects.flash(from.x, from.y, PORTAL_RADIUS_PX, color);
  effects.flash(to.x, to.y, PORTAL_RADIUS_PX, color);
  playPortal();
};

keepFocusOffButtons();
setupToolbar(toolGroups, input);
setupActions(camera, playground, input, effects);
const background = setupBackgroundPicker(canvas);

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
  effects.update(dt);
  // Hold the camera still while drawing or erasing, so the world doesn't
  // slide out from under the pointer.
  if (!input.isBusy) camera.update(dt, playground);
  render(ctx, camera, background.current, playground, input.overlay, effects);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handy for poking at things from the browser console while developing.
if (import.meta.env.DEV) Object.assign(window, { playground, camera, input });
