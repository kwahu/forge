# GDD — Szkarłatna przysięga (Scarlet Oath)

**Wersja:** 0.2.0  
**Gatunek:** RPG taktyczny (1v1, turowo)  
**Platforma docelowa (FORGE):** rules module + później usługa API / klient

## 1. Pitch

Krótki pojedynek dwóch postaci na **niewielkiej siatce**: zarządzasz punktami akcji, zbliżasz się do przeciwnika, **tniesz** albo **wzmacniasz tarczę**. Możesz też wykonać **szarżę** (DASH) — skok o 2 pola — żeby zaskoczyć przeciwnika lub uciec poza jego zasięg. Partia jest szybka, czytelna i w pełni **deterministyczna** przy tym samym seedzie — zgodnie z filozofią FORGE (gra jako czysta funkcja stanu).

## 2. Pętla rozgrywki

1. Losowana **inicjatywa** (seed + licznik RNG).
2. Aktywna postać ma **3 AP** na turę.
3. Dostępne akcje: **MOVE** (1 AP, ortogonalnie), **DASH** (2 AP, skok 2 pola ortogonalnie), **STRIKE** (2 AP, tylko sąsiad ortogonalny, 5 obrażeń), **WARD** (1 AP, +4 tarczy do max 10), **END_TURN** (koniec tury; niewykorzystane AP przepadają).
4. Obrażenia najpierw zużywają **tarczę**, reszta idzie w **HP**.
5. **Wygrana:** HP przeciwnika ≤ 0.

## 3. Parametry (balans 0.2.0)

| Element | Wartość |
|--------|---------|
| Siatka | 6 × 5 |
| Start p0 (Seeker) | (1, 2) |
| Start p1 (Echo) | (4, 2) |
| HP p0 / p1 | 22 / 22 (symetria pod mirror-AI; greedy vs greedy ~53% / ~47% na 800 seedów) |
| AP na turę | 3 |
| Koszt MOVE / DASH / STRIKE / WARD | 1 / 2 / 2 / 1 |
| Obrażenia STRIKE | 5 |
| Przyrost WARD | 4 |
| Max tarczy | 10 |

### DASH — mechanika szczegółowa

- Koszt: **2 AP**
- Efekt: ruch o **2 pola** w wybranym kierunku ortogonalnym
- Warunki: oba pola (pośrednie i docelowe) muszą być w granicach siatki; pole docelowe nie może być zajęte przez przeciwnika
- Zastosowanie: szybkie zbliżenie z dużej odległości lub odskoczenie po ciosie

## 4. Rules module (FORGE)

Zaimplementowane API logiczne (jak w planie master):

- `createInitialState(seed)` — stan początkowy  
- `getValidActions(state)` — legalne akcje  
- `applyAction(state, action)` — nowy stan (immutability)  
- `checkWinCondition(state)`  
- `getVisibility(state, playerId)` — widok dla UI / gracza  
- `getAIContext(state)` — zwięzły kontekst dla agentów  

## 5. Fabuła (szkic)

**Seeker** — ktoś, kto przekroczył **Welw** (zasłonę między warstwami świata), by coś odzyskać albo zatrzymać.  
**Echo** — nie do końca niezależna istota: odbicie intencji Seekera, przeciwnik z tej samej „tonacji", ale obcej strony szczeliny.

Copy i questy są na późniejsze iteracje; MVP jest czysto mechaniczne.

## 6. Usługa (FORGE API-first)

- **Uruchomienie:** `npm run server` → `http://127.0.0.1:8788` (zmienna `SCARLET_OATH_PORT`).  
- **REST:** `GET /api/meta`, `POST/GET /api/sessions`, `GET /api/sessions/:id`, **`GET /api/sessions/:id/valid-actions`**, `POST .../action`, **`POST .../undo`**, `PATCH .../control`, `PATCH .../bot`.  
- **Regresja:** `src/replay.ts`, fixture `tests/fixtures/golden-greedy-seed42.json` (p0 wygrywa) i `golden-greedy-seed4.json` (p1 wygrywa), regeneracja: `npm run golden:write -- <seed>`.  
- **WebSocket:** `/ws?sessionId=…` — snapshot, step, ended (jak Rift Duel).  
- **Changelog treści:** `docs/CHANGELOG.yaml` (oraz `GET /api/meta/changelog`).

## 7. Następne kroki (backlog skrótowy)

- Jednostki pomocnicze lub druga fala (PvE).  
- Umiejętności z cooldownem (np. LEAP — skok przez 1 pole przez przeciwnika).
- Golden sessions / regresja deterministyczna.
