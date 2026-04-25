/**
 * 按需求描述匹配最合适的 recipe / SKILL
 *
 * 算法: 关键词包含计数 + confidence 加权
 */

import { getIntel } from './map-client.mjs'

export async function matchRecipe(request, options = {}) {
  const intel = await getIntel()
  const recipes = intel.recipes || []
  if (!recipes.length) return null

  const lower = request.toLowerCase()
  const scored = recipes.map((r) => {
    const triggers = r.triggers || []
    let score = 0
    for (const t of triggers) {
      if (lower.includes(String(t).toLowerCase())) score += 1
    }
    // confidence 加权 (high=+0.3 medium=+0.15 low=0)
    if (r.confidence?.startsWith('high')) score += 0.3
    else if (r.confidence?.startsWith('medium')) score += 0.15
    return { recipe: r, score }
  })

  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]
  if (!best || best.score === 0) return options.fallback || null

  return {
    id: best.recipe.id,
    skill_path: best.recipe.skill_path || `.claude/skills/${best.recipe.id}/SKILL.md`,
    score: best.score,
    confidence: best.recipe.confidence,
    estimated_time: best.recipe.estimatedTime,
    full: best.recipe
  }
}

export async function listRecipes() {
  const intel = await getIntel()
  return (intel.recipes || []).map((r) => ({
    id: r.id,
    triggers: r.triggers,
    confidence: r.confidence,
    skill_path: r.skill_path
  }))
}
