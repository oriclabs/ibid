/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './browser/**/*.{html,js}',
    './website/**/*.{html,js}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        saffron: {
          50:  '#fff9eb',
          100: '#fff0c6',
          200: '#ffe088',
          300: '#ffcb4a',
          400: '#ffb820',
          500: '#f49707',
          600: '#d87102',
          700: '#b34e06',
          800: '#913c0c',
          900: '#77320d',
          950: '#451802',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
