import { BOARD_SIZE, type BoardState, type Insertion, type PlayerToken, type Position, type Rotation, type Tile, type TileShape } from "./types.js";
import { nextRotation } from "./tiles.js";

const INSERTABLE = [1, 3, 5, 7] as const;
const SHAPES: TileShape[] = ["I", "L", "T"];
const fixed = (row: number, col: number) => row % 2 === 0 && col % 2 === 0;
function fixedRotation(row: number, col: number): Rotation {
  if (row === 0 && col === 0) return 90;
  if (row === 0 && col === BOARD_SIZE - 1) return 180;
  if (row === BOARD_SIZE - 1 && col === 0) return 0;
  if (row === BOARD_SIZE - 1 && col === BOARD_SIZE - 1) return 270;
  return ((row + col) % 4 * 90) as Rotation;
}
const corner = (row: number, col: number) => (row === 0 || row === BOARD_SIZE - 1) && (col === 0 || col === BOARD_SIZE - 1);
const clone = <T>(value: T): T => structuredClone(value);

export interface GenerateOptions {
  seed?: number;
  objectIds?: string[];
  excludedObjectPositions?: Position[];
  objectiveBalanceMargin?: number;
}

export const OBJECTIVE_ZONE_COUNT = 4 as const;
export type ObjectiveZone = 0 | 1 | 2 | 3;

/** Divide el tablero en cuatro cuadrantes, asignando la fila y columna centrales al lado inferior/derecho. */
export function objectiveZone(position: Position): ObjectiveZone {
  const rowHalf = position.row < BOARD_SIZE / 2 ? 0 : 1;
  const colHalf = position.col < BOARD_SIZE / 2 ? 0 : 1;
  return (rowHalf * 2 + colHalf) as ObjectiveZone;
}

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 0x100000000; };
}

export function generateBoard(options: GenerateOptions = {}): BoardState {
  const next = random(options.seed ?? Date.now());
  let id = 0;
  const tiles: Tile[][] = [];
  const objectIds = [...(options.objectIds ?? [])];
  const excludedObjects = new Set((options.excludedObjectPositions ?? []).map((position) => `${position.row},${position.col}`));
  const objectPositions = distributeObjectPositions(objectIds.length, excludedObjects, next, options.objectiveBalanceMargin ?? 1);
  const objectsByPosition = new Map(objectPositions.map((position, index) => [`${position.row},${position.col}`, objectIds[index]!]))
  for (let row = 0; row < BOARD_SIZE; row++) {
    const line: Tile[] = [];
    for (let col = 0; col < BOARD_SIZE; col++) {
      const isFixed = fixed(row, col);
      const isCorner = corner(row, col);
      line.push({
        id: `tile-${id++}`,
        shape: isCorner ? "L" : SHAPES[Math.floor(next() * SHAPES.length)]!,
        rotation: isCorner ? fixedRotation(row, col) : (Math.floor(next() * 4) * 90) as Rotation,
        fixed: isFixed,
        objectId: objectsByPosition.get(`${row},${col}`)
      });
    }
    tiles.push(line);
  }
  return { tiles, spare: { id: `tile-${id}`, shape: SHAPES[Math.floor(next() * SHAPES.length)]!, rotation: 0, fixed: false }, players: [] };
}

function distributeObjectPositions(count: number, excludedObjects: Set<string>, next: () => number, margin: number): Position[] {
  if (!Number.isInteger(margin) || margin < 0) throw new Error("Objective balance margin must be a non-negative integer");
  if (count === 0) return [];

  const candidates: Position[][] = [[], [], [], []];
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (!excludedObjects.has(`${row},${col}`)) candidates[objectiveZone({ row, col })]!.push({ row, col });
    }
  }
  if (count > candidates.reduce((total, zone) => total + zone.length, 0)) throw new Error("Not enough valid cells for all objectives");

  for (const zone of candidates) shuffle(zone, next);
  const selected: Position[] = [];
  const counts = [0, 0, 0, 0];
  for (let index = 0; index < count; index++) {
    const availableZones = candidates
      .map((zone, zoneIndex) => ({ zone, zoneIndex }))
      .filter(({ zone }) => zone.length > 0)
      .sort((a, b) => counts[a.zoneIndex]! - counts[b.zoneIndex]! || a.zoneIndex - b.zoneIndex);
    const least = counts[availableZones[0]!.zoneIndex]!;
    const balancedZones = availableZones.filter(({ zoneIndex }) => counts[zoneIndex]! < least + margin);
    const pool = balancedZones.length > 0 ? balancedZones : availableZones;
    const chosen = pool[Math.floor(next() * pool.length)]!;
    selected.push(chosen.zone.shift()!);
    counts[chosen.zoneIndex]! += 1;
  }
  return selected;
}

function shuffle<T>(items: T[], next: () => number): void {
  for (let index = items.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(next() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex]!, items[index]!];
  }
}

export function rotateSpare(board: BoardState, quarterTurns = 1): BoardState {
  const result = clone(board);
  result.spare.rotation = nextRotation(result.spare.rotation, quarterTurns);
  return result;
}

function movePosition(position: Position, insertion: Insertion): Position {
  if (insertion.axis === "row" && position.row === insertion.index) {
    return { row: position.row, col: insertion.from === "left" ? (position.col + 1) % BOARD_SIZE : (position.col + BOARD_SIZE - 1) % BOARD_SIZE };
  }
  if (insertion.axis === "column" && position.col === insertion.index) {
    return { row: insertion.from === "top" ? (position.row + 1) % BOARD_SIZE : (position.row + BOARD_SIZE - 1) % BOARD_SIZE, col: position.col };
  }
  return { ...position };
}

export function insert(board: BoardState, insertion: Insertion): BoardState {
  if (!INSERTABLE.includes(insertion.index)) throw new Error("Insertion point must be odd and between 1 and 7");
  const result = clone(board);
  const line = insertion.axis === "row" ? result.tiles[insertion.index]! : result.tiles.map((row) => row[insertion.index]!);
  const entering = result.spare;
  const expelled = insertion.from === "left" || insertion.from === "top" ? line[BOARD_SIZE - 1]! : line[0]!;
  const shifted = insertion.from === "left" || insertion.from === "top" ? [entering, ...line.slice(0, -1)] : [...line.slice(1), entering];
  if (insertion.axis === "row") result.tiles[insertion.index] = shifted;
  else shifted.forEach((tile, row) => { result.tiles[row]![insertion.index] = tile; });
  result.spare = expelled;
  result.players = result.players.map((player) => ({ ...player, position: movePosition(player.position, insertion) }));
  return result;
}

export function addPlayer(board: BoardState, player: PlayerToken): BoardState {
  const result = clone(board); result.players.push(player); return result;
}

export function isFixedPosition(row: number, col: number): boolean { return fixed(row, col); }
