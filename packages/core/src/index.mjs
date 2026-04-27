/**
 * cogmap-core — CogMap 协议核心包入口
 *
 * 通用导出:
 *   - map-client: getIntel / putIntel / patchRoadmap / searchByTask
 *   - get-key: 凭据查找
 *   - match-recipe: 配方匹配
 *   - check-bug-history: bug 全文检索
 *   - audit: 覆盖率审计
 *   - validate: schema 校验
 *   - match-failure-precedent: (L3) 错误文本 → 查 INTEL 命中先例
 *   - log-retry: (L3) retry 留痕到 INTEL.retry_log
 */

export {
  getIntel,
  putIntel,
  patchRoadmap,
  searchByTask,
  getApiBase,
  isFileMode
} from './map-client.mjs'

export { getApiKey, getConfig } from './get-key.mjs'

export { matchRecipe, listRecipes } from './match-recipe.mjs'

export { checkBugHistory, searchAllBugs } from './check-bug-history.mjs'

export { auditCoverage } from './audit.mjs'

export { validateIntel } from './validate.mjs'

export { matchFailurePrecedent, tokenize, jaccard } from './match-failure-precedent.mjs'

export { logRetry, countAttemptsForSignature } from './log-retry.mjs'

export { getLessonText, getLessonTags, searchLessonsByTags } from './lesson-utils.mjs'
