/**
 * Usługa FORGE: REST + WebSocket + statyczny klient (jeden bohater, opcjonalny bot).
 */
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import { WebSocketServer, type WebSocket } from "ws";

import {
  actionsEqual,
  applyAction,
  checkWinCondition,
  createInitialState,
  getValidActions,
  pickSimpleBotAction,
} from "../src/rules.js";
import { CHALLENGE_DAY_LABEL, CHALLENGE_DAY_SEED } from "../src/challengeDay.js";
import type { GameAction, GameState } from "../src/types.js";
import { describeLegalActions } from "./legalActions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = path.join(__dirname, "../client");
const PORT = Number(process.env.DEEPSPIRE_PORT || 8788);
const DEFAULT_BOT_MS = Number(process.env.DEEPSPIRE_BOT_MS || 450);

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
  /** true = czekaj na POST /action od człowieka; false = bot gra sam */
  humanControl: boolean;
}

const sessions = new Map<string, Session>();
let idCounter = 1;

function makeId(): string {
  return `ds-${Date.now()}-${idCounter++}`;
}

function clampDelay(ms: number): number {
  return Math.max(120, Math.min(8000, Math.round(ms)));
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
  if (sess.botPaused || sess.humanControl) return;
  const ms = clampDelay(sess.botDelayMs);
  sess.botTimer = setInterval(() => botTick(sess), ms);
}

function narrativeLine(state: GameState): string {
  const end = checkWinCondition(state);
  if (end.status === "ended") {
    return end.outcome === "victory" ? "Szczelina zamknięta — zwycięstwo." : "Cień pochłonął posłańca — koniec.";
  }
  const alive = state.enemies.filter((e) => e.hp > 0).length;
  return `Piętro ${state.depth}/${state.winDepth} · HP ${state.player.hp}/${state.player.maxHp} · wrogowie: ${alive}`;
}

function summarizeAction(before: GameState, action: GameAction): string {
  if (action.type === "WAIT") return "Posłaniec czeka.";
  if (action.type === "DESCEND") {
    if (before.depth === before.winDepth) return "Zejście z ostatniego poziomu — triumf.";
    return `Schodzisz głębiej (${before.depth} → ${before.depth + 1}).`;
  }
  const dir = action.dir;
  const { x: px, y: py } = before.player;
  const delta =
    dir === "N"
      ? { x: px, y: py - 1 }
      : dir === "S"
        ? { x: px, y: py + 1 }
        : dir === "E"
          ? { x: px + 1, y: py }
          : { x: px - 1, y: py };
  const foe = before.enemies.find((e) => e.hp > 0 && e.x === delta.x && e.y === delta.y);
  if (foe) return `Cios w kierunku ${dir} (wróg ${foe.id}).`;
  return `Krok ${dir}.`;
}

function broadcastEnded(sess: Session) {
  const end = checkWinCondition(sess.state);
  if (end.status !== "ended") return;
  stopBot(sess);
  broadcast(sess, {
    type: "ended",
    outcome: end.outcome,
    state: sess.state,
    matchNumber: sess.matchNumber,
    resultLine: narrativeLine(sess.state),
    legalNow: { activePlayerId: "hero", count: 0, options: [] },
    humanControl: sess.humanControl,
  });
  setTimeout(() => resetSessionForNextMatch(sess), 2800);
}

function botTick(sess: Session) {
  if (checkWinCondition(sess.state).status === "ended") {
    broadcastEnded(sess);
    return;
  }
  if (sess.humanControl) return;

  const acts = getValidActions(sess.state);
  if (acts.length === 0) return;

  const action = pickSimpleBotAction(sess.state);
  let value = acts.findIndex((v) => actionsEqual(v, action));
  if (value < 0) value = 0;
  const chosen = acts[value]!;
  const before = sess.state;
  sess.state = applyAction(before, chosen);
  sess.botStep += 1;
  sess.seq += 1;

  broadcast(sess, {
    type: "step",
    actor: "bot",
    action: chosen,
    summary: summarizeAction(before, chosen),
    state: sess.state,
    stepIndex: sess.seq,
    matchNumber: sess.matchNumber,
    legalBeforeStep: legalPayload(before),
    legalNow: legalPayload(sess.state),
    narrative: narrativeLine(sess.state),
    humanControl: sess.humanControl,
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
    message: `Nowa runa (#${sess.matchNumber}).`,
    narrative: narrativeLine(sess.state),
    botDelayMs: sess.botDelayMs,
    botPaused: sess.botPaused,
    legalNow: legalPayload(sess.state),
    humanControl: sess.humanControl,
  });
  startBot(sess);
}

function sessionPayload(sess: Session) {
  const end = checkWinCondition(sess.state);
  return {
    id: sess.id,
    matchSeed: sess.matchSeed,
    matchNumber: sess.matchNumber,
    turnIndex: sess.state.turnIndex,
    depth: sess.state.depth,
    ended: end.status === "ended",
    outcome: end.status === "ended" ? end.outcome : null,
    spectators: sess.clients.size,
    botRunning: sess.botTimer != null,
    botPaused: sess.botPaused,
    botDelayMs: sess.botDelayMs,
    humanControl: sess.humanControl,
  };
}

function snapshotFields(sess: Session) {
  return {
    state: sess.state,
    matchSeed: sess.matchSeed,
    sessionId: sess.id,
    botRunning: sess.botTimer != null,
    matchNumber: sess.matchNumber,
    narrative: narrativeLine(sess.state),
    botDelayMs: sess.botDelayMs,
    botPaused: sess.botPaused,
    legalNow: legalPayload(sess.state),
    humanControl: sess.humanControl,
  };
}

function createSession(
  seed: number | undefined,
  humanControl: boolean,
  delayMs?: number,
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
    botDelayMs: clampDelay(delayMs ?? DEFAULT_BOT_MS),
    botPaused: false,
    matchNumber: 1,
    humanControl,
  };
  sessions.set(id, sess);
  return sess;
}

function attachClient(sess: Session, ws: WebSocket) {
  sess.clients.add(ws);
  ws.send(JSON.stringify({ type: "snapshot", ...snapshotFields(sess) }));
  ws.on("close", () => {
    sess.clients.delete(ws);
  });
}

function parseAction(body: unknown): GameAction | null {
  if (!body || typeof body !== "object") return null;
  const a = body as { type?: string; dir?: string };
  if (a.type === "WAIT") return { type: "WAIT" };
  if (a.type === "DESCEND") return { type: "DESCEND" };
  if (a.type === "MOVE" && (a.dir === "N" || a.dir === "S" || a.dir === "E" || a.dir === "W")) {
    return { type: "MOVE", dir: a.dir };
  }
  return null;
}

const app = express();
app.use(express.json());

app.get("/api/meta", (_req, res) => {
  const sample = createInitialState(0);
  res.json({
    service: "deepspire-ws",
    gameId: "deepspire",
    genre: "roguelike",
    contentVersion: sample.contentVersion,
    winDepth: sample.winDepth,
    challengeDay: {
      seed: CHALLENGE_DAY_SEED,
      label: CHALLENGE_DAY_LABEL,
    },
    defaultPort: PORT,
  });
});

app.get("/api/sessions", (_req, res) => {
  res.json({ sessions: [...sessions.values()].map(sessionPayload) });
});

app.post("/api/sessions", (req, res) => {
  const seed = typeof req.body?.seed === "number" ? req.body.seed : undefined;
  const autoPlay = req.body?.autoPlay !== false;
  const humanControl = req.body?.humanControl === true;
  const delayMs = typeof req.body?.botDelayMs === "number" ? req.body.botDelayMs : undefined;
  const sess = createSession(seed, humanControl, delayMs);
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
  const action = parseAction(req.body?.action);
  if (!action) {
    res.status(400).json({
      error: "invalid_body",
      hint: "{ action: { type: 'WAIT' | 'DESCEND' | 'MOVE', dir?: 'N'|'S'|'E'|'W' } }",
    });
    return;
  }
  if (checkWinCondition(sess.state).status === "ended") {
    res.status(400).json({ error: "game_ended" });
    return;
  }
  if (!sess.humanControl) {
    res.status(403).json({
      error: "human_control_disabled",
      hint: "PATCH /api/sessions/:id/control { humanControl: true }",
    });
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
    legalBeforeStep: legalPayload(before),
    legalNow: legalPayload(sess.state),
    narrative: narrativeLine(sess.state),
    humanControl: sess.humanControl,
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
  if (typeof req.body?.humanControl === "boolean") {
    sess.humanControl = req.body.humanControl;
  }
  stopBot(sess);
  startBot(sess);
  broadcast(sess, {
    type: "snapshot",
    ...snapshotFields(sess),
    message: sess.humanControl
      ? "Sterowanie: ty (klikaj akcje lub wyślij POST)."
      : "Sterowanie: bot.",
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
  stopBot(sess);
  startBot(sess);
  broadcast(sess, {
    type: "snapshot",
    ...snapshotFields(sess),
    message: "Zaktualizowano tempo / pauzę bota.",
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
  console.log(`[deepspire] http://127.0.0.1:${PORT}`);
  const demo = createSession(undefined, false);
  startBot(demo);
  console.log(`[deepspire] demo session (bot) ${demo.id}`);
});
