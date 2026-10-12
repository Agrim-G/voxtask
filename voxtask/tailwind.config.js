/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0f1011',
          900: '#151617',
          850: '#1a1b1d',
          800: '#1f2123',
          700: '#2a2c2f',
          600: '#3a3d41',
        },
      },
    },
  },
  plugins: [],
};
