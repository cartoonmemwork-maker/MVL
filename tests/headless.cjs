const assert = require("node:assert/strict");
const path = require("node:path");

let now = 0;
let nextFrame = null;
const windowListeners = new Map();

const gradient = { addColorStop() {} };
const context = new Proxy({}, {
  get(target, property) {
    if (property === "createRadialGradient" || property === "createLinearGradient") return () => gradient;
    if (!(property in target)) target[property] = () => {};
    return target[property];
  },
  set(target, property, value) {
    target[property] = value;
    return true;
  },
});

class FakeElement {
  constructor() {
    this.hidden = false;
    this.textContent = "";
    this.value = "";
    this.type = "button";
    this.dataset = {};
    this.children = [];
    this.listeners = new Map();
    this.style = { setProperty() {} };
    this.classList = {
      values: new Set(),
      add: (...values) => values.forEach((value) => this.classList.values.add(value)),
      remove: (...values) => values.forEach((value) => this.classList.values.delete(value)),
      toggle: (value, force) => {
        if (force === false) this.classList.values.delete(value);
        else if (force === true || !this.classList.values.has(value)) this.classList.values.add(value);
        else this.classList.values.delete(value);
      },
      contains: (value) => this.classList.values.has(value),
    };
  }
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(callback);
  }
  dispatch(type, properties = {}) {
    for (const callback of this.listeners.get(type) || []) callback({
      stopPropagation() {}, preventDefault() {}, pointerId: 1, ...properties,
    });
  }
  append(...children) { this.children.push(...children); }
  focus() {}
  getContext() { return context; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; }
  querySelectorAll() { return []; }
}

const canvas = new FakeElement();
const gameShell = new FakeElement();
const pauseLayer = new FakeElement();
const panels = ["pause", "character", "controls"].map((name) => {
  const panel = new FakeElement();
  panel.dataset.panel = name;
  return panel;
});
const panelButtons = ["character", "controls", "pause"].map((name) => {
  const button = new FakeElement();
  button.dataset.openPanel = name;
  return button;
});
pauseLayer.querySelectorAll = (selector) => {
  if (selector === "[data-panel]") return panels;
  if (selector === "[data-open-panel]") return panelButtons;
  return [];
};
const continueButton = new FakeElement();
const restartButton = new FakeElement();
const loadingMessage = new FakeElement();
const toast = new FakeElement();
const gameStatus = new FakeElement();
const controlList = new FakeElement();
const gamepadStatus = new FakeElement();
const characterPreview = new FakeElement();

const selectorMap = {
  "#game": canvas,
  "#gameShell": gameShell,
  "#pauseLayer": pauseLayer,
  "#continueButton": continueButton,
  "#restartButton": restartButton,
  "#loadingMessage": loadingMessage,
  "#toast": toast,
  "#gameStatus": gameStatus,
  "#controlList": controlList,
  "#gamepadStatus": gamepadStatus,
  "#characterPreview": characterPreview,
};

class FakeAudioContext {
  constructor() {
    this.currentTime = 0;
    this.destination = {};
    this.state = "running";
  }
  createOscillator() {
    return {
      type: "square",
      frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {}, start() {}, stop() {},
    };
  }
  createGain() {
    return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
  }
  createStereoPanner() {
    return { pan: { setValueAtTime() {} }, connect() {} };
  }
  resume() {}
}

global.performance = { now: () => now };
global.requestAnimationFrame = (callback) => { nextFrame = callback; };
global.navigator = { getGamepads: () => [] };
global.window = {
  AudioContext: FakeAudioContext,
  localStorage: { getItem() { return null; }, setItem() {} },
  addEventListener(type, callback) {
    if (!windowListeners.has(type)) windowListeners.set(type, []);
    windowListeners.get(type).push(callback);
  },
};
global.document = {
  hidden: false,
  querySelector: (selector) => selectorMap[selector],
  querySelectorAll: (selector) => selector === "[data-touch-action]" ? [] : [],
  createElement: () => new FakeElement(),
  addEventListener() {},
};

require(path.resolve(__dirname, "../worker/source/game.js"));

const dispatchKey = (type, code) => {
  for (const listener of windowListeners.get(type) || []) {
    listener({ code, repeat: false, preventDefault() {} });
  }
};
const step = (frames = 1) => {
  for (let index = 0; index < frames; index += 1) {
    now += 1000 / 60;
    const callback = nextFrame;
    nextFrame = null;
    assert.equal(typeof callback, "function");
    callback(now);
  }
};
const tap = (code, heldFrames = 2) => {
  dispatchKey("keydown", code);
  step(heldFrames);
  dispatchKey("keyup", code);
  step(2);
};

step(2);
const debug = window.__ERROR101_DEBUG__;
assert.equal(debug.version(), "BETA 1.04");
assert.equal(debug.fixedStep(), 1 / 60);
assert.equal(debug.animationStandardFrames(), 6);
assert.deepEqual(debug.inputActions(), [
  "left", "right", "up", "down", "melee", "ranged", "guard", "run",
]);
assert.deepEqual(debug.cameraLimits(), { minZoom: 1, maxZoom: 2.5, soloZoom: 2 });

let snapshot = debug.snapshot();
assert.equal(snapshot.phase, "playing");
assert.equal(snapshot.sol.id, "sol");
assert.equal(snapshot.sol.isAi, true);
assert.equal(snapshot.sol.aiState, "neutral");
assert.equal(snapshot.sol.health, 10);
assert.equal(snapshot.sol.height, 80);
assert.equal(snapshot.visitor, null);
assert.equal(snapshot.cloudCount, 9);
assert.deepEqual(snapshot.cloudDesigns.sort(), [0, 0, 0, 1, 1, 1, 2, 2, 2]);
assert(Math.hypot(snapshot.wind.x, snapshot.wind.y) >= 10);
assert(Math.hypot(snapshot.wind.x, snapshot.wind.y) <= 86.01);
assert(snapshot.cloudOpacities.every((opacity) => opacity >= 0.48 && opacity <= 0.92));
assert(snapshot.cloudVelocities.every((velocity) =>
  Math.abs(velocity.x * snapshot.wind.y - velocity.y * snapshot.wind.x) < 0.0001 &&
  velocity.x * snapshot.wind.x + velocity.y * snapshot.wind.y > 0));
assert.equal(snapshot.blocks.filter((block) => block.type === "floatingBrick").length, 36);
assert.equal(snapshot.blocks.filter((block) => block.type === "groundBrick").length, 64);
assert.equal(snapshot.camera.zoom, 1);
assert.equal(snapshot.camera.userZoom, 0);
assert.equal(typeof snapshot.expressions.sol, "string");

debug.reset(0x1010101);
step(1);
snapshot = debug.snapshot();
const solBeforeDrag = { x: snapshot.sol.x, y: snapshot.sol.y };
canvas.dispatch("pointerdown", {
  clientX: snapshot.sol.x + snapshot.sol.width / 2,
  clientY: snapshot.sol.y + snapshot.sol.height / 2,
});
canvas.dispatch("pointermove", {
  clientX: snapshot.sol.x + snapshot.sol.width / 2 + 120,
  clientY: snapshot.sol.y + snapshot.sol.height / 2,
});
canvas.dispatch("pointerup", {
  clientX: snapshot.sol.x + snapshot.sol.width / 2 + 120,
  clientY: snapshot.sol.y + snapshot.sol.height / 2,
});
snapshot = debug.snapshot();
assert(snapshot.sol.x > solBeforeDrag.x + 100);
assert.equal(snapshot.sol.y, solBeforeDrag.y);
assert.equal(snapshot.sol.dragged, false);
assert.equal(snapshot.interaction, null);

debug.reset(0x2020202);
step(1);
canvas.dispatch("pointerdown", { clientX: 180, clientY: 260 });
canvas.dispatch("pointermove", { clientX: 60, clientY: 140 });
canvas.dispatch("pointerup", { clientX: 60, clientY: 140 });
snapshot = debug.snapshot();
assert(snapshot.blocks.some((block) => block.type === "floatingBrick" && block.column === 1 && block.row === 3));

debug.reset(0x3030303);
snapshot = debug.snapshot();
const cloudBeforeDrag = snapshot.clouds.map((cloud) => ({ x: cloud.x, y: cloud.y }));
const draggableCloud = snapshot.clouds.find((cloud) => cloud.y < 180 && (cloud.x < 90 || cloud.x > 270));
assert(draggableCloud);
canvas.dispatch("pointerdown", { clientX: draggableCloud.x, clientY: draggableCloud.y });
canvas.dispatch("pointermove", { clientX: draggableCloud.x + 70, clientY: draggableCloud.y + 30 });
canvas.dispatch("pointerup", { clientX: draggableCloud.x + 70, clientY: draggableCloud.y + 30 });
snapshot = debug.snapshot();
assert(snapshot.clouds.some((cloud, index) => Math.hypot(
  cloud.x - cloudBeforeDrag[index].x,
  cloud.y - cloudBeforeDrag[index].y,
) > 50));

const originalWind = snapshot.wind;
canvas.dispatch("pointerdown", { clientX: 1180, clientY: 520 });
canvas.dispatch("pointermove", { clientX: 1080, clientY: 560 });
canvas.dispatch("pointerup", { clientX: 1080, clientY: 560 });
snapshot = debug.snapshot();
assert(snapshot.wind.x < 0);
assert(snapshot.wind.y > 0);
assert.notDeepEqual(snapshot.wind, originalWind);

const spawnVisitor = () => {
  dispatchKey("keydown", "Enter");
  dispatchKey("keyup", "Enter");
  step(2);
};

spawnVisitor();
snapshot = debug.snapshot();
assert.equal(snapshot.visitor.id, "visitor");
assert.equal(snapshot.visitor.isAi, false);
assert.equal(snapshot.visitor.health, 10);

const startX = snapshot.visitor.x;
dispatchKey("keydown", "KeyD");
step(12);
dispatchKey("keyup", "KeyD");
snapshot = debug.snapshot();
assert(snapshot.visitor.x > startX);
assert.equal(snapshot.visitor.facing, 1);

debug.reset();
spawnVisitor();
const standingBottom = debug.snapshot().visitor.y + debug.snapshot().visitor.height;
dispatchKey("keydown", "KeyS");
step(3);
snapshot = debug.snapshot();
assert.equal(snapshot.visitor.crouching, true);
assert.equal(snapshot.visitor.height, 40);
assert.equal(snapshot.visitor.y + snapshot.visitor.height, standingBottom);
dispatchKey("keydown", "KeyD");
step(18);
snapshot = debug.snapshot();
assert(Math.abs(snapshot.visitor.vx) <= 78.01);
dispatchKey("keyup", "KeyD");
dispatchKey("keyup", "KeyS");
step(3);
assert.equal(debug.snapshot().visitor.height, 80);

debug.reset();
spawnVisitor();
tap("KeyW", 2);
assert(debug.snapshot().visitor.vy < 0);

dispatchKey("keydown", "KeyS");
step(1);
snapshot = debug.snapshot();
assert.equal(snapshot.visitor.crouching, true);
assert.equal(snapshot.visitor.fastFalling, true);
assert(snapshot.visitor.vy > 0);
assert.equal(snapshot.visitor.animationState, "fastFall");
dispatchKey("keyup", "KeyS");

debug.reset();
spawnVisitor();
tap("KeyE", 1);
step(14);
tap("KeyE", 1);
snapshot = debug.snapshot();
assert(snapshot.projectiles.filter((shot) => shot.active && shot.ownerId === "visitor").length <= 2);
assert.equal(snapshot.projectiles.find((shot) => shot.ownerId === "visitor").palette.mid, "#ffb45e");

debug.reset();
spawnVisitor();
dispatchKey("keydown", "KeyW");
step(2);
dispatchKey("keyup", "KeyW");
dispatchKey("keydown", "KeyE");
step(1);
dispatchKey("keyup", "KeyE");
snapshot = debug.snapshot();
assert.equal(snapshot.visitor.animationState, "airFire");

debug.damageSol(1);
snapshot = debug.snapshot();
assert.equal(snapshot.sol.health, 9);
assert.equal(snapshot.sol.aiState, "defensive");
assert(snapshot.sol.defenseTimer > 0);
assert.equal(snapshot.expressions.sol, "> <");
step(20);
assert.equal(debug.snapshot().expressions.sol, "! !");

debug.reset();
debug.damageSol(10);
snapshot = debug.snapshot();
assert.equal(snapshot.sol.health, 0);
assert.equal(snapshot.sol.deathBurst, true);
assert(snapshot.particleColors.includes("#e9fbff"));
assert(snapshot.particleColors.includes("#58ddff"));
assert(snapshot.particleColors.includes("#176fff"));
assert(snapshot.particleColors.every((color) => ["#77e5ff", "#e9fbff", "#58ddff", "#176fff"].includes(color)));

const closeGoal = debug.cameraGoalFor([
  { x: 500, y: 560, width: 34, height: 80, health: 10 },
  { x: 540, y: 560, width: 34, height: 80, health: 10 },
], 1);
const farGoal = debug.cameraGoalFor([
  { x: 30, y: 560, width: 34, height: 80, health: 10 },
  { x: 1210, y: 560, width: 34, height: 80, health: 10 },
], 1);
assert.equal(closeGoal.zoom, 2.5);
assert.equal(farGoal.zoom, 1);
const fullMapGoal = debug.cameraGoalFor([
  { x: 500, y: 560, width: 34, height: 80, health: 10 },
  { x: 540, y: 560, width: 34, height: 80, health: 10 },
], 0);
assert.equal(fullMapGoal.zoom, 1);

const zoomBeforeWheel = debug.snapshot().camera.userZoom;
canvas.dispatch("wheel", { deltaY: -120 });
step(2);
assert(debug.snapshot().camera.userZoom > zoomBeforeWheel);

assert(debug.audioPanFor(0) < 0);
assert(debug.audioPanFor(1280) > 0);

dispatchKey("keydown", "Escape");
dispatchKey("keyup", "Escape");
step(1);
assert.equal(debug.snapshot().phase, "paused");
continueButton.dispatch("click");
step(1);
assert.equal(debug.snapshot().phase, "playing");

console.log("ERROR 101 BETA 1.04 headless checks passed");
