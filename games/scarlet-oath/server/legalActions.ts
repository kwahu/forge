import { getValidActions } from "../src/rules.js";
import type { GameAction, GameState } from "../src/types.js";

export function playerLabelPl(pid: string): string {
  return pid === "p0" ? "Seeker" : "Echo";
}

const DIR_PL: Record<string, string> = {
  n: "↑ północ",
  e: "→ wschód",
  s: "↓ południe",
  w: "← zachód",
};

export interface LegalOption {
  n: number;
  shortLabel: string;
  detail: string;
  action: GameAction;
}

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
        detail: `${playerLabelPl(pid)} kończy turę. Niewykorzystane AP przepadają.`,
        action,
      };
    }
    if (action.type === "WARD") {
      return {
        n: i + 1,
        shortLabel: "Welw — tarcza",
        detail: "Koszt 1 AP: +4 tarczy (max 10). Obrażenia najpierw zużywają tarczę.",
        action,
      };
    }
    if (action.type === "STRIKE") {
      return {
        n: i + 1,
        shortLabel: "Cios",
        detail: "Koszt 2 AP: 5 obrażeń w sąsiedztwie ortogonalnym.",
        action,
      };
    }
    if (action.type === "DASH") {
      return {
        n: i + 1,
        shortLabel: `Szarża ${DIR_PL[action.dir] ?? action.dir}`,
        detail: `Koszt 2 AP: skok 2 pola w kierunku ${action.dir}.`,
        action,
      };
    }
    if (action.type === "MOVE") {
      return {
        n: i + 1,
        shortLabel: `Ruch ${DIR_PL[action.dir] ?? action.dir}`,
        detail: `Koszt 1 AP: krok w kierunku ${action.dir}.`,
        action,
      };
    }
    return {
      n: i + 1,
      shortLabel: String((action as { type: string }).type),
      detail: "",
      action,
    };
  });
  return { activePlayerId: pid, count: options.length, options };
}
