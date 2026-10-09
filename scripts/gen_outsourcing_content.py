#!/usr/bin/env python3
"""/outsourcing/（業務のAI自動化）48枚に、ページごとの本文を作る（2026-10-09）。

LP型のページで、業務ごとに違うのは outsourced/auto/steps/keep の数行だけ。
2枚の一致率0.78・固有の字数711字で、90日の検索はクリック0。
「記帳代行」「電話代行」などで検索する人が知りたいこと（代行に頼める範囲・依頼先の選び方・
社内に残す場合の形・判断の基準）を本文にして data/outsourcing-content/<slug>.json に作る。

  /usr/bin/python3 scripts/gen_outsourcing_content.py [--only kityou] [--force] [--jobs 4]
"""
import argparse, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from content_gen import RULES, ask, common_check, run_batch

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'data' / 'outsourcing-content'
EXTRA = json.load(open(ROOT / 'data' / 'outsourcing-extra.json', encoding='utf-8'))
LIST = [{**g, **EXTRA['items'].get(g['slug'], {})} for g in json.load(open(ROOT / 'data' / 'outsourcing-list.json', encoding='utf-8'))]
BY = {g['slug']: g for g in LIST}

SCHEMA = """\
{
 "title": "検索結果に出す題名。全角32字以内。下の「検索語」を先頭に置き、「｜」で区切って何が分かるかを続ける",
 "description": "検索結果の説明文。90〜120字",
 "lead": "冒頭の段落 2〜3文。この業務を外に出そうと考える会社で、実際に何が起きているか",
 "sections": [{"h": "見出し", "p": "本文 200〜350字。段落を分けたいときは \\n\\n で区切る"}],
 "checklist": ["外注するか社内に残すかを決めるために、自社で確かめる項目を具体的に1行ずつ"],
 "faqs": [{"q": "この業務で実際に聞かれる疑問", "a": "答え 120〜220字"}]
}
sections は5つ、checklist は5〜7個、faqs は3つ。"""

SECS = ('代行・外注に頼むと、何をどこまでやってもらえるか（依頼の単位・受け渡しの方法・準備するもの）'
        '／依頼先を選ぶときに見るところ（この業務ならではの注意。個人情報・品質・納期など）'
        '／社内に仕組みとして残す場合の具体的な形（下の「社内に作る仕組み」を、この業務の現場の言葉で詳しく）'
        '／外注と社内のどちらが合うかの分かれ目（件数・頻度・判断の要る度合い・繁忙期など）'
        '／切り替えの進め方')


def prompt(slug):
    g = BY[slug]
    q = g.get('q') or f"{g['name']}の外注・代行"
    return f"""あなたは中小企業のバックオフィスと業務自動化に詳しい編集者です。読者は、この業務を外注（代行）に出すか迷っている中小企業の経営者・担当者です。次のページの本文を書いてください。

ページの主題: 「{g['name']}」を外注するか、社内に仕組みとして残すか
検索語: {q}
当社がまとめた要点（事実として扱ってよい）:
- 外注するとは: {g['outsourced']}
- 社内に作る仕組み: {g['auto']}
- 仕組みの中身: {' / '.join(g['steps'])}
- 外注のままのほうがいい場合: {g.get('keep') or '（未記入）'}
費用について: 代行の料金の相場や金額は書かない（当社の料金はテンプレート側にある）。

sections は次の流れで並べる: {SECS}
見出しは、この流れの説明をそのまま写さず、その節で読者が分かることを短く言い表す（括弧書きを付けない）。

{RULES}

出力の形:
{SCHEMA}"""


def check(d):
    err = common_check(d, ['title', 'description', 'lead', 'sections', 'checklist', 'faqs'])
    if err:
        return err
    if len(d['sections']) < 5 or len(d['faqs']) < 3:
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
