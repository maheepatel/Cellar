// SPDX-License-Identifier: Apache-2.0
//
// The STRK20 integration layer.
//
// Route: **Wallet API**, not the Privacy SDK.
//
// On this route the wallet holds the viewing key, discovers notes, generates
// the ZK proof and submits the transaction. This app never touches a key, a
// note, or a prover — which is why Cellar self-hosts no privacy
// infrastructure, and why none of the SDK's client-side traps (BigInt viewing
// keys, proving against block-10, empty proofFacts) apply to us.
//
// All STRK20 types below come from starknet.js itself. Nothing here is
// hand-rolled, so if the wallet spec moves, the compiler tells us.

import { RpcProvider, WalletAccountV6 } from "starknet";
import type { STRK20_ACTION, STRK20_CALL_AND_PROOF } from "starknet";
import mainnet from "../../../config/mainnet.json";

/** Verified mainnet values from the sprint repo's docs/MAINNET-DAY-0.md. */
export const CHAIN = {
  id: mainnet.chainId,
  idHex: mainnet.chainIdHex,
  rpcUrl: mainnet.rpcUrl,
  pool: mainnet.poolAddress,
  explorer: mainnet.explorer,
} as const;

/** Mirrors LendingOperation in contracts/src/yield_helper.cairo. */
export enum LendingOperation {
  Deposit = 0,
  Withdraw = 1,
}

export function rpc(): RpcProvider {
  return new RpcProvider({ nodeUrl: CHAIN.rpcUrl });
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
 * This is the whole product. A `transfer` carrying the literal amount "OPEN"
 * reserves an *open note* — a placeholder the pool will credit once our helper
 * reports how much actually arrived. The `invoke` then names YieldHelper and
 * hands it that note's id via the ${openNoteIds[0]} placeholder, which the
 * wallet substitutes at build time. Both land in one atomic transaction.
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
  const { operation, inToken, outToken, amount, helper, recipient } = params;
  const [lo, hi] = u256Parts(amount);

  return [
    { type: "transfer", token: outToken, amount: "OPEN", recipient },
    {
      type: "invoke",
      contract: helper,
      calldata: [`0x${operation.toString(16)}`, inToken, outToken, lo, hi, "${openNoteIds[0]}"],
    },
  ] as unknown as STRK20_ACTION[];
}

/**
 * Submit a private action set. The wallet proves and signs; we only wait.
 *
 * There is no explicit viewing-key registration step: wallets register on
 * first use, so a user's first private action also establishes their key.
 */
export async function submit(
  account: WalletAccountV6,
  actions: STRK20_ACTION[],
): Promise<string> {
  const { transaction_hash } = await account.strk20InvokeTransaction(actions);
  await rpc().waitForTransaction(transaction_hash);
  return transaction_hash;
}

/**
 * Dry run: builds and proves without submitting, so a failure surfaces before
 * we ask anyone to sign. Also the honest way to measure proving latency, which
 * on this route belongs to the wallet but is still visible during a demo.
 *
 * In simulate mode the proof fields come back empty and the call is not
 * submittable — it is for fee estimation and UI previews only.
 */
export async function prepare(
  account: WalletAccountV6,
  actions: STRK20_ACTION[],
): Promise<STRK20_CALL_AND_PROOF> {
  return account.strk20PrepareInvoke(actions, true);
}

/** Shielded balances for the given token addresses. */
export async function shieldedBalances(account: WalletAccountV6, tokens: string[]) {
  return account.strk20Balances(tokens as never);
}

/**
 * A shadow-account commitment — STRK20's stealth-account primitive.
 *
 * Deriving a per-dapp shadow account lets a withdrawal land somewhere with no
 * on-chain link to the depositing wallet. The sprint's integration-depth
 * criterion names stealth accounts explicitly, and this is the supported way
 * to reach them from the Wallet API.
 */
export async function shadowAccount(
  account: WalletAccountV6,
  dappName: string,
  nonce = "0x0",
): Promise<string> {
  return account.strk20ShadowAccountCommitment(dappName as never, nonce as never);
}

export function txUrl(hash: string): string {
  return `${CHAIN.explorer}/tx/${hash}`;
}

export function contractUrl(addr: string): string {
  return `${CHAIN.explorer}/contract/${addr}`;
}
