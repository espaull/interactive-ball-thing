import { describe, expect, it } from "vitest";
import { Camera } from "../camera";
import type { Point } from "../geometry/point";
import { Playground } from "../world/playground";
import { MoveTool } from "./move";
import type { ToolContext } from "./tool";

const STEP = 1 / 60;

function setUp() {
  const playground = new Playground();
  const camera = new Camera();
  const ctx = { playground, camera } as unknown as ToolContext;
  return { playground, camera, tool: new MoveTool(ctx) };
}

function drag(tool: MoveTool, from: Point, to: Point): void {
  expect(tool.down(from)).toBe("drag");
  tool.move({ x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 });
  tool.move(to);
  tool.up();
}

function run(pg: Playground, seconds: number): void {
  for (let t = 0; t < seconds; t += STEP) pg.step(STEP);
}

describe("move tool", () => {
  it("moves a cup, and it catches balls in its new place", () => {
    const { playground, tool } = setUp();
    const cup = playground.addCup(200, 300);
    // Grabbed off-centre, it moves with the pointer without jumping to it.
    drag(tool, { x: 210, y: 290 }, { x: 610, y: 290 });
    expect(cup).toMatchObject({ x: 600, y: 300 });

    const ball = playground.addBall(600, 200);
    run(playground, 1.5);
    expect(cup.caught).toBe(1);
    expect(playground.balls).not.toContain(ball);
  });

  it("moves a cannon, which holds its fire until it's put down", () => {
    const { playground, tool } = setUp();
    const cannon = playground.addCannon(100, 100, 0, 0.5);
    let shots = 0;
    playground.onFire = () => shots++;

    tool.down({ x: 100, y: 100 });
    tool.move({ x: 400, y: 100 });
    run(playground, 1); // its first shot is due, but it's held
    expect(shots).toBe(0);
    tool.up();
    run(playground, 0.1);
    expect(shots).toBe(1);
    expect(cannon).toMatchObject({ x: 400, y: 100 });
    expect(playground.balls[0].position.x).toBeGreaterThan(400);
  });

  it("moves one end of a portal pair", () => {
    const { playground, tool } = setUp();
    playground.world.setGravity({ x: 0, y: 0 });
    const pair = playground.addPortalPair(
      { x: 100, y: 100 },
      { x: 500, y: 100 },
      "purple",
    );
    drag(tool, { x: 500, y: 100 }, { x: 500, y: 400 });
    expect(pair.b).toMatchObject({ x: 500, y: 400 });

    const ball = playground.addBall(100, 100);
    run(playground, 0.1);
    expect(ball.position).toEqual({ x: 500, y: 400 });
  });

  it("doesn't nudge things when they're just tapped", () => {
    const { playground, tool } = setUp();
    const cup = playground.addCup(200, 300);
    drag(tool, { x: 200, y: 300 }, { x: 203, y: 302 });
    expect(cup).toMatchObject({ x: 200, y: 300 });
  });

  it("puts a thing back if the move is called off", () => {
    const { playground, tool } = setUp();
    const cup = playground.addCup(200, 300);
    tool.down({ x: 200, y: 300 });
    tool.move({ x: 500, y: 300 });
    expect(tool.busy).toBe(true);
    tool.cancel();
    expect(cup).toMatchObject({ x: 200, y: 300 });
    expect(tool.busy).toBe(false);
  });

  it("still pans from empty space, and follows a tapped ball", () => {
    const { playground, camera, tool } = setUp();
    expect(tool.down({ x: 300, y: 300 })).toBe("pan");
    const ball = playground.addBall(100, 100);
    expect(tool.down({ x: 100, y: 100 })).toBe("none");
    expect(camera.target).toBe(ball);
  });
});
