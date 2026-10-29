# Laberinto Dinámico

MVP en construcción para un juego de laberinto multijugador. La Fase 1 contiene el motor independiente del tablero en `packages/engine`.

## Ejecutar

```bash
npm install
npm test
npm run verify
```

La generación acepta una semilla (`generateBoard({ seed: 42 })`) para reproducir tableros. Las posiciones pares `(fila, columna)` son fijas; las inserciones sólo aceptan filas o columnas 1, 3, 5 y 7. La operación `insert` devuelve un nuevo estado, desplaza la pieza adicional y transporta las fichas de jugadores que estén en la línea.
