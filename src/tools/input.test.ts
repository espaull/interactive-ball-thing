// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Camera } from "../camera";
import type { Point } from "../geometry/point";
import { Playground } from "../world/playground";
import { Input } from "./input";
import type { DownResult, Tool } from "./tool";

// A tool that notes what it's told.
class RecordingTool implements Tool {
  label = "Test";
  icon = "🧪";
  title = "Test";
  cursor = "crosshair";
  hints = { mouse: "", touch: "" };
  popsBubbles = true;
  busy = false;
  calls: string[] = [];

  constructor(private result: DownResult = "drag") {}

  down(p: Point): DownResult {
    this.calls.push(`down ${p.x},${p.y}`);
    return this.result;
  }
  move(p: Point): void {
    this.calls.push(`move ${p.x},${p.y}`);
  }
  up(): void {
    this.calls.push("up");
  }
  cancel(): void {
    this.calls.push("cancel");
  }
  key(key: string): void {
    this.calls.push(`key ${key}`);
  }
}

function setUp(result: DownResult = "drag") {
  const canvas = document.createElement("canvas");
  document.body.append(canvas);
  const playground = new Playground();
  const camera = new Camera();
  // With the camera at home, screen points are world points.
  camera.resize(800, 600);
  const tool = new RecordingTool(result);
  const input = new Input(canvas, playground, camera, tool);
  let actions = 0;
  input.actionEnded.listen(() => actions++);
  return { canvas, playground, camera, tool, input, actions: () => actions };
}

function pointer(
  target: EventTarget,
  type: string,
  id: number,
  x: number,
  y: number,
  { touch = false, button = 0 } = {},
): void {
  target.dispatchEvent(
    new PointerEvent(type, {
      pointerId: id,
      pointerType: touch ? "touch" : "mouse",
      button,
      clientX: x,
      clientY: y,
      bubbles: true,
    }),
  );
}

function key(k: string, init: KeyboardEventInit = {}): void {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: k, ...init }));
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe("input with a mouse", () => {
  it("gives the tool a press, moves and a release, then ends the action", () => {
    const { canvas, tool, actions } = setUp();
    pointer(canvas, "pointerdown", 1, 10, 20);
    pointer(canvas, "pointermove", 1, 30, 40);
    expect(actions()).toBe(0);
    pointer(canvas, "pointerup", 1, 30, 40);
    expect(tool.calls).toEqual(["down 10,20", "move 30,40", "up"]);
    expect(actions()).toBe(1);
  });

  it("ends the action straight away for a tool that just taps", () => {
    const { canvas, tool, actions } = setUp("none");
    pointer(canvas, "pointerdown", 1, 10, 20);
    expect(tool.calls).toEqual(["down 10,20"]);
    expect(actions()).toBe(1);
  });

  it("pans with the middle button or Space, whatever the tool", () => {
    const { canvas, camera, tool } = setUp();
    pointer(canvas, "pointerdown", 1, 100, 100, { button: 1 });
    pointer(canvas, "pointermove", 1, 150, 100);
    pointer(canvas, "pointerup", 1, 150, 100);
    expect(camera.x).toBe(400 - 50);

    key(" ");
    pointer(canvas, "pointerdown", 1, 100, 100);
    pointer(canvas, "pointermove", 1, 100, 160);
    pointer(canvas, "pointerup", 1, 100, 160);
    expect(camera.y).toBe(300 - 60);
    expect(tool.calls).toEqual([]);
  });

  it("pops a bubble instead of using a tool that pops them", () => {
    const { canvas, playground, tool } = setUp();
    playground.addBubble(200, 200);
    pointer(canvas, "pointerdown", 1, 200, 200);
    expect(playground.bubbles).toHaveLength(0);
    expect(tool.calls).toEqual([]);
  });

  it("pans with the wheel, and zooms with Ctrl", () => {
    const { canvas, camera } = setUp();
    canvas.dispatchEvent(
      new WheelEvent("wheel", { deltaX: 20, deltaY: 30, cancelable: true }),
    );
    expect([camera.x, camera.y]).toEqual([420, 330]);
    const zoom = new WheelEvent("wheel", { deltaY: -50, cancelable: true });
    Object.defineProperty(zoom, "ctrlKey", { value: true });
    canvas.dispatchEvent(zoom);
    expect(camera.zoom).toBeGreaterThan(1);
  });
});

describe("input with fingers", () => {
  it("holds a finger back for a moment, in case a second follows", () => {
    const { canvas, tool } = setUp();
    pointer(canvas, "pointerdown", 1, 10, 20, { touch: true });
    vi.advanceTimersByTime(50);
    expect(tool.calls).toEqual([]);
    vi.advanceTimersByTime(60);
    expect(tool.calls).toEqual(["down 10,20"]);
  });

  it("hands over a finger that moves off straight away, with its moves", () => {
    const { canvas, tool } = setUp();
    pointer(canvas, "pointerdown", 1, 10, 20, { touch: true });
    pointer(canvas, "pointermove", 1, 15, 20, { touch: true });
    pointer(canvas, "pointermove", 1, 40, 20, { touch: true });
    expect(tool.calls).toEqual(["down 10,20", "move 15,20", "move 40,20"]);
  });

  it("gives a quick tap to the tool as a press and a release", () => {
    const { canvas, tool, actions } = setUp();
    pointer(canvas, "pointerdown", 1, 10, 20, { touch: true });
    pointer(canvas, "pointerup", 1, 10, 20, { touch: true });
    expect(tool.calls).toEqual(["down 10,20", "up"]);
    expect(actions()).toBe(1);
  });

  it("zooms with two fingers, without the tool seeing either", () => {
    const { canvas, camera, tool } = setUp();
    pointer(canvas, "pointerdown", 1, 300, 300, { touch: true });
    pointer(canvas, "pointerdown", 2, 500, 300, { touch: true });
    pointer(canvas, "pointermove", 2, 700, 300, { touch: true });
    expect(camera.zoom).toBeCloseTo(2);
    // The finger left behind doesn't start drawing.
    pointer(canvas, "pointerup", 2, 700, 300, { touch: true });
    pointer(canvas, "pointermove", 1, 350, 350, { touch: true });
    vi.advanceTimersByTime(200);
    expect(tool.calls).toEqual([]);
  });

  it("throws away a stroke when a second finger joins", () => {
    const { canvas, tool, actions } = setUp();
    pointer(canvas, "pointerdown", 1, 10, 20, { touch: true });
    pointer(canvas, "pointermove", 1, 60, 20, { touch: true });
    pointer(canvas, "pointerdown", 2, 300, 300, { touch: true });
    expect(tool.calls.at(-1)).toBe("cancel");
    expect(tool.calls).not.toContain("up");
    expect(actions()).toBe(1);
  });
});

describe("input from the keyboard", () => {
  it("runs shortcuts instead of passing them to the tool", () => {
    const { input, tool } = setUp();
    const ran: string[] = [];
    input.addShortcut({ key: "z", run: () => ran.push("undo") });
    input.addShortcut({ key: "z", shift: true, run: () => ran.push("redo") });
    key("z", { ctrlKey: true });
    key("Z", { metaKey: true, shiftKey: true });
    key("x", { ctrlKey: true }); // not a shortcut, and not for the tool
    expect(ran).toEqual(["undo", "redo"]);
    expect(tool.calls).toEqual([]);
  });

  it("passes other keys to the tool, then ends the action", () => {
    const { tool, actions } = setUp();
    key("Escape");
    expect(tool.calls).toEqual(["key Escape"]);
    expect(actions()).toBe(1);
  });
});
