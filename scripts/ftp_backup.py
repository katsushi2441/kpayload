#!/usr/bin/env python3
"""本番（heteml）のファイルを、上書きする前に1接続（FTPS）で手元へ退避する（2026-11-19）。

  python3 scripts/ftp_backup.py <リモートの起点(/web/...)> <退避先ディレクトリ> <ローカルの起点> <相対パス or ディレクトリ>...
    例: python3 scripts/ftp_backup.py /web/exbridge_jp outputs/backup_20261119/exbridge_jp /home/kojima/work/exbridge_jp ai-system index.html

- 引数のディレクトリは「ローカルにあるファイルの一覧」で展開する（これから送るファイルだけを退避する）。
- サーバーに無いファイルは飛ばす（新しいファイル）。
- heteml は短い間に接続を重ねると遮断するので、1接続でまとめて取る（reference_heteml_ftp_block）。
- 認証は環境変数 FTP_HOST / FTP_USER / FTP_PASS（aixec/.env を読んでから実行）。
"""
import ftplib
import os
import posixpath
import sys


def main():
    remote, out, base = sys.argv[1].rstrip('/'), sys.argv[2], sys.argv[3]
    rels = []
    for p in sys.argv[4:]:
        full = os.path.join(base, p)
        if os.path.isdir(full):
            for r, _, fs in os.walk(full):
                for f in fs:
                    rels.append(os.path.relpath(os.path.join(r, f), base))
        else:
            rels.append(p)
    ftp = ftplib.FTP_TLS(os.environ['FTP_HOST'], timeout=120)
    ftp.login(os.environ['FTP_USER'], os.environ['FTP_PASS'])
    ftp.prot_p()
    got = miss = 0
    try:
        for rel in sorted(rels):
            dst = os.path.join(out, rel)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            try:
                with open(dst + '.part', 'wb') as fh:
                    ftp.retrbinary('RETR ' + posixpath.join(remote, rel), fh.write)
                os.replace(dst + '.part', dst)
                got += 1
            except ftplib.error_perm:
                os.remove(dst + '.part')
                miss += 1
    finally:
        try:
            ftp.quit()
        except Exception:
            pass
    print(f'退避 {got} 件（サーバーに無い {miss} 件）→ {out}')


if __name__ == '__main__':
    main()
