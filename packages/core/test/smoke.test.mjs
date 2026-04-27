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

test('Q2 L3: matchFailurePrecedent hits bug with fix_pattern', async () => {
  const { matchFailurePrecedent } = await import('../src/match-failure-precedent.mjs')
  const intel = {
    bugs: {
      'gitignore-no-anchor': {
        types: ['顶层 .gitignore 写 CLAUDE.md 没有 / 前缀, 全局匹配屏蔽 templates/CLAUDE.md'],
        count: 1,
        fix_pattern: '把 CLAUDE.md 改成 /CLAUDE.md, 用 / 前缀 anchor 到仓库根',
        lessons: ['.gitignore 想只匹配仓库根的文件, 必须用 / 前缀']
      },
      'unrelated-bug': {
        types: ['something completely different about hero parallax'],
        count: 1
      }
    }
  }
  const m = await matchFailurePrecedent(
    'gitignore CLAUDE.md 没有 anchor 把 templates 也屏蔽了 模板进不了 repo',
    { intel, threshold: 0.1 }
  )
  assert.ok(m, 'should hit a precedent')
  assert.equal(m.kind, 'bug')
  assert.equal(m.id, 'gitignore-no-anchor')
  assert.ok(m.fix_pattern.includes('/ 前缀'), `fix_pattern should mention prefix anchor: ${m.fix_pattern}`)
})

test('Q2 L3: matchFailurePrecedent prefers retry_log success over lesson', async () => {
  const { matchFailurePrecedent } = await import('../src/match-failure-precedent.mjs')
  const intel = {
    bugs: {},
    retry_log: [
      {
        ts: '2026-04-28T10:00:00Z',
        outcome: 'success',
        failure_signature: {
          error_type: 'TestFailure',
          keywords: ['snapshot', 'mismatch', 'redux']
        },
        fix_applied: '更新 snapshot: npm test -- -u'
      }
    ],
    lessons: {
      'general-testing': ['snapshot mismatch 可能是预期行为, 也可能是回归, 看 diff']
    }
  }
  const m = await matchFailurePrecedent('TestFailure snapshot mismatch redux store', {
    intel,
    threshold: 0.1
  })
  assert.ok(m, 'should match')
  assert.equal(m.kind, 'retry_log', 'retry_log success should outrank lesson (1.1x boost vs 0.8x discount)')
  assert.ok(m.fix_pattern.includes('snapshot'), m.fix_pattern)
})

test('Q2 L3: matchFailurePrecedent returns null on novel error', async () => {
  const { matchFailurePrecedent } = await import('../src/match-failure-precedent.mjs')
  const intel = {
    bugs: { 'a': { types: ['完全不相关的 bug'], count: 1 } },
    lessons: { 'random': ['totally unrelated wisdom'] }
  }
  const m = await matchFailurePrecedent(
    'TypeError Cannot read properties of undefined reading foo bar baz',
    { intel, threshold: 0.15 }
  )
  assert.equal(m, null, 'novel error should return null → R14 要求升级, 不许凭空发明')
})

test('Q2 L3: logRetry appends to INTEL.retry_log + countAttemptsForSignature', async () => {
  const { logRetry, countAttemptsForSignature } = await import('../src/log-retry.mjs')
  const intel = {}

  const sig = { error_type: 'BuildError', keywords: ['typescript', 'tsx', 'jsx'] }

  await logRetry({
    failure_signature: sig,
    matched_precedent: { kind: 'bug', id: 'tsx-jsx-config', fix_pattern: '改 tsconfig jsx=react' },
    fix_applied: '改 tsconfig jsx 设置',
    outcome: 'success',
    attempt_n: 1
  }, { intel })

  await logRetry({
    failure_signature: { error_type: 'BuildError', keywords: ['typescript', 'tsx', 'jsx'] },
    fix_applied: '清 cache',
    outcome: 'failure',
    attempt_n: 2
  }, { intel })

  await logRetry({
    failure_signature: { error_type: 'TestFailure', keywords: ['snapshot'] },
    outcome: 'escalated',
    attempt_n: 1
  }, { intel })

  assert.equal(intel.retry_log.length, 3, '3 entries logged')
  assert.equal(intel.retry_log[0].outcome, 'success')
  assert.ok(intel.retry_log[0].ts, 'ts auto-filled')

  // count attempts for "BuildError + tsx/jsx" 应该是 2 (前两条同签名)
  const count = await countAttemptsForSignature(sig, { intel })
  assert.equal(count, 2, 'BuildError tsx/jsx 应累计 2 次')

  // 不同签名应该是 1
  const count2 = await countAttemptsForSignature(
    { error_type: 'TestFailure', keywords: ['snapshot'] },
    { intel }
  )
  assert.equal(count2, 1)
})

test('Q2 L3: logRetry throws on missing required fields', async () => {
  const { logRetry } = await import('../src/log-retry.mjs')
  await assert.rejects(
    () => logRetry({ outcome: 'success' }, { intel: {} }),
    /failure_signature 必填/
  )
  await assert.rejects(
    () => logRetry({ failure_signature: { error_type: 'X' } }, { intel: {} }),
    /outcome 必须是/
  )
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
