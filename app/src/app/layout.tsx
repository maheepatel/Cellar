import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cellar — private yield on Starknet",
  description:
    "Shield an asset, earn real lending yield through a STRK20 anonymizer contract, and stay unlinkable.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
