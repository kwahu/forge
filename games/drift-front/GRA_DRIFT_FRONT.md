# Front Dryfu (Drift Front)

Strategiczna gra turowa 1v1 w ramach [FORGE](../../FORGE_MASTER_PLAN.md): **moduł zasad** jako czysta funkcja `(stan, akcja) → stan`, deterministyczny seed, pełna widoczność planszy.

## Elevator pitch

Dwie drużyny po **dwóch strzelcach** na **kwadratowej planszy 5×5** z **filarami** (pola zablokowane). Każda półtura: jeden **ruch** o jedno pole (N/E/S/W) albo **atak** sąsiada (2 obrażenia, 5 HP). Wygrywasz przez eliminację — albo remis po limicie półtur.

## Pakiet

- Kod: `games/drift-front/` — `npm test` (w tym **golden seeds**), `npm run simulate`, `npm run playtest:matrix`, **`npm run server`** (UI, `DRIFT_FRONT_PORT`, domyślnie 8790)
- Zasady: `docs/GDD.md` · manifest: `docs/MANIFEST.md` · backlog: `docs/BACKLOG.yaml` · historia: `docs/DESIGN_HISTORY.md` · **FORGE:** `docs/FORGE_SYNC.md`

## Powiązanie z FORGE

| Koncepcja FORGE | Realizacja |
|-----------------|------------|
| Gra = czysta funkcja | `createInitialState`, `getValidActions`, `applyAction`, `checkWinCondition` |
| Determinizm | `rng.ts` + `rngSeed` / `rngCounter` w stanie |
| Widok / AI | `getVisibility`, `getAIContext` |
| Gatunek | `genre: "strategy"` |
| UI / API (pilot) | `server/index.ts` + `client/` — obserwacja AI vs AI (§7.2 Spectator) |
