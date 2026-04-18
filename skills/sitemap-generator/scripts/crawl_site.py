#!/usr/bin/env python3
"""
Webサイトをクロールしてページ一覧をCSV出力するスクリプト。

Usage:
    python3 crawl_site.py <start_url> [options]

Options:
    --max-depth N           最大クロール深度 (default: 5)
    --max-pages N           最大ページ数 (default: 500)
    --output PATH           出力CSVパス (default: sitemap.csv)
    --output-tree PATH      ツリー形式Markdown出力パス (optional)
    --dynamic-threshold N   同一パターンをN件以上検出で動的ページとして省略 (default: 5)
    --include-dynamic       動的ページも個別に出力する
    --concurrency N         並列クロール数 (default: 5)
    --resume PATH           中断データから再開 (JSON)
    --save-state PATH       中断時に状態を保存するパス (default: crawl_state.json)
"""

import argparse
import csv
import json
import re
import sys
import time
import signal
import xml.etree.ElementTree as ET
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError


# --- HTML Parser ---

class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""
        self.h1 = ""
        self.meta_description = ""
        self.meta_robots = ""
        self.canonical = ""
        self.links = []
        self._in_title = False
        self._in_h1 = False
        self._h1_found = False

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == "title":
            self._in_title = True
        elif tag == "h1" and not self._h1_found:
            self._in_h1 = True
        elif tag == "meta":
            name = attrs_dict.get("name", "").lower()
            if name == "description":
                self.meta_description = attrs_dict.get("content", "")
            elif name == "robots":
                self.meta_robots = attrs_dict.get("content", "")
        elif tag == "link":
            if attrs_dict.get("rel", "").lower() == "canonical":
                self.canonical = attrs_dict.get("href", "")
        elif tag == "a":
            href = attrs_dict.get("href", "")
            if href:
                self.links.append(href)

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        elif tag == "h1":
            self._in_h1 = False
            self._h1_found = True

    def handle_data(self, data):
        if self._in_title:
            self.title += data.strip()
        elif self._in_h1:
            self.h1 += data.strip()


# --- Dynamic Page Detection ---

DYNAMIC_PATTERNS = [
    (r"/\d{4}/\d{1,2}/\d{1,2}/", "date-path"),
    (r"/\d{4}-\d{1,2}-\d{1,2}", "date-path"),
    (r"/\d{4}/\d{1,2}/", "year-month"),
    (r"/\d+/?$", "numeric-id"),
    # ページネーション
    (r"/page/\d+/?$", "pagination"),
]


def _is_slug_like(segment):
    """セグメントが動的スラッグ（ランダムハッシュ、CMS生成ID等）っぽいか判定する。"""
    # 数字のみ
    if segment.isdigit():
        return True
    # 英数字+区切り文字のみで構成されたセグメントを分析
    if len(segment) >= 6 and re.match(r'^[a-z0-9_-]+$', segment):
        alpha = sum(1 for c in segment if c.isalpha())
        digit = sum(1 for c in segment if c.isdigit())
        # 英字と数字が混在 → CMS生成IDの可能性が高い
        # 例: iglg2hp0jpp, 19_pas8fnq_2, 2-nw3ib12ec6
        if alpha > 0 and digit > 0:
            return True
        # ハイフン/アンダースコアで分割して各ワードの長さを見る
        # 意味のある英単語: cardiovascular-center → [14, 6] 平均10
        # ランダムID: uaw-rafjdtsg → [3, 8] 短いパーツ混在
        parts = re.split(r'[-_]', segment)
        parts = [p for p in parts if p]  # 空文字除去
        if parts:
            avg_len = sum(len(p) for p in parts) / len(parts)
            short_parts = sum(1 for p in parts if len(p) <= 3)
            # 平均ワード長が4文字未満 → ランダムID風
            if avg_len < 4:
                return True
            # 半数以上が3文字以下の短いパーツ → ランダムID風
            if short_parts > len(parts) / 2:
                return True
    return False


def detect_dynamic_pattern(path):
    """URLパスから動的ページのパターンを検出し、正規化パターンを返す。"""
    segments = [s for s in path.split("/") if s]
    if not segments:
        return None, None

    # 既知の構造パターン（日付、数値ID、ページネーション）
    for regex, pattern_type in DYNAMIC_PATTERNS:
        if re.search(regex, path):
            match = re.search(regex, path)
            parent = path[: match.start() + 1]
            return parent, pattern_type

    # 末尾セグメントがランダムスラッグっぽい場合のみ slug 判定
    last_segment = segments[-1]
    if _is_slug_like(last_segment) and len(segments) >= 2:
        parent = "/" + "/".join(segments[:-1]) + "/"
        return parent, "slug"

    return None, None


# --- URL Utilities ---

def normalize_url(url, base_url):
    """URLを正規化する。"""
    parsed = urlparse(url)
    clean = parsed._replace(fragment="", query="")
    absolute = urljoin(base_url, clean.geturl())
    parsed_abs = urlparse(absolute)
    path = parsed_abs.path
    if not path:
        path = "/"
    elif not path.endswith("/") and "." not in path.split("/")[-1]:
        path += "/"
    return parsed_abs._replace(path=path, fragment="", query="").geturl()


SKIP_EXTENSIONS = {
    ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp",
    ".css", ".js", ".ico", ".xml", ".json", ".zip", ".mp4",
    ".mp3", ".woff", ".woff2", ".ttf", ".eot",
}


def is_crawlable(url, base_domain, disallowed_paths):
    """クロール対象かどうか判定する（robots.txt の disallow 考慮）。"""
    parsed = urlparse(url)
    if parsed.netloc != base_domain:
        return False
    path_lower = parsed.path.lower()
    for ext in SKIP_EXTENSIONS:
        if path_lower.endswith(ext):
            return False
    for disallowed in disallowed_paths:
        if parsed.path.startswith(disallowed):
            return False
    return True


# --- robots.txt & sitemap.xml ---

def fetch_robots_txt(base_url):
    """robots.txt を取得して disallow パスリストを返す。"""
    robots_url = urljoin(base_url, "/robots.txt")
    disallowed = []
    sitemap_urls = []
    try:
        req = Request(robots_url, headers={"User-Agent": "SitemapGenerator/1.0"})
        with urlopen(req, timeout=10) as resp:
            text = resp.read().decode("utf-8", errors="replace")
            in_wildcard = False
            for line in text.splitlines():
                line = line.strip()
                if line.lower().startswith("user-agent:"):
                    agent = line.split(":", 1)[1].strip()
                    in_wildcard = agent == "*"
                elif in_wildcard and line.lower().startswith("disallow:"):
                    path = line.split(":", 1)[1].strip()
                    if path:
                        disallowed.append(path)
                elif line.lower().startswith("sitemap:"):
                    url = line.split(":", 1)[1].strip()
                    if not url.startswith("http"):
                        url = "https:" + url
                    sitemap_urls.append(url)
    except (HTTPError, URLError, TimeoutError, OSError):
        pass
    return disallowed, sitemap_urls


def fetch_sitemap_xml(sitemap_url):
    """sitemap.xml を取得してURL一覧を返す。"""
    urls = []
    try:
        req = Request(sitemap_url, headers={"User-Agent": "SitemapGenerator/1.0"})
        with urlopen(req, timeout=15) as resp:
            content = resp.read()
            root = ET.fromstring(content)
            ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
            for sitemap in root.findall(".//sm:sitemap/sm:loc", ns):
                urls.extend(fetch_sitemap_xml(sitemap.text.strip()))
            for url_elem in root.findall(".//sm:url/sm:loc", ns):
                urls.append(url_elem.text.strip())
    except (HTTPError, URLError, TimeoutError, OSError, ET.ParseError):
        pass
    return urls


# --- Page Fetcher ---

def fetch_page(url):
    """ページを取得してパース結果とメタ情報を返す。"""
    req = Request(url, headers={"User-Agent": "SitemapGenerator/1.0"})
    redirect_url = ""
    try:
        with urlopen(req, timeout=15) as resp:
            status = resp.getcode()
            final_url = resp.geturl()
            if final_url != url:
                redirect_url = final_url
            content_type = resp.headers.get("Content-Type", "")
            if "text/html" not in content_type:
                return status, None, redirect_url
            html = resp.read().decode("utf-8", errors="replace")
            parser = PageParser()
            parser.feed(html)
            return status, parser, redirect_url
    except HTTPError as e:
        return e.code, None, ""
    except (URLError, TimeoutError, OSError):
        return 0, None, ""


# --- Page Classification ---

def classify_page(path, parser):
    """ページの種別を推定する。"""
    path_lower = path.lower().rstrip("/")
    if path == "/" or path == "":
        return "トップ"
    if parser:
        text = (parser.title + " " + parser.h1).lower()
        form_words = ["contact", "お問い合わせ", "申し込み", "応募", "登録", "ログイン", "login", "signup", "sign up"]
        if any(w in text for w in form_words):
            return "フォーム"
    list_keywords = ["archive", "category", "tag", "search", "一覧", "news", "blog", "topics", "events"]
    if any(kw in path_lower for kw in list_keywords):
        return "一覧"
    if re.search(r"/page/\d+", path_lower):
        return "ページネーション"
    segments = [s for s in path.split("/") if s]
    if len(segments) <= 2:
        return "固定ページ"
    return "詳細ページ"


# --- Crawler ---

class Crawler:
    def __init__(self, start_url, max_depth, max_pages, concurrency,
                 dynamic_threshold, disallowed_paths):
        self.start_url = start_url
        self.max_depth = max_depth
        self.max_pages = max_pages
        self.concurrency = concurrency
        self.dynamic_threshold = dynamic_threshold
        self.disallowed_paths = disallowed_paths

        parsed = urlparse(start_url)
        self.base_domain = parsed.netloc

        self.visited = set()
        self.results = []
        self.queue = []
        self.depth_limited = False
        self.page_limited = False
        self.interrupted = False
        self.broken_links = []

    def save_state(self, path):
        """中断時に状態をJSONに保存する。"""
        state = {
            "start_url": self.start_url,
            "max_depth": self.max_depth,
            "max_pages": self.max_pages,
            "visited": list(self.visited),
            "results": self.results,
            "queue": self.queue,
            "broken_links": self.broken_links,
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
        print(f"\n状態を保存しました: {path} ({len(self.results)}ページ済)", file=sys.stderr)

    def load_state(self, path):
        """保存済み状態から再開する。"""
        with open(path, "r", encoding="utf-8") as f:
            state = json.load(f)
        self.visited = set(state["visited"])
        self.results = state["results"]
        self.queue = state["queue"]
        self.broken_links = state.get("broken_links", [])
        print(f"状態を復元しました: {len(self.results)}ページ済, キュー残{len(self.queue)}件", file=sys.stderr)

    def _fetch_one(self, url, depth, parent_url):
        """1ページを取得して結果dictを返す。"""
        status, parser, redirect_url = fetch_page(url)
        path = urlparse(url).path or "/"
        title = parser.title if parser else ""
        h1 = parser.h1 if parser else ""
        meta_desc = parser.meta_description if parser else ""
        meta_robots = parser.meta_robots if parser else ""
        canonical = parser.canonical if parser else ""
        page_type = classify_page(path, parser) if parser else ""
        noindex = "noindex" in meta_robots.lower() if meta_robots else False

        links = []
        if parser:
            for link in parser.links:
                abs_link = normalize_url(link, url)
                if abs_link not in self.visited and is_crawlable(abs_link, self.base_domain, self.disallowed_paths):
                    links.append(abs_link)

        return {
            "url": url,
            "path": path,
            "title": title,
            "depth": depth,
            "parent_url": parent_url,
            "status": status,
            "h1": h1,
            "meta_description": meta_desc,
            "canonical": canonical,
            "redirect_url": redirect_url,
            "noindex": noindex,
            "page_type": page_type,
            "child_links": links,
        }

    def crawl(self):
        """並列クロール実行。"""
        if not self.queue:
            self.queue = [(normalize_url(self.start_url, self.start_url), 0, "")]

        start_time = time.time()

        with ThreadPoolExecutor(max_workers=self.concurrency) as executor:
            while self.queue and not self.interrupted:
                if len(self.results) >= self.max_pages:
                    self.page_limited = True
                    break

                batch = []
                seen_in_batch = set()
                while self.queue and len(batch) < self.concurrency:
                    url, depth, parent_url = self.queue.pop(0)
                    if url in self.visited or url in seen_in_batch:
                        continue
                    batch.append((url, depth, parent_url))
                    seen_in_batch.add(url)

                if not batch:
                    continue

                futures = {}
                for url, depth, parent_url in batch:
                    self.visited.add(url)
                    future = executor.submit(self._fetch_one, url, depth, parent_url)
                    futures[future] = (url, depth, parent_url)

                for future in as_completed(futures):
                    if self.interrupted:
                        break
                    result = future.result()

                    if result["status"] in (404, 410, 0):
                        self.broken_links.append((
                            result["url"], result["parent_url"], result["status"]
                        ))

                    child_links = result.pop("child_links")
                    self.results.append(result)

                    elapsed = time.time() - start_time
                    rate = len(self.results) / elapsed if elapsed > 0 else 0
                    print(
                        f"\r  [{len(self.results)}/{self.max_pages}] "
                        f"{result['status']} depth={result['depth']} "
                        f"{result['path'][:60]:<60} "
                        f"({rate:.1f} p/s)",
                        end="", file=sys.stderr
                    )

                    if result["depth"] < self.max_depth:
                        for link in child_links:
                            if link not in self.visited:
                                self.queue.append((link, result["depth"] + 1, result["url"]))
                    elif child_links:
                        self.depth_limited = True

        print("", file=sys.stderr)
        return self.results


# --- Output ---

def group_dynamic_pages(results, threshold):
    """動的ページをグルーピングして省略対象を特定する。"""
    parent_children = defaultdict(list)
    for r in results:
        parent_path, _ = detect_dynamic_pattern(r["path"])
        if parent_path:
            parent_children[parent_path].append(r)

    dynamic_groups = {}
    for parent_path, children in parent_children.items():
        if len(children) >= threshold:
            dynamic_groups[parent_path] = children

    return dynamic_groups


MAX_HIERARCHY_DEPTH = 6  # 第1階層〜第6階層


def _path_to_hierarchy(path):
    """パスを階層カラム用のリストに分解する。"""
    segments = [s for s in path.rstrip("/").split("/") if s]
    result = [""] * MAX_HIERARCHY_DEPTH
    for i, seg in enumerate(segments[:MAX_HIERARCHY_DEPTH]):
        result[i] = seg
    return result


def write_csv(results, dynamic_groups, broken_links, sitemap_urls_set,
              output_path, include_dynamic):
    """結果をCSVに書き出す。パスでソートし、階層カラムを分割。"""
    skipped_urls = set()
    if not include_dynamic:
        for children in dynamic_groups.values():
            for child in children:
                skipped_urls.add(child["url"])

    hierarchy_headers = [f"第{i+1}階層" for i in range(MAX_HIERARCHY_DEPTH)]
    fieldnames = [
        "URL", *hierarchy_headers, "タイトル",
        "ステータス", "h1", "メタディスクリプション",
        "canonical", "リダイレクト先", "noindex",
        "ページ種別", "sitemap.xml", "備考",
    ]

    # 出力行を構築（後でパスソート）
    rows = []

    # 通常ページ行
    for r in results:
        if r["url"] in skipped_urls:
            continue

        remarks = []
        if r["status"] in (404, 410):
            remarks.append(f"リンク切れ({r['status']})")
        if r["noindex"]:
            remarks.append("noindex")
        normalized_url = normalize_url(r["url"], r["url"])
        in_sitemap = normalized_url in sitemap_urls_set
        if in_sitemap and r["status"] in (404, 410):
            remarks.append("sitemap.xmlに記載あるが404")

        hierarchy = _path_to_hierarchy(r["path"])
        row = {
            "URL": r["url"],
            "タイトル": r["title"],
            "ステータス": r["status"],
            "h1": r["h1"],
            "メタディスクリプション": r["meta_description"],
            "canonical": r["canonical"],
            "リダイレクト先": r["redirect_url"],
            "noindex": "yes" if r["noindex"] else "",
            "ページ種別": r["page_type"],
            "sitemap.xml": "yes" if in_sitemap else "",
            "備考": " / ".join(remarks),
            "_sort_key": r["path"],
        }
        for i, h in enumerate(hierarchy_headers):
            row[h] = hierarchy[i]
        rows.append(row)

    # 動的ページサマリー行
    for parent_path, children in dynamic_groups.items():
        count = len(children)
        hierarchy = _path_to_hierarchy(parent_path)
        # サマリーは親パスの次の階層に [動的ページ] を入れる
        depth = len([s for s in parent_path.rstrip("/").split("/") if s])
        if depth < MAX_HIERARCHY_DEPTH:
            hierarchy[depth] = f"[動的ページ {count}件]"
        row = {
            "URL": parent_path + "[動的ページ]",
            "タイトル": f"動的ページ {count}件 を省略",
            "ステータス": "---",
            "h1": "---",
            "メタディスクリプション": "---",
            "canonical": "",
            "リダイレクト先": "",
            "noindex": "",
            "ページ種別": "動的ページ",
            "sitemap.xml": "",
            "備考": f"動的ページ {count}件 を省略",
            # ソートキー: 親パスの直後に来るように末尾に ! を付与
            "_sort_key": parent_path + "!",
        }
        for i, h in enumerate(hierarchy_headers):
            row[h] = hierarchy[i]
        rows.append(row)

    # sitemap.xml にあるがクロールで未到達のURL
    crawled_urls = {normalize_url(r["url"], r["url"]) for r in results}
    missing_from_crawl = sitemap_urls_set - crawled_urls
    for url in sorted(missing_from_crawl):
        path = urlparse(url).path or "/"
        hierarchy = _path_to_hierarchy(path)
        row = {
            "URL": url,
            "タイトル": "",
            "ステータス": "未取得",
            "h1": "",
            "メタディスクリプション": "",
            "canonical": "",
            "リダイレクト先": "",
            "noindex": "",
            "ページ種別": "",
            "sitemap.xml": "yes",
            "備考": "sitemap.xmlに記載あるがクロールで未到達",
            "_sort_key": path,
        }
        for i, h in enumerate(hierarchy_headers):
            row[h] = hierarchy[i]
        rows.append(row)

    # パスでソート（トップページを先頭に）
    rows.sort(key=lambda r: r["_sort_key"])

    with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow(row)

    return len(rows)


def write_tree_markdown(results, dynamic_groups, output_path, include_dynamic):
    """ツリー形式のMarkdownを出力する。"""
    skipped_urls = set()
    if not include_dynamic:
        for children in dynamic_groups.values():
            for child in children:
                skipped_urls.add(child["url"])

    tree = {}
    for r in results:
        if r["url"] in skipped_urls:
            continue
        parts = [p for p in r["path"].split("/") if p]
        node = tree
        for part in parts:
            if part not in node:
                node[part] = {}
            node = node[part]
        node["__info__"] = r

    summarized_parents = set()
    for r in results:
        if r["url"] in skipped_urls:
            parent_path, _ = detect_dynamic_pattern(r["path"])
            if parent_path and parent_path not in summarized_parents:
                summarized_parents.add(parent_path)
                parts = [p for p in parent_path.split("/") if p]
                node = tree
                for part in parts:
                    if part not in node:
                        node[part] = {}
                    node = node[part]
                count = len(dynamic_groups[parent_path])
                node["[動的ページ]"] = {"__info__": {
                    "title": f"({count}件省略)", "status": "", "page_type": "動的ページ",
                }}

    def render_tree(node, prefix=""):
        lines = []
        children = {k: v for k, v in node.items() if k != "__info__"}
        items = sorted(children.items())
        for i, (name, child) in enumerate(items):
            is_last_child = i == len(items) - 1
            connector = "└── " if is_last_child else "├── "
            info = child.get("__info__", {})
            title = info.get("title", "")
            status = info.get("status", "")
            ptype = info.get("page_type", "")
            label = f"{name}/"
            extras = []
            if title:
                extras.append(title)
            if ptype:
                extras.append(f"[{ptype}]")
            if status and status in (404, 410, 0):
                extras.append(f"({status})")
            if extras:
                label += f"  — {', '.join(str(e) for e in extras)}"
            lines.append(f"{prefix}{connector}{label}")
            extension = "    " if is_last_child else "│   "
            lines.extend(render_tree(child, prefix + extension))
        return lines

    root_info = tree.get("__info__", {})
    root_title = root_info.get("title", "")
    header = f"/ — {root_title}" if root_title else "/"

    lines = ["# Site Map\n", "```", header]
    lines.extend(render_tree(tree))
    lines.append("```")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


# --- Main ---

def main():
    parser = argparse.ArgumentParser(description="Webサイトのサイトマップ/ディレクトリマップをCSV生成")
    parser.add_argument("start_url", help="クロール開始URL")
    parser.add_argument("--max-depth", type=int, default=5, help="最大クロール深度 (default: 5)")
    parser.add_argument("--max-pages", type=int, default=500, help="最大ページ数 (default: 500)")
    parser.add_argument("--output", default="sitemap.csv", help="出力CSVパス (default: sitemap.csv)")
    parser.add_argument("--output-tree", default="", help="ツリー形式Markdown出力パス (optional)")
    parser.add_argument("--dynamic-threshold", type=int, default=5, help="動的ページ判定しきい値 (default: 5)")
    parser.add_argument("--include-dynamic", action="store_true", help="動的ページも個別出力")
    parser.add_argument("--concurrency", type=int, default=5, help="並列クロール数 (default: 5)")
    parser.add_argument("--resume", default="", help="中断データから再開 (JSONパス)")
    parser.add_argument("--save-state", default="crawl_state.json", help="中断時の保存先 (default: crawl_state.json)")
    args = parser.parse_args()

    print(f"クロール開始: {args.start_url}", file=sys.stderr)
    print(f"  最大深度: {args.max_depth}, 最大ページ数: {args.max_pages}", file=sys.stderr)
    print(f"  並列数: {args.concurrency}, 動的ページしきい値: {args.dynamic_threshold}件", file=sys.stderr)

    # robots.txt
    print("\nrobots.txt を確認中...", file=sys.stderr)
    disallowed, sitemap_xml_urls = fetch_robots_txt(args.start_url)
    if disallowed:
        print(f"  Disallow: {len(disallowed)}パス", file=sys.stderr)
        for d in disallowed[:10]:
            print(f"    {d}", file=sys.stderr)
        if len(disallowed) > 10:
            print(f"    ... 他{len(disallowed)-10}件", file=sys.stderr)

    # sitemap.xml
    sitemap_urls_set = set()
    if sitemap_xml_urls:
        print(f"\nsitemap.xml を取得中 ({len(sitemap_xml_urls)}件)...", file=sys.stderr)
        for surl in sitemap_xml_urls:
            urls = fetch_sitemap_xml(surl)
            # 末尾スラッシュを正規化して格納
            for u in urls:
                sitemap_urls_set.add(normalize_url(u, u))
        print(f"  sitemap.xml から {len(sitemap_urls_set)} URL を取得", file=sys.stderr)

    # クローラー
    crawler = Crawler(
        args.start_url, args.max_depth, args.max_pages,
        args.concurrency, args.dynamic_threshold, disallowed,
    )

    if args.resume:
        crawler.load_state(args.resume)

    # Ctrl+C → 状態保存
    def handle_interrupt(sig, frame):
        print("\n\n中断を検出しました。状態を保存中...", file=sys.stderr)
        crawler.interrupted = True
        crawler.save_state(args.save_state)
        sys.exit(130)

    signal.signal(signal.SIGINT, handle_interrupt)

    # クロール
    print("\nクロール中...", file=sys.stderr)
    results = crawler.crawl()

    dynamic_groups = group_dynamic_pages(results, args.dynamic_threshold)

    # CSV
    row_count = write_csv(
        results, dynamic_groups, crawler.broken_links,
        sitemap_urls_set, args.output, args.include_dynamic,
    )

    # Tree
    if args.output_tree:
        write_tree_markdown(results, dynamic_groups, args.output_tree, args.include_dynamic)
        print(f"  ツリー出力: {args.output_tree}", file=sys.stderr)

    # サマリー
    print(f"\n完了: {len(results)}ページ取得 → {row_count}行 CSV出力", file=sys.stderr)
    print(f"  出力: {args.output}", file=sys.stderr)

    if dynamic_groups:
        print(f"  動的ページグループ: {len(dynamic_groups)}件", file=sys.stderr)
        for parent, children in dynamic_groups.items():
            print(f"    {parent} → {len(children)}件省略", file=sys.stderr)

    if crawler.broken_links:
        print(f"\n  リンク切れ: {len(crawler.broken_links)}件", file=sys.stderr)
        for url, parent, status in crawler.broken_links[:10]:
            print(f"    [{status}] {url} (from {parent})", file=sys.stderr)
        if len(crawler.broken_links) > 10:
            print(f"    ... 他{len(crawler.broken_links)-10}件", file=sys.stderr)

    noindex_count = sum(1 for r in results if r.get("noindex"))
    if noindex_count:
        print(f"  noindex ページ: {noindex_count}件", file=sys.stderr)

    redirect_count = sum(1 for r in results if r.get("redirect_url"))
    if redirect_count:
        print(f"  リダイレクト: {redirect_count}件", file=sys.stderr)

    # 制限警告
    warnings = []
    if crawler.depth_limited:
        warnings.append(f"深度制限 ({args.max_depth}) に達しました。--max-depth を増やすとより深い階層を取得できます。")
    if crawler.page_limited:
        warnings.append(f"ページ数上限 ({args.max_pages}) に達しました。--max-pages を増やすとより多くのページを取得できます。")

    if warnings:
        print("\n⚠ 警告:", file=sys.stderr)
        for w in warnings:
            print(f"  - {w}", file=sys.stderr)
        print(json.dumps({
            "warnings": warnings,
            "depth_limited": crawler.depth_limited,
            "page_limited": crawler.page_limited,
        }, ensure_ascii=False))


if __name__ == "__main__":
    main()
