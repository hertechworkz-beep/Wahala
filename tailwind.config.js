/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#08090D',
        frame: '#0B0C10',
        money: '#10B981',
        clout: '#F43F5E',
        flag: '#EF4444',
        gold: '#F59E0B',
        ink: '#F5F1E8',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
