#!/usr/bin/env python3
"""/vibeblog/ の記事に「〇〇とは？」「〇〇を調べるには？」への直接の答えと、よくある質問を付ける（2026-10-23）。

なぜ: Bing の AI Performance（Copilot の引用）で引用されていたのは「thelia とは」「zammadとは」「用途地域 調べ方」のような
問いに直接答えるページで、/vibeblog/ の記事は 3,400回中 約55回だった（2026-10-23 確認）。記事の冒頭に問いと答えを置き、
よくある質問を FAQPage にも入れる。

  /usr/bin/python3 scripts/vibeblog-answers.py [slug ...]   # 指定がなければ data/vibeblog-answer-targets.json の順
  /usr/bin/python3 scripts/vibeblog-answers.py --all         # 全記事（まだ無いものだけ）
    → data/vibeblog-answers.json { slug: {q, a, faq:[{q,a}], hash} }

- 記事の本文だけから作る。本文に無い数字・事実・当社の宣伝は書かせない（プロンプトで指示し、数字は本文にあるかを機械で確かめる）。
- 生成はローカルの gemma4（192.168.0.3 を直接・think:false。CLAUDE.md の運用手順）。本文が変わった記事だけ作り直す。
"""
import glob
import hashlib
import json
import os
import re
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VWORK = "/home/kojima/work/vwork"
OUT = os.path.join(ROOT, "data", "vibeblog-answers.json")
TARGETS = os.path.join(ROOT, "data", "vibeblog-answer-targets.json")
OLLAMA = "http://192.168.0.3:11434/api/generate"
MODEL = "gemma4:12b-it-qat"

PROMPT = """次のブログ記事を読んで、検索する人やAIアシスタントに向けた「直接の答え」を作ってください。

必ず守ること:
- 記事の本文に書かれていることだけを使う。本文に無い数字・日付・事実・評価を書かない。
- 会社の宣伝・問い合わせの誘い・「当社」の売り込みを書かない。
- 固有名詞（製品名・人名・地名）は本文の表記のまま。
- です・ます調。1文は短く。

作るもの（JSONだけを出す）:
{{"q": "この記事が答えている、読者が検索しそうな問い（例:「〇〇とは？」「〇〇を調べるには？」「〇〇の流行状況は？」）",
  "a": "その問いへの直接の答え。2〜3文・120字以内",
  "faq": [{{"q": "よくある質問1", "a": "答え（2文以内）"}}, {{"q": "よくある質問2", "a": "答え"}}, {{"q": "よくある質問3", "a": "答え"}}]}}

記事の題名: {title}

記事の本文:
{body}
"""


def posts() -> dict:
    out = {}
    for d in ("blog", "articles"):
        for f in sorted(glob.glob(os.path.join(VWORK, d, "*.md"))):
            t = open(f, encoding="utf-8").read()
            m = re.match(r"^---\n(.*?)\n---\n(.*)$", t, re.S)
            if not m:
                continue
            fm, body = m.group(1), m.group(2)
            if re.search(r"^published:\s*false\s*$", fm, re.M):
                continue
            if d == "articles" and "Horizonを使い" in body:
                continue
            title = (re.search(r'^title:\s*"?(.*?)"?\s*$', fm, re.M) or [None, ""])[1]
            out[os.path.basename(f)[:-3]] = {"title": title, "body": body}
    return out


def plain(md: str) -> str:
    t = re.sub(r"```.*?```", "", md, flags=re.S)
    t = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", t)
    t = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", t)
    t = re.sub(r"https?://\S+", "", t)
    t = re.sub(r"[#*>|`]", "", t)
    return re.sub(r"\n{2,}", "\n", t).strip()


def ask(title: str, body: str) -> dict:
    req = urllib.request.Request(OLLAMA, data=json.dumps({
        "model": MODEL, "prompt": PROMPT.format(title=title, body=body[:6000]), "stream": False, "think": False,
        "format": "json", "options": {"temperature": 0.2, "num_predict": 1600}}).encode(), headers={"Content-Type": "application/json"})
    r = json.loads(urllib.request.urlopen(req, timeout=300).read())
    return json.loads(r["response"])


def numbers_ok(ans: dict, body: str) -> bool:
    """答えに出てくる数字（2桁以上）が本文にあるか。無ければ作り直し対象にする"""
    norm = body.replace(",", "")
    txt = " ".join([ans.get("a", "")] + [x.get("a", "") + x.get("q", "") for x in ans.get("faq", [])])
    for n in re.findall(r"\d[\d,]*\d", txt):
        if n.replace(",", "") not in norm:
            return False
    return True


def main() -> int:
    ps = posts()
    data = json.load(open(OUT)) if os.path.exists(OUT) else {}
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if "--all" in sys.argv:
        slugs = list(ps)
    elif args:
        slugs = args
    else:
        slugs = json.load(open(TARGETS))["slugs"]
    done = 0
    for s in slugs:
        if s not in ps:
            print("  記事なし", s)
            continue
        body = plain(ps[s]["body"])
        h = hashlib.sha1(body.encode()).hexdigest()[:12]
        if data.get(s, {}).get("hash") == h:
            continue
        ok = None
        for _ in range(2):
            try:
                ans = ask(ps[s]["title"], body)
            except Exception as e:  # noqa: BLE001
                print("  失敗", s, e)
                break
            if ans.get("q") and ans.get("a") and len(ans.get("faq") or []) >= 2 and numbers_ok(ans, body):
                ok = ans
                break
        if not ok:
            print("  作れなかった（数字が本文に無い等）", s)
            continue
        data[s] = {"q": ok["q"].strip(), "a": ok["a"].strip(),
                   "faq": [{"q": x["q"].strip(), "a": x["a"].strip()} for x in ok["faq"][:3] if x.get("q") and x.get("a")], "hash": h}
        done += 1
        print(f"  {s}: {data[s]['q']}")
        json.dump(data, open(OUT, "w"), ensure_ascii=False, indent=1)
    print(f"作った {done}件・累計 {len(data)}件")
    return 0


if __name__ == "__main__":
    sys.exit(main())
