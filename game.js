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

  const ACTOR_TUNING = Object.freeze({
    width: 34,
    standingHeight: 80,
    crouchingHeight: 40,
    maxHealth: 10,
    acceleration: 2300,
    deceleration: 2800,
    maxSpeed: 350,
    gravity: 1900,
    jumpVelocity: -930,
    maxFallSpeed: 1100,
    invulnerabilityTime: 0.78,
    lostHeartFlashTime: 0.46,
    stompDamage: 3,
    stompBounceVelocity: -790,
  });

  const FIREBALL_TUNING = Object.freeze({
    radius: 11,
    launchSpeed: 650,
    launchLift: -125,
    gravity: 1450,
    bounceVelocity: 470,
    maxLifetime: 4,
    maxBounces: 7,
    maxActivePerActor: 2,
    trailInterval: 0.025,
  });

  // La apariencia está separada de la física para admitir un editor futuro.
  const PLAYER_APPEARANCE = Object.freeze({
    skin: "#e9ad76",
    skinLight: "#ffd0a0",
    hair: "#3a2430",
    shirt: "#16a6a1",
    shirtLight: "#63d7c7",
    pants: "#264f78",
    shoes: "#172238",
    accent: "#fff3a3",
  });

  const AI_APPEARANCE = Object.freeze({
    skin: "#d89468",
    skinLight: "#f6bd8f",
    hair: "#172238",
    shirt: "#7e4bc6",
    shirtLight: "#b58bf0",
    pants: "#52357c",
    shoes: "#251c38",
    accent: "#ffcf5a",
  });

  // El futuro editor solo elige un tipo por celda. HP y dimensiones son del motor.
  const TILE_TYPES = Object.freeze({
    floatingBrick: Object.freeze({ symbol: "F", maxHp: 3, breakFromBelow: true }),
    groundBrick: Object.freeze({ symbol: "G", maxHp: 6, breakFromBelow: false }),
  });

  const SYMBOL_TO_TYPE = Object.freeze(
    Object.fromEntries(
      Object.entries(TILE_TYPES).map(([type, definition]) => [definition.symbol, type]),
    ),
  );

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
    KeyS: "crouch",
    KeyE: "fire",
    Space: "jump",
    Enter: "spawnAI",
  });

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const randomRange = (min, max) => min + Math.random() * (max - min);
  const moveToward = (value, target, amount) => {
    if (value < target) return Math.min(value + amount, target);
    if (value > target) return Math.max(value - amount, target);
    return target;
  };
  const visualHeartHalf = (half, mirrored) =>
    mirrored ? (half === "left" ? "right" : "left") : half;
  const groundedShoeYs = (legOffsets) => {
    const base = 72 - Math.max(legOffsets[0], legOffsets[1]);
    return [base + legOffsets[0], base + legOffsets[1]];
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

  class AudioSystem {
    constructor() {
      this.context = null;
      this.enabled = true;
      const unlock = () => this.ensureContext();
      window.addEventListener("keydown", unlock);
      window.addEventListener("pointerdown", unlock);
    }

    ensureContext() {
      if (!this.enabled) return null;
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      if (!this.context) this.context = new AudioContextClass();
      if (this.context.state === "suspended") this.context.resume();
      return this.context;
    }

    tone({ frequency, endFrequency = frequency, duration, type = "square", volume = 0.05, delay = 0 }) {
      const context = this.ensureContext();
      if (!context) return;
      const start = context.currentTime + delay;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(Math.max(30, frequency), start);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), start + duration);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    }

    jump() {
      this.tone({ frequency: 220, endFrequency: 510, duration: 0.13, type: "square", volume: 0.045 });
    }

    fire() {
      this.tone({ frequency: 620, endFrequency: 260, duration: 0.11, type: "sawtooth", volume: 0.038 });
      this.tone({ frequency: 980, endFrequency: 520, duration: 0.07, type: "square", volume: 0.02, delay: 0.015 });
    }

    surfaceImpact(blockType) {
      if (blockType === "groundBrick") {
        this.tone({ frequency: 145, endFrequency: 70, duration: 0.09, type: "triangle", volume: 0.055 });
      } else {
        this.tone({ frequency: 520, endFrequency: 310, duration: 0.075, type: "square", volume: 0.038 });
      }
    }

    blockDestroyed(blockType) {
      if (blockType === "groundBrick") {
        this.tone({ frequency: 118, endFrequency: 38, duration: 0.28, type: "triangle", volume: 0.075 });
        this.tone({ frequency: 82, endFrequency: 46, duration: 0.2, type: "sawtooth", volume: 0.032, delay: 0.035 });
        return;
      }
      this.tone({ frequency: 760, endFrequency: 180, duration: 0.14, type: "square", volume: 0.052 });
      this.tone({ frequency: 1320, endFrequency: 340, duration: 0.1, type: "sawtooth", volume: 0.028, delay: 0.018 });
    }

    actorHit() {
      this.tone({ frequency: 250, endFrequency: 75, duration: 0.2, type: "sawtooth", volume: 0.06 });
      this.tone({ frequency: 710, endFrequency: 180, duration: 0.13, type: "square", volume: 0.026 });
    }

    fireballClash() {
      this.tone({ frequency: 820, endFrequency: 120, duration: 0.16, type: "sawtooth", volume: 0.05 });
      this.tone({ frequency: 1140, endFrequency: 260, duration: 0.12, type: "square", volume: 0.025, delay: 0.02 });
    }

    stomp() {
      this.tone({ frequency: 125, endFrequency: 72, duration: 0.14, type: "square", volume: 0.065 });
      this.tone({ frequency: 360, endFrequency: 620, duration: 0.11, type: "triangle", volume: 0.04, delay: 0.025 });
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

    blockAt(column, row) {
      return this.blockByCell.get(`${column},${row}`) ?? null;
    }

    overlapsActive(rectangle) {
      return this.blocks.some((block) => block.active && rectanglesOverlap(rectangle, block));
    }
  }

  class Actor {
    constructor({ id, x, facing, appearance, isAI = false }) {
      this.id = id;
      this.isAI = isAI;
      this.appearance = appearance;
      this.width = ACTOR_TUNING.width;
      this.height = ACTOR_TUNING.standingHeight;
      this.x = x;
      this.y = 16 * WORLD.tileSize - this.height;
      this.previousX = this.x;
      this.previousY = this.y;
      this.vx = 0;
      this.vy = 0;
      this.facing = facing;
      this.grounded = true;
      this.crouching = false;
      this.maxHealth = ACTOR_TUNING.maxHealth;
      this.health = this.maxHealth;
      this.invulnerability = 0;
      this.lostHeartTimer = 0;
      this.lostHeartIndex = -1;
      this.lostHeartHalf = "right";
      this.lostHealthSegments = [];
      this.firePoseTimer = 0;
      this.forcedCrouchTimer = 0;
      this.crouchJumping = false;
      this.animationTime = Math.random() * 2;
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

    get alive() {
      return this.health > 0;
    }

    updateTimers(dt) {
      this.invulnerability = Math.max(0, this.invulnerability - dt);
      this.lostHeartTimer = Math.max(0, this.lostHeartTimer - dt);
      this.firePoseTimer = Math.max(0, this.firePoseTimer - dt);
      this.forcedCrouchTimer = Math.max(0, this.forcedCrouchTimer - dt);
      this.animationTime += dt;
    }

    setCrouching(wantsToCrouch, world, forced = false) {
      if (wantsToCrouch && !this.crouching) {
        const bottom = this.bottom;
        this.height = ACTOR_TUNING.crouchingHeight;
        this.y = bottom - this.height;
        this.crouching = true;
        return;
      }

      if (
        !wantsToCrouch &&
        this.crouching &&
        this.forcedCrouchTimer === 0 &&
        !(this.crouchJumping && !this.grounded)
      ) {
        const target = {
          x: this.x,
          y: this.bottom - ACTOR_TUNING.standingHeight,
          width: this.width,
          height: ACTOR_TUNING.standingHeight,
        };
        if (!world.overlapsActive(target)) {
          this.y = target.y;
          this.height = target.height;
          this.crouching = false;
        }
      }
    }

    update(dt, controls, world, events) {
      this.updateTimers(dt);
      if (!this.alive) return;
      const forcedCrouch = this.forcedCrouchTimer > 0;
      this.setCrouching(Boolean(controls.crouch) || forcedCrouch, world, forcedCrouch);
      this.previousX = this.x;
      this.previousY = this.y;

      const horizontalInput =
        this.crouching && this.grounded
          ? 0
          : clamp(controls.horizontal || 0, -1, 1);
      if (horizontalInput !== 0) {
        this.facing = horizontalInput;
        this.vx = moveToward(
          this.vx,
          horizontalInput * ACTOR_TUNING.maxSpeed,
          ACTOR_TUNING.acceleration * dt,
        );
      } else {
        this.vx = moveToward(this.vx, 0, ACTOR_TUNING.deceleration * dt);
      }

      if (controls.jumpPressed && this.grounded && this.forcedCrouchTimer === 0) {
        this.crouchJumping = this.crouching;
        this.vy = ACTOR_TUNING.jumpVelocity;
        this.grounded = false;
        events.onJump(this);
      }

      this.vy = Math.min(this.vy + ACTOR_TUNING.gravity * dt, ACTOR_TUNING.maxFallSpeed);
      this.moveHorizontally(dt, world);
      this.moveVertically(dt, world, events.onBlockBreak);
      if (this.grounded && this.crouchJumping) this.crouchJumping = false;
    }

    moveHorizontally(dt, world) {
      this.x += this.vx * dt;
      this.x = clamp(this.x, 0, WORLD.width - this.width);

      for (const block of world.blocks) {
        if (!block.active || !rectanglesOverlap(this, block)) continue;
        if (this.vx > 0) this.x = block.x - this.width;
        else if (this.vx < 0) this.x = block.x + block.width;
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
        const ceilingBlocks = overlaps.filter(
          (block) => this.previousY >= block.y + block.height - 1,
        );
        if (ceilingBlocks.length === 0) return;

        const contactBottom = Math.max(...ceilingBlocks.map((block) => block.y + block.height));
        const firstContactRow = ceilingBlocks.filter(
          (block) => block.y + block.height === contactBottom,
        );
        const hitBlock = firstContactRow.reduce((best, block) => {
          const overlap =
            Math.min(this.x + this.width, block.x + block.width) - Math.max(this.x, block.x);
          const bestOverlap =
            Math.min(this.x + this.width, best.x + best.width) - Math.max(this.x, best.x);
          return overlap > bestOverlap ? block : best;
        });

        this.y = contactBottom;
        this.vy = 0;
        if (
          !this.crouching &&
          !this.crouchJumping &&
          hitBlock.breakFromBelow &&
          hitBlock.breakImmediately()
        ) {
          onBlockBreak(hitBlock);
        }
      }
    }

    takeDamage(amount, knockbackDirection, kind = "projectile", bypassInvulnerability = false) {
      if (!this.alive || (this.invulnerability > 0 && !bypassInvulnerability)) return false;
      const previousHealth = this.health;
      this.health = Math.max(0, this.health - amount);
      this.lostHeartIndex = Math.floor(this.health / 2);
      this.lostHeartHalf = this.health % 2 === 1 ? "right" : "left";
      this.lostHealthSegments = Array.from(
        { length: previousHealth - this.health },
        (_, offset) => {
          const removedUnit = previousHealth - 1 - offset;
          return {
            heartIndex: Math.floor(removedUnit / 2),
            half: removedUnit % 2 === 0 ? "left" : "right",
          };
        },
      );
      this.lostHeartTimer = ACTOR_TUNING.lostHeartFlashTime;
      this.invulnerability = ACTOR_TUNING.invulnerabilityTime;
      if (kind === "stomp") {
        this.forcedCrouchTimer = ACTOR_TUNING.invulnerabilityTime;
        this.vx = knockbackDirection * 120;
        this.vy = Math.max(0, this.vy);
      } else {
        this.vx = knockbackDirection * 230;
        this.vy = Math.min(this.vy, -210);
      }
      return true;
    }
  }

  class RivalAI {
    constructor(actor) {
      this.actor = actor;
      this.decisionTimer = 0;
      this.fireCooldown = 0.38;
      this.jumpQueued = false;
      this.crouchTimer = 0;
      this.strafeTimer = 0;
      this.strafeDirection = actor.facing;
      this.horizontal = 0;
      this.firePressed = false;
    }

    decide(dt, game) {
      this.firePressed = false;
      this.fireCooldown = Math.max(0, this.fireCooldown - dt);
      this.crouchTimer = Math.max(0, this.crouchTimer - dt);
      this.strafeTimer = Math.max(0, this.strafeTimer - dt);
      this.decisionTimer -= dt;

      if (this.decisionTimer <= 0) {
        this.decisionTimer = randomRange(0.045, 0.085);
        const actor = this.actor;
        const target = game.player;
        const predictedTargetX = target.centerX + target.vx * 0.2;
        const deltaX = predictedTargetX - actor.centerX;
        const distance = Math.abs(deltaX);

        const canPursueStomp =
          actor.bottom < target.y + 16 &&
          distance < 175 &&
          actor.vy > -180;
        if (canPursueStomp) this.horizontal = Math.sign(deltaX);
        else if (distance > 285) this.horizontal = Math.sign(deltaX);
        else if (distance < 105) this.horizontal = -Math.sign(deltaX);
        else {
          if (this.strafeTimer === 0) {
            this.strafeTimer = randomRange(0.22, 0.46);
            this.strafeDirection =
              Math.random() < 0.78 ? Math.sign(deltaX) : -Math.sign(deltaX);
          }
          this.horizontal = this.strafeDirection;
        }

        const movementDirection = this.horizontal || actor.facing;
        const frontX = actor.centerX + movementDirection * (actor.width / 2 + 30);
        const frontColumn = clamp(Math.floor(frontX / WORLD.tileSize), 0, WORLD.columns - 1);
        const feetRow = clamp(Math.floor((actor.bottom + 4) / WORLD.tileSize), 0, WORLD.rows - 1);
        const support = game.world.blockAt(frontColumn, feetRow);
        const lowerSupport = game.world.blockAt(frontColumn, feetRow + 1);
        const holeAhead =
          actor.grounded &&
          (!support || !support.active) &&
          (!lowerSupport || !lowerSupport.active);
        const obstacleAhead = game.world.blocks.some(
          (block) =>
            block.active &&
            block.x < frontX + 8 &&
            block.x + block.width > frontX - 8 &&
            block.y < actor.bottom - 6 &&
            block.y + block.height > actor.y + 8,
        );

        const incoming = game.fireballs
          .filter((fireball) => fireball.active && fireball.ownerId !== actor.id)
          .map((fireball) => {
            const timeToActor = (actor.centerX - fireball.x) / fireball.vx;
            const predictedY =
              fireball.y +
              fireball.vy * timeToActor +
              0.5 * FIREBALL_TUNING.gravity * timeToActor * timeToActor;
            return { fireball, timeToActor, predictedY };
          })
          .filter(
            ({ fireball, timeToActor, predictedY }) =>
              Number.isFinite(timeToActor) &&
              timeToActor > 0 &&
              timeToActor < 0.72 &&
              predictedY + fireball.radius > actor.y - 8 &&
              predictedY - fireball.radius < actor.bottom + 8,
          )
          .sort((a, b) => a.timeToActor - b.timeToActor)[0];

        const stompThreat =
          actor.grounded &&
          target.vy > 110 &&
          target.bottom < actor.y + 14 &&
          target.bottom > actor.y - 190 &&
          Math.abs(target.centerX + target.vx * 0.16 - actor.centerX) < 55;

        if (stompThreat && actor.forcedCrouchTimer === 0) {
          this.crouchTimer = Math.max(this.crouchTimer, 0.34);
          this.jumpQueued = false;
        } else if (incoming && actor.grounded) {
          if (incoming.predictedY < actor.y + actor.height * 0.48) {
            this.crouchTimer = Math.max(this.crouchTimer, 0.38);
          } else {
            this.jumpQueued = true;
          }
        }

        const offensiveJump =
          distance > 70 &&
          distance < 235 &&
          target.y >= actor.y - 35 &&
          Math.random() < 0.42;
        if (
          actor.grounded &&
          actor.forcedCrouchTimer === 0 &&
          !stompThreat &&
          (holeAhead || obstacleAhead || target.y < actor.y - 75 || offensiveJump)
        ) {
          this.jumpQueued = true;
          this.crouchTimer = 0;
        }

        if (!actor.grounded && actor.vy > 80) {
          const projectedLandingX = actor.centerX + actor.vx * 0.22;
          const landingBlock = game.world.blocks
            .filter(
              (block) =>
                block.active &&
                block.y >= actor.bottom - 4 &&
                block.y <= actor.bottom + 250 &&
                Math.abs(block.x + block.width / 2 - projectedLandingX) < 310,
            )
            .sort((first, second) => {
              const firstScore =
                first.y - actor.bottom +
                Math.abs(first.x + first.width / 2 - projectedLandingX) * 0.45;
              const secondScore =
                second.y - actor.bottom +
                Math.abs(second.x + second.width / 2 - projectedLandingX) * 0.45;
              return firstScore - secondScore;
            })[0];
          if (landingBlock) {
            const landingDirection = Math.sign(
              landingBlock.x + landingBlock.width / 2 - actor.centerX,
            );
            if (landingDirection !== 0) this.horizontal = landingDirection;
          }
        }

        const flightTime = distance / FIREBALL_TUNING.launchSpeed;
        const predictedFireballY =
          actor.y + actor.height * 0.45 +
          FIREBALL_TUNING.launchLift * flightTime +
          0.5 * FIREBALL_TUNING.gravity * flightTime * flightTime;
        const usefulShot = Math.abs(predictedFireballY - target.centerY) < 135;
        if (
          this.fireCooldown <= 0 &&
          actor.forcedCrouchTimer === 0 &&
          this.crouchTimer === 0 &&
          target.invulnerability === 0 &&
          distance < 800 &&
          usefulShot
        ) {
          actor.facing = Math.sign(deltaX) || actor.facing;
          this.firePressed = true;
          this.fireCooldown = randomRange(0.38, 0.68);
        }

        if (incoming && incoming.timeToActor < 0.24 && actor.grounded && this.crouchTimer === 0) {
          this.jumpQueued = true;
        }
      }

      const controls = {
        horizontal: this.horizontal,
        crouch: this.crouchTimer > 0,
        jumpPressed: this.jumpQueued,
      };
      this.jumpQueued = false;
      return controls;
    }
  }

  class Fireball {
    constructor(owner) {
      this.ownerId = owner.id;
      this.radius = FIREBALL_TUNING.radius;
      this.x =
        owner.facing > 0
          ? owner.x + owner.width + this.radius + 3
          : owner.x - this.radius - 3;
      this.y = owner.y + owner.height * (owner.crouching ? 0.42 : 0.45);
      this.vx = owner.facing * FIREBALL_TUNING.launchSpeed;
      this.vy = FIREBALL_TUNING.launchLift;
      this.life = 0;
      this.bounces = 0;
      this.active = true;
      this.damagedBlockIds = new Set();
      this.spin = Math.random() * Math.PI * 2;
      this.trailTimer = 0;
    }

    update(dt, game) {
      if (!this.active) return;
      this.life += dt;
      this.vy += FIREBALL_TUNING.gravity * dt;
      this.spin += dt * 16 * Math.sign(this.vx || 1);
      this.trailTimer -= dt;
      if (this.trailTimer <= 0) {
        this.trailTimer += FIREBALL_TUNING.trailInterval;
        game.emitFireTrail(this);
      }

      const travel = Math.hypot(this.vx * dt, this.vy * dt);
      const substeps = clamp(Math.ceil(travel / (this.radius * 0.6)), 1, 12);
      const subDt = dt / substeps;

      for (let step = 0; step < substeps && this.active; step += 1) {
        this.moveHorizontal(subDt, game);
        if (this.active) this.hitActor(game);
        if (this.active) this.moveVertical(subDt, game);
        if (this.active) this.hitActor(game);
      }

      if (
        this.life >= FIREBALL_TUNING.maxLifetime ||
        this.bounces > FIREBALL_TUNING.maxBounces ||
        this.x < -80 ||
        this.x > WORLD.width + 80 ||
        this.y > WORLD.height + 120
      ) {
        this.active = false;
      }
    }

    tryDamageBlock(block, game) {
      if (this.damagedBlockIds.has(block.id)) return false;
      this.damagedBlockIds.add(block.id);
      const destroyed = game.damageBlock(block, 1);
      game.emitImpact(this.x, this.y, destroyed);
      if (!destroyed) game.audio.surfaceImpact(block.type);
      return destroyed;
    }

    moveHorizontal(dt, game) {
      this.x += this.vx * dt;
      const collisions = game.world.blocks.filter(
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
      if (this.tryDamageBlock(block, game)) return;

      this.x = this.vx > 0 ? block.x - this.radius : block.x + block.width + this.radius;
      this.active = false;
    }

    moveVertical(dt, game) {
      this.y += this.vy * dt;
      const collisions = game.world.blocks.filter(
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
      if (this.tryDamageBlock(block, game)) return;

      if (falling) {
        this.y = block.y - this.radius;
        this.vy = -FIREBALL_TUNING.bounceVelocity;
        this.bounces += 1;
        game.emitBounce(this.x, this.y);
      } else {
        this.y = block.y + block.height + this.radius;
        this.active = false;
      }
    }

    hitActor(game) {
      const targets = [game.player, game.aiActor].filter(Boolean);
      const target = targets.find(
        (actor) =>
          actor.id !== this.ownerId && actor.alive && circleOverlapsRectangle(this, actor),
      );
      if (!target) return;

      const damaged = target.takeDamage(1, Math.sign(this.vx) || 1, "projectile");
      game.emitActorImpact(this.x, this.y, damaged);
      this.active = false;
      if (damaged) game.onActorDamaged(target, 1, "projectile");
    }
  }

  class Cloud {
    constructor({ x, y, scale, speed, variant }) {
      this.x = x;
      this.y = y;
      this.scale = scale;
      this.speed = speed;
      this.variant = variant;
      this.width = (106 + variant * 10) * scale;
    }

    update(dt) {
      this.x += this.speed * dt;
      if (this.speed > 0 && this.x > WORLD.width + this.width) this.x = -this.width;
      if (this.speed < 0 && this.x < -this.width) this.x = WORLD.width + this.width;
    }
  }

  class Particle {
    constructor({ x, y, vx, vy, color, size, lifetime, gravity = 0 }) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.color = color;
      this.size = size;
      this.life = lifetime;
      this.maxLife = lifetime;
      this.gravity = gravity;
    }

    update(dt) {
      this.life -= dt;
      this.vy += this.gravity * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }
  }

  class Game {
    constructor() {
      this.audio = new AudioSystem();
      this.input = new InputManager();
      this.reset();
    }

    reset() {
      this.world = new World();
      this.player = new Actor({
        id: "player",
        x: 6 * WORLD.tileSize + 3,
        facing: 1,
        appearance: PLAYER_APPEARANCE,
      });
      this.aiActor = null;
      this.ai = null;
      this.fireballs = [];
      this.particles = [];
      this.wind = this.createWind();
      this.clouds = this.createClouds();
      this.state = "playing";
      this.resultReason = "";
      this.elapsed = 0;
      this.input.clear();
      restartButton.hidden = true;
      gameStatus.textContent = "Beta 0.5 iniciada. Tenés 10 puntos de vida. Enter activa al rival IA.";
      canvas.focus({ preventScroll: true });
    }

    createWind() {
      const direction = Math.random() < 0.5 ? -1 : 1;
      return direction * randomRange(7, 14);
    }

    createClouds() {
      return Array.from({ length: 9 }, (_, index) => {
        const depth = randomRange(0.58, 1.28);
        return new Cloud({
          x: randomRange(-80, WORLD.width + 30),
          y: randomRange(25, 235),
          scale: randomRange(0.42, 0.83),
          speed: this.wind * depth,
          variant: index % 3,
        });
      });
    }

    spawnAI() {
      if (this.aiActor || this.state !== "playing") return false;
      this.aiActor = new Actor({
        id: "ai",
        x: 25 * WORLD.tileSize + 3,
        facing: -1,
        appearance: AI_APPEARANCE,
        isAI: true,
      });
      this.ai = new RivalAI(this.aiActor);
      gameStatus.textContent = "Rival IA activado. Ambos personajes tienen 10 puntos de vida.";
      return true;
    }

    update(dt) {
      for (const cloud of this.clouds) cloud.update(dt);
      this.updateParticles(dt);

      if (this.state !== "playing") return;
      this.elapsed += dt;

      if (this.input.consumePress("spawnAI")) this.spawnAI();

      this.player.update(
        dt,
        {
          horizontal: Number(this.input.isHeld("right")) - Number(this.input.isHeld("left")),
          crouch: this.input.isHeld("crouch"),
          jumpPressed: this.input.consumePress("jump"),
        },
        this.world,
        {
          onBlockBreak: (block) => this.onBlockDestroyed(block),
          onJump: () => this.audio.jump(),
        },
      );

      if (this.input.consumePress("fire")) this.tryFire(this.player);

      if (this.aiActor?.alive) {
        const aiControls = this.ai.decide(dt, this);
        this.aiActor.update(
          dt,
          aiControls,
          this.world,
          {
            onBlockBreak: (block) => this.onBlockDestroyed(block),
            onJump: () => this.audio.jump(),
          },
        );
        if (this.ai.firePressed) this.tryFire(this.aiActor);
      } else if (this.aiActor) {
        this.aiActor.updateTimers(dt);
      }

      this.resolveStomps();

      for (const fireball of this.fireballs) fireball.update(dt, this);
      this.resolveFireballCollisions();
      this.fireballs = this.fireballs.filter((fireball) => fireball.active);

      this.checkVoid(this.player);
      if (this.state === "playing" && this.aiActor) this.checkVoid(this.aiActor);
      if (this.state !== "playing") return;

      if (this.player.health === 0 && this.player.invulnerability === 0) {
        this.endMatch("defeat", "TE QUEDASTE SIN CORAZONES");
      } else if (
        this.aiActor &&
        this.aiActor.health === 0 &&
        this.aiActor.invulnerability === 0
      ) {
        this.endMatch("victory", "RIVAL IA SIN CORAZONES");
      }
    }

    tryFire(actor) {
      if (!actor?.alive || actor.crouching) return false;
      const activeOwned = this.fireballs.filter(
        (fireball) => fireball.active && fireball.ownerId === actor.id,
      ).length;
      if (activeOwned >= FIREBALL_TUNING.maxActivePerActor) return false;

      const fireball = new Fireball(actor);
      this.fireballs.push(fireball);
      actor.firePoseTimer = 0.2;
      this.emitMuzzle(fireball.x, fireball.y);
      this.audio.fire();
      return true;
    }

    checkVoid(actor) {
      if (actor.y <= WORLD.height + 90) return;
      actor.health = 0;
      actor.invulnerability = 0;
      if (actor.id === "player") this.endMatch("defeat", "CAÍDA AL VACÍO · VIDA 0");
      else this.endMatch("victory", "LA IA CAYÓ AL VACÍO");
    }

    onActorDamaged(actor, amount, kind) {
      const who = actor.id === "player" ? "Jugador" : "Rival IA";
      gameStatus.textContent = `${who} perdió ${amount} punto${amount === 1 ? "" : "s"}. Vida: ${actor.health}.`;
      if (kind === "projectile") this.audio.actorHit();
    }

    resolveStomps() {
      if (!this.aiActor || !this.player.alive || !this.aiActor.alive) return;
      if (this.tryStomp(this.player, this.aiActor)) return;
      this.tryStomp(this.aiActor, this.player);
    }

    tryStomp(attacker, victim) {
      if (attacker.vy < 110) return false;
      const previousBottom = attacker.previousY + attacker.height;
      const horizontalOverlap =
        Math.min(attacker.x + attacker.width, victim.x + victim.width) -
        Math.max(attacker.x, victim.x);
      const crossedHead =
        previousBottom <= victim.previousY + 13 &&
        attacker.bottom >= victim.y &&
        attacker.y < victim.y;
      if (horizontalOverlap < 8 || !crossedHead) return false;

      const knockbackDirection = Math.sign(victim.centerX - attacker.centerX) || attacker.facing;
      const protectedByCrouch = victim.crouching;
      const damaged = protectedByCrouch
        ? false
        : victim.takeDamage(
            ACTOR_TUNING.stompDamage,
            knockbackDirection,
            "stomp",
          );
      if (damaged) victim.setCrouching(true, this.world, true);

      attacker.y = victim.y - attacker.height;
      attacker.vy = ACTOR_TUNING.stompBounceVelocity;
      attacker.grounded = false;
      this.emitStomp(attacker.centerX, victim.y, damaged);
      this.audio.stomp();
      if (damaged) this.onActorDamaged(victim, ACTOR_TUNING.stompDamage, "stomp");
      else if (protectedByCrouch) {
        gameStatus.textContent = "Pisotón bloqueado por el agachado.";
      }
      return true;
    }

    resolveFireballCollisions() {
      for (let firstIndex = 0; firstIndex < this.fireballs.length; firstIndex += 1) {
        const first = this.fireballs[firstIndex];
        if (!first.active) continue;
        for (let secondIndex = firstIndex + 1; secondIndex < this.fireballs.length; secondIndex += 1) {
          const second = this.fireballs[secondIndex];
          if (!second.active || first.ownerId === second.ownerId) continue;
          const dx = first.x - second.x;
          const dy = first.y - second.y;
          const collisionRadius = first.radius + second.radius;
          if (dx * dx + dy * dy > collisionRadius * collisionRadius) continue;

          first.active = false;
          second.active = false;
          this.emitFireballClash((first.x + second.x) / 2, (first.y + second.y) / 2);
          this.audio.fireballClash();
          break;
        }
      }
    }

    damageBlock(block, amount) {
      const destroyed = block.damage(amount);
      if (destroyed) this.onBlockDestroyed(block);
      return destroyed;
    }

    onBlockDestroyed(block) {
      this.applySupportCollapse(block);
      this.emitBlockBreak(block);
    }

    applySupportCollapse(block) {
      const actors = [this.player, this.aiActor].filter(Boolean);
      const blockCenterX = block.x + block.width / 2;
      const blockCenterY = block.y + block.height / 2;

      for (const actor of actors) {
        if (!actor.alive || !actor.grounded) continue;
        const horizontalOverlap =
          Math.min(actor.x + actor.width, block.x + block.width) -
          Math.max(actor.x, block.x);
        const stoodOnBlock = Math.abs(actor.bottom - block.y) <= 3 && horizontalOverlap >= 6;
        if (!stoodOnBlock) continue;

        const dx = actor.centerX - blockCenterX;
        const dy = actor.centerY - blockCenterY;
        const distance = Math.hypot(dx, dy) || 1;
        const radialX = dx / distance;
        const radialY = dy / distance;
        const damaged = actor.takeDamage(
          1,
          Math.sign(radialX) || actor.facing,
          "collapse",
          true,
        );

        actor.vx = radialX * 260;
        actor.vy = radialY * 320;
        actor.grounded = false;
        this.emitActorImpact(actor.centerX, actor.centerY, damaged);
        if (damaged) this.onActorDamaged(actor, 1, "collapse");
      }
    }

    addParticle(options) {
      this.particles.push(new Particle(options));
    }

    emitMuzzle(x, y) {
      for (let i = 0; i < 5; i += 1) {
        this.addParticle({
          x,
          y,
          vx: randomRange(-80, 80),
          vy: randomRange(-90, 50),
          color: i % 2 ? "#fff4a8" : "#ff5a24",
          size: randomRange(3, 6),
          lifetime: randomRange(0.12, 0.22),
        });
      }
    }

    emitFireTrail(fireball) {
      const direction = Math.sign(fireball.vx) || 1;
      this.addParticle({
        x: fireball.x - direction * randomRange(8, 13),
        y: fireball.y + randomRange(-5, 5),
        vx: -fireball.vx * randomRange(0.035, 0.08) + randomRange(-18, 18),
        vy: randomRange(-24, 24),
        color: Math.random() < 0.45 ? "#ffc83d" : "#ff5a24",
        size: randomRange(3, 6),
        lifetime: randomRange(0.13, 0.24),
      });
    }

    emitBounce(x, y) {
      for (let i = 0; i < 3; i += 1) {
        this.addParticle({
          x,
          y,
          vx: randomRange(-55, 55),
          vy: randomRange(-90, -25),
          color: "#ffc83d",
          size: 3,
          lifetime: 0.18,
          gravity: 380,
        });
      }
    }

    emitImpact(x, y, destroyed) {
      const count = destroyed ? 10 : 5;
      for (let i = 0; i < count; i += 1) {
        this.addParticle({
          x,
          y,
          vx: randomRange(destroyed ? -180 : -75, destroyed ? 180 : 75),
          vy: randomRange(destroyed ? -270 : -120, -20),
          color: destroyed ? "#d85b2b" : "#fff3a3",
          size: destroyed ? 7 : 4,
          lifetime: destroyed ? 0.62 : 0.25,
          gravity: 900,
        });
      }
    }

    emitActorImpact(x, y, damaged) {
      const colors = damaged ? ["#ffffff", "#ffcf5a", "#ff5a5a"] : ["#ffffff"];
      for (let i = 0; i < (damaged ? 12 : 4); i += 1) {
        this.addParticle({
          x,
          y,
          vx: randomRange(-220, 220),
          vy: randomRange(-230, 90),
          color: colors[i % colors.length],
          size: randomRange(4, 7),
          lifetime: randomRange(0.24, 0.48),
          gravity: 420,
        });
      }
    }

    emitFireballClash(x, y) {
      const colors = ["#fff7c2", "#ffc83d", "#ff5a24", "#ffffff"];
      for (let i = 0; i < 18; i += 1) {
        const angle = (Math.PI * 2 * i) / 18 + randomRange(-0.12, 0.12);
        const speed = randomRange(120, 330);
        this.addParticle({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: colors[i % colors.length],
          size: randomRange(3, 7),
          lifetime: randomRange(0.2, 0.42),
          gravity: 120,
        });
      }
    }

    emitStomp(x, y, damaged) {
      const colors = damaged ? ["#ffffff", "#fff3a3", "#ffcf5a"] : ["#ffffff"];
      for (let i = 0; i < 14; i += 1) {
        const direction = i % 2 === 0 ? -1 : 1;
        this.addParticle({
          x: x + randomRange(-10, 10),
          y,
          vx: direction * randomRange(80, 260),
          vy: randomRange(-210, -45),
          color: colors[i % colors.length],
          size: randomRange(3, 7),
          lifetime: randomRange(0.25, 0.48),
          gravity: 520,
        });
      }
    }

    emitBlockBreak(block) {
      this.audio.blockDestroyed(block.type);
      const colors =
        block.type === "groundBrick"
          ? ["#e8752f", "#8f301d", "#ffc15a"]
          : ["#c84d2b", "#72251f", "#f09a3e"];
      for (let i = 0; i < 12; i += 1) {
        this.addParticle({
          x: block.x + Math.random() * block.width,
          y: block.y + Math.random() * block.height,
          vx: randomRange(-170, 170),
          vy: randomRange(-400, -80),
          color: colors[i % colors.length],
          size: randomRange(6, 12),
          lifetime: randomRange(0.55, 0.9),
          gravity: 900,
        });
      }
    }

    updateParticles(dt) {
      for (const particle of this.particles) particle.update(dt);
      this.particles = this.particles.filter((particle) => particle.life > 0);
    }

    endMatch(state, reason) {
      if (this.state !== "playing") return;
      this.state = state;
      this.resultReason = reason;
      this.fireballs.length = 0;
      restartButton.hidden = false;
      gameStatus.textContent = `${state === "victory" ? "Victoria" : "Game over"}. ${reason}.`;
    }

    snapshot() {
      const actorSnapshot = (actor) =>
        actor
          ? {
              id: actor.id,
              x: Number(actor.x.toFixed(2)),
              y: Number(actor.y.toFixed(2)),
              width: actor.width,
              height: actor.height,
              vx: Number(actor.vx.toFixed(2)),
              vy: Number(actor.vy.toFixed(2)),
              facing: actor.facing,
              grounded: actor.grounded,
              crouching: actor.crouching,
              crouchJumping: actor.crouchJumping,
              health: actor.health,
              maxHealth: actor.maxHealth,
              invulnerability: Number(actor.invulnerability.toFixed(2)),
              forcedCrouchTimer: Number(actor.forcedCrouchTimer.toFixed(2)),
            }
          : null;
      return {
        state: this.state,
        wind: Number(this.wind.toFixed(2)),
        cloudCount: this.clouds.length,
        cloudSpeeds: this.clouds.map((cloud) => Number(cloud.speed.toFixed(2))),
        player: actorSnapshot(this.player),
        ai: actorSnapshot(this.aiActor),
        particleCount: this.particles.length,
        fireballCount: this.fireballs.length,
        fireballsByOwner: {
          player: this.fireballs.filter((fireball) => fireball.ownerId === "player").length,
          ai: this.fireballs.filter((fireball) => fireball.ownerId === "ai").length,
        },
        fireballs: this.fireballs.map((fireball) => ({
          ownerId: fireball.ownerId,
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
      for (const block of this.world.blocks) if (block.active) this.drawBlock(block);
      for (const particle of this.particles) this.drawParticle(particle);
      for (const fireball of this.fireballs) this.drawFireball(fireball);
      this.drawActor(this.player);
      if (this.aiActor) this.drawActor(this.aiActor);
      this.drawHud();
      if (this.state !== "playing") this.drawResult();
    }

    drawSky() {
      ctx.fillStyle = "#75AADB";
      ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    }

    drawCloud(cloud) {
      const variantOffset = cloud.variant * 7;
      ctx.save();
      ctx.translate(Math.round(cloud.x), Math.round(cloud.y));
      ctx.scale(cloud.scale, cloud.scale);
      ctx.fillStyle = "rgba(37, 89, 133, 0.3)";
      ctx.fillRect(13, 35, 92 + variantOffset, 19);
      ctx.fillRect(29, 22, 59 + variantOffset, 31);
      ctx.fillRect(47 + variantOffset / 2, 10, 31, 43);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(10, 30, 94 + variantOffset, 19);
      ctx.fillRect(24, 18, 65 + variantOffset, 31);
      ctx.fillRect(43 + variantOffset / 2, 7, 34, 42);
      ctx.fillStyle = "#d8f2ff";
      ctx.fillRect(18, 43, 78 + variantOffset, 6);
      ctx.fillRect(31, 35, 53 + variantOffset, 5);
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

    drawActor(actor) {
      if (!actor || (actor.invulnerability > 0 && Math.floor(actor.invulnerability * 22) % 2 === 0)) {
        return;
      }

      const colors = actor.appearance;
      const x = Math.round(actor.x + actor.width / 2);
      const y = Math.round(actor.y);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(actor.facing, 1);

      if (actor.crouching) {
        this.drawCrouchingActor(actor, colors);
        ctx.restore();
        return;
      }

      const walking = actor.grounded && Math.abs(actor.vx) > 15;
      const walkFrame = Math.floor(actor.animationTime * 11) % 4;
      const legOffsets = walking ? [[-4, 4], [-1, 1], [4, -4], [1, -1]][walkFrame] : [0, 0];
      const shoeYs = groundedShoeYs(legOffsets);
      const bob = walking ? (walkFrame % 2) : Math.round(Math.sin(actor.animationTime * 3) * 0.5);
      const airborne = !actor.grounded;
      const firing = actor.firePoseTimer > 0;

      // Piernas y calzado.
      ctx.fillStyle = colors.pants;
      if (airborne) {
        ctx.fillRect(-13, 54 + bob, 12, 14);
        ctx.fillRect(2, 52 + bob, 11, 11);
      } else {
        ctx.fillRect(-12, 52 + bob, 10, 20 + legOffsets[0]);
        ctx.fillRect(2, 52 + bob, 10, 20 + legOffsets[1]);
      }
      ctx.fillStyle = colors.shoes;
      ctx.fillRect(-15, airborne ? 66 : shoeYs[0], 15, 8);
      ctx.fillRect(2, airborne ? 62 : shoeYs[1], 15, 8);

      // Torso por capas: camisa, luz y tirantes.
      ctx.fillStyle = colors.shirt;
      ctx.fillRect(-15, 28 + bob, 30, 29);
      ctx.fillStyle = colors.shirtLight;
      ctx.fillRect(-10, 30 + bob, 18, 5);
      ctx.fillStyle = colors.pants;
      ctx.fillRect(-11, 43 + bob, 22, 15);
      ctx.fillRect(-10, 34 + bob, 5, 12);
      ctx.fillRect(5, 34 + bob, 5, 12);
      ctx.fillStyle = colors.accent;
      ctx.fillRect(-7, 42 + bob, 4, 4);
      ctx.fillRect(4, 42 + bob, 4, 4);

      // Brazos con poses de caminar, salto y disparo.
      ctx.fillStyle = colors.skin;
      if (firing) {
        ctx.fillRect(12, 31 + bob, 20, 8);
        ctx.fillStyle = colors.skinLight;
        ctx.fillRect(29, 29 + bob, 7, 11);
        ctx.fillStyle = colors.skin;
        ctx.fillRect(-20, 31 + bob, 7, 20);
      } else if (airborne) {
        ctx.fillRect(11, 24 + bob, 8, 19);
        ctx.fillRect(-19, 25 + bob, 8, 18);
        ctx.fillStyle = colors.skinLight;
        ctx.fillRect(12, 21 + bob, 8, 8);
      } else {
        const armSwing = walking ? legOffsets[1] : 0;
        ctx.fillRect(12, 32 + bob + armSwing, 8, 21);
        ctx.fillRect(-20, 32 + bob - armSwing, 8, 21);
      }

      // Cabeza y cabello originales, independientes de la ropa.
      ctx.fillStyle = colors.skin;
      ctx.fillRect(-12, 7 + bob, 25, 23);
      ctx.fillStyle = colors.skinLight;
      ctx.fillRect(4, 11 + bob, 11, 11);
      ctx.fillStyle = colors.hair;
      ctx.fillRect(-14, 3 + bob, 24, 8);
      ctx.fillRect(-14, 9 + bob, 7, 12);
      ctx.fillRect(-8, 1 + bob, 6, 5);
      ctx.fillRect(1, 0 + bob, 6, 5);
      ctx.fillStyle = "#172238";
      ctx.fillRect(8, 13 + bob, 4, 4);
      ctx.fillRect(12, 23 + bob, 5, 3);
      ctx.fillStyle = colors.skinLight;
      ctx.fillRect(-7, 25 + bob, 12, 4);
      ctx.restore();
    }

    drawCrouchingActor(actor, colors) {
      const firing = actor.firePoseTimer > 0;
      ctx.fillStyle = colors.shoes;
      ctx.fillRect(-15, 33, 15, 7);
      ctx.fillRect(3, 33, 14, 7);
      ctx.fillStyle = colors.pants;
      ctx.fillRect(-12, 25, 25, 10);
      ctx.fillStyle = colors.shirt;
      ctx.fillRect(-15, 17, 29, 13);
      ctx.fillStyle = colors.shirtLight;
      ctx.fillRect(-9, 18, 14, 4);
      ctx.fillStyle = colors.skin;
      if (firing) ctx.fillRect(12, 20, 22, 7);
      else ctx.fillRect(11, 21, 8, 10);
      ctx.fillRect(-11, 3, 24, 18);
      ctx.fillStyle = colors.skinLight;
      ctx.fillRect(5, 7, 10, 9);
      ctx.fillStyle = colors.hair;
      ctx.fillRect(-13, 0, 23, 7);
      ctx.fillRect(-13, 6, 6, 9);
      ctx.fillRect(-3, 0, 5, 3);
      ctx.fillStyle = "#172238";
      ctx.fillRect(8, 9, 4, 4);
    }

    drawFireball(fireball) {
      ctx.save();
      ctx.translate(Math.round(fireball.x), Math.round(fireball.y));
      ctx.rotate(fireball.spin);
      ctx.fillStyle = "#8e251f";
      ctx.fillRect(-9, -12, 18, 24);
      ctx.fillRect(-12, -9, 24, 18);
      ctx.fillRect(-14, -4, 28, 8);
      ctx.fillStyle = "#ff4b22";
      ctx.fillRect(-8, -9, 16, 18);
      ctx.fillRect(-10, -6, 20, 12);
      ctx.fillStyle = "#ffc83d";
      ctx.fillRect(-6, -7, 12, 14);
      ctx.fillRect(-8, -4, 16, 8);
      ctx.fillStyle = "#fff7c2";
      ctx.fillRect(-3, -5, 7, 9);
      ctx.restore();
    }

    drawParticle(particle) {
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = particle.color;
      ctx.fillRect(
        Math.round(particle.x - particle.size / 2),
        Math.round(particle.y - particle.size / 2),
        Math.ceil(particle.size),
        Math.ceil(particle.size),
      );
      ctx.globalAlpha = 1;
    }

    drawHeartShape(x, y, color) {
      ctx.fillStyle = color;
      ctx.fillRect(x + 3, y, 7, 7);
      ctx.fillRect(x + 15, y, 7, 7);
      ctx.fillRect(x, y + 5, 25, 8);
      ctx.fillRect(x + 4, y + 13, 17, 6);
      ctx.fillRect(x + 8, y + 19, 9, 5);
    }

    drawHeartHalf(x, y, side, color, alpha = 1) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.rect(side === "left" ? x : x + 12.5, y - 1, 12.5, 26);
      ctx.clip();
      this.drawHeartShape(x, y, color);
      ctx.restore();
    }

    drawPixelHeart(x, y, units, flashingHalves = [], flashVisible = false, mirrored = false) {
      const firstHalf = visualHeartHalf("left", mirrored);
      const secondHalf = visualHeartHalf("right", mirrored);
      this.drawHeartShape(x, y, "rgba(7, 17, 31, 0.3)");
      if (units >= 1) this.drawHeartHalf(x, y, firstHalf, "#e9424d");
      if (units >= 2) this.drawHeartHalf(x, y, secondHalf, "#e9424d");
      if (units > 0) {
        ctx.fillStyle = "#ff9da4";
        ctx.fillRect(x + (mirrored ? 16 : 4), y + 4, 5, 4);
      }
      if (flashVisible) {
        for (const half of flashingHalves) {
          const visualHalf = visualHeartHalf(half, mirrored);
          this.drawHeartHalf(x, y, visualHalf, "#ff7882", 0.95);
        }
      }
    }

    drawHearts(actor, startX, alignRight = false) {
      if (!actor) return;
      for (let index = 0; index < 5; index += 1) {
        const units = clamp(actor.health - index * 2, 0, 2);
        const flashing = actor.lostHeartTimer > 0;
        const flashVisible = Math.floor(actor.lostHeartTimer * 28) % 2 === 0;
        const flashingHalves = flashing
          ? actor.lostHealthSegments
              .filter((segment) => segment.heartIndex === index)
              .map((segment) => segment.half)
          : [];
        const x = alignRight ? startX - 25 - index * 31 : startX + index * 31;
        this.drawPixelHeart(
          x,
          23,
          units,
          flashingHalves,
          flashVisible,
          alignRight,
        );
      }
    }

    drawHud() {
      this.drawHearts(this.player, 22);
      if (this.aiActor) this.drawHearts(this.aiActor, WORLD.width - 22, true);

      ctx.save();
      if (this.elapsed < 9 && this.state === "playing") {
        const alpha = this.elapsed > 7 ? (9 - this.elapsed) / 2 : 1;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "rgba(7, 17, 31, 0.76)";
        ctx.fillRect(250, 18, 780, 43);
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.strokeRect(250, 18, 780, 43);
        ctx.fillStyle = "#ffffff";
        ctx.font = '700 17px "Courier New", monospace';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          "A/D MOVER · S AGACHAR · E FUEGO · ESPACIO SALTAR · ENTER IA",
          WORLD.width / 2,
          39,
        );
      } else if (!this.aiActor && this.state === "playing") {
        const pulse = 0.7 + Math.sin(this.elapsed * 4) * 0.25;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = "rgba(7, 17, 31, 0.72)";
        ctx.fillRect(510, 20, 260, 36);
        ctx.fillStyle = "#ffffff";
        ctx.font = '700 16px "Courier New", monospace';
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("ENTER · ACTIVAR RIVAL IA", 640, 38);
      }
      ctx.restore();
    }

    drawResult() {
      ctx.fillStyle = "rgba(7, 17, 31, 0.73)";
      ctx.fillRect(0, 0, WORLD.width, WORLD.height);
      ctx.textAlign = "center";
      ctx.fillStyle = this.state === "victory" ? "#fff3a3" : "#ffffff";
      ctx.font = '700 66px "Courier New", monospace';
      ctx.fillText(this.state === "victory" ? "GANASTE" : "GAME OVER", WORLD.width / 2, 304);
      ctx.fillStyle = "#ffffff";
      ctx.font = '700 27px "Courier New", monospace';
      ctx.fillText(this.resultReason, WORLD.width / 2, 354);
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

  window.__MVL_DEBUG__ = Object.freeze({
    snapshot: () => game.snapshot(),
    reset: () => game.reset(),
    spawnAI: () => game.spawnAI(),
    damagePlayer: (amount = 1) => game.player.takeDamage(amount, 1, "projectile"),
    visualHeartHalf,
    groundedShoeBottoms: (legOffsets = [0, 0]) =>
      groundedShoeYs(legOffsets).map((shoeY) => shoeY + 8),
    probeAIStompDefense: () => {
      game.reset();
      game.spawnAI();
      game.player.x = game.aiActor.x;
      game.player.y = game.aiActor.y - game.player.height - 30;
      game.player.vx = 0;
      game.player.vy = 420;
      game.ai.decisionTimer = 0;
      return game.ai.decide(WORLD.fixedStep, game);
    },
    probeAIProjectileDefense: (upper = true) => {
      game.reset();
      game.spawnAI();
      const fireball = new Fireball(game.player);
      fireball.x = game.aiActor.centerX - 120;
      fireball.y = game.aiActor.y + (upper ? -40 : 25);
      fireball.vx = FIREBALL_TUNING.launchSpeed;
      fireball.vy = 0;
      game.fireballs = [fireball];
      game.ai.decisionTimer = 0;
      return game.ai.decide(WORLD.fixedStep, game);
    },
    movePlayerToOpenSky: () => {
      game.player.x = 15 * WORLD.tileSize + 3;
      game.player.previousX = game.player.x;
      return game.snapshot();
    },
    forceStomp: () => {
      game.spawnAI();
      game.player.x = game.aiActor.x;
      game.player.y = game.aiActor.y - game.player.height + 2;
      game.player.previousY = game.player.y - 18;
      game.player.vy = 520;
      game.resolveStomps();
      return game.snapshot();
    },
    forceCrouchedStomp: () => {
      game.spawnAI();
      game.aiActor.setCrouching(true, game.world);
      game.aiActor.previousY = game.aiActor.y;
      game.player.x = game.aiActor.x;
      game.player.y = game.aiActor.y - game.player.height + 2;
      game.player.previousY = game.player.y - 18;
      game.player.vy = 520;
      game.resolveStomps();
      return game.snapshot();
    },
    destroyPlayerSupport: () => {
      const column = Math.floor(game.player.centerX / WORLD.tileSize);
      const block = game.world.blockAt(column, 16);
      game.damageBlock(block, block.hp);
      return game.snapshot();
    },
    forceFireballClash: () => {
      game.spawnAI();
      const first = new Fireball(game.player);
      const second = new Fireball(game.aiActor);
      first.x = 640;
      first.y = 360;
      second.x = 640;
      second.y = 360;
      game.fireballs = [first, second];
      game.resolveFireballCollisions();
      game.fireballs = game.fireballs.filter((fireball) => fireball.active);
      return game.snapshot();
    },
    forceProjectileHitAI: () => {
      game.spawnAI();
      const fireball = new Fireball(game.player);
      fireball.x = game.aiActor.centerX;
      fireball.y = game.aiActor.centerY;
      game.fireballs = [fireball];
      fireball.hitActor(game);
      game.fireballs = game.fireballs.filter((candidate) => candidate.active);
      return game.snapshot();
    },
    forceSkyFireball: () => {
      const fireball = new Fireball(game.player);
      fireball.x = WORLD.width / 2;
      fireball.y = -200;
      fireball.vy = -220;
      game.fireballs = [fireball];
      fireball.update(WORLD.fixedStep, game);
      return game.snapshot();
    },
    dropPlayer: () => {
      game.player.y = WORLD.height + 100;
    },
  });

  loadingMessage.hidden = true;
  requestAnimationFrame(frame);
})();
