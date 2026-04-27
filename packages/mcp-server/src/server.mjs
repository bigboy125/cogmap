#!/usr/bin/env node
/**
 * CogMap MCP Server — 最小手写实现 (stdio JSON-RPC 2.0)
 *
 * 不依赖 @modelcontextprotocol/sdk, 协议本质是 JSON-RPC over stdio
 * 每行一个 JSON 消息.
 *
 * 用法 (Claude Code):
 *   claude mcp add cogmap -s user node /path/to/cogmap-mcp/src/server.mjs
 *   重启 Claude Code 后, 工具列表里多出 cogmap_* 一组
 *
 * 用法 (Cursor / Continue / Cline / Zed):
 *   编辑该工具的 MCP servers 配置, 加入:
 *   { "command": "node", "args": ["/path/to/cogmap-mcp/src/server.mjs"] }
 *
 * 配置:
 *   - COGMAP_API_BASE 环境变量, 或 cwd 的 .cogmap.json 的 api_base
 *   - 默认指向 file://./INTEL.json (本地模式)
 */

import readline from 'node:readline'
import {
  getIntel,
  putIntel,
  patchRoadmap,
  searchByTask,
  matchRecipe,
  checkBugHistory,
  isFileMode,
  getApiBase,
  searchLessonsByTags
} from 'cogmap-core'

const PROTOCOL_VERSION = '2024-11-05'
const SERVER_INFO = {
  name: 'cogmap-mcp',
  version: '0.1.1'
}

// ============ Tool 定义 ============
const TOOLS = [
  {
    name: 'cogmap_get_intel',
    description:
      '读 CogMap INTEL 数据 (项目记忆数据库). 可选 path 参数取子字段, 如 "session_handoff" / "rules" / "lessons.X". 不传 path 返回完整对象.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '点分隔字段路径,如 "session_handoff.user_voice" / "rules" / "bugs.X.types". 不传返回完整 INTEL.'
        }
      }
    }
  },
  {
    name: 'cogmap_search_by_task',
    description:
      '按关键词检索 INTEL 相关切片 (rules / lessons / bugs / recipes). 比 get_intel 更省 token, 只返回相关节点. 在 file:// 模式下做客户端 OR 检索. 可选 slim/limit/fields 进一步压缩 token.',
    inputSchema: {
      type: 'object',
      required: ['query'],
      properties: {
        query: { type: 'string', description: '检索关键词,例如 "日历" / "深色模式" / "iOS"' },
        slim: { type: 'boolean', description: 'recipe 只返回头部决策字段 (id/scenario/triggers/confidence/skill_path), 省 token. 默认 false.' },
        limit: { type: 'integer', description: '每个类别最多返回几条. 默认无上限.', minimum: 1 },
        fields: {
          type: 'array',
          items: { type: 'string', enum: ['rules', 'lessons', 'bugs', 'recipes'] },
          description: '只返回这些类别. 默认全部.'
        }
      }
    }
  },
  {
    name: 'cogmap_check_bug_history',
    description: '历史 bug 全文检索. 返回所有命中关键词的 bug 节点 + 教训. 写代码前查这个能避免重蹈覆辙.',
    inputSchema: {
      type: 'object',
      required: ['keywords'],
      properties: {
        keywords: {
          type: 'array',
          items: { type: 'string' },
          description: '关键词数组, OR 关系'
        }
      }
    }
  },
  {
    name: 'cogmap_match_recipe',
    description:
      '按需求关键词匹配最合适的 SKILL/recipe. 命中后告诉 AI 应该按 .claude/skills/<id>/SKILL.md 五步流程做.',
    inputSchema: {
      type: 'object',
      required: ['request'],
      properties: {
        request: { type: 'string', description: '需求描述, 如 "加日历新格式"' }
      }
    }
  },
  {
    name: 'cogmap_put_intel',
    description:
      '写 INTEL (UPSERT 整对象). 慎用 — 通常用 patch 类工具. 仅在大批量更新或 schema 升级时用. file:// 模式不需要 token, HTTPS 模式需要 COGMAP_API_KEY.',
    inputSchema: {
      type: 'object',
      required: ['intel'],
      properties: {
        intel: { type: 'object', description: '完整的 INTEL 对象' }
      }
    }
  },
  {
    name: 'cogmap_patch_roadmap',
    description: '局部更新 roadmap 项 (按 id). 比 put_intel 安全, 不覆盖其他字段.',
    inputSchema: {
      type: 'object',
      required: ['id', 'updates'],
      properties: {
        id: { type: 'string', description: 'roadmap.id, 如 "P3" / "L1"' },
        updates: { type: 'object', description: '部分字段, 如 { "status": "done", "completed_at": "2026-04-27" }' }
      }
    }
  },
  {
    name: 'cogmap_info',
    description: '查询当前 CogMap 配置 (api_base / mode / version).',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'cogmap_search_lessons_by_tags',
    description:
      '(Q4) 跨 topic 按 tag 检索 lessons. 返回所有命中至少一个 tag (默认 OR) 或全部 tags (requireAll=true) 的 lesson 项. 比 search_by_task 关键词更精准 — 用于"查所有 security 类教训"这种维度查询.',
    inputSchema: {
      type: 'object',
      required: ['tags'],
      properties: {
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: '语义标签数组, 如 ["security","release"]'
        },
        requireAll: {
          type: 'boolean',
          description: '默认 false (OR). true 改成 AND, lesson 必须含全部 tags 才命中.'
        },
        limit: { type: 'integer', minimum: 1, description: '最多返回几条' }
      }
    }
  }
]

// ============ Tool 实现 ============
async function callTool(name, args) {
  switch (name) {
    case 'cogmap_get_intel':
      return await getIntel(args.path || null)
    case 'cogmap_search_by_task': {
      const { query, slim, limit, fields } = args
      return await searchByTask(query, { slim, limit, fields })
    }
    case 'cogmap_check_bug_history':
      return await checkBugHistory(...(args.keywords || []))
    case 'cogmap_match_recipe':
      return (await matchRecipe(args.request)) || { error: 'no recipe matched' }
    case 'cogmap_put_intel':
      return await putIntel(args.intel)
    case 'cogmap_patch_roadmap':
      return await patchRoadmap(args.id, args.updates)
    case 'cogmap_info': {
      const base = getApiBase()
      return {
        api_base: base,
        mode: isFileMode(base) ? 'file' : 'https',
        server: SERVER_INFO,
        protocol: PROTOCOL_VERSION
      }
    }
    case 'cogmap_search_lessons_by_tags': {
      const intel = await getIntel()
      const { tags = [], requireAll = false, limit } = args
      return searchLessonsByTags(intel, tags, { requireAll, limit })
    }
    default:
      throw new Error(`unknown tool: ${name}`)
  }
}

// ============ JSON-RPC 处理 ============
function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n')
}

function sendResult(id, result) {
  send({ jsonrpc: '2.0', id, result })
}

function sendError(id, code, message, data) {
  send({ jsonrpc: '2.0', id, error: { code, message, ...(data ? { data } : {}) } })
}

async function handleMessage(msg) {
  const { id, method, params } = msg

  try {
    switch (method) {
      case 'initialize':
        return sendResult(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO
        })

      case 'notifications/initialized':
        // 客户端通知, 无需响应
        return

      case 'tools/list':
        return sendResult(id, { tools: TOOLS })

      case 'tools/call': {
        const { name, arguments: args = {} } = params || {}
        try {
          const result = await callTool(name, args)
          return sendResult(id, {
            content: [
              { type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }
            ]
          })
        } catch (e) {
          return sendResult(id, {
            content: [{ type: 'text', text: `Error: ${e.message}` }],
            isError: true
          })
        }
      }

      case 'ping':
        return sendResult(id, {})

      default:
        return sendError(id, -32601, `Method not found: ${method}`)
    }
  } catch (e) {
    return sendError(id, -32603, `Internal error: ${e.message}`)
  }
}

// ============ 主循环 ============
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
})

rl.on('line', async (line) => {
  if (!line.trim()) return
  let msg
  try {
    msg = JSON.parse(line)
  } catch (e) {
    sendError(null, -32700, `Parse error: ${e.message}`)
    return
  }
  // 不响应 notification (无 id 字段)
  if (msg.id === undefined && !msg.method?.startsWith('notifications/')) {
    return
  }
  await handleMessage(msg)
})

rl.on('close', () => process.exit(0))

// stderr 日志 (不污染 stdout JSON-RPC 流)
process.stderr.write(
  `[cogmap-mcp v${SERVER_INFO.version}] ready, api_base=${getApiBase()}, mode=${isFileMode(getApiBase()) ? 'file' : 'https'}\n`
)
