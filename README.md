# auto-commit

## 1. 概述

Eslint 代码质量

Prettier 代码风格

eslint-config-prettier 关闭所有可能干扰 Prettier 规则的 ESLint 规则

eslint-plugin-prettier 将 Prettier 规则转换为 ESLint 规则

Husky 自动化检查修改（git hook）

lint-staged 只对已更改文件检查

commitlint 检查提交信息规范性

commitizen 自动化脚本生成 commit message

vscode 插件

## 2. 快速入门

</br>

### 🚀 安装
```
pnpm add -D commit-pack@latest
```
```
bun add -d commit-pack@latest
```
```
npm i -D commit-pack@latest
```
```
yarn add -D commit-pack@latest
```
</br>

### 🍀 初始化
```
pnpm exec commit-pack-init
```
```
bux commit-pack-init
```
```
npx commit-pack-init
```
```
yarn dlx commit-pack-init
```





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



**.eslintrc**

````json
{
  // 这是根配置文件，ESLint 不会在父目录中查找其他配置文件。
  "root": true,

  // 指定要使用的解析器，这里是 TypeScript 的解析器。
  "parser": "@typescript-eslint/parser",

  "extends": [
    // 扩展 ESLint 推荐的规则
    "eslint:recommended",

    // 扩展 @typescript-eslint/eslint-plugin 推荐规则
    "plugin:@typescript-eslint/recommended",

    // 扩展 @typescript-eslint/eslint-plugin 推荐的规则，禁用与 eslint:recommended 冲突的规则
    "plugin:@typescript-eslint/eslint-recommended",

    // 扩展 Prettier 配置以禁用可能与 Prettier 冲突的 ESLint 规则 即 eslint-config-prettier 确保放在最后
    "prettier"
  ],

  "plugins": [
    "@typescript-eslint",
    "prettier"
  ],

  "rules": {
    // 将 Prettier 格式化强制为 ESLint 错误。
    "prettier/prettier": "error",

    // 禁用强制在箭头函数体周围使用大括号的规则。
    "arrow-body-style": "off",

    // 禁用强制为回调使用箭头函数的规则。
    "prefer-arrow-callback": "off"
  }
}
```
````


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
