import type { Insertion, Position } from "@laberinto/engine";

export type ClientToServerEvents = {
  "room:create": (payload: { name: string }) => void;
  "room:join": (payload: { code: string; name: string; sessionToken?: string }) => void;
  "room:start": () => void;
  "game:rotate": (payload: { quarterTurns?: number }) => void;
  "game:insert": (payload: { insertion: Insertion }) => void;
  "game:move": (payload: { destination: Position }) => void;
  "turn:end": () => void;
};

export type ServerToClientEvents = {
  "room:created": (payload: { code: string; playerId: string; sessionToken: string }) => void;
  "room:state": (payload: PublicRoomState) => void;
  "game:state": (payload: PublicGameState) => void;
  "game:private-state": (payload: PrivateGameState) => void;
  "game:victory": (payload: { winnerId: string; winnerName: string }) => void;
  error: (payload: { message: string }) => void;
};

export interface PublicPlayerState { id: string; name: string; position: Position; connected: boolean; objectivesCollected: number; objectivesTotal: number }
export interface PublicRoomState { code: string; hostId: string; started: boolean; players: PublicPlayerState[] }
export interface PublicGameState { code: string; phase: "INSERTION" | "MOVEMENT" | "FINISHED"; activePlayerId: string; players: PublicPlayerState[]; board: unknown; spare: unknown }
export interface PrivateGameState { currentObjective?: string; objectiveIndex: number; objectiveTotal: number }
