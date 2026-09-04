"use client";

// Position dashboard.
//
// The hero screen. Shielded balance, the two operations that move capital
// between the pool and a lending market, a quote before anything is signed,
// and a stealth address to exit to.

import { useCallback, useEffect, useMemo, useState } from "react";
import { DAPP_NAME, contractUrl, helper, network, shadowAccount, tokens, txUrl } from "@/lib/strk20";
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

  const TOKENS = tokens();
  const NET = network();
  const HELPER = helper();
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
      const h =
        dir === "earn" ? await earn(conn.account, params) : await exitYield(conn.account, params);
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

  const amountValid = (() => {
    try {
      return token ? toUnits(amount, token.decimals) > 0n : false;
    } catch {
      return false;
    }
  })();

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <header className="mb-10 animate-rise">
        <p className="label mb-4">Position</p>
        <h1 className="display text-[clamp(2rem,5vw,2.9rem)] leading-tight text-ash">
          Earning, <span className="italic text-brass">unlinkably</span>
        </h1>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted">
          Shielded capital routed into a lending market through an anonymizer.
          The flow is public; you are not.
        </p>
      </header>

      {!deployed && (
        <div className="panel mb-6 border-l-2 border-l-brass p-5">
          <p className="text-[14px] font-medium text-ash">Anonymizer not deployed yet</p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            No <code className="text-brass">YieldHelper</code> is registered for{" "}
            {NET.name} in <code className="text-brass">config/networks.json</code>.
            Deploy it and fill in the address — see{" "}
            <code className="text-brass">scripts/DEPLOY.md</code> — and this screen
            lights up.
          </p>
        </div>
      )}

      {/* balance */}
      <section className="panel-lit mb-5 p-6">
        {!conn ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[14px] text-muted">Connect to see your position</span>
            <div className="flex gap-2">
              {wallets.length === 0 && (
                <span className="font-mono text-[12px] text-faint">
                  no Starknet wallet detected
                </span>
              )}
              {wallets.map((w) => (
                <button key={w.id} onClick={() => onConnect(w)} className="btn btn-ghost">
                  {w.name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="label">Shielded {symbol}</p>
              <p className="num mt-2 text-[2.6rem] leading-none text-ash">
                {shielded === null ? "···" : fromUnits(shielded, token?.decimals ?? 18)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className={`chip ${conn.strk20 ? "chip-ok" : "chip-bad"}`}>
                <span className={`dot ${conn.strk20 ? "bg-moss" : "bg-rust"}`} />
                {conn.strk20 ? "wallet api" : "unsupported"}
              </span>
              <span className="num text-[11px] text-faint">{short(conn.address)}</span>
            </div>
          </div>
        )}
      </section>

      {/* action */}
      <section className="panel mb-5 p-6">
        <div className="mb-5 inline-flex rounded-md border border-edge p-1">
          {(["earn", "exit"] as Dir[]).map((d) => (
            <button
              key={d}
              onClick={() => setDir(d)}
              className={`rounded px-5 py-1.5 font-mono text-[11px] uppercase tracking-label transition-colors ${
                dir === d ? "bg-brass text-ink" : "text-faint hover:text-ash"
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
          <label className="flex flex-col gap-2">
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
          <label className="flex flex-col gap-2">
            <span className="label">Amount</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              spellCheck={false}
              className="field"
            />
          </label>
        </div>

        <div className="mt-5 rounded-md border border-edge bg-ink px-5 py-4">
          <p className="label">You receive, approximately</p>
          <p className="num mt-1.5 text-xl text-ash">
            {quoting ? (
              <span className="text-faint">quoting…</span>
            ) : (
              (quote ?? <span className="text-faint">—</span>)
            )}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-faint">
            The vault&rsquo;s own quote at the current block. What actually gets
            credited is the measured balance delta at execution, so it can differ
            if the rate moves.
          </p>
        </div>

        <button
          onClick={run}
          disabled={!conn?.strk20 || !deployed || busy || !amountValid}
          className="btn btn-primary mt-5 w-full py-3"
        >
          {busy ? "proving…" : dir === "earn" ? "Shield into yield" : "Exit position"}
        </button>

        {hash && (
          <a
            href={txUrl(hash)}
            target="_blank"
            rel="noreferrer"
            className="mt-3 block text-center font-mono text-[12px] text-brass hover:text-brass-lit"
          >
            {short(hash)} ↗
          </a>
        )}
        {err && (
          <p className="mt-4 rounded-md border border-rust/30 bg-rust/5 p-3 font-mono text-[12px] leading-relaxed text-rust">
            {err}
          </p>
        )}
      </section>

      {/* stealth */}
      <section className="panel p-6">
        <p className="text-[15px] font-medium text-ash">Stealth withdrawal address</p>
        <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-muted">
          A shadow account scoped to this app. Exiting here rather than to your
          main wallet is what keeps the deposit and the withdrawal unlinked —
          withdrawing to the address that deposited undoes the pool entirely.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={deriveShadow} disabled={!conn} className="btn btn-ghost">
            Derive address
          </button>
          {shadow && <code className="num text-[12px] text-moss">{short(shadow)}</code>}
        </div>
      </section>

      <p className="mt-6 font-mono text-[11px] text-faint">
        pool{" "}
        <a
          href={contractUrl(NET.poolAddress)}
          target="_blank"
          rel="noreferrer"
          className="text-brass hover:text-brass-lit"
        >
          {short(NET.poolAddress)}
        </a>
        {deployed && (
          <>
            {" · helper "}
            <a
              href={contractUrl(HELPER.address)}
              target="_blank"
              rel="noreferrer"
              className="text-brass hover:text-brass-lit"
            >
              {short(HELPER.address)}
            </a>
          </>
        )}
      </p>
    </main>
  );
}
