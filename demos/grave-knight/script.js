"use strict";

// -----------------------------------------------------------------------------
// Canvas setup / Retina scaling
// -----------------------------------------------------------------------------

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d", { alpha: false });
const VIEW_W = 960;
const VIEW_H = 540;
const GROUND_Y = 430;
let WORLD_W = 7600;

// Render quality knobs, tuned once for the device so phones keep a solid
// frame rate while desktops get denser atmosphere.
const QUALITY = { particleBudget: 48, ambientInterval: 1, dprCap: 2, shakeScale: 1 };
(function detectQuality() {
  const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  const shortEdge = Math.min(window.screen ? window.screen.width || 1024 : 1024, window.screen ? window.screen.height || 768 : 768);
  const memory = navigator.deviceMemory || 8;
  if (coarse && (shortEdge <= 480 || memory <= 4)) {
    QUALITY.particleBudget = 40;
    QUALITY.ambientInterval = 1.35;
    QUALITY.dprCap = 1.75;
    QUALITY.shakeScale = .7;
  } else if (coarse) {
    QUALITY.particleBudget = 52;
    QUALITY.ambientInterval = 1.1;
    QUALITY.shakeScale = .85;
  } else {
    QUALITY.particleBudget = 72;
    QUALITY.ambientInterval = .85;
  }
})();

let renderScaleX = 1;
let renderScaleY = 1;

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, QUALITY.dprCap);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  renderScaleX = canvas.width / VIEW_W;
  renderScaleY = canvas.height / VIEW_H;
}

window.addEventListener("resize", resizeCanvas, { passive: true });
if (window.visualViewport) window.visualViewport.addEventListener("resize", resizeCanvas, { passive: true });
resizeCanvas();

// -----------------------------------------------------------------------------
// Input
// -----------------------------------------------------------------------------

const input = {
  left: false,
  right: false,
  jumpHeld: false,
  jumpBuffer: 0,
  attackQueued: false,
  attackHeld: false,
  attackPressedThisFrame: false,
  attackHoldTime: 0,
  autofireCooldown: 0,
  autofireActive: false
};

const touchButtons = document.querySelectorAll(".touch-button");
const touchPointerOwners = new Map();
const heldKeyboardControls = new Set();

function isKeyboardActionHeld(action) {
  if (action === "left") return heldKeyboardControls.has("KeyA") || heldKeyboardControls.has("ArrowLeft");
  if (action === "right") return heldKeyboardControls.has("KeyD") || heldKeyboardControls.has("ArrowRight");
  if (action === "jump") return heldKeyboardControls.has("KeyW") || heldKeyboardControls.has("ArrowUp") || heldKeyboardControls.has("Space");
  if (action === "attack") return heldKeyboardControls.has("KeyJ") || heldKeyboardControls.has("KeyX");
  return false;
}

function isTouchActionHeld(action) {
  for (const button of touchPointerOwners.keys()) {
    if (button.dataset.action === action) return true;
  }
  return false;
}

const controlKeys = new Set([
  "KeyA", "KeyD", "KeyW", "ArrowLeft", "ArrowRight", "ArrowUp",
  "Space", "KeyJ", "KeyX", "KeyR", "KeyP", "Escape"
]);

function queueAction(action) {
  if (action === "jump") input.jumpBuffer = 0.12;
  if (action === "attack") {
    input.attackQueued = true;
    input.attackPressedThisFrame = true;
  }
}

function releaseAttackInput() {
  input.attackHeld = false;
  input.attackHoldTime = 0;
  input.autofireCooldown = 0;
  input.autofireActive = false;
}

function clearTouchButtonState(button) {
  const action = button.dataset.action;
  const pointerId = touchPointerOwners.get(button);
  touchPointerOwners.delete(button);
  button.classList.remove("pressed");
  button.setAttribute("aria-pressed", "false");
  if (pointerId !== undefined) {
    try {
      if (button.hasPointerCapture(pointerId)) button.releasePointerCapture(pointerId);
    } catch (_error) {
      // The browser may already have released capture during an interruption.
    }
  }
  if (action === "left" || action === "right") input[action] = false;
  if (action === "jump") input.jumpHeld = false;
}

function cancelTransientControls(clearQueuedActions = true) {
  for (const button of touchButtons) clearTouchButtonState(button);
  heldKeyboardControls.clear();
  input.left = false;
  input.right = false;
  input.jumpHeld = false;
  if (clearQueuedActions) {
    input.jumpBuffer = 0;
    input.attackQueued = false;
    input.attackPressedThisFrame = false;
  }
  releaseAttackInput();
}

window.addEventListener("keydown", (event) => {
  if (controlKeys.has(event.code)) event.preventDefault();
  unlockAudio();
  if (game.mode === "title") {
    if (!event.repeat && (event.code === "Enter" || event.code === "Space")) startFromTitle(0);
    return;
  }
  if (!event.repeat && (event.code === "KeyP" || event.code === "Escape")) {
    togglePause();
    return;
  }
  if (!event.repeat && event.code === "KeyR") {
    restartLevel();
    return;
  }
  if (game.mode !== "running") return;
  if (event.code === "KeyA" || event.code === "ArrowLeft") {
    heldKeyboardControls.add(event.code);
    input.left = true;
  }
  if (event.code === "KeyD" || event.code === "ArrowRight") {
    heldKeyboardControls.add(event.code);
    input.right = true;
  }
  if (event.code === "KeyW" || event.code === "ArrowUp" || event.code === "Space") {
    heldKeyboardControls.add(event.code);
    input.jumpHeld = true;
    if (!event.repeat) queueAction("jump");
  }
  if (event.code === "KeyJ" || event.code === "KeyX") {
    heldKeyboardControls.add(event.code);
    input.attackHeld = true;
    if (!event.repeat) queueAction("attack");
  }
});

window.addEventListener("keyup", (event) => {
  heldKeyboardControls.delete(event.code);
  if (event.code === "KeyA" || event.code === "ArrowLeft") input.left = isKeyboardActionHeld("left") || isTouchActionHeld("left");
  if (event.code === "KeyD" || event.code === "ArrowRight") input.right = isKeyboardActionHeld("right") || isTouchActionHeld("right");
  if ((event.code === "KeyJ" || event.code === "KeyX") && !isKeyboardActionHeld("attack") && !isTouchActionHeld("attack")) releaseAttackInput();
  if (event.code === "KeyW" || event.code === "ArrowUp" || event.code === "Space") {
    input.jumpHeld = isKeyboardActionHeld("jump") || isTouchActionHeld("jump");
    if (!input.jumpHeld && player.vy < -120) player.vy *= 0.48;
  }
});

window.addEventListener("blur", () => {
  cancelTransientControls(true);
  if (game.mode === "running" || game.mode === "bossIntro" || game.mode === "campaignBossIntro") setPaused(true);
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) cancelTransientControls(true);
});

window.addEventListener("pagehide", () => cancelTransientControls(true));
window.addEventListener("orientationchange", () => {
  cancelTransientControls(true);
  resizeCanvas();
}, { passive: true });

// -----------------------------------------------------------------------------
// Shared helpers and game state
// -----------------------------------------------------------------------------

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, amount) => a + (b - a) * amount;
const approach = (value, target, amount) => value < target ? Math.min(value + amount, target) : Math.max(value - amount, target);
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function seededNoise(index) {
  const value = Math.sin(index * 91.733 + 17.21) * 43758.5453;
  return value - Math.floor(value);
}

const game = {
  mode: "running",
  time: 0,
  score: 0,
  cameraX: 0,
  shake: 0,
  flash: 0,
  hitStop: 0,
  endTimer: 0,
  endVictory: false,
  weaponToastTimer: 0,
  bossSpawned: false,
  bossDefeated: false,
  bossPhase: 1,
  bossIntroTime: 0,
  bossIntroCharacters: 0,
  bossIntroFadeStarted: 0,
  bossSpeechComplete: false,
  bossIntroTriggerCount: 0,
  arenaLocked: false,
  arenaGateProgress: 0,
  pizzaSequenceActive: false,
  pizzaPendingSpawns: 0,
  pizzaNextSpawnTimer: -1,
  pizzaSpawnOrdinal: 0,
  pizzaFirstThrowDialogueTriggered: false,
  lastPizzaDialogueEvent: "none",
  lastPizzaProjectileResult: "none",
  pausedFrom: "running",
  ambientPulse: 0,
  environmentTimer: 0,
  spawnCursor: 0,
  currentLevel: 0,
  levelTime: 0,
  levelStartScore: 0,
  highestUnlockedLevel: 0,
  checkpointId: null,
  checkpointX: 120,
  checkpointScore: 0,
  checkpointPulse: 0,
  safeAnchorX: 120,
  exitState: "idle",
  exitTimer: 0,
  transitionTarget: -1,
  transitionTimer: 0,
  survivalState: "idle",
  survivalTimer: 0,
  survivalWave: 0,
  blackoutProgress: 0,
  rangedNextShotAt: 0,
  rangedLastWraithShotAt: -99,
  rangedLastGunnerShotAt: -99,
  rangedLastShooterId: 0,
  rangedShotsFired: 0,
  levelArenaLeft: 0,
  levelArenaRight: 0,
  lightning: 0,
  fallPenaltyReady: true,
  activeBossProfile: null,
  bossEncounterState: "idle",
  bossAttackSerial: 0,
  bossIntroSequenceStep: 0,
  bossIntroLineStarted: false,
  bossIntroCompletionRequested: false,
  bossIntroCompletionGuard: false,
  bossIntroFallbackTimerId: 0,
  bossIntroFallbackTimerActive: false,
  bossVictoryPending: false,
  vehicleAttackActive: false,
  nextLevelReady: false,
  lastTransitionError: "none",
  lastResetReason: "startup",
  lastClearedProjectileReason: "none",
  gameLoopCount: 1,
  levelAmuletState: "consumed",
  levelAmuletSpawnCount: 0,
  amuletCollectedThisAttempt: false,
  amuletShatteredThisAttempt: false,
  soulCoinsCollectedThisLevel: 0,
  soulCoinScoreThisLevel: 0,
  eliteSpawnedThisLevel: false,
  lastCoinDropEnemyType: "none",
  lastCoinSoundAt: -99
};

const CAMPAIGN_STORAGE_KEY = "graveKnightCampaignV1";
const LEVEL_DEFINITIONS = Object.freeze([
  {
    name: "MOONLIT CEMETERY", worldWidth: 7600, focus: "The existing VELKO encounter",
    bossProfile: "velko1", maxEnemies: 6, checkpoint: { id: "hollowLantern", name: "Hollow Lantern", x: 6200 }, exitX: 0, spawnPlan: null, obstacles: [], crates: [], gaps: [], stones: [], safeAnchors: []
  },
  {
    name: "THE LANTERN MARSH", worldWidth: 5600, focus: "Movement, spacing, and readable ranged pressure",
    bossProfile: "todorMarsh", maxEnemies: 4, checkpoint: { id: "marshLantern", name: "Marsh Lantern", x: 2760 }, exitX: 5280,
    spawnPlan: [
      { trigger: 520, type: "dead", x: 850 }, { trigger: 980, type: "lanternWraith", x: 1320 },
      { trigger: 1420, type: "dead", x: 1690 }, { trigger: 1800, type: "bone", x: 2140 },
      { trigger: 2360, type: "lanternWraith", x: 2660 }, { trigger: 2860, type: "dead", x: 3150 },
      { trigger: 3300, type: "lanternWraith", x: 3660 }, { trigger: 3650, type: "dead", x: 3970 },
      { trigger: 4140, type: "bone", x: 4460 }, { trigger: 4520, type: "lanternWraith", x: 4860 },
      { trigger: 4740, type: "dead", x: 5050 }
    ],
    obstacles: [{ x: 720, y: 384, w: 72, h: 46, style: 0 }, { x: 1580, y: 370, w: 64, h: 60, style: 2 }, { x: 3370, y: 378, w: 76, h: 52, style: 0 }, { x: 4570, y: 367, w: 58, h: 63, style: 1 }],
    crates: [], gaps: [], stones: [], safeAnchors: []
  },
  {
    name: "THE BONE MARKET", worldWidth: 5700, focus: "Close-quarters combat, positioning, and facing",
    bossProfile: "velkoMarket", maxEnemies: 5, checkpoint: { id: "marketShrine", name: "Market Shrine", x: 2820 }, exitX: 5360,
    spawnPlan: [
      { trigger: 520, type: "dead", x: 790 }, { trigger: 900, type: "shieldUndead", x: 1210 },
      { trigger: 1430, type: "dead", x: 1700 }, { trigger: 1760, type: "bone", x: 2070 },
      { trigger: 2260, type: "shieldUndead", x: 2560 }, { trigger: 2900, type: "dead", x: 3200 },
      { trigger: 3300, type: "lanternWraith", x: 3620 }, { trigger: 3700, type: "dead", x: 3980 },
      { trigger: 4140, type: "bone", x: 4480 }, { trigger: 4580, type: "shieldUndead", x: 4910 },
      { trigger: 4850, type: "dead", x: 5120 }
    ],
    obstacles: [{ x: 1840, y: 380, w: 58, h: 50, style: 1 }, { x: 3890, y: 375, w: 70, h: 55, style: 0 }],
    crates: [{ x: 660, broken: false, loot: "score" }, { x: 1500, broken: false, loot: "soul" }, { x: 2450, broken: false, loot: "dagger" }, { x: 3500, broken: false, loot: "score" }, { x: 4680, broken: false, loot: "torch" }],
    gaps: [], stones: [], safeAnchors: []
  },
  {
    name: "THE RUSTED VIADUCT", worldWidth: 5900, focus: "Forward momentum, precise jumping, and telegraphed danger",
    bossProfile: "todorViaduct", maxEnemies: 4, checkpoint: { id: "viaductBeacon", name: "Viaduct Beacon", x: 3000 }, exitX: 5550,
    spawnPlan: [
      { trigger: 520, type: "dead", x: 850 }, { trigger: 1250, type: "bone", x: 1510 },
      { trigger: 2050, type: "lanternWraith", x: 2390 }, { trigger: 2740, type: "dead", x: 3050 },
      { trigger: 3550, type: "bone", x: 3860 }, { trigger: 4210, type: "shieldUndead", x: 4540 },
      { trigger: 4900, type: "dead", x: 5200 }
    ],
    obstacles: [], crates: [],
    gaps: [{ x: 980, w: 112 }, { x: 1710, w: 132 }, { x: 3280, w: 118 }, { x: 4050, w: 142 }, { x: 5000, w: 126 }],
    stones: [{ trigger: 620, x: 880 }, { trigger: 1320, x: 1550 }, { trigger: 2220, x: 2490 }, { trigger: 3470, x: 3740 }, { trigger: 4380, x: 4650 }, { trigger: 5120, x: 5350 }],
    safeAnchors: [120, 1135, 1885, 3425, 4235, 5160]
  },
  {
    name: "BLACKOUT BOULEVARD", worldWidth: 6100, focus: "Fast timing, survival pressure, and preparation",
    bossProfile: "velkoFinal", maxEnemies: 5, checkpoint: { id: "blackoutStreetlamp", name: "Blackout Streetlamp", x: 3100 }, exitX: 5780,
    spawnPlan: [
      { trigger: 500, type: "dead", x: 810 }, { trigger: 900, type: "boulevardGhoul", x: 1220 },
      { trigger: 1420, type: "bone", x: 1740 }, { trigger: 1900, type: "boulevardGhoul", x: 2240 },
      { trigger: 2500, type: "lanternWraith", x: 2810 }, { trigger: 3200, type: "dead", x: 3500 },
      { trigger: 4050, type: "lanternWraith", x: 4420 }
    ],
    obstacles: [{ x: 1650, y: 382, w: 62, h: 48, style: 0 }, { x: 3470, y: 375, w: 70, h: 55, style: 1 }],
    crates: [], gaps: [], stones: [], safeAnchors: []
  },
  {
    name: "THE ASHEN RAIL YARD", theme: "railYard", worldWidth: 6000, focus: "Readable cover and the first Grave Gunner",
    bossProfile: "todorRail", maxEnemies: 5, checkpoint: { id: "ashenSignalBeacon", name: "Ashen Signal Beacon", x: 3000 }, exitX: 5660,
    spawnPlan: [
      { trigger: 500, type: "dead", x: 810 }, { trigger: 860, type: "graveGunner", x: 1190 },
      { trigger: 1320, type: "bone", x: 1630 }, { trigger: 1780, type: "dead", x: 2090 },
      { trigger: 2280, type: "shieldUndead", x: 2590 }, { trigger: 2780, type: "graveGunner", x: 3160 },
      { trigger: 3350, type: "dead", x: 3670 }, { trigger: 3860, type: "bone", x: 4180 },
      { trigger: 4380, type: "graveGunner", x: 4770 }, { trigger: 4920, type: "dead", x: 5260 }
    ],
    obstacles: [{ x: 1460, y: 374, w: 84, h: 56, style: 0 }, { x: 3270, y: 370, w: 92, h: 60, style: 1 }, { x: 4720, y: 378, w: 78, h: 52, style: 0 }],
    crates: [{ x: 2180, broken: false, loot: "score" }, { x: 4050, broken: false, loot: "torch" }], gaps: [], stones: [], safeAnchors: []
  },
  {
    name: "CATHEDRAL OF STATIC", theme: "cathedral", worldWidth: 6100, focus: "Faster staggered Wraith fire and open vertical routes",
    bossProfile: "velkoCathedral", maxEnemies: 5, checkpoint: { id: "staticChapelLantern", name: "Static Chapel Lantern", x: 3050 }, exitX: 5750,
    spawnPlan: [
      { trigger: 500, type: "dead", x: 800 }, { trigger: 900, type: "lanternWraith", x: 1240 },
      { trigger: 1380, type: "bone", x: 1690 }, { trigger: 1840, type: "lanternWraith", x: 2210 },
      { trigger: 2350, type: "shieldUndead", x: 2680 }, { trigger: 2890, type: "dead", x: 3240 },
      { trigger: 3420, type: "lanternWraith", x: 3810 }, { trigger: 3970, type: "bone", x: 4320 },
      { trigger: 4540, type: "lanternWraith", x: 4970 }, { trigger: 5100, type: "dead", x: 5440 }
    ],
    obstacles: [{ x: 1120, y: 350, w: 66, h: 80, style: 2 }, { x: 2480, y: 356, w: 70, h: 74, style: 2 }, { x: 4200, y: 348, w: 72, h: 82, style: 2 }],
    crates: [{ x: 1760, broken: false, loot: "dagger" }, { x: 3550, broken: false, loot: "soul" }], gaps: [], stones: [], safeAnchors: []
  },
  {
    name: "THE GILDED FLOODWAY", theme: "floodway", worldWidth: 6200, focus: "Open mixed ranged combat under strict threat budgeting",
    bossProfile: "todorFloodway", maxEnemies: 5, checkpoint: { id: "floodwayVaultLamp", name: "Floodway Vault Lamp", x: 3100 }, exitX: 5850,
    spawnPlan: [
      { trigger: 520, type: "graveGunner", x: 850 }, { trigger: 980, type: "dead", x: 1300 },
      { trigger: 1450, type: "lanternWraith", x: 1810 }, { trigger: 1970, type: "bone", x: 2290 },
      { trigger: 2470, type: "graveGunner", x: 2810 }, { trigger: 3000, type: "shieldUndead", x: 3380 },
      { trigger: 3560, type: "lanternWraith", x: 3990 }, { trigger: 4120, type: "dead", x: 4470 },
      { trigger: 4660, type: "graveGunner", x: 5110 }, { trigger: 5200, type: "bone", x: 5530 }
    ],
    obstacles: [{ x: 1620, y: 378, w: 90, h: 52, style: 1 }, { x: 3670, y: 376, w: 86, h: 54, style: 0 }],
    crates: [{ x: 1080, broken: false, loot: "score" }, { x: 2720, broken: false, loot: "torch" }, { x: 4750, broken: false, loot: "soul" }], gaps: [], stones: [], safeAnchors: []
  },
  {
    name: "OSSUARY OBSERVATORY", theme: "observatory", worldWidth: 6300, focus: "Vertical stone rhythm and fast readable Wraith fire",
    bossProfile: "velkoObservatory", maxEnemies: 6, checkpoint: { id: "observatoryReliquary", name: "Observatory Reliquary", x: 3150 }, exitX: 5940,
    spawnPlan: [
      { trigger: 500, type: "lanternWraith", x: 850 }, { trigger: 980, type: "bone", x: 1290 },
      { trigger: 1460, type: "graveGunner", x: 1850 }, { trigger: 2010, type: "dead", x: 2350 },
      { trigger: 2520, type: "lanternWraith", x: 2890 }, { trigger: 3090, type: "shieldUndead", x: 3480 },
      { trigger: 3650, type: "graveGunner", x: 4090 }, { trigger: 4210, type: "lanternWraith", x: 4670 },
      { trigger: 4780, type: "bone", x: 5250 }, { trigger: 5350, type: "dead", x: 5660 }
    ],
    obstacles: [{ x: 930, y: 345, w: 74, h: 85, style: 2 }, { x: 2210, y: 362, w: 84, h: 68, style: 0 }, { x: 3860, y: 342, w: 76, h: 88, style: 2 }, { x: 5140, y: 360, w: 86, h: 70, style: 1 }],
    crates: [{ x: 1710, broken: false, loot: "dagger" }, { x: 4550, broken: false, loot: "score" }], gaps: [], stones: [], safeAnchors: []
  },
  {
    name: "NEON FUNERAL DISTRICT", theme: "neon", worldWidth: 6400, focus: "Readable mixed waves of Gunners, Wraiths, and Ghouls",
    bossProfile: "todorNeon", maxEnemies: 6, checkpoint: { id: "neonFuneralStreetlamp", name: "Neon Funeral Streetlamp", x: 3200 }, exitX: 6040,
    spawnPlan: [
      { trigger: 500, type: "boulevardGhoul", x: 810 }, { trigger: 920, type: "graveGunner", x: 1280 },
      { trigger: 1420, type: "lanternWraith", x: 1800 }, { trigger: 1940, type: "dead", x: 2320 },
      { trigger: 2460, type: "boulevardGhoul", x: 2860 }, { trigger: 2990, type: "graveGunner", x: 3430 },
      { trigger: 3560, type: "shieldUndead", x: 3980 }, { trigger: 4110, type: "lanternWraith", x: 4580 },
      { trigger: 4700, type: "graveGunner", x: 5230 }, { trigger: 5310, type: "boulevardGhoul", x: 5680 }
    ],
    obstacles: [{ x: 1580, y: 382, w: 76, h: 48, style: 0 }, { x: 3370, y: 372, w: 88, h: 58, style: 1 }, { x: 4920, y: 380, w: 80, h: 50, style: 0 }],
    crates: [{ x: 2180, broken: false, loot: "soul" }, { x: 4320, broken: false, loot: "torch" }], gaps: [], stones: [], safeAnchors: []
  },
  {
    name: "THE WRAITH FOUNDRY", theme: "foundry", worldWidth: 6500, focus: "High but controlled industrial ranged pressure",
    bossProfile: "velkoFoundry", maxEnemies: 6, checkpoint: { id: "foundrySoulFurnace", name: "Foundry Soul Furnace", x: 3250 }, exitX: 6140,
    spawnPlan: [
      { trigger: 520, type: "lanternWraith", x: 860 }, { trigger: 980, type: "graveGunner", x: 1360 },
      { trigger: 1510, type: "bone", x: 1900 }, { trigger: 2040, type: "lanternWraith", x: 2450 },
      { trigger: 2580, type: "shieldUndead", x: 3020 }, { trigger: 3150, type: "graveGunner", x: 3610 },
      { trigger: 3720, type: "lanternWraith", x: 4230 }, { trigger: 4310, type: "dead", x: 4790 },
      { trigger: 4890, type: "graveGunner", x: 5480 }, { trigger: 5520, type: "bone", x: 5860 }
    ],
    obstacles: [{ x: 1210, y: 352, w: 80, h: 78, style: 2 }, { x: 2800, y: 374, w: 92, h: 56, style: 0 }, { x: 4610, y: 350, w: 82, h: 80, style: 2 }],
    crates: [{ x: 2050, broken: false, loot: "torch" }, { x: 3900, broken: false, loot: "score" }], gaps: [], stones: [], safeAnchors: []
  },
  {
    name: "VELVET UNDERPASS", theme: "velvet", worldWidth: 6600, focus: "Late-game cover discipline with protected escape routes",
    bossProfile: "todorVelvet", maxEnemies: 6, checkpoint: { id: "velvetPassageShrine", name: "Velvet Passage Shrine", x: 3300 }, exitX: 6240,
    spawnPlan: [
      { trigger: 520, type: "graveGunner", x: 870 }, { trigger: 1020, type: "shieldUndead", x: 1400 },
      { trigger: 1560, type: "lanternWraith", x: 1980 }, { trigger: 2110, type: "dead", x: 2520 },
      { trigger: 2670, type: "graveGunner", x: 3130 }, { trigger: 3250, type: "boulevardGhoul", x: 3740 },
      { trigger: 3850, type: "lanternWraith", x: 4370 }, { trigger: 4450, type: "graveGunner", x: 5050 },
      { trigger: 5100, type: "shieldUndead", x: 5620 }, { trigger: 5680, type: "dead", x: 5960 }
    ],
    obstacles: [{ x: 1500, y: 370, w: 88, h: 60, style: 1 }, { x: 3460, y: 376, w: 84, h: 54, style: 0 }, { x: 5280, y: 368, w: 90, h: 62, style: 1 }],
    crates: [{ x: 2380, broken: false, loot: "dagger" }, { x: 4580, broken: false, loot: "soul" }], gaps: [], stones: [], safeAnchors: []
  },
  {
    name: "THE CROWN OF GRAVES", theme: "crown", worldWidth: 6700, focus: "Storm-driven terrain rhythm before the final act",
    bossProfile: "velkoCrown", maxEnemies: 6, checkpoint: { id: "crownGraveBeacon", name: "Crown Grave Beacon", x: 3350 }, exitX: 6340,
    spawnPlan: [
      { trigger: 500, type: "lanternWraith", x: 850 }, { trigger: 980, type: "bone", x: 1340 },
      { trigger: 1500, type: "graveGunner", x: 1920 }, { trigger: 2070, type: "shieldUndead", x: 2490 },
      { trigger: 2640, type: "lanternWraith", x: 3100 }, { trigger: 3240, type: "boulevardGhoul", x: 3730 },
      { trigger: 3860, type: "graveGunner", x: 4380 }, { trigger: 4490, type: "lanternWraith", x: 5050 },
      { trigger: 5150, type: "bone", x: 5680 }, { trigger: 5760, type: "dead", x: 6100 }
    ],
    obstacles: [{ x: 1040, y: 340, w: 78, h: 90, style: 2 }, { x: 2390, y: 354, w: 88, h: 76, style: 2 }, { x: 4050, y: 338, w: 80, h: 92, style: 2 }, { x: 5480, y: 350, w: 86, h: 80, style: 2 }],
    crates: [{ x: 1820, broken: false, loot: "score" }, { x: 4740, broken: false, loot: "torch" }], gaps: [], stones: [], safeAnchors: []
  },
  {
    name: "BLACK LEDGER CITADEL", theme: "citadel", worldWidth: 6800, focus: "Final TODOR domain with disciplined late-game pressure",
    bossProfile: "todorCitadel", maxEnemies: 7, checkpoint: { id: "ledgerVaultTerminal", name: "Ledger Vault Terminal", x: 3400 }, exitX: 6440,
    spawnPlan: [
      { trigger: 520, type: "graveGunner", x: 880 }, { trigger: 1000, type: "lanternWraith", x: 1410 },
      { trigger: 1540, type: "graveGunner", x: 2000 }, { trigger: 2120, type: "shieldUndead", x: 2580 },
      { trigger: 2700, type: "boulevardGhoul", x: 3200 }, { trigger: 3300, type: "lanternWraith", x: 3830 },
      { trigger: 3930, type: "graveGunner", x: 4500 }, { trigger: 4580, type: "bone", x: 5140 },
      { trigger: 5230, type: "lanternWraith", x: 5800 }, { trigger: 5850, type: "graveGunner", x: 6200 }
    ],
    obstacles: [{ x: 1320, y: 372, w: 92, h: 58, style: 1 }, { x: 3020, y: 376, w: 86, h: 54, style: 0 }, { x: 4860, y: 370, w: 94, h: 60, style: 1 }],
    crates: [{ x: 2320, broken: false, loot: "soul" }, { x: 4200, broken: false, loot: "dagger" }, { x: 5550, broken: false, loot: "torch" }], gaps: [], stones: [], safeAnchors: []
  },
  {
    name: "THE LAST CITY OF STONE", theme: "lastCity", worldWidth: 7000, focus: "Final fusion of cemetery and ruined city combat",
    bossProfile: "velkoLastCity", maxEnemies: 7, checkpoint: { id: "lastCityMemorialFlame", name: "Last City Memorial Flame", x: 3500 }, exitX: 6640,
    spawnPlan: [
      { trigger: 520, type: "graveGunner", x: 900 }, { trigger: 1040, type: "lanternWraith", x: 1450 },
      { trigger: 1590, type: "boulevardGhoul", x: 2050 }, { trigger: 2180, type: "shieldUndead", x: 2640 },
      { trigger: 2770, type: "graveGunner", x: 3280 }, { trigger: 3390, type: "lanternWraith", x: 3920 },
      { trigger: 4030, type: "bone", x: 4580 }, { trigger: 4680, type: "graveGunner", x: 5260 },
      { trigger: 5360, type: "lanternWraith", x: 5930 }, { trigger: 6020, type: "boulevardGhoul", x: 6380 }
    ],
    obstacles: [{ x: 1180, y: 342, w: 82, h: 88, style: 2 }, { x: 2820, y: 368, w: 96, h: 62, style: 0 }, { x: 4510, y: 340, w: 84, h: 90, style: 2 }, { x: 5940, y: 366, w: 98, h: 64, style: 1 }],
    crates: [{ x: 1880, broken: false, loot: "torch" }, { x: 3700, broken: false, loot: "soul" }, { x: 5480, broken: false, loot: "dagger" }], gaps: [], stones: [], safeAnchors: []
  }
]);
const LEVEL_AMULET_PLACEMENTS = Object.freeze([
  { x: 560, site: "grave edge" },
  { x: 1540, site: "marsh altar" },
  { x: 690, site: "market stall" },
  { x: 2920, site: "rail beacon" },
  { x: 2870, site: "street shrine" },
  { x: 2080, site: "rail platform" },
  { x: 1680, site: "chapel plinth" },
  { x: 2640, site: "flooded ledge" },
  { x: 3370, site: "observatory dais" },
  { x: 2100, site: "funeral kiosk" },
  { x: 1980, site: "forge platform" },
  { x: 2300, site: "vault pedestal" },
  { x: 3290, site: "ruined beacon" },
  { x: 2250, site: "ledger shrine" },
  { x: 3430, site: "memorial altar" }
]);
const CAMPAIGN_SKY_PALETTES = Object.freeze({
  1: ["#070b20", "#172440", "#273342"],
  2: ["#100d18", "#2b2130", "#403735"],
  3: ["#080d1c", "#202a3c", "#38414a"],
  4: ["#050811", "#141b2c", "#242b38"],
  5: ["#0d0d12", "#28232a", "#4a3027"],
  6: ["#070a13", "#17223a", "#30384c"],
  7: ["#070b12", "#142631", "#303b3b"],
  8: ["#080916", "#1c2238", "#353a50"],
  9: ["#090612", "#21142d", "#392945"],
  10: ["#0c090d", "#2d1c1a", "#573126"],
  11: ["#09070d", "#22182a", "#3b2c3d"],
  12: ["#070a13", "#18223a", "#333d52"],
  13: ["#08090e", "#1d2029", "#3c332d"],
  14: ["#05070d", "#141c2a", "#2c3541"]
});
const CAMPAIGN_VISUAL_STYLES = Object.freeze({
  railYard: { ground: ["#302b2a", "#100e10"], edge: "#7a5d4c", accent: "#d07a48", secondary: "#798890" },
  cathedral: { ground: ["#252a35", "#0d1018"], edge: "#667e99", accent: "#83bfe0", secondary: "#737895" },
  floodway: { ground: ["#252f31", "#091417"], edge: "#927a4f", accent: "#d0aa62", secondary: "#5f8992" },
  observatory: { ground: ["#2c2d3a", "#0e101a"], edge: "#777d9b", accent: "#a9c9df", secondary: "#80759d" },
  neon: { ground: ["#24232d", "#0b0911"], edge: "#74517d", accent: "#c174ba", secondary: "#d18a55" },
  foundry: { ground: ["#352a27", "#120d0d"], edge: "#87533e", accent: "#dc7545", secondary: "#806d63" },
  velvet: { ground: ["#29202c", "#0d0910"], edge: "#7e665a", accent: "#c79a62", secondary: "#745276" },
  crown: { ground: ["#2b303b", "#0d111a"], edge: "#6e8294", accent: "#9ec8dc", secondary: "#77718e" },
  citadel: { ground: ["#292a2f", "#0b0b0f"], edge: "#8c7450", accent: "#d0a766", secondary: "#6f7782" },
  lastCity: { ground: ["#292e35", "#090d13"], edge: "#637f8a", accent: "#9dcbd6", secondary: "#79414b" }
});
// Campaign acts: each act carries its own atmosphere so the world visibly
// decays as the knight descends. Boundaries align with the existing
// "ACT I COMPLETE" break after level index 4.
const ACT_ATMOSPHERE = Object.freeze([
  { firstLevel: 0, lastLevel: 4, title: "ACT I", name: "THE CURSED OUTSKIRTS", vignette: .78, groundFog: .055, fogColor: "176,196,199", corruption: 0 },
  { firstLevel: 5, lastLevel: 9, title: "ACT II", name: "THE ASHEN CITY", vignette: .84, groundFog: .08, fogColor: "155,143,138", corruption: .05 },
  { firstLevel: 10, lastLevel: 12, title: "ACT III", name: "THE CRIMSON DEPTHS", vignette: .88, groundFog: .1, fogColor: "150,112,112", corruption: .12 },
  { firstLevel: 13, lastLevel: 14, title: "ACT IV", name: "THE LAST GRAVE", vignette: .92, groundFog: .125, fogColor: "136,96,106", corruption: .2 }
]);
function currentAct(levelIndex = game.currentLevel) {
  return ACT_ATMOSPHERE.find((act) => levelIndex >= act.firstLevel && levelIndex <= act.lastLevel) || ACT_ATMOSPHERE[0];
}
// Encounter archetypes give each level a distinct combat identity instead of
// "same enemies, bigger numbers". Modifiers multiply the difficulty-band
// values inside spawnEnemy / buildActiveSpawnPlan.
const ENCOUNTER_ARCHETYPES = Object.freeze({
  intro:        { label: "First Descent" },
  ranged:       { label: "Lantern Watch", eliteScale: .8 },
  brawl:        { label: "Close Quarters", healthScale: 1.08 },
  hazard:       { label: "Broken Path", pressureScale: .85 },
  survival:     { label: "Blackout Vigil", eliteScale: 1.2 },
  gunline:      { label: "Gun Line", pressureScale: .9 },
  rangedStorm:  { label: "Static Choir", pressureScale: 1.05 },
  mixed:        { label: "Flood Tactics", eliteScale: 1.1 },
  eliteHunt:    { label: "Elite Hunt", eliteScale: 2.1, eliteMaxAlive: 2, pressureScale: .72, healthScale: 1.05 },
  swarm:        { label: "Funeral Swarm", speedScale: 1.2, healthScale: .78, pressureScale: 1.45 },
  heavy:        { label: "Iron Wake", healthScale: 1.32, speedScale: .9, pressureScale: .7, eliteScale: 1.3 },
  coverTactics: { label: "Velvet Discipline", eliteScale: 1.2 },
  breather:     { label: "Crown Vigil", pressureScale: .78, eliteScale: .7 },
  gauntlet:     { label: "The Gauntlet", pressureScale: 1.25, eliteScale: 1.4, healthScale: 1.06 },
  finale:       { label: "The Last Grave", pressureScale: 1.5, eliteScale: 1.6, healthScale: 1.1, speedScale: 1.06, eliteMaxAlive: 2 }
});
const LEVEL_ARCHETYPES = Object.freeze([
  "intro", "ranged", "brawl", "hazard", "survival",
  "gunline", "rangedStorm", "mixed", "eliteHunt", "swarm",
  "heavy", "coverTactics", "breather", "gauntlet", "finale"
]);
function currentArchetype(levelIndex = game.currentLevel) {
  return ENCOUNTER_ARCHETYPES[LEVEL_ARCHETYPES[levelIndex]] || ENCOUNTER_ARCHETYPES.intro;
}
const ATMOSPHERE_PROFILES = Object.freeze([
  "moon-cloud cemetery fog", "marsh mist and ripples", "bone-market banners and dust", "viaduct storm below", "wet boulevard rain and steam",
  "rail ash and signal smoke", "cathedral static and cold candles", "floodway gold reflections", "observatory orbit shadows", "funeral neon flicker",
  "foundry smoke and embers", "velvet mirror glints", "crown hilltop storm", "citadel ledger rain", "last-city grave fog"
]);
const OUTDOOR_GRASS_LEVELS = new Set([0, 1, 2, 3, 4, 5, 7, 12, 14]);
const RANGED_DIFFICULTY_PROFILES = Object.freeze([
  { firstLevel: 1, lastLevel: 3, gunnerMax: 0, boltMax: 0, gunnerCooldown: [3.4, 4.1], gunnerSpeed: 1, wraithMax: 2, orbMax: 2, wraithCooldown: [2.2, 2.8], wraithSpeed: 1, hostileCap: 2, shotGap: .62 },
  { firstLevel: 4, lastLevel: 4, gunnerMax: 1, boltMax: 1, gunnerCooldown: [2.7, 3.3], gunnerSpeed: 1.3, wraithMax: 2, orbMax: 3, wraithCooldown: [1.7, 2.15], wraithSpeed: 1.25, hostileCap: 4, shotGap: .48 },
  { firstLevel: 5, lastLevel: 5, gunnerMax: 2, boltMax: 2, gunnerCooldown: [2.2, 2.8], gunnerSpeed: 1.45, wraithMax: 2, orbMax: 3, wraithCooldown: [1.45, 1.85], wraithSpeed: 1.4, hostileCap: 4, shotGap: .44 },
  { firstLevel: 6, lastLevel: 6, gunnerMax: 2, boltMax: 2, gunnerCooldown: [2.2, 2.8], gunnerSpeed: 1.45, wraithMax: 2, orbMax: 3, wraithCooldown: [1.45, 1.85], wraithSpeed: 1.4, hostileCap: 5, shotGap: .44 },
  { firstLevel: 7, lastLevel: 8, gunnerMax: 2, boltMax: 3, gunnerCooldown: [1.8, 2.35], gunnerSpeed: 1.6, wraithMax: 3, orbMax: 4, wraithCooldown: [1.15, 1.5], wraithSpeed: 1.55, hostileCap: 5, shotGap: .4 },
  { firstLevel: 9, lastLevel: 9, gunnerMax: 2, boltMax: 3, gunnerCooldown: [1.8, 2.35], gunnerSpeed: 1.6, wraithMax: 3, orbMax: 4, wraithCooldown: [1.15, 1.5], wraithSpeed: 1.55, hostileCap: 6, shotGap: .4 },
  { firstLevel: 10, lastLevel: 11, gunnerMax: 3, boltMax: 3, gunnerCooldown: [1.5, 2], gunnerSpeed: 1.75, wraithMax: 3, orbMax: 5, wraithCooldown: [.92, 1.25], wraithSpeed: 1.7, hostileCap: 6, shotGap: .37 },
  { firstLevel: 12, lastLevel: 12, gunnerMax: 3, boltMax: 3, gunnerCooldown: [1.5, 2], gunnerSpeed: 1.75, wraithMax: 3, orbMax: 5, wraithCooldown: [.92, 1.25], wraithSpeed: 1.7, hostileCap: 7, shotGap: .37 },
  { firstLevel: 13, lastLevel: 13, gunnerMax: 3, boltMax: 4, gunnerCooldown: [1.3, 1.75], gunnerSpeed: 1.9, wraithMax: 3, orbMax: 6, wraithCooldown: [.78, 1.08], wraithSpeed: 1.85, hostileCap: 7, shotGap: .35 },
  { firstLevel: 14, lastLevel: 14, gunnerMax: 3, boltMax: 4, gunnerCooldown: [1.15, 1.55], gunnerSpeed: 2, wraithMax: 3, orbMax: 6, wraithCooldown: [.7, .95], wraithSpeed: 1.95, hostileCap: 8, shotGap: .33 }
]);
const COMBAT_DIFFICULTY_PROFILES = Object.freeze([
  { firstLevel: 0, lastLevel: 3, recoveryScale: 1, summonLimit: 1, summonBudget: 1, summonCooldown: 12, encounterPressure: 1, wind: .55, enemyHealthScale: 1, enemySpeedScale: 1, eliteChance: 0 },
  { firstLevel: 4, lastLevel: 4, recoveryScale: .82, summonLimit: 2, summonBudget: 3, summonCooldown: 8.5, encounterPressure: 1.35, wind: .72, enemyHealthScale: 1.14, enemySpeedScale: 1.04, eliteChance: .1 },
  { firstLevel: 5, lastLevel: 6, recoveryScale: .76, summonLimit: 3, summonBudget: 4, summonCooldown: 7.2, encounterPressure: 1.5, wind: .82, enemyHealthScale: 1.24, enemySpeedScale: 1.07, eliteChance: .14 },
  { firstLevel: 7, lastLevel: 9, recoveryScale: .69, summonLimit: 3, summonBudget: 5, summonCooldown: 6.3, encounterPressure: 1.75, wind: .95, enemyHealthScale: 1.36, enemySpeedScale: 1.1, eliteChance: .18 },
  { firstLevel: 10, lastLevel: 12, recoveryScale: .63, summonLimit: 3, summonBudget: 6, summonCooldown: 5.5, encounterPressure: 2, wind: 1.08, enemyHealthScale: 1.5, enemySpeedScale: 1.14, eliteChance: .22 },
  { firstLevel: 13, lastLevel: 13, recoveryScale: .58, summonLimit: 4, summonBudget: 7, summonCooldown: 4.9, encounterPressure: 2.2, wind: 1.25, enemyHealthScale: 1.65, enemySpeedScale: 1.18, eliteChance: .28 },
  { firstLevel: 14, lastLevel: 14, recoveryScale: .55, summonLimit: 4, summonBudget: 8, summonCooldown: 4.5, encounterPressure: 2.45, wind: 1.32, enemyHealthScale: 1.72, enemySpeedScale: 1.2, eliteChance: .32 }
]);
const ELITE_TUNING = Object.freeze({
  healthScale: 1.9, speedScale: 1.1, scoreScale: 2, soulCoinBonus: 3,
  eligibleTypes: new Set(["bone", "shieldUndead", "boulevardGhoul", "graveGunner", "lanternWraith"])
});
const ENEMY_TELEGRAPH_STATES = new Set(["orbWindup", "gunnerAim", "dashWindup"]);
const BLACKOUT_SURVIVAL_WAVES = Object.freeze([
  { at: .8, enemies: [["dead", 4310], ["dead", 4660]] },
  { at: 6.6, enemies: [["boulevardGhoul", 4580], ["dead", 4210]] },
  { at: 12.8, enemies: [["shieldUndead", 4630], ["boulevardGhoul", 4160]] },
  { at: 19.2, enemies: [["boulevardGhoul", 4660], ["dead", 4250]] }
]);
const BOSS_PROFILES = Object.freeze({
  todorMarsh: {
    id: "todorMarsh", bossId: "todor", healthLabel: "TODOR", introTitle: "TODOR",
    introLine: "Е сега ще видиш какво е било през деветдесетте години", introLaugh: "ХА ХА ХА ХА ХА",
    phaseLine: "Сега става скъпо!", defeatLine: "Ще се върна с още пари...",
    health: 14, speed: 54, w: 58, h: 94, phaseThreshold: .5,
    arenaLeft: 4790, arenaRight: 5570, spawnX: 5360,
    attacks: ["bundleToss", "headlightSweep", "marshDriveBy"], vehicle: true, variant: 1
  },
  velkoMarket: {
    id: "velkoMarket", bossId: "velko", healthLabel: "VELKO", introTitle: "VELKO — THE BONE COLLECTOR",
    introLine: "Пазарът е мой, рицарю.", phaseLine: "Геле, пази ми пазара!", defeatLine: "Проклятието... остава...",
    health: 16, speed: 48, w: 98, h: 128, phaseThreshold: .48,
    arenaLeft: 4820, arenaRight: 5660, spawnX: 5390,
    attacks: ["auctionSlam", "boneDebt", "marketSummon"], vehicle: false, variant: 2
  },
  todorViaduct: {
    id: "todorViaduct", bossId: "todor", healthLabel: "TODOR", introTitle: "TODOR — KING OF THE ROAD",
    introLine: "Още ли не разбра? Пътят е мой.", phaseLine: "Така се плаща!", defeatLine: "Ще се върна с още пари...",
    health: 18, speed: 60, w: 60, h: 96, phaseThreshold: .48,
    arenaLeft: 5160, arenaRight: 5860, spawnX: 5610,
    attacks: ["blackoutDriveBy", "bundleBarrage", "tollGateRain"], vehicle: true, variant: 2
  },
  velkoFinal: {
    id: "velkoFinal", bossId: "velko", healthLabel: "VELKO", introTitle: "VELKO — LAST WARDEN",
    introLine: "Градът също е гробище.", phaseLine: "Геле, този път няма да избяга.", defeatLine: "",
    health: 22, speed: 56, w: 102, h: 132, phaseThreshold: .48,
    arenaLeft: 5050, arenaRight: 6060, spawnX: 5660,
    attacks: ["blackoutGravebreaker", "funeralChargeFinale", "cityOfBuried"], vehicle: false, variant: 3
  },
  todorRail: {
    id: "todorRail", bossId: "todor", healthLabel: "TODOR", introTitle: "TODOR — RAIL BARON",
    introLine: "Пак ли стигна дотук?", phaseLine: "Тук всичко минава през мен.", defeatLine: "Ще се върна с още пари...",
    health: 20, speed: 61, w: 60, h: 96, phaseThreshold: .48, arenaLeft: 5240, arenaRight: 5960, spawnX: 5680,
    attacks: ["railLineDrive", "bundleToss", "signalCashRain"], vehicle: true, vehicleSpeed: 420, driveWarning: 1, variant: 3
  },
  velkoCathedral: {
    id: "velkoCathedral", bossId: "velko", healthLabel: "VELKO", introTitle: "VELKO — STATIC WARDEN",
    introLine: "Тук дори камбаните погребват.", phaseLine: "Геле, нека чуе камбаните.", defeatLine: "Камбаните... мълчат...",
    health: 23, speed: 57, w: 102, h: 132, phaseThreshold: .48, arenaLeft: 5300, arenaRight: 6060, spawnX: 5750,
    attacks: ["cathedralBellSlam", "staticCharge", "choirBuried"], vehicle: false, variant: 4
  },
  todorFloodway: {
    id: "todorFloodway", bossId: "todor", healthLabel: "TODOR", introTitle: "TODOR — FLOODWAY MAGNATE",
    introLine: "Тук пътят струва пари.", phaseLine: "Сметката расте.", defeatLine: "Ще се върна с още пари...",
    health: 22, speed: 63, w: 61, h: 97, phaseThreshold: .48, arenaLeft: 5400, arenaRight: 6160, spawnX: 5850,
    attacks: ["floodlightSweep", "gildedBundleBarrage", "vaultDriveBy"], vehicle: true, vehicleSpeed: 430, driveWarning: .98, variant: 4
  },
  velkoObservatory: {
    id: "velkoObservatory", bossId: "velko", healthLabel: "VELKO", introTitle: "VELKO — OSSUARY ORACLE",
    introLine: "Звездите гледат надолу към гробовете.", phaseLine: "Небето също ще те погребе.", defeatLine: "Звездите... остават...",
    health: 25, speed: 58, w: 103, h: 133, phaseThreshold: .48, arenaLeft: 5480, arenaRight: 6260, spawnX: 5940,
    attacks: ["orbitSlam", "gravewindCharge", "constellationBuried"], vehicle: false, variant: 5
  },
  todorNeon: {
    id: "todorNeon", bossId: "todor", healthLabel: "TODOR", introTitle: "TODOR — NEON KING",
    introLine: "Градът ми плаща на светло.", phaseLine: "Сега градът гасне.", defeatLine: "Ще се върна с още пари...",
    health: 24, speed: 65, w: 61, h: 98, phaseThreshold: .48, arenaLeft: 5580, arenaRight: 6360, spawnX: 6040,
    attacks: ["neonDriveBy", "receiptToss", "blackoutCashRain"], vehicle: true, vehicleSpeed: 440, driveWarning: .96, variant: 5
  },
  velkoFoundry: {
    id: "velkoFoundry", bossId: "velko", healthLabel: "VELKO", introTitle: "VELKO — WRAITH SMITH",
    introLine: "Огънят не топли мъртвите.", phaseLine: "Геле, запали му пътя.", defeatLine: "Пепелта... помни...",
    health: 27, speed: 59, w: 104, h: 134, phaseThreshold: .47, arenaLeft: 5680, arenaRight: 6460, spawnX: 6140,
    attacks: ["anvilGravebreaker", "furnaceCharge", "ashenBuried"], vehicle: false, variant: 6
  },
  todorVelvet: {
    id: "todorVelvet", bossId: "todor", healthLabel: "TODOR", introTitle: "TODOR — VELVET COLLECTOR",
    introLine: "Под земята всеки има цена.", phaseLine: "Дългът ти не изчезва.", defeatLine: "Ще се върна с още пари...",
    health: 26, speed: 66, w: 62, h: 98, phaseThreshold: .47, arenaLeft: 5780, arenaRight: 6560, spawnX: 6240,
    attacks: ["mirrorLaneDrive", "velvetBundleToss", "debtCollectorRain"], vehicle: true, vehicleSpeed: 448, driveWarning: .94, variant: 6
  },
  velkoCrown: {
    id: "velkoCrown", bossId: "velko", healthLabel: "VELKO", introTitle: "VELKO — CROWN WARDEN",
    introLine: "Короната е за онзи, който остане.", phaseLine: "Геле, свали му короната.", defeatLine: "Короната... чака...",
    health: 29, speed: 60, w: 105, h: 135, phaseThreshold: .47, arenaLeft: 5880, arenaRight: 6660, spawnX: 6340,
    attacks: ["crownQuake", "sovereignCharge", "courtBuried"], vehicle: false, variant: 7
  },
  todorCitadel: {
    id: "todorCitadel", bossId: "todor", healthLabel: "TODOR", introTitle: "TODOR — LORD OF THE LEDGER",
    introLine: "Последната сметка е твоя.", phaseLine: "Няма безплатен изход.", defeatLine: "Ще се върна с още пари...",
    health: 28, speed: 67, w: 63, h: 99, phaseThreshold: .47, arenaLeft: 5980, arenaRight: 6760, spawnX: 6440,
    attacks: ["citadelDriveBy", "blackLedgerBarrage", "finalTollRain"], vehicle: true, vehicleSpeed: 455, driveWarning: .92, variant: 7
  },
  velkoLastCity: {
    id: "velkoLastCity", bossId: "velko", healthLabel: "VELKO", introTitle: "VELKO — LAST CITY WARDEN",
    introLine: "Всички пътища водят при мен.", phaseLine: "Геле, това е последният му път.", defeatLine: "",
    health: 36, speed: 63, w: 106, h: 136, phaseThreshold: .47, arenaLeft: 6100, arenaRight: 6960, spawnX: 6620,
    attacks: ["lastWardenRequiem", "citybreakerCharge", "finalCityBuried"], vehicle: false, variant: 8
  }
});
// Future recorded boss voice lines: map bossId -> eventType -> a local audio
// path (e.g. velko: { phase2: "audio/velko-phase2.mp3" }). When a clip is
// present it plays instead of browser speech synthesis; the subtitle, audio
// ducking, and support layer behave exactly the same.
const BOSS_VOICE_BANK = Object.freeze({
  velko: {},
  todor: {}
});

function tryPlayBankedVoice(bossId, eventType, onEnded) {
  const bank = BOSS_VOICE_BANK[bossId];
  const src = bank && bank[eventType];
  if (!src || typeof Audio === "undefined") return false;
  try {
    const clip = new Audio(src);
    clip.volume = .92;
    clip.onended = onEnded;
    clip.onerror = onEnded;
    const request = clip.play();
    if (request && request.catch) request.catch(() => onEnded && onEnded());
    return true;
  } catch (error) {
    return false;
  }
}

const RIVAL_DIALOGUE = Object.freeze({
  todor: {
    bundle: ["Вземи си за път!", "Парите винаги летят към победителя!", "Дръж рестото!"],
    vehicle: ["Отдръпни се!", "Пътят е мой!"],
    moneyRain: ["Вали богатство!", "Няма къде да избягаш!"],
    playerHit: ["Така се плаща!", "Сметката дойде!", "Още ли имаш какво да губиш?"],
    lowHealth: ["Още не сме приключили!", "Всичко има цена... и ти ще я платиш!"],
    playerDeath: ["Оставаш под земята!", "Тук приключваш!"]
  },
  velko: {
    slam: ["Земята помни стъпките ми!", "Падни пред камъка!"],
    charge: ["Няма да избягаш!", "Пътят ти свършва тук!"],
    summon: ["Ставайте, прокълнати!", "Излезте от пръстта!"],
    playerHit: ["Така се брани гробището!", "Слаб си, рицарю!"],
    lowHealth: ["Гробището не пада с мен!", "Още не съм приключил с теб!"],
    playerDeath: ["Остани при мъртвите!", "Тук свършва твоят път!"]
  }
});

function currentLevelDefinition() { return LEVEL_DEFINITIONS[game.currentLevel]; }

function currentRangedProfile() {
  return RANGED_DIFFICULTY_PROFILES.find((profile) => game.currentLevel >= profile.firstLevel && game.currentLevel <= profile.lastLevel) || null;
}
function getLevelDifficulty(levelIndex = game.currentLevel) {
  return COMBAT_DIFFICULTY_PROFILES.find((profile) => levelIndex >= profile.firstLevel && levelIndex <= profile.lastLevel) || COMBAT_DIFFICULTY_PROFILES[0];
}

const HOSTILE_PROJECTILE_TYPES = new Set(["pizza", "lanternOrb", "moneyBundle", "bossShockwave", "zombieBolt"]);
const MAJOR_BOSS_ATTACK_STATES = new Set(["slamWindup", "chargeWindup", "chargeActive", "driveWarning", "driveActive", "headlightSweep", "markedAttack", "teleportOut", "teleportIn"]);
// While in these states an enemy can neither be hit nor deal damage.
const UNTARGETABLE_ENEMY_STATES = new Set(["emerging", "intro", "teleportOut", "teleportIn"]);
// Low-priority boss taunts are suppressed while the player must actively
// dodge; warning shouts and story lines (priority > tauntPriorityMax) pass.
const DIALOGUE_SAFETY = Object.freeze({
  tauntPriorityMax: 1,
  blockedStates: new Set(["chargeActive", "driveActive", "teleportIn"])
});

function hostileProjectileCount() {
  let count = 0;
  for (const projectile of projectiles) if (projectile.life > 0 && HOSTILE_PROJECTILE_TYPES.has(projectile.type)) count += 1;
  return count;
}

function projectileTypeCount(type) {
  let count = 0;
  for (const projectile of projectiles) if (projectile.type === type && projectile.life > 0) count += 1;
  return count;
}

function canEnemyFire(enemy, projectileType) {
  const profile = currentRangedProfile();
  if (!profile || !enemy || game.mode !== "running" || game.bossEncounterState === "intro") return false;
  if (enemy.x + enemy.w < game.cameraX + 24 || enemy.x > game.cameraX + VIEW_W - 24) return false;
  const boss = activeCampaignBoss();
  if (boss && MAJOR_BOSS_ATTACK_STATES.has(boss.state)) return false;
  if (game.time < game.rangedNextShotAt || hostileProjectileCount() >= profile.hostileCap) return false;
  if (projectileType === "lanternOrb") {
    if (projectileTypeCount("lanternOrb") >= profile.orbMax || game.time - game.rangedLastWraithShotAt < .38) return false;
  } else if (projectileType === "zombieBolt") {
    if (projectileTypeCount("zombieBolt") >= profile.boltMax || game.time - game.rangedLastGunnerShotAt < .48) return false;
  }
  return true;
}

function registerHostileShot(enemy, projectileType) {
  const profile = currentRangedProfile();
  if (!profile) return;
  game.rangedNextShotAt = game.time + Math.max(profile.shotGap, .38);
  game.rangedLastShooterId = enemy ? enemy.id : 0;
  game.rangedShotsFired += 1;
  if (projectileType === "lanternOrb") game.rangedLastWraithShotAt = game.time;
  if (projectileType === "zombieBolt") game.rangedLastGunnerShotAt = game.time;
}

const SHAKE_PROFILES = Object.freeze({ light: 2.4, medium: 5.5, heavy: 10.5 });
const VELKO_INTRO_LINE = "Геле, замеряй го с баница.";
const VELKO_INTRO_DISPLAY = `“${VELKO_INTRO_LINE}”`;
const VELKO_DIALOGUE = Object.freeze({
  intro: [VELKO_INTRO_LINE],
  slam: ["Земята помни стъпките ми!", "Падни пред камъка!"],
  charge: ["Няма да избягаш!", "Пътят ти свършва тук!"],
  summon: ["Ставайте, прокълнати!", "Излезте от пръстта!"],
  phase2: ["Сега ще видиш силата на тавата!", "Гробището още не е приключило с теб!"],
  lowHealth: ["Още не съм приключил!", "Няма да падна пред теб!"],
  playerHit: ["Така се брани гробището!", "Слаб си, рицарю!"],
  playerDeath: ["Остани при мъртвите!", "Тук свършва твоят път!"],
  defeated: ["Проклятието... остава..."],
  pizzaFirstThrow: ["Геле, замеряй го бееее."],
  pizzaCommand: ["Замеряй го Гелеее."],
  pizzaHitLaugh: ["ХА ХА ХА ХА ХА"]
});
const VELKO_PRIORITY = Object.freeze({ combat: 1, pizzaCombat: 1, playerHit: 2, pizzaHit: 2, pizzaFirstThrow: 3, phase2: 4, intro: 5, playerDeath: 6, defeated: 7 });
const VELKO_NORMAL_COOLDOWN_MIN = 4.5;
const VELKO_NORMAL_COOLDOWN_MAX = 6;
const VELKO_HIT_COOLDOWN_MIN = 8;
const VELKO_HIT_COOLDOWN_MAX = 10;
const PIZZA_HIT_LAUGH_COOLDOWN_MIN = 8;
const PIZZA_HIT_LAUGH_COOLDOWN_MAX = 10;
const MAX_PIZZA_PROJECTILES = 3;
const ARENA_LEFT = 6425;
const ARENA_RIGHT = 7535;
const BOSS_INTRO_REVEAL_SECONDS = 1.2;
const BOSS_INTRO_HOLD_SECONDS = .22;
const BOSS_INTRO_FADE_SECONDS = .42;
const BOSS_SPEECH_DELAY_SECONDS = .12;
const BOSS_SPEECH_TIMEOUT_SECONDS = 7;

const velkoSubtitleState = { active: false, line: "", timer: 0, speaker: "VELKO" };

function addShake(profile) {
  game.shake = Math.max(game.shake, SHAKE_PROFILES[profile] || 0);
}

function beginBossIntro() {
  BossSpeech.resetEncounter();
  bossIntroOverlay.classList.remove("campaign", "velko", "todor");
  game.bossIntroTriggerCount += 1;
  game.arenaLocked = true;
  relocateAvailableAmuletToArena(ARENA_LEFT);
  game.mode = "bossIntro";
  game.bossIntroTime = 0;
  game.bossIntroCharacters = 0;
  game.bossIntroFadeStarted = 0;
  game.bossSpeechComplete = false;
  cancelTransientControls(true);
  bossIntroDialogue.textContent = "";
  bossIntroOverlay.classList.remove("leaving");
  bossIntroOverlay.classList.add("visible");
  bossIntroOverlay.setAttribute("aria-hidden", "false");
}

function updateBossIntro(dt) {
  game.time += dt;
  game.bossIntroTime += dt;
  game.arenaGateProgress = approach(game.arenaGateProgress, 1, dt * 2.6);
  game.shake = Math.max(0, game.shake - dt * 38);
  BossSpeech.update(dt);
  updateParticles(dt);
  const introBoss = enemies.find((enemy) => enemy.type === "boss" && !enemy.dead);
  if (introBoss) {
    const focusTarget = clamp((player.x + introBoss.x + introBoss.w / 2) * .5 - VIEW_W * .5, 0, WORLD_W - VIEW_W);
    game.cameraX = lerp(game.cameraX, focusTarget, 1 - Math.pow(.002, dt));
    if (Math.random() < dt * 9) {
      const side = Math.random() < .5 ? -1 : 1;
      emitParticle({ x: introBoss.x + introBoss.w / 2 + side * (90 + Math.random() * 80), y: introBoss.y + 35 + Math.random() * 80,
        vx: -side * (22 + Math.random() * 22), vy: -6 - Math.random() * 15, size: 2 + Math.random() * 2,
        life: .8, maxLife: .8, color: Math.random() < .3 ? "#8c3e3a" : "#779da3", gravity: -3, kind: "soul" });
    }
  }
  const revealProgress = clamp(game.bossIntroTime / BOSS_INTRO_REVEAL_SECONDS, 0, 1);
  const characters = Math.min(VELKO_INTRO_DISPLAY.length, Math.floor(VELKO_INTRO_DISPLAY.length * revealProgress));
  if (characters !== game.bossIntroCharacters) {
    game.bossIntroCharacters = characters;
    bossIntroDialogue.textContent = VELKO_INTRO_DISPLAY.slice(0, characters);
  }
  if (game.bossIntroTime >= BOSS_SPEECH_DELAY_SECONDS && !BossSpeech.hasAttemptedThisEncounter()) {
    game.bossSpeechComplete = !speakVelkoLine(VELKO_INTRO_LINE, VELKO_PRIORITY.intro, "intro");
  }
  const revealFinished = game.bossIntroTime >= BOSS_INTRO_REVEAL_SECONDS;
  const speechTimedOut = game.bossIntroTime >= BOSS_SPEECH_TIMEOUT_SECONDS;
  if (speechTimedOut && !game.bossSpeechComplete) {
    cancelBossSpeech();
    game.bossSpeechComplete = true;
  }
  if (!revealFinished || (!game.bossSpeechComplete && !speechTimedOut)) return;
  if (game.bossIntroTime < BOSS_INTRO_REVEAL_SECONDS + BOSS_INTRO_HOLD_SECONDS) return;
  if (!bossIntroOverlay.classList.contains("leaving")) {
    bossIntroOverlay.classList.add("leaving");
    game.bossIntroFadeStarted = game.bossIntroTime;
  }
  if (game.bossIntroTime < game.bossIntroFadeStarted + BOSS_INTRO_FADE_SECONDS) return;
  bossIntroDialogue.textContent = VELKO_INTRO_DISPLAY;
  bossIntroOverlay.classList.remove("visible", "leaving");
  bossIntroOverlay.classList.remove("campaign", "velko", "todor");
  bossIntroOverlay.setAttribute("aria-hidden", "true");
  const boss = enemies.find((enemy) => enemy.type === "boss" && !enemy.dead);
  if (boss) {
    boss.state = "active";
    boss.attackCooldown = .9;
  }
  beginPizzaReinforcements();
  game.mode = "running";
  lastTime = performance.now();
}

function showVelkoSubtitle(line, duration = Math.max(2.2, line.length * .085)) {
  showBossSubtitle("VELKO", line, duration);
}

function showBossSubtitle(speaker, line, duration = Math.max(2.2, line.length * .085)) {
  velkoSubtitleState.active = true;
  velkoSubtitleState.line = line;
  velkoSubtitleState.timer = duration;
  velkoSubtitleState.speaker = speaker;
  bossSubtitleSpeaker.textContent = speaker;
  velkoSubtitleText.textContent = line;
  velkoSubtitle.classList.add("visible");
  velkoSubtitle.setAttribute("aria-hidden", "false");
}

function hideVelkoSubtitle() {
  velkoSubtitleState.active = false;
  velkoSubtitleState.timer = 0;
  velkoSubtitleText.textContent = "";
  velkoSubtitle.classList.remove("visible");
  velkoSubtitle.setAttribute("aria-hidden", "true");
  BossSpeech.onSubtitleHidden();
  RivalSpeech.onSubtitleHidden();
}

function updateVelkoSubtitle(dt) {
  if (!velkoSubtitleState.active || BossSpeech.isActive() || RivalSpeech.isActive()) return;
  velkoSubtitleState.timer -= dt;
  if (velkoSubtitleState.timer <= 0) hideVelkoSubtitle();
}

// -----------------------------------------------------------------------------
// Synthesized audio
// -----------------------------------------------------------------------------

const SoundManager = (() => {
  const MUSIC_SECONDS = 16;
  const MUSIC_BPM = 122;
  const MASTER_LEVEL = 0.95;
  const MUSIC_LEVEL = 0.38;
  const PAUSED_MUSIC_LEVEL = 0.06;
  const SFX_LEVEL = 0.64;
  const PAUSED_SFX_LEVEL = 0.42;
  const FINAL_SAFETY_LEVEL = 0.82;
  const SILENCE = 0.00001;
  const roots = [38, 34, 36, 33, 38, 34, 31, 33]; // Dm-centered, original eight-bar path.
  const lead = [
    [62, null, 65, null, 69, null, 67, null],
    [58, null, 62, null, 65, 64, null, 62],
    [60, null, 63, null, 67, null, 65, 63],
    [57, null, 60, 62, null, 60, null, 57],
    [62, 65, null, 69, null, 70, 69, null],
    [58, null, 65, 62, null, 60, null, 58],
    [55, null, 58, null, 62, 60, 58, null],
    [57, 60, null, 64, 62, null, 57, null]
  ];
  const sfxCooldowns = { footstep: 0.15, emerge: 0.22, spearTrail: 0.2, torchCrackle: 0.22, enemyHit: 0.045, reward: 0.08 };
  const combatTypes = new Set(["spearThrow", "spearImpact", "spearDull", "torchThrow", "torchImpact", "flameSplash", "pizzaSplat", "slash", "daggerHit", "enemyHit"]);
  const deathTypes = new Set(["defeated"]);
  const bossTypes = new Set(["boss", "bossHit", "bossDefeated"]);
  const sfxConfig = {
    jump: { duration: .18, volume: .17, f1: 175, f2: 390, tone: .8 },
    landing: { duration: .15, volume: .13, f1: 105, f2: 54, tone: .65, noise: .22 },
    footstep: { duration: .11, volume: .055, f1: 80, f2: 58, tone: .35, noise: .4 },
    emerge: { duration: .34, volume: .16, f1: 72, f2: 42, tone: .5, noise: .5 },
    miss: { duration: .12, volume: .09, f1: 520, f2: 120, tone: .62, noise: .12 },
    slash: { duration: .13, volume: .17, f1: 980, f2: 170, tone: .72, noise: .24 },
    daggerHit: { duration: .15, volume: .21, f1: 1280, f2: 260, tone: .8, noise: .1 },
    spearThrow: { duration: .17, volume: .21, f1: 920, f2: 155, tone: .66, noise: .2 },
    spearTrail: { duration: .1, volume: .028, f1: 1500, f2: 900, tone: .08, noise: .34 },
    spearImpact: { duration: .19, volume: .29, f1: 1120, f2: 72, tone: .78, noise: .24 },
    spearDull: { duration: .16, volume: .17, f1: 160, f2: 52, tone: .62, noise: .3 },
    torchThrow: { duration: .29, volume: .23, f1: 190, f2: 62, tone: .55, noise: .42 },
    torchCrackle: { duration: .12, volume: .035, f1: 950, f2: 620, tone: .06, noise: .48 },
    torchImpact: { duration: .43, volume: .34, f1: 98, f2: 34, tone: .58, noise: .55 },
    flameSplash: { duration: .2, volume: .16, f1: 520, f2: 180, tone: .18, noise: .55 },
    pizzaSplat: { duration: .18, volume: .13, f1: 170, f2: 62, tone: .34, noise: .48 },
    enemyHit: { duration: .18, volume: .23, f1: 360, f2: 68, tone: .72, noise: .18 },
    defeated: { duration: .38, volume: .24, f1: 270, f2: 42, tone: .66, noise: .32 },
    reward: { duration: .23, volume: .11, notes: [520, 720], tone: .75 },
    hurt: { duration: .29, volume: .25, f1: 230, f2: 64, tone: .72, noise: .15 },
    armorBreak: { duration: .32, volume: .24, f1: 430, f2: 60, tone: .55, noise: .52 },
    pickup: { duration: .46, volume: .19, notes: [420, 570, 760], tone: .75 },
    heal: { duration: .52, volume: .17, notes: [340, 455, 605, 810], tone: .74 },
    eliteSpawn: { duration: .55, volume: .21, f1: 52, f2: 145, tone: .62, noise: .38 },
    bossPhase: { duration: .85, volume: .27, f1: 46, f2: 215, tone: .7, noise: .3 },
    velkoWarp: { duration: .5, volume: .22, f1: 740, f2: 95, tone: .55, noise: .34 },
    todorWarp: { duration: .42, volume: .24, f1: 60, f2: 190, tone: .6, noise: .42 },
    lastLife: { duration: .7, volume: .2, notes: [225, 152, 96], tone: .72 },
    uiSelect: { duration: .12, volume: .09, f1: 480, f2: 700, tone: .62, noise: .05 },
    boss: { duration: .72, volume: .28, f1: 82, f2: 38, tone: .72, noise: .24 },
    bossHit: { duration: .22, volume: .29, f1: 145, f2: 40, tone: .74, noise: .23 },
    bossDefeated: { duration: .82, volume: .31, f1: 125, f2: 32, tone: .66, noise: .38 },
    vehicleRumble: { duration: .72, volume: .11, f1: 54, f2: 36, tone: .78, noise: .14 },
    gameover: { duration: .95, volume: .23, notes: [220, 165, 110, 73], tone: .72 },
    victory: { duration: 1.05, volume: .24, notes: [330, 440, 554, 660], tone: .72 },
    pause: { duration: .24, volume: .12, notes: [290, 190], tone: .7 },
    resume: { duration: .25, volume: .13, notes: [190, 290, 390], tone: .7 },
    restart: { duration: .28, volume: .13, notes: [210, 330, 480], tone: .7 }
  };

  let context = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  let musicFilter = null;
  let compressor = null;
  let finalSafetyGain = null;
  let musicBuffer = null;
  let musicSource = null;
  let enabled = true;
  let unlocked = false;
  let musicRunning = false;
  let musicPaused = false;
  let speechDucked = false;
  let velkoSupportLayer = null;
  let bossTension = false;
  let lastAudioEvent = "idle";
  let lastVoiceReleaseStatus = "none";
  const sfxBuffers = new Map();
  const activeVoices = [];
  const lastSfxTime = new Map();

  const midi = (note) => 440 * Math.pow(2, (note - 69) / 12);

  function holdAudioParam(param, now) {
    const current = Math.max(SILENCE, Number.isFinite(param.value) ? param.value : SILENCE);
    if (typeof param.cancelAndHoldAtTime === "function") {
      param.cancelAndHoldAtTime(now);
    } else {
      param.cancelScheduledValues(now);
      param.setValueAtTime(current, now);
    }
    return current;
  }

  function setGain(gainNode, value, duration = 0.08) {
    if (!context || !gainNode) return;
    const now = context.currentTime;
    holdAudioParam(gainNode.gain, now);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(SILENCE, value), now + duration);
  }

  function initializeAudio() {
    if (context) return context;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    context = new AudioContextClass();
    masterGain = context.createGain();
    musicGain = context.createGain();
    sfxGain = context.createGain();
    musicFilter = context.createBiquadFilter();
    compressor = context.createDynamicsCompressor();
    finalSafetyGain = context.createGain();
    const now = context.currentTime;
    masterGain.gain.setValueAtTime(MASTER_LEVEL, now);
    musicGain.gain.setValueAtTime(SILENCE, now);
    sfxGain.gain.setValueAtTime(SFX_LEVEL, now);
    finalSafetyGain.gain.setValueAtTime(FINAL_SAFETY_LEVEL, now);
    musicFilter.type = "lowpass";
    musicFilter.frequency.setValueAtTime(3300, now);
    musicFilter.Q.setValueAtTime(0.55, now);
    compressor.threshold.setValueAtTime(-20, now);
    compressor.knee.setValueAtTime(24, now);
    compressor.ratio.setValueAtTime(10, now);
    compressor.attack.setValueAtTime(0.01, now);
    compressor.release.setValueAtTime(0.24, now);
    musicGain.connect(musicFilter).connect(masterGain);
    sfxGain.connect(masterGain);
    masterGain.connect(compressor).connect(finalSafetyGain).connect(context.destination);
    return context;
  }

  function smoothStep(value) {
    const x = clamp(value, 0, 1);
    return x * x * (3 - 2 * x);
  }

  function noteEnvelope(localTime, length, attack, release) {
    if (localTime < 0 || localTime >= length) return 0;
    const fadeIn = smoothStep(localTime / attack);
    const fadeOut = smoothStep((length - localTime) / release);
    return Math.min(fadeIn, fadeOut);
  }

  function deterministicNoise(index, seed) {
    let value = (index + seed * 374761393) | 0;
    value = Math.imul(value ^ (value >>> 13), 1274126177);
    value ^= value >>> 16;
    return (value >>> 0) / 2147483647.5 - 1;
  }

  function createMusicLoopBuffer() {
    if (!context) return null;
    if (musicBuffer) return musicBuffer;
    const sampleRate = context.sampleRate;
    const length = Math.round(MUSIC_SECONDS * sampleRate);
    const buffer = context.createBuffer(2, length, sampleRate);
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    const beat = 60 / MUSIC_BPM;
    const barLength = beat * 4;
    const patternLength = barLength * 8;
    const arpIntervals = [0, 3, 7, 10];
    let noiseLow = 0;
    let maxPeak = 0;

    for (let index = 0; index < length; index++) {
      const time = index / sampleRate;
      const bar = Math.min(7, Math.floor(time / barLength));
      const withinBar = time - bar * barLength;
      const root = roots[bar];
      let mono = Math.sin(Math.PI * 2 * 55 * time) * 0.055 + Math.sin(Math.PI * 2 * 82.5 * time + 0.35) * 0.025;
      let stereoLeft = 0;
      let stereoRight = 0;

      if (time < patternLength) {
        const beatIndex = Math.floor(withinBar / beat);
        const beatLocal = withinBar % beat;
        const bassNote = root + (beatIndex === 3 ? 7 : 0);
        const bassEnv = noteEnvelope(beatLocal, Math.min(beat * 0.9, 0.44), 0.014, 0.11);
        const bassPhase = Math.PI * 2 * midi(bassNote) * time;
        mono += (Math.sin(bassPhase) * 0.22 + Math.sin(bassPhase * 2) * 0.045) * bassEnv;

        const eighth = beat / 2;
        const arpIndex = Math.floor(withinBar / eighth);
        const arpLocal = withinBar % eighth;
        const arpNote = root + 24 + arpIntervals[(arpIndex + bar) % arpIntervals.length];
        const arpEnv = noteEnvelope(arpLocal, Math.min(0.18, eighth * 0.78), 0.011, 0.075);
        const arpPhase = Math.PI * 2 * midi(arpNote) * time;
        stereoLeft += (Math.sin(arpPhase) * 0.105 + Math.sin(arpPhase * 2) * 0.018) * arpEnv;
        stereoRight += (Math.sin(arpPhase + 0.09) * 0.1 + Math.sin(arpPhase * 2 + 0.04) * 0.016) * arpEnv;

        const leadNote = lead[bar][arpIndex % 8];
        if (leadNote !== null) {
          const leadEnv = noteEnvelope(arpLocal, Math.min(0.2, eighth * 0.88), 0.016, 0.09);
          const leadPhase = Math.PI * 2 * midi(leadNote) * time;
          mono += (Math.sin(leadPhase) * 0.075 + Math.sin(leadPhase * 2) * 0.012) * leadEnv;
        }

        const kickLocal = withinBar % (beat * 2);
        if (kickLocal < 0.16) {
          const kickEnv = noteEnvelope(kickLocal, 0.16, 0.009, 0.085);
          const kickFreq = 92 - kickLocal * 290;
          mono += Math.sin(Math.PI * 2 * Math.max(42, kickFreq) * kickLocal) * kickEnv * 0.19;
        }
        const beatPosition = Math.floor(withinBar / beat);
        if ((beatPosition === 1 || beatPosition === 3) && beatLocal < 0.12) {
          const raw = deterministicNoise(index, 23);
          noiseLow += (raw - noiseLow) * 0.18;
          mono += (raw * 0.04 + noiseLow * 0.055) * noteEnvelope(beatLocal, 0.12, 0.009, 0.075);
        }
        const hatLocal = withinBar % eighth;
        if (hatLocal < 0.055) {
          const raw = deterministicNoise(index, 47);
          mono += (raw - noiseLow) * noteEnvelope(hatLocal, 0.055, 0.008, 0.038) * 0.018;
        }
      } else {
        const tail = smoothStep((MUSIC_SECONDS - time) / Math.max(0.001, MUSIC_SECONDS - patternLength));
        mono *= tail;
      }

      const edge = Math.min(smoothStep(time / 0.012), smoothStep((MUSIC_SECONDS - time) / 0.012));
      const leftSample = Math.tanh((mono + stereoLeft) * 1.12) * edge;
      const rightSample = Math.tanh((mono + stereoRight) * 1.12) * edge;
      left[index] = index === 0 || index === length - 1 ? 0 : leftSample;
      right[index] = index === 0 || index === length - 1 ? 0 : rightSample;
      maxPeak = Math.max(maxPeak, Math.abs(left[index]), Math.abs(right[index]));
    }

    const scale = maxPeak > 0 ? 0.74 / maxPeak : 1;
    for (let index = 0; index < length; index++) {
      left[index] *= scale;
      right[index] *= scale;
    }
    musicBuffer = buffer;
    return musicBuffer;
  }

  function hashType(type) {
    let hash = 2166136261;
    for (let index = 0; index < type.length; index++) hash = Math.imul(hash ^ type.charCodeAt(index), 16777619);
    return hash >>> 0;
  }

  function createRetroSfxBuffer(type) {
    if (!context || !sfxConfig[type]) return null;
    if (sfxBuffers.has(type)) return sfxBuffers.get(type);
    const config = sfxConfig[type];
    const sampleRate = context.sampleRate;
    const length = Math.max(2, Math.round(config.duration * sampleRate));
    const buffer = context.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    const attack = clamp(config.duration * 0.09, 0.008, 0.025);
    const release = clamp(config.duration * 0.38, 0.06, 0.18);
    const seed = hashType(type);
    let phase = 0;
    let filteredNoise = 0;
    let maxPeak = 0;

    for (let index = 0; index < length; index++) {
      const time = index / sampleRate;
      const progress = time / config.duration;
      let toneSample = 0;
      if (config.notes) {
        const segment = config.duration / config.notes.length;
        const noteIndex = Math.min(config.notes.length - 1, Math.floor(time / segment));
        const local = time - noteIndex * segment;
        const frequency = config.notes[noteIndex];
        const noteEnv = noteEnvelope(local, segment, Math.min(0.014, segment * 0.18), Math.min(0.075, segment * 0.42));
        toneSample = (Math.sin(Math.PI * 2 * frequency * local) + Math.sin(Math.PI * 4 * frequency * local) * 0.13) * noteEnv;
      } else {
        const frequency = config.f1 * Math.pow(config.f2 / config.f1, progress);
        phase += Math.PI * 2 * frequency / sampleRate;
        toneSample = Math.sin(phase) * 0.82 + Math.sin(phase * 2) * 0.13 + Math.sin(phase * 3) * 0.05;
      }
      const rawNoise = deterministicNoise(index, seed);
      filteredNoise += (rawNoise - filteredNoise) * 0.2;
      const noiseSample = rawNoise * 0.28 + filteredNoise * 0.72;
      const envelope = Math.min(smoothStep(time / attack), smoothStep((config.duration - time) / release));
      const sample = Math.tanh((toneSample * (config.tone || 0) + noiseSample * (config.noise || 0)) * 1.35) * envelope;
      data[index] = index === 0 || index === length - 1 ? 0 : sample;
      maxPeak = Math.max(maxPeak, Math.abs(data[index]));
    }
    const scale = maxPeak > 0 ? 0.86 / maxPeak : 1;
    for (let index = 0; index < length; index++) data[index] *= scale;
    sfxBuffers.set(type, buffer);
    return buffer;
  }

  function voiceCategory(type) {
    if (combatTypes.has(type)) return "combat";
    if (deathTypes.has(type)) return "death";
    if (bossTypes.has(type)) return "boss";
    return "world";
  }

  function activeVoiceCount(category, type) {
    return activeVoices.filter((voice) => !voice.releasing && voice.category === category && (category !== "boss" || voice.type === type)).length;
  }

  function safeReleaseVoice(voice, releaseSeconds = 0.07) {
    if (!context || !voice || voice.releasing) return;
    voice.releasing = true;
    const now = context.currentTime;
    holdAudioParam(voice.gain.gain, now);
    voice.gain.gain.exponentialRampToValueAtTime(SILENCE, now + releaseSeconds);
    try { voice.source.stop(now + releaseSeconds + 0.025); } catch (_) { /* already ending */ }
    lastVoiceReleaseStatus = `${voice.type}: ${Math.round(releaseSeconds * 1000)}ms safe release`;
  }

  function releaseTransientVoices() {
    for (const voice of [...activeVoices]) safeReleaseVoice(voice, 0.08);
  }

  function playBufferedSfx(type) {
    if (!enabled || !unlocked || !context || !sfxConfig[type]) return;
    const category = voiceCategory(type);
    const limit = category === "combat" ? 4 : category === "death" ? 2 : category === "boss" ? 1 : 6;
    if (activeVoiceCount(category, type) >= limit || activeVoices.filter((voice) => !voice.releasing).length >= 10) {
      lastAudioEvent = `${type}: dropped by polyphony limit`;
      return;
    }
    const buffer = createRetroSfxBuffer(type);
    const source = context.createBufferSource();
    const voiceGain = context.createGain();
    const now = context.currentTime;
    const attack = clamp(buffer.duration * 0.08, 0.008, 0.025);
    const release = clamp(buffer.duration * 0.32, 0.06, 0.18);
    const releaseStart = Math.max(now + attack, now + buffer.duration - release);
    const end = now + buffer.duration;
    source.buffer = buffer;
    voiceGain.gain.cancelScheduledValues(now);
    voiceGain.gain.setValueAtTime(SILENCE, now);
    voiceGain.gain.linearRampToValueAtTime(sfxConfig[type].volume, now + attack);
    voiceGain.gain.setValueAtTime(sfxConfig[type].volume * 0.94, releaseStart);
    voiceGain.gain.exponentialRampToValueAtTime(SILENCE, end);
    source.connect(voiceGain).connect(sfxGain);
    const voice = { source, gain: voiceGain, type, category, startedAt: now, releasing: false };
    activeVoices.push(voice);
    source.onended = () => {
      const index = activeVoices.indexOf(voice);
      if (index >= 0) activeVoices.splice(index, 1);
      lastVoiceReleaseStatus = `${type}: ended after buffer release`;
    };
    source.start(now);
    source.stop(end + 0.03);
    lastAudioEvent = `${type}: buffered SFX`;
  }

  function startLevelMusic() {
    if (!enabled || !unlocked || !context) return;
    if (!musicSource) {
      musicSource = context.createBufferSource();
      musicSource.buffer = createMusicLoopBuffer();
      musicSource.loop = true;
      musicSource.loopStart = 0;
      musicSource.loopEnd = MUSIC_SECONDS;
      musicSource.connect(musicGain);
      musicSource.start(context.currentTime + 0.02);
      lastAudioEvent = "music buffer loop started";
    }
    musicRunning = true;
    musicPaused = false;
    setGain(musicGain, MUSIC_LEVEL, 0.2);
  }

  function pauseMusic() {
    if (!context || !musicRunning || musicPaused) return;
    musicPaused = true;
    setGain(musicGain, PAUSED_MUSIC_LEVEL, 0.12);
    setGain(sfxGain, PAUSED_SFX_LEVEL, 0.12);
    lastAudioEvent = "music softly paused";
  }

  function resumeMusic() {
    if (!enabled || !unlocked || !context) return;
    if (!musicSource) startLevelMusic();
    musicRunning = true;
    musicPaused = false;
    setGain(musicGain, MUSIC_LEVEL, 0.18);
    setGain(sfxGain, SFX_LEVEL, 0.14);
    lastAudioEvent = "music resumed by gain ramp";
  }

  function stopMusic(fadeSeconds = 0.22) {
    if (!context) return;
    musicRunning = false;
    musicPaused = false;
    setGain(musicGain, SILENCE, fadeSeconds);
    lastAudioEvent = "music faded; loop retained safely";
  }

  function playSfx(type) {
    if (!enabled || !unlocked || !context) return;
    const now = context.currentTime;
    const cooldown = sfxCooldowns[type] || 0;
    if (now - (lastSfxTime.get(type) ?? -Infinity) < cooldown) return;
    lastSfxTime.set(type, now);
    playBufferedSfx(type);
  }

  function unlockAudioFromUserGesture() {
    if (!enabled) return;
    const audio = initializeAudio();
    if (!audio) return;
    unlocked = true;
    if (audio.state === "suspended") audio.resume().catch(() => {});
    if (game.mode === "running") startLevelMusic();
  }

  function setSoundEnabled(value) {
    enabled = value;
    if (!context) return;
    if (!enabled) {
      pauseMusic();
      setGain(masterGain, SILENCE, 0.15);
      lastAudioEvent = "sound off: 150ms master fade";
    } else {
      setGain(masterGain, MASTER_LEVEL, 0.2);
      if (game.mode === "running") resumeMusic(true);
      lastAudioEvent = "sound on: 200ms master fade";
    }
  }

  function setBossTension(value) {
    bossTension = value;
  }

  function setBossSpeechDucking(value) {
    speechDucked = value;
    if (!context) return;
    if (value) {
      setGain(musicGain, MUSIC_LEVEL * .4, .18);
      setGain(sfxGain, SFX_LEVEL * .72, .16);
      lastAudioEvent = "VELKO speech: music smoothly ducked to 40%";
      return;
    }
    setGain(musicGain, musicPaused ? PAUSED_MUSIC_LEVEL : musicRunning ? MUSIC_LEVEL : SILENCE, .28);
    setGain(sfxGain, musicPaused ? PAUSED_SFX_LEVEL : SFX_LEVEL, .22);
    lastAudioEvent = "VELKO speech: normal mix smoothly restored";
  }

  function stopVelkoSupportLayer(releaseSeconds = .16) {
    if (!context || !velkoSupportLayer) return;
    const layer = velkoSupportLayer;
    velkoSupportLayer = null;
    const now = context.currentTime;
    holdAudioParam(layer.gain.gain, now);
    layer.gain.gain.exponentialRampToValueAtTime(SILENCE, now + releaseSeconds);
    for (const oscillator of layer.oscillators) {
      try { oscillator.stop(now + releaseSeconds + .03); } catch (_) { /* already stopping */ }
    }
    lastAudioEvent = "VELKO support layer safely released";
  }

  function startVelkoSupportLayer(kind = "velko") {
    if (!enabled || !unlocked || !context) return false;
    stopVelkoSupportLayer(.06);
    const now = context.currentTime;
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    const low = context.createOscillator();
    const shadow = context.createOscillator();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(kind === "todor" ? 118 : 145, now);
    filter.Q.setValueAtTime(.7, now);
    gain.gain.setValueAtTime(SILENCE, now);
    gain.gain.exponentialRampToValueAtTime(kind === "todor" ? .014 : .018, now + .09);
    low.type = "sine";
    low.frequency.setValueAtTime(kind === "todor" ? 39 : 46, now);
    shadow.type = "triangle";
    shadow.frequency.setValueAtTime(kind === "todor" ? 52 : 61, now);
    shadow.detune.setValueAtTime(-8, now);
    low.connect(filter);
    shadow.connect(filter);
    filter.connect(gain).connect(sfxGain);
    low.start(now);
    shadow.start(now);
    shadow.onended = () => {
      try { low.disconnect(); shadow.disconnect(); filter.disconnect(); gain.disconnect(); } catch (_) { /* already disconnected */ }
    };
    velkoSupportLayer = { oscillators: [low, shadow], gain, filter };
    lastAudioEvent = `${kind === "todor" ? "TODOR" : "VELKO"} quiet two-tone support layer started`;
    return true;
  }

  function debugState() {
    return {
      context,
      contextState: context ? context.state : "not initialized",
      enabled,
      unlocked,
      musicEnabled: enabled && musicRunning,
      musicRunning,
      musicPaused,
      bossTension,
      speechDucked,
      velkoSupportLayerActive: Boolean(velkoSupportLayer),
      schedulerTimer: null,
      schedulerCount: 0,
      stepIndex: 0,
      masterLevel: masterGain ? masterGain.gain.value : MASTER_LEVEL,
      musicLevel: musicGain ? musicGain.gain.value : MUSIC_LEVEL,
      sfxLevel: sfxGain ? sfxGain.gain.value : SFX_LEVEL,
      finalSafetyLevel: finalSafetyGain ? finalSafetyGain.gain.value : FINAL_SAFETY_LEVEL,
      musicSourceCount: musicSource ? 1 : 0,
      sfxSourceCount: activeVoices.filter((voice) => !voice.releasing).length,
      compressorEnabled: Boolean(compressor),
      clippingProtection: Boolean(compressor && finalSafetyGain),
      lastAudioEvent,
      lastVoiceReleaseStatus
    };
  }

  return { initializeAudio, unlockAudioFromUserGesture, startLevelMusic, pauseMusic, resumeMusic, stopMusic, createRetroSfxBuffer, playBufferedSfx, playSfx, releaseTransientVoices, setSoundEnabled, setBossTension, setBossSpeechDucking, startVelkoSupportLayer, stopVelkoSupportLayer, debugState };
})();

function initializeAudio() { return SoundManager.initializeAudio(); }
function unlockAudioFromUserGesture() { SoundManager.unlockAudioFromUserGesture(); }
function startLevelMusic() { SoundManager.startLevelMusic(); }
function pauseMusic() { SoundManager.pauseMusic(); }
function resumeMusic() { SoundManager.resumeMusic(); }
function stopMusic() { SoundManager.stopMusic(); }
function playSfx(type, options) { SoundManager.playSfx(type, options); }
function releaseTransientVoices() { SoundManager.releaseTransientVoices(); }
function setSoundEnabled(enabled) { SoundManager.setSoundEnabled(enabled); }
function unlockAudio() { prepareBossSpeech(); unlockAudioFromUserGesture(); }
function playSound(type, options) { playSfx(type, options); }

const BossSpeech = (() => {
  const synthesis = typeof window !== "undefined" ? window.speechSynthesis : null;
  const Utterance = typeof window !== "undefined" ? window.SpeechSynthesisUtterance : null;
  const supported = Boolean(synthesis && Utterance);
  const PITCH = .38;
  const RATE = .68;
  const VOLUME = .96;
  const COMBAT_EVENTS = new Set(["slam", "charge", "summon", "pizzaCommand"]);
  let prepared = false;
  let selectedVoice = null;
  let bulgarianVoiceFound = false;
  let active = false;
  let introAttempted = false;
  let currentUtterance = null;
  let speechToken = 0;
  let currentPriority = 0;
  let currentEventType = "none";
  let activeSeconds = 0;
  let normalCooldownUntil = 0;
  let playerHitCooldownUntil = 0;
  let pizzaHitCooldownUntil = 0;
  let lastRandomLine = "";
  let lastSpokenPhrase = "";
  let lastSpeechError = "";

  function debugLog(message) {
    if (audioDebugMode) console.info(`[VELKO speech] ${message}`);
  }

  function refreshVoiceSelection() {
    if (!supported) return null;
    const voices = synthesis.getVoices() || [];
    const bulgarianVoices = voices
      .filter((voice) => String(voice.lang || "").toLowerCase().startsWith("bg"))
      .sort((first, second) => Number(Boolean(second.localService)) - Number(Boolean(first.localService)));
    bulgarianVoiceFound = bulgarianVoices.length > 0;
    selectedVoice = bulgarianVoices[0] || voices.find((voice) => voice.default) || voices[0] || null;
    debugLog(selectedVoice
      ? `selected ${selectedVoice.name} (${selectedVoice.lang}); Bulgarian found: ${bulgarianVoiceFound ? "yes" : "no"}`
      : "no installed voice reported; browser default will be requested with bg-BG");
    return selectedVoice;
  }

  function prepare() {
    if (prepared) return supported;
    prepared = true;
    if (!supported) {
      lastSpeechError = "Web Speech API unavailable";
      debugLog(lastSpeechError);
      return false;
    }
    refreshVoiceSelection();
    synthesis.onvoiceschanged = refreshVoiceSelection;
    return true;
  }

  function finishSpeech(token, error = "") {
    if (token !== speechToken) return;
    const wasIntro = currentEventType === "intro";
    active = false;
    currentUtterance = null;
    currentPriority = 0;
    activeSeconds = 0;
    if (error) {
      lastSpeechError = error;
      debugLog(`speech error: ${error}`);
    }
    SoundManager.stopVelkoSupportLayer();
    SoundManager.setBossSpeechDucking(false);
    if (!error || wasIntro) hideVelkoSubtitle();
    if (game.mode === "bossIntro") game.bossSpeechComplete = true;
  }

  function pickLine(eventType) {
    const lines = VELKO_DIALOGUE[eventType] || [];
    if (!lines.length) return "";
    if (lines.length === 1) return lines[0];
    let line = lines[Math.floor(Math.random() * lines.length)];
    if (line === lastRandomLine) line = lines.find((candidate) => candidate !== line) || line;
    lastRandomLine = line;
    return line;
  }

  function canSpeak(eventType, priority) {
    if (COMBAT_EVENTS.has(eventType) && game.time < normalCooldownUntil) return false;
    if (eventType === "playerHit" && game.time < playerHitCooldownUntil) return false;
    if (eventType === "pizzaHitLaugh" && game.time < pizzaHitCooldownUntil) return false;
    if ((active || velkoSubtitleState.active) && priority <= currentPriority) return false;
    return true;
  }

  function applyCooldown(eventType) {
    if (COMBAT_EVENTS.has(eventType)) {
      normalCooldownUntil = game.time + lerp(VELKO_NORMAL_COOLDOWN_MIN, VELKO_NORMAL_COOLDOWN_MAX, Math.random());
    } else if (eventType === "playerHit") {
      playerHitCooldownUntil = game.time + lerp(VELKO_HIT_COOLDOWN_MIN, VELKO_HIT_COOLDOWN_MAX, Math.random());
    } else if (eventType === "pizzaHitLaugh") {
      pizzaHitCooldownUntil = game.time + lerp(PIZZA_HIT_LAUGH_COOLDOWN_MIN, PIZZA_HIT_LAUGH_COOLDOWN_MAX, Math.random());
    } else if (eventType === "phase2" || eventType === "lowHealth") {
      normalCooldownUntil = Math.max(normalCooldownUntil, game.time + VELKO_NORMAL_COOLDOWN_MIN);
    }
  }

  function speak(line, priority, eventType) {
    if (!line || !canSpeak(eventType, priority)) return false;
    if (eventType.startsWith("pizza") && line === lastSpokenPhrase) return false;
    if (eventType.startsWith("pizza")) game.lastPizzaDialogueEvent = eventType;
    if (eventType === "intro") introAttempted = true;
    const replacingLowerPriority = active && priority > currentPriority;
    if (replacingLowerPriority) cancel("priority replacement");
    applyCooldown(eventType);
    currentPriority = priority;
    currentEventType = eventType;
    lastSpokenPhrase = line;
    lastSpeechError = "";
    if (eventType !== "intro") showVelkoSubtitle(line);
    if (!prepared || !supported) {
      lastSpeechError = supported ? "speech not unlocked by player interaction" : "Web Speech API unavailable";
      if (eventType === "intro") currentPriority = 0;
      debugLog(lastSpeechError);
      return false;
    }
    if (!replacingLowerPriority && (synthesis.speaking || synthesis.pending)) {
      lastSpeechError = "speech synthesis is already busy";
      if (eventType === "intro") currentPriority = 0;
      debugLog(lastSpeechError);
      return false;
    }
    refreshVoiceSelection();
    const utterance = new Utterance(line);
    utterance.lang = "bg-BG";
    utterance.pitch = PITCH;
    utterance.rate = RATE;
    utterance.volume = VOLUME;
    if (selectedVoice) utterance.voice = selectedVoice;
    const token = ++speechToken;
    utterance.onend = () => finishSpeech(token);
    utterance.onerror = (event) => finishSpeech(token, event.error || "unknown speech error");
    currentUtterance = utterance;
    active = true;
    activeSeconds = 0;
    SoundManager.setBossSpeechDucking(true);
    SoundManager.startVelkoSupportLayer();
    try {
      synthesis.speak(utterance);
      debugLog(`${eventType} (${priority}): ${line}`);
      return true;
    } catch (error) {
      finishSpeech(token, error && error.message ? error.message : "speechSynthesis.speak failed");
      return false;
    }
  }

  function cancel(reason = "state transition") {
    if (!active && !currentUtterance) {
      SoundManager.stopVelkoSupportLayer();
      SoundManager.setBossSpeechDucking(false);
      hideVelkoSubtitle();
      return false;
    }
    speechToken += 1;
    if (currentUtterance) {
      currentUtterance.onend = null;
      currentUtterance.onerror = null;
    }
    currentUtterance = null;
    active = false;
    currentPriority = 0;
    activeSeconds = 0;
    try { synthesis.cancel(); } catch (_) { /* unavailable browser implementation */ }
    SoundManager.stopVelkoSupportLayer();
    SoundManager.setBossSpeechDucking(false);
    hideVelkoSubtitle();
    debugLog(`active speech cancelled: ${reason}`);
    return true;
  }

  function resetEncounter() {
    cancel("encounter reset");
    introAttempted = false;
    currentEventType = "none";
    normalCooldownUntil = 0;
    playerHitCooldownUntil = 0;
    pizzaHitCooldownUntil = 0;
    lastRandomLine = "";
  }

  function update(dt) {
    if (!active) return;
    activeSeconds += dt;
    if (activeSeconds < 8) return;
    const wasIntro = currentEventType === "intro";
    cancel("speech safety timeout");
    lastSpeechError = "speech safety timeout";
    if (wasIntro && game.mode === "bossIntro") game.bossSpeechComplete = true;
  }

  function onSubtitleHidden() {
    if (!active) currentPriority = 0;
  }

  function debugState() {
    return {
      supported,
      selectedVoiceName: selectedVoice ? selectedVoice.name : "browser default",
      selectedVoiceLanguage: selectedVoice ? selectedVoice.lang : "bg-BG requested",
      bulgarianVoiceFound,
      pitch: PITCH,
      rate: RATE,
      active,
      supportLayerActive: SoundManager.debugState().velkoSupportLayerActive,
      currentEventType,
      currentPriority,
      normalCooldownRemaining: Math.max(0, normalCooldownUntil - game.time),
      playerHitCooldownRemaining: Math.max(0, playerHitCooldownUntil - game.time),
      pizzaHitCooldownRemaining: Math.max(0, pizzaHitCooldownUntil - game.time),
      subtitleActive: velkoSubtitleState.active,
      lastSpokenPhrase,
      lastSpeechError
    };
  }

  return { prepare, refreshVoiceSelection, speak, pickLine, canSpeak, cancel, resetEncounter, update, onSubtitleHidden, isActive: () => active, hasAttemptedThisEncounter: () => introAttempted, debugState };
})();

const RivalSpeech = (() => {
  const synthesis = typeof window !== "undefined" ? window.speechSynthesis : null;
  const Utterance = typeof window !== "undefined" ? window.SpeechSynthesisUtterance : null;
  const debugSpeechDisabled = /(?:\?|&)debugCampaign=1(?:&|$)/.test(window.location.search || "")
    && /(?:\?|&)tts=off(?:&|$)/.test(window.location.search || "");
  const supported = Boolean(synthesis && Utterance) && !debugSpeechDisabled;
  const protectedEvents = new Set(["intro", "introLaugh", "phase2", "playerDeath", "defeated"]);
  const combatEvents = new Set(["bundle", "vehicle", "moneyRain", "attack"]);
  let prepared = false;
  let active = false;
  let currentUtterance = null;
  let currentPriority = 0;
  let currentEventType = "none";
  let currentBossId = "none";
  let token = 0;
  let activeSeconds = 0;
  let normalCooldownUntil = 0;
  let playerHitCooldownUntil = 0;
  let lastRandomLine = "";
  let lastSpokenPhrase = "";
  let lastSpeechError = "";
  let currentOnSettled = null;

  function prepare() {
    prepared = true;
    return supported;
  }

  function selectVoice() {
    if (!supported) return null;
    const voices = synthesis.getVoices() || [];
    return voices.find((voice) => String(voice.lang || "").toLowerCase().startsWith("bg") && voice.localService)
      || voices.find((voice) => String(voice.lang || "").toLowerCase().startsWith("bg"))
      || voices.find((voice) => voice.default) || voices[0] || null;
  }

  function pickLine(bossId, eventType) {
    const lines = RIVAL_DIALOGUE[bossId] && RIVAL_DIALOGUE[bossId][eventType] || [];
    if (!lines.length) return "";
    let line = lines[Math.floor(Math.random() * lines.length)];
    if (line === lastRandomLine) line = lines.find((candidate) => candidate !== line) || line;
    lastRandomLine = line;
    return line;
  }

  function canSpeak(eventType, priority) {
    if (combatEvents.has(eventType) && game.time < normalCooldownUntil) return false;
    if (eventType === "playerHit" && game.time < playerHitCooldownUntil) return false;
    if (active && protectedEvents.has(currentEventType)) return false;
    if ((active || velkoSubtitleState.active) && priority <= currentPriority) return false;
    if (priority <= DIALOGUE_SAFETY.tauntPriorityMax) {
      const boss = activeCampaignBoss();
      if (boss && DIALOGUE_SAFETY.blockedStates.has(boss.state)) return false;
    }
    return true;
  }

  function finishSpeech(speechToken, error = "") {
    if (speechToken !== token) return;
    const onSettled = currentOnSettled;
    active = false;
    currentUtterance = null;
    currentOnSettled = null;
    currentPriority = 0;
    activeSeconds = 0;
    if (error) lastSpeechError = error;
    SoundManager.stopVelkoSupportLayer();
    SoundManager.setBossSpeechDucking(false);
    hideVelkoSubtitle();
    if (onSettled) {
      try { onSettled(error ? "error" : "end", error); }
      catch (callbackError) { game.lastTransitionError = `Speech completion callback failed: ${callbackError && callbackError.message || callbackError}`; }
    }
  }

  function speak(bossId, line, priority, eventType, onSettled = null) {
    if (!line || !canSpeak(eventType, priority)) return false;
    if (active && priority > currentPriority) cancel("priority replacement");
    if (combatEvents.has(eventType)) normalCooldownUntil = game.time + lerp(5, 7, Math.random());
    if (eventType === "playerHit") playerHitCooldownUntil = game.time + lerp(8, 10, Math.random());
    currentPriority = priority;
    currentEventType = eventType;
    currentBossId = bossId;
    lastSpokenPhrase = line;
    lastSpeechError = "";
    currentOnSettled = onSettled;
    const subtitleDuration = eventType === "intro" ? 2.7 : eventType === "introLaugh" ? 1.4 : undefined;
    showBossSubtitle(bossId === "todor" ? "TODOR" : "VELKO", line, subtitleDuration);
    if (tryPlayBankedVoice(bossId, eventType, () => SoundManager.setBossSpeechDucking(false))) {
      SoundManager.setBossSpeechDucking(true);
      currentOnSettled = null;
      if (onSettled) {
        try { onSettled("banked", ""); }
        catch (callbackError) { game.lastTransitionError = `Banked voice callback failed: ${callbackError && callbackError.message || callbackError}`; }
      }
      return true;
    }
    if (!prepared || !supported) {
      lastSpeechError = supported ? "speech not unlocked by player interaction" : "Web Speech API unavailable";
      currentOnSettled = null;
      if (onSettled) {
        try { onSettled("unavailable", lastSpeechError); }
        catch (callbackError) { game.lastTransitionError = `Speech unavailable callback failed: ${callbackError && callbackError.message || callbackError}`; }
      }
      return false;
    }
    if (synthesis.speaking || synthesis.pending) {
      lastSpeechError = "speech synthesis is already busy";
      currentOnSettled = null;
      if (onSettled) {
        try { onSettled("blocked", lastSpeechError); }
        catch (callbackError) { game.lastTransitionError = `Speech blocked callback failed: ${callbackError && callbackError.message || callbackError}`; }
      }
      return false;
    }
    const utterance = new Utterance(line);
    utterance.lang = "bg-BG";
    utterance.pitch = bossId === "todor" ? .46 : .38;
    utterance.rate = bossId === "todor" ? .74 : .68;
    utterance.volume = .94;
    const voice = selectVoice();
    if (voice) utterance.voice = voice;
    const speechToken = ++token;
    utterance.onend = () => finishSpeech(speechToken);
    utterance.onerror = (event) => finishSpeech(speechToken, event.error || "unknown speech error");
    currentUtterance = utterance;
    active = true;
    activeSeconds = 0;
    SoundManager.setBossSpeechDucking(true);
    SoundManager.startVelkoSupportLayer(bossId);
    try {
      synthesis.speak(utterance);
      return true;
    } catch (error) {
      finishSpeech(speechToken, error && error.message ? error.message : "speechSynthesis.speak failed");
      return false;
    }
  }

  function speakEvent(bossId, eventType, priority) {
    const line = pickLine(bossId, eventType);
    return line ? speak(bossId, line, priority, eventType) : false;
  }

  function cancel(_reason = "state transition") {
    token += 1;
    if (currentUtterance) {
      currentUtterance.onend = null;
      currentUtterance.onerror = null;
    }
    currentUtterance = null;
    currentOnSettled = null;
    active = false;
    currentPriority = 0;
    activeSeconds = 0;
    try { if (supported) synthesis.cancel(); } catch (_) { /* browser speech unavailable */ }
    SoundManager.stopVelkoSupportLayer();
    SoundManager.setBossSpeechDucking(false);
    hideVelkoSubtitle();
    return true;
  }

  function resetEncounter() {
    cancel("encounter reset");
    currentEventType = "none";
    currentBossId = "none";
    normalCooldownUntil = 0;
    playerHitCooldownUntil = 0;
    lastRandomLine = "";
  }

  function update(dt) {
    if (!active) return;
    activeSeconds += dt;
    if (activeSeconds >= 8) {
      cancel("speech safety timeout");
      lastSpeechError = "speech safety timeout";
    }
  }

  function onSubtitleHidden() {
    if (!active) currentPriority = 0;
  }

  function debugState() {
    return { supported, active, currentEventType, currentBossId, currentPriority, lastSpokenPhrase, lastSpeechError,
      normalCooldownRemaining: Math.max(0, normalCooldownUntil - game.time), playerHitCooldownRemaining: Math.max(0, playerHitCooldownUntil - game.time) };
  }

  return { prepare, speak, speakEvent, pickLine, canSpeak, cancel, resetEncounter, update, onSubtitleHidden, isActive: () => active, debugState };
})();

function getBulgarianBossVoice() { return BossSpeech.refreshVoiceSelection(); }
function prepareBossSpeech() { RivalSpeech.prepare(); return BossSpeech.prepare(); }
function canVelkoSpeak(eventType, priority) { return BossSpeech.canSpeak(eventType, priority); }
function speakVelkoLine(line, priority, eventType) { return BossSpeech.speak(line, priority, eventType); }
function speakVelkoEvent(eventType, priority) {
  if (!canVelkoSpeak(eventType, priority)) return false;
  const line = BossSpeech.pickLine(eventType);
  return line ? speakVelkoLine(line, priority, eventType) : false;
}
function cancelBossSpeech(reason = "state transition") {
  const velkoCancelled = BossSpeech.cancel(reason);
  const rivalCancelled = RivalSpeech.cancel(reason);
  return velkoCancelled || rivalCancelled;
}

function vibrate(pattern) {
  if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(pattern);
}

// -----------------------------------------------------------------------------
// Player
// -----------------------------------------------------------------------------

const MAX_PLAYER_LIVES = 3;
const CINDERWIND_HOLD_GRACE = .25;
const player = {
  x: 120,
  y: GROUND_Y - 72,
  w: 40,
  h: 72,
  vx: 0,
  vy: 0,
  facing: 1,
  grounded: true,
  coyote: 0,
  lives: MAX_PLAYER_LIVES,
  armorBroken: false,
  invulnerable: 0,
  hurtTimer: 0,
  attackTimer: 0,
  attackId: 0,
  attackWeapon: "spear",
  attackReleased: false,
  attackConnected: false,
  attackHit: new Set(),
  animationState: "idle",
  animationTime: 0,
  takeoffTimer: 0,
  landingTimer: 0,
  skidTimer: 0,
  armorBreakTimer: 0,
  comboStep: 0,
  comboQueued: false,
  comboWindow: 0,
  moveIntent: 0,
  walkCycle: 0,
  turnLean: 0,
  throwRecoil: 0,
  dustTimer: 0,
  weapon: "spear"
};

function playerRect() {
  return { x: player.x + 7, y: player.y + 5, w: player.w - 14, h: player.h - 5 };
}

function resetPlayer() {
  Object.assign(player, {
    x: 120, y: GROUND_Y - 72, vx: 0, vy: 0, facing: 1, grounded: true,
    coyote: 0, lives: MAX_PLAYER_LIVES, armorBroken: false, invulnerable: 0, hurtTimer: 0,
    attackTimer: 0, attackId: 0, attackWeapon: "spear", attackReleased: false,
    attackConnected: false, animationState: "idle", animationTime: 0, takeoffTimer: 0,
    landingTimer: 0, skidTimer: 0, armorBreakTimer: 0,
    comboStep: 0, comboQueued: false, comboWindow: 0, moveIntent: 0, walkCycle: 0,
    turnLean: 0, throwRecoil: 0, dustTimer: 0, weapon: "spear"
  });
  player.attackHit.clear();
}

function resolvePlayerAnimationState(move) {
  if (player.lives <= 0) return "death";
  if (game.mode === "victory") return "victoryIdle";
  if (player.armorBreakTimer > 0) return "armorBreak";
  if (player.hurtTimer > 0) return "hurt";
  if (player.attackTimer > 0) {
    if (player.attackWeapon === "spear") return "spearThrow";
    if (player.attackWeapon === "torch") return "torchThrow";
    if (player.attackWeapon === "dagger") return `daggerCombo${player.comboStep || 1}`;
    return "daggerCombo1";
  }
  if (player.takeoffTimer > 0) return "jumpTakeoff";
  if (!player.grounded) return player.vy < -45 ? "rising" : "falling";
  if (player.landingTimer > 0) return "landing";
  if (player.skidTimer > 0) return "skid";
  if (Math.abs(player.turnLean) > .08) return "turn";
  if (move && Math.abs(player.vx) < 120) return "startMoving";
  if (Math.abs(player.vx) >= 25) return "run";
  return Math.sin(game.time * .72) > .76 ? "idleBreathing" : "idle";
}

function setPlayerAnimationState(next) {
  if (player.animationState === next) return;
  player.animationState = next;
  player.animationTime = 0;
}

function updatePlayer(dt) {
  const move = player.lives > 0 ? (input.right ? 1 : 0) - (input.left ? 1 : 0) : 0;
  const oldFacing = player.facing;
  const targetSpeed = move * 205;
  const reversing = move !== 0 && Math.sign(player.vx) !== move && Math.abs(player.vx) > 35;
  const acceleration = reversing ? 3900 : player.grounded ? 2950 : 1750;
  player.vx = approach(player.vx, targetSpeed, acceleration * dt);
  if (!move) {
    if (player.moveIntent && player.grounded && Math.abs(player.vx) > 70) {
      player.skidTimer = .13;
      dustBurst(player.x + player.w / 2, player.y + player.h, 4, 60, -player.moveIntent);
    }
    player.vx = approach(player.vx, 0, (player.grounded ? 3400 : 720) * dt);
  }
  if (move) {
    player.facing = move;
    if (oldFacing !== move && player.grounded) {
      player.turnLean = -move * 0.24;
      player.skidTimer = .16;
      dustBurst(player.x + player.w / 2, player.y + player.h, 5, 70, -move);
    }
  }
  player.turnLean = approach(player.turnLean, 0, dt * 1.9);
  player.throwRecoil = approach(player.throwRecoil, 0, dt * 2.8);

  player.coyote = player.grounded ? 0.12 : Math.max(0, player.coyote - dt);
  input.jumpBuffer = Math.max(0, input.jumpBuffer - dt);
  if (player.lives > 0 && input.jumpBuffer > 0 && (player.grounded || player.coyote > 0)) {
    player.vy = -430;
    player.takeoffTimer = .085;
    player.grounded = false;
    player.coyote = 0;
    input.jumpBuffer = 0;
    dustBurst(player.x + player.w / 2, player.y + player.h, 7, 90, -move);
    playSound("jump");
  }

  if (player.lives > 0 && input.attackQueued) beginAttack();
  input.attackQueued = false;
  const rangedWeaponHeld = WEAPONS[player.weapon].kind === "projectile";
  if (player.lives > 0 && game.levelAmuletState === "active" && input.attackHeld && rangedWeaponHeld) {
    input.attackHoldTime += dt;
    input.autofireCooldown = Math.max(0, input.autofireCooldown - dt);
    input.autofireActive = input.attackHoldTime >= CINDERWIND_HOLD_GRACE;
    if (input.autofireActive && input.autofireCooldown <= 0 && player.attackTimer <= 0) {
      beginAttack();
      input.autofireCooldown = player.weapon === "torch" ? .52 : .24;
    }
  } else if (!input.attackHeld || !rangedWeaponHeld) {
    input.attackHoldTime = 0;
    input.autofireCooldown = 0;
    input.autofireActive = false;
  }

  const wasGrounded = player.grounded;
  const fallSpeed = player.vy;
  const gravity = player.vy < 0 && input.jumpHeld ? 940 : 1500;
  player.vy = Math.min(790, player.vy + gravity * dt);
  movePlayerX(player.vx * dt);
  movePlayerY(player.vy * dt);

  if (!wasGrounded && player.grounded && fallSpeed > 130) {
    player.landingTimer = fallSpeed > 360 ? .16 : .1;
    dustRing(player.x + player.w / 2, player.y + player.h, fallSpeed > 360 ? 12 : 8);
    addShake(fallSpeed > 420 ? "medium" : "light");
    playSound("landing");
  }

  if (Math.abs(player.vx) > 8 && player.grounded) {
    player.walkCycle += dt * Math.abs(player.vx) * 0.06;
    player.dustTimer -= dt;
    if (player.dustTimer <= 0 && Math.abs(player.vx) > 120) {
      player.dustTimer = 0.11;
      dustBurst(player.x + player.w / 2 - player.facing * 11, player.y + player.h, 2, 42, -player.facing);
      playSound("footstep");
    }
  }
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.hurtTimer = Math.max(0, player.hurtTimer - dt);
  player.armorBreakTimer = Math.max(0, player.armorBreakTimer - dt);
  player.takeoffTimer = Math.max(0, player.takeoffTimer - dt);
  player.landingTimer = Math.max(0, player.landingTimer - dt);
  player.skidTimer = Math.max(0, player.skidTimer - dt);
  player.comboWindow = Math.max(0, player.comboWindow - dt);
  if (player.attackTimer > 0) {
    player.attackTimer = Math.max(0, player.attackTimer - dt);
    if (player.attackTimer === 0) {
      if (!player.attackConnected && WEAPONS[player.attackWeapon].kind === "melee") playSound("miss");
      if (player.attackWeapon === "dagger" && player.comboQueued && player.comboWindow > 0) {
        player.comboQueued = false;
        beginAttack(true);
      } else if (player.attackWeapon === "dagger") {
        player.comboStep = 0;
        player.comboQueued = false;
      }
    }
  }
  setPlayerAnimationState(resolvePlayerAnimationState(move));
  player.animationTime += dt;
  player.moveIntent = move;
  if (amuletIcon) amuletIcon.classList.toggle("autofire-active", game.levelAmuletState === "active" && input.autofireActive);
}

function movePlayerX(amount) {
  player.x += amount;
  const hitbox = playerRect();
  for (const grave of getSolidObstacles()) {
    const solid = graveHitbox(grave);
    if (!overlap(hitbox, solid)) continue;
    if (hitbox.y + hitbox.h <= solid.y + 13) continue;
    if (amount > 0) player.x = solid.x - (player.w - 7);
    if (amount < 0) player.x = solid.x + solid.w - 7;
    player.vx = 0;
    hitbox.x = player.x + 7;
  }
  const arenaLeft = game.currentLevel === 0 ? ARENA_LEFT : game.levelArenaLeft;
  const arenaRight = game.currentLevel === 0 ? ARENA_RIGHT : game.levelArenaRight;
  const minimumX = game.arenaLocked ? arenaLeft + 18 : 12;
  const maximumX = game.arenaLocked ? arenaRight - player.w - 18 : WORLD_W - player.w - 20;
  player.x = clamp(player.x, minimumX, maximumX);
}

function movePlayerY(amount) {
  const previousBottom = player.y + player.h;
  player.y += amount;
  player.grounded = false;

  if (player.y + player.h >= GROUND_Y && hasGroundAt(player.x + player.w / 2)) {
    player.y = GROUND_Y - player.h;
    player.vy = 0;
    player.grounded = true;
  }

  if (amount >= 0) {
    const hitbox = playerRect();
    for (const grave of getSolidObstacles()) {
      const solid = graveHitbox(grave);
      if (hitbox.x + hitbox.w <= solid.x || hitbox.x >= solid.x + solid.w) continue;
      if (previousBottom <= solid.y + 5 && player.y + player.h >= solid.y) {
        player.y = solid.y - player.h;
        player.vy = 0;
        player.grounded = true;
      }
    }
  }

  if (game.currentLevel === 3 && player.y > VIEW_H + 72) rescueFromViaductFall();
}

function damagePlayer(sourceX, heavy = false) {
  if (player.invulnerable > 0 || game.mode !== "running") return false;
  const armorWasIntact = !player.armorBroken;
  player.lives -= 1;
  shatterLevelAmulet();
  player.armorBroken = true;
  player.armorBreakTimer = armorWasIntact ? .26 : 0;
  player.invulnerable = 1.05;
  player.hurtTimer = 0.48;
  player.vx = player.x < sourceX ? -230 : 230;
  player.vy = heavy ? -330 : -260;
  addShake(heavy ? "heavy" : "medium");
  game.flash = 0.18;
  impactBurst(player.x + player.w / 2, player.y + 32, armorWasIntact ? 12 : 8, "#d9e0dc", 180, -Math.sign(player.vx));
  impactBurst(player.x + player.w / 2, player.y + 32, 5, "#a83d3a", 115, -Math.sign(player.vx));
  playSound("hurt");
  if (armorWasIntact) playSound("armorBreak");
  if (player.lives === 1) playSound("lastLife");
  vibrate(35);
  updateHUD();
  if (player.lives <= 0) {
    player.hurtTimer = 1.2;
    game.endTimer = 0.65;
    game.endVictory = false;
    if (game.bossSpawned && !game.bossDefeated) {
      const profile = BOSS_PROFILES[game.activeBossProfile];
      if (profile) RivalSpeech.speakEvent(profile.bossId, "playerDeath", 6);
      else speakVelkoEvent("playerDeath", VELKO_PRIORITY.playerDeath);
    }
    stopPizzaEncounter(false);
  }
  return true;
}

// -----------------------------------------------------------------------------
// Weapons
// -----------------------------------------------------------------------------

const WEAPONS = {
  spear: { name: "Spear", detail: "Long-range projectile", kind: "projectile", cooldown: 0.28, release: 0.08, activeStart: 0.08, activeEnd: 0.105, damage: 1.25 },
  dagger: { name: "Swift Dagger", detail: "Rapid close melee", kind: "melee", cooldown: 0.19, activeStart: 0.035, activeEnd: 0.105, range: 55, damage: 0.62 },
  torch: { name: "Ember Torch", detail: "Arcing fire projectile", kind: "projectile", cooldown: 0.56, release: 0.16, activeStart: 0.16, activeEnd: 0.19, damage: 1.35 },
  rusty: { name: "Rusty Dagger", detail: "Last-resort melee weapon", kind: "melee", cooldown: 0.29, activeStart: 0.065, activeEnd: 0.145, range: 43, damage: 0.38 }
};

function beginAttack(chained = false) {
  const weapon = WEAPONS[player.weapon];
  if (player.attackTimer > 0) {
    if (player.attackWeapon === "dagger" && player.weapon === "dagger") player.comboQueued = true;
    return;
  }
  if (player.hurtTimer > 0 || game.mode !== "running") return;
  if (player.weapon === "dagger") {
    player.comboStep = chained ? (player.comboStep % 3) + 1 : 1;
    player.comboWindow = .3;
    player.comboQueued = false;
  } else {
    player.comboStep = 0;
  }
  player.attackTimer = weapon.cooldown;
  player.attackId += 1;
  player.attackWeapon = player.weapon;
  player.attackReleased = false;
  player.attackConnected = false;
  player.attackHit.clear();
  if (weapon.kind === "melee") playSound("slash");
}

function updateWeaponHits() {
  if (player.attackTimer <= 0) return;
  const weaponKey = player.attackWeapon;
  const weapon = WEAPONS[weaponKey];
  const elapsed = weapon.cooldown - player.attackTimer;
  if (weapon.kind === "projectile") {
    if (!player.attackReleased && elapsed >= weapon.release) releaseProjectile(weaponKey);
    return;
  }
  if (elapsed < weapon.activeStart || elapsed > weapon.activeEnd) return;

  const front = player.facing > 0 ? player.x + player.w - 4 : player.x - weapon.range + 4;
  const attackBox = { x: front, y: player.y + 14, w: weapon.range, h: 46 };
  if (player.facing < 0) attackBox.w = weapon.range;

  for (const enemy of enemies) {
    if (enemy.dead || enemy.hiddenInVehicle || UNTARGETABLE_ENEMY_STATES.has(enemy.state) || player.attackHit.has(enemy.id)) continue;
    const target = enemyHitbox(enemy);
    const directHit = overlap(attackBox, target);
    if (directHit) {
      const impactSound = player.attackWeapon === "dagger" ? "daggerHit" : "enemyHit";
      hitEnemy(enemy, weapon.damage, player.facing, false, impactSound);
      player.attackHit.add(enemy.id);
      player.attackConnected = true;
    }
  }
  for (let index = projectiles.length - 1; index >= 0; index--) {
    const projectile = projectiles[index];
    if (!BOSS_DESTRUCTIBLE_PROJECTILES.has(projectile.type) || !overlap(attackBox, projectileHitbox(projectile))) continue;
    destroyBossProjectile(projectile, index);
    player.attackConnected = true;
  }
  for (const crate of levelCrates) {
    if (!crate.broken && overlap(attackBox, crateHitbox(crate))) breakCrate(crate, player.facing);
  }
}

function distanceToRect(x, y, rect) {
  const dx = Math.max(rect.x - x, 0, x - (rect.x + rect.w));
  const dy = Math.max(rect.y - y, 0, y - (rect.y + rect.h));
  return Math.hypot(dx, dy);
}

const projectiles = [];
const projectilePool = [];
const PROJECTILE_LIMITS = { spear: 4, torch: 3, pizza: MAX_PIZZA_PROJECTILES, lanternOrb: 2, zombieBolt: 3, moneyBundle: 3, bossShockwave: 2 };
const BOSS_DESTRUCTIBLE_PROJECTILES = new Set(["lanternOrb", "zombieBolt", "moneyBundle"]);

function projectileLimit(type) {
  const profile = currentRangedProfile();
  if (profile && type === "lanternOrb") return profile.orbMax;
  if (profile && type === "zombieBolt") return profile.boltMax;
  return PROJECTILE_LIMITS[type];
}

function acquireProjectile(data) {
  const projectile = projectilePool.pop() || {};
  Object.assign(projectile, data);
  projectiles.push(projectile);
  return projectile;
}

function releaseProjectileAt(index) {
  const projectile = projectiles[index];
  if (!projectile) return;
  projectiles.splice(index, 1);
  if (projectilePool.length < 10) projectilePool.push(projectile);
}

function destroyBossProjectile(projectile, index, reason = "destroyed by player") {
  const money = projectile.type === "moneyBundle";
  burst(projectile.x, projectile.y, money ? 9 : 7, money ? "#d4c59a" : "#8ed8e6", money ? 105 : 85);
  if (money) {
    game.score += 25;
    addScorePopup(projectile.x, projectile.y - 10, "+25", "#d8c889");
    updateHUD();
  }
  game.lastClearedProjectileReason = reason;
  releaseProjectileAt(index);
}

function enforceProjectileLimit(type) {
  const limit = projectileLimit(type);
  while (projectiles.filter((projectile) => projectile.type === type && projectile.life > 0).length >= limit) {
    const oldest = projectiles.findIndex((projectile) => projectile.type === type && projectile.life > 0);
    if (oldest < 0) break;
    if (type === "torch") burst(projectiles[oldest].x, projectiles[oldest].y, 6, "#5d5146", 55);
    releaseProjectileAt(oldest);
  }
}

function releaseProjectile(type) {
  if (player.attackReleased) return;
  enforceProjectileLimit(type);
  const direction = player.facing;
  const common = {
    type,
    x: player.x + player.w / 2 + direction * 28,
    y: player.y + 29,
    startX: player.x,
    direction,
    angle: direction > 0 ? -0.06 : Math.PI + 0.06,
    state: "flying",
    nextTrailAt: game.time,
    life: type === "spear" ? 1.35 : 2.2
  };
  if (type === "spear") {
    acquireProjectile({ ...common, vx: direction * 650, vy: 0, w: 76, h: 10 });
  } else {
    acquireProjectile({ ...common, vx: direction * 345, vy: -185, w: 30, h: 30 });
  }
  player.attackReleased = true;
  player.attackConnected = true;
  player.throwRecoil = type === "torch" ? -0.18 : -0.1;
  addShake(type === "torch" ? "medium" : "light");
  impactBurst(common.x, common.y, type === "torch" ? 7 : 4, type === "torch" ? "#ff8a32" : "#d9ded8", type === "torch" ? 120 : 80, direction);
  playSound(type === "torch" ? "torchThrow" : "spearThrow");
  vibrate(type === "torch" ? 14 : 8);
}

function projectileHitbox(projectile) {
  if (projectile.type === "spear") return { x: projectile.x - 38, y: projectile.y - 5, w: 76, h: 10 };
  if (projectile.type === "pizza") return { x: projectile.x - 9, y: projectile.y - 7, w: 18, h: 14 };
  if (projectile.type === "lanternOrb") return { x: projectile.x - 10, y: projectile.y - 10, w: 20, h: 20 };
  if (projectile.type === "zombieBolt") return { x: projectile.x - 11, y: projectile.y - 6, w: 22, h: 12 };
  if (projectile.type === "moneyBundle") return { x: projectile.x - 13, y: projectile.y - 9, w: 26, h: 18 };
  if (projectile.type === "bossShockwave") return { x: projectile.x - 23, y: projectile.y - 16, w: 46, h: 20 };
  return { x: projectile.x - 12, y: projectile.y - 12, w: 24, h: 24 };
}

function finishPizzaProjectile(index, result, splat = false) {
  const projectile = projectiles[index];
  if (!projectile || projectile.type !== "pizza") return;
  game.lastPizzaProjectileResult = result;
  if (splat) pizzaSplat(projectile.x, Math.min(projectile.y, GROUND_Y - 4), projectile.direction);
  releaseProjectileAt(index);
}

function updateProjectiles(dt) {
  for (let index = projectiles.length - 1; index >= 0; index--) {
    const projectile = projectiles[index];
    if (!projectile) continue;
    projectile.life -= dt;
    if (projectile.life <= 0) {
      if (projectile.type === "pizza") finishPizzaProjectile(index, "expired");
      else releaseProjectileAt(index);
      continue;
    }
    if (projectile.state !== "flying") continue;

    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    if (projectile.x < -100 || projectile.x > WORLD_W + 100 || projectile.y > VIEW_H + 120 || projectile.y < -120) {
      if (projectile.type === "pizza") finishPizzaProjectile(index, "expired");
      else releaseProjectileAt(index);
      continue;
    }

    if (projectile.type === "spear") {
      if (game.time >= projectile.nextTrailAt) {
        playSound("spearTrail");
        projectile.nextTrailAt = game.time + 0.16;
      }
      projectile.angle = (projectile.direction > 0 ? 0 : Math.PI) + Math.sin(game.time * 18) * 0.035;
      const orbIndex = projectiles.findIndex((target, targetIndex) => targetIndex !== index && BOSS_DESTRUCTIBLE_PROJECTILES.has(target.type) && overlap(projectileHitbox(projectile), projectileHitbox(target)));
      if (orbIndex >= 0) {
        const orb = projectiles[orbIndex];
        destroyBossProjectile(orb, orbIndex);
        const adjustedIndex = orbIndex < index ? index - 1 : index;
        const currentSpear = projectiles[adjustedIndex];
        if (currentSpear) { currentSpear.state = "stuck"; currentSpear.life = .1; }
        continue;
      }
      let struck = null;
      for (const enemy of enemies) {
        if (enemy.dead || enemy.hiddenInVehicle || UNTARGETABLE_ENEMY_STATES.has(enemy.state)) continue;
        if (overlap(projectileHitbox(projectile), enemyHitbox(enemy))) {
          struck = enemy;
          break;
        }
      }
      const struckCrate = levelCrates.find((crate) => !crate.broken && overlap(projectileHitbox(projectile), crateHitbox(crate)));
      if (struckCrate) {
        breakCrate(struckCrate, projectile.direction);
        projectile.state = "stuck";
        projectile.life = .1;
      } else if (struck) {
        hitEnemy(struck, WEAPONS.spear.damage, projectile.direction, false, "spearImpact");
        projectile.state = "stuck";
        projectile.life = 0.12;
        projectile.x -= projectile.direction * 15;
      } else if (getSolidObstacles().some((grave) => overlap(projectileHitbox(projectile), graveHitbox(grave)))) {
        projectile.state = "stuck";
        projectile.life = 0.11;
        playSound("spearDull");
        impactBurst(projectile.x, projectile.y, 6, "#b7b2a4", 90, -projectile.direction);
      } else if (Math.abs(projectile.x - projectile.startX) > 720) {
        projectile.life = 0;
      }
    } else if (projectile.type === "pizza") {
      projectile.vy += projectile.gravity * dt;
      projectile.angle += projectile.spin * dt;
      if (game.time >= projectile.nextTrailAt) {
        projectile.nextTrailAt = game.time + .13;
        emitParticle({ x: projectile.x - projectile.direction * 6, y: projectile.y - 5,
          vx: -projectile.vx * .035, vy: -18, size: 1.8, life: .28, maxLife: .28,
          color: "#b7aaa0", gravity: -5, kind: "steam", source: "pizza" });
      }
      if (!projectile.hitPlayer && overlap(projectileHitbox(projectile), playerRect())) {
        projectile.hitPlayer = true;
        const damaged = damagePlayer(projectile.x, false);
        if (damaged) speakVelkoEvent("pizzaHitLaugh", VELKO_PRIORITY.pizzaHit);
        finishPizzaProjectile(index, "hitPlayer", true);
        continue;
      }
      const hitGrave = getSolidObstacles().some((grave) => overlap(projectileHitbox(projectile), graveHitbox(grave)));
      const hitGround = projectile.y + 8 >= GROUND_Y;
      const hitArena = projectile.x <= ARENA_LEFT + 18 || projectile.x >= ARENA_RIGHT - 18;
      if (hitGrave || hitGround || hitArena) {
        finishPizzaProjectile(index, "hitTerrain", true);
        continue;
      }
    } else if (projectile.type === "lanternOrb") {
      projectile.angle += dt * 2.8;
      if (Math.random() < dt * 18) emitParticle({ x: projectile.x, y: projectile.y, vx: -projectile.vx * .04, vy: (Math.random() - .5) * 18,
        size: 1.5 + Math.random() * 1.5, life: .3, maxLife: .3, color: "#79b9d1", gravity: -4, kind: "soul" });
      if (!projectile.hitPlayer && overlap(projectileHitbox(projectile), playerRect())) {
        projectile.hitPlayer = true;
        damagePlayer(projectile.x, false);
        releaseProjectileAt(index);
        continue;
      }
      const blocked = getSolidObstacles().some((solid) => overlap(projectileHitbox(projectile), graveHitbox(solid)));
      if (blocked || !hasGroundAt(projectile.x) && projectile.y > GROUND_Y) {
        burst(projectile.x, projectile.y, 6, "#6aa5bd", 65);
        releaseProjectileAt(index);
      }
    } else if (projectile.type === "zombieBolt") {
      projectile.angle = Math.atan2(projectile.vy, projectile.vx);
      if (game.time >= projectile.nextTrailAt) {
        projectile.nextTrailAt = game.time + .11;
        emitParticle({ x: projectile.x, y: projectile.y, vx: -projectile.vx * .035, vy: -4,
          size: 1.4, life: .24, maxLife: .24, color: projectile.color || "#a75a62", gravity: 0, kind: "ember", source: "zombieBolt" });
      }
      if (!projectile.hitPlayer && overlap(projectileHitbox(projectile), playerRect())) {
        projectile.hitPlayer = true;
        damagePlayer(projectile.x, false);
        burst(projectile.x, projectile.y, 6, projectile.color || "#a75a62", 72);
        releaseProjectileAt(index);
        continue;
      }
      const blocked = getSolidObstacles().some((solid) => overlap(projectileHitbox(projectile), graveHitbox(solid)));
      if (blocked || projectile.y + 7 >= GROUND_Y || projectile.x < 10 || projectile.x > WORLD_W - 10) {
        burst(projectile.x, projectile.y, 5, projectile.color || "#a75a62", 58);
        releaseProjectileAt(index);
      }
    } else if (projectile.type === "moneyBundle") {
      projectile.vy += projectile.gravity * dt;
      projectile.angle += projectile.spin * dt;
      if (!projectile.hitPlayer && overlap(projectileHitbox(projectile), playerRect())) {
        projectile.hitPlayer = true;
        if (damagePlayer(projectile.x, false)) RivalSpeech.speakEvent("todor", "playerHit", 2);
        game.lastClearedProjectileReason = "money bundle hit player";
        releaseProjectileAt(index);
        continue;
      }
      if (projectile.y + 10 >= GROUND_Y) {
        paperBurst(projectile.x, GROUND_Y - 5, 7);
        game.lastClearedProjectileReason = "money bundle hit terrain";
        releaseProjectileAt(index);
      }
    } else if (projectile.type === "bossShockwave") {
      if (!projectile.hitPlayer && overlap(projectileHitbox(projectile), playerRect())) {
        projectile.hitPlayer = true;
        damagePlayer(projectile.x, true);
      }
      if (projectile.x <= game.levelArenaLeft + 12 || projectile.x >= game.levelArenaRight - 12) {
        game.lastClearedProjectileReason = "boss shockwave reached arena edge";
        releaseProjectileAt(index);
      }
    } else {
      if (game.time >= projectile.nextTrailAt) {
        playSound("torchCrackle");
        projectile.nextTrailAt = game.time + 0.18;
      }
      projectile.vy += 520 * dt;
      projectile.angle += projectile.direction * dt * 9;
      if (Math.random() < dt * 34) {
        emitParticle({
          x: projectile.x + (Math.random() - 0.5) * 10,
          y: projectile.y + (Math.random() - 0.5) * 8,
          vx: -projectile.vx * 0.08 + (Math.random() - 0.5) * 28,
          vy: -30 - Math.random() * 35,
          size: 1.5 + Math.random() * 2.5,
          life: 0.28 + Math.random() * 0.22,
          maxLife: 0.5,
          color: Math.random() > 0.4 ? "#ffb23f" : "#e85329",
          gravity: -10, kind: "ember"
        });
      }
      const hitEnemyTarget = enemies.find((enemy) => !enemy.dead && !enemy.hiddenInVehicle && !UNTARGETABLE_ENEMY_STATES.has(enemy.state) && overlap(projectileHitbox(projectile), enemyHitbox(enemy)));
      const hitBossProjectile = projectiles.some((target) => target !== projectile && BOSS_DESTRUCTIBLE_PROJECTILES.has(target.type) && overlap(projectileHitbox(projectile), projectileHitbox(target)));
      const hitGrave = getSolidObstacles().some((grave) => overlap(projectileHitbox(projectile), graveHitbox(grave)));
      const hitCrate = levelCrates.find((crate) => !crate.broken && overlap(projectileHitbox(projectile), crateHitbox(crate)));
      if (hitCrate) breakCrate(hitCrate, projectile.direction);
      if (hitEnemyTarget || hitBossProjectile || hitGrave || hitCrate || projectile.y >= GROUND_Y - 10) explodeTorch(projectile);
    }
  }
}

function explodeTorch(projectile) {
  if (projectile.state !== "flying") return;
  projectile.state = "burst";
  projectile.life = 0.16;
  projectile.vx = 0;
  projectile.vy = 0;
  const radius = 82;
  for (const enemy of enemies) {
    if (enemy.dead || enemy.hiddenInVehicle || UNTARGETABLE_ENEMY_STATES.has(enemy.state)) continue;
    const distance = distanceToRect(projectile.x, projectile.y, enemyHitbox(enemy));
    if (distance <= radius) {
      const damage = distance < 28 ? WEAPONS.torch.damage : WEAPONS.torch.damage * 0.52;
      hitEnemy(enemy, damage, projectile.direction, true, null);
    }
  }
  for (let index = projectiles.length - 1; index >= 0; index--) {
    const target = projectiles[index];
    if (target === projectile || !BOSS_DESTRUCTIBLE_PROJECTILES.has(target.type) || Math.hypot(target.x - projectile.x, target.y - projectile.y) > radius) continue;
    destroyBossProjectile(target, index);
  }
  playSound("torchImpact");
  playSound("flameSplash");
  addShake("medium");
  impactBurst(projectile.x, Math.min(projectile.y, GROUND_Y - 6), 14, "#f06a2d", 205, projectile.direction);
  impactBurst(projectile.x, Math.min(projectile.y, GROUND_Y - 6), 7, "#ffd35c", 135, projectile.direction);
}

// -----------------------------------------------------------------------------
// World obstacles and decoration
// -----------------------------------------------------------------------------

const graves = [
  { x: 510, y: 367, w: 46, h: 63, style: 0 },
  { x: 935, y: 380, w: 55, h: 50, style: 1 },
  { x: 1420, y: 356, w: 48, h: 74, style: 2 },
  { x: 1845, y: 375, w: 68, h: 55, style: 0 },
  { x: 2390, y: 363, w: 52, h: 67, style: 1 },
  { x: 2860, y: 350, w: 50, h: 80, style: 2 },
  { x: 3320, y: 374, w: 72, h: 56, style: 0 },
  { x: 3810, y: 360, w: 50, h: 70, style: 1 },
  { x: 4290, y: 370, w: 60, h: 60, style: 2 },
  { x: 4770, y: 350, w: 51, h: 80, style: 0 },
  { x: 5260, y: 375, w: 68, h: 55, style: 1 },
  { x: 5660, y: 355, w: 48, h: 75, style: 2 },
  { x: 6080, y: 367, w: 66, h: 63, style: 0 }
];

function getSolidObstacles() {
  return game.currentLevel === 0 ? graves : currentLevelDefinition().obstacles;
}

function hasGroundAt(x) {
  if (game.currentLevel !== 3) return true;
  return !currentLevelDefinition().gaps.some((gap) => x > gap.x && x < gap.x + gap.w);
}

function rescueFromViaductFall() {
  const penalty = Math.min(100, game.score);
  game.score -= penalty;
  player.x = game.bossEncounterState === "active" ? game.levelArenaLeft + 82 : game.safeAnchorX;
  player.y = GROUND_Y - player.h;
  player.vx = 0;
  player.vy = 0;
  player.grounded = true;
  player.invulnerable = Math.max(player.invulnerable, 1.35);
  player.hurtTimer = 0;
  for (const enemy of enemies) {
    if (!enemy.dead && Math.abs(enemy.x - player.x) < 190) enemy.attackCooldown = Math.max(enemy.attackCooldown, 1.25);
  }
  for (let index = projectiles.length - 1; index >= 0; index--) {
    if (projectiles[index].type === "lanternOrb") releaseProjectileAt(index);
  }
  fallingStones.length = 0;
  game.fallPenaltyReady = false;
  updateHUD();
  dustRing(player.x + player.w / 2, GROUND_Y - 2, 10);
}

// The painted cap is decorative/rounded. Collision uses only the inner stone
// mass, so empty corners near the silhouette never block the player.
function graveHitbox(grave) {
  const roundedCap = grave.style === 1 ? 3 : 9;
  const sideInset = grave.style === 1 ? 6 : 9;
  return {
    x: grave.x + sideInset,
    y: grave.y + roundedCap,
    w: grave.w - sideInset * 2,
    h: grave.h - roundedCap
  };
}

const trees = [260, 1130, 2110, 3120, 4050, 5010, 5940, 6840];

function pizzaZombieLimit() {
  return game.bossPhase === 2 ? 3 : 2;
}

function activePizzaZombieCount() {
  return enemies.filter((enemy) => enemy.type === "pizzaZombie" && !enemy.dead).length;
}

function activePizzaProjectileCount() {
  return projectiles.filter((projectile) => projectile.type === "pizza" && projectile.life > 0).length;
}

function requestPizzaZombieSpawn(delay = .7, amount = 1) {
  if (!game.pizzaSequenceActive || game.bossDefeated) return false;
  const capacity = pizzaZombieLimit() - activePizzaZombieCount() - game.pizzaPendingSpawns;
  const accepted = Math.min(amount, Math.max(0, capacity));
  if (accepted <= 0) return false;
  game.pizzaPendingSpawns += accepted;
  if (game.pizzaNextSpawnTimer < 0) game.pizzaNextSpawnTimer = delay;
  return true;
}

function beginPizzaReinforcements() {
  game.pizzaSequenceActive = true;
  game.pizzaPendingSpawns = 0;
  game.pizzaNextSpawnTimer = -1;
  game.pizzaSpawnOrdinal = 0;
  requestPizzaZombieSpawn(.72, 2);
}

function choosePizzaZombieSpawnX() {
  const boss = enemies.find((enemy) => enemy.type === "boss" && !enemy.dead);
  const bossCenter = boss ? boss.x + boss.w / 2 : (ARENA_LEFT + ARENA_RIGHT) / 2;
  const awayFromPlayer = player.x < bossCenter ? 1 : -1;
  const alternatingSide = game.pizzaSpawnOrdinal % 2 === 0 ? awayFromPlayer : -awayFromPlayer;
  let candidate = bossCenter + alternatingSide * (145 + (game.pizzaSpawnOrdinal % 2) * 45);
  candidate = clamp(candidate, ARENA_LEFT + 95, ARENA_RIGHT - 115);
  if (Math.abs(candidate - player.x) < 220) {
    candidate = clamp(bossCenter - alternatingSide * 190, ARENA_LEFT + 95, ARENA_RIGHT - 115);
  }
  return candidate;
}

function updatePizzaSpawner(dt) {
  if (!game.pizzaSequenceActive || game.bossDefeated || game.pizzaPendingSpawns <= 0) return;
  game.pizzaNextSpawnTimer -= dt;
  if (game.pizzaNextSpawnTimer > 0) return;
  if (activePizzaZombieCount() >= pizzaZombieLimit()) {
    game.pizzaPendingSpawns = 0;
    game.pizzaNextSpawnTimer = -1;
    return;
  }
  spawnEnemy("pizzaZombie", choosePizzaZombieSpawnX());
  game.pizzaSpawnOrdinal += 1;
  game.pizzaPendingSpawns -= 1;
  game.pizzaNextSpawnTimer = game.pizzaPendingSpawns > 0 ? .75 : -1;
}

// -----------------------------------------------------------------------------
// Enemies
// -----------------------------------------------------------------------------

let nextEnemyId = 1;
const enemies = [];
const drops = [];
const soulCoins = [];
const soulCoinPool = [];
const MAX_SOUL_COINS = 96;
const levelCrates = [];
const activeSpawnPlan = [];
const fallingStones = [];
const triggeredStones = new Set();
const bossFloorWarnings = [];
let bossVehicle = null;

const spawnPlan = [
  { trigger: 380, type: "dead", x: 720 },
  { trigger: 800, type: "dead", x: 1100 },
  { trigger: 1220, type: "dead", x: 1570 },
  { trigger: 1600, type: "dead", x: 1990 },
  { trigger: 2020, type: "bone", x: 2260 },
  { trigger: 2450, type: "dead", x: 2670 },
  { trigger: 2790, type: "dead", x: 3020 },
  { trigger: 3120, type: "bone", x: 3510 },
  { trigger: 3520, type: "dead", x: 3710 },
  { trigger: 3910, type: "dead", x: 4140 },
  { trigger: 4300, type: "bone", x: 4520 },
  { trigger: 4680, type: "dead", x: 4930 },
  { trigger: 5050, type: "dead", x: 5430 },
  { trigger: 5400, type: "bone", x: 5790 },
  { trigger: 5730, type: "dead", x: 6240 },
  { trigger: 6100, type: "bone", x: 6490 }
];

function removeLevelAmuletDrop() {
  for (let index = drops.length - 1; index >= 0; index--) {
    if (drops[index].kind === "cinderwindAmulet") drops.splice(index, 1);
  }
}

function resolveLevelAmuletX() {
  const placement = LEVEL_AMULET_PLACEMENTS[game.currentLevel];
  const definition = currentLevelDefinition();
  const plannedEnemies = game.currentLevel === 0 ? spawnPlan : definition.spawnPlan;
  const offsets = [0, 90, -90, 150, -150];
  for (const offset of offsets) {
    const x = clamp(placement.x + offset, 140, WORLD_W - 180);
    if (!hasGroundAt(x + 18)) continue;
    if (plannedEnemies.some((item) => Math.abs(item.x - x) < 125)) continue;
    const box = { x, y: GROUND_Y - 74, w: 36, h: 74 };
    if (getSolidObstacles().some((solid) => overlap(box, graveHitbox(solid)))) continue;
    return x;
  }
  return clamp(placement.x, 140, WORLD_W - 180);
}

function spawnLevelAmulet() {
  if (game.levelAmuletState !== "available" || drops.some((drop) => drop.kind === "cinderwindAmulet")) return false;
  const x = resolveLevelAmuletX();
  drops.push({ x, y: GROUND_Y - 67, w: 36, h: 38, kind: "cinderwindAmulet", weapon: "spear", t: 0, life: Infinity });
  game.levelAmuletSpawnCount = 1;
  return true;
}

function resetLevelAmuletForNewAttempt() {
  removeLevelAmuletDrop();
  releaseAttackInput();
  game.levelAmuletState = "available";
  game.levelAmuletSpawnCount = 0;
  game.amuletCollectedThisAttempt = false;
  game.amuletShatteredThisAttempt = false;
  spawnLevelAmulet();
}

function restoreLevelAmuletFromCheckpoint(snapshot) {
  removeLevelAmuletDrop();
  releaseAttackInput();
  game.levelAmuletState = snapshot.state;
  game.levelAmuletSpawnCount = snapshot.spawnCount;
  game.amuletCollectedThisAttempt = snapshot.collected;
  game.amuletShatteredThisAttempt = snapshot.shattered;
  if (game.levelAmuletState === "available") spawnLevelAmulet();
}

function collectLevelAmulet() {
  if (game.levelAmuletState !== "available") return false;
  removeLevelAmuletDrop();
  game.levelAmuletState = "active";
  game.amuletCollectedThisAttempt = true;
  game.score += 125;
  soulBurst(player.x + player.w / 2, player.y + 34, 12, 92);
  impactBurst(player.x + player.w / 2, player.y + 34, 6, "#a8443b", 65, player.facing);
  showStatusToast("CINDERWIND AMULET", 1.65);
  playSound("pickup");
  updateHUD();
  return true;
}

function shatterLevelAmulet() {
  if (game.levelAmuletState !== "active") return false;
  game.levelAmuletState = "shattered";
  game.amuletShatteredThisAttempt = true;
  releaseAttackInput();
  const centerX = player.x + player.w / 2;
  const centerY = player.y + 32;
  impactBurst(centerX, centerY, 9, "#79b7c8", 105, -player.facing);
  for (let index = 0; index < 5; index++) emitParticle({ x: centerX, y: centerY, vx: (seededNoise(index * 9.2 + game.time) - .5) * 120,
    vy: -35 - seededNoise(index * 5.7) * 70, size: 1.5 + seededNoise(index) * 1.8, life: .42, maxLife: .42,
    color: index === 0 ? "#9f4039" : "#526b73", gravity: 145, kind: "splinter", source: "amuletShatter" });
  playSound("spearDull");
  updateHUD();
  return true;
}

function relocateAvailableAmuletToArena(arenaLeft) {
  if (game.levelAmuletState !== "available") return;
  const amulet = drops.find((drop) => drop.kind === "cinderwindAmulet");
  if (!amulet) return;
  amulet.x = arenaLeft + 86;
  amulet.y = GROUND_Y - 67;
}

function soulCoinDropCount(enemy) {
  if (enemy.type === "boss" || enemy.type === "campaignBoss") return 18 + Math.floor(seededNoise(enemy.id * 3.71) * 13);
  if (enemy.elite) return ELITE_TUNING.soulCoinBonus + 4 + Math.floor(seededNoise(enemy.id * 4.13) * 3);
  if (enemy.summonedByBoss) return 3 + Math.floor(seededNoise(enemy.id * 4.13) * 3);
  if (enemy.type === "graveGunner") return 3 + Math.floor(seededNoise(enemy.id * 5.17) * 2);
  if (enemy.type === "lanternWraith") return 2 + Math.floor(seededNoise(enemy.id * 6.19) * 3);
  if (enemy.type === "shieldUndead") return 2 + Math.floor(seededNoise(enemy.id * 7.23) * 2);
  if (enemy.type === "bone" || enemy.type === "boulevardGhoul" || enemy.type === "pizzaZombie") return 4 + Math.floor(seededNoise(enemy.id * 8.29) * 3);
  return 1 + Math.floor(seededNoise(enemy.id * 9.31) * 2);
}

function spawnSoulCoins(enemy) {
  const requested = soulCoinDropCount(enemy);
  const count = Math.min(requested, MAX_SOUL_COINS - soulCoins.length);
  if (count <= 0) return;
  game.lastCoinDropEnemyType = enemy.type;
  const centerX = enemy.x + enemy.w / 2;
  const centerY = enemy.y + enemy.h * .48;
  for (let index = 0; index < count; index++) {
    const seed = enemy.id * 31.7 + index * 13.1;
    const coin = soulCoinPool.pop() || {};
    coin.x = centerX + (seededNoise(seed) - .5) * 18;
    coin.y = centerY;
    coin.vx = (seededNoise(seed + 2) - .5) * (enemy.type === "boss" || enemy.type === "campaignBoss" ? 230 : 165);
    coin.vy = -145 - seededNoise(seed + 5) * 145;
    coin.age = 0;
    coin.life = 9 + seededNoise(seed + 8) * 3;
    coin.maxLife = coin.life;
    coin.bounces = 0;
    coin.settled = false;
    coin.spin = seededNoise(seed + 11) * Math.PI * 2;
    coin.spinSpeed = 7 + seededNoise(seed + 14) * 8;
    soulCoins.push(coin);
  }
}

function releaseSoulCoinAt(index) {
  const coin = soulCoins[index];
  if (!coin) return;
  soulCoins.splice(index, 1);
  if (soulCoinPool.length < MAX_SOUL_COINS) soulCoinPool.push(coin);
}

function clearSoulCoins() {
  while (soulCoins.length) releaseSoulCoinAt(soulCoins.length - 1);
}

function updateSoulCoins(dt) {
  const solids = getSolidObstacles();
  const playerCenterX = player.x + player.w / 2;
  const playerCenterY = player.y + player.h / 2;
  for (let index = soulCoins.length - 1; index >= 0; index--) {
    const coin = soulCoins[index];
    coin.age += dt;
    coin.life -= dt;
    coin.spin += coin.spinSpeed * dt;
    if (coin.life <= 0) { releaseSoulCoinAt(index); continue; }
    const distance = Math.hypot(playerCenterX - coin.x, playerCenterY - coin.y);
    if (coin.age > .55 && distance < 86) {
      coin.vx = approach(coin.vx, (playerCenterX - coin.x) * 4.2, 420 * dt);
      coin.vy = approach(coin.vy, (playerCenterY - coin.y) * 4.2, 420 * dt);
      coin.settled = false;
    } else if (!coin.settled) {
      coin.vy += 620 * dt;
      coin.vx = approach(coin.vx, 0, 70 * dt);
    }
    const previousX = coin.x;
    const previousBottom = coin.y + 6;
    const nextX = clamp(coin.x + coin.vx * dt, 12, WORLD_W - 12);
    if (coin.y > GROUND_Y - 18 && !hasGroundAt(nextX)) coin.vx *= -.42;
    else coin.x = nextX;
    coin.y += coin.vy * dt;
    const box = { x: coin.x - 6, y: coin.y - 6, w: 12, h: 12 };
    for (const solid of solids) {
      const hitbox = graveHitbox(solid);
      if (!overlap(box, hitbox)) continue;
      if (previousBottom <= hitbox.y + 4 && coin.vy >= 0) {
        coin.y = hitbox.y - 6;
        coin.vy = coin.bounces++ < 1 ? -Math.abs(coin.vy) * .34 : 0;
        coin.settled = coin.vy === 0;
      } else {
        coin.x = previousX;
        coin.vx *= -.38;
      }
    }
    if (coin.y + 6 >= GROUND_Y && hasGroundAt(coin.x)) {
      coin.y = GROUND_Y - 6;
      if (coin.bounces < 2 && Math.abs(coin.vy) > 70) { coin.vy = -Math.abs(coin.vy) * .34; coin.bounces += 1; }
      else { coin.vy = 0; coin.vx = approach(coin.vx, 0, 260 * dt); coin.settled = Math.abs(coin.vx) < 2; }
    }
    if (coin.y > VIEW_H + 80) { releaseSoulCoinAt(index); continue; }
    if (distance < 27 || overlap({ x: coin.x - 6, y: coin.y - 6, w: 12, h: 12 }, playerRect())) {
      game.score += 25;
      game.soulCoinsCollectedThisLevel += 1;
      game.soulCoinScoreThisLevel += 25;
      addScorePopup(coin.x, coin.y - 8, "+25", "#d3b66e");
      impactBurst(coin.x, coin.y, 3, "#86b8c0", 42, 1);
      if (game.time - game.lastCoinSoundAt > .07) { playSound("pickup"); game.lastCoinSoundAt = game.time; }
      releaseSoulCoinAt(index);
      updateHUD();
    }
  }
}

function buildActiveSpawnPlan(definition) {
  activeSpawnPlan.length = 0;
  const pressure = 1 + (getLevelDifficulty().encounterPressure - 1) * (currentArchetype().pressureScale || 1);
  for (let index = 0; index < definition.spawnPlan.length; index++) {
    const item = definition.spawnPlan[index];
    activeSpawnPlan.push(item);
    const extraTarget = pressure - 1;
    const extraCount = Math.floor(extraTarget) + Number(seededNoise(index * 17.3 + game.currentLevel * 41) < extraTarget % 1);
    for (let extra = 0; extra < extraCount; extra++) {
      const selector = (index + extra + game.currentLevel) % 5;
      const type = selector === 0 ? "lanternWraith" : selector === 1 && game.currentLevel >= 4 ? "graveGunner" : selector === 2 ? "bone" : "dead";
      activeSpawnPlan.push({ trigger: item.trigger + 70 + extra * 85, type, x: clamp(item.x + (extra % 2 ? -175 : 175), 180, definition.worldWidth - 220) });
    }
  }
  activeSpawnPlan.sort((first, second) => first.trigger - second.trigger);
}

function spawnEnemy(type, x) {
  const rangedProfile = currentRangedProfile();
  const wraithLimit = rangedProfile ? rangedProfile.wraithMax : 2;
  const gunnerLimit = rangedProfile ? rangedProfile.gunnerMax : 0;
  if (type === "lanternWraith" && enemies.filter((enemy) => enemy.type === type && !enemy.dead).length >= wraithLimit) return false;
  if (type === "graveGunner" && (!rangedProfile || enemies.filter((enemy) => enemy.type === type && !enemy.dead).length >= gunnerLimit)) return false;
  if (type === "shieldUndead" && enemies.filter((enemy) => enemy.type === type && !enemy.dead).length >= 2) return false;
  if (type === "boulevardGhoul" && enemies.filter((enemy) => enemy.type === type && !enemy.dead).length >= 2) return false;
  const stats = type === "dead"
    ? { w: 42, h: 66, health: 1.65, speed: 38, score: 150 }
    : type === "bone"
      ? { w: 44, h: 72, health: 3, speed: 76, score: 350 }
      : type === "pizzaZombie"
        ? { w: 44, h: 70, health: 1.9, speed: 30, score: 250 }
        : type === "lanternWraith"
          ? { w: 48, h: 62, health: 2.15, speed: 32, score: 300 }
          : type === "graveGunner"
            ? { w: 48, h: 72, health: 2.45, speed: 28, score: 475 }
          : type === "shieldUndead"
            ? { w: 52, h: 76, health: 3.4, speed: 42, score: 425 }
            : type === "boulevardGhoul"
              ? { w: 42, h: 60, health: 1.35, speed: 108, score: 325 }
              : { w: 94, h: 126, health: 12, speed: 43, score: 3000 };
  const floating = type === "lanternWraith";
  const difficulty = getLevelDifficulty();
  const archetype = currentArchetype();
  const eliteChance = Math.min(.5, difficulty.eliteChance * (archetype.eliteScale || 1));
  const eliteCap = archetype.eliteMaxAlive || 1;
  const elitesAlive = enemies.filter((other) => other.elite && !other.dead).length;
  const eliteEligible = ELITE_TUNING.eligibleTypes.has(type) && elitesAlive < eliteCap
    && eliteChance > 0 && game.bossEncounterState === "idle";
  // Every level with elites enabled guarantees at least one memorable elite
  // in its second half, even if the random rolls came up empty.
  const checkpointX = currentLevelDefinition().checkpoint ? currentLevelDefinition().checkpoint.x : WORLD_W * .5;
  const guaranteedElite = eliteEligible && !game.eliteSpawnedThisLevel && x >= checkpointX;
  const elite = eliteEligible && (guaranteedElite
    || seededNoise(nextEnemyId * 12.9 + game.levelTime * 3.7) < eliteChance);
  if (elite) game.eliteSpawnedThisLevel = true;
  const scaledHealth = stats.health * difficulty.enemyHealthScale * (archetype.healthScale || 1) * (elite ? ELITE_TUNING.healthScale : 1);
  const scaledSpeed = stats.speed * difficulty.enemySpeedScale * (archetype.speedScale || 1) * (elite ? ELITE_TUNING.speedScale : 1);
  const scaledScore = Math.round(stats.score * (elite ? ELITE_TUNING.scoreScale : 1));
  const enemy = {
    id: nextEnemyId++, type, x, y: floating ? GROUND_Y - 155 : GROUND_Y - stats.h, w: stats.w, h: stats.h,
    vx: 0, health: scaledHealth, maxHealth: scaledHealth, speed: scaledSpeed, elite,
    score: scaledScore, name: type === "boss" ? "VELKO" : type, state: type === "boss" ? "intro" : "emerging",
    stateTimer: type === "dead" ? 1.5 : type === "pizzaZombie" ? 1.4 : type === "graveGunner" ? 1.2 : 1.05,
    emergeDuration: type === "dead" ? 1.5 : type === "pizzaZombie" ? 1.4 : type === "graveGunner" ? 1.2 : 1.05,
    hurtTimer: 0, flashTimer: 0, attackTimer: 0,
    attackCooldown: type === "graveGunner" && rangedProfile
      ? lerp(rangedProfile.gunnerCooldown[0], rangedProfile.gunnerCooldown[1], seededNoise(nextEnemyId))
      : type === "lanternWraith" && rangedProfile
        ? lerp(rangedProfile.wraithCooldown[0], rangedProfile.wraithCooldown[1], seededNoise(nextEnemyId))
        : 0.8 + seededNoise(nextEnemyId) * 0.7, dead: false,
    anim: seededNoise(nextEnemyId) * 6, dropRoll: seededNoise(nextEnemyId * 4.73),
    hasHitPlayer: false, attackPattern: 0, attackDirection: 1,
    actionDone: false, phase: 1, firstSlamSpoken: false,
    lowHealthSpoken: false, recoveryTimer: 0, facing: -1, turnLean: 0,
    throwCooldown: .9 + seededNoise(nextEnemyId * 2.17) * .45,
    baseY: floating ? GROUND_Y - 155 : GROUND_Y - stats.h,
    turnTarget: -1,
    dashReady: 1.15 + seededNoise(nextEnemyId * 8.4) * .55,
    aimX: 0, aimY: 0, reloadTimer: type === "graveGunner" ? 1.35 + seededNoise(nextEnemyId * 3.1) * .45 : 0
  };
  enemies.push(enemy);
  if (type === "boss") {
    game.bossSpawned = true;
    SoundManager.setBossTension(true);
    addShake("heavy");
    dustRing(x + stats.w / 2, GROUND_Y - 10, 16);
    playSound("boss");
    vibrate([35, 35, 55]);
    beginBossIntro();
  } else {
    playSound("emerge");
    if (elite) {
      playSound("eliteSpawn");
      soulBurst(x + stats.w / 2, GROUND_Y - stats.h * .55, 10, 120);
      addShake("light");
    }
  }
  return true;
}

function spawnCampaignBoss(profile) {
  const existing = enemies.find((enemy) => enemy.type === "campaignBoss" && enemy.profileId === profile.id && !enemy.dead);
  if (existing) return existing;
  const enemy = {
    id: nextEnemyId++, type: "campaignBoss", profileId: profile.id, bossId: profile.bossId,
    x: profile.spawnX, y: GROUND_Y - profile.h, w: profile.w, h: profile.h,
    vx: 0, health: profile.health, maxHealth: profile.health, speed: profile.speed,
    score: profile.id === "velkoLastCity" ? 9000 : profile.id === "velkoFinal" ? 6000 : profile.variant <= 2 ? (profile.variant === 2 ? 4500 : 3500) : 5000 + profile.variant * 450,
    name: profile.healthLabel, state: "intro", stateTimer: 0, emergeDuration: 0,
    hurtTimer: 0, flashTimer: 0, attackTimer: 0, attackCooldown: 1,
    dead: false, anim: 0, dropRoll: 0, hasHitPlayer: false,
    attackPattern: 0, attackDirection: -1, actionDone: false, phase: 1,
    recoveryTimer: 0, facing: -1, turnLean: 0, pendingThrows: 0,
    summonedByBoss: false, introAlpha: 0,
    attackHistory: [], lowHealthSpoken: false,
    teleportCooldown: 6 // opening grace: the player learns the boss before it warps
  };
  const difficulty = getLevelDifficulty();
  enemy.summonBudget = difficulty.summonBudget;
  enemy.summonCooldown = 4.5;
  enemies.push(enemy);
  return enemy;
}

function createBossVehicleOnce(profile) {
  if (!profile || !profile.vehicle) return null;
  if (bossVehicle && bossVehicle.profileId === profile.id) return bossVehicle;
  bossVehicle = {
    profileId: profile.id, x: profile.arenaRight + 230, y: GROUND_Y - 70, w: 238, h: 70,
    vx: 0, mode: "intro", parkedX: profile.arenaRight - 250, direction: -1,
    headlights: 0, hitPlayer: false, damaged: profile.variant > 1
  };
  return bossVehicle;
}

function clearCampaignBossIntroFallback() {
  if (game.bossIntroFallbackTimerId) window.clearTimeout(game.bossIntroFallbackTimerId);
  game.bossIntroFallbackTimerId = 0;
  game.bossIntroFallbackTimerActive = false;
}

function armCampaignBossIntroFallback() {
  clearCampaignBossIntroFallback();
  game.bossIntroFallbackTimerActive = true;
  game.bossIntroFallbackTimerId = window.setTimeout(() => {
    game.bossIntroFallbackTimerId = 0;
    game.bossIntroFallbackTimerActive = false;
    finishTodorIntroOnce("fallback timeout", true);
  }, 8000);
}

function finishCampaignBossIntroOnce(reason = "intro complete", force = false) {
  if (game.bossIntroCompletionGuard || game.bossEncounterState !== "intro") return false;
  const profile = BOSS_PROFILES[game.activeBossProfile];
  if (!force && game.bossIntroTime < 2.8) {
    game.bossIntroCompletionRequested = true;
    return false;
  }
  if (!force && profile && profile.vehicle && bossVehicle && bossVehicle.mode === "intro") {
    game.bossIntroCompletionRequested = true;
    return false;
  }
  game.bossIntroCompletionGuard = true;
  game.bossIntroCompletionRequested = false;
  clearCampaignBossIntroFallback();
  if (!profile) {
    game.lastTransitionError = `Boss intro completion failed (${reason}): missing profile`;
    game.arenaLocked = false;
    if (game.mode === "campaignBossIntro") game.mode = "running";
    return false;
  }
  let boss = activeCampaignBoss();
  if (!boss && game.mode === "campaignBossIntro") boss = spawnCampaignBoss(profile);
  if (profile.vehicle && !bossVehicle && game.mode === "campaignBossIntro") createBossVehicleOnce(profile);
  if (!boss) {
    game.lastTransitionError = `Boss intro completion failed (${reason}): missing boss`;
    game.arenaLocked = false;
    if (game.mode === "campaignBossIntro") game.mode = "running";
    return false;
  }
  cancelBossSpeech(`campaign intro finished: ${reason}`);
  if (bossVehicle && bossVehicle.mode === "intro") {
    bossVehicle.x = bossVehicle.parkedX;
    bossVehicle.vx = 0;
    bossVehicle.mode = "parked";
    bossVehicle.headlights = .55;
  }
  bossIntroOverlay.classList.remove("visible", "leaving", "campaign", "velko", "todor");
  bossIntroOverlay.setAttribute("aria-hidden", "true");
  boss.state = "active";
  boss.attackCooldown = 1;
  boss.hiddenInVehicle = false;
  game.bossEncounterState = "active";
  game.arenaLocked = true;
  game.mode = "running";
  game.lastTransitionError = "none";
  lastTime = performance.now();
  return true;
}

function finishTodorIntroOnce(reason = "TODOR intro complete", force = false) {
  return finishCampaignBossIntroOnce(reason, force);
}

function startBossEncounter(profileId) {
  const profile = BOSS_PROFILES[profileId];
  if (!profile || game.bossEncounterState !== "idle") return false;
  resetEncounterState("boss encounter start");
  if (profile.id === "velkoFinal") {
    game.survivalState = "complete";
    game.survivalTimer = Math.max(game.survivalTimer, 23);
    game.blackoutProgress = 1;
  }
  relocateAvailableAmuletToArena(profile.arenaLeft);
  const availableAmulet = drops.find((drop) => drop.kind === "cinderwindAmulet") || null;
  enemies.length = 0;
  fallingStones.length = 0;
  drops.length = 0;
  if (availableAmulet) drops.push(availableAmulet);
  game.activeBossProfile = profileId;
  game.bossEncounterState = "intro";
  game.bossSpawned = true;
  game.bossDefeated = false;
  game.bossPhase = 1;
  game.bossIntroTime = 0;
  game.bossIntroCharacters = 0;
  game.bossIntroFadeStarted = 0;
  game.bossIntroSequenceStep = 0;
  game.bossIntroLineStarted = false;
  game.bossIntroCompletionRequested = false;
  game.bossIntroCompletionGuard = false;
  game.bossVictoryPending = false;
  game.arenaLocked = true;
  game.levelArenaLeft = profile.arenaLeft;
  game.levelArenaRight = profile.arenaRight;
  const arenaEntranceX = profile.arenaLeft + 120;
  player.x = clamp(Math.min(player.x, arenaEntranceX), profile.arenaLeft + 70, profile.arenaRight - player.w - 90);
  player.vx = 0;
  player.invulnerable = Math.max(player.invulnerable, .8);
  const boss = spawnCampaignBoss(profile);
  if (profile.vehicle) {
    createBossVehicleOnce(profile);
    playSound("vehicleRumble");
  }
  bossIntroName.textContent = profile.introTitle;
  bossIntroDialogue.textContent = "";
  bossIntroOverlay.classList.remove("leaving", "velko", "todor");
  bossIntroOverlay.classList.add("campaign", profile.bossId);
  bossIntroOverlay.classList.add("visible");
  bossIntroOverlay.setAttribute("aria-hidden", "false");
  SoundManager.setBossTension(true);
  playSound("boss");
  addShake("medium");
  game.mode = "campaignBossIntro";
  armCampaignBossIntroFallback();
  return true;
}

function updateCampaignBossIntro(dt) {
  game.time += dt;
  game.levelTime += dt;
  game.bossIntroTime += dt;
  game.shake = Math.max(0, game.shake - dt * 38);
  RivalSpeech.update(dt);
  updateVelkoSubtitle(dt);
  updateParticles(dt);
  const profile = BOSS_PROFILES[game.activeBossProfile];
  const boss = enemies.find((enemy) => enemy.type === "campaignBoss" && !enemy.dead);
  if (!profile || !boss) return;
  boss.introAlpha = clamp(game.bossIntroTime / 1.1, 0, 1);
  if (bossVehicle && bossVehicle.mode === "intro") {
    bossVehicle.x = approach(bossVehicle.x, bossVehicle.parkedX, dt * 155);
    bossVehicle.headlights = approach(bossVehicle.headlights, .72, dt * .42);
    emitVehicleSmoke(bossVehicle, dt, .8);
    if (bossVehicle.x === bossVehicle.parkedX) bossVehicle.mode = "parked";
  }
  const focus = clamp((player.x + boss.x + boss.w / 2) * .5 - VIEW_W * .5, 0, WORLD_W - VIEW_W);
  game.cameraX = lerp(game.cameraX, focus, 1 - Math.pow(.003, dt));
  const display = `“${profile.introLine}”`;
  const reveal = clamp((game.bossIntroTime - .15) / 1.05, 0, 1);
  bossIntroDialogue.textContent = display.slice(0, Math.floor(display.length * reveal));
  if (!game.bossIntroLineStarted && game.bossIntroTime >= .3) {
    game.bossIntroLineStarted = true;
    RivalSpeech.speak(profile.bossId, profile.introLine, 5, "intro", (_result) => {
      if (!profile.introLaugh) finishCampaignBossIntroOnce("intro speech settled");
    });
  }
  if (profile.introLaugh && game.bossIntroSequenceStep === 0 && game.bossIntroTime >= 2.4 && !RivalSpeech.isActive() && !velkoSubtitleState.active) {
    game.bossIntroSequenceStep = 1;
    RivalSpeech.speak("todor", profile.introLaugh, 5, "introLaugh", (result) => finishTodorIntroOnce(`laugh speech ${result}`));
    if (game.bossIntroCompletionGuard) return;
  }
  const laughComplete = !profile.introLaugh || game.bossIntroSequenceStep === 1 && !RivalSpeech.isActive() && game.bossIntroTime >= 3.1;
  const timeout = game.bossIntroTime >= (profile.introLaugh ? 7.2 : 5.4);
  if ((!laughComplete || game.bossIntroTime < 2.8) && !timeout && !game.bossIntroCompletionRequested) return;
  if (!bossIntroOverlay.classList.contains("leaving")) {
    bossIntroOverlay.classList.add("leaving");
    game.bossIntroFadeStarted = game.bossIntroTime;
  }
  if (game.bossIntroTime < game.bossIntroFadeStarted + .42) return;
  finishCampaignBossIntroOnce(timeout ? "frame fallback timeout" : "intro sequence complete", timeout);
}

function activeCampaignBoss() {
  return enemies.find((enemy) => enemy.type === "campaignBoss" && !enemy.dead) || null;
}

function resetEncounterState(reason = "encounter reset") {
  clearCampaignBossIntroFallback();
  cancelBossSpeech(reason);
  RivalSpeech.resetEncounter();
  bossFloorWarnings.length = 0;
  bossVehicle = null;
  game.vehicleAttackActive = false;
  game.bossAttackSerial = 0;
  game.bossIntroSequenceStep = 0;
  game.bossIntroLineStarted = false;
  game.bossIntroCompletionRequested = false;
  game.bossIntroCompletionGuard = false;
  game.bossVictoryPending = false;
  game.lastResetReason = reason;
  clearBossMinions();
  clearAllProjectiles(reason);
}

function activeBossMinionCount() {
  return enemies.reduce((count, enemy) => count + Number(Boolean(enemy.summonedByBoss && !enemy.dead)), 0);
}

function clearBossMinions() {
  for (let index = enemies.length - 1; index >= 0; index--) {
    if (enemies[index].summonedByBoss) enemies.splice(index, 1);
  }
}

function clearAllProjectiles(reason = "state reset") {
  while (projectiles.length) releaseProjectileAt(projectiles.length - 1);
  game.lastClearedProjectileReason = reason;
}

function enemyHitbox(enemy) {
  return { x: enemy.x + 5, y: enemy.y + 4, w: enemy.w - 10, h: enemy.h - 4 };
}

function updateEnemies(dt) {
  for (const enemy of enemies) {
    if (enemy.dead) {
      enemy.stateTimer -= dt;
      enemy.flashTimer = Math.max(0, enemy.flashTimer - dt);
      enemy.x += enemy.vx * dt;
      enemy.vx = approach(enemy.vx, 0, 260 * dt);
      continue;
    }
    enemy.anim += dt * (enemy.type === "bone" ? 8 : enemy.type === "pizzaZombie" ? 4.2 : enemy.type === "boulevardGhoul" ? 10 : enemy.type === "graveGunner" ? 4.5 : 5);
    enemy.hurtTimer = Math.max(0, enemy.hurtTimer - dt);
    enemy.flashTimer = Math.max(0, enemy.flashTimer - dt);
    if (enemy.elite && enemy.state === "active" && Math.random() < dt * 3.4) {
      emitParticle({ x: enemy.x + enemy.w * (.25 + Math.random() * .5), y: enemy.y + enemy.h * (.3 + Math.random() * .5),
        vx: (Math.random() - .5) * 16, vy: -22 - Math.random() * 20, size: 1.4 + Math.random() * 1.4,
        life: .55, maxLife: .55, color: Math.random() > .4 ? "#c95446" : "#8a2e30", gravity: -12, kind: "ember", source: "elite" });
    }

    if (enemy.state === "intro") continue;

    if (enemy.state === "emerging") {
      enemy.stateTimer -= dt;
      if (Math.random() < dt * 8 && enemy.type !== "lanternWraith") dustBurst(enemy.x + enemy.w / 2, GROUND_Y - 2, 1, 60, 0);
      if (enemy.stateTimer <= 0) {
        enemy.state = "active";
        dustRing(enemy.x + enemy.w / 2, GROUND_Y - 8, 9);
      }
      continue;
    }

    if (enemy.hurtTimer > 0) {
      enemy.x += enemy.vx * dt;
      enemy.vx = approach(enemy.vx, 0, 300 * dt);
      continue;
    }

    const dx = (player.x + player.w / 2) - (enemy.x + enemy.w / 2);
    const direction = Math.sign(dx) || 1;
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);

    if (enemy.type === "boss") updateBoss(enemy, dt, dx, direction);
    else if (enemy.type === "campaignBoss") updateCampaignBoss(enemy, dt, dx, direction);
    else if (enemy.type === "pizzaZombie") updatePizzaZombie(enemy, dt, dx, direction);
    else if (enemy.type === "lanternWraith") updateLanternWraith(enemy, dt, dx, direction);
    else if (enemy.type === "graveGunner") updateGraveGunner(enemy, dt, dx, direction);
    else if (enemy.type === "shieldUndead") updateShieldUndead(enemy, dt, dx, direction);
    else if (enemy.type === "boulevardGhoul") updateBoulevardGhoul(enemy, dt, dx, direction);
    else {
      const awareness = enemy.type === "bone" ? 700 : 430;
      const shouldChase = Math.abs(dx) < awareness;
      enemy.vx = approach(enemy.vx, shouldChase ? direction * enemy.speed : 0, 210 * dt);
      enemy.x += enemy.vx * dt;
      if (overlap(enemyHitbox(enemy), playerRect())) damagePlayer(enemy.x + enemy.w / 2, false);
    }
  }

  for (let index = enemies.length - 1; index >= 0; index--) {
    if (enemies[index].dead && enemies[index].stateTimer <= 0) enemies.splice(index, 1);
  }
}

function updateLanternWraith(enemy, dt, dx, direction) {
  const rangedProfile = currentRangedProfile();
  enemy.y = enemy.baseY + Math.sin(game.time * 2.2 + enemy.id) * 9;
  enemy.facing = direction;
  if (enemy.state === "orbWindup") {
    enemy.attackTimer -= dt;
    enemy.vx = approach(enemy.vx, 0, 150 * dt);
    if (enemy.attackTimer <= 0) {
      const startX = enemy.x + enemy.w / 2 + enemy.facing * 15;
      const startY = enemy.y + 29;
      const targetX = player.x + player.w / 2;
      const targetY = player.y + player.h * .48;
      const distance = Math.max(1, Math.hypot(targetX - startX, targetY - startY));
      const speed = rangedProfile ? 155 * rangedProfile.wraithSpeed : 155;
      enforceProjectileLimit("lanternOrb");
      acquireProjectile({ type: "lanternOrb", x: startX, y: startY, startX, direction: enemy.facing,
        vx: (targetX - startX) / distance * speed, vy: (targetY - startY) / distance * speed,
        angle: 0, state: "flying", life: 4.2, w: 20, h: 20, hitPlayer: false });
      enemy.state = "active";
      enemy.attackCooldown = rangedProfile
        ? lerp(rangedProfile.wraithCooldown[0], rangedProfile.wraithCooldown[1], seededNoise(enemy.id + game.time))
        : 2.25 + seededNoise(enemy.id + game.time) * .7;
    }
    return;
  }
  const desiredDistance = Math.abs(dx) < 210 ? -direction * enemy.speed : Math.abs(dx) > 390 ? direction * enemy.speed : 0;
  enemy.vx = approach(enemy.vx, desiredDistance, 85 * dt);
  enemy.x = clamp(enemy.x + enemy.vx * dt, 40, WORLD_W - enemy.w - 40);
  const orbLimit = rangedProfile ? rangedProfile.orbMax : 2;
  const allowed = rangedProfile ? canEnemyFire(enemy, "lanternOrb") : activeLanternOrbCount() < orbLimit;
  if (enemy.attackCooldown <= 0 && Math.abs(dx) < 650 && Math.abs(dx) > 145 && activeLanternOrbCount() < orbLimit && lanternPathClear(enemy) && allowed) {
    enemy.state = "orbWindup";
    enemy.attackTimer = rangedProfile ? .42 + seededNoise(enemy.id * 4.4 + game.time) * .12 : .48 + seededNoise(enemy.id * 4.4 + game.time) * .16;
    enemy.vx = 0;
    if (rangedProfile) registerHostileShot(enemy, "lanternOrb");
  }
}

function activeLanternOrbCount() {
  return projectiles.filter((projectile) => projectile.type === "lanternOrb" && projectile.life > 0).length;
}

function lanternPathClear(enemy) {
  const left = Math.min(enemy.x, player.x);
  const right = Math.max(enemy.x + enemy.w, player.x + player.w);
  const rayY = Math.max(enemy.y + enemy.h * .5, player.y + player.h * .48);
  return !getSolidObstacles().some((solid) => {
    const hitbox = graveHitbox(solid);
    return hitbox.x < right && hitbox.x + hitbox.w > left && hitbox.y < rayY + 16;
  });
}

function updateGraveGunner(enemy, dt, dx, direction) {
  const profile = currentRangedProfile();
  if (!profile) return;
  enemy.facing = direction;
  if (enemy.state === "gunnerAim") {
    enemy.attackTimer -= dt;
    enemy.vx = approach(enemy.vx, 0, 360 * dt);
    if (enemy.attackTimer <= 0) {
      const startX = enemy.x + enemy.w / 2 + enemy.facing * 24;
      const startY = enemy.y + 28;
      enemy.aimX = player.x + player.w / 2;
      enemy.aimY = player.y + player.h * .42;
      const aimDx = enemy.aimX - startX;
      const aimDy = enemy.aimY - startY;
      const distance = Math.max(1, Math.hypot(aimDx, aimDy));
      const speed = 205 * profile.gunnerSpeed;
      enforceProjectileLimit("zombieBolt");
      acquireProjectile({ type: "zombieBolt", x: startX, y: startY, startX, direction: enemy.facing,
        vx: aimDx / distance * speed, vy: aimDy / distance * speed, angle: 0, state: "flying",
        life: 3.4, w: 22, h: 12, hitPlayer: false, nextTrailAt: game.time,
        color: game.currentLevel >= 13 ? "#bd5862" : "#7db7c9" });
      impactBurst(startX, startY, 5, game.currentLevel >= 13 ? "#bd5862" : "#7db7c9", 72, enemy.facing);
      enemy.state = "gunnerRecover";
      enemy.recoveryTimer = .72;
    }
    return;
  }
  if (enemy.state === "gunnerRecover") {
    enemy.recoveryTimer -= dt;
    enemy.vx = approach(enemy.vx, 0, 330 * dt);
    if (enemy.recoveryTimer <= 0) {
      enemy.state = "active";
      enemy.attackCooldown = lerp(profile.gunnerCooldown[0], profile.gunnerCooldown[1], seededNoise(enemy.id * 7.3 + game.time));
    }
    return;
  }
  const tooClose = Math.abs(dx) < 150;
  const desired = tooClose ? -direction * enemy.speed : Math.abs(dx) > 460 ? direction * enemy.speed : 0;
  enemy.vx = approach(enemy.vx, desired, 105 * dt);
  enemy.x = clamp(enemy.x + enemy.vx * dt, 30, WORLD_W - enemy.w - 30);
  if (tooClose) return;
  if (enemy.attackCooldown <= 0 && Math.abs(dx) < 690 && gunnerPathClear(enemy) && canEnemyFire(enemy, "zombieBolt")) {
    enemy.state = "gunnerAim";
    enemy.attackTimer = .5 + seededNoise(enemy.id * 4.9 + game.time) * .16;
    enemy.vx = 0;
    registerHostileShot(enemy, "zombieBolt");
  }
}

function gunnerPathClear(enemy) {
  const start = enemy.x + enemy.w / 2;
  const end = player.x + player.w / 2;
  const minimum = Math.min(start, end);
  const maximum = Math.max(start, end);
  const rayY = Math.min(enemy.y + 34, player.y + player.h * .45);
  return !getSolidObstacles().some((solid) => {
    const hitbox = graveHitbox(solid);
    return hitbox.x < maximum && hitbox.x + hitbox.w > minimum && hitbox.y < rayY + 20 && hitbox.y + hitbox.h > rayY - 20;
  });
}

function updateShieldUndead(enemy, dt, dx, direction) {
  if (enemy.state === "turning") {
    enemy.recoveryTimer -= dt;
    enemy.vx = approach(enemy.vx, 0, 320 * dt);
    if (enemy.recoveryTimer <= 0) {
      enemy.facing = enemy.turnTarget;
      enemy.state = "active";
      enemy.attackCooldown = .38;
    }
    return;
  }
  if (enemy.state === "shieldStrike") {
    enemy.attackTimer -= dt;
    if (enemy.attackTimer > .22) enemy.vx = approach(enemy.vx, 0, 420 * dt);
    else {
      enemy.vx = enemy.attackDirection * 155;
      enemy.x += enemy.vx * dt;
      if (!enemy.hasHitPlayer && overlap(enemyHitbox(enemy), playerRect())) {
        enemy.hasHitPlayer = true;
        damagePlayer(enemy.x + enemy.w / 2, false);
      }
    }
    if (enemy.attackTimer <= 0) {
      enemy.state = "recover";
      enemy.recoveryTimer = .72;
      enemy.vx = 0;
    }
    return;
  }
  if (enemy.state === "recover") {
    enemy.recoveryTimer -= dt;
    enemy.vx = approach(enemy.vx, 0, 420 * dt);
    if (enemy.recoveryTimer <= 0) {
      enemy.state = "active";
      enemy.attackCooldown = .65;
    }
    return;
  }
  if (direction !== enemy.facing && Math.abs(dx) > 22) {
    enemy.state = "turning";
    enemy.turnTarget = direction;
    enemy.recoveryTimer = .38;
    return;
  }
  if (enemy.attackCooldown <= 0 && Math.abs(dx) < 92) {
    enemy.state = "shieldStrike";
    enemy.attackTimer = .58;
    enemy.attackDirection = enemy.facing;
    enemy.hasHitPlayer = false;
    return;
  }
  enemy.vx = approach(enemy.vx, Math.abs(dx) < 330 ? direction * enemy.speed : 0, 140 * dt);
  enemy.x += enemy.vx * dt;
  if (overlap(enemyHitbox(enemy), playerRect())) damagePlayer(enemy.x + enemy.w / 2, false);
}

function updateBoulevardGhoul(enemy, dt, dx, direction) {
  if (enemy.state === "dashWindup") {
    enemy.attackTimer -= dt;
    enemy.vx = approach(enemy.vx, 0, 520 * dt);
    if (enemy.attackTimer <= 0) {
      enemy.state = "dashing";
      enemy.attackTimer = .38;
      enemy.vx = enemy.attackDirection * 365;
      enemy.hasHitPlayer = false;
    }
    return;
  }
  if (enemy.state === "dashing") {
    enemy.attackTimer -= dt;
    enemy.x += enemy.vx * dt;
    if (!enemy.hasHitPlayer && overlap(enemyHitbox(enemy), playerRect())) {
      enemy.hasHitPlayer = true;
      damagePlayer(enemy.x + enemy.w / 2, false);
    }
    if (enemy.attackTimer <= 0) {
      enemy.state = "dashRecover";
      enemy.recoveryTimer = .68;
      enemy.vx = 0;
    }
    return;
  }
  if (enemy.state === "dashRecover") {
    enemy.recoveryTimer -= dt;
    if (enemy.recoveryTimer <= 0) {
      enemy.state = "active";
      enemy.dashReady = 1.2 + seededNoise(enemy.id + game.time) * .7;
    }
    return;
  }
  enemy.facing = direction;
  enemy.dashReady -= dt;
  const anotherDashActive = enemies.some((other) => other !== enemy && other.type === "boulevardGhoul" && (other.state === "dashWindup" || other.state === "dashing"));
  if (!anotherDashActive && enemy.dashReady <= 0 && Math.abs(dx) > 130 && Math.abs(dx) < 430) {
    enemy.state = "dashWindup";
    enemy.attackTimer = .38 + seededNoise(enemy.id * 2.8 + game.time) * .1;
    enemy.attackDirection = direction;
    enemy.vx = 0;
    return;
  }
  enemy.vx = approach(enemy.vx, Math.abs(dx) < 520 ? direction * enemy.speed : 0, 360 * dt);
  enemy.x += enemy.vx * dt;
  if (overlap(enemyHitbox(enemy), playerRect())) damagePlayer(enemy.x + enemy.w / 2, false);
}

function pizzaThrowPathClear(enemy) {
  const start = enemy.x + enemy.w / 2;
  const end = player.x + player.w / 2;
  const minimum = Math.min(start, end);
  const maximum = Math.max(start, end);
  return !graves.some((grave) => grave.x < maximum && grave.x + grave.w > minimum && grave.y < GROUND_Y - 28);
}

function updatePizzaZombie(enemy, dt, dx, direction) {
  if (!game.pizzaSequenceActive || game.bossDefeated) {
    enemy.vx = approach(enemy.vx, 0, 420 * dt);
    return;
  }
  if (enemy.state === "pizzaWindup") {
    enemy.attackTimer -= dt;
    enemy.vx = approach(enemy.vx, 0, 420 * dt);
    if (enemy.attackTimer <= 0) {
      releasePizzaProjectile(enemy, direction);
      enemy.state = "active";
      const minimum = game.bossPhase === 2 ? 1.9 : 2.2;
      const maximum = game.bossPhase === 2 ? 2.7 : 3.2;
      enemy.throwCooldown = lerp(minimum, maximum, seededNoise(enemy.id * 7.3 + game.time));
    }
    return;
  }

  const boss = enemies.find((target) => target.type === "boss" && !target.dead);
  const bossCenter = boss ? boss.x + boss.w / 2 : enemy.x;
  const supportSide = player.x < bossCenter ? 1 : -1;
  const desiredX = clamp(bossCenter + supportSide * (120 + (enemy.id % 2) * 52), ARENA_LEFT + 72, ARENA_RIGHT - enemy.w - 72);
  const retreat = Math.abs(dx) < 135 ? -direction * enemy.speed : Math.sign(desiredX - enemy.x) * enemy.speed;
  enemy.vx = approach(enemy.vx, Math.abs(desiredX - enemy.x) > 28 || Math.abs(dx) < 135 ? retreat : 0, 150 * dt);
  enemy.x = clamp(enemy.x + enemy.vx * dt, ARENA_LEFT + 48, ARENA_RIGHT - enemy.w - 48);
  enemy.throwCooldown -= dt;
  if (enemy.throwCooldown > 0 || Math.abs(dx) < 150 || Math.abs(dx) > 680) return;
  if (activePizzaProjectileCount() >= MAX_PIZZA_PROJECTILES || !pizzaThrowPathClear(enemy)) {
    enemy.throwCooldown = .45;
    return;
  }
  enemy.state = "pizzaWindup";
  enemy.attackTimer = .42 + seededNoise(enemy.id * 4.1 + game.time) * .1;
  enemy.vx = 0;
}

function releasePizzaProjectile(enemy, direction) {
  if (activePizzaProjectileCount() >= MAX_PIZZA_PROJECTILES || game.bossDefeated) return false;
  const startX = enemy.x + enemy.w / 2 + direction * 15;
  const startY = enemy.y + 20;
  const targetX = player.x + player.w / 2;
  const targetY = player.y + player.h * .48;
  const dx = targetX - startX;
  const flightTime = clamp(Math.abs(dx) / 245, .68, 1.15);
  const gravity = 470;
  const vx = dx / flightTime;
  const vy = (targetY - startY - .5 * gravity * flightTime * flightTime) / flightTime;
  acquireProjectile({ type: "pizza", x: startX, y: startY, startX, direction, angle: 0,
    state: "flying", nextTrailAt: game.time, life: 3, vx, vy, gravity,
    spin: direction * (6.5 + seededNoise(enemy.id * 9.7) * 2.5), w: 24, h: 18, hitPlayer: false });
  game.lastPizzaProjectileResult = "spawned";
  pizzaCrumbBurst(startX, startY, 3, direction);
  if (!game.pizzaFirstThrowDialogueTriggered && canVelkoSpeak("pizzaFirstThrow", VELKO_PRIORITY.pizzaFirstThrow)) {
    game.pizzaFirstThrowDialogueTriggered = true;
    speakVelkoEvent("pizzaFirstThrow", VELKO_PRIORITY.pizzaFirstThrow);
  }
  return true;
}

function updateBoss(enemy, dt, dx, direction) {
  if (enemy.state === "active" && direction !== enemy.facing) {
    enemy.facing = direction;
    enemy.turnLean = -direction * .1;
  }
  enemy.turnLean = approach(enemy.turnLean, 0, dt * .42);
  if (enemy.phase === 1 && enemy.health <= enemy.maxHealth * .5) {
    enemy.phase = 2;
    game.bossPhase = 2;
    game.ambientPulse = .85;
    enemy.state = "phaseShift";
    enemy.attackTimer = .72;
    enemy.vx = 0;
    soulBurst(enemy.x + enemy.w / 2, enemy.y + enemy.h * .45, 18, 175);
    addShake("medium");
    speakVelkoEvent("phase2", VELKO_PRIORITY.phase2);
    requestPizzaZombieSpawn(.85, 1);
  }

  if (!enemy.lowHealthSpoken && enemy.health <= enemy.maxHealth * .24 && canVelkoSpeak("lowHealth", VELKO_PRIORITY.phase2)) {
    enemy.lowHealthSpoken = true;
    speakVelkoEvent("lowHealth", VELKO_PRIORITY.phase2);
  }

  if (enemy.state === "phaseShift") {
    enemy.attackTimer -= dt;
    enemy.vx = 0;
    if (Math.random() < dt * 13) {
      emitParticle({ x: enemy.x + enemy.w / 2 + (Math.random() - .5) * 52, y: enemy.y + 30 + Math.random() * 75,
        vx: (Math.random() - .5) * 34, vy: -25 - Math.random() * 35, size: 2 + Math.random() * 2,
        life: .45, maxLife: .45, color: "#a4463e", gravity: -8, kind: "ember" });
    }
    if (enemy.attackTimer <= 0) {
      enemy.state = "active";
      enemy.attackCooldown = .7;
    }
    return;
  }

  if (enemy.recoveryTimer > 0) {
    enemy.recoveryTimer -= dt;
    enemy.vx = approach(enemy.vx, 0, 620 * dt);
    return;
  }

  if (enemy.state === "slam") {
    enemy.attackTimer -= dt;
    enemy.vx = approach(enemy.vx, 0, 500 * dt);
    if (enemy.attackTimer <= .48 && !enemy.actionDone) {
      enemy.actionDone = true;
      const impactX = enemy.x + enemy.w / 2 + enemy.attackDirection * 58;
      if (Math.abs((player.x + player.w / 2) - impactX) < 142 && player.y + player.h > GROUND_Y - 24) {
        if (damagePlayer(impactX, true)) speakVelkoEvent("playerHit", VELKO_PRIORITY.playerHit);
      }
      addShake("heavy");
      dustRing(impactX, GROUND_Y - 3, 17);
      impactBurst(impactX, GROUND_Y - 8, 7, "#918778", 125, enemy.attackDirection);
    }
    if (enemy.attackTimer <= 0) {
      enemy.state = "active";
      enemy.attackCooldown = enemy.phase === 2 ? .72 : 1.05;
      enemy.recoveryTimer = .24;
    }
    return;
  }

  if (enemy.state === "charge") {
    enemy.attackTimer -= dt;
    if (enemy.attackTimer > .72) {
      enemy.vx = approach(enemy.vx, 0, 620 * dt);
    } else {
      enemy.vx = enemy.attackDirection * (enemy.phase === 2 ? 270 : 225);
      const nextX = clamp(enemy.x + enemy.vx * dt, ARENA_LEFT + 42, ARENA_RIGHT - enemy.w - 42);
      const stoppedByGate = nextX === enemy.x;
      enemy.x = nextX;
      if (!enemy.hasHitPlayer && overlap(enemyHitbox(enemy), playerRect())) {
        if (damagePlayer(enemy.x + enemy.w / 2, true)) speakVelkoEvent("playerHit", VELKO_PRIORITY.playerHit);
        enemy.hasHitPlayer = true;
      }
      if (Math.random() < dt * 15) dustBurst(enemy.x + enemy.w / 2, GROUND_Y, 1, 65, -enemy.attackDirection);
      if (stoppedByGate) enemy.attackTimer = Math.min(enemy.attackTimer, .14);
    }
    if (enemy.attackTimer <= 0) {
      enemy.state = "active";
      enemy.vx = 0;
      enemy.attackCooldown = enemy.phase === 2 ? .8 : 1.15;
      enemy.recoveryTimer = .38;
    }
    return;
  }

  if (enemy.state === "summon") {
    enemy.attackTimer -= dt;
    enemy.vx = approach(enemy.vx, 0, 500 * dt);
    if (enemy.attackTimer <= .72 && !enemy.actionDone) {
      enemy.actionDone = true;
      const count = enemy.phase === 2 ? 2 : 1;
      for (let index = 0; index < count; index++) {
        const side = index === 0 ? -1 : 1;
        const spawnX = clamp(enemy.x + side * (125 + index * 25), 6400, WORLD_W - 80);
        if (Math.abs(spawnX - player.x) > 150) spawnEnemy("dead", spawnX);
      }
      soulBurst(enemy.x + enemy.w / 2, enemy.y + 45, 10, 115);
      if (enemy.pizzaReinforcementRequested) requestPizzaZombieSpawn(.65, 1);
    }
    if (enemy.attackTimer <= 0) {
      enemy.state = "active";
      enemy.attackCooldown = enemy.phase === 2 ? .9 : 1.3;
      enemy.recoveryTimer = .3;
    }
    return;
  }

  if (enemy.attackCooldown <= 0) {
    const pattern = enemy.attackPattern++ % 3;
    enemy.attackDirection = direction;
    enemy.hasHitPlayer = false;
    enemy.actionDone = false;
    if (pattern === 0 || Math.abs(dx) < 135) {
      enemy.state = "slam";
      enemy.attackTimer = 1.12;
      if (!enemy.firstSlamSpoken) {
        enemy.firstSlamSpoken = true;
        speakVelkoEvent("slam", VELKO_PRIORITY.combat);
      }
    } else if (pattern === 1) {
      enemy.state = "charge";
      enemy.attackTimer = 1.32;
      speakVelkoEvent("charge", VELKO_PRIORITY.combat);
    } else {
      enemy.state = "summon";
      enemy.attackTimer = 1.42;
      enemy.pizzaReinforcementRequested = activePizzaZombieCount() + game.pizzaPendingSpawns < pizzaZombieLimit();
      if (enemy.pizzaReinforcementRequested) speakVelkoEvent("pizzaCommand", VELKO_PRIORITY.pizzaCombat);
      else speakVelkoEvent("summon", VELKO_PRIORITY.combat);
    }
    return;
  }
  enemy.vx = approach(enemy.vx, direction * enemy.speed * (enemy.phase === 2 ? 1.18 : 1), 130 * dt);
  enemy.x += enemy.vx * dt;
}

function updateCampaignBoss(enemy, dt, dx, direction) {
  const profile = BOSS_PROFILES[enemy.profileId];
  if (!profile || game.bossEncounterState !== "active") return;
  enemy.summonCooldown = Math.max(0, (enemy.summonCooldown || 0) - dt);
  if (enemy.state === "active" && direction !== enemy.facing) {
    enemy.facing = direction;
    enemy.turnLean = -direction * .08;
  }
  enemy.turnLean = approach(enemy.turnLean, 0, dt * .5);

  if (!enemy.lowHealthSpoken && enemy.health > 0 && enemy.health <= enemy.maxHealth * .24) {
    enemy.lowHealthSpoken = true;
    RivalSpeech.speakEvent(profile.bossId, "lowHealth", 3);
  }
  if (enemy.phase === 1 && enemy.health <= enemy.maxHealth * profile.phaseThreshold) {
    enemy.phase = 2;
    game.bossPhase = 2;
    enemy.state = "phaseShift";
    enemy.attackTimer = .95;
    enemy.vx = 0;
    clearBossAttackProjectiles("boss phase transition");
    bossFloorWarnings.length = 0;
    game.vehicleAttackActive = false;
    if (bossVehicle && bossVehicle.mode !== "drive") { bossVehicle.mode = "parked"; bossVehicle.headlights = .55; }
    game.ambientPulse = .9;
    if (profile.id === "todorViaduct" || profile.id === "velkoCathedral" || profile.id === "velkoObservatory" || profile.id === "velkoCrown" || profile.id === "velkoLastCity") game.lightning = .25;
    RivalSpeech.speak(profile.bossId, profile.phaseLine, 4, "phase2");
    if (profile.bossId === "todor") playSound("vehicleRumble");
    playSound("bossPhase");
    soulBurst(enemy.x + enemy.w / 2, enemy.y + enemy.h * .48, 16, 150);
    dustRing(enemy.x + enemy.w / 2, enemy.y + enemy.h, 16);
    impactBurst(enemy.x + enemy.w / 2, enemy.y + enemy.h * .5, 10,
      profile.bossId === "todor" ? "#e07338" : "#8fb9c6", 200, enemy.facing);
    game.hitStop = Math.max(game.hitStop, .18);
    game.flash = Math.max(game.flash, .1);
    addShake("heavy");
    return;
  }

  if (enemy.state === "phaseShift") {
    enemy.attackTimer -= dt;
    enemy.vx = 0;
    if (Math.random() < dt * 12) emitParticle({ x: enemy.x + enemy.w / 2 + (Math.random() - .5) * 50,
      y: enemy.y + 24 + Math.random() * 70, vx: (Math.random() - .5) * 32, vy: -25 - Math.random() * 28,
      size: 2 + Math.random() * 2, life: .5, maxLife: .5, color: profile.bossId === "todor" ? "#c58a45" : "#9d3f43", gravity: -8, kind: "ember" });
    if (enemy.attackTimer <= 0) {
      enemy.state = "active";
      enemy.attackCooldown = .75;
    }
    return;
  }

  if (enemy.state === "recover") {
    enemy.recoveryTimer -= dt;
    enemy.vx = approach(enemy.vx, 0, 520 * dt);
    if (enemy.recoveryTimer <= 0) {
      enemy.state = "active";
      enemy.attackCooldown = bossNextAttackCooldown(enemy);
    }
    return;
  }

  enemy.teleportCooldown = Math.max(0, (enemy.teleportCooldown || 0) - dt);
  if (enemy.state === "teleportOut" || enemy.state === "teleportIn") {
    updateBossTeleport(enemy, dt);
    return;
  }

  const difficulty = getLevelDifficulty();
  if (enemy.state === "active" && enemy.summonBudget > 0 && enemy.summonCooldown <= 0
      && activeBossMinionCount() < difficulty.summonLimit && hostileProjectileCount() <= Math.max(0, (currentRangedProfile()?.hostileCap || 2) - 2)) {
    if (spawnCampaignBossMinion(enemy, profile)) {
      enemy.summonCooldown = difficulty.summonCooldown;
      enemy.attackCooldown = Math.max(enemy.attackCooldown, 1.15);
    }
  }

  if (profile.bossId === "todor") updateTodorBoss(enemy, profile, dt, dx, direction);
  else updateEvolvedVelko(enemy, profile, dt, dx, direction);
}

function updateTodorBoss(enemy, profile, dt, dx, direction) {
  if (enemy.state === "bundleWindup") {
    enemy.attackTimer -= dt;
    enemy.vx = approach(enemy.vx, 0, 420 * dt);
    if (enemy.attackTimer <= 0) {
      throwMoneyBundle(enemy, profile, enemy.pendingThrows > 1 ? -.12 : 0);
      enemy.pendingThrows -= 1;
      if (enemy.pendingThrows > 0) {
        enemy.state = "bundleSecond";
        enemy.attackTimer = .32;
      } else beginBossRecovery(enemy, enemy.phase === 2 ? .46 : .58);
    }
    return;
  }
  if (enemy.state === "bundleSecond") {
    enemy.attackTimer -= dt;
    if (enemy.attackTimer <= 0) {
      throwMoneyBundle(enemy, profile, .14);
      enemy.pendingThrows = 0;
      beginBossRecovery(enemy, enemy.phase === 2 ? .5 : .62);
    }
    return;
  }
  if (enemy.state === "headlightSweep") {
    enemy.attackTimer -= dt;
    enemy.vx = approach(enemy.vx, 0, 420 * dt);
    if (bossVehicle) bossVehicle.headlights = approach(bossVehicle.headlights, 1, dt * 1.7);
    if (enemy.attackTimer <= 0) {
      if (bossVehicle) { bossVehicle.mode = "parked"; bossVehicle.headlights = .55; }
      beginBossRecovery(enemy, .68);
    }
    return;
  }
  if (enemy.state === "driveWarning") {
    enemy.attackTimer -= dt;
    enemy.vx = 0;
    if (enemy.attackTimer <= 0) {
      beginVehicleDrive(profile, enemy);
      enemy.state = "driveActive";
      enemy.attackTimer = 2.15;
      enemy.hiddenInVehicle = true;
    }
    return;
  }
  if (enemy.state === "driveActive") {
    enemy.attackTimer -= dt;
    enemy.vx = 0;
    if (!bossVehicle || bossVehicle.mode !== "drive" || enemy.attackTimer <= 0) {
      enemy.hiddenInVehicle = false;
      enemy.x = clamp(bossVehicle ? bossVehicle.x + 90 : enemy.x, profile.arenaLeft + 80, profile.arenaRight - enemy.w - 80);
      beginBossRecovery(enemy, .82);
    }
    return;
  }
  if (enemy.state === "markedAttack") {
    enemy.attackTimer -= dt;
    enemy.vx = 0;
    if (enemy.attackTimer <= 0) beginBossRecovery(enemy, .7);
    return;
  }

  if (enemy.attackCooldown <= 0) {
    if (shouldBossTeleport(enemy, profile, dx)) {
      beginBossTeleport(enemy, profile);
      return;
    }
    beginCampaignAttack(enemy, profile, chooseBossAttack(enemy, profile, dx));
    return;
  }
  const desired = Math.abs(dx) > 235 ? direction * enemy.speed : Math.abs(dx) < 145 ? -direction * enemy.speed * .7 : 0;
  enemy.vx = approach(enemy.vx, desired, 155 * dt);
  enemy.x = clamp(enemy.x + enemy.vx * dt, profile.arenaLeft + 65, profile.arenaRight - enemy.w - 65);
}

function updateEvolvedVelko(enemy, profile, dt, dx, direction) {
  if (enemy.state === "slamWindup") {
    enemy.attackTimer -= dt;
    enemy.vx = approach(enemy.vx, 0, 520 * dt);
    if (!enemy.actionDone && enemy.attackTimer <= .34) {
      enemy.actionDone = true;
      spawnBossShockwaves(enemy, profile);
      addShake("heavy");
      dustRing(enemy.x + enemy.w / 2, GROUND_Y - 4, 16);
    }
    if (enemy.attackTimer <= 0) beginBossRecovery(enemy, enemy.phase === 2 ? .45 : .58);
    return;
  }
  if (enemy.state === "markedAttack") {
    enemy.attackTimer -= dt;
    enemy.vx = 0;
    if (enemy.attackTimer <= 0) beginBossRecovery(enemy, enemy.phase === 2 ? .55 : .7);
    return;
  }
  if (enemy.state === "summonWindup") {
    enemy.attackTimer -= dt;
    enemy.vx = 0;
    if (!enemy.actionDone && enemy.attackTimer <= .45) {
      enemy.actionDone = true;
      spawnCampaignBossMinion(enemy, profile);
      soulBurst(enemy.x + enemy.w / 2, enemy.y + 48, 10, 105);
    }
    if (enemy.attackTimer <= 0) beginBossRecovery(enemy, .7);
    return;
  }
  if (enemy.state === "chargeWindup") {
    enemy.attackTimer -= dt;
    enemy.vx = approach(enemy.vx, 0, 600 * dt);
    if (enemy.attackTimer <= 0) {
      enemy.state = "chargeActive";
      enemy.attackTimer = .68;
      enemy.hasHitPlayer = false;
    }
    return;
  }
  if (enemy.state === "chargeActive") {
    enemy.attackTimer -= dt;
    const chargeSpeed = Math.min(305, 255 + Math.max(0, profile.variant - 2) * 7 + (enemy.phase === 2 ? 28 : 0));
    enemy.vx = enemy.attackDirection * chargeSpeed;
    const nextX = clamp(enemy.x + enemy.vx * dt, profile.arenaLeft + 45, profile.arenaRight - enemy.w - 45);
    if (nextX === enemy.x) enemy.attackTimer = Math.min(enemy.attackTimer, .12);
    enemy.x = nextX;
    if (!enemy.hasHitPlayer && overlap(enemyHitbox(enemy), playerRect())) {
      enemy.hasHitPlayer = true;
      damagePlayer(enemy.x + enemy.w / 2, true);
    }
    if (Math.random() < dt * 15) emitParticle({ x: enemy.x + enemy.w / 2, y: GROUND_Y - 8,
      vx: -enemy.attackDirection * (20 + Math.random() * 30), vy: -18 - Math.random() * 28, size: 2,
      life: .35, maxLife: .35, color: enemy.phase === 2 ? "#873843" : "#5f8090", gravity: 50, kind: "ember" });
    if (enemy.attackTimer <= 0) beginBossRecovery(enemy, .76);
    return;
  }

  if (enemy.attackCooldown <= 0) {
    if (shouldBossTeleport(enemy, profile, dx)) {
      beginBossTeleport(enemy, profile);
      return;
    }
    beginCampaignAttack(enemy, profile, chooseBossAttack(enemy, profile, dx));
    return;
  }
  enemy.vx = approach(enemy.vx, direction * enemy.speed * (enemy.phase === 2 ? 1.1 : 1), 135 * dt);
  enemy.x = clamp(enemy.x + enemy.vx * dt, profile.arenaLeft + 48, profile.arenaRight - enemy.w - 48);
}

const TODOR_BUNDLE_ATTACKS = new Set(["bundleToss", "bundleBarrage", "gildedBundleBarrage", "receiptToss", "velvetBundleToss", "blackLedgerBarrage"]);
const TODOR_BARRAGE_ATTACKS = new Set(["bundleBarrage", "gildedBundleBarrage", "blackLedgerBarrage"]);
const TODOR_SWEEP_ATTACKS = new Set(["headlightSweep", "floodlightSweep"]);
const TODOR_DRIVE_ATTACKS = new Set(["marshDriveBy", "blackoutDriveBy", "railLineDrive", "vaultDriveBy", "neonDriveBy", "mirrorLaneDrive", "citadelDriveBy"]);
const TODOR_RAIN_ATTACKS = new Set(["tollGateRain", "signalCashRain", "blackoutCashRain", "debtCollectorRain", "finalTollRain"]);
const VELKO_SLAM_ATTACKS = new Set(["auctionSlam", "blackoutGravebreaker", "cathedralBellSlam", "orbitSlam", "anvilGravebreaker", "crownQuake", "lastWardenRequiem"]);
const VELKO_ZONE_ATTACKS = new Set(["boneDebt", "cityOfBuried", "constellationBuried", "ashenBuried", "courtBuried", "finalCityBuried"]);
const VELKO_SUMMON_ATTACKS = new Set(["marketSummon", "choirBuried"]);
const VELKO_CHARGE_ATTACKS = new Set(["funeralChargeFinale", "staticCharge", "gravewindCharge", "furnaceCharge", "sovereignCharge", "citybreakerCharge"]);

// ---------------------------------------------------------------------------
// Boss attack director: distance-aware weighted attack selection with
// anti-repeat memory, phase aggression, and readable teleports.
// ---------------------------------------------------------------------------
const BOSS_AGGRESSION = Object.freeze({
  phase1Cooldown: .9,
  phase2Cooldown: .58,
  lowHealthCooldown: .42,
  lowHealthThreshold: .24,
  finalBossCooldownScale: .85
});
const BOSS_ATTACK_DIRECTOR = Object.freeze({
  historyLength: 4,
  repeatPenalty: .12,   // weight multiplier once an attack already sits in history
  closeRange: 175,
  farRange: 320
});
const BOSS_TELEPORT = Object.freeze({
  // Shared safety rules — a boss never materializes on the player and is
  // untargetable but also harmless while warping.
  safeDistanceMin: 150,
  safeDistanceMax: 285,
  phase1Cooldown: 11,
  phase2Cooldown: 6,
  lowHealthCooldown: 4,
  finalBossCooldownScale: .75,
  styles: {
    // VELKO: slow spectral dissolve, long-range repositioning, cold arrival.
    velko: { outSeconds: .5, inSeconds: .66, arrivalCooldown: .5, preferFlank: false, color: "138,196,214" },
    // TODOR: brutal short shadow-step that lands closer and swings sooner.
    todor: { outSeconds: .34, inSeconds: .52, arrivalCooldown: .35, preferFlank: true, color: "224,118,62" }
  }
});

function bossIsLowHealth(enemy) {
  return enemy.health <= enemy.maxHealth * BOSS_AGGRESSION.lowHealthThreshold;
}

function bossNextAttackCooldown(enemy) {
  let cooldown = bossIsLowHealth(enemy) ? BOSS_AGGRESSION.lowHealthCooldown
    : enemy.phase === 2 ? BOSS_AGGRESSION.phase2Cooldown : BOSS_AGGRESSION.phase1Cooldown;
  if (enemy.profileId === "velkoLastCity") cooldown *= BOSS_AGGRESSION.finalBossCooldownScale;
  return cooldown;
}

function bossAttackRangeBias(attack, dx) {
  const distance = Math.abs(dx);
  const close = distance < BOSS_ATTACK_DIRECTOR.closeRange;
  const far = distance > BOSS_ATTACK_DIRECTOR.farRange;
  if (VELKO_SLAM_ATTACKS.has(attack)) return close ? 1.9 : far ? .5 : 1;
  const prefersFar = TODOR_BUNDLE_ATTACKS.has(attack) || TODOR_DRIVE_ATTACKS.has(attack)
    || VELKO_ZONE_ATTACKS.has(attack) || VELKO_CHARGE_ATTACKS.has(attack) || VELKO_SUMMON_ATTACKS.has(attack);
  if (prefersFar) return far ? 1.7 : close ? .6 : 1;
  return 1.15;
}

function chooseBossAttack(enemy, profile, dx) {
  if (!enemy.attackHistory) enemy.attackHistory = [];
  const lastAttack = enemy.attackHistory[enemy.attackHistory.length - 1];
  let chosen = null;
  let bestScore = 0;
  for (const attack of profile.attacks) {
    if (attack === lastAttack && profile.attacks.length > 1) continue;
    let weight = bossAttackRangeBias(attack, dx);
    const repeats = enemy.attackHistory.filter((past) => past === attack).length;
    if (repeats >= 2) weight *= BOSS_ATTACK_DIRECTOR.repeatPenalty;
    const score = weight * (.35 + Math.random() * .65);
    if (score > bestScore) { bestScore = score; chosen = attack; }
  }
  if (!chosen) chosen = profile.attacks[0];
  enemy.attackHistory.push(chosen);
  if (enemy.attackHistory.length > BOSS_ATTACK_DIRECTOR.historyLength) enemy.attackHistory.shift();
  return chosen;
}

function bossTeleportStyle(enemy) {
  return BOSS_TELEPORT.styles[enemy.bossId] || BOSS_TELEPORT.styles.velko;
}

function shouldBossTeleport(enemy, profile, dx) {
  if ((enemy.teleportCooldown || 0) > 0) return false;
  if (bossIsLowHealth(enemy)) return Math.random() < .8;
  if (enemy.phase === 2) return Math.random() < .6;
  // Phase 1: only reposition when the player is clearly disengaged.
  return Math.abs(dx) > 400 && Math.random() < .45;
}

function chooseTeleportDestination(enemy, profile) {
  const style = bossTeleportStyle(enemy);
  const playerCenter = player.x + player.w / 2;
  const minX = profile.arenaLeft + 65;
  const maxX = profile.arenaRight - enemy.w - 65;
  const spread = BOSS_TELEPORT.safeDistanceMax - BOSS_TELEPORT.safeDistanceMin;
  const reach = BOSS_TELEPORT.safeDistanceMin + Math.random() * spread * (style.preferFlank ? .55 : 1);
  const candidates = [playerCenter - reach - enemy.w / 2, playerCenter + reach - enemy.w / 2];
  // Prefer the side opposite the boss's current position (a true flank).
  candidates.sort((first, second) =>
    Math.abs(second - enemy.x) - Math.abs(first - enemy.x));
  for (const candidate of candidates) {
    const x = clamp(candidate, minX, maxX);
    if (Math.abs(x + enemy.w / 2 - playerCenter) >= BOSS_TELEPORT.safeDistanceMin) return x;
  }
  // Both flanks clamp too close to the player: fall back to the far arena edge.
  const leftGap = playerCenter - minX;
  const rightGap = maxX + enemy.w / 2 - playerCenter;
  return leftGap > rightGap ? minX : maxX;
}

function bossTeleportCooldown(enemy) {
  let cooldown = bossIsLowHealth(enemy) ? BOSS_TELEPORT.lowHealthCooldown
    : enemy.phase === 2 ? BOSS_TELEPORT.phase2Cooldown : BOSS_TELEPORT.phase1Cooldown;
  if (enemy.profileId === "velkoLastCity") cooldown *= BOSS_TELEPORT.finalBossCooldownScale;
  return cooldown;
}

function beginBossTeleport(enemy, profile) {
  const style = bossTeleportStyle(enemy);
  enemy.state = "teleportOut";
  enemy.attackTimer = style.outSeconds;
  enemy.vx = 0;
  enemy.teleportTargetX = chooseTeleportDestination(enemy, profile);
  enemy.teleportCooldown = bossTeleportCooldown(enemy);
  playSound(enemy.bossId === "todor" ? "todorWarp" : "velkoWarp");
  soulBurst(enemy.x + enemy.w / 2, enemy.y + enemy.h * .5, 9, 120);
}

function updateBossTeleport(enemy, dt) {
  const style = bossTeleportStyle(enemy);
  enemy.attackTimer -= dt;
  enemy.vx = 0;
  if (Math.random() < dt * 16) {
    emitParticle({ x: enemy.x + enemy.w * (.2 + Math.random() * .6), y: enemy.y + enemy.h * (.15 + Math.random() * .7),
      vx: (Math.random() - .5) * 40, vy: -18 - Math.random() * 26, size: 1.6 + Math.random() * 1.6,
      life: .4, maxLife: .4, color: enemy.bossId === "todor" ? "#d0703c" : "#8fc4d6", gravity: -14, kind: "ember", source: "teleport" });
  }
  if (enemy.attackTimer > 0) return;
  if (enemy.state === "teleportOut") {
    enemy.x = enemy.teleportTargetX;
    enemy.facing = Math.sign(player.x + player.w / 2 - (enemy.x + enemy.w / 2)) || enemy.facing;
    enemy.state = "teleportIn";
    enemy.attackTimer = style.inSeconds;
    return;
  }
  // Arrival: burst, shake, and a short readable pause before the next swing.
  enemy.state = "active";
  enemy.attackCooldown = style.arrivalCooldown;
  addShake(enemy.bossId === "todor" ? "medium" : "light");
  dustRing(enemy.x + enemy.w / 2, enemy.y + enemy.h, 12);
  impactBurst(enemy.x + enemy.w / 2, enemy.y + enemy.h * .5, 9,
    enemy.bossId === "todor" ? "#e8933f" : "#a9d3de", 170, enemy.facing);
  playSound("emerge");
}

function beginCampaignAttack(enemy, profile, attack) {
  enemy.actionDone = false;
  enemy.attackDirection = enemy.facing;
  game.bossAttackSerial += 1;
  if (TODOR_BUNDLE_ATTACKS.has(attack)) {
    enemy.state = "bundleWindup";
    enemy.attackTimer = enemy.phase === 2 ? .46 : .6;
    enemy.pendingThrows = TODOR_BARRAGE_ATTACKS.has(attack) ? 2 : 1;
    RivalSpeech.speakEvent("todor", "bundle", 1);
  } else if (TODOR_SWEEP_ATTACKS.has(attack)) {
    enemy.state = "headlightSweep";
    enemy.attackTimer = profile.variant >= 4 ? 1.34 : 1.45;
    if (bossVehicle) bossVehicle.mode = "headlight";
    createBossFloorWarnings(profile, "headlight", 1, profile.variant >= 4 ? .88 : .95);
  } else if (TODOR_DRIVE_ATTACKS.has(attack)) {
    enemy.state = "driveWarning";
    enemy.attackTimer = profile.driveWarning || (profile.id === "todorViaduct" ? .9 : 1.05);
    if (bossVehicle) { bossVehicle.mode = "warning"; bossVehicle.direction = game.bossAttackSerial % 2 ? 1 : -1; bossVehicle.headlights = 1; }
    game.vehicleAttackActive = true;
    RivalSpeech.speakEvent("todor", "vehicle", 1);
  } else if (TODOR_RAIN_ATTACKS.has(attack)) {
    enemy.state = "markedAttack";
    enemy.attackTimer = profile.variant >= 5 ? 1.25 : 1.35;
    createBossFloorWarnings(profile, "moneyRain", enemy.phase === 2 ? 3 : 2, profile.variant >= 5 ? .82 : .88);
    RivalSpeech.speakEvent("todor", "moneyRain", 1);
  } else if (VELKO_SLAM_ATTACKS.has(attack)) {
    enemy.state = "slamWindup";
    enemy.attackTimer = profile.variant >= 6 ? 1 : 1.08;
  } else if (VELKO_ZONE_ATTACKS.has(attack)) {
    enemy.state = "markedAttack";
    enemy.attackTimer = 1.35;
    const finalZones = attack === "finalCityBuried" && enemy.phase === 2 ? 3 : 2;
    createBossFloorWarnings(profile, attack === "boneDebt" ? "boneDebt" : "cityRoots", finalZones, profile.variant >= 6 ? .8 : .86);
    if (attack !== "boneDebt") spawnCampaignBossMinion(enemy, profile);
  } else if (VELKO_SUMMON_ATTACKS.has(attack)) {
    enemy.state = "summonWindup";
    enemy.attackTimer = 1.16;
  } else if (VELKO_CHARGE_ATTACKS.has(attack)) {
    enemy.state = "chargeWindup";
    enemy.attackTimer = profile.variant >= 6 ? .72 : .78;
  }
}

function beginBossRecovery(enemy, duration) {
  enemy.state = "recover";
  enemy.recoveryTimer = duration * getLevelDifficulty().recoveryScale;
  enemy.vx = 0;
}

function throwMoneyBundle(enemy, profile, verticalBias = 0) {
  const maxBundles = enemy.phase === 2 ? 3 : 2;
  const rangedProfile = currentRangedProfile();
  if (rangedProfile && hostileProjectileCount() >= rangedProfile.hostileCap) return false;
  if (activeMoneyBundleCount() >= maxBundles) return false;
  const direction = enemy.facing;
  const startX = enemy.x + enemy.w / 2 + direction * 22;
  const startY = enemy.y + 30;
  const targetX = player.x + player.w / 2;
  const targetY = player.y + player.h * .45;
  const dx = targetX - startX;
  const flightTime = clamp(Math.abs(dx) / 270, .58, 1.05);
  const gravity = 510;
  const vx = dx / flightTime;
  const vy = (targetY - startY - .5 * gravity * flightTime * flightTime) / flightTime + verticalBias * 180;
  acquireProjectile({ type: "moneyBundle", x: startX, y: startY, startX, direction, vx, vy, gravity,
    angle: 0, spin: direction * 7, state: "flying", life: 3.2, w: 26, h: 18, hitPlayer: false, profileId: profile.id });
  paperBurst(startX, startY, 3);
  return true;
}

function activeMoneyBundleCount() {
  let count = 0;
  for (const projectile of projectiles) if (projectile.type === "moneyBundle" && projectile.life > 0) count += 1;
  return count;
}

function spawnBossShockwaves(enemy, profile) {
  const speed = Math.min(300, 250 + Math.max(0, profile.variant - 2) * 7);
  const life = profile.id === "velkoLastCity" ? 1.05 : profile.id === "velkoFinal" ? .95 : .84 + Math.max(0, profile.variant - 2) * .018;
  const rangedProfile = currentRangedProfile();
  for (const direction of [-1, 1]) {
    if (rangedProfile && hostileProjectileCount() >= rangedProfile.hostileCap) break;
    acquireProjectile({ type: "bossShockwave", x: enemy.x + enemy.w / 2 + direction * 48,
      y: GROUND_Y - 14, startX: enemy.x, direction, vx: direction * speed, vy: 0, angle: 0,
      state: "flying", life, w: 46, h: 20, hitPlayer: false });
  }
}

function createBossFloorWarnings(profile, kind, count, delay) {
  const offsets = count === 3 ? [-155, 65, 215] : [-125, 135];
  const base = player.x + player.w / 2 + player.vx * .18;
  for (let index = 0; index < count; index++) {
    bossFloorWarnings.push({ kind, x: clamp(base + offsets[index], profile.arenaLeft + 95, profile.arenaRight - 95),
      w: kind === "headlight" ? 86 : 64, timer: delay + index * .08, impacted: false, life: .32,
      direction: game.bossAttackSerial % 2 ? 1 : -1 });
  }
}

function spawnCampaignBossMinion(enemy, profile) {
  const difficulty = getLevelDifficulty();
  if (!enemy || enemy.summonBudget <= 0) return false;
  if (activeBossMinionCount() >= difficulty.summonLimit) return false;
  const rangedAlreadyActive = enemies.some((target) => target.summonedByBoss && target.type === "graveGunner" && !target.dead);
  const lateRanged = game.currentLevel >= 10 && !rangedAlreadyActive && enemy.phase === 2 && enemy.summonBudget % 3 === 0;
  const type = lateRanged ? "graveGunner" : profile.bossId === "todor" ? "boulevardGhoul" : profile.id === "velkoMarket" ? "shieldUndead" : profile.id === "velkoCathedral" ? "dead" : "bone";
  const candidates = [profile.arenaLeft + 100, profile.arenaRight - 145, enemy.x - enemy.facing * 185];
  let x = candidates.find((candidate) => Math.abs(candidate - player.x) >= 230 && hasGroundAt(candidate) && !getSolidObstacles().some((solid) => overlap({ x: candidate, y: GROUND_Y - 80, w: 52, h: 80 }, graveHitbox(solid))));
  if (!Number.isFinite(x)) return false;
  x = clamp(x, profile.arenaLeft + 75, profile.arenaRight - 145);
  const before = enemies.length;
  if (!spawnEnemy(type, x) || enemies.length === before) return false;
  enemies[enemies.length - 1].summonedByBoss = true;
  enemies[enemies.length - 1].attackCooldown = 1.45;
  enemies[enemies.length - 1].stateTimer = Math.max(enemies[enemies.length - 1].stateTimer, 1.15);
  enemy.summonBudget -= 1;
  enemy.summonCooldown = difficulty.summonCooldown;
  return true;
}

function clearBossAttackProjectiles(reason) {
  for (let index = projectiles.length - 1; index >= 0; index--) {
    if (projectiles[index].type === "moneyBundle" || projectiles[index].type === "bossShockwave") releaseProjectileAt(index);
  }
  game.lastClearedProjectileReason = reason;
}

function updateBossHazards(dt) {
  updateBossFloorWarnings(dt);
  updateBossVehicle(dt);
}

function updateBossFloorWarnings(dt) {
  for (let index = bossFloorWarnings.length - 1; index >= 0; index--) {
    const warning = bossFloorWarnings[index];
    if (!warning.impacted) {
      warning.timer -= dt;
      if (warning.kind === "headlight") warning.x = clamp(warning.x + warning.direction * 82 * dt, game.levelArenaLeft + 80, game.levelArenaRight - 80);
      if (warning.timer <= 0) {
        warning.impacted = true;
        const playerCenter = player.x + player.w / 2;
        if (playerCenter > warning.x - warning.w / 2 && playerCenter < warning.x + warning.w / 2 && player.y + player.h > GROUND_Y - 28) {
          const damaged = damagePlayer(warning.x, warning.kind === "cityRoots" || warning.kind === "boneDebt");
          const profile = BOSS_PROFILES[game.activeBossProfile];
          if (damaged && profile && profile.bossId === "todor") RivalSpeech.speakEvent("todor", "playerHit", 2);
        }
        const color = warning.kind === "moneyRain" || warning.kind === "headlight" ? "#d4bd82" : warning.kind === "cityRoots" ? "#7e3945" : "#a8a18e";
        impactBurst(warning.x, GROUND_Y - 7, warning.kind === "headlight" ? 8 : 12, color, 125, 1);
        if (warning.kind === "moneyRain") paperBurst(warning.x, GROUND_Y - 12, 10);
        addShake("light");
      }
    } else {
      warning.life -= dt;
      if (warning.life <= 0) bossFloorWarnings.splice(index, 1);
    }
  }
}

function beginVehicleDrive(profile, enemy) {
  if (!bossVehicle) return;
  const direction = bossVehicle.direction || (game.bossAttackSerial % 2 ? 1 : -1);
  bossVehicle.mode = "drive";
  bossVehicle.direction = direction;
  bossVehicle.x = direction > 0 ? profile.arenaLeft - bossVehicle.w - 20 : profile.arenaRight + 20;
  bossVehicle.vx = direction * (profile.vehicleSpeed || (profile.id === "todorViaduct" ? 455 : 405));
  bossVehicle.hitPlayer = false;
  bossVehicle.headlights = 1;
  game.vehicleAttackActive = true;
  playSound("vehicleRumble");
  enemy.x = direction > 0 ? profile.arenaLeft + 80 : profile.arenaRight - enemy.w - 80;
}

function updateBossVehicle(dt) {
  if (!bossVehicle) return;
  const profile = BOSS_PROFILES[bossVehicle.profileId];
  if (!profile) return;
  if (bossVehicle.mode === "drive") {
    bossVehicle.x += bossVehicle.vx * dt;
    emitVehicleSmoke(bossVehicle, dt, 1.8);
    const vehicleHitbox = { x: bossVehicle.x + 18, y: bossVehicle.y + 10, w: bossVehicle.w - 36, h: bossVehicle.h - 12 };
    if (!bossVehicle.hitPlayer && overlap(vehicleHitbox, playerRect())) {
      bossVehicle.hitPlayer = true;
      if (damagePlayer(bossVehicle.x + bossVehicle.w / 2, true)) RivalSpeech.speakEvent("todor", "playerHit", 2);
    }
    const finished = bossVehicle.direction > 0 ? bossVehicle.x > profile.arenaRight + 35 : bossVehicle.x + bossVehicle.w < profile.arenaLeft - 35;
    if (finished) {
      bossVehicle.mode = "parked";
      bossVehicle.x = bossVehicle.parkedX;
      bossVehicle.vx = 0;
      bossVehicle.headlights = .55;
      game.vehicleAttackActive = false;
    }
  } else if (bossVehicle.mode === "warning" || bossVehicle.mode === "headlight") {
    bossVehicle.headlights = .78 + Math.sin(game.time * 15) * .18;
  } else if (bossVehicle.mode === "defeatWait") {
    bossVehicle.waitTimer -= dt;
    bossVehicle.headlights = approach(bossVehicle.headlights, .18, dt * .18);
    if (bossVehicle.waitTimer <= 0) {
      const defeatedBoss = enemies.find((enemy) => enemy.type === "campaignBoss" && enemy.dead);
      if (defeatedBoss) defeatedBoss.hiddenInVehicle = true;
      bossVehicle.mode = "retreat";
      bossVehicle.vx = profile.variant === 1 ? -185 : 215;
    }
  } else if (bossVehicle.mode === "retreat") {
    bossVehicle.x += bossVehicle.vx * dt;
    emitVehicleSmoke(bossVehicle, dt, 1.1);
    bossVehicle.headlights = approach(bossVehicle.headlights, 0, dt * .35);
    if (bossVehicle.x < profile.arenaLeft - bossVehicle.w - 120 || bossVehicle.x > profile.arenaRight + 180) bossVehicle = null;
  }
}

function emitVehicleSmoke(vehicle, dt, rate = 1) {
  if (!vehicle || Math.random() >= dt * 9 * rate) return;
  const rearX = vehicle.direction > 0 ? vehicle.x + 18 : vehicle.x + vehicle.w - 18;
  emitParticle({ x: rearX, y: vehicle.y + vehicle.h - 2, vx: -vehicle.direction * (18 + Math.random() * 24),
    vy: -8 - Math.random() * 14, size: 3 + Math.random() * 3, life: .45 + Math.random() * .3,
    maxLife: .75, color: "#596068", gravity: -5, kind: "steam", source: "vehicle" });
}

function hitEnemy(enemy, damage, direction, fiery, impactSound = "enemyHit") {
  const bossTarget = enemy.type === "boss" || enemy.type === "campaignBoss";
  const shieldRaised = enemy.type === "shieldUndead" && enemy.state !== "recover" && enemy.state !== "turning" && enemy.state !== "shieldStrike";
  const frontalHit = direction === -enemy.facing;
  if (shieldRaised && frontalHit) {
    enemy.flashTimer = .07;
    enemy.vx = direction * 34;
    impactBurst(enemy.x + enemy.w / 2 - enemy.facing * 19, enemy.y + 34, 5, fiery ? "#d98239" : "#aab2ac", 78, direction);
    playSound("spearDull");
    return false;
  }
  enemy.health -= damage;
  enemy.hurtTimer = bossTarget ? 0.16 : 0.28;
  enemy.flashTimer = 0.1;
  enemy.vx = direction * (bossTarget ? 95 : 205);
  addShake(bossTarget ? "medium" : "light");
  game.hitStop = Math.max(game.hitStop, bossTarget ? 0.055 : 0.045);
  game.score += 10;
  addScorePopup(enemy.x + enemy.w / 2, enemy.y + 12, "+10", fiery ? "#ffb34f" : "#f5f0d8");
  impactBurst(enemy.x + enemy.w / 2, enemy.y + enemy.h * 0.42, fiery ? 11 : 7, fiery ? "#ef7b32" : "#f3f0dc", fiery ? 190 : 145, direction);
  impactGash(enemy.x + enemy.w / 2, enemy.y + enemy.h * 0.42, direction, fiery ? "#ffb46a" : enemy.elite ? "#e8907c" : "#f2ecd8");
  if (bossTarget) playSound("bossHit");
  else if (impactSound) playSound(impactSound);
  vibrate(16);
  updateHUD();
  if (enemy.health > 0) return true;

  enemy.dead = true;
  enemy.stateTimer = bossTarget ? (enemy.type === "campaignBoss" ? 2.7 : 1.35) : 0.55;
  enemy.vx = direction * 100;
  game.score += enemy.score;
  addScorePopup(enemy.x + enemy.w / 2, enemy.y, `+${enemy.score}`, enemy.elite ? "#e8a48a" : "#d9b96d");
  soulBurst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, bossTarget ? 28 : enemy.elite ? 19 : 13, bossTarget ? 230 : enemy.elite ? 195 : 155);
  dustRing(enemy.x + enemy.w / 2, enemy.y + enemy.h, enemy.elite ? 13 : 8);
  if (enemy.elite) addShake("medium");
  spawnSoulCoins(enemy);
  if (enemy.type === "pizzaZombie") pizzaCrumbBurst(enemy.x + enemy.w / 2, enemy.y + enemy.h * .55, 5, direction);
  playSound(bossTarget ? "bossDefeated" : "defeated");
  playSound("reward");

  if (enemy.type === "campaignBoss") {
    defeatCampaignBoss(enemy);
  } else if (enemy.type === "boss") {
    cancelTransientControls(true);
    speakVelkoEvent("defeated", VELKO_PRIORITY.defeated);
    game.bossDefeated = true;
    game.arenaLocked = false;
    stopPizzaEncounter(true);
    SoundManager.setBossTension(false);
    addShake("heavy");
    game.endTimer = 2.6;
    game.endVictory = true;
  } else if (enemy.dropRoll > 0.66) {
    const options = ["spear", "dagger", "torch"].filter((weapon) => weapon !== player.weapon);
    drops.push({ x: enemy.x + enemy.w / 2 - 13, y: GROUND_Y - 50, w: 26, h: 26, weapon: options[Math.floor(enemy.dropRoll * 10) % options.length], t: 0, life: 12 });
  }
  updateHUD();
  return true;
}

function defeatCampaignBoss(enemy) {
  const profile = BOSS_PROFILES[enemy.profileId];
  game.bossDefeated = true;
  game.bossEncounterState = "defeated";
  game.bossVictoryPending = true;
  game.flash = Math.max(game.flash, .26);
  game.hitStop = Math.max(game.hitStop, .12);
  dustRing(enemy.x + enemy.w / 2, enemy.y + enemy.h, 18);
  impactBurst(enemy.x + enemy.w / 2, enemy.y + enemy.h * .45, 14,
    profile && profile.bossId === "todor" ? "#e8933f" : "#a9d3de", 240, -enemy.facing);
  if (profile && profile.id === "velkoLastCity") {
    // The campaign's true ending earns the biggest release in the game.
    game.flash = .45;
    game.hitStop = .2;
    soulBurst(enemy.x + enemy.w / 2, enemy.y + enemy.h * .4, 26, 300);
    game.lightning = .35;
  }
  game.vehicleAttackActive = false;
  cancelTransientControls(true);
  bossFloorWarnings.length = 0;
  clearAllProjectiles("campaign boss defeated");
  cancelBossSpeech("campaign boss defeated");
  for (const minion of enemies) {
    if (minion === enemy || !minion.summonedByBoss || minion.dead) continue;
    minion.dead = true;
    minion.stateTimer = .55;
    minion.vx = 0;
    soulBurst(minion.x + minion.w / 2, minion.y + minion.h / 2, 8, 95);
  }
  if (profile && profile.defeatLine) RivalSpeech.speak(profile.bossId, profile.defeatLine, 7, "defeated");
  if (profile && profile.bossId === "todor") paperBurst(enemy.x + enemy.w / 2, enemy.y + 40, 12);
  if (profile && profile.id === "velkoMarket") impactBurst(enemy.x + enemy.w / 2, enemy.y + 72, 12, "#c5b890", 115, 1);
  if (profile && profile.bossId === "todor" && bossVehicle) {
    bossVehicle.mode = "defeatWait";
    bossVehicle.x = bossVehicle.parkedX;
    bossVehicle.vx = 0;
    bossVehicle.waitTimer = .72;
    bossVehicle.headlights = .35;
    enemy.vx = Math.sign((bossVehicle.x + bossVehicle.w / 2) - (enemy.x + enemy.w / 2)) * 62;
  }
  SoundManager.setBossTension(false);
  addShake("heavy");
  game.endTimer = profile && profile.id === "velkoLastCity" ? 4.2 : profile && profile.id === "velkoFinal" ? 3.8 : 3.1;
  game.endVictory = true;
}

// -----------------------------------------------------------------------------
// Level spawning and pickups
// -----------------------------------------------------------------------------

function updateLevel(dt) {
  if (game.currentLevel === 0) {
    while (game.spawnCursor < spawnPlan.length && player.x >= spawnPlan[game.spawnCursor].trigger) {
      const item = spawnPlan[game.spawnCursor++];
      if (Math.abs(item.x - player.x) > 190) spawnEnemy(item.type, item.x);
    }
    if (player.x > 6520 && !game.bossSpawned) spawnEnemy("boss", 6920);
    updateCheckpoint();
    updatePizzaSpawner(dt);
  } else {
    const definition = currentLevelDefinition();
    const plan = activeSpawnPlan;
    while (game.spawnCursor < plan.length && player.x >= plan[game.spawnCursor].trigger) {
      const pressureCap = definition.maxEnemies + Math.ceil((getLevelDifficulty().encounterPressure - 1) * (currentArchetype().pressureScale || 1) * 3);
      if (activeEnemyCount() >= pressureCap) break;
      const item = plan[game.spawnCursor++];
      if (Math.abs(item.x - player.x) > 185) spawnEnemy(item.type, item.x);
    }
    updateCheckpoint();
    updateSafeAnchors();
    updateFallingStones(dt);
    updateSurvivalSequence(dt);
    updateLevelExit(dt);
    if (game.bossEncounterState === "active" || game.bossEncounterState === "defeated") updateBossHazards(dt);
  }

  updateSoulCoins(dt);

  for (let index = drops.length - 1; index >= 0; index--) {
    const drop = drops[index];
    drop.t += dt;
    drop.life -= dt;
    drop.y = (drop.kind === "cinderwindAmulet" ? GROUND_Y - 67 : GROUND_Y - 48) + Math.sin(drop.t * (drop.kind === "cinderwindAmulet" ? 2.1 : 3.5)) * (drop.kind === "cinderwindAmulet" ? 3 : 6);
    if (overlap(drop, playerRect())) {
      if (drop.kind === "cinderwindAmulet") {
        collectLevelAmulet();
        continue;
      }
      if (!drop.kind || drop.kind === "weapon") player.weapon = drop.weapon;
      drops.splice(index, 1);
      const reward = drop.kind === "soul" ? 125 : drop.kind === "score" ? 75 : 50;
      game.score += reward;
      burst(drop.x + 13, drop.y + 13, 16, drop.weapon === "torch" ? "#f2963f" : "#81b9cd", 160);
      addScorePopup(drop.x + 13, drop.y - 4, `+${reward}`, "#8be4f0");
      playSound("pickup");
      vibrate(20);
      game.flash = Math.max(game.flash, 0.08);
      burst(player.x + player.w / 2, player.y + 30, 12, drop.weapon === "torch" ? "#f3a447" : "#b8d9df", 115);
      if (!drop.kind || drop.kind === "weapon") showWeaponToast(drop.weapon);
      updateHUD();
    } else if (drop.life <= 0) drops.splice(index, 1);
  }
}

function activeEnemyCount() {
  let count = 0;
  for (const enemy of enemies) if (!enemy.dead && enemy.type !== "boss" && enemy.type !== "campaignBoss") count += 1;
  return count;
}

function crateHitbox(crate) {
  return { x: crate.x, y: GROUND_Y - 42, w: 46, h: 42 };
}

function breakCrate(crate, direction) {
  if (crate.broken) return;
  crate.broken = true;
  for (let index = 0; index < 9; index++) {
    emitParticle({ x: crate.x + 23, y: GROUND_Y - 22, vx: direction * (25 + Math.random() * 55) + (Math.random() - .5) * 60,
      vy: -35 - Math.random() * 100, size: 2 + Math.random() * 3, life: .45 + Math.random() * .3, maxLife: .75,
      color: index % 3 ? "#795136" : "#b2814d", gravity: 230, kind: "splinter", rotation: Math.random() * 3, spin: (Math.random() - .5) * 8 });
  }
  const isWeapon = crate.loot === "spear" || crate.loot === "dagger" || crate.loot === "torch";
  drops.push({ x: crate.x + 10, y: GROUND_Y - 50, w: 26, h: 26, kind: isWeapon ? "weapon" : crate.loot, weapon: isWeapon ? crate.loot : "spear", t: 0, life: 12 });
  playSound("spearDull");
}

function updateCheckpoint() {
  const checkpoint = currentLevelDefinition().checkpoint;
  if (!checkpoint || game.checkpointId === checkpoint.id || player.x < checkpoint.x) return;
  activateCheckpoint(checkpoint.id);
}

function activateCheckpoint(checkpointId) {
  const checkpoint = currentLevelDefinition().checkpoint;
  if (!checkpoint || checkpoint.id !== checkpointId || game.checkpointId === checkpointId) return;
  game.checkpointId = checkpointId;
  game.checkpointX = checkpoint.x + 72;
  game.safeAnchorX = game.checkpointX;
  game.checkpointPulse = 1;
  game.score += 100;
  game.checkpointScore = game.score;
  addScorePopup(checkpoint.x, GROUND_Y - 110, "+100", "#a9e6ef");
  soulBurst(checkpoint.x, GROUND_Y - 66, 14, 100);
  if (player.lives > 0 && player.lives < MAX_PLAYER_LIVES) {
    player.lives += 1;
    addScorePopup(checkpoint.x, GROUND_Y - 142, "LIFE RESTORED", "#9fe6b8");
    playSound("heal");
  }
  playSound("pickup");
  updateHUD();
}

function updateSafeAnchors() {
  if (game.currentLevel !== 3) return;
  for (const anchor of currentLevelDefinition().safeAnchors) {
    if (player.x >= anchor && hasGroundAt(anchor + player.w / 2)) game.safeAnchorX = Math.max(game.safeAnchorX, anchor);
  }
}

function updateFallingStones(dt) {
  if (game.currentLevel !== 3) return;
  const definitions = currentLevelDefinition().stones;
  for (let index = 0; index < definitions.length && fallingStones.length < 2; index++) {
    const stone = definitions[index];
    if (player.x >= stone.trigger && !triggeredStones.has(index)) {
      triggeredStones.add(index);
      fallingStones.push({ id: index, type: "fallingStone", x: stone.x, y: -52, w: 34, h: 38, state: "warning", timer: .72 + seededNoise(index * 9.1) * .14, vy: 0, hitPlayer: false });
    }
  }
  for (let index = fallingStones.length - 1; index >= 0; index--) {
    const stone = fallingStones[index];
    if (stone.state === "warning") {
      stone.timer -= dt;
      if (stone.timer <= 0) stone.state = "falling";
      continue;
    }
    stone.vy += 980 * dt;
    stone.y += stone.vy * dt;
    if (!stone.hitPlayer && overlap(stone, playerRect())) {
      stone.hitPlayer = true;
      damagePlayer(stone.x + stone.w / 2, true);
    }
    if (stone.y + stone.h >= GROUND_Y && hasGroundAt(stone.x + stone.w / 2)) {
      impactBurst(stone.x + stone.w / 2, GROUND_Y - 5, 10, "#8b8175", 120, 1);
      dustRing(stone.x + stone.w / 2, GROUND_Y - 3, 9);
      addShake("light");
      fallingStones.splice(index, 1);
    } else if (stone.y > VIEW_H + 80 || stone.x < game.cameraX - 240 || stone.x > game.cameraX + VIEW_W + 320) {
      fallingStones.splice(index, 1);
    }
  }
}

function updateSurvivalSequence(dt) {
  if (game.currentLevel !== 4) return;
  if (game.survivalState === "idle" && player.x >= 3880) {
    game.survivalState = "active";
    game.survivalTimer = 0;
    game.survivalWave = 0;
    game.arenaLocked = true;
    game.levelArenaLeft = 3660;
    game.levelArenaRight = 5050;
    game.ambientPulse = .3;
  }
  if (game.survivalState === "complete") {
    game.blackoutProgress = approach(game.blackoutProgress, clamp((player.x - 4750) / 900, 0, 1), dt * .55);
    return;
  }
  if (game.survivalState !== "active" && game.survivalState !== "cleanup") return;
  if (game.survivalState === "active") game.survivalTimer += dt;
  while (game.survivalState === "active" && game.survivalWave < BLACKOUT_SURVIVAL_WAVES.length && game.survivalTimer >= BLACKOUT_SURVIVAL_WAVES[game.survivalWave].at) {
    const wave = BLACKOUT_SURVIVAL_WAVES[game.survivalWave++];
    for (const [type, x] of wave.enemies) if (activeEnemyCount() < 5 && Math.abs(x - player.x) > 230) spawnEnemy(type, x);
    game.lightning = Math.max(game.lightning, .16);
  }
  if (game.survivalState === "active" && game.survivalTimer >= 23) game.survivalState = "cleanup";
  if (game.survivalState === "cleanup" && activeEnemyCount() === 0) {
    game.survivalState = "complete";
    game.arenaLocked = false;
    game.score += 1000;
    addScorePopup(player.x + player.w / 2, player.y - 10, "+1000", "#d9c27b");
    drops.push({ x: 4740, y: GROUND_Y - 50, w: 26, h: 26, kind: "soul", weapon: "spear", t: 0, life: 15 });
    drops.push({ x: 4820, y: GROUND_Y - 50, w: 26, h: 26, kind: "weapon", weapon: "dagger", t: 0, life: 15 });
    playSound("reward");
    updateHUD();
  }
}

function updateLevelExit(dt) {
  const definition = currentLevelDefinition();
  if (game.exitState === "idle") {
    const survivalReady = game.currentLevel !== 4 || game.survivalState === "complete";
    const nearbyEnemy = enemies.some((enemy) => !enemy.dead && Math.abs(enemy.x - definition.exitX) < 620);
    if (survivalReady && !nearbyEnemy && player.x >= definition.exitX) {
      game.exitState = "opening";
      game.exitTimer = game.currentLevel === 4 ? 2.8 : 2.15;
      player.vx = 0;
      game.ambientPulse = .5;
      if (game.currentLevel === 3) game.lightning = .22;
      game.score += 500;
      playSound("reward");
      updateHUD();
    }
  } else if (game.exitState === "opening") {
    game.exitTimer -= dt;
    if (game.exitTimer <= 0) {
      game.exitState = "boss";
      startBossEncounter(definition.bossProfile);
    }
  }
}

function loadCampaignProgress() {
  try {
    const value = JSON.parse(localStorage.getItem(CAMPAIGN_STORAGE_KEY) || "null");
    if (value && Number.isInteger(value.highestUnlockedLevel)) game.highestUnlockedLevel = clamp(value.highestUnlockedLevel, 0, LEVEL_DEFINITIONS.length - 1);
  } catch (_error) {
    game.highestUnlockedLevel = Math.max(0, game.highestUnlockedLevel);
  }
}

function unlockNextLevel() {
  game.highestUnlockedLevel = Math.max(game.highestUnlockedLevel, Math.min(game.currentLevel + 1, LEVEL_DEFINITIONS.length - 1));
  try {
    localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify({ highestUnlockedLevel: game.highestUnlockedLevel }));
  } catch (_error) {
    // Progress remains available in memory when storage is blocked.
  }
}

function resetLevelState(reason = "level state reset") {
  BossSpeech.resetEncounter();
  resetEncounterState(reason);
  velkoSubtitleState.active = false;
  velkoSubtitleState.line = "";
  velkoSubtitleState.timer = 0;
  velkoSubtitle.classList.remove("visible");
  velkoSubtitle.setAttribute("aria-hidden", "true");
  stopPizzaEncounter(false);
  SoundManager.setBossTension(false);
  enemies.length = 0;
  fallingStones.length = 0;
  triggeredStones.clear();
  levelCrates.length = 0;
  activeSpawnPlan.length = 0;
  drops.length = 0;
  clearSoulCoins();
  scorePopups.length = 0;
  while (particles.length) releaseParticleAt(particles.length - 1);
  while (projectiles.length) releaseProjectileAt(projectiles.length - 1);
  game.spawnCursor = 0;
  game.bossSpawned = false;
  game.bossDefeated = false;
  game.bossPhase = 1;
  game.bossIntroTime = 0;
  game.bossIntroCharacters = 0;
  game.bossIntroFadeStarted = 0;
  game.bossSpeechComplete = false;
  game.bossIntroTriggerCount = 0;
  game.bossIntroCompletionRequested = false;
  game.bossIntroCompletionGuard = false;
  game.activeBossProfile = null;
  game.bossEncounterState = "idle";
  game.arenaLocked = false;
  game.arenaGateProgress = 0;
  game.pizzaSequenceActive = false;
  game.pizzaPendingSpawns = 0;
  game.pizzaNextSpawnTimer = -1;
  game.pizzaSpawnOrdinal = 0;
  game.pizzaFirstThrowDialogueTriggered = false;
  game.lastPizzaDialogueEvent = "none";
  game.lastPizzaProjectileResult = "none";
  game.exitState = "idle";
  game.exitTimer = 0;
  game.survivalState = "idle";
  game.survivalTimer = 0;
  game.survivalWave = 0;
  game.blackoutProgress = 0;
  game.rangedNextShotAt = 0;
  game.rangedLastWraithShotAt = -99;
  game.rangedLastGunnerShotAt = -99;
  game.rangedLastShooterId = 0;
  game.rangedShotsFired = 0;
  game.levelArenaLeft = 0;
  game.levelArenaRight = 0;
  game.lightning = 0;
  game.checkpointPulse = 0;
  game.environmentTimer = 0;
  game.weaponToastTimer = 0;
  game.levelAmuletState = "consumed";
  game.levelAmuletSpawnCount = 0;
  game.amuletCollectedThisAttempt = false;
  game.amuletShatteredThisAttempt = false;
  game.soulCoinsCollectedThisLevel = 0;
  game.soulCoinScoreThisLevel = 0;
  game.lastCoinDropEnemyType = "none";
  game.lastCoinSoundAt = -99;
  game.fallPenaltyReady = true;
  game.nextLevelReady = false;
  game.transitionTarget = -1;
  game.transitionTimer = 0;
  cancelTransientControls(true);
  bossIntroDialogue.textContent = "";
  bossIntroName.textContent = "VELKO";
  bossSubtitleSpeaker.textContent = "VELKO";
  bossIntroOverlay.classList.remove("visible", "leaving");
  bossIntroOverlay.classList.remove("campaign", "velko", "todor");
  bossIntroOverlay.setAttribute("aria-hidden", "true");
  weaponToast.classList.remove("visible");
  releaseTransientVoices();
}

const CAMPAIGN_ROMAN_LEVELS = Object.freeze(["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"]);

function loadLevel(levelIndex, options = {}) {
  const target = clamp(levelIndex, 0, LEVEL_DEFINITIONS.length - 1);
  const previousLives = player.lives;
  resetLevelState(options.resetReason || `load level ${target + 1}`);
  game.currentLevel = target;
  const definition = currentLevelDefinition();
  WORLD_W = definition.worldWidth;
  game.mode = "running";
  game.levelTime = 0;
  game.cameraX = 0;
  game.shake = 0;
  game.flash = 0;
  game.hitStop = 0;
  game.endTimer = 0;
  game.endVictory = false;
  game.ambientPulse = 0;
  game.checkpointId = options.checkpointId || null;
  game.checkpointX = options.checkpointX || 120;
  game.eliteSpawnedThisLevel = false;
  game.checkpointScore = options.checkpointScore ?? game.score;
  game.safeAnchorX = options.checkpointX || 120;
  if (!options.preserveScore) game.score = options.score ?? game.score;
  if (!options.checkpointRestart) game.levelStartScore = game.score;
  resetPlayer();
  if (options.preserveLives) player.lives = clamp(previousLives, 1, MAX_PLAYER_LIVES);
  const startX = options.checkpointX || 120;
  player.x = startX;
  player.y = GROUND_Y - player.h;
  player.invulnerable = options.checkpointRestart ? 1.35 : .45;
  if (target > 0) {
    buildActiveSpawnPlan(definition);
    for (const crate of definition.crates) levelCrates.push({ ...crate, broken: Boolean(crate.broken || (options.checkpointRestart && crate.x < startX)) });
    game.spawnCursor = activeSpawnPlan.findIndex((item) => item.trigger >= startX - 120);
    if (game.spawnCursor < 0) game.spawnCursor = activeSpawnPlan.length;
    if (target === 3) {
      definition.stones.forEach((stone, index) => { if (stone.trigger < startX - 80) triggeredStones.add(index); });
    }
  } else if (options.checkpointRestart) {
    game.spawnCursor = spawnPlan.findIndex((item) => item.trigger >= startX - 120);
    if (game.spawnCursor < 0) game.spawnCursor = spawnPlan.length;
  }
  if (options.amuletSnapshot) restoreLevelAmuletFromCheckpoint(options.amuletSnapshot);
  else resetLevelAmuletForNewAttempt();
  levelNumber.textContent = `${CAMPAIGN_ROMAN_LEVELS[target]} / XV`;
  updateHUD();
  pauseOverlay.classList.remove("visible");
  endOverlay.classList.remove("visible");
  endOverlay.classList.remove("victory", "defeat");
  completionList.hidden = true;
  completionList.textContent = "";
  nextLevelButton.hidden = true;
  canvas.focus({ preventScroll: true });
  startLevelMusic();
}

function completeLevel() {
  completeBossEncounter();
}

function completeBossEncounter() {
  clearCampaignBossIntroFallback();
  game.bossVictoryPending = false;
  game.bossEncounterState = "complete";
  game.arenaLocked = false;
  cancelTransientControls(true);
  cancelBossSpeech("boss encounter complete");
  bossFloorWarnings.length = 0;
  clearAllProjectiles("boss encounter complete");
  clearSoulCoins();
  game.vehicleAttackActive = false;
  bossVehicle = null;
  SoundManager.setBossTension(false);
  if (game.currentLevel >= LEVEL_DEFINITIONS.length - 1) {
    finishChapter();
    return;
  }
  unlockNextLevel();
  if (player.lives > 0 && player.lives < MAX_PLAYER_LIVES) {
    player.lives += 1;
    updateHUD();
  }
  game.nextLevelReady = true;
  game.mode = "levelComplete";
  setPlayerAnimationState("victoryIdle");
  endTitle.textContent = game.currentLevel === 4 ? "ACT I COMPLETE" : "LEVEL COMPLETE";
  endMessage.textContent = currentLevelDefinition().name;
  endScore.textContent = String(game.score).padStart(6, "0");
  completionList.textContent = "";
  const completionStats = [
    `Souls claimed — ${game.soulCoinsCollectedThisLevel}`,
    `Level score — ${String(Math.max(0, game.score - game.levelStartScore)).padStart(5, "0")}`,
    `Lives remaining — ${player.lives} of ${MAX_PLAYER_LIVES}`
  ];
  for (const statLine of completionStats) {
    const row = document.createElement("div");
    row.textContent = statLine;
    completionList.appendChild(row);
  }
  completionList.hidden = false;
  nextLevelButton.hidden = false;
  restartButton.textContent = "Restart Level";
  endOverlay.classList.add("victory", "visible");
  stopMusic();
  releaseTransientVoices();
  playSound("victory");
}

function advanceToNextLevel() {
  if (!game.nextLevelReady || game.currentLevel >= LEVEL_DEFINITIONS.length - 1) return;
  game.nextLevelReady = false;
  game.transitionTarget = game.currentLevel + 1;
  game.transitionTimer = 1.65;
  game.mode = "transition";
  endOverlay.classList.remove("visible");
  cancelTransientControls(true);
  releaseTransientVoices();
}

function updateTransition(dt) {
  game.time += dt;
  game.transitionTimer -= dt;
  updateParticles(dt);
  if (game.transitionTimer > 0) return;
  const target = game.transitionTarget;
  try {
    loadLevel(target, { preserveScore: true, preserveLives: true, resetReason: `transition to level ${target + 1}` });
    game.lastTransitionError = "none";
  } catch (error) {
    game.lastTransitionError = error && error.message ? error.message : String(error);
    game.mode = "levelComplete";
    game.nextLevelReady = true;
    game.transitionTarget = -1;
    game.transitionTimer = 0;
    endOverlay.classList.add("visible");
  }
}

function restartLevel() {
  const score = game.levelStartScore;
  loadLevel(game.currentLevel, { score, resetReason: "restart level" });
  playSound("restart");
}

function loadCheckpoint() {
  if (!game.checkpointId) {
    restartLevel();
    return;
  }
  const checkpointId = game.checkpointId;
  const checkpointX = game.checkpointX;
  const checkpointScore = game.checkpointScore;
  const amuletSnapshot = {
    state: game.levelAmuletState,
    spawnCount: game.levelAmuletSpawnCount,
    collected: game.amuletCollectedThisAttempt,
    shattered: game.amuletShatteredThisAttempt
  };
  game.score = checkpointScore;
  loadLevel(game.currentLevel, { checkpointId, checkpointX, checkpointScore, checkpointRestart: true, preserveScore: true, amuletSnapshot, resetReason: "checkpoint restart" });
  playSound("restart");
}

function finishChapter() {
  clearCampaignBossIntroFallback();
  unlockNextLevel();
  cancelBossSpeech("final campaign victory");
  game.mode = "victory";
  cancelTransientControls(true);
  setPlayerAnimationState("victoryIdle");
  endTitle.textContent = "GRAVE KNIGHT COMPLETE";
  endMessage.textContent = "All fifteen rival gates have fallen";
  endScore.textContent = String(game.score).padStart(6, "0");
  completionList.textContent = "";
  for (const definition of LEVEL_DEFINITIONS) {
    const line = document.createElement("div");
    line.textContent = `✓ ${definition.name}`;
    completionList.appendChild(line);
  }
  completionList.hidden = false;
  nextLevelButton.hidden = true;
  restartButton.textContent = "Restart Level";
  soulBurst(player.x + player.w / 2, player.y + 28, 22, 120);
  endOverlay.classList.add("victory", "visible");
  stopMusic();
  releaseTransientVoices();
  playSound("victory");
}

// -----------------------------------------------------------------------------
// Particles / effects
// -----------------------------------------------------------------------------

const particles = [];
const particlePool = [];
let MAX_PARTICLES = QUALITY.particleBudget;
const scorePopups = [];

function addScorePopup(x, y, text, color) {
  scorePopups.push({ x, y, text, color, life: 0.72 });
}

function burst(x, y, count, color, speed) {
  for (let i = 0; i < Math.min(count, 18); i++) {
    const angle = Math.random() * Math.PI * 2;
    const velocity = speed * (0.25 + Math.random() * 0.75);
    emitParticle({
      x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity - speed * 0.22,
      size: 1.5 + Math.random() * 3.5, life: 0.32 + Math.random() * 0.55,
      maxLife: 0.87, color, gravity: 180 + Math.random() * 250, kind: "spark"
    });
  }
}

function impactGash(x, y, direction, color = "#f2ecd8") {
  emitParticle({
    x, y, vx: direction * 30, vy: 0, size: 3.4 + Math.random() * 1.4,
    life: .13, maxLife: .13, color, gravity: 0, kind: "gash",
    rotation: direction > 0 ? -.5 + Math.random() * .5 : Math.PI + .5 - Math.random() * .5
  });
}

function emitParticle(data) {
  if (particles.length >= MAX_PARTICLES) return null;
  const particle = particlePool.pop() || {};
  Object.assign(particle, data);
  particle.maxLife = data.maxLife || data.life || .5;
  particle.kind = data.kind || "spark";
  particle.rotation = data.rotation || 0;
  particle.spin = data.spin || 0;
  particle.source = data.source || "";
  particles.push(particle);
  return particle;
}

function pizzaCrumbBurst(x, y, count = 6, direction = 1) {
  for (let index = 0; index < Math.min(count, 8); index++) {
    emitParticle({ x, y, vx: direction * (18 + Math.random() * 45) + (Math.random() - .5) * 35,
      vy: -24 - Math.random() * 65, size: 1.5 + Math.random() * 2.3,
      life: .28 + Math.random() * .24, maxLife: .52,
      color: index % 3 === 0 ? "#9e392f" : index % 2 ? "#d18a45" : "#6f4329",
      gravity: 170, kind: "pizzaCrumb", source: "pizza" });
  }
}

function paperBurst(x, y, count = 7) {
  for (let index = 0; index < Math.min(count, 12); index++) emitParticle({ x, y,
    vx: (Math.random() - .5) * 115, vy: -25 - Math.random() * 85, size: 2 + Math.random() * 2,
    life: .55 + Math.random() * .45, maxLife: 1, color: index % 3 ? "#cfc6a4" : "#8f876f",
    gravity: 75, kind: "paper", rotation: Math.random() * Math.PI, spin: (Math.random() - .5) * 7 });
}

function pizzaSplat(x, y, direction) {
  pizzaCrumbBurst(x, y, 7, direction);
  emitParticle({ x, y, vx: 0, vy: -18, size: 5, life: .32, maxLife: .32,
    color: "#c9783e", gravity: 30, kind: "dust", source: "pizza" });
  playSound("pizzaSplat");
}

function clearPizzaProjectiles(result = "cleared") {
  for (let index = projectiles.length - 1; index >= 0; index--) {
    if (projectiles[index].type === "pizza") finishPizzaProjectile(index, result, false);
  }
}

function clearPizzaEffects() {
  for (let index = particles.length - 1; index >= 0; index--) {
    if (particles[index].source === "pizza") releaseParticleAt(index);
  }
}

function stopPizzaEncounter(removeMinions = false) {
  game.pizzaSequenceActive = false;
  game.pizzaPendingSpawns = 0;
  game.pizzaNextSpawnTimer = -1;
  clearPizzaProjectiles("cleared");
  clearPizzaEffects();
  if (!removeMinions) return;
  for (const enemy of enemies) {
    if (enemy.type !== "pizzaZombie" || enemy.dead) continue;
    enemy.dead = true;
    enemy.stateTimer = .55;
    enemy.vx = 0;
    pizzaCrumbBurst(enemy.x + enemy.w / 2, enemy.y + enemy.h * .55, 4, enemy.facing || 1);
  }
}

function releaseParticleAt(index) {
  const particle = particles[index];
  particles.splice(index, 1);
  if (particlePool.length < MAX_PARTICLES) particlePool.push(particle);
}

function dustBurst(x, y, count, speed, direction = 0) {
  for (let index = 0; index < count; index++) {
    emitParticle({ x: x + (Math.random() - .5) * 12, y: y - Math.random() * 3,
      vx: direction * speed * .42 + (Math.random() - .5) * speed,
      vy: -12 - Math.random() * speed * .32, size: 3 + Math.random() * 4,
      life: .26 + Math.random() * .2, maxLife: .46, color: "#77766c", gravity: 45, kind: "dust" });
  }
}

function dustRing(x, y, count) {
  for (let index = 0; index < count; index++) {
    const side = index % 2 ? 1 : -1;
    emitParticle({ x: x + side * Math.random() * 12, y, vx: side * (45 + Math.random() * 95),
      vy: -18 - Math.random() * 32, size: 3 + Math.random() * 4, life: .34 + Math.random() * .22,
      maxLife: .56, color: "#817f73", gravity: 55, kind: "dust" });
  }
}

function impactBurst(x, y, count, color, speed, direction = 1) {
  for (let index = 0; index < count; index++) {
    const angle = (Math.random() - .5) * 1.8 + (direction < 0 ? Math.PI : 0);
    const velocity = speed * (.45 + Math.random() * .55);
    emitParticle({ x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity - 15,
      size: 1.2 + Math.random() * 2.5, life: .18 + Math.random() * .24, maxLife: .42,
      color, gravity: 210, kind: "spark" });
  }
}

function soulBurst(x, y, count, speed) {
  for (let index = 0; index < count; index++) {
    emitParticle({ x: x + (Math.random() - .5) * 24, y: y + (Math.random() - .5) * 28,
      vx: (Math.random() - .5) * speed, vy: -35 - Math.random() * speed,
      size: 2 + Math.random() * 3.5, life: .48 + Math.random() * .55, maxLife: 1.03,
      color: index % 3 ? "#8db9b3" : "#c5ded4", gravity: -18, kind: "soul" });
  }
}

function updateParticles(dt) {
  for (let index = particles.length - 1; index >= 0; index--) {
    const p = particles[index];
    p.life -= dt;
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= Math.pow(0.12, dt);
    p.rotation += p.spin * dt;
    if (p.life <= 0 || p.x < game.cameraX - 260 || p.x > game.cameraX + VIEW_W + 260 || p.y > VIEW_H + 120) releaseParticleAt(index);
  }
  for (let index = scorePopups.length - 1; index >= 0; index--) {
    const popup = scorePopups[index];
    popup.life -= dt;
    popup.y -= dt * 34;
    if (popup.life <= 0) scorePopups.splice(index, 1);
  }
  if (game.mode === "running" && player.weapon === "torch" && Math.random() < dt * 13) {
    emitParticle({
      x: player.x + player.w / 2 + player.facing * 49,
      y: player.y + 22,
      vx: (Math.random() - 0.5) * 24,
      vy: -35 - Math.random() * 35,
      size: 1.2 + Math.random() * 2,
      life: 0.28 + Math.random() * 0.24,
      maxLife: 0.52,
      color: Math.random() > 0.45 ? "#ffb33d" : "#e75528",
      gravity: -20, kind: "ember"
    });
  }
  game.environmentTimer -= dt;
  if (game.environmentTimer <= 0 && particles.length < MAX_PARTICLES - 8) {
    // Later levels breathe denser atmosphere: shorten the ambient emission gap.
    const ambientDensity = QUALITY.ambientInterval * Math.max(.7, 1 - game.currentLevel * .02);
    if (game.currentLevel === 0) {
      game.environmentTimer = (.55 + Math.random() * 1.1) * ambientDensity;
      const leaf = Math.random() > .24;
      emitParticle({ x: game.cameraX - 20, y: 245 + Math.random() * 170,
        vx: 32 + Math.random() * 28, vy: 7 + Math.random() * 12, size: leaf ? 3.2 : 2,
        life: 3.8, maxLife: 3.8, color: leaf ? "#66513f" : "#88b9b0", gravity: leaf ? 3 : -2,
        kind: leaf ? "leaf" : "soul", rotation: Math.random() * Math.PI, spin: (Math.random() - .5) * 3 });
    } else {
      const level = game.currentLevel;
      const theme = currentLevelDefinition().theme;
      const style = currentCampaignVisualStyle();
      const rainyTheme = level === 4 || theme === "neon" || theme === "citadel" || theme === "lastCity";
      const finalRainSlow = (level === 4 && game.activeBossProfile === "velkoFinal" || theme === "lastCity" && game.activeBossProfile === "velkoLastCity") && game.bossPhase === 2;
      game.environmentTimer = (rainyTheme ? (finalRainSlow ? .38 + Math.random() * .28 : .2 + Math.random() * .22) : .38 + Math.random() * .62) * ambientDensity;
      const lateKind = theme === "railYard" || theme === "foundry" ? "ash" : theme === "cathedral" || theme === "observatory" || theme === "crown" ? "soul" : theme === "floodway" || theme === "velvet" ? "fogWisp" : (Math.random() > .7 ? "steam" : "rain");
      const kind = level === 1 ? (Math.random() > .55 ? "soul" : "fogWisp") : level === 2 ? "ash" : level === 3 ? "dust" : level === 4 ? (Math.random() > .7 ? "steam" : "rain") : lateKind;
      const colors = { 1: "#83b9c8", 2: "#ad8565", 3: "#8b8c87", 4: "#758fa1" };
      emitParticle({ x: game.cameraX - 20 + Math.random() * (VIEW_W + 40), y: rainyTheme ? 80 + Math.random() * 320 : 245 + Math.random() * 170,
        vx: rainyTheme ? -18 : 10 + Math.random() * 24, vy: rainyTheme ? 150 + Math.random() * 80 : kind === "soul" ? -18 : 5 + Math.random() * 12,
        size: rainyTheme ? 1.2 : 2 + Math.random() * 2, life: rainyTheme ? 1.5 : 2.8, maxLife: rainyTheme ? 1.5 : 2.8,
        color: style ? style.accent : colors[level] || "#819aa5", gravity: 0, kind, rotation: Math.random() * Math.PI, spin: (Math.random() - .5) * 2 });
    }
  }
}

// -----------------------------------------------------------------------------
// Collisions
// -----------------------------------------------------------------------------

function separateEnemies() {
  for (let a = 0; a < enemies.length; a++) {
    const first = enemies[a];
    if (first.dead || first.state === "emerging") continue;
    for (let b = a + 1; b < enemies.length; b++) {
      const second = enemies[b];
      if (second.dead || second.state === "emerging") continue;
      const dx = (first.x + first.w / 2) - (second.x + second.w / 2);
      const minimum = (first.w + second.w) * 0.33;
      if (Math.abs(dx) < minimum) {
        const push = (minimum - Math.abs(dx)) * 0.035;
        first.x += (dx >= 0 ? push : -push);
        second.x -= (dx >= 0 ? push : -push);
      }
    }
  }
}

// -----------------------------------------------------------------------------
// Drawing: atmospheric world
// -----------------------------------------------------------------------------

function createLightSprite(inner, middle, size = 160) {
  const light = document.createElement("canvas");
  light.width = size;
  light.height = size;
  const lightContext = light.getContext("2d");
  const gradient = lightContext.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(.28, middle);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  lightContext.fillStyle = gradient;
  lightContext.fillRect(0, 0, size, size);
  return light;
}

const warmLightSprite = createLightSprite("rgba(255,226,142,.62)", "rgba(246,106,38,.2)");
const coolLightSprite = createLightSprite("rgba(183,234,230,.42)", "rgba(78,139,156,.14)", 120);
const crimsonLightSprite = createLightSprite("rgba(226,96,84,.5)", "rgba(148,42,46,.18)", 140);
const dangerVignetteCanvas = (() => {
  const layer = document.createElement("canvas");
  layer.width = VIEW_W; layer.height = VIEW_H;
  const layerContext = layer.getContext("2d");
  const vignette = layerContext.createRadialGradient(VIEW_W / 2, VIEW_H * .5, 190, VIEW_W / 2, VIEW_H * .5, 620);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(.62, "rgba(96,18,20,.05)");
  vignette.addColorStop(1, "rgba(126,20,22,.5)");
  layerContext.fillStyle = vignette;
  layerContext.fillRect(0, 0, VIEW_W, VIEW_H);
  return layer;
})();
const vignetteCanvas = (() => {
  const layer = document.createElement("canvas");
  layer.width = VIEW_W; layer.height = VIEW_H;
  const layerContext = layer.getContext("2d");
  const vignette = layerContext.createRadialGradient(VIEW_W / 2, VIEW_H * .48, 170, VIEW_W / 2, VIEW_H * .48, 590);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(.72, "rgba(3,5,12,.04)");
  vignette.addColorStop(1, "rgba(2,3,9,.31)");
  layerContext.fillStyle = vignette;
  layerContext.fillRect(0, 0, VIEW_W, VIEW_H);
  return layer;
})();

function render() {
  ctx.setTransform(renderScaleX, 0, 0, renderScaleY, 0, 0);
  ctx.imageSmoothingEnabled = true;
  const shakeX = game.shake > 0 ? (Math.random() - 0.5) * game.shake * QUALITY.shakeScale : 0;
  const shakeY = game.shake > 0 ? (Math.random() - 0.5) * game.shake * 0.45 * QUALITY.shakeScale : 0;
  ctx.save();
  ctx.translate(shakeX, shakeY);
  drawSky();
  drawDistantHills();
  drawWorld();
  drawLighting();
  drawFog();
  ctx.restore();

  if (game.bossSpawned && !game.bossDefeated) {
    const bossProfile = BOSS_PROFILES[game.activeBossProfile];
    const crimsonBoss = bossProfile && bossProfile.bossId === "todor";
    const tint = game.bossPhase === 2 ? (crimsonBoss ? "42,13,11" : "16,18,40") : (crimsonBoss ? "18,8,8" : "6,9,20");
    ctx.fillStyle = `rgba(${tint},${game.bossPhase === 2 ? .15 : .07})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (game.ambientPulse > 0) {
    ctx.fillStyle = `rgba(92,74,126,${game.ambientPulse * .16})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (game.lightning > 0) {
    ctx.fillStyle = `rgba(185,205,225,${game.lightning})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  const act = currentAct();
  ctx.globalAlpha = act.vignette;
  ctx.drawImage(vignetteCanvas, 0, 0);
  ctx.globalAlpha = 1;
  if (act.corruption > 0) {
    // Late-act blood-magic breathing: a slow crimson pulse at the frame edges.
    ctx.globalAlpha = act.corruption * (.55 + Math.sin(game.time * .8) * .45) * .55;
    ctx.drawImage(dangerVignetteCanvas, 0, 0);
    ctx.globalAlpha = 1;
  }
  if (player.lives === 1 && game.mode === "running") {
    ctx.globalAlpha = .17 + Math.sin(game.time * 2.7) * .08;
    ctx.drawImage(dangerVignetteCanvas, 0, 0);
    ctx.globalAlpha = 1;
  }

  const showLegacyBossBar = game.currentLevel === 0 && game.bossSpawned && !game.bossDefeated && game.mode === "running";
  const showCampaignBossBar = game.currentLevel > 0 && game.bossEncounterState === "active" && game.mode === "running";
  if (showLegacyBossBar || showCampaignBossBar) drawBossBar();
  if (game.flash > 0) {
    ctx.fillStyle = `rgba(235,238,222,${game.flash * 1.6})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (game.mode === "transition") {
    const alpha = clamp(1 - game.transitionTimer / 1.65, 0, 1);
    const targetAct = currentAct(game.transitionTarget);
    ctx.fillStyle = `rgba(3,5,11,${clamp(alpha * 1.4, 0, .94)})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const bars = clamp(alpha * 2.2, 0, 1) * 62;
    ctx.fillStyle = "#020308";
    ctx.fillRect(0, 0, VIEW_W, bars);
    ctx.fillRect(0, VIEW_H - bars, VIEW_W, bars);
    ctx.globalAlpha = clamp(alpha * 1.7, 0, 1);
    ctx.textAlign = "center";
    ctx.fillStyle = "#8a7f6a";
    ctx.font = "700 13px Georgia";
    ctx.fillText(`${targetAct.title} — ${targetAct.name}`, VIEW_W / 2, VIEW_H / 2 - 46);
    ctx.strokeStyle = "rgba(168,62,54,.75)";
    ctx.lineWidth = 1;
    const lineHalf = 30 + alpha * 90;
    ctx.beginPath();
    ctx.moveTo(VIEW_W / 2 - lineHalf, VIEW_H / 2 - 28);
    ctx.lineTo(VIEW_W / 2 + lineHalf, VIEW_H / 2 - 28);
    ctx.stroke();
    ctx.fillStyle = "#dbe1db";
    ctx.font = "700 34px Georgia";
    ctx.fillText(LEVEL_DEFINITIONS[game.transitionTarget].name, VIEW_W / 2, VIEW_H / 2 + 12);
    ctx.fillStyle = "#5f6672";
    ctx.font = "700 11px Georgia";
    ctx.fillText(`LEVEL ${CAMPAIGN_ROMAN_LEVELS[game.transitionTarget]} OF XV`, VIEW_W / 2, VIEW_H / 2 + 42);
    ctx.globalAlpha = 1;
  }
}

function drawCampaignSky() {
  const level = game.currentLevel;
  const colors = CAMPAIGN_SKY_PALETTES[level];
  const gradient = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  gradient.addColorStop(0, colors[0]); gradient.addColorStop(.58, colors[1]); gradient.addColorStop(1, colors[2]);
  ctx.fillStyle = gradient;
  ctx.fillRect(-30, -30, VIEW_W + 60, VIEW_H + 60);

  for (let index = 0; index < 34; index++) {
    const x = seededNoise(index * 5.1 + level * 23) * VIEW_W;
    const y = seededNoise(index * 9.7 + level) * 230;
    ctx.fillStyle = `rgba(218,225,220,${.12 + seededNoise(index * 7.2) * .3})`;
    ctx.fillRect(x, y, 1, 1);
  }

  const moonX = (level === 1 ? 720 : level === 2 ? 180 : level === 3 ? 790 : 700) - game.cameraX * .018;
  const moonY = level === 4 ? 84 : 105;
  const moonRadius = level === 3 ? 43 : 49;
  const glow = ctx.createRadialGradient(moonX, moonY, 8, moonX, moonY, 100);
  glow.addColorStop(0, "rgba(220,229,220,.24)"); glow.addColorStop(1, "rgba(150,180,202,0)");
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(moonX, moonY, 100, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = level === 2 ? "#d6d0bd" : "#d7e0df";
  ctx.beginPath(); ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2); ctx.fill();

  for (let index = 0; index < 5; index++) {
    const cloudX = ((index * 280 - game.cameraX * (.025 + index * .004) + game.time * (level === 3 ? 7 : 3.5)) % 1480) - 260;
    ctx.fillStyle = level === 3 ? "rgba(112,126,147,.12)" : "rgba(114,130,151,.075)";
    ctx.beginPath(); ctx.ellipse(cloudX, 145 + index * 27, 160, 17, 0, 0, Math.PI * 2); ctx.fill();
  }

  if (level === 3) {
    for (let index = 0; index < 4; index++) {
      const birdX = ((index * 340 + game.time * 10 - game.cameraX * .045) % 1300) - 140;
      const birdY = 100 + index * 33;
      ctx.strokeStyle = "rgba(5,7,12,.66)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(birdX - 10, birdY); ctx.quadraticCurveTo(birdX - 4, birdY - 7, birdX, birdY);
      ctx.quadraticCurveTo(birdX + 6, birdY - 7, birdX + 12, birdY); ctx.stroke();
    }
  }
}

function drawCampaignDistance() {
  const level = game.currentLevel;
  if (level === 1) {
    ctx.save(); ctx.translate(-game.cameraX * .1, 0); ctx.fillStyle = "#11192b";
    ctx.beginPath(); ctx.moveTo(-800, 390);
    for (let x = -800; x < WORLD_W + 900; x += 190) ctx.quadraticCurveTo(x + 95, 280 + seededNoise(x * .02) * 70, x + 190, 390);
    ctx.lineTo(WORLD_W + 900, 440); ctx.lineTo(-800, 440); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(-game.cameraX * .22, 0); ctx.fillStyle = "#0b111c";
    for (let x = -200; x < WORLD_W + 500; x += 260) {
      const height = 100 + seededNoise(x) * 90;
      ctx.fillRect(x, 390 - height, 18, height);
      ctx.beginPath(); ctx.moveTo(x - 42, 390); ctx.quadraticCurveTo(x - 20, 310 - height * .3, x, 315 - height * .25); ctx.lineTo(x, 390); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + 18, 390); ctx.quadraticCurveTo(x + 46, 300 - height * .22, x + 75, 335); ctx.lineTo(x + 18, 390); ctx.fill();
    }
    ctx.fillStyle = "#090e18"; ctx.fillRect(4450, 260, 160, 132);
    ctx.beginPath(); ctx.moveTo(4425, 260); ctx.lineTo(4530, 190); ctx.lineTo(4635, 260); ctx.fill(); ctx.restore();
  } else if (level === 2) {
    ctx.save(); ctx.translate(-game.cameraX * .12, 0); ctx.fillStyle = "#171724";
    for (let x = -300; x < WORLD_W + 500; x += 230) {
      const h = 80 + seededNoise(x * .3) * 80;
      ctx.fillRect(x, 365 - h, 130, h + 30);
      ctx.beginPath(); ctx.moveTo(x - 12, 365 - h); ctx.lineTo(x + 65, 315 - h); ctx.lineTo(x + 142, 365 - h); ctx.fill();
      for (let windowX = 18; windowX < 110; windowX += 36) {
        ctx.fillStyle = "rgba(185,124,62,.08)"; ctx.fillRect(x + windowX, 382 - h, 8, 17); ctx.fillStyle = "#171724";
      }
    }
    ctx.restore();
    ctx.save(); ctx.translate(-game.cameraX * .3, 0); ctx.strokeStyle = "rgba(28,23,31,.86)"; ctx.lineWidth = 4;
    for (let x = -100; x < WORLD_W + 300; x += 330) {
      ctx.beginPath(); ctx.moveTo(x, 220); ctx.lineTo(x, 392); ctx.moveTo(x, 220); ctx.lineTo(x + 170, 240); ctx.stroke();
      ctx.fillStyle = x % 2 ? "#3b2933" : "#2b2432"; ctx.beginPath(); ctx.moveTo(x + 15, 225); ctx.lineTo(x + 155, 242); ctx.lineTo(x + 142, 310); ctx.lineTo(x + 28, 295); ctx.fill();
    }
    ctx.restore();
  } else if (level === 3) {
    ctx.save(); ctx.translate(-game.cameraX * .09, 0); ctx.fillStyle = "#131a27";
    for (let x = -400; x < WORLD_W + 600; x += 510) {
      ctx.fillRect(x, 225, 90, 190); ctx.beginPath(); ctx.moveTo(x - 18, 226); ctx.lineTo(x + 44, 162); ctx.lineTo(x + 108, 226); ctx.fill();
      ctx.fillRect(x + 36, 180, 15, 45);
    }
    ctx.restore();
    for (let index = 0; index < 5; index++) {
      const x = ((index * 250 - game.cameraX * .18 + game.time * 3) % 1350) - 180;
      ctx.fillStyle = "rgba(170,190,204,.08)"; ctx.beginPath(); ctx.ellipse(x, 405 + index * 15, 220, 32, 0, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    ctx.save(); ctx.translate(-game.cameraX * .09, 0); ctx.fillStyle = "#0b111d";
    for (let x = -300; x < WORLD_W + 500; x += 150) {
      const h = 100 + seededNoise(x * .1) * 180;
      ctx.fillRect(x, 400 - h, 120, h);
      for (let wx = 15; wx < 105; wx += 28) for (let wy = 420 - h; wy < 380; wy += 32) {
        if (seededNoise(wx + wy + x) > .78) { ctx.fillStyle = "rgba(89,111,133,.16)"; ctx.fillRect(x + wx, wy, 7, 13); ctx.fillStyle = "#0b111d"; }
      }
    }
    ctx.restore();
    ctx.save(); ctx.translate(-game.cameraX * .25, 0); ctx.strokeStyle = "#101621"; ctx.lineWidth = 5;
    for (let x = -100; x < WORLD_W + 300; x += 420) {
      ctx.beginPath(); ctx.moveTo(x, 215); ctx.lineTo(x, 420); ctx.moveTo(x, 230); ctx.quadraticCurveTo(x + 210, 275, x + 420, 220); ctx.stroke();
    }
    ctx.restore();
  }
}

function currentCampaignVisualStyle() {
  return CAMPAIGN_VISUAL_STYLES[currentLevelDefinition().theme] || null;
}

function drawCampaignWorld() {
  const level = game.currentLevel;
  const visualStyle = currentCampaignVisualStyle();
  const visibleMin = game.cameraX - 180;
  const visibleMax = game.cameraX + VIEW_W + 180;
  ctx.save(); ctx.translate(-game.cameraX, 0);

  if (level === 3) drawViaductGround(visibleMin, visibleMax);
  else {
    const ground = ctx.createLinearGradient(0, GROUND_Y, 0, VIEW_H);
    if (level === 1) { ground.addColorStop(0, "#142b31"); ground.addColorStop(1, "#071217"); }
    if (level === 2) { ground.addColorStop(0, "#352e2c"); ground.addColorStop(1, "#120f12"); }
    if (level === 4) { ground.addColorStop(0, "#242932"); ground.addColorStop(1, "#090c13"); }
    if (visualStyle) { ground.addColorStop(0, visualStyle.ground[0]); ground.addColorStop(1, visualStyle.ground[1]); }
    ctx.fillStyle = ground; ctx.fillRect(-100, GROUND_Y, WORLD_W + 200, VIEW_H - GROUND_Y + 40);
    ctx.fillStyle = visualStyle ? visualStyle.edge : level === 1 ? "#516b69" : level === 2 ? "#655547" : "#555d66";
    ctx.fillRect(-100, GROUND_Y - 3, WORLD_W + 200, 4);
  }

  if (level === 1) drawMarshProps(visibleMin, visibleMax);
  if (level === 2) drawMarketProps(visibleMin, visibleMax);
  if (level === 3) drawViaductProps(visibleMin, visibleMax);
  if (level === 4) drawBoulevardProps(visibleMin, visibleMax);
  if (level >= 5) drawLateCampaignProps(visibleMin, visibleMax);
  if (level === 4 && (game.survivalState === "active" || game.survivalState === "cleanup")) drawSurvivalBoundaries();
  if (game.bossEncounterState !== "idle") drawCampaignBossArena();

  for (const obstacle of getSolidObstacles()) if (obstacle.x + obstacle.w > visibleMin && obstacle.x < visibleMax) drawGrave(obstacle);
  for (const crate of levelCrates) if (!crate.broken && crate.x > visibleMin && crate.x < visibleMax) drawMarketCrate(crate);
  drawCheckpoint();
  drawLevelExit();
  drawBossFloorWarnings();
  if (bossVehicle) drawBossVehicle(bossVehicle);
  for (const drop of drops) if (drop.x >= visibleMin && drop.x <= visibleMax) drawDrop(drop);
  drawSoulCoins(visibleMin, visibleMax);
  for (const enemy of enemies) if (enemy.x + enemy.w >= visibleMin && enemy.x <= visibleMax) drawEnemy(enemy);
  drawFallingStones();
  drawProjectiles();
  drawPlayer();
  drawParticles();
  drawScorePopups();
  drawCampaignForeground(visibleMin, visibleMax);
  ctx.restore();
}

function drawViaductGround(visibleMin, visibleMax) {
  const gaps = currentLevelDefinition().gaps;
  let cursor = -100;
  ctx.fillStyle = "#303842";
  ctx.strokeStyle = "#737b7e";
  ctx.lineWidth = 3;
  for (let gapIndex = 0; gapIndex <= gaps.length; gapIndex++) {
    const gap = gapIndex < gaps.length ? gaps[gapIndex] : null;
    const gapX = gap ? gap.x : WORLD_W + 100;
    const width = gapX - cursor;
    if (cursor + width > visibleMin && cursor < visibleMax) {
      ctx.fillRect(cursor, GROUND_Y, width, VIEW_H - GROUND_Y + 50);
      ctx.fillStyle = "#687175"; ctx.fillRect(cursor, GROUND_Y - 5, width, 6); ctx.fillStyle = "#303842";
      for (let x = Math.max(cursor + 70, Math.floor(visibleMin / 190) * 190); x < Math.min(gapX, visibleMax); x += 190) {
        ctx.beginPath(); ctx.moveTo(x - 55, VIEW_H + 10); ctx.quadraticCurveTo(x, 445, x + 55, VIEW_H + 10); ctx.stroke();
      }
    }
    if (gap) cursor = gap.x + gap.w;
  }
  for (const gap of gaps) {
    if (gap.x > visibleMax || gap.x + gap.w < visibleMin) continue;
    ctx.fillStyle = "#171d26";
    ctx.beginPath(); ctx.moveTo(gap.x, GROUND_Y - 5); ctx.lineTo(gap.x + 18, GROUND_Y + 20); ctx.lineTo(gap.x + 4, GROUND_Y + 48); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(gap.x + gap.w, GROUND_Y - 5); ctx.lineTo(gap.x + gap.w - 17, GROUND_Y + 24); ctx.lineTo(gap.x + gap.w - 3, GROUND_Y + 54); ctx.closePath(); ctx.fill();
  }
}

function drawMarshProps(visibleMin, visibleMax) {
  ctx.fillStyle = "rgba(11,29,42,.72)";
  for (let x = Math.max(0, Math.floor(visibleMin / 360) * 360); x < visibleMax; x += 360) {
    ctx.fillRect(x + 70, GROUND_Y + 22, 210, 72);
    ctx.strokeStyle = "rgba(75,118,131,.2)"; ctx.beginPath(); ctx.ellipse(x + 175, GROUND_Y + 34, 88, 8 + Math.sin(game.time + x) * 2, 0, 0, Math.PI * 2); ctx.stroke();
  }
  for (let x = Math.max(0, Math.floor(visibleMin / 230) * 230); x < visibleMax; x += 230) {
    ctx.strokeStyle = "#1a2826"; ctx.lineWidth = 3;
    for (let reed = 0; reed < 5; reed++) {
      const rx = x + reed * 8; const wind = Math.sin(game.time * 1.7 + rx) * 4;
      ctx.beginPath(); ctx.moveTo(rx, GROUND_Y); ctx.quadraticCurveTo(rx + wind * .3, GROUND_Y - 25, rx + wind, GROUND_Y - 52 - reed * 3); ctx.stroke();
    }
  }
  const marshLight = game.activeBossProfile === "todorMarsh" && game.bossPhase === 2 ? "amber" : "blue";
  for (let x = 440; x < WORLD_W; x += 720) if (x > visibleMin && x < visibleMax) drawLanternPost(x, marshLight);
}

function drawMarketProps(visibleMin, visibleMax) {
  for (let x = 260; x < WORLD_W; x += 520) {
    if (x < visibleMin - 150 || x > visibleMax + 150) continue;
    ctx.fillStyle = "#241b1a"; ctx.fillRect(x, GROUND_Y - 118, 170, 118);
    ctx.fillStyle = x % 1040 ? "#4b2930" : "#343147";
    ctx.beginPath(); ctx.moveTo(x - 12, GROUND_Y - 118); ctx.lineTo(x + 180, GROUND_Y - 118); ctx.lineTo(x + 154, GROUND_Y - 82); ctx.lineTo(x + 12, GROUND_Y - 88); ctx.fill();
    ctx.strokeStyle = "#6e5844"; ctx.lineWidth = 5; ctx.strokeRect(x + 12, GROUND_Y - 72, 145, 65);
    ctx.strokeStyle = "#2c2524"; ctx.lineWidth = 2;
    for (let charm = 0; charm < 4; charm++) { ctx.beginPath(); ctx.moveTo(x + 36 + charm * 28, GROUND_Y - 117); ctx.lineTo(x + 36 + charm * 28, GROUND_Y - 92); ctx.stroke(); ctx.strokeRect(x + 31 + charm * 28, GROUND_Y - 91, 10, 5); }
    drawLanternPost(x + 145, game.activeBossProfile === "velkoMarket" && game.bossPhase === 2 ? "pale" : "amber");
  }
}

function drawViaductProps(visibleMin, visibleMax) {
  ctx.strokeStyle = "#4a4f51"; ctx.lineWidth = 5;
  for (let x = Math.max(0, Math.floor(visibleMin / 240) * 240); x < visibleMax; x += 240) {
    if (!hasGroundAt(x)) continue;
    ctx.beginPath(); ctx.moveTo(x, GROUND_Y); ctx.lineTo(x, GROUND_Y - 62); ctx.moveTo(x, GROUND_Y - 56); ctx.lineTo(x + 110, GROUND_Y - 42); ctx.stroke();
    ctx.strokeStyle = "#252b2e"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, GROUND_Y - 45); ctx.lineTo(x + 110, GROUND_Y - 31); ctx.stroke(); ctx.strokeStyle = "#4a4f51"; ctx.lineWidth = 5;
  }
  for (let x = 580; x < WORLD_W; x += 980) if (x > visibleMin && x < visibleMax && hasGroundAt(x)) drawLanternPost(x, "pale");
}

function drawBoulevardProps(visibleMin, visibleMax) {
  ctx.fillStyle = "rgba(88,104,118,.16)";
  for (let x = Math.max(0, Math.floor(visibleMin / 210) * 210); x < visibleMax; x += 210) ctx.fillRect(x + 18, GROUND_Y + 14, 112, 4);
  for (let x = 480; x < WORLD_W; x += 620) {
    if (x < visibleMin - 120 || x > visibleMax + 120) continue;
    ctx.fillStyle = "#141922"; ctx.fillRect(x - 60, GROUND_Y - 48, 205, 46);
    ctx.fillStyle = "#202733"; ctx.beginPath(); ctx.moveTo(x - 10, GROUND_Y - 48); ctx.lineTo(x + 35, GROUND_Y - 78); ctx.lineTo(x + 100, GROUND_Y - 75); ctx.lineTo(x + 130, GROUND_Y - 48); ctx.fill();
    ctx.fillStyle = "rgba(91,119,137,.23)"; ctx.fillRect(x + 40, GROUND_Y - 68, 51, 16);
  }
  for (let x = 360; x < WORLD_W; x += 520) if (x > visibleMin && x < visibleMax) drawLanternPost(x, "street");
  for (let x = Math.max(0, Math.floor(visibleMin / 250) * 250); x < visibleMax; x += 250) {
    ctx.fillStyle = "rgba(105,130,147,.09)"; ctx.beginPath(); ctx.ellipse(x + 80, GROUND_Y + 20, 72, 8, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function drawLateCampaignProps(visibleMin, visibleMax) {
  const theme = currentLevelDefinition().theme;
  const style = currentCampaignVisualStyle();
  if (!style) return;
  ctx.save();
  if (theme === "railYard") {
    ctx.strokeStyle = "#5f5149"; ctx.lineWidth = 4;
    for (let rail = 0; rail < 3; rail++) { ctx.beginPath(); ctx.moveTo(visibleMin, GROUND_Y + 12 + rail * 23); ctx.lineTo(visibleMax, GROUND_Y + 12 + rail * 23); ctx.stroke(); }
    for (let x = Math.floor(visibleMin / 520) * 520; x < visibleMax; x += 520) {
      ctx.fillStyle = "#17191d"; ctx.strokeStyle = "#554942"; ctx.lineWidth = 2; ctx.fillRect(x + 90, GROUND_Y - 112, 260, 105); ctx.strokeRect(x + 90, GROUND_Y - 112, 260, 105);
      ctx.fillStyle = "#2b2b2f"; for (let door = 0; door < 3; door++) ctx.fillRect(x + 112 + door * 72, GROUND_Y - 92, 54, 65);
      drawLanternPost(x + 390, "amber");
    }
  } else if (theme === "cathedral") {
    for (let x = Math.floor(visibleMin / 420) * 420; x < visibleMax; x += 420) {
      ctx.fillStyle = "#151a27"; ctx.strokeStyle = "#45566b"; ctx.lineWidth = 3; ctx.fillRect(x + 60, GROUND_Y - 218, 55, 218); ctx.strokeRect(x + 60, GROUND_Y - 218, 55, 218);
      ctx.beginPath(); ctx.arc(x + 88, GROUND_Y - 218, 28, Math.PI, 0); ctx.stroke();
      ctx.strokeStyle = "rgba(101,157,195,.32)"; ctx.beginPath(); ctx.moveTo(x + 88, GROUND_Y - 190); ctx.lineTo(x + 88, GROUND_Y - 105); ctx.stroke();
    }
  } else if (theme === "floodway") {
    ctx.fillStyle = "rgba(14,42,49,.68)";
    for (let x = Math.floor(visibleMin / 360) * 360; x < visibleMax; x += 360) {
      ctx.fillRect(x + 38, GROUND_Y + 18, 250, 70); ctx.strokeStyle = "rgba(201,169,91,.28)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x + 160, GROUND_Y + 30, 105, 8, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "#635439"; ctx.beginPath(); ctx.arc(x + 325, GROUND_Y - 70, 45, 0, Math.PI * 2); ctx.stroke();
    }
  } else if (theme === "observatory") {
    for (let x = Math.floor(visibleMin / 500) * 500; x < visibleMax; x += 500) {
      ctx.strokeStyle = "#596179"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x + 180, GROUND_Y - 112, 78, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "rgba(166,199,218,.3)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 102, GROUND_Y - 112); ctx.lineTo(x + 258, GROUND_Y - 112); ctx.moveTo(x + 180, GROUND_Y - 190); ctx.lineTo(x + 180, GROUND_Y - 34); ctx.stroke();
      for (let star = 0; star < 5; star++) { ctx.fillStyle = "rgba(189,216,225,.5)"; ctx.fillRect(x + 120 + star * 31, GROUND_Y - 155 + seededNoise(x + star) * 85, 2, 2); }
    }
  } else if (theme === "neon") {
    for (let x = Math.floor(visibleMin / 430) * 430; x < visibleMax; x += 430) {
      ctx.fillStyle = "#11131b"; ctx.fillRect(x + 40, GROUND_Y - 150, 260, 150); ctx.strokeStyle = "#343141"; ctx.strokeRect(x + 40, GROUND_Y - 150, 260, 150);
      ctx.fillStyle = x % 860 ? "rgba(194,91,178,.22)" : "rgba(214,139,75,.22)"; ctx.fillRect(x + 75, GROUND_Y - 122, 130, 24);
      ctx.fillStyle = "rgba(174,127,185,.1)"; ctx.fillRect(x + 90, GROUND_Y + 16, 170, 4);
    }
  } else if (theme === "foundry") {
    for (let x = Math.floor(visibleMin / 470) * 470; x < visibleMax; x += 470) {
      ctx.fillStyle = "#171719"; ctx.strokeStyle = "#59443b"; ctx.lineWidth = 3; ctx.fillRect(x + 80, GROUND_Y - 136, 190, 136); ctx.strokeRect(x + 80, GROUND_Y - 136, 190, 136);
      ctx.fillStyle = `rgba(218,91,48,${.18 + Math.sin(game.time * 3 + x) * .04})`; ctx.fillRect(x + 115, GROUND_Y - 86, 120, 62);
      ctx.strokeStyle = "#3e3b3a"; ctx.lineWidth = 5; for (let chain = 0; chain < 3; chain++) { ctx.beginPath(); ctx.moveTo(x + 105 + chain * 65, GROUND_Y - 220); ctx.lineTo(x + 105 + chain * 65, GROUND_Y - 140); ctx.stroke(); }
    }
  } else if (theme === "velvet") {
    for (let x = Math.floor(visibleMin / 480) * 480; x < visibleMax; x += 480) {
      ctx.fillStyle = "#211822"; ctx.fillRect(x + 40, GROUND_Y - 170, 300, 170); ctx.fillStyle = "#090a0d"; ctx.fillRect(x + 75, GROUND_Y - 132, 92, 112); ctx.fillRect(x + 215, GROUND_Y - 132, 92, 112);
      ctx.strokeStyle = "rgba(201,157,91,.38)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 190, GROUND_Y - 230); ctx.lineTo(x + 190, GROUND_Y - 178); ctx.arc(x + 190, GROUND_Y - 165, 30, 0, Math.PI); ctx.stroke();
    }
  } else if (theme === "crown") {
    for (let x = Math.floor(visibleMin / 390) * 390; x < visibleMax; x += 390) {
      ctx.fillStyle = "#242b35"; ctx.strokeStyle = "#657586"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 70, GROUND_Y); ctx.lineTo(x + 88, GROUND_Y - 106); ctx.lineTo(x + 120, GROUND_Y - 70); ctx.lineTo(x + 150, GROUND_Y - 132); ctx.lineTo(x + 183, GROUND_Y - 70); ctx.lineTo(x + 216, GROUND_Y - 108); ctx.lineTo(x + 232, GROUND_Y); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  } else if (theme === "citadel") {
    for (let x = Math.floor(visibleMin / 520) * 520; x < visibleMax; x += 520) {
      ctx.fillStyle = "#15171c"; ctx.strokeStyle = "#5d513f"; ctx.lineWidth = 3; ctx.fillRect(x + 50, GROUND_Y - 200, 300, 200); ctx.strokeRect(x + 50, GROUND_Y - 200, 300, 200);
      ctx.fillStyle = "#090b0e"; ctx.fillRect(x + 145, GROUND_Y - 150, 110, 150);
      ctx.strokeStyle = "rgba(200,161,92,.42)"; ctx.beginPath(); ctx.arc(x + 200, GROUND_Y - 78, 38, 0, Math.PI * 2); ctx.stroke();
    }
  } else if (theme === "lastCity") {
    for (let x = Math.floor(visibleMin / 440) * 440; x < visibleMax; x += 440) {
      const h = 100 + seededNoise(x * .2) * 120; ctx.fillStyle = "#111720"; ctx.fillRect(x + 55, GROUND_Y - h, 185, h);
      ctx.strokeStyle = "rgba(105,151,163,.28)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 20, GROUND_Y); ctx.quadraticCurveTo(x + 55, GROUND_Y - 38, x + 42, GROUND_Y - 84); ctx.stroke();
      ctx.fillStyle = "#313b40"; ctx.fillRect(x + 270, GROUND_Y - 78, 44, 78); ctx.beginPath(); ctx.arc(x + 292, GROUND_Y - 78, 22, Math.PI, 0); ctx.fill();
    }
  }
  ctx.strokeStyle = `${style.accent}44`; ctx.lineWidth = 2;
  for (let x = Math.floor(visibleMin / 260) * 260; x < visibleMax; x += 260) { ctx.beginPath(); ctx.moveTo(x + 20, GROUND_Y + 14); ctx.lineTo(x + 150, GROUND_Y + 14); ctx.stroke(); }
  ctx.restore();
}

function drawSurvivalBoundaries() {
  for (const x of [3660, 5050]) {
    ctx.fillStyle = "#171c24"; ctx.strokeStyle = "#525e68"; ctx.lineWidth = 3;
    ctx.fillRect(x - 24, GROUND_Y - 86, 48, 86); ctx.strokeRect(x - 24, GROUND_Y - 86, 48, 86);
    ctx.strokeStyle = "#69747a"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x - 34, GROUND_Y - 74); ctx.lineTo(x + 34, GROUND_Y - 18); ctx.moveTo(x + 34, GROUND_Y - 74); ctx.lineTo(x - 34, GROUND_Y - 18); ctx.stroke();
    ctx.fillStyle = "rgba(125,177,190,.32)"; ctx.fillRect(x - 15, GROUND_Y - 80, 30, 5);
  }
}

function drawLanternPost(x, type) {
  const height = type === "street" ? 142 : 94;
  ctx.strokeStyle = type === "street" ? "#293038" : "#31383a"; ctx.lineWidth = type === "street" ? 7 : 5;
  ctx.beginPath(); ctx.moveTo(x, GROUND_Y); ctx.lineTo(x, GROUND_Y - height); ctx.stroke();
  ctx.fillStyle = "#1b2227"; ctx.strokeStyle = "#586066"; ctx.lineWidth = 2;
  ctx.fillRect(x - 13, GROUND_Y - height - 20, 26, 23); ctx.strokeRect(x - 13, GROUND_Y - height - 20, 26, 23);
  const amber = type === "amber";
  const flicker = type === "street" && Math.sin(game.time * 13 + x) > .75 ? .14 : .75;
  const finalRed = type === "street" && game.activeBossProfile === "velkoFinal" && game.bossPhase === 2 && game.ambientPulse > .25;
  const blackoutThreshold = clamp((x - 360) / Math.max(1, WORLD_W - 720), 0, 1);
  const switchedOff = type === "street" && game.currentLevel === 4 && game.blackoutProgress >= blackoutThreshold;
  ctx.globalAlpha = finalRed ? .82 : switchedOff ? .035 : flicker; ctx.fillStyle = finalRed ? "#b64d4d" : amber ? "#d69b52" : "#9ad8e6";
  ctx.fillRect(x - 6, GROUND_Y - height - 14, 12, 12); ctx.globalAlpha = 1;
}

function drawMarketCrate(crate) {
  const y = GROUND_Y - 42;
  ctx.fillStyle = "#5a3a28"; ctx.strokeStyle = "#9a7047"; ctx.lineWidth = 2;
  ctx.fillRect(crate.x, y, 46, 42); ctx.strokeRect(crate.x, y, 46, 42);
  ctx.beginPath(); ctx.moveTo(crate.x + 4, y + 4); ctx.lineTo(crate.x + 42, y + 38); ctx.moveTo(crate.x + 42, y + 4); ctx.lineTo(crate.x + 4, y + 38); ctx.stroke();
}

function drawCheckpoint() {
  const checkpoint = currentLevelDefinition().checkpoint;
  if (!checkpoint) return;
  const active = game.checkpointId === checkpoint.id;
  const x = checkpoint.x;
  const flame = active ? .9 : .32;
  ctx.save(); ctx.translate(x, GROUND_Y);
  if (game.currentLevel === 0) {
    ctx.fillStyle = "#353f3d"; ctx.strokeStyle = "#71817d"; ctx.lineWidth = 2;
    ctx.fillRect(-21, -92, 42, 92); ctx.strokeRect(-21, -92, 42, 92);
    ctx.fillStyle = `rgba(132,202,207,${flame})`; ctx.beginPath(); ctx.moveTo(-8, -62); ctx.quadraticCurveTo(-12, -79, 0, -88 - Math.sin(game.time * 7) * 3); ctx.quadraticCurveTo(13, -75, 7, -59); ctx.fill();
  } else if (game.currentLevel === 1) {
    ctx.fillStyle = "#41494a"; ctx.strokeStyle = "#7a8581"; ctx.lineWidth = 2;
    ctx.fillRect(-25, -105, 50, 105); ctx.strokeRect(-25, -105, 50, 105);
    ctx.fillStyle = `rgba(111,202,229,${flame})`; ctx.beginPath(); ctx.moveTo(-9, -74); ctx.quadraticCurveTo(-15, -92, 0, -101 - Math.sin(game.time * 8) * 4); ctx.quadraticCurveTo(16, -88, 8, -72); ctx.fill();
  } else if (game.currentLevel === 2) {
    ctx.fillStyle = "#403733"; ctx.beginPath(); ctx.moveTo(-48, 0); ctx.lineTo(-35, -52); ctx.lineTo(35, -52); ctx.lineTo(48, 0); ctx.fill();
    ctx.strokeStyle = "#b49a75"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -60, 27, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = `rgba(224,159,77,${flame})`; ctx.beginPath(); ctx.arc(0, -56, 8 + Math.sin(game.time * 5), 0, Math.PI * 2); ctx.fill();
  } else if (game.currentLevel === 3) {
    ctx.strokeStyle = "#586067"; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -132); ctx.stroke();
    ctx.fillStyle = "#2e363b"; ctx.fillRect(-24, -139, 48, 21);
    ctx.globalAlpha = flame; ctx.fillStyle = "#b9e1e6"; ctx.fillRect(-14, -134, 28, 10); ctx.globalAlpha = 1;
  } else if (game.currentLevel === 4) {
    ctx.strokeStyle = "#293038"; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -142); ctx.stroke();
    ctx.fillStyle = "#1b2227"; ctx.strokeStyle = "#586066"; ctx.lineWidth = 2; ctx.fillRect(-16, -164, 32, 25); ctx.strokeRect(-16, -164, 32, 25);
    ctx.globalAlpha = flame; ctx.fillStyle = "#d5edf0"; ctx.fillRect(-8, -157, 16, 13); ctx.globalAlpha = 1;
  } else {
    const style = currentCampaignVisualStyle();
    const theme = currentLevelDefinition().theme;
    ctx.fillStyle = "#24262c"; ctx.strokeStyle = style ? style.edge : "#68747a"; ctx.lineWidth = 3;
    if (theme === "cathedral" || theme === "crown" || theme === "lastCity") {
      ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(-25, -92); ctx.lineTo(0, -126); ctx.lineTo(25, -92); ctx.lineTo(34, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (theme === "floodway" || theme === "citadel") {
      ctx.fillRect(-42, -78, 84, 78); ctx.strokeRect(-42, -78, 84, 78); ctx.beginPath(); ctx.arc(0, -85, 32, Math.PI, 0); ctx.stroke();
    } else {
      ctx.fillRect(-24, -112, 48, 112); ctx.strokeRect(-24, -112, 48, 112); ctx.fillRect(-38, -18, 76, 18);
    }
    ctx.globalAlpha = flame; ctx.fillStyle = style ? style.accent : "#a9dbe2";
    ctx.beginPath(); ctx.moveTo(-10, -67); ctx.quadraticCurveTo(-15, -91, 0, -104 - Math.sin(game.time * 7) * 4); ctx.quadraticCurveTo(16, -88, 9, -65); ctx.fill(); ctx.globalAlpha = 1;
  }
  if (active) {
    ctx.globalAlpha = .18 + game.checkpointPulse * .34;
    ctx.drawImage(game.currentLevel === 2 ? warmLightSprite : coolLightSprite, -82, -158, 164, 164);
  }
  ctx.restore();
}

function drawLevelExit() {
  const definition = currentLevelDefinition();
  if (!definition.exitX) return;
  const x = definition.exitX + 120;
  const progress = game.exitState === "opening" ? 1 - clamp(game.exitTimer / (game.currentLevel === 4 ? 2.8 : 2.15), 0, 1) : game.exitState === "idle" ? 0 : 1;
  ctx.save(); ctx.translate(x, GROUND_Y);
  if (game.currentLevel === 1) {
    ctx.fillStyle = "#384346"; ctx.strokeStyle = "#77878a"; ctx.lineWidth = 3;
    ctx.fillRect(-55, -168, 110, 168); ctx.strokeRect(-55, -168, 110, 168);
    ctx.fillStyle = `rgba(91,181,217,${.28 + progress * .65})`; ctx.beginPath(); ctx.arc(0, -102, 25 + progress * 8, 0, Math.PI * 2); ctx.fill();
  } else {
    const urban = game.currentLevel === 4;
    ctx.fillStyle = urban ? "#080b10" : "#272b30"; ctx.strokeStyle = urban ? "#39434d" : "#6d6a63"; ctx.lineWidth = 4;
    ctx.fillRect(-80, -175, 160, 175); ctx.strokeRect(-80, -175, 160, 175);
    ctx.strokeStyle = "#15191d"; ctx.lineWidth = 8;
    for (let bar = -55; bar <= 55; bar += 28) { ctx.beginPath(); ctx.moveTo(bar, -165 + progress * 175); ctx.lineTo(bar, -8 + progress * 175); ctx.stroke(); }
    if (game.currentLevel === 3) { ctx.fillStyle = "rgba(181,204,222,.3)"; ctx.fillRect(84, -122, 6, 26); }
    if (urban) { ctx.fillStyle = `rgba(210,225,221,${progress > .25 ? .22 : 0})`; ctx.fillRect(-50, -145, 26, 8); ctx.fillRect(24, -145, 26, 8); }
  }
  ctx.restore();
}

function drawCampaignBossArena() {
  const profile = BOSS_PROFILES[game.activeBossProfile];
  if (!profile) return;
  const left = profile.arenaLeft;
  const right = profile.arenaRight;
  ctx.save();
  if (profile.id === "todorMarsh") {
    ctx.fillStyle = "#252f35"; ctx.strokeStyle = "#667981"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse((left + right) / 2, GROUND_Y + 18, (right - left) * .54, 88, 0, Math.PI, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(74,119,133,.18)"; ctx.fillRect(left, GROUND_Y + 22, right - left, 64);
  } else if (profile.id === "velkoMarket") {
    ctx.fillStyle = "rgba(109,83,57,.18)"; ctx.fillRect(left, GROUND_Y - 6, right - left, 14);
    ctx.fillStyle = "#2b2524"; ctx.fillRect((left + right) / 2 - 65, GROUND_Y - 34, 130, 34);
    ctx.strokeStyle = "#75654f"; ctx.strokeRect((left + right) / 2 - 65, GROUND_Y - 34, 130, 34);
  } else if (profile.id === "todorViaduct") {
    ctx.fillStyle = "rgba(112,123,128,.2)"; ctx.fillRect(left, GROUND_Y - 8, right - left, 10);
    ctx.strokeStyle = "#5f6668"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(left, GROUND_Y - 74); ctx.lineTo(right, GROUND_Y - 74); ctx.stroke();
    ctx.strokeStyle = "rgba(181,161,111,.26)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(left + 45, GROUND_Y + 14); ctx.lineTo(right - 45, GROUND_Y + 14); ctx.moveTo(left + 45, GROUND_Y + 38); ctx.lineTo(right - 45, GROUND_Y + 38); ctx.stroke();
  } else {
    const style = currentCampaignVisualStyle();
    if (profile.bossId === "todor") {
      ctx.fillStyle = style ? `${style.accent}18` : "rgba(181,150,92,.1)"; ctx.fillRect(left, GROUND_Y - 6, right - left, 12);
      ctx.strokeStyle = style ? `${style.accent}55` : "rgba(181,150,92,.34)"; ctx.lineWidth = 2;
      for (let lane = 0; lane < 3; lane++) { const y = GROUND_Y + 12 + lane * 18; ctx.beginPath(); ctx.moveTo(left + 45, y); ctx.lineTo(right - 45, y); ctx.stroke(); }
      for (let marker = left + 90; marker < right - 60; marker += 150) { ctx.fillStyle = style ? `${style.secondary}33` : "rgba(112,124,132,.2)"; ctx.fillRect(marker, GROUND_Y - 4, 70, 4); }
    } else {
      ctx.strokeStyle = style ? `${style.accent}55` : "rgba(92,119,126,.28)"; ctx.lineWidth = 3;
      for (let x = left + 70; x < right; x += 150) {
        ctx.beginPath(); ctx.moveTo(x, GROUND_Y); ctx.quadraticCurveTo(x - 20, GROUND_Y - 28, x - 8, GROUND_Y - 58); ctx.stroke();
      }
      ctx.fillStyle = style ? `${style.secondary}22` : "rgba(91,37,48,.12)"; ctx.fillRect(left, GROUND_Y - 5, right - left, 8);
    }
    if (game.bossEncounterState === "defeated") {
      ctx.strokeStyle = `rgba(89,126,146,${clamp(game.endTimer / 3.8, 0, 1) * .42})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo((left + right) / 2, GROUND_Y); ctx.lineTo((left + right) / 2 - 90, GROUND_Y + 34);
      ctx.moveTo((left + right) / 2, GROUND_Y); ctx.lineTo((left + right) / 2 + 120, GROUND_Y + 28); ctx.stroke();
    }
  }
  for (const x of [left, right]) {
    ctx.fillStyle = profile.bossId === "todor" ? "#22282b" : "#293237";
    ctx.strokeStyle = profile.bossId === "todor" ? "#8b744d" : "#71868a";
    ctx.lineWidth = 3; ctx.fillRect(x - 18, GROUND_Y - 118, 36, 118); ctx.strokeRect(x - 18, GROUND_Y - 118, 36, 118);
    ctx.beginPath(); ctx.moveTo(x - 24, GROUND_Y - 118); ctx.lineTo(x, GROUND_Y - 145); ctx.lineTo(x + 24, GROUND_Y - 118); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function drawBossFloorWarnings() {
  for (const warning of bossFloorWarnings) {
    const progress = warning.impacted ? clamp(warning.life / .32, 0, 1) : clamp(1 - warning.timer / 1.05, 0, 1);
    const money = warning.kind === "moneyRain" || warning.kind === "headlight";
    ctx.fillStyle = money ? `rgba(219,188,116,${.08 + progress * .2})` : `rgba(134,55,67,${.1 + progress * .22})`;
    ctx.strokeStyle = money ? `rgba(239,222,169,${.32 + progress * .5})` : `rgba(178,92,99,${.34 + progress * .48})`;
    ctx.lineWidth = 2 + progress * 2;
    ctx.beginPath(); ctx.ellipse(warning.x, GROUND_Y - 3, warning.w / 2, 8 + progress * 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (!warning.impacted && warning.kind === "headlight" && bossVehicle) {
      ctx.fillStyle = `rgba(223,232,222,${.035 + progress * .07})`;
      ctx.beginPath(); ctx.moveTo(bossVehicle.x + (bossVehicle.direction > 0 ? bossVehicle.w : 0), bossVehicle.y + 34);
      ctx.lineTo(warning.x - warning.w, GROUND_Y); ctx.lineTo(warning.x + warning.w, GROUND_Y); ctx.closePath(); ctx.fill();
    }
  }
}

function drawBossVehicle(vehicle) {
  const vehicleProfile = BOSS_PROFILES[vehicle.profileId];
  ctx.save(); ctx.translate(vehicle.x, vehicle.y);
  if (vehicle.direction < 0) { ctx.translate(vehicle.w, 0); ctx.scale(-1, 1); }
  ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.beginPath(); ctx.ellipse(vehicle.w / 2, vehicle.h + 4, vehicle.w * .5, 11, 0, 0, Math.PI * 2); ctx.fill();
  const body = ctx.createLinearGradient(0, 0, 0, vehicle.h);
  body.addColorStop(0, "#252a31"); body.addColorStop(.46, "#090c11"); body.addColorStop(1, "#171a1f");
  ctx.fillStyle = body; ctx.strokeStyle = "#4b5055"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(9, 28); ctx.lineTo(42, 15); ctx.lineTo(80, 2); ctx.lineTo(170, 3); ctx.lineTo(211, 22); ctx.lineTo(235, 32); ctx.lineTo(229, 59); ctx.lineTo(15, 60); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#07090d"; ctx.strokeStyle = "#333b43";
  ctx.beginPath(); ctx.moveTo(82, 8); ctx.lineTo(124, 8); ctx.lineTo(124, 29); ctx.lineTo(66, 28); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(131, 8); ctx.lineTo(166, 9); ctx.lineTo(197, 28); ctx.lineTo(131, 28); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "#736240"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(42, 35); ctx.lineTo(210, 35); ctx.stroke();
  if (vehicleProfile && vehicleProfile.variant >= 5) {
    ctx.strokeStyle = "#8b7147"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(28, 27); ctx.lineTo(65, 13); ctx.moveTo(205, 23); ctx.lineTo(226, 31); ctx.stroke();
    ctx.fillStyle = "rgba(123,91,47,.2)"; ctx.fillRect(78, 32, 96, 5);
  }
  if (vehicle.damaged) { ctx.strokeStyle = "#67605a"; ctx.beginPath(); ctx.moveTo(145, 39); ctx.lineTo(177, 27); ctx.moveTo(151, 43); ctx.lineTo(184, 34); ctx.stroke(); }
  for (const wheelX of [57, 190]) {
    ctx.fillStyle = "#050608"; ctx.beginPath(); ctx.arc(wheelX, 59, 18, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#3e4348"; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(wheelX, 59, 10, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = clamp(vehicle.headlights, 0, 1);
  const harshLights = (vehicle.profileId === "todorViaduct" || vehicleProfile && vehicleProfile.variant >= 4) && game.bossPhase === 2;
  ctx.fillStyle = harshLights ? "#e6b66d" : "#e4d8aa"; ctx.fillRect(221, 34, 10, 9); ctx.fillRect(221, 48, 8, 6);
  ctx.fillStyle = "rgba(238,225,179,.09)"; ctx.beginPath(); ctx.moveTo(229, 34); ctx.lineTo(340, 14); ctx.lineTo(340, 77); ctx.lineTo(229, 54); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1; ctx.restore();
}

function drawFallingStones() {
  for (const stone of fallingStones) {
    if (stone.state === "warning") {
      const alpha = .25 + Math.sin(game.time * 18) * .08;
      ctx.fillStyle = `rgba(3,5,8,${alpha})`; ctx.beginPath(); ctx.ellipse(stone.x + 17, GROUND_Y - 2, 30, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#7b736b";
      for (let bit = 0; bit < 4; bit++) ctx.fillRect(stone.x + bit * 9, 92 + seededNoise(bit + stone.id) * 28, 3, 3);
    } else {
      ctx.fillStyle = "#615d5a"; ctx.strokeStyle = "#98918a"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(stone.x + 4, stone.y + 4); ctx.lineTo(stone.x + 27, stone.y); ctx.lineTo(stone.x + 34, stone.y + 25); ctx.lineTo(stone.x + 19, stone.y + 38); ctx.lineTo(stone.x, stone.y + 27); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
}

function drawCampaignForeground(visibleMin, visibleMax) {
  const level = game.currentLevel;
  if (level === 4) {
    ctx.strokeStyle = "rgba(98,132,151,.32)"; ctx.lineWidth = 1;
    const rainCount = game.activeBossProfile === "velkoFinal" && game.bossPhase === 2 ? 18 : 34;
    for (let index = 0; index < rainCount; index++) {
      const x = visibleMin + ((seededNoise(index * 5.8) * (VIEW_W + 260) + game.time * (90 + index % 4 * 14)) % (VIEW_W + 260));
      const y = 170 + seededNoise(index * 9.2) * 300;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 15); ctx.stroke();
    }
  }
  drawForegroundVegetation(visibleMin, visibleMax);
}

function drawForegroundVegetation(visibleMin, visibleMax) {
  if (!OUTDOOR_GRASS_LEVELS.has(game.currentLevel)) return;
  const difficulty = getLevelDifficulty();
  const palette = game.currentLevel === 1 ? ["#31584e", "#263f38", "#506052"]
    : game.currentLevel >= 12 ? ["#344649", "#4d5145", "#273b3c"] : ["#344b39", "#4e553d", "#303d35"];
  const start = Math.max(0, Math.floor(visibleMin / 38) * 38);
  for (let clusterX = start; clusterX < visibleMax; clusterX += 38) {
    if (!hasGroundAt(clusterX) || seededNoise(clusterX * .17 + game.currentLevel) < .18) continue;
    const playerDistance = Math.abs(clusterX - (player.x + player.w / 2));
    const footBend = playerDistance < 58 ? (1 - playerDistance / 58) * (player.vx >= 0 ? 7 : -7) : 0;
    for (let blade = 0; blade < 5; blade++) {
      const seed = clusterX * .31 + blade * 19.7 + game.currentLevel * 71;
      const baseX = clusterX + seededNoise(seed) * 30;
      const height = 7 + seededNoise(seed + 3) * 15;
      const wind = Math.sin(game.time * (1.05 + seededNoise(seed + 8) * .35) + seed) * 2.2 * difficulty.wind + footBend;
      ctx.strokeStyle = palette[Math.floor(seededNoise(seed + 11) * palette.length)];
      ctx.lineWidth = .8 + seededNoise(seed + 5) * .7;
      ctx.beginPath(); ctx.moveTo(baseX, GROUND_Y + 1);
      ctx.quadraticCurveTo(baseX + wind * .28, GROUND_Y - height * .52, baseX + wind, GROUND_Y - height);
      ctx.stroke();
    }
  }
}

function drawSky() {
  if (game.currentLevel > 0) {
    drawCampaignSky();
    return;
  }
  const gradient = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  gradient.addColorStop(0, "#080a17");
  gradient.addColorStop(0.54, "#1d2436");
  gradient.addColorStop(1, "#3b3b43");
  ctx.fillStyle = gradient;
  ctx.fillRect(-30, -30, VIEW_W + 60, VIEW_H + 60);

  for (let i = 0; i < 55; i++) {
    const x = seededNoise(i * 3.1) * VIEW_W;
    const y = seededNoise(i * 7.7) * 250;
    const alpha = 0.18 + seededNoise(i * 9.2) * 0.45;
    ctx.fillStyle = `rgba(220,225,211,${alpha})`;
    ctx.fillRect(x, y, seededNoise(i) > 0.82 ? 2 : 1, 1);
  }

  const moonX = 765 - game.cameraX * 0.025;
  const moonGlow = ctx.createRadialGradient(moonX, 105, 15, moonX, 105, 108);
  moonGlow.addColorStop(0, "rgba(239,234,201,.28)");
  moonGlow.addColorStop(1, "rgba(192,202,208,0)");
  ctx.fillStyle = moonGlow;
  ctx.beginPath(); ctx.arc(moonX, 105, 108, 0, Math.PI * 2); ctx.fill();
  const moon = ctx.createRadialGradient(moonX - 16, 86, 7, moonX, 105, 55);
  moon.addColorStop(0, "#fff7d9"); moon.addColorStop(.62, "#cdd2c7"); moon.addColorStop(1, "#777f83");
  ctx.fillStyle = moon;
  ctx.beginPath(); ctx.arc(moonX, 105, 51, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(82,89,91,.18)";
  ctx.beginPath(); ctx.arc(moonX + 15, 91, 10, 0, Math.PI * 2); ctx.arc(moonX - 19, 119, 7, 0, Math.PI * 2); ctx.fill();

  for (let i = 0; i < 4; i++) {
    const cloudX = ((i * 330 - game.cameraX * (0.04 + i * .005) + game.time * 4) % 1400) - 220;
    ctx.fillStyle = "rgba(128,139,155,.07)";
    ctx.beginPath();
    ctx.ellipse(cloudX, 145 + i * 29, 150, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(cloudX + 95, 148 + i * 29, 105, 13, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 3; i++) {
    const ravenX = ((i * 410 + game.time * (7 + i) - game.cameraX * .055) % 1320) - 180;
    const ravenY = 108 + i * 42 + Math.sin(game.time * 1.4 + i) * 8;
    ctx.strokeStyle = "rgba(7,9,14,.56)"; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.quadraticCurveTo(ravenX - 8, ravenY - 5, ravenX, ravenY);
    ctx.quadraticCurveTo(ravenX + 8, ravenY - 5, ravenX + 14, ravenY + 1);
    ctx.stroke();
  }
}

function drawDistantHills() {
  if (currentLevelDefinition().checkpoint) {
    drawCampaignDistance();
    return;
  }
  ctx.save();
  ctx.translate(-game.cameraX * 0.11, 0);
  ctx.fillStyle = "#151c29";
  ctx.beginPath();
  ctx.moveTo(-900, 380);
  for (let x = -900; x <= WORLD_W + 900; x += 220) {
    const top = 285 + seededNoise(x * .02) * 75;
    ctx.quadraticCurveTo(x + 110, top - 55, x + 220, 360);
  }
  ctx.lineTo(WORLD_W + 900, 440); ctx.lineTo(-900, 440); ctx.closePath(); ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(-game.cameraX * 0.24, 0);
  ctx.fillStyle = "#242a32";
  ctx.beginPath(); ctx.moveTo(-700, 400);
  for (let x = -700; x <= WORLD_W + 800; x += 170) {
    ctx.quadraticCurveTo(x + 85, 330 + seededNoise(x) * 50, x + 170, 398);
  }
  ctx.lineTo(WORLD_W + 800, 440); ctx.lineTo(-700, 440); ctx.closePath(); ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(-game.cameraX * .18, 0);
  ctx.fillStyle = "#101722";
  for (let x = -300; x < WORLD_W + 500; x += 780) {
    const offset = seededNoise(x + 18) * 95;
    ctx.fillRect(x + offset, 285, 65, 112);
    ctx.beginPath(); ctx.moveTo(x + offset - 9, 286); ctx.lineTo(x + offset + 31, 252); ctx.lineTo(x + offset + 74, 286); ctx.closePath(); ctx.fill();
    ctx.fillRect(x + offset + 25, 258, 11, 28);
  }
  ctx.restore();
}

function drawWorld() {
  if (game.currentLevel > 0) {
    drawCampaignWorld();
    return;
  }
  ctx.save();
  ctx.translate(-game.cameraX, 0);

  const visibleMin = game.cameraX - 170;
  const visibleMax = game.cameraX + VIEW_W + 170;

  for (const treeX of trees) if (treeX >= visibleMin - 100 && treeX <= visibleMax + 100) drawTree(treeX, GROUND_Y, seededNoise(treeX));

  const groundGradient = ctx.createLinearGradient(0, GROUND_Y - 10, 0, VIEW_H);
  groundGradient.addColorStop(0, "#2a352f");
  groundGradient.addColorStop(.08, "#18251f");
  groundGradient.addColorStop(1, "#080d0c");
  ctx.fillStyle = groundGradient;
  ctx.fillRect(-100, GROUND_Y, WORLD_W + 200, VIEW_H - GROUND_Y + 40);
  ctx.fillStyle = "#61705c";
  ctx.fillRect(-100, GROUND_Y - 3, WORLD_W + 200, 4);

  drawForegroundVegetation(visibleMin, visibleMax);

  for (let x = Math.max(100, Math.floor(visibleMin / 170) * 170); x < visibleMax; x += 170) drawSmallStone(x + seededNoise(x) * 70, GROUND_Y + 17, seededNoise(x + 3));
  for (const grave of graves) if (grave.x + grave.w >= visibleMin && grave.x <= visibleMax) drawGrave(grave);
  if (game.bossSpawned || game.arenaGateProgress > 0) drawArenaGates();
  drawCheckpoint();
  for (const drop of drops) if (drop.x >= visibleMin && drop.x <= visibleMax) drawDrop(drop);
  drawSoulCoins(visibleMin, visibleMax);
  for (const enemy of enemies) if (enemy.x + enemy.w >= visibleMin && enemy.x <= visibleMax) drawEnemy(enemy);
  drawProjectiles();
  drawPlayer();
  drawParticles();
  drawScorePopups();
  drawAmbientMotes();
  drawForegroundDetails(visibleMin, visibleMax);
  ctx.restore();
}

function drawArenaGates() {
  const progress = clamp(game.arenaGateProgress, 0, 1);
  for (const gateX of [ARENA_LEFT, ARENA_RIGHT]) {
    ctx.save();
    ctx.translate(gateX, GROUND_Y);
    ctx.fillStyle = "#20282a"; ctx.strokeStyle = "#657173"; ctx.lineWidth = 2;
    ctx.fillRect(-15, -112, 30, 112); ctx.strokeRect(-15, -112, 30, 112);
    ctx.fillStyle = "#394446";
    ctx.beginPath(); ctx.moveTo(-20, -112); ctx.lineTo(0, -136); ctx.lineTo(20, -112); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#171d20"; ctx.fillRect(-8, -96, 16, 72);
    const gateOffset = (1 - progress) * 105;
    ctx.translate(0, gateOffset);
    ctx.strokeStyle = "#20272b"; ctx.lineWidth = 5; ctx.lineCap = "square";
    for (let bar = -2; bar <= 2; bar++) {
      ctx.beginPath(); ctx.moveTo(bar * 10, -98); ctx.lineTo(bar * 10, -8); ctx.stroke();
      ctx.fillStyle = "#596568"; ctx.beginPath(); ctx.moveTo(bar * 10 - 4, -98); ctx.lineTo(bar * 10, -108); ctx.lineTo(bar * 10 + 4, -98); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = "#586367"; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-27, -72); ctx.lineTo(27, -72); ctx.moveTo(-27, -35); ctx.lineTo(27, -35); ctx.stroke();
    ctx.restore();
  }
}

function drawForegroundDetails(visibleMin, visibleMax) {
  const start = Math.max(0, Math.floor(visibleMin / 38) * 38);
  ctx.lineCap = "round";
  for (let x = start; x < visibleMax; x += 38) {
    const height = 7 + seededNoise(x * 2.3) * 13;
    const wind = Math.sin(game.time * 2.1 + x * .028) * 3;
    ctx.strokeStyle = seededNoise(x) > .48 ? "rgba(52,78,56,.72)" : "rgba(35,59,46,.78)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, GROUND_Y + 13); ctx.quadraticCurveTo(x + wind * .25, GROUND_Y + 7, x + wind, GROUND_Y + 13 - height); ctx.stroke();
  }
}

function drawLighting() {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  if (player.weapon === "torch") {
    const x = player.x - game.cameraX + player.w / 2 + player.facing * 48;
    ctx.globalAlpha = .62 + Math.sin(game.time * 19) * .06;
    ctx.drawImage(warmLightSprite, x - 78, player.y + 21 - 78, 156, 156);
  }
  for (const projectile of projectiles) {
    if (projectile.life <= 0) continue;
    if (projectile.type === "torch") {
      ctx.globalAlpha = projectile.state === "burst" ? .82 : .48;
      ctx.drawImage(warmLightSprite, projectile.x - game.cameraX - 70, projectile.y - 70, 140, 140);
    } else if (projectile.type === "lanternOrb") {
      ctx.globalAlpha = .38;
      ctx.drawImage(coolLightSprite, projectile.x - game.cameraX - 46, projectile.y - 46, 92, 92);
    }
  }
  for (const drop of drops) {
    if (drop.x < game.cameraX - 80 || drop.x > game.cameraX + VIEW_W + 80) continue;
    ctx.globalAlpha = .3;
    const sprite = drop.weapon === "torch" ? warmLightSprite : coolLightSprite;
    ctx.drawImage(sprite, drop.x - game.cameraX - 45, drop.y - 45, 116, 116);
  }
  if (currentLevelDefinition().checkpoint) {
    const checkpoint = currentLevelDefinition().checkpoint;
    if (checkpoint && checkpoint.x > game.cameraX - 100 && checkpoint.x < game.cameraX + VIEW_W + 100) {
      ctx.globalAlpha = game.checkpointId === checkpoint.id ? .46 : .18;
      const sprite = game.currentLevel === 2 ? warmLightSprite : coolLightSprite;
      ctx.drawImage(sprite, checkpoint.x - game.cameraX - 76, GROUND_Y - 152, 152, 152);
    }
  }
  ctx.restore();
}

function drawAmbientMotes() {
  for (let i = 0; i < 13; i++) {
    const drift = game.time * (8 + i * 0.7);
    const x = game.cameraX - 80 + ((seededNoise(i * 18.2) * (VIEW_W + 240) + drift) % (VIEW_W + 240));
    const y = 280 + seededNoise(i * 5.7) * 145 + Math.sin(game.time * 1.7 + i) * 8;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(game.time * 0.7 + i);
    ctx.fillStyle = i % 4 === 0 ? "rgba(117,93,59,.28)" : "rgba(184,198,191,.13)";
    ctx.fillRect(-2, -1, 5, 2);
    ctx.restore();
  }
}

function drawTree(x, ground, seed) {
  ctx.save(); ctx.translate(x, ground);
  ctx.strokeStyle = "#111416"; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.lineWidth = 18;
  ctx.beginPath(); ctx.moveTo(0, 5); ctx.quadraticCurveTo(-12, -82, 5, -168); ctx.stroke();
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(0, -85); ctx.quadraticCurveTo(-38, -118, -58 - seed * 20, -155);
  ctx.moveTo(2, -120); ctx.quadraticCurveTo(48, -144, 55 + seed * 30, -195);
  ctx.moveTo(-4, -145); ctx.quadraticCurveTo(-30, -176, -24, -214);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-51, -149); ctx.lineTo(-93, -166); ctx.moveTo(-55, -152); ctx.lineTo(-65, -191);
  ctx.moveTo(53, -190); ctx.lineTo(91, -210); ctx.moveTo(54, -190); ctx.lineTo(44, -230);
  ctx.moveTo(-23, -209); ctx.lineTo(-55, -236);
  ctx.stroke();
  ctx.restore();
}

function drawSmallStone(x, y, seed) {
  ctx.fillStyle = "#343b3b";
  ctx.beginPath(); ctx.ellipse(x, y, 8 + seed * 8, 5 + seed * 3, -0.2, Math.PI, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(145,153,145,.18)"; ctx.stroke();
}

function drawGrave(grave) {
  ctx.save(); ctx.translate(grave.x, grave.y);
  ctx.fillStyle = "rgba(0,0,0,.36)";
  ctx.beginPath(); ctx.ellipse(grave.w / 2 + 8, grave.h + 5, grave.w * .8, 9, 0, 0, Math.PI * 2); ctx.fill();
  const stone = ctx.createLinearGradient(0, 0, grave.w, grave.h);
  stone.addColorStop(0, "#66706d"); stone.addColorStop(.47, "#3e4746"); stone.addColorStop(1, "#222a2a");
  ctx.fillStyle = stone; ctx.strokeStyle = "#78817b"; ctx.lineWidth = 2;
  ctx.beginPath();
  if (grave.style === 0) {
    ctx.moveTo(5, grave.h); ctx.lineTo(7, 23); ctx.quadraticCurveTo(grave.w / 2, -8, grave.w - 7, 23); ctx.lineTo(grave.w - 4, grave.h);
  } else if (grave.style === 1) {
    ctx.moveTo(3, grave.h); ctx.lineTo(4, 14); ctx.lineTo(grave.w * .36, 14); ctx.lineTo(grave.w * .36, 0); ctx.lineTo(grave.w * .64, 0); ctx.lineTo(grave.w * .64, 14); ctx.lineTo(grave.w - 4, 14); ctx.lineTo(grave.w - 2, grave.h);
  } else {
    ctx.moveTo(4, grave.h); ctx.lineTo(8, 20); ctx.quadraticCurveTo(grave.w / 2, -4, grave.w - 7, 19); ctx.lineTo(grave.w - 3, grave.h);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "rgba(185,194,181,.28)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(grave.w * .38, grave.h * .34); ctx.lineTo(grave.w * .61, grave.h * .34); ctx.moveTo(grave.w / 2, grave.h * .22); ctx.lineTo(grave.w / 2, grave.h * .65); ctx.stroke();
  ctx.strokeStyle = "rgba(25,31,28,.7)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(grave.w * .25, grave.h * .72); ctx.lineTo(grave.w * .45, grave.h * .58); ctx.lineTo(grave.w * .56, grave.h * .72); ctx.stroke();
  ctx.restore();
}

function drawGroundFog() {
  // Two slow-drifting fog bands hugging the ground line, tinted per act.
  const act = currentAct();
  const alpha = act.groundFog * (game.bossSpawned && !game.bossDefeated ? 1.35 : 1);
  ctx.save();
  for (let layer = 0; layer < 2; layer++) {
    const drift = Math.sin(game.time * (.14 + layer * .09) + layer * 2.1) * 26;
    const top = GROUND_Y - 26 + layer * 22 + Math.sin(game.time * .3 + layer) * 4;
    const band = ctx.createLinearGradient(0, top, 0, top + 78);
    band.addColorStop(0, `rgba(${act.fogColor},0)`);
    band.addColorStop(.45, `rgba(${act.fogColor},${alpha * (layer === 0 ? .8 : 1)})`);
    band.addColorStop(1, `rgba(${act.fogColor},0)`);
    ctx.fillStyle = band;
    ctx.fillRect(-40 + drift, top, VIEW_W + 80, 78);
  }
  ctx.restore();
}

function drawFog() {
  drawGroundFog();
  if (game.currentLevel > 0) {
    drawCampaignFog();
    return;
  }
  ctx.save();
  for (let i = 0; i < 7; i++) {
    const speed = 8 + i * 2.3;
    const x = ((i * 230 - game.cameraX * (0.18 + i * .012) + game.time * speed) % 1450) - 240;
    const y = 365 + (i % 3) * 44;
    const fog = ctx.createRadialGradient(x, y, 4, x, y, 185);
    const density = game.bossSpawned && !game.bossDefeated ? (game.bossPhase === 2 ? .12 : .085) : .065;
    fog.addColorStop(0, `rgba(${game.bossPhase === 2 ? "151,156,183" : "174,186,184"},${density})`); fog.addColorStop(1, "rgba(132,147,151,0)");
    ctx.fillStyle = fog; ctx.beginPath(); ctx.ellipse(x, y, 205, 30, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawCampaignFog() {
  ctx.save();
  const level = game.currentLevel;
  const count = level === 4 ? 5 : 7;
  for (let index = 0; index < count; index++) {
    const x = ((index * 235 - game.cameraX * (.13 + index * .01) + game.time * (6 + index)) % 1460) - 240;
    const y = level === 3 ? 440 + index * 13 : 365 + index % 3 * 38;
    const fog = ctx.createRadialGradient(x, y, 4, x, y, 175);
    const color = level === 2 ? "151,130,112" : level === 4 ? "125,142,155" : "132,171,184";
    fog.addColorStop(0, `rgba(${color},${level === 4 ? .045 : .065})`); fog.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = fog; ctx.beginPath(); ctx.ellipse(x, y, 210, level === 3 ? 42 : 29, 0, 0, Math.PI * 2); ctx.fill();
  }
  if ((level === 4 && game.activeBossProfile === "velkoFinal" || currentLevelDefinition().theme === "lastCity" && game.activeBossProfile === "velkoLastCity") && game.bossPhase === 2) {
    const leftFog = ctx.createLinearGradient(0, 0, 190, 0);
    leftFog.addColorStop(0, "rgba(112,139,151,.13)"); leftFog.addColorStop(1, "rgba(112,139,151,0)");
    ctx.fillStyle = leftFog; ctx.fillRect(0, 280, 190, 220);
    const rightFog = ctx.createLinearGradient(VIEW_W, 0, VIEW_W - 190, 0);
    rightFog.addColorStop(0, "rgba(112,139,151,.13)"); rightFog.addColorStop(1, "rgba(112,139,151,0)");
    ctx.fillStyle = rightFog; ctx.fillRect(VIEW_W - 190, 280, 190, 220);
  }
  if (level === 1 && game.activeBossProfile === "todorMarsh" && game.bossPhase === 2) {
    const edgeFog = ctx.createLinearGradient(0, 0, VIEW_W, 0);
    edgeFog.addColorStop(0, "rgba(44,70,74,.16)"); edgeFog.addColorStop(.2, "rgba(44,70,74,0)");
    edgeFog.addColorStop(.8, "rgba(44,70,74,0)"); edgeFog.addColorStop(1, "rgba(44,70,74,.16)");
    ctx.fillStyle = edgeFog; ctx.fillRect(0, 280, VIEW_W, 220);
  }
  ctx.restore();
}

// -----------------------------------------------------------------------------
// Drawing: characters, weapons, enemies
// -----------------------------------------------------------------------------

function drawPlayer() {
  const state = player.animationState;
  const moving = Math.abs(player.vx) > 10;
  const breath = state === "idleBreathing" || state === "victoryIdle" ? Math.sin(game.time * 2.6) * 1.2 : 0;
  const landingSquash = state === "landing" ? Math.sin(clamp(player.animationTime / .16, 0, 1) * Math.PI) * 3.5 : 0;
  const bob = player.grounded && moving ? Math.sin(player.walkCycle * 2) * 2.7 : breath + landingSquash;
  const legSwing = player.grounded && moving ? Math.sin(player.walkCycle) * 8 : player.grounded ? 0 : 8;
  const capeLift = player.grounded ? 0 : clamp(player.vy * .025, -12, 8);
  const hurtTilt = state === "death" ? -player.facing * .72 : player.hurtTimer > 0 ? -player.facing * 0.2 : 0;
  const blink = player.invulnerable > 0 && Math.floor(player.invulnerable * 14) % 2 === 0;
  if (blink) ctx.globalAlpha = .45;

  ctx.save();
  ctx.translate(player.x + player.w / 2, player.y + player.h + bob);
  ctx.scale(player.facing, 1);
  ctx.translate(player.throwRecoil * 35, 0);
  const startLean = state === "startMoving" ? clamp(player.vx / 205, -1, 1) * .08 : 0;
  ctx.rotate(hurtTilt + player.turnLean + player.throwRecoil + clamp(player.vx / 205, -1, 1) * 0.035 + startLean);
  if (state === "landing") ctx.scale(1 + landingSquash * .012, 1 - landingSquash * .014);
  if (state === "jumpTakeoff") ctx.scale(1.025, .975);
  if (state === "rising") ctx.scale(.985, 1.018);

  ctx.fillStyle = "rgba(0,0,0,.38)";
  ctx.beginPath(); ctx.ellipse(0, 3, 25, 6, 0, 0, Math.PI * 2); ctx.fill();

  // Short split cape gives the knight a distinct silhouette without hiding the armor.
  const capeWave = Math.sin(game.time * 9 + player.walkCycle) * 3 - clamp(player.vy * .018, -7, 7);
  const cape = ctx.createLinearGradient(-34, -58, -5, -24);
  cape.addColorStop(0, "#4e151e"); cape.addColorStop(.55, "#9f2f32"); cape.addColorStop(1, "#35131a");
  ctx.fillStyle = cape; ctx.strokeStyle = "#251016"; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-8, -57); ctx.quadraticCurveTo(-26, -55 + capeLift, -34 - Math.abs(player.vx) * .035, -39 + capeLift + capeWave);
  ctx.lineTo(-27, -31 + capeLift * .45); ctx.lineTo(-18, -35 + capeWave); ctx.lineTo(-9, -25); ctx.closePath();
  ctx.fill(); ctx.stroke();

  // Boots and animated legs
  ctx.strokeStyle = player.armorBroken ? "#493c39" : "#737d82";
  ctx.lineWidth = 9; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-8, -23); ctx.lineTo(-9 - legSwing * .42, -3); ctx.moveTo(8, -23); ctx.lineTo(9 + legSwing * .42, -3); ctx.stroke();
  ctx.strokeStyle = "#171b1d"; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(-10 - legSwing * .42, -3); ctx.lineTo(-16 - legSwing * .4, 0); ctx.moveTo(10 + legSwing * .42, -3); ctx.lineTo(16 + legSwing * .4, 0); ctx.stroke();

  // Scarf knot remains readable over the moving cape.
  ctx.fillStyle = "#c43d39"; ctx.strokeStyle = "#43151b"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(-10, -57, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // Torso and layered armor
  ctx.fillStyle = player.armorBroken ? "#4b3030" : "#737e84";
  ctx.strokeStyle = player.armorBroken ? "#8e4b43" : "#d5d9d6";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-17, -53); ctx.lineTo(15, -55); ctx.lineTo(19, -24); ctx.quadraticCurveTo(0, -14, -19, -25); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (!player.armorBroken) {
    const gleam = ctx.createLinearGradient(-15, 0, 18, 0);
    gleam.addColorStop(0, "#465159"); gleam.addColorStop(.48, "#dde1dd"); gleam.addColorStop(.7, "#8c979b"); gleam.addColorStop(1, "#37434a");
    ctx.fillStyle = gleam; ctx.beginPath(); ctx.moveTo(-15, -49); ctx.lineTo(13, -51); ctx.lineTo(15, -29); ctx.quadraticCurveTo(0, -21, -16, -29); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.45)"; ctx.beginPath(); ctx.moveTo(-10, -43); ctx.lineTo(10, -45); ctx.moveTo(-12, -35); ctx.lineTo(12, -37); ctx.stroke();
  } else {
    ctx.fillStyle = "#24272b";
    ctx.beginPath(); ctx.moveTo(4, -50); ctx.lineTo(15, -48); ctx.lineTo(12, -31); ctx.lineTo(2, -35); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#b0a8a0"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-9, -49); ctx.lineTo(-3, -41); ctx.lineTo(-8, -34); ctx.moveTo(3, -35); ctx.lineTo(8, -27); ctx.stroke();
  }

  // Layered pauldrons and waist plates make the compact armor read clearly.
  ctx.fillStyle = player.armorBroken ? "#4e5558" : "#aeb7b8"; ctx.strokeStyle = "#283238"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(-18, -50, 11, 8, -.25, Math.PI, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (!player.armorBroken) { ctx.beginPath(); ctx.ellipse(16, -51, 8, 6, .25, Math.PI, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = "#20272c"; ctx.fillRect(-16, -27, 31, 5);
  ctx.strokeStyle = "#9ca6a6"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-12, -22); ctx.lineTo(-8, -15); ctx.moveTo(-2, -22); ctx.lineTo(0, -14); ctx.moveTo(8, -22); ctx.lineTo(11, -16); ctx.stroke();

  // The belt lantern is the knight's cool visual signature and remains readable after armor break.
  ctx.fillStyle = "#17272c"; ctx.strokeStyle = "#78979b"; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(5, -27); ctx.lineTo(12, -26); ctx.lineTo(13, -17); ctx.lineTo(8, -14); ctx.lineTo(4, -18); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "rgba(133,231,236,.72)"; ctx.beginPath(); ctx.arc(8.5, -21, 2.3, 0, Math.PI * 2); ctx.fill();

  // Helmet and eye slit
  const helmet = ctx.createLinearGradient(-15, -70, 16, -42);
  helmet.addColorStop(0, player.armorBroken ? "#625353" : "#b9c1c1");
  helmet.addColorStop(.5, player.armorBroken ? "#40373a" : "#59666e");
  helmet.addColorStop(1, "#c6cbc7");
  ctx.fillStyle = helmet; ctx.strokeStyle = "#202a30"; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-16, -54); ctx.lineTo(-14, -68); ctx.lineTo(-8, -75); ctx.lineTo(7, -76); ctx.lineTo(14, -68); ctx.lineTo(17, -53); ctx.lineTo(9, -49); ctx.lineTo(-9, -50); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "rgba(245,248,239,.62)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-9, -70); ctx.lineTo(5, -73); ctx.moveTo(-11, -55); ctx.lineTo(-12, -66); ctx.stroke();
  ctx.fillStyle = "#0b1015"; ctx.fillRect(-11, -64, 24, 6);
  ctx.shadowColor = "#e83e35"; ctx.shadowBlur = 9; ctx.fillStyle = "#e9523f"; ctx.fillRect(-8, -62, 18, 2); ctx.shadowBlur = 0;
  // Three uneven metal teeth form an original broken crest.
  ctx.fillStyle = "#798589"; ctx.strokeStyle = "#222c31"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-7, -74); ctx.lineTo(-5, -84); ctx.lineTo(-1, -75); ctx.lineTo(2, -88); ctx.lineTo(6, -75); ctx.lineTo(10, -82); ctx.lineTo(9, -73); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (player.armorBroken) {
    ctx.strokeStyle = "#241c1d"; ctx.beginPath(); ctx.moveTo(7, -72); ctx.lineTo(2, -66); ctx.lineTo(8, -58); ctx.stroke();
  }

  // Shield
  ctx.save(); ctx.translate(-17, -40); ctx.rotate(-.08);
  const shield = ctx.createLinearGradient(-12, 0, 12, 0);
  shield.addColorStop(0, "#293b45"); shield.addColorStop(.5, "#7f949c"); shield.addColorStop(1, "#27323a");
  ctx.fillStyle = shield; ctx.strokeStyle = "#c9d0ce"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(12, -7); ctx.lineTo(9, 11); ctx.lineTo(0, 19); ctx.lineTo(-9, 11); ctx.lineTo(-12, -7); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Crescent-tomb sigil: an original moon over a narrow grave marker.
  ctx.strokeStyle = "#a63a3c"; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.arc(-1, -4, 6, -.9, 1.35); ctx.stroke();
  ctx.fillStyle = "#a63a3c"; ctx.fillRect(-1.5, 2, 3, 10); ctx.fillRect(-5, 5, 10, 2);
  ctx.restore();

  drawWeaponSwipe();
  drawHeldWeapon();
  ctx.restore();
  ctx.globalAlpha = 1;
}

const SWIPE_ARCS = Object.freeze({
  1: { cx: 5, cy: -42, r: 47, from: -.85, to: .58 },
  2: { cx: 8, cy: -39, r: 44, from: -2.7, to: -.98 },
  3: { cx: 3, cy: -45, r: 52, from: -.42, to: 1.12 }
});

function drawWeaponSwipe() {
  if (player.attackTimer <= 0) return;
  const progress = attackProgress();
  const weapon = WEAPONS[player.attackWeapon];
  if (weapon.kind !== "melee") return;
  const rusty = player.attackWeapon === "rusty";
  const arc = SWIPE_ARCS[player.comboStep || 1] || SWIPE_ARCS[1];
  const radius = rusty ? arc.r - 8 : arc.r;
  const head = arc.from + (arc.to - arc.from) * clamp(progress * 1.5, 0, 1);
  const fade = clamp(1.15 - progress * 1.25, 0, 1);
  ctx.save();
  ctx.lineCap = "round";
  // Faint cursed under-glow beneath the steel arc.
  ctx.globalAlpha = fade * .22;
  ctx.strokeStyle = rusty ? "rgba(150,96,52,.8)" : "rgba(186,66,58,.8)";
  ctx.lineWidth = 12;
  ctx.beginPath(); ctx.arc(arc.cx, arc.cy, radius, arc.from, head); ctx.stroke();
  // Tapered steel trail: thin ghost tail sweeping into a bright wide head.
  const steps = 8;
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    ctx.globalAlpha = fade * (.05 + t1 * t1 * .55);
    ctx.strokeStyle = rusty ? "#c08a5e" : i >= steps - 2 ? "#f6f8ef" : "#ccd6cf";
    ctx.lineWidth = 1.5 + t1 * (rusty ? 5 : 8);
    ctx.beginPath();
    ctx.arc(arc.cx, arc.cy, radius, arc.from + (head - arc.from) * t0, arc.from + (head - arc.from) * t1);
    ctx.stroke();
  }
  // Hot leading edge.
  ctx.globalAlpha = fade * .85;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(arc.cx, arc.cy, radius, Math.max(arc.from, head - .16), head); ctx.stroke();
  ctx.restore();
}

function attackProgress() {
  const weapon = WEAPONS[player.attackWeapon];
  return player.attackTimer > 0 ? 1 - player.attackTimer / weapon.cooldown : 0;
}

function drawHeldWeapon() {
  const progress = attackProgress();
  const attacking = player.attackTimer > 0;
  const heldWeapon = attacking && !player.attackReleased ? player.attackWeapon : player.weapon;
  let thrust = attacking ? Math.sin(Math.min(1, progress) * Math.PI) : 0;
  if (heldWeapon === "spear") {
    ctx.save(); ctx.translate(10 + thrust * 48, -43); ctx.rotate(attacking ? -.28 + progress * .18 : -.45);
    ctx.strokeStyle = "#7b573a"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(71, 0); ctx.stroke();
    ctx.fillStyle = "#d8ded8"; ctx.strokeStyle = "#768083"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(83, 0); ctx.lineTo(67, -6); ctx.lineTo(67, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  } else if (heldWeapon === "dagger") {
    const comboAngle = player.comboStep === 2 ? -1.25 : player.comboStep === 3 ? .3 : -.15;
    ctx.save(); ctx.translate(13 + thrust * 31, -44); ctx.rotate(attacking ? comboAngle : -.6);
    ctx.fillStyle = "#b7aea1"; ctx.strokeStyle = "#5c4b45";
    ctx.beginPath(); ctx.moveTo(42, -2); ctx.quadraticCurveTo(28, -10, 10, -5); ctx.lineTo(11, 5); ctx.quadraticCurveTo(29, 6, 42, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#b58a4d"; ctx.fillRect(4, -8, 7, 16); ctx.fillStyle = "#604335"; ctx.fillRect(-7, -4, 12, 8);
    ctx.restore();
  } else if (heldWeapon === "torch") {
    ctx.save(); ctx.translate(13 + thrust * 35, -45); ctx.rotate(attacking ? -.15 : -.6);
    ctx.strokeStyle = "#24292b"; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(39, 0); ctx.stroke();
    ctx.strokeStyle = "#9b8463"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(3, -4); ctx.lineTo(33, 4); ctx.moveTo(30, -7); ctx.lineTo(43, 5); ctx.moveTo(31, 7); ctx.lineTo(43, -5); ctx.stroke();
    drawFlame(44, -3, attacking ? 1.35 : 1);
    ctx.restore();
  } else {
    ctx.save(); ctx.translate(12 + thrust * 24, -43); ctx.rotate(attacking ? -.12 : -.72);
    const rust = ctx.createLinearGradient(7, -5, 38, 5);
    rust.addColorStop(0, "#5b382b"); rust.addColorStop(.55, "#b46c43"); rust.addColorStop(1, "#513028");
    ctx.fillStyle = rust; ctx.strokeStyle = "#281b1a"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(37, 0); ctx.lineTo(9, -4); ctx.lineTo(12, 1); ctx.lineTo(8, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#d08b55"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(16, -2); ctx.lineTo(29, 0); ctx.stroke();
    ctx.fillStyle = "#493027"; ctx.fillRect(-5, -4, 15, 8);
    ctx.fillStyle = "#826044"; ctx.fillRect(7, -7, 4, 14);
    ctx.restore();
  }
}

function drawProjectiles() {
  for (const projectile of projectiles) {
    if (projectile.x < game.cameraX - 110 || projectile.x > game.cameraX + VIEW_W + 110) continue;
    ctx.save();
    ctx.translate(projectile.x, projectile.y);
    if (projectile.type === "spear") {
      ctx.rotate(projectile.angle);
      ctx.strokeStyle = "rgba(213,222,219,.18)"; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(-55, 0); ctx.lineTo(-37, 0); ctx.stroke();
      ctx.strokeStyle = "#765238"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-38, 0); ctx.lineTo(30, 0); ctx.stroke();
      const metal = ctx.createLinearGradient(28, -7, 49, 7);
      metal.addColorStop(0, "#f1f0e4"); metal.addColorStop(.45, "#818d91"); metal.addColorStop(1, "#d9ded8");
      ctx.fillStyle = metal; ctx.strokeStyle = "#30383c"; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(49, 0); ctx.lineTo(29, -7); ctx.lineTo(33, 0); ctx.lineTo(29, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (projectile.type === "pizza") {
      ctx.rotate(projectile.angle);
      drawPizzaDisc(0, 0, 1);
    } else if (projectile.type === "lanternOrb") {
      ctx.rotate(projectile.angle);
      ctx.fillStyle = "rgba(74,133,172,.28)"; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#8cd6e8"; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(181,231,237,.65)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 11, .4, 4.8); ctx.stroke();
    } else if (projectile.type === "zombieBolt") {
      ctx.rotate(projectile.angle);
      ctx.fillStyle = `${projectile.color || "#8abccc"}44`; ctx.beginPath(); ctx.ellipse(-7, 0, 18, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = projectile.color || "#8abccc"; ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(-7, -5); ctx.lineTo(-11, 0); ctx.lineTo(-7, 5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "rgba(224,237,232,.65)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(8, 0); ctx.stroke();
    } else if (projectile.type === "moneyBundle") {
      ctx.rotate(projectile.angle);
      drawMoneyBundle(0, 0, 1);
    } else if (projectile.type === "bossShockwave") {
      ctx.scale(projectile.direction, 1);
      ctx.fillStyle = "rgba(91,126,139,.24)"; ctx.beginPath(); ctx.moveTo(-24, 8); ctx.lineTo(-7, -12); ctx.lineTo(4, 1); ctx.lineTo(18, -15); ctx.lineTo(25, 8); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = game.bossPhase === 2 ? "#9b4650" : "#7aa0aa"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-24, 7); ctx.lineTo(24, 7); ctx.stroke();
    } else if (projectile.state === "flying") {
      ctx.rotate(projectile.angle);
      ctx.strokeStyle = "#62452f"; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(15, 0); ctx.stroke();
      ctx.strokeStyle = "#c59c60"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(8, -6); ctx.lineTo(17, 5); ctx.moveTo(9, 6); ctx.lineTo(17, -5); ctx.stroke();
      drawFlame(18, -2, 1.15);
    } else {
      ctx.globalAlpha = clamp(projectile.life / 0.16, 0, 1);
      const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 52);
      glow.addColorStop(0, "rgba(255,222,102,.75)"); glow.addColorStop(.35, "rgba(238,91,37,.3)"); glow.addColorStop(1, "rgba(238,91,37,0)");
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 52, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

function drawFlame(x, y, scale) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  const flicker = Math.sin(game.time * 21) * 3;
  ctx.fillStyle = "rgba(245,102,34,.18)"; ctx.beginPath(); ctx.arc(0, -3, 16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#d94c25";
  ctx.beginPath(); ctx.moveTo(-9, 5); ctx.quadraticCurveTo(-13, -7, -2, -18 - flicker); ctx.quadraticCurveTo(1, -8, 8, -14 + flicker); ctx.quadraticCurveTo(14, 0, 5, 8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#ffd05b"; ctx.beginPath(); ctx.moveTo(-4, 5); ctx.quadraticCurveTo(-4, -5, 2, -10); ctx.quadraticCurveTo(8, 1, 3, 7); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawPizzaDisc(x, y, scale) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.fillStyle = "#4c2b20"; ctx.strokeStyle = "#241714"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#c77a3c"; ctx.beginPath(); ctx.arc(0, 0, 9.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "rgba(77,42,28,.55)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(8, -6); ctx.moveTo(0, 0); ctx.lineTo(-7, -7); ctx.moveTo(0, 0); ctx.lineTo(-1, 9); ctx.stroke();
  ctx.fillStyle = "#8e302b";
  ctx.beginPath(); ctx.arc(-4, -3, 2.1, 0, Math.PI * 2); ctx.arc(4, 4, 1.8, 0, Math.PI * 2); ctx.arc(5, -5, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#d6a25a"; ctx.beginPath(); ctx.arc(-2, 5, 1.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawMoneyBundle(x, y, scale) {
  ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.fillStyle = "#c8c1a3"; ctx.strokeStyle = "#4b493f"; ctx.lineWidth = 1.5;
  ctx.fillRect(-13, -8, 26, 16); ctx.strokeRect(-13, -8, 26, 16);
  ctx.fillStyle = "#3a342d"; ctx.fillRect(-3, -9, 6, 18);
  ctx.strokeStyle = "rgba(78,74,62,.55)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-10, -4); ctx.lineTo(-5, -4); ctx.moveTo(6, 4); ctx.lineTo(11, 4); ctx.stroke();
  ctx.restore();
}

function drawEnemy(enemy) {
  ctx.save();
  let emergeOffset = 0;
  if (enemy.state === "emerging") {
    const progress = clamp(1 - enemy.stateTimer / enemy.emergeDuration, 0, 1);
    ctx.save();
    ctx.translate(enemy.x + enemy.w / 2, GROUND_Y);
    ctx.fillStyle = "#29271f";
    ctx.beginPath(); ctx.ellipse(0, Math.sin(game.time * 20) * 1.5, 27 + progress * 9, 6 + progress * 2, 0, 0, Math.PI * 2); ctx.fill();
    if (progress > 0.08 && progress < 0.58) {
      const handRise = Math.sin(clamp((progress - 0.08) / 0.32, 0, 1) * Math.PI * 0.5) * 27;
      ctx.strokeStyle = enemy.type === "bone" ? "#c9c4ad" : "#5c705e";
      ctx.lineWidth = 6; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(-15, 3); ctx.lineTo(-19, 3 - handRise); ctx.moveTo(14, 3); ctx.lineTo(20, 5 - handRise * 0.86); ctx.stroke();
    }
    ctx.restore();
    emergeOffset = enemy.h * (1 - clamp((progress - 0.24) / 0.55, 0, 1));
  }
  ctx.translate(enemy.x + enemy.w / 2, enemy.y + enemy.h + emergeOffset);
  const directedType = enemy.type === "boss" || enemy.type === "campaignBoss" || enemy.type === "shieldUndead" || enemy.type === "boulevardGhoul" || enemy.type === "lanternWraith" || enemy.type === "graveGunner";
  const direction = directedType ? enemy.facing : Math.sign(player.x - enemy.x) || 1;
  if (ENEMY_TELEGRAPH_STATES.has(enemy.state) && !enemy.dead) {
    // Unified ground warning under any enemy winding up a dangerous attack.
    const pulse = .55 + Math.sin(game.time * 14) * .25;
    ctx.strokeStyle = `rgba(206,84,66,${pulse * .6})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 1, enemy.w * .78, 7, 0, 0, Math.PI * 2); ctx.stroke();
  }
  if (enemy.elite && !enemy.dead && enemy.state !== "emerging") {
    const elitePulse = .8 + Math.sin(game.time * 3.4 + enemy.id) * .2;
    ctx.globalAlpha = .42 * elitePulse;
    ctx.drawImage(crimsonLightSprite, -enemy.w * .95, -enemy.h - 18, enemy.w * 1.9, enemy.h + 26);
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(226,116,96,${.55 + elitePulse * .35})`;
    ctx.save();
    ctx.translate(0, -enemy.h - 13 + Math.sin(game.time * 2.6 + enemy.id) * 2.5);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
    if (enemy.health < enemy.maxHealth) {
      const barWidth = 34;
      ctx.fillStyle = "rgba(6,8,12,.8)";
      ctx.fillRect(-barWidth / 2 - 1, -enemy.h - 27, barWidth + 2, 5);
      ctx.fillStyle = "#b2453c";
      ctx.fillRect(-barWidth / 2, -enemy.h - 26, barWidth * clamp(enemy.health / enemy.maxHealth, 0, 1), 3);
    }
  }
  ctx.scale(direction, 1);
  if (enemy.elite) ctx.scale(1.1, 1.1);
  if (enemy.dead) {
    ctx.globalAlpha = clamp(enemy.stateTimer * 1.8, 0, 1);
    ctx.rotate(direction * (1 - clamp(enemy.stateTimer * 2, 0, 1)) * 1.15);
  }
  if (enemy.hurtTimer > 0) ctx.translate(Math.sin(enemy.hurtTimer * 80) * 3, 0);
  if (enemy.flashTimer > 0) ctx.filter = "brightness(3.5) saturate(0)";
  if (enemy.type === "dead") drawGroundDead(enemy);
  else if (enemy.type === "bone") drawBoneGuard(enemy);
  else if (enemy.type === "pizzaZombie") drawPizzaZombie(enemy);
  else if (enemy.type === "lanternWraith") drawLanternWraith(enemy);
  else if (enemy.type === "graveGunner") drawGraveGunner(enemy);
  else if (enemy.type === "shieldUndead") drawShieldUndead(enemy);
  else if (enemy.type === "boulevardGhoul") drawBoulevardGhoul(enemy);
  else if (enemy.type === "campaignBoss") drawCampaignBoss(enemy);
  else drawGraveWarden(enemy);
  ctx.filter = "none";
  if (enemy.flashTimer > 0 && !enemy.dead) {
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = Math.min(.85, enemy.flashTimer * 7.5);
    ctx.fillStyle = "#efe9d4";
    ctx.beginPath();
    ctx.ellipse(0, -enemy.h * .5, enemy.w * .62, enemy.h * .58, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }
  if (enemy.dead) {
    ctx.fillStyle = enemy.type === "bone" ? "#d8d2b9" : "#76917b";
    for (let i = 0; i < 8; i++) {
      const dissolveDuration = enemy.type === "campaignBoss" ? 2.7 : enemy.type === "boss" ? 1.35 : .55;
      const dissolve = 1 - clamp(enemy.stateTimer / dissolveDuration, 0, 1);
      const px = (seededNoise(enemy.id * 30 + i) - 0.5) * enemy.w;
      const py = -seededNoise(enemy.id * 50 + i) * enemy.h - dissolve * 20;
      ctx.globalAlpha = 1 - dissolve;
      ctx.fillRect(px, py, 2 + (i % 3), 2 + (i % 2));
    }
  }
  ctx.restore();
}

function drawCampaignBoss(enemy) {
  const profile = BOSS_PROFILES[enemy.profileId];
  if (!profile || enemy.hiddenInVehicle) return;
  if (game.mode === "campaignBossIntro" && profile.bossId === "todor" && bossVehicle && bossVehicle.mode === "intro") return;
  if (game.mode === "campaignBossIntro" && profile.bossId === "velko") ctx.translate(0, (1 - enemy.introAlpha) * 82);
  if (enemy.state === "teleportOut" || enemy.state === "teleportIn") {
    const style = bossTeleportStyle(enemy);
    const leaving = enemy.state === "teleportOut";
    const progress = clamp(1 - enemy.attackTimer / (leaving ? style.outSeconds : style.inSeconds), 0, 1);
    // Ground rune telegraphing the boss's position, brightest just before arrival.
    const runePulse = .4 + Math.sin(game.time * 16) * .2 + (leaving ? 0 : progress * .3);
    ctx.strokeStyle = `rgba(${style.color},${runePulse})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(0, 1, enemy.w * .8, 9, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 1, enemy.w * (.45 + progress * .3), 5, 0, 0, Math.PI * 2); ctx.stroke();
    // Spectral silhouette: fades away on exit, condenses before arrival.
    ctx.globalAlpha *= leaving ? Math.max(0, 1 - progress * 1.3) : .18 + progress * .4;
  }
  if (!enemy.dead && game.bossEncounterState === "active") {
    const desperate = bossIsLowHealth(enemy);
    const auraPulse = .82 + Math.sin(game.time * (desperate ? 8.5 : enemy.phase === 2 ? 5.6 : 2.3)) * .18;
    ctx.globalAlpha = (desperate ? .62 : enemy.phase === 2 ? .5 : .28) * auraPulse;
    ctx.drawImage(enemy.phase === 2 ? crimsonLightSprite : coolLightSprite, -enemy.w * .95, -enemy.h - 24, enemy.w * 1.9, enemy.h + 34);
    ctx.globalAlpha = 1;
  }
  if (profile.bossId === "todor") {
    drawTodor(enemy, profile);
    return;
  }
  if (enemy.state === "slamWindup") {
    const telegraph = clamp(1 - enemy.attackTimer / 1.08, 0, 1);
    ctx.strokeStyle = `rgba(${profile.id === "velkoFinal" || profile.id === "velkoLastCity" ? "157,50,62" : "111,164,177"},${.22 + telegraph * .5})`;
    ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 1, 48 + telegraph * 38, 8, 0, 0, Math.PI * 2); ctx.stroke();
  }
  if (enemy.state === "chargeWindup") {
    ctx.fillStyle = `rgba(156,54,61,${.16 + Math.sin(game.time * 16) * .05})`;
    ctx.beginPath(); ctx.ellipse(49, -68, 43, 19, 0, 0, Math.PI * 2); ctx.fill();
  }
  const originalState = enemy.state;
  if (originalState === "slamWindup") enemy.state = "slam";
  else if (originalState === "chargeWindup" || originalState === "chargeActive") enemy.state = "charge";
  else if (originalState === "summonWindup" || originalState === "markedAttack") enemy.state = "summon";
  drawGraveWarden(enemy);
  enemy.state = originalState;
  if (profile.variant === 2) {
    ctx.strokeStyle = "#d0c3a0"; ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(side * 35, -96); ctx.lineTo(side * 46, -68); ctx.stroke();
      ctx.fillStyle = "#b9aa86"; ctx.beginPath(); ctx.arc(side * 46, -64, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "#81745d"; ctx.fillRect(-28, -45, 9, 12); ctx.fillRect(19, -45, 9, 12);
  } else if (profile.variant >= 3) {
    ctx.strokeStyle = enemy.phase === 2 ? "rgba(163,52,59,.7)" : "rgba(113,168,183,.55)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-42, -90); ctx.lineTo(-48, -48); ctx.moveTo(39, -89); ctx.lineTo(45, -50); ctx.stroke();
    ctx.fillStyle = "rgba(23,20,23,.55)";
    for (let index = 0; index < Math.min(8, profile.variant + 2); index++) ctx.fillRect(-38 + index * 11, -103 + seededNoise(index + game.time) * 8, 4, 3);
    ctx.strokeStyle = `rgba(130,188,204,${.16 + profile.variant * .035})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-31, -87); ctx.lineTo(-10, -74); ctx.lineTo(-25, -57); ctx.moveTo(30, -88); ctx.lineTo(12, -72); ctx.lineTo(26, -54); ctx.stroke();
  }
}

function drawTodor(enemy, profile) {
  const moving = Math.abs(enemy.vx) > 8;
  const step = moving ? Math.sin(enemy.anim * 1.2) * 4 : 0;
  const bundleWindup = enemy.state === "bundleWindup" || enemy.state === "bundleSecond";
  const driveWarning = enemy.state === "driveWarning";
  const coatWear = profile.variant > 1;
  ctx.rotate(enemy.turnLean + (driveWarning ? -.08 : 0));
  ctx.fillStyle = "rgba(0,0,0,.52)"; ctx.beginPath(); ctx.ellipse(0, 3, 34, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#171a1e"; ctx.lineWidth = 10; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-9, -31); ctx.lineTo(-11 - step, -2); ctx.moveTo(9, -31); ctx.lineTo(12 + step, -2); ctx.stroke();
  ctx.strokeStyle = "#77664a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-15 - step, -2); ctx.lineTo(-5 - step, -2); ctx.moveTo(8 + step, -2); ctx.lineTo(18 + step, -2); ctx.stroke();
  const coat = ctx.createLinearGradient(-28, -88, 30, -20);
  coat.addColorStop(0, "#090b0f"); coat.addColorStop(.48, "#303039"); coat.addColorStop(1, "#111319");
  ctx.fillStyle = coat; ctx.strokeStyle = "#4b4c52"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-24, -78); ctx.lineTo(22, -79); ctx.lineTo(31, -19); ctx.lineTo(8, -25); ctx.lineTo(0, -8); ctx.lineTo(-9, -25); ctx.lineTo(-31, -17); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#5f4c2d"; ctx.beginPath(); ctx.moveTo(-13, -70); ctx.lineTo(13, -70); ctx.lineTo(17, -35); ctx.lineTo(-17, -35); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#15171b"; ctx.fillRect(-9, -69, 18, 35);
  ctx.strokeStyle = "#9a7b43"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -68); ctx.lineTo(0, -36); ctx.moveTo(-12, -54); ctx.lineTo(12, -54); ctx.stroke();
  if (profile.variant >= 4) {
    ctx.strokeStyle = `rgba(212,164,83,${.35 + profile.variant * .045})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-16, -70); ctx.lineTo(-22, -43); ctx.moveTo(16, -70); ctx.lineTo(22, -43); ctx.stroke();
  }
  if (coatWear) { ctx.strokeStyle = "#615a52"; ctx.beginPath(); ctx.moveTo(-25, -42); ctx.lineTo(-8, -49); ctx.moveTo(18, -69); ctx.lineTo(29, -57); ctx.stroke(); }
  ctx.fillStyle = "#b3a68f"; ctx.strokeStyle = "#3d3935"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, -84, 14, 16, -.04, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#101116"; ctx.beginPath(); ctx.moveTo(-14, -88); ctx.quadraticCurveTo(0, -105, 14, -88); ctx.lineTo(10, -78); ctx.lineTo(-11, -78); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = profile.variant > 1 ? "#dc8b43" : "#b7653f"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-8, -85); ctx.lineTo(-3, -85); ctx.moveTo(4, -85); ctx.lineTo(9, -85); ctx.stroke();
  const handY = bundleWindup ? -103 : -49;
  ctx.strokeStyle = "#202229"; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(19, -69); ctx.lineTo(31, handY); ctx.moveTo(-20, -68); ctx.lineTo(-31, -43); ctx.stroke();
  if (bundleWindup) drawMoneyBundle(34, handY - 4, .9);
  if (driveWarning) {
    ctx.strokeStyle = `rgba(221,188,112,${.35 + Math.sin(game.time * 18) * .12})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(30, -8); ctx.lineTo(85, -8); ctx.stroke();
  }
}

function drawLanternWraith(enemy) {
  const charge = enemy.state === "orbWindup" ? 1 - enemy.attackTimer / .64 : 0;
  ctx.globalAlpha *= enemy.state === "emerging" ? clamp(1 - enemy.stateTimer / enemy.emergeDuration, 0, 1) : 1;
  ctx.fillStyle = "rgba(3,8,18,.75)";
  ctx.beginPath(); ctx.moveTo(-18, -50); ctx.quadraticCurveTo(-29, -24, -20, 0); ctx.lineTo(-7, -11); ctx.lineTo(0, 2); ctx.lineTo(8, -12); ctx.lineTo(21, -2); ctx.quadraticCurveTo(28, -29, 16, -51); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#151d31"; ctx.strokeStyle = "#43576d"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-17, -48); ctx.quadraticCurveTo(0, -68, 18, -48); ctx.lineTo(12, -29); ctx.lineTo(-12, -29); ctx.closePath(); ctx.fill(); ctx.stroke();
  const coreSize = 7 + charge * 6;
  ctx.fillStyle = `rgba(118,203,231,${.7 + charge * .25})`; ctx.beginPath(); ctx.arc(0, -29, coreSize, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#657684"; ctx.strokeRect(-10, -41, 20, 24);
  if (charge > 0) { ctx.strokeStyle = `rgba(139,220,238,${charge})`; ctx.beginPath(); ctx.arc(0, -29, 15 + charge * 10, 0, Math.PI * 2); ctx.stroke(); }
}

function drawGraveGunner(enemy) {
  const aiming = enemy.state === "gunnerAim";
  const aimProgress = aiming ? clamp(1 - enemy.attackTimer / .66, 0, 1) : 0;
  const step = Math.sin(enemy.anim) * 3;
  ctx.strokeStyle = "#4b514e"; ctx.lineWidth = 8; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-8, -26); ctx.lineTo(-11 - step, -2); ctx.moveTo(8, -26); ctx.lineTo(11 + step, -2); ctx.stroke();
  ctx.fillStyle = "#28302f"; ctx.strokeStyle = "#68736d"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-19, -61); ctx.lineTo(17, -62); ctx.lineTo(22, -27); ctx.lineTo(-21, -27); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#777669"; ctx.beginPath(); ctx.moveTo(-13, -73); ctx.quadraticCurveTo(0, -82, 14, -72); ctx.lineTo(11, -57); ctx.lineTo(-10, -57); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#171b1b"; ctx.fillRect(-9, -68, 19, 5);
  ctx.fillStyle = aiming ? "#d86a68" : "#82bdc7"; ctx.fillRect(3, -67, 4, 2);
  ctx.save(); ctx.translate(aiming ? 10 : 4, aiming ? -51 : -43); ctx.rotate(aiming ? -.06 : .34);
  ctx.strokeStyle = "#5f6968"; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-21, 0); ctx.lineTo(18, 0); ctx.stroke();
  ctx.fillStyle = "#3a302d"; ctx.strokeStyle = "#90765f"; ctx.lineWidth = 2;
  ctx.fillRect(-5, -9, 31, 18); ctx.strokeRect(-5, -9, 31, 18);
  ctx.strokeStyle = "#a29b86"; ctx.beginPath(); ctx.moveTo(6, -9); ctx.lineTo(6, 9); ctx.moveTo(17, -8); ctx.lineTo(25, 0); ctx.lineTo(17, 8); ctx.stroke();
  ctx.fillStyle = `rgba(${game.currentLevel >= 13 ? "202,75,83" : "105,183,205"},${.32 + aimProgress * .65})`;
  ctx.beginPath(); ctx.arc(27, 0, 5 + aimProgress * 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (aiming) {
    ctx.strokeStyle = `rgba(${game.currentLevel >= 13 ? "208,80,88" : "118,202,220"},${.18 + aimProgress * .4})`;
    ctx.lineWidth = 1.5; ctx.setLineDash([7, 7]); ctx.beginPath(); ctx.moveTo(34, -51); ctx.lineTo(190, -51); ctx.stroke(); ctx.setLineDash([]);
  }
}

function drawShieldUndead(enemy) {
  const step = Math.sin(enemy.anim) * 4;
  const striking = enemy.state === "shieldStrike";
  const weak = enemy.state === "recover" || enemy.state === "turning";
  ctx.strokeStyle = "#565a55"; ctx.lineWidth = 8; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-8, -25); ctx.lineTo(-11 - step, -2); ctx.moveTo(8, -25); ctx.lineTo(11 + step, -2); ctx.stroke();
  ctx.fillStyle = "#30353a"; ctx.strokeStyle = "#747b7a"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-18, -58); ctx.lineTo(17, -58); ctx.lineTo(21, -26); ctx.lineTo(-20, -26); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#666b67"; ctx.beginPath(); ctx.moveTo(-15, -70); ctx.lineTo(13, -70); ctx.lineTo(16, -52); ctx.lineTo(-14, -52); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#161a1c"; ctx.fillRect(-10, -65, 20, 5);
  ctx.fillStyle = "#b5d8d6"; ctx.fillRect(-6, -64, 3, 2); ctx.fillRect(4, -64, 3, 2);
  const shieldX = weak ? -27 : striking ? 35 : 25;
  const shieldY = weak ? -31 : -44;
  ctx.save(); ctx.translate(shieldX, shieldY); if (weak) ctx.rotate(-.7);
  ctx.fillStyle = "#49382c"; ctx.strokeStyle = "#8b8170"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-17, -25); ctx.lineTo(18, -20); ctx.lineTo(15, 22); ctx.lineTo(0, 31); ctx.lineTo(-18, 20); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "#6d716d"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-13, -11); ctx.lineTo(14, 9); ctx.moveTo(13, -12); ctx.lineTo(-12, 14); ctx.stroke(); ctx.restore();
  ctx.strokeStyle = "#8b8c82"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-15, -48); ctx.lineTo(striking ? 34 : -28, striking ? -39 : -28); ctx.stroke();
}

function drawBoulevardGhoul(enemy) {
  const windup = enemy.state === "dashWindup";
  const dash = enemy.state === "dashing";
  const crouch = windup ? 11 : dash ? 7 : 0;
  ctx.rotate(dash ? .18 : windup ? -.14 : 0);
  ctx.strokeStyle = "#3f4549"; ctx.lineWidth = 7; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-8, -20 + crouch); ctx.lineTo(-13 - Math.sin(enemy.anim) * 7, -1); ctx.moveTo(8, -20 + crouch); ctx.lineTo(15 + Math.sin(enemy.anim) * 7, -1); ctx.stroke();
  ctx.fillStyle = "#252632"; ctx.beginPath(); ctx.moveTo(-16, -50 + crouch); ctx.lineTo(14, -53 + crouch); ctx.lineTo(22, -18 + crouch); ctx.lineTo(-20, -18 + crouch); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#515b59"; ctx.beginPath(); ctx.ellipse(1, -56 + crouch, 12, 14, .18, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#0d1215"; ctx.beginPath(); ctx.moveTo(-8, -58 + crouch); ctx.lineTo(-2, -60 + crouch); ctx.lineTo(-2, -56 + crouch); ctx.closePath(); ctx.moveTo(4, -60 + crouch); ctx.lineTo(10, -58 + crouch); ctx.lineTo(4, -56 + crouch); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#d5614f"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-7, -58 + crouch); ctx.lineTo(-2, -58 + crouch); ctx.moveTo(5, -58 + crouch); ctx.lineTo(9, -58 + crouch); ctx.stroke();
  ctx.strokeStyle = "#444b4c"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-13, -43 + crouch); ctx.lineTo(windup ? -31 : -24, -27 + crouch); ctx.moveTo(13, -44 + crouch); ctx.lineTo(windup ? 30 : 26, -24 + crouch); ctx.stroke();
  if (windup) { ctx.strokeStyle = `rgba(207,80,62,${.35 + Math.sin(game.time * 20) * .12})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(22, -8); ctx.lineTo(78, -8); ctx.stroke(); }
}

function drawGroundDead(enemy) {
  const step = Math.sin(enemy.anim) * 5;
  ctx.strokeStyle = "#3b4b42"; ctx.lineWidth = 8; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-8, -22); ctx.lineTo(-10 - step, -2); ctx.moveTo(8, -22); ctx.lineTo(10 + step, -2); ctx.stroke();
  ctx.fillStyle = "#4a3d42"; ctx.beginPath(); ctx.moveTo(-17, -50); ctx.lineTo(15, -49); ctx.lineTo(19, -20); ctx.lineTo(-18, -20); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#27362e"; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(-13, -43); ctx.lineTo(-29, -35 + step); ctx.moveTo(13, -43); ctx.lineTo(27, -31 - step); ctx.stroke();
  ctx.fillStyle = "#667565"; ctx.strokeStyle = "#2b3530"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, -57, 14, 15, -.1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#171d1a"; ctx.beginPath(); ctx.arc(-5, -58, 3, 0, Math.PI * 2); ctx.arc(6, -59, 3, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = "#7dff84"; ctx.shadowBlur = 8; ctx.fillStyle = "#a6ff88"; ctx.fillRect(-6, -59, 2, 2); ctx.fillRect(5, -60, 2, 2); ctx.shadowBlur = 0;
  ctx.strokeStyle = "#28322b"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-6, -51); ctx.lineTo(7, -52); ctx.stroke();
  if (enemy.state === "emerging") {
    ctx.fillStyle = "#332f27"; ctx.beginPath(); ctx.ellipse(0, 0, 30, 8, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function drawPizzaZombie(enemy) {
  const step = enemy.state === "pizzaWindup" ? 0 : Math.sin(enemy.anim) * 4;
  const windup = enemy.state === "pizzaWindup" ? clamp(1 - enemy.attackTimer / .52, 0, 1) : 0;
  ctx.strokeStyle = "#394a41"; ctx.lineWidth = 8; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-8, -23); ctx.lineTo(-10 - step, -2); ctx.moveTo(8, -23); ctx.lineTo(10 + step, -2); ctx.stroke();
  ctx.fillStyle = "#394049"; ctx.strokeStyle = "#222a2c"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-18, -52); ctx.lineTo(17, -53); ctx.lineTo(20, -23); ctx.lineTo(-19, -23); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#51272a";
  ctx.beginPath(); ctx.moveTo(-14, -48); ctx.lineTo(13, -48); ctx.lineTo(16, -24); ctx.lineTo(-15, -24); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#7b5639"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-11, -44); ctx.lineTo(11, -29); ctx.moveTo(11, -44); ctx.lineTo(-10, -29); ctx.stroke();
  ctx.fillStyle = "#617266"; ctx.strokeStyle = "#28342e";
  ctx.beginPath(); ctx.ellipse(0, -59, 14, 15, -.08, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#151b18"; ctx.beginPath(); ctx.arc(-5, -60, 3, 0, Math.PI * 2); ctx.arc(6, -61, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#d59a54"; ctx.fillRect(-6, -61, 2, 2); ctx.fillRect(5, -62, 2, 2);

  const pizzaX = 19 - windup * 5;
  const pizzaY = -43 - windup * 29;
  ctx.strokeStyle = "#405048"; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(12, -45); ctx.lineTo(pizzaX - 3, pizzaY + 5); ctx.stroke();
  if (enemy.state === "pizzaWindup") drawPizzaDisc(pizzaX, pizzaY, .78);
  else {
    ctx.fillStyle = "#4b2c22"; ctx.beginPath(); ctx.arc(17, -40, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = "#334139"; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(-13, -45); ctx.lineTo(-25, -32 + step); ctx.stroke();
}

function drawBoneGuard(enemy) {
  const step = Math.sin(enemy.anim) * 7;
  ctx.strokeStyle = "#d1ccb4"; ctx.lineWidth = 6; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-8, -26); ctx.lineTo(-10 - step, -2); ctx.moveTo(8, -26); ctx.lineTo(10 + step, -2); ctx.stroke();
  ctx.fillStyle = "#354750"; ctx.strokeStyle = "#87949a"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-18, -56); ctx.lineTo(16, -56); ctx.lineTo(20, -28); ctx.lineTo(-19, -28); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "#d2ceb7"; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-16, -49); ctx.lineTo(-29, -31); ctx.moveTo(16, -49); ctx.lineTo(29, -28); ctx.stroke();
  ctx.fillStyle = "#d8d3bb"; ctx.strokeStyle = "#5c625d";
  ctx.beginPath(); ctx.moveTo(-13, -69); ctx.quadraticCurveTo(0, -81, 14, -68); ctx.lineTo(11, -53); ctx.lineTo(-10, -53); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#22272a"; ctx.beginPath(); ctx.arc(-5, -66, 4, 0, Math.PI * 2); ctx.arc(6, -66, 4, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = "#70eaff"; ctx.shadowBlur = 9; ctx.fillStyle = "#a8f5ff"; ctx.fillRect(-6, -67, 2, 2); ctx.fillRect(5, -67, 2, 2); ctx.shadowBlur = 0;
  ctx.strokeStyle = "#828b8c"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(23, -47); ctx.lineTo(38, -15); ctx.stroke();
  ctx.fillStyle = "#79898c"; ctx.beginPath(); ctx.moveTo(40, -9); ctx.lineTo(31, -22); ctx.lineTo(42, -25); ctx.closePath(); ctx.fill();
}

function drawGraveWarden(enemy) {
  const slamProgress = enemy.state === "slam" ? 1 - enemy.attackTimer / 1.12 : 0;
  const attackWind = enemy.state === "slam" ? Math.sin(clamp(slamProgress, 0, 1) * Math.PI) : 0;
  const chargeLean = enemy.state === "charge" ? (enemy.attackTimer > .72 ? -.1 : .18) : 0;
  const moving = Math.abs(enemy.vx) > 8;
  const step = moving ? Math.sin(enemy.anim) * 5 : 0;
  const armorBounce = moving ? Math.abs(Math.sin(enemy.anim)) * 1.8 : Math.sin(game.time * 1.8) * .7;
  const capeLag = clamp(-enemy.vx * .035, -8, 8) + Math.sin(game.time * 3.2) * 1.5;
  ctx.translate(0, armorBounce);
  ctx.rotate(chargeLean + enemy.turnLean);
  if (enemy.state === "slam" && enemy.attackTimer > .48) {
    const telegraph = 1 - (enemy.attackTimer - .48) / .64;
    ctx.strokeStyle = `rgba(203,91,63,${.18 + telegraph * .38})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(enemy.attackDirection * 58, 1, 46 + telegraph * 32, 7, 0, 0, Math.PI * 2); ctx.stroke();
  }
  if (enemy.state === "charge" && enemy.attackTimer > .72) {
    ctx.fillStyle = `rgba(194,65,51,${.15 + Math.sin(game.time * 18) * .05})`;
    ctx.beginPath(); ctx.ellipse(48, -67, 40, 18, 0, 0, Math.PI * 2); ctx.fill();
  }
  if (enemy.state === "summon") {
    ctx.strokeStyle = "rgba(113,181,174,.38)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, -65, 35 + Math.sin(game.time * 6) * 4, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.beginPath(); ctx.ellipse(0, 3, 52, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#32141b"; ctx.strokeStyle = "#171015"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-32, -98); ctx.quadraticCurveTo(-56 - capeLag, -79, -48 - capeLag, -43); ctx.lineTo(-27, -50); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "#283238"; ctx.lineWidth = 17; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-20, -42); ctx.lineTo(-23 - step, -4); ctx.moveTo(20, -42); ctx.lineTo(23 + step, -4); ctx.stroke();
  const armor = ctx.createLinearGradient(-45, 0, 45, 0);
  armor.addColorStop(0, "#242b31"); armor.addColorStop(.45, "#778086"); armor.addColorStop(.58, "#343d44"); armor.addColorStop(1, "#151b20");
  ctx.fillStyle = armor; ctx.strokeStyle = "#90969a"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-39, -103); ctx.lineTo(38, -101); ctx.lineTo(44, -42); ctx.quadraticCurveTo(0, -25, -45, -43); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#49282e"; ctx.beginPath(); ctx.moveTo(-28, -87); ctx.lineTo(27, -88); ctx.lineTo(20, -45); ctx.lineTo(-22, -45); ctx.closePath(); ctx.fill();
  const chest = ctx.createLinearGradient(-29, -88, 30, -49);
  chest.addColorStop(0, "#171d21"); chest.addColorStop(.45, "#4d585c"); chest.addColorStop(.62, "#252d31"); chest.addColorStop(1, "#101519");
  ctx.fillStyle = chest; ctx.strokeStyle = "#778386"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-29, -89); ctx.lineTo(28, -89); ctx.lineTo(23, -54); ctx.lineTo(0, -46); ctx.lineTo(-24, -54); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "rgba(166,196,202,.32)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-23, -84); ctx.lineTo(20, -86); ctx.moveTo(-20, -58); ctx.lineTo(18, -57); ctx.stroke();

  const introGlow = game.mode === "bossIntro" || game.mode === "campaignBossIntro" ? .34 + Math.sin(game.time * 8) * .12 : 0;
  const phaseGlow = enemy.phase === 2 ? .13 + (Math.sin(game.time * 5.2) + 1) * .08 : 0;
  const inscriptionAlpha = enemy.dead ? clamp(enemy.stateTimer / 1.35, 0, 1) : 1;
  ctx.save();
  ctx.scale(enemy.facing, 1);
  ctx.globalAlpha = inscriptionAlpha;
  ctx.font = "900 10px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  if (introGlow + phaseGlow > 0) {
    ctx.strokeStyle = `rgba(151,49,43,${introGlow + phaseGlow})`; ctx.lineWidth = 3;
    ctx.strokeText("VELKO", 0, -69);
  }
  ctx.strokeStyle = "rgba(4,7,9,.92)"; ctx.lineWidth = 2.6; ctx.strokeText("VELKO", 0, -69);
  ctx.fillStyle = enemy.phase === 2 ? "#5e2929" : "#151b1e"; ctx.fillText("VELKO", 0, -69);
  ctx.strokeStyle = "rgba(143,188,198,.58)"; ctx.lineWidth = .7; ctx.strokeText("VELKO", 0, -70);
  ctx.restore();
  ctx.strokeStyle = "#aaafb0"; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(-36, -91); ctx.lineTo(-52, -63); ctx.moveTo(36, -91); ctx.lineTo(50, -63); ctx.stroke();
  ctx.fillStyle = "#566166"; ctx.strokeStyle = "#9ca7a9"; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(-39, -94, 20, 13, -.18, Math.PI, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#303a3f"; ctx.beginPath(); ctx.ellipse(38, -93, 14, 10, .16, Math.PI, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#384148"; ctx.strokeStyle = "#aab0af";
  ctx.beginPath(); ctx.moveTo(-31, -103); ctx.lineTo(-26, -123); ctx.quadraticCurveTo(0, -142, 28, -122); ctx.lineTo(33, -101); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#10151a"; ctx.fillRect(-22, -116, 46, 8);
  ctx.shadowColor = "#e44835"; ctx.shadowBlur = 12; ctx.fillStyle = "#ff6b3d"; ctx.fillRect(10, -114, 7, 3); ctx.shadowBlur = 0;
  ctx.strokeStyle = "#272c31"; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(37, -85); ctx.lineTo(63 + attackWind * 32, -63 + attackWind * 47); ctx.stroke();
  ctx.fillStyle = "#5b6264"; ctx.strokeStyle = "#9b9f9a"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.rect(52 + attackWind * 32, -66 + attackWind * 47, 28, 38); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "#373c3d"; ctx.beginPath(); ctx.moveTo(56 + attackWind * 32, -43 + attackWind * 47); ctx.lineTo(76 + attackWind * 32, -61 + attackWind * 47); ctx.stroke();
  ctx.save(); ctx.translate(-46, -73);
  ctx.fillStyle = "#273239"; ctx.strokeStyle = "#929b9b"; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(0, -28); ctx.lineTo(25, -18); ctx.lineTo(21, 20); ctx.lineTo(0, 31); ctx.lineTo(-19, 18); ctx.lineTo(-22, -18); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = enemy.phase === 2 ? "#8e5369" : "#657d83"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0, 0, 10, -.8, 1.3); ctx.stroke();
  ctx.restore();
}

function drawDrop(drop) {
  ctx.save(); ctx.translate(drop.x + 13, drop.y + 20);
  ctx.globalAlpha = .42; ctx.fillStyle = "#020407"; ctx.beginPath(); ctx.ellipse(0, 9, 20, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  if (drop.kind === "cinderwindAmulet") {
    ctx.rotate(Math.sin(game.time * 1.4 + drop.x) * .035);
    ctx.strokeStyle = "#3b464a"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, -19, 7, Math.PI * .12, Math.PI * .88); ctx.stroke();
    ctx.fillStyle = "#11171b"; ctx.strokeStyle = "#687a82"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-14,-13); ctx.lineTo(10,-16); ctx.lineTo(17,-5); ctx.lineTo(12,14); ctx.lineTo(-11,16); ctx.lineTo(-17,4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#78b6ca"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-9,-7); ctx.lineTo(0,-11); ctx.lineTo(8,-5); ctx.lineTo(2,1); ctx.lineTo(9,7); ctx.stroke();
    ctx.strokeStyle = "#a9443c"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-7,10); ctx.lineTo(-2,3); ctx.lineTo(3,11); ctx.stroke();
    ctx.fillStyle = "rgba(111,151,164,.2)"; ctx.beginPath(); ctx.arc(0,0,23,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = "rgba(111,130,134,.55)";
    for (let ash = 0; ash < 3; ash++) {
      const ashX = -9 + ash * 8 + Math.sin(game.time * 1.7 + ash + drop.x) * 3;
      const ashY = -24 - ((game.time * (5 + ash) + ash * 7) % 15);
      ctx.fillRect(ashX, ashY, 1.5, 1.5);
    }
  } else if (drop.kind === "score" || drop.kind === "soul") {
    ctx.fillStyle = drop.kind === "soul" ? "#79c9d5" : "#d2bd72"; ctx.beginPath(); ctx.moveTo(0,-12); ctx.lineTo(9,0); ctx.lineTo(0,12); ctx.lineTo(-9,0); ctx.closePath(); ctx.fill();
  } else if (drop.weapon === "torch") {
    ctx.rotate(-.28); ctx.strokeStyle = "#5b3b29"; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-14,8); ctx.lineTo(10,-7); ctx.stroke();
    const flicker = Math.sin(game.time * 17 + drop.x) * 2;
    ctx.fillStyle = "#ffb244"; ctx.beginPath(); ctx.moveTo(8,-8); ctx.quadraticCurveTo(3+flicker,-19,13,-22); ctx.quadraticCurveTo(19,-13,12,-6); ctx.fill();
    ctx.fillStyle = "#fff0a4"; ctx.beginPath(); ctx.ellipse(11,-13,3,6,.2,0,Math.PI*2); ctx.fill();
  } else if (drop.weapon === "dagger") {
    ctx.rotate(-.35); ctx.fillStyle = "#c8d0d1"; ctx.strokeStyle = "#59666b"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-18,2); ctx.lineTo(13,-4); ctx.lineTo(20,0); ctx.lineTo(13,4); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#9b7248"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-19,0); ctx.lineTo(-9,0); ctx.stroke();
  } else {
    ctx.rotate(-.22); ctx.strokeStyle = "#aeb9b8"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-24,5); ctx.lineTo(20,-5); ctx.stroke();
    ctx.fillStyle = "#d8dedb"; ctx.beginPath(); ctx.moveTo(24,-6); ctx.lineTo(14,-11); ctx.lineTo(17,-3); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#785b3d"; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-24,5); ctx.lineTo(-14,3); ctx.stroke();
  }
  ctx.restore();
}

function drawSoulCoins(visibleMin, visibleMax) {
  ctx.save();
  for (const coin of soulCoins) {
    if (coin.x < visibleMin || coin.x > visibleMax) continue;
    const fade = coin.life < 2 ? clamp(coin.life / 2, 0, 1) : 1;
    const spinWidth = 2.2 + Math.abs(Math.cos(coin.spin)) * 4.2;
    ctx.globalAlpha = fade * .35;
    ctx.fillStyle = "#020305";
    ctx.beginPath(); ctx.ellipse(coin.x, Math.min(GROUND_Y + 1, coin.y + 8), 7, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = fade;
    ctx.fillStyle = "#806331";
    ctx.strokeStyle = "#d0ad61";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(coin.x, coin.y, spinWidth, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = Math.sin(coin.spin) > 0 ? "#75aeb8" : "#9b4438";
    ctx.lineWidth = .8;
    ctx.beginPath(); ctx.moveTo(coin.x - spinWidth * .45, coin.y + 1); ctx.lineTo(coin.x, coin.y - 2.5); ctx.lineTo(coin.x + spinWidth * .45, coin.y + 1); ctx.stroke();
    if (Math.abs(Math.cos(coin.spin)) > .88) {
      ctx.fillStyle = "rgba(237,215,153,.72)"; ctx.fillRect(coin.x - 1, coin.y - 5, 1, 3);
    }
  }
  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    const size = p.size * clamp(p.life * 2, .2, 1);
    if (p.kind === "dust") {
      ctx.beginPath(); ctx.ellipse(p.x, p.y, size * 1.7, size * .65, 0, 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === "steam") {
      ctx.globalAlpha *= .48;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, size * .8, size * 1.5, 0, 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === "pizzaCrumb") {
      ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === "splinter") {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation); ctx.fillRect(-size * 1.7, -size * .35, size * 3.4, size * .7); ctx.restore();
    } else if (p.kind === "paper") {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation); ctx.fillRect(-size * 1.4, -size * .75, size * 2.8, size * 1.5); ctx.restore();
    } else if (p.kind === "rain") {
      ctx.globalAlpha *= .45; ctx.fillRect(p.x, p.y, 1, size * 8);
    } else if (p.kind === "fogWisp") {
      ctx.globalAlpha *= .22; ctx.beginPath(); ctx.ellipse(p.x, p.y, size * 8, size * 1.4, 0, 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === "ash") {
      ctx.beginPath(); ctx.arc(p.x, p.y, size * .55, 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === "leaf") {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation); ctx.fillRect(-size, -size * .35, size * 2, size * .7); ctx.restore();
    } else if (p.kind === "soul") {
      ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha *= .25; ctx.beginPath(); ctx.arc(p.x, p.y, size * 2.8, 0, Math.PI * 2); ctx.fill();
    } else if (p.kind === "gash") {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
      ctx.fillRect(-size * 5.5, -size * .42, size * 11, size * .84);
      ctx.globalAlpha *= .4;
      ctx.fillRect(-size * 3, -size * .9, size * 6, size * 1.8);
      ctx.restore();
    } else {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.vy, p.vx)); ctx.fillRect(-size * 1.8, -size * .4, size * 3.6, size * .8); ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

function drawScorePopups() {
  ctx.save();
  ctx.font = "bold 13px ui-monospace, monospace";
  ctx.textAlign = "center";
  for (const popup of scorePopups) {
    ctx.globalAlpha = clamp(popup.life * 2.2, 0, 1);
    ctx.fillStyle = "rgba(5,7,10,.8)";
    ctx.fillText(popup.text, popup.x + 1, popup.y + 2);
    ctx.fillStyle = popup.color;
    ctx.fillText(popup.text, popup.x, popup.y);
  }
  ctx.restore();
}

function drawBossBar() {
  const boss = enemies.find((enemy) => (enemy.type === "boss" || enemy.type === "campaignBoss") && !enemy.dead);
  if (!boss) return;
  const width = 360;
  const left = VIEW_W / 2 - width / 2;
  const ratio = clamp(boss.health / boss.maxHealth, 0, 1);
  if (boss.barGhost === undefined || boss.barGhost < ratio) boss.barGhost = ratio;
  boss.barGhost = Math.max(ratio, boss.barGhost - .0038);
  const phase2 = boss.phase === 2;
  ctx.fillStyle = "rgba(5,7,11,.78)"; ctx.fillRect(left - 4, 22, width + 8, 24);
  if (phase2) {
    ctx.strokeStyle = `rgba(${boss.bossId === "todor" ? "196,84,74" : "122,168,196"},${.5 + Math.sin(game.time * 5) * .2})`;
    ctx.strokeRect(left - 4, 22, width + 8, 24);
  }
  ctx.strokeStyle = "#777b7e"; ctx.strokeRect(left, 26, width, 14);
  ctx.fillStyle = "rgba(222,196,150,.4)";
  ctx.fillRect(left + 2, 28, Math.max(0, width * boss.barGhost - 4), 10);
  const gradient = ctx.createLinearGradient(left, 0, left + width, 0);
  const crimsonBoss = boss.bossId === "todor";
  if (phase2) {
    gradient.addColorStop(0, crimsonBoss ? "#94231c" : "#5c3550");
    gradient.addColorStop(1, crimsonBoss ? "#f2742f" : "#b45a7e");
  } else if (crimsonBoss) {
    gradient.addColorStop(0, "#6e1f1a"); gradient.addColorStop(1, "#cf7a34");
  } else {
    gradient.addColorStop(0, "#2f4a63"); gradient.addColorStop(1, "#8fb9c6");
  }
  ctx.fillStyle = gradient; ctx.fillRect(left + 2, 28, Math.max(0, width * ratio - 4), 10);
  const profile = boss.type === "campaignBoss" ? BOSS_PROFILES[boss.profileId] : null;
  const threshold = profile ? profile.phaseThreshold : .5;
  if (!phase2) {
    ctx.strokeStyle = "rgba(226,214,186,.45)";
    ctx.beginPath(); ctx.moveTo(left + width * threshold, 26); ctx.lineTo(left + width * threshold, 40); ctx.stroke();
  }
  ctx.fillStyle = phase2 ? "#f0cdb4" : "#e0d9c5";
  ctx.font = "bold 11px Georgia"; ctx.textAlign = "center";
  ctx.fillText(boss.name || "VELKO", VIEW_W / 2, 18);
}

// -----------------------------------------------------------------------------
// Game loop
// -----------------------------------------------------------------------------

let lastTime = performance.now();

function update(dt) {
  if (game.mode === "victory" || game.mode === "gameover" || game.mode === "levelComplete") {
    game.time += dt;
    updateParticles(dt);
    return;
  }
  if (game.mode === "transition") {
    updateTransition(dt);
    return;
  }
  if (game.mode === "bossIntro") {
    updateBossIntro(dt);
    return;
  }
  if (game.mode === "campaignBossIntro") {
    updateCampaignBossIntro(dt);
    return;
  }
  if (game.mode !== "running") return;
  game.time += dt;
  game.levelTime += dt;
  BossSpeech.update(dt);
  RivalSpeech.update(dt);
  updateVelkoSubtitle(dt);
  game.arenaGateProgress = approach(game.arenaGateProgress, game.arenaLocked ? 1 : 0, dt * 2.2);
  game.shake = Math.max(0, game.shake - dt * 38);
  game.flash = Math.max(0, game.flash - dt);
  game.ambientPulse = Math.max(0, game.ambientPulse - dt);
  game.checkpointPulse = Math.max(0, game.checkpointPulse - dt * .72);
  game.lightning = Math.max(0, game.lightning - dt * 1.9);
  if (game.weaponToastTimer > 0) {
    game.weaponToastTimer -= dt;
    if (game.weaponToastTimer <= 0) weaponToast.classList.remove("visible");
  }
  if (game.hitStop > 0) {
    game.hitStop = Math.max(0, game.hitStop - dt);
    return;
  }
  updateParticles(dt);
  if (game.endTimer > 0) {
    game.endTimer -= dt;
    if (game.endTimer <= 0) {
      if (game.endVictory && (game.currentLevel === 0 || game.bossVictoryPending)) completeBossEncounter();
      else finishGame(game.endVictory);
      return;
    }
  }
  updatePlayer(dt);
  updateLevel(dt);
  updateEnemies(dt);
  updateProjectiles(dt);
  separateEnemies();
  updateWeaponHits();

  const cameraTarget = clamp(player.x - VIEW_W * 0.37 + player.vx * 0.18, 0, WORLD_W - VIEW_W);
  game.cameraX = lerp(game.cameraX, cameraTarget, 1 - Math.pow(0.00012, dt));
}

function frame(timestamp) {
  const dt = Math.min(1 / 30, Math.max(0, (timestamp - lastTime) / 1000));
  lastTime = timestamp;
  game.fpsEstimate = lerp(game.fpsEstimate || 60, dt > 0 ? 1 / dt : 60, .08);
  update(dt);
  render();
  updateAudioDebugPanel(timestamp);
  updateCampaignDebugPanel(timestamp);
  input.attackPressedThisFrame = false;
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// -----------------------------------------------------------------------------
// Mobile controls
// -----------------------------------------------------------------------------

for (const button of touchButtons) {
  const action = button.dataset.action;
  const setPressed = (pressed, event) => {
    event.preventDefault();
    button.classList.toggle("pressed", pressed);
    button.setAttribute("aria-pressed", String(pressed));
    if (action === "jump") {
      input.jumpHeld = game.mode === "running" && (pressed || isKeyboardActionHeld("jump"));
      if (!input.jumpHeld && player.vy < -120) player.vy *= 0.48;
    }
    if (action === "attack") {
      if (pressed && game.mode === "running") input.attackHeld = true;
      else if (!isKeyboardActionHeld("attack")) releaseAttackInput();
    }
    if (action === "left" || action === "right") input[action] = game.mode === "running" && (pressed || isKeyboardActionHeld(action));
    if (pressed && game.mode === "running" && (action === "jump" || action === "attack")) queueAction(action);
  };

  button.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    if (touchPointerOwners.has(button)) return;
    unlockAudio();
    touchPointerOwners.set(button, event.pointerId);
    setPressed(true, event);
    try {
      button.setPointerCapture(event.pointerId);
    } catch (_error) {
      // The press is still valid; interruption cleanup prevents a stuck input.
    }
  });
  const releasePointer = (event) => {
    if (touchPointerOwners.get(button) !== event.pointerId) return;
    touchPointerOwners.delete(button);
    setPressed(false, event);
  };
  button.addEventListener("pointerup", releasePointer);
  button.addEventListener("pointercancel", releasePointer);
  button.addEventListener("lostpointercapture", releasePointer);
  button.addEventListener("contextmenu", (event) => event.preventDefault());
}

// -----------------------------------------------------------------------------
// Overlays / UI
// -----------------------------------------------------------------------------

const scoreElement = document.getElementById("score");
const livesElement = document.getElementById("lives");
const weaponElement = document.getElementById("weapon");
const weaponDetailElement = document.getElementById("weaponDetail");
const levelNumber = document.getElementById("levelNumber");
const weaponToast = document.getElementById("weaponToast");
const amuletIcon = document.getElementById("amuletIcon");
const bossIntroOverlay = document.getElementById("bossIntroOverlay");
const bossIntroName = document.getElementById("bossIntroName");
const bossIntroDialogue = document.getElementById("bossIntroDialogue");
const velkoSubtitle = document.getElementById("velkoSubtitle");
const bossSubtitleSpeaker = document.getElementById("bossSubtitleSpeaker");
const velkoSubtitleText = document.getElementById("velkoSubtitleText");
const pauseOverlay = document.getElementById("pauseOverlay");
const titleOverlay = document.getElementById("titleOverlay");
const startButton = document.getElementById("startButton");
const continueButton = document.getElementById("continueButton");
const fullscreenButton = document.getElementById("fullscreenButton");
const endOverlay = document.getElementById("endOverlay");
const endTitle = document.getElementById("endTitle");
const endMessage = document.getElementById("endMessage");
const endScore = document.getElementById("endScore");
const completionList = document.getElementById("completionList");
const nextLevelButton = document.getElementById("nextLevelButton");
const restartButton = document.getElementById("restartButton");
const soundButton = document.getElementById("soundButton");
const pauseButton = document.getElementById("pauseButton");
const audioDebugPanel = document.getElementById("audioDebugPanel");
const campaignDebugPanel = document.getElementById("campaignDebugPanel");
const audioDebugMode = /(?:\?|&)debugAudio=1(?:&|$)/.test(window.location.search || "");
const campaignDebugMode = /(?:\?|&)debugCampaign=1(?:&|$)/.test(window.location.search || "");
let lastAudioDebugUpdate = -Infinity;
let lastCampaignDebugUpdate = -Infinity;

if (audioDebugMode) audioDebugPanel.removeAttribute("hidden");
if (campaignDebugMode) campaignDebugPanel.removeAttribute("hidden");

function updateAudioDebugPanel(timestamp = performance.now()) {
  if (!audioDebugMode || timestamp - lastAudioDebugUpdate < 250) return;
  lastAudioDebugUpdate = timestamp;
  const state = SoundManager.debugState();
  const speech = BossSpeech.debugState();
  const inscriptionActive = enemies.some((enemy) => enemy.type === "boss");
  audioDebugPanel.textContent = [
    `AudioContext: ${state.contextState}`,
    `Sound enabled: ${state.enabled}`,
    `Music enabled: ${state.musicEnabled}`,
    `Gains M/Music/SFX: ${Number(state.masterLevel).toFixed(3)} / ${Number(state.musicLevel).toFixed(3)} / ${Number(state.sfxLevel).toFixed(3)}`,
    `Final safety gain: ${Number(state.finalSafetyLevel).toFixed(3)}`,
    `Active SFX: ${state.sfxSourceCount}`,
    `Active music sources: ${state.musicSourceCount}`,
    `Music schedulers: ${state.schedulerCount}`,
    `Compressor: ${state.compressorEnabled ? "enabled" : "disabled"}`,
    `Clipping protection: ${state.clippingProtection ? "enabled" : "disabled"}`,
    `Last audio event: ${state.lastAudioEvent}`,
    `Last voice release: ${state.lastVoiceReleaseStatus}`,
    `speechSynthesis supported: ${speech.supported ? "yes" : "no"}`,
    `Selected boss voice: ${speech.selectedVoiceName}`,
    `Selected voice language: ${speech.selectedVoiceLanguage}`,
    `Bulgarian voice found: ${speech.bulgarianVoiceFound ? "yes" : "no"}`,
    `Current speech pitch/rate: ${speech.pitch.toFixed(2)} / ${speech.rate.toFixed(2)}`,
    `Boss speech active: ${speech.active ? "yes" : "no"}`,
    `Demonic support active: ${speech.supportLayerActive ? "yes" : "no"}`,
    `Last VELKO event: ${speech.currentEventType}`,
    `Last spoken VELKO line: ${speech.lastSpokenPhrase || "none"}`,
    `Dialogue priority: ${speech.currentPriority}`,
    `Combat bark cooldown: ${speech.normalCooldownRemaining.toFixed(1)}s`,
    `Player-hit bark cooldown: ${speech.playerHitCooldownRemaining.toFixed(1)}s`,
    `Pizza-hit laugh cooldown: ${speech.pizzaHitCooldownRemaining.toFixed(1)}s`,
    `Active subtitle: ${speech.subtitleActive ? "yes" : "no"}`,
    `Boss intro trigger count: ${game.bossIntroTriggerCount}`,
    `VELKO phase: ${game.bossPhase}`,
    `Armor inscription active: ${inscriptionActive ? "yes" : "no"}`,
    `Active pizza zombies: ${activePizzaZombieCount()}`,
    `Active pizza projectiles: ${activePizzaProjectileCount()}`,
    `Pizza projectile limit: ${MAX_PIZZA_PROJECTILES}`,
    `Pizza first-throw dialogue: ${game.pizzaFirstThrowDialogueTriggered ? "yes" : "no"}`,
    `Next pizza spawn timer: ${game.pizzaNextSpawnTimer < 0 ? "none" : `${game.pizzaNextSpawnTimer.toFixed(1)}s`}`,
    `Last pizza dialogue event: ${game.lastPizzaDialogueEvent}`,
    `Last pizza projectile result: ${game.lastPizzaProjectileResult}`,
    `Last speech error: ${speech.lastSpeechError || "none"}`
  ].join("\n");
}

function updateCampaignDebugPanel(timestamp = performance.now()) {
  if (!campaignDebugMode || timestamp - lastCampaignDebugUpdate < 250) return;
  lastCampaignDebugUpdate = timestamp;
  const audio = SoundManager.debugState();
  const profile = BOSS_PROFILES[game.activeBossProfile];
  const rivalSpeech = RivalSpeech.debugState();
  const campaignBoss = activeCampaignBoss();
  const rangedProfile = currentRangedProfile();
  const difficulty = getLevelDifficulty();
  const regularEnemies = enemies.filter((enemy) => !enemy.dead && enemy.type !== "boss" && enemy.type !== "campaignBoss");
  const activeGrassClusters = OUTDOOR_GRASS_LEVELS.has(game.currentLevel) ? Math.ceil(VIEW_W / 38) : 0;
  campaignDebugPanel.textContent = [
    `Level: ${game.currentLevel + 1} — ${currentLevelDefinition().name}`,
    `Player lives: ${player.lives} / ${MAX_PLAYER_LIVES}`,
    `Amulet state: ${game.levelAmuletState}`,
    `Amulet spawn count: ${game.levelAmuletSpawnCount}`,
    `Amulet collected: ${game.amuletCollectedThisAttempt ? "yes" : "no"}`,
    `Amulet shattered: ${game.amuletShatteredThisAttempt ? "yes" : "no"}`,
    `activeSoulCoinCount: ${soulCoins.length}`,
    `soulCoinsCollectedThisLevel: ${game.soulCoinsCollectedThisLevel}`,
    `soulCoinScoreThisLevel: ${game.soulCoinScoreThisLevel}`,
    `lastCoinDropEnemyType: ${game.lastCoinDropEnemyType}`,
    `cinderwindAmuletState: ${game.levelAmuletState}`,
    `cinderwindAmuletMustNotBreakOnWeaponPickup: true`,
    `attackJustPressed: ${input.attackPressedThisFrame ? "yes" : "no"}`,
    `attackHeld: ${input.attackHeld ? "yes" : "no"}`,
    `Autofire active: ${input.autofireActive ? "yes" : "no"}`,
    `Autofire grace timer: ${input.attackHoldTime.toFixed(2)}s / ${CINDERWIND_HOLD_GRACE.toFixed(2)}s`,
    `Autofire cooldown: ${input.autofireCooldown.toFixed(2)}s`,
    `Ranged weapon: ${WEAPONS[player.weapon].kind === "projectile" ? player.weapon : "none"}`,
    `Active boss: ${profile ? profile.healthLabel : game.currentLevel === 0 && game.bossSpawned ? "VELKO" : "none"}`,
    `Boss profile: ${profile ? profile.id : game.currentLevel === 0 && game.bossSpawned ? "velko1" : "none"}`,
    `Boss phase: ${game.bossPhase}`,
    `Boss intro state: ${game.bossEncounterState === "intro" ? (game.bossIntroCompletionRequested ? "completion requested" : "playing") : game.bossEncounterState}`,
    `game.mode: ${game.mode}`,
    `TODOR object exists: ${campaignBoss && campaignBoss.bossId === "todor" ? "yes" : "no"}`,
    `TODOR SUV exists: ${bossVehicle && profile && profile.bossId === "todor" ? "yes" : "no"}`,
    `Active boss minions: ${activeBossMinionCount()} / ${difficulty.summonLimit}`,
    `Active regular enemies: ${regularEnemies.length}`,
    `Grave Gunners: ${regularEnemies.filter((enemy) => enemy.type === "graveGunner").length}`,
    `Flying enemies: ${regularEnemies.filter((enemy) => enemy.type === "lanternWraith").length}`,
    `Active projectiles: ${projectiles.length}`,
    `Pizza projectiles: ${activePizzaProjectileCount()}`,
    `Money bundles: ${activeMoneyBundleCount()}`,
    `Zombie bolts: ${projectileTypeCount("zombieBolt")}`,
    `Wraith projectiles: ${activeLanternOrbCount()}`,
    `Ranged threat budget: ${hostileProjectileCount()} / ${rangedProfile ? rangedProfile.hostileCap : "legacy"}`,
    `Gunner speed multiplier: ${rangedProfile ? rangedProfile.gunnerSpeed.toFixed(2) : "1.00"}x`,
    `Wraith speed multiplier: ${rangedProfile ? rangedProfile.wraithSpeed.toFixed(2) : "1.00"}x`,
    `Encounter pressure: ${difficulty.encounterPressure.toFixed(2)}x`,
    `Boss pressure: recovery ${difficulty.recoveryScale.toFixed(2)}x, summons ${difficulty.summonLimit}/${difficulty.summonBudget}`,
    `Ranged fire gate: ${Math.max(0, game.rangedNextShotAt - game.time).toFixed(2)}s`,
    `Grass clusters visible: ~${activeGrassClusters}`,
    `Ambient/total particles: ${particles.length}`,
    `Atmosphere: ${ATMOSPHERE_PROFILES[game.currentLevel]}`,
    `Wind intensity: ${difficulty.wind.toFixed(2)}`,
    `FPS estimate: ${(game.fpsEstimate || 60).toFixed(0)}`,
    `Vehicle attack: ${game.vehicleAttackActive ? "yes" : "no"}`,
    `Boss speech: ${BossSpeech.isActive() || RivalSpeech.isActive() ? "yes" : "no"}`,
    `Boss voice: ${profile && profile.bossId === "todor" ? "Bulgarian preferred TODOR" : "Bulgarian preferred VELKO"}`,
    `Boss pitch/rate: ${profile && profile.bossId === "todor" ? "0.46 / 0.74" : "0.38 / 0.68"}`,
    `Subtitle: ${velkoSubtitleState.active ? "yes" : "no"}`,
    `Checkpoint: ${game.checkpointId || "level start"}`,
    `Highest unlocked: ${game.highestUnlockedLevel + 1}`,
    `Transition pending: ${game.mode === "transition" || game.nextLevelReady ? "yes" : "no"}`,
    `Intro fallback timer: ${game.bossIntroFallbackTimerActive ? "active" : "inactive"}`,
    `Last transition error: ${game.lastTransitionError}`,
    `Game loops: ${game.gameLoopCount}`,
    `AudioContexts: ${audio.context ? 1 : 0}`,
    `Music scheduler: ${audio.schedulerCount ? "active" : "single retained loop"}`,
    `Last reset: ${game.lastResetReason}`,
    `Last projectile clear: ${game.lastClearedProjectileReason}`,
    `Rival speech event: ${rivalSpeech.currentEventType}`
  ].join("\n");
}

function updateHUD() {
  scoreElement.textContent = String(game.score).padStart(6, "0");
  weaponElement.textContent = WEAPONS[player.weapon].name;
  weaponDetailElement.textContent = WEAPONS[player.weapon].detail;
  livesElement.textContent = "";
  for (let i = 0; i < MAX_PLAYER_LIVES; i++) {
    const icon = document.createElement("i");
    icon.className = `life-icon${i >= player.lives ? " lost" : ""}`;
    livesElement.appendChild(icon);
  }
  livesElement.setAttribute("aria-label", `${player.lives} lives`);
  livesElement.classList.toggle("critical", player.lives === 1);
  amuletIcon.hidden = game.levelAmuletState !== "active";
  amuletIcon.classList.toggle("autofire-active", game.levelAmuletState === "active" && input.autofireActive);
}

function showStatusToast(message, duration = 1.35) {
  weaponToast.textContent = message;
  weaponToast.classList.remove("visible");
  void weaponToast.offsetWidth;
  weaponToast.classList.add("visible");
  game.weaponToastTimer = duration;
}

function showWeaponToast(weapon) {
  showStatusToast(`Equipped: ${WEAPONS[weapon].name}`);
}

function startGame() {
  loadCampaignProgress();
  game.time = 0;
  game.score = 0;
  game.pausedFrom = "running";
  const requestedLevel = campaignDebugMode ? Number(new URLSearchParams(window.location.search).get("level")) : 1;
  const debugLevel = Number.isInteger(requestedLevel) && requestedLevel >= 1 && requestedLevel <= LEVEL_DEFINITIONS.length ? requestedLevel - 1 : 0;
  if (campaignDebugMode) game.highestUnlockedLevel = Math.max(game.highestUnlockedLevel, debugLevel);
  loadLevel(debugLevel, { score: 0, resetReason: campaignDebugMode && debugLevel ? `debug load level ${debugLevel + 1}` : "startup" });
  const debugBossRequested = campaignDebugMode && /(?:\?|&)boss=1(?:&|$)/.test(window.location.search || "");
  if (debugBossRequested) {
    enemies.length = 0;
    if (debugLevel === 0) {
      game.spawnCursor = spawnPlan.length;
      player.x = 6530;
      spawnEnemy("boss", 6920);
    } else {
      const definition = currentLevelDefinition();
      game.spawnCursor = activeSpawnPlan.length;
      player.x = definition.exitX;
      game.exitState = "boss";
      startBossEncounter(definition.bossProfile);
    }
  }
  if (campaignDebugMode) playSound("restart");
  else enterTitleScreen();
}

function enterTitleScreen() {
  game.mode = "title";
  stopMusic();
  if (game.highestUnlockedLevel > 0) {
    continueButton.hidden = false;
    continueButton.textContent = `Continue — Level ${CAMPAIGN_ROMAN_LEVELS[game.highestUnlockedLevel]}`;
  }
  titleOverlay.classList.add("visible");
}

function startFromTitle(levelIndex) {
  if (game.mode !== "title") return;
  unlockAudio();
  titleOverlay.classList.remove("visible");
  loadLevel(levelIndex, { score: 0, resetReason: levelIndex > 0 ? "continue from title" : "begin from title" });
  lastTime = performance.now();
  playSound("restart");
}

function setPaused(paused) {
  if (paused && (game.mode === "running" || game.mode === "bossIntro" || game.mode === "campaignBossIntro")) {
    const campaignIntroPaused = game.mode === "campaignBossIntro";
    if (campaignIntroPaused) finishTodorIntroOnce("pause cleanup", true);
    game.pausedFrom = campaignIntroPaused ? "running" : game.mode;
    const pausedDuringIntro = game.mode === "bossIntro";
    cancelBossSpeech();
    if (pausedDuringIntro) game.bossSpeechComplete = true;
    releaseTransientVoices();
    game.mode = "paused";
    cancelTransientControls(true);
    playSound("pause");
    pauseMusic();
    pauseOverlay.classList.add("visible");
  } else if (!paused && game.mode === "paused") {
    game.mode = game.pausedFrom === "bossIntro" ? "bossIntro" : game.pausedFrom === "campaignBossIntro" ? "campaignBossIntro" : "running";
    resumeMusic();
    playSound("resume");
    pauseOverlay.classList.remove("visible");
    lastTime = performance.now();
    canvas.focus({ preventScroll: true });
  }
}

function togglePause() {
  if (game.mode === "running" || game.mode === "bossIntro" || game.mode === "campaignBossIntro") setPaused(true);
  else if (game.mode === "paused") setPaused(false);
}

function finishGame(victory) {
  clearCampaignBossIntroFallback();
  cancelTransientControls(true);
  cancelBossSpeech("game over or victory");
  stopPizzaEncounter(false);
  bossFloorWarnings.length = 0;
  bossIntroOverlay.classList.remove("visible", "leaving", "campaign", "velko", "todor");
  bossIntroOverlay.setAttribute("aria-hidden", "true");
  clearAllProjectiles(victory ? "victory screen" : "game over");
  clearSoulCoins();
  game.vehicleAttackActive = false;
  bossVehicle = null;
  if (!victory) {
    resetEncounterState("game over cleanup");
    enemies.length = 0;
    fallingStones.length = 0;
    drops.length = 0;
    scorePopups.length = 0;
    while (particles.length) releaseParticleAt(particles.length - 1);
    game.bossSpawned = false;
    game.bossDefeated = false;
    game.activeBossProfile = null;
    game.bossEncounterState = "idle";
    game.arenaLocked = false;
    game.arenaGateProgress = 0;
    game.levelArenaLeft = 0;
    game.levelArenaRight = 0;
  }
  SoundManager.setBossTension(false);
  game.mode = victory ? "victory" : "gameover";
  setPlayerAnimationState(victory ? "victoryIdle" : "death");
  endTitle.textContent = victory ? "VICTORY" : "GAME OVER";
  endMessage.textContent = victory ? "The Hollow Cemetery is silent… for now." : `${currentLevelDefinition().name} claims another knight`;
  endScore.textContent = String(game.score).padStart(6, "0");
  restartButton.textContent = victory ? "Restart Level" : (game.checkpointId ? "Restart Checkpoint" : "Try Again");
  nextLevelButton.hidden = true;
  completionList.hidden = true;
  endOverlay.classList.toggle("victory", victory);
  endOverlay.classList.toggle("defeat", !victory);
  stopMusic();
  releaseTransientVoices();
  playSound(victory ? "victory" : "gameover");
  endOverlay.classList.add("visible");
}

restartButton.addEventListener("click", () => game.mode === "gameover" ? loadCheckpoint() : restartLevel());
nextLevelButton.addEventListener("click", advanceToNextLevel);
startButton.addEventListener("click", () => startFromTitle(0));
continueButton.addEventListener("click", () => startFromTitle(game.highestUnlockedLevel));
const fullscreenSupported = Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled);
fullscreenButton.hidden = !fullscreenSupported;
fullscreenButton.addEventListener("click", () => {
  unlockAudio();
  playSound("uiSelect");
  const active = document.fullscreenElement || document.webkitFullscreenElement;
  const root = document.documentElement;
  try {
    if (active) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
  } catch (error) {
    fullscreenButton.hidden = true;
  }
});
document.addEventListener("fullscreenchange", resizeCanvas);
document.addEventListener("webkitfullscreenchange", resizeCanvas);
document.getElementById("resumeButton").addEventListener("click", () => setPaused(false));
document.getElementById("restartLevelButton").addEventListener("click", restartLevel);
pauseButton.addEventListener("click", () => {
  unlockAudio();
  togglePause();
});
soundButton.addEventListener("click", () => {
  const nextEnabled = !SoundManager.debugState().enabled;
  setSoundEnabled(nextEnabled);
  if (!nextEnabled) cancelBossSpeech();
  soundButton.textContent = nextEnabled ? "Sound: On" : "Sound: Off";
  soundButton.setAttribute("aria-label", nextEnabled ? "Turn sound off" : "Turn sound on");
  if (nextEnabled) {
    unlockAudioFromUserGesture();
    playSound("uiSelect");
  }
});
for (const button of document.querySelectorAll("[data-back-title]")) {
  button.addEventListener("click", () => {
    clearCampaignBossIntroFallback();
    cancelBossSpeech("back to title");
    stopPizzaEncounter(false);
    clearAllProjectiles("back to title");
    clearSoulCoins();
    bossFloorWarnings.length = 0;
    bossVehicle = null;
    window.location.reload();
  });
}

startGame();
