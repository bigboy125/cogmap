#!/usr/bin/env node
/**
 * 历史 bug 全文检索 — wrapper for cogmap-core/check-bug-history
 *
 * 用法:
 *   node scripts/check-bug-history.mjs <关键词1> <关键词2> ...
 */

import { checkBugHistory } from 'cogmap-core/check-bug-history'

const keywords = process.argv.slice(2)
if (keywords.length === 0) {
  console.error('Usage: node scripts/check-bug-history.mjs <keyword1> [keyword2] ...')
  process.exit(1)
}

const hits = await checkBugHistory(...keywords)
if (hits.length === 0) {
  console.log(`❌ 无历史 bug 命中 [${keywords.join(', ')}]`)
  process.exit(0)
}

console.log(`✅ ${hits.length} 个节点命中:\n`)
for (const h of hits) {
  console.log(`📌 ${h.nodeId} (count=${h.count})`)
  for (const m of h.matched) {
    console.log(`   [${m.kind}] ${m.text}`)
  }
  console.log('')
}
