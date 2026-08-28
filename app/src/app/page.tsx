"use client";

// Landing.
//
// A judge lands here first, so it has one job: make the thesis legible in
// fifteen seconds, and prove the thing is real by showing live chain data
// rather than claiming it.

import Link from "next/link";
import { useEffect, useState } from "react";
import { CHAIN, HELPER, contractUrl, headBlock, poolHoldings } from "@/lib/strk20";
import { fromUnits } from "@/lib/actions";

type Holding = { symbol: string; address: string; decimals: number; balance: bigint };

export default function Landing() {
  const [holdings, setHoldings] = useState<Holding[] | null>(null);
  const [block, setBlock] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([poolHoldings(), headBlock()])
      .then(([h, b]) => {
        if (!alive) return;
        setHoldings(h);
        setBlock(b);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main>
      {/* ---------- thesis ---------- */}
      <section className="mx-auto max-w-5xl px-6 pb-16 pt-20 sm:pt-28">
        <div className="max-w-3xl animate-rise">
          <p className="label mb-6 flex items-center gap-2">
            <span className="dot animate-pulse-dot bg-brass" />
            Starknet mainnet · STRK20
          </p>

          <h1 className="display text-[clamp(2.6rem,7vw,4.6rem)] leading-[1.02] text-ash">
            Your balance should not be
            <br />
            <span className="italic text-brass">a public URL.</span>
          </h1>

          <p className="mt-8 max-w-xl text-[17px] leading-relaxed text-muted">
            Bitcoin was invented so value could move without surveillance.
            Seventeen years later, anyone can read your entire balance sheet,
            reconstruct your strategy, and watch where your money goes next.
          </p>

          <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-muted">
            Cellar shields an asset into the STRK20 privacy pool and routes it
            into a live lending market through a custom anonymizer contract.
            The yield is real. The position is not linkable to you.
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/vault" className="btn btn-primary">
              Open your position
            </Link>
            <Link href="/verify" className="btn btn-ghost">
              Verify an attestation
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- live chain data ---------- */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="panel-lit p-6 sm:p-8">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 className="display text-2xl text-ash">The anonymity set</h2>
              <p className="mt-1.5 max-w-lg text-[14px] leading-relaxed text-muted">
                What the pool holds right now, read live from mainnet. Public by
                design — the pool&rsquo;s edges are visible, and only who owns
                which share of it is not.
              </p>
            </div>
            <p className="num text-[11px] text-faint">
              {block ? `block ${block.toLocaleString()}` : failed ? "rpc unreachable" : "reading…"}
            </p>
          </div>

          <div className="grid gap-px overflow-hidden rounded-md border border-edge bg-edge sm:grid-cols-2 lg:grid-cols-4">
            {(holdings ?? Array.from({ length: 4 }, () => null)).map((h, i) => (
              <div key={h?.symbol ?? i} className="bg-surface p-5">
                <p className="label">{h?.symbol ?? "—"}</p>
                <p className="num mt-2 text-2xl text-ash">
                  {h
                    ? Number(fromUnits(h.balance, h.decimals)).toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })
                    : failed
                      ? "—"
                      : "···"}
                </p>
                <p className="mt-1 font-mono text-[10px] text-faint">shielded in pool</p>
              </div>
            ))}
          </div>

          <p className="mt-4 font-mono text-[11px] text-faint">
            pool{" "}
            <a
              href={contractUrl(CHAIN.pool)}
              target="_blank"
              rel="noreferrer"
              className="text-brass transition-colors hover:text-brass-lit"
            >
              {CHAIN.pool.slice(0, 10)}…{CHAIN.pool.slice(-6)} ↗
            </a>
          </p>
        </div>
      </section>

      {/* ---------- the honest claim ---------- */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="mb-8 max-w-2xl">
          <p className="label mb-3">The claim, precisely</p>
          <h2 className="display text-3xl leading-tight text-ash">
            Visible flow, invisible participant.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">
            Anything routed through an anonymizer reveals its amount and timing.
            Cellar gives you <span className="text-ash">identity</span> privacy,
            not amount privacy — and says so, because a privacy tool that
            overclaims is worse than one that ships late.
          </p>
        </div>

        <div className="grid gap-px overflow-hidden rounded-lg border border-edge bg-edge md:grid-cols-2">
          <div className="bg-surface p-6">
            <p className="label mb-4 text-moss">Hidden</p>
            <ul className="space-y-3 text-[14px] leading-relaxed text-muted">
              <li>
                <span className="text-ash">Who you are.</span> Nothing on-chain links
                an earn action to your wallet
              </li>
              <li>Your total shielded balance across all notes</li>
              <li>The link between your deposit and your withdrawal address</li>
              <li>Note amounts and ownership inside the pool</li>
              <li>
                Note-to-note transfers — <span className="text-ash">both</span> amounts
                and parties
              </li>
            </ul>
          </div>
          <div className="bg-surface p-6">
            <p className="label mb-4 text-steel">Visible</p>
            <ul className="space-y-3 text-[14px] leading-relaxed text-muted">
              <li>The amount and timing of each earn or withdraw</li>
              <li>Which vault was used, and that the pool paid the helper</li>
              <li>Depositor address and amount at the shield step</li>
              <li>Withdrawal recipient and amount</li>
              <li>Published nullifiers, unlinkable without a viewing key</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ---------- mechanism ---------- */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <p className="label mb-3">How one private deposit works</p>
        <h2 className="display mb-8 text-3xl text-ash">
          Five steps, one atomic transaction.
        </h2>

        <ol className="grid gap-px overflow-hidden rounded-lg border border-edge bg-edge">
          {[
            {
              n: "01",
              t: "The pool pays the helper",
              d: "A plain public transfer. Observers see the pool paid a contract — never who asked it to.",
            },
            {
              n: "02",
              t: "privacy_invoke",
              d: "The pool calls our anonymizer through the protocol's INVOKE_SELECTOR.",
            },
            {
              n: "03",
              t: "Into the vault",
              d: "The helper deposits into an allowlisted ERC-4626 market and measures what actually arrived.",
              ours: true,
            },
            {
              n: "04",
              t: "Approve, never transfer",
              d: "The helper approves the pool to pull the output. The pool does the pulling itself.",
              ours: true,
            },
            {
              n: "05",
              t: "Credited as an encrypted note",
              d: "The pool pulls the shares and credits them to a note only you can open.",
            },
          ].map((s) => (
            <li key={s.n} className="flex gap-5 bg-surface p-6">
              <span
                className={`num shrink-0 text-[12px] ${s.ours ? "text-brass" : "text-faint"}`}
              >
                {s.n}
              </span>
              <div>
                <p className="text-[15px] font-medium text-ash">
                  {s.t}
                  {s.ours && (
                    <span className="ml-2 font-mono text-[10px] uppercase tracking-label text-brass">
                      our contract
                    </span>
                  )}
                </p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-4 text-[13px] text-faint">
          If any step fails, all five revert. The helper never holds custody across
          blocks, never learns who you are, and never touches an encrypted note.
        </p>
      </section>

      {/* ---------- guarantees ---------- */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              t: "No owner, no admin key",
              d: "The vault allowlist is written once in the constructor and has no setter. Nobody — including us — can redirect funds after deployment.",
            },
            {
              t: "Measured, not reported",
              d: "Credit is the observed balance delta, never the vault's own return value. A misreporting vault cannot mint a note out of nothing.",
            },
            {
              t: "No events, no database",
              d: "The contract emits nothing and the app stores nothing server-side. Either would recreate the trace the pool exists to remove.",
            },
          ].map((c) => (
            <div key={c.t} className="panel p-6">
              <p className="text-[15px] font-medium text-ash">{c.t}</p>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{c.d}</p>
            </div>
          ))}
        </div>

        {!HELPER.address && (
          <p className="mt-6 rounded-md border border-edge bg-raised px-4 py-3 text-[13px] text-muted">
            <span className="text-brass">Status:</span> contracts written and tested,
            app live. The anonymizer is pending its mainnet deployment — see{" "}
            <a
              href="https://github.com/maheepatel/Cellar/blob/main/docs/PHASES.md"
              target="_blank"
              rel="noreferrer"
              className="text-brass underline underline-offset-2"
            >
              PHASES.md
            </a>
            .
          </p>
        )}
      </section>
    </main>
  );
}
