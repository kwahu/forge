# Feedback **FB-RD-002** — Macierz archetypów, decyzje GD+Producer, UX, kierunek „prawdziwej gry”

| Pole | Wartość |
|------|---------|
| **ID** | FB-RD-002 |
| **Gra** | Pęknięcie (Rift Duel) |
| **Data zapisu** | 2026-03-29 |
| **Wersja kodu (pakiet)** | 0.7.1 (aktualizuj przy zmianach wdrożenia) |
| **Wersja zasad (content)** | 0.2.1 |
| **Powiązanie** | Rozwija i koryguje wnioski z [FEEDBACK_FB-RD-001.md](FEEDBACK_FB-RD-001.md) |
| **Źródła danych** | `npm run playtest:matrix`, `npm run playtest:archetypes`, `npm run simulate` |

---

## 1. Metodologia

### 1.1 Macierz head-to-head (bez `random` w zestawie benchmarku)

- **Moduł:** [`src/headToHead.ts`](../src/headToHead.ts) — `playHeadToHead(seed, stratP0, stratP1)`.
- **Strategie w macierzy:** `spike`, `aggro`, `turtle`, `disruptor`, `timmy` (5 heurystyk deterministycznych).
- **Pary:** uporządkowane (A≠B) → **20 par**; domyślnie **10 partii na parę** → **200 gier** łącznie.
- **Ziarna:** kolejne od 10 000 (powtarzalność); liczba gier na parę: zmienna środowiskowa `RD_MATRIX_GAMES` (domyślnie 10).
- **Skrypt:** `npm run playtest:matrix` → [`scripts/strategy-matrix.ts`](../scripts/strategy-matrix.ts).

### 1.2 Krótki zestaw `playtest:archetypes`

- 12 meczów, wyłącznie archetyp vs archetyp (bez `random`) — [`scripts/archetype-playtest.ts`](../scripts/archetype-playtest.ts).

### 1.3 Symulacja masowa `simulate`

- **Domyślnie:** `spike` vs `spike` (mirror „mądrych” botów, długość partii + balans miejsc).
- **Legacy (oba losowe):** `--p0=random --p1=random`.

---

## 2. Wyniki liczbowe — macierz 200 gier (10 gier / parę uporządkowaną)

### 2.1 Win rate gracza **p0** w danej parze (udział wygranych p0 w partiiach bez abort)

Wartości w komórce = wygrane **p0** / (10 − aborted); w tym przebiegu **aborted = 0** dla wszystkich par.

| p0 \\ p1 | aggro | disruptor | spike | timmy | turtle |
|----------|-------|-----------|-------|-------|--------|
| **spike** | 0.50 | 0.60 | — | 0.40 | 0.90 |
| **aggro** | — | 0.30 | 0.50 | 0.30 | 0.80 |
| **turtle** | 0.50 | 0.80 | 0.00 | 0.20 | — |
| **disruptor** | 0.30 | — | 0.30 | 0.40 | 0.70 |
| **timmy** | 0.60 | 0.60 | 0.00 | — | 0.60 |

### 2.2 Agregat per strategia (każda grała **80** partii: 40 jako p0, 40 jako p1)

| Strategia | Wygrane | Rozegrane | Win rate | Śr. kroków (średnia ważona przy udziale) |
|-----------|--------:|----------:|---------:|------------------------------------------:|
| spike | 56 | 80 | 0.70 | 67.5 |
| timmy | 45 | 80 | 0.563 | 67.8 |
| aggro | 40 | 80 | 0.50 | 66.5 |
| disruptor | 34 | 80 | 0.425 | 68.0 |
| turtle | 25 | 80 | 0.313 | **71.4** |

### 2.3 Symulacja `simulate` (2000 gier, `baseSeed=1`)

| Konfiguracja | p0 wygrane | p1 wygrane | Śr. kroków |
|--------------|------------|------------|------------:|
| `spike` vs `spike` (domyślnie) | 980 | 1020 | 65.1 |
| `random` vs `random` (`--p0=random --p1=random`) | 1017 | 983 | 67.7 |

---

## 3. Relacja do FB-RD-001 — co się zmieniło w interpretacji

| Aspekt | FB-RD-001 (12 meczów, często z `random`) | FB-RD-002 (macierz 5×5, bez random) |
|--------|------------------------------------------|-------------------------------------|
| **Spike** | Słaby w krótkiej próbie (2/5) | Najwyższy **win rate** w AI vs AI (0.70) |
| **Timmy** | Bardzo słaby w próbie (1/4) | Drugi wynik (0.563), silnie **zależny od matchupu** |
| **Turtle** | Wyglądał na mocnego w kilku seedach | **Najsłabszy** łącznie (0.313), **najdłuższe** partie |
| **Przyczyna** | Mała próba + obecność `random` zaburzała obraz | Większa, systematyczna próba; pary jawnie zdefiniowane |

**Wniosek procesowy:** decyzje balansu i trudności opierać na **macierzy** (i ewentualnie powiększyć `RD_MATRIX_GAMES`), a nie na pojedynczym zestawie 12 seedów.

---

## 4. Wnioski wielowymiarowe (wejście do decyzji — nie specyfikacja implementacji)

- **Mechanika / balans:** Spike dominuje w obecnym autopilocie; turtle wymaga przemyślenia (celowy „hard mode” vs redesign heurystyki/kart). Timmy = wysoka wariancja między przeciwnikami.
- **Tempo:** Style defensywne wydłużają partię (turtle ~71 kroków przy udziale vs ~66–68 dla aggro).
- **Retencja / live ops:** Wyzwania dzienne muszą mieć **ustalony seed + botStrategy**, inaczej porównania wyników są bez sensu (por. [RD-RET-009](BACKLOG.yaml)).
- **Marketing:** Timmy + duże karty → materiały wizualne; Spike + seed → narracja „uczciwa taktyka”.
- **Dostępność:** Wiele strategii bota i długa lista legalnych ruchów → ryzyko **przeciążenia poznawczego**; random jako „chaos” powinien być jawnie opisany dla graczy wrażliwych na nieprzewidywalność.

---

## 5. GD + Producer — wspólne decyzje (szablon)

*Po sesji GD+Producer uzupełnij kolumnę **Decyzja** i ewentualnie **Data review**. Do czasu review: **TBD**.*

| Temat | Opcje (skrót) | Kryteria sukcesu | Decyzja | Test na papierze | Gate implementacji | Właściciel |
|-------|----------------|------------------|---------|------------------|-------------------|------------|
| Demo / pierwsze wrażenie | A) Sesja demo zostaje `random` · B) Demo → `spike` · C) Dwa tryby startu (widowisko / trening) | Jasny komunikat dla nowego gracza; zgodność z positioningiem | **TBD** | Makieta nagłówka + 1 zdanie „co widzisz”; 3 osoby czytają bez kodu | Po akceptacji copy | Producer + GD |
| Balans turtle vs spike | A) Zaakceptować twardy MU · B) Zmiana heurystyki turtle · C) Zmiana kart / liczników | Średni win rate turtle vs spike w macierzy w przedziale uzgodnionym; czas partii poniżej progu | **TBD** | Rozpis 5 tur „obrona vs surge” na kartce; checklista oczekiwanych HP/ward | Po drugiej rundzie macierzy po zmianach papierowych | GD + QA |
| Challenge dnia ([RD-RET-009](BACKLOG.yaml)) | A) Tylko seed · B) seed + botStrategy · C) + limit czasu UI | Regulamin 1 strona; możliwość porównania replay | **TBD** | Mock „Rules of the day” (ASCII/Figma) | Po podpisaniu regulaminu papierowego | Producer |
| Pion narracyjny minimalny w kliencie | A) Tylko copy (Strażnik / Rozwarstwienie zamiast surowego A/B) · B) A + baner końca · C) B + jedna misja tekstowa ([RD-NAR-004](BACKLOG.yaml)) | Gracz potrafi powiedzieć „o czym jest gra” po 3 min bez GDD | **TBD** | Scenariusz 60 s + pytanie „co to za konflikt?” | Po zielonym papierze scenariusza | GD |
| Kolejność kamieni milowych | A) UX → narracja · B) narracja → UX · C) równolegle z limitem zasobów | Manifest zaktualizowany; brak sprzeczności z [MANIFEST.md](MANIFEST.md) | **TBD** | Tabela zależności 1 str. (Producer) | Po signoff | Producer |

---

## 6. UX — audyt „na papierze” i ustalenia

### 6.1 Heurystyki (skrót Nielsen + kontekst gry)

| # | Obszar | Pytanie kontrolne |
|---|--------|-------------------|
| 1 | Widoczność stanu | Czy gracz widzi „czyja tura”, seed, strategię bota bez zaglądania do logów? |
| 2 | Dopasowanie do świata | Czy UI wspiera fantazję (mediator, szczelina), czy tylko symulację (`p0`/`p1`)? |
| 3 | Kontrola | Czy zmiana strategii bota i roli ludzkiej jest przewidywalna (skutek PATCH)? |
| 4 | Spójność | Czy opisy strategii w selectach = to samo co w meta API / backlogu? |
| 5 | Prewencja błędów | Czy „Wykonaj” przy złej turze komunikuje błąd czytelnie (już częściowo przez HTTP)? |
| 6 | Rozpoznawalność | Czy 6 strategii ma rozróżnialne **krótkie** etykiety + dłuższy hint? |
| 7 | Elastyczność | Czy pauza / tempo / animacje pokrywają potrzeby „powrotu po tygodniu”? |

### 6.2 Scenariusze do przejścia przed kodem (checklista)

- [ ] **Pierwsze 60 s:** wejście na stronę → wybór roli → pierwszy ruch (papier: kroki + oczekiwany tekst na ekranie).
- [ ] **Powrót po tygodniu:** czy `matchBadge` + lista sesji wystarcza do orientacji?
- [ ] **Zmiana strategii w trakcie:** czy użytkownik rozumie, że wpływa na **bieżącą** sesję?

### 6.3 UX-Findings (priorytet → backlog)

| ID | Finding | P | Backlog |
|----|---------|---|---------|
| UX-FB2-01 | Brak jawnego podziału „tryb treningu vs widowisko” przy strategii bota | P1 | [RD-UX-010](BACKLOG.yaml) |
| UX-FB2-02 | Hint strategii tylko w `title` — słabszy dla czytników ekranu | P1 | [RD-UX-011](BACKLOG.yaml) |
| UX-FB2-03 | Długa lista legalnych ruchów — ryzyko paralysis | P1 | [RD-UX-012](BACKLOG.yaml) |
| UX-FB2-04 | Gracz A/B nie niesie fabuły — tylko mechanika | P0 | Warstwa „prawdziwej gry” §7 + [RD-NAR-004](BACKLOG.yaml) |
| UX-FB2-05 | Brak jednej linii „ile trwa typowa partia” dla casual | P2 | Ująć w copy / tooltip (Producer) |
| UX-FB2-06 | Challenge dnia — UI jeszcze nie istnieje; ryzyko „feature bez ramy” | P2 | [RD-RET-009](BACKLOG.yaml) + decyzja z §5 |

---

## 7. Od mechaniki do „prawdziwej gry” — warstwy

Gra przestaje być „tylko rules-module”, gdy **nakłada się** na mechanikę co najmniej jedna z poniższych warstw (papier → potem kod).

| Warstwa | Test na papierze | Implementacja (odnośniki) |
|---------|------------------|---------------------------|
| **Język i ramy** | Jedna strona: kto jest graczem, kim jest przeciwnik (Strażnik / Rozwarstwienie); nowe etykiety zamiast gołego p0/p1 | [`client/`](../client/), `narrativeSnapshot` / `narrativeResult` w serwerze |
| **Cel emocjonalny** | Zdanie designu: „Po wygranej gracz ma czuć ___”; 3 osoby — czy rozumieją bez zasad | Dopasowanie tekstów końca partii, później audio |
| **Progresja** | Szkic **jednej misji**: cel przed duel + jeden akapit po (warunek prosty) | [RD-MIS-002](BACKLOG.yaml), [RD-NAR-004](BACKLOG.yaml) |
| **Tożsamość wizualna** | Moodboard / paleta frakcji spójna z [`client/styles.css`](../client/styles.css) | Iteracja CSS, karty |

**Rekomendacja do uzupełnienia w §5:** wskazać **dwie** obowiązkowe warstwy przed następnym kamieniem milowym w [MANIFEST.md](MANIFEST.md) (np. *język + jedna misja tekstowa*).

---

## 8. Proces: papier → signoff → backlog → dev → macierz

1. Uzupełnić **§5** (decyzje).  
2. Zamknąć **§6.2** checklistę scenariuszy.  
3. Producer przenosi zaakceptowane rzeczy do [BACKLOG.yaml](BACKLOG.yaml) (status `ready`).  
4. Po implementacji: `npm test`, `npm run playtest:matrix`, ewentualnie podniesienie `RD_MATRIX_GAMES`.

Powiązany proces dokumentacyjny: [RD-PROC-013](BACKLOG.yaml).

---

## 9. Odtworzenie wyników liczbowych

```bash
cd games/rift-duel
npm run playtest:matrix
npm run playtest:archetypes
npm run simulate -- --games=2000 --seed=1
npm run simulate -- --games=2000 --seed=1 --p0=random --p1=random
```

*Po zmianie heurystyk w [`src/botStrategies.ts`](../src/botStrategies.ts) lub talii liczby w sekcji 2 mogą się różnić — uruchom ponownie i zaktualizuj ten plik lub załącznik metryk.*

---

## 10. Wdrożenie pokoleniowe (bez pełnej sesji GD+Producer) — 0.7.0

Zautomatyzowane „kontynuacja iteracji” po FB-RD-002:

| Obszar | Co wdrożono | Backlog |
|--------|-------------|---------|
| Gra ≠ tylko mechanika | Strażnik / Rozwarstwienie w UI, narracja serwera, zasady (skrót) | [RD-NAR-004](BACKLOG.yaml) nadal na pełną kampanię |
| UX-FB2-01 | Optgroup: Trening vs Widowisko (random) | [RD-UX-010](BACKLOG.yaml) **done** |
| UX-FB2-02 | `aria-describedby`, `aria-label`, `role="note"` przy hintach | [RD-UX-011](BACKLOG.yaml) **done** |
| UX-FB2-03 | Checkbox kompaktowych opcji + grupy „Zagrania” / „Koniec tury” | [RD-UX-012](BACKLOG.yaml) **done** (0.7.1) |
| Demo serwera | **Spike** przy `npm run server` (pierwsze wrażenie) | Częściowa realizacja wiersza §5 „trudność / meta” — **B** |

**§5 Decyzja** nadal **TBD** dla: balans turtle, regulamin challenge — wymaga ludzkiego signoff.
