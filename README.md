# ERROR 101 — BETA 1.04

Primer capítulo de Error 101. Sol es la protagonista autónoma de este universo digital; el visitante controlable aparece al presionar `Enter`.

La documentación funcional está en [`worker/source/README.md`](worker/source/README.md).

## Desarrollo

Fuente pública:

- `worker/source/index.html`
- `worker/source/style.css`
- `worker/source/game.js`
- `worker/source/assets/sol-locomotion-v4.png`
- `worker/source/assets/sol-actions-v2.png`
- `worker/source/assets/cloud-*-v2.png`

Regenerar y comprobar el Worker:

```bash
node scripts/embed-source.mjs
node tests/headless.cjs
npm run build
npm run validate
```

La partida avanza a 60 pasos lógicos por segundo. La presentación puede dibujarse a 60 o 120 FPS sin modificar el resultado del combate, base necesaria para el futuro PvP online.
