#!/usr/bin/env python3
"""決めたファイルだけを heteml へ1接続（FTPS explicit）で送る。
heteml は短時間に FTP ログインを重ねるとうちのIPだけ遮断する（15〜20分）ので、1ファイル1接続の deploy.sh を
使えない少数の差し替えはこちらで送る。

使い方: python3 scripts/ftps_put.py <ローカルの起点> <リモートの起点(/web/...)> <相対パス>...
  例: python3 scripts/ftps_put.py /home/kojima/work/exbridge_jp /web/exbridge_jp solution/doubutsu.html solution/index.html
認証は環境変数 FTP_HOST / FTP_USER / FTP_PASS（aixec/.env を読んでから実行）。"""
import ftplib
import os
import posixpath
import sys


def ensure_dir(ftp, path):
    parts = [p for p in path.split('/') if p]
    cur = ''
    for p in parts:
        cur += '/' + p
        try:
            ftp.cwd(cur)
        except ftplib.error_perm:
            ftp.mkd(cur)


def main():
    base, remote, files = sys.argv[1], sys.argv[2].rstrip('/'), sys.argv[3:]
    ftp = ftplib.FTP_TLS(os.environ['FTP_HOST'], timeout=60)
    ftp.login(os.environ['FTP_USER'], os.environ['FTP_PASS'])
    ftp.prot_p()
    ok = 0
    for rel in files:
        dst = posixpath.join(remote, rel)
        ensure_dir(ftp, posixpath.dirname(dst))
        with open(os.path.join(base, rel), 'rb') as f:
            ftp.storbinary('STOR ' + dst, f)
        ok += 1
    ftp.quit()
    print(f'送信 {ok} 件（1接続）')


if __name__ == '__main__':
    main()
