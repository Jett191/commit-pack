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

## 🎬 Demo

https://github.com/user-attachments/assets/8d99c810-81f2-4678-bf62-22bc5d2eee2a

## 🚀 Quick Start

### Installation

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

### Initialize in the project root directory

1. `pnpm`

```bash
pnpm exec commit-pack-init
```

2. `bun`

```bash
bunx commit-pack-init
```

3. `npm`

```bash
npx commit-pack-init
```

4. `yarn`

```bash
yarn dlx commit-pack-init
```

### Monorepo Support

`Initialize for a specific workspace in monorepo`

```bash
pnpm exec commit-pack-init -w workspace-name

or

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

  "plugins": ["@typescript-eslint", "prettier"],

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
    { value: '✨ feat', name: '  ✨  feat: new feature' },
    { value: '🐛 fix', name: '  🐛 fix: fix bug' },
    { value: '🎉 init', name: '  🎉 init: init' },
    { value: '✏️ docs', name: '  ✏️ docs: documentation changes' },
    { value: '💄 style', name: '  💄 style: change style' },
    { value: '♻️ refactor', name: '  ♻️ refactor: code refactoring' },
    { value: '⚡️ perf', name: '  ⚡️ perf: performance improvements' },
    { value: '✅ test', name: '  ✅  test: add tests' },
    { value: '⏪️ revert', name: '  ⏪️ revert: revert changes' },
    { value: '📦 build', name: '  📦 build: build' },
    { value: '🚀 chore', name: '  🚀 chore: Chores/ tooling' },
    { value: '👷 ci', name: '  👷 ci: CI related changes' }
  ],

  scopes: [
    { name: 'components' },
    { name: 'page' },
    { name: 'css' },
    { name: 'api' },
    { name: 'README.md' },
    { name: 'custom' }
  ],

  messages: {
    type: 'Select the type of change that you are committing:',
    scope: 'Select the scope of this change (required):',
    customScope: 'Enter a custom scope (required):',
    subject: 'Write a short, imperative description of the change (required):',
    body: 'Provide a longer description of the change (optional):',
    breaking: 'List any breaking changes (optional):',
    footer: 'List any issues closed by this change (optional):',
    confirmCommit: 'Are you sure you want to proceed with this commit?'
  },

  allowCustomScopes: true,
  allowBreakingChanges: ['✨ feat', '🐛 fix'],
  subjectLimit: 49
}
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

## Acknowledgments

> This project focuses on integrating and orchestrating a set of well-established open-source tools
> into a cohesive, developer-friendly workflow.
>
> Rather than introducing new core technologies, the value of this project lies in
> practical integration, sensible defaults, and improved developer experience.
>
> Full credit goes to the authors and maintainers of the underlying tools.

- [ESLint](https://eslint.org/) — A pluggable and configurable JavaScript linter
- [Prettier](https://prettier.io/) — An opinionated code formatter
- [Husky](https://typicode.github.io/husky/) — Git hooks made easy
- [lint-staged](https://github.com/okonet/lint-staged) — Run linters on staged files
- [commitlint](https://commitlint.js.org/) — Lint and enforce commit message conventions
- [commitizen](https://github.com/commitizen/cz-cli) — Interactive commit message prompts
- [TypeScript](https://www.typescriptlang.org/) — Strongly typed JavaScript at scale

## ©️ License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
