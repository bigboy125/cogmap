/**
 * cogmap doctor — 诊断当前项目 CogMap 配置
 */

import fs from 'node:fs'
import path from 'node:path'

export async function runDoctor() {
  const cwd = process.cwd()
  const checks = []

  // 1. .cogmap.json
  const cfgPath = path.join(cwd, '.cogmap.json')
  if (fs.existsSync(cfgPath)) {
    try {
      const c = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'))
      checks.push({ ok: !!c.api_base, msg: `.cogmap.json api_base = ${c.api_base || 'MISSING'}` })
    } catch (e) {
      checks.push({ ok: false, msg: `.cogmap.json invalid JSON: ${e.message}` })
    }
  } else {
    checks.push({ ok: false, msg: `.cogmap.json not found (run cogmap init?)` })
  }

  // 2. .claude/settings.json
  const settingsPath = path.join(cwd, '.claude', 'settings.json')
  if (fs.existsSync(settingsPath)) {
    try {
      const s = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
      const hasStart = !!s.hooks?.SessionStart
      const hasEnd = !!s.hooks?.Stop
      checks.push({ ok: hasStart, msg: `SessionStart hook: ${hasStart ? '✓' : 'missing'}` })
      checks.push({ ok: hasEnd, msg: `Stop hook: ${hasEnd ? '✓' : 'missing'}` })
    } catch (e) {
      checks.push({ ok: false, msg: `settings.json invalid: ${e.message}` })
    }
  } else {
    checks.push({ ok: false, msg: `.claude/settings.json not found` })
  }

  // 3. .claude/skills/
  const skillsDir = path.join(cwd, '.claude', 'skills')
  if (fs.existsSync(skillsDir)) {
    const skills = fs
      .readdirSync(skillsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .filter((d) => fs.existsSync(path.join(skillsDir, d.name, 'SKILL.md')))
    checks.push({ ok: true, msg: `.claude/skills/: ${skills.length} skill(s) found` })
  } else {
    checks.push({ ok: false, msg: `.claude/skills/ not found` })
  }

  // 4. scripts/
  const scriptsDir = path.join(cwd, 'scripts')
  const expectedScripts = [
    'audit-map-coverage.mjs',
    'validate-intel.mjs',
    'match-recipe.mjs',
    'check-bug-history.mjs',
    'sync-intel-to-claude-md.mjs'
  ]
  if (fs.existsSync(scriptsDir)) {
    const present = expectedScripts.filter((s) => fs.existsSync(path.join(scriptsDir, s)))
    const missing = expectedScripts.filter((s) => !fs.existsSync(path.join(scriptsDir, s)))
    checks.push({
      ok: missing.length === 0,
      msg: `scripts/: ${present.length}/${expectedScripts.length} expected scripts; missing: ${missing.join(', ') || 'none'}`
    })
  } else {
    checks.push({ ok: false, msg: `scripts/ not found` })
  }

  // 5. COGMAP_API_KEY 环境 (file:// 模式不需要)
  let cfgFileMode = false
  try {
    const c = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'))
    cfgFileMode = c.api_base?.startsWith('file://') || c.api_base?.startsWith('./') || c.api_base?.startsWith('/')
  } catch {}
  if (cfgFileMode) {
    checks.push({ ok: true, msg: `COGMAP_API_KEY: not needed (file:// mode)` })
  } else if (process.env.COGMAP_API_KEY) {
    checks.push({ ok: true, msg: `COGMAP_API_KEY env: set (${process.env.COGMAP_API_KEY.slice(0, 4)}…)` })
  } else {
    checks.push({ ok: false, msg: `COGMAP_API_KEY env not set (writes will fail in HTTPS mode)` })
  }

  // 6. .claude/worktrees/ 检查(Claude Code v2.1.49+ 原生 worktree)
  const worktreesDir = path.join(cwd, '.claude', 'worktrees')
  if (fs.existsSync(worktreesDir)) {
    const wts = fs.readdirSync(worktreesDir, { withFileTypes: true }).filter((d) => d.isDirectory())
    if (wts.length === 0) {
      checks.push({ ok: true, msg: `.claude/worktrees/: empty (clean)` })
    } else {
      const names = wts.map((d) => d.name).join(', ')
      // 提示但不算失败 — worktree 是工作中的状态, 残留 ≤3 个 OK
      checks.push({
        ok: wts.length <= 3,
        msg: `.claude/worktrees/: ${wts.length} active worktree(s): ${names}${wts.length > 3 ? ' ⚠️ 建议清理 (git worktree remove)' : ''}`
      })
    }
  } else {
    checks.push({ ok: true, msg: `.claude/worktrees/: not yet created (will be on first \`claude -w <name>\`)` })
  }

  // 7. .gitignore 含 .claude/worktrees/ 模式(R13)
  const gitignorePath = path.join(cwd, '.gitignore')
  if (fs.existsSync(gitignorePath)) {
    const gi = fs.readFileSync(gitignorePath, 'utf-8')
    const hasWorktreeIgnore = /^\s*\.claude\/worktrees\/?\s*$/m.test(gi) ||
                              /^\s*\.claude\/worktrees\/\*\*?\s*$/m.test(gi)
    checks.push({
      ok: hasWorktreeIgnore,
      msg: `.gitignore .claude/worktrees/ rule: ${hasWorktreeIgnore ? '✓' : 'missing (R13: 防 worktree 入主 repo)'}`
    })
  }

  // 8. INTEL 端点连通性 (HTTPS 或 file)
  let cfg = null
  try {
    cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'))
  } catch {}
  if (cfg?.api_base) {
    const isFile = cfg.api_base.startsWith('file://') || cfg.api_base.startsWith('./') || cfg.api_base.startsWith('/')
    if (isFile) {
      // file:// 模式 — 验证文件存在
      const filePath = cfg.api_base.replace(/^file:\/\//, '')
      const absPath = filePath.startsWith('/') ? filePath : path.resolve(cwd, filePath)
      if (fs.existsSync(absPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(absPath, 'utf-8'))
          checks.push({
            ok: true,
            msg: `INTEL file ${absPath}: ok (rules=${(data.rules || []).length}, recipes=${(data.recipes || []).length})`
          })
        } catch (e) {
          checks.push({ ok: false, msg: `INTEL file ${absPath}: invalid JSON: ${e.message}` })
        }
      } else {
        checks.push({ ok: false, msg: `INTEL file ${absPath}: not found (run cogmap init first)` })
      }
    } else {
      // HTTPS 模式
      try {
        const r = await fetch(`${cfg.api_base}/api/intel`)
        if (r.ok) {
          const data = await r.json()
          checks.push({
            ok: true,
            msg: `INTEL ${cfg.api_base}: GET ok (rules=${(data.rules || []).length}, recipes=${(data.recipes || []).length})`
          })
        } else {
          checks.push({ ok: false, msg: `INTEL ${cfg.api_base}: HTTP ${r.status}` })
        }
      } catch (e) {
        checks.push({ ok: false, msg: `INTEL ${cfg.api_base}: ${e.message}` })
      }
    }
  }

  console.log('\nCogMap doctor:')
  for (const c of checks) {
    console.log(`  ${c.ok ? '✅' : '❌'} ${c.msg}`)
  }
  const allOk = checks.every((c) => c.ok)
  console.log(allOk ? '\n✅ All good\n' : '\n⚠️  Some checks failed\n')
  process.exit(allOk ? 0 : 1)
}
