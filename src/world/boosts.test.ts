import { describe, expect, it } from "vitest";
import { BOOST_HALF_WIDTH_PX, BoostZone } from "./boosts";

describe("BoostZone.directionAt", () => {
  // Painted left to right, then turning to head straight down.
  const zone = new BoostZone([
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ]);

  it("points the way the strip was painted", () => {
    expect(zone.directionAt({ x: 50, y: 5 })).toEqual({ x: 1, y: 0 });
  });

  it("follows the strip round a corner", () => {
    expect(zone.directionAt({ x: 105, y: 60 })).toEqual({ x: 0, y: 1 });
  });

  it("counts anywhere within the strip's width", () => {
    expect(
      zone.directionAt({ x: 50, y: BOOST_HALF_WIDTH_PX - 1 }),
    ).not.toBeNull();
    expect(
      zone.directionAt({ x: 50, y: -(BOOST_HALF_WIDTH_PX - 1) }),
    ).not.toBeNull();
  });

  it("is null off the strip", () => {
    expect(zone.directionAt({ x: 50, y: BOOST_HALF_WIDTH_PX + 1 })).toBeNull();
    expect(zone.directionAt({ x: 500, y: 500 })).toBeNull();
  });
});
