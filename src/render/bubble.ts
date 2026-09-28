import { BUBBLE_COLORS } from "../palette";

// A soap bubble centred on (x, y): a nearly clear film, a slowly swirling
// rainbow rim and a fixed highlight. `phase` staggers the swirl between bubbles.
export function drawBubble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  phase: number,
  time: number,
): void {
  // Nearly clear in the middle, a little denser towards the edge.
  const film = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
  film.addColorStop(0, "rgba(255, 255, 255, 0.04)");
  film.addColorStop(0.75, "rgba(220, 235, 255, 0.14)");
  film.addColorStop(1, "rgba(200, 220, 255, 0.4)");
  ctx.fillStyle = film;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // Rainbow rim that slowly swirls round.
  const rim = ctx.createConicGradient(time * 0.6 + phase, x, y);
  BUBBLE_COLORS.forEach((color, i) =>
    rim.addColorStop(i / (BUBBLE_COLORS.length - 1), color),
  );
  const rimWidth = Math.max(1.5, r * 0.08);
  ctx.strokeStyle = rim;
  ctx.lineWidth = rimWidth;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(x, y, r - rimWidth / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Shine: a big highlight top-left and a small one bottom-right. They don't
  // rotate with the bubble, because the "light" stays put.
  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  ctx.beginPath();
  ctx.ellipse(
    x - r * 0.38,
    y - r * 0.4,
    r * 0.24,
    r * 0.12,
    -Math.PI / 4,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.beginPath();
  ctx.arc(x + r * 0.42, y + r * 0.38, r * 0.07, 0, Math.PI * 2);
  ctx.fill();
}
