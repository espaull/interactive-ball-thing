import { describe, expect, it } from "vitest";
import type { Point } from "../geometry/point";
import { Budget } from "../world/budget";
import { emptyLayout } from "../world/layout";
import { Playground } from "../world/playground";
import type { Level } from "./level";
import { LevelPlay } from "./play";

const STEP = 1 / 60;

// A level with the rider straight above the goal cup, and a heart on the
// way down (and one it'll never reach).
function dropLevel(): Level {
  return {
    id: "drop",
    name: "Drop",
    tip: "",
    rider: "ball",
    start: { x: 200, y: 100 },
    goal: { x: 200, y: 400 },
    hearts: [
      { x: 200, y: 250 },
      { x: 600, y: 250 },
    ],
    pieces: {
      ...emptyLayout(),
      lines: [
        [
          { x: 0, y: 500 },
          { x: 700, y: 500 },
        ],
      ],
    },
    limits: { ink: 300 },
    solution: null,
  };
}

function setUp(level = dropLevel()) {
  const playground = new Playground();
  const budget = new Budget(playground);
  const play = new LevelPlay(playground, budget);
  const events: string[] = [];
  play.onHeart = (p) => events.push(`heart ${p.x}`);
  play.onWin = (hearts) => events.push(`won with ${hearts}`);
  play.onLost = () => events.push("lost");
  play.start(level);
  return { playground, budget, play, events };
}

// Run the game loop as main.ts does, for `seconds`.
function run(pg: Playground, play: LevelPlay, seconds: number): void {
  for (let t = 0; t < seconds; t += STEP) {
    play.update();
    pg.step(STEP);
    if (!pg.paused) play.afterStep(STEP);
  }
}

function riderAt(pg: Playground): Point {
  return pg.balls[0].position;
}

describe("playing a level", () => {
  it("sets up the level's pieces and limits, with the rider waiting", () => {
    const { playground, budget, play } = setUp();
    expect(playground.fixedLayout().lines).toHaveLength(1);
    expect(playground.fixedLayout().cups).toEqual([{ x: 200, y: 400 }]);
    expect(budget.left("ink")).toBe(300);
    expect(budget.allows("portals")).toBe(false);
    expect(play.stage).toBe("building");
    expect(playground.paused).toBe(true);
    run(playground, play, 1);
    expect(riderAt(playground)).toEqual({ x: 200, y: 100 });
  });

  it("collects hearts on the way, and wins in the goal cup", () => {
    const { playground, play, events } = setUp();
    play.go();
    expect(play.stage).toBe("running");
    run(playground, play, 2);
    expect(events).toEqual(["heart 200", "won with 1"]);
    expect(play.stage).toBe("won");
    expect(play.hearts).toEqual([{ x: 600, y: 250 }]);
  });

  it("puts a rider that falls off back at the start, hearts and all", () => {
    const level = dropLevel();
    // Nowhere to land but the edge of the world.
    level.goal = { x: 2000, y: 400 };
    level.pieces = emptyLayout();
    const { playground, play, events } = setUp(level);
    playground.lines.add([
      { x: 0, y: 50 },
      { x: 50, y: 50 },
    ]);
    play.go();
    run(playground, play, 5);
    expect(events).toEqual(["heart 200", "lost"]);
    expect(play.stage).toBe("building");
    expect(playground.paused).toBe(true);
    expect(riderAt(playground)).toEqual({ x: 200, y: 100 });
    expect(play.hearts).toHaveLength(2);
    // The player's line is still there.
    expect(playground.layout().lines).toHaveLength(1);
  });

  it("puts a rider that pops on spikes back at the start", () => {
    const level = dropLevel();
    // Spikes across the way down, above the heart.
    level.pieces = {
      ...level.pieces,
      spikes: [
        [
          { x: 150, y: 200 },
          { x: 250, y: 200 },
        ],
      ],
    };
    const { playground, play, events } = setUp(level);
    play.go();
    run(playground, play, 2);
    expect(events).toEqual(["lost"]);
    expect(riderAt(playground)).toEqual({ x: 200, y: 100 });
  });

  it("counts a rider that's stopped moving as stuck", () => {
    const level = dropLevel();
    level.rider = "sledge";
    level.goal = { x: 600, y: 400 };
    level.hearts = [];
    const { playground, play, events } = setUp(level);
    // A floor under the start, where the sledge comes to rest.
    playground.lines.add([
      { x: 100, y: 120 },
      { x: 300, y: 120 },
    ]);
    play.go();
    run(playground, play, 1.5);
    expect(events).toEqual([]);
    run(playground, play, 2);
    expect(events).toEqual(["lost"]);
  });

  it("calls time on a rider rolling to and fro for ever", () => {
    const level = dropLevel();
    level.goal = { x: 2000, y: 400 };
    level.hearts = [];
    // A smooth valley: a ball rolls up one side and back down, and on.
    const valley: Point[] = [];
    for (let x = 0; x <= 400; x += 8) {
      valley.push({ x, y: 300 + 200 * Math.sin((x / 400) * Math.PI) });
    }
    level.pieces = { ...emptyLayout(), lines: [valley] };
    level.start = { x: 60, y: 360 };
    const { playground, play, events } = setUp(level);
    play.go();
    run(playground, play, 15);
    expect(events).toEqual([]);
    run(playground, play, 6);
    expect(events).toEqual(["lost"]);
  });

  it("brings the rider back if it's rubbed out before Go", () => {
    const { playground, play } = setUp();
    playground.eraseAt(200, 100, 20);
    expect(playground.balls).toHaveLength(0);
    run(playground, play, STEP);
    expect(riderAt(playground)).toEqual({ x: 200, y: 100 });
    playground.clear();
    run(playground, play, STEP);
    expect(playground.balls).toHaveLength(1);
  });

  it("leaves nothing behind", () => {
    const { playground, budget, play } = setUp();
    playground.lines.add([
      { x: 0, y: 50 },
      { x: 50, y: 50 },
    ]);
    play.leave();
    expect(playground.hasDesign).toBe(false);
    expect(playground.balls).toHaveLength(0);
    expect(playground.paused).toBe(false);
    expect(budget.left("ink")).toBe(Infinity);
  });
});
