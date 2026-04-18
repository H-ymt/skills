---
name: figma-design-tokens
description: "Figma デザイントークンの抽出・分類・一括作成ワークフロー。デザインノードからカラー（Variable/COLOR）、スペーシング・角丸・サイズ（Variable/FLOAT）、タイポグラフィ（Text Style）を収集し、ノイズ除去・グルーピング・命名をAIが提案してデザイナーが選択式で承認する。トリガー: (1) デザインからトークン体系を構築, (2) カラーやスペーシングを抽出してバリアブル化, (3) タイプランプを抽出して Text Style 化。前提: figma-use スキルを必ず先にロードすること。"
disable-model-invocation: false
---

# Figma Design Tokens — デザインからの抽出・一括作成ワークフロー

デザインノードからトークン（カラー・スペーシング・角丸・サイズ・タイポグラフィ）を抽出し、バリアブルまたは Text Style として体系化するスキル。

**前提:** `figma-use` スキルを先にロード。

**リファレンス:**
- バリアブルAPI: [`variable-patterns.md`](../figma-use/references/variable-patterns.md)
- バリアブル設計思想: [`wwds-variables.md`](../figma-use/references/working-with-design-systems/wwds-variables.md)
- Text Style API: [`text-style-patterns.md`](../figma-use/references/text-style-patterns.md)
- Text Style 設計思想: [`wwds-text-styles.md`](../figma-use/references/working-with-design-systems/wwds-text-styles.md)

## トークン種別と Figma での表現

| トークン種別 | Figma での表現 | 抽出元 |
|-------------|---------------|--------|
| カラー | Variable (COLOR) | SOLID fill/stroke |
| スペーシング | Variable (FLOAT) | Auto Layout の padding, itemSpacing |
| 角丸 | Variable (FLOAT) | cornerRadius |
| サイズ | Variable (FLOAT) | 固定幅・高さ（アイコン、ボタン高さ等） |
| タイポグラフィ | **Text Style** | テキストノードの font, size, lineHeight 等 |

タイポグラフィは複合値（font + size + weight + lineHeight + letterSpacing）なので、単一のバリアブルでは表現できない。**Text Style として作成する。**

## 基本方針: すべての確認を選択式にする

デザイナーにトークン命名やグルーピングの自由記述を求めてはならない。これはデザインシステム設計の専門知識が必要な判断であり、通常のWebデザイナーの業務範囲外である。

**AIが根拠付きで提案 → デザイナーが選択肢から選ぶ** の形を徹底する。

### 禁止パターン

```
❌「トークン化すべきですか？」（自由記述を誘発する）
❌「これらの方針を教えてください」（開放型の質問）
❌「どうしますか？」（選択肢がない）
```

### 正しいパターン

```
✅ #cbe9ff (27箇所、見出し背景):
   → A: トークン化する（名前: heading/bg）
   → B: トークン化しない（個別の装飾として扱う）

✅ ブルー中間色 #3d6fc0 / #4080c0 / #648ccd (グラフ装飾):
   → A: すべて個別トークン化（graph/blue-1, graph/blue-2, graph/blue-3）
   → B: 代表色1つに統合してトークン化
   → C: グラフ専用のためトークン化しない
```

**すべての確認項目に A/B/C... の選択肢を付けること。** AI が最も妥当と考える選択肢に「推奨」と付記してよい。

## ワークフロー

```
1. 調査  → 既存バリアブル・Text Style・コードベースのトークン確認
2. 抽出  → デザインノードから値を収集（→ references/extract-values.md）
3. 分類  → ノイズ自動除去 → 近似値統合 → グルーピング → AI が命名候補を生成
4. 確認  → 選択式でユーザー承認
5. 作成  → バリアブル: バッチ 10〜15個/回、Text Style: 5〜10個/回
6. 検証  → 読み戻しで全件確認
```

必要なトークン種別だけ抽出する。全種別を一度に扱う必要はない。

**スコープ: 出力先は Figma のみ。** コードベース（CSS, Tailwind, JSON 等）への変更は一切行わない。

## Step 1: 調査

Figma 上の既存トークンを確認する。
- 既存バリアブルの確認（→ `variable-patterns.md`「Discovering Existing Variables」）
- 既存 Text Style の確認（→ `text-style-patterns.md`「Listing Text Styles」）
- 既にトークンがある場合、その命名規則・グルーピングに合わせる

### コードベース参照（オプション — ユーザーが明示的に求めた場合のみ）

ユーザーが「コードに合わせて」等と指示した場合のみ、以下を**命名の参考として読み取る（変更は行わない）**:
- CSS変数定義（`--color-*`, `--spacing-*` 等）
- Tailwind設定（`tailwind.config.*`）
- デザイントークンJSON

**コードベースの有無を聞かない。参照指示がなければスキップし、一般的なデザインシステムの命名規則で提案する。**

## Step 2: 抽出

抽出スニペットは [`references/extract-values.md`](references/extract-values.md) を参照。

## Step 3: 分類・命名

### 自動処理（ユーザー確認不要）

**COLOR:**
| 処理 | 判定 |
|------|------|
| ガイドライン赤の除外 | `#ff0000` でノード名に "guide" 含む |
| デバッグストロークの除外 | COMPONENT_SET の stroke のみに出現 |
| 近似色の統合候補検出 | RGB各チャンネルの差が 5/255 以内 |

**FLOAT:**
| 処理 | 判定 |
|------|------|
| 端数の丸め | 7.98 → 8 等の浮動小数点誤差を補正 |
| 極端な値の除外 | 角丸 9999（完全丸）は `round/full` として特別扱い |

**タイポグラフィ:**
| 処理 | 判定 |
|------|------|
| 同一スタイルの重複検出 | font + size + weight + lineHeight が完全一致 → 統合候補 |
| フォント名の正規化 | 同一フォントの表記揺れ（"Semi Bold" vs "SemiBold"）を検出 |

### ユーザー確認が必要なもの

**COLOR:**
- 画像マスクの背景色、SVGアイコンの塗り色
- 近似色の統合判断（自動検出後の最終判断）
- 使用回数が極端に少ない色（1-2箇所のみ）

**FLOAT — スケール外れ値の検出:**

抽出した FLOAT 値が一般的なスケール（4の倍数: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 等）から外れている場合、**意図的かどうかをデザイナーに確認する**。

検出ルール:
- 4の倍数でない値（例: 13px, 15px, 7px）
- 他の抽出値と近いが微妙に異なる値（例: 15px が 1箇所だけ、16px が多数）
- 使用回数が極端に少ない値（1-2箇所のみ）

提示時は「間違い」ではなく **意図確認** として聞く:

```
⚠️ スケール外れ値の確認:
  - spacing 13px (2箇所: Card/Inner, List/Item)
    → A: 意図的 — そのまま作成
    → B: 12px に修正（最寄りのスケール値）
    → C: 16px に修正
    → D: トークン化しない（個別の例外として扱う）
```

**修正を選んだ場合、Figma上のデザインノードも修正するかを追加で確認する。**

**タイポグラフィ — 不整合の検出:**

タイプランプとして整理する際、以下の不整合を検出してデザイナーに確認する:

- 一般的でないフォントサイズ（例: 15px — 14 か 16 が標準的）
- lineHeight がノード間で不統一（同じ fontSize なのに異なる lineHeight）
- 1箇所しか使われていないフォント/ウェイトの組み合わせ

```
⚠️ タイポグラフィの確認:
  - fontSize 15px (1箇所: Card/Description)
    → A: 意図的 — そのまま Text Style に含める
    → B: 14px に修正
    → C: 16px に修正
    → D: Text Style 化しない

  - "Inter Regular 16px" の lineHeight が不統一:
    - 24px (8箇所), 22px (1箇所: Footer/Note)
    → A: すべて 24px に統一
    → B: 別の Text Style として分ける
    → C: 22px のノードだけ修正しない
```

### AI が命名候補を生成する際のルール

1. **既存トークンがある場合** → その命名パターンに従う
2. **コードベースにトークンがある場合** → コード側の命名に揃える
3. **どちらもない場合** → 以下の一般規則で提案:

| 種別 | 命名例 |
|------|--------|
| COLOR（プリミティブ） | `blue/500`, `neutral/100` |
| COLOR（セマンティック） | `primary/default`, `surface/background` |
| スペーシング | `spacing/xs`, `spacing/sm` or `spacing/4`, `spacing/8` |
| 角丸 | `radius/sm`, `radius/md`, `radius/full` |
| サイズ | `size/icon-sm`, `size/button-height` |
| タイポグラフィ | `Heading/XL`, `Heading/LG`, `Body/MD`, `Body/SM`, `Caption/MD` |

グルーピングは `/` 区切り。

## Step 4: 確認（選択式）

ユーザーへの提案は **すべて選択式** で行う。自由記述を求めない。

### 提示フォーマット例（カラー）

```
📦 コレクション名: 「Colors」(Y / 別名を入力)
🎨 モード: Light / Dark の2モード構成 (Y / N)

┌────┬──────────────────┬─────────┬──────────────┐
│ #  │ 名前             │ Hex     │ 使用箇所例   │
├────┼──────────────────┼─────────┼──────────────┤
│ 1  │ primary/default  │ #3366ff │ CTA, Link    │
│ 2  │ neutral/900      │ #1a1a2e │ Header, Text │
└────┴──────────────────┴─────────┴──────────────┘

全体OKなら「OK」、個別修正があれば番号で指定。
```

### 提示フォーマット例（スペーシング）

```
📦 コレクション名: 「Spacing」(Y / 別名を入力)

┌────┬──────────────┬───────┬──────────────────────┐
│ #  │ 名前         │ 値    │ 主な使用箇所         │
├────┼──────────────┼───────┼──────────────────────┤
│ 1  │ spacing/xs   │ 4     │ itemSpacing (12箇所) │
│ 2  │ spacing/sm   │ 8     │ padding, gap         │
│ 3  │ spacing/md   │ 16    │ padding (多数)       │
└────┴──────────────┴───────┴──────────────────────┘
```

### 提示フォーマット例（タイポグラフィ）

```
🔤 以下の Text Style を作成します:

┌────┬──────────────┬───────────────┬──────┬────────┬──────────────┐
│ #  │ 名前         │ フォント      │ Size │ Weight │ Line Height  │
├────┼──────────────┼───────────────┼──────┼────────┼──────────────┤
│ 1  │ Heading/XL   │ Inter         │ 32   │ Bold   │ 40px         │
│ 2  │ Heading/LG   │ Inter         │ 24   │ Bold   │ 32px         │
│ 3  │ Body/MD      │ Inter         │ 16   │ Regular│ 24px         │
│ 4  │ Body/SM      │ Inter         │ 14   │ Regular│ 20px         │
│ 5  │ Caption/MD   │ Inter         │ 12   │ Medium │ 16px         │
└────┴──────────────┴───────────────┴──────┴────────┴──────────────┘

全体OKなら「OK」、個別修正があれば番号で指定。
```

## Step 5: 作成の注意

### バリアブル（COLOR / FLOAT）
- 1回の `use_figma` で 10〜15個ずつ作成（大量一括はタイムアウトリスク）
- スコープは型に応じて適切に設定（→ `variable-patterns.md` § Variable Scopes）
- **COLOR と FLOAT は別コレクションにすることが多い**（モード要件が異なる）。ユーザーに確認する
- エイリアス構築が必要な場合は、プリミティブ → セマンティックの順（→ `wwds-variables.md` § Aliasing）
- Code Syntax はコードベースが確定してから設定する。作成時には不要

### Text Style（タイポグラフィ）
- 1回の `use_figma` で 5〜10個ずつ作成（フォントロードが必要なため少なめ）
- **フォントは作成前に必ずロードする**: `await figma.loadFontAsync({ family, style })`
- `lineHeight`, `letterSpacing` はオブジェクト形式（→ `wwds-text-styles.md` § lineHeight and letterSpacing format）
- `setBoundVariable` は headless モードで使えない。バリアブルバインドが必要なら手動で後から設定（→ `wwds-text-styles.md` § Variable bindings）
- 作成後、対応するテキストノードに `textStyleId` を適用するかをユーザーに確認する
