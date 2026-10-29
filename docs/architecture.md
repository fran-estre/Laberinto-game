# Arquitectura

## Componentes

El repositorio usa npm workspaces:

```text
client (React/Vite) ── Socket.IO ── server
                                      │
                                      └── engine
```

`engine` es la fuente de verdad de las reglas del juego. Debe probarse sin navegador, red ni estado global. `server` coordina salas y conexiones. `client` presenta el estado y envía acciones del jugador.

## Principios

- Separar reglas de dominio, transporte y presentación.
- Preferir estados inmutables para transiciones reproducibles.
- Usar semillas para que la generación del tablero sea determinista.
- Validar en servidor las acciones recibidas del cliente.
- Mantener los contratos de red explícitos en `packages/server/src/protocol.ts`.

## Verificación

`npm run verify` es el punto de control local y de integración continua: tipos, pruebas y compilación del cliente y del servidor.
