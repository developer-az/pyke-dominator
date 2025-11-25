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
        'pyke-dark': '#0a1116',
        'pyke-accent': '#1e2d3b',
        'blood-red': '#ff4d4d',
      },
      fontFamily: {
        'display': ['Beaufort', 'serif'], // LoL style font if available, fallback to serif
      }
    },
  },
  plugins: [],
}
