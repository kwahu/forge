# FORGE — zasady działania (na stałe)

Ten plik jest „kontraktem zachowania” dla agenta pracującego w repozytorium `d:/FORGE`.

## Design Lock (anty-wyprzedzanie)
- Implementacja nie może wyprzedzać designu.
- `DEV` może zaczynać dopiero po tym, jak `design_lock_green` zostanie zatwierdzone przez `GD + Producer` (jawne: spec + acceptance criteria + success metrics + zgodność z wizją).

## Decision Quorum (każda decyzja o następnym kroku)
- Przy przejściu fazy (Design→Build→Test→Review→Decide→Plan) zawsze wypowiadają się wszystkie role: `PM, GD, Producer, DEV, QA, Reviewer, Marketing`.
- Jeżeli choć jeden agent blokuje (`hold/no-go`), nie wykonujemy kolejnego kroku.

## Domyślna odpowiedź (szablon)
W każdej decyzji o „next step” dołącz:
- `DECISION_QUORUM(next_step=...)` z werdyktami i krótkim uzasadnieniem każdej roli.

