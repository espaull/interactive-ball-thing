// Tiling background patterns. Each one draws a single square tile; the tile is
// repeated across the world with a canvas pattern, so every design has to wrap
// cleanly at its edges.

export interface Background {
  name: string;
  size: number; // tile size in world pixels
  base: string;
  draw(ctx: CanvasRenderingContext2D, size: number): void;
}

// Draw a shape at the 9 positions around the tile, so anything poking over one
// edge reappears on the opposite edge and the tile wraps without seams.
function wrapped(
  ctx: CanvasRenderingContext2D,
  size: number,
  fn: () => void,
): void {
  for (const dx of [-size, 0, size]) {
    for (const dy of [-size, 0, size]) {
      ctx.save();
      ctx.translate(dx, dy);
      fn();
      ctx.restore();
    }
  }
}

function dot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// Small deterministic random generator, so scattered patterns look the same
// every time.
function seeded(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function star(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const radius = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
  ctx.closePath();
  ctx.fill();
}

export const BACKGROUNDS: Background[] = [
  {
    name: "Paper",
    size: 40,
    base: "#fdfbf5",
    draw(ctx) {
      ctx.fillStyle = "#e4dfd2";
      dot(ctx, 20, 20, 1.3);
    },
  },
  {
    name: "Graph",
    size: 120,
    base: "#eef6fb",
    draw(ctx, size) {
      // Lines sit half a gap in from the edges, so none are cut in half.
      for (let i = 0; i < 5; i++) {
        const p = 12 + i * 24;
        ctx.fillStyle = i === 0 ? "#c9dfee" : "#dcebf5";
        const w = i === 0 ? 2 : 1;
        ctx.fillRect(p - w / 2, 0, w, size);
        ctx.fillRect(0, p - w / 2, size, w);
      }
    },
  },
  {
    name: "Polka",
    size: 60,
    base: "#fdeaf0",
    draw(ctx) {
      ctx.fillStyle = "#f8d3df";
      dot(ctx, 15, 15, 6);
      dot(ctx, 45, 45, 6);
    },
  },
  {
    name: "Stripes",
    size: 60,
    base: "#e8f6ec",
    draw(ctx, size) {
      // 45° stripes every 30px: the period divides the tile, so they meet up.
      ctx.strokeStyle = "#d4eedc";
      ctx.lineWidth = 10;
      for (let c = -size; c <= size * 2; c += 30) {
        ctx.beginPath();
        ctx.moveTo(c, -10);
        ctx.lineTo(c - size - 20, size + 10);
        ctx.stroke();
      }
    },
  },
  {
    name: "Waves",
    size: 80,
    base: "#f1ecfb",
    draw(ctx, size) {
      // One full wave per tile width, so the ends join up.
      ctx.strokeStyle = "#e0d6f5";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      for (let row = 10; row < size; row += 20) {
        ctx.beginPath();
        for (let x = -4; x <= size + 4; x += 2) {
          ctx.lineTo(x, row + Math.sin((x / size) * Math.PI * 2) * 5);
        }
        ctx.stroke();
      }
    },
  },
  {
    name: "Gingham",
    size: 40,
    base: "#fff3ea",
    draw(ctx, size) {
      // Translucent bands overlap into the darker squares of a gingham check.
      ctx.fillStyle = "#fbdcc880";
      ctx.fillRect(0, 0, size / 2, size);
      ctx.fillRect(0, 0, size, size / 2);
    },
  },
  {
    name: "Stars",
    size: 160,
    base: "#fff8e4",
    draw(ctx, size) {
      const colors = ["#fde2a8", "#f9d4d4", "#d5e8f7", "#d8f0dc", "#e6dcf7"];
      const rand = seeded(7);
      for (let i = 0; i < 12; i++) {
        const x = rand() * size;
        const y = rand() * size;
        const r = 3 + rand() * 4;
        const color = colors[i % colors.length];
        const isStar = i % 3 === 0;
        wrapped(ctx, size, () => {
          ctx.fillStyle = color;
          if (isStar) star(ctx, x, y, r + 2);
          else dot(ctx, x, y, r * 0.6);
        });
      }
    },
  },
];

// Draw one tile at `scale` canvas pixels per world pixel.
export function makeTile(bg: Background, scale: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.max(1, Math.round(bg.size * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.scale(canvas.width / bg.size, canvas.height / bg.size);
  ctx.fillStyle = bg.base;
  ctx.fillRect(0, 0, bg.size, bg.size);
  bg.draw(ctx, bg.size);
  return canvas;
}

// Patterns are cached per background and resolution. The resolution follows
// the zoom in powers of two, so zooming out doesn't shrink a big tile down
// (which shimmers) and zooming in doesn't blur a small one.
const patternCache = new Map<string, CanvasPattern>();

export function getPattern(
  ctx: CanvasRenderingContext2D,
  bg: Background,
  zoom: number,
  dpr: number,
): CanvasPattern {
  const scale = dpr * 2 ** Math.ceil(Math.log2(zoom));
  const key = `${bg.name}@${scale}`;
  let pattern = patternCache.get(key);
  if (!pattern) {
    const tile = makeTile(bg, scale);
    pattern = ctx.createPattern(tile, "repeat")!;
    // Map the tile's pixels back to world pixels.
    pattern.setTransform(new DOMMatrix().scale(bg.size / tile.width));
    patternCache.set(key, pattern);
  }
  return pattern;
}
