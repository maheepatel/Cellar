"use client";

// Position dashboard — Phase 3.
//
// The screen a judge actually looks at. Shows the shielded balance, the vault
// position, and the two operations that move between them, with a quote before
// anything is signed.
//
// It reads the helper address from config/mainnet.json. Until Phase 2 deploys
// it, the page says so plainly rather than pretending to work.

import { useCallback, useEffect, useMemo, useState } from "react";
import { CHAIN, DAPP_NAME, HELPER, TOKENS, contractUrl, shadowAccount, txUrl } from "@/lib/strk20";
import { earn, exitYield, fromUnits, previewYield, shieldedBalances, toUnits } from "@/lib/actions";
import { connect, discover, short, type Connection, type DiscoveredWallet } from "@/lib/wallet";

type Dir = "earn" | "exit";

export default function VaultPage() {
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([]);
  const [conn, setConn] = useState<Connection | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [symbol, setSymbol] = useState("USDC");
  const [amount, setAmount] = useState("0.5");
  const [dir, setDir] = useState<Dir>("earn");

  const [balances, setBalances] = useState<Record<string, bigint> | null>(null);
  const [quote, setQuote] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hash, setHash] = useState<string | null>(null);
  const [shadow, setShadow] = useState<string | null>(null);

  const token = TOKENS[symbol];
  const deployed = Boolean(HELPER.address && HELPER.allowedVaults.length);
  const vault = HELPER.allowedVaults[0] ?? "";

  useEffect(() => {
    setWallets(discover());
    const t = setTimeout(() => setWallets(discover()), 600);
    return () => clearTimeout(t);
  }, []);

  const refresh = useCallback(async (c: Connection) => {
    try {
      const entries = await shieldedBalances(
        c.account,
        Object.values(TOKENS).map((t) => t.address),
      );
      const map: Record<string, bigint> = {};
      for (const e of entries) map[e.token.toLowerCase()] = BigInt(e.balance);
      setBalances(map);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const onConnect = useCallback(
    async (w: DiscoveredWallet) => {
      setErr(null);
      try {
        const c = await connect(w);
        setConn(c);
        await refresh(c);
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    },
    [refresh],
  );

  // Quote whenever the inputs settle.
  useEffect(() => {
    if (!deployed || !token) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setQuoting(true);
      try {
        const units = toUnits(amount, token.decimals);
        if (units === 0n) throw new Error("zero");
        const out = await previewYield({
          operation: dir === "earn" ? "deposit" : "withdraw",
          underlying: token.address,
          vault,
          amount: units,
        });
        if (!cancelled) setQuote(fromUnits(out, token.decimals));
      } catch {
        if (!cancelled) setQuote(null);
      } finally {
        if (!cancelled) setQuoting(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [amount, symbol, dir, token, vault, deployed]);

  const run = useCallback(async () => {
    if (!conn || !token || !deployed) return;
    setBusy(true);
    setErr(null);
    setHash(null);
    try {
      const units = toUnits(amount, token.decimals);
      const params = {
        helper: HELPER.address,
        underlying: token.address,
        vault,
        amount: units,
        self: conn.address,
      };
      const h = dir === "earn" ? await earn(conn.account, params) : await exitYield(conn.account, params);
      setHash(h);
      await refresh(conn);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [conn, token, amount, dir, vault, deployed, refresh]);

  const deriveShadow = useCallback(async () => {
    if (!conn) return;
    setErr(null);
    try {
      setShadow(await shadowAccount(conn.account, DAPP_NAME));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [conn]);

  const shielded = useMemo(() => {
    if (!balances || !token) return null;
    return balances[token.address.toLowerCase()] ?? 0n;
  }, [balances, token]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <header className="mb-8">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">Cellar · Position</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Earning, unlinkably</h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
          Shielded capital routed into a lending market through an anonymizer.
          The flow is public; you are not.
        </p>
      </header>

      {!deployed && (
        <div className="panel mb-6 border-l-2 border-l-brass p-5">
          <h2 className="text-sm font-semibold">Helper not deployed yet</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Phase 2 deploys <code className="text-brass">YieldHelper</code> to mainnet
            pinned to a live ERC-4626 vault. Until then this page is inert — the
            address and allowlist come from{" "}
            <code className="text-brass">config/mainnet.json</code>, and both are empty.
          </p>
        </div>
      )}

      {/* Wallet + balances */}
      <section className="panel mb-6 p-5">
        {!conn ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-2 text-[13px] text-muted">Connect to see your position:</span>
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
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted">Shielded</p>
              <p className="mt-1 font-mono text-xl tabular-nums">
                {shielded === null ? "—" : fromUnits(shielded, token?.decimals ?? 18)}
                <span className="ml-1 text-[13px] text-muted">{symbol}</span>
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted">Account</p>
              <p className="mt-1 font-mono text-[13px]">{short(conn.address)}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted">Wallet API</p>
              <p className={`mt-1 font-mono text-[13px] ${conn.strk20 ? "text-moss" : "text-rust"}`}>
                {conn.strk20 ? "supported" : "unsupported"}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Action */}
      <section className="panel mb-6 p-5">
        <div className="mb-4 flex gap-1 rounded border border-edge p-1">
          {(["earn", "exit"] as Dir[]).map((d) => (
            <button
              key={d}
              onClick={() => setDir(d)}
              className={`flex-1 rounded px-3 py-1.5 font-mono text-[12px] uppercase tracking-wider transition ${
                dir === d ? "bg-brass text-ink" : "text-muted hover:text-white"
              }`}
            >
              {d === "earn" ? "Earn" : "Exit"}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted">Token</span>
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="rounded border border-edge bg-ink px-3 py-2 font-mono text-[13px] outline-none focus:border-brass"
            >
              {Object.keys(TOKENS).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted">Amount</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              spellCheck={false}
              className="rounded border border-edge bg-ink px-3 py-2 font-mono text-[13px] outline-none focus:border-brass"
            />
          </label>
        </div>

        <div className="mt-4 rounded border border-edge bg-ink px-4 py-3">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
            You receive, approximately
          </p>
          <p className="mt-1 font-mono text-lg tabular-nums">
            {quoting ? "quoting…" : (quote ?? "—")}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            A quote from the vault at the current block. The amount actually credited
            is the measured balance delta at execution, so it can differ if the rate moves.
          </p>
        </div>

        <button
          onClick={run}
          disabled={!conn?.strk20 || !deployed || busy}
          className="btn btn-primary mt-4 w-full"
        >
          {busy ? "proving…" : dir === "earn" ? "Shield into yield" : "Exit position"}
        </button>

        {hash && (
          <p className="mt-3 font-mono text-[12px]">
            <a href={txUrl(hash)} target="_blank" rel="noreferrer" className="text-brass underline">
              {short(hash)} ↗
            </a>
          </p>
        )}
        {err && (
          <p className="mt-3 rounded border border-rust/40 bg-rust/10 p-3 font-mono text-[12px] leading-relaxed text-rust">
            {err}
          </p>
        )}
      </section>

      {/* Shadow account */}
      <section className="panel p-5">
        <h2 className="text-sm font-semibold">Stealth withdrawal address</h2>
        <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-muted">
          A shadow account scoped to this app. Exiting here rather than to your
          main wallet is what keeps the deposit and the withdrawal unlinked —
          withdrawing to the address that deposited undoes the pool.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={deriveShadow} disabled={!conn} className="btn btn-ghost">
            Derive address
          </button>
          {shadow && <code className="font-mono text-[12px] text-moss">{short(shadow)}</code>}
        </div>
      </section>

      <footer className="mt-8 font-mono text-[11px] text-muted">
        Pool{" "}
        <a className="text-brass underline" href={contractUrl(CHAIN.pool)} target="_blank" rel="noreferrer">
          {short(CHAIN.pool)}
        </a>
        {deployed && (
          <>
            {" · Helper "}
            <a className="text-brass underline" href={contractUrl(HELPER.address)} target="_blank" rel="noreferrer">
              {short(HELPER.address)}
            </a>
          </>
        )}
      </footer>
    </main>
  );
}
