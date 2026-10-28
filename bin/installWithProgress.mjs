/* eslint-env node */

import chalk from 'chalk'
import { execFileSync } from 'child_process'
import cliProgress from 'cli-progress'
import { isMonorepoRoot } from './projectUtils.mjs'

export function getInstallCommand(
  dependency,
  packageManager,
  { installAtWorkspaceRoot = false } = {}
) {
  if (packageManager === 'pnpm' && installAtWorkspaceRoot) {
    return { command: 'pnpm', args: ['add', '-w', '-D', dependency] }
  }

  const commands = {
    pnpm: { command: 'pnpm', args: ['add', '-D', dependency] },
    yarn: { command: 'yarn', args: ['add', dependency, '--dev'] },
    bun: { command: 'bun', args: ['add', '-d', dependency] },
    npm: { command: 'npm', args: ['install', dependency, '--save-dev'] }
  }

  const installCommand = commands[packageManager]
  if (!installCommand) throw new Error(`不支持的包管理器: ${packageManager}`)
  return installCommand
}

export function installWithProgress(
  dependencies,
  packageManager,
  projectRoot,
  { isWorkspace = false } = {}
) {
  if (!dependencies || dependencies.length === 0) {
    console.log(chalk.yellow('✅ 所有开发依赖已安装，跳过安装'))
    return
  }

  console.log('')
  console.log(`⬇️ 开始安装依赖...`)

  const installAtWorkspaceRoot =
    packageManager === 'pnpm' && !isWorkspace && isMonorepoRoot(projectRoot)

  const bar = new cliProgress.SingleBar({
    format: `  [${chalk.cyan('{bar}')}]{percentage}% | 正在安装: {dep}`,
    barCompleteChar: '▰',
    barIncompleteChar: '▱',
    hideCursor: true
  })

  bar.start(dependencies.length, 0, { dep: '' })

  try {
    for (let index = 0; index < dependencies.length; index += 1) {
      const dependency = dependencies[index]
      const { command, args } = getInstallCommand(dependency, packageManager, {
        installAtWorkspaceRoot
      })

      bar.update(index, { dep: dependency })
      execFileSync(command, args, {
        cwd: projectRoot,
        stdio: ['pipe', 'pipe', 'pipe']
      })
      bar.update(index + 1, { dep: dependency })
    }

    bar.update(dependencies.length, { dep: chalk.green(' ✔ ') })
    bar.stop()
    console.log('')
    console.log('')
  } catch (error) {
    bar.stop()
    console.log(chalk.red('❌ 安装过程中出错'))
    console.error('错误详情:', error.message)
    if (error.stdout) console.error('标准输出:', error.stdout.toString())
    if (error.stderr) console.error('错误输出:', error.stderr.toString())
    throw error
  }
}
