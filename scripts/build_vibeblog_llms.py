#!/usr/bin/env python3
"""/vibeblog/llms.txt を作る。AI 検索（ChatGPT・Perplexity・Claude など）が記事を見つけて引用する入口（2026-10-08）。

  /usr/bin/python3 scripts/build_vibeblog_llms.py      → dist/vibeblog/llms.txt

- build-vibeblog.ts が書き出した dist/vibeblog/*.html から、題名（h1）・説明文・公開日・区分を読む。手で書かない。
- 区分（VWork Blog ＝ 仕事の記録／AI OSS技術解説）ごとに、新しい順に並べる。
- deploy.sh vibeblog が配置の前に呼ぶので、記事を足せば自動で載る。トップの /llms.txt からここへリンクしている。
"""
import glob
import html
import os
import re

KP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(KP, "dist", "vibeblog")
BASE = "https://exbridge.jp/vibeblog/"


def pick(pat, s):
    m = re.search(pat, s, re.S)
    return html.unescape(re.sub(r"<[^>]+>", "", m.group(1))).strip() if m else ""


def main():
    posts = []
    for f in glob.glob(os.path.join(DIST, "*.html")):
        name = os.path.basename(f)
        if not re.match(r"\d{4}-\d{2}-\d{2}-", name):
            continue
        s = open(f, encoding="utf-8").read()
        title = pick(r"<h1[^>]*>(.*?)</h1>", s) or pick(r"<title>(.*?)</title>", s)
        desc = pick(r'<meta name="description" content="([^"]*)"', s)
        date = pick(r'"datePublished":"([^"]*)"', s) or name[:10]
        sec = pick(r'"articleSection":"([^"]*)"', s) or "VWork Blog"
        if not title:
            continue
        desc = re.sub(r"\s+", " ", desc)
        if len(desc) > 160:
            desc = desc[:158] + "…"
        posts.append((sec, date, title, desc, BASE + name))
    secs = {"VWork Blog": "仕事の記録（AIとオープンソースで業務システムを作る・公開データを調べる）",
            "AI OSS技術解説": "AIのオープンソースの技術解説"}
    out = ["# バイブコーディング的仕事ブログ（株式会社エクスブリッジ）", "",
           "> 名古屋のAIシステム開発会社 株式会社エクスブリッジが、AIエージェント（Claude Code など）と"
           "オープンソースで業務システムを作り、公開データを調べた記録です。数字は国・自治体の公開データや"
           "国会会議録から取り、出典を記事に書いています。", "",
           f"記事 {len(posts)}本。一覧: {BASE}", ""]
    for sec in sorted({p[0] for p in posts}, key=lambda x: (x != "VWork Blog", x)):
        ps = sorted([p for p in posts if p[0] == sec], key=lambda p: p[1], reverse=True)
        out += [f"## {sec} — {secs.get(sec, sec)}", ""]
        out += [f"- [{t}]({u})（{dt}）: {ds}" for _, dt, t, ds, u in ps]
        out.append("")
    open(os.path.join(DIST, "llms.txt"), "w", encoding="utf-8").write("\n".join(out))
    print(f"llms.txt: {len(posts)}本 → {os.path.join(DIST, 'llms.txt')}")


if __name__ == "__main__":
    main()
