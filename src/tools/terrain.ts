// The terrain tools (only in the level editor for now: to offer them in
// free play too, take out `editorOnly`, as levels give the player no
// terrain anyway).
import { outlineShape, roundShape } from "../geometry/outline";
import { distance, type Point } from "../geometry/point";
import { smoothStroke } from "../geometry/stroke";
import type { DownResult, Overlay, Tool, ToolContext } from "./tool";

// Ignore pointer moves shorter than this while drawing round a shape.
const MIN_POINT_SPACING_PX = 4;
// Screen pixels a press can wander and still be a tap.
const TAP_PX = 10;

// Draw round a shape to make it (the ends join up), or tap for a ready-made
// one.
abstract class ShapeTool implements Tool {
  abstract label: string;
  abstract icon: string;
  abstract title: string;
  abstract hints: { mouse: string; touch: string };
  cursor = "crosshair";
  popsBubbles = false;
  supply = "terrain" as const;
  editorOnly = true;

  // The stroke going round it, or null when not drawing.
  private stroke: Point[] | null = null;
  // How far the press has wandered, in screen pixels.
  private wandered = 0;

  // How the stroke's smoothed into a shape (see `outlineShape`).
  protected abstract tolerance: number;
  protected abstract kind: "rock";
  // The shape a tap at `p` makes.
  protected abstract readyMade(p: Point): Point[];
  protected abstract add(outline: Point[]): void;

  constructor(protected ctx: ToolContext) {}

  get busy(): boolean {
    return this.stroke !== null;
  }

  down(p: Point): DownResult {
    if (this.ctx.budget.left("terrain") < 1) return "none";
    this.stroke = [p];
    this.wandered = 0;
    return "drag";
  }

  move(p: Point): void {
    const stroke = this.stroke;
    if (!stroke) return;
    const zoom = this.ctx.camera.zoom;
    this.wandered = Math.max(this.wandered, distance(stroke[0], p) * zoom);
    if (distance(stroke.at(-1)!, p) >= MIN_POINT_SPACING_PX) stroke.push(p);
  }

  up(): void {
    const stroke = this.stroke;
    if (!stroke) return;
    const outline =
      this.wandered < TAP_PX
        ? this.readyMade(stroke[0])
        : outlineShape(stroke, this.tolerance);
    if (outline) this.add(outline);
    this.cancel();
  }

  cancel(): void {
    this.stroke = null;
  }

  overlay(): Partial<Overlay> {
    const stroke = this.stroke;
    if (!stroke || stroke.length < 3) return {};
    return {
      terrainPreview: { kind: this.kind, points: smoothStroke(stroke) },
    };
  }
}

// How far out each corner of a ready-made rock is, going round: lumpy, so
// it looks like a boulder.
const BOULDER = [1, 0.82, 0.93, 0.78, 0.9, 1.04, 0.86, 0.97, 0.8, 0.95];
const BOULDER_RADIUS_PX = 36;

export class RockTool extends ShapeTool {
  label = "Rock";
  icon = "🪨";
  title = "Draw a rock to get past";
  hints = {
    mouse:
      "Drag round to draw a rock, or click for a boulder · balls roll over rocks but can't go through · the eraser removes rocks",
    touch:
      "Draw round to make a rock, or tap for a boulder · balls roll over rocks but can't go through",
  };
  protected tolerance = 3;
  protected kind = "rock" as const;

  protected readyMade(p: Point): Point[] {
    return roundShape(p, BOULDER_RADIUS_PX, BOULDER);
  }

  protected add(outline: Point[]): void {
    this.ctx.playground.rocks.add(outline);
  }
}
