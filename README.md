# MVL — Etapa 1

Prototipo web liviano de una arena de plataformas 2D destructible. Esta versión permite validar el movimiento, el combate contra una IA y las reglas centrales de vidas y caída al vacío.

## Controles

- `A`: mover a la izquierda.
- `D`: mover a la derecha.
- `S`: agacharse; la hitbox baja de dos celdas a una.
- `E`: disparar hacia donde mira el personaje.
- `Espacio`: saltar.
- `Enter`: incorporar un rival controlado por IA.

## Reglas implementadas

- Cada personaje comienza con 3 vidas.
- Un impacto de proyectil elimina exactamente una vida.
- Después de recibir daño, el personaje parpadea y es invulnerable brevemente.
- Caer al vacío elimina inmediatamente todas las vidas.
- Cada personaje puede mantener como máximo dos bolas de fuego activas.
- Los ladrillos flotantes tienen 3 HP y se rompen al golpearlos correctamente desde abajo.
- Los ladrillos del suelo tienen 6 HP y forman dos filas independientes.
- Los proyectiles tienen gravedad, trayectoria parabólica, rebote y una estela de partículas.

## Apariencia extensible

El personaje se dibuja por capas independientes de piel, cabello y ropa. Las paletas están separadas de las físicas para que un futuro apartado de personalización pueda reemplazarlas sin modificar hitboxes ni movimiento.

## Cielo y viento

Cada partida genera nueve nubes con posiciones, escalas y velocidades distintas. Todas comparten la dirección y la intensidad base de un viento sorteado al iniciar la partida.

## Ejecutar localmente

No requiere instalación ni dependencias. Se puede abrir `index.html` directamente o servir la carpeta con cualquier servidor estático:

```bash
python3 -m http.server 8000
```

Luego abrir `http://localhost:8000`.

## Estructura

- `index.html`: Canvas y elementos mínimos de interfaz.
- `style.css`: presentación 16:9 y escalado responsivo.
- `game.js`: entrada, física, IA, entidades, colisiones y renderizado.

El nivel usa una cuadrícula de símbolos. Cada celda solo selecciona un tipo registrado por el motor; dimensiones, HP y reglas siguen perteneciendo al motor.
