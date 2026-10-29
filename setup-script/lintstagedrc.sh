echo '
{
  "*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}": ["eslint --fix", "prettier --write"]
}
' > .lintstagedrc
