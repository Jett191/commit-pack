#!/usr/bin/env node

/* eslint-env node */

import fs from 'fs'
import chalk from 'chalk'
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

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
console.log(chalk.green(`检测到项目根目录：${projectRoot}`))

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

console.log('执行 postinstall 脚本:bin/index.js')

const packageManager = detectPackageManager()
console.log(chalk.green(`检测到使用的包管理器：${packageManager}`))

const packageJsonPath = path.join(projectRoot, 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

// 检查是否已经初始化过
const initFlagPath = path.join(projectRoot, '.commit-pack-init')
if (fs.existsSync(initFlagPath)) {
  console.log(chalk.yellow('已检测到初始化标志文件，跳过初始化'))
  process.exit(0)
}

// // 确保 devDependencies 存在
// if (!packageJson.devDependencies) {
//   packageJson.devDependencies = {}
// }

// const devDependenciesWithVersion = {
//   commitizen: '4.2.4',
//   eslint: '8.57.1'
// }

// const devDependencies = [
//   '@typescript-eslint/parser',
//   '@typescript-eslint/eslint-plugin',
//   'prettier',
//   'eslint-config-prettier',
//   'eslint-plugin-prettier',
//   'husky',
//   'lint-staged',
//   '@commitlint/cli',
//   '@commitlint/config-conventional',
//   'commitlint-config-cz',
//   'cz-customizable',
//   'cz-custom'
// ]

// let dependenciesToInstall = []

// // 检查并收集需要安装的依赖
// for (const dep of devDependencies) {
//   if (!packageJson.devDependencies[dep]) {
//     dependenciesToInstall.push(dep)
//   }
// }

// for (const [dep, version] of Object.entries(devDependenciesWithVersion)) {
//   if (!packageJson.devDependencies[dep]) {
//     dependenciesToInstall.push(`${dep}@${version}`)
//   }
// }

// // 安装缺失的依赖
// if (dependenciesToInstall.length > 0) {
//   let installCommand = ''

//   switch (packageManager) {
//     case 'pnpm':
//       installCommand = `pnpm add -D ${dependenciesToInstall.join(' ')}`
//       break
//     case 'yarn':
//       installCommand = `yarn add ${dependenciesToInstall.join(' ')} --dev`
//       break
//     case 'bun':
//       installCommand = `bun add -d ${dependenciesToInstall.join(' ')}`
//       break
//     default:
//       installCommand = `npm install ${dependenciesToInstall.join(' ')} --save-dev`
//       break
//   }

//   console.log(chalk.green(`正在安装开发依赖：${dependenciesToInstall.join(', ')}`))
//   console.log(chalk.green(`执行命令：${installCommand}`))
//   execSync(installCommand, { stdio: 'inherit', cwd: projectRoot })
// } else {
//   console.log(chalk.yellow('所有开发依赖已安装，无需安装'))
// }

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
  console.log(chalk.yellow('当前已是一个 Git 仓库'))
} else {
  console.log(chalk.red('未检测到 Git 仓库，正在初始化...'))
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

console.log(chalk.green(`执行 Husky 初始化命令：${huskyInitCommand}`))
execSync(huskyInitCommand, { stdio: 'inherit', cwd: projectRoot })

// 执行 setup-script 中的所有文件
console.log(chalk.green('执行 setup-script 中的所有文件'))
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
    console.log(chalk.green(`执行脚本：${scriptPath}`))
    execSync(`sh ${scriptPath}`, { stdio: 'inherit', cwd: projectRoot })
  }
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

// 创建初始化标志文件
fs.writeFileSync(initFlagPath, 'initialized', 'utf8')
console.log(chalk.green('已创建初始化标志文件'))
