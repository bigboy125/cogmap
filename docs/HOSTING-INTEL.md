# 自部署 INTEL 后端

> CogMap HTTPS 模式需要一个 INTEL 服务器。本指南介绍最小可运行的实现 + 部署到 Vercel/Railway/自建服务器。

---

## 你需要做什么

最简版的 INTEL 服务器只需 **5 个 HTTP 端点**：

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/intel` | GET | 公开返回完整 INTEL JSON |
| `/api/intel/:path` | GET | 取子字段（如 `/api/intel/rules`）|
| `/api/intel` | PUT | 校验 schema + UPSERT 整对象（需 Bearer token）|
| `/api/intel/by-task?q=` | GET | 切片返回相关节点（可选）|
| `/api/intel/roadmap/:id` | PATCH | 局部更新 roadmap 项（可选）|

数据存哪都行：Postgres / Redis / SQLite / 一个 JSON 文件 / Vercel KV / Cloudflare KV / Neon。

---

## 最小实现（约 80 行 Express）

```js
// server.mjs
import express from 'express'
import fs from 'node:fs'
import Ajv from 'ajv'

const PORT = process.env.PORT || 3000
const ADMIN_KEY = process.env.ADMIN_API_KEY
const DB_FILE = process.env.DB_FILE || './intel.db.json'

const app = express()
app.use(express.json({ limit: '5mb' }))

// 加载 schema
const schema = JSON.parse(
  fs.readFileSync('./schemas/intel.schema.json', 'utf-8')  // 从 cogmap-core 复制过来
)
const ajv = new Ajv({ allErrors: true, strict: false })
const validate = ajv.compile(schema)

// 加载 INTEL（从 DB_FILE 读，启动时缓存到内存）
let intel = fs.existsSync(DB_FILE)
  ? JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'))
  : { _schema_version: 2, rules: [], lessons: {}, bugs: {}, recipes: [], roadmap: [] }

function persist() {
  fs.writeFileSync(DB_FILE, JSON.stringify(intel, null, 2) + '\n')
}

// ---- 端点 ----

app.get('/api/intel', (req, res) => res.json(intel))

app.get('/api/intel/:path(*)', (req, res) => {
  const v = req.params.path.split('/').reduce((o, k) => (o == null ? o : o[k]), intel)
  if (v === undefined) return res.status(404).json({ error: 'path not found' })
  res.json(v)
})

app.put('/api/intel', (req, res) => {
  // 鉴权
  const auth = req.headers.authorization || ''
  if (auth !== `Bearer ${ADMIN_KEY}`) {
    return res.status(401).json({ error: 'Unauthorized — provide ADMIN_API_KEY via Authorization: Bearer header' })
  }
  // schema 校验
  if (!validate(req.body)) {
    return res.status(400).json({ error: 'Schema validation failed', details: validate.errors })
  }
  intel = req.body
  persist()
  res.json({ ok: true })
})

app.patch('/api/intel/roadmap/:id', (req, res) => {
  const auth = req.headers.authorization || ''
  if (auth !== `Bearer ${ADMIN_KEY}`) return res.status(401).json({ error: 'Unauthorized' })
  const item = (intel.roadmap || []).find((r) => r.id === req.params.id)
  if (!item) return res.status(404).json({ error: `roadmap/${req.params.id} not found` })
  Object.assign(item, req.body)
  persist()
  res.json(item)
})

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

app.listen(PORT, () => console.log(`INTEL server on :${PORT}`))
```

依赖：`npm install express ajv`。schema 文件从 `cogmap-core` 包复制到本项目 `./schemas/intel.schema.json`。

启动：

```bash
ADMIN_API_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") \
  node server.mjs
```

---

## 部署到 Vercel（最简）

把上面 `server.mjs` 改造成 Vercel Function：

```js
// api/[...path].mjs
import { app } from './app.mjs'  // 上面的 express app
export default app
```

`vercel.json`:
```json
{ "rewrites": [{ "source": "/api/:path*", "destination": "/api/[...path]" }] }
```

环境变量：在 Vercel dashboard 设 `ADMIN_API_KEY`。

数据持久化：Vercel function 是无状态的，不能用本地文件。改用 [Vercel KV / Vercel Postgres](https://vercel.com/storage) 或 [Neon](https://neon.tech)：

```js
import { sql } from '@vercel/postgres'
async function loadIntel() {
  const { rows } = await sql`SELECT data FROM intel WHERE id = 'main'`
  return rows[0]?.data || defaultIntel
}
async function saveIntel(intel) {
  await sql`INSERT INTO intel (id, data) VALUES ('main', ${intel})
            ON CONFLICT (id) DO UPDATE SET data = ${intel}, updated_at = NOW()`
}
```

`CREATE TABLE intel (id text PRIMARY KEY, data jsonb, updated_at timestamptz DEFAULT NOW())`。

---

## 部署到 Railway / Render / Fly.io

直接 push 上面的 Express 项目即可。建议：

- 把 `DB_FILE` 改成持久化卷路径（Railway: `/data/intel.db.json`，挂载 volume）
- 或换成 Postgres（DATABASE_URL）— 跟 Vercel 同款

---

## 部署到自建服务器（VPS）

```bash
# 1. 上传代码到 /opt/cogmap-server
# 2. 配 systemd service
[Unit]
Description=CogMap INTEL Server

[Service]
ExecStart=/usr/bin/node /opt/cogmap-server/server.mjs
Environment=PORT=3000
Environment=ADMIN_API_KEY=...your-secret...
Environment=DB_FILE=/var/lib/cogmap/intel.db.json
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable cogmap
sudo systemctl start cogmap
```

Nginx 反代到 443：

```nginx
server {
  listen 443 ssl http2;
  server_name cogmap.your-domain.com;
  location /api/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
  }
}
```

---

## 客户端配置

部署完后，每个使用项目的 `.cogmap.json`：

```json
{
  "project_name": "your-project",
  "api_base": "https://cogmap.your-domain.com",
  "api_key_env": "COGMAP_API_KEY"
}
```

每个开发者的 shell 里：
```bash
export COGMAP_API_KEY=...your-admin-key...
```

或写到 `~/.cogmap/credentials.json`:
```json
{ "api_key": "..." }
```

---

## 进阶

### 多项目隔离

一台 INTEL 服务器服务多个项目？给每个项目一个独立 `id`：

```js
app.get('/api/:project/intel', ...)
```

客户端 `api_base` 改为 `https://cogmap.your-domain.com/api/myproject`。

### 多用户写权限

简单：所有人共用一个 `ADMIN_API_KEY`。
复杂：给每个用户一个 token，记录 `last_writer` 字段，PATCH 类操作锁个体字段。

### 历史版本 / 撤销

- 每次 PUT 把旧 INTEL 存到 `intel_history` 表，按时间序
- 或用 Git：把 INTEL.json 推到一个 Git repo，自带版本控制

### 实时同步

加 SSE / WebSocket 推送 INTEL 变更，客户端实时刷新 CLAUDE.md：
```js
app.get('/api/intel/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  emitter.on('update', (i) => res.write(`data: ${JSON.stringify(i)}\n\n`))
})
```

---

## 参考实现

- **完整生产实例**: https://map-api.rigzin.top（来自 [bigboy125/rigzin-map-api](https://github.com/bigboy125/rigzin-map-api)）
  - Express + ajv + Neon Postgres + Bearer auth
  - 全套 INTEL 端点 + admin token 旋转 + 多 schema 版本兼容
- **服务器模板包**（路线图项 Q1 同级）：未来计划 `npx create-cogmap-server` 一行启动后端，敬请期待

---

## 进一步

- [QUICKSTART.md](./QUICKSTART.md) — 5 分钟客户端上手
- [WRITING-SKILLS.md](./WRITING-SKILLS.md) — 写 SKILL.md 最佳实践
- [README](../README.md) — 协议架构总览
