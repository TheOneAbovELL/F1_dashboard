/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        f1: {
          void: '#06060B',
          dark: '#0A0A11',
          panel: '#101018',
          raised: '#16161F',
          border: '#1F1F2E',
          line: '#2A2A3C',
          text: '#E9E9F2',
          dim: '#7C7C96',
          dimmer: '#4B4B63',
          red: '#E10600',
          green: '#2BD47D',
          yellow: '#FFD54A',
          purple: '#B14BFF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 2.6s cubic-bezier(0.4,0,0.6,1) infinite',
      },
    },
  },
  plugins: [],
};
