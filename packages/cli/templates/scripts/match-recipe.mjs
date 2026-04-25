#!/usr/bin/env node
/**
 * 按需求关键词匹配 SKILL/recipe — wrapper for cogmap-core/match-recipe
 *
 * 用法:
 *   node scripts/match-recipe.mjs "<需求描述>"
 *   node scripts/match-recipe.mjs --list
 */

import { matchRecipe, listRecipes } from 'cogmap-core/match-recipe'

const args = process.argv.slice(2)

if (args[0] === '--list' || args.length === 0) {
  const all = await listRecipes()
  console.log(`共 ${all.length} 个 recipe:`)
  for (const r of all) {
    console.log(`  - ${r.id} [${r.confidence || 'unknown'}] triggers: ${(r.triggers || []).slice(0, 5).join(', ')}`)
  }
  process.exit(0)
}

const request = args.join(' ')
const m = await matchRecipe(request)
if (!m) {
  console.log('❌ 无 recipe 命中')
  process.exit(1)
}

console.log(`✅ 命中: ${m.id} (score=${m.score.toFixed(2)})`)
console.log(`   skill: ${m.skill_path}`)
console.log(`   confidence: ${m.confidence}`)
console.log(`   estimated_time: ${m.estimated_time || 'unknown'}`)
console.log(``)
console.log(`💡 主对话应该读取该 SKILL.md 并按五步流程走`)
