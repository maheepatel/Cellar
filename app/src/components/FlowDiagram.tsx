"use client";

// The atomic cycle, drawn.
//
// A prose list makes you assemble the mechanism in your head. The thing worth
// seeing is that our contract sits in the middle of a loop that starts and ends
// inside the pool, and that the only public edge is "the pool paid a contract".

const OURS = "#C9963F";
const INK = "#616A7C";

export function FlowDiagram() {
  return (
    <figure className="panel p-6 sm:p-8">
      <figcaption className="mb-6">
        <h2 className="display text-2xl text-ash">One deposit, five steps, one transaction</h2>
        <p className="mt-1.5 max-w-lg text-[14px] leading-relaxed text-muted">
          If any step fails they all revert. The helper never holds custody
          across blocks and never touches an encrypted note — it receives plain
          tokens, does one job, and hands back an instruction.
        </p>
      </figcaption>

      <svg
        viewBox="0 0 820 300"
        className="w-full"
        style={{ height: "auto" }}
        role="img"
        aria-label="The STRK20 pool transfers tokens to the Cellar helper, which deposits them into an ERC-4626 vault, receives shares, approves the pool to pull them, and returns a deposit instruction. The pool then credits an encrypted note. All five steps happen in one atomic transaction."
      >
        <defs>
          <marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill={INK} />
          </marker>
          <marker id="arb" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill={OURS} />
          </marker>
        </defs>

        {/* atomic boundary */}
        <rect x="14" y="34" width="792" height="204" rx="8" fill="none" stroke="#242935" strokeDasharray="5 5" />
        <text x="28" y="24" fontFamily="var(--font-mono)" fontSize="10" fill={INK} letterSpacing="1.6">
          ONE ATOMIC TRANSACTION
        </text>

        {/* pool */}
        <rect x="44" y="106" width="164" height="76" rx="6" fill="#12151C" stroke="#242935" strokeWidth="1.5" />
        <text x="126" y="138" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill="#E8EAEF">STRK20 POOL</text>
        <text x="126" y="157" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill={INK}>your encrypted notes</text>

        {/* helper — ours */}
        <rect x="328" y="106" width="164" height="76" rx="6" fill="#1A1E27" stroke={OURS} strokeWidth="2" />
        <text x="410" y="132" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill={OURS}>CELLAR HELPER</text>
        <text x="410" y="150" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill={OURS} opacity="0.8">privacy_invoke()</text>
        <text x="410" y="166" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill={OURS} opacity="0.8">allowlist enforced</text>

        {/* vault */}
        <rect x="612" y="106" width="164" height="76" rx="6" fill="#12151C" stroke="#242935" strokeWidth="1.5" />
        <text x="694" y="138" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="12" fill="#E8EAEF">ERC-4626 VAULT</text>
        <text x="694" y="157" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill={INK}>yield-bearing</text>

        {/* forward */}
        <line x1="208" y1="130" x2="322" y2="130" stroke={INK} strokeWidth="1.5" markerEnd="url(#ar)" />
        <text x="265" y="114" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill={INK}>1 · tokens</text>

        <line x1="492" y1="130" x2="606" y2="130" stroke={INK} strokeWidth="1.5" markerEnd="url(#ar)" />
        <text x="549" y="114" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill={INK}>2 · deposit</text>

        {/* return */}
        <line x1="606" y1="162" x2="492" y2="162" stroke={INK} strokeWidth="1.5" markerEnd="url(#ar)" />
        <text x="549" y="180" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill={INK}>3 · shares</text>

        <line x1="322" y1="162" x2="208" y2="162" stroke={OURS} strokeWidth="1.5" markerEnd="url(#arb)" />
        <text x="265" y="180" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill={OURS}>4 · approve</text>

        {/* pool self-loop: credit */}
        <path d="M86 182 L86 212 L166 212 L166 182" fill="none" stroke={INK} strokeWidth="1.5" markerEnd="url(#ar)" />
        <text x="126" y="228" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill={INK}>5 · credits an encrypted note</text>

        {/* what leaks */}
        <line x1="14" y1="258" x2="806" y2="258" stroke="#242935" />
        <text x="28" y="280" fontFamily="var(--font-mono)" fontSize="10" fill={INK} letterSpacing="1.2">
          VISIBLE TO AN OBSERVER
        </text>
        <text x="196" y="280" fontFamily="var(--font-mono)" fontSize="10" fill="#98A0B0">
          the pool paid a contract, and how much — never who asked
        </text>
      </svg>

      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-label text-faint">
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-4 rounded-sm border-2" style={{ borderColor: OURS }} />
          built by us
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-4 rounded-sm border" style={{ borderColor: "#242935" }} />
          already shipped
        </span>
      </div>
    </figure>
  );
}
