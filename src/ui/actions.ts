// The Follow, Home, Undo and Clear buttons, and the Undo shortcuts.
import type { App } from "../app";

export function setupActions({
  camera,
  playground,
  input,
  effects,
  history,
}: App): void {
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
  input.addShortcut({ key: "z", run: undo });
  input.addShortcut({ key: "z", shift: true, run: redo });
  input.addShortcut({ key: "y", run: redo });

  // Clearing is a step Undo can take back (the design, not the balls).
  document.querySelector("#clear")!.addEventListener("click", () => {
    input.cancel();
    playground.clear();
    effects.clear();
    camera.home();
    history.checkpoint();
  });
}
