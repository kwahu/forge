/**
 * Krótka symulacja heurystyki greedy (obie strony).
 * Uruchom: npm run simulate
 */
import { simulateGreedyVersus } from "../src/enemyAi.js";

const seeds = [0, 1, 2, 3, 4, 42, 99, 100];
console.log("Scarlet Oath — simulateGreedyVersus");
for (const seed of seeds) {
  const r = simulateGreedyVersus(seed, 5000);
  console.log(`seed=${seed} winner=${r.winner} steps=${r.steps} aborted=${r.aborted}`);
}
