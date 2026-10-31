import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { io } from "socket.io-client";
import {
  addPlayer,
  BOARD_SIZE,
  canMove,
  canEscape,
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
  INSERTION_ANIMATION_DURATION_MS,
  isReverseInsertion,
} from "./insertionControls.js";
import {
  createInsertionAnimation,
  hasInsertedSpare,
  isInInsertionLine,
  type InsertionAnimation,
} from "./insertionAnimation.js";

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
const OBJECTIVE_ICONS = [
  "/objectives/gem-chain.svg",
  "/objectives/crown.svg",
  "/objectives/scroll-quill.svg",
  "/objectives/pendant-key.svg",
  "/objectives/diamond-trophy.svg",
  "/objectives/crown-coin.svg",
] as const;
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
const describePosition = (position: Position) =>
  `(${position.row}, ${position.col})`;

function objectiveIcon(objectId: string): string {
  const number = Number(/^object-(\d+)$/.exec(objectId)?.[1]);
  return Number.isInteger(number) && number > 0
    ? OBJECTIVE_ICONS[(number - 1) % OBJECTIVE_ICONS.length]!
    : OBJECTIVE_ICONS[0];
}

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
  hidden = false,
  onClick,
}: {
  tile: Tile;
  active: boolean;
  objective?: boolean;
  doorState?: "open" | "closed";
  disabled?: boolean;
  hidden?: boolean;
  onClick: () => void;
}) {
  const labels = [`Celda ${tile.id}`];
  if (tile.objectId) labels.push(`Objetivo ${tile.objectId}`);
  if (doorState)
    labels.push(`Puerta ${doorState === "open" ? "abierta" : "cerrada"}`);
  return (
    <button
      className={`cell ${tile.fixed ? "fixed" : ""} ${active ? "reachable" : ""} ${hidden ? "cell-hidden" : ""}`}
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
            <image
              className="object-icon"
              href={objectiveIcon(tile.objectId)}
              x="12"
              y="12"
              width={CELL - 24}
              height={CELL - 24}
              preserveAspectRatio="xMidYMid meet"
              aria-hidden="true"
            />
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
  const receivedServerGameRef = useRef(false);
  const insertionSequence = useRef(0);
  const [insertionAnimation, setInsertionAnimation] = useState<
    InsertionAnimation & { id: number }
  >();
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
    const previous = boardRef.current;
    const insertion = serverGame.lastInsertion;
    const isNewInsertion =
      receivedServerGameRef.current && insertion && hasInsertedSpare(previous, serverGame);
    if (isNewInsertion) {
      setInsertionAnimation({
        ...createInsertionAnimation(previous, insertion),
        id: ++insertionSequence.current,
      });
    }
    receivedServerGameRef.current = true;
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
    if (isNewInsertion) {
      // Las fichas viajan con sus piezas, no por caminos calculados sobre el tablero anterior.
      animationTimers.current.forEach((timers) => timers.forEach((timer) => clearTimeout(timer)));
      animationTimers.current.clear();
      setInstantTokens(Object.fromEntries(next.players.map((remote) => [remote.id, true])));
      setVisualPositions(
        Object.fromEntries(next.players.map((remote) => [remote.id, remote.position])),
      );
    } else {
      for (const remote of next.players)
        animateToken(previous, remote.id, remote.position);
    }
  }, [serverGame, privateObjective, playerId]);
  // Independiente de actualizaciones privadas/de red: no reinicia ni interrumpe la animación.
  useEffect(() => {
    if (!insertionAnimation) return;
    const timer = setTimeout(() => {
      setInsertionAnimation((current) =>
        current?.id === insertionAnimation.id ? undefined : current,
      );
    }, INSERTION_ANIMATION_DURATION_MS + 250);
    return () => clearTimeout(timer);
  }, [insertionAnimation]);
  useEffect(() => {
    if (!insertionAnimation) setInstantTokens({});
  }, [insertionAnimation]);
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
    inserting: Boolean(insertionAnimation),
  });
  keyboardState.current = {
    board, playerId, myTurn, phase: serverGame?.phase,
    inserting: Boolean(insertionAnimation),
  };
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
  const pasteAndJoinRoom = async () => {
    try {
      const code = (await navigator.clipboard.readText()).trim();
      if (!code)
        return setError("El portapapeles no contiene un código de sala");
      setJoinCode(code.toUpperCase());
      if (!name.trim()) return setError("Escribe tu nombre");
      socket.connect();
      socket.emit("room:join", { code: code.toUpperCase(), name });
    } catch {
      setError("No se pudo leer el código del portapapeles");
    }
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
    if (!insertionAnimation && myTurn && serverGame?.phase === "INSERTION")
      socket.emit("game:insert", { insertion });
  };
  const move = (position: Position) => {
    if (
      myTurn &&
      !insertionAnimation &&
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
          inserting,
        } = keyboardState.current;
        const currentPlayer = currentBoard.players.find(
          (candidate) => candidate.id === currentPlayerId,
        );
        if (inserting || !currentPlayer || !currentTurn || phase !== "MOVEMENT") return;
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
  const canInsert = !insertionAnimation && myTurn && serverGame?.phase === "INSERTION";
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
    return owner && canEscape(board, owner.id)
      ? ("open" as const)
      : ("closed" as const);
  };

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
          <div className="join-room-actions">
            <button className="gold-button" onClick={joinRoom}>
              Unirse a sala
            </button>
            <button className="gold-button" onClick={pasteAndJoinRoom}>
              Pegar y unirse
            </button>
          </div>
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
            <div
              className="board"
              aria-busy={Boolean(insertionAnimation)}
              style={{ width: SIZE, height: SIZE }}
            >
              {board.tiles.map((row, r) =>
                row.map((tile, c) => (
                  <Cell
                    key={tile.id}
                    tile={tile}
                    objective={tile.objectId === privateObjective}
                    doorState={doorAt(r, c)}
                    active={!insertionAnimation && reachableCells.has(`${r},${c}`)}
                    disabled={Boolean(insertionAnimation)}
                    hidden={Boolean(
                      insertionAnimation &&
                      isInInsertionLine({ row: r, col: c }, insertionAnimation.insertion),
                    )}
                    onClick={() => move({ row: r, col: c })}
                  />
                )),
              )}
              {insertionAnimation && (
                <div
                  key={insertionAnimation.id}
                  className="insertion-layer"
                  style={{
                    "--insertion-x": `${insertionAnimation.shift.x * 100 / BOARD_SIZE}%`,
                    "--insertion-y": `${insertionAnimation.shift.y * 100 / BOARD_SIZE}%`,
                    animationDuration: `${INSERTION_ANIMATION_DURATION_MS}ms`,
                  } as CSSProperties}
                  aria-hidden="true"
                  onAnimationEnd={(event) => {
                    if (event.target === event.currentTarget)
                      setInsertionAnimation((current) =>
                        current?.id === insertionAnimation.id ? undefined : current,
                      );
                  }}
                >
                  {insertionAnimation.tiles.map(({ tile, position }) => (
                    <div
                      key={tile.id}
                      className="insertion-tile"
                      data-tile-id={tile.id}
                      data-row={position.row}
                      data-col={position.col}
                      style={{
                        left: `${position.col * 100 / BOARD_SIZE}%`,
                        top: `${position.row * 100 / BOARD_SIZE}%`,
                        width: `${100 / BOARD_SIZE}%`,
                        height: `${100 / BOARD_SIZE}%`,
                      }}
                    >
                      <Cell
                        tile={tile}
                        objective={tile.objectId === privateObjective}
                        active={false}
                        disabled
                        onClick={() => undefined}
                      />
                    </div>
                  ))}
                  {insertionAnimation.players.map((remote) => (
                    <div
                      key={remote.id}
                      className={`token player-token-${board.players.findIndex((player) => player.id === remote.id)}`}
                      style={{
                        left: `${(remote.position.col + 0.5) * 100 / BOARD_SIZE}%`,
                        top: `${(remote.position.row + 0.5) * 100 / BOARD_SIZE}%`,
                      }}
                    >
                      {"\u265e"}
                    </div>
                  ))}
                </div>
              )}
              {board.players.map((remote, index) => {
                if (insertionAnimation?.players.some((player) => player.id === remote.id)) return null;
                const position = visualPositions[remote.id] ?? null;
                return (
                  position && (
                    <div
                      className={`token player-token-${index} ${instantTokens[remote.id] ? "token-instant" : ""}`}
                      role="img"
                      aria-label={`Ficha de ${remote.id === playerId ? "tu jugador" : `jugador ${index + 1}`}`}
                      key={remote.id}
                      style={{
                        left: `${(position.col + 0.5) * 100 / BOARD_SIZE}%`,
                        top: `${(position.row + 0.5) * 100 / BOARD_SIZE}%`,
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
              {!insertionAnimation && (
                <Cell
                  tile={board.spare}
                  active={false}
                  disabled
                  onClick={() => undefined}
                />
              )}
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
            disabled={Boolean(insertionAnimation) || !myTurn || serverGame?.phase !== "MOVEMENT" || winner}
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
