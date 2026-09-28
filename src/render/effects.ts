import { BUBBLE_COLORS } from "../palette";

// Purely visual particles (not physics bodies), in world pixels.
interface Droplet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  age: number;
  life: number;
}

// The quick flash of the bubble's skin snapping outwards.
interface Ring {
  x: number;
  y: number;
  radius: number;
  age: number;
  life: number;
}

const DROPLET_GRAVITY = 300; // px/s², a light fall so the spray arcs
const RING_LIFE = 0.18;
const RING_GROWTH = 0.6; // grows to 1.6× the bubble's size

export class Effects {
  readonly droplets: Droplet[] = [];
  readonly rings: Ring[] = [];

  pop(x: number, y: number, radius: number): void {
    this.rings.push({ x, y, radius, age: 0, life: RING_LIFE });

    const count = 10 + Math.round(radius / 3);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 60 + Math.random() * 110;
      this.droplets.push({
        // Start on the bubble's edge and fly outwards.
        x: x + Math.cos(angle) * radius,
        y: y + Math.sin(angle) * radius,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 1.5 + Math.random() * 2,
        color: BUBBLE_COLORS[i % (BUBBLE_COLORS.length - 1)],
        age: 0,
        life: 0.4 + Math.random() * 0.3,
      });
    }
  }

  update(dt: number): void {
    for (const d of this.droplets) {
      d.age += dt;
      d.vy += DROPLET_GRAVITY * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
    }
    for (const r of this.rings) r.age += dt;
    removeExpired(this.droplets);
    removeExpired(this.rings);
  }

  clear(): void {
    this.droplets.length = 0;
    this.rings.length = 0;
  }

  draw(ctx: CanvasRenderingContext2D, zoom: number): void {
    for (const r of this.rings) {
      const t = r.age / r.life;
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.5 / zoom;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius * (1 + RING_GROWTH * t), 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const d of this.droplets) {
      const t = d.age / d.life;
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.radius * (1 - t * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function removeExpired(list: { age: number; life: number }[]): void {
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].age >= list[i].life) list.splice(i, 1);
  }
}
