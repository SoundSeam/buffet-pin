import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        border: "hsl(var(--border))",
        primary: "hsl(var(--primary))",
        secondary: "hsl(var(--secondary))",
        muted: "hsl(var(--muted))",
        accent: "hsl(var(--accent))",
      },
      borderRadius: {
        // Source: the public order Review cart button originally used Tailwind rounded-lg (0.5rem / 8px).
        button: "var(--radius-button)",
        icon: "var(--radius-button-compact)",
        "button-group": "var(--radius-button-group)",
        surface: "var(--radius-surface)",
        "surface-lg": "var(--radius-surface-lg)",
      },
    },
  },
  plugins: [],
};

export default config;
