import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#0E7A5F", deep: "#0B5E49" },
        gold: "#E4B15A",
        cream: "#F4F8F5",
        paper: "#E7F0EB",
        ink: "#10241C",
        forest: "#12352A",
        mute: "#5C6A64",
      },
      fontFamily: {
        display: ["var(--font-outfit)", "sans-serif"],
        sans: ["var(--font-inter)", "sans-serif"],
      },
      boxShadow: {
        card: "0 14px 36px rgba(16, 36, 28, 0.1)",
      },
    },
  },
  plugins: [],
};

export default config;
