import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createFileTransaction } from '../bin/fileTransaction.mjs'

test('rollback restores existing paths and removes newly created paths', (t) => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'commit-pack-test-'))
  t.after(() => fs.rmSync(projectRoot, { recursive: true, force: true }))

  const existingFile = path.join(projectRoot, 'package.json')
  const existingDirectory = path.join(projectRoot, '.husky')
  const newFile = path.join(projectRoot, '.prettierrc')
  fs.writeFileSync(existingFile, '{"name":"original"}', 'utf8')
  fs.mkdirSync(existingDirectory)
  fs.writeFileSync(path.join(existingDirectory, 'pre-commit'), 'original', 'utf8')

  const transaction = createFileTransaction([existingFile, existingDirectory, newFile])
  fs.writeFileSync(existingFile, '{"name":"changed"}', 'utf8')
  fs.writeFileSync(path.join(existingDirectory, 'pre-commit'), 'changed', 'utf8')
  fs.writeFileSync(newFile, '{}', 'utf8')

  transaction.rollback()

  assert.equal(fs.readFileSync(existingFile, 'utf8'), '{"name":"original"}')
  assert.equal(fs.readFileSync(path.join(existingDirectory, 'pre-commit'), 'utf8'), 'original')
  assert.equal(fs.existsSync(newFile), false)
})

test('commit keeps changes', (t) => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'commit-pack-test-'))
  t.after(() => fs.rmSync(projectRoot, { recursive: true, force: true }))
  const target = path.join(projectRoot, 'package.json')
  fs.writeFileSync(target, 'before', 'utf8')

  const transaction = createFileTransaction([target])
  fs.writeFileSync(target, 'after', 'utf8')
  transaction.commit()

  assert.equal(fs.readFileSync(target, 'utf8'), 'after')
})
