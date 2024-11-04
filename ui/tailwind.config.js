// ui/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#F8FAFC',
        surface: '#FFFFFF',
        border: '#F1F5F9',
        text: {
          primary: '#334155',
          secondary: '#64748B',
          tertiary: '#94A3B8'
        }
      },
      boxShadow: {
        card: '0 0 50px 0 rgba(0,0,0,0.05)',
      },
      borderRadius: {
        '2xl': '1rem',
      }
    },
  },
  plugins: [],
}