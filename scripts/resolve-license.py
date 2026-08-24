#!/usr/bin/env python3
"""GitHubが機械判定できなかったライセンス(NOASSERTION)を、本文から判定する。

なぜ必要か（2026-08-24 実測）:
  select.ts が spdx=NOASSERTION を一律で落としており、他の条件を全部通った
  ものだけで782件が抜けていた。中身は n8n・dify・nocodb・metabase・odoo・
  strapi・directus・twenty・outline・medusa など、業務OSSとして最も
  検索需要のある製品ばかり。
  NOASSERTION は「ライセンスが無い」ではなく「GitHubが判定できなかった」で、
  理由はデュアルライセンス(AGPL+商用など)や独自ライセンスだった。

判定の方針:
  - OSI承認のもの      → 掲載する。AGPLだけは顧客側の公開義務を注記する
  - ソース公開系（独自）→ 掲載する。ホスティング提供・再販ができない旨を明記する
  - 判定できないもの    → 従来どおり掲載しない

出力: data/harvest/licenses.json
  { "n8n-io/n8n": {"license": "...", "tier": "...", "note": "..."} }

使い方: python3 scripts/resolve-license.py [--limit N]
"""
import base64
import glob
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POOL = ROOT / "data" / "harvest"
OUT = POOL / "licenses.json"

# 上から順に当て、最初に一致したものを採る。独自ライセンスを先に置く
# （多くが「Apache 2.0 をベースに制限を足した」形で、後ろの語も混ざるため）。
RULES = [
    ("提供元独自の商用ライセンス", "eula",
     r"do not use the same license on more than one project"
     r"|each licensed copy of the software"
     r"|per-?site license|requires a paid license"),
    ("Sustainable Use License", "source-available",
     r"sustainable use license"),
    ("Business Source License", "source-available",
     r"business source license|\bBSL\b"),
    ("Elastic License", "source-available",
     r"elastic license"),
    ("Functional Source License", "source-available",
     r"functional source license"),
    ("Monospace Sustainable Core License", "source-available",
     r"monospace sustainable core license"),
    ("Commons Clause 付き", "source-available",
     r"commons clause"),
    ("Server Side Public License", "source-available",
     r"server side public license|\bSSPL\b"),
    ("Fair Source License", "source-available",
     r"fair source license"),
    ("AGPL-3.0", "osi-network-copyleft",
     r"gnu affero general public license"),
    ("GPL-3.0", "osi-copyleft",
     r"gnu general public license\s*\n?\s*version 3"),
    ("GPL-2.0", "osi-copyleft",
     r"gnu general public license\s*\n?\s*version 2"),
    ("LGPL-3.0", "osi-copyleft",
     r"gnu lesser general public license\s*\n?\s*version 3"),
    ("LGPL-2.1", "osi-copyleft",
     r"gnu lesser general public license"),
    ("MPL-2.0", "osi",
     r"mozilla public license"),
    ("Apache-2.0", "osi",
     r"apache license\s*\n?\s*version 2"),
    ("MIT", "osi",
     r"permission is hereby granted, free of charge"),
    ("BSD", "osi",
     r"redistribution and use in source and binary forms"),
    ("OSL-3.0", "osi-copyleft", r"open software license"),
    ("AFL-3.0", "osi", r"academic free license"),
    ("EPL", "osi-copyleft", r"eclipse public license"),
    ("CDDL", "osi-copyleft", r"common development and distribution license"),
    ("Artistic", "osi", r"the artistic license"),
    ("ISC", "osi", r"permission to use, copy, modify, and/or distribute this software"),
    ("Zlib", "osi", r"this software is provided ['‘]as-is['’]"),
    ("Unlicense", "osi", r"this is free and unencumbered software released into the public domain"),
    ("CC0", "osi", r"creative commons zero|cc0 1\.0 universal"),
    ("CC BY-SA", "content", r"creative commons attribution"),
    # 提供元が独自に名付けたもの。OSI承認ではないので source-available 扱い。
    ("提供元独自のコミュニティライセンス", "source-available",
     r"community license|community edition license|open core license"),
]

NOTE = {
    "osi": "自社利用・受託での構築とカスタマイズができます。",
    "osi-copyleft": "自社利用・受託での構築とカスタマイズができます。改変して配布する場合は、同じライセンスでソースを公開する義務があります。",
    "osi-network-copyleft": "自社利用・受託での構築とカスタマイズができます。改変したものを社外に公開して使わせる場合は、改変部分のソース公開義務が利用者側に発生します（社内利用のみなら不要）。",
    "source-available": "ソースは公開されていますが、OSI承認のオープンソースではありません。自社の業務のための利用と、その環境への構築・カスタマイズはできますが、第三者へのホスティング提供や再販はできません。",
    "dual": "本体はオープンソースですが、一部の機能やファイルが別ライセンス（多くは有償の企業向け機能）です。どこまで無償で使えるかは、導入前に対象機能ごとに確認します。",
    "eula": "提供元との個別の利用許諾契約に基づく製品です。OSI承認のオープンソースではありません。利用条件は提供元にご確認ください。",
    "content": "文書・教材向けのライセンスです（ソフトウェア用ではありません）。",
}


def token() -> str:
    t = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if t:
        return t
    return subprocess.run(["gh", "auth", "token"], capture_output=True,
                          text=True, check=True).stdout.strip()


def get(url: str, tok: str):
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {tok}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "kpayload-license-resolver",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


# 「基本はOSSだが一部は別ライセンス」という書き方。これを見落として単純な
# MIT/Apacheと表示すると、企業向け機能が有償だと知らずに検討させてしまう
# （strapi・cube・automatisch・medusa などが該当）。
DUAL_RX = re.compile(
    r"portions of .{0,40}(are|is) licensed as follows"
    r"|except for files that contain"
    r"|covered by one of two licenses"
    r"|unless the header or package license file specifies"
    r"|licensed under a modified version of"
    r"|with the following additional condition"
    r"|see the licen[cs]e[^\n]{0,30}in each"
    r"|is licensed under [^\n]{0,40} and [^\n]{0,40} are licensed under"
    r"|multi-licensed"
    r"|the license that applies depends on",
    re.I | re.S)

# 会社との個別契約書がそのままLICENSEに置かれている形。OSSではない。
EULA_RX = re.compile(r"license agreement\b.{0,400}(pte\.? ltd|inc\.|gmbh|co\.,? ltd|company)",
                     re.I | re.S)


def classify(text: str):
    low = text.lower()
    if EULA_RX.search(text[:1200]):
        return "独自の利用許諾契約", "eula"
    base_name = base_tier = None
    for name, tier, rx in RULES:
        if re.search(rx, low, re.S):
            base_name, base_tier = name, tier
            break
    if DUAL_RX.search(text[:6000]):
        if base_name:
            return f"{base_name}（一部は別ライセンス）", "dual"
        return "一部が別ライセンス", "dual"
    return base_name, base_tier


def main() -> None:
    redo = "--redo-unresolved" in sys.argv
    limit = 0
    if "--limit" in sys.argv:
        limit = int(sys.argv[sys.argv.index("--limit") + 1])

    pool = {}
    for f in glob.glob(str(POOL / "*.json")):
        if "selected" in f or "licenses" in f:
            continue
        try:
            d = json.load(open(f, encoding="utf-8"))
        except Exception:
            continue
        for it in (d if isinstance(d, list) else d.get("items", [])):
            if it.get("full_name"):
                pool[it["full_name"]] = it

    stale = (datetime.now() - timedelta(days=548)).strftime("%Y-%m-%d")
    targets = [r for r in pool.values()
               if ((r.get("license") or {}).get("spdx_id") in (None, "", "NOASSERTION"))
               and not r.get("archived") and not r.get("fork")
               and (r.get("description") or "").strip()
               and (r.get("pushed_at") or "")[:10] >= stale]
    targets.sort(key=lambda r: -r.get("stargazers_count", 0))
    if limit:
        targets = targets[:limit]

    done = json.load(open(OUT, encoding="utf-8")) if OUT.exists() else {}
    tok = token()
    stats = {}
    for i, repo in enumerate(targets, 1):
        name = repo["full_name"]
        if name in done and not (redo and not done[name].get("tier")):
            continue
        try:
            info = get(f"https://api.github.com/repos/{name}/license", tok)
            text = base64.b64decode(info.get("content", "")).decode("utf-8", "ignore")
        except urllib.error.HTTPError as e:
            if e.code == 403:                      # レート制限。待って続ける
                time.sleep(60)
                continue
            done[name] = {"license": None, "tier": None, "note": None}
            continue
        except Exception:
            continue
        lic, tier = classify(text[:8000])
        done[name] = {"license": lic, "tier": tier,
                      "note": NOTE.get(tier) if tier else None}
        stats[tier or "判定不能"] = stats.get(tier or "判定不能", 0) + 1
        if i % 50 == 0:
            OUT.write_text(json.dumps(done, ensure_ascii=False, indent=1), encoding="utf-8")
            print(f"  {i}/{len(targets)} 件  {stats}", flush=True)

    OUT.write_text(json.dumps(done, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"判定済み {len(done)} 件 → {OUT}")
    agg = {}
    for v in done.values():
        agg[v.get("tier") or "判定不能"] = agg.get(v.get("tier") or "判定不能", 0) + 1
    for k, v in sorted(agg.items(), key=lambda x: -x[1]):
        print(f"  {v:5}  {k}")


if __name__ == "__main__":
    main()
