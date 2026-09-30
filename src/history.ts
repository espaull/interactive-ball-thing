// Undo and redo for the playground's design. After each action (a stroke, a
// tap, Clear, loading a save), `checkpoint` notes the design if it changed,
// and Undo puts the one before back. Balls and bubbles are left alone.
import { Signal } from "./signal";
import type { Layout } from "./world/layout";
import type { Playground } from "./world/playground";

// How many steps back Undo can go.
const MAX_STEPS = 50;

export class UndoHistory {
  // Earlier designs (as JSON), oldest first, and ones undone.
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  // The design as of the last checkpoint, and the playground's revision
  // then (if that hasn't moved, nothing's changed and there's no need to
  // look).
  private current: string;
  private seen: number;
  // Whenever what can be undone or redone changes.
  readonly changed = new Signal();

  constructor(private playground: Playground) {
    this.current = this.snapshot();
    this.seen = playground.revision;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  // Call when an action has finished: if the design changed, that's a step
  // Undo can take back.
  checkpoint(): void {
    if (this.playground.revision === this.seen) return;
    this.seen = this.playground.revision;
    // It may have changed and changed back (like a cannon paused and
    // restarted), which isn't a step.
    const now = this.snapshot();
    if (now === this.current) return;
    this.undoStack.push(this.current);
    if (this.undoStack.length > MAX_STEPS) this.undoStack.shift();
    this.redoStack = [];
    this.current = now;
    this.changed.emit();
  }

  // Start afresh from the design as it is now, with nothing to undo or
  // redo (after switching between free play and a level).
  reset(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.current = this.snapshot();
    this.seen = this.playground.revision;
    this.changed.emit();
  }

  undo(): void {
    this.checkpoint();
    const previous = this.undoStack.pop();
    if (previous === undefined) return;
    this.redoStack.push(this.current);
    this.restore(previous);
  }

  redo(): void {
    this.checkpoint();
    const next = this.redoStack.pop();
    if (next === undefined) return;
    this.undoStack.push(this.current);
    this.restore(next);
  }

  private restore(json: string): void {
    this.playground.restoreLayout(JSON.parse(json) as Layout);
    this.current = json;
    this.seen = this.playground.revision;
    this.changed.emit();
  }

  private snapshot(): string {
    return JSON.stringify(this.playground.layout());
  }
}
