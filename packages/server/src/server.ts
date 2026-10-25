import { createServer } from "node:http";
import { Server } from "socket.io";
import { RoomManager } from "./roomManager.js";
import type { ClientToServerEvents, ServerToClientEvents } from "./protocol.js";

const httpServer = createServer();
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, { cors: { origin: true } });
const manager = new RoomManager();
const sessions = new Map<string, { code: string; playerId: string; sessionToken: string }>();

io.on("connection", (socket) => {
  const fail = (error: unknown) => socket.emit("error", { message: error instanceof Error ? error.message : "Unexpected error" });
  const broadcastRoom = (code: string) => io.to(code).emit("room:state", manager.getRoomState(code));

  socket.on("room:create", ({ name }) => { try { const result = manager.createRoom(name); sessions.set(socket.id, { code: result.room.code, playerId: result.playerId, sessionToken: result.sessionToken }); socket.join(result.room.code); socket.emit("room:created", { code: result.room.code, playerId: result.playerId, sessionToken: result.sessionToken }); broadcastRoom(result.room.code); } catch (error) { fail(error); } });
  socket.on("room:join", ({ code, name, sessionToken }) => { try { const result = manager.joinRoom(code, name, sessionToken); sessions.set(socket.id, { code: result.room.code, playerId: result.playerId, sessionToken: result.sessionToken }); socket.join(result.room.code); socket.emit("room:created", { code: result.room.code, playerId: result.playerId, sessionToken: result.sessionToken }); broadcastRoom(result.room.code); } catch (error) { fail(error); } });
  socket.on("room:start", () => { try { const session = sessions.get(socket.id); if (!session) throw new Error("Join a room first"); io.to(session.code).emit("game:state", manager.start(session.code, session.playerId)); for (const current of io.sockets.sockets.values()) if (sessions.get(current.id)?.code === session.code) current.emit("game:private-state", manager.getPrivateState(session.code, sessions.get(current.id)!.playerId)); } catch (error) { fail(error); } });
  socket.on("game:rotate", ({ quarterTurns }) => { try { const session = sessions.get(socket.id); if (!session) throw new Error("Join a room first"); io.to(session.code).emit("game:state", manager.rotate(session.code, session.playerId, quarterTurns)); } catch (error) { fail(error); } });
  socket.on("game:insert", ({ insertion }) => { try { const session = sessions.get(socket.id); if (!session) throw new Error("Join a room first"); io.to(session.code).emit("game:state", manager.doInsert(session.code, session.playerId, insertion)); } catch (error) { fail(error); } });
  socket.on("game:move", ({ destination }) => { try { const session = sessions.get(socket.id); if (!session) throw new Error("Join a room first"); const result = manager.move(session.code, session.playerId, destination); io.to(session.code).emit("game:state", result.state); socket.emit("game:private-state", result.privateState); if (result.collected && !result.victory) for (const current of io.sockets.sockets.values()) if (sessions.get(current.id)?.code === session.code) { const currentSession = sessions.get(current.id)!; current.emit("game:private-state", manager.getPrivateState(session.code, currentSession.playerId)); } if (result.victory) io.to(session.code).emit("game:victory", result.victory); } catch (error) { fail(error); } });
  socket.on("turn:end", () => { try { const session = sessions.get(socket.id); if (!session) throw new Error("Join a room first"); io.to(session.code).emit("game:state", manager.endTurn(session.code, session.playerId)); for (const current of io.sockets.sockets.values()) if (sessions.get(current.id)?.code === session.code) { const currentSession = sessions.get(current.id)!; current.emit("game:private-state", manager.getPrivateState(session.code, currentSession.playerId)); } } catch (error) { fail(error); } });
});

const port = Number(process.env.PORT ?? 3001);
httpServer.listen(port, () => console.log(`Laberinto server listening on http://localhost:${port}`));
