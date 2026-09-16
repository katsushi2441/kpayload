#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""politech のページに載せる「他所に無い数字」を、各プロダクトの実データから集計する。

politech は 181 枚あるのに、需要の大きい一般語のページ（防災 40,500・子育て 60,500・
奨学金 201,000）が Google に "Discovered - currently not indexed" で止まっていた。
一般的な解説文しか載っておらず、クロールする価値が無いと判断されたため。
具体語（感震ブレーカー 18,100）のページは同じ構造でもインデックスされている。

そこで、自社しか出していない実測値をテーマごとに用意して本文へ入れる。
**数字はここで実際に数えたものだけを書く。手で書いた概数を混ぜない。**

  cd /home/kojima/work/kpayload && /usr/bin/python3 scripts/build_politech_facts.py
  → data/politech-facts.json
"""
import datetime as dt
import json
import os
import sqlite3
import sys

W = "/home/kojima/work"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "politech-facts.json")
K = "https://kurage.exbridge.jp"


def q1(db, sql):
    """sqlite から1つの値を取る。取れなければ None（推測で埋めない）。"""
    if not os.path.exists(db):
        return None
    try:
        c = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
        v = c.execute(sql).fetchone()
        c.close()
        return v[0] if v else None
    except Exception as e:
        print(f"  ! {os.path.basename(db)}: {e}", file=sys.stderr)
        return None


def n(v):
    return f"{v:,}" if isinstance(v, int) else None


facts = {}

# ---- 防災・災害 -------------------------------------------------------------
rows = []

# krefuge: 指定緊急避難場所
db = f"{W}/krefuge/data/krefuge.db"
shelters = q1(db, "select count(*) from shelters")
munis = q1(db, "select count(*) from muni_stats")
if shelters and munis:
    rows.append({
        "label": "指定緊急避難場所",
        "value": f"{n(shelters)}件",
        "scope": f"{n(munis)}市区町村ぶんを収録",
        "note": "災害種別8種（洪水・崖崩れ・高潮・地震・津波・大規模火事・内水氾濫・火山)で絞り込める",
        "url": f"{K}/krefuge.php/",
        "name": "Kurage 避難所マップ",
    })

# ktsunami: 津波浸水想定
db = f"{W}/ktsunami/data/ktsunami.db"
cells = q1(db, "select count(*) from cells")
munis = q1(db, "select count(*) from muni_stats")
if cells and munis:
    rows.append({
        "label": "津波浸水想定メッシュ",
        "value": f"{n(cells)}区画",
        "scope": f"{n(munis)}市区町村ぶんを収録",
        "note": "住所の代表点ではなくクリックした座標で直接判定する",
        "url": f"{K}/ktsunami.php/",
        "name": "Kurage 津波浸水想定マップ",
    })

# kriskarea: 災害危険区域（建築基準法39条）
db = f"{W}/kriskarea/data/kriskarea.sqlite"
areas = q1(db, "select count(*) from areas")
munis = q1(db, "select count(*) from muni_stats")
if areas and munis:
    rows.append({
        "label": "災害危険区域（建築基準法39条）",
        "value": f"{n(areas)}区域",
        "scope": f"{n(munis)}市区町村ぶんを収録",
        "note": "条例で建築が制限される区域。根拠条例と基準の高さまで引ける",
        "url": f"{K}/kriskarea.php/",
        "name": "Kurage 災害危険区域マップ",
    })

# kjishin: 地番で引ける地震ハザード
parcels = q1(f"{W}/kjishin/data/chiban.sqlite", "select count(*) from parcel")
meshes = q1(f"{W}/kjishin/data/kjishin.sqlite", "select count(*) from mesh")
if parcels and meshes:
    rows.append({
        "label": "地震ハザードを引ける筆",
        "value": f"{n(parcels)}筆",
        "scope": f"名古屋市（250mメッシュ {n(meshes)}件と突き合わせ）",
        "note": "揺れやすさと液状化を、町名ではなく地番で判定する",
        "url": f"{K}/kjishin.php/",
        "name": "Kurage 地震ハザードマップ",
    })

# khazard: 土砂災害警戒区域（PostgreSQL）
try:
    import psycopg2
    cn = psycopg2.connect(host="127.0.0.1", port=55433, dbname="khazard",
                          user="postgres", password=os.environ.get("KHAZARD_PGPASS", "khazard_local"),
                          connect_timeout=5)
    cur = cn.cursor()
    cur.execute("select coalesce(sum(zones),0), count(*) from muni_stats")
    zones, munis = cur.fetchone()
    cn.close()
    if zones and munis:
        rows.insert(0, {
            "label": "土砂災害警戒区域",
            "value": f"{n(int(zones))}区域",
            "scope": f"{n(int(munis))}市区町村ぶんを収録",
            "note": "イエロー・レッド・指定予定を分けて、住所が区域の内か外かを判定する",
            "url": f"{K}/khazard.php/",
            "name": "Kurage 土砂災害ハザードマップ",
        })
except Exception as e:
    print(f"  ! khazard: {e}", file=sys.stderr)

if rows:
    facts["bousai"] = {"rows": rows}

# ---- 給付金・生活・住まい / 子育て・福祉 ------------------------------------
db = f"{W}/khojokin/data/hojokin.sqlite"
subs = q1(db, "select count(*) from subsidy")
nationwide = q1(db, "select count(*) from subsidy where target_area='全国'")
if subs:
    r = {
        "label": "公募中の補助金・助成金",
        "value": f"{n(subs)}件",
        "scope": (f"うち全国対象 {n(nationwide)}件" if nationwide else "デジタル庁 jGrants から取得"),
        "note": "補助率・上限額・締切で絞り込める。出典：Jグランツ",
        "url": f"{K}/khojokin.php/",
        "name": "Kurage 補助金ナビ",
    }
    facts.setdefault("seikatsu", {"rows": []})["rows"].append(r)

# kseido: 制度
p = f"{W}/kseido/data/programs.json"
if os.path.exists(p):
    d = json.load(open(p, encoding="utf-8"))
    progs = d.get("programs") or d.get("items") or []
    if progs:
        r = {
            "label": "暮らしの制度",
            "value": f"{len(progs)}制度",
            "scope": "名古屋市ぶんを収録",
            "note": "困りごとから、申請先・期限・必要書類まで辿れる",
            "url": f"{K}/kseido.php/",
            "name": "Kurage 制度ナビ",
        }
        for t in ("seikatsu", "kosodate", "fukushi", "shussan", "nagoya"):
            facts.setdefault(t, {"rows": []})["rows"].append(dict(r))

# kecnavi: 通報先
p = f"{W}/kecnavi/data/contacts.json"
if os.path.exists(p):
    d = json.load(open(p, encoding="utf-8"))
    cats = d.get("categories") or []
    if cats:
        contact_row = {
            "label": "困りごとの通報先",
            "value": f"{len(cats)}分類",
            "scope": "名古屋市16区ぶんを収録",
            "note": "道路の穴・不法投棄・街灯など、どこへ連絡すればよいかを住所から出す",
            "url": f"{K}/kecnavi.php/",
            "name": "Kurage 通報先ナビ",
        }
        for t in ("chiiki", "nagoya"):
            facts.setdefault(t, {"rows": []})["rows"].append(dict(contact_row))

out = {"updated": dt.date.today().isoformat(), "themes": facts}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"書き出し: {os.path.normpath(OUT)}")
for t, v in facts.items():
    print(f"  {t}: {len(v['rows'])}行")
    for r in v["rows"]:
        print(f"     {r['label']}: {r['value']}（{r['scope']}）")
