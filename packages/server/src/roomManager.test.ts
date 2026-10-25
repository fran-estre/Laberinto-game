import { describe, expect, it } from "vitest";
import { RoomManager } from "./roomManager.js";

describe("RoomManager", () => {
  it("crea salas, admite hasta cuatro jugadores y conserva sesiones", () => {
    const manager = new RoomManager();
    const created = manager.createRoom("Ana");
    const joined = manager.joinRoom(created.room.code, "Luis");
    const reconnected = manager.joinRoom(created.room.code, "Otro nombre", joined.sessionToken);
    expect(created.room.players).toHaveLength(1);
    expect(manager.getRoomState(created.room.code).players).toHaveLength(2);
    expect(reconnected.playerId).toBe(joined.playerId);
    expect(reconnected.sessionToken).toBe(joined.sessionToken);
  });

  it("inicia una partida y mantiene los objetivos fuera del estado público", () => {
    const manager = new RoomManager();
    const created = manager.createRoom("Ana");
    manager.joinRoom(created.room.code, "Luis");
    const state = manager.start(created.room.code, created.playerId);
    const privateState = manager.getPrivateState(created.room.code, created.playerId);
    expect(state.phase).toBe("INSERTION");
    expect(state.activePlayerId).toBe(created.playerId);
    expect(state.players[0]!).not.toHaveProperty("objectives");
    expect(privateState.currentObjective).toBeDefined();
    expect(privateState.objectiveTotal).toBe(6);
  });

  it("rechaza iniciar con menos de dos jugadores y acciones fuera de turno", () => {
    const manager = new RoomManager();
    const created = manager.createRoom("Ana");
    expect(() => manager.start(created.room.code, created.playerId)).toThrow("At least two");
    manager.joinRoom(created.room.code, "Luis");
    manager.start(created.room.code, created.playerId);
    expect(() => manager.rotate(created.room.code, "not-the-active-player")).toThrow("not your turn");
  });

  it("termina automáticamente el turno al recoger un objetivo", () => {
    const manager = new RoomManager();
    const created = manager.createRoom("Ana");
    const second = manager.joinRoom(created.room.code, "Luis");
    manager.start(created.room.code, created.playerId);
    const inserted = manager.doInsert(created.room.code, created.playerId, { axis: "row", index: 1, from: "left" });
    const objective = manager.getPrivateState(created.room.code, created.playerId).currentObjective;
    const tiles = inserted.board as Array<Array<{ objectId?: string }>>;
    const target = tiles.flatMap((row, rowIndex) => row.map((tile, colIndex) => tile.objectId === objective ? { row: rowIndex, col: colIndex } : undefined)).find(Boolean)!;
    const state = manager.move(created.room.code, created.playerId, target);
    expect(state.collected).toBe(true);
    expect(state.state.phase).toBe("INSERTION");
    expect(state.state.activePlayerId).toBe(second.playerId);
  });
});
