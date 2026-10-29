import { describe, expect, it } from "vitest";
import { BOARD_SIZE, generateBoard, objectiveZone } from "./index.js";

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

  it("distribuye los objetivos en cuatro zonas con equilibrio configurable", () => {
    const board = generateBoard({ seed: 12, objectIds: Array.from({ length: 20 }, (_, index) => `object-${index}`) });
    const counts = [0, 0, 0, 0];
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (board.tiles[row]![col]!.objectId) counts[objectiveZone({ row, col })]! += 1;
      }
    }
    expect(counts).toEqual([5, 5, 5, 5]);
  });

  it("es reproducible con la misma semilla y cambia con otra", () => {
    const objectIds = Array.from({ length: 12 }, (_, index) => `object-${index}`);
    const locations = (seed: number) => generateBoard({ seed, objectIds }).tiles.flat().map((tile) => tile.objectId ?? "-");
    expect(locations(7)).toEqual(locations(7));
    expect(locations(7)).not.toEqual(locations(8));
  });

  it("mantiene objetivos únicos y no usa celdas excluidas", () => {
    const objectIds = Array.from({ length: 12 }, (_, index) => `object-${index}`);
    const board = generateBoard({ seed: 3, objectIds, excludedObjectPositions: [{ row: 0, col: 0 }, { row: 8, col: 8 }] });
    const placed = board.tiles.flatMap((row) => row.flatMap((tile) => tile.objectId ? [tile.objectId] : []));
    expect(new Set(placed).size).toBe(objectIds.length);
    expect(board.tiles[0]![0]!.objectId).toBeUndefined();
    expect(board.tiles[8]![8]!.objectId).toBeUndefined();
  });

  it("permite configurar el margen de equilibrio", () => {
    const board = generateBoard({ seed: 21, objectIds: Array.from({ length: 15 }, (_, index) => `object-${index}`), objectiveBalanceMargin: 2 });
    const counts = [0, 0, 0, 0];
    for (let row = 0; row < BOARD_SIZE; row++) for (let col = 0; col < BOARD_SIZE; col++) {
      if (board.tiles[row]![col]!.objectId) counts[objectiveZone({ row, col })]! += 1;
    }
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(2);
  });
});
