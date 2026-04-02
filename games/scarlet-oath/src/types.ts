export type PlayerId = "p0" | "p1";

/** p0 — bohater (Seeker); p1 — Echo (wrogie odbicie). */
export type GamePhase = "tactics";

export interface Vec2 {
  x: number;
  y: number;
}

export interface UnitState {
  hp: number;
  maxHp: number;
  ap: number;
  shield: number;
}

export interface GameState {
  genre: "rpg";
  gameId: "scarlet-oath";
  contentVersion: string;
  turnIndex: number;
  activePlayerId: PlayerId;
  phase: GamePhase;
  rngSeed: number;
  rngCounter: number;
  grid: { width: number; height: number };
  positions: Record<PlayerId, Vec2>;
  units: Record<PlayerId, UnitState>;
  history: ActionEntry[];
}

export interface ActionEntry {
  turnIndex: number;
  activePlayerId: PlayerId;
  action: GameAction;
}

export type Dir = "n" | "e" | "s" | "w";

export type GameAction =
  | { type: "MOVE"; dir: Dir }
  | { type: "DASH"; dir: Dir }
  | { type: "STRIKE" }
  | { type: "WARD" }
  | { type: "END_TURN" };

export type WinResult = { status: "ongoing" } | { status: "ended"; winner: PlayerId };

export interface PublicView {
  you: UnitState;
  opponent: UnitState;
  yourPos: Vec2;
  oppPos: Vec2;
  grid: { width: number; height: number };
  activePlayerId: PlayerId;
  turnIndex: number;
}

export interface AIContext {
  genre: string;
  gameId: string;
  activePlayerId: PlayerId;
  turnIndex: number;
  validActionCount: number;
  summary: string;
  yourHp: number;
  oppHp: number;
  yourAp: number;
  yourShield: number;
  oppShield: number;
  manhattanToOpp: number;
}
