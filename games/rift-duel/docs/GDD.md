# GDD — Pęknięcie (Rift Duel)

**Game Design Document** (żywy dokument). Szczegóły techniczne zasad: `GRA_RIFT_DUEL.md`. Historia decyzji: `DESIGN_HISTORY.md`.

---

## 1. Wizja i filary (Producer)

### 1.1 Pitch

**Pęknięcie** to gra o walce **symbolicznej** — karty nie są „czarami”, lecz **koncepcjami** napięcia między dwoma rzeczywistościami. Gracz doświadcza tego najpierw jako czysty duel 1v1 (MVP silnika), później jako **kampanię PC** z misjami, bohaterami i konsekwencjami.

### 1.2 Filary projektowe

1. **Czytelność** — każda karta ma jednoznaczny efekt; stan można wyeksportować do JSON (FORGE).
2. **Determinizm** — ten sam seed = ta sama partia (replay, testy, turnieje).
3. **Głębia taktyczna** — ward, tempo (2 zagrania), leech jako interakcja z ręką przeciwnika.
4. **Ścieżka do produktu PC** — rules module oddzielony od prezentacji; później UI, audio, Steam.

### 1.3 Anti-dryf (vision lock)

Nie zmieniamy losowo tonu: **nie** stajemy się kolejnym humorystycznym deck-builderem bez uzasadnienia narracyjnego. Odstępstwa wymagają wpisu w `DESIGN_HISTORY.md` i akceptacji w sekcji „Notatki Producer” poniżej.

**Notatki Producer (2026-03-29):** Utrzymujemy poważny, mistyczno-naukowy ton „szczelin”; humor tylko w opcjonalnym DLC / kartach kosmetycznych.

---

## 2. Rdzeń mechaniczny (Game Designer)

### 2.1 Pętla rozgrywki

1. Widzisz rękę i stan (HP, ward, liczba kart u przeciwnika).
2. Zagraj do **2 kart** lub mniej.
3. Zakończ turę → przeciwnik dobiera 1 (albo **fatigue**).
4. Powtarzaj do 0 HP u przeciwnika.

### 2.2 Zasoby i przegrana

- **HP:** start 20; `mend` nie przekracza max.
- **Ward:** absorpcja przed HP; nie przenosi się między turami (chyba że w przyszłości wprowadzimy „trwałą tarczę” — backlog).
- **Przegrana:** HP ≤ 0.

### 2.3 Karty (content v0.2.1)

| ID | Rola w meta | Uwagi balansu |
|----|-------------|----------------|
| strike | Stabilny DMG | Core aggro |
| ward | Odpowiedź na burst | Soft counter surge |
| mend | Value w długiej grze | Weak vs burst |
| leech | Tempo + disruption | RNG z seeda |
| surge | Finisher / presja | Wysokie tempo, weak do ward |
| brace | Defensywny swing | Cena: miejsce w talii |
| ember | Engine / chip | Synergia z doborem |

Pełna lista kopii w talii: `src/cards.ts` → `starterDeck()`.

### 2.4 Metryki QA (cel orientacyjny)

- Średni czas partii (bot losowy): ~60–80 „kroków” akcji — monitorować przy zmianach.
- Win-rate P0 vs P1 przy losowej inicjatywie: ~45–55% (regresja w testach).

---

## 3. Świat i fabuła (Narrative)

### 3.1 Setting

**Szczelina** — miejsce, gdzie dwie wersje rzeczywistości stykają się bez pełnego połączenia. **Strażnicy** utrzymują granicę; **Rozwarstwieni** chcą ją poszerzyć. Duel kart to **rytuał arbitrażu** (abstrakcja mechaniczna): wygrana to chwilowe „zamknięcie” lub „otwarcie” szczeliny w danym punkcie fabularnym.

### 3.2 Gracz

**Mediator** (imię robocze: do wyboru w kampanii) — rekrutowany przez Straż, zdolny widzieć obie strony. Moralne wybory **nie** zmieniają kart w MVP silnika; w **kampanii PC** będą odblokowywać **warianty kosmetyczne / alternatywne karty** (backlog).

### 3.3 Antagoniści (rozszerzalne)

- **Echo Veridiana** — głos Rozwarstwienia; pojawia się między misjami (VO w docelowej produkcji).
- **Kapitan Straży** — mentor tutorialu.

---

## 4. Misje i progresja (PM / Design)

### 4.1 Struktura docelowej kampanii (PC)

| Akt | Temat | Typ misji (przykład) |
|-----|--------|----------------------|
| I | Tutorial + świat | 3 duels vs AI + 1 „misja bez walki” (dialog) |
| II | Konsekwencje | Duel z modifierem (np. +1 draw dla AI) |
| III | Szczyt | Boss z unikalną kartą w talii AI |

**Stan na dziś:** silnik nie zawiera jeszcze „misji” — tylko `createInitialState(seed)`. **Kolejne implementacje:** `MissionConfig` (modyfikatory), potem JSON kampanii.

### 4.2 Backlog produktowy (skrót)

Pełna lista: `BACKLOG.yaml`.

---

## 5. Prezentacja i UX (DEV + Design)

- **MVP:** terminal / CLI (plan).
- **Alpha PC:** 2D, czytelne karty, duże liczby HP/ward, animacja minimalna.
- **Docelowo:** VFX przy surge/ember; dźwięk „szkła” przy ward.

---

## 6. Technologia (Builder)

- **Silnik:** TypeScript, moduł `games/rift-duel`, API: `createInitialState`, `getValidActions`, `applyAction`, …
- **Testy:** Vitest; symulacja `scripts/simulate.ts`; transkrypt `scripts/spectate.ts`.
- **Serwis (v0.7.3):** jak v0.7.2 + **kampania** (`content/campaign.json`, `GET /api/meta.campaign`, `POST { missionId }`); **modyfikatory startu** w silniku (`extraOpeningDraws`).
- **Następne:** PvP / drugi klient; leaderboard globalny; progresja kampanii (odblokowania); opcjonalnie React; CLI (`RD-CLI-001`).

---

## 7. Marketing i wydanie (Marketing)

### 7.1 Propozycja wartości (elevator)

„Taktyczny duel karciany z przewidywalnym RNG — każda partia do odtworzenia z seeda. Od czystych zasad do mrocznej kampanii o granicach rzeczywistości.” **Hook pod demo:** ten sam seed = ten sam rozkład — **challenge dnia** w kliencie (link `?daily=YYYY-MM-DD`, lokalny leaderboard); viral: social / Steam discussions.

### 7.2 Odbiorca

- Fan **Slay the Spire** / **Inscryption** szukający **krótszych sesji PvP**.
- Speedrun / content creatorzy (replay z seeda).

### 7.3 Steam (przygotowanie)

- Tagi robocze: Card Battler, Strategy, Dark Fantasy, 2D.
- Strona wishlist: po playable demo (Q w backlogu).

### 7.4 Live ops (po premierze)

- Sezonowe **ban lista** w ranked (jeśli meta zdominowana).
- Kosmetyki talii (bez P2W).

---

## 8. Utrzymanie i ryzyka (Producer + QA)

| Ryzyko | Mitygacja |
|--------|-----------|
| Suchy duel bez fabuły | Kampania tekstowa przed pełnym artem |
| Zbyt silna karta | `simulate.ts` + test regresji win-rate |
| Scope creep | BACKLOG priorytety P0–P3 |

---

## 9. Roadmap (wysoki poziom)

1. **0.3** — CLI + pierwsza misja (modifier) w kodzie.
2. **0.4** — HTTP API + jeden endpoint replay.
3. **0.5** — Kampania JSON (5 misji).
4. **0.6** — Prototyp UI web.
5. **1.0** — Demo Steam + trailer.

---

*Ostatnia aktualizacja dokumentu: 2026-03-29.*
