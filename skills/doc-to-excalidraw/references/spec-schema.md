# 内容 JSON の仕様

`scripts/build.mjs` が読む入力。動く例は [`example-spec.json`](example-spec.json)。

## 全体

```json
{ "columns": [ [Section, Section], [Section] ] }
```

- `columns`: カラムの配列。1 つ以上。
- 各カラムは Section の配列。1 つ以上。
- `board` では、カラムが横に並び、その中で Section が縦に積まれる。
- `slide` では、カラムの区切りは無視され、Section 1 つが 1 枚のスライドになる。

## Section

| キー | 型 | 必須 | 説明 |
|---|---|---|---|
| `heading` | string | ○ | 見出し。`slide` ではフレーム名にもなる |
| `icon` | string | ○ | [Lucide](https://lucide.dev/icons) のアイコン名（kebab-case） |
| `items` | Item[] | ○ | 本文 |
| `hero` | boolean |  | true で大きな見出し（題名用）にする |
| `subtitle` | string |  | `hero` のときだけ有効。見出し下のアクセント色の 1 行 |

## Item

次のいずれか 1 つの形にする。

### テキスト

```json
{ "lead": "要点の 1 行", "body": "説明文", "muted": false }
```

- `lead` と `body` は、どちらか一方だけでもよい。
- `muted: true` は補足用。灰色で表示する。

### 図解: `diagram`

```json
{ "diagram": { "type": "branch", "root": "prefers-reduced-motion",
  "left":  { "label": "no-preference", "text": "フェード\n＋ 移動" },
  "right": { "label": "reduce",        "text": "フェードだけ\n残す" } } }
```

```json
{ "diagram": { "type": "combine", "left": "自動チェック", "right": "手動の確認", "result": "組み合わせて確認" } }
```

- `branch`: 上の 1 つから、左右 2 つに分かれる。矢印に `label` を付ける。
- `combine`: 左右の 2 つが、下の 1 つにまとまる。
- 箱の文字は短くする。長いと箱からはみ出す。

### 補足: `callout`

```json
{ "callout": { "title": "見出し", "body": "説明文" } }
```

枠なしの補足。見出しと本文だけで表示する。

## レイアウトごとの扱い

- `board`: 図解を含むカラムと `hero` を含むカラムは、幅を 600px にする。それ以外は 560px。
- `slide`:
  - 図解か `callout` がある Section は、左に本文、右に図解を置く。末尾の `muted` だけの項目は、右に回る。
  - 図解も `callout` もなく、項目が 4 つ以上の Section は 2 段組みにする。
  - 下端がフレームに収まらないと、警告を出す。Section を分ける。
