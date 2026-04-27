/**
 * match-failure-precedent — L3 失败自修复的"模式查询"核心
 *
 * 输入错误文本, 在 INTEL 里查找语义最近的过去先例 (bug / lesson / retry_log).
 * 命中返回 { kind, id, score, fix_pattern }, 未命中返回 null.
 *
 * 设计哲学 (老罗 2026-04-28):
 *   1. 模式驱动, 不是规则驱动 — retry 必须查过去成功的修复方式, 不允许凭空发明
 *   2. 可视化 — 命中即留痕, 用户能审 AI 这次为什么这么修
 *   3. 迭代的 — 每次新成功修复都进 retry_log, 系统越用越准
 *
 * 用法:
 *   import { matchFailurePrecedent } from 'cogmap-core/match-failure-precedent'
 *   const match = await matchFailurePrecedent(errorText)
 *   if (match) // 套用 match.fix_pattern
 *   else      // 必须升级到主对话/用户, 严禁猜测
 */

import { getIntel } from './map-client.mjs'
import { getLessonText } from './lesson-utils.mjs'

// 通用停用词 (中英混合) — 用于过滤无信息量 tokens
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'at', 'to', 'in', 'of', 'for', 'on', 'and', 'or', 'but',
  'with', 'it', 'this', 'that', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
  'had', 'do', 'does', 'did', 'as', 'by', 'not', 'no', 'so', 'if', 'then', 'than',
  'from', 'into', 'over', 'through', 'after', 'before', 'when', 'where', 'why',
  'how', 'all', 'any', 'each', 'every', 'some', 'such', 'only', 'can', 'will',
  'just', 'now', 'also', 'too', '的', '了', '是', '在', '有', '和', '或', '不', '能'
])

/** 切词 — 中英混合, 保留 ≥3 字符的有意义 token */
export function tokenize(text) {
  if (!text) return []
  return String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
}

/** Jaccard 相似度 — 交集 / 并集 */
export function jaccard(arrA, arrB) {
  const a = new Set(arrA)
  const b = new Set(arrB)
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  const union = a.size + b.size - inter
  return union === 0 ? 0 : inter / union
}

/**
 * @param {string} errorText - subagent 失败的错误文本 (stderr / stdout 都行)
 * @param {object} [opts]
 * @param {object} [opts.intel] - 提供 INTEL 对象, 否则自动 getIntel()
 * @param {number} [opts.threshold=0.15] - Jaccard 阈值, 低于此值不算命中
 * @param {boolean} [opts.allCandidates=false] - 返回全部候选 (按分数降序), 不只 top-1
 * @returns {Promise<object|null|object[]>}
 */
export async function matchFailurePrecedent(errorText, opts = {}) {
  const { threshold = 0.15, intel: providedIntel = null, allCandidates = false } = opts
  const intel = providedIntel || (await getIntel())
  const errTokens = tokenize(errorText)
  if (errTokens.length === 0) return allCandidates ? [] : null

  const candidates = []

  // 1. bugs — 优先级最高 (有 fix_pattern + 历史 lesson 沉淀)
  for (const [id, bug] of Object.entries(intel.bugs || {})) {
    const text = [...(bug.types || []), ...(bug.lessons || []), bug.fix_pattern || '']
      .filter(Boolean)
      .join(' ')
    const score = jaccard(errTokens, tokenize(text))
    if (score >= threshold) {
      candidates.push({
        kind: 'bug',
        id,
        score,
        fix_pattern: bug.fix_pattern || (bug.lessons || []).join(' / ') || `参考 INTEL.bugs.${id}`
      })
    }
  }

  // 2. retry_log — 过去成功的 retry 是最强先例 (boost 1.1x)
  for (const entry of intel.retry_log || []) {
    if (entry.outcome !== 'success') continue
    const sig = entry.failure_signature || {}
    const sigText = [sig.error_type, ...(sig.keywords || []), sig.raw_excerpt]
      .filter(Boolean)
      .join(' ')
    const score = jaccard(errTokens, tokenize(sigText))
    if (score >= threshold) {
      candidates.push({
        kind: 'retry_log',
        id: entry.ts,
        score: score * 1.1,
        fix_pattern: entry.fix_applied || `参考 INTEL.retry_log @ ${entry.ts}`
      })
    }
  }

  // 3. lessons — 兜底 (打 0.8 折, 因为是反思不是直接 fix_pattern)
  // (Q4) 双形态兼容: 用 getLessonText 取文本
  for (const [topic, lessons] of Object.entries(intel.lessons || {})) {
    if (!Array.isArray(lessons)) continue
    for (const l of lessons) {
      const text = getLessonText(l)
      const score = jaccard(errTokens, tokenize(text))
      if (score >= threshold) {
        candidates.push({
          kind: 'lesson',
          id: topic,
          score: score * 0.8,
          fix_pattern: text
        })
      }
    }
  }

  if (candidates.length === 0) return allCandidates ? [] : null
  candidates.sort((a, b) => b.score - a.score)
  return allCandidates ? candidates : candidates[0]
}
