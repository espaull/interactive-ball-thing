import type { Point } from "../geometry/point";
import type { DownResult, Tool, ToolContext } from "./tool";

// Tap to drop a ball.
export class BallTool implements Tool {
  label = "Ball";
  icon = "⚽";
  title = "Tap to drop a ball";
  cursor = "pointer";
  hints = {
    mouse:
      "Click to drop a ball · click bubbles to pop them · hold Space and drag to move around",
    touch: "Tap to drop a ball · tap bubbles to pop them",
  };
  popsBubbles = true;
  busy = false;

  constructor(private ctx: ToolContext) {}

  down(p: Point): DownResult {
    const ball = this.ctx.playground.addBall(p.x, p.y);
    // With Follow on, the camera follows each new ball.
    if (this.ctx.camera.following) this.ctx.camera.setFollowing(true, ball);
    return "none";
  }
}

// Tap to blow a bubble.
export class BubbleTool implements Tool {
  label = "Bubble";
  icon = "🫧";
  title = "Tap to blow a bubble";
  cursor = "pointer";
  hints = {
    mouse:
      "Click to blow a bubble · click one to pop it · hold Space and drag to move around",
    touch: "Tap to blow a bubble · tap one to pop it",
  };
  popsBubbles = true;
  busy = false;

  constructor(private ctx: ToolContext) {}

  down(p: Point): DownResult {
    const bubble = this.ctx.playground.addBubble(p.x, p.y);
    if (this.ctx.camera.following) this.ctx.camera.setFollowing(true, bubble);
    return "none";
  }
}
