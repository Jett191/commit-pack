/* eslint-env node */
import chalk from 'chalk'
import { execSync } from 'child_process'
import cliProgress from 'cli-progress'

export function installWithProgress(dependencies, packageManager, projectRoot) {
  if (!dependencies || dependencies.length === 0) {
    console.log(chalk.yellow('✅ 所有开发依赖已安装，跳过安装'))
    return
  }

  console.log('')
  console.log(chalk.cyan(`⬇️ 开始安装依赖...`))

  const bar = new cliProgress.SingleBar({
    format: `${chalk.green('📦 安装中')} {bar} {percentage}% | {value}/{total} | 正在安装: {dep}`,
    barCompleteChar: '█',
    barIncompleteChar: '░',
    hideCursor: true
  })

  bar.start(dependencies.length, 0, { dep: '' })

  try {
    for (let i = 0; i < dependencies.length; i++) {
      const dep = dependencies[i]

      const installCommand = {
        pnpm: `pnpm add -D ${dep}`,
        yarn: `yarn add ${dep} --dev`,
        bun: `bun add -d ${dep}`,
        npm: `npm install ${dep} --save-dev`
      }[packageManager]

      bar.update(i, { dep })

      execSync(installCommand, { cwd: projectRoot, stdio: 'ignore' })

      bar.update(i + 1, { dep })
    }

    bar.stop()
    console.log('')
    console.log(chalk.green('✅ 所有开发依赖安装完成'))
    console.log('')
    console.log('')
  } catch (err) {
    bar.stop()
    console.log(chalk.red('❌ 安装过程中出错'), err)
    throw err
  }
}
