import { getValidActions } from "../src/rules.js";
import type { GameAction, GameState } from "../src/types.js";

export interface LegalOption {
  n: number;
  shortLabel: string;
  detail: string;
  action: GameAction;
}

const DIR_PL: Record<string, string> = {
  N: "północ (↑)",
  S: "południe (↓)",
  E: "wschód (→)",
  W: "zachód (←)",
};

function describeAction(a: GameAction): { shortLabel: string; detail: string } {
  switch (a.type) {
    case "WAIT":
      return {
        shortLabel: "Czekaj",
        detail: "Nic nie rób; następnie ruszają wrogowie.",
      };
    case "DESCEND":
      return {
        shortLabel: "Zejście",
        detail: "Schodzisz niżej (na ostatnim poziomie — zwycięstwo).",
      };
    case "MOVE":
      return {
        shortLabel: `Ruch: ${DIR_PL[a.dir] ?? a.dir}`,
        detail: "Krok w wybranym kierunku; w pole z wrogiem = atak za 1 pkt obrażeń.",
      };
    default:
      return { shortLabel: "?", detail: "" };
  }
}

export function describeLegalActions(state: GameState): {
  activePlayerId: "hero";
  count: number;
  options: LegalOption[];
} {
  const acts = getValidActions(state);
  const options: LegalOption[] = acts.map((action, i) => {
    const { shortLabel, detail } = describeAction(action);
    return { n: i + 1, shortLabel, detail, action };
  });
  return { activePlayerId: "hero", count: options.length, options };
}
