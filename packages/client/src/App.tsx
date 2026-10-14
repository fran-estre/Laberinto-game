import { useMemo, useState } from "react";
import { addPlayer, generateBoard, insert, movePlayer, reachable, rotateSpare, type BoardState, type Direction, type Insertion, type Position, type Tile } from "@laberinto/engine";

const SIZE = 540;
const CELL = SIZE / 9;
const playerId = "player-1";
const INSERTABLE = [1, 3, 5, 7] as const;

function tilePath(tile: Tile): string {
  const openings: Record<Direction, string> = { N: `M ${CELL / 2} 0 L ${CELL / 2} ${CELL / 2}`, E: `M ${CELL} ${CELL / 2} L ${CELL / 2} ${CELL / 2}`, S: `M ${CELL / 2} ${CELL} L ${CELL / 2} ${CELL / 2}`, W: `M 0 ${CELL / 2} L ${CELL / 2} ${CELL / 2}` };
  const base: Direction[] = tile.shape === "I" ? ["N", "S"] : tile.shape === "L" ? ["N", "E"] : tile.shape === "T" ? ["N", "E", "W"] : ["N", "E", "S", "W"];
  const order: Direction[] = ["N", "E", "S", "W"];
  return base.map((direction) => openings[order[(order.indexOf(direction) + tile.rotation / 90) % 4]!]).join(" ");
}

function Cell({ tile, active, onClick }: { tile: Tile; active: boolean; onClick: () => void }) {
  return <button className={`cell ${tile.fixed ? "fixed" : ""} ${active ? "reachable" : ""}`} onClick={onClick} aria-label={`Celda ${tile.id}`}>
    <svg viewBox={`0 0 ${CELL} ${CELL}`}><rect width={CELL} height={CELL} className="stone" /><path d={tilePath(tile)} className="path" />{tile.objectId && <circle cx={CELL / 2} cy={CELL / 2} r="7" className="object" />}</svg>
  </button>;
}

export function App() {
  const [board, setBoard] = useState<BoardState>(() => addPlayer(generateBoard({ seed: 42 }), { id: playerId, position: { row: 0, col: 0 } }));
  const player = board.players.find((item) => item.id === playerId)!;
  const reachableCells = useMemo(() => new Set(reachable(board, player.position).map((position) => `${position.row},${position.col}`)), [board, player.position]);
  const [message, setMessage] = useState("Selecciona una celda iluminada para moverte.");
  const insertBoard = (insertion: Insertion) => { setBoard((current) => insert(current, insertion)); setMessage("Pieza insertada. Elige tu destino."); };
  const move = (position: Position) => { if (!reachableCells.has(`${position.row},${position.col}`)) return; setBoard((current) => movePlayer(current, playerId, position)); setMessage(`Jugador en (${position.row}, ${position.col}).`); };

  return <main><header><div><p className="eyebrow">MVP · FASE 3</p><h1>Laberinto Dinámico</h1><p className="subtitle">Elige un camino, desplaza las piezas y encuentra tu destino.</p></div><div className="badge">TU TURNO</div></header>
    <section className="layout"><div className="board-wrap"><div className="board" style={{ width: SIZE, height: SIZE }}>{board.tiles.map((row, r) => row.map((tile, c) => <Cell key={tile.id} tile={tile} active={reachableCells.has(`${r},${c}`)} onClick={() => move({ row: r, col: c })} />))}<div className="token" style={{ left: player.position.col * CELL + CELL / 2, top: player.position.row * CELL + CELL / 2 }}>♞</div></div><p className="message">{message}</p></div>
      <aside><div className="panel"><h2>Pieza adicional</h2><div className="spare"><Cell tile={board.spare} active={false} onClick={() => undefined} /></div><button className="gold-button" onClick={() => setBoard((current) => rotateSpare(current))}>↻ Rotar 90°</button></div><div className="panel"><h2>Inserción</h2><p className="hint">Elige cualquiera de las 16 entradas de las líneas móviles.</p><div className="controls">{INSERTABLE.map((index) => <div className="control-group" key={`row-${index}`}><span>Fila {index + 1}</span><button onClick={() => insertBoard({ axis: "row", index, from: "left" })}>←</button><button onClick={() => insertBoard({ axis: "row", index, from: "right" })}>→</button></div>)}{INSERTABLE.map((index) => <div className="control-group" key={`column-${index}`}><span>Col. {index + 1}</span><button onClick={() => insertBoard({ axis: "column", index, from: "top" })}>↑</button><button onClick={() => insertBoard({ axis: "column", index, from: "bottom" })}>↓</button></div>)}</div></div><div className="panel legend"><span className="dot player-dot" /> Tu posición <span className="dot reachable-dot" /> Alcanzable</div></aside></section>
  </main>;
}
