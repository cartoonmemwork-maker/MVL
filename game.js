(() => {
  "use strict";

  const VERSION = "BETA 1.02";
  const WORLD = Object.freeze({
    width: 1280,
    height: 720,
    columns: 32,
    rows: 18,
    tile: 40,
    fixedStep: 1 / 60,
    maxFrameDelta: 0.08,
    maxCatchUpSteps: 5,
  });
  const CAMERA_LIMITS = Object.freeze({ minZoom: 1, maxZoom: 2.5, soloZoom: 2 });
  const ACTOR = Object.freeze({
    width: 34,
    standingHeight: 80,
    crouchingHeight: 40,
    visualHeight: 100,
    spriteFrameSize: 140,
    maxHealth: 10,
    acceleration: 2200,
    deceleration: 2800,
    walkSpeed: 220,
    crouchSpeed: 78,
    runSpeed: 350,
    gravity: 1900,
    fastFallGravity: 3400,
    fastFallEntrySpeed: 160,
    jumpVelocity: -900,
    maxFallSpeed: 1100,
    invulnerability: 0.78,
    stompDamage: 3,
    stompBounce: -780,
    defenseTime: 8,
  });
  const FIREBALL = Object.freeze({
    radius: 10,
    speed: 620,
    lift: -125,
    gravity: 1400,
    retention: 0.86,
    maxBounces: 8,
    maxActive: 2,
    maxLife: 6,
    clashRadius: 180,
  });
  const INPUT_ACTIONS = Object.freeze([
    "left", "right", "up", "down", "melee", "ranged", "guard", "run",
  ]);
  const INPUT_LABELS = Object.freeze({
    left: "IZQUIERDA",
    right: "DERECHA",
    up: "ARRIBA / SALTAR",
    down: "ABAJO / AGACHARSE",
    melee: "ATAQUE CORTO",
    ranged: "ATAQUE LARGO",
    guard: "COBERTURA",
    run: "CORRER",
  });
  const DEFAULT_BINDINGS = Object.freeze({
    left: "KeyA",
    right: "KeyD",
    up: "KeyW",
    down: "KeyS",
    melee: "KeyF",
    ranged: "KeyE",
    guard: "KeyQ",
    run: "ShiftLeft",
  });
  const KEY_LABELS = Object.freeze({
    KeyA: "A", KeyD: "D", KeyW: "W", KeyS: "S", KeyF: "F", KeyE: "E",
    KeyQ: "Q", ShiftLeft: "SHIFT IZQ.", ShiftRight: "SHIFT DER.", Space: "ESPACIO",
    ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓",
  });
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
  const TILE_RULES = Object.freeze({
    F: Object.freeze({ type: "floatingBrick", maxHp: 3 }),
    G: Object.freeze({ type: "groundBrick", maxHp: 6 }),
  });
  const SPRITE_LAYOUTS = Object.freeze({
    locomotion: Object.freeze({ columns: 6, rows: 3 }),
    actions: Object.freeze({ columns: 4, rows: 2, referenceFrames: [0, 1, 4, 5, 6] }),
  });
  const ANIMATIONS = Object.freeze({
    idle: Object.freeze({ sheet: "locomotion", row: 0, frames: 6, fps: 1.7, height: 100 }),
    walk: Object.freeze({ sheet: "locomotion", row: 1, frames: 6, fps: 9, height: 100 }),
    run: Object.freeze({ sheet: "locomotion", row: 2, frames: 6, fps: 13, height: 100 }),
    jump: Object.freeze({ sheet: "actions", row: 0, column: 0, height: 100 }),
    fall: Object.freeze({ sheet: "actions", row: 0, column: 1, height: 100 }),
    crouch: Object.freeze({ sheet: "actions", row: 0, column: 2, height: 100 }),
    fastFall: Object.freeze({ sheet: "actions", row: 0, column: 3, height: 100 }),
    fire: Object.freeze({ sheet: "actions", row: 1, column: 0, height: 100 }),
    airFire: Object.freeze({ sheet: "actions", row: 1, column: 1, height: 100 }),
    hurt: Object.freeze({ sheet: "actions", row: 1, column: 2, height: 100 }),
    stomp: Object.freeze({ sheet: "actions", row: 1, column: 3, height: 100 }),
  });
  const CHARACTER_PALETTES = Object.freeze({
    sol: Object.freeze({ core: "#e9fbff", mid: "#58ddff", edge: "#176fff", fade: "rgba(23,111,255,0)", particle: "#77e5ff" }),
    visitor: Object.freeze({ core: "#fff7df", mid: "#ffb45e", edge: "#ff5c45", fade: "rgba(255,92,69,0)", particle: "#ffc078" }),
  });

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d", { alpha: false });
  const gameShell = document.querySelector("#gameShell");
  const pauseLayer = document.querySelector("#pauseLayer");
  const continueButton = document.querySelector("#continueButton");
  const restartButton = document.querySelector("#restartButton");
  const loadingMessage = document.querySelector("#loadingMessage");
  const toastElement = document.querySelector("#toast");
  const gameStatus = document.querySelector("#gameStatus");
  const controlList = document.querySelector("#controlList");
  const gamepadStatus = document.querySelector("#gamepadStatus");
  const characterPreview = document.querySelector("#characterPreview");

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (from, to, ratio) => from + (to - from) * ratio;
  const moveToward = (value, target, amount) => {
    if (value < target) return Math.min(target, value + amount);
    if (value > target) return Math.max(target, value - amount);
    return target;
  };
  const overlap = (a, b) =>
    a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y;
  const createRng = (initialSeed) => {
    let seed = initialSeed >>> 0;
    return () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return (seed >>> 0) / 4294967296;
    };
  };

  const readBindings = () => {
    try {
      const stored = JSON.parse(window.localStorage.getItem("error-101-beta-1-bindings") || "null");
      if (!stored) return { ...DEFAULT_BINDINGS };
      const result = { ...DEFAULT_BINDINGS };
      for (const action of INPUT_ACTIONS) {
        if (typeof stored[action] === "string") result[action] = stored[action];
      }
      return result;
    } catch {
      return { ...DEFAULT_BINDINGS };
    }
  };

  let bindings = readBindings();
  const keyboardHeld = Object.fromEntries(INPUT_ACTIONS.map((action) => [action, false]));
  const touchHeld = Object.fromEntries(INPUT_ACTIONS.map((action) => [action, false]));
  const gamepadHeld = Object.fromEntries(INPUT_ACTIONS.map((action) => [action, false]));
  const previousHeld = Object.fromEntries(INPUT_ACTIONS.map((action) => [action, false]));
  const queuedPresses = new Set();
  let listeningAction = null;

  const codeForAction = (action) => bindings[action];
  const actionForCode = (code) => INPUT_ACTIONS.find((action) => bindings[action] === code);
  const keyLabel = (code) => KEY_LABELS[code] || code.replace(/^Key/, "").replace(/^Digit/, "");
  const saveBindings = () => {
    try { window.localStorage.setItem("error-101-beta-1-bindings", JSON.stringify(bindings)); } catch { /* localStorage opcional */ }
  };

  const renderControls = () => {
    if (!controlList) return;
    controlList.textContent = "";
    for (const action of INPUT_ACTIONS) {
      const row = document.createElement("div");
      row.className = "control-row";
      const label = document.createElement("span");
      label.textContent = INPUT_LABELS[action];
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.bindingAction = action;
      button.textContent = listeningAction === action ? "PRESIONÁ UNA TECLA" : keyLabel(codeForAction(action));
      button.classList.toggle("listening", listeningAction === action);
      button.addEventListener("click", () => {
        listeningAction = action;
        renderControls();
      });
      row.append(label, button);
      controlList.append(row);
    }
  };

  let phase = "playing";
  let activePanel = "pause";
  let simulationTick = 0;
  let player = null;
  let rival = null;
  let blocks = [];
  let projectiles = [];
  let particles = [];
  let clouds = [];
  let wind = 1;
  let toastTime = 0;
  let spriteSheets = Object.create(null);
  let cloudSprites = [null, null, null];
  let assetsRemaining = 5;
  let previewNeedsDraw = true;
  let nextProjectileId = 1;
  const camera = {
    x: WORLD.width / 2,
    y: WORLD.height / 2,
    zoom: 1,
    targetX: 0,
    targetY: 0,
    targetZoom: 1,
    userZoom: 0,
  };

  const showToast = (message, seconds = 2) => {
    if (!toastElement) return;
    toastElement.textContent = message;
    toastElement.classList.add("visible");
    toastTime = seconds;
  };

  const setPanel = (panel) => {
    activePanel = panel;
    for (const element of pauseLayer.querySelectorAll("[data-panel]")) {
      element.hidden = element.dataset.panel !== panel;
    }
    if (panel === "controls") renderControls();
    if (panel === "character") previewNeedsDraw = true;
  };

  const setPaused = (paused) => {
    phase = paused ? "paused" : "playing";
    pauseLayer.hidden = !paused;
    if (paused) setPanel("pause");
    else canvas.focus();
    for (const action of INPUT_ACTIONS) keyboardHeld[action] = false;
  };

  const createActor = (id, x, isAi = false) => ({
    id,
    isAi,
    x,
    y: 560,
    prevX: x,
    prevY: 560,
    width: ACTOR.width,
    height: ACTOR.standingHeight,
    vx: 0,
    vy: 0,
    facing: id === "sol" ? 1 : -1,
    health: ACTOR.maxHealth,
    maxHealth: ACTOR.maxHealth,
    onGround: true,
    crouching: false,
    forcedCrouch: 0,
    invulnerable: 0,
    heartFlash: 0,
    coyote: 0,
    jumpBuffer: 0,
    fireCooldown: 0,
    firePose: 0,
    hurtPose: 0,
    stompPose: 0,
    animationState: "idle",
    previousAnimationState: "idle",
    animationTime: 0,
    blinkTime: 0,
    nextBlink: 2.2 + (id === "sol" ? 0 : 0.8),
    fastFalling: false,
    aiTimer: 0,
    aiFireTimer: 0.55,
    aiWanderTimer: 0,
    aiWanderDirection: 1,
    aiState: isAi ? "neutral" : "controlled",
    defenseTimer: 0,
    aggressorId: null,
    aiPrevious: Object.fromEntries(INPUT_ACTIONS.map((action) => [action, false])),
  });

  const createBlocks = () => {
    const result = [];
    LEVEL_GRID.forEach((row, rowIndex) => {
      [...row].forEach((symbol, column) => {
        const rule = TILE_RULES[symbol];
        if (!rule) return;
        result.push({
          symbol,
          type: rule.type,
          column,
          row: rowIndex,
          x: column * WORLD.tile,
          y: rowIndex * WORLD.tile,
          width: WORLD.tile,
          height: WORLD.tile,
          hp: rule.maxHp,
          maxHp: rule.maxHp,
          active: true,
        });
      });
    });
    return result;
  };

  const createCloud9 = (seed = 0x4d564c01) => {
    const rng = createRng(seed);
    wind = rng() > 0.5 ? 1 : -1;
    const result = [];
    for (let design = 0; design < 3; design += 1) {
      for (let copy = 0; copy < 3; copy += 1) {
        const depth = copy;
        result.push({
          design,
          copy,
          depth,
          x: rng() * WORLD.width,
          y: 54 + rng() * 280,
          scale: 0.72 + depth * 0.18 + rng() * 0.13,
          speed: wind * (7 + depth * 7 + rng() * 3),
        });
      }
    }
    return result;
  };

  const resetGame = () => {
    simulationTick = 0;
    blocks = createBlocks();
    player = createActor("sol", 170, true);
    rival = null;
    projectiles = [];
    particles = [];
    clouds = createCloud9(0x4d564c01);
    camera.x = WORLD.width / 2;
    camera.y = WORLD.height / 2;
    camera.zoom = CAMERA_LIMITS.minZoom;
    camera.targetX = camera.x;
    camera.targetY = camera.y;
    camera.targetZoom = camera.zoom;
    camera.userZoom = 0;
    phase = "playing";
    pauseLayer.hidden = true;
    gameStatus.textContent = "Partida reiniciada";
  };

  const spawnRival = () => {
    if (rival?.health > 0) return;
    rival = createActor("visitor", 1050, false);
    rival.y = 560;
    audio.play("spawn", rival.x);
    gameStatus.textContent = "Visitante incorporado";
  };

  const activeBlocks = () => blocks.filter((block) => block.active);
  const rectHitsBlock = (rect) => activeBlocks().some((block) => overlap(rect, block));
  const supportAt = (x, y) => activeBlocks().some((block) =>
    x >= block.x && x <= block.x + block.width && y >= block.y - 3 && y <= block.y + 7,
  );

  class AudioEngine {
    constructor() {
      this.context = null;
      this.enabled = true;
    }

    unlock() {
      if (!this.enabled) return;
      if (!this.context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) this.context = new AudioContext();
      }
      if (this.context?.state === "suspended") this.context.resume();
    }

    panFor(worldX) {
      const halfView = WORLD.width / (2 * Math.max(1, camera.zoom));
      return clamp((worldX - camera.x) / Math.max(180, halfView), -1, 1);
    }

    play(kind, worldX = camera.x) {
      this.unlock();
      if (!this.context) return;
      const presets = {
        jump: [240, 430, 0.09, "square"],
        fire: [520, 310, 0.11, "sawtooth"],
        hit: [150, 90, 0.12, "square"],
        stomp: [115, 58, 0.18, "triangle"],
        clash: [340, 54, 0.25, "sawtooth"],
        brick: [460, 210, 0.08, "square"],
        ground: [120, 52, 0.2, "triangle"],
        breakBrick: [610, 150, 0.16, "square"],
        breakGround: [92, 38, 0.3, "sawtooth"],
        spawn: [210, 530, 0.2, "triangle"],
      };
      const [start, end, duration, type] = presets[kind] || presets.hit;
      const now = this.context.currentTime;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(start, now);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), now + duration);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(kind === "clash" ? 0.16 : 0.1, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain);
      if (typeof this.context.createStereoPanner === "function") {
        const panner = this.context.createStereoPanner();
        panner.pan.setValueAtTime(this.panFor(worldX), now);
        gain.connect(panner);
        panner.connect(this.context.destination);
      } else {
        gain.connect(this.context.destination);
      }
      oscillator.start(now);
      oscillator.stop(now + duration + 0.02);
    }
  }
  const audio = new AudioEngine();

  const playerActions = () => {
    const result = {};
    for (const action of INPUT_ACTIONS) {
      const held = Boolean(keyboardHeld[action] || touchHeld[action] || gamepadHeld[action]);
      result[action] = {
        held,
        pressed: queuedPresses.has(action) || (held && !previousHeld[action]),
        released: !held && previousHeld[action],
      };
      previousHeld[action] = held;
    }
    queuedPresses.clear();
    return result;
  };

  const aiActions = (actor) => {
    const wants = Object.fromEntries(INPUT_ACTIONS.map((action) => [action, false]));
    const target = otherActor(actor);
    if (actor.health <= 0) return edgeActions(actor, wants);

    if (actor.defenseTimer <= 0) {
      actor.aiState = "neutral";
      actor.aggressorId = null;
    }

    if (!target || target.health <= 0 || actor.aiState !== "defensive") {
      actor.aiWanderTimer -= WORLD.fixedStep;
      if (actor.aiWanderTimer <= 0) {
        const phase = Math.floor(simulationTick / 180) % 4;
        actor.aiWanderDirection = phase === 1 ? 0 : phase === 2 ? -1 : 1;
        actor.aiWanderTimer = 1.2 + (simulationTick % 37) / 50;
      }
      if (actor.x < 70) actor.aiWanderDirection = 1;
      if (actor.x > WORLD.width - actor.width - 70) actor.aiWanderDirection = -1;
      if (target && Math.abs(target.x - actor.x) < 92) {
        actor.aiWanderDirection = Math.sign(actor.x - target.x) || -actor.facing;
      }
      wants.left = actor.aiWanderDirection < 0;
      wants.right = actor.aiWanderDirection > 0;
      const direction = actor.aiWanderDirection || actor.facing;
      const obstacle = activeBlocks().some((block) => overlap({
        x: direction > 0 ? actor.x + actor.width : actor.x - 12,
        y: actor.y + 16,
        width: 12,
        height: actor.height - 18,
      }, block));
      const footX = actor.x + actor.width / 2 + direction * 34;
      const gap = actor.onGround && direction !== 0 && !supportAt(footX, actor.y + actor.height + 6);
      if (actor.onGround && direction !== 0 && (obstacle || gap)) wants.up = true;
      return edgeActions(actor, wants);
    }

    const dx = target.x - actor.x;
    const distance = Math.abs(dx);
    wants.left = dx < -24;
    wants.right = dx > 24;
    wants.run = distance > 330;
    const direction = Math.sign(dx) || actor.facing;
    const footX = actor.x + actor.width / 2 + direction * 34;
    const obstacle = activeBlocks().some((block) => overlap({
      x: direction > 0 ? actor.x + actor.width : actor.x - 12,
      y: actor.y + 16,
      width: 12,
      height: actor.height - 18,
    }, block));
    const gap = actor.onGround && !supportAt(footX, actor.y + actor.height + 6);
    actor.aiTimer -= WORLD.fixedStep;
    if (actor.aiTimer <= 0 && actor.onGround && (obstacle || gap || target.y + 40 < actor.y || distance < 90)) {
      wants.up = true;
      actor.aiTimer = 0.32 + (simulationTick % 17) / 100;
    }
    const incoming = projectiles.some((shot) => shot.active && shot.ownerId !== actor.id &&
      Math.sign(shot.vx) === Math.sign(actor.x - shot.x) && Math.abs(shot.x - actor.x) < 190 &&
      shot.y > actor.y + 24 && shot.y < actor.y + actor.height);
    if (incoming && actor.onGround && simulationTick % 3 !== 0) wants.down = true;
    actor.aiFireTimer -= WORLD.fixedStep;
    if (actor.aiFireTimer <= 0 && distance < 610 && Math.abs((target.y + target.height / 2) - (actor.y + actor.height / 2)) < 130) {
      wants.ranged = true;
      actor.aiFireTimer = 0.65 + (simulationTick % 23) / 50;
    }
    return edgeActions(actor, wants);
  };

  const edgeActions = (actor, wants) => {
    const result = {};
    for (const action of INPUT_ACTIONS) {
      const held = Boolean(wants[action]);
      result[action] = { held, pressed: held && !actor.aiPrevious[action], released: !held && actor.aiPrevious[action] };
      actor.aiPrevious[action] = held;
    }
    return result;
  };

  const changeCrouch = (actor, crouching) => {
    if (actor.crouching === crouching) return;
    const bottom = actor.y + actor.height;
    if (!crouching) {
      const standingRect = { x: actor.x, y: bottom - ACTOR.standingHeight, width: actor.width, height: ACTOR.standingHeight };
      if (rectHitsBlock(standingRect)) return;
      if (otherActor(actor) && overlap(standingRect, otherActor(actor))) return;
    }
    actor.crouching = crouching;
    actor.height = crouching ? ACTOR.crouchingHeight : ACTOR.standingHeight;
    actor.y = bottom - actor.height;
  };

  const otherActor = (actor) => actor === player ? rival : player;

  const updateActor = (actor, actions, dt) => {
    if (!actor) return;
    actor.prevX = actor.x;
    actor.prevY = actor.y;
    actor.invulnerable = Math.max(0, actor.invulnerable - dt);
    actor.heartFlash = Math.max(0, actor.heartFlash - dt);
    actor.forcedCrouch = Math.max(0, actor.forcedCrouch - dt);
    actor.fireCooldown = Math.max(0, actor.fireCooldown - dt);
    actor.firePose = Math.max(0, actor.firePose - dt);
    actor.hurtPose = Math.max(0, actor.hurtPose - dt);
    actor.stompPose = Math.max(0, actor.stompPose - dt);
    actor.defenseTimer = Math.max(0, actor.defenseTimer - dt);
    actor.jumpBuffer = Math.max(0, actor.jumpBuffer - dt);
    actor.coyote = actor.onGround ? 0.09 : Math.max(0, actor.coyote - dt);
    actor.animationTime += dt;
    actor.nextBlink -= dt;
    actor.blinkTime = Math.max(0, actor.blinkTime - dt);
    if (actor.nextBlink <= 0) {
      actor.blinkTime = 0.13;
      actor.nextBlink = 3.1 + ((simulationTick + (actor.id === "sol" ? 17 : 43)) % 151) / 100;
    }

    if (actor.health <= 0) {
      actor.vx = moveToward(actor.vx, 0, ACTOR.deceleration * dt);
      actor.vy = Math.min(ACTOR.maxFallSpeed, actor.vy + ACTOR.gravity * dt);
      actor.y += actor.vy * dt;
      return;
    }

    const wantsCrouch = actions.down.held || actor.forcedCrouch > 0;
    changeCrouch(actor, wantsCrouch);
    actor.fastFalling = !actor.onGround && actions.down.held;
    if (actor.fastFalling) actor.vy = Math.max(actor.vy, ACTOR.fastFallEntrySpeed);
    let direction = 0;
    if (actions.left.held) direction -= 1;
    if (actions.right.held) direction += 1;
    if (direction !== 0) actor.facing = direction;
    const maxSpeed = actor.crouching ? ACTOR.crouchSpeed : actions.run.held ? ACTOR.runSpeed : ACTOR.walkSpeed;
    const targetVx = direction * maxSpeed;
    actor.vx = moveToward(actor.vx, targetVx, (direction === 0 ? ACTOR.deceleration : ACTOR.acceleration) * dt);

    if (actions.up.pressed) actor.jumpBuffer = 0.11;
    if (actor.jumpBuffer > 0 && actor.coyote > 0) {
      actor.vy = ACTOR.jumpVelocity;
      actor.onGround = false;
      actor.coyote = 0;
      actor.jumpBuffer = 0;
      audio.play("jump", actor.x + actor.width / 2);
    }
    if (actions.up.released && actor.vy < -360) actor.vy *= 0.58;
    if (actions.ranged.pressed) fireProjectile(actor);

    actor.x += actor.vx * dt;
    resolveActorHorizontal(actor);
    const gravity = actor.fastFalling ? ACTOR.fastFallGravity : ACTOR.gravity;
    actor.vy = Math.min(ACTOR.maxFallSpeed, actor.vy + gravity * dt);
    actor.y += actor.vy * dt;
    resolveActorVertical(actor);
    actor.fastFalling = actor.fastFalling && !actor.onGround;

    if (actor.y > WORLD.height + 240) {
      actor.health = 0;
      actor.vx = 0;
      actor.vy = 0;
      gameStatus.textContent = actor.id === "sol" ? "Sol cayó al vacío" : "El visitante cayó al vacío";
    }

    if (actor.stompPose > 0) actor.animationState = "stomp";
    else if (actor.hurtPose > 0) actor.animationState = "hurt";
    else if (actor.firePose > 0) actor.animationState = actor.onGround ? "fire" : "airFire";
    else if (actor.fastFalling) actor.animationState = "fastFall";
    else if (!actor.onGround) actor.animationState = actor.vy < 0 ? "jump" : "fall";
    else if (actor.crouching) actor.animationState = "crouch";
    else if (Math.abs(actor.vx) > ACTOR.walkSpeed + 20) actor.animationState = "run";
    else if (Math.abs(actor.vx) > 20) actor.animationState = "walk";
    else actor.animationState = "idle";
    if (actor.animationState !== actor.previousAnimationState) {
      actor.animationTime = 0;
      actor.previousAnimationState = actor.animationState;
    }
  };

  const resolveActorHorizontal = (actor) => {
    actor.x = clamp(actor.x, 0, WORLD.width - actor.width);
    for (const block of activeBlocks()) {
      if (!overlap(actor, block)) continue;
      if (actor.vx > 0) actor.x = block.x - actor.width;
      else if (actor.vx < 0) actor.x = block.x + block.width;
      actor.vx = 0;
    }
  };

  const resolveActorVertical = (actor) => {
    actor.onGround = false;
    for (const block of activeBlocks()) {
      if (!overlap(actor, block)) continue;
      if (actor.vy >= 0 && actor.prevY + actor.height <= block.y + 8) {
        actor.y = block.y - actor.height;
        actor.vy = 0;
        actor.onGround = true;
      } else if (actor.vy < 0 && actor.prevY >= block.y + block.height - 8) {
        actor.y = block.y + block.height;
        actor.vy = 0;
        if (block.type === "floatingBrick" && !actor.crouching) {
          damageBlock(block, block.maxHp, actor.x + actor.width / 2, actor.id);
        }
      } else {
        const leftPenetration = actor.x + actor.width - block.x;
        const rightPenetration = block.x + block.width - actor.x;
        if (leftPenetration < rightPenetration) actor.x -= leftPenetration;
        else actor.x += rightPenetration;
        actor.vx = 0;
      }
    }
  };

  const damageActor = (actor, amount, sourceX, force = false, sourceId = null) => {
    if (!actor || actor.health <= 0 || (!force && actor.invulnerable > 0)) return false;
    actor.health = Math.max(0, actor.health - amount);
    actor.heartFlash = 0.42;
    actor.hurtPose = 0.24;
    if (!force) actor.invulnerable = ACTOR.invulnerability;
    if (actor.isAi && sourceId && sourceId !== actor.id) {
      actor.aiState = "defensive";
      actor.defenseTimer = ACTOR.defenseTime;
      actor.aggressorId = sourceId;
    }
    const direction = Math.sign(actor.x + actor.width / 2 - sourceX) || 1;
    actor.vx += direction * 130;
    actor.vy = Math.min(actor.vy, -180);
    const palette = CHARACTER_PALETTES[actor.id] || CHARACTER_PALETTES.visitor;
    spawnParticles(
      actor.x + actor.width / 2 - direction * actor.width * 0.45,
      actor.y + actor.height * 0.42,
      palette.particle,
      11,
      250,
      0.34,
    );
    audio.play("hit", actor.x + actor.width / 2);
    return true;
  };

  const damageBlock = (block, amount, sourceX, sourceId = null) => {
    if (!block.active) return;
    block.hp -= amount;
    audio.play(block.type === "groundBrick" ? "ground" : "brick", block.x + block.width / 2);
    spawnParticles(block.x + block.width / 2, block.y + block.height / 2, block.type === "groundBrick" ? "#8d5a38" : "#f09138", 5, 130);
    if (block.hp > 0) return;
    block.active = false;
    audio.play(block.type === "groundBrick" ? "breakGround" : "breakBrick", block.x + block.width / 2);
    spawnParticles(block.x + block.width / 2, block.y + block.height / 2, block.type === "groundBrick" ? "#6f422d" : "#ffb347", 12, 260);
    for (const actor of [player, rival]) {
      if (!actor || actor.health <= 0) continue;
      const feet = actor.y + actor.height;
      const supported = feet >= block.y - 5 && feet <= block.y + 7 && actor.x + actor.width > block.x && actor.x < block.x + block.width;
      if (!supported) continue;
      damageActor(actor, 1, sourceX ?? block.x + block.width / 2, true, sourceId);
      const radial = Math.sign(actor.x + actor.width / 2 - (block.x + block.width / 2)) || (actor === player ? -1 : 1);
      actor.vx += radial * 170;
      actor.vy = -280;
      actor.onGround = false;
    }
  };

  const fireProjectile = (actor) => {
    if (actor.fireCooldown > 0 || projectiles.filter((shot) => shot.active && shot.ownerId === actor.id).length >= FIREBALL.maxActive) return;
    actor.fireCooldown = 0.18;
    actor.firePose = 0.15;
    const x = actor.x + actor.width / 2 + actor.facing * (actor.width / 2 + 12);
    const y = actor.y + Math.min(36, actor.height * 0.45);
    const palette = CHARACTER_PALETTES[actor.id] || CHARACTER_PALETTES.visitor;
    projectiles.push({
      id: nextProjectileId++,
      ownerId: actor.id,
      active: true,
      x,
      y,
      prevX: x,
      prevY: y,
      vx: actor.facing * FIREBALL.speed,
      vy: FIREBALL.lift,
      radius: FIREBALL.radius,
      life: 0,
      bounces: 0,
      opacity: 1,
      trail: 0,
      palette,
    });
    spawnParticles(x, y, palette.particle, 5, 120, 0.2);
    audio.play("fire", x);
  };

  const circleHitsBlock = (shot, block) => {
    const nearestX = clamp(shot.x, block.x, block.x + block.width);
    const nearestY = clamp(shot.y, block.y, block.y + block.height);
    const dx = shot.x - nearestX;
    const dy = shot.y - nearestY;
    return dx * dx + dy * dy <= shot.radius * shot.radius;
  };

  const updateProjectiles = (dt) => {
    for (const shot of projectiles) {
      if (!shot.active) continue;
      shot.prevX = shot.x;
      shot.prevY = shot.y;
      shot.life += dt;
      shot.trail -= dt;
      shot.vy += FIREBALL.gravity * dt;
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      if (shot.trail <= 0) {
        shot.trail = 0.035;
        spawnParticles(shot.x - shot.vx * 0.015, shot.y - shot.vy * 0.015, shot.palette.particle, 1, 35, 0.28);
      }
      for (const block of activeBlocks()) {
        if (!circleHitsBlock(shot, block)) continue;
        const cameFromTop = shot.prevY + shot.radius <= block.y + 2;
        const cameFromBottom = shot.prevY - shot.radius >= block.y + block.height - 2;
        if (cameFromTop) {
          shot.y = block.y - shot.radius;
          shot.vy = -Math.max(240, Math.abs(shot.vy) * FIREBALL.retention);
        } else if (cameFromBottom) {
          shot.y = block.y + block.height + shot.radius;
          shot.vy = Math.abs(shot.vy) * FIREBALL.retention;
        } else {
          if (shot.prevX < block.x) shot.x = block.x - shot.radius;
          else shot.x = block.x + block.width + shot.radius;
          shot.vx *= -FIREBALL.retention;
        }
        shot.bounces += 1;
        shot.opacity = Math.max(0.15, 1 - shot.bounces / FIREBALL.maxBounces);
        damageBlock(block, 1, shot.x, shot.ownerId);
        if (shot.bounces >= FIREBALL.maxBounces) destroyProjectile(shot, true);
        break;
      }
      if (shot.life > FIREBALL.maxLife || shot.x < -120 || shot.x > WORLD.width + 120 || shot.y > WORLD.height + 260) destroyProjectile(shot, false);
    }

    for (let index = 0; index < projectiles.length; index += 1) {
      const first = projectiles[index];
      if (!first.active) continue;
      for (let secondIndex = index + 1; secondIndex < projectiles.length; secondIndex += 1) {
        const second = projectiles[secondIndex];
        if (!second.active || first.ownerId === second.ownerId) continue;
        const dx = first.x - second.x;
        const dy = first.y - second.y;
        if (dx * dx + dy * dy > (first.radius + second.radius) ** 2) continue;
        const x = (first.x + second.x) / 2;
        const y = (first.y + second.y) / 2;
        first.active = false;
        second.active = false;
        radialExplosion(x, y, first.palette, second.palette);
        break;
      }
    }

    for (const shot of projectiles) {
      if (!shot.active) continue;
      const target = [player, rival].find((actor) => actor && actor.id !== shot.ownerId);
      if (!target || target.health <= 0) continue;
      const nearestX = clamp(shot.x, target.x, target.x + target.width);
      const nearestY = clamp(shot.y, target.y, target.y + target.height);
      const dx = shot.x - nearestX;
      const dy = shot.y - nearestY;
      if (dx * dx + dy * dy > shot.radius * shot.radius) continue;
      if (damageActor(target, 1, shot.x, false, shot.ownerId)) destroyProjectile(shot, true);
    }
    projectiles = projectiles.filter((shot) => shot.active);
  };

  const destroyProjectile = (shot, particlesToo) => {
    if (!shot.active) return;
    shot.active = false;
    if (particlesToo) spawnParticles(shot.x, shot.y, shot.palette.particle, 8, 190);
  };

  const radialExplosion = (x, y, firstPalette = CHARACTER_PALETTES.sol, secondPalette = CHARACTER_PALETTES.visitor) => {
    audio.play("clash", x);
    spawnParticles(x, y, firstPalette.particle, 10, 420, 0.55);
    spawnParticles(x, y, secondPalette.particle, 10, 420, 0.55);
    for (const actor of [player, rival]) {
      if (!actor || actor.health <= 0) continue;
      const dx = actor.x + actor.width / 2 - x;
      const dy = actor.y + actor.height / 2 - y;
      const distance = Math.hypot(dx, dy);
      if (distance >= FIREBALL.clashRadius) continue;
      const strength = 520 * (1 - distance / FIREBALL.clashRadius);
      const normalX = distance > 1 ? dx / distance : (actor === player ? -1 : 1);
      const normalY = distance > 1 ? dy / distance : -0.3;
      actor.vx += normalX * strength;
      actor.vy += Math.min(-80, normalY * strength - 80);
      actor.onGround = false;
    }
  };

  const spawnParticles = (x, y, color, count, speed, life = 0.45) => {
    const rng = createRng((simulationTick * 2654435761 + count * 97 + Math.floor(x)) >>> 0);
    for (let index = 0; index < count; index += 1) {
      const angle = rng() * Math.PI * 2;
      const velocity = speed * (0.35 + rng() * 0.65);
      particles.push({
        x, y,
        prevX: x,
        prevY: y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life,
        maxLife: life,
        size: 2 + rng() * 4,
        color,
      });
    }
  };

  const updateParticles = (dt) => {
    for (const particle of particles) {
      particle.prevX = particle.x;
      particle.prevY = particle.y;
      particle.life -= dt;
      particle.vy += 420 * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
    }
    particles = particles.filter((particle) => particle.life > 0);
  };

  const resolveActors = () => {
    if (!player || !rival || player.health <= 0 || rival.health <= 0 || !overlap(player, rival)) return;
    const playerPreviousBottom = player.prevY + player.height;
    const rivalPreviousBottom = rival.prevY + rival.height;
    if (player.vy > 80 && playerPreviousBottom <= rival.y + 13) {
      stomp(player, rival);
      return;
    }
    if (rival.vy > 80 && rivalPreviousBottom <= player.y + 13) {
      stomp(rival, player);
      return;
    }
    const overlapX = Math.min(player.x + player.width, rival.x + rival.width) - Math.max(player.x, rival.x);
    if (overlapX <= 0) return;
    const push = overlapX / 2 + 0.05;
    if (player.x < rival.x) {
      player.x -= push;
      rival.x += push;
    } else {
      player.x += push;
      rival.x -= push;
    }
    player.x = clamp(player.x, 0, WORLD.width - player.width);
    rival.x = clamp(rival.x, 0, WORLD.width - rival.width);
    const sharedVx = (player.vx + rival.vx) * 0.25;
    player.vx = sharedVx;
    rival.vx = sharedVx;
  };

  const stomp = (attacker, target) => {
    attacker.y = target.y - attacker.height;
    attacker.vy = ACTOR.stompBounce;
    attacker.onGround = false;
    audio.play("stomp", target.x + target.width / 2);
    spawnParticles(target.x + target.width / 2, target.y + 3, "#ffffff", 10, 230);
    if (target.crouching) return;
    target.stompPose = 0.3;
    if (damageActor(target, ACTOR.stompDamage, attacker.x + attacker.width / 2, false, attacker.id)) {
      target.forcedCrouch = ACTOR.invulnerability;
      changeCrouch(target, true);
    }
  };

  const updateClouds = (dt) => {
    for (const cloud of clouds) {
      cloud.x += cloud.speed * dt;
      const margin = 280;
      if (cloud.speed > 0 && cloud.x > WORLD.width + margin) cloud.x = -margin;
      if (cloud.speed < 0 && cloud.x < -margin) cloud.x = WORLD.width + margin;
    }
  };

  const cameraGoalFor = (actors, userZoom = camera.userZoom) => {
    const alive = actors.filter((actor) => actor && actor.health > 0);
    const manualBlend = clamp(userZoom, 0, 1);
    if (alive.length <= 1) {
      const actor = alive[0] || player;
      return {
        x: actor.x + actor.width / 2,
        y: actor.y + actor.height / 2,
        zoom: lerp(CAMERA_LIMITS.minZoom, CAMERA_LIMITS.soloZoom, manualBlend),
      };
    }
    const centers = alive.map((actor) => ({ x: actor.x + actor.width / 2, y: actor.y + actor.height / 2 }));
    const minX = Math.min(...centers.map((point) => point.x));
    const maxX = Math.max(...centers.map((point) => point.x));
    const minY = Math.min(...centers.map((point) => point.y));
    const maxY = Math.max(...centers.map((point) => point.y));
    const zoomX = WORLD.width / (maxX - minX + 300);
    const zoomY = WORLD.height / (maxY - minY + 260);
    const automaticZoom = clamp(Math.min(zoomX, zoomY), CAMERA_LIMITS.minZoom, CAMERA_LIMITS.maxZoom);
    return {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      zoom: lerp(CAMERA_LIMITS.minZoom, automaticZoom, manualBlend),
    };
  };

  const updateCamera = (dt) => {
    const goal = cameraGoalFor([player, rival]);
    const halfWidth = WORLD.width / (2 * goal.zoom);
    const halfHeight = WORLD.height / (2 * goal.zoom);
    camera.targetX = clamp(goal.x, halfWidth, WORLD.width - halfWidth);
    camera.targetY = clamp(goal.y + 34, halfHeight, WORLD.height - halfHeight);
    camera.targetZoom = goal.zoom;
    const positionBlend = 1 - Math.exp(-7 * dt);
    const zoomBlend = 1 - Math.exp(-3.5 * dt);
    camera.x = lerp(camera.x, camera.targetX, positionBlend);
    camera.y = lerp(camera.y, camera.targetY, positionBlend);
    camera.zoom = lerp(camera.zoom, camera.targetZoom, zoomBlend);
  };

  const update = (dt) => {
    simulationTick += 1;
    const actions = playerActions();
    updateActor(player, aiActions(player), dt);
    if (rival) updateActor(rival, actions, dt);
    resolveActors();
    updateProjectiles(dt);
    updateParticles(dt);
    updateClouds(dt);
    updateCamera(dt);
    if (toastTime > 0) {
      toastTime -= dt;
      if (toastTime <= 0) toastElement.classList.remove("visible");
    }
  };

  const prepareSpriteSheet = (image, layout) => {
    const columns = layout.columns;
    const rows = layout.rows;
    const surface = document.createElement("canvas");
    surface.width = image.width;
    surface.height = image.height;
    const surfaceContext = surface.getContext("2d", { willReadFrequently: true });
    surfaceContext.drawImage(image, 0, 0);
    const pixels = surfaceContext.getImageData(0, 0, image.width, image.height).data;
    const frames = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const sx = Math.round(column * image.width / columns);
        const sy = Math.round(row * image.height / rows);
        const right = Math.round((column + 1) * image.width / columns);
        const bottom = Math.round((row + 1) * image.height / rows);
        let minX = right;
        let minY = bottom;
        let maxX = sx;
        let maxY = sy;
        for (let y = sy; y < bottom; y += 1) {
          for (let x = sx; x < right; x += 1) {
            if (pixels[(y * image.width + x) * 4 + 3] < 18) continue;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
        const hasPixels = maxX >= minX && maxY >= minY;
        frames.push({
          sx,
          sy,
          sw: right - sx,
          sh: bottom - sy,
          visibleHeight: hasPixels ? maxY - minY + 1 : bottom - sy,
          anchorBottom: hasPixels ? maxY - sy + 1 : bottom - sy,
        });
      }
    }
    const referenceFrames = layout.referenceFrames || frames.map((_, index) => index);
    const referenceHeights = referenceFrames.map((index) => frames[index]?.visibleHeight).filter(Boolean).sort((a, b) => a - b);
    const referenceHeight = referenceHeights[Math.floor(referenceHeights.length / 2)] || image.height / rows;
    return { image, columns, rows, frames, referenceHeight };
  };

  const animationFrameFor = (actor) => {
    const animation = ANIMATIONS[actor.animationState] || ANIMATIONS.idle;
    let column = animation.column || 0;
    if (animation.frames) column = Math.floor(actor.animationTime * animation.fps) % animation.frames;
    if (actor.animationState === "idle" && actor.blinkTime > 0) column = 3;
    return { animation, column };
  };

  const drawPreparedSprite = (targetContext, sheet, row, column, x, baseline, visibleHeight, facing = 1, filter = "none") => {
    if (!sheet) return;
    const frame = sheet.frames[row * sheet.columns + column];
    if (!frame) return;
    const scale = visibleHeight / sheet.referenceHeight;
    const width = frame.sw * scale;
    const height = frame.sh * scale;
    targetContext.save();
    targetContext.translate(x, baseline);
    if (facing < 0) targetContext.scale(-1, 1);
    targetContext.imageSmoothingEnabled = true;
    targetContext.filter = filter;
    targetContext.drawImage(
      sheet.image,
      frame.sx,
      frame.sy,
      frame.sw,
      frame.sh,
      -width / 2,
      -frame.anchorBottom * scale,
      width,
      height,
    );
    targetContext.restore();
  };

  const drawCloud = (cloud) => {
    const cloudSprite = cloudSprites[cloud.design];
    if (!cloudSprite) return;
    const parallax = 0.02 + cloud.depth * 0.018;
    const x = cloud.x - (camera.x - WORLD.width / 2) * parallax;
    const y = cloud.y - (camera.y - WORLD.height / 2) * parallax * 0.6;
    const baseHeights = [78, 94, 90];
    const height = baseHeights[cloud.design] * cloud.scale * (1 + (camera.zoom - 1) * 0.025);
    const width = height * cloudSprite.width / cloudSprite.height;
    ctx.save();
    ctx.globalAlpha = 0.7 + cloud.depth * 0.1;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      cloudSprite,
      Math.round(x - width / 2),
      Math.round(y - height / 2),
      width,
      height,
    );
    ctx.restore();
  };

  const drawBlock = (block) => {
    if (!block.active) return;
    const x = block.x;
    const y = block.y;
    if (block.type === "floatingBrick") {
      ctx.fillStyle = "#4a1b21";
      ctx.fillRect(x, y, 40, 40);
      ctx.fillStyle = "#d65b2f";
      ctx.fillRect(x + 2, y + 4, 36, 33);
      ctx.fillStyle = "#f3a33e";
      ctx.fillRect(x + 2, y + 2, 36, 5);
      ctx.fillStyle = "#70251f";
      ctx.fillRect(x, y + 18, 40, 3);
      ctx.fillRect(x + 18, y + 4, 3, 14);
      ctx.fillRect(x + 8, y + 21, 3, 16);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(x + 5, y + 9, 10, 3);
    } else {
      ctx.fillStyle = "#5b1f18";
      ctx.fillRect(x, y, 40, 40);
      ctx.fillStyle = "#ed7432";
      ctx.fillRect(x + 3, y + 3, 34, 34);
      ctx.fillStyle = "#ffad4a";
      ctx.fillRect(x + 4, y + 4, 32, 5);
      ctx.fillStyle = "#98331f";
      ctx.fillRect(x + 4, y + 31, 32, 5);
      ctx.fillRect(x + 3, y + 10, 4, 20);
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.fillRect(x + 9, y + 12, 15, 3);
    }
    const damage = 1 - block.hp / block.maxHp;
    if (damage > 0) {
      ctx.strokeStyle = "#3f1720";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x + 21, y + 4);
      ctx.lineTo(x + 17, y + 13);
      ctx.lineTo(x + 23, y + 20);
      if (damage >= 0.45) {
        ctx.lineTo(x + 14, y + 31);
        ctx.moveTo(x + 23, y + 20);
        ctx.lineTo(x + 30, y + 29);
      }
      if (damage >= 0.72) {
        ctx.moveTo(x + 5, y + 17);
        ctx.lineTo(x + 14, y + 11);
        ctx.lineTo(x + 20, y + 19);
      }
      ctx.stroke();
    }
  };

  const drawActorMotionEffects = (actor, alpha) => {
    if (!actor || actor.health <= 0 || actor.onGround || actor.vy < 260) return;
    const x = lerp(actor.prevX, actor.x, alpha) + actor.width / 2;
    const y = lerp(actor.prevY, actor.y, alpha) + actor.height * 0.48;
    const palette = CHARACTER_PALETTES[actor.id] || CHARACTER_PALETTES.visitor;
    const intensity = clamp((actor.vy - 220) / 720, 0.15, 1);
    ctx.save();
    ctx.globalAlpha = 0.28 + intensity * 0.42;
    ctx.strokeStyle = palette.particle;
    ctx.lineWidth = 2 / camera.zoom;
    ctx.lineCap = "round";
    for (let index = -1; index <= 1; index += 1) {
      const offset = index * 17;
      const length = 18 + intensity * (22 + Math.abs(index) * 5);
      ctx.beginPath();
      ctx.moveTo(x + offset, y - 42 - Math.abs(index) * 5);
      ctx.lineTo(x + offset - actor.facing * 3, y - 42 - length);
      ctx.stroke();
    }
    ctx.restore();
  };

  const drawActor = (actor, alpha) => {
    if (!actor || actor.health <= 0) return;
    if (actor.invulnerable > 0 && Math.floor(actor.invulnerable * 24) % 2 === 0) return;
    const x = lerp(actor.prevX, actor.x, alpha);
    const y = lerp(actor.prevY, actor.y, alpha);
    const { animation, column } = animationFrameFor(actor);
    const sheet = spriteSheets[animation.sheet];
    drawPreparedSprite(
      ctx,
      sheet,
      animation.row,
      column,
      x + actor.width / 2,
      y + actor.height,
      animation.height,
      actor.facing,
      actor.id === "sol" ? "none" : "hue-rotate(170deg) saturate(.82) brightness(1.08)",
    );
  };

  const drawProjectile = (shot, alpha) => {
    if (!shot.active) return;
    const x = lerp(shot.prevX, shot.x, alpha);
    const y = lerp(shot.prevY, shot.y, alpha);
    ctx.save();
    ctx.globalAlpha = shot.opacity;
    const gradient = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, shot.radius + 4);
    gradient.addColorStop(0, shot.palette.core);
    gradient.addColorStop(0.35, shot.palette.mid);
    gradient.addColorStop(0.72, shot.palette.edge);
    gradient.addColorStop(1, shot.palette.fade);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, shot.radius + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shot.palette.core;
    ctx.fillRect(x - 4, y - 4, 8, 8);
    ctx.restore();
  };

  const drawParticles = (alpha) => {
    for (const particle of particles) {
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = particle.color;
      const x = lerp(particle.prevX, particle.x, alpha);
      const y = lerp(particle.prevY, particle.y, alpha);
      ctx.fillRect(x - particle.size / 2, y - particle.size / 2, particle.size, particle.size);
    }
    ctx.globalAlpha = 1;
  };

  const drawHeartShape = (x, y, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x + 3, y, 7, 7);
    ctx.fillRect(x + 15, y, 7, 7);
    ctx.fillRect(x, y + 5, 25, 8);
    ctx.fillRect(x + 4, y + 13, 17, 6);
    ctx.fillRect(x + 8, y + 19, 9, 5);
  };

  const drawHeartHalf = (x, y, side, color) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(side === "left" ? x : x + 12.5, y - 1, 12.5, 26);
    ctx.clip();
    drawHeartShape(x, y, color);
    ctx.restore();
  };

  const drawHearts = (actor, mirrored) => {
    if (!actor) return;
    for (let index = 0; index < 5; index += 1) {
      const units = clamp(actor.health - index * 2, 0, 2);
      const x = mirrored ? WORLD.width - 47 - index * 31 : 22 + index * 31;
      const y = 23;
      const firstHalf = mirrored ? "right" : "left";
      const secondHalf = mirrored ? "left" : "right";
      drawHeartShape(x, y, "rgba(7,17,31,.3)");
      if (units >= 1) drawHeartHalf(x, y, firstHalf, "#e9424d");
      if (units >= 2) drawHeartHalf(x, y, secondHalf, "#e9424d");
      if (units > 0) {
        ctx.fillStyle = actor.heartFlash > 0 && Math.floor(actor.heartFlash * 22) % 2 === 0
          ? "#ffffff"
          : "#ff9da4";
        ctx.fillRect(x + (mirrored ? 16 : 4), y + 4, 5, 4);
      }
    }
  };

  const render = (alpha, time) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#75aadb";
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    clouds.forEach(drawCloud);

    ctx.save();
    ctx.translate(WORLD.width / 2, WORLD.height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);
    blocks.forEach(drawBlock);
    drawParticles(alpha);
    projectiles.forEach((shot) => drawProjectile(shot, alpha));
    drawActorMotionEffects(player, alpha);
    drawActorMotionEffects(rival, alpha);
    drawActor(player, alpha);
    drawActor(rival, alpha);
    ctx.restore();

    drawHearts(player, false);
    if (rival) drawHearts(rival, true);
    if (activePanel === "character") drawCharacterPreview(time);
  };

  const drawCharacterPreview = (time = 0) => {
    if (!characterPreview) return;
    const previewContext = characterPreview.getContext("2d");
    previewContext.clearRect(0, 0, characterPreview.width, characterPreview.height);
    const gradient = previewContext.createLinearGradient(0, 0, 0, characterPreview.height);
    gradient.addColorStop(0, "#8ac0e1");
    gradient.addColorStop(1, "#75aadb");
    previewContext.fillStyle = gradient;
    previewContext.fillRect(0, 0, characterPreview.width, characterPreview.height);
    previewContext.fillStyle = "#456b82";
    previewContext.fillRect(0, 386, characterPreview.width, 3);
    if (spriteSheets.locomotion) {
      const previewColumn = Math.floor(time * 0.45) % 11 === 8 ? 3 : Math.floor(time * 1.4) % 3;
      drawPreparedSprite(
        previewContext,
        spriteSheets.locomotion,
        0,
        previewColumn,
        characterPreview.width / 2,
        386,
        280,
      );
    } else {
      previewContext.fillStyle = "#07111f";
      previewContext.textAlign = "center";
      previewContext.font = "900 13px 'Courier New', monospace";
      previewContext.fillText("CARGANDO PERSONAJE", characterPreview.width / 2, 210);
    }
    previewNeedsDraw = false;
  };

  const assetLoaded = () => {
    assetsRemaining = Math.max(0, assetsRemaining - 1);
    if (assetsRemaining === 0) loadingMessage.hidden = true;
    previewNeedsDraw = true;
  };

  const loadAssets = () => {
    if (typeof Image === "undefined") {
      loadingMessage.hidden = true;
      return;
    }
    const loadSheet = (name, source, layout) => {
      const image = new Image();
      image.addEventListener("load", () => {
        try { spriteSheets[name] = prepareSpriteSheet(image, layout); } catch { spriteSheets[name] = null; }
        assetLoaded();
      });
      image.addEventListener("error", assetLoaded);
      image.src = source;
    };
    loadSheet("locomotion", "/assets/sol-locomotion-v2.png", SPRITE_LAYOUTS.locomotion);
    loadSheet("actions", "/assets/sol-actions-v2.png", SPRITE_LAYOUTS.actions);

    ["small", "medium", "long"].forEach((name, index) => {
      const image = new Image();
      image.addEventListener("load", () => { cloudSprites[index] = image; assetLoaded(); });
      image.addEventListener("error", assetLoaded);
      image.src = `/assets/cloud-${name}-v2.png`;
    });
  };

  const pollGamepad = () => {
    if (!navigator.getGamepads) return;
    const pad = [...navigator.getGamepads()].find(Boolean);
    for (const action of INPUT_ACTIONS) gamepadHeld[action] = false;
    if (!pad) {
      if (gamepadStatus) {
        gamepadStatus.textContent = "JOYSTICK NO DETECTADO";
        gamepadStatus.classList.remove("connected");
      }
      return;
    }
    const axisX = pad.axes[0] || 0;
    const axisY = pad.axes[1] || 0;
    const pressed = (index) => Boolean(pad.buttons[index]?.pressed);
    gamepadHeld.left = axisX < -0.35 || pressed(14);
    gamepadHeld.right = axisX > 0.35 || pressed(15);
    gamepadHeld.up = axisY < -0.45 || pressed(12) || pressed(0);
    gamepadHeld.down = axisY > 0.45 || pressed(13);
    gamepadHeld.melee = pressed(2);
    gamepadHeld.ranged = pressed(1);
    gamepadHeld.guard = pressed(4);
    gamepadHeld.run = pressed(5);
    if (gamepadStatus) {
      gamepadStatus.textContent = `JOYSTICK · ${pad.id || "CONECTADO"}`;
      gamepadStatus.classList.add("connected");
    }
  };

  window.addEventListener("keydown", (event) => {
    audio.unlock();
    if (listeningAction) {
      if (event.code === "Escape") {
        listeningAction = null;
      } else {
        const displaced = actionForCode(event.code);
        if (displaced) bindings[displaced] = bindings[listeningAction];
        bindings[listeningAction] = event.code;
        listeningAction = null;
        saveBindings();
      }
      renderControls();
      event.preventDefault();
      return;
    }
    if (event.code === "Escape") {
      setPaused(phase !== "paused");
      event.preventDefault();
      return;
    }
    if (event.code === "Enter" && phase === "playing") {
      spawnRival();
      event.preventDefault();
      return;
    }
    const action = actionForCode(event.code);
    if (!action || phase !== "playing") return;
    if (!keyboardHeld[action]) queuedPresses.add(action);
    keyboardHeld[action] = true;
    event.preventDefault();
  });

  window.addEventListener("keyup", (event) => {
    const action = actionForCode(event.code);
    if (!action) return;
    keyboardHeld[action] = false;
    event.preventDefault();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && phase === "playing") setPaused(true);
  });

  continueButton.addEventListener("click", () => setPaused(false));
  restartButton.addEventListener("click", () => resetGame());
  for (const button of pauseLayer.querySelectorAll("[data-open-panel]")) {
    button.addEventListener("click", () => setPanel(button.dataset.openPanel));
  }
  for (const button of document.querySelectorAll("[data-touch-action]")) {
    const action = button.dataset.touchAction;
    const press = (event) => {
      audio.unlock();
      if (!touchHeld[action]) queuedPresses.add(action);
      touchHeld[action] = true;
      button.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    };
    const release = (event) => {
      touchHeld[action] = false;
      event.preventDefault();
    };
    button.addEventListener("pointerdown", press);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
  }

  canvas.addEventListener("pointerdown", () => {
    audio.unlock();
    canvas.focus();
  });

  canvas.addEventListener("wheel", (event) => {
    if (phase !== "playing") return;
    camera.userZoom = clamp(camera.userZoom - event.deltaY * 0.001, 0, 1);
    event.preventDefault();
  }, { passive: false });

  let lastTime = 0;
  let accumulator = 0;
  const frame = (timestamp) => {
    pollGamepad();
    if (!lastTime) lastTime = timestamp;
    const elapsed = Math.min(WORLD.maxFrameDelta, Math.max(0, (timestamp - lastTime) / 1000));
    lastTime = timestamp;
    if (phase === "playing") {
      accumulator += elapsed;
      let steps = 0;
      while (accumulator >= WORLD.fixedStep && steps < WORLD.maxCatchUpSteps) {
        update(WORLD.fixedStep);
        accumulator -= WORLD.fixedStep;
        steps += 1;
      }
      if (steps === WORLD.maxCatchUpSteps) accumulator = 0;
    }
    render(accumulator / WORLD.fixedStep, timestamp / 1000);
    requestAnimationFrame(frame);
  };

  const debugApi = Object.freeze({
    version: () => VERSION,
    fixedStep: () => WORLD.fixedStep,
    inputActions: () => [...INPUT_ACTIONS],
    cameraLimits: () => ({ ...CAMERA_LIMITS }),
    cameraGoalFor,
    audioPanFor: (worldX) => audio.panFor(worldX),
    spawnRival,
    spawnVisitor: spawnRival,
    reset: resetGame,
    radialExplosion,
    damageSol: (amount = 1) => damageActor(
      player,
      amount,
      rival ? rival.x + rival.width / 2 : player.x + player.width + 40,
      false,
      rival?.id || "visitor",
    ),
    snapshot: () => ({
      phase,
      simulationTick,
      wind,
      camera: { ...camera },
      sol: player ? { ...player } : null,
      visitor: rival ? { ...rival } : null,
      player: player ? { ...player } : null,
      rival: rival ? { ...rival } : null,
      cloudCount: clouds.length,
      cloudDesigns: clouds.map((cloud) => cloud.design),
      cloudSpeeds: clouds.map((cloud) => cloud.speed),
      blocks: blocks.map((block) => ({ ...block })),
      projectiles: projectiles.map((shot) => ({ ...shot })),
    }),
  });
  window.__ERROR101_DEBUG__ = debugApi;
  window.__MVL_DEBUG__ = debugApi;

  renderControls();
  resetGame();
  loadAssets();
  requestAnimationFrame(frame);
})();
