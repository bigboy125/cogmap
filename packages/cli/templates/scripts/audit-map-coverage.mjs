#!/usr/bin/env node
/**
 * CogMap 覆盖率审计 — wrapper for cogmap-core/audit
 *
 * 用法:
 *   node scripts/audit-map-coverage.mjs
 *   node scripts/audit-map-coverage.mjs --silent
 *   node scripts/audit-map-coverage.mjs --threshold 0.95
 *
 * 退出码:
 *   0 = 覆盖率达标
 *   1 = 覆盖率未达标 (CI/Stop hook 用)
 */

import { auditCoverage } from 'cogmap-core/audit'
import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const silent = args.includes('--silent')
const idx = args.indexOf('--threshold')
const threshold = idx >= 0 ? parseFloat(args[idx + 1]) : 0.9

const memoryDir = path.join(process.cwd(), 'memory')
const result = await auditCoverage({
  memoryDir: fs.existsSync(memoryDir) ? memoryDir : null,
  threshold,
  silent
})

process.exit(result.passed ? 0 : 1)
