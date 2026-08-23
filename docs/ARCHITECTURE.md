# Architecture

## Where Cellar sits

Cellar is not a privacy protocol. It is a small adapter that lets an existing one reach a yield venue it otherwise could not.

```
user's wallet  ──▶  STRK20 privacy pool  ──▶  YieldHelper  ──▶  ERC-4626 vault
   (Ready /            (shielded notes,        (this repo)        (Vesu, etc.)
    Xverse)             proofs, nullifiers)
```

Everything cryptographic lives to the left of `YieldHelper`. The pool holds encrypted notes, verifies proofs, publishes nullifiers, and enforces double-spend protection. The SDK derives channels, encrypts note amounts, and manages viewing keys. **None of that is implemented here, and none of it should be.**

`YieldHelper` receives plain ERC-20 tokens, performs one deterministic action, and returns an instruction. It is deliberately boring — the boring part is the point, because it is the part that touches user funds.

## The invoke cycle

The pool drives an `InvokeExternal` action as a single atomic transaction:

1. **Withdraw.** The pool makes a plain ERC-20 transfer of the input tokens from itself to the helper. This is public: an observer sees the pool paid the helper, and the amount. It does not reveal which shielded note funded it or who owns that note.

2. **Invoke.** The pool calls `privacy_invoke` on the helper through the protocol's `INVOKE_SELECTOR`.

3. **Execute.** The helper approves the vault and calls `deposit`, or calls `withdraw` — depending on the `LendingOperation`. It records the output token balance immediately before and after.

4. **Approve.** The helper approves the pool for the measured delta. It must not transfer: the pool performs the pull itself while applying deposits, and a push would desynchronise its accounting.

5. **Credit.** The helper returns `Span<OpenNoteDeposit>`. The pool pulls the output and credits a new encrypted note.

Any failure reverts all five steps.

## Design decisions

### The vault allowlist is immutable

The reference implementation pins a single venue as a constructor parameter. Cellar generalises that to a set, still written once in the constructor, still with no setter.

This matters because `privacy_invoke` takes token addresses as arguments. Without an allowlist, malformed or malicious calldata could name an arbitrary contract as the "vault" and the helper would call it. The allowlist reduces the reachable surface to a fixed set chosen at deployment and publicly readable afterwards.

The absence of a setter is equally deliberate. An owner who can add a vault later is an owner who can be compromised, coerced, or change their mind. A deployed Cellar helper is a fixed route or it is nothing.

### Output is measured, not reported

ERC-4626 `deposit` returns a shares figure. Cellar discards it and uses the balance delta instead. A vault that misreports — through a bug, a fee-on-transfer underlying, or malice — cannot cause the pool to credit a note that isn't backed by tokens actually received.

The delta is `u256` and a note amount is `u128`, so the conversion is explicit and reverts on overflow rather than truncating.

### The helper emits nothing

There are no events in `YieldHelper`. An event carrying an amount or a note id would publish exactly the correlatable trace the pool exists to suppress. Debugging convenience is not worth a privacy leak in a contract whose entire purpose is privacy.

### Which side is the vault

In an ERC-4626 round trip, the vault contract *is* the share token, so it appears on whichever side holds shares:

| Operation | `in_token` | `out_token` | Vault is |
|---|---|---|---|
| Deposit | underlying | shares | `out_token` |
| Withdraw | shares | underlying | `in_token` |

The allowlist check follows that mapping rather than checking a fixed argument position.

## Protocol constraints

These come from the STRK20 anonymizer anatomy and are not negotiable:

- Return **exactly** a `Span<OpenNoteDeposit>` — trailing data makes the pool reject the call.
- Approve, never transfer.
- Measure output by balance delta.
- At most **one** invoke per pool transaction. Batching happens inside the helper, never across calls.
- An empty span is legal and means "credit nothing yet" — useful for a stateful helper parking funds until a later claim. Cellar does not currently use this.

## Client-side gotchas

Documented here because each costs roughly a day to rediscover:

- The viewing key must be a **`BigInt`**, not a hex string. A hex string derives silently wrong rather than throwing.
- Prove against **`currentBlock − 10`**. Notes mature ten blocks after creation.
- Never spread an empty `proofFacts` array into a v3 transaction — build the proof object conditionally. Always pass `tip: 0n`.

## Not built, and why

The RFP describes Enclave-based confidential routing and private sub-accounts fanning capital into unlinkable execution identities. Neither has shipped on Starknet. They are the correct long-term architecture and they are not buildable today, so Cellar implements the MVP the RFP itself defines and says so plainly rather than implying capabilities it does not have.
