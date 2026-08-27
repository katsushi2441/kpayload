#!/usr/bin/env python3
"""Zennの記事1本ごとに /zenn/<oss>-<theme>.html 用のデータを作る。

流れ:
  1. zenn_hits3.json（OSS→記事リスト）から候補を取る
  2. 各記事の本文を Zenn API で取得し、そのOSSの話かを判定（一般語slugの誤マッチ除去）
  3. codex CLI に本文を読ませて、テーマ・検索キーワード・ページタイトル・
     リード文・記事紹介文・要点を書かせる
  4. data/zenn-list.json に1記事1ページの形で書き出す

codexに守らせること（プロンプトに明記）:
  - 記事に書かれていないことを足さない
  - 著者の主張として書く（当社の断定にしない）
  - 宣伝を書かない（導線はテンプレート側にある）
  - themeは英小文字とハイフンだけ（URLになる）

使い方:
  python3 scripts/zenn-collect.py --limit 30     # 30記事だけ試す
  python3 scripts/zenn-collect.py                # 未処理を全部
"""
import json, os, re, subprocess, sys, tempfile, time, urllib.request, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCR = "/tmp/claude-1000/-home-kojima-work/7230f738-72fc-4ac2-ae71-cd89b6f444a1/scratchpad"
OUT = f"{ROOT}/data/zenn-list.json"
UA = {"User-Agent": "Mozilla/5.0 (compatible; exbridge-oss-catalog/1.0; +https://exbridge.jp/)"}

MIN_LIKED = 1        # ♥0の記事は拾わない（内容の薄い記事を避ける）
MIN_LETTERS = 1200   # 本文が短すぎる記事は拾わない

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

PROMPT = """あなたは日本語のテクニカルライターです。オープンソース「{name}」に関するZennの記事を読んで、その記事を紹介するページの材料を作ってください。

## 対象のOSS
名前: {name}
説明: {summary}

## Zennの記事
タイトル: {title}
本文（抜粋）:
{body}

## 作ってほしいもの

- relevant: この記事が本当に「{name}」を扱っているならtrue。名前が一致しているだけで別物の話ならfalse。
- theme: この記事の主題を表す英小文字とハイフンだけの短い語（URLの一部になる）。例: customize / self-host / nextjs-integration / auth / migration / performance。2〜3語まで。
- keyword: 日本語の検索キーワード。「{name} ○○」の形にする（例: 「{name} カスタマイズ」）。この記事を探している人が実際に打ちそうな語にする。
- pageTitle: ページの見出し。keywordを含み、38〜52字程度。煽らず、内容を表す。末尾に社名や記号を付けない。
- lead: このページのリード文。2〜3文（110〜170字）。「このキーワードで来た人が、この記事から何を得られるか」を書く。
- summary: 記事の紹介文。2〜3文（100〜160字）。記事に書かれている範囲だけで書く。
- points: 記事に書かれている項目を3〜5個。1個15〜40字の体言止め。

## 厳守すること

- 本文に書かれていないことを足さない。推測で機能・結論・数値を書かない。
- 記事の主張は著者のものとして書く（「〜と報告されています」「〜の手順が書かれています」）。当社の意見として断定しない。
- 宣伝・営業文を書かない。価格や自社サービスに触れない。
- 「必見」「完全」「最強」「決定版」のような煽り言葉を使わない。
- themeは必ず英小文字・数字・ハイフンのみ。日本語やスペースを入れない。
"""


def get_json(url, timeout=20, retries=2):
    for _ in range(retries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(90)
                continue
            return None
        except Exception:
            return None
    return None


def plain(html, limit=4200):
    t = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html or "", flags=re.S)
    t = re.sub(r"<[^>]+>", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t[:limit]


def name_variants(name, slug, github):
    v = {name.lower(), slug.lower(), slug.replace("-", " ").lower(), slug.replace("-", "").lower(),
         re.sub(r"[^a-z0-9]", "", name.lower())}
    if github:
        m = re.search(r"github\.com/[^/]+/([^/#?]+)", github)
        if m:
            v.add(m.group(1).lower())
    return {x for x in v if len(x) >= 3}


def run_codex(name, oss_summary, title, body, tries=2):
    prompt = PROMPT.format(name=name, summary=oss_summary or "(説明なし)", title=title, body=body)
    with tempfile.TemporaryDirectory() as td:
        sf, of = f"{td}/schema.json", f"{td}/out.json"
        json.dump(SCHEMA, open(sf, "w"))
        for _ in range(tries):
            try:
                subprocess.run(
                    ["codex", "exec", "--sandbox", "read-only", "--skip-git-repo-check",
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

    hits = json.load(open(f"{SCR}/zenn_hits3.json", encoding="utf-8"))
    catalog = {x["slug"]: x for x in json.load(open(f"{ROOT}/data/oss-catalog.json", encoding="utf-8"))}
    projects = {x["slug"]: x for x in json.load(open(f"{SCR}/oss_projects.json", encoding="utf-8"))}
    videos = json.load(open(f"{SCR}/kuragev_videos.json", encoding="utf-8")) if os.path.exists(f"{SCR}/kuragev_videos.json") else []

    pages = json.load(open(OUT, encoding="utf-8")) if os.path.exists(OUT) else []
    seen_articles = {p["article"]["path"] for p in pages}
    used_slugs = {p["slug"] for p in pages}

    # 候補を「いいねが多い順」に並べ、良い記事から作る
    cands = []
    for oss_slug, arts in hits.items():
        if oss_slug.startswith("_"):
            continue
        for a in arts:
            if a["path"] in seen_articles:
                continue
            if (a.get("liked") or 0) < MIN_LIKED:
                continue
            cands.append((oss_slug, a))
    cands.sort(key=lambda x: -(x[1].get("liked") or 0))
    if limit:
        cands = cands[:limit]
    print(f"候補: {len(cands)}記事（既存 {len(pages)}ページ）")

    made = 0
    for i, (oss_slug, a) in enumerate(cands):
        cat = catalog.get(oss_slug) or {}
        proj = projects.get(oss_slug) or {}
        name = cat.get("name") or proj.get("name") or oss_slug
        variants = name_variants(name, oss_slug, cat.get("githubUrl") or proj.get("githubUrl"))

        d = get_json(f"https://zenn.dev/api/articles/{a['path'].rsplit('/', 1)[-1]}")
        time.sleep(1.2)
        art = (d or {}).get("article") or {}
        if (art.get("body_letters_count") or 0) < MIN_LETTERS:
            print(f"  skip(短い) {oss_slug} / {a['title'][:30]}", flush=True)
            continue
        body = plain(art.get("body_html"))
        hay = (a["title"] + " " + body).lower()
        if not any(v in hay for v in variants):
            print(f"  skip(無関係) {oss_slug} / {a['title'][:30]}", flush=True)
            continue

        res = run_codex(name, cat.get("summary") or proj.get("summary", ""), a["title"], body)
        if not res or not res.get("relevant"):
            print(f"  skip(codex判定) {oss_slug} / {a['title'][:30]}", flush=True)
            continue

        theme = re.sub(r"[^a-z0-9-]", "", (res["theme"] or "").lower()).strip("-") or "guide"
        slug = f"{oss_slug}-{theme}"
        n = 2
        while slug in used_slugs:
            slug = f"{oss_slug}-{theme}-{n}"
            n += 1
        used_slugs.add(slug)

        page = {
            "slug": slug, "ossSlug": oss_slug, "ossName": name,
            "theme": theme, "keyword": res["keyword"], "pageTitle": res["pageTitle"], "lead": res["lead"],
            "article": {
                "title": a["title"], "path": a["path"], "emoji": a.get("emoji"),
                "published_at": a.get("published_at"), "liked": a.get("liked"),
                "user": a.get("user"), "name": a.get("name"),
                "summary": res["summary"], "points": res.get("points", [])[:5],
            },
            "ossSummary": cat.get("summary") or proj.get("summary") or "",
            "category": cat.get("category") or proj.get("category") or "other",
        }
        for k in ("lpUrl", "buyUrl", "brainUrl", "brainLabel"):
            if cat.get(k):
                page[k] = cat[k]
        vids = [v for v in videos if any(x in v["title"].lower() for x in variants)][:3]
        if vids:
            page["videos"] = vids

        pages.append(page)
        made += 1
        # 同じOSSの他ページを相互リンク
        for p in pages:
            p["related"] = [q["slug"] for q in pages if q["ossSlug"] == p["ossSlug"] and q["slug"] != p["slug"]][:6]
        json.dump(pages, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"[{i+1}/{len(cands)}] {slug} ← {res['keyword']}", flush=True)

    print(f"\n生成: +{made}ページ（合計 {len(pages)}）→ data/zenn-list.json")


if __name__ == "__main__":
    main()
