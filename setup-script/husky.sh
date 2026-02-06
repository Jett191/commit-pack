echo '#!/usr/bin/env sh
set -e
if [ -n "$PNPM_PACKAGE_NAME" ]; then
  # 在工作空间环境中运行 pnpm 命令
  pnpm exec lint-staged
else
  # 在普通环境中运行
  npx lint-staged
fi
' > .husky/pre-commit

chmod +x .husky/pre-commit

echo '#!/usr/bin/env sh
set -e
if [ -n "$PNPM_PACKAGE_NAME" ]; then
  # 在工作空间环境中运行 pnpm 命令
  pnpm exec -- commitlint --edit "$1"
else
  # 在普通环境中运行
  npx --no -- commitlint --edit "$1"
fi
' > .husky/commit-msg

chmod +x .husky/commit-msg