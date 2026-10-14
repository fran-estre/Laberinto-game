export const BOARD_SIZE = 9 as const;
export type Direction = "N" | "E" | "S" | "W";
export type TileShape = "I" | "L" | "T" | "CROSS";
export type Rotation = 0 | 90 | 180 | 270;

export interface Position { row: number; col: number }
export interface Tile {
  id: string;
  shape: TileShape;
  rotation: Rotation;
  fixed: boolean;
  objectId?: string;
}
export interface PlayerToken { id: string; position: Position }
export interface BoardState {
  tiles: Tile[][];
  spare: Tile;
  players: PlayerToken[];
}
export type Insertion =
  | { axis: "row"; index: 1 | 3 | 5 | 7; from: "left" | "right" }
  | { axis: "column"; index: 1 | 3 | 5 | 7; from: "top" | "bottom" };
