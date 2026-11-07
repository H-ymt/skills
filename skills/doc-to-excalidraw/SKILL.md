---
name: doc-to-excalidraw
description: Markdown やドキュメントの文章を、Excalidraw の横長ボード（またはスライド）にするスキル。見出しごとに列を分け、本文はテキスト中心、図解は分岐や組み合わせなど必要な箇所だけ。アイコンは既定で Lucide、製品のロゴは SVG Logos を使う（「アイコンは〜で」「ロゴは〜で」で変更できる）。フォントは既定で Excalifont（「フォントは〜を使用」で変更できる）。「この文書を Excalidraw にして」「スライドの代わりに横長で」「ガイドラインを図にして」「.excalidraw にまとめて」といった指示でトリガーする。構成図やアーキテクチャ図を描く場合は excalidraw:draw を使い、このスキルは使わない。
---

# 文書 → Excalidraw

文章を、1 枚の Excalidraw で読めるボードにする。スライドの代わりに、横に長く並べて使う。

**リファレンス:** [`references/spec-schema.md`](references/spec-schema.md)（内容 JSON の仕様）、[`references/example-spec.json`](references/example-spec.json)（動く例）

## レイアウト

| `--layout` | 出力 | 使いどころ |
|---|---|---|
| `board`（既定） | 見出しごとの列を横に並べる。枠なし | 1 枚で全体を読む、共有する |
| `slide` | 見出しごとに 16:9 の領域を作る（枠線なし、淡い背景）。フォントを拡大 | 1 枚ずつ区切って見せる |

指定がなければ `board` にする。「スライド」「発表」と言われたら `slide` にする。

## フォント

既定は Excalifont。ユーザーが「フォントは〜を使用」と指定したら、`--font` で切り替える。

| `--font` | フォント |
|---|---|
| `excalifont`（既定） | Excalifont |
| `virgil` | Virgil（旧・手書き風） |
| `nunito` | Nunito |
| `comic-shanns` | Comic Shanns |
| `liberation-sans` | Liberation Sans |

- 日本語の文字は、どのフォントでも代替フォントで表示される（Excalidraw のフォントに日本語の字形はない）。
- 表にない名前を指定されたら、近いものを提案して確認する。

## アイコンとロゴ

見出しには、アイコンかロゴを 1 つ付ける。取得先は [Iconify](https://icon-sets.iconify.design) にまとめている。

| 種類 | 使う場面 | 既定のセット | 切り替え |
|---|---|---|---|
| アイコン（`icon`） | 一般的な概念（設定、確認、キーボードなど） | `lucide`（[Lucide](https://lucide.dev/icons)） | `--icon-set <prefix>` |
| ロゴ（`logo`） | 見出しが特定の SaaS・OSS・製品の話のとき | `logos`（[SVG Logos](https://icon-sets.iconify.design/logos/)、カラー） | `--logo-set <prefix>` |

- ユーザーが「アイコンは Tabler で」「ロゴは Simple Icons で」のように指定したら、`--icon-set tabler` や `--logo-set simple-icons` で既定のセットを切り替える。
- 1 つの見出しだけ別のセットにしたいときは、内容 JSON に `prefix:name`（例: `"logo": "devicon:react"`）と書く。
- よく使うセット: アイコンは `lucide` `tabler` `heroicons` `phosphor`、ロゴは `logos`（カラー）`simple-icons`（単色）`devicon`。
- 見出しのロゴは、ワードマーク（`logos:cloudflare`）ではなくシンボル（`logos:cloudflare-icon`）を選ぶ。見出しの文字と名前が重なるため。
- 名前はセットごとに違う。見つからないとエラーになるので、Iconify で名前を確認して直す。
- ロゴの色や形は変えない。ロゴの自作やトレースもしない。

## ステップ1: 内容を分ける

元の文書を読み、内容 JSON にまとめる。判断は次の 3 つ。

1. **列（スライド）の区切り**: 見出し（`##`）単位。短い節は 1 つの列に縦積みする（`board`）。
2. **本文**: 原文をほぼそのまま使う。要約して意味を変えない。各項目に、原文の要点を 1 行にした `lead` を付ける。
3. **図解にする箇所**: 文章だけでは構造が伝わりにくい箇所に限る。使える型は 2 つ。
   - `branch`: 条件で 2 つに分かれる（例: 設定の有無で挙動が変わる）
   - `combine`: 2 つを組み合わせて 1 つにする（例: 自動と手動の併用）
   - 当てはまらなければ、図解は入れない。無理に作らない。

frontmatter がある場合、`title` を先頭の `hero` セクションの見出しに、`description` を `subtitle` に使う。

## ステップ2: 内容 JSON を書く

スクラッチパッドに書く。形式は [`spec-schema.md`](references/spec-schema.md) に従う。

- 見出しごとに、内容が想像できるアイコン（例: `keyboard`, `palette`）か、製品のロゴ（例: `cloudflare-icon`）を選ぶ。
- `\n` で改行を指定できるのは、図解の箱の文字だけ。本文は自動で折り返される。

## ステップ3: 生成する

```bash
node scripts/build.mjs <spec.json> <out.excalidraw> [--layout board|slide] [--font <名前>] [--icon-set <prefix>] [--logo-set <prefix>]
```

- Node.js 24 以上。アイコンとロゴは初回に Iconify API から取得し、一時ディレクトリにキャッシュする（ネットワークが必要）。
- 出力先の指定がなければ `~/Downloads/` に置く。ファイル名は文書の題名の kebab-case にする。
- `slide` で「収まらない」警告が出たら、そのセクションを 2 つに分けて再生成する。

## ステップ4: 確認する

1. エラーや警告が出ていないこと。
2. 生成した JSON を `JSON.parse` で読めること。
3. **見た目は、ユーザーに Excalidraw で開いて確認してもらう。** Excalifont とアイコンは、Excalidraw 上でしか正しく表示されない。プラグイン同梱の `export.mjs` は画像と Excalifont に対応していないため、SVG・PNG の書き出しには使わない。折り返しやはみ出しの簡易確認にだけ使える。

## デザインのルール

- フォントは、指定がなければ Excalifont（`fontFamily: 5`）。1 つのファイルにフォントを混ぜない。
- `board` は枠を付けない。列の区切りは余白だけで表す。
- 見出しと本文はテキスト中心にする。色は、図解の箱と見出しのアクセントに限る。
- 本文の文字サイズは 18px 以上（`slide` は拡大される）。灰色の文字も、背景に対して 4.5:1 以上を保つ。
- アイコンは 1 つのセットに揃える（既定は Lucide）。ロゴはロゴ用のセットから取る。

## 制約

- 折り返しは、全角を 1em、半角を 0.6em として見積もる。フォントの差で、行末が数文字ずれることがある。
- 図解は 2 種類だけ。フローチャートや構成図が必要なら `excalidraw:draw` を使う。
