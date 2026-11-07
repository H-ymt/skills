// アイコンとロゴの解決と取得。取得先は Iconify API に統一する
// （Lucide / SVG Logos / Simple Icons / Devicon などを同じ URL 形式で配っている）。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ICONIFY = "https://api.iconify.design";
const CACHE = join(tmpdir(), "doc-to-excalidraw-iconify");

// "prefix:name" ならそのセット、名前だけなら既定のセットで解決する
const resolve = (ref, defaultSet) => {
  const i = ref.indexOf(":");
  return i >= 0 ? { prefix: ref.slice(0, i), name: ref.slice(i + 1) } : { prefix: defaultSet, name: ref };
};

// Section の見出しに付けるアイコン。logo があれば logo を優先する
export function sectionIcon(sec, sets) {
  return sec.logo
    ? { ...resolve(sec.logo, sets.logo), kind: "logo" }
    : { ...resolve(sec.icon, sets.icon), kind: "icon" };
}

// 高さを揃え、幅は viewBox の比率で決める。単色のアイコンは currentColor を color で塗る
export function sizeSvg(src, height, color) {
  const [, , vw, vh] = (src.match(/viewBox="([^"]+)"/)?.[1] ?? "0 0 24 24").split(/[\s,]+/).map(Number);
  const width = Math.round((height * vw) / vh);
  const svg = src
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/currentColor/g, color)
    .replace(/<svg\b[^>]*>/, (tag) =>
      tag.replace(/\s(width|height)="[^"]*"/g, "").replace(/^<svg/, `<svg width="${width}" height="${height}"`),
    );
  return { svg, width, height };
}

export async function loadSvg({ prefix, name }) {
  const cached = join(CACHE, prefix, `${name}.svg`);
  if (existsSync(cached)) return readFileSync(cached, "utf8");
  const res = await fetch(`${ICONIFY}/${prefix}/${name}.svg`);
  if (!res.ok) {
    throw new Error(`アイコンが見つからない: ${prefix}:${name}（https://icon-sets.iconify.design/${prefix}/ で確認）`);
  }
  const svg = await res.text();
  mkdirSync(join(CACHE, prefix), { recursive: true });
  writeFileSync(cached, svg);
  return svg;
}
