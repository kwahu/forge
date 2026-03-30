import type { CardId, GameState, PlayerId } from "./types.js";
import { randomInt } from "./rng.js";

export const CARD_META: Record<
  CardId,
  { name: string; description: string }
> = {
  strike: { name: "Cios", description: "Zadaj 3 obrażenia (najpierw zdejmij tarczę przeciwnika)." },
  ward: { name: "Tarcza", description: "Zyskaj 4 pkt tarczy (pochłania obrażenia)." },
  mend: { name: "Zasklepienie", description: "Wylecz 2 HP (max jak przy starcie)." },
  leech: { name: "Wysys", description: "Wymuś u przeciwnika odrzut 1 losowej karty; dobierz 1 (jeśli talia nie pusta)." },
  surge: { name: "Przełam", description: "Zadaj 5 obrażeń." },
  brace: { name: "Zbrojenie", description: "Zyskaj 6 tarczy." },
  ember: { name: "Żar", description: "Zadaj 1 obrażenie; jeśli trafisz HP, dobierz 1 kartę." },
};

export function starterDeck(): CardId[] {
  return [
    ...Array<CardId>(4).fill("strike"),
    ...Array<CardId>(3).fill("ward"),
    ...Array<CardId>(3).fill("mend"),
    ...Array<CardId>(3).fill("leech"),
    ...Array<CardId>(2).fill("surge"),
    ...Array<CardId>(2).fill("brace"),
    ...Array<CardId>(3).fill("ember"),
  ];
}

/** Kolejność wyświetlania w UI / API */
const CATALOG_ORDER: CardId[] = ["strike", "ward", "mend", "leech", "surge", "brace", "ember"];

/** Informacja o puli startowej (źródło kart przed tasowaniem). */
export function getDeckCatalogForApi(): {
  totalCardsPerPlayer: number;
  introPl: string;
  breakdown: { id: CardId; count: number; name: string; description: string }[];
} {
  const deck = starterDeck();
  const byId = new Map<CardId, number>();
  for (const c of deck) {
    byId.set(c, (byId.get(c) || 0) + 1);
  }
  const breakdown = CATALOG_ORDER.filter((id) => byId.has(id)).map((id) => ({
    id,
    count: byId.get(id)!,
    name: CARD_META[id].name,
    description: CARD_META[id].description,
  }));
  return {
    totalCardsPerPlayer: deck.length,
    introPl:
      "Obaj gracze dostają talię zbudowaną z tej samej listy 20 kart. Przed partią każda talia jest tasowana osobno (inny układ, ten sam seed determinuje oba tasowania w silniku). Na start dobieracie naprzemiennie po 5 kart; w turze dobiera się 1 kartę po zakończeniu tury przeciwnika.",
    breakdown,
  };
}

function opponentOf(p: PlayerId): PlayerId {
  return p === "p0" ? "p1" : "p0";
}

function drawOne(state: GameState, playerId: PlayerId): GameState {
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

function discardAt(state: GameState, playerId: PlayerId, handIndex: number): GameState {
  const p = state.players[playerId];
  const card = p.hand[handIndex];
  if (!card) return state;
  const hand = p.hand.filter((_, i) => i !== handIndex);
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...p, hand, discard: [...p.discard, card] },
    },
  };
}

function dealDamage(state: GameState, target: PlayerId, amount: number): GameState {
  const p = state.players[target];
  let w = p.ward;
  let dmg = amount;
  const absorb = Math.min(w, dmg);
  w -= absorb;
  dmg -= absorb;
  const hp = Math.max(0, p.hp - dmg);
  return {
    ...state,
    players: {
      ...state.players,
      [target]: { ...p, ward: w, hp },
    },
  };
}

export function resolveCard(state: GameState, playerId: PlayerId, card: CardId): GameState {
  const opp = opponentOf(playerId);
  let s = state;
  switch (card) {
    case "strike":
      return dealDamage(s, opp, 3);
    case "ward":
      return {
        ...s,
        players: {
          ...s.players,
          [playerId]: { ...s.players[playerId], ward: s.players[playerId].ward + 4 },
        },
      };
    case "mend": {
      const me = s.players[playerId];
      const hp = Math.min(me.maxHp, me.hp + 2);
      return {
        ...s,
        players: { ...s.players, [playerId]: { ...me, hp } },
      };
    }
    case "leech": {
      const o = s.players[opp];
      if (o.hand.length === 0) return s;
      const ri = randomInt(s.rngSeed, s.rngCounter, o.hand.length);
      s = { ...s, rngCounter: ri.nextCounter };
      s = discardAt(s, opp, ri.value);
      return drawOne(s, playerId);
    }
    case "surge":
      return dealDamage(s, opp, 5);
    case "brace":
      return {
        ...s,
        players: {
          ...s.players,
          [playerId]: { ...s.players[playerId], ward: s.players[playerId].ward + 6 },
        },
      };
    case "ember": {
      const before = s.players[opp].hp;
      s = dealDamage(s, opp, 1);
      const after = s.players[opp].hp;
      if (before > after) {
        return drawOne(s, playerId);
      }
      return s;
    }
    default:
      return s;
  }
}
