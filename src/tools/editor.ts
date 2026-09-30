// The level editor's tools (only offered while editing a level): placing
// the rider's start, the goal cup and the hearts.
import type { Point } from "../geometry/point";
import type { LevelDraft } from "../levels/draft";
import type { DownResult, Tool } from "./tool";

export class StartTool implements Tool {
  label = "Start";
  icon = "🚩";
  title = "Where the rider starts";
  cursor = "crosshair";
  hints = {
    mouse: "Click where the rider waits for Go (choose ball or sledge below)",
    touch: "Tap where the rider waits for Go",
  };
  popsBubbles = false;
  editorOnly = true;
  busy = false;

  constructor(private draft: LevelDraft) {}

  down(p: Point): DownResult {
    this.draft.setStart(p);
    return "none";
  }
}

export class GoalTool implements Tool {
  label = "Goal";
  icon = "🥅";
  title = "Where the goal cup is";
  cursor = "crosshair";
  hints = {
    mouse: "Click where the goal cup goes",
    touch: "Tap where the goal cup goes",
  };
  popsBubbles = false;
  editorOnly = true;
  busy = false;

  constructor(private draft: LevelDraft) {}

  down(p: Point): DownResult {
    this.draft.setGoal(p);
    return "none";
  }
}

export class HeartTool implements Tool {
  label = "Heart";
  icon = "❤️";
  title = "Hearts to collect";
  cursor = "crosshair";
  hints = {
    mouse: "Click to add a heart (up to three) · click one to take it away",
    touch: "Tap to add a heart (up to three) · tap one to take it away",
  };
  popsBubbles = false;
  editorOnly = true;
  busy = false;

  constructor(private draft: LevelDraft) {}

  down(p: Point): DownResult {
    this.draft.toggleHeart(p);
    return "none";
  }
}
