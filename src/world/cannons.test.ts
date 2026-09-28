import { describe, expect, it } from "vitest";
import {
  CANNON_MAX_SPEED,
  CANNON_MIN_SPEED,
  launchSpeed,
  predictPath,
} from "./cannons";
import { Playground } from "./playground";

const STEP = 1 / 60;

function run(pg: Playground, seconds: number, eachStep?: () => void): void {
  for (let t = 0; t < seconds; t += STEP) {
    pg.step(STEP);
    eachStep?.();
  }
}

describe("cannons", () => {
  it("fire a ball every 2 seconds, starting shortly after being placed", () => {
    const pg = new Playground();
    let shots = 0;
    pg.onFire = () => shots++;
    pg.addCannon(400, 400, -Math.PI / 4, 0.5);
    run(pg, 5.1); // shots at 0.5s, 2.5s and 4.5s
    expect(shots).toBe(3);
    expect(pg.balls).toHaveLength(3);
  });

  it("fire in the direction they're aimed, at a speed set by their power", () => {
    const pg = new Playground();
    pg.world.setGravity({ x: 0, y: 0 });
    // Straight up (y points down), full power.
    pg.addCannon(400, 400, -Math.PI / 2, 1);
    run(pg, 0.6);
    const v = pg.balls[0].body.getLinearVelocity();
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(-CANNON_MAX_SPEED);
  });

  it("range from a gentle lob to a big shot", () => {
    expect(launchSpeed(0)).toBe(CANNON_MIN_SPEED);
    expect(launchSpeed(1)).toBe(CANNON_MAX_SPEED);
    expect(launchSpeed(0.5)).toBeCloseTo(
      (CANNON_MIN_SPEED + CANNON_MAX_SPEED) / 2,
    );
  });

  it("don't fire while paused", () => {
    const pg = new Playground();
    const cannon = pg.addCannon(400, 400, 0, 0.5);
    cannon.active = false;
    run(pg, 5);
    expect(pg.balls).toHaveLength(0);
  });

  // The dotted aiming line has to show where balls really go.
  it("send balls along the predicted path", () => {
    const pg = new Playground();
    const cannon = pg.addCannon(200, 600, -Math.PI / 3, 0.6);
    const path = predictPath(cannon, 1.2, STEP);
    let firedAt = -1;
    let worst = 0;
    let step = 0;
    run(pg, 1.6, () => {
      const ball = pg.balls[0];
      if (!ball) return;
      if (firedAt < 0) firedAt = step;
      // A ball is fired and then moved one physics step in the same update,
      // so by the first look it's already one step into its flight.
      const i = step - firedAt + 1;
      if (i < path.length) {
        const p = ball.position;
        worst = Math.max(worst, Math.hypot(p.x - path[i].x, p.y - path[i].y));
      }
      step++;
    });
    // Within a few pixels over more than a second of flight.
    expect(worst).toBeLessThan(6);
  });

  it("can be found by tapping, and removed by the eraser and by Clear", () => {
    const pg = new Playground();
    const first = pg.addCannon(200, 200, 0, 0.5);
    pg.addCannon(600, 200, 0, 0.5);
    expect(pg.cannonAt(210, 205)).toBe(first);
    expect(pg.cannonAt(400, 400)).toBeNull();
    pg.eraseAt(200, 200, 18);
    expect(pg.cannons.map((c) => c.x)).toEqual([600]);
    pg.clear();
    expect(pg.cannons).toHaveLength(0);
  });
});

describe("a cannon being aimed", () => {
  it("holds its fire until it's let go", () => {
    const pg = new Playground();
    const cannon = pg.addCannon(400, 400, 0, 0.5);
    cannon.aiming = true;
    run(pg, 5);
    expect(pg.balls).toHaveLength(0);
    cannon.aiming = false;
    run(pg, 0.1);
    expect(pg.balls).toHaveLength(1);
  });
});
