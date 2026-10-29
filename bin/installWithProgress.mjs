import chalk from 'chalk'
import { execFileSync } from 'child_process'
import { isMonorepoRoot } from './projectUtils.mjs'

export function getInstallCommand(
  dependencies,
  packageManager,
  { installAtWorkspaceRoot = false } = {}
) {
  const packages = Array.isArray(dependencies) ? dependencies : [dependencies]
  const commands = {
    pnpm: {
      command: 'pnpm',
      args: ['add', ...(installAtWorkspaceRoot ? ['-w'] : []), '-D', ...packages]
    },
    yarn: { command: 'yarn', args: ['add', ...packages, '--dev'] },
    bun: { command: 'bun', args: ['add', '-d', ...packages] },
    npm: { command: 'npm', args: ['install', ...packages, '--save-dev'] }
  }
  if (!commands[packageManager]) throw new Error(`不支持的包管理器: ${packageManager}`)
  return commands[packageManager]
}

export function installWithProgress(
  dependencies,
  packageManager,
  projectRoot,
  { isWorkspace = false } = {}
) {
  if (!dependencies?.length) {
    console.log(chalk.yellow('✅ 所有开发依赖已声明，跳过安装'))
    return
  }
  const installAtWorkspaceRoot =
    packageManager === 'pnpm' && !isWorkspace && isMonorepoRoot(projectRoot)
  const { command, args } = getInstallCommand(dependencies, packageManager, {
    installAtWorkspaceRoot
  })
  console.log(`⬇️ 一次安装 ${dependencies.length} 个开发依赖...`)
  execFileSync(command, args, { cwd: projectRoot, stdio: 'inherit' })
  console.log(chalk.green('✅ 依赖安装完成'))
}
