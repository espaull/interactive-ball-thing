import type { Point } from "../geometry/point";
import { catmullRom } from "../geometry/spline";
import { LINE_SPACING_PX } from "../geometry/stroke";
import type { Level } from "./level";

// Straight lines through points given as [x, y] pairs.
function path(...points: [number, number][]): Point[] {
  return points.map(([x, y]) => ({ x, y }));
}

// A smooth curve through points given as [x, y] pairs.
function curve(...points: [number, number][]): Point[] {
  return catmullRom(path(...points), LINE_SPACING_PX);
}

// A pigtail loop-the-loop: in along a floor at y = `floor`, round the
// loop (crossing its own track on the way in and out) and out along the
// floor to the right. Its top is 2 × `size` above the floor.
function loop(x: number, floor: number, size: number): Point[] {
  const points: Point[] = [];
  const along = size / 3;
  for (let i = 0; i <= 120; i++) {
    const t = (i / 120) * 2 * Math.PI;
    points.push({
      x: x + along * t + size * Math.sin(t),
      y: floor - size + size * Math.cos(t),
    });
  }
  return points;
}

// The levels, in order. Each is proven finishable, with every heart, by
// levels.test.ts.
export const LEVELS: Level[] = [
  {
    id: "first-line",
    name: "First line",
    tip: "Draw a line to get the ball into the cup",
    rider: "ball",
    start: { x: 90, y: 152 },
    goal: { x: 760, y: 470 },
    hearts: [
      { x: 380, y: 250 },
      { x: 510, y: 312 },
      { x: 640, y: 374 },
    ],
    pieces: {
      lines: [
        path([50, 160], [240, 210]),
        // A wall behind the cup, to stop the ball flying past.
        path([800, 330], [800, 508], [700, 508]),
      ],
    },
    limits: { ink: 800 },
  },
  {
    id: "mind-the-gap",
    name: "Mind the gap",
    tip: "Not much ink this time · watch it run down as you draw",
    rider: "ball",
    start: { x: 80, y: 121 },
    goal: { x: 850, y: 466 },
    hearts: [
      { x: 370, y: 212 },
      { x: 560, y: 318 },
      { x: 700, y: 380 },
    ],
    pieces: {
      lines: [
        path([40, 130], [300, 190]),
        path([440, 280], [818, 442]),
        path([890, 330], [890, 504], [810, 504]),
      ],
    },
    limits: { ink: 220 },
  },
  {
    id: "boost",
    name: "Boost",
    tip: "Paint a boost along the track to send the ball up the hill",
    rider: "ball",
    start: { x: 100, y: 463 },
    goal: { x: 832, y: 324 },
    hearts: [
      { x: 300, y: 450 },
      { x: 620, y: 360 },
      { x: 760, y: 270 },
    ],
    pieces: {
      lines: [
        curve(
          [40, 480],
          [300, 480],
          [450, 470],
          [580, 420],
          [680, 340],
          [740, 302],
          [800, 300],
        ),
        path([864, 300], [960, 300], [960, 190]),
      ],
    },
    limits: { boost: 300 },
  },
  {
    id: "sledge-run",
    name: "Sledge run",
    tip: "Sledges slide fast! Draw a way across to the cup",
    rider: "sledge",
    start: { x: 70, y: 112 },
    goal: { x: 820, y: 440 },
    hearts: [
      { x: 300, y: 230 },
      { x: 560, y: 370 },
      { x: 700, y: 390 },
    ],
    pieces: {
      lines: [
        curve([30, 110], [150, 135], [300, 250], [420, 360], [470, 380]),
        // The cup's pillar, and a wall behind it.
        path([820, 478], [820, 700]),
        path([860, 330], [860, 470]),
      ],
    },
    limits: { ink: 500 },
  },
  {
    id: "portal",
    name: "Portal",
    tip: "The cup's shut in! Put a portal where the ball rolls, and its partner in the box",
    rider: "ball",
    start: { x: 70, y: 155 },
    goal: { x: 860, y: 268 },
    hearts: [
      { x: 200, y: 205 },
      { x: 560, y: 285 },
      { x: 860, y: 200 },
    ],
    pieces: {
      lines: [
        curve([40, 170], [200, 230], [330, 300], [450, 310], [700, 310]),
        path([700, 230], [700, 310]),
        // The box, with a funnel into the cup.
        path([760, 244], [760, 60], [960, 60], [960, 244]),
        path([760, 220], [828, 244]),
        path([892, 244], [960, 220]),
      ],
    },
    limits: { portals: 1 },
  },
  {
    id: "loop",
    name: "Loop the loop",
    tip: "Boost the ball fast enough to go all the way round",
    rider: "ball",
    start: { x: 70, y: 378 },
    goal: { x: 800, y: 544 },
    hearts: [
      { x: 300, y: 495 },
      { x: 546, y: 300 },
      { x: 720, y: 495 },
    ],
    pieces: {
      lines: [
        [
          ...curve([40, 390], [150, 450], [250, 510], [330, 520]),
          ...loop(420, 520, 120).slice(1),
          { x: 768, y: 520 },
        ],
        path([840, 420], [840, 580], [760, 580]),
      ],
    },
    limits: { boost: 250 },
  },
  {
    id: "up-to-the-shelf",
    name: "Up to the shelf",
    tip: "Build a ramp up to the cup, and boost the sledge up it",
    rider: "sledge",
    start: { x: 60, y: 190 },
    goal: { x: 832, y: 244 },
    hearts: [
      { x: 300, y: 330 },
      { x: 620, y: 350 },
      { x: 835, y: 150 },
    ],
    pieces: {
      lines: [
        curve([30, 195], [200, 300], [380, 420], [450, 430]),
        path([720, 600], [720, 220], [800, 220]),
        // Past the cup, the shelf slopes back down into it.
        path([864, 220], [960, 196], [960, 60]),
      ],
    },
    limits: { ink: 400, boost: 100 },
  },
  {
    id: "grand-tour",
    name: "Grand tour",
    tip: "Use everything you've learned!",
    rider: "ball",
    start: { x: 70, y: 100 },
    goal: { x: 840, y: 264 },
    hearts: [
      { x: 305, y: 215 },
      { x: 500, y: 410 },
      { x: 680, y: 345 },
    ],
    pieces: {
      lines: [
        path([40, 110], [220, 150]),
        curve([420, 360], [500, 430], [600, 435], [690, 380]),
        // The cup's shut in a box, with a funnel into it.
        path([740, 240], [740, 60], [940, 60], [940, 240]),
        path([740, 216], [808, 240]),
        path([872, 240], [940, 216]),
      ],
    },
    limits: { ink: 320, boost: 100, portals: 1 },
  },
];
