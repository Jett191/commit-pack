set -e

# Resolve commands using the package manager chosen during initialization.
# npm uses the local PATH directly: hooks must never download tools.
case "${COMMIT_PACK_PM:-npm}" in
  pnpm) runner="pnpm exec " ;;
  yarn) runner="yarn exec " ;;
  bun) runner="bun run " ;;
  *) runner="" ;;
esac

for hook in pre-commit commit-msg; do
  cat > ".husky/$hook" << 'EOF'
#!/usr/bin/env sh
set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
HOOK_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$HOOK_DIR/.."
PATH="$PWD/node_modules/.bin:$REPO_ROOT/node_modules/.bin:$PATH"
export PATH
EOF
  if [ "$hook" = pre-commit ]; then
    printf '%slint-staged --config .lintstagedrc\n' "$runner" >> ".husky/$hook"
  else
    printf '%scommitlint --edit "$1"\n' "$runner" >> ".husky/$hook"
  fi
  chmod +x ".husky/$hook"
done
