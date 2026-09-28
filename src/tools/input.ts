import type { Camera } from "../camera";
import type { Playground } from "../physics";
import type { Point } from "../simplify";
import type { Overlay, Tool } from "./tool";

// Turns pointer, wheel and keyboard events into tool actions. Handles what
// every tool shares (panning, zooming, popping bubbles, pointer capture) and
// passes the rest to the selected tool.
export class Input {
  tool: Tool;
  // Where the pointer is, in screen pixels, or null when it's off the canvas.
  private hover: Point | null = null;
  private pointerId: number | null = null;
  // True while a press is being handled by the tool as a drag.
  private dragging = false;
  // Last screen position while panning.
  private panFrom: Point | null = null;
  // Holding Space pans with any tool.
  private spaceHeld = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private playground: Playground,
    private camera: Camera,
    tools: Tool[],
  ) {
    this.tool = tools[0];
    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointermove", this.onMove);
    canvas.addEventListener("pointerup", this.onUp);
    canvas.addEventListener("pointercancel", this.onUp);
    canvas.addEventListener("pointerleave", () => (this.hover = null));
    // Not passive, so we can stop the browser scrolling/zooming the page.
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    // Stop the middle button starting the browser's autoscroll.
    canvas.addEventListener("mousedown", (e) => e.button === 1 && e.preventDefault());
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    // Releasing Space in another window would otherwise leave it "stuck".
    window.addEventListener("blur", () => {
      this.spaceHeld = false;
      this.updateCursor();
    });
    this.updateCursor();
  }

  setTool(tool: Tool): void {
    if (tool !== this.tool) this.tool.deactivate?.();
    this.tool = tool;
    this.updateCursor();
  }

  // Throw away anything half-done (used by Clear).
  cancel(): void {
    this.tool.cancel?.();
  }

  // True while drawing or erasing: the camera holds still so the world
  // doesn't slide out from under the pointer.
  get isBusy(): boolean {
    return this.tool.busy;
  }

  get overlay(): Overlay {
    // No hover effects (like the eraser's circle) while panning.
    const hover =
      this.hover && !this.spaceHeld && !this.panFrom
        ? this.camera.screenToWorld(this.hover.x, this.hover.y)
        : null;
    return {
      preview: null,
      curveHandles: null,
      lineEnds: null,
      snapTargets: [],
      eraser: null,
      ...this.tool.overlay?.(hover),
    };
  }

  // Pointer position relative to the canvas, in CSS pixels.
  private screenPoint(e: MouseEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private updateCursor(): void {
    this.canvas.style.cursor = this.panFrom ? "grabbing" : this.spaceHeld ? "grab" : this.tool.cursor;
  }

  private capture(e: PointerEvent): void {
    this.pointerId = e.pointerId;
    this.canvas.setPointerCapture(e.pointerId);
  }

  private onDown = (e: PointerEvent) => {
    if (this.pointerId !== null) return; // one finger at a time
    const middle = e.button === 1;
    if (e.button !== 0 && !middle) return;
    const screen = this.screenPoint(e);
    const p = this.camera.screenToWorld(screen.x, screen.y);

    // Space+drag or middle-drag pans whatever tool is selected.
    if (middle || this.spaceHeld) {
      this.startPan(e, screen);
      return;
    }

    if (this.tool.popsBubbles) {
      const bubble = this.playground.bubbleAt(p.x, p.y);
      if (bubble) {
        this.playground.popBubble(bubble);
        return;
      }
    }

    const result = this.tool.down(p);
    if (result === "pan") {
      this.startPan(e, screen);
    } else if (result === "drag") {
      this.dragging = true;
      this.capture(e);
    }
  };

  private startPan(e: PointerEvent, screen: Point): void {
    this.panFrom = screen;
    this.capture(e);
    this.updateCursor();
  }

  private onMove = (e: PointerEvent) => {
    this.hover = this.screenPoint(e);
    if (e.pointerId !== this.pointerId) return;

    if (this.panFrom) {
      // Panning by hand takes over from Follow.
      if (this.camera.following) this.camera.setFollowing(false);
      const screen = this.screenPoint(e);
      this.camera.panByScreen(screen.x - this.panFrom.x, screen.y - this.panFrom.y);
      this.panFrom = screen;
      return;
    }

    if (this.dragging) {
      // Coalesced events give smoother strokes on fast mouse movements.
      const events = e.getCoalescedEvents?.() ?? [];
      for (const ev of events.length > 0 ? events : [e]) {
        const screen = this.screenPoint(ev);
        this.tool.move?.(this.camera.screenToWorld(screen.x, screen.y));
      }
    }
  };

  private onUp = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    if (this.dragging) this.tool.up?.();
    this.dragging = false;
    this.panFrom = null;
    this.pointerId = null;
    this.updateCursor();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === " ") {
      // Stops the page scrolling, and a focused toolbar button being pressed.
      e.preventDefault();
      this.spaceHeld = true;
      this.updateCursor();
      return;
    }
    this.tool.key?.(e.key);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.key !== " ") return;
    e.preventDefault();
    this.spaceHeld = false;
    this.updateCursor();
  };

  // Two-finger scroll / mouse wheel pans; pinch (sent as ctrl+wheel) or
  // Ctrl/Cmd+wheel zooms.
  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const screen = this.screenPoint(e);
      this.camera.zoomAt(screen.x, screen.y, Math.exp(-e.deltaY * 0.01));
      return;
    }
    if (this.camera.following) this.camera.setFollowing(false);
    // Shift+wheel scrolls sideways on a plain mouse.
    const dx = e.shiftKey && e.deltaX === 0 ? e.deltaY : e.deltaX;
    const dy = e.shiftKey && e.deltaX === 0 ? 0 : e.deltaY;
    this.camera.panByScreen(-dx, -dy);
  };
}
