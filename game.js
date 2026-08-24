(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d", { alpha: false });
  const loadingMessage = document.querySelector("#loadingMessage");
  const restartButton = document.querySelector("#restartButton");
  const gameStatus = document.querySelector("#gameStatus");

  const WORLD = Object.freeze({
    width: 1280,
    height: 720,
    columns: 32,
    rows: 18,
    tileSize: 40,
    fixedStep: 1 / 120,
    maxFrameDelta: 0.05,
  });

  const PLAYER_TUNING = Object.freeze({
    width: 34,
    height: 56,
    acceleration: 2300,
    deceleration: 2800,
    maxSpeed: 350,
    gravity: 1900,
    jumpVelocity: -930,
    maxFallSpeed: 1100,
  });

  const FIREBALL_TUNING = Object.freeze({
    radius: 10,
    launchSpeed: 650,
    gravity: 1450,
    bounceVelocity: 470,
    maxLifetime: 4,
    maxBounces: 7,
    maxActive: 8,
  });

  // El futuro editor solo elegira uno de estos tipos en cada celda.
  // Dimensiones, HP y comportamiento pertenecen al motor, no al nivel.
  const TILE_TYPES = Object.freeze({
    floatingBrick: Object.freeze({
      symbol: "F",
      maxHp: 3,
      breakFromBelow: true,
    }),
    groundBrick: Object.freeze({
      symbol: "G",
      maxHp: 6,
      breakFromBelow: false,
    }),
  });

  const SYMBOL_TO_TYPE = Object.freeze(
    Object.fromEntries(
      Object.entries(TILE_TYPES).map(([type, definition]) => [definition.symbol, type]),
    ),
  );

  // 32 x 18. Las dos ultimas filas son ladrillos de suelo independientes.
  const LEVEL_GRID = Object.freeze([
    "                                ",
    "                                ",
    "                                ",
    "                                ",
    "                                ",
    "                                ",
    "    FFFFFFFFF      FFFFFFFFF    ",
    "                                ",
    "                                ",
    "                                ",
    "                                ",
    "    FFFFFFFFF      FFFFFFFFF    ",
    "                                ",
    "                                ",
    "                                ",
    "                                ",
    "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
    "GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
  ]);

  const ACTION_BY_CODE = Object.freeze({
    KeyA: "left",
    KeyD: "right",
    KeyW: "up",
    KeyS: "down",
    KeyE: "fire",
    Space: "jump",
  });

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const moveToward = (value, target, amount) => {
    if (value < target) return Math.min(value + amount, target);
    if (value > target) return Math.max(value - amount, target);
    return target;
  };

  const rectanglesOverlap = (a, b) =>
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y;

  const circleOverlapsRectangle = (circle, rectangle) => {
    const nearestX = clamp(circle.x, rectangle.x, rectangle.x + rectangle.width);
    const nearestY = clamp(circle.y, rectangle.y, rectangle.y + rectangle.height);
    const dx = circle.x - nearestX;
    const dy = circle.y - nearestY;
    return dx * dx + dy * dy < circle.radius * circle.radius;
  };

  class InputManager {
    constructor() {
      this.held = new Set();
      this.pressed = new Set();

      window.addEventListener("keydown", (event) => {
        const action = ACTION_BY_CODE[event.code];
        if (!action) return;
        event.preventDefault();
        if (!event.repeat && !this.held.has(action)) this.pressed.add(action);
        this.held.add(action);
      });

      window.addEventListener("keyup", (event) => {
        const action = ACTION_BY_CODE[event.code];
        if (!action) return;
        event.preventDefault();
        this.held.delete(action);
      });

      window.addEventListener("blur", () => this.clear());
    }

    isHeld(action) {
      return this.held.has(action);
    }

    consumePress(action) {
      if (!this.pressed.has(action)) return false;
      this.pressed.delete(action);
      return true;
    }

    clear() {
      this.held.clear();
      this.pressed.clear();
    }
  }

  class Block {
    constructor(id, type, column, row) {
      const definition = TILE_TYPES[type];
      this.id = id;
      this.type = type;
      this.column = column;
      this.row = row;
      this.x = column * WORLD.tileSize;
      this.y = row * WORLD.tileSize;
      this.width = WORLD.tileSize;
      this.height = WORLD.tileSize;
      this.maxHp = definition.maxHp;
      this.hp = definition.maxHp;
      this.breakFromBelow = definition.breakFromBelow;
      this.active = true;
    }

    damage(amount = 1) {
      if (!this.active) return false;
      this.hp = Math.max(0, this.hp - amount);
      if (this.hp === 0) {
        this.active = false;
        return true;
      }
      return false;
    }

    breakImmediately() {
      if (!this.active) return false;
      this.hp = 0;
      this.active = false;
      return true;
    }
  }

  class World {
    constructor() {
      this.blocks = [];
      this.blockByCell = new Map();
      this.buildLevel();
    }

    buildLevel() {
      let id = 0;
      LEVEL_GRID.forEach((rowText, row) => {
        [...rowText].forEach((symbol, column) => {
          const type = SYMBOL_TO_TYPE[symbol];
          if (!type) return;
          const block = new Block(`block-${id++}`, type, column, row);
          this.blocks.push(block);
          this.blockByCell.set(`${column},${row}`, block);
        });
      });
    }

    activeBlocks() {
      return this.blocks.filter((block) => block.active);
    }

    blockAt(column, row) {
      return this.blockByCell.get(`${column},${row}`) ?? null;
    }
  }

  class Player {
    constructor() {
      this.width = PLAYER_TUNING.width;
      this.height = PLAYER_TUNING.height;
      // Centrado sobre la columna 6: un hueco de un ladrillo es fisicamente transitable.
      this.x = 6 * WORLD.tileSize + (WORLD.tileSize - this.width) / 2;
      this.y = 16 * WORLD.tileSize - this.height;
      this.previousX = this.x;
      this.previousY = this.y;
      this.vx = 0;
      this.vy = 0;
      this.facing = 1;
      this.grounded = true;
      this.walkCycle = 0;
    }

    get centerX() {
      return this.x + this.width / 2;
    }

    get centerY() {
      return this.y + this.height / 2;
    }

    get bottom() {
      return this.y + this.height;
    }

    update(dt, input, world, onBlockBreak) {
      this.previousX = this.x;
      this.previousY = this.y;

      const horizontalInput = Number(input.isHeld("right")) - Number(input.isHeld("left"));
      if (horizontalInput !== 0) {
        this.facing = horizontalInput;
        this.vx = moveToward(
          this.vx,
          horizontalInput * PLAYER_TUNING.maxSpeed,
          PLAYER_TUNING.acceleration * dt,
        );
      } else {
        this.vx = moveToward(this.vx, 0, PLAYER_TUNING.deceleration * dt);
      }

      if (input.consumePress("jump") && this.grounded) {
        this.vy = PLAYER_TUNING.jumpVelocity;
        this.grounded = false;
      }

      this.vy = Math.min(this.vy + PLAYER_TUNING.gravity * dt, PLAYER_TUNING.maxFallSpeed);
      this.moveHorizontally(dt, world);
      this.moveVertically(dt, world, onBlockBreak);

      if (Math.abs(this.vx) > 8 && this.grounded) {
        this.walkCycle += Math.abs(this.vx) * dt * 0.035;
      }
    }

    moveHorizontally(dt, world) {
      this.x += this.vx * dt;
      this.x = clamp(this.x, 0, WORLD.width - this.width);

      for (const block of world.blocks) {
        if (!block.active || !rectanglesOverlap(this, block)) continue;
        if (this.vx > 0) {
          this.x = block.x - this.width;
        } else if (this.vx < 0) {
          this.x = block.x + block.width;
        }
        this.vx = 0;
      }
    }

    moveVertically(dt, world, onBlockBreak) {
      const startedMovingUp = this.vy < 0;
      this.y += this.vy * dt;
      this.grounded = false;

      const overlaps = world.blocks.filter(
        (block) => block.active && rectanglesOverlap(this, block),
      );

      if (this.vy > 0) {
        const previousBottom = this.previousY + this.height;
        const landingBlocks = overlaps.filter((block) => previousBottom <= block.y + 1);
        if (landingBlocks.length > 0) {
          const landingY = Math.min(...landingBlocks.map((block) => block.y));
          this.y = landingY - this.height;
          this.vy = 0;
          this.grounded = true;
        }
      } else if (startedMovingUp) {
        const previousTop = this.previousY;
        const ceilingBlocks = overlaps.filter(
          (block) => previousTop >= block.y + block.height - 1,
        );

        if (ceilingBlocks.length > 0) {
          const contactBottom = Math.max(
            ...ceilingBlocks.map((block) => block.y + block.height),
          );
          const firstContactRow = ceilingBlocks.filter(
            (block) => block.y + block.height === contactBottom,
          );
          const hitBlock = firstContactRow.reduce((best, block) => {
            const overlap =
              Math.min(this.x + this.width, block.x + block.width) -
              Math.max(this.x, block.x);
            const bestOverlap =
              Math.min(this.x + this.width, best.x + best.width) - Math.max(this.x, best.x);
            return overlap > bestOverlap ? block : best;
          });

          this.y = contactBottom;
          this.vy = 0;
          if (hitBlock.breakFromBelow && hitBlock.breakImmediately()) onBlockBreak(hitBlock);
        }
      }
    }

    aimVector(input) {
      let x = Number(input.isHeld("right")) - Number(input.isHeld("left"));
      let y = Number(input.isHeld("down")) - Number(input.isHeld("up"));

      if (x === 0 && y === 0) x = this.facing;
      const length = Math.hypot(x, y) || 1;
      return { x: x / length, y: y / length };
    }
  }

  class Fireball {
    constructor(player, aim) {
      this.radius = FIREBALL_TUNING.radius;
      this.x = player.centerX;
      this.y = player.centerY;

      if (aim.x !== 0) {
        this.x =
          aim.x > 0
            ? player.x + player.width + this.radius + 3
            : player.x - this.radius - 3;
      }
      if (aim.y < 0) this.y = player.y + this.radius + 2;
      if (aim.y > 0) this.y = player.bottom - this.radius - 2;

      this.vx = aim.x * FIREBALL_TUNING.launchSpeed;
      this.vy = aim.y * FIREBALL_TUNING.launchSpeed;
      this.life = 0;
      this.bounces = 0;
      this.active = true;
      this.damagedBlockIds = new Set();
      this.spin = Math.random() * Math.PI * 2;
    }

    update(dt, world, damageBlock, emitImpact) {
      if (!this.active) return;
      this.life += dt;
      this.vy += FIREBALL_TUNING.gravity * dt;
      this.spin += dt * 15;

      const travel = Math.hypot(this.vx * dt, this.vy * dt);
      const substeps = clamp(Math.ceil(travel / (this.radius * 0.65)), 1, 10);
      const subDt = dt / substeps;

      for (let step = 0; step < substeps && this.active; step += 1) {
        this.moveHorizontal(subDt, world, damageBlock, emitImpact);
        if (this.active) this.moveVertical(subDt, world, damageBlock, emitImpact);
      }

      if (
        this.life >= FIREBALL_TUNING.maxLifetime ||
        this.bounces > FIREBALL_TUNING.maxBounces ||
        this.x < -80 ||
        this.x > WORLD.width + 80 ||
        this.y < -120 ||
        this.y > WORLD.height + 120
      ) {
        this.active = false;
      }
    }

    tryDamage(block, damageBlock, emitImpact) {
      if (this.damagedBlockIds.has(block.id)) return false;
      this.damagedBlockIds.add(block.id);
      const destroyed = damageBlock(block, 1, this.x, this.y);
      emitImpact(this.x, this.y, destroyed);
      return destroyed;
    }

    moveHorizontal(dt, world, damageBlock, emitImpact) {
      this.x += this.vx * dt;
      const collisions = world.blocks.filter(
        (block) => block.active && circleOverlapsRectangle(this, block),
      );
      if (collisions.length === 0) return;

      const centered = collisions.filter(
        (block) => this.y >= block.y && this.y < block.y + block.height,
      );
      const candidates = centered.length > 0 ? centered : collisions;
      const block = candidates.reduce((nearest, candidate) => {
        if (this.vx >= 0) return candidate.x < nearest.x ? candidate : nearest;
        return candidate.x + candidate.width > nearest.x + nearest.width ? candidate : nearest;
      });
      const destroyed = this.tryDamage(block, damageBlock, emitImpact);
      if (destroyed) return;

      this.x = this.vx > 0 ? block.x - this.radius : block.x + block.width + this.radius;
      this.active = false;
    }

    moveVertical(dt, world, damageBlock, emitImpact) {
      this.y += this.vy * dt;
      const collisions = world.blocks.filter(
        (block) => block.active && circleOverlapsRectangle(this, block),
      );
      if (collisions.length === 0) return;

      const centered = collisions.filter(
        (block) => this.x >= block.x && this.x < block.x + block.width,
      );
      const candidates = centered.length > 0 ? centered : collisions;
      const falling = this.vy > 0;
      const block = candidates.reduce((nearest, candidate) => {
        if (falling) return candidate.y < nearest.y ? candidate : nearest;
        return candidate.y + candidate.height > nearest.y + nearest.height ? candidate : nearest;
      });
      const destroyed = this.tryDamage(block, damageBlock, emitImpact);
      if (destroyed) return;

      if (falling) {
        this.y = block.y - this.radius;
        this.vy = -FIREBALL_TUNING.bounceVelocity;
        this.bounces += 1;
      } else {
        this.y = block.y + block.height + this.radius;
        this.active = false;
      }
    }
  }

  class Cloud {
    constructor(x, y, scale, speed) {
      this.x = x;
      this.y = y;
      this.scale = scale;
      this.speed = speed;
      this.width = 122 * scale;
    }

    update(dt) {
      this.x += this.speed * dt;
      if (this.speed > 0 && this.x > WORLD.width + this.width) this.x = -this.width;
      if (this.speed < 0 && this.x < -this.width) this.x = WORLD.width + this.width;
    }
  }

  class Particle {
    constructor(x, y, vx, vy, color, size, lifetime) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.color = color;
      this.size = size;
      this.life = lifetime;
      this.maxLife = lifetime;
    }

    update(dt) {
      this.life -= dt;
      this.vy += 900 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }
  }

  class Game {
    constructor() {
      this.input = new InputManager();
      this.clouds = [
        new Cloud(32, 38, 0.9, 5),
        new Cloud(328, 67, 0.72, 7),
        new Cloud(580, 24, 0.86, 4),
        new Cloud(872, 79, 0.7, 8),
        new Cloud(1080, 48, 0.92, 5.5),
      ];
      this.reset();
    }

    reset() {
      this.world = new World();
      this.player = new Player();
      this.fireballs = [];
      this.particles = [];
      this.lives = 3;
      this.state = "playing";
      this.elapsed = 0;
      this.input?.clear();
      restartButton.hidden = true;
      gameStatus.textContent = "Etapa iniciada. Tenés 3 vidas.";
      canvas.focus({ preventScroll: true });
    }

    update(dt) {
      for (const cloud of this.clouds) cloud.update(dt);
      this.updateParticles(dt);

      if (this.state !== "playing") return;
      this.elapsed += dt;

      this.player.update(dt, this.input, this.world, (block) => {
        this.emitBlockBreak(block);
      });

      if (
        this.input.consumePress("fire") &&
        this.fireballs.filter((fireball) => fireball.active).length < FIREBALL_TUNING.maxActive
      ) {
        const aim = this.player.aimVector(this.input);
        const fireball = new Fireball(this.player, aim);
        this.fireballs.push(fireball);
        this.emitMuzzle(fireball.x, fireball.y);
      }

      for (const fireball of this.fireballs) {
        fireball.update(
          dt,
          this.world,
          (block, amount, x, y) => this.damageBlock(block, amount, x, y),
          (x, y, destroyed) => this.emitImpact(x, y, destroyed),
        );
      }
      this.fireballs = this.fireballs.filter((fireball) => fireball.active);

      if (this.player.y > WORLD.height + 90) this.gameOverByVoid();
    }

    damageBlock(block, amount) {
      const destroyed = block.damage(amount);
      if (destroyed) this.emitBlockBreak(block);
      return destroyed;
    }

    emitMuzzle(x, y) {
      for (let i = 0; i < 4; i += 1) {
        this.particles.push(
          new Particle(
            x,
            y,
            (Math.random() - 0.5) * 130,
            (Math.random() - 0.5) * 130,
            i % 2 ? "#fff3a3" : "#ff6a2b",
            4,
            0.18,
          ),
        );
      }
    }

    emitImpact(x, y, destroyed) {
      const count = destroyed ? 9 : 4;
      for (let i = 0; i < count; i += 1) {
        this.particles.push(
          new Particle(
            x,
            y,
            (Math.random() - 0.5) * (destroyed ? 320 : 150),
            -Math.random() * (destroyed ? 280 : 120),
            destroyed ? "#d85b2b" : "#fff3a3",
            destroyed ? 7 : 4,
            destroyed ? 0.62 : 0.25,
          ),
        );
      }
    }

    emitBlockBreak(block) {
      const colors =
        block.type === "groundBrick"
          ? ["#e8752f", "#8f301d", "#ffc15a"]
          : ["#c84d2b", "#72251f", "#f09a3e"];

      for (let i = 0; i < 12; i += 1) {
        this.particles.push(
          new Particle(
            block.x + Math.random() * block.width,
            block.y + Math.random() * block.height,
            (Math.random() - 0.5) * 340,
            -80 - Math.random() * 320,
            colors[i % colors.length],
            6 + Math.random() * 6,
            0.55 + Math.random() * 0.35,
          ),
        );
      }
    }

    updateParticles(dt) {
      for (const particle of this.particles) particle.update(dt);
      this.particles = this.particles.filter((particle) => particle.life > 0);
    }

    gameOverByVoid() {
      this.lives = 0;
      this.state = "gameOver";
      this.fireballs.length = 0;
      restartButton.hidden = false;
      gameStatus.textContent = "Caíste al vacío. Vidas: 0. Game over.";
    }

    snapshot() {
      return {
        state: this.state,
        lives: this.lives,
        player: {
          x: Number(this.player.x.toFixed(2)),
          y: Number(this.player.y.toFixed(2)),
          vx: Number(this.player.vx.toFixed(2)),
          vy: Number(this.player.vy.toFixed(2)),
          facing: this.player.facing,
          grounded: this.player.grounded,
        },
        fireballCount: this.fireballs.length,
        fireballs: this.fireballs.map((fireball) => ({
          x: Number(fireball.x.toFixed(2)),
          y: Number(fireball.y.toFixed(2)),
          vx: Number(fireball.vx.toFixed(2)),
          vy: Number(fireball.vy.toFixed(2)),
          bounces: fireball.bounces,
        })),
        blocks: this.world.blocks.map((block) => ({
          id: block.id,
          type: block.type,
          column: block.column,
          row: block.row,
          hp: block.hp,
          active: block.active,
        })),
      };
    }

    render() {
      this.drawSky();
      for (const cloud of this.clouds) this.drawCloud(cloud);
      for (const block of this.world.blocks) {
        if (block.active) this.drawBlock(block);
      }
      for (const particle of this.particles) this.drawParticle(particle);
      for (const fireball of this.fireballs) this.drawFireball(fireball);
      if (this.state === "playing") this.drawPlayer();
      this.drawHud();
      if (this.state === "gameOver") this.drawGameOver();
    }

    drawSky() {
      ctx.fillStyle = "#5b8def";
      ctx.fillRect(0, 0, WORLD.width, WORLD.height);
      ctx.fillStyle = "rgba(255, 255, 255, 0.045)";
      ctx.fillRect(0, 0, WORLD.width, 210);
    }

    drawCloud(cloud) {
      ctx.save();
      ctx.translate(Math.round(cloud.x), Math.round(cloud.y));
      ctx.scale(cloud.scale, cloud.scale);
      ctx.fillStyle = "#173b72";
      ctx.fillRect(14, 31, 91, 24);
      ctx.fillRect(27, 17, 62, 37);
      ctx.fillRect(43, 8, 31, 45);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(12, 27, 91, 22);
      ctx.fillRect(24, 15, 64, 34);
      ctx.fillRect(42, 7, 31, 42);
      ctx.fillStyle = "#bfeeff";
      ctx.fillRect(20, 42, 75, 7);
      ctx.fillRect(32, 34, 56, 6);
      ctx.restore();
    }

    drawBlock(block) {
      if (block.type === "floatingBrick") this.drawFloatingBrick(block);
      else this.drawGroundBrick(block);
      this.drawDamageCracks(block);
    }

    drawFloatingBrick(block) {
      const { x, y, width: w, height: h } = block;
      ctx.fillStyle = "#4a1b21";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#d65b2f";
      ctx.fillRect(x + 2, y + 4, w - 4, h - 7);
      ctx.fillStyle = "#f3a33e";
      ctx.fillRect(x + 2, y + 2, w - 4, 5);
      ctx.fillStyle = "#70251f";
      ctx.fillRect(x, y + 18, w, 3);
      ctx.fillRect(x + 18, y + 4, 3, 14);
      ctx.fillRect(x + 8, y + 21, 3, 16);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(x + 5, y + 9, 10, 3);
    }

    drawGroundBrick(block) {
      const { x, y, width: w, height: h } = block;
      ctx.fillStyle = "#5b1f18";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#ed7432";
      ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
      ctx.fillStyle = "#ffad4a";
      ctx.fillRect(x + 4, y + 4, w - 8, 5);
      ctx.fillStyle = "#98331f";
      ctx.fillRect(x + 4, y + h - 9, w - 8, 5);
      ctx.fillRect(x + 3, y + 10, 4, h - 20);
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(x + 9, y + 12, 15, 3);
    }

    drawDamageCracks(block) {
      const damage = block.maxHp - block.hp;
      if (damage <= 0) return;
      const ratio = damage / block.maxHp;
      ctx.save();
      ctx.strokeStyle = "#3f1720";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(block.x + block.width * 0.52, block.y + 4);
      ctx.lineTo(block.x + block.width * 0.43, block.y + 13);
      ctx.lineTo(block.x + block.width * 0.57, block.y + 20);
      if (ratio >= 0.45) {
        ctx.lineTo(block.x + block.width * 0.36, block.y + 31);
        ctx.moveTo(block.x + block.width * 0.57, block.y + 20);
        ctx.lineTo(block.x + block.width * 0.75, block.y + 29);
      }
      if (ratio >= 0.72) {
        ctx.moveTo(block.x + 5, block.y + 17);
        ctx.lineTo(block.x + 14, block.y + 11);
        ctx.lineTo(block.x + 20, block.y + 19);
      }
      ctx.stroke();
      ctx.restore();
    }

    drawPlayer() {
      const player = this.player;
      const x = Math.round(player.x);
      const y = Math.round(player.y);
      const step = player.grounded ? Math.sin(player.walkCycle) * 3 : 0;
      const aim = player.aimVector(this.input);

      ctx.save();
      ctx.translate(x + player.width / 2, y);
      ctx.scale(player.facing, 1);

      ctx.fillStyle = "#132038";
      ctx.fillRect(-14, 49 + Math.max(0, step), 12, 7);
      ctx.fillRect(3, 49 + Math.max(0, -step), 12, 7);
      ctx.fillStyle = "#20375f";
      ctx.fillRect(-11, 34, 10, 18 + step);
      ctx.fillRect(2, 34, 10, 18 - step);
      ctx.fillStyle = "#16a6a1";
      ctx.fillRect(-15, 19, 30, 21);
      ctx.fillStyle = "#63d7c7";
      ctx.fillRect(-11, 21, 22, 5);

      ctx.save();
      const localAimX = aim.x * player.facing;
      ctx.translate(10, 25);
      ctx.rotate(Math.atan2(aim.y, localAimX));
      ctx.fillStyle = "#f4c28a";
      ctx.fillRect(0, -4, 18, 8);
      ctx.fillStyle = "#fff3a3";
      ctx.fillRect(16, -5, 7, 10);
      ctx.restore();

      ctx.fillStyle = "#f4c28a";
      ctx.fillRect(-11, 4, 22, 17);
      ctx.fillStyle = "#40265e";
      ctx.fillRect(-14, 0, 28, 8);
      ctx.fillRect(-14, 7, 7, 9);
      ctx.fillStyle = "#fff3a3";
      ctx.fillRect(5, 10, 5, 4);
      ctx.fillStyle = "#132038";
      ctx.fillRect(8, 11, 3, 3);
      ctx.restore();
    }

    drawFireball(fireball) {
      ctx.save();
      ctx.translate(Math.round(fireball.x), Math.round(fireball.y));
      ctx.rotate(fireball.spin);
      ctx.fillStyle = "#8c241d";
      ctx.fillRect(-10, -10, 20, 20);
      ctx.fillStyle = "#ff5a24";
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = "#ffc53d";
      ctx.fillRect(-5, -7, 10, 14);
      ctx.fillStyle = "#fff8c5";
      ctx.fillRect(-3, -5, 6, 8);
      ctx.restore();
    }

    drawParticle(particle) {
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.fillRect(
        Math.round(particle.x - particle.size / 2),
        Math.round(particle.y - particle.size / 2),
        particle.size,
        particle.size,
      );
      ctx.globalAlpha = 1;
    }

    drawHud() {
      ctx.save();
      ctx.fillStyle = "rgba(7, 17, 31, 0.76)";
      ctx.fillRect(18, 17, 178, 44);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(18, 17, 178, 44);
      ctx.fillStyle = "#ffffff";
      ctx.font = '700 24px "Courier New", monospace';
      ctx.textBaseline = "middle";
      ctx.fillText(`VIDAS  ${this.lives}`, 33, 40);

      if (this.elapsed < 8 && this.state === "playing") {
        const alpha = this.elapsed > 6 ? (8 - this.elapsed) / 2 : 1;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "rgba(7, 17, 31, 0.76)";
        ctx.fillRect(315, 18, 650, 42);
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.strokeRect(315, 18, 650, 42);
        ctx.fillStyle = "#ffffff";
        ctx.font = '700 18px "Courier New", monospace';
        ctx.textAlign = "center";
        ctx.fillText("A/D MOVER · W/S APUNTAR · E FUEGO · ESPACIO SALTAR", 640, 39);
      }
      ctx.restore();
    }

    drawGameOver() {
      ctx.fillStyle = "rgba(7, 17, 31, 0.72)";
      ctx.fillRect(0, 0, WORLD.width, WORLD.height);
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffffff";
      ctx.font = '700 66px "Courier New", monospace';
      ctx.fillText("GAME OVER", WORLD.width / 2, 304);
      ctx.fillStyle = "#fff3a3";
      ctx.font = '700 28px "Courier New", monospace';
      ctx.fillText("CAÍDA AL VACÍO · VIDAS 0", WORLD.width / 2, 353);
      ctx.textAlign = "start";
    }
  }

  const game = new Game();
  let accumulator = 0;
  let previousTime = performance.now();

  const frame = (time) => {
    const delta = Math.min((time - previousTime) / 1000, WORLD.maxFrameDelta);
    previousTime = time;
    accumulator += delta;

    while (accumulator >= WORLD.fixedStep) {
      game.update(WORLD.fixedStep);
      accumulator -= WORLD.fixedStep;
    }

    game.render();
    requestAnimationFrame(frame);
  };

  document.addEventListener("visibilitychange", () => {
    previousTime = performance.now();
    accumulator = 0;
    if (document.hidden) game.input.clear();
  });

  restartButton.addEventListener("click", () => game.reset());
  canvas.addEventListener("pointerdown", () => canvas.focus({ preventScroll: true }));

  // API de solo lectura para verificar el motor sin agregar controles de depuracion al juego.
  window.__MVL_DEBUG__ = Object.freeze({
    snapshot: () => game.snapshot(),
    reset: () => game.reset(),
  });

  loadingMessage.hidden = true;
  requestAnimationFrame(frame);
})();
