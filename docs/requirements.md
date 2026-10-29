# Documento de requerimientos

## 1. Información general

**Proyecto:** Laberinto Dinámico  
**Tipo:** Juego de laberinto multijugador web  
**Versión:** Borrador inicial  
**Fuente:** Requerimientos del usuario

## 2. Objetivo

Permitir que cada jugador explore un tablero de laberinto, controle su ficha mediante el teclado, inserte la celda móvil desde posiciones válidas y recoja objetivos representados visualmente, manteniendo reglas de movimiento válidas y una experiencia visual fluida.

## 3. Alcance

Este documento cubre:

- distribución de objetivos;
- movimiento de fichas;
- representación y animación de fichas;
- controles visuales para insertar la celda móvil;
- representación gráfica de objetivos;
- identificación de las posiciones iniciales mediante puertas.

No define todavía reglas de puntuación, efectos de sonido, configuración de partidas ni diseño visual definitivo.

## 4. Requerimientos funcionales

### RF-01. Distribución aleatoria y equilibrada de objetivos

El sistema debe distribuir los objetivos de forma aleatoria al generar el tablero o iniciar una partida.

La distribución debe ser equilibrada: los objetivos deben repartirse entre las zonas del tablero evitando concentrarlos en una sola fila, columna o región. La implementación debe poder reproducirse mediante una semilla cuando se ejecute en modo de pruebas.

**Criterios de aceptación:**

- Cada objetivo se asigna a una celda válida.
- No existen dos objetivos en la misma celda.
- La distribución cambia entre partidas con semillas distintas.
- La distribución es reproducible con la misma semilla.
- Las zonas del tablero reciben una cantidad de objetivos que respeta el margen de equilibrio definido por diseño.

**Decisión pendiente:** definir el tamaño de las zonas y el margen máximo permitido entre zonas.

### RF-01A. Equilibrio mediante cuatro zonas

Para medir y controlar el equilibrio de objetivos, el tablero se dividirá en cuatro zonas de distribución. La asignación debe repartir los objetivos entre las cuatro zonas de acuerdo con el margen de equilibrio definido para la partida.

**Criterios de aceptación:**

- El tablero se divide lógicamente en cuatro zonas.
- El algoritmo considera las cuatro zonas al colocar objetivos.
- Ninguna zona queda sin objetivos cuando la cantidad total lo permite.
- La diferencia de objetivos entre la zona con más objetivos y la zona con menos objetivos no supera el margen configurado.

### RF-02. Movimiento mediante flechas del teclado

El jugador debe poder controlar su ficha con las teclas `ArrowUp`, `ArrowRight`, `ArrowDown` y `ArrowLeft`.

Cada pulsación debe intentar mover la ficha una celda en la dirección correspondiente. El movimiento sólo debe ejecutarse cuando exista un camino válido entre la celda actual y la celda destino.

**Criterios de aceptación:**

- Una flecha válida mueve la ficha a la celda adyacente correspondiente.
- Una flecha bloqueada no cambia la posición de la ficha.
- No se permite atravesar paredes.
- Se respetan las conexiones entre las dos celdas involucradas.
- El servidor valida el movimiento en partidas multijugador.
- El foco en campos de texto no debe provocar movimientos accidentales.

### RF-03. Representación y animación de la ficha

Cada jugador debe visualizarse como una ficha identificable sobre el tablero. Al moverse, la ficha debe desplazarse mediante una animación fluida entre la celda de origen y la celda destino.

**Criterios de aceptación:**

- Cada jugador tiene un color, icono o identificador visual distinto.
- La ficha permanece alineada con la cuadrícula.
- El desplazamiento no ocurre mediante un salto visual instantáneo cuando la animación está habilitada.
- La animación no modifica las reglas ni la posición lógica del jugador.
- La animación respeta la preferencia del sistema `prefers-reduced-motion`.

### RF-04. Indicadores para insertar la celda móvil

El tablero debe mostrar flechas alrededor de los puntos donde se permite insertar la celda móvil.

Las flechas deben indicar la dirección de inserción y deben permitir ejecutar la acción mediante clic. En la interfaz, las posiciones se mostrarán como columnas o filas 2, 4, 6 y 8; internamente corresponden a los índices 1, 3, 5 y 7 actualmente definidos por el motor.

**Criterios de aceptación:**

- Se muestran controles en las posiciones válidas del borde del tablero.
- Cada flecha indica claramente desde qué lado se insertará la celda móvil.
- Al hacer clic, se ejecuta la inserción correspondiente.
- Las posiciones no válidas no muestran controles activos.
- El control se deshabilita cuando no corresponde a la fase de inserción o cuando no es el turno del jugador.
- Se conserva la regla que impide realizar la inserción inversa inmediata.
- La acción se valida también en el servidor.

### RF-05. Figuras visuales para los objetivos

Los objetivos deben representarse mediante figuras o iconos visualmente diferenciables, en lugar de mostrarse únicamente como texto o identificadores.

**Criterios de aceptación:**

- Cada tipo de objetivo tiene una figura reconocible.
- La figura se muestra dentro de la celda que contiene el objetivo.
- La figura no oculta las conexiones del camino ni la ficha del jugador.
- La interfaz incluye una forma accesible de identificar el objetivo, por ejemplo texto alternativo o etiqueta.
- Recoger un objetivo elimina o actualiza visualmente su figura.

### RF-06. Símbolos de puerta en las posiciones iniciales

Las esquinas donde comienzan las fichas deben mostrar un símbolo de puerta para identificar las posiciones de inicio y retorno de los jugadores.

**Criterios de aceptación:**

- Cada posición inicial tiene un símbolo de puerta visible.
- El símbolo permanece asociado a la posición inicial aunque el tablero cambie por una inserción.
- Las puertas se diferencian de los objetivos y de las fichas.
- La lógica de escape o retorno continúa usando la posición inicial configurada para cada jugador.

### RF-07. Condición de victoria y escape

Gana el jugador que recoja todos los objetivos asignados y regrese a la puerta de la esquina donde inició.

La puerta debe indicar visualmente si el jugador puede escapar: permanecerá cerrada mientras falten objetivos y se mostrará abierta cuando el jugador haya recogido todos sus objetivos y esté en su posición inicial.

**Criterios de aceptación:**

- El jugador no puede ganar antes de recoger todos sus objetivos.
- El jugador sólo puede ganar al regresar a su puerta de inicio.
- La puerta se muestra abierta únicamente cuando se cumplen ambas condiciones.
- Al ganar, el servidor marca la partida o el jugador como ganador y notifica al cliente.
- La condición de victoria se valida en el servidor.

### RF-08. Tablero público de jugadores y objetivos recogidos

La interfaz debe mostrar un tablero o panel de estado con todos los jugadores de la partida y la cantidad o lista de objetivos que cada uno ya recogió.

**Criterios de aceptación:**

- Se muestra el nombre o identificador de cada jugador.
- Se muestra cuántos objetivos ha recogido cada jugador.
- El estado se actualiza después de recoger un objetivo.
- El tablero no revela objetivos todavía no recogidos que deban permanecer ocultos.
- El estado mostrado coincide con la información validada por el servidor.

### RF-09. Cantidad de objetivos según el número de jugadores

La cantidad de objetivos asignados debe calcularse según el número de jugadores de la partida. Para una partida de dos jugadores, cada jugador debe recibir siete objetivos.

La regla debe estar centralizada y ser configurable para soportar partidas con más jugadores sin duplicar lógica entre cliente, servidor y motor.

**Criterios de aceptación:**

- Con dos jugadores, cada jugador recibe exactamente siete objetivos.
- Ningún objetivo se asigna a más de un jugador.
- La cantidad total disponible permite completar las asignaciones de todos los jugadores.
- La interfaz muestra el progreso respecto al total asignado a cada jugador.

**Decisión pendiente:** definir explícitamente la cantidad de objetivos para partidas de tres y cuatro jugadores.

### RF-10. Movimiento por pulsación individual y tecla mantenida

El jugador debe poder mover su ficha mediante pulsaciones individuales y también manteniendo presionada una tecla de dirección.

Al mantener una tecla, el cliente debe repetir intentos de movimiento a intervalos controlados, sin saltarse las reglas del camino ni generar movimientos duplicados por eventos repetidos del navegador.

**Criterios de aceptación:**

- Una pulsación individual produce como máximo un intento de movimiento.
- Una tecla mantenida produce movimientos sucesivos mientras exista un camino válido.
- Al soltar la tecla, se detienen los nuevos intentos.
- Una pared o conexión inválida bloquea cada intento correspondiente.
- El servidor sigue validando cada movimiento.

### RF-11. Duración de la animación de movimiento

La ficha debe tardar medio segundo (`500 ms`) en cruzar una celda cuando se desplaza entre dos posiciones.

**Criterios de aceptación:**

- La transición visual de una celda a la siguiente dura `500 ms`.
- La posición lógica se actualiza de forma consistente con el estado del servidor.
- Las animaciones consecutivas no provocan saltos ni desincronización visual.
- La duración puede reducirse o desactivarse para usuarios con `prefers-reduced-motion`.

### RF-12. Estilo visual medieval

La interfaz debe utilizar un estilo visual medieval coherente con el concepto del juego.

El estilo debe reflejarse, como mínimo, en la paleta de colores, tipografías, marcos, iconografía de objetivos, fichas, puertas y controles de inserción.

**Criterios de aceptación:**

- El tablero, las fichas, los objetivos, las puertas y las flechas pertenecen al mismo lenguaje visual.
- El contraste permite distinguir caminos, fichas, objetivos y estados de puerta.
- El estilo no reduce la legibilidad ni la accesibilidad de los controles.
- Los estados de puerta abierta y cerrada son distinguibles por icono, color o ambos.

### RF-13. Puerta abierta como indicador de escape

Las puertas iniciales deben mostrar un estado cerrado o abierto. Una puerta abierta indica que el jugador asociado puede escapar y cumplir la condición de victoria al encontrarse en ella.

**Criterios de aceptación:**

- La puerta cerrada se muestra mientras existan objetivos pendientes.
- La puerta se abre al recoger el último objetivo asignado.
- La puerta permanece asociada al jugador y a su posición inicial después de insertar filas o columnas.
- Al regresar a una puerta abierta, el jugador puede finalizar la partida según la regla de victoria.

### RF-14. Modo jugador contra computadora

El sistema debe ofrecer una modalidad adicional en la que uno o más jugadores humanos puedan jugar contra un jugador controlado por la computadora.

La IA debe controlar una ficha, conocer y respetar todas las reglas del juego, desplazarse únicamente por caminos válidos, recoger sus objetivos asignados y buscar la condición de victoria: recoger todos sus objetivos y regresar a su puerta de inicio.

La IA debe participar en el mismo flujo de turnos que los jugadores humanos. Sus acciones deben ser validadas por el servidor igual que las acciones de un jugador humano.

Como alternativa de implementación, se podrá utilizar Minimax con una función de evaluación del estado. La estrategia definitiva deberá considerar el tamaño del espacio de estados, el tiempo de respuesta y la posibilidad de ofrecer diferentes niveles de dificultad.

**Criterios de aceptación:**

- El usuario puede seleccionar una partida contra la computadora antes de iniciar la partida.
- La ficha controlada por la computadora aparece en el tablero y tiene objetivos asignados.
- La IA realiza movimientos e inserciones únicamente cuando corresponde su turno.
- La IA no atraviesa paredes ni ejecuta acciones inválidas.
- La IA conoce sus objetivos actuales y puede elegir acciones que la acerquen a ellos.
- La IA reconoce cuándo puede regresar a su puerta y completar la condición de victoria.
- La partida termina cuando gana un jugador humano o la computadora.
- El servidor valida y sincroniza las acciones de la IA con todos los clientes.
- La interfaz comunica cuándo la computadora está pensando o ejecutando su turno.

## 5. Requerimientos no funcionales

- Las reglas de distribución, movimiento e inserción deben permanecer en `packages/engine`.
- El cliente no debe poder forzar movimientos o inserciones inválidos en el servidor.
- Las transiciones del motor deben conservar la inmutabilidad del estado observable.
- Los cambios de reglas deben incluir pruebas deterministas y reproducibles.
- La interfaz debe funcionar con teclado y ratón.
- Los controles visuales deben tener etiquetas accesibles y un estado visible de foco.
- La animación debe mantener una experiencia fluida sin bloquear la interacción del juego.

## 6. Impacto técnico previsto

| Área | Cambio esperado |
|---|---|
| `packages/engine` | Distribución equilibrada, movimiento por dirección y reglas de inserción verificables. |
| `packages/server` | Validación de movimientos, inserciones y sincronización de posiciones. |
| `packages/client` | Escucha de teclado, fichas animadas, flechas de inserción, figuras de objetivos y puertas. |
| Pruebas | Casos de distribución, caminos bloqueados, animación/estado y controles de inserción. |

## 7. Casos de prueba mínimos

1. Generar dos tableros con la misma semilla y comprobar que la distribución de objetivos coincide.
2. Generar tableros con semillas distintas y comprobar que pueden producir distribuciones diferentes.
3. Intentar mover una ficha contra una pared y comprobar que no cambia de posición.
4. Mover una ficha por un camino conectado y comprobar que llega a la celda destino.
5. Hacer clic en una flecha válida y comprobar que se aplica la inserción correcta.
6. Intentar insertar desde una flecha deshabilitada y comprobar que el estado no cambia.
7. Recoger un objetivo y comprobar que su figura desaparece o cambia de estado.
8. Insertar una celda y comprobar que las puertas siguen identificando las posiciones iniciales.

## 8. Casos de prueba adicionales

9. Iniciar una partida con dos jugadores y comprobar que cada uno recibe siete objetivos.
10. Recoger objetivos y comprobar que el tablero público actualiza el progreso del jugador.
11. Recoger todos los objetivos, volver a la puerta inicial y comprobar que la partida declara al jugador ganador.
12. Intentar escapar antes de recoger todos los objetivos y comprobar que la puerta permanece cerrada.
13. Mantener una flecha pulsada y comprobar que la ficha avanza por celdas válidas hasta soltarla.
14. Medir la transición de una ficha y comprobar que dura 500 ms.
15. Generar una partida y comprobar que los objetivos se distribuyen considerando cuatro zonas.
16. Comprobar que el estilo medieval se aplica al tablero, fichas, objetivos, puertas y controles.

## 9. Casos de prueba adicionales para la IA

17. Crear una partida contra la computadora y comprobar que la ficha de la IA aparece con objetivos asignados.
18. Comprobar que la IA sólo actúa durante su turno.
19. Configurar un tablero con un movimiento bloqueado y comprobar que la IA no atraviesa la pared.
20. Comprobar que la IA puede recoger un objetivo y que el tablero público actualiza su progreso.
21. Comprobar que la IA puede ganar al recoger todos sus objetivos y regresar a su puerta.
22. Comprobar que un jugador humano puede ganar contra la computadora.
23. Comprobar que las acciones de la IA son reproducibles en modo de prueba usando una semilla.

## 10. Decisiones pendientes

- Cuántos jugadores controlados por computadora se permitirán por partida.
- Cuáles serán los niveles de dificultad de la IA.
- Si se utilizará Minimax, búsqueda heurística u otra estrategia.
- Cuál será el tiempo máximo de respuesta de la IA por turno.

- ¿Cuántas zonas se usarán para medir el equilibrio de objetivos?
- ¿Cuál es el número total de objetivos por jugador?
- ¿La ficha podrá moverse manteniendo una tecla presionada o sólo con pulsaciones individuales?
- ¿Cuál será la duración de la animación de movimiento?
- ¿Qué estilo visual tendrán las figuras de objetivos y las puertas?
- ¿Las puertas serán sólo decorativas o también indicarán cuándo un jugador puede escapar?
