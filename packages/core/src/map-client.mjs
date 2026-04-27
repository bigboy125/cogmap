/**
 * CogMap 统一客户端 — 支持 HTTPS 后端 + file:// 本地模式
 *
 * HTTPS 模式: 跨 AI 协作 (推荐 — 多人/多设备/多 AI 工具共享同一份 INTEL)
 *   写: PUT {api_base}/api/intel + Authorization: Bearer
 *   读: GET 同 URL
 *
 * file:// 模式: 单机起步 (无后端, 用本地 JSON 文件)
 *   配置: .cogmap.json 的 api_base = "file://./INTEL.json" 或绝对路径
 *   写: 直接 fs.writeFile
 *   读: 直接 fs.readFile
 *   不需要 COGMAP_API_KEY
 */

import fs from 'node:fs'
import path from 'node:path'
import { getApiKey, getConfig } from './get-key.mjs'

export function getApiBase() {
  return getConfig().api_base
}

function isFileMode(base) {
  return base.startsWith('file://') || base.startsWith('./') || base.startsWith('/')
}

function fileModePath(base) {
  // file://./INTEL.json → ./INTEL.json
  // file:///abs/path.json → /abs/path.json
  // ./INTEL.json → ./INTEL.json (兼容简写)
  let p = base.replace(/^file:\/\//, '')
  if (p.startsWith('/')) return p
  return path.resolve(process.cwd(), p || './INTEL.json')
}

function readFileIntel(base) {
  const p = fileModePath(base)
  if (!fs.existsSync(p)) {
    throw new Error(`INTEL file not found at ${p} (file:// mode). Run: cogmap init or create the file manually.`)
  }
  return JSON.parse(fs.readFileSync(p, 'utf-8'))
}

function writeFileIntel(base, intel) {
  const p = fileModePath(base)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(intel, null, 2) + '\n')
  return { ok: true, path: p }
}

export async function getIntel(subPath = null) {
  const base = getApiBase()

  // file:// 模式
  if (isFileMode(base)) {
    const intel = readFileIntel(base)
    if (!subPath) return intel
    // 简单 dot-path 取子字段 (如 'session_handoff' / 'rules')
    return subPath.split('.').reduce((o, k) => (o == null ? o : o[k]), intel)
  }

  // HTTPS 模式
  const url = subPath
    ? `${base}/api/intel/${encodeURIComponent(subPath).replace(/%2F/g, '/')}`
    : `${base}/api/intel`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`GET intel${subPath ? ' ' + subPath : ''} failed: ${r.status}`)
  return r.json()
}

export async function putIntel(intel) {
  const base = getApiBase()

  // file:// 模式
  if (isFileMode(base)) {
    return writeFileIntel(base, intel)
  }

  // HTTPS 模式
  const key = getApiKey()
  const r = await fetch(`${base}/api/intel`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`
    },
    body: JSON.stringify(intel)
  })
  if (!r.ok) {
    const text = await r.text()
    throw new Error(`PUT intel failed: ${r.status} ${text}`)
  }
  return r.json()
}

export async function patchRoadmap(id, updates) {
  const base = getApiBase()

  // file:// 模式 — 客户端实现 patch 语义
  if (isFileMode(base)) {
    const intel = readFileIntel(base)
    const item = (intel.roadmap || []).find((r) => r.id === id)
    if (!item) throw new Error(`roadmap/${id} not found in local INTEL`)
    Object.assign(item, updates)
    writeFileIntel(base, intel)
    return item
  }

  // HTTPS 模式
  const key = getApiKey()
  const r = await fetch(
    `${base}/api/intel/roadmap/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify(updates)
    }
  )
  if (!r.ok) throw new Error(`PATCH roadmap/${id} failed: ${r.status}`)
  return r.json()
}

// 轻量 recipe — 决策时通常只看头部字段, 重内容 (steps/tests/criteria) 进 SKILL.md
const SLIM_RECIPE_FIELDS = new Set([
  'id', 'scenario', 'triggers', 'confidence', 'estimatedTime', 'skill_path'
])

function slimRecipe(r) {
  const out = {}
  for (const k of Object.keys(r)) {
    if (SLIM_RECIPE_FIELDS.has(k)) out[k] = r[k]
  }
  return out
}

/**
 * 按关键词检索 INTEL 切片.
 *
 * @param {string} query - 关键词 (大小写不敏感)
 * @param {object} [opts] - 切片选项 (Q6 token 优化)
 * @param {boolean} [opts.slim=false] - recipe 只返回头部 6 字段, 省 token
 * @param {number} [opts.limit=Infinity] - 每个类别最多返回几条
 * @param {string[]} [opts.fields] - 只返回这些类别 (rules/lessons/bugs/recipes), 默认全返回
 * @returns {Promise<object>}
 */
export async function searchByTask(query, opts = {}) {
  const { slim = false, limit = Infinity, fields = null } = opts
  const includeCategory = (cat) => !fields || fields.includes(cat)
  const cap = (arr) => (limit === Infinity ? arr : arr.slice(0, limit))
  const base = getApiBase()

  // file:// 模式 — 客户端实现简单 OR 检索
  if (isFileMode(base)) {
    const intel = readFileIntel(base)
    const lower = query.toLowerCase()
    const result = {}
    if (includeCategory('rules')) result.rules = []
    if (includeCategory('lessons')) result.lessons = {}
    if (includeCategory('bugs')) result.bugs = {}
    if (includeCategory('recipes')) result.recipes = []

    if (includeCategory('rules')) {
      const rules = []
      for (const r of intel.rules || []) {
        if (String(r.text).toLowerCase().includes(lower)) rules.push(r)
      }
      result.rules = cap(rules)
    }
    if (includeCategory('lessons')) {
      let count = 0
      for (const [nodeId, lessons] of Object.entries(intel.lessons || {})) {
        if (count >= limit) break
        const matched = (Array.isArray(lessons) ? lessons : []).filter((l) =>
          String(l).toLowerCase().includes(lower)
        )
        if (matched.length) {
          result.lessons[nodeId] = matched
          count++
        }
      }
    }
    if (includeCategory('bugs')) {
      let count = 0
      for (const [nodeId, bug] of Object.entries(intel.bugs || {})) {
        if (count >= limit) break
        const types = (bug.types || []).filter((t) => String(t).toLowerCase().includes(lower))
        if (types.length) {
          result.bugs[nodeId] = { ...bug, types }
          count++
        }
      }
    }
    if (includeCategory('recipes')) {
      const recipes = []
      for (const r of intel.recipes || []) {
        const triggers = r.triggers || []
        if (triggers.some((t) => String(t).toLowerCase().includes(lower))) {
          recipes.push(slim ? slimRecipe(r) : r)
        }
      }
      result.recipes = cap(recipes)
    }
    return result
  }

  // HTTPS 模式 — 把切片选项作为 query param 传给后端 (后端可选实现, 不实现则忽略)
  const params = new URLSearchParams({ q: query })
  if (slim) params.set('slim', '1')
  if (limit !== Infinity) params.set('limit', String(limit))
  if (fields) params.set('fields', fields.join(','))
  const r = await fetch(`${base}/api/intel/by-task?${params}`)
  if (!r.ok) throw new Error(`by-task failed: ${r.status}`)
  return r.json()
}

export { isFileMode }
