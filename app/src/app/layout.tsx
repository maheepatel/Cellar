import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cellar — private yield on Starknet",
  description:
    "Shield an asset, earn real lending yield through a STRK20 anonymizer contract, and stay unlinkable to the position.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="border-b border-edge">
          <div className="mx-auto flex max-w-3xl items-center gap-6 px-6 py-4">
            <Link href="/" className="font-mono text-[13px] font-bold tracking-tight text-brass">
              CELLAR
            </Link>
            <div className="flex gap-4 font-mono text-[12px] text-muted">
              <Link href="/" className="hover:text-white">
                Day 0
              </Link>
              <Link href="/vault" className="hover:text-white">
                Position
              </Link>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
