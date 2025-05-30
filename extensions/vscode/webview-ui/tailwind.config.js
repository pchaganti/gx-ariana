/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class", "[data-theme='dark']"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    
  },
  plugins: [require("tailwindcss-animate"), require('tailwind-scrollbar')],
};
