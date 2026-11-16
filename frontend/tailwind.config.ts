import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1440px" }
    },
    extend: {
      colors: {
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)"
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)"
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)"
        },
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)"
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)"
        },
        brand: {
          indigo: "#4F46E5",
          violet: "#7C3AED",
          purple: "#9333EA",
          fuchsia: "#D946EF",
          pink: "#EC4899",
          rose: "#F43F5E",
          orange: "#FB923C",
          amber: "#F59E0B",
          lime: "#84CC16",
          emerald: "#10B981",
          teal: "#14B8A6",
          cyan: "#06B6D4",
          sky: "#0EA5E9",
          blue: "#3B82F6"
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-sora)", "var(--font-inter)", "ui-sans-serif", "sans-serif"]
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem"
      },
      boxShadow: {
        soft: "0 4px 24px -8px rgba(24, 16, 56, 0.12)",
        card: "0 18px 50px -24px rgba(49, 32, 110, 0.32)",
        float: "0 30px 80px -30px rgba(79, 70, 229, 0.45)",
        glow: "0 0 0 1px rgba(255,255,255,0.08), 0 20px 60px -15px rgba(124, 58, 237, 0.55)",
        "inner-glow": "inset 0 1px 0 0 rgba(255,255,255,0.12)"
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #4F46E5 0%, #7C3AED 35%, #D946EF 70%, #FB923C 100%)",
        "brand-gradient-soft": "linear-gradient(135deg, rgba(79,70,229,0.14), rgba(217,70,239,0.12), rgba(251,146,60,0.12))",
        "aurora": "radial-gradient(60% 70% at 8% 8%, rgba(99,102,241,0.28) 0%, rgba(99,102,241,0) 60%), radial-gradient(55% 60% at 92% 12%, rgba(217,70,239,0.24) 0%, rgba(217,70,239,0) 60%), radial-gradient(50% 65% at 55% 100%, rgba(20,184,166,0.22) 0%, rgba(20,184,166,0) 65%)",
        "grid-fade": "linear-gradient(to right, rgba(120,110,180,0.09) 1px, transparent 1px), linear-gradient(to bottom, rgba(120,110,180,0.09) 1px, transparent 1px)",
        "shine": "linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.35) 50%, transparent 75%)"
      },
      keyframes: {
        aurora: {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)", opacity: "0.8" },
          "50%": { transform: "translate3d(2%, -3%, 0) scale(1.08)", opacity: "1" }
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" }
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(124,58,237,0.35)" },
          "50%": { boxShadow: "0 0 0 12px rgba(124,58,237,0)" }
        },
        "spin-slow": {
          to: { transform: "rotate(360deg)" }
        }
      },
      animation: {
        aurora: "aurora 18s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
        "fade-up": "fade-up 0.5s ease-out both",
        shimmer: "shimmer 2.5s linear infinite",
        "pulse-glow": "pulse-glow 2.5s ease-in-out infinite",
        "spin-slow": "spin-slow 8s linear infinite"
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
};

export default config;
