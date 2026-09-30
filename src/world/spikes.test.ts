import { describe, expect, it } from "vitest";
import type { Point } from "../geometry/point";
import { emptyLayout } from "./layout";
import { Playground } from "./playground";
import { predictPath } from "./prediction";

const STEP = 1 / 60;

// A strip of spikes along y = 400.
const strip: Point[] = [
  { x: 0, y: 400 },
  { x: 200, y: 400 },
  { x: 400, y: 400 },
];

function run(pg: Playground, seconds: number): void {
  for (let t = 0; t < seconds; t += STEP) pg.step(STEP);
}

describe("spikes", () => {
  it("pop a ball that lands on them", () => {
    const pg = new Playground();
    pg.spikes.add(strip);
    const popped: Point[] = [];
    pg.onSpiked = (_, at) => popped.push(at);
    const ball = pg.addBall(200, 300);
    run(pg, 1);
    expect(pg.contains(ball)).toBe(false);
    expect(popped).toHaveLength(1);
    // Where it touched the spikes' tips, not the strip itself.
    expect(popped[0].y).toBeLessThan(400 - ball.radius);
  });

  it("pop sledges and bubbles too", () => {
    const pg = new Playground();
    pg.spikes.add(strip);
    let bubblesPopped = 0;
    pg.onPop = () => bubblesPopped++;
    const sledge = pg.addSledge(100, 300);
    const bubble = pg.addBubble(300, 450);
    run(pg, 3);
    expect(pg.contains(sledge)).toBe(false);
    expect(pg.contains(bubble)).toBe(false);
    expect(bubblesPopped).toBe(1);
  });

  it("leave alone a ball that doesn't touch them", () => {
    const pg = new Playground();
    pg.spikes.add(strip);
    pg.lines.add([
      { x: -100, y: 460 },
      { x: 500, y: 460 },
    ]);
    const ball = pg.addBall(0, 440);
    ball.body.setLinearVelocity({ x: 5, y: 0 });
    run(pg, 1);
    expect(pg.contains(ball)).toBe(true);
    expect(ball.position.x).toBeGreaterThan(100);
  });

  it("are rubbed out where the eraser goes, splitting the strip", () => {
    const pg = new Playground();
    pg.spikes.add(strip);
    pg.eraseAt(200, 400, 20);
    expect(pg.spikes.all).toHaveLength(2);
    // The gap is safe now.
    const ball = pg.addBall(200, 300);
    run(pg, 1);
    expect(pg.contains(ball)).toBe(true);
  });

  it("can't be rubbed out when they're a level's", () => {
    const pg = new Playground();
    pg.fix({ ...emptyLayout(), spikes: [strip] });
    pg.eraseAt(200, 400, 20);
    expect(pg.spikes.all).toHaveLength(1);
    expect(pg.layout().spikes).toEqual([]);
  });

  it("end a ball's predicted path", () => {
    const pg = new Playground();
    pg.spikes.add(strip);
    const ball = pg.addBall(200, 300);
    const [path] = predictPath(pg, ball);
    expect(path.at(-1)!.y).toBeLessThan(400);
    expect(path.length).toBeLessThan(60);
  });
});
