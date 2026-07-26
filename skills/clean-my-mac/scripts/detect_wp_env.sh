#!/usr/bin/env bash
# clean-my-mac: detect_wp_env.sh
# Detects @wordpress/env (wp-env) instance directories under ~/.wp-env and maps
# each hash to its origin project via the mounted source paths in docker-compose.yml.
#
# This is DETECTION ONLY — it never deletes. wp-env instances often hold live
# database data and the "which project does this hash belong to" mapping requires
# human judgement (similarly-named projects are easy to confuse). The agent driving
# clean-my-mac Phase 3b presents this list, confirms a KEEP list, then deletes.
#
# Why this exists: `docker system prune` cannot reclaim ~/.wp-env/<hash>/ — those
# are plain directories on disk, invisible to the Docker daemon. They are the single
# biggest wp-env storage sink and clean-my-mac's generic Docker phase misses them.
#
# Usage: bash detect_wp_env.sh

set -euo pipefail

WP_ENV_DIR="$HOME/.wp-env"
BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RESET='\033[0m'

if [[ ! -d "$WP_ENV_DIR" ]]; then
  echo "ℹ️  ~/.wp-env not found. No wp-env instances to review. Skipping."
  exit 0
fi

# Hashes that currently have Docker images or volumes loaded = "alive" instances.
# These correspond to projects you may still be actively running.
alive=""
if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  alive=$(
    { docker images --format '{{.Repository}}' 2>/dev/null
      docker volume ls -q 2>/dev/null; } \
    | grep -oE '^[a-f0-9]{32}' | sort -u
  )
fi

echo ""
echo -e "${BOLD}wp-env instances under ~/.wp-env${RESET}"
echo -e "(${GREEN}[LOADED]${RESET} = has Docker images/volumes now — likely an active project)"
echo "--------------------------------------------------------------------------------"
printf "%-6s %-11s %-38s %s\n" "SIZE" "MODIFIED" "INSTANCE" "ORIGIN PROJECT"
echo "--------------------------------------------------------------------------------"

total_orphan=0
for d in "$WP_ENV_DIR"/*/; do
  [[ -d "$d" ]] || continue
  name=$(basename "$d")
  size=$(du -sh "$d" 2>/dev/null | cut -f1)
  mt=$(stat -f '%Sm' -t '%Y-%m-%d' "$d" 2>/dev/null)

  # Reverse-lookup the origin project from the compose file's bind-mount sources.
  # Strip wp-env's own scaffold paths (latest-ja / WordPress / wordpress-<ver>) so
  # only the real project directory remains, then collapse to repo root.
  proj=$(grep -hoE "$HOME/[^:\"]*" "$d/docker-compose.yml" 2>/dev/null \
    | grep -vE '\.wp-env|/latest-ja|/WordPress$|wordpress-[0-9]' \
    | sed -E "s#($HOME/(ghq/github.com/[^/]+/[^/]+|[^/]+/[^/]+)).*#\1#" \
    | sort -u | head -1)
  [[ -z "$proj" ]] && proj="(unknown — data only)"

  tag=""
  if echo "$alive" | grep -q "^$name$"; then
    tag=" ${GREEN}[LOADED]${RESET}"
  fi

  printf "%-6s %-11s %-38s %b\n" "$size" "$mt" "$name" "$proj$tag"
done | sort -k2

echo "--------------------------------------------------------------------------------"
echo -e "${YELLOW}Total ~/.wp-env size:${RESET} $(du -sh "$WP_ENV_DIR" 2>/dev/null | cut -f1)"
echo ""
echo "Next: the agent will ask which projects to KEEP, then delete the rest with"
echo "  rm -rf ~/.wp-env/<hash>   (no wp-env destroy needed — these are orphaned dirs)"
echo ""
echo -e "${YELLOW}⚠️  Watch for similarly-named but DIFFERENT projects${RESET}"
echo "   (e.g. a '*-med.jp-AWS' client site vs a 'japan-*' repo — verify the ORIGIN"
echo "   PROJECT column, not the instance name, before deleting)."
