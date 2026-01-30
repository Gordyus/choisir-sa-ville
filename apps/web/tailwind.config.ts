import type { Config } from "tailwindcss";

const config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#1b4d3e",
          light: "#2f6b57",
          dark: "#0f2d24"
        }
      }
    }
  },
  plugins: []
} satisfies Config;

export default config;
