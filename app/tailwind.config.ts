import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Subterranean ground — blue-slate, never pure black.
        ink: "#0B0D12",
        surface: "#12151C",
        raised: "#1A1E27",
        edge: "#242935",
        hairline: "#1A1E28",

        ash: "#E8EAEF", // primary text
        muted: "#98A0B0", // secondary
        faint: "#616A7C", // tertiary

        // Aged brass — the one accent. Cellar hardware, not gold.
        brass: "#C9963F",
        "brass-lit": "#E3B45F",
        "brass-dim": "#8A6A2E",

        // Semantic, deliberately separate from the accent.
        moss: "#5FA97A",
        rust: "#C86B57",
        steel: "#6E8CAE",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-ui)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      letterSpacing: {
        label: "0.14em",
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.03) inset, 0 12px 32px -18px rgba(0,0,0,0.9)",
        lifted: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 56px -24px rgba(0,0,0,1)",
      },
      backgroundImage: {
        "brass-edge":
          "linear-gradient(180deg, rgba(201,150,63,0.14) 0%, rgba(201,150,63,0) 60%)",
        vignette:
          "radial-gradient(120% 80% at 50% -10%, rgba(201,150,63,0.07) 0%, rgba(11,13,18,0) 70%)",
      },
      keyframes: {
        rise: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulse_dot: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        rise: "rise 0.5s cubic-bezier(0.16,1,0.3,1) both",
        "pulse-dot": "pulse_dot 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
