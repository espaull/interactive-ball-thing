import { distance, type Point } from "../geometry/point";
import { PORTAL_COLORS } from "../palette";
import type { PortalEnd } from "../world/playground";
import { PORTAL_RADIUS_PX } from "../world/portals";
import type { DownResult, Overlay, Tool, ToolContext } from "./tool";

// Screen pixels of drag that count as aiming rather than a tap.
const AIM_DEADZONE_PX = 12;

// What a press started on, which decides what a tap (no drag) does.
// "new": placed a portal, which stays unaimed. "pending": tapped the portal
// waiting for its partner, which takes it away. "placed": tapped a portal
// already in a pair, which un-aims it.
type Target = "new" | "pending" | "placed";

// Place portals in pairs: the first tap puts down one end, the second its
// partner. Each pair gets its own colour. Dragging while placing one aims it:
// things come out of it that way. Dragging from a portal already down
// re-aims it; tapping one lets things carry straight on through again.
export class PortalTool implements Tool {
  label = "Portal";
  icon = "🌀";
  title = "Place a pair of portals";
  cursor = "crosshair";
  hints = {
    mouse:
      "Click to place a portal, then click again for its partner · drag as you place one to aim where balls come out · drag a portal to re-aim it, click it to un-aim it · Esc cancels",
    touch:
      "Tap to place a portal, then tap again for its partner · drag as you place one to aim where balls come out · drag a portal to re-aim it, tap it to un-aim it",
  };
  popsBubbles = true;
  supply = "portals" as const;

  // The first end of a pair, waiting for its partner. It's not in the
  // playground yet, so it's the tool's own to change.
  private first: { x: number; y: number; aim: number | null } | null = null;
  // The portal being aimed, while the pointer is down.
  private aiming: PortalEnd | null = null;
  private target: Target = "new";
  private pressedAt: Point = { x: 0, y: 0 };
  private dragged = false;

  constructor(private ctx: ToolContext) {}

  get busy(): boolean {
    return this.aiming !== null;
  }

  // The first colour no pair is using, so pairs are easy to tell apart
  // (even ones loaded from a save). Once they're all taken, they go round
  // again.
  private get color(): string {
    const pairs = this.ctx.playground.portals.pairs;
    const used = new Set(pairs.map((pair) => pair.color));
    return (
      PORTAL_COLORS.find((color) => !used.has(color)) ??
      PORTAL_COLORS[pairs.length % PORTAL_COLORS.length]
    );
  }

  down(p: Point): DownResult {
    const { playground } = this.ctx;
    const placed = playground.portals.at(p.x, p.y);
    if (this.first && distance(p, this.first) < PORTAL_RADIUS_PX * 2) {
      this.aim(this.first, "pending", p);
    } else if (placed) {
      this.aim(placed, "placed", p);
    } else if (playground.noDraw.covers(p)) {
      // Nothing can be put in a no-drawing area.
      return "none";
    } else if (!this.first) {
      if (this.ctx.budget.left("portals") < 1) {
        return "none";
      }
      this.first = { x: p.x, y: p.y, aim: null };
      this.aim(this.first, "new", p);
    } else {
      const { first } = this;
      const pair = playground.portals.add(first, p, this.color, first.aim);
      this.first = null;
      this.aim(pair.b, "new", p);
    }
    return "drag";
  }

  private aim(end: PortalEnd, target: Target, p: Point): void {
    this.aiming = end;
    this.target = target;
    this.pressedAt = p;
    this.dragged = false;
  }

  move(p: Point): void {
    const end = this.aiming;
    if (!end) return;
    const screenDistance = distance(p, this.pressedAt) * this.ctx.camera.zoom;
    if (!this.dragged && screenDistance < AIM_DEADZONE_PX) return;
    this.dragged = true;
    // Pressed off-centre, the pointer can pass right over the middle.
    if (distance(p, end) > 1) {
      this.setAim(end, Math.atan2(p.y - end.y, p.x - end.x));
    }
  }

  up(): void {
    if (this.aiming && !this.dragged) {
      if (this.target === "pending") this.first = null;
      if (this.target === "placed") this.setAim(this.aiming, null);
    }
    this.aiming = null;
  }

  private setAim(end: PortalEnd, aim: number | null): void {
    if (end === this.first) this.first.aim = aim;
    else this.ctx.playground.portals.aim(end, aim);
  }

  key(key: string): void {
    if (key === "Escape") this.cancel();
  }

  // A portal with no partner would lead nowhere, so leaving the tool
  // throws away a half-placed pair.
  deactivate(): void {
    this.cancel();
  }

  cancel(): void {
    this.first = null;
    this.aiming = null;
  }

  // Undo takes away a portal waiting for its partner.
  get canUndoStep(): boolean {
    return this.first !== null;
  }

  undoStep(): void {
    this.first = null;
  }

  overlay(): Partial<Overlay> {
    return {
      portalPending: this.first && { end: this.first, color: this.color },
    };
  }
}
