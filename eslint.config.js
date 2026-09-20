import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'
import globals from 'globals'

export default tseslint.config(
  // Vue 3 essential rules (sets vue-eslint-parser for .vue files)
  ...pluginVue.configs['flat/essential'],

  // TypeScript recommended rules
  ...tseslint.configs.recommended,

  // Global language options
  {
    languageOptions: {
      globals: {
        ...globals.node,
        Twitch: 'readonly',
      },
    },
  },

  // TypeScript parser for <script> blocks in .vue files
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },

  // Project rules
  {
    rules: {
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    },
  },

  // Prettier must be last — disables style rules that conflict
  prettierConfig,
)
