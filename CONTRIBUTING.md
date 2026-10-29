# Contribuir

## Flujo local

```bash
npm install
npm run verify
```

Durante el desarrollo puede usarse `npm run test:watch`, `npm run dev:client` o `npm run dev:server`.

## Criterios de aceptación

- El código compila sin errores de TypeScript.
- Las pruebas existentes continúan pasando.
- Los cambios en reglas del juego incluyen pruebas deterministas.
- Los cambios de cliente y servidor conservan los contratos de `packages/server/src/protocol.ts`.
- La descripción del cambio indica riesgos, decisiones y cómo se verificó.

## Uso de IA

La IA puede ayudar a explorar, diseñar, implementar y revisar, pero los cambios requieren revisión humana. No se deben aceptar cambios basados únicamente en una explicación del modelo: deben estar respaldados por pruebas y compilación.
