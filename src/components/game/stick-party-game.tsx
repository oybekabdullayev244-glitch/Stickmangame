"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackAnalyticsEvent } from "@/lib/analytics";
import {
  calculateMatchReward,
  rewardedAvailabilityText,
  rewardedStatus,
  rewardedTierOdds,
  rollRewardedBonus,
  type RewardedStatus,
} from "@/lib/economy";
import { formatInt, formatSeconds } from "@/lib/format";
import {
  appendProfileEvent,
  loadProfile,
  refreshDailyCounters,
  saveProfile,
  type PlayerProfile,
  type SessionEvent,
  type SessionEventName,
} from "@/lib/profile";

type GamePhase = "home" | "playing" | "game_over";
type EnemyType = "runner" | "zigzag" | "brute";
type PickupKind = "shield" | "frenzy" | "stasis";
type UpgradeId = "rapid_fire" | "power_shot" | "speed_boost" | "multi_shot" | "dash_core" | "magnet";
type HeroId = "viper" | "titan" | "nova" | "arc";

interface Enemy {
  id: number;
  x: number;
  y: number;
  radius: number;
  baseSpeed: number;
  hue: number;
  hp: number;
  maxHp: number;
  type: EnemyType;
  wobble: number;
  drift: number;
  elite: boolean;
}

interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
  damage: number;
  radius: number;
}

interface Orb {
  id: number;
  x: number;
  y: number;
  radius: number;
  xp: number;
  score: number;
  ttl: number;
}

interface Pickup {
  id: number;
  x: number;
  y: number;
  radius: number;
  ttl: number;
  kind: PickupKind;
}

interface BuildState {
  moveSpeed: number;
  fireInterval: number;
  shotDamage: number;
  multiShot: number;
  dashCooldown: number;
  pickupRadius: number;
  maxShield: number;
  shield: number;
}

interface RoundState {
  heroId: HeroId;
  playerX: number;
  playerY: number;
  playerRadius: number;
  enemies: Enemy[];
  projectiles: Projectile[];
  orbs: Orb[];
  pickups: Pickup[];
  elapsed: number;
  score: number;
  spawnClock: number;
  spawnedEnemies: number;
  kills: number;
  level: number;
  xp: number;
  xpToNext: number;
  combo: number;
  comboExpireAt: number;
  bestCombo: number;
  lastShotAt: number;
  dashReadyAt: number;
  dashingUntil: number;
  dashDirX: number;
  dashDirY: number;
  invulnerableUntil: number;
  powerCharge: number;
  frenzyUntil: number;
  stasisUntil: number;
  nextEliteAt: number;
  contractTarget: number;
  contractProgress: number;
  contractExpireAt: number;
  nextContractAt: number;
  build: BuildState;
  upgrades: UpgradeId[];
}

interface RoundSummary {
  score: number;
  survivalSeconds: number;
  spawnedEnemies: number;
  kills: number;
  level: number;
  bestCombo: number;
  rewardCredits: number;
  rewardCrystals: number;
  isBestScore: boolean;
}

interface KeyboardState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

interface PointerState {
  active: boolean;
  x: number;
  y: number;
}

interface LiveStats {
  heroId: HeroId;
  heroName: string;
  level: number;
  combo: number;
  kills: number;
  shields: number;
  dashLeft: number;
  power: number;
  xp: number;
  xpToNext: number;
  upgrades: number;
  contractLabel: string;
}

interface UpgradeDefinition {
  id: UpgradeId;
  title: string;
  description: string;
}

interface HeroDefinition {
  id: HeroId;
  name: string;
  role: string;
  description: string;
  moveScale: number;
  fireScale: number;
  damageBonus: number;
  extraShield: number;
  dashScale: number;
  color: string;
}

const UPGRADE_POOL: UpgradeDefinition[] = [
  { id: "rapid_fire", title: "Rapid Fire", description: "Shoot faster." },
  { id: "power_shot", title: "Power Shot", description: "Projectile damage +1." },
  { id: "speed_boost", title: "Speed Boost", description: "Movement speed +12%." },
  { id: "multi_shot", title: "Multi Shot", description: "One extra projectile each volley." },
  { id: "dash_core", title: "Dash Core", description: "Dash cooldown reduced." },
  { id: "magnet", title: "Magnet", description: "Collect XP from farther away." },
];

const HERO_POOL: HeroDefinition[] = [
  {
    id: "viper",
    name: "Viper",
    role: "Skirmisher",
    description: "Fast duelist with sharp dashes. Power: Blade Storm for burst clear.",
    moveScale: 1.14,
    fireScale: 1.06,
    damageBonus: 0,
    extraShield: 0,
    dashScale: 0.82,
    color: "#9af2c2",
  },
  {
    id: "titan",
    name: "Titan",
    role: "Defender",
    description: "Heavy frontline. Power: Fortress Guard for max shield and invulnerability.",
    moveScale: 0.9,
    fireScale: 0.93,
    damageBonus: 1,
    extraShield: 1,
    dashScale: 1.2,
    color: "#ffcd8f",
  },
  {
    id: "nova",
    name: "Nova",
    role: "Blaster",
    description: "Aggressive ranged burst. Power: Solar Ring fires radial shot burst.",
    moveScale: 1,
    fireScale: 1.15,
    damageBonus: 0,
    extraShield: 0,
    dashScale: 1,
    color: "#ffd787",
  },
  {
    id: "arc",
    name: "Arc",
    role: "Controller",
    description: "Battle mage utility. Power: Arc Storm zaps elites and freezes the field.",
    moveScale: 0.98,
    fireScale: 1,
    damageBonus: 0,
    extraShield: 0,
    dashScale: 0.95,
    color: "#a6ceff",
  },
];

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 540;
const PLAYER_SPEED = 242;
const PROJECTILE_SPEED = 460;
const MIN_SPAWN_DELAY = 0.3;
const START_SPAWN_DELAY = 1.14;
const PROJECTILE_TTL = 1.6;
const AD_DURATION_SECONDS = 6;
const COMBO_WINDOW_SECONDS = 2.7;
const DASH_DURATION_SECONDS = 0.24;
const DASH_MULTIPLIER = 2.8;

const LIVE_STATS_DEFAULT: LiveStats = {
  heroId: "viper",
  heroName: "Viper",
  level: 1,
  combo: 1,
  kills: 0,
  shields: 1,
  dashLeft: 0,
  power: 0,
  xp: 0,
  xpToNext: 70,
  upgrades: 0,
  contractLabel: "No contract",
};

type FullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

const EMPTY_REWARDED_STATUS: RewardedStatus = {
  eligible: false,
  claimsLeftToday: 0,
  secondsUntilReady: 0,
  reason: "none",
};

let entityId = 0;
function nextId(): number {
  entityId += 1;
  return entityId;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function normalize(dx: number, dy: number): { x: number; y: number } {
  const magnitude = Math.hypot(dx, dy);
  if (magnitude <= 0.0001) {
    return { x: 0, y: 0 };
  }

  return { x: dx / magnitude, y: dy / magnitude };
}

function rotate(x: number, y: number, radians: number): { x: number; y: number } {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  };
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
}

function getFullscreenElement(doc: FullscreenDocument = document): Element | null {
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

async function requestNativeFullscreen(element: FullscreenElement): Promise<boolean> {
  try {
    if (typeof element.requestFullscreen === "function") {
      await element.requestFullscreen();
      return true;
    }

    if (typeof element.webkitRequestFullscreen === "function") {
      await Promise.resolve(element.webkitRequestFullscreen());
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

async function exitNativeFullscreen(doc: FullscreenDocument = document): Promise<boolean> {
  try {
    if (typeof doc.exitFullscreen === "function") {
      await doc.exitFullscreen();
      return true;
    }

    if (typeof doc.webkitExitFullscreen === "function") {
      await Promise.resolve(doc.webkitExitFullscreen());
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

function getHero(heroId: HeroId): HeroDefinition {
  return HERO_POOL.find((hero) => hero.id === heroId) ?? HERO_POOL[0];
}

function createBaseBuild(heroId: HeroId): BuildState {
  const hero = getHero(heroId);
  const baseShield = Math.max(1, 1 + hero.extraShield);

  return {
    moveSpeed: hero.moveScale,
    fireInterval: Math.max(0.18, 0.52 / hero.fireScale),
    shotDamage: Math.max(1, 1 + hero.damageBonus),
    multiShot: 1,
    dashCooldown: 4.8 * hero.dashScale,
    pickupRadius: 28,
    maxShield: baseShield,
    shield: baseShield,
  };
}

function resetRound(heroId: HeroId = "viper"): RoundState {
  return {
    heroId,
    playerX: CANVAS_WIDTH / 2,
    playerY: CANVAS_HEIGHT / 2,
    playerRadius: 12,
    enemies: [],
    projectiles: [],
    orbs: [],
    pickups: [],
    elapsed: 0,
    score: 0,
    spawnClock: 0,
    spawnedEnemies: 0,
    kills: 0,
    level: 1,
    xp: 0,
    xpToNext: 70,
    combo: 1,
    comboExpireAt: 0,
    bestCombo: 1,
    lastShotAt: 0,
    dashReadyAt: 0,
    dashingUntil: 0,
    dashDirX: 1,
    dashDirY: 0,
    invulnerableUntil: 0,
    powerCharge: 0,
    frenzyUntil: 0,
    stasisUntil: 0,
    nextEliteAt: randomInRange(30, 38),
    contractTarget: 0,
    contractProgress: 0,
    contractExpireAt: 0,
    nextContractAt: randomInRange(18, 26),
    build: createBaseBuild(heroId),
    upgrades: [],
  };
}

function formatContractLabel(round: RoundState): string {
  if (round.contractTarget <= 0) {
    return "No contract";
  }

  const timeLeft = Math.max(0, round.contractExpireAt - round.elapsed);
  return `Contract ${round.contractProgress}/${round.contractTarget} (${timeLeft.toFixed(0)}s)`;
}

function toLiveStats(round: RoundState): LiveStats {
  return {
    heroId: round.heroId,
    heroName: getHero(round.heroId).name,
    level: round.level,
    combo: round.combo,
    kills: round.kills,
    shields: round.build.shield,
    dashLeft: Math.max(0, round.dashReadyAt - round.elapsed),
    power: clamp(round.powerCharge, 0, 100),
    xp: round.xp,
    xpToNext: round.xpToNext,
    upgrades: round.upgrades.length,
    contractLabel: formatContractLabel(round),
  };
}

function createEnemy(elapsed: number, forcedElite = false): Enemy {
  const side = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;

  if (side === 0) {
    x = randomInRange(-35, CANVAS_WIDTH + 35);
    y = -42;
  } else if (side === 1) {
    x = CANVAS_WIDTH + 42;
    y = randomInRange(-35, CANVAS_HEIGHT + 35);
  } else if (side === 2) {
    x = randomInRange(-35, CANVAS_WIDTH + 35);
    y = CANVAS_HEIGHT + 42;
  } else {
    x = -42;
    y = randomInRange(-35, CANVAS_HEIGHT + 35);
  }

  const roll = Math.random();
  const shouldElite = forcedElite || (elapsed > 65 && roll < 0.07);
  const enemyType: EnemyType =
    shouldElite || (elapsed > 50 && roll < 0.2) ? "brute" : elapsed > 20 && roll < 0.48 ? "zigzag" : "runner";

  if (enemyType === "brute") {
    const eliteBoost = shouldElite ? 1.65 : 1;
    return {
      id: nextId(),
      x,
      y,
      radius: randomInRange(18, 24) * eliteBoost,
      baseSpeed: (randomInRange(49, 64) + elapsed * 1.1) * (shouldElite ? 1.08 : 1),
      hue: shouldElite ? 276 : 29,
      hp: shouldElite ? 12 : 6,
      maxHp: shouldElite ? 12 : 6,
      type: enemyType,
      wobble: randomInRange(0, Math.PI * 2),
      drift: randomInRange(0.2, 0.45),
      elite: shouldElite,
    };
  }

  if (enemyType === "zigzag") {
    return {
      id: nextId(),
      x,
      y,
      radius: randomInRange(12, 16),
      baseSpeed: randomInRange(82, 104) + elapsed * 2,
      hue: 194,
      hp: 3,
      maxHp: 3,
      type: enemyType,
      wobble: randomInRange(0, Math.PI * 2),
      drift: randomInRange(36, 56),
      elite: false,
    };
  }

  return {
    id: nextId(),
    x,
    y,
    radius: randomInRange(10, 14),
    baseSpeed: randomInRange(65, 90) + elapsed * 1.8,
    hue: 6,
    hp: 2,
    maxHp: 2,
    type: enemyType,
    wobble: randomInRange(0, Math.PI * 2),
    drift: randomInRange(0.2, 0.5),
    elite: false,
  };
}

function pickUpgradeChoices(): UpgradeDefinition[] {
  const pool = [...UPGRADE_POOL];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, 3);
}

function applyUpgrade(round: RoundState, id: UpgradeId): string {
  if (!round.upgrades.includes(id)) {
    round.upgrades.push(id);
  }

  if (id === "rapid_fire") {
    round.build.fireInterval = Math.max(0.14, round.build.fireInterval * 0.84);
  } else if (id === "power_shot") {
    round.build.shotDamage += 1;
  } else if (id === "speed_boost") {
    round.build.moveSpeed = Math.min(1.9, round.build.moveSpeed + 0.12);
  } else if (id === "multi_shot") {
    round.build.multiShot = Math.min(4, round.build.multiShot + 1);
  } else if (id === "dash_core") {
    round.build.dashCooldown = Math.max(2.1, round.build.dashCooldown * 0.84);
  } else if (id === "magnet") {
    round.build.pickupRadius = Math.min(240, round.build.pickupRadius + 30);
  }

  const def = UPGRADE_POOL.find((item) => item.id === id);
  return def?.title ?? "Upgrade";
}

function drawArenaBackground(ctx: CanvasRenderingContext2D): void {
  const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  gradient.addColorStop(0, "#111d31");
  gradient.addColorStop(1, "#07101c");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  for (let x = 0; x < CANVAS_WIDTH; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CANVAS_HEIGHT);
    ctx.stroke();
  }

  for (let y = 0; y < CANVAS_HEIGHT; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_WIDTH, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, CANVAS_WIDTH - 20, CANVAS_HEIGHT - 20);
}

function drawStick(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  facingX: number,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;

  const headY = y - radius * 1.45;
  ctx.beginPath();
  ctx.arc(x, headY, radius * 0.52, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x, headY + radius * 0.5);
  ctx.lineTo(x, y + radius * 0.8);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x - radius * 0.95, y - radius * 0.1);
  ctx.lineTo(x + radius * 0.95, y + radius * 0.05);
  ctx.stroke();

  const legDirection = Math.sign(facingX) || 1;
  ctx.beginPath();
  ctx.moveTo(x, y + radius * 0.8);
  ctx.lineTo(x - radius * 0.7, y + radius * 1.8);
  ctx.moveTo(x, y + radius * 0.8);
  ctx.lineTo(x + radius * 0.95 * legDirection, y + radius * 1.84);
  ctx.stroke();

  ctx.restore();
}

function drawHud(ctx: CanvasRenderingContext2D, phase: GamePhase, round: RoundState, paused: boolean, upgrading: boolean): void {
  ctx.fillStyle = "rgba(10, 16, 28, 0.74)";
  ctx.fillRect(20, 18, 360, 144);

  ctx.font = "700 17px 'Trebuchet MS', sans-serif";
  ctx.fillStyle = "#f5f8ff";
  ctx.fillText(`Score: ${Math.floor(round.score)}`, 32, 42);

  ctx.font = "500 12px 'Trebuchet MS', sans-serif";
  ctx.fillStyle = "#9fc2ff";
  ctx.fillText(`${getHero(round.heroId).name} | Time ${formatSeconds(round.elapsed)} | Kills ${round.kills}`, 32, 62);
  ctx.fillText(`Level ${round.level} | Combo x${round.combo}`, 32, 80);

  const progress = round.xpToNext > 0 ? clamp(round.xp / round.xpToNext, 0, 1) : 0;
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(32, 92, 222, 10);
  ctx.fillStyle = "#4bd9a8";
  ctx.fillRect(32, 92, 222 * progress, 10);
  ctx.strokeStyle = "rgba(255,255,255,0.26)";
  ctx.strokeRect(32, 92, 222, 10);

  ctx.fillStyle = "#cfe4ff";
  ctx.fillText(`XP ${round.xp}/${round.xpToNext}`, 264, 101);

  const dashText = round.dashReadyAt <= round.elapsed ? "Dash Ready" : `Dash ${Math.max(0, round.dashReadyAt - round.elapsed).toFixed(1)}s`;
  ctx.fillText(`Shield ${round.build.shield}/${round.build.maxShield} | ${dashText}`, 32, 117);

  const powerProgress = clamp(round.powerCharge / 100, 0, 1);
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fillRect(32, 124, 222, 10);
  ctx.fillStyle = "#ffb267";
  ctx.fillRect(32, 124, 222 * powerProgress, 10);
  ctx.strokeStyle = "rgba(255,255,255,0.26)";
  ctx.strokeRect(32, 124, 222, 10);
  ctx.fillStyle = "#ffd8a4";
  ctx.fillText(`Power ${Math.floor(round.powerCharge)}%`, 264, 133);

  if (round.contractTarget > 0) {
    const contractLeft = Math.max(0, round.contractExpireAt - round.elapsed).toFixed(0);
    ctx.fillStyle = "#a8d9ff";
    ctx.fillText(
      `Contract ${round.contractProgress}/${round.contractTarget} (${contractLeft}s)`,
      32,
      139,
    );
  }

  if (phase !== "playing") {
    ctx.fillStyle = "rgba(10, 16, 28, 0.68)";
    ctx.fillRect(CANVAS_WIDTH - 322, 20, 298, 84);
    ctx.fillStyle = "#f2f5ff";
    ctx.font = "700 17px 'Trebuchet MS', sans-serif";
    ctx.fillText("Stick Arena Party", CANVAS_WIDTH - 302, 46);
    ctx.fillStyle = "#8db2ff";
    ctx.font = "500 12px 'Trebuchet MS', sans-serif";
    ctx.fillText("Combat, upgrades, elites, and contracts.", CANVAS_WIDTH - 302, 67);
    ctx.fillText("Use E for hero power.", CANVAS_WIDTH - 302, 82);
  }

  if (paused || upgrading) {
    ctx.fillStyle = "rgba(10, 16, 28, 0.68)";
    ctx.fillRect(CANVAS_WIDTH - 298, CANVAS_HEIGHT - 58, 274, 34);
    ctx.fillStyle = "#ffd27a";
    ctx.font = "600 13px 'Trebuchet MS', sans-serif";
    ctx.fillText(paused ? "Paused" : "Upgrade selection active", CANVAS_WIDTH - 280, CANVAS_HEIGHT - 36);
  }
}

function findNearestEnemy(round: RoundState): Enemy | null {
  let nearest: Enemy | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const enemy of round.enemies) {
    const distance = Math.hypot(enemy.x - round.playerX, enemy.y - round.playerY);
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = enemy;
    }
  }

  return nearest;
}

function spawnVolley(round: RoundState): void {
  const target = findNearestEnemy(round);
  if (!target) {
    return;
  }

  const direction = normalize(target.x - round.playerX, target.y - round.playerY);
  const shotCount = Math.max(1, round.build.multiShot);
  const spreadStep = 0.14;

  for (let i = 0; i < shotCount; i += 1) {
    const offset = shotCount === 1 ? 0 : (i - (shotCount - 1) / 2) * spreadStep;
    const rotated = rotate(direction.x, direction.y, offset);

    round.projectiles.push({
      id: nextId(),
      x: round.playerX,
      y: round.playerY,
      vx: rotated.x * PROJECTILE_SPEED,
      vy: rotated.y * PROJECTILE_SPEED,
      ttl: PROJECTILE_TTL,
      damage: round.build.shotDamage,
      radius: 3.2,
    });
  }

  if (round.projectiles.length > 180) {
    round.projectiles.splice(0, round.projectiles.length - 180);
  }
}

function onEnemyDefeated(round: RoundState, enemy: Enemy): void {
  const comboActive = round.elapsed <= round.comboExpireAt;
  round.combo = comboActive ? Math.min(9, round.combo + 1) : 1;
  round.bestCombo = Math.max(round.bestCombo, round.combo);
  round.comboExpireAt = round.elapsed + COMBO_WINDOW_SECONDS;

  round.kills += 1;
  const baseScore = enemy.elite ? 86 : enemy.type === "brute" ? 40 : enemy.type === "zigzag" ? 27 : 19;
  const gainedScore = Math.floor(baseScore * (1 + (round.combo - 1) * 0.16));
  round.score += gainedScore;
  round.powerCharge = Math.min(
    100,
    round.powerCharge + (enemy.elite ? 28 : enemy.type === "brute" ? 18 : enemy.type === "zigzag" ? 12 : 8),
  );

  const orbXp = enemy.elite
    ? Math.floor(randomInRange(32, 46))
    : enemy.type === "brute"
      ? Math.floor(randomInRange(18, 28))
      : enemy.type === "zigzag"
        ? Math.floor(randomInRange(12, 18))
        : Math.floor(randomInRange(8, 14));
  round.orbs.push({
    id: nextId(),
    x: enemy.x,
    y: enemy.y,
    radius: enemy.elite ? 8.5 : enemy.type === "brute" ? 7 : 6,
    xp: orbXp,
    score: enemy.elite ? 22 : enemy.type === "brute" ? 14 : 8,
    ttl: 14,
  });

  if (round.contractTarget > 0) {
    round.contractProgress += 1;
  }

  const dropRoll = Math.random();
  if (enemy.elite || dropRoll < 0.08) {
    const kind: PickupKind = dropRoll < 0.028 ? "shield" : dropRoll < 0.056 ? "frenzy" : "stasis";
    round.pickups.push({
      id: nextId(),
      x: enemy.x,
      y: enemy.y,
      radius: 9,
      ttl: 15,
      kind,
    });
  }
}

function drawProjectile(ctx: CanvasRenderingContext2D, projectile: Projectile): void {
  ctx.save();
  ctx.fillStyle = "#ffd27a";
  ctx.beginPath();
  ctx.arc(projectile.x, projectile.y, projectile.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawOrb(ctx: CanvasRenderingContext2D, orb: Orb): void {
  ctx.save();
  ctx.fillStyle = "#74f5ff";
  ctx.beginPath();
  ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(116,245,255,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(orb.x, orb.y, orb.radius + 2.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawPickup(ctx: CanvasRenderingContext2D, pickup: Pickup): void {
  const color = pickup.kind === "shield" ? "#4bd9a8" : pickup.kind === "frenzy" ? "#ffb347" : "#86d9ff";
  const label = pickup.kind === "shield" ? "S" : pickup.kind === "frenzy" ? "F" : "T";

  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(pickup.x, pickup.y, pickup.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#0b1626";
  ctx.font = "700 11px 'Trebuchet MS', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, pickup.x, pickup.y + 0.5);
  ctx.restore();
}

export default function StickPartyGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const arenaShellRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const keyboardRef = useRef<KeyboardState>({
    up: false,
    down: false,
    left: false,
    right: false,
  });
  const pointerRef = useRef<PointerState>({
    active: false,
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT / 2,
  });
  const phaseRef = useRef<GamePhase>("home");
  const roundRef = useRef<RoundState>(resetRound("viper"));
  const profileRef = useRef<PlayerProfile | null>(null);
  const upgradeOpenRef = useRef(false);

  const adIntervalRef = useRef<number | null>(null);
  const adStartTimeoutRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<GamePhase>("home");
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [roundSummary, setRoundSummary] = useState<RoundSummary | null>(null);
  const [statusText, setStatusText] = useState<string>("");
  const [rewardStatus, setRewardStatus] = useState<RewardedStatus>(EMPTY_REWARDED_STATUS);
  const [isPaused, setIsPaused] = useState(false);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [upgradeChoices, setUpgradeChoices] = useState<UpgradeDefinition[]>([]);
  const [liveStats, setLiveStats] = useState<LiveStats>(LIVE_STATS_DEFAULT);
  const [selectedHero, setSelectedHero] = useState<HeroId>("viper");
  const [adState, setAdState] = useState<"idle" | "loading" | "showing">("idle");
  const [adCountdown, setAdCountdown] = useState(AD_DURATION_SECONDS);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [isFallbackFullscreen, setIsFallbackFullscreen] = useState(false);

  const rewardOdds = useMemo(() => rewardedTierOdds(), []);
  const isFullscreen = isNativeFullscreen || isFallbackFullscreen;

  const syncLiveStats = useCallback(() => {
    setLiveStats(toLiveStats(roundRef.current));
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const shell = arenaShellRef.current;
    if (!shell) {
      return;
    }

    const doc = document as FullscreenDocument;
    const currentFullscreenElement = getFullscreenElement(doc);
    if (currentFullscreenElement) {
      const exited = await exitNativeFullscreen(doc);
      if (!exited) {
        setIsFallbackFullscreen(false);
      }
      return;
    }

    if (isFallbackFullscreen) {
      setIsFallbackFullscreen(false);
      return;
    }

    const enteredNative = await requestNativeFullscreen(shell as FullscreenElement);
    if (!enteredNative) {
      setIsFallbackFullscreen(true);
      setStatusText("Fullscreen API is unavailable here. Immersive mode enabled.");
    }
  }, [isFallbackFullscreen]);

  const writeProfile = useCallback((updater: (current: PlayerProfile) => PlayerProfile): PlayerProfile | null => {
    const current = profileRef.current;
    if (!current) {
      return null;
    }

    const updated = saveProfile(updater(current));
    profileRef.current = updated;
    setProfile(updated);
    setRewardStatus(rewardedStatus(updated));
    return updated;
  }, []);

  const recordEvent = useCallback(
    (
      current: PlayerProfile,
      name: SessionEventName,
      payload: Record<string, number | string | boolean | null> = {},
    ): PlayerProfile => {
      const event: SessionEvent = {
        name,
        at: Date.now(),
        payload,
      };

      trackAnalyticsEvent(name, payload);
      return appendProfileEvent(current, event);
    },
    [],
  );

  const closeUpgradeSelection = useCallback(() => {
    upgradeOpenRef.current = false;
    setIsUpgradeOpen(false);
    setUpgradeChoices([]);
  }, []);

  const openUpgradeSelection = useCallback(() => {
    const choices = pickUpgradeChoices();
    upgradeOpenRef.current = true;
    setUpgradeChoices(choices);
    setIsUpgradeOpen(true);
    setStatusText("Level up. Choose one upgrade.");
  }, []);

  const handleRoundEnd = useCallback(
    (finalState: RoundState) => {
      const score = Math.floor(finalState.score);
      const survivalSeconds = Math.floor(finalState.elapsed);
      const rewards = calculateMatchReward(score);

      let summary: RoundSummary | null = null;
      writeProfile((current) => {
        const normalized = refreshDailyCounters(current);
        const nextBest = Math.max(normalized.bestScore, score);
        let updated: PlayerProfile = {
          ...normalized,
          lastScore: score,
          totalMatches: normalized.totalMatches + 1,
          totalPlaySeconds: normalized.totalPlaySeconds + survivalSeconds,
          bestScore: nextBest,
          credits: normalized.credits + rewards.credits,
          crystals: normalized.crystals + rewards.crystals,
        };

        updated = recordEvent(updated, "match_end", {
          score,
          survival_seconds: survivalSeconds,
          enemies_spawned: finalState.spawnedEnemies,
          kills: finalState.kills,
          level: finalState.level,
          reward_credits: rewards.credits,
          reward_crystals: rewards.crystals,
        });

        updated = recordEvent(updated, "rewarded_ad_offer_shown", {
          score,
          claims_left: rewardedStatus(updated).claimsLeftToday,
        });

        summary = {
          score,
          survivalSeconds,
          spawnedEnemies: finalState.spawnedEnemies,
          kills: finalState.kills,
          level: finalState.level,
          bestCombo: finalState.bestCombo,
          rewardCredits: rewards.credits,
          rewardCrystals: rewards.crystals,
          isBestScore: score >= nextBest,
        };

        return updated;
      });

      if (summary) {
        setRoundSummary(summary);
      }

      closeUpgradeSelection();
      setIsPaused(false);
      setStatusText("Match rewards applied. Optional bonus available.");
      setPhase("game_over");
      phaseRef.current = "game_over";
      setLiveStats(toLiveStats(finalState));
    },
    [closeUpgradeSelection, recordEvent, writeProfile],
  );

  const startMatch = useCallback(() => {
    const hero = getHero(selectedHero);
    const started = writeProfile((current) =>
      recordEvent(current, "match_start", { source: "menu", hero: hero.name }),
    );
    if (!started) {
      return;
    }

    const freshRound = resetRound(selectedHero);
    roundRef.current = freshRound;
    closeUpgradeSelection();

    setStatusText(`${hero.name} entered the arena. Build power and trigger hero skill with E.`);
    setRoundSummary(null);
    setIsPaused(false);
    setLiveStats(toLiveStats(freshRound));
    setPhase("playing");
    phaseRef.current = "playing";
  }, [closeUpgradeSelection, recordEvent, selectedHero, writeProfile]);

  const closeRewarded = useCallback(() => {
    if (adIntervalRef.current) {
      window.clearInterval(adIntervalRef.current);
      adIntervalRef.current = null;
    }

    if (adStartTimeoutRef.current) {
      window.clearTimeout(adStartTimeoutRef.current);
      adStartTimeoutRef.current = null;
    }

    setAdState("idle");
    setAdCountdown(AD_DURATION_SECONDS);
  }, []);

  const failRewarded = useCallback(
    (reason: string) => {
      writeProfile((current) => recordEvent(current, "rewarded_ad_failed", { reason }));
      setStatusText("Rewarded ad was not completed, so no bonus was granted.");
      closeRewarded();
    },
    [closeRewarded, recordEvent, writeProfile],
  );

  const completeRewarded = useCallback(() => {
    const grantedTier = rollRewardedBonus();
    let granted = false;

    writeProfile((current) => {
      const now = Date.now();
      const normalized = refreshDailyCounters(current, now);
      const currentStatus = rewardedStatus(normalized, now);

      if (!currentStatus.eligible) {
        return recordEvent(normalized, "rewarded_ad_failed", {
          reason: "ineligible_at_completion",
          claims_left: currentStatus.claimsLeftToday,
          cooldown_seconds: currentStatus.secondsUntilReady,
        });
      }

      granted = true;
      let updated: PlayerProfile = {
        ...normalized,
        credits: normalized.credits + grantedTier.credits,
        crystals: normalized.crystals + grantedTier.crystals,
        rewardedClaimsToday: normalized.rewardedClaimsToday + 1,
        rewardedLastClaimAt: now,
        rewardedLifetimeClaims: normalized.rewardedLifetimeClaims + 1,
      };

      updated = recordEvent(updated, "rewarded_ad_completed", {
        tier: grantedTier.id,
        credits: grantedTier.credits,
        crystals: grantedTier.crystals,
      });
      return updated;
    });

    if (granted) {
      setStatusText(
        `Reward completed: +${grantedTier.credits} credits and +${grantedTier.crystals} crystals.`,
      );
    } else {
      setStatusText("Rewarded completion could not be validated. No bonus granted.");
    }

    closeRewarded();
  }, [closeRewarded, recordEvent, writeProfile]);

  const startRewardedFlow = useCallback(() => {
    if (adState !== "idle") {
      return;
    }

    const currentProfile = profileRef.current;
    if (!currentProfile) {
      return;
    }

    const status = rewardedStatus(currentProfile);
    if (!status.eligible) {
      setRewardStatus(status);
      setStatusText(rewardedAvailabilityText(status));
      return;
    }

    writeProfile((current) =>
      recordEvent(current, "rewarded_ad_attempt", {
        claims_left_before: status.claimsLeftToday,
      }),
    );

    setStatusText("Loading rewarded break...");
    setAdState("loading");
    setAdCountdown(AD_DURATION_SECONDS);

    adStartTimeoutRef.current = window.setTimeout(() => {
      setAdState("showing");
      setStatusText("Ad is in progress. Reward only applies on full completion.");
      adIntervalRef.current = window.setInterval(() => {
        setAdCountdown((remaining) => {
          if (remaining <= 1) {
            if (adIntervalRef.current) {
              window.clearInterval(adIntervalRef.current);
              adIntervalRef.current = null;
            }
            completeRewarded();
            return 0;
          }

          return remaining - 1;
        });
      }, 1000);
    }, 800);
  }, [adState, completeRewarded, recordEvent, writeProfile]);

  const saveNickname = useCallback(() => {
    const trimmed = nicknameDraft.trim().slice(0, 24);
    if (!trimmed) {
      setStatusText("Nickname cannot be empty.");
      return;
    }

    writeProfile((current) => ({
      ...current,
      nickname: trimmed,
    }));

    setStatusText("Profile nickname updated.");
  }, [nicknameDraft, writeProfile]);

  const chooseUpgrade = useCallback(
    (upgradeId: UpgradeId) => {
      if (!upgradeOpenRef.current || phaseRef.current !== "playing") {
        return;
      }

      const round = roundRef.current;
      const title = applyUpgrade(round, upgradeId);
      closeUpgradeSelection();
      syncLiveStats();
      setStatusText(`${title} activated.`);
    },
    [closeUpgradeSelection, syncLiveStats],
  );

  const triggerDash = useCallback(() => {
    if (phaseRef.current !== "playing" || isPaused || upgradeOpenRef.current) {
      return;
    }

    const round = roundRef.current;
    const cooldownLeft = round.dashReadyAt - round.elapsed;
    if (cooldownLeft > 0) {
      setStatusText(`Dash cooldown ${cooldownLeft.toFixed(1)}s.`);
      return;
    }

    let dx = 0;
    let dy = 0;

    if (pointerRef.current.active) {
      dx = pointerRef.current.x - round.playerX;
      dy = pointerRef.current.y - round.playerY;
    } else {
      if (keyboardRef.current.left) {
        dx -= 1;
      }
      if (keyboardRef.current.right) {
        dx += 1;
      }
      if (keyboardRef.current.up) {
        dy -= 1;
      }
      if (keyboardRef.current.down) {
        dy += 1;
      }

      if (dx === 0 && dy === 0) {
        const nearest = findNearestEnemy(round);
        if (nearest) {
          dx = round.playerX - nearest.x;
          dy = round.playerY - nearest.y;
        } else {
          dx = 1;
          dy = 0;
        }
      }
    }

    const direction = normalize(dx, dy);
    round.dashDirX = direction.x || 1;
    round.dashDirY = direction.y;
    round.dashingUntil = round.elapsed + DASH_DURATION_SECONDS;
    round.invulnerableUntil = Math.max(round.invulnerableUntil, round.elapsed + DASH_DURATION_SECONDS * 1.05);
    round.dashReadyAt = round.elapsed + round.build.dashCooldown;

    syncLiveStats();
  }, [isPaused, syncLiveStats]);

  const triggerHeroPower = useCallback(() => {
    if (phaseRef.current !== "playing" || isPaused || upgradeOpenRef.current) {
      return;
    }

    const round = roundRef.current;
    if (round.powerCharge < 100) {
      setStatusText(`Power charging: ${Math.floor(round.powerCharge)}%.`);
      return;
    }

    const hero = getHero(round.heroId);
    if (hero.id === "viper") {
      round.frenzyUntil = Math.max(round.frenzyUntil, round.elapsed + 6.5);
      round.dashingUntil = round.elapsed + 0.44;
      round.invulnerableUntil = Math.max(round.invulnerableUntil, round.elapsed + 0.85);

      for (let i = round.enemies.length - 1; i >= 0; i -= 1) {
        const enemy = round.enemies[i];
        const distance = Math.hypot(enemy.x - round.playerX, enemy.y - round.playerY);
        if (distance > 132) {
          continue;
        }

        enemy.hp -= enemy.elite ? 6 : 9;
        if (enemy.hp <= 0) {
          onEnemyDefeated(round, enemy);
          round.enemies.splice(i, 1);
        }
      }
      setStatusText("Blade Storm active: dash burst and frenzy engaged.");
    } else if (hero.id === "titan") {
      round.build.shield = round.build.maxShield;
      round.invulnerableUntil = Math.max(round.invulnerableUntil, round.elapsed + 3.1);
      round.stasisUntil = Math.max(round.stasisUntil, round.elapsed + 1.3);
      setStatusText("Fortress Guard: shields restored and damage immunity active.");
    } else if (hero.id === "nova") {
      const totalShots = 22;
      for (let i = 0; i < totalShots; i += 1) {
        const angle = (Math.PI * 2 * i) / totalShots;
        round.projectiles.push({
          id: nextId(),
          x: round.playerX,
          y: round.playerY,
          vx: Math.cos(angle) * PROJECTILE_SPEED * 1.18,
          vy: Math.sin(angle) * PROJECTILE_SPEED * 1.18,
          ttl: 1.05,
          damage: round.build.shotDamage + 2,
          radius: 3.4,
        });
      }
      round.frenzyUntil = Math.max(round.frenzyUntil, round.elapsed + 3.5);
      setStatusText("Solar Ring unleashed: radial burst fired.");
    } else {
      round.stasisUntil = Math.max(round.stasisUntil, round.elapsed + 5.1);
      const targetIds = [...round.enemies]
        .sort(
          (a, b) =>
            Math.hypot(a.x - round.playerX, a.y - round.playerY) -
            Math.hypot(b.x - round.playerX, b.y - round.playerY),
        )
        .slice(0, 6)
        .map((enemy) => enemy.id);

      for (const targetId of targetIds) {
        const enemyIndex = round.enemies.findIndex((enemy) => enemy.id === targetId);
        if (enemyIndex < 0) {
          continue;
        }

        const enemy = round.enemies[enemyIndex];
        enemy.hp -= enemy.elite ? 10 : 999;
        if (enemy.hp <= 0) {
          onEnemyDefeated(round, enemy);
          round.enemies.splice(enemyIndex, 1);
        }
      }
      setStatusText("Arc Storm released: target zaps and field freeze.");
    }

    round.powerCharge = 0;
    syncLiveStats();
  }, [isPaused, syncLiveStats]);

  useEffect(() => {
    const loaded = loadProfile();
    const withLogin = recordEvent(loaded, "login", { mode: "guest_profile" });
    const saved = saveProfile(withLogin);

    profileRef.current = saved;
    const initializationTimer = window.setTimeout(() => {
      setProfile(saved);
      setRewardStatus(rewardedStatus(saved));
      setNicknameDraft(saved.nickname);
    }, 0);

    return () => {
      window.clearTimeout(initializationTimer);
    };
  }, [recordEvent]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const current = profileRef.current;
      if (!current) {
        return;
      }

      setRewardStatus(rewardedStatus(current));
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const telemetryInterval = window.setInterval(() => {
      if (phaseRef.current !== "playing") {
        return;
      }

      syncLiveStats();
    }, 140);

    return () => {
      window.clearInterval(telemetryInterval);
    };
  }, [syncLiveStats]);

  useEffect(() => {
    const doc = document as FullscreenDocument;
    const handleNativeFullscreenChange = (): void => {
      const active = Boolean(getFullscreenElement(doc));
      setIsNativeFullscreen(active);
      if (active) {
        setIsFallbackFullscreen(false);
      }
    };

    handleNativeFullscreenChange();
    document.addEventListener("fullscreenchange", handleNativeFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleNativeFullscreenChange as EventListener);

    return () => {
      document.removeEventListener("fullscreenchange", handleNativeFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleNativeFullscreenChange as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!isFallbackFullscreen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isFallbackFullscreen]);

  useEffect(() => {
    const handleDown = (event: KeyboardEvent): void => {
      const key = event.key.toLowerCase();
      if (isTextEntryTarget(event.target)) {
        return;
      }

      if (key === "f" && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        void toggleFullscreen();
        return;
      }

      if (event.key === "Escape" && isFallbackFullscreen) {
        setIsFallbackFullscreen(false);
        return;
      }

      if (upgradeOpenRef.current && ["1", "2", "3"].includes(key)) {
        const index = Number(key) - 1;
        const picked = upgradeChoices[index];
        if (picked) {
          chooseUpgrade(picked.id);
        }
        return;
      }

      if (event.key === "Shift" && phaseRef.current === "playing") {
        event.preventDefault();
        triggerDash();
        return;
      }

      if (key === "e" && phaseRef.current === "playing") {
        event.preventDefault();
        triggerHeroPower();
        return;
      }

      if (event.key === "ArrowUp" || key === "w") {
        keyboardRef.current.up = true;
      }

      if (event.key === "ArrowDown" || key === "s") {
        keyboardRef.current.down = true;
      }

      if (event.key === "ArrowLeft" || key === "a") {
        keyboardRef.current.left = true;
      }

      if (event.key === "ArrowRight" || key === "d") {
        keyboardRef.current.right = true;
      }

      if (event.key === " " && phaseRef.current !== "playing") {
        event.preventDefault();
        startMatch();
      }

      if (key === "p" && phaseRef.current === "playing" && !upgradeOpenRef.current) {
        setIsPaused((current) => !current);
      }
    };

    const handleUp = (event: KeyboardEvent): void => {
      const key = event.key.toLowerCase();
      if (event.key === "ArrowUp" || key === "w") {
        keyboardRef.current.up = false;
      }

      if (event.key === "ArrowDown" || key === "s") {
        keyboardRef.current.down = false;
      }

      if (event.key === "ArrowLeft" || key === "a") {
        keyboardRef.current.left = false;
      }

      if (event.key === "ArrowRight" || key === "d") {
        keyboardRef.current.right = false;
      }
    };

    window.addEventListener("keydown", handleDown);
    window.addEventListener("keyup", handleUp);

    return () => {
      window.removeEventListener("keydown", handleDown);
      window.removeEventListener("keyup", handleUp);
    };
  }, [chooseUpgrade, isFallbackFullscreen, startMatch, toggleFullscreen, triggerDash, triggerHeroPower, upgradeChoices]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    let lastTick = performance.now();

    const run = (time: number): void => {
      const delta = Math.min(0.05, (time - lastTick) / 1000);
      lastTick = time;

      const phaseNow = phaseRef.current;
      const round = roundRef.current;

      const simulating = phaseNow === "playing" && !isPaused && !upgradeOpenRef.current;
      if (simulating) {
        round.elapsed += delta;
        round.spawnClock += delta;
        round.powerCharge = Math.min(100, round.powerCharge + delta * 3.6);

        round.score += delta * (9 + round.level * 1.6 + round.elapsed * 0.25);

        if (round.contractTarget <= 0 && round.elapsed >= round.nextContractAt) {
          round.contractTarget = Math.floor(randomInRange(8, 13));
          round.contractProgress = 0;
          round.contractExpireAt = round.elapsed + randomInRange(17, 21);
          round.nextContractAt = round.elapsed + randomInRange(30, 42);
          setStatusText(`Bounty Contract: defeat ${round.contractTarget} enemies before time runs out.`);
        }

        if (round.contractTarget > 0 && round.elapsed > round.contractExpireAt) {
          round.contractTarget = 0;
          round.contractProgress = 0;
          setStatusText("Contract failed. Stay alive for the next offer.");
        }

        if (round.contractTarget > 0 && round.contractProgress >= round.contractTarget) {
          const contractReward = 180 + round.level * 32;
          round.score += contractReward;
          round.build.shield = Math.min(round.build.maxShield, round.build.shield + 1);
          round.powerCharge = Math.min(100, round.powerCharge + 28);
          round.contractTarget = 0;
          round.contractProgress = 0;
          setStatusText(`Contract complete: +${contractReward} score and shield restored.`);
        }

        if (round.elapsed >= round.nextEliteAt) {
          round.enemies.push(createEnemy(round.elapsed, true));
          round.spawnedEnemies += 1;
          round.nextEliteAt += randomInRange(30, 38);
          setStatusText("Elite wave incoming.");
        }

        const spawnDelay = clamp(START_SPAWN_DELAY - round.elapsed * 0.018, MIN_SPAWN_DELAY, START_SPAWN_DELAY);
        if (round.spawnClock >= spawnDelay) {
          round.spawnClock = 0;
          round.enemies.push(createEnemy(round.elapsed));
          round.spawnedEnemies += 1;

          if (round.enemies.length > 95) {
            round.enemies.splice(0, round.enemies.length - 95);
          }
        }

        let dx = 0;
        let dy = 0;
        if (keyboardRef.current.left) {
          dx -= 1;
        }
        if (keyboardRef.current.right) {
          dx += 1;
        }
        if (keyboardRef.current.up) {
          dy -= 1;
        }
        if (keyboardRef.current.down) {
          dy += 1;
        }

        if (pointerRef.current.active) {
          const pointerVector = normalize(pointerRef.current.x - round.playerX, pointerRef.current.y - round.playerY);
          dx = pointerVector.x;
          dy = pointerVector.y;
        } else {
          const keyboardVector = normalize(dx, dy);
          dx = keyboardVector.x;
          dy = keyboardVector.y;
        }

        if (dx !== 0 || dy !== 0) {
          round.dashDirX = dx;
          round.dashDirY = dy;
        }

        const dashing = round.elapsed < round.dashingUntil;
        const moveX = dashing ? round.dashDirX : dx;
        const moveY = dashing ? round.dashDirY : dy;
        const moveSpeed = PLAYER_SPEED * round.build.moveSpeed * (dashing ? DASH_MULTIPLIER : 1);

        round.playerX = clamp(round.playerX + moveX * moveSpeed * delta, 18, CANVAS_WIDTH - 18);
        round.playerY = clamp(round.playerY + moveY * moveSpeed * delta, 18, CANVAS_HEIGHT - 18);

        const frenzyScale = round.frenzyUntil > round.elapsed ? 0.68 : 1;
        const fireDelay = Math.max(0.12, round.build.fireInterval * frenzyScale);
        if (round.enemies.length > 0 && round.elapsed - round.lastShotAt >= fireDelay) {
          spawnVolley(round);
          round.lastShotAt = round.elapsed;
        }

        const stasisScale = round.stasisUntil > round.elapsed ? 0.63 : 1;

        for (let enemyIndex = round.enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
          const enemy = round.enemies[enemyIndex];
          const direction = normalize(round.playerX - enemy.x, round.playerY - enemy.y);
          enemy.wobble += delta * (enemy.type === "zigzag" ? 8.4 : 5.4);

          const typeScale = enemy.type === "brute" ? 0.76 : enemy.type === "zigzag" ? 1.08 : 1;
          const speed = (enemy.baseSpeed + round.elapsed * 2.2) * typeScale * stasisScale;
          enemy.x += direction.x * speed * delta;
          enemy.y += direction.y * speed * delta;

          if (enemy.type === "zigzag") {
            const sideX = -direction.y;
            const sideY = direction.x;
            const driftPower = Math.sin(enemy.wobble) * enemy.drift;
            enemy.x += sideX * driftPower * delta;
            enemy.y += sideY * driftPower * delta;
          }

          const collisionDistance = enemy.radius + round.playerRadius;
          const distance = Math.hypot(enemy.x - round.playerX, enemy.y - round.playerY);
          if (distance < collisionDistance) {
            if (round.elapsed <= round.invulnerableUntil) {
              continue;
            }

            if (round.build.shield > 0) {
              round.build.shield -= 1;
              round.invulnerableUntil = round.elapsed + 1;
              round.enemies.splice(enemyIndex, 1);
              continue;
            }

            handleRoundEnd({ ...round, enemies: [...round.enemies] });
            roundRef.current = resetRound(round.heroId);
            break;
          }
        }

        for (let projectileIndex = round.projectiles.length - 1; projectileIndex >= 0; projectileIndex -= 1) {
          const projectile = round.projectiles[projectileIndex];
          projectile.x += projectile.vx * delta;
          projectile.y += projectile.vy * delta;
          projectile.ttl -= delta;

          const outOfBounds =
            projectile.x < -20 ||
            projectile.x > CANVAS_WIDTH + 20 ||
            projectile.y < -20 ||
            projectile.y > CANVAS_HEIGHT + 20;
          if (projectile.ttl <= 0 || outOfBounds) {
            round.projectiles.splice(projectileIndex, 1);
            continue;
          }

          for (let enemyIndex = round.enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
            const enemy = round.enemies[enemyIndex];
            const hitDistance = projectile.radius + enemy.radius;
            const distance = Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y);
            if (distance > hitDistance) {
              continue;
            }

            enemy.hp -= projectile.damage;
            if (enemy.hp <= 0) {
              onEnemyDefeated(round, enemy);
              round.enemies.splice(enemyIndex, 1);
            }

            round.projectiles.splice(projectileIndex, 1);
            break;
          }
        }

        const pickupRadius = round.build.pickupRadius;
        for (let orbIndex = round.orbs.length - 1; orbIndex >= 0; orbIndex -= 1) {
          const orb = round.orbs[orbIndex];
          orb.ttl -= delta;
          if (orb.ttl <= 0) {
            round.orbs.splice(orbIndex, 1);
            continue;
          }

          const dxToPlayer = round.playerX - orb.x;
          const dyToPlayer = round.playerY - orb.y;
          const distance = Math.hypot(dxToPlayer, dyToPlayer);

          if (distance < pickupRadius + round.playerRadius) {
            round.xp += orb.xp;
            round.score += orb.score;
            round.orbs.splice(orbIndex, 1);
            continue;
          }

          if (distance < pickupRadius * 3) {
            const pullVector = normalize(dxToPlayer, dyToPlayer);
            const pullSpeed = clamp(92 + (pickupRadius - distance) * 0.9, 60, 280);
            orb.x += pullVector.x * pullSpeed * delta;
            orb.y += pullVector.y * pullSpeed * delta;
          }
        }

        for (let pickupIndex = round.pickups.length - 1; pickupIndex >= 0; pickupIndex -= 1) {
          const pickup = round.pickups[pickupIndex];
          pickup.ttl -= delta;
          if (pickup.ttl <= 0) {
            round.pickups.splice(pickupIndex, 1);
            continue;
          }

          const distance = Math.hypot(pickup.x - round.playerX, pickup.y - round.playerY);
          if (distance > pickup.radius + round.playerRadius + 2) {
            continue;
          }

          if (pickup.kind === "shield") {
            round.build.shield = Math.min(round.build.maxShield, round.build.shield + 1);
          } else if (pickup.kind === "frenzy") {
            round.frenzyUntil = Math.max(round.frenzyUntil, round.elapsed + 8);
          } else {
            round.stasisUntil = Math.max(round.stasisUntil, round.elapsed + 6.5);
          }

          round.pickups.splice(pickupIndex, 1);
        }

        if (round.elapsed > round.comboExpireAt) {
          round.combo = 1;
        }

        if (round.xp >= round.xpToNext) {
          round.xp -= round.xpToNext;
          round.level += 1;
          round.xpToNext = Math.floor(round.xpToNext * 1.22 + 16);
          openUpgradeSelection();
        }
      }

      drawArenaBackground(context);
      const drawState = roundRef.current;

      for (const orb of drawState.orbs) {
        drawOrb(context, orb);
      }

      for (const pickup of drawState.pickups) {
        drawPickup(context, pickup);
      }

      for (const projectile of drawState.projectiles) {
        drawProjectile(context, projectile);
      }

      for (const enemy of drawState.enemies) {
        const color = enemy.elite ? "#c39cff" : `hsl(${enemy.hue} 90% 63%)`;
        drawStick(context, enemy.x, enemy.y, enemy.radius, color, drawState.playerX - enemy.x);

        const hpWidth = enemy.radius * 1.8;
        const hpRatio = clamp(enemy.hp / enemy.maxHp, 0, 1);
        context.fillStyle = "rgba(3,8,16,0.7)";
        context.fillRect(enemy.x - hpWidth / 2, enemy.y - enemy.radius - 12, hpWidth, 4);
        context.fillStyle = enemy.elite ? "#c39cff" : "#ffcb72";
        context.fillRect(enemy.x - hpWidth / 2, enemy.y - enemy.radius - 12, hpWidth * hpRatio, 4);
      }

      const playerInvulnerable = drawState.elapsed <= drawState.invulnerableUntil;
      const playerColor = playerInvulnerable
        ? "#ffe3a1"
        : phaseNow === "playing"
          ? getHero(drawState.heroId).color
          : "#89c2ff";
      drawStick(
        context,
        drawState.playerX,
        drawState.playerY,
        drawState.playerRadius,
        playerColor,
        pointerRef.current.active ? pointerRef.current.x - drawState.playerX : drawState.dashDirX,
      );

      drawHud(context, phaseNow, drawState, isPaused, upgradeOpenRef.current);

      animationFrameRef.current = window.requestAnimationFrame(run);
    };

    animationFrameRef.current = window.requestAnimationFrame(run);

    return () => {
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [handleRoundEnd, isPaused, openUpgradeSelection]);

  useEffect(() => {
    return () => {
      closeRewarded();
    };
  }, [closeRewarded]);

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    pointerRef.current = {
      active: true,
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const claimsInfo = rewardedAvailabilityText(rewardStatus);
  const dashReady = liveStats.dashLeft <= 0.01;
  const powerReady = liveStats.power >= 99.5;
  const selectedHeroDef = getHero(selectedHero);
  const activeHeroDef = getHero(liveStats.heroId);

  return (
    <section className="game-screen">
      <div className="game-stats-banner">
        <div className="stat-chip">
          <span>Credits</span>
          <strong>{formatInt(profile?.credits ?? 0)}</strong>
        </div>
        <div className="stat-chip">
          <span>Crystals</span>
          <strong>{formatInt(profile?.crystals ?? 0)}</strong>
        </div>
        <div className="stat-chip">
          <span>Best Score</span>
          <strong>{formatInt(profile?.bestScore ?? 0)}</strong>
        </div>
        <div className="stat-chip">
          <span>Total Matches</span>
          <strong>{formatInt(profile?.totalMatches ?? 0)}</strong>
        </div>
      </div>

      <div className="game-toolbar">
        <p className="muted">
          Hero system live: unique power per character, elite waves, and bounty contracts for burst rewards.
        </p>
        <div className="toolbar-pills" aria-label="Live run telemetry">
          <span className="status-pill">{liveStats.heroName}</span>
          <span className="status-pill">Lvl {liveStats.level}</span>
          <span className="status-pill">Combo x{liveStats.combo}</span>
          <span className="status-pill">Kills {liveStats.kills}</span>
          <span className="status-pill">Shields {liveStats.shields}</span>
          <span className="status-pill">Power {Math.floor(liveStats.power)}%</span>
          <span className="status-pill">Upgrades {liveStats.upgrades}</span>
          <span className="status-pill contract-pill">{liveStats.contractLabel}</span>
        </div>
      </div>

      <div className="game-toolbar compact-toolbar">
        <p className="muted">
          Controls: WASD/Arrows move, Shift dash, E hero power, F fullscreen, P pause. Mobile: drag + on-screen controls.
        </p>
        <button
          type="button"
          className="ghost-btn"
          onClick={() => {
            void toggleFullscreen();
          }}
          aria-pressed={isFullscreen}
        >
          {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        </button>
      </div>

      <div
        ref={arenaShellRef}
        className={`arena-shell${isFallbackFullscreen ? " fullscreen-fallback" : ""}`}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="game-canvas"
          onPointerDown={handlePointerMove}
          onPointerMove={(event) => {
            if (event.buttons > 0) {
              handlePointerMove(event);
            }
          }}
          onPointerUp={() => {
            pointerRef.current.active = false;
          }}
          onPointerLeave={() => {
            pointerRef.current.active = false;
          }}
        />

        {phase === "home" ? (
          <div className="overlay-card">
            <h2>Stick Arena Party</h2>
            <p>
              Pick a hero with a unique style, then survive evolving waves with contracts, elites, and build upgrades.
            </p>
            <div className="hero-picker">
              {HERO_POOL.map((hero) => (
                <button
                  key={hero.id}
                  type="button"
                  className={`hero-card${selectedHero === hero.id ? " active" : ""}`}
                  onClick={() => {
                    setSelectedHero(hero.id);
                    setLiveStats((current) => ({
                      ...current,
                      heroId: hero.id,
                      heroName: hero.name,
                      shields: 1 + hero.extraShield,
                      power: 0,
                      contractLabel: "No contract",
                    }));
                  }}
                >
                  <span className="hero-role">{hero.role}</span>
                  <strong style={{ color: hero.color }}>{hero.name}</strong>
                  <small>{hero.description}</small>
                </button>
              ))}
            </div>
            <ul>
              <li>Fight runner, zigzag, brute, and elite enemies.</li>
              <li>Collect XP orbs, clear bounty contracts, and level your build.</li>
              <li>Use dash + hero power to survive late-wave pressure.</li>
            </ul>
            <div className="inline-actions">
              <button type="button" className="primary-btn" onClick={startMatch}>
                Start Match as {selectedHeroDef.name}
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={() =>
                  setStatusText(
                    "Tip: Finish contracts fast for score spikes and save hero power for elite waves.",
                  )
                }
              >
                Strategy Tip
              </button>
            </div>
            <small>Selected: {selectedHeroDef.name} ({selectedHeroDef.role}) | Quick start: Space</small>
          </div>
        ) : null}

        {phase === "playing" && isPaused ? (
          <div className="overlay-card compact">
            <h2>Paused</h2>
            <p>Press P again or tap Resume to continue.</p>
            <button type="button" className="primary-btn" onClick={() => setIsPaused(false)}>
              Resume
            </button>
          </div>
        ) : null}

        {phase === "playing" && isUpgradeOpen ? (
          <div className="overlay-card upgrade">
            <h2>Upgrade Time</h2>
            <p>Choose one upgrade and continue the run.</p>
            <div className="upgrade-grid">
              {upgradeChoices.map((choice, index) => (
                <button
                  key={choice.id}
                  type="button"
                  className="upgrade-btn"
                  onClick={() => chooseUpgrade(choice.id)}
                >
                  <span className="upgrade-key">{index + 1}</span>
                  <strong>{choice.title}</strong>
                  <small>{choice.description}</small>
                </button>
              ))}
            </div>
            <small>Keyboard quick select: 1, 2, 3</small>
          </div>
        ) : null}

        {phase === "game_over" && roundSummary ? (
          <div className="overlay-card results">
            <h2>Game Over</h2>
            <div className="result-grid">
              <p>
                Score <strong>{formatInt(roundSummary.score)}</strong>
              </p>
              <p>
                Survived <strong>{formatSeconds(roundSummary.survivalSeconds)}</strong>
              </p>
              <p>
                Kills <strong>{formatInt(roundSummary.kills)}</strong>
              </p>
              <p>
                Level reached <strong>{formatInt(roundSummary.level)}</strong>
              </p>
              <p>
                Best combo <strong>x{formatInt(roundSummary.bestCombo)}</strong>
              </p>
              <p>
                Threats spawned <strong>{formatInt(roundSummary.spawnedEnemies)}</strong>
              </p>
              <p>
                Match reward <strong>+{formatInt(roundSummary.rewardCredits)} credits</strong>
              </p>
              <p>
                Match crystals <strong>+{formatInt(roundSummary.rewardCrystals)}</strong>
              </p>
              {roundSummary.isBestScore ? <p className="highlight">New personal best.</p> : null}
            </div>

            <div className="rewarded-box">
              <h3>Optional Rewarded Bonus</h3>
              <p>{claimsInfo}</p>
              <ul>
                {rewardOdds.map((tier) => (
                  <li key={tier.id}>
                    {tier.chancePercent}% chance: +{tier.credits} credits, +{tier.crystals} crystals
                  </li>
                ))}
              </ul>
              <div className="inline-actions">
                <button
                  type="button"
                  className="primary-btn"
                  onClick={startRewardedFlow}
                  disabled={!rewardStatus.eligible || adState !== "idle"}
                >
                  Watch Rewarded Ad for Bonus
                </button>
                <button type="button" className="ghost-btn" onClick={startMatch}>
                  Play Again
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {adState !== "idle" ? (
          <div className="ad-overlay">
            <div className="ad-modal">
              <h3>{adState === "loading" ? "Loading Rewarded Ad" : "Rewarded Ad In Progress"}</h3>
              <p>
                {adState === "loading"
                  ? "Preparing ad session..."
                  : `Do not close if you want the reward. ${adCountdown}s remaining.`}
              </p>
              {adState === "showing" ? (
                <div className="inline-actions">
                  <button type="button" className="ghost-btn" onClick={() => failRewarded("user_closed")}>
                    Close Ad
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="arena-controls">
          <button
            type="button"
            className={`ghost-btn control-btn power-btn ${powerReady ? "ready" : "cooling"}`}
            onClick={triggerHeroPower}
            disabled={phase !== "playing" || isPaused || isUpgradeOpen}
          >
            {powerReady ? `${activeHeroDef.name} Power` : `Power ${Math.floor(liveStats.power)}%`}
          </button>
          <button
            type="button"
            className={`ghost-btn control-btn ${dashReady ? "ready" : "cooling"}`}
            onClick={triggerDash}
            disabled={phase !== "playing" || isPaused || isUpgradeOpen}
          >
            {dashReady ? "Dash" : `Dash ${liveStats.dashLeft.toFixed(1)}s`}
          </button>
          <button
            type="button"
            className="ghost-btn control-btn fullscreen-btn"
            onClick={() => {
              void toggleFullscreen();
            }}
            aria-pressed={isFullscreen}
          >
            {isFullscreen ? "Exit Full" : "Fullscreen"}
          </button>
        </div>
      </div>

      <div className="game-meta-grid">
        <section className="meta-card">
          <h3>Player Profile</h3>
          <p>
            Profile ID: <code>{profile?.id ?? "loading"}</code>
          </p>
          <div className="nickname-row">
            <input
              type="text"
              value={nicknameDraft}
              maxLength={24}
              onChange={(event) => setNicknameDraft(event.target.value)}
              placeholder="Nickname"
            />
            <button type="button" className="ghost-btn" onClick={saveNickname}>
              Save
            </button>
          </div>
          <p>
            Last score: <strong>{formatInt(profile?.lastScore ?? 0)}</strong>
          </p>
          <p>
            Rewarded lifetime claims: <strong>{formatInt(profile?.rewardedLifetimeClaims ?? 0)}</strong>
          </p>
          <p className="muted">
            Guest profile is stored in browser local storage. Cloud auth/save can be connected later without changing
            gameplay flow.
          </p>
        </section>

        <section className="meta-card">
          <h3>Run Intel</h3>
          <p>{statusText || "Ready."}</p>
          <p className="muted">Active hero: {activeHeroDef.name}</p>
          <p className="muted">
            XP progress: {liveStats.xp}/{liveStats.xpToNext}
          </p>
          <p className="muted">Power charge: {Math.floor(liveStats.power)}%</p>
          <p className="muted">Contract: {liveStats.contractLabel}</p>
          <p className="muted">
            Policy-ready behavior: rewards only on completion, no reward on close/fail, optional ad placement only on
            Game Over.
          </p>
          <div className="inline-actions">
            <button
              type="button"
              className="ghost-btn"
              onClick={() => {
                writeProfile((current) => ({ ...current, eventLog: [] }));
                setStatusText("Local event log cleared.");
              }}
            >
              Clear Event Log
            </button>
            <a className="ghost-btn anchor" href="/updates">
              View Patch Notes
            </a>
          </div>

          <div className="event-log">
            {(profile?.eventLog ?? []).slice(-8).reverse().map((entry) => (
              <div key={`${entry.name}-${entry.at}`} className="event-log-row">
                <span>{entry.name}</span>
                <time>{new Date(entry.at).toLocaleTimeString()}</time>
              </div>
            ))}
            {(profile?.eventLog ?? []).length === 0 ? <p className="muted">No local analytics events yet.</p> : null}
          </div>
        </section>
      </div>
    </section>
  );
}
