import { addPlayer, assignObjectives, canEscape, collectCurrentObjective, generateBoard, insert, movePlayer, rotateSpare, type BoardState, type Insertion, type PlayerToken, type Position } from "@laberinto/engine";
import type { PrivateGameState, PublicGameState, PublicPlayerState, PublicRoomState } from "./protocol.js";

type Phase = "INSERTION" | "MOVEMENT" | "FINISHED";
interface ServerPlayer extends PlayerToken { name: string; sessionToken: string; connected: boolean }
interface Room { code: string; hostId: string; players: ServerPlayer[]; board?: BoardState; phase: Phase; activePlayerIndex: number; lastInsertion?: Insertion }

const STARTS: Position[] = [{ row: 0, col: 0 }, { row: 0, col: 8 }, { row: 8, col: 0 }, { row: 8, col: 8 }];
const makeCode = () => Math.random().toString(36).slice(2, 7).toUpperCase();
const makeToken = () => crypto.randomUUID();
const isReverse = (a: Insertion, b: Insertion) => a.axis === b.axis && a.index === b.index && a.from !== b.from;

export class RoomManager {
  private readonly rooms = new Map<string, Room>();

  createRoom(name: string) {
    const player = this.newPlayer(name, 0);
    let code = makeCode(); while (this.rooms.has(code)) code = makeCode();
    const room: Room = { code, hostId: player.id, players: [player], phase: "INSERTION", activePlayerIndex: 0 };
    this.rooms.set(code, room);
    return { room: this.publicRoom(room), playerId: player.id, sessionToken: player.sessionToken };
  }

  joinRoom(code: string, name: string, sessionToken?: string) {
    const room = this.getRoom(code);
    const reconnect = sessionToken ? room.players.find((player) => player.sessionToken === sessionToken) : undefined;
    if (reconnect) { reconnect.connected = true; return { room: this.publicRoom(room), playerId: reconnect.id, sessionToken: reconnect.sessionToken }; }
    if (room.board || room.players.length >= 4) throw new Error("Room is not available");
    const player = this.newPlayer(name, room.players.length); room.players.push(player);
    return { room: this.publicRoom(room), playerId: player.id, sessionToken: player.sessionToken };
  }

  start(code: string, requesterId: string) {
    const room = this.getRoom(code);
    if (room.hostId !== requesterId) throw new Error("Only the host can start the game");
    if (room.players.length < 2) throw new Error("At least two players are required");
    const objectIds = Array.from({ length: room.players.length * 6 }, (_, index) => `object-${index + 1}`);
    let board = generateBoard({ objectIds, excludedObjectPositions: STARTS });
    for (const player of room.players) board = addPlayer(board, player);
    board = assignObjectives(board, room.players.map((player) => player.id), objectIds);
    room.players = room.players.map((player) => ({ ...player, ...board.players.find((candidate) => candidate.id === player.id)! }));
    room.board = board; room.phase = "INSERTION"; room.activePlayerIndex = 0; room.lastInsertion = undefined;
    return this.gameState(room);
  }

  rotate(code: string, playerId: string, quarterTurns = 1) { const room = this.activeRoom(code, playerId, "INSERTION"); room.board = rotateSpare(room.board!, quarterTurns); return this.gameState(room); }

  doInsert(code: string, playerId: string, insertion: Insertion) {
    const room = this.activeRoom(code, playerId, "INSERTION");
    if (room.lastInsertion && isReverse(room.lastInsertion, insertion)) throw new Error("The reverse insertion is forbidden");
    room.board = insert(room.board!, insertion); room.lastInsertion = insertion; room.phase = "MOVEMENT";
    this.syncPlayerPositions(room);
    return this.gameState(room);
  }

  move(code: string, playerId: string, destination: Position) {
    const room = this.activeRoom(code, playerId, "MOVEMENT");
    this.syncBoardPositions(room);
    room.board = movePlayer(room.board!, playerId, destination);
    const collection = collectCurrentObjective(room.board, playerId); room.board = collection.board;
    const player = room.players.find((candidate) => candidate.id === playerId)!;
    Object.assign(player, room.board.players.find((candidate) => candidate.id === playerId)!);
    if (canEscape(room.board, playerId)) room.phase = "FINISHED";
    else if (collection.collected) {
      room.phase = "INSERTION";
      room.activePlayerIndex = (room.activePlayerIndex + 1) % room.players.length;
    } else room.phase = "MOVEMENT";
    return { state: this.gameState(room), privateState: this.privateStateFor(code, playerId), victory: room.phase === "FINISHED" ? { winnerId: playerId, winnerName: player.name } : undefined, collected: collection.collected };
  }

  endTurn(code: string, playerId: string) {
    const room = this.activeRoom(code, playerId, "MOVEMENT");
    room.phase = "INSERTION";
    room.activePlayerIndex = (room.activePlayerIndex + 1) % room.players.length;
    return this.gameState(room);
  }

  getRoomState(code: string) { return this.publicRoom(this.getRoom(code)); }
  getPrivateState(code: string, playerId: string) { return this.privateStateFor(code, playerId); }
  getPlayerIds(code: string) { return this.getRoom(code).players.map((player) => player.id); }

  private privateStateFor(code: string, playerId: string): PrivateGameState { const player = this.getRoom(code).players.find((candidate) => candidate.id === playerId); if (!player) throw new Error("Player not found"); return { currentObjective: player.objectives[player.objectiveIndex], objectiveIndex: player.objectiveIndex, objectiveTotal: player.objectives.length }; }
  private syncPlayerPositions(room: Room) { for (const player of room.players) { const boardPlayer = room.board?.players.find((candidate) => candidate.id === player.id); if (boardPlayer) player.position = { ...boardPlayer.position }; } }
  private syncBoardPositions(room: Room) { for (const player of room.players) { const boardPlayer = room.board?.players.find((candidate) => candidate.id === player.id); if (boardPlayer) boardPlayer.position = { ...player.position }; } }
  private activeRoom(code: string, playerId: string, phase: Phase) { const room = this.getRoom(code); if (!room.board || room.phase !== phase) throw new Error(`Action is not valid during ${room.phase}`); if (room.players[room.activePlayerIndex]!.id !== playerId) throw new Error("It is not your turn"); return room; }
  private getRoom(code: string) { const room = this.rooms.get(code.toUpperCase()); if (!room) throw new Error("Room not found"); return room; }
  private newPlayer(name: string, index: number): ServerPlayer { const startPosition = STARTS[index]!; return { id: crypto.randomUUID(), name: name.trim() || `Player ${index + 1}`, position: { ...startPosition }, startPosition, objectives: [], objectiveIndex: 0, sessionToken: makeToken(), connected: true }; }
  private publicPlayer(player: ServerPlayer): PublicPlayerState { return { id: player.id, name: player.name, position: player.position, connected: player.connected, objectivesCollected: player.objectiveIndex, objectivesTotal: player.objectives.length }; }
  private publicRoom(room: Room): PublicRoomState { return { code: room.code, hostId: room.hostId, started: Boolean(room.board), players: room.players.map((player) => this.publicPlayer(player)) }; }
  private gameState(room: Room): PublicGameState { return { code: room.code, phase: room.phase, activePlayerId: room.players[room.activePlayerIndex]!.id, players: room.players.map((player) => this.publicPlayer(player)), board: room.board!.tiles, spare: room.board!.spare }; }
}
