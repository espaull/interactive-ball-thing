import { describe, expect, it } from "vitest";
import { Budget } from "../world/budget";
import { Playground } from "../world/playground";
import { LEVELS } from "./levels";
import { LevelPlay } from "./play";
import { isLevelId, MAX_HEARTS, parseLevel } from "./level";

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
  if (solved && level.solution) playground.loadLayout(level.solution);
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
  it("are all there, in order, each with its own id", () => {
    const files = import.meta.glob<unknown>("./data/*.json", {
      eager: true,
      import: "default",
    });
    const order = files["./data/order.json"] as string[];
    expect(LEVELS.map((level) => level.id)).toEqual(order);
    // Every other file is a level in the order (none failed to read).
    expect(Object.keys(files)).toHaveLength(order.length + 1);
    expect(new Set(order).size).toBe(order.length);
    for (const level of LEVELS) {
      expect(isLevelId(level.id)).toBe(true);
      expect(level.hearts.length).toBeLessThanOrEqual(MAX_HEARTS);
      expect(level.solution).not.toBeNull();
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

describe("reading a level file", () => {
  const good = {
    id: "a-level",
    name: "A level",
    tip: "Tip",
    rider: "sledge",
    start: { x: 1, y: 2 },
    goal: { x: 3, y: 4 },
    hearts: [{ x: 5, y: 6 }],
    limits: { ink: 100, portals: 0, cannons: 5 },
    pieces: { version: 1, lines: [] },
    solution: null,
  };

  it("reads a good one, keeping just the limits a level can set", () => {
    const level = parseLevel(good)!;
    expect(level.rider).toBe("sledge");
    expect(level.limits).toEqual({ ink: 100 });
    expect(level.pieces.cups).toEqual([]);
    expect(level.solution).toBeNull();
  });

  it("turns down one without an id, a start, a goal or pieces", () => {
    expect(parseLevel({ ...good, id: "Not a file name" })).toBeNull();
    expect(parseLevel({ ...good, start: null })).toBeNull();
    expect(parseLevel({ ...good, goal: "here" })).toBeNull();
    expect(parseLevel({ ...good, pieces: { version: 2 } })).toBeNull();
    expect(parseLevel("level")).toBeNull();
  });
});
