import { describe, expect, it, vi } from "vitest";
import { UndoHistory } from "./history";
import { Playground } from "./world/playground";

function line(y: number) {
  return [
    { x: 0, y },
    { x: 400, y },
  ];
}

describe("undo history", () => {
  it("steps back and forward through changes to the design", () => {
    const pg = new Playground();
    const history = new UndoHistory(pg);
    expect(history.canUndo).toBe(false);

    pg.lines.add(line(500));
    history.checkpoint();
    pg.cups.add(200, 400);
    pg.boosts.add(line(490)); // two changes in one action are one step
    history.checkpoint();

    history.undo();
    expect(pg.lines.all).toHaveLength(1);
    expect(pg.cups.all).toHaveLength(0);
    expect(pg.boosts.all).toHaveLength(0);
    history.undo();
    expect(pg.lines.all).toHaveLength(0);
    expect(history.canUndo).toBe(false);
    history.undo(); // nothing left: no change
    expect(pg.lines.all).toHaveLength(0);

    history.redo();
    history.redo();
    expect(pg.lines.all).toHaveLength(1);
    expect(pg.cups.all).toHaveLength(1);
    expect(history.canRedo).toBe(false);
  });

  it("only makes a step when the design changed", () => {
    const pg = new Playground();
    const history = new UndoHistory(pg);
    pg.addBall(100, 100);
    history.checkpoint();
    expect(history.canUndo).toBe(false);

    pg.lines.add(line(500));
    history.checkpoint();
    history.undo();
    history.redo();
    // Putting a design back isn't itself a change.
    history.checkpoint();
    history.undo();
    expect(pg.lines.all).toHaveLength(0);
    expect(history.canUndo).toBe(false);
  });

  it("forgets what was undone once something new is done", () => {
    const pg = new Playground();
    const history = new UndoHistory(pg);
    pg.lines.add(line(500));
    history.checkpoint();
    history.undo();
    pg.cups.add(100, 100);
    history.checkpoint();
    expect(history.canRedo).toBe(false);
    history.redo();
    expect(pg.lines.all).toHaveLength(0);
  });

  it("takes back a change that hasn't been checkpointed yet", () => {
    const pg = new Playground();
    const history = new UndoHistory(pg);
    pg.lines.add(line(500));
    history.undo();
    expect(pg.lines.all).toHaveLength(0);
  });

  it("leaves balls and bubbles alone, and cups keep their count", () => {
    const pg = new Playground();
    const history = new UndoHistory(pg);
    const cup = pg.cups.add(200, 400.04);
    cup.caught = 3;
    history.checkpoint();
    const ball = pg.addBall(100, 100);
    pg.addBubble(150, 150);
    pg.lines.add(line(500));
    history.checkpoint();

    history.undo();
    expect(pg.lines.all).toHaveLength(0);
    expect(pg.balls).toEqual([ball]);
    expect(pg.bubbles).toHaveLength(1);
    expect(pg.cups.all[0].caught).toBe(3);
  });

  it("goes back 50 steps at most", () => {
    const pg = new Playground();
    const history = new UndoHistory(pg);
    for (let i = 0; i < 60; i++) {
      pg.cups.add(i * 100, 0);
      history.checkpoint();
    }
    while (history.canUndo) history.undo();
    expect(pg.cups.all).toHaveLength(10);
  });

  it("takes back moving something", () => {
    const pg = new Playground();
    pg.cups.add(200, 300);
    const history = new UndoHistory(pg);
    pg.grabAt(200, 300)!.moveTo(600, 300);
    pg.cups.all[0].caught = 2;
    history.checkpoint();
    history.undo();
    expect(pg.cups.all[0]).toMatchObject({ x: 200, y: 300, caught: 2 });
  });

  it("doesn't look at the design when nothing has changed", () => {
    const pg = new Playground();
    pg.lines.add(line(500));
    const history = new UndoHistory(pg);
    const layout = vi.spyOn(pg, "layout");
    pg.addBall(100, 100); // not part of the design
    history.checkpoint();
    history.checkpoint();
    expect(layout).not.toHaveBeenCalled();
    pg.cups.add(100, 100);
    history.checkpoint();
    expect(layout).toHaveBeenCalledTimes(1);
  });
});
