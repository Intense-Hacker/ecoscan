export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Syne'", "sans-serif"],
        body: ["'DM Sans'", "sans-serif"],
      },
      colors: {
        forest: { 50:"#f0faf4", 100:"#dcf5e7", 200:"#bbe9cf", 300:"#86d4ad", 400:"#4ab882", 500:"#27a065", 600:"#1a8050", 700:"#166640", 800:"#145234", 900:"#11422b" },
        earth: { 50:"#fdf8f0", 100:"#faeedd", 200:"#f4d9b0", 300:"#ecbd76", 400:"#e09d3f", 500:"#d08020", 600:"#b86518", 700:"#984f16", 800:"#7c3f18", 900:"#653416" },
      }
    }
  },
  plugins: []
}
