#!/usr/bin/env python3
"""前回送ったときから中身が変わったファイルだけを、heteml へ1接続（FTPS）で送る。

  python3 scripts/put_changed.py <ローカルの起点> <リモートの起点(/web/...)> <セット名(相対パス)> [--init] [--dry-run]
    例: python3 scripts/put_changed.py /home/kojima/work/exbridge_jp /web/exbridge_jp vibeblog

- 「中身」はページ下の「最終更新日」などの日付を伏せてから比べる。build を回すと全ページの日付だけが変わるので、
  日付しか違わないページは送らない（2026-10-07: vibeblog は約285ファイルを毎回1つずつ別接続で送っていた）。
- 記録は kpayload/outputs/put_changed_<セット名>.json（送れたファイルの「日付を伏せた中身」の sha1）。
- --init: 送らずに、いまのローカルの状態を「送り済み」として記録する（本番と同じだと分かっているとき）。
- 認証は環境変数 FTP_HOST / FTP_USER / FTP_PASS（aixec/.env を読んでから実行）。
"""
import ftplib
import hashlib
import json
import os
import posixpath
import re
import sys

KP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATE = re.compile(rb'20\d\d-\d\d-\d\d(T[\d:.+Z-]+)?|20\d\d\xe5\xb9\xb4\d{1,2}\xe6\x9c\x88\d{1,2}\xe6\x97\xa5')  # 2026-10-07 / 2026年10月07日
SKIP = {"canonical-map.json"}   # GitHub Pages 側の向け替え用の作業ファイル。公開しない


def digest(path):
    b = open(path, "rb").read()
    if path.endswith((".html", ".xml", ".json", ".txt")):
        b = DATE.sub(b"D", b)
    return hashlib.sha1(b).hexdigest()


def ensure_dir(ftp, path, made):
    cur = ""
    for p in [x for x in path.split("/") if x]:
        cur += "/" + p
        if cur in made:
            continue
        try:
            ftp.cwd(cur)
        except ftplib.error_perm:
            ftp.mkd(cur)
        made.add(cur)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    base, remote, sub = args[0], args[1].rstrip("/"), args[2].strip("/")
    rec_path = os.path.join(KP, "outputs", f"put_changed_{sub.replace('/', '_')}.json")
    os.makedirs(os.path.dirname(rec_path), exist_ok=True)
    rec = json.load(open(rec_path)) if os.path.exists(rec_path) else {}
    now = {}
    for root, _, files in os.walk(os.path.join(base, sub)):
        for f in files:
            if f in SKIP or f.startswith("."):
                continue
            rel = os.path.relpath(os.path.join(root, f), base)
            now[rel] = digest(os.path.join(base, rel))
    if "--init" in sys.argv:
        json.dump(now, open(rec_path, "w"), indent=0, sort_keys=True)
        print(f"記録だけ作成: {len(now)}件 → {rec_path}")
        return
    todo = sorted(r for r, h in now.items() if rec.get(r) != h)
    print(f"{sub}: {len(now)}件中 変わった・新しい {len(todo)}件")
    for r in todo[:30]:
        print("  ", r)
    if not todo or "--dry-run" in sys.argv:
        return
    ftp = ftplib.FTP_TLS(os.environ["FTP_HOST"], timeout=120)
    ftp.login(os.environ["FTP_USER"], os.environ["FTP_PASS"])
    ftp.prot_p()
    made = set()
    try:
        for rel in todo:
            dst = posixpath.join(remote, rel)
            ensure_dir(ftp, posixpath.dirname(dst), made)
            with open(os.path.join(base, rel), "rb") as fh:
                ftp.storbinary("STOR " + dst, fh)
            rec[rel] = now[rel]   # 送れたものから記録する（途中で切れても、次は残りだけ送る）
    finally:
        json.dump(rec, open(rec_path, "w"), indent=0, sort_keys=True)
        try:
            ftp.quit()
        except Exception:
            pass
    print(f"送信 {len(todo)} 件（1接続）")


if __name__ == "__main__":
    main()
