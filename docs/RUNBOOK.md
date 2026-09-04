# Runbook — run Cellar end to end on testnet

Written for someone who has not used Starknet before. Every step says what you
should see, so you know whether it worked before moving on.

**Everything here is free.** Sepolia is Starknet's test network; its tokens
have no value and come from a faucet.

---

## Before you start: what you are actually testing

Cellar has three layers, and they can be tested independently:

| Layer | What it is | Needs |
|---|---|---|
| **1. The chain data** | Reading the live privacy pool | nothing — just a browser |
| **2. Our contract** | `YieldHelper`, the anonymizer | a funded testnet wallet + starkli |
| **3. The private flows** | Shield, transfer, earn | a wallet that implements the STRK20 Wallet API |

Layer 3 has an **open question**: the STRK20 docs say in-wallet privacy is
mainnet-only. The privacy pool itself is definitely deployed on Sepolia — we
verified its class hash on-chain, and it holds ~227k STRK — but whether Ready
or Braavos expose `strk20InvokeTransaction` on Sepolia is untested.

**Step 6 is where you find out.** The app probes for it and tells you plainly
rather than failing with a confusing error. If it is unsupported, Step 9 gives
you a way to test our contract anyway.

---

## Step 1 — Install a Starknet wallet

Starknet wallets are browser extensions, like MetaMask but for Starknet.
MetaMask itself will **not** work — Starknet is a different chain with a
different account model.

Pick one:

- **Ready** — <https://www.ready.co> (formerly Argent X). Named by every STRK20
  source, so it is the primary target.
- **Braavos** — <https://braavos.app>. Named in the sprint's own Day-0 doc.

Install the extension, create a new wallet, and **write the recovery phrase on
paper**. Even on testnet, get in the habit.

> Never type a recovery phrase into a terminal, a chat, or any website that is
> not the wallet extension itself. Nobody legitimate will ever ask for it.

**You should see:** a wallet extension icon in your browser toolbar, and an
account address starting `0x0…`.

---

## Step 2 — Switch the wallet to Sepolia

In the wallet's network dropdown (usually top of the extension), choose
**Sepolia** / **Testnet**.

**You should see:** the network label change, and your balance reset to 0. That
is expected — mainnet and testnet are separate worlds with separate balances.

---

## Step 3 — Get free testnet tokens

Go to <https://starknet-faucet.vercel.app> (or <https://faucet.starknet.io>),
paste your Sepolia address, and request STRK.

You need STRK for two things: paying transaction fees, and having something to
shield.

**You should see:** a balance appear in your wallet after a minute or two. If
nothing arrives, faucets rate-limit per address per day — try the other one.

---

## Step 4 — Run the app

```bash
cd "D:/Vibe coing apps/cellar/app"
npm install
npm run dev
```

Open <http://localhost:5273>.

**You should see:** the landing page, a **testnet** chip next to "live on
Starknet Sepolia", and a current block number.

> If `npm install` pulls a `starknet` below 10.4.0, the Wallet API will not
> exist. The dependency is pinned `^10.4.0`, which resolves correctly — but
> npm's `latest` tag points at 10.0.2, so never "fix" it by installing
> `starknet@latest`.

---

## Step 5 — Confirm it is reading the real chain

Still on the landing page, look at the four stat tiles and the chart.

**You should see:** roughly **227,000 STRK** and **~100 ETH** shielded in the
pool, and a chart with a line that moves. USDC and WBTC will read 0 — nobody
has shielded those on Sepolia.

This is **layer 1 working**. Those numbers are live `balance_of` calls against
the real Sepolia privacy pool. Click the pool address to open it on
sepolia.voyager.online and check the balances match.

Nothing here needs a wallet. That is the point — the anonymity set is public
and auditable by anyone.

---

## Step 6 — Connect your wallet (the moment of truth)

Go to **/day0** and click your wallet's button.

**You should see** one of two things:

| Result | Meaning |
|---|---|
| `wallet api — supported` (green) | Layer 3 works on Sepolia. Continue to Step 7. |
| `not supported by this wallet` (red) | In-wallet privacy is mainnet-only for now. Skip to Step 9. |

The app checks for `strk20InvokeTransaction` on the connected account at
runtime rather than trusting a documentation list, because the official sources
disagree about which wallets qualify.

---

## Step 7 — Shield, transfer, unshield

Only if Step 6 said *supported*.

On **/day0**, set token `STRK` and a small amount like `1`, then run the three
operations in order:

1. **Shield** — moves public STRK into the pool as an encrypted note. Your first
   private action also registers your viewing key, automatically.
2. **Private transfer** — note to note. Leave the destination as your own
   address; it still exercises the private path.
3. **Unshield** — exits to a public address. Paste a **different** address here,
   not the one you deposited from.

Each will pop your wallet to approve. Proving takes a few seconds — the button
says "proving…" and that is normal, not a hang.

**You should see:** each step turn green with a transaction hash, a Voyager
link, and the `strk20.json` block at the bottom filling with hashes.

---

## Step 8 — Check the privacy claims yourself

This is the part worth doing carefully, because it is what the project claims.

Open your **shield** transaction on sepolia.voyager.online:

- ✅ **Visible:** your address, the amount, the token. Expected — deposits are
  public by design.

Now open your **private transfer**:

- ✅ **Not visible:** the amount, the recipient. You should see encrypted notes
  and nullifiers, and no readable figures.

That contrast *is* the product. Shielding is a public doorway; what happens
inside the pool is not.

Then open your **unshield** and compare the destination address with your
deposit address. Nothing on-chain connects them — that is the unlinkability
claim, and you can check it by eye.

---

## Step 9 — Deploy our contract (works regardless of Step 6)

This tests **layer 2** — `YieldHelper`, the code we actually wrote. It does not
depend on wallet privacy support.

### 9a. Build

```bash
cd "D:/Vibe coing apps/cellar/contracts"
scarb build
scarb cairo-test     # expect: 16 passed; 0 failed
```

Scarb lives at `D:\starknet-tools\scarb\...\bin` and is not on the global PATH.

### 9b. About the key — read this once

Deploying requires signing, and signing requires your private key. starkli
stores it **encrypted in a keystore file** behind a password, so the raw key
never sits in your shell history or in a config file.

Export the private key from your wallet (Ready: Settings → Account → Export
private key), then:

```bash
starkli signer keystore from-key ~/.starkli/cellar-sepolia.json
```

It prompts for the key and a password. **Use a throwaway testnet account for
this**, never an account holding real funds.

```bash
starkli account fetch <YOUR_SEPOLIA_ADDRESS> \
  --output ~/.starkli/account-sepolia.json \
  --rpc https://api.cartridge.gg/x/starknet/sepolia
```

### 9c. Deploy

Full commands are in [scripts/DEPLOY.md](../scripts/DEPLOY.md). In short: declare
the three classes, deploy `MockERC20`, deploy `MockVault` over it, then deploy
`YieldHelper` with the vault allowlisted.

`MockVault` exists because Vesu is not confirmed on Sepolia. Our helper only
calls `deposit`, `withdraw`, `balance_of` and `approve`, so it cannot tell a
mock from a real ERC-4626 vault.

### 9d. What to do with the addresses

Deployment prints a **class hash** (the code) and an **address** (the instance).
Put them in `config/networks.json` under `SN_SEPOLIA`:

```jsonc
"yieldHelper": {
  "classHash": "0x…",
  "address":   "0x…",
  "allowedVaults": ["0x…"]     // the MockVault address
},
"mocks": { "asset": "0x…", "vault": "0x…" }
```

Restart the dev server. **/vault** stops saying "not deployed" and lights up.

---

## Step 10 — Verify the security claims

These you can check without trusting us:

```bash
export RPC=https://api.cartridge.gg/x/starknet/sepolia

starkli call <HELPER> allowed_vault_count --rpc $RPC             # -> 1
starkli call <HELPER> allowed_vault_at 0  --rpc $RPC             # -> your vault
starkli call <HELPER> is_allowed_vault <YOUR_VAULT> --rpc $RPC   # -> 1
starkli call <HELPER> is_allowed_vault 0xbad --rpc $RPC          # -> 0
```

The last one is the important one. **A helper that accepts an arbitrary vault
is a helper that can send user funds anywhere.** Ours refuses.

Then check the claim about no admin key: open the contract on Voyager and look
at its functions. There is no `set_vault`, no `transfer_ownership`, no `owner`.
The allowlist is written once in the constructor and can never change — not by
us, not by anyone.

---

## Step 11 — Test selective disclosure

This works on any network and needs no deployment.

1. Go to **/prove**, connect, set a threshold, click **Sign statement**. Your
   wallet asks for a signature — no transaction, no gas.
2. Copy the link it produces.
3. Open it in a **private/incognito window** with no wallet installed.

**You should see:** the verifier says **Authentic**, names your account, and
states the claim. With no wallet — it checks the signature against the chain by
calling your account's own `is_valid_signature`.

Now test that it catches tampering: edit one character in the middle of the
link's `a=` parameter and reload.

**You should see:** **Not authentic**, in red.

That is the whole disclosure model working: a claim anyone can check, that
nobody can alter.

---

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| "no Starknet wallet detected" | Extension not installed, or the page loaded before it injected. Refresh. |
| "unsupported chain" | Wallet is on mainnet. Switch to Sepolia. |
| Stat tiles show `—` | RPC unreachable. Cartridge was the only Sepolia RPC that worked when tested; Lava, Blast, dRPC and Nethermind all failed. Verify a replacement by reading a block **and** the pool class hash. |
| `WalletAccountV6 is not a constructor` | `starknet` resolved below 10.4.0. Check `npm ls starknet`. |
| Faucet gives nothing | Rate limited per address per day. Try the other faucet. |
| Transaction stuck on "proving…" | ZK proof generation genuinely takes seconds. Give it 30s before assuming failure. |

---

## What "done" looks like

- [ ] Landing shows live Sepolia pool holdings and a moving chart
- [ ] Wallet connects and reports whether the STRK20 API is available
- [ ] Shield / transfer / unshield produce transaction hashes *(if supported)*
- [ ] Explorer confirms deposits are public and transfers are not
- [ ] `YieldHelper` deployed, and refuses a vault outside its allowlist
- [ ] An attestation verifies in a browser with no wallet, and fails when altered
