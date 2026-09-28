import { catmullRom } from "../curve";
import type { LineEnd } from "../physics";
import type { Point } from "../simplify";
import { curveShape, LINE_SPACING_PX } from "../stroke";
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

  // Points placed so far, or null when no curve is started.
  private points: Point[] | null = null;
  // The line end the curve started from, if it's continuing a line.
  private start: LineEnd | null = null;

  constructor(private ctx: ToolContext) {}

  get busy(): boolean {
    return this.points !== null;
  }

  down(p: Point): DownResult {
    if (!this.points) {
      this.start = this.ctx.findSnap(p);
      this.points = [this.start?.point ?? p];
    } else if (this.isNearLastPoint(p)) {
      // Clicking the last point again (or double-clicking) finishes the curve.
      this.finish();
    } else if (this.ctx.findSnap(p, this.start?.line)) {
      // Clicking another line's end joins onto it, which finishes the curve.
      this.points.push(p);
      this.finish();
    } else {
      this.points.push(p);
    }
    return "none";
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
        this.points?.pop();
        if (this.points?.length === 0) this.cancel();
        break;
    }
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
        hover && !this.isNearLastPoint(hover) ? [...this.points, hover] : this.points;
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
    const screenDistance = Math.hypot(p.x - last.x, p.y - last.y) * this.ctx.camera.zoom;
    return screenDistance <= FINISH_RADIUS_PX;
  }
}
