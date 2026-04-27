# retry-on-failure — L3 失败自修复 SKILL

> **触发**: subagent / 命令执行失败 (npm test / build / lint / git / API 调用 / etc.)
>
> **核心原则 (R14)**: **没有过去先例 → 不许 retry, 必须升级**. 模式驱动, 严禁 AI 凭空发明修复方式.

---

## 为什么这么设计

老罗 2026-04-28 立的方法论:

1. **可视化** — 每次 retry 都留痕 (`INTEL.retry_log`), 用户能审"AI 为什么这么修, 依据是什么"
2. **基于过去成功的标准** — retry 必须查过去成功的修复, 而不是按"通用规则"瞎试
3. **迭代的** — 每次新成功的修复进 INTEL, 系统越用越准

类比: 这跟人类工作方式一样. 老员工碰到问题先想"上次类似的怎么修的", 不是从零推理. CogMap 给 AI 提供同样的"经验记忆".

---

## 五步流程

### 1️⃣ 提取失败签名

从 stderr / stdout 抽:

| 字段 | 例 |
|---|---|
| `error_type` | `TypeError` / `TestFailure` / `BuildError` / `LintError` / `GitConflict` |
| `keywords` | top 5-8 高信息词 (用 cogmap-core 的 `tokenize()` 即可) |
| `raw_excerpt` | ≤200 字摘要原始错误 |

```js
import { tokenize } from 'cogmap-core/match-failure-precedent'
const sig = {
  error_type: 'TypeError',
  keywords: tokenize(errorOutput).slice(0, 8),
  raw_excerpt: errorOutput.slice(0, 200)
}
```

### 2️⃣ 查 INTEL 找先例

```js
import { matchFailurePrecedent } from 'cogmap-core/match-failure-precedent'
const match = await matchFailurePrecedent(errorOutput, { threshold: 0.15 })
```

返回值:
- `null` → **未命中先例**, 跳到第 3 步 escalate
- `{ kind, id, score, fix_pattern }` → 命中, 跳到第 4 步

`kind` 优先级: `retry_log success` (boost 1.1x) > `bug` (1.0x) > `lesson` (0.8x discount)

### 3️⃣ 决定: 套用 OR 升级

```
match 非 null  → 第 4 步, 套用 fix_pattern
match 为 null  → 必须升级到主对话/用户, 不许猜测
                 同时 logRetry({ outcome: 'escalated' }) 留痕
```

**这一步是 R14 的硬约束**. 想"我能猜个 fix"是错的 — 你猜对了下次 AI 还是要猜, 经验不会沉淀.

### 4️⃣ 套用修复 + 重跑

```js
// 把 match.fix_pattern 作为 plan 给 subagent / 自己执行
// 然后重跑失败的命令
```

**上限**: 同签名重试 ≤ **3** 次. 用 `countAttemptsForSignature(sig)` 查累计次数.

```js
import { countAttemptsForSignature } from 'cogmap-core/log-retry'
const n = await countAttemptsForSignature(sig)
if (n >= 3) /* 强制升级, 不再 retry */
```

### 5️⃣ 写入 INTEL.retry_log

无论成功失败 escalate, 都调:

```js
import { logRetry } from 'cogmap-core/log-retry'
await logRetry({
  failure_signature: sig,
  matched_precedent: match,         // null 时表 outcome=escalated
  fix_applied: '本次实际改了什么',
  outcome: 'success',                // success | failure | escalated
  attempt_n: n + 1
})
```

---

## 验收标准

- [ ] 失败处理过程必须有 `retry_log` 留痕 (R14 强制)
- [ ] match 为 null 必须升级, **不允许凭空发明**
- [ ] 同签名重试 ≥3 次 → 强制升级
- [ ] 每次成功的 retry, 修复内容应该考虑沉淀到:
  - `INTEL.bugs[id].fix_pattern` (如果是已知 bug 类型)
  - `INTEL.lessons.<topic>` (如果是新经验)
- [ ] retry_log 每条都能被人类读懂 (kind/id/fix_pattern 信息齐全)

---

## 反例 (做了就错)

| 反例 | 为什么错 | 该怎么办 |
|---|---|---|
| 看到 TypeError 直接加 `?.` 防御 | 没查 INTEL = 凭空发明 | 先 `matchFailurePrecedent` 看有没有先例 |
| 重试 5 次没升级 | 违反 ≤3 上限 | `countAttemptsForSignature` 卡阈值 |
| 修好但没写 `retry_log` | 经验流失, 下次还要踩 | 强制 `logRetry` 收尾 |
| 没命中先例就猜一个修复跑跑看 | "万一对呢"思维, R14 严禁 | 直接 `outcome: 'escalated'`, 让用户拍板 |

---

## 反馈闭环 (R20 沉淀)

每次成功修复完, AI 应该问自己:

> 这次的 fix 值得进 `bugs.fix_pattern` 还是 `lessons.<topic>` 吗?
>
> - 是已知 bug 的"标准修法" → 进 `bugs[id].fix_pattern`
> - 是新经验, 跨多个 bug 都适用 → 进 `lessons.<topic>`
> - 是一次性 hack, 下次不太可能复现 → 留在 `retry_log` 即可, 不上沉淀

把"是否沉淀"作为最后一步的明确决定, 不要默认丢. 也不要无脑全沉淀.

---

## 相关 INTEL 字段

- `rules` 里的 R14
- `retry_log` (顶层数组, 全部 retry 历史)
- `bugs[id].fix_pattern` (可复用的修复模板)
- `lessons.<topic>` (一般性经验)

## 相关 cogmap-core API

```js
import {
  tokenize,
  jaccard,
  matchFailurePrecedent,
  logRetry,
  countAttemptsForSignature
} from 'cogmap-core'
```
