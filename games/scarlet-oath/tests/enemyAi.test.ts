import { describe, expect, it } from "vitest";
import { pickGreedyAction, simulateGreedyVersus } from "../src/enemyAi.js";
import { applyAction, checkWinCondition, createInitialState, getValidActions } from "../src/rules.js";

describe("scarlet-oath enemyAi", () => {
  it("simulateGreedyVersus kończy się bez abortu", () => {
    for (const seed of [0, 1, 7, 42, 99, 12345]) {
      const r = simulateGreedyVersus(seed, 2000);
      expect(r.aborted).toBe(false);
      expect(r.steps).toBeGreaterThan(0);
    }
  });

  it("pickGreedyAction zawsze zwraca legalną akcję", () => {
    let s = createInitialState(5);
    for (let i = 0; i < 200 && checkWinCondition(s).status === "ongoing"; i++) {
      const a = pickGreedyAction(s);
      const v = getValidActions(s);
      const ok = v.some((x) => {
        if (x.type !== a.type) return false;
        if (a.type === "MOVE" && x.type === "MOVE") return x.dir === a.dir;
        return true;
      });
      expect(ok).toBe(true);
      s = applyAction(s, a);
    }
  });
});
