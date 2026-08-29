"use client";

// The questions a sceptical reader actually has — including the awkward ones.
// A FAQ that only answers easy questions reads as marketing.

import { useState } from "react";

const QA: { q: string; a: React.ReactNode }[] = [
  {
    q: "Does this hide how much I deposit?",
    a: (
      <>
        <strong className="text-ash">No.</strong> Anything routed through an
        anonymizer contract publishes its amount and its timing. Cellar gives
        you <span className="text-ash">identity</span> privacy, not amount
        privacy. An observer sees that someone deposited a given amount; they
        cannot tell it was you, connect it to your other positions, or follow it
        to where you withdraw. Note-to-note transfers inside the pool hide both
        amounts and parties — that part is fully private.
      </>
    ),
  },
  {
    q: "Can you steal my funds, or redirect them somewhere else?",
    a: (
      <>
        The vault allowlist is written once in the constructor and has{" "}
        <strong className="text-ash">no setter and no owner</strong>. There is no
        admin key to compromise or coerce. Anyone can read the permitted vaults
        on-chain with <code className="text-brass">allowed_vault_count()</code>{" "}
        and <code className="text-brass">allowed_vault_at()</code>. A deployed
        helper is a fixed, auditable route or it is nothing.
      </>
    ),
  },
  {
    q: "Is the disclosure a zero-knowledge proof?",
    a: (
      <>
        <strong className="text-ash">No, and we do not call it one.</strong> It
        is a signed attestation — the same instrument as a bank&rsquo;s
        proof-of-funds letter. It proves cryptographically that a specific
        account authored a specific unaltered claim, verified on-chain against
        that account&rsquo;s own <code className="text-brass">is_valid_signature</code>.
        It does not prove the claim is true. A real ZK proof of{" "}
        <code className="text-brass">balance ≥ threshold</code> needs a circuit
        over the pool&rsquo;s commitment scheme, and shipping an honest
        attestation beats dressing a signature up as a proof.
      </>
    ),
  },
  {
    q: "What stops me from just linking my own deposit and withdrawal?",
    a: (
      <>
        Nothing but your own care, which is why the app derives a{" "}
        <strong className="text-ash">shadow account</strong> for you to exit to.
        Withdrawing to the same wallet that deposited re-links both ends and
        undoes the pool entirely. Two other habits matter: avoid distinctive
        round amounts, and leave time between entering and leaving — tight
        timing correlates even when addresses do not.
      </>
    ),
  },
  {
    q: "Do I have to trust your servers?",
    a: (
      <>
        There are none to trust. Cellar has{" "}
        <strong className="text-ash">no backend and no database</strong>. Your
        wallet holds the viewing key, discovers your notes, generates the proof
        and submits it; the app only asks it to. A server-side record of who
        holds what would recreate exactly the surveillance the pool exists to
        remove.
      </>
    ),
  },
  {
    q: "Is this compliant, or is it a mixer?",
    a: (
      <>
        Every deposit into the pool is screened by a compliance provider whose
        signature the pool verifies on-chain — that applies to every route and
        is not bypassable. At registration your viewing key is encrypted to an
        auditor&rsquo;s public key, so a lawful request can trace one
        user&rsquo;s history without touching anyone else&rsquo;s. A viewing key
        is exactly that: viewing. Spending still needs your signature.
      </>
    ),
  },
  {
    q: "What is actually deployed right now?",
    a: (
      <>
        The anonymizer contract is written and covered by 16 tests, the app is
        live, and the disclosure flow works end to end. The mainnet deployment of
        the helper is pending — the contract pins its vault at construction, and
        that address is chosen at deploy time. Progress is tracked honestly in{" "}
        <a
          href="https://github.com/maheepatel/Cellar/blob/main/docs/PHASES.md"
          target="_blank"
          rel="noreferrer"
          className="text-brass underline underline-offset-2"
        >
          PHASES.md
        </a>
        .
      </>
    ),
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="overflow-hidden rounded-lg border border-edge">
      {QA.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q} className="border-b border-hairline last:border-b-0">
            <h3>
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 bg-surface px-6 py-5 text-left transition-colors hover:bg-raised"
              >
                <span className="text-[15px] font-medium text-ash">{item.q}</span>
                <span
                  className={`shrink-0 font-mono text-[16px] leading-none text-brass transition-transform duration-200 ${
                    isOpen ? "rotate-45" : ""
                  }`}
                  aria-hidden="true"
                >
                  +
                </span>
              </button>
            </h3>
            {isOpen && (
              <div className="animate-rise bg-surface px-6 pb-6 pt-0">
                <p className="max-w-2xl text-[14px] leading-relaxed text-muted">
                  {item.a}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
