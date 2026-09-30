#!/usr/bin/env node
// 内容 JSON（references/spec-schema.md）から .excalidraw を生成する。
//
// 使い方: node build.mjs <spec.json> <out.excalidraw> [--layout board|slide] [--font <名前>]

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ── 定数 ─────────────────────────────────────────────────
// Excalidraw の fontFamily ID
const FONTS = {
  excalifont: 5,
  virgil: 1,
  nunito: 6,
  "comic-shanns": 8,
  "liberation-sans": 9,
};
const INK = "#1e1e1e";
const SUB = "#495057";
const MUTED = "#5c6670";
const ACCENT = "#1971c2";
const SLIDE_BG = "#f8f9fa";
const COLORS = {
  blue: ["#e7f5ff", "#1971c2"],
  green: ["#ebfbee", "#2f9e44"],
  orange: ["#fff4e6", "#e8590c"],
  gray: ["#f1f3f5", "#495057"],
};
const ICON_CDN = "https://unpkg.com/lucide-static@latest/icons";
const ICON_CACHE = join(tmpdir(), "doc-to-excalidraw-icons");

// ── 引数 ─────────────────────────────────────────────────
const [specPath, outPath, ...flags] = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = flags.indexOf(name);
  return i >= 0 ? flags[i + 1] : fallback;
};
const LAYOUT = flag("--layout", "board");
const FONT_NAME = flag("--font", "excalifont");
const FONT = FONTS[FONT_NAME];
if (!specPath || !outPath || !["board", "slide"].includes(LAYOUT) || !FONT) {
  console.error(
    `使い方: node build.mjs <spec.json> <out.excalidraw> [--layout board|slide] [--font ${Object.keys(FONTS).join("|")}]`,
  );
  process.exit(1);
}

// slide はスクリーンで読むため、フォントと余白を拡大する
const SCALE = LAYOUT === "slide" ? 1.25 : 1;
const u = (v) => Math.round(v * SCALE);

// ── 要素の生成 ───────────────────────────────────────────
const elements = [];
const files = {};
const svgCache = new Map();
let seq = 0;
const nextId = (p) => `${p}-${++seq}`;
const rand = () => Math.floor(Math.random() * 2 ** 31);

const base = (type, x, y, width, height, extra = {}) => ({
  id: nextId(type),
  type,
  x,
  y,
  width,
  height,
  angle: 0,
  strokeColor: INK,
  backgroundColor: "transparent",
  fillStyle: "solid",
  strokeWidth: 1,
  strokeStyle: "solid",
  roughness: 1,
  opacity: 100,
  groupIds: [],
  frameId: null,
  roundness: null,
  seed: rand(),
  version: 1,
  versionNonce: rand(),
  isDeleted: false,
  boundElements: null,
  updated: 1,
  link: null,
  locked: false,
  ...extra,
});

// ── テキストの計測と折り返し（全角 = 1em、半角 = 0.6em で見積もる）──
const cw = (ch, fs) => (ch.charCodeAt(0) > 0x2e7f ? fs : fs * 0.6);
const tw = (s, fs) => [...s].reduce((a, c) => a + cw(c, fs), 0);
const NO_START = new Set([..."。、，．）」』】〕！？：；・ー)]}.,:;!?%"]);
const NO_END = new Set([..."（「『【〔([{"]);

function wrap(str, maxW, fs) {
  const out = [];
  for (const para of str.split("\n")) {
    const tokens = para.match(/[A-Za-z0-9_\-:.%/@+×'"=<>]+ ?|./gu) ?? [];
    let line = "";
    for (const t of tokens) {
      if (tw(line + t, fs) <= maxW || line === "" || NO_START.has(t[0])) {
        line += t;
        continue;
      }
      let carry = "";
      if (NO_END.has(line.at(-1))) {
        carry = line.at(-1);
        line = line.slice(0, -1);
      }
      out.push(line.trimEnd());
      line = carry + t;
    }
    out.push(line.trimEnd());
  }
  return out;
}

// fs は拡大前のサイズを渡す
function text(x, y, str, fs, color = INK, opts = {}) {
  const { maxW, align = "left", containerId = null, w: fixedW, h: fixedH } = opts;
  const F = u(fs);
  const lines = maxW ? wrap(str, maxW, F) : str.split("\n");
  const value = lines.join("\n");
  const w = fixedW ?? Math.max(...lines.map((l) => tw(l, F)));
  const h = fixedH ?? lines.length * F * 1.25;
  const el = base("text", x, y, w, h, {
    strokeColor: color,
    text: value,
    originalText: value,
    fontSize: F,
    fontFamily: FONT,
    textAlign: align,
    verticalAlign: containerId ? "middle" : "top",
    containerId,
    autoResize: true,
    lineHeight: 1.25,
  });
  elements.push(el);
  return { el, h };
}

function icon(name, x, y, size, color = ACCENT) {
  const svg = svgCache
    .get(name)
    .replace(/currentColor/g, color)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/width="24"/, `width="${size}"`)
    .replace(/height="24"/, `height="${size}"`);
  const fileId = `icon-${name}-${color.slice(1)}`;
  files[fileId] ??= {
    mimeType: "image/svg+xml",
    id: fileId,
    dataURL: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    created: 1,
  };
  elements.push(
    base("image", x, y, size, size, { fileId, status: "saved", scale: [1, 1], crop: null, roughness: 0 }),
  );
}

function box(x, y, w, h, label, fs, color) {
  const [bg, stroke] = COLORS[color] ?? COLORS.blue;
  const rect = base("rectangle", x, y, w, h, {
    backgroundColor: bg,
    strokeColor: stroke,
    strokeWidth: 2,
    roundness: { type: 3 },
  });
  elements.push(rect);
  const lines = label.split("\n");
  const tW = Math.max(...lines.map((l) => tw(l, u(fs))));
  const tH = lines.length * u(fs) * 1.25;
  const { el } = text(x + (w - tW) / 2, y + (h - tH) / 2, label, fs, INK, {
    align: "center",
    containerId: rect.id,
    w: tW,
    h: tH,
  });
  rect.boundElements = [{ type: "text", id: el.id }];
}

function arrow(x1, y1, x2, y2) {
  elements.push(
    base("arrow", x1, y1, Math.abs(x2 - x1), Math.abs(y2 - y1), {
      strokeWidth: 2,
      roundness: { type: 2 },
      points: [
        [0, 0],
        [x2 - x1, y2 - y1],
      ],
      lastCommittedPoint: null,
      startBinding: null,
      endBinding: null,
      startArrowhead: null,
      endArrowhead: "arrow",
    }),
  );
}

// ── 図解ブロック ─────────────────────────────────────────
const DIAGRAMS = {
  // 条件で 2 つに分かれる
  branch(cx, y, iw, d) {
    const rw = u(320);
    const rh = u(56);
    box(cx + (iw - rw) / 2, y, rw, rh, d.root, 20, "blue");
    const by = y + rh + u(84);
    const bw = (iw - u(40)) / 2;
    const bh = u(72);
    box(cx, by, bw, bh, d.left.text, 20, "green");
    box(cx + bw + u(40), by, bw, bh, d.right.text, 20, "orange");
    const mid = cx + iw / 2;
    arrow(mid - u(60), y + rh, cx + bw / 2, by);
    arrow(mid + u(60), y + rh, cx + bw + u(40) + bw / 2, by);
    text(cx + u(10), y + rh + u(20), d.left.label, 16, MUTED);
    text(cx + iw - u(10) - tw(d.right.label, u(16)), y + rh + u(20), d.right.label, 16, MUTED);
    return by + bh + u(36);
  },
  // 2 つを組み合わせて 1 つにする
  combine(cx, y, iw, d) {
    const bw = (iw - u(80)) / 2;
    const bh = u(64);
    box(cx, y, bw, bh, d.left, 22, "blue");
    box(cx + bw + u(80), y, bw, bh, d.right, 22, "orange");
    text(cx + bw + u(40) - tw("＋", u(28)) / 2, y + u(14), "＋", 28, INK);
    const cy = y + bh + u(56);
    arrow(cx + bw / 2, y + bh, cx + iw / 2 - u(40), cy);
    arrow(cx + bw + u(80) + bw / 2, y + bh, cx + iw / 2 + u(40), cy);
    box(cx + iw / 2 - u(140), cy, u(280), u(60), d.result, 22, "green");
    return cy + u(60) + u(32);
  },
};

// ── セクションの描画 ─────────────────────────────────────
const isSide = (it) => it.diagram || it.callout;

function renderItem(cx, y, iw, it) {
  if (it.diagram) return DIAGRAMS[it.diagram.type](cx, y, iw, it.diagram);
  if (it.callout) {
    y += text(cx, y, it.callout.title, 22, INK).h + u(8);
    return y + text(cx, y, it.callout.body, 18, SUB, { maxW: iw }).h + u(24);
  }
  if (it.lead) y += text(cx, y, it.lead, 22, INK, { maxW: iw }).h + u(6);
  if (it.body) y += text(cx, y, it.body, 18, it.muted ? MUTED : SUB, { maxW: iw }).h;
  return y + u(24);
}

const renderItems = (cx, y, iw, items) => items.reduce((yy, it) => renderItem(cx, yy, iw, it), y);

function renderHeading(cx, y, iw, sec) {
  if (sec.hero) {
    icon(sec.icon, cx, y, u(64));
    y += u(84);
    y += text(cx, y, sec.heading, 54, INK).h + u(16);
    if (sec.subtitle) y += text(cx, y, sec.subtitle, 26, ACCENT, { maxW: iw }).h + u(14);
    return y + u(34);
  }
  icon(sec.icon, cx, y, u(40));
  text(cx + u(56), y + u(2), sec.heading, 30, INK);
  return y + u(64);
}

// board: 1 セクションを 1 カラムに縦積みする
const renderSection = (cx, y, iw, sec) => renderItems(cx, renderHeading(cx, y, iw, sec), iw, sec.items);

// slide: 図解・補足があれば右、なければ 4 項目以上で 2 段組みにする
function renderSlideSection(cx, y, iw, sec) {
  const top = renderHeading(cx, y, iw, sec);
  const colGap = u(56);
  const colW = (iw - colGap) / 2;
  const last = sec.items.at(-1);
  // 図解・補足がある場合は、末尾の補足文（muted のみの項目）も右へ回して高さを揃える
  const hasSide = sec.items.some(isSide);
  const trailingNote = hasSide && last.muted && !last.lead && !isSide(last);
  const side = sec.items.filter((it) => isSide(it) || (trailingNote && it === last));
  const main = sec.items.filter((it) => !side.includes(it));
  if (side.length) {
    const leftW = (iw - colGap) * 0.56;
    const rightW = iw - colGap - leftW;
    return Math.max(renderItems(cx, top, leftW, main), renderItems(cx + leftW + colGap, top, rightW, side));
  }
  if (main.length >= 4) {
    const half = Math.ceil(main.length / 2);
    return Math.max(
      renderItems(cx, top, colW, main.slice(0, half)),
      renderItems(cx + colW + colGap, top, colW, main.slice(half)),
    );
  }
  return renderItems(cx, top, Math.min(iw, u(800)), main);
}

// ── レイアウト ───────────────────────────────────────────
const hasDiagram = (col) => col.some((s) => s.items.some((it) => it.diagram));

function layoutBoard(columns) {
  const TOP = 60;
  const GAP = 100;
  let x = 60;
  for (const col of columns) {
    const w = col.some((s) => s.hero) || hasDiagram(col) ? 600 : 560;
    let y = TOP;
    col.forEach((sec, i) => {
      y = renderSection(x, i === 0 ? y : y + 40, w, sec);
    });
    x += w + GAP;
  }
}

function layoutSlides(columns) {
  // 16:9。文字の拡大率（SCALE）に対して面積を広く取り、スライドらしい余白を残す
  const W = 1600;
  const H = 900;
  const PAD_X = 136;
  const PAD_Y = 112;
  const GAP = 200;
  let x = 60;
  for (const sec of columns.flat()) {
    const start = elements.length;
    const bottom = renderSlideSection(x + PAD_X, PAD_Y, W - PAD_X * 2, sec);
    // フレームは枠線が出るため使わない。枠線なしの背景でスライドの範囲を示す
    const bg = base("rectangle", x, 0, W, H, {
      strokeColor: "transparent",
      backgroundColor: SLIDE_BG,
      roughness: 0,
      locked: true,
    });
    elements.splice(start, 0, bg);
    if (bottom > H - PAD_Y + u(24)) {
      console.warn(`警告: 「${sec.heading}」がスライドに収まらない（下端 ${Math.round(bottom)} > ${H}）。セクションを分割する`);
    }
    x += W + GAP;
  }
}

// ── 入力の検証とアイコン取得 ─────────────────────────────
function validate(spec) {
  if (!Array.isArray(spec.columns) || spec.columns.length === 0) {
    throw new Error("columns は 1 つ以上のカラムを持つ配列にする");
  }
  for (const col of spec.columns) {
    if (!Array.isArray(col) || col.length === 0) throw new Error("column は 1 つ以上のセクションを持つ配列にする");
    for (const sec of col) {
      if (!sec.heading || !sec.icon || !Array.isArray(sec.items)) {
        throw new Error(`section には heading / icon / items が必要: ${JSON.stringify(sec.heading)}`);
      }
      for (const it of sec.items) {
        if (it.diagram && !DIAGRAMS[it.diagram.type]) {
          throw new Error(`diagram.type は ${Object.keys(DIAGRAMS).join(" / ")} のいずれか: ${it.diagram.type}`);
        }
        if (!(it.diagram || it.callout || it.lead || it.body)) {
          throw new Error(`item には lead / body / diagram / callout のいずれかが必要: ${JSON.stringify(it)}`);
        }
      }
    }
  }
}

async function loadIcon(name) {
  const cached = join(ICON_CACHE, `${name}.svg`);
  if (existsSync(cached)) return readFileSync(cached, "utf8");
  const res = await fetch(`${ICON_CDN}/${name}.svg`);
  if (!res.ok) throw new Error(`Lucide にアイコンがない: ${name}（https://lucide.dev/icons で確認）`);
  const svg = await res.text();
  mkdirSync(ICON_CACHE, { recursive: true });
  writeFileSync(cached, svg);
  return svg;
}

// ── 実行 ─────────────────────────────────────────────────
const spec = JSON.parse(readFileSync(specPath, "utf8"));
validate(spec);
const names = new Set(spec.columns.flat().map((s) => s.icon));
for (const name of names) svgCache.set(name, await loadIcon(name));

(LAYOUT === "slide" ? layoutSlides : layoutBoard)(spec.columns);

writeFileSync(
  outPath,
  JSON.stringify(
    {
      type: "excalidraw",
      version: 2,
      source: "https://excalidraw.com",
      elements,
      appState: { viewBackgroundColor: "#ffffff", gridSize: null },
      files,
    },
    null,
    2,
  ),
);
console.log(`生成: ${outPath}（${LAYOUT}、${FONT_NAME}、要素 ${elements.length}）`);
