// @ts-check

import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'dist/**', 'node_modules/**'],
  },

  eslint.configs.recommended,

  ...tseslint.configs.recommendedTypeChecked,

  eslintPluginPrettierRecommended,

  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },

      sourceType: 'commonjs',

      parserOptions: {
        projectService: true,

        // @ts-ignore
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    rules: {
      /*
      |--------------------------------------------------------------------------
      | PRACTICAL TYPESCRIPT RULES
      |--------------------------------------------------------------------------
      | Strict enough to keep code clean
      | Relaxed enough to actually build products
      |--------------------------------------------------------------------------
      */

      '@typescript-eslint/no-explicit-any': 'off',

      '@typescript-eslint/no-floating-promises': 'warn',

      /*
      |--------------------------------------------------------------------------
      | DISABLE OVERLY AGGRESSIVE "UNSAFE" RULES
      |--------------------------------------------------------------------------
      | These explode with:
      | - Gemini SDK
      | - Prisma
      | - Mongoose
      | - External APIs
      | - AI SDKs
      |--------------------------------------------------------------------------
      */

      '@typescript-eslint/no-unsafe-assignment': 'off',

      '@typescript-eslint/no-unsafe-call': 'off',

      '@typescript-eslint/no-unsafe-member-access': 'off',

      '@typescript-eslint/no-unsafe-return': 'off',

      '@typescript-eslint/no-unsafe-argument': 'off',

      /*
      |--------------------------------------------------------------------------
      | PRETTIER
      |--------------------------------------------------------------------------
      */

      'prettier/prettier': [
        'error',
        {
          endOfLine: 'auto',
        },
      ],
    },
  },
);