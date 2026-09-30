import { describe, expect, it } from "vitest";
import { Budget, NO_LIMITS } from "./budget";
import { emptyLayout } from "./layout";
import { Playground } from "./playground";

function flat(y: number, length: number) {
  return [
    { x: 0, y },
    { x: length, y },
  ];
}

describe("budget", () => {
  it("has no limits in free play", () => {
    const pg = new Playground();
    const budget = new Budget(pg);
    pg.lines.add(flat(100, 5000));
    expect(budget.left("ink")).toBe(Infinity);
    expect(budget.allows("portals")).toBe(true);
    expect(budget.isLimited("ink")).toBe(false);
  });

  it("counts what the player places, not the level's fixed pieces", () => {
    const pg = new Playground();
    const budget = new Budget(pg);
    budget.limits = { ...NO_LIMITS, ink: 500, boost: 200, portals: 1 };
    pg.fix({
      ...emptyLayout(),
      lines: [flat(300, 1000)],
      boosts: [flat(290, 400)],
      portals: [
        {
          a: { x: 0, y: 0, aim: null },
          b: { x: 100, y: 0, aim: null },
          color: "purple",
        },
      ],
    });
    expect(budget.left("ink")).toBe(500);
    expect(budget.left("boost")).toBe(200);
    expect(budget.left("portals")).toBe(1);

    pg.lines.add(flat(100, 300));
    pg.boosts.add(flat(90, 150));
    pg.portals.add({ x: 0, y: 500 }, { x: 100, y: 500 }, "teal");
    expect(budget.left("ink")).toBeCloseTo(200);
    expect(budget.left("boost")).toBeCloseTo(50);
    expect(budget.left("portals")).toBe(0);
  });

  it("gives back what's rubbed out", () => {
    const pg = new Playground();
    const budget = new Budget(pg);
    budget.limits = { ...NO_LIMITS, ink: 500 };
    pg.lines.add(flat(100, 400));
    pg.eraseAt(300, 100, 10);
    // The piece from 290 to 310 has gone.
    expect(budget.left("ink")).toBeCloseTo(120, -1);
  });

  it("leaves out what a level doesn't allow at all", () => {
    const pg = new Playground();
    const budget = new Budget(pg);
    budget.limits = { ...NO_LIMITS, cups: 0 };
    expect(budget.allows("cups")).toBe(false);
    expect(budget.isLimited("cups")).toBe(false);
  });
});
