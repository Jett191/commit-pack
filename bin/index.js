/* eslint-env node */

import fs from 'fs'
import chalk from 'chalk'
import { execSync } from 'child_process'

// 检测包管理器
function detectPackageManager() {
  if (fs.existsSync('pnpm-lock.yaml')) {
    return 'pnpm'
  } else if (fs.existsSync('yarn.lock')) {
    return 'yarn'
  } else if (fs.existsSync('bun.lockb')) {
    return 'bun'
  } else {
    return 'npm'
  }
}

const packageManager = detectPackageManager()
console.log(chalk.green(`检测到使用的包管理器：${packageManager}`))

const packageJsonPath = './package.json'
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

// 确保 devDependencies 存在
if (!packageJson.devDependencies) {
  packageJson.devDependencies = {}
}

const devDependenciesWithVersion = {
  commitizen: '4.2.4',
  eslint: '8.57.1'
}

const devDependencies = [
  '@typescript-eslint/parser',
  '@typescript-eslint/eslint-plugin',
  'prettier',
  'eslint-config-prettier',
  'eslint-plugin-prettier',
  'husky',
  'lint-staged',
  '@commitlint/cli',
  '@commitlint/config-conventional',
  'commitlint-config-cz',
  'cz-customizable',
  'cz-custom'
]

let dependenciesToInstall = []

// 检查并收集需要安装的依赖
for (const dep of devDependencies) {
  if (!packageJson.devDependencies[dep]) {
    dependenciesToInstall.push(dep)
  }
}

for (const [dep, version] of Object.entries(devDependenciesWithVersion)) {
  if (!packageJson.devDependencies[dep]) {
    dependenciesToInstall.push(`${dep}@${version}`)
  }
}

// 安装缺失的依赖
if (dependenciesToInstall.length > 0) {
  let installCommand = ''

  switch (packageManager) {
    case 'pnpm':
      installCommand = `pnpm add -D ${dependenciesToInstall.join(' ')}`
      break
    case 'yarn':
      installCommand = `yarn add ${dependenciesToInstall.join(' ')} --dev`
      break
    case 'bun':
      installCommand = `bun add -d ${dependenciesToInstall.join(' ')}`
      break
    default:
      installCommand = `npm install ${dependenciesToInstall.join(' ')} --save-dev`
      break
  }

  console.log(chalk.green(`正在安装开发依赖：${dependenciesToInstall.join(', ')}`))
  console.log(chalk.green(`执行命令：${installCommand}`))
  execSync(installCommand, { stdio: 'inherit' })
} else {
  console.log(chalk.yellow('所有开发依赖已安装，无需安装'))
}

// 初始化 Git 仓库
console.log(chalk.green('初始化 Git 仓库'))
try {
  // 检查是否已经是 Git 仓库
  execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' })
  console.log(chalk.yellow('当前已是一个 Git 仓库'))
} catch (error) {
  console.error(chalk.red('未检测到 Git 仓库，正在初始化...'), error)
  // 初始化 Git 仓库
  execSync('git init', { stdio: 'inherit' })
}

// 根据包管理器，执行对应的 Husky 初始化命令
let huskyInitCommand = ''
switch (packageManager) {
  case 'pnpm':
    huskyInitCommand = 'pnpm exec husky init'
    break
  case 'yarn':
    huskyInitCommand = 'yarn dlx husky-init'
    break
  case 'bun':
    huskyInitCommand = 'bunx husky init'
    break
  default:
    huskyInitCommand = 'npx husky init'
    break
}

console.log(chalk.green(`执行 Husky 初始化命令：${huskyInitCommand}`))
execSync(huskyInitCommand, { stdio: 'inherit' })

// 执行 setup-script 中的所有文件
console.log(chalk.green('执行 setup-script 中的所有文件'))
try {
  execSync('sh ./prettier.sh', { stdio: 'inherit' })
  execSync('sh ./lintstagedrc.sh', { stdio: 'inherit' })
  execSync('sh ./eslint.sh', { stdio: 'inherit' })
  execSync('sh ./czrc.sh', { stdio: 'inherit' })
  execSync('sh ./husky.sh', { stdio: 'inherit' })
  execSync('sh ./commitlintrc.sh', { stdio: 'inherit' })
  console.log(chalk.green('所有 setup-script 已执行完毕'))
} catch (error) {
  console.error(chalk.red('执行 setup-script 时出错'), error)
}

// 创建或更新脚本
if (!packageJson.scripts) {
  packageJson.scripts = {}
}

let modified = false

if (!packageJson.scripts.lint) {
  packageJson.scripts.lint = 'eslint ./ --ext .ts,.tsx,.json --max-warnings=0'
  console.log(chalk.green('已添加 "lint" 脚本到 package.json'))
  modified = true
} else {
  console.log(chalk.yellow('package.json 中已存在 "lint" 脚本，未作修改'))
}

if (!packageJson.scripts.format) {
  packageJson.scripts.format = "prettier --config .prettierrc '.' --write"
  console.log(chalk.green('已添加 "format" 脚本到 package.json'))
  modified = true
} else {
  console.log(chalk.yellow('package.json 中已存在 "format" 脚本，未作修改'))
}

// 添加或更新 "commit" 脚本
packageJson.scripts.commit = 'cz'
console.log(chalk.green('已添加或更新 "commit" 脚本到 package.json'))
modified = true

// 添加或更新 "config.commitizen" 配置
if (!packageJson.config) {
  packageJson.config = {}
}

packageJson.config.commitizen = {
  path: 'node_modules/cz-customizable'
}
console.log(chalk.green('已添加或更新 "config.commitizen" 到 package.json'))
modified = true

// 写入修改后的 package.json
if (modified) {
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8')
  console.log(chalk.green('已更新 package.json'))
}
