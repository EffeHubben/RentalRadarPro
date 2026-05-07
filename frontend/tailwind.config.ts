import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#090a0c",
        panel: "#111317",
        line: "#262b31",
        cream: "#f6f1e7",
        brass: "#d7a84f",
        mint: "#6ee7b7",
        aurora: "#22d3ee",
        deepsea: "#07111f",
        ember: "#fb7185",
        danger: "#f87171",
      },
      boxShadow: {
        premium: "var(--shadow-premium)",
        cinematic:
          "var(--shadow-premium)",
      },
    },
  },
  plugins: [],
};

export default config;
