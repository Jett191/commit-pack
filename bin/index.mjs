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

// 解析命令行参数
const args = process.argv.slice(2)
const workspaceArgIndex = args.findIndex(
  (arg) => arg.startsWith('--workspace=') || arg.startsWith('-w=')
)
let workspaceName = ''
if (workspaceArgIndex !== -1) {
  const arg = args[workspaceArgIndex]
  workspaceName = arg.split('=')[1]
} else {
  // 查找是否有单独的 -w 或 --workspace 参数
  const wIndex = args.findIndex((arg) => arg === '-w')
  const workspaceIndex = args.findIndex((arg) => arg === '--workspace')
  if (wIndex !== -1 && wIndex + 1 < args.length) {
    workspaceName = args[wIndex + 1]
  } else if (workspaceIndex !== -1 && workspaceIndex + 1 < args.length) {
    workspaceName = args[workspaceIndex + 1]
  }
}

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

// 计算实际的工作目录
let actualProjectRoot = projectRoot
if (workspaceName) {
  const packageJsonContent = JSON.parse(
    fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')
  )

  // 根据包管理器确定工作spaces路径
  let workspaces = []
  if (packageJsonContent.workspaces) {
    if (Array.isArray(packageJsonContent.workspaces)) {
      workspaces = packageJsonContent.workspaces
    } else if (packageJsonContent.workspaces.packages) {
      workspaces = packageJsonContent.workspaces.packages
    }
  }

  // 查找workspace包的路径
  if (workspaces.length > 0) {
    for (const workspacePattern of workspaces) {
      // 处理通配符模式，例如 'packages/*'
      if (workspacePattern.includes('*')) {
        const basePath = workspacePattern.replace('/*', '')
        const packagesDir = path.join(projectRoot, basePath)
        if (fs.existsSync(packagesDir)) {
          const packageDirs = fs.readdirSync(packagesDir)
          for (const dir of packageDirs) {
            const dirPath = path.join(packagesDir, dir)
            if (fs.statSync(dirPath).isDirectory()) {
              try {
                const pkgPath = path.join(dirPath, 'package.json')
                if (fs.existsSync(pkgPath)) {
                  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
                  if (pkg.name === workspaceName || dir === workspaceName) {
                    actualProjectRoot = dirPath
                    break
                  }
                }
              } catch (e) {
                console.log(e)
              }
            }
          }
        }
      } else {
        // 直接路径匹配
        const dirPath = path.join(projectRoot, workspacePattern)
        if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
          try {
            const pkgPath = path.join(dirPath, 'package.json')
            if (fs.existsSync(pkgPath)) {
              const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
              if (
                pkg.name === workspaceName ||
                path.basename(dirPath) === workspaceName
              ) {
                actualProjectRoot = dirPath
                break
              }
            }
          } catch (e) {
            console.log(e)
          }
        }
      }
    }
  }
}

console.log('')
printBanner()
console.log('')
console.log('')
console.log(`🍀 包管理器:${packageManager}`)
console.log(`📁 根目录:${actualProjectRoot}`)
if (workspaceName) {
  console.log(`📦 工作空间: ${workspaceName}`)
}

const packageJsonPath = path.join(actualProjectRoot, 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

// 检查是否已经初始化过
const initFlagPath = path.join(actualProjectRoot, '.commit-pack-init')
if (fs.existsSync(initFlagPath)) {
  console.log(log.warn('⚠️ 该工作空间/项目已被初始化，跳过初始化'))
  process.exit(0)
}

// 回滚机制：记录初始状态
const initialPackageJson = JSON.stringify(packageJson, null, 2)

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

try {
  installWithProgress(dependenciesToInstall, packageManager, actualProjectRoot)

  let isGitRepo = false

  try {
    // 获取 Git 仓库的顶级目录
    const gitTopLevel = execSync('git rev-parse --show-toplevel', {
      cwd: actualProjectRoot
    })
      .toString()
      .trim()
    // 比较顶级目录与当前项目目录
    if (path.resolve(gitTopLevel) === path.resolve(actualProjectRoot)) {
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
    execSync('git init', { stdio: 'inherit', cwd: actualProjectRoot })
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
  execSync(huskyInitCommand, { stdio: 'inherit', cwd: actualProjectRoot })

  // 执行 setup-script 中的所有文件
  console.log('🚀 创建配置文件...')
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
    execSync(`sh ${scriptPath}`, { stdio: 'inherit', cwd: actualProjectRoot })
  }

  // 重新读取 package.json，保留 installWithProgress 写入的依赖
  const updatedPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

  // 创建或更新脚本
  if (!updatedPackageJson.scripts) {
    updatedPackageJson.scripts = {}
    console.log('🔥 创建或更新脚本...')
  }

  let modified = false

  if (!updatedPackageJson.scripts.lint) {
    if (workspaceName) {
      // 为workspace项目使用工作空间命令
      if (packageManager === 'pnpm') {
        updatedPackageJson.scripts.lint = `pnpm -F ${workspaceName} exec eslint ./ --ext .ts,.tsx,.json --max-warnings=0`
      } else if (packageManager === 'yarn') {
        updatedPackageJson.scripts.lint = `yarn workspace ${workspaceName} exec eslint ./ --ext .ts,.tsx,.json --max-warnings=0`
      } else {
        updatedPackageJson.scripts.lint = 'eslint ./ --ext .ts,.tsx,.json --max-warnings=0'
      }
    } else {
      updatedPackageJson.scripts.lint = 'eslint ./ --ext .ts,.tsx,.json --max-warnings=0'
    }
    console.log(log.success('✅ 已添加 "lint" 至 package.json'))
    modified = true
  } else {
    console.log(log.warn('⚠️ package.json 中已存在 "lint" 未作修改'))
  }

  if (!updatedPackageJson.scripts.format) {
    if (workspaceName) {
      // 为workspace项目使用工作空间命令
      if (packageManager === 'pnpm') {
        updatedPackageJson.scripts.format = `pnpm -F ${workspaceName} exec prettier --config .prettierrc '.' --write`
      } else if (packageManager === 'yarn') {
        updatedPackageJson.scripts.format = `yarn workspace ${workspaceName} exec prettier --config .prettierrc '.' --write`
      } else {
        updatedPackageJson.scripts.format = "prettier --config .prettierrc '.' --write"
      }
    } else {
      updatedPackageJson.scripts.format = "prettier --config .prettierrc '.' --write"
    }
    console.log(log.success('✅ 已添加 "format" 至 package.json'))
    modified = true
  } else {
    console.log(log.warn('⚠️ package.json 中已存在 "format" 未作修改'))
  }

  // 添加或更新 "commit" 脚本
  if (workspaceName) {
    // 为workspace项目使用工作空间命令
    if (packageManager === 'pnpm') {
      updatedPackageJson.scripts.commit = `pnpm -F ${workspaceName} exec cz`
    } else if (packageManager === 'yarn') {
      updatedPackageJson.scripts.commit = `yarn workspace ${workspaceName} exec cz`
    } else {
      updatedPackageJson.scripts.commit = 'cz'
    }
  } else {
    updatedPackageJson.scripts.commit = 'cz'
  }
  console.log(log.success('✅ 已添加 "commit" 至 package.json'))
  modified = true

  // 添加或更新 "config.commitizen" 配置
  if (!updatedPackageJson.config) {
    updatedPackageJson.config = {}
  }

  updatedPackageJson.config.commitizen = {
    path: 'node_modules/cz-customizable'
  }
  modified = true

  // 写入修改后的 package.json
  if (modified) {
    fs.writeFileSync(packageJsonPath, JSON.stringify(updatedPackageJson, null, 2), 'utf8')
    console.log(chalk.green('✅ 已更新 package.json'))
    console.log('')
    console.log('')
  }

  // 创建初始化标志文件
  fs.writeFileSync(initFlagPath, 'initialized', 'utf8')
  console.log(log.success('   🎉🎉🎉 完成啦!'))
  console.log('')
  console.log('')
  console.log(
    '   📦 欢迎在仓库中反馈问题或参与改进   https://github.com/Jett191/commit-pack'
  )
  console.log('')
  console.log('')
  if (workspaceName) {
    console.log(
      `   在 ${workspaceName} 工作空间中，运行: git add . && ${packageManager} run commit`
    )
  } else {
    console.log(`   运行 git add  后 | 运行 ${packageManager} run commit 即可`)
  }
} catch (error) {
  console.error(log.error('❌ 初始化过程中发生错误，正在执行回滚...'))
  console.error('错误详情:', error.message)
  console.error('错误堆栈:', error.stack)
  if (error.stdout) console.error('标准输出:', error.stdout.toString())
  if (error.stderr) console.error('错误输出:', error.stderr.toString())

  try {
    // 回滚：恢复原始的package.json
    fs.writeFileSync(packageJsonPath, initialPackageJson, 'utf8')
    console.log(log.warn('✅ 已恢复原始 package.json'))

    // 删除可能创建的配置文件
    const configFiles = [
      '.prettierrc',
      '.eslintrc',
      '.commitlintrc.json',
      '.cz-config.js',
      '.czrc',
      '.lintstagedrc',
      '.prettierignore',
      '.eslintignore'
    ]
    for (const configFile of configFiles) {
      const configPath = path.join(actualProjectRoot, configFile)
      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath)
        console.log(log.warn(`✅ 已删除临时配置文件: ${configFile}`))
      }
    }

    // 删除可能创建的.husky目录
    const huskyDir = path.join(actualProjectRoot, '.husky')
    if (fs.existsSync(huskyDir)) {
      fs.rmSync(huskyDir, { recursive: true, force: true })
      console.log(log.warn('✅ 已删除临时 .husky 目录'))
    }

    // 删除初始化标志文件
    if (fs.existsSync(initFlagPath)) {
      fs.unlinkSync(initFlagPath)
    }

    console.log(log.success('   🔄 回滚完成'))
  } catch (rollbackError) {
    console.error(log.error('❌ 回滚过程中也发生了错误，请手动检查项目状态'))
    console.error('回滚错误详情:', rollbackError.message)
    console.error('回滚错误堆栈:', rollbackError.stack)
    if (rollbackError.stdout)
      console.error('回滚标准输出:', rollbackError.stdout.toString())
    if (rollbackError.stderr)
      console.error('回滚错误输出:', rollbackError.stderr.toString())
  }

  process.exit(1) // 确保进程以错误码退出
}
