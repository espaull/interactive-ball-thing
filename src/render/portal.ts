import { PORTAL_RADIUS_PX, type PortalEnd } from "../world/portals";

// A portal: a dark hole with a coloured rim and white arcs swirling round
// inside it, plus an arrow on the rim if it's aimed. `opacity` is lower for a
// portal still waiting for its partner.
export function drawPortal(
  ctx: CanvasRenderingContext2D,
  { x, y, aim }: PortalEnd,
  color: string,
  time: number,
  opacity = 1,
): void {
  const r = PORTAL_RADIUS_PX;
  ctx.globalAlpha = opacity;

  const hole = ctx.createRadialGradient(x, y, 0, x, y, r);
  hole.addColorStop(0, "#1e1b4b");
  hole.addColorStop(0.65, `${color}cc`);
  hole.addColorStop(1, `${color}55`);
  ctx.fillStyle = hole;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#ffffffcc";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (let k = 0; k < 3; k++) {
    const start = time * 3 + (k * Math.PI * 2) / 3;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.6, start, start + 1.1);
    ctx.stroke();
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();

  // The arrow points the way things come out.
  if (aim !== null) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(aim);
    ctx.fillStyle = color;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(r + 26, 0);
    ctx.lineTo(r + 4, -14);
    ctx.lineTo(r + 4, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  ctx.globalAlpha = 1;
}
