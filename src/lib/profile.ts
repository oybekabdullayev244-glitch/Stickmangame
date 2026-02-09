export type SessionEventName =
  | "login"
  | "match_start"
  | "match_end"
  | "rewarded_ad_offer_shown"
  | "rewarded_ad_attempt"
  | "rewarded_ad_completed"
  | "rewarded_ad_failed"
  | "mission_claimed"
  | "weapon_unlocked"
  | "meta_upgrade_purchased";

export type WeaponId = "pulse" | "scatter" | "lance";

export interface DailyMissionProgress {
  kills: number;
  survivalSeconds: number;
  matches: number;
}

export interface MetaUpgradeLevels {
  armor: number;
  agility: number;
  reactor: number;
}

export interface LeaderboardEntry {
  score: number;
  survivalSeconds: number;
  kills: number;
  hero: string;
  weapon: WeaponId;
  at: number;
}

export interface SessionEvent {
  name: SessionEventName;
  at: number;
  payload: Record<string, number | string | boolean | null>;
}

export interface PlayerProfile {
  id: string;
  nickname: string;
  createdAt: number;
  updatedAt: number;
  totalMatches: number;
  totalPlaySeconds: number;
  bestScore: number;
  lastScore: number;
  credits: number;
  crystals: number;
  rewardedClaimsToday: number;
  rewardedDay: string;
  rewardedLastClaimAt: number;
  rewardedLifetimeClaims: number;
  selectedWeapon: WeaponId;
  unlockedWeapons: WeaponId[];
  metaUpgrades: MetaUpgradeLevels;
  dailyMissionDay: string;
  dailyMissionProgress: DailyMissionProgress;
  dailyMissionClaimed: string[];
  leaderboard: LeaderboardEntry[];
  tutorialSeen: boolean;
  eventLog: SessionEvent[];
}

export const PROFILE_STORAGE_KEY = "stickparty.profile.v1";
const MAX_EVENT_LOG = 120;
const MAX_LEADERBOARD_ROWS = 15;
const WEAPON_IDS: WeaponId[] = ["pulse", "scatter", "lance"];

function safeInteger(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.floor(parsed));
}

function safeText(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const cleaned = value.trim().slice(0, 24);
  return cleaned.length > 0 ? cleaned : fallback;
}

function safeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
}

function normalizeWeaponId(value: unknown, fallback: WeaponId): WeaponId {
  if (typeof value === "string" && WEAPON_IDS.includes(value as WeaponId)) {
    return value as WeaponId;
  }

  return fallback;
}

function normalizeWeaponList(value: unknown): WeaponId[] {
  if (!Array.isArray(value)) {
    return ["pulse"];
  }

  const picked = value
    .filter((entry): entry is string => typeof entry === "string")
    .filter((entry): entry is WeaponId => WEAPON_IDS.includes(entry as WeaponId));

  const unique = Array.from(new Set(picked));
  if (!unique.includes("pulse")) {
    unique.unshift("pulse");
  }
  return unique;
}

function normalizeMetaUpgrades(value: unknown): MetaUpgradeLevels {
  const candidate = value && typeof value === "object" ? (value as Partial<MetaUpgradeLevels>) : {};
  return {
    armor: Math.min(7, safeInteger(candidate.armor)),
    agility: Math.min(7, safeInteger(candidate.agility)),
    reactor: Math.min(7, safeInteger(candidate.reactor)),
  };
}

function normalizeMissionProgress(value: unknown): DailyMissionProgress {
  const candidate = value && typeof value === "object" ? (value as Partial<DailyMissionProgress>) : {};
  return {
    kills: safeInteger(candidate.kills),
    survivalSeconds: safeInteger(candidate.survivalSeconds),
    matches: safeInteger(candidate.matches),
  };
}

function normalizeMissionClaimed(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .slice(0, 32),
    ),
  );
}

function clampLeaderboard(value: unknown): LeaderboardEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Partial<LeaderboardEntry> => Boolean(entry && typeof entry === "object"))
    .map((entry) => ({
      score: safeInteger(entry.score),
      survivalSeconds: safeInteger(entry.survivalSeconds),
      kills: safeInteger(entry.kills),
      hero: safeText(entry.hero, "Unknown"),
      weapon: normalizeWeaponId(entry.weapon, "pulse"),
      at: safeInteger(entry.at),
    }))
    .sort((a, b) => b.score - a.score || b.survivalSeconds - a.survivalSeconds)
    .slice(0, MAX_LEADERBOARD_ROWS);
}

function clampEventList(value: unknown): SessionEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is SessionEvent => {
      if (!entry || typeof entry !== "object") {
        return false;
      }

      const maybeName = (entry as SessionEvent).name;
      return typeof maybeName === "string";
    })
    .slice(-MAX_EVENT_LOG)
    .map((entry) => ({
      name: entry.name,
      at: safeInteger(entry.at),
      payload: entry.payload && typeof entry.payload === "object" ? entry.payload : {},
    }));
}

function createGuestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function localDayKey(timestamp = Date.now()): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createDefaultProfile(now = Date.now()): PlayerProfile {
  const today = localDayKey(now);

  return {
    id: createGuestId(),
    nickname: "Guest Fighter",
    createdAt: now,
    updatedAt: now,
    totalMatches: 0,
    totalPlaySeconds: 0,
    bestScore: 0,
    lastScore: 0,
    credits: 0,
    crystals: 0,
    rewardedClaimsToday: 0,
    rewardedDay: today,
    rewardedLastClaimAt: 0,
    rewardedLifetimeClaims: 0,
    selectedWeapon: "pulse",
    unlockedWeapons: ["pulse"],
    metaUpgrades: {
      armor: 0,
      agility: 0,
      reactor: 0,
    },
    dailyMissionDay: today,
    dailyMissionProgress: {
      kills: 0,
      survivalSeconds: 0,
      matches: 0,
    },
    dailyMissionClaimed: [],
    leaderboard: [],
    tutorialSeen: false,
    eventLog: [],
  };
}

export function refreshDailyCounters(profile: PlayerProfile, now = Date.now()): PlayerProfile {
  const today = localDayKey(now);
  let next = profile;

  if (next.rewardedDay !== today) {
    next = {
      ...next,
      rewardedDay: today,
      rewardedClaimsToday: 0,
    };
  }

  if (next.dailyMissionDay !== today) {
    next = {
      ...next,
      dailyMissionDay: today,
      dailyMissionProgress: {
        kills: 0,
        survivalSeconds: 0,
        matches: 0,
      },
      dailyMissionClaimed: [],
    };
  }

  return next;
}

export function normalizeProfile(candidate: unknown, now = Date.now()): PlayerProfile {
  const base = createDefaultProfile(now);
  if (!candidate || typeof candidate !== "object") {
    return base;
  }

  const draft = candidate as Partial<PlayerProfile>;
  const unlockedWeapons = normalizeWeaponList(draft.unlockedWeapons);
  const selectedWeapon = normalizeWeaponId(draft.selectedWeapon, base.selectedWeapon);
  const normalized: PlayerProfile = {
    ...base,
    id: safeText(draft.id, base.id),
    nickname: safeText(draft.nickname, base.nickname),
    createdAt: safeInteger(draft.createdAt, base.createdAt),
    updatedAt: safeInteger(draft.updatedAt, now),
    totalMatches: safeInteger(draft.totalMatches),
    totalPlaySeconds: safeInteger(draft.totalPlaySeconds),
    bestScore: safeInteger(draft.bestScore),
    lastScore: safeInteger(draft.lastScore),
    credits: safeInteger(draft.credits),
    crystals: safeInteger(draft.crystals),
    rewardedClaimsToday: safeInteger(draft.rewardedClaimsToday),
    rewardedDay: safeText(draft.rewardedDay, base.rewardedDay),
    rewardedLastClaimAt: safeInteger(draft.rewardedLastClaimAt),
    rewardedLifetimeClaims: safeInteger(draft.rewardedLifetimeClaims),
    selectedWeapon: unlockedWeapons.includes(selectedWeapon) ? selectedWeapon : unlockedWeapons[0] ?? "pulse",
    unlockedWeapons,
    metaUpgrades: normalizeMetaUpgrades(draft.metaUpgrades),
    dailyMissionDay: safeText(draft.dailyMissionDay, base.dailyMissionDay),
    dailyMissionProgress: normalizeMissionProgress(draft.dailyMissionProgress),
    dailyMissionClaimed: normalizeMissionClaimed(draft.dailyMissionClaimed),
    leaderboard: clampLeaderboard(draft.leaderboard),
    tutorialSeen: safeBoolean(draft.tutorialSeen),
    eventLog: clampEventList(draft.eventLog),
  };

  return refreshDailyCounters(normalized, now);
}

export function loadProfile(now = Date.now()): PlayerProfile {
  if (typeof window === "undefined") {
    return createDefaultProfile(now);
  }

  const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!raw) {
    const fresh = createDefaultProfile(now);
    saveProfile(fresh);
    return fresh;
  }

  try {
    const parsed = JSON.parse(raw);
    const normalized = normalizeProfile(parsed, now);
    saveProfile(normalized);
    return normalized;
  } catch {
    const fallback = createDefaultProfile(now);
    saveProfile(fallback);
    return fallback;
  }
}

export function saveProfile(profile: PlayerProfile): PlayerProfile {
  const next = {
    ...profile,
    updatedAt: Date.now(),
    leaderboard: profile.leaderboard.slice(0, MAX_LEADERBOARD_ROWS),
    eventLog: profile.eventLog.slice(-MAX_EVENT_LOG),
  };

  if (typeof window !== "undefined") {
    window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(next));
  }

  return next;
}

export function appendProfileEvent(
  profile: PlayerProfile,
  event: SessionEvent,
): PlayerProfile {
  return {
    ...profile,
    eventLog: [...profile.eventLog, event].slice(-MAX_EVENT_LOG),
  };
}
