# MVL — Beta 0.6

Segunda etapa jugable de MVL: una arena web 2D competitiva, destructible y sin scrolling, construida con HTML, CSS, JavaScript y Canvas 2D. El modo online figura como **Etapa 3 · Próximamente** y todavía no establece conexiones de red.

## Modos y menús

- `VS IA`: rival con defensa ante proyectiles, detección de huecos, persecución, saltos ofensivos y búsqueda de superficies.
- `PvP local`: dos personajes en el mismo teclado y con colisión física entre sí.
- `PvP online`: visible como **Próximamente**, sin implementación prematura.
- Apartados de personaje, editor de niveles y ajustes.
- Abrir ajustes durante una partida pausa por completo la simulación.

## Controles de teclado

Preset clásico:

- Jugador 1: `A/D` mover, `S` agacharse, `Espacio` saltar y `E` disparar.
- Jugador 2: `←/→` mover, `↓` agacharse, `↑` saltar y `Enter` disparar.

El preset alternativo intercambia ambos grupos. El proyectil siempre sale hacia donde mira el personaje; no existe apuntado direccional.

## Controles móviles

- Gamepad virtual izquierdo: izquierda/derecha, salto al empujar hacia arriba y agachado hacia abajo.
- Tap o click en la mitad derecha de la arena: disparar.
- Botón `A`: salto. Botón `B`: disparo.
- La opacidad común del gamepad y de `A/B` puede ser `10%`, `25%`, `50%` u `Ocultos`.
- En `Ocultos`, esos controles dejan de existir visual y funcionalmente; el tap/click en la mitad derecha sigue disponible.
- Botones separados de pantalla completa y ajustes, soporte horizontal y zonas seguras del teléfono.

## Física y combate

- Simulación determinista a 120 pasos por segundo, separada del render configurable a 60/120 FPS.
- Cada personaje tiene 10 puntos de vida representados por 5 corazones simétricos.
- Proyectil: 1 punto de daño; pisotón válido: 3 puntos; caída al vacío: vida 0 inmediata.
- Agacharse reduce la hitbox de 80 a 40 píxeles, incluso en el aire. Un personaje agachado bloquea el daño del pisotón.
- Los personajes son cuerpos sólidos y no pueden atravesarse.
- Dos proyectiles enfrentados se anulan, generan partículas y repelen radialmente a los personajes cercanos sin causar daño.
- Cada personaje mantiene como máximo dos bolas de fuego activas.

## Rebotes y destrucción

- Las bolas rebotan en partes superiores, inferiores y laterales de los bloques.
- Cada contacto consume uno de 8 rebotes máximos; la velocidad, la bola y su estela se debilitan progresivamente.
- El octavo rebote extingue el proyectil con partículas.
- Ladrillo flotante: 3 HP, destruible también desde abajo por un salto de pie.
- Ladrillo de suelo: 6 HP y dos filas independientes.
- Cada tipo tiene dibujo, sonido de impacto y sonido de destrucción propios.
- Destruir el apoyo bajo un personaje le quita 1 punto y lo impulsa radialmente.

## Personaje y animación

El dibujo original se compone por capas visuales independientes de piel, cabello, prenda superior, prenda inferior, calzado, acento y accesorios. La personalización se guarda localmente y no modifica hitboxes ni físicas.

Estados visuales: quieto, correr, detenerse/derrapar, saltar, caer, agacharse, disparar, recibir daño y pisotón.

## Editor de niveles

El editor trabaja sobre la misma cuadrícula lógica de 32 × 18. Cada celda guarda únicamente un símbolo de tipo:

- `F`: ladrillo flotante.
- `G`: ladrillo de suelo.
- espacio: celda vacía.

Dimensiones, HP y comportamiento siguen definidos exclusivamente por el registro del motor. El nivel editado se guarda en el navegador y puede probarse directamente contra la IA.

## Ajustes persistentes

Idioma español/inglés, preset de controles, sonido, música original sintetizada, 60/120 FPS y opacidad táctil. La configuración, apariencia y nivel personalizado se guardan con `localStorage`.

## Ejecutar localmente

No requiere dependencias:

```bash
python3 -m http.server 8000
```

Abrir `http://localhost:8000`.

## Archivos

- `index.html`: Canvas, menús, personalización, editor y controles táctiles.
- `style.css`: presentación 16:9, zonas seguras y diseño responsivo.
- `game.js`: entrada, física, IA, audio, persistencia, entidades, colisiones y render.
