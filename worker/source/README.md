# MVL — Beta 0.9

Segunda etapa jugable de MVL: una arena web 2D competitiva, destructible y sin scrolling, construida con HTML, CSS, JavaScript y Canvas 2D. El modo online figura como **Etapa 3 · Próximamente** y todavía no establece conexiones de red.

## Modos y menús

- `VS IA`: rival con defensa ante proyectiles, detección de huecos, persecución, saltos ofensivos y búsqueda de superficies.
- `PvP local`: dos personajes en el mismo teclado y con colisión física entre sí.
- `PvP online`: visible como **Próximamente**, sin implementación prematura.
- Apartados de personaje, editor de niveles y ajustes.
- Abrir ajustes durante una partida pausa por completo la simulación.

## Controles de teclado

Preset clásico:

- Jugador 1: `WASD` direcciones, `F` ataque corto, `E` ataque largo, `Q` cobertura y `Shift izquierdo` correr.
- Jugador 2: flechas direccionales, `Num 1` ataque corto, `Num 2` ataque largo, `Num 3` cobertura y `Num 0` correr.

El preset alternativo intercambia ambos grupos. Arriba salta y abajo agacha. El proyectil siempre sale hacia donde mira el personaje; no existe apuntado direccional. Ataque corto y cobertura ya tienen entrada y animación, pero sus reglas de daño y defensa quedan pendientes de definición.

## Controles móviles

- Gamepad virtual izquierdo: izquierda/derecha, salto al empujar hacia arriba y agachado hacia abajo.
- Tap o click en la mitad derecha de la arena: disparar.
- Botones de acción: `A` ataque corto, `B` ataque largo, `X` cobertura y `Y` correr.
- La opacidad común del gamepad y de los cuatro botones puede ser `10%`, `25%`, `50%` u `Ocultos`.
- En `Ocultos`, esos controles dejan de existir visual y funcionalmente; el tap/click en la mitad derecha sigue disponible.
- Botones separados de pantalla completa y ajustes, soporte horizontal y zonas seguras del teléfono.

## Física y combate

- Simulación determinista a 120 pasos por segundo, separada del render configurable a 60/120 FPS.
- Cada personaje tiene 10 puntos de vida representados por 5 corazones simétricos.
- Proyectil: 1 punto de daño; pisotón válido: 3 puntos; caída al vacío: vida 0 inmediata.
- Agacharse reduce la hitbox de 80 a 40 píxeles, incluso en el aire. Ahora permite avanzar lentamente a 82 px/s. Un personaje agachado bloquea el daño del pisotón.
- El movimiento normal alcanza 225 px/s y el botón de correr lo eleva a 350 px/s.
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

El personaje usa una base de luchador modular con estética de consola de 16 bits: postura de combate, extremidades cónicas con volumen, manos en puño, tres valores de luz, ropa con siluetas propias y transiciones continuas. El sistema está pensado para construir arquetipos reconocibles —ninja, karateka, soldado— sin copiar sprites concretos. La personalización se guarda localmente y no modifica hitboxes.

Estados visuales: quieto, moverse, correr, detenerse/derrapar, saltar, caer, agacharse, ataque corto, ataque largo, cobertura, recibir daño y pisotón.

Opciones combinables:

- Sexo: hombre o mujer.
- Pelo: corto, largo o pelado, con color propio.
- Torso: manga corta, manga larga o sin camiseta, con color propio.
- Piernas: pantalón corto, pantalón largo o sin pantalones, con color propio.
- Calzado: zapatillas, zapatos o descalzo, con color propio.
- Accesorios booleanos y simultáneos: gafas oscuras, vincha, muñequeras, barbijo, capucha, cinturón y chaleco; cada uno conserva su propio color.
- Sin pantalones: ambos modelos usan ropa interior negra; el bóxer masculino conserva una cintura blanca para distinguir su silueta. Sin camiseta, la mujer mantiene la parte superior negra del conjunto.

La vista previa del apartado `Personaje` permanece en Idle por defecto. El modo `Demostración` recorre los doce estados durante tres segundos cada uno para revisar cómo cada capa acompaña la animación.

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
