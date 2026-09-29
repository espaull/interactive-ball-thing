import type { Playground } from "../world/playground";
import { drawDesign, LINE_WIDTH_PX } from "./design";

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

  const box = playground.designBounds();
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

  drawDesign(
    ctx,
    playground,
    0,
    Math.max(LINE_WIDTH_PX, MIN_LINE_WIDTH / scale),
  );

  return canvas.toDataURL("image/jpeg", 0.85);
}
