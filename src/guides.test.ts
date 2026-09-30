import { describe, expect, it, vi } from "vitest";
import { Camera } from "./camera";
import { Guides } from "./guides";
import { Playground } from "./world/playground";

const STEP = 1 / 60;

function setUp() {
  const playground = new Playground();
  playground.world.setGravity({ x: 0, y: 0 });
  const camera = new Camera();
  camera.resize(800, 600);
  const guides = new Guides();
  // As the game loop does.
  const run = (seconds: number) => {
    for (let t = 0; t < seconds; t += STEP) {
      guides.update(playground, camera);
      playground.step(STEP);
      if (!playground.paused) guides.afterStep(playground);
    }
    guides.update(playground, camera);
  };
  return { playground, camera, guides, run };
}

describe("the trail", () => {
  it("shows only while paused, but is recorded all the time", () => {
    const { playground, guides, run } = setUp();
    playground.addBall(0, 100).body.setLinearVelocity({ x: 5, y: 0 });
    run(1);
    expect(guides.view(playground).trail).toEqual([]);
    playground.setPaused(true);
    expect(guides.view(playground).trail[0].length).toBeGreaterThan(50);
  });

  it("follows the newest ball over the last 2 seconds, fading with age", () => {
    const { playground, guides, run } = setUp();
    const ball = playground.addBall(0, 100);
    ball.body.setLinearVelocity({ x: 5, y: 0 }); // 200px/s
    run(3);
    playground.setPaused(true);
    const { trail, color } = guides.view(playground);
    expect(color).toBe(ball.color);
    expect(trail).toHaveLength(1);
    const dots = trail[0];
    // Two seconds' worth, the oldest about 400px back.
    expect(dots.length).toBeGreaterThan(110);
    expect(dots.length).toBeLessThan(125);
    expect(ball.position.x - dots[0].x).toBeCloseTo(400, -1);
    expect(dots[0].age).toBeGreaterThan(0.95);
    expect(dots.at(-1)!.age).toBe(0);
  });

  it("holds still while paused", () => {
    const { playground, guides, run } = setUp();
    playground.addBall(0, 100).body.setLinearVelocity({ x: 5, y: 0 });
    run(1);
    playground.setPaused(true);
    const before = guides.view(playground);
    run(3);
    expect(guides.view(playground)).toEqual(before);
  });

  it("follows the ball the camera is following, starting afresh", () => {
    const { playground, camera, guides, run } = setUp();
    const first = playground.addBall(0, 100);
    playground.addBall(0, 300);
    run(0.5);
    playground.setPaused(true);
    expect(guides.view(playground).trail[0][0].y).toBeCloseTo(300);
    playground.setPaused(false);
    camera.setFollowing(true, first);
    run(0.1);
    playground.setPaused(true);
    const { trail, color } = guides.view(playground);
    expect(color).toBe(first.color);
    expect(trail[0].every((dot) => Math.abs(dot.y - 100) < 1)).toBe(true);
    expect(trail[0].length).toBeLessThan(10);
  });

  it("breaks where the ball goes through a portal", () => {
    const { playground, guides, run } = setUp();
    playground.portals.add({ x: 300, y: 100 }, { x: 300, y: 500 }, "purple");
    playground.addBall(100, 100).body.setLinearVelocity({ x: 5, y: 0 });
    run(1.5);
    playground.setPaused(true);
    const { trail } = guides.view(playground);
    expect(trail).toHaveLength(2);
    expect(trail[1][0].y).toBeCloseTo(500, 0);
  });

  it("is empty with no balls", () => {
    const { playground, guides, run } = setUp();
    run(1);
    playground.setPaused(true);
    expect(guides.view(playground).trail).toEqual([]);
  });
});

describe("the predicted path", () => {
  it("shows only while paused, and only for a ball", () => {
    const { playground, guides, run } = setUp();
    playground.addBubble(100, 100);
    run(0.1);
    playground.setPaused(true);
    expect(guides.view(playground).path).toEqual([]);
    playground.addBall(200, 100).body.setLinearVelocity({ x: 5, y: 0 });
    run(0.1);
    const path = guides.view(playground).path;
    expect(path).toHaveLength(1);
    expect(path[0].at(-1)!.x).toBeGreaterThan(400);
    playground.setPaused(false);
    expect(guides.view(playground).path).toEqual([]);
  });

  it("is worked out again only when the design or the ball changes", () => {
    const { playground, guides, run } = setUp();
    playground.addBall(200, 100).body.setLinearVelocity({ x: 5, y: 0 });
    playground.setPaused(true);
    run(0.1);
    const layout = vi.spyOn(playground, "layout");
    guides.view(playground);
    guides.view(playground);
    expect(layout).toHaveBeenCalledTimes(1);

    // A wall in the way: the path now stops short of it.
    playground.lines.add([
      { x: 300, y: 0 },
      { x: 300, y: 200 },
    ]);
    const path = guides.view(playground).path;
    expect(layout).toHaveBeenCalledTimes(2);
    expect(Math.max(...path[0].map((p) => p.x))).toBeLessThan(300);
  });
});
