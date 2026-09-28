import type { Point } from "../geometry/point";
import type { DownResult, Tool, ToolContext } from "./tool";

// Drag to look around; tap a ball or bubble to follow it.
export class MoveTool implements Tool {
  label = "Move";
  icon = "✋";
  title = "Drag to look around, tap a ball to follow it";
  cursor = "grab";
  hints = {
    mouse: "Drag to look around · tap a ball or bubble to follow it",
    touch: "Drag to look around · tap a ball or bubble to follow it",
  };
  // Tapping a bubble follows it instead.
  popsBubbles = false;
  busy = false;

  constructor(private ctx: ToolContext) {}

  down(p: Point): DownResult {
    const thing = this.ctx.playground.thingAt(p.x, p.y);
    if (!thing) return "pan";
    this.ctx.camera.setFollowing(true, thing);
    return "none";
  }
}
