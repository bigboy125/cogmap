# CogMap

> AI 协作工程化方法论开放协议 — Cross-AI memory + L1 全链路 Agent + 跨项目复用套件

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
| [`cogmap-core`](./packages/core) | 协议核心：map-client + JSON Schema + audit/validate 工具 | 0.1.0 |
| [`create-cogmap`](./packages/cli) | 脚手架 CLI：一行命令初始化 CogMap 项目 | 0.1.0 |

## 快速开始

```bash
# 在任意目录跑
npx create-cogmap my-project
cd my-project
# 即获得：.claude/skills/ 模板 + INTEL.json 初始结构 + scripts/ 工具集 + SessionStart/Stop hooks
```

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
