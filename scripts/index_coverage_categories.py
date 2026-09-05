#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""カテゴリページがGoogleに登録されているかを URL検査API で実測する。

  python3 scripts/index_coverage_categories.py [--which oss|cap|sol|all] [--limit N]

「登録されている＝検索に出る」ではないが、登録すらされていなければ
OGP画像やタイトルを直しても効かない。直した効果を待つ前にここを見る。
認証は googleads/gsc_oauth.py の refresh_token を使う（無人実行できる）。
"""
import argparse
import collections
import json
import os
import sys
import time
import urllib.error
import urllib.request

sys.path.insert(0, "/home/kojima/work/googleads")
from gsc_oauth import access_token  # noqa: E402

API = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect"
KURAGE = "https://kurage.exbridge.jp/"
EXB = "https://exbridge.jp/"


def urls(which):
    out = []
    if which in ("oss", "all"):
        base = "/home/kojima/work/kurage_web/oss/c"
        for k in sorted(os.listdir(base)):
            if os.path.isdir(os.path.join(base, k)):
                out.append((KURAGE, KURAGE + "oss/c/" + k + "/", "oss/" + k))
    if which in ("cap", "all"):
        base = "/home/kojima/work/exbridge_jp/ai-system/c"
        if os.path.isdir(base):
            for k in sorted(os.listdir(base)):
                if os.path.isdir(os.path.join(base, k)):
                    out.append((EXB, EXB + "ai-system/c/" + k + "/", "cap/" + k))
    if which in ("sol", "all"):
        base = "/home/kojima/work/exbridge_jp/solution"
        if os.path.isdir(base):
            for f in sorted(os.listdir(base)):
                if f.endswith(".html") and f != "index.html":
                    out.append((EXB, EXB + "solution/" + f, "sol/" + f[:-5]))
    return out


def inspect(tok, site, url):
    body = json.dumps({"inspectionUrl": url, "siteUrl": site, "languageCode": "ja"}).encode()
    req = urllib.request.Request(API, data=body, headers={
        "Authorization": "Bearer " + tok, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            d = json.load(r)
        s = d["inspectionResult"]["indexStatusResult"]
        return s.get("coverageState", "?"), s.get("lastCrawlTime", "-")
    except urllib.error.HTTPError as e:
        return "HTTP %d" % e.code, "-"
    except Exception as e:
        return "ERR %s" % str(e)[:30], "-"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--which", default="all", choices=["oss", "cap", "sol", "all"])
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--quiet", action="store_true", help="集計だけ出す")
    args = ap.parse_args()

    targets = urls(args.which)
    if args.limit:
        targets = targets[:args.limit]
    tok = access_token()
    tally = collections.Counter()
    bad = []
    for i, (site, url, label) in enumerate(targets):
        state, crawl = inspect(tok, site, url)
        tally[state] += 1
        if "登録されました" not in state and "Submitted and indexed" not in state:
            bad.append((label, state, (crawl or "-")[:10]))
        if not args.quiet:
            print("  %-22s %-30s %s" % (label, state, (crawl or "-")[:10]), flush=True)
        # URL検査APIは分あたりの上限があるので少し空ける
        time.sleep(0.35)
    print("\n=== 集計（%d件）" % len(targets))
    for k, v in tally.most_common():
        print("  %-34s %d" % (k, v))
    if bad:
        print("\n=== 未登録（%d件）" % len(bad))
        for label, state, crawl in bad[:40]:
            print("  %-22s %-30s %s" % (label, state, crawl))


if __name__ == "__main__":
    main()
