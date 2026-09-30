import { HEART_COLOR, HEART_SHINE } from "../palette";

// Trace a heart centred on (x, y), `size` pixels from its middle to its
// point (and about as wide either side).
export function heartPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x, y + size);
  ctx.bezierCurveTo(
    x - size * 1.5,
    y + size * 0.1,
    x - size * 0.9,
    y - size * 1.25,
    x,
    y - size * 0.45,
  );
  ctx.bezierCurveTo(
    x + size * 0.9,
    y - size * 1.25,
    x + size * 1.5,
    y + size * 0.1,
    x,
    y + size,
  );
  ctx.closePath();
}

// A heart to collect in a level: bobbing gently and beating now and then,
// with a white outline so it shows up on any background.
export function drawHeart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  time: number,
  // So hearts bob out of step with each other.
  phase: number,
): void {
  const bob = Math.sin(time * 2.5 + phase) * 3;
  // A quick double beat every couple of seconds.
  const t = (time + phase) % 2;
  const beat =
    1 + 0.12 * Math.max(0, Math.sin(t * 16)) * (t < Math.PI / 8 ? 1 : 0);
  const size = 13 * beat;
  heartPath(ctx, x, y + bob, size);
  ctx.fillStyle = HEART_COLOR;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.fill();
  // A little shine on the left lobe.
  ctx.fillStyle = HEART_SHINE;
  ctx.beginPath();
  ctx.ellipse(
    x - size * 0.45,
    y + bob - size * 0.35,
    size * 0.2,
    size * 0.13,
    -0.6,
    0,
    Math.PI * 2,
  );
  ctx.fill();
}
