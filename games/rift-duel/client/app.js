/** @typedef {{ name: string, description: string }} CardMeta */

function playerLabelPl(pid) {
  return pid === "p0" ? "Strażnik" : "Rozwarstwienie";
}

const GLYPH = {
  strike: "⚔",
  ward: "🛡",
  mend: "✧",
  leech: "◇",
  surge: "☄",
  brace: "▣",
  ember: "※",
};

let cardMeta = {};
let ws = null;
let currentSessionId = null;
let logEntries = 0;
const MAX_LOG = 80;
let patchTimer = null;
let pausedUi = false;
let lastMatchNumber = 1;
let humanAsLocal = null;
let botStrategyLocal = "spike";
let gameOngoing = true;
let humanActionPending = false;

const DAILY_LB_KEY = "rift_daily_results_v1";
/** @type {{ date: string, seed: number, botStrategy: string, rulesPl?: string } | null} */
let displayedChallenge = null;
/** @type {string | null} */
let sessionDailyDate = null;

/** @type {{ campaignId: string, version: number, steps: { id: string, titlePl: string, introPl: string, modifiersHintPl: string }[] } | null} */
let campaignData = null;

function syncHumanRoleUi() {
  const sel = $("humanRole");
  const v = humanAsLocal == null ? "" : humanAsLocal;
  if (sel.value !== v) sel.value = v;
}

function syncBotStrategyUi() {
  const sel = $("botStrategy");
  if (![...sel.options].some((o) => o.value === botStrategyLocal)) return;
  if (sel.value !== botStrategyLocal) sel.value = botStrategyLocal;
}

function setBotStrategySelectLocked(locked) {
  const sel = $("botStrategy");
  sel.disabled = locked;
  syncBotStrategyHint();
  const hint = $("botStrategyHint");
  if (locked) {
    const t = sel.options[sel.selectedIndex]?.getAttribute("title") || "";
    hint.textContent = t ? `${t} — wyzwanie dnia: strategia ustalona przez serwer.` : "Wyzwanie dnia — strategia ustalona przez serwer.";
  }
}

function botStrategyLabel(id) {
  const sel = $("botStrategy");
  const o = [...sel.options].find((x) => x.value === id);
  return o ? o.textContent.trim() : id;
}

function syncBotStrategyHint() {
  const sel = $("botStrategy");
  const t = sel.options[sel.selectedIndex]?.getAttribute("title") || "";
  $("botStrategyHint").textContent = t || "Wybór wpływa na tę sesję (PATCH) i na nowe sesje.";
}

function fillBotStrategies(list) {
  const sel = $("botStrategy");
  const prev = botStrategyLocal;
  sel.innerHTML = "";
  const rows =
    list && list.length
      ? list
      : [
          { id: "spike", labelPl: "Spike", hintPl: "Wartość + lethal" },
          { id: "random", labelPl: "Losowy", hintPl: "Chaos" },
          { id: "aggro", labelPl: "Agresor", hintPl: "Obrażenia" },
          { id: "turtle", labelPl: "Obrońca", hintPl: "Tarcze" },
          { id: "disruptor", labelPl: "Kontrola", hintPl: "Leech" },
          { id: "timmy", labelPl: "Timmy", hintPl: "Duże karty" },
        ];
  const training = rows.filter((r) => r.id !== "random");
  const spectacle = rows.filter((r) => r.id === "random");
  const appendOpts = (parent, arr) => {
    for (const s of arr) {
      const o = document.createElement("option");
      o.value = s.id;
      o.textContent = s.labelPl;
      if (s.hintPl) o.title = s.hintPl;
      parent.appendChild(o);
    }
  };
  if (training.length && spectacle.length) {
    const g1 = document.createElement("optgroup");
    g1.label = "Trening (przewidywalny AI)";
    appendOpts(g1, training);
    sel.appendChild(g1);
    const g2 = document.createElement("optgroup");
    g2.label = "Widowisko (chaos)";
    appendOpts(g2, spectacle);
    sel.appendChild(g2);
  } else {
    appendOpts(sel, rows);
  }
  const pick = [...sel.options].some((o) => o.value === prev) ? prev : "spike";
  sel.value = pick;
  botStrategyLocal = pick;
  syncBotStrategyHint();
}

function renderDeckCatalog(catalog) {
  if (!catalog) return;
  $("deckIntro").textContent = catalog.introPl || "";
  const tb = $("deckTableBody");
  tb.innerHTML = "";
  for (const row of catalog.breakdown || []) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td><strong>${escapeHtml(row.name)}</strong> <span class="mono dim">${escapeHtml(row.id)}</span></td><td class="mono">${row.count}</td><td>${escapeHtml(row.description)}</td>`;
    tb.appendChild(tr);
  }
  $("deckTotal").textContent = `Łącznie na gracza: ${catalog.totalCardsPerPlayer} kart w talii startowej (przed tasowaniem).`;
}

function renderLegalOptions(listEl, headEl, data, highlightN, allowHumanClick) {
  if (!data || data.count === 0) {
    headEl.textContent = "Brak legalnych ruchów.";
    listEl.innerHTML = "";
    return;
  }
  const canClick =
    !!allowHumanClick &&
    gameOngoing &&
    humanAsLocal &&
    data.activePlayerId === humanAsLocal;
  const who = playerLabelPl(data.activePlayerId);
  headEl.textContent = `${who} — ${data.count} opcji${canClick ? " (kliknij Wykonaj przy swojej turze)" : ""}:`;
  listEl.innerHTML = "";

  const appendRow = (ol, o) => {
    const li = document.createElement("li");
    if (highlightN != null && o.n === highlightN) li.classList.add("legal-chosen");
    const main = document.createElement("div");
    main.innerHTML = `<span class="legal-n mono">${o.n}.</span> <span class="legal-short">${escapeHtml(o.shortLabel)}</span><span class="legal-detail">${escapeHtml(o.detail)}</span>`;
    li.appendChild(main);
    if (canClick) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "legal-play-btn";
      btn.textContent = "Wykonaj";
      btn.disabled = humanActionPending;
      btn.addEventListener("click", () => submitHumanAction(o.action, btn));
      li.appendChild(btn);
    }
    ol.appendChild(li);
  };

  const appendGroup = (title, opts) => {
    if (opts.length === 0) return;
    const h = document.createElement("h4");
    h.className = "legal-subhead";
    h.textContent = title;
    listEl.appendChild(h);
    const ol = document.createElement("ol");
    ol.className = "legal-list";
    for (const o of opts) appendRow(ol, o);
    listEl.appendChild(ol);
  };

  const plays = data.options.filter((o) => o.action.type === "PLAY_CARD");
  const ends = data.options.filter((o) => o.action.type === "END_TURN");
  appendGroup("Zagrania z ręki", plays);
  appendGroup("Koniec tury", ends);
}

async function submitHumanAction(action, btn) {
  if (!currentSessionId || humanActionPending) return;
  humanActionPending = true;
  if (btn) btn.disabled = true;
  try {
    const res = await fetch(`/api/sessions/${encodeURIComponent(currentSessionId)}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      $("lastAction").textContent = j.error || res.statusText || "Błąd akcji";
    }
  } catch (e) {
    $("lastAction").textContent = String(e.message);
  } finally {
    humanActionPending = false;
  }
}

async function patchHumanControl(value) {
  if (!currentSessionId) return;
  const humanAs = value === "" ? null : value;
  await fetch(`/api/sessions/${encodeURIComponent(currentSessionId)}/control`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ humanAs }),
  });
}

function $(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el;
}

function setLive(on, text) {
  $("liveDot").classList.toggle("live", on);
  $("liveText").textContent = text;
}

function cardHtml(cardId, extraClass = "") {
  const m = cardMeta[cardId];
  const name = m ? m.name : cardId;
  const desc = m ? m.description : "";
  const g = GLYPH[cardId] || "◆";
  const safeDesc = desc.replace(/"/g, "&quot;").replace(/</g, " ");
  return `<div class="card-visual card-${cardId} ${extraClass}" tabindex="0" role="img" aria-label="${name}: ${safeDesc}" title="${name} — ${safeDesc}">
    <span class="card-glyph">${g}</span>
    <span class="card-name">${name}</span>
    <span class="card-id mono">${cardId}</span>
  </div>`;
}

function renderHand(elId, cards) {
  const el = $(elId);
  el.innerHTML = cards.map((c) => cardHtml(c)).join("");
}

function renderState(state, lastLine) {
  const maxHp = state.players.p0.maxHp;
  $("p0hp").textContent = String(state.players.p0.hp);
  $("p0ward").textContent = String(state.players.p0.ward);
  $("p1hp").textContent = String(state.players.p1.hp);
  $("p1ward").textContent = String(state.players.p1.ward);

  $("p0deck").textContent = `talia ${state.players.p0.deck.length}`;
  $("p1deck").textContent = `talia ${state.players.p1.deck.length}`;
  $("p0disc").textContent = `odrzut ${state.players.p0.discard.length}`;
  $("p1disc").textContent = `odrzut ${state.players.p1.discard.length}`;

  const p0pct = (state.players.p0.hp / maxHp) * 100;
  const p1pct = (state.players.p1.hp / maxHp) * 100;
  $("p0hpbar").style.width = `${Math.max(0, Math.min(100, p0pct))}%`;
  $("p1hpbar").style.width = `${Math.max(0, Math.min(100, p1pct))}%`;

  renderHand("p0hand", state.players.p0.hand);
  renderHand("p1hand", state.players.p1.hand);

  const mid = state.missionId ? String(state.missionId) : "—";
  $("meta").textContent = `Partia #${lastMatchNumber} · misja ${mid} · tura ${state.turnIndex} · aktywny ${playerLabelPl(state.activePlayerId)} · zagrań ${state.cardsPlayedThisTurn}/${state.maxPlaysPerTurn} · seed ${state.rngSeed}`;

  if (lastLine) $("lastAction").textContent = lastLine;

  $("panelP0").classList.toggle("active-turn", state.activePlayerId === "p0");
  $("panelP1").classList.toggle("active-turn", state.activePlayerId === "p1");
}

function setNarrative(text) {
  const n = $("stateNarrative");
  n.textContent = text || "";
}

function setBotBrain(reasoning, effectLine) {
  $("botReasoning").textContent = reasoning || "—";
  const ef = $("effectLine");
  if (effectLine) {
    ef.textContent = "Efekt karty: " + effectLine;
    ef.hidden = false;
  } else {
    ef.textContent = "";
    ef.hidden = true;
  }
}

function showLastPlayedCard(cardId) {
  const slot = $("lastPlayedCard");
  if (!cardId) {
    slot.innerHTML = "";
    return;
  }
  slot.innerHTML = cardHtml(cardId, "card-visual--pop");
}

function pushLog(html) {
  const log = $("log");
  const div = document.createElement("div");
  div.className = "entry";
  div.innerHTML = html;
  log.prepend(div);
  logEntries++;
  while (logEntries > MAX_LOG) {
    log.lastElementChild?.remove();
    logEntries--;
  }
}

async function patchBot(body) {
  if (!currentSessionId) return;
  const res = await fetch(`/api/sessions/${encodeURIComponent(currentSessionId)}/bot`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (j.botStrategy) {
    botStrategyLocal = j.botStrategy;
    syncBotStrategyUi();
    syncBotStrategyHint();
  }
}

function syncControlsFromServer(delayMs, isPaused) {
  const r = $("delayRange");
  const v = Math.max(Number(r.min), Math.min(Number(r.max), delayMs));
  r.value = String(v);
  $("delayLabel").textContent = `${v} ms`;
  pausedUi = isPaused;
  $("btnPause").classList.toggle("active", isPaused);
  $("btnPause").textContent = isPaused ? "Wznów" : "Pauza";
}

function connectWs(sessionId) {
  if (ws) {
    ws.close();
    ws = null;
  }
  sessionDailyDate = null;
  setBotStrategySelectLocked(false);
  currentSessionId = sessionId;
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const url = `${proto}://${location.host}/ws?sessionId=${encodeURIComponent(sessionId)}`;
  ws = new WebSocket(url);

  ws.onopen = () => setLive(true, "Połączono · nasłuch");

  ws.onclose = () => {
    setLive(false, "Rozłączono");
  };

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === "snapshot") {
      gameOngoing = true;
      if (msg.dailyChallengeDate !== undefined) {
        sessionDailyDate = msg.dailyChallengeDate;
        setBotStrategySelectLocked(!!sessionDailyDate);
      }
      if (msg.humanAs !== undefined) humanAsLocal = msg.humanAs;
      syncHumanRoleUi();
      if (msg.botStrategy !== undefined) {
        botStrategyLocal = msg.botStrategy;
        syncBotStrategyUi();
        syncBotStrategyHint();
      }
      if (msg.matchNumber != null) lastMatchNumber = msg.matchNumber;
      const mb = $("matchBadge");
      mb.textContent = `Partia #${lastMatchNumber}`;
      mb.dataset.match = String(lastMatchNumber);
      if (msg.botDelayMs != null && msg.botPaused != null) {
        syncControlsFromServer(msg.botDelayMs, msg.botPaused);
      }
      $("legalBeforeWrap").hidden = true;
      renderLegalOptions($("legalNowList"), $("legalNowHead"), msg.legalNow, null, true);
      setNarrative(msg.narrative || "");
      renderState(msg.state, msg.message || "Zsynchronizowano stan.");
      if (humanAsLocal) {
        setBotBrain(
          msg.state.activePlayerId === humanAsLocal
            ? "Twoja tura — wybierz opcję poniżej (Wykonaj)."
            : "Tura bota — obserwuj lub poczekaj.",
          null,
        );
      } else {
        setBotBrain("Obserwacja — obaj gracze to bot.", null);
      }
      showLastPlayedCard(null);
      $("winnerBanner").classList.add("hidden");
      pushLog(`<strong>Snapshot</strong> ${msg.message || ""}`);
      document.querySelectorAll("#sessionList button").forEach((b) => {
        b.classList.toggle("active", b.dataset.sid === currentSessionId);
      });
    }
    if (msg.type === "step") {
      gameOngoing = true;
      if (msg.dailyChallengeDate !== undefined) {
        sessionDailyDate = msg.dailyChallengeDate;
        setBotStrategySelectLocked(!!sessionDailyDate);
      }
      if (msg.humanAs !== undefined) humanAsLocal = msg.humanAs;
      syncHumanRoleUi();
      if (msg.botStrategy !== undefined) {
        botStrategyLocal = msg.botStrategy;
        syncBotStrategyUi();
        syncBotStrategyHint();
      }
      if (msg.matchNumber != null) {
        lastMatchNumber = msg.matchNumber;
        $("matchBadge").textContent = `Partia #${lastMatchNumber}`;
      }
      if (msg.legalBeforeStep) {
        $("legalBeforeWrap").hidden = false;
        renderLegalOptions(
          $("legalBeforeList"),
          $("legalBeforeHead"),
          msg.legalBeforeStep,
          msg.chosenLegalN ?? null,
          false,
        );
      }
      renderLegalOptions($("legalNowList"), $("legalNowHead"), msg.legalNow, null, true);
      if (msg.narrative) setNarrative(msg.narrative);
      setBotBrain(msg.reasoning || "—", msg.effectLine);
      const line = msg.summary || "";
      renderState(msg.state, line);
      if (msg.playedCardId) {
        showLastPlayedCard(msg.playedCardId);
      } else {
        showLastPlayedCard(null);
      }
      let logExtra = msg.reasoning ? `<br><span class="log-reason">${escapeHtml(msg.reasoning)}</span>` : "";
      if (msg.effectLine) logExtra += `<br><span class="log-effect">${escapeHtml(msg.effectLine)}</span>`;
      const who = msg.actor === "human" ? "TY" : "Bot";
      pushLog(`#${msg.stepIndex} [${who}] <strong>${escapeHtml(line)}</strong>${logExtra}`);
    }
    if (msg.type === "ended") {
      gameOngoing = false;
      if (msg.dailyChallengeDate !== undefined) {
        sessionDailyDate = msg.dailyChallengeDate;
        setBotStrategySelectLocked(!!sessionDailyDate);
      }
      if (msg.humanAs !== undefined) humanAsLocal = msg.humanAs;
      syncHumanRoleUi();
      if (msg.botStrategy !== undefined) {
        botStrategyLocal = msg.botStrategy;
        syncBotStrategyUi();
        syncBotStrategyHint();
      }
      if (msg.matchNumber != null) {
        lastMatchNumber = msg.matchNumber;
        $("matchBadge").textContent = `Partia #${lastMatchNumber}`;
      }
      $("legalBeforeWrap").hidden = true;
      renderLegalOptions($("legalNowList"), $("legalNowHead"), msg.legalNow, null, true);
      setNarrative(narrativeFromState(msg.state));
      renderState(msg.state, msg.resultLine || `Wygrywa ${msg.winner}`);
      setBotBrain("Partia zakończona.", null);
      showLastPlayedCard(null);
      $("winnerLine").textContent =
        msg.resultLine || `Zwycięzca: ${playerLabelPl(msg.winner)}`;
      $("winnerBanner").classList.remove("hidden");
      pushLog(`<strong>KONIEC</strong> ${escapeHtml(msg.resultLine || msg.winner)}`);
      if (msg.dailyChallengeDate && humanAsLocal && msg.state) {
        recordDailyAttempt({
          date: msg.dailyChallengeDate,
          sessionId: currentSessionId,
          won: msg.winner === humanAsLocal,
          turns: msg.state.turnIndex,
          humanAs: humanAsLocal,
        });
      }
    }
  };
}

function escapeHtml(s) {
  if (!s) return "";
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function narrativeFromState(state) {
  const { p0, p1 } = state.players;
  return [
    `Tura ${state.turnIndex} · aktywny ${playerLabelPl(state.activePlayerId)} · zagrań ${state.cardsPlayedThisTurn}/${state.maxPlaysPerTurn}.`,
    `Tarcza: Strażnik ${p0.ward}, Rozwarstwienie ${p1.ward}. Talie: ${p0.deck.length} / ${p1.deck.length}. Zmęczenie: ${state.fatigueDamage.p0} / ${state.fatigueDamage.p1}.`,
  ].join("\n");
}

async function loadMeta() {
  const r = await fetch("/api/meta");
  const j = await r.json();
  cardMeta = j.cardMeta || {};
  renderDeckCatalog(j.deckCatalog);
  fillBotStrategies(j.botStrategies);
  return j;
}

function fillCampaignFromMeta(c) {
  campaignData = c;
  const panel = $("campaignPanel");
  if (!c || !c.steps || c.steps.length === 0) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  $("campaignSub").textContent = `${c.campaignId} · wer. ${c.version}`;
  const sel = $("campaignStep");
  sel.innerHTML = "";
  for (const st of c.steps) {
    const o = document.createElement("option");
    o.value = st.id;
    o.textContent = st.titlePl;
    sel.appendChild(o);
  }
  syncCampaignIntro();
}

function syncCampaignIntro() {
  const sel = $("campaignStep");
  const id = sel.value;
  const st = campaignData?.steps?.find((x) => x.id === id);
  if (!st) return;
  $("campaignIntro").textContent = st.introPl || "";
  $("campaignModifiers").textContent = st.modifiersHintPl || "";
}

async function resolveDisplayedChallenge(metaDc) {
  if (!metaDc || !metaDc.date) return null;
  const params = new URLSearchParams(location.search);
  const d = params.get("daily");
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    try {
      const res = await fetch(`/api/daily-challenge/${encodeURIComponent(d)}`);
      if (res.ok) {
        const j = await res.json();
        return { ...j, rulesPl: metaDc.rulesPl };
      }
    } catch {
      /* ignore */
    }
  }
  return metaDc;
}

function renderChallengePanel() {
  const dc = displayedChallenge;
  const panel = $("challengePanel");
  if (!dc) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  $("challengeMeta").textContent = `${dc.date} · seed ${dc.seed} · bot: ${botStrategyLabel(dc.botStrategy)} (${dc.botStrategy})`;
  $("challengeRules").textContent = dc.rulesPl || "";
  renderLeaderboard();
}

function recordDailyAttempt(entry) {
  let rows = [];
  try {
    rows = JSON.parse(localStorage.getItem(DAILY_LB_KEY) || "[]");
    if (!Array.isArray(rows)) rows = [];
  } catch {
    rows = [];
  }
  rows.unshift(entry);
  if (rows.length > 60) rows.length = 60;
  try {
    localStorage.setItem(DAILY_LB_KEY, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
  renderLeaderboard();
}

function renderLeaderboard() {
  const host = $("dailyLeaderboard");
  let rows = [];
  try {
    rows = JSON.parse(localStorage.getItem(DAILY_LB_KEY) || "[]");
    if (!Array.isArray(rows)) rows = [];
  } catch {
    rows = [];
  }
  if (rows.length === 0) {
    host.innerHTML = '<p class="dim">Brak zapisanych prób na tym urządzeniu.</p>';
    return;
  }
  const lines = rows
    .slice(0, 15)
    .map(
      (r) =>
        `<li>${escapeHtml(r.date)} · ${r.won ? "wygrana" : "porażka"} · ${escapeHtml(r.humanAs)} · tury ${escapeHtml(String(r.turns))}</li>`,
    )
    .join("");
  host.innerHTML = `<h3>Ostatnie próby (tylko ta przeglądarka)</h3><ul class="daily-lb-list mono">${lines}</ul>`;
}

async function refreshSessions(selectId) {
  const r = await fetch("/api/sessions");
  const j = await r.json();
  const ul = $("sessionList");
  ul.innerHTML = "";
  for (const s of j.sessions) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.sid = s.id;
    const pauseTag = s.botPaused ? " ⏸" : "";
    const hum = s.humanAs ? ` · H:${s.humanAs === "p0" ? "Str" : "Roz"}` : "";
    const bs = s.botStrategy ? ` · B:${s.botStrategy}` : "";
    const daily = s.dailyChallengeDate ? ` · ★${s.dailyChallengeDate}` : "";
    const miss = s.missionId ? ` · M:${String(s.missionId).slice(0, 10)}` : "";
    b.textContent = `${s.id.slice(0, 10)}… · #${s.matchNumber} · HP ${s.p0Hp}/${s.p1Hp} · 👁${s.spectators}${s.botRunning ? " · bot" : ""}${hum}${bs}${daily}${miss}${pauseTag}`;
    b.classList.toggle("active", s.id === selectId || s.id === currentSessionId);
    b.addEventListener("click", () => connectWs(s.id));
    li.appendChild(b);
    ul.appendChild(li);
  }
  return j.sessions;
}

async function ensureSession() {
  let sessions = (await refreshSessions()).slice();
  if (sessions.length === 0) {
    const hr = $("humanRole").value;
    const cr = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        autoPlay: true,
        humanAs: hr === "" ? null : hr,
        botStrategy: $("botStrategy").value || "spike",
      }),
    });
    const created = await cr.json();
    await refreshSessions(created.id);
    return created.id;
  }
  return sessions[0].id;
}

$("btnRefresh").addEventListener("click", () => refreshSessions());

$("btnNew").addEventListener("click", async () => {
  const delay = Number($("delayRange").value);
  const hr = $("humanRole").value;
  const cr = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      autoPlay: true,
      botDelayMs: delay,
      humanAs: hr === "" ? null : hr,
      botStrategy: $("botStrategy").value || "spike",
    }),
  });
  const created = await cr.json();
  await refreshSessions(created.id);
  connectWs(created.id);
});

$("delayRange").addEventListener("input", () => {
  const v = Number($("delayRange").value);
  $("delayLabel").textContent = `${v} ms`;
  if (patchTimer) clearTimeout(patchTimer);
  patchTimer = setTimeout(() => {
    patchTimer = null;
    patchBot({ delayMs: v });
  }, 320);
});

$("btnPause").addEventListener("click", async () => {
  pausedUi = !pausedUi;
  await patchBot({ paused: pausedUi });
  syncControlsFromServer(Number($("delayRange").value), pausedUi);
});

$("humanRole").addEventListener("change", async () => {
  const v = $("humanRole").value;
  humanAsLocal = v === "" ? null : v;
  await patchHumanControl(v);
});

$("botStrategy").addEventListener("change", async () => {
  if ($("botStrategy").disabled) return;
  botStrategyLocal = $("botStrategy").value;
  syncBotStrategyHint();
  await patchBot({ botStrategy: botStrategyLocal });
});

$("btnDailyStart").addEventListener("click", async () => {
  if (!displayedChallenge) return;
  const hr = $("humanRole").value;
  if (hr === "") {
    window.alert("Wybierz stronę: Strażnik lub Rozwarstwienie — wyzwanie jest przeciwko jednemu botowi.");
    return;
  }
  const delay = Number($("delayRange").value);
  const cr = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      autoPlay: true,
      botDelayMs: delay,
      humanAs: hr,
      dailyChallenge: displayedChallenge.date,
    }),
  });
  const created = await cr.json().catch(() => ({}));
  if (!cr.ok) {
    $("lastAction").textContent = created.error || "Nie udało się utworzyć wyzwania";
    return;
  }
  await refreshSessions(created.id);
  connectWs(created.id);
});

$("btnDailyCopyLink").addEventListener("click", async () => {
  if (!displayedChallenge) return;
  const u = new URL(`${location.origin}${location.pathname}`);
  u.searchParams.set("daily", displayedChallenge.date);
  const btn = $("btnDailyCopyLink");
  try {
    await navigator.clipboard.writeText(u.toString());
    const prev = btn.textContent;
    btn.textContent = "Skopiowano!";
    setTimeout(() => {
      btn.textContent = prev;
    }, 2000);
  } catch {
    window.prompt("Skopiuj link:", u.toString());
  }
});

$("campaignStep").addEventListener("change", () => syncCampaignIntro());

$("btnCampaignStart").addEventListener("click", async () => {
  const missionId = $("campaignStep").value;
  if (!missionId) return;
  const hr = $("humanRole").value;
  if (hr === "") {
    window.alert("Wybierz stronę: Strażnik lub Rozwarstwienie.");
    return;
  }
  const delay = Number($("delayRange").value);
  const cr = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      autoPlay: true,
      botDelayMs: delay,
      humanAs: hr,
      botStrategy: $("botStrategy").value || "spike",
      missionId,
    }),
  });
  const created = await cr.json().catch(() => ({}));
  if (!cr.ok) {
    $("lastAction").textContent = created.error || "Nie udało się utworzyć sesji misji";
    return;
  }
  await refreshSessions(created.id);
  connectWs(created.id);
});

function applyLegalCompact(on) {
  document.body.classList.toggle("legal-compact-legal", on);
  try {
    localStorage.setItem("rift_legal_compact", on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

$("chkLegalCompact").addEventListener("change", () => {
  applyLegalCompact($("chkLegalCompact").checked);
});

$("chkAnim").addEventListener("change", () => {
  const on = $("chkAnim").checked;
  document.body.classList.toggle("no-anim", !on);
  try {
    localStorage.setItem("rift_anim", on ? "1" : "0");
  } catch {
    /* ignore */
  }
});

async function init() {
  setLive(false, "Start…");
  try {
    const a = localStorage.getItem("rift_anim");
    if (a === "0") {
      $("chkAnim").checked = false;
      document.body.classList.add("no-anim");
    }
    const lc = localStorage.getItem("rift_legal_compact");
    if (lc === "1") {
      $("chkLegalCompact").checked = true;
      applyLegalCompact(true);
    }
  } catch {
    /* ignore */
  }

  const meta = await loadMeta();
  fillCampaignFromMeta(meta.campaign || null);
  displayedChallenge = await resolveDisplayedChallenge(meta.dailyChallenge);
  renderChallengePanel();

  const sid = await ensureSession();
  await refreshSessions(sid);
  connectWs(sid);
  setInterval(() => refreshSessions(), 5000);
}

init().catch((e) => {
  console.error(e);
  $("lastAction").textContent = "Błąd: " + e.message;
});
