#!/usr/bin/env node
/**
 * 把 INTEL critical rules 同步到项目根 AGENTS.md
 *
 * AGENTS.md 是新兴的工具无关 AI 指令文件标准, 被 OpenAI Codex / Cursor /
 * Continue / Aider 等工具识别. 类似 CLAUDE.md 但跨工具通用.
 *
 * 区别于 CLAUDE.md (Claude 专用) — AGENTS.md 让任何 AI 工具都能读到 critical rules.
 *
 * 用法:
 *   node scripts/sync-intel-to-agents-md.mjs
 */

import { getIntel } from 'cogmap-core'
import fs from 'node:fs'
import path from 'node:path'

const AGENTS_MD = path.join(process.cwd(), 'AGENTS.md')
const BEGIN = '<!-- COGMAP:RULES:BEGIN -->'
const END = '<!-- COGMAP:RULES:END -->'

const intel = await getIntel()
const rules = (intel.rules || []).filter((r) => r.critical)
const lessonsNodes = Object.keys(intel.lessons || {}).length
const bugsNodes = Object.keys(intel.bugs || {}).length
const recipesCount = (intel.recipes || []).length
const roadmapCount = (intel.roadmap || []).length

const block = [
  BEGIN,
  '## ⚡ Critical Rules — synced from CogMap INTEL',
  `> Source: ${process.env.COGMAP_API_BASE || '.cogmap.json api_base'}`,
  `> Synced: ${new Date().toISOString()} · ${rules.length} critical rules`,
  '> **Any AI agent reading AGENTS.md MUST read this block first**',
  '',
  ...rules.map((r, i) => `${i + 1}. ${r.text}`),
  '',
  `📍 Total ${(intel.rules || []).length} rules / ${lessonsNodes} lessons nodes / ${bugsNodes} bugs nodes / ${recipesCount} recipes / ${roadmapCount} roadmap items.`,
  '',
  '> Tools: `match-recipe.mjs "<需求>"` / `check-bug-history.mjs <关键词>` / `validate-intel.mjs` / `audit-map-coverage.mjs`',
  '> See https://github.com/bigboy125/cogmap for protocol spec.',
  END
].join('\n')

let content = ''
if (fs.existsSync(AGENTS_MD)) {
  content = fs.readFileSync(AGENTS_MD, 'utf-8')
}

if (content.includes(BEGIN) && content.includes(END)) {
  content = content.replace(
    new RegExp(`${BEGIN}[\\s\\S]*?${END}`),
    block
  )
} else {
  content = block + '\n\n' + content
}

fs.writeFileSync(AGENTS_MD, content)
console.log(`✅ AGENTS.md updated (${rules.length} critical rules)`)
console.log(`   Recognized by: OpenAI Codex / Cursor / Continue / Aider / etc.`)
