import { PlayerProfile, refreshDailyCounters } from "@/lib/profile";

export interface CurrencyReward {
  credits: number;
  crystals: number;
}

export interface RewardTier extends CurrencyReward {
  id: string;
  weight: number;
}

export interface RewardTierOdds extends RewardTier {
  chancePercent: number;
}

export interface RewardedStatus {
  eligible: boolean;
  claimsLeftToday: number;
  secondsUntilReady: number;
  reason: "none" | "daily_cap" | "cooldown" | "clock_guard";
}

export const MATCH_CREDITS_BASE = 10;
export const MATCH_CREDITS_MAX = 130;
export const MATCH_CRYSTAL_STEP = 70;
export const MATCH_CRYSTALS_MAX = 4;

export const REWARDED_COOLDOWN_SECONDS = 150;
export const REWARDED_DAILY_CAP = 8;

const REWARDED_TIERS: RewardTier[] = [
  { id: "small", credits: 80, crystals: 1, weight: 52 },
  { id: "medium", credits: 130, crystals: 2, weight: 33 },
  { id: "large", credits: 210, crystals: 3, weight: 15 },
];

export function calculateMatchReward(score: number): CurrencyReward {
  const cleanScore = Math.max(0, Math.floor(score));
  const credits = Math.min(MATCH_CREDITS_MAX, MATCH_CREDITS_BASE + Math.floor(cleanScore * 0.58));
  const crystals = Math.min(MATCH_CRYSTALS_MAX, Math.floor(cleanScore / MATCH_CRYSTAL_STEP));

  return { credits, crystals };
}

export function rewardedTierOdds(): RewardTierOdds[] {
  const totalWeight = REWARDED_TIERS.reduce((acc, tier) => acc + tier.weight, 0);

  return REWARDED_TIERS.map((tier) => ({
    ...tier,
    chancePercent: Number(((tier.weight / totalWeight) * 100).toFixed(2)),
  }));
}

export function rewardedStatus(profile: PlayerProfile, now = Date.now()): RewardedStatus {
  const normalized = refreshDailyCounters(profile, now);

  const claimsLeftToday = Math.max(0, REWARDED_DAILY_CAP - normalized.rewardedClaimsToday);
  if (claimsLeftToday <= 0) {
    return {
      eligible: false,
      claimsLeftToday,
      secondsUntilReady: 0,
      reason: "daily_cap",
    };
  }

  if (normalized.rewardedLastClaimAt > now + 30_000) {
    return {
      eligible: false,
      claimsLeftToday,
      secondsUntilReady: REWARDED_COOLDOWN_SECONDS,
      reason: "clock_guard",
    };
  }

  const nextReadyAt = normalized.rewardedLastClaimAt + REWARDED_COOLDOWN_SECONDS * 1_000;
  const secondsUntilReady = Math.max(0, Math.ceil((nextReadyAt - now) / 1_000));

  if (secondsUntilReady > 0) {
    return {
      eligible: false,
      claimsLeftToday,
      secondsUntilReady,
      reason: "cooldown",
    };
  }

  return {
    eligible: true,
    claimsLeftToday,
    secondsUntilReady: 0,
    reason: "none",
  };
}

export function rollRewardedBonus(randomValue = Math.random()): RewardTier {
  const totalWeight = REWARDED_TIERS.reduce((acc, tier) => acc + tier.weight, 0);
  const threshold = Math.max(0, Math.min(0.999999, randomValue)) * totalWeight;

  let cursor = 0;
  for (const tier of REWARDED_TIERS) {
    cursor += tier.weight;
    if (threshold < cursor) {
      return tier;
    }
  }

  return REWARDED_TIERS[REWARDED_TIERS.length - 1];
}

export function rewardedAvailabilityText(status: RewardedStatus): string {
  if (status.eligible) {
    return `Ready. ${status.claimsLeftToday} claim(s) left today.`;
  }

  if (status.reason === "daily_cap") {
    return "Daily rewarded limit reached. Come back tomorrow.";
  }

  if (status.reason === "clock_guard") {
    return "Device clock changed. Wait a bit before trying again.";
  }

  return `Rewarded cooldown: ${status.secondsUntilReady}s`;
}
