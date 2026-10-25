---
name: image-optimize
description: Web画像の最適化と responsive 実装を行うスキル。sharp-cli を使って画像の生成・圧縮・WebP変換を行い、srcset / <picture> を使ったレスポンシブ対応のマークアップも書く。「画像を最適化して」「WebPに変換して」「srcsetで実装して」「画像のサイズを用意して」「Retina対応して」「<picture>で実装して」といった指示でトリガーする。ユーザーが画像ファイルやコンポーネントを指定したら必ずこのスキルを使う。
---

# 画像最適化スキル

Web向け画像の最適化（生成・圧縮・WebP変換）と、レスポンシブ対応のマークアップ実装を一貫して行う。

**リファレンス:** [`references/sharp-cli-options.md`](references/sharp-cli-options.md)

## 前提ツール

```bash
npx sharp-cli --version
```

使えない場合は `npm install -g sharp-cli` を案内する。

## ステップ1: 元画像の把握

まず元画像のサイズを確認する。

```bash
identify image.jpg
# または
npx sharp-cli --input image.jpg metadata
```

- 元画像の幅・高さ・ファイルサイズを把握する
- モバイル用とデスクトップ用で**構図が違う**かをユーザーに確認する

## ステップ2: 生成するサイズの決定

### 構図が同じ場合（srcset のみ）

表示幅に合わせた `w` 版を用意する。

| ファイル | 用途 |
|---|---|
| `image.webp` | 1x サイズ |
| `image@2x.webp` | 2x サイズ（Retina） |

基本は 1x と 2x の2枚にする。ブレークポイントをまたいで表示幅が大きく変わる場合（例: 全幅画像）は、必要に応じて中間サイズを足してよい。

### 構図が違う場合（アートディレクション）

モバイル・デスクトップそれぞれの元画像が必要。
モバイル用は元画像が十分な解像度（表示幅の2倍以上）かを確認する。
解像度が足りない場合は小さいサイズのみにする（拡大して画質を劣化させない）。

| ファイル | 用途 |
|---|---|
| `image-sm.webp` | モバイル用 |
| `image.webp` | デスクトップ 1x |
| `image@2x.webp` | デスクトップ 2x |

## ステップ3: 画像の生成・変換

### リサイズ + WebP変換（quality 80）

```bash
npx sharp-cli --input image.jpg --output image.webp --quality 80 resize 1440
npx sharp-cli --input image.jpg --output image@2x.webp --quality 80 resize 2880
```

### 元画像が未圧縮の場合はその場で圧縮する

```bash
npx sharp-cli --input image.jpg --output image.jpg --quality 80
```

### 不要ファイルの削除

- WebPに差し替えたJPEGは削除する
- コードから参照されていないファイルは削除する

## ステップ4: マークアップの実装

### 構図が同じ場合（`<img>` + srcset）

`<picture>` は不要。`w` descriptor で srcset を指定し、`loading="lazy"` の場合は `sizes="auto"` を先頭に付ける。

```html
<img
  src="image.webp"
  srcset="image.webp 1440w, image@2x.webp 2880w"
  sizes="auto, 100vw"
  alt=""
  width="1440"
  height="562"
  loading="lazy"
/>
```

`sizes` のフォールバック値（`auto,` の後）はレイアウトに合わせて記述する。全幅なら `100vw`、固定幅カラムなら `(min-width: 1024px) 340px, 100vw` のように書く。

**`sizes="auto"` は `loading="lazy"` のときだけ有効。** ブラウザはレイアウト計算後（スクロールで近づいたタイミング）に実際のレンダリングサイズを測定して最適な候補を選ぶ。未対応ブラウザはフォールバック値を使う。

### 構図が違う場合（`<picture>` + アートディレクション）

`<picture>` の `media` でモバイル／デスクトップを切り替える。`<img>` には `w` descriptor + `sizes="auto"` を付ける。

```html
<picture>
  <source media="(max-width: 640px)" srcset="image-sm.webp" />
  <img
    src="image.webp"
    srcset="image.webp 1440w, image@2x.webp 2880w"
    sizes="auto, 100vw"
    alt=""
    width="1440"
    height="562"
    loading="lazy"
  />
</picture>
```

### `loading` の選択

- ファーストビューの画像（LCP候補）→ `loading="eager"` + `fetchpriority="high"`（`sizes="auto"` は使わない）
- それ以外 → `loading="lazy"` + `sizes="auto"`

> JSX（React / Next.js 等）では属性名が `srcSet`・`fetchPriority` になる。Next.js なら `<Image>` コンポーネント（`next/image`）を使うと自動リサイズ・WebP変換・lazy load が組み込まれるため手動実装が不要になる。

## ファイル命名規則

- 1x は `{name}.webp`、2x は末尾に `@2x` を付けて `{name}@2x.webp` にする（例: `img-exterior.webp`、`img-exterior@2x.webp`）
- 中間サイズは幅の数値を付ける（例: `img-exterior-960.webp`）
- モバイル別構図は `-sm` suffix（例: `img-exterior-sm.webp`）
- typoに注意すること
