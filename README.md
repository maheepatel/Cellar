# Strongbox

**A private yield account on Starknet.** Shield an asset into the STRK20 privacy pool, route it into a live ERC-4626 lending vault through a custom anonymizer contract, and let the yield accrue back as encrypted notes — so your position size, your strategy, and the link between your deposit and your withdrawal all stay private, while your solvency stays provable to anyone you choose.

Built for the [STRK20 Private Sprint](https://strk20.starknet.io/hackathon), against [RFP-24 — Private chain-abstracted yield account](https://strk20.starknet.io/rfp/private-yield-account).

---

## The problem

On-chain savings expose everything. Anyone can read your complete balance sheet and DeFi allocation. When positions execute from the same wallet across protocols, observers reconstruct your strategy and front-run it. Deposit and withdrawal addresses stay permanently linked, so the entire path of your capital is a public record.

Bitcoin was invented so value could move without permission or surveillance. Seventeen years later, your balance is a URL anyone can open. Strongbox is a small, concrete step at fixing that for yield-bearing positions.

## How it works

Strongbox is an **anonymizer contract** — an app-specific Cairo adapter that the STRK20 privacy pool calls atomically. One private deposit is five steps inside a single transaction:

| # | Step |
|---|---|
| 1 | The pool transfers your input tokens to the helper — a plain public transfer, so observers see *the pool paid the helper*, never who asked |
| 2 | The pool calls `privacy_invoke` via the protocol's `INVOKE_SELECTOR` |
| 3 | The helper deposits into (or withdraws from) an allowlisted ERC-4626 vault |
| 4 | The helper **approves** the pool to pull the output — it never transfers |
| 5 | The helper returns `Span<OpenNoteDeposit>`; the pool pulls and credits an encrypted note |

If any step fails, the whole transaction reverts. The helper never holds custody across blocks, never learns who you are, and never touches an encrypted note — it receives plain tokens, does one job, and hands back an instruction.

## What is actually hidden

Being honest about this matters more than overclaiming. The pool conceals a great deal and publishes some things by design.

| Hidden | Visible |
|---|---|
| Your total shielded balance | That the pool paid the helper, and how much |
| Your position size in any vault | Aggregate vault TVL and yield rates |
| Which vault you chose, and when you rebalanced | The set of vaults this helper may route into |
| The link between your deposit and your withdrawal | Deposit and withdrawal amounts at the pool's public edge |
| Note amounts and ownership | Published nullifiers — unlinkable without a viewing key |

Known limitations inherited from the pool: tight deposit-and-withdraw timing can correlate, distinctive round amounts are recognisable, and the pool's outer edges are public by design. Strongbox does not change any of that, and no privacy tool should claim otherwise.

## Security design

- **No owner, no admin key.** The vault allowlist is written once in the constructor and has no setter. Nobody — including us — can redirect user funds after deployment.
- **Immutable, auditable route.** The vaults a deployed helper may reach are fixed and publicly readable via `allowed_vault_count()` and `allowed_vault_at()`.
- **Output measured by balance delta**, never by the vault's reported return value.
- **No events.** An event here would publish a correlatable trace of an otherwise private action.
- **Approve, never transfer** — the pool pulls, so accounting can't be desynchronised by a rogue push.

## Repository layout

```
contracts/
  src/yield_helper.cairo   the anonymizer — this is what goes to mainnet
  src/mocks.cairo          ERC-20 + ERC-4626 test doubles
  src/tests.cairo          9 tests covering both paths and every guard
docs/
  ARCHITECTURE.md          the full cycle and design decisions
scripts/                   deployment helpers
strk20.json                what the sprint panel reads
```

## Quickstart

Requires [Scarb](https://docs.swmansion.com/scarb/) 2.20+ and Node 24+.

```bash
git clone https://github.com/maheepatel/strongbox
cd strongbox/contracts
scarb build
scarb cairo-test
```

Expected: `9 passed; 0 failed`.

### A note on the test runner

Tests use Cairo's native harness rather than Starknet Foundry, because **starknet-foundry publishes no Windows binary** as of v0.63.0 (macOS and Linux only). The native harness provides `deploy_syscall` and `testing::set_contract_address`, which is enough to exercise the full pool → helper → vault cycle. On macOS or Linux you can additionally run `snforge` against the same contracts.

### Testing without a live Vesu market

Vesu may not be deployed on Starknet Sepolia. `MockVault` is a minimal ERC-4626 stand-in with a `simulate_yield_bps` hook, and the helper cannot tell it apart from the real thing — it only ever calls `deposit`, `withdraw`, `balance_of` and `approve`. Test against the mock on Sepolia, then pass the real Vesu vToken address to the constructor on mainnet.

## Deployed contracts

| Network | Contract | Address |
|---|---|---|
| Mainnet | YieldHelper | _pending — see `strk20.json`_ |
| Sepolia | YieldHelper | _pending_ |

STRK20 privacy pool (mainnet): `0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a`

## Scope

This implements the **MVP defined in RFP-24**: a helper contract managing shielded balances, routing to ERC-4626 lending vaults, with viewing-key disclosure.

It deliberately does **not** attempt the full RFP architecture. That description includes Enclave-based confidential routing and private sub-accounts, **neither of which has shipped on Starknet yet**. Building on them today would be building on nothing. When they land, the routing layer is the natural next piece.

## Status

- [x] Anonymizer contract, deposit and withdraw paths
- [x] Immutable vault allowlist
- [x] Test suite — 9 passing
- [ ] Sepolia deploy against `MockVault`
- [ ] Mainnet deploy against a live Vesu market
- [ ] Web app — shield, earn, withdraw, position view
- [ ] Viewing-key solvency proof + public verifier page
- [ ] Demo video

## License

Apache-2.0. See [LICENSE](LICENSE).

## Acknowledgements

Built on [STRK20](https://strk20.starknet.io) by StarkWare. The anonymizer pattern and the Vesu lending helper it adapts are documented at [STRK20 by Example](https://strk20-by-example.org/).
