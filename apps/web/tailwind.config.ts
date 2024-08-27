import type { Config } from 'tailwindcss'
import { fontFamily } from 'tailwindcss/defaultTheme'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  variants: {
    extend: {
      backgroundColor: ['focus'],
    },
  },
  theme: {
    extend: {
      transitionProperty: {
        mw: 'max-width',
        m: 'margin',
      },
      typography: {
        DEFAULT: {
          css: {
            'code::before': { content: '""' },
            'code::after': { content: '""' },
          },
        },
      },
      fontFamily: {
        primary: ['Inter', ...fontFamily.sans],
        young_serif: ['"Young Serif"'],
        syne: ['"Syne"'],
        trap: ['"Trap"'],
      },
      animation: {
        flip: 'flip 6s infinite steps(2, end)',
        rotate: 'rotate 3s linear infinite both',
        'pulse-dark': 'pulse-dark 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        flip: {
          to: {
            transform: 'rotate(360deg)',
          },
        },
        rotate: {
          from: {
            transform: 'rotate(0deg)',
          },
          to: {
            transform: 'rotate(360deg)',
          },
        },
        'pulse-dark': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.5' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      colors: {
        'dashboard-gray': '#fafbfd',
        primary: {
          50: 'rgb(var(--tw-color-primary-50) / <alpha-value>)',
          100: 'rgb(var(--tw-color-primary-100) / <alpha-value>)',
          200: 'rgb(var(--tw-color-primary-200) / <alpha-value>)',
          300: 'rgb(var(--tw-color-primary-300) / <alpha-value>)',
          400: 'rgb(var(--tw-color-primary-400) / <alpha-value>)',
          500: 'rgb(var(--tw-color-primary-500) / <alpha-value>)',
          600: 'rgb(var(--tw-color-primary-600) / <alpha-value>)',
          700: 'rgb(var(--tw-color-primary-700) / <alpha-value>)',
          800: 'rgb(var(--tw-color-primary-800) / <alpha-value>)',
          900: 'rgb(var(--tw-color-primary-900) / <alpha-value>)',
          950: 'rgb(var(--tw-color-primary-950) / <alpha-value>)',
        },
        hunter: {
          50: 'rgb(var(--tw-color-hunter-green-50) / <alpha-value>)',
          100: 'rgb(var(--tw-color-hunter-green-100) / <alpha-value>)',
          200: 'rgb(var(--tw-color-hunter-green-200) / <alpha-value>)',
          300: 'rgb(var(--tw-color-hunter-green-300) / <alpha-value>)',
          400: 'rgb(var(--tw-color-hunter-green-400) / <alpha-value>)',
          500: 'rgb(var(--tw-color-hunter-green-500) / <alpha-value>)',
          600: 'rgb(var(--tw-color-hunter-green-600) / <alpha-value>)',
          700: 'rgb(var(--tw-color-hunter-green-700) / <alpha-value>)',
          800: 'rgb(var(--tw-color-hunter-green-800) / <alpha-value>)',
          900: 'rgb(var(--tw-color-hunter-green-900) / <alpha-value>)',
          950: 'rgb(var(--tw-color-hunter-green-950) / <alpha-value>)',
        },
        selago: {
          50: 'rgb(var(--tw-color-selago-50) / <alpha-value>)',
          100: 'rgb(var(--tw-color-selago-100) / <alpha-value>)',
          200: 'rgb(var(--tw-color-selago-200) / <alpha-value>)',
          300: 'rgb(var(--tw-color-selago-300) / <alpha-value>)',
          400: 'rgb(var(--tw-color-selago-400) / <alpha-value>)',
          500: 'rgb(var(--tw-color-selago-500) / <alpha-value>)',
          600: 'rgb(var(--tw-color-selago-600) / <alpha-value>)',
          700: 'rgb(var(--tw-color-selago-700) / <alpha-value>)',
          800: 'rgb(var(--tw-color-selago-800) / <alpha-value>)',
          900: 'rgb(var(--tw-color-selago-900) / <alpha-value>)',
          950: 'rgb(var(--tw-color-selago-950) / <alpha-value>)',
        },
        ceramic: {
          50: 'rgb(var(--tw-color-ceramic-50) / <alpha-value>)',
          100: 'rgb(var(--tw-color-ceramic-100) / <alpha-value>)',
          200: 'rgb(var(--tw-color-ceramic-200) / <alpha-value>)',
          300: 'rgb(var(--tw-color-ceramic-300) / <alpha-value>)',
          400: 'rgb(var(--tw-color-ceramic-400) / <alpha-value>)',
          500: 'rgb(var(--tw-color-ceramic-500) / <alpha-value>)',
          600: 'rgb(var(--tw-color-ceramic-600) / <alpha-value>)',
          700: 'rgb(var(--tw-color-ceramic-700) / <alpha-value>)',
          800: 'rgb(var(--tw-color-ceramic-800) / <alpha-value>)',
          900: 'rgb(var(--tw-color-ceramic-900) / <alpha-value>)',
          950: 'rgb(var(--tw-color-ceramic-950) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/typography')],
}
export default config
