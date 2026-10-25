import { describe, expect, it } from "vitest";
import { generateBoard } from "./index.js";

describe("colocación de objetivos", () => {
  it("nunca coloca objetivos en las esquinas iniciales", () => {
    const board = generateBoard({
      seed: 12,
      objectIds: ["a", "b", "c", "d", "e"],
      excludedObjectPositions: [{ row: 0, col: 0 }, { row: 0, col: 8 }, { row: 8, col: 0 }, { row: 8, col: 8 }]
    });
    for (const position of [{ row: 0, col: 0 }, { row: 0, col: 8 }, { row: 8, col: 0 }, { row: 8, col: 8 }]) {
      expect(board.tiles[position.row]![position.col]!.objectId).toBeUndefined();
    }
    expect(board.tiles.flat().filter((tile) => tile.objectId)).toHaveLength(5);
  });
});
