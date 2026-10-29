import { describe, expect, it } from "vitest";
import { addPlayer, canMove, generateBoard, movePlayer, reachable, findRoute } from "./index.js";
import type { BoardState, Tile } from "./index.js";

function boardFrom(rows: Array<Array<Pick<Tile, "shape" | "rotation">>>): BoardState {
  return {
    tiles: rows.map((row, r) => row.map((tile, c) => ({ ...tile, id: `${r}-${c}`, fixed: false }))),
    spare: { id: "spare", shape: "I", rotation: 0, fixed: false }, players: []
  };
}

describe("movimiento y conexiones", () => {
  it("sólo permite conexiones con aperturas enfrentadas", () => {
    const tiles = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => ({ shape: "CROSS" as const, rotation: 0 as const })));
    const board = boardFrom(tiles);
    expect(reachable(board, { row: 4, col: 4 })).toHaveLength(81);
    expect(findRoute(board, { row: 4, col: 4 }, { row: 4, col: 6 })).toEqual([{ row: 4, col: 4 }, { row: 4, col: 5 }, { row: 4, col: 6 }]);
  });

  it("conecta los bordes opuestos cuando ambas piezas tienen salida", () => {
    const tiles = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => ({ shape: "CROSS" as const, rotation: 0 as const })));
    const board = boardFrom(tiles);
    expect(findRoute(board, { row: 0, col: 4 }, { row: 8, col: 4 })).toEqual([{ row: 0, col: 4 }, { row: 8, col: 4 }]);
    board.tiles[0]![4] = { ...board.tiles[0]![4]!, shape: "I", rotation: 90 };
    expect(canMove(board, { row: 0, col: 4 }, "N")).toBe(false);
  });

  it("mantiene los cruces de borde como tramos de una ruta más larga", () => {
    const board = boardFrom(Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => ({ shape: "CROSS" as const, rotation: 0 as const }))));
    board.tiles[0]![0] = { ...board.tiles[0]![0]!, shape: "I", rotation: 90 };
    board.tiles[0]![8] = { ...board.tiles[0]![8]!, shape: "I", rotation: 0 };
    expect(findRoute(board, { row: 0, col: 0 }, { row: 8, col: 2 })).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 8, col: 1 },
      { row: 8, col: 2 }
    ]);
  });

  it("permite mover al jugador horizontal y verticalmente entre extremos", () => {
    const board = boardFrom(Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => ({ shape: "CROSS" as const, rotation: 0 as const }))));
    const withPlayer = addPlayer(board, { id: "p1", position: { row: 4, col: 8 }, startPosition: { row: 4, col: 8 }, objectives: [], objectiveIndex: 0 });
    expect(movePlayer(withPlayer, "p1", { row: 4, col: 0 }).players[0]!.position).toEqual({ row: 4, col: 0 });
    const vertical = addPlayer(board, { id: "p1", position: { row: 8, col: 4 }, startPosition: { row: 8, col: 4 }, objectives: [], objectiveIndex: 0 });
    expect(movePlayer(vertical, "p1", { row: 0, col: 4 }).players[0]!.position).toEqual({ row: 0, col: 4 });
  });

  it("no atraviesa paredes y devuelve null si no hay ruta", () => {
    const tiles = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => ({ shape: "I" as const, rotation: 0 as const })));
    const board = boardFrom(tiles);
    expect(findRoute(board, { row: 4, col: 4 }, { row: 4, col: 5 })).toBeNull();
  });

  it("mueve al jugador sólo a una celda alcanzable y no muta el estado", () => {
    const tiles = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => ({ shape: "CROSS" as const, rotation: 0 as const })));
    const original = addPlayer(boardFrom(tiles), { id: "p1", position: { row: 4, col: 4 }, startPosition: { row: 4, col: 4 }, objectives: [], objectiveIndex: 0 });
    const moved = movePlayer(original, "p1", { row: 4, col: 6 });
    expect(moved.players[0]!.position).toEqual({ row: 4, col: 6 });
    expect(original.players[0]!.position).toEqual({ row: 4, col: 4 });
    const blockedTiles = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => ({ shape: "I" as const, rotation: 0 as const })));
    const blocked = addPlayer(boardFrom(blockedTiles), { id: "p1", position: { row: 4, col: 4 }, startPosition: { row: 4, col: 4 }, objectives: [], objectiveIndex: 0 });
    expect(() => movePlayer(blocked, "p1", { row: 4, col: 5 })).toThrow("not reachable");
  });
});
