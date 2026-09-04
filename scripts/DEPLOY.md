# Deploying YieldHelper

**Start on Sepolia.** It costs nothing, the faucet is open, and the STRK20
privacy pool is genuinely deployed there — verified on-chain at
`0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91`
(class hash `0x7e2bbd7ccc1e68b2…`). The Sepolia pool is live and in use:
about 227k STRK and 100 ETH shielded as of 4 September 2026.

Starknet Foundry publishes no Windows binary, so `sncast` is unavailable here.
We use **starkli**, which does ship `starkli-x86_64-pc-windows-msvc.zip`.

## 0. Toolchain

```bash
scarb build     # -> contracts/target/dev/*.contract_class.json
```

Scarb lives at `D:\starknet-tools\scarb\...\bin` and is not on the global PATH.
starkli 0.4.2 is at `D:\starknet-tools\starkli\starkli.exe`.

## 1. Get testnet funds

Faucet: <https://starknet-faucet.vercel.app> — free Sepolia STRK, no cost, no
mainnet risk. You need a small amount for fees and a little more to shield.

## 2. Account and keystore

Never paste a private key into a shell that records history. Use a keystore.

```bash
starkli signer keystore from-key ~/.starkli/cellar-sepolia.json
starkli account fetch <YOUR_SEPOLIA_ADDRESS> \
  --output ~/.starkli/account-sepolia.json \
  --rpc https://api.cartridge.gg/x/starknet/sepolia
```

> Lava, Blast, dRPC and Nethermind all failed for Sepolia when tested on
> 4 September 2026. Cartridge answered. If it stops working, verify a
> replacement by reading a block *and* the pool's class hash before trusting it.

## 3. Deploy the mock stack

Vesu is not confirmed on Sepolia, which is exactly why `MockVault` exists. The
helper only ever calls `deposit`, `withdraw`, `balance_of` and `approve`, so it
cannot tell a mock from the real thing.

```bash
export RPC=https://api.cartridge.gg/x/starknet/sepolia
export ACC=~/.starkli/account-sepolia.json
export KEY=~/.starkli/cellar-sepolia.json

# declare
starkli declare contracts/target/dev/cellar_MockERC20.contract_class.json   --rpc $RPC --account $ACC --keystore $KEY
starkli declare contracts/target/dev/cellar_MockVault.contract_class.json   --rpc $RPC --account $ACC --keystore $KEY
starkli declare contracts/target/dev/cellar_YieldHelper.contract_class.json --rpc $RPC --account $ACC --keystore $KEY

# deploy the underlying asset, then a vault over it
starkli deploy <MOCK_ERC20_CLASS_HASH> --rpc $RPC --account $ACC --keystore $KEY
starkli deploy <MOCK_VAULT_CLASS_HASH> <ASSET_ADDRESS> --rpc $RPC --account $ACC --keystore $KEY

# YieldHelper takes Span<ContractAddress>: length first, then each vault
starkli deploy <YIELD_HELPER_CLASS_HASH> 1 <MOCK_VAULT_ADDRESS> --rpc $RPC --account $ACC --keystore $KEY
```

## 4. Verify before trusting it

```bash
starkli call <HELPER> allowed_vault_count --rpc $RPC              # -> 1
starkli call <HELPER> allowed_vault_at 0  --rpc $RPC              # -> the vault
starkli call <HELPER> is_allowed_vault <MOCK_VAULT> --rpc $RPC    # -> 1
starkli call <HELPER> is_allowed_vault 0xbad --rpc $RPC           # -> 0
```

The last one matters most: a helper that accepts an arbitrary vault is a helper
that can send user funds anywhere.

## 5. Record it

Put the addresses into `config/networks.json` under `SN_SEPOLIA`:

```jsonc
"yieldHelper": {
  "classHash": "0x…",
  "address":   "0x…",
  "allowedVaults": ["0x…"]      // the MockVault
},
"mocks": { "asset": "0x…", "vault": "0x…" }
```

The app reads this and the `/vault` screen stops saying "not deployed".

## 6. Mainnet, later

Same commands with `--rpc https://rpc.starknet.lava.build`, and the vault
argument becomes a **real** ERC-4626 vToken rather than the mock. Do not deploy
the mocks to mainnet.

Open question, still unresolved: Vesu V2 vToken addresses are not in the
published contract-addresses page, and the pool's `AssetConfig` struct has no
vToken field — V2 externalises them into standalone vaults.
`app/scripts/probe-vesu.mjs` dumps any contract's ABI and struct layouts to help
track one down.

## Constructor reminder

The vault allowlist is written once and has **no setter**. Getting the address
wrong means redeploying, not patching — which is the intended trade-off: no
admin key means nobody can redirect user funds later, including us.
