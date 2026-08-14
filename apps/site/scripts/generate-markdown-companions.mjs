import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { renderDownloadMarkdown, renderSiteMarkdown } from '../src/content/site-document.ts'
import { SUPPORTED_LOCALES } from '../src/i18n/config.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = join(root, 'public')

for (const locale of SUPPORTED_LOCALES) {
  const homeDir = join(publicDir, locale)
  mkdirSync(homeDir, { recursive: true })
  writeFileSync(join(homeDir, 'index.md'), renderSiteMarkdown(locale), 'utf8')

  const downloadDir = join(homeDir, 'download')
  mkdirSync(downloadDir, { recursive: true })
  writeFileSync(join(downloadDir, 'index.md'), renderDownloadMarkdown(locale), 'utf8')
}

console.log(`Generated markdown companions for ${SUPPORTED_LOCALES.join(', ')}`)
