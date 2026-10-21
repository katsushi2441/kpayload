#!/usr/bin/env python3
"""論文トラッカー：英語の論文に、日本語の題名と1文の要約を付ける（ローカル gemma4）。

  /usr/bin/python3 scripts/academic-summarize.py [テーマのslug ...]   → data/academic/summaries.json（論文IDごと・作った分は使い回す）

- 要旨（abstract）に書いてあることだけで書かせる。要旨が無い論文は題名の訳だけ（要約は作らない）。
- 日本語の論文は題名をそのまま使い、要約は要旨の冒頭を使う（モデルに書き直させない）。
- Ollama は 192.168.0.3 を直接（CLAUDE.md の運用手順）。gemma4 は思考型なので think:false。
"""
import json
import pathlib
import re
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "academic"
CACHE = DATA / "summaries.json"
OLLAMA = "http://192.168.0.3:11434/api/generate"
MODEL = "gemma4:12b-it-qat"

PROMPT = """次の学術論文の題名と要旨を読み、日本語で返してください。
- title_ja: 題名の自然な日本語訳（専門用語はそのまま。50字以内）。題名がすでに日本語なら、そのまま返す
- summary_ja: 何を調べ、何が分かったかを1文で（90字以内）。要旨に書いていないこと・数字は書かない。要旨が空なら空文字
- 一般の言葉は日本語に訳す（例: medical office staff→医療事務職員、large language model→大規模言語モデル、surgical robot→手術ロボット）
- 人名・製品名・システム名・略称（MACC、LandTrendr など）は原文のまま
- 地名は、都道府県と政令指定都市・東京23区だけ漢字にする（Aichi Prefecture→愛知県、Kitakyushu City→北九州市）。それ以外の市町村名は原文のローマ字のまま（例: Fuso→Fuso）
JSONだけを返す: {{"title_ja": "...", "summary_ja": "..."}}

題名: {title}
要旨: {abstract}"""


def ask(title: str, abstract: str) -> dict | None:
    body = json.dumps({"model": MODEL, "prompt": PROMPT.format(title=title, abstract=abstract[:2000] or "（なし）"), "stream": False,
                       "think": False, "format": "json", "options": {"temperature": 0.2, "num_predict": 400}}).encode()
    req = urllib.request.Request(OLLAMA, data=body, headers={"Content-Type": "application/json"})
    try:
        out = json.loads(urllib.request.urlopen(req, timeout=180).read())["response"]
        d = json.loads(out)
    except Exception as e:
        print("   失敗:", e, flush=True)
        return None
    t, s = str(d.get("title_ja", "")).strip(), str(d.get("summary_ja", "")).strip()
    if not t:
        return None
    if not abstract.strip():
        s = ""
    if is_ja(title):
        t = title
    return {"title_ja": t[:80], "summary_ja": s[:140]}


def is_ja(s: str) -> bool:
    return bool(re.search(r"[぀-ヿ一-鿿]", s or ""))


def main() -> None:
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}
    themes = [t["slug"] for t in json.loads((DATA / "themes.json").read_text())]
    want = sys.argv[1:] or themes
    for slug in want:
        d = json.loads((DATA / f"{slug}.json").read_text())
        todo = [w for w in d["works"] if w["id"] not in cache]
        print(f"== {slug}: 要約が無い論文 {len(todo)} 本", flush=True)
        for i, w in enumerate(todo, 1):
            if is_ja(w["title"]) and is_ja(w.get("abstract") or ""):
                cache[w["id"]] = {"title_ja": w["title"], "summary_ja": (w.get("abstract") or "")[:120]}
            else:
                r = ask(w["title"] or "", w.get("abstract") or "")
                if not r:
                    continue
                cache[w["id"]] = r
            if i % 10 == 0:
                CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=1))
                print(f"  {i}/{len(todo)}", flush=True)
        CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=1))
    print("要約", len(cache), "本 →", CACHE)


if __name__ == "__main__":
    main()
