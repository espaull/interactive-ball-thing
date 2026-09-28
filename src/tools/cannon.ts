import { distance, type Point } from "../geometry/point";
import { predictPath, type Cannon } from "../world/cannons";
import type { DownResult, Overlay, Tool, ToolContext } from "./tool";

// Screen pixels of drag that count as aiming rather than a tap.
const AIM_DEADZONE_PX = 12;
// Drag length (screen pixels) from lowest to highest power.
const MIN_DRAG_PX = 20;
const MAX_DRAG_PX = 160;
// A newly tapped-down cannon points up and to the right at medium power.
const DEFAULT_ANGLE = -Math.PI / 4;
const DEFAULT_POWER = 0.5;

// Place cannons that fire a ball every couple of seconds. Press and drag the
// way it should fire: the longer the drag, the harder it fires. Dragging
// from an existing cannon re-aims it; tapping one pauses or restarts it.
export class CannonTool implements Tool {
  label = "Cannon";
  icon = "💥";
  title = "Place a cannon that fires balls";
  cursor = "crosshair";
  hints = {
    mouse:
      "Drag the way you want it to fire (longer = stronger) · drag from a cannon to re-aim it · click one to pause it",
    touch:
      "Drag the way you want it to fire (longer = stronger) · drag from a cannon to re-aim it · tap one to pause it",
  };
  popsBubbles = true;

  // The cannon being placed or aimed, while the pointer is down.
  private aiming: Cannon | null = null;
  // Whether that cannon was already there (so a tap pauses it).
  private existing = false;
  private dragged = false;

  constructor(private ctx: ToolContext) {}

  get busy(): boolean {
    return this.aiming !== null;
  }

  down(p: Point): DownResult {
    const { playground } = this.ctx;
    const found = playground.cannonAt(p.x, p.y);
    this.existing = found !== null;
    this.aiming =
      found ?? playground.addCannon(p.x, p.y, DEFAULT_ANGLE, DEFAULT_POWER);
    this.dragged = false;
    // Hold fire while it's being aimed.
    this.aiming.aiming = true;
    return "drag";
  }

  move(p: Point): void {
    const cannon = this.aiming;
    if (!cannon) return;
    const screenDistance = distance(p, cannon) * this.ctx.camera.zoom;
    if (!this.dragged && screenDistance < AIM_DEADZONE_PX) return;
    this.dragged = true;
    cannon.angle = Math.atan2(p.y - cannon.y, p.x - cannon.x);
    cannon.power = Math.max(
      0,
      Math.min(1, (screenDistance - MIN_DRAG_PX) / (MAX_DRAG_PX - MIN_DRAG_PX)),
    );
  }

  up(): void {
    const cannon = this.aiming;
    if (!cannon) return;
    if (this.existing && !this.dragged) {
      cannon.active = !cannon.active;
    }
    if (this.dragged) {
      // Try the new aim straight away.
      cannon.active = true;
      cannon.nextShotAt = this.ctx.playground.now + 0.3;
    }
    cannon.aiming = false;
    this.aiming = null;
  }

  cancel(): void {
    if (this.aiming) this.aiming.aiming = false;
    this.aiming = null;
  }

  overlay(): Partial<Overlay> {
    // While aiming, show where the shot will go.
    return { trajectory: this.aiming && predictPath(this.aiming) };
  }
}
