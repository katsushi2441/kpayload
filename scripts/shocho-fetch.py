#!/usr/bin/env python3
"""Kurage 省庁トラッカー（exbridge.jp/shocho/）のデータを集める（2026-10-23 作成）。

各府省の新着情報（RSS）を読み、題名・日付・URL・分類だけを貯める（本文は持たない。出典は各府省）。
国会トラッカーのテーマの語（xb4g/giin/data/trackers.json の words・short・seo_word）が題名に入っていれば、
そのテーマに結び付ける。結び付いたテーマの国会の直近の質疑・答弁は giin.sqlite から引く。

  /usr/bin/python3 scripts/shocho-fetch.py
    → data/shocho/items.json   発表（id → 府省・題名・URL・日付・分類・テーマ）
    → data/shocho/kokkai.json  テーマ → 国会の件数と直近3件
    → /home/kojima/work/xb4g/giin/data/shocho_links.json  テーマ → 省庁の新しい発表（国会トラッカーに出す）
"""
import datetime as dt
import email.utils
import hashlib
import html
import json
import pathlib
import re
import sqlite3
import sys
import urllib.request
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "shocho"
GIIN = pathlib.Path("/home/kojima/work/xb4g/giin")
UA = "Mozilla/5.0 (compatible; KurageShochoTracker/1.0; +https://exbridge.jp/shocho/)"

# RSS を出している府省（2026-10-23 実測・2026-11-07 中小企業庁を追加）。経産省は 403、環境省・こども家庭庁は RSS が見つからない
FEEDS = [
    ("digital", "デジタル庁", "https://www.digital.go.jp/rss/news.xml"),
    ("mlit", "国土交通省", "https://www.mlit.go.jp/index.rdf"),
    ("mhlw", "厚生労働省", "https://www.mhlw.go.jp/stf/news.rdf"),
    ("maff", "農林水産省", "https://www.maff.go.jp/j/press/rss.xml"),
    ("mext", "文部科学省", "https://www.mext.go.jp/b_menu/news/index.rdf"),
    ("soumu", "総務省", "https://www.soumu.go.jp/news.rdf"),
    ("cao", "内閣府", "https://www.cao.go.jp/rss/news.rdf"),
    ("fsa", "金融庁", "https://www.fsa.go.jp/fsaNewsListAll_rss2.xml"),
    # 2026-11-07 追加: 補助金・取引の発表が出る（Kurage App Store の「業務の制度ニュース」の材料）。国税庁は RSS が無く、公正取引委員会・個人情報保護委員会はボットを断る（403/503）
    ("chusho", "中小企業庁", "https://www.chusho.meti.go.jp/rss/index.xml"),
]


# RSS に出ない発表をページから読む（2026-11-22 追加）。国交省の RSS（index.rdf）は大臣会見要旨しか出さず、報道発表が1件も入らなかった。
# 報道発表の一覧は /report/press/houdou<YYYYMM>.html（月ごと・UTF-8。index.html はここへ meta refresh するだけ）。
# 中身は <dt>2026年11月20日</dt><dd>…<a href="/report/press/jidosha08_hh_005895.html">題名<br>～副題～</a>… の並び。
MLIT_PRESS = "https://www.mlit.go.jp/report/press/houdou{ym}.html"
MLIT_PRESS_MAX = 80  # 1回に取る件数（新しい順）。足りなければ前の月のページも読む（最大2ページ）
# URL の頭（jidosha08 など）→ 部局別一覧の名前。2026-11-22 に /report/press/<部局>_news.html の20ページを読んで数えた実測。
# 数字まで見て決まるもの（kanbo08＝技術調査 など）を先に、残りは英字の部分で引く。どれにも当たらなければ「報道発表」だけ
MLIT_BUREAU_EXACT = {"kanbo08": "技術調査関係", "kanbo12": "危機管理関係", "sogo05": "国際関係", "sogo07": "国際関係",
                     "sogo02": "土地・不動産・建設業関係", "tokatsu05": "政策統括関係"}
MLIT_BUREAU = {"sogo": "総合政策関係", "joho": "総合政策関係", "kokudoseisaku": "国土政策関係",
               "tochi_fudousan_kensetsugyo": "土地・不動産・建設業関係", "toshi": "都市関係", "mizukokudo": "水管理・国土保全関係",
               "sabo": "水管理・国土保全関係", "water": "水管理・国土保全関係", "road": "道路関係", "house": "住宅関係",
               "tetsudo": "鉄道関係", "jidosha": "物流・自動車関係", "tokatsu": "物流・自動車関係", "kaiji": "海事関係",
               "port": "港湾関係", "kouku": "航空関係", "hok": "北海道関係", "eizen": "官庁営繕関係", "kanbo": "その他", "unyu": "その他"}
# 意見募集（パブリックコメント）は e-Gov の RSS（全府省の新しい順・約20件）から、問合せ先が国土交通省のものだけ。
# 2026-11-20 の「宅配便の多様な受取方法の普及に向けたガイドライン（案）」（置き配の指針案）は報道発表の一覧に載らず、ここにだけ出た
EGOV_PCM = "https://public-comment.e-gov.go.jp/rss/pcm_list.xml"


def _html_title(s: str) -> str:
    s = re.sub(r"<rt>.*?</rt>|<rp>.*?</rp>", "", s, flags=re.S)
    s = re.sub(r"<br\s*/?>", "　", s, flags=re.I)
    s = html.unescape(re.sub(r"<[^>]+>", "", s))
    return re.sub(r"[ \t\r\n]+", " ", s).replace(" 　", "　").replace("　 ", "　").strip(" 　")


def mlit_press() -> list[dict]:
    """国交省の報道発表（月ごとの一覧のページ）を新しい順に MLIT_PRESS_MAX 件まで"""
    today = dt.date.today()
    yms = [today.strftime("%Y%m"), (today.replace(day=1) - dt.timedelta(days=1)).strftime("%Y%m")]
    out: list[dict] = []
    for ym in yms:
        try:
            t = fetch(MLIT_PRESS.format(ym=ym)).decode("utf-8", errors="replace")
        except Exception as e:  # noqa: BLE001  月の初めはその月のページがまだ無い（404）ことがある
            print(f"  国土交通省 報道発表 {ym}: 取れない（{e}）", file=sys.stderr)
            continue
        t = t.split('id="leftColumn"', 1)[0]  # 左の部局別一覧より前が本体
        day = ""
        for m in re.finditer(r'<dt>\s*(\d{4})年(\d{1,2})月(\d{1,2})日\s*</dt>|<a href="(/report/press/[^"#]+\.html)">(.*?)</a>', t, re.S):
            if m.group(1):
                day = f"{int(m.group(1)):04d}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
                continue
            href, title = m.group(4), _html_title(m.group(5))
            if not day or "_hh_" not in href or not title:
                continue
            head = re.match(r"/report/press/([a-z_]+?)(\d*)_hh_", href)
            bureau = ""
            if head:
                bureau = MLIT_BUREAU_EXACT.get(head.group(1) + head.group(2)) or MLIT_BUREAU.get(head.group(1), "")
            out.append({"title": title, "link": "https://www.mlit.go.jp" + href, "date": day,
                        "cat": f"報道発表（{bureau}）" if bureau else "報道発表"})
        if len(out) >= MLIT_PRESS_MAX:
            break
    out.sort(key=lambda r: r["date"], reverse=True)
    return out[:MLIT_PRESS_MAX]


def egov_pubcom(ministry_name: str) -> list[dict]:
    """e-Gov の意見募集の RSS から、問合せ先（所管省庁）が ministry_name のもの"""
    rows = []
    root = ET.fromstring(to_text(fetch(EGOV_PCM)))
    for el in root.iter():
        if local(el.tag) != "item":
            continue
        f = {local(c.tag): (c.text or "").strip() for c in el}
        desc = html.unescape(f.get("description", ""))
        m = re.search(r"所管省庁・部局名等）：\s*(\S+)", desc)
        if not (f.get("title") and f.get("link") and m and m.group(1).startswith(ministry_name)):
            continue
        d = re.search(r"案の公示日：(\d{4})/(\d{1,2})/(\d{1,2})", desc)
        rows.append({"title": f["title"], "link": f["link"],
                     "date": f"{int(d.group(1)):04d}-{int(d.group(2)):02d}-{int(d.group(3)):02d}" if d else ymd(f.get("date", "")),
                     "cat": "意見募集（パブリックコメント）"})
    return rows


# RSS 以外の取り込み（府省の slug・名前・見出し・読む関数）
PAGES = [
    ("mlit", "国土交通省", "報道発表", mlit_press),
    ("mlit", "国土交通省", "意見募集", lambda: egov_pubcom("国土交通省")),
]


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def to_text(raw: bytes) -> str:
    """XML 宣言の文字コードで文字列にする（expat は Shift_JIS を読めないので、先に Python で直す）"""
    m = re.match(rb'<\?xml[^>]*encoding=["\']([^"\']+)', raw)
    enc = (m.group(1).decode() if m else "utf-8").lower()
    if enc in ("shift_jis", "shift-jis", "sjis", "x-sjis"):
        enc = "cp932"
    t = raw.decode(enc, errors="replace")
    return re.sub(r"^<\?xml[^>]*\?>", "", t.lstrip("﻿").lstrip(), count=1)


def ymd(s: str) -> str:
    s = (s or "").strip()
    if not s:
        return ""
    if re.match(r"\d{4}-\d{2}-\d{2}", s):
        return s[:10]
    try:
        return email.utils.parsedate_to_datetime(s).astimezone(dt.timezone(dt.timedelta(hours=9))).strftime("%Y-%m-%d")
    except Exception:  # noqa: BLE001
        return ""


def local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def parse(text: str) -> list[dict]:
    """RSS 1.0（rdf）・RSS 2.0・Atom のどれでも、item/entry の題名・リンク・日付・分類を取る"""
    root = ET.fromstring(text)
    out = []
    for el in root.iter():
        if local(el.tag) not in ("item", "entry"):
            continue
        f: dict = {}
        for c in el:
            n = local(c.tag)
            if n == "title":
                f["title"] = (c.text or "").strip()
            elif n == "link":
                f["link"] = (c.text or c.get("href") or "").strip()
            elif n in ("date", "pubDate", "updated", "published") and "date" not in f:
                f["date"] = ymd(c.text or "")
            elif n in ("category", "subject") and "cat" not in f:
                f["cat"] = (c.text or c.get("term") or "").strip()
        if not f.get("link") and el.get("{http://www.w3.org/1999/02/22-rdf-syntax-ns#}about"):
            f["link"] = el.get("{http://www.w3.org/1999/02/22-rdf-syntax-ns#}about")
        if f.get("title") and f.get("link"):
            out.append(f)
    return out


def tracker_words() -> list[tuple[str, str, list[list[str]]]]:
    """国会トラッカーのテーマ → 当てる語（空白区切りは全部含むときだけ）。短すぎる語（2字以下）は誤爆するので使わない"""
    ts = json.loads((GIIN / "data" / "trackers.json").read_text())
    out = []
    for t in ts:
        ws = list(t.get("words") or []) + [t.get("short") or "", t.get("seo_word") or ""]
        groups = []
        for w in ws:
            parts = [p for p in re.split(r"[\s　]+", w.strip()) if p]
            if parts and sum(len(p) for p in parts) >= 3 and parts not in groups:
                groups.append(parts)
        out.append((t["key"], t["name"], groups))
    return out


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    fi = OUT / "items.json"
    items: dict = json.loads(fi.read_text()) if fi.exists() else {}
    now = dt.datetime.now().isoformat(timespec="seconds")
    got = new = 0
    sources = [(slug, name, name, (lambda u=url: parse(to_text(fetch(u))))) for slug, name, url in FEEDS]
    sources += [(slug, name, f"{name} {label}", fn) for slug, name, label, fn in PAGES]
    for slug, name, label, read in sources:
        try:
            rows = read()
        except Exception as e:  # noqa: BLE001
            print(f"  {label}: 取れない（{e}）", file=sys.stderr)
            continue
        for r in rows:
            iid = hashlib.sha1(r["link"].encode()).hexdigest()[:12]
            got += 1
            if iid not in items:
                new += 1
                items[iid] = {"id": iid, "ministry": slug, "ministry_name": name, "title": r["title"], "url": r["link"],
                              "date": r.get("date") or now[:10], "cat": r.get("cat", ""), "first_seen": now}
            else:
                items[iid]["title"] = r["title"]
        print(f"  {label}: {len(rows)}件")
    # テーマに結び付ける（毎回やり直す。トラッカーの語が増えたら古い発表にも付く）
    tw = tracker_words()
    # 1段広い「ことがら」（26分野）。題名に分野の語があれば、その分野の国会トラッカーのうち直近で動いている3本を結び付ける
    themes = json.loads((GIIN / "data" / "themes.json").read_text())
    extra = json.loads((OUT / "theme_words.json").read_text())
    twords = {t["slug"]: [w for w in (t.get("words") or []) + extra.get(t["slug"], []) if len(w) >= 2] for t in themes}
    tname = {t["slug"]: t["name"] for t in themes}
    con0 = sqlite3.connect(f"file:{GIIN / 'data' / 'giin.sqlite'}?mode=ro", uri=True)
    last = dict(con0.execute("SELECT tracker, MAX(date) FROM tracker_speech GROUP BY tracker").fetchall())
    by_theme: dict = {}
    for t in json.loads((GIIN / "data" / "trackers.json").read_text()):
        by_theme.setdefault(t.get("theme") or "", []).append(t["key"])
    for k in by_theme:
        by_theme[k].sort(key=lambda x: last.get(x) or "", reverse=True)
    STOPG = {"について", "ついて", "する", "等の", "及び", "関する", "開催", "催に", "公表", "表し", "掲載", "載し", "結果", "会議", "検討", "審議", "議会", "調査", "令和", "年度"}
    def grams(x: str) -> set:
        x = re.sub(r"[\s　「」『』（）()・、。,.:：0-9０-９]+", " ", x)
        return {x[i:i + 2] for i in range(len(x) - 1) if " " not in x[i:i + 2] and x[i:i + 2] not in STOPG and not re.match(r"^[ぁ-ん]{2}$", x[i:i + 2])}
    tgrams = {}
    for t in json.loads((GIIN / "data" / "trackers.json").read_text()):
        tgrams[t["key"]] = grams(" ".join([t["name"], t.get("short") or ""] + list(t.get("words") or [])))
    tg_theme = {sl: grams(" ".join(ws)) for sl, ws in twords.items()}
    used: set = set()
    for it in items.values():
        tt = it["title"]
        it["trackers"] = [k for k, _, gs in tw if any(all(p in tt for p in g) for g in gs)]
        it["themes"] = [sl for sl, ws in twords.items() if any(w in tt for w in ws)]
        rel = list(it["trackers"])
        # 分野の中では、題名とトラッカーの名前・語に共通する2文字の並びが多い順（0のトラッカーは付けない）。
        # 「直近で動いている順」だと Harunobu（機械可読性）にステーブルコインが付いた（2026-10-23）
        tb = grams(tt)
        cand = []
        for sl in it["themes"]:
            for k in by_theme.get(sl, []):
                # 分野を見分けた語（「デジタル」など）そのものは数えない。分野の中でどれに近いかを見たいので
                sc = len((tb - tg_theme.get(sl, set())) & tgrams.get(k, set()))
                if sc >= 2 and k not in rel:
                    cand.append((sc, last.get(k) or "", k))
        for _, _, k in sorted(set(cand), reverse=True)[:3]:
            rel.append(k)
        it["related"] = rel[:6]
        used.update(it["related"])
    fi.write_text(json.dumps(items, ensure_ascii=False, indent=1))
    # 国会の側（テーマごとの件数と直近の質疑・答弁）
    names = {k: n for k, n, _ in tw}
    con = sqlite3.connect(f"file:{GIIN / 'data' / 'giin.sqlite'}?mode=ro", uri=True)
    kok = {}
    for k in sorted(used):
        n = con.execute("SELECT COUNT(*) FROM tracker_speech WHERE tracker=?", (k,)).fetchone()[0]
        rec = [dict(zip(("date", "house", "meeting", "speaker", "kind", "url", "body"), r)) for r in con.execute(
            "SELECT date,house,meeting,speaker,kind,speech_url,substr(body,1,240) FROM tracker_speech WHERE tracker=? AND kind IN ('q','gov') "
            "ORDER BY date DESC, speech_order DESC LIMIT 3", (k,))]
        kok[k] = {"key": k, "name": names.get(k, k), "count": n, "recent": rec}
    (OUT / "kokkai.json").write_text(json.dumps(kok, ensure_ascii=False, indent=1))
    (OUT / "themes.json").write_text(json.dumps(tname, ensure_ascii=False, indent=1))
    # 逆向き：国会トラッカーの各テーマに出す「省庁の新しい発表」（新しい順に5件）
    links: dict = {}
    for it in sorted(items.values(), key=lambda x: (x["date"], x["first_seen"]), reverse=True):
        for k in it["related"]:
            if len(links.setdefault(k, [])) < 5:
                links[k].append({"id": it["id"], "title": it["title"], "ministry": it["ministry_name"], "date": it["date"],
                                 "page": f"https://exbridge.jp/shocho/n/{it['id']}.html", "url": it["url"]})
    (GIIN / "data" / "shocho_links.json").write_text(json.dumps({"updated": now, "links": links}, ensure_ascii=False, indent=1))
    print(f"取得 {got}件（新規 {new}）・累計 {len(items)}件・国会トラッカーに結び付いた発表 "
          f"{sum(1 for x in items.values() if x['related'])}件（題名の語で直接 {sum(1 for x in items.values() if x['trackers'])}件）・トラッカー {len(used)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
