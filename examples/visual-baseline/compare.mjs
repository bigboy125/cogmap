#!/usr/bin/env node
/**
 * CogMap 视觉 baseline diff — 对比两张 PNG 截图, 输出差异统计 + 差异图
 *
 * 用法:
 *   node compare.mjs <baseline.png> <current.png> [diff.png] [--threshold 0.01]
 *
 * 退出码:
 *   0 — 差异比例 ≤ threshold (UI 未回退)
 *   1 — 差异比例 > threshold (UI 回退, 需人审)
 *   2 — 输入错误 (尺寸不一致 / 文件不存在)
 *
 * 典型集成 (.claude/skills/preview-audit/SKILL.md):
 *   1. 修改 UI 前: chrome MCP 截图 → fixtures/baseline.png
 *   2. 修改后: 截同一个页面 → fixtures/current.png
 *   3. node compare.mjs fixtures/baseline.png fixtures/current.png diff.png
 *   4. 退出码非 0 ⇒ 人审 diff.png 决定是否接受
 */

import fs from 'node:fs'
import process from 'node:process'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

function parseArgs(argv) {
  const args = { positional: [], threshold: 0.01 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--threshold') {
      args.threshold = parseFloat(argv[++i])
    } else {
      args.positional.push(a)
    }
  }
  return args
}

function loadPng(p) {
  if (!fs.existsSync(p)) {
    console.error(`× file not found: ${p}`)
    process.exit(2)
  }
  return PNG.sync.read(fs.readFileSync(p))
}

const { positional, threshold } = parseArgs(process.argv.slice(2))
const [baselinePath, currentPath, diffPath = 'diff.png'] = positional

if (!baselinePath || !currentPath) {
  console.error('usage: node compare.mjs <baseline.png> <current.png> [diff.png] [--threshold 0.01]')
  process.exit(2)
}

const baseline = loadPng(baselinePath)
const current = loadPng(currentPath)

if (baseline.width !== current.width || baseline.height !== current.height) {
  console.error(`× size mismatch: baseline ${baseline.width}x${baseline.height} vs current ${current.width}x${current.height}`)
  process.exit(2)
}

const { width, height } = baseline
const diff = new PNG({ width, height })
const numDiffPixels = pixelmatch(baseline.data, current.data, diff.data, width, height, {
  threshold: 0.1,
  alpha: 0.4,
  diffColor: [255, 0, 0]
})

fs.writeFileSync(diffPath, PNG.sync.write(diff))

const totalPixels = width * height
const ratio = numDiffPixels / totalPixels
const pct = (ratio * 100).toFixed(3)

console.log(`baseline: ${baselinePath} (${width}x${height})`)
console.log(`current : ${currentPath}`)
console.log(`diff    : ${diffPath} — ${numDiffPixels}/${totalPixels} pixels (${pct}%)`)
console.log(`threshold: ${(threshold * 100).toFixed(3)}%`)

if (ratio > threshold) {
  console.error(`✗ regression detected (${pct}% > ${(threshold * 100).toFixed(3)}%)`)
  process.exit(1)
}
console.log(`✓ within tolerance`)
process.exit(0)
