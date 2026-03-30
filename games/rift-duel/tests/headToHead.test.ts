import { describe, expect, it } from "vitest";
import { MATRIX_STRATEGY_IDS, playHeadToHead } from "../src/headToHead.js";

describe("playHeadToHead", () => {
  it("kończy się zwycięzcą dla spike vs turtle (kilka seedów)", () => {
    for (const seed of [42, 99, 12345]) {
      const r = playHeadToHead(seed, "spike", "turtle");
      expect(r.aborted).toBe(false);
      expect(r.winner === "p0" || r.winner === "p1").toBe(true);
      expect(r.steps).toBeGreaterThan(10);
    }
  });

  it("wszystkie macierzowe strategie vs spike — brak abort", () => {
    for (const s of MATRIX_STRATEGY_IDS) {
      const r = playHeadToHead(50_000 + MATRIX_STRATEGY_IDS.indexOf(s) * 31, s, "spike");
      expect(r.aborted, s).toBe(false);
    }
  });
});
