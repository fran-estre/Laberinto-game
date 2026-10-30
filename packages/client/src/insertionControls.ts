import type { Insertion } from "@laberinto/engine";

export const INSERTABLE = [1, 3, 5, 7] as const;

export function isReverseInsertion(previous: Insertion | undefined, next: Insertion): boolean {
  return Boolean(previous && previous.axis === next.axis && previous.index === next.index && previous.from !== next.from);
}

export function insertionShift(insertion: Insertion): { x: number; y: number } {
  if (insertion.axis === "row") return { x: insertion.from === "left" ? -1 : 1, y: 0 };
  return { x: 0, y: insertion.from === "top" ? -1 : 1 };
}
