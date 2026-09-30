import assert from "node:assert/strict";
import { test } from "node:test";
import { sectionIcon, sizeSvg } from "./icons.mjs";

const SETS = { icon: "lucide", logo: "logos" };

test("icon は既定のアイコンセットで解決する", () => {
  assert.deepEqual(sectionIcon({ icon: "keyboard" }, SETS), { prefix: "lucide", name: "keyboard", kind: "icon" });
});

test("logo は既定のロゴセットで解決する", () => {
  assert.deepEqual(sectionIcon({ logo: "cloudflare-icon" }, SETS), {
    prefix: "logos",
    name: "cloudflare-icon",
    kind: "logo",
  });
});

test("logo と icon の両方があれば logo を優先する", () => {
  assert.equal(sectionIcon({ icon: "cloud", logo: "cloudflare-icon" }, SETS).kind, "logo");
});

test("prefix:name で書けば、そのセットを使う", () => {
  assert.deepEqual(sectionIcon({ icon: "tabler:keyboard" }, SETS), { prefix: "tabler", name: "keyboard", kind: "icon" });
  assert.deepEqual(sectionIcon({ logo: "simple-icons:cloudflare" }, SETS), {
    prefix: "simple-icons",
    name: "cloudflare",
    kind: "logo",
  });
});

test("既定のセットを差し替えられる", () => {
  const sets = { icon: "tabler", logo: "simple-icons" };
  assert.equal(sectionIcon({ icon: "keyboard" }, sets).prefix, "tabler");
  assert.equal(sectionIcon({ logo: "cloudflare" }, sets).prefix, "simple-icons");
});

test("正方形の SVG は高さと同じ幅にし、currentColor を塗る", () => {
  const src = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor"/></svg>';
  const out = sizeSvg(src, 40, "#1971c2");
  assert.equal(out.width, 40);
  assert.equal(out.height, 40);
  assert.match(out.svg, /<svg[^>]* width="40" height="40"/);
  assert.match(out.svg, /fill="#1971c2"/);
  assert.doesNotMatch(out.svg, /currentColor/);
});

test("横長の SVG は viewBox の比率で幅を決める", () => {
  const src = '<svg xmlns="http://www.w3.org/2000/svg" width="6.74em" height="1em" viewBox="0 0 512 76"><path/></svg>';
  const out = sizeSvg(src, 38, "#000");
  assert.equal(out.width, 256);
  assert.match(out.svg, /<svg[^>]* width="256" height="38"/);
});

test("コメントを取り除く", () => {
  const src = '<!-- license --><svg viewBox="0 0 24 24" width="24" height="24"></svg>';
  assert.doesNotMatch(sizeSvg(src, 24, "#000").svg, /license/);
});
