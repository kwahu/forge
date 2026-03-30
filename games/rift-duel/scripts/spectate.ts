/**
 * Jedna partia bot vs bot z transkryptem w terminalu (bez serwera).
 * Uruchom: npm run spectate -- --seed=123
 */
import {
  applyAction,
  checkWinCondition,
  createInitialState,
  getValidActions,
} from "../src/rules.js";
import { CARD_META } from "../src/cards.js";
import type { CardId, GameAction, GameState } from "../src/types.js";
import { randomInt } from "../src/rng.js";

function parseArgs() {
  const out = { seed: 42 };
  for (const a of process.argv.slice(2)) {
    const s = a.match(/^--seed=(\d+)$/);
    if (s) out.seed = parseInt(s[1], 10);
  }
  return out;
}

function pickAction(state: GameState, simSeed: number, step: number): GameAction {
  const acts = getValidActions(state);
  const { value } = randomInt(simSeed, step, acts.length);
  return acts[value]!;
}

function describeAction(state: GameState, act: GameAction): string {
  const pid = state.activePlayerId;
  if (act.type === "END_TURN") return `${pid} END_TURN`;
  const card = state.players[pid].hand[act.handIndex];
  if (!card) return `${pid} PLAY ?`;
  const meta = CARD_META[card];
  return `${pid} PLAY [${act.handIndex}] ${card} (${meta.name})`;
}

function snapshot(state: GameState): string {
  const { p0, p1 } = state.players;
  return `p0 HP ${p0.hp} ward ${p0.ward} hand ${p0.hand.length} deck ${p0.deck.length} | p1 HP ${p1.hp} ward ${p1.ward} hand ${p1.hand.length} deck ${p1.deck.length}`;
}

const { seed } = parseArgs();
const simSeed = seed * 0x1a2b3c4d;
let s = createInitialState(seed);

console.log(`=== Rift Duel spectate | seed=${seed} | contentVersion=0.7.3 ===\n`);
console.log(`Start: ${snapshot(s)}\n`);

let step = 0;
while (checkWinCondition(s).status === "ongoing" && step < 20_000) {
  const act = pickAction(s, simSeed, step);
  const line = describeAction(s, act);
  s = applyAction(s, act);
  console.log(`${String(step + 1).padStart(4)}  ${line}`);
  console.log(`      ${snapshot(s)}`);
  step++;
}

const w = checkWinCondition(s);
console.log("");
if (w.status === "ended") {
  console.log(`Wynik: wygrywa ${w.winner} po ${step} akcjach.`);
} else {
  console.log("Brak wyniku (limit kroków).");
}
