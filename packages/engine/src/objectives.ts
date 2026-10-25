import type { BoardState, PlayerToken } from "./types.js";

export const OBJECTIVES_PER_PLAYER = 6;

export function assignObjectives(board: BoardState, playerIds: string[], objectIds: string[], count = OBJECTIVES_PER_PLAYER): BoardState {
  if (playerIds.length === 0) return structuredClone(board);
  if (objectIds.length < playerIds.length * count) throw new Error("Not enough unique objects for all players");
  if (new Set(objectIds).size !== objectIds.length) throw new Error("Objective IDs must be unique");
  const result = structuredClone(board);
  const playersById = new Map(result.players.map((player) => [player.id, player]));
  const assigned = playerIds.map((id) => playersById.get(id));
  if (assigned.some((player) => !player)) throw new Error("Cannot assign objectives to an unknown player");
  let cursor = 0;
  for (let objectiveIndex = 0; objectiveIndex < count; objectiveIndex++) {
    for (const player of assigned as PlayerToken[]) player.objectives.push(objectIds[cursor++]!);
  }
  return result;
}

export function currentObjective(player: PlayerToken): string | undefined {
  return player.objectives[player.objectiveIndex];
}

export function hasCompletedObjectives(player: PlayerToken): boolean {
  return player.objectiveIndex >= player.objectives.length;
}

export function canEscape(board: BoardState, playerId: string): boolean {
  const player = board.players.find((candidate) => candidate.id === playerId);
  if (!player || !hasCompletedObjectives(player)) return false;
  return player.position.row === player.startPosition.row && player.position.col === player.startPosition.col;
}

export interface CollectionResult { board: BoardState; collected: boolean; objectId?: string }

export function collectCurrentObjective(board: BoardState, playerId: string): CollectionResult {
  const result = structuredClone(board);
  const player = result.players.find((candidate) => candidate.id === playerId);
  if (!player) throw new Error(`Player not found: ${playerId}`);
  const tile = result.tiles[player.position.row]?.[player.position.col];
  const target = currentObjective(player);
  if (!tile || !target || tile.objectId !== target) return { board, collected: false };
  const objectId = tile.objectId;
  delete tile.objectId;
  player.objectiveIndex += 1;
  return { board: result, collected: true, objectId };
}
