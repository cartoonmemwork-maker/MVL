(() => {
  "use strict";

  const VERSION = "BETA 1.00";
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
    maxHealth: 10,
    acceleration: 2200,
    deceleration: 2800,
    walkSpeed: 220,
    crouchSpeed: 78,
    runSpeed: 350,
    gravity: 1900,
    jumpVelocity: -900,
    maxFallSpeed: 1100,
    invulnerability: 0.78,
    stompDamage: 3,
    stompBounce: -780,
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
  const CLOUD_PATTERNS = Object.freeze([
    Object.freeze([
      "       1111       ",
      "    112222211     ",
      "  1122222222211   ",
      " 1222233333222221 ",
      "122233333333322221",
      "122222222222222221",
      " 1111111111111111 ",
    ]),
    Object.freeze([
      "          111       ",
      "      112222211      ",
      "  1112222222222111   ",
      " 1222223333322222221 ",
      "122233333333332222221",
      "122222222222222222221",
      " 1111111111111111111 ",
    ]),
    Object.freeze([
      "     111        111   ",
      "  11222211   11222211 ",
      "1122222222112222222221",
      "1222333333333333322221",
      "1222222222222222222221",
      " 11111111111111111111 ",
    ]),
  ]);

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
      const stored = JSON.parse(window.localStorage.getItem("mvl-beta-1-bindings") || "null");
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
    try { window.localStorage.setItem("mvl-beta-1-bindings", JSON.stringify(bindings)); } catch { /* localStorage opcional */ }
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
  let fighterSprite = null;
  let previewNeedsDraw = true;
  let nextProjectileId = 1;
  const camera = { x: WORLD.width / 2, y: WORLD.height / 2, zoom: 1, targetX: 0, targetY: 0, targetZoom: 1 };

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
    facing: isAi ? -1 : 1,
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
    animationState: "idle",
    aiTimer: 0,
    aiFireTimer: 0.55,
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
    player = createActor("player", 170, false);
    rival = null;
    projectiles = [];
    particles = [];
    clouds = createCloud9(0x4d564c01);
    camera.x = 320;
    camera.y = 540;
    camera.zoom = CAMERA_LIMITS.soloZoom;
    camera.targetX = camera.x;
    camera.targetY = camera.y;
    camera.targetZoom = camera.zoom;
    phase = "playing";
    pauseLayer.hidden = true;
    gameStatus.textContent = "Partida reiniciada";
    showToast("ENTER · INVOCAR IA     ESC · PAUSA", 3.2);
  };

  const spawnRival = () => {
    if (rival?.health > 0) return;
    rival = createActor("rival", 1050, true);
    rival.y = 560;
    audio.play("spawn", rival.x);
    showToast("RIVAL IA INCORPORADO", 1.8);
    gameStatus.textContent = "Rival IA incorporado";
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
    if (!player || player.health <= 0 || actor.health <= 0) return edgeActions(actor, wants);
    const dx = player.x - actor.x;
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
    if (actor.aiTimer <= 0 && actor.onGround && (obstacle || gap || player.y + 40 < actor.y || distance < 90)) {
      wants.up = true;
      actor.aiTimer = 0.32 + (simulationTick % 17) / 100;
    }
    const incoming = projectiles.some((shot) => shot.active && shot.ownerId !== actor.id &&
      Math.sign(shot.vx) === Math.sign(actor.x - shot.x) && Math.abs(shot.x - actor.x) < 190 &&
      shot.y > actor.y + 24 && shot.y < actor.y + actor.height);
    if (incoming && actor.onGround && simulationTick % 3 !== 0) wants.down = true;
    actor.aiFireTimer -= WORLD.fixedStep;
    if (actor.aiFireTimer <= 0 && distance < 610 && Math.abs((player.y + player.height / 2) - (actor.y + actor.height / 2)) < 130) {
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
    actor.jumpBuffer = Math.max(0, actor.jumpBuffer - dt);
    actor.coyote = actor.onGround ? 0.09 : Math.max(0, actor.coyote - dt);

    if (actor.health <= 0) {
      actor.vx = moveToward(actor.vx, 0, ACTOR.deceleration * dt);
      actor.vy = Math.min(ACTOR.maxFallSpeed, actor.vy + ACTOR.gravity * dt);
      actor.y += actor.vy * dt;
      return;
    }

    const wantsCrouch = actions.down.held || actor.forcedCrouch > 0;
    changeCrouch(actor, wantsCrouch);
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
    actor.vy = Math.min(ACTOR.maxFallSpeed, actor.vy + ACTOR.gravity * dt);
    actor.y += actor.vy * dt;
    resolveActorVertical(actor);

    if (actor.y > WORLD.height + 240) {
      actor.health = 0;
      actor.vx = 0;
      actor.vy = 0;
      gameStatus.textContent = actor.isAi ? "La IA cayó al vacío" : "Caíste al vacío";
    }

    if (!actor.onGround) actor.animationState = actor.vy < 0 ? "jump" : "fall";
    else if (actor.crouching) actor.animationState = "crouch";
    else if (Math.abs(actor.vx) > ACTOR.walkSpeed + 20) actor.animationState = "run";
    else if (Math.abs(actor.vx) > 20) actor.animationState = "walk";
    else actor.animationState = "idle";
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
        if (block.type === "floatingBrick" && !actor.crouching) damageBlock(block, block.maxHp, actor.x + actor.width / 2);
      } else {
        const leftPenetration = actor.x + actor.width - block.x;
        const rightPenetration = block.x + block.width - actor.x;
        if (leftPenetration < rightPenetration) actor.x -= leftPenetration;
        else actor.x += rightPenetration;
        actor.vx = 0;
      }
    }
  };

  const damageActor = (actor, amount, sourceX, force = false) => {
    if (!actor || actor.health <= 0 || (!force && actor.invulnerable > 0)) return false;
    actor.health = Math.max(0, actor.health - amount);
    actor.heartFlash = 0.42;
    if (!force) actor.invulnerable = ACTOR.invulnerability;
    const direction = Math.sign(actor.x + actor.width / 2 - sourceX) || 1;
    actor.vx += direction * 130;
    actor.vy = Math.min(actor.vy, -180);
    audio.play("hit", actor.x + actor.width / 2);
    return true;
  };

  const damageBlock = (block, amount, sourceX) => {
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
      damageActor(actor, 1, sourceX ?? block.x + block.width / 2, true);
      const radial = Math.sign(actor.x + actor.width / 2 - (block.x + block.width / 2)) || (actor.id === "player" ? -1 : 1);
      actor.vx += radial * 170;
      actor.vy = -280;
      actor.onGround = false;
    }
  };

  const fireProjectile = (actor) => {
    if (actor.fireCooldown > 0 || projectiles.filter((shot) => shot.active && shot.ownerId === actor.id).length >= FIREBALL.maxActive) return;
    actor.fireCooldown = 0.18;
    const x = actor.x + actor.width / 2 + actor.facing * (actor.width / 2 + 12);
    const y = actor.y + Math.min(36, actor.height * 0.45);
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
    });
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
        spawnParticles(shot.x - shot.vx * 0.015, shot.y - shot.vy * 0.015, "#ffcc4d", 1, 35, 0.28);
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
        damageBlock(block, 1, shot.x);
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
        radialExplosion(x, y);
        break;
      }
    }

    for (const shot of projectiles) {
      if (!shot.active) continue;
      const target = shot.ownerId === "player" ? rival : player;
      if (!target || target.health <= 0) continue;
      const nearestX = clamp(shot.x, target.x, target.x + target.width);
      const nearestY = clamp(shot.y, target.y, target.y + target.height);
      const dx = shot.x - nearestX;
      const dy = shot.y - nearestY;
      if (dx * dx + dy * dy > shot.radius * shot.radius) continue;
      if (damageActor(target, 1, shot.x)) destroyProjectile(shot, true);
    }
    projectiles = projectiles.filter((shot) => shot.active);
  };

  const destroyProjectile = (shot, particlesToo) => {
    if (!shot.active) return;
    shot.active = false;
    if (particlesToo) spawnParticles(shot.x, shot.y, "#ffd45a", 8, 190);
  };

  const radialExplosion = (x, y) => {
    audio.play("clash", x);
    spawnParticles(x, y, "#fff1a8", 20, 420, 0.55);
    for (const actor of [player, rival]) {
      if (!actor || actor.health <= 0) continue;
      const dx = actor.x + actor.width / 2 - x;
      const dy = actor.y + actor.height / 2 - y;
      const distance = Math.hypot(dx, dy);
      if (distance >= FIREBALL.clashRadius) continue;
      const strength = 520 * (1 - distance / FIREBALL.clashRadius);
      const normalX = distance > 1 ? dx / distance : (actor.id === "player" ? -1 : 1);
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
    if (damageActor(target, ACTOR.stompDamage, attacker.x + attacker.width / 2)) {
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

  const cameraGoalFor = (actors) => {
    const alive = actors.filter((actor) => actor && actor.health > 0);
    if (alive.length <= 1) {
      const actor = alive[0] || player;
      return { x: actor.x + actor.width / 2, y: actor.y + actor.height / 2, zoom: CAMERA_LIMITS.soloZoom };
    }
    const centers = alive.map((actor) => ({ x: actor.x + actor.width / 2, y: actor.y + actor.height / 2 }));
    const minX = Math.min(...centers.map((point) => point.x));
    const maxX = Math.max(...centers.map((point) => point.x));
    const minY = Math.min(...centers.map((point) => point.y));
    const maxY = Math.max(...centers.map((point) => point.y));
    const zoomX = WORLD.width / (maxX - minX + 300);
    const zoomY = WORLD.height / (maxY - minY + 260);
    return {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      zoom: clamp(Math.min(zoomX, zoomY), CAMERA_LIMITS.minZoom, CAMERA_LIMITS.maxZoom),
    };
  };

  const updateCamera = (dt) => {
    const goal = cameraGoalFor([player, rival]);
    const halfWidth = WORLD.width / (2 * goal.zoom);
    const halfHeight = WORLD.height / (2 * goal.zoom);
    camera.targetX = clamp(goal.x, halfWidth, WORLD.width - halfWidth);
    camera.targetY = Math.min(goal.y + 34, WORLD.height - halfHeight);
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
    updateActor(player, actions, dt);
    if (rival) updateActor(rival, aiActions(rival), dt);
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

  const drawCloud = (cloud) => {
    const pattern = CLOUD_PATTERNS[cloud.design];
    const parallax = 0.02 + cloud.depth * 0.018;
    const zoomInfluence = 1 + (camera.zoom - 1) * (0.05 + cloud.depth * 0.035);
    const unit = 4 * cloud.scale * zoomInfluence;
    const x = cloud.x - (camera.x - WORLD.width / 2) * parallax;
    const y = cloud.y - (camera.y - WORLD.height / 2) * parallax * 0.6;
    const palette = { 1: "#d4eff8", 2: "#f7fdff", 3: "#a9d3e4" };
    ctx.save();
    ctx.globalAlpha = 0.72 + cloud.depth * 0.1;
    for (let row = 0; row < pattern.length; row += 1) {
      for (let column = 0; column < pattern[row].length; column += 1) {
        const shade = pattern[row][column];
        if (shade === " ") continue;
        ctx.fillStyle = palette[shade];
        ctx.fillRect(Math.round(x + column * unit), Math.round(y + row * unit), Math.ceil(unit), Math.ceil(unit));
      }
    }
    ctx.restore();
  };

  const drawBlock = (block) => {
    if (!block.active) return;
    const x = block.x;
    const y = block.y;
    if (block.type === "floatingBrick") {
      ctx.fillStyle = "#5a2c26";
      ctx.fillRect(x, y, 40, 40);
      ctx.fillStyle = "#e87535";
      ctx.fillRect(x + 3, y + 3, 34, 34);
      ctx.fillStyle = "#ffad55";
      ctx.fillRect(x + 5, y + 5, 30, 5);
      ctx.fillStyle = "#8f3f2b";
      ctx.fillRect(x + 18, y + 3, 4, 15);
      ctx.fillRect(x + 3, y + 18, 34, 4);
      ctx.fillRect(x + 9, y + 22, 4, 15);
      ctx.fillRect(x + 29, y + 22, 4, 15);
    } else {
      ctx.fillStyle = "#2d2830";
      ctx.fillRect(x, y, 40, 40);
      ctx.fillStyle = "#71513d";
      ctx.fillRect(x + 3, y + 3, 34, 34);
      ctx.fillStyle = "#9b7657";
      ctx.fillRect(x + 5, y + 5, 30, 6);
      ctx.fillStyle = "#44333a";
      ctx.fillRect(x + 3, y + 19, 34, 4);
      ctx.fillRect(x + 17, y + 3, 4, 16);
      ctx.fillRect(x + 9, y + 23, 4, 14);
      ctx.fillRect(x + 29, y + 23, 4, 14);
    }
    const damage = 1 - block.hp / block.maxHp;
    if (damage > 0) {
      ctx.strokeStyle = "rgba(20,15,18,.8)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x + 20, y + 7);
      ctx.lineTo(x + 17, y + 15 + damage * 6);
      ctx.lineTo(x + 24, y + 24);
      if (damage > 0.45) ctx.lineTo(x + 18, y + 34);
      ctx.stroke();
    }
  };

  const drawFallbackActor = (actor, renderX, renderY) => {
    ctx.save();
    ctx.translate(renderX + actor.width / 2, renderY + actor.height);
    if (actor.facing < 0) ctx.scale(-1, 1);
    ctx.fillStyle = actor.isAi ? "#202b3e" : "#182438";
    ctx.fillRect(-13, -62, 26, 40);
    ctx.fillStyle = "#d79a68";
    ctx.beginPath();
    ctx.arc(0, -74, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111827";
    ctx.fillRect(-12, -22, 9, 22);
    ctx.fillRect(3, -22, 9, 22);
    ctx.restore();
  };

  const drawActor = (actor, alpha, time) => {
    if (!actor || actor.health <= 0) return;
    if (actor.invulnerable > 0 && Math.floor(actor.invulnerable * 24) % 2 === 0) return;
    const x = lerp(actor.prevX, actor.x, alpha);
    const y = lerp(actor.prevY, actor.y, alpha);
    if (!fighterSprite) {
      drawFallbackActor(actor, x, y);
      return;
    }
    const idleBreath = 1 + Math.sin(time * 2.2 + (actor.isAi ? 1.2 : 0)) * 0.004;
    const height = ACTOR.visualHeight * idleBreath;
    const width = height * fighterSprite.aspect;
    ctx.save();
    ctx.translate(x + actor.width / 2, y + actor.height);
    if (actor.facing < 0) ctx.scale(-1, 1);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(fighterSprite.canvas, -width / 2, -height, width, height);
    ctx.restore();
    if (actor.isAi) {
      ctx.fillStyle = "#d94d4d";
      ctx.beginPath();
      ctx.moveTo(x + actor.width / 2, y - 8);
      ctx.lineTo(x + actor.width / 2 - 5, y - 16);
      ctx.lineTo(x + actor.width / 2 + 5, y - 16);
      ctx.closePath();
      ctx.fill();
    }
  };

  const drawProjectile = (shot, alpha) => {
    if (!shot.active) return;
    const x = lerp(shot.prevX, shot.x, alpha);
    const y = lerp(shot.prevY, shot.y, alpha);
    ctx.save();
    ctx.globalAlpha = shot.opacity;
    const gradient = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, shot.radius + 4);
    gradient.addColorStop(0, "#fffbd0");
    gradient.addColorStop(0.35, "#ffd23f");
    gradient.addColorStop(0.72, "#ff7138");
    gradient.addColorStop(1, "rgba(196,30,24,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, shot.radius + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff5a6";
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

  const heartPath = (context, x, y, size) => {
    context.beginPath();
    context.moveTo(x, y + size * 0.28);
    context.bezierCurveTo(x, y, x - size * 0.5, y, x - size * 0.5, y + size * 0.32);
    context.bezierCurveTo(x - size * 0.5, y + size * 0.62, x, y + size * 0.88, x, y + size);
    context.bezierCurveTo(x, y + size * 0.88, x + size * 0.5, y + size * 0.62, x + size * 0.5, y + size * 0.32);
    context.bezierCurveTo(x + size * 0.5, y, x, y, x, y + size * 0.28);
    context.closePath();
  };

  const drawHearts = (actor, mirrored) => {
    if (!actor) return;
    const size = 24;
    const gap = 31;
    for (let index = 0; index < 5; index += 1) {
      const value = clamp(actor.health - index * 2, 0, 2);
      const x = mirrored ? WORLD.width - 35 - index * gap : 35 + index * gap;
      const y = 24;
      ctx.save();
      heartPath(ctx, x, y, size);
      ctx.fillStyle = "rgba(7,17,31,.38)";
      ctx.fill();
      if (value > 0) {
        ctx.save();
        const fillWidth = size * (value / 2);
        if (mirrored) ctx.rect(x + size / 2 - fillWidth, y - 2, fillWidth, size + 6);
        else ctx.rect(x - size / 2, y - 2, fillWidth, size + 6);
        ctx.clip();
        heartPath(ctx, x, y, size);
        ctx.fillStyle = actor.heartFlash > 0 && Math.floor(actor.heartFlash * 22) % 2 === 0 ? "#ffffff" : "#ef4452";
        ctx.fill();
        ctx.restore();
      }
      heartPath(ctx, x, y, size);
      ctx.strokeStyle = "rgba(7,17,31,.72)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
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
    drawActor(player, alpha, time);
    drawActor(rival, alpha, time);
    ctx.restore();

    drawHearts(player, false);
    if (rival) drawHearts(rival, true);
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(7,17,31,.72)";
    ctx.font = "900 12px 'Courier New', monospace";
    ctx.fillText(`MVL · ${VERSION}`, WORLD.width / 2, 24);
    ctx.font = "900 10px 'Courier New', monospace";
    ctx.fillText(`${Math.round(ACTOR.visualHeight * camera.zoom)} PX`, WORLD.width / 2, 41);
    if (!rival) {
      ctx.fillStyle = "rgba(7,17,31,.58)";
      ctx.fillText("ENTER · INVOCAR IA", WORLD.width / 2, 62);
    }
    const winner = player.health <= 0 ? "RIVAL GANA" : rival && rival.health <= 0 ? "GANASTE" : "";
    if (winner) {
      ctx.fillStyle = "rgba(7,17,31,.72)";
      ctx.fillRect(WORLD.width / 2 - 210, WORLD.height / 2 - 55, 420, 110);
      ctx.fillStyle = "#ffffff";
      ctx.font = "900 40px 'Courier New', monospace";
      ctx.fillText(winner, WORLD.width / 2, WORLD.height / 2 + 5);
      ctx.font = "900 11px 'Courier New', monospace";
      ctx.fillText("ESC · REINICIAR", WORLD.width / 2, WORLD.height / 2 + 34);
    }
    if (previewNeedsDraw && activePanel === "character") drawCharacterPreview(time);
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
    if (fighterSprite) {
      const height = 340 * (1 + Math.sin(time * 2.2) * 0.003);
      const width = height * fighterSprite.aspect;
      previewContext.imageSmoothingEnabled = true;
      previewContext.drawImage(fighterSprite.canvas, (characterPreview.width - width) / 2, 388 - height, width, height);
    } else {
      previewContext.fillStyle = "#07111f";
      previewContext.textAlign = "center";
      previewContext.font = "900 13px 'Courier New', monospace";
      previewContext.fillText("CARGANDO PERSONAJE", characterPreview.width / 2, 210);
    }
    previewNeedsDraw = false;
  };

  const buildTransparentSprite = (image) => {
    if (!document.createElement) return;
    const source = document.createElement("canvas");
    source.width = image.naturalWidth || image.width;
    source.height = image.naturalHeight || image.height;
    const sourceContext = source.getContext("2d", { willReadFrequently: true });
    sourceContext.drawImage(image, 0, 0);
    const pixels = sourceContext.getImageData(0, 0, source.width, source.height);
    const data = pixels.data;
    let minX = source.width;
    let minY = source.height;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < source.height; y += 1) {
      for (let x = 0; x < source.width; x += 1) {
        const offset = (y * source.width + x) * 4;
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];
        const maximum = Math.max(r, g, b);
        const minimum = Math.min(r, g, b);
        const neutral = maximum - minimum < 22;
        if (neutral && minimum > 216) data[offset + 3] = 0;
        else if (neutral && minimum > 188) data[offset + 3] = Math.round(255 * (216 - minimum) / 28);
        if (data[offset + 3] > 18) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    sourceContext.putImageData(pixels, 0, 0);
    const padding = 4;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(source.width - 1, maxX + padding);
    maxY = Math.min(source.height - 1, maxY + padding);
    const output = document.createElement("canvas");
    output.width = Math.max(1, maxX - minX + 1);
    output.height = Math.max(1, maxY - minY + 1);
    output.getContext("2d").drawImage(source, minX, minY, output.width, output.height, 0, 0, output.width, output.height);
    fighterSprite = { canvas: output, aspect: output.width / output.height };
    loadingMessage.hidden = true;
    previewNeedsDraw = true;
  };

  const loadFighter = () => {
    if (typeof Image === "undefined") {
      loadingMessage.hidden = true;
      return;
    }
    const image = new Image();
    image.addEventListener("load", () => buildTransparentSprite(image));
    image.addEventListener("error", () => {
      loadingMessage.hidden = true;
      showToast("NO SE PUDO CARGAR EL SPRITE BASE", 3);
    });
    image.src = "/assets/fighter-idle.png";
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

  window.__MVL_DEBUG__ = Object.freeze({
    version: () => VERSION,
    fixedStep: () => WORLD.fixedStep,
    inputActions: () => [...INPUT_ACTIONS],
    cameraLimits: () => ({ ...CAMERA_LIMITS }),
    cameraGoalFor,
    audioPanFor: (worldX) => audio.panFor(worldX),
    spawnRival,
    reset: resetGame,
    radialExplosion,
    snapshot: () => ({
      phase,
      simulationTick,
      wind,
      camera: { ...camera },
      player: player ? { ...player } : null,
      rival: rival ? { ...rival } : null,
      cloudCount: clouds.length,
      cloudDesigns: clouds.map((cloud) => cloud.design),
      cloudSpeeds: clouds.map((cloud) => cloud.speed),
      blocks: blocks.map((block) => ({ ...block })),
      projectiles: projectiles.map((shot) => ({ ...shot })),
    }),
  });

  renderControls();
  resetGame();
  loadFighter();
  requestAnimationFrame(frame);
})();
