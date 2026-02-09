/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep purple-shifted backgrounds
        abyss: {
          950: '#08060e',
          900: '#0d0a17',
          800: '#150f24',
          700: '#1e1633',
          600: '#2a2044',
          500: '#382d56',
        },
        // Brighter violet accent
        amethyst: {
          50: '#f6f2ff',
          100: '#ede5ff',
          200: '#d9c8ff',
          300: '#c1a4ff',
          400: '#a87dff',
          500: '#9b5de5',
          600: '#8a3fd4',
          700: '#7b2ff7',
          800: '#6520c7',
          900: '#4f189a',
          950: '#2f0e6b',
        },
        // Metallic silver text
        silver: {
          50: '#f4f4f8',
          100: '#e8e8f0',
          200: '#d0d0dc',
          300: '#b8b8c8',
          400: '#9898a8',
          500: '#787890',
          600: '#606078',
          700: '#484860',
        },
        // Semantic colors
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2.5s ease-in-out infinite',
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-up': 'slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'bounce-dots': 'bounce-dots 1.4s infinite ease-in-out both',
        'shimmer': 'shimmer 2s linear infinite',
        'orb-drift-1': 'orb-drift-1 25s ease-in-out infinite alternate',
        'orb-drift-2': 'orb-drift-2 30s ease-in-out infinite alternate',
        'orb-drift-3': 'orb-drift-3 20s ease-in-out infinite alternate',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(155, 93, 229, 0.4)' },
          '50%': { boxShadow: '0 0 24px rgba(155, 93, 229, 0.7)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.6', boxShadow: '0 0 4px currentColor' },
          '50%': { opacity: '1', boxShadow: '0 0 12px currentColor' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'bounce-dots': {
          '0%, 80%, 100%': { transform: 'scale(0)' },
          '40%': { transform: 'scale(1)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'orb-drift-1': {
          '0%': { transform: 'translate(0, 0) scale(1)' },
          '100%': { transform: 'translate(60px, 40px) scale(1.1)' },
        },
        'orb-drift-2': {
          '0%': { transform: 'translate(0, 0) scale(1)' },
          '100%': { transform: 'translate(-50px, -30px) scale(1.05)' },
        },
        'orb-drift-3': {
          '0%': { transform: 'translate(0, 0) scale(1)' },
          '100%': { transform: 'translate(30px, -20px) scale(0.95)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
