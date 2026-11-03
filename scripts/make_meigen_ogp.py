#!/usr/bin/env python3
"""Kurage 名言トラッカー（exbridge.jp/meigen/）の OGP 画像 1200x630 を描く（2026-11-03 作成）。

  /usr/bin/python3 scripts/make_meigen_ogp.py [--force]
    → /home/kojima/work/exbridge_jp/images/meigen/<name>.png

描く中身は build-meigen.ts が書き出す outputs/meigen-ogp-specs.json。中身が同じ画像は描き直さない。
カードの決めごと（ユーザー指示「OGP画像に、xb_bittensor と kurageキャラのアイコン画像入れたい」）:
- 主役は名言そのもの（明朝の太字）。言った人と作品名を下に
- 左下に @xb_bittensor のアイコン（丸）と名前、右下に Kurage のマスコット（縦横比を変えない・contain）
- X の返信に貼ると、このカードが出る
"""
import base64
import hashlib
import html
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPECS = ROOT / "outputs" / "meigen-ogp-specs.json"
DONE = ROOT / "outputs" / "meigen-ogp-done.json"
OUT = pathlib.Path("/home/kojima/work/exbridge_jp/images/meigen")


def data_uri(path: str, mime: str) -> str:
    return f"data:{mime};base64," + base64.b64encode(pathlib.Path(path).read_bytes()).decode()


MASCOT = data_uri("/home/kojima/work/kurage_web/images/kurage-mascot-cutout.png", "image/png")
AVATAR = data_uri("/home/kojima/work/kmeigen/data/xb_bittensor_avatar.jpg", "image/jpeg")

CSS = """*{box-sizing:border-box;margin:0;padding:0}
body{width:1200px;height:630px;font-family:"Noto Sans CJK JP",sans-serif;background:#fbf8f1;color:#1d2a30;position:relative;overflow:hidden}
.band{position:absolute;left:0;top:0;bottom:0;width:14px;background:linear-gradient(180deg,#0a9a8f,#007f96)}
.kicker{position:absolute;left:70px;top:40px;font-size:24px;font-weight:900;color:#0a7f78;letter-spacing:.02em}
.q{position:absolute;left:70px;top:92px;width:800px;height:360px;display:flex;align-items:center}
.q p{font-family:"Noto Serif CJK JP","Noto Serif CJK SC",serif;font-weight:900;line-height:1.5;color:#18262c;white-space:pre-line;
  display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden}
.mark{position:absolute;left:46px;top:70px;font-family:"Noto Serif CJK JP",serif;font-size:120px;line-height:1;color:#cfe8e2;font-weight:900}
.by{position:absolute;left:70px;top:470px;width:820px;font-size:28px;font-weight:800;color:#33464e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.by small{font-size:22px;font-weight:700;color:#6a7a80;margin-left:10px}
.me{position:absolute;left:70px;bottom:30px;display:flex;align-items:center;gap:14px}
.me img{width:64px;height:64px;border-radius:50%;object-fit:cover;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.15)}
.me b{display:block;font-size:24px;color:#18262c}.me span{display:block;font-size:18px;color:#6a7a80;font-weight:700}
.m{position:absolute;right:50px;bottom:40px;width:230px;height:auto;object-fit:contain}
.brand{position:absolute;right:52px;top:40px;font-size:20px;font-weight:900;color:#0a7f78}"""


def size_for(t: str) -> tuple[int, int]:
    n = len(t.replace("\n", ""))
    lines = t.count("\n") + 1
    if n <= 14 and lines <= 2:
        return 72, 3
    if n <= 30:
        return 58, 4
    if n <= 50:
        return 48, 5
    if n <= 75:
        return 40, 6
    return 34, 7


def page(spec: dict) -> str:
    t = spec["text"]
    if len(t.replace("\n", "")) > 120:
        t = t.replace("\n", "　")[:118] + "…"
    fs, clamp = size_for(t)
    by = html.escape(spec["speaker"])
    work = f'<small>{html.escape(spec["work"])}</small>' if spec.get("work") else ""
    return (f'<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>{CSS}</style></head><body><div class="band"></div>'
            f'<div class="kicker">{html.escape(spec.get("theme") or "")}</div><div class="brand">Kurage 名言トラッカー</div><div class="mark">“</div>'
            f'<div class="q"><p style="font-size:{fs}px;-webkit-line-clamp:{clamp}">{html.escape(t)}</p></div>'
            f'<div class="by">— {by}{work}</div>'
            f'<div class="me"><img src="{AVATAR}"><div><b>@xb_bittensor</b><span>exbridge.jp/meigen</span></div></div>'
            f'<img class="m" src="{MASCOT}"></body></html>')


def main() -> int:
    specs = json.loads(SPECS.read_text())
    done = json.loads(DONE.read_text()) if DONE.exists() and "--force" not in sys.argv else {}
    OUT.mkdir(parents=True, exist_ok=True)
    todo = []
    for s in specs:
        key = hashlib.sha1((json.dumps(s, ensure_ascii=False, sort_keys=True) + CSS).encode()).hexdigest()
        if done.get(s["name"]) != key or not (OUT / f"{s['name']}.png").exists():
            todo.append((s, key))
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1200, "height": 630})
        for s, key in todo:
            pg.set_content(page(s), wait_until="load")
            pg.screenshot(path=str(OUT / f"{s['name']}.png"))
            done[s["name"]] = key
        b.close()
    DONE.write_text(json.dumps(done, ensure_ascii=False, indent=1))
    print(f"meigen OGP: {len(todo)}枚を描いた（全{len(specs)}枚）→ {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
