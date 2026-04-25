/**
 * 历史 bug 全文检索
 *
 * 查 INTEL.bugs 所有节点, 按关键词 OR 匹配
 */

import { getIntel } from './map-client.mjs'

export async function checkBugHistory(...keywords) {
  if (!keywords.length) {
    throw new Error('Usage: checkBugHistory(keyword1, keyword2, ...)')
  }
  const intel = await getIntel()
  const bugs = intel.bugs || {}
  const lower = keywords.map((k) => String(k).toLowerCase())

  const hits = []
  for (const [nodeId, node] of Object.entries(bugs)) {
    const types = node.types || []
    const lessons = node.lessons || []
    const matched = []
    for (const t of types) {
      const tl = String(t).toLowerCase()
      if (lower.some((k) => tl.includes(k))) matched.push({ kind: 'type', text: t })
    }
    for (const l of lessons) {
      const ll = String(l).toLowerCase()
      if (lower.some((k) => ll.includes(k))) matched.push({ kind: 'lesson', text: l })
    }
    if (matched.length) {
      hits.push({ nodeId, count: node.count, matched })
    }
  }
  return hits
}

export async function searchAllBugs() {
  const intel = await getIntel()
  return intel.bugs || {}
}
