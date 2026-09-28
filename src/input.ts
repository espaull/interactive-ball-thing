import type { Camera } from "./camera";
import { catmullRom } from "./curve";
import type { Line, LineEnd, Playground } from "./physics";
import type { Point } from "./simplify";
import { LINE_SPACING_PX, smoothStroke, splitTail } from "./stroke";

export type Tool = "pencil" | "curve" | "eraser" | "move" | "ball" | "bubble";

// Ignore pointer moves shorter than this while drawing (Box2D rejects chain
// vertices that are too close together). Measured in world pixels.
const MIN_POINT_SPACING_PX = 4;
// Clicking within this many screen pixels of the last curve point finishes it.
const CURVE_FINISH_RADIUS_PX = 12;
// Starting (or ending) a line within this many screen pixels of another
// line's end joins onto that line.
const SNAP_RADIUS_PX = 20;
// Size of the eraser, in screen pixels.
const ERASER_RADIUS_PX = 18;

const TOOL_CURSORS: Record<Tool, string> = {
  pencil: "crosshair",
  curve: "crosshair",
  eraser: "none", // the eraser's circle is drawn instead
  move: "grab",
  ball: "pointer",
  bubble: "pointer",
};

export interface Overlay {
  // The line being drawn, in grey.
  preview: Point[] | null;
  // Points placed with the Curve tool.
  curveHandles: Point[] | null;
  // Ends of existing lines that a new line can join onto.
  lineEnds: Point[] | null;
  // The ends that will be (or are being) joined.
  snapTargets: Point[];
  // The eraser's circle, in world pixels.
  eraser: { x: number; y: number; radius: number } | null;
}

// A line's points, reordered so the given end comes last.
function endingAt(end: LineEnd): Point[] {
  return end.atStart ? [...end.line.points].reverse() : end.line.points;
}

export class Input {
  tool: Tool = "pencil";
  // The freehand stroke being drawn (world pixels), or null when not drawing.
  stroke: Point[] | null = null;
  // Points placed so far with the Curve tool, or null when no curve is started.
  curvePoints: Point[] | null = null;
  // The line end the current line started from, if it's continuing one.
  private continuing: LineEnd | null = null;
  // Where the pointer is hovering, for the curve preview and snap highlight.
  private hover: Point | null = null;
  private pointerId: number | null = null;
  // Last screen position while panning.
  private panFrom: Point | null = null;
  // Last world position the eraser rubbed at, while erasing.
  private eraseFrom: Point | null = null;
  // Holding Space pans with any tool.
  private spaceHeld = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private playground: Playground,
    private camera: Camera,
  ) {
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
  }

  setTool(tool: Tool): void {
    if (tool !== "curve") this.finishCurve();
    this.tool = tool;
    this.updateCursor();
  }

  // True while a line is being made, so the camera can hold still.
  get isDrawing(): boolean {
    return this.stroke !== null || this.curvePoints !== null;
  }

  // True while drawing or erasing: the camera holds still for both.
  get isBusy(): boolean {
    return this.isDrawing || this.eraseFrom !== null;
  }

  // Everything drawn on top of the world to show what the tools are doing.
  get overlay(): Overlay {
    const drawingTool = this.tool === "pencil" || this.tool === "curve";
    const snapTargets: Point[] = [];
    if (this.continuing) snapTargets.push(this.continuing.point);
    // Where the line being drawn would join at its far end.
    const tip = this.stroke?.at(-1) ?? (this.curvePoints ? this.hover : null);
    const join = tip ? this.findSnap(tip, this.continuing?.line) : null;
    if (join) snapTargets.push(join.point);
    // Which end a new line would start from.
    if (drawingTool && !this.isDrawing && this.hover) {
      const start = this.findSnap(this.hover);
      if (start) snapTargets.push(start.point);
    }
    const eraserAt = this.eraseFrom ?? this.hover;
    return {
      preview: this.preview(),
      curveHandles: this.curvePoints,
      lineEnds: drawingTool || this.tool === "eraser" ? this.lineEnds() : null,
      snapTargets,
      eraser:
        this.tool === "eraser" && eraserAt && !this.spaceHeld && !this.panFrom
          ? { ...eraserAt, radius: this.eraserRadius }
          : null,
    };
  }

  private get eraserRadius(): number {
    return ERASER_RADIUS_PX / this.camera.zoom;
  }

  // The line to show in grey while it's being made.
  private preview(): Point[] | null {
    if (this.stroke) return smoothStroke(this.stroke);
    if (!this.curvePoints) return null;
    const points =
      this.hover && !this.isNearLastCurvePoint(this.hover)
        ? [...this.curvePoints, this.hover]
        : this.curvePoints;
    return catmullRom(points, LINE_SPACING_PX);
  }

  private lineEnds(): Point[] {
    return this.playground.lines.flatMap((l) => [l.points[0], l.points.at(-1)!]);
  }

  private findSnap(p: Point, except?: Line): LineEnd | null {
    return this.playground.lineEndAt(p.x, p.y, SNAP_RADIUS_PX / this.camera.zoom, except);
  }

  // Finish a line. It can join onto a line end where it starts (the end it
  // was continued from) and/or where it finishes, so it can bridge the gap
  // between two lines. `build` turns the new points into the final smooth
  // shape, blending in `lead` (the start line's last stretch, ending where
  // `points` begins) and `trail` (the end line's first stretch, starting
  // where `points` finishes).
  private commit(
    points: Point[],
    build: (points: Point[], lead: Point[], trail: Point[]) => Point[],
  ): void {
    const start = this.continuing;
    this.continuing = null;
    if (points.length < 2) return;
    const startEnd = start && this.playground.lines.includes(start.line) ? start : null;
    // Never join a line to itself, which would make a loop.
    const finishEnd = this.findSnap(points.at(-1)!, startEnd?.line);

    let head: Point[] = [];
    let lead: Point[] = [];
    if (startEnd) ({ head, tail: lead } = splitTail(endingAt(startEnd)));

    let trail: Point[] = [];
    let rest: Point[] = [];
    if (finishEnd) {
      // Snap the last point onto the end, then carry on along that line.
      points = [...points.slice(0, -1), finishEnd.point];
      const split = splitTail(endingAt(finishEnd));
      trail = split.tail.reverse();
      rest = split.head.reverse();
    }

    // Each blended stretch is re-shaped with the new part, replacing it.
    const shape = [...head, ...build(points, lead, trail), ...rest];
    if (startEnd) this.playground.replaceLine(startEnd.line, shape);
    else this.playground.addLine(shape);
    if (finishEnd) this.playground.removeLine(finishEnd.line);
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
        : TOOL_CURSORS[this.tool];
  }

  private isNearLastCurvePoint(p: Point): boolean {
    const last = this.curvePoints?.at(-1);
    if (!last) return false;
    return Math.hypot(p.x - last.x, p.y - last.y) * this.camera.zoom <= CURVE_FINISH_RADIUS_PX;
  }

  private addCurvePoint(p: Point): void {
    if (!this.curvePoints) {
      this.continuing = this.findSnap(p);
      this.curvePoints = [this.continuing?.point ?? p];
    } else if (this.isNearLastCurvePoint(p)) {
      // Clicking the last point again (or double-clicking) finishes the curve.
      this.finishCurve();
    } else if (this.findSnap(p, this.continuing?.line)) {
      // Clicking another line's end joins onto it, which finishes the curve.
      this.curvePoints.push(p);
      this.finishCurve();
    } else {
      this.curvePoints.push(p);
    }
  }

  cancelCurve(): void {
    this.curvePoints = null;
    this.continuing = null;
  }

  private finishCurve(): void {
    if (this.curvePoints) {
      // Anchor the spline on the far ends of the blended stretches (not every
      // point of them), so turns into and out of the curve are spread out.
      this.commit(this.curvePoints, (points, lead, trail) =>
        catmullRom(
          [
            ...(lead.length > 1 ? [lead[0]] : []),
            ...points,
            ...(trail.length > 1 ? [trail.at(-1)!] : []),
          ],
          LINE_SPACING_PX,
        ),
      );
    }
    this.cancelCurve();
  }

  private startPan(e: PointerEvent, screen: Point): void {
    this.panFrom = screen;
    this.pointerId = e.pointerId;
    this.canvas.setPointerCapture(e.pointerId);
    this.updateCursor();
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

    // Tapping a bubble pops it. Not with Move (tapping follows it instead) or
    // Curve (a bubble drifting under a click shouldn't spoil the curve).
    if (this.tool !== "move" && this.tool !== "curve") {
      const bubble = this.playground.bubbleAt(p.x, p.y);
      if (bubble) {
        this.playground.popBubble(bubble);
        return;
      }
    }

    switch (this.tool) {
      case "move": {
        // Tapping a ball or bubble follows it; dragging anywhere else pans.
        const thing = this.playground.thingAt(p.x, p.y);
        if (thing) this.camera.setFollowing(true, thing);
        else this.startPan(e, screen);
        return;
      }
      case "ball": {
        const ball = this.playground.addBall(p.x, p.y);
        if (this.camera.following) this.camera.setFollowing(true, ball);
        return;
      }
      case "bubble": {
        const bubble = this.playground.addBubble(p.x, p.y);
        if (this.camera.following) this.camera.setFollowing(true, bubble);
        return;
      }
      case "curve":
        this.addCurvePoint(p);
        return;
      case "eraser":
        this.eraseFrom = p;
        this.playground.eraseAt(p.x, p.y, this.eraserRadius);
        this.pointerId = e.pointerId;
        this.canvas.setPointerCapture(e.pointerId);
        return;
      case "pencil":
        this.continuing = this.findSnap(p);
        this.stroke = [this.continuing?.point ?? p];
        this.pointerId = e.pointerId;
        this.canvas.setPointerCapture(e.pointerId);
        return;
    }
  };

  private onMove = (e: PointerEvent) => {
    if (this.tool === "curve" || this.tool === "pencil" || this.tool === "eraser") {
      const screen = this.screenPoint(e);
      this.hover = this.camera.screenToWorld(screen.x, screen.y);
    }
    if (e.pointerId !== this.pointerId) return;

    if (this.eraseFrom) {
      // Rub out along the whole path, not just where move events land, so a
      // quick swipe doesn't skip bits.
      const screen = this.screenPoint(e);
      const to = this.camera.screenToWorld(screen.x, screen.y);
      const from = this.eraseFrom;
      const r = this.eraserRadius;
      // Stamping every quarter-radius keeps the swept edge within 1% of straight.
      const steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / (r / 4));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        this.playground.eraseAt(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, r);
      }
      this.eraseFrom = to;
      return;
    }

    if (this.panFrom) {
      // Panning by hand takes over from Follow.
      if (this.camera.following) this.camera.setFollowing(false);
      const screen = this.screenPoint(e);
      this.camera.panByScreen(screen.x - this.panFrom.x, screen.y - this.panFrom.y);
      this.panFrom = screen;
      return;
    }

    if (!this.stroke) return;
    // Coalesced events give smoother strokes on fast mouse movements.
    const events = e.getCoalescedEvents?.() ?? [e];
    for (const ev of events.length > 0 ? events : [e]) {
      const screen = this.screenPoint(ev);
      const p = this.camera.screenToWorld(screen.x, screen.y);
      const last = this.stroke[this.stroke.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) >= MIN_POINT_SPACING_PX) {
        this.stroke.push(p);
      }
    }
  };

  private onUp = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    if (this.stroke) {
      // The lead ends where the points start, and the trail starts where they
      // finish, so drop the shared points.
      this.commit(this.stroke, (points, lead, trail) =>
        smoothStroke([
          ...lead,
          ...points.slice(lead.length > 0 ? 1 : 0),
          ...trail.slice(1),
        ]),
      );
    }
    this.stroke = null;
    this.eraseFrom = null;
    this.panFrom = null;
    this.pointerId = null;
    this.updateCursor();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case " ":
        // Stops the page scrolling, and a focused toolbar button being pressed.
        e.preventDefault();
        this.spaceHeld = true;
        this.updateCursor();
        break;
      case "Enter":
        this.finishCurve();
        break;
      case "Escape":
        this.cancelCurve();
        break;
      case "Backspace":
      case "Delete":
        if (this.curvePoints) {
          this.curvePoints.pop();
          if (this.curvePoints.length === 0) this.cancelCurve();
        }
        break;
    }
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
