/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Il tuo mitico font Dimbo
        sans: ['Dimbo', 'sans-serif'], 
      },
      colors: {
        // Sovrascriviamo la palette del rosa con i colori esatti del tuo logo
        pink: {
          300: '#f5b0cf', // Rosa chiaro (usato per i testi e i bagliori tenui)
          400: '#f08dba', // Rosa medio (usato per i dettagli)
          500: '#eb6da5', // IL ROSA BASKETVILLE PRINCIPALE
          600: '#d14d88', // Rosa scuro (usato per l'ombra o l'hover)
        }
      }
    },
  },
  plugins: [],
}