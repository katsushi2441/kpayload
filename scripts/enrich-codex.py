#!/usr/bin/env python3
"""紹介文の生成を Codex CLI で行う。出力は enrich.ts と同じ形式。

なぜ要るか（2026-08-25）:
  既定の enrich.ts はローカルの gemma4 を使い、1件90秒かかる。未処理が896件
  残っており、全部流すと22時間かかるうえ、その間ローカルのLLMキューを占有して
  kmontage の動画生成が待たされる。
  Codex CLI は1件13〜22秒で、ローカルGPUを使わない。

出力先・ファイル名・中身は enrich.ts と完全に同じにする。混ぜて使えるようにするため。
（enrich.ts が既に作ったファイルは触らない）

使い方:
  python3 scripts/enrich-codex.py            # 未処理を全部
  python3 scripts/enrich-codex.py --limit 20 # 20件だけ
  python3 scripts/enrich-codex.py --only planka,openproject
  CONCURRENCY=4 python3 scripts/enrich-codex.py
"""
import argparse, json, os, re, subprocess, sys, tempfile, threading, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SELECTED = ROOT / "data/harvest/selected.json"
OUT_DIR = ROOT / "data/harvest/enriched"
SCHEMA = ROOT / "data/harvest/enrich-schema.json"

SCHEMA_BODY = {
    "type": "object", "additionalProperties": False,
    "required": ["kind", "summary", "description", "useCases", "keywords", "faqs"],
    "properties": {
        "kind": {"type": "string", "enum": ["business-app", "dev-tool", "library"]},
        "summary": {"type": "string"},
        "description": {"type": "string"},
        "useCases": {"type": "array", "minItems": 5, "maxItems": 5, "items": {"type": "string"}},
        "keywords": {"type": "array", "minItems": 6, "maxItems": 6, "items": {"type": "string"}},
        "faqs": {"type": "array", "minItems": 4, "maxItems": 4, "items": {
            "type": "object", "additionalProperties": False,
            "required": ["question", "answer"],
            "properties": {"question": {"type": "string"}, "answer": {"type": "string"}}}},
    },
}

# enrich.ts の prompt() と同じ内容。スター数を書かせない一文だけ足している
# （Codexは指示に素直なので、書くなと言わないと本文に「スター数は約3,800」と入れる）。
PROMPT = """次のオープンソースソフトウェアを分類し、日本の中小企業の担当者に向けた紹介文をJSONで書いてください。

名前: {name}
説明(英語): {desc}
主なトピック: {topics}
主な言語: {lang}
ライセンス: {license}
スター数: {stars}

まず kind を次の3つから選んでください。判断を誤ると誤った提案になるので慎重に。
- "business-app": 業務の担当者がそのまま使う完成したアプリ。導入して画面や項目を自社向けに変えて納品できる。
  例) 顧客管理、問合せ管理、在庫管理、勤怠、会計、予約、EC、社内ポータル、グループウェア
- "dev-tool": 開発者が何かを作るために使う道具。単体では業務担当者の仕事にならない。
  例) 静的サイトジェネレータ、フレームワーク、CLI、データベース、監視基盤、可視化基盤、
      ローカルLLM実行環境、エージェント基盤、CI、コード生成
- "library": 他のプログラムに組み込む部品。単体で起動して使う画面を持たない。
  例) Python/JavaScriptのライブラリ、SDK、画像処理ツールキット、モデル実装

守ること:
- 英語の説明から読み取れる事実だけを書く。機能を創作しない。
- 日本語対応の有無、価格、導入実績は書かない（未確認のため）。
- スター数やライセンス名を本文やFAQに書かない（別の欄で表示するため重複する）。
- 「弊社が対応します」などの営業文は書かない。
- summary は「〜です」で終える体言止めにしない文にする。"""

lock = threading.Lock()
stats = {"made": 0, "failed": 0, "dropped": 0, "done": 0}
taken = set()


def slug_of(full_name: str) -> str:
    short = (full_name.split("/")[-1]).lower()
    base = re.sub(r"[^a-z0-9]+", "-", short).strip("-") or "oss"
    if base not in taken:
        taken.add(base); return base
    owner = re.sub(r"[^a-z0-9]+", "-", full_name.split("/")[0].lower())
    with_owner = f"{owner}-{base}".strip("-")
    if with_owner not in taken:
        taken.add(with_owner); return with_owner
    n = 2
    while f"{base}-{n}" in taken: n += 1
    taken.add(f"{base}-{n}"); return f"{base}-{n}"


def generate(repo: dict) -> dict | None:
    prompt = PROMPT.format(
        name=repo["full_name"].split("/")[-1],
        desc=repo.get("description") or "",
        topics=", ".join((repo.get("topics") or [])[:8]),
        lang=repo.get("language") or "不明",
        license=(repo.get("license") or {}).get("spdx_id") or "不明",
        stars=repo.get("stargazers_count", 0))
    for attempt in range(3):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            out = f.name
        try:
            r = subprocess.run(
                ["codex", "exec", "--sandbox", "read-only", "--skip-git-repo-check",
                 "--output-schema", str(SCHEMA), "-o", out, prompt],
                stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=300)
            if r.returncode == 0 and os.path.getsize(out) > 0:
                return json.load(open(out, encoding="utf-8"))
        except Exception:
            pass
        finally:
            try: os.unlink(out)
            except OSError: pass
        time.sleep(2 + attempt * 3)
    return None


def work(queue: list, started: float, total: int) -> None:
    while True:
        with lock:
            if not queue: return
            item = queue.pop()
        repo = item["repo"]
        target = OUT_DIR / f"{repo['full_name'].replace('/', '__')}.json"
        if target.exists():
            with lock: stats["done"] += 1
            continue
        g = generate(repo)
        with lock:
            stats["done"] += 1
            if not g:
                stats["failed"] += 1
            elif g["kind"] == "library":
                stats["dropped"] += 1   # 部品は載せない（enrich.ts と同じ判断）
            else:
                funnel = "oss" if g["kind"] == "business-app" else "prototype"
                category = item["category"] if g["kind"] == "business-app" else (
                    "devtools" if item["funnel"] == "oss" else item["category"])
                home = (repo.get("homepage") or "").strip()
                record = {
                    "name": repo["full_name"].split("/")[-1],
                    "slug": slug_of(repo["full_name"]),
                    "category": category, "funnel": funnel, "kind": g["kind"],
                    "summary": g["summary"], "description": g["description"],
                    "license": item.get("licenseName") or (repo.get("license") or {}).get("spdx_id") or "不明",
                    "licenseTier": item.get("licenseTier") or "osi",
                    "licenseNote": item.get("licenseNote"),
                    "japaneseStatus": "未調査",
                    "officialUrl": home if re.match(r"^https?://", home, re.I) else repo["html_url"],
                    "githubUrl": repo["html_url"], "featured": False,
                    "stars": repo.get("stargazers_count", 0), "language": repo.get("language"),
                    "githubCreatedAt": repo.get("created_at"), "githubPushedAt": repo.get("pushed_at"),
                    "useCases": [{"text": t} for t in g["useCases"]],
                    "keywords": [{"text": t} for t in g["keywords"]],
                    "faqs": g["faqs"],
                }
                target.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
                stats["made"] += 1
            if stats["done"] % 10 == 0 or stats["done"] == total:
                sec = (time.time() - started) / max(1, stats["done"])
                left = (total - stats["done"]) * sec / 60
                print(f"  {stats['done']}/{total} 生成{stats['made']} 部品除外{stats['dropped']} "
                      f"失敗{stats['failed']}  {sec:.0f}秒/件  残り約{left:.0f}分", flush=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--only", default="")
    args = ap.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    SCHEMA.write_text(json.dumps(SCHEMA_BODY, ensure_ascii=False), encoding="utf-8")

    # 既存のslugを押さえておく（enrich.ts が作った分と衝突させない）
    for f in OUT_DIR.glob("*.json"):
        try: taken.add(json.loads(f.read_text(encoding="utf-8"))["slug"])
        except Exception: pass

    # 手作りカタログと同じリポジトリは作らない。build-catalog は slug でしか
    # 突き合わせないので、別slugで生成すると同じOSSのページが2枚できる
    # （payloadcms/payload → payload と payload-cms の2枚になりかけた）。
    hand = json.loads((ROOT / "data/oss-catalog.json").read_text(encoding="utf-8"))
    hand_urls = {(x.get("githubUrl") or "").lower().rstrip("/") for x in hand}
    for x in hand:
        taken.add(x["slug"])

    selected = json.loads(SELECTED.read_text(encoding="utf-8"))
    only = [x.strip().lower() for x in args.only.split(",") if x.strip()]
    queue = [x for x in selected
             if not (OUT_DIR / f"{x['repo']['full_name'].replace('/', '__')}.json").exists()
             and (x["repo"]["html_url"] or "").lower().rstrip("/") not in hand_urls
             and (not only or any(k in x["repo"]["full_name"].lower() for k in only))]
    if args.limit:
        queue = queue[:args.limit]
    total = len(queue)
    print(f"未処理 {total}件 / 既存 {len(list(OUT_DIR.glob('*.json')))}件")
    if not total: return
    queue.reverse()   # pop() で先頭から取る

    n = int(os.environ.get("CONCURRENCY", "3"))
    started = time.time()
    threads = [threading.Thread(target=work, args=(queue, started, total), daemon=True) for _ in range(n)]
    for t in threads: t.start()
    for t in threads: t.join()
    print(f"完了: 生成{stats['made']} 部品除外{stats['dropped']} 失敗{stats['failed']} "
          f"／ {(time.time()-started)/60:.0f}分")


if __name__ == "__main__":
    main()
