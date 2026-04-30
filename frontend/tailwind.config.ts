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
        danger: "#f87171",
      },
      boxShadow: {
        premium: "0 18px 70px rgba(0, 0, 0, 0.42)",
      },
    },
  },
  plugins: [],
};

export default config;
