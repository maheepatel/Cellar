"use client";

// Public verifier — Phase 4.
//
// Deliberately needs no wallet. A judge, an auditor or a counterparty opens
// the link and gets an answer, checked against the chain.

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CHAIN, TOKENS, contractUrl } from "@/lib/strk20";
import { fromUnits } from "@/lib/actions";
import { decode, verify, type Attestation, type VerifyResult } from "@/lib/attest";
import { short } from "@/lib/wallet";

function tokenFor(address: string) {
  const hit = Object.entries(TOKENS).find(
    ([, t]) => t.address.toLowerCase() === address.toLowerCase(),
  );
  return hit ? { symbol: hit[0], ...hit[1] } : null;
}

function Verifier() {
  const params = useSearchParams();
  const [raw, setRaw] = useState("");
  const [att, setAtt] = useState<Attestation | null>(null);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const check = useCallback(async (encoded: string) => {
    setBusy(true);
    setErr(null);
    setResult(null);
    setAtt(null);
    try {
      const parsed = decode(encoded.trim());
      setAtt(parsed);
      setResult(await verify(parsed));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  // Auto-verify when arriving via a shared link.
  useEffect(() => {
    const a = params.get("a");
    if (a) {
      setRaw(a);
      void check(a);
    }
  }, [params, check]);

  const token = att ? tokenFor(att.claim.token) : null;
  const valid = result?.authentic && !result.expired;

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <header className="mb-8">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted">
          Cellar · Verifier
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Check an attestation</h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
          No wallet needed. The signature is checked against the chain by calling
          the signing account&rsquo;s own <code className="text-brass">is_valid_signature</code>.
        </p>
      </header>

      <section className="panel mb-6 p-5">
        <label className="flex flex-col gap-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
            Attestation or link
          </span>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={4}
            placeholder="Paste the attestation string, or the whole /verify?a=… link"
            spellCheck={false}
            className="w-full resize-none rounded border border-edge bg-ink p-3 font-mono text-[11px] leading-relaxed outline-none focus:border-brass"
          />
        </label>
        <button
          onClick={() => {
            const m = raw.match(/[?&]a=([^&\s]+)/);
            void check(m ? m[1] : raw);
          }}
          disabled={!raw.trim() || busy}
          className="btn btn-primary mt-3"
        >
          {busy ? "checking…" : "Verify"}
        </button>
        {err && (
          <p className="mt-3 rounded border border-rust/40 bg-rust/10 p-3 font-mono text-[12px] text-rust">
            {err}
          </p>
        )}
      </section>

      {result && att && (
        <>
          <section
            className={`panel mb-6 border-l-2 p-5 ${
              valid ? "border-l-moss" : "border-l-rust"
            }`}
          >
            <p
              className={`font-mono text-[11px] uppercase tracking-[0.15em] ${
                valid ? "text-moss" : "text-rust"
              }`}
            >
              {result.authentic
                ? result.expired
                  ? "Authentic, but expired"
                  : "Authentic"
                : "Not authentic"}
            </p>
            <p className="mt-3 text-[17px] leading-relaxed">
              {result.authentic ? (
                <>
                  Account <span className="font-mono text-brass">{short(att.claim.account)}</span>{" "}
                  states its shielded balance of{" "}
                  <span className="text-brass">{token?.symbol ?? short(att.claim.token)}</span> is
                  at least{" "}
                  <span className="text-brass">
                    {token
                      ? fromUnits(BigInt(att.claim.threshold), token.decimals)
                      : att.claim.threshold}
                  </span>
                  .
                </>
              ) : (
                <>
                  This signature does not match the claim. It was altered, or it was not signed by
                  the account it names.
                </>
              )}
            </p>
            {result.expired && result.authentic && (
              <p className="mt-3 text-[13px] text-muted">
                The signer set this to expire on{" "}
                {new Date(Number(att.claim.expiresAt) * 1000).toLocaleString()}. The signature is
                still genuine — the window the signer chose has simply passed.
              </p>
            )}
          </section>

          <section className="panel mb-6 p-5">
            <h2 className="mb-4 text-sm font-semibold">Details</h2>
            <dl className="grid gap-2.5 font-mono text-[12px]">
              {[
                ["signing account", short(att.claim.account)],
                ["token", token ? `${token.symbol} · ${short(att.claim.token)}` : short(att.claim.token)],
                ["anchored at block", att.claim.block],
                ["current block", String(result.currentBlock)],
                ["issued", new Date(Number(att.claim.issuedAt) * 1000).toLocaleString()],
                ["expires", new Date(Number(att.claim.expiresAt) * 1000).toLocaleString()],
                ["message hash", short(result.hash)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-[12px] text-muted">
              Account on{" "}
              <a
                className="text-brass underline"
                href={contractUrl(att.claim.account)}
                target="_blank"
                rel="noreferrer"
              >
                Voyager ↗
              </a>{" "}
              · chain {CHAIN.id}
            </p>
          </section>
        </>
      )}

      <section className="panel border-l-2 border-l-brass p-5">
        <h2 className="text-sm font-semibold">How to read this result</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          <strong className="text-white">&ldquo;Authentic&rdquo;</strong> means the named account
          really did sign this exact statement — verified on-chain, so it holds for smart accounts
          and multisig too. Alter one character and it fails.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          It does <strong className="text-white">not</strong> mean the statement is true. This is
          an attestation, not a zero-knowledge proof: a signer could sign something false, exactly
          as they could write a false letter. What it gives you is a claim that is bounded,
          expiring, and cryptographically bound to an identifiable account — instead of a viewing
          key that would hand over their entire history.
        </p>
      </section>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-3xl px-6 py-14 text-muted">Loading…</main>}>
      <Verifier />
    </Suspense>
  );
}
