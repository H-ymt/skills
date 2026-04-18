# サービスカタログ

運用ドキュメントに記載する頻出サービスのテンプレート情報です。
該当するサービスがあれば、このカタログを参考にセクションを生成します。

---

## ドメインレジストラ

### XDomain
- ステータスページ: なし
- 注意: 管理画面・アカウントは契約者に確認。更新が切れるとサイト全停止

### お名前.com
- ステータスページ: なし
- 注意: 自動更新設定を確認。whois 情報公開代行の設定も要確認

### Cloudflare Registrar
- ステータスページ: https://www.cloudflarestatus.com/
- 注意: Cloudflare DNS と一体管理。移管時は EPP コード取得が必要

---

## ホスティング / CDN

### Cloudflare Workers / Pages
- ステータスページ: https://www.cloudflarestatus.com/
- 管理画面: https://dash.cloudflare.com/
- 関連機能: Turnstile（CAPTCHA）、Zero Trust Access（アクセス制限）、DNS

### Vercel
- ステータスページ: https://www.vercel-status.com/
- 管理画面: https://vercel.com/dashboard
- 関連機能: Preview Deployments、Password Protection、Edge Config

### AWS（CloudFront + S3 / ECS 等）
- ステータスページ: https://health.aws.amazon.com/
- 管理画面: https://console.aws.amazon.com/

### さくらインターネット
- ステータスページ: https://help.sakura.ad.jp/notifications/
- 管理画面: https://secure.sakura.ad.jp/

---

## CMS

### microCMS
- ステータスページ: https://status.microcms.io/
- 管理画面: https://{{service-id}}.microcms.io/
- 注意: サービスが複数ある場合、それぞれ独立（メンバー招待もサービスごと）

### WordPress
- ステータスページ: なし（セルフホスト）
- 管理画面: https://{{domain}}/wp-admin/
- 注意: プラグイン・テーマの更新管理が必要

### Contentful
- ステータスページ: https://www.contentfulstatus.com/
- 管理画面: https://app.contentful.com/

### Newt
- ステータスページ: なし
- 管理画面: https://app.newt.so/

---

## メール送信

### Resend
- ステータスページ: https://resend-status.com/
- 管理画面: https://resend.com/overview
- 注意: ドメイン認証（SPF / DKIM）設定が必要

### SendGrid
- ステータスページ: https://status.sendgrid.com/
- 管理画面: https://app.sendgrid.com/
- 注意: ドメイン認証 + Link Branding 推奨

### Amazon SES
- ステータスページ: https://health.aws.amazon.com/
- 管理画面: AWS コンソール内

---

## ソースコード管理

### GitHub
- ステータスページ: https://www.githubstatus.com/
- 管理画面: https://github.com/{{org}}

### GitLab
- ステータスページ: https://status.gitlab.com/
- 管理画面: https://gitlab.com/{{group}}

---

## セキュリティ / CAPTCHA

### Cloudflare Turnstile
- 管理画面: Cloudflare ダッシュボード内 Turnstile セクション
- 料金: 無料

### reCAPTCHA (Google)
- 管理画面: https://www.google.com/recaptcha/admin
- 料金: Enterprise は従量課金、v2/v3 は無料

### hCaptcha
- 管理画面: https://dashboard.hcaptcha.com/
- 料金: 無料プランあり

---

## アクセス解析

### Google Analytics (GA4)
- 管理画面: https://analytics.google.com/
- 注意: 測定 ID（G-XXXXXXXXXX）の管理

### Plausible
- 管理画面: https://plausible.io/{{domain}}
- 注意: セルフホスト版の場合は URL が異なる

---

## 外部連携（例）

### OwnedMaker（求人情報）
- 注意: キャッシュにより反映まで最大 1 時間程度

### Instagram（SNS フィード）
- 注意: API トークンの有効期限管理が必要（長期トークンでも 60 日）
