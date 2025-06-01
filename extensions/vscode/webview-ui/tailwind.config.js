/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class", "[data-theme='dark']"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  important: true,
  theme: {
    
  },
  plugins: [require("tailwindcss-animate"), require('tailwind-scrollbar')],
};
