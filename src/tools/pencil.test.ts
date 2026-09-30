import { describe, expect, it } from "vitest";
import { polylineLength } from "../geometry/point";
import { Budget, NO_LIMITS } from "../world/budget";
import { Playground } from "../world/playground";
import { BoostTool } from "./boost";
import { PencilTool } from "./pencil";
import type { ToolContext } from "./tool";

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

// Drag along a straight line from x = 0 to `to`, in 5px steps.
function drag(tool: PencilTool | BoostTool, to: number): void {
  tool.down({ x: 0, y: 100 });
  for (let x = 5; x <= to; x += 5) tool.move({ x, y: 100 });
  tool.up();
}

describe("drawing with limited ink", () => {
  it("ends the line where the ink runs out", () => {
    const { playground, budget, ctx } = setUp();
    budget.limits = { ...NO_LIMITS, ink: 200 };
    drag(new PencilTool(ctx), 500);
    const [line] = playground.lines.all;
    expect(polylineLength(line.points)).toBeCloseTo(200, -1);
    expect(budget.left("ink")).toBeLessThan(5);
  });

  it("draws nothing once it's all used, until some's rubbed out", () => {
    const { playground, budget, ctx } = setUp();
    budget.limits = { ...NO_LIMITS, ink: 200 };
    const pencil = new PencilTool(ctx);
    drag(pencil, 500);
    expect(pencil.down({ x: 0, y: 300 })).toBe("none");
    playground.eraseAt(100, 100, 30);
    drag(pencil, 500);
    expect(playground.lines.all).toHaveLength(3);
  });

  it("limits boost strips the same way", () => {
    const { playground, budget, ctx } = setUp();
    budget.limits = { ...NO_LIMITS, boost: 150 };
    drag(new BoostTool(ctx), 500);
    const [boost] = playground.boosts.all;
    expect(polylineLength(boost.points)).toBeCloseTo(150, -1);
  });
});
