#!/usr/bin/env bash
# clean-my-mac: cleanup_toolchains.sh
# Phase 2c — Version managers and language-tool stores that grow without notice:
# mise (old tool versions), pnpm (unreferenced packages, old store versions), uv.
# Usage: bash cleanup_toolchains.sh [--dry-run]

set -euo pipefail

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RESET='\033[0m'
LOG_FILE=~/clean-my-mac-log-$(date +%Y-%m-%d).txt
log() { echo "$1" | tee -a "$LOG_FILE"; }
size_of() { [[ -e "$1" ]] && du -sh "$1" 2>/dev/null | cut -f1 || echo "0B"; }

echo ""
echo -e "${BOLD}Toolchain & package-manager stores${RESET}"

# mise — keeps every version it ever installed until pruned. Versions that no
# config file references are removed; the ones in use stay.
if command -v mise &>/dev/null; then
  echo -e "\n${GREEN}mise:${RESET} $(size_of ~/.local/share/mise)"
  if [[ "$DRY_RUN" == "true" ]]; then
    unused=$(mise prune --dry-run 2>&1 | { grep -c 'uninstall' || true; })
    echo "  [DRY-RUN] $unused unused version(s) would be removed (details: mise prune --dry-run)"
  elif mise prune -y >/dev/null 2>&1; then
    log "✅ mise pruned"
  else
    log "  ⚠️  mise prune failed"
  fi
fi

# pnpm — one store per major version under a common parent. `pnpm store prune`
# only cleans the current one. Older stores are listed, never auto-deleted,
# because a project pinning an older pnpm (packageManager in package.json)
# would have to download its packages again.
if command -v pnpm &>/dev/null; then
  store=$(pnpm store path 2>/dev/null) || store=""
  if [[ -n "$store" ]]; then
    parent=$(dirname "$store")
    current=$(basename "$store")
    echo -e "\n${GREEN}pnpm stores:${RESET} $(size_of "$parent")"
    for d in "$parent"/*/; do
      [[ -d "$d" ]] || continue
      d="${d%/}"
      [[ "$(basename "$d")" == "$current" ]] && continue
      echo -e "  ${YELLOW}STALE store: $d ($(size_of "$d"))${RESET}"
      echo "    Not auto-deleted. Check packageManager in your projects first. Remove with: rm -rf \"$d\""
    done
    if [[ "$DRY_RUN" == "true" ]]; then
      echo "  [DRY-RUN] Would run: pnpm store prune"
    elif pnpm store prune >/dev/null 2>&1; then
      log "✅ pnpm store pruned"
    else
      log "  ⚠️  pnpm store prune failed"
    fi
  fi
fi

# uv — wheels and built packages cache. Waits for a lock held by any running
# uv process (MCP servers and editors often hold one), so the wait is capped.
if command -v uv &>/dev/null; then
  uv_dir=$(uv cache dir 2>/dev/null) || uv_dir=""
  echo -e "\n${GREEN}uv cache:${RESET} $(size_of "${uv_dir:-$HOME/.cache/uv}")"
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "  [DRY-RUN] Would run: uv cache clean"
  elif UV_LOCK_TIMEOUT=10 uv cache clean >/dev/null 2>&1; then
    log "✅ uv cache cleaned"
  else
    log "  ⚠️  uv cache clean failed. Another uv process probably holds the lock. Stop it and retry, or run: uv cache clean --force"
  fi
fi

echo ""
