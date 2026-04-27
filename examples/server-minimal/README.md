# cogmap-server-minimal

最小可运行的 CogMap INTEL 后端实现。**5 分钟从零起服务**。

## 跑起来

```bash
cd examples/server-minimal
npm install

# 生成随机 ADMIN_API_KEY
npm run init-key
# 输出: ADMIN_API_KEY=a1b2c3d4...
# 复制这一行到环境变量

# 启动
ADMIN_API_KEY=a1b2c3d4... npm start
# 输出: ✅ CogMap INTEL server on :3000

# 测试
curl http://localhost:3000/api/health
# {"ok":true,"rules":0,...}

# 写一条规则
curl -X PUT http://localhost:3000/api/intel \
  -H "Authorization: Bearer a1b2c3d4..." \
  -H "Content-Type: application/json" \
  -d '{"_schema_version":2,"rules":[{"text":"test rule","critical":true}]}'

# 验证
curl http://localhost:3000/api/intel
```

## 文件

- `server.mjs` — 120 行 Express，5 个核心端点 + 健康检查
- `intel.db.json` — 数据持久化（自动创建，gitignored）
- `intel.schema.json` — 可选放这里覆盖默认 schema
- `package.json` — 依赖 express + ajv + cors

## 5 个端点

| 端点 | 方法 | 鉴权 | 说明 |
|---|---|---|---|
| `/api/health` | GET | — | 健康检查 + 数据规模 |
| `/api/intel` | GET | — | 完整 INTEL JSON |
| `/api/intel/:path(*)` | GET | — | 取子字段（如 `/api/intel/rules`） |
| `/api/intel/by-task?q=X` | GET | — | 关键词切片返回相关节点 |
| `/api/intel` | PUT | Bearer | 全量替换 + schema 校验 |
| `/api/intel/roadmap/:id` | PATCH | Bearer | 局部更新 roadmap 项 |

## 客户端配置

任何用 cogmap-core 的项目 `.cogmap.json`：

```json
{
  "project_name": "your-project",
  "api_base": "http://localhost:3000"
}
```

环境变量：`COGMAP_API_KEY=<你刚生成的 ADMIN_API_KEY>`。

## 部署到生产

### Vercel

把 `server.mjs` 改造成 Vercel Function（用 `@vercel/postgres` 替代本地文件持久化）。详见 [docs/HOSTING-INTEL.md](../../docs/HOSTING-INTEL.md#部署到-vercel最简)。

### Railway / Render / Fly.io

直接 `git push`，加挂载卷给 `intel.db.json`。

### 自建服务器（VPS）

- systemd service + Nginx 反代到 443
- 详见 [docs/HOSTING-INTEL.md](../../docs/HOSTING-INTEL.md#部署到自建服务器vps)

## 升级路径

这是**最小**实现，以下功能没做（按需求加）：

- ❌ 多项目隔离（每个项目独立 INTEL）
- ❌ 多用户写权限（per-user token）
- ❌ 历史版本 / undo（每次 PUT 旧版进归档）
- ❌ 实时同步（SSE / WebSocket 推送）
- ❌ 数据库后端（仍是本地 JSON 文件）

需要这些 → 看 https://map-api.rigzin.top（参考生产实现，用 Neon Postgres + 多 schema 版本）。

## 安全提示

- ⚠️ `ADMIN_API_KEY` 是 admin 全权 token — 不要提交进 git
- ⚠️ 公网部署务必加 HTTPS（Nginx + Let's Encrypt）
- ⚠️ CORS 默认 `*`，生产环境改成你的域名白名单：`ALLOWED_ORIGINS=https://your-app.com`
- ⚠️ 本地 JSON 文件不适合多实例部署（并发写覆盖），生产换 Postgres
