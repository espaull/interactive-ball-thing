import { distance, type Point } from "../geometry/point";
import type { Grabbed } from "../world/playground";
import type { DownResult, Tool, ToolContext } from "./tool";

// Screen pixels of drag before something picked up starts moving, so a
// wobbly tap doesn't nudge it.
const MOVE_DEADZONE_PX = 8;

// Drag to look around; drag a cannon, portal or cup to move it; tap a ball
// or bubble to follow it.
export class MoveTool implements Tool {
  label = "Move";
  icon = "✋";
  title = "Drag to look around or move things, tap a ball to follow it";
  cursor = "grab";
  hints = {
    mouse:
      "Drag to look around · drag a cannon, portal or cup to move it · tap a ball or bubble to follow it",
    touch:
      "Drag to look around · drag a cannon, portal or cup to move it · tap a ball or bubble to follow it · pinch with two fingers to zoom",
  };
  // Tapping a bubble follows it instead.
  popsBubbles = false;

  // What's being moved, while the pointer is down.
  private grabbed: Grabbed | null = null;
  // Where it was picked up from, and where the pointer was then.
  private from: Point = { x: 0, y: 0 };
  private pressedAt: Point = { x: 0, y: 0 };
  private dragged = false;

  constructor(private ctx: ToolContext) {}

  get busy(): boolean {
    return this.grabbed !== null;
  }

  down(p: Point): DownResult {
    const thing = this.ctx.playground.thingAt(p.x, p.y);
    if (thing) {
      this.ctx.camera.setFollowing(true, thing);
      return "none";
    }
    this.grabbed = this.ctx.playground.grabAt(p.x, p.y);
    if (!this.grabbed) return "pan";
    this.from = { x: this.grabbed.x, y: this.grabbed.y };
    this.pressedAt = p;
    this.dragged = false;
    return "drag";
  }

  move(p: Point): void {
    if (!this.grabbed) return;
    const screenDistance = distance(p, this.pressedAt) * this.ctx.camera.zoom;
    if (!this.dragged && screenDistance < MOVE_DEADZONE_PX) return;
    this.dragged = true;
    // Keep hold of it where it was grabbed, so it doesn't jump to the pointer.
    this.grabbed.moveTo(
      this.from.x + p.x - this.pressedAt.x,
      this.from.y + p.y - this.pressedAt.y,
    );
  }

  up(): void {
    this.grabbed?.drop();
    this.grabbed = null;
  }

  // A move that's called off (by a second finger starting a pinch) puts the
  // thing back where it was.
  cancel(): void {
    this.grabbed?.moveTo(this.from.x, this.from.y);
    this.up();
  }
}
