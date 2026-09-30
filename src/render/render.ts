import { getPattern, type Background } from "./backgrounds";
import type { Camera } from "../camera";
import type { Effects } from "./effects";
import type { GuideView } from "../guides";
import type { Overlay } from "../tools";
import { Ball, Sledge, type Playground } from "../world/playground";
import type { Rider } from "../levels/level";
import { ACCENT, ERASER_COLOR, PREVIEW_COLOR } from "../palette";
import { drawBoostStrip } from "./boost";
import { drawBubble } from "./bubble";
import { drawDesign, drawPolyline, LINE_WIDTH_PX } from "./design";
import { drawHeart } from "./heart";
import type { Point } from "../geometry/point";
import { drawPortal } from "./portal";
import { drawSledge } from "./sledge";
import { drawRock } from "./terrain";

// A level's hearts still to collect, and (in the editor) where its rider
// starts, drawn as a ghost.
export interface LevelMarks {
  hearts: Point[];
  start: (Point & { rider: Rider }) | null;
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
  guides: GuideView,
  marks: LevelMarks,
): void {
  const {
    preview,
    curveHandles,
    lineEnds,
    snapTargets,
    eraser,
    boostPreview,
    portalPending,
    trajectory,
    terrainPreview,
  } = overlay;
  const time = performance.now() / 1000;
  ctx.save();
  ctx.clearRect(0, 0, camera.width, camera.height);
  camera.apply(ctx);

  drawBackground(ctx, camera, background);

  // The design, with what the tools are doing drawn on top of it. Balls and
  // bubbles go over everything, so balls look like they drop into portals.
  drawDesign(ctx, playground, time);

  if (terrainPreview) drawRock(ctx, terrainPreview.points, 0.6);

  if (boostPreview) drawBoostStrip(ctx, boostPreview, time, 0.6);

  if (preview) {
    ctx.lineWidth = LINE_WIDTH_PX;
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

  if (portalPending) {
    drawPortal(ctx, portalPending.end, portalPending.color, time, 0.5);
  }

  // The path a cannon being aimed will send its balls.
  if (trajectory) {
    ctx.fillStyle = `${ACCENT}cc`;
    trajectory.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(
        p.x,
        p.y,
        Math.max(1.5, 3.5 - i * 0.08) / camera.zoom,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    });
  }

  marks.hearts.forEach(({ x, y }, i) => drawHeart(ctx, x, y, time, i * 1.7));
  if (marks.start) drawGhost(ctx, marks.start, time);

  drawTrail(ctx, guides);
  drawPath(ctx, guides, camera.zoom);

  for (const ball of playground.balls) {
    if (ball instanceof Sledge) drawSledge(ctx, ball, time);
    else drawBall(ctx, ball);
  }

  // Bubbles go on top, since you can see through them.
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

// Where the ball has just been: dots in its colour, shrinking and fading
// with age. Every other step is plenty.
function drawTrail(ctx: CanvasRenderingContext2D, guides: GuideView): void {
  ctx.fillStyle = guides.color;
  for (const segment of guides.trail) {
    for (let i = segment.length - 1; i >= 0; i -= 2) {
      const { x, y, age } = segment[i];
      ctx.globalAlpha = 0.6 * (1 - age);
      ctx.beginPath();
      ctx.arc(x, y, 2 + 3 * (1 - age), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// Where the ball will go next (while paused): white dots ringed in the
// accent colour, like a cannon's aim but hollow-looking, getting smaller
// further ahead. One every few steps.
function drawPath(
  ctx: CanvasRenderingContext2D,
  guides: GuideView,
  zoom: number,
): void {
  const total = guides.path.reduce((n, stretch) => n + stretch.length, 0);
  let i = 0;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2 / zoom;
  for (const stretch of guides.path) {
    for (const { x, y } of stretch) {
      if (i++ % 4 !== 0) continue;
      const ahead = i / total;
      ctx.beginPath();
      ctx.arc(x, y, (4.5 - 2 * ahead) / zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}

type BallLook = Pick<Ball, "position" | "angle" | "radius" | "color">;

function drawBall(ctx: CanvasRenderingContext2D, ball: BallLook): void {
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

// Where a level's rider starts, in the editor: a faded ball or sledge.
function drawGhost(
  ctx: CanvasRenderingContext2D,
  start: Point & { rider: Rider },
  time: number,
): void {
  const position = { x: start.x, y: start.y };
  const color = "#64748b";
  ctx.globalAlpha = 0.5;
  if (start.rider === "sledge") {
    drawSledge(ctx, { position, angle: 0, facing: 1, color, speed: 0 }, time);
  } else {
    drawBall(ctx, { position, angle: 0, radius: 16, color });
  }
  ctx.globalAlpha = 1;
}
