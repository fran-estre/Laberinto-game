import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { addPlayer, generateBoard, reachable, type BoardState, type Direction, type Insertion, type Position, type Tile } from "@laberinto/engine";

const SIZE = 540;
const CELL = SIZE / 9;
const FALLBACK_ID = "player-1";
const INSERTABLE = [1, 3, 5, 7] as const;
const START_POSITIONS: Position[] = [{ row: 0, col: 0 }, { row: 0, col: 8 }, { row: 8, col: 0 }, { row: 8, col: 8 }];
type Screen = "home" | "lobby" | "game";
type ServerGameState = { board: Tile[][]; spare: Tile; phase: "INSERTION" | "MOVEMENT" | "FINISHED"; activePlayerId: string; players: Array<{ id: string; position: Position; objectivesCollected: number; objectivesTotal: number }> };

function tilePath(tile: Tile): string {
  const openings: Record<Direction, string> = { N: `M ${CELL / 2} 0 L ${CELL / 2} ${CELL / 2}`, E: `M ${CELL} ${CELL / 2} L ${CELL / 2} ${CELL / 2}`, S: `M ${CELL / 2} ${CELL} L ${CELL / 2} ${CELL / 2}`, W: `M 0 ${CELL / 2} L ${CELL / 2} ${CELL / 2}` };
  const base: Direction[] = tile.shape === "I" ? ["N", "S"] : tile.shape === "L" ? ["N", "E"] : tile.shape === "T" ? ["N", "E", "W"] : ["N", "E", "S", "W"];
  const order: Direction[] = ["N", "E", "S", "W"];
  return base.map((direction) => openings[order[(order.indexOf(direction) + tile.rotation / 90) % 4]!]).join(" ");
}

function Cell({ tile, active, objective, exit, onClick }: { tile: Tile; active: boolean; objective?: boolean; exit?: boolean; onClick: () => void }) {
  return <button className={`cell ${tile.fixed ? "fixed" : ""} ${active ? "reachable" : ""}`} onClick={onClick} aria-label={`Celda ${tile.id}`}><svg viewBox={`0 0 ${CELL} ${CELL}`}><rect width={CELL} height={CELL} className="stone" /><path d={tilePath(tile)} className="path" />{tile.objectId && <circle cx={CELL / 2} cy={CELL / 2} r="8" className={`object ${objective ? "current-objective" : "future-objective"}`} />}{exit && <text x={CELL - 11} y="16" className="exit-mark">!</text>}</svg></button>;
}

function createDemoBoard(): BoardState {
  let board = addPlayer(generateBoard({ seed: 42 }), { id: FALLBACK_ID, position: { row: 0, col: 0 }, startPosition: { row: 0, col: 0 }, objectives: ["relic-1"], objectiveIndex: 0 });
  board.tiles[0]![1]!.objectId = "relic-1";
  return board;
}

export function App() {
  const socket = useMemo(() => io(import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001", { autoConnect: false }), []);
  const [screen, setScreen] = useState<Screen>("home");
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [room, setRoom] = useState<{ code: string; hostId: string; started: boolean; players: Array<{ id: string; name: string; connected: boolean }> } | null>(null);
  const [myPlayerId, setMyPlayerId] = useState("");
  const [error, setError] = useState("");
  const [serverGame, setServerGame] = useState<ServerGameState | null>(null);
  const [privateObjective, setPrivateObjective] = useState<string>();
  const [privateProgress, setPrivateProgress] = useState({ index: 0, total: 0 });
  const [board, setBoard] = useState<BoardState>(createDemoBoard);
  const [winner, setWinner] = useState(false);

  useEffect(() => {
    const onCreated = (data: { code: string; playerId: string }) => { setMyPlayerId(data.playerId); setJoinCode(data.code); setScreen("lobby"); };
    const onRoom = (data: typeof room) => setRoom(data);
    const onGame = (data: ServerGameState) => { setServerGame(data); setScreen("game"); };
    const onPrivate = (data: { currentObjective?: string; objectiveIndex: number; objectiveTotal: number }) => { setPrivateObjective(data.currentObjective); setPrivateProgress({ index: data.objectiveIndex, total: data.objectiveTotal }); };
    const onVictory = () => setWinner(true);
    const onError = (data: { message: string }) => setError(data.message);
    socket.on("room:created", onCreated); socket.on("room:state", onRoom); socket.on("game:state", onGame); socket.on("game:private-state", onPrivate); socket.on("game:victory", onVictory); socket.on("error", onError);
    return () => { socket.off("room:created", onCreated); socket.off("room:state", onRoom); socket.off("game:state", onGame); socket.off("game:private-state", onPrivate); socket.off("game:victory", onVictory); socket.off("error", onError); socket.disconnect(); };
  }, [socket]);

  const playerId = myPlayerId || FALLBACK_ID;
  useEffect(() => {
    if (!serverGame) return;
    setBoard((current) => ({ ...current, tiles: serverGame.board, spare: serverGame.spare, players: serverGame.players.map((remote, index) => ({ id: remote.id, position: remote.position, startPosition: current.players.find((p) => p.id === remote.id)?.startPosition ?? START_POSITIONS[index]!, objectives: Array.from({ length: remote.objectivesTotal }, (_, i) => i === remote.objectivesCollected && remote.id === playerId ? privateObjective ?? "" : ""), objectiveIndex: remote.objectivesCollected })) }));
  }, [serverGame, privateObjective, playerId]);
  const player = board.players.find((item) => item.id === playerId) ?? board.players[0]!;
  const reachableCells = useMemo(() => new Set(reachable(board, player.position).map((position) => `${position.row},${position.col}`)), [board, player.position]);
  const myTurn = serverGame ? serverGame.activePlayerId === playerId : true;
  const [message, setMessage] = useState("Selecciona una casilla alcanzable.");
  const createRoom = () => { if (!name.trim()) return setError("Escribe tu nombre"); socket.connect(); socket.emit("room:create", { name }); };
  const joinRoom = () => { if (!name.trim() || !joinCode.trim()) return setError("Escribe tu nombre y código"); socket.connect(); socket.emit("room:join", { code: joinCode.trim().toUpperCase(), name }); };
  const insertBoard = (insertion: Insertion) => { if (myTurn && serverGame?.phase === "INSERTION") socket.emit("game:insert", { insertion }); };
  const move = (position: Position) => { if (myTurn && serverGame?.phase === "MOVEMENT" && reachableCells.has(`${position.row},${position.col}`)) socket.emit("game:move", { destination: position }); };

  if (screen === "home") return <main className="lobby-screen"><div className="lobby-card"><p className="eyebrow">MVP · MULTIJUGADOR</p><h1>Laberinto Dinámico</h1><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tu nombre" /><button className="gold-button" onClick={createRoom}>Crear sala</button><div className="divider">o unirse con código</div><input value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder="Código de sala" /><button className="gold-button" onClick={joinRoom}>Unirse a sala</button>{error && <p className="error">{error}</p>}</div></main>;
  if (screen === "lobby") return <main className="lobby-screen"><div className="lobby-card"><p className="eyebrow">SALA DE ESPERA</p><h1>{room?.code ?? joinCode}</h1><p>Comparte este código.</p><div className="players">{room?.players.map((remote) => <div className="player-row" key={remote.id}><span className="dot player-dot" />{remote.name}{remote.id === room.hostId && " · anfitrión"}</div>)}</div>{room?.hostId === myPlayerId ? <button className="gold-button" disabled={!room || room.players.length < 2} onClick={() => socket.emit("room:start")}>Iniciar partida</button> : <p className="hint">Esperando al anfitrión…</p>}{error && <p className="error">{error}</p>}</div></main>;

  return <main><header><div><p className="eyebrow">MVP · FASE 4</p><h1>Laberinto Dinámico</h1><p className="subtitle">{myTurn ? "Tu turno" : "Turno del rival"}</p></div><div className="turn-info"><div className="badge">{myTurn ? "TU TURNO" : "TURNO DEL RIVAL"}</div><div className="objective-summary"><span>Objetivo actual</span><strong>{privateObjective ?? "Completados"}</strong><small>Progreso: {privateProgress.index} / {privateProgress.total}</small></div></div></header>
    <section className="layout"><div className="board-wrap"><div className="board" style={{ width: SIZE, height: SIZE }}>{board.tiles.map((row, r) => row.map((tile, c) => <Cell key={tile.id} tile={tile} objective={tile.objectId === privateObjective} exit={privateProgress.index >= privateProgress.total && player.startPosition.row === r && player.startPosition.col === c} active={reachableCells.has(`${r},${c}`)} onClick={() => move({ row: r, col: c })} />))}{board.players.map((remote) => <div className={`token ${remote.id === playerId ? "" : "other-token"}`} key={remote.id} style={{ left: remote.position.col * CELL + CELL / 2, top: remote.position.row * CELL + CELL / 2 }}>♞</div>)}</div><p className="message">{winner ? "¡Victoria! Has escapado del laberinto." : message}</p><button className="gold-button end-turn" disabled={!myTurn || serverGame?.phase !== "MOVEMENT" || winner} onClick={() => socket.emit("turn:end")}>Finalizar turno</button></div>
      <aside><div className="panel"><h2>Pieza adicional</h2><div className="spare"><Cell tile={board.spare} active={false} onClick={() => undefined} /></div><button className="gold-button" disabled={!myTurn || serverGame?.phase !== "INSERTION"} onClick={() => socket.emit("game:rotate", { quarterTurns: 1 })}>↻ Rotar 90°</button></div><div className="panel"><h2>Inserción</h2><p className="hint">Una inserción por turno.</p><div className="controls">{INSERTABLE.map((index) => <div className="control-group" key={`row-${index}`}><span>Fila {index + 1}</span><button onClick={() => insertBoard({ axis: "row", index, from: "left" })}>←</button><button onClick={() => insertBoard({ axis: "row", index, from: "right" })}>→</button></div>)}{INSERTABLE.map((index) => <div className="control-group" key={`column-${index}`}><span>Col. {index + 1}</span><button onClick={() => insertBoard({ axis: "column", index, from: "top" })}>↑</button><button onClick={() => insertBoard({ axis: "column", index, from: "bottom" })}>↓</button></div>)}</div></div></aside>
    </section>
  </main>;
}
