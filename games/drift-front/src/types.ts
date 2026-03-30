export type PlayerId = "p0" | "p1";

export type Dir = "N" | "E" | "S" | "W";

export type UnitSlot = 0 | 1;

export interface UnitState {
  owner: PlayerId;
  slot: UnitSlot;
  x: number;
  y: number;
  hp: number;
}

/** Nieużywalne pola (przeszkody); jednostki nie mogą na nich stanąć. */
export interface Cell {
  x: number;
  y: number;
}

export interface GameState {
  genre: "strategy";
  gameId: "drift-front";
  contentVersion: string;
  boardWidth: number;
  boardHeight: number;
  /** Pola zablokowane (np. filary dryfu). */
  blocked: Cell[];
  activePlayerId: PlayerId;
  /** Liczba wykonanych półtur (jedna akcja = jedna półtura). */
  halfTurnIndex: number;
  rngSeed: number;
  rngCounter: number;
  units: UnitState[];
  history: ActionEntry[];
}

export interface ActionEntry {
  halfTurnIndex: number;
  activePlayerId: PlayerId;
  action: GameAction;
}

export type GameAction =
  | { type: "MOVE"; slot: UnitSlot; dir: Dir }
  | { type: "ATTACK"; slot: UnitSlot; dir: Dir };

export type WinResult =
  | { status: "ongoing" }
  | { status: "ended"; winner: PlayerId }
  | { status: "ended"; winner: null; reason: "draw" };

export interface PublicView {
  boardWidth: number;
  boardHeight: number;
  blocked: Cell[];
  units: UnitState[];
  activePlayerId: PlayerId;
  halfTurnIndex: number;
}

export interface AIContext {
  genre: string;
  gameId: string;
  activePlayerId: PlayerId;
  halfTurnIndex: number;
  validActionCount: number;
  summary: string;
  yourUnits: UnitState[];
  enemyUnits: UnitState[];
}
