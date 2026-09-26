#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""バイブコーディング的仕事ブログ（/vibeblog/）の記事ごとのトップ画像（1200x630）を作る。

記事の上に出す見出し画像で、そのまま og:image にもする（note の見出し画像と同じ役割）。
これまでは全記事が vibeblog-ogp.png 1枚を共有していて、SNSで共有されると全部同じカードに見えた。

決めごと（feedback_banner_variety）:
  - 題は**省略しない・短くしない**（固有名詞を落とさない）。入りきるまで文字を小さくする
  - 構図と配色は記事の中身（題・タグ・head_keyword）で変える。同じテンプレを並べない
  - 新マスコット（kurage-mascot-cutout.png）を入れる。縦横比は変えない（contain）
  - ライトテーマ

使い方:
  python3 scripts/make_vibeblog_eyecatch.py            # 無いものだけ作る
  python3 scripts/make_vibeblog_eyecatch.py --force    # 全部作り直す
  python3 scripts/make_vibeblog_eyecatch.py --only <slug>
  python3 scripts/make_vibeblog_eyecatch.py --deploy   # 作ったものを exbridge.jp/images/vibeblog/ へ（FTPは1接続）
  python3 scripts/make_vibeblog_eyecatch.py --sync     # サーバーに無いものだけ送る（deploy.sh vibeblog が呼ぶ）

新しい記事の流れ: build-vibeblog.ts が最初にこのスクリプトを呼んで無い画像を作る（画像の有無で
og:image とトップ画像を出し分けるので、ビルドより先に作る必要がある）→ deploy.sh vibeblog が --sync で送る。
出力: /home/kojima/work/exbridge_jp/images/vibeblog/<slug>.png
"""
import argparse, base64, ftplib, glob, hashlib, html, os, re, sys

VWORK_BLOG = "/home/kojima/work/vwork/blog"
OUT = "/home/kojima/work/exbridge_jp/images/vibeblog"
REMOTE = "/web/exbridge_jp/images/vibeblog"
MASCOT = "data:image/png;base64," + base64.b64encode(
    open("/home/kojima/work/kurage_web/images/kurage-mascot-cutout.png", "rb").read()).decode()
LOGO = "data:image/png;base64," + base64.b64encode(
    open("/home/kojima/work/exbridge_jp/images/logo-mark-128.png", "rb").read()).decode()

# 題材 → 配色とモチーフ。上から順に最初に当たったもの
THEMES = [
    ("civic",  r"国会|議員|選挙|議会|政治|TheyWorkForYou|答弁",
     dict(bg="#f3f5fb", ink="#172554", accent="#3346a8", soft="#dde3f6", label="議会と公開データ")),
    ("safety", r"防災|ハザード|災害|避難|洪水|土砂|津波|断層|内水",
     dict(bg="#f1f7fc", ink="#0c2d48", accent="#1d78c1", soft="#d6e8f6", label="防災と公開データ")),
    ("care",   r"介護|福祉|障害|看護|保育|子育て|就労|放課後|グループホーム",
     dict(bg="#fdf6f1", ink="#4a2618", accent="#d0643a", soft="#f7e1d4", label="福祉と公開データ")),
    ("data",   r"実測|ベンチ|計測|測った|比較|検証|問で|分析|データ分析",
     dict(bg="#f4f8f7", ink="#10302b", accent="#0e8a72", soft="#d5ece6", label="実測と検証")),
    ("oss",    r"OSS|オープンソース|GitHub|日本語化|fork|MIT|BSD",
     dict(bg="#f5f9f1", ink="#1f3312", accent="#4c8a1e", soft="#e1efd4", label="OSSを仕事に")),
    ("ai",     r"AI|LLM|モデル|Claude|Codex|gemma|Qwen|エージェント|判断",
     dict(bg="#f7f5fc", ink="#2a1f4d", accent="#6d4fc2", soft="#e7e1f7", label="AIと仕事")),
    ("biz",    r"経営|営業|EC|売上|事業|顧問|受託|内製",
     dict(bg="#fbf8ef", ink="#3a2e0e", accent="#b0860d", soft="#f2e8c9", label="経営と実務")),
    ("vibe",   r".",
     dict(bg="#f6f8f8", ink="#14252b", accent="#0089a1", soft="#d8ecf0", label="バイブコーディング")),
]

CSS = """*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1200px;height:630px;overflow:hidden}
body{background:%(bg)s;color:%(ink)s;font-family:"Noto Sans CJK JP","Noto Sans JP",sans-serif;position:relative}
.brand{position:absolute;display:flex;align-items:center;gap:12px;font-size:22px;font-weight:700;color:%(ink)s}
.brand img{width:34px;height:34px;object-fit:contain}
.label{display:inline-block;font-size:22px;font-weight:700;color:#fff;background:%(accent)s;padding:6px 16px;border-radius:6px;letter-spacing:.04em}
.kw{font-size:22px;font-weight:700;color:%(accent)s}
.date{font-size:22px;color:%(ink)s;opacity:.7;font-variant-numeric:tabular-nums}
.title{font-weight:900;line-height:1.32;letter-spacing:.01em;word-break:auto-phrase;line-break:strict}
.mascot{position:absolute;object-fit:contain;height:auto}
"""

LAYOUTS = {
# A: 左に色帯、題は左寄せ大きく、右下にマスコット
"band": """<div style="position:absolute;left:0;top:0;bottom:0;width:22px;background:%(accent)s"></div>
<div style="position:absolute;left:0;right:0;bottom:0;height:92px;background:%(soft)s"></div>
<div class="brand" style="left:72px;top:46px"><img src="%(logo)s">バイブコーディング的仕事ブログ</div>
<div style="position:absolute;left:72px;top:110px;display:flex;gap:14px;align-items:center"><span class="label">%(label)s</span><span class="kw">%(kw)s</span></div>
<div id="box" style="position:absolute;left:72px;top:166px;width:860px;height:352px;display:flex;align-items:center"><div id="t" class="title">%(title)s</div></div>
<div class="date" style="position:absolute;left:72px;bottom:34px">%(date)s</div>
<img class="mascot" src="%(mascot)s" style="right:40px;bottom:22px;width:230px">""",
# B: 中央のカードに題を中央寄せ、背景に淡い円、マスコットは左下
"card": """<div style="position:absolute;right:-120px;top:-160px;width:560px;height:560px;border-radius:50%%;background:%(soft)s"></div>
<div style="position:absolute;left:-90px;bottom:-200px;width:420px;height:420px;border-radius:50%%;background:%(soft)s"></div>
<div style="position:absolute;left:60px;right:60px;top:56px;bottom:56px;background:#fff;border-radius:22px;border:2px solid %(soft)s"></div>
<div class="brand" style="left:100px;top:86px"><img src="%(logo)s">バイブコーディング的仕事ブログ</div>
<div style="position:absolute;right:100px;top:84px"><span class="label">%(label)s</span></div>
<div id="box" style="position:absolute;left:250px;right:110px;top:150px;height:320px;display:flex;align-items:center;justify-content:center;text-align:center"><div id="t" class="title">%(title)s</div></div>
<div style="position:absolute;left:250px;right:110px;bottom:92px;text-align:center"><span class="kw">%(kw)s</span>　<span class="date">%(date)s</span></div>
<img class="mascot" src="%(mascot)s" style="left:84px;bottom:74px;width:170px">""",
# C: 上に太い帯（ラベルと日付）、題は下段いっぱい、マスコットは帯の右
"top": """<div style="position:absolute;left:0;right:0;top:0;height:150px;background:%(accent)s"></div>
<div class="brand" style="left:64px;top:36px;color:#fff"><img src="%(logo)s" style="background:#fff;border-radius:6px;padding:3px">バイブコーディング的仕事ブログ</div>
<div style="position:absolute;left:64px;top:92px;font-size:24px;font-weight:700;color:#fff;opacity:.95">%(label)s ／ %(date)s</div>
<img class="mascot" src="%(mascot)s" style="right:56px;top:18px;width:200px">
<div id="box" style="position:absolute;left:64px;right:64px;top:190px;height:340px;display:flex;align-items:center"><div id="t" class="title">%(title)s</div></div>
<div style="position:absolute;left:64px;right:64px;bottom:38px;border-top:3px solid %(soft)s;padding-top:14px"><span class="kw">%(kw)s</span></div>""",
}


def load_posts():
    posts = []
    for f in sorted(glob.glob(os.path.join(VWORK_BLOG, "*.md"))):
        name = os.path.basename(f)
        if name in ("README.md", "index.md"):
            continue
        s = open(f, encoding="utf-8").read()
        m = re.match(r"^---\n(.*?)\n---", s, re.S)
        fm = m.group(1) if m else ""
        def g(k):
            mm = re.search(rf"^{k}:\s*(.*)$", fm, re.M)
            return mm.group(1).strip().strip('"').replace('\\"', '"') if mm else ""
        title = g("title")
        if not title or re.search(r"^published:\s*false\s*$", fm, re.M):
            continue
        slug = name[:-3]
        posts.append(dict(slug=slug, title=title, kw=g("head_keyword"),
                          tags=g("tags"), date=(re.match(r"(\d{4})-(\d{2})-(\d{2})", slug) or [None]*4)))
    return posts


def theme_of(p):
    text = " ".join([p["title"], p["kw"], p["tags"]])
    for key, pat, pal in THEMES:
        if re.search(pat, text):
            return key, pal
    return THEMES[-1][0], THEMES[-1][2]


def nobreak(title):
    """英数字の並び（Qwen3.5-4B）と「数字＋助数詞」（3,146か所）を途中で折らない。"""
    t = html.escape(title)
    return re.sub(r"[A-Za-z0-9][A-Za-z0-9.,:/+\-]*(?:か所|カ所|ヶ所|件|人|問|行|本|年|月|日|分|秒|区|円|%|％|倍|社|回|点|枚|字|軒)?",
                  lambda m: f'<span style="white-space:nowrap">{m.group(0)}</span>', t)


def render(page, p, path):
    key, pal = theme_of(p)
    # 同じ題材が続いても同じ絵にならないよう、構図はスラッグから決める
    layout = list(LAYOUTS)[int(hashlib.md5(p["slug"].encode()).hexdigest(), 16) % len(LAYOUTS)]
    d = p["date"]
    date = f"{d[1]}.{d[2]}.{d[3]}" if d and d[0] else ""
    vals = dict(pal, logo=LOGO, mascot=MASCOT, title=nobreak(p["title"]),
                kw=html.escape(p["kw"] or ""), date=date)
    page.set_content(f"<html lang='ja'><head><meta charset='utf-8'><style>{CSS % pal}</style></head>"
                     f"<body>{LAYOUTS[layout] % vals}</body></html>")
    # 題が枠に収まるまで文字を小さくする（省略はしない）
    # 文節で折る（auto-phrase）と長い文節が割れず、44px 未満まで縮むことがある。
    # そのときは普通の折り返しに切り替えて大きい字を優先する（英数字と数字＋助数詞は nobreak で守る）
    fit = None
    for wb, sizes in (("auto-phrase", (84, 76, 68, 62, 56, 52, 48, 44)),
                      ("normal", (84, 76, 68, 62, 56, 52, 48, 44, 40, 37, 34))):
        for size in sizes:
            ok = page.evaluate("""([s, wb]) => {const t=document.getElementById('t'),b=document.getElementById('box');
                t.style.fontSize=s+'px'; t.style.wordBreak=wb;
                return t.scrollHeight<=b.clientHeight && t.scrollWidth<=b.clientWidth}""", [size, wb])
            if ok:
                fit = (size, wb); break
        if fit:
            break
    if not fit:
        raise SystemExit(f"題が入りきらない: {p['slug']}")
    size = f"{fit[0]}px/{fit[1]}"
    page.screenshot(path=path, clip=dict(x=0, y=0, width=1200, height=630))
    return key, layout, size


def ftp_open():
    env = {}
    for l in open("/home/kojima/work/aixec/.env", encoding="utf-8"):
        l = l.strip()
        if l and not l.startswith("#") and "=" in l:
            k, v = l.split("=", 1); env[k] = v.strip().strip('"').strip("'")
    f = ftplib.FTP_TLS(env["FTP_HOST"], timeout=300)
    f.login(env["FTP_USER"], env["FTP_PASS"]); f.prot_p()
    return f


def sync():
    """サーバーに無い画像だけ送る。一覧の取得と送信を1接続で済ませる。"""
    f = ftp_open()
    try:
        f.cwd(REMOTE)
        have = {os.path.basename(x) for x in f.nlst()}
    except ftplib.error_perm:
        f.mkd(REMOTE); f.cwd(REMOTE); have = set()
    todo = [p for p in sorted(glob.glob(os.path.join(OUT, "*.png"))) if os.path.basename(p) not in have]
    for path in todo:
        with open(path, "rb") as fh:
            f.storbinary("STOR " + os.path.basename(path), fh, blocksize=1 << 18)
    f.quit()
    print(f"トップ画像: サーバーに無かった {len(todo)}枚を配置")


def deploy(files):
    env = {}
    for l in open("/home/kojima/work/aixec/.env", encoding="utf-8"):
        l = l.strip()
        if l and not l.startswith("#") and "=" in l:
            k, v = l.split("=", 1); env[k] = v.strip().strip('"').strip("'")
    f = ftplib.FTP_TLS(env["FTP_HOST"], timeout=300)
    f.login(env["FTP_USER"], env["FTP_PASS"]); f.prot_p()
    try:
        f.mkd(REMOTE)
    except ftplib.error_perm:
        pass
    f.cwd(REMOTE)
    for path in files:
        with open(path, "rb") as fh:
            f.storbinary("STOR " + os.path.basename(path), fh, blocksize=1 << 18)
    f.quit()
    print(f"配置: {len(files)}枚 → https://exbridge.jp/images/vibeblog/")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--only")
    ap.add_argument("--deploy", action="store_true", help="今回作ったものを配置（--all-deploy で全部）")
    ap.add_argument("--all-deploy", action="store_true")
    ap.add_argument("--sync", action="store_true")
    a = ap.parse_args()
    if a.sync:
        sync(); return
    os.makedirs(OUT, exist_ok=True)
    posts = [p for p in load_posts() if not a.only or p["slug"] == a.only]
    made = []
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        b = pw.chromium.launch(headless=True)
        page = b.new_page(viewport=dict(width=1200, height=630))
        for p in posts:
            path = os.path.join(OUT, p["slug"] + ".png")
            if os.path.exists(path) and not a.force:
                continue
            key, layout, size = render(page, p, path)
            made.append(path)
            print(f"  {p['slug'][:48]:48} {key:6} {layout:5} {size}")
        b.close()
    print(f"作成 {len(made)}枚 / 記事 {len(posts)}本 → {OUT}")
    if a.all_deploy:
        deploy(sorted(glob.glob(os.path.join(OUT, "*.png"))))
    elif a.deploy and made:
        deploy(made)


if __name__ == "__main__":
    main()
