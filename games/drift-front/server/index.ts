/**
 * Usługa FORGE: REST + WebSocket, obserwacja AI vs AI (opcjonalnie gracz ludzki).
 */
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import { WebSocketServer, type WebSocket } from "ws";

import {
  applyAction,
  checkWinCondition,
  createInitialState,
  getValidActions,
} from "../src/rules.js";
import {
  BOT_STRATEGIES_FOR_API,
  DEFAULT_BOT_STRATEGY_P0,
  DEFAULT_BOT_STRATEGY_P1,
  type BotStrategyId,
  parseBotStrategyId,
  pickBotAction,
} from "../src/botStrategies.js";
import type { GameAction, GameState, PlayerId, WinResult } from "../src/types.js";
import { describeLegalActions } from "./legalActions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = path.join(__dirname, "../client");
const PORT = Number(process.env.DRIFT_FRONT_PORT || 8790);
const DEFAULT_BOT_MS = Number(process.env.DRIFT_FRONT_BOT_MS || 650);

interface Session {
  id: string;
  matchSeed: number;
  botStep: number;
  seq: number;
  state: GameState;
  botTimer: ReturnType<typeof setInterval> | null;
  clients: Set<WebSocket>;
  botDelayMs: number;
  botPaused: boolean;
  matchNumber: number;
  humanAs: PlayerId | null;
  botStrategyP0: BotStrategyId;
  botStrategyP1: BotStrategyId;
}

const sessions = new Map<string, Session>();
let idCounter = 1;

function makeId(): string {
  return `df-${Date.now()}-${idCounter++}`;
}

function clampDelay(ms: number): number {
  return Math.max(120, Math.min(12000, Math.round(ms)));
}

function broadcast(sess: Session, payload: object) {
  const raw = JSON.stringify(payload);
  for (const ws of sess.clients) {
    if (ws.readyState === 1) ws.send(raw);
  }
}

function stopBot(sess: Session) {
  if (sess.botTimer) {
    clearInterval(sess.botTimer);
    sess.botTimer = null;
  }
}

function startBot(sess: Session) {
  stopBot(sess);
  if (sess.botPaused) return;
  const ms = clampDelay(sess.botDelayMs);
  sess.botTimer = setInterval(() => botTick(sess), ms);
}

function actionsEqual(a: GameAction, b: GameAction): boolean {
  if (a.type !== b.type) return false;
  if (a.slot !== b.slot) return false;
  return a.dir === b.dir;
}

function playerLabelPl(pid: PlayerId): string {
  return pid === "p0" ? "Błękit (p0)" : "Bursztyn (p1)";
}

function summarizeAction(before: GameState, action: GameAction): string {
  const who = playerLabelPl(before.activePlayerId);
  if (action.type === "MOVE") return `${who} · ruch jednostki ${action.slot} ${action.dir}`;
  return `${who} · atak jednostki ${action.slot} ${action.dir}`;
}

function narrativeResult(w: WinResult): string {
  if (w.status !== "ended") return "";
  if (w.winner === null) return w.reason === "draw" ? "Remis — limit półtur." : "Remis.";
  return w.winner === "p0" ? "Wygrywa Błękit (p0)." : "Wygrywa Bursztyn (p1).";
}

function legalPayload(state: GameState) {
  const d = describeLegalActions(state);
  return {
    activePlayerId: d.activePlayerId,
    count: d.count,
    options: d.options.map((o) => ({
      n: o.n,
      shortLabel: o.shortLabel,
      detail: o.detail,
      action: o.action,
    })),
  };
}

function broadcastEnded(sess: Session) {
  const end = checkWinCondition(sess.state);
  if (end.status !== "ended") return;
  stopBot(sess);
  broadcast(sess, {
    type: "ended",
    winner: end.winner,
    reason: end.winner === null && end.reason ? end.reason : undefined,
    state: sess.state,
    matchSeed: sess.matchSeed,
    matchNumber: sess.matchNumber,
    resultLine: narrativeResult(end),
    legalNow: { activePlayerId: "", count: 0, options: [] },
    humanAs: sess.humanAs,
    botStrategyP0: sess.botStrategyP0,
    botStrategyP1: sess.botStrategyP1,
  });
  setTimeout(() => resetSessionForNextMatch(sess), 2800);
}

function botTick(sess: Session) {
  if (checkWinCondition(sess.state).status === "ended") {
    broadcastEnded(sess);
    return;
  }

  if (sess.humanAs && sess.state.activePlayerId === sess.humanAs) return;

  const acts = getValidActions(sess.state);
  if (acts.length === 0) return;

  const sim = sess.matchSeed * 0x1a2b3c4d;
  const me = sess.state.activePlayerId;
  const strat = me === "p0" ? sess.botStrategyP0 : sess.botStrategyP1;
  const action = pickBotAction(sess.state, sess.botStep, me, sim, strat);
  let value = acts.findIndex((v) => actionsEqual(v, action));
  if (value < 0) value = 0;

  const before = sess.state;
  const summary = summarizeAction(before, action);
  sess.state = applyAction(before, action);
  sess.botStep += 1;
  sess.seq += 1;

  broadcast(sess, {
    type: "step",
    actor: "bot",
    action,
    summary,
    state: sess.state,
    stepIndex: sess.seq,
    matchNumber: sess.matchNumber,
    reasoning: `Strategia: ${strat}.`,
    legalActionsCount: acts.length,
    chosenLegalIndex: value,
    chosenLegalN: value + 1,
    legalBeforeStep: legalPayload(before),
    legalNow: legalPayload(sess.state),
    humanAs: sess.humanAs,
    botStrategyP0: sess.botStrategyP0,
    botStrategyP1: sess.botStrategyP1,
  });

  if (checkWinCondition(sess.state).status === "ended") {
    broadcastEnded(sess);
  }
}

function resetSessionForNextMatch(sess: Session) {
  sess.matchNumber += 1;
  sess.matchSeed = (sess.matchSeed + 7919 + Math.floor(Math.random() * 997)) >>> 0;
  sess.botStep = 0;
  sess.seq = 0;
  sess.state = createInitialState(sess.matchSeed);
  broadcast(sess, {
    type: "snapshot",
    state: sess.state,
    matchSeed: sess.matchSeed,
    matchNumber: sess.matchNumber,
    message: `Nowa partia (#${sess.matchNumber}).`,
    botDelayMs: sess.botDelayMs,
    botPaused: sess.botPaused,
    legalNow: legalPayload(sess.state),
    humanAs: sess.humanAs,
    botStrategyP0: sess.botStrategyP0,
    botStrategyP1: sess.botStrategyP1,
  });
  startBot(sess);
}

function sessionPayload(sess: Session) {
  const end = checkWinCondition(sess.state);
  return {
    id: sess.id,
    matchSeed: sess.matchSeed,
    matchNumber: sess.matchNumber,
    halfTurnIndex: sess.state.halfTurnIndex,
    activePlayerId: sess.state.activePlayerId,
    ended: end.status === "ended",
    spectators: sess.clients.size,
    botRunning: sess.botTimer != null,
    botPaused: sess.botPaused,
    botDelayMs: sess.botDelayMs,
    humanAs: sess.humanAs,
    botStrategyP0: sess.botStrategyP0,
    botStrategyP1: sess.botStrategyP1,
    contentVersion: sess.state.contentVersion,
  };
}

function createSession(
  seed: number | undefined,
  autoPlay: boolean,
  humanAs: PlayerId | null | undefined,
  stratP0?: BotStrategyId,
  stratP1?: BotStrategyId,
): Session {
  const matchSeed = seed ?? ((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
  const id = makeId();
  const sess: Session = {
    id,
    matchSeed,
    botStep: 0,
    seq: 0,
    state: createInitialState(matchSeed),
    botTimer: null,
    clients: new Set(),
    botDelayMs: clampDelay(DEFAULT_BOT_MS),
    botPaused: false,
    matchNumber: 1,
    humanAs: humanAs === "p0" || humanAs === "p1" ? humanAs : null,
    botStrategyP0: stratP0 ?? DEFAULT_BOT_STRATEGY_P0,
    botStrategyP1: stratP1 ?? DEFAULT_BOT_STRATEGY_P1,
  };
  sessions.set(id, sess);
  if (autoPlay) startBot(sess);
  return sess;
}

function snapshotFields(sess: Session) {
  return {
    state: sess.state,
    matchSeed: sess.matchSeed,
    sessionId: sess.id,
    botRunning: sess.botTimer != null,
    matchNumber: sess.matchNumber,
    botDelayMs: sess.botDelayMs,
    botPaused: sess.botPaused,
    legalNow: legalPayload(sess.state),
    humanAs: sess.humanAs,
    botStrategyP0: sess.botStrategyP0,
    botStrategyP1: sess.botStrategyP1,
  };
}

function attachClient(sess: Session, ws: WebSocket) {
  sess.clients.add(ws);
  ws.send(JSON.stringify({ type: "snapshot", ...snapshotFields(sess) }));
  ws.on("close", () => {
    sess.clients.delete(ws);
  });
}

const app = express();
app.use(express.json());

app.get("/api/meta", (_req, res) => {
  res.json({
    gameId: "drift-front",
    contentVersion: "0.2.0",
    botStrategies: BOT_STRATEGIES_FOR_API,
    service: "drift-front-ws",
  });
});

app.get("/api/sessions", (_req, res) => {
  res.json({ sessions: [...sessions.values()].map(sessionPayload) });
});

app.post("/api/sessions", (req, res) => {
  const seed = typeof req.body?.seed === "number" ? req.body.seed : undefined;
  const autoPlay = req.body?.autoPlay !== false;
  const delayMs = typeof req.body?.botDelayMs === "number" ? req.body.botDelayMs : undefined;
  const humanRaw = req.body?.humanAs;
  const humanAs = humanRaw === "p0" || humanRaw === "p1" ? humanRaw : null;
  const botStrategyP0 = parseBotStrategyId(req.body?.botStrategyP0, DEFAULT_BOT_STRATEGY_P0);
  const botStrategyP1 = parseBotStrategyId(req.body?.botStrategyP1, DEFAULT_BOT_STRATEGY_P1);
  const sess = createSession(seed, false, humanAs, botStrategyP0, botStrategyP1);
  if (delayMs !== undefined) sess.botDelayMs = clampDelay(delayMs);
  if (autoPlay) startBot(sess);
  res.status(201).json(sessionPayload(sess));
});

app.get("/api/sessions/:id", (req, res) => {
  const sess = sessions.get(req.params.id);
  if (!sess) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  res.json({
    ...snapshotFields(sess),
    seq: sess.seq,
  });
});

app.post("/api/sessions/:id/action", (req, res) => {
  const sess = sessions.get(req.params.id);
  if (!sess) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const action = req.body?.action as GameAction | undefined;
  if (!action || (action.type !== "MOVE" && action.type !== "ATTACK")) {
    res.status(400).json({ error: "invalid_body", hint: "{ action: { type, slot, dir } }" });
    return;
  }
  if ((action.slot !== 0 && action.slot !== 1) || !["N", "E", "S", "W"].includes(action.dir)) {
    res.status(400).json({ error: "invalid_action" });
    return;
  }

  if (checkWinCondition(sess.state).status === "ended") {
    res.status(400).json({ error: "game_ended" });
    return;
  }
  if (!sess.humanAs) {
    res.status(403).json({
      error: "human_control_disabled",
      hint: "PATCH /api/sessions/:id/control { humanAs: 'p0' | 'p1' }",
    });
    return;
  }
  if (sess.state.activePlayerId !== sess.humanAs) {
    res.status(403).json({ error: "not_your_turn", active: sess.state.activePlayerId });
    return;
  }

  const before = sess.state;
  const valid = getValidActions(before);
  const idx = valid.findIndex((v) => actionsEqual(v, action));
  if (idx < 0) {
    res.status(400).json({ error: "illegal_action" });
    return;
  }

  sess.state = applyAction(before, action);
  sess.seq += 1;

  broadcast(sess, {
    type: "step",
    actor: "human",
    action,
    summary: summarizeAction(before, action),
    state: sess.state,
    stepIndex: sess.seq,
    matchNumber: sess.matchNumber,
    reasoning: "Ruch gracza ludzkiego.",
    legalActionsCount: valid.length,
    chosenLegalIndex: idx,
    chosenLegalN: idx + 1,
    legalBeforeStep: legalPayload(before),
    legalNow: legalPayload(sess.state),
    humanAs: sess.humanAs,
    botStrategyP0: sess.botStrategyP0,
    botStrategyP1: sess.botStrategyP1,
  });

  if (checkWinCondition(sess.state).status === "ended") {
    broadcastEnded(sess);
  }

  res.json({ ok: true, seq: sess.seq });
});

app.patch("/api/sessions/:id/control", (req, res) => {
  const sess = sessions.get(req.params.id);
  if (!sess) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const h = req.body?.humanAs;
  sess.humanAs = h === "p0" || h === "p1" ? h : null;
  stopBot(sess);
  startBot(sess);
  broadcast(sess, {
    type: "snapshot",
    ...snapshotFields(sess),
    message: sess.humanAs ? `Sterowanie: człowiek jako ${sess.humanAs}.` : "Obserwacja: oba AI.",
  });
  res.json(sessionPayload(sess));
});

app.patch("/api/sessions/:id/bot", (req, res) => {
  const sess = sessions.get(req.params.id);
  if (!sess) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  if (typeof req.body?.delayMs === "number") {
    sess.botDelayMs = clampDelay(req.body.delayMs);
  }
  if (typeof req.body?.paused === "boolean") {
    sess.botPaused = req.body.paused;
  }
  if (req.body?.botStrategyP0 !== undefined) {
    sess.botStrategyP0 = parseBotStrategyId(req.body.botStrategyP0, sess.botStrategyP0);
  }
  if (req.body?.botStrategyP1 !== undefined) {
    sess.botStrategyP1 = parseBotStrategyId(req.body.botStrategyP1, sess.botStrategyP1);
  }
  stopBot(sess);
  startBot(sess);
  broadcast(sess, {
    type: "snapshot",
    ...snapshotFields(sess),
    message: "Zaktualizowano tempo / strategie AI.",
  });
  res.json(sessionPayload(sess));
});

app.use(express.static(CLIENT_DIR));

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) {
    ws.close(4000, "sessionId required");
    return;
  }
  const sess = sessions.get(sessionId);
  if (!sess) {
    ws.close(4004, "session not found");
    return;
  }
  attachClient(sess, ws);
});

server.listen(PORT, () => {
  console.log(`[drift-front] http://127.0.0.1:${PORT}`);
  const demo = createSession(undefined, true, null, DEFAULT_BOT_STRATEGY_P0, DEFAULT_BOT_STRATEGY_P1);
  console.log(`[drift-front] demo session ${demo.id} (otwórz klienta — utworzy własną sesję lub użyj ?session=)`);
});
