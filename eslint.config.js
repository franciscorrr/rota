import pluginVue from 'eslint-plugin-vue';

const browserGlobals = {
  document: 'readonly',
  window: 'readonly',
  localStorage: 'readonly',
  Blob: 'readonly',
  URL: 'readonly',
  FileReader: 'readonly',
  confirm: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
};

export default [
  { ignores: ['node_modules/**', 'dist/**'] },
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.js', '**/*.vue'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: browserGlobals,
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'multi-line'],
      // Employee names are user input: no unescaped HTML.
      'vue/no-v-html': 'error',
      // Styles and attribute order are decided by the project format, not by the linter.
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/html-indent': 'off',
      'vue/multiline-html-element-content-newline': 'off',
    },
  },
  {
    // Browser tests and their configuration: they run in Node (page code uses browser globals).
    files: ['e2e/**/*.js', 'playwright.config.js'],
    languageOptions: {
      globals: { process: 'readonly', Buffer: 'readonly' },
    },
  },
];
