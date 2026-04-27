# 视觉 baseline diff 示例

> CogMap 路线图 Q3 / L5 — 防 UI 回退的截图基线对比配方.

`pixelmatch + pngjs` 实现, 兼容 Chrome MCP / Playwright / 任何能产 PNG 的截图工具.

## 5 分钟试一下

```bash
cd examples/visual-baseline
npm install
npm run demo
```

`npm run demo` 会:

1. 生成两张 fixture PNG (baseline.png 纯红 / current.png 红色加 20×20 蓝点)
2. 跑 compare.mjs 对比, 输出 diff.png + 差异统计

预期: 退出码 1, 因为 2.0% 像素差超过默认 1% 阈值. 这就是"检测到 UI 回退".

## 配方 (典型 SKILL.md 集成)

`.claude/skills/preview-audit/SKILL.md` 里的几行:

```markdown
## 验收: 视觉无回退

1. 修改前用 Chrome MCP 截 baseline:
   `mcp__claude-in-chrome__screenshot` → 保存为 `fixtures/baseline.png`

2. 修改 + 验证后, 同一 URL 同样视口截 current:
   `mcp__claude-in-chrome__screenshot` → `fixtures/current.png`

3. 跑对比:
   `node examples/visual-baseline/compare.mjs fixtures/baseline.png fixtures/current.png .audit/diff.png`

4. 退出码非 0 ⇒ 人审 `.audit/diff.png` (红色像素 = 变化).
   接受变化: 用 current 覆盖 baseline. 拒绝: 修代码.
```

## API

```bash
node compare.mjs <baseline.png> <current.png> [diff.png] [--threshold 0.01]
```

| 参数 | 默认 | 说明 |
|---|---|---|
| baseline.png | (必填) | 修改前的截图 |
| current.png | (必填) | 修改后的截图 |
| diff.png | `diff.png` | 差异图输出路径 (红色高亮变化) |
| --threshold | `0.01` (1%) | 差异比例上限. 超过即认为回退 (退出码 1) |

退出码:

| 码 | 含义 |
|---|---|
| 0 | 差异 ≤ threshold, UI 未回退 |
| 1 | 差异 > threshold, UI 有回退, 需人审 |
| 2 | 输入错误 (文件不存在 / 尺寸不匹配) |

## 为什么不内置进 cogmap-core

视觉 diff 依赖 pixelmatch + pngjs (~50KB), 不是所有项目都做 UI. 做成可选 example, 用户按需 npm install.

## 局限

- **像素级**, 反锯齿差异会被识别为 diff. 对动态内容 (时间戳 / 动画帧) 需 mask 区域 — 可在截图前用 CSS 把这些元素隐藏 / 替换占位符.
- **截图必须同尺寸**, 视口需固定. Chrome MCP 用 `resize_window` 固定后再截.
- **真实浏览器渲染存在小波动** (字体亚像素 / GPU 抗锯齿), 默认 threshold=1% 是经验值, 跨平台跑 CI 可能要调到 2-3%.

## 进阶思路

- 多分辨率 baseline (mobile / tablet / desktop 三套, 一处改动跑三对比)
- mask 区域 (用一张 mask.png 把动态区域涂黑, pixelmatch 支持 ignore mask)
- 集成到 GitHub Actions: PR 自动跑 baseline diff, diff.png 作为 artifact 上传
