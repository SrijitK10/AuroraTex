/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/renderer/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // One Dark Pro palette mapped to Tailwind gray scale
        gray: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          // --- Dark mode shades map to One Dark Pro ---
          600: '#5c6370',   // comment / muted text
          700: '#3e4451',   // selection / subtle borders
          800: '#2c313a',   // lighter surface
          900: '#282c34',   // main background
          950: '#21252b',   // deepest background
        },
      }
    },
  },
  plugins: [],
}
