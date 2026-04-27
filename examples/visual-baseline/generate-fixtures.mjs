#!/usr/bin/env node
/**
 * 生成两张 demo PNG: baseline (纯红) + current (红 + 一个小蓝点)
 * 用于验证 compare.mjs 能正确检测视觉回退.
 *
 * 实际使用时: 用 Chrome MCP 的 screenshot 工具截真实页面.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, 'fixtures')
fs.mkdirSync(outDir, { recursive: true })

const W = 200, H = 100

function makePng(painter) {
  const png = new PNG({ width: W, height: H })
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4
      const [r, g, b, a] = painter(x, y)
      png.data[idx] = r
      png.data[idx + 1] = g
      png.data[idx + 2] = b
      png.data[idx + 3] = a
    }
  }
  return png
}

const baseline = makePng(() => [255, 0, 0, 255])
const current = makePng((x, y) => {
  const inDot = x >= 90 && x < 110 && y >= 40 && y < 60
  return inDot ? [0, 0, 255, 255] : [255, 0, 0, 255]
})

const baselinePath = path.join(outDir, 'baseline.png')
const currentPath = path.join(outDir, 'current.png')
fs.writeFileSync(baselinePath, PNG.sync.write(baseline))
fs.writeFileSync(currentPath, PNG.sync.write(current))

console.log(`fixtures generated:`)
console.log(`  ${baselinePath}  (200x100 solid red)`)
console.log(`  ${currentPath}   (200x100 red + 20x20 blue dot at center)`)
console.log(`expected diff: 400 / 20000 pixels = 2.0% (above default 1% threshold ⇒ regression detected)`)
