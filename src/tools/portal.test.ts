import { describe, expect, it } from "vitest";
import { Playground } from "../world/playground";
import { PortalTool } from "./portal";
import type { ToolContext } from "./tool";

function setUp() {
  const playground = new Playground();
  const ctx = { playground, camera: { zoom: 1 } } as unknown as ToolContext;
  return { playground, tool: new PortalTool(ctx) };
}

function tap(tool: PortalTool, x: number, y: number): void {
  tool.down({ x, y });
  tool.up();
}

function drag(
  tool: PortalTool,
  x: number,
  y: number,
  toX: number,
  toY: number,
) {
  tool.down({ x, y });
  tool.move({ x: toX, y: toY });
  tool.up();
}

describe("portal tool", () => {
  it("places unaimed pairs with taps", () => {
    const { playground, tool } = setUp();
    tap(tool, 100, 100);
    expect(playground.portalPairs).toHaveLength(0);
    tap(tool, 500, 100);
    const [pair] = playground.portalPairs;
    expect(pair.a).toEqual({ x: 100, y: 100, aim: null });
    expect(pair.b).toEqual({ x: 500, y: 100, aim: null });
  });

  it("aims each portal the way it's dragged as it's placed", () => {
    const { playground, tool } = setUp();
    drag(tool, 100, 100, 100, 50); // up
    drag(tool, 500, 100, 450, 100); // left
    const [pair] = playground.portalPairs;
    expect(pair.a.aim).toBeCloseTo(-Math.PI / 2);
    expect(pair.b.aim).toBeCloseTo(Math.PI);
    expect(pair.b).toMatchObject({ x: 500, y: 100 });
  });

  it("ignores a small wobble while tapping", () => {
    const { playground, tool } = setUp();
    drag(tool, 100, 100, 104, 103);
    tap(tool, 500, 100);
    expect(playground.portalPairs[0].a.aim).toBeNull();
  });

  it("re-aims a placed portal when dragged, and un-aims it when tapped", () => {
    const { playground, tool } = setUp();
    tap(tool, 100, 100);
    tap(tool, 500, 100);
    // Pressing a little off-centre still grabs it.
    drag(tool, 510, 95, 500, 200);
    expect(playground.portalPairs[0].b.aim).toBeCloseTo(Math.PI / 2);
    expect(playground.portalPairs).toHaveLength(1);
    tap(tool, 500, 100);
    expect(playground.portalPairs[0].b.aim).toBeNull();
  });

  it("takes away a waiting portal when it's tapped again", () => {
    const { playground, tool } = setUp();
    tap(tool, 100, 100);
    tap(tool, 110, 100);
    tap(tool, 500, 100);
    // That was a fresh first portal, not a partner.
    expect(playground.portalPairs).toHaveLength(0);
    expect(tool.overlay().portalPending?.end).toMatchObject({ x: 500, y: 100 });
  });
});
