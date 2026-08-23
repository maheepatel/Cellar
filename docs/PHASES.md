# Phases

Each phase ends at a gate that is objectively true or false. No phase starts
before its predecessor's gate is met. Scope gets cut from the end, never from
the middle — phases 1 and 2 carry most of the score and are not compressible.

Deadline: **31 August 2026, 23:59 UTC.**

---

## Phase 0 — Contracts and repository ✅

Anonymizer contract with both paths, an immutable vault allowlist, ERC-4626
test doubles, 11 passing tests, the Wallet API integration layer, a Day 0
console, deployment guide, and honest privacy docs.

**Gate met** — `scarb build` and `scarb cairo-test` both green, app builds and
typechecks, registered on the sprint board.

---

## Phase 1 — Three mainnet transactions

The sprint scores nothing without three verified mainnet transaction hashes in
`strk20.json`. This phase exists solely to produce them, and it comes before
any product work because it is the gate everything else depends on.

1. **Register viewing key.** Uses standard `signMessage` — explicitly needs no
   STRK20 wallet support, so it can be done the moment a funded mainnet wallet
   exists. This is the cheapest transaction to land first.
2. **Shield tokens.** Deposit an ERC-20 into the pool, receive an encrypted
   note. Screened by a compliance provider; depositor address and amount are
   public by design.
3. **Private transfer.** Note-to-note. Only encrypted notes and nullifiers are
   emitted — no amounts, no parties. The fully private one.

Also in this phase: deploy `YieldHelper` to Sepolia against `MockVault` and
verify a complete round trip, so the first mainnet deployment is not the first
time the contract has ever run.

**Gate — three mainnet tx hashes committed to `strk20.json`.**

---

## Phase 2 — Live yield on mainnet

Deploy `YieldHelper` to mainnet, pinned at construction to a real Vesu vToken
chosen for liquidity and a non-zero rate. Drive a full deposit → accrue →
withdraw cycle through the pool.

This is where the 30% integration-depth score is earned. Most of the field is
calling shield/transfer/unshield through a wallet; an anonymizer contract that
the pool invokes atomically is a different tier of integration.

**Gate — helper address in `strk20.json`, round trip verified on Voyager.**

---

## Phase 3 — Product surface

Position dashboard: shielded balance, live APR, accrued yield, earn and
withdraw flows, withdrawal to a shadow account. Deployed publicly with no
login.

Prizes are decided here. A polished screen beats one more feature, and
"working mainnet product, for a real user, not a prototype behind a login" is
30% of the score.

**Gate — a public URL anyone can open and use.**

---

## Phase 4 — Selective disclosure

A viewing-key scoped proof that answers exactly one question — does this
position clear a threshold — and reveals nothing else. Plus a verifier page a
judge can open themselves.

This is the innovation beat. It is also the one place the Privacy SDK may be
needed rather than the Wallet API, because holding a viewing key briefly is
the entire point of the feature.

**Gate — a stranger verifies a claim without learning the balance.**

---

## Phase 5 — Documentation and freeze

README a stranger can follow end to end, architecture notes, the hidden-versus-
visible table, contract documentation, tests green. No new features after this
point.

**Gate — a clean clone builds and runs from the README alone.**

---

## Phase 6 — Video and submission

Three-minute demo video. It opens on the split screen — a block explorer
showing an empty public balance beside a live earning position — not on
architecture. Final `strk20.json` with transactions, contracts, video and demo
URL.

Submissions close 23:59 UTC. Be finished by 18:00.

**Gate — all four `strk20.json` fields populated.**

---

## What gets cut if time runs short

In order: Phase 4 first, then the polish half of Phase 3. Phases 1 and 2 are
not negotiable — they carry 60% of the rubric between them, and without Phase 1
the project is not scored at all.
