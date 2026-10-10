import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#0A0E17',
          surface: '#111827',
          elevated: '#1E293B',
        },
        border: {
          subtle: '#1E293B',
          focus: '#6366F1',
        },
        primary: {
          DEFAULT: '#6366F1',
          hover: '#4F46E5',
        },
        accent: {
          cyan: '#06B6D4',
          violet: '#8B5CF6',
        },
        status: {
          draft: '#64748B',
          submitted: '#3B82F6',
          pending: '#F59E0B',
          approved: '#10B981',
          rejected: '#EF4444',
        },
        text: {
          primary: '#F8FAFC',
          secondary: '#94A3B8',
          muted: '#64748B',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'display': ['2.25rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'h1': ['1.75rem', { lineHeight: '1.2', fontWeight: '600' }],
        'h2': ['1.25rem', { lineHeight: '1.3', fontWeight: '500' }],
        'body': ['0.875rem', { lineHeight: '1.6' }],
        'caption': ['0.75rem', { lineHeight: '1.5', fontWeight: '400' }],
      },
      borderRadius: {
        'card': '0.75rem',
        'button': '0.5rem',
        'input': '0.375rem',
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.3), 0 1px 2px -1px rgb(0 0 0 / 0.3)',
        'card-hover': '0 10px 25px -5px rgb(0 0 0 / 0.4), 0 8px 10px -6px rgb(0 0 0 / 0.3)',
        'primary': '0 4px 14px 0 rgb(99 102 241 / 0.3)',
        'focus': '0 0 0 2px #6366F1',
      },
      animation: {
        'fade-in': 'fadeIn 150ms ease-out',
        'slide-up': 'slideUp 150ms ease-out',
        'scale-in': 'scaleIn 150ms ease-out',
        'skeleton': 'skeleton 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        skeleton: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      transitionDuration: {
        'fast': '150ms',
        'normal': '200ms',
      },
      transitionTimingFunction: {
        'ease-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      backdropBlur: {
        'card': '12px',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'login-glow': 'radial-gradient(ellipse at top, #1e1b4b 0%, #0a0e17 70%)',
      },
    },
  },
  plugins: [],
}

export default config