# Changelog

## [Unreleased]

### `cogmap-core` 新模块 (Q2 L3 失败自修复)

- **`match-failure-precedent.mjs`**: 错误文本 → 在 INTEL.bugs/lessons/retry_log 里查相似先例 → 返回最高分 fix_pattern 或 null
  - 中英混合切词 + Jaccard 相似度
  - 优先级: retry_log success (1.1x boost) > bug (1.0x) > lesson (0.8x discount)
  - 默认 threshold 0.15, 可调
  - 命中 null 时调用方必须升级 (R14), 不允许凭空猜测
- **`log-retry.mjs`**: 把 retry 尝试写进 INTEL.retry_log + 计算同签名累计次数
  - 同步 (传 intel) / 异步 (自动 get/put) 两种模式
  - countAttemptsForSignature: 关键词 ≥50% 重叠视为同签名, 用于 R14 的 ≤3 上限
- 5 个 smoke test 覆盖 (18/18 全过)
- **设计哲学** (老罗 2026-04-28): 模式驱动 ≠ 规则驱动. retry 必须查过去成功的修复, 不允许 AI 凭空发明. 可视化 (retry_log) + 迭代 (越用越准).

### Schema 扩展

- `intel.schema.json` 顶层加 `retry_log` 数组 (L3 留痕日志, 含 ts/failure_signature/matched_precedent/fix_applied/outcome/attempt_n)
- `bugs[id]` 加 `fix_pattern` 可选字段 (可复用的修复模板, 比 lessons 更显式)

### Templates 更新

- `templates/INTEL.json` 加 R14 (模式驱动 retry 强制规范) + retry-on-failure recipe + retry_log 空数组
- `templates/.claude/skills/retry-on-failure/SKILL.md` 新增 — L3 五步流程文档 (提取签名 → 查先例 → 套用/升级 → 重跑 → logRetry 留痕)

### `cogmap-core` API 扩展

- **`searchByTask(query, opts)` Q6 token 切片优化**: 新增 3 个可选参数, 默认行为保持兼容
  - `slim: true` — recipe 只返回头部决策字段 (id/scenario/triggers/confidence/skill_path/estimatedTime), 省 token
  - `limit: number` — 每个类别最多返回几条, 防爆量
  - `fields: string[]` — 只返回指定类别 (rules/lessons/bugs/recipes), 默认全部
  - HTTPS 模式把这些作为 query param 传后端, 后端可选实现
  - 3 个 smoke test 覆盖

### `cogmap-mcp` 工具增强

- `cogmap_search_by_task` 工具入参加 `slim` / `limit` / `fields` 三个可选参数, 与 cogmap-core 对齐. AI 可以选择更省 token 的检索模式.

### 新示例

- **`examples/visual-baseline/`** (Q3): 视觉 baseline diff 配方 — pixelmatch + pngjs 实现, 兼容 Chrome MCP 截图. `npm run demo` 验证: 2.0% 像素差 > 1% 阈值 ⇒ 退出 1 ⇒ 检测到回退. 含 5 分钟试用 + SKILL.md 集成片段 + 进阶思路.

### 工程

- **release-it 集成 (Q8)**: 三包 monorepo 一键 release 流程
  - root devDep `release-it@^20`
  - 各包 `package.json` 加 `release-it` 字段, tag prefix 区分 (`core-v` / `cli-v` / `mcp-v`)
  - root scripts: `npm run release:core` / `release:cli` / `release:mcp`
  - 配 `npm.publish=false` (publish 仍由 GH Actions tag-trigger 或手动负责), `before:init` 跑 `npm test`
  - 用法: `npm run release:core` → 提示 bump → 自动 commit + tag + push → 触发 publish.yml
- **rules `applies_to` 字段 dogfood (Q5)**: cogmap 自身 INTEL 8 条 rule 全部填充, 域用 `release` / `schema` / `api` / `packaging` / `templates` / `all`. (schema 早已支持, 本次落数据.)

### 路线图状态校正

- Q4 lessons tags: proposed → **blocked** (本轮发现需 consumer 重构 + schema 双形态兼容, 至少 1.5h, 留待下轮)
- Q5 / Q7 / Q8: → **done**

## [0.1.2] — 2026-04-27

三包同日发布: `cogmap-core@0.1.2` + `create-cogmap@0.1.2` + `cogmap-mcp@0.1.0`(新包首发).

### `cogmap-mcp@0.1.0` (新包首发)

新增包. CogMap **MCP Server** — 把 INTEL 暴露成 Model Context Protocol tools, 任何 MCP 客户端 (Claude Code / Cursor / Continue / Cline / Zed) 都能用.

特性:
- 7 个 tool: cogmap_get_intel / search_by_task / check_bug_history / match_recipe / put_intel / patch_roadmap / info
- stdio JSON-RPC 2.0, 手写最小实现 (不依赖 @modelcontextprotocol/sdk, 零额外依赖除 cogmap-core)
- 协议版本 2024-11-05
- 支持 file:// 和 HTTPS 两种 INTEL 后端
- stderr 启动日志, stdout 严格 JSON-RPC (不污染协议流)

冒烟测试:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | node packages/mcp-server/src/server.mjs
```
返回正确的 initialize response, 7 个 tool 全部 list 出.

### `cogmap-core@0.1.2`

新增:
- **file:// 本地模式** — `api_base: "file://./INTEL.json"` 直接读写本地 JSON, 无需后端
  - 适合个人/起步/离线场景
  - `getIntel` / `putIntel` / `patchRoadmap` / `searchByTask` 全部支持 file:// 模式
  - searchByTask 在 file:// 模式下做客户端 OR 检索 (rules + lessons + bugs + recipes)
- 新导出: `isFileMode(base)` 帮助函数

### `create-cogmap@0.1.2`

新增:
- **跨 AI 工具同步脚本**(AI agnostic 真正落地):
  - `scripts/sync-intel-to-cursor-rules.mjs` — 写 `.cursor/rules/cogmap.mdc` (Cursor 自动加载)
  - `scripts/sync-intel-to-agents-md.mjs` — 写 `AGENTS.md` (OpenAI Codex / Cursor / Continue / Aider 通用标准)

修复:
- `templates/.gitignore` 重命名为 `templates/_gitignore`,init 时自动改名 — 避免 cogmap repo 自己被 templates 的 .gitignore 影响
- 顶层 `.gitignore` 的 `CLAUDE.md` 改为 `/CLAUDE.md` (anchor 到仓库根),让 `templates/CLAUDE.md` 终于能进 repo

文档:
- README 加 "AI agnostic — 跨工具同步" 章节
- README 加 "与 Claude Code 原生 worktree 的关系" 章节
- `templates/CLAUDE.md` 提到 Cursor/Codex 跨工具流程

工程:
- GitHub Actions CI: push/PR 自动跑测试 (Node 18/20/22 矩阵)
- GitHub Actions Publish: 推 tag `core-v0.1.2` 或 `cli-v0.1.2` 自动 publish (需配置 `NPM_TOKEN` secret)
- `packages/core/test/smoke.test.mjs` — 10 个 smoke test 覆盖 schema / match-recipe / check-bug-history / get-key / file:// mode (3 项)
- doctor 命令支持 file:// 协议 (不要求 COGMAP_API_KEY, 验证 INTEL 文件存在)
- cogmap repo 自己 dogfood: 顶层 .cogmap.json + INTEL.json 用 file:// 模式管理项目记忆

---

## [0.1.1] — 2026-04-26

### `cogmap-core@0.1.1`

修复:
- INTEL schema iterations 字段兼容真实数据 — 之前要求 array, 但实际项目里有 object 结构, 改为 `additionalProperties: true`

### `create-cogmap@0.1.1`

新增:
- 适配 **Claude Code v2.1.49+ 原生 worktree** (`claude -w <name>`)
  - `templates/.gitignore` 加 `.claude/worktrees/`(R13)
  - `cogmap doctor` 新增 2 项检查: worktrees 目录状态 + .gitignore 规则
- 顶层 `.gitignore` 加 `.claude/worktrees/`

文档:
- README 加 "与 Claude Code 原生 worktree 的关系" 章节, 说明 CogMap 任务级 worktree 与 CC 会话级 worktree 互补两层

---

## [0.1.0] — 2026-04-25

首发. Phase 0 + 1 + 2 全部完成.

### `cogmap-core@0.1.0`

- `map-client` (getIntel / putIntel / patchRoadmap / searchByTask)
- `audit` (覆盖率审计)
- `validate` (JSON Schema 校验)
- `match-recipe` (按需求关键词匹配 SKILL/recipe + confidence 加权)
- `check-bug-history` (历史 bug 全文检索)
- `schemas/intel.schema.json` (协议核心 schema, draft-07)

### `create-cogmap@0.1.0`

- CLI 命令: `init` / `doctor` / `version` / `--help`
- 13 个 template 文件铺开:
  - `.claude/settings.json` + `.claude/hooks/{session-start,session-end}.sh` + `.claude/skills/.gitkeep`
  - `scripts/{audit-map-coverage,validate-intel,match-recipe,check-bug-history,sync-intel-to-claude-md}.mjs`
  - `INTEL.json` 初始模板 (含 R1-R12 12 条核心 critical rule)
  - `CLAUDE.md` 模板 + `.gitignore`
- 安全检查: 目录非空必须 `--force`
- git auto init (`--no-git` 跳过)
- 自动 chmod +x hooks
