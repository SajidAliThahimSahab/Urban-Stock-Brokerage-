/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: '#060912',
        navy: {
          950: '#080D1A',
          900: '#0B1224',
          800: '#101A33',
          700: '#16234A',
        },
        ink: '#E8EDF8',
        mute: '#98A5C2',
        dim: '#8794B3',
        line: 'rgba(148, 163, 208, 0.16)',
        'line-strong': 'rgba(148, 163, 208, 0.32)',
        volt: { DEFAULT: '#38D6FF', soft: '#7DE4FF' },
        iris: { DEFAULT: '#8B7BFF', soft: '#B0A6FF' },
        gain: '#2FE6A8',
        loss: '#FF6B86',
        amber: '#FFC94D',
        ember: '#FF8A5C',
      },
      fontFamily: {
        sans: ['Sora', '"Sora Fallback"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"JetBrains Mono Fallback"', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        indeterminate: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(250%)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        indeterminate: 'indeterminate 1.1s ease-in-out infinite',
      },
    },
  },
  // Unused utility families removed: they only add the universal *,::before,::after
  // --tw-* variable block that every element must style-resolve on mobile.
  corePlugins: {
    filter: false, blur: false, brightness: false, contrast: false, dropShadow: false,
    grayscale: false, hueRotate: false, invert: false, saturate: false, sepia: false,
    backdropFilter: false, backdropBlur: false, backdropBrightness: false, backdropContrast: false,
    backdropGrayscale: false, backdropHueRotate: false, backdropInvert: false,
    backdropOpacity: false, backdropSaturate: false, backdropSepia: false,
    scrollSnapType: false, scrollSnapAlign: false, scrollSnapStop: false,
    skew: false, fontVariantNumeric: false, touchAction: false,
  },
  plugins: [],
};
