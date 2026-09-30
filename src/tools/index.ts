import type { Camera } from "../camera";
import type { LevelDraft } from "../levels/draft";
import type { Budget } from "../world/budget";
import type { Playground } from "../world/playground";
import { BoostTool } from "./boost";
import { CannonTool } from "./cannon";
import { CupTool } from "./cup";
import { CurveTool } from "./curve";
import { GoalTool, HeartTool, StartTool } from "./editor";
import { EraserTool } from "./eraser";
import { MoveTool } from "./move";
import { PencilTool } from "./pencil";
import { PortalTool } from "./portal";
import { BallTool, BubbleTool, SledgeTool } from "./spawn";
import { NoDrawTool, RockTool, SpikesTool } from "./terrain";
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
  budget: Budget,
  // The level being made, for the editor's tools.
  draft: LevelDraft,
): Tool[][] {
  const ctx: ToolContext = {
    playground,
    camera,
    budget,
    findSnap: (p, except) =>
      playground.lines.endAt(p.x, p.y, SNAP_RADIUS_PX / camera.zoom, except),
  };
  return [
    [new PencilTool(ctx), new CurveTool(ctx)],
    [new EraserTool(ctx)],
    [new BoostTool(ctx), new PortalTool(ctx), new CupTool(ctx)],
    [new MoveTool(ctx)],
    [
      new BallTool(ctx),
      new SledgeTool(ctx),
      new BubbleTool(ctx),
      new CannonTool(ctx),
    ],
    [new RockTool(ctx), new SpikesTool(ctx), new NoDrawTool(ctx)],
    [new StartTool(draft), new GoalTool(draft), new HeartTool(draft)],
  ];
}
