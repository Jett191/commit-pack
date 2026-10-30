#!/usr/bin/env node

import fs from 'fs'
import os from 'os'
import chalk from 'chalk'
import semver from 'semver'
import { DEV_DEPENDENCIES } from './dependencies.mjs'
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
  'eslint.config.mjs',
  '.commitlintrc.json',
  '.cz-config.cjs',
  '.czrc',
  '.lintstagedrc',
  '.prettierignore',
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
  if (inlineArgument) {
    const name = inlineArgument.slice(inlineArgument.indexOf('=') + 1)
    if (!name) throw new Error('请在 --workspace 后提供工作区名称')
    return name
  }

  const argumentIndex = args.findIndex(
    (argument) => argument === '-w' || argument === '--workspace'
  )
  if (argumentIndex !== -1) {
    const name = args[argumentIndex + 1]
    if (!name || name.startsWith('-')) throw new Error('请在 --workspace 后提供工作区名称')
    return name
  }

  return ''
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

function initializeHusky({ projectRoot, gitTopLevel }) {
  const workspaceConfiguration = getWorkspaceHuskyConfiguration(projectRoot, gitTopLevel)
  // Husky belongs to the target project, not to the initializer's runtime dependencies.
  const require = createRequire(path.join(projectRoot, 'package.json'))
  const huskyBinPath = path.join(path.dirname(require.resolve('husky')), 'bin.js')
  execFileSync(
    process.execPath,
    [huskyBinPath, workspaceConfiguration?.hooksDirectory || '.husky'],
    {
      stdio: 'inherit',
      cwd: gitTopLevel
    }
  )
  return workspaceConfiguration?.prepareScript || 'husky'
}

function getTransactionPaths(projectRoot, actualProjectRoot) {
  const roots = [...new Set([projectRoot, actualProjectRoot])]
  return [
    path.join(actualProjectRoot, 'package.json'),
    ...CONFIG_PATHS.map((file) => path.join(actualProjectRoot, file)),
    ...roots.flatMap((root) => LOCK_FILES.map((file) => path.join(root, file)))
  ]
}

function validateExistingProject(projectRoot, packageJson, repairing = false) {
  const eslintConfigs = [
    'eslint.config.js',
    'eslint.config.mjs',
    'eslint.config.cjs',
    'eslint.config.ts',
    'eslint.config.mts',
    'eslint.config.cts',
    '.eslintrc',
    '.eslintrc.js',
    '.eslintrc.cjs',
    '.eslintrc.json',
    '.eslintrc.yml',
    '.eslintrc.yaml',
    '.eslintignore'
  ]
  if (
    packageJson.eslintConfig ||
    eslintConfigs.some(
      (file) =>
        !(repairing && file === 'eslint.config.mjs') && fs.existsSync(path.join(projectRoot, file))
    )
  ) {
    throw new Error(
      '检测到已有 ESLint 配置。请先手动迁移或备份并移除配置，再初始化；不会自动覆盖。'
    )
  }
  const existingDependencies = { ...packageJson.dependencies, ...packageJson.devDependencies }
  for (const [dependency, supported] of Object.entries(DEV_DEPENDENCIES)) {
    const existing = existingDependencies[dependency]
    if (existing && (!semver.validRange(existing) || !semver.subset(existing, supported))) {
      throw new Error(
        `${dependency} 当前版本范围 ${existing} 不兼容默认工具链 (${supported})，请先手动调整。`
      )
    }
  }
}

function collectDependencies(packageJson) {
  const existingDependencies = { ...packageJson.dependencies, ...packageJson.devDependencies }
  return Object.entries(DEV_DEPENDENCIES)
    .filter(([dependency]) => !existingDependencies[dependency])
    .map(([dependency, version]) => `${dependency}@${version}`)
}

function updatePackageJson(packageJsonPath, { huskyPrepareScript }) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  packageJson.scripts ||= {}
  packageJson.scripts.lint ||= 'eslint . --max-warnings=0'
  packageJson.scripts.format ||= 'prettier --config .prettierrc . --write'
  packageJson.scripts.commit ||= 'cz'
  const prepare = packageJson.scripts.prepare
  packageJson.scripts.prepare =
    prepare && prepare !== huskyPrepareScript && !prepare.endsWith(` && ${huskyPrepareScript}`)
      ? `${prepare} && ${huskyPrepareScript}`
      : prepare || huskyPrepareScript
  packageJson.config ||= {}
  packageJson.config.commitizen ||= { path: 'cz-customizable' }
  packageJson.config['cz-customizable'] ||= { config: '.cz-config.cjs' }
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8')
  console.log(chalk.green('✅ 已更新 package.json'))
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

    const repairing = fs.existsSync(initFlagPath)
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    validateExistingProject(actualProjectRoot, packageJson, repairing)
    if (repairing) {
      console.log(log.warn('⚠️ 检测到初始化标记，检查并补齐配置；保留已有文件'))
    }

    transaction = createFileTransaction(getTransactionPaths(projectRoot, actualProjectRoot))

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
      projectRoot: actualProjectRoot,
      gitTopLevel
    })

    console.log('🚀 创建配置文件...')
    // Generate repairs separately so multi-output scripts cannot overwrite custom files.
    const outputRoot = repairing
      ? fs.mkdtempSync(path.join(os.tmpdir(), 'commit-pack-config-'))
      : actualProjectRoot
    try {
      if (repairing) fs.mkdirSync(path.join(outputRoot, '.husky'))
      for (const script of SETUP_SCRIPTS) {
        const scriptPath = path.join(__dirname, '..', 'setup-script', script)
        execFileSync('sh', [scriptPath], {
          stdio: 'inherit',
          cwd: outputRoot,
          env: { ...process.env, COMMIT_PACK_PM: packageManager }
        })
      }
      if (repairing) {
        const files = CONFIG_PATHS.filter((file) => !['.husky', '.commit-pack-init'].includes(file))
        files.push('.husky/pre-commit', '.husky/commit-msg')
        for (const file of files) {
          const target = path.join(actualProjectRoot, file)
          if (!fs.existsSync(target)) fs.copyFileSync(path.join(outputRoot, file), target)
        }
      }
    } finally {
      if (repairing) fs.rmSync(outputRoot, { recursive: true, force: true })
    }

    updatePackageJson(packageJsonPath, {
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
    console.log('   📦 欢迎在仓库中反馈问题或参与改进   https://github.com/Jett191/commit-pack')
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

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(__filename)) {
  run()
}
