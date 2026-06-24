import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#111315",
        panel: "#181B1F",
        line: "#2A3037",
        mint: "#5EEAD4",
        coral: "#FB7185",
        gold: "#FBBF24",
      },
      boxShadow: {
        soft: "0 18px 60px rgba(0, 0, 0, 0.24)",
      },
    },
  },
  plugins: [],
};

export default config;
