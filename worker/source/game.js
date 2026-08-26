(() => {
  "use strict";

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d", { alpha: false });
  const loadingMessage = document.querySelector("#loadingMessage");
  const restartButton = document.querySelector("#restartButton");
  const menuButton = document.querySelector("#menuButton");
  const gameStatus = document.querySelector("#gameStatus");
  const gameShell = document.querySelector("#gameShell");
  const menuLayer = document.querySelector("#menuLayer");
  const fullscreenButton = document.querySelector("#fullscreenButton");
  const settingsButton = document.querySelector("#settingsButton");
  const characterPreview = document.querySelector("#characterPreview");
  const levelGridElement = document.querySelector("#levelGrid");
  const touchPad = document.querySelector("#touchPad");
  const touchStick = document.querySelector("#touchStick");
  const touchJump = document.querySelector("#touchJump");
  const touchFire = document.querySelector("#touchFire");

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
    maxLifetime: 6,
    maxBounces: 8,
    bounceRetention: 0.86,
    maxActivePerActor: 2,
    trailInterval: 0.025,
  });

  // La apariencia está separada de la física: ninguna opción altera la hitbox.
  const PLAYER_APPEARANCE = Object.freeze({
    sex: "male",
    skin: "#e9ad76",
    hairStyle: "short",
    hair: "#3a2430",
    topStyle: "shortSleeve",
    shirt: "#16a6a1",
    bottomStyle: "shorts",
    pants: "#264f78",
    footwearStyle: "sneakers",
    shoes: "#172238",
    darkGlasses: false,
    darkGlassesColor: "#101827",
    headband: false,
    headbandColor: "#ffcf5a",
    wristbands: false,
    wristbandsColor: "#ffcf5a",
    faceMask: false,
    faceMaskColor: "#202c43",
    hood: false,
    hoodColor: "#16a6a1",
    belt: false,
    beltColor: "#5b3024",
    vest: false,
    vestColor: "#f06a2c",
  });

  const AI_APPEARANCE = Object.freeze({
    sex: "female",
    skin: "#d89468",
    hairStyle: "long",
    hair: "#172238",
    topStyle: "longSleeve",
    shirt: "#7e4bc6",
    bottomStyle: "longPants",
    pants: "#52357c",
    footwearStyle: "shoes",
    shoes: "#251c38",
    darkGlasses: false,
    darkGlassesColor: "#101827",
    headband: true,
    headbandColor: "#ffcf5a",
    wristbands: true,
    wristbandsColor: "#ffcf5a",
    faceMask: false,
    faceMaskColor: "#202c43",
    hood: false,
    hoodColor: "#7e4bc6",
    belt: true,
    beltColor: "#251c38",
    vest: false,
    vestColor: "#f06a2c",
  });

  const APPEARANCE_OPTIONS = Object.freeze({
    sex: Object.freeze(["male", "female"]),
    hairStyle: Object.freeze(["short", "long", "bald"]),
    topStyle: Object.freeze(["shortSleeve", "longSleeve", "noTop"]),
    bottomStyle: Object.freeze(["shorts", "longPants", "noPants"]),
    footwearStyle: Object.freeze(["sneakers", "shoes", "barefoot"]),
  });

  const ACCESSORY_KEYS = Object.freeze([
    "darkGlasses", "headband", "wristbands", "faceMask", "hood", "belt", "vest",
  ]);

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

  const CONTROL_PRESETS = Object.freeze({
    classic: Object.freeze({
      KeyA: "p1Left", KeyD: "p1Right", KeyS: "p1Crouch", KeyE: "p1Fire", Space: "p1Jump",
      ArrowLeft: "p2Left", ArrowRight: "p2Right", ArrowDown: "p2Crouch", Enter: "p2Fire", ArrowUp: "p2Jump",
    }),
    alternate: Object.freeze({
      ArrowLeft: "p1Left", ArrowRight: "p1Right", ArrowDown: "p1Crouch", Slash: "p1Fire", ArrowUp: "p1Jump",
      KeyA: "p2Left", KeyD: "p2Right", KeyS: "p2Crouch", KeyE: "p2Fire", Space: "p2Jump",
    }),
  });

  const DEFAULT_SETTINGS = Object.freeze({
    language: "es",
    fps: 60,
    touchOpacity: 0.25,
    controlPreset: "classic",
    sound: true,
    music: false,
  });

  const I18N = Object.freeze({
    es: Object.freeze({
      tagline: "ARENA DE BLOQUES DESTRUCTIBLES", play: "JUGAR", character: "PERSONAJE", editor: "EDITOR DE NIVELES", settings: "AJUSTES", soon: "PRÓXIMAMENTE", chooseMode: "ELEGÍ UN MODO", vsAi: "VS IA", localPvp: "PVP LOCAL", onlinePvp: "PVP ONLINE", stage3Soon: "ETAPA 3 · PRÓXIMAMENTE", visualOnly: "CAMBIOS SOLO VISUALES", identity: "Identidad", sex: "Sexo", male: "Hombre", female: "Mujer", skin: "Piel", hair: "Cabello", hairStyle: "Tipo de pelo", shortHair: "Corto", longHair: "Largo", bald: "Pelado", clothes: "Ropa", topStyle: "Torso", shortSleeve: "Manga corta", longSleeve: "Manga larga", noTop: "Sin camiseta", topColor: "Color del torso", bottomStyle: "Piernas", shorts: "Pantalón corto", longPants: "Pantalón largo", noPants: "Sin pantalones", bottomColor: "Color de piernas", footwearStyle: "Calzado", sneakers: "Zapatillas", dressShoes: "Zapatos", barefoot: "Descalzo", footwearColor: "Color del calzado", accessories: "Accesorios", darkGlasses: "Gafas oscuras", headband: "Vincha", wristbands: "Muñequeras", faceMask: "Barbijo", hood: "Capucha", belt: "Cinturón", vest: "Chaleco", pauseWhenMatch: "LA PARTIDA SE PAUSA", language: "Idioma", fps: "FPS visuales", touchOpacity: "Opacidad controles táctiles", hidden: "Ocultos · no funcionan", controlPreset: "Controles de teclado", classic: "Clásicos", alternate: "Alternativos", sound: "Sonido", music: "Música", gridTypesOnly: "LA GRILLA SOLO GUARDA EL TIPO", floatingBrick: "LADRILLO FLOTANTE", groundBrick: "LADRILLO DE SUELO", eraser: "BORRADOR", testLevel: "PROBAR NIVEL", resetLevel: "RESTAURAR", jump: "SALTO", fire: "FUEGO", rematch: "REVANCHA", mainMenu: "MENÚ",
    }),
    en: Object.freeze({
      tagline: "DESTRUCTIBLE BLOCK ARENA", play: "PLAY", character: "CHARACTER", editor: "LEVEL EDITOR", settings: "SETTINGS", soon: "COMING SOON", chooseMode: "CHOOSE A MODE", vsAi: "VS AI", localPvp: "LOCAL PVP", onlinePvp: "ONLINE PVP", stage3Soon: "STAGE 3 · COMING SOON", visualOnly: "VISUAL CHANGES ONLY", identity: "Identity", sex: "Sex", male: "Male", female: "Female", skin: "Skin", hair: "Hair", hairStyle: "Hair type", shortHair: "Short", longHair: "Long", bald: "Bald", clothes: "Clothes", topStyle: "Torso", shortSleeve: "Short sleeves", longSleeve: "Long sleeves", noTop: "No shirt", topColor: "Torso color", bottomStyle: "Legs", shorts: "Shorts", longPants: "Long pants", noPants: "No pants", bottomColor: "Leg color", footwearStyle: "Footwear", sneakers: "Sneakers", dressShoes: "Shoes", barefoot: "Barefoot", footwearColor: "Footwear color", accessories: "Accessories", darkGlasses: "Dark glasses", headband: "Headband", wristbands: "Wristbands", faceMask: "Face mask", hood: "Hood", belt: "Belt", vest: "Vest", pauseWhenMatch: "THE MATCH IS PAUSED", language: "Language", fps: "Visual FPS", touchOpacity: "Touch controls opacity", hidden: "Hidden · disabled", controlPreset: "Keyboard controls", classic: "Classic", alternate: "Alternate", sound: "Sound", music: "Music", gridTypesOnly: "THE GRID ONLY STORES TILE TYPE", floatingBrick: "FLOATING BRICK", groundBrick: "GROUND BRICK", eraser: "ERASER", testLevel: "TEST LEVEL", resetLevel: "RESET", jump: "JUMP", fire: "FIRE", rematch: "REMATCH", mainMenu: "MENU",
    }),
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
  const normalizeAppearance = (appearance, fallback = PLAYER_APPEARANCE) => {
    const merged = { ...fallback, ...(appearance || {}) };
    for (const [key, values] of Object.entries(APPEARANCE_OPTIONS)) {
      if (!values.includes(merged[key])) merged[key] = fallback[key];
    }
    for (const key of ACCESSORY_KEYS) merged[key] = Boolean(merged[key]);
    if (appearance?.accessory === "band") merged.headband = true;
    if (appearance?.accessory === "visor") merged.darkGlasses = true;
    return merged;
  };
  const shadeColor = (color, amount) => {
    const hex = String(color || "#000000").replace("#", "");
    const normalized = hex.length === 3
      ? hex.split("").map((digit) => digit + digit).join("")
      : hex.padEnd(6, "0").slice(0, 6);
    const value = Number.parseInt(normalized, 16);
    if (!Number.isFinite(value)) return color;
    const channel = (shift) => clamp(((value >> shift) & 255) + amount, 0, 255);
    return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
  };
  const mixNumber = (from, to, ratio) => from + (to - from) * ratio;
  const readStoredJson = (key, fallback) => {
    try {
      const value = window.localStorage?.getItem(key);
      return value ? { ...fallback, ...JSON.parse(value) } : { ...fallback };
    } catch {
      return { ...fallback };
    }
  };
  const writeStoredJson = (key, value) => {
    try { window.localStorage?.setItem(key, JSON.stringify(value)); } catch { /* Sin almacenamiento persistente. */ }
  };
  const normalizeGrid = (grid) => {
    if (!Array.isArray(grid) || grid.length !== WORLD.rows) return [...LEVEL_GRID];
    return grid.map((row) => String(row).padEnd(WORLD.columns, " ").slice(0, WORLD.columns));
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
      this.codeMap = CONTROL_PRESETS.classic;

      window.addEventListener("keydown", (event) => {
        const action = this.codeMap[event.code];
        if (!action) return;
        event.preventDefault();
        if (!event.repeat && !this.held.has(action)) this.pressed.add(action);
        this.held.add(action);
      });

      window.addEventListener("keyup", (event) => {
        const action = this.codeMap[event.code];
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

    setPreset(preset) {
      this.codeMap = CONTROL_PRESETS[preset] || CONTROL_PRESETS.classic;
      this.clear();
    }

    setVirtual(action, held) {
      if (held) this.held.add(action);
      else this.held.delete(action);
    }

    pressVirtual(action) {
      if (!this.held.has(action)) this.pressed.add(action);
      this.held.add(action);
    }

    releaseVirtual(action) {
      this.held.delete(action);
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
      this.musicEnabled = false;
      this.musicTimer = 0;
      this.musicStep = 0;
      const unlock = () => this.ensureContext();
      window.addEventListener("keydown", unlock);
      window.addEventListener("pointerdown", unlock);
    }

    ensureContext() {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      if (!this.context) this.context = new AudioContextClass();
      if (this.context.state === "suspended") this.context.resume();
      return this.context;
    }

    tone({ frequency, endFrequency = frequency, duration, type = "square", volume = 0.05, delay = 0, music = false }) {
      if ((music && !this.musicEnabled) || (!music && !this.enabled)) return;
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

    updateMusic(dt, active) {
      if (!this.musicEnabled || !active) return;
      this.musicTimer -= dt;
      if (this.musicTimer > 0) return;
      this.musicTimer += 0.24;
      const notes = [110, 147, 165, 196, 165, 147, 123, 147];
      const frequency = notes[this.musicStep % notes.length];
      this.musicStep += 1;
      this.tone({ frequency, endFrequency: frequency, duration: 0.12, type: "triangle", volume: 0.018, music: true });
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
    constructor(grid = LEVEL_GRID) {
      this.blocks = [];
      this.blockByCell = new Map();
      let id = 0;
      grid.forEach((rowText, row) => {
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
      this.hurtPoseTimer = 0;
      this.stompPoseTimer = 0;
      this.skidTimer = 0;
      this.forcedCrouchTimer = 0;
      this.crouchJumping = false;
      this.animationTime = Math.random() * 2;
      this.animationState = "idle";
      this.previousAnimationState = "idle";
      this.animationStateTime = 0;
      this.animationBlend = 1;
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
      this.hurtPoseTimer = Math.max(0, this.hurtPoseTimer - dt);
      this.stompPoseTimer = Math.max(0, this.stompPoseTimer - dt);
      this.skidTimer = Math.max(0, this.skidTimer - dt);
      this.forcedCrouchTimer = Math.max(0, this.forcedCrouchTimer - dt);
      this.animationTime += dt;
      this.animationStateTime += dt;
      this.animationBlend = Math.min(1, this.animationBlend + dt / 0.09);
    }

    resolveAnimationState() {
      if (this.stompPoseTimer > 0) return "stomp";
      if (this.hurtPoseTimer > 0) return "hurt";
      if (this.crouching) return "crouch";
      if (this.firePoseTimer > 0) return "fire";
      if (!this.grounded) return this.vy < 20 ? "jump" : "fall";
      if (this.skidTimer > 0) return "skid";
      if (Math.abs(this.vx) > 18) return "run";
      return "idle";
    }

    updateAnimationState() {
      const nextState = this.resolveAnimationState();
      if (nextState === this.animationState) return;
      this.previousAnimationState = this.animationState;
      this.animationState = nextState;
      this.animationStateTime = 0;
      this.animationBlend = 0;
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
        if (this.grounded && Math.abs(this.vx) > 150 && Math.sign(this.vx) !== horizontalInput) {
          this.skidTimer = 0.2;
        }
        this.facing = horizontalInput;
        this.vx = moveToward(
          this.vx,
          horizontalInput * ACTOR_TUNING.maxSpeed,
          ACTOR_TUNING.acceleration * dt,
        );
      } else {
        if (this.grounded && Math.abs(this.vx) > 235) this.skidTimer = 0.14;
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
      this.updateAnimationState();
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
      this.hurtPoseTimer = 0.3;
      if (kind === "stomp") {
        this.stompPoseTimer = ACTOR_TUNING.invulnerabilityTime;
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
      this.fireCooldown = 0.3;
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
        this.decisionTimer = randomRange(0.03, 0.06);
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
          this.fireCooldown = randomRange(0.3, 0.54);
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

    get opacity() {
      return clamp(1 - (this.bounces / FIREBALL_TUNING.maxBounces) * 0.78, 0.16, 1);
    }

    registerBounce(game) {
      this.bounces += 1;
      game.emitBounce(this.x, this.y, this.opacity);
      if (this.bounces < FIREBALL_TUNING.maxBounces) return true;
      this.active = false;
      game.emitFireballDissolve(this.x, this.y);
      return false;
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
      this.vx = -this.vx * FIREBALL_TUNING.bounceRetention;
      this.vy *= FIREBALL_TUNING.bounceRetention;
      this.registerBounce(game);
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
        this.vx *= FIREBALL_TUNING.bounceRetention;
        this.vy = -FIREBALL_TUNING.bounceVelocity * Math.pow(FIREBALL_TUNING.bounceRetention, this.bounces);
        this.registerBounce(game);
      } else {
        this.y = block.y + block.height + this.radius;
        this.vx *= FIREBALL_TUNING.bounceRetention;
        this.vy = Math.abs(this.vy) * FIREBALL_TUNING.bounceRetention;
        this.registerBounce(game);
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
      this.settings = readStoredJson("mvl-beta-06-settings", DEFAULT_SETTINGS);
      this.playerAppearance = normalizeAppearance(
        readStoredJson("mvl-beta-06-appearance", PLAYER_APPEARANCE),
        PLAYER_APPEARANCE,
      );
      this.customGrid = normalizeGrid(readStoredJson("mvl-beta-06-level", { grid: LEVEL_GRID }).grid);
      this.editorTool = "F";
      this.resumeState = null;
      this.mode = "solo";
      this.activeScreen = "main";
      this.renderFps = 60;
      this.applySettings();
      this.reset();
      this.initializeInterface();
      this.openScreen("main", false);
    }

    reset() {
      this.startMatch(this.mode || "solo", this.customGrid, false);
    }

    startMatch(mode = "ai", grid = this.customGrid, hideMenu = true) {
      this.mode = mode;
      this.world = new World(normalizeGrid(grid));
      this.player = new Actor({
        id: "player",
        x: 6 * WORLD.tileSize + 3,
        facing: 1,
        appearance: { ...this.playerAppearance },
      });
      this.aiActor = null;
      this.ai = null;
      if (mode === "ai" || mode === "local") {
        this.aiActor = new Actor({
          id: mode === "ai" ? "ai" : "player2",
          x: 25 * WORLD.tileSize + 3,
          facing: -1,
          appearance: normalizeAppearance(AI_APPEARANCE, AI_APPEARANCE),
          isAI: mode === "ai",
        });
        if (mode === "ai") this.ai = new RivalAI(this.aiActor);
      }
      this.fireballs = [];
      this.particles = [];
      this.wind = this.createWind();
      this.clouds = this.createClouds();
      this.state = "playing";
      this.resultReason = "";
      this.elapsed = 0;
      this.input.clear();
      restartButton.hidden = true;
      if (menuButton) menuButton.hidden = true;
      if (hideMenu && menuLayer) menuLayer.hidden = true;
      gameStatus.textContent = mode === "local" ? "PvP local iniciado." : mode === "ai" ? "Combate contra IA iniciado." : "Arena de prueba iniciada.";
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
      this.mode = "ai";
      this.aiActor = new Actor({
        id: "ai",
        x: 25 * WORLD.tileSize + 3,
        facing: -1,
        appearance: normalizeAppearance(AI_APPEARANCE, AI_APPEARANCE),
        isAI: true,
      });
      this.ai = new RivalAI(this.aiActor);
      gameStatus.textContent = "Rival IA activado. Ambos personajes tienen 10 puntos de vida.";
      return true;
    }

    applySettings() {
      this.settings.fps = Number(this.settings.fps) === 120 ? 120 : 60;
      this.settings.touchOpacity = [0, 0.1, 0.25, 0.5].includes(Number(this.settings.touchOpacity))
        ? Number(this.settings.touchOpacity)
        : DEFAULT_SETTINGS.touchOpacity;
      this.settings.language = I18N[this.settings.language] ? this.settings.language : "es";
      this.settings.controlPreset = CONTROL_PRESETS[this.settings.controlPreset]
        ? this.settings.controlPreset
        : "classic";
      this.renderFps = this.settings.fps;
      this.audio.enabled = Boolean(this.settings.sound);
      this.audio.musicEnabled = Boolean(this.settings.music);
      this.input.setPreset(this.settings.controlPreset);
      gameShell?.style.setProperty("--touch-opacity", String(this.settings.touchOpacity));
      gameShell?.classList.toggle("touch-hidden", this.settings.touchOpacity === 0);
      this.translateInterface();
      this.updateControlLegend();
    }

    saveSettings() {
      writeStoredJson("mvl-beta-06-settings", this.settings);
      this.applySettings();
    }

    translateInterface() {
      const dictionary = I18N[this.settings.language] || I18N.es;
      if (document.documentElement) document.documentElement.lang = this.settings.language;
      document.querySelectorAll?.("[data-i18n]").forEach((element) => {
        const translation = dictionary[element.dataset.i18n];
        if (translation) element.textContent = translation;
      });
    }

    updateControlLegend() {
      const element = document.querySelector?.("#controlLegend");
      if (!element) return;
      const alternate = this.settings.controlPreset === "alternate";
      element.textContent = alternate
        ? "P1: ←/→ mover · ↓ agachar · ↑ saltar · / disparar | P2: A/D mover · S agachar · Espacio saltar · E disparar"
        : "P1: A/D mover · S agachar · Espacio saltar · E disparar | P2: ←/→ mover · ↓ agachar · ↑ saltar · Enter disparar";
    }

    openScreen(name, pauseMatch = true) {
      if (!menuLayer) return;
      if (name === "settings" && pauseMatch && this.state === "playing") {
        this.resumeState = "playing";
        this.state = "paused";
      } else if (name === "main") {
        this.state = "menu";
        this.resumeState = null;
      }
      menuLayer.hidden = false;
      this.activeScreen = name;
      menuLayer.querySelectorAll("[data-screen]").forEach((screen) => {
        screen.hidden = screen.dataset.screen !== name;
      });
      if (name === "character") this.drawCharacterPreview();
      if (name === "editor") this.buildEditorGrid();
      this.input.clear();
    }

    closeSettings() {
      if (this.resumeState === "playing") {
        this.state = "playing";
        this.resumeState = null;
        menuLayer.hidden = true;
        canvas.focus({ preventScroll: true });
      } else {
        this.openScreen("main", false);
      }
    }

    returnToMenu() {
      restartButton.hidden = true;
      if (menuButton) menuButton.hidden = true;
      this.fireballs.length = 0;
      this.openScreen("main", false);
    }

    initializeInterface() {
      document.querySelectorAll?.("[data-open-screen]").forEach((button) => {
        button.addEventListener("click", () => this.openScreen(button.dataset.openScreen, false));
      });
      document.querySelectorAll?.("[data-start-mode]").forEach((button) => {
        button.addEventListener("click", () => this.startMatch(button.dataset.startMode));
      });
      document.querySelector?.("[data-close-settings]")?.addEventListener("click", () => this.closeSettings());
      settingsButton?.addEventListener("click", () => this.openScreen("settings", true));
      fullscreenButton?.addEventListener("click", async () => {
        try {
          if (document.fullscreenElement) await document.exitFullscreen();
          else await gameShell.requestFullscreen();
        } catch { gameStatus.textContent = "El navegador no permitió pantalla completa."; }
      });
      menuButton?.addEventListener("click", () => this.returnToMenu());

      const bindSetting = (selector, key, transform = (value) => value) => {
        const element = document.querySelector?.(selector);
        if (!element) return;
        if (element.type === "checkbox") element.checked = Boolean(this.settings[key]);
        else element.value = String(this.settings[key]);
        element.addEventListener("change", () => {
          this.settings[key] = element.type === "checkbox" ? element.checked : transform(element.value);
          this.saveSettings();
        });
      };
      bindSetting("#languageSelect", "language");
      bindSetting("#fpsSelect", "fps", Number);
      bindSetting("#touchOpacitySelect", "touchOpacity", Number);
      bindSetting("#controlPresetSelect", "controlPreset");
      bindSetting("#soundToggle", "sound");
      bindSetting("#musicToggle", "music");

      document.querySelectorAll?.("[data-appearance]").forEach((input) => {
        const key = input.dataset.appearance;
        if (input.type === "checkbox") input.checked = Boolean(this.playerAppearance[key]);
        else input.value = this.playerAppearance[key] ?? input.value;
        const updateAppearance = () => {
          this.playerAppearance[key] = input.type === "checkbox" ? input.checked : input.value;
          this.playerAppearance = normalizeAppearance(this.playerAppearance, PLAYER_APPEARANCE);
          writeStoredJson("mvl-beta-06-appearance", this.playerAppearance);
          this.drawCharacterPreview();
        };
        input.addEventListener(input.type === "color" ? "input" : "change", updateAppearance);
      });

      document.querySelectorAll?.("[data-editor-tool]").forEach((button) => {
        button.addEventListener("click", () => {
          this.editorTool = button.getAttribute("data-editor-tool");
          document.querySelectorAll("[data-editor-tool]").forEach((candidate) => candidate.classList.toggle("selected", candidate === button));
        });
      });
      document.querySelector?.("#testLevelButton")?.addEventListener("click", () => this.startMatch("ai", this.customGrid));
      document.querySelector?.("#resetLevelButton")?.addEventListener("click", () => {
        this.customGrid = [...LEVEL_GRID];
        writeStoredJson("mvl-beta-06-level", { grid: this.customGrid });
        this.buildEditorGrid();
      });

      this.initializeTouchControls();
      this.applySettings();
    }

    drawCharacterPreview() {
      if (!characterPreview) return;
      const preview = characterPreview.getContext("2d");
      const seconds = performance.now() / 1000;
      const states = ["idle", "run", "skid", "jump", "fall", "crouch", "fire", "hurt", "stomp"];
      const state = states[Math.floor(seconds / 1.35) % states.length];
      const compact = state === "crouch" || state === "stomp";
      const previewActor = {
        height: compact ? ACTOR_TUNING.crouchingHeight : ACTOR_TUNING.standingHeight,
        grounded: !["jump", "fall"].includes(state),
        vy: state === "jump" ? -500 : state === "fall" ? 500 : 0,
        animationState: state,
        previousAnimationState: state,
        animationBlend: 1,
        animationTime: seconds,
      };
      preview.imageSmoothingEnabled = true;
      preview.clearRect(0, 0, characterPreview.width, characterPreview.height);
      preview.fillStyle = "#75aadb";
      preview.fillRect(0, 0, characterPreview.width, characterPreview.height);
      preview.fillStyle = "rgba(255,255,255,.22)";
      preview.fillRect(0, 276, characterPreview.width, 3);
      preview.fillStyle = "#d65b2f";
      preview.fillRect(0, 279, characterPreview.width, 81);
      preview.fillStyle = "#f3a33e";
      preview.fillRect(0, 279, characterPreview.width, 6);
      preview.save();
      preview.translate(156, 24 + (ACTOR_TUNING.standingHeight - previewActor.height) * 3.15);
      preview.scale(3.15, 3.15);
      this.drawCharacterModel(preview, previewActor, this.playerAppearance, state, seconds);
      preview.restore();
    }

    buildEditorGrid() {
      if (!levelGridElement || !document.createElement) return;
      levelGridElement.textContent = "";
      for (let row = 0; row < WORLD.rows; row += 1) {
        for (let column = 0; column < WORLD.columns; column += 1) {
          const cell = document.createElement("button");
          cell.type = "button";
          cell.className = "level-cell";
          cell.dataset.row = String(row);
          cell.dataset.column = String(column);
          cell.dataset.symbol = this.customGrid[row][column] || " ";
          cell.setAttribute("role", "gridcell");
          cell.setAttribute("aria-label", `Fila ${row + 1}, columna ${column + 1}`);
          const paint = () => this.paintEditorCell(cell, row, column);
          cell.addEventListener("pointerdown", paint);
          cell.addEventListener("pointerenter", (event) => { if (event.buttons === 1) paint(); });
          levelGridElement.append(cell);
        }
      }
    }

    paintEditorCell(cell, row, column) {
      const rows = this.customGrid.map((text) => [...text]);
      rows[row][column] = this.editorTool;
      this.customGrid = rows.map((cells) => cells.join(""));
      cell.dataset.symbol = this.editorTool;
      writeStoredJson("mvl-beta-06-level", { grid: this.customGrid });
    }

    initializeTouchControls() {
      let padPointer = null;
      let jumpDirectionHeld = false;
      const clearPad = () => {
        this.input.setVirtual("p1Left", false);
        this.input.setVirtual("p1Right", false);
        this.input.setVirtual("p1Crouch", false);
        this.input.releaseVirtual("p1Jump");
        jumpDirectionHeld = false;
        if (touchStick) touchStick.style.transform = "translate(-50%, -50%)";
      };
      const updatePad = (event) => {
        if (this.settings.touchOpacity === 0 || !touchPad) return;
        const bounds = touchPad.getBoundingClientRect();
        const dx = event.clientX - (bounds.left + bounds.width / 2);
        const dy = event.clientY - (bounds.top + bounds.height / 2);
        const threshold = bounds.width * 0.13;
        const max = bounds.width * 0.24;
        this.input.setVirtual("p1Left", dx < -threshold);
        this.input.setVirtual("p1Right", dx > threshold);
        this.input.setVirtual("p1Crouch", dy > threshold);
        const wantsJump = dy < -threshold;
        if (wantsJump && !jumpDirectionHeld) this.input.pressVirtual("p1Jump");
        if (!wantsJump && jumpDirectionHeld) this.input.releaseVirtual("p1Jump");
        jumpDirectionHeld = wantsJump;
        if (touchStick) touchStick.style.transform = `translate(calc(-50% + ${clamp(dx, -max, max)}px), calc(-50% + ${clamp(dy, -max, max)}px))`;
      };
      touchPad?.addEventListener("pointerdown", (event) => {
        if (this.settings.touchOpacity === 0) return;
        padPointer = event.pointerId;
        touchPad.setPointerCapture?.(event.pointerId);
        updatePad(event);
      });
      touchPad?.addEventListener("pointermove", (event) => { if (event.pointerId === padPointer) updatePad(event); });
      const releasePad = (event) => { if (event.pointerId === padPointer) { padPointer = null; clearPad(); } };
      touchPad?.addEventListener("pointerup", releasePad);
      touchPad?.addEventListener("pointercancel", releasePad);

      const bindTouchButton = (button, action) => {
        button?.addEventListener("pointerdown", (event) => {
          event.stopPropagation();
          if (this.settings.touchOpacity === 0) return;
          button.setPointerCapture?.(event.pointerId);
          this.input.pressVirtual(action);
        });
        const release = (event) => { event.stopPropagation(); this.input.releaseVirtual(action); };
        button?.addEventListener("pointerup", release);
        button?.addEventListener("pointercancel", release);
      };
      bindTouchButton(touchJump, "p1Jump");
      bindTouchButton(touchFire, "p1Fire");

      canvas.addEventListener("pointerdown", (event) => {
        canvas.focus({ preventScroll: true });
        if (this.state !== "playing") return;
        const bounds = canvas.getBoundingClientRect();
        if (event.clientX >= bounds.left + bounds.width / 2) this.input.pressVirtual("p1Fire");
      });
      canvas.addEventListener("pointerup", () => this.input.releaseVirtual("p1Fire"));
    }

    update(dt) {
      if (this.state === "paused") return;
      for (const cloud of this.clouds) cloud.update(dt);
      this.updateParticles(dt);
      this.audio.updateMusic(dt, this.state === "playing" || this.state === "menu");

      if (this.state !== "playing") return;
      this.elapsed += dt;

      this.player.update(
        dt,
        {
          horizontal: Number(this.input.isHeld("p1Right")) - Number(this.input.isHeld("p1Left")),
          crouch: this.input.isHeld("p1Crouch"),
          jumpPressed: this.input.consumePress("p1Jump"),
        },
        this.world,
        {
          onBlockBreak: (block) => this.onBlockDestroyed(block),
          onJump: () => this.audio.jump(),
        },
      );

      if (this.input.consumePress("p1Fire")) this.tryFire(this.player);

      if (this.aiActor?.alive) {
        const aiControls = this.mode === "ai"
          ? this.ai.decide(dt, this)
          : {
              horizontal: Number(this.input.isHeld("p2Right")) - Number(this.input.isHeld("p2Left")),
              crouch: this.input.isHeld("p2Crouch"),
              jumpPressed: this.input.consumePress("p2Jump"),
            };
        this.aiActor.update(
          dt,
          aiControls,
          this.world,
          {
            onBlockBreak: (block) => this.onBlockDestroyed(block),
            onJump: () => this.audio.jump(),
          },
        );
        if (this.mode === "ai" ? this.ai.firePressed : this.input.consumePress("p2Fire")) {
          this.tryFire(this.aiActor);
        }
      } else if (this.aiActor) {
        this.aiActor.updateTimers(dt);
      }

      const stomped = this.resolveStomps();
      if (!stomped) this.resolveActorCollision();

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
        this.endMatch("victory", this.mode === "ai" ? "RIVAL IA SIN CORAZONES" : "JUGADOR 2 SIN CORAZONES");
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
      else this.endMatch("victory", this.mode === "ai" ? "LA IA CAYÓ AL VACÍO" : "JUGADOR 2 CAYÓ AL VACÍO");
    }

    onActorDamaged(actor, amount, kind) {
      const who = actor.id === "player" ? "Jugador 1" : this.mode === "ai" ? "Rival IA" : "Jugador 2";
      gameStatus.textContent = `${who} perdió ${amount} punto${amount === 1 ? "" : "s"}. Vida: ${actor.health}.`;
      if (kind === "projectile") this.audio.actorHit();
    }

    resolveStomps() {
      if (!this.aiActor || !this.player.alive || !this.aiActor.alive) return false;
      if (this.tryStomp(this.player, this.aiActor)) return true;
      return this.tryStomp(this.aiActor, this.player);
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
      attacker.stompPoseTimer = 0.25;
      attacker.grounded = false;
      this.emitStomp(attacker.centerX, victim.y, damaged);
      this.audio.stomp();
      if (damaged) this.onActorDamaged(victim, ACTOR_TUNING.stompDamage, "stomp");
      else if (protectedByCrouch) {
        gameStatus.textContent = "Pisotón bloqueado por el agachado.";
      }
      return true;
    }

    resolveActorCollision() {
      const first = this.player;
      const second = this.aiActor;
      if (!first?.alive || !second?.alive || !rectanglesOverlap(first, second)) return false;
      const overlapX = Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x);
      const overlapY = Math.min(first.bottom, second.bottom) - Math.max(first.y, second.y);
      if (overlapX <= 0 || overlapY <= 0) return false;

      if (overlapX <= overlapY) {
        const direction = first.centerX <= second.centerX ? -1 : 1;
        const separation = overlapX / 2 + 0.02;
        first.x = clamp(first.x + direction * separation, 0, WORLD.width - first.width);
        second.x = clamp(second.x - direction * separation, 0, WORLD.width - second.width);
        const combined = (first.vx + second.vx) * 0.2;
        first.vx = combined + direction * 35;
        second.vx = combined - direction * 35;
      } else {
        const upper = first.centerY < second.centerY ? first : second;
        const lower = upper === first ? second : first;
        upper.y -= overlapY + 0.02;
        if (upper.vy > lower.vy) upper.vy = Math.min(0, lower.vy);
        upper.grounded = true;
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
          const clashX = (first.x + second.x) / 2;
          const clashY = (first.y + second.y) / 2;
          this.emitFireballClash(clashX, clashY);
          this.applyClashImpulse(clashX, clashY);
          this.audio.fireballClash();
          break;
        }
      }
    }

    applyClashImpulse(x, y) {
      const radius = 190;
      for (const actor of [this.player, this.aiActor].filter(Boolean)) {
        if (!actor.alive) continue;
        const dx = actor.centerX - x;
        const dy = actor.centerY - y;
        const distance = Math.hypot(dx, dy);
        if (distance >= radius) continue;
        const safeDistance = Math.max(distance, 12);
        const falloff = 1 - distance / radius;
        const strength = 470 * falloff;
        actor.vx += (dx / safeDistance) * strength;
        actor.vy += (dy / safeDistance) * strength - 170 * falloff;
        actor.grounded = false;
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
      const opacityScale = fireball.opacity;
      this.addParticle({
        x: fireball.x - direction * randomRange(8, 13),
        y: fireball.y + randomRange(-5, 5),
        vx: -fireball.vx * randomRange(0.035, 0.08) + randomRange(-18, 18),
        vy: randomRange(-24, 24),
        color: Math.random() < 0.45 ? "#ffc83d" : "#ff5a24",
        size: randomRange(3, 6) * opacityScale,
        lifetime: randomRange(0.13, 0.24) * (0.55 + opacityScale * 0.45),
      });
    }

    emitBounce(x, y, alpha = 1) {
      for (let i = 0; i < 3; i += 1) {
        this.addParticle({
          x,
          y,
          vx: randomRange(-55, 55),
          vy: randomRange(-90, -25),
          color: "#ffc83d",
          size: 3 * alpha,
          lifetime: 0.1 + 0.08 * alpha,
          gravity: 380,
        });
      }
    }

    emitFireballDissolve(x, y) {
      for (let i = 0; i < 12; i += 1) {
        const angle = (Math.PI * 2 * i) / 12;
        this.addParticle({
          x, y,
          vx: Math.cos(angle) * randomRange(45, 150),
          vy: Math.sin(angle) * randomRange(45, 150),
          color: i % 2 ? "#ff5a24" : "#ffc83d",
          size: randomRange(2, 5),
          lifetime: randomRange(0.14, 0.3),
          gravity: 120,
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
      if (menuButton) menuButton.hidden = false;
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
              animationState: actor.animationState,
              health: actor.health,
              maxHealth: actor.maxHealth,
              invulnerability: Number(actor.invulnerability.toFixed(2)),
              forcedCrouchTimer: Number(actor.forcedCrouchTimer.toFixed(2)),
            }
          : null;
      return {
        state: this.state,
        mode: this.mode,
        renderFps: this.renderFps,
        touchOpacity: this.settings.touchOpacity,
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
          player2: this.fireballs.filter((fireball) => fireball.ownerId === "player2").length,
        },
        fireballs: this.fireballs.map((fireball) => ({
          ownerId: fireball.ownerId,
          x: Number(fireball.x.toFixed(2)),
          y: Number(fireball.y.toFixed(2)),
          vx: Number(fireball.vx.toFixed(2)),
          vy: Number(fireball.vy.toFixed(2)),
          bounces: fireball.bounces,
          opacity: Number(fireball.opacity.toFixed(2)),
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
      if (this.state === "victory" || this.state === "defeat") this.drawResult();
      if (this.activeScreen === "character" && menuLayer && !menuLayer.hidden) {
        this.drawCharacterPreview();
      }
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
      if (!actor || (actor.invulnerability > 0 && Math.floor(actor.invulnerability * 22) % 2 === 0)) return;
      ctx.save();
      ctx.translate(Math.round(actor.centerX), Math.round(actor.y));
      ctx.scale(actor.facing, 1);
      this.drawCharacterModel(ctx, actor, actor.appearance);
      ctx.restore();
    }

    characterPose(state, time, actor) {
      const point = (x, y) => ({ x, y });
      const breathe = Math.sin(time * 2.7) * 0.65;
      let pose = {
        hip: point(0, 53 + breathe), neck: point(0, 29 + breathe), head: point(1, 14 + breathe),
        rearShoulder: point(-9, 32 + breathe), frontShoulder: point(9, 32 + breathe),
        rearElbow: point(-12, 44 + breathe), rearHand: point(-10, 57 + breathe),
        frontElbow: point(12, 44 + breathe), frontHand: point(10, 57 + breathe),
        rearKnee: point(-6, 66), rearFoot: point(-7, 80),
        frontKnee: point(7, 66), frontFoot: point(8, 80),
        lean: 0,
      };

      if (state === "fire") {
        const base = actor?.grounded === false ? (actor.vy < 20 ? "jump" : "fall") : "idle";
        pose = this.characterPose(base, time, actor);
        pose.lean += 0.035;
        pose.frontElbow = point(20, pose.frontShoulder.y + 1);
        pose.frontHand = point(31, pose.frontShoulder.y + 1);
        pose.rearElbow = point(-13, pose.rearShoulder.y + 8);
        pose.rearHand = point(-8, pose.rearShoulder.y + 19);
        return pose;
      }

      if (state === "run") {
        const stride = Math.sin(time * 13.5);
        const lift = Math.cos(time * 13.5);
        const bob = Math.abs(lift) * 1.8;
        pose.hip = point(stride * 0.8, 52 - bob);
        pose.neck = point(1.5, 28 - bob);
        pose.head = point(2.5, 13 - bob);
        pose.rearShoulder = point(-8, 31 - bob);
        pose.frontShoulder = point(10, 31 - bob);
        pose.rearElbow = point(-10 + stride * 7, 44 - bob);
        pose.rearHand = point(-7 + stride * 10, 57 - bob);
        pose.frontElbow = point(12 - stride * 7, 43 - bob);
        pose.frontHand = point(9 - stride * 10, 56 - bob);
        pose.rearKnee = point(-6 - stride * 7, 65 - Math.max(0, -lift) * 3);
        pose.rearFoot = point(-8 - stride * 10, 80 - Math.max(0, -lift) * 7);
        pose.frontKnee = point(7 + stride * 7, 65 - Math.max(0, lift) * 3);
        pose.frontFoot = point(9 + stride * 10, 80 - Math.max(0, lift) * 7);
        pose.lean = 0.045;
      } else if (state === "skid") {
        pose.hip = point(-1, 53);
        pose.neck = point(-3, 29);
        pose.head = point(-5, 14);
        pose.rearShoulder = point(-12, 31);
        pose.frontShoulder = point(7, 33);
        pose.rearElbow = point(-18, 39);
        pose.rearHand = point(-20, 49);
        pose.frontElbow = point(4, 45);
        pose.frontHand = point(0, 55);
        pose.rearKnee = point(-10, 66);
        pose.rearFoot = point(-15, 80);
        pose.frontKnee = point(8, 66);
        pose.frontFoot = point(18, 80);
        pose.lean = -0.12;
      } else if (state === "jump") {
        pose.hip = point(0, 51);
        pose.neck = point(1, 28);
        pose.head = point(2, 13);
        pose.rearShoulder = point(-8, 31);
        pose.frontShoulder = point(10, 31);
        pose.rearElbow = point(-16, 24);
        pose.rearHand = point(-12, 15);
        pose.frontElbow = point(17, 24);
        pose.frontHand = point(14, 14);
        pose.rearKnee = point(-10, 59);
        pose.rearFoot = point(-13, 71);
        pose.frontKnee = point(11, 57);
        pose.frontFoot = point(16, 68);
        pose.lean = 0.035;
      } else if (state === "fall") {
        pose.hip = point(0, 51);
        pose.neck = point(-1, 29);
        pose.head = point(0, 14);
        pose.rearShoulder = point(-9, 32);
        pose.frontShoulder = point(9, 32);
        pose.rearElbow = point(-19, 35);
        pose.rearHand = point(-22, 44);
        pose.frontElbow = point(19, 35);
        pose.frontHand = point(23, 44);
        pose.rearKnee = point(-7, 65);
        pose.rearFoot = point(-10, 77);
        pose.frontKnee = point(8, 65);
        pose.frontFoot = point(12, 78);
      } else if (state === "hurt") {
        const shake = Math.sin(time * 42) * 1.4;
        pose.hip = point(-2 + shake, 53);
        pose.neck = point(-5 + shake, 29);
        pose.head = point(-8 + shake, 14);
        pose.rearShoulder = point(-13 + shake, 29);
        pose.frontShoulder = point(5 + shake, 34);
        pose.rearElbow = point(-20 + shake, 22);
        pose.rearHand = point(-24 + shake, 15);
        pose.frontElbow = point(13 + shake, 26);
        pose.frontHand = point(17 + shake, 17);
        pose.rearKnee = point(-9, 65);
        pose.rearFoot = point(-14, 79);
        pose.frontKnee = point(6, 66);
        pose.frontFoot = point(11, 78);
        pose.lean = -0.15;
      } else if (state === "crouch" || state === "stomp") {
        const compressed = state === "stomp";
        const shake = compressed ? Math.sin(time * 38) * 1.2 : 0;
        pose = {
          hip: point(-1 + shake, 31), neck: point(0 + shake, 17), head: point(2 + shake, 8),
          rearShoulder: point(-9 + shake, 20), frontShoulder: point(9 + shake, 20),
          rearElbow: point(-14 + shake, compressed ? 15 : 27), rearHand: point(-17 + shake, compressed ? 20 : 34),
          frontElbow: point(15 + shake, compressed ? 15 : 27), frontHand: point(19 + shake, compressed ? 20 : 34),
          rearKnee: point(-9, 34), rearFoot: point(-13, 40),
          frontKnee: point(8, 34), frontFoot: point(14, 40),
          lean: compressed ? -0.08 : 0.06,
        };
      }
      return pose;
    }

    blendCharacterPoses(from, to, ratio) {
      const blended = { lean: mixNumber(from.lean, to.lean, ratio) };
      for (const key of Object.keys(to)) {
        if (key === "lean") continue;
        blended[key] = {
          x: mixNumber(from[key].x, to[key].x, ratio),
          y: mixNumber(from[key].y, to[key].y, ratio),
        };
      }
      return blended;
    }

    drawCharacterModel(context, actor, rawAppearance, stateOverride = null, timeOverride = null) {
      const appearance = normalizeAppearance(rawAppearance, PLAYER_APPEARANCE);
      const state = stateOverride || actor.animationState || actor.resolveAnimationState?.() || "idle";
      const time = timeOverride ?? actor.animationTime ?? 0;
      let pose = this.characterPose(state, time, actor);
      const compact = (value) => value === "crouch" || value === "stomp";
      if (
        !stateOverride && actor.animationBlend < 1 &&
        compact(actor.previousAnimationState) === compact(state)
      ) {
        const previous = this.characterPose(actor.previousAnimationState, time, actor);
        const eased = 1 - Math.pow(1 - actor.animationBlend, 3);
        pose = this.blendCharacterPoses(previous, pose, eased);
      }

      context.save();
      context.rotate(pose.lean);
      context.lineCap = "round";
      context.lineJoin = "round";

      this.drawHairBack(context, pose, appearance);
      this.drawLeg(context, pose.hip, pose.rearKnee, pose.rearFoot, appearance, false);
      this.drawArm(context, pose.rearShoulder, pose.rearElbow, pose.rearHand, appearance, false);
      this.drawTorso(context, pose, appearance);
      this.drawLeg(context, pose.hip, pose.frontKnee, pose.frontFoot, appearance, true);
      this.drawArm(context, pose.frontShoulder, pose.frontElbow, pose.frontHand, appearance, true);
      this.drawHead(context, pose, appearance, state, time);
      this.drawCharacterAccessories(context, pose, appearance);
      context.restore();
    }

    drawSegment(context, from, to, width, color, outline = "#111827") {
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.strokeStyle = outline;
      context.lineWidth = width + 3;
      context.stroke();
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.lineTo(to.x, to.y);
      context.strokeStyle = color;
      context.lineWidth = width;
      context.stroke();
    }

    drawPolygon(context, points, fill, outline = "#111827", width = 2) {
      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      for (const point of points.slice(1)) context.lineTo(point.x, point.y);
      context.closePath();
      context.fillStyle = fill;
      context.fill();
      if (outline && width > 0) {
        context.strokeStyle = outline;
        context.lineWidth = width;
        context.stroke();
      }
    }

    drawLeg(context, hip, knee, foot, appearance, front) {
      const side = front ? 2.4 : -2.4;
      const upperStart = { x: hip.x + side, y: hip.y - 1 };
      const skinShadow = shadeColor(appearance.skin, -22);
      if (appearance.bottomStyle === "longPants") {
        this.drawSegment(context, upperStart, knee, 8.5, appearance.pants);
        this.drawSegment(context, knee, { x: foot.x, y: foot.y - 4 }, 7.5, shadeColor(appearance.pants, front ? 10 : -18));
      } else if (appearance.bottomStyle === "shorts") {
        const thigh = { x: mixNumber(upperStart.x, knee.x, 0.58), y: mixNumber(upperStart.y, knee.y, 0.58) };
        this.drawSegment(context, upperStart, thigh, 9.5, appearance.pants);
        this.drawSegment(context, thigh, knee, 6.5, front ? appearance.skin : skinShadow);
        this.drawSegment(context, knee, { x: foot.x, y: foot.y - 3 }, 6, front ? appearance.skin : skinShadow);
      } else {
        this.drawSegment(context, upperStart, knee, 7, front ? appearance.skin : skinShadow);
        this.drawSegment(context, knee, { x: foot.x, y: foot.y - 3 }, 6, front ? appearance.skin : skinShadow);
      }
      this.drawFoot(context, foot, appearance, front);
    }

    drawFoot(context, foot, appearance, front) {
      const color = appearance.footwearStyle === "barefoot" ? appearance.skin : appearance.shoes;
      const width = appearance.footwearStyle === "shoes" ? 14 : 13;
      const height = appearance.footwearStyle === "barefoot" ? 5 : 7;
      const points = [
        { x: foot.x - 5, y: foot.y - height },
        { x: foot.x + width - 6, y: foot.y - height + (front ? 0 : 1) },
        { x: foot.x + width - 3, y: foot.y - 2 },
        { x: foot.x + width - 5, y: foot.y },
        { x: foot.x - 6, y: foot.y },
      ];
      this.drawPolygon(context, points, color);
      if (appearance.footwearStyle === "sneakers") {
        context.strokeStyle = shadeColor(appearance.shoes, 60);
        context.lineWidth = 1.4;
        context.beginPath();
        context.moveTo(foot.x - 1, foot.y - 5);
        context.lineTo(foot.x + 6, foot.y - 4);
        context.stroke();
        context.fillStyle = "#f4f7fb";
        context.fillRect(foot.x - 5, foot.y - 2, width + 2, 2);
      } else if (appearance.footwearStyle === "shoes") {
        context.fillStyle = shadeColor(appearance.shoes, 35);
        context.fillRect(foot.x + 2, foot.y - 6, 5, 2);
      } else {
        context.fillStyle = shadeColor(appearance.skin, 28);
        context.fillRect(foot.x + 5, foot.y - 2, 4, 1.5);
      }
    }

    drawArm(context, shoulder, elbow, hand, appearance, front) {
      const skin = front ? appearance.skin : shadeColor(appearance.skin, -20);
      if (appearance.topStyle === "longSleeve") {
        this.drawSegment(context, shoulder, elbow, 7.5, appearance.shirt);
        this.drawSegment(context, elbow, { x: hand.x, y: hand.y - 1 }, 6.5, shadeColor(appearance.shirt, front ? 12 : -18));
      } else {
        this.drawSegment(context, shoulder, elbow, 7, skin);
        this.drawSegment(context, elbow, { x: hand.x, y: hand.y - 1 }, 6, skin);
        if (appearance.topStyle === "shortSleeve") {
          const sleeveEnd = {
            x: mixNumber(shoulder.x, elbow.x, 0.43),
            y: mixNumber(shoulder.y, elbow.y, 0.43),
          };
          this.drawSegment(context, shoulder, sleeveEnd, 9, appearance.shirt);
        }
      }
      context.beginPath();
      context.ellipse(hand.x, hand.y, 4.3, 4.8, 0, 0, Math.PI * 2);
      context.fillStyle = skin;
      context.fill();
      context.strokeStyle = "#111827";
      context.lineWidth = 1.7;
      context.stroke();
    }

    drawTorso(context, pose, appearance) {
      const female = appearance.sex === "female";
      const shoulderWidth = female ? 10.5 : 12.5;
      const waistWidth = female ? 7.5 : 9.5;
      const torso = [
        { x: pose.neck.x - 5, y: pose.neck.y - 1 },
        { x: pose.frontShoulder.x + shoulderWidth - 7, y: pose.frontShoulder.y },
        { x: pose.hip.x + waistWidth, y: pose.hip.y + 2 },
        { x: pose.hip.x - waistWidth, y: pose.hip.y + 2 },
        { x: pose.rearShoulder.x - shoulderWidth + 7, y: pose.rearShoulder.y },
      ];
      const torsoColor = appearance.topStyle === "noTop" ? appearance.skin : appearance.shirt;
      this.drawPolygon(context, torso, torsoColor);
      context.fillStyle = shadeColor(torsoColor, 28);
      context.fillRect(pose.neck.x - 4, pose.neck.y + 2, 7, 2);

      if (female && appearance.topStyle === "noTop") {
        context.fillStyle = "#111318";
        context.fillRect(pose.hip.x - 9, pose.neck.y + 8, 18, 7);
        context.fillStyle = "#333842";
        context.fillRect(pose.hip.x - 6, pose.neck.y + 9, 11, 2);
      }

      if (appearance.bottomStyle === "noPants") {
        if (female) {
          this.drawPolygon(context, [
            { x: pose.hip.x - 10, y: pose.hip.y - 5 }, { x: pose.hip.x + 10, y: pose.hip.y - 5 },
            { x: pose.hip.x + 5, y: pose.hip.y + 5 }, { x: pose.hip.x - 5, y: pose.hip.y + 5 },
          ], "#101318");
        } else {
          context.fillStyle = "#f7f7f2";
          context.fillRect(pose.hip.x - 10, pose.hip.y - 5, 20, 11);
          context.strokeStyle = "#111827";
          context.lineWidth = 2;
          context.strokeRect(pose.hip.x - 10, pose.hip.y - 5, 20, 11);
          context.fillStyle = "#e9424d";
          context.fillRect(pose.hip.x - 6, pose.hip.y - 1, 2, 2);
          context.fillRect(pose.hip.x + 4, pose.hip.y + 1, 2, 2);
          context.fillRect(pose.hip.x - 5, pose.hip.y + 1, 1, 1);
          context.fillRect(pose.hip.x + 5, pose.hip.y + 3, 1, 1);
        }
      } else {
        context.fillStyle = shadeColor(appearance.pants, -18);
        context.fillRect(pose.hip.x - 10, pose.hip.y - 4, 20, 7);
      }

      if (appearance.vest) {
        const vestColor = appearance.vestColor;
        this.drawPolygon(context, [torso[0], torso[1], torso[2], { x: pose.hip.x + 2, y: pose.hip.y - 2 }, { x: pose.neck.x + 2, y: pose.neck.y + 4 }], vestColor);
        this.drawPolygon(context, [torso[0], { x: pose.neck.x - 2, y: pose.neck.y + 4 }, { x: pose.hip.x - 2, y: pose.hip.y - 2 }, torso[3], torso[4]], shadeColor(vestColor, -13));
      }

      if (appearance.belt) {
        context.strokeStyle = "#111827";
        context.lineWidth = 5;
        context.beginPath();
        context.moveTo(pose.hip.x - 10, pose.hip.y - 1);
        context.lineTo(pose.hip.x + 10, pose.hip.y - 1);
        context.stroke();
        context.strokeStyle = appearance.beltColor;
        context.lineWidth = 3;
        context.stroke();
        context.fillStyle = shadeColor(appearance.beltColor, 55);
        context.fillRect(pose.hip.x - 2, pose.hip.y - 3, 5, 5);
      }
    }

    drawHairBack(context, pose, appearance) {
      if (appearance.hood) {
        context.beginPath();
        context.ellipse(pose.head.x - 1, pose.head.y + 1, 14, 16, 0, 0, Math.PI * 2);
        context.fillStyle = appearance.hoodColor;
        context.fill();
        context.strokeStyle = "#111827";
        context.lineWidth = 2;
        context.stroke();
      }
      if (appearance.hairStyle !== "long") return;
      this.drawPolygon(context, [
        { x: pose.head.x - 11, y: pose.head.y - 7 }, { x: pose.head.x + 8, y: pose.head.y - 6 },
        { x: pose.head.x + 10, y: pose.head.y + 20 }, { x: pose.neck.x + 8, y: pose.neck.y + 12 },
        { x: pose.neck.x - 10, y: pose.neck.y + 13 }, { x: pose.head.x - 13, y: pose.head.y + 4 },
      ], shadeColor(appearance.hair, -16));
    }

    drawHead(context, pose, appearance, state, time) {
      const female = appearance.sex === "female";
      context.beginPath();
      context.ellipse(pose.head.x, pose.head.y, female ? 9.5 : 10.5, 11.5, 0, 0, Math.PI * 2);
      context.fillStyle = appearance.skin;
      context.fill();
      context.strokeStyle = "#111827";
      context.lineWidth = 2;
      context.stroke();
      context.fillStyle = shadeColor(appearance.skin, 32);
      context.fillRect(pose.head.x + 3, pose.head.y - 6, 4, 2);

      if (appearance.hairStyle === "short") {
        this.drawPolygon(context, [
          { x: pose.head.x - 10, y: pose.head.y - 4 }, { x: pose.head.x - 7, y: pose.head.y - 11 },
          { x: pose.head.x - 2, y: pose.head.y - 9 }, { x: pose.head.x + 1, y: pose.head.y - 13 },
          { x: pose.head.x + 5, y: pose.head.y - 9 }, { x: pose.head.x + 10, y: pose.head.y - 7 },
          { x: pose.head.x + 8, y: pose.head.y - 2 }, { x: pose.head.x - 9, y: pose.head.y + 1 },
        ], appearance.hair);
      } else if (appearance.hairStyle === "long") {
        this.drawPolygon(context, [
          { x: pose.head.x - 10, y: pose.head.y - 4 }, { x: pose.head.x - 7, y: pose.head.y - 11 },
          { x: pose.head.x + 1, y: pose.head.y - 12 }, { x: pose.head.x + 10, y: pose.head.y - 6 },
          { x: pose.head.x + 8, y: pose.head.y - 1 }, { x: pose.head.x - 9, y: pose.head.y + 1 },
        ], appearance.hair);
        context.fillStyle = appearance.hair;
        context.fillRect(pose.head.x - 11, pose.head.y - 2, 4, 13);
      }

      const blink = state === "hurt" || Math.sin(time * 2.1) > 0.985;
      context.fillStyle = "#101827";
      context.fillRect(pose.head.x + 5, pose.head.y - (blink ? 1 : 3), 3.2, blink ? 1.5 : 3.2);
      context.fillRect(pose.head.x + 8, pose.head.y + 4, 3.5, 1.5);
      context.fillStyle = shadeColor(appearance.skin, -18);
      context.fillRect(pose.head.x + 9, pose.head.y, 4, 3);
    }

    drawCharacterAccessories(context, pose, appearance) {
      if (appearance.wristbands) {
        for (const hand of [pose.rearHand, pose.frontHand]) {
          context.fillStyle = appearance.wristbandsColor;
          context.fillRect(hand.x - 4, hand.y - 6, 8, 3);
        }
      }
      if (appearance.hood) {
        context.strokeStyle = shadeColor(appearance.hoodColor, 30);
        context.lineWidth = 3;
        context.beginPath();
        context.arc(pose.head.x, pose.head.y, 12.5, Math.PI * 0.74, Math.PI * 1.88);
        context.stroke();
      }
      if (appearance.headband) {
        context.strokeStyle = "#111827";
        context.lineWidth = 5;
        context.beginPath();
        context.moveTo(pose.head.x - 10, pose.head.y - 4);
        context.lineTo(pose.head.x + 10, pose.head.y - 4);
        context.stroke();
        context.strokeStyle = appearance.headbandColor;
        context.lineWidth = 3;
        context.stroke();
        context.fillStyle = appearance.headbandColor;
        context.fillRect(pose.head.x - 15, pose.head.y - 3, 6, 3);
      }
      if (appearance.darkGlasses) {
        context.fillStyle = appearance.darkGlassesColor;
        context.fillRect(pose.head.x + 1, pose.head.y - 4, 7, 5);
        context.fillRect(pose.head.x + 8, pose.head.y - 3, 5, 4);
        context.fillRect(pose.head.x - 2, pose.head.y - 3, 4, 2);
        context.fillStyle = shadeColor(appearance.darkGlassesColor, 75);
        context.fillRect(pose.head.x + 3, pose.head.y - 3, 2, 1);
      }
      if (appearance.faceMask) {
        this.drawPolygon(context, [
          { x: pose.head.x + 1, y: pose.head.y + 1 }, { x: pose.head.x + 12, y: pose.head.y },
          { x: pose.head.x + 9, y: pose.head.y + 8 }, { x: pose.head.x + 1, y: pose.head.y + 7 },
        ], appearance.faceMaskColor, "#111827", 1.5);
        context.strokeStyle = shadeColor(appearance.faceMaskColor, 45);
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(pose.head.x + 3, pose.head.y + 4);
        context.lineTo(pose.head.x + 9, pose.head.y + 4);
        context.stroke();
      }
    }

    drawFireball(fireball) {
      ctx.save();
      ctx.globalAlpha = fireball.opacity;
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
        const help = this.mode === "local"
          ? "P1 A/D · S · ESPACIO · E  |  P2 ←/→ · ↓ · ↑ · ENTER"
          : "A/D MOVER · S AGACHAR · ESPACIO SALTAR · E DISPARAR";
        ctx.fillText(help, WORLD.width / 2, 39);
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
  let previousRenderTime = -Infinity;

  const frame = (time) => {
    const delta = Math.min((time - previousTime) / 1000, WORLD.maxFrameDelta);
    previousTime = time;
    accumulator += delta;

    while (accumulator >= WORLD.fixedStep) {
      game.update(WORLD.fixedStep);
      accumulator -= WORLD.fixedStep;
    }

    const renderInterval = 1000 / game.renderFps;
    if (time - previousRenderTime >= renderInterval - 0.5) {
      game.render();
      previousRenderTime = time;
    }
    requestAnimationFrame(frame);
  };

  document.addEventListener("visibilitychange", () => {
    previousTime = performance.now();
    accumulator = 0;
    if (document.hidden) game.input.clear();
  });

  restartButton.addEventListener("click", () => game.reset());

  window.__MVL_DEBUG__ = Object.freeze({
    snapshot: () => game.snapshot(),
    reset: () => game.reset(),
    spawnAI: () => game.spawnAI(),
    startLocal: () => { game.startMatch("local"); return game.snapshot(); },
    startAI: () => { game.startMatch("ai"); return game.snapshot(); },
    damagePlayer: (amount = 1) => game.player.takeDamage(amount, 1, "projectile"),
    visualHeartHalf,
    groundedShoeBottoms: (legOffsets = [0, 0]) =>
      groundedShoeYs(legOffsets).map((shoeY) => shoeY + 8),
    appearanceCatalog: () => ({
      ...Object.fromEntries(Object.entries(APPEARANCE_OPTIONS).map(([key, values]) => [key, [...values]])),
      accessories: [...ACCESSORY_KEYS],
    }),
    normalizeAppearance: (appearance) => normalizeAppearance(appearance, PLAYER_APPEARANCE),
    renderAppearanceMatrix: () => {
      const original = game.player.appearance;
      let rendered = 0;
      for (const sex of APPEARANCE_OPTIONS.sex) {
        for (const hairStyle of APPEARANCE_OPTIONS.hairStyle) {
          for (const topStyle of APPEARANCE_OPTIONS.topStyle) {
            for (const bottomStyle of APPEARANCE_OPTIONS.bottomStyle) {
              for (const footwearStyle of APPEARANCE_OPTIONS.footwearStyle) {
                game.player.appearance = normalizeAppearance({
                  ...PLAYER_APPEARANCE,
                  sex, hairStyle, topStyle, bottomStyle, footwearStyle,
                  ...Object.fromEntries(ACCESSORY_KEYS.map((key) => [key, true])),
                });
                game.drawActor(game.player);
                rendered += 1;
              }
            }
          }
        }
      }
      game.player.appearance = original;
      return rendered;
    },
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
      game.player.x = 590;
      game.player.y = 330;
      game.aiActor.x = 660;
      game.aiActor.y = 330;
      game.player.vx = 0;
      game.aiActor.vx = 0;
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
    forceSideBounce: () => {
      const block = game.world.blockAt(4, 11);
      const fireball = new Fireball(game.player);
      fireball.x = block.x - fireball.radius - 1;
      fireball.y = block.y + block.height / 2;
      fireball.vx = 650;
      fireball.vy = 40;
      game.fireballs = [fireball];
      fireball.moveHorizontal(0.01, game);
      return game.snapshot();
    },
    exhaustBounceBudget: () => {
      const fireball = new Fireball(game.player);
      fireball.x = 640;
      fireball.y = 300;
      game.fireballs = [fireball];
      for (let count = 0; count < FIREBALL_TUNING.maxBounces; count += 1) {
        if (!fireball.registerBounce(game)) break;
        fireball.vx *= FIREBALL_TUNING.bounceRetention;
      }
      game.fireballs = game.fireballs.filter((candidate) => candidate.active);
      return game.snapshot();
    },
    resolveActorOverlap: () => {
      game.startMatch("local");
      game.player.x = 600;
      game.aiActor.x = 615;
      game.player.y = game.aiActor.y;
      game.resolveActorCollision();
      return {
        overlap: rectanglesOverlap(game.player, game.aiActor),
        snapshot: game.snapshot(),
      };
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
