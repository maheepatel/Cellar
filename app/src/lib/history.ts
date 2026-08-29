// SPDX-License-Identifier: Apache-2.0
//
// The anonymity set over time.
//
// Every point is a real `balance_of` against the privacy pool at a historical
// block. Nothing is interpolated, smoothed or modelled — if the line moves,
// the pool moved.
//
// This is public information by design. The pool's edges are visible; only who
// owns which share of it is not. That the set is auditable by anyone, with no
// wallet and no viewing key, is the point rather than a leak.

import { CHAIN, TOKENS, rpc } from "./strk20";

export type Point = { block: number; value: bigint };
export type Series = {
  symbol: string;
  decimals: number;
  points: Point[];
  /** Unix seconds for the first and last sample, read from those blocks. */
  startedAt: number | null;
  endedAt: number | null;
};

/** Run promises with a concurrency cap so a public RPC is not hammered. */
async function pooled<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

async function balanceAt(token: string, block: number): Promise<bigint> {
  const res = await rpc().callContract(
    { contractAddress: token, entrypoint: "balance_of", calldata: [CHAIN.pool] },
    block,
  );
  return BigInt(res[0]) + (BigInt(res[1] ?? "0x0") << 128n);
}

async function blockTime(block: number): Promise<number | null> {
  try {
    const b = (await rpc().getBlockWithTxHashes(block)) as { timestamp?: number };
    return typeof b.timestamp === "number" ? b.timestamp : null;
  } catch {
    return null;
  }
}

/**
 * Sample one token's pool balance backwards from the head.
 *
 * Defaults span roughly the last million blocks at 16 points — enough to show
 * the shape without turning a landing page into a batch job.
 */
export async function poolSeries(
  symbol = "STRK",
  opts: { points?: number; span?: number } = {},
): Promise<Series> {
  const token = TOKENS[symbol];
  if (!token) throw new Error(`unknown token ${symbol}`);

  const points = opts.points ?? 16;
  const span = opts.span ?? 1_000_000;

  const head = await rpc().getBlockNumber();
  const step = Math.floor(span / (points - 1));
  const blocks = Array.from({ length: points }, (_, i) => head - span + i * step).filter(
    (b) => b > 0,
  );

  const values = await pooled(blocks, 4, (b) => balanceAt(token.address, b));
  const [startedAt, endedAt] = await Promise.all([
    blockTime(blocks[0]),
    blockTime(blocks[blocks.length - 1]),
  ]);

  return {
    symbol,
    decimals: token.decimals,
    points: blocks.map((block, i) => ({ block, value: values[i] })),
    startedAt,
    endedAt,
  };
}

/** Smallest-unit bigint to a plain number, for plotting only. */
export function toFloat(v: bigint, decimals: number): number {
  return Number(v) / 10 ** decimals;
}
