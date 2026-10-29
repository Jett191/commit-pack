import fs from 'fs'
import os from 'os'
import path from 'path'

export function createFileTransaction(targetPaths) {
  const backupRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'commit-pack-rollback-'))
  const uniqueTargets = [...new Set(targetPaths.map((target) => path.resolve(target)))]
  const entries = uniqueTargets.map((target, index) => {
    const existed = fs.existsSync(target)
    const backupPath = path.join(backupRoot, String(index))

    if (existed) {
      fs.cpSync(target, backupPath, {
        recursive: true,
        preserveTimestamps: true
      })
    }

    return { target, existed, backupPath }
  })

  let closed = false

  const cleanup = () => {
    fs.rmSync(backupRoot, { recursive: true, force: true })
    closed = true
  }

  return {
    commit() {
      if (!closed) cleanup()
    },

    rollback() {
      if (closed) return

      for (const entry of entries) {
        fs.rmSync(entry.target, { recursive: true, force: true })
        if (entry.existed) {
          fs.mkdirSync(path.dirname(entry.target), { recursive: true })
          fs.cpSync(entry.backupPath, entry.target, {
            recursive: true,
            preserveTimestamps: true
          })
        }
      }

      cleanup()
    }
  }
}
