/**
 * Metryka balansu: greedy vs greedy, rozkład zwycięstw po seedach (FORGE: dane > opinie).
 * Uruchom: npx tsx scripts/balance-matrix.ts
 */
import { simulateGreedyVersus } from "../src/enemyAi.js";

const N = 800;
let p0 = 0;
let p1 = 0;
let totalSteps = 0;
for (let seed = 0; seed < N; seed++) {
  const r = simulateGreedyVersus(seed, 8000);
  if (r.winner === "p0") p0++;
  else p1++;
  totalSteps += r.steps;
}
console.log(`Szkarłatna przysięga — greedy vs greedy (${N} seedów)`);
console.log(`p0 wins: ${p0} (${((100 * p0) / N).toFixed(1)}%)`);
console.log(`p1 wins: ${p1} (${((100 * p1) / N).toFixed(1)}%)`);
console.log(`avg steps: ${(totalSteps / N).toFixed(1)}`);
