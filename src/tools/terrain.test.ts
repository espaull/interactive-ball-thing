import { describe, expect, it } from "vitest";
import { isInside } from "../geometry/outline";
import type { Point } from "../geometry/point";
import { LevelPlay } from "../levels/play";
import { fitsLimits } from "../levels/level";
import { Budget } from "../world/budget";
import { emptyLayout } from "../world/layout";
import { Playground } from "../world/playground";
import { RockTool } from "./terrain";
import type { Tool, ToolContext } from "./tool";

function setUp() {
  const playground = new Playground();
  const budget = new Budget(playground);
  const ctx = {
    playground,
    camera: { zoom: 1 },
    budget,
    findSnap: () => null,
  } as unknown as ToolContext;
  return { playground, budget, ctx };
}

// Drag through the points, then let go.
function drag(tool: Tool, points: Point[]): void {
  tool.down(points[0]);
  for (const p of points.slice(1)) tool.move?.(p);
  tool.up?.();
}

// Round a circle, a point every 5 degrees.
function circle(x: number, y: number, radius: number): Point[] {
  const points: Point[] = [];
  for (let a = 0; a <= 360; a += 5) {
    const r = (a * Math.PI) / 180;
    points.push({ x: x + Math.cos(r) * radius, y: y + Math.sin(r) * radius });
  }
  return points;
}

describe("the rock tool", () => {
  it("makes a rock of what's drawn round", () => {
    const { playground, ctx } = setUp();
    drag(new RockTool(ctx), circle(200, 200, 60));
    const [rock] = playground.rocks.all;
    expect(isInside({ x: 200, y: 200 }, rock.outline)).toBe(true);
    expect(isInside({ x: 270, y: 200 }, rock.outline)).toBe(false);
  });

  it("puts down a boulder with a tap", () => {
    const { playground, ctx } = setUp();
    const tool = new RockTool(ctx);
    tool.down({ x: 100, y: 100 });
    tool.up();
    const [rock] = playground.rocks.all;
    expect(isInside({ x: 100, y: 100 }, rock.outline)).toBe(true);
  });

  it("makes nothing of a stroke that isn't a shape", () => {
    const { playground, ctx } = setUp();
    drag(
      new RockTool(ctx),
      [0, 10, 20, 30, 40, 50].map((x) => ({ x, y: 0 })),
    );
    expect(playground.rocks.all).toHaveLength(0);
  });

  it("is in the editor only, and a level never lets the player use it", () => {
    const { playground, budget, ctx } = setUp();
    expect(new RockTool(ctx).editorOnly).toBe(true);
    expect(budget.allows("terrain")).toBe(true);
    new LevelPlay(playground, budget).start({
      id: "a",
      name: "A",
      tip: "",
      rider: "ball",
      start: { x: 0, y: 0 },
      goal: { x: 100, y: 100 },
      hearts: [],
      limits: { ink: 100 },
      pieces: emptyLayout(),
      solution: null,
    });
    expect(budget.allows("terrain")).toBe(false);
    expect(new RockTool(ctx).down({ x: 0, y: 0 })).toBe("none");
  });

  it("makes pieces a level's solution can't have", () => {
    const rocks = [circle(0, 0, 50)];
    expect(fitsLimits({ ...emptyLayout(), rocks }, { ink: 100 })).toBe(false);
  });
});
