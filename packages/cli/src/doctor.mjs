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

  // 5. COGMAP_API_KEY 环境
  if (process.env.COGMAP_API_KEY) {
    checks.push({ ok: true, msg: `COGMAP_API_KEY env: set (${process.env.COGMAP_API_KEY.slice(0, 4)}…)` })
  } else {
    checks.push({ ok: false, msg: `COGMAP_API_KEY env not set (writes will fail)` })
  }

  // 6. INTEL 端点连通性
  let cfg = null
  try {
    cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'))
  } catch {}
  if (cfg?.api_base) {
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

  console.log('\nCogMap doctor:')
  for (const c of checks) {
    console.log(`  ${c.ok ? '✅' : '❌'} ${c.msg}`)
  }
  const allOk = checks.every((c) => c.ok)
  console.log(allOk ? '\n✅ All good\n' : '\n⚠️  Some checks failed\n')
  process.exit(allOk ? 0 : 1)
}
