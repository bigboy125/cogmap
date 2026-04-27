#!/usr/bin/env node
/**
 * 把 INTEL critical rules 同步到 .cursor/rules/cogmap.mdc
 *
 * 让 Cursor 用户也能享受 CogMap 的 INTEL — 跨 AI 协议层落地.
 *
 * Cursor rules 格式 (.mdc):
 *   ---
 *   description: ...
 *   alwaysApply: true
 *   ---
 *   [content]
 *
 * 用法:
 *   node scripts/sync-intel-to-cursor-rules.mjs
 *   # 在 Cursor 里打开项目, 该规则自动加载到所有 AI 对话上下文
 *
 * SessionStart hook 不会调用本脚本(避免污染 Claude Code), 用户主动跑.
 */

import { getIntel } from 'cogmap-core'
import fs from 'node:fs'
import path from 'node:path'

const RULES_DIR = path.join(process.cwd(), '.cursor', 'rules')
const RULES_FILE = path.join(RULES_DIR, 'cogmap.mdc')

const intel = await getIntel()
const rules = (intel.rules || []).filter((r) => r.critical)
const lessonsNodes = Object.keys(intel.lessons || {}).length
const recipesCount = (intel.recipes || []).length

const content = `---
description: CogMap-synced critical rules — auto-generated from INTEL, 不要手改
alwaysApply: true
---

# CogMap Critical Rules (synced ${new Date().toISOString()})

> 共 ${rules.length} 条 critical rules. 完整 INTEL: ${process.env.COGMAP_API_BASE || '配置见 .cogmap.json'}
> 也可参考: ${lessonsNodes} 个 lessons 节点 / ${recipesCount} 个 recipes

${rules.map((r, i) => `${i + 1}. ${r.text}`).join('\n')}

---

## 关于 CogMap

CogMap 是一份跨 AI 的项目记忆协议. 你正在用 Cursor 但项目记忆与 Claude / GPT / Gemini 等共享同一份 INTEL.

- 改完代码请 PUT 回 INTEL: \`scripts/sync-intel-to-claude-md.mjs\` (虽然名字带 claude, 但 INTEL 是工具无关的)
- 历史 bug 检索: \`node scripts/check-bug-history.mjs <关键词>\`
- 配方匹配: \`node scripts/match-recipe.mjs "<需求>"\`

更多: https://github.com/bigboy125/cogmap
`

fs.mkdirSync(RULES_DIR, { recursive: true })
fs.writeFileSync(RULES_FILE, content)
console.log(`✅ ${RULES_FILE} written (${rules.length} critical rules)`)
console.log(`   Cursor will auto-load this rule in all AI conversations.`)
