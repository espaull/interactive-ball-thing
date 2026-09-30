import type { Point } from "../geometry/point";
import { Playground, Sledge, type Ball } from "./playground";

// How far ahead to look, in seconds. Further than this, small differences
// between the copy and the real thing add up, and it drifts.
export const PREDICTION_SECONDS = 1.5;
const STEP = 1 / 60;

// Where a ball (or sledge) will go next, as the stretches of its path (a
// new stretch starts after each trip through a portal). Worked out by running a hidden
// copy of the playground, with the same design and just this ball, so it
// includes bounces, boosts and portals, and stops where a cup catches it.
// Other balls, bubbles and cannons (whose shots would be made up) aren't in
// the copy.
export function predictPath(
  playground: Playground,
  ball: Ball,
  seconds = PREDICTION_SECONDS,
): Point[][] {
  const copy = new Playground();
  copy.world.setGravity(playground.world.getGravity());
  copy.loadLayout({ ...playground.layout(), cannons: [] });

  const { x, y } = ball.position;
  const twin =
    ball instanceof Sledge ? copy.addSledge(x, y) : copy.addBall(x, y);
  twin.body.setTransform(twin.body.getPosition(), ball.body.getAngle());
  twin.body.setLinearVelocity(ball.body.getLinearVelocity());
  twin.body.setAngularVelocity(ball.body.getAngularVelocity());

  const path: Point[][] = [[twin.position]];
  copy.onTeleport = () => path.push([]);
  for (let t = 0; t < seconds; t += STEP) {
    copy.step(STEP);
    // Caught by a cup.
    if (!copy.contains(twin)) break;
    path.at(-1)!.push(twin.position);
  }
  return path.filter((stretch) => stretch.length > 0);
}
