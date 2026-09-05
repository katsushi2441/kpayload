#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""カテゴリページのOGP画像(1200x630)をカテゴリごとに作る。

なぜ作るか（2026-09-06）:
  /oss/c/ /ai-system/c/ /solution/ の全カテゴリが同じOGP画像を共有していた。
  さらに /oss/ 側は kurage-mascot-simple-v2.png（1254x1254の正方形）で、
  OGPの推奨比(1.91:1)から外れてSNS・検索のカードで切れていた。
  カテゴリ名が入った画像にすると、共有されたときに何のページか分かる。

生成方法:
  banner.html と同じくHTMLを組んで Playwright で撮る（フォント指定を1か所にできる）。

使い方:
  python3 scripts/make_category_ogp.py --which oss|cap|solution|all [--limit N]
出力:
  oss      → /home/kojima/work/kurage_web/images/ogp/oss-<key>.png
  cap      → /home/kojima/work/exbridge_jp/images/ogp/cap-<key>.png
  solution → /home/kojima/work/exbridge_jp/images/ogp/sol-<key>.png
"""
import argparse
import base64
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
KURAGE_WEB = "/home/kojima/work/kurage_web"
EXBRIDGE = "/home/kojima/work/exbridge_jp"
MASCOT_PATH = "/home/kojima/work/kurage_web/images/kurage-mascot-cutout.png"
# set_content で読み込むページには origin が無く file:// を解決できないので data URI にする
with open(MASCOT_PATH, "rb") as _fh:
    MASCOT = "data:image/png;base64," + base64.b64encode(_fh.read()).decode("ascii")

TPL = """<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{width:1200px;height:630px;overflow:hidden;position:relative;background:#fff;color:#12202f;
 font-family:"Noto Sans CJK JP",sans-serif}
.bg{position:absolute;inset:0;background:linear-gradient(155deg,#fff 0%,#f6f9fb 52%,#eef7f5 100%)}
.chip{position:absolute;top:52px;left:64px;font-size:22px;font-weight:900;color:#fff;
 background:{{ACCENT}};border-radius:10px;padding:9px 20px}
.t{position:absolute;top:150px;left:64px;right:330px;font-size:{{SIZE}}px;font-weight:900;
 line-height:1.22;letter-spacing:-1px}
.sub{position:absolute;top:{{SUBTOP}}px;left:64px;right:330px;font-size:26px;font-weight:800;color:#42556a;line-height:1.5}
.brand{position:absolute;bottom:44px;left:64px;font-size:19px;font-weight:700;color:#8a97a5}
.mascot{position:absolute;right:52px;bottom:34px;width:232px;
 filter:drop-shadow(0 6px 16px rgba(0,0,0,.16))}
</style></head><body>
<div class="bg"></div>
<div class="chip">{{CHIP}}</div>
<div class="t">{{TITLE}}</div>
<div class="sub">{{SUB}}</div>
<div class="brand">{{BRAND}}</div>
<img class="mascot" src="{{MASCOT}}">
</body></html>"""


def build_html(chip, title, sub, brand, accent):
    """長い見出しは自動で縮める。3行に折れると mascot と重なるため。"""
    n = len(title)
    size = 62 if n <= 12 else (54 if n <= 17 else (46 if n <= 24 else 38))
    subtop = 150 + int(size * 1.22 * (2 if n > 17 else 1)) + 26
    html = TPL
    for k, v in (("{{CHIP}}", chip), ("{{TITLE}}", title), ("{{SUB}}", sub),
                 ("{{BRAND}}", brand), ("{{ACCENT}}", accent),
                 ("{{SIZE}}", str(size)), ("{{SUBTOP}}", str(min(subtop, 470))),
                 ("{{MASCOT}}", MASCOT)):
        html = html.replace(k, str(v))
    return html


def count_oss_in(key):
    """そのカテゴリに何件あるかを生成済みHTMLから拾う（数字を発明しない）。"""
    p = os.path.join(KURAGE_WEB, "oss", "c", key, "index.html")
    if not os.path.exists(p):
        return None
    import re
    m = re.search(r"オープンソースを(\d+)件", open(p, encoding="utf-8", errors="replace").read())
    return int(m.group(1)) if m else None


def targets(which):
    cats = json.load(open(os.path.join(ROOT, "outputs-cats.json"), encoding="utf-8"))
    out = []
    if which in ("oss", "all"):
        labels = {c["key"]: c["label"] for c in cats["oss"]}
        base = os.path.join(KURAGE_WEB, "oss", "c")
        for key in sorted(os.listdir(base)) if os.path.isdir(base) else []:
            if not os.path.isdir(os.path.join(base, key)):
                continue
            label = labels.get(key, key)
            n = count_oss_in(key)
            out.append((os.path.join(KURAGE_WEB, "images", "ogp", "oss-{}.png".format(key)),
                        "OSS一覧", "{}のOSS".format(label),
                        ("{}件を掲載／ライセンスと日本語対応を明記".format(n)) if n else "ライセンスと日本語対応を明記",
                        "Kurage — 株式会社エクスブリッジ", "#0a9a8f"))
    if which in ("cap", "all"):
        base = os.path.join(EXBRIDGE, "ai-system", "c")
        have = set(os.listdir(base)) if os.path.isdir(base) else set()
        for c in cats["cap"]:
            if c["key"] not in have:
                continue
            out.append((os.path.join(EXBRIDGE, "images", "ogp", "cap-{}.png".format(c["key"])),
                        "AIでできること", c["label"],
                        "使えるオープンソースと導入の進め方",
                        "株式会社エクスブリッジ（名古屋）", "#12a99f"))
    if which in ("solution", "all"):
        p = os.path.join(ROOT, "data", "solution-list.json")
        for it in json.load(open(p, encoding="utf-8")):
            out.append((os.path.join(EXBRIDGE, "images", "ogp", "sol-{}.png".format(it["slug"])),
                        "業種・業務別", it["name"],
                        str(it.get("kicker") or "使えるSaaS・OSSと導入の進め方")[:34],
                        "株式会社エクスブリッジ（名古屋）", "#0a726b"))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--which", default="all", choices=["oss", "cap", "solution", "all"])
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    jobs = targets(args.which)
    if args.limit:
        jobs = jobs[:args.limit]
    for path, _, _, _, _, _ in jobs:
        os.makedirs(os.path.dirname(path), exist_ok=True)

    from playwright.sync_api import sync_playwright
    made = 0
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1200, "height": 630})
        for path, chip, title, sub, brand, accent in jobs:
            pg.set_content(build_html(chip, title, sub, brand, accent), wait_until="load")
            pg.screenshot(path=path)
            made += 1
            if made % 40 == 0:
                print("  {}/{}".format(made, len(jobs)), flush=True)
        b.close()
    print("  生成 {} 枚".format(made))


if __name__ == "__main__":
    main()
