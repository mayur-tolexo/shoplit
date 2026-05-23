import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "var(--ink)",
        cream: "var(--cream)",
        paper: "var(--paper)",
        rule: "var(--rule)",
        muted: "var(--muted)",
        accent: "var(--accent)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "var(--font-noto-deva)", "ui-sans-serif", "system-ui"],
        serif: ["var(--font-fraunces)", "Georgia", "serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        xs:   ["0.75rem",   { lineHeight: "1.125rem" }],
        sm:   ["0.875rem",  { lineHeight: "1.375rem" }],
        base: ["1rem",      { lineHeight: "1.625rem" }],
        lg:   ["1.25rem",   { lineHeight: "1.875rem" }],
        xl:   ["1.5625rem", { lineHeight: "2.25rem"  }],
        "2xl":["1.9375rem", { lineHeight: "2.5rem"   }],
        "3xl":["2.4375rem", { lineHeight: "2.875rem" }],
        "4xl":["3.0625rem", { lineHeight: "3.5rem"   }],
        "5xl":["3.8125rem", { lineHeight: "4.25rem"  }],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
