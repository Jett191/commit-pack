# commit-pack

自动化的项目代码质量和提交标准化设置。集成 ESLint、Prettier、Husky、lint-staged、commitlint 和 commitizen，强制执行一致的代码风格和标准化的提交消息。

## ✨ 特性

- **代码质量**: 集成 ESLint，支持 TypeScript 解析器和推荐配置
- **代码格式化**: Prettier 带有预设的格式化规则
- **Git 钩子**: Husky 驱动的提交前和提交消息验证
- **暂存文件**: lint-staged 只对暂存文件运行检查
- **提交验证**: commitlint 确保符合常规提交格式
- **交互式提交**: commitizen 提供引导式提交创建
- **多包管理器**: 支持 pnpm、npm、yarn 和 bun
- **支持 Monorepo**: 使用 `-w` 标志处理基于工作区的项目
- **安全回滚**: 初始化失败时自动回滚

## 🚀 快速开始

### 安装
```bash
# 使用 pnpm
pnpm add -D commit-pack@latest
```

```bash
# 使用 bun
bun add -d commit-pack@latest
```

```bash
# 使用 npm
npm install -D commit-pack@latest
```

```bash
# 使用 yarn
yarn add -D commit-pack@latest
```

### 初始化
```bash
# 在项目根目录初始化
pnpm exec commit-pack-init
```

```bash
# 使用 bun
bunx commit-pack-init
```

```bash
# 使用 npx
npx commit-pack-init
```

```bash
# 使用 yarn
yarn dlx commit-pack-init
```

### Monorepo 支持
```bash
# 为 monorepo 中的特定工作区初始化
pnpm exec commit-pack-init -w workspace-name
# 或
pnpm exec commit-pack-init --workspace=workspace-name
```

## 🛠️ 包含的内容

### ESLint 配置
- 支持 TypeScript 的 `@typescript-eslint/parser`
- 推荐的 TypeScript 规则
- 与 Prettier 的集成以避免冲突
- 适用于 monorepo 的根配置

**.eslintrc**
```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "prettier"
  ],

  "plugins": [
    "@typescript-eslint",
    "prettier"
  ],

  "rules": {
    "prettier/prettier": "error",
    "arrow-body-style": "off",
    "prefer-arrow-callback": "off"
  }
}
```

### Prettier 配置
- 字符串使用单引号
- 打印宽度为 100 个字符
- 不使用分号
- 支持 Tailwind CSS 插件
- 一致的间距和格式

**.prettierrc**
```json
{
  "singleQuote": true,
  "printWidth": 100,
  "jsxSingleQuote": true,
  "bracketSameLine": true,
  "semi": false,
  "plugins": ["prettier-plugin-tailwindcss"],
  "tabWidth": 2,
  "bracketSpacing": true,
  "trailingComma": "none"
}
```

### Commitlint 配置
- 强制执行常规提交格式
- 自定义表情符号前缀的提交类型
- 范围验证
- 详细的提交消息结构

**.commitlintrc.json**
```json
{
  "extends": ["@commitlint/config-conventional"],
  "parserPreset": {
    "parserOpts": {
      "headerPattern": "^(.+?)\\((.+?)\\): (.+)$",
      "headerCorrespondence": ["type", "scope", "subject"]
    }
  },
  "rules": {
    "scope-empty": [2, "never"],
    "type-enum": [
      2,
      "always",
      [
        "✨ feat",
        "🐛 fix",
        "🎉 init",
        "✏️ docs",
        "💄 style",
        "♻️ refactor",
        "⚡️ perf",
        "✅ test",
        "⏪️ revert",
        "📦 build",
        "🚀 chore",
        "👷 ci"
      ]
    ]
  }
}
```

### Commitizen 配置
- 交互式提交界面
- 预定义的表情符号提交类型
- 可自定义范围
- 引导式提交消息创建

**.cz-config.js**
```js
module.exports = {
  types: [
    { value: "✨ feat", name: "  ✨  feat: 新功能" },
    { value: "🐛 fix", name: "  🐛 fix: 修复bug" },
    { value: "🎉 init", name: "  🎉 init: 初始化" },
    { value: "✏️ docs", name: "  ✏️ docs: 文档变更" },
    { value: "💄 style", name: "  💄 style: 更改样式" },
    { value: "♻️ refactor", name: "  ♻️ refactor: 重构" },
    { value: "⚡️ perf", name: "  ⚡️ perf: 性能优化" },
    { value: "✅ test", name: "  ✅  test: 测试" },
    { value: "⏪️ revert", name: "  ⏪️ revert: 回退" },
    { value: "📦 build", name: "  📦 build: 打包" },
    { value: "🚀 chore", name: "  🚀 chore: 构建/工程依赖/工具" },
    { value: "👷 ci", name: "  👷 ci: CI related changes" },
  ],

  scopes: [
    { name: "components" },
    { name: "page" },
    { name: "css" },
    { name: "api" },
    { name: "README.md" },
    { name: "custom" },
  ],

  messages: {
    type: "请选择提交类型(必填)",
    scope: "请选择文件修改范围(必填):",
    customScope: "请输自定义文件修改范围(必填)",
    subject: "请简要描述提交(必填)",
    body: "请输入详细描述(可选)",
    breaking: "列出任何breaking changes(可选)",
    footer: "请输入要关闭的issue(可选)",
    confirmCommit: "确定提交吗",
  },

  allowCustomScopes: true,
  allowBreakingChanges: ["✨ feat", "🐛 fix"],
  subjectLimit: 49,
};
```

## 📋 可用脚本

初始化后，以下脚本将被添加到您的 `package.json` 中：

- `lint`: 对所有 TypeScript/JavaScript/JSON 文件运行 ESLint
- `format`: 使用 Prettier 格式化所有文件
- `commit`: 使用 commitizen 进行交互式提交

## 🤝 贡献

1. Fork 仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 进行修改
4. 运行 linter (`pnpm run lint`) 和格式化 (`pnpm run format`)
5. 使用 commitizen 界面提交更改 (`pnpm run commit`)
6. 推送到分支 (`git push origin feature/amazing-feature`)
7. 创建 Pull Request

## ©️ 许可证

此项目根据 MIT 许可证授权 - 详见 [LICENSE](LICENSE) 文件。

---

# commit-pack

Automated project setup for code quality and commit standardization. Integrates ESLint, Prettier, Husky, lint-staged, commitlint, and commitizen to enforce consistent code style and standardized commit messages.

## ✨ Features

- **Code Quality**: Integrates ESLint with TypeScript parser and recommended configs
- **Code Formatting**: Prettier with opinionated formatting rules
- **Git Hooks**: Husky-powered pre-commit and commit-message validation
- **Staged Files**: lint-staged runs checks only on staged files
- **Commit Validation**: commitlint ensures conventional commit format
- **Interactive Commits**: commitizen provides guided commit creation
- **Multi-Package Manager**: Supports pnpm, npm, yarn, and bun
- **Monorepo Ready**: Handles workspace-based projects with `-w` flag
- **Rollback Safe**: Automatic rollback if initialization fails

## 🚀 Quick Start

### Installation
```bash
# Using pnpm
pnpm add -D commit-pack@latest
```

```bash
# Using bun
bun add -d commit-pack@latest
```

```bash
# Using npm
npm install -D commit-pack@latest
```

```bash
# Using yarn
yarn add -D commit-pack@latest
```

### Initialization
```bash
# Initialize in the root of your project
pnpm exec commit-pack-init
```

```bash
# Using bun
bunx commit-pack-init
```

```bash
# Using npx
npx commit-pack-init
```

```bash
# Using yarn
yarn dlx commit-pack-init
```

### Monorepo Support
```bash
# Initialize for a specific workspace in monorepo
pnpm exec commit-pack-init -w workspace-name
# or
pnpm exec commit-pack-init --workspace=workspace-name
```

## 🛠️ What's Included

### ESLint Configuration
- TypeScript support with `@typescript-eslint/parser`
- Recommended TypeScript rules
- Integration with Prettier to avoid conflicts
- Root configuration to work in monorepos

**.eslintrc**
```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "prettier"
  ],

  "plugins": [
    "@typescript-eslint",
    "prettier"
  ],

  "rules": {
    "prettier/prettier": "error",
    "arrow-body-style": "off",
    "prefer-arrow-callback": "off"
  }
}
```

### Prettier Configuration
- Single quotes for strings
- Print width of 100 characters
- No semicolons
- Tailwind CSS plugin support
- Consistent spacing and formatting

**.prettierrc**
```json
{
  "singleQuote": true,
  "printWidth": 100,
  "jsxSingleQuote": true,
  "bracketSameLine": true,
  "semi": false,
  "plugins": ["prettier-plugin-tailwindcss"],
  "tabWidth": 2,
  "bracketSpacing": true,
  "trailingComma": "none"
}
```

### Commitlint Configuration
- Enforces conventional commit format
- Custom emoji-prefixed commit types
- Scope validation
- Detailed commit message structure

**.commitlintrc.json**
```json
{
  "extends": ["@commitlint/config-conventional"],
  "parserPreset": {
    "parserOpts": {
      "headerPattern": "^(.+?)\\((.+?)\\): (.+)$",
      "headerCorrespondence": ["type", "scope", "subject"]
    }
  },
  "rules": {
    "scope-empty": [2, "never"],
    "type-enum": [
      2,
      "always",
      [
        "✨ feat",
        "🐛 fix",
        "🎉 init",
        "✏️ docs",
        "💄 style",
        "♻️ refactor",
        "⚡️ perf",
        "✅ test",
        "⏪️ revert",
        "📦 build",
        "🚀 chore",
        "👷 ci"
      ]
    ]
  }
}
```

### Commitizen Configuration
- Interactive commit interface
- Predefined commit types with emojis
- Customizable scopes
- Guided commit message creation

**.cz-config.js**
```js
module.exports = {
  types: [
    { value: "✨ feat", name: "  ✨  feat: 新功能" },
    { value: "🐛 fix", name: "  🐛 fix: 修复bug" },
    { value: "🎉 init", name: "  🎉 init: 初始化" },
    { value: "✏️ docs", name: "  ✏️ docs: 文档变更" },
    { value: "💄 style", name: "  💄 style: 更改样式" },
    { value: "♻️ refactor", name: "  ♻️ refactor: 重构" },
    { value: "⚡️ perf", name: "  ⚡️ perf: 性能优化" },
    { value: "✅ test", name: "  ✅  test: 测试" },
    { value: "⏪️ revert", name: "  ⏪️ revert: 回退" },
    { value: "📦 build", name: "  📦 build: 打包" },
    { value: "🚀 chore", name: "  🚀 chore: 构建/工程依赖/工具" },
    { value: "👷 ci", name: "  👷 ci: CI related changes" },
  ],

  scopes: [
    { name: "components" },
    { name: "page" },
    { name: "css" },
    { name: "api" },
    { name: "README.md" },
    { name: "custom" },
  ],

  messages: {
    type: "请选择提交类型(必填)",
    scope: "请选择文件修改范围(必填):",
    customScope: "请输自定义文件修改范围(必填)",
    subject: "请简要描述提交(必填)",
    body: "请输入详细描述(可选)",
    breaking: "列出任何breaking changes(可选)",
    footer: "请输入要关闭的issue(可选)",
    confirmCommit: "确定提交吗",
  },

  allowCustomScopes: true,
  allowBreakingChanges: ["✨ feat", "🐛 fix"],
  subjectLimit: 49,
};
```

## 📋 Available Scripts

After initialization, the following scripts will be added to your `package.json`:

- `lint`: Run ESLint on all TypeScript/JavaScript/JSON files
- `format`: Format all files using Prettier
- `commit`: Interactive commit using commitizen

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run the linter (`pnpm run lint`) and formatter (`pnpm run format`)
5. Commit your changes using the commitizen interface (`pnpm run commit`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## ©️ License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [ESLint](https://eslint.org/) - Pluggable JavaScript linter
- [Prettier](https://prettier.io/) - Opinionated code formatter
- [Husky](https://typicode.github.io/husky/) - Git hooks made easy
- [lint-staged](https://github.com/okonet/lint-staged) - Run linters on staged files
- [commitlint](https://commitlint.js.org/) - Lint commit messages
- [commitizen](https://github.com/commitizen/cz-cli) - Interactive commit prompts
- [TypeScript](https://www.typescriptlang.org/) - Typed JavaScript at any scale