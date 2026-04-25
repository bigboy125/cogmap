#!/usr/bin/env bash
# CogMap Stop hook — 跑覆盖率审计 + 提示
# 注: 失败仅 warn, 不阻止对话结束

set -u

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

if [ -f "$PROJECT_DIR/scripts/audit-map-coverage.mjs" ]; then
  cd "$PROJECT_DIR" && timeout 8 node scripts/audit-map-coverage.mjs 2>&1 | tail -20 || \
    echo "[CogMap] Stop audit skipped" >&2
fi

exit 0
