#!/usr/bin/env node
/**
 * CogMap INTEL 后端 — 最小可运行实现
 *
 * 5 端点:
 *   GET  /api/intel              — 公开返回完整 INTEL
 *   GET  /api/intel/:path(*)     — 取子字段(如 /api/intel/rules)
 *   PUT  /api/intel              — schema 校验 + UPSERT (Bearer auth)
 *   PATCH /api/intel/roadmap/:id — 局部更新 roadmap 项
 *   GET  /api/intel/by-task?q=X  — 关键词切片
 *
 * 启动:
 *   npm install
 *   npm run init-key  # 生成 ADMIN_API_KEY (复制到 .env)
 *   ADMIN_API_KEY=... npm start
 *
 * 配置(env):
 *   PORT=3000               (默认)
 *   ADMIN_API_KEY=...       (必须 — 否则任何人能 PUT)
 *   DB_FILE=./intel.db.json (默认)
 *   ALLOWED_ORIGINS=*       (CORS, 默认通配)
 */

import express from 'express'
import cors from 'cors'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv from 'ajv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3000
const ADMIN_KEY = process.env.ADMIN_API_KEY
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'intel.db.json')
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || '*'

if (!ADMIN_KEY) {
  console.error('❌ ADMIN_API_KEY env not set. Run: npm run init-key')
  console.error('   然后: ADMIN_API_KEY=<paste> npm start')
  process.exit(1)
}

// ============ Schema 加载 ============
// 优先用本地 schema, 没有则从 cogmap-core npm 包拉(如果装了)
let schema
const localSchemaPath = path.join(__dirname, 'intel.schema.json')
if (fs.existsSync(localSchemaPath)) {
  schema = JSON.parse(fs.readFileSync(localSchemaPath, 'utf-8'))
} else {
  try {
    const corePath = path.dirname(import.meta.resolve('cogmap-core'))
    schema = JSON.parse(fs.readFileSync(path.join(corePath, '..', 'schemas', 'intel.schema.json'), 'utf-8'))
  } catch {
    console.warn('⚠️  No intel.schema.json found, schema validation disabled')
    schema = null
  }
}

const ajv = new Ajv({ allErrors: true, strict: false })
const validate = schema ? ajv.compile(schema) : () => true

// ============ INTEL 加载/持久化 ============
const DEFAULT_INTEL = {
  _schema_version: 2,
  rules: [],
  lessons: {},
  bugs: {},
  iterations: {},
  guide: {},
  recipes: [],
  roadmap: []
}

let intel = fs.existsSync(DB_FILE)
  ? JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'))
  : DEFAULT_INTEL

function persist() {
  fs.writeFileSync(DB_FILE, JSON.stringify(intel, null, 2) + '\n')
}

// ============ Express ============
const app = express()
app.use(express.json({ limit: '5mb' }))
app.use(cors({ origin: ALLOWED_ORIGINS === '*' ? true : ALLOWED_ORIGINS.split(',') }))

// 鉴权中间件
function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || ''
  if (auth !== `Bearer ${ADMIN_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized — provide ADMIN_API_KEY via Authorization: Bearer header' })
  }
  next()
}

// 请求日志
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})

// ---- 端点 ----

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    rules: (intel.rules || []).length,
    lessonsNodes: Object.keys(intel.lessons || {}).length,
    bugsNodes: Object.keys(intel.bugs || {}).length,
    recipesCount: (intel.recipes || []).length,
    roadmapItems: (intel.roadmap || []).length,
    schemaValidation: !!schema
  })
})

// 完整 GET
app.get('/api/intel', (_req, res) => res.json(intel))

// 子路径 GET
app.get('/api/intel/by-task', (req, res) => {
  const q = String(req.query.q || '').toLowerCase()
  if (!q) return res.json({ rules: [], lessons: {}, bugs: {}, recipes: [] })
  const result = { rules: [], lessons: {}, bugs: {}, recipes: [] }
  for (const r of intel.rules || []) if (String(r.text).toLowerCase().includes(q)) result.rules.push(r)
  for (const [k, v] of Object.entries(intel.lessons || {})) {
    const m = (Array.isArray(v) ? v : []).filter((l) => String(l).toLowerCase().includes(q))
    if (m.length) result.lessons[k] = m
  }
  for (const [k, v] of Object.entries(intel.bugs || {})) {
    const m = (v.types || []).filter((t) => String(t).toLowerCase().includes(q))
    if (m.length) result.bugs[k] = { ...v, types: m }
  }
  for (const r of intel.recipes || []) {
    if ((r.triggers || []).some((t) => String(t).toLowerCase().includes(q))) result.recipes.push(r)
  }
  res.json(result)
})

app.get('/api/intel/:path(*)', (req, res) => {
  const v = req.params.path.split('/').reduce((o, k) => (o == null ? o : o[k]), intel)
  if (v === undefined) return res.status(404).json({ error: 'path not found' })
  res.json(v)
})

// PUT — 全量替换
app.put('/api/intel', requireAdmin, (req, res) => {
  if (!validate(req.body)) {
    return res.status(400).json({ error: 'Schema validation failed', details: validate.errors })
  }
  intel = req.body
  persist()
  res.json({ ok: true, persisted: DB_FILE })
})

// PATCH — 局部更新 roadmap
app.patch('/api/intel/roadmap/:id', requireAdmin, (req, res) => {
  const item = (intel.roadmap || []).find((r) => r.id === req.params.id)
  if (!item) return res.status(404).json({ error: `roadmap/${req.params.id} not found` })
  Object.assign(item, req.body)
  persist()
  res.json(item)
})

// 启动
app.listen(PORT, () => {
  console.log(`✅ CogMap INTEL server on :${PORT}`)
  console.log(`   DB:  ${DB_FILE}`)
  console.log(`   Schema: ${schema ? 'enabled' : 'disabled'}`)
  console.log(`   CORS: ${ALLOWED_ORIGINS}`)
  console.log(``)
  console.log(`   Test: curl http://localhost:${PORT}/api/health`)
})
