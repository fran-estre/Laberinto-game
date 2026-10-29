import { describe, expect, it } from "vitest";
import { addPlayer, generateBoard, insert, isFixedPosition, rotateOpenings, rotateSpare } from "./index.js";
import type { BoardState } from "./index.js";

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

  it("permite distintos tipos en las posiciones fijas interiores", () => {
    const board = generateBoard({ seed: 42 });
    const nonCornerFixed = board.tiles.flatMap((row, r) => row.filter((_, c) => isFixedPosition(r, c) && !((r === 0 || r === 8) && (c === 0 || c === 8))));
    expect(nonCornerFixed).toHaveLength(21);
    expect(nonCornerFixed.some((tile) => tile.shape !== "L")).toBe(true);
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

  it("desplaza correctamente desde los cuatro lados, expulsa la pieza y reubica al jugador", () => {
    const makeBoard = (): BoardState => ({
      tiles: Array.from({ length: 9 }, (_, row) => Array.from({ length: 9 }, (_, col) => ({ id: `${row}-${col}`, shape: "I" as const, rotation: 0 as const, fixed: false }))),
      spare: { id: "spare", shape: "L", rotation: 0, fixed: false },
      players: []
    });

    const fromLeft = makeBoard();
    fromLeft.tiles[1]![8]!.objectId = "object-left";
    fromLeft.players.push({ id: "left", position: { row: 1, col: 8 }, startPosition: { row: 1, col: 8 }, objectives: [], objectiveIndex: 0 });
    const left = insert(fromLeft, { axis: "row", index: 1, from: "left" });
    expect(left.tiles[1]!.map((tile) => tile.id)).toEqual(["spare", "1-0", "1-1", "1-2", "1-3", "1-4", "1-5", "1-6", "1-7"]);
    expect(left.spare.id).toBe("1-8");
    expect(left.spare.objectId).toBe("object-left");
    expect(left.players[0]!.position).toEqual({ row: 1, col: 0 });

    const fromRight = makeBoard();
    fromRight.tiles[1]![0]!.objectId = "object-right";
    fromRight.players.push({ id: "right", position: { row: 1, col: 0 }, startPosition: { row: 1, col: 0 }, objectives: [], objectiveIndex: 0 });
    const right = insert(fromRight, { axis: "row", index: 1, from: "right" });
    expect(right.tiles[1]!.map((tile) => tile.id)).toEqual(["1-1", "1-2", "1-3", "1-4", "1-5", "1-6", "1-7", "1-8", "spare"]);
    expect(right.spare.id).toBe("1-0");
    expect(right.spare.objectId).toBe("object-right");
    expect(right.players[0]!.position).toEqual({ row: 1, col: 8 });

    const fromTop = makeBoard();
    fromTop.tiles[8]![3]!.objectId = "object-top";
    fromTop.players.push({ id: "top", position: { row: 8, col: 3 }, startPosition: { row: 8, col: 3 }, objectives: [], objectiveIndex: 0 });
    const top = insert(fromTop, { axis: "column", index: 3, from: "top" });
    expect(top.tiles.map((row) => row[3]!.id)).toEqual(["spare", "0-3", "1-3", "2-3", "3-3", "4-3", "5-3", "6-3", "7-3"]);
    expect(top.spare.id).toBe("8-3");
    expect(top.spare.objectId).toBe("object-top");
    expect(top.players[0]!.position).toEqual({ row: 0, col: 3 });

    const fromBottom = makeBoard();
    fromBottom.tiles[0]![3]!.objectId = "object-bottom";
    fromBottom.players.push({ id: "bottom", position: { row: 0, col: 3 }, startPosition: { row: 0, col: 3 }, objectives: [], objectiveIndex: 0 });
    const bottom = insert(fromBottom, { axis: "column", index: 3, from: "bottom" });
    expect(bottom.tiles.map((row) => row[3]!.id)).toEqual(["1-3", "2-3", "3-3", "4-3", "5-3", "6-3", "7-3", "8-3", "spare"]);
    expect(bottom.spare.id).toBe("0-3");
    expect(bottom.spare.objectId).toBe("object-bottom");
    expect(bottom.players[0]!.position).toEqual({ row: 8, col: 3 });
  });

  it("inserta una columna desde abajo", () => {
    const board = generateBoard({ seed: 4 });
    const inserted = insert(board, { axis: "column", index: 7, from: "bottom" });
    expect(inserted.tiles[8]![7]!.id).toBe(board.spare.id);
    expect(inserted.spare.id).toBe(board.tiles[0]![7]!.id);
  });

  it("conserva en la pieza adicional el objetivo expulsado", () => {
    const board = generateBoard({ seed: 5 });
    board.tiles[1]![8]!.objectId = "relic-outside";
    const inserted = insert(board, { axis: "row", index: 1, from: "left" });
    expect(inserted.spare.objectId).toBe("relic-outside");
    expect(insert(inserted, { axis: "row", index: 1, from: "right" }).tiles[1]![8]!.objectId).toBe("relic-outside");
  });
});
