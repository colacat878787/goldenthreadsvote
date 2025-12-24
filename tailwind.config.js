/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          100: '#F9F1D0',
          200: '#F0E3A2',
          300: '#E6D474',
          400: '#D4AF37', // 標準金
          500: '#AA8C2C',
          600: '#806921',
          700: '#554616',
        },
        dark: {
          900: '#050505',
          800: '#0a0a0a',
        }
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #F0E3A2 0%, #D4AF37 50%, #806921 100%)',
        'luxury-dark': 'radial-gradient(circle at center, #1a1a1a 0%, #000000 100%)',
      },
      fontFamily: {
        sans: ['"Noto Sans TC"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}