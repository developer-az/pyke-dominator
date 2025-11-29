/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'pyke-green': '#00ff9d',
        'pyke-green-dim': '#00cc7d',
        'pyke-dark': '#050a0e', // Obsidian
        'pyke-dark-light': '#0f1923', // Lighter Obsidian
        'pyke-accent': '#1e2d3b',
        'blood-red': '#ff4d4d',
        'gold': '#ffd700',
        'gold-dim': '#c5a000',
        'neon-blue': '#00f3ff',
      },
      fontFamily: {
        'display': ['Beaufort', 'serif'], // LoL style font if available, fallback to serif
      }
    },
  },
  plugins: [],
}
