#!/usr/bin/env node
/**
 * 把 INTEL 关键规则同步到项目根 CLAUDE.md
 *
 * 在文件顶部插入 / 更新一个区块, 让任何 AI 工具读 CLAUDE.md 时都先看到当前 critical rules
 *
 * SessionStart hook 会自动调用本脚本
 */

import { getIntel } from '@cogmap/core'
import fs from 'node:fs'
import path from 'node:path'

const CLAUDE_MD = path.join(process.cwd(), 'CLAUDE.md')
const BEGIN = '<!-- COGMAP:RULES:BEGIN -->'
const END = '<!-- COGMAP:RULES:END -->'

const intel = await getIntel()
const rules = (intel.rules || []).filter((r) => r.critical)

const block = [
  BEGIN,
  `## ⚡ Critical Rules — synced from CogMap INTEL`,
  `> Source: ${process.env.COGMAP_API_BASE || 'configured INTEL endpoint'}`,
  `> Synced: ${new Date().toISOString()} · ${rules.length} critical rules`,
  `> **Any AI reading CLAUDE.md MUST read this block first**`,
  ``,
  ...rules.map((r, i) => `${i + 1}. ${r.text}`),
  ``,
  `📍 Total ${(intel.rules || []).length} rules / ${Object.keys(intel.lessons || {}).length} lessons nodes / ${(intel.recipes || []).length} recipes / ${(intel.roadmap || []).length} roadmap items`,
  END
].join('\n')

let content = ''
if (fs.existsSync(CLAUDE_MD)) {
  content = fs.readFileSync(CLAUDE_MD, 'utf-8')
}

if (content.includes(BEGIN) && content.includes(END)) {
  content = content.replace(
    new RegExp(`${BEGIN}[\\s\\S]*?${END}`),
    block
  )
} else {
  content = block + '\n\n' + content
}

fs.writeFileSync(CLAUDE_MD, content)
console.log(`✅ CLAUDE.md updated (${rules.length} critical rules)`)
