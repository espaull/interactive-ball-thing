import { CANNON_COLOR, CANNON_WHEEL } from "../palette";
import type { Cannon } from "../world/cannons";

// A cannon: a barrel pointing the way it fires on a round wheel. The barrel
// is longer the more powerful it is, and a paused cannon is faded out.
export function drawCannon(
  ctx: CanvasRenderingContext2D,
  cannon: Cannon,
): void {
  const { x, y, angle, power } = cannon;
  ctx.globalAlpha = cannon.active ? 1 : 0.4;

  // Barrel.
  const length = 26 + power * 14;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = CANNON_COLOR;
  ctx.beginPath();
  ctx.roundRect(-6, -9, length + 6, 18, 6);
  ctx.fill();
  // A band round the mouth.
  ctx.fillStyle = "#64748b";
  ctx.fillRect(length - 6, -10, 6, 20);
  ctx.restore();

  // Wheel, with spokes.
  ctx.fillStyle = CANNON_WHEEL;
  ctx.beginPath();
  ctx.arc(x, y, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fcd34d";
  ctx.lineWidth = 2;
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI) / 3;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(a) * 10, y - Math.sin(a) * 10);
    ctx.lineTo(x + Math.cos(a) * 10, y + Math.sin(a) * 10);
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}
