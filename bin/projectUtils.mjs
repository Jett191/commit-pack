/* eslint-env node */

import fs from 'fs'
import path from 'path'

export const LOCK_FILES = [
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
  'package-lock.json'
]

const SKIPPED_DIRECTORIES = new Set(['.git', 'node_modules'])

function normalizeWorkspacePattern(pattern) {
  return pattern.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '')
}

function escapeRegExpCharacter(character) {
  return /[\\^$.*+?()[\]{}|]/.test(character) ? `\\${character}` : character
}

function expandBraces(pattern) {
  const match = pattern.match(/\{([^{}]+)\}/)
  if (!match) return [pattern]

  return match[1]
    .split(',')
    .flatMap((part) =>
      expandBraces(
        `${pattern.slice(0, match.index)}${part}${pattern.slice(
          match.index + match[0].length
        )}`
      )
    )
}

function globToRegExp(pattern) {
  let expression = '^'

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index]

    if (character === '*' && pattern[index + 1] === '*') {
      if (pattern[index + 2] === '/') {
        expression += '(?:.*/)?'
        index += 2
      } else {
        expression += '.*'
        index += 1
      }
    } else if (character === '*') {
      expression += '[^/]*'
    } else if (character === '?') {
      expression += '[^/]'
    } else {
      expression += escapeRegExpCharacter(character)
    }
  }

  return new RegExp(`${expression}$`)
}

function matchesPattern(relativePath, pattern) {
  return expandBraces(pattern).some((item) => globToRegExp(item).test(relativePath))
}

function isPathInside(parent, candidate) {
  const relative = path.relative(parent, candidate)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function getSearchBase(projectRoot, pattern) {
  const wildcardIndex = pattern.search(/[?*{[]/)
  let staticPart = wildcardIndex === -1 ? pattern : pattern.slice(0, wildcardIndex)

  if (!staticPart.endsWith('/')) {
    staticPart = path.posix.dirname(staticPart)
  }

  const searchBase = path.resolve(projectRoot, staticPart === '.' ? '' : staticPart)
  return isPathInside(projectRoot, searchBase) ? searchBase : null
}

function discoverPackageDirectories(searchBase) {
  if (!searchBase || !fs.existsSync(searchBase)) return []

  const directories = []
  const pending = [searchBase]

  while (pending.length > 0) {
    const currentDirectory = pending.pop()

    if (fs.existsSync(path.join(currentDirectory, 'package.json'))) {
      directories.push(currentDirectory)
    }

    for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
      if (entry.isDirectory() && !SKIPPED_DIRECTORIES.has(entry.name)) {
        pending.push(path.join(currentDirectory, entry.name))
      }
    }
  }

  return directories
}

function readPackageJsonWorkspaces(projectRoot) {
  const packageJsonPath = path.join(projectRoot, 'package.json')
  if (!fs.existsSync(packageJsonPath)) return []

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  if (Array.isArray(packageJson.workspaces)) return packageJson.workspaces
  if (Array.isArray(packageJson.workspaces?.packages)) {
    return packageJson.workspaces.packages
  }

  return []
}

function stripYamlValue(value) {
  const withoutComment = value.replace(/\s+#.*$/, '').trim()
  if (
    (withoutComment.startsWith("'") && withoutComment.endsWith("'")) ||
    (withoutComment.startsWith('"') && withoutComment.endsWith('"'))
  ) {
    return withoutComment.slice(1, -1)
  }
  return withoutComment
}

function readPnpmWorkspaces(projectRoot) {
  const workspacePath = path.join(projectRoot, 'pnpm-workspace.yaml')
  if (!fs.existsSync(workspacePath)) return []

  const patterns = []
  let readingPackages = false

  for (const line of fs.readFileSync(workspacePath, 'utf8').split(/\r?\n/)) {
    if (/^packages\s*:/.test(line)) {
      readingPackages = true
      continue
    }
    if (readingPackages && /^\S/.test(line)) break

    const match = readingPackages ? line.match(/^\s*-\s*(.+?)\s*$/) : null
    if (match) patterns.push(stripYamlValue(match[1]))
  }

  return patterns
}

export function getInvocationDirectory({
  cwd = process.cwd(),
  initCwd = process.env.INIT_CWD
} = {}) {
  return path.resolve(initCwd || cwd)
}

export function findProjectRoot(startDirectory) {
  const startingPath = path.resolve(startDirectory)
  let directory = startingPath
  let nearestPackageDirectory = null

  while (directory) {
    if (LOCK_FILES.some((file) => fs.existsSync(path.join(directory, file)))) {
      return directory
    }

    if (
      nearestPackageDirectory === null &&
      fs.existsSync(path.join(directory, 'package.json'))
    ) {
      nearestPackageDirectory = directory
    }

    const parent = path.dirname(directory)
    if (parent === directory) return nearestPackageDirectory || startingPath
    directory = parent
  }

  return nearestPackageDirectory || startingPath
}

export function detectPackageManager(projectRoot) {
  if (fs.existsSync(path.join(projectRoot, 'pnpm-lock.yaml'))) return 'pnpm'
  if (fs.existsSync(path.join(projectRoot, 'yarn.lock'))) return 'yarn'
  if (
    fs.existsSync(path.join(projectRoot, 'bun.lock')) ||
    fs.existsSync(path.join(projectRoot, 'bun.lockb'))
  ) {
    return 'bun'
  }
  return 'npm'
}

export function getWorkspacePatterns(projectRoot) {
  return [
    ...new Set([
      ...readPackageJsonWorkspaces(projectRoot),
      ...readPnpmWorkspaces(projectRoot)
    ])
  ]
}

export function findWorkspaceRoot(projectRoot, workspaceName) {
  const rawPatterns = getWorkspacePatterns(projectRoot)
  const includedPatterns = rawPatterns
    .filter((pattern) => typeof pattern === 'string' && !pattern.startsWith('!'))
    .map(normalizeWorkspacePattern)
  const excludedPatterns = rawPatterns
    .filter((pattern) => typeof pattern === 'string' && pattern.startsWith('!'))
    .map((pattern) => normalizeWorkspacePattern(pattern.slice(1)))

  if (includedPatterns.length === 0) {
    throw new Error(`项目中没有可用的 workspace 配置，无法定位: ${workspaceName}`)
  }

  const candidates = new Set()
  for (const pattern of includedPatterns) {
    const searchBase = getSearchBase(projectRoot, pattern)
    for (const directory of discoverPackageDirectories(searchBase)) {
      const relativePath = path.relative(projectRoot, directory).replace(/\\/g, '/')
      const included = matchesPattern(relativePath, pattern)
      const excluded = excludedPatterns.some((item) =>
        matchesPattern(relativePath, item)
      )
      if (included && !excluded) candidates.add(directory)
    }
  }

  for (const directory of candidates) {
    try {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(directory, 'package.json'), 'utf8')
      )
      if (
        packageJson.name === workspaceName ||
        path.basename(directory) === workspaceName
      ) {
        return directory
      }
    } catch {
      // 跳过无效 package.json，继续查找其他 workspace。
    }
  }

  throw new Error(`找不到 workspace: ${workspaceName}`)
}

export function isMonorepoRoot(projectRoot) {
  return (
    fs.existsSync(path.join(projectRoot, 'pnpm-workspace.yaml')) ||
    getWorkspacePatterns(projectRoot).length > 0
  )
}
