# Pęknięcie (Rift Duel) — karciany duel 1v1

**Pełny GDD (fabuła, misje, marketing, roadmap):** [`docs/GDD.md`](docs/GDD.md) · **Historia zmian:** [`docs/DESIGN_HISTORY.md`](docs/DESIGN_HISTORY.md) · **Manifest:** [`docs/MANIFEST.md`](docs/MANIFEST.md)

## Pitch

Dwójka duelantów wyczerpuje się taliami po **20 kart** (te same zestawy). Celem jest **obniżenie HP przeciwnika do 0**. Talie są tasowane **deterministycznie** od wspólnego seeda — ten sam seed = ta sama rozgrywka (zgodnie z ideą FORGE).

## Zasady (wersja 0.2.1)

- **HP:** 20 na start (leczenie nie przekracza max).
- **Tarcza (ward):** przed HP pochłania obrażenia; nadmiar „przepada” na tę salwę.
- **Tura aktywnego gracza:** może zagrać **do 2 kart** z ręki (w dowolnej kolejności), potem **kończy turę** (`END_TURN`). Po zakończeniu turę przejmuje przeciwnik i **dobiera 1 kartę** (pusta talia = **zmęczenie**: 1, 2, 3… obrażeń zamiast doboru).
- **Start:** obaj mają **5 kart** w ręce; **kto zaczyna**, losuje seed (gracz `p0` / `p1`).

## Karty

| ID | Nazwa | Efekt |
|----|--------|--------|
| `strike` | Cios | 3 obrażenia |
| `ward` | Tarcza | +4 ward |
| `mend` | Zasklepienie | +2 HP (cap) |
| `leech` | Wysys | przeciwnik odrzuca **losową** kartę z ręki; ty dobierasz 1 (jeśli talia nie pusta) |
| `surge` | Przełam | 5 obrażeń |
| `brace` | Zbrojenie | +6 ward |
| `ember` | Żar | 1 obrażenie; jeśli **dosięga HP** (nie tylko tarcza), dobierasz 1 |

Pełna talia (× ilość) jest w `src/cards.ts` (`starterDeck`).

## Kod (Rules Module)

Moduł `games/rift-duel` eksportuje operacje w stylu FORGE:

- `createInitialState(seed)`
- `getValidActions(state)`
- `applyAction(state, action)`
- `checkWinCondition(state)`
- `getVisibility(state, playerId)` — ręka przeciwnika jako `handCount`
- `getAIContext(state, playerId)` — tekstowy podgląd dla agentów

## Co uruchomić

```bash
cd games/rift-duel
npm install
npm test
npm run simulate -- --games=500 --seed=42
npm run simulate -- --games=500 --p0=spike --p1=turtle
npm run playtest:matrix
npm run spectate -- --seed=42
```

**Transkrypt w terminalu:** `spectate` — każda akcja w konsoli.

**Podgląd w przeglądarce (serwer + klient):**

```bash
cd games/rift-duel
npm run server
```

Otwórz **http://127.0.0.1:8787/** — **tabela talii**, **lista legalnych ruchów** (opcjonalnie **kompakt** — krótszy opis), narracja z serwera w ramach **Strażnik vs Rozwarstwienie** (p0/p1), lista sesji, karty, log, panel bota. **Rola ludzka:** Strażnik (p0) / Rozwarstwienie (p1) → `PATCH .../control`; **Wykonaj** → `POST .../action`. **Strategia bota** w grupach *Trening* / *Widowisko*: `POST` / `PATCH .../bot`; meta → `botStrategies`. **Tempo** i **pauza** w `PATCH .../bot`. **Animacje** — checkbox. Sesja demo przy starcie (**strategia bota: spike**). `RIFT_DUEL_PORT`, `RIFT_DUEL_BOT_MS`.

Z głównego katalogu repozytorium `FORGE` (np. pod orchestrator z `repo_root: "."` względem `forge-runtime`):

```bash
npm run test:rift-duel
npm run sim:rift-duel -- --games=500 --seed=42
npm run spectate:rift-duel -- --seed=42
npm run serve:rift-duel
```

Symulacja zapisuje JSON ze **średnią liczbą kroków** i **rozkładem zwycięstw** (przy prostym bocie losowym) — przydatne do iteracji balansu.

## Dalsze kroki

Szczegóły i priorytety: [`docs/BACKLOG.yaml`](docs/BACKLOG.yaml). Orkiestracja lokalna: `forge-runtime` (inbox + `npm run test:rift-duel` z roota `FORGE`).
