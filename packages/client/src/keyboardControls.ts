import { BOARD_SIZE, type Direction, type Position } from "@laberinto/engine";

export const KEYBOARD_DIRECTIONS: Readonly<Record<string, Direction>> = {
  ArrowUp: "N",
  ArrowRight: "E",
  ArrowDown: "S",
  ArrowLeft: "W"
};

export const KEY_REPEAT_DELAY = 300;
export const KEY_REPEAT_INTERVAL = 550;

export function directionForKey(key: string): Direction | undefined {
  return KEYBOARD_DIRECTIONS[key];
}

export function adjacentPosition(position: Position, direction: Direction): Position {
  const deltas: Record<Direction, readonly [number, number]> = {
    N: [-1, 0], E: [0, 1], S: [1, 0], W: [0, -1]
  };
  const [rowDelta, colDelta] = deltas[direction];
  return {
    row: (position.row + rowDelta + BOARD_SIZE) % BOARD_SIZE,
    col: (position.col + colDelta + BOARD_SIZE) % BOARD_SIZE
  };
}

export function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}
