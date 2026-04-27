# Changelog

## [Unreleased]

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
