/**
 * Krótka symulacja bot-vs-bot: losowy legalny ruch z deterministycznego PRNG kroku.
 */
import { applyAction, checkWinCondition, createInitialState, getValidActions } from "../src/rules.js";
import { randomInt } from "../src/rng.js";

const seed = Number(process.argv[2] ?? 12345);
const maxSteps = Number(process.argv[3] ?? 5000);

let state = createInitialState(seed);
let step = 0;
let counter = 0;

while (checkWinCondition(state).status === "ongoing" && step < maxSteps) {
  const acts = getValidActions(state);
  if (acts.length === 0) break;
  const pick = randomInt(seed, counter, acts.length);
  counter = pick.nextCounter;
  state = applyAction(state, acts[pick.value]!);
  step++;
}

const end = checkWinCondition(state);
console.log(JSON.stringify({ seed, steps: step, result: end, halfTurnIndex: state.halfTurnIndex }, null, 2));
