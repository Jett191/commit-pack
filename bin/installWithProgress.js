/* eslint-env node */
import chalk from 'chalk'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import cliProgress from 'cli-progress'

export function installWithProgress(dependencies, packageManager, projectRoot) {
  if (!dependencies || dependencies.length === 0) {
    console.log(chalk.yellow('✅ 所有开发依赖已安装，跳过安装'))
    return
  }

  console.log('')
  console.log(`⬇️ 开始安装依赖...`)

  // 检查是否为 monorepo（检查是否有 pnpm-workspace.yaml 或 package.json 中的 workspaces 字段）
  const isMonorepo =
    fs.existsSync(path.join(projectRoot, 'pnpm-workspace.yaml')) ||
    (fs.existsSync(path.join(projectRoot, 'package.json')) &&
      JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'))
        .workspaces)

  const bar = new cliProgress.SingleBar({
    format: `  [${chalk.cyan('{bar}')}]{percentage}% | 正在安装: {dep}`,
    barCompleteChar: '▰',
    barIncompleteChar: '▱',
    hideCursor: true
  })

  bar.start(dependencies.length, 0, { dep: '' })

  try {
    for (let i = 0; i < dependencies.length; i++) {
      const dep = dependencies[i]

      let installCommand
      if (packageManager === 'pnpm' && isMonorepo) {
        installCommand = `pnpm add -w -D ${dep}`
      } else {
        installCommand = {
          pnpm: `pnpm add -D ${dep}`,
          yarn: `yarn add ${dep} --dev`,
          bun: `bun add -d ${dep}`,
          npm: `npm install ${dep} --save-dev`
        }[packageManager]
      }

      bar.update(i, { dep })

      execSync(installCommand, { cwd: projectRoot, stdio: ['pipe', 'pipe', 'pipe'] })

      bar.update(i + 1, { dep })
    }
    bar.update(dependencies.length, { dep: chalk.green(' ✔ ') })
    bar.stop()
    console.log('')
    console.log('')
  } catch (err) {
    bar.stop()
    console.log(chalk.red('❌ 安装过程中出错'))
    console.error('错误详情:', err.message)
    console.error('错误堆栈:', err.stack)
    if (err.stdout) console.error('标准输出:', err.stdout.toString())
    if (err.stderr) console.error('错误输出:', err.stderr.toString())
    throw err
  }
}
