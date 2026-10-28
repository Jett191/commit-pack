echo '#!/usr/bin/env sh
set -e

# Git hooks run from the repository root. Resolve the hook file parent so
# workspace-specific hooks run with the workspace as their working directory.
HOOK_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$HOOK_DIR/.."

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

HOOK_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$HOOK_DIR/.."

if [ -n "$PNPM_PACKAGE_NAME" ]; then
  # 在工作空间环境中运行 pnpm 命令
  pnpm exec -- commitlint --edit "$1"
else
  # 在普通环境中运行
  npx --no -- commitlint --edit "$1"
fi
' > .husky/commit-msg

chmod +x .husky/commit-msg
