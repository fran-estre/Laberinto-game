import type { Direction, Rotation, TileShape } from "./types.js";

const BASE_OPENINGS: Record<TileShape, Direction[]> = {
  I: ["N", "S"], L: ["N", "E"], T: ["N", "E", "W"], CROSS: ["N", "E", "S", "W"]
};
const ORDER: Direction[] = ["N", "E", "S", "W"];

export function rotateOpenings(shape: TileShape, rotation: Rotation): Direction[] {
  const turns = rotation / 90;
  return BASE_OPENINGS[shape].map((opening) => ORDER[(ORDER.indexOf(opening) + turns) % 4]!);
}

export function hasOpening(shape: TileShape, rotation: Rotation, direction: Direction): boolean {
  return rotateOpenings(shape, rotation).includes(direction);
}

export function nextRotation(rotation: Rotation, quarterTurns = 1): Rotation {
  return ((rotation + quarterTurns * 90) % 360 + 360) % 360 as Rotation;
}
