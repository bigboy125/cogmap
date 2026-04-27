/**
 * log-retry — L3 失败自修复的"留痕"工具
 *
 * 把每次 retry 尝试 (无论成功失败 escalate) 写进 INTEL.retry_log.
 * 配 match-failure-precedent 形成"查先例 → 套用 → 留痕"闭环.
 *
 * 用法:
 *   import { logRetry } from 'cogmap-core/log-retry'
 *   await logRetry({
 *     failure_signature: {
 *       error_type: 'TypeError',
 *       keywords: ['undefined', 'data', 'reading'],
 *       raw_excerpt: 'Cannot read properties of undefined (reading data)'
 *     },
 *     matched_precedent: { kind: 'bug', id: 'X', fix_pattern: '...', score: 0.42 },
 *     fix_applied: '在 fetchData 加 ?? {} 默认值',
 *     outcome: 'success',
 *     attempt_n: 1
 *   })
 */

import { getIntel, putIntel } from './map-client.mjs'

/**
 * @param {object} entry - retry 尝试记录
 * @param {object} entry.failure_signature - 必填, 失败签名 (error_type / keywords / raw_excerpt)
 * @param {object|null} [entry.matched_precedent] - 命中的先例 (查不到先例时为 null, outcome 应为 'escalated')
 * @param {string} [entry.fix_applied] - 实际尝试的修复 (escalated 时可省)
 * @param {'success'|'failure'|'escalated'} entry.outcome - 必填, 本次结果
 * @param {number} [entry.attempt_n=1] - 第几次重试 (同签名累计)
 * @param {object} [opts]
 * @param {object} [opts.intel] - 提供 INTEL 对象, 否则自动 getIntel/putIntel
 * @returns {Promise<object>} 完整的 retry_log 条目 (含自动填的 ts)
 */
export async function logRetry(entry, opts = {}) {
  if (!entry || !entry.failure_signature) {
    throw new Error('logRetry: failure_signature 必填')
  }
  if (!entry.outcome || !['success', 'failure', 'escalated'].includes(entry.outcome)) {
    throw new Error(`logRetry: outcome 必须是 success/failure/escalated, 收到 ${entry.outcome}`)
  }

  const fullEntry = {
    ts: entry.ts || new Date().toISOString(),
    attempt_n: entry.attempt_n || 1,
    ...entry
  }

  if (opts.intel) {
    // 同步模式 — 调用方持有 INTEL, 直接 mutate, 自己负责 putIntel
    opts.intel.retry_log = opts.intel.retry_log || []
    opts.intel.retry_log.push(fullEntry)
    return fullEntry
  }

  // 异步模式 — 自动读 → 改 → 写
  const intel = await getIntel()
  intel.retry_log = intel.retry_log || []
  intel.retry_log.push(fullEntry)
  await putIntel(intel)
  return fullEntry
}

/**
 * 计算同签名 (相同 error_type + 多数 keyword 重叠) 的累计 attempt 数.
 * R14 规定同签名 ≥3 次必须升级.
 *
 * @param {object} signature
 * @param {object} [opts]
 * @param {object} [opts.intel]
 * @returns {Promise<number>}
 */
export async function countAttemptsForSignature(signature, opts = {}) {
  const intel = opts.intel || (await getIntel())
  const log = intel.retry_log || []
  const sigKeywords = new Set((signature.keywords || []).map((k) => String(k).toLowerCase()))

  let count = 0
  for (const entry of log) {
    const e = entry.failure_signature || {}
    if (e.error_type !== signature.error_type) continue
    const eKeywords = new Set((e.keywords || []).map((k) => String(k).toLowerCase()))
    let overlap = 0
    for (const k of sigKeywords) if (eKeywords.has(k)) overlap++
    // 简单阈值: 关键词重叠 ≥ 50% 视为同签名
    const denom = Math.max(sigKeywords.size, eKeywords.size, 1)
    if (overlap / denom >= 0.5) count++
  }
  return count
}
