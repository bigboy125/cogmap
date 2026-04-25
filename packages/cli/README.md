# create-cogmap

CogMap 脚手架 — 一行命令初始化 CogMap 项目。

## 用法

```bash
# 初始化新项目
npx create-cogmap my-project
cd my-project

# 或在已有项目里加 CogMap
cd existing-project
npx create-cogmap .
```

## 初始化产物

```
my-project/
├── .claude/
│   ├── settings.json              # SessionStart / Stop hooks
│   ├── hooks/
│   │   ├── session-start.sh       # 拉 INTEL → 注入 CLAUDE.md
│   │   └── session-end.sh         # 跑 audit + dev-quality
│   └── skills/                    # 项目 SKILL.md 目录
│       └── .gitkeep
├── scripts/
│   ├── audit-map-coverage.mjs    # 用 @cogmap/core/audit
│   ├── validate-intel.mjs         # 用 @cogmap/core/validate
│   ├── match-recipe.mjs           # 用 @cogmap/core/match-recipe
│   ├── check-bug-history.mjs      # 用 @cogmap/core/check-bug-history
│   └── sync-intel-to-claude-md.mjs
├── INTEL.json                     # 初始 INTEL 数据
├── .cogmap.json                   # 项目 CogMap 配置(api_base 等)
├── CLAUDE.md                      # 项目 AI 指令文件 (auto-generated)
├── .gitignore                     # 含 CLAUDE.md 等 cogmap 内部文件
├── cogmap-explainer.html          # 对外说明文档
└── package.json                   # 含 @cogmap/core 依赖
```

## 命令

```bash
cogmap init [dir]      # 初始化 (默认当前目录)
cogmap doctor          # 诊断: 检查 INTEL 端点连通性 / scripts 完整性 / hook 注册
cogmap upgrade         # 升级 templates (谨慎, 会覆盖)
cogmap version         # 显示版本
```

## 配置

项目根 `.cogmap.json`:

```json
{
  "api_base": "https://your-domain.com",
  "api_key_env": "COGMAP_API_KEY",
  "project_name": "my-project"
}
```

## 后续步骤

1. 起一个 INTEL 后端 (或用现有的)
2. 设置 `COGMAP_API_KEY` 环境变量
3. 在 Claude Code / Cursor / 其他 AI 工具里打开项目
4. SessionStart hook 自动拉 INTEL 注入 CLAUDE.md
5. 写需求 → AI 自动按 SKILL.md 五步走

## License

MIT
