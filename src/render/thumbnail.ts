import type { Point } from "../geometry/point";
import { LINE_COLOR } from "../palette";
import { BOOST_HALF_WIDTH_PX } from "../world/boosts";
import { CANNON_RADIUS_PX } from "../world/cannons";
import { CUP_RADIUS_PX } from "../world/cups";
import type { Playground } from "../world/playground";
import { PORTAL_RADIUS_PX } from "../world/portals";
import { drawBoostStrip } from "./boost";
import { drawCannon } from "./cannon";
import { drawCup } from "./cup";
import { drawPortal } from "./portal";

// Size of a gallery picture, in CSS pixels. It's drawn at twice this, so it
// stays sharp on high-density screens.
export const THUMBNAIL_WIDTH = 132;
export const THUMBNAIL_HEIGHT = 99;
const RESOLUTION = 2;
const PADDING = 8;
// Lines are at least this thick in the picture (CSS pixels), however far
// it's zoomed out, so a big playground's track doesn't vanish.
const MIN_LINE_WIDTH = 1.5;

// A small picture of the playground's design (no balls or bubbles), zoomed
// to fit, as a JPEG data URL.
export function drawThumbnail(playground: Playground, base: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = THUMBNAIL_WIDTH * RESOLUTION;
  canvas.height = THUMBNAIL_HEIGHT * RESOLUTION;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const box = bounds(playground);
  if (!box) return canvas.toDataURL("image/jpeg", 0.85);
  const width = THUMBNAIL_WIDTH - PADDING * 2;
  const height = THUMBNAIL_HEIGHT - PADDING * 2;
  // Never zoomed in past life size, so a tiny drawing stays small.
  const scale = Math.min(
    1,
    width / (box.right - box.left),
    height / (box.bottom - box.top),
  );
  ctx.scale(RESOLUTION, RESOLUTION);
  ctx.translate(THUMBNAIL_WIDTH / 2, THUMBNAIL_HEIGHT / 2);
  ctx.scale(scale, scale);
  ctx.translate(-(box.left + box.right) / 2, -(box.top + box.bottom) / 2);

  for (const boost of playground.boosts) drawBoostStrip(ctx, boost.points, 0);
  ctx.lineWidth = Math.max(4, MIN_LINE_WIDTH / scale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = LINE_COLOR;
  for (const line of playground.lines) {
    ctx.beginPath();
    line.points.forEach(({ x, y }, i) =>
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y),
    );
    ctx.stroke();
  }
  for (const cup of playground.cups) drawCup(ctx, cup);
  for (const { a, b, color } of playground.portalPairs) {
    drawPortal(ctx, a, color, 0);
    drawPortal(ctx, b, color, 0);
  }
  for (const cannon of playground.cannons) drawCannon(ctx, cannon);

  return canvas.toDataURL("image/jpeg", 0.85);
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

// The area everything in the design covers, or null if there's nothing.
function bounds(playground: Playground): Box | null {
  let box: Box | null = null;
  const add = ({ x, y }: Point, r: number) => {
    box ??= { left: x, top: y, right: x, bottom: y };
    box.left = Math.min(box.left, x - r);
    box.top = Math.min(box.top, y - r);
    box.right = Math.max(box.right, x + r);
    box.bottom = Math.max(box.bottom, y + r);
  };
  for (const line of playground.lines) {
    for (const p of line.points) add(p, 4);
  }
  for (const boost of playground.boosts) {
    for (const p of boost.points) add(p, BOOST_HALF_WIDTH_PX);
  }
  for (const { a, b } of playground.portalPairs) {
    // Room for an aim arrow on any side.
    add(a, PORTAL_RADIUS_PX + 26);
    add(b, PORTAL_RADIUS_PX + 26);
  }
  for (const cup of playground.cups) add(cup, CUP_RADIUS_PX);
  for (const cannon of playground.cannons) add(cannon, CANNON_RADIUS_PX + 20);
  return box;
}
