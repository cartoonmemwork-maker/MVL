# MVL — BETA 1.00

Reconstrucción limpia del prototipo MVL. La Beta 0.9 permanece preservada en el historial; esta versión conserva únicamente la definición del escenario y vuelve a construir personaje, cámara, controles, combate y audio.

La documentación funcional está en [`worker/source/README.md`](worker/source/README.md).

## Desarrollo

Fuente pública:

- `worker/source/index.html`
- `worker/source/style.css`
- `worker/source/game.js`
- `worker/source/assets/fighter-idle.png`

Regenerar y comprobar el Worker:

```bash
node scripts/embed-source.mjs
node tests/headless.cjs
npm run build
npm run validate
```

La partida avanza a 60 pasos lógicos por segundo. La presentación puede dibujarse a 60 o 120 FPS sin modificar el resultado del combate, base necesaria para el futuro PvP online.
