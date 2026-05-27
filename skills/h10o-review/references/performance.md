# performance review rules

## 必須チェック（優先）

### Core Web Vitals

- **LCP**（Largest Contentful Paint）: ヒーロー画像・見出しが `fetchpriority="high"` または preload されているか
- **CLS**（Cumulative Layout Shift）: 画像/動画/広告に `width` / `height` or `aspect-ratio` が設定されているか、フォント読み込みで FOUT によるズレが発生しないか
- **INP**（Interaction to Next Paint）: 静的解析では確定不可。以下の検出シグナルでリスクを推定する（確度は「推定」どまり）

### 検出シグナル

- `<img>` に `width` / `height` 未指定、または `aspect-ratio` なしで画像がある
- ヒーロー画像が `loading="lazy"` になっている（最初に見える画像に lazy は逆効果）
- `fetchpriority` が未設定で LCP 候補リソースが後回しになっている
- フォントに `font-display: swap` 以外（または未指定）が使われている
- **INP リスクシグナル（推定）**:
  - イベントハンドラ内で同期的な重いループ・DOM 操作を直接実行している
  - `setTimeout(fn, 0)` や `requestAnimationFrame` で逃がさず重い処理をハンドラ内で完結させている
  - React / フレームワーク環境で、操作起点の state 更新が連鎖して大量再レンダーを引き起こす構造がある
  - フォームバリデーション・検索・フィルタリングなどユーザー操作起点の処理が同期的にまとまって実行されている

## 必須チェック（リソース読み込み）

### ネットワーク・画像最適化

- 画像フォーマットが WebP / AVIF など次世代形式か（JPEG/PNG のみは要確認）
- `<img srcset>` / `<picture>` で画面サイズに応じた解像度切り替えがあるか
- `loading="lazy"` がスクロールアウト画像に適用されているか
- SVGアイコンをスプライト化せず毎回インラインで重複埋め込みしていないか

### フォント

- `@font-face` / Google Fonts に `font-display: swap` または `optional` が設定されているか
- 不要なウェイト・サブセットを読み込んでいないか（例: 日本語フォントの全文字読み込み）
- クリティカルフォントが `<link rel="preload">` されているか

### バンドル・スクリプト

- `<script>` に `defer` / `async` / `type="module"` が付いているか（レンダーブロック防止）
- 小機能のために大型ライブラリを全量インポートしていないか（例: lodash 全体、moment.js）
- 使用していないCSSが大量に配信されていないか（Tailwind なら PurgeCSS / content 設定）
- コード分割（dynamic import, React.lazy 等）が適切に行われているか

## 推奨チェック

- `preconnect` / `dns-prefetch` が外部リソース（API, フォント, CDN）に設定されているか
- Critical CSS がインライン化されているか、またはレンダーブロックが最小化されているか
- キャッシュ戦略（Cache-Control, immutable, Service Worker）が設定されているか
- サードパーティスクリプト（GA, タグマネージャー等）の読み込みが非同期かつ遅延されているか

## レビュー除外

- Lighthouse スコアの数値目標（環境依存のため断定不可）
- SSR/SSG/ISR の選択戦略（プロジェクト要件が必要）
- CDN・サーバー設定に起因する配信最適化

## 出力テンプレ

- 位置: `file:line`（分かる範囲）
- 重要度: 重大 / 中 / 軽微
- 確度: 確定 / 推定 / 判定保留
- 現状:
- 問題:
- 修正案:

## 最小修正ガイド

1. LCP リソースに `fetchpriority="high"` + `loading="eager"` を確認する
2. CLS 原因（寸法未指定画像・フォントズレ）を先に潰す
3. レンダーブロックスクリプトを `defer` / `async` に変える
4. 画像フォーマットと遅延読み込みを整える

## 判定保留の例

- ビルドツール・バンドラ設定が不明でコード分割状況を断定できない
- フォントのサブセット設定がビルド側にある場合、HTMLだけでは判断できない

## 重大度ヒント

- 重大: LCP 悪化が明確、ヒーロー画像に lazy、レンダーブロックスクリプトが複数
- 中: フォント未最適化・画像フォーマット旧式・バンドル肥大化
- 軽微: preconnect 未設定・キャッシュ設定の改善余地
