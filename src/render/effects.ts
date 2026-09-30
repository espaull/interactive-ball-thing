import { BALL_COLORS, BUBBLE_COLORS, HEART_BURST_COLORS } from "../palette";
import { heartPath } from "./heart";

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
  color: string;
  age: number;
  life: number;
}

// A scrap of confetti: a little spinning rectangle.
interface Confetti {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  color: string;
  age: number;
  life: number;
}

// A little heart from a collected heart bursting: like confetti, but
// floatier, and it grows then shrinks as it fades.
interface LittleHeart {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  angle: number;
  spin: number;
  color: string;
  age: number;
  life: number;
}

const CONFETTI_GRAVITY = 500; // px/s²
const HEART_GRAVITY = 250; // px/s², so they drift down gently
const HEART_DRAG = 2; // per second, slowing them as they spread

const DROPLET_GRAVITY = 300; // px/s², a light fall so the spray arcs
const RING_LIFE = 0.18;
const RING_GROWTH = 0.6; // grows to 1.6× the bubble's size

export class Effects {
  readonly droplets: Droplet[] = [];
  readonly rings: Ring[] = [];
  readonly confetti: Confetti[] = [];
  readonly hearts: LittleHeart[] = [];

  // A bubble bursting, or with `colors` for its droplets, anything else.
  pop(
    x: number,
    y: number,
    radius: number,
    // (The bubble colours' last one is the first again.)
    colors: readonly string[] = BUBBLE_COLORS.slice(0, -1),
  ): void {
    this.rings.push({
      x,
      y,
      radius,
      color: "#ffffff",
      age: 0,
      life: RING_LIFE,
    });

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
        color: colors[i % colors.length],
        age: 0,
        life: 0.4 + Math.random() * 0.3,
      });
    }
  }

  // A coloured ring flashing outwards, e.g. where something goes through a
  // portal.
  flash(x: number, y: number, radius: number, color: string): void {
    this.rings.push({ x, y, radius, color, age: 0, life: RING_LIFE * 1.5 });
  }

  // A burst of confetti shooting up out of (x, y), e.g. from a goal cup.
  celebrate(x: number, y: number): void {
    for (let i = 0; i < 30; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const speed = 200 + Math.random() * 250;
      this.confetti.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        angle: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 20,
        color: BALL_COLORS[i % BALL_COLORS.length],
        age: 0,
        life: 0.9 + Math.random() * 0.5,
      });
    }
  }

  // A burst of little hearts flying out in every direction from (x, y), for
  // collecting a heart.
  heartBurst(x: number, y: number): void {
    const count = 14;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 150 + Math.random() * 150;
      this.hearts.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        // A little lift, so the burst blooms upwards.
        vy: Math.sin(angle) * speed - 80,
        size: 4 + Math.random() * 4,
        angle: (Math.random() - 0.5) * 0.6,
        spin: (Math.random() - 0.5) * 4,
        color: HEART_BURST_COLORS[i % HEART_BURST_COLORS.length],
        age: 0,
        life: 0.8 + Math.random() * 0.5,
      });
    }
    this.rings.push({
      x,
      y,
      radius: 14,
      color: HEART_BURST_COLORS[0],
      age: 0,
      life: RING_LIFE * 1.5,
    });
  }

  update(dt: number): void {
    for (const h of this.hearts) {
      h.age += dt;
      const drag = Math.exp(-HEART_DRAG * dt);
      h.vx *= drag;
      h.vy = h.vy * drag + HEART_GRAVITY * dt;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.angle += h.spin * dt;
    }
    removeExpired(this.hearts);
    for (const c of this.confetti) {
      c.age += dt;
      c.vy += CONFETTI_GRAVITY * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.angle += c.spin * dt;
    }
    removeExpired(this.confetti);
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
    this.confetti.length = 0;
    this.hearts.length = 0;
    this.rings.length = 0;
  }

  draw(ctx: CanvasRenderingContext2D, zoom: number): void {
    for (const r of this.rings) {
      const t = r.age / r.life;
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = r.color;
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
    for (const c of this.confetti) {
      // Fades out only at the very end.
      ctx.globalAlpha = Math.min(1, (c.life - c.age) * 4);
      ctx.fillStyle = c.color;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angle);
      ctx.fillRect(-4, -2, 8, 4);
      ctx.restore();
    }
    for (const h of this.hearts) {
      const t = h.age / h.life;
      ctx.globalAlpha = Math.min(1, (1 - t) * 3);
      // Pops up to full size quickly, then shrinks away.
      const size = h.size * Math.min(1, t * 8) * (1 - t * 0.5);
      ctx.fillStyle = h.color;
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.angle);
      heartPath(ctx, 0, 0, size);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}

function removeExpired(list: { age: number; life: number }[]): void {
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].age >= list[i].life) list.splice(i, 1);
  }
}
