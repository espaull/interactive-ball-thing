import { describe, expect, it } from "vitest";
import { emptyLayout, type Layout } from "../world/layout";
import { LevelDraft } from "./draft";

const pieces: Layout = {
  ...emptyLayout(),
  lines: [
    [
      { x: 0, y: 100 },
      { x: 200, y: 100 },
    ],
  ],
};
const solution: Layout = { ...emptyLayout(), cups: [{ x: 9, y: 9 }] };

describe("a level that wins by itself", () => {
  it("isn't ready: there's nothing to do", () => {
    const draft = new LevelDraft();
    draft.update({ id: "test" });
    draft.setStart({ x: 10, y: 20 });
    draft.setGoal({ x: 300, y: 200 });
    draft.won(draft.level(emptyLayout())!, emptyLayout(), 0);
    expect(draft.needs(emptyLayout())).toEqual([
      "something to do: it wins without placing anything",
    ]);
  });
});

function ready(): LevelDraft {
  const draft = new LevelDraft();
  draft.update({ id: "test", name: "Test" });
  draft.setStart({ x: 10, y: 20 });
  draft.setGoal({ x: 300, y: 200 });
  return draft;
}

describe("a level draft", () => {
  it("says what it still needs", () => {
    const draft = new LevelDraft();
    expect(draft.needs(pieces)).toEqual([
      "an id, like my-level",
      "a start",
      "a goal",
    ]);
    expect(draft.level(pieces)).toBeNull();
    draft.update({ id: "test" });
    draft.setStart({ x: 10, y: 20 });
    draft.setGoal({ x: 300, y: 200 });
    expect(draft.needs(pieces)).toEqual(["a win (Try it)"]);
  });

  it("keeps a win with every heart as its solution", () => {
    const draft = ready();
    draft.toggleHeart({ x: 100, y: 50 });
    const level = draft.level(pieces)!;
    // Missing a heart doesn't count.
    draft.won(level, solution, 0);
    expect(draft.needs(pieces)).toEqual(["a win with every heart (Try it)"]);
    draft.won(level, solution, 1);
    expect(draft.needs(pieces)).toEqual([]);
    expect(draft.level(pieces)!.solution).toEqual(solution);
  });

  it("needs winning again after a change to how it plays", () => {
    const won = () => {
      const draft = ready();
      draft.won(draft.level(pieces)!, solution, 0);
      return draft;
    };
    // Renaming doesn't matter.
    const renamed = won();
    renamed.update({ id: "other", name: "Other", tip: "Tip" });
    expect(renamed.needs(pieces)).toEqual([]);

    const moved = won();
    moved.setGoal({ x: 310, y: 200 });
    expect(moved.level(pieces)!.solution).toBeNull();

    const limited = won();
    limited.update({ limits: { ink: 100 } });
    expect(limited.level(pieces)!.solution).toBeNull();

    // Nor with different pieces.
    expect(won().level(emptyLayout())!.solution).toBeNull();
  });

  it("adds hearts up to three, and takes one away when it's tapped", () => {
    const draft = ready();
    for (const x of [100, 200, 300, 400]) draft.toggleHeart({ x, y: 0 });
    expect(draft.hearts.map((h) => h.x)).toEqual([100, 200, 300]);
    draft.toggleHeart({ x: 205, y: 10 });
    expect(draft.hearts.map((h) => h.x)).toEqual([100, 300]);
  });

  it("starts from a saved level, still solved", () => {
    const draft = ready();
    draft.won(draft.level(pieces)!, solution, 0);
    const again = new LevelDraft();
    again.load(draft.level(pieces)!);
    expect(again.needs(pieces)).toEqual([]);
    expect(again.level(pieces)).toEqual(draft.level(pieces));
  });

  it("starts afresh from nothing", () => {
    const draft = ready();
    draft.toggleHeart({ x: 1, y: 1 });
    draft.load(null);
    expect(draft.hearts).toEqual([]);
    expect(draft.needs(pieces)).toHaveLength(3);
  });
});
