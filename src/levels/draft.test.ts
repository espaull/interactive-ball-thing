import { describe, expect, it } from "vitest";
import { emptyLayout, type Layout } from "../world/layout";
import { LevelDraft, NEW_LEVEL_LIMITS } from "./draft";
import { fitsLimits } from "./level";

// The level's own pieces.
const pieces: Layout = {
  ...emptyLayout(),
  lines: [
    [
      { x: 0, y: 100 },
      { x: 200, y: 100 },
    ],
  ],
};
// What the player placed to win: 300px of ink and a portal pair.
const solution: Layout = {
  ...emptyLayout(),
  lines: [
    [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
    ],
  ],
  portals: [
    {
      a: { x: 0, y: 0, aim: null },
      b: { x: 50, y: 0, aim: null },
      color: "purple",
    },
  ],
};

function ready(): LevelDraft {
  const draft = new LevelDraft();
  draft.load(null);
  draft.update({ id: "test", name: "Test" });
  draft.setStart({ x: 10, y: 20 });
  draft.setGoal({ x: 300, y: 200 });
  return draft;
}

function won(): LevelDraft {
  const draft = ready();
  draft.won(draft.level(pieces)!, solution, 0);
  return draft;
}

describe("a level draft", () => {
  it("starts with plenty to place, and says what it still needs", () => {
    const draft = new LevelDraft();
    draft.load(null);
    expect(draft.limits).toEqual(NEW_LEVEL_LIMITS);
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
    expect(draft.solution(pieces)).toEqual(solution);
  });

  it("needs winning again after a change to how it plays", () => {
    const renamed = won();
    renamed.update({ id: "other", name: "Other", tip: "Tip" });
    expect(renamed.needs(pieces)).toEqual([]);

    const moved = won();
    moved.setGoal({ x: 310, y: 200 });
    expect(moved.solution(pieces)).toBeNull();

    const sledge = won();
    sledge.update({ rider: "sledge" });
    expect(sledge.solution(pieces)).toBeNull();

    // Nor with different pieces.
    expect(won().solution(emptyLayout())).toBeNull();
  });

  it("stays won when the limits change, while the win still fits", () => {
    const draft = won();
    draft.update({ limits: { ink: 400, portals: 2 } });
    expect(draft.solution(pieces)).not.toBeNull();
    // Too little ink for it now.
    draft.update({ limits: { ink: 200, portals: 1 } });
    expect(draft.solution(pieces)).toBeNull();
    // Back up, and it's won again.
    draft.update({ limits: { ink: 300, portals: 1 } });
    expect(draft.solution(pieces)).not.toBeNull();
  });

  it("limits a level to what its win used, with a little spare", () => {
    const draft = won();
    draft.limitToWin(pieces);
    // 300px of ink, plus 15%, rounded up to 10; one portal; no boost.
    expect(draft.limits).toEqual({ ink: 350, portals: 1 });
    expect(draft.needs(pieces)).toEqual([]);
  });

  it("isn't ready if it wins without placing anything", () => {
    const draft = ready();
    draft.won(draft.level(pieces)!, emptyLayout(), 0);
    expect(draft.needs(pieces)).toEqual([
      "something to do: it wins without placing anything",
    ]);
  });

  it("adds hearts up to three, and takes one away when it's tapped", () => {
    const draft = ready();
    for (const x of [100, 200, 300, 400]) draft.toggleHeart({ x, y: 0 });
    expect(draft.hearts.map((h) => h.x)).toEqual([100, 200, 300]);
    draft.toggleHeart({ x: 205, y: 10 });
    expect(draft.hearts.map((h) => h.x)).toEqual([100, 300]);
  });

  it("starts from a saved level, still solved", () => {
    const draft = won();
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

describe("fitting within limits", () => {
  it("counts ink, boost and portals, and allows nothing else", () => {
    expect(fitsLimits(solution, { ink: 300, portals: 1 })).toBe(true);
    expect(fitsLimits(solution, { ink: 290, portals: 1 })).toBe(false);
    expect(fitsLimits(solution, { ink: 300 })).toBe(false);
    const withCup = { ...emptyLayout(), cups: [{ x: 0, y: 0 }] };
    expect(fitsLimits(withCup, NEW_LEVEL_LIMITS)).toBe(false);
  });
});
