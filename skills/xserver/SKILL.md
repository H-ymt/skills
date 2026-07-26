---
name: xserver
description: >
  Deploy and manage websites on XServer / エックスサーバー using the XServer API and SSH.
  Use for requests like 「エックスサーバーにデプロイ」「XServer APIで設定」「WordPressを入れて」
  「サイト公開」「LP作って公開」「サブドメイン追加」「メールアドレス作成」
  「DNS変更」「WordPress削除」「ドメインとSSLを設定」「DNS/メール/迷惑メールフィルタ/自動応答/Cron/SSH/FTPを管理」
  「自動バックアップ/MySQLバックアップの取得・復元」「リソースモニター確認」
  「WordPressセキュリティ/WAF/php.ini/高速化キャッシュ設定」「サイト転送・アクセス拒否・XPageSpeedを管理」.
  Confirm before secrets, public destinations, SSH changes, deletion, reset, or rsync --delete.
metadata:
  author: xserver-inc
  version: "1.2.0"
tags:
  - deployment
  - hosting
  - xserver
platforms:
  - cursor
  - claude-code
  - gemini-cli
  - cline
  - codex
---

# XServer Deploy & Manage

エックスサーバーへのデプロイとサーバー管理を自動化するスキル。
REST API によるサーバー設定と SSH によるファイルデプロイの両方をサポートする。

- 対象サービス: エックスサーバー（スタンダード / プレミアム / ビジネス）
- API リファレンス: https://developer.xserver.ne.jp/api/server/
- OpenAPI 仕様（JSON）: https://developer.xserver.ne.jp/api/server/openapi.json

## Agent Rules (MUST READ FIRST)

- API キーをチャット本文に貼るよう案内してはならない
- API キーを `echo` / `printf` 等でコマンドに含めてはならない
- API キーはファイルに直接書き込んではならない（`echo "key" > file` 禁止）
- API キーは環境変数 `$XSERVER_API_KEY` 経由でのみ受け取る
- 環境変数が未設定なら作業を止めて設定方法を案内し待機する
- Windows では Git Bash の手順を第一選択とする。PowerShell DPAPI や追加モジュール導入に進まない

## Prerequisites

- エックスサーバーの契約
- XServer アカウントで API キーを発行済み（https://www.xserver.ne.jp/manual/man_tool_api.php）
- SSH 有効化・公開鍵の登録はすべて API 経由で実施（手動でサーバーパネル操作は不要）
- macOS: `curl`、`ssh`、`rsync`（標準搭載）。`jq` はあると便利だが必須ではない
- Windows: Git Bash または WSL、`curl`、`ssh`（Git for Windows に同梱）。`jq` と `rsync` は既に利用可能な場合のみ使用する
- Linux: `curl`、`ssh`。`jq`、`rsync`、`secret-tool`、`pass` は既に利用可能な場合のみ使用する

---

## Step 1: Setup

**実施順序:** `1-2 Preflight` → `1-3 API キー設定` → `1-4 検証` → `1-5 サーバー情報取得`。
API キー未設定のまま `1-4` に進まない。

### Windows / Git Bash クイックスタート

Cursor 等のエージェント利用時は、**エージェントと同じターミナル**で次を実行してから「セットアップして」と依頼する。

```bash
# 1. API キーをこのシェルだけに設定（チャットには貼らない）
read -r -s -p "XServer API Key: " XSERVER_API_KEY
echo
export XSERVER_API_KEY

# 2. 最低限のコマンド確認
for cmd in curl ssh; do command -v "$cmd" >/dev/null || echo "missing:$cmd"; done
command -v jq >/dev/null || echo "optional-missing:jq"

# 3. 接続確認
if command -v jq >/dev/null; then
  SERVERNAME=$(curl -s -X GET "https://api.xserver.ne.jp/v1/me" \
    -H "Authorization: Bearer $XSERVER_API_KEY" | jq -r '.servername // empty')
  test -n "$SERVERNAME" || echo "API から SERVERNAME を取得できませんでした（APIキー不正・期限切れ・IP制限の可能性）"
fi
if test -z "$SERVERNAME"; then
  read -r -p "SERVERNAME（例: xs123456.xsrv.jp）: " SERVERNAME
fi
export SERVERNAME
echo "servername=$SERVERNAME"
```

`optional-missing:jq` が出た場合、ユーザーは `jq` を導入するか、現在のセッションだけ `SERVERNAME` などの値を手入力して進めるかを選ぶ。

### 1-1. API キーの取得

ユーザーに以下を確認:

```
API キーはチャット本文には貼らず、ターミナルで対話入力して環境変数に設定してください。
エックスサーバーの API キーを用意してください。
XServer アカウントにログイン（https://secure.xserver.ne.jp/xapanel/login/xserver/）し、サイドメニューの「APIキー管理」から発行できます。
参考: https://www.xserver.ne.jp/manual/man_tool_api.php

設定手順は冒頭の「Windows / Git Bash クイックスタート」または `1-3` を参照。
```

共有端末ではシェル履歴やログに残らないよう注意する。
ユーザーが API キーをチャットに貼った場合、その値を繰り返さずに処理を続行し、完了後にローテーションを案内する。

**【エージェント厳守】キーを平文でコマンドに含めることは絶対禁止。**
`printf %s 'xs_abc...' > file` や `echo 'xs_abc...'` のような形でキーをリテラルとしてシェルコマンドに渡してはならない。シェル履歴・ログ・会話履歴にキーが残る。TTY がない場合は `1-3` の「サンドボックス型エージェント（Codex 等）」の注記に従う。

### 1-2. Preflight チェック

```bash
for cmd in curl ssh; do command -v "$cmd" >/dev/null || echo "missing:$cmd"; done
command -v jq >/dev/null || echo "optional-missing:jq"
command -v rsync >/dev/null || echo "optional-missing:rsync"
```

`missing:*` があれば作業を止め、ユーザーに不足ツールの準備を依頼する。`optional-missing:*` は導入するか環境変数で値を補うかをユーザーに選んでもらう。エージェントは Windows 環境で `scoop` / `choco` / `winget` / `Install-Module` による自動導入を行ってはならない。

不足時にユーザーへ案内する例:

| 不足 | ユーザー向け案内 |
|---|---|
| `optional-missing:jq` | 導入する場合は [jq リリース](https://github.com/jqlang/jq/releases) から取得。導入しない場合は `SERVERNAME`、`DEPLOY_PATH`、`DEPLOY_SOURCE` などを現在のセッションの環境変数として手入力して進める |
| `missing:curl` / `missing:ssh`（Windows） | [Git for Windows](https://gitforwindows.org/) を入れ、Git Bash から作業する |
| `optional-missing:rsync` | セットアップは続行可。ファイル転送時は後述の `scp` 節を使う |

### 1-3. API キーの安全な保存

**最低限の要件: 環境変数 `XSERVER_API_KEY` でエージェントに渡す。** 平文ファイル（`.env` 等）への直接記述・コマンド引数へのリテラル埋め込みは禁止。

| 環境 | 方法 |
|---|---|
| **Windows / Git Bash（推奨）** | セッション限定の環境変数（下記） |
| Windows PowerShell 7.1+ | `$env:XSERVER_API_KEY = Read-Host "..." -MaskInput`（5.1 以下は Git Bash を優先） |
| Windows PowerShell / DPAPI（任意） | `Export-Clixml` / `Import-Clixml`。失敗時は追加導入せずセッション限定へ戻る |
| macOS | Keychain（`security add-generic-password` / `find-generic-password`） |
| Linux / VPS | `secret-tool` がある場合は利用。なければセッション限定（`read -sp` → `export`） |
| CI/CD | プラットフォームのシークレット管理（GitHub Actions Secrets 等） |

**Windows / Git Bash（推奨）:**
```bash
read -r -s -p "XServer API Key: " XSERVER_API_KEY
echo
export XSERVER_API_KEY
# 同じシェルセッションからエージェントを起動する
```

**macOS:**
```bash
read -sp "XServer API Key: " X_KEY
security add-generic-password -U -a "apikey" -s "xserver-api" -w "$X_KEY" -l "XServer API Key" && unset X_KEY
export XSERVER_API_KEY=$(security find-generic-password -s "xserver-api" -w)
```

**Linux / VPS（secret-tool）:**
```bash
read -sp "XServer API Key: " X_KEY && printf %s "$X_KEY" | secret-tool store --label="XServer API Key" service xserver-api account apikey && unset X_KEY
export XSERVER_API_KEY=$(secret-tool lookup service xserver-api account apikey)
```

**サンドボックス型エージェント（Codex 等）:** サンドボックスでは親シェルの `export` が引き継がれないことがある。`XSERVER_API_KEY="$K" codex` の形で起動コマンドに直接渡す。

**【エージェント厳守】**
- キーをコマンド引数にリテラルで含めてはならない（`printf %s 'xs_...'`、`echo 'xs_...'` 等は禁止）
- `$XSERVER_API_KEY` が未設定の場合は作業を止め、上記の設定をユーザーに求めて待機する

複数契約を並行運用する場合は「複数契約の並行運用（補足）」を参照。

### 1-4. API キーの検証と servername 取得

`1-3` で `XSERVER_API_KEY` を設定済みであること。未設定なら `1-3` に戻る。

```bash
test -n "$XSERVER_API_KEY" || { echo "missing:XSERVER_API_KEY"; exit 1; }

if command -v jq >/dev/null; then
  SERVERNAME=$(curl -s -X GET "https://api.xserver.ne.jp/v1/me" \
    -H "Authorization: Bearer $XSERVER_API_KEY" | jq -r '.servername // empty')
elif test -n "$SERVERNAME"; then
  echo "jq なし: 現在のセッションの SERVERNAME=$SERVERNAME を使用"
else
  echo "missing:jq-or-SERVERNAME"
  exit 1
fi
test -n "$SERVERNAME" || { echo "missing:SERVERNAME"; exit 1; }
# 例: xs123456.xsrv.jp
```

`missing:jq-or-SERVERNAME` の場合、ユーザーは `jq` を導入するか、`read -r -p "SERVERNAME: " SERVERNAME && export SERVERNAME` で現在のセッションに値を設定して再開する。
`SERVERNAME` が空の場合は API キー不正・期限切れ・IP 制限を疑い、トラブルシューティングを参照する。
`SERVERNAME` を以降の全 API リクエストで使用する。

### 1-5. サーバー情報の取得

```bash
curl -s -X GET "https://api.xserver.ne.jp/v1/server/${SERVERNAME}/server-info" \
  -H "Authorization: Bearer $XSERVER_API_KEY"
```

記録すべき値:
- `ip_address` → DNS 設定用
- `name_servers` → ドメインのネームサーバー設定用（ns1～ns5.xserver.jp）
- `php_versions` → PHP バージョン選択時に参照
- `db_versions` → MySQL/MariaDB の製品・バージョン確認（サーバー世代により異なる）

SSH 接続情報は `servername` から決定論的に組み立てるため、
`hostname` の記録は不要（詳細は Step 1-6 参照）。

ユーザーが「セットアップして」とだけ依頼した場合は、ここまでを既定範囲として完了する。
完了後は、サイト公開・WordPress インストール・ドメイン/SSL 設定・終了など、
次に進める作業を短く提示してユーザーの指示を待つ。

### 1-6. SSH 設定（ファイルデプロイ時のみ）

XServer の SSH は公開鍵認証のみ対応（パスワード認証は不可）。
SSH の有効化と鍵登録はすべて API 経由で実施する。
SSH の有効化・無効化、国外アクセス制限の変更、公開鍵の追加・無効化・削除は、実行前にユーザー確認を取る。

SSH 接続情報は `servername` から決定論的に組み立てる。追加の API 呼び出しは不要。

- ホスト: `${SERVERNAME}`（初期ドメインそのまま。例: `xs123456.xsrv.jp`）
- ユーザー: `${SERVERNAME%%.*}`（最初のラベル。例: `xs123456`）
- ポート: `10022`（固定）
- 認証: 公開鍵のみ

#### 1-6-1. SSH を有効化

```bash
curl -s -X PUT "https://api.xserver.ne.jp/v1/server/${SERVERNAME}/ssh" \
  -H "Authorization: Bearer $XSERVER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"ssh_enabled": true}'
```

#### 1-6-2. ローカル鍵を生成して公開鍵を登録

既定ではローカルで ed25519 鍵を生成し、公開鍵のみ API に登録する。既存鍵がある場合は再生成せず再利用する。
秘密鍵を API レスポンスとして受け取る `generate: true` は、ローカルで鍵生成できない場合のフォールバックとする。

```bash
XSERVER_SSH_KEY=~/.ssh/xserver_deploy.key
mkdir -p "$(dirname "$XSERVER_SSH_KEY")"

if test ! -f "$XSERVER_SSH_KEY"; then
  ssh-keygen -t ed25519 -N '' -C "xserver-deploy-${SERVERNAME%%.*}" -f "$XSERVER_SSH_KEY"
  GENERATED_SSH_KEY=1
else
  GENERATED_SSH_KEY=0
fi
chmod 600 "$XSERVER_SSH_KEY"

PUBLIC_KEY=$(cat "${XSERVER_SSH_KEY}.pub")
if command -v jq >/dev/null; then
  BODY=$(jq -n --arg pk "$PUBLIC_KEY" --arg lbl "deploy" '{public_key: $pk, label: $lbl}')
else
  # jq なし: この手順で新規生成した鍵のみ簡易 JSON 生成を許可する
  # 既存鍵の再利用時は公開鍵コメントに " や \ が含まれる可能性があるため jq 必須
  test "$GENERATED_SSH_KEY" = "1" || { echo "missing:jq-for-existing-public-key"; exit 1; }
  BODY=$(printf '{"public_key":"%s","label":"deploy"}' "$PUBLIC_KEY")
fi

curl -s -X POST "https://api.xserver.ne.jp/v1/server/${SERVERNAME}/ssh/key" \
  -H "Authorization: Bearer $XSERVER_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$BODY"
```

`generate: true` を使う場合、秘密鍵はレスポンスで1回だけ返る。標準出力やログに表示せず、即座に OS セキュアストレージへ保存する。

#### 1-6-3. 接続テスト

```bash
XSERVER_SSH_KEY=${XSERVER_SSH_KEY:-~/.ssh/xserver_deploy.key}
chmod 600 "$XSERVER_SSH_KEY"

ssh -i "$XSERVER_SSH_KEY" -o StrictHostKeyChecking=accept-new \
  -p 10022 "${SERVERNAME%%.*}@${SERVERNAME}" "echo 'SSH接続成功'"
```

※既存の公開鍵を登録する場合は `ssh-keygen` を省略し、`{"public_key": "ssh-ed25519 AAAA...", "label": "deploy"}` を送信する。

---

## Step 2: プロジェクト設定

### 2-1. 公開先の合意（必須）

公開先は AI が独断で決めない。前回セッションの値や保存値も無断で再利用しない。
ユーザーが公開先ドメインを指定していない場合は、必ず以下を確認する。

- 登録済みドメイン: `GET /domain` の一覧
- 登録済みサブドメイン: `GET /subdomain` の一覧
- 初期ドメイン: `${SERVERNAME}` そのもの（API 呼び出し不要）
- 新規追加（独自ドメイン / サブドメイン）も選択肢として提示

公開先が決まったら `document_root` を取得し（独自ドメインは
`GET /domain/{domain}`、サブドメインは `GET /subdomain` 一覧から FQDN マッチ）、
SSH で既存ファイルを確認する。既存サイトがある場合は、上書き・全削除・
サブパス配置のどれにするかをユーザーに確認する。

```bash
ssh -i ~/.ssh/xserver_deploy.key -p 10022 \
  "${SERVERNAME%%.*}@${SERVERNAME}" "ls -la ${DOCUMENT_ROOT}/"
```

### 2-2. `.xserver.json` の作成

プロジェクトルートに `.xserver.json` を作成。`deploy_path` は Step 2-1 で取得した
`document_root` を使う。`.xserver.json` は `.gitignore` に追加すること。

```json
{
  "servername": "xs123456.xsrv.jp",
  "domain": "example.com",
  "deploy_path": "/home/xs123456/example.com/public_html",
  "deploy_source": "./dist"
}
```

---

## Step 3: アプリケーション作成

Apache ベースの共用ホスティング。Node.js ランタイム不可（デーモン起動不可）。`.htaccess` で Apache 設定可能。静的サイトは HTML + Tailwind CSS (CDN)、動的は PHP、CMS は WordPress（API でインストール可能）。利用可能 PHP / DB バージョンは `server-info` の `php_versions` / `db_versions` で確認。

複数ページ・独自デザイン・公開を含む依頼は、着手前にコンセプト・ページ構成・使用技術・公開先を提示してユーザーの合意を得る。

---

## Step 4: サーバー設定（API）

Base URL: `https://api.xserver.ne.jp`
全リクエストに `Authorization: Bearer $XSERVER_API_KEY` ヘッダーが必要。

### サーバー情報の確認

各種設定の前に、現在のサーバー情報や利用状況を取得できる。
PHP / DB バージョン、ネームサーバー、IP アドレス、ドメイン所有権確認用トークン、
ディスク使用量や各種設定の件数などを参照する。

```bash
# サーバー情報（PHP/DB バージョン、ネームサーバー、IP、domain_validation_token 等）
curl -s -X GET "https://api.xserver.ne.jp/v1/server/${SERVERNAME}/server-info" \
  -H "Authorization: Bearer $XSERVER_API_KEY"

# 利用状況（ディスク使用量・ファイル数・各種設定件数）
curl -s -X GET "https://api.xserver.ne.jp/v1/server/${SERVERNAME}/server-info/usage" \
  -H "Authorization: Bearer $XSERVER_API_KEY"
```

### ドメイン追加 + SSL

```bash
curl -s -X POST "https://api.xserver.ne.jp/v1/server/${SERVERNAME}/domain" \
  -H "Authorization: Bearer $XSERVER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"domain": "example.com", "ssl": true, "redirect_https": true}'
```

`ssl_status` が `failed_nameserver` の場合、当サービスのネームサーバー（ns1～ns5.xserver.jp）利用を希望するか確認する。
ドメイン所有権確認が必要な場合は `GET /v1/server/{servername}/server-info` の `domain_validation_token` を使用。

### サブドメイン追加

`POST /v1/server/${SERVERNAME}/subdomain` に `{"subdomain":"blog.example.com","ssl":true}` を送る。

### WordPress インストール

`admin_password` はサンプル値を使わず、十分に強固なパスワードを生成する
（例: `openssl rand -base64 24` / `pwgen -s 24 1`）。

```bash
curl -s -X POST "https://api.xserver.ne.jp/v1/server/${SERVERNAME}/wp" \
  -H "Authorization: Bearer $XSERVER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/blog",
    "title": "My Blog",
    "admin_username": "admin",
    "admin_password": "<生成したパスワード>",
    "admin_email": "admin@example.com"
  }'
```

`GET /wp?domain=...` は親ドメインのみ対応で、サブドメインによる絞り込みには
対応していない。サブドメインに入れた WordPress を確認するときは、
`GET /wp` の全件取得、または親ドメインで絞り込んだうえで
`wordpress[].url` を見て対象 URL に一致するものを探す。

### データベース作成

```bash
curl -s -X POST "https://api.xserver.ne.jp/v1/server/${SERVERNAME}/db" \
  -H "Authorization: Bearer $XSERVER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name_suffix": "db01", "character_set": "utf8mb4"}'

curl -s -X POST "https://api.xserver.ne.jp/v1/server/${SERVERNAME}/db/user" \
  -H "Authorization: Bearer $XSERVER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name_suffix": "user01", "password": "<生成したパスワード>"}'

curl -s -X POST "https://api.xserver.ne.jp/v1/server/${SERVERNAME}/db/user/xs123456_user01/grant" \
  -H "Authorization: Bearer $XSERVER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"db_name": "xs123456_db01"}'
```

### DNS / SSL / PHP / Cron / メール関連 / FTP

DNS レコード・SSL・PHP バージョン・Cron・メール（迷惑メールフィルタ / 自動応答 / DKIM / DMARC / SPF）・FTP はパス・メソッド・パラメータが多岐にわたるため OpenAPI 仕様を参照する。共通形式:

```bash
curl -s -X {METHOD} "https://api.xserver.ne.jp/v1/server/${SERVERNAME}/{resource}" \
  -H "Authorization: Bearer $XSERVER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

パスワードはすべてサンプル値を使わず生成する（例: `openssl rand -base64 24`）。

### WordPress 削除

WordPress 削除はデフォルト値が項目ごとに揃っていないため事故になりやすい。
削除対象を必ず表示してユーザー確認を得てから、明示的に boolean を送る。

- `delete_db`（デフォルト true）: 関連データベースも削除
- `delete_db_user`（デフォルト false）: 関連 DB ユーザーも削除
- `delete_cron`（デフォルト true）: 関連 Cron も削除

```bash
curl -s -X DELETE "https://api.xserver.ne.jp/v1/server/${SERVERNAME}/wp/${WP_ID}" \
  -H "Authorization: Bearer $XSERVER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"delete_db": true, "delete_db_user": false, "delete_cron": true}'
```

---

## Step 5: ファイルデプロイ

### 認証情報・デプロイ変数の確認

```bash
test -n "$XSERVER_API_KEY" || { echo "missing:XSERVER_API_KEY"; exit 1; }
XSERVER_SSH_KEY="${XSERVER_SSH_KEY:-$HOME/.ssh/xserver_deploy.key}"
chmod 600 "$XSERVER_SSH_KEY" 2>/dev/null || true

# .xserver.json があれば jq で読み込む（jq なし・ファイルなしの場合は環境変数を使う）
if command -v jq >/dev/null && test -f .xserver.json; then
  SERVERNAME=${SERVERNAME:-$(jq -r '.servername // empty' .xserver.json)}
  DEPLOY_PATH=${DEPLOY_PATH:-$(jq -r '.deploy_path // empty' .xserver.json)}
  DEPLOY_SOURCE=${DEPLOY_SOURCE:-$(jq -r '.deploy_source // "."' .xserver.json)}
fi
test -n "$SERVERNAME" || { echo "missing:SERVERNAME"; exit 1; }
test -n "$DEPLOY_PATH" || { echo "missing:DEPLOY_PATH"; exit 1; }
DEPLOY_SOURCE=${DEPLOY_SOURCE:-"."}
```

macOS で Keychain を使っている場合: `export XSERVER_API_KEY=$(security find-generic-password -s "xserver-api" -w)`
Windows は 1-3 と同じセッションで設定済みの値をそのまま使う。CredentialManager / DPAPI の追加導入は行わない。

### rsync でデプロイ

`rsync` がなければ導入せず `scp` 簡易代替へ進む。`scp` もなければ SFTP / 管理画面アップロードをユーザーに確認して停止する。

```bash
command -v rsync >/dev/null || { echo "optional-missing:rsync"; exit 1; }

# dry-run で削除・更新対象を確認してからユーザーに示す
rsync -avzn --delete \
  -e "ssh -i $XSERVER_SSH_KEY -p 10022 -o StrictHostKeyChecking=accept-new" \
  --exclude '.git' --exclude 'node_modules' --exclude '.env' \
  --exclude '.DS_Store' --exclude '.xserver.json' \
  ${DEPLOY_SOURCE}/ "${SERVERNAME%%.*}@${SERVERNAME}:${DEPLOY_PATH}/"

rsync -avz --delete \
  -e "ssh -i $XSERVER_SSH_KEY -p 10022 -o StrictHostKeyChecking=accept-new" \
  --exclude '.git' --exclude 'node_modules' --exclude '.env' \
  --exclude '.DS_Store' --exclude '.xserver.json' \
  ${DEPLOY_SOURCE}/ "${SERVERNAME%%.*}@${SERVERNAME}:${DEPLOY_PATH}/"
```

### scp でデプロイ（rsync なし環境向けの簡易代替）

`rsync` の完全代替ではない。差分同期・除外ルール・dry-run・`--delete` 相当の削除同期は不可。`DEPLOY_SOURCE=./dist` など公開用ビルドディレクトリのみを指定し、初回デプロイや単純な上書き更新向けとする。差分制御・削除同期が必要な場合は `rsync` 環境または SFTP / 管理画面アップロードをユーザーに確認する。

```bash
command -v scp >/dev/null || { echo "missing:scp"; exit 1; }
case "$DEPLOY_SOURCE" in "."|"./"|"") echo "scp-unsafe:DEPLOY_SOURCE は ./dist など公開用ディレクトリを指定"; exit 1 ;; esac
for path in "$DEPLOY_SOURCE/.env" "$DEPLOY_SOURCE/.git" "$DEPLOY_SOURCE/.xserver.json"; do
  test ! -e "$path" || { echo "scp-unsafe:$path"; exit 1; }
done
# 転送対象をユーザーに示してから実行
scp -r -P 10022 -i "$XSERVER_SSH_KEY" -o StrictHostKeyChecking=accept-new \
  "${DEPLOY_SOURCE}/." "${SERVERNAME%%.*}@${SERVERNAME}:${DEPLOY_PATH}/"
```

既存ファイルの全削除が必要な場合は、削除方針をユーザーに確認してから進める。

### デプロイ後の確認

```bash
ssh -i "$XSERVER_SSH_KEY" -p 10022 "${SERVERNAME%%.*}@${SERVERNAME}" "ls -la ${DEPLOY_PATH}/"

curl -s "https://api.xserver.ne.jp/v1/server/${SERVERNAME}/error-log?domain=example.com&lines=20" \
  -H "Authorization: Bearer $XSERVER_API_KEY"
```

デプロイ完了後、必ずサイト URL をユーザーに表示する。
URL は `GET /v1/server/{servername}/domain/{domain}` の `url` フィールドで取得できる。

公開後は「修正したい点や追加で対応したいことはありますか？」と確認し、ユーザーの指示を待つ。

---

## API エンドポイント一覧

このスキルでカバーする API:

- API キー情報: 認証中の API キー情報（有効期限・権限種別）の取得
- サーバー情報: ホスト名 / IP アドレス / 利用可能 PHP・DB バージョン / ネームサーバー / 利用状況の取得
- リソースモニター: 指定日の CPU・メモリ・転送量時系列の取得
- 自動バックアップの取得・復元: バックアップ日一覧 / 取得・復元申込 / 申込履歴一覧・詳細
- ドメイン設定: 追加 / 設定変更 / 削除 / 初期化
- サブドメイン設定: 追加 / 設定変更 / 削除
- SSL 設定: 無料独自 SSL の ON / OFF
- DNS レコード設定: 取得 / 追加 / 変更 / 削除
- メールアカウント設定: 作成 / 設定変更 / 削除 / 転送設定
- 迷惑メールフィルタ: 取得 / 更新 / 受信側DMARC更新
- 自動応答設定: 一覧 / 詳細 / 追加 / 更新 / 削除
- SMTP認証の国外アクセス制限: 取得 / 更新
- DKIM設定: 一覧 / 詳細 / 更新（有効/無効）
- 送信側DMARC設定: 取得 / 更新
- SPF設定: 一覧 / 追加 / 更新 / 削除
- メール振り分け設定: 追加 / 削除
- WordPress 簡単インストール: インストール / 設定変更 / アンインストール
- WordPressセキュリティ設定: 一覧 / 更新
- MySQL 設定: DB / ユーザーの作成・削除 / アクセス権限の設定
- MySQLバックアップの取得・復元: 状態確認 / 取得・復元申込 / 申込履歴一覧・詳細
- FTP アカウント設定: 作成 / 設定変更 / 削除
- Cron 設定: 追加 / 設定変更 / 削除
- PHP バージョン設定: ドメインごとの確認・変更
- php.ini設定: 取得 / 更新 / 初期値へのリセット
- WAF設定: 一覧 / 更新
- Xアクセラレータ設定: 一覧 / 変更
- サーバーキャッシュ設定: 一覧 / 変更 / キャッシュ内容の削除
- ブラウザキャッシュ設定: 一覧 / 変更
- サイト転送設定: 一覧 / 追加 / 削除
- アクセス拒否設定: 一覧 / 追加 / メモ更新 / 削除
- XPageSpeed設定: 一覧 / 最適化機能の変更
- SSH 設定: 有効化 / 国外アクセス制限 / 公開鍵の登録（手動・自動生成）・有効化・削除
- アクセスログ / エラーログ: 取得

詳細なメソッド・パス・パラメータ・レスポンス仕様は OpenAPI 仕様（`https://developer.xserver.ne.jp/api/server/openapi.json`）を参照する。
次のいずれかに該当する場合も OpenAPI 仕様を参照する。

- ここに掲載がない機能を使いたい
- 想定通りのレスポンスにならず、スキル記載が古い可能性がある
- 「こんな API はあるか？」を確認したい

## レート制限

API にはリクエスト数・同時接続数のレート制限がある。
上限はプランや契約状態により異なるため固定値を前提にしない。
`X-RateLimit-*` / `X-RateLimit-Concurrent-*` ヘッダーで現在の制限値と残数を確認し、
HTTP 429 時は `Retry-After` 秒だけ待ってから再試行する。

---

## 複数契約の並行運用（補足）

Keychain ラベル・SSH キーファイル名・シェル環境変数 `XSERVER_API_KEY` を servername の先頭ラベル（例: `xs391946`）で分離する（例: `xserver-api-xs391946` / `~/.ssh/xserver_deploy_xs391946.key`）。プロジェクトディレクトリごとに `.xserver.json` を置けば `servername` を自動で読み取れる。

## セキュリティガイドライン

- API キーはセッション限定の環境変数で渡す。永続保存する場合は OS セキュアストレージのみを使い、平文ファイルへの保存は禁止
- 秘密鍵を一時ファイルに書き出す場合はパーミッション 600 必須、使用後は削除
- `.env`、`.xserver.json`、`~/.ssh/xserver_deploy*.key` はデプロイから除外
- 各種パスワードはサンプル値を使わず、十分に強力なものを生成して設定する
- 破壊的操作（次セクション参照）は実行前に必ずユーザー確認を取る

## 破壊的操作

DELETE 系・`POST /domain/{domain}/reset`・`delete_files: true`・
`forwarding_addresses: []` での転送クリア・`rsync --delete` は
実行前に対象と影響範囲（戻せないこと）をユーザーに表示し、明示的合意を得る。

WordPress 削除は DB / DBユーザー / Cron の削除フラグを個別確認する。

自動バックアップ / MySQLバックアップの `operation_type=restore` 申込は、サーバー上のデータを上書きし取り消し不可。申込前に対象日・対象範囲を表示して確認する。

サーバーキャッシュの内容削除（`DELETE .../server-cache/{domain}/cache`）は、実行前に対象ドメインを確認する。

## API 共通注意

- 日本語ドメインを path parameter に渡す場合は Punycode に変換する
- メールアドレスなど `@` を含む path parameter は URL encode する（例: `info%40example.com`）
- DELETE で requestBody が必要な場合は `curl -X DELETE ... -H "Content-Type: application/json" -d '...'` の形で送る

## トラブルシューティング

| 症状 | 対処 |
|------|------|
| `missing:XSERVER_API_KEY` | エージェントと同じターミナルで `1-3` の `read` → `export` を実行してから再開 |
| `missing:SERVERNAME` | API キー不正・期限切れ・IP 制限を確認。`jq` なしで進む場合は `SERVERNAME` を環境変数で設定 |
| `optional-missing:jq` | 導入する場合は [jq リリース](https://github.com/jqlang/jq/releases) から手動配置。導入しない場合は `SERVERNAME` など必要値を現在のセッションの環境変数で補う |
| `missing:jq-or-SERVERNAME` | `jq` を導入するか、`read -r -p "SERVERNAME: " SERVERNAME && export SERVERNAME` でこのセッションだけ値を設定して再開 |
| `optional-missing:rsync` | セットアップは継続可。ファイル転送は `scp` 節を使う |
| `scp-unsafe:*` | `scp` は除外できないため、`DEPLOY_SOURCE=./dist` など公開用ディレクトリを指定して再開 |
| `-MaskInput` / DPAPI / `PSCredential` エラー | PowerShell 固有機能を使わず、Git Bash の `read -r -s -p` 手順へ戻る |
| HTTP 401 | API キーの有効期限切れ。XServer アカウントで再発行し、同じシェルセッションで `export` し直す |
| HTTP 403（IPアドレス） | API キーに IP 制限が設定されている。許可IPリストに現在のIPを追加 |
| ドメイン所有権確認エラー | `domain_validation_token` で TXT レコード `_xserver-verify.{domain}` を設定し DNS 反映後に再実行 |
| SSL `failed_nameserver` | 当サービスのネームサーバー利用を希望する場合は ns1～ns5.xserver.jp への変更を案内。外部 DNS を維持したい場合は API ではなくサーバーパネルから無料 SSL 設定を案内 |
| SSH 接続エラー | `GET /v1/server/{servername}/ssh` で SSH が有効か、公開鍵が登録されているか確認。ポートは 10022 |
| HTTP 429 | レート制限超過。1 秒以上の間隔を空けてリトライ |

## 認証情報の管理

ローカルに永続保存した API キー・秘密鍵の確認・削除は OS 標準コマンドで行う
（macOS: `security find-generic-password` / `delete-generic-password`、
Windows: DPAPI や Credential Manager を利用した場合は該当ツールの削除手順、Linux: `secret-tool lookup` / `clear`、`pass`）。
ラベルは `xserver-api` / `xserver-ssh-key` で操作する。

サーバー側に登録済みの公開鍵は `GET /v1/server/{servername}/ssh/key` で一覧、
`DELETE /v1/server/{servername}/ssh/key/{key_id}` で削除する。
