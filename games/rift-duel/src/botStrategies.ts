/**
 * Heurystyki bota (vertical slice + playtest archetypów).
 * Jedno źródło prawdy: serwer, skrypt archetype-playtest, przyszły simulate.
 */
import { applyAction, checkWinCondition, getValidActions } from "./rules.js";
import { randomInt } from "./rng.js";
import type { CardId, GameAction, GameState, PlayerId } from "./types.js";

export const BOT_STRATEGY_IDS = [
  "random",
  "spike",
  "aggro",
  "turtle",
  "disruptor",
  "timmy",
] as const;

export type BotStrategyId = (typeof BOT_STRATEGY_IDS)[number];

export const DEFAULT_BOT_STRATEGY: BotStrategyId = "random";

export function isBotStrategyId(s: string): s is BotStrategyId {
  return (BOT_STRATEGY_IDS as readonly string[]).includes(s);
}

export function parseBotStrategyId(raw: unknown, fallback: BotStrategyId = DEFAULT_BOT_STRATEGY): BotStrategyId {
  if (typeof raw === "string" && isBotStrategyId(raw)) return raw;
  return fallback;
}

/** Metadane pod API / UI (UX + onboarding). */
export const BOT_STRATEGIES_FOR_API: {
  id: BotStrategyId;
  labelPl: string;
  hintPl: string;
}[] = [
  {
    id: "random",
    labelPl: "Losowy",
    hintPl: "Chaos — dobry do obserwacji, słaby do treningu taktyki.",
  },
  {
    id: "spike",
    labelPl: "Spike",
    hintPl: "Szuka lethal i mocnych kart; najlepszy domyślny trening 1v1.",
  },
  {
    id: "aggro",
    labelPl: "Agresor",
    hintPl: "Priorytet obrażeń — szybkie tempo.",
  },
  {
    id: "turtle",
    labelPl: "Obrońca",
    hintPl: "Leczenie i tarcze przed atakiem.",
  },
  {
    id: "disruptor",
    labelPl: "Kontrola",
    hintPl: "Leech gdy przeciwnik ma karty; potem obrażenia.",
  },
  {
    id: "timmy",
    labelPl: "Timmy",
    hintPl: "Duże liczby (surge, brace) — efektownie, bywa ryzykownie.",
  },
];

function opp(p: PlayerId): PlayerId {
  return p === "p0" ? "p1" : "p0";
}

function cardAt(state: GameState, me: PlayerId, action: GameAction): CardId | null {
  if (action.type !== "PLAY_CARD") return null;
  return state.players[me].hand[action.handIndex] ?? null;
}

function effectiveFace(raw: number, ward: number): number {
  return Math.max(0, raw - ward);
}

function spikeCardValue(card: CardId, state: GameState, me: PlayerId): number {
  const o = opp(me);
  const other = state.players[o];
  const my = state.players[me];
  const w = other.ward;
  switch (card) {
    case "surge":
      return effectiveFace(5, w) * 4 + Math.min(5, w) * 0.2;
    case "strike":
      return effectiveFace(3, w) * 4 + Math.min(3, w) * 0.2;
    case "ember":
      return effectiveFace(1, w) * 3 + (w === 0 ? 2.5 : 0);
    case "leech":
      return 1.2 + Math.min(5, other.hand.length) * 0.9;
    case "mend":
      return Math.max(0, my.maxHp - my.hp) * 0.55;
    case "ward":
      return my.hp <= 9 ? 5 : my.ward === 0 && my.hp <= 14 ? 2 : 0.8;
    case "brace":
      return my.hp <= 10 ? 6 : 1.2;
    default:
      return 0;
  }
}

function pickRandom(state: GameState, step: number, salt: number): GameAction {
  const acts = getValidActions(state);
  const { value } = randomInt(salt ^ 0x9e3779b9, step, acts.length);
  return acts[value]!;
}

function pickSpike(state: GameState, me: PlayerId): GameAction {
  const acts = getValidActions(state);
  for (const a of acts) {
    if (a.type !== "PLAY_CARD") continue;
    const next = applyAction(state, a);
    const win = checkWinCondition(next);
    if (win.status === "ended" && win.winner === me) return a;
  }

  let best: GameAction | null = null;
  let bestV = -1;
  for (const a of acts) {
    if (a.type !== "PLAY_CARD") continue;
    const c = cardAt(state, me, a);
    if (!c) continue;
    const v = spikeCardValue(c, state, me);
    if (v > bestV) {
      bestV = v;
      best = a;
    }
  }

  const end = acts.find((a) => a.type === "END_TURN")!;
  if (
    state.cardsPlayedThisTurn < state.maxPlaysPerTurn &&
    best &&
    bestV >= (state.cardsPlayedThisTurn === 0 ? 0.35 : 0.25)
  ) {
    return best;
  }
  return end;
}

const aggroOrder: CardId[] = ["surge", "strike", "ember", "leech", "mend", "ward", "brace"];

function pickFirstInHand(
  state: GameState,
  me: PlayerId,
  acts: GameAction[],
  order: CardId[],
): GameAction | null {
  const plays = acts.filter((a) => a.type === "PLAY_CARD");
  for (const cid of order) {
    const hit = plays.find((a) => cardAt(state, me, a) === cid);
    if (hit) return hit;
  }
  return null;
}

function pickAggro(state: GameState, me: PlayerId): GameAction {
  const acts = getValidActions(state);
  if (state.cardsPlayedThisTurn < state.maxPlaysPerTurn) {
    const c = pickFirstInHand(state, me, acts, aggroOrder);
    if (c) return c;
  }
  return acts.find((a) => a.type === "END_TURN")!;
}

const turtleOrder: CardId[] = ["mend", "brace", "ward", "leech", "ember", "strike", "surge"];

function pickTurtle(state: GameState, me: PlayerId): GameAction {
  const acts = getValidActions(state);
  const my = state.players[me];
  const order =
    my.hp <= 8
      ? (["mend", "brace", "ward", "leech", "strike", "ember", "surge"] as CardId[])
      : turtleOrder;
  if (state.cardsPlayedThisTurn < state.maxPlaysPerTurn) {
    const c = pickFirstInHand(state, me, acts, order);
    if (c) return c;
  }
  return acts.find((a) => a.type === "END_TURN")!;
}

function pickDisruptor(state: GameState, me: PlayerId): GameAction {
  const acts = getValidActions(state);
  const other = state.players[opp(me)];
  const preferLeech = other.hand.length >= 2;
  const order: CardId[] = preferLeech
    ? ["leech", "surge", "strike", "ember", "ward", "brace", "mend"]
    : aggroOrder;
  if (state.cardsPlayedThisTurn < state.maxPlaysPerTurn) {
    const c = pickFirstInHand(state, me, acts, order);
    if (c) return c;
  }
  return acts.find((a) => a.type === "END_TURN")!;
}

const timmyOrder: CardId[] = ["surge", "brace", "strike", "ember", "leech", "ward", "mend"];

function pickTimmy(state: GameState, me: PlayerId): GameAction {
  const acts = getValidActions(state);
  if (state.cardsPlayedThisTurn < state.maxPlaysPerTurn) {
    const c = pickFirstInHand(state, me, acts, timmyOrder);
    if (c) return c;
  }
  return acts.find((a) => a.type === "END_TURN")!;
}

/**
 * Wybór legalnej akcji dla bota.
 * @param step licznik kroków bota (deterministyczny RNG dla random)
 * @param salt ziarno pomocnicze (np. matchSeed * C)
 */
export function pickBotAction(
  state: GameState,
  step: number,
  me: PlayerId,
  salt: number,
  strategy: BotStrategyId,
): GameAction {
  switch (strategy) {
    case "random":
      return pickRandom(state, step, salt);
    case "spike":
      return pickSpike(state, me);
    case "aggro":
      return pickAggro(state, me);
    case "turtle":
      return pickTurtle(state, me);
    case "disruptor":
      return pickDisruptor(state, me);
    case "timmy":
      return pickTimmy(state, me);
    default:
      return pickRandom(state, step, salt);
  }
}
