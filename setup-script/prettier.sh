echo '
{
  "singleQuote": true,
  "printWidth": 100,
  "jsxSingleQuote": true,
  "bracketSameLine": true,
  "semi": false,
  "tabWidth": 2,
  "bracketSpacing": true,
  "trailingComma": "none"
}
' > .prettierrc

echo '
node_modules/

README.md

.cz-config.js
' > .prettierignore