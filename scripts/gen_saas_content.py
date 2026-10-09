#!/usr/bin/env python3
"""/saas/（SaaSとOSSの対応表）109枚に、サービスごとの本文を作る（2026-10-09）。

サービスごとに違うのは what と note（中央値134字・23枚は空）だけで、費用の表・「なぜ今」・FAQは全ページ同じ。
一致率0.67で、90日の検索はクリック10。検索語は「notion オープンソース」「trello 料金」「box 費用」の形。
data/saas-content/<slug>.json に作り、build-saas.ts が流し込む。OSSの表は dist/saas の今のページから読む。

  /usr/bin/python3 scripts/gen_saas_content.py [--only notion] [--force] [--jobs 4]
"""
import argparse, html, json, re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from content_gen import RULES, ask, common_check, run_batch

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'data' / 'saas-content'
LIST = json.load(open(ROOT / 'data' / 'saas-list.json', encoding='utf-8'))
BY = {s['slug']: s for s in LIST}

SCHEMA = """\
{
 "title": "検索結果に出す題名。全角32字以内。「<サービス名> オープンソース」「<サービス名> 代わり」など検索する人の言葉を先頭に置き、「｜」で区切って何が分かるかを続ける",
 "description": "検索結果の説明文。90〜120字",
 "lead": "冒頭の段落 2〜3文",
 "about": "このサービスが何をするもので、どんな会社がどの業務に使っているか。200〜300字",
 "pricing": "料金の仕組み（何に比例して増えるか：利用者数・店舗数・件数・容量など／プランの分かれ方／オプション）。金額・円・ドルの数字は書かない。200〜300字",
 "musthave": ["このサービスから乗り換えるとき、代わりのものに必ず要る機能を具体的に1行ずつ"],
 "migration": "データの持ち出しと移行で気をつけること（持ち出せるもの・持ち出しにくいもの・切り替えの順番）。200〜300字",
 "keep": "このサービスを使い続けたほうがよい場合。このサービスならではの強みに即して。150〜250字",
 "faqs": [{"q": "このサービスの利用者が実際に持つ疑問", "a": "答え 120〜220字"}]
}
musthave は5〜7個、faqs は3つ。"""


def oss_rows(slug):
    p = ROOT / 'dist' / 'saas' / f'{slug}.html'
    if not p.exists():
        return []
    rows = re.findall(r'<tr><th><a [^>]*>(.*?)</a></th><td>(.*?)</td><td>(.*?)</td>', p.read_text(encoding='utf-8'))
    return [f'{html.unescape(n)}（{html.unescape(l)}）: {html.unescape(d)}' for n, d, l in rows]


def prompt(slug):
    s = BY[slug]
    return f"""あなたは中小企業の業務システムとSaaSに詳しい編集者です。読者は「{s['name']}」を使っている（または検討している）会社の担当者で、費用や代わりのオープンソースを調べています。次のページの本文を書いてください。

サービス: {s['name']}（読み: {s.get('kana', '')}／提供元: {s['vendor']}）
当社がまとめた説明: {s['what']}
当社の見立て（事実として扱ってよい）: {s.get('note') or '（なし）'}
ページの下に表で載せるオープンソース: {' / '.join(oss_rows(slug)) or 'なし'}

このサービスの機能や料金体系について確かでないことは、書かないか、「〜の形が一般的です」のように一般論にとどめる。存在しない機能やプランを作らない。
金額（円・ドル・○○円/月 など）は一切書かない。改定されるので、公式サイトで確認するよう促す。

{RULES}

出力の形:
{SCHEMA}"""


def check(d):
    err = common_check(d, ['title', 'description', 'lead', 'about', 'pricing', 'musthave', 'migration', 'keep', 'faqs'])
    if err:
        return err
    if re.search(r'\d[\d,]*\s*(円|ドル|USD|\$)|\$\s*\d', json.dumps(d, ensure_ascii=False)):
        return '金額を書いている'
    if len(d['faqs']) < 3:
        return '数が足りない'
    return ''


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', nargs='*'); ap.add_argument('--jobs', type=int, default=4)
    ap.add_argument('--force', action='store_true'); ap.add_argument('--limit', type=int, default=0)
    a = ap.parse_args()
    ng = run_batch(a.only or list(BY), lambda k: OUT / f'{k}.json', lambda k: ask(prompt(k), check),
                   jobs=a.jobs, force=a.force, limit=a.limit)
    sys.exit(1 if ng else 0)
