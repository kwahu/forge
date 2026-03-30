import { describe, expect, it } from "vitest";
import { applyAction, createInitialState, getValidActions } from "../src/rules.js";
import { pickBotAction, type BotStrategyId } from "../src/botStrategies.js";

function actionsEqual(a: import("../src/types.js").GameAction, b: import("../src/types.js").GameAction): boolean {
  if (a.type !== b.type) return false;
  if (a.slot !== b.slot) return false;
  return a.dir === b.dir;
}

describe("drift-front botStrategies", () => {
  it("pickBotAction zwraca legalną akcję (wszystkie strategie)", () => {
    const sim = 999;
    const strategies: BotStrategyId[] = ["spike", "aggro", "turtle", "random"];
    let state = createInitialState(5);
    for (let step = 0; step < 24; step++) {
      const acts = getValidActions(state);
      if (acts.length === 0) break;
      const me = state.activePlayerId;
      for (const strat of strategies) {
        const pick = pickBotAction(state, step, me, sim, strat);
        expect(acts.some((a) => actionsEqual(a, pick))).toBe(true);
      }
      state = applyAction(state, pickBotAction(state, step, me, sim, "spike"));
    }
  });
});
