#!/usr/bin/env bash
# clean-my-mac: scripts のふるまいテスト。偽の HOME とコマンドのシムで実機に触れずに確かめる。
# Usage: bash tests/scripts.test.sh

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS="$HERE/../scripts"
FAILED=0

strip_ansi() { sed -E $'s/\x1b\\[[0-9;]*m//g'; }

ok() { echo "ok   $1"; }
ng() { echo "FAIL $1"; FAILED=1; }

expect_contains() { # name, text, needle
  if grep -qF -- "$3" <<<"$2"; then ok "$1"; else ng "$1 (見つからない: $3)"; fi
}

expect_row_contains() { # name, text, row-key, needle
  local row
  row="$(grep -F -- "$3" <<<"$2" | head -n 1)"
  if grep -qF -- "$4" <<<"$row"; then ok "$1"; else ng "$1 (行: ${row:-なし} / 期待: $4)"; fi
}

expect_row_lacks() { # name, text, row-key, needle
  local row
  row="$(grep -F -- "$3" <<<"$2" | head -n 1)"
  if [[ -n "$row" ]] && ! grep -qF -- "$4" <<<"$row"; then ok "$1"; else ng "$1 (行: ${row:-なし} / 含まれないはず: $4)"; fi
}

SANDBOXES=()
cleanup() { [[ ${#SANDBOXES[@]} -eq 0 ]] || rm -rf "${SANDBOXES[@]}"; }
trap cleanup EXIT

new_sandbox() {
  SANDBOX="$(mktemp -d)"
  mkdir -p "$SANDBOX/bin"
  SANDBOXES+=("$SANDBOX")
}

# ─── detect_wp_env.sh ────────────────────────────────────────────────────────
test_detect_wp_env_lists_every_instance() {
  new_sandbox
  local home="$SANDBOX" wp="$SANDBOX/.wp-env"
  local no_compose=aaaaaaaabbbbbbbbccccccccdddddddd
  local hashed=11111111222222223333333344444444
  local named=wp-env-foo-12345678

  mkdir -p "$wp/$no_compose" "$wp/$hashed" "$wp/$named"
  printf 'services:\n  wordpress:\n    volumes:\n      - %s/ghq/github.com/acme/hashed/theme:/var/www/html/wp-content/themes/hashed\n' "$home" \
    > "$wp/$hashed/docker-compose.yml"
  printf 'services:\n  wordpress:\n    volumes:\n      - %s/ghq/github.com/acme/foo/theme:/var/www/html/wp-content/themes/foo\n' "$home" \
    > "$wp/$named/docker-compose.yml"

  cat > "$SANDBOX/bin/docker" <<EOF
#!/usr/bin/env bash
case "\$1" in
  info) exit 0 ;;
  images) printf '%s\n' wp-env-foo-12345678-wordpress wp-env-foo-12345678-cli ;;
  volume) printf '%s\n' ${no_compose}_mysql ;;
esac
EOF
  chmod +x "$SANDBOX/bin/docker"

  local out
  out="$(HOME="$home" PATH="$SANDBOX/bin:$PATH" bash "$SCRIPTS/detect_wp_env.sh" 2>&1 | strip_ansi)"

  expect_contains "detect: compose の無いインスタンスを表示する" "$out" "$no_compose"
  expect_contains "detect: ハッシュ名のインスタンスを表示する" "$out" "$hashed"
  expect_contains "detect: 名前つきのインスタンスを表示する" "$out" "$named"
  expect_contains "detect: 合計サイズのフッターまで出力する" "$out" "Total ~/.wp-env size"
  expect_row_contains "detect: compose の無いインスタンスは origin 不明と表示する" "$out" "$no_compose" "unknown"
  expect_row_contains "detect: compose から元プロジェクトを引く" "$out" "$hashed" "ghq/github.com/acme/hashed"
  expect_row_contains "detect: 名前つきインスタンスの元プロジェクトを引く" "$out" "$named" "ghq/github.com/acme/foo"
  expect_row_contains "detect: 名前つきインスタンスも LOADED と判定する" "$out" "$named" "LOADED"
  expect_row_contains "detect: ボリュームを持つハッシュ名を LOADED と判定する" "$out" "$no_compose" "LOADED"
  expect_row_lacks "detect: Docker に痕跡が無いインスタンスは LOADED にしない" "$out" "$hashed" "LOADED"
}

# ─── analyze_storage.sh ──────────────────────────────────────────────────────
test_analyze_storage_counts_the_real_pnpm_store() {
  new_sandbox
  local home="$SANDBOX"
  local store="$home/.local/share/pnpm/store"

  mkdir -p "$store/v11" "$store/v10"
  head -c 2097152 /dev/zero > "$store/v11/blob"
  head -c 1048576 /dev/zero > "$store/v10/blob"

  cat > "$SANDBOX/bin/pnpm" <<EOF
#!/usr/bin/env bash
[[ "\$1 \$2" == "store path" ]] && echo "$store/v11"
EOF
  printf '#!/usr/bin/env bash\nexit 1\n' > "$SANDBOX/bin/docker"
  chmod +x "$SANDBOX/bin/pnpm" "$SANDBOX/bin/docker"

  local out
  out="$(HOME="$home" PATH="$SANDBOX/bin:$PATH" bash "$SCRIPTS/analyze_storage.sh" 2>&1 | strip_ansi)"

  local row
  row="$(grep -F "pnpm Store" <<<"$out" | head -n 1)"
  if [[ "$row" =~ pnpm\ Store[[:space:]]+[0-9.]+M ]]; then
    ok "analyze: pnpm ストアを pnpm store path から測り、旧バージョンも含める"
  else
    ng "analyze: pnpm ストアのサイズが 0B (行: ${row:-なし})"
    sed -n '1,25p' <<<"$out" | sed 's/^/     | /'
  fi
}

# ─── cleanup_caches.sh ───────────────────────────────────────────────────────
expect_no_line() { # name, text, pattern
  if grep -qE -- "$3" <<<"$2"; then ng "$1 (含まれないはずの行: $(grep -E -- "$3" <<<"$2" | head -n 1))"; else ok "$1"; fi
}

expect_dir() { # name, path, present|absent
  if [[ "$3" == present && -d "$2" ]] || [[ "$3" == absent && ! -d "$2" ]]; then ok "$1"; else ng "$1 ($2 が $3 でない)"; fi
}

test_cleanup_caches_keeps_requested_and_apple_managed() {
  new_sandbox
  local home="$SANDBOX" caches="$SANDBOX/Library/Caches"
  local name
  for name in pnpm ms-playwright foo com.apple.thing Homebrew; do
    mkdir -p "$caches/$name"
    echo data > "$caches/$name/file"
  done
  printf '#!/usr/bin/env bash\nexit 1\n' > "$SANDBOX/bin/sudo"
  printf '#!/usr/bin/env bash\nexit 0\n' > "$SANDBOX/bin/osascript"
  chmod +x "$SANDBOX/bin/sudo" "$SANDBOX/bin/osascript"

  local env_prefix=(env HOME="$home" PATH="$SANDBOX/bin:$PATH")
  local dry
  dry="$("${env_prefix[@]}" bash "$SCRIPTS/cleanup_caches.sh" --dry-run --keep pnpm,ms-playwright 2>&1 | strip_ansi)"

  expect_contains "caches dry-run: 対象のキャッシュは削除予定に出す" "$dry" "Would delete: $caches/foo/"
  expect_no_line "caches dry-run: --keep したキャッシュは削除予定に出さない" "$dry" "Would delete.*/(pnpm|ms-playwright)/"
  expect_no_line "caches dry-run: macOS 管理の com.apple.* は削除予定に出さない" "$dry" "Would delete.*com\\.apple"
  expect_contains "caches dry-run: 残すものを KEEP と表示する" "$dry" "KEEP: pnpm"

  "${env_prefix[@]}" bash "$SCRIPTS/cleanup_caches.sh" --keep pnpm,ms-playwright >/dev/null 2>&1
  expect_dir "caches 実行: --keep したキャッシュは残る" "$caches/pnpm" present
  expect_dir "caches 実行: --keep した ms-playwright も残る" "$caches/ms-playwright" present
  expect_dir "caches 実行: com.apple.* は残る" "$caches/com.apple.thing" present
  expect_dir "caches 実行: 対象のキャッシュは消える" "$caches/foo" absent
}

# ─── cleanup_toolchains.sh ───────────────────────────────────────────────────
test_cleanup_toolchains_prunes_and_lists_stale_pnpm_stores() {
  new_sandbox
  local home="$SANDBOX" store="$SANDBOX/.local/share/pnpm/store"
  export CALLS="$SANDBOX/calls"
  : > "$CALLS"
  mkdir -p "$store/v11" "$store/v10" "$store/v3"
  echo data > "$store/v10/blob"

  cat > "$SANDBOX/bin/mise" <<'EOF'
#!/usr/bin/env bash
echo "mise $*" >> "$CALLS"
if [[ "$1 $2" == "prune --dry-run" ]]; then
  printf '%s\n' "mise bun@1 [dryrun] uninstall" "mise node@2 [dryrun] uninstall" "mise node@2 [dryrun] remove /x"
fi
EOF
  cat > "$SANDBOX/bin/pnpm" <<EOF
#!/usr/bin/env bash
echo "pnpm \$*" >> "\$CALLS"
[[ "\$1 \$2" == "store path" ]] && echo "$store/v11"
exit 0
EOF
  cat > "$SANDBOX/bin/uv" <<EOF
#!/usr/bin/env bash
echo "uv \$*" >> "\$CALLS"
[[ "\$1 \$2" == "cache dir" ]] && echo "$SANDBOX/.cache/uv"
exit 0
EOF
  chmod +x "$SANDBOX/bin/mise" "$SANDBOX/bin/pnpm" "$SANDBOX/bin/uv"

  local env_prefix=(env HOME="$home" PATH="$SANDBOX/bin:$PATH")
  local dry calls
  dry="$("${env_prefix[@]}" bash "$SCRIPTS/cleanup_toolchains.sh" --dry-run 2>&1 | strip_ansi)"
  calls="$(cat "$CALLS")"

  expect_contains "toolchains dry-run: mise の削除対象数を表示する" "$dry" "2 unused version"
  expect_contains "toolchains dry-run: mise は --dry-run で呼ぶ" "$calls" "mise prune --dry-run"
  expect_no_line "toolchains dry-run: 実際の prune は呼ばない" "$calls" "mise prune -y|pnpm store prune|uv cache clean"
  expect_contains "toolchains dry-run: 旧 pnpm ストア v10 を列挙する" "$dry" "STALE store: $store/v10"
  expect_contains "toolchains dry-run: 旧 pnpm ストア v3 を列挙する" "$dry" "STALE store: $store/v3"
  expect_no_line "toolchains dry-run: 現行の v11 は旧扱いにしない" "$dry" "STALE.*/v11"

  : > "$CALLS"
  "${env_prefix[@]}" bash "$SCRIPTS/cleanup_toolchains.sh" >/dev/null 2>&1
  calls="$(cat "$CALLS")"

  expect_contains "toolchains 実行: mise prune を実行する" "$calls" "mise prune -y"
  expect_contains "toolchains 実行: pnpm store prune を実行する" "$calls" "pnpm store prune"
  expect_contains "toolchains 実行: uv cache clean を実行する" "$calls" "uv cache clean"
  expect_dir "toolchains 実行: 旧 pnpm ストアは自動で消さない (v10)" "$store/v10" present
  expect_dir "toolchains 実行: 旧 pnpm ストアは自動で消さない (v3)" "$store/v3" present
}

test_detect_wp_env_lists_every_instance
test_analyze_storage_counts_the_real_pnpm_store
test_cleanup_caches_keeps_requested_and_apple_managed
test_cleanup_toolchains_prunes_and_lists_stale_pnpm_stores

exit "$FAILED"
