/**
 * map-api 统一 HTTPS 客户端 (项目无关版本)
 *
 * 写: PUT {api_base}/api/intel + Authorization: Bearer
 * 读: GET 同 URL, 公开 (除非自部署加 auth)
 */

import { getApiKey, getConfig } from './get-key.mjs'

export function getApiBase() {
  return getConfig().api_base
}

export async function getIntel(path = null) {
  const base = getApiBase()
  const url = path
    ? `${base}/api/intel/${encodeURIComponent(path).replace(/%2F/g, '/')}`
    : `${base}/api/intel`
  const r = await fetch(url)
  if (!r.ok) throw new Error(`GET intel${path ? ' ' + path : ''} failed: ${r.status}`)
  return r.json()
}

export async function putIntel(intel) {
  const key = getApiKey()
  const base = getApiBase()
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
  const key = getApiKey()
  const base = getApiBase()
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

export async function searchByTask(query) {
  const base = getApiBase()
  const r = await fetch(
    `${base}/api/intel/by-task?q=${encodeURIComponent(query)}`
  )
  if (!r.ok) throw new Error(`by-task failed: ${r.status}`)
  return r.json()
}
