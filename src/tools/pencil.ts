import type { LineEnd } from "../world/playground";
import { distance, lerp, type Point } from "../geometry/point";
import { freehandShape, smoothStroke } from "../geometry/stroke";
import { commitLine, lineEnds } from "./lines";
import type { DownResult, Overlay, Tool, ToolContext } from "./tool";

// Ignore pointer moves shorter than this while drawing (Box2D rejects chain
// vertices that are too close together).
const MIN_POINT_SPACING_PX = 4;

// Freehand drawing. Starting or finishing on a line end joins onto that line.
export class PencilTool implements Tool {
  label = "Draw";
  icon = "✏️";
  title = "Draw freehand lines";
  cursor = "crosshair";
  hints = {
    mouse:
      "Drag to draw · start or finish on a ring to join lines up · click bubbles to pop them · hold Space and drag to move around",
    touch:
      "Drag to draw · start or finish on a ring to join lines up · two fingers to scroll and zoom",
  };
  popsBubbles = true;
  supply = "ink" as const;

  // The stroke being drawn, or null when not drawing.
  private stroke: Point[] | null = null;
  // How long it is, and how long it can get before the ink runs out.
  private length = 0;
  private allowance = Infinity;
  // The line end the stroke started from, if it's continuing a line.
  private start: LineEnd | null = null;

  constructor(private ctx: ToolContext) {}

  get busy(): boolean {
    return this.stroke !== null;
  }

  get using(): number {
    return this.stroke ? this.length : 0;
  }

  down(p: Point): DownResult {
    this.allowance = this.ctx.budget.left("ink");
    if (this.allowance <= 0) return "none";
    this.start = this.ctx.findSnap(p);
    this.stroke = [this.start?.point ?? p];
    this.length = 0;
    return "drag";
  }

  move(p: Point): void {
    const last = this.stroke?.at(-1);
    if (!last) return;
    const step = distance(last, p);
    const room = this.allowance - this.length;
    if (step < MIN_POINT_SPACING_PX || room <= 0) return;
    // Out of ink, the stroke ends where it ran out.
    this.stroke!.push(step <= room ? p : lerp(last, p, room / step));
    this.length += Math.min(step, room);
  }

  up(): void {
    if (this.stroke)
      commitLine(this.ctx, this.stroke, this.start, freehandShape);
    this.cancel();
  }

  cancel(): void {
    this.stroke = null;
    this.start = null;
  }

  overlay(hover: Point | null): Partial<Overlay> {
    const snapTargets: Point[] = [];
    if (this.stroke) {
      if (this.start) snapTargets.push(this.start.point);
      // Where the stroke would join if it finished here.
      const join = this.ctx.findSnap(this.stroke.at(-1)!, this.start?.line);
      if (join) snapTargets.push(join.point);
    } else if (hover) {
      // Which end a new stroke would start from.
      const start = this.ctx.findSnap(hover);
      if (start) snapTargets.push(start.point);
    }
    return {
      preview:
        this.stroke &&
        this.ctx.playground.noDraw.outside(smoothStroke(this.stroke)),
      lineEnds: lineEnds(this.ctx.playground),
      snapTargets,
    };
  }
}
