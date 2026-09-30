import { describe, expect, it } from "vitest";
import type { Point } from "../geometry/point";
import { emptyLayout, parseLayout } from "./layout";
import { Playground } from "./playground";

const STEP = 1 / 60;

// A rock 200px wide, its flat top at y = 400.
const slab: Point[] = [
  { x: 100, y: 400 },
  { x: 300, y: 400 },
  { x: 300, y: 500 },
  { x: 100, y: 500 },
];

function run(pg: Playground, seconds: number): void {
  for (let t = 0; t < seconds; t += STEP) pg.step(STEP);
}

describe("rocks", () => {
  it("are solid: a ball lands on top", () => {
    const pg = new Playground();
    pg.rocks.add(slab);
    const ball = pg.addBall(200, 300);
    run(pg, 2);
    expect(ball.position.y).toBeCloseTo(400 - ball.radius, 0);
  });

  it("stop a ball rolling into their side", () => {
    const pg = new Playground();
    pg.lines.add([
      { x: -200, y: 500 },
      { x: 500, y: 500 },
    ]);
    pg.rocks.add(slab);
    const ball = pg.addBall(0, 484);
    ball.body.setLinearVelocity({ x: 10, y: 0 });
    run(pg, 2);
    expect(ball.position.x).toBeLessThan(100);
  });

  it("are rubbed out whole, from inside or at their edge", () => {
    const pg = new Playground();
    pg.rocks.add(slab);
    pg.eraseAt(200, 450, 10);
    expect(pg.rocks.all).toHaveLength(0);

    pg.rocks.add(slab);
    pg.eraseAt(90, 450, 18);
    expect(pg.rocks.all).toHaveLength(0);

    pg.rocks.add(slab);
    pg.eraseAt(50, 450, 18);
    expect(pg.rocks.all).toHaveLength(1);
  });

  it("can't be rubbed out when they're a level's", () => {
    const pg = new Playground();
    pg.fix({ ...emptyLayout(), rocks: [slab] });
    pg.eraseAt(200, 450, 10);
    expect(pg.rocks.all).toHaveLength(1);
    expect(pg.layout().rocks).toEqual([]);
    expect(pg.fixedLayout().rocks).toEqual([slab]);
  });

  it("are read back only with three good points", () => {
    const layout = parseLayout({
      version: 1,
      rocks: [
        slab,
        [slab[0], slab[1]],
        [slab[0], slab[0], slab[1], { x: "no" }],
        "junk",
      ],
    })!;
    expect(layout.rocks).toEqual([slab]);
  });
});
