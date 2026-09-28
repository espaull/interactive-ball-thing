import { describe, expect, it } from "vitest";
import { Playground } from "./playground";
import { PORTAL_RADIUS_PX } from "./portals";

const STEP = 1 / 60;

function run(pg: Playground, seconds: number, eachStep?: () => void): void {
  for (let t = 0; t < seconds; t += STEP) {
    eachStep?.();
    pg.step(STEP);
  }
}

describe("portals", () => {
  it("send a ball out of the partner portal, same speed and direction", () => {
    const pg = new Playground();
    pg.world.setGravity({ x: 0, y: 0 }); // so the velocity stays put to compare
    pg.addPortalPair({ x: 300, y: 300 }, { x: 900, y: 600 }, "purple");
    const ball = pg.addBall(200, 300);
    ball.body.setLinearVelocity({ x: 6, y: 0 });
    const trips: string[] = [];
    pg.onTeleport = (t) => trips.push(t.color);

    run(pg, 1);
    expect(trips).toEqual(["purple"]);
    // Came out at the far portal and carried on to the right from there.
    expect(ball.position.x).toBeGreaterThan(900);
    expect(Math.abs(ball.position.y - 600)).toBeLessThan(1);
    expect(ball.body.getLinearVelocity().x).toBeCloseTo(6);
  });

  it("don't send a ball straight back while it's still in the exit", () => {
    const pg = new Playground();
    pg.world.setGravity({ x: 0, y: 0 });
    pg.addPortalPair({ x: 300, y: 300 }, { x: 900, y: 300 }, "purple");
    const ball = pg.addBall(300, 300); // dropped right in, and not moving
    let trips = 0;
    pg.onTeleport = () => trips++;
    run(pg, 1);
    expect(trips).toBe(1);
    expect(ball.position.x).toBeCloseTo(900);
  });

  it("keep each pair separate", () => {
    const pg = new Playground();
    pg.world.setGravity({ x: 0, y: 0 });
    pg.addPortalPair({ x: 100, y: 100 }, { x: 500, y: 100 }, "purple");
    pg.addPortalPair({ x: 100, y: 400 }, { x: 500, y: 400 }, "teal");
    const ball = pg.addBall(100, 400);
    const trips: string[] = [];
    pg.onTeleport = (t) => trips.push(t.color);
    run(pg, 0.2);
    expect(trips).toEqual(["teal"]);
    expect(ball.position).toEqual({ x: 500, y: 400 });
  });

  it("cap the speed of an endless fall", () => {
    const pg = new Playground();
    // Falling into the bottom portal comes back out of the top one, forever.
    pg.addPortalPair({ x: 300, y: 900 }, { x: 300, y: 100 }, "purple");
    // Starts between them, falling towards the bottom one.
    const ball = pg.addBall(300, 300);
    let trips = 0;
    pg.onTeleport = () => trips++;
    run(pg, 20);
    expect(trips).toBeGreaterThan(5);
    const v = ball.body.getLinearVelocity();
    // At most the cap, plus whatever a single fall adds.
    expect(Math.hypot(v.x, v.y)).toBeLessThan(25 + 13);
  });

  it("take bubbles too", () => {
    const pg = new Playground();
    pg.addPortalPair({ x: 300, y: 300 }, { x: 900, y: 300 }, "purple");
    // Bubbles float up, into the portal above them.
    const bubble = pg.addBubble(300, 300 + PORTAL_RADIUS_PX + 5);
    let trips = 0;
    pg.onTeleport = () => trips++;
    run(pg, 1.5);
    expect(trips).toBe(1);
    // Out of the far portal (and drifting a little, as bubbles do).
    expect(Math.abs(bubble.position.x - 900)).toBeLessThan(60);
  });

  it("are erased a pair at a time", () => {
    const pg = new Playground();
    pg.addPortalPair({ x: 100, y: 100 }, { x: 500, y: 100 }, "purple");
    pg.addPortalPair({ x: 100, y: 400 }, { x: 500, y: 400 }, "teal");
    // Rub out one end of the teal pair.
    pg.eraseAt(500, 400, 18);
    expect(pg.portalPairs.map((p) => p.color)).toEqual(["purple"]);
    pg.clear();
    expect(pg.portalPairs).toHaveLength(0);
  });
});
