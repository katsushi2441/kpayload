#!/usr/bin/env python3
"""Kurage 省庁トラッカー：発表ごとに、公式ページの「日時・議題などの本文の冒頭」と「配布資料の一覧」を取り込み、
資料に書いてあることを gemma4 で要点にまとめる（2026-11-03 作成）。

なぜ作ったか: 発表のページ（exbridge.jp/shocho/n/<id>.html）は題名と公式ページへのリンクだけで、開いた人に得るものが無かった。
日経「固定電話での国際電話、オプション設定にする案　総務省が議論」の元は総務省WGの資料15-1だったが、当社のページからは
資料の名前も中身も分からず、X のコメントに貼れなかった。Google も中身の薄いページを「検出 - インデックス未登録」で後回しにする。

  /usr/bin/python3 scripts/shocho-detail.py            # まだ取っていない発表と、出てから10日以内の発表（資料が後から載る）を取る
  /usr/bin/python3 scripts/shocho-detail.py --all      # 1回あたりの上限なし（最初の取り込み）
  /usr/bin/python3 scripts/shocho-detail.py --id d2f6dd56dafc --force
    → data/shocho/detail.json  id → {facts（本文の冒頭の行）, files（資料の題名とURL）, points（要点）, ...}

- 各府省のウェブサイトは政府標準利用規約（第2.0版）で、出典を書けば複製・引用してよい。ページには出典を必ず出す。
- 要点は資料（PDF）か本文に書いてあることだけ。資料に無い数字が入った要点は捨てる。Ollama は 192.168.0.3 直・think:false。
- 府省のサーバーに負荷をかけないよう、1回ずつ1秒あける。PDF は 15MB まで・先頭10ページだけ読む。
"""
import datetime as dt
import fcntl
import json
import pathlib
import re
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request

import warnings

from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning

warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "shocho"
OUT = DATA / "detail.json"
UA = "Mozilla/5.0 (compatible; KurageShochoTracker/1.0; +https://exbridge.jp/shocho/)"
OLLAMA = "http://192.168.0.3:11434/api/generate"
MODEL = "gemma4:12b-it-qat"
FILE_EXT = re.compile(r"\.(pdf|xlsx?|docx?|pptx?|csv|zip)(?:$|[?#])", re.I)
NOISE_ATTR = re.compile(r"header|footer|nav|menu|side|breadcrumb|pankuzu|topicpath|pagetop|page-top|sns|share|banner|global|utility|skip|search|localnav|lnav|gnav", re.I)
STOP = re.compile(r"^(配布資料|資料$|傍聴について|傍聴の申込|ページトップへ|ページの先頭へ|このページの先頭へ|ページの上部へ|サイドナビ|PDF形式のファイルをご覧|PDFファイルを閲覧|Adobe|Get ADOBE|Acrobat Reader|このページに関するお問い合わせ|関連リンク$|関連情報$)")
DROP = re.compile(r"^(印刷|印刷する|戻る|前のページへ戻る|Tweet|ツイート|シェア|いいね|ポスト|English|ホーム|トップページ|[>›»＞]|\|)$")


def get(url: str, limit: int = 15_000_000) -> tuple[bytes, str]:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=40) as r:
        ctype = r.headers.get("Content-Type", "")
        n = int(r.headers.get("Content-Length") or 0)
        if n > limit:
            raise ValueError(f"大きすぎる {n}")
        return r.read(limit + 1), ctype


def decode(raw: bytes, ctype: str) -> str:
    enc = (re.search(r"charset=([\w-]+)", ctype or "", re.I) or re.search(rb'charset=["\']?([\w-]+)', raw[:3000], re.I))
    e = enc.group(1) if enc else "utf-8"
    e = (e.decode() if isinstance(e, bytes) else e).lower()
    if e in ("shift_jis", "shift-jis", "sjis", "x-sjis", "windows-31j"):
        e = "cp932"
    try:
        return raw.decode(e)
    except (LookupError, UnicodeDecodeError):
        for e2 in ("utf-8", "cp932", "euc_jp"):
            try:
                return raw.decode(e2)
            except UnicodeDecodeError:
                pass
    return raw.decode("utf-8", "replace")


def norm(s: str) -> str:
    return re.sub(r"[ \t　\xa0]+", " ", s or "").strip()


def page(url: str, title: str) -> dict:
    raw, ctype = get(url, 5_000_000)
    soup = BeautifulSoup(decode(raw, ctype), "lxml")
    for t in soup(["script", "style", "noscript", "header", "footer", "nav", "aside", "form", "iframe", "svg"]):
        t.decompose()
    for t in soup.find_all(True):
        if t.attrs is None:
            continue
        a = " ".join([t.get("id") or ""] + list(t.get("class") or []))
        if a and NOISE_ATTR.search(a) and t.name not in ("body", "html", "main"):
            t.decompose()
    root = soup.find("main") or soup.find(id=re.compile(r"^(contents?|main|mainContents?|contentsArea|main-?content|primary|article)$", re.I)) or soup.body or soup
    # 資料（PDF など）
    files, seen = [], set()
    for a in root.find_all("a", href=True):
        u = urllib.parse.urljoin(url, a["href"].strip())
        if not FILE_EXT.search(u) or "adobe" in u.lower() or u in seen:
            continue
        seen.add(u)
        t = norm(a.get_text(" "))
        if not t:
            continue
        files.append({"title": t[:120], "url": u})
    ftexts = {f["title"] for f in files}
    # 本文の行：見出し（h1・題名に近い行）のあとから、ページ末尾の決まり文句まで
    lines = [norm(x) for x in root.get_text("\n").split("\n")]
    lines = [x for x in lines if x]
    start = 0
    h1 = root.find("h1") or soup.find("h1")
    key = norm(h1.get_text(" ")) if h1 else ""
    for i, x in enumerate(lines[:80]):
        if key and (x == key or (len(key) > 8 and key[:12] in x)):
            start = i + 1
            break
        if title and len(x) > 8 and x[:14] == norm(title)[:14]:
            start = i + 1
            break
    facts, total = [], 0
    for x in lines[start:]:
        if STOP.search(x):
            break
        if DROP.search(x) or x in ftexts or (len(x) <= 1) or x in (key, norm(title)) or re.match(r"^https?://", x):
            continue
        if facts and x == facts[-1]:
            continue
        facts.append(x[:300])
        total += len(x)
    body_all = "\n".join(facts)
    return {"facts": facts[:24], "text": body_all[:12000], "files": files[:40], "h1": key[:200]}


KEYPAGE = re.compile(r"論点|方向性|まとめ|概要|ポイント|結論|主な意見|今後の|対応策|取りまとめ|骨子")


def pdf_text(url: str, budget: int = 6000) -> str:
    """先頭30ページから budget 字まで。読む順は、表紙と次の1ページ → 見出しに「論点・方向性・まとめ・概要」のあるページ
    → ほかのページ → 「（参考）」のページ。資料の肝（論点・案）は後ろのページにあることが多い（総務省WG資料15-1は14ページ目）"""
    raw, _ = get(url)
    with tempfile.NamedTemporaryFile(suffix=".pdf") as f:
        f.write(raw)
        f.flush()
        r = subprocess.run(["pdftotext", "-l", "30", "-enc", "UTF-8", f.name, "-"], capture_output=True, timeout=90)
    pages = [re.sub(r"\n\s*\n+", "\n", re.sub(r"[ \t\u3000]+", " ", x)).strip() for x in r.stdout.decode("utf-8", "replace").split("\f")]
    pages = [x for x in pages if len(x) >= 40]
    head = [x.split("\n", 1)[0] for x in pages]
    ref = [i for i, x in enumerate(head) if re.match(r"^[（(]参考[)）]", x)]
    order = (list(range(min(2, len(pages)))) + [i for i, x in enumerate(head) if i >= 2 and i not in ref and KEYPAGE.search(x)]
             + [i for i in range(2, len(pages)) if i not in ref] + ref)
    out, seen = [], set()
    for i in order:
        if i in seen:
            continue
        seen.add(i)
        out.append((i, pages[i][:1600]))
        if sum(len(t) for _, t in out) >= budget:
            break
    return "\n".join(t for _, t in sorted(out))[:budget]


PROMPT = """次は日本の{ministry}が公表した「{title}」の{kind}です。ここに書いてあることだけを使って、一般の人に向けた要点を日本語で3〜5個書いてください。
- 1つの要点は1文・70字以内。です・ます調にしない（「〜を検討。」「〜とした。」のように言い切る）
- 数字・日付・固有名詞は、本文にあるものだけ。本文に無い評価・意見・予想は書かない
- 目次・ページ番号・資料番号・あいさつ・会議の段取り（開会・閉会・傍聴の申込み）は要点にしない
- 中身のある内容が無ければ、空の配列を返す
JSONだけを返す: {{"points": ["...", "..."]}}

---
{text}"""

DIG = re.compile(r"[0-9０-９][0-9０-９,，.．]*")
BAD = re.compile(r"[Ѐ-ӿ؀-ۿ฀-๿가-힯]|```|\{|\}")


def zen2han(s: str) -> str:
    return s.translate(str.maketrans("０１２３４５６７８９，．", "0123456789,."))


def ask(ministry: str, title: str, kind: str, text: str) -> list[str]:
    body = json.dumps({"model": MODEL, "prompt": PROMPT.format(ministry=ministry, title=title, kind=kind, text=text[:9000]), "stream": False,
                       "think": False, "format": "json", "options": {"temperature": 0.1, "num_predict": 700, "num_ctx": 12288}}).encode()
    req = urllib.request.Request(OLLAMA, data=body, headers={"Content-Type": "application/json"})
    try:
        d = json.loads(json.loads(urllib.request.urlopen(req, timeout=300).read())["response"])
    except Exception as e:  # noqa: BLE001
        print("   要点の失敗:", e, flush=True)
        return []
    src = zen2han(re.sub(r"\s+", "", text))
    out = []
    for p in d.get("points") or []:
        p = norm(str(p))
        if not p or len(p) > 110 or BAD.search(p):
            continue
        # 資料に無い数字が入った要点は捨てる（モデルの作り話を出さない）
        nums = [zen2han(n).rstrip(",.") for n in DIG.findall(p)]
        if any(n and n not in src for n in nums):
            print("   捨てた（数字が資料に無い）:", p, flush=True)
            continue
        out.append(p)
    return out[:5]


def main() -> int:
    a = sys.argv[1:]
    # 最初の取り込み（--all・数時間）と毎日のジョブが重なると detail.json を書き合って消し合うので、1本ずつ
    lock = open(DATA / ".detail.lock", "w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print("ほかの取り込みが動いているので、今回は飛ばす（前の取り込み分でページは作れる）")
        return 0
    items = json.loads((DATA / "items.json").read_text())
    det = json.loads(OUT.read_text()) if OUT.exists() else {}
    today = dt.date.today()
    force = "--force" in a
    only = a[a.index("--id") + 1] if "--id" in a else ""
    cap = 10**9 if "--all" in a else 120
    cap_sum = 10**9 if "--all" in a else 40
    todo = []
    for it in sorted(items.values(), key=lambda x: (x["date"], x["first_seen"]), reverse=True):
        if only and it["id"] != only:
            continue
        d = det.get(it["id"])
        fresh = (today - dt.date.fromisoformat(it["first_seen"][:10])).days <= 10
        # 資料が後から載る（開催案内→資料掲載）ので、出て10日以内は資料が無いあいだ取り直す
        if force or not d or (fresh and not d.get("files") and d.get("fetched", "")[:10] != today.isoformat()):
            todo.append(it)
    print(f"取り込む発表 {len(todo)}件（上限 {min(cap, len(todo))}）", flush=True)
    n = ns = 0
    for it in todo[:cap]:
        iid = it["id"]
        old = det.get(iid) or {}
        rec = {"fetched": dt.datetime.now().isoformat(timespec="seconds")}
        try:
            if FILE_EXT.search(it["url"]):
                rec.update({"facts": [], "text": "", "files": [{"title": it["title"][:120], "url": it["url"]}], "h1": ""})
            else:
                rec.update(page(it["url"], it["title"]))
        except Exception as e:  # noqa: BLE001
            rec["error"] = f"{type(e).__name__}: {e}"[:200]
            print(f"  {iid} 取れない {rec['error']}", flush=True)
            if old.get("facts") or old.get("files"):
                old["error_last"] = rec["error"]
                det[iid] = old
                continue
        time.sleep(1.0)
        # 要点：資料（PDF）があれば資料の先頭、なければ本文が長いときだけ本文から
        same_files = [f["url"] for f in rec.get("files", [])] == [f["url"] for f in old.get("files", [])]
        if old.get("points") is not None and same_files and not force:
            rec["points"], rec["points_src"] = old.get("points"), old.get("points_src", [])
        elif ns < cap_sum and not rec.get("error"):
            src, used = "", []
            for f in [f for f in rec.get("files", []) if f["url"].lower().split("?")[0].endswith(".pdf")][:2]:
                try:
                    t = pdf_text(f["url"])
                    time.sleep(1.0)
                except Exception as e:  # noqa: BLE001
                    print(f"  {iid} PDF 取れない {f['url']} {e}", flush=True)
                    continue
                if len(t) >= 200:
                    src += f"\n【{f['title']}】\n{t[:6000]}"
                    used.append(f["title"])
                if len(src) > 9000:
                    break
            kind = "配布資料"
            if len(src) < 400 and len(rec.get("text", "")) >= 1200:
                src, used, kind = rec["text"], [], "公式ページの本文"
            if len(src) >= 400:
                rec["points"] = ask(it["ministry_name"], it["title"], kind, src)
                rec["points_src"] = used
                rec["points_model"] = MODEL
                ns += 1
                print(f"  {iid} 要点 {len(rec['points'])}個（{kind}）{it['title'][:30]}", flush=True)
            else:
                rec["points"], rec["points_src"] = [], []
        det[iid] = rec
        n += 1
        if n % 20 == 0:
            OUT.write_text(json.dumps(det, ensure_ascii=False, indent=1))
            print(f"  {n}/{min(cap, len(todo))}", flush=True)
    # 本文の全文（text）は要点づくりにだけ使い、保存しない（ページに出すのは冒頭の行だけ）
    for v in det.values():
        v.pop("text", None)
    OUT.write_text(json.dumps(det, ensure_ascii=False, indent=1))
    print(f"取り込み {n}件・要点 {ns}件・累計 {len(det)}件 → {OUT}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
