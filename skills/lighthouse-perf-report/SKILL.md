---
name: lighthouse-perf-report
description: "Lighthouse CI によるWebサイトのパフォーマンス計測・比較レポート作成ワークフロー。プロジェクト初期化（lighthouserc 設定生成）、計測実行、結果の JSON からスコア抽出、before/after 比較レポート生成を一貫して行う。トリガー: (1) サイトのパフォーマンスを計測したい, (2) リニューアル前後の比較をしたい, (3) Lighthouse CI のセットアップ, (4) Core Web Vitals の計測, (5) パフォーマンスレポートを作成したい。"
---

# Lighthouse パフォーマンス計測・比較レポート

Lighthouse CI でサイトのパフォーマンスを定量計測し、before/after 比較レポートを生成するワークフロー。

## ワークフロー

```
1. プロジェクト初期化  →  scripts/init_project.sh
2. before 計測         →  LHCI_PHASE=before npm run lhci:all
3. サイト改修
4. after 計測          →  npm run lhci:all（デフォルトで after）
5. 結果抽出・比較      →  scripts/extract_scores.js
6. レポート作成        →  references/report-template.md をベースに作成
```

## 1. プロジェクト初期化

```bash
bash <skill-dir>/scripts/init_project.sh <project-dir> <url1> [url2] ...
```

生成物:
- `package.json` — `@lhci/cli` 依存、`lhci:mobile` / `lhci:desktop` / `lhci:all` スクリプト
- `lighthouserc.mobile.cjs` / `lighthouserc.desktop.cjs` — 各3回計測、filesystem 出力
- `lhci/{before,after}/{mobile,desktop}/` ディレクトリ

初期化後: `cd <project-dir> && npm install`

## 2. 計測実行

環境変数 `LHCI_PHASE` で出力先を切り替える（デフォルト: `after`）。

```bash
# before 計測
LHCI_PHASE=before npm run lhci:all

# after 計測（デフォルト）
npm run lhci:all

# 個別実行
npm run lhci:mobile   # mobile のみ
npm run lhci:desktop  # desktop のみ
```

各ページ3回計測、結果は `manifest.json` + 個別レポート（HTML/JSON）として保存される。

### 計測条件

| | モバイル | デスクトップ |
|---|---|---|
| ネットワーク | Simulated Slow 4G（RTT 150ms, 1.6Mbps） | Simulated（RTT 40ms, 10Mbps） |
| CPU | 4x slowdown | なし |
| 画面 | 360×640 | 1350×940 |

> これらは Lighthouse デフォルト設定。lighthouserc の `settings` でカスタマイズ可能。
> CI 環境では `--chrome-flags="--headless --no-sandbox"` が必要な場合がある。

## 3. 結果抽出

```bash
# 単体表示
node <skill-dir>/scripts/extract_scores.js ./lhci/before/mobile

# before/after 比較
node <skill-dir>/scripts/extract_scores.js ./lhci/after/mobile --compare ./lhci/before/mobile
```

出力: Markdown テーブル（Performance / Accessibility / Best Practices / SEO / FCP / LCP / CLS / TBT / SI）。
比較モードでは差分と改善率も出力。

**仕組み**: manifest.json から各 URL の全 run の JSON レポートを読み、中央値を算出。

## 4. レポート作成

[`references/report-template.md`](references/report-template.md) をベースに、`extract_scores.js` の出力を貼り付けて完成させる。

所見セクションでは以下を分析:
- Performance が低い場合 → LCP の主因（画像、フォント、サーバー応答）を特定
- Accessibility → alt属性、コントラスト、フォームラベルの不備を列挙
- 改善率の計算: `((After - Before) / Before) × 100`

## Core Web Vitals 閾値

| 指標 | Good | Needs Improvement | Poor |
|------|------|-------------------|------|
| LCP | ≤ 2.5s | ≤ 4.0s | > 4.0s |
| INP | ≤ 200ms | ≤ 500ms | > 500ms |
| CLS | ≤ 0.1 | ≤ 0.25 | > 0.25 |

> **INP はラボ計測では取得不可**（実ユーザー操作が必要）。本ワークフローでは TBT（Total Blocking Time）をプロキシ指標として使用する。TBT が低ければ INP も良好な傾向がある。実測データが必要な場合は CrUX（Chrome User Experience Report）や PageSpeed Insights の Field Data を参照。

## 一般的な目標値

| 指標 | 目標 |
|------|------|
| Performance | 90+ |
| Accessibility | 95+ |
| Best Practices | 90+ |
| SEO | 95+ |
| FCP | ≤ 1,800ms |
| SI (Speed Index) | ≤ 3,400ms |
