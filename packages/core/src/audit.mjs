/**
 * 经验覆盖率审计
 *
 * 检查项目中的 lessons / bugs / iterations 是否上图 INTEL
 *
 * 用法:
 *   import { auditCoverage } from '@cogmap/core/audit'
 *   const r = await auditCoverage({ memoryDir: './memory' })
 *   if (r.coverage < 0.9) process.exit(1)
 */

import fs from 'node:fs'
import path from 'node:path'
import { getIntel } from './map-client.mjs'

/**
 * @param {object} opts
 * @param {string} [opts.memoryDir] - 项目 memory 目录路径(可选, 用于扫描本地 lessons 文件)
 * @param {number} [opts.threshold=0.9] - 覆盖率阈值
 * @param {boolean} [opts.silent=false] - 静默模式, 不打印
 */
export async function auditCoverage(opts = {}) {
  const { memoryDir = null, threshold = 0.9, silent = false } = opts

  const intel = await getIntel()
  const log = silent ? () => {} : console.log
  const today = new Date().toISOString().slice(0, 10)

  log('━'.repeat(70))
  log(`CogMap 覆盖率审计 — ${today}`)
  log('━'.repeat(70))

  const rulesCount = (intel.rules || []).length
  const lessonsNodes = Object.keys(intel.lessons || {}).length
  const bugsNodes = Object.keys(intel.bugs || {}).length
  const guideNodes = Object.keys(intel.guide || {}).length
  const recipesCount = (intel.recipes || []).length
  const roadmapCount = (intel.roadmap || []).length

  log('📊 INTEL 当前规模:')
  log(`   rules: ${rulesCount}`)
  log(`   lessons: ${lessonsNodes} 个节点`)
  log(`   bugs: ${bugsNodes} 个节点`)
  log(`   guide: ${guideNodes} 个节点`)
  log(`   recipes: ${recipesCount}`)
  log(`   roadmap: ${roadmapCount}`)

  let totalLocal = 0
  let onMap = 0
  const missing = []

  if (memoryDir && fs.existsSync(memoryDir)) {
    const files = fs.readdirSync(memoryDir).filter((f) => f.endsWith('.md'))
    totalLocal = files.length

    // 提取每个 memory 文件的关键词, 检查是否在 INTEL.lessons / bugs 中至少有一个节点提到
    const allText = JSON.stringify(intel.lessons || {}) + JSON.stringify(intel.bugs || {})
    const lowerAll = allText.toLowerCase()

    for (const f of files) {
      const stem = f.replace(/\.md$/, '').replace(/_/g, ' ').toLowerCase()
      // 简单关键词匹配: 文件名里有 3 个以上中英文字符出现在 INTEL 即算覆盖
      const tokens = stem.split(/[\s\-]+/).filter((t) => t.length >= 3)
      const found = tokens.some((tk) => lowerAll.includes(tk))
      if (found) onMap++
      else missing.push(f)
    }
  } else {
    // 没有本地 memory 目录, 用 lessons 节点数作为代理
    totalLocal = lessonsNodes
    onMap = lessonsNodes
  }

  const coverage = totalLocal === 0 ? 1 : onMap / totalLocal
  log('')
  log(`✅ 已上图: ${onMap} / ${totalLocal} (${(coverage * 100).toFixed(0)}%)`)
  log(`❌ 未上图: ${missing.length}`)
  for (const m of missing.slice(0, 10)) log(`   - ${m}`)
  if (missing.length > 10) log(`   ... +${missing.length - 10} more`)
  log('')

  const passed = coverage >= threshold
  log(passed ? `✅ 通过 (≥${(threshold * 100).toFixed(0)}%)` : `❌ 未达标 (<${(threshold * 100).toFixed(0)}%)`)

  return {
    passed,
    coverage,
    rulesCount,
    lessonsNodes,
    bugsNodes,
    recipesCount,
    roadmapCount,
    missing
  }
}
