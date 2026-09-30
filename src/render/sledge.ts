import { LINE_COLOR } from "../palette";
import type { Sledge } from "../world/playground";

// A sledge and its rider, in homage to Line Rider: a seat in the sledge's
// colour on a runner that curls up at the front, and a stick-figure rider
// holding a rope to the curl, with a scarf (the same colour) streaming out
// behind that flaps harder the faster it goes. The physics is only the
// sledge (48 × 12px, centred on its position); the rider is just drawn.
export function drawSledge(
  ctx: CanvasRenderingContext2D,
  sledge: Sledge,
  time: number,
): void {
  const { x, y } = sledge.position;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sledge.angle);
  // Turned round, the whole thing is drawn mirrored along the sledge.
  ctx.scale(sledge.facing, 1);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Struts, then the runner, curling up at the front.
  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-8, -2);
  ctx.lineTo(-8, 4.5);
  ctx.moveTo(12, -2);
  ctx.lineTo(12, 4.5);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-22, 4.5);
  ctx.lineTo(16, 4.5);
  ctx.quadraticCurveTo(26, 4.5, 25, -3.5);
  ctx.quadraticCurveTo(24, -8.5, 19, -6.5);
  ctx.stroke();

  // The seat, with a couple of plank lines.
  ctx.fillStyle = sledge.color;
  ctx.beginPath();
  ctx.roundRect(-24, -7.5, 40, 6, 3);
  ctx.fill();
  ctx.strokeStyle = "#00000030";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-10, -7.5);
  ctx.lineTo(-10, -1.5);
  ctx.moveTo(4, -7.5);
  ctx.lineTo(4, -1.5);
  ctx.stroke();

  // The scarf, from the neck back, waving more towards its tip.
  const flap = 0.4 + Math.min(sledge.speed / 400, 1);
  ctx.strokeStyle = sledge.color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-5, -25.5);
  for (let i = 1; i <= 4; i++) {
    const wave = Math.sin(time * 14 - i * 1.3) * 2.2 * flap * (i / 4);
    ctx.lineTo(-5 - i * 5, -25.5 + i * 1.5 + wave);
  }
  ctx.stroke();

  // The rider: body, legs bent up to the front of the seat, and an arm out
  // to the rope.
  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-10, -8.5);
  ctx.lineTo(-5, -25.5);
  ctx.moveTo(-10, -8.5);
  ctx.lineTo(4, -14.5);
  ctx.lineTo(10, -8.5);
  ctx.moveTo(-6, -21.5);
  ctx.lineTo(14, -13.5);
  ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(14, -13.5);
  ctx.lineTo(20, -6.5);
  ctx.stroke();

  // Head, with an eye looking ahead.
  ctx.fillStyle = "#ffffff";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(-3, -32.5, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = LINE_COLOR;
  ctx.beginPath();
  ctx.arc(0, -33.5, 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
