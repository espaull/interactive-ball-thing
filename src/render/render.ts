import { getPattern, type Background } from "./backgrounds";
import type { Camera } from "../camera";
import type { Effects } from "./effects";
import type { Overlay } from "../tools";
import type { Playground } from "../world/playground";
import type { Point } from "../geometry/point";
import { ACCENT, ERASER_COLOR, LINE_COLOR, PREVIEW_COLOR } from "../palette";
import { drawBubble } from "./bubble";

const LINE_WIDTH_PX = 4;

function drawPolyline(ctx: CanvasRenderingContext2D, points: Point[]): void {
  if (points.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
}

// The background pattern is fixed to the world, so you can see the view
// moving even over empty space.
function drawBackground(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  bg: Background,
): void {
  const topLeft = camera.screenToWorld(0, 0);
  const bottomRight = camera.screenToWorld(camera.width, camera.height);
  ctx.fillStyle = getPattern(
    ctx,
    bg,
    camera.zoom,
    window.devicePixelRatio || 1,
  );
  ctx.fillRect(
    topLeft.x,
    topLeft.y,
    bottomRight.x - topLeft.x,
    bottomRight.y - topLeft.y,
  );
}

export function render(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  background: Background,
  playground: Playground,
  overlay: Overlay,
  effects: Effects,
): void {
  const { preview, curveHandles, lineEnds, snapTargets, eraser } = overlay;
  ctx.save();
  ctx.clearRect(0, 0, camera.width, camera.height);
  camera.apply(ctx);

  drawBackground(ctx, camera, background);

  ctx.lineWidth = LINE_WIDTH_PX;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = LINE_COLOR;
  for (const line of playground.lines) drawPolyline(ctx, line.points);

  if (preview) {
    ctx.strokeStyle = PREVIEW_COLOR;
    drawPolyline(ctx, preview);
  }

  // Rings on line ends show where a new line can carry on from; the one that
  // will be joined is filled in.
  if (lineEnds) {
    ctx.strokeStyle = `${ACCENT}99`;
    ctx.lineWidth = 2 / camera.zoom;
    for (const p of lineEnds) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7 / camera.zoom, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.fillStyle = `${ACCENT}59`;
  for (const target of snapTargets) {
    ctx.beginPath();
    ctx.arc(target.x, target.y, 11 / camera.zoom, 0, Math.PI * 2);
    ctx.fill();
  }

  // The eraser: a soft circle showing what it will rub out.
  if (eraser) {
    ctx.fillStyle = "#ffffff66";
    ctx.strokeStyle = `${ERASER_COLOR}aa`;
    ctx.lineWidth = 2 / camera.zoom;
    ctx.beginPath();
    ctx.arc(eraser.x, eraser.y, eraser.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // The points placed with the Curve tool; the last one is the "click again
  // to finish" target, so it's drawn bigger.
  if (curveHandles) {
    ctx.fillStyle = ACCENT;
    curveHandles.forEach((p, i) => {
      const r = (i === curveHandles.length - 1 ? 7 : 5) / camera.zoom;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  for (const ball of playground.balls) {
    const { x, y } = ball.position;
    const angle = ball.angle;

    ctx.fillStyle = ball.color;
    ctx.beginPath();
    ctx.arc(x, y, ball.radius, 0, Math.PI * 2);
    ctx.fill();

    // A white stripe so you can see the ball spinning as it rolls.
    ctx.strokeStyle = "#ffffffb0";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(
      x + Math.cos(angle) * ball.radius * 0.8,
      y + Math.sin(angle) * ball.radius * 0.8,
    );
    ctx.stroke();
  }

  // Bubbles go on top, since you can see through them.
  const time = performance.now() / 1000;
  for (const bubble of playground.bubbles) {
    const { x, y } = bubble.position;
    // A quick squash-and-stretch after each bump, dying away in ~0.3s.
    const age = playground.now - bubble.lastHitAt;
    // (Never-bumped bubbles have an infinite age, and sin(Infinity) is NaN.)
    const squash =
      age < 1 ? Math.sin(age * 45) * Math.exp(-age * 12) * 0.15 : 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1 + squash, 1 - squash);
    drawBubble(ctx, 0, 0, bubble.radius, bubble.phase, time);
    ctx.restore();
  }

  effects.draw(ctx, camera.zoom);

  // Ring around whatever the camera is following.
  if (camera.target) {
    const { x, y } = camera.target.position;
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 3 / camera.zoom;
    ctx.beginPath();
    ctx.arc(x, y, camera.target.radius + 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}
