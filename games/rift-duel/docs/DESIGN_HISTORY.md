# Historia rozwoju koncepcji — Pęknięcie (Rift Duel)

Chronologiczny dziennik **decyzji designowych, fabularnych i produktowych**. Najnowsze wpisy na górze.

---

## Jak śledzić rozwój

| Plik | Przeznaczenie |
|------|----------------|
| `docs/GDD.md` | Pełny obraz gry (mechaniki + fabuła + marketing + tech) |
| `docs/MANIFEST.md` | Skrót „co jest prawdą teraz” dla agentów / Ciebie |
| `docs/DESIGN_HISTORY.md` | Ten plik — *dlaczego* i *kiedy* coś się zmieniło |
| `GRA_RIFT_DUEL.md` | Suchy opis zasad (szybki reference) |
| `docs/BACKLOG.yaml` | Zadania w stylu FORGE |
| `docs/FEEDBACK_FB-RD-*.md` | Zebrane metryki + decyzje (np. FB-RD-002) |

---

## [2026-03-29] — MissionConfig + kampania tekstowa (0.7.3, RD-MIS-002 / RD-NAR-004 **done**)

- **Silnik:** [`createInitialState`](../src/rules.ts) przyjmuje opcjonalną misję [`MissionStartOptions`](../src/mission.ts) (`extraOpeningDraws` dla p0/p1 po standardowym 5+5); [`GameState.missionId`](../src/types.ts).
- **Treść:** [`content/campaign.json`](../content/campaign.json) — 5 kroków z `titlePl`, `introPl`, modyfikatorami; parser [`src/campaign.ts`](../src/campaign.ts).
- **Serwer:** ładowanie kampanii przy starcie; `GET /api/meta` → `campaign`; `POST /api/sessions` `{ missionId }`; lista sesji ze `missionId`.
- **Klient:** panel **Kampania** (wybór kroku, intro, przycisk nowej sesji); meta areny pokazuje `misja …`.
- **Testy:** [`tests/mission.test.ts`](../tests/mission.test.ts).

---

## [2026-03-29] — Wyzwanie dnia + retencja lokalna (0.7.2, RD-RET-009 **done**)

- **Serwer:** [`server/dailyChallenge.ts`](../server/dailyChallenge.ts) — seed i strategia bota (bez `random`) z daty UTC; `GET /api/daily-challenge/:date`; `GET /api/meta` rozszerzone o `dailyChallenge`; `POST /api/sessions` z `{ dailyChallenge: true | "YYYY-MM-DD" }` ustawia `challengeLockSeed` (rematch bez zmiany seeda); w sesji wyzwania `PATCH .../bot` **nie** zmienia `botStrategy`.
- **Klient:** panel „Wyzwanie dnia”, przyciski nowej sesji wyzwania i kopiowania linku; `localStorage` `rift_daily_results_v1`; lista sesji oznacza ★data przy wyzwaniu.
- **Testy:** [`tests/dailyChallenge.test.ts`](../tests/dailyChallenge.test.ts).

---

## [2026-03-29] — Grupowanie opcji prawnych + demo spike (0.7.1)

- **Klient:** [`legalBeforeList` / `legalNowList`](../client/index.html) jako kontenery `div.legal-options-root`; [`renderLegalOptions`](../client/app.js) — sekcje **Zagrania z ręki** / **Koniec tury** (RD-UX-012 **done**).
- **Serwer:** sesja demo przy starcie [`createSession(..., "spike")`](../server/index.ts) zamiast domyślnego `random`.
- **CSS:** [`.legal-subhead`](../client/styles.css).

---

## [2026-03-29] — Warstwa fabularna + UX z FB-RD-002 (0.7.0)

- **Fabuła w UI i tekstach serwera:** `playerLabelPl` w [`server/botExplain.ts`](../server/botExplain.ts) — Strażnik (p0) / Rozwarstwienie (p1); [`narrativeSnapshot` / `narrativeResult`](../server/botExplain.ts), [`legalActions`](../server/legalActions.ts), [`summarizeAction`](../server/index.ts); klient: nagłówki paneli, meta, opcje prawne, skrót sesji `H:Str`/`H:Roz`.
- **UX:** optgroupy strategii bota „Trening” vs „Widowisko”; `aria-describedby` / `aria-label` przy selectach; checkbox **Kompaktowe opcje ruchów** (`body.legal-compact-legal`). Backlog: [RD-UX-010](BACKLOG.yaml) / [RD-UX-011](BACKLOG.yaml) → **done**; [RD-UX-012](BACKLOG.yaml) → **in_progress** (kompakt bez pełnego grupowania).

---

## [2026-03-29] — FB-RD-002: macierz archetypów + decyzje GD/Producer + UX + „prawdziwa gra”

- Dokument [`docs/FEEDBACK_FB-RD-002.md`](FEEDBACK_FB-RD-002.md): pełne wyniki **playtest:matrix** (200 gier, 5 heurystyk bez `random`), tabela decyzji **GD+Producer** (test na papierze przed implementacją), audyt **UX** (findings → [RD-UX-010](BACKLOG.yaml)–[012](BACKLOG.yaml)), warstwy przejścia od mechaniki do gry, proces [RD-PROC-013](BACKLOG.yaml).
- **FB-RD-001:** metryki 12 meczów z wczesnej metody pozostają historyczne; aktualne wnioski liczbowe — **FB-RD-002 §2–3**.

---

## [2026-03-29] — Macierz archetypów bez `random` (narzędzie)

- **`src/headToHead.ts`** + **`npm run playtest:matrix`** — 5 heurystyk × każda vs każda (pary uporządkowane), N partii na parę (`RD_MATRIX_GAMES`); `simulate` domyślnie **spike vs spike**, legacy mirror: `--p0=random --p1=random`.
- **`archetype-playtest`** — tylko mecze archetyp vs archetyp (bez losowego bota w zestawie).

---

## [2026-03-29] — Strategie bota + jeden moduł heurystyk (0.6.0)

- **`src/botStrategies.ts`** — `pickBotAction`, 6 trybów: `random`, `spike`, `aggro`, `turtle`, `disruptor`, `timmy`; metadane pod onboarding (`BOT_STRATEGIES_FOR_API`).
- **Serwer:** pole sesji `botStrategy`; `POST /api/sessions` `{ botStrategy }` (domyślnie przy tworzeniu z API: spike); `PATCH /api/sessions/:id/bot` aktualizuje strategię + broadcast snapshot; *demo: od 0.7.1 **spike** (wcześniej random).*
- **Klient:** select strategii, hint z `title`; lista sesji `B:…`; testy `tests/botStrategies.test.ts`.
- **Playtest:** `scripts/archetype-playtest.ts` importuje `pickBotAction` (spójność z serwerem).

---

## [2026-03-29] — Człowiek vs bot w przeglądarce (0.5.0)

- **`humanAs` w sesji:** `null` = obaj boty; `"p0"` / `"p1"` = ta strona wykonuje ręcznie legalne ruchy. `PATCH /api/sessions/:id/control` z `{ humanAs }`; `POST /api/sessions` może przyjąć `humanAs` przy tworzeniu.
- **`POST /api/sessions/:id/action`** — `{ action: PLAY_CARD | END_TURN }`; walidacja tury, zgodność z `getValidActions`; broadcast WS `step` z `actor: "human"`, wspólne `seq` z botem.
- **Klient:** select „Ja p0 / Ja p1”; przy turze człowieka przyciski **Wykonaj** przy opcjach z `legalNow`; log `[TY]` / `[Bot]`.

---

## [2026-03-29] — Katalog talii + lista legalnych ruchów (0.4.1)

- **`getDeckCatalogForApi()`** w `cards.ts` — źródło kart, łączna liczba 20, tabela typów z opisami; w `/api/meta` jako `deckCatalog`.
- **`server/legalActions.ts`** — `describeLegalActions(state)`; WS: `legalNow` (stan po kroku / snapshot), `legalBeforeStep` + `chosenLegalN` przy `step` (podświetlenie wyboru bota).
- Klient: sekcja „Skąd są karty”, dwa bloki opcji prawnych.

---

## [2026-03-29] — UI obserwatora: karty, narracja, myślenie bota, tempo (0.4.0)

- **Wizualne karty** w ręce i slot „ostatnia zagrana” (gradienty per typ, glif, nazwa, tooltip z opisem z `CARD_META`).
- **Stan gry:** panel tekstowy od serwera (`narrativeSnapshot`) + skrót zasad w HTML.
- **Bot:** heurystyczne uzasadnienie (`server/botExplain.ts`) + linia „Efekt karty” przy zagraniu.
- **Tempo:** `PATCH /api/sessions/:id/bot` z `{ delayMs, paused }`; suwak i przycisk Pauza w UI.
- **Wynik:** pełnoekranowy baner z `narrativeResult` po `ended`.
- **Animacje:** przełącznik (localStorage `rift_anim`); klasa `no-anim` na `body`.

---

## [2026-03-29] — Serwis gry HTTP + WebSocket + klient obserwatora (0.3.0)

**Cel:** podgląd rozgrywki w przeglądarce; bot gra automatycznie; po końcu partii nowa partia na tej samej sesji.

**Implementacja:**
- `server/index.ts` — Express, `GET/POST /api/sessions`, `GET /api/meta`, statyczny `client/`, WebSocket `/ws?sessionId=`.
- Przy starcie tworzona jest **sesja demo** z botem (`setInterval` ~700 ms).
- Wiadomości WS: `snapshot`, `step` (z polem `summary`), `ended`; broadcast do wszystkich podłączonych widzów.
- `client/` — HTML/CSS/JS, lista sesji, dwie plansze graczy, log akcji.

**Uruchomienie:** `npm run server` w `games/rift-duel` lub `npm run serve:rift-duel` z roota `FORGE`. Port domyślny **8787** (`RIFT_DUEL_PORT`).

---

## [2026-03-29] — Podgląd rozgrywki bez serwera (`spectate`)

**Problem:** brak Game Engine Service (HTTP/WS) — nie ma czego „włączyć” w przeglądarce.

**Rozwiązanie:** skrypt `scripts/spectate.ts` — jedna partia bot vs bot, każda akcja + stan HP/ward/ręce w terminalu. Komendy: `npm run spectate -- --seed=N` (w `games/rift-duel`) lub `npm run spectate:rift-duel -- --seed=N` z roota `FORGE`.

---

## [2026-03-29] — Rozszerzenie produktu: GDD, fabuła, misje, marketing, live ops

**Źródło:** sesja z użytkownikiem + alignment z FORGE_MASTER_PLAN.

**Zmiany koncepcji:**
- Ustalono **świat przedstawiony:** Szczeliny, Strażnicy vs Rozwarstwienie; duel kart jako rytuał arbitrażu (most mechanika ↔ narracja).
- Zdefiniowano **ścieżkę od prototypu do gry PC:** kampania aktowa, misje z modyfikatorami (jeszcze nie zaimplementowane).
- Dodano sekcje **marketingu** (odbiorca, Steam, elevator pitch) i **utrzymania** (sezony, kosmetyki, anti-P2W).
- Utrwalono **anti-dryf:** ton poważny; zmiany tonu wymagają wpisu tutaj + notatki Producer w GDD.

**Kod / build:** bez zmian wersji zasad (pozostaje 0.2.1); dokumentacja tylko.

**Orchestrator:** uruchomiony lokalnie (`forge-runtime`); kolejka inbox z testami i symulacją. Poprawka `UnicodeEncodeError` na Windows (UTF-8 stdout / komunikaty ASCII w `main.py`).

**Build:** skrypt root `sim:rift-duel` uzupełniony o końcowe `--`, żeby `npm run sim:rift-duel -- --games=N` poprawnie przekazywało argumenty do `tsx` (wcześniej npm połykał flagi).

**Następny krok (propozycja):** implementacja CLI + `MissionConfig` + wpis w historii po merge.

---

## [2026-03-29] — Balans inicjatywy i rozszerzenie talii (0.2.0 → 0.2.1)

**Mechanika:** symetryczne 5+5 kart na start; losowy pierwszy gracz z seeda. Karty `brace`, `ember`. Test `balance-sanity` (obaj gracze wygrywają przy próbie seedów).

**Metryka:** ~500 gier symulacji (seed 42): rozkład zwycięstw blisko 50/50.

---

## [2026-03-29] — MVP silnika Rift Duel (0.2.0)

**Mechanika:** pierwszy moduł `rules` — ward, fatigue, leech z RNG od seeda, `getAIContext`, testy Vitest, `simulate.ts`.

**Uzasadnienie:** dowód wykonalności FORGE „genre module” dla cardgame.

---

*(Dodawaj nowe sekcje `## [RRRR-MM-DD] — tytuł` powyżej tej linii.)*
