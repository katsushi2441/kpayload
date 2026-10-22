#!/usr/bin/env python3
"""Kurage 省庁トラッカー（exbridge.jp/shocho/）のPV（約18秒・音なし）。H3実写2本＋画面3枚＋エンドカード。
  /usr/bin/python3 scripts/shocho_pv.py            → outputs/shocho_pv/shocho-tracker-pv.mp4 と poster.jpg
  /usr/bin/python3 scripts/shocho_pv.py --deploy   → kurage.exbridge.jp/pv/ に置き、kpv 台帳に載せる
実写は kpvgen/outputs/h3_queue の既存クリップ（MiniMax H3）。画面は outputs/shocho_pv/assets/（公開ページの撮影）。
scripts/academic_pv.py を元にした（2026-10-23）。価格は入れない。
"""
import datetime
import ftplib
import io
import json
import os
import subprocess
import sys
import urllib.request

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, "outputs", "shocho_pv")
ASSETS = os.path.join(OUT, "assets")
H3 = "/home/kojima/work/kpvgen/outputs/h3_queue"
FB = "/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc"
FM = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
W, H = 1920, 1080
INK, ACC, GRAY, PAPER = "#12202f", "#0a726b", "#5d6b7a", "#f6f5f0"
FADE = 0.4
PAGE = "https://exbridge.jp/shocho/"
NAME = "shocho-tracker-pv"
BASE = "https://kurage.exbridge.jp/pv/"
# (種類, 素材, 秒, 文字)
SCENES = [
    ("clip", "h3-khouan-a-8s.mp4", 3.4, ["その省庁の発表は、", "国会でどう議論されているか"]),
    ("clip", "h3-giin-a-8s.mp4", 3.4, ["8府省の新着を毎日取り込み", "国会の質疑・答弁と結ぶ"]),
    ("fig", "index.png", 3.2, ["Kurage 省庁トラッカー", "省庁の発表 × 国会の議論"]),
    ("fig", "item_kokkai.png", 3.4, ["発表ごとに、同じ話題の", "国会の質疑と答弁を並べる"]),
    ("fig", "tracker_shocho.png", 3.2, ["国会トラッカーからも", "省庁の新しい発表へ"]),
    ("end", None, 3.6, None),
]


def overlay(lines):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(im)
    for y in range(H // 2, H):
        dr.line([(0, y), (W, y)], fill=(8, 16, 24, int(210 * (y - H // 2) / (H // 2))))
    f = ImageFont.truetype(FB, 88)
    y0 = H - 130 - (len(lines) - 1) * 116
    for i, ln in enumerate(lines):
        dr.text((W / 2, y0 + i * 116), ln, font=f, fill="white", anchor="mm", stroke_width=3, stroke_fill=(8, 16, 24))
    dr.text((W - 40, H - 28), "映像生成: MiniMax H3（イメージ）", font=ImageFont.truetype(FM, 24), fill=(220, 228, 232), anchor="rb")
    return im


def fig_frame(name, lines):
    im = Image.new("RGB", (W, H), PAPER)
    dr = ImageDraw.Draw(im)
    for i, ln in enumerate(lines):
        dr.text((W / 2, 110 + i * 84), ln, font=ImageFont.truetype(FB, 68), fill=INK if i == 0 else ACC, anchor="mm")
    c = Image.open(os.path.join(ASSETS, name)).convert("RGB")
    bw, bh = W - 160, H - 300
    s = min(bw / c.width, bh / c.height)
    c = c.resize((round(c.width * s), round(c.height * s)), Image.LANCZOS)
    x, y = (W - c.width) // 2, 250 + (bh - c.height) // 2
    dr.rounded_rectangle([x - 6, y - 6, x + c.width + 6, y + c.height + 6], radius=12, fill="#dedbd0")
    im.paste(c, (x, y))
    return im


def end_frame():
    im = Image.new("RGB", (W, H), PAPER)
    dr = ImageDraw.Draw(im)
    dr.text((W / 2, 280), "Kurage 省庁トラッカー", font=ImageFont.truetype(FM, 62), fill=ACC, anchor="mm")
    dr.text((W / 2, 410), "省庁の発表と、", font=ImageFont.truetype(FB, 80), fill=INK, anchor="mm")
    dr.text((W / 2, 520), "国会の議論を、1ページに。", font=ImageFont.truetype(FB, 80), fill=ACC, anchor="mm")
    dr.text((W / 2, 650), "デジタル庁・厚労省・国交省など8府省の新着と、国会の質疑・答弁", font=ImageFont.truetype(FM, 44), fill=GRAY, anchor="mm")
    dr.text((W / 2, 770), "exbridge.jp/shocho/", font=ImageFont.truetype(FM, 52), fill=ACC, anchor="mm")
    logo = Image.open("/home/kojima/work/exbridge_jp/images/logo-mark-128.png").convert("RGBA").resize((72, 72))
    im.paste(logo, (W // 2 - 260, 890), logo)
    dr.text((W // 2 - 170, 926), "株式会社エクスブリッジ", font=ImageFont.truetype(FM, 44), fill=INK, anchor="lm")
    dr.text((W - 40, H - 28), "映像生成: MiniMax H3", font=ImageFont.truetype(FM, 24), fill=GRAY, anchor="rb")
    return im


def build():
    os.makedirs(OUT, exist_ok=True)
    inputs, filt, labels = [], [], []
    k = 0
    for i, (kind, src, sec, lines) in enumerate(SCENES):
        if kind == "clip":
            ov = os.path.join(OUT, f"ov{i}.png"); overlay(lines).save(ov)
            inputs += ["-ss", "0.3", "-t", str(sec + 0.3), "-i", os.path.join(H3, src), "-loop", "1", "-t", str(sec), "-i", ov]
            filt.append(f"[{k}:v]scale={W}:{H},setsar=1,fps=30,trim=duration={sec},setpts=PTS-STARTPTS[c{i}];[c{i}][{k+1}:v]overlay=0:0,format=yuv420p[v{i}]")
            k += 2
        else:
            fp = os.path.join(OUT, f"f{i}.png")
            (fig_frame(src, lines) if kind == "fig" else end_frame()).save(fp)
            inputs += ["-loop", "1", "-t", str(sec), "-i", fp]
            filt.append(f"[{k}:v]scale={W}:{H},setsar=1,fps=30,format=yuv420p[v{i}]")
            k += 1
        labels.append(f"v{i}")
    off, prev = 0.0, labels[0]
    for i in range(1, len(SCENES)):
        off += SCENES[i - 1][2] - FADE
        nxt = f"x{i}" if i < len(SCENES) - 1 else "v"
        filt.append(f"[{prev}][{labels[i]}]xfade=transition=fade:duration={FADE}:offset={off:.2f}[{nxt}]")
        prev = nxt
    total = sum(s[2] for s in SCENES) - FADE * (len(SCENES) - 1)
    mp4 = os.path.join(OUT, NAME + ".mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-f", "lavfi", "-t", f"{total:.2f}", "-i", "anullsrc=r=44100:cl=stereo",
                    "-filter_complex", ";".join(filt), "-map", "[v]", "-map", f"{k}:a", "-c:v", "libx264", "-preset", "slow", "-crf", "20",
                    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "64k", "-shortest", "-movflags", "+faststart", mp4], check=True)
    fig_frame("index.png", SCENES[2][3]).save(os.path.join(OUT, NAME + "-poster.jpg"), quality=88)
    secs = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4]).decode())
    print(f"{mp4}  {secs:.1f}秒")
    return mp4, secs


def deploy(mp4, secs):
    for l in open("/home/kojima/work/aixec/.env", encoding="utf-8"):
        if "=" in l and not l.startswith("#"):
            a, b = l.rstrip("\n").split("=", 1); os.environ.setdefault(a, b.strip().strip('"').strip("'"))
    f = ftplib.FTP(os.environ["FTP_HOST"], timeout=300); f.login(os.environ["FTP_USER"], os.environ["FTP_PASS"])
    f.cwd("/web/kurage_exbridge_jp/pv")
    f.storbinary(f"STOR {NAME}.mp4", open(mp4, "rb")); f.storbinary(f"STOR {NAME}-poster.jpg", open(os.path.join(OUT, NAME + "-poster.jpg"), "rb"))
    f.cwd("/web/kurage_exbridge_jp/kpv_data")
    b = io.BytesIO(); f.retrbinary("RETR videos.json", b.write)
    open(os.path.join(OUT, f"videos_backup_{datetime.datetime.now():%Y%m%d_%H%M%S}.json"), "wb").write(b.getvalue())
    k = json.loads(b.getvalue()); vs = k["videos"] if isinstance(k, dict) else k; n = len(vs)
    row = {"id": NAME, "title": "Kurage 省庁トラッカー — 省庁の発表と国会の議論を1ページに（8府省の新着と、国会の質疑・答弁）",
           "video": BASE + NAME + ".mp4", "poster": BASE + NAME + "-poster.jpg", "page": PAGE, "seconds": int(round(secs)),
           "tags": ["shocho", "gyosei", "kokkai", "tracker"], "hidden": 0}
    hit = [v for v in vs if v.get("id") == NAME]
    if hit: hit[0].update(row)
    else: vs.append({**row, "created_at": datetime.datetime.now().isoformat()})
    f.storbinary("STOR videos.json", io.BytesIO(json.dumps(k, ensure_ascii=False, indent=1).encode("utf-8"))); f.quit()
    print(f"  kpv 台帳: {NAME} {'更新' if hit else '追加'}（{n}→{len(vs)}件）")
    for u in (row["video"], row["poster"]):
        r = urllib.request.urlopen(urllib.request.Request(u, method="HEAD"), timeout=60)
        print(f"  {r.status} {r.headers.get('Content-Type')} {r.headers.get('Content-Length')}B {u}")


if __name__ == "__main__":
    mp4, secs = build()
    if "--deploy" in sys.argv:
        deploy(mp4, secs)
