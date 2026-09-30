// The things the app is made of, handed to each part of the UI as one.
import type { Camera } from "./camera";
import type { Guides } from "./guides";
import type { UndoHistory } from "./history";
import type { LevelPlay } from "./levels/play";
import type { Background } from "./render/backgrounds";
import type { Effects } from "./render/effects";
import type { Autosave, SaveStore } from "./saves";
import type { Input } from "./tools/input";
import type { Toolbar } from "./ui/toolbar";
import type { Playground } from "./world/playground";

export interface App {
  canvas: HTMLCanvasElement;
  playground: Playground;
  camera: Camera;
  input: Input;
  effects: Effects;
  history: UndoHistory;
  saves: SaveStore;
  autosave: Autosave;
  toolbar: Toolbar;
  guides: Guides;
  // The level being played, if any.
  levels: LevelPlay;
  // The background picked (it can change).
  background: { current: Background };
}
