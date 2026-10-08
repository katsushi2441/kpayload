#!/usr/bin/env python3
"""/helpdesk/（IT担当を外に持つ）20枚に、ページごとの本文を作る（2026-10-09）。

それまでは1枚あたり3〜4文（what/good/weak/souba）しかなく、比較の3項目とFAQ2問は全ページ同じ。
2枚の一致率0.85・固有の字数262字で、90日の検索はクリック1。
data/helpdesk-content/<slug>.json に作り、build-helpdesk.ts が流し込む。

  /usr/bin/python3 scripts/gen_helpdesk_content.py [--only josys-daiko] [--force] [--jobs 4]
"""
import argparse, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from content_gen import RULES, ask, common_check, run_batch

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'data' / 'helpdesk-content'
LIST = json.load(open(ROOT / 'data' / 'helpdesk-list.json', encoding='utf-8'))
BY = {p['slug']: p for p in LIST}

SCHEMA = """\
{
 "title": "検索結果に出す題名。全角32字以内。検索する人が打つ言葉（下の「検索語」）を先頭に置き、「｜」で区切って何が分かるかを続ける",
 "description": "検索結果の説明文。90〜120字",
 "lead": "冒頭の段落 2〜3文",
 "sections": [{"h": "見出し", "p": "本文 200〜350字。段落を分けたいときは \\n\\n で区切る"}],
 "checklist": ["依頼先を比べる・決めるときに確かめる項目を、このページの主題に合わせて具体的に1行ずつ"],
 "faqs": [{"q": "この主題で実際に聞かれる疑問", "a": "答え 120〜220字"}]
}
sections は5〜6個、checklist は6〜8個、faqs は4つ。"""

TYPE_SECS = '具体的に任せられる作業（日々・月次・年次で分けて）／任せにくい作業と、その理由／契約や見積で確かめること／似た任せ方（{others}）との違い／始めるときの進め方と最初の1〜3か月'
WORRY_SECS = 'この状況で実際に起きていること／放置するとどうなるか／まず社内で確かめること／取れる手（内製・採用・外部の任せ方の種類）と、それぞれの向き不向き／進め方'


def prompt(slug):
    p = BY[slug]
    types = [x['name'] for x in LIST if x['kind'] == 'type' and x['slug'] != slug]
    secs = (TYPE_SECS.format(others='、'.join(types[:4])) if p['kind'] == 'type' else WORRY_SECS)
    return f"""あなたは中小企業のIT運用に詳しい編集者です。読者は、社内にIT担当がいない（または1人しかいない）中小企業の経営者・総務担当です。次のページの本文を書いてください。

ページの主題: 「{p['name']}」（{'外部への任せ方の種類' if p['kind'] == 'type' else 'よくある困りごと'}）
検索語: {p['kw']}
当社がまとめた要点（事実として扱ってよい。費用の幅はこれを超える数字を足さない）:
- 何か: {p['what']}
- 向いている会社: {p['good']}
- 気をつけるところ: {p['weak']}
- 費用: {p['souba']}
この家族の他のページ（ここでは深入りしない）: {'、'.join(x['name'] for x in LIST if x['slug'] != slug)}

sections は次の流れで並べる: {secs}
見出しは、この流れの説明をそのまま写さず、その節で読者が分かることを短く言い表す（括弧書きを付けない）。

{RULES}

出力の形:
{SCHEMA}"""


def check(d):
    err = common_check(d, ['title', 'description', 'lead', 'sections', 'checklist', 'faqs'])
    if err:
        return err
    if len(d['sections']) < 5 or len(d['faqs']) < 4:
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
