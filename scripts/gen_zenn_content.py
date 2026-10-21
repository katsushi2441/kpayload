#!/usr/bin/env python3
"""/zenn/（OSSの実践記事から探す）133枚の本文を、実際の記事を読んで作り直す（2026-10-09）。

以前の本文は記事の題名とOSSの説明だけから推測した要約（「〜とみられます」）で、一致率0.62・90日クリック21。
Zenn の公開API（zenn.dev/api/articles/<slug>）で記事の本文を読み、記事の要点と、当社の補足
（前提・つまずきやすい点・今の状況）を data/zenn-content/<slug>.json に作る。
他人の記事の本文はリポジトリに入れない（outputs/zenn-src/ は .gitignore 済み）。文の書き写しもさせない。

  /usr/bin/python3 scripts/gen_zenn_content.py [--only sops-app-engine-secrets] [--force] [--jobs 4]
"""
import argparse, json, re, sys, time, urllib.request
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from content_gen import RULES, ask, common_check, run_batch

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'data' / 'zenn-content'
SRC = ROOT / 'outputs' / 'zenn-src'
LIST = json.load(open(ROOT / 'data' / 'zenn-list.json', encoding='utf-8'))
BY = {p['slug']: p for p in LIST}

SCHEMA = """\
{
 "title": "検索結果に出す題名。全角32字以内。下の「検索語」を先頭に置き、「｜」で区切って何が分かるかを続ける",
 "description": "検索結果の説明文。90〜120字",
 "lead": "冒頭の段落 2〜3文。この検索語で探している人の状況と、このページで分かること",
 "summary": ["記事が何をどうしているかの要約。2〜3段落、各150〜250字。自分の言葉で書き、記事の文を書き写さない"],
 "flow": ["記事の手順の流れを1手順ずつ短く（4〜6個）。コマンドや設定値は書かず、何をするかだけ"],
 "notes": [{"h": "見出し", "p": "当社の補足 150〜250字"}],
 "faqs": [{"q": "この検索語で探す人が持つ疑問", "a": "答え 100〜200字"}]
}
notes は3つ（試す前に要る前提／つまずきやすい点／記事の公開から時間がたって変わっている可能性があること・ほかのやり方）、faqs は3つ。"""


def article_text(p):
    path = p['article']['path']
    slug = path.rstrip('/').split('/')[-1]
    cache = SRC / f"{p['slug']}.txt"
    if cache.exists():
        return cache.read_text(encoding='utf-8')
    req = urllib.request.Request(f'https://zenn.dev/api/articles/{slug}', headers={'User-Agent': 'Mozilla/5.0'})
    d = json.load(urllib.request.urlopen(req, timeout=30))['article']
    t = re.sub(r'<(pre|code)[^>]*>.*?</\1>', ' [コード] ', d.get('body_html', ''), flags=re.S)
    t = re.sub(r'<[^>]+>', '', t)
    t = re.sub(r'\n{3,}', '\n\n', t).strip()
    SRC.mkdir(parents=True, exist_ok=True)
    cache.write_text(t, encoding='utf-8')
    time.sleep(1)
    return t


def prompt(slug):
    p = BY[slug]
    a = p['article']
    body = article_text(p)[:9000]
    return f"""あなたはオープンソースと開発実務に詳しい編集者です。次の検索語で探している人に向けて、Zennの記事を紹介するページの本文を書いてください。

検索語: {p['keyword']}
扱うOSS: {p['ossName']}（{p.get('githubUrl', '')}）
紹介する記事: 「{a['title']}」（{a['name']}さん・{a['published_at'][:10]}公開）
記事の本文（コードは [コード] に置き換えてある）:
<<<
{body}
>>>

記事の内容は、上の本文に書いてあることだけを根拠にする。本文に無いことを記事が言っているように書かない。
記事の文をそのまま書き写さない。コマンド・設定値・コードは書かない（読者は記事本体で確認する）。
notes の「時間がたって変わっている可能性」は、公開日からの経過を踏まえ、確かめるべき点（公式ドキュメントの該当箇所など）を示す。確かでない最新情報を断定しない。
記事の著者を評価・批判しない。

{RULES}

出力の形:
{SCHEMA}"""


def check(d):
    err = common_check(d, ['title', 'description', 'lead', 'summary', 'flow', 'notes', 'faqs'])
    if err:
        return err
    if len(d['notes']) < 3 or len(d['faqs']) < 3:
        return '数が足りない'
    return ''


def make(slug):
    try:
        pr = prompt(slug)
    except Exception as e:
        return None, f'記事を読めない: {e}'
    return ask(pr, check)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', nargs='*'); ap.add_argument('--jobs', type=int, default=4)
    ap.add_argument('--force', action='store_true'); ap.add_argument('--limit', type=int, default=0)
    a = ap.parse_args()
    ng = run_batch(a.only or list(BY), lambda k: OUT / f'{k}.json', make, jobs=a.jobs, force=a.force, limit=a.limit)
    sys.exit(1 if ng else 0)
