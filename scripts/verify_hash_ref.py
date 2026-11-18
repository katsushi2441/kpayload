#!/usr/bin/env python3
"""公開ページに自社リンクの ?ref= が残っていないかを実測する（2026-11-19）。
  python3 scripts/verify_hash_ref.py <URL>...
各URLについて: HTTPステータス・PHPエラーの有無・自社（exbridge.jp/kurage/kappstore と相対）への ?ref= リンク数（chat.php・simpletrack.php を除く）・#ref= リンク数。
"""
import re
import sys
import urllib.request

OWN = re.compile(r'^(?:https?:)?//(?:www\.)?(?:exbridge\.jp|kurage\.exbridge\.jp|kappstore\.exbridge\.jp)(?=[/?#]|$)', re.I)
SCHEME = re.compile(r'^(?:[a-z][a-z0-9+.-]*:|//)', re.I)
HREF = re.compile(r'''\shref=(["'])([^"']*)\1''', re.I)
PHPERR = re.compile(r'(Fatal error|Parse error|Warning</b>:|Notice</b>:|Deprecated</b>:)')
bad_total = 0
for u in sys.argv[1:]:
    req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0 (hashref-verify)'})
    try:
        r = urllib.request.urlopen(req, timeout=30)
        code, body = r.status, r.read().decode('utf-8', 'ignore')
    except urllib.error.HTTPError as e:
        code, body = e.code, ''
    q = h = 0
    bad = []
    for _, href in HREF.findall(body):
        own = OWN.match(href) or not SCHEME.match(href)
        if not own or re.search(r'(chat|simpletrack)\.php', href):
            continue
        if re.search(r'[?&](amp;)?ref=', href.split('#', 1)[0]):
            q += 1
            bad.append(href)
        if re.search(r'#.*ref=', href):
            h += 1
    err = bool(PHPERR.search(body))
    bad_total += q
    print(f'{code} ?ref={q} #ref={h} phperr={err} {u}' + (f'  例: {bad[0]}' if bad else ''))
sys.exit(1 if bad_total else 0)
