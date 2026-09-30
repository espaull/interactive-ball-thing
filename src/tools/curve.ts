import { catmullRom } from "../geometry/spline";
import type { LineEnd } from "../world/playground";
import { lerp, polylineLength, type Point } from "../geometry/point";
import { curveShape, LINE_SPACING_PX } from "../geometry/stroke";
import { commitLine, lineEnds } from "./lines";
import type { DownResult, Overlay, Tool, ToolContext } from "./tool";

// Clicking within this many screen pixels of the last point finishes the curve.
const FINISH_RADIUS_PX = 12;

// Click points and a smooth curve runs through them. Starting on a line end
// continues that line; clicking another line's end joins onto it and finishes.
export class CurveTool implements Tool {
  label = "Curve";
  icon = "〰️";
  title = "Click points to make a smooth curve";
  cursor = "crosshair";
  hints = {
    mouse:
      "Click to add points · click the last point again, a ring, or press Enter to finish · Backspace undoes a point · Esc cancels",
    touch: "Tap to add points · tap the last point again, or a ring, to finish",
  };
  // A bubble drifting under a click shouldn't spoil the curve.
  popsBubbles = false;
  supply = "ink" as const;

  // Points placed so far, or null when no curve is started.
  private points: Point[] | null = null;
  // The line end the curve started from, if it's continuing a line.
  private start: LineEnd | null = null;

  constructor(private ctx: ToolContext) {}

  get busy(): boolean {
    return this.points !== null;
  }

  get using(): number {
    return this.points
      ? polylineLength(catmullRom(this.points, LINE_SPACING_PX))
      : 0;
  }

  down(p: Point): DownResult {
    if (!this.points) {
      if (this.ctx.budget.left("ink") <= 0) return "none";
      this.start = this.ctx.findSnap(p);
      this.points = [this.start?.point ?? p];
    } else if (this.isNearLastPoint(p)) {
      // Clicking the last point again (or double-clicking) finishes the curve.
      this.finish();
    } else if (this.ctx.findSnap(p, this.start?.line)) {
      // Clicking another line's end joins onto it, which finishes the curve.
      this.addPoint(p);
      this.finish();
    } else if (!this.addPoint(p)) {
      this.finish();
    }
    return "none";
  }

  // Add a point, or only as far towards it as the ink goes. Returns whether
  // there's ink left for more.
  private addPoint(p: Point): boolean {
    const points = this.points!;
    const last = points.at(-1)!;
    const ink = this.ctx.budget.left("ink");
    const fits = (q: Point) =>
      polylineLength(catmullRom([...points, q], LINE_SPACING_PX)) <= ink;
    if (fits(p)) {
      points.push(p);
      return true;
    }
    // How far towards it fits, found by halving.
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      if (fits(lerp(last, p, mid))) lo = mid;
      else hi = mid;
    }
    if (lo > 0) points.push(lerp(last, p, lo));
    return false;
  }

  key(key: string): void {
    switch (key) {
      case "Enter":
        this.finish();
        break;
      case "Escape":
        this.cancel();
        break;
      case "Backspace":
      case "Delete":
        this.undoStep();
        break;
    }
  }

  get canUndoStep(): boolean {
    return this.points !== null;
  }

  // Take back the last point placed.
  undoStep(): void {
    this.points?.pop();
    if (this.points?.length === 0) this.cancel();
  }

  deactivate(): void {
    this.finish();
  }

  cancel(): void {
    this.points = null;
    this.start = null;
  }

  overlay(hover: Point | null): Partial<Overlay> {
    const snapTargets: Point[] = [];
    if (this.start) snapTargets.push(this.start.point);
    // Which end a click would start from, or join onto.
    const snap = hover && this.ctx.findSnap(hover, this.start?.line);
    if (snap) snapTargets.push(snap.point);

    let preview: Point[] | null = null;
    if (this.points) {
      // Preview the curve running on to where the pointer is.
      const points =
        hover && !this.isNearLastPoint(hover)
          ? [...this.points, hover]
          : this.points;
      preview = catmullRom(points, LINE_SPACING_PX);
    }
    return {
      preview,
      curveHandles: this.points,
      lineEnds: lineEnds(this.ctx.playground),
      snapTargets,
    };
  }

  private finish(): void {
    if (this.points) commitLine(this.ctx, this.points, this.start, curveShape);
    this.cancel();
  }

  private isNearLastPoint(p: Point): boolean {
    const last = this.points?.at(-1);
    if (!last) return false;
    const screenDistance =
      Math.hypot(p.x - last.x, p.y - last.y) * this.ctx.camera.zoom;
    return screenDistance <= FINISH_RADIUS_PX;
  }
}
