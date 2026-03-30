export type PlayerId = "p0" | "p1";

export type CardId =
  | "strike"
  | "ward"
  | "mend"
  | "leech"
  | "surge"
  | "brace"
  | "ember";

export type GamePhase = "main";

export interface PlayerState {
  hp: number;
  maxHp: number;
  ward: number;
  deck: CardId[];
  hand: CardId[];
  discard: CardId[];
}

export interface GameState {
  genre: "cardgame";
  gameId: "rift-duel";
  contentVersion: string;
  turnIndex: number;
  activePlayerId: PlayerId;
  phase: GamePhase;
  cardsPlayedThisTurn: number;
  maxPlaysPerTurn: number;
  rngSeed: number;
  rngCounter: number;
  players: Record<PlayerId, PlayerState>;
  history: ActionEntry[];
  fatigueDamage: Record<PlayerId, number>;
  /** Id kroku kampanii / misji; null w trybie dowolnym. */
  missionId: string | null;
}

export interface ActionEntry {
  turnIndex: number;
  activePlayerId: PlayerId;
  action: GameAction;
}

export type GameAction =
  | { type: "PLAY_CARD"; handIndex: number }
  | { type: "END_TURN" };

export type WinResult = { status: "ongoing" } | { status: "ended"; winner: PlayerId };

export interface PublicView {
  you: PlayerState;
  opponent: Omit<PlayerState, "hand"> & { handCount: number };
  activePlayerId: PlayerId;
  turnIndex: number;
  cardsPlayedThisTurn: number;
  maxPlaysPerTurn: number;
}

export interface AIContext {
  genre: string;
  gameId: string;
  activePlayerId: PlayerId;
  turnIndex: number;
  validActionCount: number;
  summary: string;
  yourHand: CardId[];
  yourHp: number;
  oppHp: number;
  oppHandCount: number;
  oppWard: number;
  yourWard: number;
}
