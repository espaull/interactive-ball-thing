import { describe, expect, it } from "vitest";
import type { Point } from "../geometry/point";
import { BoostTool } from "../tools/boost";
import { CannonTool } from "../tools/cannon";
import { CupTool } from "../tools/cup";
import { CurveTool } from "../tools/curve";
import { MoveTool } from "../tools/move";
import { PencilTool } from "../tools/pencil";
import { PortalTool } from "../tools/portal";
import type { Tool, ToolContext } from "../tools/tool";
import { Budget } from "./budget";
import { emptyLayout } from "./layout";
import { Playground } from "./playground";

// An area from x = 100 to 200, well above and below y = 100.
const area: Point[] = [
  { x: 100, y: 0 },
  { x: 200, y: 0 },
  { x: 200, y: 200 },
  { x: 100, y: 200 },
];

function setUp() {
  const playground = new Playground();
  const budget = new Budget(playground);
  const ctx = {
    playground,
    camera: { zoom: 1 },
    budget,
    findSnap: (p: Point) => playground.lines.endAt(p.x, p.y, 20),
  } as unknown as ToolContext;
  playground.noDraw.add(area);
  return { playground, ctx };
}

// Drag along y = 100 from x = `from` to `to`, in 5px steps.
function drag(tool: Tool, from: number, to: number): void {
  tool.down({ x: from, y: 100 });
  for (let x = from + 5; x <= to; x += 5) tool.move?.({ x, y: 100 });
  tool.up?.();
}

function xs(points: Point[]): [number, number] {
  return [Math.round(points[0].x), Math.round(points.at(-1)!.x)];
}

describe("no-drawing areas", () => {
  it("cut a line drawn across them at their edges", () => {
    const { playground, ctx } = setUp();
    drag(new PencilTool(ctx), 0, 300);
    expect(playground.lines.all.map((l) => xs(l.points))).toEqual([
      [0, 100],
      [200, 300],
    ]);
  });

  it("take all of a line drawn inside them", () => {
    const { playground, ctx } = setUp();
    drag(new PencilTool(ctx), 120, 180);
    expect(playground.lines.all).toHaveLength(0);
  });

  it("still let a line cut short join the line it was drawn from", () => {
    const { playground, ctx } = setUp();
    playground.lines.add([
      { x: -100, y: 100 },
      { x: 0, y: 100 },
    ]);
    drag(new PencilTool(ctx), 0, 300);
    expect(playground.lines.all.map((l) => xs(l.points))).toEqual([
      [-100, 100],
      [200, 300],
    ]);
  });

  it("cut curves too", () => {
    const { playground, ctx } = setUp();
    const curve = new CurveTool(ctx);
    for (const x of [0, 150, 300]) curve.down({ x, y: 100 });
    curve.key("Enter");
    expect(playground.lines.all).toHaveLength(2);
  });

  it("cut boost strips", () => {
    const { playground, ctx } = setUp();
    drag(new BoostTool(ctx), 0, 300);
    expect(playground.boosts.all).toHaveLength(2);
  });

  it("show a line cut short while it's drawn", () => {
    const { ctx } = setUp();
    const pencil = new PencilTool(ctx);
    pencil.down({ x: 0, y: 100 });
    for (let x = 5; x <= 300; x += 5) pencil.move({ x, y: 100 });
    expect(pencil.overlay(null).preview).toHaveLength(2);
  });

  it("leave what was there before them", () => {
    const pg = new Playground();
    pg.lines.add([
      { x: 0, y: 100 },
      { x: 300, y: 100 },
    ]);
    pg.cups.add(150, 100);
    pg.noDraw.add(area);
    expect(pg.lines.all).toHaveLength(1);
    expect(pg.cups.all).toHaveLength(1);
  });

  it("can't have portals, cups or cannons put in them", () => {
    const { playground, ctx } = setUp();
    const inside = { x: 150, y: 100 };
    expect(new CupTool(ctx).down(inside)).toBe("none");
    expect(new CannonTool(ctx).down(inside)).toBe("none");
    const portal = new PortalTool(ctx);
    portal.down({ x: 50, y: 100 });
    portal.up();
    expect(portal.down(inside)).toBe("none");
    expect(playground.cups.all).toHaveLength(0);
    expect(playground.cannons.all).toHaveLength(0);
    expect(playground.portals.pairs).toHaveLength(0);
  });

  it("can't have things moved into them", () => {
    const { playground, ctx } = setUp();
    playground.cups.add(50, 100);
    const move = new MoveTool(ctx);
    move.down({ x: 50, y: 100 });
    move.move({ x: 90, y: 100 });
    move.move({ x: 150, y: 100 });
    move.up();
    expect(playground.cups.all[0].x).toBe(90);
  });

  it("stop the player in a level too", () => {
    const { playground, ctx } = setUp();
    playground.noDraw.load([]);
    playground.fix({ ...emptyLayout(), noDraw: [area] });
    drag(new PencilTool(ctx), 0, 300);
    expect(playground.lines.all).toHaveLength(2);
  });

  it("let balls fall straight through", () => {
    const { playground } = setUp();
    const ball = playground.addBall(150, 50);
    for (let t = 0; t < 1; t += 1 / 60) playground.step(1 / 60);
    expect(ball.position.y).toBeGreaterThan(200);
  });

  it("are rubbed out at their edge, not inside", () => {
    const { playground } = setUp();
    playground.eraseAt(150, 100, 18);
    expect(playground.noDraw.all).toHaveLength(1);
    playground.eraseAt(105, 100, 18);
    expect(playground.noDraw.all).toHaveLength(0);
  });
});
