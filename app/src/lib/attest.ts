// SPDX-License-Identifier: Apache-2.0
//
// Selective disclosure — Phase 4.
//
// WHAT THIS IS, PRECISELY.
//
// A holder signs a narrow statement about their shielded position with the
// Starknet account that owns it. Anyone can then verify, against the chain,
// that *that account* authored *that exact statement*. Verification calls the
// account's own `is_valid_signature`, so it works for smart accounts, multisig
// and hardware wallets alike.
//
// What it proves:   this account authored this claim, at this block, and the
//                   claim has not been altered by a single character.
// What it does not: that the claim's contents are true.
//
// That second line matters and the UI states it plainly. A zero-knowledge
// proof of "balance >= X" over an encrypted note would need a circuit over the
// pool's commitment scheme — real work, and not something to fake with a
// signature. This is an attestation, the same instrument as a bank's proof-of-
// funds letter: its value comes from the signer being identifiable and
// accountable, not from the maths making lying impossible.
//
// It is still genuinely useful and genuinely selective. The holder reveals one
// threshold at one block instead of handing over a viewing key, which would
// expose their entire history — and the disclosure is bounded, expiring, and
// replay-resistant.

import { typedData as td, type TypedData, type WalletAccountV6 } from "starknet";
import { CHAIN, rpc } from "./strk20";

export type Claim = {
  /** The account making the statement. */
  account: string;
  /** ERC-20 the statement is about. */
  token: string;
  /** Threshold in the token's smallest unit. */
  threshold: string;
  /** Block the statement is anchored to. */
  block: string;
  /** Unix seconds. */
  issuedAt: string;
  expiresAt: string;
  /** Makes two otherwise identical claims distinguishable. */
  nonce: string;
};

export type Attestation = {
  claim: Claim;
  signature: string[];
};

const STATEMENT = "shielded balance >= threshold";

/**
 * SNIP-12 typed data. Structured and domain-separated, so a signature here
 * cannot be replayed as a transaction or lifted into another app.
 */
export function buildTypedData(claim: Claim): TypedData {
  return {
    types: {
      StarknetDomain: [
        { name: "name", type: "shortstring" },
        { name: "version", type: "shortstring" },
        { name: "chainId", type: "shortstring" },
        { name: "revision", type: "shortstring" },
      ],
      Attestation: [
        { name: "statement", type: "shortstring" },
        { name: "token", type: "ContractAddress" },
        { name: "threshold", type: "u128" },
        { name: "block", type: "u128" },
        { name: "issuedAt", type: "u128" },
        { name: "expiresAt", type: "u128" },
        { name: "nonce", type: "felt" },
      ],
    },
    primaryType: "Attestation",
    domain: {
      name: "Cellar",
      version: "1",
      chainId: CHAIN.id,
      revision: "1",
    },
    message: {
      statement: STATEMENT,
      token: claim.token,
      threshold: claim.threshold,
      block: claim.block,
      issuedAt: claim.issuedAt,
      expiresAt: claim.expiresAt,
      nonce: claim.nonce,
    },
  };
}

/** The hash the account actually signs. Shown in the UI so it can be compared. */
export function claimHash(claim: Claim): string {
  return td.getMessageHash(buildTypedData(claim), claim.account);
}

/**
 * Issue an attestation. Signing is a wallet operation with no transaction and
 * no gas — nothing about this touches the chain until someone verifies it.
 */
export async function issue(
  account: WalletAccountV6,
  params: { token: string; threshold: bigint; validForSeconds: number },
): Promise<Attestation> {
  const block = await rpc().getBlockNumber();
  const now = Math.floor(Date.now() / 1000);

  const claim: Claim = {
    account: account.address,
    token: params.token,
    threshold: params.threshold.toString(),
    block: String(block),
    issuedAt: String(now),
    expiresAt: String(now + params.validForSeconds),
    nonce: `0x${crypto.getRandomValues(new Uint32Array(4)).reduce((a, n) => a + n.toString(16).padStart(8, "0"), "")}`,
  };

  const sig = await account.signMessage(buildTypedData(claim));
  const signature = Array.isArray(sig) ? sig.map(String) : Object.values(sig).map(String);

  return { claim, signature };
}

export type VerifyResult = {
  /** Did this account really sign this exact claim? Checked on-chain. */
  authentic: boolean;
  /** Has the stated validity window passed? */
  expired: boolean;
  /** Anchor block vs current head. */
  block: string;
  currentBlock: number;
  hash: string;
  error?: string;
};

/**
 * Verify against the chain.
 *
 * `verifyMessageInStarknet` calls the account's own `is_valid_signature`, so
 * this works for any account type — including smart accounts whose signature
 * scheme is not a plain ECDSA check.
 */
export async function verify(att: Attestation): Promise<VerifyResult> {
  const hash = claimHash(att.claim);
  const currentBlock = await rpc().getBlockNumber();
  const expired = Number(att.claim.expiresAt) * 1000 < Date.now();

  try {
    const authentic = await rpc().verifyMessageInStarknet(
      buildTypedData(att.claim),
      att.signature,
      att.claim.account,
    );
    return { authentic, expired, block: att.claim.block, currentBlock, hash };
  } catch (e) {
    return {
      authentic: false,
      expired,
      block: att.claim.block,
      currentBlock,
      hash,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** URL-safe encoding, so an attestation fits in a link. */
export function encode(att: Attestation): string {
  const json = JSON.stringify(att);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decode(encoded: string): Attestation {
  const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Attestation;
  if (!parsed?.claim?.account || !Array.isArray(parsed.signature)) {
    throw new Error("Not a Cellar attestation");
  }
  return parsed;
}
