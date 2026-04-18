# アノテーション・カテゴリ詳細リファレンス

Figmaのアノテーション機能（ショートカット: Y）を使い、見た目だけでは伝わらない設計意図をAIに明示する。

## カテゴリ一覧

### @mcp-layout

配置・幅・余白・レスポンシブ挙動など、レイアウトの意図を記述する。

**記述例:**
- `position: absolute`
- `width: 100%`
- `max-width: 960px`
- `margin: 0 auto`
- `gap: 16px`
- `flex-direction: column` (モバイル時)

**用途:** Auto Layoutだけでは伝えきれない配置の意図を補完する。

---

### @mcp-style

色・文字・角丸・影など、スタイルやトークンの指定を記述する。

**記述例:**
- `color: #ffffff`
- `background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)`
- `border-radius: 8px`
- `box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1)`
- `font-weight: 700`
- `opacity: 0.8`

**用途:** Design Tokensでカバーしきれない個別のスタイル指定を補完する。

---

### @mcp-interaction

Hover / Press / Focus / Disabled など状態変化のルールを記述する。

**記述例:**
- `pointer-events: none`
- `hover: background-color: #0056b3`
- `focus: outline: 2px solid #4A90D9`
- `disabled: opacity: 0.5; cursor: not-allowed`
- `transition: all 0.2s ease`

**用途:** Figmaのプロトタイプ設定だけでは伝えきれないインタラクションの詳細を明示する。

---

### @mcp-role

要素の意味（button, card, nav等）やz-indexのレイヤー順を記述する。

**記述例:**
- `z-index: 100`
- `role: navigation`
- `role: button`
- `role: dialog`
- `role: banner`

**用途:** Figmaのレイヤー構造からは判別しにくい要素のセマンティクスを明示する。

---

### @mcp-accessibility

role / aria-label / tab順などアクセシビリティ情報を記述する。

**記述例:**
- `aria-label: "検索"`
- `aria-label: "メニューを開く"`
- `role: alert`
- `tabindex: 0`
- `aria-hidden: true`
- `aria-expanded: false`

**用途:** スクリーンリーダーやキーボードナビゲーションに必要な情報を明示する。

---

### @mcp-json

構造化JSONデータによる曖昧さゼロの定義。AIの推論・解釈の揺れを完全に排除する。

**設定方法:** Figmaアノテーションのカテゴリに `@mcp-json` を設定してから利用する。
**注意:** インデントはアノテーション内で反映されない（Figma仕様）。

#### 自然言語（推測）vs 構造化データ（指示）

**NG: 自然言語による曖昧な記述**
```
@mcp-json
画面内で中心となるコールトゥアクションボタンです。
```
→ AIが「中心」「コールトゥアクション」を推測で解釈する。

**OK: JSON構造による明確な定義**
```
@mcp-json
{"role":"button","variant":"primary-cta"}
```
→ AIは定義された意味だけをそのまま実装に変換する。

#### 具体例

**ボタンの定義:**
```json
{"role":"button","variant":"primary-cta","size":"lg"}
```

**カードの定義:**
```json
{"role":"card","layout":"horizontal","clickable":true}
```

**モーダルの定義:**
```json
{"role":"dialog","closable":true,"overlay":true,"z-index":1000}
```

**フォームフィールドの定義:**
```json
{"role":"input","type":"email","required":true,"validation":"email"}
```

---

## 複合パターン: z-index問題の解決

z-indexの重ね順はFigmaのレイヤー順だけでは伝わらない。
`@mcp-layout` と `@mcp-role` を組み合わせて明示する。

**例: モーダルオーバーレイ**
- `@mcp-layout`: `position: absolute`（または `position: fixed`）
- `@mcp-role`: `z-index: 100`

この組み合わせにより、AIは重ね順を推測せず明示的に指示された値を使用する。

---

## 使い分けガイド

| 状況 | 推奨カテゴリ |
|------|------------|
| 配置が特殊（absolute, fixed, sticky） | `@mcp-layout` |
| Figmaトークンにない個別スタイル | `@mcp-style` |
| ホバー・フォーカス等の状態変化 | `@mcp-interaction` |
| 要素のHTML的な意味・重ね順 | `@mcp-role` |
| スクリーンリーダー・キーボード操作 | `@mcp-accessibility` |
| 複雑なデザイン・推測されがちな仕様 | `@mcp-json` |
