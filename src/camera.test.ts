import { describe, expect, it } from "vitest";
import { Camera } from "./camera";
import type { Point } from "./geometry/point";

function camera(): Camera {
  const c = new Camera();
  c.resize(400, 800);
  return c;
}

// Where a world point appears on screen.
function onScreen(c: Camera, p: Point): Point {
  return {
    x: (p.x - c.x) * c.zoom + c.width / 2,
    y: (p.y - c.y) * c.zoom + c.height / 2,
  };
}

describe("Camera.pinch", () => {
  it("keeps what was under each finger under it", () => {
    const c = camera();
    const fromA = { x: 150, y: 400 };
    const fromB = { x: 250, y: 400 };
    const underA = c.screenToWorld(fromA.x, fromA.y);
    const underB = c.screenToWorld(fromB.x, fromB.y);
    // Spread apart and drift up and to the right.
    const toA = { x: 120, y: 350 };
    const toB = { x: 320, y: 350 };
    c.pinch(fromA, fromB, toA, toB);
    expect(c.zoom).toBeCloseTo(2);
    expect(onScreen(c, underA).x).toBeCloseTo(toA.x);
    expect(onScreen(c, underA).y).toBeCloseTo(toA.y);
    expect(onScreen(c, underB).x).toBeCloseTo(toB.x);
    expect(onScreen(c, underB).y).toBeCloseTo(toB.y);
  });

  it("zooms out when the fingers pinch together", () => {
    const c = camera();
    c.pinch(
      { x: 100, y: 400 },
      { x: 300, y: 400 },
      { x: 150, y: 400 },
      { x: 250, y: 400 },
    );
    expect(c.zoom).toBeCloseTo(0.5);
  });

  it("just scrolls when both fingers move together", () => {
    const c = camera();
    const before = { x: c.x, y: c.y };
    c.pinch(
      { x: 100, y: 400 },
      { x: 200, y: 400 },
      { x: 100, y: 300 },
      { x: 200, y: 300 },
    );
    expect(c.zoom).toBe(1);
    // Fingers moved up 100px, so the view moved down the world by 100px.
    expect(c.x).toBeCloseTo(before.x);
    expect(c.y).toBeCloseTo(before.y + 100);
  });

  it("stops at the zoom limits", () => {
    const c = camera();
    for (let i = 0; i < 20; i++) {
      c.pinch(
        { x: 190, y: 400 },
        { x: 210, y: 400 },
        { x: 100, y: 400 },
        { x: 300, y: 400 },
      );
    }
    expect(c.zoom).toBe(2);
  });
});

describe("Camera.fit", () => {
  it("shows the whole box between the margins", () => {
    const c = camera();
    const box = { left: 0, top: 0, right: 1000, bottom: 600 };
    const margins = { top: 100, bottom: 60, left: 16, right: 16 };
    c.fit(box, margins);
    const topLeft = onScreen(c, { x: box.left, y: box.top });
    const bottomRight = onScreen(c, { x: box.right, y: box.bottom });
    expect(topLeft.x).toBeCloseTo(16);
    expect(bottomRight.x).toBeCloseTo(384);
    expect(topLeft.y).toBeGreaterThanOrEqual(100 - 1e-9);
    expect(bottomRight.y).toBeLessThanOrEqual(800 - 60 + 1e-9);
    // Centred in the space between the margins.
    c.fit(box, { ...margins, left: 100 });
    expect(onScreen(c, { x: box.left, y: 0 }).x).toBeCloseTo(100);
    expect(onScreen(c, { x: box.right, y: 0 }).x).toBeCloseTo(384);
    c.fit(box, margins);
    expect((topLeft.y + bottomRight.y) / 2).toBeCloseTo((100 + 740) / 2);
  });

  it("is what Home shows, while there's a home view", () => {
    const c = camera();
    const box = { left: 0, top: 0, right: 100, bottom: 100 };
    const margins = { top: 0, bottom: 0, left: 0, right: 0 };
    c.homeView = { box, margins };
    c.home();
    // Small boxes aren't blown up hugely.
    expect(c.zoom).toBe(1.25);
    expect(c.x).toBe(50);
    c.homeView = null;
    c.home();
    expect(c.zoom).toBe(1);
  });
});
