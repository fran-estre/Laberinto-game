import { describe, expect, it } from "vitest";
import { addPlayer, generateBoard, insert, isFixedPosition, rotateOpenings, rotateSpare } from "./index.js";

describe("tablero 9x9", () => {
  it("genera 81 piezas y una pieza adicional reproducible", () => {
    const a = generateBoard({ seed: 42 });
    const b = generateBoard({ seed: 42 });
    expect(a.tiles).toHaveLength(9);
    expect(a.tiles.flat()).toHaveLength(81);
    expect(a).toEqual(b);
  });

  it("marca como fijas las 25 coordenadas pares", () => {
    const board = generateBoard({ seed: 1 });
    expect(board.tiles.flat().filter((tile) => tile.fixed)).toHaveLength(25);
    for (let row = 0; row < 9; row++) for (let col = 0; col < 9; col++) expect(board.tiles[row]![col]!.fixed).toBe(isFixedPosition(row, col));
  });

  it("orienta las cuatro esquinas hacia el interior", () => {
    const board = generateBoard({ seed: 1 });
    expect(rotateOpenings("L", board.tiles[0]![0]!.rotation).sort()).toEqual(["E", "S"].sort());
    expect(rotateOpenings("L", board.tiles[0]![8]!.rotation).sort()).toEqual(["S", "W"].sort());
    expect(rotateOpenings("L", board.tiles[8]![0]!.rotation).sort()).toEqual(["N", "E"].sort());
    expect(rotateOpenings("L", board.tiles[8]![8]!.rotation).sort()).toEqual(["N", "W"].sort());
  });

  it("rota la pieza adicional sin mutar el tablero original", () => {
    const board = generateBoard({ seed: 2 });
    const rotated = rotateSpare(board);
    expect(rotated.spare.rotation).toBe(90);
    expect(board.spare.rotation).toBe(0);
  });

  it("inserta una fila y transporta al jugador", () => {
    let board = generateBoard({ seed: 3 });
    board = addPlayer(board, { id: "p1", position: { row: 1, col: 0 }, startPosition: { row: 1, col: 0 }, objectives: [], objectiveIndex: 0 });
    const inserted = insert(board, { axis: "row", index: 1, from: "left" });
    expect(inserted.players[0]!.position).toEqual({ row: 1, col: 1 });
    expect(inserted.spare.id).toBe(board.tiles[1]![8]!.id);
    expect(inserted.tiles[0]![0]!.id).toBe(board.tiles[0]![0]!.id);
  });

  it("inserta una columna desde abajo", () => {
    const board = generateBoard({ seed: 4 });
    const inserted = insert(board, { axis: "column", index: 7, from: "bottom" });
    expect(inserted.tiles[8]![7]!.id).toBe(board.spare.id);
    expect(inserted.spare.id).toBe(board.tiles[0]![7]!.id);
  });
});
