#!/usr/bin/env python3
"""exbridge.jp/academic/（論文トラッカー）のデータを集める。

  /usr/bin/python3 scripts/academic-fetch.py [テーマのslug ...]   → data/academic/<slug>.json

テーマは data/academic/themes.json。1テーマにつき次の3つを集める（どれもログイン・鍵なし）。
  1. OpenAlex … 東海三県の大学に所属する著者がいる論文（英語が中心。要旨つき）
  2. KAKEN（CiNii Research 経由）… 東海三県の大学の研究者が代表・分担の科研費の研究課題。
     研究者の日本語の名前・所属・研究の概要（日本語）が取れるので、研究者のページの元にする
  3. 国会 … 国会トラッカー（xb4g/giin/data/giin.sqlite の tracker_speech）の、テーマに対応する発言
生成AIは使わない（要約は academic-summarize.py が別に作る）。
"""
import json
import pathlib
import re
import sqlite3
import subprocess
import sys
import time
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "academic"
GIIN_DB = "/home/kojima/work/xb4g/giin/data/giin.sqlite"
SINCE = "2023-01-01"

# 東海三県の大学（OpenAlex の機関ID・日本語名）。2026-10-21 に OpenAlex の institutions 検索で確認
TOKAI = {
    "I60134161": "名古屋大学", "I197274945": "名古屋工業大学", "I33858575": "名古屋市立大学", "I42405503": "岐阜大学",
    "I178574317": "三重大学", "I136259955": "豊橋技術科学大学", "I98940699": "中京大学", "I119031078": "南山大学",
    "I96636082": "名城大学", "I39018119": "愛知教育大学", "I16528096": "愛知医科大学", "I184937672": "中部大学",
    "I190508380": "愛知工業大学", "I4840577": "豊田工業大学", "I45205469": "愛知県立大学", "I145673806": "藤田医科大学",
    "I1314707548": "名古屋商科大学", "I195444995": "愛知学院大学", "I123131354": "日本福祉大学", "I40931025": "名古屋学院大学",
    "I158048120": "金城学院大学", "I84309776": "椙山女学園大学", "I87572379": "愛知淑徳大学", "I51803142": "大同大学",
    "I24286346": "岐阜聖徳学園大学", "I173865709": "岐阜薬科大学", "I153293158": "皇學館大学", "I171559596": "鈴鹿医療科学大学",
    "I13621637": "四日市大学", "I8717472": "名古屋外国語大学", "I100294933": "名古屋女子大学",
}
# 関東の主な10大学（2026-10-21 ユーザー指示「関東の大学・研究者も入れて」）。返信で当たる論文を増やすため。
# 1テーマあたり関東の論文は KANTO_LIMIT 本まで（東海を軸にし、ページが増えすぎないように）
KANTO = {
    "I74801974": "東京大学", "I203951103": "慶應義塾大学", "I150744194": "早稲田大学", "I114531698": "東京科学大学",
    "I111428342": "一橋大学", "I146399215": "筑波大学", "I161296585": "東京理科大学", "I159385669": "千葉大学",
    "I180203408": "横浜国立大学", "I16656306": "明治大学",
}
KANTO_LIMIT = 100
KANTO_JA = sorted(set(KANTO.values()) | {"東京工業大学", "東京医科歯科大学"})
# KAKEN の所属名で東海の大学かを見る（OpenAlex に無い大学も含める）
TOKAI_JA = sorted(set(TOKAI.values()) | {"愛知大学", "名古屋経済大学", "東海学園大学", "至学館大学", "名古屋学芸大学", "人間環境大学",
                                          "岐阜協立大学", "朝日大学", "岐阜女子大学", "中部学院大学", "三重県立看護大学", "名古屋芸術大学",
                                          "愛知県立芸術大学", "情報科学芸術大学院大学", "岐阜工業高等専門学校", "豊田工業高等専門学校",
                                          "鈴鹿工業高等専門学校", "鳥羽商船高等専門学校", "名古屋産業大学", "星城大学", "桜花学園大学"})


def get(url: str) -> dict:
    for wait in (0, 5, 20):
        time.sleep(wait)
        out = subprocess.run(["curl", "-s", "-A", "exbridge-academic/1.0 (mailto:info@exbridge.jp)", url],
                             capture_output=True, text=True, timeout=90).stdout
        try:
            return json.loads(out)
        except json.JSONDecodeError:
            continue
    return {}


def abstract(inv: dict | None) -> str:
    if not inv:
        return ""
    pos = sorted((p, w) for w, ps in inv.items() for p in ps)
    return " ".join(w for _, w in pos)


def and_ok(expr: str, text: str) -> bool:
    """「AI」が mainly などの語の途中に当たらないよう、語の区切りで探す（2026-10-21 森林・解体の論文が混ざった）。"""
    return any(re.search(r"\b" + re.escape(a.strip('"')) + r"\b", text, re.I) for a in expr.split("|"))


def openalex(q: dict, region: str = "東海") -> list[dict]:
    insts = TOKAI if region == "東海" else KANTO
    f = ["institutions.id:" + "|".join(insts), "from_publication_date:" + SINCE, "title_and_abstract.search:" + q["search"]]
    if q.get("fields"):
        f.append("primary_topic.field.id:" + "|".join(str(x) for x in q["fields"]))
    url = ("https://api.openalex.org/works?" + urllib.parse.urlencode({
        "filter": ",".join(f), "sort": q.get("sort", "publication_date:desc"), "per_page": 100,
        "select": "id,doi,title,publication_date,type,primary_location,authorships,cited_by_count,abstract_inverted_index,primary_topic,language",
        "mailto": "info@exbridge.jp"}))
    rows = get(url).get("results", [])
    out = []
    for w in rows:
        text = (w.get("title") or "") + " " + abstract(w.get("abstract_inverted_index"))
        if q.get("and") and not and_ok(q["and"], text):
            continue
        authors = []
        insts_map = TOKAI if region == "東海" else KANTO
        for a in w.get("authorships") or []:
            ids = [i.get("id", "").split("/")[-1] for i in a.get("institutions") or []]
            tok = [insts_map[i] for i in ids if i in insts_map]
            authors.append({"name": a["author"].get("display_name"), "openalex": (a["author"].get("id") or "").split("/")[-1],
                            "orcid": a["author"].get("orcid"), "tokai": tok})
        if not any(a["tokai"] for a in authors):
            continue
        loc = w.get("primary_location") or {}
        out.append({"id": w["id"].split("/")[-1], "doi": w.get("doi"), "title": w.get("title"), "date": w.get("publication_date"),
                    "type": w.get("type"), "venue": ((loc.get("source") or {}).get("display_name")), "url": w.get("doi") or loc.get("landing_page_url") or w["id"],
                    "cited": w.get("cited_by_count", 0), "abstract": abstract(w.get("abstract_inverted_index"))[:2500],
                    "lang": w.get("language"), "topic": ((w.get("primary_topic") or {}).get("display_name")), "authors": authors, "group": q["label"], "region": region})
        if len(out) >= (q.get("limit", 50) if region == "東海" else q.get("kanto_limit", 50)):
            break
    return out


def val(x, lang=None):
    if isinstance(x, list):
        for v in x:
            if lang is None or v.get("@language") in (lang, None):
                return v.get("@value")
        return x[0].get("@value") if x else None
    return x


# 論文として載せる種類（Zenodo のソフトウェア・データ、学会の要旨集などは載せない）
WORK_TYPES = {"article", "review", "conference-paper", "preprint", "book-chapter", "book"}
PREF = {"article": 0, "review": 0, "book": 1, "book-chapter": 1, "conference-paper": 2, "preprint": 3}


def clean(works: list[dict]) -> list[dict]:
    """論文以外を除き、同じ題名（arXiv と学会版など）は1本にする。学術誌・学会版を残す。"""
    best: dict[str, dict] = {}
    for w in works:
        if w.get("type") not in WORK_TYPES or not w.get("title"):
            continue
        k = re.sub(r"[^0-9a-z\u3040-\u30ff\u4e00-\u9fff]", "", w["title"].lower())[:120]
        if k not in best or PREF.get(w["type"], 9) < PREF.get(best[k]["type"], 9):
            best[k] = w
    return list(best.values())


def kaken(words: list[str]) -> list[dict]:
    seen, out = set(), []
    for w in words:
        for univ in TOKAI_JA + KANTO_JA:
            url = "https://cir.nii.ac.jp/opensearch/projects?" + urllib.parse.urlencode({"q": f"{w} {univ}", "format": "json", "count": 50, "from": SINCE[:4]})
            for it in get(url).get("items", []) or []:
                crid = it["link"]["@id"].rsplit("/", 1)[-1]
                if crid in seen:
                    continue
                seen.add(crid)
                d = get(f"https://cir.nii.ac.jp/crid/{crid}.json")
                if not d:
                    continue
                res = []
                for r in d.get("researcher") or []:
                    aff = val(r.get("jpcoar:affiliationName"), "ja") or ""
                    res.append({"name": val(r.get("foaf:name"), "ja"), "crid": (r.get("@id") or "").rsplit("/", 1)[-1],
                                "affiliation": aff, "role": r.get("role"), "tokai": next((u for u in TOKAI_JA + KANTO_JA if u in aff), ""),
                                "region": "東海" if any(u in aff for u in TOKAI_JA) else ("関東" if any(u in aff for u in KANTO_JA) else "")})
                if not any(r["tokai"] for r in res):
                    continue
                desc = ""
                for dsc in d.get("description") or []:
                    if dsc.get("type", "").startswith("outline_of_research") or not desc:
                        desc = val(dsc.get("notation"), "ja") or desc
                url_k = next((u["@id"] for u in d.get("url") or [] if "kaken" in u.get("@id", "")), f"https://cir.nii.ac.jp/crid/{crid}")
                out.append({"crid": crid, "title": val(d.get("jpcoar:awardTitle"), "ja"), "since": d.get("since"), "until": d.get("until"),
                            "program": val(((d.get("fundingProgram") or [{}])[0]).get("jpcoar:funderName"), "ja"),
                            "category": val(((d.get("allocationClassification") or [{}])[0]).get("notation") if d.get("allocationClassification") else None, "ja"),
                            "outline": (desc or "")[:1500], "url": url_k, "researchers": res, "word": w})
                time.sleep(0.3)
            time.sleep(0.4)
        print(f"  KAKEN「{w}」まで {len(out)} 件", flush=True)
    return out


def kokkai(keys: list[str]) -> list[dict]:
    con = sqlite3.connect(f"file:{GIIN_DB}?mode=ro", uri=True)
    rows = con.execute(f"""select tracker,date,house,meeting,speaker,kind,speech_url,body from tracker_speech
        where tracker in ({','.join('?' * len(keys))}) order by date desc""", keys).fetchall()
    out = []
    trk = json.load(open("/home/kojima/work/xb4g/giin/data/trackers.json"))
    trk = trk if isinstance(trk, list) else trk["trackers"]
    names = {x["key"]: x["name"] for x in trk if x["key"] in keys}
    words = {x["key"]: [w.split()[0] for w in x.get("words", []) if w.strip()] for x in trk if x["key"] in keys}
    for t, dt, house, meeting, speaker, kind, url, body in rows:
        b = re.sub(r"^○\S+\s*", "", body or "")
        # 抜き出しは、トラッカーの語が最初に出てくるところの少し前から（あいさつの部分を見せない）
        hit = [i for i in (b.find(w) for w in words.get(t, [])) if i >= 0]
        start = max(0, min(hit) - 60) if hit else 0
        out.append({"tracker": t, "date": dt, "house": house, "meeting": meeting, "speaker": speaker, "kind": kind, "url": url,
                    "body": ("…" if start else "") + b[start:start + 300]})
    counts = {k: sum(1 for r in out if r["tracker"] == k) for k in keys}
    res = []
    for k in keys:
        # 最新から、日付と会議が違うものを選ぶ（同じ会議の続きの発言ばかりにならないように）。答弁を優先
        pick, seen = [], set()
        for r in sorted([r for r in out if r["tracker"] == k], key=lambda r: (r["date"], r["kind"] == "gov"), reverse=True):
            if (r["date"], r["meeting"]) in seen:
                continue
            seen.add((r["date"], r["meeting"]))
            pick.append(r)
            if len(pick) >= 6:
                break
        res.append({"key": k, "name": names.get(k, k), "count": counts[k], "recent": pick})
    return res


def main() -> None:
    if "--clean-only" in sys.argv:   # 取り直さずに、論文の絞り込みだけかけ直す
        for f in DATA.glob("*.json"):
            if f.name in ("themes.json", "summaries.json"):
                continue
            d = json.loads(f.read_text()); n = len(d["works"]); d["works"] = clean(d["works"])
            ands = {q["label"]: q["and"] for q in d["theme"]["openalex"] if q.get("and")}
            d["works"] = [w for w in d["works"] if w["group"] not in ands or and_ok(ands[w["group"]], (w["title"] or "") + " " + (w.get("abstract") or ""))]
            f.write_text(json.dumps(d, ensure_ascii=False, indent=1))
            print(f.name, n, "→", len(d["works"]))
        return
    if "--kokkai-only" in sys.argv:   # 国会の部分だけ取り直す（論文・科研費はそのまま）
        sys.argv.remove("--kokkai-only")
        for th in json.loads((DATA / "themes.json").read_text()):
            f = DATA / f"{th['slug']}.json"
            if f.exists() and (not sys.argv[1:] or th["slug"] in sys.argv[1:]):
                d = json.loads(f.read_text()); d["kokkai"] = kokkai(th["trackers"]); f.write_text(json.dumps(d, ensure_ascii=False, indent=1))
                print("国会を取り直し", th["slug"])
        return
    themes = json.loads((DATA / "themes.json").read_text())
    want = set(sys.argv[1:])
    for th in themes:
        if want and th["slug"] not in want:
            continue
        print("==", th["name"], flush=True)
        works, ids = [], set()
        for region in ("東海", "関東"):
            for q in th["openalex"]:
                q = dict(q, kanto_limit=-(-KANTO_LIMIT // len(th["openalex"])))
                for w in openalex(q, region):
                    if w["id"] not in ids:
                        ids.add(w["id"])
                        works.append(w)
                print(f"  OpenAlex {region}「{q['label']}」まで {len(works)} 本", flush=True)
        works = clean(works)
        projects = kaken(th["kaken"])
        data = {"theme": th, "fetched": time.strftime("%Y-%m-%d"), "works": works, "projects": projects, "kokkai": kokkai(th["trackers"])}
        (DATA / f"{th['slug']}.json").write_text(json.dumps(data, ensure_ascii=False, indent=1))
        print(f"  → data/academic/{th['slug']}.json 論文{len(works)} 科研費{len(projects)}", flush=True)


if __name__ == "__main__":
    main()
