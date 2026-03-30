import { describe, expect, it } from "vitest";
import { playHeadToHead } from "../src/headToHead.js";

/**
 * Regresja po zmianach `pickBotAction` / zasad: znane seede + oczekiwany zwycięzca (FORGE §6.4).
 * Przy świadomej zmianie balansu — zaktualizuj tablicę i wpisz w DESIGN_HISTORY.
 */
const SPIKE_VS_AGGRO: { seed: number; winner: "p0" | "p1"; steps: number }[] = [
  { seed: 1, winner: "p1", steps: 25 },
  { seed: 2, winner: "p0", steps: 25 },
  { seed: 42, winner: "p1", steps: 25 },
  { seed: 100, winner: "p0", steps: 25 },
  { seed: 1337, winner: "p1", steps: 25 },
];

describe("golden seeds", () => {
  it("spike (p0) vs aggro (p1) — deterministyczny wynik", () => {
    for (const g of SPIKE_VS_AGGRO) {
      const r = playHeadToHead(g.seed, "spike", "aggro");
      expect(r.aborted, `seed ${g.seed}`).toBe(false);
      expect(r.winner, `seed ${g.seed}`).toBe(g.winner);
      expect(r.steps, `seed ${g.seed}`).toBe(g.steps);
    }
  });

  it("turtle (p0) vs spike (p1) — partia się kończy (brak pętli 512)", () => {
    const r = playHeadToHead(42, "turtle", "spike");
    expect(r.aborted).toBe(false);
    expect(r.winner).toBe("p0");
    expect(r.steps).toBeLessThan(400);
  });
});
