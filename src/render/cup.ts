import { CUP_COLOR, CUP_SHINE } from "../palette";
import { CUP_OUTLINE, type Cup } from "../world/cups";

// A golden cup: the U the balls land in, little handles and a stand, and
// how many balls it has caught floating above it.
export function drawCup(ctx: CanvasRenderingContext2D, cup: Cup): void {
  const { x, y } = cup;
  const outline = CUP_OUTLINE.map((p) => ({ x: x + p.x, y: y + p.y }));

  // Inside of the cup, a soft gold.
  ctx.fillStyle = `${CUP_SHINE}99`;
  ctx.beginPath();
  outline.forEach((p, i) =>
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
  );
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = CUP_COLOR;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Handles on either side.
  ctx.lineWidth = 4;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(
      x + side * 34,
      y - 6,
      10,
      side < 0 ? Math.PI * 0.5 : -Math.PI * 0.5,
      side < 0 ? Math.PI * 1.5 : Math.PI * 0.5,
    );
    ctx.stroke();
  }

  // Stem and base (just for looks; the physics is only the U).
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x, y + 25);
  ctx.lineTo(x, y + 36);
  ctx.moveTo(x - 16, y + 38);
  ctx.lineTo(x + 16, y + 38);
  ctx.stroke();

  // The cup itself.
  ctx.beginPath();
  outline.forEach((p, i) =>
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y),
  );
  ctx.stroke();

  // (A level's goal cup doesn't count: getting there once is the point.)
  if (cup.caught > 0 && !cup.fixed) {
    ctx.font = "bold 20px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#ffffff";
    ctx.strokeText(String(cup.caught), x, y - 30);
    ctx.fillStyle = CUP_COLOR;
    ctx.fillText(String(cup.caught), x, y - 30);
  }
}
