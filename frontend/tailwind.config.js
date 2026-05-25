/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'cute-bg': '#FAF8F5',
        'macaron-pink': '#FFD1DC',
        'macaron-mint': '#C2F2D0',
        'macaron-yellow': '#FFF2B2',
        'warm-orange': '#FFB87A'
      },
      borderRadius: {
        'cute': '20px',
        'super-cute': '30px'
      },
      boxShadow: {
        'cute': '0 4px 14px 0 rgba(255, 184, 122, 0.1)',
      }
    },
  },
  plugins: [],
}
