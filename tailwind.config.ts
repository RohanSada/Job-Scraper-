import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "#0f1115",
        card: "#171a21",
        border: "#262b36",
        accent: "#6366f1",
      },
    },
  },
  plugins: [],
};

export default config;
