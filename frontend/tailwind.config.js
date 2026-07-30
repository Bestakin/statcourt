/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        court: {
          bg: '#0F1B2D',      // deep navy, court at night
          surface: '#16263D', // card surface
          surface2: '#1E3350',
          line: '#2A4363',    // hairlines / dividers
        },
        ball: {
          DEFAULT: '#FF7A1A', // true basketball orange (not the AI-cliché terracotta)
          dim: '#B85812',
        },
        hardwood: '#C99A4B',  // secondary accent, warm gold-tan (used for team badges etc, NOT player 2)
        accent2: '#4FC3F7',   // Player 2's dedicated accent - cyan, high contrast against orange
        ink: {
          primary: '#F2F5F8',
          muted: '#8FA0B3',
          faint: '#5D7089',
        },
      },
      fontFamily: {
        display: ['"Oswald"', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
