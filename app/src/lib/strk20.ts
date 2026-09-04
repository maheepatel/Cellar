// SPDX-License-Identifier: Apache-2.0
//
// The STRK20 integration layer.
//
// Route: **Wallet API**, not the Privacy SDK.
//
// On this route the wallet holds the viewing key, discovers notes, generates
// the ZK proof and submits the transaction. This app never touches a key, a
// note, or a prover — which is why Cellar self-hosts no privacy infrastructure,
// and why none of the SDK's client-side traps (BigInt viewing keys, proving
// against block-10, empty proofFacts) apply to us.
//
// Network: Sepolia by default, because it costs nothing and the faucet is
// open. If a connected wallet reports mainnet, everything follows it there —
// the pool, tokens, RPC and explorer all come from one config per chain, so
// there is no way to read a mainnet address while talking to a testnet node.

import { RpcProvider, WalletAccountV6 } from "starknet";
import type { STRK20_ACTION, STRK20_CALL_AND_PROOF } from "starknet";
import networks from "../../../config/networks.json";

export type TokenInfo = { address: string; decimals: number };

export type Network = {
  name: string;
  short: string;
  testnet: boolean;
  chainId: string;
  chainIdHex: string;
  rpcUrl: string;
  poolAddress: string;
  explorer: string;
  faucets: string[];
  tokens: Record<string, TokenInfo>;
  yieldHelper: { classHash: string; address: string; allowedVaults: string[] };
  mocks: { asset: string; vault: string };
};

const RAW = networks as unknown as Record<string, Network> & { _default: string };

export const NETWORKS: Record<string, Network> = {
  SN_SEPOLIA: RAW.SN_SEPOLIA,
  SN_MAIN: RAW.SN_MAIN,
};

export const DEFAULT_NETWORK = RAW._default ?? "SN_SEPOLIA";

/**
 * The chain the app is currently pointed at.
 *
 * Module-level rather than React state because non-component code (the action
 * builders, the attestation verifier) needs it too. `connect()` sets it from
 * whatever the wallet reports, so the UI can never be showing one chain's
 * addresses while signing on another.
 */
let active: Network = NETWORKS[DEFAULT_NETWORK];

export function network(): Network {
  return active;
}

export function setNetwork(chainIdHex: string): Network | null {
  const found = Object.values(NETWORKS).find(
    (n) => n.chainIdHex.toLowerCase() === chainIdHex.toLowerCase(),
  );
  if (found) active = found;
  return found ?? null;
}

/** True while pointed at a testnet — the UI badges this prominently. */
export function isTestnet(): boolean {
  return active.testnet;
}

export function tokens(): Record<string, TokenInfo> {
  return active.tokens;
}

export function helper() {
  return active.yieldHelper;
}

/** Scopes shadow accounts to this app. Max 31 ASCII chars. */
export const DAPP_NAME = "cellar";

/** Mirrors LendingOperation in contracts/src/yield_helper.cairo. */
export enum LendingOperation {
  Deposit = 0,
  Withdraw = 1,
}

export function rpc(net: Network = active): RpcProvider {
  return new RpcProvider({ nodeUrl: net.rpcUrl });
}

/**
 * Cairo serialises a u256 as two felts, low limb first. An amount crossing the
 * ABI boundary must be split or the call reverts on calldata length.
 */
export function u256Parts(value: bigint): [string, string] {
  const MASK = (1n << 128n) - 1n;
  return [`0x${(value & MASK).toString(16)}`, `0x${(value >> 128n).toString(16)}`];
}

/**
 * Build the two actions that make up one private earn or withdraw.
 *
 * A `transfer` carrying the literal amount "OPEN" reserves an *open note* — a
 * placeholder the pool credits once our helper reports how much actually
 * arrived. The `invoke` then names YieldHelper and hands it that note's id via
 * the ${openNoteIds[0]} placeholder, which the wallet substitutes at build
 * time. Both land in one atomic transaction.
 *
 * Calldata order must match `privacy_invoke`:
 *   (operation, in_token, out_token, assets: u256, note_id)
 * — note `assets` occupies two felts.
 */
export function buildYieldActions(params: {
  operation: LendingOperation;
  inToken: string;
  outToken: string;
  amount: bigint;
  helper: string;
  recipient: string;
}): STRK20_ACTION[] {
  const { operation, inToken, outToken, amount, helper: h, recipient } = params;
  const [lo, hi] = u256Parts(amount);

  return [
    { type: "transfer", token: outToken, amount: "OPEN", recipient },
    {
      type: "invoke",
      contract: h,
      calldata: [`0x${operation.toString(16)}`, inToken, outToken, lo, hi, "${openNoteIds[0]}"],
    },
  ];
}

/** Submit a private action set. The wallet proves and signs; we only wait. */
export async function submit(
  account: WalletAccountV6,
  actions: STRK20_ACTION[],
): Promise<string> {
  const { transaction_hash } = await account.strk20InvokeTransaction(actions);
  await rpc().waitForTransaction(transaction_hash);
  return transaction_hash;
}

/** Dry run: builds and proves without submitting. */
export async function prepare(
  account: WalletAccountV6,
  actions: STRK20_ACTION[],
): Promise<STRK20_CALL_AND_PROOF> {
  return account.strk20PrepareInvoke(actions, true);
}

/** Shielded balances for the given token addresses. */
export async function shieldedBalances(account: WalletAccountV6, list: string[]) {
  return account.strk20Balances(list as never);
}

/**
 * A shadow-account commitment — STRK20's stealth-account primitive.
 *
 * Deriving a per-dapp shadow account lets a withdrawal land somewhere with no
 * on-chain link to the depositing wallet.
 */
export async function shadowAccount(
  account: WalletAccountV6,
  dappName: string = DAPP_NAME,
  nonce = "0x0",
): Promise<string> {
  return account.strk20ShadowAccountCommitment(dappName as never, nonce as never);
}

/**
 * How much of each token the privacy pool currently holds.
 *
 * A plain `balance_of` against the pool — fully public information, and
 * deliberately so. The pool's edges are visible by design; what is hidden is
 * who owns which share. Needs no wallet and no viewing key, which is the
 * point: the anonymity set is something anyone can audit.
 */
export async function poolHoldings(
  net: Network = active,
): Promise<{ symbol: string; address: string; decimals: number; balance: bigint }[]> {
  const p = rpc(net);
  return Promise.all(
    Object.entries(net.tokens).map(async ([symbol, t]) => {
      try {
        const res = await p.callContract({
          contractAddress: t.address,
          entrypoint: "balance_of",
          calldata: [net.poolAddress],
        });
        return {
          symbol,
          address: t.address,
          decimals: t.decimals,
          balance: BigInt(res[0]) + (BigInt(res[1] ?? "0x0") << 128n),
        };
      } catch {
        return { symbol, address: t.address, decimals: t.decimals, balance: 0n };
      }
    }),
  );
}

/** Current head block — cheap liveness signal for the UI. */
export async function headBlock(net: Network = active): Promise<number> {
  return rpc(net).getBlockNumber();
}

export function txUrl(hash: string, net: Network = active): string {
  return `${net.explorer}/tx/${hash}`;
}

export function contractUrl(addr: string, net: Network = active): string {
  return `${net.explorer}/contract/${addr}`;
}
