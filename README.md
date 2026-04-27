# CogMap

> AI 协作工程化方法论开放协议 — Cross-AI memory + L1 全链路 Agent + 跨项目复用套件

**接手指南** → [HANDOFF.md](./HANDOFF.md)（陌生贡献者 / 接手 AI 必读）

CogMap 是一套**让 AI 真正"记得"项目 + 替你"自己干完"**的开放协议层。它解决两个核心问题：

1. **AI 不记得**：每次新对话都从零开始，知识散在 README、Slack、个人记忆里，跨 AI 工具不可见
2. **AI 不自主**：即便 AI 记得，仍要你当"人肉胶水"——AI 写一段、你测一下、报错回贴、再改一段

### 三层架构

| 层 | 解决什么 | 提供什么 |
|---|---|---|
| **第一层 项目记忆** | AI 不记得 | INTEL HTTPS API + JSON Schema + 跨 AI 共享 |
| **第二层 全链路 Agent** | AI 不自主 | SKILL.md 五步流程 + subagent 双重 review + worktree 并行 |
| **第三层 跨项目复用** | 经验不可移植 | npm 包 + `create-cogmap` CLI 一行部署 |

## 包

| 包 | 说明 | 状态 |
|---|---|---|
| [`cogmap-core`](./packages/core) | 协议核心：map-client + JSON Schema + audit/validate 工具 | 0.1.2 |
| [`create-cogmap`](./packages/cli) | 脚手架 CLI：一行命令初始化 CogMap 项目 | 0.1.2 |
| [`cogmap-mcp`](./packages/mcp-server) | MCP server：把 INTEL 暴露给 Claude Code / Cursor / Continue / Cline / Zed 任何 MCP 客户端 | 0.1.0 |

## 与 Claude Code 原生 worktree 的关系

Claude Code v2.1.49 (2026-02) 起原生支持 `claude -w <name>`。CogMap 与之**互补两层**：

| 层 | 谁开 worktree | 何时用 |
|---|---|---|
| **会话级** (CC 原生) | 用户 / 主对话 | 改动 >5 文件 / 跨模块 / 长实验 — 主分支保持干净 |
| **任务级** (CogMap R10/R11) | 主对话派 subagent | 单个任务 + 双重 review 各自隔离 context |

CogMap 在 INTEL.rules 立 **R13** 强制规范：改动 >5 文件 必须先 `claude -w`。新项目 `npx create-cogmap` 自动把 `.claude/worktrees/` 加 .gitignore。`cogmap doctor` 检查残留 worktree。

## AI agnostic — 跨工具同步

CogMap 不锁 Claude。同一份 INTEL 可同步到任何 AI 工具的规则文件:

| 工具 | 规则文件 | 同步脚本 |
|---|---|---|
| Claude Code | `CLAUDE.md` | `node scripts/sync-intel-to-claude-md.mjs` (SessionStart hook 自动) |
| Cursor | `.cursor/rules/cogmap.mdc` | `node scripts/sync-intel-to-cursor-rules.mjs` |
| OpenAI Codex / Cursor / Continue / Aider | `AGENTS.md` (通用标准) | `node scripts/sync-intel-to-agents-md.mjs` |

> 协议核心是 INTEL HTTPS API; 各 AI 工具用自己的规则文件格式消费, 不互相依赖. 换工具不丢记忆.

## 快速开始

### 选项 A：file:// 本地模式（无后端，3 秒上手）

```bash
npx create-cogmap my-project
cd my-project
# 在 .cogmap.json 改 api_base 为 "file://./INTEL.json"
npm install
node scripts/validate-intel.mjs   # 跑通即可用
```
适合：个人项目 / 起步 / 离线。限制：不跨设备同步、不跨 AI 工具协作。

### 选项 B：HTTPS 后端模式（团队 / 跨工具）

```bash
npx create-cogmap my-project
cd my-project
# 改 .cogmap.json api_base 指向你自部署的 INTEL 服务器
export COGMAP_API_KEY=your-admin-key
npm install
```
适合：团队协作 / 多设备 / 多 AI 工具共享同一份 INTEL。需要自部署 INTEL 后端（map-api 项目模板待发，目前可参考 https://map-api.rigzin.top 实例）。

## 设计哲学

- **机器优先而非人类优先** — wiki 是给人读的，CogMap 是给 AI 读的，按需切片
- **自我演进而非一次写死** — `roadmap` 字段允许任何对话直接 PUT 追加
- **AI agnostic** — Claude / GPT / Cursor / Gemini 全部读同一份 INTEL，定义协议而非配置产品
- **协议不是产品** — 你的 INTEL 服务器自己跑，不锁定任何厂商

## 灵感来源

- [obra/superpowers](https://github.com/obra/superpowers) — Jesse Vincent 的 SKILL.md 强制方法论
- Addy Osmani — spec-first 工程实践
- BDD/TDD 多年沉淀
- map.rigzin.top — 第一个真实落地的 CogMap 实例

## License

MIT
