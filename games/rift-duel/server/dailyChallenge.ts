/**
 * Wyzwanie dnia — deterministyczny seed i strategia bota z daty (UTC YYYY-MM-DD).
 */
import type { BotStrategyId } from "../src/botStrategies.js";

const DAILY_STRATEGIES: BotStrategyId[] = ["spike", "aggro", "turtle", "disruptor", "timmy"];

export function isoDateUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function hashStringToUint32(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function dailyChallengeForDay(isoDate: string): {
  date: string;
  seed: number;
  botStrategy: BotStrategyId;
} {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new Error("invalid_iso_date");
  }
  const h = hashStringToUint32(`rift-duel-daily|${isoDate}`);
  const seed = h >>> 0;
  const botStrategy = DAILY_STRATEGIES[h % DAILY_STRATEGIES.length]!;
  return { date: isoDate, seed, botStrategy };
}
