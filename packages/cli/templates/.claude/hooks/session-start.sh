#!/usr/bin/env bash
# CogMap SessionStart hook — 拉 INTEL 关键规则注入 CLAUDE.md
# 注: 失败不阻塞对话开始, 只打 warn 到 stderr

set -u

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

if [ -f "$PROJECT_DIR/scripts/sync-intel-to-claude-md.mjs" ]; then
  cd "$PROJECT_DIR" && timeout 5 node scripts/sync-intel-to-claude-md.mjs 2>&1 || \
    echo "[CogMap] SessionStart sync skipped (network/timeout)" >&2
fi

# 可选: 同步 git context (如果脚本存在)
if [ -f "$PROJECT_DIR/scripts/sync-git-context.mjs" ]; then
  cd "$PROJECT_DIR" && timeout 3 node scripts/sync-git-context.mjs 2>&1 || true
fi

exit 0
