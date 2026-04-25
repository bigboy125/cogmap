# @cogmap/core

CogMap 协议核心包。提供：

- **map-client** — 统一 HTTPS 客户端（getIntel / putIntel / patchRoadmap / searchByTask）
- **audit** — 经验覆盖率审计（lessons / bugs / iterations 上图比例）
- **validate** — INTEL JSON Schema 校验
- **match-recipe** — 按需求关键词匹配 SKILL/recipe
- **check-bug-history** — 历史 bug 全文检索

## 安装

```bash
npm install @cogmap/core
```

## 配置

通过环境变量或 `.cogmap.json` 指定 INTEL 端点：

```bash
# 方式 1: 环境变量
export COGMAP_API_BASE=https://your-domain.com
export COGMAP_API_KEY=your-admin-key

# 方式 2: 项目根目录 .cogmap.json
{
  "api_base": "https://your-domain.com",
  "api_key_env": "COGMAP_API_KEY",
  "api_key_file": "~/.cogmap/credentials.json"
}
```

## 用法

```js
import { getIntel, putIntel, patchRoadmap, searchByTask } from '@cogmap/core'

// 读 INTEL
const intel = await getIntel()
console.log(`rules: ${intel.rules.length}`)

// 写 INTEL（需要 COGMAP_API_KEY）
intel.rules.push({ text: '新规则', critical: true })
await putIntel(intel)

// 按任务关键词检索
const slice = await searchByTask('日历 Zoom')
console.log(slice.bugs)  // 仅 backend-calendar 节点
```

## 凭据查找优先级

1. `process.env.COGMAP_API_KEY`
2. `<project>/.cogmap-credentials.json` 的 `api_key`
3. `~/.cogmap/credentials.json` 的 `api_key`
4. 抛错

## 协议规范

完整 JSON Schema 见 [`schemas/intel.schema.json`](./schemas/intel.schema.json)。

INTEL 顶层结构：

```typescript
{
  _schema_version: 2,
  rules: Array<{ text: string, critical: boolean }>,
  lessons: Record<NodeId, Array<string>>,
  bugs: Record<NodeId, { types: Array<string>, count: number, lessons: Array<string> }>,
  iterations: Record<NodeId, Array<{ date: string, summary: string }>>,
  guide: Record<NodeId, Array<string>>,
  recipes: Array<Recipe>,
  roadmap: Array<RoadmapItem>,
  session_handoff?: SessionHandoff,
  app_meta?: AppMeta,
  timeline?: Array<TimelineEvent>
}
```

## License

MIT
