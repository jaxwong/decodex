/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        shopee: '#ee4d2d', // Add your custom color here
        shopee2: '#ff7337', // Add your custom color here
        blue: '#0055aa',
      }
    },
  },
  plugins: [],
}

