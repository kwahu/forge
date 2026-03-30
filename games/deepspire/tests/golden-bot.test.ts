import { describe, expect, it } from "vitest";
import { CHALLENGE_DAY_SEED } from "../src/challengeDay.js";
import {
  applyAction,
  checkWinCondition,
  createInitialState,
  pickSimpleBotAction,
} from "../src/rules.js";

const GOLDEN_SEEDS = [0, 1, 42, 2026, 1337, CHALLENGE_DAY_SEED];
const MAX_STEPS = 120_000;

function runBotToEnd(seed: number) {
  let s = createInitialState(seed);
  let steps = 0;
  while (checkWinCondition(s).status === "ongoing" && steps < MAX_STEPS) {
    s = applyAction(s, pickSimpleBotAction(s));
    steps++;
  }
  return { steps, end: checkWinCondition(s) };
}

describe(
  "golden seeds — bot kończy grę (wygrana lub śmierć)",
  { timeout: 120_000 },
  () => {
    it.each(GOLDEN_SEEDS)("seed %i", (seed) => {
      const { steps, end } = runBotToEnd(seed);
      expect(end.status).toBe("ended");
      expect(steps).toBeLessThan(MAX_STEPS);
    });
  },
);
