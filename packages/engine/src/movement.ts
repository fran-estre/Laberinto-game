import { BOARD_SIZE, type BoardState, type Direction, type Position } from "./types.js";
import { hasOpening } from "./tiles.js";

const DELTAS: Record<Direction, readonly [number, number]> = {
  N: [-1, 0], E: [0, 1], S: [1, 0], W: [0, -1]
};
const OPPOSITE: Record<Direction, Direction> = { N: "S", E: "W", S: "N", W: "E" };
const DIRECTIONS: Direction[] = ["N", "E", "S", "W"];

const key = (position: Position): string => `${position.row},${position.col}`;
const valid = (position: Position): boolean => position.row >= 0 && position.row < BOARD_SIZE && position.col >= 0 && position.col < BOARD_SIZE;

export function canMove(board: BoardState, from: Position, direction: Direction): boolean {
  if (!valid(from)) return false;
  const [rowDelta, colDelta] = DELTAS[direction];
  const rawTo = { row: from.row + rowDelta, col: from.col + colDelta };
  const to = { row: (rawTo.row + BOARD_SIZE) % BOARD_SIZE, col: (rawTo.col + BOARD_SIZE) % BOARD_SIZE };
  const current = board.tiles[from.row]![from.col]!;
  const target = board.tiles[to.row]![to.col]!;
  return hasOpening(current.shape, current.rotation, direction) && hasOpening(target.shape, target.rotation, OPPOSITE[direction]);
}

export function reachable(board: BoardState, start: Position): Position[] {
  if (!valid(start)) return [];
  const visited = new Set<string>([key(start)]);
  const queue: Position[] = [{ ...start }];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor]!;
    for (const direction of DIRECTIONS) {
      if (!canMove(board, current, direction)) continue;
      const [rowDelta, colDelta] = DELTAS[direction];
      const next = { row: (current.row + rowDelta + BOARD_SIZE) % BOARD_SIZE, col: (current.col + colDelta + BOARD_SIZE) % BOARD_SIZE };
      if (!visited.has(key(next))) { visited.add(key(next)); queue.push(next); }
    }
  }
  return queue;
}

export function findRoute(board: BoardState, start: Position, destination: Position): Position[] | null {
  if (!valid(start) || !valid(destination)) return null;
  const parents = new Map<string, Position | null>([[key(start), null]]);
  const queue: Position[] = [{ ...start }];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor]!;
    if (key(current) === key(destination)) break;
    for (const direction of DIRECTIONS) {
      if (!canMove(board, current, direction)) continue;
      const [rowDelta, colDelta] = DELTAS[direction];
      const next = { row: (current.row + rowDelta + BOARD_SIZE) % BOARD_SIZE, col: (current.col + colDelta + BOARD_SIZE) % BOARD_SIZE };
      if (!parents.has(key(next))) { parents.set(key(next), current); queue.push(next); }
    }
  }
  if (!parents.has(key(destination))) return null;
  const route: Position[] = [];
  let current: Position | null = { ...destination };
  while (current) { route.unshift(current); current = parents.get(key(current)) ?? null; }
  return route;
}

export function movePlayer(board: BoardState, playerId: string, destination: Position): BoardState {
  const player = board.players.find((candidate) => candidate.id === playerId);
  if (!player) throw new Error(`Player not found: ${playerId}`);
  const route = findRoute(board, player.position, destination);
  if (!route) throw new Error("Destination is not reachable");
  const result = structuredClone(board);
  result.players.find((candidate) => candidate.id === playerId)!.position = { ...destination };
  return result;
}
