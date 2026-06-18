/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        dark: { bg: '#0f0f1a', card: '#1a1a2e', border: '#2a2a3e', hover: '#252540' },
        accent: { primary: '#6366f1', success: '#22c55e', warning: '#f59e0b', danger: '#ef4444' },
      },
    },
  },
  plugins: [],
};
