import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  features: {
    stylistic: true,
    tooling: true,
    formatters: true,
  },
  rules: {
    'vue/no-multiple-template-root': 'off',
  }
})
