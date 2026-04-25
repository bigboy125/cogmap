/**
 * cogmap init — 在指定目录铺开 templates/
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates')

function parseArgs(args) {
  const out = { force: false, apiBase: null, noGit: false }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--force') out.force = true
    else if (a === '--no-git') out.noGit = true
    else if (a === '--api-base') out.apiBase = args[++i]
  }
  return out
}

function copyDir(src, dest, replacements = {}) {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(s, d, replacements)
    } else {
      let content = fs.readFileSync(s, 'utf-8')
      for (const [k, v] of Object.entries(replacements)) {
        content = content.replaceAll(`{{${k}}}`, v)
      }
      fs.writeFileSync(d, content)
      // 保留可执行位
      try {
        const stat = fs.statSync(s)
        fs.chmodSync(d, stat.mode)
      } catch {}
    }
  }
}

export async function runInit({ dir, args = [] }) {
  const opts = parseArgs(args)
  const projectName = path.basename(path.resolve(dir))

  console.log(`\n🗺️  CogMap init → ${dir}\n`)

  fs.mkdirSync(dir, { recursive: true })

  // 安全检查: 目录非空必须 --force
  const existingFiles = fs.readdirSync(dir).filter(
    (f) => !['.git', '.DS_Store'].includes(f)
  )
  if (existingFiles.length > 0 && !opts.force) {
    console.log(`⚠️  Directory not empty (${existingFiles.length} files).`)
    console.log(`   Use --force to overwrite, or pick an empty directory.`)
    process.exit(1)
  }

  const replacements = {
    PROJECT_NAME: projectName,
    API_BASE: opts.apiBase || 'https://map-api.example.com',
    DATE: new Date().toISOString().slice(0, 10)
  }

  // 1. 拷贝 templates/
  copyDir(TEMPLATES_DIR, dir, replacements)
  console.log(`✅ templates copied`)

  // 2. 写 package.json (如果不存在)
  const pkgPath = path.join(dir, 'package.json')
  if (!fs.existsSync(pkgPath)) {
    fs.writeFileSync(
      pkgPath,
      JSON.stringify(
        {
          name: projectName,
          version: '0.0.1',
          private: true,
          type: 'module',
          scripts: {
            audit: 'node scripts/audit-map-coverage.mjs',
            validate: 'node scripts/validate-intel.mjs',
            'match-recipe': 'node scripts/match-recipe.mjs'
          },
          dependencies: {
            'cogmap-core': '^0.1.0'
          }
        },
        null,
        2
      ) + '\n'
    )
    console.log(`✅ package.json created`)
  }

  // 3. .cogmap.json (项目配置)
  const cfgPath = path.join(dir, '.cogmap.json')
  if (!fs.existsSync(cfgPath)) {
    fs.writeFileSync(
      cfgPath,
      JSON.stringify(
        {
          project_name: projectName,
          api_base: opts.apiBase || 'https://map-api.example.com',
          api_key_env: 'COGMAP_API_KEY'
        },
        null,
        2
      ) + '\n'
    )
    console.log(`✅ .cogmap.json created`)
  }

  // 4. git init
  if (!opts.noGit && !fs.existsSync(path.join(dir, '.git'))) {
    try {
      execSync('git init -q', { cwd: dir, stdio: 'ignore' })
      console.log(`✅ git initialized`)
    } catch {}
  }

  // 5. 让 hooks 可执行
  const hooksDir = path.join(dir, '.claude', 'hooks')
  if (fs.existsSync(hooksDir)) {
    for (const f of fs.readdirSync(hooksDir)) {
      if (f.endsWith('.sh')) {
        fs.chmodSync(path.join(hooksDir, f), 0o755)
      }
    }
  }

  console.log(`
🎉 CogMap initialized at ${dir}

Next steps:
  cd ${path.relative(process.cwd(), dir) || '.'}
  npm install                              # 安装 cogmap-core
  export COGMAP_API_KEY=your-key           # 配置凭据
  # 然后在 Claude Code / Cursor 打开项目, SessionStart 会自动拉 INTEL

Documentation: https://github.com/bigboy125/cogmap
`)
}
