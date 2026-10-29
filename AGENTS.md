# Instrucciones para agentes de IA

## Contexto

Laberinto Dinámico es un juego multijugador TypeScript organizado como monorepo npm:

- `packages/engine`: lógica pura y reutilizable del juego.
- `packages/server`: salas y transporte Socket.IO.
- `packages/client`: interfaz React y cliente Socket.IO.

## Reglas de trabajo

- Responde en español, salvo que el usuario pida otro idioma.
- Inspecciona primero los archivos y cambios existentes antes de editar.
- No sobrescribas cambios locales que no pertenezcan a la tarea.
- Mantén TypeScript estricto y evita introducir `any` sin justificación.
- Mantén las reglas del juego en `packages/engine`; no dupliques esa lógica.
- Usa funciones puras e inmutabilidad en el motor cuando sea posible.
- Todo bug corregido debe tener una prueba de regresión.
- No agregues dependencias sin explicar su necesidad y coste.
- No incluyas secretos, credenciales ni datos personales en el repositorio.

## Flujo obligatorio

1. Explicar diagnóstico y plan.
2. Implementar el cambio mínimo necesario.
3. Ejecutar `npm run verify`.
4. Reportar archivos modificados, pruebas y limitaciones.
