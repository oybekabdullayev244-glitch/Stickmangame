export type SessionEventName =
  | "login"
  | "match_start"
  | "match_end"
  | "rewarded_ad_offer_shown"
  | "rewarded_ad_attempt"
  | "rewarded_ad_completed"
  | "rewarded_ad_failed";

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
  eventLog: SessionEvent[];
}

export const PROFILE_STORAGE_KEY = "stickparty.profile.v1";
const MAX_EVENT_LOG = 120;

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
    eventLog: [],
  };
}

export function refreshDailyCounters(profile: PlayerProfile, now = Date.now()): PlayerProfile {
  const today = localDayKey(now);
  if (profile.rewardedDay === today) {
    return profile;
  }

  return {
    ...profile,
    rewardedDay: today,
    rewardedClaimsToday: 0,
  };
}

export function normalizeProfile(candidate: unknown, now = Date.now()): PlayerProfile {
  const base = createDefaultProfile(now);
  if (!candidate || typeof candidate !== "object") {
    return base;
  }

  const draft = candidate as Partial<PlayerProfile>;
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
