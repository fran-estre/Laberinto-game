import type { Position } from "@laberinto/engine";

export function isWrapBetween(from: Position, to: Position): boolean {
  return (from.row === to.row && Math.abs(from.col - to.col) === 8) ||
    (from.col === to.col && Math.abs(from.row - to.row) === 8);
}

export function outsidePosition(from: Position): Position {
  if (from.col === 0) return { row: from.row, col: -1 };
  if (from.col === 8) return { row: from.row, col: 9 };
  if (from.row === 0) return { row: -1, col: from.col };
  return { row: 9, col: from.col };
}

export function oppositeOutsidePosition(to: Position): Position {
  if (to.col === 0) return { row: to.row, col: -1 };
  if (to.col === 8) return { row: to.row, col: 9 };
  if (to.row === 0) return { row: -1, col: to.col };
  return { row: 9, col: to.col };
}
