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
BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; RESET='\033[0m'

if [[ ! -d "$WP_ENV_DIR" ]]; then
  echo "ℹ️  ~/.wp-env not found. No wp-env instances to review. Skipping."
  exit 0
fi

# Instances that currently have Docker images or volumes loaded = "alive".
# wp-env names images "<instance>-wordpress" / "<instance>-cli" (plus "-tests-")
# and volumes "<instance>_mysql", where <instance> is either a 32-char hash or
# "wp-env-<project>-<hash8>". Strip the suffix to get the instance directory name.
alive=""
if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  alive=$(
    { docker images --format '{{.Repository}}' 2>/dev/null \
        | sed -E 's/-(tests-)?(wordpress|cli)$//'
      docker volume ls -q 2>/dev/null | sed -E 's/_.*$//'; } \
    | sort -u
  )
fi

# Origin project = first bind-mount source in the compose file that is not wp-env's
# own scaffold. An instance without a compose file (or with only scaffold mounts)
# is a legitimate "data only" state, not an error.
origin_project() {
  local compose="$1/docker-compose.yml" src d
  [[ -f "$compose" ]] || return 0
  # Strip wp-env's own scaffold paths (latest-ja / WordPress / wordpress-<ver>) so
  # only the real project directory remains.
  src=$( { grep -hoE "$HOME/[^:\"]*" "$compose" || true; } \
    | { grep -vE '\.wp-env|/latest-ja|/WordPress$|wordpress-[0-9]' || true; } \
    | sort -u | sed -n 1p )
  [[ -n "$src" ]] || return 0

  if [[ -e "$src" ]]; then
    # Walk up to the repository root, so layouts like ghq/<org>/<repo> and
    # ghq/github.com/<owner>/<repo> both resolve to the full repo path.
    d="$src"
    while [[ "$d" != "$HOME" && "$d" != "/" ]]; do
      if [[ -e "$d/.git" ]]; then echo "$d"; return 0; fi
      d=$(dirname "$d")
    done
    echo "$src"
  else
    # The project is gone, so there is no repo to find. Collapse by layout for display.
    echo "$src" | sed -E "s#($HOME/(ghq/github.com/[^/]+/[^/]+|[^/]+/[^/]+)).*#\1#"
  fi
}

echo ""
echo -e "${BOLD}wp-env instances under ~/.wp-env${RESET}"
echo -e "(${GREEN}[LOADED]${RESET} = has Docker images/volumes now — likely an active project)"
echo -e "(${RED}[MISSING]${RESET} = the origin project directory no longer exists)"
echo "--------------------------------------------------------------------------------"
printf "%-6s %-11s %-38s %s\n" "SIZE" "MODIFIED" "INSTANCE" "ORIGIN PROJECT"
echo "--------------------------------------------------------------------------------"

total_orphan=0
for d in "$WP_ENV_DIR"/*/; do
  [[ -d "$d" ]] || continue
  name=$(basename "$d")
  size=$(du -sh "$d" 2>/dev/null | cut -f1)
  mt=$(stat -f '%Sm' -t '%Y-%m-%d' "$d" 2>/dev/null)

  origin=$(origin_project "$d")
  proj="${origin:-(unknown — data only)}"

  tag=""
  if grep -qxF -- "$name" <<<"$alive"; then
    tag=" ${GREEN}[LOADED]${RESET}"
  fi
  if [[ -n "$origin" && ! -e "$origin" ]]; then
    tag="$tag ${RED}[MISSING]${RESET}"
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
