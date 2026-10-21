#!/usr/bin/env python3
"""論文トラッカー（exbridge.jp/academic/）のOGP画像 1200x630 を描く。

  /usr/bin/python3 scripts/make_academic_ogp.py [--force]
    → /home/kojima/work/exbridge_jp/images/academic/<name>.png

描く中身は build-academic.ts が書き出す outputs/academic-ogp-specs.json（テーマ・研究者・一覧）。
中身が前回と同じ画像は描き直さない（記録 outputs/academic-ogp-done.json）。数字が主役の構図
（vibeblog の実測で、題名だけの画像より名前と数字の入ったカードのほうが X で人が来た）。
"""
import base64
import hashlib
import html
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPECS = ROOT / "outputs" / "academic-ogp-specs.json"
DONE = ROOT / "outputs" / "academic-ogp-done.json"
OUT = pathlib.Path("/home/kojima/work/exbridge_jp/images/academic")


def data_uri(path: str, mime: str) -> str:
    return f"data:{mime};base64," + base64.b64encode(pathlib.Path(path).read_bytes()).decode()


MASCOT = data_uri("/home/kojima/work/kurage_web/images/kurage-mascot-cutout.png", "image/png")
LOGO = data_uri("/home/kojima/work/exbridge_jp/images/logo-mark-128.png", "image/png")

CSS = """*{box-sizing:border-box;margin:0;padding:0}
body{width:1200px;height:630px;font-family:"Noto Sans CJK JP",sans-serif;background:#f4f7f7;color:#132329;position:relative;overflow:hidden}
.band{position:absolute;left:0;top:0;bottom:0;width:14px;background:linear-gradient(180deg,#007f96,#0a9a8f)}
.top{position:absolute;left:64px;top:44px;display:flex;align-items:center;gap:12px;font-size:24px;font-weight:700;color:#3d5566}
.top img{width:40px;height:40px}
.kicker{position:absolute;left:64px;top:118px;font-size:26px;font-weight:900;color:#007f96}
h1{position:absolute;left:64px;top:162px;width:820px;font-weight:900;line-height:1.25;color:#10242b}
.sub{position:absolute;left:66px;font-size:30px;font-weight:700;color:#3d5566}
.stats{position:absolute;left:64px;bottom:56px;display:flex;gap:14px;flex-wrap:nowrap}
.stats div{background:#fff;border:2px solid #dbe5e8;border-radius:18px;padding:12px 22px 14px;min-width:150px}
.stats b{display:block;font-size:54px;line-height:1.1;color:#007f96;font-weight:900}
.stats span{display:block;font-size:20px;font-weight:700;color:#5a6a72;max-width:330px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.m{position:absolute;right:46px;top:120px;width:250px;height:auto;object-fit:contain}
.url{position:absolute;right:56px;bottom:22px;font-size:18px;color:#7a8a92;font-weight:700}"""


def page(spec: dict) -> str:
    title = html.escape(spec["title"])
    n = len(spec["title"])
    size = 84 if n <= 8 else 68 if n <= 14 else 56 if n <= 20 else 46
    sub_top = 162 + int(size * 1.25) * (1 if n * size < 820 else 2) + 18
    stats = "".join(f"<div><b>{html.escape(a)}</b><span>{html.escape(b)}</span></div>" for a, b in spec.get("stats", []))
    sub = f'<div class="sub" style="top:{sub_top}px">{html.escape(spec["sub"])}</div>' if spec.get("sub") else ""
    return (f'<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>{CSS}</style></head><body><div class="band"></div>'
            f'<div class="top"><img src="{LOGO}">株式会社エクスブリッジ</div><div class="kicker">{html.escape(spec["kicker"])}</div>'
            f'<h1 style="font-size:{size}px">{title}</h1>{sub}<img class="m" src="{MASCOT}">'
            f'<div class="stats">{stats}</div><div class="url">exbridge.jp/academic</div></body></html>')


def main() -> None:
    specs = json.loads(SPECS.read_text())
    done = {} if "--force" in sys.argv or not DONE.exists() else json.loads(DONE.read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    todo = [s for s in specs if done.get(s["name"]) != hashlib.sha1(json.dumps(s, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
            or not (OUT / f"{s['name']}.png").exists()]
    print(f"OGP: {len(specs)}枚中 {len(todo)}枚を描く", flush=True)
    if todo:
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_page(viewport={"width": 1200, "height": 630})
            for s in todo:
                pg.set_content(page(s), wait_until="load")
                pg.screenshot(path=str(OUT / f"{s['name']}.png"))
                done[s["name"]] = hashlib.sha1(json.dumps(s, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
            b.close()
    DONE.write_text(json.dumps(done, ensure_ascii=False, indent=0))
    print("→", OUT)


if __name__ == "__main__":
    main()
