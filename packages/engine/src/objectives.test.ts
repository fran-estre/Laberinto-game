import { describe, expect, it } from "vitest";
import { addPlayer, assignObjectives, canEscape, collectCurrentObjective, currentObjective, generateBoard, hasCompletedObjectives } from "./index.js";

describe("objetivos", () => {
  it("distribuye seis objetivos por jugador en rondas", () => {
    let board = generateBoard({ seed: 8 });
    board = addPlayer(board, { id: "p1", position: { row: 0, col: 0 }, startPosition: { row: 0, col: 0 }, objectives: [], objectiveIndex: 0 });
    board = addPlayer(board, { id: "p2", position: { row: 0, col: 8 }, startPosition: { row: 0, col: 8 }, objectives: [], objectiveIndex: 0 });
    const ids = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"];
    const assigned = assignObjectives(board, ["p1", "p2"], ids);
    expect(assigned.players[0]!.objectives).toEqual(["a", "c", "e", "g", "i", "k"]);
    expect(assigned.players[1]!.objectives).toEqual(["b", "d", "f", "h", "j", "l"]);
    expect(currentObjective(assigned.players[0]!)).toBe("a");
  });

  it("recoge sólo el objetivo actual y elimina el objeto físico", () => {
    let board = generateBoard({ seed: 9 });
    board = addPlayer(board, { id: "p1", position: { row: 0, col: 0 }, startPosition: { row: 0, col: 0 }, objectives: ["relic", "other"], objectiveIndex: 0 });
    board.tiles[0]![0]!.objectId = "relic";
    const result = collectCurrentObjective(board, "p1");
    expect(result.collected).toBe(true);
    expect(result.objectId).toBe("relic");
    expect(result.board.tiles[0]![0]!.objectId).toBeUndefined();
    expect(result.board.players[0]!.objectiveIndex).toBe(1);
  });

  it("rechaza objetos fuera de orden sin mutar el tablero", () => {
    let board = generateBoard({ seed: 10 });
    board = addPlayer(board, { id: "p1", position: { row: 0, col: 0 }, startPosition: { row: 0, col: 0 }, objectives: ["first"], objectiveIndex: 0 });
    board.tiles[0]![0]!.objectId = "second";
    const result = collectCurrentObjective(board, "p1");
    expect(result.collected).toBe(false);
    expect(board.tiles[0]![0]!.objectId).toBe("second");
    expect(board.players[0]!.objectiveIndex).toBe(0);
  });

  it("sólo permite escapar después de completar objetivos y volver a la esquina", () => {
    let board = generateBoard({ seed: 11 });
    board = addPlayer(board, { id: "p1", position: { row: 0, col: 0 }, startPosition: { row: 0, col: 0 }, objectives: ["first"], objectiveIndex: 0 });
    expect(hasCompletedObjectives(board.players[0]!)).toBe(false);
    expect(canEscape(board, "p1")).toBe(false);
    board.players[0]!.objectiveIndex = 1;
    expect(hasCompletedObjectives(board.players[0]!)).toBe(true);
    expect(canEscape(board, "p1")).toBe(true);
    board.players[0]!.position = { row: 1, col: 0 };
    expect(canEscape(board, "p1")).toBe(false);
  });
});
