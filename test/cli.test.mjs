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

for (const repairing of [false, true]) {
  for (const [declared, installed, succeeds] of [
    ['^4', '4.9.5', true],
    ['^4.9.5', '4.9.5', true],
    ['^5', '5.9.3', true],
    ['^5.9.3', '5.9.3', true],
    ['^4', '4.7.4', false],
    ['^4', '5.9.3', false],
    ['^6', '6.0.0', false],
    ['latest', '5.9.3', false],
    ['^4', null, false],
    ['^5', null, true]
  ]) {
    test(`TypeScript ${declared} / ${installed} during ${repairing ? 'repair' : 'initialization'}`, (t) => {
      const { gitRoot, workspaceRoot } = createWorkspaceFixture(t)
      const manifest = path.join(workspaceRoot, 'package.json')
      const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'))
      pkg.devDependencies.typescript = declared
      fs.writeFileSync(manifest, JSON.stringify(pkg))
      const before = fs.readFileSync(manifest, 'utf8')
      // Isolate package resolution without modifying the shared node_modules symlink.
      const modules = path.join(workspaceRoot, 'node_modules')
      fs.unlinkSync(modules)
      fs.mkdirSync(modules)
      fs.symlinkSync(path.resolve('node_modules/husky'), path.join(modules, 'husky'), 'dir')
      if (installed) {
        fs.mkdirSync(path.join(modules, 'typescript'))
        fs.writeFileSync(
          path.join(modules, 'typescript/package.json'),
          JSON.stringify({ name: 'typescript', version: installed })
        )
      }
      if (repairing) fs.writeFileSync(path.join(workspaceRoot, '.commit-pack-init'), 'initialized')
      const result = runWorkspaceInitializer(gitRoot)
      assert.equal(result.status, succeeds ? 0 : 1, result.stdout + result.stderr)
      assert.equal(
        JSON.parse(fs.readFileSync(manifest, 'utf8')).devDependencies.typescript,
        declared
      )
      if (succeeds) {
        assert.match(result.stdout, /所有开发依赖已声明，跳过安装/)
        if (declared === '^4') assert.match(result.stdout, /该范围包含不受支持的版本/)
      } else {
        assert.match(result.stderr, /初始化预检查失败/)
        assert.match(result.stderr, /typescript 声明范围/)
        assert.doesNotMatch(result.stdout + result.stderr, /回滚完成/)
        assert.equal(fs.readFileSync(manifest, 'utf8'), before)
        assert.equal(fs.existsSync(path.join(workspaceRoot, 'eslint.config.mjs')), false)
        assert.equal(fs.existsSync(path.join(workspaceRoot, '.commit-pack-init')), repairing)
      }
    })
  }
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
  assert.equal(fs.existsSync(path.join(workspaceRoot, 'COMMIT_CONVENTION.md')), true)
})

test('workspace repair updates only target AI documents and rolls back documentation failures', (t) => {
  const { gitRoot, workspaceRoot } = createWorkspaceFixture(t)
  fs.writeFileSync(path.join(gitRoot, 'AGENTS.md'), 'root instructions')
  const agents = path.join(workspaceRoot, 'AGENTS.md')
  const claude = path.join(workspaceRoot, 'CLAUDE.md')
  const convention = path.join(workspaceRoot, 'COMMIT_CONVENTION.md')
  fs.writeFileSync(agents, 'workspace instructions')
  const first = runWorkspaceInitializer(gitRoot)
  assert.equal(first.status, 0, first.stdout + first.stderr)
  assert.equal(fs.readFileSync(path.join(gitRoot, 'AGENTS.md'), 'utf8'), 'root instructions')
  assert.match(fs.readFileSync(agents, 'utf8'), /COMMIT_CONVENTION.md/)
  fs.writeFileSync(agents, 'new user instructions')
  fs.writeFileSync(claude, '<!-- commit-pack:begin -->\nunfinished')
  // Force generation of a new guide before the later CLAUDE.md failure.
  fs.unlinkSync(convention)
  const manifest = fs.readFileSync(path.join(workspaceRoot, 'package.json'), 'utf8')
  const failed = runWorkspaceInitializer(gitRoot)
  assert.equal(failed.status, 1)
  assert.match(failed.stderr, /标记不完整或重复/)
  assert.equal(fs.readFileSync(agents, 'utf8'), 'new user instructions')
  assert.equal(fs.readFileSync(claude, 'utf8'), '<!-- commit-pack:begin -->\nunfinished')
  assert.equal(fs.existsSync(convention), false)
  assert.equal(fs.readFileSync(path.join(workspaceRoot, 'package.json'), 'utf8'), manifest)
  assert.equal(
    fs.readFileSync(path.join(workspaceRoot, '.commit-pack-init'), 'utf8'),
    'initialized'
  )
  fs.writeFileSync(claude, 'fixed instructions')
  const repaired = runWorkspaceInitializer(gitRoot)
  assert.equal(repaired.status, 0, repaired.stdout + repaired.stderr)
  const beforeRepeat = fs.readFileSync(agents, 'utf8')
  assert.equal(runWorkspaceInitializer(gitRoot).status, 0)
  assert.equal(fs.readFileSync(agents, 'utf8'), beforeRepeat)
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
  // Exercise actual Git hooks after recovering the reported missing-script state.
  const manifest = path.join(workspaceRoot, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'))
  delete pkg.scripts.commit
  fs.writeFileSync(manifest, JSON.stringify(pkg))
  const repaired = runWorkspaceInitializer(gitRoot)
  assert.equal(repaired.status, 0, repaired.stderr)
  assert.equal(JSON.parse(fs.readFileSync(manifest, 'utf8')).scripts.commit, 'cz')
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

for (const args of [['-w'], ['--workspace='], ['-w', '--unknown']]) {
  test(`missing workspace name is rejected: ${args.join(' ')}`, () => {
    assert.throws(() => parseWorkspaceName(args), /工作区名称/)
  })
}

for (const missing of ['scripts', 'config', 'files', 'marker-only']) {
  test(`marked initialization repairs ${missing} and preserves custom content`, (t) => {
    const { gitRoot, workspaceRoot } = createWorkspaceFixture(t)
    const manifest = path.join(workspaceRoot, 'package.json')
    if (missing !== 'marker-only') {
      const first = runWorkspaceInitializer(gitRoot)
      assert.equal(first.status, 0, first.stderr)
    }
    fs.writeFileSync(path.join(workspaceRoot, '.commit-pack-init'), 'initialized')
    const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'))
    if (missing === 'scripts') delete pkg.scripts
    if (missing === 'config') delete pkg.config
    pkg.scripts = { ...pkg.scripts, lint: 'echo custom-lint' }
    fs.writeFileSync(manifest, JSON.stringify(pkg))
    fs.writeFileSync(path.join(workspaceRoot, '.prettierrc'), '{"semi":true}\n')
    if (missing === 'files') {
      fs.rmSync(path.join(workspaceRoot, '.cz-config.cjs'))
      fs.rmSync(path.join(workspaceRoot, '.husky', 'commit-msg'))
      fs.writeFileSync(path.join(workspaceRoot, '.husky', 'pre-commit'), '# custom hook\n')
    }
    const repaired = runWorkspaceInitializer(gitRoot)
    assert.equal(repaired.status, 0, repaired.stdout + repaired.stderr)
    const after = JSON.parse(fs.readFileSync(manifest, 'utf8'))
    assert.equal(after.scripts.commit, 'cz')
    assert.equal(after.scripts.lint, 'echo custom-lint')
    assert.equal(after.config['cz-customizable'].config, '.cz-config.cjs')
    assert.equal(
      fs.readFileSync(path.join(workspaceRoot, '.prettierrc'), 'utf8'),
      '{"semi":true}\n'
    )
    assert.ok(fs.existsSync(path.join(workspaceRoot, '.cz-config.cjs')))
    assert.ok(fs.existsSync(path.join(workspaceRoot, '.husky', 'commit-msg')))
    if (missing === 'files') {
      assert.equal(
        fs.readFileSync(path.join(workspaceRoot, '.husky', 'pre-commit'), 'utf8'),
        '# custom hook\n'
      )
    }
    const beforeRepeat = fs.readFileSync(manifest, 'utf8')
    const repeated = runWorkspaceInitializer(gitRoot)
    assert.equal(repeated.status, 0, repeated.stderr)
    assert.equal(fs.readFileSync(manifest, 'utf8'), beforeRepeat)
  })
}

test('marked incompatible projects fail without overwriting their configuration', (t) => {
  const { gitRoot, workspaceRoot } = createWorkspaceFixture(t)
  fs.writeFileSync(path.join(workspaceRoot, '.commit-pack-init'), 'initialized')
  fs.writeFileSync(path.join(workspaceRoot, '.eslintrc'), '{"custom":true}')
  const before = fs.readFileSync(path.join(workspaceRoot, 'package.json'), 'utf8')
  const result = runWorkspaceInitializer(gitRoot)
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /已有 ESLint 配置/)
  assert.equal(fs.readFileSync(path.join(workspaceRoot, 'package.json'), 'utf8'), before)
  assert.equal(fs.readFileSync(path.join(workspaceRoot, '.eslintrc'), 'utf8'), '{"custom":true}')
})

test('failed marked repair rolls back and retains its original marker', (t) => {
  const { gitRoot, workspaceRoot } = createWorkspaceFixture(t)
  fs.writeFileSync(path.join(workspaceRoot, '.commit-pack-init'), 'initialized')
  fs.writeFileSync(path.join(workspaceRoot, '.husky'), 'blocked')
  const before = fs.readFileSync(path.join(workspaceRoot, 'package.json'), 'utf8')
  const result = runWorkspaceInitializer(gitRoot)
  assert.notEqual(result.status, 0)
  assert.equal(fs.readFileSync(path.join(workspaceRoot, 'package.json'), 'utf8'), before)
  assert.equal(
    fs.readFileSync(path.join(workspaceRoot, '.commit-pack-init'), 'utf8'),
    'initialized'
  )
  assert.equal(fs.readFileSync(path.join(workspaceRoot, '.husky'), 'utf8'), 'blocked')
})

test('root project repair preserves custom prepare and Commitizen settings on repeated runs', (t) => {
  const { workspaceRoot } = createWorkspaceFixture(t)
  const manifest = path.join(workspaceRoot, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'))
  pkg.scripts = { prepare: 'echo custom-prepare' }
  pkg.config = { commitizen: { path: 'custom-adapter' } }
  fs.writeFileSync(manifest, JSON.stringify(pkg))
  fs.writeFileSync(path.join(workspaceRoot, '.commit-pack-init'), 'initialized')
  const invoke = () =>
    spawnSync(process.execPath, [path.resolve('bin/index.mjs')], {
      cwd: workspaceRoot,
      env: { ...process.env, INIT_CWD: workspaceRoot },
      encoding: 'utf8',
      timeout: 10000
    })
  const first = invoke()
  assert.equal(first.status, 0, first.stderr)
  const after = fs.readFileSync(manifest, 'utf8')
  assert.equal(JSON.parse(after).scripts.commit, 'cz')
  assert.equal(JSON.parse(after).config.commitizen.path, 'custom-adapter')
  assert.match(JSON.parse(after).scripts.prepare, /^echo custom-prepare && cd /)
  const second = invoke()
  assert.equal(second.status, 0, second.stderr)
  assert.equal(fs.readFileSync(manifest, 'utf8'), after)
})

test('failed dependency installation during repair restores manifest and lockfile', (t) => {
  const { gitRoot, workspaceRoot } = createWorkspaceFixture(t)
  const manifest = path.join(workspaceRoot, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'))
  delete pkg.devDependencies.commitizen
  fs.writeFileSync(manifest, JSON.stringify(pkg))
  const before = fs.readFileSync(manifest, 'utf8')
  fs.writeFileSync(path.join(workspaceRoot, '.commit-pack-init'), 'initialized')
  const lock = path.join(gitRoot, 'package-lock.json')
  fs.writeFileSync(lock, 'original lock')
  const fakeBin = path.join(gitRoot, 'fake-bin')
  fs.mkdirSync(fakeBin)
  fs.writeFileSync(
    path.join(fakeBin, 'npm'),
    `#!${process.execPath}
const fs = require('fs')
fs.writeFileSync('package.json', '{}')
fs.writeFileSync(${JSON.stringify(lock)}, 'changed lock')
process.exit(1)
`,
    { mode: 0o755 }
  )
  const result = spawnSync(
    process.execPath,
    [path.resolve('bin/index.mjs'), '-w', '@example/web'],
    {
      cwd: gitRoot,
      env: {
        ...process.env,
        INIT_CWD: gitRoot,
        PATH: `${fakeBin}${path.delimiter}${process.env.PATH}`
      },
      encoding: 'utf8',
      timeout: 10000
    }
  )
  assert.notEqual(result.status, 0)
  assert.equal(fs.readFileSync(manifest, 'utf8'), before)
  assert.equal(fs.readFileSync(lock, 'utf8'), 'original lock')
  assert.equal(
    fs.readFileSync(path.join(workspaceRoot, '.commit-pack-init'), 'utf8'),
    'initialized'
  )
  assert.equal(fs.existsSync(path.join(workspaceRoot, '.husky')), false)
})

test('marked repair installs missing dependencies once and retains package manager changes', (t) => {
  const { gitRoot, workspaceRoot } = createWorkspaceFixture(t)
  const manifest = path.join(workspaceRoot, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'))
  delete pkg.devDependencies.commitizen
  fs.writeFileSync(manifest, JSON.stringify(pkg))
  fs.writeFileSync(path.join(workspaceRoot, '.commit-pack-init'), 'initialized')
  const fakeBin = path.join(gitRoot, 'fake-bin')
  const calls = path.join(gitRoot, 'calls.jsonl')
  fs.mkdirSync(fakeBin)
  fs.writeFileSync(
    path.join(fakeBin, 'npm'),
    `#!${process.execPath}
const fs = require('fs')
fs.appendFileSync(${JSON.stringify(calls)}, JSON.stringify(process.argv.slice(2)) + '\\n')
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.devDependencies.commitizen = '^4.3.1'
fs.writeFileSync('package.json', JSON.stringify(pkg))
`,
    { mode: 0o755 }
  )
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = spawnSync(
      process.execPath,
      [path.resolve('bin/index.mjs'), '-w', '@example/web'],
      {
        cwd: gitRoot,
        env: {
          ...process.env,
          INIT_CWD: gitRoot,
          PATH: `${fakeBin}${path.delimiter}${process.env.PATH}`
        },
        encoding: 'utf8',
        timeout: 10000
      }
    )
    assert.equal(result.status, 0, result.stderr)
  }
  assert.deepEqual(fs.readFileSync(calls, 'utf8').trim().split('\n').map(JSON.parse), [
    ['install', 'commitizen@^4.3.1', '--save-dev']
  ])
  const after = JSON.parse(fs.readFileSync(manifest, 'utf8'))
  assert.equal(after.devDependencies.commitizen, '^4.3.1')
  assert.equal(after.scripts.commit, 'cz')
})

test('repair rechecks TypeScript after installation and rolls back an incompatible resolution', (t) => {
  const { gitRoot, workspaceRoot } = createWorkspaceFixture(t)
  const manifest = path.join(workspaceRoot, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'))
  pkg.devDependencies.typescript = '^4'
  delete pkg.devDependencies.commitizen
  fs.writeFileSync(manifest, JSON.stringify(pkg))
  const before = fs.readFileSync(manifest, 'utf8')
  const modules = path.join(workspaceRoot, 'node_modules')
  fs.unlinkSync(modules)
  fs.mkdirSync(path.join(modules, 'typescript'), { recursive: true })
  fs.writeFileSync(path.join(modules, 'typescript/package.json'), '{"version":"4.9.5"}')
  fs.writeFileSync(path.join(workspaceRoot, '.commit-pack-init'), 'initialized')
  const lock = path.join(gitRoot, 'package-lock.json')
  fs.writeFileSync(lock, 'original lock')
  const fakeBin = path.join(gitRoot, 'fake-bin')
  fs.mkdirSync(fakeBin)
  fs.writeFileSync(
    path.join(fakeBin, 'npm'),
    `#!${process.execPath}
const fs = require('fs')
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.devDependencies.commitizen = '^4.3.1'
fs.writeFileSync('package.json', JSON.stringify(pkg))
fs.writeFileSync('node_modules/typescript/package.json', '{"version":"4.7.4"}')
fs.writeFileSync(${JSON.stringify(lock)}, 'changed lock')
`,
    { mode: 0o755 }
  )
  const result = spawnSync(
    process.execPath,
    [path.resolve('bin/index.mjs'), '-w', '@example/web'],
    {
      cwd: gitRoot,
      env: {
        ...process.env,
        INIT_CWD: gitRoot,
        PATH: `${fakeBin}${path.delimiter}${process.env.PATH}`
      },
      encoding: 'utf8',
      timeout: 10000
    }
  )
  assert.equal(result.status, 1, result.stdout + result.stderr)
  assert.match(result.stderr, /已安装版本 4\.7\.4/)
  assert.match(result.stdout, /回滚完成/)
  assert.equal(fs.readFileSync(manifest, 'utf8'), before)
  assert.equal(fs.readFileSync(lock, 'utf8'), 'original lock')
  assert.equal(
    fs.readFileSync(path.join(workspaceRoot, '.commit-pack-init'), 'utf8'),
    'initialized'
  )
  assert.equal(fs.existsSync(path.join(workspaceRoot, 'eslint.config.mjs')), false)
})
