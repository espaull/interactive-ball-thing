import type { Point } from "../simplify";
import { lineEnds } from "./lines";
import type { DownResult, Overlay, Tool, ToolContext } from "./tool";

// Size of the eraser, in screen pixels.
const RADIUS_PX = 18;

// Rubs out the parts of lines under it, splitting them where it cuts through.
// The cut ends get rings like any other line end, so they can be joined up.
export class EraserTool implements Tool {
  label = "Erase";
  icon = "🧽";
  title = "Rub out parts of lines";
  cursor = "none"; // the eraser's circle is drawn instead
  hints = {
    mouse: "Drag over lines to rub them out · the cut ends get rings you can draw from",
    touch: "Drag over lines to rub them out",
  };
  popsBubbles = true;

  // Last place it rubbed at, while erasing.
  private from: Point | null = null;

  constructor(private ctx: ToolContext) {}

  get busy(): boolean {
    return this.from !== null;
  }

  private get radius(): number {
    return RADIUS_PX / this.ctx.camera.zoom;
  }

  down(p: Point): DownResult {
    this.from = p;
    this.ctx.playground.eraseAt(p.x, p.y, this.radius);
    return "drag";
  }

  move(to: Point): void {
    const from = this.from;
    if (!from) return;
    // Rub out along the whole path, not just where move events land, so a
    // quick swipe doesn't skip bits. Stamping every quarter-radius keeps the
    // swept edge within 1% of straight.
    const r = this.radius;
    const steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / (r / 4));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      this.ctx.playground.eraseAt(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, r);
    }
    this.from = to;
  }

  up(): void {
    this.from = null;
  }

  cancel(): void {
    this.from = null;
  }

  overlay(hover: Point | null): Partial<Overlay> {
    const at = this.from ?? hover;
    return {
      lineEnds: lineEnds(this.ctx.playground),
      eraser: at && { ...at, radius: this.radius },
    };
  }
}
