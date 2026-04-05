import nextVitals from 'eslint-config-next/core-web-vitals'

const config = [
  ...nextVitals,
  {
    ignores: [
      'patches/**',
      'public/**',
    ],
  },
]

export default config
