import { getValidActions } from "../src/rules.js";
import { CARD_META } from "../src/cards.js";
import type { GameAction, GameState } from "../src/types.js";
import { playerLabelPl } from "./botExplain.js";

export interface LegalOption {
  n: number;
  shortLabel: string;
  detail: string;
  action: GameAction;
}

/** Wszystkie legalne akcje dla aktywnego gracza — do podglądu widza. */
export function describeLegalActions(state: GameState): {
  activePlayerId: string;
  count: number;
  options: LegalOption[];
} {
  const acts = getValidActions(state);
  const pid = state.activePlayerId;
  const options: LegalOption[] = acts.map((action, i) => {
    if (action.type === "END_TURN") {
      return {
        n: i + 1,
        shortLabel: "Koniec tury",
        detail: `Zakończenie tury (${playerLabelPl(pid)}). Przeciwnik dobiera 1 kartę z talii (albo bierze zmęczenie przy pustej talii).`,
        action,
      };
    }
    const card = state.players[pid].hand[action.handIndex];
    if (!card) {
      return {
        n: i + 1,
        shortLabel: `Pozycja ręki ${action.handIndex}`,
        detail: "Nieznana karta w tej pozycji.",
        action,
      };
    }
    const m = CARD_META[card];
    return {
      n: i + 1,
      shortLabel: `${m.name} (slot ręki ${action.handIndex})`,
      detail: `${m.name} [${card}]: ${m.description}`,
      action,
    };
  });
  return { activePlayerId: pid, count: options.length, options };
}
