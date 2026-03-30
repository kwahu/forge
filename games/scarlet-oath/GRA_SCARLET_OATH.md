# Gra: Szkarłatna przysięga (Scarlet Oath)

Lokalizacja pakietu: `games/scarlet-oath/`.

## Szybki start

```bash
cd games/scarlet-oath
npm install
npm test
npm run simulate
npm run balance
npm run golden:write -- 42
npm run server
# przeglądarka: http://127.0.0.1:8788 (port: SCARLET_OATH_PORT)
```

## Co to jest

**RPG taktyczny 1v1** w ramach [FORGE_MASTER_PLAN.md](../../FORGE_MASTER_PLAN.md): deterministyczny stan, lista legalnych akcji, czysta funkcja `(stan, akcja) → stan`. Pasuje do opisu gatunku **RPG** (walka turowa, rozwój — rozwój i questy na kolejne wersje).

## Struktura

| Ścieżka | Rola |
|--------|------|
| `src/types.ts` | Typy stanu i akcji |
| `src/rng.ts` | RNG z seed + counter |
| `src/rules.ts` | Rdzeń: `createInitialState`, `getValidActions`, `applyAction`, `checkWinCondition`, `getVisibility`, `getAIContext` |
| `src/enemyAi.ts` | Heurystyka greedy + `simulateGreedyVersus` |
| `src/replay.ts` | Golden replay: `replayActions`, `combatSnapshot`, `actionsEqual` |
| `tests/fixtures/` | Zapisane sesje (JSON) pod regresję |
| `tests/` | Vitest |
| `server/` | Express + `ws`: `/api/meta`, `/api/sessions`, `POST .../action`, `PATCH` control/bot, statyczny `client/` |
| `client/` | UI: plansza, HP, legalne ruchy, WebSocket `/ws?sessionId=` |
| `docs/GDD.md` | Design |
| `docs/MANIFEST.md` | Stan produktu (krótko) |
| `docs/CHANGELOG.yaml` | Wersje zasad / silnika (FORGE §2.3) |

## Wersje

- Zasady / content: **0.1.1** (`GameState.contentVersion`, MANIFEST).  
- Pakiet npm: **0.2.1** (golden replay, `valid-actions`, backlog).
