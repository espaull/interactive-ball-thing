import type { Camera } from "../camera";
import type { Playground } from "../world/playground";
import { distance, type Point } from "../geometry/point";
import { Signal } from "../signal";
import type { Overlay, Tool } from "./tool";

// A single finger waits this long (ms), or until it moves or lifts, before
// the tool sees it, in case a second finger follows for a two-finger gesture.
const TOUCH_WAIT_MS = 100;
// Moving a finger this far (screen pixels) means it's a drag, not a pinch.
const TOUCH_SLOP_PX = 10;
// A pinch that moves this far (screen pixels) scrolls, so it turns Follow off.
const PINCH_PAN_PX = 10;

// A keyboard shortcut: Ctrl (or Cmd on a Mac) with a key, and Shift or not.
export interface Shortcut {
  key: string;
  shift?: boolean;
  run(): void;
}

// A finger that's down, waiting to see if it's the start of a pinch.
interface PendingTouch {
  id: number;
  start: Point;
  moves: Point[];
  timer: number;
}

// Two fingers scrolling and zooming.
interface Pinch {
  ids: [number, number];
  // Where the fingers were at the last step.
  a: Point;
  b: Point;
  // How far the pinch has scrolled so far.
  panned: number;
}

// Turns pointer, wheel and keyboard events into tool actions. Handles what
// every tool shares (panning, zooming, popping bubbles, pointer capture,
// two-finger gestures) and passes the rest to the selected tool.
export class Input {
  // Where the pointer is, in screen pixels, or null when it's off the canvas.
  private hover: Point | null = null;
  // The pointer the tool (or a pan) is following.
  private pointerId: number | null = null;
  // True while a press is being handled by the tool as a drag.
  private dragging = false;
  // Last screen position while panning.
  private panFrom: Point | null = null;
  // Holding Space pans with any tool.
  private spaceHeld = false;
  // Whenever something the tool was doing has finished (a press, a drag, a
  // key, switching tools), for Undo's checkpoints.
  readonly actionEnded = new Signal();
  // Ctrl/Cmd shortcuts, which are handled here rather than by the tool.
  private shortcuts: Shortcut[] = [];

  // Fingers on the canvas, by pointer id (screen pixels).
  private touches = new Map<number, Point>();
  private pending: PendingTouch | null = null;
  private pinch: Pinch | null = null;
  // After a pinch, fingers are ignored until they've all been lifted, so the
  // one left behind doesn't suddenly start drawing.
  private ignoreTouches = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private playground: Playground,
    private camera: Camera,
    // The tool selected to begin with.
    public tool: Tool,
  ) {
    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointermove", this.onMove);
    canvas.addEventListener("pointerup", this.onUp);
    canvas.addEventListener("pointercancel", this.onUp);
    canvas.addEventListener("pointerleave", () => (this.hover = null));
    // Not passive, so we can stop the browser scrolling/zooming the page.
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    // Stop the middle button starting the browser's autoscroll.
    canvas.addEventListener(
      "mousedown",
      (e) => e.button === 1 && e.preventDefault(),
    );
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
    this.actionEnded.emit();
  }

  addShortcut(shortcut: Shortcut): void {
    this.shortcuts.push(shortcut);
  }

  // Throw away anything half-done (used by Clear).
  cancel(): void {
    this.tool.cancel?.();
  }

  // Whether the tool has something half-done for Undo to step back through.
  get canUndoStep(): boolean {
    return this.tool.canUndoStep ?? false;
  }

  undoStep(): void {
    this.tool.undoStep?.();
    this.actionEnded.emit();
  }

  // True while drawing or erasing: the camera holds still so the world
  // doesn't slide out from under the pointer.
  get isBusy(): boolean {
    return this.tool.busy;
  }

  get overlay(): Overlay {
    // No hover effects (like the eraser's circle) while panning.
    const hover =
      this.hover && !this.spaceHeld && !this.panFrom && !this.pinch
        ? this.camera.screenToWorld(this.hover.x, this.hover.y)
        : null;
    return {
      preview: null,
      curveHandles: null,
      lineEnds: null,
      snapTargets: [],
      eraser: null,
      boostPreview: null,
      portalPending: null,
      trajectory: null,
      ...this.tool.overlay?.(hover),
    };
  }

  // Pointer position relative to the canvas, in CSS pixels.
  private screenPoint(e: MouseEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private updateCursor(): void {
    this.canvas.style.cursor = this.panFrom
      ? "grabbing"
      : this.spaceHeld
        ? "grab"
        : this.tool.cursor;
  }

  private capture(pointerId: number): void {
    try {
      this.canvas.setPointerCapture(pointerId);
    } catch {
      // The pointer has already gone (lifted just now); nothing to capture.
    }
  }

  // --- Pressing, moving and releasing (mouse, pen, or a single finger) ---

  private onDown = (e: PointerEvent) => {
    if (e.pointerType === "touch") {
      this.onTouchDown(e);
      return;
    }
    const middle = e.button === 1;
    if (e.button !== 0 && !middle) return;
    this.press(e.pointerId, this.screenPoint(e), middle);
  };

  // Start whatever a press at `screen` does: a pan, popping a bubble, or the
  // tool's own action.
  private press(pointerId: number, screen: Point, middle = false): void {
    if (this.pointerId !== null) return; // one pointer at a time
    const p = this.camera.screenToWorld(screen.x, screen.y);

    // Space+drag or middle-drag pans whatever tool is selected.
    if (middle || this.spaceHeld) {
      this.startPan(pointerId, screen);
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
      this.startPan(pointerId, screen);
    } else if (result === "drag") {
      this.dragging = true;
      this.pointerId = pointerId;
      this.capture(pointerId);
    } else {
      this.actionEnded.emit();
    }
  }

  private startPan(pointerId: number, screen: Point): void {
    this.panFrom = screen;
    this.pointerId = pointerId;
    this.capture(pointerId);
    this.updateCursor();
  }

  private onMove = (e: PointerEvent) => {
    this.hover = this.screenPoint(e);
    if (e.pointerType === "touch" && this.onTouchMove(e)) return;
    // Coalesced events give smoother strokes on fast mouse movements.
    const events = e.getCoalescedEvents?.() ?? [];
    const points = (events.length > 0 ? events : [e]).map((ev) =>
      this.screenPoint(ev),
    );
    this.moveTo(e.pointerId, points);
  };

  // The pointer being followed moved through `points` (screen pixels).
  private moveTo(pointerId: number, points: Point[]): void {
    if (pointerId !== this.pointerId || points.length === 0) return;

    if (this.panFrom) {
      // Panning by hand takes over from Follow.
      if (this.camera.following) this.camera.setFollowing(false);
      const to = points[points.length - 1];
      this.camera.panByScreen(to.x - this.panFrom.x, to.y - this.panFrom.y);
      this.panFrom = to;
      return;
    }

    if (this.dragging) {
      for (const screen of points) {
        this.tool.move?.(this.camera.screenToWorld(screen.x, screen.y));
      }
    }
  }

  private onUp = (e: PointerEvent) => {
    if (e.pointerType === "touch") {
      this.onTouchUp(e);
      return;
    }
    this.release(e.pointerId);
  };

  private release(pointerId: number): void {
    if (pointerId !== this.pointerId) return;
    if (this.dragging) {
      this.tool.up?.();
      this.actionEnded.emit();
    }
    this.dragging = false;
    this.panFrom = null;
    this.pointerId = null;
    this.updateCursor();
  }

  // --- Fingers: one finger uses the tool, two scroll and zoom ---

  private onTouchDown(e: PointerEvent): void {
    const screen = this.screenPoint(e);
    this.touches.set(e.pointerId, screen);
    this.capture(e.pointerId);

    if (this.touches.size === 1) {
      if (this.ignoreTouches) return;
      // Wait a moment, in case this is the first finger of a pinch.
      this.pending = {
        id: e.pointerId,
        start: screen,
        moves: [],
        timer: window.setTimeout(() => this.commitPending(), TOUCH_WAIT_MS),
      };
      return;
    }

    if (this.touches.size === 2 && !this.pinch) this.startPinch();
    // A third finger (or more) is ignored.
  }

  // Returns true if the move was handled here (so it's not a normal move).
  private onTouchMove(e: PointerEvent): boolean {
    if (!this.touches.has(e.pointerId)) return true;
    const screen = this.screenPoint(e);
    this.touches.set(e.pointerId, screen);

    if (this.pending?.id === e.pointerId) {
      this.pending.moves.push(screen);
      // Moved far enough to be a drag: stop waiting and hand it to the tool.
      if (distance(screen, this.pending.start) > TOUCH_SLOP_PX) {
        this.commitPending();
      }
      return true;
    }

    if (this.pinch) {
      this.movePinch();
      return true;
    }

    if (this.ignoreTouches) return true;
    return false;
  }

  private onTouchUp(e: PointerEvent): void {
    if (!this.touches.delete(e.pointerId)) return;

    if (this.pending?.id === e.pointerId) {
      // A quick tap: the tool gets the press and the release together.
      this.commitPending();
      this.release(e.pointerId);
    } else if (this.pinch) {
      // One finger lifted: the pinch is over.
      this.pinch = null;
    } else {
      this.release(e.pointerId);
    }

    if (this.touches.size === 0) this.ignoreTouches = false;
  }

  // The waiting finger turned out to be on its own: give it to the tool,
  // replaying anywhere it has already moved.
  private commitPending(): void {
    const pending = this.pending;
    if (!pending) return;
    window.clearTimeout(pending.timer);
    this.pending = null;
    this.press(pending.id, pending.start);
    this.moveTo(pending.id, pending.moves);
  }

  private startPinch(): void {
    // Call off whatever the first finger was doing.
    if (this.pending) {
      window.clearTimeout(this.pending.timer);
      this.pending = null;
    } else if (this.pointerId !== null) {
      // A stroke already under way is thrown away, not drawn.
      if (this.dragging) {
        this.tool.cancel?.();
        this.actionEnded.emit();
      }
      this.dragging = false;
      this.panFrom = null;
      this.pointerId = null;
    }

    const [idA, idB] = [...this.touches.keys()];
    this.pinch = {
      ids: [idA, idB],
      a: this.touches.get(idA)!,
      b: this.touches.get(idB)!,
      panned: 0,
    };
    this.ignoreTouches = true;
  }

  private movePinch(): void {
    const pinch = this.pinch!;
    const a = this.touches.get(pinch.ids[0])!;
    const b = this.touches.get(pinch.ids[1])!;
    this.camera.pinch(pinch.a, pinch.b, a, b);

    // Scrolling with two fingers takes over from Follow (zooming doesn't).
    const fromMid = {
      x: (pinch.a.x + pinch.b.x) / 2,
      y: (pinch.a.y + pinch.b.y) / 2,
    };
    const toMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    pinch.panned += distance(fromMid, toMid);
    if (pinch.panned > PINCH_PAN_PX && this.camera.following) {
      this.camera.setFollowing(false);
    }

    pinch.a = a;
    pinch.b = b;
  }

  // --- Keys and the wheel ---

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.key === " ") {
      // Stops the page scrolling, and a focused toolbar button being pressed.
      e.preventDefault();
      this.spaceHeld = true;
      this.updateCursor();
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      const shortcut = this.shortcuts.find(
        (s) =>
          s.key === e.key.toLowerCase() && (s.shift ?? false) === e.shiftKey,
      );
      if (shortcut) {
        e.preventDefault();
        shortcut.run();
      }
      return;
    }
    this.tool.key?.(e.key);
    this.actionEnded.emit();
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
