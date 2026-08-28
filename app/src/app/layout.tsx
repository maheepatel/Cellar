import type { Metadata } from "next";
import { Instrument_Serif, Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";

// A serif display face in a DeFi app is deliberate. It reads as institutional
// and considered — the register of a proof-of-funds letter, not a trading
// terminal — and it is nothing like the Inter/Space Grotesk that every other
// crypto frontend reaches for.
const display = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const ui = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cellar — private yield on Starknet",
  description:
    "Shield an asset, earn real lending yield through a STRK20 anonymizer contract, and stay unlinkable to the position. Visible flow, invisible participant.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable} ${mono.variable}`}>
      <body className="min-h-screen">
        <SiteHeader />
        {children}
        <footer className="mt-24 border-t border-hairline">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-8">
            <p className="font-mono text-[11px] text-faint">
              Cellar · RFP-24 · STRK20 Private Sprint
            </p>
            <div className="flex gap-5 font-mono text-[11px] text-faint">
              <a
                href="https://github.com/maheepatel/Cellar"
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-brass"
              >
                Source
              </a>
              <a
                href="https://strk20.starknet.io"
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-brass"
              >
                STRK20
              </a>
              <span>Apache-2.0</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
