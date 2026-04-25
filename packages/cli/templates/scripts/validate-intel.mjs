#!/usr/bin/env node
/**
 * INTEL 结构 schema 校验 — wrapper for cogmap-core/validate
 */

import { validateIntel } from 'cogmap-core/validate'

const result = await validateIntel()
process.exit(result.valid ? 0 : 1)
