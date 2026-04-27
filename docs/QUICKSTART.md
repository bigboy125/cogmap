# CogMap 5 分钟上手

> 让 AI 真正记得你的项目，并能自己干完一件事。

---

## 你将获得

- 一份**跨 AI 工具共享**的项目记忆数据库
- 6+ 个 SKILL.md 模板，让 AI 按"复述 → 验收规则 → 极具体计划 → TDD → 实现"五步流程做需求
- 配套 hooks：会话开始自动同步规则到 `CLAUDE.md`，结束自动跑覆盖率审计
- `npx create-cogmap` / `cogmap doctor` / `cogmap init` 等 CLI 工具

## 选哪种模式

| 场景 | 推荐 |
|---|---|
| 个人项目 / 起步 / 离线 | **file:// 本地模式**（30 秒上手，无后端） |
| 团队协作 / 多 AI 工具协作 / 多设备同步 | **HTTPS 后端模式**（需要自部署 INTEL 服务器） |

下面分两条路。

---

## 路径 A：file:// 本地模式（推荐入门）

### Step 1 — 初始化

```bash
cd /your/project/dir
npx create-cogmap@latest .
```

会生成 13 个文件（.claude/* + scripts/* + INTEL.json + CLAUDE.md + .gitignore + package.json）。

### Step 2 — 切到 file:// 模式

打开 `.cogmap.json`，把 `api_base` 改成：

```json
{
  "project_name": "your-project",
  "api_base": "file://./INTEL.json"
}
```

### Step 3 — 装依赖

```bash
npm install
```

### Step 4 — 验证

```bash
npx cogmap doctor
```

期待全 ✅（`COGMAP_API_KEY` 在 file:// 模式下不需要，会显示 "not needed"）。

### Step 5 — 用起来

打开 Claude Code（或 Cursor），SessionStart hook 会自动跑 `sync-intel-to-claude-md.mjs`，把 critical rules 注入 `CLAUDE.md` 顶部。

```bash
# 跑覆盖率审计
node scripts/audit-map-coverage.mjs

# 检索历史 bug
node scripts/check-bug-history.mjs <关键词>

# 匹配 SKILL/recipe
node scripts/match-recipe.mjs "<需求描述>"

# 跨工具同步（Cursor 用户）
node scripts/sync-intel-to-cursor-rules.mjs

# 跨工具同步（Codex / Aider / Continue 用户）
node scripts/sync-intel-to-agents-md.mjs
```

---

## 路径 B：HTTPS 后端模式（团队协作）

### Step 1 — 自部署 INTEL 后端

最简形态是一个 Express + ajv + 任意 K/V 存储（Postgres/Redis/SQLite/JSON 文件）的服务器：

- `GET /api/intel` — 公开返回完整 INTEL JSON
- `PUT /api/intel` — 校验 schema + 持久化（需 Bearer token）
- `GET /api/intel/by-task?q=keyword` — 切片返回相关节点（可选）
- `PATCH /api/intel/roadmap/:id` — 局部更新 roadmap 项（可选）

参考实现见 https://map-api.rigzin.top（`bigboy125/rigzin-map-api`）。完整自部署模板包是 P1 路线图项，待发。

### Step 2 — 初始化项目

```bash
cd /your/project
npx create-cogmap@latest . --api-base https://your-cogmap-server.com
export COGMAP_API_KEY=your-admin-key
npm install
```

### Step 3 — 验证

```bash
npx cogmap doctor
```

期待 INTEL 端点连通 + GET 成功 + COGMAP_API_KEY 已设。

### Step 4 — 团队协作

队友也跑 `npx create-cogmap` 指向**同一个** `api_base`。这样所有成员、所有 AI 工具、所有设备读写**同一份** INTEL。一个人发现的坑，其他人下次自动避。

---

## 写你自己的 SKILL

`.claude/skills/` 是空目录。加项目特定的 SKILL.md：

```bash
mkdir -p .claude/skills/add-payment-method
cat > .claude/skills/add-payment-method/SKILL.md <<'EOF'
---
name: add-payment-method
description: 当用户要求加新支付方式 (Apple Pay / Stripe / Alipay 等) 时调用
---

# Skill: add-payment-method

## 触发场景
加新支付渠道 / 改支付流程

**关键词**: 支付 · payment · checkout · Stripe · Apple Pay

## 涉及文件
- `src/services/payment.js`
- `src/components/Checkout.vue`
- `tests/payment.test.js`

## 五步流程

### Step 1 · 复述 + 探查 3 来源
- 用户原话: ____
- grep payment.js 现有 provider 实现
- check-bug-history "支付"
- git log -5 src/services/payment.js

### Step 2 · 验收规则（用户视角）
- AC1: 用户能选择新支付方式
- AC2: 失败有 Toast 提示
- AC3: 不破坏现有 Stripe / Alipay
- AC4: 移动端样式不溢出

### Step 3 · 极具体计划
- T1: payment.js 加 provider X
- T2: Checkout.vue 加选项 + 图标
- T3: 测试覆盖正面/失败/取消

### Step 4 · TDD 测试用例
- 正面: 选 X → 跳转 X → 回调成功
- 边界: 网络失败重试 3 次
- 回归: Stripe / Alipay 仍工作

### Step 5 · 实现 + 部署 + 沉淀
- 上面 T1-T3 跑过
- 沉淀: PUT INTEL.bugs[payment] / lessons append
EOF
```

下次新对话里，AI 看到"加 Stripe 支付"自动加载这个 SKILL，按五步走。

---

## 常见问题

**Q: 我的项目已经有 .gitignore / package.json 了，会被覆盖吗？**

不会。`create-cogmap` 检测目录非空时要求 `--force`，且只**新增**文件不覆盖 package.json（如果存在）。.gitignore 是新增（你的旧 .gitignore 在则保留你的）。

**Q: 切换 AI 工具（Claude → Cursor → Codex）会丢记忆吗？**

不会。INTEL 是工具无关的协议层。Cursor 跑 `sync-intel-to-cursor-rules.mjs`，Codex 跑 `sync-intel-to-agents-md.mjs`，都是从同一份 INTEL 读取。

**Q: file:// 模式能升级到 HTTPS 模式吗？**

能。把 `INTEL.json` 内容 PUT 到你的 HTTPS 后端，然后改 `.cogmap.json` 的 `api_base` 即可。数据无损迁移。

**Q: 团队协作时怎么避免冲突？**

INTEL 是 single-writer 协议（PUT 是 UPSERT 整对象）。建议团队约定：批量更新走 `patchRoadmap` / `appendRule`（局部操作），全量 PUT 只在 schema 升级时做。或者用乐观锁（add `_version` 字段）。

**Q: 失败怎么排查？**

```bash
npx cogmap doctor   # 看哪一项 ❌
node scripts/validate-intel.mjs   # 校验 INTEL 结构
```

---

## 下一步

- [README](../README.md) — 完整架构说明
- [CHANGELOG](../CHANGELOG.md) — 版本变更
- [GitHub](https://github.com/bigboy125/cogmap) — 源码 + Issue
- [npm: cogmap-core](https://www.npmjs.com/package/cogmap-core)
- [npm: create-cogmap](https://www.npmjs.com/package/create-cogmap)

License: MIT
