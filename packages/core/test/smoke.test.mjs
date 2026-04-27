/**
 * @cogmap/core smoke tests — 不依赖网络的纯函数验证
 *
 * 用 node --test 跑(Node 18+ 内置 test runner)
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv from 'ajv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCHEMA_PATH = path.join(__dirname, '..', 'schemas', 'intel.schema.json')

function makeValidator() {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf-8'))
  const ajv = new Ajv({ allErrors: true, strict: false })
  return ajv.compile(schema)
}

test('schema file exists and is valid JSON', () => {
  assert.ok(fs.existsSync(SCHEMA_PATH), 'intel.schema.json should exist')
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf-8'))
  assert.equal(schema.$schema, 'http://json-schema.org/draft-07/schema#')
  assert.equal(schema.title, 'CogMap INTEL')
  assert.ok(schema.required.includes('_schema_version'))
  assert.ok(schema.required.includes('rules'))
})

test('schema accepts iterations as object (v0.1.1 fix)', () => {
  const validate = makeValidator()
  const sample = {
    _schema_version: 2,
    rules: [{ text: 'r1', critical: true }],
    iterations: {
      'Chat.vue': { lastEdit: '2026-04', summary: 'fixed bug' },
      'Home.vue': [{ date: '2026-04', summary: 'redesign', version: 'v0.1' }]
    }
  }
  const ok = validate(sample)
  assert.equal(ok, true, `Validation should pass; errors: ${JSON.stringify(validate.errors)}`)
})

test('schema rejects invalid roadmap id', () => {
  const validate = makeValidator()
  const sample = {
    _schema_version: 2,
    rules: [{ text: 'r', critical: true }],
    roadmap: [{ id: 'bad-id', title: 'x', status: 'done' }]
  }
  assert.equal(validate(sample), false, 'Should reject bad roadmap.id')
  assert.ok(
    (validate.errors || []).some((e) => e.instancePath.includes('roadmap')),
    'Error should mention roadmap'
  )
})

test('schema accepts valid roadmap items', () => {
  const validate = makeValidator()
  const sample = {
    _schema_version: 2,
    rules: [{ text: 'r', critical: true }],
    roadmap: [
      { id: 'P1', title: 'Phase 0', status: 'done', priority: 'p0' },
      { id: 'L1', title: 'L1 Agent', status: 'in_progress' }
    ]
  }
  assert.equal(validate(sample), true, JSON.stringify(validate.errors))
})

test('match-recipe scoring: triggers + confidence weighting', async () => {
  const mockIntel = {
    rules: [],
    recipes: [
      { id: 'add-calendar-format', triggers: ['日历', 'Zoom', 'Webinar'], confidence: 'high — 已成功 2 次' },
      { id: 'fix-dark-mode-text', triggers: ['深色', 'dark mode'], confidence: 'high' },
      { id: 'preview-audit', triggers: ['巡检', 'E2E'], confidence: 'low — 新增' }
    ]
  }
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({ ok: true, json: async () => mockIntel })
  try {
    const { matchRecipe } = await import('../src/match-recipe.mjs')
    const m = await matchRecipe('日历有新会议号 Webinar ID')
    assert.equal(m.id, 'add-calendar-format')
    assert.ok(m.score >= 2.3, `score should be >=2.3 (2 triggers + 0.3 high), got ${m.score}`)
    assert.equal(m.skill_path, '.claude/skills/add-calendar-format/SKILL.md')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('check-bug-history matches keyword across nodes', async () => {
  const mockIntel = {
    rules: [],
    bugs: {
      'backend-calendar': {
        types: ['Passcode 关键字未识别'],
        count: 3,
        lessons: ['必须 admin/calendar/sync']
      },
      'Home.vue': {
        types: ['hero 视差 KeepAlive'],
        count: 1,
        lessons: []
      }
    }
  }
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({ ok: true, json: async () => mockIntel })
  try {
    const { checkBugHistory } = await import('../src/check-bug-history.mjs')
    const hits = await checkBugHistory('passcode')
    assert.equal(hits.length, 1)
    assert.equal(hits[0].nodeId, 'backend-calendar')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('get-key throws if no source found', async () => {
  const orig = process.env.COGMAP_API_KEY
  delete process.env.COGMAP_API_KEY
  const oldCwd = process.cwd()
  process.chdir('/tmp')
  try {
    const { getApiKey } = await import('../src/get-key.mjs')
    assert.throws(() => getApiKey(), /COGMAP_API_KEY not found/)
  } finally {
    process.chdir(oldCwd)
    if (orig) process.env.COGMAP_API_KEY = orig
  }
})
