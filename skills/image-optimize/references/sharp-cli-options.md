# sharp-cli オプションリファレンス

Web向け画像最適化でよく使うオプションをまとめたリファレンス。

## 基本構文

```bash
npx sharp-cli -i <input> -o <output> [output options] <command> [command options]
```

## グローバルオプション

| オプション | 説明 |
|---|---|
| `-i, --input` | 入力ファイルパス（複数指定可） |
| `-o, --output` | 出力先ディレクトリまたは URI テンプレート |

## 出力オプション

| オプション | デフォルト | 説明 |
|---|---|---|
| `-q, --quality` | 80 | 品質（1〜100）。WebP・JPEG・AVIF に有効 |
| `-f, --format` | 入力と同じ | 出力フォーマット。`webp` / `avif` / `jpeg` / `png` など |
| `-p, --progressive` | — | プログレッシブスキャンを使用（JPEG / PNG） |

## resize コマンド

```bash
npx sharp-cli -i input.jpg -o out.webp -q 80 resize <width> [height]
```

| オプション | デフォルト | 説明 |
|---|---|---|
| `width` | — | 出力幅（px）。省略すると高さに合わせてスケール |
| `height` | — | 出力高さ（px）。省略すると幅に合わせてスケール |
| `--fit` | `cover` | リサイズ方法。`cover`（切り抜き）/ `contain`（余白）/ `fill`（引き伸ばし）/ `inside`（幅・高さの内側に収める）/ `outside`（幅・高さの外側に合わせる） |
| `--position` | `centre` | `cover` / `contain` 時のアンカー。`centre` / `top` / `right` / `bottom` / `left` / `entropy`（情報量が多い部分を残す）/ `attention`（顔・明るい部分を残す） |
| `--withoutEnlargement` | — | 指定サイズより小さい場合は拡大しない |
| `--withoutReduction` | — | 指定サイズより大きい場合は縮小しない |
| `--kernel` | `lanczos3` | リサイズアルゴリズム。品質重視なら `lanczos3`（デフォルト）、速度重視なら `nearest` |

### よく使うパターン

```bash
# 幅のみ指定（高さは自動スケール）
npx sharp-cli -i img.jpg -o img-1440.webp -q 80 resize 1440

# 高さのみ指定
npx sharp-cli -i img.jpg -o img-h800.webp -q 80 resize --height 800

# 幅・高さ両方指定してトリミング（fit: cover）
npx sharp-cli -i img.jpg -o img-thumb.webp -q 80 resize 400 400

# 幅・高さ内に収める（余白なし・比率維持）
npx sharp-cli -i img.jpg -o img-fit.webp -q 80 resize 800 600 --fit inside

# 拡大しない（元画像が小さい場合にそのまま出力）
npx sharp-cli -i img.jpg -o img-safe.webp -q 80 resize 2880 --withoutEnlargement
```

## フォーマット変換

```bash
# JPEG → WebP
npx sharp-cli -i img.jpg -o img.webp -q 80

# JPEG → AVIF（より高圧縮。エンコードが遅い）
npx sharp-cli -i img.jpg -o img.avif -f avif -q 60
```

### quality の目安

| 用途 | 推奨値 |
|---|---|
| WebP（写真） | 80 |
| WebP（図・イラスト） | 85〜90 |
| AVIF | 60〜70（WebP より低い値でも同等画質） |
| JPEG | 85 |

## メタデータ確認

```bash
npx sharp-cli -i img.jpg metadata
```

幅・高さ・フォーマット・ファイルサイズを確認できる。`identify`（ImageMagick）が使えない環境での代替手段。

## 複数ファイルの一括処理

glob でまとめて変換できる。

```bash
npx sharp-cli -i "src/images/*.jpg" -o dist/images/ -q 80 resize 1440
```

出力ファイル名は入力と同名（拡張子は `-f` で指定したフォーマットに変わる）。
