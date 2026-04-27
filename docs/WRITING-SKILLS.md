# 写 SKILL.md 的最佳实践

> SKILL.md 是 Anthropic 官方协议的 AI 技能文件。AI 看到需求关键词就**自动加载**对应的 SKILL，按五步流程做事。这是 CogMap 的核心机制。

---

## 一个 SKILL.md 长什么样

```markdown
---
name: add-calendar-format
description: 当用户提到 iCal / Zoom / 会议号 / Passcode / Webinar / Meeting ID 等需求时调用
---

# Skill: add-calendar-format

## 触发场景
[一两句话描述什么时候调用]

**关键词**: A · B · C

## 涉及文件
- `path/to/file1.js`
- `path/to/file2.test.js`

## 五步流程

### Step 1 · 复述需求 + 探查 3 来源
- 用户原话: ____
- 探查 1: `grep ...`
- 探查 2: `mcp__rigzin-admin__rigzin_get_intel path:bugs.X`
- 探查 3: `git log -5 -- path/to/file`

### Step 2 · 验收规则(用户视角, 等用户审 ✅ 才动手)
- AC1: 用户能/不能 X
- AC2: 边界情况 Y 不崩
- AC3: 部署后 Z 真生效

### Step 3 · 极具体计划(每任务 2-5 分钟)
- T1: 改文件 A 第 N 行
- T2: 改文件 B 加测试
- T3: 跑 npm test
- T4: push 部署
- T5: 沉淀回 INTEL

### Step 4 · TDD 测试用例(Red → Green)
[正面 / 负面 / 边界 / 回归 各几条]

### Step 5 · 实现 → 部署 → 沉淀
[最终交付动作]

## 历史教训(必遵守)
- ⚠️ 关键陷阱 1
- 关键约束 2

## 信心度 & 时间
high / medium / low · 估计耗时
```

---

## 8 个写作要点

### 1. `description` 要包含触发关键词
AI 是按 description 判断要不要加载这个 SKILL。差的 description："对日历相关需求调用"。好的："当用户提到 iCal / Zoom / 会议号 / Passcode / Webinar / Meeting ID 等需求时调用"。**列出实际可能出现的关键词**。

### 2. 每个 SKILL 解决**一个**清晰的场景
不要写"add-everything"那种万能 SKILL。一个 SKILL = 一个 recipe = 一类需求。规模超过这个就拆。

### 3. 五步流程是必须，不是可选
- **复述 + 探查**：让 AI 显式确认理解 + grep 三个来源（本地代码 / INTEL / git log）
- **验收规则**：用户视角的 AC，不含代码术语
- **极具体计划**：精确到文件路径 + 关键代码片段，"给热情但没判断力的初级工程师写"
- **TDD 测试用例**：Red 在前（先写失败测试）→ Green 让测试通过
- **实现 + 沉淀**：完成后 PUT 回 INTEL

### 4. 验收规则数量 3-7 条
少于 3 条覆盖不够；多于 7 条用户审不过来。每条独立可勾。**用"用户能/不能 X"句式**：
- 好：`AC2: 用户切换深色模式后文字仍清晰可见`
- 差：`AC2: getComputedStyle(el).color 应在切换主题后重新计算`（这是 unit_tests 内容）

### 5. 任务粒度 2-5 分钟
计划的 T1 / T2 / T3... 每个 2-5 分钟可执行。超过 5 分钟说明没拆细。这一点抄自 superpowers 方法论。

### 6. 涉及文件用 grep 验证（R2 + R9）
写 SKILL 前先 grep 一下文件路径 + 关键函数确实存在。**不要凭印象写路径**。R9 规则：reference memory 做关键决策前必须 grep。

### 7. 历史教训用 ⚠️ 标注
最后一段写"历史教训(必遵守)"，把这个 SKILL 解决的所有历史踩坑列出来。AI 看到这段就能避免重蹈覆辙。

### 8. 信心度（confidence）真实标注
- `high — 已成功 N 次` — 这个 SKILL 已经验证多次，模式稳
- `medium — 部分场景验证过` — 有边界情况未覆盖
- `low — 新增` — 第一次用，期待迭代

---

## 写完怎么验证 SKILL 真的被加载

1. **重启 Claude Code**（Cmd+Q 完全退出再开）
2. 开新对话，输入只含触发关键词的简短句子（比如"加日历新格式"）
3. 看 AI 第一句话是不是按 SKILL 的 Step 1 走（复述 + 探查 3 来源）

如果**没自动加载**：检查
- frontmatter 格式是否正确（`---` 必须三个连字符）
- `name` 必须 lowercase + 连字符（`^[a-z][a-z0-9-]*$`）
- `description` 不能为空
- 文件路径是 `.claude/skills/<name>/SKILL.md`（不是 `.claude/skills/<name>.md`）

---

## 命名规范

| 前缀 | 用途 | 例 |
|---|---|---|
| `add-*` | 新增功能 | add-calendar-format / add-payment-method |
| `fix-*` | 修复 bug | fix-dark-mode-text / fix-ios-back-swipe |
| `refactor-*` | 重构 | refactor-api-routes |
| `migrate-*` | 数据迁移 | migrate-user-schema |
| `parallel-*` | 并行/复合任务 | parallel-features |

---

## 与 INTEL.recipes 的关系

每个 SKILL.md 应该在 INTEL.recipes 里有一条对应的 recipe（数据源），含：
- `id` 与 SKILL 名一致
- `triggers` 关键词数组（与 SKILL description 关键词对应）
- `acceptance_criteria` 与 `unit_tests`（双字段）
- `confidence` / `estimatedTime`
- `skill_path: ".claude/skills/<id>/SKILL.md"`

**SKILL.md 是给 AI 读的人类格式，recipe 是给程序检索的结构化数据**。两者必须同步。

---

## 例子：完整 SKILL.md 参考

见 cogmap repo 的 `packages/cli/templates/`（即将加入），或仁珍千宝项目的 `.claude/skills/{add-calendar-format,add-tool-page,fix-dark-mode-text,add-i18n-keys,add-reading-cards-album,preview-audit,parallel-features}/SKILL.md`。

---

## 进一步

- [QUICKSTART.md](./QUICKSTART.md) — 5 分钟上手
- [README.md](../README.md) — 项目架构
- [Anthropic Skills 协议](https://docs.anthropic.com) — 官方 SKILL.md 规范
- [superpowers (obra)](https://github.com/obra/superpowers) — 灵感来源
