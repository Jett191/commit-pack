/* eslint-env node */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const repositoryRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const sourceDirectory = path.join(repositoryRoot, 'bin')
const outputDirectory = path.join(repositoryRoot, 'lib')

fs.rmSync(outputDirectory, { recursive: true, force: true })
fs.mkdirSync(outputDirectory, { recursive: true })

const sourceFiles = fs
  .readdirSync(sourceDirectory)
  .filter((file) => file.endsWith('.mjs'))

for (const file of sourceFiles) {
  fs.copyFileSync(path.join(sourceDirectory, file), path.join(outputDirectory, file))
}

console.log(`Built ${sourceFiles.length} files into lib/`)
