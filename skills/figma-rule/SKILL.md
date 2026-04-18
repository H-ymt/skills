---
name: figma-rule
description: "Figma MCP活用時のデザインファイル品質チェックと構造化ルール。Figmaデザインからコード実装する際に、レイヤー命名規則（PascalCase/camelCase/kebab-case）、Auto Layout必須化、アノテーション（@mcp-layout, @mcp-style, @mcp-interaction, @mcp-role, @mcp-accessibility, @mcp-json）の読み取り、Design Tokens活用、Data Cleanup確認を行う。Figma MCPでデザインを読み取った後、実装前にデザインファイルの構造品質を評価し、不足があればデザイナーにフィードバックする。figma-implement-designスキルと併用。"
---

# Figma Rule — デザインファイル構造化ガイドライン

viviON社「Figma MCPを活用するためのデザインハンドブック β版 Ver.0.1」に基づく。

## Overview

Figma MCPによるデザイン再現性の目標は **80%以上**。
そのために「AIが推測せず、同じ構造・同じ意図で実装できる状態」をデザインファイル側で作る。

ルールがない場合、AIは見た目から構造を推測し、意図しないdivネストや固定幅コードを生成する。
本ルールに沿ったデザインファイルであれば、AIの推測を排除し一貫した実装が可能になる。

## Scope

### 適用対象
- Figma MCPを利用して実装生成を行うUIデザイン
- 本番実装を前提とした画面・コンポーネント
- コーディング時は**セクション単位**でデザインを実装生成

### 適用外
- アイデア検討段階のラフ
- 見た目検証のみのデザイン
- MCP連携を前提としないデザイン作業
- 1画面分のページデザイン全体を一括実装生成
- ネイティブアプリ用のデザイン

### 段階的適用
すべてを一度に適用する必要はない。ステージ2 → ステージ3 へ段階的に適用する。

## デザインプロセスの3ステージ

| ステージ | 内容 | AIの理解度 |
|---------|------|-----------|
| 1 | ルールなし | ほぼ全ての要素を推測 |
| 2 | 構造と命名規則の統一 | コンポーネントの基本構造を認識 |
| 3 | Auto Layoutとアノテーション | レイアウト意図と要素の役割を理解 |

---

## STEP 1: 構造化の基礎

### 1-1. 命名規則

意味のあるsemantic命名を徹底する。曖昧な名前はAIの誤解を招く。

| 種類 | 用途 | 命名形式 | 例 |
|------|------|---------|-----|
| Component / Instance | UI部品の構造 | PascalCase | `ButtonPrimary`, `CardRestaurant` |
| Variant | 状態・バリエーション | camelCase | `primary`, `secondary`, `iconLeft` |
| Variable / Token | デザイン属性値 | kebab-case | `color-text-primary`, `radius-sm` |
| Frame | レイアウト構造 | PascalCase | `CardContainer`, `HeaderSection`, `Wrapper` |

**NGパターン（デフォルト名のまま）:**
- `Frame 1024`, `Group 5`, `Rectangle 2`, `Text`

**get_design_context で取得したデータに上記NGパターンが多い場合:**
→ デザイナーに命名の整理をフィードバックする

### 1-2. Auto Layout

全ての要素で Auto Layout を使用する。

- Frame の width/height に**固定値（Fixed）を使用しない**
- Auto Layout はレイアウトの意図をAIに正確に伝える唯一の方法
- Fixed はレスポンシブ崩壊の最大原因

**get_design_context で Fixed値が多い場合:**
→ デザイナーに Auto Layout への変更をフィードバックする

### 1-3. レスポンシブデザイン

レスポンシブデザインの再現性を高めるには、必要に応じて複数ブレークポイントのデザインを用意する。

- Desktop Design
- Tablet Design（必要に応じて）
- Mobile Design

プロンプトで「レスポンシブ実装してください」と指示する際、対応するFigmaデザインURLも提供する。

---

## STEP 2: アノテーション

見た目だけでは伝わらない設計意図をAIに正確に伝えるためにFigmaのアノテーション機能を使用する。

### 6つのアノテーション・カテゴリ

| カテゴリ | 用途 | 例 |
|---------|------|-----|
| `@mcp-layout` | 配置・幅・余白・レスポンシブ挙動 | `position: absolute` |
| `@mcp-style` | 色・文字・角丸・影・トークン指定 | `color: #ffffff` |
| `@mcp-interaction` | Hover/Press/Focus/Disabled状態変化 | `pointer-events: none` |
| `@mcp-role` | 要素の意味（button, card）・z-index | `z-index: 100` |
| `@mcp-accessibility` | role/aria-label/tab順 | `aria-label: "検索"` |
| `@mcp-json` | 構造化JSONデータによる曖昧さゼロの定義 | `{"role":"button","variant":"primary-cta"}` |

各カテゴリの詳細と具体例は `references/annotation-categories.md` を参照。

### アノテーション読み取り時のルール

1. get_design_context の結果にアノテーションが含まれる場合、そのカテゴリに応じて実装に反映する
2. `@mcp-json` は最も優先度が高い — JSON構造をそのまま実装の仕様として扱う
3. アノテーション内のインデントは反映されない（Figma仕様）
4. 推測されがちな複雑なデザインやインタラクションで特に重要

---

## STEP 3: クリーンアップ

### Data Cleanup ルール

ゴミレイヤーはAIに不要なdivを生成させる原因。以下を完全に削除する:

- **非表示レイヤー**（Propertyのfalseを利用した非表示は除く）
- **未使用レイヤー**
- **stroke: 0px** のようなゴミレイヤー
- **ネストしたFrame**は最小限にする

**get_design_context で不要レイヤーが多い場合:**
→ デザイナーにクリーンアップをフィードバックする

---

## Design Tokens

ルールに沿って作成された **Local Variables / Local Styles** を利用する。

### スペーシング階層（Local Variables例）

| 名前 | 値 |
|------|-----|
| sections | standard/16 |
| components | standard/12 |
| modules | standard/8 |
| elements | standard/4 |

### テキストスタイル（Local Styles例）

- Heading系（2xl: 32/125 など）
- regular系

**トークンを活用するメリット:**
- プロダクト全体のビジュアルが自動で統一される
- AIの推測が不要になる
- メンテナンス性が向上する

---

## 実装前チェックリスト

get_design_context でデータ取得後、実装に入る前に以下を確認する:

- [ ] レイヤー名がセマンティック（Frame 1024等のデフォルト名がないか）
- [ ] Component/InstanceがPascalCase命名か
- [ ] Auto Layoutが適用されているか（Fixed値が多くないか）
- [ ] 非表示・未使用レイヤーがクリーンアップされているか
- [ ] アノテーション（@mcp-*）が存在する場合、内容を確認したか
- [ ] Design Tokens（Local Variables/Styles）が適用されているか
- [ ] レスポンシブ用の複数ブレークポイントデザインが必要か

**問題が多い場合:** 実装前にデザイナーへフィードバックし、品質改善を依頼する。

---

## Figma以外で確認すべき仕様

Figmaデータだけでは完結しない情報がある。以下はFigma以外の資料で確認する:

### 要件書・詳細設計書
- FigmaのURL
- FIXデザイン
- ユーザーストーリー
- その機能を利用するときの体験
- エッジケース・異常系の大まかな挙動（ネットワークエラーの場合はダイアログ等）

### コンテキスト資料
- ビジュアル・アイデンティティ
- デザインシステムについての情報
- レスポンシブ対応方針
