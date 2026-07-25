/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // This line is crucial! It tells Tailwind to scan your components
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F0FDFA',
          500: '#14B8A6',
          600: '#0D9488',
          900: '#134E4A',
        },
        emergency: '#DC2626',
      },
    },
  },
  plugins: [],
}