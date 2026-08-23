# What Cellar hides, and what it does not

A privacy tool that overclaims is worse than one that ships late. This page is
deliberately specific about the limits.

## The one-sentence version

**Cellar gives identity privacy for yield actions, not amount privacy.**

The STRK20 documentation states it directly: actions routed through anonymizer
contracts reveal amounts and timing, and grant identity privacy only. Cellar
routes every earn and withdraw through an anonymizer, so that applies to all
of them.

## Hidden vs visible

| Hidden | Visible |
|---|---|
| **Who you are.** Nothing on-chain links an earn action to your wallet | The amount and timing of each earn or withdraw |
| Your total shielded balance across all notes | Which vault was used, and that the pool paid the helper |
| The link between your deposit and your withdrawal address | Depositor address and amount at the shield step |
| Note amounts and ownership inside the pool | Withdrawal recipient and amount |
| Note-to-note private transfers — **both** amounts and parties | Published nullifiers, unlinkable without a viewing key |
| Which of several vaults a given note went to, once several exist | The set of vaults the helper may route into (by design — it is auditable) |

## The mental model

**Visible flow, invisible participants** — the same shape prediction markets
use, applied to yield.

An observer watching Starknet sees that *someone* deposited into a Vesu market
through Cellar, and how much. They cannot tell it was you, cannot connect it to
your other positions, and cannot follow it to where you eventually withdraw.

That is a real and useful property. It is not the same as "nobody can see the
amount", and we do not claim it is.

## What an observer actually sees, step by step

For one private deposit:

1. The pool makes a **plain public ERC-20 transfer** to the helper. Amount
   visible. Which shielded note funded it: not visible. Who owns that note: not
   visible.
2. The pool calls `privacy_invoke`. The call and its calldata are public, so
   the operation, the tokens and the amount are public.
3. The helper deposits into the vault. Public.
4. The helper approves the pool. Public.
5. The pool credits an **encrypted note**. The amount is encrypted; ownership
   is unlinkable without the viewing key.

So the flow is legible and the participant is not.

## Known limitations, inherited from the pool

These are properties of the STRK20 privacy pool, not of Cellar, and no
application built on it can remove them:

- **Timing correlation.** A deposit and a withdrawal close together in time,
  with related amounts, can be linked by an observer watching the pool's edges.
- **Distinctive amounts.** Round or unusual amounts are recognisable. Shielding
  exactly 13.37 tokens and later withdrawing exactly 13.37 tokens defeats the
  anonymity set regardless of the cryptography.
- **Edge visibility by design.** Deposits into and withdrawals out of the pool
  are public, including the addresses and amounts. Privacy exists *inside* the
  pool.
- **Anonymity set size.** Privacy is relative to how many other people are
  doing similar things. Early in a pool's life, that set is small.

## Compliance

The pool is built for selective disclosure rather than opacity:

- Every deposit is **screened** by a compliance provider, whose signature the
  pool verifies on-chain. This applies to every route — including a self-hosted
  prover. It is not bypassable.
- At registration, the user's private viewing key is **encrypted to an
  auditor's public key** and stored on-chain. Under lawful process an auditor
  can decrypt one user's key and trace that user's history, without touching
  anyone else's.
- A viewing key is exactly that — *viewing*. Spending requires a valid account
  signature verified inside the proof. An auditor has no transaction authority.

Cellar adds nothing to this and removes nothing from it.

## Threats Cellar does not address

- **Off-chain correlation.** If you tell someone your position size, or access
  the app from an IP that identifies you, no on-chain mechanism helps.
- **Front-end trust.** You are trusting this app to construct the actions it
  says it does. Read the code, or build the actions yourself against the pool.
- **Wallet compromise.** The wallet holds the viewing key on the Wallet API
  route. A compromised wallet is a compromised position.
- **Vault risk.** Cellar routes into external lending markets. Smart-contract
  risk, liquidation risk and rate risk in those markets are unchanged by
  privacy.

## Design choices that follow from all this

- **No events.** `YieldHelper` emits nothing. An event carrying an amount or a
  note id would publish a correlatable trace of an otherwise private action.
- **No database.** Cellar stores no user positions server-side. A server-side
  record of who holds what would recreate exactly the surveillance the pool
  removes.
- **No owner.** The vault allowlist is fixed at construction with no setter, so
  a deployed helper is an auditable route that nobody — including us — can
  redirect.
