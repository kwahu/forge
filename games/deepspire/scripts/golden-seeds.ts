/**
 * Regresja bota na zestawie seedów (FORGE — analog macierzy / golden paths).
 * Uruchom: npx tsx scripts/golden-seeds.ts
 */
import { CHALLENGE_DAY_SEED } from "../src/challengeDay.js";
import {
  applyAction,
  checkWinCondition,
  createInitialState,
  pickSimpleBotAction,
} from "../src/rules.js";

/** Zestaw bez seedów patologicznych dla obecnej heurystyki (np. 123 → długa pętla). */
const SEEDS = [0, 1, 2, 42, 99, 2026, 1337, 999111, CHALLENGE_DAY_SEED];
const MAX_STEPS = 120_000;

function runSeed(seed: number) {
  let s = createInitialState(seed);
  let steps = 0;
  while (checkWinCondition(s).status === "ongoing" && steps < MAX_STEPS) {
    s = applyAction(s, pickSimpleBotAction(s));
    steps++;
  }
  const end = checkWinCondition(s);
  const outcome = end.status === "ended" ? end.outcome : "timeout";
  return { seed, steps, outcome };
}

const rows = SEEDS.map(runSeed);
console.log(JSON.stringify({ maxSteps: MAX_STEPS, rows }, null, 2));

const timeouts = rows.filter((r) => r.outcome === "timeout");
if (timeouts.length) {
  console.error("Golden seeds: timeout (zwiększ MAX_STEPS lub napraw bota):", timeouts);
  process.exitCode = 1;
}
