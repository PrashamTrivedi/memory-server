/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{tsx,ts,html}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        // Claude.ai color palette
        claude: {
          cream: '#FAF9F6',
          beige: '#F5F4F0',
          coral: '#DA7756',
          'coral-hover': '#C4654A',
          'coral-light': '#FDEEE9',
          text: '#1A1915',
          'text-secondary': '#6B6B5F',
          border: '#E5E4E0',
          // Dark mode
          dark: '#2D2B28',
          'dark-card': '#3D3B37',
          'dark-border': '#4D4B47',
          'dark-text': '#EDEDEC',
          'dark-text-secondary': '#A5A59A',
        }
      },
      borderRadius: {
        'claude': '12px',
      },
      boxShadow: {
        'claude': '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
        'claude-hover': '0 4px 6px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
      }
    }
  },
  plugins: []
};
