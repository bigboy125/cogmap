/**
 * lesson-utils — (Q4) lessons 双形态兼容工具
 *
 * v0.1.x 把 lessons.<topic> 的 item 从纯字符串扩展为 string | {text, tags}.
 * 旧 INTEL 不动也兼容, 新 INTEL 可以加 tags 做精准切片.
 *
 * 用法:
 *   import { getLessonText, getLessonTags, searchLessonsByTags } from 'cogmap-core/lesson-utils'
 *
 *   for (const item of intel.lessons[topic]) {
 *     const text = getLessonText(item)
 *     const tags = getLessonTags(item)
 *   }
 *
 *   const matched = searchLessonsByTags(intel, ['security', 'release'])
 */

/**
 * 取 lesson 文本 — 兼容 string 和 {text, tags}
 * @param {string|object} item
 * @returns {string}
 */
export function getLessonText(item) {
  if (item == null) return ''
  if (typeof item === 'string') return item
  if (typeof item === 'object' && typeof item.text === 'string') return item.text
  return String(item)
}

/**
 * 取 lesson tags — 旧 string 形态返回 [], 新对象形态返回数组 (自动去重)
 * @param {string|object} item
 * @returns {string[]}
 */
export function getLessonTags(item) {
  if (item && typeof item === 'object' && Array.isArray(item.tags)) {
    return [...new Set(item.tags.map((t) => String(t).toLowerCase()))]
  }
  return []
}

/**
 * 跨 topic 按 tag 检索 lessons.
 *
 * @param {object} intel - 含 lessons 字段的 INTEL 对象
 * @param {string[]} requiredTags - 至少含其中一个 tag 才命中 (OR)
 * @param {object} [opts]
 * @param {boolean} [opts.requireAll=false] - true 改成 AND 关系 (item.tags 必须包含所有 required)
 * @param {number} [opts.limit] - 最多返回几条 (跨 topic 累计)
 * @returns {Array<{topic: string, text: string, tags: string[]}>}
 */
export function searchLessonsByTags(intel, requiredTags, opts = {}) {
  const { requireAll = false, limit = Infinity } = opts
  const lessons = (intel && intel.lessons) || {}
  const wanted = new Set((requiredTags || []).map((t) => String(t).toLowerCase()))
  if (wanted.size === 0) return []

  const out = []
  for (const [topic, items] of Object.entries(lessons)) {
    if (!Array.isArray(items)) continue
    for (const item of items) {
      const itemTags = getLessonTags(item)
      if (itemTags.length === 0) continue
      let hit = false
      if (requireAll) {
        hit = [...wanted].every((t) => itemTags.includes(t))
      } else {
        hit = itemTags.some((t) => wanted.has(t))
      }
      if (hit) {
        out.push({ topic, text: getLessonText(item), tags: itemTags })
        if (out.length >= limit) return out
      }
    }
  }
  return out
}
