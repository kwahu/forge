# GDD — Front Dryfu (v0.2.0)

## 1. Cel gracza

Zlikwidować obie jednostki przeciwnika (HP spadnie do 0 lub poniżej). Przegrana = utrata obu własnych jednostek.

## 2. Plansza

- Siatka **5×5**, współrzędne `(x,y)` od `(0,0)` do `(4,4)`.
- **Filary (blocked):** domyślnie pola `(1,1)` i `(3,3)` — **nie można** na nich stanąć (ruchy są niedozwolone). Jednostki nie startują na filarach.

## 3. Jednostki

- Każdy gracz ma **dwie** jednostki (`slot` 0 i 1).
- **HP:** 5. **Obrażenia z ataku:** 2.
- Martwe jednostki (`hp ≤ 0`) **nie blokują** ruchu i nie mogą działać.

## 4. Setup

| Gracz | Slot 0 | Slot 1 |
|-------|--------|--------|
| p0 | (0,0) | (1,0) |
| p1 | (4,4) | (3,4) |

**Inicjatywa:** los z RNG od `seed` (jak w Rift Duel) — kto rozpoczyna pierwszą półturę.

## 5. Półtura i akcje

Aktywny gracz wykonuje **dokładnie jedną** akcję:

1. **MOVE(slot, kierunek)** — jednostka `slot` przesuwa się o 1 pole na północ / wschód / południe / zachód. Pole docelowe musi być w granicach, **nie być filarem** i **puste** (brak żywej jednostki).
2. **ATTACK(slot, kierunek)** — jeśli w sąsiednim polu w tym kierunku stoi **żywa** jednostka wroga, traci 2 HP.

Po rozwiązaniu akcji aktywny gracz się **zmienia** (druga strona).

## 6. Koniec gry

- Brak żywych jednostek u jednego gracza → wygrana drugiego.
- Oba całkiem martwi (rzadki remis „ostatni strzał”) → zwycięzca = gracz, który **właśnie wykonał** akcję (stan zamrożony z jego perspektywy w kodzie).
- **Limit półtur:** po `512` wykonanych akcjach bez eliminacji → **remis** (`winner: null`).

## 7. Informacja

Pełna widoczność — brak mgły wojny. `getVisibility` zwraca ten sam układ jednostek i **listę pól zablokowanych** dla obu stron.

## 8. AI i narzędzia (FORGE §6.4)

- Heurystyki: `spike`, `aggro`, `turtle`, `random` — wspólna funkcja `pickBotAction` (serwer + symulacje).
- `turtle`: z daleka zbliża (jak agresor), w zwarciu jak spike; przy niskim HP ucieka / dobija. **Uwaga:** para **turtle vs turtle** bywa remisowa na limicie półtur (symetria) — backlog **DF-BOT-001**.
- `npm run playtest:matrix` — macierz matchupów (deterministyczne seede).
- Regresja: `tests/golden-seeds.test.ts` (m.in. spike vs aggro na 5 seedach).
- `npm run server` — REST + WebSocket + statyczny klient obserwatora (`client/`).

## 9. Otwarte (backlog)

- Strefy celów / VP na środku mapy.
- Jednostki o różnych statystykach lub zasięgu.
- Golden seeds w CI po zmianach `pickBotAction`.
