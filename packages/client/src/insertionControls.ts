import type { Insertion } from "@laberinto/engine";

export const INSERTABLE = [1, 3, 5, 7] as const;
export const INSERTION_ANIMATION_DURATION_MS = 3000;

export function isReverseInsertion(previous: Insertion | undefined, next: Insertion): boolean {
  return Boolean(previous && previous.axis === next.axis && previous.index === next.index && previous.from !== next.from);
}
