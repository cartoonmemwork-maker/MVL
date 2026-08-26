# MVL — Beta 0.6

Arena web 2D competitiva y destructible construida sin frameworks con HTML, CSS, JavaScript y Canvas 2D.

La Beta 0.6 incorpora menú inicial, combate VS IA y PvP local, un personaje 16-bit articulado con personalización persistente por sexo, cabello, ropa, calzado y siete accesorios combinables, editor de cuadrícula, ajustes ES/EN, audio sintetizado, render 60/120 FPS, pantalla completa y controles móviles. El PvP online queda señalado como **Etapa 3 · Próximamente**.

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
