<div align="right">

[English](https://github.com/Jett191/commit-pack/blob/main/README_EN.md)

</div>

# commit-pack

自动化的项目代码质量和提交标准化设置。集成 ESLint、Prettier、Husky、lint-staged、commitlint 和 commitizen，执行代码风格检查和标准化提交消息。

## ✨ 特性

- **代码质量**: 集成 ESLint，支持 TypeScript 解析器和推荐配置
- **代码格式化**: Prettier 带有预设的格式化规则
- **Git 钩子**: Husky 驱动的提交前和提交消息验证
- **暂存文件**: lint-staged 只对暂存文件运行检查
- **提交验证**: commitlint 确保符合常规提交格式
- **交互式提交**: commitizen 提供引导式提交创建
- **多包管理器**: 支持 pnpm、npm、yarn 和 bun
- **支持 Monorepo**: 使用 `-w` 标志处理基于工作区的项目
- **安全回滚**: 初始化失败时恢复原配置、Husky 目录、package.json 和锁文件

## 🎬 Demo

https://github.com/user-attachments/assets/8d99c810-81f2-4678-bf62-22bc5d2eee2a



## 🚀 快速开始

### 安装
1. `pnpm`
```bash
pnpm add -D commit-pack@latest
```
2. `bun`
```bash
bun add -d commit-pack@latest
```
3. `npm`
```bash
npm install -D commit-pack@latest
```
4. `yarn`
```bash
yarn add -D commit-pack@latest
```

> 要求 Node.js >= 20.19。选择一种包管理器，依次完成“安装”和“初始化”两步。
> 安装时不再自动生成配置或启用 Git 钩子。
> 初始化时会一次性将缺少的工具安装为项目开发依赖，再生成配置并设置钩子。

### 在项目根目录初始化

1. `pnpm`
```bash
pnpm exec commit-pack-init
```
2. `bun`
```bash
bun run commit-pack-init
```
3. `npm`
```bash
npx commit-pack-init
```
4. `yarn`
```bash
yarn exec commit-pack-init
```

### Monorepo
在 monorepo 根目录执行，将 `workspace-name` 替换为目标工作区 `package.json` 中的 `name`。
此命令代替上面的根目录初始化命令，无需先初始化根目录。

```bash
pnpm exec commit-pack-init -w workspace-name

或

pnpm exec commit-pack-init --workspace=workspace-name
```

## 🛠️ 包含的内容

### ESLint 配置

- 使用 ESLint 9 flat config，搭配 typescript-eslint 8 支持 TypeScript
- 检查 JS/JSX/TS/TSX 及对应模块扩展名；JSON 交给 Prettier 格式化
- ESLint 与 Prettier 分开运行，eslint-config-prettier 关闭冲突规则
- 检测到已有 ESLint 配置或不兼容的依赖版本范围时，会在修改前停止并提示
- 存在 `.commit-pack-init` 标记的项目会跳过；仅升级 commit-pack 不会迁移已有的 ESLint 8 依赖和配置，需手动处理

**eslint.config.mjs**

```js
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
```

### Prettier 配置
- 字符串使用单引号
- 打印宽度为 100 个字符
- 不使用分号
- Tailwind CSS 插件按需安装，默认不包含
- 一致的间距和格式

**.prettierrc**
```json
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
```

需要 Tailwind 类名排序时，再单独安装 `prettier-plugin-tailwindcss`，并在 `.prettierrc` 中添加
`"plugins": ["prettier-plugin-tailwindcss"]`，注意选择与项目 Prettier、Node.js 兼容的版本。

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
        "📗 docs",
        "🌈 style",
        "🍀 refactor",
        "🔥 perf",
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

初始化会自动生成 `.cz-config.cjs` 并在 `package.json` 中注册，兼容设置了 `"type": "module"` 的项目。

**.cz-config.cjs**
```js
module.exports = {
  types: [
    { value: "✨ feat", name: "  ✨  feat: 新功能" },
    { value: "🐛 fix", name: "  🐛 fix: 修复bug" },
    { value: "🎉 init", name: "  🎉 init: 初始化" },
    { value: "📗 docs", name: "  📗 docs: 文档变更" },
    { value: "🌈 style", name: "  🌈 style: 更改样式" },
    { value: "🍀 refactor", name: "  🍀 refactor: 重构" },
    { value: "🔥 perf", name: "  🔥 perf: 性能优化" },
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

初始化会在 `package.json` 中添加以下脚本；同名脚本已存在时保留原值：

- `lint`: 对 JavaScript/TypeScript 文件运行 ESLint（包括 JSX/TSX）
- `format`: 使用 Prettier 格式化所有文件
- `commit`: 使用 commitizen 进行交互式提交

以 pnpm 为例（monorepo 请在目标工作区目录内执行）：

```bash
pnpm run format
pnpm run lint
git add .
pnpm run commit
```

使用其他包管理器时，将 `pnpm run` 替换为 `npm run`、`yarn run` 或 `bun run`。
Git 提交时会自动检查暂存文件和提交消息。
初始化还会将 Husky 加入 `prepare`，保留已有的 prepare 命令。

## 🤝 贡献

1. Fork 仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 进行修改
4. 运行 linter (`pnpm run lint`) 和格式化 (`pnpm run format`)
5. 使用 commitizen 界面提交更改 (`pnpm run commit`)
6. 推送到分支 (`git push origin feature/amazing-feature`)
7. 创建 Pull Request




## 致谢
> 本项目以工程整合与工作流设计为核心，
> 基于一组成熟且优秀的开源工具，
> 构建了一个更易用、更一致的开发者工具链。
>
> 本项目并未引入新的底层技术，
> 其价值主要体现在整合方案、默认配置与开发体验优化上。
>
> 相关核心能力均来自对应开源项目，特此致谢其作者与维护者。
- [ESLint](https://eslint.org/) —— 可配置、可扩展的 JavaScript 代码检查工具
- [Prettier](https://prettier.io/) —— 具有统一风格约定的代码格式化工具
- [Husky](https://typicode.github.io/husky/) —— 简化 Git Hooks 配置与使用的工具
- [lint-staged](https://github.com/okonet/lint-staged) —— 仅对暂存区文件运行代码检查
- [commitlint](https://commitlint.js.org/) —— 用于校验提交信息规范的工具
- [commitizen](https://github.com/commitizen/cz-cli) —— 交互式生成提交信息的工具
- [TypeScript](https://www.typescriptlang.org/) —— 面向大型应用的强类型 JavaScript


## ©️ 许可证

此项目根据 MIT 许可证授权 - 详见 [LICENSE](LICENSE) 文件。
