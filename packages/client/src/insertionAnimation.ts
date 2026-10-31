import { BOARD_SIZE, type BoardState, type Insertion, type Position, type Tile } from "@laberinto/engine";

export interface InsertionAnimation {
  insertion: Insertion;
  tiles: Array<{ tile: Tile; position: Position }>;
  shift: { x: number; y: number };
  players: BoardState["players"];
}

export function isInInsertionLine(position: Position, insertion: Insertion): boolean {
  return (insertion.axis === "row" ? position.row : position.col) === insertion.index;
}

// Detecta también inserciones consecutivas desde el mismo punto. Rotar o mover
// un jugador no cambia la identidad de la pieza adicional.
export function hasInsertedSpare(previous: BoardState, next: Pick<BoardState, "spare">): boolean {
  return previous.spare.id !== next.spare.id;
}

// Sólo geometría visual: el resultado de las reglas sigue viniendo del motor.
export function createInsertionAnimation(previous: BoardState, insertion: Insertion): InsertionAnimation {
  const horizontal = insertion.axis === "row";
  const forward = insertion.from === "left" || insertion.from === "top";
  const enteringIndex = forward ? -1 : BOARD_SIZE;
  const positionAt = (index: number): Position => horizontal
    ? { row: insertion.index, col: index }
    : { row: index, col: insertion.index };
  const tiles = Array.from({ length: BOARD_SIZE }, (_, index) => {
    const position = positionAt(index);
    return { tile: previous.tiles[position.row]![position.col]!, position };
  });
  tiles.push({ tile: previous.spare, position: positionAt(enteringIndex) });
  return {
    insertion,
    tiles,
    shift: { x: horizontal ? (forward ? 1 : -1) : 0, y: horizontal ? 0 : (forward ? 1 : -1) },
    players: previous.players.filter((player) => isInInsertionLine(player.position, insertion)),
  };
}
