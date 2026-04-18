# デザインからの値抽出スニペット

> Part of the [figma-design-tokens skill](../SKILL.md). デザインノードからカラー・スペーシング・角丸・サイズ・タイポグラフィを収集するスニペット。

## 1. カラー抽出（SOLID fill/stroke）

ページ名は実際の対象に置き換えること。

```js
const page = figma.root.children.find(p => p.name === "ページ名");
await figma.setCurrentPageAsync(page);

const colorMap = {};
function rgbToHex(c) {
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
}

page.findAll(n => {
  if ("fills" in n && Array.isArray(n.fills)) {
    for (const f of n.fills) {
      if (f.type === "SOLID" && f.visible !== false) {
        const hex = rgbToHex(f.color);
        if (!colorMap[hex]) colorMap[hex] = { count: 0, nodes: [], source: "fill" };
        colorMap[hex].count++;
        if (colorMap[hex].nodes.length < 3) colorMap[hex].nodes.push(n.name);
      }
    }
  }
  if ("strokes" in n && Array.isArray(n.strokes)) {
    for (const s of n.strokes) {
      if (s.type === "SOLID" && s.visible !== false) {
        const hex = rgbToHex(s.color);
        if (!colorMap[hex]) colorMap[hex] = { count: 0, nodes: [], source: "stroke" };
        colorMap[hex].count++;
      }
    }
  }
  return false;
});

return Object.entries(colorMap)
  .sort((a, b) => b[1].count - a[1].count)
  .map(([hex, info]) => ({ hex, ...info }));
```

### 出力例

```json
[
  { "hex": "#1a1a2e", "count": 47, "nodes": ["Header", "Card/Title", "Nav"], "source": "fill" },
  { "hex": "#e94560", "count": 23, "nodes": ["CTA Button", "Alert Icon"], "source": "fill" }
]
```

## 2. スペーシング抽出（padding, gap）

Auto Layout が設定されたフレームから padding と itemSpacing を収集する。

```js
const page = figma.root.children.find(p => p.name === "ページ名");
await figma.setCurrentPageAsync(page);

const spacingMap = {};

page.findAll(n => {
  if ("layoutMode" in n && n.layoutMode !== "NONE") {
    const values = [
      { value: n.paddingTop, prop: "paddingTop" },
      { value: n.paddingBottom, prop: "paddingBottom" },
      { value: n.paddingLeft, prop: "paddingLeft" },
      { value: n.paddingRight, prop: "paddingRight" },
      { value: n.itemSpacing, prop: "itemSpacing" },
    ];
    if ("counterAxisSpacing" in n && n.counterAxisSpacing != null) {
      values.push({ value: n.counterAxisSpacing, prop: "counterAxisSpacing" });
    }
    for (const { value, prop } of values) {
      if (value > 0) {
        const key = String(value);
        if (!spacingMap[key]) spacingMap[key] = { value, count: 0, props: {} };
        spacingMap[key].count++;
        spacingMap[key].props[prop] = (spacingMap[key].props[prop] || 0) + 1;
      }
    }
  }
  return false;
});

return Object.values(spacingMap)
  .sort((a, b) => b.count - a.count);
```

### 出力例

```json
[
  { "value": 16, "count": 84, "props": { "paddingTop": 22, "paddingBottom": 22, "itemSpacing": 40 } },
  { "value": 8, "count": 61, "props": { "itemSpacing": 35, "paddingLeft": 13, "paddingRight": 13 } }
]
```

## 3. 角丸抽出（cornerRadius）

```js
const page = figma.root.children.find(p => p.name === "ページ名");
await figma.setCurrentPageAsync(page);

const radiusMap = {};

page.findAll(n => {
  if ("cornerRadius" in n && typeof n.cornerRadius === "number" && n.cornerRadius > 0) {
    const key = String(n.cornerRadius);
    if (!radiusMap[key]) radiusMap[key] = { value: n.cornerRadius, count: 0, nodes: [] };
    radiusMap[key].count++;
    if (radiusMap[key].nodes.length < 3) radiusMap[key].nodes.push(n.name);
  }
  return false;
});

return Object.values(radiusMap)
  .sort((a, b) => b.count - a.count);
```

### 出力例

```json
[
  { "value": 8, "count": 124, "nodes": ["Card", "Input", "Badge"] },
  { "value": 16, "count": 45, "nodes": ["Modal", "Sheet"] },
  { "value": 9999, "count": 32, "nodes": ["Avatar", "Pill"] }
]
```

## 4. サイズ抽出（固定幅・高さ）

固定サイズのノードから幅・高さを収集する。アイコンサイズやボタン高さのパターン検出に有用。

```js
const page = figma.root.children.find(p => p.name === "ページ名");
await figma.setCurrentPageAsync(page);

const sizeMap = {};

page.findAll(n => {
  if ("width" in n && "height" in n) {
    const wFixed = !("layoutSizingHorizontal" in n) || n.layoutSizingHorizontal === "FIXED";
    const hFixed = !("layoutSizingVertical" in n) || n.layoutSizingVertical === "FIXED";

    if (wFixed && n.width > 0) {
      const w = Math.round(n.width);
      const key = `w:${w}`;
      if (!sizeMap[key]) sizeMap[key] = { dimension: "width", value: w, count: 0, nodes: [] };
      sizeMap[key].count++;
      if (sizeMap[key].nodes.length < 3) sizeMap[key].nodes.push(n.name);
    }
    if (hFixed && n.height > 0) {
      const h = Math.round(n.height);
      const key = `h:${h}`;
      if (!sizeMap[key]) sizeMap[key] = { dimension: "height", value: h, count: 0, nodes: [] };
      sizeMap[key].count++;
      if (sizeMap[key].nodes.length < 3) sizeMap[key].nodes.push(n.name);
    }
  }
  return false;
});

return Object.values(sizeMap)
  .sort((a, b) => b.count - a.count)
  .slice(0, 30);
```

### 出力例

```json
[
  { "dimension": "height", "value": 40, "count": 67, "nodes": ["Button", "Input", "Select"] },
  { "dimension": "width", "value": 24, "count": 52, "nodes": ["Icon/Check", "Icon/Arrow"] }
]
```

## 5. タイポグラフィ抽出（テキストノードのスタイル）

テキストノードの font, size, weight, lineHeight, letterSpacing の組み合わせを収集する。
**フォントロードが必要。** `getRangeFontName` 等は mixed content で失敗する場合があるため、`fontName` が symbol の場合はスキップする。

```js
const page = figma.root.children.find(p => p.name === "ページ名");
await figma.setCurrentPageAsync(page);

const styleMap = {};

page.findAll(n => {
  if (n.type === "TEXT" && typeof n.fontName !== "symbol") {
    const key = JSON.stringify({
      family: n.fontName.family,
      style: n.fontName.style,
      fontSize: n.fontSize,
      lineHeight: n.lineHeight,
      letterSpacing: n.letterSpacing,
    });
    if (!styleMap[key]) {
      styleMap[key] = {
        family: n.fontName.family,
        style: n.fontName.style,
        fontSize: n.fontSize,
        lineHeight: n.lineHeight,
        letterSpacing: n.letterSpacing,
        count: 0,
        nodes: [],
      };
    }
    styleMap[key].count++;
    if (styleMap[key].nodes.length < 3) styleMap[key].nodes.push(n.name);
  }
  return false;
});

return Object.values(styleMap)
  .sort((a, b) => b.count - a.count);
```

### 出力例

```json
[
  {
    "family": "Inter",
    "style": "Regular",
    "fontSize": 16,
    "lineHeight": { "value": 24, "unit": "PIXELS" },
    "letterSpacing": { "value": 0, "unit": "PIXELS" },
    "count": 84,
    "nodes": ["Card/Body", "List/Item", "Paragraph"]
  },
  {
    "family": "Inter",
    "style": "Bold",
    "fontSize": 24,
    "lineHeight": { "value": 32, "unit": "PIXELS" },
    "letterSpacing": { "value": -0.5, "unit": "PIXELS" },
    "count": 12,
    "nodes": ["Section/Title", "Hero/Heading"]
  }
]
```

### mixed content について

テキストノード内で複数のフォントやサイズが混在している場合（`fontName` が `figma.mixed`）、`typeof n.fontName !== "symbol"` のチェックでスキップされる。これらのノードは手動確認が必要な旨をユーザーに報告する。
