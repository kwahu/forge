/** @typedef {{ type: string, dir?: string }} GameAction */

function $(id) {
  return document.getElementById(id);
}

let ws = null;
let sessionId = null;
let humanMode = false;
let gameOngoing = true;
let lastState = null;
/** Ostatnia lista z serwera — do ponownego renderu przy przełączeniu „kompakt”. */
let lastLegalNow = null;
let metaChallengeSeed = null;

function setLive(on) {
  $("liveDot").classList.toggle("live", on);
  $("liveText").textContent = on ? "Połączono (WebSocket)" : "Rozłączono";
}

function pushLog(line) {
  const log = $("log");
  const li = document.createElement("li");
  li.textContent = line;
  log.insertBefore(li, log.firstChild);
  while (log.children.length > 80) log.removeChild(log.lastChild);
}

function renderGrid(state) {
  const grid = $("grid");
  grid.innerHTML = "";
  const w = state.width;
  const h = state.height;
  grid.style.gridTemplateColumns = `repeat(${w}, 26px)`;
  const px = state.player.x;
  const py = state.player.y;
  const enemyAt = (x, y) => state.enemies.find((e) => e.hp > 0 && e.x === x && e.y === y);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      const g = state.grid[y][x];
      if (g === "wall") cell.classList.add("cell-wall");
      else if (g === "stairs") cell.classList.add("cell-stairs");
      else cell.classList.add("cell-floor");

      const foe = enemyAt(x, y);
      if (foe) {
        cell.textContent = String(foe.hp);
        cell.classList.add("cell-enemy");
      }
      if (x === px && y === py) {
        cell.textContent = "@";
        cell.classList.add("cell-player");
      }
      grid.appendChild(cell);
    }
  }

  $("boardMeta").textContent = `Głębokość ${state.depth}/${state.winDepth} · tura ${state.turnIndex} · seed sesji ${window.__matchSeed ?? "—"}`;
}

function isLegalCompact() {
  return $("chkLegalCompact").checked;
}

function renderLegal(legalNow) {
  lastLegalNow = legalNow;
  const head = $("legalHead");
  const container = $("legalContainer");
  if (!legalNow || legalNow.count === 0) {
    head.textContent = "Brak akcji (koniec gry lub oczekiwanie).";
    container.innerHTML = "";
    return;
  }
  const canClick = humanMode && gameOngoing;
  const compact = isLegalCompact();
  head.textContent = canClick
    ? `Bohater — ${legalNow.count} opcji (klik „Wykonaj” lub strzałki):`
    : `Bohater — ${legalNow.count} opcji (tryb obserwacji):`;

  const base = legalNow.options.filter((o) => o.action.type !== "MOVE");
  const moves = legalNow.options.filter((o) => o.action.type === "MOVE");

  function appendRow(ol, o) {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = compact ? `${o.n}. ${o.shortLabel}` : `${o.n}. ${o.shortLabel} — ${o.detail}`;
    li.appendChild(span);
    if (canClick) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "Wykonaj";
      btn.addEventListener("click", () => submitAction(o.action));
      li.appendChild(btn);
    }
    ol.appendChild(li);
  }

  function mkBlock(title, opts) {
    if (opts.length === 0) return;
    const wrap = document.createElement("div");
    wrap.className = "legal-block";
    const h = document.createElement("h3");
    h.className = "legal-block-title";
    h.textContent = title;
    wrap.appendChild(h);
    const ol = document.createElement("ol");
    ol.className = "legal-list";
    for (const o of opts) appendRow(ol, o);
    wrap.appendChild(ol);
    container.appendChild(wrap);
  }

  container.innerHTML = "";
  mkBlock("Schody i czekanie", base);
  mkBlock("Ruch", moves);
}

async function submitAction(action) {
  if (!sessionId || !humanMode || !gameOngoing) return;
  try {
    const res = await fetch(`/api/sessions/${sessionId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      pushLog(`Błąd: ${j.error ?? res.status} ${j.hint ? `— ${j.hint}` : ""}`);
    }
  } catch (e) {
    pushLog(`Sieć: ${e.message}`);
  }
}

function applySnapshot(msg) {
  lastState = msg.state;
  window.__matchSeed = msg.matchSeed;
  gameOngoing = true;
  $("endBanner").classList.add("hidden");
  renderGrid(msg.state);
  renderLegal(msg.legalNow);
  if (msg.message) pushLog(msg.message);
  if (msg.narrative) pushLog(msg.narrative);
}

function applyStep(msg) {
  lastState = msg.state;
  renderGrid(msg.state);
  renderLegal(msg.legalNow);
  const who = msg.actor === "human" ? "Ty" : "Bot";
  pushLog(`${who}: ${msg.summary ?? ""}`);
}

function applyEnded(msg) {
  gameOngoing = false;
  lastLegalNow = msg.legalNow ?? null;
  renderGrid(msg.state);
  renderLegal(msg.legalNow);
  $("endTitle").textContent = msg.outcome === "victory" ? "Zwycięstwo" : "Porażka";
  $("endLine").textContent = msg.resultLine || "";
  $("endBanner").classList.remove("hidden");
}

function connectWs() {
  if (ws) {
    ws.close();
    ws = null;
  }
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${proto}//${location.host}/ws?sessionId=${encodeURIComponent(sessionId)}`);
  ws.onopen = () => setLive(true);
  ws.onclose = () => setLive(false);
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === "snapshot") applySnapshot(msg);
    else if (msg.type === "step") applyStep(msg);
    else if (msg.type === "ended") applyEnded(msg);
  };
}

async function fetchMeta() {
  const res = await fetch("/api/meta");
  const m = await res.json();
  let extra = "";
  if (m.challengeDay) {
    metaChallengeSeed = m.challengeDay.seed;
    extra = ` · Wyzwanie ${m.challengeDay.label}: seed ${m.challengeDay.seed}`;
  }
  $("metaFooter").textContent = `${m.gameId} · content ${m.contentVersion} · ${m.service}${extra}`;
}

async function createSessionAndConnect() {
  const mode = $("modeSelect").value;
  humanMode = mode === "human";
  const seedRaw = $("seedInput").value.trim();
  const seed = seedRaw === "" ? undefined : Number(seedRaw);
  const body = {
    autoPlay: !humanMode,
    humanControl: humanMode,
    botDelayMs: Number($("delayRange").value),
  };
  if (seed !== undefined && !Number.isNaN(seed)) body.seed = seed >>> 0;

  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    pushLog("Nie udało się utworzyć sesji.");
    return;
  }
  const s = await res.json();
  sessionId = s.id;
  $("delayRange").value = String(s.botDelayMs);
  $("delayLabel").textContent = `${s.botDelayMs} ms`;
  pushLog(`Sesja ${sessionId} · seed ${s.matchSeed}`);
  connectWs();
}

async function patchBot() {
  if (!sessionId) return;
  await fetch(`/api/sessions/${sessionId}/bot`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      delayMs: Number($("delayRange").value),
      paused: $("btnPause").classList.contains("active"),
    }),
  });
}

async function togglePause() {
  $("btnPause").classList.toggle("active");
  await patchBot();
}

function dirFromKey(key) {
  if (key === "ArrowUp") return "N";
  if (key === "ArrowDown") return "S";
  if (key === "ArrowRight") return "E";
  if (key === "ArrowLeft") return "W";
  return null;
}

window.addEventListener("keydown", (e) => {
  if (!humanMode || !gameOngoing || !lastState) return;
  const tag = e.target && e.target.tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
  if (e.key === " ") {
    e.preventDefault();
    submitAction({ type: "WAIT" });
    return;
  }
  const dir = dirFromKey(e.key);
  if (!dir) return;
  e.preventDefault();
  const legal = getValidActionsFromState(lastState);
  const move = legal.find((a) => a.type === "MOVE" && a.dir === dir);
  if (move) submitAction(move);
});

function getValidActionsFromState(state) {
  /** Client-side mirror: only for keyboard; server validates. */
  const acts = [{ type: "WAIT" }];
  const px = state.player.x;
  const py = state.player.y;
  if (state.terminal) return [];
  if (px === state.stairs.x && py === state.stairs.y) acts.push({ type: "DESCEND" });
  const dirs = ["N", "S", "E", "W"];
  const dxy = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
  for (const dir of dirs) {
    const [dx, dy] = dxy[dir];
    const tx = px + dx;
    const ty = py + dy;
    if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) continue;
    const c = state.grid[ty][tx];
    if (c === "wall") continue;
    const foe = state.enemies.find((en) => en.hp > 0 && en.x === tx && en.y === ty);
    if (foe || c === "floor" || c === "stairs") acts.push({ type: "MOVE", dir });
  }
  return acts;
}

$("delayRange").addEventListener("input", () => {
  $("delayLabel").textContent = `${$("delayRange").value} ms`;
});

$("delayRange").addEventListener("change", () => patchBot());

$("btnPause").addEventListener("click", () => togglePause());

$("btnNewSession").addEventListener("click", () => createSessionAndConnect());

$("modeSelect").addEventListener("change", async () => {
  if (!sessionId) return;
  const human = $("modeSelect").value === "human";
  humanMode = human;
  const pr = await fetch(`/api/sessions/${sessionId}/control`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ humanControl: human }),
  });
  await patchBot();
  if (pr.ok) {
    const full = await fetch(`/api/sessions/${sessionId}`).then((x) => x.json());
    applySnapshot({ type: "snapshot", ...full });
  }
});

const compactStored = localStorage.getItem("deepspireLegalCompact");
if (compactStored === "1") $("chkLegalCompact").checked = true;

$("chkLegalCompact").addEventListener("change", () => {
  localStorage.setItem("deepspireLegalCompact", $("chkLegalCompact").checked ? "1" : "0");
  renderLegal(lastLegalNow);
});

$("btnChallengeSeed").addEventListener("click", () => {
  if (metaChallengeSeed != null) {
    $("seedInput").value = String(metaChallengeSeed >>> 0);
  }
});

fetchMeta();
createSessionAndConnect();
