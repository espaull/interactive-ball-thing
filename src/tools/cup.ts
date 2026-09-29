import type { Point } from "../geometry/point";
import type { DownResult, Tool, ToolContext } from "./tool";

// Tap to place a goal cup. Balls that drop into it are caught and counted.
export class CupTool implements Tool {
  label = "Cup";
  icon = "🏆";
  title = "Place a goal cup";
  cursor = "crosshair";
  hints = {
    mouse:
      "Click to place a goal cup · get balls into it to score · the eraser removes cups",
    touch: "Tap to place a goal cup · get balls into it to score",
  };
  popsBubbles = true;
  busy = false;

  constructor(private ctx: ToolContext) {}

  down(p: Point): DownResult {
    this.ctx.playground.cups.add(p.x, p.y);
    return "none";
  }
}
