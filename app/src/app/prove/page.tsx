"use client";

// Issue a selective disclosure — Phase 4.
//
// Sign one narrow statement about your position instead of handing over a
// viewing key, which would expose everything you have ever done.

import { useCallback, useEffect, useState } from "react";
import { TOKENS } from "@/lib/strk20";
import { toUnits } from "@/lib/actions";
import { encode, issue, type Attestation } from "@/lib/attest";
import { connect, discover, short, type Connection, type DiscoveredWallet } from "@/lib/wallet";

const WINDOWS = [
  { label: "1 hour", seconds: 3600 },
  { label: "24 hours", seconds: 86400 },
  { label: "7 days", seconds: 604800 },
];

export default function ProvePage() {
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);
  const [conn, setConn] = useState<Connection | null>(null);
  const [symbol, setSymbol] = useState("USDC");
  const [threshold, setThreshold] = useState("100");
  const [window_, setWindow] = useState(86400);
  const [att, setAtt] = useState<Attestation | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const token = TOKENS[symbol];

  useEffect(() => {
    setWallets(discover());
    const t = setTimeout(() => setWallets(discover()), 600);
    return () => clearTimeout(t);
  }, []);

  const onConnect = useCallback(async (w: DiscoveredWallet) => {
    setErr(null);
    try {
      setConn(await connect(w));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const sign = useCallback(async () => {
    if (!conn || !token) return;
    setBusy(true);
    setErr(null);
    setAtt(null);
    try {
      const units = toUnits(threshold, token.decimals);
      if (units === 0n) throw new Error("Threshold must be greater than zero");
      setAtt(
        await issue(conn.account, {
          token: token.address,
          threshold: units,
          validForSeconds: window_,
        }),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [conn, token, threshold, window_]);

  const link = att
    ? `${typeof location !== "undefined" ? location.origin : ""}/verify?a=${encode(att)}`
    : "";

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <header className="mb-8">
        <p className="label">
          Cellar · Disclosure
        </p>
        <h1 className="display mt-3 text-[clamp(2rem,5vw,2.9rem)] leading-tight text-ash">Prove one thing only</h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
          Sign a single statement about your position — a threshold, at a block,
          for a limited time — instead of surrendering a viewing key that would
          expose your whole history.
        </p>
      </header>

      <section className="panel mb-5 p-6">
        {!conn ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-2 text-[13px] text-muted">Connect to sign:</span>
            {wallets.length === 0 && (
              <span className="text-[13px] text-muted">no Starknet wallet detected</span>
            )}
            {wallets.map((w) => (
              <button key={w.id} onClick={() => onConnect(w)} className="btn btn-ghost">
                {w.name}
              </button>
            ))}
          </div>
        ) : (
          <p className="font-mono text-[13px]">
            <span className="text-muted">signing as </span>
            {short(conn.address)}
          </p>
        )}
      </section>

      <section className="panel mb-5 p-6">
        <h2 className="mb-4 text-sm font-semibold">The statement</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="label">Token</span>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="field"
            >
              {Object.keys(TOKENS).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">
              At least
            </span>
            <input
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              spellCheck={false}
              className="field"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">
              Valid for
            </span>
            <select
              value={window_}
              onChange={(e) => setWindow(Number(e.target.value))}
              className="field"
            >
              {WINDOWS.map((w) => (
                <option key={w.seconds} value={w.seconds}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="mt-4 rounded border border-edge bg-ink px-4 py-3 text-[14px] leading-relaxed">
          &ldquo;My shielded balance of <span className="text-brass">{symbol}</span> is at least{" "}
          <span className="text-brass">{threshold || "—"}</span>.&rdquo;
        </p>

        <button
          onClick={sign}
          disabled={!conn || busy}
          className="btn btn-primary mt-4 w-full"
        >
          {busy ? "waiting for signature…" : "Sign statement"}
        </button>
        <p className="mt-2 text-center text-[11px] text-muted">
          No transaction, no gas. Signing happens entirely in your wallet.
        </p>

        {err && (
          <p className="mt-3 rounded border border-rust/30 bg-rust/5 p-3 font-mono text-[12px] text-rust">
            {err}
          </p>
        )}
      </section>

      {att && (
        <section className="panel mb-5 p-6">
          <h2 className="mb-3 text-sm font-semibold">Share this link</h2>
          <textarea
            readOnly
            value={link}
            rows={4}
            onFocus={(e) => e.currentTarget.select()}
            className="field resize-none leading-relaxed"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => {
                navigator.clipboard?.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="btn btn-ghost"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
            <a href={link} className="btn btn-ghost">
              Open verifier ↗
            </a>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-muted">
            Anchored to block {att.claim.block}. Expires{" "}
            {new Date(Number(att.claim.expiresAt) * 1000).toLocaleString()}.
          </p>
        </section>
      )}

      <section className="panel border-l-2 border-l-brass p-6">
        <h2 className="text-sm font-semibold">What this proves, and what it does not</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          <strong className="text-ash">It proves</strong> that this account authored this exact
          statement. A verifier checks that against the chain by calling your account&rsquo;s own{" "}
          <code className="text-brass">is_valid_signature</code>, so it holds for smart accounts,
          multisig and hardware wallets. Change one character and verification fails.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          <strong className="text-ash">It does not prove</strong> the statement is true. This is
          an attestation, the same instrument as a bank&rsquo;s proof-of-funds letter — its value
          comes from the signer being identifiable and accountable, not from the maths making a
          lie impossible. A zero-knowledge proof of the balance itself would need a circuit over
          the pool&rsquo;s commitment scheme, and we would rather ship an honest attestation than
          call a signature a proof.
        </p>
      </section>
    </main>
  );
}
