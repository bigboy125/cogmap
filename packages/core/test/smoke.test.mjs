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
  // 强制 HTTPS 模式让 fetch mock 生效 (cwd 可能有 .cogmap.json 指向 file://)
  const origCwd = process.cwd()
  const origBase = process.env.COGMAP_API_BASE
  process.chdir('/tmp')
  process.env.COGMAP_API_BASE = 'https://test.example.com'
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({ ok: true, json: async () => mockIntel })
  try {
    // dynamic import w/ cache bust
    const { matchRecipe } = await import('../src/match-recipe.mjs?t=' + Date.now())
    const m = await matchRecipe('日历有新会议号 Webinar ID')
    assert.equal(m.id, 'add-calendar-format')
    assert.ok(m.score >= 2.3, `score should be >=2.3 (2 triggers + 0.3 high), got ${m.score}`)
    assert.equal(m.skill_path, '.claude/skills/add-calendar-format/SKILL.md')
  } finally {
    globalThis.fetch = originalFetch
    process.chdir(origCwd)
    if (origBase) process.env.COGMAP_API_BASE = origBase
    else delete process.env.COGMAP_API_BASE
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
  const origCwd = process.cwd()
  const origBase = process.env.COGMAP_API_BASE
  process.chdir('/tmp')
  process.env.COGMAP_API_BASE = 'https://test.example.com'
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => ({ ok: true, json: async () => mockIntel })
  try {
    const { checkBugHistory } = await import('../src/check-bug-history.mjs?t=' + Date.now())
    const hits = await checkBugHistory('passcode')
    assert.equal(hits.length, 1)
    assert.equal(hits[0].nodeId, 'backend-calendar')
  } finally {
    globalThis.fetch = originalFetch
    process.chdir(origCwd)
    if (origBase) process.env.COGMAP_API_BASE = origBase
    else delete process.env.COGMAP_API_BASE
  }
})

test('file:// mode getIntel reads local JSON', async () => {
  const tmpFile = `/tmp/cogmap-test-intel-${Date.now()}.json`
  fs.writeFileSync(tmpFile, JSON.stringify({
    _schema_version: 2,
    rules: [{ text: 'test rule', critical: true }],
    recipes: [{ id: 'test-recipe', triggers: ['test'] }]
  }))

  // Set api_base via env to point at this file
  const origCwd = process.cwd()
  const origBase = process.env.COGMAP_API_BASE
  process.env.COGMAP_API_BASE = `file://${tmpFile}`
  try {
    // Re-import to reset module-level cache (use ESM dynamic import)
    const url = '../src/map-client.mjs?t=' + Date.now()
    const { getIntel, isFileMode } = await import(url)
    assert.equal(isFileMode(`file://${tmpFile}`), true)
    const intel = await getIntel()
    assert.equal(intel.rules.length, 1)
    assert.equal(intel.rules[0].text, 'test rule')
  } finally {
    fs.unlinkSync(tmpFile)
    if (origBase) process.env.COGMAP_API_BASE = origBase
    else delete process.env.COGMAP_API_BASE
  }
})

test('file:// mode putIntel writes local JSON', async () => {
  const tmpFile = `/tmp/cogmap-test-put-${Date.now()}.json`
  process.env.COGMAP_API_BASE = `file://${tmpFile}`
  try {
    const url = '../src/map-client.mjs?t=' + Date.now()
    const { putIntel, getIntel } = await import(url)
    await putIntel({ _schema_version: 2, rules: [{ text: 'r1', critical: false }] })
    const back = await getIntel()
    assert.equal(back.rules[0].text, 'r1')
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
    delete process.env.COGMAP_API_BASE
  }
})

test('file:// mode searchByTask filters locally', async () => {
  const tmpFile = `/tmp/cogmap-test-search-${Date.now()}.json`
  fs.writeFileSync(tmpFile, JSON.stringify({
    _schema_version: 2,
    rules: [
      { text: 'iOS 白屏', critical: true },
      { text: 'Android 推送', critical: false }
    ],
    bugs: { 'Home.vue': { types: ['iOS scroll bug'], count: 1 } }
  }))
  process.env.COGMAP_API_BASE = `file://${tmpFile}`
  try {
    const url = '../src/map-client.mjs?t=' + Date.now()
    const { searchByTask } = await import(url)
    const r = await searchByTask('iOS')
    assert.equal(r.rules.length, 1)
    assert.equal(r.rules[0].text, 'iOS 白屏')
    assert.equal(Object.keys(r.bugs).length, 1)
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
    delete process.env.COGMAP_API_BASE
  }
})

test('Q6: searchByTask slim drops heavy recipe fields', async () => {
  const tmpFile = `/tmp/cogmap-test-slim-${Date.now()}.json`
  fs.writeFileSync(tmpFile, JSON.stringify({
    _schema_version: 2,
    rules: [],
    recipes: [{
      id: 'big-recipe',
      scenario: 's',
      triggers: ['foo'],
      confidence: 'high',
      skill_path: '.claude/skills/big/SKILL.md',
      steps: ['heavy step 1', 'heavy step 2'],
      tests: ['heavy test'],
      acceptance_criteria: ['big criterion'],
      lessons_to_obey: ['heavy lesson']
    }]
  }))
  process.env.COGMAP_API_BASE = `file://${tmpFile}`
  try {
    const url = '../src/map-client.mjs?t=' + Date.now()
    const { searchByTask } = await import(url)
    const full = await searchByTask('foo')
    const slim = await searchByTask('foo', { slim: true })
    assert.equal(full.recipes[0].steps.length, 2, 'full mode keeps steps')
    assert.equal(slim.recipes[0].steps, undefined, 'slim mode drops steps')
    assert.equal(slim.recipes[0].id, 'big-recipe', 'slim keeps id')
    assert.equal(slim.recipes[0].skill_path, '.claude/skills/big/SKILL.md', 'slim keeps skill_path')
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
    delete process.env.COGMAP_API_BASE
  }
})

test('Q6: searchByTask limit caps results per category', async () => {
  const tmpFile = `/tmp/cogmap-test-limit-${Date.now()}.json`
  fs.writeFileSync(tmpFile, JSON.stringify({
    _schema_version: 2,
    rules: [
      { text: 'foo rule 1', critical: true },
      { text: 'foo rule 2', critical: false },
      { text: 'foo rule 3', critical: false }
    ]
  }))
  process.env.COGMAP_API_BASE = `file://${tmpFile}`
  try {
    const url = '../src/map-client.mjs?t=' + Date.now()
    const { searchByTask } = await import(url)
    const r = await searchByTask('foo', { limit: 2 })
    assert.equal(r.rules.length, 2, 'limit=2 should return 2 rules')
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
    delete process.env.COGMAP_API_BASE
  }
})

test('Q6: searchByTask fields filter hides categories', async () => {
  const tmpFile = `/tmp/cogmap-test-fields-${Date.now()}.json`
  fs.writeFileSync(tmpFile, JSON.stringify({
    _schema_version: 2,
    rules: [{ text: 'foo rule', critical: true }],
    bugs: { 'X.vue': { types: ['foo bug'], count: 1 } }
  }))
  process.env.COGMAP_API_BASE = `file://${tmpFile}`
  try {
    const url = '../src/map-client.mjs?t=' + Date.now()
    const { searchByTask } = await import(url)
    const r = await searchByTask('foo', { fields: ['rules'] })
    assert.ok(Array.isArray(r.rules) && r.rules.length === 1, 'rules included')
    assert.equal(r.bugs, undefined, 'bugs excluded by fields filter')
    assert.equal(r.lessons, undefined, 'lessons excluded by fields filter')
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile)
    delete process.env.COGMAP_API_BASE
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
