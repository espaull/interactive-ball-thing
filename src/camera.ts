import { PX_PER_M, type Playground, type Thing } from "./physics";
import type { Point } from "./simplify";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
// How quickly the camera catches up with the ball (higher = snappier).
const FOLLOW_SPEED = 5;

// World coordinates are in pixels at zoom 1; the camera maps them to the screen.
export class Camera {
  // World point shown at the centre of the screen.
  x = 0;
  y = 0;
  zoom = 1;
  width = 0;
  height = 0;

  following = false;
  target: Thing | null = null;
  // Lets the toolbar keep the Follow button in sync.
  onFollowChange: (following: boolean) => void = () => {};

  resize(width: number, height: number): void {
    // First resize: line the world up with the screen so (0,0) is the top-left.
    if (this.width === 0) {
      this.x = width / 2;
      this.y = height / 2;
    } else {
      // Keep the top-left corner fixed, so resizing (like a phone's address
      // bar sliding away) reveals or hides space at the edges instead of
      // shifting everything on screen.
      this.x += (width - this.width) / 2 / this.zoom;
      this.y += (height - this.height) / 2 / this.zoom;
    }
    this.width = width;
    this.height = height;
  }

  home(): void {
    this.x = this.width / 2;
    this.y = this.height / 2;
    this.zoom = 1;
    this.setFollowing(false);
  }

  setFollowing(following: boolean, target: Thing | null = null): void {
    this.following = following;
    this.target = following ? target : null;
    this.onFollowChange(following);
  }

  screenToWorld(sx: number, sy: number): Point {
    return {
      x: (sx - this.width / 2) / this.zoom + this.x,
      y: (sy - this.height / 2) / this.zoom + this.y,
    };
  }

  panByScreen(dx: number, dy: number): void {
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
  }

  // Zoom while keeping the world point under the cursor fixed.
  zoomAt(sx: number, sy: number, factor: number): void {
    const before = this.screenToWorld(sx, sy);
    this.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoom * factor));
    const after = this.screenToWorld(sx, sy);
    this.x += before.x - after.x;
    this.y += before.y - after.y;
  }

  update(dt: number, playground: Playground): void {
    if (!this.target) return;
    // The ball fell off the world (or the bubble floated away) and was
    // removed: stay put, keep Follow on so the next one is picked up.
    if (!playground.contains(this.target)) {
      this.target = null;
      return;
    }
    const pos = this.target.body.getPosition();
    // Frame-rate independent smoothing.
    const t = 1 - Math.exp(-FOLLOW_SPEED * dt);
    this.x += (pos.x * PX_PER_M - this.x) * t;
    this.y += (pos.y * PX_PER_M - this.y) * t;
  }

  apply(ctx: CanvasRenderingContext2D): void {
    ctx.translate(this.width / 2, this.height / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }
}
