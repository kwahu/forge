# Feedback **FB-RD-001** — Playtest archetypów graczy (symulacja)

| Pole | Wartość |
|------|---------|
| **ID** | FB-RD-001 |
| **Gra** | Pęknięcie (Rift Duel) |
| **Data zapisu** | 2026-03-29 |
| **Wersja kodu (pakiet)** | 0.6.0 (nagłówek zsynchronizowany wstecznie) |
| **Wersja zasad (content)** | 0.2.1 |
| **Źródło danych** | `scripts/archetype-playtest.ts`, `npm run playtest:matrix`, `npm run simulate` |
| **Metoda** | Boty-heurystyki vs boty-heurystyki (12 meczów); mirror losowy 2000 gier |
| **Uwaga** | **Aktualne metryki benchmarku AI vs AI i interpretacja balansu:** [FEEDBACK_FB-RD-002.md](FEEDBACK_FB-RD-002.md). Poniższe tabele §2–3 zachowane jako **historia** pierwszego playtestu. |

---

## 1. Metodologia

- **Archetypy zaimplementowane jako strategie:** `random` (chaos), `spike` (lethal + wartość karty), `aggro` (priorytet obrażeń), `turtle` (obrona), `disruptor` (priorytet leecha przy pełnej ręce przeciwnika), `timmy` (priorytet surge/brace).
- **Harmonogram meczów:** 12 pojedynków, ustalone pary i nasiona (`seed`), opis etykietami (np. „Spike vs Obrońca”).
- **Balans miejsc (inicjatywa):** `npm run simulate -- --games=2000 --seed=1` — obaj gracze to ten sam bot losowy; licznik wygranych `p0` vs `p1` służy do oceny, czy losowy start tury nie faworyzuje jednego miejsca w długiej próbie.

---

## 2. Wyniki liczbowe — archetypy (12 meczów) — *historyczne; zob. FB-RD-002*

| Etykieta | seed | p0 | p1 | Zwycięzca | Kroki |
|----------|-----|----|----|-----------|------:|
| Spike vs Obrońca | 42 | spike | turtle | p1 | 67 |
| Obrońca vs Spike (rewanż) | 43 | turtle | spike | p1 | 70 |
| Agresor vs chaos | 99 | aggro | random | p1 | 70 |
| Chaos vs Agresor | 100 | random | aggro | p1 | 70 |
| Kontrola vs efekt | 7 | disruptor | timmy | p1 | 67 |
| Efekt vs Kontrola | 8 | timmy | disruptor | p1 | 68 |
| Spike vs chaos | 202 | spike | random | p1 | 67 |
| Chaos vs Spike | 203 | random | spike | p1 | 69 |
| Obrońca vs Timmy | 300 | turtle | timmy | **p0** | 78 |
| Timmy vs Obrońca | 301 | timmy | turtle | p1 | 76 |
| Spike vs Agresor | 500 | spike | aggro | p1 | 67 |
| Kontrola vs Obrońca | 501 | disruptor | turtle | **p0** | 74 |

### Agregat per strategia (łącznie wystąpień jako p0 lub p1)

| Strategia | Rozegrane | Wygrane | Suma kroków |
|-----------|----------:|--------:|------------:|
| random | 4 | 2 | 276 |
| spike | 5 | 2 | 340 |
| aggro | 3 | 2 | 207 |
| turtle | 5 | 3 | 365 |
| disruptor | 3 | 2 | 209 |
| timmy | 4 | 1 | 289 |

**Uwaga:** dominacja `p1` w tej próbie to **efekt małej próby i matchupów**, nie dowód systemowej przewagi miejsca — patrz sekcja 3.

---

## 3. Wyniki — mirror losowy (2000 gier, seed 1)

```json
{
  "games": 2000,
  "baseSeed": 1,
  "p0Wins": 1017,
  "p1Wins": 983,
  "avgSteps": 67.7,
  "contentVersion": "0.5.0"
}
```

Wniosk: przy identycznej strategii losowej rozkład wygranych jest zbliżony do **50/50**; średnia długość meczu **~68 kroków** (krok = jedna akcja w silniku).

---

## 4. Opinie w stylu archetypów (syntetyczne, na podstawie zachowań botów i UI)

**Spike (optymalizacja)**  
Widoczna matematyka HP/tarczy i możliwość liczenia lethal; frustruje domyślny **losowy** bot w produkcji (brak konsekwentnego przeciwnika do nauki). Heurystyka „spike” bez głębszego lookahead przegrywa z chaosem i obroną — duża wrażliwość na seed i matchup.

**Timmy (duże efekty)**  
Surge/brace dają satysfakcję „mocy”, ale w próbce strategia była **najsłabsza** (1/4): duże zagrania często przegrywają tempo z bardziej elastycznymi priorytetami i małymi kartami.

**Johnny / linie (mapowane na disruptor — leech)**  
Leech jest satysfakcjonujący przy dużej ręce przeciwnika; bez podglądu kart przeciwnika decyzja często jest **zgadywaniem**.

**Obrońca (turtle)**  
Mend + tarcze dają poczucie kontroli; dłuższe partie; obawa o **zmęczenie talii** w końcówce.

**Gracz społeczny / narracja**  
Lista legalnych ruchów pomaga, ale przy wielu opcjach rośnie **czas decyzji**; dla gry towarzyskiej ważna byłaby krótsza średnia partia i wyraźniejszy „tempo” feedback.

**Chaos enjoyer (random)**  
Zabawnie jako eksperyment; przy grze na poważnie **utrata agency** w porównaniu z przewidywalnym przeciwnikiem.

---

## 5. Ocena zbiorcza (na podstawie powyższego)

**Mocne:** krótkie zasady, czytelny stan, deterministyczny seed, sensowny balans miejsc przy mirrorze losowym, ścieżka ludzka w UI i widoczne akcje prawne.

**Słabe w kontekście archetypów:** produkcyjny bot nie odzwierciedla stylów Spike/Timmy; proste heurystyki są **wrażliwe na matchup i seed**; Timmy-line w tej próbie wypadł najgorzej.

---

## 6. Problemy i proponowane rozwiązania

| # | Problem | Propozycja |
|---|---------|------------|
| 1 | Bot w grze = losowy | Poziomy trudności: Random / heurystyka (np. spike lub turtle) / opcjonalnie głębszy lookahead; parametr sesji lub `PATCH` bota. |
| 2 | Linia „Timmy” słaba w próbce | Pass balansu albo korekta kopii/efektów; większa próba seedów w `playtest:archetypes`. |
| 3 | Leech bez informacji o ręce | Tutorial (ryzyko/nagroda); tryb treningowy; przyszłe karty z podglądem. |
| 4 | Długość partii + wiele opcji prawnych | Celowa średnia długości; opcjonalny hint w trybie pomocy. |
| 5 | Mała próba (12 meczów) | Rozszerzyć skrypt o losowe seedy (np. N=100) i raport win-rate. |

---

## 7. Rekomendowane następne kroki (z tego feedbacku)

1. Wdrożyć **wybór strategii bota** w serwerze + UI (minimum: jedna heurystyka obok Random).  
2. Powiększyć **zbiór seedów** w automatycznym playteście archetypów.  
3. Po zebraniu danych — ewentualna **iteracja balansu** kart pod Timmy/obronę.

---

## 8. Odtworzenie wyników

```bash
cd games/rift-duel
npm run playtest:matrix
npm run playtest:archetypes
npm run simulate -- --games=2000 --seed=1
npm run simulate -- --games=2000 --seed=1 --p0=random --p1=random
```

Powiązany kod: `scripts/archetype-playtest.ts` (wersja z 2026-03-29; w razie zmian heurystyk wyniki mogą się różnić).

---

## 9. Status wdrożenia (FORGE → kod)

| Rekomendacja z §7 | Stan (2026-03-29) |
|-------------------|-------------------|
| Wybór strategii bota (serwer + UI) | **Wdrożone** w **0.6.0**: `src/botStrategies.ts`, `POST /api/sessions` + `PATCH .../bot` pole `botStrategy`, lista w `GET /api/meta` (`botStrategies`), select w kliencie. Sesja demo: **losowy** bot (jak wcześniej); nowe sesje z UI: domyślnie **Spike**. |
| Większa próba seedów w playteście | Częściowo: ten sam skrypt; rozszerzenie (np. pętla losowych seedów) w backlogu **RD-QA-006** / follow-up. |
| Iteracja balansu (Timmy / obrona) | Oczekiwanie na dane; heurystyki w jednym module ułatwiają A/B. |
