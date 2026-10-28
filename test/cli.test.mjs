/* eslint-env node */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import test from 'node:test'
import { getWorkspaceHuskyConfiguration, parseWorkspaceName } from '../bin/index.mjs'
import { getInstallCommand } from '../bin/installWithProgress.mjs'

const REQUIRED_DEPENDENCIES = [
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
  'prettier-plugin-tailwindcss',
  'commitizen',
  'eslint'
]

function createWorkspaceFixture(t) {
  const gitRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'commit-pack-test-'))
  const workspaceRoot = path.join(gitRoot, 'packages', 'web')
  const devDependencies = Object.fromEntries(
    REQUIRED_DEPENDENCIES.map((dependency) => [dependency, '*'])
  )
  t.after(() => fs.rmSync(gitRoot, { recursive: true, force: true }))

  fs.mkdirSync(workspaceRoot, { recursive: true })
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
  return spawnSync(
    process.execPath,
    [path.resolve('bin/index.mjs'), '--workspace=@example/web'],
    {
      cwd: gitRoot,
      env: { ...process.env, INIT_CWD: gitRoot },
      encoding: 'utf8',
      timeout: 10000
    }
  )
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
  assert.deepEqual(
    getInstallCommand('eslint', 'pnpm', { installAtWorkspaceRoot: true }),
    { command: 'pnpm', args: ['add', '-w', '-D', 'eslint'] }
  )
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
    JSON.parse(fs.readFileSync(path.join(workspaceRoot, 'package.json'), 'utf8'))
      .scripts.prepare,
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
  assert.equal(
    fs.readFileSync(path.join(workspaceRoot, '.prettierrc'), 'utf8'),
    'original'
  )
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

  for (const configFile of [
    '.prettierrc',
    '.eslintrc',
    '.commitlintrc.json',
    '.lintstagedrc',
    '.czrc'
  ]) {
    assert.doesNotThrow(() =>
      JSON.parse(fs.readFileSync(path.join(projectRoot, configFile), 'utf8'))
    )
  }
  assert.equal(fs.existsSync(path.join(projectRoot, '.husky', 'pre-commit')), true)
  assert.equal(fs.existsSync(path.join(projectRoot, '.husky', 'commit-msg')), true)
  assert.match(
    fs.readFileSync(path.join(projectRoot, '.husky', 'pre-commit'), 'utf8'),
    /cd "\$HOOK_DIR\/\.\."/
  )
})
