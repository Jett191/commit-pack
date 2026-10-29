import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import test from 'node:test'
import { getWorkspaceHuskyConfiguration, parseWorkspaceName } from '../bin/index.mjs'
import { getInstallCommand, installWithProgress } from '../bin/installWithProgress.mjs'
import { DEV_DEPENDENCIES } from '../bin/dependencies.mjs'

function createWorkspaceFixture(t) {
  const gitRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'commit-pack-test-'))
  const workspaceRoot = path.join(gitRoot, 'packages', 'web')
  const devDependencies = { ...DEV_DEPENDENCIES }
  t.after(() => fs.rmSync(gitRoot, { recursive: true, force: true }))

  fs.mkdirSync(workspaceRoot, { recursive: true })
  fs.symlinkSync(path.resolve('node_modules'), path.join(workspaceRoot, 'node_modules'), 'dir')
  fs.writeFileSync(
    path.join(gitRoot, 'package.json'),
    JSON.stringify({ private: true, workspaces: ['packages/*'] }),
    'utf8'
  )
  fs.writeFileSync(
    path.join(workspaceRoot, 'package.json'),
    JSON.stringify({ name: '@example/web', devDependencies }),
    'utf8'
  )
  execFileSync('git', ['init'], { cwd: gitRoot, stdio: 'ignore' })

  return { gitRoot, workspaceRoot }
}

function runWorkspaceInitializer(gitRoot) {
  return spawnSync(process.execPath, [path.resolve('bin/index.mjs'), '--workspace=@example/web'], {
    cwd: gitRoot,
    env: { ...process.env, INIT_CWD: gitRoot },
    encoding: 'utf8',
    timeout: 10000
  })
}

test('workspace arguments keep all documented forms', () => {
  assert.equal(parseWorkspaceName(['-w', '@example/web']), '@example/web')
  assert.equal(parseWorkspaceName(['--workspace', 'web']), 'web')
  assert.equal(parseWorkspaceName(['-w=web']), 'web')
  assert.equal(parseWorkspaceName(['--workspace=web']), 'web')
  assert.equal(parseWorkspaceName([]), '')
})

test('package-manager install commands preserve their existing behavior', () => {
  assert.deepEqual(getInstallCommand('eslint', 'pnpm'), {
    command: 'pnpm',
    args: ['add', '-D', 'eslint']
  })
  assert.deepEqual(getInstallCommand('eslint', 'pnpm', { installAtWorkspaceRoot: true }), {
    command: 'pnpm',
    args: ['add', '-w', '-D', 'eslint']
  })
  assert.deepEqual(getInstallCommand('eslint', 'yarn'), {
    command: 'yarn',
    args: ['add', 'eslint', '--dev']
  })
  assert.deepEqual(getInstallCommand('eslint', 'bun'), {
    command: 'bun',
    args: ['add', '-d', 'eslint']
  })
  assert.deepEqual(getInstallCommand('eslint', 'npm'), {
    command: 'npm',
    args: ['install', 'eslint', '--save-dev']
  })
})

test('workspace Husky configuration targets the outer Git repository', () => {
  const configuration = getWorkspaceHuskyConfiguration('/repo/packages/web', '/repo')

  assert.deepEqual(configuration, {
    hooksDirectory: 'packages/web/.husky',
    prepareScript: "cd '../..' && husky 'packages/web/.husky'"
  })
  assert.equal(getWorkspaceHuskyConfiguration('/repo', '/repo'), null)
  assert.equal(getWorkspaceHuskyConfiguration('/another-project/web', '/repo'), null)
})

test('workspace initialization reuses the outer Git repository', (t) => {
  const { gitRoot, workspaceRoot } = createWorkspaceFixture(t)
  const result = runWorkspaceInitializer(gitRoot)

  assert.equal(result.status, 0, result.stderr)
  assert.equal(fs.existsSync(path.join(workspaceRoot, '.git')), false)
  assert.equal(
    execFileSync('git', ['config', '--get', 'core.hooksPath'], {
      cwd: gitRoot,
      encoding: 'utf8'
    }).trim(),
    'packages/web/.husky/_'
  )
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(workspaceRoot, 'package.json'), 'utf8')).scripts.prepare,
    "cd '../..' && husky 'packages/web/.husky'"
  )
  assert.equal(fs.existsSync(path.join(workspaceRoot, '.commit-pack-init')), true)
})

test('failed initialization restores files and Git hooks configuration', (t) => {
  const { gitRoot, workspaceRoot } = createWorkspaceFixture(t)
  const packageJsonPath = path.join(workspaceRoot, 'package.json')
  const originalPackageJson = fs.readFileSync(packageJsonPath, 'utf8')
  fs.writeFileSync(path.join(workspaceRoot, '.prettierrc'), 'original', 'utf8')
  fs.writeFileSync(path.join(workspaceRoot, '.husky'), 'original', 'utf8')
  execFileSync('git', ['config', 'core.hooksPath', '.existing-hooks'], {
    cwd: gitRoot
  })

  const result = runWorkspaceInitializer(gitRoot)

  assert.notEqual(result.status, 0)
  assert.equal(fs.readFileSync(packageJsonPath, 'utf8'), originalPackageJson)
  assert.equal(fs.readFileSync(path.join(workspaceRoot, '.prettierrc'), 'utf8'), 'original')
  assert.equal(fs.readFileSync(path.join(workspaceRoot, '.husky'), 'utf8'), 'original')
  assert.equal(
    execFileSync('git', ['config', '--get', 'core.hooksPath'], {
      cwd: gitRoot,
      encoding: 'utf8'
    }).trim(),
    '.existing-hooks'
  )
  assert.equal(fs.existsSync(path.join(workspaceRoot, '.commit-pack-init')), false)
})

test('setup scripts still generate the expected configuration files', (t) => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'commit-pack-test-'))
  t.after(() => fs.rmSync(projectRoot, { recursive: true, force: true }))
  fs.mkdirSync(path.join(projectRoot, '.husky'))

  const setupDirectory = path.resolve('setup-script')
  const scripts = fs.readdirSync(setupDirectory).filter((file) => file.endsWith('.sh'))
  for (const script of scripts) {
    execFileSync('sh', [path.join(setupDirectory, script)], { cwd: projectRoot })
  }

  for (const configFile of ['.prettierrc', '.commitlintrc.json', '.lintstagedrc', '.czrc']) {
    assert.doesNotThrow(() =>
      JSON.parse(fs.readFileSync(path.join(projectRoot, configFile), 'utf8'))
    )
  }
  assert.equal(fs.existsSync(path.join(projectRoot, 'eslint.config.mjs')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, '.cz-config.cjs')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, '.husky', 'pre-commit')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, '.husky', 'commit-msg')), true)
  assert.match(
    fs.readFileSync(path.join(projectRoot, '.husky', 'pre-commit'), 'utf8'),
    /cd "\$HOOK_DIR\/\.\."/
  )
})

test('batch installation invokes the package manager exactly once', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'commit-pack-batch-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const fakeBin = path.join(root, 'bin')
  const calls = path.join(root, 'calls.jsonl')
  fs.mkdirSync(fakeBin)
  fs.writeFileSync(
    path.join(fakeBin, 'npm'),
    `#!${process.execPath}
require('fs').appendFileSync(${JSON.stringify(calls)}, JSON.stringify(process.argv.slice(2)) + '\\n')
`,
    { mode: 0o755 }
  )
  const originalPath = process.env.PATH
  process.env.PATH = `${fakeBin}${path.delimiter}${originalPath}`
  t.after(() => {
    process.env.PATH = originalPath
  })
  installWithProgress(['eslint@^9', 'prettier@^3'], 'npm', root)
  const invocations = fs.readFileSync(calls, 'utf8').trim().split('\n').map(JSON.parse)
  assert.deepEqual(invocations, [['install', 'eslint@^9', 'prettier@^3', '--save-dev']])
})

test('symlink CLI entry runs initialization instead of silently exiting', (t) => {
  const { gitRoot, workspaceRoot } = createWorkspaceFixture(t)
  const link = path.join(gitRoot, 'commit-pack-init')
  fs.symlinkSync(path.resolve('bin/index.mjs'), link)
  const result = spawnSync(process.execPath, [link, '-w', '@example/web'], {
    cwd: gitRoot,
    env: { ...process.env, INIT_CWD: gitRoot },
    encoding: 'utf8'
  })
  assert.equal(result.status, 0, result.stderr)
  assert.equal(fs.existsSync(path.join(workspaceRoot, '.commit-pack-init')), true)
})

for (const scenario of ['legacy config', 'flat config', 'ESLint 8']) {
  test(`initialization rejects ${scenario} before modifying the project`, (t) => {
    const { gitRoot, workspaceRoot } = createWorkspaceFixture(t)
    const manifest = path.join(workspaceRoot, 'package.json')
    if (scenario === 'ESLint 8') {
      const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'))
      pkg.devDependencies.eslint = '^8.57.1'
      fs.writeFileSync(manifest, JSON.stringify(pkg))
    } else {
      fs.writeFileSync(
        path.join(workspaceRoot, scenario === 'flat config' ? 'eslint.config.mjs' : '.eslintrc'),
        '{}'
      )
    }
    const before = fs.readFileSync(manifest, 'utf8')
    const result = runWorkspaceInitializer(gitRoot)
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /ESLint|eslint/)
    assert.equal(fs.readFileSync(manifest, 'utf8'), before)
    assert.equal(fs.existsSync(path.join(workspaceRoot, '.husky')), false)
    assert.equal(fs.existsSync(path.join(workspaceRoot, '.commit-pack-init')), false)
  })
}

test('generated ESLint, Prettier and Commitizen configurations work in an ESM project', (t) => {
  const { gitRoot, workspaceRoot } = createWorkspaceFixture(t)
  const manifest = path.join(workspaceRoot, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'))
  pkg.type = 'module'
  pkg.scripts = { prepare: 'node -e "process.exit(0)"' }
  fs.writeFileSync(manifest, JSON.stringify(pkg))
  const initialized = runWorkspaceInitializer(gitRoot)
  assert.equal(initialized.status, 0, initialized.stderr)
  assert.match(JSON.parse(fs.readFileSync(manifest, 'utf8')).scripts.prepare, /^node -e .* && cd /)
  fs.writeFileSync(path.join(workspaceRoot, 'valid.ts'), 'export const value: number = 1\n')
  fs.writeFileSync(path.join(workspaceRoot, 'valid.jsx'), 'export const View = () => <div />\n')
  const execute = (tool, args) =>
    spawnSync(process.execPath, [path.resolve(tool), ...args], {
      cwd: workspaceRoot,
      encoding: 'utf8'
    })
  const lint = execute('node_modules/eslint/bin/eslint.js', ['.', '--max-warnings=0'])
  assert.equal(lint.status, 0, lint.stdout + lint.stderr)
  const format = execute('node_modules/prettier/bin/prettier.cjs', ['valid.ts', '--check'])
  assert.equal(format.status, 0, format.stdout + format.stderr)
  fs.writeFileSync(path.join(workspaceRoot, 'invalid.js'), 'missingFunction()\n')
  const invalid = execute('node_modules/eslint/bin/eslint.js', ['invalid.js'])
  assert.notEqual(invalid.status, 0)
  assert.match(invalid.stdout, /no-undef/)
  fs.writeFileSync(
    path.join(workspaceRoot, 'check.cjs'),
    `const config = require('cz-customizable/lib/read-config-file.js')(); if (!config.types.some(t => t.value === '✨ feat')) process.exit(1)`
  )
  const cz = spawnSync(process.execPath, ['check.cjs'], { cwd: workspaceRoot, encoding: 'utf8' })
  assert.equal(cz.status, 0, cz.stderr)
})

test('generated Git hooks accept a valid commit and reject an invalid message', (t) => {
  const { gitRoot, workspaceRoot } = createWorkspaceFixture(t)
  const initialized = runWorkspaceInitializer(gitRoot)
  assert.equal(initialized.status, 0, initialized.stderr)
  execFileSync('git', ['config', 'user.name', 'Commit Pack Test'], { cwd: gitRoot })
  execFileSync('git', ['config', 'user.email', 'test@example.invalid'], { cwd: gitRoot })
  fs.writeFileSync(path.join(workspaceRoot, 'index.ts'), 'export const value: number = 1\n')
  execFileSync('git', ['add', 'packages/web/index.ts'], { cwd: gitRoot })
  const env = { ...process.env, HUSKY: '1' }
  const valid = spawnSync('git', ['commit', '-m', '✨ feat(api): add value'], {
    cwd: gitRoot,
    env,
    encoding: 'utf8',
    timeout: 30000
  })
  assert.equal(valid.status, 0, valid.stdout + valid.stderr)
  const invalid = spawnSync('git', ['commit', '--allow-empty', '-m', 'invalid message'], {
    cwd: gitRoot,
    env,
    encoding: 'utf8',
    timeout: 30000
  })
  assert.notEqual(invalid.status, 0)
  assert.match(invalid.stdout + invalid.stderr, /subject-empty|type-empty|scope-empty/)
})
