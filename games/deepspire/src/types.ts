export type Dir = "N" | "S" | "E" | "W";

export type Cell = "wall" | "floor" | "stairs";

export interface Vec2 {
  x: number;
  y: number;
}

export interface Enemy {
  id: string;
  x: number;
  y: number;
  hp: number;
}

export type GamePhase = "playing";

export interface GameState {
  genre: "roguelike";
  gameId: "deepspire";
  contentVersion: string;
  turnIndex: number;
  phase: GamePhase;
  activePlayerId: "hero";
  rngSeed: number;
  rngCounter: number;
  /** Głębokość bieżącego poziomu (1 = pierwsze piętro). */
  depth: number;
  /** Zejście ze schodów na tym poziomie = zwycięstwo (wyjście z wieży). */
  winDepth: number;
  width: number;
  height: number;
  grid: Cell[][];
  stairs: Vec2;
  player: { hp: number; maxHp: number; x: number; y: number };
  enemies: Enemy[];
  history: ActionEntry[];
  /** Ustawiane po zwycięstwie / śmierci — dalsze akcje zabronione. */
  terminal: null | { outcome: "victory" | "death" };
}

export interface ActionEntry {
  turnIndex: number;
  action: GameAction;
}

export type GameAction =
  | { type: "MOVE"; dir: Dir }
  | { type: "WAIT" }
  | { type: "DESCEND" };

export type WinResult =
  | { status: "ongoing" }
  | { status: "ended"; outcome: "victory" | "death" };

export interface PublicView {
  depth: number;
  winDepth: number;
  turnIndex: number;
  width: number;
  height: number;
  grid: Cell[][];
  stairs: Vec2;
  player: { hp: number; maxHp: number; x: number; y: number };
  enemies: Enemy[];
}

export interface AIContext {
  genre: string;
  gameId: string;
  turnIndex: number;
  depth: number;
  playerHp: number;
  enemyCount: number;
  summary: string;
  validActionCount: number;
}
