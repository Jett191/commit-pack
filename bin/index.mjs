#!/usr/bin/env node

/* eslint-env node */

import fs from 'fs'
import chalk from 'chalk'
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import { log } from './chalkColor.js'
import { installWithProgress } from './installWithProgress.js'

const printBanner = () => {
  const top = '╭' + '─'.repeat(40) + '╮'
  const bottom = '╰' + '─'.repeat(40) + '╯'
  const middle = `│  ${chalk.bold.cyan('🚀 Commit Pack 初始化中...')}  │`

  console.log('\n' + top)
  console.log(middle)
  console.log(bottom + '\n')
}

// 模拟 CommonJS 的 __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 向上查找带锁文件的根目录
function findProjectRootWithLockFile() {
  let dir = __dirname
  const lockFiles = ['bun.lockb', 'pnpm-lock.yaml', 'yarn.lock', 'package-lock.json']

  while (dir !== path.dirname(dir)) {
    for (const file of lockFiles) {
      if (fs.existsSync(path.join(dir, file))) {
        return dir
      }
    }
    dir = path.dirname(dir)
  }

  return process.cwd() // fallback
}

const projectRoot = findProjectRootWithLockFile()

function detectPackageManager() {
  if (fs.existsSync(path.join(projectRoot, 'pnpm-lock.yaml'))) {
    return 'pnpm'
  } else if (fs.existsSync(path.join(projectRoot, 'yarn.lock'))) {
    return 'yarn'
  } else if (fs.existsSync(path.join(projectRoot, 'bun.lock'))) {
    return 'bun'
  } else {
    return 'npm'
  }
}

const packageManager = detectPackageManager()
console.log('')
printBanner()
console.log('')
console.log('')
console.log(`🍀 包管理器:${packageManager}`)
console.log(`📁 根目录:${projectRoot}`)

const packageJsonPath = path.join(projectRoot, 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

// 检查是否已经初始化过
const initFlagPath = path.join(projectRoot, '.commit-pack-init')
if (fs.existsSync(initFlagPath)) {
  process.exit(0)
}

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
  'cz-custom',
  'prettier-plugin-tailwindcss'
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

installWithProgress(dependenciesToInstall, packageManager, projectRoot)

let isGitRepo = false

try {
  // 获取 Git 仓库的顶级目录
  const gitTopLevel = execSync('git rev-parse --show-toplevel', { cwd: projectRoot })
    .toString()
    .trim()
  // 比较顶级目录与当前项目目录
  if (path.resolve(gitTopLevel) === path.resolve(projectRoot)) {
    isGitRepo = true
  } else {
    isGitRepo = false
  }
} catch {
  isGitRepo = false
}

if (isGitRepo) {
  console.log(log.success('👍 Git仓库已存在'))
} else {
  console.log(log.warn('👌 Git仓库初始化...'))
  execSync('git init', { stdio: 'inherit', cwd: projectRoot })
}

// 根据包管理器，执行对应的 Husky 初始化命令
let huskyInitCommand = ''
switch (packageManager) {
  case 'pnpm':
    huskyInitCommand = 'pnpm exec husky init'
    break
  case 'yarn':
    huskyInitCommand = 'yarn dlx husky init'
    break
  case 'bun':
    huskyInitCommand = 'bunx husky init'
    break
  default:
    huskyInitCommand = 'npx husky init'
    break
}

console.log(chalk.green(`🐶 Husky初始化...`))
execSync(huskyInitCommand, { stdio: 'inherit', cwd: projectRoot })

// 执行 setup-script 中的所有文件
console.log('🚀 创建配置文件...')
try {
  const setupScripts = [
    'prettier.sh',
    'lintstagedrc.sh',
    'eslint.sh',
    'czrc.sh',
    'husky.sh',
    'cz-config.sh',
    'commitlintrc.sh'
  ]

  for (const script of setupScripts) {
    const scriptPath = path.join(__dirname, '..', 'setup-script', script)
    execSync(`sh ${scriptPath}`, { stdio: 'inherit', cwd: projectRoot })
  }
} catch (error) {
  console.error(log.warn('❌ 文件创建出错'), error)
}

// 创建或更新脚本
if (!packageJson.scripts) {
  packageJson.scripts = {}
  console.log('🔥 创建或更新脚本...')
}

let modified = false

if (!packageJson.scripts.lint) {
  packageJson.scripts.lint = 'eslint ./ --ext .ts,.tsx,.json --max-warnings=0'
  console.log(log.success('✅ 已添加 "lint" 至 package.json'))
  modified = true
} else {
  console.log(log.warn('⚠️ package.json 中已存在 "lint" 未作修改'))
}

if (!packageJson.scripts.format) {
  packageJson.scripts.format = "prettier --config .prettierrc '.' --write"
  console.log(log.success('✅ 已添加 "format" 至 package.json'))
  modified = true
} else {
  console.log(log.warn('⚠️ package.json 中已存在 "format" 未作修改'))
}

// 添加或更新 "commit" 脚本
packageJson.scripts.commit = 'cz'
console.log(log.success('✅ 已添加 "commit" 至 package.json'))
modified = true

// 添加或更新 "config.commitizen" 配置
if (!packageJson.config) {
  packageJson.config = {}
}

packageJson.config.commitizen = {
  path: 'node_modules/cz-customizable'
}
modified = true

// 写入修改后的 package.json
if (modified) {
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8')
  console.log(chalk.green('✅ 已更新 package.json'))
  console.log('')
  console.log('')
}

// 创建初始化标志文件
// fs.writeFileSync(initFlagPath, 'initialized', 'utf8')
console.log(log.success('   🎉🎉🎉 完成啦!'))
console.log('')
console.log(`   运行 git add 后 | 运行 ${packageManager} run commit 即可`)
