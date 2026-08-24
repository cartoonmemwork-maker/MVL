# MVL — Etapa 1

Prototipo web liviano de una arena de plataformas 2D destructible. Esta versión permite validar el movimiento, el combate contra una IA y las reglas centrales de vidas y caída al vacío.

## Controles

- `A`: mover a la izquierda.
- `D`: mover a la derecha.
- `S`: agacharse; la hitbox baja de dos celdas a una. También se puede saltar agachado.
- `E`: disparar hacia donde mira el personaje.
- `Espacio`: saltar.
- `Enter`: incorporar un rival controlado por IA.

## Reglas implementadas

- Cada personaje comienza con 10 puntos de vida distribuidos en 5 corazones.
- Cada corazón representa 2 puntos y puede mostrarse completo o por la mitad.
- Un impacto de proyectil elimina exactamente 1 punto de vida.
- Saltar sobre la cabeza del rival elimina 3 puntos, lo fuerza a agacharse durante su invulnerabilidad y produce un rebote para quien cae encima.
- Después de recibir daño, el personaje parpadea y es invulnerable brevemente.
- Caer al vacío coloca inmediatamente la vida en 0.
- Cada personaje puede mantener como máximo dos bolas de fuego activas.
- Las bolas de fuego enfrentadas se anulan al colisionar y generan partículas.
- Los ladrillos flotantes tienen 3 HP y se rompen al golpearlos correctamente desde abajo.
- Un salto agachado puede golpear un ladrillo desde abajo, pero no lo destruye.
- Los ladrillos del suelo tienen 6 HP y forman dos filas independientes.
- Los proyectiles tienen gravedad, trayectoria parabólica, rebote y una estela de partículas.

## Sonido

Los efectos se sintetizan en tiempo real mediante Web Audio y no necesitan archivos externos. Hay sonidos diferenciados para salto, disparo, impactos contra cada tipo de ladrillo, daño a personajes, choque entre proyectiles y pisotón.

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
