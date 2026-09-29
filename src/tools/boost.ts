import type { Point } from "../geometry/point";
import { smoothStroke } from "../geometry/stroke";
import type { DownResult, Overlay, Tool, ToolContext } from "./tool";

// Ignore pointer moves shorter than this while painting.
const MIN_POINT_SPACING_PX = 4;

// Paint a boost strip. Balls on it get pushed along it, in the direction it
// was painted: enough to send them up walls and round loops.
export class BoostTool implements Tool {
  label = "Boost";
  icon = "🚀";
  title = "Paint a strip that speeds balls up";
  cursor = "crosshair";
  hints = {
    mouse:
      "Drag along a track to paint a boost · balls speed up the way you painted it · the eraser rubs boosts out too",
    touch:
      "Drag along a track to paint a boost · balls speed up the way you painted it",
  };
  popsBubbles = true;

  // The strip being painted, or null when not painting.
  private stroke: Point[] | null = null;

  constructor(private ctx: ToolContext) {}

  get busy(): boolean {
    return this.stroke !== null;
  }

  down(p: Point): DownResult {
    this.stroke = [p];
    return "drag";
  }

  move(p: Point): void {
    const last = this.stroke?.at(-1);
    if (
      last &&
      Math.hypot(p.x - last.x, p.y - last.y) >= MIN_POINT_SPACING_PX
    ) {
      this.stroke!.push(p);
    }
  }

  up(): void {
    // Smoothed like a drawn line, so the push direction changes smoothly too.
    if (this.stroke) this.ctx.playground.boosts.add(smoothStroke(this.stroke));
    this.cancel();
  }

  cancel(): void {
    this.stroke = null;
  }

  overlay(): Partial<Overlay> {
    return { boostPreview: this.stroke && smoothStroke(this.stroke) };
  }
}
