"use client";

// Day 0 console.
//
// The sprint scores nothing without three verified mainnet transaction hashes
// in strk20.json. This screen produces them, records them automatically, and
// emits that file's exact shape.
//
// Deliberately plain. The product dashboard is Phase 3; this is the gate.

import { useCallback, useEffect, useMemo, useState } from "react";
import { network, tokens, txUrl } from "@/lib/strk20";
import { fromUnits, privateTransfer, shield, toUnits, unshield } from "@/lib/actions";
import { connect, discover, short, type Connection, type DiscoveredWallet } from "@/lib/wallet";

type OpId = "shield" | "transfer" | "unshield";

type Op = {
  id: OpId;
  title: string;
  detail: string;
  /** Needs a destination address. */
  recipient?: "self" | "fresh";
};

const OPS: Op[] = [
  {
    id: "shield",
    title: "Shield",
    detail:
      "Move public tokens into the pool as an encrypted note. Your address and the amount are public by design, and the deposit is screened on-chain. Privacy begins once funds are inside. This first action also registers your viewing key.",
  },
  {
    id: "transfer",
    title: "Private transfer",
    detail:
      "Note to note, inside the pool. Only encrypted notes and nullifiers are emitted — no amounts, no parties. Sending to your own address is a valid way to exercise it.",
    recipient: "self",
  },
  {
    id: "unshield",
    title: "Unshield",
    detail:
      "Exit to a public address. Use a fresh one — withdrawing to the wallet that deposited re-links both ends and undoes the point of the pool.",
    recipient: "fresh",
  },
];

type OpState = { status: "idle" | "running" | "done" | "error"; hash?: string; error?: string };

export default function Page() {
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);
  const [conn, setConn] = useState<Connection | null>(null);
  const [connError, setConnError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const [symbol, setSymbol] = useState("USDC");
  const [amount, setAmount] = useState("0.5");
  const [recipient, setRecipient] = useState("");
  const [state, setState] = useState<Record<OpId, OpState>>({
    shield: { status: "idle" },
    transfer: { status: "idle" },
    unshield: { status: "idle" },
  });

  const TOKENS = tokens();
  const CHAIN = network();
  const token = TOKENS[symbol];

  useEffect(() => {
    // Wallets inject asynchronously; one retry catches the mount race.
    setWallets(discover());
    const t = setTimeout(() => setWallets(discover()), 600);
    return () => clearTimeout(t);
  }, []);

  const onConnect = useCallback(async (w: DiscoveredWallet) => {
    setConnecting(true);
    setConnError(null);
    try {
      setConn(await connect(w));
    } catch (e) {
      setConnError(e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(false);
    }
  }, []);

  const run = useCallback(
    async (op: Op) => {
      if (!conn || !token) return;
      setState((s) => ({ ...s, [op.id]: { status: "running" } }));
      try {
        const units = toUnits(amount, token.decimals);
        if (units === 0n) throw new Error("Amount must be greater than zero");

        const to = op.recipient === "self" ? conn.address : recipient.trim();
        if (op.recipient && !to) throw new Error("Enter a destination address");

        let hash: string;
        if (op.id === "shield") hash = await shield(conn.account, token.address, units);
        else if (op.id === "transfer")
          hash = await privateTransfer(conn.account, token.address, units, to);
        else hash = await unshield(conn.account, token.address, units, to);

        setState((s) => ({ ...s, [op.id]: { status: "done", hash } }));
      } catch (e) {
        setState((s) => ({
          ...s,
          [op.id]: { status: "error", error: e instanceof Error ? e.message : String(e) },
        }));
      }
    },
    [conn, token, amount, recipient],
  );

  const hashes = useMemo(
    () => OPS.map((o) => state[o.id].hash).filter((h): h is string => Boolean(h)),
    [state],
  );

  const canRun = Boolean(conn?.strk20 && token);

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <header className="mb-10">
        <p className="label">
          Cellar · Day 0
        </p>
        <h1 className="display mt-3 text-[clamp(2rem,5vw,2.9rem)] leading-tight text-ash">Three mainnet transactions</h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
          Nothing is scored without these. Run them here, then commit the output
          to <code className="text-brass">strk20.json</code> at the repo root.
        </p>
      </header>

      {/* Wallet */}
      <section className="panel mb-5 p-6">
        <h2 className="mb-1 text-sm font-semibold">Wallet</h2>
        <p className="mb-4 text-[13px] text-muted">
          STRK20 privacy is mainnet only. Support is probed at runtime rather than
          assumed from a wallet list.
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
                disabled={connecting}
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
              <dd>{conn.network.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">STRK20 Wallet API</dt>
              <dd className={conn.strk20 ? "text-moss" : "text-rust"}>
                {conn.strk20 ? "supported" : "not supported by this wallet"}
              </dd>
            </div>
          </dl>
        )}

        {connError && (
          <p className="mt-4 rounded border border-rust/30 bg-rust/5 p-3 text-[13px] text-rust">
            {connError}
          </p>
        )}
      </section>

      {/* Parameters */}
      <section className="panel mb-5 p-6">
        <h2 className="mb-4 text-sm font-semibold">Parameters</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="label">
              Token
            </span>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="field"
            >
              {Object.keys(TOKENS).map((s) => (
                <option key={s} value={s}>
                  {s} ({TOKENS[s].decimals} dp)
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">
              Amount
            </span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              spellCheck={false}
              className="field"
            />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="label">
              Unshield destination — use a fresh address
            </span>
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x…"
              spellCheck={false}
              className="field"
            />
          </label>
        </div>
        {token && (
          <p className="mt-3 font-mono text-[11px] text-muted">
            {symbol} → {short(token.address)} · {(() => {
              try {
                return `${fromUnits(toUnits(amount, token.decimals), token.decimals)} ${symbol}`;
              } catch {
                return "invalid amount";
              }
            })()}
          </p>
        )}
      </section>

      {/* Operations */}
      <section className="mb-6 space-y-3">
        {OPS.map((op, i) => {
          const st = state[op.id];
          return (
            <article key={op.id} className="panel p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-[15px] font-semibold">
                    <span className="mr-2 font-mono text-xs text-brass">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {op.title}
                  </h3>
                  <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-muted">
                    {op.detail}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${
                    st.status === "done"
                      ? "bg-moss/15 text-moss"
                      : st.status === "error"
                        ? "bg-rust/15 text-rust"
                        : "bg-edge text-muted"
                  }`}
                >
                  {st.status === "running" ? "proving…" : st.status}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => run(op)}
                  disabled={!canRun || st.status === "running"}
                  className="btn btn-primary"
                >
                  {st.status === "done" ? "Run again" : `Run ${op.title.toLowerCase()}`}
                </button>
                {st.hash && (
                  <a href={txUrl(st.hash)} target="_blank" rel="noreferrer" className="btn btn-ghost">
                    Voyager ↗
                  </a>
                )}
                {st.hash && (
                  <code className="font-mono text-[11px] text-muted">{short(st.hash)}</code>
                )}
              </div>

              {st.error && (
                <p className="mt-3 rounded border border-rust/30 bg-rust/5 p-3 font-mono text-[12px] leading-relaxed text-rust">
                  {st.error}
                </p>
              )}
            </article>
          );
        })}
      </section>

      {/* Output */}
      <section className="panel p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">strk20.json</h2>
          <span className="font-mono text-[11px] text-muted">{hashes.length} / 3</span>
        </div>
        <pre className="overflow-x-auto rounded bg-ink p-4 font-mono text-[12px] leading-relaxed">
{JSON.stringify(
  { transactions: hashes, contracts: [], demo_video: "", demo_url: "" },
  null,
  2,
)}
        </pre>
        <p className="mt-3 text-[12px] text-muted">
          Pool{" "}
          <a
            className="text-brass underline"
            href={`${CHAIN.explorer}/contract/${CHAIN.poolAddress}`}
            target="_blank"
            rel="noreferrer"
          >
            {short(CHAIN.poolAddress)}
          </a>{" "}
          · RPC {CHAIN.rpcUrl}
        </p>
      </section>
    </main>
  );
}
