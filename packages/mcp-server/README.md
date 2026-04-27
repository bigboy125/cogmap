# cogmap-mcp

**CogMap MCP Server** — 把 INTEL 暴露成 Model Context Protocol tools，让任何支持 MCP 的 AI 工具直接使用。

## 支持的客户端

| 客户端 | 协议 | 配置位置 |
|---|---|---|
| Claude Code | MCP stdio | `claude mcp add cogmap node /path/to/server.mjs` |
| Cursor | MCP stdio | Settings → MCP servers |
| Continue | MCP stdio | `~/.continue/config.json` |
| Cline (VSCode) | MCP stdio | extension settings |
| Zed | MCP stdio | `~/.config/zed/settings.json` |
| 任意 MCP 客户端 | stdio JSON-RPC 2.0 | `command: node, args: ["/path/server.mjs"]` |

## 提供的 7 个 Tools

| Tool | 功能 |
|---|---|
| `cogmap_get_intel` | 读 INTEL 数据，可选 dot-path 取子字段 |
| `cogmap_search_by_task` | 按关键词切片返回相关 rules + lessons + bugs + recipes |
| `cogmap_check_bug_history` | 历史 bug 全文检索，写代码前查避免重蹈覆辙 |
| `cogmap_match_recipe` | 匹配最合适的 SKILL/recipe，告诉 AI 该按哪个 skill 做 |
| `cogmap_put_intel` | 写 INTEL（UPSERT 整对象，慎用） |
| `cogmap_patch_roadmap` | 局部更新 roadmap 项 |
| `cogmap_info` | 查询当前 CogMap 配置 |

## 安装

```bash
npm install -g cogmap-mcp
# 或本地装到项目: npm install --save-dev cogmap-mcp
```

## 配置

### Claude Code

```bash
claude mcp add cogmap -s user node "$(npm root -g)/cogmap-mcp/src/server.mjs"
# 重启 Claude Code, 工具列表里多出 cogmap_* 一组
```

### Cursor

Settings → MCP Servers → Add：

```json
{
  "cogmap": {
    "command": "node",
    "args": ["/usr/local/lib/node_modules/cogmap-mcp/src/server.mjs"],
    "env": {
      "COGMAP_API_BASE": "file://./INTEL.json"
    }
  }
}
```

### Continue (`~/.continue/config.json`)

```json
{
  "mcpServers": {
    "cogmap": {
      "command": "node",
      "args": ["/usr/local/lib/node_modules/cogmap-mcp/src/server.mjs"]
    }
  }
}
```

## INTEL 后端配置

通过环境变量或 `cwd` 的 `.cogmap.json`：

| 模式 | 配置 | 用途 |
|---|---|---|
| file:// | `COGMAP_API_BASE=file://./INTEL.json` | 个人 / 离线 / 起步 |
| HTTPS | `COGMAP_API_BASE=https://your-server.com` + `COGMAP_API_KEY=...` | 团队 / 多设备 |

## 调试

stderr 会打印一行启动日志，但 stdout 严格按 JSON-RPC 2.0 走（**不要往 stdout 打 console.log**，会破坏协议）。

手动测试（stdio 协议）：

```bash
# 启动
node src/server.mjs

# 然后粘贴 (回车):
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"cogmap_info","arguments":{}}}
```

## 协议细节

- 标准 [Model Context Protocol](https://modelcontextprotocol.io) v2024-11-05
- 实现 `initialize` / `tools/list` / `tools/call` / `ping` / `notifications/initialized`
- 不实现 `prompts` / `resources` / `sampling`（CogMap 不需要这些）
- stderr 日志，stdout JSON-RPC

## License

MIT
