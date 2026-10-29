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

export interface GenerateOptions { seed?: number; objectIds?: string[]; excludedObjectPositions?: Position[] }

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 0x100000000; };
}

export function generateBoard(options: GenerateOptions = {}): BoardState {
  const next = random(options.seed ?? Date.now());
  let id = 0;
  const tiles: Tile[][] = [];
  const objects = [...(options.objectIds ?? [])];
  const excludedObjects = new Set((options.excludedObjectPositions ?? []).map((position) => `${position.row},${position.col}`));
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
        objectId: excludedObjects.has(`${row},${col}`) ? undefined : objects.shift()
      });
    }
    tiles.push(line);
  }
  return { tiles, spare: { id: `tile-${id}`, shape: SHAPES[Math.floor(next() * SHAPES.length)]!, rotation: 0, fixed: false, objectId: objects.shift() }, players: [] };
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
