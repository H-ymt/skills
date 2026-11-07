---
name: linearis
description: Linear.app を CLI (`linearis`) で操作するスキル。issue / project / cycle / milestone / document の取得・作成・更新を JSON 出力で行う。Linear 上のタスク管理、issue 起票・更新、プロジェクト確認、コメント投稿が必要な時に使用。
---

# linearis (Linear CLI)

Linear.app を JSON 出力前提の CLI で操作する。エージェント用に設計されており、1 呼び出し約 500–700 トークン (公式 MCP は約 13k)。

上流: <https://github.com/linearis-oss/linearis>

## 前提条件

- `linearis` インストール済み (`mise install npm:linearis` または `npm i -g linearis`、Node.js ≥ 22)
- 認証済み: 以下のいずれか
  - `linearis auth login` (対話)
  - 環境変数 `LINEAR_API_TOKEN`
  - `~/.linearis/token` ファイル
  - `--api-token <token>` フラグ
- エイリアス: `linear` でも同じ CLI が起動する。本ドキュメントは `linearis` で統一。

## 重要な原則

- **出力は常に JSON。** `jq` で整形・抽出する前提。
- **ID は柔軟。** UUID でも、issue は `ABC-123` 形式、team は key (`ENG`)、project / cycle / milestone は name でも引ける。曖昧な name は失敗するので、その場合は UUID か親スコープ (`--team`, `--project`) を併用する。
- **発見的に使う。** ドメインを忘れたら `linearis usage`、各コマンドの詳細は `linearis <domain> usage`。これでトークン消費を最小化する。
- **`comments` ドメインは非推奨。** `issues discuss` / `issues discussions` / `issues reply` を使う。
- **破壊的操作 (`delete`, `archive`) は事前に確認する。** ユーザに承認を取ってから実行。

## ドメイン早見表

| domain | 主な用途 |
| --- | --- |
| `issues` | work item の CRUD、検索、ステータス/優先度/担当変更、ディスカッション |
| `projects` | 関連 issue の束、ステータス/health/lead 管理 |
| `cycles` | チーム単位のスプリント (時間枠) |
| `milestones` | プロジェクト内のフェーズ/期日チェックポイント |
| `documents` | プロジェクトや issue に紐づく長文 markdown |
| `labels` | issue / project の分類タグ |
| `teams` | 組織単位 (key=`ENG` 等) |
| `users` | ワークスペースメンバー |
| `initiatives` | 複数プロジェクトを跨ぐ戦略目標 |
| `attachments` | issue に紐づく外部リソース (PR / URL) |
| `files` | ファイルバイナリの up/download |

## 発見ワークフロー

```bash
linearis usage                     # ドメイン一覧
linearis issues usage              # issues のサブコマンド一覧
linearis issues create --help      # 個別オプション
```

不明なときは「ドメイン」→「サブコマンド」→「フラグ」の順に降りる。

## 典型タスク

### Issue

```bash
# 一覧 (自分担当 / 状態フィルタ)
linearis issues list --assignee @me --state "In Progress" --limit 20 | jq '.[] | {id: .identifier, title, state: .state.name}'

# 全文検索
linearis issues search "auth migration" | jq '.[] | .identifier + " " + .title'

# 詳細 (description 込み)
linearis issues read ABC-123

# 作成
linearis issues create "ログイン画面のバリデーション修正" \
  --team ENG \
  --description "再現手順: ..." \
  --priority 2 \
  --labels bug,frontend \
  --assignee @me

# 更新 (状態 / 担当 / ラベル)
linearis issues update ABC-123 --state "In Review" --assignee user@example.com
linearis issues update ABC-123 --labels +blocked        # 追加
linearis issues update ABC-123 --labels -blocked        # 削除

# プロジェクト / マイルストーン / サイクルへ紐付け
linearis issues update ABC-123 --project "Q2 Roadmap" --project-milestone "Beta"
linearis issues update ABC-123 --cycle current

# ディスカッション (comments の代替)
linearis issues discuss ABC-123 --body "進捗: モックは完了"
linearis issues discussions ABC-123
linearis issues reply <threadId> --body "ありがとう、確認します"
linearis issues resolve <threadId>
```

### Project / Milestone

```bash
linearis projects list --limit 20 | jq '.[] | {name, state, health}'
linearis projects read "Q2 Roadmap"

linearis milestones list --project "Q2 Roadmap"
linearis milestones create "Beta" --project "Q2 Roadmap" --target-date 2026-06-30
```

### Cycle (Sprint)

```bash
linearis cycles list --team ENG --active
linearis cycles read <cycleId> --limit 100 | jq '.issues[] | {id: .identifier, title, state: .state.name}'
```

### Team / User / Label

```bash
linearis teams list | jq '.[] | {key, name}'
linearis users list --active | jq '.[] | {name, email}'
linearis labels list --team ENG --scope team
```

### Attachment (PR を issue に紐付け)

```bash
linearis attachments create ABC-123 \
  --title "PR #42: fix login validation" \
  --url https://github.com/owner/repo/pull/42
```

### Document

```bash
linearis documents create \
  --title "API 設計メモ" \
  --project "Q2 Roadmap" \
  --content "$(cat ./design.md)"
```

## 出力整形パターン

```bash
# issue の identifier と title だけ
linearis issues list --limit 50 | jq -r '.[] | "\(.identifier)\t\(.title)"'

# 件数
linearis issues list --state "Todo" | jq 'length'

# 失敗時のエラーメッセージ抽出 (linearis はエラーも JSON)
linearis issues read NONEXISTENT 2>&1 | jq -r '.error // empty'
```

## トラブルシュート

- **`Unauthorized`**: トークン未設定 or 失効。`linearis auth login` を再実行するかユーザに `LINEAR_API_TOKEN` 確認を依頼。
- **`ambiguous`/`not found`**: name が複数ヒット or 不一致。`--team` / `--project` でスコープを絞るか UUID を指定。
- **古い操作が出てくる**: `comments` ドメインは互換維持目的。新規コードでは `issues discuss/discussions/reply` を使う。
- **コマンドが見当たらない**: 必ず `linearis <domain> usage` を読み直す。バージョン更新で増減する。
