# 接手 CogMap

> 给陌生贡献者 / 下一个 AI / 未来的自己。

## 这是什么

CogMap 是一份让 AI 真正"记得"你的项目，并能"自己干完一件事"的开放协议。三层架构：

1. **项目记忆**（HTTPS API + JSON Schema）— 跨 AI 工具共享的 INTEL 数据库
2. **全链路 Agent**（SKILL.md + 主对话调度 + subagent 双重 review）— 让 AI 按"复述 → 验收规则 → 极具体计划 → TDD → 实现"五步走
3. **跨项目复用**（npm 包 + CLI + MCP server）— `npx create-cogmap` 一行命令带走整套能力

## 4 个 npm 包

| 包 | 状态 | 用途 |
|---|---|---|
| [`cogmap-core`](./packages/core) | 0.1.2 已上线 / **0.1.3 代码 ready 待发** | 协议核心：HTTPS 客户端 + file:// 本地模式 + JSON Schema + lesson-utils + match-failure-precedent + log-retry |
| [`create-cogmap`](./packages/cli) | 0.1.2 已上线 / **0.1.3 代码 ready 待发** | 脚手架 CLI：`npx create-cogmap my-project` |
| [`cogmap-mcp`](./packages/mcp-server) | 0.1.0 已上线 / **0.1.1 代码 ready 待发** | MCP server：8 个工具暴露给 Claude Code / Cursor / Continue / Cline / Zed |
| `cogmap-server-minimal` (示例) | examples/ | 可运行的 INTEL 后端实现，5 分钟起服务 |
| `examples/visual-baseline/` | examples/ | (Q3) pixelmatch 视觉 baseline diff 配方, 防 UI 回退 |

**v0.1.3 publish 状态**: 3 个 git tag 已推 (core-v0.1.3 / cli-v0.1.3 / mcp-v0.1.1), GitHub Actions CI 触发但权限不足 fail. 待用户修 NPM_TOKEN secret 或本地手动 publish. 详见 INTEL.session_handoff.publish_pending.

## 5 分钟上手

```bash
npx create-cogmap@latest my-project
cd my-project
# 改 .cogmap.json 的 api_base 为 "file://./INTEL.json" 用本地模式
npm install
npx cogmap doctor
```

## 完整文档

| 主题 | 文档 |
|---|---|
| 5 分钟上手 | [docs/QUICKSTART.md](./docs/QUICKSTART.md) |
| 写自己的 SKILL.md | [docs/WRITING-SKILLS.md](./docs/WRITING-SKILLS.md) |
| 自部署 INTEL 后端 | [docs/HOSTING-INTEL.md](./docs/HOSTING-INTEL.md) |
| 完整方法论（杂志风 HTML） | `archive/explainers/cogmap-methodology.html`（本地，未推 GitHub） |
| 上次会话交接 | `archive/handoffs/cogmap-handoff-2026-04-27.md`（本地） |

## 接手 AI 的 cold-start

**新对话开第一句**：

```
延续 CogMap 项目。读这两份资料：

1. 本仓库 HANDOFF.md（你现在在看的）
2. archive/handoffs/cogmap-handoff-2026-04-27.md（本地最新交接，含详细任务清单）
3. 当前 INTEL: curl -s https://map-api.rigzin.top/api/intel | jq '.session_handoff'

工作原则：
- 不堆长文，关键事单独提醒
- 自己能做就做，需要 npm token 就让用户自己跑
- 改 schema / API 路径前必须 grep 验证（R2）
- 改完功能 PUT 回 INTEL（R20 沉淀闭环）
- task 结束前 git status 自查（R7）

第一动作：先看 archive/handoffs/ 的最新交接确定从哪接手。
```

## 当前路线图

见 cogmap 自己的 INTEL.json 顶层 `roadmap` 字段：

```bash
cat INTEL.json | jq '.roadmap'
```

简言：P1/P2/P3 已 done（v0.1.0 / v0.1.1 / v0.1.2 三个里程碑），Q1-Q8 待挑（cogmap-mcp 真机验证 / 失败自修复 / 视觉 baseline / lessons tags / rules applies_to / token 切片优化 / release-it）。

## 想 publish v0.1.2 三包？

按 [archive/handoffs/cogmap-handoff-2026-04-27.md](./archive/handoffs/cogmap-handoff-2026-04-27.md) 的"v0.1.2 三包待发"章节走。5 个命令搞定。

## License

MIT — 见 [LICENSE](./LICENSE)。

灵感来源：[obra/superpowers](https://github.com/obra/superpowers)（Jesse Vincent 的 SKILL.md 强制方法论）+ Addy Osmani 的 spec-first + BDD/TDD 多年沉淀。
