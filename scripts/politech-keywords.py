#!/usr/bin/env python3
"""政治・政策キーワード（Keyword Planner 実測 TSV）→ data/politech-keywords.json

入力: /home/kojima/work/kecnavi-sales/research/kw/*.tsv（keyword_volume.py の出力）
処理: ブランド/商品語を除外 → 助詞と語順の違いを同一視して重複を落とす → テーマ・意図・slug を付ける
出力: data/politech-keywords.json（build-politech.ts と politech-copy.py が読む）

  /usr/bin/python3 scripts/politech-keywords.py
"""
import glob
import json
import os
import re

import pykakasi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KW_DIR = "/home/kojima/work/kecnavi-sales/research/kw"
OUT = os.path.join(ROOT, "data", "politech-keywords.json")

THEMES = {
    "01-bousai": ("bousai", "防災・災害", 1000),
    "02-kosodate": ("kosodate", "子育て・少子化", 1000),
    "09-shoshika": ("shussan", "出産・子育て給付", 1000),
    "03-kyoiku": ("kyoiku", "教育・奨学金", 1000),
    "08-futoko": ("futoko", "不登校・学びの支援", 300),
    "04-fukushi": ("fukushi", "福祉・高齢・障害・ひとり親", 1000),
    "05-seikatsu": ("seikatsu", "給付金・生活・住まい", 1000),
    "06-seiji": ("senkyo", "選挙・政治参加", 1000),
    "07-chiiki": ("chiiki", "地域・防犯・移住", 1000),
    "10-nagoya": ("nagoya", "名古屋市のくらし", 100),
}
EXCLUDE = re.compile(
    r"スカラ|jasso|学生 支援 機構|キーエンス|ニトリ|育英|国崎|無印|綾瀬|慶 風|協会 けんぽ|骨盤|ゴミ箱|英語|感電|食器 棚|防災 食料|防災 備蓄|災害 時 備え|防災 備え"
    r"|ペット ボトル|発泡|瓶 の 蓋|プラスチック|滝ノ水|表 山|鳥羽見|廿軒家|きゅう ふきん|きゅう ふ|寄付 金|価格 が 高騰|保険 出産|出産 の 保険|衆議院|防災 士 役に立た|日本 防災 士 機構"
    r"|とう ひょう|ぶん べつ|子 育ち|こども 未来 課|子ども 食堂 違和感|見守り$|^産後$|低 所得 世帯 と は|暮らし 応援"
)
PARTICLES = {"の", "は", "が", "を", "に", "で", "と", "へ", "から", "や", "も", "な", "する", "について", "の", "こと"}
NORMAL = {"こども": "子ども", "子供": "子ども", "障がい": "障害", "ゴミ": "ごみ", "きゅうふきん": "給付金"}


def norm_tokens(kw: str) -> list[str]:
    toks = [NORMAL.get(t, t) for t in kw.split()]
    return [t for t in toks if t not in PARTICLES]


def intent_of(kw: str) -> str:
    k = kw.replace(" ", "")
    if re.search(r"場所|どこ|一覧|マップ|空き|所$|センター|教室|避難所", k):
        return "place"
    if re.search(r"申請|やり方|方法|必要なもの|書き方|持ち物|手続き|仕方|受験|進路", k):
        return "howto"
    if re.search(r"給付|手当|補助|助成|支援金|減免|無償|一時金|奨学金|貸付", k):
        return "benefit"
    if re.search(r"とは|意味|問題|対策|役に立", k):
        return "define"
    return "topic"


kks = pykakasi.kakasi()


def slugify(kw: str) -> str:
    s = "-".join(x["hepburn"] for x in kks.convert(kw.replace(" ", " ")))
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    s = re.sub(r"-+", "-", s)
    return s[:60].rstrip("-") or "kw"


rows = []
for f in sorted(glob.glob(os.path.join(KW_DIR, "*.tsv"))):
    key = os.path.basename(f)[:-4]
    if key not in THEMES:
        continue
    theme, theme_name, th = THEMES[key]
    for line in open(f, encoding="utf-8"):
        c = line.rstrip("\n").split("\t")
        if line.startswith("#") or len(c) < 6:
            continue
        try:
            v = int(c[0])
        except ValueError:
            continue
        kw = re.sub(r"\s+", " ", c[5].strip())
        if v < th or EXCLUDE.search(kw):
            continue
        rows.append({"keyword": kw, "volume": v, "competition": c[1], "index": int(c[2]) if c[2].isdigit() else None, "theme": theme, "theme_name": theme_name})

rows.sort(key=lambda r: -r["volume"])
seen = {}
out = []
slugs = set()
for r in rows:
    key = " ".join(sorted(norm_tokens(r["keyword"])))
    if not key or key in seen:
        continue
    seen[key] = True
    toks = norm_tokens(r["keyword"])
    display = "".join(toks)  # 日本語は分かち書きしない（Keyword Planner の分割を戻す）
    slug = slugify(" ".join(toks))
    n = 2
    base = slug
    while slug in slugs:
        slug = f"{base}-{n}"
        n += 1
    slugs.add(slug)
    out.append({"slug": slug, "keyword": display, "query": r["keyword"], "volume": r["volume"], "competition": r["competition"], "index": r["index"], "theme": r["theme"], "theme_name": r["theme_name"], "intent": intent_of(display)})

os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
from collections import Counter

print("keywords:", len(out), Counter(r["theme"] for r in out), Counter(r["intent"] for r in out))
