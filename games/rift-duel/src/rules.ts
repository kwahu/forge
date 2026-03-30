import { resolveCard, starterDeck } from "./cards.js";
import { randomInt, shuffle } from "./rng.js";
import type { MissionStartOptions } from "./mission.js";
import type { AIContext, GameAction, GameState, PlayerId, PublicView, WinResult } from "./types.js";

const MAX_HP = 20;
const OPENING_HAND_EACH = 5;
const DRAW_PER_TURN = 1;
const DEFAULT_MAX_PLAYS = 2;

function opponentOf(p: PlayerId): PlayerId {
  return p === "p0" ? "p1" : "p0";
}

function emptyPlayer(): import("./types.js").PlayerState {
  return {
    hp: MAX_HP,
    maxHp: MAX_HP,
    ward: 0,
    deck: [],
    hand: [],
    discard: [],
  };
}

/** Tworzy stan początkowy: po 5 kart każdy, losowa inicjatywa (deterministyczna od seed). Opcjonalnie dodatkowe dobory wg misji (kolejność: p0, p1, powtórki). */
export function createInitialState(seed: number, mission: MissionStartOptions | null = null): GameState {
  const d0 = starterDeck();
  const d1 = starterDeck();
  const s1 = shuffle(d0, seed, 0);
  const s2 = shuffle(d1, seed, s1.nextCounter);

  let counter = s2.nextCounter;
  const ini = randomInt(seed, counter, 2);
  counter = ini.nextCounter;
  const first: PlayerId = ini.value === 0 ? "p0" : "p1";

  const p0 = emptyPlayer();
  const p1 = emptyPlayer();
  p0.deck = s1.shuffled;
  p1.deck = s2.shuffled;

  let state: GameState = {
    genre: "cardgame",
    gameId: "rift-duel",
    contentVersion: "0.2.1",
    turnIndex: 0,
    activePlayerId: first,
    phase: "main",
    cardsPlayedThisTurn: 0,
    maxPlaysPerTurn: DEFAULT_MAX_PLAYS,
    rngSeed: seed,
    rngCounter: counter,
    players: { p0, p1 },
    history: [],
    fatigueDamage: { p0: 0, p1: 0 },
    missionId: null,
  };

  for (let i = 0; i < OPENING_HAND_EACH; i++) {
    state = drawForTurn(state, "p0");
    state = drawForTurn(state, "p1");
  }

  const extra = mission?.extraOpeningDraws;
  if (extra) {
    for (const pid of ["p0", "p1"] as const) {
      const n = extra[pid] ?? 0;
      for (let k = 0; k < n; k++) {
        state = drawForTurn(state, pid);
      }
    }
  }

  return {
    ...state,
    missionId: mission?.id ?? null,
  };
}

function drawForTurn(state: GameState, playerId: PlayerId): GameState {
  const p = state.players[playerId];
  if (p.deck.length > 0) {
    const [top, ...rest] = p.deck;
    return {
      ...state,
      players: {
        ...state.players,
        [playerId]: { ...p, deck: rest, hand: [...p.hand, top] },
      },
    };
  }
  const fd = state.fatigueDamage[playerId] + 1;
  const np = { ...p, hp: Math.max(0, p.hp - fd) };
  return {
    ...state,
    fatigueDamage: { ...state.fatigueDamage, [playerId]: fd },
    players: { ...state.players, [playerId]: np },
  };
}

export function checkWinCondition(state: GameState): WinResult {
  const { p0, p1 } = state.players;
  if (p0.hp <= 0 && p1.hp <= 0) return { status: "ended", winner: state.activePlayerId };
  if (p0.hp <= 0) return { status: "ended", winner: "p1" };
  if (p1.hp <= 0) return { status: "ended", winner: "p0" };
  return { status: "ongoing" };
}

export function getValidActions(state: GameState): GameAction[] {
  if (checkWinCondition(state).status === "ended") return [];
  const pid = state.activePlayerId;
  const hand = state.players[pid].hand;
  const actions: GameAction[] = [];
  if (state.cardsPlayedThisTurn < state.maxPlaysPerTurn) {
    for (let i = 0; i < hand.length; i++) {
      actions.push({ type: "PLAY_CARD", handIndex: i });
    }
  }
  actions.push({ type: "END_TURN" });
  return actions;
}

export function applyAction(state: GameState, action: GameAction): GameState {
  if (checkWinCondition(state).status === "ended") return state;

  const pid = state.activePlayerId;
  let next: GameState = state;

  if (action.type === "PLAY_CARD") {
    if (state.cardsPlayedThisTurn >= state.maxPlaysPerTurn) return state;
    const hand = state.players[pid].hand;
    const card = hand[action.handIndex];
    if (card === undefined) return state;
    const newHand = hand.filter((_, i) => i !== action.handIndex);
    next = {
      ...state,
      players: {
        ...state.players,
        [pid]: { ...state.players[pid], hand: newHand, discard: [...state.players[pid].discard, card] },
      },
      cardsPlayedThisTurn: state.cardsPlayedThisTurn + 1,
    };
    next = resolveCard(next, pid, card);
  } else if (action.type === "END_TURN") {
    const opp = opponentOf(pid);
    let afterTurn: GameState = {
      ...state,
      activePlayerId: opp,
      turnIndex: state.turnIndex + 1,
      cardsPlayedThisTurn: 0,
    };
    for (let d = 0; d < DRAW_PER_TURN; d++) {
      afterTurn = drawForTurn(afterTurn, opp);
    }
    next = afterTurn;
  }

  const entry = {
    turnIndex: state.turnIndex,
    activePlayerId: pid,
    action,
  };
  return {
    ...next,
    history: [...state.history, entry],
  };
}

export function getVisibility(state: GameState, playerId: PlayerId): PublicView {
  const you = state.players[playerId];
  const opp = state.players[opponentOf(playerId)];
  const { hand: _h, ...oppRest } = opp;
  return {
    you: { ...you },
    opponent: { ...oppRest, handCount: opp.hand.length },
    activePlayerId: state.activePlayerId,
    turnIndex: state.turnIndex,
    cardsPlayedThisTurn: state.cardsPlayedThisTurn,
    maxPlaysPerTurn: state.maxPlaysPerTurn,
  };
}

export function getAIContext(state: GameState, playerId: PlayerId): AIContext {
  const valid = getValidActions(state);
  const v = getVisibility(state, playerId);
  const lines = [
    `Tura ${state.turnIndex}, aktywny: ${state.activePlayerId}`,
    `Twoje HP ${v.you.hp}/${v.you.maxHp}, tarcza ${v.you.ward}`,
    `Przeciwnik HP ${v.opponent.hp}/${v.opponent.maxHp}, tarcza ${v.opponent.ward}, kart w ręce ${v.opponent.handCount}`,
    `Zagrano w turze ${state.cardsPlayedThisTurn}/${state.maxPlaysPerTurn}`,
    `Twoja ręka: ${v.you.hand.join(", ")}`,
  ];
  return {
    genre: state.genre,
    gameId: state.gameId,
    activePlayerId: state.activePlayerId,
    turnIndex: state.turnIndex,
    validActionCount: valid.length,
    summary: lines.join("\n"),
    yourHand: [...v.you.hand],
    yourHp: v.you.hp,
    oppHp: v.opponent.hp,
    oppHandCount: v.opponent.handCount,
    oppWard: v.opponent.ward,
    yourWard: v.you.ward,
  };
}
