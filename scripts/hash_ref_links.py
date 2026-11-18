#!/usr/bin/env python3
"""生成済み・手置きのHTML/PHPの中の自社リンクの計測 ref を ?ref= から #ref= に置き換える（2026-11-19）。

なぜ: ?ref= だと Google・Bing が ref ごとに別URLとして拾う（Bing Webmaster の
「多数のページが同じ canonical」警告。ai-it-komon.html?ref=… など 2,584 URL）。
生成元（kpayload の page-shell.ts の hashRefLinks）と同じ規則で、生成元が無い・
作り直せないページだけをこれで直す。

規則（page-shell.ts の hashRefUrl と同じ）:
  - 対象は href="…" / href='…' の中で、exbridge.jp・kurage.exbridge.jp・kappstore.exbridge.jp
    と相対リンク。外部サイト・proto.exbridge.jp・xb4g.com は触らない。
  - chat.php（サーバー側で ?ref= を読む）と simpletrack.php（計測そのもの）は替えない。
  - ほかのクエリは残して ref だけ抜き、#ref= を後ろに付ける。
  - すでに目印（#form 等）があるときは目印を残して ref を捨てる（# を2つにしない）。

使い方:
  python3 hash_ref_links.py --dry-run <ファイルかディレクトリ>...   # 件数だけ
  python3 hash_ref_links.py --apply --log <記録.txt> <ファイルかディレクトリ>...
"""
import argparse
import os
import re
import sys

OWN = re.compile(r'^(?:https?:)?//(?:www\.)?(?:exbridge\.jp|kurage\.exbridge\.jp|kappstore\.exbridge\.jp)(?=[/?#]|$)', re.I)
SCHEME = re.compile(r'^(?:[a-z][a-z0-9+.-]*:|//)', re.I)
KEEP = re.compile(r'(?:^|/)(?:chat|simpletrack)\.php(?:[/?#]|$)', re.I)
HREF = re.compile(r'''(\shref=)(["'])([^"']*?(?:[?&]|&amp;)ref=[^"']*)\2''', re.I)
# --php-strings: PHP の配列などに書いたURLの文字列（'https://…?ref=…' / 'xxx.php?ref=…'）も直す
PHPSTR = re.compile(r"(')((?:https?://[^'\s]+|[a-z0-9_][a-z0-9_./-]*\.(?:php|html)/?[^'\s]*|oss/[^'\s]*)(?:[?&]|&amp;)ref=[^'\s]*)(')", re.I)
EXTS = ('.html', '.htm', '.php')


def hash_ref_url(u: str) -> str:
    relative = not SCHEME.match(u)
    if not relative and not OWN.match(u):
        return u
    if KEEP.search(u):
        return u
    # PHP の埋め込み（<?= … ?>）を含むURLは機械で直さない
    if '<?' in u or '?>' in u:
        return u
    hi = u.find('#')
    pre, frag = (u, '') if hi < 0 else (u[:hi], u[hi + 1:])
    qi = pre.find('?')
    if qi < 0:
        return u
    query = pre[qi + 1:]
    sep = '&amp;' if '&amp;' in query else '&'
    keep, ref = [], None
    for p in re.split(r'&(?:amp;)?', query):
        if ref is None and p.startswith('ref='):
            ref = p[4:]
        elif p:
            keep.append(p)
    if ref is None:
        return u
    base = pre[:qi] + ('?' + sep.join(keep) if keep else '')
    return f'{base}#{frag}' if frag else f'{base}#ref={ref}'


def hash_ref_links(html: str, php_strings: bool = False) -> tuple[str, int]:
    n = 0

    def rep(m):
        nonlocal n
        new = hash_ref_url(m.group(3))
        if new != m.group(3):
            n += 1
        return f'{m.group(1)}{m.group(2)}{new}{m.group(2)}'

    def rep2(m):
        nonlocal n
        new = hash_ref_url(m.group(2))
        if new != m.group(2):
            n += 1
        return new

    out = HREF.sub(rep, html)
    if php_strings:
        out = PHPSTR.sub(lambda m: f"'{rep2(m)}'", out)
    return out, n


def iter_files(paths):
    for p in paths:
        if os.path.isdir(p):
            for dp, dn, fn in os.walk(p):
                dn[:] = [d for d in dn if d not in ('.git', 'node_modules', 'outputs', 'vendor', 'storage')]
                for f in sorted(fn):
                    if f.endswith(EXTS):
                        yield os.path.join(dp, f)
        elif os.path.isfile(p):
            yield p


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('paths', nargs='+')
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument('--dry-run', action='store_true')
    g.add_argument('--apply', action='store_true')
    ap.add_argument('--log')
    ap.add_argument('--php-strings', action='store_true', help='.php の中の URL 文字列（配列など）も直す')
    a = ap.parse_args()
    files = links = 0
    changed = []
    for f in iter_files(a.paths):
        try:
            s = open(f, encoding='utf-8').read()
        except UnicodeDecodeError:
            continue
        new, n = hash_ref_links(s, php_strings=a.php_strings and f.endswith('.php'))
        if n:
            files += 1
            links += n
            changed.append(f'{f}\t{n}')
            if a.apply:
                with open(f, 'w', encoding='utf-8', newline='') as fh:
                    fh.write(new)
    if a.log:
        with open(a.log, 'w', encoding='utf-8') as fh:
            fh.write('\n'.join(changed) + '\n')
    print(f'{"変更" if a.apply else "変更予定"}: {files} ファイル / {links} リンク')


if __name__ == '__main__':
    sys.exit(main())
