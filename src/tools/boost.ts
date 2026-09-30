import { distance, lerp, type Point } from "../geometry/point";
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
  supply = "boost" as const;

  // The strip being painted, or null when not painting.
  private stroke: Point[] | null = null;
  // How long it is, and how long it can get before the paint runs out.
  private length = 0;
  private allowance = Infinity;

  constructor(private ctx: ToolContext) {}

  get busy(): boolean {
    return this.stroke !== null;
  }

  get using(): number {
    return this.stroke ? this.length : 0;
  }

  down(p: Point): DownResult {
    this.allowance = this.ctx.budget.left("boost");
    if (this.allowance <= 0) return "none";
    this.stroke = [p];
    this.length = 0;
    return "drag";
  }

  move(p: Point): void {
    const last = this.stroke?.at(-1);
    if (!last) return;
    const step = distance(last, p);
    const room = this.allowance - this.length;
    if (step < MIN_POINT_SPACING_PX || room <= 0) return;
    // Out of paint, the strip ends where it ran out.
    this.stroke!.push(step <= room ? p : lerp(last, p, room / step));
    this.length += Math.min(step, room);
  }

  up(): void {
    // Smoothed like a drawn line, so the push direction changes smoothly
    // too. Nothing can be painted in a no-drawing area.
    if (this.stroke) {
      const { boosts, noDraw } = this.ctx.playground;
      for (const piece of noDraw.outside(smoothStroke(this.stroke))) {
        boosts.add(piece);
      }
    }
    this.cancel();
  }

  cancel(): void {
    this.stroke = null;
  }

  overlay(): Partial<Overlay> {
    return {
      boostPreview:
        this.stroke &&
        this.ctx.playground.noDraw.outside(smoothStroke(this.stroke)),
    };
  }
}
