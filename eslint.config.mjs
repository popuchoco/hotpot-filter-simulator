import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'tools/eval/out/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.browser }
  },
  {
    files: ['tools/**/*.mjs', 'tests/**/*.js', 'eslint.config.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node }
  },
  {
    // page.evaluate callbacks run in the browser
    files: ['tools/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } }
  },
  {
    files: ['tools/eval/bot.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'script', globals: globals.browser }
  }
];
