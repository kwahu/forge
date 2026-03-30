import { describe, expect, it } from "vitest";
import { createInitialState, getValidActions, applyAction, checkWinCondition } from "../src/rules.js";
import {
  BOT_STRATEGY_IDS,
  isBotStrategyId,
  parseBotStrategyId,
  pickBotAction,
} from "../src/botStrategies.js";
import { playHeadToHead } from "../src/headToHead.js";
import type { GameAction } from "../src/types.js";

function actionsEqual(a: GameAction, b: GameAction): boolean {
  if (a.type === "END_TURN" && b.type === "END_TURN") return true;
  if (a.type === "PLAY_CARD" && b.type === "PLAY_CARD") return a.handIndex === b.handIndex;
  return false;
}

describe("botStrategies", () => {
  it("parses and validates ids", () => {
    expect(parseBotStrategyId("spike", "random")).toBe("spike");
    expect(parseBotStrategyId("nope", "turtle")).toBe("turtle");
    expect(isBotStrategyId("aggro")).toBe(true);
    expect(isBotStrategyId("")).toBe(false);
    expect(BOT_STRATEGY_IDS.length).toBeGreaterThanOrEqual(6);
  });

  it.each(BOT_STRATEGY_IDS)("pickBotAction returns a legal move (%s)", (strategy) => {
    let state = createInitialState(12345);
    for (let step = 0; step < 40; step++) {
      const me = state.activePlayerId;
      const acts = getValidActions(state);
      if (acts.length === 0) break;
      const a = pickBotAction(state, step, me, 0xdeadbeef, strategy);
      const ok = acts.some((x) => actionsEqual(x, a));
      expect(ok, JSON.stringify({ strategy, a, acts })).toBe(true);
      state = applyAction(state, a);
      if (checkWinCondition(state).status === "ended") break;
    }
  });

  it("playHeadToHead: random vs spike kończy partię", () => {
    const r = playHeadToHead(777, "random", "spike");
    expect(r.aborted).toBe(false);
  });
});
