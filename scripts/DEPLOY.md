# Deploying YieldHelper

Starknet Foundry publishes no Windows binary, so `sncast` is unavailable here.
We use **starkli**, which does ship `starkli-x86_64-pc-windows-msvc.zip`.

## 0. Toolchain

```bash
# Scarb is already at D:\starknet-tools\scarb\...\bin (not on global PATH)
scarb build     # produces contracts/target/dev/*.contract_class.json
```

Install starkli from its GitHub releases and put it on PATH.

## 1. Account and keystore

Never paste a private key into a shell that logs history. Use a keystore file.

```bash
starkli signer keystore from-key ~/.starkli/strongbox.json
starkli account fetch <YOUR_ADDRESS> --output ~/.starkli/account.json --rpc https://rpc.starknet.lava.build
```

## 2. Sepolia first, against MockVault

Vesu may not be deployed on Sepolia. That is exactly why `MockVault` exists —
the helper only calls `deposit`, `withdraw`, `balance_of` and `approve`, so it
cannot tell the mock from the real thing.

```bash
# declare
starkli declare contracts/target/dev/strongbox_MockERC20.contract_class.json --rpc <SEPOLIA_RPC>
starkli declare contracts/target/dev/strongbox_MockVault.contract_class.json  --rpc <SEPOLIA_RPC>
starkli declare contracts/target/dev/strongbox_YieldHelper.contract_class.json --rpc <SEPOLIA_RPC>

# deploy the mock stack
starkli deploy <MOCK_ERC20_CLASS_HASH> --rpc <SEPOLIA_RPC>
starkli deploy <MOCK_VAULT_CLASS_HASH> <ASSET_ADDRESS> --rpc <SEPOLIA_RPC>

# YieldHelper takes Span<ContractAddress>: length first, then each vault
starkli deploy <YIELD_HELPER_CLASS_HASH> 1 <MOCK_VAULT_ADDRESS> --rpc <SEPOLIA_RPC>
```

Verify the round trip before going near mainnet:

```bash
starkli call <HELPER> allowed_vault_count --rpc <SEPOLIA_RPC>   # -> 1
starkli call <HELPER> allowed_vault_at 0  --rpc <SEPOLIA_RPC>   # -> the vault
starkli call <HELPER> is_allowed_vault <MOCK_VAULT> --rpc <SEPOLIA_RPC>  # -> 1
```

## 3. Mainnet, against a live Vesu vToken

Pick a vToken from <https://docs.vesu.xyz/developers/contract-addresses>,
choosing a market with real liquidity and a non-zero rate.

```bash
starkli declare contracts/target/dev/strongbox_YieldHelper.contract_class.json \
  --rpc https://rpc.starknet.lava.build

starkli deploy <CLASS_HASH> 1 <VESU_VTOKEN_ADDRESS> \
  --rpc https://rpc.starknet.lava.build
```

Do **not** deploy the mocks to mainnet.

## 4. Record it

Put the class hash and address into `config/mainnet.json` under `yieldHelper`,
and the contract address into `strk20.json` under `contracts`. The panel reads
`strk20.json` and nothing else.

## Constructor reminder

The vault allowlist is written once and has **no setter**. Getting the vault
address wrong means redeploying, not patching — which is the intended
trade-off: no admin key means no way to redirect user funds later.
