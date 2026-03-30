# Status i rezultaty gier (FORGE)

## Data aktualizacji
2026-03-30

## Styl raportu
Dokument ma priorytet „opisowe statusy”: liczby są tylko wtedy, gdy potwierdzają wynik (np. golden seeds / win-rate), a nie do wypełniania miejsca.

## Jak czytać ten dokument
Każda gra ma:
1. „Stan produktu” (wersje content/kodu + co obecnie jest gotowe).
2. „Status wykonania” (gdzie znajdujemy się na osi backlog/milestones).
3. „Rezultaty” (liczbowo, jeśli istnieją w dokumentach playtest/feedback/changelog; inaczej — potwierdzone wykonaniem zadań).

---

## Deepspire (Roguelike turowy)

### Stan produktu
- Tytuł roboczy: `Deepspire`
- Wersja zasad (content): `0.1.0`
- Wersja kodu (pakiet): `0.2.1`
- Rdzeń: siatka 11×11, pijany kopacz + schody, ruch 4-kierunkowy, zejście z głębokości 3 = wygrana
- Aktualnie w pakiecie: rules module + testy + `simulate` + `playtest:golden` + serwer REST/WS + klient (mapa, akcje pogrupowane/kompakt) + „wyzwanie dnia” seed z `/api/meta`
  - Źródło: `games/deepspire/docs/MANIFEST.md`

### Status wykonania
Z backlogu (pozycje `done`):
- `DS-UX-001` — grupowanie akcji (ruch / schody / czekaj) + widok kompaktowy legalnych akcji
- `DS-BOT-001` — macierz / golden seeds po zmianie pickSimpleBotAction
- `DS-RET-001` — challenge dnia: jawny seed + zapis w `MANIFEST.md`
- Źródło: `games/deepspire/docs/BACKLOG.yaml`

Następny kamień milowy (z MANIFEST):
- Ekwipunek, typy wrogów, druga heurystyka bota + macierz (`DS-BOT-002`), API `/api/v1/...`, anty-pętla AI na trudnych seedach
- Źródło: `games/deepspire/docs/MANIFEST.md`

### Rezultaty (metryki / weryfikacje)
Golden seeds (`npm run playtest:golden`, MAX_STEPS=120000) przechodzą:
- dla zestawu seedów (w tym `20260330`, seed challenge dnia) bot zawsze kończy grę bez timeoutów,
- w wynikach jest przewaga `victory` (7 zwycięstw) nad `death` (2 porażki),
- liczba kroków mieści się w zakresie „kilkudziesięciu” (dla zapisanych golden seeds: ok. 21–52 kroków).
- Źródło: `games/deepspire/scripts/golden-seeds.ts` + uruchomienie `npm run playtest:golden`

Symulacja skrócona (seed `42`, `runs=200`) potwierdza stabilność, ale pokazuje ograniczenie:
- rozgrywki kończą się zarówno zwycięstwem (`~60%`) jak i śmiercią (`~14%`),
- część partii kończy się „po prostu zanim zdąży się rozstrzygnąć” (osiągany limit kroków; reszta przypadków poza `victory/death`),
- wniosek produktowo-balansowy: bot jest deterministyczny i „kończy”, ale na niektórych seedach potrzebuje poprawy heurystyki, żeby rzadziej dochodzić do limitu.
- Źródło: `games/deepspire/scripts/simulate.ts`

### Opinie agentów (syntetycznie)
- PM: zrobione są kluczowe elementy pionu „vertical slice” (challenge dnia + regresje golden), ale kolejny kamień milowy (druga heurystyka / macierz) jest jeszcze poza „done”.
- GD: zadowolony z domknięcia core pętli i czytelnych akcji (`DESCEND` jako wygrana), nie w pełni zadowolony z odporności bota na seedy, które wymuszają limit kroków.
- Producer: dobry kierunek w live-ops porównywalności (seed w `MANIFEST`), ale pilnuje, by heurystyki nie rozmijały się z „sercem wieży” (deterministyczny loch).
- DEV: sukces w spójności rules-module + testy + serwer REST/WS; oczekuje dalszych iteracji nad AI (macierz `DS-BOT-002`).
- QA: golden seeds dają pewność regresji (brak timeoutów na bazowym zestawie), ale do pełniejszej oceny potrzeba rozszerzenia próby o „trudne” seedy (backlog `DS-BOT-003`).
- Reviewer: UI/UX dla legalnych akcji już działa w sensie funkcjonalnym (kompakt), jednak dalej będzie zależało od „ile AI daje zrozumiały wzorzec zachowań”.
- Marketing: ma gotowy hook na „wyzwanie dnia” (seed + link), ale potrzebuje domknięcia balansowej atrakcyjności (żeby codzienne partie nie wpadały w „limit kroków”).

---

## Drift Front (Strategia turowa 1v1)

### Stan produktu
- Tytuł roboczy: `Front Dryfu (Drift Front)`
- Wersja zasad (content): `0.2.0`
- Wersja kodu (pakiet): `0.2.1`
- Rdzeń: plansza 5×5, filary zablokowane `(1,1)` i `(3,3)`, 2 jednostki × gracz (HP 5, atak 2), 1 akcja / półtura, eliminacja lub remis po limicie półtur
- W pakiecie: rules + boty (`spike`/`aggro`/`turtle`/`random`) + macierz + serwer REST+WS + klient obserwatora + testy/golden seeds
- Źródło: `games/drift-front/docs/MANIFEST.md`

### Status wykonania
Backlog (stan wg `BACKLOG.yaml`):
- `DF-CI-002` — Golden seeds w CI (`tests/golden-seeds.test.ts`) → `done`
- Pozostałe istotne pozycje:
  - `DF-BOT-001` — mirror `turtle` vs `turtle` (remisowy problem) → `backlog`
  - `DF-FEED-003` — pierwszy dokument feedbacku FEEDBACK_FB-DF-001 → `backlog`
  - `DF-UX-004` — challenge dnia (stały seed w URL + skrót) → `backlog`
- Źródło: `games/drift-front/docs/BACKLOG.yaml`

### Rezultaty (metryki / wnioski z playtestów)
- Ustalony problem w macierzy: `turtle` w matchupach „nie wchodził w kontakt” z `spike`/`aggro`, kończąc na remisach na limicie.
- Po korekcie heurystyki (timeline):
  - `turtle` vs `spike` kończy się wyraźną wygraną w próbach
  - `turtle` vs `turtle` nadal często remisuje z powodu symetrii
- Liczbowy checkpoint (żeby było „jasno”): `DF-BOT-001` pokazuje `turtle vs turtle` jako remisowy na limicie (`24/24`).
- Źródła: `games/drift-front/docs/DESIGN_HISTORY.md`, `games/drift-front/docs/BACKLOG.yaml`

### Opinie agentów (syntetycznie)
- PM: pipeline testów i komunikacji działa (CI + golden seeds), ale największa luka jakości to brak finalnego rozwiązania dla mirror turtle (tie-break / obowiązkowe zbliżenie).
- GD: zadowolony z naprawy MU turtle↔spike (kontrolowana zmiana zachowania), ale uważa, że mirror wymaga decyzji o tym, „czy remis ma być featurem”.
- Producer: pilnuje, by nie dopisywać „dziwnych” tie-breaków kosztem czytelności; oczekuje konkretnej decyzji z backlogu.
- DEV: zrobił fundamenty dla deterministycznej macierzy i CI (`DF-CI-002` done), następny krok to implementacja alternatywnej logiki tie-break.
- QA: ma twardy dowód problemu w `playtest:matrix`; zadowolony z regresji, ale chce zobaczyć, że nowa heurystyka poprawia też zakresy seedów, nie tylko pojedynczy przypadek.
- Reviewer: graficznie/UXowo to „wciąż duel taktyczny” – decyzje balansu powinny dać większą „prawdopodobność rozstrzygnięcia”.
- Marketing: challenge dnia jeszcze nie ma ramy w produkcie (jest w backlogu), więc atrakcyjność hooka ogranicza brak „pewności ciekawych wyników”.

---

## Pęknięcie (Rift Duel) (Karciany duel taktyczny 1v1 → gra PC)

### Stan produktu
- Tytuł roboczy: `Pęknięcie (Rift Duel)`
- Wersja zasad (content): `0.2.1`
- Wersja kodu (pakiet): `0.7.3`
- Rdzeń: HP/ward, do 2 zagrania/turę, doborów + fatigue, deterministyczny seed (replay), opcjonalne modyfikatory startu (`extraOpeningDraws` w misji)
- Obecny stan produktu:
  - MVP rules + 0.7.x z `botStrategy`, daily challenge, UI obserwatora
  - kampania Arc 1 (5 kroków PL) w `content/campaign.json` + obsługa w UI/serwerze
- Źródło: `games/rift-duel/docs/MANIFEST.md`

### Status wykonania
Z `BACKLOG.yaml` (pozycje `done`):
- `RD-MIS-002` — `MissionConfig` / modyfikatory startu (w tym `extraOpeningDraws`)
- `RD-HTTP-003` — REST API minimalne (POST `action`, GET state/meta)
- `RD-WEB-007` — gra ludzka vs bot w przeglądarce (klikalne legalne ruchy)
- `RD-BOT-008` — strategie bota + wybór strategii w API i UI (`botStrategy`)
- `RD-RET-009` — challenge dnia: ustalony seed + leaderboard lokalny / share link
- `RD-NAR-004` — kampania tekstowa (5 misji)
- Źródło: `games/rift-duel/docs/BACKLOG.yaml`

Z `DESIGN_HISTORY.md` (najnowsze wpisy):
- wprowadzono kampanię (MissionConfig + tekstowe kroki) oraz daily challenge/retencję lokalną
- Źródło: `games/rift-duel/docs/DESIGN_HISTORY.md`

### Rezultaty (metryki z playtestów)
1. Playtest archetypów (FEEDBACK FB-RD-001)
- Mirror losowy (2000 gier) daje rozkład winów bliski `50/50` oraz średnią długość partii ok. `~68` kroków (czyli: „gra jest powtarzalna i tempo jest w ryzach”).
- Źródło: `games/rift-duel/docs/FEEDBACK_FB-RD-001.md`

2. Macierz archetypów + decyzje GD/Producer (FEEDBACK FB-RD-002)
- W macierzy deterministycznej (bez `random`) widać wyraźne różnice w sile archetypów: `spike` dominuje, a `turtle` wypada najgorzej (i jednocześnie wydłuża partie).
- To jest „jasny sygnał” do decyzji GD/Producer, czy `turtle` ma być trudnym archetypem (hard mode), czy wymaga korekty heurystyki/kart.
- Źródła: `games/rift-duel/docs/FEEDBACK_FB-RD-002.md`

### Opinie agentów (syntetycznie)
- PM: dobrze dowieziona warstwa produktowa „kampania + daily challenge + UI obserwatora”; ryzyko to dalszy backlog (np. pełny zestaw leaderboard/PvP), ale proces feedbacku jest zamknięty.
- GD: zadowolony z deterministycznego rdzenia i spójności „poważnego tonu szczelin”; niezadowolenie: potrzeba decyzji, jak ustawić `turtle` i kiedy to jest „feature hard-mode”, a kiedy regresja balansu.
- Producer: zadowolony z jakości procesu (FB → papier → signoff jako wzór), ale wstrzymuje dryf (utrzymanie wizji wymaga gate dla kolejnych zmian).
- DEV: dowiozło integracje (kampania, meta, botStrategy, endpointy) oraz narzędzia do macierzy; gotowy do rozszerzenia „quality” o większe N seedów.
- QA: ma twarde dowody jakości balansu i deterministyczności; do szczęścia potrzebuje rozszerzenia prób dla kolejnych decyzji (backlog `RD-QA-006`).
- Reviewer: ocenia, że UI i język już zaczynają tworzyć „prawdziwą grę”, ale ryzyko to cognitive load przy wielu opcjach i „jasność” feedbacku nielegalnych ruchów.
- Marketing: ma w ręku hook „challenge dnia” (seed + share), jednak docelowy „demo moment” będzie mocniej zależał od finalnego tempa i balansu archetypów.

---

## Szkarłatna przysięga (Scarlet Oath) (RPG taktyczny 1v1 → moduł rules dla FORGE)

### Stan produktu
- Tytuł roboczy: `Szkarłatna przysięga (Scarlet Oath)`
- Wersja zasad (content): `0.1.1`
- Wersja kodu (pakiet): `0.2.1`
- Rdzeń: siatka 6×5, 3 AP/tura, MOVE/STRIKE/WARD/END_TURN, ward max 10, HP 22/22 (symetria pod mirror-AI)
- W pakiecie: rules + testy + golden replay (fixtures) + `npm run balance` + REST/WS + endpoint `valid-actions` + klient; działa też `CHANGELOG.yaml` i `BACKLOG.yaml`
- Źródło: `games/scarlet-oath/docs/MANIFEST.md`

### Status wykonania
- W `BACKLOG.yaml` większość pozycji jest `todo`, przy czym utrzymane są już kluczowe regresje:
  - `SO-GOLDEN-42` — regresja golden replay/seed42 → `done`
  - `SO-VALID-ACTIONS` — `GET /api/sessions/:id/valid-actions` → `done`
- Źródło: `games/scarlet-oath/docs/BACKLOG.yaml`

### Rezultaty (metryki / weryfikacje)
1. Balans (GDD, wprost pod mirror-AI)
- `greedy vs greedy` ma rozkład bliski „symetrii” (ok. `53% / 47%`), co potwierdza, że mirror-AI i seed deterministyczne dają porównywalne wyniki.
- Źródło: `games/scarlet-oath/docs/GDD.md`

2. Regresja deterministyczna i API-first (CHANGELOG)
- `version: 0.2.1` domyka regresję deterministyczną (replay + golden fixture) oraz udostępnia endpoint `valid-actions`, co wprost wspiera integrację UI i narzędzia testowe.
- Źródło: `games/scarlet-oath/docs/CHANGELOG.yaml`

### Opinie agentów (syntetycznie)
- PM: zadowolony z domknięcia warstwy „API-first + replay + regresja”, ale gra nadal jest w backlogu P0-P3 (kolejne uniki/umiejętności/PvE).
- GD: zadowolony, że balans pod mirror-AI jest czytelny i mierzalny; nie w pełni zadowolony, bo backlog RPG depth jeszcze czeka.
- Producer: pilnuje „rules module discipline” (deterministyczność, czytelność), a teraz można bezpiecznie dodawać kolejne feature’y.
- DEV: dobrze dowiózł endpointy i mechanikę golden replay; kolejny krok to rozwijanie contentu (umiejętności / PvE).
- QA: ma stabilny zestaw regresji dla seed42; chce rozszerzyć golden coverage, gdy pojawią się kolejne umiejętności lub zmiany w rules module.
- Reviewer: endpointy i UI state są już gotowe na reviewowanie „jak to się czuje”, ale potrzeba więcej treści do oceny fun.
- Marketing: nie ma jeszcze szerokiego live-ops (brak w backlogu gotowego ranking/quest), więc skupia się na „czym jest gra” i czy UI pokazuje hook.

---

## Następne kroki (propozycja uzupełnienia dokumentu)
- Przy kolejnej prośbie („wygeneruj kolejną wersję dokumentu”) zaktualizuję wyłącznie:
  - statusy z `BACKLOG.yaml` (co jest `done`/`in_progress`/`backlog`),
  - zmiany w `MANIFEST.md` (versions + „state product”),
  - rezultaty tylko wtedy, gdy nowe artefakty istnieją (FEEDBACK/CHANGELOG/playtest raporty),
  - oraz dopiszę opinie agentów z evidence (bez długich tabel liczbowych).

