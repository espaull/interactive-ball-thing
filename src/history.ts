// Undo and redo for the playground's design. After each action (a stroke, a
// tap, Clear, loading a save), `checkpoint` notes the design if it changed,
// and Undo puts the one before back. Balls and bubbles are left alone.
import type { Layout } from "./world/layout";
import type { Playground } from "./world/playground";

// How many steps back Undo can go.
const MAX_STEPS = 50;

export class UndoHistory {
  // Earlier designs (as JSON), oldest first, and ones undone.
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  // The design as of the last checkpoint.
  private current: string;
  // Called whenever what can be undone or redone changes.
  onChange: () => void = () => {};

  constructor(private playground: Playground) {
    this.current = this.snapshot();
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
    const now = this.snapshot();
    if (now === this.current) return;
    this.undoStack.push(this.current);
    if (this.undoStack.length > MAX_STEPS) this.undoStack.shift();
    this.redoStack = [];
    this.current = now;
    this.onChange();
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
    this.onChange();
  }

  private snapshot(): string {
    return JSON.stringify(this.playground.layout());
  }
}
