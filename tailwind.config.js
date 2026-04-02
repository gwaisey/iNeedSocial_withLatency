/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: "#27262F",
        mist: "#F5F4FB",
        haze: "#7C7995",
        dusk: "#3E3D4A",
        signal: "#C83C53",
        violet: "#776DFF",
        // Semantic aliases for easier use
        "brand-primary": "#776DFF",
        "brand-accent": "#C83C53",
      },
      fontFamily: {
        poppins: ["Poppins", "sans-serif"],
        sans: ["Poppins", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        phone: "0 30px 90px rgba(18, 17, 25, 0.24)",
        card: "0 2px 12px rgba(39, 38, 47, 0.08)",
        "card-hover": "0 8px 24px rgba(39, 38, 47, 0.12)",
        sidebar: "2px 0 16px rgba(39, 38, 47, 0.06)",
      },
      backgroundImage: {
        "app-radial":
          "radial-gradient(circle at 50% 24%, #3E3D4A 0%, #57556A 38%, #7C7995 100%)",
        "page-light":
          "radial-gradient(circle at top, rgba(124, 121, 149, 0.18), transparent 40%), linear-gradient(180deg, #F7F4FB 0%, #EBE7F6 100%)",
        "page-dark":
          "linear-gradient(160deg, #27262F 0%, #3E3D4A 100%)",
      },
      screens: {
        // Default Tailwind breakpoints are fine, but we can add custom ones
        xs: "375px",
      },
      maxWidth: {
        feed: "470px",
        sidebar: "280px",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(16px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
    },
  },
  plugins: [],
}
