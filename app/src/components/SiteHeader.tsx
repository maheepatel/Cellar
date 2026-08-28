"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/vault", label: "Position" },
  { href: "/prove", label: "Prove" },
  { href: "/verify", label: "Verify" },
  { href: "/day0", label: "Day 0" },
];

export function SiteHeader() {
  const path = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-ink/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="group flex items-baseline gap-2.5">
          <span className="display text-[19px] text-ash transition-colors group-hover:text-brass-lit">
            Cellar
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-label text-faint sm:inline">
            private yield
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {LINKS.map((l) => {
            const active = path === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-label transition-colors ${
                  active ? "bg-raised text-brass-lit" : "text-faint hover:text-ash"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
