# Deepspire — GDD (MVP 0.1)

## 1. Pitch

Turowy roguelike na siatce: **wejście → piętra → schody w dół**. Cel: **zejść z trzeciego poziomu** (pole schodów + akcja „zejście”). Śmierć = koniec gry. Stan jest **w pełni deterministyczny** od `(seed, licznik RNG)`.

## 2. Pętla rozgrywki

1. Gracz wybiera jedną legalną akcję.
2. Rozstrzygnięcie ruchu / ataku / zejścia.
3. Tura wszystkich żywych wrogów (atak w sąsiedztwie ortogonalnym albo krok w stronę bohatera).
4. Następna tura gracza.

## 3. Akcje

| Akcja | Efekt |
|--------|--------|
| `MOVE` N/S/E/W | Wejście na wolne pole; wejście na wroga = atak za 1 obrażenie (bez wejścia na pole). |
| `WAIT` | Brak ruchu gracza; wrogowie nadal działają. |
| `DESCEND` | Tylko na polu schodów. Głębokość < 3: nowe piętro, pełne leczenie, nowa mapa. Głębokość = 3: **zwycięstwo**. |

## 4. Mapa

- Proceduralna od seeda: obramowanie ścian, wnętrze „pijanym kopaczem”, spójny obszar podłogi od spawnu.
- Jedno pole **schody**; spawn gracza i schody w tym samym komponencie spójności.
- Wrogowie: liczba rośnie z głębokością; od głębokości 3 mają 2 HP.

## 5. FORGE — zgodność

- **Gra = funkcja:** `createInitialState`, `getValidActions`, `applyAction`, `checkWinCondition`, `getVisibility`, `getAIContext`.
- **RNG:** `rng.ts` — ten sam wzorzec co Rift Duel (seed + monotoniczny licznik).
- **Testy:** determinizm startu, ścieżka zwycięstwa, śmierć, symulacja bota.

## 6. Usługa pilotażowa (FORGE)

- `npm run server` — Express, statyczny `client/`, WebSocket `/ws?sessionId=…`.
- Port domyślny **8788** (nadpisanie: `DEEPSPIRE_PORT`). Tempo bota: `DEEPSPIRE_BOT_MS`.
- REST: `POST /api/sessions` (body: `seed?`, `humanControl`, `autoPlay`, `botDelayMs`), `GET /api/sessions/:id`, `POST …/action`, `PATCH …/control`, `PATCH …/bot`, `GET /api/meta`.
- `GET /api/meta` zwraca też `challengeDay: { seed, label }` (plik `src/challengeDay.ts` — rotacja wyzwania).

## 7. Następne kroki (nie wdrożone)

Fog of war, przedmioty, więcej wariantów AI, pełna zgodność z docelowym API z FORGE §2.1, leaderboard / challenge dnia.
