#!/usr/bin/env node

/* eslint-env node */

import fs from 'fs'
import chalk from 'chalk'
import { execFileSync } from 'child_process'
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'
import { log } from './chalkColor.mjs'
import { createFileTransaction } from './fileTransaction.mjs'
import { installWithProgress } from './installWithProgress.mjs'
import {
  LOCK_FILES,
  detectPackageManager,
  findProjectRoot,
  findWorkspaceRoot,
  getInvocationDirectory
} from './projectUtils.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CONFIG_PATHS = [
  '.prettierrc',
  '.eslintrc',
  '.commitlintrc.json',
  '.cz-config.js',
  '.czrc',
  '.lintstagedrc',
  '.prettierignore',
  '.eslintignore',
  '.husky',
  '.commit-pack-init'
]

const SETUP_SCRIPTS = [
  'prettier.sh',
  'lintstagedrc.sh',
  'eslint.sh',
  'czrc.sh',
  'husky.sh',
  'cz-config.sh',
  'commitlintrc.sh'
]

const DEV_DEPENDENCIES_WITH_VERSION = {
  commitizen: '4.2.4',
  eslint: '8.57.1'
}

const DEV_DEPENDENCIES = [
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

function printBanner() {
  const top = '╭' + '─'.repeat(40) + '╮'
  const bottom = '╰' + '─'.repeat(40) + '╯'
  const middle = `│  ${chalk.bold.cyan('🚀 Commit Pack 初始化中...')}  │`

  console.log('\n' + top)
  console.log(middle)
  console.log(bottom + '\n')
}

export function parseWorkspaceName(args) {
  const inlineArgument = args.find(
    (argument) => argument.startsWith('--workspace=') || argument.startsWith('-w=')
  )
  if (inlineArgument) return inlineArgument.slice(inlineArgument.indexOf('=') + 1)

  const argumentIndex = args.findIndex(
    (argument) => argument === '-w' || argument === '--workspace'
  )
  if (argumentIndex !== -1 && argumentIndex + 1 < args.length) {
    return args[argumentIndex + 1]
  }

  return ''
}

function getHuskyCommand(packageManager) {
  const commands = {
    pnpm: { command: 'pnpm', args: ['exec', 'husky', 'init'] },
    yarn: { command: 'yarn', args: ['dlx', 'husky', 'init'] },
    bun: { command: 'bunx', args: ['husky', 'init'] },
    npm: { command: 'npx', args: ['husky', 'init'] }
  }
  return commands[packageManager]
}

function getGitTopLevel(projectRoot) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim()
  } catch {
    return null
  }
}

function getGitHooksPath(gitTopLevel) {
  try {
    return execFileSync('git', ['config', '--get', 'core.hooksPath'], {
      cwd: gitTopLevel,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim()
  } catch {
    return null
  }
}

function restoreGitHooksPath(gitTopLevel, hooksPath) {
  if (hooksPath === null) {
    try {
      execFileSync('git', ['config', '--unset-all', 'core.hooksPath'], {
        cwd: gitTopLevel,
        stdio: 'ignore'
      })
    } catch {
      // Git 在配置原本不存在时会返回非零状态，可以安全忽略。
    }
    return
  }

  execFileSync('git', ['config', 'core.hooksPath', hooksPath], {
    cwd: gitTopLevel,
    stdio: 'ignore'
  })
}

function quoteShellArgument(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export function getWorkspaceHuskyConfiguration(projectRoot, gitTopLevel) {
  const canonicalProjectRoot = fs.existsSync(projectRoot)
    ? fs.realpathSync(projectRoot)
    : path.resolve(projectRoot)
  const canonicalGitTopLevel = fs.existsSync(gitTopLevel)
    ? fs.realpathSync(gitTopLevel)
    : path.resolve(gitTopLevel)
  const relativeProjectPath = path.relative(canonicalGitTopLevel, canonicalProjectRoot)
  if (
    relativeProjectPath === '' ||
    relativeProjectPath.startsWith('..') ||
    path.isAbsolute(relativeProjectPath)
  ) {
    return null
  }

  const projectFromGitRoot = relativeProjectPath.replace(/\\/g, '/')
  const gitRootFromProject = path
    .relative(canonicalProjectRoot, canonicalGitTopLevel)
    .replace(/\\/g, '/')
  const hooksDirectory = `${projectFromGitRoot}/.husky`

  return {
    hooksDirectory,
    prepareScript: `cd ${quoteShellArgument(gitRootFromProject)} && husky ${quoteShellArgument(
      hooksDirectory
    )}`
  }
}

function initializeHusky({ packageManager, projectRoot, gitTopLevel }) {
  const workspaceConfiguration = getWorkspaceHuskyConfiguration(
    projectRoot,
    gitTopLevel
  )

  if (!workspaceConfiguration) {
    const huskyCommand = getHuskyCommand(packageManager)
    execFileSync(huskyCommand.command, huskyCommand.args, {
      stdio: 'inherit',
      cwd: projectRoot
    })
    return 'husky'
  }

  const require = createRequire(import.meta.url)
  const huskyEntryPath = require.resolve('husky')
  const huskyBinPath = path.join(path.dirname(huskyEntryPath), 'bin.js')
  execFileSync(
    process.execPath,
    [huskyBinPath, workspaceConfiguration.hooksDirectory],
    {
      stdio: 'inherit',
      cwd: gitTopLevel
    }
  )
  return workspaceConfiguration.prepareScript
}

function getTransactionPaths(projectRoot, actualProjectRoot) {
  const roots = [...new Set([projectRoot, actualProjectRoot])]
  return [
    path.join(actualProjectRoot, 'package.json'),
    ...CONFIG_PATHS.map((file) => path.join(actualProjectRoot, file)),
    ...roots.flatMap((root) => LOCK_FILES.map((file) => path.join(root, file)))
  ]
}

function collectDependencies(packageJson) {
  const dependenciesToInstall = []
  const existingDependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  }

  for (const dependency of DEV_DEPENDENCIES) {
    if (!existingDependencies[dependency]) dependenciesToInstall.push(dependency)
  }

  for (const [dependency, version] of Object.entries(DEV_DEPENDENCIES_WITH_VERSION)) {
    if (!existingDependencies[dependency]) {
      dependenciesToInstall.push(`${dependency}@${version}`)
    }
  }

  return dependenciesToInstall
}

function updatePackageJson(
  packageJsonPath,
  { packageManager, workspaceName, huskyPrepareScript }
) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  if (!packageJson.scripts) {
    packageJson.scripts = {}
    console.log('🔥 创建或更新脚本...')
  }

  if (!packageJson.scripts.lint) {
    if (workspaceName && packageManager === 'pnpm') {
      packageJson.scripts.lint = `pnpm -F ${workspaceName} exec eslint ./ --ext .ts,.tsx,.json --max-warnings=0`
    } else if (workspaceName && packageManager === 'yarn') {
      packageJson.scripts.lint = `yarn workspace ${workspaceName} exec eslint ./ --ext .ts,.tsx,.json --max-warnings=0`
    } else {
      packageJson.scripts.lint = 'eslint ./ --ext .ts,.tsx,.json --max-warnings=0'
    }
    console.log(log.success('✅ 已添加 "lint" 至 package.json'))
  } else {
    console.log(log.warn('⚠️ package.json 中已存在 "lint" 未作修改'))
  }

  if (!packageJson.scripts.format) {
    if (workspaceName && packageManager === 'pnpm') {
      packageJson.scripts.format = `pnpm -F ${workspaceName} exec prettier --config .prettierrc '.' --write`
    } else if (workspaceName && packageManager === 'yarn') {
      packageJson.scripts.format = `yarn workspace ${workspaceName} exec prettier --config .prettierrc '.' --write`
    } else {
      packageJson.scripts.format = "prettier --config .prettierrc '.' --write"
    }
    console.log(log.success('✅ 已添加 "format" 至 package.json'))
  } else {
    console.log(log.warn('⚠️ package.json 中已存在 "format" 未作修改'))
  }

  if (workspaceName && packageManager === 'pnpm') {
    packageJson.scripts.commit = `pnpm -F ${workspaceName} exec cz`
  } else if (workspaceName && packageManager === 'yarn') {
    packageJson.scripts.commit = `yarn workspace ${workspaceName} exec cz`
  } else {
    packageJson.scripts.commit = 'cz'
  }
  console.log(log.success('✅ 已添加 "commit" 至 package.json'))

  if (!packageJson.config) packageJson.config = {}
  packageJson.config.commitizen = {
    path: 'node_modules/cz-customizable'
  }
  packageJson.scripts.prepare = huskyPrepareScript

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8')
  console.log(chalk.green('✅ 已更新 package.json'))
  console.log('')
  console.log('')
}

export function run(args = process.argv.slice(2)) {
  let transaction = null
  let gitDirectoryCreated = null
  let gitTopLevel = null
  let originalGitHooksPath = null
  let huskyInitializationStarted = false

  try {
    const workspaceName = parseWorkspaceName(args)
    const invocationDirectory = getInvocationDirectory()
    const projectRoot = findProjectRoot(invocationDirectory)
    const packageManager = detectPackageManager(projectRoot)
    const actualProjectRoot = workspaceName
      ? findWorkspaceRoot(projectRoot, workspaceName)
      : projectRoot
    const packageJsonPath = path.join(actualProjectRoot, 'package.json')
    const initFlagPath = path.join(actualProjectRoot, '.commit-pack-init')

    if (!fs.existsSync(packageJsonPath)) {
      throw new Error(`目标目录中不存在 package.json: ${actualProjectRoot}`)
    }

    console.log('')
    printBanner()
    console.log('')
    console.log('')
    console.log(`🍀 包管理器:${packageManager}`)
    console.log(`📁 根目录:${actualProjectRoot}`)
    if (workspaceName) console.log(`📦 工作空间: ${workspaceName}`)

    if (fs.existsSync(initFlagPath)) {
      console.log(log.warn('⚠️ 该工作空间/项目已被初始化，跳过初始化'))
      return
    }

    transaction = createFileTransaction(
      getTransactionPaths(projectRoot, actualProjectRoot)
    )

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    const dependenciesToInstall = collectDependencies(packageJson)
    installWithProgress(dependenciesToInstall, packageManager, actualProjectRoot, {
      isWorkspace: Boolean(workspaceName)
    })

    gitTopLevel = getGitTopLevel(actualProjectRoot)
    if (gitTopLevel) {
      console.log(log.success(`👍 Git仓库已存在: ${gitTopLevel}`))
    } else {
      console.log(log.warn('👌 Git仓库初始化...'))
      const gitDirectory = path.join(actualProjectRoot, '.git')
      const gitDirectoryExisted = fs.existsSync(gitDirectory)
      if (!gitDirectoryExisted) gitDirectoryCreated = gitDirectory
      execFileSync('git', ['init'], { stdio: 'inherit', cwd: actualProjectRoot })
      gitTopLevel = actualProjectRoot
    }

    originalGitHooksPath = getGitHooksPath(gitTopLevel)
    huskyInitializationStarted = true
    console.log(chalk.green('🐶 Husky初始化...'))
    const huskyPrepareScript = initializeHusky({
      packageManager,
      projectRoot: actualProjectRoot,
      gitTopLevel
    })

    console.log('🚀 创建配置文件...')
    for (const script of SETUP_SCRIPTS) {
      const scriptPath = path.join(__dirname, '..', 'setup-script', script)
      execFileSync('sh', [scriptPath], {
        stdio: 'inherit',
        cwd: actualProjectRoot
      })
    }

    updatePackageJson(packageJsonPath, {
      packageManager,
      workspaceName,
      huskyPrepareScript
    })
    fs.writeFileSync(initFlagPath, 'initialized', 'utf8')
    transaction.commit()
    transaction = null
    gitDirectoryCreated = null
    huskyInitializationStarted = false

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
    if (error.stdout) console.error('标准输出:', error.stdout.toString())
    if (error.stderr) console.error('错误输出:', error.stderr.toString())

    try {
      if (transaction) transaction.rollback()
      if (huskyInitializationStarted && gitTopLevel && !gitDirectoryCreated) {
        restoreGitHooksPath(gitTopLevel, originalGitHooksPath)
      }
      if (gitDirectoryCreated) {
        fs.rmSync(gitDirectoryCreated, { recursive: true, force: true })
      }
      console.log(log.success('   🔄 回滚完成'))
    } catch (rollbackError) {
      console.error(log.error('❌ 回滚过程中也发生了错误，请手动检查项目状态'))
      console.error('回滚错误详情:', rollbackError.message)
    }

    process.exitCode = 1
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  run()
}
