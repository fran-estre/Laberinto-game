import { describe, expect, it } from "vitest";
import { addPlayer, BOARD_SIZE, generateBoard, insert, rotateSpare, type Insertion } from "@laberinto/engine";
import { createInsertionAnimation, hasInsertedSpare, isInInsertionLine } from "./insertionAnimation.js";

const cases: Insertion[] = ([1, 3, 5, 7] as const).flatMap((index) => [
  { axis: "row", index, from: "right" },
  { axis: "row", index, from: "left" },
  { axis: "column", index, from: "top" },
  { axis: "column", index, from: "bottom" },
]);

describe("inserción visual con posiciones temporales -1 y 9", () => {
  it.each(cases)("mueve diez piezas desde $from en $axis $index y coincide con el motor", (insertion) => {
    const previous = generateBoard({ seed: 42 });
    previous.spare.objectId = "incoming-object";
    const snapshot = structuredClone(previous);
    const animation = createInsertionAnimation(previous, insertion);
    const result = insert(previous, insertion);
    const horizontal = insertion.axis === "row";
    const forward = insertion.from === "left" || insertion.from === "top";
    const lineIndex = (position: { row: number; col: number }) => horizontal ? position.col : position.row;

    expect(animation.tiles).toHaveLength(10);
    expect(new Set(animation.tiles.map(({ tile }) => tile.id)).size).toBe(10);
    // Las nueve piezas conservan su coordenada y su identidad ANTES de moverse.
    expect(animation.tiles.slice(0, 9).map(({ position }) => lineIndex(position)))
      .toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    for (const { tile, position } of animation.tiles.slice(0, 9)) {
      expect(tile).toEqual(previous.tiles[position.row]![position.col]);
      expect(isInInsertionLine(position, insertion)).toBe(true);
    }
    const entering = animation.tiles[9]!;
    expect(entering.tile).toEqual(previous.spare);
    expect(lineIndex(entering.position)).toBe(forward ? -1 : 9);
    expect(animation.shift).toEqual(horizontal
      ? { x: forward ? 1 : -1, y: 0 }
      : { x: 0, y: forward ? 1 : -1 });

    // Un único desplazamiento compartido deja nueve piezas dentro y sólo una fuera.
    const destinations = animation.tiles.map(({ tile, position }) => ({
      tile,
      row: position.row + animation.shift.y,
      col: position.col + animation.shift.x,
    }));
    const inside = destinations.filter(({ row, col }) => row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE);
    const outside = destinations.filter((entry) => !inside.includes(entry));
    expect(inside).toHaveLength(9);
    for (const { tile, row, col } of inside) expect(tile).toEqual(result.tiles[row]![col]);
    expect(outside).toHaveLength(1);
    expect(outside[0]!.tile).toEqual(result.spare);
    expect(lineIndex(outside[0]!)).toBe(forward ? 9 : -1);
    // Al retirar la capa temporal, el tablero del motor no guarda casillas exteriores.
    expect(result.tiles).toHaveLength(9);
    expect(result.tiles.every((row) => row.length === 9)).toBe(true);
    expect(previous).toEqual(snapshot);
  });

  it("detecta dos inserciones idénticas consecutivas sin confundir rotaciones o actualizaciones", () => {
    const insertion = { axis: "row", index: 3, from: "right" } as const;
    const first = generateBoard({ seed: 2 });
    const second = insert(first, insertion);
    const third = insert(second, insertion);
    expect(hasInsertedSpare(first, second)).toBe(true);
    expect(hasInsertedSpare(second, third)).toBe(true);
    expect(hasInsertedSpare(second, structuredClone(second))).toBe(false);
    expect(hasInsertedSpare(second, rotateSpare(second))).toBe(false);
  });

  it("transporta visualmente las fichas de la línea desde su posición original, incluida la expulsada", () => {
    let board = generateBoard({ seed: 3 });
    for (const [id, row, col] of [["out", 1, 0], ["middle", 1, 4], ["static", 0, 4]] as const) {
      board = addPlayer(board, { id, position: { row, col }, startPosition: { row, col }, objectives: [], objectiveIndex: 0 });
    }
    const animation = createInsertionAnimation(board, { axis: "row", index: 1, from: "right" });
    expect(animation.players.map(({ id }) => id)).toEqual(["out", "middle"]);
    expect(animation.players[0]!.position).toEqual({ row: 1, col: 0 });
    expect(animation.players[1]!.position).toEqual({ row: 1, col: 4 });
  });
});
