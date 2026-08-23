# Integration notes

Everything here was verified against the installed packages rather than copied
from documentation. Where the docs and reality disagreed, the code follows
reality and this file says so.

## Route: Wallet API, not the Privacy SDK

STRK20 offers two integration routes. Cellar uses the **Wallet API**.

On this route the **wallet** holds the viewing key, discovers notes, builds the
transaction, generates the ZK proof and submits it. The app requests actions
through starknet.js and never touches a key, a note, or a prover.

What that decision removes:

| Concern | On the SDK route | Here |
|---|---|---|
| Proving service | Configure or self-host a prover | The wallet proves |
| Note discovery | Configure or self-host an indexer | The wallet discovers |
| Viewing key must be a `BigInt` | Silent wrong derivation if you pass hex | We never hold a key |
| Prove against `currentBlock − 10` | Yours to get right | The wallet's concern |
| Empty `proofFacts` breaks a v3 tx | Yours to get right | The wallet builds the tx |

The SDK remains the right tool for Phase 4's selective disclosure, where
holding a viewing key briefly is the entire point of the feature.

## Package versions — two traps

**`npm install starknet` gives you the wrong version.** npm's `latest` tag
points at **10.0.2**, which has no `WalletAccountV6` and therefore no STRK20
Wallet API at all. The 10.4+ line exists but is only tagged `next`. A semver
range resolves correctly against all published versions:

```jsonc
"starknet": "^10.4.0"   // resolves to 10.7.x — correct
```

**`@starkware-libs/starknet-privacy-sdk` is not on npmjs.** It 404s. Use the
GitHub Packages registry or install from a pinned git commit. Not needed for
the Wallet API route, which is one more reason that route was chosen.

## Wallet discovery — why not get-starknet

`get-starknet-core` pins `@starknet-io/types-js` 0.7.x, while starknet.js
10.7's Wallet Standard adapter pins 0.10.x. The two `StarknetWindowObject`
types are then nominally incompatible even though they describe the same
runtime object, and no override fixes it without breaking one side.

Since all `get-starknet-core` contributed was scanning `window` for
`starknet_*` keys, Cellar does that directly and drops the dependency. See
`app/src/lib/wallet.ts`.

Connecting still needs one adapter, because starknet.js speaks Wallet Standard
while browsers inject the legacy object:

```ts
const { StarknetInjectedWallet } = await import(
  "@starknet-io/get-starknet-wallet-standard-v6"
);
const account = await WalletAccountV6.connect(rpc(), new StarknetInjectedWallet(w));
```

## Which wallets support privacy

The official sources disagree. `MAINNET-DAY-0.md` names **Ready and Braavos**;
other STRK20 pages name **Ready and Xverse**. Ready appears on both lists, so
it is the primary target.

Rather than trusting either list, Cellar **probes at runtime** for
`strk20InvokeTransaction` on the connected account and reports what is actually
there. Privacy is mainnet-only; the app refuses any chain that is not
`SN_MAIN`.

## The earn flow

A private DeFi call is **one** STRK20 transaction carrying **two** actions:

```ts
const actions: STRK20_ACTION[] = [
  // 1. Reserve an open note, denominated in whatever comes back.
  { type: "transfer", token: outToken, amount: "OPEN", recipient },
  // 2. Ask the pool to run our anonymizer against that note.
  {
    type: "invoke",
    contract: helper,
    calldata: [operation, inToken, outToken, lo, hi, "${openNoteIds[0]}"],
  },
];
const { transaction_hash } = await account.strk20InvokeTransaction(actions);
```

The literal amount `"OPEN"` creates an **open note** — a placeholder the pool
credits once the helper reports how much actually arrived. `${openNoteIds[0]}`
is a placeholder the wallet substitutes at build time with that note's id.

## The calldata contract

This is the seam between the app and the Cairo contract, and the easiest place
to get a silent mismatch. `privacy_invoke` takes:

```cairo
fn privacy_invoke(
    ref self: T,
    operation: LendingOperation,   // enum -> 1 felt: 0 = Deposit, 1 = Withdraw
    in_token: ContractAddress,     // 1 felt
    out_token: ContractAddress,    // 1 felt
    assets: u256,                  // 2 felts, LOW LIMB FIRST
    note_id: felt252,              // 1 felt
) -> Span<OpenNoteDeposit>;
```

So the calldata is **six felts**, not five. A `u256` serialises as two felts,
low first — `u256Parts()` in `app/src/lib/strk20.ts` does the split. Passing it
as one felt produces a calldata-length revert that looks unrelated to amounts.

Which side holds the vault depends on direction:

| Operation | `in_token` | `out_token` | Vault is |
|---|---|---|---|
| Deposit | underlying | shares | `out_token` |
| Withdraw | shares | underlying | `in_token` |

In an ERC-4626 round trip the vault contract *is* the share token, so the
allowlist check follows that mapping rather than a fixed argument position.

## Stealth withdrawals

`WalletAccountV6` exposes `strk20ShadowAccountCommitment(dappName, nonce)`.
Deriving a per-dapp shadow account lets a withdrawal land somewhere with no
on-chain link to the depositing wallet — which is the supported route to the
"stealth accounts" the sprint's integration-depth criterion names explicitly.
Wired in `app/src/lib/strk20.ts` as `shadowAccount()`.

## Dry runs

`strk20PrepareInvoke(actions, true)` builds and proves without submitting. Use
it to surface a failure before asking anyone to sign, and to measure proving
latency — which on this route belongs to the wallet but is still visible during
a demo. In simulate mode the proof fields come back empty and the call is not
submittable.

## Verified mainnet values

From `docs/MAINNET-DAY-0.md` in the sprint repository, pinned in
`config/mainnet.json`:

```
CHAIN_ID     SN_MAIN  (0x534e5f4d41494e)
RPC_URL      https://rpc.starknet.lava.build
POOL         0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a
EXPLORER     https://voyager.online
```

## Toolchain note

Starknet Foundry publishes **no Windows binary** as of v0.63.0 (macOS and Linux
only). Cellar's tests therefore use Cairo's native harness via
`scarb cairo-test`, with `deploy_syscall` and `testing::set_contract_address`.
That is enough to exercise the full pool → helper → vault cycle; the 11 tests
cover both paths and every protocol constraint. On macOS or Linux you can
additionally run `snforge` against the same contracts.

Deployment uses **starkli**, which does ship a Windows binary. See
`scripts/DEPLOY.md`.
