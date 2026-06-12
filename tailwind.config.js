/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['Manrope', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // ── brand palette ──
        ink:    '#3d1f6e',   // deep purple (replaces old near-black)
        rose:   '#c8788a',
        purple: '#6b3fa0',
        cream:  '#fdf8f5',
        blush:  '#f8e4ea',
      },
      animation: {
        'fade-up':   'fadeUp 0.5s ease both',
        'spin-slow': 'spin 1.8s linear infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(18px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
