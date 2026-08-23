import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0F1116",
        panel: "#171A21",
        edge: "#2A2F3A",
        muted: "#8A92A3",
        brass: "#C08A3E",
        moss: "#5FA97A",
        rust: "#C86B57",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
