#!/usr/bin/env node
/**
 * create-cogmap / cogmap CLI
 *
 * 子命令:
 *   init [dir]   初始化 (默认 dir = 当前目录或参数中第一个非 flag)
 *   doctor       诊断
 *   upgrade      升级 templates
 *   version      版本
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { runInit } from './init.mjs'
import { runDoctor } from './doctor.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const pkg = JSON.parse(
  readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')
)

function printHelp() {
  console.log(`create-cogmap v${pkg.version}

Usage:
  create-cogmap [dir]              # 等价于 cogmap init [dir]
  cogmap init [dir]                # 初始化 CogMap 项目
  cogmap doctor                    # 检查环境
  cogmap upgrade                   # 升级 templates (谨慎)
  cogmap version                   # 显示版本

Options:
  --force                          # 即使目录非空也继续
  --api-base <url>                 # 设置 INTEL API 端点
  --no-git                         # 不自动 git init
  -h, --help                       # 显示帮助
`)
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('-h') || argv.includes('--help')) {
    printHelp()
    return
  }
  if (argv.length === 0) {
    // 默认 init 到当前目录
    return runInit({ dir: process.cwd(), args: argv })
  }

  const cmd = argv[0]

  // 兼容 npx create-cogmap my-project (无显式 init)
  if (!['init', 'doctor', 'upgrade', 'version'].includes(cmd)) {
    return runInit({ dir: path.resolve(process.cwd(), cmd), args: argv.slice(1) })
  }

  switch (cmd) {
    case 'init': {
      const dirArg = argv[1] && !argv[1].startsWith('-') ? argv[1] : '.'
      return runInit({ dir: path.resolve(process.cwd(), dirArg), args: argv.slice(2) })
    }
    case 'doctor':
      return runDoctor()
    case 'upgrade':
      console.log('upgrade not yet implemented')
      process.exit(1)
    case 'version':
      console.log(pkg.version)
      return
    default:
      printHelp()
      process.exit(1)
  }
}

main().catch((err) => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
