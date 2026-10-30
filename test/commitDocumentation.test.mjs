import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import test from 'node:test'
import { getDocumentationPaths, writeCommitDocumentation } from '../bin/commitDocumentation.mjs'

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'commit-pack-docs-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  fs.writeFileSync(path.join(root, 'package.json'), '{}')
  fs.symlinkSync(path.resolve('node_modules'), path.join(root, 'node_modules'), 'dir')
  for (const script of ['cz-config.sh', 'commitlintrc.sh']) {
    execFileSync('sh', [path.resolve('setup-script', script)], { cwd: root })
  }
  return root
}

test('conventions match all generated types and examples pass actual commitlint', (t) => {
  const root = fixture(t)
  writeCommitDocumentation(root)
  const doc = fs.readFileSync(path.join(root, 'COMMIT_CONVENTION.md'), 'utf8')
  const require = createRequire(path.join(root, 'package.json'))
  const cz = require('./.cz-config.cjs')
  const buildCommit = require('cz-customizable/lib/build-commit.js')
  assert.match(doc, /scope 必填/)
  assert.match(doc, /49 个字符/)
  assert.match(doc, /ISSUES CLOSED:/)
  for (const { value } of cz.types) {
    assert.ok(doc.includes(`- \`${value}\``))
    const message = buildCommit(
      { type: value, scope: 'api', subject: '添加输入校验', breaking: '', footer: '' },
      cz
    )
    const checked = spawnSync(
      process.execPath,
      [path.resolve('node_modules/@commitlint/cli/cli.js')],
      {
        cwd: root,
        input: message,
        encoding: 'utf8'
      }
    )
    assert.equal(checked.status, 0, checked.stdout + checked.stderr)
  }
  const example = doc.match(/## 拼接示例\n\n```text\n([^`]+)\n```/)[1]
  const checked = spawnSync(
    process.execPath,
    [path.resolve('node_modules/@commitlint/cli/cli.js')],
    {
      cwd: root,
      input: example,
      encoding: 'utf8'
    }
  )
  assert.equal(checked.status, 0, checked.stdout + checked.stderr)
  for (const file of ['AGENTS.md', 'CLAUDE.md', '.github'])
    assert.equal(fs.existsSync(path.join(root, file)), false)
})

test('managed references preserve user text and CRLF, use relative links, and are idempotent', (t) => {
  const root = fixture(t)
  fs.mkdirSync(path.join(root, '.github'))
  const files = [
    'AGENTS.md',
    'CLAUDE.md',
    '.github/copilot-instructions.md',
    'COMMIT_CONVENTION.md'
  ]
  for (const file of files) fs.writeFileSync(path.join(root, file), '用户已有内容\r\n')
  writeCommitDocumentation(root)
  const snapshots = files.map((file) => fs.readFileSync(path.join(root, file), 'utf8'))
  snapshots.forEach((text) => {
    assert.ok(text.startsWith('用户已有内容\r\n'))
    assert.equal(text.split('<!-- commit-pack:begin -->').length, 2)
    assert.doesNotMatch(text, /(?<!\r)\n/)
  })
  assert.match(snapshots[0], /\]\(COMMIT_CONVENTION\.md\)/)
  assert.match(snapshots[2], /\]\(\.\.\/COMMIT_CONVENTION\.md\)/)
  writeCommitDocumentation(root)
  files.forEach((file, index) =>
    assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), snapshots[index])
  )
})

test('reruns use customized config and update only the managed convention block', (t) => {
  const root = fixture(t)
  writeCommitDocumentation(root)
  const convention = path.join(root, 'COMMIT_CONVENTION.md')
  fs.appendFileSync(convention, '\n用户补充\n')
  fs.writeFileSync(
    path.join(root, 'custom.cjs'),
    `module.exports = {
    types: [{value: '🔧 custom', name: '自定义类型'}], scopes: [{name: 'server'}],
    subjectLimit: 30, footerPrefix: 'Refs:', allowCustomScopes: true
  }`
  )
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({
      config: { 'cz-customizable': { config: 'custom.cjs' } }
    })
  )
  const lintFile = path.join(root, '.commitlintrc.json')
  const lint = JSON.parse(fs.readFileSync(lintFile, 'utf8'))
  lint.rules['type-enum'][2] = ['🔧 custom']
  fs.writeFileSync(lintFile, JSON.stringify(lint))
  writeCommitDocumentation(root)
  const doc = fs.readFileSync(convention, 'utf8')
  assert.match(doc, /🔧 custom\(server\): 添加输入校验/)
  assert.match(doc, /30 个字符/)
  assert.match(doc, /Refs:/)
  assert.ok(doc.endsWith('\n用户补充\n'))
  assert.doesNotMatch(doc, /✨ feat/)
})

test('malformed managed blocks fail without overwriting user content', (t) => {
  const root = fixture(t)
  const file = path.join(root, 'COMMIT_CONVENTION.md')
  const original = '用户内容\n<!-- commit-pack:begin -->\n未完成区块'
  fs.writeFileSync(file, original)
  assert.throws(() => writeCommitDocumentation(root), /标记不完整或重复/)
  assert.equal(fs.readFileSync(file, 'utf8'), original)
})

test('symlinked instruction files and parent directories are excluded from writes and backups', (t) => {
  const root = fixture(t)
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'commit-pack-outside-'))
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }))
  fs.writeFileSync(path.join(outside, 'copilot-instructions.md'), 'outside')
  fs.symlinkSync(path.join(outside, 'copilot-instructions.md'), path.join(root, 'AGENTS.md'))
  fs.symlinkSync(outside, path.join(root, '.github'), 'dir')
  assert.deepEqual(getDocumentationPaths(root), [path.join(root, 'COMMIT_CONVENTION.md')])
  writeCommitDocumentation(root)
  assert.equal(fs.readFileSync(path.join(outside, 'copilot-instructions.md'), 'utf8'), 'outside')
  fs.unlinkSync(path.join(root, 'COMMIT_CONVENTION.md'))
  fs.symlinkSync(
    path.join(outside, 'copilot-instructions.md'),
    path.join(root, 'COMMIT_CONVENTION.md')
  )
  assert.deepEqual(getDocumentationPaths(root), [])
  writeCommitDocumentation(root)
  assert.equal(fs.readFileSync(path.join(outside, 'copilot-instructions.md'), 'utf8'), 'outside')
})
