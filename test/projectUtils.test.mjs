import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  detectPackageManager,
  findProjectRoot,
  findWorkspaceRoot,
  getWorkspacePatterns
} from '../bin/projectUtils.mjs'

function createTemporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'commit-pack-test-'))
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }))
  return directory
}

function writePackageJson(directory, contents = {}) {
  fs.mkdirSync(directory, { recursive: true })
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify(contents), 'utf8')
}

test('findProjectRoot finds the lock-file root from a nested workspace', (t) => {
  const projectRoot = createTemporaryDirectory(t)
  const workspace = path.join(projectRoot, 'packages', 'web')
  writePackageJson(projectRoot, { private: true })
  writePackageJson(workspace, { name: '@example/web' })
  fs.writeFileSync(path.join(projectRoot, 'pnpm-lock.yaml'), '', 'utf8')

  assert.equal(findProjectRoot(workspace), projectRoot)
})

test('findProjectRoot falls back to the nearest package when no lock exists', (t) => {
  const projectRoot = createTemporaryDirectory(t)
  const nestedDirectory = path.join(projectRoot, 'src', 'feature')
  writePackageJson(projectRoot, { name: 'without-lock' })
  fs.mkdirSync(nestedDirectory, { recursive: true })

  assert.equal(findProjectRoot(nestedDirectory), projectRoot)
})

test('detectPackageManager supports both Bun lock-file formats', (t) => {
  const projectRoot = createTemporaryDirectory(t)
  fs.writeFileSync(path.join(projectRoot, 'bun.lockb'), '', 'utf8')
  assert.equal(detectPackageManager(projectRoot), 'bun')

  fs.rmSync(path.join(projectRoot, 'bun.lockb'))
  fs.writeFileSync(path.join(projectRoot, 'bun.lock'), '', 'utf8')
  assert.equal(detectPackageManager(projectRoot), 'bun')
})

test('findWorkspaceRoot handles nested globs, braces, and exclusions', (t) => {
  const projectRoot = createTemporaryDirectory(t)
  writePackageJson(projectRoot, {
    private: true,
    workspaces: ['packages/**', '{apps,tools}/*', '!packages/excluded/**']
  })
  const nestedPackage = path.join(projectRoot, 'packages', 'group', 'api')
  const appPackage = path.join(projectRoot, 'apps', 'web')
  const excludedPackage = path.join(projectRoot, 'packages', 'excluded', 'private')
  writePackageJson(nestedPackage, { name: '@example/api' })
  writePackageJson(appPackage, { name: '@example/web' })
  writePackageJson(excludedPackage, { name: '@example/private' })

  assert.equal(findWorkspaceRoot(projectRoot, '@example/api'), nestedPackage)
  assert.equal(findWorkspaceRoot(projectRoot, 'web'), appPackage)
  assert.throws(() => findWorkspaceRoot(projectRoot, '@example/private'), /找不到 workspace/)
})

test('pnpm-workspace.yaml patterns are used when package.json has none', (t) => {
  const projectRoot = createTemporaryDirectory(t)
  writePackageJson(projectRoot, { private: true })
  fs.writeFileSync(
    path.join(projectRoot, 'pnpm-workspace.yaml'),
    "packages:\n  - 'services/*'\n\ncatalog:\n  react: ^19.0.0\n",
    'utf8'
  )
  const servicePackage = path.join(projectRoot, 'services', 'worker')
  writePackageJson(servicePackage, { name: '@example/worker' })

  assert.deepEqual(getWorkspacePatterns(projectRoot), ['services/*'])
  assert.equal(findWorkspaceRoot(projectRoot, '@example/worker'), servicePackage)
})

test('detectPackageManager uses declared manager and pnpm workspace before the first lockfile', (t) => {
  const root = createTemporaryDirectory(t)
  writePackageJson(root, { packageManager: 'yarn@4.0.0' })
  assert.equal(detectPackageManager(root), 'yarn')
  writePackageJson(root)
  fs.writeFileSync(path.join(root, 'pnpm-workspace.yaml'), 'packages: []\n')
  assert.equal(detectPackageManager(root), 'pnpm')
})
