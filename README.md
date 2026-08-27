# MVL — Beta 0.9

Arena web 2D competitiva y destructible construida sin frameworks con HTML, CSS, JavaScript y Canvas 2D.

La Beta 0.9 convierte la base articulada en un sistema de luchadores modulares: postura de combate, anatomía con volumen, animaciones renovadas, personalización persistente y ocho acciones de entrada. Conserva el combate VS IA, PvP local, editor, ajustes ES/EN, audio sintetizado, render 60/120 FPS y controles móviles. El PvP online queda señalado como **Etapa 3 · Próximamente**.

La documentación funcional completa está en [`worker/source/README.md`](worker/source/README.md).

## Desarrollo

Los archivos fuente públicos son:

- `worker/source/index.html`
- `worker/source/style.css`
- `worker/source/game.js`

Para regenerar el Worker autocontenido:

```bash
node scripts/embed-source.mjs
```

Pruebas y validación:

```bash
node tests/headless.cjs
npm run build
npm run validate
```

La simulación física usa un paso fijo de 120 Hz. El ajuste de 60/120 FPS solo controla el render, por lo que no altera la velocidad de nubes, personajes o proyectiles.
