#!/usr/bin/env python3
"""Zennの記事1本ごとに /zenn/<slug>.html 用のデータを作る。

データ源は url2ai の osszenn（aiknowledgecms.exbridge.jp）が貯めたもの:
  - zenn2oss_cache.json … 「Zenn記事のタイトル → その記事が紹介しているGitHubのOSS」
  - zenn_rss_cache_*.json … Zenn記事のタイトル・URL・日付（163名分・約2,100本）
  - oss_posts.json … そのOSSをAIが分析した文章（261件）
Zenn APIを叩かずに済むので、レート制限に触れない。

流れ:
  1. 記事×OSSのペアを作る（タイトルで突き合わせ）
  2. 当社カタログ（/oss/ にあるか）と照合し、あれば相互リンクの材料にする
  3. codex CLI にタイトル・OSS情報・AI分析を渡して、
     テーマ・検索キーワード・ページタイトル・リード文・記事紹介文・要点を書かせる
  4. data/zenn-list.json に1記事1ページの形で書き出す

codexに守らせること（プロンプトに明記）:
  - 渡した材料にないことを足さない（記事本文は持っていないので、断定を避けさせる）
  - 記事の主張は著者のものとして書く
  - 宣伝を書かない（導線はテンプレート側にある）
  - themeは英小文字とハイフンだけ（URLになる）

使い方:
  python3 scripts/zenn-collect.py --prepare        # ペアの作成だけ（codexを使わない）
  python3 scripts/zenn-collect.py --limit 10       # 10件だけ生成して品質を見る
  python3 scripts/zenn-collect.py                  # 未処理を全部
"""
import json, os, re, subprocess, sys, tempfile, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = f"{ROOT}/data/zenn-source"          # osszenn から落としたデータの置き場
OUT = f"{ROOT}/data/zenn-list.json"

SCHEMA = {
    "type": "object",
    "properties": {
        "theme": {"type": "string"},
        "keyword": {"type": "string"},
        "pageTitle": {"type": "string"},
        "lead": {"type": "string"},
        "summary": {"type": "string"},
        "points": {"type": "array", "items": {"type": "string"}},
        "relevant": {"type": "boolean"},
    },
    "required": ["theme", "keyword", "pageTitle", "lead", "summary", "points", "relevant"],
    "additionalProperties": False,
}

PROMPT_BODY = """あなたは日本語のテクニカルライターです。Zennに公開されている記事を読んで、その記事を紹介するページの材料を作ってください。

## 対象のオープンソース
名前: {name}
説明: {desc}

## Zennの記事
タイトル: {title}
公開日: {date}
著者: {author}
本文（抜粋）:
{body}

## 作ってほしいもの

- relevant: この記事が「{name}」を扱っているならtrue。名前が一致しているだけで別物ならfalse。
- theme: 記事の主題を表す英小文字とハイフンだけの短い語（URLの一部になる）。例: getting-started / self-host / customize / performance / migration。2〜3語まで。
- keyword: 日本語の検索キーワード。「{name} ○○」の形。この記事を探している人が実際に打ちそうな語にする。
- pageTitle: ページの見出し。keywordを含み、36〜52字程度。煽らず内容を表す。末尾に社名や記号を付けない。
- lead: このページのリード文。2〜3文（110〜170字）。このキーワードで来た人がこの記事から何を得られるかを書く。
- summary: 記事の紹介文。2〜3文（100〜160字）。本文に書かれている範囲だけで書く。
- points: 記事に書かれている項目を3〜4個。1個15〜40字の体言止め。

## 厳守すること

- 本文に書かれていないことを足さない。推測で機能・結論・数値を書かない。
- 記事の主張は著者のものとして書く（「〜と報告されています」「〜の手順が書かれています」）。当社の意見として断定しない。
- 宣伝・営業文を書かない。価格や自社サービスに触れない。
- 「必見」「完全」「最強」「決定版」のような煽り言葉を使わない。
- themeは必ず英小文字・数字・ハイフンのみ。
"""

PROMPT = """あなたは日本語のテクニカルライターです。Zennに公開されている記事と、その記事が紹介しているオープンソースについて、紹介ページの材料を作ってください。

## Zennの記事
タイトル: {title}
公開日: {date}
著者: {author}

## その記事が紹介しているオープンソース
名前: {name}
GitHub: {github}
説明: {desc}

## 作ってほしいもの

- relevant: この記事がこのOSSを扱っていると考えて妥当ならtrue。タイトルとOSS名が明らかに無関係ならfalse。
- theme: 記事の主題を表す英小文字とハイフンだけの短い語（URLの一部になる）。例: getting-started / self-host / customize / integration / troubleshooting / performance。2〜3語まで。
- keyword: 日本語の検索キーワード。「{name} ○○」の形にする。この記事を探している人が実際に打ちそうな語にする。
- pageTitle: ページの見出し。keywordを含み、36〜52字程度。煽らず、内容を表す。末尾に社名や記号を付けない。
- lead: このページのリード文。2〜3文（110〜170字）。「このキーワードで来た人が、この記事から何を得られそうか」を書く。
- summary: 記事の紹介文。2〜3文（90〜150字）。
- points: 読む前に分かるとよい観点を3〜4個。1個15〜40字の体言止め。

## 厳守すること（重要）

- **あなたは記事の本文を読んでいません。** タイトルとOSSの説明から分かる範囲だけで書き、記事の中身を断定しない。
  「〜が扱われています」「〜について書かれているとみられます」のように、断定を避けた書き方にする。
- 数値・手順・結論を推測で書かない。書かれていない機能を足さない。
- 宣伝・営業文を書かない。価格や自社サービスに触れない。
- 「必見」「完全」「最強」「決定版」のような煽り言葉を使わない。
- themeは必ず英小文字・数字・ハイフンのみ。
"""


def load_source():
    """osszenn のデータを読み込んで「記事×OSS」のペアを作る。"""
    z2o = json.load(open(f"{SRC}/zenn2oss_cache.json", encoding="utf-8"))
    posts = {p["id"]: p for p in json.load(open(f"{SRC}/oss_posts.json", encoding="utf-8"))}

    arts = {}
    for fn in os.listdir(f"{SRC}/rss"):
        try:
            for a in json.load(open(f"{SRC}/rss/{fn}", encoding="utf-8")):
                if a.get("title") and a.get("link"):
                    a["user"] = fn.replace("zenn_rss_cache_", "").replace(".json", "")
                    arts[a["title"]] = a
        except Exception:
            continue

    pairs = {}
    for src in list((z2o.get("candidates") or {}).values()) + list(z2o.get("new_items") or []):
        if not isinstance(src, dict):
            continue
        t, u = src.get("title"), src.get("url")
        if t and u and t in arts:
            pairs[(t, u)] = {"nid": src.get("nid"), "github": u, "article": arts[t],
                             "post": posts.get(src.get("nid"))}
    return list(pairs.values()), arts, posts


def load_catalog_bodies():
    """カタログ掲載OSSの記事（本文つき）。Zenn APIで取得済みのものを読むだけ。"""
    f = f"{SRC}/catalog_bodies.json"
    if not os.path.exists(f):
        return []
    out = []
    for path, v in json.load(open(f, encoding="utf-8")).items():
        out.append({"path": path, **v})
    return out


def run_codex(title, date, author, name, github, desc, body=None, tries=2):
    if body:
        prompt = PROMPT_BODY.format(title=title, date=date, author=author, name=name,
                                    desc=desc or "(説明なし)", body=body[:3600])
    else:
        prompt = PROMPT.format(title=title, date=date, author=author, name=name, github=github, desc=desc or "(説明なし)")
    with tempfile.TemporaryDirectory() as td:
        sf, of = f"{td}/schema.json", f"{td}/out.json"
        json.dump(SCHEMA, open(sf, "w"))
        for _ in range(tries):
            try:
                subprocess.run(["codex", "exec", "--sandbox", "read-only", "--skip-git-repo-check",
                                "--output-schema", sf, "-o", of, prompt],
                               capture_output=True, text=True, timeout=420)
            except subprocess.TimeoutExpired:
                continue
            if os.path.exists(of):
                try:
                    return json.load(open(of))
                except Exception:
                    pass
            time.sleep(3)
    return None


def main():
    argv = sys.argv[1:]
    limit = int(argv[argv.index("--limit") + 1]) if "--limit" in argv else None
    prepare_only = "--prepare" in argv

    pairs, arts, posts = load_source()
    print(f"記事×OSSのペア: {len(pairs)}件（AI分析つき {sum(1 for p in pairs if p['post'])}件）")
    if prepare_only:
        json.dump(pairs, open(f"{SRC}/pairs.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"→ {SRC}/pairs.json に保存")
        return

    catalog = {x["slug"]: x for x in json.load(open(f"{ROOT}/data/oss-catalog.json", encoding="utf-8"))}
    projects = {x["slug"]: x for x in json.load(open(f"{SRC}/oss_projects.json", encoding="utf-8"))}
    videos = json.load(open(f"{SRC}/kuragev_videos.json", encoding="utf-8")) if os.path.exists(f"{SRC}/kuragev_videos.json") else []
    # GitHubのリポジトリ名で当社カタログを引く
    by_repo = {}
    for s, p in projects.items():
        g = (catalog.get(s, {}).get("githubUrl") or p.get("githubUrl") or "")
        m = re.search(r"github\.com/([^/]+)/([^/#?]+)", g)
        if m:
            by_repo[f"{m.group(1).lower()}/{m.group(2).lower()}"] = s

    pages = json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) else []
    done_links = {p["article"]["path"] for p in pages}
    used = {p["slug"] for p in pages}

    # カタログ掲載OSSの記事（本文つき）を先に処理する。
    # 当社の /oss/ /ai-system/ /saas/ /solution/ へ確実にリンクできるページになるため。
    cat_items = []
    for b in load_catalog_bodies():
        if b["path"] in done_links:
            continue
        cat_items.append({
            "kind": "catalog", "ossSlug": b["ossSlug"], "github": (catalog.get(b["ossSlug"], {}) or {}).get("githubUrl", ""),
            "article": {"title": b["title"], "link": b["path"], "pubDate": (b.get("published_at") or "")[:10],
                        "user": b.get("user"), "liked": b.get("liked"), "emoji": b.get("emoji")},
            "body": b.get("body"), "post": None,
        })
    cat_items.sort(key=lambda x: -(x["article"].get("liked") or 0))

    rest = [{**p, "kind": "pair", "body": None} for p in pairs if p["article"]["link"] not in done_links]
    rest.sort(key=lambda p: (p["post"] is None, p["article"].get("pubDate", "")), reverse=False)

    todo = cat_items + rest
    if limit:
        todo = todo[:limit]
    print(f"生成対象: {len(todo)}件（カタログ掲載OSSの本文つき {len(cat_items)}件を優先）")

    made = 0
    for i, p in enumerate(todo):
        a = p["article"]
        m = re.search(r"github\.com/([^/]+)/([^/#?]+)", p.get("github") or "")
        repo = f"{m.group(1)}/{m.group(2)}" if m else ""
        name = m.group(2) if m else (p.get("nid") or "")
        oss_slug = p.get("ossSlug") or by_repo.get(repo.lower())
        cat = catalog.get(oss_slug, {}) if oss_slug else {}
        desc = cat.get("summary") or (projects.get(oss_slug, {}) or {}).get("summary") or ""
        if not desc and p["post"]:
            desc = re.sub(r"\s+", " ", p["post"]["analysis"])[:600]
        if cat.get("name"):
            name = cat["name"]

        res = run_codex(a["title"], a.get("pubDate", ""), a.get("user", ""), name, p.get("github") or "", desc, body=p.get("body"))
        if not res or not res.get("relevant"):
            print(f"  skip {name} / {a['title'][:34]}", flush=True)
            continue

        theme = re.sub(r"[^a-z0-9-]", "", (res["theme"] or "").lower()).strip("-") or "guide"
        stem = (oss_slug or re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-"))
        slug = f"{stem}-{theme}"
        n = 2
        while slug in used:
            slug = f"{stem}-{theme}-{n}"
            n += 1
        used.add(slug)

        page = {
            "slug": slug, "ossSlug": oss_slug or stem, "ossName": name,
            "theme": theme, "keyword": res["keyword"], "pageTitle": res["pageTitle"], "lead": res["lead"],
            "article": {
                "title": a["title"],
                "path": a["link"],                     # 完全なURL（zenn.dev込み）
                "published_at": a.get("pubDate"),
                "user": a.get("user"), "name": a.get("user"),
                "summary": res["summary"], "points": res.get("points", [])[:4],
            },
            "githubUrl": p.get("github") or (catalog.get(oss_slug, {}) or {}).get("githubUrl", ""),
            "ossSummary": desc[:400],
            "category": cat.get("category") or (projects.get(oss_slug, {}) or {}).get("category") or "other",
            "inCatalog": bool(oss_slug),
        }
        for k in ("lpUrl", "buyUrl", "brainUrl", "brainLabel"):
            if cat.get(k):
                page[k] = cat[k]
        low = name.lower()
        vids = [v for v in videos if low in v["title"].lower()][:3]
        if vids:
            page["videos"] = vids

        pages.append(page)
        made += 1
        for q in pages:
            q["related"] = [r["slug"] for r in pages if r["ossSlug"] == q["ossSlug"] and r["slug"] != q["slug"]][:6]
        json.dump(pages, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"[{i+1}/{len(todo)}] {slug} ← {res['keyword']}", flush=True)

    print(f"\n生成: +{made}ページ（合計 {len(pages)}）→ data/zenn-list.json")


if __name__ == "__main__":
    main()
