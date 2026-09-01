# ERROR 101 — BETA 1.02

Primer capítulo del universo digital de Sol, construido sobre la base mecánica de MVL.

## Alcance

- Escenario original de 32 × 18 con 36 ladrillos flotantes y dos filas de 64 bloques de suelo.
- Sol aparece desde el inicio, se mueve mediante IA y conserva exclusivamente su azul original.
- Sol es neutral hasta recibir daño; entonces identifica al agresor y se defiende durante un período limitado.
- El visitante controlable aparece con `Enter` y utiliza los ocho inputs definidos.
- Animación cuadro a cuadro: seis cuadros de marcha, seis de carrera, idle con pestañeo y ocho acciones corporales sin efectos incrustados.
- Anclaje calculado desde el último píxel visible de cada cuadro para apoyar los pies exactamente sobre la superficie.
- Disparo terrestre y aéreo; al mantener abajo en el aire adopta la pose compacta y acelera la caída.
- Proyectiles y estelas adoptan la paleta de su personaje.
- 10 HP representados mediante cinco corazones, con mitades correctamente espejadas.
- Zoom manual con la rueda del mouse, siempre enfocado en los personajes presentes y contenido por los límites reales del mapa; la vista inicial muestra la cuadrícula completa.
- Pausa con `Esc`: continuar, reiniciar, personaje y controles.
- Ocho acciones lógicas configurables: cuatro direcciones, ataque corto, ataque largo, cobertura y correr.
- Teclado, touch y joystick estándar de PlayStation mediante Gamepad API.
- Ataque corto y cobertura tienen entrada reservada, pero todavía no aplican reglas de combate.

## Motor y cámara

- Simulación fija a 60 Hz.
- Render desacoplado y apto para pantallas de 60/120 Hz.
- Cámara local con zoom suave: inicia en el mapa completo y permite acercarse al personaje con la rueda.
- El estado del mundo no depende del render, la cámara ni el audio.
- Estado numerado por `simulationTick`, preparado para snapshots y futura sincronización online.

## Combate conservado

- Máximo de dos proyectiles activos por personaje.
- Rebote superior, inferior y lateral, pérdida de energía y desaparición al octavo rebote.
- Impacto de proyectil: 1 HP.
- Pisotón: 3 HP y rebote; un objetivo ya agachado bloquea el daño.
- Colisión sólida entre personajes.
- Choque entre proyectiles: ambos desaparecen y generan una explosión radial que repele sin causar daño.
- Caer al vacío reduce la salud a cero.

## Cloud 9

El cielo `#75AADB` utiliza exactamente tres diseños de nube almacenados como recortes independientes y tres ejemplares de cada diseño: `3 × 3 = 9`. Las posiciones, profundidades y velocidades se distribuyen con una semilla reproducible; todas respetan el mismo viento.

## Audio

Los sonidos sintetizados de salto, disparo, impacto, pisotón, choque y destrucción usan paneo estéreo según su posición respecto de la cámara. La interfaz permanece centrada.

## Controles predeterminados

- `A/D`: izquierda/derecha.
- `W`: saltar.
- `S`: agacharse y desplazarse lentamente.
- `F`: ataque corto reservado.
- `E`: ataque largo/proyectil.
- `Q`: cobertura reservada.
- `Shift izquierdo`: correr.
- `Enter`: incorporar al visitante controlable.
- `Esc`: pausa.

Joystick: stick o cruceta, `✕` como salto alternativo, `□` corto, `○` largo, `L1` cobertura y `R1` correr.
