import { describe, expect, it } from "vitest";
import { Budget } from "../world/budget";
import { Playground } from "../world/playground";
import { LEVELS } from "./levels";
import { LevelPlay } from "./play";
import { applySolution, SOLUTIONS } from "./solutions";

const STEP = 1 / 60;

// Play a level (with the player's pieces, if any) until it's won or the
// rider's lost. Returns how it went.
function play(levelIndex: number, solved: boolean) {
  const level = LEVELS[levelIndex];
  const playground = new Playground();
  const budget = new Budget(playground);
  const play = new LevelPlay(playground, budget);
  let result: { won: boolean; hearts: number } | null = null;
  play.onWin = (hearts) => (result = { won: true, hearts });
  play.onLost = () => (result ??= { won: false, hearts: 0 });
  play.start(level);
  if (solved) applySolution(playground, SOLUTIONS[level.id]);
  const left = {
    ink: budget.left("ink"),
    boost: budget.left("boost"),
    portals: budget.left("portals"),
  };
  play.go();
  for (let t = 0; t < 30 && !result; t += STEP) {
    play.update();
    playground.step(STEP);
    if (!playground.paused) play.afterStep(STEP);
  }
  return { result, left };
}

describe("the levels", () => {
  it("each have their own id and at most three hearts", () => {
    const ids = new Set(LEVELS.map((level) => level.id));
    expect(ids.size).toBe(LEVELS.length);
    for (const level of LEVELS) {
      expect(level.hearts.length).toBeLessThanOrEqual(3);
    }
  });

  LEVELS.forEach((level, i) => {
    describe(level.name, () => {
      it("can be finished with every heart, within its limits", () => {
        const { result, left } = play(i, true);
        expect(result).toEqual({ won: true, hearts: level.hearts.length });
        // What the solution placed fits (to within a pixel or two, as
        // joins get smoothed).
        expect(left.ink).toBeGreaterThan(-2);
        expect(left.boost).toBeGreaterThan(-2);
        expect(left.portals).toBeGreaterThanOrEqual(0);
      });

      it("isn't finished by just pressing Go", () => {
        expect(play(i, false).result).toMatchObject({ won: false });
      });
    });
  });
});
