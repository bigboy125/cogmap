/**
 * INTEL 结构 schema 校验
 *
 * 用法:
 *   import { validateIntel } from '@cogmap/core/validate'
 *   const result = await validateIntel()  // 拉远端 INTEL 校验
 *   const result = await validateIntel(localIntel)  // 校验本地对象
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv from 'ajv'
import { getIntel } from './map-client.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SCHEMA_PATH = path.join(__dirname, '..', 'schemas', 'intel.schema.json')

let _validator = null
function getValidator() {
  if (_validator) return _validator
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf-8'))
  const ajv = new Ajv({ allErrors: true, strict: false })
  _validator = ajv.compile(schema)
  return _validator
}

export async function validateIntel(intel = null, opts = {}) {
  const { silent = false } = opts
  const data = intel || (await getIntel())
  const log = silent ? () => {} : console.log

  log('━'.repeat(70))
  log(`CogMap INTEL 结构验证 — ${new Date().toISOString().slice(0, 10)}`)
  log('━'.repeat(70))

  const validate = getValidator()
  const valid = validate(data)

  if (valid) {
    log('✅ 通过')
    log(`   _schema_version: ${data._schema_version}`)
    log(`   rules: ${(data.rules || []).length}`)
    log(`   lessons nodes: ${Object.keys(data.lessons || {}).length}`)
    log(`   bugs nodes: ${Object.keys(data.bugs || {}).length}`)
    log(`   recipes: ${(data.recipes || []).length}`)
    log(`   roadmap items: ${(data.roadmap || []).length}`)
    return { valid: true, errors: [] }
  } else {
    log('❌ 校验失败:')
    for (const e of validate.errors || []) {
      log(`   ${e.instancePath || '/'} ${e.message} ${JSON.stringify(e.params)}`)
    }
    return { valid: false, errors: validate.errors }
  }
}
