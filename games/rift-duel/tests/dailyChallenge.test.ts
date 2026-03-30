import { describe, expect, it } from "vitest";
import { dailyChallengeForDay, hashStringToUint32, isoDateUtc } from "../server/dailyChallenge.js";

describe("dailyChallenge", () => {
  it("isoDateUtc returns YYYY-MM-DD", () => {
    const d = new Date("2026-03-15T12:00:00.000Z");
    expect(isoDateUtc(d)).toBe("2026-03-15");
  });

  it("dailyChallengeForDay is stable for same date", () => {
    const a = dailyChallengeForDay("2026-03-29");
    const b = dailyChallengeForDay("2026-03-29");
    expect(a).toEqual(b);
    expect(a.date).toBe("2026-03-29");
    expect(typeof a.seed).toBe("number");
    expect(["spike", "aggro", "turtle", "disruptor", "timmy"]).toContain(a.botStrategy);
  });

  it("different dates get different seeds", () => {
    const x = dailyChallengeForDay("2026-01-01");
    const y = dailyChallengeForDay("2026-01-02");
    expect(x.seed).not.toBe(y.seed);
  });

  it("hashStringToUint32 is deterministic", () => {
    expect(hashStringToUint32("rift-duel-daily|2026-03-29")).toBe(hashStringToUint32("rift-duel-daily|2026-03-29"));
  });

  it("rejects invalid iso date", () => {
    expect(() => dailyChallengeForDay("29-03-2026")).toThrow();
  });
});
