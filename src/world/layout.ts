import { parseBoosts, type SavedBoosts } from "./boosts";
import { parseCannons, type SavedCannons } from "./cannons";
import { parseCups, type SavedCups } from "./cups";
import { parseLines, type SavedLines } from "./lines";
import { parsePortals, type SavedPortals } from "./portals";
import { parseRocks, type SavedRocks } from "./rocks";
import { isRecord } from "./saved";
import { parseSpikes, type SavedSpikes } from "./spikes";

// Everything that makes up a playground's design, as plain data that can be
// saved and loaded: each part's things (see part.ts). Balls and bubbles
// aren't included, so a loaded playground starts clean. Positions in pixels.
export interface Layout {
  version: 1;
  lines: SavedLines;
  boosts: SavedBoosts;
  portals: SavedPortals;
  cups: SavedCups;
  cannons: SavedCannons;
  rocks: SavedRocks;
  spikes: SavedSpikes;
}

export function emptyLayout(): Layout {
  return {
    version: 1,
    lines: [],
    boosts: [],
    portals: [],
    cups: [],
    cannons: [],
    rocks: [],
    spikes: [],
  };
}

// A layout read back from storage, or null if it isn't one (from a newer
// version, say, or damaged). Each part reads its own things, skipping
// anything malformed rather than losing the whole save. Saves from before a
// part existed just don't have it, which reads as none.
export function parseLayout(data: unknown): Layout | null {
  if (!isRecord(data) || data.version !== 1) return null;
  return {
    version: 1,
    lines: parseLines(data.lines),
    boosts: parseBoosts(data.boosts),
    portals: parsePortals(data.portals),
    cups: parseCups(data.cups),
    cannons: parseCannons(data.cannons),
    rocks: parseRocks(data.rocks),
    spikes: parseSpikes(data.spikes),
  };
}
