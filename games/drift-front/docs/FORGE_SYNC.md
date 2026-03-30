# Synchronizacja z FORGE_MASTER_PLAN (repozytorium główne)

Ten plik utrwala **aktualny kontekst frameworka** dla agentów i ludzi pracujących nad `drift-front`. Źródło prawdy: [`FORGE_MASTER_PLAN.md`](../../../FORGE_MASTER_PLAN.md) w katalogu głównym FORGE.

## Interfejs modułu zasad (wizja §0 / §2)

| Funkcja | Implementacja |
|---------|----------------|
| Stan początkowy | `createInitialState(seed)` |
| Legalne akcje | `getValidActions(state)` |
| Aplikacja akcji | `applyAction(state, action)` |
| Koniec gry | `checkWinCondition(state)` |
| Widok | `getVisibility(state, playerId)` |
| Kontekst AI | `getAIContext(state, playerId)` |

## Lekcje z pilotażu Rift Duel (§6.4) — stosowane tutaj

- **Macierz strategii** — `npm run playtest:matrix`; heurystyki `spike` / `aggro` / `turtle` (nie polegamy na `random` jako jedynym teście).
- **Regresja AI** — `tests/golden-seeds.test.ts` po każdej zmianie `botStrategies.ts`; znany dług: mirror `turtle` vs `turtle` (BACKLOG **DF-BOT-001**).
- **Wspólny `pickBotAction`** — ten sam kod w serwerze i symulacjach.
- **UI wcześnie** — klient statyczny + WebSocket: widoczny seed, `contentVersion`, tryb AI, kompaktowy log (§7.3).
- **Domyślna pierwsza sesja** — Spike (p0) vs Aggro (p1) jako „trening”, nie czysty los (§6.4, wniosek o demo).

## Usługa gry (§2.1)

Lokalny odpowiednik docelowego API: `POST/GET/PATCH /api/sessions`, `WebSocket /ws?sessionId=`. Meta: `GET /api/meta` (`contentVersion`, katalog strategii).

## Wersjonowanie

- **Pakiet** (`package.json`) i **zasady** (`contentVersion` w stanie + `docs/MANIFEST.md`) — przy zmianach reguł podnieść oba i opisać w `GDD` / `DESIGN_HISTORY` (gdy powstanie).
