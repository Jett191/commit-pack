set -e
cat > eslint.config.mjs << 'EOF'
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/lib/**', '**/coverage/**', '**/.husky/**'] },
  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } }
    }
  },
  { files: ['**/*.{ts,tsx,mts,cts}'], extends: [tseslint.configs.recommended] },
  prettier
)
EOF
