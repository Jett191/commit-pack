import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

export const CONVENTION_FILE = 'COMMIT_CONVENTION.md'
const AI_FILES = ['AGENTS.md', 'CLAUDE.md', '.github/copilot-instructions.md']
const START = '<!-- commit-pack:begin -->'
const END = '<!-- commit-pack:end -->'
const DEFAULT_HEADER_PATTERN = '^(.+?)\\((.+?)\\): (.+)$'

// Do not follow links out of the target project when editing documentation.
function isLocalFile(root, relative, allowMissing = false) {
  const parts = relative.split('/')
  let current = root
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part)
    try {
      const stat = fs.lstatSync(current)
      if (stat.isSymbolicLink()) return false
      if (index === parts.length - 1) return stat.isFile()
      if (!stat.isDirectory()) return false
    } catch (error) {
      if (error.code === 'ENOENT') return allowMissing && index === parts.length - 1
      throw error
    }
  }
  return false
}

export function getDocumentationPaths(projectRoot) {
  if (!isLocalFile(projectRoot, CONVENTION_FILE, true)) return []
  return [CONVENTION_FILE, ...AI_FILES.filter((file) => isLocalFile(projectRoot, file))].map(
    (file) => path.join(projectRoot, file)
  )
}

function updateManagedBlock(file, body) {
  const original = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
  const newline = original.includes('\r\n') ? '\r\n' : '\n'
  const block = [START, body, END].join('\n').replace(/\n/g, newline)
  const start = original.indexOf(START)
  const end = original.indexOf(END)
  if (
    (start === -1) !== (end === -1) ||
    (start !== -1 &&
      (end < start ||
        original.indexOf(START, start + START.length) !== -1 ||
        original.indexOf(END, end + END.length) !== -1))
  ) {
    throw new Error(`${file} 中 commit-pack 标记不完整或重复，请先手动整理；不会覆盖原内容。`)
  }
  const next =
    start === -1
      ? original + (original ? `${newline}${newline}` : '') + block + newline
      : original.slice(0, start) + block + original.slice(end + END.length)
  if (next !== original) fs.writeFileSync(file, next)
}

function renderConvention(projectRoot) {
  const require = createRequire(path.join(projectRoot, 'package.json'))
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'))
  const czPath = fs.existsSync(path.join(projectRoot, '.cz-config.js'))
    ? '.cz-config.js'
    : pkg.config?.['cz-customizable']?.config || '.cz-config.cjs'
  const czFile = require.resolve(path.resolve(projectRoot, czPath))
  delete require.cache[czFile]
  const cz = require(czFile)
  const lint = JSON.parse(fs.readFileSync(path.join(projectRoot, '.commitlintrc.json'), 'utf8'))
  const typeRule = lint.rules?.['type-enum']
  const types = (cz.types || []).filter(
    ({ value }) =>
      !typeRule?.[0] ||
      !Array.isArray(typeRule[2]) ||
      (typeRule[1] === 'always' ? typeRule[2].includes(value) : !typeRule[2].includes(value))
  )
  const scopeRequired =
    lint.rules?.['scope-empty']?.[0] > 0 && lint.rules['scope-empty'][1] === 'never'
  const scopes = (cz.scopes || [])
    .map((scope) => (typeof scope === 'string' ? scope : scope.name))
    .filter((scope) => scope && scope !== 'custom')
  const standardHeader =
    lint.parserPreset?.parserOpts?.headerPattern === DEFAULT_HEADER_PATTERN &&
    !cz.typePrefix &&
    !cz.typeSuffix &&
    (!cz.subjectSeparator || cz.subjectSeparator === ': ')
  const lines = [
    '# 提交消息规范',
    '',
    `由当前 \`${czPath}\` 与 \`.commitlintrc.json\` 生成。修改配置后重新运行初始化即可更新此区块。`,
    '生成提交消息前请读取这两个配置；配置（包括 commitlint 继承的规则）与本文冲突时，以实际配置和 commit-msg 校验为准。',
    '',
    '## 格式',
    '',
    ...(standardHeader
      ? [
          '```text',
          '<type>(<scope>): <subject>',
          '',
          '[可选正文]',
          '',
          '[可选 footer]',
          '```',
          '',
          'type 必须完整保留下面列出的值，包括 emoji 与空格；冒号后保留一个空格。'
        ]
      : [
          '当前项目使用自定义解析格式，请依据下方 parserPreset 及 Commitizen 配置拼接，不套用默认示例。'
        ]),
    `scope ${scopeRequired ? '必填，不要选择 empty 或留空' : '按实际 commitlint 规则填写'}。`,
    `预设 scope：${scopes.map((scope) => `\`${scope}\``).join('、') || '无'}。`,
    `自定义 scope：${cz.allowCustomScopes ? '允许' : '请遵循 Commitizen 配置'}。`,
    `subject 为简短变更描述${cz.subjectLimit ? `，交互配置限制为 ${cz.subjectLimit} 个字符` : ''}；同时遵守 commitlint 的标题长度、大小写和句末标点规则。`,
    `正文和 footer 与前一部分之间空一行。交互工具的 footer 前缀为 ${JSON.stringify(cz.footerPrefix ?? 'ISSUES CLOSED:')}，关闭 issue 的内容可写 \`Closes #123\`。`,
    `交互配置允许填写破坏性变更的类型：${(cz.allowBreakingChanges || []).join('、') || '无'}。破坏性变更前缀为 ${JSON.stringify(cz.breakingPrefix || 'BREAKING CHANGE:')}，下一行填写变更说明。`,
    '',
    '## 可选类型',
    '',
    ...types.map(({ value, name }) => `- \`${value}\`：${(name || value).trim()}`),
    '',
    ...(standardHeader && types.length
      ? [
          '## 拼接示例',
          '',
          '```text',
          `${types[0].value}(${scopes[0] || 'api'}): 添加输入校验`,
          '```',
          '',
          '示例仅展示拼接形式，自定义 scope-enum 等规则仍须满足。',
          ''
        ]
      : []),
    '## 当前 commitlint 配置',
    '',
    '```json',
    JSON.stringify(lint, null, 2),
    '```',
    '',
    '## 当前 Commitizen 配置',
    '',
    '```json',
    JSON.stringify(cz, null, 2),
    '```',
    '',
    '提交前通过项目的 commitlint / commit-msg 钩子检查，不要使用 --no-verify 绕过校验。'
  ]
  return lines.join('\n')
}

export function writeCommitDocumentation(projectRoot, files = getDocumentationPaths(projectRoot)) {
  if (!files.length) {
    console.log('⚠️ 提交规范路径不是普通本地文件，跳过文档写入')
    return
  }
  const convention = path.join(projectRoot, CONVENTION_FILE)
  updateManagedBlock(convention, renderConvention(projectRoot))
  for (const file of files.filter((file) => file !== convention)) {
    const relative = path.relative(path.dirname(file), convention).split(path.sep).join('/')
    updateManagedBlock(
      file,
      `生成提交消息前，请阅读 [提交消息规范](${relative})，并遵循其中格式；以项目 commitlint 配置为最终校验依据。`
    )
  }
  console.log(`📝 提交规范：${convention}；已更新 ${files.length - 1} 个已有 AI 指令文件`)
}
