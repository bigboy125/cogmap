<!-- COGMAP:RULES:BEGIN -->
<!-- 本块由 scripts/sync-intel-to-claude-md.mjs 自动同步 (SessionStart hook), 请勿手改 -->
<!-- COGMAP:RULES:END -->

# {{PROJECT_NAME}}

> CogMap-enabled project. Initialized at {{DATE}}.

## 项目概览

[TODO: 用一两段话描述本项目的目标、用户、主要功能]

## 技术栈

[TODO: 列出技术栈 — 例: Vue 3 + Vite + Vercel / Node.js + Express / etc.]

## 开发命令

```bash
# [TODO: 项目特定命令]

# CogMap 工具
npm run audit              # 跑覆盖率审计
npm run validate           # 校验 INTEL schema
npm run match-recipe "..." # 按需求匹配 SKILL
```

## CogMap 协议层 (本项目用)

- **INTEL 端点**: 见 `.cogmap.json` 的 `api_base`
- **凭据**: `COGMAP_API_KEY` 环境变量 / `~/.cogmap/credentials.json`
- **SKILL 目录**: `.claude/skills/<id>/SKILL.md` (项目特定 skill)
- **Hooks**:
  - SessionStart → 同步 INTEL 关键规则到本文件顶部 + 注入近期 git context
  - Stop → 跑 audit-map-coverage 检查覆盖率
- **跨工具同步**(AI agnostic):
  - Cursor 用户跑: `node scripts/sync-intel-to-cursor-rules.mjs` → 写 `.cursor/rules/cogmap.mdc`
  - Codex/Continue/Aider 用户跑: `node scripts/sync-intel-to-agents-md.mjs` → 写项目根 `AGENTS.md`(通用标准)
  - 同一份 INTEL,不同 AI 工具消费,换工具不丢记忆

## 协作规则

请遵守上方 `COGMAP:RULES` 块中的规则 (从 INTEL 自动同步, 你不需要手记)。

特别是:
- **R8 验证终点用户可见** — MCP/settings 改动必须用户重启后真能看到, 不是脚本能跑
- **R10 主对话调度** — 主对话不亲自写代码, 派 subagent 走 SKILL 五步流程
- **R12 SKILL 优先** — 命中关键词时, 必须按 `.claude/skills/<id>/SKILL.md` 五步流程做

完整规则见 https://github.com/bigboy125/cogmap

## License

[TODO]
