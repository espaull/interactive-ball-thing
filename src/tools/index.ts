import type { Camera } from "../camera";
import type { Playground } from "../world/playground";
import { BoostTool } from "./boost";
import { CurveTool } from "./curve";
import { EraserTool } from "./eraser";
import { MoveTool } from "./move";
import { PencilTool } from "./pencil";
import { BallTool, BubbleTool } from "./spawn";
import type { Tool, ToolContext } from "./tool";

export type { Overlay, Tool } from "./tool";

// Starting or finishing a line within this many screen pixels of another
// line's end joins onto that line.
const SNAP_RADIUS_PX = 20;

// The tools, in toolbar groups. Each group is one toolbar button; a group
// with several tools opens a menu of them. To add a tool, write a class
// implementing `Tool` and add it to a group here.
export function createToolGroups(
  playground: Playground,
  camera: Camera,
): Tool[][] {
  const ctx: ToolContext = {
    playground,
    camera,
    findSnap: (p, except) =>
      playground.lineEndAt(p.x, p.y, SNAP_RADIUS_PX / camera.zoom, except),
  };
  return [
    [new PencilTool(ctx), new CurveTool(ctx)],
    [new EraserTool(ctx)],
    [new BoostTool(ctx)],
    [new MoveTool(ctx)],
    [new BallTool(ctx), new BubbleTool(ctx)],
  ];
}
