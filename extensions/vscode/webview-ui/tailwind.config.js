/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class", "[data-theme='dark']"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Semantic color roles based on VS Code variables
        vscode: {
          // Core colors
          background: 'var(--vscode-background, #1e1e1e)', // Default to dark theme
          foreground: 'var(--vscode-foreground, #cccccc)', // Text color
          // Primary color (e.g., buttons)
          primary: {
            500: 'var(--vscode-button-background, oklch(65% 0.15 200))', // Base (~#007acc)
            400: 'oklch(70% 0.15 200)', // Lighter for hover/focus
            600: 'oklch(60% 0.15 200)', // Darker for active
            300: 'oklch(75% 0.15 200)', // Even lighter
            700: 'oklch(55% 0.15 200)', // Even darker
          },
          // Secondary color (e.g., secondary buttons, muted elements)
          secondary: {
            500: 'var(--vscode-button-secondaryBackground, oklch(60% 0.1 220))', // Base (~#5f6a79)
            400: 'oklch(65% 0.1 220)',
            600: 'oklch(55% 0.1 220)',
            300: 'oklch(70% 0.1 220)',
            700: 'oklch(50% 0.1 220)',
          },
          // Accent color (e.g., borders, highlights)
          accent: {
            500: 'var(--vscode-focusBorder, oklch(65% 0.15 200))', // Base (~#007acc)
            400: 'oklch(70% 0.15 200)',
            600: 'oklch(60% 0.15 200)',
          },
          // Error color
          error: {
            500: 'var(--vscode-errorForeground, oklch(70% 0.2 25))', // Base (~#ff5555)
            400: 'oklch(75% 0.2 25)',
            600: 'oklch(65% 0.2 25)',
          },
          // Warning color
          warning: {
            500: 'var(--vscode-editorWarning-foreground, oklch(75% 0.2 60))', // Base (~#ffaa00)
            400: 'oklch(80% 0.2 60)',
            600: 'oklch(70% 0.2 60)',
          },
        },
        // Fallback themes for light/dark modes
        light: {
          primary: 'oklch(65% 0.15 200)', // ~#007acc
          text: 'oklch(30% 0.05 220)', // ~#333333
          background: 'oklch(98% 0.02 200)', // ~#ffffff
        },
        dark: {
          primary: 'oklch(70% 0.15 200)', // ~#1e90ff
          text: 'oklch(90% 0.05 220)', // ~#ffffff
          background: 'oklch(20% 0.05 220)', // ~#1e1e1e
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require('tailwind-scrollbar')],
};
