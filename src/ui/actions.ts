// The Pause, Follow, Home, Undo and Clear buttons, and their shortcuts.
import type { App } from "../app";
import { labelled } from "./toolbar";

export function setupActions({
  camera,
  playground,
  input,
  effects,
  history,
  levels,
}: App): void {
  // Pause stops everything moving, to build around a ball mid-flight. The
  // button turns into Play (and lights up) while paused.
  const pauseButton = document.querySelector<HTMLButtonElement>("#pause")!;
  const updatePause = () => {
    const { paused } = playground;
    pauseButton.replaceChildren(
      paused ? "▶️" : "⏸️",
      labelled(paused ? "Play" : "Pause"),
    );
    pauseButton.title = paused ? "Play (P)" : "Pause (P)";
    pauseButton.classList.toggle("active", paused);
  };
  // (A level uses Go instead: the rider waits, paused, until then.)
  const togglePause = () => {
    if (!levels.level) playground.setPaused(!playground.paused);
  };
  pauseButton.addEventListener("click", togglePause);
  input.addShortcut({ key: "p", run: togglePause });
  playground.pausedChanged.listen(updatePause);
  updatePause();

  const followButton = document.querySelector<HTMLButtonElement>("#follow")!;
  camera.onFollowChange = (following) =>
    followButton.classList.toggle("active", following);
  followButton.addEventListener("click", () => {
    // Turning Follow on picks up the most recent ball (or bubble if there are none).
    const latest = playground.balls.at(-1) ?? playground.bubbles.at(-1) ?? null;
    camera.setFollowing(!camera.following, latest);
  });

  document
    .querySelector("#home")!
    .addEventListener("click", () => camera.home());

  // Undo takes a step back through anything half-done first (like a curve's
  // points), then through the changes to the design.
  const undoButton = document.querySelector<HTMLButtonElement>("#undo")!;
  const updateUndo = () =>
    (undoButton.disabled = !input.canUndoStep && !history.canUndo);
  const undo = () => {
    if (input.canUndoStep) input.undoStep();
    else history.undo();
    updateUndo();
  };
  undoButton.addEventListener("click", undo);
  input.actionEnded.listen(() => {
    history.checkpoint();
    updateUndo();
  });
  history.changed.listen(updateUndo);
  updateUndo();
  // Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z or Ctrl+Y redoes.
  const redo = () => history.redo();
  input.addShortcut({ key: "z", ctrl: true, run: undo });
  input.addShortcut({ key: "z", ctrl: true, shift: true, run: redo });
  input.addShortcut({ key: "y", ctrl: true, run: redo });

  // Clearing is a step Undo can take back (the design, not the balls).
  document.querySelector("#clear")!.addEventListener("click", () => {
    input.cancel();
    playground.clear();
    effects.clear();
    camera.home();
    history.checkpoint();
  });
}
