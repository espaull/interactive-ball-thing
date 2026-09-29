// The things the app is made of, handed to each part of the UI as one.
import type { Camera } from "./camera";
import type { UndoHistory } from "./history";
import type { Background } from "./render/backgrounds";
import type { Effects } from "./render/effects";
import type { SaveStore } from "./saves";
import type { Input } from "./tools/input";
import type { Playground } from "./world/playground";

export interface App {
  canvas: HTMLCanvasElement;
  playground: Playground;
  camera: Camera;
  input: Input;
  effects: Effects;
  history: UndoHistory;
  saves: SaveStore;
  // The background picked (it can change).
  background: { current: Background };
}
