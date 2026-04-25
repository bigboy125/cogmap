/**
 * 凭据查找 — 项目无关版本
 *
 * 优先级:
 *   1. process.env.COGMAP_API_KEY (CI/CD 友好)
 *   2. <cwd>/.cogmap-credentials.json 的 api_key
 *   3. <cwd>/.cogmap.json 的 api_key (不推荐, 容易提交进 git)
 *   4. ~/.cogmap/credentials.json 的 api_key (用户级)
 *   5. 项目根 .env 的 COGMAP_API_KEY 行 (兼容老格式)
 *
 * 配置查找:
 *   1. process.env.COGMAP_API_BASE
 *   2. <cwd>/.cogmap.json 的 api_base
 *   3. ~/.cogmap/config.json 的 api_base
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

function readJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch {
    return null
  }
}

function readEnvKey(envPath, key) {
  try {
    const text = fs.readFileSync(envPath, 'utf-8')
    const m = text.match(new RegExp(`^${key}=(.+)$`, 'm'))
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  } catch {}
  return null
}

export function getApiKey() {
  // 1. env
  if (process.env.COGMAP_API_KEY) return process.env.COGMAP_API_KEY.trim()

  const cwd = process.cwd()

  // 2. <cwd>/.cogmap-credentials.json
  const projCredPath = path.join(cwd, '.cogmap-credentials.json')
  if (fs.existsSync(projCredPath)) {
    const c = readJsonSafe(projCredPath)
    if (c?.api_key) return c.api_key
  }

  // 3. <cwd>/.cogmap.json
  const projConfigPath = path.join(cwd, '.cogmap.json')
  if (fs.existsSync(projConfigPath)) {
    const c = readJsonSafe(projConfigPath)
    if (c?.api_key) return c.api_key
  }

  // 4. ~/.cogmap/credentials.json
  const homeCredPath = path.join(os.homedir(), '.cogmap', 'credentials.json')
  if (fs.existsSync(homeCredPath)) {
    const c = readJsonSafe(homeCredPath)
    if (c?.api_key) return c.api_key
  }

  // 5. .env 兼容
  const envPath = path.join(cwd, '.env')
  const k = readEnvKey(envPath, 'COGMAP_API_KEY')
  if (k) return k

  throw new Error(
    'COGMAP_API_KEY not found. Set via:\n' +
      '  - export COGMAP_API_KEY=...\n' +
      '  - <cwd>/.cogmap-credentials.json with {"api_key": "..."}\n' +
      '  - ~/.cogmap/credentials.json with {"api_key": "..."}'
  )
}

export function getConfig() {
  // env 优先
  const fromEnv = process.env.COGMAP_API_BASE
  if (fromEnv) return { api_base: fromEnv.trim() }

  const cwd = process.cwd()

  // <cwd>/.cogmap.json
  const projConfigPath = path.join(cwd, '.cogmap.json')
  if (fs.existsSync(projConfigPath)) {
    const c = readJsonSafe(projConfigPath)
    if (c?.api_base) return c
  }

  // ~/.cogmap/config.json
  const homeConfigPath = path.join(os.homedir(), '.cogmap', 'config.json')
  if (fs.existsSync(homeConfigPath)) {
    const c = readJsonSafe(homeConfigPath)
    if (c?.api_base) return c
  }

  return { api_base: 'https://map-api.example.com' }
}
