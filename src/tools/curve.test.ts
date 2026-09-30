import { describe, expect, it } from "vitest";
import { polylineLength } from "../geometry/point";
import { Budget, NO_LIMITS } from "../world/budget";
import { Playground } from "../world/playground";
import { CurveTool } from "./curve";
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
  return { playground, budget, tool: new CurveTool(ctx) };
}

describe("curve tool", () => {
  it("lets Undo take back its points one at a time", () => {
    const { playground, tool } = setUp();
    expect(tool.canUndoStep).toBe(false);
    tool.down({ x: 0, y: 0 });
    tool.down({ x: 100, y: 0 });
    expect(tool.canUndoStep).toBe(true);
    tool.undoStep();
    tool.undoStep();
    // Every point taken back: no curve left to finish.
    expect(tool.canUndoStep).toBe(false);
    tool.key("Enter");
    expect(playground.lines.all).toHaveLength(0);
  });

  it("stops the curve where the ink runs out", () => {
    const { playground, budget, tool } = setUp();
    budget.limits = { ...NO_LIMITS, ink: 250 };
    tool.down({ x: 0, y: 0 });
    tool.down({ x: 100, y: 0 });
    // This point is further than the ink goes, so the curve ends short of
    // it, and finishes.
    tool.down({ x: 400, y: 0 });
    expect(tool.canUndoStep).toBe(false);
    const [line] = playground.lines.all;
    expect(polylineLength(line.points)).toBeCloseTo(250, -1);
    expect(line.points.at(-1)!.x).toBeLessThan(260);
  });
});
