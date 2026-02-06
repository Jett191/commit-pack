echo '
{
  "*.{js,jsx,ts,tsx,json,md}": ["eslint --fix", "prettier --write"]
}
' > .lintstagedrc