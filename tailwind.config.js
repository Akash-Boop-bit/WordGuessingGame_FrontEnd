/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        space: {
          900: '#0a0a0f',
          800: '#12121e',
          700: '#1a1a2e',
        },
        neon: {
          cyan: '#00f2ff',
          red: '#ff003c',
          purple: '#bc13fe',
        }
      },
      backgroundImage: {
        'stars': "url('https://www.transparenttextures.com/patterns/stardust.png')",
      }
    },
  },
  plugins: [],
}
