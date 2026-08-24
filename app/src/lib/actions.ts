// SPDX-License-Identifier: Apache-2.0
//
// The five operations Cellar can perform, each one STRK20 transaction.
//
// Action shapes here are the canonical ones from
// @starknet-io/starknet-types-0104, not hand-rolled:
//
//   deposit   { type, token, amount }                       — always to self
//   withdraw  { type, token, amount, recipient }
//   transfer  { type, token, amount | "OPEN", recipient }
//   invoke    { type, contract, calldata }
//
// There is no explicit viewing-key registration step. Wallets register on
// first use, so whichever private action a user takes first also establishes
// their key. That is why `shield` is the natural opener.

import type { STRK20_ACTION, WalletAccountV6 } from "starknet";
import { LendingOperation, buildYieldActions, rpc } from "./strk20";

/** Submit a set of actions and wait for it to land. Returns the tx hash. */
async function send(account: WalletAccountV6, actions: STRK20_ACTION[]): Promise<string> {
  const { transaction_hash } = await account.strk20InvokeTransaction(actions);
  await rpc().waitForTransaction(transaction_hash);
  return transaction_hash;
}

/** Convert a human amount ("1.5") into the token's smallest unit. */
export function toUnits(amount: string, decimals: number): bigint {
  const trimmed = amount.trim();
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === "" || trimmed === ".") {
    throw new Error(`"${amount}" is not a number`);
  }
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > decimals) {
    throw new Error(`${frac.length} decimal places, but this token has ${decimals}`);
  }
  return BigInt((whole || "0") + frac.padEnd(decimals, "0"));
}

/** Format a smallest-unit amount for display. */
export function fromUnits(value: bigint, decimals: number, precision = 6): string {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const frac = (value % base).toString().padStart(decimals, "0").slice(0, precision);
  return frac.replace(/0+$/, "") ? `${whole}.${frac.replace(/0+$/, "")}` : `${whole}`;
}

/**
 * 1 — Shield. Move public tokens into the pool as an encrypted note.
 *
 * The depositor address and the amount are public by design, and the deposit
 * is screened by a compliance provider whose signature the pool verifies
 * on-chain. Privacy begins once the funds are inside.
 */
export function shield(account: WalletAccountV6, token: string, amount: bigint) {
  return send(account, [{ type: "deposit", token, amount: `0x${amount.toString(16)}` }]);
}

/**
 * 2 — Private transfer. Note to note, inside the pool.
 *
 * The fully private operation: only encrypted notes and nullifiers are
 * emitted. No amounts, no parties. Sending to your own address is a valid
 * way to exercise it.
 */
export function privateTransfer(
  account: WalletAccountV6,
  token: string,
  amount: bigint,
  recipient: string,
) {
  return send(account, [
    { type: "transfer", token, amount: `0x${amount.toString(16)}`, recipient },
  ]);
}

/**
 * 3 — Unshield. Exit the pool to a public address.
 *
 * Send to a *fresh* address, not the one that deposited. Withdrawing to the
 * depositing wallet re-links the two ends and undoes the point of the pool.
 */
export function unshield(
  account: WalletAccountV6,
  token: string,
  amount: bigint,
  recipient: string,
) {
  return send(account, [
    { type: "withdraw", token, amount: `0x${amount.toString(16)}`, recipient },
  ]);
}

/**
 * 4 — Earn. Route shielded capital into an allowlisted ERC-4626 vault.
 *
 * Two actions, one transaction: a transfer with amount "OPEN" reserves a note
 * for whatever comes back, then an invoke asks the pool to run YieldHelper
 * against it. The pool credits the measured output to that note.
 */
export function earn(
  account: WalletAccountV6,
  params: { helper: string; underlying: string; vault: string; amount: bigint; self: string },
) {
  return send(
    account,
    buildYieldActions({
      operation: LendingOperation.Deposit,
      inToken: params.underlying,
      outToken: params.vault,
      amount: params.amount,
      helper: params.helper,
      recipient: params.self,
    }),
  );
}

/**
 * 5 — Exit the position. Burn vault shares back into the underlying.
 *
 * Same shape as `earn`, with the tokens swapped: shares in, underlying out,
 * so the vault is now `in_token`.
 */
export function exitYield(
  account: WalletAccountV6,
  params: { helper: string; underlying: string; vault: string; amount: bigint; self: string },
) {
  return send(
    account,
    buildYieldActions({
      operation: LendingOperation.Withdraw,
      inToken: params.vault,
      outToken: params.underlying,
      amount: params.amount,
      helper: params.helper,
      recipient: params.self,
    }),
  );
}
