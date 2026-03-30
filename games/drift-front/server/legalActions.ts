import { getValidActions } from "../src/rules.js";
import type { GameAction, GameState } from "../src/types.js";

const DIR_PL: Record<string, string> = {
  N: "N",
  E: "E",
  S: "S",
  W: "W",
};

function labelAction(state: GameState, action: GameAction): { shortLabel: string; detail: string } {
  const who = state.activePlayerId === "p0" ? "Błękit" : "Bursztyn";
  if (action.type === "MOVE") {
    return {
      shortLabel: `${who} · jednostka ${action.slot} → ${DIR_PL[action.dir] ?? action.dir}`,
      detail: `Ruch o jedno pole (${action.dir}).`,
    };
  }
  return {
    shortLabel: `${who} · jednostka ${action.slot} ⚔ ${DIR_PL[action.dir] ?? action.dir}`,
    detail: `Atak sąsiada (2 obrażenia).`,
  };
}

export function describeLegalActions(state: GameState) {
  const options = getValidActions(state).map((action, i) => {
    const { shortLabel, detail } = labelAction(state, action);
    return { n: i + 1, shortLabel, detail, action };
  });
  return {
    activePlayerId: state.activePlayerId,
    count: options.length,
    options,
  };
}
