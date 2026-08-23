"use client";

// Day 0 console.
//
// The sprint scores nothing without three verified mainnet transaction hashes
// in strk20.json. This screen exists to produce them, and to copy them out in
// the exact shape that file wants. It is deliberately plain — the product
// dashboard comes later; this is the qualifying gate.

import { useCallback, useEffect, useState } from "react";
import { CHAIN, txUrl } from "@/lib/strk20";
import { connect, discover, short, type Connection, type DiscoveredWallet } from "@/lib/wallet";

type Step = { id: string; title: string; detail: string; hash?: string };

const STEPS: Step[] = [
  {
    id: "viewing-key",
    title: "Register viewing key",
    detail:
      "One-time on-chain registration publishing your public viewing key. Uses standard signMessage — needs no STRK20 wallet support, so this one works first.",
  },
  {
    id: "shield",
    title: "Shield tokens",
    detail:
      "Deposit an ERC-20 into the pool and receive an encrypted note. Screened by a compliance provider; depositor address and amount stay public.",
  },
  {
    id: "transfer",
    title: "Private transfer",
    detail:
      "A note-to-note transfer. Only encrypted notes and nullifiers are emitted — no amounts, no parties. This is the fully private one.",
  },
];

export default function Page() {
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);
  const [conn, setConn] = useState<Connection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hashes, setHashes] = useState<Record<string, string>>({});

  useEffect(() => {
    // Wallets inject asynchronously; one retry catches the common race where
    // the page mounts before the extension has written to window.
    setWallets(discover());
    const t = setTimeout(() => setWallets(discover()), 600);
    return () => clearTimeout(t);
  }, []);

  const onConnect = useCallback(async (w: DiscoveredWallet) => {
    setBusy(true);
    setError(null);
    try {
      setConn(await connect(w));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const recorded = STEPS.filter((s) => hashes[s.id]).length;

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <header className="mb-10">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
          Cellar · Day 0
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          Three mainnet transactions
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
          Nothing is scored without these. Produce them here, then paste the hashes
          into <code className="text-brass">strk20.json</code> at the repo root.
        </p>
      </header>

      {/* Connection */}
      <section className="panel mb-8 p-5">
        <h2 className="mb-1 text-sm font-semibold">Wallet</h2>
        <p className="mb-4 text-[13px] text-muted">
          STRK20 privacy is mainnet only. Ready is the wallet named by every official
          source; support is checked at runtime rather than assumed.
        </p>

        {!conn && (
          <div className="flex flex-wrap gap-2">
            {wallets.length === 0 && (
              <p className="text-[13px] text-muted">
                No Starknet wallet detected in this browser.
              </p>
            )}
            {wallets.map((w) => (
              <button
                key={w.id}
                onClick={() => onConnect(w)}
                disabled={busy}
                className="btn btn-ghost"
              >
                {w.name}
              </button>
            ))}
          </div>
        )}

        {conn && (
          <dl className="grid gap-2 font-mono text-[13px]">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">address</dt>
              <dd>{short(conn.address)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">network</dt>
              <dd>{conn.chainId === CHAIN.idHex ? "SN_MAIN" : conn.chainId}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">STRK20 Wallet API</dt>
              <dd className={conn.strk20 ? "text-moss" : "text-rust"}>
                {conn.strk20 ? "supported" : "NOT supported by this wallet"}
              </dd>
            </div>
          </dl>
        )}

        {error && (
          <p className="mt-4 rounded border border-rust/40 bg-rust/10 p-3 text-[13px] text-rust">
            {error}
          </p>
        )}
      </section>

      {/* Steps */}
      <section className="mb-8 space-y-3">
        {STEPS.map((s, i) => {
          const hash = hashes[s.id];
          return (
            <article key={s.id} className="panel p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-[15px] font-semibold">
                    <span className="mr-2 font-mono text-xs text-brass">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {s.title}
                  </h3>
                  <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-muted">
                    {s.detail}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${
                    hash ? "bg-moss/15 text-moss" : "bg-edge text-muted"
                  }`}
                >
                  {hash ? "recorded" : "pending"}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <input
                  value={hash ?? ""}
                  onChange={(e) =>
                    setHashes((h) => ({ ...h, [s.id]: e.target.value.trim() }))
                  }
                  placeholder="0x… paste the transaction hash"
                  spellCheck={false}
                  className="min-w-0 flex-1 rounded border border-edge bg-ink px-3 py-2 font-mono text-[12px] outline-none focus:border-brass"
                />
                {hash && (
                  <a
                    href={txUrl(hash)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-ghost"
                  >
                    Voyager ↗
                  </a>
                )}
              </div>
            </article>
          );
        })}
      </section>

      {/* Output */}
      <section className="panel p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">strk20.json</h2>
          <span className="font-mono text-[11px] text-muted">{recorded} / 3</span>
        </div>
        <pre className="overflow-x-auto rounded bg-ink p-4 font-mono text-[12px] leading-relaxed">
{JSON.stringify(
  {
    transactions: STEPS.map((s) => hashes[s.id]).filter(Boolean),
    contracts: [],
    demo_video: "",
    demo_url: "",
  },
  null,
  2,
)}
        </pre>
        <p className="mt-3 text-[12px] text-muted">
          Pool{" "}
          <a
            className="text-brass underline"
            href={`${CHAIN.explorer}/contract/${CHAIN.pool}`}
            target="_blank"
            rel="noreferrer"
          >
            {short(CHAIN.pool)}
          </a>{" "}
          · RPC {CHAIN.rpcUrl}
        </p>
      </section>
    </main>
  );
}
