import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const checkerScript = join(
  root,
  'node_modules',
  'license-checker-rseidelsohn',
  'bin',
  'license-checker-rseidelsohn.js',
)

const raw = execFileSync(process.execPath, [checkerScript, '--production', '--markdown'], {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
})

/** @param {string} name */
function isPlatformSpecificPackage(name) {
  if (/^@rolldown\/binding-/.test(name)) return true
  if (/^@tailwindcss\/oxide-/.test(name)) return true
  if (/^lightningcss-(darwin|win32|linux|freebsd|android)/.test(name)) return true
  if (/^@esbuild\//.test(name)) return true
  if (name === 'fsevents') return true
  return false
}

const body = raw
  .replace(/^Already up to date\r?\n/, '')
  .replace(/^Done in .* using pnpm.*\r?\n/, '')
  .replace(/^added .* in .*\r?\n/, '')
  .trim()
  .split('\n')
  .filter((line) => {
    const match = line.match(/^- \[((?:@[^/]+\/)?[^@\]]+)@[^\]]+\]/)
    return !match || !isPlatformSpecificPackage(match[1])
  })
  .join('\n')

const notice = `# Third-Party Notices

Spirit Agent site includes open source software. The following production dependencies
are used in this project.

${body}
`

const content = `${notice}\n`
const publicDir = join(root, 'public')

mkdirSync(publicDir, { recursive: true })
writeFileSync(join(root, 'NOTICE.md'), content)
writeFileSync(join(publicDir, 'notice.md'), content)
