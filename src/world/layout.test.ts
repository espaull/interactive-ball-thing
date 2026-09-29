import { describe, expect, it } from "vitest";
import { parseLayout } from "./layout";
import { Playground } from "./playground";

function designed(): Playground {
  const pg = new Playground();
  pg.lines.add([
    { x: 0, y: 500 },
    { x: 400.123, y: 520.456 },
  ]);
  pg.boosts.add([
    { x: 50, y: 490 },
    { x: 150, y: 490 },
  ]);
  pg.portals.add({ x: 300, y: 300 }, { x: 900, y: 300 }, "purple", null, 1);
  pg.cups.add(700, 600);
  pg.cannons.add(100, 100, -0.5, 0.75, false);
  pg.addBall(200, 200);
  pg.addBubble(250, 250);
  return pg;
}

describe("layouts", () => {
  it("save everything but the balls and bubbles, and load it back", () => {
    const layout = designed().layout();
    expect(layout.lines[0][1]).toEqual({ x: 400.1, y: 520.5 });
    expect(layout.portals[0].b.aim).toBe(1);
    expect(layout.cannons[0]).toMatchObject({ power: 0.75, active: false });

    const pg = new Playground();
    pg.addBall(10, 10);
    // Through JSON, as it will be in storage.
    pg.loadLayout(parseLayout(JSON.parse(JSON.stringify(layout)))!);
    expect(pg.layout()).toEqual(layout);
    expect(pg.balls).toHaveLength(0);
    expect(pg.bubbles).toHaveLength(0);
  });

  it("load into working physics", () => {
    const pg = new Playground();
    pg.loadLayout(designed().layout());
    // A ball dropped on the loaded line lands on it.
    const ball = pg.addBall(200, 400);
    for (let t = 0; t < 1; t += 1 / 60) pg.step(1 / 60);
    expect(ball.position.y).toBeLessThan(520);
  });

  it("know when there's a design", () => {
    expect(new Playground().hasDesign).toBe(false);
    const pg = designed();
    expect(pg.hasDesign).toBe(true);
    pg.clear();
    expect(pg.hasDesign).toBe(false);
  });

  it("reject what isn't a layout, and skip what's damaged inside one", () => {
    expect(parseLayout(null)).toBeNull();
    expect(parseLayout("hello")).toBeNull();
    expect(parseLayout({ version: 2, lines: [] })).toBeNull();

    const layout = parseLayout({
      version: 1,
      lines: [
        [
          { x: 0, y: 0 },
          { x: 10, y: "no" },
        ],
        "junk",
      ],
      boosts: [
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
      ],
      portals: [
        { a: { x: 1, y: 2 }, b: { x: 3, y: 4, aim: 2 }, color: "teal" },
      ],
      cups: [{ x: 5, y: 6 }, { x: null }],
      cannons: [{ x: 1, y: 2, angle: 0, power: 7 }],
    })!;
    // One good point isn't a line.
    expect(layout.lines).toEqual([]);
    expect(layout.boosts).toHaveLength(1);
    expect(layout.portals[0].a.aim).toBeNull();
    expect(layout.portals[0].b.aim).toBe(2);
    expect(layout.cups).toEqual([{ x: 5, y: 6 }]);
    expect(layout.cannons[0]).toMatchObject({ power: 1, active: true });
  });
});
