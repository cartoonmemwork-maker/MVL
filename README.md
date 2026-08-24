# MVL — Etapa 1

Prototipo web liviano de un plataformas 2D competitivo. Esta primera etapa valida el motor con un único personaje; todavía no incluye segundo jugador, IA ni red.

## Controles

- `A`: mover/apuntar a la izquierda.
- `D`: mover/apuntar a la derecha.
- `W`: apuntar hacia arriba.
- `S`: apuntar hacia abajo.
- `E`: disparar una bola de fuego.
- `Espacio`: saltar.

Las direcciones pueden combinarse para disparar en diagonal. Sin una dirección presionada, el personaje dispara hacia donde está mirando.

## Reglas implementadas

- El personaje comienza con 3 vidas.
- Caer al vacío coloca inmediatamente las vidas en 0 y termina la partida.
- Los ladrillos flotantes tienen 3 HP contra proyectiles y se rompen al golpearlos correctamente desde abajo.
- Los ladrillos de suelo tienen 6 HP contra proyectiles.
- El suelo utiliza dos filas de ladrillos individuales. Para abrir un hueco completo deben desaparecer ambos ladrillos de una columna.
- Los proyectiles tienen gravedad, trayectoria parabólica y rebote sobre superficies.

## Ejecutar localmente

No requiere instalación ni dependencias. Se puede abrir `index.html` directamente o servir la carpeta con cualquier servidor estático:

```bash
python3 -m http.server 8000
```

Luego abrir `http://localhost:8000`.

## Estructura

- `index.html`: Canvas y elementos mínimos de interfaz.
- `style.css`: presentación 16:9 y escalado responsivo.
- `game.js`: entrada, física, nivel, entidades, colisiones y renderizado.

El nivel usa una cuadrícula de símbolos. Cada celda solo selecciona un tipo registrado por el motor; las dimensiones, HP y reglas del bloque no forman parte de los datos del nivel.
