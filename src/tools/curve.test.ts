import { describe, expect, it } from "vitest";
import { Playground } from "../world/playground";
import { CurveTool } from "./curve";
import type { ToolContext } from "./tool";

describe("curve tool", () => {
  it("lets Undo take back its points one at a time", () => {
    const playground = new Playground();
    const ctx = {
      playground,
      camera: { zoom: 1 },
      findSnap: () => null,
    } as unknown as ToolContext;
    const tool = new CurveTool(ctx);
    expect(tool.canUndoStep).toBe(false);
    tool.down({ x: 0, y: 0 });
    tool.down({ x: 100, y: 0 });
    expect(tool.canUndoStep).toBe(true);
    tool.undoStep();
    tool.undoStep();
    // Every point taken back: no curve left to finish.
    expect(tool.canUndoStep).toBe(false);
    tool.key("Enter");
    expect(playground.lines).toHaveLength(0);
  });
});
