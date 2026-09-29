import { describe, expect, it } from "vitest";
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

    pg.addLine(line(500));
    history.checkpoint();
    pg.addCup(200, 400);
    pg.addBoost(line(490)); // two changes in one action are one step
    history.checkpoint();

    history.undo();
    expect(pg.lines).toHaveLength(1);
    expect(pg.cups).toHaveLength(0);
    expect(pg.boosts).toHaveLength(0);
    history.undo();
    expect(pg.lines).toHaveLength(0);
    expect(history.canUndo).toBe(false);
    history.undo(); // nothing left: no change
    expect(pg.lines).toHaveLength(0);

    history.redo();
    history.redo();
    expect(pg.lines).toHaveLength(1);
    expect(pg.cups).toHaveLength(1);
    expect(history.canRedo).toBe(false);
  });

  it("only makes a step when the design changed", () => {
    const pg = new Playground();
    const history = new UndoHistory(pg);
    pg.addBall(100, 100);
    history.checkpoint();
    expect(history.canUndo).toBe(false);

    pg.addLine(line(500));
    history.checkpoint();
    history.undo();
    history.redo();
    // Putting a design back isn't itself a change.
    history.checkpoint();
    history.undo();
    expect(pg.lines).toHaveLength(0);
    expect(history.canUndo).toBe(false);
  });

  it("forgets what was undone once something new is done", () => {
    const pg = new Playground();
    const history = new UndoHistory(pg);
    pg.addLine(line(500));
    history.checkpoint();
    history.undo();
    pg.addCup(100, 100);
    history.checkpoint();
    expect(history.canRedo).toBe(false);
    history.redo();
    expect(pg.lines).toHaveLength(0);
  });

  it("takes back a change that hasn't been checkpointed yet", () => {
    const pg = new Playground();
    const history = new UndoHistory(pg);
    pg.addLine(line(500));
    history.undo();
    expect(pg.lines).toHaveLength(0);
  });

  it("leaves balls and bubbles alone, and cups keep their count", () => {
    const pg = new Playground();
    const history = new UndoHistory(pg);
    const cup = pg.addCup(200, 400.04);
    cup.caught = 3;
    history.checkpoint();
    const ball = pg.addBall(100, 100);
    pg.addBubble(150, 150);
    pg.addLine(line(500));
    history.checkpoint();

    history.undo();
    expect(pg.lines).toHaveLength(0);
    expect(pg.balls).toEqual([ball]);
    expect(pg.bubbles).toHaveLength(1);
    expect(pg.cups[0].caught).toBe(3);
  });

  it("goes back 50 steps at most", () => {
    const pg = new Playground();
    const history = new UndoHistory(pg);
    for (let i = 0; i < 60; i++) {
      pg.addCup(i * 100, 0);
      history.checkpoint();
    }
    while (history.canUndo) history.undo();
    expect(pg.cups).toHaveLength(10);
  });
});
