#!/usr/bin/env python3
"""Kurage AIエージェント開発トラッカー（exbridge.jp/agent/）の OGP 画像 1200x630。2026-11-07 作成。

  /usr/bin/python3 scripts/make_agent_ogp.py [--force]
    → /home/kojima/work/exbridge_jp/images/agent/<name>.png

中身は build-agent.ts が書き出す outputs/agent-ogp-specs.json。中身が同じ画像は描き直さない。
X の返信に URL を貼るとこのカードが出る。左下に @xb_bittensor、右下に Kurage のマスコット（変形させない・contain）。
"""
import base64, hashlib, html, json, pathlib, sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPECS = ROOT / "outputs" / "agent-ogp-specs.json"
DONE = ROOT / "outputs" / "agent-ogp-done.json"
OUT = pathlib.Path("/home/kojima/work/exbridge_jp/images/agent")


def data_uri(path: str, mime: str) -> str:
    return f"data:{mime};base64," + base64.b64encode(pathlib.Path(path).read_bytes()).decode()


MASCOT = data_uri("/home/kojima/work/kurage_web/images/kurage-mascot-cutout.png", "image/png")
AVATAR = data_uri("/home/kojima/work/kmeigen/data/xb_bittensor_avatar.jpg", "image/jpeg")

CSS = """*{box-sizing:border-box;margin:0;padding:0}
body{width:1200px;height:630px;font-family:"Noto Sans CJK JP",sans-serif;background:#f3f8fb;color:#12202f;position:relative;overflow:hidden}
.grid{position:absolute;inset:0;background-image:linear-gradient(#e2edf3 1px,transparent 1px),linear-gradient(90deg,#e2edf3 1px,transparent 1px);background-size:40px 40px}
.band{position:absolute;left:0;top:0;bottom:0;width:14px;background:linear-gradient(180deg,#12202f,#0a9a8f)}
.brand{position:absolute;left:70px;top:40px;font-size:24px;font-weight:900;color:#0a7f78}
.badge{position:absolute;right:52px;top:36px;font-size:22px;font-weight:900;color:#fff;background:#12202f;border-radius:999px;padding:6px 20px}
.t{position:absolute;left:70px;top:110px;width:830px;display:flex;flex-direction:column;gap:16px}
.h{font-weight:900;line-height:1.15;overflow-wrap:anywhere;font-family:"Noto Sans Mono CJK JP","Noto Sans CJK JP",monospace}
.s{font-size:32px;font-weight:700;color:#37485a;line-height:1.45;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}
.chips{position:absolute;left:70px;top:420px;display:flex;gap:12px;flex-wrap:wrap;width:820px}
.chips span{background:#fff;border:2px solid #bfe4de;border-radius:999px;padding:6px 18px;font-size:24px;font-weight:800;color:#0a5f58}
.me{position:absolute;left:70px;bottom:30px;display:flex;align-items:center;gap:14px}
.me img{width:64px;height:64px;border-radius:50%;object-fit:cover;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.15)}
.me b{display:block;font-size:24px}.me span{display:block;font-size:18px;color:#5b6b70;font-weight:700}
.m{position:absolute;right:50px;bottom:36px;width:240px;height:auto;object-fit:contain}"""


def page(s: dict) -> str:
    t = s["title"]
    w = sum(0.62 if ord(c) < 0x1100 else 1.0 for c in t)   # 文字幅（英数は日本語の約0.6）で決めて、830pxに1行で収める
    fs = max(40, min(96, int(830 / max(w, 1))))
    mono = all(ord(c) < 0x1100 for c in t)
    chips = "".join(f"<span>{html.escape(c)}</span>" for c in s["chips"] if c)
    return (f'<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>{CSS}</style></head><body><div class="grid"></div><div class="band"></div>'
            f'<div class="brand">Kurage AIエージェント開発トラッカー</div><div class="badge">{html.escape(s["badge"])}</div>'
            f'<div class="t"><div class="h" style="font-size:{fs}px;white-space:nowrap;{"" if mono else "font-family:Noto Sans CJK JP,sans-serif"}">{html.escape(t)}</div><div class="s">{html.escape(s["sub"])}</div></div>'
            f'<div class="chips">{chips}</div>'
            f'<div class="me"><img src="{AVATAR}"><div><b>@xb_bittensor</b><span>exbridge.jp/agent</span></div></div>'
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
    print(f"agent OGP: {len(todo)}枚を描いた（全{len(specs)}枚）→ {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
