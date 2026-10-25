# Tailwind CSS レビュールール

## 必須チェック（優先）

### クラス順序

- クラスが論理的な順序に従っているか（Layout → Box model → Typography → Visual → Interactive → Misc）
- 関連ユーティリティがグループ化されているか（flex系、text系 等）
- 同一プロパティを暗黙に上書きする重複ユーティリティがないか

```
// Good
"flex items-center gap-4 p-6 text-lg font-bold text-primary bg-white rounded-lg shadow-md hover:bg-gray-50 transition-colors"

// Bad (random order)
"hover:bg-gray-50 text-lg flex shadow-md p-6 font-bold bg-white rounded-lg items-center gap-4"
```

### デザイントークン

- プロジェクト定義のカラートークンを優先しているか（Tailwindデフォルトより）
- プロジェクト定義の spacing/sizing トークンがあれば使っているか
- セマンティックトークン（`text-primary`, `bg-foreground`）をプリミティブ（`text-blue-950`, `bg-neutral-900`）より優先しているか
- カスタムフォントトークン（`font-base`, `font-montserrat` 等）が定義されていれば使っているか
- 任意値（`text-[13px]`, `w-[347px]`, `text-[#0074be]`）を避け、最寄りのトークンを使っているか
- CSS変数/テーマトークン経由でハードコード hex を排除しているか

```tsx
// Bad
<div className="text-[#0074be] bg-[#212121]">

// Good
<div className="text-primary bg-foreground">
```

### レスポンシブ設計

- モバイルファースト: ベースがモバイル → `sm:` → `md:` → `lg:` → `xl:` の順か
- デスクトップファースト（`max-*:`）を不要に使っていないか
- ブレークポイントがプロジェクト設定（カスタム定義がある場合）と整合しているか
- タッチターゲットがモバイルで最低44×44px（`min-h-11 min-w-11` 等）を確保しているか
- テキストが全ブレークポイントで読みやすいか（モバイルで小さすぎないか）
- スペーシングが比例的にスケールしているか（モバイルとデスクトップで同じ大きなpaddingを使っていないか）

```tsx
// Bad (desktop-first)
<div className="text-3xl md:text-xl sm:text-base">

// Good (mobile-first)
<div className="text-base sm:text-xl md:text-3xl">
```

### バリアント管理

**`tv()`（tailwind-variants）を使うべきとき:**
- コンポーネントが2つ以上のバリアント軸を持つ（size, color, state）
- 同じコンポーネントがpropsに応じて異なる見た目を持つ
- 複合バリアント（size × color の組合せ等）が必要

**`cn()`（class merging）を使うべきとき:**
- 単純な条件付きクラス切替
- 外部 className prop と内部クラスのマージ
- 一回限りの条件付きスタイリング

**チェック項目:**
- `tv()` が複数バリアント軸を持つコンポーネントに使われているか
- `cn()` が単純な条件付きマージに限定され、複雑なバリアントロジックに使われていないか
- `tv()` で `defaultVariants` が指定されているか
- バリアント間でクラスが競合していないか（複数バリアントが同じプロパティを設定）
- `compoundVariants` をネストした三項演算子の代わりに使っているか
- バリアントpropsが `VariantProps<typeof variants>` で型付けされているか

```tsx
// Bad: cn() で複数バリアント軸を条件分岐
<div className={cn(
  "base-styles",
  size === "sm" && "h-8 text-sm",
  size === "md" && "h-10 text-base",
  size === "lg" && "h-12 text-lg",
  variant === "primary" && "bg-blue-500",
  variant === "secondary" && "bg-gray-500",
)}>

// Good: tv() でバリアント管理
const styles = tv({
  base: "base-styles",
  variants: {
    size: { sm: "h-8 text-sm", md: "h-10 text-base", lg: "h-12 text-lg" },
    variant: { primary: "bg-blue-500", secondary: "bg-gray-500" },
  },
  defaultVariants: { size: "md", variant: "primary" },
});
```

### 検出シグナル

- `cn()` 内で3つ以上のバリアント軸を条件分岐 → `tv()` に移行すべき
- 任意値のハードコードが3箇所以上で繰り返し → トークン化すべき
- 同じブレークポイントで同じ値を繰り返し指定（`text-base sm:text-base`）→ 冗長
- `className` propを文字列結合で合成 → `cn()` を使うべき

## 推奨チェック

### アクセシビリティ

- インタラクティブ要素にフォーカススタイル（`focus-visible:ring-*` 等）があるか
- フォーカススタイルのコントラストが十分か
- `outline-none` に代替フォーカスインジケータがあるか
- `prefers-reduced-motion` を尊重しているか（`motion-reduce:` 等）
- 色だけで状態を示していないか（アイコン・テキスト・ボーダーを併用）
- 色コントラストが基準を満たしているか（通常テキスト4.5:1、大テキスト3:1）
- 非表示だがスクリーンリーダーに読まれるべきラベルに `sr-only` を使っているか
- インタラクティブ要素に適切なカーソル（`cursor-pointer`, `cursor-not-allowed`）があるか

```tsx
// Bad
<button className="outline-none">Click me</button>

// Good
<button className="focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary">Click me</button>
```

### パフォーマンス

- 過度な任意値がクラス再利用を妨げていないか
- `will-change-*` は実際にアニメーションする要素のみ、かつアニメーション後に除去しているか
- 静的要素に不要な `transform` / `filter` を付けていないか（新しいスタッキングコンテキストが生成される）
- アニメーションは `transform` / `opacity` を使い、`width` / `height` / `top` / `left` を避けているか
- 頻繁に再描画される要素に大きな `shadow` / `blur` を使っていないか
- 複雑な孤立コンポーネントで `contain-*` を検討しているか

### 保守性

- className文字列が120文字を超えていないか（超過時は `tv()` や変数に抽出）
- スペーシングスケールが一貫しているか（`gap-3` と `gap-[13px]` の混在を避ける）
- カラー値がデザインシステムと一致しているか（ad-hoc hex を避ける）
- 深いネストセレクタ（`[&>div>span>a]:text-blue-500`）を避け、マークアップを再構成しているか
- 条件付きクラスに `cn()` を使い、文字列補間を避けているか
- コンポーネントの `className` propを `cn()` でマージし、文字列結合していないか

```tsx
// Bad
<div className={`base-class ${active ? "bg-blue-500" : ""}`}>

// Good
<div className={cn("base-class", active && "bg-blue-500")}>
```

## アンチパターン

### 競合ユーティリティ

```tsx
// Bad: hidden が flex を上書き
"flex hidden items-center"

// Bad: 意図不明な同カテゴリ重複
"p-4 px-6"  // 意図的なら OK（px が水平方向を上書き）
```

### 冗長なレスポンシブ指定

```tsx
// Bad: 全ブレークポイントで同じ値
"text-base sm:text-base md:text-base"

// Good: 変わるときだけ指定
"text-base md:text-lg"
```

### インラインスタイルとTailwindの混在

```tsx
// Bad
<div className="flex items-center" style={{ marginTop: "20px" }}>

// Good
<div className="mt-5 flex items-center">
```

### `!important` の使用

```tsx
// Bad
"!text-red-500"

// Good: 詳細度の問題を根本から解決するか、適切なバリアントを使う
```

### `@apply` の濫用

- ユーティリティの集約や可読性目的で `@apply` を使っていないか
- 許容: マークアップにクラスを付与できない箇所（擬似要素、サードパーティ要素）のみ

## レビュー除外

- クラスの細かな並び順の好み（自動整形で吸収できる範囲）
- Tailwind設定ファイル自体の構成（本ルールの対象外）

## 出力テンプレ

- 位置: `file:line`（分かる範囲）
- 重要度: 重大 / 中 / 軽微
- 確度: 確定 / 推定 / 判定保留
- 現状:
- 問題:
- 修正案:

## 最小修正ガイド

- 任意値のハードコードはトークン（Tailwind設定 or CSS変数）へ集約
- 3軸以上の条件分岐は `cn()` → `tv()` へ移行
- className文字列が長い場合は `tv()` でバリアント抽出
- レスポンシブ指定は値が変わるブレークポイントのみ記述
- `!important` は詳細度の根本原因を解消して除去
- `@apply` はユーティリティファースト原則を損なわない範囲に限定

## 重大度ヒント

- 重大: トークン未使用でブランドカラー不整合、アクセシビリティのフォーカス欠落、レスポンシブ崩れ
- 中: バリアント管理の不備（`cn()` で複雑な分岐）、任意値の散在、デスクトップファースト設計
- 軽微: クラス順序の不統一、冗長なレスポンシブ指定、`contain-*` 未検討
