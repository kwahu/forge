import { CARD_META } from "../src/cards.js";
import type { GameAction, GameState, PlayerId } from "../src/types.js";

/** Etykieta fabularna miejsca (GDD §5 — pilotaż konfliktu). */
export function playerLabelPl(pid: PlayerId): string {
  return pid === "p0" ? "Strażnik" : "Rozwarstwienie";
}

function opp(p: PlayerId): PlayerId {
  return p === "p0" ? "p1" : "p0";
}

/**
 * Heurystyczny komentarz do decyzji bota (nie prawdziwy AI — czytelność dla widza).
 */
export function explainBotStep(
  before: GameState,
  action: GameAction,
  chosenIndex: number,
  legalCount: number,
): { reasoning: string; effectLine: string | null; playedCardId: string | null } {
  const me = before.activePlayerId;
  const o = opp(me);
  const my = before.players[me];
  const other = before.players[o];

  if (action.type === "END_TURN") {
    if (before.cardsPlayedThisTurn === 0) {
      return {
        reasoning:
          "Bot kończy turę bez zagrania — czasem oszczędza zasoby albo czeka na lepszy dobór.",
        effectLine: "Przekazanie tury: przeciwnik dobiera 1 kartę z talii (lub bierze obrażenia zmęczenia, jeśli talia pusta).",
        playedCardId: null,
      };
    }
    if (before.cardsPlayedThisTurn >= before.maxPlaysPerTurn) {
      return {
        reasoning: "Osiągnięto limit zagrań w tej turze — koniec tury jest jedyną legalną kontynuacją.",
        effectLine: null,
        playedCardId: null,
      };
    }
    return {
      reasoning:
        "Bot nie gra więcej kart w tej turze — dobór i tak przejdzie do przeciwnika; czasem warto nie ujawniać całej kombinacji.",
      effectLine: "Koniec tury → przeciwnik dobiera kartę.",
      playedCardId: null,
    };
  }

  const card = my.hand[action.handIndex];
  if (!card) {
    return { reasoning: "Nie udało się odczytać zagranej karty.", effectLine: null, playedCardId: null };
  }

  const meta = CARD_META[card];
  const effectLine = meta.description;
  const bits: string[] = [];

  if (card === "surge" || card === "strike") {
    if (other.hp <= 8) bits.push("przeciwnik ma mało HP — szansa na zakończenie partii");
    if (other.ward === 0) bits.push("przeciwnik bez tarczy — obrażenia idą prosto w życie");
    else bits.push(`przeciwnik ma ${other.ward} tarczy — część obrażeń zostanie pochłonięta`);
  }
  if (card === "ward" || card === "brace") {
    if (my.hp <= 11) bits.push("własne HP spadło — priorytet obrony");
    bits.push("buduje tarczę na nadchodzące ataki");
  }
  if (card === "mend") {
    bits.push("przywraca HP w ramach limitu maksimum");
  }
  if (card === "leech") {
    if (other.hand.length >= 5) bits.push("przeciwnik trzyma dużo kart — psucie ręki ma sens");
    else if (other.hand.length <= 1) bits.push("mała ręka przeciwnika — efekt odrzutu jest skromny, ale tempo zostaje");
    bits.push("losowy odrzut z ręki wroga + twój dobór, jeśli talia nie jest pusta");
  }
  if (card === "ember") {
    bits.push("mały cios; jeśli dosięgnie HP (nie tylko tarczę), bot dobiera kartę");
  }

  if (bits.length === 0) {
    bits.push(`wybrano opcję #${chosenIndex + 1} spośród ${legalCount} legalnych ruchów (los zgodny z seedem bota)`);
  }

  return {
    reasoning: `Dlaczego ta decyzja: ${bits.join(" · ")}.`,
    effectLine,
    playedCardId: card,
  };
}

export function narrativeSnapshot(state: GameState): string {
  const { p0, p1 } = state.players;
  const lines: string[] = [];
  lines.push(
    `Tura ${state.turnIndex} · aktywny: ${playerLabelPl(state.activePlayerId)} · zagrano w turze ${state.cardsPlayedThisTurn}/${state.maxPlaysPerTurn} kart.`,
  );
  lines.push(
    `Tarcza pochłania obrażenia zanim dotkną HP. Zmęczenie talii: Strażnik ${state.fatigueDamage.p0}, Rozwarstwienie ${state.fatigueDamage.p1}.`,
  );
  lines.push(
    `Talie: Strażnik ${p0.deck.length} kart, Rozwarstwienie ${p1.deck.length}. Odrzuty: ${p0.discard.length} / ${p1.discard.length}.`,
  );
  return lines.join("\n");
}

export function narrativeResult(state: GameState, winner: PlayerId): string {
  const loser = winner === "p0" ? "p1" : "p0";
  const w = state.players[winner];
  const l = state.players[loser];
  return `Zwycięstwo: ${playerLabelPl(winner)} (${w.hp} HP). ${playerLabelPl(loser)} przegrywa duel o szczelinę.`;
}
