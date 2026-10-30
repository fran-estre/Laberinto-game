import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import {
  addPlayer,
  canMove,
  findRoute,
  generateBoard,
  reachable,
  type BoardState,
  type Direction,
  type Insertion,
  type Position,
  type Tile,
} from "@laberinto/engine";
import {
  isOutsidePosition,
  isWrapBetween,
  oppositeOutsidePosition,
  outsidePosition,
} from "./tokenAnimation.js";
import {
  adjacentPosition,
  directionForKey,
  isTextInputTarget,
  KEY_REPEAT_DELAY,
  KEY_REPEAT_INTERVAL,
} from "./keyboardControls.js";
import {
  INSERTABLE,
  insertionShift,
  isReverseInsertion,
} from "./insertionControls.js";

const SIZE = 540;
const CELL = SIZE / 9;
const FALLBACK_ID = "player-1";
const TOKEN_STEP_DURATION = 500;
const TOKEN_STEP_GAP = 50;
const START_POSITIONS: Position[] = [
  { row: 0, col: 0 },
  { row: 0, col: 8 },
  { row: 8, col: 0 },
  { row: 8, col: 8 },
];
type Screen = "home" | "lobby" | "game";
type ServerGameState = {
  board: Tile[][];
  spare: Tile;
  phase: "INSERTION" | "MOVEMENT" | "FINISHED";
  activePlayerId: string;
  lastInsertion?: Insertion;
  players: Array<{
    id: string;
    position: Position;
    objectivesCollected: number;
    objectivesTotal: number;
  }>;
};
type VisualPosition = Position | null;
let animatedTileOffsets = new Map<string, { x: number; y: number }>();
const describePosition = (position: Position) =>
  `(${position.row}, ${position.col})`;

function tilePath(tile: Tile): string {
  const openings: Record<Direction, string> = {
    N: `M ${CELL / 2} 0 L ${CELL / 2} ${CELL / 2}`,
    E: `M ${CELL} ${CELL / 2} L ${CELL / 2} ${CELL / 2}`,
    S: `M ${CELL / 2} ${CELL} L ${CELL / 2} ${CELL / 2}`,
    W: `M 0 ${CELL / 2} L ${CELL / 2} ${CELL / 2}`,
  };
  const base: Direction[] =
    tile.shape === "I"
      ? ["N", "S"]
      : tile.shape === "L"
        ? ["N", "E"]
        : tile.shape === "T"
          ? ["N", "E", "W"]
          : ["N", "E", "S", "W"];
  const order: Direction[] = ["N", "E", "S", "W"];
  return base
    .map(
      (direction) =>
        openings[order[(order.indexOf(direction) + tile.rotation / 90) % 4]!],
    )
    .join(" ");
}

function Cell({
  tile,
  active,
  objective,
  doorState,
  disabled = false,
  insertionOffset,
  onClick,
}: {
  tile: Tile;
  active: boolean;
  objective?: boolean;
  doorState?: "open" | "closed";
  disabled?: boolean;
  insertionOffset?: { x: number; y: number };
  onClick: () => void;
}) {
  const labels = [`Celda ${tile.id}`];
  if (tile.objectId) labels.push(`Objetivo ${tile.objectId}`);
  if (doorState)
    labels.push(`Puerta ${doorState === "open" ? "abierta" : "cerrada"}`);
  const offset = insertionOffset ?? animatedTileOffsets.get(tile.id);
  const style = offset
    ? { transform: `translate(${offset.x * CELL}px, ${offset.y * CELL}px)` }
    : undefined;
  return (
    <button
      className={`cell ${tile.fixed ? "fixed" : ""} ${active ? "reachable" : ""} ${offset ? "tile-insertion" : ""}`}
      style={style}
      onClick={onClick}
      aria-label={labels.join(", ")}
      disabled={disabled}
    >
      <svg viewBox={`0 0 ${CELL} ${CELL}`} aria-hidden="true">
        <rect width={CELL} height={CELL} className="stone" />
        <path d={tilePath(tile)} className="path" />
        {tile.objectId && (
          <g
            className={`object ${objective ? "current-objective" : "future-objective"}`}
          >
            <path
              d={`M ${CELL / 2} 10 L ${CELL / 2 + 8} ${CELL / 2} L ${CELL / 2} ${CELL - 10} L ${CELL / 2 - 8} ${CELL / 2} Z`}
            />
            <circle cx={CELL / 2} cy={CELL / 2} r="3" />
          </g>
        )}
        {doorState && (
          <g className={`door door-${doorState}`}>
            <rect x="8" y="8" width={CELL - 16} height={CELL - 16} rx="5" />
            <path d={`M ${CELL / 2} 8 V ${CELL / 2 - 8}`} />
            <circle cx={CELL / 2} cy={CELL / 2 + 2} r="3" />
          </g>
        )}
      </svg>
    </button>
  );
}

function createDemoBoard(): BoardState {
  let board = addPlayer(generateBoard({ seed: 42 }), {
    id: FALLBACK_ID,
    position: { row: 0, col: 0 },
    startPosition: { row: 0, col: 0 },
    objectives: ["relic-1"],
    objectiveIndex: 0,
  });
  board.tiles[0]![1]!.objectId = "relic-1";
  return board;
}

export function App() {
  const socket = useMemo(
    () =>
      io(import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001", {
        autoConnect: false,
      }),
    [],
  );
  const [screen, setScreen] = useState<Screen>("home");
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [copiedRoomCode, setCopiedRoomCode] = useState(false);
  const [room, setRoom] = useState<{
    code: string;
    hostId: string;
    started: boolean;
    players: Array<{ id: string; name: string; connected: boolean }>;
  } | null>(null);
  const [myPlayerId, setMyPlayerId] = useState("");
  const [error, setError] = useState("");
  const [serverGame, setServerGame] = useState<ServerGameState | null>(null);
  const [privateObjective, setPrivateObjective] = useState<string>();
  const [privateProgress, setPrivateProgress] = useState({
    index: 0,
    total: 0,
  });
  const [board, setBoard] = useState<BoardState>(createDemoBoard);
  const boardRef = useRef(board);
  const animationTimers = useRef(
    new Map<string, ReturnType<typeof setTimeout>[]>(),
  );
  const lastInsertionRef = useRef<Insertion>();
  const receivedServerGameRef = useRef(false);
  const [insertionAnimation, setInsertionAnimation] = useState<{
    insertion: Insertion;
    active: boolean;
  }>();
  const [visualPositions, setVisualPositions] = useState<
    Record<string, VisualPosition>
  >(() =>
    Object.fromEntries(
      board.players.map((player) => [player.id, player.position]),
    ),
  );
  const [instantTokens, setInstantTokens] = useState<Record<string, boolean>>(
    {},
  );
  const [winner, setWinner] = useState(false);

  useEffect(() => {
    const onCreated = (data: { code: string; playerId: string }) => {
      setMyPlayerId(data.playerId);
      setJoinCode(data.code);
      setScreen("lobby");
    };
    const onRoom = (data: typeof room) => setRoom(data);
    const onGame = (data: ServerGameState) => {
      setServerGame(data);
      setScreen("game");
    };
    const onPrivate = (data: {
      currentObjective?: string;
      objectiveIndex: number;
      objectiveTotal: number;
    }) => {
      setPrivateObjective(data.currentObjective);
      setPrivateProgress({
        index: data.objectiveIndex,
        total: data.objectiveTotal,
      });
    };
    const onVictory = () => setWinner(true);
    const onError = (data: { message: string }) => setError(data.message);
    socket.on("room:created", onCreated);
    socket.on("room:state", onRoom);
    socket.on("game:state", onGame);
    socket.on("game:private-state", onPrivate);
    socket.on("game:victory", onVictory);
    socket.on("error", onError);
    return () => {
      socket.off("room:created", onCreated);
      socket.off("room:state", onRoom);
      socket.off("game:state", onGame);
      socket.off("game:private-state", onPrivate);
      socket.off("game:victory", onVictory);
      socket.off("error", onError);
      socket.disconnect();
    };
  }, [socket]);

  const playerId = myPlayerId || FALLBACK_ID;
  useEffect(() => {
    if (!serverGame) return;
    let animationTimer: ReturnType<typeof setTimeout> | undefined;
    const insertion = serverGame.lastInsertion;
    const previousInsertion = lastInsertionRef.current;
    const isNewInsertion =
      insertion &&
      (!previousInsertion ||
        insertion.axis !== previousInsertion.axis ||
        insertion.index !== previousInsertion.index ||
        insertion.from !== previousInsertion.from);
    if (receivedServerGameRef.current && isNewInsertion) {
      setInsertionAnimation({ insertion, active: true });
      animationTimer = setTimeout(
        () => setInsertionAnimation({ insertion, active: false }),
        30,
      );
    }
    lastInsertionRef.current = insertion;
    receivedServerGameRef.current = true;
    const previous = boardRef.current;
    const next = {
      ...previous,
      tiles: serverGame.board,
      spare: serverGame.spare,
      players: serverGame.players.map((remote, index) => ({
        id: remote.id,
        position: remote.position,
        startPosition:
          previous.players.find((p) => p.id === remote.id)?.startPosition ??
          START_POSITIONS[index]!,
        objectives: Array.from({ length: remote.objectivesTotal }, (_, i) =>
          i === remote.objectivesCollected && remote.id === playerId
            ? (privateObjective ?? "")
            : "",
        ),
        objectiveIndex: remote.objectivesCollected,
      })),
    };
    boardRef.current = next;
    setBoard(next);
    for (const remote of next.players)
      animateToken(previous, remote.id, remote.position);
    return () => {
      if (animationTimer !== undefined) clearTimeout(animationTimer);
    };
  }, [serverGame, privateObjective, playerId]);
  const player =
    board.players.find((item) => item.id === playerId) ?? board.players[0]!;
  const reachableCells = useMemo(
    () =>
      new Set(
        reachable(board, player.position).map(
          (position) => `${position.row},${position.col}`,
        ),
      ),
    [board, player.position],
  );
  const myTurn = serverGame ? serverGame.activePlayerId === playerId : true;
  const keyboardState = useRef({
    board,
    playerId,
    myTurn,
    phase: serverGame?.phase,
  });
  keyboardState.current = { board, playerId, myTurn, phase: serverGame?.phase };
  const createRoom = () => {
    if (!name.trim()) return setError("Escribe tu nombre");
    socket.connect();
    socket.emit("room:create", { name });
  };
  const joinRoom = () => {
    if (!name.trim() || !joinCode.trim())
      return setError("Escribe tu nombre y código");
    socket.connect();
    socket.emit("room:join", { code: joinCode.trim().toUpperCase(), name });
  };
  const copyRoomCode = async () => {
    const code = room?.code ?? joinCode;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedRoomCode(true);
      setTimeout(() => setCopiedRoomCode(false), 2000);
    } catch {
      setError("No se pudo copiar el código de la sala");
    }
  };
  const insertBoard = (insertion: Insertion) => {
    if (myTurn && serverGame?.phase === "INSERTION")
      socket.emit("game:insert", { insertion });
  };
  const move = (position: Position) => {
    if (
      myTurn &&
      serverGame?.phase === "MOVEMENT" &&
      reachableCells.has(`${position.row},${position.col}`)
    )
      socket.emit("game:move", { destination: position });
  };
  useEffect(() => {
    if (screen !== "game") return;
    let heldKey: string | undefined;
    let repeatDelay: ReturnType<typeof setTimeout> | undefined;
    let repeatInterval: ReturnType<typeof setInterval> | undefined;
    const stopRepeating = () => {
      if (repeatDelay) clearTimeout(repeatDelay);
      if (repeatInterval) clearInterval(repeatInterval);
      heldKey = undefined;
      repeatDelay = undefined;
      repeatInterval = undefined;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const direction = directionForKey(event.key);
      if (!direction || isTextInputTarget(event.target) || event.repeat) return;
      event.preventDefault();
      stopRepeating();
      heldKey = event.key;
      const moveByDirection = (currentDirection: Direction) => {
        const {
          board: currentBoard,
          playerId: currentPlayerId,
          myTurn: currentTurn,
          phase,
        } = keyboardState.current;
        const currentPlayer = currentBoard.players.find(
          (candidate) => candidate.id === currentPlayerId,
        );
        if (!currentPlayer || !currentTurn || phase !== "MOVEMENT") return;
        const destination = adjacentPosition(
          currentPlayer.position,
          currentDirection,
        );
        if (canMove(currentBoard, currentPlayer.position, currentDirection))
          socket.emit("game:move", { destination });
      };
      moveByDirection(direction);
      repeatDelay = setTimeout(() => {
        repeatInterval = setInterval(() => {
          const heldDirection = heldKey ? directionForKey(heldKey) : undefined;
          if (heldDirection) moveByDirection(heldDirection);
        }, KEY_REPEAT_INTERVAL);
      }, KEY_REPEAT_DELAY);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === heldKey) stopRepeating();
    };
    const onWindowBlur = stopRepeating;
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onWindowBlur);
    return () => {
      stopRepeating();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, [screen, socket]);
  const animateToken = (
    previous: BoardState,
    playerIdToAnimate: string,
    destination: Position,
  ) => {
    const source = previous.players.find(
      (candidate) => candidate.id === playerIdToAnimate,
    )?.position;
    const timers = animationTimers.current.get(playerIdToAnimate) ?? [];
    timers.forEach((timer) => clearTimeout(timer));
    animationTimers.current.delete(playerIdToAnimate);
    const wasOutside =
      visualPositions[playerIdToAnimate] !== undefined &&
      visualPositions[playerIdToAnimate] !== null &&
      isOutsidePosition(visualPositions[playerIdToAnimate]!);
    if (wasOutside)
      setInstantTokens((current) => ({
        ...current,
        [playerIdToAnimate]: true,
      }));
    if (
      !source ||
      (source.row === destination.row && source.col === destination.col)
    ) {
      setVisualPositions((current) => ({
        ...current,
        [playerIdToAnimate]: destination,
      }));
      if (wasOutside)
        setTimeout(
          () =>
            setInstantTokens((current) => ({
              ...current,
              [playerIdToAnimate]: false,
            })),
          0,
        );
      return;
    }
    const directWrap = isWrapBetween(source, destination);
    const route =
      findRoute(previous, source, destination) ??
      (directWrap ? [source, destination] : null);
    if (!route || route.length < 2) {
      setVisualPositions((current) => ({
        ...current,
        [playerIdToAnimate]: destination,
      }));
      return;
    }
    console.groupCollapsed(
      `[Ficha ${playerIdToAnimate}] movimiento ${describePosition(source)} → ${describePosition(destination)}`,
    );
    console.log("Camino calculado:", route.map(describePosition).join(" → "));
    setVisualPositions((current) => ({
      ...current,
      [playerIdToAnimate]: route[0]!,
    }));
    const routeTimers: ReturnType<typeof setTimeout>[] = [];
    if (wasOutside)
      routeTimers.push(
        setTimeout(
          () =>
            setInstantTokens((current) => ({
              ...current,
              [playerIdToAnimate]: false,
            })),
          0,
        ),
      );
    let elapsed = 0;
    for (let index = 1; index < route.length; index++) {
      const from = route[index - 1]!;
      const position = route[index]!;
      if (isWrapBetween(from, position)) {
        const outside = outsidePosition(from);
        const oppositeOutside = oppositeOutsidePosition(position);
        routeTimers.push(
          setTimeout(() => {
            console.log(
              `Paso ${describePosition(from)} → ${describePosition(position)}: visible; sale del tablero hacia ${describePosition(outside)}.`,
            );
            setVisualPositions((current) => ({
              ...current,
              [playerIdToAnimate]: outside,
            }));
          }, elapsed + TOKEN_STEP_GAP),
        );
        routeTimers.push(
          setTimeout(
            () => {
              console.log(
                `Paso ${describePosition(from)} → ${describePosition(position)}: oculta; se reubica en ${describePosition(oppositeOutside)}.`,
              );
              setInstantTokens((current) => ({
                ...current,
                [playerIdToAnimate]: true,
              }));
              setVisualPositions((current) => ({
                ...current,
                [playerIdToAnimate]: oppositeOutside,
              }));
            },
            elapsed + TOKEN_STEP_GAP + TOKEN_STEP_DURATION + 20,
          ),
        );
        routeTimers.push(
          setTimeout(
            () => {
              console.log(
                `Paso ${describePosition(from)} → ${describePosition(position)}: oculta → visible; entra hasta el centro de ${describePosition(position)}.`,
              );
              setInstantTokens((current) => ({
                ...current,
                [playerIdToAnimate]: false,
              }));
              setVisualPositions((current) => ({
                ...current,
                [playerIdToAnimate]: position,
              }));
            },
            elapsed + TOKEN_STEP_GAP + TOKEN_STEP_DURATION + 40,
          ),
        );
        elapsed +=
          TOKEN_STEP_GAP + TOKEN_STEP_DURATION + 40 + TOKEN_STEP_DURATION;
      } else {
        routeTimers.push(
          setTimeout(() => {
            console.log(
              `Paso ${describePosition(from)} → ${describePosition(position)}: visible; centro → centro.`,
            );
            setVisualPositions((current) => ({
              ...current,
              [playerIdToAnimate]: position,
            }));
          }, elapsed + TOKEN_STEP_GAP),
        );
        elapsed += TOKEN_STEP_GAP + TOKEN_STEP_DURATION;
      }
    }
    routeTimers.push(setTimeout(() => console.groupEnd(), elapsed + 550));
    animationTimers.current.set(playerIdToAnimate, routeTimers);
  };
  const canInsert = myTurn && serverGame?.phase === "INSERTION";
  const insertionButton = (
    insertion: Insertion,
    label: string,
    symbol: string,
  ) => {
    const blocked =
      !canInsert || isReverseInsertion(serverGame?.lastInsertion, insertion);
    return (
      <button
        className="insertion-arrow"
        disabled={blocked}
        aria-label={label}
        title={
          blocked && canInsert
            ? "La inserción inversa inmediata está prohibida"
            : label
        }
        onClick={() => insertBoard(insertion)}
      >
        <span className="insertion-dot" aria-hidden="true" />
      </button>
    );
  };
  const doorAt = (row: number, col: number) => {
    if (
      !START_POSITIONS.some(
        (position) => position.row === row && position.col === col,
      )
    )
      return undefined;
    const owner = board.players.find(
      (candidate) =>
        candidate.startPosition.row === row &&
        candidate.startPosition.col === col,
    );
    return owner && owner.objectiveIndex >= owner.objectives.length
      ? ("open" as const)
      : ("closed" as const);
  };
  const insertionOffsetFor = (row: number, col: number) => {
    const insertion = insertionAnimation?.active
      ? insertionAnimation.insertion
      : undefined;
    if (
      !insertion ||
      (insertion.axis === "row"
        ? row !== insertion.index
        : col !== insertion.index)
    )
      return undefined;
    return insertionShift(insertion);
  };
  const tileOffsets: Array<readonly [string, { x: number; y: number }]> = [];
  board.tiles.forEach((row, rowIndex) =>
    row.forEach((tile, col) => {
      const offset = insertionOffsetFor(rowIndex, col);
      if (offset) tileOffsets.push([tile.id, offset]);
    }),
  );
  animatedTileOffsets = new Map(tileOffsets);

  if (screen === "home")
    return (
      <main className="lobby-screen">
        <div className="lobby-card">
          <p className="eyebrow">MVP · MULTIJUGADOR</p>
          <h1>Laberinto Dinámico</h1>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Tu nombre"
          />
          <button className="gold-button" onClick={createRoom}>
            Crear sala
          </button>
          <div className="divider">o unirse con código</div>
          <input
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value)}
            placeholder="Código de sala"
          />
          <button className="gold-button" onClick={joinRoom}>
            Unirse a sala
          </button>
          {error && <p className="error">{error}</p>}
        </div>
      </main>
    );
  if (screen === "lobby")
    return (
      <main className="lobby-screen">
        <div className="lobby-card">
          <p className="eyebrow">SALA DE ESPERA</p>
          <h1>{room?.code ?? joinCode}</h1>
          <button className="copy-room-code" onClick={copyRoomCode}>
            {copiedRoomCode ? "Código copiado" : "Copiar código"}
          </button>
          <p>Comparte este código.</p>
          <div className="players">
            {room?.players.map((remote) => (
              <div className="player-row" key={remote.id}>
                <span className="dot player-dot" />
                {remote.name}
                {remote.id === room.hostId && " · anfitrión"}
              </div>
            ))}
          </div>
          {room?.hostId === myPlayerId ? (
            <button
              className="gold-button"
              disabled={!room || room.players.length < 2}
              onClick={() => socket.emit("room:start")}
            >
              Iniciar partida
            </button>
          ) : (
            <p className="hint">Esperando al anfitrión…</p>
          )}
          {error && <p className="error">{error}</p>}
        </div>
      </main>
    );

  return (
    <main>
      <header></header>
      <section className="layout">
        <div className="board-wrap">
          <div className="board-stage">
            <div
              className="insertion-arrows"
              aria-label="Puntos de inserción de la pieza móvil"
            >
              {INSERTABLE.map((index) => (
                <div className="insertion-row" key={`row-${index}`}>
                  {insertionButton(
                    { axis: "row", index, from: "left" },
                    `Insertar desde la izquierda en la fila ${index + 1}`,
                    "→",
                  )}
                  {insertionButton(
                    { axis: "row", index, from: "right" },
                    `Insertar desde la derecha en la fila ${index + 1}`,
                    "←",
                  )}
                </div>
              ))}
              {INSERTABLE.map((index) => (
                <div className="insertion-column" key={`column-${index}`}>
                  {insertionButton(
                    { axis: "column", index, from: "top" },
                    `Insertar desde arriba en la columna ${index + 1}`,
                    "↓",
                  )}
                  {insertionButton(
                    { axis: "column", index, from: "bottom" },
                    `Insertar desde abajo en la columna ${index + 1}`,
                    "↑",
                  )}
                </div>
              ))}
            </div>
            <div className="board" style={{ width: SIZE, height: SIZE }}>
              {board.tiles.map((row, r) =>
                row.map((tile, c) => (
                  <Cell
                    key={tile.id}
                    tile={tile}
                    objective={tile.objectId === privateObjective}
                    doorState={doorAt(r, c)}
                    active={reachableCells.has(`${r},${c}`)}
                    onClick={() => move({ row: r, col: c })}
                  />
                )),
              )}
              {board.players.map((remote, index) => {
                const position = visualPositions[remote.id] ?? null;
                return (
                  position && (
                    <div
                      className={`token player-token-${index} ${instantTokens[remote.id] ? "token-instant" : ""}`}
                      role="img"
                      aria-label={`Ficha de ${remote.id === playerId ? "tu jugador" : `jugador ${index + 1}`}`}
                      key={remote.id}
                      style={{
                        left: position.col * CELL + CELL / 2,
                        top: position.row * CELL + CELL / 2,
                      }}
                    >
                      ♞
                    </div>
                  )
                );
              })}
            </div>
          </div>
        </div>
        <aside className="game-sidebar">
          <section className="panel turn-panel">
            <div>
              <p className="eyebrow">MVP · FASE 4</p>
              <h1>Laberinto Dinámico</h1>
            </div>
            <div className="turn-info">
              <div className="badge">
                {myTurn ? "TU TURNO" : "TURNO DEL RIVAL"}
              </div>
              <div className="objective-summary">
                <span>Objetivo actual</span>
                <strong>{privateObjective ?? "Completados"}</strong>
                <small>
                  Progreso: {privateProgress.index} / {privateProgress.total}
                </small>
              </div>
            </div>
          </section>

          <section className="panel spare-panel">
            <h2>Pieza adicional</h2>
            <div className="spare">
              <Cell
                tile={board.spare}
                active={false}
                disabled
                onClick={() => undefined}
              />
            </div>
            <button
              className="gold-button"
              disabled={!canInsert}
              onClick={() => socket.emit("game:rotate", { quarterTurns: 1 })}
            >
              ↻ Rotar 90°
            </button>
          </section>
          <button
            className="gold-button end-turn-right"
            disabled={!myTurn || serverGame?.phase !== "MOVEMENT" || winner}
            onClick={() => socket.emit("turn:end")}
          >
            Finalizar turno
          </button>
          {winner && (
            <p className="message">¡Victoria! Has escapado del laberinto.</p>
          )}
        </aside>
      </section>
    </main>
  );
}
