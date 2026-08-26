const assert = require("node:assert/strict");
const path = require("node:path");

let now = 0;
let nextFrame = null;
const listeners = new Map();

const ctx = new Proxy(
  {},
  {
    get(target, property) {
      if (!(property in target)) target[property] = () => {};
      return target[property];
    },
    set(target, property, value) {
      target[property] = value;
      return true;
    },
  },
);

class FakeElement {
  constructor() {
    this.hidden = false;
    this.textContent = "";
    this.value = "";
    this.checked = false;
    this.type = "button";
    this.dataset = {};
    this.listeners = new Map();
    this.style = { setProperty() {} };
    this.classList = { toggle() {}, contains() { return false; } };
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
  focus() {}
  querySelectorAll() { return []; }
}
const canvas = new FakeElement();
canvas.getContext = () => ctx;
canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1280, height: 720 });
const loadingMessage = new FakeElement();
const restartButton = new FakeElement();
restartButton.hidden = true;
const menuButton = new FakeElement();
menuButton.hidden = true;
const gameStatus = new FakeElement();
const gameShell = new FakeElement();
const settingsButton = new FakeElement();
const fullscreenButton = new FakeElement();
const closeSettingsButton = new FakeElement();
const menuLayer = new FakeElement();
const screens = ["main", "play", "character", "settings", "editor"].map((screen) => {
  const element = new FakeElement();
  element.dataset.screen = screen;
  return element;
});
menuLayer.querySelectorAll = (selector) => selector === "[data-screen]" ? screens : [];
const audioParam = {
  setValueAtTime() {},
  exponentialRampToValueAtTime() {},
};
class FakeAudioContext {
  constructor() {
    this.currentTime = 0;
    this.destination = {};
    this.state = "running";
  }
  createOscillator() {
    return { frequency: audioParam, connect() {}, start() {}, stop() {}, type: "square" };
  }
  createGain() {
    return { gain: audioParam, connect() {} };
  }
  resume() {}
}

global.performance = { now: () => now };
global.requestAnimationFrame = (callback) => {
  nextFrame = callback;
};
global.window = {
  AudioContext: FakeAudioContext,
  localStorage: { getItem() { return null; }, setItem() {} },
  addEventListener(type, callback) {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(callback);
  },
};
global.document = {
  hidden: false,
  documentElement: { lang: "es" },
  fullscreenElement: null,
  querySelector(selector) {
    return {
      "#game": canvas,
      "#loadingMessage": loadingMessage,
      "#restartButton": restartButton,
      "#menuButton": menuButton,
      "#gameStatus": gameStatus,
      "#gameShell": gameShell,
      "#menuLayer": menuLayer,
      "#settingsButton": settingsButton,
      "#fullscreenButton": fullscreenButton,
      "[data-close-settings]": closeSettingsButton,
    }[selector];
  },
  querySelectorAll() { return []; },
  addEventListener() {},
};

require(path.resolve(__dirname, "../worker/source/game.js"));

const dispatch = (type, code) => {
  const event = { code, repeat: false, preventDefault() {} };
  for (const listener of listeners.get(type) || []) listener(event);
};
const step = (frames = 1) => {
  for (let index = 0; index < frames; index += 1) {
    now += 1000 / 120;
    const callback = nextFrame;
    nextFrame = null;
    assert.equal(typeof callback, "function");
    callback(now);
  }
};
const tap = (code) => {
  dispatch("keydown", code);
  step(2);
  dispatch("keyup", code);
  step(2);
};

step(2);
assert.equal(window.__MVL_DEBUG__.snapshot().state, "menu");
window.__MVL_DEBUG__.reset();
let snapshot = window.__MVL_DEBUG__.snapshot();
assert.equal(snapshot.player.height, 80);
assert.equal(snapshot.player.health, 10);
assert.equal(snapshot.player.maxHealth, 10);
assert.equal(snapshot.cloudCount, 9);
assert(snapshot.cloudSpeeds.every((speed) => Math.sign(speed) === Math.sign(snapshot.wind)));
assert.equal(snapshot.blocks.filter((block) => block.type === "floatingBrick").length, 36);
assert.equal(snapshot.blocks.filter((block) => block.type === "groundBrick").length, 64);

const appearanceCatalog = window.__MVL_DEBUG__.appearanceCatalog();
assert.deepEqual(appearanceCatalog.sex, ["male", "female"]);
assert.deepEqual(appearanceCatalog.hairStyle, ["short", "long", "bald"]);
assert.deepEqual(appearanceCatalog.topStyle, ["shortSleeve", "longSleeve", "noTop"]);
assert.deepEqual(appearanceCatalog.bottomStyle, ["shorts", "longPants", "noPants"]);
assert.deepEqual(appearanceCatalog.footwearStyle, ["sneakers", "shoes", "barefoot"]);
assert.deepEqual(appearanceCatalog.accessories, [
  "darkGlasses", "headband", "wristbands", "faceMask", "hood", "belt", "vest",
]);
const customizedAppearance = window.__MVL_DEBUG__.normalizeAppearance({
  sex: "female", hairStyle: "long", topStyle: "noTop", bottomStyle: "noPants",
  footwearStyle: "barefoot", darkGlasses: true, darkGlassesColor: "#123456",
});
assert.equal(customizedAppearance.sex, "female");
assert.equal(customizedAppearance.darkGlasses, true);
assert.equal(customizedAppearance.darkGlassesColor, "#123456");
assert.equal(window.__MVL_DEBUG__.renderAppearanceMatrix(), 162);

dispatch("keydown", "KeyD");
step(6);
assert.equal(window.__MVL_DEBUG__.snapshot().player.animationState, "run");
dispatch("keyup", "KeyD");
window.__MVL_DEBUG__.reset();
tap("Space");
assert.equal(window.__MVL_DEBUG__.snapshot().player.animationState, "jump");
window.__MVL_DEBUG__.reset();

settingsButton.dispatch("click");
assert.equal(window.__MVL_DEBUG__.snapshot().state, "paused");
closeSettingsButton.dispatch("click");
assert.equal(window.__MVL_DEBUG__.snapshot().state, "playing");

// El HUD rival refleja también las mitades, no solo el orden de los corazones.
assert.equal(window.__MVL_DEBUG__.visualHeartHalf("right", false), "right");
assert.equal(window.__MVL_DEBUG__.visualHeartHalf("right", true), "left");
assert.equal(window.__MVL_DEBUG__.visualHeartHalf("left", true), "right");

// En todas las poses terrestres al menos un pie toca la base exacta de la hitbox.
for (const offsets of [[0, 0], [-4, 4], [-1, 1], [4, -4], [1, -1]]) {
  const bottoms = window.__MVL_DEBUG__.groundedShoeBottoms(offsets);
  assert.equal(Math.max(...bottoms), 80);
  assert(bottoms.every((bottom) => bottom <= 80));
}

const standingBottom = snapshot.player.y + snapshot.player.height;
dispatch("keydown", "KeyS");
step(3);
snapshot = window.__MVL_DEBUG__.snapshot();
assert.equal(snapshot.player.crouching, true);
assert.equal(snapshot.player.height, 40);
assert.equal(snapshot.player.y + snapshot.player.height, standingBottom);
dispatch("keyup", "KeyS");
step(3);
assert.equal(window.__MVL_DEBUG__.snapshot().player.height, 80);

// Un salto normal rompe el ladrillo flotante golpeado desde abajo.
tap("Space");
step(32);
snapshot = window.__MVL_DEBUG__.snapshot();
assert.equal(
  snapshot.blocks.find((block) => block.column === 6 && block.row === 11).active,
  false,
);

// El salto agachado conserva la hitbox baja y no rompe el ladrillo.
window.__MVL_DEBUG__.reset();
dispatch("keydown", "KeyS");
step(3);
tap("Space");
step(32);
snapshot = window.__MVL_DEBUG__.snapshot();
assert.equal(snapshot.player.height, 40);
assert.equal(snapshot.player.crouchJumping, true);
assert.equal(
  snapshot.blocks.find((block) => block.column === 6 && block.row === 11).active,
  true,
);
dispatch("keyup", "KeyS");
step(120);
assert.equal(window.__MVL_DEBUG__.snapshot().player.height, 80);

// También puede agacharse después de despegar y volver a erguirse en el aire.
window.__MVL_DEBUG__.reset();
window.__MVL_DEBUG__.movePlayerToOpenSky();
tap("Space");
step(5);
dispatch("keydown", "KeyS");
step(3);
snapshot = window.__MVL_DEBUG__.snapshot();
assert.equal(snapshot.player.grounded, false);
assert.equal(snapshot.player.crouching, true);
assert.equal(snapshot.player.height, 40);
dispatch("keyup", "KeyS");
step(3);
assert.equal(window.__MVL_DEBUG__.snapshot().player.height, 80);

dispatch("keydown", "KeyW");
tap("KeyE");
dispatch("keyup", "KeyW");
snapshot = window.__MVL_DEBUG__.snapshot();
assert.equal(snapshot.fireballs[0].vx > 0, true);
assert.equal(snapshot.fireballs[0].vy < 0, true);
tap("KeyE");
tap("KeyE");
snapshot = window.__MVL_DEBUG__.snapshot();
assert.equal(snapshot.fireballsByOwner.player, 2);

window.__MVL_DEBUG__.reset();
window.__MVL_DEBUG__.spawnAI();
snapshot = window.__MVL_DEBUG__.snapshot();
assert.equal(snapshot.ai.health, 10);
assert.equal(snapshot.ai.height, 80);

const stompDefense = window.__MVL_DEBUG__.probeAIStompDefense();
assert.equal(stompDefense.crouch, true);
assert.equal(stompDefense.jumpPressed, false);
const upperProjectileDefense = window.__MVL_DEBUG__.probeAIProjectileDefense(true);
assert.equal(upperProjectileDefense.crouch, true);
const lowerProjectileDefense = window.__MVL_DEBUG__.probeAIProjectileDefense(false);
assert.equal(lowerProjectileDefense.jumpPressed, true);

assert.equal(window.__MVL_DEBUG__.damagePlayer(), true);
assert.equal(window.__MVL_DEBUG__.damagePlayer(), false);
snapshot = window.__MVL_DEBUG__.snapshot();
assert.equal(snapshot.player.health, 9);
assert(snapshot.player.invulnerability > 0);
step(102);
assert.equal(window.__MVL_DEBUG__.damagePlayer(3), true);
assert.equal(window.__MVL_DEBUG__.snapshot().player.health, 6);

window.__MVL_DEBUG__.reset();
snapshot = window.__MVL_DEBUG__.forceStomp();
assert.equal(snapshot.ai.health, 7);
assert.equal(snapshot.ai.crouching, true);
assert(snapshot.ai.forcedCrouchTimer > 0);
assert(snapshot.player.vy < 0);

window.__MVL_DEBUG__.reset();
snapshot = window.__MVL_DEBUG__.forceCrouchedStomp();
assert.equal(snapshot.ai.health, 10);
assert.equal(snapshot.ai.invulnerability, 0);
assert.equal(snapshot.ai.crouching, true);
assert(snapshot.player.vy < 0);

window.__MVL_DEBUG__.reset();
snapshot = window.__MVL_DEBUG__.destroyPlayerSupport();
assert.equal(snapshot.player.health, 9);
assert.equal(snapshot.player.grounded, false);
assert(snapshot.player.vy < 0);
assert.equal(
  snapshot.blocks.find((block) => block.column === 6 && block.row === 16).active,
  false,
);

window.__MVL_DEBUG__.reset();
snapshot = window.__MVL_DEBUG__.forceFireballClash();
assert.equal(snapshot.fireballCount, 0);
assert(snapshot.particleCount >= 18);
assert(snapshot.player.vx < 0);
assert(snapshot.ai.vx > 0);

window.__MVL_DEBUG__.reset();
snapshot = window.__MVL_DEBUG__.forceSideBounce();
assert.equal(snapshot.fireballCount, 1);
assert.equal(snapshot.fireballs[0].bounces, 1);
assert(snapshot.fireballs[0].vx < 0);
assert(snapshot.fireballs[0].opacity < 1);

window.__MVL_DEBUG__.reset();
snapshot = window.__MVL_DEBUG__.exhaustBounceBudget();
assert.equal(snapshot.fireballCount, 0);

const collisionProbe = window.__MVL_DEBUG__.resolveActorOverlap();
assert.equal(collisionProbe.overlap, false);
assert.equal(collisionProbe.snapshot.mode, "local");
assert.equal(collisionProbe.snapshot.ai.id, "player2");

window.__MVL_DEBUG__.reset();
snapshot = window.__MVL_DEBUG__.forceProjectileHitAI();
assert.equal(snapshot.ai.health, 9);
assert.equal(snapshot.fireballCount, 0);

window.__MVL_DEBUG__.reset();
snapshot = window.__MVL_DEBUG__.forceSkyFireball();
assert.equal(snapshot.fireballCount, 1);
assert(snapshot.fireballs[0].y < -120);

window.__MVL_DEBUG__.dropPlayer();
step(2);
snapshot = window.__MVL_DEBUG__.snapshot();
assert.equal(snapshot.player.health, 0);
assert.equal(snapshot.state, "defeat");

console.log(JSON.stringify({
  actorHitbox: "80px/40px",
  clouds: snapshot.cloudCount,
  fireballLimit: 2,
  aiSpawned: Boolean(snapshot.ai),
  healthPoints: 10,
  stompDamage: 3,
  projectileClash: true,
  projectileBounceBudget: 8,
  characterCollision: true,
  localPvp: true,
  voidRule: snapshot.player.health,
}));
