import { describe, expect, it } from "vitest";
import { reachable, type BoardState } from "@laberinto/engine";
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
    let state: ReturnType<RoomManager["move"]> | undefined;
    let collectedPlayerId: string | undefined;
    const insertions = [
      { axis: "row" as const, index: 1 as const, from: "left" as const },
      { axis: "row" as const, index: 3 as const, from: "left" as const },
      { axis: "row" as const, index: 5 as const, from: "left" as const },
      { axis: "row" as const, index: 7 as const, from: "left" as const },
      { axis: "column" as const, index: 1 as const, from: "top" as const },
      { axis: "column" as const, index: 3 as const, from: "top" as const },
      { axis: "column" as const, index: 5 as const, from: "top" as const },
      { axis: "column" as const, index: 7 as const, from: "top" as const }
    ];
    for (let turn = 0; turn < 100 && !state; turn++) {
      const activeId = turn % 2 === 0 ? created.playerId : second.playerId;
      const inserted = manager.doInsert(created.room.code, activeId, insertions[turn % insertions.length]!);
      const board = { tiles: inserted.board as BoardState["tiles"], spare: inserted.spare as BoardState["spare"], players: [] } satisfies BoardState;
      const activePosition = inserted.players.find((player) => player.id === activeId)!.position;
      const objective = manager.getPrivateState(created.room.code, activeId).currentObjective;
      const target = reachable(board, activePosition).find((position) => board.tiles[position.row]![position.col]!.objectId === objective);
      if (target) {
        state = manager.move(created.room.code, activeId, target);
        collectedPlayerId = activeId;
      }
      else manager.endTurn(created.room.code, activeId);
    }
    expect(state).toBeDefined();
    const collectedState = state!;
    expect(collectedState.collected).toBe(true);
    expect(collectedState.state.phase).toBe("INSERTION");
    expect(collectedState.state.activePlayerId).toBe(collectedPlayerId === created.playerId ? second.playerId : created.playerId);
  });
});
