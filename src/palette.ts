// Colours used across the playground. (Background pattern colours live with
// each pattern in render/backgrounds.ts; the toolbar's are in style.css.)

// Drawn lines, and the grey preview of a line being drawn.
export const LINE_COLOR = "#2b2b2b";
export const PREVIEW_COLOR = "#6b7280";

// Highlights: line-end rings, curve points and the "following" ring. Some
// uses add a two-digit alpha, e.g. `${ACCENT}99`.
export const ACCENT = "#3b82f6";
export const ERASER_COLOR = "#ef4444";

// Boost strips: a warm orange band with light chevrons running along it.
export const BOOST_COLOR = "#fb923c";
export const BOOST_CHEVRON_COLOR = "#fff7ed";

// Balls get one of these at random.
export const BALL_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
];

// Soap-film colours for bubble rims and pop splashes, looping back to the start.
export const BUBBLE_COLORS = [
  "#ffb3d9",
  "#c9b3ff",
  "#a8d8ff",
  "#b3f5d1",
  "#fff0a8",
  "#ffb3d9",
];

// Each new pair of portals gets the next of these, so pairs are easy to tell
// apart.
export const PORTAL_COLORS = [
  "#a855f7",
  "#14b8a6",
  "#f97316",
  "#ec4899",
  "#3b82f6",
  "#84cc16",
];

// Goal cups: gold, with a lighter shine.
export const CUP_COLOR = "#f59e0b";
export const CUP_SHINE = "#fde68a";

// Hearts to collect in a level, and the little ones they burst into.
export const HEART_COLOR = "#f43f5e";
export const HEART_SHINE = "#ffe4e6";
export const HEART_BURST_COLORS = ["#f43f5e", "#ec4899", "#fb7185", "#f472b6"];

// Cannons: a dark slate barrel on a wooden wheel.
export const CANNON_COLOR = "#334155";
export const CANNON_WHEEL = "#92400e";

// Rocks: grey stone, lighter on top, with a darker edge.
export const ROCK_TOP = "#b8b2ac";
export const ROCK_BOTTOM = "#78716c";
export const ROCK_EDGE = "#57534e";

// Spikes: pale steel points on a dark strip.
export const SPIKE_COLOR = "#e2e8f0";
export const SPIKE_EDGE = "#475569";

// No-drawing areas: red stripes inside a dashed red edge. Drawn with an
// alpha added, e.g. `${NO_DRAW_COLOR}40`.
export const NO_DRAW_COLOR = "#ef4444";
