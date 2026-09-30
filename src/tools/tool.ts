import type { Camera } from "../camera";
import type { Budget, Supply } from "../world/budget";
import type { Line, LineEnd, Playground, PortalEnd } from "../world/playground";
import type { Point } from "../geometry/point";

// Everything drawn on top of the world to show what the tools are doing.
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
  // The boost strip being painted.
  boostPreview: Point[] | null;
  // The first portal of a pair, waiting for its partner.
  portalPending: { end: PortalEnd; color: string } | null;
  // Where a cannon being aimed will send its balls.
  trajectory: Point[] | null;
}

// What the tools share.
export interface ToolContext {
  playground: Playground;
  camera: Camera;
  // How much a level lets the player place (no limit in free play).
  budget: Budget;
  // The end of a line (other than `except`) close enough to `p` to join onto.
  findSnap(p: Point, except?: Line): LineEnd | null;
}

// What a press on the canvas starts: a drag the tool handles itself, panning
// the view, or nothing more.
export type DownResult = "drag" | "pan" | "none";

// One toolbar tool. Points are in world pixels. `Input` handles the shared
// plumbing (pointer capture, panning, zooming, keys, popping bubbles) and
// passes the rest on to the selected tool.
export interface Tool {
  // Toolbar button.
  label: string;
  icon: string;
  title: string;
  cursor: string;
  // Shown at the bottom of the screen while the tool is selected.
  hints: { mouse: string; touch: string };
  // What placing things with it uses up, for a level's limits. The toolbar
  // only offers it if the level allows some, and shows how much is left.
  // Tools without one (like the eraser) are always offered.
  supply?: Supply;
  // Only offered in the level editor.
  editorOnly?: boolean;
  // How much of its supply what's being drawn right now uses, so the
  // toolbar can show it running down.
  readonly using?: number;
  // Tapping a bubble with this tool pops it instead of using the tool.
  popsBubbles: boolean;
  // True while the tool is part-way through something, so the camera holds still.
  readonly busy: boolean;

  down(p: Point): DownResult;
  // While dragging (after `down` returned "drag").
  move?(p: Point): void;
  up?(): void;
  key?(key: string): void;
  // Switching to another tool: finish off anything half-done.
  deactivate?(): void;
  // Throw away anything half-done (used by Clear).
  cancel?(): void;
  // Whether there's something half-done that Undo should step back through
  // first (like a curve's points), and taking that step.
  readonly canUndoStep?: boolean;
  undoStep?(): void;
  // `hover` is where the pointer is (null when it's off the canvas or panning).
  overlay?(hover: Point | null): Partial<Overlay>;
}
