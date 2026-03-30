/**
 * Jedna lub wiele partii Deepspire z prostym botem (metryki FORGE / playtest).
 */
import {
  applyAction,
  checkWinCondition,
  createInitialState,
  pickSimpleBotAction,
} from "../src/rules.js";

const seed = Number(process.argv[2] ?? "42");
const runs = Number(process.argv[3] ?? "20");

let wins = 0;
let deaths = 0;
let totalTurns = 0;

for (let r = 0; r < runs; r++) {
  const s0 = seed + r * 9973;
  let s = createInitialState(s0);
  let steps = 0;
  const maxSteps = 25_000;
  while (checkWinCondition(s).status === "ongoing" && steps < maxSteps) {
    const a = pickSimpleBotAction(s);
    s = applyAction(s, a);
    steps++;
  }
  const end = checkWinCondition(s);
  if (end.status === "ended") {
    if (end.outcome === "victory") wins++;
    else deaths++;
  }
  totalTurns += steps;
}

console.log(
  JSON.stringify(
    {
      runs,
      seedStart: seed,
      wins,
      deaths,
      avgTurns: runs ? totalTurns / runs : 0,
    },
    null,
    2,
  ),
);
