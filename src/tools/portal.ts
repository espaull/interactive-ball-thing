import { distance, type Point } from "../geometry/point";
import { PORTAL_COLORS } from "../palette";
import { PORTAL_RADIUS_PX } from "../world/portals";
import type { DownResult, Overlay, Tool, ToolContext } from "./tool";

// Place portals in pairs: the first tap puts down one end, the second its
// partner. Each pair gets its own colour.
export class PortalTool implements Tool {
  label = "Portal";
  icon = "🌀";
  title = "Place a pair of portals";
  cursor = "crosshair";
  hints = {
    mouse:
      "Click to place a portal, then click again for its partner · balls go in one and come out the other · Esc cancels",
    touch:
      "Tap to place a portal, then tap again for its partner · balls go in one and come out the other",
  };
  popsBubbles = true;
  busy = false;

  // The first end of a pair, waiting for its partner.
  private first: Point | null = null;
  private pairsMade = 0;

  constructor(private ctx: ToolContext) {}

  private get color(): string {
    return PORTAL_COLORS[this.pairsMade % PORTAL_COLORS.length];
  }

  down(p: Point): DownResult {
    if (!this.first) {
      this.first = p;
    } else if (distance(p, this.first) < PORTAL_RADIUS_PX * 2) {
      // Tapping the waiting portal again takes it away.
      this.first = null;
    } else {
      this.ctx.playground.addPortalPair(this.first, p, this.color);
      this.pairsMade++;
      this.first = null;
    }
    return "none";
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
  }

  overlay(): Partial<Overlay> {
    return {
      portalPending: this.first && { point: this.first, color: this.color },
    };
  }
}
